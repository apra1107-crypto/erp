import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';
import SalaryHistoryBottomSheet from '../../components/SalaryHistoryBottomSheet';
import TeacherAttendanceBottomSheet from '../../components/TeacherAttendanceBottomSheet';

export default function TeacherProfile() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);

    // Bottom Sheet States
    const [showSalarySheet, setShowSalarySheet] = useState(false);
    const [showAttendanceSheet, setShowAttendanceSheet] = useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [])
    );

    const fetchProfile = async () => {
        try {
            console.log('[TeacherProfile] Fetching profile...');
            const data = await AsyncStorage.getItem('teacherData');
            console.log('[TeacherProfile] teacherData from storage:', data ? 'found' : 'missing');
            if (data) {
                const token = await AsyncStorage.getItem('teacherToken');
                const url = `${API_ENDPOINTS.AUTH.TEACHER}/profile`;
                const response = await axios.get(
                    url,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const profileData = response.data.teacher || response.data.profile;
                console.log('[TeacherProfile] profile fetched:', profileData?.name);
                setProfile(profileData);
            }
        } catch (error) {
            console.error('Fetch profile error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load profile' });
        } finally {
            setLoading(false);
        }
    };

    const parseDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const formatDateIndian = (date: any) => {
        if (!date) return '—';
        const d = (date instanceof Date) ? date : parseDate(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
        header: {
            backgroundColor: theme.background,
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
        },
        backBtn: { padding: 8, borderRadius: 12, backgroundColor: theme.card },
        title: { fontSize: 20, fontWeight: '900', color: theme.text },
        
        content: { padding: 0 },
        profileSection: { padding: 20, alignItems: 'center', marginBottom: 10 },
        avatarWrapper: { width: 110, height: 110, borderRadius: 55, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.primary, overflow: 'hidden' },
        avatarImg: { width: '100%', height: '100%' },
        placeholderAvatar: { width: '100%', height: '100%', backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
        avatarInitial: { fontSize: 40, fontWeight: '900', color: '#fff' },
        
        teacherName: { fontSize: 24, fontWeight: '900', color: theme.text, marginTop: 15 },
        instituteName: { fontSize: 15, color: theme.textLight, fontWeight: '700', marginTop: 4 },

        actionButtonsRow: {
            flexDirection: 'row',
            gap: 15,
            paddingHorizontal: 20,
            marginBottom: 30,
        },
        actionButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            borderRadius: 15,
            gap: 8,
        },
        actionButtonText: { fontSize: 14, fontWeight: '800' },

        section: { paddingHorizontal: 20, marginBottom: 25 },
        sectionTitle: { fontSize: 13, fontWeight: '900', color: theme.primary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
    }), [theme, insets, isDark]);

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );

    if (!profile) return (
        <View style={styles.center}>
            <Ionicons name="person-outline" size={60} color={theme.border} />
            <Text style={{ color: theme.textLight, marginTop: 15, fontWeight: '600' }}>Profile not found</Text>
            <TouchableOpacity 
                style={{ marginTop: 20, padding: 12, backgroundColor: theme.primary, borderRadius: 10 }}
                onPress={() => router.back()}
            >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Go Back</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>My Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
                <View style={styles.profileSection}>
                    <View style={styles.avatarWrapper}>
                        {profile?.photo_url ? (
                            <Image source={{ uri: profile.photo_url }} style={styles.avatarImg} />
                        ) : (
                            <View style={styles.placeholderAvatar}>
                                <Text style={styles.avatarInitial}>{profile?.name?.charAt(0) || 'T'}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.teacherName}>{profile?.name}</Text>
                    <Text style={styles.instituteName}>{profile?.institute_name}</Text>
                </View>

                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: '#E8F5E9' }]} 
                        onPress={() => setShowSalarySheet(true)}
                    >
                        <Ionicons name="wallet-outline" size={20} color="#2E7D32" />
                        <Text style={[styles.actionButtonText, { color: '#2E7D32' }]}>My Salary</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: '#E3F2FD' }]} 
                        onPress={() => setShowAttendanceSheet(true)}
                    >
                        <Ionicons name="calendar-outline" size={20} color="#1565C0" />
                        <Text style={[styles.actionButtonText, { color: '#1565C0' }]}>Attendance</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                    <DetailItem icon="calendar-outline" label="Date of Birth" value={formatDateIndian(profile?.dob)} />
                    <DetailItem icon="transgender-outline" label="Gender" value={profile?.gender} />
                    <DetailItem icon="key-outline" label="Unique Access Code" value={profile?.unique_code} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Professional Details</Text>
                    <DetailItem icon="book-outline" label="Main Subject" value={profile?.subject} />
                    <DetailItem icon="school-outline" label="Qualification" value={profile?.qualification} />
                    <DetailItem
                        icon={profile?.special_permission ? "shield-checkmark-outline" : "lock-closed-outline"}
                        label="Special Edit Permission"
                        value={profile?.special_permission ? "Enabled" : "Disabled"}
                        valueColor={profile?.special_permission ? theme.success : theme.textLight}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Contact & Residence</Text>
                    <DetailItem icon="call-outline" label="Mobile Number" value={profile?.mobile} />
                    <DetailItem icon="mail-outline" label="Email Address" value={profile?.email} />
                    <DetailItem icon="location-outline" label="Home Address" value={profile?.address} />
                </View>
            </ScrollView>

            <SalaryHistoryBottomSheet 
                visible={showSalarySheet} 
                onClose={() => setShowSalarySheet(false)} 
                teacher={profile}
                role="teacher"
            />
            <TeacherAttendanceBottomSheet 
                visible={showAttendanceSheet} 
                onClose={() => setShowAttendanceSheet(false)} 
                teacher={profile}
                role="teacher"
            />
        </View>
    );
}

const DetailItem = ({ icon, label, value, valueColor }: any) => {
    const { theme } = useTheme();
    const dStyles = useMemo(() => StyleSheet.create({
        detailRow: { 
            flexDirection: 'row', 
            alignItems: 'center', 
            paddingVertical: 15, 
            borderBottomWidth: 1, 
            borderBottomColor: theme.border + '50' 
        },
        iconCircle: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.card,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 15,
        },
        detailContent: { flex: 1 },
        detailLabel: { color: theme.textLight, fontSize: 11, fontWeight: '700', marginBottom: 2, textTransform: 'uppercase' },
        detailValue: { color: valueColor || theme.text, fontSize: 15, fontWeight: '700' },
    }), [theme, valueColor]);

    return (
        <View style={dStyles.detailRow}>
            <View style={dStyles.iconCircle}>
                <Ionicons name={icon as any} size={18} color={theme.primary} />
            </View>
            <View style={dStyles.detailContent}>
                <Text style={dStyles.detailLabel}>{label}</Text>
                <Text style={dStyles.detailValue}>{value || 'Not provided'}</Text>
            </View>
        </View>
    );
};