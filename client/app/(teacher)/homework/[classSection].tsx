import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
    StatusBar, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Dimensions, Alert, Image
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ClassHomework() {
    const { className, section } = useLocalSearchParams();
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [homeworkList, setHomeworkList] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [subject, setSubject] = useState('');
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Completion List State
    const [showCompletions, setShowCompletions] = useState(false);
    const [completionData, setCompletionData] = useState<{done: any[], pending: any[]}>({done: [], pending: []});
    const [loadingCompletions, setLoadingCompletions] = useState(false);
    const [activeTab, setActiveTab] = useState<'tick' | 'cross'>('tick');
    const [selectedHW, setSelectedHW] = useState<any>(null);

    const fetchHomework = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const data = await AsyncStorage.getItem('teacherData');
            const parsedData = data ? JSON.parse(data) : null;
            const sessionId = parsedData?.current_session_id;
            const dateStr = selectedDate.toISOString().split('T')[0];

            const response = await axios.get(
                `${API_ENDPOINTS.HOMEWORK}/list?class_name=${className}&section=${section}&date=${dateStr}`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    } 
                }
            );

            setHomeworkList(response.data || []);
        } catch (error) {
            console.error('Error fetching homework:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load homework' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [className, section, selectedDate]);

    useEffect(() => {
        fetchHomework();
    }, [fetchHomework]);

    const handleSaveHomework = async () => {
        if (!subject.trim() || !content.trim()) {
            Toast.show({ type: 'error', text1: 'Missing Fields', text2: 'Please fill all fields' });
            return;
        }

        try {
            setSaving(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const data = await AsyncStorage.getItem('teacherData');
            const parsedData = data ? JSON.parse(data) : null;
            const sessionId = parsedData?.current_session_id;

            if (editingId) {
                await axios.put(
                    `${API_ENDPOINTS.HOMEWORK}/update/${editingId}`,
                    { subject, content },
                    { headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sessionId?.toString() } }
                );
                Toast.show({ type: 'success', text1: 'Updated', text2: 'Homework updated' });
            } else {
                await axios.post(
                    `${API_ENDPOINTS.HOMEWORK}/create`,
                    { class_name: className, section: section, subject: subject, content: content, date: selectedDate.toISOString().split('T')[0] },
                    { headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sessionId?.toString() } }
                );
                Toast.show({ type: 'success', text1: 'Success', text2: 'Homework added' });
            }

            setModalVisible(false);
            setSubject('');
            setContent('');
            setEditingId(null);
            fetchHomework();
        } catch (error) {
            console.error('Error saving homework:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save homework' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert("Delete Homework", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    const token = await AsyncStorage.getItem('teacherToken');
                    await axios.delete(`${API_ENDPOINTS.HOMEWORK}/delete/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                    fetchHomework();
                } catch (error) { Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete' }); }
            }}
        ]);
    };

    const fetchCompletions = async (hw: any) => {
        try {
            setSelectedHW(hw);
            setLoadingCompletions(true);
            setShowCompletions(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const response = await axios.get(`${API_ENDPOINTS.HOMEWORK}/completions/${hw.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCompletionData(response.data);
        } catch (error) {
            console.error('Error fetching completions:', error);
        } finally {
            setLoadingCompletions(false);
        }
    };

    const openEditModal = (item: any) => {
        setSubject(item.subject);
        setContent(item.content);
        setEditingId(item.id);
        setModalVisible(true);
    };

    const changeDate = (days: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
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
        
        dateSelector: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 15,
            backgroundColor: theme.card,
            margin: 20,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
        },
        dateText: { fontSize: 16, fontWeight: '800', color: theme.text },
        navBtn: { padding: 8, borderRadius: 10, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },

        content: { flex: 1, paddingHorizontal: 20 },
        homeworkCard: {
            backgroundColor: theme.card,
            borderRadius: 22,
            padding: 20,
            marginBottom: 15,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            elevation: 2,
        },
        subjectHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: theme.border + '50',
        },
        subjectText: { fontSize: 18, fontWeight: '900', color: theme.primary, flex: 1 },
        actionIcons: { flexDirection: 'row', gap: 15 },
        homeworkContent: { fontSize: 14, color: theme.text, lineHeight: 22, fontWeight: '600' },
        cardFooter: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 15,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border + '30',
        },
        timeText: { fontSize: 11, color: theme.textLight, fontWeight: '700' },
        
        countBox: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.primary + '10',
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 10,
            gap: 5,
        },
        countText: { fontSize: 12, fontWeight: '900', color: theme.primary },

        fab: {
            position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30,
            backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', elevation: 8,
        },

        // Bottom Sheet Modal
        sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        sheetContent: { backgroundColor: theme.card, borderTopLeftRadius: 35, borderTopRightRadius: 35, height: SCREEN_HEIGHT * 0.7, padding: 20 },
        sheetHeader: { alignItems: 'center', marginBottom: 20 },
        sheetHandle: { width: 40, height: 5, backgroundColor: theme.border, borderRadius: 3, marginBottom: 15 },
        sheetTitle: { fontSize: 18, fontWeight: '900', color: theme.text },
        
        tabRow: { flexDirection: 'row', backgroundColor: theme.background, borderRadius: 15, padding: 5, marginBottom: 20 },
        tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 8 },
        activeTabTick: { backgroundColor: theme.success },
        activeTabCross: { backgroundColor: theme.danger },
        tabText: { fontWeight: '800', fontSize: 14, color: theme.textLight },
        activeTabText: { color: '#fff' },

        studentList: { flex: 1 },
        studentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border + '50' },
        studentAvatar: { width: 45, height: 45, borderRadius: 15, marginRight: 15 },
        studentInfo: { flex: 1 },
        studentName: { fontSize: 15, fontWeight: '800', color: theme.text },
        studentRoll: { fontSize: 12, color: theme.textLight, fontWeight: '600', marginTop: 2 },
        doneTime: { fontSize: 10, color: theme.success, fontWeight: '700' },

        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        modalContent: { backgroundColor: theme.card, borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 25, maxHeight: '80%' },
        input: { backgroundColor: theme.background, borderRadius: 15, padding: 15, color: theme.text, fontSize: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 20 },
        saveBtn: { backgroundColor: theme.primary, height: 55, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
        emptyBox: { alignItems: 'center', marginTop: 80 },
        emptyText: { color: theme.textLight, fontSize: 15, fontWeight: '600', marginTop: 15 }
    }), [theme, insets, isDark]);

    const renderStudentList = () => {
        const data = activeTab === 'tick' ? completionData.done : completionData.pending;
        if (loadingCompletions) return <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />;
        
        if (data.length === 0) {
            return (
                <View style={{ alignItems: 'center', marginTop: 50 }}>
                    <Ionicons name={activeTab === 'tick' ? "checkmark-done" : "close-circle"} size={50} color={theme.border} />
                    <Text style={{ color: theme.textLight, marginTop: 10, fontWeight: '600' }}>
                        {activeTab === 'tick' ? "No one completed yet" : "Everyone has completed!"}
                    </Text>
                </View>
            );
        }

        return (
            <ScrollView style={styles.studentList}>
                {data.map((s, i) => (
                    <View key={i} style={styles.studentItem}>
                        {s.photo_url ? (
                            <Image source={{ uri: s.photo_url }} style={styles.studentAvatar} />
                        ) : (
                            <View style={[styles.studentAvatar, { backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ color: theme.primary, fontWeight: '900' }}>{s.name[0]}</Text>
                            </View>
                        )}
                        <View style={styles.studentInfo}>
                            <Text style={styles.studentName}>{s.name}</Text>
                            <Text style={styles.studentRoll}>Roll No: {s.roll_no}</Text>
                        </View>
                        {activeTab === 'tick' && (
                            <Text style={styles.doneTime}>
                                {new Date(s.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        )}
                    </View>
                ))}
            </ScrollView>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Class {className}-{section} HW</Text>
            </View>

            <View style={styles.dateSelector}>
                <TouchableOpacity style={styles.navBtn} onPress={() => changeDate(-1)}><Ionicons name="chevron-back" size={20} color={theme.text} /></TouchableOpacity>
                <Text style={styles.dateText}>{selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                <TouchableOpacity style={styles.navBtn} onPress={() => changeDate(1)}><Ionicons name="chevron-forward" size={20} color={theme.text} /></TouchableOpacity>
            </View>

            <ScrollView 
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchHomework();}} colors={[theme.primary]} />}
            >
                {loading ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                ) : homeworkList.length > 0 ? (
                    homeworkList.map((item, idx) => (
                        <View key={idx} style={styles.homeworkCard}>
                            <View style={styles.subjectHeader}>
                                <Text style={styles.subjectText}>{item.subject}</Text>
                                <View style={styles.actionIcons}>
                                    <TouchableOpacity onPress={() => openEditModal(item)}><Ionicons name="create-outline" size={22} color={theme.primary} /></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(item.id)}><Ionicons name="trash-outline" size={22} color={theme.danger} /></TouchableOpacity>
                                </View>
                            </View>
                            <Text style={styles.homeworkContent}>{item.content}</Text>
                            <View style={styles.cardFooter}>
                                <Text style={styles.timeText}>Posted by {item.teacher_name}</Text>
                                <TouchableOpacity style={styles.countBox} onPress={() => fetchCompletions(item)}>
                                    <Ionicons name="people" size={16} color={theme.primary} />
                                    <Text style={styles.countText}>{item.done_count}/{item.total_students}</Text>
                                    <Ionicons name="chevron-forward" size={14} color={theme.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyBox}>
                        <Ionicons name="document-text-outline" size={60} color={theme.border} />
                        <Text style={styles.emptyText}>No homework for this date</Text>
                    </View>
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            <Modal visible={showCompletions} transparent animationType="slide" onRequestClose={() => setShowCompletions(false)}>
                <View style={styles.sheetOverlay}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowCompletions(false)} />
                    <View style={styles.sheetContent}>
                        <View style={styles.sheetHeader}>
                            <View style={styles.sheetHandle} />
                            <Text style={styles.sheetTitle}>Submission Status</Text>
                            <Text style={{ fontSize: 12, color: theme.textLight, marginTop: 5 }}>{selectedHW?.subject}</Text>
                        </View>

                        <View style={styles.tabRow}>
                            <TouchableOpacity style={[styles.tab, activeTab === 'tick' && styles.activeTabTick]} onPress={() => setActiveTab('tick')}>
                                <Ionicons name="checkmark-circle" size={20} color={activeTab === 'tick' ? '#fff' : theme.success} />
                                <Text style={[styles.tabText, activeTab === 'tick' && styles.activeTabText]}>Done ({completionData.done.length})</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.tab, activeTab === 'cross' && styles.activeTabCross]} onPress={() => setActiveTab('cross')}>
                                <Ionicons name="close-circle" size={20} color={activeTab === 'cross' ? '#fff' : theme.danger} />
                                <Text style={[styles.tabText, activeTab === 'cross' && styles.activeTabText]}>Pending ({completionData.pending.length})</Text>
                            </TouchableOpacity>
                        </View>

                        {renderStudentList()}
                    </View>
                </View>
            </Modal>

            <TouchableOpacity style={styles.fab} onPress={() => { setSubject(''); setContent(''); setEditingId(null); setModalVisible(true); }}>
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>

            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setModalVisible(false)} />
                    <View style={styles.modalContent}>
                        <Text style={[styles.sheetTitle, { marginBottom: 20 }]}>{editingId ? 'Edit Homework' : 'Add Homework'}</Text>
                        <TextInput style={styles.input} placeholder="Subject Name" value={subject} onChangeText={setSubject} />
                        <TextInput style={[styles.input, { height: 120 }]} multiline placeholder="Homework details..." value={content} onChangeText={setContent} />
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveHomework} disabled={saving}>
                            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{editingId ? 'Update' : 'Post'}</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}