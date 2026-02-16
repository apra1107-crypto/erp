import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Modal, TextInput, FlatList, Platform, RefreshControl, KeyboardAvoidingView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';
import { API_ENDPOINTS } from '../../constants/Config';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AcademicCalendarScreen() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    // Add Event Modal
    const [modalVisible, setModalVisible] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);

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
            const token = await AsyncStorage.getItem('token');
            const userData = await AsyncStorage.getItem('userData');
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

    const handleOpenAddModal = () => {
        // Set default date to the first day of the currently selected month/year
        setDate(new Date(selectedYear, selectedMonth, 1));
        setTitle(''); // Clear previous title
        setModalVisible(true);
    };

    const handleAddEvent = async () => {
        if (!title.trim()) {
            Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Event title is required' });
            return;
        }

        try {
            setSubmitting(true);
            const token = await AsyncStorage.getItem('token');
            const userData = await AsyncStorage.getItem('userData');
            const selectedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const sessionId = selectedSessionId || (userData ? JSON.parse(userData).current_session_id : null);

            // Format date as YYYY-MM-DD using local time to avoid timezone shift
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;
            
            await axios.post(API_ENDPOINTS.CALENDAR, {
                title,
                event_date: formattedDate
            }, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });

            Toast.show({ type: 'success', text1: 'Success', text2: 'Event added to calendar' });
            setModalVisible(false);
            setTitle('');
            setDate(new Date());
            fetchEvents(); // Refresh list
        } catch (error) {
            console.error('Error adding event:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to add event' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteEvent = async (id: number) => {
        try {
            const token = await AsyncStorage.getItem('token');
            await axios.delete(`${API_ENDPOINTS.CALENDAR}/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Event removed' });
            fetchEvents();
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete event' });
        }
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        const currentDate = selectedDate || date;
        setShowDatePicker(Platform.OS === 'ios');
        setDate(currentDate);
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
        
        fab: {
            position: 'absolute',
            bottom: 30,
            right: 25,
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: theme.primary,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 8,
        },

        // Modal
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        modalContent: {
            backgroundColor: theme.card,
            borderTopLeftRadius: 35,
            borderTopRightRadius: 35,
            padding: 25,
            maxHeight: '80%',
        },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
        modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text },
        inputLabel: { fontSize: 14, fontWeight: '800', color: theme.textLight, marginBottom: 8, marginTop: 15, textTransform: 'uppercase' },
        textInput: {
            backgroundColor: theme.background,
            borderRadius: 15,
            padding: 15,
            color: theme.text,
            fontSize: 16,
            borderWidth: 1,
            borderColor: theme.border,
        },
        dateBtn: {
            backgroundColor: theme.background,
            borderRadius: 15,
            padding: 15,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        submitBtn: {
            backgroundColor: theme.primary,
            height: 56,
            borderRadius: 18,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: 30,
            marginBottom: 20,
        },
        submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
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
                            // This shouldn't happen with our new server config, but good for safety
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
                                <TouchableOpacity onPress={() => handleDeleteEvent(item.id)} style={{ padding: 5 }}>
                                    <Ionicons name="trash-outline" size={20} color={theme.danger} />
                                </TouchableOpacity>
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

            <TouchableOpacity style={styles.fab} onPress={handleOpenAddModal}>
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>

                        <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>

                            <KeyboardAvoidingView

                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}

                                style={styles.modalOverlay}

                            >

                                <View style={styles.modalContent}>

                                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>

                                        <View style={styles.modalHeader}>

                                            <Text style={styles.modalTitle}>Add Event</Text>

                                            <TouchableOpacity onPress={() => setModalVisible(false)}>

                                                <Ionicons name="close-circle" size={30} color={theme.textLight} />

                                            </TouchableOpacity>

                                        </View>

            

                                        <Text style={styles.inputLabel}>Event Title</Text>

                                        <TextInput

                                            style={styles.textInput}

                                            placeholder="e.g. Final Exams"

                                            placeholderTextColor={theme.textLight}

                                            value={title}

                                            onChangeText={setTitle}

                                        />

            

                                        <Text style={styles.inputLabel}>Date</Text>

                                        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>

                                            <Text style={{ color: theme.text, fontSize: 16 }}>{date.toLocaleDateString('en-IN')}</Text>

                                            <Ionicons name="calendar-outline" size={20} color={theme.textLight} />

                                        </TouchableOpacity>

            

                                        {showDatePicker && (

                                            <DateTimePicker

                                                value={date}

                                                mode="date"

                                                display="default"

                                                onChange={onDateChange}

                                            />

                                        )}

                                    </ScrollView>

                                    <TouchableOpacity style={styles.submitBtn} onPress={handleAddEvent} disabled={submitting}>

                                        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>ADD EVENT</Text>}

                                    </TouchableOpacity>

                                </View>

                            </KeyboardAvoidingView>

                        </Modal>


                    </View>

            
    );
}
