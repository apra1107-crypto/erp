import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';

export default function TeacherSalaryHistory() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();

    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const res = await axios.get(`${API_ENDPOINTS.SALARY}/my-history`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(res.data);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDateTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const d = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const t = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${d} at ${t}`;
    };

    const totalEarnings = useMemo(() => {
        return history.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
    }, [history]);

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'transparent',
        },
        title: { fontSize: 22, fontWeight: '900', color: theme.text, marginLeft: 15 },
        summaryCard: {
            margin: 20,
            padding: 20,
            borderRadius: 24,
            backgroundColor: theme.primary,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
        },
        summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
        summaryValue: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4 },
        list: { paddingHorizontal: 20, paddingBottom: 40 },
        card: {
            backgroundColor: theme.card, borderRadius: 20, padding: 16, marginBottom: 12,
            borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center'
        },
        iconWrapper: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.success + '15', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
        details: { flex: 1 },
        month: { fontSize: 16, fontWeight: '800', color: theme.text },
        timestamp: { fontSize: 11, color: theme.textLight, marginTop: 4 },
        amount: { fontSize: 18, fontWeight: '900', color: theme.text },
        emptyBox: { alignItems: 'center', marginTop: 100 },
        emptyText: { color: theme.textLight, marginTop: 15, fontSize: 15 }
    }), [theme, insets]);

    if (loading) return <View style={{flex:1, justifyContent:'center', alignItems:'center', backgroundColor:theme.background}}><ActivityIndicator size="large" color={theme.primary}/></View>;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Salary History</Text>
            </View>

            <View style={styles.summaryCard}>
                <View>
                    <Text style={styles.summaryLabel}>Total Earnings</Text>
                    <Text style={styles.summaryValue}>₹{totalEarnings.toLocaleString()}</Text>
                </View>
                <Ionicons name="cash-outline" size={40} color="rgba(255,255,255,0.5)" />
            </View>

            <FlatList 
                data={history}
                contentContainerStyle={styles.list}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.iconWrapper}>
                            <Ionicons name="checkmark-done" size={22} color={theme.success} />
                        </View>
                        <View style={styles.details}>
                            <Text style={styles.month}>{item.month_year}</Text>
                            <Text style={styles.timestamp}>{formatDateTime(item.paid_at)}</Text>
                        </View>
                        <Text style={styles.amount}>₹{parseFloat(item.amount).toLocaleString()}</Text>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Ionicons name="receipt-outline" size={80} color={theme.border} />
                        <Text style={styles.emptyText}>No salary records found for this session.</Text>
                    </View>
                }
            />
        </View>
    );
}
