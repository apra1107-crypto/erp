import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView, Modal, TextInput, Dimensions, KeyboardAvoidingView, Platform, StatusBar, RefreshControl, FlatList, LayoutAnimation, UIManager, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { API_ENDPOINTS } from '../../constants/Config';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const GRADIENTS = {
    student: ['#FF2D55', '#5856D6'],
    teacher: ['#AF52DE', '#007AFF'],
    homework: ['#00d2ff', '#3a7bd5'],
    revenue: ['#FF0080', '#1D2B64'],
    morning: ['#FF9500', '#FFCC00'],
    afternoon: ['#007AFF', '#4CD964'],
    evening: ['#5856D6', '#000000'],
    event: ['#FF2D55', '#AF52DE'],
};

const getGreetingAndQuote = () => {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const currentTime = hour * 60 + min;

    if (hour >= 6 && hour < 12) {
        return {
            greeting: "Good Morning",
            quote: "Start your day with a smile and a grateful heart.",
            type: 'morning'
        };
    } else if (currentTime >= 12 * 60 && currentTime < 16 * 60 + 55) {
        return {
            greeting: "Good Afternoon",
            quote: "Your hard work is the bridge between goals and accomplishment.",
            type: 'afternoon'
        };
    } else {
        return {
            greeting: "Good Evening",
            quote: "You've done great work today. Rest well and recharge for tomorrow.",
            type: 'evening'
        };
    }
};

