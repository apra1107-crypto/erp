import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView, Modal, TextInput, Dimensions, KeyboardAvoidingView, Platform, StatusBar, LayoutAnimation, RefreshControl, UIManager, FlatList } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, interpolate, Extrapolate, useAnimatedScrollHandler, interpolateColor } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { API_ENDPOINTS, BASE_URL } from '../../constants/Config';
import { toastConfig } from '../_layout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const API_URL = API_ENDPOINTS.AUTH.STUDENT;

const GRADIENTS = {
    attendance: ['#007AFF', '#5856D6'],
    homework: ['#FF9500', '#FF2D55'],
    homeworkDone: ['#10b981', '#059669'],
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

export default function StudentDashboard() {
    const router = useRouter();
    const [studentData, setStudentData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { isDark, theme, toggleTheme } = useTheme();
    const { socket } = useSocket();
    const insets = useSafeAreaInsets();

    // Flashcards State
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const flashListRef = useRef<any>(null);
    const scrollX = useSharedValue(0);
    const isInteracting = useRef(false);
    const timerRef = useRef<any>(null);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            scrollX.value = event.contentOffset.x;
        },
    });

    const flashcardData = useMemo(() => {
        if (!dashboardData) return [];
        const base = [
            { type: 'attendance', data: dashboardData.attendance },
            { type: 'homework_summary', data: dashboardData.homework }
        ];

        // 3rd Card: Event or Greeting
        if (dashboardData.today_events && dashboardData.today_events.length > 0) {
            base.push({ type: 'event', data: dashboardData.today_events[0] });
        } else {
            base.push({ type: 'greeting', data: getGreetingAndQuote() });
        }

        return base;
    }, [dashboardData]);

    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (flashcardData.length <= 1) return;

        const currentCard = flashcardData[activeSlide];
        let delay = 4000; // Default 4s

        if (currentCard?.type === 'greeting') delay = 30000; // 30s for greeting
        if (currentCard?.type === 'event') delay = 60000; // 60s for event

        timerRef.current = setInterval(() => {
            if (!isInteracting.current && dashboardData) {
                const nextIndex = (activeSlide + 1) % flashcardData.length;
                flashListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                setActiveSlide(nextIndex);
            }
        }, delay);
    };

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };

    useEffect(() => {
        startTimer();
        return () => stopTimer();
    }, [flashcardData, activeSlide]);

    const onMomentumScrollEnd = (event: any) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setActiveSlide(index);
        isInteracting.current = false;
        startTimer();
    };

    const renderFlashcardItem = ({ item }: any) => {
        let gradientColors = GRADIENTS.attendance;
        let iconName: any = 'calendar-outline';
        let title = 'Today\'s Status';
        let subTitle = '';
        let mainText = 'Pending';
        let bottomText = 'Attendance';

        if (item.type === 'attendance') {
            const now = new Date();
            subTitle = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
            if (item.data) {
                mainText = item.data.status.toUpperCase();
                gradientColors = item.data.status === 'present' ? GRADIENTS.homeworkDone : ['#FF3B30', '#FF2D55'];
                iconName = item.data.status === 'present' ? 'checkmark-circle' : 'close-circle';
            }
        } else if (item.type === 'homework_summary') {
            const count = item.data?.length || 0;
            const doneCount = item.data?.filter((h: any) => h.is_done).length || 0;
            
            title = 'Homework';
            subTitle = 'Today\'s Assignments';
            mainText = count > 0 ? `${count} New Tasks` : 'No Tasks Today';
            bottomText = count > 0 ? `${doneCount} of ${count} completed` : 'Enjoy your day!';
            
            gradientColors = (count > 0 && doneCount === count) ? GRADIENTS.homeworkDone : GRADIENTS.homework;
            iconName = 'book-outline';
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
                activeOpacity={0.9}
                onPress={() => {
                    if (item.type === 'homework_summary') router.push('/(student)/homework');
                    else if (item.type === 'attendance') router.push('/(student)/absent-note');
                    else if (item.type === 'event') router.push('/(student)/academic-calendar');
                }}
                onPressIn={() => { isInteracting.current = true; stopTimer(); }}
                onPressOut={() => { isInteracting.current = false; startTimer(); }}
                style={{
                    width: SCREEN_WIDTH - 30,
                    height: 160,
                    marginHorizontal: 15,
                    borderRadius: 24,
                    shadowColor: gradientColors[0],
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 8,
                }}
            >
                <LinearGradient
                    colors={gradientColors as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1, borderRadius: 24, padding: 20, justifyContent: 'space-between' }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff' }} numberOfLines={1}>{title}</Text>
                            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>{subTitle}</Text>
                        </View>
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name={iconName} size={24} color="#fff" />
                        </View>
                    </View>
                    <View>
                        <Text style={{ fontSize: item.type === 'greeting' ? 20 : 28, fontWeight: '900', color: '#fff' }} numberOfLines={2}>
                            {mainText}
                        </Text>
                        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginTop: 4 }} numberOfLines={1}>{bottomText}</Text>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const AnimatedDot = ({ index }: { index: number }) => {
        const animatedDotStyle = useAnimatedStyle(() => {
            const width = interpolate(
                scrollX.value,
                [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH],
                [8, 20, 8],
                Extrapolate.CLAMP
            );
            const opacity = interpolate(
                scrollX.value,
                [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH],
                [0.4, 1, 0.4],
                Extrapolate.CLAMP
            );
            return { width, opacity, backgroundColor: theme.primary };
        });
        return <Animated.View style={[{ height: 8, borderRadius: 4, marginHorizontal: 4 }, animatedDotStyle]} />;
    };

    // Notification System State
    const [notifications, setNotifications] = useState<any[]>([]);
    const [showNotifList, setShowNotifList] = useState(false);

    const clearAllNotifications = () => {
        // High-quality spring animation for clearing
        LayoutAnimation.configureNext({
            duration: 500,
            create: { type: 'linear', property: 'opacity' },
            update: { type: 'spring', springDamping: 0.7 },
            delete: { type: 'linear', property: 'opacity' },
        });
        
        setNotifications([]);
        
        // Keep modal open briefly so student sees the empty state animation
        setTimeout(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowNotifList(false);
        }, 400);
    };

    const onRefresh = useCallback(async (forcedSessionId?: number) => {
        setRefreshing(true);
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const data = await AsyncStorage.getItem('studentData');
            if (!data) return;
            const parsed = JSON.parse(data);
            setStudentData(parsed);

            await Promise.all([
                fetchSessions(),
                fetchMyRoutine(forcedSessionId),
                fetchTeachers(forcedSessionId),
                fetchDashboardData(forcedSessionId)
            ]);
        } catch (error) {
            console.error('Refresh error:', error);
        } finally {
            setRefreshing(false);
        }
    }, [studentData]);

    const [showAccountModal, setShowAccountModal] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [allAccounts, setAllAccounts] = useState<any[]>([]);
    const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
    const [fetchingAccounts, setFetchingAccounts] = useState(false);

    // Routine State
    const [routine, setRoutine] = useState<any>(null);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
    const studentScrollRef = useRef<ScrollView>(null);

    const fetchDashboardData = async (forcedSessionId?: number) => {
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const selectedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const sessionId = forcedSessionId || selectedSessionId || studentData?.current_session_id;

            const headers: any = { Authorization: `Bearer ${token}` };
            if (sessionId) headers['x-academic-session-id'] = sessionId.toString();

            const url = `${API_URL}/dashboard`;
            console.log(`[DashboardData] Attempting fetch: ${url} with session: ${sessionId}`);
            
            const response = await axios.get(url, { headers, timeout: 5000 });
            setDashboardData(response.data);
            console.log('[DashboardData] Fetch successful');
        } catch (error: any) {
            console.error('Error fetching dashboard data:', error.message);
            if (error.config) {
                console.error('Failed URL:', error.config.url);
            }
        }
    };

    // Actions state
    const [isActionsExpanded, setIsActionsExpanded] = useState(false);

    // Session States
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
    const [showSessionPicker, setShowSessionPicker] = useState(false);
    const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
    const [newSessionName, setNewSessionName] = useState('');

    // Code verification modal state
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [targetAccount, setTargetAccount] = useState<any>(null);
    const [accessCode, setAccessCode] = useState('');
    const [verifyingCode, setVerifyingCode] = useState(false);

    const fetchSessions = async () => {
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const response = await axios.get(API_ENDPOINTS.ACADEMIC_SESSIONS, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const sessionsData = response.data;
            setSessions(sessionsData);
            
            if (storedSessionId) {
                setSelectedSessionId(Number(storedSessionId));
            } else {
                const active = sessionsData.find((s: any) => s.is_active);
                if (active) setSelectedSessionId(active.id);
            }
        } catch (error) {
            console.error('Fetch sessions error:', error);
        }
    };

    const handleUpdateSession = async (id: number, name: string, isActive: boolean = false) => {
        try {
            // Apply a smooth layout transition
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            
            // Save locally for this device's view
            await AsyncStorage.setItem('selectedSessionId', String(id));
            setSelectedSessionId(id); // Update local state for immediate UI response (tick mark)
            
            setEditingSessionId(null);
            setShowSessionPicker(false);
            setShowProfileMenu(false); // Close the whole menu for a fresh look
            
            Toast.show({ 
                type: 'success', 
                text1: 'Session Switched', 
                text2: `Viewing data for ${name}` 
            });
            
            onRefresh(id); // Refresh student data for new session
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to switch session' });
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadInitialData();
            fetchSessions();
        }, [])
    );

    useEffect(() => {
        if (studentData) {
            fetchMyRoutine();
            fetchTeachers();
            fetchDashboardData();
        }
    }, [studentData]);

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

    const fetchMyRoutine = async (forcedSessionId?: number) => {
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const selectedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const sessionId = forcedSessionId || selectedSessionId || studentData?.current_session_id;

            const headers: any = { Authorization: `Bearer ${token}` };
            if (sessionId) {
                headers['x-academic-session-id'] = sessionId.toString();
            }

            const response = await axios.get(`${API_ENDPOINTS.ROUTINE}/my-routine`, { headers });
            setRoutine(response.data);
        } catch (error) {
            console.error('Error fetching routine:', error);
        }
    };

    const fetchTeachers = async (forcedSessionId?: number) => {
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const selectedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const sessionId = forcedSessionId || selectedSessionId || studentData?.current_session_id;

            const headers: any = { Authorization: `Bearer ${token}` };
            if (sessionId) {
                headers['x-academic-session-id'] = sessionId.toString();
            }

            const response = await axios.get(`${API_ENDPOINTS.ROUTINE}/teachers-list`, { headers });
            setTeachers(response.data);
        } catch (error) {
            console.error('Error fetching teachers:', error);
        }
    };

    useEffect(() => {
        if (!socket || !studentData) return;

        const addNotif = (notif: any) => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setNotifications(prev => [{
                id: Math.random().toString(36).substr(2, 9),
                time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                ...notif
            }, ...prev]);
        };

        const handleNewFee = (data: any) => {
            const isMonthly = data.type === 'monthly';
            const feeTypeName = isMonthly ? 'Monthly' : 'Occasional';
            const feeName = isMonthly ? data.month_year : data.feeName;
            
            addNotif({ title: 'New Fee', message: `${feeTypeName}: ${feeName} (₹${data.amount})`, type: 'fee' });
            Toast.show({
                type: 'fee',
                text1: `New ${feeTypeName} Fee: ${feeName}`,
                text2: `of amt rs. ${data.amount}`,
                visibilityTime: 10000,
                props: {
                    onPress: () => {
                        router.push('/(student)/fees');
                        Toast.hide();
                    }
                }
            });
        };

        const handleAttendance = (data: any) => {
            const status = data.status === 'present' ? 'PRESENT' : 'ABSENT';
            addNotif({ 
                title: `Attendance: ${status}`, 
                message: `Marked by ${data.teacher_name || 'Principal'}`, 
                type: 'attendance' 
            });
        };

        const handleHomework = (data: any) => {
            const isUpdate = data.isUpdate;
            addNotif({
                title: isUpdate ? `HW Updated: ${data.subject}` : `New HW: ${data.subject}`,
                message: isUpdate ? `${data.teacher_name} updated today's homework` : `${data.teacher_name} added homework for today`,
                type: 'homework'
            });
            Toast.show({
                type: 'success',
                text1: isUpdate ? `Homework Updated: ${data.subject}` : `New Homework: ${data.subject}`,
                text2: `By ${data.teacher_name}`,
                onPress: () => router.push('/(student)/homework')
            });
        };

        const handleNotice = (data: any) => {
            const isUpdate = data.isUpdate;
            addNotif({
                title: isUpdate ? `Notice Updated: ${data.topic}` : `Notice: ${data.topic}`,
                message: isUpdate ? `${data.creator_name} updated the notice` : `Posted by ${data.creator_name}`,
                type: 'notice'
            });
            Toast.show({
                type: 'info',
                text1: isUpdate ? `Notice Updated: ${data.topic}` : `New Notice: ${data.topic}`,
                text2: isUpdate ? `By ${data.creator_name}` : `By ${data.creator_name}`,
                onPress: () => {
                    router.push('/(student)/notice');
                    Toast.hide();
                }
            });
        };

        socket.on('new_fee', handleNewFee);
        socket.on('attendance_marked', handleAttendance);
        socket.on('new_homework', handleHomework);
        socket.on('new_notice', handleNotice);

        socket.emit('join_room', `student-${studentData.id}`);
        socket.emit('join_room', `students-${studentData.institute_id}`);
        socket.emit('join_room', `${studentData.institute_id}-${studentData.class}-${studentData.section}`);

        return () => {
            socket.off('new_fee', handleNewFee);
            socket.off('attendance_marked', handleAttendance);
            socket.off('new_homework', handleHomework);
            socket.off('new_notice', handleNotice);
        };
    }, [socket, studentData]);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const data = await AsyncStorage.getItem('studentData');
            if (data) {
                const parsed = JSON.parse(data);
                setStudentData(parsed);
                await loadSavedAccounts();
                if (parsed.mobile) {
                    fetchAllAccounts(parsed.mobile);
                }
            } else {
                router.replace('/(auth)/student-login');
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSavedAccounts = async () => {
        try {
            const accounts = await AsyncStorage.getItem('studentAccounts');
            if (accounts) {
                setSavedAccounts(JSON.parse(accounts));
            }
        } catch (error) {
            console.log('Error loading saved accounts', error);
        }
    };

    const fetchAllAccounts = async (mobile: string) => {
        setFetchingAccounts(true);
        try {
            const response = await axios.post(`${API_URL}/get-all-accounts`, { mobile });
            if (response.data.accounts) {
                setAllAccounts(response.data.accounts);
            }
        } catch (error) {
            console.error('Fetch all accounts error:', error);
        } finally {
            setFetchingAccounts(false);
        }
    };

    const handleSwitchPress = (account: any) => {
        if (account.id === studentData.id) {
            setShowAccountModal(false);
            return;
        }
        const isAlreadyLoggedIn = savedAccounts.some(acc => acc.id === account.id);
        if (isAlreadyLoggedIn) {
            performSwitch(account);
        } else {
            setTargetAccount(account);
            setAccessCode('');
            setShowCodeModal(true);
        }
    };

    const performSwitch = async (account: any) => {
        try {
            const savedAcc = savedAccounts.find(acc => acc.id === account.id);
            const dataToSet = savedAcc || account;
            await AsyncStorage.setItem('studentData', JSON.stringify(dataToSet));
            setStudentData(dataToSet);
            setShowAccountModal(false);
            Toast.show({
                type: 'success',
                text1: 'Switched Account',
                text2: `Logged in as ${dataToSet.name}`
            });
        } catch (error) {
            console.error('Perform switch error:', error);
        }
    };

    const handleCodeVerify = async () => {
        if (accessCode.length !== 6) {
            Toast.show({ type: 'error', text1: 'Invalid Code', text2: 'Please enter 6-digit code' });
            return;
        }
        setVerifyingCode(true);
        try {
            const response = await axios.post(`${API_URL}/verify-code`, {
                student_id: targetAccount.id,
                access_code: accessCode
            });
            const { token, student } = response.data;
            await AsyncStorage.setItem('studentToken', token);
            await AsyncStorage.setItem('studentData', JSON.stringify(student));
            let updatedSaved = [...savedAccounts];
            const existingIdx = updatedSaved.findIndex(acc => acc.id === student.id);
            if (existingIdx !== -1) {
                updatedSaved[existingIdx] = student;
            } else {
                updatedSaved.push(student);
            }
            await AsyncStorage.setItem('studentAccounts', JSON.stringify(updatedSaved));
            setSavedAccounts(updatedSaved);
            setStudentData(student);
            setShowCodeModal(false);
            setShowAccountModal(false);
            Toast.show({
                type: 'success',
                text1: 'Verified',
                text2: `Added ${student.name} to sessions`
            });
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Verification Failed',
                text2: error.response?.data?.message || 'Invalid code'
            });
        } finally {
            setVerifyingCode(false);
        }
    };

    const handleLogout = async () => {
        try {
            await AsyncStorage.removeItem('studentToken');
            await AsyncStorage.removeItem('studentData');
            await AsyncStorage.removeItem('studentAccounts');
            router.replace('/(auth)/student-login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            backgroundColor: theme.background,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 12,
            paddingTop: insets.top + 10,
            paddingBottom: 10,
            zIndex: 100,
        },
        headerTouchArea: {
            flexDirection: 'row',
            alignItems: 'center',
            width: 40,
        },
        headerLogo: { width: 40, height: 40, borderRadius: 10 },
        headerLogoDark: {
            // width: 120, 
            // height: 50 
        },
        headerRight: { 
            flexDirection: 'row', 
            alignItems: 'center',
            justifyContent: 'flex-end',
        },
        iconButton: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
        avatarWrapper: { marginLeft: 12, position: 'relative' },
        headerAvatar: { width: 44, height: 44, borderRadius: 22 },
        placeholderAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
        avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
        onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: theme.success, borderWidth: 2, borderColor: theme.card },
        content: { flex: 1 },

        // Notification Bar Styles
        notificationBar: {
            flex: 1,
            height: 36,
            backgroundColor: theme.card,
            borderRadius: 18,
            marginLeft: 60,
            marginRight: 30,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 12,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
        },
        notifIconCircle: {
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#f59e0b',
            justifyContent: 'center',
            alignItems: 'center',
        },
        notifTitle: {
            fontSize: 9,
            fontWeight: '800',
            color: '#f59e0b',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        notifText: {
            fontSize: 11,
            fontWeight: '700',
            color: theme.text,
        },
        notifBadgeRed: {
            position: 'absolute',
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#ef4444',
            borderWidth: 1.5,
            borderColor: '#fff',
        },
        notifModalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-start',
            paddingTop: insets.top + 70, // Position below the header
            paddingHorizontal: 20,
        },
        notifDropdown: {
            backgroundColor: theme.card,
            borderRadius: 24,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 10,
            borderWidth: 1,
            borderColor: theme.border,
        },
        notifDropdownHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 15,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        notifDropdownTitle: {
            fontSize: 16,
            fontWeight: '800',
            color: theme.text,
        },
        clearAllBtn: {
            fontSize: 13,
            fontWeight: '700',
            color: '#ef4444',
        },
        notifItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.border + '40',
        },
        notifItemDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            marginRight: 12,
        },
        notifItemTitle: {
            fontSize: 14,
            fontWeight: '800',
            color: theme.text,
        },
        notifItemMsg: {
            fontSize: 12,
            color: theme.textLight,
            marginTop: 2,
        },
        notifItemTime: {
            fontSize: 10,
            color: theme.textLight,
            marginLeft: 10,
            fontWeight: '600',
        },

        // Profile Menu
        profileMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', alignItems: 'flex-end' },
        profileMenu: { marginTop: 80, marginRight: 20, width: 280, backgroundColor: theme.card, borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
        profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: theme.border },
        profileInfo: { marginLeft: 12, flex: 1 },
        profileName: { fontSize: 18, fontWeight: 'bold', color: theme.text },
        profileSub: { fontSize: 12, color: theme.textLight, marginTop: 2 },
        menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
        menuText: { fontSize: 16, color: theme.text, marginLeft: 12 },
        toggleBackground: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#ddd', padding: 2 },
        toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
        toggleCircleActive: { alignSelf: 'flex-end' },

        sessionMenuPicker: {
            backgroundColor: isDark ? '#1a1a1a' : '#f9f9f9',
            marginVertical: 10,
            borderRadius: 12,
            padding: 10,
        },
        sessionMenuItem: {
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        sessionMenuRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        sessionMenuName: {
            fontSize: 14,
            color: theme.text,
        },
        editSessionMenuRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        sessionMenuInput: {
            flex: 1,
            backgroundColor: theme.background,
            padding: 6,
            borderRadius: 8,
            color: theme.text,
            fontSize: 13,
            borderWidth: 1,
            borderColor: theme.primary,
        },

        // Modal
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
        modalContent: { backgroundColor: theme.card, borderTopLeftRadius: 35, borderTopRightRadius: 35, paddingHorizontal: 20, paddingBottom: 40, maxHeight: SCREEN_HEIGHT * 0.85 },
        modalHeader: { alignItems: 'center', paddingVertical: 20 },
        modalHandle: { width: 45, height: 6, backgroundColor: theme.border, borderRadius: 3, marginBottom: 15 },
        modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text },
        modalSubtitle: { fontSize: 14, color: theme.textLight, marginTop: 6 },
        accountList: { marginTop: 5 },
        accItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 24, marginBottom: 14, backgroundColor: theme.background },
        accItemActive: { backgroundColor: theme.primary + '08', borderWidth: 1.5, borderColor: theme.primary + '35' },
        accAvatarWrapper: { position: 'relative' },
        accAvatar: { width: 56, height: 56, borderRadius: 28 },
        accAvatarInitial: { fontSize: 24, fontWeight: '900' },
        loggedInDot: { position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: theme.success, borderWidth: 3, borderColor: theme.card },
        accInfo: { flex: 1, marginLeft: 16 },
        accName: { fontSize: 18, fontWeight: '800', color: theme.text },
        accSchool: { fontSize: 13, color: theme.textLight, marginTop: 2 },
        accMeta: { fontSize: 12, color: theme.primary, fontWeight: '700', marginTop: 5 },
        lockBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.warning + '12', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
        lockText: { fontSize: 12, fontWeight: '800', color: theme.warning, marginLeft: 5 },
        addAccountBtn: { flexDirection: 'row', alignItems: 'center', padding: 18, marginTop: 12, borderStyle: 'dotted', borderWidth: 2, borderColor: theme.primary, borderRadius: 24 },
        addIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
        addAccountText: { color: theme.primary, fontWeight: '800', fontSize: 16 },
        modalLogoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderTopWidth: 1, borderTopColor: theme.border, marginTop: 10 },
        modalLogoutText: { color: theme.danger, fontWeight: '800', fontSize: 16, marginLeft: 10 },

        // Code Modal
        codeModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 25 },
        codeModalContent: { backgroundColor: theme.card, borderRadius: 30, padding: 26, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 25, elevation: 12 },
        closeCodeBtn: { alignSelf: 'flex-end', padding: 5 },
        codeHeader: { alignItems: 'center', marginTop: -10 },
        keyIconWrapper: { width: 70, height: 70, borderRadius: 35, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
        codeTitle: { fontSize: 22, fontWeight: '900', color: theme.text },
        codeSubtitle: { fontSize: 14, color: theme.textLight, marginTop: 10 },
        codeTargetName: { fontSize: 17, fontWeight: '800', color: theme.primary, marginTop: 6 },
        codeInput: { backgroundColor: theme.background, height: 64, borderRadius: 18, marginTop: 28, textAlign: 'center', fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: 5, borderWidth: 2, borderColor: theme.border, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
        verifyBtn: { backgroundColor: theme.primary, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
        verifyBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

        // Actions Container
        actionsBox: {
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 22,
            marginHorizontal: 15,
            paddingTop: 15,
            paddingBottom: 10,
            backgroundColor: isDark ? theme.background : '#fff',
            position: 'relative',
            marginBottom: 25,
        },
        actionCard: {
            width: '33.33%',
            alignItems: 'center',
            marginBottom: 15,
        },
        actionIconCircle: {
            width: 56,
            height: 56,
            borderRadius: 18,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 8,
        },
        actionText: {
            fontSize: 11,
            fontWeight: '700',
            color: theme.text,
            textAlign: 'center',
            paddingHorizontal: 2,
        },
        expandButton: {
            position: 'absolute',
            bottom: -15,
            left: '50%',
            marginLeft: -15,
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: isDark ? theme.background : '#fff',
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 3,
        },
        row: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },

        // Routine Styles
        routineSection: { padding: 20, paddingBottom: 10 },
        sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 },
        sectionTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        viewWeeklyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary + '15', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
        viewWeeklyText: { fontSize: 12, fontWeight: 'bold', color: theme.primary, marginRight: 4 },
        todayRoutineCard: { backgroundColor: theme.card, borderRadius: 24, padding: 15, borderWidth: 1, borderColor: theme.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, elevation: 2 },
        slotsContainer: { flexDirection: 'row', paddingVertical: 10 },
        slotPill: { width: 140, backgroundColor: theme.background, borderRadius: 18, padding: 12, marginRight: 12, borderWidth: 1, borderColor: theme.border, position: 'relative' },
        liveSlotPill: { 
            borderColor: theme.primary, 
            backgroundColor: isDark ? theme.primary + '15' : '#f0f7ff', 
            borderWidth: 2,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
        },
        slotTime: { fontSize: 10, fontWeight: 'bold', color: theme.textLight, marginBottom: 6 },
        slotSubject: { fontSize: 14, fontWeight: '800', color: theme.text, marginBottom: 4 },
        slotTeacher: { fontSize: 11, color: theme.textLight },
        liveBadge: { 
            position: 'absolute', 
            top: -8, 
            right: 10, 
            backgroundColor: theme.primary, 
            paddingHorizontal: 8, 
            paddingVertical: 2, 
            borderRadius: 8, 
            zIndex: 100,
            justifyContent: 'center',
            alignItems: 'center',
            minWidth: 38,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
            elevation: 8,
        },
        liveBadgeText: { 
            color: '#fff', 
            fontSize: 9, 
            fontWeight: '900',
            textAlign: 'center',
            includeFontPadding: false,
            textAlignVertical: 'center',
        },
        breakPill: { width: 100, justifyContent: 'center', alignItems: 'center', opacity: 0.7 },
        breakText: { fontSize: 12, fontWeight: '900', color: theme.textLight, letterSpacing: 1 },
        noRoutineBox: { padding: 20, alignItems: 'center' },
        noRoutineText: { color: theme.textLight, fontSize: 14, fontWeight: '600' },

        // Weekly Modal Styles
        routineModalContent: { backgroundColor: theme.card, borderTopLeftRadius: 35, borderTopRightRadius: 35, height: '90%', padding: 20 },
        gridScroll: { marginTop: 20 },
        routineGrid: { flexDirection: 'row' },
        gridColumn: { width: 150, marginRight: 15 },
        dayHeader: { fontSize: 16, fontWeight: '900', color: theme.primary, marginBottom: 15, textAlign: 'center', backgroundColor: theme.primary + '10', paddingVertical: 8, borderRadius: 12 },
        gridSlot: { backgroundColor: theme.background, borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.border, minHeight: 80, justifyContent: 'center' },
        gridSlotTime: { fontSize: 9, color: theme.textLight, marginBottom: 4, fontWeight: 'bold' },
        gridSlotSubject: { fontSize: 13, fontWeight: '800', color: theme.text },
        gridSlotTeacher: { fontSize: 10, color: theme.textLight, marginTop: 4 }
    }), [theme, isDark, insets]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />

            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => setShowAccountModal(true)} 
                    style={styles.headerTouchArea}
                >
                    {studentData?.institute_logo ? (
                        <Image source={{ uri: studentData.institute_logo }} style={[styles.headerLogo, isDark && styles.headerLogoDark]} resizeMode="contain" />
                    ) : (
                        <Image source={require('../../assets/images/react-logo.png')} style={[styles.headerLogo, isDark && styles.headerLogoDark]} resizeMode="contain" />
                    )}
                </TouchableOpacity>

                {/* Notification Bar */}
                <TouchableOpacity 
                    style={styles.notificationBar} 
                    activeOpacity={0.9}
                    onPress={() => notifications.length > 0 && setShowNotifList(true)}
                >
                    <View style={[styles.notifIconCircle, notifications.length === 0 && { backgroundColor: theme.primary + '20' }]}>
                        <Ionicons 
                            name="notifications" 
                            size={14} 
                            color={notifications.length === 0 ? theme.primary : "#fff"} 
                        />
                        {notifications.length > 1 && (
                            <View style={[styles.notifBadgeRed, { right: -4, top: -4, width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center', borderWidth: 1 }]}>
                                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>{notifications.length}</Text>
                            </View>
                        )}
                        {notifications.length === 1 && <View style={styles.notifBadgeRed} />}
                    </View>
                    <View style={{ marginLeft: 8, flexShrink: 1 }}>
                        {notifications.length > 1 ? (
                            <Text style={[styles.notifTitle, { color: theme.text }]} numberOfLines={1}>
                                {notifications.length} New Updates
                            </Text>
                        ) : notifications.length === 1 ? (
                            <>
                                <Text style={styles.notifTitle} numberOfLines={1}>
                                    {notifications[0].title}
                                </Text>
                                <Text style={[styles.notifText, { fontSize: 10 }]} numberOfLines={1}>
                                    {notifications[0].message}
                                </Text>
                            </>
                        ) : (
                            <Text style={[styles.notifText, { color: theme.textLight, fontSize: 11 }]}>No updates</Text>
                        )}
                    </View>
                    {notifications.length > 0 && (
                        <Ionicons name="chevron-down" size={12} color={theme.textLight} style={{ marginLeft: 4 }} />
                    )}
                </TouchableOpacity>

                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={() => setShowProfileMenu(true)} style={styles.avatarWrapper}>
                        {studentData?.photo_url ? (
                            <Image source={{ uri: studentData.photo_url }} style={styles.headerAvatar} />
                        ) : (
                            <View style={[styles.placeholderAvatar, { backgroundColor: theme.primary }]}>
                                <Text style={styles.avatarText}>{studentData?.name?.charAt(0) || 'S'}</Text>
                            </View>
                        )}
                        <View style={styles.onlineDot} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={
                    <RefreshControl 
                        refreshing={refreshing} 
                        onRefresh={onRefresh} 
                        colors={[theme.primary]} 
                        tintColor={theme.primary}
                    />
                }
            >
                {/* Flashcards Carousel */}
                {dashboardData && flashcardData.length > 0 && (
                    <View style={{ position: 'relative', marginTop: 15, marginBottom: 10 }}>
                        <Animated.FlatList
                            ref={flashListRef as any}
                            data={flashcardData}
                            renderItem={renderFlashcardItem}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={onMomentumScrollEnd}
                            onScroll={scrollHandler}
                            scrollEventThrottle={16}
                            keyExtractor={(item, index) => `flash-${index}`}
                            snapToInterval={SCREEN_WIDTH}
                            decelerationRate="fast"
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
                            {flashcardData.map((_, i) => (
                                <AnimatedDot key={i} index={i} />
                            ))}
                        </View>
                    </View>
                )}

                {/* Today's Schedule Section */}
                {loading ? ( // Display loading indicator if overall dashboard is still loading
                    <View style={styles.routineSection}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={[styles.noRoutineText, { marginTop: 10 }]}>Loading Schedule...</Text>
                    </View>
                ) : routine ? ( // Display routine if available
                    <View style={styles.routineSection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Today's Schedule</Text>
                            <TouchableOpacity style={styles.viewWeeklyBtn} onPress={() => setIsRoutineModalOpen(true)}>
                                <Text style={styles.viewWeeklyText}>Weekly Flow</Text>
                                <Ionicons name="calendar-outline" size={14} color={theme.primary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.todayRoutineCard}>
                            <ScrollView 
                                ref={studentScrollRef}
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                contentContainerStyle={styles.slotsContainer}
                            >
                                {(() => {
                                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                    const todayName = days[new Date().getDay()];
                                    const slots = routine.config.slots || [];
                                    const todayData = routine.data[todayName] || [];

                                    if (slots.length === 0 || todayData.length === 0) {
                                        return (
                                            <View style={styles.noRoutineBox}>
                                                <Text style={styles.noRoutineText}>No lectures today ☕</Text>
                                            </View>
                                        );
                                    }

                                    return slots.map((slotConfig: any, pIdx: number) => {
                                        const slotData = todayData[pIdx] || {};
                                        const teacherName = teachers.find(t => String(t.id) === String(slotData.teacherId))?.name;

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
                                        const start = parseTime(slotConfig.startTime);
                                        const end = parseTime(slotConfig.endTime);
                                        const isLive = currentTime >= start && currentTime <= end;

                                        if (slotConfig.type === 'break') {
                                            return (
                                                <View key={pIdx} style={[styles.slotPill, styles.breakPill]}>
                                                    <Text style={styles.slotTime}>{slotConfig.startTime}</Text>
                                                    <Text style={styles.breakText}>BREAK</Text>
                                                </View>
                                            );
                                        }

                                        return (
                                            <View key={pIdx} style={[styles.slotPill, isLive && styles.liveSlotPill]}>
                                                {isLive && <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>LIVE</Text></View>}
                                                <Text style={styles.slotTime}>{slotConfig.startTime} - {slotConfig.endTime}</Text>
                                                <Text style={styles.slotSubject} numberOfLines={1}>{slotData.subject || 'Free Period'}</Text>
                                                <Text style={styles.slotTeacher} numberOfLines={1}>{teacherName || 'Faculty'}</Text>
                                            </View>
                                        );
                                    });
                                })()}
                            </ScrollView>
                        </View>
                    </View>
                ) : ( // If not loading and routine is null/undefined
                    <View style={styles.routineSection}>
                        <Text style={styles.sectionTitle}>Today's Schedule</Text>
                        <View style={[styles.todayRoutineCard, { alignItems: 'center', paddingVertical: 30 }]}>
                            <Ionicons name="calendar-outline" size={30} color={theme.textLight} />
                            <Text style={[styles.noRoutineText, { marginTop: 10 }]}>No schedule available</Text>
                            <Text style={styles.noRoutineText}>Please check with your institute</Text>
                        </View>
                    </View>
                )}

                {/* Actions Container */}
                <View style={styles.actionsBox}>
                    {/* Row 1 - Always Visible (3 Icons) */}
                    <View style={styles.row}>
                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => setIsRoutineModalOpen(true)}
                        >
                            <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#1A2A33' : '#E1F5FE' }]}>
                                <Ionicons name="calendar" size={24} color="#0288D1" />
                            </View>
                            <Text style={styles.actionText}>Routine</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => router.push('/(student)/absent-note')}
                        >
                            <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#2E1A47' : '#F3E5F5' }]}>
                                <Ionicons name="checkmark-done" size={24} color="#9C27B0" />
                            </View>
                            <Text style={styles.actionText}>Attendance</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Expanded Rows (Rest of the Icons - 3 Per Row) */}
                    {isActionsExpanded && (
                        <>
                            <View style={[styles.row, { marginTop: 10 }]}>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/fees')}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#1A332D' : '#E0F2F1' }]}>
                                        <Text style={{ fontSize: 24, color: "#009688", fontWeight: 'bold' }}>₹</Text>
                                    </View>
                                    <Text style={styles.actionText}>Fees</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/admit-card')}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#2D1B36' : '#F3E5F5' }]}>
                                        <Ionicons name="card-outline" size={24} color="#6366f1" />
                                    </View>
                                    <Text style={styles.actionText}>Admit Card</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/homework')}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#3D2B1B' : '#FFF3E0' }]}>
                                        <Ionicons name="book" size={24} color="#F39C12" />
                                    </View>
                                    <Text style={styles.actionText}>Homework</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/notice')}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#3E1A23' : '#FCE4EC' }]}>
                                        <Ionicons name="notifications-outline" size={24} color="#E91E63" />
                                    </View>
                                    <Text style={styles.actionText}>Notice</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/academic-calendar')}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#3E2723' : '#FFF3E0' }]}>
                                        <Ionicons name="calendar-number-outline" size={24} color="#795548" />
                                    </View>
                                    <Text style={styles.actionText}>Academic Calendar</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {/* Toggle Arrow - Positioned on border line */}
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => setIsActionsExpanded(!isActionsExpanded)}
                    >
                        <Ionicons
                            name={isActionsExpanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={theme.textLight}
                        />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* PROFILE MENU MODAL */}
            <Modal
                visible={showProfileMenu}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowProfileMenu(false)}
            >
                <TouchableOpacity
                    style={styles.profileMenuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowProfileMenu(false)}
                >
                    <View style={styles.profileMenu}>
                        <View style={styles.profileHeader}>
                            {studentData?.photo_url ? (
                                <Image source={{ uri: studentData.photo_url }} style={styles.headerAvatar} />
                            ) : (
                                <View style={[styles.placeholderAvatar, { backgroundColor: theme.primary }]}>
                                    <Text style={styles.avatarText}>{studentData?.name?.charAt(0) || 'S'}</Text>
                                </View>
                            )}
                            <View style={styles.profileInfo}>
                                <Text style={styles.profileName}>{studentData?.name}</Text>
                                <Text style={styles.profileSub}>{studentData?.institute_name}</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.menuItem} onPress={() => toggleTheme()}>
                            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={theme.text} />
                            <Text style={styles.menuText}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
                            <View style={{ flex: 1 }} />
                            <View style={[styles.toggleBackground, isDark && { backgroundColor: theme.primary }]}>
                                <View style={[styles.toggleCircle, isDark && styles.toggleCircleActive]} />
                            </View>
                        </TouchableOpacity>

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
                                        {editingSessionId === session.id ? (
                                            <View style={styles.editSessionMenuRow}>
                                                <TextInput
                                                    style={styles.sessionMenuInput}
                                                    value={newSessionName}
                                                    onChangeText={setNewSessionName}
                                                    autoFocus
                                                />
                                                <TouchableOpacity onPress={() => handleUpdateSession(session.id, newSessionName)}>
                                                    <Ionicons name="checkmark-circle" size={24} color="#27AE60" />
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <TouchableOpacity 
                                                style={styles.sessionMenuRow}
                                                onPress={() => selectedSessionId !== session.id && handleUpdateSession(session.id, session.name, true)}
                                            >
                                                <Text style={[styles.sessionMenuName, session.id === selectedSessionId && { color: theme.primary, fontWeight: '800' }]}>
                                                    {session.name}
                                                </Text>
                                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                                    {session.id === selectedSessionId && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                                                    {/* Students usually shouldn't rename, but Principal/Teacher can. I'll keep UI consistent or hide edit for students if you prefer */}
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}

                        <TouchableOpacity style={styles.menuItem} onPress={() => {
                            setShowProfileMenu(false);
                            router.push('/(student)/profile');
                        }}>
                            <Ionicons name="person-outline" size={20} color={theme.text} />
                            <Text style={styles.menuText}>My Profile</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
                            <Text style={[styles.menuText, { color: theme.danger }]}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ACCOUNT SWITCHER MODAL */}
            <Modal
                visible={showAccountModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowAccountModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowAccountModal(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHandle} />
                            <Text style={styles.modalTitle}>Multi-Institute Access</Text>
                            <Text style={styles.modalSubtitle}>Select student profile to manage</Text>
                        </View>

                        <ScrollView style={styles.accountList} showsVerticalScrollIndicator={false}>
                            {fetchingAccounts ? (
                                <ActivityIndicator style={{ margin: 20 }} color={theme.primary} />
                            ) : (
                                allAccounts.map((acc) => {
                                    const isActive = acc.id === studentData.id;
                                    const isLoggedIn = savedAccounts.some(s => s.id === acc.id);

                                    return (
                                        <TouchableOpacity
                                            key={acc.id}
                                            style={[styles.accItem, isActive && styles.accItemActive]}
                                            onPress={() => handleSwitchPress(acc)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.accAvatarWrapper}>
                                                {acc.photo_url ? (
                                                    <Image source={{ uri: acc.photo_url }} style={styles.accAvatar} />
                                                ) : (
                                                    <View style={[styles.accAvatar, { backgroundColor: theme.primary + '15' }]}>
                                                        <Text style={[styles.accAvatarInitial, { color: theme.primary }]}>{acc.name[0]}</Text>
                                                    </View>
                                                )}
                                                {isLoggedIn && !isActive && <View style={styles.loggedInDot} />}
                                            </View>

                                            <View style={styles.accInfo}>
                                                <Text style={styles.accName}>{acc.name}</Text>
                                                <Text style={styles.accSchool}>{acc?.institute_name || 'Institute'}</Text>
                                                <Text style={styles.accMeta}>Class {acc.class} • {acc.section}</Text>
                                            </View>

                                            {isActive ? (
                                                <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                                            ) : isLoggedIn ? (
                                                <Ionicons name="swap-horizontal" size={20} color={theme.textLight} />
                                            ) : (
                                                <View style={styles.lockBadge}>
                                                    <Ionicons name="lock-closed" size={14} color={theme.warning} />
                                                    <Text style={styles.lockText}>Verify</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })
                            )}

                            <TouchableOpacity
                                style={styles.addAccountBtn}
                                onPress={() => {
                                    setShowAccountModal(false);
                                    router.push('/(auth)/student-login');
                                }}
                            >
                                <View style={styles.addIconCircle}>
                                    <Ionicons name="person-add" size={20} color={theme.primary} />
                                </View>
                                <Text style={styles.addAccountText}>Link another student profile</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <TouchableOpacity style={styles.modalLogoutBtn} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={22} color={theme.danger} />
                            <Text style={styles.modalLogoutText}>Sign Out</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ACCESS CODE VERIFICATION MODAL */}
            <Modal
                visible={showCodeModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowCodeModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <BlurView intensity={20} style={StyleSheet.absoluteFill} />
                    <View style={{ flex: 1, justifyContent: 'center', padding: 25 }}>
                        <View style={styles.codeModalContent}>
                            <TouchableOpacity style={styles.closeCodeBtn} onPress={() => setShowCodeModal(false)}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>

                            <View style={styles.codeHeader}>
                                <View style={styles.keyIconWrapper}>
                                    <Ionicons name="shield-checkmark" size={32} color={theme.primary} />
                                </View>
                                <Text style={styles.codeTitle}>Profile Authorization</Text>
                                <Text style={styles.codeSubtitle}>Enter unique access code for</Text>
                                <Text style={styles.codeTargetName}>{targetAccount?.name}</Text>
                            </View>

                            <TextInput
                                style={styles.codeInput}
                                placeholder="6-character code"
                                placeholderTextColor={theme.textLight}
                                value={accessCode}
                                onChangeText={setAccessCode}
                                maxLength={6}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />

                            <TouchableOpacity
                                style={[styles.verifyBtn, verifyingCode && { opacity: 0.7 }]}
                                onPress={handleCodeVerify}
                                disabled={verifyingCode}
                            >
                                {verifyingCode ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.verifyBtnText}>Authorize & Access</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
            {/* WEEKLY ROUTINE MODAL */}
            <Modal visible={isRoutineModalOpen} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.routineModalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Weekly Flow</Text>
                                <Text style={{ color: theme.textLight }}>Class {studentData?.class}-{studentData?.section}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsRoutineModalOpen(false)}>
                                <Ionicons name="close-circle" size={32} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                            {!routine ? (
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <Ionicons name="calendar-outline" size={50} color={theme.textLight} />
                                    <Text style={{ color: theme.textLight, marginTop: 10, fontSize: 16, fontWeight: '600' }}>No schedule available</Text>
                                    <Text style={{ color: theme.textLight, fontSize: 12, textAlign: 'center', marginTop: 5 }}>Please contact your institute for the weekly routine.</Text>
                                </View>
                            ) : (
                                <ScrollView horizontal style={styles.gridScroll} showsHorizontalScrollIndicator={false}>
                                    <View style={styles.routineGrid}>
                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                                            <View key={day} style={styles.gridColumn}>
                                                <Text style={styles.dayHeader}>{day}</Text>
                                                {(routine?.config?.slots || []).map((slot: any, sIdx: number) => {
                                                    const dayData = routine?.data?.[day]?.[sIdx];
                                                    const teacherName = teachers.find(t => String(t.id) === String(dayData?.teacherId))?.name;

                                                    return (
                                                        <View key={sIdx} style={styles.gridSlot}>
                                                            <Text style={styles.gridSlotTime}>{slot.startTime}</Text>
                                                            {slot.type === 'break' ? (
                                                                <Text style={styles.breakText}>BREAK</Text>
                                                            ) : dayData?.subject ? (
                                                                <>
                                                                    <Text style={styles.gridSlotSubject}>{dayData.subject}</Text>
                                                                    <Text style={styles.gridSlotTeacher}>{teacherName || 'Faculty'}</Text>
                                                                </>
                                                            ) : (
                                                                <Text style={{ color: theme.textLight, fontSize: 10 }}>Free</Text>
                                                            )}
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            )}
                            <View style={{ height: 50 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Notifications List Modal */}
            <Modal
                visible={showNotifList}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowNotifList(false)}
            >
                <TouchableOpacity 
                    style={styles.notifModalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowNotifList(false)}
                >
                    <View style={styles.notifDropdown}>
                        <View style={styles.notifDropdownHeader}>
                            <Text style={styles.notifDropdownTitle}>Recent Updates</Text>
                            <TouchableOpacity onPress={clearAllNotifications}>
                                <Text style={styles.clearAllBtn}>Clear All</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView 
                            style={{ maxHeight: 400 }} 
                            showsVerticalScrollIndicator={false}
                        >
                            {notifications.length === 0 ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <Text style={{ color: theme.textLight }}>No recent updates</Text>
                                </View>
                            ) : (
                                notifications.map((item) => (
                                    <View key={item.id} style={styles.notifItem}>
                                        <View style={[styles.notifItemDot, { backgroundColor: item.type === 'fee' ? '#10b981' : item.type === 'attendance' ? theme.primary : '#f59e0b' }]} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.notifItemTitle}>{item.title}</Text>
                                            <Text style={styles.notifItemMsg}>{item.message}</Text>
                                        </View>
                                        <Text style={styles.notifItemTime}>{item.time}</Text>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}


