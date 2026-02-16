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
import SalaryHistoryBottomSheet from '../../../../components/SalaryHistoryBottomSheet';
import TeacherAttendanceBottomSheet from '../../../../components/TeacherAttendanceBottomSheet';

export default function TeacherDetails() {
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

    // Bottom Sheet State
    const [showSalarySheet, setShowSalarySheet] = useState(false);
    const [showAttendanceSheet, setShowAttendanceSheet] = useState(false);

    useEffect(() => {
        fetchTeacherDetails();
    }, [id]);

    const parseDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const fetchTeacherDetails = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/teacher/list`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const teacher = response.data.teachers.find((t: any) => t.id.toString() === id);
            if (teacher) {
                setOriginalData(teacher);
                setFormData({
                    ...teacher,
                    dob: parseDate(teacher.dob),
                    special_permission: !!teacher.special_permission
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

            data.append('teacher_id', id as string);
            data.append('name', formData.name);
            data.append('dob', formData.dob.toISOString().split('T')[0]);
            data.append('mobile', formData.mobile);
            data.append('email', formData.email);
            data.append('subject', formData.subject);
            data.append('qualification', formData.qualification);
            data.append('gender', formData.gender);
            data.append('address', formData.address);
            data.append('special_permission', String(formData.special_permission));

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
                `${API_ENDPOINTS.PRINCIPAL}/teacher/update/${id}`,
                data,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    }
                }
            );

            Toast.show({ type: 'success', text1: 'Success', text2: 'Teacher updated' });
            setIsEditing(false);
            setPhoto(null);
            fetchTeacherDetails();
        } catch (error) {
            console.error('Update error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update teacher' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Teacher",
            "Are you sure? This will permanently remove the teacher profile.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('token');
                            await axios.delete(`${API_ENDPOINTS.PRINCIPAL}/teacher/delete/${id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            router.back();
                            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Teacher removed' });
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
        headerTitle: { fontSize: 18, fontWeight: '900', color: theme.text },
        saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.primary },
        saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
        editBtn: { color: theme.primary, fontWeight: '800', fontSize: 15 },

        content: { flex: 1 },
        profileCard: {
            padding: 20,
            alignItems: 'center',
            marginBottom: 10,
        },
        avatarWrapper: { width: 110, height: 110, borderRadius: 55, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.primary, overflow: 'hidden' },
        avatarImg: { width: '100%', height: '100%' },
        photoOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.primary, width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: theme.background },

        teacherName: { fontSize: 24, fontWeight: '900', color: theme.text, marginTop: 15 },
        teacherSubject: { fontSize: 15, color: theme.textLight, fontWeight: '700', marginTop: 4 },

        actionButtonsRow: {
            flexDirection: 'row',
            gap: 15,
            paddingHorizontal: 20,
            marginBottom: 20,
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
        actionButtonText: {
            fontSize: 14,
            fontWeight: '800',
        },

        codeCard: {
            backgroundColor: theme.primary + '10',
            padding: 15,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: 20,
            marginBottom: 25,
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
        sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.primary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 20 },
        detailsContainer: { },

        switchContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 20,
            marginTop: -10,
            marginBottom: 10
        },
        switchLabel: { fontSize: 15, fontWeight: '700', color: theme.text },

        deleteBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            borderRadius: 20,
            backgroundColor: theme.danger + '10',
            marginHorizontal: 20,
            marginTop: 10,
        },
        deleteText: { color: theme.danger, fontWeight: '800', fontSize: 16, marginLeft: 10 },

        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }
    }), [theme, insets]);

    if (loading) return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} translucent={true} />

            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Teacher Details</Text>
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

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}>
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
                    <Text style={styles.teacherName}>{originalData?.name}</Text>
                    <Text style={styles.teacherSubject}>{originalData?.subject} • {originalData?.qualification}</Text>
                </View>

                {!isEditing && (
                    <View style={styles.actionButtonsRow}>
                        <TouchableOpacity 
                            style={[styles.actionButton, { backgroundColor: '#E8F5E9' }]} 
                            onPress={() => setShowSalarySheet(true)}
                        >
                            <Ionicons name="wallet-outline" size={20} color="#2E7D32" />
                            <Text style={[styles.actionButtonText, { color: '#2E7D32' }]}>Salary</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.actionButton, { backgroundColor: '#E3F2FD' }]} 
                            onPress={() => setShowAttendanceSheet(true)}
                        >
                            <Ionicons name="calendar-outline" size={20} color="#1565C0" />
                            <Text style={[styles.actionButtonText, { color: '#1565C0' }]}>Attendance</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {!isEditing && (
                    <View style={styles.codeCard}>
                        <Text style={styles.codeLabel}>ACCESS CODE:</Text>
                        <Text style={styles.codeValue}>{originalData?.unique_code}</Text>
                        <TouchableOpacity style={{ marginLeft: 15 }}>
                            <Ionicons name="copy-outline" size={20} color={theme.primary} />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                    <View style={styles.detailsContainer}>
                        {isEditing ? (
                            <>
                                <InputItem icon="person-outline" label="Full Name" value={formData.name} onChange={t => setFormData({ ...formData, name: t })} />
                                <InputItem icon="calendar-outline" label="Date of Birth" value={formatDate(formData.dob)} onTouch={() => setShowDatePicker(true)} />
                                <InputItem icon="transgender-outline" label="Gender" value={formData.gender} onChange={t => setFormData({ ...formData, gender: t })} />
                                <InputItem icon="school-outline" label="Qualification" value={formData.qualification} onChange={t => setFormData({ ...formData, qualification: t })} />
                            </>
                        ) : (
                            <>
                                <DetailItem icon="person-outline" label="Full Name" value={originalData?.name} />
                                <DetailItem icon="calendar-outline" label="Date of Birth" value={originalData?.dob ? formatDate(parseDate(originalData.dob)) : '—'} />
                                <DetailItem icon="transgender-outline" label="Gender" value={originalData?.gender} />
                                <DetailItem icon="school-outline" label="Qualification" value={originalData?.qualification} />
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Professional & Contact</Text>
                    <View style={styles.detailsContainer}>
                        {isEditing ? (
                            <>
                                <InputItem icon="book-outline" label="Main Subject" value={formData.subject} onChange={t => setFormData({ ...formData, subject: t })} />
                                <InputItem icon="call-outline" label="Mobile Number" value={formData.mobile} onChange={t => setFormData({ ...formData, mobile: t })} keyboardType="phone-pad" />
                                <InputItem icon="mail-outline" label="Email Address" value={formData.email} onChange={t => setFormData({ ...formData, email: t })} keyboardType="email-address" />
                            </>
                        ) : (
                            <>
                                <DetailItem icon="book-outline" label="Main Subject" value={originalData?.subject} />
                                <DetailItem icon="call-outline" label="Mobile Number" value={originalData?.mobile} />
                                <DetailItem icon="mail-outline" label="Email Address" value={originalData?.email} />
                                <DetailItem icon="checkmark-circle-outline" label="Special Permission" value={originalData?.special_permission ? 'Enabled' : 'Disabled'} />
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Residence</Text>
                    <View style={styles.detailsContainer}>
                        {isEditing ? (
                            <InputItem icon="location-outline" label="Complete Address" value={formData.address} onChange={t => setFormData({ ...formData, address: t })} multiline />
                        ) : (
                            <DetailItem icon="location-outline" label="Complete Address" value={originalData?.address} />
                        )}
                    </View>
                </View>

                <View style={[styles.switchContainer, { opacity: isEditing ? 1 : 0.7 }]}>
                    <Text style={styles.switchLabel}>Grant Special Edit Permission</Text>
                    <Switch
                        value={formData.special_permission}
                        onValueChange={isEditing ? (value) => setFormData({ ...formData, special_permission: value }) : undefined}
                        trackColor={{ false: '#ddd', true: theme.primary }}
                        disabled={!isEditing}
                    />
                </View>

                {isEditing && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={22} color={theme.danger} />
                        <Text style={styles.deleteText}>Delete Teacher Profile</Text>
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

            <SalaryHistoryBottomSheet 
                visible={showSalarySheet} 
                onClose={() => setShowSalarySheet(false)} 
                teacher={originalData} 
            />
            <TeacherAttendanceBottomSheet 
                visible={showAttendanceSheet} 
                onClose={() => setShowAttendanceSheet(false)} 
                teacher={originalData} 
            />
        </View>
    );
}

interface DetailItemProps {
    label: string;
    value: string | number | null | undefined;
    icon?: any;
}

const DetailItem = ({ label, value, icon }: DetailItemProps) => {
    const { theme } = useTheme();
    const styles = useMemo(() => StyleSheet.create({
        detailRow: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: theme.border + '50' },
        detailLabelContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
        detailLabel: { fontSize: 13, color: theme.textLight, fontWeight: '600' },
        detailValue: { flex: 1.5, fontSize: 14, color: theme.text, fontWeight: '700', textAlign: 'right' },
    }), [theme]);

    return (
        <View style={styles.detailRow}>
            <View style={styles.detailLabelContainer}>
                {icon && <Ionicons name={icon} size={18} color={theme.primary} style={{ marginRight: 8 }} />}
                <Text style={styles.detailLabel}>{label}</Text>
            </View>
            <Text style={styles.detailValue}>{value || '—'}</Text>
        </View>
    );
};

interface InputItemProps {
    label: string;
    value: any;
    onChange?: (text: string) => void;
    onTouch?: () => void;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
    multiline?: boolean;
    icon?: any;
}

const InputItem = ({ label, value, onChange, onTouch, keyboardType, multiline, icon }: InputItemProps) => {
    const { theme } = useTheme();
    const styles = useMemo(() => StyleSheet.create({
        inputGroup: { paddingHorizontal: 20, paddingVertical: 10 },
        label: { fontSize: 13, fontWeight: '700', color: theme.textLight, marginBottom: 8, marginLeft: 5 },
        inputWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.card,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 12,
        },
        input: { flex: 1, height: 48, color: theme.text, fontSize: 14, fontWeight: '600' },
        textArea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
    }), [theme]);

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

