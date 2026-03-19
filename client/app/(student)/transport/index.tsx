import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Dimensions } from 'react-native';
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

export default function StudentTransport() {
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [buses, setBuses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [studentData, setStudentData] = useState<any>(null);

    const fetchBuses = async () => {
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const data = await AsyncStorage.getItem('studentData');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            
            if (!data) return;
            const parsedStudent = JSON.parse(data);
            setStudentData(parsedStudent);
            
            const sessionId = storedSessionId || parsedStudent.current_session_id;

            if (!sessionId) {
                console.warn('[Transport] Session ID missing, skipping fetch');
                setLoading(false);
                setRefreshing(false);
                return;
            }

            const response = await axios.get(`${API_ENDPOINTS.TRANSPORT}/list`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId.toString()
                }
            });
            
            const allBuses = response.data.buses || [];
            // Filter only the bus where student is assigned
            const assignedBuses = allBuses.filter((bus: any) => 
                bus.assignments?.some((a: any) => String(a.student_id) === String(parsedStudent.id))
            );
            
            setBuses(assignedBuses);
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
                <TouchableOpacity 
                    style={styles.trackBtn} 
                    onPress={() => router.push(`/(student)/transport/live/${item.id}`)}
                >
                    <Ionicons name="location" size={18} color="#fff" />
                    <Text style={styles.trackBtnText}>Track</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.routePreview, { backgroundColor: theme.background }]}>
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
                        <Text style={styles.noRouteText}>Route configuration pending.</Text>
                    </View>
                )}
            </View>

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
        </Animated.View>
    );

    const styles = StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center' },
        backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
        title: { fontSize: 20, fontWeight: '800', color: theme.text, marginLeft: 15 },

        listContent: { padding: 20, paddingBottom: 40 },
        busCard: { borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
        busCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        busIconWrapper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        busIconCircle: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
        busNumLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
        busNumVal: { fontSize: 18, fontWeight: '900' },
        trackBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.primary, flexDirection: 'row', alignItems: 'center', gap: 6 },
        trackBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

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
    });

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>My Transport</Text>
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
                        <View style={{ alignItems: 'center', marginTop: 100, paddingHorizontal: 40 }}>
                            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                                <Ionicons name="bus-outline" size={50} color={theme.border} />
                            </View>
                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>No assigned transport</Text>
                            <Text style={{ color: theme.textLight, marginTop: 10, fontSize: 14, textAlign: 'center' }}>You are not assigned to any bus route yet. Please contact the office.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
