import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../../../constants/Config';
import Toast from 'react-native-toast-message';
import { generateFeeReceipt, previewFeeReceipt } from '../../../utils/feeReceiptGenerator';
import RazorpayCheckout from 'react-native-razorpay';

interface MonthlyFeesTabProps {
    history: any[];
    selectedMonth: string;
    instituteInfo: any;
    refreshData: () => void;
    onPreviewReceipt: (fee: any) => void;
}

const MonthlyFeesTab = ({ history, selectedMonth, instituteInfo, refreshData, onPreviewReceipt }: MonthlyFeesTabProps) => {
    const { theme, isDark } = useTheme();
    const [isReceiptLoading, setIsReceiptLoading] = useState(false);
    const [isPaying, setIsPaying] = useState(false);

    const currentFee = useMemo(() => {
        return history.find(f => f.month_year === selectedMonth);
    }, [history, selectedMonth]);

    const handlePayment = async (fee: any) => {
        if (isPaying) return;
        try {
            setIsPaying(true);
            const token = await AsyncStorage.getItem('studentToken');
            const studentStr = await AsyncStorage.getItem('studentData');
            const student = JSON.parse(studentStr!);

            // 1. Create Order
            const orderRes = await axios.post(`${API_ENDPOINTS.FEES}/create-order`, {
                amount: fee.total_amount,
                studentFeeId: fee.id,
                feeType: 'monthly'
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (!orderRes.data.success) throw new Error('Order creation failed');

            const options = {
                description: `Monthly Fees for ${fee.month_year}`,
                image: instituteInfo?.logo_url || '',
                currency: 'INR',
                key: orderRes.data.key_id,
                amount: orderRes.data.order.amount,
                name: instituteInfo?.institute_name || 'School ERP',
                order_id: orderRes.data.order.id,
                prefill: {
                    email: student.email,
                    contact: student.mobile,
                    name: student.name
                },
                theme: { color: theme.primary }
            };

            RazorpayCheckout.open(options).then(async (data: any) => {
                // 2. Verify Payment
                const verifyRes = await axios.post(`${API_ENDPOINTS.FEES}/verify-payment`, {
                    ...data,
                    studentFeeId: fee.id,
                    instituteId: student.institute_id,
                    feeType: 'monthly',
                    studentId: student.id,
                    month_year: fee.month_year,
                    amount: fee.total_amount
                }, { headers: { Authorization: `Bearer ${token}` } });

                if (verifyRes.data.success) {
                    Toast.show({ type: 'success', text1: 'Payment Successful', text2: 'Receipt will be available shortly.' });
                    refreshData();
                    // Automatically show receipt modal
                    const paidFee = { ...fee, status: 'paid', payment_id: data.razorpay_payment_id, paid_at: new Date() };
                    onPreviewReceipt(paidFee);
                }
            }).catch((error: any) => {
                console.log('Razorpay Error:', error);
                Toast.show({ type: 'error', text1: 'Payment Failed', text2: error.description });
            });

        } catch (error) {
            console.error('Payment Error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Could not initiate payment' });
        } finally {
            setIsPaying(false);
        }
    };

    const handleAction = async (fee: any, type: 'view' | 'share') => {
        if (isReceiptLoading) return;
        try {
            if (type === 'view') {
                onPreviewReceipt(fee);
            } else {
                setIsReceiptLoading(true);
                const studentStr = await AsyncStorage.getItem('studentData');
                const student = JSON.parse(studentStr!);
                await generateFeeReceipt(fee, instituteInfo, student);
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to process receipt' });
        } finally {
            setIsReceiptLoading(false);
        }
    };

    if (!currentFee) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="document-text-outline" size={60} color={theme.border} />
                <Text style={styles.emptyText}>No fee structure for {selectedMonth}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={[
                styles.card, 
                { backgroundColor: theme.card, borderColor: theme.border },
                currentFee.status === 'paid' && { borderLeftWidth: 6, borderLeftColor: theme.success, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1 }
            ]}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={[styles.monthLabel, { color: theme.text }]}>{currentFee.month_year}</Text>
                            {currentFee.status === 'paid' && (
                                <View style={[styles.paidBadge, { backgroundColor: theme.success + '15' }]}>
                                    <Text style={[styles.paidBadgeText, { color: theme.success }]}>PAID</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.statusLabel, { color: theme.textLight }]}>
                            {currentFee.status === 'paid' ? 'Receipt Ref: ' + (currentFee.payment_id?.slice(-8) || 'N/A') : 'Payment Outstanding'}
                        </Text>
                    </View>
                    <Text style={[styles.amount, { color: currentFee.status === 'paid' ? theme.success : theme.primary }]}>
                        ₹{parseFloat(currentFee.total_amount).toLocaleString()}
                    </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border, height: 1, borderStyle: currentFee.status === 'paid' ? 'dashed' : 'solid', opacity: isDark ? 0.3 : 1 }]} />

                {/* Breakdown */}
                <View style={{ paddingVertical: 5 }}>
                    {currentFee.breakdown && Object.entries(currentFee.breakdown).map(([name, amt]: [string, any]) => (
                        <View key={name} style={styles.itemRow}>
                            <Text style={[styles.itemName, { color: theme.textLight }]}>{name}</Text>
                            <Text style={[styles.itemAmt, { color: theme.text }]}>₹{parseFloat(amt).toLocaleString()}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.footer}>
                    {currentFee.status === 'paid' ? (
                        <View style={styles.paidActions}>
                            <View style={styles.paidInfo}>
                                <View style={[styles.iconCircle, { backgroundColor: theme.success + '10' }]}>
                                    <Ionicons name="calendar-clear" size={16} color={theme.success} />
                                </View>
                                <View>
                                    <Text style={[styles.footerLabel, { color: theme.textLight }]}>Paid Date</Text>
                                    <Text style={[styles.paidDate, { color: theme.text }]}>{new Date(currentFee.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity 
                                    style={[styles.actionBtn, { backgroundColor: theme.primary + '10' }]}
                                    onPress={() => handleAction(currentFee, 'view')}
                                >
                                    <Ionicons name="eye" size={20} color={theme.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.actionBtn, { backgroundColor: theme.primary + '10' }]}
                                    onPress={() => handleAction(currentFee, 'share')}
                                >
                                    <Ionicons name="share-social" size={20} color={theme.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            style={[styles.payBtn, { backgroundColor: theme.primary }, isPaying && { opacity: 0.7 }]}
                            onPress={() => handlePayment(currentFee)}
                            disabled={isPaying}
                        >
                            {isPaying ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="shield-checkmark" size={20} color="#fff" />
                                    <Text style={styles.payBtnText}>Pay Securely Now</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { padding: 16 },
    card: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    monthLabel: { fontSize: 18, fontWeight: '900', marginRight: 8 },
    statusLabel: { fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
    amount: { fontSize: 22, fontWeight: '900' },
    divider: { marginVertical: 18 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    itemName: { fontSize: 14, fontWeight: '600' },
    itemAmt: { fontSize: 14, fontWeight: '700' },
    footer: { marginTop: 15 },
    paidBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    paidBadgeText: { fontSize: 10, fontWeight: '900' },
    payBtn: {
        height: 54,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    payBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    paidActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    paidInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    footerLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    paidDate: { fontSize: 13, fontWeight: '800' },
    actionBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', marginTop: 100, padding: 40 },
    emptyText: { color: '#999', fontSize: 16, fontWeight: '600', marginTop: 15, textAlign: 'center' }
});

export default MonthlyFeesTab;
