import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform, StatusBar, ImageBackground } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../../constants/Config';
import FeeHistoryBottomSheet from '../../../../components/FeeHistoryBottomSheet';
import AttendanceHistoryBottomSheet from '../../../../components/AttendanceHistoryBottomSheet';

export default function StudentDetails() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<any>(null);

    // Bottom Sheet States
    const [isFeesVisible, setIsFeesVisible] = useState(false);
    const [isAttendanceVisible, setIsAttendanceVisible] = useState(false);
    const [instituteInfo, setInstituteInfo] = useState<any>(null);
    const [teacherData, setTeacherData] = useState<any>(null);

    useEffect(() => {
        fetchStudentDetails();
        loadInitialData();
    }, [id]);

    const loadInitialData = async () => {
        try {
            const uData = await AsyncStorage.getItem('userData');
            const tData = await AsyncStorage.getItem('teacherData');
            
            if (uData) setInstituteInfo(JSON.parse(uData));
            if (tData) {
                const parsedTData = JSON.parse(tData);
                setTeacherData(parsedTData);
                // If instituteInfo is still null, use teacher's institute info
                if (!uData) setInstituteInfo(parsedTData);
            }
        } catch (e) {
            console.error('Error loading initial data:', e);
        }
    };

    const fetchStudentDetails = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            // Reusing the list endpoint as verified in principal implementation
            const response = await axios.get(
                `${API_ENDPOINTS.TEACHER}/student/list`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const foundStudent = response.data.students.find((s: any) => s.id.toString() === id);
            if (foundStudent) {
                setStudent(foundStudent);
            } else {
                Toast.show({ type: 'error', text1: 'Not Found', text2: 'Student not found.' });
            }
        } catch (error) {
            console.error('Error fetching details:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load details' });
        } finally {
            setLoading(false);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            backgroundColor: 'transparent',
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
        },
        backBtn: { padding: 8, borderRadius: 12, backgroundColor: 'transparent' },
        headerTitle: { fontSize: 18, fontWeight: '900', color: theme.text },

        content: { flex: 1, padding: 20 },
        profileCard: {
            backgroundColor: 'transparent',
            borderRadius: 24,
            padding: 20,
            alignItems: 'center',
            marginBottom: 25,
        },
        avatarWrapper: {
            width: 110, height: 110, borderRadius: 55,
            backgroundColor: theme.background, justifyContent: 'center',
            alignItems: 'center', borderWidth: 2, borderColor: theme.primary,
            overflow: 'hidden', marginBottom: 15
        },
        avatarImg: { width: '100%', height: '100%' },

        studentName: { fontSize: 22, fontWeight: '900', color: theme.text, textAlign: 'center' },
        studentClass: { fontSize: 14, color: theme.textLight, fontWeight: '700', marginTop: 4 },

        actionButtonsRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 25,
        },
        feesBtn: {
            flex: 1,
            backgroundColor: theme.primary,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            borderRadius: 16,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
        },
        attendanceBtn: {
            flex: 1,
            backgroundColor: isDark ? '#2E1A47' : '#F3E5F5',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: isDark ? '#4A2B70' : '#E1BEE7',
        },
        feesBtnText: {
            color: '#fff',
            fontWeight: '800',
            fontSize: 13,
            marginLeft: 8,
        },
        attendanceBtnText: {
            color: isDark ? '#D1C4E9' : '#9C27B0',
            fontWeight: '800',
            fontSize: 13,
            marginLeft: 8,
        },

        section: { marginBottom: 25 },
        sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.primary, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
        detailsContainer: { backgroundColor: 'transparent', padding: 0 },

        detailRow: { flexDirection: 'row', alignItems: 'center', padding: 15 },
        detailLabelContainer: { flex: 1, flexDirection: 'row', alignItems: 'center' },
        detailLabel: { fontSize: 14, color: theme.textLight, fontWeight: '600' },
        detailValue: { flex: 1, fontSize: 14, color: theme.text, fontWeight: '700', textAlign: 'right' },

        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
        codeCard: {
            backgroundColor: theme.primary + '10',
            padding: 15,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 25,
            borderWidth: 1,
            borderColor: theme.primary + '20',
        },
        codeLabel: { fontSize: 13, fontWeight: '700', color: theme.primary, marginRight: 10 },
        codeValue: {
            fontSize: 20,
            fontWeight: '900',
            color: theme.primary,
            letterSpacing: 2,
            fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
        },
    }), [theme, isDark]);

    const DetailItem = ({ label, value, icon }: any) => (
        <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
            <View style={styles.detailLabelContainer}>
                {icon && <Ionicons name={icon} size={18} color={theme.primary} style={{ marginRight: 8 }} />}
                <Text style={styles.detailLabel}>{label}</Text>
            </View>
            <Text style={styles.detailValue}>{value || '—'}</Text>
        </View>
    );

    if (loading) return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );

    if (!student) return (
        <View style={styles.loadingContainer}>
            <Text style={{ color: theme.text }}>Student not found</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />

            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Student Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarWrapper}>
                        {student.photo_url ? (
                            <Image source={{ uri: student.photo_url }} style={styles.avatarImg} />
                        ) : (
                            <Ionicons name="person" size={50} color={theme.border} />
                        )}
                    </View>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentClass}>Class {student.class} - {student.section} • Roll No: {student.roll_no}</Text>
                </View>

                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity 
                        style={styles.feesBtn}
                        onPress={() => setIsFeesVisible(true)}
                    >
                        <Ionicons name="receipt" size={18} color="#fff" />
                        <Text style={styles.feesBtnText}>FEES HISTORY</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.attendanceBtn}
                        onPress={() => setIsAttendanceVisible(true)}
                    >
                        <Ionicons name="calendar" size={18} color={isDark ? '#D1C4E9' : '#9C27B0'} />
                        <Text style={styles.attendanceBtnText}>ATTENDANCE</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.codeCard}>
                    <Text style={styles.codeLabel}>ACCESS CODE:</Text>
                    <Text style={styles.codeValue}>{student.unique_code}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                    <View style={styles.detailsContainer}>
                        <DetailItem icon="person-outline" label="Full Name" value={student.name} />
                        <DetailItem icon="calendar-outline" label="Date of Birth" value={student.dob} />
                        <DetailItem icon="male-female-outline" label="Gender" value={student.gender} />
                        <DetailItem icon="call-outline" label="Mobile" value={student.mobile} />
                        <DetailItem icon="mail-outline" label="Email" value={student.email} />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Academic & Guardian</Text>
                    <View style={styles.detailsContainer}>
                        <DetailItem icon="school-outline" label="Class" value={student.class} />
                        <DetailItem icon="grid-outline" label="Section" value={student.section} />
                        <DetailItem icon="list-outline" label="Roll Number" value={student.roll_no} />
                        <DetailItem icon="person-outline" label="Father's Name" value={student.father_name} />
                        <DetailItem icon="person-outline" label="Mother's Name" value={student.mother_name} />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Residence & Facilities</Text>
                    <View style={styles.detailsContainer}>
                        <DetailItem icon="location-outline" label="Address" value={student.address} />
                        <DetailItem icon="bus-outline" label="Transport" value={student.transport_facility ? 'Yes' : 'No'} />
                    </View>
                </View>
            </ScrollView>

            {student && (
                <FeeHistoryBottomSheet 
                    visible={isFeesVisible}
                    onClose={() => setIsFeesVisible(false)}
                    student={student}
                    institute={instituteInfo}
                    canCollect={!!teacherData?.special_permission}
                />
            )}
            {student && (
                <AttendanceHistoryBottomSheet 
                    visible={isAttendanceVisible}
                    onClose={() => setIsAttendanceVisible(false)}
                    student={student}
                />
            )}
        </View>
    );
}
