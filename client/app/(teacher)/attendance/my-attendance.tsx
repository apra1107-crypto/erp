import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
    StatusBar, RefreshControl, Dimensions, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MyAttendance() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const fetchAttendanceHistory = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const month = currentMonth.getMonth() + 1;
            const year = currentMonth.getFullYear();

            const response = await axios.get(
                `${API_ENDPOINTS.TEACHER_ATTENDANCE}/history?month=${month}&year=${year}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setAttendanceData(response.data || []);
        } catch (error: any) {
            console.error('Error fetching teacher attendance history:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.message || 'Failed to load attendance history'
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentMonth]);

    useEffect(() => {
        fetchAttendanceHistory();
    }, [fetchAttendanceHistory]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchAttendanceHistory();
    };

    const getCalendarDays = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];

        // Add empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            days.push({ isEmpty: true, date: null, status: null });
        }

        // Add days of month
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const attendance = attendanceData.find(a => {
                const aDate = typeof a.date === 'string' ? a.date.split('T')[0] : '';
                return aDate === dateStr;
            });

            days.push({
                isEmpty: false,
                date: i,
                status: attendance?.status || null,
                reason: attendance?.reason || null
            });
        }

        return days;
    };

    const absentDays = useMemo(() => {
        return attendanceData.filter(a => a.status === 'absent' && a.reason);
    }, [attendanceData]);

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            backgroundColor: theme.card,
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        backBtn: { padding: 5, marginRight: 15 },
        headerTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        
        content: { flex: 1 },
        monthSelector: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 20,
            backgroundColor: theme.card,
            marginHorizontal: 20,
            marginTop: 20,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
        },
        monthText: { fontSize: 18, fontWeight: '800', color: theme.text },
        navBtn: { padding: 8, borderRadius: 10, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },

        calendarCard: {
            backgroundColor: theme.card,
            margin: 20,
            borderRadius: 25,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            elevation: 2,
        },
        weekdayRow: { flexDirection: 'row', marginBottom: 15, justifyContent: 'space-between' },
        weekdayHeader: { width: (SCREEN_WIDTH - 80) / 7, textAlign: 'center', fontWeight: '800', fontSize: 12, color: theme.textLight },
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
            backgroundColor: theme.background,
        },
        dateCellEmpty: { backgroundColor: 'transparent', borderWidth: 0 },
        dateCellPresent: { backgroundColor: theme.success + '20', borderColor: theme.success },
        dateCellAbsent: { backgroundColor: theme.danger + '20', borderColor: theme.danger },
        dateNumber: { fontSize: 14, fontWeight: '800', marginBottom: 2, color: theme.text },
        dateStatusPresent: { color: theme.success },
        dateStatusAbsent: { color: theme.danger },

        statsRow: {
            flexDirection: 'row',
            paddingHorizontal: 20,
            gap: 15,
            marginBottom: 20,
        },
        statBox: {
            flex: 1,
            backgroundColor: theme.card,
            padding: 15,
            borderRadius: 20,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
        },
        statValue: { fontSize: 22, fontWeight: '900' },
        statLabel: { fontSize: 11, fontWeight: '700', color: theme.textLight, marginTop: 4 },

        reasonSection: { padding: 20 },
        reasonTitle: { fontSize: 18, fontWeight: '900', color: theme.text, marginBottom: 15 },
        reasonCard: {
            backgroundColor: theme.card,
            padding: 15,
            borderRadius: 18,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        reasonDateBox: {
            backgroundColor: theme.danger + '10',
            padding: 10,
            borderRadius: 12,
            alignItems: 'center',
            minWidth: 50,
            marginRight: 15,
        },
        reasonDateText: { fontSize: 16, fontWeight: '900', color: theme.danger },
        reasonMonthText: { fontSize: 10, fontWeight: '700', color: theme.danger, textTransform: 'uppercase' },
        reasonContent: { flex: 1 },
        reasonText: { fontSize: 14, color: theme.text, lineHeight: 20, fontWeight: '600' },
        emptyReason: { alignItems: 'center', padding: 40 },
        emptyReasonText: { color: theme.textLight, fontSize: 14, fontWeight: '600' },
    }), [theme, insets]);

    const changeMonth = (delta: number) => {
        const newMonth = new Date(currentMonth);
        newMonth.setMonth(newMonth.getMonth() + delta);
        setCurrentMonth(newMonth);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} />

            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Attendance</Text>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
            >
                {/* Month Selector */}
                <View style={styles.monthSelector}>
                    <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(-1)}>
                        <Ionicons name="chevron-back" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>
                        {currentMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </Text>
                    <TouchableOpacity style={styles.navBtn} onPress={() => changeMonth(1)}>
                        <Ionicons name="chevron-forward" size={20} color={theme.text} />
                    </TouchableOpacity>
                </View>

                {/* Stats */}
                {!loading && (
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={[styles.statValue, { color: theme.success }]}>
                                {attendanceData.filter(a => a.status === 'present').length}
                            </Text>
                            <Text style={styles.statLabel}>Present</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={[styles.statValue, { color: theme.danger }]}>
                                {attendanceData.filter(a => a.status === 'absent').length}
                            </Text>
                            <Text style={styles.statLabel}>Absent</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={[styles.statValue, { color: theme.primary }]}>
                                {attendanceData.length}
                            </Text>
                            <Text style={styles.statLabel}>Total Days</Text>
                        </View>
                    </View>
                )}

                {/* Calendar */}
                <View style={styles.calendarCard}>
                    {loading ? (
                        <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 40 }} />
                    ) : (
                        <>
                            <View style={styles.weekdayRow}>
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                    <Text key={day} style={styles.weekdayHeader}>{day}</Text>
                                ))}
                            </View>

                            <View style={styles.dateGrid}>
                                {getCalendarDays().map((day, index) => (
                                    <View
                                        key={index}
                                        style={[
                                            styles.dateCell,
                                            day.isEmpty && styles.dateCellEmpty,
                                            day.status === 'present' && styles.dateCellPresent,
                                            day.status === 'absent' && styles.dateCellAbsent,
                                        ]}
                                    >
                                        {!day.isEmpty && (
                                            <>
                                                <Text style={styles.dateNumber}>{day.date}</Text>
                                                {day.status === 'present' && (
                                                    <Ionicons name="checkmark-circle" size={12} color={theme.success} />
                                                )}
                                                {day.status === 'absent' && (
                                                    <Ionicons name="close-circle" size={12} color={theme.danger} />
                                                )}
                                            </>
                                        )}
                                    </View>
                                ))}
                            </View>
                        </>
                    )}
                </View>

                {/* Reasons Section */}
                {!loading && (
                    <View style={styles.reasonSection}>
                        <Text style={styles.reasonTitle}>Absence Reasons</Text>
                        {absentDays.length > 0 ? (
                            absentDays.map((item, idx) => {
                                const d = new Date(item.date);
                                return (
                                    <View key={idx} style={styles.reasonCard}>
                                        <View style={styles.reasonDateBox}>
                                            <Text style={styles.reasonDateText}>{d.getDate()}</Text>
                                            <Text style={styles.reasonMonthText}>{d.toLocaleDateString('en-IN', { month: 'short' })}</Text>
                                        </View>
                                        <View style={styles.reasonContent}>
                                            <Text style={styles.reasonText}>{item.reason}</Text>
                                        </View>
                                    </View>
                                );
                            })
                        ) : (
                            <View style={styles.emptyReason}>
                                <Ionicons name="cafe-outline" size={40} color={theme.border} />
                                <Text style={styles.emptyReasonText}>No absence reasons this month</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
