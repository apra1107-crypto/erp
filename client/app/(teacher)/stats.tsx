import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
    StatusBar, RefreshControl, Dimensions, Platform, Modal, FlatList, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router'; // Removed useLocalSearchParams
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type TabType = 'students' | 'teachers' | 'revenue';

export default function TeacherStats() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const [teacherData, setTeacherData] = useState<any>(null); // New state for teacherData
    const isSpecialTeacher = teacherData?.special_permission || false; // Determine special permission from state

    const [activeTab, setActiveTab] = useState<TabType>('students'); // Default to students
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeSessionName, setActiveSessionName] = useState('');
    
    // Global filter used by Students/Teachers
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Revenue Specific Filters
    const [revMonth, setRevMonth] = useState(new Date());
    const [revDate, setRevDate] = useState(new Date());
    const [activePicker, setActivePicker] = useState<'global' | 'rev_date'>('global');

    // Months with configurations
    const [configuredMonths, setConfiguredMonths] = useState<string[]>([]);
    const [showMonthPicker, setShowMonthPicker] = useState(false);

    // Attendance UI States
    const [isAttendanceExpanded, setIsAttendanceExpanded] = useState(false);
    const [isTeacherExpanded, setIsTeacherExpanded] = useState(false);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedSection, setSelectedSection] = useState<any>(null);
    const [sectionStudents, setSectionStudents] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [detailTab, setDetailTab] = useState<'present' | 'absent'>('present');

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

    const fetchConfiguredMonths = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            if (!userDataStr) return;
            
            const userData = JSON.parse(userDataStr);
            const instituteId = userData.institute_id || userData.id;
            const activeSessionId = userData.current_session_id;
            
            if (!instituteId) return;

            const response = await axios.get(
                `${API_ENDPOINTS.FEES}/configured-months/${instituteId}`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': activeSessionId?.toString()
                    } 
                }
            );
            setConfiguredMonths(response.data || []);
        } catch (error) {
            console.error('Error fetching configured months:', error);
        }
    };

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const activeSessionId = userData?.current_session_id;
            
            // Try to find session name if available in userData
            if (userData?.sessions) {
                const s = userData.sessions.find((s: any) => s.id === activeSessionId);
                if (s) setActiveSessionName(s.name);
                else setActiveSessionName('Session ' + activeSessionId);
            } else if (activeSessionId) {
                setActiveSessionName('Session ' + activeSessionId);
            }

            // Filters based on tab context or specifically for revenue
            const targetMonthDate = activeTab === 'revenue' ? revMonth : selectedDate;
            const targetDayDate = activeTab === 'revenue' ? revDate : selectedDate;

            const month = targetMonthDate.getMonth() + 1;
            const year = targetMonthDate.getFullYear();
            const dateStr = targetDayDate.toISOString().split('T')[0];

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
    }, [selectedDate, revMonth, revDate, activeTab]);

    useFocusEffect(
        useCallback(() => {
            fetchStats();
            if (activeTab === 'revenue') {
                fetchConfiguredMonths();
            }
        }, [fetchStats, activeTab])
    );

    useEffect(() => {
        if (activeTab === 'revenue') {
            fetchConfiguredMonths();
        }
    }, [activeTab]);

    const fetchSectionDetails = async (className: string, section: string) => {
        try {
            setLoadingDetails(true);
            setSelectedSection({ className, section });
            setDetailModalVisible(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const activeSessionId = userData?.current_session_id;
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
        if (activeTab === 'revenue') fetchConfiguredMonths();
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
            flexDirection: 'row',
            backgroundColor: theme.card,
            paddingHorizontal: 10,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        tab: {
            flex: 1,
            paddingVertical: 15,
            alignItems: 'center',
            borderBottomWidth: 3,
            borderBottomColor: 'transparent',
        },
        activeTab: {
            borderBottomColor: theme.primary,
        },
        tabText: {
            fontSize: 12,
            fontWeight: '800',
            color: theme.textLight,
        },
        activeTabText: {
            color: theme.primary,
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

        // Revenue Styles
        revenueGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        revenueBox: {
            width: (SCREEN_WIDTH - 64) / 2,
            backgroundColor: theme.background,
            padding: 15,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
        },
        revenueAmount: { fontSize: 18, fontWeight: '900', color: theme.text, marginTop: 5 },
        revenueLabel: { fontSize: 10, fontWeight: '800', color: theme.textLight, textTransform: 'uppercase' },

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
        const { overall, monthly, daily } = stats.revenue;

        const mDate = revMonth;
        const dDate = revDate;

        return (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }} refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
            }>
                {/* 1. Overall Session Summary */}
                <View style={[styles.sectionCard, { marginTop: 20 }]}>
                    <Text style={styles.cardTitle}>Overall Session Summary</Text>
                    
                    {/* Totals Header Row */}
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 15 }}>
                        <View style={[styles.revenueBox, { flex: 1, backgroundColor: theme.success + '10', borderColor: theme.success, width: 'auto' }]}>
                            <Text style={[styles.revenueLabel, { color: theme.success }]}>Total Collected</Text>
                            <Text style={[styles.revenueAmount, { color: theme.success, fontSize: 20 }]}>₹{(overall?.totalCollected || 0).toLocaleString()}</Text>
                        </View>
                        <View style={[styles.revenueBox, { flex: 1, backgroundColor: theme.danger + '10', borderColor: theme.danger, width: 'auto' }]}>
                            <Text style={[styles.revenueLabel, { color: theme.danger }]}>Total Remaining</Text>
                            <Text style={[styles.revenueAmount, { color: theme.danger, fontSize: 20 }]}>₹{(overall?.totalPending || 0).toLocaleString()}</Text>
                        </View>
                    </View>

                    <View style={styles.revenueGrid}>
                        {/* Monthly Column */}
                        <View style={[styles.revenueBox, { width: '100%', marginBottom: 5 }]}>
                            <Text style={styles.revenueLabel}>Total Monthly Fees (Created)</Text>
                            <Text style={[styles.revenueAmount, { fontSize: 22, color: theme.primary }]}>₹{(overall?.monthlyExpected || 0).toLocaleString()}</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                                <View>
                                    <Text style={{ fontSize: 9, color: theme.success, fontWeight: '800' }}>COLLECTED</Text>
                                    <Text style={{ fontSize: 14, color: theme.success, fontWeight: '900' }}>₹{(overall?.monthlyCollected || 0).toLocaleString()}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 9, color: theme.danger, fontWeight: '800' }}>PENDING</Text>
                                    <Text style={{ fontSize: 14, color: theme.danger, fontWeight: '900' }}>₹{((overall?.monthlyExpected || 0) - (overall?.monthlyCollected || 0)).toLocaleString()}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Occasional Column */}
                        <View style={[styles.revenueBox, { width: '100%', marginBottom: 5 }]}>
                            <Text style={styles.revenueLabel}>Total Occasional Fees (Created)</Text>
                            <Text style={[styles.revenueAmount, { fontSize: 22, color: theme.primary }]}>₹{(overall?.occasionalExpected || 0).toLocaleString()}</Text>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                                <View>
                                    <Text style={{ fontSize: 9, color: theme.success, fontWeight: '800' }}>COLLECTED</Text>
                                    <Text style={{ fontSize: 14, color: theme.success, fontWeight: '900' }}>₹{(overall?.occasionalCollected || 0).toLocaleString()}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 9, color: theme.danger, fontWeight: '800' }}>PENDING</Text>
                                    <Text style={{ fontSize: 14, color: theme.danger, fontWeight: '900' }}>₹{((overall?.occasionalExpected || 0) - (overall?.occasionalCollected || 0)).toLocaleString()}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 2. Month-wise Collection Flashcard */}
                <View style={[styles.flashcard, { marginTop: 25 }]}>
                    {/* Header with Title and Month Selection on Top Right */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <View>
                            <Text style={styles.dayText}>Monthly Analysis</Text>
                            <Text style={styles.dateText}>Revenue breakdown for selected month</Text>
                        </View>
                        <TouchableOpacity 
                            style={{ 
                                flexDirection: 'row', 
                                alignItems: 'center', 
                                backgroundColor: theme.primary + '15', 
                                paddingHorizontal: 12, 
                                paddingVertical: 8, 
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: theme.primary + '30'
                            }}
                            onPress={() => setShowMonthPicker(true)}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '800', color: theme.primary }}>
                                {mDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color={theme.primary} style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    </View>

                    {/* Row 1: Expected Revenue (Potential) */}
                    <View style={{ marginBottom: 15 }}>
                        <Text style={[styles.revenueLabel, { marginBottom: 8, color: theme.textLight }]}>Total Expected (Potential Revenue)</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={[styles.revenueBox, { flex: 1, width: 'auto', backgroundColor: theme.background }]}>
                                <Text style={styles.revenueLabel}>Monthly</Text>
                                <Text style={[styles.revenueAmount, { fontSize: 16 }]}>₹{(monthly?.monthlyExpected || 0).toLocaleString()}</Text>
                            </View>
                            <View style={[styles.revenueBox, { flex: 1, width: 'auto', backgroundColor: theme.background }]}>
                                <Text style={styles.revenueLabel}>Occasional</Text>
                                <Text style={[styles.revenueAmount, { fontSize: 16 }]}>₹{(monthly?.occasionalExpected || 0).toLocaleString()}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Row 2: Collected Revenue (Till Now) */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={[styles.revenueLabel, { marginBottom: 8, color: theme.success }]}>Collected Revenue (Till Now)</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={[styles.revenueBox, { flex: 1, width: 'auto', backgroundColor: theme.success + '08', borderColor: theme.success + '30' }]}>
                                <Text style={[styles.revenueLabel, { color: theme.success }]}>Monthly</Text>
                                <Text style={[styles.revenueAmount, { color: theme.success, fontSize: 16 }]}>₹{(monthly?.monthlyCollected || 0).toLocaleString()}</Text>
                            </View>
                            <View style={[styles.revenueBox, { flex: 1, width: 'auto', backgroundColor: theme.success + '08', borderColor: theme.success + '30' }]}>
                                <Text style={[styles.revenueLabel, { color: theme.success }]}>Occasional</Text>
                                <Text style={[styles.revenueAmount, { color: theme.success, fontSize: 16 }]}>₹{(monthly?.occasionalCollected || 0).toLocaleString()}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Final: Grand Total Collection */}
                    <View style={[styles.revenueBox, { 
                        width: '100%', 
                        backgroundColor: theme.primary, 
                        borderWidth: 0,
                        paddingVertical: 18,
                        shadowColor: theme.primary,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                        elevation: 8
                    }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={[styles.revenueLabel, { color: 'rgba(255,255,255,0.8)' }]}>Grand Total Collection</Text>
                                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700' }}>Combined Monthly & Occasional</Text>
                            </View>
                            <Text style={[styles.revenueAmount, { color: '#fff', fontSize: 24 }]}>
                                ₹{(monthly?.totalCollected || 0).toLocaleString()}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* 3. Specific Day Collection Flashcard */}
                <View style={[styles.flashcard, { marginTop: 25, marginBottom: 40 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <View>
                            <Text style={styles.dayText}>Daily Analysis</Text>
                            <Text style={styles.dateText}>Revenue for specific date</Text>
                        </View>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: theme.primary + '15',
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: theme.primary + '30'
                            }}
                            onPress={() => { setActivePicker('rev_date'); setShowDatePicker(true); }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: '800', color: theme.primary }}>
                                {dDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color={theme.primary} style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                    </View>

                    {/* Row 1: Month Context */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={[styles.revenueLabel, { marginBottom: 8, color: theme.textLight }]}>
                            Total Collected in {dDate.toLocaleDateString('en-IN', { month: 'long' })} (Context)
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={[styles.revenueBox, { flex: 1, width: 'auto', backgroundColor: theme.background }]}>
                                <Text style={styles.revenueLabel}>Monthly</Text>
                                <Text style={[styles.revenueAmount, { fontSize: 16 }]}>₹{(monthly?.monthlyCollected || 0).toLocaleString()}</Text>
                            </View>
                            <View style={[styles.revenueBox, { flex: 1, width: 'auto', backgroundColor: theme.background }]}>
                                <Text style={styles.revenueLabel}>Occasional</Text>
                                <Text style={[styles.revenueAmount, { fontSize: 16 }]}>₹{(monthly?.occasionalCollected || 0).toLocaleString()}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Row 2: Day Stats */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={[styles.revenueLabel, { marginBottom: 8, color: theme.primary }]}>
                            Collected on {dDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long' })}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={[styles.revenueBox, { flex: 1, width: 'auto', backgroundColor: theme.primary + '08', borderColor: theme.primary + '30' }]}>
                                <Text style={[styles.revenueLabel, { color: theme.primary }]}>Monthly</Text>
                                <Text style={[styles.revenueAmount, { color: theme.primary, fontSize: 16 }]}>₹{(daily?.monthly || 0).toLocaleString()}</Text>
                            </View>
                            <View style={[styles.revenueBox, { flex: 1, width: 'auto', backgroundColor: theme.primary + '08', borderColor: theme.primary + '30' }]}>
                                <Text style={[styles.revenueLabel, { color: theme.primary }]}>Occasional</Text>
                                <Text style={[styles.revenueAmount, { color: theme.primary, fontSize: 16 }]}>₹{(daily?.occasional || 0).toLocaleString()}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Final: Grand Total Day */}
                    <View style={[styles.revenueBox, {
                        width: '100%',
                        backgroundColor: theme.card,
                        borderWidth: 1,
                        borderColor: theme.primary,
                        paddingVertical: 15,
                        borderStyle: 'dashed'
                    }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.revenueLabel, { color: theme.primary }]}>Total Day Collection</Text>
                            <Text style={[styles.revenueAmount, { color: theme.primary, fontSize: 20 }]}>
                                ₹{(daily?.total || 0).toLocaleString()}
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} />

            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Stats</Text>
                    {activeSessionName ? <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '800', marginTop: -2 }}>{activeSessionName}</Text> : null}
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                {(['students', 'teachers'] as TabType[]).concat(isSpecialTeacher ? ['revenue'] : []).map((tab) => (
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
                        {isSpecialTeacher && activeTab === 'revenue' && renderRevenueTab()}
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

            {showDatePicker && (
                <DateTimePicker
                    value={activePicker === 'rev_date' ? revDate : selectedDate}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    onChange={(event, date) => {
                        setShowDatePicker(false);
                        if (date) {
                            if (activePicker === 'rev_date') {
                                setRevDate(date);
                                setRevMonth(date); // Sync month context
                            }
                            else setSelectedDate(date);
                        }
                    }}
                />
            )}

            {/* Custom Month Picker Modal for Revenue */}
            <Modal visible={showMonthPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowMonthPicker(false)} />
                    <View style={[styles.modalContent, { height: 'auto', paddingBottom: 40 }]}>
                        <View style={styles.modalHandle} />
                        <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 20 }]}>Select Billing Month</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {configuredMonths.length > 0 ? (
                                configuredMonths.map((m, idx) => (
                                    <TouchableOpacity 
                                        key={idx} 
                                        style={[
                                            styles.studentItem, 
                                            { justifyContent: 'center' }
                                        ]}
                                        onPress={() => {
                                            // Convert "Month YYYY" string to Date object
                                            const [mName, year] = m.split(' ');
                                            const monthIdx = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(mName);
                                            const newMDate = new Date(parseInt(year), monthIdx, 1);
                                            setRevMonth(newMDate);
                                            setShowMonthPicker(false);
                                        }}
                                    >
                                        <Text style={[styles.studentName, { color: theme.primary, fontSize: 18 }]}>{m}</Text>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: theme.textLight }}>No fee structures found</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

        </View>
    );
}
