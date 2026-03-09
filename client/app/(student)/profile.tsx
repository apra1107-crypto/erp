import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';
import { formatDate } from '../../utils/dateFormatter';

export default function StudentProfile() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [studentData, setStudentData] = useState<any>(null);
    const API_URL = API_ENDPOINTS.AUTH.STUDENT;

    useEffect(() => {
        loadStudentData();
    }, []);

    const loadStudentData = async () => {
        try {
            // Load from cache first
            const data = await AsyncStorage.getItem('studentData');
            const token = await AsyncStorage.getItem('studentToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');

            if (data && !storedSessionId) { // Only use cache if no session override is set
                setStudentData(JSON.parse(data));
            }

            // Fetch fresh data
            if (token) {
                const student = data ? JSON.parse(data) : null;
                const sessionId = storedSessionId || (student ? student.current_session_id : null);

                const response = await axios.get(`${API_URL}/profile`, {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    }
                });

                if (response.data.student) {
                    const freshData = { ...response.data.student, authToken: token };
                    setStudentData(freshData);
                    // Only cache if it's the default/current session to avoid data mixup
                    if (!storedSessionId || String(storedSessionId) === String(response.data.student.current_session_id)) {
                        await AsyncStorage.setItem('studentData', JSON.stringify(freshData));
                    }
                }
            }
        } catch (error) {
            console.error('Error loading student data:', error);
        } finally {
            setLoading(false);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 24,
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            backgroundColor: 'transparent',
            zIndex: 10,
        },
        backBtn: { 
            width: 40, 
            height: 40, 
            borderRadius: 12, 
            backgroundColor: isDark ? '#333' : '#f4f4f5', 
            justifyContent: 'center', 
            alignItems: 'center' 
        },
        title: { fontSize: 24, fontWeight: '900', color: theme.text, letterSpacing: -0.5, marginLeft: 16 },
        placeholder: { width: 40 },
        content: { padding: 20 },
        profileCard: {
            backgroundColor: theme.card,
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            marginBottom: 25,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 15,
            elevation: 3,
        },
        avatarContainer: {
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: theme.background,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
            borderWidth: 3,
            borderColor: theme.primary,
            overflow: 'hidden',
        },
        avatar: { width: 120, height: 120 },
        studentName: { fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 4 },
        instituteName: { fontSize: 14, color: theme.textLight, fontWeight: '600' },

        infoSection: {
            backgroundColor: theme.card,
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.border,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '800',
            color: theme.text,
            marginBottom: 12,
            marginTop: 20,
            marginLeft: 4
        },
        infoRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 15,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        infoLabel: { color: theme.textLight, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', flex: 1 },
        infoValue: { color: theme.text, fontSize: 15, fontWeight: '700', flex: 1.5, textAlign: 'right' },
        lastRow: { borderBottomWidth: 0 },
    }), [theme, isDark]);

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Student Profile</Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarContainer}>
                        {studentData?.photo_url ? (
                            <Image source={{ uri: studentData.photo_url }} style={styles.avatar} />
                        ) : (
                            <Ionicons name="person" size={60} color={theme.border} />
                        )}
                    </View>
                    <Text style={styles.studentName}>{studentData?.name}</Text>
                    <Text style={styles.instituteName}>{studentData?.institute_name}</Text>
                </View>

                <Text style={styles.sectionTitle}>Academic Details</Text>
                <View style={styles.infoSection}>
                    <InfoItem label="Access Code / Unique Code" value={studentData?.unique_code} styles={styles} />
                    <InfoItem label="Class" value={studentData?.class} styles={styles} />
                    <InfoItem label="Section" value={studentData?.section} styles={styles} />
                    <InfoItem label="Roll No" value={studentData?.roll_no} styles={styles} isLast />
                </View>

                <Text style={styles.sectionTitle}>Personal Details</Text>
                <View style={styles.infoSection}>
                    <InfoItem label="Full Name" value={studentData?.name} styles={styles} />
                    <InfoItem label="Date of Birth" value={studentData?.dob} styles={styles} />
                    <InfoItem label="Gender" value={studentData?.gender} styles={styles} />
                    <InfoItem label="Father's Name" value={studentData?.father_name} styles={styles} />
                    <InfoItem label="Mother's Name" value={studentData?.mother_name} styles={styles} isLast />
                </View>

                <Text style={styles.sectionTitle}>Fees Information</Text>
                <View style={styles.infoSection}>
                    <InfoItem label="Monthly Tuition Fee" value={`₹${parseFloat(studentData?.monthly_fees || 0).toLocaleString()}`} styles={styles} />
                    <InfoItem label="Transport Facility" value={studentData?.transport_facility ? 'Yes' : 'No'} styles={styles} />
                    {studentData?.transport_facility && (
                        <InfoItem label="Monthly Transport Fee" value={`₹${parseFloat(studentData?.transport_fees || 0).toLocaleString()}`} styles={styles} />
                    )}
                    <InfoItem label="Total Monthly Payable" value={`₹${(parseFloat(studentData?.monthly_fees || 0) + (studentData?.transport_facility ? parseFloat(studentData?.transport_fees || 0) : 0)).toLocaleString()}`} styles={styles} isLast />
                </View>


                <Text style={styles.sectionTitle}>Contact Information</Text>
                <View style={styles.infoSection}>
                    <InfoItem label="Mobile Number" value={studentData?.mobile} styles={styles} />
                    <InfoItem label="Email Address" value={studentData?.email} styles={styles} />
                    <InfoItem label="Address" value={studentData?.address} styles={styles} isLast />
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const InfoItem = ({ label, value, styles, isLast }: any) => (
    <View style={[styles.infoRow, isLast && styles.lastRow]}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value && value.toString().trim() ? value : 'Not provided'}</Text>
    </View>
);
