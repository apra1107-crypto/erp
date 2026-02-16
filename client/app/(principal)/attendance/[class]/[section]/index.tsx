import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Platform, Image, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../../../constants/Config';

export default function TakeAttendance() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    const { class: className, section } = useLocalSearchParams();

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [students, setStudents] = useState<any[]>([]);
    const [attendance, setAttendance] = useState<{ [key: number]: 'present' | 'absent' }>({});
    const [absentRequests, setAbsentRequests] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [approving, setApproving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

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

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const userData = await AsyncStorage.getItem('userData');
            const sessionId = userData ? JSON.parse(userData).current_session_id : null;
            const dateStr = formatDateForAPI(selectedDate);
            
            const headers = { 
                Authorization: `Bearer ${token}`,
                'x-academic-session-id': sessionId?.toString()
            };

            // Fetch students
            const studentsRes = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/student/list?class=${className}&section=${section}`,
                { headers }
            );

            const allStudents = studentsRes.data.students || [];
            // Strictly filter by class and section again to be safe
            const filtered = allStudents.filter((s: any) => String(s.class).trim() === String(className).trim() && String(s.section).trim() === String(section).trim());
            setStudents(filtered);

            // Fetch existing attendance - handle empty case
            const attendanceRes = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/attendance/view?class=${className}&section=${section}&date=${dateStr}`,
                { headers }
            );

            const existingAttendance = attendanceRes.data.attendance || [];
            const attendanceMap: { [key: number]: 'present' | 'absent' } = {};
            existingAttendance.forEach((a: any) => {
                attendanceMap[a.student_id] = a.status;
            });
            setAttendance(attendanceMap);

            // Fetch logs - handle empty case
            const logsRes = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/attendance/logs?class=${className}&section=${section}&date=${dateStr}`,
                { headers }
            );

            setLogs(logsRes.data.logs || []);

            // Fetch absent requests - handle empty case
            const requestsRes = await axios.get(
                `${API_ENDPOINTS.ABSENT_REQUEST}/view?class=${className}&section=${section}&date=${dateStr}`,
                { headers }
            );
            setAbsentRequests(requestsRes.data.requests || []);
        } catch (error) {
            console.error('Error fetching attendance data:', error);
            // Don't toast here if it's just empty data, only if real failure
        } finally {
            setLoading(false);
        }
    };

    const handleApproveRequest = async (requestId: number) => {
        setApproving(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const userData = await AsyncStorage.getItem('userData');
            const sessionId = userData ? JSON.parse(userData).current_session_id : null;

            await axios.post(
                `${API_ENDPOINTS.ABSENT_REQUEST}/approve/${requestId}`,
                {},
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    } 
                }
            );

            Toast.show({
                type: 'success',
                text1: 'Approved',
                text2: 'Request approved and student marked absent'
            });

            setShowRequestModal(false);
            fetchData(); // Refresh all data
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.message || 'Failed to approve request'
            });
        } finally {
            setApproving(false);
        }
    };

    const toggleAttendance = (studentId: number, status: 'present' | 'absent') => {
        setAttendance(prev => ({ ...prev, [studentId]: status }));
    };

    const handleSave = async () => {
        // Check if all students are marked
        const unmarked = students.filter(s => !attendance[s.id]);
        if (unmarked.length > 0) {
            Toast.show({
                type: 'error',
                text1: 'Incomplete',
                text2: `Please mark attendance for all ${students.length} students`
            });
            return;
        }

        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('token');
            const userData = await AsyncStorage.getItem('userData');
            const sessionId = userData ? JSON.parse(userData).current_session_id : null;
            const dateStr = formatDateForAPI(selectedDate);

            const attendanceArray = students.map(s => ({
                student_id: s.id,
                status: attendance[s.id]
            }));

            await axios.post(
                `${API_ENDPOINTS.PRINCIPAL}/attendance/take`,
                {
                    class: className,
                    section: section,
                    date: dateStr,
                    attendance: attendanceArray
                },
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    } 
                }
            );

            Toast.show({
                type: 'success',
                text1: 'Success',
                text2: 'Attendance saved successfully'
            });

            // Refresh data
            fetchData();
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.message || 'Failed to save attendance'
            });
        } finally {
            setSaving(false);
        }
    };

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
            zIndex: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 10,
            elevation: 5,
        },
        backBtn: { padding: 8, borderRadius: 12, backgroundColor: theme.background, marginRight: 15 },
        headerTitle: { fontSize: 18, fontWeight: '900', color: theme.text },
        content: { flex: 1 },
        dateSection: {
            backgroundColor: theme.card,
            padding: 20,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        dateLabel: { fontSize: 13, fontWeight: '700', color: theme.textLight, marginBottom: 10 },
        dateButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.background,
            padding: 15,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: theme.border,
        },
        dateText: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.text, marginLeft: 10 },
        logsSection: {
            backgroundColor: theme.card,
            padding: 20,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        logsTitle: { fontSize: 14, fontWeight: '800', color: theme.primary, marginBottom: 15, textTransform: 'uppercase' },
        logItem: {
            backgroundColor: theme.background,
            padding: 15,
            borderRadius: 15,
            marginBottom: 10,
            borderLeftWidth: 4,
        },
        logInitial: { borderLeftColor: theme.success },
        logModified: { borderLeftColor: theme.warning },
        logHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
        logTeacher: { fontSize: 15, fontWeight: '800', color: theme.text, flex: 1 },
        logTime: { fontSize: 12, color: theme.textLight },
        logAction: { fontSize: 13, color: theme.textLight, marginBottom: 5 },
        logStats: { fontSize: 13, fontWeight: '700', color: theme.primary },
        logChanges: { fontSize: 12, color: theme.textLight, marginTop: 5, fontStyle: 'italic' },
        studentList: { padding: 20, paddingBottom: 100 },
        studentCard: {
            backgroundColor: theme.card,
            borderRadius: 20,
            padding: 15,
            marginBottom: 15,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 2,
        },
        studentCardWithRequest: {
            borderColor: theme.warning,
            backgroundColor: isDark ? theme.warning + '10' : theme.warning + '05',
            borderWidth: 1.5,
        },
        requestBadge: {
            backgroundColor: theme.warning,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
        },
        requestBadgeText: {
            color: '#fff',
            fontSize: 10,
            fontWeight: '900',
        },
        studentInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
        studentPhotoWrapper: { marginRight: 12 },
        studentPhoto: { width: 50, height: 50, borderRadius: 25 },
        photoPlaceholder: {
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: theme.background,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
        },
        studentDetails: { flex: 1 },
        studentName: { fontSize: 16, fontWeight: '800', color: theme.text },
        studentRoll: { fontSize: 13, color: theme.textLight, fontWeight: '600', marginTop: 2 },
        attendanceButtons: { flexDirection: 'row', gap: 10 },
        attendanceBtn: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
            borderWidth: 2,
        },
        presentBtn: { borderColor: theme.success + '40', backgroundColor: theme.background },
        presentBtnActive: { borderColor: theme.success, backgroundColor: theme.success + '15' },
        absentBtn: { borderColor: theme.danger + '40', backgroundColor: theme.background },
        absentBtnActive: { borderColor: theme.danger, backgroundColor: theme.danger + '15' },
        requestBtn: { borderColor: theme.warning + '40', backgroundColor: theme.background, flex: 0.8 },
        requestBtnApproved: { borderColor: theme.primary + '40' },
        btnText: { fontSize: 14, fontWeight: '800' },
        presentText: { color: theme.success },
        absentText: { color: theme.danger },
        saveButton: {
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
            backgroundColor: theme.primary,
            padding: 18,
            borderRadius: 20,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 5,
        },
        saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '900' },
        emptyText: { textAlign: 'center', color: theme.textLight, marginTop: 20, fontSize: 14 },
        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },

        // Modal Styles
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
        },
        modalContent: {
            backgroundColor: theme.card,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            paddingHorizontal: 20,
            paddingBottom: Platform.OS === 'ios' ? 40 : 30,
            maxHeight: '85%',
            borderWidth: 1,
            borderColor: theme.border,
        },
        modalHandle: {
            width: 40,
            height: 5,
            backgroundColor: theme.border,
            borderRadius: 3,
            alignSelf: 'center',
            marginTop: 12,
            marginBottom: 20,
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
        },
        modalStudentInfo: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },
        modalStudentPhoto: {
            width: 50,
            height: 50,
            borderRadius: 25,
            marginRight: 12,
            borderWidth: 2,
            borderColor: theme.primary + '30',
        },
        modalStudentDetails: {
            flex: 1,
        },
        modalStudentName: {
            fontSize: 18,
            fontWeight: '900',
            color: theme.text,
        },
        modalStudentRoll: {
            fontSize: 13,
            color: theme.textLight,
            fontWeight: '700',
        },
        statusBadge: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
        },
        statusBadgeText: {
            fontSize: 11,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        modalBody: {
            marginBottom: 20,
        },
        reasonSection: {
            backgroundColor: isDark ? theme.background + '80' : '#f8f9fa',
            padding: 20,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: theme.border,
        },
        reasonLabel: {
            fontSize: 12,
            fontWeight: '800',
            color: theme.primary,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 10,
        },
        modalReasonText: {
            fontSize: 16,
            color: theme.text,
            lineHeight: 24,
            fontWeight: '500',
        },
        approvalInfo: {
            marginTop: 15,
            padding: 15,
            backgroundColor: theme.success + '08',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.success + '20',
            flexDirection: 'row',
            alignItems: 'center',
        },
        approvalTextContainer: {
            marginLeft: 12,
            flex: 1,
        },
        approvalDetailText: {
            fontSize: 13,
            color: theme.success,
            fontWeight: '700',
        },
        approvalSubText: {
            fontSize: 11,
            color: theme.success,
            opacity: 0.8,
            marginTop: 2,
        },
        modalFooter: {
            flexDirection: 'row',
            gap: 12,
        },
        modalBtn: {
            flex: 1,
            height: 56,
            borderRadius: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },
        closeBtn: {
            backgroundColor: theme.background,
            borderWidth: 1,
            borderColor: theme.border,
        },
        closeBtnText: {
            fontSize: 15,
            fontWeight: '800',
            color: theme.text,
        },
        approveBtn: {
            backgroundColor: theme.primary,
        },
        approveBtnText: {
            fontSize: 15,
            fontWeight: '800',
            color: '#fff',
            marginLeft: 8,
        },
    }), [theme, isDark]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Attendance - Class {className} {section}</Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Date Picker */}
                <View style={styles.dateSection}>
                    <Text style={styles.dateLabel}>Select Date</Text>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                        <Ionicons name="calendar" size={22} color={theme.primary} />
                        <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
                        <Ionicons name="chevron-down" size={20} color={theme.textLight} />
                    </TouchableOpacity>
                </View>

                {/* Update History */}
                {logs.length > 0 && (
                    <View style={styles.logsSection}>
                        <Text style={styles.logsTitle}>Update History</Text>
                        {logs.map((log, index) => (
                            <View key={index} style={[styles.logItem, log.action_type === 'initial' ? styles.logInitial : styles.logModified]}>
                                <View style={styles.logHeader}>
                                    <Text style={styles.logTeacher}>{log.teacher_name}</Text>
                                    <Text style={styles.logTime}>{formatTime(log.created_at)}</Text>
                                </View>
                                <Text style={styles.logAction}>
                                    {log.action_type === 'initial' ? '📝 Took attendance' : '✏️ Modified attendance'}
                                </Text>
                                <Text style={styles.logStats}>
                                    Total: {log.total_students} | Present: {log.present_count} | Absent: {log.absent_count}
                                </Text>
                                {log.changes_made && (
                                    <Text style={styles.logChanges}>{log.changes_made}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Student List */}
                <View style={styles.studentList}>
                    {students.length === 0 ? (
                        <Text style={styles.emptyText}>No students found in this section</Text>
                    ) : (
                        students.map((student) => (
                            <View key={student.id} style={[
                                styles.studentCard,
                                absentRequests.some(r => r.student_id === student.id && r.status === 'pending') && styles.studentCardWithRequest
                            ]}>
                                <View style={styles.studentInfo}>
                                    <View style={styles.studentPhotoWrapper}>
                                        {student.photo_url ? (
                                            <Image source={{ uri: student.photo_url }} style={styles.studentPhoto} />
                                        ) : (
                                            <View style={styles.photoPlaceholder}>
                                                <Ionicons name="person" size={24} color={theme.textLight} />
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.studentDetails}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Text style={styles.studentName}>{student.name}</Text>
                                            {absentRequests.find(r => r.student_id === student.id && r.status === 'pending') && (
                                                <View style={styles.requestBadge}>
                                                    <Text style={styles.requestBadgeText}>PENDING NOTE</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.studentRoll}>Roll: {student.roll_no}</Text>
                                    </View>
                                </View>
                                <View style={styles.attendanceButtons}>
                                    <TouchableOpacity
                                        style={[
                                            styles.attendanceBtn,
                                            styles.presentBtn,
                                            attendance[student.id] === 'present' && styles.presentBtnActive
                                        ]}
                                        onPress={() => toggleAttendance(student.id, 'present')}
                                    >
                                        <Ionicons
                                            name={attendance[student.id] === 'present' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                                            size={20}
                                            color={theme.success}
                                        />
                                        <Text style={[styles.btnText, styles.presentText]}>Present</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.attendanceBtn,
                                            styles.absentBtn,
                                            attendance[student.id] === 'absent' && styles.absentBtnActive
                                        ]}
                                        onPress={() => toggleAttendance(student.id, 'absent')}
                                    >
                                        <Ionicons
                                            name={attendance[student.id] === 'absent' ? 'close-circle' : 'close-circle-outline'}
                                            size={20}
                                            color={theme.danger}
                                        />
                                        <Text style={[styles.btnText, styles.absentText]}>Absent</Text>
                                    </TouchableOpacity>

                                    {(() => {
                                        const request = absentRequests.find(r => r.student_id === student.id);
                                        if (!request) return null;

                                        const isPending = request.status === 'pending';
                                        return (
                                            <TouchableOpacity
                                                style={[
                                                    styles.attendanceBtn,
                                                    styles.requestBtn,
                                                    !isPending && styles.requestBtnApproved
                                                ]}
                                                onPress={() => {
                                                    setSelectedRequest(request);
                                                    setShowRequestModal(true);
                                                }}
                                            >
                                                <Ionicons
                                                    name={isPending ? "document-text" : "eye"}
                                                    size={20}
                                                    color={isPending ? theme.warning : theme.primary}
                                                />
                                                <Text style={[
                                                    styles.btnText,
                                                    { color: isPending ? theme.warning : theme.primary }
                                                ]}>
                                                    {isPending ? 'Request' : 'View'}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })()}
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Save Button */}
            {students.length > 0 && (
                <TouchableOpacity
                    style={[styles.saveButton, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Attendance</Text>
                    )}
                </TouchableOpacity>
            )}

            {/* Date Picker Modal */}
            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                        setShowDatePicker(false);
                        if (date) setSelectedDate(date);
                    }}
                />
            )}

            {/* Absent Request Modal */}
            <Modal
                visible={showRequestModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowRequestModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} />
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={() => setShowRequestModal(false)}
                    />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />

                        <View style={styles.modalHeader}>
                            <View style={styles.modalStudentInfo}>
                                {selectedRequest?.photo_url ? (
                                    <Image source={{ uri: selectedRequest.photo_url }} style={styles.modalStudentPhoto} />
                                ) : (
                                    <View style={[styles.modalStudentPhoto, { backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center' }]}>
                                        <Ionicons name="person" size={24} color={theme.primary} />
                                    </View>
                                )}
                                <View style={styles.modalStudentDetails}>
                                    <Text style={styles.modalStudentName}>{selectedRequest?.student_name}</Text>
                                    <Text style={styles.modalStudentRoll}>Roll No: {selectedRequest?.roll_no} • Class {className}-{section}</Text>
                                </View>
                            </View>
                            <View style={[
                                styles.statusBadge,
                                { backgroundColor: selectedRequest?.status === 'pending' ? theme.warning + '15' : theme.success + '15' }
                            ]}>
                                <Text style={[
                                    styles.statusBadgeText,
                                    { color: selectedRequest?.status === 'pending' ? theme.warning : theme.success }
                                ]}>
                                    {selectedRequest?.status}
                                </Text>
                            </View>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <View style={styles.reasonSection}>
                                <Text style={styles.reasonLabel}>Reason for Absence</Text>
                                <Text style={styles.modalReasonText}>{selectedRequest?.reason}</Text>
                            </View>

                            {selectedRequest?.status === 'approved' && (
                                <View style={styles.approvalInfo}>
                                    <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                                    <View style={styles.approvalTextContainer}>
                                        <Text style={styles.approvalDetailText}>
                                            Approved by {selectedRequest.approved_by_teacher_name || selectedRequest.approved_by_principal_name}
                                        </Text>
                                        <Text style={styles.approvalSubText}>
                                            {new Date(selectedRequest.approved_at).toLocaleString('en-IN', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short'
                                            })}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.closeBtn]}
                                onPress={() => setShowRequestModal(false)}
                            >
                                <Text style={styles.closeBtnText}>Close</Text>
                            </TouchableOpacity>

                            {selectedRequest?.status === 'pending' && (
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.approveBtn, approving && { opacity: 0.7 }]}
                                    onPress={() => handleApproveRequest(selectedRequest.id)}
                                    disabled={approving}
                                >
                                    {approving ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                            <Text style={styles.approveBtnText}>Approve Request</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
