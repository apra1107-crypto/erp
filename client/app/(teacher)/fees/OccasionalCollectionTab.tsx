import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, Image, Dimensions } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../../../constants/Config';
import Toast from 'react-native-toast-message';
import { generateFeeReceipt, previewFeeReceipt } from '../../../utils/feeReceiptGenerator';

interface OccasionalCollectionTabProps {
    selectedMonth: string;
    onPreviewReceipt: (fee: any, student: any) => void;
}

const OccasionalCollectionTab = ({ selectedMonth, onPreviewReceipt }: OccasionalCollectionTabProps) => {
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [occasionalHistory, setOccasionalHistory] = useState<any[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Details Modal State
    const [isDetailsVisible, setIsDetailsVisible] = useState(false);
    const [selectedBatch, setSelectedBatch] = useState<any>(null);
    const [batchStudents, setBatchStudents] = useState<any[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [instituteInfo, setInstituteInfo] = useState<any>(null);
    const [isReceiptGenerating, setIsReceiptGenerating] = useState(false);

    // Batch Filter State
    const [batchFilterClass, setBatchFilterClass] = useState<string>('ALL');
    const [batchFilterSection, setBatchFilterSection] = useState<string>('ALL');
    const [expandedBatchFilter, setExpandedBatchFilter] = useState<'class' | 'section' | null>(null);

    // Form State
    const [availableStudents, setAvailableStudents] = useState<any[]>([]);
    const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
    const [charges, setCharges] = useState<{ fee_name: string, amount: string }[]>([{ fee_name: '', amount: '' }]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClass, setFilterClass] = useState<string>('ALL');
    const [filterSection, setFilterSection] = useState<string>('ALL');
    const [expandedFilter, setExpandedFilter] = useState<'class' | 'section' | null>(null);

    // Auth Helpers
    const getToken = async () => {
        return await AsyncStorage.getItem('token') || await AsyncStorage.getItem('teacherToken');
    };

    const getUserData = async () => {
        const data = await AsyncStorage.getItem('userData') || await AsyncStorage.getItem('teacherData');
        return data ? JSON.parse(data) : null;
    };

    useEffect(() => {
        fetchHistory();
    }, [selectedMonth]);

    const availableBatchFilters = useMemo(() => {
        const classes = new Set<string>(['ALL']);
        const sections = new Set<string>(['ALL']);
        batchStudents.forEach(s => {
            classes.add(s.class);
            if (batchFilterClass === 'ALL' || s.class === batchFilterClass) {
                sections.add(s.section);
            }
        });
        return {
            classes: Array.from(classes).sort((a, b) => a === 'ALL' ? -1 : b === 'ALL' ? 1 : a.localeCompare(b, undefined, { numeric: true })),
            sections: Array.from(sections).sort()
        };
    }, [batchStudents, batchFilterClass]);

    const filteredBatchStudents = useMemo(() => {
        return batchStudents.filter(s => {
            const matchesClass = batchFilterClass === 'ALL' || s.class === batchFilterClass;
            const matchesSection = batchFilterSection === 'ALL' || s.section === batchFilterSection;
            return matchesClass && matchesSection;
        });
    }, [batchStudents, batchFilterClass, batchFilterSection]);

    const availableFilters = useMemo(() => {
        const classes = new Set<string>(['ALL']);
        const sections = new Set<string>(['ALL']);
        availableStudents.forEach(s => {
            classes.add(s.class);
            if (filterClass === 'ALL' || s.class === filterClass) {
                sections.add(s.section);
            }
        });
        return {
            classes: Array.from(classes).sort((a, b) => a === 'ALL' ? -1 : b === 'ALL' ? 1 : a.localeCompare(b, undefined, { numeric: true })),
            sections: Array.from(sections).sort()
        };
    }, [availableStudents, filterClass]);

    const filteredStudents = useMemo(() => {
        return availableStudents.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesClass = filterClass === 'ALL' || s.class === filterClass;
            const matchesSection = filterSection === 'ALL' || s.section === filterSection;
            return matchesSearch && matchesClass && matchesSection;
        });
    }, [availableStudents, searchQuery, filterClass, filterSection]);

    const isAllSelected = useMemo(() => {
        if (filteredStudents.length === 0) return false;
        return filteredStudents.every(s => selectedStudents.includes(s.id));
    }, [filteredStudents, selectedStudents]);

    const handleSelectAll = () => {
        if (isAllSelected) {
            const filteredIds = filteredStudents.map(s => s.id);
            setSelectedStudents(selectedStudents.filter(id => !filteredIds.includes(id)));
        } else {
            const newSelected = [...selectedStudents];
            filteredStudents.forEach(s => {
                if (!newSelected.includes(s.id)) newSelected.push(s.id);
            });
            setSelectedStudents(newSelected);
        }
    };

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const user = await getUserData();
            if (!user) return;
            
            setInstituteInfo(user);
            const instId = user.institute_id || user.id;

            const res = await axios.get(
                `${API_ENDPOINTS.FEES}/occasional-history/${instId}?month=${selectedMonth}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setOccasionalHistory(res.data);
        } catch (error) {
            console.error('Error fetching occasional history:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBatchDetails = async (batch: any) => {
        try {
            setDetailsLoading(true);
            setSelectedBatch(batch);
            setIsDetailsVisible(true);
            
            // Reset filters for new batch
            setBatchFilterClass('ALL');
            setBatchFilterSection('ALL');
            setExpandedBatchFilter(null);

            const token = await getToken();
            const user = await getUserData();
            const instId = user.institute_id || user.id;

            const res = await axios.get(
                `${API_ENDPOINTS.FEES}/occasional-details/${instId}?batch_id=${batch.batch_id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setBatchStudents(res.data);
        } catch (error) {
            console.error('Error fetching batch details:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load student list' });
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleMarkBatchPaid = async (student: any) => {
        Alert.alert(
            "Confirm Payment",
            `Collect ₹${student.total_amount} from ${student.name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                                    onPress: async () => {
                                        try {
                                            const token = await getToken();
                                            const user = await getUserData();
                                            const instId = user.institute_id || user.id;
                    
                                            await axios.put(
                                                `${API_ENDPOINTS.FEES}/occasional-batch-pay/${instId}`,                                {
                                    batch_id: selectedBatch.batch_id,
                                    student_id: student.student_id,
                                    collectedBy: user.principal_name || user.name
                                },
                                { headers: { Authorization: `Bearer ${token}` } }
                            );

                            Toast.show({ type: 'success', text1: 'Success', text2: 'Payment recorded' });
                            fetchBatchDetails(selectedBatch);
                            fetchHistory();
                        } catch (error) {
                            console.error('Batch payment error:', error);
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to record payment' });
                        }
                    }
                }
            ]
        );
    };

    const handleViewReceipt = async (student: any) => {
        if (isReceiptGenerating) return;
        try {
            setIsReceiptGenerating(true);
            const feeData = {
                ...student,
                month_year: selectedMonth
            };
            await generateFeeReceipt(feeData, instituteInfo, student);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to generate receipt' });
        } finally {
            setIsReceiptGenerating(false);
        }
    };

    const handlePreviewReceipt = (student: any) => {
        const feeData = {
            ...student,
            month_year: selectedMonth
        };
        onPreviewReceipt(feeData, student);
    };

    const fetchStudents = async () => {
        try {
            const token = await getToken();
            const res = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/student/list?month=${selectedMonth}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAvailableStudents(res.data.students || []);
        } catch (error) {
            console.error('Error fetching students:', error);
        }
    };

    useEffect(() => {
        if (isModalVisible) {
            fetchStudents();
        }
    }, [isModalVisible]);

    const handleAddCharge = async () => {
        if (!selectedStudents.length) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Select at least one student' });
            return;
        }

        const validCharges = charges.filter(c => c.fee_name && c.amount);
        if (!validCharges.length) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Add at least one valid charge' });
            return;
        }

        try {
            setIsSubmitting(true);
            const token = await getToken();
            const user = await getUserData();
            const instId = user.institute_id || user.id;

            await axios.post(
                `${API_ENDPOINTS.FEES}/occasional/${instId}`,
                {
                    studentIds: selectedStudents,
                    month_year: selectedMonth,
                    charges: validCharges
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            Toast.show({ type: 'success', text1: 'Success', text2: 'Occasional charges applied' });
            setIsModalVisible(false);
            fetchHistory();
            setSelectedStudents([]);
            setCharges([{ fee_name: '', amount: '' }]);
        } catch (error) {
            console.error('Error adding charges:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to add charges' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleStudent = (id: number) => {
        if (selectedStudents.includes(id)) {
            setSelectedStudents(selectedStudents.filter(sid => sid !== id));
        } else {
            setSelectedStudents([...selectedStudents, id]);
        }
    };

    const summary = useMemo(() => {
        const expected = occasionalHistory.reduce((acc, curr) => acc + parseFloat(curr.total_expected || 0), 0);
        const collected = occasionalHistory.reduce((acc, curr) => acc + parseFloat(curr.total_collected || 0), 0);
        return { expected, collected };
    }, [occasionalHistory]);

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, padding: 16 },
        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        flashCard: {
            backgroundColor: theme.card,
            padding: 20,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.05, shadowRadius: 10, elevation: 5,
        },
        cardTitle: { color: theme.textLight, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
        cardValue: { color: theme.text, fontSize: 24, fontWeight: '900' },
        collectedValue: { color: theme.primary, fontSize: 24, fontWeight: '900' },
        historyItem: {
            backgroundColor: theme.card,
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.05,
            shadowRadius: 8,
            elevation: 3,
        },
        historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        reasonText: { fontSize: 16, fontWeight: '800', color: theme.text, flex: 1 },
        statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
        historyStats: { fontSize: 13, color: theme.textLight },
        amountText: { fontSize: 16, fontWeight: '800', color: theme.primary },
        emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
        emptyText: { color: theme.textLight, fontSize: 16, textAlign: 'center', marginTop: 16, fontWeight: '600' },
        fab: {
            position: 'absolute', bottom: 16, right: 16, width: 56, height: 56, borderRadius: 28,
            backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', elevation: 8,
            shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4,
        },
        
        // Modal Styles
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
        modalContent: {
            backgroundColor: theme.card, borderTopLeftRadius: 32, borderTopRightRadius: 32,
            height: '92%', padding: 24,
        },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
        modalTitle: { fontSize: 24, fontWeight: '900', color: theme.text },
        closeBtn: { padding: 8, borderRadius: 20, backgroundColor: theme.background },
        
        // Section Styling
        sectionContainer: { marginBottom: 30 },
        sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4 },
        sectionSubtitle: { fontSize: 13, color: theme.textLight, marginBottom: 15 },

        // Charges Inputs
        chargeInputRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' },
        cleanInput: { 
            backgroundColor: theme.background, height: 48, borderRadius: 12, borderWidth: 1, 
            borderColor: theme.border, paddingHorizontal: 12, color: theme.text, fontWeight: '600', fontSize: 14
        },
        removeChargeBtn: { padding: 8 },
        addChargeLink: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
        addChargeText: { marginLeft: 6, color: theme.primary, fontWeight: '700', fontSize: 14 },

        // Selection List
        cleanSearchBox: {
            flexDirection: 'row', alignItems: 'center', backgroundColor: theme.background,
            borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 15, borderWidth: 1, borderColor: theme.border,
        },
        cleanSearchInput: { flex: 1, marginLeft: 10, color: theme.text, fontWeight: '600', fontSize: 15 },
        
        cleanFilterBtn: {
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: theme.background, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 12,
            borderWidth: 1, borderColor: theme.border,
        },
        activeFilterBtn: { borderColor: theme.primary, backgroundColor: theme.primary + '05' },
        filterBtnText: { fontSize: 13, fontWeight: '800', color: theme.textLight, textTransform: 'uppercase' },
        
        filterOptions: { backgroundColor: theme.background, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 15 },
        optionChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, marginRight: 8 },
        activeOptionChip: { backgroundColor: theme.primary, borderColor: theme.primary },
        optionChipText: { fontSize: 13, fontWeight: '700', color: theme.text },
        activeOptionChipText: { color: '#fff' },

        selectAllBar: {
            flexDirection: 'row', alignItems: 'center', marginBottom: 15, 
            backgroundColor: theme.primary + '08', padding: 12, borderRadius: 14, 
            borderWidth: 1, borderColor: theme.primary + '20'
        },
        selectAllText: { marginLeft: 12, color: theme.text, fontWeight: '800', fontSize: 14, flex: 1 },
        filteredCount: { fontSize: 12, fontWeight: '700', color: theme.textLight },

        selectionList: { maxHeight: 300, marginBottom: 20 },
        selectionItem: {
            flexDirection: 'row', alignItems: 'center', backgroundColor: theme.background,
            padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.border,
        },
        selectionItemActive: { borderColor: theme.primary, backgroundColor: theme.primary + '05' },
        selectionAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
        selectionName: { fontSize: 15, fontWeight: '700', color: theme.text },
        selectionSub: { fontSize: 12, color: theme.textLight, marginTop: 2 },
        checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' },
        checkboxActive: { backgroundColor: theme.primary, borderColor: theme.primary },

        // Buttons
        cleanSubmitBtn: { 
            backgroundColor: theme.primary, height: 56, borderRadius: 16, 
            justifyContent: 'center', alignItems: 'center', marginTop: 10,
            shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
        },
        cleanSubmitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

        // Batch Details Item Styles
        studentItem: {
            backgroundColor: theme.background, padding: 12, borderRadius: 12, marginBottom: 10,
            borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center',
        },
        studentImage: { width: 50, height: 50, borderRadius: 25, backgroundColor: theme.border, marginRight: 12 },
        studentInfo: { flex: 1, justifyContent: 'center' },
        studentName: { fontSize: 15, fontWeight: '700', color: theme.text, includeFontPadding: false },
        studentSub: { fontSize: 12, color: theme.textLight, includeFontPadding: false, marginTop: 0 },
        payBtn: { backgroundColor: theme.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, shadowColor: theme.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
        payBtnText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
        receiptBtnCompact: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.primary + '20' },
        paidBadge: { backgroundColor: theme.success + '15', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.success + '20' },
        paidText: { color: theme.success, fontSize: 11, fontWeight: '900', marginLeft: 4, letterSpacing: 0.5 }
    }), [theme, isDark]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const hasData = occasionalHistory.length > 0;

    return (
        <View style={styles.container}>
            {hasData ? (
                <>
                    <View style={styles.flashCard}>
                        <View>
                            <Text style={styles.cardTitle}>Total Expected</Text>
                            <Text style={styles.cardValue}>₹{summary.expected.toLocaleString()}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.cardTitle}>Total Collected</Text>
                            <Text style={styles.collectedValue}>₹{summary.collected.toLocaleString()}</Text>
                        </View>
                    </View>

                    <FlatList
                        data={occasionalHistory}
                        keyExtractor={(item) => item.batch_id || Math.random().toString()}
                        renderItem={({ item }) => {
                            const isFullyPaid = parseInt(item.paid_students) === parseInt(item.total_students);
                            return (
                                <TouchableOpacity style={styles.historyItem} onPress={() => fetchBatchDetails(item)}>
                                    <View style={styles.historyTop}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.reasonText} numberOfLines={1}>{item.reasons}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <Ionicons name="calendar-outline" size={12} color={theme.textLight} />
                                                <Text style={{ fontSize: 12, color: theme.textLight, marginLeft: 4 }}>
                                                    {new Date(item.created_at_max).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                </Text>
                                                <Text style={{ marginHorizontal: 6, color: theme.border }}>|</Text>
                                                <Ionicons name="people-outline" size={12} color={theme.textLight} />
                                                <Text style={{ fontSize: 12, color: theme.textLight, marginLeft: 4 }}>
                                                    {item.paid_students}/{item.total_students} Paid
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.amountText}>₹{parseFloat(item.total_collected || 0).toLocaleString()}</Text>
                                            <Text style={{ fontSize: 11, color: theme.textLight }}>of ₹{parseFloat(item.total_expected || 0).toLocaleString()}</Text>
                                        </View>
                                    </View>
                                    
                                    {/* Progress Bar */}
                                    <View style={{ height: 4, backgroundColor: theme.border + '50', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
                                        <View 
                                            style={{ 
                                                height: '100%', 
                                                backgroundColor: isFullyPaid ? theme.success : theme.primary, 
                                                width: `${(item.paid_students / item.total_students) * 100}%` 
                                            }} 
                                        />
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                        showsVerticalScrollIndicator={false}
                    />
                </>
            ) : (
                <View style={styles.emptyState}>
                    <Ionicons name="receipt-outline" size={80} color={theme.primary + '30'} />
                    <Text style={styles.emptyText}>No occasional fees for {selectedMonth}.</Text>
                    <Text style={{ color: theme.textLight, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                        Add one-time charges like Exam Fees, Uniform, or Picnic for specific students.
                    </Text>
                </View>
            )}

            <TouchableOpacity style={styles.fab} onPress={() => setIsModalVisible(true)}>
                <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>

            {/* Add Occasional Modal */}
            <Modal visible={isModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
                        style={{flex: 1, justifyContent: 'flex-end'}}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 40}
                    >
                    <View style={[styles.modalContent, { height: undefined, maxHeight: '95%' }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Occasional Charge</Text>
                                <Text style={{fontSize: 14, color: theme.textLight, marginTop: 2}}>{selectedMonth}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView 
                            showsVerticalScrollIndicator={false} 
                            contentContainerStyle={{paddingBottom: Platform.OS === 'ios' ? 120 : 180}} 
                            keyboardShouldPersistTaps="handled"
                        >
                            
                            {/* Charges Section */}
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>Charges</Text>
                                <Text style={styles.sectionSubtitle}>Enter the items and amounts to bill.</Text>
                                
                                {charges.map((charge, index) => (
                                    <View key={index} style={styles.chargeInputRow}>
                                        <View style={{flex: 2}}>
                                            <TextInput 
                                                style={styles.cleanInput} 
                                                placeholder="Reason (e.g. Picnic)" 
                                                placeholderTextColor={theme.textLight + '60'} 
                                                value={charge.fee_name} 
                                                onChangeText={(val) => { 
                                                    const newCharges = [...charges]; 
                                                    newCharges[index].fee_name = val; 
                                                    setCharges(newCharges); 
                                                }} 
                                            />
                                        </View>
                                        <View style={{flex: 1}}>
                                            <TextInput 
                                                style={styles.cleanInput} 
                                                placeholder="Amount" 
                                                placeholderTextColor={theme.textLight + '60'} 
                                                keyboardType="numeric" 
                                                value={charge.amount} 
                                                onChangeText={(val) => { 
                                                    const newCharges = [...charges]; 
                                                    newCharges[index].amount = val; 
                                                    setCharges(newCharges); 
                                                }} 
                                            />
                                        </View>
                                        {charges.length > 1 && (
                                            <TouchableOpacity 
                                                style={styles.removeChargeBtn}
                                                onPress={() => setCharges(charges.filter((_, i) => i !== index))}
                                            >
                                                <Ionicons name="trash-outline" size={20} color={theme.danger} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                                
                                <TouchableOpacity 
                                    style={styles.addChargeLink} 
                                    onPress={() => setCharges([...charges, { fee_name: '', amount: '' }])}
                                >
                                    <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                                    <Text style={styles.addChargeText}>Add another item</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Selection Filters Section */}
                            <View style={styles.sectionContainer}>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                                    <View>
                                        <Text style={styles.sectionTitle}>Select Students</Text>
                                        <Text style={styles.sectionSubtitle}>{selectedStudents.length} students selected</Text>
                                    </View>
                                    {selectedStudents.length > 0 && (
                                        <TouchableOpacity onPress={() => setSelectedStudents([])}>
                                            <Text style={{color: theme.danger, fontWeight: '700', fontSize: 13}}>Clear Selection</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Inline Search Bar */}
                                <View style={styles.cleanSearchBox}>
                                    <Ionicons name="search" size={18} color={theme.textLight} />
                                    <TextInput 
                                        style={styles.cleanSearchInput} 
                                        placeholder="Search by name..." 
                                        placeholderTextColor={theme.textLight + '60'} 
                                        value={searchQuery} 
                                        onChangeText={setSearchQuery} 
                                    />
                                    {searchQuery.length > 0 && (
                                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                                            <Ionicons name="close-circle" size={18} color={theme.textLight} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {/* Dropdown Filters */}
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: expandedFilter ? 10 : 15 }}>
                                    <TouchableOpacity 
                                        style={[styles.cleanFilterBtn, expandedFilter === 'class' && styles.activeFilterBtn]}
                                        onPress={() => setExpandedFilter(expandedFilter === 'class' ? null : 'class')}
                                    >
                                        <Text style={styles.filterBtnText}>Class: <Text style={{color: theme.primary}}>{filterClass === 'ALL' ? 'All' : filterClass}</Text></Text>
                                        <Ionicons name="chevron-down" size={14} color={theme.textLight} />
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={[styles.cleanFilterBtn, expandedFilter === 'section' && styles.activeFilterBtn]}
                                        onPress={() => setExpandedFilter(expandedFilter === 'section' ? null : 'section')}
                                    >
                                        <Text style={styles.filterBtnText}>Section: <Text style={{color: theme.primary}}>{filterSection === 'ALL' ? 'All' : filterSection}</Text></Text>
                                        <Ionicons name="chevron-down" size={14} color={theme.textLight} />
                                    </TouchableOpacity>
                                </View>

                                {expandedFilter === 'class' && (
                                    <View style={styles.filterOptions}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            {availableFilters.classes.map(cls => (
                                                <TouchableOpacity 
                                                    key={`cls-${cls}`} 
                                                    style={[styles.optionChip, filterClass === cls && styles.activeOptionChip]} 
                                                    onPress={() => { setFilterClass(cls); setFilterSection('ALL'); setExpandedFilter(null); }}
                                                >
                                                    <Text style={[styles.optionChipText, filterClass === cls && styles.activeOptionChipText]}>{cls}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {expandedFilter === 'section' && (
                                    <View style={styles.filterOptions}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            {availableFilters.sections.map(sec => (
                                                <TouchableOpacity 
                                                    key={`sec-${sec}`} 
                                                    style={[styles.chip, filterSection === sec && styles.activeChip]} 
                                                    onPress={() => { setFilterSection(sec); setExpandedFilter(null); }}
                                                >
                                                    <Text style={[styles.chipText, filterSection === sec && styles.activeChipText]}>{sec}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {/* Select All Toggle */}
                                <TouchableOpacity 
                                    style={styles.selectAllBar}
                                    onPress={handleSelectAll}
                                >
                                    <View style={[styles.checkbox, isAllSelected && styles.checkboxActive]}>
                                        {isAllSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                    <Text style={styles.selectAllText}>
                                        {isAllSelected ? 'Deselect All' : 'Select All Filtered'}
                                    </Text>
                                    <Text style={styles.filteredCount}>{filteredStudents.length} students</Text>
                                </TouchableOpacity>

                                {/* Student Selection List Container */}
                                <View style={styles.selectionList}>
                                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true}>
                                        {filteredStudents.map(student => {
                                            const isSelected = selectedStudents.includes(student.id);
                                            return (
                                                <TouchableOpacity 
                                                    key={student.id} 
                                                    style={[styles.selectionItem, isSelected && styles.selectionItemActive]} 
                                                    onPress={() => toggleStudent(student.id)}
                                                >
                                                    <Image 
                                                        source={student.photo_url ? { uri: student.photo_url } : require('../../../assets/images/favicon.png')} 
                                                        style={styles.selectionAvatar} 
                                                    />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.selectionName}>{student.name}</Text>
                                                        <Text style={styles.selectionSub}>Class {student.class}-{student.section} • Roll: {student.roll_no}</Text>
                                                    </View>
                                                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                                                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                        {filteredStudents.length === 0 && (
                                            <View style={{alignItems: 'center', paddingVertical: 30}}>
                                                <Text style={{ color: theme.textLight, fontSize: 14 }}>No students found.</Text>
                                            </View>
                                        )}
                                    </ScrollView>
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={[styles.cleanSubmitBtn, (isSubmitting || selectedStudents.length === 0) && {opacity: 0.6}]} 
                                onPress={handleAddCharge} 
                                disabled={isSubmitting || selectedStudents.length === 0}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.cleanSubmitBtnText}>Apply Charges to {selectedStudents.length} Students</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Details Modal */}
            <Modal visible={isDetailsVisible} animationType="fade" transparent={true} onRequestClose={() => setIsDetailsVisible(false)}>
                <View style={[styles.modalOverlay, {backgroundColor: 'rgba(0,0,0,0.7)'}]}>
                    <View style={[styles.modalContent, {height: '85%'}]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.modalTitle} numberOfLines={1}>{selectedBatch?.reasons}</Text>
                                <Text style={[styles.historyStats, { marginTop: 0 }]}>{selectedMonth}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsDetailsVisible(false)}>
                                <Ionicons name="close-circle" size={32} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        {/* Charge Breakdown Display */}
                        {batchStudents.length > 0 && (
                            <View style={{ backgroundColor: theme.primary + '10', padding: 12, borderRadius: 12, marginBottom: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                {batchStudents[0].items.split(' + ').map((name: string, i: number) => (
                                    <View key={i} style={{ backgroundColor: theme.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.primary + '20' }}>
                                        <Text style={{ fontSize: 11, color: theme.textLight }}>{name}</Text>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: theme.primary }}>₹{batchStudents[0].amount_breakdown.split(' + ')[i]}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Batch Details Filters */}
                        <View style={{ marginBottom: 15 }}>
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: expandedBatchFilter ? 10 : 0 }}>
                                <TouchableOpacity 
                                    style={[styles.cleanFilterBtn, expandedBatchFilter === 'class' && styles.activeFilterBtn]}
                                    onPress={() => setExpandedBatchFilter(expandedBatchFilter === 'class' ? null : 'class')}
                                >
                                    <Text style={styles.filterBtnText}>Class: <Text style={{color: theme.primary}}>{batchFilterClass === 'ALL' ? 'All' : batchFilterClass}</Text></Text>
                                    <Ionicons name="chevron-down" size={14} color={theme.textLight} />
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.cleanFilterBtn, expandedBatchFilter === 'section' && styles.activeFilterBtn]}
                                    onPress={() => setExpandedBatchFilter(expandedBatchFilter === 'section' ? null : 'section')}
                                >
                                    <Text style={styles.filterBtnText}>Section: <Text style={{color: theme.primary}}>{batchFilterSection === 'ALL' ? 'All' : batchFilterSection}</Text></Text>
                                    <Ionicons name="chevron-down" size={14} color={theme.textLight} />
                                </TouchableOpacity>
                            </View>

                            {expandedBatchFilter === 'class' && (
                                <View style={styles.filterOptions}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {availableBatchFilters.classes.map(cls => (
                                            <TouchableOpacity 
                                                key={`b-cls-${cls}`} 
                                                style={[styles.optionChip, batchFilterClass === cls && styles.activeOptionChip]} 
                                                onPress={() => { setBatchFilterClass(cls); setBatchFilterSection('ALL'); setExpandedBatchFilter(null); }}
                                            >
                                                <Text style={[styles.optionChipText, batchFilterClass === cls && styles.activeOptionChipText]}>{cls}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            {expandedBatchFilter === 'section' && (
                                <View style={styles.filterOptions}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {availableBatchFilters.sections.map(sec => (
                                            <TouchableOpacity 
                                                key={`b-sec-${sec}`} 
                                                style={[styles.optionChip, batchFilterSection === sec && styles.activeOptionChip]} 
                                                onPress={() => { setBatchFilterSection(sec); setExpandedFilter(null); }}
                                            >
                                                <Text style={[styles.optionChipText, batchFilterSection === sec && styles.activeOptionChipText]}>{sec}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        {detailsLoading ? (
                            <View style={{flex: 1, justifyContent: 'center'}}><ActivityIndicator size="large" color={theme.primary} /></View>
                        ) : (
                            <FlatList
                                data={filteredBatchStudents}
                                keyExtractor={(item) => item.student_id.toString()}
                                renderItem={({ item }) => (
                                    <View style={styles.studentItem}>
                                        <Image 
                                            source={item.photo_url ? { uri: item.photo_url } : require('../../../assets/images/favicon.png')} 
                                            style={styles.studentImage} 
                                        />
                                        <View style={styles.studentInfo}>
                                            <Text style={[styles.studentName, { marginBottom: 6 }]} numberOfLines={1}>{item.name}</Text>
                                            <Text style={styles.studentSub}>Class {item.class}-{item.section} • Roll: {item.roll_no}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end', minWidth: 95 }}>
                                            <Text style={{ fontWeight: '900', fontSize: 16, color: theme.text, marginBottom: 6 }}>
                                                ₹{parseFloat(item.total_amount || 0).toLocaleString()}
                                            </Text>
                                            {item.status === 'paid' ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={styles.paidBadge}>
                                                        <Ionicons name="checkmark-done" size={12} color={theme.success} />
                                                        <Text style={styles.paidText}>PAID</Text>
                                                    </View>
                                                    <TouchableOpacity 
                                                        style={[styles.receiptBtnCompact, { marginLeft: 8 }]} 
                                                        onPress={() => handlePreviewReceipt(item)}
                                                    >
                                                        <Ionicons name="eye-outline" size={18} color={theme.primary} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={[styles.receiptBtnCompact, { marginLeft: 8 }, isReceiptGenerating && { opacity: 0.5 }]} 
                                                        onPress={() => handleViewReceipt(item)}
                                                        disabled={isReceiptGenerating}
                                                    >
                                                        {isReceiptGenerating ? (
                                                            <ActivityIndicator size="small" color={theme.primary} />
                                                        ) : (
                                                            <Ionicons name="share-outline" size={18} color={theme.primary} />
                                                        )}
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <TouchableOpacity style={styles.payBtn} onPress={() => handleMarkBatchPaid(item)}>
                                                    <Text style={styles.payBtnText}>COLLECT</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default OccasionalCollectionTab;