import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Modal, TextInput, ScrollView, Alert, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';

import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function TeacherTransportDashboard() {
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [buses, setBuses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBusId, setEditingBusId] = useState<number | null>(null);
    const [teacherData, setTeacherData] = useState<any>(null);

    const hasFullAccess = teacherData?.special_permission || false;

    const fetchBuses = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const data = await AsyncStorage.getItem('teacherData');
            const teacher = data ? JSON.parse(data) : null;
            if (teacher) setTeacherData(teacher);
            const sessionId = storedSessionId || (teacher ? teacher.current_session_id : null);

            if (!sessionId) {
                console.warn('[Transport] Session ID missing, skipping fetch');
                setLoading(false);
                return;
            }

            const response = await axios.get(`${API_ENDPOINTS.TRANSPORT}/list`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            setBuses(response.data.buses || []);
        } catch (error) {
            console.error('Error fetching buses:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load transport data' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchBuses(); }, []));

    const onRefresh = () => {
        setRefreshing(true);
        fetchBuses();
    };

    // Form State for Adding/Editing (Special Permission only)
    const [formData, setFormData] = useState({
        busNumber: '',
        driverName: '',
        driverMobile: '',
        staff: [{ name: '', mobile: '', role: 'Conductor' }]
    });

    const handleAddStaff = () => {
        setFormData({ ...formData, staff: [...formData.staff, { name: '', mobile: '', role: 'Staff' }] });
    };

    const handleRemoveStaff = (index: number) => {
        const newStaff = formData.staff.filter((_, i) => i !== index);
        setFormData({ ...formData, staff: newStaff });
    };

    const handleStaffChange = (index: number, field: string, value: string) => {
        const newStaff = [...formData.staff];
        (newStaff[index] as any)[field] = value;
        setFormData({ ...formData, staff: newStaff });
    };

    const handleSaveBus = async () => {
        if (!formData.busNumber || !formData.driverName) {
            Toast.show({ type: 'error', text1: 'Required', text2: 'Bus number and Driver name are required' });
            return;
        }
        
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const data = await AsyncStorage.getItem('teacherData');
            const teacher = data ? JSON.parse(data) : null;
            const sessionId = storedSessionId || (teacher ? teacher.current_session_id : null);

            if (!sessionId) {
                Toast.show({ type: 'error', text1: 'Error', text2: 'Academic session missing. Please refresh dashboard.' });
                return;
            }

            const headers = { 
                Authorization: `Bearer ${token}`,
                'x-academic-session-id': sessionId?.toString()
            };

            if (editingBusId) {
                await axios.put(`${API_ENDPOINTS.TRANSPORT}/update/${editingBusId}`, formData, {
                    headers
                });
                Toast.show({ type: 'success', text1: 'Success', text2: 'Bus updated successfully' });
            } else {
                await axios.post(`${API_ENDPOINTS.TRANSPORT}/add`, formData, {
                    headers
                });
                Toast.show({ type: 'success', text1: 'Success', text2: 'Bus registered successfully' });
            }
            setIsModalOpen(false);
            fetchBuses();
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to save bus' });
        }
    };

    const handleDeleteBus = (id: number) => {
        Alert.alert('Delete Bus', 'Are you sure you want to delete this bus?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive',
                onPress: async () => {
                    try {
                        const token = await AsyncStorage.getItem('teacherToken');
                        const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
                        const data = await AsyncStorage.getItem('teacherData');
                        const teacher = data ? JSON.parse(data) : null;
                        const sessionId = storedSessionId || (teacher ? teacher.current_session_id : null);

                        if (!sessionId) {
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Academic session missing.' });
                            return;
                        }

                        await axios.delete(`${API_ENDPOINTS.TRANSPORT}/delete/${id}`, {
                            headers: { 
                                Authorization: `Bearer ${token}`,
                                'x-academic-session-id': sessionId?.toString()
                            }
                        });
                        fetchBuses();
                    } catch (error) {
                        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete' });
                    }
                }
            }
        ]);
    };

    const renderBusCard = ({ item }: { item: any }) => (
        <Animated.View entering={FadeInUp} layout={Layout.springify()} style={[styles.busCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.busCardHeader}>
                <View style={styles.busIconWrapper}>
                    <LinearGradient colors={['#06b6d4', '#0891b2']} style={styles.busIconCircle}>
                        <Ionicons name="bus" size={24} color="#fff" />
                    </LinearGradient>
                    <View>
                        <Text style={[styles.busNumLabel, { color: theme.textLight }]}>BUS NUMBER</Text>
                        <Text style={[styles.busNumVal, { color: theme.text }]}>{item.bus_number}</Text>
                    </View>
                </View>
                {hasFullAccess && (
                    <View style={styles.cardActions}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => { setEditingBusId(item.id); setFormData({ busNumber: item.bus_number, driverName: item.driver_name, driverMobile: item.driver_mobile, staff: item.staff || [] }); setIsModalOpen(true); }}>
                            <Ionicons name="create-outline" size={20} color={theme.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F4433610' }]} onPress={() => handleDeleteBus(item.id)}>
                            <Ionicons name="trash-outline" size={20} color="#F44336" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <TouchableOpacity 
                style={[styles.routePreview, { backgroundColor: theme.background }]}
                onPress={() => router.push({ pathname: '/(teacher)/transport/live/[id]', params: { id: item.id } })}
            >
                {item.start_point && item.end_point ? (
                    <View style={styles.routePathRow}>
                        <View style={styles.pointBox}>
                            <Text style={styles.pointLabel}>FROM</Text>
                            <Text style={[styles.pointName, { color: theme.text }]} numberOfLines={1}>{item.start_point}</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={16} color={theme.primary} style={{ marginHorizontal: 10 }} />
                        <View style={styles.pointBox}>
                            <Text style={styles.pointLabel}>TO</Text>
                            <Text style={[styles.pointName, { color: theme.text }]} numberOfLines={1}>{item.end_point}</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.noRouteBox}>
                        <Ionicons name="warning-outline" size={18} color="#F59E0B" />
                        <Text style={styles.noRouteText}>Route pending. {hasFullAccess ? 'Tap footer to setup.' : ''}</Text>
                    </View>
                )}
            </TouchableOpacity>

            <View style={styles.staffGrid}>
                <View style={[styles.staffPill, { backgroundColor: isDark ? '#ffffff05' : '#00000002' }]}>
                    <View style={[styles.staffAvatar, { backgroundColor: theme.primary + '20' }]}><Text style={[styles.staffAvatarText, { color: theme.primary }]}>D</Text></View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.staffRole, { color: theme.textLight }]}>Driver</Text>
                        <Text style={[styles.staffName, { color: theme.text }]} numberOfLines={1}>{item.driver_name}</Text>
                        <Text style={[styles.staffContact, { color: theme.textLight }]}>{item.driver_mobile}</Text>
                    </View>
                </View>
                {item.staff && item.staff.map((s: any, idx: number) => (
                    <View key={idx} style={[styles.staffPill, { backgroundColor: isDark ? '#ffffff05' : '#00000002' }]}>
                        <View style={[styles.staffAvatar, { backgroundColor: '#10b98120' }]}><Text style={[styles.staffAvatarText, { color: '#10b981' }]}>H</Text></View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.staffRole, { color: theme.textLight }]}>{s.role}</Text>
                            <Text style={[styles.staffName, { color: theme.text }]} numberOfLines={1}>{s.name}</Text>
                            <Text style={[styles.staffContact, { color: theme.textLight }]}>{s.mobile}</Text>
                        </View>
                    </View>
                ))}
            </View>

            {hasFullAccess && (
                <TouchableOpacity 
                    style={[styles.configFooter, { borderTopColor: theme.border }]}
                    onPress={() => router.push(`/(teacher)/transport/config/${item.id}`)}
                >
                    <Text style={[styles.configText, { color: theme.primary }]}>Configure Route & Students</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                </TouchableOpacity>
            )}
        </Animated.View>
    );

    const styles = StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        headerLeft: { flexDirection: 'row', alignItems: 'center' },
        backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
        title: { fontSize: 20, fontWeight: '800', color: theme.text, marginLeft: 15 },
        addBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.primary, flexDirection: 'row', alignItems: 'center', gap: 6 },
        addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
        listContent: { padding: 20, paddingBottom: 40 },
        busCard: { borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, elevation: 3 },
        busCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
        busIconWrapper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        busIconCircle: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
        busNumLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
        busNumVal: { fontSize: 18, fontWeight: '900' },
        cardActions: { flexDirection: 'row', gap: 8 },
        actionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center' },
        routePreview: { padding: 15, borderRadius: 18, marginBottom: 20 },
        routePathRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        pointBox: { flex: 1 },
        pointLabel: { fontSize: 8, fontWeight: '800', color: theme.primary, marginBottom: 2 },
        pointName: { fontSize: 13, fontWeight: '700' },
        noRouteBox: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
        noRouteText: { fontSize: 12, color: '#F59E0B', fontWeight: '700' },
        staffGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
        staffPill: { flex: 1, minWidth: (SCREEN_WIDTH - 80) / 2, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 15 },
        staffAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
        staffAvatarText: { fontSize: 14, fontWeight: '900' },
        staffRole: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
        staffName: { fontSize: 13, fontWeight: '700' },
        staffContact: { fontSize: 10, fontWeight: '600' },
        configFooter: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        configText: { fontSize: 12, fontWeight: '800' },
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        modalContainer: { backgroundColor: theme.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 20, height: '85%' },
        modalHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        modalTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
        modalBody: { padding: 20 },
        inputGroup: { marginBottom: 20 },
        label: { fontSize: 13, fontWeight: '700', color: theme.textLight, marginBottom: 8 },
        input: { backgroundColor: theme.background, height: 50, borderRadius: 15, paddingHorizontal: 15, color: theme.text, borderWidth: 1, borderColor: theme.border },
        formRow: { flexDirection: 'row', gap: 15 },
        dividerLabel: { fontSize: 11, fontWeight: '800', color: theme.primary, textTransform: 'uppercase', letterSpacing: 1, marginVertical: 15 },
        staffInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
        staffInput: { flex: 1, height: 45, backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 12, color: theme.text, borderWidth: 1, borderColor: theme.border },
        removeStaffBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F4433610', justifyContent: 'center', alignItems: 'center' },
        addStaffLineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
        addStaffLineText: { color: theme.primary, fontWeight: '700', fontSize: 13 },
        modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', gap: 12 },
        cancelBtn: { flex: 1, height: 50, borderRadius: 15, backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' },
        confirmBtn: { flex: 2, height: 50, borderRadius: 15, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
        btnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
    });

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Transport</Text>
                </View>
                {hasFullAccess && (
                    <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingBusId(null); setFormData({ busNumber: '', driverName: '', driverMobile: '', staff: [{ name: '', mobile: '', role: 'Conductor' }] }); setIsModalOpen(true); }}>
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.addBtnText}>Add Bus</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 50 }} color={theme.primary} />
            ) : (
                <FlatList 
                    data={buses}
                    renderItem={renderBusCard}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Ionicons name="bus-outline" size={64} color={theme.border} />
                            <Text style={{ color: theme.textLight, marginTop: 10, fontSize: 16 }}>No buses registered yet</Text>
                        </View>
                    }
                />
            )}

            <Modal visible={isModalOpen} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingBusId ? 'Edit Bus' : 'Register Bus'}</Text>
                            <TouchableOpacity onPress={() => setIsModalOpen(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <View style={styles.inputGroup}><Text style={styles.label}>Bus Number</Text><TextInput style={styles.input} value={formData.busNumber} onChangeText={(v) => setFormData({...formData, busNumber: v})} placeholder="MH 12 AB 1234" placeholderTextColor={theme.textLight}/></View>
                            <View style={styles.formRow}>
                                <View style={[styles.inputGroup, { flex: 1 }]}><Text style={styles.label}>Driver Name</Text><TextInput style={styles.input} value={formData.driverName} onChangeText={(v) => setFormData({...formData, driverName: v})} placeholder="Full Name" placeholderTextColor={theme.textLight}/></View>
                                <View style={[styles.inputGroup, { flex: 1 }]}><Text style={styles.label}>Mobile</Text><TextInput style={styles.input} value={formData.driverMobile} onChangeText={(v) => setFormData({...formData, driverMobile: v})} keyboardType="phone-pad" placeholder="+91" placeholderTextColor={theme.textLight}/></View>
                            </View>
                            <Text style={styles.dividerLabel}>Additional Staff</Text>
                            {formData.staff.map((s, idx) => (
                                <View key={idx} style={styles.staffInputRow}>
                                    <TextInput style={styles.staffInput} value={s.name} onChangeText={(v) => handleStaffChange(idx, 'name', v)} placeholder="Name" placeholderTextColor={theme.textLight}/>
                                    <TextInput style={styles.staffInput} value={s.mobile} onChangeText={(v) => handleStaffChange(idx, 'mobile', v)} keyboardType="phone-pad" placeholder="Mobile" placeholderTextColor={theme.textLight}/>
                                    <TouchableOpacity onPress={() => handleRemoveStaff(idx)}><Ionicons name="close-circle" size={20} color="#F44336" /></TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.addStaffLineBtn} onPress={handleAddStaff}><Ionicons name="add-circle" size={20} color={theme.primary}/><Text style={styles.addStaffLineText}>Add staff</Text></TouchableOpacity>
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}><Text style={{color:theme.text, fontWeight:'700'}}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.confirmBtn} onPress={handleSaveBus}><Text style={styles.btnText}>Save Details</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
