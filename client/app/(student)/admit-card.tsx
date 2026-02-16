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
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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
            const [storedStudentData, token] = await Promise.all([
                AsyncStorage.getItem('studentData'),
                AsyncStorage.getItem('studentToken')
            ]);

            if (storedStudentData) {
                setStudentData(JSON.parse(storedStudentData));
            }

            const response = await axios.get(`${API_ENDPOINTS.ADMIT_CARD}/my-cards`, {
                headers: { Authorization: `Bearer ${token}` }
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
            const [instLogoB64, studentPhotoB64] = await Promise.all([
                toBase64(selectedCard.institute_logo),
                toBase64(studentData.photo_url)
            ]);

            const fullAddress = [
                selectedCard.institute_address,
                selectedCard.landmark,
                selectedCard.district,
                selectedCard.state,
                selectedCard.pincode
            ].filter(Boolean).join(' ');

            const htmlContent = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <style>
                        @page { size: A4; margin: 0; }
                        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 0; margin: 0; color: #333; background: #fff; }
                        
                        .page-container {
                            width: 210mm;
                            height: 297mm;
                            padding: 25px 35px;
                            box-sizing: border-box;
                            display: flex;
                            flex-direction: column;
                            background: #fff;
                        }
                        
                        .header-container { display: flex; flex-direction: row; align-items: center; justify-content: center; margin-bottom: 5px; }
                        .logo { width: 65px; height: 65px; margin-right: 15px; border-radius: 8px; }
                        .institute-info { text-align: center; }
                        
                        .institute-name { font-size: 28px; font-weight: 900; color: #1A237E; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
                        .affiliation-text { font-size: 13px; color: #444; margin: 0; margin-top: 4px; margin-left: 20px; font-weight: 700; }
                        .address-text { font-size: 12px; color: #666; margin-top: 4px; font-weight: 600; text-align: center; }
                        
                        .divider { height: 2px; background-color: #000; margin: 12px 0; }
                        
                        .exam-box { 
                            font-size: 22px; font-weight: 900; text-align: center; margin: 10px auto; 
                            text-transform: uppercase; padding: 8px 45px; border: 2.5px solid #000; display: table; 
                        }
                        
                        .details-section { display: flex; flex-direction: row; justify-content: space-between; margin: 20px 0; }
                        .info-table { width: 72%; border-collapse: collapse; }
                        .info-table td { padding: 8px 0; font-size: 15px; border-bottom: 1px solid #f0f0f0; }
                        .label { font-weight: bold; width: 170px; color: #555; font-size: 12px; text-transform: uppercase; }
                        .value { font-weight: 900; color: #000; font-size: 17px; }
                        
                        .photo-box { width: 130px; height: 160px; border: 2.5px solid #000; display: flex; align-items: center; justify-content: center; background: #fff; overflow: hidden; }
                        .photo-box img { width: 100%; height: 100%; object-fit: cover; }
                        
                        .timetable-section { width: 100%; margin-top: 10px; }
                        .section-title { font-weight: 900; text-decoration: underline; font-size: 14px; margin-bottom: 10px; }
                        
                        table.schedule { width: 100%; border-collapse: collapse; border: 2px solid #000; }
                        .schedule th { background-color: #f8f9fa; border: 1.5px solid #000; padding: 10px; text-align: left; font-size: 13px; font-weight: 900; }
                        .schedule td { border: 1.5px solid #000; padding: 10px; font-size: 13px; font-weight: bold; }
                        
                        .instructions { border: 2px solid #000; padding: 15px; border-radius: 8px; margin-top: 20px; background: #fafafa; }
                        .inst-title { font-weight: 900; font-size: 13px; text-decoration: underline; margin-bottom: 8px; }
                        .inst-list { font-size: 12px; font-weight: bold; margin: 0; padding-left: 20px; line-height: 1.4; }
                        
                        .signature-section { margin-top: auto; padding-top: 40px; display: flex; justify-content: space-between; padding-bottom: 20px; }
                        .sig-line { border-top: 2px solid #000; width: 200px; text-align: center; font-size: 12px; font-weight: 900; padding-top: 8px; text-transform: uppercase; }
                    </style>
                </head>
                <body>
                    <div class="page-container">
                        <div class="header-container">
                            ${instLogoB64 ? `<img src="${instLogoB64}" class="logo" />` : ''}
                            <div class="institute-info">
                                <h1 class="institute-name">${selectedCard.institute_name.toUpperCase()}</h1>
                                ${selectedCard.affiliation ? `<p class="affiliation-text">${selectedCard.affiliation}</p>` : ''}
                                <p class="address-text">${fullAddress}</p>
                            </div>
                        </div>

                        <div class="divider"></div>
                        
                        <div class="exam-box">${selectedCard.exam_name}</div>

                        <div class="details-section">
                            <table class="info-table">
                                <tr><td class="label">Student Name</td><td class="value">${studentData.name}</td></tr>
                                <tr><td class="label">Class & Section</td><td class="value">${studentData.class} - ${studentData.section}</td></tr>
                                <tr><td class="label">Roll Number</td><td class="value">${studentData.roll_no || 'TBD'}</td></tr>
                                <tr><td class="label">Father's Name</td><td class="value">${studentData.father_name}</td></tr>
                                <tr><td class="label">Contact Number</td><td class="value">${studentData.mobile}</td></tr>
                            </table>
                            <div class="photo-box">
                                ${studentPhotoB64 ? `<img src="${studentPhotoB64}" />` : '<div style="font-size: 10px; color: #999; font-weight: bold; text-align: center;">AFFIX PHOTO</div>'}
                            </div>
                        </div>

                        <div class="timetable-section">
                            <div class="section-title">EXAMINATION TIMETABLE</div>
                            <table class="schedule">
                                <thead>
                                    <tr>
                                        <th>Date & Day</th>
                                        <th>Subject Name</th>
                                        <th>Time / Shift</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${selectedCard.schedule.map(row => `
                                        <tr>
                                            <td>${formatDate(row.date)} (${row.day})</td>
                                            <td>${row.subject}</td>
                                            <td>${row.time}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div class="instructions">
                            <div class="inst-title">IMPORTANT INSTRUCTIONS:</div>
                            <ol class="inst-list">
                                <li>Candidate must carry this Admit Card to the examination hall for all sessions.</li>
                                <li>Possession of mobile phones, electronic gadgets, or calculators is strictly prohibited.</li>
                                <li>Candidates must report at the examination center at least 20 minutes before time.</li>
                                <li>The card must be signed by the invigilator during every examination session.</li>
                            </ol>
                        </div>

                        <div class="signature-section">
                            <div class="sig-line">TEACHER'S SIGNATURE</div>
                            <div class="sig-line">PRINCIPAL'S SIGNATURE</div>
                        </div>
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            
            if (Platform.OS === 'ios') {
                await Sharing.shareAsync(uri);
            } else {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Admit Card',
                    UTI: 'com.adobe.pdf'
                });
            }
        } catch (error) {
            console.error('PDF error:', error);
            Alert.alert('Error', 'Failed to generate PDF');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: theme.card },
        headerTitle: { fontSize: 22, fontWeight: 'bold', color: theme.text, marginLeft: 15 },
        listContent: { padding: 20 },
        card: { backgroundColor: theme.card, borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: theme.border, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, flexDirection: 'row', alignItems: 'center' },
        cardIcon: { width: 50, height: 50, borderRadius: 12, backgroundColor: isDark ? '#1a2a33' : '#e3f2fd', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
        cardTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 4 },
        cardSubtitle: { fontSize: 13, color: theme.textLight },
        emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
        emptyText: { fontSize: 16, color: theme.textLight, marginTop: 15 },
        
        // Preview Styles
        previewScroll: { flex: 1, backgroundColor: isDark ? '#000' : '#f0f2f5' },
        previewContainer: { padding: 20, alignItems: 'center' },
        admitCardPaper: {
            width: width - 40,
            backgroundColor: '#fff',
            padding: 20,
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
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Admit Cards</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
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
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setViewMode('list')}>
                    <Ionicons name="arrow-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { flex: 1 }]} numberOfLines={1}>Admit Card Preview</Text>
                <TouchableOpacity onPress={generatePDF} style={{ padding: 4 }}>
                    <Ionicons name="share-social-outline" size={24} color={theme.primary} />
                </TouchableOpacity>
            </View>

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
                                        <View style={styles.paperGridCell}><Text style={styles.paperGridText}>{formatDate(row.date)} (${row.day})</Text></View>
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