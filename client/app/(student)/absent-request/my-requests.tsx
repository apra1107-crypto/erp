import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, RefreshControl, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

export default function MyAbsentRequests() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchRequests = async () => {
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const response = await axios.get(
                `${API_ENDPOINTS.ABSENT_REQUEST}/my-requests`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setRequests(response.data.requests || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to load your absent notes'
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchRequests();
    };

    const handleDelete = (id: number) => {
        Alert.alert(
            "Delete Request",
            "Are you sure you want to delete this absent note?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('studentToken');
                            await axios.delete(
                                `${API_ENDPOINTS.ABSENT_REQUEST}/delete/${id}`,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            Toast.show({ type: 'success', text1: 'Deleted' });
                            fetchRequests();
                        } catch (error: any) {
                            Toast.show({
                                type: 'error',
                                text1: 'Error',
                                text2: error.response?.data?.message || 'Failed to delete'
                            });
                        }
                    }
                }
            ]
        );
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            backgroundColor: theme.card,
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            zIndex: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 10,
            elevation: 5,
        },
        backBtn: { padding: 8, borderRadius: 12, backgroundColor: theme.background, marginRight: 15 },
        title: { fontSize: 20, fontWeight: '900', color: theme.text },
        content: { flex: 1 },
        list: { padding: 20 },
        card: {
            backgroundColor: theme.card,
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 2,
        },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
        dateText: { fontSize: 18, fontWeight: '900', color: theme.text },
        statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
        statusText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
        reasonLabel: { fontSize: 13, fontWeight: '700', color: theme.textLight, marginBottom: 5 },
        reasonText: { fontSize: 16, color: theme.text, lineHeight: 22 },
        divider: { height: 1, backgroundColor: theme.border, marginVertical: 15 },
        approvalSection: { backgroundColor: theme.success + '10', padding: 12, borderRadius: 12, marginTop: 5 },
        approvalText: { fontSize: 13, color: theme.success, fontWeight: '600' },
        actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 15, gap: 15 },
        actionBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
        actionBtnText: { marginLeft: 5, fontWeight: '700', fontSize: 14 },
        emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
        emptyText: { fontSize: 18, fontWeight: '700', color: theme.textLight, marginTop: 20 },
        newBtn: {
            backgroundColor: theme.primary,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 15,
            marginTop: 20
        },
        newBtnText: { color: '#fff', fontWeight: '800' }
    }), [theme, isDark]);

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'approved': return { bg: theme.success + '20', text: theme.success };
            case 'rejected': return { bg: theme.danger + '20', text: theme.danger };
            default: return { bg: theme.warning + '20', text: theme.warning };
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>My Absent Notes</Text>
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={styles.list}>
                    {requests.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="document-text-outline" size={80} color={theme.border} />
                            <Text style={styles.emptyText}>No absent notes found</Text>
                            <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/(student)/absent-request/submit')}>
                                <Text style={styles.newBtnText}>Submit New Note</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        requests.map((item) => {
                            const statusStyle = getStatusStyles(item.status);
                            const isPending = item.status === 'pending';

                            return (
                                <View key={item.id} style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                            <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status}</Text>
                                        </View>
                                    </View>

                                    <Text style={styles.reasonLabel}>Reason</Text>
                                    <Text style={styles.reasonText}>{item.reason}</Text>

                                    {item.status === 'approved' && (
                                        <View style={styles.approvalSection}>
                                            <Text style={styles.approvalText}>
                                                Approved by {item.approved_by_teacher_name}
                                            </Text>
                                        </View>
                                    )}

                                    {isPending && (
                                        <View style={styles.actions}>
                                            <TouchableOpacity
                                                style={styles.actionBtn}
                                                onPress={() => handleDelete(item.id)}
                                            >
                                                <Ionicons name="trash-outline" size={20} color={theme.danger} />
                                                <Text style={[styles.actionBtnText, { color: theme.danger }]}>Delete</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
