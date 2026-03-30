import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator,
    StatusBar, RefreshControl, Alert, Platform, KeyboardAvoidingView, Modal, Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AbsentNote() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    // Form states
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Request history states
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Tab states - REMOVED for single view
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Attendance states
    const [attendanceData, setAttendanceData] = useState<any[]>([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [attendanceMonth, setAttendanceMonth] = useState(new Date());
    const [attendanceRefreshing, setAttendanceRefreshing] = useState(false);

    const formatDate = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatDateForAPI = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const fetchRequests = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('studentToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const studentDataStr = await AsyncStorage.getItem('studentData');
            const studentData = studentDataStr ? JSON.parse(studentDataStr) : null;
            const sessionId = storedSessionId || (studentData ? studentData.current_session_id : null);

            const response = await axios.get(
                `${API_ENDPOINTS.ABSENT_REQUEST}/my-requests`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    } 
                }
            );
            setRequests(response.data.requests || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const fetchAttendanceData = useCallback(async () => {
        try {
            setAttendanceLoading(true);
            const token = await AsyncStorage.getItem('studentToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const studentDataStr = await AsyncStorage.getItem('studentData');
            const studentData = studentDataStr ? JSON.parse(studentDataStr) : null;
            const sessionId = storedSessionId || (studentData ? studentData.current_session_id : null);

            const year = attendanceMonth.getFullYear();
            const month = String(attendanceMonth.getMonth() + 1).padStart(2, '0');
            const monthStart = `${year}-${month}-01`;
            const daysInMonth = new Date(year, attendanceMonth.getMonth() + 1, 0).getDate();
            const monthEnd = String(daysInMonth).padStart(2, '0');
            const monthEndStr = `${year}-${month}-${monthEnd}`;

            const url = `${API_ENDPOINTS.ATTENDANCE}/my-attendance?startDate=${monthStart}&endDate=${monthEndStr}`;
            const response = await axios.get(url, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'x-academic-session-id': sessionId?.toString()
                }
            });

            const data = Array.isArray(response.data) ? response.data : response.data.attendance || [];
            setAttendanceData(data);
        } catch (error: any) {
            console.error('Error loading attendance:', error);
        } finally {
            setAttendanceLoading(false);
            setAttendanceRefreshing(false);
        }
    }, [attendanceMonth]);

    useFocusEffect(
        useCallback(() => {
            fetchRequests();
            fetchAttendanceData();
        }, [fetchRequests, fetchAttendanceData])
    );

    useEffect(() => {
        fetchAttendanceData();
    }, [attendanceMonth, fetchAttendanceData]);

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const reqDate = new Date(req.date);
            return reqDate.getMonth() === attendanceMonth.getMonth() && 
                   reqDate.getFullYear() === attendanceMonth.getFullYear();
        });
    }, [requests, attendanceMonth]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRequests();
        fetchAttendanceData();
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (selectedDate) {
            setDate(selectedDate);
        }
    };

    const handleSubmit = async () => {
        if (!reason.trim()) {
            Toast.show({ type: 'error', text1: 'Required', text2: 'Please provide a reason' });
            return;
        }

        setSubmitting(true);
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const studentDataStr = await AsyncStorage.getItem('studentData');
            const studentData = studentDataStr ? JSON.parse(studentDataStr) : null;
            const sessionId = storedSessionId || (studentData ? studentData.current_session_id : null);
            const dateStr = formatDateForAPI(date);

            await axios.post(
                `${API_ENDPOINTS.ABSENT_REQUEST}/submit`,
                { date: dateStr, reason },
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    } 
                }
            );

            Toast.show({ type: 'success', text1: 'Submitted Successfully' });
            setReason('');
            setDate(new Date());
            setIsModalVisible(false);
            fetchRequests();
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to submit' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert(
            "Delete Request",
            "Are you sure you want to delete this absent note?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('studentToken');
                            await axios.delete(
                                `${API_ENDPOINTS.ABSENT_REQUEST}/delete/${id}`,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            Toast.show({ type: 'success', text1: 'Deleted' });
                            fetchRequests();
                        } catch (error: any) {
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete' });
                        }
                    }
                }
            ]
        );
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'approved': return { 
                bg: theme.success, 
                gradient: ['#10b981', '#059669'],
                lightBg: theme.success + '25', 
                text: '#fff', 
                darkText: theme.success, 
                icon: 'checkmark-circle' 
            };
            case 'rejected': return { 
                bg: theme.danger, 
                gradient: ['#ef4444', '#dc2626'],
                lightBg: theme.danger + '25', 
                text: '#fff', 
                darkText: theme.danger, 
                icon: 'close-circle' 
            };
            default: return { 
                bg: theme.warning, 
                gradient: ['#f59e0b', '#d97706'],
                lightBg: theme.warning + '25', 
                text: '#fff', 
                darkText: theme.warning, 
                icon: 'time' 
            };
        }
    };

    // Get calendar days for attendance
    const getAttendanceDays = () => {
        const year = attendanceMonth.getFullYear();
        const month = attendanceMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push({ isEmpty: true, date: null, status: null });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const attendance = attendanceData.find(a => (typeof a.date === 'string' ? a.date : a.date?.split('T')[0]) === dateStr);
            days.push({ isEmpty: false, date: i, status: attendance?.status || null });
        }
        return days;
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            backgroundColor: theme.background,
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
        title: { fontSize: 22, fontWeight: '900', color: theme.text },
        content: { flex: 1 },

        // Attendance Stats & Calendar
        attendanceContainer: { paddingHorizontal: 20, paddingBottom: insets.bottom + 100 },
        monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: theme.card, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: theme.border },
        monthText: { fontSize: 16, fontWeight: '800', color: theme.text },
        monthNavBtn: { padding: 8, borderRadius: 10 },
        calendarCard: { backgroundColor: theme.card, borderRadius: 24, padding: 15, paddingHorizontal: 10, borderWidth: 1, borderColor: theme.border, marginBottom: 20 },
        weekdayRow: { flexDirection: 'row', marginBottom: 15, justifyContent: 'flex-start' },
        weekdayHeader: { width: '14.285%', textAlign: 'center', fontWeight: '800', fontSize: 11, color: theme.textLight, textTransform: 'uppercase' },
        dateGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
        dateCell: { width: '14.285%', aspectRatio: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
        dateNumber: { fontSize: 15, fontWeight: '800' },
        
        attendanceStats: { flexDirection: 'row', gap: 12, marginBottom: 25 },
        statBox: { flex: 1, backgroundColor: theme.card, borderRadius: 20, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
        statNumber: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
        statLabel: { fontSize: 11, fontWeight: '700', color: theme.textLight },

        // History Flashcards
        historyTitle: { fontSize: 20, fontWeight: '900', color: theme.text, marginBottom: 20, marginTop: 15 },
        flashcard: { 
            borderRadius: 28, 
            padding: 22, 
            marginBottom: 18, 
            shadowColor: '#000', 
            shadowOffset: { width: 0, height: 10 }, 
            shadowOpacity: 0.15, 
            shadowRadius: 15, 
            elevation: 8 
        },
        flashHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
        flashDate: { fontSize: 18, fontWeight: '900' },
        flashBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4 },
        flashBadgeText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
        flashReason: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
        flashFooter: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        flashInfo: { fontSize: 12, fontWeight: '700' },

        // Floating Action Button
        fab: { 
            position: 'absolute', 
            right: 20, 
            bottom: Math.max(insets.bottom, 20) + 15, 
            width: 60, 
            height: 60, 
            borderRadius: 30, 
            backgroundColor: theme.primary, 
            justifyContent: 'center', 
            alignItems: 'center', 
            shadowColor: theme.primary, 
            shadowOffset: { width: 0, height: 8 }, 
            shadowOpacity: 0.4, 
            shadowRadius: 12, 
            elevation: 8, 
            zIndex: 100 
        },

        // Modal Styles
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        modalContent: { 
            backgroundColor: theme.card, 
            borderTopLeftRadius: 35, 
            borderTopRightRadius: 35, 
            padding: 30, 
            paddingBottom: Math.max(insets.bottom, 20) + 10, 
            shadowColor: '#000', 
            shadowOffset: { width: 0, height: -10 }, 
            shadowOpacity: 0.1, 
            shadowRadius: 20, 
            elevation: 20 
        },
        modalHandle: { width: 40, height: 5, backgroundColor: theme.border, borderRadius: 2.5, alignSelf: 'center', marginBottom: 20 },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
        modalTitle: { fontSize: 24, fontWeight: '900', color: theme.text },
        formGroup: { marginBottom: 20 },
        label: { fontSize: 14, fontWeight: '800', color: theme.text, marginBottom: 10 },
        inputBox: { backgroundColor: theme.background, borderRadius: 15, padding: 15, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        inputText: { fontSize: 16, color: theme.text, fontWeight: '700' },
        reasonInput: { backgroundColor: theme.background, borderRadius: 15, padding: 15, borderWidth: 1, borderColor: theme.border, color: theme.text, fontSize: 16, fontWeight: '600', minHeight: 120, textAlignVertical: 'top' },
        submitBtn: { backgroundColor: theme.primary, paddingVertical: 18, borderRadius: 18, alignItems: 'center', marginTop: 10 },
        submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 }
    }), [theme, isDark, insets]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} translucent={true} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Attendance</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.attendanceContainer}>
                    {/* Stats */}
                    <View style={styles.attendanceStats}>
                        <View style={styles.statBox}>
                            <Text style={[styles.statNumber, { color: theme.success }]}>{attendanceData.filter(a => a.status === 'present').length}</Text>
                            <Text style={styles.statLabel}>Present</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={[styles.statNumber, { color: theme.danger }]}>{attendanceData.filter(a => a.status === 'absent').length}</Text>
                            <Text style={styles.statLabel}>Absent</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={[styles.statNumber, { color: theme.primary }]}>{attendanceData.length}</Text>
                            <Text style={styles.statLabel}>Total Marked</Text>
                        </View>
                    </View>

                    {/* Month Selector */}
                    <View style={styles.monthSelector}>
                        <TouchableOpacity onPress={() => { const d = new Date(attendanceMonth); d.setMonth(d.getMonth() - 1); setAttendanceMonth(d); }}>
                            <Ionicons name="chevron-back" size={22} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={styles.monthText}>{attendanceMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
                        <TouchableOpacity onPress={() => { const d = new Date(attendanceMonth); d.setMonth(d.getMonth() + 1); setAttendanceMonth(d); }}>
                            <Ionicons name="chevron-forward" size={22} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Calendar Grid */}
                    <View style={styles.calendarCard}>
                        <View style={styles.weekdayRow}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <Text key={d} style={styles.weekdayHeader}>{d}</Text>)}
                        </View>
                        <View style={styles.dateGrid}>
                            {getAttendanceDays().map((day, idx) => (
                                <View key={idx} style={[styles.dateCell, !day.isEmpty && day.status === 'present' && { backgroundColor: theme.success + '25' }, !day.isEmpty && day.status === 'absent' && { backgroundColor: theme.danger + '25' }]}>
                                    {!day.isEmpty && (
                                        <>
                                            <Text style={[styles.dateNumber, { color: day.status === 'present' ? theme.success : day.status === 'absent' ? theme.danger : theme.text }]}>{day.date}</Text>
                                            {day.status === 'present' && <Ionicons name="checkmark-circle" size={12} color={theme.success} style={{ marginTop: -2 }} />}
                                            {day.status === 'absent' && <Ionicons name="close-circle" size={12} color={theme.danger} style={{ marginTop: -2 }} />}
                                        </>
                                    )}
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* History Section */}
                    <Text style={styles.historyTitle}>Leave Requests</Text>
                    {filteredRequests.length === 0 ? (
                        <View style={{ alignItems: 'center', padding: 40, backgroundColor: theme.card, borderRadius: 24, borderWidth: 1, borderColor: theme.border, borderStyle: 'dotted' }}>
                            <Ionicons name="document-text-outline" size={40} color={theme.textLight} />
                            <Text style={{ color: theme.textLight, marginTop: 10, fontWeight: '700' }}>No leave requests for this month</Text>
                        </View>
                    ) : (
                        filteredRequests.map((item) => {
                            const styles_status = getStatusStyles(item.status);
                            const isApproved = item.status === 'approved';
                            
                            return (
                                <TouchableOpacity 
                                    key={item.id} 
                                    activeOpacity={0.9}
                                    onLongPress={() => item.status === 'pending' && handleDelete(item.id)}
                                    style={{ marginBottom: 15 }}
                                >
                                    <LinearGradient
                                        colors={styles_status.gradient as any}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={[styles.flashcard, { borderWidth: 0, padding: 20, overflow: 'hidden' }]}
                                    >
                                        {/* Decorative Circles */}
                                        <View style={{ position: 'absolute', right: -30, top: -30, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.18)', zIndex: 0 }} />
                                        <View style={{ position: 'absolute', left: -35, bottom: -35, width: 95, height: 95, borderRadius: 47.5, backgroundColor: 'rgba(0,0,0,0.06)', zIndex: 0 }} />

                                        <View style={{ zIndex: 1 }}>
                                            <View style={styles.flashHeader}>
                                                <View>
                                                    <Text style={[styles.flashDate, { color: '#fff' }]}>{formatDate(new Date(item.date))}</Text>
                                                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '700' }}>
                                                        {new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                                    </Text>
                                                </View>
                                                <View style={[styles.flashBadge, { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }]}>
                                                    <Ionicons name={styles_status.icon as any} size={12} color="#fff" />
                                                    <Text style={[styles.flashBadgeText, { color: '#fff' }]}>{item.status}</Text>
                                                </View>
                                            </View>
                                            
                                            <View style={{ marginVertical: 12 }}>
                                                <Text style={[styles.flashReason, { color: '#fff', fontSize: 15, lineHeight: 22 }]} numberOfLines={3}>{item.reason}</Text>
                                            </View>
                                            
                                            <View style={[styles.flashFooter, { borderTopColor: 'rgba(255,255,255,0.2)', paddingTop: 15, marginTop: 5 }]}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                                        <Ionicons name={isApproved ? "checkmark-done" : item.status === 'rejected' ? "close" : "time"} size={14} color="#fff" />
                                                    </View>
                                                    <Text style={[styles.flashInfo, { color: 'rgba(255,255,255,0.95)', fontSize: 12, fontWeight: '700' }]} numberOfLines={1}>
                                                        {isApproved ? `Approved by ${item.approved_by_teacher_name || item.approved_by_principal_name || 'Principal'}` : 
                                                         item.status === 'rejected' ? `Rejected by ${item.approved_by_teacher_name || item.approved_by_principal_name || 'Principal'}` : 'Awaiting confirmation'}
                                                    </Text>
                                                </View>
                                                
                                                {item.status === 'pending' && (
                                                    <TouchableOpacity 
                                                        onPress={() => handleDelete(item.id)}
                                                        style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                                                    >
                                                        <Ionicons name="trash-outline" size={16} color="#fff" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    </LinearGradient>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* Floating Action Button */}
            <TouchableOpacity style={styles.fab} onPress={() => setIsModalVisible(true)}>
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>

            {/* Add Note Modal */}
            <Modal 
                visible={isModalVisible} 
                animationType="slide" 
                transparent={true}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Request Leave</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <Ionicons name="close-circle" size={32} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Date of Absence</Text>
                            <TouchableOpacity style={styles.inputBox} onPress={() => setShowDatePicker(true)}>
                                <Text style={styles.inputText}>{formatDate(date)}</Text>
                                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Reason for Absence</Text>
                            <TextInput
                                style={styles.reasonInput}
                                placeholder="E.g. Feeling unwell, Family event..."
                                placeholderTextColor={theme.textLight}
                                value={reason}
                                onChangeText={setReason}
                                multiline
                                numberOfLines={4}
                            />
                        </View>

                        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {showDatePicker && (
                <DateTimePicker value={date} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={handleDateChange} maximumDate={new Date()} />
            )}
        </View>
    );
}
