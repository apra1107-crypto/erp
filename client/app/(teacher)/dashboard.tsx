import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView, Modal, TextInput, Dimensions, KeyboardAvoidingView, Platform, StatusBar, RefreshControl, FlatList, LayoutAnimation, UIManager, Alert, TouchableWithoutFeedback, Keyboard, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withRepeat, withSequence } from 'react-native-reanimated';
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
    morning: ['#FF9500', '#FFCC00'],
    afternoon: ['#007AFF', '#4CD964'],
    evening: ['#5856D6', '#000000'],
    event: ['#FF2D55', '#AF52DE'],
    revenue: ['#10b981', '#059669'],
};

const LiveBadge = () => {
    const opacity = useSharedValue(1);
    const scale = useSharedValue(1);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.4, { duration: 800 }),
                withTiming(1, { duration: 800 })
            ),
            -1,
            true
        );
        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 800 }),
                withTiming(1, { duration: 800 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
        borderColor: '#FF3B30',
        borderWidth: 2,
    }));

    return (
        <Animated.View style={[{ 
            backgroundColor: '#fff', 
            paddingHorizontal: 10, 
            paddingVertical: 4, 
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 5,
            shadowColor: '#FF3B30',
            shadowOpacity: 0.5,
            shadowRadius: 5
        }, animatedStyle]}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FF3B30', marginRight: 5 }} />
            <Text style={{ fontSize: 9, fontWeight: '900', color: '#FF3B30', letterSpacing: 0.5 }}>LIVE</Text>
        </Animated.View>
    );
};

const getGreetingAndQuote = () => {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const currentTime = hour * 60 + min;

    if (hour >= 6 && hour < 12) {
        return {
            greeting: "Good Morning",
            type: 'morning'
        };
    } else if (hour >= 12 && hour < 16) {
        return {
            greeting: "Good Afternoon",
            type: 'afternoon'
        };
    } else if (hour >= 16 && hour < 22) {
        return {
            greeting: "Good Evening",
            type: 'evening'
        };
    } else {
        return {
            greeting: "Good Night",
            type: 'evening' // Using evening gradient for night
        };
    }
};

