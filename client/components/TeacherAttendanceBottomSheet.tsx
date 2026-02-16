import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Dimensions, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { API_ENDPOINTS } from '../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TeacherAttendanceBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    teacher: any;
    role?: 'principal' | 'teacher';
}

const TeacherAttendanceBottomSheet = ({ visible, onClose, teacher, role = 'principal' }: TeacherAttendanceBottomSheetProps) => {
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [attendanceMonth, setAttendanceMonth] = useState(new Date());
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (visible && (teacher || role === 'teacher')) {
            fetchAttendance();
        }
    }, [visible, teacher, attendanceMonth, role]);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem(role === 'teacher' ? 'teacherToken' : 'token');
            const month = attendanceMonth.getMonth() + 1;
            const year = attendanceMonth.getFullYear();

            const url = role === 'teacher'
                ? `${API_ENDPOINTS.TEACHER_ATTENDANCE}/history?month=${month}&year=${year}`
                : `${API_ENDPOINTS.TEACHER_ATTENDANCE}/teacher/${teacher?.id}/history?month=${month}&year=${year}`;

            const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } }
            );
            setAttendanceData(res.data || []);
        } catch (error) {
            console.error('Error fetching teacher attendance history:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load attendance' });
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
    }), [theme, isDark]);

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Attendance</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={32} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAttendance(); }} />}>
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

                        {loading && !refreshing ? <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 20 }} /> : (
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
                        <View style={{ height: 50 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

export default TeacherAttendanceBottomSheet;
