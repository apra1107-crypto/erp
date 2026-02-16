import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
    StatusBar, RefreshControl, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';

export default function StudentHomework() {
    const router = useRouter();
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [homeworkList, setHomeworkList] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const fetchHomework = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('studentToken');
            const data = await AsyncStorage.getItem('studentData');
            const student = data ? JSON.parse(data) : null;
            
            if (!student) return;

            const dateStr = selectedDate.toISOString().split('T')[0];
            const selectedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const sessionId = selectedSessionId || student.current_session_id;

            const response = await axios.get(
                `${API_ENDPOINTS.HOMEWORK}/list?class_name=${student.class}&section=${student.section}&date=${dateStr}`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    } 
                }
            );

            setHomeworkList(response.data || []);
        } catch (error) {
            console.error('Error fetching student homework:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load homework' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchHomework();
    }, [fetchHomework]);

    const handleMarkDone = async (homeworkId: number) => {
        try {
            const token = await AsyncStorage.getItem('studentToken');
            await axios.post(`${API_ENDPOINTS.HOMEWORK}/mark-done/${homeworkId}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Toast.show({ type: 'success', text1: 'Great Job!', text2: 'Homework marked as completed' });
            fetchHomework(); // Refresh to show done status
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to mark homework as done' });
        }
    };

    const changeDate = (days: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
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
        },
        backBtn: { padding: 5, marginRight: 15 },
        headerTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        
        dateSelector: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 15,
            backgroundColor: theme.card,
            margin: 20,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
        },
        dateText: { fontSize: 16, fontWeight: '800', color: theme.text },
        navBtn: { padding: 8, borderRadius: 10, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },

        content: { flex: 1, paddingHorizontal: 20 },
        homeworkCard: {
            backgroundColor: theme.card,
            borderRadius: 22,
            padding: 20,
            marginBottom: 15,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            elevation: 2,
        },
        subjectHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: theme.border + '50',
        },
        subjectText: { fontSize: 18, fontWeight: '900', color: theme.primary },
        homeworkContent: { fontSize: 14, color: theme.text, lineHeight: 22, fontWeight: '600' },
        cardFooter: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 15,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border + '30',
        },
        timeText: { fontSize: 11, color: theme.textLight, fontWeight: '700' },
        markDoneBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.primary,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            gap: 5
        },
        doneBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.success + '15',
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 8,
            gap: 4
        },
        btnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
        doneText: { color: theme.success, fontSize: 12, fontWeight: '900' },
        emptyBox: { alignItems: 'center', marginTop: 100 },
        emptyText: { color: theme.textLight, fontSize: 16, fontWeight: '600', marginTop: 15 }
    }), [theme, insets]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Homework</Text>
            </View>

            <View style={styles.dateSelector}>
                <TouchableOpacity style={styles.navBtn} onPress={() => changeDate(-1)}>
                    <Ionicons name="chevron-back" size={20} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.dateText}>
                    {selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
                <TouchableOpacity style={styles.navBtn} onPress={() => changeDate(1)}>
                    <Ionicons name="chevron-forward" size={20} color={theme.text} />
                </TouchableOpacity>
            </View>

            <ScrollView 
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchHomework();}} colors={[theme.primary]} />}
            >
                {loading ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                ) : homeworkList.length > 0 ? (
                    homeworkList.map((item, idx) => (
                        <View key={idx} style={styles.homeworkCard}>
                            <View style={styles.subjectHeader}>
                                <Text style={styles.subjectText}>{item.subject}</Text>
                                <Ionicons name="book-outline" size={18} color={theme.primary} />
                            </View>
                            <Text style={styles.homeworkContent}>{item.content}</Text>
                            
                            <View style={styles.cardFooter}>
                                <Text style={styles.timeText}>Posted by {item.teacher_name}</Text>
                                
                                {item.is_done ? (
                                    <View style={styles.doneBadge}>
                                        <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                                        <Text style={styles.doneText}>DONE</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity style={styles.markDoneBtn} onPress={() => handleMarkDone(item.id)}>
                                        <Ionicons name="checkmark" size={16} color="#fff" />
                                        <Text style={styles.btnText}>MARK DONE</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyBox}>
                        <Ionicons name="document-text-outline" size={60} color={theme.border} />
                        <Text style={styles.emptyText}>No homework for this date</Text>
                    </View>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}