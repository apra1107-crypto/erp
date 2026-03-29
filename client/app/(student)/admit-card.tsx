import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
    StatusBar,
    Image,
    Platform,
    BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { API_ENDPOINTS, BASE_URL } from '../../constants/Config';
import { useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';

const { width } = Dimensions.get('window');

interface ClassSection {
    class: string | number;
    section: string;
}

interface ScheduleRow {
    date: string;
    day: string;
    subject: string;
    time: string;
}

interface AdmitCardEvent {
    id: string | number;
    exam_name: string;
    classes: ClassSection[];
    schedule: ScheduleRow[];
    institute_name: string;
    institute_logo?: string;
    institute_address?: string;
    district?: string;
    state?: string;
    pincode?: string;
    affiliation?: string;
    landmark?: string;
}

interface StudentData {
    id: string | number;
    name: string;
    roll_no: string;
    class: string | number;
    section: string;
    father_name: string;
    mobile: string;
    photo_url?: string;
}

const StudentAdmitCardScreen = () => {
    const navigation = useNavigation();
    const router = useRouter();
    const { id: deepLinkId } = useLocalSearchParams();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    
    const [loading, setLoading] = useState(true);
    const [admitCards, setAdmitCards] = useState<AdmitCardEvent[]>([]);
    const [studentData, setStudentData] = useState<StudentData | null>(null);
    const [selectedCard, setSelectedCard] = useState<AdmitCardEvent | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'preview'>('list');
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    useEffect(() => {
        loadData();
    }, [deepLinkId]);

    useEffect(() => {
        const backAction = () => {
            if (viewMode === 'preview') {
                setViewMode('list');
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [viewMode]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [storedStudentData, token, storedSessionId] = await Promise.all([
                AsyncStorage.getItem('studentData'),
                AsyncStorage.getItem('studentToken'),
                AsyncStorage.getItem('selectedSessionId')
            ]);

            if (storedStudentData) {
                setStudentData(JSON.parse(storedStudentData));
            }

            const student = storedStudentData ? JSON.parse(storedStudentData) : null;
            const sessionId = storedSessionId || (student ? student.current_session_id : null);

            const response = await axios.get(`${API_ENDPOINTS.ADMIT_CARD}/my-cards`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            const cards = response.data || [];
            setAdmitCards(cards);

            // Handle deep linking from notification
            if (deepLinkId && cards.length > 0) {
                const targetCard = cards.find((c: any) => String(c.id) === String(deepLinkId));
                if (targetCard) {
                    setSelectedCard(targetCard);
                    setViewMode('preview');
                }
            }
        } catch (error) {
            console.error('Error loading admit cards:', error);
            Toast.show({ type: 'error', text1: 'Failed to load admit cards' });
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    const getFullImageUrl = (url: string | null | undefined): string | null => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const toBase64 = async (url: string | null | undefined) => {
        if (!url) return null;
        try {
            const fullUrl = getFullImageUrl(url);
            if (!fullUrl) return null;
            const response = await fetch(fullUrl);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            return null;
        }
    };

    const generatePDF = async () => {
        if (!selectedCard || !studentData) return;

        try {
            setIsGeneratingPDF(true);
            const token = await AsyncStorage.getItem('studentToken');
            
            // 1. Call the new Professional Backend API
            const response = await axios.get(
                `${API_ENDPOINTS.ADMIT_CARD}/generate-student-pdf/${selectedCard.id}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'arraybuffer',
                    timeout: 60000 
                }
            );

            // Efficient ArrayBuffer to Base64 conversion using chunking for large files
            const arrayBuffer = response.data; // This is the ArrayBuffer
            const chunkSize = 16 * 1024; // Process in 16KB chunks (adjust as needed)
            let base64 = '';
            const bytes = new Uint8Array(arrayBuffer);
            const len = bytes.byteLength;

            for (let i = 0; i < len; i += chunkSize) {
                const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
                base64 += String.fromCharCode.apply(null, Array.from(chunk));
            }
            const base64data = btoa(base64);

            const fileName = `admit_card_${selectedCard.id}_${Date.now()}.pdf`;
            const fileUri = `${cacheDirectory}${fileName}`;

            // 3. Write and Share
            await writeAsStringAsync(fileUri, base64data, {
                encoding: 'base64',
            });

            await Sharing.shareAsync(fileUri, {
                UTI: '.pdf',
                mimeType: 'application/pdf',
                dialogTitle: 'My Admit Card'
            });

        } catch (error: any) {
            console.error('Student Admit Card PDF Error:', error.message);
            Alert.alert('Error', 'Failed to generate professional admit card. Please try again.');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { 
            flexDirection: 'row', 
            alignItems: 'center', 
            paddingHorizontal: 24, 
            paddingTop: insets.top + 10, 
            paddingBottom: 15, 
            backgroundColor: 'transparent' 
        },
        backBtn: { 
            width: 40, 
            height: 40, 
            borderRadius: 12, 
            backgroundColor: isDark ? '#333' : '#f4f4f5', 
            justifyContent: 'center', 
            alignItems: 'center' 
        },
        headerTitle: { fontSize: 24, fontWeight: '900', color: theme.text, letterSpacing: -0.5, marginLeft: 16 },
        listContent: { padding: 20 },
        card: { 
            backgroundColor: theme.card, 
            borderRadius: 24, 
            padding: 20, 
            marginBottom: 16, 
            borderWidth: 1, 
            borderColor: theme.border, 
            elevation: 4, 
            shadowColor: '#000', 
            shadowOffset: { width: 0, height: 4 }, 
            shadowOpacity: isDark ? 0.3 : 0.05, 
            shadowRadius: 12, 
            flexDirection: 'row', 
            alignItems: 'center' 
        },
        cardIcon: { 
            width: 56, 
            height: 56, 
            borderRadius: 18, 
            backgroundColor: isDark ? theme.primary + '20' : theme.primary + '10', 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginRight: 16 
        },
        cardTitle: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 4 },
        cardSubtitle: { fontSize: 13, color: theme.textLight, fontWeight: '600' },
        emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
        emptyText: { fontSize: 16, color: theme.textLight, marginTop: 15, fontWeight: '600' },
        
        // Preview Styles
        previewScroll: { flex: 1, backgroundColor: isDark ? theme.background : '#f0f2f5' },
        previewContainer: { padding: 20, alignItems: 'center' },
        admitCardPaper: {
            width: width - 40,
            backgroundColor: '#fff', // Keep paper white for traditional look
            padding: 24,
            borderWidth: 2,
            borderColor: '#000',
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 15,
        },
        paperHeader: { alignItems: 'center', paddingBottom: 15, marginBottom: 20 },
        paperInstName: { fontSize: 22, fontWeight: '900', color: '#000', textAlign: 'center', textTransform: 'uppercase' },
        paperInstSub: { fontSize: 11, color: '#333', textAlign: 'center', marginTop: 4, fontWeight: '600' },
        paperExamTitle: { fontSize: 18, fontWeight: '900', color: '#000', borderWidth: 1, borderColor: '#000', paddingHorizontal: 15, paddingVertical: 5, marginTop: 15, textTransform: 'uppercase' },
        paperInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
        paperTable: { flex: 1, marginRight: 15 },
        paperTableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#eee', paddingVertical: 5 },
        paperLabel: { width: 100, fontSize: 10, fontWeight: 'bold', color: '#555' },
        paperValue: { flex: 1, fontSize: 12, fontWeight: '900', color: '#000' },
        paperPhoto: { width: 100, height: 120, borderWidth: 1, borderColor: '#000', backgroundColor: '#f9f9f9', justifyContent: 'center', alignItems: 'center' },
        paperTimetable: { marginBottom: 20 },
        paperTableTitle: { fontSize: 12, fontWeight: '900', textDecorationLine: 'underline', marginBottom: 10, color: '#000' },
        paperGrid: { borderWidth: 1.5, borderColor: '#000' },
        paperGridHeader: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderBottomWidth: 1.5, borderBottomColor: '#000' },
        paperGridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000' },
        paperGridCell: { padding: 8, borderRightWidth: 1, borderRightColor: '#000', flex: 1 },
        paperGridText: { fontSize: 10, fontWeight: 'bold', color: '#000' },
        paperInstructions: { borderWidth: 1, borderColor: '#000', padding: 10, borderRadius: 4 },
        paperInstTitle: { fontSize: 10, fontWeight: '900', textDecorationLine: 'underline', marginBottom: 5 },
        paperInstItem: { fontSize: 9, fontWeight: '700', color: '#333', marginBottom: 2 },
        paperFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 50, paddingHorizontal: 20 },
        paperSigLine: { borderTopWidth: 1, borderTopColor: '#000', width: 120, alignItems: 'center', paddingTop: 5 },
        paperSigText: { fontSize: 9, fontWeight: '900' },
        
        loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
    }), [theme, isDark]);

    const renderList = () => (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Admit Cards</Text>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : admitCards.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="document-text-outline" size={80} color={theme.border} />
                    <Text style={styles.emptyText}>No examination admit cards yet</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.listContent}>
                    {admitCards.map((card) => (
                        <TouchableOpacity
                            key={card.id}
                            style={styles.card}
                            onPress={() => {
                                setSelectedCard(card);
                                setViewMode('preview');
                            }}
                        >
                            <View style={styles.cardIcon}>
                                <Ionicons name="school" size={24} color={theme.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>{card.exam_name}</Text>
                                <Text style={styles.cardSubtitle}>{card.institute_name}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );

    const renderPreview = () => (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setViewMode('list')}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { flex: 1 }]} numberOfLines={1}>Admit Card Preview</Text>
                <TouchableOpacity 
                    onPress={generatePDF} 
                    style={[styles.backBtn, { backgroundColor: theme.primary }]}
                    disabled={isGeneratingPDF}
                >
                    {isGeneratingPDF ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Ionicons name="download-outline" size={24} color="#fff" />
                    )}
                </TouchableOpacity>
            </View>

            {isGeneratingPDF && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={{ color: '#fff', marginTop: 15, fontWeight: '900' }}>Generating PDF...</Text>
                </View>
            )}

            <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.previewContainer}>
                    <View style={styles.admitCardPaper}>
                        {/* Professional Header Section */}
                        <View style={styles.paperHeader}>
                            {/* Logo and Name Row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 5, marginTop: -10 }}>
                                {selectedCard?.institute_logo ? (
                                        <Image 
                                            source={{ uri: getFullImageUrl(selectedCard.institute_logo) || '' }} 
                                            style={{ width: 50, height: 50, resizeMode: 'contain', marginRight: 12, marginTop: 12 }} 
                                        />
                                    ) : null}
                                <Text 
                                    style={[styles.paperInstName, { flexShrink: 1 }]} 
                                    numberOfLines={1} 
                                    adjustsFontSizeToFit
                                >
                                    {(selectedCard?.institute_name || 'INSTITUTE NAME').toUpperCase()}
                                </Text>
                            </View>
                            
                            {/* Affiliation Row */}
                            {selectedCard?.affiliation && (
                                <Text style={{ 
                                    fontSize: 9.5, 
                                    fontWeight: '700', 
                                    color: '#333', 
                                    marginTop: -25, 
                                    paddingLeft: 50,
                                    textAlign: 'center', 
                                    marginBottom: 8
                                }}>
                                    {selectedCard.affiliation}
                                </Text>
                            )}

                            {/* Detailed Address Row */}
                            <Text style={[styles.paperInstSub, { fontSize: 9.5, marginTop: -8, paddingLeft: 40 }]}>
                                {selectedCard?.institute_address}
                                {selectedCard?.landmark ? ` ${selectedCard.landmark}` : ''}
                                {"\n"}{selectedCard?.district} {selectedCard?.state} {selectedCard?.pincode}
                            </Text>

                            <View style={{ width: '100%', height: 2, backgroundColor: '#000', marginTop: 15 }} />
                            
                            <Text style={styles.paperExamTitle}>{selectedCard?.exam_name}</Text>
                        </View>

                        {/* Student Info Section */}
                        <View style={styles.paperInfoRow}>
                            <View style={styles.paperTable}>
                                <View style={styles.paperTableRow}><Text style={styles.paperLabel}>STUDENT NAME</Text><Text style={styles.paperValue}>{studentData?.name}</Text></View>
                                <View style={styles.paperTableRow}><Text style={styles.paperLabel}>CLASS & SECTION</Text><Text style={styles.paperValue}>{studentData?.class} - {studentData?.section}</Text></View>
                                <View style={styles.paperTableRow}><Text style={styles.paperLabel}>ROLL NUMBER</Text><Text style={styles.paperValue}>{studentData?.roll_no || 'TBD'}</Text></View>
                                <View style={styles.paperTableRow}><Text style={styles.paperLabel}>FATHER'S NAME</Text><Text style={styles.paperValue}>{studentData?.father_name}</Text></View>
                                <View style={styles.paperTableRow}><Text style={styles.paperLabel}>MOBILE NO.</Text><Text style={styles.paperValue}>{studentData?.mobile}</Text></View>
                            </View>
                            <View style={styles.paperPhoto}>
                                {studentData?.photo_url && getFullImageUrl(studentData.photo_url) ? (
                                    <Image source={{ uri: getFullImageUrl(studentData.photo_url) as string }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <Text style={{ fontSize: 8, textAlign: 'center' }}>AFFIX PHOTO</Text>
                                )}
                            </View>
                        </View>

                        {/* Timetable */}
                        <View style={styles.paperTimetable}>
                            <Text style={styles.paperTableTitle}>EXAMINATION TIMETABLE</Text>
                            <View style={styles.paperGrid}>
                                <View style={styles.paperGridHeader}>
                                    <View style={styles.paperGridCell}><Text style={styles.paperGridText}>DATE & DAY</Text></View>
                                    <View style={styles.paperGridCell}><Text style={styles.paperGridText}>SUBJECT</Text></View>
                                    <View style={styles.paperGridCell}><Text style={styles.paperGridText}>TIME / SHIFT</Text></View>
                                </View>
                                {selectedCard?.schedule.map((row, idx) => (
                                    <View key={idx} style={styles.paperGridRow}>
                                        <View style={styles.paperGridCell}><Text style={styles.paperGridText}>{`${String(formatDate(row.date)).trim()} (${String(row.day).trim()})`}</Text></View>
                                        <View style={styles.paperGridCell}><Text style={styles.paperGridText}>{row.subject}</Text></View>
                                        <View style={styles.paperGridCell}><Text style={styles.paperGridText}>{row.time}</Text></View>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Instructions */}
                        <View style={styles.paperInstructions}>
                            <Text style={styles.paperInstTitle}>IMPORTANT INSTRUCTIONS:</Text>
                            <Text style={styles.paperInstItem}>1. Candidate must carry this Admit Card to the examination hall for all papers.</Text>
                            <Text style={styles.paperInstItem}>2. Possession of mobile phones, electronic gadgets, or calculators is strictly prohibited.</Text>
                            <Text style={styles.paperInstItem}>3. Candidates must report at the examination center at least 20 minutes before time.</Text>
                            <Text style={styles.paperInstItem}>4. Ensure invigilator signature on this card during every examination session.</Text>
                        </View>

                        {/* Footer Signatures */}
                        <View style={styles.paperFooter}>
                            <View style={styles.paperSigLine}>
                                <Text style={styles.paperSigText}>TEACHER'S SIGNATURE</Text>
                            </View>
                            <View style={styles.paperSigLine}>
                                <Text style={styles.paperSigText}>PRINCIPAL'S SIGNATURE</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {isGeneratingPDF && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={{ color: '#fff', marginTop: 15, fontWeight: 'bold' }}>Preparing High Quality PDF...</Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            <StatusBar barStyle={theme.statusBarStyle} />
            {viewMode === 'list' ? renderList() : renderPreview()}
        </View>
    );
};

export default StudentAdmitCardScreen;