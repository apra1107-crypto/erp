import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Dimensions,
    Platform,
    StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../../constants/Config';
import { useTheme } from '../../context/ThemeContext';
import RazorpayCheckout from 'react-native-razorpay';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SubscriptionScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();

    const [loading, setLoading] = useState(true);
    const [subStatus, setSubStatus] = useState<any>(null);
    const [planPrice, setPlanPrice] = useState(499);
    const [history, setHistory] = useState<any[]>([]);
    const [months, setMonths] = useState(1);
    const [processing, setProcessing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const storedData = await AsyncStorage.getItem('principalData');
            if (!storedData) return;
            const userData = JSON.parse(storedData);
            const instId = userData.id;

            if (!instId) return;

            const [statusRes, settingsRes, logsRes] = await Promise.all([
                axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${instId}/status`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${instId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${instId}/logs`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            setSubStatus(statusRes.data);
            if (settingsRes.data?.monthly_price) {
                setPlanPrice(parseFloat(settingsRes.data.monthly_price));
            }
            // Filter only PAYMENT types for history
            const paymentLogs = (logsRes.data || []).filter((log: any) => log.action_type === 'PAYMENT');
            setHistory(paymentLogs);
        } catch (error) {
            console.error('Failed to load subscription data:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load billing details' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleIncrement = () => setMonths(prev => prev + 1);
    const handleDecrement = () => setMonths(prev => Math.max(1, prev - 1));

    const handlePayment = async () => {
        try {
            setProcessing(true);
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const storedData = await AsyncStorage.getItem('principalData');
            if (!storedData) return;
            const userData = JSON.parse(storedData);
            const instId = userData.id;

            const subtotal = months * planPrice;
            const platformFee = subtotal * 0.0236;
            const finalTotal = subtotal + platformFee;

            // 1. Create Order on Backend
            const orderResponse = await axios.post(
                `${API_ENDPOINTS.SUBSCRIPTION}/${instId}/razorpay/order`,
                {
                    months: months,
                    amount: finalTotal,
                    instituteId: instId,
                    instituteName: userData.institute_name
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (!orderResponse.data.success) {
                throw new Error("Failed to create Razorpay order");
            }

            const { order, key_id } = orderResponse.data;

            // 2. Open Razorpay Checkout
            const options = {
                key: key_id,
                amount: order.amount,
                currency: order.currency,
                name: "Klassin ERP",
                description: `Subscription Renewal for ${months} Month(s)`,
                order_id: order.id,
                prefill: {
                    name: userData.principal_name,
                    email: userData.email,
                    contact: userData.mobile,
                },
                theme: {
                    color: "#6366f1",
                },
            };

            RazorpayCheckout.open(options)
                .then(async (data: any) => {
                    // 3. Verify Payment on Backend
                    try {
                        const verifyRes = await axios.post(
                            `${API_ENDPOINTS.SUBSCRIPTION}/${instId}/razorpay/verify`,
                            {
                                razorpay_order_id: data.razorpay_order_id,
                                razorpay_payment_id: data.razorpay_payment_id,
                                razorpay_signature: data.razorpay_signature,
                                instituteId: instId,
                                months: months,
                                amount: order.amount
                            },
                            {
                                headers: { Authorization: `Bearer ${token}` }
                            }
                        );

                        if (verifyRes.data.success) {
                            Alert.alert("Success", "Subscription renewed successfully!", [
                                { text: "Back to Dashboard", onPress: () => router.replace('/(principal)/dashboard') }
                            ]);
                        } else {
                            Alert.alert("Error", "Payment verification failed. Please contact support.");
                        }
                    } catch (err) {
                        console.error("Verification Error:", err);
                        Alert.alert("Error", "Error verifying payment.");
                    }
                })
                .catch((error: any) => {
                    console.log(`Payment failed: ${error.code} | ${error.description}`);
                    if (error.code !== 2) { // 2 is user cancelled
                        Alert.alert("Payment Failed", error.description);
                    }
                });

        } catch (error) {
            console.error('Error initiating payment:', error);
            Alert.alert('Error', 'Error initiating payment. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const subtotal = months * planPrice;
    const platformFee = subtotal * 0.0236;
    const finalTotal = subtotal + platformFee;

    const getStatusLabel = () => {
        if (subStatus?.status === 'active') return 'Active';
        if (subStatus?.status === 'grant') return 'Special Access';
        if (subStatus?.status === 'disabled') return 'Disabled';
        return 'Expired';
    };

    const getStatusColor = () => {
        if (subStatus?.status === 'active') return '#10b981';
        if (subStatus?.status === 'grant') return '#8b5cf6';
        if (subStatus?.status === 'disabled') return '#64748b';
        return '#ef4444';
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Subscription & Billing</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
                
                {/* Current Plan Card */}
                <LinearGradient
                    colors={['#4f46e5', '#818cf8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.planCard}
                >
                    <View style={styles.planHeader}>
                        <View>
                            <Text style={styles.planLabel}>Current Plan</Text>
                            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}33`, borderColor: `${getStatusColor()}66` }]}>
                                <Text style={[styles.statusText, { color: '#fff' }]}>{getStatusLabel()}</Text>
                            </View>
                        </View>
                        <MaterialCommunityIcons name="crown" size={32} color="#fff" style={{ opacity: 0.8 }} />
                    </View>

                    <Text style={styles.planTitle}>
                        {subStatus?.status === 'grant' ? 'Premium' : 'Standard'}{'\n'}Institute
                    </Text>

                    <View style={styles.priceRow}>
                        <Text style={styles.currency}>₹</Text>
                        <Text style={styles.amount}>{Math.round(planPrice).toLocaleString('en-IN')}</Text>
                        <Text style={styles.period}>/month</Text>
                    </View>

                    <View style={styles.expiryBox}>
                        <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.8)" />
                        <Text style={styles.expiryText}>
                            {subStatus?.status === 'active' 
                                ? `Expires: ${new Date(subStatus.subscription_end_date).toLocaleString('en-IN', { 
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit', hour12: true
                                  })}`
                                : subStatus?.status === 'grant' 
                                    ? '⚡ Identity Verified Access'
                                    : 'Your access has expired'}
                        </Text>
                    </View>
                </LinearGradient>

                {/* Renewal Section */}
                <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Extend Subscription</Text>
                        <Text style={[styles.sectionSub, { color: theme.textLight }]}>Add 30-day blocks to your plan</Text>
                    </View>

                    <View style={styles.counterContainer}>
                        <TouchableOpacity 
                            onPress={handleDecrement} 
                            disabled={months <= 1}
                            style={[styles.counterBtn, months <= 1 && { opacity: 0.3 }]}
                        >
                            <Ionicons name="remove" size={24} color="#fff" />
                        </TouchableOpacity>
                        
                        <View style={styles.counterDisplay}>
                            <Text style={[styles.countText, { color: theme.text }]}>{months}</Text>
                            <Text style={[styles.countLabel, { color: theme.textLight }]}>Month{months > 1 ? 's' : ''}</Text>
                        </View>

                        <TouchableOpacity onPress={handleIncrement} style={styles.counterBtn}>
                            <Ionicons name="add" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.billPreview, { backgroundColor: isDark ? '#ffffff05' : '#00000005' }]}>
                        <View style={styles.billRow}>
                            <Text style={[styles.billLabel, { color: theme.textLight }]}>Subtotal</Text>
                            <Text style={[styles.billValue, { color: theme.text }]}>₹{subtotal.toLocaleString('en-IN')}</Text>
                        </View>
                        <View style={styles.billRow}>
                            <Text style={[styles.billLabel, { color: theme.textLight }]}>Platform Fee (2.36%)</Text>
                            <Text style={[styles.billValue, { color: theme.text }]}>₹{platformFee.toFixed(2)}</Text>
                        </View>
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        <View style={styles.billRow}>
                            <Text style={[styles.totalLabel, { color: theme.text }]}>Grand Total</Text>
                            <Text style={[styles.totalValue, { color: theme.primary }]}>₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={[styles.payButton, { backgroundColor: theme.primary }]} 
                        onPress={handlePayment}
                        disabled={processing}
                    >
                        {processing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.payButtonText}>Proceed to Pay ₹{finalTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* History Section */}
                <View style={styles.historyContainer}>
                    <View style={styles.historyHeader}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Payment History</Text>
                        <View style={[styles.historyBadge, { backgroundColor: theme.primary + '20' }]}>
                            <Text style={{ color: theme.primary, fontSize: 12, fontWeight: 'bold' }}>{history.length}</Text>
                        </View>
                    </View>

                    {history.length === 0 ? (
                        <View style={styles.emptyHistory}>
                            <Ionicons name="receipt-outline" size={48} color={theme.textLight} style={{ opacity: 0.5 }} />
                            <Text style={{ color: theme.textLight, marginTop: 10 }}>No payment records found</Text>
                        </View>
                    ) : (
                        history.map((item) => (
                            <View key={item.id} style={[styles.historyItem, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={styles.historyIcon}>
                                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.historyDate, { color: theme.text }]}>
                                        {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </Text>
                                    <Text style={[styles.historyId, { color: theme.textLight }]}>
                                        {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </Text>
                                </View>
                                <Text style={[styles.historyAmount, { color: theme.text }]}>₹{Math.round(item.amount)}</Text>
                            </View>
                        ))
                    )}
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 15,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    planCard: {
        borderRadius: 24,
        padding: 25,
        marginBottom: 20,
        elevation: 10,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    planLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 100,
        marginTop: 6,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    planTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
        marginTop: 20,
        lineHeight: 32,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: 15,
    },
    currency: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
        opacity: 0.8,
    },
    amount: {
        color: '#fff',
        fontSize: 36,
        fontWeight: '900',
        marginHorizontal: 4,
    },
    period: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        fontWeight: '500',
    },
    expiryBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        marginTop: 20,
        alignSelf: 'flex-start',
    },
    expiryText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 8,
    },
    section: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        marginBottom: 25,
    },
    sectionHeader: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    sectionSub: {
        fontSize: 13,
        marginTop: 4,
    },
    counterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
        marginBottom: 25,
    },
    counterBtn: {
        width: 50,
        height: 50,
        borderRadius: 18,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    counterDisplay: {
        alignItems: 'center',
        minWidth: 80,
    },
    countText: {
        fontSize: 32,
        fontWeight: '900',
    },
    countLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginTop: -2,
    },
    billPreview: {
        borderRadius: 16,
        padding: 15,
        marginBottom: 20,
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    billLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    billValue: {
        fontSize: 13,
        fontWeight: '700',
    },
    divider: {
        height: 1,
        marginVertical: 10,
    },
    totalLabel: {
        fontSize: 15,
        fontWeight: '800',
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '900',
    },
    payButton: {
        height: 55,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        elevation: 5,
    },
    payButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    historyContainer: {
        marginBottom: 20,
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    historyBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    emptyHistory: {
        alignItems: 'center',
        padding: 40,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 10,
    },
    historyIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#10b98110',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    historyDate: {
        fontSize: 14,
        fontWeight: '700',
    },
    historyId: {
        fontSize: 11,
        marginTop: 2,
    },
    historyAmount: {
        fontSize: 15,
        fontWeight: '800',
    },
});