export default function TeacherDashboard() {
    const router = useRouter();
    const { isDark, theme, toggleTheme } = useTheme();
    const insets = useSafeAreaInsets();
    const { socket } = useSocket();

    const [teacherData, setTeacherData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Subscription States (Moved to Top for immediate availability)
    const [subStatus, setSubStatus] = useState('loading');
    const [subData, setSubData] = useState<any>(null);
    const isLocked = subStatus === 'expired' || subStatus === 'disabled';

    // AUTO-EXPIRY WATCHER: Locks dashboard the exact second time runs out
    useEffect(() => {
        if (subStatus !== 'active' || !subData?.subscription_end_date) return;

        const checkExpiry = () => {
            const now = new Date();
            const expiry = new Date(subData.subscription_end_date);
            
            if (now >= expiry) {
                console.log('⏰ [Watcher] Subscription time ran out. Locking dashboard.');
                LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                setSubStatus('expired');
                Toast.show({ 
                    type: 'error', 
                    text1: 'Subscription Expired', 
                    text2: 'Institute subscription reached its time limit.', 
                    position: 'bottom', 
                    bottomOffset: 40 
                });
            }
        };

        const timer = setInterval(checkExpiry, 1000);
        return () => clearInterval(timer);
    }, [subStatus, subData?.subscription_end_date]);

    // Flashcards State
    const [flashcards, setFlashcards] = useState<any>(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const isInteracting = useRef(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Attendance State
    const [todayAttendance, setTodayAttendance] = useState<any>(null);
    const [markingAttendance, setMarkingAttendance] = useState(false);
    const [absentReasonModalVisible, setAbsentReasonModalVisible] = useState(false);
    const [absentReason, setAbsentReason] = useState('');

    // Real-time Clock
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // UI States
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifList, setShowNotifList] = useState(false);
    const [isActionsExpanded, setIsActionsExpanded] = useState(false);
    const [schedule, setSchedule] = useState<any[]>([]);
    const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);

    // DEDICATED WATCHER: Join Room & Sync Status Instantly
    useEffect(() => {
        if (!socket || !teacherData?.institute_id) return;

        const handleSubUpdate = (data: any) => {
            console.log('📡 [Real-time] Teacher sub update:', data);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
            if (data.status) setSubStatus(data.status);
            if (data.settings) setSubData(data.settings);
            
            if (data.status === 'disabled') {
                Toast.show({ type: 'error', text1: 'Access Revoked', text2: 'Institute account disabled by admin.', position: 'bottom', bottomOffset: 40 });
            } else if (data.status === 'expired') {
                Toast.show({ type: 'error', text1: 'Subscription Expired', text2: 'Please contact principal for renewal.', position: 'bottom', bottomOffset: 40 });
            } else if (data.status === 'active' || data.status === 'grant') {
                Toast.show({ type: 'success', text1: 'Dashboard Unlocked', text2: 'Subscription is active.', position: 'bottom', bottomOffset: 40 });
            }
        };

        const joinRooms = () => {
            const id = teacherData.institute_id;
            socket.emit('join_room', `teacher-${id}`);
            // Also join principal room as a backup to catch all subscription emissions
            socket.emit('join_room', `principal-${id}`);
            console.log(`📡 [Watcher] Teacher joined rooms for institute: ${id}`);
            checkSubscription(id);
        };

        // Join immediately
        joinRooms();

        // Re-join on every reconnect
        socket.on('connect', joinRooms);
        socket.on('subscription_update', handleSubUpdate);

        return () => {
            socket.off('connect', joinRooms);
            socket.off('subscription_update', handleSubUpdate);
        };
    }, [socket, teacherData?.institute_id]);

    // Socket Listener for Attendance Updates
    useEffect(() => {
        if (teacherData?.institute_id && socket) {
            const handleAttendanceUpdate = (data: any) => {
                if (flashcards?.student_attendance) {
                    setFlashcards((prev: any) => ({
                        ...prev,
                        student_attendance: {
                            ...prev.student_attendance,
                            total_present: data.total_present
                        }
                    }));
                }
            };

            socket.on('attendance_stats_update', handleAttendanceUpdate);
            
            return () => {
                socket.off('attendance_stats_update', handleAttendanceUpdate);
            };
        }
    }, [teacherData?.institute_id, socket, !!flashcards]);

    const checkSubscription = async (id: any) => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const res = await axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${id}/status`, { 
                headers: { Authorization: `Bearer ${token}` } 
            });
            setSubStatus(res.data.status);
            setSubData(res.data);
        } catch (e) {}
    };
    
    // Search State
    const [isSearchActive, setIsSearchActive] = useState(false);
    const searchBarWidth = useSharedValue(0);
    const searchBarOpacity = useSharedValue(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Session States
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [showSessionPicker, setShowSessionPicker] = useState(false);

    // Multi-Account
    const [allAccounts, setAllAccounts] = useState<any[]>([]);
    const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
    const [fetchingAccounts, setFetchingAccounts] = useState(false);

    const loadInitialData = async () => {
        try {
            const data = await AsyncStorage.getItem('teacherData');
            if (data) setTeacherData(JSON.parse(data));
            const storedSession = await AsyncStorage.getItem('selectedSessionId');
            if (storedSession) setSelectedSessionId(Number(storedSession));
        } catch (e) {}
    };

    const fetchProfile = async (forcedSessionId?: number) => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const data = await AsyncStorage.getItem('teacherData');
            const parsedData = data ? JSON.parse(data) : null;
            const sessionId = forcedSessionId || selectedSessionId || parsedData?.current_session_id;

            const response = await axios.get(`${API_ENDPOINTS.AUTH.TEACHER}/profile`, {
                headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sessionId?.toString() }
            });
            const updated = { ...parsedData, ...response.data.teacher };
            setTeacherData(updated);
            await AsyncStorage.setItem('teacherData', JSON.stringify(updated));
        } catch (error) {}
    };

    const fetchTodayAttendance = async (forcedSessionId?: number) => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const data = await AsyncStorage.getItem('teacherData');
            const parsedData = data ? JSON.parse(data) : null;
            const sessionId = forcedSessionId || selectedSessionId || parsedData?.current_session_id;
            if (!sessionId) return;

            const response = await axios.get(`${API_ENDPOINTS.TEACHER_ATTENDANCE}/today`, {
                headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sessionId?.toString() }
            });
            setTodayAttendance(response.data);
        } catch (error) {}
    };

    const fetchDashboardData = async (forcedSessionId?: number) => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const data = await AsyncStorage.getItem('teacherData');
            const parsedData = data ? JSON.parse(data) : null;
            const sessionId = forcedSessionId || selectedSessionId || parsedData?.current_session_id;
            if (!sessionId) return;

            const today = new Date().toISOString().split('T')[0];
            const response = await axios.get(`${API_ENDPOINTS.TEACHER_DASHBOARD}?date=${today}`, {
                headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sessionId?.toString() },
                timeout: 10000
            });
            if (response.data.flashcards) setFlashcards(response.data.flashcards);
        } catch (error) {}
    };

    const fetchSchedule = async (forcedSessionId?: number) => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const data = await AsyncStorage.getItem('teacherData');
            const parsedData = data ? JSON.parse(data) : null;
            const sessionId = forcedSessionId || selectedSessionId || parsedData?.current_session_id;
            if (!sessionId || !parsedData?.id) return;

            const response = await axios.get(`${API_ENDPOINTS.ROUTINE}/teacher-schedule`, {
                headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sessionId?.toString() }
            });
            if (response.data && Array.isArray(response.data)) setSchedule(response.data);
        } catch (error) {}
    };

    const fetchSessions = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const response = await axios.get(API_ENDPOINTS.ACADEMIC_SESSIONS, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSessions(response.data);
            if (!selectedSessionId) {
                const active = response.data.find((s: any) => s.is_active);
                if (active) setSelectedSessionId(active.id);
            }
        } catch (error) {}
    };

    const onRefresh = async (forcedSessionId?: number) => {
        setRefreshing(true);
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const profileRes = await axios.get(`${API_ENDPOINTS.AUTH.TEACHER}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const profile = profileRes.data.teacher;
            setTeacherData(profile);

            const checks = [
                fetchSessions(),
                fetchTodayAttendance(forcedSessionId),
                fetchDashboardData(forcedSessionId),
                fetchSchedule(forcedSessionId),
                checkSubscription(profile.institute_id)
            ];

            await Promise.all(checks);
        } catch (error) {
            console.error('Refresh error:', error);
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            onRefresh();
        }, [selectedSessionId])
    );

    useEffect(() => {
        loadInitialData();
    }, []);

    const flashcardData = useMemo(() => {
        let data: any[] = [];
        
        // 1st Card: Event or Greeting (Priority)
        if (flashcards?.today_events && flashcards.today_events.length > 0) {
            data.push({ type: 'event', data: flashcards.today_events[0] });
        } else {
            data.push({ type: 'greeting', data: getGreetingAndQuote() });
        }

        if (teacherData?.special_permission) {
            data.push(
                { type: 'student', data: flashcards?.student_attendance },
                { type: 'teacher', data: flashcards?.teacher_attendance },
                { type: 'revenue', data: flashcards?.revenue },
            );
        } else {
            data.push(
                { type: 'student', data: flashcards?.student_attendance },
                { type: 'attendance_merged', data: { self: todayAttendance, stats: flashcards?.teacher_attendance } },
                { type: 'homework', data: flashcards?.my_homework || { todayClassCount: 0 } }
            );
        }

        return data;
    }, [flashcards, todayAttendance, teacherData?.special_permission]);

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (flashcardData.length <= 1) return;

        const currentCard = flashcardData[activeSlide];
        let delay = 3000; // Default 3s

        if (currentCard?.type === 'greeting') delay = 30000; // 30s
        if (currentCard?.type === 'event') delay = 60000; // 60s

        timerRef.current = setInterval(() => {
            if (!isInteracting.current && flashcardData.length > 1) {
                const next = (activeSlide + 1) % flashcardData.length;
                flatListRef.current?.scrollToIndex({ index: next, animated: true });
                setActiveSlide(next);
            }
        }, delay);
    };

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };

    useEffect(() => {
        if (flashcardData.length > 1) startTimer();
        return () => stopTimer();
    }, [flashcardData, activeSlide]);

    const onMomentumScrollEnd = (event: any) => {
        let index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setActiveSlide(index);
        isInteracting.current = false;
        startTimer();
    };

    const handleMarkSelfAttendance = async (status: 'present' | 'absent', reason?: string) => {
        try {
            setMarkingAttendance(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const response = await axios.post(`${API_ENDPOINTS.TEACHER_ATTENDANCE}/mark`, { status, reason }, { headers: { Authorization: `Bearer ${token}` } });
            setTodayAttendance(response.data.record);
            Toast.show({ type: 'success', text1: 'Success', text2: `Attendance marked as ${status.toUpperCase()}` });
            setAbsentReasonModalVisible(false);
            setAbsentReason('');
            fetchDashboardData();
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to mark attendance' });
        } finally {
            setMarkingAttendance(false);
        }
    };

    const renderFlashcardItem = ({ item }: any) => {
        let gradientColors = GRADIENTS.student;
        let iconName: any = 'people';
        let isRevenue = item.type === 'revenue';
        let title = 'Student Attendance';
        // Date Day Time (Real-time)
        let subTitle = currentTime.toLocaleDateString('en-IN', {
            weekday: 'short', day: '2-digit', month: 'short',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
        let mainText = '';
        let bottomText = '';
        let extraContent = null;
        let isInteractive = false;

        if (item.type === 'student') {
            mainText = `${item.data?.total_present || 0} / ${item.data?.total_students || 0}`;
            bottomText = item.data?.status === 'complete' ? 'Present Today' : `In Progress (${item.data?.pending_count || 0} left)`;
        } else if (item.type === 'teacher') {
            gradientColors = GRADIENTS.teacher;
            iconName = 'school';
            title = 'Teacher Attendance';
            subTitle = "Today's Status";
            mainText = `${item.data?.present || 0} / ${item.data?.total || 0}`;
            bottomText = 'Teachers Present';

            if (teacherData?.special_permission) {
                const marked = !!todayAttendance;
                const selfStatus = todayAttendance?.status;

                if (marked) {
                    extraContent = (
                        <View style={styles.cardActionOverlay}>
                            <Text style={styles.cardStatusText}>MY STATUS: {selfStatus?.toUpperCase()}</Text>
                            <TouchableOpacity onPress={() => handleMarkSelfAttendance(selfStatus === 'present' ? 'absent' : 'present')} style={styles.cardUpdateBtn}>
                                <Text style={styles.cardUpdateBtnText}>CHANGE</Text>
                            </TouchableOpacity>
                        </View>
                    );
                } else {
                    extraContent = (
                        <View style={styles.markingButtons}>
                            <TouchableOpacity style={styles.mBtnPresent} onPress={() => handleMarkSelfAttendance('present')}>
                                <Text style={styles.mBtnTextPresent}>PRESENT</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.mBtnAbsent} onPress={() => setAbsentReasonModalVisible(true)}>
                                <Text style={styles.mBtnTextAbsent}>ABSENT</Text>
                            </TouchableOpacity>
                        </View>
                    );
                }
            }
        } else if (item.type === 'revenue') {
            gradientColors = ['#FF0080', '#1D2B64']; // Using Principal dashboard gradient
            title = 'Revenue';
            subTitle = 'Collection Overview';
            
            const monthTotal = (Number(item.data?.monthly_month) || 0) + (Number(item.data?.occasional_month) || 0);
            const dayTotal = (Number(item.data?.monthly_day) || 0) + (Number(item.data?.occasional_day) || 0);
            
            mainText = `₹${monthTotal.toLocaleString('en-IN')}`;
            bottomText = `${item.data?.month_name || 'Month'} Total`;
            
            extraContent = (
                <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' }}>Today's Collection</Text>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>₹{dayTotal.toLocaleString('en-IN')}</Text>
                </View>
            );
        } else if (item.type === 'attendance_merged') {
            const marked = !!item.data.self;
            const selfStatus = item.data.self?.status;
            const staffStats = item.data.stats;

            if (marked) {
                gradientColors = GRADIENTS.teacher;
                iconName = 'school';
                
                if (teacherData?.special_permission) {
                    title = 'Staff Attendance';
                    mainText = `${staffStats?.present || 0} / ${staffStats?.total || 0}`;
                    bottomText = 'Teachers Present Today';
                    extraContent = (
                        <View style={styles.cardActionOverlay}>
                            <Text style={styles.cardStatusText}>MY STATUS: {selfStatus?.toUpperCase()}</Text>
                            <TouchableOpacity onPress={() => handleMarkSelfAttendance(selfStatus === 'present' ? 'absent' : 'present')} style={styles.cardUpdateBtn}>
                                <Text style={styles.cardUpdateBtnText}>CHANGE</Text>
                            </TouchableOpacity>
                        </View>
                    );
                } else {
                    title = 'My Attendance';
                    mainText = selfStatus?.toUpperCase();
                    bottomText = 'You have marked attendance';

                    extraContent = (
                        <View style={styles.cardActionOverlay}>
                            <Text style={styles.cardStatusText}>MY STATUS: {selfStatus?.toUpperCase()}</Text>
                            <TouchableOpacity onPress={() => handleMarkSelfAttendance(selfStatus === 'present' ? 'absent' : 'present')} style={styles.cardUpdateBtn}>
                                <Text style={styles.cardUpdateBtnText}>CHANGE</Text>
                            </TouchableOpacity>
                        </View>
                    );
                }
            } else {
                gradientColors = ['#00b09b', '#96c93d'];
                iconName = 'checkmark-circle';
                title = 'My Attendance';
                isInteractive = true;
                mainText = 'NOT MARKED';
                bottomText = 'Tap to record status';
                extraContent = (
                    <View style={styles.markingButtons}>
                        <TouchableOpacity style={styles.mBtnPresent} onPress={() => handleMarkSelfAttendance('present')}>
                            <Text style={styles.mBtnTextPresent}>PRESENT</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.mBtnAbsent} onPress={() => setAbsentReasonModalVisible(true)}>
                            <Text style={styles.mBtnTextAbsent}>ABSENT</Text>
                        </TouchableOpacity>
                    </View>
                );
            }
        } else if (item.type === 'homework') {
            gradientColors = GRADIENTS.homework;
            iconName = 'book';
            title = 'Homework Stats';
            
            const classCount = item.data?.todayClassCount || 0;
            mainText = `${classCount} Class${classCount === 1 ? '' : 'es'}`;
            bottomText = classCount > 0 
                ? `Added homework in ${classCount} class${classCount === 1 ? '' : 'es'} today`
                : 'No homework assigned today';
            extraContent = null; 
        } else if (item.type === 'greeting') {
            title = item.data.greeting;
            subTitle = "Thought for you";
            mainText = item.data.quote;
            bottomText = "Have a great day!";
            gradientColors = (GRADIENTS as any)[item.data.type];
            iconName = item.data.type === 'morning' ? 'sunny' : item.data.type === 'afternoon' ? 'partly-sunny' : 'moon';
        } else if (item.type === 'event') {
            title = "Institute Event";
            subTitle = "Today's Special";
            mainText = item.data.title;
            bottomText = item.data.description || "Check calendar for details";
            gradientColors = GRADIENTS.event;
            iconName = 'star';
        }

        return (
            <TouchableOpacity 
                activeOpacity={isInteractive ? 1 : 0.95}
                onPress={() => {
                    if (isLocked && item.type !== 'greeting' && item.type !== 'event') {
                        Toast.show({ 
                            type: 'error', 
                            text1: 'Locked', 
                            text2: 'Institute subscription expired',
                            position: 'bottom',
                            bottomOffset: 40
                        });
                        return;
                    }
                    if (item.type === 'student') router.push({ pathname: '/(teacher)/stats', params: { initialTab: 'students' } });
                    else if (item.type === 'teacher') router.push({ pathname: '/(teacher)/stats', params: { initialTab: 'teachers' } });
                    else if (item.type === 'revenue') router.push({ pathname: '/(teacher)/stats', params: { initialTab: 'revenue' } });
                    else if (item.type === 'attendance_merged' && !!item.data.self) router.push({ pathname: '/(teacher)/stats', params: { initialTab: 'teachers' } }); // Keep regular teacher nav same if they click stats (but permissions handle access)
                    else if (item.type === 'homework') router.push('/(teacher)/homework');
                    else if (item.type === 'event') router.push('/(teacher)/academic-calendar');
                }}
                onPressIn={() => { isInteracting.current = true; stopTimer(); }}
                onPressOut={() => { isInteracting.current = false; startTimer(); }}
                style={[styles.cardContainer, isLocked && item.type !== 'greeting' && item.type !== 'event' && { opacity: 0.6 }]}
            >
                <LinearGradient colors={gradientColors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient}>
                    <View style={styles.cardHeader}>
                        <View>
                            <Text style={styles.cardTitle}>{title}</Text>
                            <Text style={styles.cardSub}>{subTitle}</Text>
                        </View>
                        <View style={styles.cardIconBg}>
                            {isLocked && item.type !== 'greeting' && item.type !== 'event' ? (
                                <Ionicons name="lock-closed" size={22} color="#fff" />
                            ) : (
                                item.type === 'revenue' ? (
                                    <Text style={{ fontSize: 24, color: '#fff', fontWeight: '900' }}>₹</Text>
                                ) : (
                                    <Ionicons name={iconName} size={22} color="#fff" />
                                )
                            )}
                        </View>
                    </View>
                    <View>
                        <Text style={{ fontSize: item.type === 'greeting' ? 20 : 28, fontWeight: '900', color: '#fff', letterSpacing: 0.5 }} numberOfLines={2}>{mainText}</Text>
                        <Text style={styles.cardBottomText}>{bottomText}</Text>
                        {extraContent}
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const toggleSearch = () => {
        if (isSearchActive) {
            searchBarWidth.value = withTiming(0, { duration: 300 });
            searchBarOpacity.value = withTiming(0, { duration: 200 });
            setSearchQuery('');
            setTimeout(() => setIsSearchActive(false), 300);
        } else {
            setIsSearchActive(true);
            searchBarWidth.value = withSpring(SCREEN_WIDTH - 40, { damping: 15, stiffness: 100 });
            searchBarOpacity.value = withTiming(1, { duration: 300 });
        }
    };

    const animatedSearchStyle = useAnimatedStyle(() => ({ width: searchBarWidth.value, opacity: searchBarOpacity.value }));

    const actions = useMemo(() => {
        const allActions = [
            { title: 'Routine', icon: 'calendar', color: '#0288D1', bgDark: '#1A2A33', bgLight: '#E1F5FE', path: '/(teacher)/routine' },
            { title: 'Stats', icon: 'stats-chart', color: '#27AE60', bgDark: '#1B2C1B', bgLight: '#E8F5E9', path: '/(teacher)/stats' },
            { title: 'Notice', icon: 'notifications-outline', color: '#E91E63', bgDark: '#3E1A23', bgLight: '#FCE4EC', path: '/(teacher)/notice' },
            { title: 'My Attendance', icon: 'calendar-clear-outline', color: '#00897B', bgDark: '#00332dff', bgLight: '#E0F2F1', path: '/(teacher)/attendance/my-attendance' },
            { title: 'Attendance', icon: 'checkmark-done', color: '#9C27B0', bgDark: '#2E1A47', bgLight: '#F3E5F5', path: '/(teacher)/attendance' },
            { title: 'Students', icon: 'school', color: '#3498DB', bgDark: '#1B263B', bgLight: '#E3F2FD', path: '/(teacher)/students' },
            { title: 'Add Student', icon: 'person-add', color: '#27AE60', bgDark: '#1B2C1B', bgLight: '#E8F5E9', path: '/(teacher)/add-student' },
            { title: 'Homework', icon: 'book', color: '#F39C12', bgDark: '#3D2B1B', bgLight: '#FFF3E0', path: '/(teacher)/homework' },
            { title: 'Admit Card', icon: 'card-outline', color: '#6366f1', bgDark: '#2D1B36', bgLight: '#F3E5F5', path: '/(teacher)/admit-card' },
            { title: 'Academic Calendar', icon: 'calendar-number-outline', color: '#795548', bgDark: '#3E2723', bgLight: '#FFF3E0', path: '/(teacher)/academic-calendar' },
            { title: 'Fees Management', icon: 'custom-rupee', color: '#3F51B5', bgDark: '#1A237E', bgLight: '#E8EAF6', path: '/(teacher)/fees', restricted: true },
        ];
        
        return allActions.filter(a => !a.restricted || teacherData?.special_permission);
    }, [teacherData, isDark]);

    const handleLogout = async () => {
        await AsyncStorage.clear();
        router.replace('/(auth)/teacher-login');
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { paddingTop: insets.top + 5, paddingBottom: 5, paddingRight: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
        headerLogo: { width: 140, height: 50 },
        headerRight: { flexDirection: 'row', alignItems: 'center' },
        avatarWrapper: { marginLeft: 12, position: 'relative' },
        headerAvatar: { width: 44, height: 44, borderRadius: 22 },
        placeholderAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
        avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
        onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: theme.success, borderWidth: 2, borderColor: theme.card },
        
        notificationBar: { flex: 1, height: 52, backgroundColor: theme.card, borderRadius: 16, marginRight: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border, elevation: 4 },
        notifIconCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f59e0b', justifyContent: 'center', alignItems: 'center' },
        notifTitle: { fontSize: 10, fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase' },
        notifText: { fontSize: 13, fontWeight: '600', color: theme.text, marginTop: 1 },
        notifBadgeRed: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#fff' },
        
        gradientIconBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 6 },
        animatedSearchBar: { position: 'absolute', top: insets.top + 62, left: 20, right: 20, height: 52, backgroundColor: theme.card, borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, zIndex: 100, borderWidth: 1, borderColor: theme.border, elevation: 10 },
        searchInput: { flex: 1, fontSize: 15, color: theme.text, marginLeft: 10 },
        resultsContainer: { position: 'absolute', top: 130, left: 20, right: 20, backgroundColor: theme.card, borderRadius: 15, maxHeight: 350, zIndex: 1000, borderWidth: 1, borderColor: theme.border, elevation: 10 },
        
        content: { flex: 1 },
        cardContainer: { width: SCREEN_WIDTH - 30, height: 170, marginHorizontal: 15, borderRadius: 24, elevation: 8 },
        cardGradient: { flex: 1, borderRadius: 24, padding: 20, justifyContent: 'space-between' },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
        cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
        cardSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '600' },
        cardIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
        cardMainText: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
        cardBottomText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 4, fontWeight: '600' },
        
        markingButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
        mBtnPresent: { backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
        mBtnTextPresent: { color: '#00b09b', fontWeight: '900', fontSize: 12 },
        mBtnAbsent: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#fff' },
        mBtnTextAbsent: { color: '#fff', fontWeight: '900', fontSize: 12 },
        
        cardActionOverlay: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        cardStatusText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '800' },
        cardUpdateBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
        cardUpdateBtnText: { color: '#fff', fontSize: 10, fontWeight: '900' },
        
        hwMetaBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)' },
        hwMetaText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' },

        hwGridContainer: { 
            flexDirection: 'row', 
            flexWrap: 'wrap', 
            marginTop: 5,
            justifyContent: 'flex-start',
            gap: 8,
            height: 120
        },
        hwGridItem: { 
            width: (SCREEN_WIDTH - 100) / 3,
            backgroundColor: 'rgba(255,255,255,0.15)',
            padding: 6,
            borderRadius: 10,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)'
        },
        hwGridClass: { 
            color: '#fff', 
            fontSize: 10, 
            fontWeight: '900',
            textTransform: 'uppercase'
        },
        hwGridStat: { 
            color: '#fff', 
            fontSize: 12, 
            fontWeight: '700',
            marginTop: 2
        },

        routineSection: { padding: 20, paddingBottom: 10 },
        sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 },
        sectionTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        viewWeeklyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary + '15', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
        viewWeeklyText: { fontSize: 12, fontWeight: 'bold', color: theme.primary, marginRight: 4 },
        todayRoutineCard: { backgroundColor: theme.card, borderRadius: 24, padding: 15, borderWidth: 1, borderColor: theme.border },
        lecturePill: { width: 160, backgroundColor: theme.background, borderRadius: 18, padding: 12, marginRight: 12, borderWidth: 1, borderColor: theme.border },
        liveLecturePill: { borderColor: theme.primary, backgroundColor: theme.primary + '10', borderWidth: 2 },
        liveBadge: { position: 'absolute', top: -10, right: 12, backgroundColor: theme.primary, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 10 },
        liveBadgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
        pillTime: { fontSize: 10, fontWeight: 'bold', color: theme.textLight, marginBottom: 6 },
        pillSubject: { fontSize: 14, fontWeight: '800', color: theme.text },
        pillTarget: { fontSize: 11, color: theme.primary, fontWeight: '700' },
        
        actionsContainer: { padding: 15 },
        actionsBox: { borderWidth: 1, borderColor: theme.border, borderRadius: 22, paddingTop: 20, paddingBottom: 25, backgroundColor: theme.card, position: 'relative', marginBottom: 25, flexDirection: 'row', flexWrap: 'wrap' },
        actionCard: { width: '33.33%', alignItems: 'center', marginBottom: 15 },
        actionIconCircle: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
        actionText: { fontSize: 11, fontWeight: '700', color: theme.text, textAlign: 'center' },
        expandButton: { position: 'absolute', bottom: -15, left: '50%', marginLeft: -15, width: 30, height: 30, borderRadius: 15, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', zIndex: 10, elevation: 3 },
        
        reasonModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
        reasonModalContent: { width: '100%', backgroundColor: theme.card, borderRadius: 30, padding: 25, elevation: 10, borderWidth: 1, borderColor: theme.border },
        reasonModalHeader: { alignItems: 'center', marginBottom: 20 },
        reasonModalTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        reasonModalSubtitle: { fontSize: 13, color: theme.textLight, marginTop: 4 },
        reasonInput: { backgroundColor: theme.background, borderRadius: 15, padding: 15, color: theme.text, fontSize: 15, borderWidth: 1, borderColor: theme.border, textAlignVertical: 'top', minHeight: 100 },
        reasonModalFooter: { flexDirection: 'row', gap: 12, marginTop: 20 },
        reasonBtn: { flex: 1, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
        skipBtn: { backgroundColor: theme.border },
        skipBtnText: { color: theme.text, fontWeight: '800' },
        submitReasonBtn: { backgroundColor: theme.danger },
        submitReasonText: { color: '#fff', fontWeight: '900' },
        
        profileMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', alignItems: 'flex-end' },
        profileMenu: { marginTop: 80, marginRight: 20, width: 280, backgroundColor: theme.card, borderRadius: 24, padding: 20, elevation: 10 },
        profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: theme.border },
        profileInfo: { marginLeft: 12, flex: 1 },
        profileName: { fontSize: 18, fontWeight: 'bold', color: theme.text },
        profileSub: { fontSize: 12, color: theme.textLight, marginTop: 2 },
        menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
        menuText: { fontSize: 16, color: theme.text, marginLeft: 12 },
        toggleBackground: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#ddd', padding: 2 },
        toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
        toggleCircleActive: { alignSelf: 'flex-end' },
        
        sessionMenuPicker: { backgroundColor: isDark ? '#1a1a1a' : '#f9f9f9', marginVertical: 10, borderRadius: 12, padding: 10 },
        sessionMenuItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
        sessionMenuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        sessionMenuName: { fontSize: 14, color: theme.text },
        
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
        modalContent: { backgroundColor: theme.card, borderTopLeftRadius: 35, borderTopRightRadius: 35, paddingHorizontal: 20, paddingBottom: 40, maxHeight: SCREEN_HEIGHT * 0.85 },
        modalHandle: { width: 45, height: 6, backgroundColor: theme.border, borderRadius: 3, marginBottom: 15, alignSelf: 'center', marginTop: 15 },
        modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text, textAlign: 'center' },
        modalSubtitle: { fontSize: 14, color: theme.textLight, marginTop: 6, textAlign: 'center' },
        accItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 24, marginBottom: 14, backgroundColor: theme.background },
        accItemActive: { backgroundColor: theme.primary + '08', borderWidth: 1.5, borderColor: theme.primary + '35' },
        accAvatar: { width: 56, height: 56, borderRadius: 28 },
        loggedInDot: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: theme.success, borderWidth: 3, borderColor: theme.card },
        accInfo: { flex: 1, marginLeft: 16 },
        accName: { fontSize: 18, fontWeight: '800', color: theme.text },
        accSchool: { fontSize: 13, color: theme.textLight, marginTop: 2 },
        accMeta: { fontSize: 12, color: theme.primary, fontWeight: '700', marginTop: 5 },
        lockBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.warning + '12', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
        lockText: { fontSize: 12, fontWeight: '800', color: theme.warning, marginLeft: 5 },
        modalLogoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderTopWidth: 1, borderTopColor: theme.border, marginTop: 10 },
        modalLogoutText: { color: theme.danger, fontWeight: '800', fontSize: 16, marginLeft: 10 },
        
        notifDropdown: { backgroundColor: theme.card, borderRadius: 24, padding: 20, elevation: 10, borderWidth: 1, borderColor: theme.border },
        notifDropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
        notifDropdownTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
        notifItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border + '40' },
        notifItemDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
        notifItemTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
        notifItemMsg: { fontSize: 12, color: theme.textLight, marginTop: 2 },
        notifItemTime: { fontSize: 10, color: theme.textLight, marginLeft: 10, fontWeight: '600' },
    }), [theme, insets, isDark, flashcardData.length, activeSlide, isSearchActive, searchQuery]);

    if (loading && !teacherData) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}><ActivityIndicator size="large" color={theme.primary} /></View>;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => setShowAccountModal(true)} 
                    style={{ marginLeft: -20 }}
                >
                    <View style={{ position: 'relative' }}>
                        <Image source={teacherData?.institute_logo ? { uri: teacherData.institute_logo } : require('../../assets/images/react-logo.png')} style={styles.headerLogo} resizeMode="contain" />
                    </View>
                </TouchableOpacity>
                <View style={styles.headerRight}>
                    <TouchableOpacity 
                        onPress={() => !isLocked && setShowProfileMenu(true)} 
                        style={[styles.avatarWrapper, isLocked && { opacity: 0.7 }]}
                        activeOpacity={isLocked ? 1 : 0.7}
                    >
                        <View style={{ position: 'relative' }}>
                            {teacherData?.photo_url ? <Image source={{ uri: teacherData.photo_url }} style={styles.headerAvatar} /> : <View style={[styles.placeholderAvatar, { backgroundColor: theme.primary }]}><Text style={styles.avatarText}>{teacherData?.name?.charAt(0) || 'T'}</Text></View>}
                            {isLocked ? (
                                <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.danger, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.background }}>
                                    <Ionicons name="lock-closed" size={10} color="#fff" />
                                </View>
                            ) : (
                                <View style={styles.onlineDot} />
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            {isSearchActive && (
                <Animated.View style={[styles.animatedSearchBar, animatedSearchStyle]}>
                    <Ionicons name="search" size={20} color={theme.textLight} />
                    <TextInput style={styles.searchInput} placeholder="Search Students..." placeholderTextColor={theme.textLight} value={searchQuery} onChangeText={(t) => { setSearchQuery(t); }} autoFocus />
                    <TouchableOpacity onPress={toggleSearch}><Ionicons name="close-circle" size={20} color={theme.textLight} /></TouchableOpacity>
                </Animated.View>
            )}

            <View style={{ position: 'relative', marginTop: 10, marginHorizontal: 20, zIndex: 90, flexDirection: 'row', alignItems: 'center', opacity: isSearchActive ? 0 : 1 }}>
                <TouchableOpacity 
                    style={[styles.notificationBar]} 
                    activeOpacity={isLocked ? 1 : 0.9} 
                    onPress={() => !isLocked && notifications.length > 0 && setShowNotifList(true)}
                >
                    <View style={[styles.notifIconCircle, notifications.length === 0 && { backgroundColor: '#6366f1' }]}><Ionicons name="notifications" size={18} color="#fff" />{notifications.length > 0 && <View style={styles.notifBadgeRed} />}</View>
                    <View style={{ flex: 1, marginLeft: 12 }}><Text style={[styles.notifTitle, notifications.length === 0 && { color: theme.textLight }]}>{notifications.length > 0 ? `${notifications.length} New Updates` : 'No updates'}</Text><Text style={styles.notifText} numberOfLines={1}>{notifications.length > 0 ? notifications[0].message : 'Everything caught up'}</Text></View>
                    <Ionicons name={notifications.length > 0 ? "chevron-down" : "chevron-forward"} size={16} color={theme.textLight} />
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => {
                        if (isLocked) {
                            Toast.show({ type: 'error', text1: 'Locked', text2: 'Subscription expired', position: 'bottom', bottomOffset: 40 });
                            return;
                        }
                        toggleSearch();
                    }} 
                    activeOpacity={isLocked ? 1 : 0.8}
                >
                    <LinearGradient colors={['#3b82f6', '#8b5cf6', '#ec4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.gradientIconBtn]}><Ionicons name="search" size={22} color="#fff" /></LinearGradient>
                </TouchableOpacity>

                {isLocked && (
                    <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', borderRadius: 16, zIndex: 100, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="lock-closed" size={16} color={theme.danger} />
                    </View>
                )}
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}>
                <View style={{ position: 'relative', marginTop: 15, marginBottom: 5 }}>
                    <Animated.FlatList
                        ref={flatListRef as any}
                        data={flashcardData}
                        renderItem={renderFlashcardItem}
                        keyExtractor={(item, index) => item.type + index}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={onMomentumScrollEnd}
                        getItemLayout={(data, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
                        snapToInterval={SCREEN_WIDTH}
                        decelerationRate="fast"
                        style={{ width: SCREEN_WIDTH }}
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>{flashcardData.filter(f => !f.isDuplicate).map((_, idx) => <View key={idx} style={{ width: activeSlide === idx ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: activeSlide === idx ? theme.primary : theme.border, marginHorizontal: 4 }} />)}</View>
                    
                    {isLocked && (
                        <View style={{
                            ...StyleSheet.absoluteFillObject,
                            backgroundColor: theme.background,
                            zIndex: 1000,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: theme.border,
                            top: -10,
                            bottom: -20,
                            left: -5,
                            right: -5
                        }}>
                            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.danger + '10', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name="lock-closed" size={36} color={theme.danger} />
                            </View>
                            <Text style={{ color: theme.text, fontWeight: '900', marginTop: 15, fontSize: 18 }}>Staff Insights Locked</Text>
                            <Text style={{ color: theme.textLight, fontSize: 13, marginTop: 5, fontWeight: '600' }}>Subscription Renewal Required</Text>
                        </View>
                    )}
                </View>

                <Modal visible={absentReasonModalVisible} transparent={true} animationType="fade">
                    <View style={styles.reasonModalOverlay}><BlurView intensity={30} style={StyleSheet.absoluteFill} /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', alignItems: 'center' }}><View style={styles.reasonModalContent}><View style={styles.reasonModalHeader}><Text style={styles.reasonModalTitle}>Reason for Absence</Text><Text style={styles.reasonModalSubtitle}>Optional: Add a note or just skip</Text></View><TextInput style={styles.reasonInput} placeholder="Enter reason..." placeholderTextColor={theme.textLight + '80'} value={absentReason} onChangeText={setAbsentReason} multiline numberOfLines={3} /><View style={styles.reasonModalFooter}><TouchableOpacity style={[styles.reasonBtn, { backgroundColor: theme.border }]} onPress={() => handleMarkSelfAttendance('absent')}><Text style={{ color: theme.text, fontWeight: '800' }}>SKIP</Text></TouchableOpacity><TouchableOpacity style={[styles.reasonBtn, { backgroundColor: theme.danger }]} onPress={() => handleMarkSelfAttendance('absent', absentReason)}><Text style={{ color: '#fff', fontWeight: '900' }}>MARK ABSENT</Text></TouchableOpacity></View><TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }} onPress={() => setAbsentReasonModalVisible(false)}><Text style={{ color: theme.textLight, fontWeight: '700' }}>Cancel</Text></TouchableOpacity></View></KeyboardAvoidingView></View>
                </Modal>

                {schedule.length > 0 && (
                    <View style={[styles.routineSection, { position: 'relative' }]}>
                        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Today's Schedule</Text><TouchableOpacity style={styles.viewWeeklyBtn} onPress={() => {
                            if (isLocked) {
                                Toast.show({ 
                                    type: 'error', 
                                    text1: 'Locked', 
                                    text2: 'Subscription expired',
                                    position: 'bottom',
                                    bottomOffset: 40
                                });
                                return;
                            }
                            setIsWeeklyModalOpen(true)
                        }}><Text style={styles.viewWeeklyText}>Weekly Flow</Text><Ionicons name="calendar-outline" size={14} color={theme.primary} /></TouchableOpacity></View>
                        <View style={styles.todayRoutineCard}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 20}}>{schedule.filter(s => s.day === ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]).length === 0 ? <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: theme.textLight, fontSize: 14, fontWeight: '600' }}>No lectures today ☕</Text></View> : schedule.filter(s => s.day === ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]).map((item, idx) => {
                            const now = new Date(); const currentTime = now.getHours() * 60 + now.getMinutes(); const parseTime = (t: string) => { if (!t) return 0; const [time, modifier] = t.split(' '); let [hours, minutes] = time.split(':').map(Number); if (modifier === 'PM' && hours < 12) hours += 12; if (modifier === 'AM' && hours === 12) hours = 0; return hours * 60 + minutes; };
                            const start = parseTime(item.startTime); const end = parseTime(item.endTime); const isLive = currentTime >= start && currentTime <= end;
                            return <View key={idx} style={[styles.lecturePill, isLive && styles.liveLecturePill]}>{isLive && <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE</Text></View>}<Text style={styles.pillTime}>{item.startTime} - {item.endTime}</Text><Text style={styles.pillSubject} numberOfLines={1}>{item.subject}</Text><Text style={styles.pillTarget}>Class {item.className}-{item.section}</Text></View>;
                        })}</ScrollView></View>

                        {isLocked && (
                            <View style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: theme.background,
                                zIndex: 1000,
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: theme.border,
                                top: 5,
                                bottom: -5,
                                left: 10,
                                right: 10,
                                borderRadius: 24
                            }}>
                                <Ionicons name="lock-closed" size={24} color={theme.danger} />
                                <Text style={{ color: theme.text, fontWeight: '800', marginTop: 8, fontSize: 14 }}>Schedule Hidden</Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.actionsContainer}>
                    <View style={styles.actionsBox}>
                        {(isActionsExpanded ? actions : actions.slice(0, 3)).map((action, index) => (
                            <TouchableOpacity 
                                key={index} 
                                style={styles.actionCard} 
                                onPress={() => router.push(action.path as any)}
                            >
                                <View style={[styles.actionIconCircle, { backgroundColor: isDark ? action.bgDark : action.bgLight }]}>
                                    {action.icon === 'custom-rupee' ? (
                                        <Text style={{ fontSize: 24, color: action.color, fontWeight: 'bold' }}>₹</Text>
                                    ) : (
                                        <Ionicons name={action.icon as any} size={24} color={action.color} />
                                    )}
                                </View>
                                <Text style={styles.actionText}>{action.title}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.expandButton} onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setIsActionsExpanded(!isActionsExpanded);
                        }}>
                            <Ionicons name={isActionsExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.textLight} />
                        </TouchableOpacity>

                        {/* LARGE LOCK OVERLAY */}
                        {isLocked && (
                            <View style={{
                                ...StyleSheet.absoluteFillObject,
                                backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)',
                                borderRadius: 22,
                                justifyContent: 'center',
                                alignItems: 'center',
                                zIndex: 1000,
                                borderWidth: 1,
                                borderColor: theme.danger + '40'
                            }}>
                                <View style={{
                                    width: 60,
                                    height: 60,
                                    borderRadius: 30,
                                    backgroundColor: theme.danger + '15',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginBottom: 12
                                }}>
                                    <Ionicons name="lock-closed" size={32} color={theme.danger} />
                                </View>
                                <Text style={{ color: theme.text, fontWeight: '900', fontSize: 16 }}>Actions Locked</Text>
                                <Text style={{ color: theme.textLight, fontSize: 12, marginTop: 4, fontWeight: '600' }}>Renew Subscription to Access</Text>
                                <TouchableOpacity 
                                    onPress={() => Toast.show({ type: 'error', text1: 'Renewal Required', text2: 'Please contact administration', position: 'bottom', bottomOffset: 40 })}
                                    style={{ marginTop: 15, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.danger }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>GET ACCESS</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            <Modal visible={showProfileMenu} transparent={true} animationType="fade" onRequestClose={() => setShowProfileMenu(false)}>
                <TouchableOpacity style={styles.profileMenuOverlay} activeOpacity={1} onPress={() => setShowProfileMenu(false)}><View style={styles.profileMenu}><View style={styles.profileHeader}>{teacherData?.photo_url ? <Image source={{ uri: teacherData.photo_url }} style={styles.headerAvatar} /> : <View style={[styles.placeholderAvatar, { backgroundColor: theme.primary }]}><Text style={styles.avatarText}>{teacherData?.name?.charAt(0) || 'T'}</Text></View>}<View style={styles.profileInfo}><Text style={styles.profileName}>{teacherData?.name}</Text><Text style={styles.profileSub}>{teacherData?.institute_name}</Text></View></View>
                
                <TouchableOpacity style={styles.menuItem} onPress={() => toggleTheme()}><Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={theme.text} /><Text style={styles.menuText}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text><View style={{ flex: 1 }} /><View style={[styles.toggleBackground, isDark && { backgroundColor: theme.primary }]}><View style={[styles.toggleCircle, isDark && styles.toggleCircleActive]} /></View></TouchableOpacity>

                {/* Academic Session Switcher */}
                <TouchableOpacity 
                    style={styles.menuItem} 
                    onPress={() => setShowSessionPicker(!showSessionPicker)}
                >
                    <Ionicons name="calendar-outline" size={20} color={theme.text} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.menuText}>Academic Session</Text>
                        <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '700', marginLeft: 12 }}>
                            {sessions.find(s => s.id === selectedSessionId)?.name || 'Select Session'}
                        </Text>
                    </View>
                    <Ionicons name={showSessionPicker ? "chevron-up" : "chevron-down"} size={16} color={theme.textLight} />
                </TouchableOpacity>

                {showSessionPicker && (
                    <View style={styles.sessionMenuPicker}>
                        {sessions.length === 0 && <Text style={{padding: 10, color: theme.textLight, textAlign: 'center', fontSize: 12}}>No sessions found</Text>}
                        {sessions.map((session) => (
                            <View key={session.id} style={styles.sessionMenuItem}>
                                <TouchableOpacity 
                                    style={styles.sessionMenuRow}
                                    onPress={async () => {
                                        if (selectedSessionId !== session.id) {
                                            try {
                                                await AsyncStorage.setItem('selectedSessionId', String(session.id));
                                                setSelectedSessionId(session.id);
                                                setShowSessionPicker(false);
                                                setShowProfileMenu(false);
                                                Toast.show({ type: 'success', text1: 'Session Switched', text2: `Viewing data for ${session.name}` });
                                                onRefresh(session.id);
                                            } catch (e) {
                                                Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to switch session' });
                                            }
                                        }
                                    }}
                                >
                                    <Text style={[styles.sessionMenuName, session.id === selectedSessionId && { color: theme.primary, fontWeight: '800' }]}>
                                        {session.name}
                                    </Text>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        {session.id === selectedSessionId && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                <TouchableOpacity style={styles.menuItem} onPress={() => { setShowProfileMenu(false); router.push('/(teacher)/profile'); }}><Ionicons name="person-outline" size={20} color={theme.text} /><Text style={styles.menuText}>My Profile</Text></TouchableOpacity><TouchableOpacity style={styles.menuItem} onPress={handleLogout}><Ionicons name="log-out-outline" size={20} color={theme.danger} /><Text style={[styles.menuText, { color: theme.danger }]}>Logout</Text></TouchableOpacity></View></TouchableOpacity>
            </Modal>

            <Modal visible={showAccountModal} transparent={true} animationType="slide" onRequestClose={() => setShowAccountModal(false)}><TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAccountModal(false)}><View style={styles.modalContent}><View style={styles.modalHeader}><View style={styles.modalHandle} /><Text style={styles.modalTitle}>Multi-Institute Access</Text></View><ScrollView style={{marginTop:10}} showsVerticalScrollIndicator={false}>{fetchingAccounts ? <ActivityIndicator style={{ margin: 20 }} color={theme.primary} /> : allAccounts.map((acc) => { const isActive = acc.id === teacherData?.id; return <TouchableOpacity key={acc.id} style={[styles.accItem, isActive && styles.accItemActive]} onPress={() => {}} activeOpacity={0.7}><View style={{position:'relative'}}>{acc.photo_url ? <Image source={{ uri: acc.photo_url }} style={styles.accAvatar} /> : <View style={[styles.accAvatar, { backgroundColor: theme.primary + '15' }]}><Text style={{fontSize:24, fontWeight:'900', color:theme.primary}}>{acc.name[0]}</Text></View>}</View><View style={styles.accInfo}><Text style={styles.accName}>{acc.name}</Text><Text style={styles.accSchool}>{acc?.institute_name || 'Institute'}</Text><Text style={styles.accMeta}>{acc.subject} • {acc.qualification}</Text></View>{isActive && <Ionicons name="checkmark-circle" size={24} color={theme.success} />}</TouchableOpacity>; })}</ScrollView><TouchableOpacity style={styles.modalLogoutBtn} onPress={handleLogout}><Ionicons name="log-out-outline" size={22} color={theme.danger} /><Text style={styles.modalLogoutText}>Sign Out</Text></TouchableOpacity></View></TouchableOpacity></Modal>

            <Modal visible={isWeeklyModalOpen} animationType="slide" transparent={true}><View style={styles.modalOverlay}><View style={styles.routineModalContent}><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Weekly Flow</Text></View><TouchableOpacity onPress={() => setIsWeeklyModalOpen(false)}><Ionicons name="close-circle" size={32} color={theme.textLight} /></TouchableOpacity></View><ScrollView style={{ marginTop: 20 }} showsVerticalScrollIndicator={false}><View style={{ flexDirection: 'column' }}>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => { const dayClasses = schedule.filter(s => s.day === day); if (dayClasses.length === 0) return null; return <View key={day} style={{ marginBottom: 25 }}><Text style={styles.dayHeader}>{day}</Text>{dayClasses.map((item, idx) => <View key={idx} style={styles.lectureCard}><View style={styles.lectureCardHeader}><Text style={styles.lectureSubject}>{item.subject}</Text><Text style={styles.lectureTime}>{item.startTime} - {item.endTime}</Text></View><View style={{flexDirection:'row', marginTop:8, gap:10}}><View style={styles.viewWeeklyBtn}><Text style={{fontSize:11, color:theme.primary, fontWeight:'700'}}>Class {item.className}-{item.section}</Text></View></View></View>)}</View>; })}</View></ScrollView></View></View></Modal>

            <Modal visible={showNotifList} transparent={true} animationType="fade" onRequestClose={() => setShowNotifList(false)}><TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', paddingTop: insets.top + 70, paddingHorizontal: 20 }} activeOpacity={1} onPress={() => setShowNotifList(false)}><View style={styles.notifDropdown}><View style={styles.notifDropdownHeader}><Text style={styles.notifDropdownTitle}>Recent Updates</Text><TouchableOpacity onPress={() => setNotifications([])}><Text style={{ color: theme.danger, fontWeight: '700' }}>Clear All</Text></TouchableOpacity></View><ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>{notifications.length === 0 ? <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: theme.textLight }}>No recent updates</Text></View> : notifications.map((item) => <View key={item.id} style={styles.notifItem}><View style={[styles.notifItemDot, { backgroundColor: item.type === 'request' ? '#f59e0b' : item.type === 'salary' ? '#10b981' : theme.primary }]} /><View style={{ flex: 1 }}><Text style={styles.notifItemTitle}>{item.title}</Text><Text style={styles.notifItemMsg}>{item.message}</Text></View><Text style={styles.notifItemTime}>{item.time}</Text></View>)}</ScrollView></View></TouchableOpacity></Modal>
        </View>
    );
}