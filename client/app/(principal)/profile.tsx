import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator, Alert, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';

export default function Profile() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [profile, setProfile] = useState<any>(null);
    const [formData, setFormData] = useState<any>({});

    // Image States
    const [logo, setLogo] = useState<any>(null);
    const [principalPhoto, setPrincipalPhoto] = useState<any>(null);
    const [deleteLogo, setDeleteLogo] = useState(false);
    const [deletePrincipalPhoto, setDeletePrincipalPhoto] = useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [])
    );

    const fetchProfile = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const url = `${API_ENDPOINTS.PRINCIPAL}/profile`;
            
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 5000
            });
            
            setProfile(response.data.profile);
            setFormData(response.data.profile);
        } catch (error: any) {
            console.error('Fetch profile error:', error.message);
            Toast.show({ 
                type: 'error', 
                text1: 'Network Error', 
                text2: 'Cannot reach server.' 
            });
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async (type: 'logo' | 'principal_photo') => {
        const options: ImagePicker.ImagePickerOptions = {
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        };

        const result = await ImagePicker.launchImageLibraryAsync(options);

        if (!result.canceled) {
            if (type === 'logo') {
                setLogo(result.assets[0]);
                setDeleteLogo(false);
            } else {
                setPrincipalPhoto(result.assets[0]);
                setDeletePrincipalPhoto(false);
            }
        }
    };

    const handleUpdate = async () => {
        try {
            setSaving(true);
            const token = await AsyncStorage.getItem('token');
            const data = new FormData();

            Object.keys(formData).forEach(key => {
                if (key !== 'logo_url' && key !== 'principal_photo_url' && key !== 'id') {
                    data.append(key, formData[key]);
                }
            });

            if (logo) {
                data.append('logo', {
                    uri: logo.uri,
                    type: 'image/jpeg',
                    name: 'logo.jpg',
                } as any);
            } else if (deleteLogo) {
                data.append('delete_logo', 'true');
            }

            if (principalPhoto) {
                data.append('principal_photo', {
                    uri: principalPhoto.uri,
                    type: 'image/jpeg',
                    name: 'photo.jpg',
                } as any);
            } else if (deletePrincipalPhoto) {
                data.append('delete_principal_photo', 'true');
            }

            await axios.put(
                `${API_ENDPOINTS.PRINCIPAL}/profile/update`,
                data,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            Toast.show({ type: 'success', text1: 'Success', text2: 'Profile updated successfully' });
            setIsEditing(false);
            setLogo(null);
            setPrincipalPhoto(null);
            fetchProfile();

            const userData = await AsyncStorage.getItem('userData');
            if (userData) {
                const parsed = JSON.parse(userData);
                const updated = { ...parsed, principal_name: formData.principal_name, institute_name: formData.institute_name };
                await AsyncStorage.setItem('userData', JSON.stringify(updated));
            }

        } catch (error) {
            console.error('Update error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update profile' });
        } finally {
            setSaving(false);
        }
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
        backBtn: {
            padding: 8,
            borderRadius: 12,
            backgroundColor: theme.card,
        },
        title: { fontSize: 20, fontWeight: '900', color: theme.text },
        editBtn: { color: theme.primary, fontWeight: '800', fontSize: 16 },
        content: { padding: 0 },

        imagesSection: {
            padding: 20,
            marginBottom: 10,
            alignItems: 'center',
        },
        imagesRow: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
        imageBlock: { alignItems: 'center' },
        imgLabel: { marginBottom: 12, fontWeight: '800', color: theme.textLight, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
        logoImg: { width: 100, height: 100, resizeMode: 'contain', borderRadius: 15 },
        logoPlaceholder: { width: 100, height: 100, borderRadius: 15, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
        avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: theme.primary },
        avatarImg: { width: 100, height: 100, borderRadius: 50 },
        actionRow: { flexDirection: 'row', gap: 15, marginTop: 12 },
        actionLink: { color: theme.primary, fontSize: 12, fontWeight: '800' },
        deleteLink: { color: theme.danger, fontSize: 12, fontWeight: '800' },

        section: { paddingHorizontal: 20, marginBottom: 25 },
        sectionTitle: { fontSize: 13, fontWeight: '900', color: theme.primary, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },

        form: { gap: 20, paddingHorizontal: 20 },
        inputGroup: {
            marginBottom: 5,
        },
        label: { color: theme.textLight, fontWeight: '700', marginBottom: 8, fontSize: 13, marginLeft: 4 },
        input: {
            backgroundColor: theme.card,
            padding: 15,
            borderRadius: 15,
            borderWidth: 1,
            borderColor: theme.border,
            fontSize: 15,
            color: theme.text,
            fontWeight: '600'
        },
        textArea: { height: 100, textAlignVertical: 'top' },
        row: { flexDirection: 'row', gap: 15 },
        half: { flex: 1 },
        btnRow: { flexDirection: 'row', gap: 15, marginTop: 20, marginBottom: 40 },
        btn: { flex: 1, padding: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
        saveBtn: { backgroundColor: theme.primary },
        cancelBtn: { backgroundColor: theme.card },
        btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
        cancelBtnText: { color: theme.text, fontWeight: '800', fontSize: 16 },
    }), [theme, insets]);

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Institute Profile</Text>
                {!isEditing ? (
                    <TouchableOpacity onPress={() => setIsEditing(true)}>
                        <Text style={styles.editBtn}>Edit</Text>
                    </TouchableOpacity>
                ) : <View style={{ width: 40 }} />}
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}>
                <View style={styles.imagesSection}>
                    <View style={styles.imagesRow}>
                        <View style={styles.imageBlock}>
                            <Text style={styles.imgLabel}>School Logo</Text>
                            {logo || profile?.logo_url ? (
                                <Image
                                    source={logo ? { uri: logo.uri } : { uri: profile.logo_url }}
                                    style={styles.logoImg}
                                />
                            ) : (
                                <View style={styles.logoPlaceholder}>
                                    <Ionicons name="school-outline" size={40} color={theme.border} />
                                </View>
                            )}
                            {isEditing && (
                                <View style={styles.actionRow}>
                                    <TouchableOpacity onPress={() => pickImage('logo')}><Text style={styles.actionLink}>Change</Text></TouchableOpacity>
                                    {(profile?.logo_url || logo) && <TouchableOpacity onPress={() => { setDeleteLogo(true); setLogo(null); }}><Text style={styles.deleteLink}>Delete</Text></TouchableOpacity>}
                                </View>
                            )}
                        </View>

                        <View style={styles.imageBlock}>
                            <Text style={styles.imgLabel}>Principal</Text>
                            <View style={styles.avatarContainer}>
                                {principalPhoto ? (
                                    <Image source={{ uri: principalPhoto.uri }} style={styles.avatarImg} />
                                ) : (profile?.principal_photo_url ? (
                                    <Image source={{ uri: profile.principal_photo_url }} style={styles.avatarImg} />
                                ) : (
                                    <Ionicons name="person" size={40} color={theme.border} />
                                ))}
                            </View>
                            {isEditing && (
                                <View style={styles.actionRow}>
                                    <TouchableOpacity onPress={() => pickImage('principal_photo')}><Text style={styles.actionLink}>Change</Text></TouchableOpacity>
                                    {(profile?.principal_photo_url || principalPhoto) && <TouchableOpacity onPress={() => { setDeletePrincipalPhoto(true); setPrincipalPhoto(null); }}><Text style={styles.deleteLink}>Delete</Text></TouchableOpacity>}
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {isEditing ? (
                    <View style={styles.form}>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Basic Information</Text>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Institute Name</Text>
                                <TextInput style={styles.input} value={formData.institute_name} onChangeText={t => setFormData({ ...formData, institute_name: t })} />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Principal Name</Text>
                                <TextInput style={styles.input} value={formData.principal_name} onChangeText={t => setFormData({ ...formData, principal_name: t })} />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Affiliation (e.g. CBSE, ICSE)</Text>
                                <TextInput style={styles.input} value={formData.affiliation} onChangeText={t => setFormData({ ...formData, affiliation: t })} />
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Contact Details</Text>
                            <View style={styles.row}>
                                <View style={[styles.inputGroup, styles.half]}>
                                    <Text style={styles.label}>Mobile</Text>
                                    <TextInput style={styles.input} value={formData.mobile} onChangeText={t => setFormData({ ...formData, mobile: t })} keyboardType="phone-pad" />
                                </View>
                                <View style={[styles.inputGroup, styles.half]}>
                                    <Text style={styles.label}>Email</Text>
                                    <TextInput style={styles.input} value={formData.email} onChangeText={t => setFormData({ ...formData, email: t })} keyboardType="email-address" autoCapitalize="none" />
                                </View>
                            </View>
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Location & Address</Text>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Full Address</Text>
                                <TextInput style={[styles.input, styles.textArea]} value={formData.address} onChangeText={t => setFormData({ ...formData, address: t })} multiline />
                            </View>

                            <View style={styles.row}>
                                <View style={styles.half}>
                                    <Text style={styles.label}>State</Text>
                                    <TextInput style={styles.input} value={formData.state} onChangeText={t => setFormData({ ...formData, state: t })} />
                                </View>
                                <View style={styles.half}>
                                    <Text style={styles.label}>District</Text>
                                    <TextInput style={styles.input} value={formData.district} onChangeText={t => setFormData({ ...formData, district: t })} />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={styles.half}>
                                    <Text style={styles.label}>Pincode</Text>
                                    <TextInput style={styles.input} value={formData.pincode} onChangeText={t => setFormData({ ...formData, pincode: t })} keyboardType="numeric" />
                                </View>
                                <View style={styles.half}>
                                    <Text style={styles.label}>Landmark</Text>
                                    <TextInput style={styles.input} value={formData.landmark} onChangeText={t => setFormData({ ...formData, landmark: t })} />
                                </View>
                            </View>
                        </View>

                        <View style={styles.btnRow}>
                            <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleUpdate} disabled={saving}>
                                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Details</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => { setIsEditing(false); setLogo(null); setPrincipalPhoto(null); }}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={{ gap: 5 }}>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Basic Information</Text>
                            <DetailItem label="Institute Name" value={profile?.institute_name} icon="business-outline" />
                            <DetailItem label="Principal Name" value={profile?.principal_name} icon="person-outline" />
                            <DetailItem label="Affiliation" value={profile?.affiliation} icon="ribbon-outline" />
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Contact Details</Text>
                            <DetailItem label="Mobile Number" value={profile?.mobile} icon="call-outline" />
                            <DetailItem label="Email Address" value={profile?.email} icon="mail-outline" />
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Location & Address</Text>
                            <DetailItem label="Full Address" value={profile?.address} icon="location-outline" />
                            <DetailItem label="State" value={profile?.state} icon="map-outline" />
                            <DetailItem label="District" value={profile?.district} icon="trail-sign-outline" />
                            <DetailItem label="Pincode" value={profile?.pincode} icon="pin-outline" />
                            <DetailItem label="Landmark" value={profile?.landmark} icon="flag-outline" />
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const DetailItem = ({ label, value, icon }: any) => {
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
        detailValue: { color: theme.text, fontSize: 15, fontWeight: '700' },
    }), [theme]);

    return (
        <View style={dStyles.detailRow}>
            <View style={dStyles.iconCircle}>
                <Ionicons name={icon} size={18} color={theme.primary} />
            </View>
            <View style={dStyles.detailContent}>
                <Text style={dStyles.detailLabel}>{label}</Text>
                <Text style={dStyles.detailValue}>{value || 'Not provided'}</Text>
            </View>
        </View>
    );
};