import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';
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

    // Ref for capturing the card
    const captureViewRef = useRef<View>(null);

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
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
            Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Media library access is required.' });
            return;
        }

        try {
            setDownloading(true);
            // Wait a bit for UI to be ready
            await new Promise(resolve => setTimeout(resolve, 300));

            const uri = await captureRef(captureViewRef.current, {
                format: 'jpg',
                quality: 0.9,
                result: 'tmpfile'
            });

            await MediaLibrary.saveToLibraryAsync(uri);
            Toast.show({ type: 'success', text1: 'Downloaded!', text2: 'ID Card saved to your Gallery.' });
        } catch (error) {
            console.error('Download Error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to download ID card' });
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.title}>Digital Identity</Text>
                    <Text style={styles.subtitle}>Official Student Credential</Text>
                </View>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.previewSection}>
                    <View style={styles.tag}>
                        <Text style={styles.tagText}>OFFICIAL PREVIEW</Text>
                    </View>
                    
                    {/* The Actual Preview Card */}
                    <IDCardPreview 
                        student={studentData} 
                        institute={instituteData}
                        template="landscape"
                    />

                    {/* Hidden Copy for high-res capture */}
                    <View style={styles.captureWrapper} collapsable={false}>
                        <View ref={captureViewRef} collapsable={false} style={{ backgroundColor: '#fff' }}>
                            <IDCardPreview 
                                student={studentData} 
                                institute={instituteData}
                                template="landscape"
                            />
                        </View>
                    </View>
                </View>

                <TouchableOpacity 
                    style={styles.mainDownloadBtn} 
                    onPress={handleDownload}
                    disabled={downloading}
                >
                    <Ionicons name="image-outline" size={24} color="#fff" />
                    <Text style={styles.mainDownloadText}>
                        {downloading ? 'Processing...' : 'Save to Gallery'}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', elevation: 2 },
    headerText: { flex: 1, marginLeft: 15 },
    title: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
    subtitle: { fontSize: 12, color: '#64748b' },
    downloadBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', elevation: 4 },

    scrollContent: { padding: 20, alignItems: 'center' },
    previewSection: { width: '100%', alignItems: 'center', marginBottom: 30 },
    tag: { backgroundColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginBottom: 15 },
    tagText: { fontSize: 10, fontWeight: '900', color: '#475569', letterSpacing: 1 },

    instructionsBox: { backgroundColor: '#fff', padding: 20, borderRadius: 24, width: '100%', marginBottom: 30, elevation: 2 },
    instHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    instTitle: { fontSize: 16, fontWeight: '800' },
    instText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },

    mainDownloadBtn: { width: '100%', height: 60, borderRadius: 20, backgroundColor: '#6366f1', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, elevation: 8, shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    mainDownloadText: { color: '#fff', fontSize: 18, fontWeight: '800' },

    captureWrapper: {
        position: 'absolute',
        left: -SCREEN_WIDTH * 4, // Move way off screen
        top: 0,
    }
});
