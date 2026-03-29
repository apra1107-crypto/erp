import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, ScrollView, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS, BASE_URL } from '../../constants/Config';
import IDCardPreview from '../../components/IDCardPreview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StudentIDCard() {
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [studentData, setStudentData] = useState<any>(null);
    const [instituteData, setInstituteData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('studentToken');
            const data = await AsyncStorage.getItem('studentData');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            
            if (!data) return;
            const parsedStudent = JSON.parse(data);
            const sessionId = storedSessionId || parsedStudent.current_session_id;

            // Fetch latest profile & institute info
            const response = await axios.get(`${API_ENDPOINTS.AUTH.STUDENT}/profile`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            
            const profile = response.data.student;
            setStudentData(profile);
            
            // Institute details
            setInstituteData({
                name: profile.institute_name,
                address: profile.institute_address || profile.address,
                landmark: profile.landmark,
                district: profile.district,
                state: profile.state,
                pincode: profile.pincode,
                logo_url: profile.institute_logo
            });
        } catch (error) {
            console.error('Error fetching student data:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load ID card data' });
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!studentData?.id) return;

        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
            Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Media library access is required.' });
            return;
        }

        try {
            setDownloading(true);
            const token = await AsyncStorage.getItem('studentToken');
            
            // Call server-side Puppeteer generation
            const response = await axios.post(`${API_ENDPOINTS.ID_CARD}/generate-bulk-jpg`, {
                studentIds: [studentData.id]
            }, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            // Convert Blob to Base64 to save as a local file
            const reader = new FileReader();
            await new Promise((resolve, reject) => {
                reader.readAsDataURL(response.data);
                reader.onloadend = async () => {
                    try {
                        const base64data = (reader.result as string).split(',')[1];
                        const fileName = `ID_Card_${studentData.id}_${Date.now()}.jpg`;
                        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
                        
                        await FileSystem.writeAsStringAsync(fileUri, base64data, { encoding: 'base64' });
                        await MediaLibrary.saveToLibraryAsync(fileUri);
                        resolve(true);
                    } catch (e) { reject(e); }
                };
                reader.onerror = reject;
            });

            Toast.show({ type: 'success', text1: 'Downloaded!', text2: 'Professional ID saved to Gallery.' });
        } catch (error) {
            console.error('Server JPG Error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to generate professional ID' });
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.card }]} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: theme.text }]}>Digital Identity</Text>
                    <Text style={[styles.subtitle, { color: theme.textLight }]}>Official Student Credential</Text>
                </View>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.previewSection}>
                    <View style={[styles.tag, { backgroundColor: theme.primary + '15' }]}>
                        <Text style={[styles.tagText, { color: theme.primary }]}>OFFICIAL PREVIEW</Text>
                    </View>
                    
                    <IDCardPreview 
                        student={studentData} 
                        institute={instituteData}
                        template="landscape"
                    />
                </View>

                <View style={[styles.instructionsBox, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }]}>
                    <View style={styles.instHeader}>
                        <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
                        <Text style={[styles.instTitle, { color: theme.text }]}>Digital ID Information</Text>
                    </View>
                    <Text style={[styles.instText, { color: theme.textLight }]}>
                        This is your official digital identity card generated by the institution. You can use this for digital verification. For a high-quality physical print, use the download button below to save a professional version to your gallery.
                    </Text>
                </View>

                <TouchableOpacity 
                    style={[styles.mainDownloadBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]} 
                    onPress={handleDownload}
                    disabled={downloading}
                >
                    <Ionicons name="cloud-download-outline" size={24} color="#fff" />
                    <Text style={styles.mainDownloadText}>
                        {downloading ? 'Preparing...' : 'Download Professional ID'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Processing Overlay */}
            <Modal visible={downloading} transparent animationType="fade">
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
                    <Animated.View 
                        entering={FadeInUp}
                        style={[styles.processingCard, { backgroundColor: theme.card }]}
                    >
                        <View style={styles.loaderWrapper}>
                            <ActivityIndicator size="large" color={theme.primary} />
                            <View style={styles.loaderIconInside}>
                                <Ionicons name="cloud-download" size={18} color={theme.primary} />
                            </View>
                        </View>
                        
                        <Text style={[styles.processingTitle, { color: theme.text }]}>
                            Generating ID
                        </Text>
                        
                        <View style={styles.progressContainer}>
                            <View style={[styles.progressBarBg, { backgroundColor: theme.border + '50' }]}>
                                <View 
                                    style={[
                                        styles.progressBarFill, 
                                        { 
                                            backgroundColor: theme.primary, 
                                            width: downloading ? '100%' : '0%' // It's a single ID so we just show activity
                                        }
                                    ]} 
                                />
                            </View>
                        </View>

                        <Text style={[styles.processingHint, { color: theme.textLight }]}>
                            Connecting to server to generate your professional, high-resolution identity card. Please wait...
                        </Text>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center' },
    backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    headerText: { flex: 1, marginLeft: 15 },
    title: { fontSize: 22, fontWeight: '900' },
    subtitle: { fontSize: 13, fontWeight: '600' },

    scrollContent: { padding: 20, alignItems: 'center', paddingBottom: 50 },
    previewSection: { width: '100%', alignItems: 'center', marginBottom: 25 },
    tag: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginBottom: 15 },
    tagText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },

    instructionsBox: { padding: 20, borderRadius: 24, width: '100%', marginBottom: 25 },
    instHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    instTitle: { fontSize: 16, fontWeight: '800' },
    instText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },

    mainDownloadBtn: { 
        width: '100%', 
        height: 60, 
        borderRadius: 20, 
        flexDirection: 'row', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: 12, 
        elevation: 12, 
        shadowOffset: { width: 0, height: 6 }, 
        shadowOpacity: 0.3, 
        shadowRadius: 10 
    },
    mainDownloadText: { color: '#fff', fontSize: 18, fontWeight: '900' },

    // Modal & Processing Styles
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    processingCard: { 
        width: '85%', 
        borderRadius: 32, 
        padding: 25, 
        alignItems: 'center', 
        elevation: 20, 
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 10 }, 
        shadowOpacity: 0.3, 
        shadowRadius: 20 
    },
    loaderWrapper: { 
        width: 80, 
        height: 80, 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    loaderIconInside: { 
        position: 'absolute', 
        justifyContent: 'center', 
        alignItems: 'center' 
    },
    processingTitle: { 
        fontSize: 20, 
        fontWeight: '900', 
        marginTop: 15, 
        textAlign: 'center' 
    },
    progressContainer: { 
        width: '100%', 
        marginTop: 25, 
        marginBottom: 20 
    },
    progressBarBg: { 
        height: 10, 
        borderRadius: 5, 
        width: '100%', 
        overflow: 'hidden' 
    },
    progressBarFill: { 
        height: '100%', 
        borderRadius: 5 
    },
    processingHint: { 
        fontSize: 12, 
        textAlign: 'center', 
        lineHeight: 18, 
        fontWeight: '600', 
        paddingHorizontal: 10 
    }
});
