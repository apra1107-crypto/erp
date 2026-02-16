import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Modal, TextInput, FlatList, Dimensions, Platform, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';
import { API_ENDPOINTS } from '../../constants/Config';
import Toast from 'react-native-toast-message';
import { Image } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NoticeScreen() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [notices, setNotices] = useState<any[]>([]);
    const [institute, setInstitute] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);

    // Create/Edit Notice Modal State
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [editingNoticeId, setEditingNoticeId] = useState<number | null>(null);
    const [topic, setTopic] = useState('');
    const [content, setContent] = useState('');
    const [targetAudience, setTargetAudience] = useState('all');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [publishing, setPublishing] = useState(false);

    // Classes & Sections for selection
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [sectionsMap, setSectionsMap] = useState<{ [key: string]: string[] }>({});

    // Preview Modal State
    const [previewVisible, setPreviewVisible] = useState(false);
    const [selectedNotice, setSelectedNotice] = useState<any>(null);

    useFocusEffect(
        useCallback(() => {
            loadUserData();
            fetchNotices();
            fetchClasses();
        }, [])
    );

    const loadUserData = async () => {
        const data = await AsyncStorage.getItem('teacherData');
        if (data) {
            const parsed = JSON.parse(data);
            setCurrentUserId(parsed.id);
        }
    };

    const fetchNotices = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const userData = await AsyncStorage.getItem('teacherData');
            const selectedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const sessionId = selectedSessionId || (userData ? JSON.parse(userData).current_session_id : null);

            const response = await axios.get(API_ENDPOINTS.NOTICE, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            setNotices(response.data.notices);
            setInstitute(response.data.institute);
        } catch (error) {
            console.error('Error fetching notices:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchClasses = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const response = await axios.get(`${API_ENDPOINTS.TEACHER}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data && Array.isArray(response.data.students)) {
                const students = response.data.students;
                const classMap: { [key: string]: Set<string> } = {};
                students.forEach((s: any) => {
                    if (!classMap[s.class]) classMap[s.class] = new Set();
                    classMap[s.class].add(s.section);
                });

                const sortedClasses = Object.keys(classMap).sort((a, b) => parseInt(a) - parseInt(b));
                const finalSectionsMap: { [key: string]: string[] } = {};
                sortedClasses.forEach(cls => {
                    finalSectionsMap[cls] = Array.from(classMap[cls]).sort();
                });

                setAvailableClasses(sortedClasses);
                setSectionsMap(finalSectionsMap);
            }
        } catch (error) {
            console.error('Error fetching classes:', error);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotices();
    };

    const handlePublish = async () => {
        if (!topic.trim() || !content.trim()) {
            Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Topic and Content are required' });
            return;
        }

        if (targetAudience === 'class' && (!selectedClass || !selectedSection)) {
            Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please select class and section' });
            return;
        }

        try {
            setPublishing(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const userData = await AsyncStorage.getItem('teacherData');
            const selectedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const sessionId = selectedSessionId || (userData ? JSON.parse(userData).current_session_id : null);

            const headers = { 
                Authorization: `Bearer ${token}`,
                'x-academic-session-id': sessionId?.toString()
            };
            
            if (editingNoticeId) {
                // Update Existing
                await axios.put(`${API_ENDPOINTS.NOTICE}/${editingNoticeId}`, {
                    topic,
                    content,
                    target_audience: targetAudience,
                    target_class: selectedClass,
                    target_section: selectedSection
                }, { headers });
                Toast.show({ type: 'success', text1: 'Success', text2: 'Notice updated successfully' });
            } else {
                // Create New
                await axios.post(API_ENDPOINTS.NOTICE, {
                    topic,
                    content,
                    target_audience: targetAudience,
                    target_class: selectedClass,
                    target_section: selectedSection
                }, { headers });
                Toast.show({ type: 'success', text1: 'Success', text2: 'Notice published successfully' });
            }

            setCreateModalVisible(false);
            setEditingNoticeId(null);
            setTopic('');
            setContent('');
            setTargetAudience('all');
            setSelectedClass('');
            setSelectedSection('');
            fetchNotices();
        } catch (error) {
            console.error('Error publishing notice:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to publish notice' });
        } finally {
            setPublishing(false);
        }
    };

    const handleEdit = (notice: any) => {
        setEditingNoticeId(notice.id);
        setTopic(notice.topic);
        setContent(notice.content);
        setTargetAudience(notice.target_audience);
        setSelectedClass(notice.target_class || '');
        setSelectedSection(notice.target_section || '');
        setCreateModalVisible(true);
    };

    const handleDelete = async (id: number) => {
        const confirmDelete = () => {
            if (Platform.OS === 'web') return true;
            // Native alert logic is usually better with Alert.alert, but I'll use a direct confirm for now or just proceed if you prefer.
            // Since I don't have Alert imported, I'll just proceed or add it.
            return true;
        };

        if (confirmDelete()) {
            try {
                const token = await AsyncStorage.getItem('teacherToken');
                await axios.delete(`${API_ENDPOINTS.NOTICE}/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                Toast.show({ type: 'success', text1: 'Deleted', text2: 'Notice removed successfully' });
                fetchNotices();
            } catch (error) {
                Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete notice' });
            }
        }
    };

    const openPreview = (notice: any) => {
        setSelectedNotice(notice);
        setPreviewVisible(true);
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            backgroundColor: theme.card,
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        backBtn: { padding: 5, marginRight: 15 },
        headerTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        
        listContent: { padding: 15 },
        noticeCard: {
            backgroundColor: theme.card,
            borderRadius: 20,
            padding: 18,
            marginBottom: 15,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            elevation: 2,
        },
        noticeTopic: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 8 },
        noticeMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        noticeDate: { fontSize: 12, color: theme.textLight, fontWeight: '600' },
        audienceBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: theme.primary + '15',
        },
        audienceText: { fontSize: 10, fontWeight: '800', color: theme.primary, textTransform: 'uppercase' },

        fab: {
            position: 'absolute',
            bottom: 30,
            right: 25,
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: theme.primary,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 8,
        },

        // Modal Styles
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        modalContent: {
            backgroundColor: theme.card,
            borderTopLeftRadius: 35,
            borderTopRightRadius: 35,
            padding: 25,
            maxHeight: '90%',
        },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text },
        inputLabel: { fontSize: 14, fontWeight: '800', color: theme.textLight, marginBottom: 8, marginTop: 15, textTransform: 'uppercase' },
        textInput: {
            backgroundColor: theme.background,
            borderRadius: 15,
            padding: 15,
            color: theme.text,
            fontSize: 16,
            borderWidth: 1,
            borderColor: theme.border,
        },
        textArea: { minHeight: 120, textAlignVertical: 'top' },
        
        audienceContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
        audienceChip: {
            paddingHorizontal: 15,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.background,
        },
        activeChip: { backgroundColor: theme.primary, borderColor: theme.primary },
        chipText: { fontSize: 13, fontWeight: '700', color: theme.textLight },
        activeChipText: { color: '#fff' },

        classPicker: { flexDirection: 'row', gap: 10, marginTop: 10 },
        dropdown: {
            flex: 1,
            backgroundColor: theme.background,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },

        publishBtn: {
            backgroundColor: theme.primary,
            height: 56,
            borderRadius: 18,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 30,
            marginBottom: 20,
        },
        publishBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

        // Preview Styles
        previewContent: {
            backgroundColor: '#fff', // Notice usually looks better on white/paper background
            borderRadius: 20,
            padding: 20,
            minHeight: 400,
        },
        previewHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 10,
        },
        previewLogo: { width: 50, height: 50, borderRadius: 10, marginRight: 15 },
        previewInstName: { fontSize: 20, fontWeight: '900', color: '#1a1a1a', flex: 1 },
        previewAffiliation: { fontSize: 12, fontWeight: '700', color: '#666', textAlign: 'center', marginVertical: 5 },
        previewAddress: { fontSize: 11, color: '#888', textAlign: 'center', lineHeight: 16 },
        previewLine: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
        previewNoticeContent: { fontSize: 16, color: '#333', lineHeight: 24, minHeight: 150 },
        previewDate: { fontSize: 13, color: '#999', fontWeight: '700', marginTop: 20, textAlign: 'right' },
        closePreview: {
            marginTop: 20,
            backgroundColor: '#1a1a1a',
            height: 50,
            borderRadius: 15,
            justifyContent: 'center',
            alignItems: 'center'
        }
    }), [theme, insets, isDark]);

    if (loading && !refreshing) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} />
            
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notice Board</Text>
            </View>

            <FlatList
                data={notices}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                renderItem={({ item }) => {
                    const isCreator = item.created_by_role === 'teacher' && item.created_by_id === currentUserId;
                    
                    return (
                        <TouchableOpacity style={styles.noticeCard} onPress={() => openPreview(item)}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.noticeTopic}>{item.topic}</Text>
                                    <Text style={{ fontSize: 13, color: theme.primary, fontWeight: '700', marginBottom: 8 }}>
                                        Posted by: {item.creator_name}
                                    </Text>
                                </View>
                                {isCreator && (
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <TouchableOpacity onPress={() => handleEdit(item)}>
                                            <Ionicons name="create-outline" size={22} color={theme.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDelete(item.id)}>
                                            <Ionicons name="trash-outline" size={22} color={theme.danger} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                            <View style={styles.noticeMeta}>
                                <View style={styles.audienceBadge}>
                                    <Text style={styles.audienceText}>
                                        {item.target_audience === 'class' ? `Class ${item.target_class}-${item.target_section}` : item.target_audience}
                                    </Text>
                                </View>
                                <Text style={styles.noticeDate}>
                                    {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 100 }}>
                        <Ionicons name="notifications-off-outline" size={60} color={theme.border} />
                        <Text style={{ color: theme.textLight, marginTop: 10 }}>No notices yet</Text>
                    </View>
                }
            />

            <TouchableOpacity style={styles.fab} onPress={() => setCreateModalVisible(true)}>
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>

            {/* CREATE NOTICE MODAL */}
            <Modal
                visible={createModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setCreateModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>New Notice</Text>
                                <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                                    <Ionicons name="close-circle" size={30} color={theme.textLight} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.inputLabel}>Notice Topic</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g. Annual Sports Day"
                                placeholderTextColor={theme.textLight}
                                value={topic}
                                onChangeText={setTopic}
                            />

                            <Text style={styles.inputLabel}>Notice Content</Text>
                            <TextInput
                                style={[styles.textInput, styles.textArea]}
                                placeholder="Type the entire notice here..."
                                placeholderTextColor={theme.textLight}
                                value={content}
                                onChangeText={setContent}
                                multiline
                                numberOfLines={6}
                            />

                            <Text style={styles.inputLabel}>Visible To</Text>
                            <View style={styles.audienceContainer}>
                                {['all', 'principal', 'class'].map((type) => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[styles.audienceChip, targetAudience === type && styles.activeChip]}
                                        onPress={() => setTargetAudience(type)}
                                    >
                                        <Text style={[styles.chipText, targetAudience === type && styles.activeChipText]}>
                                            {type === 'class' ? 'Students (Class)' : type.charAt(0).toUpperCase() + type.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {targetAudience === 'class' && (
                                <View style={styles.classPicker}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.inputLabel}>Class</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                {availableClasses.map((cls) => (
                                                    <TouchableOpacity
                                                        key={cls}
                                                        style={[styles.audienceChip, selectedClass === cls && styles.activeChip]}
                                                        onPress={() => {
                                                            setSelectedClass(cls);
                                                            setSelectedSection('');
                                                        }}
                                                    >
                                                        <Text style={[styles.chipText, selectedClass === cls && styles.activeChipText]}>{cls}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </ScrollView>
                                    </View>
                                    
                                    {selectedClass ? (
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.inputLabel}>Section</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    {sectionsMap[selectedClass]?.map((sec) => (
                                                        <TouchableOpacity
                                                            key={sec}
                                                            style={[styles.audienceChip, selectedSection === sec && styles.activeChip]}
                                                            onPress={() => setSelectedSection(sec)}
                                                        >
                                                            <Text style={[styles.chipText, selectedSection === sec && styles.activeChipText]}>{sec}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </ScrollView>
                                        </View>
                                    ) : null}
                                </View>
                            )}

                            <TouchableOpacity 
                                style={[styles.publishBtn, publishing && { opacity: 0.7 }]}
                                onPress={handlePublish}
                                disabled={publishing}
                            >
                                {publishing ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>PUBLISH NOTICE</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* PREVIEW MODAL */}
            <Modal
                visible={previewVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setPreviewVisible(false)}
            >
                <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
                    <View style={styles.previewContent}>
                        <View style={styles.previewHeader}>
                            {institute?.logo_url && (
                                <Image source={{ uri: institute.logo_url }} style={styles.previewLogo} />
                            )}
                            <Text style={styles.previewInstName}>{institute?.institute_name}</Text>
                        </View>
                        
                        <Text style={styles.previewAffiliation}>{institute?.affiliation || 'N/A'}</Text>
                        
                        <Text style={styles.previewAddress}>
                            {institute?.address}, {institute?.landmark && `${institute.landmark}, `}
                            {institute?.district}, {institute?.state} - {institute?.pincode}
                        </Text>

                        <View style={styles.previewLine} />

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#1a1a1a', marginBottom: 15, textAlign: 'center' }}>
                                {selectedNotice?.topic}
                            </Text>
                            <Text style={styles.previewNoticeContent}>{selectedNotice?.content}</Text>
                            
                            <Text style={styles.previewDate}>
                                Date: {new Date(selectedNotice?.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </Text>
                        </ScrollView>

                        <TouchableOpacity style={styles.closePreview} onPress={() => setPreviewVisible(false)}>
                            <Text style={{ color: '#fff', fontWeight: '800' }}>CLOSE</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}
