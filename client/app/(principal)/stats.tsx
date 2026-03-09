import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
    StatusBar, RefreshControl, Dimensions, Platform, Modal, FlatList, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'students' | 'teachers' | 'revenue';

export default function PrincipalStats() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const initialTab = params.initialTab as TabType;

    const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'students');
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSessionName, setActiveSessionName] = useState('');
    
    // Global filter used by Students/Teachers
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Attendance UI States
    const [isAttendanceExpanded, setIsAttendanceExpanded] = useState(false);
    const [isTeacherExpanded, setIsTeacherExpanded] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [revenueModalVisible, setRevenueModalVisible] = useState(false);
    const [revenueSelectedDate, setRevenueSelectedDate] = useState(new Date());
    const [revenueStudents, setRevenueStudents] = useState<any[]>([]);
    const [loadingRevenueStudents, setLoadingRevenueStudents] = useState(false);
    const [revenueType, setRevenueType] = useState<'monthly' | 'onetime'>('monthly');
    const [selectedSection, setSelectedSection] = useState<any>(null);
    const [sectionStudents, setSectionStudents] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [detailTab, setDetailTab] = useState<'present' | 'absent'>('present');

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('userData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const activeSessionId = storedSessionId || userData?.current_session_id;
            
            // Try to find session name if available in userData
            if (userData?.sessions) {
                const s = userData.sessions.find((s: any) => s.id === (activeSessionId ? parseInt(activeSessionId) : null));
                if (s) setActiveSessionName(s.name);
                else setActiveSessionName('Session ' + activeSessionId);
            } else if (activeSessionId) {
                setActiveSessionName('Session ' + activeSessionId);
            }

            const month = selectedDate.getMonth() + 1;
            const year = selectedDate.getFullYear();
            const dateStr = selectedDate.toISOString().split('T')[0];

            const response = await axios.get(
                `${API_ENDPOINTS.STATS}?month=${month}&year=${year}&date=${dateStr}`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': activeSessionId?.toString()
                    } 
                }
            );

            setStats(response.data);
        } catch (error: any) {
            console.error('Error fetching principal stats:', error);
            const msg = error.response?.data?.error || error.response?.data?.message || error.message;
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: msg || 'Failed to load statistics'
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedDate]);

    useFocusEffect(
        useCallback(() => {
            fetchStats();
        }, [fetchStats])
    );

    const fetchDailyRevenueStudents = async () => {
        try {
            setLoadingRevenueStudents(true);
            const token = await AsyncStorage.getItem('token');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('userData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const activeSessionId = storedSessionId || userData?.current_session_id;

            const dateStr = revenueSelectedDate.toISOString().split('T')[0];
            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/daily-revenue-details?date=${dateStr}&type=${revenueType}`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': activeSessionId?.toString()
                    } 
                }
            );
            setRevenueStudents(response.data);
        } catch (error) {
            console.error('Error fetching daily revenue:', error);
        } finally {
            setLoadingRevenueStudents(false);
        }
    };

    useEffect(() => {
        if (revenueModalVisible) {
            fetchDailyRevenueStudents();
        }
    }, [revenueSelectedDate, revenueModalVisible]);

    const fetchSectionDetails = async (className: string, section: string) => {
        try {
            setLoadingDetails(true);
            setSelectedSection({ className, section });
            setDetailModalVisible(true);
            const token = await AsyncStorage.getItem('token');
            const userDataStr = await AsyncStorage.getItem('userData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const activeSessionId = userData?.current_session_id;
            const date = selectedDate.toISOString().split('T')[0];

            const response = await axios.get(
                `${API_ENDPOINTS.ATTENDANCE_DETAIL}?className=${className}&section=${section}&date=${date}`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': activeSessionId?.toString()
                    } 
                }
            );
            setSectionStudents(response.data);
        } catch (error) {
            console.error('Error fetching section details:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchStats();
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + delta);
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
        
        tabContainer: {
            paddingHorizontal: 20,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
        },
        tab: {
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
            marginRight: 10,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 5,
            elevation: 2,
        },
        activeTab: {
            backgroundColor: theme.primary,
            borderColor: theme.primary,
        },
        tabText: {
            fontSize: 13,
            fontWeight: '800',
            color: theme.textLight,
        },
        activeTabText: {
            color: '#fff',
        },

        content: { flex: 1 },
        monthSelector: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 20,
            backgroundColor: theme.card,
            margin: 15,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
        },
        monthText: { fontSize: 16, fontWeight: '800', color: theme.text },
        navBtn: { padding: 8, borderRadius: 10, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },

        // Attendance Flashcard
        flashcard: {
            backgroundColor: theme.card,
            margin: 15,
            borderRadius: 30,
            padding: 22,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.05,
            shadowRadius: 15,
            elevation: 5,
        },
        flashcardTop: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 20,
        },
        dateInfo: {
            flex: 1,
        },
        dayText: {
            fontSize: 18,
            fontWeight: '900',
            color: theme.text,
            textTransform: 'uppercase',
        },
        dateText: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.textLight,
            marginTop: 4,
        },
        totalBadge: {
            backgroundColor: theme.primary + '15',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            alignItems: 'center',
        },
        totalBadgeLabel: { fontSize: 9, fontWeight: '800', color: theme.primary, textTransform: 'uppercase' },
        totalBadgeValue: { fontSize: 16, fontWeight: '900', color: theme.primary },

        statsSummary: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            backgroundColor: theme.background,
            borderRadius: 20,
            padding: 15,
        },
        summaryItem: {
            flex: 1,
            alignItems: 'center',
        },
        summaryValue: { fontSize: 24, fontWeight: '900' },
        summaryLabel: { fontSize: 11, fontWeight: '700', color: theme.textLight, marginTop: 4 },
        
        expandToggle: {
            alignItems: 'center',
            paddingTop: 15,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            marginTop: 15,
        },

        // Table Styles
        tableContainer: {
            marginTop: 20,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 15,
            overflow: 'hidden',
        },
        tableHeader: {
            flexDirection: 'row',
            backgroundColor: isDark ? '#252525' : '#F8F9FA',
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        headerCell: {
            padding: 12,
            justifyContent: 'center',
            alignItems: 'center',
        },
        headerText: { fontSize: 12, fontWeight: '900', color: theme.text },
        tableRow: {
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            backgroundColor: theme.card,
        },
        classCell: {
            width: 70,
            justifyContent: 'center',
            alignItems: 'center',
            borderRightWidth: 1,
            borderRightColor: theme.border,
        },
        sectionsContainer: {
            flex: 1,
            flexDirection: 'row',
        },
        sectionCol: {
            flex: 1,
            borderRightWidth: 1,
            borderRightColor: theme.border,
        },
        sectionCell: {
            flex: 1,
            padding: 10,
            alignItems: 'center',
            justifyContent: 'center',
        },
        sectionName: { fontSize: 11, fontWeight: '800', color: theme.primary, marginBottom: 4 },
        sectionRatio: { fontSize: 13, fontWeight: '900', color: theme.text },

        // Detail Modal Styles
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
        },
        modalContent: {
            backgroundColor: theme.card,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            height: '80%',
            paddingTop: 20,
        },
        modalHeader: {
            paddingHorizontal: 20,
            paddingBottom: 15,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        modalTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        modalTabs: {
            flexDirection: 'row',
            padding: 15,
            gap: 10,
        },
        mTab: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 15,
            alignItems: 'center',
            borderWidth: 1,
        },
        mTabText: { fontWeight: '800', fontSize: 14 },
        studentItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 15,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            marginHorizontal: 10,
        },
        rollBadge: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.background,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 15,
            borderWidth: 1,
            borderColor: theme.border,
        },
        rollText: { fontSize: 14, fontWeight: '900', color: theme.primary },
        studentName: { fontSize: 16, fontWeight: '700', color: theme.text },

        sectionCard: {
            backgroundColor: theme.card,
            marginHorizontal: 15,
            marginBottom: 15,
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.border,
        },
        cardTitle: { fontSize: 18, fontWeight: '900', color: theme.text, marginBottom: 20 },
        modalHandle: {
            width: 40,
            height: 5,
            backgroundColor: theme.border,
            borderRadius: 3,
            alignSelf: 'center',
            marginTop: 12,
            marginBottom: 20,
        },
        revenueRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        progressBar: {
            height: 8,
            backgroundColor: isDark ? '#ffffff10' : '#00000005',
            borderRadius: 4,
            overflow: 'hidden',
            marginTop: 5,
        },
        progressFill: {
            height: '100%',
            borderRadius: 4,
        },
    }), [theme, insets, isDark]);

    const renderAttendanceTab = () => {
        if (!stats?.attendance) return null;
        const studentToday = stats.attendance.today.students;
        const byClassSection = stats.attendance.today.byClassSection;

        const getCount = (arr: any[], status: string) => parseInt(arr.find((a: any) => a.status === status)?.count || '0');
        const sPresent = getCount(studentToday, 'present');
        const sAbsent = getCount(studentToday, 'absent');
        const sTotal = stats.students.total;

        const d = selectedDate;
        const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
        const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

        const classes: any = {};
        byClassSection.forEach((item: any) => {
            if (!classes[item.class]) classes[item.class] = [];
            classes[item.class].push(item);
        });

        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}>
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text }}>Student Attendance</Text>
                </View>

                <TouchableOpacity 
                    style={styles.monthSelector}
                    onPress={() => { setShowDatePicker(true); }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="calendar" size={22} color={theme.primary} />
                        <Text style={[styles.monthText, { marginLeft: 12 }]}>{dateStr}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={20} color={theme.textLight} />
                </TouchableOpacity>

                <View style={[styles.flashcard, { marginTop: 5 }]}>
                    <View style={styles.flashcardTop}>
                        <View style={styles.dateInfo}>
                            <Text style={styles.dayText}>{dayName}</Text>
                            <Text style={styles.dateText}>Daily Attendance Report</Text>
                        </View>
                        <View style={styles.totalBadge}>
                            <Text style={styles.totalBadgeLabel}>Institute Strength</Text>
                            <Text style={styles.totalBadgeValue}>{sTotal}</Text>
                        </View>
                    </View>

                    <View style={styles.statsSummary}>
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, { color: theme.success }]}>{sPresent}</Text>
                            <Text style={styles.summaryLabel}>TOTAL PRESENT</Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: theme.border, height: '60%', alignSelf: 'center' }} />
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, { color: theme.danger }]}>{sAbsent}</Text>
                            <Text style={styles.summaryLabel}>TOTAL ABSENT</Text>
                        </View>
                    </View>

                    {isAttendanceExpanded && (
                        <View style={styles.tableContainer}>
                            <View style={styles.tableHeader}>
                                <View style={[styles.headerCell, { width: 70, borderRightWidth: 1, borderRightColor: theme.border }]}>
                                    <Text style={styles.headerText}>CLASS</Text>
                                </View>
                                <View style={[styles.headerCell, { flex: 1 }]}>
                                    <Text style={styles.headerText}>SECTIONS (PRESENT / TOTAL)</Text>
                                </View>
                            </View>

                            {Object.keys(classes).length > 0 ? (
                                Object.keys(classes).sort((a,b) => parseInt(a) - parseInt(b)).map((className) => (
                                    <View key={className} style={styles.tableRow}>
                                        <View style={styles.classCell}>
                                            <Text style={{ fontSize: 16, fontWeight: '900', color: theme.text }}>{className}</Text>
                                        </View>
                                        <View style={styles.sectionsContainer}>
                                            {classes[className].sort((a: any, b: any) => a.section.localeCompare(b.section)).map((sec: any, idx: number) => (
                                                <TouchableOpacity 
                                                    key={sec.section} 
                                                    style={[
                                                        styles.sectionCol, 
                                                        idx === classes[className].length - 1 && { borderRightWidth: 0 }
                                                    ]}
                                                    onPress={() => fetchSectionDetails(sec.class, sec.section)}
                                                >
                                                    <View style={styles.sectionCell}>
                                                        <Text style={styles.sectionName}>{sec.section}</Text>
                                                        <Text style={styles.sectionRatio}>
                                                            {sec.present_students}/{sec.total_students}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: theme.textLight }}>No data recorded for this date</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <TouchableOpacity 
                        style={styles.expandToggle}
                        onPress={() => setIsAttendanceExpanded(!isAttendanceExpanded)}
                    >
                        <Ionicons 
                            name={isAttendanceExpanded ? "chevron-up" : "chevron-down"} 
                            size={24} 
                            color={theme.primary} 
                        />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    };

    const renderRevenueTab = () => {
        if (!stats?.revenue) return null;
        const rev = stats.revenue;
        const totalExpected = (rev.monthly?.expected || 0) + (rev.oneTime?.expected || 0);
        const totalCollected = (rev.monthly?.collected || 0) + (rev.oneTime?.collected || 0);
        const totalRemaining = totalExpected - totalCollected;

        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}>
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text }}>Financial Insights</Text>
                </View>

                {/* Period Selector */}
                <View style={styles.monthSelector}>
                    <TouchableOpacity style={styles.navBtn} onPress={() => {
                        const d = new Date(selectedDate);
                        d.setMonth(d.getMonth() - 1);
                        setSelectedDate(d);
                    }}>
                        <Ionicons name="chevron-back" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.monthText}>{months[selectedDate.getMonth()]} {selectedDate.getFullYear()}</Text>
                    <TouchableOpacity style={styles.navBtn} onPress={() => {
                        const d = new Date(selectedDate);
                        d.setMonth(d.getMonth() + 1);
                        setSelectedDate(d);
                    }}>
                        <Ionicons name="chevron-forward" size={20} color={theme.text} />
                    </TouchableOpacity>
                </View>

                {/* Monthly Collection Card */}
                <TouchableOpacity 
                    activeOpacity={0.9} 
                    onPress={() => {
                        setRevenueType('monthly');
                        setRevenueSelectedDate(new Date());
                        setRevenueModalVisible(true);
                    }}
                >
                    <LinearGradient 
                        colors={['#1e40af', '#1e3a8a']} 
                        style={[styles.flashcard, { padding: 22, borderRadius: 28, marginBottom: 10 }]}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>MONTHLY FEES COLLECTION</Text>
                            <Ionicons name="calendar" size={16} color="rgba(255,255,255,0.5)" />
                        </View>
                        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 8 }}>₹{rev.monthly.collected.toLocaleString()}</Text>
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                            <View>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700' }}>EXPECTED</Text>
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>₹{rev.monthly.expected.toLocaleString()}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700' }}>DUE</Text>
                                <Text style={{ color: '#f87171', fontSize: 14, fontWeight: '800' }}>₹{(rev.monthly.expected - rev.monthly.collected).toLocaleString()}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* One-Time Collection Card */}
                <TouchableOpacity 
                    activeOpacity={0.9} 
                    onPress={() => {
                        setRevenueType('onetime');
                        
                        // Month-Aware Date Logic
                        const now = new Date();
                        const isSelectedMonthCurrent = 
                            selectedDate.getMonth() === now.getMonth() && 
                            selectedDate.getFullYear() === now.getFullYear();
                        
                        if (isSelectedMonthCurrent) {
                            setRevenueSelectedDate(new Date());
                        } else {
                            // Set to 1st of the month being viewed in Stats
                            setRevenueSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
                        }
                        
                        setRevenueModalVisible(true);
                    }}
                >
                    <LinearGradient 
                        colors={['#831843', '#701a75']} 
                        style={[styles.flashcard, { padding: 22, borderRadius: 28, marginTop: 5 }]}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>ONE-TIME FEES COLLECTION</Text>
                            <Ionicons name="flash" size={16} color="rgba(255,255,255,0.5)" />
                        </View>
                        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 8 }}>₹{rev.oneTime.collected.toLocaleString()}</Text>
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
                            <View>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700' }}>TARGET</Text>
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>₹{rev.oneTime.expected.toLocaleString()}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700' }}>PENDING</Text>
                                <Text style={{ color: '#f87171', fontSize: 14, fontWeight: '800' }}>₹{(rev.oneTime.expected - rev.oneTime.collected).toLocaleString()}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Monthly Revenue Breakdown List - Keep this but make it cleaner */}
                <View style={{ paddingHorizontal: 20, marginTop: 25, marginBottom: 10 }}>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text }}>Detailed Breakdown</Text>
                </View>

                <View 
                    style={[styles.sectionCard, { marginTop: 0 }]}
                >
                    <View style={{ gap: 15 }}>
                        <View>
                            <View style={styles.revenueRow}>
                                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>Monthly Tuition Progress</Text>
                                <Text style={{ color: theme.primary, fontWeight: '800' }}>{Math.round((rev.monthly.collected / rev.monthly.expected) * 100) || 0}%</Text>
                            </View>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${(rev.monthly.collected / rev.monthly.expected) * 100}%`, backgroundColor: '#3b82f6' }]} />
                            </View>
                        </View>

                        <View>
                            <View style={styles.revenueRow}>
                                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>One-Time Campaign Progress</Text>
                                <Text style={{ color: '#ec4899', fontWeight: '800' }}>{Math.round((rev.oneTime.collected / rev.oneTime.expected) * 100) || 0}%</Text>
                            </View>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${(rev.oneTime.collected / rev.oneTime.expected) * 100}%`, backgroundColor: '#ec4899' }]} />
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        );
    };

    const renderTeacherTab = () => {
        if (!stats?.attendance) return null;
        const teacherToday = stats.attendance.today.teachers;
        const teacherList = stats.attendance.today.teacherList || [];

        const getCount = (arr: any[], status: string) => parseInt(arr.find((a: any) => a.status === status)?.count || '0');
        const tPresent = getCount(teacherToday, 'present');
        const tAbsent = getCount(teacherToday, 'absent');
        const tTotal = stats.teachers.total;

        const d = selectedDate;
        const dayName = d.toLocaleDateString('en-IN', { weekday: 'long' });
        const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}>
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text }}>Teacher Attendance</Text>
                </View>

                <TouchableOpacity 
                    style={styles.monthSelector}
                    onPress={() => { setShowDatePicker(true); }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="calendar" size={22} color={theme.primary} />
                        <Text style={[styles.monthText, { marginLeft: 12 }]}>{dateStr}</Text>
                    </View>
                    <Ionicons name="chevron-down" size={20} color={theme.textLight} />
                </TouchableOpacity>

                <View style={[styles.flashcard, { marginTop: 5 }]}>
                    <View style={styles.flashcardTop}>
                        <View style={styles.dateInfo}>
                            <Text style={styles.dayText}>{dayName}</Text>
                            <Text style={styles.dateText}>Staff Attendance Report</Text>
                        </View>
                        <View style={styles.totalBadge}>
                            <Text style={styles.totalBadgeLabel}>Total Staff</Text>
                            <Text style={styles.totalBadgeValue}>{tTotal}</Text>
                        </View>
                    </View>

                    <View style={styles.statsSummary}>
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, { color: theme.success }]}>{tPresent}</Text>
                            <Text style={styles.summaryLabel}>PRESENT</Text>
                        </View>
                        <View style={{ width: 1, backgroundColor: theme.border, height: '60%', alignSelf: 'center' }} />
                        <View style={styles.summaryItem}>
                            <Text style={[styles.summaryValue, { color: theme.danger }]}>{tAbsent}</Text>
                            <Text style={styles.summaryLabel}>ABSENT</Text>
                        </View>
                    </View>

                    {isTeacherExpanded && (
                        <View style={{ marginTop: 20 }}>
                            {teacherList.length > 0 ? (
                                teacherList.map((teacher: any) => (
                                    <View key={teacher.id} style={styles.studentItem}>
                                        {teacher.photo_url ? (
                                            <Image source={{ uri: teacher.photo_url }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                                        ) : (
                                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: theme.border }}>
                                                <Ionicons name="person" size={20} color={theme.textLight} />
                                            </View>
                                        )}
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>{teacher.name}</Text>
                                            <Text style={{ fontSize: 12, color: theme.textLight }}>{teacher.subject}</Text>
                                        </View>
                                        <View style={{ 
                                            paddingHorizontal: 10, 
                                            paddingVertical: 4, 
                                            borderRadius: 8, 
                                            backgroundColor: teacher.status === 'present' ? theme.success + '15' : teacher.status === 'absent' ? theme.danger + '15' : theme.textLight + '15' 
                                        }}>
                                            <Text style={{ 
                                                fontSize: 10, 
                                                fontWeight: '900', 
                                                color: teacher.status === 'present' ? theme.success : teacher.status === 'absent' ? theme.danger : theme.textLight,
                                                textTransform: 'uppercase'
                                            }}>
                                                {teacher.status}
                                            </Text>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: theme.textLight }}>No data recorded</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <TouchableOpacity 
                        style={styles.expandToggle}
                        onPress={() => setIsTeacherExpanded(!isTeacherExpanded)}
                    >
                        <Ionicons 
                            name={isTeacherExpanded ? "chevron-up" : "chevron-down"} 
                            size={24} 
                            color={theme.primary} 
                        />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 }}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Stats</Text>
            </View>

            {/* Tabs */}
            <View style={{ marginBottom: 5 }}>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.tabContainer}
                >
                    {(['students', 'teachers', 'revenue'] as TabType[]).map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tab, activeTab === tab && styles.activeTab]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.content}>
                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                ) : (
                    <>
                        {activeTab === 'students' && renderAttendanceTab()}
                        {activeTab === 'teachers' && renderTeacherTab()}
                        {activeTab === 'revenue' && renderRevenueTab()}
                    </>
                )}
            </View>

            {/* Detail Modal */}
            <Modal
                visible={detailModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setDetailModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Class {selectedSection?.className}-{selectedSection?.section}</Text>
                                <Text style={{ color: theme.textLight }}>Today's Student List</Text>
                            </View>
                            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                                <Ionicons name="close-circle" size={32} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalTabs}>
                            <TouchableOpacity 
                                style={[
                                    styles.mTab, 
                                    { borderColor: theme.success },
                                    detailTab === 'present' ? { backgroundColor: theme.success } : { backgroundColor: 'transparent' }
                                ]}
                                onPress={() => setDetailTab('present')}
                            >
                                <Text style={[styles.mTabText, { color: detailTab === 'present' ? '#fff' : theme.success }]}>
                                    Present ({sectionStudents.filter(s => s.status === 'present').length})
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[
                                    styles.mTab, 
                                    { borderColor: theme.danger },
                                    detailTab === 'absent' ? { backgroundColor: theme.danger } : { backgroundColor: 'transparent' }
                                ]}
                                onPress={() => setDetailTab('absent')}
                            >
                                <Text style={[styles.mTabText, { color: detailTab === 'absent' ? '#fff' : theme.danger }]}>
                                    Absent ({sectionStudents.filter(s => s.status === 'absent').length})
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {loadingDetails ? (
                            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                        ) : (
                            <FlatList
                                data={sectionStudents.filter(s => s.status === (detailTab === 'present' ? 'present' : 'absent'))}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item }) => (
                                    <View style={styles.studentItem}>
                                        <View style={styles.rollBadge}>
                                            <Text style={styles.rollText}>{item.roll_no}</Text>
                                        </View>
                                        {item.photo_url ? (
                                            <Image source={{ uri: item.photo_url }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }} />
                                        ) : (
                                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: theme.border }}>
                                                <Ionicons name="person" size={20} color={theme.textLight} />
                                            </View>
                                        )}
                                        <Text style={styles.studentName}>{item.name}</Text>
                                    </View>
                                )}
                                ListEmptyComponent={() => (
                                    <View style={{ padding: 40, alignItems: 'center' }}>
                                        <Text style={{ color: theme.textLight }}>No students found in this list</Text>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Daily Revenue Detail Modal */}
            <Modal
                visible={revenueModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setRevenueModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '85%' }]}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Daily Collection</Text>
                                <Text style={{ color: theme.textLight }}>
                                    {revenueType === 'monthly' ? 'Monthly Fee Breakdown' : 'One-Time Fee Breakdown'}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setRevenueModalVisible(false)}>
                                <Ionicons name="close-circle" size={32} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        {/* Date Switcher */}
                        <View style={[styles.monthSelector, { marginVertical: 10 }]}>
                            <TouchableOpacity style={styles.navBtn} onPress={() => {
                                const d = new Date(revenueSelectedDate);
                                d.setDate(d.getDate() - 1);
                                setRevenueSelectedDate(d);
                            }}>
                                <Ionicons name="chevron-back" size={20} color={theme.text} />
                            </TouchableOpacity>
                            <Text style={styles.monthText}>
                                {revenueSelectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </Text>
                            <TouchableOpacity style={styles.navBtn} onPress={() => {
                                const d = new Date(revenueSelectedDate);
                                d.setDate(d.getDate() + 1);
                                if (d <= new Date()) setRevenueSelectedDate(d);
                            }}>
                                <Ionicons name="chevron-forward" size={20} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: theme.primary }}>
                                Total Collected: ₹{revenueStudents.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0).toLocaleString()}
                            </Text>
                        </View>

                        {loadingRevenueStudents ? (
                            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                        ) : (
                            <FlatList
                                data={revenueStudents}
                                keyExtractor={(item, idx) => idx.toString()}
                                contentContainerStyle={{ paddingBottom: 40 }}
                                renderItem={({ item }) => (
                                    <View style={styles.studentItem}>
                                        <View style={styles.rollBadge}>
                                            <Text style={styles.rollText}>{item.roll_no}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.studentName}>{item.name}</Text>
                                            <Text style={{ fontSize: 12, color: theme.textLight }}>
                                                Class {item.class}-{item.section} • {item.fee_type}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ fontSize: 16, fontWeight: '900', color: theme.success }}>
                                                ₹{parseFloat(item.amount).toLocaleString()}
                                            </Text>
                                            <Text style={{ fontSize: 9, color: theme.textLight }}>
                                                {new Date(item.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                ListEmptyComponent={() => (
                                    <View style={{ padding: 40, alignItems: 'center' }}>
                                        <Ionicons name="receipt-outline" size={64} color={theme.border} />
                                        <Text style={{ color: theme.textLight, marginTop: 15, fontSize: 16 }}>No collections on this date</Text>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                                    onChange={(event, date) => {
                                        setShowDatePicker(false);
                                        if (date) {
                                            setSelectedDate(date);
                                        }
                                    }}                />
            )}

        </View>
    );
}
