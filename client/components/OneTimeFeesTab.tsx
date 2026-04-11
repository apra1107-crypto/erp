import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, TextInput, ActivityIndicator, RefreshControl, Dimensions, LayoutAnimation, Alert, Modal, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFullImageUrl } from '../utils/imageHelper';
import { useTheme } from '../context/ThemeContext';
import { API_ENDPOINTS } from '../constants/Config';
import { generateReceiptPDF } from '../utils/receiptGenerator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OneTimeFeesTabProps {
    // onOpenReceipt removed
}

export default function OneTimeFeesTab({ }: OneTimeFeesTabProps) {
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    
    // 1. Dashboard State
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [instituteData, setInstituteData] = useState<any>(null);

    // 2. Wizard State
    const [showWizard, setShowWizard] = useState(false);
    const [step, setStep] = useState(1);
    const [reasonTitle, setReasonTitle] = useState('');
    const [reasonsList, setReasonsList] = useState<any[]>([{ id: Date.now(), reason: '', amount: '' }]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [availableStudents, setAvailableStudents] = useState<any[]>([]);
    const [creationSearch, setCreationSearch] = useState('');
    const [creationClassFilter, setCreationClassFilter] = useState('');
    const [creationSectionFilter, setCreationSectionFilter] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editGroupId, setEditGroupId] = useState<number | null>(null);

    // 3. Detail State
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<any>(null);
    const [groupStudents, setGroupStudents] = useState<any[]>([]);
    const [detailSearch, setDetailSearch] = useState('');
    const [detailClassFilter, setDetailClassFilter] = useState('');
    const [detailSectionFilter, setDetailSectionFilter] = useState('');
    const [detailLoading, setDetailLoading] = useState(false);

    // 4. Collection & Override State
    const [showCollectModal, setShowCollectModal] = useState(false);
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [activePayment, setActivePayment] = useState<any>(null);
    const [overridePayment, setOverridePayment] = useState<any>(null);
    const [historyStudent, setHistoryStudent] = useState<any>(null);
    const [overrideReasons, setOverrideReasons] = useState<any[]>([]);
    const [collectAmount, setCollectAmount] = useState('');

    const getToken = async () => {
        return await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('teacherToken') || await AsyncStorage.getItem('token');
    };

    useEffect(() => {
        fetchGroups();
        fetchAvailableStudents();
        fetchInstituteProfile();
    }, []);

    const fetchInstituteProfile = async () => {
        try {
            const token = await getToken();
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInstituteData(response.data.profile);
        } catch (error) {
            console.error('Error fetching institute profile:', error);
        }
    };

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const token = await getToken();
            const response = await axios.get(`${API_ENDPOINTS.ONE_TIME_FEES}/groups`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGroups(response.data.groups || []);
        } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load campaigns' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchAvailableStudents = async () => {
        try {
            const token = await getToken();
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAvailableStudents(response.data.students || []);
        } catch (error) {}
    };

    const fetchGroupDetails = async (group: any) => {
        setSelectedGroup(group);
        setDetailLoading(true);
        setShowDetailModal(true);
        try {
            const token = await getToken();
            const response = await axios.get(`${API_ENDPOINTS.ONE_TIME_FEES}/group-details/${group.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGroupStudents(response.data.students || []);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load students' });
        } finally {
            setDetailLoading(false);
        }
    };

    // --- Wizard Handlers ---
    const startCreation = () => {
        setReasonTitle('');
        setReasonsList([{ id: Date.now(), reason: '', amount: '' }]);
        setSelectedStudentIds([]);
        setStep(1);
        setIsEditing(false);
        setEditGroupId(null);
        setShowWizard(true);
    };

    const startEditing = async (group: any) => {
        setReasonTitle(group.reason);
        setReasonsList(group.reasons.map((r: any) => ({ ...r, id: Math.random() })));
        
        setLoading(true);
        try {
            const token = await getToken();
            const response = await axios.get(`${API_ENDPOINTS.ONE_TIME_FEES}/group-details/${group.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const currentStudents = response.data.students || [];
            setSelectedStudentIds(currentStudents.map((s: any) => s.student_id));
            
            setIsEditing(true);
            setEditGroupId(group.id);
            setStep(1);
            setShowWizard(true);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load group for editing' });
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        const validReasons = reasonsList.filter(r => r.reason && r.amount);
        if (validReasons.length === 0 || selectedStudentIds.length === 0) return;

        setSubmitting(true);
        try {
            const token = await getToken();
            const breakdown = validReasons.map(r => ({ reason: r.reason, amount: parseFloat(r.amount) }));
            
            // 1. Identify unique classes among selected students
            const selectedStudents = availableStudents.filter(s => selectedStudentIds.includes(s.id));
            const uniqueClasses = [...new Set(selectedStudents.map(s => s.class))];

            // 2. Build classConfigs required by server
            const classConfigs = uniqueClasses.map(className => ({
                className,
                reasons: breakdown
            }));

            const payload = {
                reason: reasonTitle,
                reasonsBreakdown: breakdown,
                studentIds: selectedStudentIds,
                classConfigs: classConfigs
            };

            const endpoint = isEditing 
                ? `${API_ENDPOINTS.ONE_TIME_FEES}/update/${editGroupId}` 
                : `${API_ENDPOINTS.ONE_TIME_FEES}/publish`;

            const response = isEditing
                ? await axios.put(endpoint, payload, { headers: { Authorization: `Bearer ${token}` } })
                : await axios.post(endpoint, payload, { headers: { Authorization: `Bearer ${token}` } });

            Toast.show({ type: 'success', text1: 'Success', text2: isEditing ? 'Campaign updated' : 'Campaign published' });
            setShowWizard(false);
            fetchGroups();
        } catch (error: any) {
            console.error(`[OneTimeFee] Save Error:`, error.response?.data || error.message);
            Toast.show({ type: 'error', text1: 'Error', text2: error.response?.data?.message || 'Failed to save campaign' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleCollect = async () => {
        if (!collectAmount || isNaN(parseFloat(collectAmount))) return;
        setSubmitting(true);
        try {
            const token = await getToken();
            await axios.post(`${API_ENDPOINTS.ONE_TIME_FEES}/collect/${activePayment.id}`, {
                amountReceived: parseFloat(collectAmount)
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            Toast.show({ type: 'success', text1: 'Success', text2: 'Payment recorded' });
            setShowCollectModal(false);
            fetchGroupDetails(selectedGroup);
            fetchGroups();
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to collect payment' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleOverride = async () => {
        if (overrideReasons.length === 0) return;
        setSubmitting(true);
        try {
            const token = await getToken();
            await axios.patch(`${API_ENDPOINTS.ONE_TIME_FEES}/override/${overridePayment.id}`, {
                reasons: overrideReasons.map(r => ({ reason: r.reason, amount: parseFloat(r.amount) }))
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            Toast.show({ type: 'success', text1: 'Success', text2: 'Amount overridden' });
            setShowOverrideModal(false);
            fetchGroupDetails(selectedGroup);
            fetchGroups();
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Override failed' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteGroup = (group: any) => {
        Alert.alert(
            'Delete Campaign',
            `Are you sure you want to delete "${group.reason}"? This will remove all associated payment records.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await getToken();
                            await axios.delete(`${API_ENDPOINTS.ONE_TIME_FEES}/delete/${group.id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            Toast.show({ type: 'success', text1: 'Success', text2: 'Campaign deleted' });
                            fetchGroups();
                        } catch (error) {
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete' });
                        }
                    }
                }
            ]
        );
    };

    const handleDownload = async (student: any) => {
        try {
            const breakage = student.breakdown || [{ reason: selectedGroup.reason, amount: student.due_amount }];
            await generateReceiptPDF({
                institute: instituteData,
                student: { ...student, id: student.student_id },
                payment: { 
                    paid_at: student.updated_at, 
                    payment_method: student.transactions?.[0]?.payment_method || 'Cash', 
                    collected_by: student.transactions?.[0]?.collected_by || 'Principal',
                    paid_amount: student.paid_amount,
                    due_amount: student.due_amount,
                    transactions: student.transactions
                },
                breakage: breakage,
                type: 'ONE-TIME'
            });
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Download Failed', text2: 'Could not generate PDF' });
        }
    };

    const filteredCreationStudents = useMemo(() => {
        return availableStudents.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(creationSearch.toLowerCase()) || (s.roll_no || '').toString().includes(creationSearch);
            const matchesClass = creationClassFilter === '' || s.class === creationClassFilter;
            const matchesSection = creationSectionFilter === '' || (s.section || '').toLowerCase() === creationSectionFilter.toLowerCase();
            return matchesSearch && matchesClass && matchesSection;
        });
    }, [availableStudents, creationSearch, creationClassFilter, creationSectionFilter]);

    const filteredDetailStudents = useMemo(() => {
        return groupStudents.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(detailSearch.toLowerCase()) || (s.roll_no || '').toString().includes(detailSearch);
            const matchesClass = detailClassFilter === '' || (s.class || '').toLowerCase().includes(detailClassFilter.toLowerCase());
            const matchesSection = detailSectionFilter === '' || (s.section || '').toLowerCase().includes(detailSectionFilter.toLowerCase());
            return matchesSearch && matchesClass && matchesSection;
        });
    }, [groupStudents, detailSearch, detailClassFilter, detailSectionFilter]);

    const renderCampaignCard = ({ item }: { item: any }) => {
        const progress = (parseFloat(item.collected_total) / parseFloat(item.expected_total)) * 100 || 0;
        const date = new Date(item.created_at);

        return (
            <TouchableOpacity 
                activeOpacity={0.9} 
                style={[styles.campaignCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => fetchGroupDetails(item)}
            >
                <View style={styles.cardTop}>
                    <View style={styles.cardHeaderInfo}>
                        <Text style={[styles.cardDate, { color: theme.textLight }]}>{date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
                        <View style={styles.activePill}><Text style={styles.activePillText}>Active</Text></View>
                    </View>
                    <View style={styles.cardActions}>
                        <TouchableOpacity 
                            style={[styles.cardActionBtn, { backgroundColor: theme.primary + '10' }]} 
                            onPress={() => startEditing(item)}
                        >
                            <Ionicons name="create-outline" size={18} color={theme.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleDeleteGroup(item)}>
                            <Ionicons name="trash-outline" size={18} color="#F44336" />
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={[styles.cardReason, { color: theme.text }]}>{item.reason}</Text>

                <View style={styles.cardStats}>
                    <View style={styles.cardStatBox}>
                        <Text style={styles.cardStatLabel}>EXPECTED</Text>
                        <Text style={[styles.cardStatValue, { color: theme.text }]}>₹{parseFloat(item.expected_total).toLocaleString()}</Text>
                    </View>
                    <View style={styles.cardStatBox}>
                        <Text style={styles.cardStatLabel}>COLLECTED</Text>
                        <Text style={[styles.cardStatValue, { color: '#4CAF50' }]}>₹{parseFloat(item.collected_total).toLocaleString()}</Text>
                    </View>
                    <View style={styles.cardStatBox}>
                        <Text style={styles.cardStatLabel}>STUDENTS</Text>
                        <Text style={[styles.cardStatValue, { color: theme.text }]}>{item.student_count}</Text>
                    </View>
                </View>

                <View style={styles.progressSection}>
                    <View style={styles.progressLabels}>
                        <Text style={styles.progressText}>Progress</Text>
                        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: isDark ? '#ffffff10' : '#00000005' }]}>
                        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.primary }]} />
                    </View>
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.classRow}>
                        {item.classes.slice(0, 3).map((c: string) => (
                            <View key={c} style={[styles.classTag, { backgroundColor: theme.primary + '15' }]}>
                                <Text style={[styles.classTagText, { color: theme.primary }]}>{c}</Text>
                            </View>
                        ))}
                        {item.classes.length > 3 && <Text style={{ fontSize: 10, color: theme.textLight }}>+{item.classes.length - 3}</Text>}
                    </View>
                    <Text style={[styles.viewDetailsText, { color: theme.primary }]}>Details <Ionicons name="arrow-forward" size={12} /></Text>
                </View>
            </TouchableOpacity>
        );
    };

    const styles = StyleSheet.create({
        container: { flex: 1 },
        createTrigger: { margin: 20, padding: 15, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 5, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
        createText: { color: '#fff', fontSize: 16, fontWeight: '800' },
        
        listContent: { padding: 20, paddingBottom: 100 },
        campaignCard: { borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, elevation: 2 },
        cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
        cardHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        cardDate: { fontSize: 12, fontWeight: '700' },
        activePill: { backgroundColor: '#4CAF5020', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
        activePillText: { color: '#4CAF50', fontSize: 10, fontWeight: '800' },
        cardActions: { flexDirection: 'row', gap: 10 },
        cardActionBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F4433610', justifyContent: 'center', alignItems: 'center' },
        cardReason: { fontSize: 20, fontWeight: '800', marginBottom: 15 },
        cardStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: isDark ? '#ffffff05' : '#00000002', padding: 12, borderRadius: 16 },
        cardStatBox: { flex: 1, alignItems: 'center' },
        cardStatLabel: { fontSize: 9, color: theme.textLight, fontWeight: '800', marginBottom: 4 },
        cardStatValue: { fontSize: 14, fontWeight: '900' },
        progressSection: { marginBottom: 15 },
        progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
        progressText: { fontSize: 10, fontWeight: '700', color: theme.textLight },
        progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
        progressFill: { height: '100%', borderRadius: 3 },
        cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        classRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
        classTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
        classTagText: { fontSize: 10, fontWeight: '800' },
        viewDetailsText: { fontSize: 12, fontWeight: '800' },

        // Wizard Styles
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
        modalContent: { backgroundColor: theme.card, borderRadius: 30, maxHeight: SCREEN_HEIGHT * 0.9, height: SCREEN_HEIGHT * 0.85, overflow: 'hidden' },
        modalHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        modalTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
        
        stepDotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 10 },
        stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' },
        stepDotActive: { backgroundColor: theme.primary },
        stepDotText: { color: '#fff', fontSize: 12, fontWeight: '800' },
        stepLine: { width: 40, height: 2, backgroundColor: theme.border },
        stepLineActive: { backgroundColor: theme.primary },

        wizardBody: { flex: 1, padding: 20 },
        inputGroup: { marginBottom: 20 },
        label: { fontSize: 13, fontWeight: '700', color: theme.textLight, marginBottom: 8 },
        input: { backgroundColor: theme.background, height: 50, borderRadius: 15, paddingHorizontal: 15, color: theme.text, borderWidth: 1, borderColor: theme.border },
        
        reasonRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' },
        reasonInput: { flex: 2, height: 45, backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 12, color: theme.text, borderWidth: 1, borderColor: theme.border },
        amtInput: { flex: 1, height: 45, backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 12, color: theme.text, borderWidth: 1, borderColor: theme.border },

        studentSelectionCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 15, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
        selectionCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.border, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
        selectionCircleActive: { backgroundColor: theme.primary, borderColor: theme.primary },

        // Detail View Styles
        detailListHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
        detailSearchRow: { flexDirection: 'row', gap: 10 },
        detailSearch: { flex: 1, height: 40, backgroundColor: theme.background, borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border },
        detailSearchInput: { flex: 1, marginLeft: 8, color: theme.text, fontSize: 13 },
        miniInput: { 
            height: 40, 
            backgroundColor: theme.background, 
            borderRadius: 12, 
            paddingHorizontal: 12, 
            color: theme.text, 
            borderWidth: 1, 
            borderColor: theme.border, 
            fontSize: 12,
            fontWeight: '600',
            textAlign: 'center'
        },
        
        studentRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border },
        studentRowInfo: { flex: 1 },
        studentRowName: { fontSize: 15, fontWeight: '700', color: theme.text },
        studentRowMeta: { fontSize: 12, color: theme.textLight },
        studentRowDue: { alignItems: 'flex-end', marginRight: 25 },
        dueAmt: { fontSize: 14, fontWeight: '800', color: theme.text },
        paidAmt: { fontSize: 11, color: '#4CAF50', fontWeight: '700' },
        collectBtn: { backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
        collectBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

        wizardFooter: { padding: 20, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', gap: 12 },
        nextBtn: { flex: 1, height: 50, borderRadius: 15, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
        nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

        avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366f120', justifyContent: 'center', alignItems: 'center' },
        avatarText: { color: '#6366f1', fontSize: 18, fontWeight: '800' },
        summaryBar: { padding: 15, backgroundColor: '#6366f110', borderRadius: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        summaryLabel: { fontSize: 14, color: '#1a1a1a', fontWeight: '600' },
        summaryValue: { fontSize: 18, fontWeight: '800', color: '#6366f1' },
    });

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.createTrigger} onPress={startCreation}>
                <LinearGradient colors={['#6366f1', '#4f46e5']} start={{x:0, y:0}} end={{x:1, y:0}} style={StyleSheet.absoluteFill} />
                <Ionicons name="add-circle" size={24} color="#fff" />
                <Text style={styles.createText}>Create New Fee Campaign</Text>
            </TouchableOpacity>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 50 }} color={theme.primary} />
            ) : (
                <FlatList 
                    data={groups}
                    renderItem={renderCampaignCard}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchGroups} colors={[theme.primary]} />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Ionicons name="receipt-outline" size={64} color={theme.border} />
                            <Text style={{ color: theme.textLight, marginTop: 10, fontSize: 16 }}>No campaigns yet</Text>
                        </View>
                    }
                />
            )}

            {/* --- WIZARD MODAL --- */}
            <Modal visible={showWizard} transparent animationType="slide" onRequestClose={() => setShowWizard(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{isEditing ? 'Edit Fee Campaign' : 'New Fee Campaign'}</Text>
                            <TouchableOpacity onPress={() => setShowWizard(false)}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.stepDotRow}>
                            <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}><Text style={styles.stepDotText}>1</Text></View>
                            <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
                            <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}><Text style={styles.stepDotText}>2</Text></View>
                        </View>

                        <ScrollView 
                            style={styles.wizardBody} 
                            contentContainerStyle={{ paddingBottom: SCREEN_HEIGHT * 0.5 }}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {step === 1 ? (
                                <View>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Campaign Title</Text>
                                        <TextInput 
                                            style={styles.input} 
                                            placeholder="e.g. Annual Picnic 2026" 
                                            placeholderTextColor={theme.textLight}
                                            value={reasonTitle}
                                            onChangeText={setReasonTitle}
                                        />
                                    </View>
                                    
                                    <Text style={styles.label}>Fee Structure</Text>
                                    {reasonsList.map((r, idx) => (
                                        <View key={r.id} style={styles.reasonRow}>
                                            <TextInput 
                                                style={styles.reasonInput} 
                                                placeholder="Lab Fee" 
                                                placeholderTextColor={theme.textLight}
                                                value={r.reason}
                                                onChangeText={v => setReasonsList(reasonsList.map(item => item.id === r.id ? {...item, reason: v} : item))}
                                            />
                                            <TextInput 
                                                style={styles.amtInput} 
                                                placeholder="₹ 500" 
                                                placeholderTextColor={theme.textLight}
                                                keyboardType="numeric"
                                                value={r.amount}
                                                onChangeText={v => setReasonsList(reasonsList.map(item => item.id === r.id ? {...item, amount: v} : item))}
                                            />
                                            <TouchableOpacity onPress={() => setReasonsList(reasonsList.filter(item => item.id !== r.id))}>
                                                <Ionicons name="trash-outline" size={18} color="#F44336" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <TouchableOpacity 
                                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, marginBottom: 30 }}
                                        onPress={() => setReasonsList([...reasonsList, { id: Date.now(), reason: '', amount: '' }])}
                                    >
                                        <Ionicons name="add-circle" size={20} color={theme.primary} />
                                        <Text style={{ color: theme.primary, fontWeight: '700' }}>Add Row</Text>
                                    </TouchableOpacity>

                                    {/* Action Button back inside ScrollView with enough bottom space */}
                                    <TouchableOpacity 
                                        style={styles.nextBtn} 
                                        onPress={() => (reasonTitle && reasonsList.some(r => r.reason && r.amount)) ? setStep(2) : Alert.alert('Required', 'Please fill campaign title and structure')}
                                    >
                                        <Text style={styles.nextBtnText}>Next: Target Students</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={{ flex: 1 }}>
                                    <View style={[styles.detailSearch, { marginBottom: 10, height: 45 }]}>
                                        <Ionicons name="search" size={18} color={theme.textLight} />
                                        <TextInput 
                                            style={styles.detailSearchInput} 
                                            placeholder="Search by name or roll..." 
                                            placeholderTextColor={theme.textLight}
                                            value={creationSearch}
                                            onChangeText={setCreationSearch}
                                        />
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                        <TextInput 
                                            style={[styles.miniInput, { flex: 1 }]} 
                                            placeholder="Class" 
                                            placeholderTextColor={theme.textLight}
                                            value={creationClassFilter}
                                            onChangeText={setCreationClassFilter}
                                        />
                                        <TextInput 
                                            style={[styles.miniInput, { flex: 1 }]} 
                                            placeholder="Section" 
                                            placeholderTextColor={theme.textLight}
                                            value={creationSectionFilter}
                                            onChangeText={setCreationSectionFilter}
                                        />
                                        <TouchableOpacity 
                                            style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}
                                            onPress={() => {
                                                const filteredIds = filteredCreationStudents.map(s => s.id);
                                                setSelectedStudentIds(prev => {
                                                    const newSet = new Set([...prev, ...filteredIds]);
                                                    return Array.from(newSet);
                                                });
                                                Toast.show({ type: 'info', text1: 'Bulk Select', text2: `Added ${filteredIds.length} students from filtered list.` });
                                            }}
                                        >
                                            <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '900' }}>SELECT ALL</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Using a regular map inside ScrollView for better scroll behavior rather than nested FlatList */}
                                    {filteredCreationStudents.map((item) => {
                                        const isSelected = selectedStudentIds.includes(item.id);
                                        return (
                                            <TouchableOpacity 
                                                key={item.id}
                                                style={[styles.studentSelectionCard, isSelected && { borderColor: theme.primary, backgroundColor: theme.primary + '05' }]}
                                                onPress={() => setSelectedStudentIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                                            >
                                                <View style={[styles.selectionCircle, isSelected && styles.selectionCircleActive]}>
                                                    {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                                                </View>
                                                
                                                <View style={[styles.avatar, { width: 40, height: 40, borderRadius: 20, marginRight: 12, overflow: 'hidden' }]}>
                                                    {item.photo_url ? (
                                                        <Image source={{ uri: getFullImageUrl(item.photo_url) ?? undefined }} style={{ width: '100%', height: '100%' }} />
                                                    ) : (
                                                        <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
                                                    )}
                                                </View>

                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.studentRowName, { color: theme.text }]}>{item.name}</Text>
                                                    <Text style={styles.studentRowMeta}>Class {item.class}-{item.section} | Roll: {item.roll_no}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}

                                    <View style={{ paddingVertical: 20, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>{selectedStudentIds.length} Students Selected</Text>
                                        {selectedStudentIds.length > 0 && (
                                            <TouchableOpacity onPress={() => setSelectedStudentIds([])}>
                                                <Text style={{ color: theme.danger, fontSize: 11, fontWeight: '800' }}>CLEAR ALL</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {/* Action Buttons inside ScrollView with enough space */}
                                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                                        <TouchableOpacity style={[styles.nextBtn, { backgroundColor: theme.border, flex: 0.4 }]} onPress={() => setStep(1)}>
                                            <Text style={[styles.nextBtnText, { color: theme.text }]}>Back</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={[styles.nextBtn, { flex: 1 }]} 
                                            onPress={handlePublish}
                                            disabled={submitting}
                                        >
                                            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Confirm & Publish</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* --- DETAIL MODAL --- */}
            <Modal visible={showDetailModal} transparent animationType="slide" onRequestClose={() => setShowDetailModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{selectedGroup?.reason}</Text>
                            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.detailListHeader}>
                            <View style={styles.detailSearchRow}>
                                <View style={styles.detailSearch}>
                                    <Ionicons name="search" size={18} color={theme.textLight} />
                                    <TextInput 
                                        style={styles.detailSearchInput} 
                                        placeholder="Find student..." 
                                        placeholderTextColor={theme.textLight}
                                        value={detailSearch}
                                        onChangeText={setDetailSearch}
                                    />
                                </View>
                                <TextInput 
                                    style={[styles.miniInput, { flex: 0.4, height: 40 }]} 
                                    placeholder="Class" 
                                    placeholderTextColor={theme.textLight}
                                    value={detailClassFilter}
                                    onChangeText={setDetailClassFilter}
                                />
                                <TextInput 
                                    style={[styles.miniInput, { flex: 0.3, height: 40 }]} 
                                    placeholder="Sec" 
                                    placeholderTextColor={theme.textLight}
                                    value={detailSectionFilter}
                                    onChangeText={setDetailSectionFilter}
                                />
                            </View>
                        </View>

                        {detailLoading ? (
                            <ActivityIndicator style={{ marginTop: 20 }} color={theme.primary} />
                        ) : (
                            <FlatList 
                                data={filteredDetailStudents}
                                keyExtractor={item => item.id.toString()}
                                renderItem={({ item }) => {
                                    const isPaid = item.status === 'paid';
                                    const isPartial = item.status === 'partial';
                                    return (
                                        <View style={styles.studentRow}>
                                            <TouchableOpacity 
                                                style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
                                                onPress={() => { setHistoryStudent(item); setShowHistoryModal(true); }}
                                            >
                                                <View style={[styles.avatar, { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }]}>
                                                    {item.photo_url ? (
                                                        <Image source={{ uri: getFullImageUrl(item.photo_url) ?? undefined }} style={{ width: '100%', height: '100%' }} />
                                                    ) : (
                                                        <Text style={styles.avatarText}>{item.name?.charAt(0)}</Text>
                                                    )}
                                                </View>

                                                <View style={styles.studentRowInfo}>
                                                    <Text style={styles.studentRowName}>{item.name}</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={styles.studentRowMeta}>Class {item.class}-{item.section}</Text>
                                                        {isPartial && (
                                                            <View style={{ backgroundColor: '#f59e0b15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                                <Text style={{ color: '#f59e0b', fontSize: 8, fontWeight: '800' }}>HALF PAID</Text>
                                                            </View>
                                                        )}
                                                        <Ionicons 
                                                            name="information-circle-outline" 
                                                            size={12} 
                                                            color={isPartial ? "#f59e0b" : theme.primary} 
                                                        />
                                                    </View>
                                                </View>
                                            </TouchableOpacity>

                                            <TouchableOpacity 
                                                style={styles.studentRowDue}
                                                disabled={isPaid}
                                                onPress={() => {
                                                    setOverridePayment(item);
                                                    setOverrideReasons(item.breakdown ? item.breakdown.map((r: any) => ({ ...r })) : [{ reason: selectedGroup.reason, amount: item.due_amount }]);
                                                    setShowOverrideModal(true);
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Text style={[styles.dueAmt, !isPaid && { color: theme.primary }]}>
                                                        ₹{parseFloat(item.due_amount).toLocaleString()}
                                                    </Text>
                                                    {!isPaid && (
                                                        <Ionicons name="pencil-sharp" size={10} color={theme.primary} />
                                                    )}
                                                </View>
                                                <Text style={[styles.paidAmt, isPartial && { color: '#f59e0b' }]}>
                                                    {isPartial ? 'Partially Paid: ' : 'Paid: '}₹{parseFloat(item.paid_amount).toLocaleString()}
                                                </Text>
                                            </TouchableOpacity>
                                            {isPaid ? (
                                                <TouchableOpacity 
                                                    style={[styles.collectBtn, { backgroundColor: '#4CAF5020', flexDirection: 'row', gap: 4, paddingHorizontal: 12 }]} 
                                                    onPress={() => handleDownload(item)}
                                                >
                                                    <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                                                    <Text style={[styles.collectBtnText, { color: '#4CAF50' }]}>Paid</Text>
                                                    <Ionicons name="download-outline" size={12} color="#4CAF50" style={{ marginLeft: 4 }} />
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity 
                                                    style={styles.collectBtn}
                                                    onPress={() => {
                                                        setActivePayment(item);
                                                        setCollectAmount((parseFloat(item.due_amount) - parseFloat(item.paid_amount)).toString());
                                                        setShowCollectModal(true);
                                                    }}
                                                >
                                                    <Text style={styles.collectBtnText}>Collect</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                }}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* --- COLLECT MODAL --- */}
            <Modal visible={showCollectModal} transparent animationType="fade" onRequestClose={() => setShowCollectModal(false)}>
                <View style={[styles.modalOverlay, { justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                    <View style={[styles.modalContent, { height: 'auto', margin: 20, borderRadius: 24, padding: 20 }]}>
                        <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 20 }]}>Collect Payment</Text>
                        <Text style={{ textAlign: 'center', color: theme.textLight, marginBottom: 10 }}>Student: {activePayment?.name}</Text>
                        
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Amount to Collect (₹)</Text>
                            <TextInput 
                                style={styles.input} 
                                placeholder="Enter amount" 
                                keyboardType="numeric"
                                value={collectAmount}
                                onChangeText={setCollectAmount}
                                autoFocus
                            />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: theme.border }]} onPress={() => setShowCollectModal(false)}>
                                <Text style={[styles.nextBtnText, { color: theme.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.nextBtn} onPress={handleCollect} disabled={submitting}>
                                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Confirm</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- OVERRIDE MODAL --- */}
            <Modal visible={showOverrideModal} transparent animationType="fade" onRequestClose={() => setShowOverrideModal(false)}>
                <View style={[styles.modalOverlay, { justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                    <View style={[styles.modalContent, { height: 'auto', margin: 20, borderRadius: 24, padding: 20 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={styles.modalTitle}>Override Price</Text>
                            <TouchableOpacity onPress={() => setShowOverrideModal(false)}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={{ color: theme.textLight, marginBottom: 15 }}>Adjust amounts for {overridePayment?.name}</Text>
                        
                        <ScrollView style={{ maxHeight: SCREEN_HEIGHT * 0.4 }} showsVerticalScrollIndicator={false}>
                            {overrideReasons.map((r, idx) => (
                                <View key={idx} style={[styles.reasonRow, { marginBottom: 15 }]}>
                                    <Text style={[styles.label, { flex: 2, marginBottom: 0 }]}>{r.reason}</Text>
                                    <View style={[styles.amtInput, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
                                        <Text style={{ color: theme.textLight, fontSize: 12 }}>₹</Text>
                                        <TextInput 
                                            style={{ flex: 1, color: theme.text, fontSize: 12, padding: 0 }} 
                                            keyboardType="numeric"
                                            value={r.amount.toString()}
                                            onChangeText={v => {
                                                const newList = [...overrideReasons];
                                                newList[idx].amount = v;
                                                setOverrideReasons(newList);
                                            }}
                                        />
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={[styles.summaryBar, { marginTop: 15, marginBottom: 20 }]}>
                            <Text style={styles.summaryLabel}>New Total:</Text>
                            <Text style={styles.summaryValue}>₹{overrideReasons.reduce((sum, r) => sum + parseFloat(r.amount || '0'), 0).toLocaleString()}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: theme.border }]} onPress={() => setShowOverrideModal(false)}>
                                <Text style={[styles.nextBtnText, { color: theme.text }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.nextBtn} onPress={handleOverride} disabled={submitting}>
                                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Save Override</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* --- HISTORY MODAL --- */}
            <Modal visible={showHistoryModal} transparent animationType="fade" onRequestClose={() => setShowHistoryModal(false)}>
                <View style={[styles.modalOverlay, { justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                    <View style={[styles.modalContent, { height: 'auto', margin: 20, borderRadius: 24, padding: 20, maxHeight: SCREEN_HEIGHT * 0.7 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={styles.modalTitle}>Transaction History</Text>
                            <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, backgroundColor: theme.background, padding: 12, borderRadius: 16 }}>
                            <View style={[styles.avatar, { width: 40, height: 40, borderRadius: 20 }]}>
                                <Text style={styles.avatarText}>{historyStudent?.name?.charAt(0)}</Text>
                            </View>
                            <View>
                                <Text style={[styles.studentRowName, { fontSize: 14 }]}>{historyStudent?.name}</Text>
                                <Text style={styles.studentRowMeta}>Class {historyStudent?.class}-{historyStudent?.section} | R: {historyStudent?.roll_no}</Text>
                            </View>
                        </View>

                        <View style={{ gap: 10, marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: theme.textLight, fontSize: 12 }}>Initial Amount:</Text>
                                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>₹{parseFloat(historyStudent?.original_amount || 0).toLocaleString()}</Text>
                            </View>
                            {Math.abs(parseFloat(historyStudent?.due_amount || 0) - parseFloat(historyStudent?.original_amount || 0)) > 0.01 && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: theme.primary, fontSize: 12 }}>Overridden Amount:</Text>
                                    <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>₹{parseFloat(historyStudent?.due_amount || 0).toLocaleString()}</Text>
                                </View>
                            )}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '700' }}>Total Collected:</Text>
                                <Text style={{ color: '#4CAF50', fontSize: 14, fontWeight: '900' }}>₹{parseFloat(historyStudent?.paid_amount || 0).toLocaleString()}</Text>
                            </View>
                        </View>

                        <Text style={[styles.label, { marginBottom: 10 }]}>Payment Logs</Text>
                        <ScrollView style={{ marginBottom: 20 }}>
                            {historyStudent?.transactions && historyStudent.transactions.length > 0 ? (
                                historyStudent.transactions.map((t: any, i: number) => {
                                    const tDate = new Date(t.created_at);
                                    return (
                                        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                                            <View>
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.text }}>{tDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {tDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                                                <Text style={{ fontSize: 10, color: theme.textLight }}>{t.payment_method} | By: {t.collected_by}</Text>
                                            </View>
                                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#4CAF50' }}>+ ₹{parseFloat(t.amount).toLocaleString()}</Text>
                                        </View>
                                    );
                                })
                            ) : (
                                <Text style={{ textAlign: 'center', color: theme.textLight, padding: 20 }}>No logs found.</Text>
                            )}
                        </ScrollView>

                        <TouchableOpacity style={styles.nextBtn} onPress={() => setShowHistoryModal(false)}>
                            <Text style={styles.nextBtnText}>Close History</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}