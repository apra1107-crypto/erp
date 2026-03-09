import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image, ScrollView, Dimensions, Modal, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS, BASE_URL } from '../../../constants/Config';
import IDCardPreview from '../../../components/IDCardPreview';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_SELECTION = 20; // Increased for PDF support

export default function IDCardStudentSelection() {
    const { classSection, className, section } = useLocalSearchParams();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [instituteData, setInstituteData] = useState<any>(null);
    const [previewStudent, setPreviewStudent] = useState<any>(null);

    // Selection & Download States
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set<number>());
    const [processing, setProcessing] = useState(false);
    const [processStatus, setProcessStatus] = useState({ current: 0, total: 0 });
    const [showExportModal, setShowExportModal] = useState(false);
    
    // Capture Ref & Student for off-screen rendering
    const captureViewRef = useRef<View>(null);
    const [captureStudent, setCaptureStudent] = useState<any>(null);

    useEffect(() => {
        fetchStudents();
    }, [classSection]);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            const [studentRes, profileRes] = await Promise.all([
                axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API_ENDPOINTS.PRINCIPAL}/profile`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            
            const allStudents = studentRes.data.students || [];
            const filtered = allStudents.filter((s: any) => `${s.class}-${s.section}` === classSection);
            setStudents(filtered);
            setInstituteData(profileRes.data.profile);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load data' });
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectOne = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            if (next.size >= MAX_SELECTION) {
                Toast.show({ 
                    type: 'info', 
                    text1: 'Limit Reached', 
                    text2: `You can export up to ${MAX_SELECTION} ID cards at once.` 
                });
                return;
            }
            next.add(id);
        }
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size > 0) {
            setSelectedIds(new Set());
        } else {
            const count = Math.min(students.length, MAX_SELECTION);
            const selected = students.slice(0, count).map(s => s.id);
            setSelectedIds(new Set(selected));
            if (students.length > MAX_SELECTION) {
                Toast.show({ type: 'info', text1: 'Limited Selection', text2: `Selected first ${MAX_SELECTION} students.` });
            }
        }
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
            console.warn("Base64 conversion failed for:", url);
            return null;
        }
    };

    const handleGeneratePDF = async () => {
        setShowExportModal(false);
        if (selectedIds.size === 0) return;

        try {
            setProcessing(true);
            const selectedStudents = students.filter(s => selectedIds.has(s.id));
            setProcessStatus({ current: 0, total: selectedStudents.length });

            const instLogoB64 = await toBase64(instituteData?.logo_url || instituteData?.institute_logo);
            const processedStudents = [];

            for (let i = 0; i < selectedStudents.length; i++) {
                setProcessStatus({ current: i + 1, total: selectedStudents.length });
                const student = selectedStudents[i];
                const photoB64 = student.photo_url ? await toBase64(student.photo_url) : null;
                processedStudents.push({ ...student, photoB64 });
            }

            const instAddress = [
                instituteData?.institute_address || instituteData?.address,
                instituteData?.landmark,
                instituteData?.district,
                instituteData?.state,
                instituteData?.pincode
            ].filter(Boolean).join(' ');

            let htmlContent = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <style>
                        @page { size: A4; margin: 0; }
                        body { font-family: 'Helvetica', Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
                        .page-container {
                            width: 210mm;
                            height: 297mm;
                            padding: 20mm 15mm;
                            box-sizing: border-box;
                            page-break-after: always;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                        }
                        
                        .id-card {
                            width: 175mm;
                            height: 105mm;
                            margin-bottom: 15mm;
                            background: #fff;
                            border: 1.5px solid #000;
                            border-radius: 12px;
                            overflow: hidden;
                            position: relative;
                            box-sizing: border-box;
                        }

                        .header-strip {
                            background: linear-gradient(to right, #667eea, #764ba2);
                            height: 15mm;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding: 0 15px;
                            gap: 12px;
                            -webkit-print-color-adjust: exact;
                        }

                        .inst-logo { width: 10mm; height: 10mm; border-radius: 50%; background: #fff; object-fit: contain; }
                        .inst-name { color: #fff; font-size: 18px; font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; }

                        .sub-header {
                            background: #fff;
                            border-bottom: 1px solid #e2e8f0;
                            padding: 5px;
                            text-align: center;
                            font-size: 8px;
                            font-weight: 900;
                            color: #000;
                            text-transform: uppercase;
                        }

                        .card-body {
                            padding: 15px 25px;
                            display: flex;
                            gap: 25px;
                        }

                        .left-col { flex: 1; }
                        .label { font-size: 7px; font-weight: 900; color: #000; text-transform: uppercase; margin-bottom: 2px; }
                        .student-name-val { font-size: 20px; font-weight: 900; color: #000; text-transform: uppercase; margin-bottom: 10px; }
                        
                        .stats-row { display: flex; gap: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
                        .stat-val { font-size: 14px; font-weight: 900; color: #000; }

                        .details-grid { display: flex; flex-wrap: wrap; gap: 10px; }
                        .detail-item { width: 45%; }
                        .detail-val { font-size: 11px; font-weight: 900; color: #000; }

                        .right-col { width: 130px; display: flex; flex-direction: column; align-items: center; }
                        .photo-box { width: 115px; height: 130px; border: 1.5px solid #e2e8f0; border-radius: 8px; background: #f8fafc; overflow: hidden; }
                        .photo-img { width: 100%; height: 100%; object-fit: cover; }

                        .footer-strip {
                            position: absolute;
                            bottom: 0;
                            width: 100%;
                            height: 10mm;
                            border-top: 1.5px solid #e2e8f0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 13px;
                            font-weight: 900;
                            letter-spacing: 2px;
                            color: #000;
                        }
                    </style>
                </head>
                <body>
            `;

            for (let i = 0; i < processedStudents.length; i += 2) {
                htmlContent += `<div class="page-container">`;
                
                const s1 = processedStudents[i];
                htmlContent += `
                    <div class="id-card">
                        <div class="header-strip">
                            ${instLogoB64 ? `<img src="${instLogoB64}" class="inst-logo" />` : ''}
                            <h1 class="inst-name">${instituteData?.institute_name || 'INSTITUTE'}</h1>
                        </div>
                        <div class="sub-header">${instAddress}</div>
                        <div class="card-body">
                            <div class="left-col">
                                <div class="label">Student Name</div>
                                <div class="student-name-val">${s1.name}</div>
                                <div class="stats-row">
                                    <div style="flex:1"><div class="label">Class</div><div class="stat-val">${s1.class}</div></div>
                                    <div style="flex:1"><div class="label">Sec</div><div class="stat-val">${s1.section}</div></div>
                                    <div style="flex:1"><div class="label">Roll</div><div class="stat-val">${s1.roll_no || 'TBD'}</div></div>
                                </div>
                                <div class="details-grid">
                                    <div class="detail-item"><div class="label">Father</div><div class="detail-val">${s1.father_name}</div></div>
                                    <div class="detail-item"><div class="label">Mother</div><div class="detail-val">${s1.mother_name || 'N/A'}</div></div>
                                    <div class="detail-item"><div class="label">DOB</div><div class="detail-val">${s1.dob || 'N/A'}</div></div>
                                    <div class="detail-item"><div class="label">Contact</div><div class="detail-val">${s1.mobile}</div></div>
                                    <div style="width: 100%; margin-top: 5px;">
                                        <div class="label">Address</div>
                                        <div class="detail-val" style="font-size: 9px; line-height: 1.2;">${s1.address}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="right-col">
                                <div class="photo-box">
                                    ${s1.photoB64 ? `<img src="${s1.photoB64}" class="photo-img" />` : '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#94a3b8;">NO PHOTO</div>'}
                                </div>
                            </div>
                        </div>
                        <div class="footer-strip">STUDENT IDENTITY CARD</div>
                    </div>
                `;

                if (processedStudents[i + 1]) {
                    const s2 = processedStudents[i + 1];
                    htmlContent += `
                        <div class="id-card">
                            <div class="header-strip">
                                ${instLogoB64 ? `<img src="${instLogoB64}" class="inst-logo" />` : ''}
                                <h1 class="inst-name">${instituteData?.institute_name || 'INSTITUTE'}</h1>
                            </div>
                            <div class="sub-header">${instAddress}</div>
                            <div class="card-body">
                                <div class="left-col">
                                    <div class="label">Student Name</div>
                                    <div class="student-name-val">${s2.name}</div>
                                    <div class="stats-row">
                                        <div style="flex:1"><div class="label">Class</div><div class="stat-val">${s2.class}</div></div>
                                        <div style="flex:1"><div class="label">Sec</div><div class="stat-val">${s2.section}</div></div>
                                        <div style="flex:1"><div class="label">Roll</div><div class="stat-val">${s2.roll_no || 'TBD'}</div></div>
                                    </div>
                                    <div class="details-grid">
                                        <div class="detail-item"><div class="label">Father</div><div class="detail-val">${s2.father_name}</div></div>
                                        <div class="detail-item"><div class="label">Mother</div><div class="detail-val">${s2.mother_name || 'N/A'}</div></div>
                                        <div class="detail-item"><div class="label">DOB</div><div class="detail-val">${s2.dob || 'N/A'}</div></div>
                                        <div class="detail-item"><div class="label">Contact</div><div class="detail-val">${s2.mobile}</div></div>
                                        <div style="width: 100%; margin-top: 5px;">
                                            <div class="label">Address</div>
                                            <div class="detail-val" style="font-size: 9px; line-height: 1.2;">${s2.address}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="right-col">
                                    <div class="photo-box">
                                        ${s2.photoB64 ? `<img src="${s2.photoB64}" class="photo-img" />` : '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#94a3b8;">NO PHOTO</div>'}
                                    </div>
                                </div>
                            </div>
                            <div class="footer-strip">STUDENT IDENTITY CARD</div>
                        </div>
                    `;
                }
                
                htmlContent += `</div>`;
            }

            htmlContent += `</body></html>`;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Student ID Cards Bundle',
                UTI: 'com.adobe.pdf'
            });

            setSelectionMode(false);
            setSelectedIds(new Set());
        } catch (error) {
            console.error('PDF Error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to generate PDF bundle' });
        } finally {
            setProcessing(false);
        }
    };

    const handleDownloadJPG = async () => {
        setShowExportModal(false);
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
            Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Media library access is required.' });
            return;
        }

        try {
            setProcessing(true);
            const selectedStudents = students.filter(s => selectedIds.has(s.id));
            setProcessStatus({ current: 0, total: selectedStudents.length });

            for (let i = 0; i < selectedStudents.length; i++) {
                const student = selectedStudents[i];
                setProcessStatus({ current: i + 1, total: selectedStudents.length });
                
                setCaptureStudent(student);
                await new Promise(resolve => setTimeout(resolve, 600));

                const uri = await captureRef(captureViewRef.current, {
                    format: 'jpg',
                    quality: 0.9,
                    result: 'tmpfile'
                });

                await MediaLibrary.saveToLibraryAsync(uri);
            }

            Toast.show({ 
                type: 'success', 
                text1: 'Downloaded!', 
                text2: `${selectedStudents.length} ID cards saved to Gallery.` 
            });

            setSelectionMode(false);
            setSelectedIds(new Set());
        } catch (error) {
            console.error('JPG Download Error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save individual images' });
        } finally {
            setProcessing(false);
            setCaptureStudent(null);
        }
    };

    const renderStudentItem = ({ item }: { item: any }) => {
        const isSelected = selectedIds.has(item.id);
        const photoUri = getFullImageUrl(item.photo_url);
        return (
            <TouchableOpacity 
                style={[
                    styles.studentCard, 
                    { backgroundColor: theme.card, borderColor: isSelected ? theme.primary : theme.border }
                ]}
                onPress={() => selectionMode ? toggleSelectOne(item.id) : setPreviewStudent(item)}
                activeOpacity={0.7}
            >
                <Image 
                    source={photoUri ? { uri: photoUri } : require('../../../assets/images/react-logo.png')} 
                    style={styles.avatar} 
                />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.sInfo, { color: theme.textLight }]}>Roll No: {item.roll_no || 'N/A'}</Text>
                </View>
                {selectionMode ? (
                    <View style={[styles.checkbox, isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                ) : (
                    <Ionicons name="chevron-forward" size={18} color={theme.border} />
                )}
            </TouchableOpacity>
        );
    };

    const styles = StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 },
        headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
        backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, elevation: 2 },
        headerText: { marginLeft: 15, flex: 1 },
        title: { fontSize: 20, fontWeight: '900', color: theme.text },
        subtitle: { fontSize: 13, color: theme.textLight, fontWeight: '600' },

        modeBtn: { 
            paddingHorizontal: 20, 
            paddingVertical: 12, 
            borderRadius: 16, 
            backgroundColor: theme.primary, 
            flexDirection: 'row', 
            alignItems: 'center', 
            gap: 10, 
            elevation: 8, 
            shadowColor: theme.primary, 
            shadowOffset: { width: 0, height: 4 }, 
            shadowOpacity: 0.4, 
            shadowRadius: 8 
        },
        modeBtnText: { color: '#fff', fontSize: 15, fontWeight: '900' },
        
        listContent: { padding: 20, paddingBottom: 150 },
        studentCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginBottom: 14, borderWidth: 1, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
        avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, borderWidth: 1, borderColor: theme.border },
        sName: { fontSize: 16, fontWeight: '800' },
        sInfo: { fontSize: 13, fontWeight: '600', marginTop: 2 },
        checkbox: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' },

        footer: { 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            padding: 20, 
            backgroundColor: theme.card, 
            borderTopWidth: 1, 
            borderTopColor: theme.border, 
            flexDirection: 'row', 
            gap: 15, 
            paddingBottom: insets.bottom + 15, 
            elevation: 25, 
            shadowColor: '#000', 
            shadowOffset: { width: 0, height: -12 }, 
            shadowOpacity: 0.25, 
            shadowRadius: 15 
        },
        selectAllBtn: { flex: 1, height: 60, borderRadius: 18, backgroundColor: isDark ? '#333' : '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
        generateBtn: { 
            flex: 2, 
            height: 60, 
            borderRadius: 18, 
            backgroundColor: theme.primary, 
            justifyContent: 'center', 
            alignItems: 'center', 
            flexDirection: 'row', 
            gap: 12, 
            elevation: 10, 
            shadowColor: theme.primary, 
            shadowOffset: { width: 0, height: 5 }, 
            shadowOpacity: 0.4, 
            shadowRadius: 10 
        },
        btnText: { color: theme.text, fontWeight: '900', fontSize: 15 },
        genText: { color: '#fff', fontWeight: '900', fontSize: 17 },

        // Preview Modal
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
        modalContent: { backgroundColor: theme.card, width: '95%', borderRadius: 30, padding: 20, paddingBottom: 30, alignItems: 'center' },
        modalHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        modalTitle: { fontSize: 18, fontWeight: '800', color: theme.text },

        // Export Modal
        exportModal: { backgroundColor: theme.card, width: '90%', borderRadius: 25, padding: 25 },
        exportOption: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: theme.border },
        exportIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
        exportLabel: { fontSize: 17, fontWeight: '900', color: theme.text },
        exportDesc: { fontSize: 12, color: theme.textLight, marginTop: 4, lineHeight: 16 },

        // Capture Container (Off-screen)
        captureContainer: {
            position: 'absolute',
            left: -SCREEN_WIDTH * 4, 
            top: 0,
        }
    });

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <View style={styles.headerText}>
                        <Text style={styles.title} numberOfLines={1}>Grade {className}-{section}</Text>
                        <Text style={styles.subtitle}>{students.length} Students</Text>
                    </View>
                </View>
                <TouchableOpacity 
                    style={[styles.modeBtn, selectionMode && { backgroundColor: theme.danger, shadowColor: theme.danger }]} 
                    onPress={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); }}
                >
                    <Ionicons name={selectionMode ? "close" : "cloud-download-outline"} size={22} color="#fff" />
                    <Text style={styles.modeBtnText}>{selectionMode ? "Cancel" : "Export IDs"}</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : (
                <FlatList 
                    data={students}
                    renderItem={renderStudentItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={selectionMode ? (
                        <View style={{ marginBottom: 15, padding: 15, backgroundColor: theme.primary + '15', borderRadius: 15, borderLeftWidth: 4, borderLeftColor: theme.primary }}>
                            <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '800' }}>
                                Selection Mode Active
                            </Text>
                            <Text style={{ color: theme.textLight, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                                Select up to {MAX_SELECTION} students to bundle into a single PDF or save to Gallery.
                            </Text>
                        </View>
                    ) : null}
                />
            )}

            {selectionMode && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
                        <Text style={[styles.btnText, { color: theme.text }]}>
                            {selectedIds.size > 0 ? "Clear All" : `First ${Math.min(students.length, MAX_SELECTION)}`}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.generateBtn, { opacity: selectedIds.size === 0 ? 0.6 : 1 }]} 
                        onPress={() => selectedIds.size > 0 && setShowExportModal(true)} 
                        disabled={processing || selectedIds.size === 0}
                    >
                        {processing ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <Ionicons name="share-social-outline" size={22} color="#fff" />
                                <Text style={styles.genText}>Export Bundle ({selectedIds.size})</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Export Selection Modal */}
            <Modal visible={showExportModal} transparent animationType="slide" onRequestClose={() => setShowExportModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowExportModal(false)}>
                    <View style={styles.exportModal}>
                        <View style={{ width: 40, height: 4, backgroundColor: theme.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
                        <Text style={[styles.modalTitle, { marginBottom: 25, textAlign: 'center', fontSize: 22, fontWeight: '900' }]}>Choose Format</Text>
                        
                        <TouchableOpacity 
                            style={[styles.exportOption, { backgroundColor: isDark ? '#2D1B36' : '#F3E5F5', borderColor: '#AF52DE40' }]} 
                            onPress={handleGeneratePDF}
                        >
                            <View style={[styles.exportIcon, { backgroundColor: '#AF52DE' }]}>
                                <Ionicons name="document-text" size={32} color="#fff" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.exportLabel, { color: isDark ? '#fff' : '#2D1B36' }]}>PDF Bundle (A4)</Text>
                                <Text style={styles.exportDesc}>Single file, 2 IDs per page. Best for WhatsApp sharing & printing.</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.exportOption, { backgroundColor: isDark ? '#1B2C1B' : '#E8F5E9', borderColor: '#27AE6040' }]} 
                            onPress={handleDownloadJPG}
                        >
                            <View style={[styles.exportIcon, { backgroundColor: '#27AE60' }]}>
                                <Ionicons name="image" size={32} color="#fff" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.exportLabel, { color: isDark ? '#fff' : '#1B2C1B' }]}>Individual JPGs</Text>
                                <Text style={styles.exportDesc}>Save high-quality ID images directly to your phone Gallery.</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={{ marginTop: 10, padding: 18, alignItems: 'center', borderRadius: 15, backgroundColor: theme.background }} 
                            onPress={() => setShowExportModal(false)}
                        >
                            <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>Cancel Export</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ID Card Preview Modal */}
            <Modal visible={!!previewStudent} transparent animationType="fade" onRequestClose={() => setPreviewStudent(null)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPreviewStudent(null)}>
                    <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={e => e.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Identity Preview</Text>
                            <TouchableOpacity onPress={() => setPreviewStudent(null)}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <IDCardPreview 
                            student={previewStudent} 
                            institute={{
                                name: instituteData?.institute_name,
                                address: instituteData?.institute_address || instituteData?.address,
                                landmark: instituteData?.landmark,
                                district: instituteData?.district,
                                state: instituteData?.state,
                                pincode: instituteData?.pincode,
                                logo_url: instituteData?.logo_url || instituteData?.institute_logo
                            }}
                            template="landscape"
                        />
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Hidden Off-screen Capture Component */}
            <View 
                ref={captureViewRef} 
                style={styles.captureContainer}
                collapsable={false}
            >
                {captureStudent && (
                    <IDCardPreview 
                        student={captureStudent} 
                        institute={{
                            name: instituteData?.institute_name,
                            address: instituteData?.institute_address || instituteData?.address,
                            landmark: instituteData?.landmark,
                            district: instituteData?.district,
                            state: instituteData?.state,
                            pincode: instituteData?.pincode,
                            logo_url: instituteData?.logo_url || instituteData?.institute_logo
                        }}
                        template="landscape"
                    />
                )}
            </View>

            {/* Processing Overlay */}
            {processing && (
                <View style={[styles.modalOverlay, { zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                    <View style={[styles.modalContent, { width: 280, paddingVertical: 30 }]}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={{ marginTop: 20, fontSize: 18, fontWeight: '900', color: theme.text }}>
                            Processing IDs
                        </Text>
                        <Text style={{ marginTop: 8, fontSize: 14, color: theme.textLight, textAlign: 'center' }}>
                            Please wait...{'\n'}
                            {processStatus.current} / {processStatus.total}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}
