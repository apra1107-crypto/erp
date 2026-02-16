import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Dimensions, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { API_ENDPOINTS } from '../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SalaryHistoryBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    teacher: any;
    role?: 'principal' | 'teacher';
}

const SalaryHistoryBottomSheet = ({ visible, onClose, teacher, role = 'principal' }: SalaryHistoryBottomSheetProps) => {
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (visible && (teacher || role === 'teacher')) {
            fetchHistory();
        }
    }, [visible, teacher, role]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem(role === 'teacher' ? 'teacherToken' : 'token');
            const url = role === 'teacher' 
                ? `${API_ENDPOINTS.SALARY}/my-history`
                : `${API_ENDPOINTS.SALARY}/teacher/${teacher?.id}/history`;

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(res.data);
        } catch (error) {
            console.error('Error fetching salary history:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load salary history' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const styles = useMemo(() => StyleSheet.create({
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
        modalContent: {
            backgroundColor: theme.card,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            height: '80%',
            padding: 24,
        },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
        modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text },
        
        historyItem: {
            backgroundColor: theme.background,
            padding: 16,
            borderRadius: 20,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
        },
        monthYear: { fontSize: 16, fontWeight: '800', color: theme.text },
        paidAt: { fontSize: 12, color: theme.textLight, marginTop: 4 },
        amount: { fontSize: 18, fontWeight: '900', color: theme.primary },
        emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
        emptyText: { color: theme.textLight, marginTop: 15, fontSize: 15, fontWeight: '600' }
    }), [theme, isDark]);

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Salary History</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={32} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>

                    {loading && !refreshing ? (
                        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                    ) : (
                        <ScrollView 
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} />}
                        >
                            {history.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="wallet-outline" size={60} color={theme.border} />
                                    <Text style={styles.emptyText}>No salary records found.</Text>
                                </View>
                            ) : (
                                history.map((item) => (
                                    <View key={item.id} style={styles.historyItem}>
                                        <View>
                                            <Text style={styles.monthYear}>{item.month_year}</Text>
                                            <Text style={styles.paidAt}>Paid on {formatDate(item.paid_at)}</Text>
                                        </View>
                                        <Text style={styles.amount}>₹{parseFloat(item.amount).toLocaleString()}</Text>
                                    </View>
                                ))
                            )}
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
};

export default SalaryHistoryBottomSheet;
