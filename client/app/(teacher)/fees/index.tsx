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
import AddExtraChargeModal from '../../../components/AddExtraChargeModal';
import OneTimeFeesTab from '../../../components/OneTimeFeesTab';
import { generateReceiptPDF } from '../../../utils/receiptGenerator';
import MonthlyTransactionBottomSheet from '../../../components/MonthlyTransactionBottomSheet';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function TeacherFees() {
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
    const [processing, setProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ class: '', section: '', status: 'all' as 'all' | 'paid' | 'unpaid' });
    const [showAddChargeModal, setShowAddChargeModal] = useState(false);
    const [instituteData, setInstituteData] = useState<any>(null);
    const [showTransactionDetails, setShowTransactionDetails] = useState(false);
    const [selectedTransactionData, setSelectedTransactionData] = useState<any>(null);

    // Summary Stats
    const stats = useMemo(() => {
        const filtered = students.filter(s => {
            const matchesSearch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.roll_no || '').toString().includes(searchTerm);
            const matchesClass = filters.class === '' || (s.class || '').toLowerCase().includes(filters.class.toLowerCase());
            const matchesSection = filters.section === '' || (s.section || '').toLowerCase().includes(filters.section.toLowerCase());
            const matchesStatus = filters.status === 'all' || (filters.status === 'paid' ? s.fee_status === 'paid' : s.fee_status !== 'paid');
            return matchesSearch && matchesClass && matchesSection && matchesStatus;
        });

        const totalExpected = filtered.reduce((sum, s) => {
            const extra = (s.extra_charges || []).reduce((acc: number, ec: any) => acc + parseFloat(ec.amount || 0), 0);
            return sum + (parseFloat(s.monthly_fees || 0) + (s.transport_facility ? parseFloat(s.transport_fees || 0) : 0) + extra);
        }, 0);

        const totalCollected = filtered.filter(s => s.fee_status === 'paid').reduce((sum, s) => {
            const extra = (s.extra_charges || []).reduce((acc: number, ec: any) => acc + parseFloat(ec.amount || 0), 0);
            return sum + (parseFloat(s.monthly_fees || 0) + (s.transport_facility ? parseFloat(s.transport_fees || 0) : 0) + extra);
        }, 0);

        return {
            expected: totalExpected,
            collected: totalCollected,
            remaining: totalExpected - totalCollected,
            filteredStudents: filtered
        };
    }, [students, searchTerm, filters]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('teacherToken');
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
            const token = await AsyncStorage.getItem('teacherToken');
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
                'This month is currently deactivated. Please ask the Principal to activate fees for this month before collecting payments.',
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
                        setProcessing(true);
                        try {
                            const token = await AsyncStorage.getItem('teacherToken');
                            await axios.post(`${API_ENDPOINTS.PRINCIPAL}/student/collect-fee/${student.id}`, {
                                month: selectedMonth,
                                year: selectedYear
                            }, { headers: { Authorization: `Bearer ${token}` } });
                            Toast.show({ type: 'success', text1: 'Success', text2: `Fee collected for ${student.name}` });
                            fetchData();
                        } catch (error) {
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to collect fee' });
                        } finally {
                            setProcessing(false);
                        }
                    }
                }
            ]
        );
    };

    const handleDownloadMonthly = async (student: any) => {
        if (!instituteData) return;
        setProcessing(true);
        try {
            const breakage = [
                { label: 'Monthly Tuition Fee', amount: parseFloat(student.monthly_fees || 0) },
                ...(student.transport_facility ? [{ label: 'Transport Fee', amount: parseFloat(student.transport_fees || 0) }] : []),
                ...(student.extra_charges || []).map((ec: any) => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
            ];

            await generateReceiptPDF({
                institute: instituteData,
                student,
                payment: { ...student, month: selectedMonth, year: selectedYear },
                breakage,
                type: 'MONTHLY',
                months
            });
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to generate PDF' });
        } finally {
            setProcessing(false);
        }
    };

    const handleExtraCharge = async (charges: any[], studentIds: number[]) => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
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

    const renderStudentCard = ({ item }: { item: any }) => {
        const monthly = parseFloat(item.monthly_fees || 0);
        const transport = item.transport_facility ? parseFloat(item.transport_fees || 0) : 0;
        const extra = (item.extra_charges || []).reduce((acc: number, ec: any) => acc + parseFloat(ec.amount), 0);
        const total = monthly + transport + extra;
        const isPaid = item.fee_status === 'paid';

        return (
            <Animated.View 
                layout={Layout.springify()} 
                entering={FadeIn.duration(400)}
                style={[styles.studentCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.studentInfo}>
                        <View style={[styles.avatar, { backgroundColor: theme.primary + '20', overflow: 'hidden' }]}>
                            {item.photo_url ? (
                                <Image source={{ uri: item.photo_url }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <Text style={[styles.avatarText, { color: theme.primary }]}>{item.name?.charAt(0)}</Text>
                            )}
                        </View>
                        <View>
                            <Text style={[styles.studentName, { color: theme.text }]}>{item.name}</Text>
                            <Text style={[styles.studentMeta, { color: theme.textLight }]}>Class {item.class}-{item.section} | Roll: {item.roll_no}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: isPaid ? '#4CAF5020' : '#F4433620' }]}>
                        <Text style={[styles.statusText, { color: isPaid ? '#4CAF50' : '#F44336' }]}>{isPaid ? 'PAID' : 'UNPAID'}</Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.cardContent}>
                    <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, { color: theme.textLight }]}>Tuition Fee</Text>
                        <Text style={[styles.breakdownValue, { color: theme.text }]}>₹{monthly.toLocaleString()}</Text>
                    </View>
                    {item.transport_facility && (
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: theme.textLight }]}>Transport Fee</Text>
                            <Text style={[styles.breakdownValue, { color: theme.text }]}>₹{transport.toLocaleString()}</Text>
                        </View>
                    )}
                    {(item.extra_charges || []).map((ec: any, idx: number) => (
                        <View key={idx} style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: theme.textLight }]}>{ec.reason}</Text>
                            <Text style={[styles.breakdownValue, { color: theme.text }]}>₹{parseFloat(ec.amount).toLocaleString()}</Text>
                        </View>
                    ))}
                </View>

                <View style={[styles.cardFooter, { backgroundColor: isDark ? '#ffffff05' : '#00000002' }]}>
                    <View>
                        <Text style={[styles.totalLabel, { color: theme.textLight }]}>Total Amount</Text>
                        <Text style={[styles.totalValue, { color: theme.text }]}>₹{total.toLocaleString()}</Text>
                    </View>
                    {!isPaid && (
                        <TouchableOpacity 
                            style={[
                                styles.collectBtn, 
                                { backgroundColor: theme.primary },
                                !isActivated && { opacity: 0.5 }
                            ]}
                            onPress={() => handleCollectFee(item)}
                            disabled={processing}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                {!isActivated && <Ionicons name="lock-closed" size={12} color="#fff" />}
                                <Text style={styles.collectBtnText}>Collect</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                    {isPaid && (
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
                                onPress={() => handleDownloadMonthly(item)}
                                disabled={processing}
                            >
                                {processing ? (
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
                                            filters.status === status && { color: '#fff' },
                                            { color: theme.textLight }
                                        ]}>
                                            {status.toUpperCase()}
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

            {/* <MonthlyTransactionBottomSheet 
                isOpen={showTransactionDetails}
                onClose={() => setShowTransactionDetails(false)}
                data={selectedTransactionData}
            /> */}
        </View>
    );
}