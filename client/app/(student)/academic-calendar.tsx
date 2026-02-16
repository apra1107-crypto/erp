import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, FlatList, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';
import { API_ENDPOINTS } from '../../constants/Config';
import Toast from 'react-native-toast-message';

export default function StudentAcademicCalendarScreen() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Filter
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useFocusEffect(
        useCallback(() => {
            fetchEvents();
        }, [selectedMonth, selectedYear])
    );

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('studentToken');
            const userData = await AsyncStorage.getItem('studentData');
            const selectedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const sessionId = selectedSessionId || (userData ? JSON.parse(userData).current_session_id : null);

            // Adding +1 to month because API expects 1-12, JS Date uses 0-11
            const response = await axios.get(`${API_ENDPOINTS.CALENDAR}?month=${selectedMonth + 1}&year=${selectedYear}`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            setEvents(response.data);
        } catch (error) {
            console.error('Error fetching calendar events:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
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
        
        filterContainer: {
            flexDirection: 'row',
            padding: 15,
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: theme.card,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        monthSelector: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        monthText: { fontSize: 16, fontWeight: '800', color: theme.text, width: 100, textAlign: 'center' },
        
        listContent: { padding: 15 },
        eventCard: {
            backgroundColor: theme.card,
            borderRadius: 16,
            padding: 15,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            alignItems: 'center',
        },
        dateBox: {
            backgroundColor: theme.primary + '15',
            borderRadius: 12,
            padding: 10,
            alignItems: 'center',
            minWidth: 60,
            marginRight: 15,
        },
        dayText: { fontSize: 18, fontWeight: '900', color: theme.primary },
        monthShort: { fontSize: 12, fontWeight: '700', color: theme.textLight, textTransform: 'uppercase' },
        
        eventInfo: { flex: 1 },
        eventTitle: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4 },
        eventDesc: { fontSize: 12, color: theme.textLight },
        
    }), [theme, insets, isDark]);

    const changeMonth = (delta: number) => {
        let newMonth = selectedMonth + delta;
        let newYear = selectedYear;
        if (newMonth > 11) {
            newMonth = 0;
            newYear++;
        } else if (newMonth < 0) {
            newMonth = 11;
            newYear--;
        }
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
    };

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Academic Calendar</Text>
            </View>

            <View style={styles.filterContainer}>
                <TouchableOpacity onPress={() => changeMonth(-1)}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.monthSelector}>
                    <Text style={styles.monthText}>{monthNames[selectedMonth]} {selectedYear}</Text>
                </View>
                <TouchableOpacity onPress={() => changeMonth(1)}>
                    <Ionicons name="chevron-forward" size={24} color={theme.text} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={events}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchEvents(); }} />}
                    renderItem={({ item }) => {
                        // Super-robust parsing: handle "YYYY-MM-DD", ISO strings, or objects
                        let dateStr = "";
                        if (typeof item.event_date === 'string') {
                            dateStr = item.event_date.split('T')[0];
                        } else if (item.event_date instanceof Date) {
                            const y = item.event_date.getFullYear();
                            const m = String(item.event_date.getMonth() + 1).padStart(2, '0');
                            const d = String(item.event_date.getDate()).padStart(2, '0');
                            dateStr = `${y}-${m}-${d}`;
                        }

                        const [y, m, d] = dateStr.split('-').map(Number);

                        if (!y || !m || !d) {
                            return (
                                <View style={styles.eventCard}>
                                    <Text style={{ color: theme.danger }}>Invalid Date: {JSON.stringify(item.event_date)}</Text>
                                </View>
                            );
                        }

                        return (
                            <View style={styles.eventCard}>
                                <View style={styles.dateBox}>
                                    <Text style={styles.dayText}>{d}</Text>
                                    <Text style={styles.monthShort}>{monthNames[m - 1].substring(0, 3)}</Text>
                                </View>
                                <View style={styles.eventInfo}>
                                    <Text style={styles.eventTitle}>{item.title}</Text>
                                    {item.description ? <Text style={styles.eventDesc}>{item.description}</Text> : null}
                                </View>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Text style={{ color: theme.textLight }}>No events for this month</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
