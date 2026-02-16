import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, FlatList, Image, Alert, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../context/ThemeContext';
import { API_ENDPOINTS } from '../constants/Config';
import { generateFeeReceipt } from '../utils/feeReceiptGenerator';
import FeeReceiptModal from './FeeReceiptModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FeeHistoryBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    student: any;
    institute: any;
    canCollect?: boolean;
}

const FeeHistoryBottomSheet = ({ visible, onClose, student, institute, canCollect = true }: FeeHistoryBottomSheetProps) => {
    const { theme, isDark } = useTheme();
    
    const [studentHistory, setStudentHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [totalArrears, setTotalArrears] = useState(0);
    const [isReceiptGenerating, setIsReceiptGenerating] = useState(false);

    // Filter States
    const [filterType, setFilterType] = useState<'ALL' | 'monthly' | 'occasional'>('ALL');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'paid' | 'unpaid'>('ALL');
    const [filterMonth, setFilterMonth] = useState('ALL');
    const [showMonthPicker, setShowMonthPicker] = useState(false);

    // Receipt Modal State
    const [isReceiptModalVisible, setIsReceiptModalVisible] = useState(false);
    const [selectedFeeData, setSelectedFeeData] = useState<any>(null);

    useEffect(() => {
        if (visible && student) {
            fetchStudentHistory();
        }
    }, [visible, student]);

    const getToken = async () => {
        return await AsyncStorage.getItem('token') || await AsyncStorage.getItem('teacherToken');
    };

    const fetchStudentHistory = async () => {
        setHistoryLoading(true);
        try {
            const token = await getToken();
            const res = await axios.get(
                `${API_ENDPOINTS.FEES}/student/${student.id}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setStudentHistory(res.data.history || []);
            setTotalArrears(res.data.totalArrears || 0);
        } catch (error) {
            console.error('Error fetching history:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load fee history' });
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleMarkPaid = async (item: any) => {
        Alert.alert(
            "Confirm Collection",
            `Mark ₹${item.total_amount} as paid for ${student.name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Collect",
                    onPress: async () => {
                        try {
                            const token = await getToken();
                            const instId = institute.id || institute.institute_id;

                            if (item.fee_type === 'monthly') {
                                await axios.put(
                                    `${API_ENDPOINTS.FEES}/manual-pay/${item.id}`,
                                    {
                                        instituteId: instId,
                                        studentId: student.id,
                                        month_year: item.month_year,
                                        collectedBy: institute.principal_name || institute.name
                                    },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                );
                            } else {
                                await axios.put(
                                    `${API_ENDPOINTS.FEES}/occasional-batch-pay/${instId}`,
                                    {
                                        batch_id: item.batch_id,
                                        student_id: student.id,
                                        collectedBy: institute.principal_name || institute.name
                                    },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                );
                            }

                            Toast.show({ type: 'success', text1: 'Success', text2: 'Payment recorded successfully' });
                            fetchStudentHistory();
                        } catch (error) {
                            console.error('Payment error:', error);
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to record payment' });
                        }
                    }
                }
            ]
        );
    };

    const handleViewReceiptInternal = (item: any) => {
        setSelectedFeeData(item);
        setIsReceiptModalVisible(true);
    };

    const handleShareReceiptInternal = async (item: any) => {
        if (isReceiptGenerating) return;
        try {
            setIsReceiptGenerating(true);
            const studentDataForReceipt = {
                ...student,
                class: student.class,
                section: student.section,
                roll_no: student.roll_no
            };
            await generateFeeReceipt(item, institute, studentDataForReceipt);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to share receipt' });
        } finally {
            setIsReceiptGenerating(false);
        }
    };

    const filteredHistory = useMemo(() => {
        return studentHistory.filter(item => {
            const typeMatch = filterType === 'ALL' || item.fee_type === filterType;
            const statusMatch = filterStatus === 'ALL' || item.status === filterStatus;
            const monthMatch = filterMonth === 'ALL' || item.month_year === filterMonth;
            return typeMatch && statusMatch && monthMatch;
        });
    }, [studentHistory, filterType, filterStatus, filterMonth]);

    const handleMonthChange = (event: any, date?: Date) => {
        setShowMonthPicker(false);
        if (date) {
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            const formatted = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
            setFilterMonth(formatted);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
        modalContent: {
            backgroundColor: theme.card,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            height: '90%',
            padding: 24,
        },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text },
        
        historyContainer: { flex: 1 },
        historyHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
            backgroundColor: theme.background,
            padding: 15,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
        },
        historyAvatar: {
            width: 56,
            height: 56,
            borderRadius: 28,
            marginRight: 15,
            borderWidth: 2,
            borderColor: theme.primary,
        },
        historyStudentName: { fontSize: 18, fontWeight: '900', color: theme.text },
        historyStudentSub: { fontSize: 13, color: theme.textLight, fontWeight: '600' },
        
        statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
        statCard: {
            flex: 1,
            backgroundColor: theme.background,
            padding: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: 'center',
        },
        statLabel: { fontSize: 10, fontWeight: '800', color: theme.textLight, textTransform: 'uppercase', marginBottom: 4 },
        statValue: { fontSize: 16, fontWeight: '900' },
        
        filterSection: { marginBottom: 20 },
        filterScroll: { paddingBottom: 5 },
        filterChip: {
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: theme.background,
            borderWidth: 1,
            borderColor: theme.border,
            marginRight: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        activeFilterChip: { backgroundColor: theme.primary, borderColor: theme.primary },
        filterChipText: { fontSize: 12, fontWeight: '700', color: theme.text },
        activeFilterChipText: { color: '#fff' },
        filterGroupLabel: { fontSize: 11, fontWeight: '800', color: theme.textLight, textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 },

        historyItem: {
            backgroundColor: theme.background,
            padding: 15,
            borderRadius: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.border,
        },
        historyItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
        historyMonth: { fontSize: 15, fontWeight: '800', color: theme.text },
        historyType: {
            fontSize: 10,
            fontWeight: '800',
            textTransform: 'uppercase',
            color: theme.primary,
            backgroundColor: theme.primary + '15',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            marginTop: 4,
            alignSelf: 'flex-start',
        },
        historySummary: { fontSize: 11, fontWeight: '700', color: theme.secondary, marginTop: 4 },
        historyAmount: { fontSize: 16, fontWeight: '900' },
        historyStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
        historyStatusText: { fontSize: 11, fontWeight: '900' },
        historyDetails: { borderTopWidth: 1, borderTopColor: theme.border + '50', paddingTop: 10, marginTop: 5 },
        detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
        detailLabel: { fontSize: 12, color: theme.textLight, fontWeight: '600' },
        detailValue: { fontSize: 12, color: theme.text, fontWeight: '700' },
        
        payBtnSmall: { backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginTop: 8 },
        payBtnTextSmall: { color: '#fff', fontSize: 11, fontWeight: '900' },
        receiptActions: { flexDirection: 'row', gap: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: theme.border + '30', paddingTop: 10 },
        receiptBtnIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.primary + '20' },
    }), [theme, isDark]);

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Fee History</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={32} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>

                    {student && (
                        <View style={styles.historyHeader}>
                            <Image 
                                source={student.photo_url ? { uri: student.photo_url } : require('../assets/images/favicon.png')} 
                                style={styles.historyAvatar} 
                            />
                            <View>
                                <Text style={styles.historyStudentName}>{student.name}</Text>
                                <Text style={styles.historyStudentSub}>Class {student.class}-{student.section} • Roll: {student.roll_no}</Text>
                            </View>
                        </View>
                    )}

                    {historyLoading ? (
                        <View style={{flex: 1, justifyContent: 'center'}}><ActivityIndicator size="large" color={theme.primary} /></View>
                    ) : (
                        <View style={styles.historyContainer}>
                            <View style={styles.statsRow}>
                                <View style={styles.statCard}>
                                    <Text style={styles.statLabel}>Paid</Text>
                                    <Text style={[styles.statValue, {color: theme.success}]}>
                                        ₹{studentHistory.filter(h => h.status === 'paid').reduce((acc, curr) => acc + parseFloat(curr.total_amount || 0), 0).toLocaleString()}
                                    </Text>
                                </View>
                                <View style={styles.statCard}>
                                    <Text style={styles.statLabel}>Arrears</Text>
                                    <Text style={[styles.statValue, {color: theme.danger}]}>
                                        ₹{totalArrears.toLocaleString()}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.filterSection}>
                                <Text style={styles.filterGroupLabel}>Type & Status</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                                    <TouchableOpacity 
                                        style={[styles.filterChip, filterType === 'ALL' && styles.activeFilterChip]}
                                        onPress={() => setFilterType('ALL')}
                                    >
                                        <Text style={[styles.filterChipText, filterType === 'ALL' && styles.activeFilterChipText]}>All Types</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.filterChip, filterType === 'monthly' && styles.activeFilterChip]}
                                        onPress={() => setFilterType('monthly')}
                                    >
                                        <Text style={[styles.filterChipText, filterType === 'monthly' && styles.activeFilterChipText]}>Monthly</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.filterChip, filterType === 'occasional' && styles.activeFilterChip]}
                                        onPress={() => setFilterType('occasional')}
                                    >
                                        <Text style={[styles.filterChipText, filterType === 'occasional' && styles.activeFilterChipText]}>Occasional</Text>
                                    </TouchableOpacity>
                                    
                                    <View style={{width: 1, height: 20, backgroundColor: theme.border, marginHorizontal: 10, alignSelf: 'center'}} />

                                    <TouchableOpacity 
                                        style={[styles.filterChip, filterStatus === 'ALL' && styles.activeFilterChip]}
                                        onPress={() => setFilterStatus('ALL')}
                                    >
                                        <Text style={[styles.filterChipText, filterStatus === 'ALL' && styles.activeFilterChipText]}>All Status</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.filterChip, filterStatus === 'paid' && styles.activeFilterChip]}
                                        onPress={() => setFilterStatus('paid')}
                                    >
                                        <Text style={[styles.filterChipText, filterStatus === 'paid' && styles.activeFilterChipText]}>Paid</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.filterChip, filterStatus === 'unpaid' && styles.activeFilterChip]}
                                        onPress={() => setFilterStatus('unpaid')}
                                    >
                                        <Text style={[styles.filterChipText, filterStatus === 'unpaid' && styles.activeFilterChipText]}>Unpaid</Text>
                                    </TouchableOpacity>
                                </ScrollView>

                                <Text style={[styles.filterGroupLabel, {marginTop: 15}]}>Month Filter</Text>
                                <View style={{flexDirection: 'row', gap: 10}}>
                                    <TouchableOpacity 
                                        style={[styles.filterChip, filterMonth === 'ALL' && styles.activeFilterChip]}
                                        onPress={() => setFilterMonth('ALL')}
                                    >
                                        <Text style={[styles.filterChipText, filterMonth === 'ALL' && styles.activeFilterChipText]}>All Months</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        style={[styles.filterChip, filterMonth !== 'ALL' && styles.activeFilterChip]}
                                        onPress={() => setShowMonthPicker(true)}
                                    >
                                        <Ionicons name="calendar-outline" size={16} color={filterMonth !== 'ALL' ? "#fff" : theme.primary} />
                                        <Text style={[styles.filterChipText, filterMonth !== 'ALL' && styles.activeFilterChipText]}>
                                            {filterMonth === 'ALL' ? 'Select Month' : filterMonth}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            
                            <FlatList 
                                data={filteredHistory}
                                keyExtractor={(item, index) => index.toString()}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => {
                                    const isPaid = item.status === 'paid';
                                    return (
                                        <View style={styles.historyItem}>
                                            <View style={styles.historyItemTop}>
                                                <View>
                                                    <Text style={styles.historyMonth}>{item.month_year}</Text>
                                                    <Text style={styles.historyType}>{item.fee_type}</Text>
                                                    {item.fee_type === 'occasional' && item.title_summary && (
                                                        <Text style={styles.historySummary} numberOfLines={1}>{item.title_summary}</Text>
                                                    )}
                                                </View>
                                                <View style={{alignItems: 'flex-end'}}>
                                                    <Text style={[styles.historyAmount, {color: isPaid ? theme.text : theme.danger}]}>
                                                        ₹{parseFloat(item.total_amount || 0).toLocaleString()}
                                                    </Text>
                                                    <View style={[styles.historyStatusBadge, {backgroundColor: isPaid ? theme.success + '15' : theme.danger + '15'}]}>
                                                        <Text style={[styles.historyStatusText, {color: isPaid ? theme.success : theme.danger}]}>
                                                            {item.status.toUpperCase()}
                                                        </Text>
                                                    </View>

                                                    {!isPaid && canCollect && (
                                                        <TouchableOpacity 
                                                            style={styles.payBtnSmall}
                                                            onPress={() => handleMarkPaid(item)}
                                                        >
                                                            <Text style={styles.payBtnTextSmall}>COLLECT</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>

                                            {isPaid && (
                                                <View style={styles.historyDetails}>
                                                    <View style={styles.detailRow}>
                                                        <Text style={styles.detailLabel}>Paid On:</Text>
                                                        <Text style={styles.detailValue}>{item.paid_at ? new Date(item.paid_at).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'}) : 'N/A'}</Text>
                                                    </View>
                                                    <View style={styles.receiptActions}>
                                                        <TouchableOpacity 
                                                            style={styles.receiptBtnIcon}
                                                            onPress={() => handleViewReceiptInternal(item)}
                                                        >
                                                            <Ionicons name="eye-outline" size={18} color={theme.primary} />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity 
                                                            style={styles.receiptBtnIcon}
                                                            onPress={() => handleShareReceiptInternal(item)}
                                                            disabled={isReceiptGenerating}
                                                        >
                                                            {isReceiptGenerating ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="share-outline" size={18} color={theme.primary} />}
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    );
                                }}
                                ListEmptyComponent={() => (
                                    <View style={{alignItems: 'center', marginTop: 40, paddingBottom: 100}}>
                                        <Text style={{color: theme.textLight}}>No records found</Text>
                                    </View>
                                )}
                            />
                        </View>
                    )}
                </View>
            </View>

            {selectedFeeData && (
                <FeeReceiptModal
                    visible={isReceiptModalVisible}
                    onClose={() => setIsReceiptModalVisible(false)}
                    feeData={selectedFeeData}
                    institute={institute}
                    student={{...student, class: student.class, section: student.section, roll_no: student.roll_no}}
                    onShare={() => generateFeeReceipt(selectedFeeData, institute, student)}
                />
            )}

            {showMonthPicker && (
                <DateTimePicker
                    value={new Date()}
                    mode="date"
                    display="default"
                    onChange={handleMonthChange}
                />
            )}
        </Modal>
    );
};

export default FeeHistoryBottomSheet;
