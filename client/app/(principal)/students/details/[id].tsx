import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, Switch, ActivityIndicator, Alert, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../../constants/Config';
import FeeHistoryBottomSheet from '../../../../components/FeeHistoryBottomSheet';
import AttendanceHistoryBottomSheet from '../../../../components/AttendanceHistoryBottomSheet';

export default function StudentDetails() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    const { id } = useLocalSearchParams();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data State
    const [originalData, setOriginalData] = useState<any>(null);
    const [formData, setFormData] = useState<any>({});
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [photo, setPhoto] = useState<any>(null);
    const [deletePhoto, setDeletePhoto] = useState(false);

    // Bottom Sheet States
    const [isFeesVisible, setIsFeesVisible] = useState(false);
    const [isAttendanceVisible, setIsAttendanceVisible] = useState(false);
    const [instituteInfo, setInstituteInfo] = useState<any>(null);

    useEffect(() => {
        fetchStudentDetails();
        loadInstituteInfo();
    }, [id]);

    const loadInstituteInfo = async () => {
        try {
            const data = await AsyncStorage.getItem('userData');
            if (data) setInstituteInfo(JSON.parse(data));
        } catch (e) {
            console.error('Error loading institute info:', e);
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

    const fetchStudentDetails = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/student/list`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const student = response.data.students.find((s: any) => s.id.toString() === id);
            if (student) {
                setOriginalData(student);
                setFormData({
                    ...student,
                    dob: parseDate(student.dob),
                    is_active: !!student.is_active,
                    transport_facility: !!student.transport_facility
                });
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
            setDeletePhoto(false);
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
            const token = await AsyncStorage.getItem('token');
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

            if (photo) {
                data.append('photo', {
                    uri: photo.uri,
                    type: 'image/jpeg',
                    name: 'photo.jpg',
                } as any);
            } else if (deletePhoto) {
                data.append('delete_photo', 'true');
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

            Toast.show({ type: 'success', text1: 'Success', text2: 'Student updated' });
            setIsEditing(false);
            setPhoto(null);
            fetchStudentDetails();
        } catch (error) {
            console.error('Update error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update student' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Student",
            "Are you sure? This will permanently remove the student.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('token');
                            await axios.delete(`${API_ENDPOINTS.PRINCIPAL}/student/delete/${id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            router.back();
                            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Student removed' });
                        } catch (error) {
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete' });
                        }
                    }
                }
            ]
        );
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
        avatarWrapper: { width: 110, height: 110, borderRadius: 55, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.primary, overflow: 'hidden' },
        avatarImg: { width: '100%', height: '100%' },
        photoOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: theme.card },

        studentName: { fontSize: 22, fontWeight: '900', color: theme.text, marginTop: 15 },
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

        deleteBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            borderRadius: 20,
            backgroundColor: theme.danger + '10',
            marginTop: 10,
        },
        deleteText: { color: theme.danger, fontWeight: '800', fontSize: 16, marginLeft: 10 },

        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }
    }), [theme, isDark]);

    const DetailItem = ({ label, value, icon }: any) => {
        return (
            <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
                <View style={styles.detailLabelContainer}>
                    {icon && <Ionicons name={icon} size={18} color={theme.primary} style={{ marginRight: 8 }} />}
                    <Text style={styles.detailLabel}>{label}</Text>
                </View>
                <Text style={styles.detailValue}>{value || '—'}</Text>
            </View>
        );
    };

    const InputItem = ({ label, value, onChange, onTouch, keyboardType, multiline, icon }: any) => {
        return (
            <View style={styles.inputGroup}>
                <Text style={styles.label}>{label}</Text>
                {onTouch ? (
                    <TouchableOpacity style={styles.inputWrapper} onPress={onTouch}>
                        {icon && <Ionicons name={icon} size={20} color={theme.primary} style={{ marginRight: 10 }} />}
                        <Text style={[styles.input, { lineHeight: 48 }]}>{value}</Text>
                        <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.inputWrapper}>
                        {icon && <Ionicons name={icon} size={20} color={theme.primary} style={{ marginRight: 10 }} />}
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
    };

    if (loading) return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
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

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.profileCard}>
                    <TouchableOpacity style={styles.avatarWrapper} onPress={isEditing ? pickImage : undefined} activeOpacity={isEditing ? 0.7 : 1}>
                        {(photo || originalData?.photo_url) ? (
                            <Image source={{ uri: photo ? photo.uri : originalData.photo_url }} style={styles.avatarImg} />
                        ) : (
                            <Ionicons name="person" size={50} color={theme.border} />
                        )}
                        {isEditing && (
                            <View style={styles.photoOverlay}>
                                <Ionicons name="camera" size={16} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                    <Text style={styles.studentName}>{originalData?.name}</Text>
                    <Text style={styles.studentClass}>Class {originalData?.class} • Section {originalData?.section} • Roll No: {originalData?.roll_no}</Text>
                </View>

                {!isEditing && (
                    <>
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
                            <Text style={styles.codeValue}>{originalData?.unique_code}</Text>
                            <TouchableOpacity style={{ marginLeft: 15 }} onPress={() => { }}>
                                <Ionicons name="copy-outline" size={20} color={theme.primary} />
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                    <View style={styles.detailsContainer}>
                        {isEditing ? (
                            <>
                                <InputItem icon="person-outline" label="Full Name" value={formData.name} onChange={(t: string) => setFormData({ ...formData, name: t })} />
                                <InputItem icon="calendar-outline" label="Date of Birth" value={formatDate(formData.dob)} onTouch={() => setShowDatePicker(true)} />
                                <InputItem icon="male-female-outline" label="Gender" value={formData.gender} onChange={(t: string) => setFormData({ ...formData, gender: t })} />
                                <InputItem icon="call-outline" label="Mobile" value={formData.mobile} onChange={(t: string) => setFormData({ ...formData, mobile: t })} keyboardType="phone-pad" />
                                <InputItem icon="mail-outline" label="Email" value={formData.email} onChange={(t: string) => setFormData({ ...formData, email: t })} keyboardType="email-address" />
                            </>
                        ) : (
                            <>
                                <DetailItem icon="person-outline" label="Full Name" value={originalData?.name} />
                                <DetailItem icon="calendar-outline" label="Date of Birth" value={originalData?.dob} />
                                <DetailItem icon="male-female-outline" label="Gender" value={originalData?.gender} />
                                <DetailItem icon="call-outline" label="Mobile" value={originalData?.mobile} />
                                <DetailItem icon="mail-outline" label="Email" value={originalData?.email || 'N/A'} />
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Academic & Guardian</Text>
                    <View style={styles.detailsContainer}>
                        {isEditing ? (
                            <>
                                <InputItem icon="school-outline" label="Class" value={formData.class} onChange={(t: string) => setFormData({ ...formData, class: t })} />
                                <InputItem icon="grid-outline" label="Section" value={formData.section} onChange={(t: string) => setFormData({ ...formData, section: t })} />
                                <InputItem icon="list-outline" label="Roll Number" value={formData.roll_no} onChange={(t: string) => setFormData({ ...formData, roll_no: t })} />
                            </>
                        ) : (
                            <>
                                <DetailItem icon="school-outline" label="Class" value={originalData?.class} />
                                <DetailItem icon="grid-outline" label="Section" value={originalData?.section} />
                                <DetailItem icon="list-outline" label="Roll Number" value={originalData?.roll_no} />
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Parent Information</Text>
                    <View style={styles.detailsContainer}>
                        {isEditing ? (
                            <>
                                <InputItem icon="person-outline" label="Father's Name" value={formData.father_name} onChange={(t: string) => setFormData({ ...formData, father_name: t })} />
                                <InputItem icon="person-outline" label="Mother's Name" value={formData.mother_name} onChange={(t: string) => setFormData({ ...formData, mother_name: t })} />
                            </>
                        ) : (
                            <>
                                <DetailItem icon="person-outline" label="Father's Name" value={originalData?.father_name} />
                                <DetailItem icon="person-outline" label="Mother's Name" value={originalData?.mother_name} />
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Residence & Facilities</Text>
                    <View style={styles.detailsContainer}>
                        {isEditing ? (
                            <>
                                <InputItem icon="location-outline" label="Complete Address" value={formData.address} onChange={(t: string) => setFormData({ ...formData, address: t })} multiline />
                                <View style={{ padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="bus-outline" size={18} color={theme.primary} style={{ marginRight: 8 }} />
                                        <Text style={styles.detailLabel}>Transport Facility</Text>
                                    </View>
                                    <Switch
                                        value={formData.transport_facility}
                                        onValueChange={(v) => setFormData({ ...formData, transport_facility: v })}
                                        trackColor={{ false: '#ddd', true: theme.primary }}
                                    />
                                </View>
                            </>
                        ) : (
                            <>
                                <DetailItem icon="location-outline" label="Complete Address" value={originalData?.address} />
                                <DetailItem icon="bus-outline" label="Transport Facility" value={originalData?.transport_facility ? 'Yes' : 'No'} />
                            </>
                        )}
                    </View>
                </View>

                {isEditing && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={22} color={theme.danger} />
                        <Text style={styles.deleteText}>Delete Student Profile</Text>
                    </TouchableOpacity>
                )}

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

            {originalData && (
                <FeeHistoryBottomSheet 
                    visible={isFeesVisible}
                    onClose={() => setIsFeesVisible(false)}
                    student={originalData}
                    institute={instituteInfo}
                />
            )}
            {originalData && (
                <AttendanceHistoryBottomSheet 
                    visible={isAttendanceVisible}
                    onClose={() => setIsAttendanceVisible(false)}
                    student={originalData}
                />
            )}
        </View>
    );
}
