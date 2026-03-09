import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions, Platform, Modal, TextInput, KeyboardAvoidingView, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RazorpayCheckout from 'react-native-razorpay';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS, BASE_URL } from '../../constants/Config';
import { generateReceiptPDF } from '../../utils/receiptGenerator';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BLENDING_COLORS = {
    red: ['#FF5252', '#FF1744'],
    orange: ['#FF9100', '#FF6D00'],
    pink: ['#F06292', '#E91E63'],
    blue: ['#448AFF', '#2979FF'],
};

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function FeesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [feeData, setFeeData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [studentData, setStudentData] = useState<any>(null);

    // Payment Modal State
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [modalTotal, setModalTotal] = useState(0);
    const [modalBreakage, setModalBreakage] = useState<any[]>([]);
    const [paymentType, setActivePaymentType] = useState<'MONTHLY' | 'ONE-TIME'>('MONTHLY');
    const [customAmount, setCustomAmount] = useState('');
    const [isInitiating, setIsInitiating] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const studentStr = await AsyncStorage.getItem('studentData');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            
            if (studentStr) setStudentData(JSON.parse(studentStr));
            const studentData = studentStr ? JSON.parse(studentStr) : null;
            const sessionId = storedSessionId || (studentData ? studentData.current_session_id : null);

            const response = await axios.get(`${API_ENDPOINTS.AUTH.STUDENT}/fees-full`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            setFeeData(response.data);
        } catch (error) {
            console.error('Error fetching fees data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handlePayNow = (item: any, total: number, extraCharges: any[], type: 'MONTHLY' | 'ONE-TIME' = 'MONTHLY') => {
        let breakage = [];
        if (type === 'MONTHLY') {
            breakage = [
                { label: 'Monthly Tuition Fee', amount: feeData.fee_structure.monthly_fees },
                ...(feeData.fee_structure.transport_facility ? [{ label: 'Transport Fee', amount: feeData.fee_structure.transport_fees }] : []),
                ...extraCharges.map(ec => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
            ];
        } else {
            breakage = item.breakdown && Array.isArray(item.breakdown) 
                ? item.breakdown.map((b: any) => ({ label: b.reason, amount: parseFloat(b.amount) }))
                : [{ label: item.reason, amount: parseFloat(item.due_amount) }];
            
            if (parseFloat(item.paid_amount) > 0) {
                breakage.push({ label: 'Already Paid', amount: -parseFloat(item.paid_amount) });
            }
        }
        
        setSelectedItem(item);
        setModalTotal(total);
        setModalBreakage(breakage);
        setActivePaymentType(type);
        setCustomAmount(type === 'ONE-TIME' ? total.toString() : '');
        setShowPayModal(true);
    };

    const handleDownloadReceipt = async (payment: any) => {
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const studentStr = await AsyncStorage.getItem('studentData');
            const student = studentStr ? JSON.parse(studentStr) : null;
            const sessionId = storedSessionId || (student ? student.current_session_id : null);

            const response = await axios.get(`${API_ENDPOINTS.AUTH.STUDENT}/profile`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            const s = response.data.student;
            const instInfo = {
                institute_name: s.institute_name,
                logo_url: s.institute_logo,
                address: s.institute_address || s.address,
                landmark: s.landmark,
                district: s.district,
                state: s.state,
                pincode: s.pincode,
                affiliation: s.affiliation
            };

            let breakage = [];
            if (payment.type === 'MONTHLY') {
                const monthExtraCharges = (feeData?.extra_charges || []).filter((ec: any) => ec.month === payment.month && ec.year === payment.year);
                breakage = [
                    { label: 'Monthly Tuition Fee', amount: feeData.fee_structure.monthly_fees },
                    ...(feeData.fee_structure.transport_facility ? [{ label: 'Transport Fee', amount: feeData.fee_structure.transport_fees }] : []),
                    ...monthExtraCharges.map((ec: any) => ({ label: ec.reason, amount: parseFloat(ec.amount) }))
                ];
            } else {
                breakage = [{ label: payment.reason, amount: payment.due_amount }];
            }

            await generateReceiptPDF({
                institute: instInfo,
                student: s,
                payment: payment,
                breakage: breakage,
                type: payment.type,
                months: MONTHS
            });
        } catch (error) {
            console.error('Receipt error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to generate receipt' });
        }
    };

    const initiateRazorpayPayment = async () => {
        if (isInitiating) return;
        
        try {
            console.log("[Payment] Action Triggered");
            setIsInitiating(true);
            
            const token = await AsyncStorage.getItem('studentToken');
            const studentDataStr = await AsyncStorage.getItem('studentData');
            const student = JSON.parse(studentDataStr || '{}');

            const finalAmount = paymentType === 'MONTHLY' ? modalTotal : parseFloat(customAmount);
            
            if (!student.id || isNaN(finalAmount) || finalAmount <= 0) {
                Toast.show({ type: 'error', text1: 'Error', text2: 'Invalid payment data' });
                setIsInitiating(false);
                return;
            }

            const endpoint = paymentType === 'MONTHLY' 
                ? `${BASE_URL}/api/razorpay/fees/create-order`
                : `${BASE_URL}/api/razorpay/ot-fees/create-order`;
            
            const payload = paymentType === 'MONTHLY'
                ? { amount: finalAmount, studentId: student.id, month: selectedItem.month, year: selectedItem.year }
                : { amount: finalAmount, studentId: student.id, paymentId: selectedItem.payment_id };

            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const sessionId = storedSessionId || student.current_session_id;

            const orderRes = await axios.post(endpoint, payload, { 
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });

            const { order, key_id } = orderRes.data;
            console.log("[Payment] Order Created:", order.id);

            const options = {
                description: paymentType === 'MONTHLY' ? `Monthly Fee - ${MONTHS[selectedItem.month - 1]} ${selectedItem.year}` : `Fee: ${selectedItem.reason}`,
                image: student.institute_logo || '',
                currency: order.currency,
                key: key_id,
                amount: order.amount,
                name: student.institute_name || 'Institute Fees',
                order_id: order.id,
                prefill: { email: student.email || '', contact: student.mobile || '', name: student.name || '' },
                theme: { color: theme.primary }
            };

            RazorpayCheckout.open(options).then(async (data: any) => {
                console.log("[Payment] Razorpay window success");
                try {
                    const verifyEndpoint = paymentType === 'MONTHLY' ? `${BASE_URL}/api/razorpay/fees/verify-payment` : `${BASE_URL}/api/razorpay/ot-fees/verify-payment`;
                    const verifyPayload = paymentType === 'MONTHLY'
                        ? { razorpay_order_id: data.razorpay_order_id, razorpay_payment_id: data.razorpay_payment_id, razorpay_signature: data.razorpay_signature, studentId: student.id, month: selectedItem.month, year: selectedItem.year, amount: finalAmount }
                        : { razorpay_order_id: data.razorpay_order_id, razorpay_payment_id: data.razorpay_payment_id, razorpay_signature: data.razorpay_signature, studentId: student.id, paymentId: selectedItem.payment_id, amount: finalAmount };

                    const verifyRes = await axios.post(verifyEndpoint, verifyPayload, { headers: { Authorization: `Bearer ${token}` } });

                    if (verifyRes.data.success) {
                        setShowPayModal(false);
                        fetchData();
                        Toast.show({ type: 'success', text1: 'Payment Successful!' });
                    }
                } catch (vErr) {
                    console.error("[Payment] Verification Error", vErr);
                }
            }).catch((error: any) => {
                if (error.code !== 2) {
                    Toast.show({ type: 'error', text1: 'Payment Failed', text2: error.description });
                }
            }).finally(() => {
                setIsInitiating(false);
            });

        } catch (error: any) {
            console.error("[Payment] Flow Crashed", error);
            setIsInitiating(false);
            Toast.show({ type: 'error', text1: 'Network Error', text2: 'Failed to connect to server' });
        }
    };

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const getMonthColor = (index: number) => {
        const keys = Object.keys(BLENDING_COLORS);
        const key = keys[index % keys.length] as keyof typeof BLENDING_COLORS;
        return BLENDING_COLORS[key];
    };

    const isPaid = (month: number, year: number) => {
        return feeData?.payments?.some((p: any) => p.month === month && p.year === year && p.status === 'paid');
    };

    const combinedHistory = [
        ...(feeData?.payments || []).map((p: any) => ({ ...p, type: 'MONTHLY' })),
        ...(feeData?.one_time_fees || []).filter((f: any) => f.status === 'paid').map((f: any) => ({ ...f, type: 'ONE-TIME', month: new Date(f.updated_at).getMonth() + 1, year: new Date(f.updated_at).getFullYear(), paid_at: f.updated_at }))
    ].sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

    const renderHistoryItem = ({ item, index }: any) => (
        <View style={[styles.historyItem, index !== combinedHistory.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
            <View style={styles.historyLeft}>
                <View style={[styles.iconCircle, { backgroundColor: theme.success + '15' }]}><Ionicons name="checkmark-circle" size={20} color={theme.success} /></View>
                <View><Text style={[styles.historyMonth, { color: theme.text }]} numberOfLines={1}>{item.type === 'ONE-TIME' ? item.reason : `${MONTHS[item.month - 1]} ${item.year}`}</Text><Text style={[styles.historyDate, { color: theme.textLight }]}>{item.paid_at ? new Date(item.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'} • {item.type}</Text></View>
            </View>
            <View style={styles.historyRight}>
                <TouchableOpacity style={styles.downloadReceiptIcon} onPress={() => handleDownloadReceipt(item)}><Ionicons name="download-outline" size={18} color={theme.primary} /></TouchableOpacity>
                <Text style={[styles.historyAmount, { color: theme.success, marginTop: 4 }]}>₹{(item.type === 'ONE-TIME' ? parseFloat(item.paid_amount) : (feeData.fee_structure.monthly_fees + (feeData.fee_structure.transport_facility ? feeData.fee_structure.transport_fees : 0) + (feeData.extra_charges || []).filter((ec: any) => ec.month === item.month && ec.year === item.year).reduce((sum: number, ec: any) => sum + parseFloat(ec.amount), 0))).toLocaleString()}</Text>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Fee Management</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, { borderBottomColor: activeTab === 'pending' ? theme.primary : 'transparent' }]} onPress={() => setActiveTab('pending')}><Text style={[styles.tabText, { color: activeTab === 'pending' ? theme.primary : theme.textLight }]}>Pending Dues</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tab, { borderBottomColor: activeTab === 'history' ? theme.primary : 'transparent' }]} onPress={() => setActiveTab('history')}><Text style={[styles.tabText, { color: activeTab === 'history' ? theme.primary : theme.textLight }]}>Payment History</Text></TouchableOpacity>
            </View>

            {activeTab === 'pending' ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}>
                    <View style={styles.mainLayout}>
                        {(() => {
                            const pendingMonthly = feeData?.activated_months?.filter((item: any) => !isPaid(item.month, item.year)) || [];
                            const pendingOneTime = feeData?.one_time_fees?.filter((f: any) => f.status !== 'paid') || [];
                            if (pendingMonthly.length === 0 && pendingOneTime.length === 0) return <View style={styles.emptyState}><Ionicons name="checkmark-done-circle-outline" size={64} color={theme.success} /><Text style={[styles.emptyText, { color: theme.text, fontSize: 18, fontWeight: '800' }]}>All Clear!</Text></View>;
                            return (
                                <>
                                    {pendingMonthly.map((item: any, index: number) => {
                                        const extra = (feeData.extra_charges || []).filter((ec: any) => ec.month === item.month && ec.year === item.year).reduce((sum: number, ec: any) => sum + parseFloat(ec.amount || 0), 0);
                                        const total = feeData.fee_structure.monthly_fees + (feeData.fee_structure.transport_facility ? feeData.fee_structure.transport_fees : 0) + extra;
                                        return (
                                            <View key={`m-${index}`} style={styles.cardContainer}>
                                                <LinearGradient colors={getMonthColor(index)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flashcard}>
                                                    <View><Text style={styles.cardMonth}>{MONTHS[item.month - 1]}</Text><Text style={styles.cardYear}>{item.year} - Monthly</Text></View>
                                                    <View><Text style={styles.amountLabel}>Total Due</Text><Text style={styles.amountValue}>₹{total.toLocaleString()}</Text></View>
                                                    <TouchableOpacity style={styles.payButton} onPress={() => handlePayNow(item, total, [], 'MONTHLY')}><Text style={[styles.payButtonText, { color: getMonthColor(index)[1] }]}>Pay Now</Text></TouchableOpacity>
                                                </LinearGradient>
                                            </View>
                                        );
                                    })}
                                    {pendingOneTime.map((item: any, index: number) => {
                                        const color = getMonthColor(index + 5);
                                        const remaining = parseFloat(item.due_amount) - parseFloat(item.paid_amount || 0);
                                        return (
                                            <View key={`ot-${index}`} style={styles.cardContainer}>
                                                <LinearGradient colors={color} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flashcard}>
                                                    <View><Text style={[styles.cardMonth, {fontSize: 20}]} numberOfLines={1}>{item.reason}</Text><Text style={styles.cardYear}>One-Time Fee</Text></View>
                                                    <View><Text style={styles.amountLabel}>Remaining</Text><Text style={styles.amountValue}>₹{remaining.toLocaleString()}</Text></View>
                                                    <TouchableOpacity style={styles.payButton} onPress={() => handlePayNow(item, remaining, [], 'ONE-TIME')}><Text style={[styles.payButtonText, { color: color[1] }]}>Pay Balance</Text></TouchableOpacity>
                                                </LinearGradient>
                                            </View>
                                        );
                                    })}
                                </>
                            );
                        })()}
                    </View>
                </ScrollView>
            ) : (
                <FlatList data={combinedHistory} renderItem={renderHistoryItem} keyExtractor={(item, index) => index.toString()} contentContainerStyle={[styles.mainLayout, {paddingBottom: 40}]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />} ListEmptyComponent={<View style={styles.emptyState}><Ionicons name="receipt-outline" size={48} color={theme.textLight} /><Text style={[styles.emptyText, { color: theme.textLight }]}>No records.</Text></View>} />
            )}

            <Modal visible={showPayModal} transparent animationType="slide" onRequestClose={() => setShowPayModal(false)}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                >
                    <TouchableOpacity 
                        style={styles.centeredModal} 
                        activeOpacity={1} 
                        onPress={() => setShowPayModal(false)}
                    >
                        <View style={[styles.payModalContent, { backgroundColor: theme.card }]}>
                            <ScrollView 
                                bounces={false} 
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >
                                <TouchableOpacity activeOpacity={1}>
                                    <View style={styles.modalHeaderBar}><View style={styles.modalHandle} /></View>
                                    <Text style={[styles.payModalTitle, { color: theme.text }]}>Payment Breakdown</Text>
                                    <Text style={[styles.modalSubtitle, { color: theme.textLight }]}>
                                        {paymentType === 'MONTHLY' ? `${MONTHS[selectedItem?.month - 1]} ${selectedItem?.year} Fees` : selectedItem?.reason}
                                    </Text>
                                    <View style={styles.payBreakageList}>
                                        {modalBreakage.map((item, idx) => (
                                            <View key={idx} style={styles.payBreakageRow}>
                                                <Text style={[styles.breakageLabel, { color: theme.textLight }]}>{item.label}</Text>
                                                <Text style={[styles.breakageAmount, { color: theme.text }]}>₹{item.amount.toLocaleString()}</Text>
                                            </View>
                                        ))}
                                        {paymentType === 'ONE-TIME' ? (
                                            <View style={[styles.customAmountArea, { borderTopColor: theme.border }]}>
                                                <Text style={[styles.inputLabel, { color: theme.text }]}>Enter Amount to Pay (₹)</Text>
                                                <View style={styles.inputWrapper}>
                                                    <TextInput
                                                        style={[styles.customInput, { color: theme.primary, borderColor: theme.primary }]}
                                                        keyboardType="numeric"
                                                        value={customAmount}
                                                        onChangeText={setCustomAmount}
                                                        placeholder="Enter amount"
                                                        placeholderTextColor={theme.textLight}
                                                        autoFocus={true}
                                                    />
                                                    <TouchableOpacity 
                                                        style={styles.fullPayShortcut}
                                                        onPress={() => setCustomAmount(modalTotal.toString())}
                                                    >
                                                        <Text style={[styles.shortcutText, { color: theme.text }]}>Pay Full</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <View style={[styles.totalBreakageRow, { borderTopColor: theme.border }]}>
                                                <Text style={[styles.totalLabel, { color: theme.text }]}>Total Amount</Text>
                                                <Text style={[styles.totalAmount, { color: theme.primary }]}>₹{modalTotal.toLocaleString()}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <TouchableOpacity 
                                        style={[
                                            styles.proceedPayBtn, 
                                            { backgroundColor: theme.primary },
                                            (isInitiating || (paymentType === 'ONE-TIME' && (!customAmount || parseFloat(customAmount) <= 0 || parseFloat(customAmount) > modalTotal))) && { opacity: 0.5 }
                                        ]} 
                                        onPress={initiateRazorpayPayment}
                                        disabled={isInitiating || (paymentType === 'ONE-TIME' && (!customAmount || parseFloat(customAmount) <= 0 || parseFloat(customAmount) > modalTotal))}
                                    >
                                        {isInitiating ? <ActivityIndicator color="#fff" size="small" /> : (
                                            <>
                                                <Text style={styles.proceedPayText}>
                                                    {paymentType === 'ONE-TIME' 
                                                        ? `Pay ₹${parseFloat(customAmount || '0').toLocaleString()} Now`
                                                        : 'Proceed to Pay'
                                                    }
                                                </Text>
                                                <Ionicons name="shield-checkmark" size={20} color="#fff" />
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 }, centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60 },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 10 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3 },
    tabText: { fontSize: 14, fontWeight: '800' },
    scrollContent: { paddingBottom: 40 },
    mainLayout: { paddingHorizontal: 20, marginTop: 15 },
    cardContainer: { marginBottom: 20, borderRadius: 24, elevation: 6 },
    flashcard: { borderRadius: 24, padding: 22, minHeight: 180, justifyContent: 'space-between' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    cardMonth: { fontSize: 24, fontWeight: '900', color: '#fff' },
    cardYear: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
    extraBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, borderRadius: 10 },
    extraBadgeText: { fontSize: 9, color: '#fff', fontWeight: '900' },
    cardBody: { marginTop: 10 },
    amountLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
    amountValue: { fontSize: 28, fontWeight: '900', color: '#fff' },
    payButton: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, alignSelf: 'flex-start', marginTop: 10 },
    payButtonText: { fontSize: 14, fontWeight: '900' },
    historyItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 15 },
    historyLeft: { flexDirection: 'row', gap: 12, flex: 1 },
    iconCircle: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    historyMonth: { fontSize: 15, fontWeight: '800' },
    historyDate: { fontSize: 11, color: '#666' },
    historyRight: { alignItems: 'flex-end' },
    historyAmount: { fontSize: 16, fontWeight: '900' },
    downloadReceiptIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { marginTop: 10 },
    centeredModal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    payModalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingBottom: 40 },
    modalHeaderBar: { alignItems: 'center', marginBottom: 15 },
    modalHandle: { width: 40, height: 4, backgroundColor: '#ccc', borderRadius: 2 },
    payModalTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
    modalSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
    payBreakageList: { backgroundColor: 'rgba(0,0,0,0.02)', padding: 15, borderRadius: 20 },
    payBreakageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    breakageLabel: { fontSize: 13 }, breakageAmount: { fontWeight: '700' },
    totalBreakageRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 5 },
    totalLabel: { fontWeight: '800' }, totalAmount: { fontSize: 18, fontWeight: '900' },
    customAmountArea: { marginTop: 10 },
    inputLabel: { fontSize: 11, fontWeight: '800', marginBottom: 5 },
    customInput: { height: 45, borderWidth: 2, borderRadius: 12, paddingHorizontal: 15, fontSize: 18, fontWeight: '800' },
    proceedPayBtn: { height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 25 },
    proceedPayText: { color: '#fff', fontSize: 16, fontWeight: '900' }
});