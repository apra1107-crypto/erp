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

    // Tab states
    const [activeTab, setActiveTab] = useState<'attendance' | 'submit' | 'history'>('attendance');

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
            const response = await axios.get(
                `${API_ENDPOINTS.ABSENT_REQUEST}/my-requests`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setRequests(response.data.requests || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load your absent notes'
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const fetchAttendanceData = useCallback(async () => {
        try {
            setAttendanceLoading(true);
            const token = await AsyncStorage.getItem('studentToken');
            const year = attendanceMonth.getFullYear();
            const month = String(attendanceMonth.getMonth() + 1).padStart(2, '0');
            const monthStart = `${year}-${month}-01`;
            const daysInMonth = new Date(year, attendanceMonth.getMonth() + 1, 0).getDate();
            const monthEnd = String(daysInMonth).padStart(2, '0');
            const monthEndStr = `${year}-${month}-${monthEnd}`;

            const url = `${API_ENDPOINTS.ATTENDANCE}/my-attendance?startDate=${monthStart}&endDate=${monthEndStr}`;
            console.log('Fetching attendance from URL:', url);

            const response = await axios.get(url, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            console.log('Attendance response:', response.data);
            const data = Array.isArray(response.data) ? response.data : response.data.attendance || [];
            setAttendanceData(data);
        } catch (error: any) {
            console.error('Full error object:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Error response:', error.response);
            
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.message || error.message || 'Failed to load attendance data'
            });
        } finally {
            setAttendanceLoading(false);
            setAttendanceRefreshing(false);
        }
    }, [attendanceMonth]);

    useFocusEffect(
        useCallback(() => {
            if (activeTab === 'history') {
                fetchRequests();
            } else if (activeTab === 'attendance') {
                fetchAttendanceData();
            }
        }, [activeTab, fetchRequests, fetchAttendanceData])
    );

    useEffect(() => {
        if (activeTab === 'attendance') {
            fetchAttendanceData();
        }
    }, [activeTab, fetchAttendanceData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRequests();
    };



    const onAttendanceRefresh = () => {
        setAttendanceRefreshing(true);
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
            Toast.show({
                type: 'error',
                text1: 'Required',
                text2: 'Please provide a reason for absence'
            });
            return;
        }

        setSubmitting(true);
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const dateStr = formatDateForAPI(date);

            const response = await axios.post(
                `${API_ENDPOINTS.ABSENT_REQUEST}/submit`,
                { date: dateStr, reason },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Absent note submitted successfully'
            });

            setReason('');
            setDate(new Date());
            setActiveTab('history');
            fetchRequests();
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.message || 'Failed to submit absent note'
            });
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
                            Toast.show({
                                type: 'error',
                                text1: 'Error',
                                text2: error.response?.data?.message || 'Failed to delete'
                            });
                        }
                    }
                }
            ]
        );
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'approved': return { bg: theme.success + '20', text: theme.success, icon: 'checkmark-circle' };
            case 'rejected': return { bg: theme.danger + '20', text: theme.danger, icon: 'close-circle' };
            default: return { bg: theme.warning + '20', text: theme.warning, icon: 'time' };
        }
    };

    // Get calendar days for attendance
    const getAttendanceDays = () => {
        const year = attendanceMonth.getFullYear();
        const month = attendanceMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];

        // Add empty cells for days before month starts
        for (let i = 0; i < firstDay; i++) {
            days.push({ isEmpty: true, date: null, day: null, status: null });
        }

        // Add days of month
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const attendance = attendanceData.find(a => {
                // Handle both string and date formats
                const aDate = typeof a.date === 'string' ? a.date : a.date?.split('T')[0];
                return aDate === dateStr;
            });

            days.push({
                isEmpty: false,
                date: i,
                day: new Date(year, month, i).toLocaleDateString('en-US', { weekday: 'short' }),
                status: attendance?.status || null,
                marked_by: attendance?.marked_by || null
            });
        }

        return days;
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
            header: {
                backgroundColor: 'transparent',
                paddingTop: insets.top + 10,
                paddingBottom: 10,
                paddingHorizontal: 10,
                flexDirection: 'row',
                alignItems: 'center',
                zIndex: 10,
            },
            backBtn: { padding: 8, borderRadius: 12, marginRight: 5 },
            title: { fontSize: 20, fontWeight: '900', color: theme.text },
            tabContainer: {
                flexDirection: 'row',
                backgroundColor: 'transparent',
                paddingHorizontal: 10,
            },
            tab: {
                flex: 1,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottomWidth: 3,
                borderBottomColor: 'transparent',
            },
        
        tabActive: {
            borderBottomColor: theme.primary,
        },
        tabLabel: {
            fontSize: 14,
            fontWeight: '800',
            marginLeft: 8,
            color: theme.textLight,
        },
        tabLabelActive: {
            color: theme.primary,
        },
        content: { flex: 1 },

        // Submit Tab Styles
        submitContainer: { padding: 20 },
        formGroup: { marginBottom: 20 },
        label: { fontSize: 14, fontWeight: '800', color: theme.text, marginBottom: 8 },
        datePickerBtn: {
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 15,
            padding: 15,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        datePickerText: { fontSize: 16, color: theme.text, fontWeight: '600' },
        reasonInput: {
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 15,
            padding: 15,
            color: theme.text,
            minHeight: 120,
            textAlignVertical: 'top',
            fontSize: 16,
        },
        submitBtn: {
            backgroundColor: theme.primary,
            paddingVertical: 15,
            borderRadius: 15,
            alignItems: 'center',
            marginTop: 10,
            marginBottom: 30,
            opacity: submitting ? 0.6 : 1,
        },
        submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

        // History Tab Styles
        historyContainer: { padding: 20, paddingBottom: 40 },
        card: {
            backgroundColor: theme.card,
            borderRadius: 20,
            padding: 18,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 2,
        },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
        dateText: { fontSize: 18, fontWeight: '900', color: theme.text },
        statusBadge: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
        },
        statusText: { fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
        reasonLabel: { fontSize: 13, fontWeight: '700', color: theme.textLight, marginBottom: 5 },
        reasonText: { fontSize: 15, color: theme.text, lineHeight: 22, marginBottom: 12 },
        divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
        approvalSection: { backgroundColor: theme.success + '15', padding: 12, borderRadius: 12 },
        approvalText: { fontSize: 13, color: theme.success, fontWeight: '600' },
        rejectionSection: { backgroundColor: theme.danger + '15', padding: 12, borderRadius: 12 },
        rejectionText: { fontSize: 13, color: theme.danger, fontWeight: '600' },
        actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 12 },
        actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 10 },
        actionBtnText: { marginLeft: 5, fontWeight: '700', fontSize: 13 },
        emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 },
        emptyIcon: { marginBottom: 15 },
        emptyText: { fontSize: 16, fontWeight: '700', color: theme.textLight, marginBottom: 20 },

        // Attendance Tab Styles
        attendanceContainer: { padding: 20, paddingBottom: 40 },
        monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        monthText: { fontSize: 16, fontWeight: '800', color: theme.text },
        monthNavBtn: { padding: 8, borderRadius: 10, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
        calendarGrid: { marginBottom: 20 },
        weekdayRow: { flexDirection: 'row', marginBottom: 10, justifyContent: 'space-between' },
        weekdayHeader: { width: (SCREEN_WIDTH - 50) / 7, textAlign: 'center', fontWeight: '700', fontSize: 12, color: theme.textLight },
        dateGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
        dateCell: {
            width: (SCREEN_WIDTH - 50) / 7,
            aspectRatio: 1,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 8,
            borderWidth: 1,
            borderColor: theme.border,
        },
        dateCellEmpty: { backgroundColor: 'transparent', borderWidth: 0 },
        dateCellPresent: { backgroundColor: theme.success, borderColor: theme.success },
        dateCellAbsent: { backgroundColor: theme.danger, borderColor: theme.danger },
        dateCellUnmarked: { backgroundColor: theme.card },
        dateNumber: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
        dateStatus: { fontSize: 10, fontWeight: '600' },
        attendanceStats: { flexDirection: 'row', gap: 15, marginBottom: 20 },
        statBox: { flex: 1, backgroundColor: theme.card, borderRadius: 15, padding: 15, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
        statNumber: { fontSize: 24, fontWeight: '900', marginBottom: 5 },
        statLabel: { fontSize: 12, fontWeight: '700', color: theme.textLight, textAlign: 'center' },
    }), [theme, isDark, attendanceData]);



    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} translucent={true} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Attendance</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'attendance' && styles.tabActive]}
                    onPress={() => {
                        setActiveTab('attendance');
                        if (attendanceData.length === 0) {
                            fetchAttendanceData();
                        }
                    }}
                >
                    <Ionicons name="calendar-outline" size={20} color={activeTab === 'attendance' ? theme.primary : theme.textLight} />
                    <Text style={[styles.tabLabel, activeTab === 'attendance' && styles.tabLabelActive]}>Attendance</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'submit' && styles.tabActive]}
                    onPress={() => setActiveTab('submit')}
                >
                    <Ionicons name="document-outline" size={20} color={activeTab === 'submit' ? theme.primary : theme.textLight} />
                    <Text style={[styles.tabLabel, activeTab === 'submit' && styles.tabLabelActive]}>Submit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.tab, activeTab === 'history' && styles.tabActive]}
                    onPress={() => setActiveTab('history')}
                >
                    <Ionicons name="list-outline" size={20} color={activeTab === 'history' ? theme.primary : theme.textLight} />
                    <Text style={[styles.tabLabel, activeTab === 'history' && styles.tabLabelActive]}>
                        History ({requests.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {activeTab === 'attendance' ? (
                // ATTENDANCE TAB
                <ScrollView
                    style={styles.content}
                    refreshControl={<RefreshControl refreshing={attendanceRefreshing} onRefresh={onAttendanceRefresh} />}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.attendanceContainer}>
                        {/* Month Selector */}
                        <View style={styles.monthSelector}>
                            <TouchableOpacity
                                style={styles.monthNavBtn}
                                onPress={() => {
                                    const newMonth = new Date(attendanceMonth);
                                    newMonth.setMonth(newMonth.getMonth() - 1);
                                    setAttendanceMonth(newMonth);
                                }}
                            >
                                <Ionicons name="chevron-back" size={20} color={theme.text} />
                            </TouchableOpacity>

                            <Text style={styles.monthText}>
                                {attendanceMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </Text>



                            <TouchableOpacity
                                style={styles.monthNavBtn}
                                onPress={() => {
                                    const newMonth = new Date(attendanceMonth);
                                    newMonth.setMonth(newMonth.getMonth() + 1);
                                    setAttendanceMonth(newMonth);
                                }}
                            >
                                <Ionicons name="chevron-forward" size={20} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Stats */}
                        {attendanceData.length > 0 && (
                            <View style={styles.attendanceStats}>
                                <View style={styles.statBox}>
                                    <Text style={[styles.statNumber, { color: theme.success }]}>
                                        {attendanceData.filter(a => a.status === 'present').length}
                                    </Text>
                                    <Text style={styles.statLabel}>Present</Text>
                                </View>
                                <View style={styles.statBox}>
                                    <Text style={[styles.statNumber, { color: theme.danger }]}>
                                        {attendanceData.filter(a => a.status === 'absent').length}
                                    </Text>
                                    <Text style={styles.statLabel}>Absent</Text>
                                </View>
                                <View style={styles.statBox}>
                                    <Text style={[styles.statNumber, { color: theme.textLight }]}>
                                        {attendanceData.length}
                                    </Text>
                                    <Text style={styles.statLabel}>Total</Text>
                                </View>
                            </View>
                        )}

                        {/* Calendar */}
                        {attendanceLoading ? (
                            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
                        ) : (
                            <View style={styles.calendarGrid} key={`attendance-${attendanceData.length}-${attendanceMonth.getTime()}`}>
                                {/* Weekday Headers */}
                                <View style={styles.weekdayRow}>
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                        <Text key={day} style={[styles.weekdayHeader, { color: theme.textLight }]}>
                                            {day}
                                        </Text>
                                    ))}
                                </View>

                                {/* Date Grid */}
                                <View style={styles.dateGrid}>
                                    {getAttendanceDays().map((day, index) => (
                                        <View
                                            key={index}
                                            style={[
                                                styles.dateCell,
                                                day.isEmpty && styles.dateCellEmpty,
                                                !day.isEmpty && day.status === 'present' && styles.dateCellPresent,
                                                !day.isEmpty && day.status === 'absent' && styles.dateCellAbsent,
                                                !day.isEmpty && !day.status && styles.dateCellUnmarked,
                                            ]}
                                        >
                                            {!day.isEmpty && (
                                                <>
                                                    <Text
                                                        style={[
                                                            styles.dateNumber,
                                                            {
                                                                color:
                                                                    day.status === 'present'
                                                                        ? '#fff'
                                                                        : day.status === 'absent'
                                                            ? '#fff'
                                                            : theme.text,
                                                            }
                                                        ]}
                                                    >
                                                        {day.date}
                                                    </Text>
                                                    <Text
                                                        style={[
                                                            styles.dateStatus,
                                                            {
                                                                color:
                                                                    day.status === 'present'
                                                                        ? '#fff'
                                                                        : day.status === 'absent'
                                                            ? '#fff'
                                                            : theme.textLight,
                                                            }
                                                        ]}
                                                    >
                                                        {day.status === 'present' ? '✓' : day.status === 'absent' ? '✗' : '-'}
                                                    </Text>
                                                </>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>
                </ScrollView>
            ) : activeTab === 'submit' ? (
                // SUBMIT TAB
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.submitContainer}>
                        {/* Date Picker */}
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Date of Absence</Text>
                            <TouchableOpacity
                                style={styles.datePickerBtn}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Text style={styles.datePickerText}>{formatDate(date)}</Text>
                                <Ionicons name="calendar" size={20} color={theme.primary} />
                            </TouchableOpacity>
                        </View>

                        {/* Reason Input */}
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Reason for Absence</Text>
                            <TextInput
                                style={styles.reasonInput}
                                placeholder="Enter the reason for your absence..."
                                placeholderTextColor={theme.textLight}
                                value={reason}
                                onChangeText={setReason}
                                multiline
                                editable={!submitting}
                            />
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={styles.submitBtn}
                            onPress={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.submitBtnText}>Submit Absent Note</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            ) : (
                // HISTORY TAB
                loading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                ) : (
                <ScrollView
                    style={styles.content}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.historyContainer}>
                        {requests.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="document-text-outline" size={80} color={theme.border} style={styles.emptyIcon} />
                                <Text style={styles.emptyText}>No absent notes yet</Text>
                            </View>
                        ) : (
                            requests.map((item) => {
                                const statusStyle = getStatusStyles(item.status);
                                const isPending = item.status === 'pending';

                                return (
                                    <View key={item.id} style={styles.card}>
                                        {/* Card Header with Date and Status */}
                                        <View style={styles.cardHeader}>
                                            <Text style={styles.dateText}>{formatDate(new Date(item.date))}</Text>
                                            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                                <Ionicons name={statusStyle.icon as any} size={14} color={statusStyle.text} />
                                                <Text style={[styles.statusText, { color: statusStyle.text }]}>
                                                    {item.status}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Reason */}
                                        <Text style={styles.reasonLabel}>Reason</Text>
                                        <Text style={styles.reasonText}>{item.reason}</Text>

                                        {/* Approval/Rejection Info */}
                                        {item.status === 'approved' && (
                                            <View style={styles.approvalSection}>
                                                <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                                                <Text style={styles.approvalText}>
                                                    ✓ Approved by {item.approved_by_teacher_name}
                                                </Text>
                                            </View>
                                        )}

                                        {item.status === 'rejected' && (
                                            <View style={styles.rejectionSection}>
                                                <Text style={styles.rejectionText}>
                                                    ✗ Rejected
                                                </Text>
                                            </View>
                                        )}

                                        {/* Delete Button for Pending */}
                                        {isPending && (
                                            <View style={styles.actions}>
                                                <TouchableOpacity
                                                    style={[styles.actionBtn, { backgroundColor: theme.danger + '15' }]}
                                                    onPress={() => handleDelete(item.id)}
                                                >
                                                    <Ionicons name="trash-outline" size={18} color={theme.danger} />
                                                    <Text style={[styles.actionBtnText, { color: theme.danger }]}>Delete</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                );
                            })
                        )}
                    </View>
                </ScrollView>
                )
            )}

            {/* Date Picker Modal */}
            {showDatePicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                />
            )}

        </KeyboardAvoidingView>
    );
}
