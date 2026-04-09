import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, FlatList, Image, RefreshControl, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useSocket } from '../../../../context/SocketContext';
import { useTheme } from '../../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../../constants/Config';
import { getFullImageUrl } from '@/utils/imageHelper';

export default function PrincipalLiveTracking() {
    const { id } = useLocalSearchParams();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { socket } = useSocket();

    const [bus, setBus] = useState<any>(null);
    const [stops, setStops] = useState<any[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'pickup' | 'drop'>('pickup'); 
    const [selectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [expandedStops, setExpandedStops] = useState(new Set());
    const [lastMarkedStopId, setLastMarkedStopId] = useState<number | null>(null);
    const [tripStatus, setTripStatus] = useState('pending');

    const fetchData = async () => {
        try {
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('principalData') || await AsyncStorage.getItem('userData');
            const sessionId = storedSessionId || (userDataStr ? JSON.parse(userDataStr).current_session_id : null);

            const headers = { 
                Authorization: `Bearer ${token}`,
                'x-academic-session-id': sessionId?.toString()
            };

            const [busRes, logsRes] = await Promise.all([
                axios.get(`${API_ENDPOINTS.TRANSPORT}/list`, { headers }),
                axios.get(`${API_ENDPOINTS.TRANSPORT}/logs/${id}`, {
                    params: { date: selectedDate, type: activeTab },
                    headers
                })
            ]);

            const selectedBus = busRes.data.buses.find((b: any) => String(b.id) === String(id));
            if (selectedBus) {
                setBus(selectedBus);
                setStops(selectedBus.stops || []);
                setAssignments(selectedBus.assignments || []);
                setExpandedStops(new Set((selectedBus.stops || []).map((s: any) => s.id)));
            }

            const fetchedLogs = logsRes.data.logs || [];
            setLogs(fetchedLogs);
            setTripStatus(logsRes.data.tripStatus || 'pending');
            
            if (fetchedLogs.length > 0 && logsRes.data.tripStatus === 'started') {
                const lastLog = [...fetchedLogs].sort((a, b) => new Date(b.marked_at).getTime() - new Date(a.marked_at).getTime())[0];
                setLastMarkedStopId(lastLog.stop_id);
            }
        } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load tracking data' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    useEffect(() => {
        fetchData();
        if (socket) {
            socket.emit('join_institute', id); 
            
            const handleStatusUpdate = (data: any) => {
                if (String(data.busId) === String(id) && data.date === selectedDate && data.type === activeTab) {
                    setLogs(prev => {
                        const filtered = prev.filter(l => l.student_id !== data.studentId);
                        if (data.status === 'boarded') {
                            return [...filtered, { 
                                student_id: data.studentId, 
                                status: 'boarded', 
                                stop_id: data.stopId,
                                marked_at: data.marked_at 
                            }];
                        }
                        return filtered;
                    });
                    if (data.status === 'boarded') setLastMarkedStopId(data.stopId);
                }
            };

            const handleTripUpdate = (data: any) => {
                if (String(data.busId) === String(id) && data.date === selectedDate && data.type === activeTab) {
                    setTripStatus(data.status);
                    if (data.status === 'completed') setLastMarkedStopId(null);
                }
            };

            socket.on('transport_status_update', handleStatusUpdate);
            socket.on('trip_status_update', handleTripUpdate);

            return () => {
                socket.off('transport_status_update', handleStatusUpdate);
                socket.off('trip_status_update', handleTripUpdate);
            };
        }
    }, [id, activeTab]);

    const toggleStop = (stopId: number) => {
        const newExpanded = new Set(expandedStops);
        if (newExpanded.has(stopId)) newExpanded.delete(stopId);
        else newExpanded.add(stopId);
        setExpandedStops(newExpanded);
    };

    const handleShare = async () => {
        try {
            const webBase = API_ENDPOINTS.TRANSPORT.split('/api')[0];
            const shareUrl = `${webBase}/driver/manifest/${id}`;
            await Share.share({
                title: `Bus Manifest - ${bus?.bus_number}`,
                message: `Live Manifest Link for Bus ${bus?.bus_number} (${bus?.driver_name}): ${shareUrl}`,
                url: shareUrl,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const styles = StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
        title: { fontSize: 18, fontWeight: '800', color: theme.text, marginLeft: 15 },
        shareBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.primary + '15' },
        
        controlPanel: { padding: 20, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border },
        routeInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
        statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
        statusText: { fontSize: 10, fontWeight: '900', color: '#fff' },
        busTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        routePath: { fontSize: 12, color: theme.textLight, marginTop: 2 },

        tabs: { flexDirection: 'row', gap: 10, marginBottom: 10 },
        tab: { flex: 1, paddingVertical: 12, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
        tabActive: { backgroundColor: theme.primary, borderColor: theme.primary },
        tabTitle: { fontSize: 14, fontWeight: '800', color: theme.textLight },
        tabTitleActive: { color: '#fff' },
        tabDesc: { fontSize: 10, fontWeight: '600', color: theme.textLight + '80' },
        tabDescActive: { color: 'rgba(255,255,255,0.7)' },

        list: { padding: 20 },
        stopCard: { borderRadius: 20, backgroundColor: theme.card, marginBottom: 15, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
        stopCardActive: { borderColor: theme.primary, borderWidth: 2 },
        stopHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 },
        stopNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary + '20', justifyContent: 'center', alignItems: 'center' },
        stopNumText: { color: theme.primary, fontSize: 12, fontWeight: '900' },
        stopName: { fontSize: 15, fontWeight: '700', color: theme.text, flex: 1 },
        liveTag: { color: theme.primary, fontSize: 10, fontWeight: '900' },
        
        studentList: { padding: 15, backgroundColor: isDark ? '#ffffff05' : '#00000002', borderTopWidth: 1, borderTopColor: theme.border },
        studentPill: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: theme.card, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
        studentPillBoarded: { borderColor: '#4CAF50', backgroundColor: '#4CAF5005' },
        avatar: { width: 32, height: 32, borderRadius: 16 },
        sName: { fontSize: 13, fontWeight: '700', color: theme.text },
        sInfo: { fontSize: 10, color: theme.textLight },
        statusIndicator: { marginLeft: 'auto', alignItems: 'flex-end' },
        indicatorText: { fontSize: 10, fontWeight: '800' },
        timeText: { fontSize: 8, color: theme.textLight, marginTop: 2 }
    });

    if (loading) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Live Route Status</Text>
                </View>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                    <Ionicons name="share-outline" size={20} color={theme.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.controlPanel}>
                <View style={styles.routeInfo}>
                    <View style={[styles.statusBadge, { backgroundColor: tripStatus === 'started' ? theme.primary : tripStatus === 'completed' ? '#4CAF50' : theme.textLight }]}>
                        <Text style={styles.statusText}>{tripStatus.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.busTitle}>Bus {bus?.bus_number}</Text>
                        <Text style={styles.routePath}>{bus?.start_point} ↔ {bus?.end_point}</Text>
                    </View>
                </View>

                <View style={styles.tabs}>
                    <TouchableOpacity style={[styles.tab, activeTab === 'pickup' && styles.tabActive]} onPress={() => setActiveTab('pickup')}>
                        <Text style={[styles.tabTitle, activeTab === 'pickup' && styles.tabTitleActive]}>Pickup</Text>
                        <Text style={[styles.tabDesc, activeTab === 'pickup' && styles.tabDescActive]}>To School</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tab, activeTab === 'drop' && styles.tabActive]} onPress={() => setActiveTab('drop')}>
                        <Text style={[styles.tabTitle, activeTab === 'drop' && styles.tabTitleActive]}>Drop</Text>
                        <Text style={[styles.tabDesc, activeTab === 'drop' && styles.tabDescActive]}>To Home</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList 
                data={stops}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
                renderItem={({ item, index }) => {
                    const stopStudents = assignments.filter(a => a.stop_id === item.id);
                    const isExpanded = expandedStops.has(item.id);
                    const isLive = lastMarkedStopId === item.id;

                    return (
                        <View style={[styles.stopCard, isLive && styles.stopCardActive]}>
                            <TouchableOpacity style={styles.stopHeader} onPress={() => toggleStop(item.id)}>
                                <View style={styles.stopNum}><Text style={styles.stopNumText}>{index + 1}</Text></View>
                                <Text style={styles.stopName}>{item.stop_name}</Text>
                                {isLive && <Text style={styles.liveTag}>● LIVE</Text>}
                                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={theme.textLight} />
                            </TouchableOpacity>

                            {isExpanded && (
                                <View style={styles.studentList}>
                                    {stopStudents.map(student => {
                                        const log = logs.find(l => l.student_id === student.student_id && l.status === 'boarded');
                                        const isMarked = !!log;
                                        return (
                                            <View key={student.student_id} style={[styles.studentPill, isMarked && styles.studentPillBoarded]}>
                                                <Image source={student.photo_url ? { uri: getFullImageUrl(student.photo_url) ?? undefined } : require('../../../../assets/images/react-logo.png')} style={styles.avatar} />
                                                <View>
                                                    <Text style={styles.sName}>{student.student_name}</Text>
                                                    <Text style={styles.sInfo}>Class {student.class}-{student.section}</Text>
                                                </View>
                                                <View style={styles.statusIndicator}>
                                                    <Text style={[styles.indicatorText, { color: isMarked ? '#4CAF50' : theme.textLight }]}>
                                                        {isMarked ? (activeTab === 'pickup' ? 'Picked Up' : 'Dropped') : 'Pending'}
                                                    </Text>
                                                    {isMarked && log.marked_at && (
                                                        <Text style={styles.timeText}>{new Date(log.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}
                                    {stopStudents.length === 0 && <Text style={{ fontSize: 12, color: theme.textLight, textAlign: 'center' }}>No students assigned.</Text>}
                                </View>
                            )}
                        </View>
                    );
                }}
            />
        </View>
    );
}