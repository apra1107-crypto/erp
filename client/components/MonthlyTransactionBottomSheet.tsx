import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../constants/Config';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface MonthlyTransactionBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
}

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function MonthlyTransactionBottomSheet({ isOpen, onClose, data }: MonthlyTransactionBottomSheetProps) {
    const { theme, isDark } = useTheme();
    const visible = isOpen; // Local alias for internal React Native compatibility
    const [activeTab, setActiveTab] = useState<'monthly' | 'onetime'>('monthly');
    const [loading, setLoading] = useState(true);
    const [historyData, setHistoryData] = useState<any>(null);
    const [teacherData, setTeacherData] = useState<any>(null);

    const studentId = data?.student?.id || data?.id;
    const studentName = data?.student?.name || data?.name;

    useEffect(() => {
        if (isOpen && studentId) {
            if (data?.payments || data?.activated_months || data?.one_time_fees) {
                setHistoryData(data);
                setLoading(false);
            } else {
                fetchHistory();
            }
            loadTeacherData();
        }
    }, [isOpen, studentId, data]);

    const loadTeacherData = async () => {
        try {
            const data = await AsyncStorage.getItem('teacherData');
            if (data) setTeacherData(JSON.parse(data));
        } catch (e) {}
    };

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const teacherToken = await AsyncStorage.getItem('teacherToken');
            const principalToken = await AsyncStorage.getItem('token');
            const token = teacherToken || principalToken;

            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/${studentId}/fees-full`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistoryData(response.data);
        } catch (error) {
            console.error('Error fetching fee history:', error);
        } finally {
            setLoading(false);
        }
    };

    const styles = StyleSheet.create({
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
        container: { backgroundColor: theme.card, borderTopLeftRadius: 35, borderTopRightRadius: 35, paddingBottom: 20, height: SCREEN_HEIGHT * 0.85, borderWidth: 1, borderColor: theme.border },
        modalHandle: { width: 40, height: 5, backgroundColor: theme.border, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 15 },
        header: { paddingHorizontal: 25, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        title: { fontSize: 22, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
        
        tabContainer: { flexDirection: 'row', paddingHorizontal: 25, gap: 10, marginBottom: 20 },
        tab: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
        activeTab: { backgroundColor: theme.primary, borderColor: theme.primary, elevation: 4, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
        tabText: { fontSize: 13, fontWeight: '800', color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
        activeTabText: { color: '#fff' },

        content: { flex: 1 },
        studentMiniBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 25, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', padding: 15, borderRadius: 20, marginHorizontal: 25, borderWidth: 1, borderColor: theme.border },
        avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary + '20', justifyContent: 'center', alignItems: 'center' },
        avatarText: { color: theme.primary, fontSize: 18, fontWeight: '900' },
        studentNameText: { fontSize: 16, fontWeight: '800', color: theme.text },
        studentMeta: { fontSize: 12, color: theme.textLight, marginTop: 2 },
        
        historyItem: { borderRadius: 24, marginBottom: 16, overflow: 'hidden', marginHorizontal: 25, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
        cardGradient: { padding: 20 },
        historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
        historyLabel: { fontSize: 18, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
        
        statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
        paidBadge: { backgroundColor: '#10b98120' },
        unpaidBadge: { backgroundColor: '#ef444420' },
        paidText: { color: '#10b981', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
        unpaidText: { color: '#ef4444', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
        
        amtContainer: { backgroundColor: isDark ? '#222' : '#f1f5f9', padding: 15, borderRadius: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        amtLabel: { fontSize: 11, fontWeight: '800', color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
        amtValue: { fontSize: 20, fontWeight: '900', color: theme.text },
        
        extraSection: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: theme.border + '50' },
        extraTitle: { fontSize: 11, fontWeight: '900', color: theme.primary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
        extraRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
        extraText: { fontSize: 12, color: theme.textLight, fontWeight: '600' },
        extraAmt: { fontSize: 12, fontWeight: '800', color: theme.text },

        emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
        emptyText: { color: theme.textLight, marginTop: 15, fontSize: 16, fontWeight: '700', textAlign: 'center' }
    });

    const renderMonthlyTab = () => {
        if (!historyData) return null;
        const { payments = [], extra_charges = [], activated_months = [], fee_structure, student } = historyData;

        if (activated_months.length === 0) {
            return (
                <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={60} color={theme.border} />
                    <Text style={styles.emptyText}>No monthly fees have been activated yet.</Text>
                </View>
            );
        }

        return (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {activated_months.map((cycle: any, idx: number) => {
                    const payment = payments.find((p: any) => p.month === cycle.month && p.year === cycle.year);
                    const isPaid = payment?.status === 'paid';
                    const extraForMonth = extra_charges.filter((ec: any) => ec.month === cycle.month && ec.year === cycle.year);
                    const totalExtra = extraForMonth.reduce((sum: number, ec: any) => sum + parseFloat(ec.amount), 0);
                    const baseAmt = parseFloat(fee_structure?.monthly_fees || 0) + (student?.transport_facility ? parseFloat(fee_structure?.transport_fees || 0) : 0);
                    const totalForMonth = baseAmt + totalExtra;

                    return (
                        <View key={idx} style={[styles.historyItem, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>
                            <View style={styles.cardGradient}>
                                <View style={styles.historyTop}>
                                    <View>
                                        <Text style={styles.historyLabel}>{months[cycle.month - 1]} {cycle.year}</Text>
                                        {isPaid && payment.paid_at && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <Ionicons name="calendar-outline" size={12} color="#10b981" />
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981', marginLeft: 4 }}>Paid on {new Date(payment.paid_at).toLocaleDateString('en-IN')}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={[styles.statusBadge, isPaid ? styles.paidBadge : styles.unpaidBadge]}>
                                    <Text style={isPaid ? styles.paidText : styles.unpaidText}>{isPaid ? 'PAID' : 'UNPAID'}</Text>
                                </View>
                            </View>

                            <View style={styles.amtContainer}>
                                <View>
                                    <Text style={styles.amtLabel}>Total Amount</Text>
                                    <Text style={[styles.amtValue, isPaid && { color: '#10b981' }]}>₹{totalForMonth.toLocaleString()}</Text>
                                </View>
                                {isPaid && (
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.amtLabel}>Collected By</Text>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>{payment.collected_by || 'Institute'}</Text>
                                    </View>
                                )}
                            </View>

                            {extraForMonth.length > 0 && (
                                <View style={styles.extraSection}>
                                    <Text style={styles.extraTitle}>Breakdown</Text>
                                    <View style={styles.extraRow}>
                                        <Text style={styles.extraText}>Base Tuition & Transport</Text>
                                        <Text style={styles.extraAmt}>₹{baseAmt.toLocaleString()}</Text>
                                    </View>
                                    {extraForMonth.map((ec: any, i: number) => (
                                        <View key={i} style={styles.extraRow}>
                                            <Text style={styles.extraText}>{ec.reason}</Text>
                                            <Text style={styles.extraAmt}>+ ₹{parseFloat(ec.amount).toLocaleString()}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                );
            })}
                <View style={{ height: 30 }} />
            </ScrollView>
        );
    };

    const renderOneTimeTab = () => {
        if (!historyData) return null;
        const { one_time_fees = [] } = historyData;

        if (one_time_fees.length === 0) {
            return (
                <View style={styles.emptyState}>
                    <MaterialCommunityIcons name="receipt" size={60} color={theme.border} />
                    <Text style={styles.emptyText}>No one-time fees assigned to this student.</Text>
                </View>
            );
        }

        return (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {one_time_fees.map((fee: any, idx: number) => {
                    const isPaid = fee.status === 'paid';
                    const isPartial = fee.status === 'partial';
                    return (
                        <View key={idx} style={[styles.historyItem, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>
                            <View style={styles.cardGradient}>
                                <View style={styles.historyTop}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.historyLabel} numberOfLines={1}>{fee.reason}</Text>
                                        {isPaid && (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <Ionicons name="calendar-outline" size={12} color="#10b981" />
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10b981', marginLeft: 4 }}>
                                                    Paid on {new Date(fee.updated_at).toLocaleDateString('en-IN')}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={[styles.statusBadge, isPaid ? styles.paidBadge : styles.unpaidBadge, isPartial && { backgroundColor: '#f59e0b20' }]}>
                                    <Text style={[isPaid ? styles.paidText : styles.unpaidText, isPartial && { color: '#f59e0b' }]}>
                                        {fee.status.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.amtContainer}>
                                <View>
                                    <Text style={styles.amtLabel}>Total Due</Text>
                                    <Text style={styles.amtValue}>₹{parseFloat(fee.due_amount).toLocaleString()}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.amtLabel, { color: '#10b981' }]}>Collected</Text>
                                    <Text style={[styles.amtValue, { color: '#10b981' }]}>₹{parseFloat(fee.paid_amount).toLocaleString()}</Text>
                                </View>
                            </View>
                            
                            {fee.breakdown && fee.breakdown.length > 0 && (
                                <View style={styles.extraSection}>
                                    <Text style={styles.extraTitle}>Fee Breakdown</Text>
                                    {fee.breakdown.map((item: any, i: number) => (
                                        <View key={i} style={styles.extraRow}>
                                            <Text style={styles.extraText}>{item.reason}</Text>
                                            <Text style={styles.extraAmt}>₹{parseFloat(item.amount).toLocaleString()}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                );
            })}
                <View style={{ height: 30 }} />
            </ScrollView>
        );
    };

    return (
        <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                <View style={styles.container}>
                    <View style={styles.modalHandle} />
                    <View style={styles.header}>
                        <Text style={styles.title}>Fee History</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={30} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.studentMiniBox}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{studentName?.charAt(0)}</Text>
                        </View>
                        <View>
                            <Text style={styles.studentNameText}>{studentName}</Text>
                            <Text style={styles.studentMeta}>Student Financial Records</Text>
                        </View>
                    </View>

                    <View style={styles.tabContainer}>
                        <TouchableOpacity 
                            style={[styles.tab, activeTab === 'monthly' && styles.activeTab]} 
                            onPress={() => setActiveTab('monthly')}
                        >
                            <Text style={[styles.tabText, activeTab === 'monthly' && styles.activeTabText]}>Monthly</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.tab, activeTab === 'onetime' && styles.activeTab]} 
                            onPress={() => setActiveTab('onetime')}
                        >
                            <Text style={[styles.tabText, activeTab === 'onetime' && styles.activeTabText]}>One-Time</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1 }}>
                        {loading ? (
                            <View style={styles.emptyState}>
                                <ActivityIndicator size="large" color={theme.primary} />
                                <Text style={[styles.emptyText, { marginTop: 10 }]}>Fetching records...</Text>
                            </View>
                        ) : (
                            activeTab === 'monthly' ? renderMonthlyTab() : renderOneTimeTab()
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}