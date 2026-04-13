import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, TextInput, ActivityIndicator, RefreshControl, Dimensions, LayoutAnimation, Platform, UIManager, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';
import { getFullImageUrl } from '../../../utils/imageHelper';
import AddExtraChargeModal from '../../../components/AddExtraChargeModal';
import OneTimeFeesTab from '../../../components/OneTimeFeesTab';
import { generateReceiptPDF } from '../../../utils/receiptGenerator';
import MonthlyTransactionBottomSheet from '../../../components/MonthlyTransactionBottomSheet';
import FeeReceiptPreview from '../../../components/FeeReceiptPreview';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function Fees() {
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const today = new Date();

    // Core State
    const [activeTab, setActiveTab] = useState<'monthly' | 'onetime'>('monthly');
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [students, setStudents] = useState<any[]>([]);
    const [isActivated, setIsActivated] = useState(false);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ class: '', section: '', status: 'all' as 'all' | 'paid' | 'unpaid' });
    const [showAddChargeModal, setShowAddChargeModal] = useState(false);
    const [instituteData, setInstituteData] = useState<any>(null);
    const [showTransactionDetails, setShowTransactionDetails] = useState(false);
    const [selectedTransactionData, setSelectedTransactionData] = useState<any>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);

    // Summary Stats
    const stats = useMemo(() => {
        const filtered = students.filter(s => {
            const matchesSearch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.roll_no || '').toString().includes(searchTerm);
            const matchesClass = filters.class === '' || (s.class || '').toLowerCase().includes(filters.class.toLowerCase());
            const matchesSection = filters.section === '' || (s.section || '').toLowerCase().includes(filters.section.toLowerCase());
            return matchesSearch && matchesClass && matchesSection;
        });

        const counts = {
            all: filtered.length,
            paid: filtered.filter(s => {
                const extraChargesSum = (s.extra_charges || []).reduce((acc: number, ec: any) => acc + parseFloat(ec.amount || 0), 0);
                const baseDue = s.snapshot_amount_due 
                    ? parseFloat(s.snapshot_amount_due) 
                    : (parseFloat(s.monthly_fees || 0) + (s.transport_facility ? parseFloat(s.transport_fees || 0) : 0));
                const totalDue = baseDue + extraChargesSum;
                const paidAmount = parseFloat(s.amount_paid || 0);
                return paidAmount >= totalDue && totalDue > 0;
            }).length,
            unpaid: filtered.filter(s => {
                const extraChargesSum = (s.extra_charges || []).reduce((acc: number, ec: any) => acc + parseFloat(ec.amount || 0), 0);
                const baseDue = s.snapshot_amount_due 
                    ? parseFloat(s.snapshot_amount_due) 
                    : (parseFloat(s.monthly_fees || 0) + (s.transport_facility ? parseFloat(s.transport_fees || 0) : 0));
                const totalDue = baseDue + extraChargesSum;
                const paidAmount = parseFloat(s.amount_paid || 0);
                return paidAmount < totalDue;
            }).length
        };

        const finalFiltered = filtered.filter(s => {
            if (filters.status === 'all') return true;
            
            const extraChargesSum = (s.extra_charges || []).reduce((acc: number, ec: any) => acc + parseFloat(ec.amount || 0), 0);
            const baseDue = s.snapshot_amount_due 
                ? parseFloat(s.snapshot_amount_due) 
                : (parseFloat(s.monthly_fees || 0) + (s.transport_facility ? parseFloat(s.transport_fees || 0) : 0));
            const totalDue = baseDue + extraChargesSum;
            const paidAmount = parseFloat(s.amount_paid || 0);
            const isFullyPaid = paidAmount >= totalDue && totalDue > 0;

            return filters.status === 'paid' ? isFullyPaid : !isFullyPaid;
        });

        const totalExpected = filtered.reduce((sum, s) => {
            const extra = (s.extra_charges || []).reduce((acc: number, ec: any) => acc + parseFloat(ec.amount || 0), 0);
            const base = s.snapshot_amount_due 
                ? parseFloat(s.snapshot_amount_due) 
                : (parseFloat(s.monthly_fees || 0) + (s.transport_facility ? parseFloat(s.transport_fees || 0) : 0));
            return sum + base + extra;
        }, 0);

        const totalCollected = filtered.reduce((sum, s) => {
            return sum + parseFloat(s.amount_paid || 0);
        }, 0);

        return {
            expected: totalExpected,
            collected: totalCollected,
            remaining: Math.max(0, totalExpected - totalCollected),
            filteredStudents: finalFiltered,
            counts
        };
    }, [students, searchTerm, filters]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const [statusRes, activationRes, profileRes] = await Promise.all([
                axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/fees-status`, {
                    params: { month: selectedMonth, year: selectedYear },
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/monthly-fees-activation`, {
                    params: { month: selectedMonth, year: selectedYear },
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_ENDPOINTS.PRINCIPAL}/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            setStudents(Array.isArray(statusRes.data.students) ? statusRes.data.students : []);
            setIsActivated(activationRes.data.activated);
            setInstituteData(profileRes.data.profile);
        } catch (error) {
            console.error('Error fetching fees data:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch fees data' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedMonth, selectedYear]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handlePrevMonth = () => {
        if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(prev => prev - 1); }
        else { setSelectedMonth(prev => prev - 1); }
    };

    const handleNextMonth = () => {
        if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(prev => prev + 1); }
        else { setSelectedMonth(prev => prev + 1); }
    };

    const toggleActivation = async () => {
        setProcessing(true);
        try {
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            await axios.post(`${API_ENDPOINTS.PRINCIPAL}/student/toggle-monthly-fees`, {
                month: selectedMonth,
                year: selectedYear,
                activate: !isActivated
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            setIsActivated(!isActivated);
            Toast.show({ type: 'success', text1: 'Success', text2: isActivated ? 'Fees Deactivated' : 'Fees Activated for Students' });
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update activation' });
        } finally {
            setProcessing(false);
        }
    };

    const handleCollectFee = async (student: any) => {
        if (!isActivated) {
            Alert.alert(
                'Fee Collection Disabled',
                'This month is currently deactivated. Please activate fees using the toggle button above before collecting payments.',
                [{ text: 'OK' }]
            );
            return;
        }

        const total = (parseFloat(student.monthly_fees || 0) + 
                       (student.transport_facility ? parseFloat(student.transport_fees || 0) : 0) + 
                       (student.extra_charges || []).reduce((acc: number, ec: any) => acc + parseFloat(ec.amount), 0));

        Alert.alert(
            'Collect Fee',
            `Collect ₹${total.toLocaleString()} from ${student.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Confirm', 
                    onPress: async () => {
                        setProcessingId(student.id);
                        try {
                            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
                            await axios.post(`${API_ENDPOINTS.PRINCIPAL}/student/collect-fee/${student.id}`, {
                                month: selectedMonth,
                                year: selectedYear
                            }, { headers: { Authorization: `Bearer ${token}` } });
                            Toast.show({ type: 'success', text1: 'Success', text2: `Fee collected for ${student.name}` });
                            fetchData();
                        } catch (error) {
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to collect fee' });
                        } finally {
                            setProcessingId(null);
                        }
                    }
                }
            ]
        );
    };

    const handleDownloadMonthly = async (student: any) => {
        if (!instituteData) return;
        setProcessingId(student.id);
        try {
            const isPaid = student.fee_status === 'paid';
            let breakage = [];

            if (isPaid) {
                // For paid records, we must respect the actual amount_paid snapshot
                const totalPaid = parseFloat(student.amount_paid || 0);
                const extraTotal = (student.extra_charges || []).reduce((acc: number, ec: any) => acc + parseFloat(ec.amount), 0);
                const transport = student.transport_facility ? parseFloat(student.transport_fees || 0) : 0;
                
                // Tuition is the remainder (Total - Transport - Extras)
                const tuitionPaid = totalPaid - transport - extraTotal;

                breakage = [
                    { label: 'Monthly Tuition Fee', amount: tuitionPaid },
                    ...(student.transport_facility ? [{ label: 'Transport Fee', amount: transport }] : []),
                    ...(student.extra_charges || []).map((ec: any) => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
                ];
            } else {
                // For unpaid, use current profile fees
                breakage = [
                    { label: 'Monthly Tuition Fee', amount: parseFloat(student.monthly_fees || 0) },
                    ...(student.transport_facility ? [{ label: 'Transport Fee', amount: parseFloat(student.transport_fees || 0) }] : []),
                    ...(student.extra_charges || []).map((ec: any) => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
                ];
            }

            await generateReceiptPDF({
                student,
                payment: { ...student, month: selectedMonth, year: selectedYear },
                breakage,
                type: 'MONTHLY'
            });
        } catch (error) {
            console.error('Download Error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to generate PDF' });
        } finally {
            setProcessingId(null);
        }
    };

    const handlePreviewMonthly = (student: any) => {
        if (!instituteData) return;
        const isPaid = student.fee_status === 'paid';
        let breakage = [];

        if (isPaid) {
            // FOR PAID: Priority 1: Use the new DB snapshots (Perfect history)
            if (student.snapshot_tuition && parseFloat(student.snapshot_tuition) > 0) {
                breakage = [
                    { label: 'Monthly Tuition Fee', amount: parseFloat(student.snapshot_tuition) },
                    ...(parseFloat(student.snapshot_transport) > 0 ? [{ label: 'Transport Fee', amount: parseFloat(student.snapshot_transport) }] : []),
                    ...(student.extra_charges || []).map((ec: any) => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
                ];
            } 
            // Priority 2: Fallback to existing amount_paid logic for older records
            else {
                const totalPaid = parseFloat(student.amount_paid || 0);
                const extraTotal = (student.extra_charges || []).reduce((acc: number, ec: any) => acc + parseFloat(ec.amount), 0);
                const transport = student.transport_facility ? parseFloat(student.transport_fees || 0) : 0;
                const tuitionPaid = totalPaid - transport - extraTotal;

                breakage = [
                    { label: 'Monthly Tuition Fee', amount: tuitionPaid },
                    ...(student.transport_facility ? [{ label: 'Transport Fee', amount: transport }] : []),
                    ...(student.extra_charges || []).map((ec: any) => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
                ];
            }
        } else {
            // For unpaid, use current profile fees
            breakage = [
                { label: 'Monthly Tuition Fee', amount: parseFloat(student.monthly_fees || 0) },
                ...(student.transport_facility ? [{ label: 'Transport Fee', amount: parseFloat(student.transport_fees || 0) }] : []),
                ...(student.extra_charges || []).map((ec: any) => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
            ];
        }

        setPreviewData({
            institute: instituteData,
            student,
            payment: { ...student, month: selectedMonth, year: selectedYear },
            breakage,
            type: 'MONTHLY'
        });
        setShowPreview(true);
    };

    const renderStudentCard = ({ item }: { item: any }) => {
        const extraChargesSum = (item.extra_charges || []).reduce((acc: number, ec: any) => acc + parseFloat(ec.amount || 0), 0);
        const baseDue = item.snapshot_amount_due 
            ? parseFloat(item.snapshot_amount_due) 
            : (parseFloat(item.monthly_fees || 0) + (item.transport_facility ? parseFloat(item.transport_fees || 0) : 0));
        
        const totalDue = baseDue + extraChargesSum;
        const paidAmount = parseFloat(item.amount_paid || 0);
        const isFullyPaid = paidAmount >= totalDue && totalDue > 0;
        const isProcessing = processingId === item.id;

        // Breakage recovery logic for PAID display
        let tuitionDisp = parseFloat(item.monthly_fees || 0);
        let transportDisp = parseFloat(item.transport_fees || 0);
        let showTransport = item.transport_facility;

        if (isFullyPaid) {
            // FOR PAID: Priority 1: Use the new DB snapshots (Perfect history)
            // We check > 0 because old records default to 0 in DB
            if (item.snapshot_tuition && parseFloat(item.snapshot_tuition) > 0) {
                tuitionDisp = parseFloat(item.snapshot_tuition);
                transportDisp = parseFloat(item.snapshot_transport || 0);
                showTransport = transportDisp > 0;
            } 
            // Priority 2: Fallback to existing snapshot_amount_due guessing (for older records)
            else {
                const totalBasePaid = baseDue; 
                const transportRate = parseFloat(item.transport_fees || 0);
                
                if (totalBasePaid === (tuitionDisp + transportRate)) {
                    showTransport = transportRate > 0;
                    transportDisp = transportRate;
                } 
                else if (totalBasePaid > tuitionDisp) {
                    showTransport = true;
                    transportDisp = totalBasePaid - tuitionDisp;
                } else {
                    showTransport = false;
                    transportDisp = 0;
                    tuitionDisp = totalBasePaid;
                }
            }
        } else {
            transportDisp = item.transport_facility ? parseFloat(item.transport_fees || 0) : 0;
            tuitionDisp = baseDue - transportDisp;
        }

        return (
            <Animated.View 
                layout={Layout.springify()} 
                entering={FadeIn.duration(400)}
                style={[styles.studentCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
                <View style={styles.cardHeader}>
                    <TouchableOpacity 
                        style={styles.studentInfo} 
                        onPress={() => router.push(`/(principal)/students/details/${item.id}`)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.avatar, { backgroundColor: theme.primary + '20', overflow: 'hidden' }]}>
                            {item.photo_url ? (
                                <Image source={{ uri: getFullImageUrl(item.photo_url) ?? undefined }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <Text style={[styles.avatarText, { color: theme.primary }]}>{item.name?.charAt(0)}</Text>
                            )}
                        </View>
                        <View>
                            <Text style={[styles.studentName, { color: theme.text }]}>{item.name}</Text>
                            <Text style={[styles.studentMeta, { color: theme.textLight }]}>Class {item.class}-{item.section} | Roll: {item.roll_no}</Text>
                        </View>
                    </TouchableOpacity>
                    <View style={[styles.statusBadge, { backgroundColor: isFullyPaid ? '#4CAF5020' : (paidAmount > 0 ? '#FF980020' : '#F4433620') }]}>
                        <Text style={[styles.statusText, { color: isFullyPaid ? '#4CAF50' : (paidAmount > 0 ? '#FF9800' : '#F44336') }]}>{isFullyPaid ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID')}</Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.cardContent}>
                    <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, { color: theme.textLight }]}>Tuition Fee</Text>
                        <Text style={[styles.breakdownValue, { color: theme.text }]}>₹{tuitionDisp.toLocaleString()}</Text>
                    </View>
                    {showTransport && (
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: theme.textLight }]}>Transport Fee</Text>
                            <Text style={[styles.breakdownValue, { color: theme.text }]}>₹{transportDisp.toLocaleString()}</Text>
                        </View>
                    )}
                    {(item.extra_charges || []).map((ec: any, idx: number) => (
                        <View key={idx} style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: theme.textLight }]}>{ec.reason}</Text>
                            <Text style={[styles.breakdownValue, { color: theme.text }]}>₹{parseFloat(ec.amount).toLocaleString()}</Text>
                        </View>
                    ))}
                    {paidAmount > 0 && (
                        <View style={[styles.breakdownRow, { marginTop: 4 }]}>
                            <Text style={[styles.breakdownLabel, { color: '#4CAF50', fontWeight: '700' }]}>Total Collected</Text>
                            <Text style={[styles.breakdownValue, { color: '#4CAF50', fontWeight: '800' }]}>₹{paidAmount.toLocaleString()}</Text>
                        </View>
                    )}
                </View>

                <View style={[styles.cardFooter, { backgroundColor: isDark ? '#ffffff05' : '#00000002' }]}>
                    <View>
                        <Text style={[styles.totalLabel, { color: theme.textLight }]}>Total Due</Text>
                        <Text style={[styles.totalValue, { color: theme.text }]}>₹{totalDue.toLocaleString()}</Text>
                    </View>
                    {!isFullyPaid && (
                        <TouchableOpacity 
                            style={[
                                styles.collectBtn, 
                                { backgroundColor: theme.primary },
                                (!isActivated || isProcessing) && { opacity: 0.5 }
                            ]}
                            onPress={() => handleCollectFee(item)}
                            disabled={isProcessing}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                {isProcessing ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        {!isActivated && <Ionicons name="lock-closed" size={12} color="#fff" />}
                                        <Text style={styles.collectBtnText}>Collect</Text>
                                    </>
                                )}
                            </View>
                        </TouchableOpacity>
                    )}
                    {isFullyPaid && (
                        <View style={styles.paidActions}>
                            <TouchableOpacity 
                                style={styles.iconBtn}
                                onPress={() => {
                                    setSelectedTransactionData({ ...item, month: selectedMonth, year: selectedYear });
                                    setShowTransactionDetails(true);
                                }}
                            >
                                <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.iconBtn}
                                onPress={() => handlePreviewMonthly(item)}
                            >
                                <Ionicons name="eye-outline" size={20} color={theme.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.iconBtn}
                                onPress={() => handleDownloadMonthly(item)}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <ActivityIndicator size="small" color={theme.primary} />
                                ) : (
                                    <Ionicons name="download-outline" size={20} color={theme.primary} />
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Animated.View>
        );
    };

    const handleExtraCharge = async (charges: any[], studentIds: number[]) => {
        try {
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            await axios.post(`${API_ENDPOINTS.PRINCIPAL}/student/add-extra-charge`, {
                charges,
                month: selectedMonth,
                year: selectedYear,
                studentIds
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            Toast.show({ type: 'success', text1: 'Success', text2: 'Extra charges added successfully' });
            fetchData();
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to add extra charges' });
            throw error;
        }
    };

    const styles = StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { paddingHorizontal: 20, paddingBottom: 15 },
        headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
        backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
        title: { fontSize: 20, fontWeight: '800', color: theme.text },
        headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
        
        activationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        activationLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
        togglePill: { width: 36, height: 20, borderRadius: 10, padding: 2, justifyContent: 'center' },
        toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
        toggleThumbActive: { alignSelf: 'flex-end' },

        monthNavigatorInline: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.card, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
        navBtnSmall: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
        monthDisplaySmall: { alignItems: 'center', minWidth: 80 },
        monthNameSmall: { fontSize: 13, fontWeight: '800', color: theme.text },
        yearTextSmall: { fontSize: 10, color: theme.textLight, fontWeight: '600', marginTop: -2 },

        tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 10 },
        tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
        tabText: { fontSize: 14, fontWeight: '700' },

        statsContainer: { flexDirection: 'row', paddingHorizontal: 15, marginBottom: 20, gap: 8 },
        statCard: { flex: 1, padding: 12, borderRadius: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
        statIconCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
        statLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.9)', marginBottom: 2, letterSpacing: 0.5 },
        statValue: { fontSize: 14, fontWeight: '900', color: '#fff' },

        searchBarContainer: { paddingHorizontal: 20, marginBottom: 15, gap: 10 },
        searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 15, paddingHorizontal: 15, height: 48, borderWidth: 1, borderColor: theme.border },
        searchInput: { flex: 1, marginLeft: 10, color: theme.text, fontSize: 14 },
        
        filterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
        miniInputGroup: { flexDirection: 'row', gap: 6, flex: 0.8 },
        filterInput: { flex: 1, height: 36, backgroundColor: theme.card, borderRadius: 10, paddingHorizontal: 10, fontSize: 12, borderWidth: 1, borderColor: theme.border },
        statusToggleGroup: { flexDirection: 'row', backgroundColor: theme.card, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: theme.border, flex: 1.2 },
        statusBtn: { flex: 1, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
        statusBtnText: { fontSize: 9, fontWeight: '800' },

        listContent: { paddingHorizontal: 20, paddingBottom: 40 },
        studentCard: { borderRadius: 24, marginBottom: 16, borderWidth: 1, overflow: 'hidden', elevation: 2 },
        cardHeader: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        studentInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
        avatarText: { fontSize: 18, fontWeight: '800' },
        studentName: { fontSize: 16, fontWeight: '700' },
        studentMeta: { fontSize: 12 },
        statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
        statusText: { fontSize: 10, fontWeight: '800' },
        divider: { height: 1, width: '100%' },
        cardContent: { padding: 16, gap: 8 },
        breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        breakdownLabel: { fontSize: 13, fontWeight: '500' },
        breakdownValue: { fontSize: 13, fontWeight: '600' },
        cardFooter: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        totalLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        totalValue: { fontSize: 18, fontWeight: '800' },
        collectBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
        collectBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
        paidActions: { flexDirection: 'row', gap: 8 },
        iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center' },
        
        loader: { flex: 1, justifyContent: 'center', alignItems: 'center' }
    });

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Fees Management</Text>
                    <View style={styles.headerActions}>
                        {activeTab === 'monthly' && (
                            <TouchableOpacity 
                                style={styles.addBtn}
                                onPress={() => setShowAddChargeModal(true)}
                            >
                                <Ionicons name="add" size={24} color="#fff" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {activeTab === 'monthly' && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <View style={styles.activationRow}>
                            <Text style={[styles.activationLabel, { color: theme.textLight }]}>{isActivated ? 'Activated' : 'Deactivated'}</Text>
                            <TouchableOpacity 
                                style={[styles.togglePill, { backgroundColor: isActivated ? '#4CAF50' : theme.border }]} 
                                onPress={toggleActivation}
                                disabled={processing}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.toggleThumb, isActivated && styles.toggleThumbActive]} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.monthNavigatorInline}>
                            <TouchableOpacity style={styles.navBtnSmall} onPress={handlePrevMonth}>
                                <Ionicons name="chevron-back" size={18} color={theme.text} />
                            </TouchableOpacity>
                            <View style={styles.monthDisplaySmall}>
                                <Text style={styles.monthNameSmall}>{months[selectedMonth - 1]}</Text>
                                <Text style={styles.yearTextSmall}>{selectedYear}</Text>
                            </View>
                            <TouchableOpacity style={styles.navBtnSmall} onPress={handleNextMonth}>
                                <Ionicons name="chevron-forward" size={18} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            <View style={styles.tabs}>
                <TouchableOpacity 
                    style={[styles.tab, { backgroundColor: activeTab === 'monthly' ? theme.primary + '15' : 'transparent', borderColor: activeTab === 'monthly' ? theme.primary : theme.border }]}
                    onPress={() => setActiveTab('monthly')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'monthly' ? theme.primary : theme.textLight }]}>Monthly</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, { backgroundColor: activeTab === 'onetime' ? theme.primary + '15' : 'transparent', borderColor: activeTab === 'onetime' ? theme.primary : theme.border }]}
                    onPress={() => setActiveTab('onetime')}
                >
                    <Text style={[styles.tabText, { color: activeTab === 'onetime' ? theme.primary : theme.textLight }]}>One-Time</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'monthly' && (
                <View style={{ flex: 1 }}>
                    <View style={styles.statsContainer}>
                        <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.statCard}>
                            <View style={styles.statIconCircle}>
                                <Ionicons name="pie-chart" size={12} color="#fff" />
                            </View>
                            <Text style={styles.statLabel}>EXPECTED</Text>
                            <Text style={styles.statValue} numberOfLines={1}>₹{stats.expected.toLocaleString()}</Text>
                        </LinearGradient>
                        
                        <LinearGradient colors={['#10b981', '#059669']} style={styles.statCard}>
                            <View style={styles.statIconCircle}>
                                <Ionicons name="checkmark-done" size={12} color="#fff" />
                            </View>
                            <Text style={styles.statLabel}>COLLECTED</Text>
                            <Text style={styles.statValue} numberOfLines={1}>₹{stats.collected.toLocaleString()}</Text>
                        </LinearGradient>
                        
                        <LinearGradient colors={['#ef4444', '#b91c1c']} style={styles.statCard}>
                            <View style={styles.statIconCircle}>
                                <Ionicons name="time" size={12} color="#fff" />
                            </View>
                            <Text style={styles.statLabel}>REMAINING</Text>
                            <Text style={styles.statValue} numberOfLines={1}>₹{stats.remaining.toLocaleString()}</Text>
                        </LinearGradient>
                    </View>

                    <View style={styles.searchBarContainer}>
                        <View style={styles.searchBar}>
                            <Ionicons name="search" size={20} color={theme.textLight} />
                            <TextInput 
                                style={styles.searchInput} 
                                placeholder="Search by name or roll..." 
                                placeholderTextColor={theme.textLight}
                                value={searchTerm}
                                onChangeText={setSearchTerm}
                            />
                            {searchTerm !== '' && (
                                <TouchableOpacity onPress={() => setSearchTerm('')}>
                                    <Ionicons name="close-circle" size={18} color={theme.textLight} />
                                </TouchableOpacity>
                            )}
                        </View>
                        
                        <View style={styles.filterRow}>
                            <View style={styles.miniInputGroup}>
                                <TextInput 
                                    style={[styles.filterInput, { color: theme.text }]} 
                                    placeholder="Class" 
                                    placeholderTextColor={theme.textLight}
                                    value={filters.class}
                                    onChangeText={(v) => setFilters({...filters, class: v})}
                                />
                                <TextInput 
                                    style={[styles.filterInput, { color: theme.text }]} 
                                    placeholder="Sec" 
                                    placeholderTextColor={theme.textLight}
                                    value={filters.section}
                                    onChangeText={(v) => setFilters({...filters, section: v})}
                                />
                            </View>
                            
                            <View style={styles.statusToggleGroup}>
                                {['all', 'paid', 'unpaid'].map((status) => (
                                    <TouchableOpacity 
                                        key={status}
                                        style={[
                                            styles.statusBtn, 
                                            filters.status === status && { backgroundColor: theme.primary, borderColor: theme.primary }
                                        ]}
                                        onPress={() => setFilters({...filters, status: status as any})}
                                    >
                                        <Text style={[
                                            styles.statusBtnText, 
                                            { color: filters.status === status ? '#fff' : theme.textLight }
                                        ]}>
                                            {status.toUpperCase()} ({stats.counts[status as keyof typeof stats.counts]})
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                    {loading ? (
                        <View style={styles.loader}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={stats.filteredStudents}
                            renderItem={renderStudentCard}
                            keyExtractor={(item) => item.id.toString()}
                            contentContainerStyle={styles.listContent}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
                            ListEmptyComponent={
                                <View style={{ alignItems: 'center', marginTop: 50 }}>
                                    <Ionicons name="receipt-outline" size={64} color={theme.border} />
                                    <Text style={{ color: theme.textLight, marginTop: 10, fontSize: 16 }}>No fee records found</Text>
                                </View>
                            }
                        />
                    )}
                </View>
            )}

            {activeTab === 'onetime' && (
                <OneTimeFeesTab />
            )}

            <AddExtraChargeModal 
                isOpen={showAddChargeModal}
                onClose={() => setShowAddChargeModal(false)}
                onConfirm={handleExtraCharge}
                students={students}
                monthName={`${months[selectedMonth - 1]} ${selectedYear}`}
            />

            <MonthlyTransactionBottomSheet 
                isOpen={showTransactionDetails}
                onClose={() => setShowTransactionDetails(false)}
                data={selectedTransactionData}
            />

            <FeeReceiptPreview 
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                data={previewData}
            />
        </View>
    );
}
