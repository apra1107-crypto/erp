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

export default function TeacherStats() {
    const router = useRouter();
    const { initialTab } = useLocalSearchParams<{ initialTab?: TabType }>();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const [teacherData, setTeacherData] = useState<any>(null); // New state for teacherData
    const isSpecialTeacher = teacherData?.special_permission || false; // Determine special permission from state

    const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'students'); // Default to students or initialTab
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
    const [selectedSection, setSelectedSection] = useState<any>(null);
    const [sectionStudents, setSectionStudents] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [detailTab, setDetailTab] = useState<'present' | 'absent'>('present');

    // Revenue Detail States
    const [revenueDetailModalVisible, setRevenueDetailModalVisible] = useState(false);
    const [revenueDetails, setRevenueDetails] = useState<any[]>([]);
    const [loadingRevenueDetails, setLoadingRevenueDetails] = useState(false);
    const [revenueDate, setRevenueDate] = useState(new Date());
    const [activePicker, setActivePicker] = useState<'global' | 'revenue'>('global');

    // Fetch teacherData on mount
    useEffect(() => {
        const loadTeacherData = async () => {
            try {
                const data = await AsyncStorage.getItem('teacherData');
                if (data) {
                    setTeacherData(JSON.parse(data));
                }
            } catch (error) {
                console.error("Failed to load teacher data from async storage", error);
            }
        };
        loadTeacherData();
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const activeSessionId = storedSessionId || (userData ? userData.current_session_id : null);
            
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
                `${API_ENDPOINTS.TEACHER_STATS}?month=${month}&year=${year}&date=${dateStr}`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': activeSessionId?.toString()
                    } 
                }
            );

            setStats(response.data);
        } catch (error: any) {
            console.error('Error fetching teacher stats:', error);
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

    const fetchSectionDetails = async (className: string, section: string) => {
        try {
            setLoadingDetails(true);
            setSelectedSection({ className, section });
            setDetailModalVisible(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const activeSessionId = storedSessionId || (userData ? userData.current_session_id : null);
            const date = selectedDate.toISOString().split('T')[0];

            const response = await axios.get(
                `${API_ENDPOINTS.TEACHER_ATTENDANCE_DETAIL}?className=${className}&section=${section}&date=${date}`,
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

    const fetchRevenueDetails = async (date?: Date) => {
        try {
            setLoadingRevenueDetails(true);
            setRevenueDetailModalVisible(true);
            const targetDate = date || revenueDate;
            const dateStr = targetDate.toISOString().split('T')[0];
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const activeSessionId = storedSessionId || (userData ? userData.current_session_id : null);
            
            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/daily-revenue-details?date=${dateStr}`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': activeSessionId?.toString()
                    } 
                }
            );
            setRevenueDetails(response.data);
        } catch (error) {
            console.error('Error fetching revenue details:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load transaction details' });
        } finally {
            setLoadingRevenueDetails(false);
        }
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + delta);
        setSelectedDate(newDate);
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
        },
        backBtn: { 
            width: 40, 
            height: 40, 
            borderRadius: 20, 
            backgroundColor: theme.card, 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginRight: 15,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        headerTitle: { fontSize: 24, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
        
        tabContainer: {
            flexDirection: 'row',
            paddingHorizontal: 20,
            marginTop: 5,
            marginBottom: 10,
            gap: 10
        },
        tab: {
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 12,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
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

        revenueCardContainer: { padding: 15 },
        revenueStatsRow: { flexDirection: 'row', gap: 12 },
        revenueStatCard: { flex: 1, padding: 20, borderRadius: 24, elevation: 4 },
        revenueStatLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.8)', marginBottom: 4, letterSpacing: 0.5 },
        revenueStatValue: { fontSize: 18, fontWeight: '900', color: '#fff' },
        
        revenueMonthNavInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20, backgroundColor: theme.background, padding: 8, borderRadius: 15 },
        navBtnSmall: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
        sectionSubTitle: { fontSize: 12, fontWeight: '900', color: theme.textLight, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1.5, textAlign: 'center' },
        otRemainingBox: { marginTop: 12, padding: 15, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center' },

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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }} refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
            }>
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text }}>Student Attendance</Text>
                </View>

                <TouchableOpacity 
                    style={styles.monthSelector}
                    onPress={() => { setActivePicker('global'); setShowDatePicker(true); }}
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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }} refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
            }>
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text }}>Teacher Attendance</Text>
                </View>

                <TouchableOpacity 
                    style={styles.monthSelector}
                    onPress={() => { setActivePicker('global'); setShowDatePicker(true); }}
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

    const renderRevenueTab = () => {
        if (!stats?.revenue) return null;
        const rev = stats.revenue.monthly;
        const ot = stats.revenue.oneTime;
        const remaining = (rev.expected || 0) - (rev.collected || 0);
        const otRemaining = (ot.expected || 0) - (ot.collected || 0);

        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }} refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
            }>
                <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text }}>Institute Revenue</Text>
                    <Text style={{ fontSize: 13, color: theme.textLight, marginTop: 4 }}>Financial overview across collection cycles</Text>
                </View>

                {/* Container 1: Monthly Cycle + Date Selection */}
                <View style={[styles.sectionCard, { marginTop: 20, padding: 15 }]}>
                    <Text style={styles.sectionSubTitle}>Monthly Billing Cycle</Text>
                    
                    <View style={styles.revenueMonthNavInner}>
                        <TouchableOpacity style={styles.navBtnSmall} onPress={() => {
                            const d = new Date(selectedDate);
                            d.setMonth(d.getMonth() - 1);
                            setSelectedDate(d);
                        }}>
                            <Ionicons name="chevron-back" size={18} color={theme.text} />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center', minWidth: 120 }}>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: theme.primary }}>{selectedDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
                        </View>
                        <TouchableOpacity style={styles.navBtnSmall} onPress={() => {
                            const d = new Date(selectedDate);
                            d.setMonth(d.getMonth() + 1);
                            setSelectedDate(d);
                        }}>
                            <Ionicons name="chevron-forward" size={18} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.revenueStatsRow}>
                        <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.revenueStatCard}>
                            <Ionicons name="pie-chart" size={16} color="#fff" style={{ marginBottom: 8 }} />
                            <Text style={styles.revenueStatLabel}>EXPECTED</Text>
                            <Text style={styles.revenueStatValue}>₹{(rev.expected || 0).toLocaleString()}</Text>
                        </LinearGradient>

                        <LinearGradient colors={['#10b981', '#059669']} style={[styles.revenueStatCard, { padding: 0 }]}>
                            <TouchableOpacity 
                                style={{ flex: 1, padding: 20 }}
                                onPress={() => {
                                    setRevenueDate(selectedDate);
                                    fetchRevenueDetails(selectedDate);
                                }}
                            >
                                <Ionicons name="checkmark-done" size={16} color="#fff" style={{ marginBottom: 8 }} />
                                <Text style={styles.revenueStatLabel}>COLLECTED</Text>
                                <Text style={styles.revenueStatValue}>₹{(rev.collected || 0).toLocaleString()}</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>

                    <LinearGradient colors={['#ef4444', '#b91c1c']} style={[styles.revenueStatCard, { marginTop: 12, width: '100%', padding: 15 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Ionicons name="time" size={20} color="#fff" />
                            <View>
                                <Text style={styles.revenueStatLabel}>TOTAL REMAINING</Text>
                                <Text style={[styles.revenueStatValue, { fontSize: 20 }]}>₹{remaining.toLocaleString()}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* Container 2: One-Time Fees */}
                <View style={[styles.sectionCard, { padding: 15 }]}>
                    <Text style={styles.sectionSubTitle}>One-Time Fees</Text>
                    <View style={styles.revenueStatsRow}>
                        <LinearGradient colors={['#6366f1', '#4f46e5']} style={styles.revenueStatCard}>
                            <Ionicons name="megaphone" size={16} color="#fff" style={{ marginBottom: 8 }} />
                            <Text style={styles.revenueStatLabel}>EXPECTED</Text>
                            <Text style={styles.revenueStatValue}>₹{(ot.expected || 0).toLocaleString()}</Text>
                        </LinearGradient>

                        <LinearGradient colors={['#8b5cf6', '#6d28d9']} style={styles.revenueStatCard}>
                            <Ionicons name="wallet" size={16} color="#fff" style={{ marginBottom: 8 }} />
                            <Text style={styles.revenueStatLabel}>COLLECTED</Text>
                            <Text style={styles.revenueStatValue}>₹{(ot.collected || 0).toLocaleString()}</Text>
                        </LinearGradient>
                    </View>
                    
                    <LinearGradient colors={['#ef4444', '#b91c1c']} style={[styles.revenueStatCard, { marginTop: 12, width: '100%', padding: 15 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Ionicons name="time" size={20} color="#fff" />
                            <View>
                                <Text style={styles.revenueStatLabel}>TOTAL REMAINING</Text>
                                <Text style={[styles.revenueStatValue, { fontSize: 20 }]}>₹{otRemaining.toLocaleString()}</Text>
                            </View>
                        </View>
                    </LinearGradient>
                </View>
            </ScrollView>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />

            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Stats</Text>
                    {activeSessionName ? <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '800', marginTop: -2 }}>{activeSessionName}</Text> : null}
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                {(['students', 'teachers', ...(isSpecialTeacher ? ['revenue'] : [])] as TabType[]).map((tab) => (
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

            {/* Revenue Detail Modal */}
            <Modal
                visible={revenueDetailModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setRevenueDetailModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Daily Collection</Text>
                                <Text style={{ color: theme.textLight }}>Transaction Details</Text>
                            </View>
                            <TouchableOpacity onPress={() => setRevenueDetailModalVisible(false)}>
                                <Ionicons name="close-circle" size={32} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        {/* Date Selection In Modal */}
                        <TouchableOpacity 
                            style={[styles.monthSelector, { marginVertical: 15 }]}
                            onPress={() => { setActivePicker('revenue'); setShowDatePicker(true); }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="calendar" size={20} color={theme.primary} />
                                <Text style={[styles.monthText, { marginLeft: 10, fontSize: 14 }]}>
                                    {revenueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </Text>
                            </View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>CHANGE</Text>
                        </TouchableOpacity>

                        {loadingRevenueDetails ? (
                            <View style={{ flex: 1, justifyContent: 'center' }}>
                                <ActivityIndicator size="large" color={theme.primary} />
                            </View>
                        ) : (
                            <FlatList
                                data={revenueDetails}
                                keyExtractor={(item, index) => index.toString()}
                                contentContainerStyle={{ paddingBottom: 40 }}
                                renderItem={({ item }) => (
                                    <View style={[styles.studentItem, { borderBottomColor: theme.border + '50' }]}>
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                                            {item.photo_url ? (
                                                <Image source={{ uri: item.photo_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                                            ) : (
                                                <Text style={{ fontSize: 16, fontWeight: '900', color: theme.primary }}>{item.name[0]}</Text>
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>{item.name}</Text>
                                            <Text style={{ fontSize: 11, color: theme.textLight }}>
                                                Cl: {item.class}-{item.section} | Roll: {item.roll_no} | {item.fee_type}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={{ fontSize: 16, fontWeight: '900', color: theme.success }}>₹{parseFloat(item.amount).toLocaleString()}</Text>
                                            <Text style={{ fontSize: 10, color: theme.textLight }}>{new Date(item.paid_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                                        </View>
                                    </View>
                                )}
                                ListEmptyComponent={() => (
                                    <View style={{ padding: 40, alignItems: 'center' }}>
                                        <Ionicons name="receipt-outline" size={60} color={theme.border} />
                                        <Text style={{ color: theme.textLight, marginTop: 15, fontWeight: '700' }}>No transactions for this date</Text>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {showDatePicker && (
                <DateTimePicker
                    value={activePicker === 'global' ? selectedDate : revenueDate}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(event, date) => {
                        setShowDatePicker(false);
                        if (date) {
                            if (activePicker === 'global') {
                                setSelectedDate(date);
                            } else {
                                setRevenueDate(date);
                                fetchRevenueDetails(date);
                            }
                        }
                    }}
                />
            )}

        </View>
    );
}