export default function TeacherDashboard() {
    const router = useRouter();
    const { isDark, theme, toggleTheme } = useTheme();
    const insets = useSafeAreaInsets();
    const { socket } = useSocket();

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                Alert.alert('Exit App', 'Are you sure you want to close the app?', [
                    { text: 'Cancel', style: 'cancel', onPress: () => null },
                    { text: 'Exit', onPress: () => BackHandler.exitApp() },
                ], { cancelable: true });
                return true;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    const [teacherData, setTeacherData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Subscription States
    const [subStatus, setSubStatus] = useState('loading');
    const [subData, setSubData] = useState<any>(null);
    const isLocked = subStatus === 'expired' || subStatus === 'disabled';

    // AUTO-EXPIRY WATCHER
    useEffect(() => {
        if (subStatus !== 'active' || !subData?.subscription_end_date) return;
        const checkExpiry = () => {
            const now = new Date();
            const expiry = new Date(subData.subscription_end_date);
            if (now >= expiry) {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                setSubStatus('expired');
                Toast.show({ type: 'error', text1: 'Subscription Expired', text2: 'Institute subscription reached its time limit.', position: 'bottom', bottomOffset: 40 });
            }
        };
        const timer = setInterval(checkExpiry, 1000);
        return () => clearInterval(timer);
    }, [subStatus, subData?.subscription_end_date]);

    const [flashcards, setFlashcards] = useState<any>(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const isInteracting = useRef(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [todayAttendance, setTodayAttendance] = useState<any>(null);
    const [markingAttendance, setMarkingAttendance] = useState(false);
    const [absentReasonModalVisible, setAbsentReasonModalVisible] = useState(false);
    const [absentReason, setAbsentReason] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifList, setShowNotifList] = useState(false);
    const [isActionsExpanded, setIsActionsExpanded] = useState(true);
    const [schedule, setSchedule] = useState<any[]>([]);
    const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false);
    const [activeWeeklyDay, setActiveWeeklyDay] = useState(new Date().toLocaleDateString('en-US', { weekday: 'long' }));
    const weekPagerRef = useRef<FlatList>(null);
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const [allAccounts, setAllAccounts] = useState<any[]>([]);
    const [savedCodes, setSavedCodes] = useState<Record<string, string>>({});
    const [fetchingAccounts, setFetchingAccounts] = useState(false);
    const [switchCode, setSwitchCode] = useState('');
    const [selectedSwitchAccount, setSelectedSwitchAccount] = useState<any>(null);

    // Auto-scroll Weekly Flow to Today
    useEffect(() => {
        if (isWeeklyModalOpen) {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const index = DAYS.indexOf(today);
            if (index !== -1) {
                setActiveWeeklyDay(today);
                setTimeout(() => {
                    weekPagerRef.current?.scrollToIndex({ index, animated: false });
                }, 100);
            }
        }
    }, [isWeeklyModalOpen]);

    useEffect(() => {
        if (!socket || !teacherData?.institute_id) return;
        const handleSubUpdate = (data: any) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
            if (data.status) setSubStatus(data.status);
            if (data.settings) setSubData(data.settings);
        };
        const joinRooms = () => {
            socket.emit('join_room', `teacher-${teacherData.institute_id}`);
            socket.emit('join_room', `teacher-${teacherData.id}`);
            if (teacherData.special_permission) {
                socket.emit('join_room', `principal-${teacherData.institute_id}`);
            }
            checkSubscription(teacherData.institute_id);
        };
        joinRooms();
        socket.on('connect', joinRooms);
        socket.on('subscription_update', handleSubUpdate);
        return () => {
            socket.off('connect', joinRooms);
            socket.off('subscription_update', handleSubUpdate);
        };
    }, [socket, teacherData?.institute_id, teacherData?.id, teacherData?.special_permission]);

    useEffect(() => {
        if (!socket || !teacherData?.id) return;
        const addNotif = (notif: any) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setNotifications(prev => {
                // If notification has a unique ID (e.g. notice ID, fee payment ID), prevent duplicates
                if (notif.id && prev.some(n => n.id === notif.id)) return prev;
                // Otherwise use a unique ID for this instance
                const uniqueId = notif.id || Math.random().toString(36).substr(2, 9);
                return [{ id: uniqueId, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), ...notif }, ...prev];
            });
        };
        socket.on('absent_request', (data) => addNotif({ id: `absent_${data.id || Math.random()}`, title: 'Absent Request', message: `New request from Roll ${data.roll_no}`, type: 'request' }));
        socket.on('new_notice', (data) => addNotif({ id: `notice_${data.id}`, title: data.isUpdate ? `Notice Updated: ${data.topic}` : `Notice: ${data.topic}`, message: `By ${data.creator_name}`, type: 'notice' }));
        socket.on('fee_payment_received', (data) => {
            if (teacherData?.special_permission) {
                const notif = { id: `fee_${data.paymentId || Math.random()}`, title: data.title || 'Fee Payment', message: data.message || `₹${data.amount} received from ${data.studentName}`, type: 'fees' };
                addNotif(notif);
                
                // Add banner notification for special teachers
                Toast.show({
                    type: 'success',
                    text1: notif.title,
                    text2: notif.message,
                    position: 'top',
                    topOffset: 60
                });
            }
        });
        return () => {
            socket.off('absent_request');
            socket.off('new_notice');
            socket.off('fee_payment_received');
        };
    }, [socket, teacherData?.id, teacherData?.special_permission]);

    const checkSubscription = async (id: any) => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const res = await axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${id}/status`, { headers: { Authorization: `Bearer ${token}` } });
            setSubStatus(res.data.status);
            setSubData(res.data);
        } catch (e) {}
    };
    
    const [isSearchActive, setIsSearchActive] = useState(false);
    const searchBarWidth = useSharedValue(0);
    const searchBarOpacity = useSharedValue(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [showSessionPicker, setShowSessionPicker] = useState(false);

    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showResults, setShowResults] = useState(false);

    const handleSearch = async (t: string) => {
        setSearchQuery(t);
        if (t.length < 2) { setSearchResults([]); setShowResults(false); return; }
        setIsSearching(true); setShowResults(true);
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userData = await AsyncStorage.getItem('teacherData');
            const sessionId = storedSessionId || (userData ? JSON.parse(userData).current_session_id : null);

            // Teachers can only search for students, so we use the search endpoint and filter for students
            const res = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/search?query=${t}`, { 
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                } 
            });
            // Filter results to only show students
            const studentResults = (res.data.results || []).filter((item: any) => item.type === 'student');
            setSearchResults(studentResults);
        } catch (e) {} finally { setIsSearching(false); }
    };

    const handleCreateResult = (item: any) => { 
        dismissSearch();
        router.push(`/(teacher)/students/details/${item.id}`); 
    };

    const dismissSearch = () => {
        if (isSearchActive) {
            searchBarWidth.value = withTiming(0, { duration: 300 });
            searchBarOpacity.value = withTiming(0, { duration: 200 });
            setSearchQuery('');
            setShowResults(false);
            setIsSearching(false);
            setTimeout(() => setIsSearchActive(false), 300);
        }
    };

    const toggleSearch = () => {
        if (isSearchActive) {
            dismissSearch();
        } else {
            setIsSearchActive(true);
            searchBarWidth.value = withSpring(SCREEN_WIDTH - 40, { damping: 15 });
            searchBarOpacity.value = withTiming(1, { duration: 300 });
        }
    };

    const animatedSearchStyle = useAnimatedStyle(() => ({
        width: searchBarWidth.value,
        opacity: searchBarOpacity.value,
    }));

    const loadInitialData = async () => {
        try {
            const data = await AsyncStorage.getItem('teacherData');
            if (data) {
                const parsed = JSON.parse(data);
                setTeacherData(parsed);
                fetchAllAccounts(parsed.mobile);
            }
            const storedSession = await AsyncStorage.getItem('selectedSessionId');
            if (storedSession) setSelectedSessionId(Number(storedSession));

            // Load saved access codes for fast switching
            const saved = await AsyncStorage.getItem('saved_teacher_codes');
            if (saved) setSavedCodes(JSON.parse(saved));
        } catch (e) {}
    };

    const fetchAllAccounts = async (mobile: string) => {
        if (!mobile) return;
        setFetchingAccounts(true);
        try {
            const response = await axios.post(`${API_ENDPOINTS.AUTH.TEACHER}/get-all-accounts`, { mobile });
            setAllAccounts(response.data.accounts || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setFetchingAccounts(false);
        }
    };

    const handleSwitchAction = async (account: any) => {
        // Check if we have a saved code for this teacher_id
        const savedCode = savedCodes[account.id.toString()];
        if (savedCode) {
            handleFastSwitch(account, savedCode);
        } else {
            setSelectedSwitchAccount(account);
            setSwitchCode('');
        }
    };

    const handleFastSwitch = async (account: any, code: string) => {
        setFetchingAccounts(true);
        try {
            const response = await axios.post(`${API_ENDPOINTS.AUTH.TEACHER}/verify-code`, {
                teacher_id: account.id,
                access_code: code
            });

            const { token, teacher } = response.data;
            await AsyncStorage.setItem('teacherToken', token);
            await AsyncStorage.setItem('teacherData', JSON.stringify(teacher));
            
            Toast.show({ type: 'success', text1: 'Switched!', text2: `Logged into ${teacher.institute_name}` });
            setShowAccountModal(false);
            setSelectedSwitchAccount(null);
            setSwitchCode('');
            
            // Refresh Dashboard
            onRefresh();
        } catch (error: any) {
            // If saved code fails (e.g., changed on server), reset it
            const newSaved = { ...savedCodes };
            delete newSaved[account.id.toString()];
            setSavedCodes(newSaved);
            await AsyncStorage.setItem('saved_teacher_codes', JSON.stringify(newSaved));
            
            // Show manual input instead
            setSelectedSwitchAccount(account);
            setSwitchCode('');
            Toast.show({ type: 'info', text1: 'Code Reset', text2: 'Saved code is invalid, please enter it again.' });
        } finally {
            setFetchingAccounts(false);
        }
    };

    const handleSwitchAccount = async () => {
        if (!selectedSwitchAccount || !switchCode) {
            Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter access code' });
            return;
        }

        setFetchingAccounts(true);
        try {
            const response = await axios.post(`${API_ENDPOINTS.AUTH.TEACHER}/verify-code`, {
                teacher_id: selectedSwitchAccount.id,
                access_code: switchCode
            });

            const { token, teacher } = response.data;
            await AsyncStorage.setItem('teacherToken', token);
            await AsyncStorage.setItem('teacherData', JSON.stringify(teacher));

            // Save the code locally for next time
            const newSaved = { ...savedCodes, [selectedSwitchAccount.id.toString()]: switchCode };
            setSavedCodes(newSaved);
            await AsyncStorage.setItem('saved_teacher_codes', JSON.stringify(newSaved));
            
            Toast.show({ type: 'success', text1: 'Switched!', text2: `Logged into ${teacher.institute_name}` });
            setShowAccountModal(false);
            setSelectedSwitchAccount(null);
            setSwitchCode('');
            
            // Refresh Dashboard
            onRefresh();
        } catch (error: any) {
            Toast.show({ 
                type: 'error', 
                text1: 'Error', 
                text2: error.response?.data?.message || 'Invalid access code' 
            });
        } finally {
            setFetchingAccounts(false);
        }
    };

    const fetchTodayAttendance = async (forcedSessionId?: number) => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const data = await AsyncStorage.getItem('teacherData');
            const parsedData = data ? JSON.parse(data) : null;
            const sessionId = forcedSessionId || selectedSessionId || parsedData?.current_session_id;
            if (!sessionId) return;
            const response = await axios.get(`${API_ENDPOINTS.TEACHER_ATTENDANCE}/today`, { headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sessionId?.toString() } });
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
            const response = await axios.get(`${API_ENDPOINTS.TEACHER_DASHBOARD}?date=${today}`, { headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sessionId?.toString() } });
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
            const response = await axios.get(`${API_ENDPOINTS.ROUTINE}/teacher-schedule`, { headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sessionId?.toString() } });
            if (response.data && Array.isArray(response.data)) setSchedule(response.data);
        } catch (error) {}
    };

    const fetchSessions = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const response = await axios.get(API_ENDPOINTS.ACADEMIC_SESSIONS, { headers: { Authorization: `Bearer ${token}` } });
            setSessions(response.data);
            if (!selectedSessionId) {
                const active = response.data.find((s: any) => s.is_active);
                if (active) {
                    setSelectedSessionId(active.id);
                    await AsyncStorage.setItem('selectedSessionId', String(active.id));
                }
            }
        } catch (error) {}
    };

    const [routine, setRoutine] = useState<any>(null);
    const [teachers, setTeachers] = useState<any[]>([]);
    const studentScrollRef = useRef<ScrollView>(null);

    const fetchMyRoutine = async (forcedSessionId?: number) => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const data = await AsyncStorage.getItem('teacherData');
            const parsedData = data ? JSON.parse(data) : null;
            const sessionId = forcedSessionId || selectedSessionId || parsedData?.current_session_id;
            if (!sessionId || !parsedData?.id) return;

            const response = await axios.get(`${API_ENDPOINTS.ROUTINE}/teacher-schedule`, { 
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                } 
            });
            setRoutine(response.data);
        } catch (error) {}
    };

    const fetchTeachers = async (forcedSessionId?: number) => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const data = await AsyncStorage.getItem('teacherData');
            const parsedData = data ? JSON.parse(data) : null;
            const sessionId = forcedSessionId || selectedSessionId || parsedData?.current_session_id;
            if (!sessionId) return;

            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/teacher/list`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            setTeachers(response.data.teachers || []);
        } catch (error) {}
    };

    const onRefresh = async (forcedSessionId?: number) => {
        setRefreshing(true);
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const profileRes = await axios.get(`${API_ENDPOINTS.AUTH.TEACHER}/profile`, { headers: { Authorization: `Bearer ${token}` } });
            const profile = profileRes.data.teacher;
            setTeacherData(profile);
            await AsyncStorage.setItem('teacherData', JSON.stringify(profile));
            await Promise.all([
                fetchSessions(), 
                fetchTodayAttendance(forcedSessionId), 
                fetchDashboardData(forcedSessionId), 
                fetchMyRoutine(forcedSessionId),
                fetchTeachers(forcedSessionId),
                checkSubscription(profile.institute_id)
            ]);
        } catch (error) {} finally {
            setRefreshing(false);
            setLoading(false);
        }
    };

    // Auto-scroll to live slot
    useEffect(() => {
        if (routine && routine.config?.slots) {
            const slots = routine.config.slots || [];
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();

            const parseTime = (t: string) => {
                if (!t) return 0;
                const [time, modifier] = t.split(' ');
                let [hours, minutes] = time.split(':').map(Number);
                if (modifier === 'PM' && hours < 12) hours += 12;
                if (modifier === 'AM' && hours === 12) hours = 0;
                return hours * 60 + minutes;
            };

            const liveIndex = slots.findIndex((slot: any) => {
                const start = parseTime(slot.startTime);
                const end = parseTime(slot.endTime);
                return currentTime >= start && currentTime <= end;
            });

            if (liveIndex !== -1) {
                setTimeout(() => {
                    studentScrollRef.current?.scrollTo({
                        x: liveIndex * (140 + 12), 
                        animated: true
                    });
                }, 1000);
            }
        }
    }, [routine]);

    useFocusEffect(useCallback(() => { onRefresh(); }, [selectedSessionId]));
    useEffect(() => { loadInitialData(); }, []);

    const onMomentumScrollEnd = (e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setActiveSlide(index);
    };

    const flashcardData = useMemo(() => {
        const baseGreeting = { type: 'greeting', data: getGreetingAndQuote() };
        
        if (teacherData?.special_permission) {
            return [
                baseGreeting,
                { type: 'student', data: flashcards?.student_attendance },
                { type: 'attendance_merged', data: { self: todayAttendance, stats: flashcards?.teacher_attendance } },
                { type: 'revenue', data: flashcards?.revenue }
            ];
        }
        
        let data: any[] = [];
        if (flashcards?.today_events && flashcards.today_events.length > 0) data.push({ type: 'event', data: flashcards.today_events[0] });
        if (data.length === 0) data.push(baseGreeting);
        
        data.push(
            { type: 'student', data: flashcards?.student_attendance }, 
            { type: 'attendance_merged', data: { self: todayAttendance, stats: flashcards?.teacher_attendance } }, 
            { type: 'homework', data: flashcards?.my_homework || { todayClassCount: 0 } }
        );
        return data;
    }, [flashcards, todayAttendance, teacherData?.special_permission]);

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (flashcardData.length <= 1) return;
        timerRef.current = setInterval(() => {
            if (!isInteracting.current && flashcardData.length > 1) {
                const next = (activeSlide + 1) % flashcardData.length;
                flatListRef.current?.scrollToIndex({ index: next, animated: true });
                setActiveSlide(next);
            }
        }, 5000);
    };

    useEffect(() => { if (flashcardData.length > 1) startTimer(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [flashcardData, activeSlide]);

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
        } catch (error) {} finally { setMarkingAttendance(false); }
    };

    const renderFlashcardItem = ({ item }: any) => {
        let gradientColors = GRADIENTS.student;
        let iconName: any = 'people';
        let title = 'Student Attendance';
        let mainText = ''; let bottomText = ''; let extraContent = null; let isInteractive = false;
        
        const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const dateDayStr = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
        const fullDateTimeStr = `${dateDayStr} | ${timeStr}`;

        if (item.type === 'student') { 
            mainText = `${item.data?.total_present || 0} / ${item.data?.total_students || 0}`; 
            bottomText = teacherData?.special_permission ? fullDateTimeStr : (item.data?.pending_count === 0 ? 'Present Today' : `In Progress (${item.data?.pending_count || 0} left)`); 
        }
        else if (item.type === 'attendance_merged') {
            const marked = !!item.data.self; const selfStatus = item.data.self?.status;
            const markedTime = item.data.self?.marked_at ? new Date(item.data.self.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
            
            if (marked) {
                gradientColors = GRADIENTS.teacher; iconName = 'school';
                if (teacherData?.special_permission) { 
                    title = 'Attendance'; 
                    mainText = `${item.data.stats?.present || 0} / ${item.data.stats?.total || 0}`; 
                    bottomText = fullDateTimeStr; 
                }
                else { 
                    title = 'Attendance'; 
                    mainText = `${selfStatus?.toUpperCase()}${markedTime ? ' at ' + markedTime : ''}`; 
                    bottomText = `Marked on ${dateDayStr}`; 
                }
                extraContent = (<View style={styles.cardActionOverlay}><Text style={styles.cardStatusText}>MY STATUS: {selfStatus?.toUpperCase()} {markedTime && '@ ' + markedTime}</Text><TouchableOpacity onPress={() => handleMarkSelfAttendance(selfStatus === 'present' ? 'absent' : 'present')} style={styles.cardUpdateBtn}><Text style={styles.cardUpdateBtnText}>CHANGE</Text></TouchableOpacity></View>);
            } else {
                gradientColors = ['#00b09b', '#96c93d']; iconName = 'checkmark-circle'; title = 'Attendance'; isInteractive = true; mainText = 'NOT MARKED'; bottomText = fullDateTimeStr;
                extraContent = (<View style={styles.markingButtons}><TouchableOpacity style={styles.mBtnPresent} onPress={() => handleMarkSelfAttendance('present')}><Text style={styles.mBtnTextPresent}>PRESENT</Text></TouchableOpacity><TouchableOpacity style={styles.mBtnAbsent} onPress={() => setAbsentReasonModalVisible(true)}><Text style={styles.mBtnTextAbsent}>ABSENT</Text></TouchableOpacity></View>);
            }
        }
        else if (item.type === 'homework') { gradientColors = GRADIENTS.homework; iconName = 'book'; title = 'Homework Stats'; const classCount = item.data?.todayClassCount || 0; mainText = `${classCount} Class${classCount === 1 ? '' : 'es'}`; bottomText = classCount > 0 ? `Added homework in ${classCount} classes today` : 'No homework assigned'; }
        else if (item.type === 'greeting') { 
            title = item.data.greeting; 
            mainText = timeStr; 
            bottomText = dateDayStr; 
            gradientColors = (GRADIENTS as any)[item.data.type]; 
            iconName = item.data.greeting === 'Good Night' ? 'moon' : (item.data.type === 'morning' ? 'sunny' : item.data.type === 'afternoon' ? 'partly-sunny' : 'moon'); 
        }
        else if (item.type === 'revenue') {
            title = 'Daily Revenue';
            iconName = 'cash';
            gradientColors = GRADIENTS.revenue;
            mainText = `₹${(item.data?.daily_total || 0).toLocaleString('en-IN')}`;
            bottomText = fullDateTimeStr;
        }
        else if (item.type === 'event') { title = "Institute Event"; mainText = item.data.title; bottomText = item.data.description || "Check calendar"; gradientColors = GRADIENTS.event; iconName = 'star'; }

        return (
            <TouchableOpacity 
                activeOpacity={isInteractive ? 1 : 0.95} 
                onPress={() => { 
                    if (isLocked && item.type !== 'greeting' && item.type !== 'event') return; 
                    if (item.type === 'student') {
                        router.push({ pathname: '/(teacher)/stats', params: { initialTab: 'students' } });
                    } else if (item.type === 'attendance_merged') {
                        router.push({ pathname: '/(teacher)/stats', params: { initialTab: 'teachers' } });
                    } else if (item.type === 'revenue') {
                        router.push({ pathname: '/(teacher)/stats', params: { initialTab: 'revenue' } });
                    } else if (item.type === 'homework') {
                        router.push('/(teacher)/homework');
                    } else if (item.type === 'event') {
                        router.push('/(teacher)/academic-calendar');
                    }
                }} 
                style={[styles.cardContainer, isLocked && item.type !== 'greeting' && item.type !== 'event' && { opacity: 0.6 }]}
            >
                <LinearGradient colors={gradientColors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient}>
                    <View style={styles.cardHeader}>
                        <View>
                            {item.type !== 'attendance_merged' ? (
                                <>
                                    <Text style={styles.cardTitle}>{title}</Text>
                                    <Text style={styles.cardSub}>{item.type === 'greeting' ? 'Institute Connect' : dateDayStr}</Text>
                                </>
                            ) : (
                                <View style={{ height: 10 }} />
                            )}
                        </View>
                        <View style={styles.cardIconBg}><Ionicons name={isLocked && item.type !== 'greeting' && item.type !== 'event' ? "lock-closed" : iconName} size={22} color="#fff" /></View>
                    </View>
                    <View style={item.type === 'attendance_merged' ? { marginTop: -20 } : null}>
                        <View><Text style={{ fontSize: item.type === 'greeting' || item.type === 'revenue' ? 36 : 28, fontWeight: '900', color: '#fff' }} numberOfLines={2}>{mainText}</Text><Text style={styles.cardBottomText}>{bottomText}</Text>{extraContent}</View>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const actions = useMemo(() => {
        const allActions = [
            { title: 'Routine', icon: 'calendar', color: '#0288D1', bgDark: '#1A2A33', bgLight: '#E1F5FE', path: '/(teacher)/routine' },
            { title: 'Stats', icon: 'stats-chart', color: '#27AE60', bgDark: '#1B2C1B', bgLight: '#E8F5E9', path: '/(teacher)/stats' },
            { title: 'Notice', icon: 'notifications-outline', color: '#E91E63', bgDark: '#3E1A23', bgLight: '#FCE4EC', path: '/(teacher)/notice' },
            { title: 'My Attendance', icon: 'calendar-clear-outline', color: '#00897B', bgDark: '#00332dff', bgLight: '#E0F2F1', path: '/(teacher)/attendance/my-attendance' },
            { title: 'Attendance', icon: 'checkmark-done', color: '#9C27B0', bgDark: '#2E1A47', bgLight: '#F3E5F5', path: '/(teacher)/attendance' },
            { title: 'Students', icon: 'school', color: '#3498DB', bgDark: '#1B263B', bgLight: '#E3F2FD', path: '/(teacher)/students' },
            { title: 'Add Student', icon: 'person-add', color: '#27AE60', bgDark: '#1B2C1B', bgLight: '#E8F5E9', path: '/(teacher)/add-student' },
            { title: 'Promotion', icon: 'trending-up-outline', color: '#6366f1', bgDark: '#1B1B2C', bgLight: '#EEF2FF', path: '/(teacher)/promotion' },
            { title: 'Homework', icon: 'book', color: '#F39C12', bgDark: '#3D2B1B', bgLight: '#FFF3E0', path: '/(teacher)/homework' },
            { title: 'Fees', icon: 'currency-inr', iconType: 'material', color: '#10b981', bgDark: '#1B2C1B', bgLight: '#E8F5E9', path: '/(teacher)/fees', restricted: true },
            { title: 'Transport', icon: 'bus-outline', color: '#06b6d4', bgDark: '#1B2E33', bgLight: '#E0F7FA', path: '/(teacher)/transport' },
            { title: 'ID Card', icon: 'person-circle-outline', color: '#009688', bgDark: '#1B2E2A', bgLight: '#E0F2F1', path: '/(teacher)/id-card' },
            { title: 'Admit Card', icon: 'card-outline', color: '#6366f1', bgDark: '#2D1B36', bgLight: '#F3E5F5', path: '/(teacher)/admit-card' },
            { title: 'Result', icon: 'document-text-outline', color: '#8E44AD', bgDark: '#2D1B36', bgLight: '#F3E5F5', path: '/(teacher)/results' },
            { title: 'Academic Calendar', icon: 'calendar-number-outline', color: '#795548', bgDark: '#3E2723', bgLight: '#FFF3E0', path: '/(teacher)/academic-calendar' },
        ];
        return allActions.filter(a => !a.restricted || teacherData?.special_permission);
    }, [teacherData, isDark]);

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: { paddingTop: insets.top, paddingBottom: 5, paddingRight: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
        headerLogo: { width: 140, height: 50 },
        headerRight: { flexDirection: 'row', alignItems: 'center' },
        avatarWrapper: { marginLeft: 12, position: 'relative' },
        headerAvatar: { width: 44, height: 44, borderRadius: 22 },
        placeholderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
        avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
        onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: theme.success, borderWidth: 2, borderColor: theme.card },
        notificationBar: { flex: 1, height: 52, backgroundColor: theme.card, borderRadius: 16, marginRight: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border, elevation: 4 },
        notifIconCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f59e0b', justifyContent: 'center', alignItems: 'center' },
        notifTitle: { fontSize: 10, fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase' },
        notifText: { fontSize: 13, fontWeight: '600', color: theme.text, marginTop: 1 },
        notifBadgeRed: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#fff' },
        gradientIconBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 6 },
        content: { flex: 1 },
        cardContainer: { width: SCREEN_WIDTH - 30, height: 170, marginHorizontal: 15, borderRadius: 24, elevation: 8 },
        cardGradient: { flex: 1, borderRadius: 24, padding: 20, justifyContent: 'space-between' },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
        cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
        cardSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '600' },
        cardIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
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
        routineSection: { padding: 20, paddingBottom: 10 },
        sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 },
        sectionTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        viewWeeklyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary + '15', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
        viewWeeklyText: { fontSize: 12, fontWeight: 'bold', color: theme.primary, marginRight: 4 },
        actionsContainer: { padding: 15 },
        actionsBox: { borderWidth: 1, borderColor: theme.border, borderRadius: 22, paddingTop: 20, paddingBottom: 25, backgroundColor: theme.card, position: 'relative', marginBottom: 25, flexDirection: 'row', flexWrap: 'wrap' },
        actionCard: { width: '33.33%', alignItems: 'center', marginBottom: 15 },
        actionIconCircle: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
        actionText: { fontSize: 11, fontWeight: '700', color: theme.text, textAlign: 'center' },
        expandButton: { position: 'absolute', bottom: -15, left: '50%', marginLeft: -15, width: 30, height: 30, borderRadius: 15, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', zIndex: 10, elevation: 3 },
        notifDropdown: { backgroundColor: theme.card, borderRadius: 24, padding: 20, elevation: 10, borderWidth: 1, borderColor: theme.border },
        notifDropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
        notifDropdownTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
        notifItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border + '40' },
        notifItemDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
        notifItemTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
        notifItemMsg: { fontSize: 12, color: theme.textLight, marginTop: 2 },
        notifItemTime: { fontSize: 10, color: theme.textLight, marginLeft: 10, fontWeight: '600' },
        animatedSearchBar: { position: 'absolute', top: insets.top + 70, right: 20, height: 52, backgroundColor: theme.card, borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, zIndex: 100, borderWidth: 1, borderColor: theme.border, elevation: 10 },
        searchInput: { flex: 1, fontSize: 15, color: theme.text, marginLeft: 10 },
        resultsContainer: { position: 'absolute', top: insets.top + 70, left: 20, right: 20, backgroundColor: theme.card, borderRadius: 15, maxHeight: 350, zIndex: 1000, borderWidth: 1, borderColor: theme.border, elevation: 10 },
        resultItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border },
        resultAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.background, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
        avatarImg: { width: 44, height: 44, borderRadius: 22 },
        resultName: { fontSize: 16, fontWeight: '700', color: theme.text },
        resultInfo: { fontSize: 13, color: theme.textLight },
        typeBadge: { marginLeft: 'auto', fontSize: 10, color: '#fff', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, fontWeight: 'bold' },
        noResults: { padding: 25, textAlign: 'center', color: theme.textLight },
    }), [theme, insets, isDark, flashcardData.length, activeSlide]);

    if (loading && !teacherData) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}><ActivityIndicator size="large" color={theme.primary} /></View>;

    return (
        <TouchableWithoutFeedback onPress={() => { dismissSearch(); Keyboard.dismiss(); }}>
            <View style={styles.container}>
                <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setShowAccountModal(true)} style={{ marginLeft: -20 }}><View style={{ position: 'relative' }}><Image source={teacherData?.institute_logo ? { uri: teacherData.institute_logo } : require('../../assets/images/react-logo.png')} style={styles.headerLogo} resizeMode="contain" /></View></TouchableOpacity>
                    <View style={styles.headerRight}><TouchableOpacity onPress={() => !isLocked && setShowProfileMenu(true)} style={[styles.avatarWrapper, isLocked && { opacity: 0.7 }]} activeOpacity={isLocked ? 1 : 0.7}><View style={{ position: 'relative' }}>{teacherData?.photo_url ? <Image source={{ uri: teacherData.photo_url }} style={styles.headerAvatar} /> : <View style={[styles.placeholderAvatar, { backgroundColor: theme.primary }]}><Text style={styles.avatarText}>{teacherData?.name?.charAt(0) || 'T'}</Text></View>}{isLocked ? (<View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.danger, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.background }}><Ionicons name="lock-closed" size={10} color="#fff" /></View>) : (<View style={styles.onlineDot} />)}</View></TouchableOpacity></View>
                </View>

                {isSearchActive && <Animated.View style={[styles.animatedSearchBar, animatedSearchStyle]}><Ionicons name="search" size={20} color={theme.textLight} /><TextInput style={styles.searchInput} placeholder="Search Students..." placeholderTextColor={theme.textLight} value={searchQuery} onChangeText={handleSearch} autoFocus /><TouchableOpacity onPress={toggleSearch}><Ionicons name="close-circle" size={20} color={theme.textLight} /></TouchableOpacity></Animated.View>}

                <View style={{ position: 'relative', marginTop: 10, marginHorizontal: 20, zIndex: 90, flexDirection: 'row', alignItems: 'center', opacity: isSearchActive ? 0 : 1 }}>
                    <TouchableOpacity style={[styles.notificationBar]} activeOpacity={isLocked ? 1 : 0.9} onPress={() => !isLocked && notifications.length > 0 && setShowNotifList(true)}><View style={[styles.notifIconCircle, notifications.length === 0 && { backgroundColor: '#6366f1' }]}><Ionicons name="notifications" size={18} color="#fff" />{notifications.length > 0 && <View style={styles.notifBadgeRed} />}</View><View style={{ flex: 1, marginLeft: 12 }}><Text style={[styles.notifTitle, notifications.length === 0 && { color: theme.textLight }]}>{notifications.length > 0 ? `${notifications.length} New Updates` : 'No updates'}</Text><Text style={styles.notifText} numberOfLines={1}>{notifications.length > 0 ? notifications[0].message : 'Everything caught up'}</Text></View><Ionicons name={notifications.length > 0 ? "chevron-down" : "chevron-forward"} size={16} color={theme.textLight} /></TouchableOpacity>
                    <TouchableOpacity onPress={toggleSearch} activeOpacity={0.7} style={{ marginLeft: 10 }}><LinearGradient colors={['#3b82f6', '#8b5cf6', '#ec4899']} style={[styles.gradientIconBtn]}><Ionicons name="search" size={22} color="#fff" /></LinearGradient></TouchableOpacity>
                </View>

                {showResults && <View style={styles.resultsContainer}>{searchResults.length === 0 ? <Text style={styles.noResults}>{isSearching ? 'Searching...' : 'No students found'}</Text> : <FlatList data={searchResults} keyExtractor={(item, index) => item.id.toString() + index} renderItem={({ item }) => <TouchableOpacity style={styles.resultItem} onPress={() => handleCreateResult(item)}><View style={styles.resultAvatar}>{item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.avatarImg} /> : <Ionicons name="person" size={20} color={theme.textLight} />}</View><View><Text style={styles.resultName}>{item.name}</Text><Text style={styles.resultInfo}>{`Class: ${item.class}-${item.section}`}</Text></View><Text style={[styles.typeBadge, { backgroundColor: theme.primary }]}>STUDENT</Text></TouchableOpacity>} />}</View>}

                <ScrollView 
                    style={styles.content} 
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} 
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
                >
                <View style={{ width: SCREEN_WIDTH, height: 205, marginTop: 15, marginBottom: 5 }}>
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
                        style={{ flex: 1 }} 
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 15 }}>
                        {flashcardData.map((_, idx) => (
                            <View 
                                key={idx} 
                                style={{ 
                                    width: activeSlide === idx ? 20 : 8, 
                                    height: 8, 
                                    borderRadius: 4, 
                                    backgroundColor: activeSlide === idx ? theme.primary : theme.border, 
                                    marginHorizontal: 4 
                                }} 
                            />
                        ))}
                    </View>
                </View>

                {/* Today's Schedule - Compact Premium Redesign */}
                <View style={{ marginTop: 15 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
                        <View>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text }}>Today's Schedule</Text>
                            <View style={{ height: 3, width: 20, backgroundColor: theme.primary, borderRadius: 2, marginTop: 4 }} />
                        </View>
                        <TouchableOpacity 
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }} 
                            onPress={() => setIsWeeklyModalOpen(true)}
                        >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: theme.textLight, marginRight: 4 }}>WEEKLY</Text>
                            <Ionicons name="calendar-outline" size={12} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        ref={studentScrollRef}
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        contentContainerStyle={{ paddingLeft: 20, paddingRight: 20, paddingVertical: 5 }}
                    >
                        {(() => {
                            if (!routine || !Array.isArray(routine) || routine.length === 0) {
                                return (
                                    <View style={{ width: SCREEN_WIDTH - 40, height: 80, backgroundColor: theme.card, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed' }}>
                                        <Text style={{ color: theme.textLight, fontSize: 13, fontWeight: '600' }}>No routine found for today</Text>
                                    </View>
                                );
                            }

                            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const todayName = days[new Date().getDay()];
                            const todayData = routine.filter((item: any) => item.day === todayName).sort((a, b) => a.startTime.localeCompare(b.startTime));

                            if (todayData.length === 0) {
                                return (
                                    <View style={{ width: SCREEN_WIDTH - 40, height: 80, backgroundColor: theme.card, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed' }}>
                                        <Text style={{ color: theme.textLight, fontSize: 13, fontWeight: '600' }}>You're free today! ☕</Text>
                                    </View>
                                );
                            }

                            return todayData.map((item: any, pIdx: number) => {
                                const now = new Date();
                                const currentTime = now.getHours() * 60 + now.getMinutes();
                                const parseTime = (t: string) => {
                                    if (!t) return 0;
                                    const [hours, minutes] = t.split(':').map(Number);
                                    return hours * 60 + minutes;
                                };
                                const start = parseTime(item.startTime);
                                const end = parseTime(item.endTime);
                                const isLive = currentTime >= start && currentTime <= end;

                                // Stunning Premium Blended Gradients
                                const PREMIUM_GRADIENTS = [
                                    ['#4158D0', '#C850C0', '#FFCC70'], // Cosmic Fusion
                                    ['#0093E9', '#80D0C7'],             // Deep Ocean
                                    ['#8EC5FC', '#E0C3FC'],             // Lavender Sky
                                    ['#FBAB7E', '#F7CE68'],             // Sunset Glow
                                    ['#85FFBD', '#FFFB7D'],             // Fresh Mint
                                    ['#21D4FD', '#B721FF'],             // Electric Violet
                                    ['#08AEEA', '#2AF598'],             // Arctic Cyan
                                ];
                                
                                const gradient = PREMIUM_GRADIENTS[pIdx % PREMIUM_GRADIENTS.length];

                                return (
                                    <TouchableOpacity 
                                        key={pIdx} 
                                        activeOpacity={0.95}
                                        style={{ 
                                            width: 175, 
                                            height: 120, 
                                            marginRight: 16, 
                                            borderRadius: 28, 
                                            elevation: isLive ? 15 : 5,
                                            shadowColor: gradient[0],
                                            shadowOpacity: isLive ? 0.7 : 0.2,
                                            shadowRadius: 15,
                                            shadowOffset: { width: 0, height: 8 },
                                        }}
                                    >
                                        <LinearGradient
                                            colors={gradient}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={{ 
                                                flex: 1, 
                                                borderRadius: 28, 
                                                padding: 18,
                                                borderWidth: isLive ? 2.5 : 0,
                                                borderColor: 'rgba(255,255,255,0.7)',
                                                justifyContent: 'space-between',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {/* Advanced Decorative Elements (Glassmorphism) */}
                                            <View style={{ 
                                                position: 'absolute', 
                                                right: -25, 
                                                top: -25, 
                                                width: 90, 
                                                height: 90, 
                                                borderRadius: 45, 
                                                backgroundColor: 'rgba(255,255,255,0.2)', 
                                                zIndex: 0 
                                            }} />
                                            
                                            <View style={{ 
                                                position: 'absolute', 
                                                left: -30, 
                                                bottom: -30, 
                                                width: 80, 
                                                height: 80, 
                                                borderRadius: 40, 
                                                backgroundColor: 'rgba(0,0,0,0.08)', 
                                                zIndex: 0 
                                            }} />

                                            <View style={{ zIndex: 1 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                    <View style={{ 
                                                        flexDirection: 'row', 
                                                        alignItems: 'center', 
                                                        backgroundColor: 'rgba(255,255,255,0.28)',
                                                        paddingHorizontal: 10,
                                                        paddingVertical: 5,
                                                        borderRadius: 12
                                                    }}>
                                                        <Ionicons 
                                                            name="time" 
                                                            size={13} 
                                                            color="#fff" 
                                                        />
                                                        <Text style={{ 
                                                            fontSize: 10.5, 
                                                            fontWeight: '900', 
                                                            color: '#fff',
                                                            marginLeft: 5,
                                                            letterSpacing: 0.2
                                                        }}>
                                                            {item.startTime} - {item.endTime}
                                                        </Text>
                                                    </View>
                                                    
                                                    {isLive && <LiveBadge />}
                                                </View>
                                                
                                                <Text style={{ 
                                                    fontSize: 19, 
                                                    fontWeight: '900', 
                                                    color: '#fff',
                                                    letterSpacing: -0.6,
                                                    textShadowColor: 'rgba(0,0,0,0.15)',
                                                    textShadowOffset: { width: 0, height: 1.5 },
                                                    textShadowRadius: 3
                                                }} numberOfLines={1}>
                                                    {item.subject}
                                                </Text>
                                            </View>

                                            <View style={{ 
                                                flexDirection: 'row', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between',
                                                zIndex: 1,
                                                marginTop: 4
                                            }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={{ 
                                                        width: 28, 
                                                        height: 28, 
                                                        borderRadius: 10, 
                                                        backgroundColor: 'rgba(255,255,255,0.3)', 
                                                        justifyContent: 'center', 
                                                        alignItems: 'center',
                                                        marginRight: 10
                                                    }}>
                                                        <Ionicons name="school" size={14} color="#fff" />
                                                    </View>
                                                    <Text style={{ 
                                                        fontSize: 14, 
                                                        fontWeight: '800', 
                                                        color: 'rgba(255,255,255,0.95)',
                                                        letterSpacing: -0.2
                                                    }}>
                                                        {item.className}-{item.section}
                                                    </Text>
                                                </View>
                                                
                                                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 4, borderRadius: 10 }}>
                                                    <Ionicons name="chevron-forward" size={16} color="#fff" />
                                                </View>
                                            </View>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                );
                            });
                        })()}
                    </ScrollView>
                </View>

                <View style={styles.actionsContainer}>
                    <View style={styles.actionsBox}>
                        {actions.map((action, index) => (
                            <TouchableOpacity 
                                key={index} 
                                style={styles.actionCard} 
                                onPress={() => router.push(action.path as any)}
                            >
                                <View style={[styles.actionIconCircle, { backgroundColor: isDark ? action.bgDark : action.bgLight }]}>
                                    {(action as any).iconType === 'material' ? (
                                        <MaterialCommunityIcons name={action.icon as any} size={24} color={action.color} />
                                    ) : (
                                        <Ionicons name={action.icon as any} size={24} color={action.color} />
                                    )}
                                </View>
                                <Text style={styles.actionText}>{action.title}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>

            <Modal visible={showNotifList} transparent={true} animationType="fade" onRequestClose={() => setShowNotifList(false)}><TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', paddingTop: insets.top + 70, paddingHorizontal: 20 }} activeOpacity={1} onPress={() => setShowNotifList(false)}><View style={styles.notifDropdown}><View style={styles.notifDropdownHeader}><Text style={styles.notifDropdownTitle}>Recent Updates</Text><TouchableOpacity onPress={() => setNotifications([])}><Text style={{ color: theme.danger, fontWeight: '700' }}>Clear All</Text></TouchableOpacity></View><ScrollView style={{ MAX_HEIGHT: 400 }} showsVerticalScrollIndicator={false}>{notifications.length === 0 ? <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: theme.textLight }}>No recent updates</Text></View> : notifications.map((item) => <View key={item.id} style={styles.notifItem}><View style={[styles.notifItemDot, { backgroundColor: item.type === 'fees' ? '#10b981' : item.type === 'request' ? '#f59e0b' : theme.primary }]} /><View style={{ flex: 1 }}><Text style={styles.notifItemTitle}>{item.title}</Text><Text style={styles.notifItemMsg}>{item.message}</Text></View><Text style={styles.notifItemTime}>{item.time}</Text></View>)}</ScrollView></View></TouchableOpacity></Modal>

            {/* PROFILE MENU MODAL */}
            <Modal
                visible={showProfileMenu}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowProfileMenu(false)}
            >
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', alignItems: 'flex-end' }}
                    activeOpacity={1}
                    onPress={() => setShowProfileMenu(false)}
                >
                    <View style={{ marginTop: insets.top + 60, marginRight: 20, width: 280, backgroundColor: theme.card, borderRadius: 24, padding: 20, elevation: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                            {teacherData?.photo_url ? (
                                <Image source={{ uri: teacherData.photo_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                            ) : (
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>{teacherData?.name?.charAt(0) || 'T'}</Text>
                                </View>
                            )}
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>{teacherData?.name}</Text>
                                <Text style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>{teacherData?.institute_name}</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => { setShowProfileMenu(false); router.push('/(teacher)/profile'); }}>
                            <Ionicons name="person-outline" size={20} color={theme.text} />
                            <Text style={{ fontSize: 16, color: theme.text, marginLeft: 12 }}>My Profile</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => setShowSessionPicker(!showSessionPicker)}>
                            <Ionicons name="calendar-outline" size={20} color={theme.text} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, color: theme.text, marginLeft: 12 }}>Academic Session</Text>
                                <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '700', marginLeft: 12 }}>
                                    {sessions.find(s => s.id === selectedSessionId)?.name || 'Select Session'}
                                </Text>
                            </View>
                            <Ionicons name={showSessionPicker ? "chevron-up" : "chevron-down"} size={16} color={theme.textLight} />
                        </TouchableOpacity>

                        {showSessionPicker && (
                            <View style={{ backgroundColor: isDark ? '#1a1a1a' : '#f9f9f9', marginVertical: 10, borderRadius: 12, padding: 10 }}>
                                {sessions.map((session) => (
                                    <TouchableOpacity 
                                        key={session.id} 
                                        style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                        onPress={() => {
                                            AsyncStorage.setItem('selectedSessionId', String(session.id));
                                            setSelectedSessionId(session.id);
                                            setShowSessionPicker(false);
                                            setShowProfileMenu(false);
                                            Toast.show({
                                                type: 'success',
                                                text1: 'Session Switched',
                                                text2: `Viewing data for ${session.name}`
                                            });
                                            onRefresh(session.id);
                                        }}
                                    >
                                        <Text style={[{ fontSize: 14, color: theme.text }, session.id === selectedSessionId && { color: theme.primary, fontWeight: '800' }]}>
                                            {session.name}
                                        </Text>
                                        {session.id === selectedSessionId && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={() => toggleTheme()}>
                            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={theme.text} />
                            <Text style={{ fontSize: 16, color: theme.text, marginLeft: 12 }}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
                            <View style={{ flex: 1 }} />
                            <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: isDark ? theme.primary : '#ddd', padding: 2 }}>
                                <View style={[{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }, isDark && { alignSelf: 'flex-end' }]} />
                            </View>
                        </TouchableOpacity>

                        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 10 }} />

                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} onPress={async () => {
                            await AsyncStorage.removeItem('teacherToken');
                            await AsyncStorage.removeItem('teacherData');
                            await AsyncStorage.removeItem('saved_teacher_codes');
                            router.replace('/(auth)/teacher-login');
                        }}>
                            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
                            <Text style={{ fontSize: 16, color: theme.danger, marginLeft: 12, fontWeight: '700' }}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* PROFESSIONAL WEEKLY FLOW MODAL */}
            <Modal
                visible={isWeeklyModalOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsWeeklyModalOpen(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableOpacity 
                        style={StyleSheet.absoluteFill} 
                        activeOpacity={1} 
                        onPress={() => setIsWeeklyModalOpen(false)} 
                    />
                    
                    <View 
                        style={{ 
                            width: SCREEN_WIDTH * 0.95, 
                            height: SCREEN_HEIGHT * 0.8, 
                            backgroundColor: theme.card, 
                            borderRadius: 40, 
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: theme.border,
                            elevation: 25
                        }}
                    >
                        {/* Header Area */}
                        <View style={{ padding: 24, paddingBottom: 15 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <View>
                                    <Text style={{ fontSize: 24, fontWeight: '900', color: theme.text }}>Weekly Flow</Text>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.primary, textTransform: 'uppercase', marginTop: 2 }}>Academic Schedule</Text>
                                </View>
                                <TouchableOpacity 
                                    onPress={() => setIsWeeklyModalOpen(false)}
                                    style={{ 
                                        width: 44, 
                                        height: 44, 
                                        borderRadius: 22, 
                                        backgroundColor: isDark ? '#333' : '#f0f0f0', 
                                        justifyContent: 'center', 
                                        alignItems: 'center' 
                                    }}
                                >
                                    <Ionicons name="close" size={24} color={theme.text} />
                                </TouchableOpacity>
                            </View>

                            {/* Professional Day Selector Strip */}
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 10, paddingRight: 20 }}
                            >
                                {DAYS.map((day, index) => {
                                    const isActive = activeWeeklyDay === day;
                                    const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
                                    
                                    return (
                                        <TouchableOpacity 
                                            key={day}
                                            onPress={() => {
                                                setActiveWeeklyDay(day);
                                                weekPagerRef.current?.scrollToIndex({ index, animated: true });
                                            }}
                                            style={{
                                                paddingHorizontal: 18,
                                                paddingVertical: 10,
                                                borderRadius: 20,
                                                backgroundColor: isActive ? theme.primary : (isDark ? '#1a1a1a' : '#f5f5f5'),
                                                borderWidth: 1,
                                                borderColor: isActive ? theme.primary : (isToday ? theme.primary + '40' : theme.border),
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 6
                                            }}
                                        >
                                            {isToday && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isActive ? '#fff' : theme.primary }} />}
                                            <Text style={{ 
                                                fontSize: 13, 
                                                fontWeight: '800', 
                                                color: isActive ? '#fff' : (isToday ? theme.primary : theme.textLight)
                                            }}>
                                                {day.substring(0, 3).toUpperCase()}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* Content Area - Horizontal Pager */}
                        <View style={{ flex: 1, backgroundColor: isDark ? '#0a0a0a' : '#fcfcfc' }}>
                            {!routine || !Array.isArray(routine) || routine.length === 0 ? (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                                    <Ionicons name="calendar-clear-outline" size={60} color={theme.border} />
                                    <Text style={{ color: theme.textLight, marginTop: 15, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>No schedule data found</Text>
                                </View>
                            ) : (
                                <FlatList
                                    ref={weekPagerRef as any}
                                    data={DAYS}
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    keyExtractor={(item) => item}
                                    onMomentumScrollEnd={(e) => {
                                        const index = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH * 0.95));
                                        setActiveWeeklyDay(DAYS[index]);
                                    }}
                                    getItemLayout={(data, index) => ({
                                        length: SCREEN_WIDTH * 0.95,
                                        offset: SCREEN_WIDTH * 0.95 * index,
                                        index,
                                    })}
                                    renderItem={({ item: day }) => {
                                        const dayData = routine.filter((item: any) => item.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
                                        
                                        return (
                                            <View style={{ width: SCREEN_WIDTH * 0.95 }}>
                                                {dayData.length === 0 ? (
                                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}>
                                                            <Ionicons name="cafe-outline" size={40} color={theme.primary} />
                                                        </View>
                                                        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>No Lectures</Text>
                                                        <Text style={{ color: theme.textLight, fontSize: 14, fontWeight: '600', marginTop: 5 }}>Enjoy your free day!</Text>
                                                    </View>
                                                ) : (
                                                    <ScrollView 
                                                        showsVerticalScrollIndicator={false}
                                                        contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
                                                        scrollEventThrottle={1}
                                                        keyboardShouldPersistTaps="handled"
                                                        nestedScrollEnabled={true}
                                                    >
                                                        {dayData.map((item: any, idx: number) => {
                                                            const isLast = idx === dayData.length - 1;
                                                            return (
                                                                <View key={idx} style={{ flexDirection: 'row', minHeight: 100 }}>
                                                                    {/* Timeline Sidebar */}
                                                                    <View style={{ alignItems: 'center', width: 60, marginRight: 15 }}>
                                                                        <View style={{ 
                                                                            width: 14, 
                                                                            height: 14, 
                                                                            borderRadius: 7, 
                                                                            backgroundColor: theme.primary,
                                                                            borderWidth: 3,
                                                                            borderColor: theme.card,
                                                                            zIndex: 2,
                                                                            elevation: 2
                                                                        }} />
                                                                        {!isLast && <View style={{ flex: 1, width: 2, backgroundColor: theme.primary + '30', marginVertical: 2 }} />}
                                                                    </View>

                                                                    {/* Lecture Content Card */}
                                                                    <View style={{ flex: 1, paddingBottom: 25 }}>
                                                                        <View style={{ 
                                                                            backgroundColor: theme.card, 
                                                                            borderRadius: 24, 
                                                                            padding: 20, 
                                                                            borderWidth: 1, 
                                                                            borderColor: theme.border,
                                                                            shadowColor: '#000',
                                                                            shadowOffset: { width: 0, height: 4 },
                                                                            shadowOpacity: 0.05,
                                                                            shadowRadius: 10,
                                                                            elevation: 2
                                                                        }}>
                                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                                                                                <Ionicons name="time" size={14} color={theme.primary} />
                                                                                <Text style={{ fontSize: 12, fontWeight: '900', color: theme.primary, letterSpacing: 0.5 }}>
                                                                                    {item.startTime} - {item.endTime}
                                                                                </Text>
                                                                            </View>
                                                                            
                                                                            <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text, marginBottom: 8 }}>{item.subject}</Text>
                                                                            
                                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                                                <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderSize: 1, borderColor: theme.primary + '20' }}>
                                                                                    <Text style={{ fontSize: 11, fontWeight: '800', color: theme.primary }}>CLASS {item.className}-{item.section}</Text>
                                                                                </View>
                                                                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
                                                                                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.textLight }}>Session Period</Text>
                                                                            </View>
                                                                        </View>
                                                                    </View>
                                                                </View>
                                                            );
                                                        })}
                                                    </ScrollView>
                                                )}
                                            </View>
                                        );
                                    }}
                                />
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ACCOUNT SWITCHING MODAL */}
            <Modal
                visible={showAccountModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => { setShowAccountModal(false); setSelectedSwitchAccount(null); setSwitchCode(''); }}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                        <TouchableOpacity 
                            style={StyleSheet.absoluteFill} 
                            activeOpacity={1} 
                            onPress={() => { setShowAccountModal(false); setSelectedSwitchAccount(null); setSwitchCode(''); }} 
                        />
                        <View style={{ 
                            backgroundColor: theme.card, 
                            borderTopLeftRadius: 35, 
                            borderTopRightRadius: 35, 
                            padding: 25, 
                            paddingBottom: insets.bottom + 30,
                            maxHeight: SCREEN_HEIGHT * 0.85
                        }}>
                            <View style={{ width: 40, height: 5, backgroundColor: theme.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
                            
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                                <View>
                                    <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text }}>Accounts</Text>
                                    <Text style={{ fontSize: 13, color: theme.textLight, marginTop: 2 }}>
                                        {selectedSwitchAccount ? `Connecting to ${selectedSwitchAccount.institute_name}` : 'Select an institute to switch'}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => { setShowAccountModal(false); setSelectedSwitchAccount(null); setSwitchCode(''); }}>
                                    <Ionicons name="close-circle" size={30} color={theme.textLight} />
                                </TouchableOpacity>
                            </View>

                            {fetchingAccounts ? (
                                <View style={{ padding: 50, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={theme.primary} />
                                    <Text style={{ marginTop: 15, color: theme.textLight, fontWeight: '700' }}>Processing...</Text>
                                </View>
                            ) : !selectedSwitchAccount ? (
                                <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                    {/* Current Active Account Header */}
                                    <View style={{ 
                                        backgroundColor: theme.primary + '10', 
                                        padding: 20, 
                                        borderRadius: 28, 
                                        marginBottom: 20, 
                                        borderWidth: 1.5, 
                                        borderColor: theme.primary,
                                        flexDirection: 'row',
                                        alignItems: 'center'
                                    }}>
                                        <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', elevation: 2 }}>
                                            {teacherData?.institute_logo ? (
                                                <Image source={{ uri: teacherData.institute_logo }} style={{ width: 45, height: 45, resizeMode: 'contain' }} />
                                            ) : (
                                                <Ionicons name="school" size={30} color={theme.primary} />
                                            )}
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 15 }}>
                                            <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text }}>{teacherData?.name}</Text>
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary, marginTop: 2 }}>{teacherData?.institute_name}</Text>
                                        </View>
                                        <View style={{ backgroundColor: theme.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
                                            <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>ACTIVE</Text>
                                        </View>
                                    </View>

                                    {allAccounts.filter(acc => acc.id !== teacherData?.id).length === 0 ? (
                                        <View style={{ padding: 30, alignItems: 'center' }}>
                                            <Ionicons name="information-circle-outline" size={40} color={theme.textLight} />
                                            <Text style={{ color: theme.textLight, marginTop: 10, textAlign: 'center', fontWeight: '600' }}>No other linked institutes found for this mobile number.</Text>
                                        </View>
                                    ) : (
                                        allAccounts.filter(acc => acc.id !== teacherData?.id).map((acc) => (
                                            <TouchableOpacity 
                                                key={acc.id}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    padding: 18,
                                                    borderRadius: 24,
                                                    backgroundColor: theme.background,
                                                    marginBottom: 12,
                                                    borderWidth: 1,
                                                    borderColor: theme.border
                                                }}
                                                onPress={() => handleSwitchAction(acc)}
                                            >
                                                <View style={{ width: 50, height: 50, borderRadius: 15, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                                                    {acc.institute_logo ? (
                                                        <Image source={{ uri: acc.institute_logo }} style={{ width: 35, height: 35, resizeMode: 'contain' }} />
                                                    ) : (
                                                        <Ionicons name="school" size={24} color={theme.primary} />
                                                    )}
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{acc.institute_name}</Text>
                                                    <Text style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>{acc.name} • {acc.subject}</Text>
                                                </View>
                                                {savedCodes[acc.id.toString()] && (
                                                    <Ionicons name="flash" size={16} color={theme.primary} style={{ marginRight: 5 }} />
                                                )}
                                                <Ionicons name="chevron-forward" size={18} color={theme.border} />
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </ScrollView>
                            ) : (
                                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                    <View style={{ paddingBottom: 20 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: theme.textLight, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Enter Access Code</Text>
                                        <TextInput 
                                            style={{
                                                backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
                                                borderRadius: 18,
                                                padding: 18,
                                                fontSize: 20,
                                                fontWeight: '900',
                                                color: theme.text,
                                                textAlign: 'center',
                                                letterSpacing: 2,
                                                borderWidth: 1,
                                                borderColor: theme.border
                                            }}
                                            placeholder="Enter Code"
                                            placeholderTextColor={theme.textLight}
                                            keyboardType="default"
                                            value={switchCode}
                                            onChangeText={setSwitchCode}
                                            autoFocus
                                        />
                                        
                                        <TouchableOpacity 
                                            style={{
                                                backgroundColor: theme.primary,
                                                paddingVertical: 18,
                                                borderRadius: 20,
                                                alignItems: 'center',
                                                marginTop: 25,
                                                elevation: 5,
                                                shadowColor: theme.primary,
                                                shadowOpacity: 0.3,
                                                shadowRadius: 10
                                            }}
                                            onPress={handleSwitchAccount}
                                        >
                                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Confirm Switch</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            style={{ marginTop: 15, paddingVertical: 10, alignItems: 'center' }}
                                            onPress={() => { setSelectedSwitchAccount(null); setSwitchCode(''); }}
                                        >
                                            <Text style={{ color: theme.textLight, fontWeight: '700' }}>Back to Institutes</Text>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ABSENT REASON MODAL */}
            <Modal
                visible={absentReasonModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setAbsentReasonModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ width: SCREEN_WIDTH * 0.85, backgroundColor: theme.card, borderRadius: 24, padding: 25, elevation: 10 }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, marginBottom: 10 }}>Absence Reason</Text>
                        <Text style={{ fontSize: 13, color: theme.textLight, marginBottom: 20 }}>Please provide a reason for your absence or skip to mark without one.</Text>
                        
                        <TextInput
                            style={{ 
                                backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0', 
                                borderRadius: 12, 
                                padding: 15, 
                                color: theme.text, 
                                minHeight: 80, 
                                textAlignVertical: 'top',
                                borderWidth: 1,
                                borderColor: theme.border
                            }}
                            placeholder="Type your reason here..."
                            placeholderTextColor={theme.textLight}
                            multiline
                            value={absentReason}
                            onChangeText={setAbsentReason}
                        />

                        <View style={{ marginTop: 25, gap: 10 }}>
                            <TouchableOpacity 
                                style={{ backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
                                onPress={() => handleMarkSelfAttendance('absent', absentReason)}
                                disabled={markingAttendance}
                            >
                                {markingAttendance ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>Confirm Absence</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={{ backgroundColor: theme.primary + '15', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.primary + '30' }}
                                onPress={() => handleMarkSelfAttendance('absent', '')}
                                disabled={markingAttendance}
                            >
                                <Text style={{ color: theme.primary, fontWeight: '900' }}>Skip & Mark Absent</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={{ paddingVertical: 10, alignItems: 'center' }}
                                onPress={() => setAbsentReasonModalVisible(false)}
                            >
                                <Text style={{ color: theme.textLight, fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    </TouchableWithoutFeedback>
    );
}