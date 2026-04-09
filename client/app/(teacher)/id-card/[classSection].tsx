import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image, ScrollView, Dimensions, Modal, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS, BASE_URL } from '../../../constants/Config';
import { getFullImageUrl } from '../../../utils/imageHelper';
import IDCardPreview from '../../../components/IDCardPreview';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_SELECTION = 100;

export default function TeacherIDCardStudentSelection() {
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

    useEffect(() => {
        fetchStudents();
    }, [classSection]);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            const headers = { 
                Authorization: `Bearer ${token}`,
                'x-academic-session-id': sessionId?.toString()
            };

            const [studentRes, profileRes] = await Promise.all([
                axios.get(`${API_ENDPOINTS.TEACHER}/student/list`, { headers }),
                axios.get(`${API_ENDPOINTS.AUTH.TEACHER}/profile`, { headers })
            ]);
            
            const allStudents = studentRes.data.students || [];
            const filtered = allStudents.filter((s: any) => `${s.class}-${s.section}` === classSection);
            setStudents(filtered);
            setInstituteData(profileRes.data.teacher); 
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

    const handleGeneratePDF = async () => {
        setShowExportModal(false);
        if (selectedIds.size === 0) return;

        try {
            setProcessing(true);
            setProcessStatus({ current: 0, total: selectedIds.size });

            const token = await AsyncStorage.getItem('teacherToken');
            const response = await axios.post(`${API_ENDPOINTS.ID_CARD}/generate-bulk-pdf`, {
                studentIds: Array.from(selectedIds)
            }, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            const reader = new FileReader();
            reader.readAsDataURL(response.data);
            reader.onloadend = async () => {
                const base64data = (reader.result as string).split(',')[1];
                const fileName = `ID_Cards_Bundle_${Date.now()}.pdf`;
                const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
                
                await FileSystem.writeAsStringAsync(fileUri, base64data, { encoding: 'base64' });

                await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Student ID Cards Bundle',
                    UTI: 'com.adobe.pdf'
                });
            };

            setSelectionMode(false);
            setSelectedIds(new Set());
        } catch (error: any) {
            console.error('Server PDF Error:', error);
            Toast.show({ 
                type: 'error', 
                text1: 'Generation Failed', 
                text2: error.response?.data?.message || 'Server error generating professional IDs' 
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleDownloadJPG = async () => {
        setShowExportModal(false);
        if (selectedIds.size === 0) return;

        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
            Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Gallery access required.' });
            return;
        }

        try {
            setProcessing(true);
            const ids = Array.from(selectedIds);
            setProcessStatus({ current: 0, total: ids.length });

            const token = await AsyncStorage.getItem('teacherToken');

            for (let i = 0; i < ids.length; i++) {
                setProcessStatus({ current: i + 1, total: ids.length });
                
                const response = await axios.post(`${API_ENDPOINTS.ID_CARD}/generate-bulk-jpg`, {
                    studentIds: [ids[i]]
                }, {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'blob'
                });

                const reader = new FileReader();
                await new Promise((resolve, reject) => {
                    reader.readAsDataURL(response.data);
                    reader.onloadend = async () => {
                        try {
                            const base64data = (reader.result as string).split(',')[1];
                            const fileName = `ID_Card_${ids[i]}_${Date.now()}.jpg`;
                            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
                            
                            await FileSystem.writeAsStringAsync(fileUri, base64data, { encoding: 'base64' });
                            await MediaLibrary.saveToLibraryAsync(fileUri);
                            resolve(true);
                        } catch (e) { reject(e); }
                    };
                    reader.onerror = reject;
                });
            }

            Toast.show({ 
                type: 'success', 
                text1: 'Success!', 
                text2: `${ids.length} ID cards saved to Gallery.` 
            });

            setSelectionMode(false);
            setSelectedIds(new Set());
        } catch (error: any) {
            console.error('Server JPG Error:', error);
            Toast.show({ 
                type: 'error', 
                text1: 'Generation Failed', 
                text2: 'Server error generating professional images' 
            });
        } finally {
            setProcessing(false);
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
            bottom: 20, 
            left: 0, 
            right: 0, 
            paddingHorizontal: 20, 
            backgroundColor: 'transparent', 
            flexDirection: 'row', 
            gap: 12, 
            zIndex: 1000
        },
        selectAllBtn: { 
            flex: 1, 
            height: 56, 
            borderRadius: 18, 
            backgroundColor: theme.card, 
            justifyContent: 'center', 
            alignItems: 'center', 
            borderWidth: 1, 
            borderColor: theme.border,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8
        },
        generateBtn: { 
            flex: 1.5, 
            height: 56, 
            borderRadius: 18, 
            backgroundColor: theme.primary, 
            justifyContent: 'center', 
            alignItems: 'center', 
            flexDirection: 'row', 
            gap: 10, 
            elevation: 12, 
            shadowColor: theme.primary, 
            shadowOffset: { width: 0, height: 6 }, 
            shadowOpacity: 0.4, 
            shadowRadius: 12 
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

        // Processing Styles
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
        progressTextRow: { 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            marginTop: 10 
        },
        progressCount: { 
            fontSize: 13, 
            fontWeight: '700' 
        },
        progressPercent: { 
            fontSize: 14, 
            fontWeight: '900' 
        },
        processingHint: { 
            fontSize: 12, 
            textAlign: 'center', 
            lineHeight: 18, 
            fontWeight: '600', 
            paddingHorizontal: 10 
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
                            {selectedIds.size > 0 ? "Clear Selection" : "Select All Students"}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.generateBtn, { opacity: selectedIds.size === 0 ? 0.6 : 1 }]} 
                        onPress={() => selectedIds.size > 0 && setShowExportModal(true)} 
                        disabled={processing || selectedIds.size === 0}
                    >
                        {processing ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <Ionicons name="cloud-download" size={22} color="#fff" />
                                <Text style={styles.genText}>Download ({selectedIds.size})</Text>
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

            {/* Processing Overlay */}
            <Modal visible={processing} transparent animationType="fade">
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
                            Generating IDs
                        </Text>
                        
                        <View style={styles.progressContainer}>
                            <View style={[styles.progressBarBg, { backgroundColor: theme.border + '50' }]}>
                                <View 
                                    style={[
                                        styles.progressBarFill, 
                                        { 
                                            backgroundColor: theme.primary, 
                                            width: `${(processStatus.current / (processStatus.total || 1)) * 100}%` 
                                        }
                                    ]} 
                                />
                            </View>
                            <View style={styles.progressTextRow}>
                                <Text style={[styles.progressCount, { color: theme.textLight }]}>
                                    {processStatus.current} of {processStatus.total} Students
                                </Text>
                                <Text style={[styles.progressPercent, { color: theme.primary }]}>
                                    {Math.round((processStatus.current / (processStatus.total || 1)) * 100)}%
                                </Text>
                            </View>
                        </View>

                        <Text style={[styles.processingHint, { color: theme.textLight }]}>
                            Please do not close the app or lock your screen while we bundle your professional identity cards.
                        </Text>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}
