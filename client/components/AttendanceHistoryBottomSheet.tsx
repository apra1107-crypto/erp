import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, FlatList, Image, Dimensions, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useTheme } from '../context/ThemeContext';
import { API_ENDPOINTS } from '../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AttendanceHistoryBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    student: any;
}

const AttendanceHistoryBottomSheet = ({ visible, onClose, student }: AttendanceHistoryBottomSheetProps) => {
    const { theme, isDark } = useTheme();
    
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [absentRequests, setAbsentRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [attendanceMonth, setAttendanceMonth] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (visible && student) {
            fetchAllData();
        }
    }, [visible, student, attendanceMonth]);

    const getToken = async () => {
        return await AsyncStorage.getItem('token') || await AsyncStorage.getItem('teacherToken');
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const selectedSessionId = await AsyncStorage.getItem('selectedSessionId');
            
            const headers: any = { Authorization: `Bearer ${token}` };
            if (selectedSessionId) {
                headers['x-academic-session-id'] = selectedSessionId;
            }

            const year = attendanceMonth.getFullYear();
            const month = String(attendanceMonth.getMonth() + 1).padStart(2, '0');
            const monthStart = `${year}-${month}-01`;
            const daysInMonth = new Date(year, attendanceMonth.getMonth() + 1, 0).getDate();
            const monthEnd = `${year}-${month}-${String(daysInMonth).padStart(2, '0')}`;

            // Fetch Attendance
            // We use the ID but the server middleware will ensure it's filtered by session
            const attRes = await axios.get(
                `${API_ENDPOINTS.ATTENDANCE}/student/${student.id}?startDate=${monthStart}&endDate=${monthEnd}`,
                { headers }
            );
            
            // Fetch Absent Requests
            const reqRes = await axios.get(
                `${API_ENDPOINTS.ABSENT_REQUEST}/student/${student.id}`,
                { headers }
            );

            setAttendanceData(attRes.data.attendance || []);
            setAbsentRequests(reqRes.data.requests || []);
        } catch (error) {
            console.error('Error fetching student attendance history:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load history' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const getAttendanceDays = () => {
        const year = attendanceMonth.getFullYear();
        const month = attendanceMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push({ isEmpty: true });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const attendance = attendanceData.find(a => a.date?.split('T')[0] === dateStr);

            days.push({
                isEmpty: false,
                date: i,
                status: attendance?.status || null
            });
        }
        return days;
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const styles = useMemo(() => StyleSheet.create({
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
        modalContent: {
            backgroundColor: theme.card,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            height: '90%',
            padding: 24,
        },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text },
        
        studentHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
            backgroundColor: theme.background,
            padding: 15,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
        },
        avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 15, borderWidth: 2, borderColor: theme.primary },
        studentName: { fontSize: 18, fontWeight: '900', color: theme.text },
        studentSub: { fontSize: 13, color: theme.textLight, fontWeight: '600' },

        monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        monthText: { fontSize: 16, fontWeight: '800', color: theme.text },
        monthBtn: { padding: 8, borderRadius: 10, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },

        calendarGrid: { marginBottom: 25 },
        weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
        weekdayText: { width: (SCREEN_WIDTH - 80) / 7, textAlign: 'center', fontWeight: '700', fontSize: 12, color: theme.textLight },
        dateGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
        dateCell: {
            width: (SCREEN_WIDTH - 80) / 7,
            aspectRatio: 1,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 8,
            borderWidth: 1,
            borderColor: theme.border,
        },
        presentCell: { backgroundColor: theme.success, borderColor: theme.success },
        absentCell: { backgroundColor: theme.danger, borderColor: theme.danger },
        unmarkedCell: { backgroundColor: theme.card },
        dateText: { fontSize: 14, fontWeight: '800' },

        statsRow: { flexDirection: 'row', gap: 12, marginBottom: 25 },
        statCard: { flex: 1, backgroundColor: theme.background, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
        statLabel: { fontSize: 10, fontWeight: '800', color: theme.textLight, textTransform: 'uppercase', marginBottom: 4 },
        statValue: { fontSize: 18, fontWeight: '900' },

        sectionTitle: { fontSize: 16, fontWeight: '900', color: theme.text, marginBottom: 15 },
        noteCard: { backgroundColor: theme.background, padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
        noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
        noteDate: { fontSize: 14, fontWeight: '800', color: theme.text },
        statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
        statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
        noteReason: { fontSize: 13, color: theme.text, lineHeight: 18 },
    }), [theme, isDark]);

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Attendance History</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={32} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchAllData} />}>
                        {student && (
                            <View style={styles.studentHeader}>
                                <Image source={student.photo_url ? { uri: student.photo_url } : require('../assets/images/favicon.png')} style={styles.avatar} />
                                <View>
                                    <Text style={styles.studentName}>{student.name}</Text>
                                    <Text style={styles.studentSub}>Class {student.class}-{student.section} • Roll: {student.roll_no}</Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.monthSelector}>
                            <TouchableOpacity style={styles.monthBtn} onPress={() => {
                                const d = new Date(attendanceMonth); d.setMonth(d.getMonth() - 1); setAttendanceMonth(d);
                            }}>
                                <Ionicons name="chevron-back" size={20} color={theme.text} />
                            </TouchableOpacity>
                            <Text style={styles.monthText}>{attendanceMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
                            <TouchableOpacity style={styles.monthBtn} onPress={() => {
                                const d = new Date(attendanceMonth); d.setMonth(d.getMonth() + 1); setAttendanceMonth(d);
                            }}>
                                <Ionicons name="chevron-forward" size={20} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>Present</Text>
                                <Text style={[styles.statValue, { color: theme.success }]}>{attendanceData.filter(a => a.status === 'present').length}</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>Absent</Text>
                                <Text style={[styles.statValue, { color: theme.danger }]}>{attendanceData.filter(a => a.status === 'absent').length}</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statLabel}>Total Days</Text>
                                <Text style={[styles.statValue, { color: theme.text }]}>{attendanceData.length}</Text>
                            </View>
                        </View>

                        {loading ? <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 20 }} /> : (
                            <View style={styles.calendarGrid}>
                                <View style={styles.weekdayRow}>
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <Text key={d} style={styles.weekdayText}>{d}</Text>)}
                                </View>
                                <View style={styles.dateGrid}>
                                    {getAttendanceDays().map((day, i) => (
                                        <View key={i} style={[
                                            styles.dateCell,
                                            day.isEmpty ? { opacity: 0, borderWidth: 0 } : (
                                                day.status === 'present' ? styles.presentCell : (day.status === 'absent' ? styles.absentCell : styles.unmarkedCell)
                                            )
                                        ]}>
                                            {!day.isEmpty && <Text style={[styles.dateText, { color: (day.status ? '#fff' : theme.text) }]}>{day.date}</Text>}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        <Text style={styles.sectionTitle}>Absent Notes & Letters</Text>
                        {absentRequests.length === 0 ? (
                            <Text style={{ color: theme.textLight, textAlign: 'center', marginTop: 10, fontStyle: 'italic' }}>No absent notes submitted by this student.</Text>
                        ) : (
                            absentRequests.map((req) => (
                                <View key={req.id} style={styles.noteCard}>
                                    <View style={styles.noteHeader}>
                                        <Text style={styles.noteDate}>{formatDate(req.date)}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: req.status === 'approved' ? theme.success + '20' : (req.status === 'rejected' ? theme.danger + '20' : theme.warning + '20') }]}>
                                            <Text style={[styles.statusText, { color: req.status === 'approved' ? theme.success : (req.status === 'rejected' ? theme.danger : theme.warning) }]}>{req.status}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.noteReason}>{req.reason}</Text>
                                </View>
                            ))
                        )}
                        <View style={{ height: 50 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

export default AttendanceHistoryBottomSheet;
