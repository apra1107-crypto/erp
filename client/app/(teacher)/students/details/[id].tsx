import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform, StatusBar, ImageBackground, TextInput, Alert, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../../constants/Config';
import AttendanceHistoryBottomSheet from '../../../../components/AttendanceHistoryBottomSheet';
import MonthlyTransactionBottomSheet from '../../../../components/MonthlyTransactionBottomSheet';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolateColor } from 'react-native-reanimated';
import { getFullImageUrl } from '../../../../utils/imageHelper';

const ModernToggle = ({ value, onValueChange, activeColor }: { value: boolean, onValueChange: (v: boolean) => void, activeColor: string }) => {
    const translateX = useSharedValue(value ? 22 : 2);
    
    useEffect(() => {
        translateX.value = withSpring(value ? 22 : 2, { damping: 15, stiffness: 150 });
    }, [value]);

    const animatedThumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }]
    }));

    const animatedTrackStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            translateX.value,
            [2, 22],
            ['#E9E9EB', activeColor]
        );
        return { backgroundColor };
    });

    return (
        <TouchableOpacity activeOpacity={1} onPress={() => onValueChange(!value)}>
            <Animated.View style={[{ width: 50, height: 28, borderRadius: 15, justifyContent: 'center', paddingHorizontal: 2 }, animatedTrackStyle]}>
                <Animated.View style={[{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 }, animatedThumbStyle]} />
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function StudentDetails() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams();
    
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [student, setStudent] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState<any>({});
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [photo, setPhoto] = useState<any>(null);

    // Bottom Sheet States
    const [isAttendanceVisible, setIsAttendanceVisible] = useState(false);
    const [isFeesVisible, setIsFeesVisible] = useState(false);
    const [teacherData, setTeacherData] = useState<any>(null);

    useEffect(() => {
        fetchStudentDetails();
        loadInitialData();
    }, [id]);

    const loadInitialData = async () => {
        try {
            const tData = await AsyncStorage.getItem('teacherData');
            if (tData) setTeacherData(JSON.parse(tData));
        } catch (e) {}
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

    const fetchStudentDetails = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            const response = await axios.get(
                `${API_ENDPOINTS.TEACHER}/student/list`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    } 
                }
            );

            const foundStudent = response.data.students.find((s: any) => s.id.toString() === id);
            if (foundStudent) {
                setStudent(foundStudent);
                setFormData({
                    ...foundStudent,
                    dob: parseDate(foundStudent.dob),
                    transport_facility: !!foundStudent.transport_facility
                });
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

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            setPhoto(result.assets[0]);
        }
    };

    const formatDate = (date: Date) => {
        if (!(date instanceof Date)) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const handleUpdate = async () => {
        try {
            setSaving(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const data = new FormData();

            data.append('student_id', id as string);
            data.append('name', formData.name);
            data.append('dob', formData.dob.toISOString().split('T')[0]);
            data.append('mobile', formData.mobile);
            data.append('email', formData.email);
            data.append('class', formData.class);
            data.append('section', formData.section);
            data.append('roll_no', formData.roll_no);
            data.append('gender', formData.gender);
            data.append('address', formData.address);
            data.append('father_name', formData.father_name);
            data.append('mother_name', formData.mother_name);
            data.append('transport_facility', String(formData.transport_facility));
            data.append('monthly_fees', formData.monthly_fees);
            data.append('transport_fees', formData.transport_fees);

            if (photo) {
                data.append('photo', {
                    uri: photo.uri,
                    type: 'image/jpeg',
                    name: 'photo.jpg',
                } as any);
            }

            await axios.put(
                `${API_ENDPOINTS.PRINCIPAL}/student/update/${id}`,
                data,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    }
                }
            );

            Toast.show({ type: 'success', text1: 'Success', text2: 'Student updated successfully' });
            setIsEditing(false);
            setPhoto(null);
            fetchStudentDetails();
        } catch (error: any) {
            console.error('Update error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to update student' });
        } finally {
            setSaving(false);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10,
        },
        backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
        headerTitle: { fontSize: 18, fontWeight: '900', color: theme.text },
        saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.primary },
        saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
        editBtn: { color: theme.primary, fontWeight: '800', fontSize: 15 },

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
        photoOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: theme.card },

        studentName: { fontSize: 22, fontWeight: '900', color: theme.text, textAlign: 'center' },
        studentClass: { fontSize: 14, color: theme.textLight, fontWeight: '700', marginTop: 4 },

        actionButtonsRow: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 25,
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
        attendanceBtnText: {
            color: isDark ? '#D1C4E9' : '#9C27B0',
            fontWeight: '800',
            fontSize: 13,
            marginLeft: 8,
        },

        section: { marginBottom: 25 },
        sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.primary, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
        detailsContainer: { backgroundColor: 'transparent', padding: 0 },

        inputGroup: { padding: 10 },
        label: { fontSize: 13, fontWeight: '700', color: theme.textLight, marginBottom: 8, marginLeft: 5 },
        inputWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.background,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 12,
        },
        input: { flex: 1, height: 48, color: theme.text, fontSize: 15, fontWeight: '600' },
        textArea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },

        detailRow: { flexDirection: 'row', alignItems: 'center', padding: 15 },
        detailLabelContainer: { flex: 1, flexDirection: 'row', alignItems: 'center' },
        detailLabel: { fontSize: 14, color: theme.textLight, fontWeight: '600' },
        detailValue: { flex: 1, fontSize: 14, color: theme.text, fontWeight: '700', textAlign: 'right' },

        genderContainer: {
            flexDirection: 'row',
            backgroundColor: theme.background,
            borderRadius: 15,
            padding: 4,
            borderWidth: 1,
            borderColor: theme.border,
            marginTop: 5,
        },
        genderButton: {
            flex: 1,
            height: 40,
            borderRadius: 12,
            justifyContent: 'center',
            alignItems: 'center',
        },
        genderButtonActive: {
            backgroundColor: theme.primary,
        },
        genderText: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.textLight,
        },
        genderTextActive: {
            color: '#fff',
        },

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
                {isEditing ? (
                    <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate} disabled={saving}>
                        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => setIsEditing(true)}>
                        <Text style={styles.editBtn}>Edit</Text>
                    </TouchableOpacity>
                )}
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            >
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(40, insets.bottom + 20) }}>
                    <View style={styles.profileCard}>
                        <TouchableOpacity style={styles.avatarWrapper} onPress={isEditing ? pickImage : undefined} activeOpacity={isEditing ? 0.7 : 1}>
                            {(photo || student.photo_url) ? (
                                <Image source={{ uri: photo ? photo.uri : getFullImageUrl(student.photo_url) }} style={styles.avatarImg} />
                            ) : (
                                <Ionicons name="person" size={50} color={theme.border} />
                            )}
                            {isEditing && (
                                <View style={styles.photoOverlay}>
                                    <Ionicons name="camera" size={16} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.studentName}>{student.name}</Text>
                        <Text style={styles.studentClass}>Class {student.class} - {student.section} • Roll No: {student.roll_no}</Text>
                    </View>

                    {!isEditing && (
                        <>
                            <View style={styles.actionButtonsRow}>
                                <TouchableOpacity 
                                    style={styles.attendanceBtn}
                                    onPress={() => setIsAttendanceVisible(true)}
                                >
                                    <Ionicons name="calendar" size={18} color={isDark ? '#D1C4E9' : '#9C27B0'} />
                                    <Text style={styles.attendanceBtnText}>ATTENDANCE</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.attendanceBtn, { backgroundColor: isDark ? '#1B2C1B' : '#E8F5E9', borderColor: isDark ? '#27AE60' : '#C8E6C9' }]}
                                    onPress={() => setIsFeesVisible(true)}
                                >
                                    <Text style={[styles.attendanceBtnText, { color: isDark ? '#81C784' : '#2E7D32', marginLeft: 0 }]}>₹ FEES</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.codeCard}>
                                <Text style={styles.codeLabel}>ACCESS CODE:</Text>
                                <Text style={styles.codeValue}>{student.unique_code}</Text>
                            </View>
                        </>
                    )}

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Personal Information</Text>
                        <View style={styles.detailsContainer}>
                            {isEditing ? (
                                <>
                                    <InputItem theme={theme} styles={styles} icon="person-outline" label="Full Name" value={formData.name} onChange={(t: string) => setFormData({ ...formData, name: t })} />
                                    <InputItem theme={theme} styles={styles} icon="calendar-outline" label="Date of Birth" value={formatDate(formData.dob)} onTouch={() => setShowDatePicker(true)} />
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Gender</Text>
                                        <View style={styles.genderContainer}>
                                            <TouchableOpacity
                                                style={[styles.genderButton, formData.gender === 'Male' && styles.genderButtonActive]}
                                                onPress={() => setFormData({ ...formData, gender: 'Male' })}
                                            >
                                                <Text style={[styles.genderText, formData.gender === 'Male' && styles.genderTextActive]}>Male</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.genderButton, formData.gender === 'Female' && styles.genderButtonActive]}
                                                onPress={() => setFormData({ ...formData, gender: 'Female' })}
                                            >
                                                <Text style={[styles.genderText, formData.gender === 'Female' && styles.genderTextActive]}>Female</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.genderButton, formData.gender === 'Other' && styles.genderButtonActive]}
                                                onPress={() => setFormData({ ...formData, gender: 'Other' })}
                                            >
                                                <Text style={[styles.genderText, formData.gender === 'Other' && styles.genderTextActive]}>Other</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <InputItem theme={theme} styles={styles} icon="call-outline" label="Mobile" value={formData.mobile} onChange={(t: string) => setFormData({ ...formData, mobile: t })} keyboardType="phone-pad" />
                                    <InputItem theme={theme} styles={styles} icon="mail-outline" label="Email" value={formData.email} onChange={(t: string) => setFormData({ ...formData, email: t })} keyboardType="email-address" />
                                </>
                            ) : (
                                <>
                                    <DetailItem theme={theme} styles={styles} icon="person-outline" label="Full Name" value={student.name} />
                                    <DetailItem theme={theme} styles={styles} icon="calendar-outline" label="Date of Birth" value={student.dob} />
                                    <DetailItem theme={theme} styles={styles} icon="male-female-outline" label="Gender" value={student.gender} />
                                    <DetailItem theme={theme} styles={styles} icon="call-outline" label="Mobile" value={student.mobile} />
                                    <DetailItem theme={theme} styles={styles} icon="mail-outline" label="Email" value={student.email} />
                                </>
                            )}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Academic & Guardian</Text>
                        <View style={styles.detailsContainer}>
                            {isEditing ? (
                                <>
                                    <InputItem theme={theme} styles={styles} icon="school-outline" label="Class" value={formData.class} onChange={(t: string) => setFormData({ ...formData, class: t })} />
                                    <InputItem theme={theme} styles={styles} icon="grid-outline" label="Section" value={formData.section} onChange={(t: string) => setFormData({ ...formData, section: t })} />
                                    <InputItem theme={theme} styles={styles} icon="list-outline" label="Roll Number" value={formData.roll_no} onChange={(t: string) => setFormData({ ...formData, roll_no: t })} />
                                    <InputItem theme={theme} styles={styles} icon="person-outline" label="Father's Name" value={formData.father_name} onChange={(t: string) => setFormData({ ...formData, father_name: t })} />
                                    <InputItem theme={theme} styles={styles} icon="person-outline" label="Mother's Name" value={formData.mother_name} onChange={(t: string) => setFormData({ ...formData, mother_name: t })} />
                                </>
                            ) : (
                                <>
                                    <DetailItem theme={theme} styles={styles} icon="school-outline" label="Class" value={student.class} />
                                    <DetailItem theme={theme} styles={styles} icon="grid-outline" label="Section" value={student.section} />
                                    <DetailItem theme={theme} styles={styles} icon="list-outline" label="Roll Number" value={student.roll_no} />
                                    <DetailItem theme={theme} styles={styles} icon="person-outline" label="Father's Name" value={student.father_name} />
                                    <DetailItem theme={theme} styles={styles} icon="person-outline" label="Mother's Name" value={student.mother_name} />
                                </>
                            )}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Residence & Facilities</Text>
                        <View style={styles.detailsContainer}>
                            {isEditing ? (
                                <>
                                    <InputItem theme={theme} styles={styles} icon="location-outline" label="Address" value={formData.address} onChange={(t: string) => setFormData({ ...formData, address: t })} multiline />
                                    <View style={{ padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                                                <Ionicons name="bus-outline" size={18} color={theme.primary} />
                                            </View>
                                            <Text style={styles.detailLabel}>Transport Facility</Text>
                                        </View>
                                        <ModernToggle
                                            value={formData.transport_facility}
                                            onValueChange={(v) => setFormData({ ...formData, transport_facility: v })}
                                            activeColor={theme.primary}
                                        />
                                    </View>
                                </>
                            ) : (
                                <>
                                    <DetailItem theme={theme} styles={styles} icon="location-outline" label="Address" value={student.address} />
                                    <DetailItem theme={theme} styles={styles} icon="bus-outline" label="Transport" value={student.transport_facility ? 'Yes' : 'No'} />
                                </>
                            )}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Fees Information</Text>
                        <View style={styles.detailsContainer}>
                            {isEditing ? (
                                <>
                                    <InputItem theme={theme} styles={styles} icon="currency-inr" iconType="material" label="Monthly Fees" value={String(formData.monthly_fees || '')} onChange={(t: string) => setFormData({ ...formData, monthly_fees: t })} keyboardType="numeric" prefix="₹" />
                                    {formData.transport_facility && (
                                        <InputItem theme={theme} styles={styles} icon="bus-outline" label="Transport Fees" value={String(formData.transport_fees || '')} onChange={(t: string) => setFormData({ ...formData, transport_fees: t })} keyboardType="numeric" prefix="₹" />
                                    )}
                                </>
                            ) : (
                                <>
                                    <DetailItem theme={theme} styles={styles} icon="currency-inr" iconType="material" label="Monthly Fees" value={`₹${student.monthly_fees || 0}`} />
                                    {student.transport_facility && (
                                        <DetailItem theme={theme} styles={styles} icon="bus-outline" label="Transport Fees" value={`₹${student.transport_fees || 0}`} />
                                    )}
                                </>
                            )}
                        </View>
                    </View>

                    {showDatePicker && (
                        <DateTimePicker
                            value={formData.dob || new Date()}
                            mode="date"
                            display="default"
                            onChange={(event, date) => {
                                setShowDatePicker(false);
                                if (date) setFormData({ ...formData, dob: date });
                            }}
                        />
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {student && (
                <AttendanceHistoryBottomSheet 
                    visible={isAttendanceVisible}
                    onClose={() => setIsAttendanceVisible(false)}
                    student={student}
                />
            )}

            {student && (
                <MonthlyTransactionBottomSheet
                    isOpen={isFeesVisible}
                    onClose={() => setIsFeesVisible(false)}
                    data={student}
                />
            )}
        </View>
    );
}

const DetailItem = ({ label, value, icon, iconType, theme, styles }: any) => (
    <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
        <View style={styles.detailLabelContainer}>
            {icon && (
                iconType === 'material' ? (
                    <MaterialCommunityIcons name={icon as any} size={18} color={theme.primary} style={{ marginRight: 8 }} />
                ) : (
                    <Ionicons name={icon} size={18} color={theme.primary} style={{ marginRight: 8 }} />
                )
            )}
            <Text style={styles.detailLabel}>{label}</Text>
        </View>
        <Text style={styles.detailValue}>{value || '—'}</Text>
    </View>
);

const InputItem = ({ label, value, onChange, onTouch, keyboardType, multiline, icon, iconType, theme, styles, prefix }: any) => (
    <View style={styles.inputGroup}>
        <Text style={styles.label}>{label}</Text>
        {onTouch ? (
            <TouchableOpacity style={styles.inputWrapper} onPress={onTouch}>
                {icon && (
                    iconType === 'material' ? (
                        <MaterialCommunityIcons name={icon as any} size={20} color={theme.primary} style={{ marginRight: 10 }} />
                    ) : (
                        <Ionicons name={icon} size={20} color={theme.primary} style={{ marginRight: 10 }} />
                    )
                )}
                <Text style={[styles.input, { lineHeight: 48 }]}>{value}</Text>
                <Ionicons name="calendar-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
        ) : (
            <View style={styles.inputWrapper}>
                {icon && (
                    iconType === 'material' ? (
                        <MaterialCommunityIcons name={icon as any} size={20} color={theme.primary} style={{ marginRight: 10 }} />
                    ) : (
                        <Ionicons name={icon} size={20} color={theme.primary} style={{ marginRight: 10 }} />
                    )
                )}
                {prefix && <Text style={{ fontSize: 16, fontWeight: '700', color: theme.primary, marginRight: 5 }}>{prefix}</Text>}
                <TextInput
                    style={[styles.input, multiline && styles.textArea]}
                    value={value}
                    onChangeText={onChange}
                    keyboardType={keyboardType}
                    multiline={multiline}
                    placeholderTextColor={theme.textLight}
                />
            </View>
        )}
    </View>
);
