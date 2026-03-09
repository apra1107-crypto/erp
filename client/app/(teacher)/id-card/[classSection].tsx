import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Image, ScrollView, Dimensions, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';
import IDCardPreview from '../../../components/IDCardPreview';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_SELECTION = 8;

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
    
    // Capture Ref & Student for off-screen rendering
    const captureViewRef = useRef<View>(null);
    const [captureStudent, setCaptureStudent] = useState<any>(null);

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
            setInstituteData(profileRes.data.teacher); // Teachers have institute info in their profile response
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
                    text2: `You can download up to ${MAX_SELECTION} ID cards at once.` 
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
            const firstEight = students.slice(0, MAX_SELECTION).map(s => s.id);
            setSelectedIds(new Set(firstEight));
            if (students.length > MAX_SELECTION) {
                Toast.show({ type: 'info', text1: 'Limited Selection', text2: `Selected first ${MAX_SELECTION} students.` });
            }
        }
    };

    const handleDownloadSelected = async () => {
        if (selectedIds.size === 0) return;

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
                
                // 1. Set current student for capture
                setCaptureStudent(student);
                
                // 2. Wait for state update and rendering
                await new Promise(resolve => setTimeout(resolve, 500));

                // 3. Capture the view
                const uri = await captureRef(captureViewRef.current, {
                    format: 'jpg',
                    quality: 0.9,
                    result: 'tmpfile'
                });

                // 4. Save to gallery (Download)
                await MediaLibrary.saveToLibraryAsync(uri);
            }

            Toast.show({ 
                type: 'success', 
                text1: 'Downloaded!', 
                text2: `${selectedStudents.length} ID cards saved to your Gallery.` 
            });

            setSelectionMode(false);
            setSelectedIds(new Set());
        } catch (error) {
            console.error('Download Error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to download ID images' });
        } finally {
            setProcessing(false);
            setCaptureStudent(null);
        }
    };

    const renderStudentItem = ({ item }: { item: any }) => {
        const isSelected = selectedIds.has(item.id);
        return (
            <TouchableOpacity 
                style={[
                    styles.studentCard, 
                    { backgroundColor: theme.card, borderColor: isSelected ? theme.primary : theme.border }
                ]}
                onPress={() => selectionMode ? toggleSelectOne(item.id) : setPreviewStudent(item)}
                activeOpacity={0.7}
            >
                <Image source={item.photo_url ? { uri: item.photo_url } : require('../../../assets/images/react-logo.png')} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.sName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.sInfo, { color: theme.textLight }]}>Roll No: {item.roll_no}</Text>
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
        header: { paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
        backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
        headerText: { marginLeft: 15, flex: 1 },
        title: { fontSize: 18, fontWeight: '800', color: theme.text },
        subtitle: { fontSize: 12, color: theme.textLight },

        modeBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.primary, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 2 },
        modeBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
        
        listContent: { padding: 20, paddingBottom: 120 },
        studentCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, elevation: 1 },
        avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 15 },
        sName: { fontSize: 15, fontWeight: '700' },
        sInfo: { fontSize: 12, fontWeight: '600', marginTop: 2 },
        checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' },

        footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: theme.card, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', gap: 12, paddingBottom: insets.bottom + 10, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 4 },
        selectAllBtn: { flex: 1, height: 50, borderRadius: 15, backgroundColor: isDark ? '#333' : '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
        generateBtn: { flex: 2, height: 50, borderRadius: 15, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
        btnText: { color: theme.text, fontWeight: '800' },
        genText: { color: '#fff', fontWeight: '800' },

        // Preview Modal
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
        modalContent: { backgroundColor: theme.card, width: '95%', borderRadius: 30, padding: 20, paddingBottom: 30, alignItems: 'center' },
        modalHeader: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        modalTitle: { fontSize: 18, fontWeight: '800', color: theme.text },

        // Capture Container (Off-screen)
        captureContainer: {
            position: 'absolute',
            left: -SCREEN_WIDTH * 3, 
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
                    style={[styles.modeBtn, selectionMode && { backgroundColor: theme.danger }]} 
                    onPress={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); }}
                >
                    <Ionicons name={selectionMode ? "close" : "cloud-download-outline"} size={18} color="#fff" />
                    <Text style={styles.modeBtnText}>{selectionMode ? "Cancel" : "Download IDs"}</Text>
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
                        <View style={{ marginBottom: 15, padding: 10, backgroundColor: theme.primary + '10', borderRadius: 12 }}>
                            <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
                                Select students to save to Gallery (Max {MAX_SELECTION})
                            </Text>
                        </View>
                    ) : null}
                />
            )}

            {selectionMode && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
                        <Text style={[styles.btnText, { color: theme.text }]}>
                            {selectedIds.size > 0 ? "Clear All" : "Select First 8"}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.generateBtn, { opacity: selectedIds.size === 0 ? 0.5 : 1 }]} 
                        onPress={handleDownloadSelected} 
                        disabled={processing || selectedIds.size === 0}
                    >
                        {processing ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <Ionicons name="download-outline" size={20} color="#fff" />
                                <Text style={styles.genText}>Download ({selectedIds.size})</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

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
                            Downloading IDs
                        </Text>
                        <Text style={{ marginTop: 8, fontSize: 14, color: theme.textLight, textAlign: 'center' }}>
                            Saving to Gallery...{"\n"}
                            Progress: {processStatus.current} / {processStatus.total}
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}
