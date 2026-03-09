import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, FlatList, Dimensions, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

import { useTheme } from '../../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TeacherRouteConfiguration() {
    const { id } = useLocalSearchParams();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    
    const [bus, setBus] = useState<any>(null);
    const [startPoint, setStartPoint] = useState('');
    const [endPoint, setEndPoint] = useState('');
    const [stops, setStops] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]); 
    
    const [newStopName, setNewStopName] = useState('');
    const [allStudents, setStudentsList] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStopId, setSelectedStopId] = useState<any>(null);

    useEffect(() => {
        fetchInitialData();
    }, [id]);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const data = await AsyncStorage.getItem('teacherData');
            const teacher = data ? JSON.parse(data) : null;
            const sessionId = storedSessionId || (teacher ? teacher.current_session_id : null);

            const headers = { 
                Authorization: `Bearer ${token}`,
                'x-academic-session-id': sessionId?.toString()
            };
            
            const [busRes, stopsRes, assignRes, studentsRes] = await Promise.all([
                axios.get(`${API_ENDPOINTS.TRANSPORT}/list`, { headers }),
                axios.get(`${API_ENDPOINTS.TRANSPORT}/stops/${id}`, { headers }),
                axios.get(`${API_ENDPOINTS.TRANSPORT}/assignments/${id}`, { headers }),
                axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, { headers })
            ]);

            const selectedBus = busRes.data.buses.find((b: any) => String(b.id) === String(id));
            if (selectedBus) {
                setBus(selectedBus);
                setStartPoint(selectedBus.start_point || '');
                setEndPoint(selectedBus.end_point || '');
                const fetchedStops = stopsRes.data.stops || [];
                setStops(fetchedStops);
                if (fetchedStops.length > 0) setSelectedStopId(fetchedStops[0].id);
                setAssignments(assignRes.data.assignments || []);
                setStudentsList(studentsRes.data.students || []);
            }
        } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load configuration' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddStop = () => {
        if (!newStopName.trim()) return;
        const newStop = {
            id: `temp_${Date.now()}`, 
            stop_name: newStopName,
            order_index: stops.length
        };
        setStops([...stops, newStop]);
        setNewStopName('');
        if (!selectedStopId) setSelectedStopId(newStop.id);
    };

    const handleRemoveStop = (index: number) => {
        const stopToRemove = stops[index];
        setAssignments(assignments.filter(a => a.stop_id !== stopToRemove.id));
        const updatedStops = stops.filter((_, i) => i !== index).map((stop, i) => ({ ...stop, order_index: i }));
        setStops(updatedStops);
        if (selectedStopId === stopToRemove.id) setSelectedStopId(updatedStops[0]?.id || null);
    };

    const handleLocalAssign = (student: any) => {
        if (!selectedStopId) {
            Toast.show({ type: 'error', text1: 'Wait', text2: 'Please select a stop first' });
            return;
        }
        const existing = assignments.find(a => a.student_id === student.id);
        if (existing) {
            setAssignments(assignments.map(a => a.student_id === student.id ? { ...a, stop_id: selectedStopId } : a));
        } else {
            setAssignments([...assignments, {
                student_id: student.id,
                stop_id: selectedStopId,
                student_name: student.name,
                class: student.class,
                section: student.section,
                roll_no: student.roll_no,
                photo_url: student.photo_url
            }]);
        }
    };

    const handleLocalRemove = (studentId: number) => {
        setAssignments(assignments.filter(a => a.student_id !== studentId));
    };

    const handleFinalSave = async () => {
        if (!startPoint || !endPoint || stops.length === 0) {
            Toast.show({ type: 'error', text1: 'Incomplete', text2: 'Route and stops are required' });
            return;
        }
        try {
            setSaving(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const data = await AsyncStorage.getItem('teacherData');
            const teacher = data ? JSON.parse(data) : null;
            const sessionId = storedSessionId || (teacher ? teacher.current_session_id : null);

            await axios.post(`${API_ENDPOINTS.TRANSPORT}/sync-manifest/${id}`, {
                startPoint,
                endPoint,
                stops: stops.map((s, idx) => ({ stop_name: s.stop_name, order_index: idx })),
                assignments: assignments.map(a => {
                    const localStop = stops.find(s => s.id === a.stop_id);
                    return { student_id: a.student_id, stop_name: localStop.stop_name };
                })
            }, { 
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                } 
            });
            Toast.show({ type: 'success', text1: 'Success', text2: 'Manifest synced successfully' });
            router.back();
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save manifest' });
        } finally {
            setSaving(false);
        }
    };

    const filteredStudents = allStudents.filter(s => {
        const searchStr = (s.name + s.roll_no + s.class + s.section).toLowerCase();
        return searchStr.includes(searchQuery.toLowerCase());
    });

    const styles = StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center' },
        backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
        headerText: { marginLeft: 15 },
        title: { fontSize: 18, fontWeight: '800', color: theme.text },
        subtitle: { fontSize: 12, color: theme.textLight },
        stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border },
        stepItem: { alignItems: 'center', width: 80 },
        stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
        stepCircleActive: { backgroundColor: theme.primary },
        stepText: { fontSize: 10, fontWeight: '800', color: theme.textLight },
        stepTextActive: { color: theme.primary },
        stepLine: { width: 40, height: 2, backgroundColor: theme.border, marginBottom: 15 },
        stepLineActive: { backgroundColor: theme.primary },
        content: { flex: 1, padding: 20 },
        card: { backgroundColor: theme.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.border, elevation: 2 },
        cardTitle: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 20 },
        inputGroup: { marginBottom: 20 },
        label: { fontSize: 12, fontWeight: '700', color: theme.textLight, marginBottom: 8 },
        input: { backgroundColor: theme.background, height: 50, borderRadius: 15, paddingHorizontal: 15, color: theme.text, borderWidth: 1, borderColor: theme.border },
        routeVisual: { alignItems: 'center', marginVertical: 10 },
        visualDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary },
        visualLine: { width: 2, height: 30, backgroundColor: theme.primary + '40' },
        stopInputRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
        addStopBtn: { width: 50, height: 50, borderRadius: 15, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
        stopItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
        stopMarker: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: theme.primary, backgroundColor: theme.card },
        stopContent: { flex: 1, height: 45, backgroundColor: theme.card, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border },
        stopName: { fontSize: 14, fontWeight: '600', color: theme.text },
        assignmentLayout: { flex: 1, flexDirection: 'row', gap: 15 },
        stopsSidebar: { width: 100 },
        sidebarStop: { padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
        sidebarStopActive: { backgroundColor: theme.primary + '10', borderColor: theme.primary },
        sidebarStopName: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
        countBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: theme.primary, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
        countText: { color: '#fff', fontSize: 9, fontWeight: '900' },
        studentPanel: { flex: 1 },
        searchBox: { height: 45, backgroundColor: theme.card, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 15, borderWidth: 1, borderColor: theme.border },
        studentCard: { padding: 10, borderRadius: 15, backgroundColor: theme.card, marginBottom: 10, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
        studentCardActive: { borderColor: theme.primary, backgroundColor: theme.primary + '05' },
        studentCardElsewhere: { borderColor: '#F59E0B', opacity: 0.8 },
        studentAvatar: { width: 36, height: 36, borderRadius: 18 },
        studentName: { fontSize: 13, fontWeight: '700' },
        studentClass: { fontSize: 10, color: theme.textLight },
        elsewhereTag: { fontSize: 8, color: '#F59E0B', fontWeight: '800', marginTop: 2 },
        footer: { padding: 20, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', gap: 12 },
        nextBtn: { flex: 1, height: 50, borderRadius: 15, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
        backBtnFooter: { flex: 0.5, height: 50, borderRadius: 15, backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' },
        btnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
    });

    if (loading) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.title}>Manifest Setup</Text>
                    <Text style={styles.subtitle}>Bus: {bus?.bus_number}</Text>
                </View>
            </View>

            <View style={styles.stepIndicator}>
                <TouchableOpacity onPress={() => setCurrentStep(1)} style={styles.stepItem}>
                    <View style={[styles.stepCircle, currentStep >= 1 && styles.stepCircleActive]}><Text style={{color:'#fff',fontSize:12,fontWeight:'bold'}}>1</Text></View>
                    <Text style={[styles.stepText, currentStep === 1 && styles.stepTextActive]}>Points</Text>
                </TouchableOpacity>
                <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />
                <TouchableOpacity onPress={() => currentStep >= 2 && setCurrentStep(2)} style={styles.stepItem}>
                    <View style={[styles.stepCircle, currentStep >= 2 && styles.stepCircleActive]}><Text style={{color:'#fff',fontSize:12,fontWeight:'bold'}}>2</Text></View>
                    <Text style={[styles.stepText, currentStep === 2 && styles.stepTextActive]}>Stops</Text>
                </TouchableOpacity>
                <View style={[styles.stepLine, currentStep >= 3 && styles.stepLineActive]} />
                <TouchableOpacity onPress={() => currentStep >= 3 && setCurrentStep(3)} style={styles.stepItem}>
                    <View style={[styles.stepCircle, currentStep >= 3 && styles.stepCircleActive]}><Text style={{color:'#fff',fontSize:12,fontWeight:'bold'}}>3</Text></View>
                    <Text style={[styles.stepText, currentStep === 3 && styles.stepTextActive]}>Users</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                {currentStep === 1 && (
                    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.card}>
                        <Text style={styles.cardTitle}>Journey Points</Text>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>🏁 STARTING POINT</Text>
                            <TextInput style={styles.input} value={startPoint} onChangeText={setStartPoint} placeholder="Ex: School Campus" placeholderTextColor={theme.textLight} />
                        </View>
                        <View style={styles.routeVisual}>
                            <View style={styles.visualDot} /><View style={styles.visualLine} /><View style={styles.visualDot} />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>📍 ENDING POINT</Text>
                            <TextInput style={styles.input} value={endPoint} onChangeText={setEndPoint} placeholder="Ex: City Center" placeholderTextColor={theme.textLight} />
                        </View>
                    </Animated.View>
                )}

                {currentStep === 2 && (
                    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={{ flex: 1 }}>
                        <View style={styles.stopInputRow}>
                            <TextInput 
                                style={[styles.input, { flex: 1 }]} 
                                placeholder="Add stop name..." 
                                value={newStopName} 
                                onChangeText={setNewStopName}
                                placeholderTextColor={theme.textLight}
                            />
                            <TouchableOpacity style={styles.addStopBtn} onPress={handleAddStop}>
                                <Ionicons name="add" size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.stopItem}>
                                <View style={[styles.stopMarker, { backgroundColor: theme.primary }]} />
                                <View style={[styles.stopContent, { opacity: 0.6 }]}><Text style={styles.stopName}>{startPoint} (Start)</Text></View>
                            </View>
                            {stops.map((stop, idx) => (
                                <View key={stop.id} style={styles.stopItem}>
                                    <View style={styles.stopMarker} />
                                    <View style={styles.stopContent}>
                                        <Text style={styles.stopName}>{stop.stop_name}</Text>
                                        <TouchableOpacity onPress={() => handleRemoveStop(idx)}>
                                            <Ionicons name="trash-outline" size={18} color="#F44336" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            <View style={styles.stopItem}>
                                <View style={[styles.stopMarker, { backgroundColor: '#F44336' }]} />
                                <View style={[styles.stopContent, { opacity: 0.6 }]}><Text style={styles.stopName}>{endPoint} (End)</Text></View>
                            </View>
                        </ScrollView>
                    </Animated.View>
                )}

                {currentStep === 3 && (
                    <Animated.View entering={FadeInRight} style={styles.assignmentLayout}>
                        <View style={styles.stopsSidebar}>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {stops.map(stop => (
                                    <TouchableOpacity 
                                        key={stop.id} 
                                        style={[styles.sidebarStop, selectedStopId === stop.id && styles.sidebarStopActive]}
                                        onPress={() => setSelectedStopId(stop.id)}
                                    >
                                        <Text style={[styles.sidebarStopName, { color: selectedStopId === stop.id ? theme.primary : theme.textLight }]}>{stop.stop_name}</Text>
                                        <View style={styles.countBadge}>
                                            <Text style={styles.countText}>{assignments.filter(a => a.stop_id === stop.id).length}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.studentPanel}>
                            <View style={styles.searchBox}>
                                <Ionicons name="search" size={18} color={theme.textLight} />
                                <TextInput style={{ flex: 1, marginLeft: 8, color: theme.text }} placeholder="Search student..." value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor={theme.textLight} />
                            </View>
                            <FlatList 
                                data={filteredStudents}
                                keyExtractor={item => item.id.toString()}
                                renderItem={({ item }) => {
                                    const assignment = assignments.find(a => a.student_id === item.id);
                                    const isCurrent = assignment?.stop_id === selectedStopId;
                                    const isElsewhere = assignment && !isCurrent;
                                    return (
                                        <TouchableOpacity 
                                            style={[styles.studentCard, isCurrent && styles.studentCardActive, isElsewhere && styles.studentCardElsewhere]}
                                            onPress={() => isCurrent ? handleLocalRemove(item.id) : handleLocalAssign(item)}
                                        >
                                            <Image source={item.photo_url ? { uri: item.photo_url } : require('../../../../assets/images/react-logo.png')} style={styles.studentAvatar} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.studentName, { color: theme.text }]}>{item.name}</Text>
                                                <Text style={styles.studentClass}>Class {item.class}-{item.section}</Text>
                                                {isElsewhere && <Text style={styles.elsewhereTag}>At: {stops.find(s => s.id === assignment.stop_id)?.stop_name}</Text>}
                                            </View>
                                            {isCurrent && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    </Animated.View>
                )}
            </View>

            <View style={styles.footer}>
                {currentStep > 1 && (
                    <TouchableOpacity style={styles.backBtnFooter} onPress={() => setCurrentStep(prev => prev - 1)}>
                        <Text style={[styles.btnText, { color: theme.text }]}>Back</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity 
                    style={styles.nextBtn} 
                    onPress={() => {
                        if (currentStep < 3) setCurrentStep(prev => prev + 1);
                        else handleFinalSave();
                    }}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{currentStep === 3 ? 'Save & Sync' : 'Next Step'}</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}
