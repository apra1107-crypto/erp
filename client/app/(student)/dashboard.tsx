import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView, Modal, TextInput, Dimensions, KeyboardAvoidingView, Platform, StatusBar, LayoutAnimation, RefreshControl, UIManager, FlatList, Pressable, Alert, BackHandler, DeviceEventEmitter, AppState } from 'react-native';

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
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, interpolate, Extrapolate, useAnimatedScrollHandler, interpolateColor, withRepeat, withSequence } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { API_ENDPOINTS, BASE_URL } from '../../constants/Config';
import { toastConfig } from '../_layout';
import { getFullImageUrl } from '../../utils/imageHelper';

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
    fees: ['#6366f1', '#a855f7'],
    transport: ['#06b6d4', '#0891b2'],
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

const PREMIUM_GRADIENTS = [
    ['#4158D0', '#C850C0', '#FFCC70'], // Cosmic Fusion
    ['#0093E9', '#80D0C7'],             // Deep Ocean
    ['#8EC5FC', '#E0C3FC'],             // Lavender Sky
    ['#FBAB7E', '#F7CE68'],             // Sunset Glow
    ['#85FFBD', '#FFFB7D'],             // Fresh Mint
    ['#21D4FD', '#B721FF'],             // Electric Violet
    ['#08AEEA', '#2AF598'],             // Arctic Cyan
] as const;

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

    const [studentData, setStudentData] = useState<any>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [loading, setLoading] = useState(true);

    const appState = useRef(AppState.currentState);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                console.log('App re-entered foreground (Student). Refreshing dashboard...');
                onRefresh();
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const downloadResultPDF = async (examId: number) => {
        try {
            setIsDownloading(true);
            const token = await AsyncStorage.getItem('studentToken');
            
            // 1. Call the student-specific PDF generation endpoint
            const response = await axios.post(
                `${API_ENDPOINTS.EXAM}/${examId}/generate-student-pdf`,
                {}, // No body needed, studentId is taken from token
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'arraybuffer',
                    timeout: 60000 
                }
            );

            // 2. Convert ArrayBuffer to Base64
            // @ts-ignore
            const base64data = btoa(
                new Uint8Array(response.data)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            const fileName = `marksheet_${examId}_${Date.now()}.pdf`;
            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

            // 3. Write to local storage
            await FileSystem.writeAsStringAsync(fileUri, base64data, {
                encoding: 'base64',
            });

            // 4. Trigger Native Sharing
            await Sharing.shareAsync(fileUri, {
                UTI: '.pdf',
                mimeType: 'application/pdf',
                dialogTitle: 'My Marksheet'
            });

        } catch (error: any) {
            console.error('Student PDF Download Error:', error.message);
            Alert.alert('Error', 'Failed to download marksheet. Please try again later.');
        } finally {
            setIsDownloading(false);
        }
    };

    const [refreshing, setRefreshing] = useState(false);

    const { isDark, theme, toggleTheme } = useTheme();

    const { socket, lastConnectedAt } = useSocket();

    const insets = useSafeAreaInsets();

    // PRODUCTION SYNC: Re-fetch data when socket reconnects to catch missed events
    useEffect(() => {
        if (lastConnectedAt > 0) {
            console.log('🔄 Socket reconnected, syncing dashboard data...');
            fetchDashboardData();
        }
    }, [lastConnectedAt]);



    // Flashcards State

    const [dashboardData, setDashboardData] = useState<any>(null);

    const [activeSlide, setActiveSlide] = useState(0);

    const flashListRef = useRef<any>(null);
    const otpInputRef = useRef<TextInput>(null);
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
        const base: any[] = [
            { type: 'attendance', data: { attendance: dashboardData.attendance, absent_request: dashboardData.absent_request } },
            { type: 'homework_summary', data: dashboardData.homework }
        ];

        // Monthly Fees Activation Flashcard
        if (dashboardData.fees_activation?.is_activated) {
            base.push({ type: 'monthly_fees', data: dashboardData.fees_activation });
        }

        // Transport Flashcard
        if (dashboardData.transport) {
            base.push({ type: 'transport', data: dashboardData.transport });
        }

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
        if (!flashcardData || flashcardData.length <= 1) return;

        const currentCard = flashcardData[activeSlide];
        let delay = 4000; // Default 4s

        if (currentCard?.type === 'greeting') delay = 30000; // 30s for greeting
        if (currentCard?.type === 'event') delay = 60000; // 60s for event

        timerRef.current = setInterval(() => {
            if (!isInteracting.current && flashcardData.length > 1) {
                const nextIndex = (activeSlide + 1) % flashcardData.length;
                
                // Safety check to prevent out of bounds errors
                if (nextIndex >= 0 && nextIndex < flashcardData.length) {
                    flashListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                    setActiveSlide(nextIndex);
                }
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

                    const attendance = item.data?.attendance;

                    const absentReq = item.data?.absent_request;

        

                    if (attendance) {

                        mainText = attendance.status.toUpperCase();

                        gradientColors = attendance.status === 'present' ? GRADIENTS.homeworkDone : ['#FF3B30', '#FF2D55'];

                        iconName = attendance.status === 'present' ? 'checkmark-circle' : 'close-circle';

                        bottomText = 'Attendance Marked';

                    } else if (absentReq) {

                        mainText = 'LEAVE OK';

                        subTitle = 'Today\'s Approved Leave';

                        gradientColors = ['#f59e0b', '#d97706']; // Professional orange for approved leave

                        iconName = 'document-text-outline';

                        bottomText = `By ${absentReq.approved_by_teacher_name}`;

                    } else {

                        mainText = 'PENDING';

                        bottomText = 'Attendance Status';

                        gradientColors = GRADIENTS.attendance;

                        iconName = 'calendar-outline';

                    }

                }

         else if (item.type === 'homework_summary') {
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
        } else if (item.type === 'monthly_fees') {
            const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const monthName = months[item.data.month - 1];
            const details = item.data.details;
            const extraCharges = item.data.extra_charges || [];
            const extraTotal = extraCharges.reduce((sum: number, ec: any) => sum + parseFloat(ec.amount || 0), 0);
            
            // Use snapshot if available
            const isPaid = details?.payment_status === 'paid';
            const total = isPaid 
                ? parseFloat(details?.amount_paid || 0) 
                : (details?.amount_due 
                    ? parseFloat(details?.amount_due) 
                    : (parseFloat(details?.monthly_fees || 0) + (details?.transport_facility ? parseFloat(details?.transport_fees || 0) : 0) + extraTotal));
            
            title = "Monthly Fees";
            subTitle = `${monthName} ${item.data.year}`;
            mainText = `₹${total.toLocaleString()}`;
            
            // Build a descriptive breakdown
            const items = [];
            if (isPaid) {
                items.push('Confirmed');
            } else {
                items.push('Tuition');
                if (details?.transport_facility) items.push('Transport');
                extraCharges.forEach((ec: any) => items.push(ec.reason));
            }
            
            bottomText = `${isPaid ? 'PAID' : 'PENDING'}: ${items.join(' + ')}`;
            
            gradientColors = isPaid ? GRADIENTS.homeworkDone : GRADIENTS.fees;
            iconName = 'wallet-outline';
        } else if (item.type === 'transport') {
            title = "My Transport";
            subTitle = item.data.bus_number;
            mainText = item.data.stop_name;
            bottomText = `Driver: ${item.data.driver_name}`;
            gradientColors = GRADIENTS.transport;
            iconName = 'bus-outline';
        }

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                    if (item.type === 'homework_summary') router.push('/(student)/homework');
                    else if (item.type === 'attendance') router.push('/(student)/absent-note');
                    else if (item.type === 'event') router.push('/(student)/academic-calendar');
                    else if (item.type === 'monthly_fees') router.push('/(student)/fees');
                    else if (item.type === 'result') router.push('/(student)/results');
                    else if (item.type === 'transport') router.push('/(student)/transport');
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
                        {item.type === 'result' ? (
                            <TouchableOpacity 
                                onPress={(e) => {
                                    e.stopPropagation();
                                    downloadResultPDF(item.data.id);
                                }}
                                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}
                            >
                                {isDownloading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={24} color="#fff" />}
                            </TouchableOpacity>
                        ) : (
                            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                                <Ionicons name={iconName} size={24} color="#fff" />
                            </View>
                        )}
                    </View>
                    <View>
                        <Text style={{ fontSize: item.type === 'greeting' ? 20 : 28, fontWeight: '900', color: '#fff' }} numberOfLines={item.type === 'monthly_fees' ? 1 : 2}>
                            {mainText}
                        </Text>
                        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '700', marginTop: 4 }} numberOfLines={item.type === 'monthly_fees' ? 2 : 1}>{bottomText}</Text>
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

    // Load persisted notifications
    const loadPersistedNotifs = useCallback(async () => {
        try {
            if (studentData?.unique_code) {
                const saved = await AsyncStorage.getItem(`notifs_${studentData.unique_code}`);
                if (saved) setNotifications(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Error loading notifs:', e);
        }
    }, [studentData?.unique_code]);

    useEffect(() => {
        loadPersistedNotifs();
        
        // Listen for global notification events (from Push handler in _layout)
        const sub = DeviceEventEmitter.addListener('notificationReceived', () => {
            loadPersistedNotifs();
        });
        
        return () => sub.remove();
    }, [studentData?.unique_code, loadPersistedNotifs]);

    // Stable ref for addNotif to prevent socket listener re-registration
    const addNotifRef = useRef(addNotif);
    useEffect(() => {
        addNotifRef.current = addNotif;
    }, [addNotif]);

    const addNotif = useCallback((notif: any) => {
        // High-quality spring animation for adding
        if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
            UIManager.setLayoutAnimationEnabledExperimental(true);
        }
        
        const newNotif = {
            id: Math.random().toString(36).substr(2, 9),
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            ...notif
        };

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        setNotifications(prev => {
            const updated = [newNotif, ...prev].slice(0, 20); // Keep last 20
            
            // Persist immediately in background
            if (studentData?.unique_code) {
                AsyncStorage.setItem(`notifs_${studentData.unique_code}`, JSON.stringify(updated))
                    .catch(err => console.error('Failed to persist notif:', err));
            }
            
            return updated;
        });
    }, [studentData?.unique_code]);

    const clearAllNotifications = () => {
        // High-quality spring animation for clearing
        LayoutAnimation.configureNext({
            duration: 500,
            create: { type: 'linear', property: 'opacity' },
            update: { type: 'spring', springDamping: 0.7 },
            delete: { type: 'linear', property: 'opacity' },
        });
        
        setNotifications([]);
        if (studentData?.unique_code) {
            AsyncStorage.removeItem(`notifs_${studentData.unique_code}`);
        }
        
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
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const sessionId = forcedSessionId || storedSessionId;

            // 1. Fetch fresh profile for the selected session
            const profileUrl = `${API_URL}/profile`;
            console.log(`[StudentDashboard] Attempting profile fetch: ${profileUrl} with token: ${token ? 'exists' : 'null'}`);
            const profileRes = await axios.get(profileUrl, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            console.log('[StudentDashboard] Profile fetch success');

            if (profileRes.data.student) {
                const freshData = { ...profileRes.data.student, authToken: token };
                setStudentData(freshData);
                // Always update cache so other screens (homework, transport) see correct class/section
                await AsyncStorage.setItem('studentData', JSON.stringify(freshData));
            }

            // 2. Fetch other dashboard components with the correct session
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

    // Account Switcher / Add Account States
    const [showAccountModal, setShowAccountModal] = useState(false);
    const [addAccountStep, setAddAccountStep] = useState<'LIST' | 'PHONE' | 'INSTITUTE' | 'STUDENT' | 'CODE'>('LIST');
    const [newPhone, setNewPhone] = useState('');
    const [foundInstitutes, setFoundInstitutes] = useState<any[]>([]);
    const [selectedInst, setSelectedInst] = useState<any>(null);
    const [foundStudents, setFoundStudents] = useState<any[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [allAccounts, setAllAccounts] = useState<any[]>([]);
    const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
    const [fetchingAccounts, setFetchingAccounts] = useState(false);

    const combinedAccounts = useMemo(() => {
        // Create a map keyed by unique_code to ensure only 1 row per person
        const deduplicated = new Map<string, any>();

        // 1. Process server-discovered accounts first (default profile info)
        allAccounts.forEach(acc => {
            if (acc.unique_code) deduplicated.set(acc.unique_code, acc);
        });

        // 2. Overwrite with saved/verified accounts (prefer verified info/tokens)
        savedAccounts.forEach(saved => {
            if (saved.unique_code) {
                // If this is a verified account, it takes precedence in the list
                deduplicated.set(saved.unique_code, { ...saved, isSaved: true });
            }
        });

        return Array.from(deduplicated.values());
    }, [allAccounts, savedAccounts]);

    // Routine State
    const [routine, setRoutine] = useState<any>(null);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
    const studentScrollRef = useRef<ScrollView>(null);

    const resetAddAccount = () => {
        setAddAccountStep('LIST');
        setNewPhone('');
        setFoundInstitutes([]);
        setSelectedInst(null);
        setFoundStudents([]);
        setTargetAccount(null);
        setAccessCode('');
        setIsProcessing(false);
    };

    const handleVerifyPhone = async () => {
        if (newPhone.length < 10) {
            Toast.show({ type: 'error', text1: 'Invalid Phone', text2: 'Please enter 10-digit mobile number' });
            return;
        }
        setIsProcessing(true);
        try {
            const res = await axios.post(`${API_URL}/verify-phone`, { mobile: newPhone });
            setFoundInstitutes(res.data.institutes);
            setAddAccountStep('INSTITUTE');
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Not Found', text2: error.response?.data?.message || 'No records for this number' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSelectInstitute = async (inst: any) => {
        setSelectedInst(inst);
        setIsProcessing(true);
        try {
            const res = await axios.post(`${API_URL}/get-students`, { mobile: newPhone, institute_id: inst.id });
            setFoundStudents(res.data.students);
            setAddAccountStep('STUDENT');
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch students' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSelectStudentForAdd = (student: any) => {
        setTargetAccount(student);
        setAddAccountStep('CODE');
    };

    const handleNewCodeVerify = async () => {
        if (accessCode.length !== 6) {
            Toast.show({ type: 'error', text1: 'Invalid Code', text2: 'Please enter 6-digit code' });
            return;
        }
        setIsProcessing(true);
        try {
            const response = await axios.post(`${API_URL}/verify-code`, {
                student_id: targetAccount.id,
                access_code: accessCode
            });
            const { token, student } = response.data;
            const studentWithToken = { ...student, authToken: token };
            
            // 1. Update core identity
            await AsyncStorage.setItem('studentToken', token);
            await AsyncStorage.setItem('studentData', JSON.stringify(studentWithToken));
            
            // 2. Add to saved accounts list
            let updatedSaved = [...savedAccounts];
            const existingIdx = updatedSaved.findIndex(acc => String(acc.unique_code) === String(student.unique_code));
            if (existingIdx !== -1) {
                updatedSaved[existingIdx] = studentWithToken;
            } else {
                updatedSaved.push(studentWithToken);
            }
            await AsyncStorage.setItem('studentAccounts', JSON.stringify(updatedSaved));
            
            setSavedAccounts(updatedSaved);
            setStudentData(studentWithToken);
            resetAddAccount();
            setShowAccountModal(false);
            
            await onRefresh();

            Toast.show({
                type: 'success',
                text1: 'Account Added',
                text2: `Successfully linked ${student.name}`
            });
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Verification Failed',
                text2: error.response?.data?.message || 'Invalid code'
            });
        } finally {
            setIsProcessing(false);
        }
    };

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
    const [isActionsExpanded, setIsActionsExpanded] = useState(true);

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
            
            await onRefresh(id); // Refresh student data for new session
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to switch session' });
        }
    };

    // Auto-refresh when selectedSessionId changes
    useEffect(() => {
        if (selectedSessionId && studentData) {
            onRefresh(selectedSessionId);
        }
    }, [selectedSessionId]);

    useFocusEffect(
        useCallback(() => {
            loadPersistedNotifs();
            if (!studentData) {
                loadInitialData();
            }
            fetchSessions();
        }, [studentData, loadPersistedNotifs])
    );

    useEffect(() => {
        if (studentData) {
            fetchMyRoutine();
            fetchTeachers();
            fetchDashboardData();
            if (studentData.mobile) {
                fetchAllAccounts(studentData.mobile);
            }
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

        const handleAttendance = (data: any) => {
            const status = data.status === 'present' ? 'PRESENT' : 'ABSENT';
            addNotifRef.current({ 
                title: `Attendance: ${status}`, 
                message: `Marked by ${data.teacher_name || 'Principal'}`, 
                type: 'attendance' 
            });
            Toast.show({
                type: 'success',
                text1: `Attendance: ${status}`,
                text2: `Marked by ${data.teacher_name || 'Principal'}`,
                visibilityTime: 6000,
                onPress: () => {
                    router.push('/(student)/absent-note');
                    Toast.hide();
                }
            });
        };

        const handleHomework = (data: any) => {
            const isUpdate = data.isUpdate;
            addNotifRef.current({
                title: isUpdate ? `HW Updated: ${data.subject}` : `New HW: ${data.subject}`,
                message: isUpdate ? `${data.teacher_name} updated today's homework` : `${data.teacher_name} added homework for today`,
                type: 'homework'
            });
            Toast.show({
                type: 'homework',
                text1: isUpdate ? `Homework Updated: ${data.subject}` : `New Homework: ${data.subject}`,
                text2: `By ${data.teacher_name}`,
                visibilityTime: 6000,
                onPress: () => {
                    router.push('/(student)/homework');
                    Toast.hide();
                }
            });
        };

        const handleNotice = (data: any) => {
            const isUpdate = data.isUpdate;
            addNotifRef.current({
                title: isUpdate ? `Notice Updated: ${data.topic}` : `Notice: ${data.topic}`,
                message: isUpdate ? `${data.creator_name} updated the notice` : `Posted by ${data.creator_name}`,
                type: 'notice'
            });
            Toast.show({
                type: 'notice',
                text1: isUpdate ? `Notice Updated: ${data.topic}` : `New Notice: ${data.topic}`,
                text2: isUpdate ? `By ${data.creator_name}` : `By ${data.creator_name}`,
                visibilityTime: 6000,
                onPress: () => {
                    router.push('/(student)/notice');
                    Toast.hide();
                }
            });
        };

        const handleFeesActivated = (data: any) => {
            addNotifRef.current({
                title: data.title || 'Fees Published',
                message: data.message || 'New monthly fees have been published.',
                type: 'fees'
            });
            Toast.show({
                type: 'info',
                text1: data.title || 'Fees Published',
                text2: data.message || 'Check your dues in the Fees section',
                onPress: () => {
                    router.push('/(student)/fees');
                    Toast.hide();
                }
            });
            fetchDashboardData();
        };

        const handleOneTimeFee = (data: any) => {
            addNotifRef.current({
                title: data.title || 'New Fee',
                message: data.message || `A new one-time fee has been published.`,
                type: 'fees'
            });
            Toast.show({
                type: 'info',
                text1: data.title || 'New Fee',
                text2: data.message || 'Check your dues in the Fees section',
                onPress: () => {
                    router.push('/(student)/fees');
                    Toast.hide();
                }
            });
            fetchDashboardData();
        };

        const handleAdmitCard = (data: any) => {
            addNotifRef.current({
                title: 'Admit Card Published! 🪪',
                message: `Your admit card for ${data.exam_name} is now available.`,
                type: 'admit-card'
            });
            Toast.show({
                type: 'admit-card',
                text1: 'Admit Card Published! 🪪',
                text2: `Download it from the Admit Card section`,
                visibilityTime: 6000,
                onPress: () => {
                    router.push('/(student)/admit-card');
                    Toast.hide();
                }
            });
            fetchDashboardData();
        };

        const handleResultPublished = (data: any) => {
            addNotifRef.current({
                title: 'Result Published! 📊',
                message: `The results for ${data.exam_name} have been published.`,
                type: 'result'
            });
            Toast.show({
                type: 'result',
                text1: 'Result Published! 📊',
                text2: `Check your marksheet in the Results section`,
                visibilityTime: 6000,
                onPress: () => {
                    router.push('/(student)/results');
                    Toast.hide();
                }
            });
            fetchDashboardData();
        };

        const handlePayNowEnabled = (data: any) => {
            addNotifRef.current({
                title: data.title || 'Online Payment Enabled',
                message: data.message || `You can now pay your ${data.monthName} fees online.`,
                type: 'fees'
            });
            Toast.show({
                type: 'info',
                text1: data.title || 'Online Payment Enabled',
                text2: data.message || `Pay your ${data.monthName} fees using "Pay Now"`,
                onPress: () => {
                    router.push('/(student)/fees');
                    Toast.hide();
                }
            });
            fetchDashboardData();
        };

        socket.on('attendance_marked', handleAttendance);
        socket.on('new_homework', handleHomework);
        socket.on('new_notice', handleNotice);
        socket.on('monthly_fees_activated', handleFeesActivated);
        socket.on('one_time_fee_published', handleOneTimeFee);
        socket.on('admit_card_published', handleAdmitCard);
        socket.on('result_published', handleResultPublished);
        socket.on('pay_now_enabled', handlePayNowEnabled);
        socket.on('fee_payment_received', (data) => {
            addNotifRef.current({
                title: data.title || 'Payment Received',
                message: data.message || 'Your fee payment has been confirmed.',
                type: 'fees'
            });
            Toast.show({
                type: 'success',
                text1: data.title || 'Payment Received',
                text2: data.message || 'Check your updated balance in Fees',
                onPress: () => {
                    router.push('/(student)/fees');
                    Toast.hide();
                }
            });
        });

        // 🟢 PRODUCTION FIX: Use unique_code for room so notifications work across sessions
        const studentIdentifier = studentData.unique_code || studentData.id;
        if (studentIdentifier) {
            console.log(`🔌 Joining individual room: student-${studentIdentifier}`);
            socket.emit('join_room', `student-${studentIdentifier}`);
        }
        
        socket.emit('join_room', `students-${studentData.institute_id}`);
        socket.emit('join_room', `${studentData.institute_id}-${studentData.class}-${studentData.section}`);

        return () => {
            socket.off('attendance_marked', handleAttendance);
            socket.off('new_homework', handleHomework);
            socket.off('new_notice', handleNotice);
            socket.off('monthly_fees_activated', handleFeesActivated);
            socket.off('one_time_fee_published', handleOneTimeFee);
            socket.off('admit_card_published', handleAdmitCard);
            socket.off('result_published', handleResultPublished);
            socket.off('pay_now_enabled', handlePayNowEnabled);
            socket.off('fee_payment_received');
        };
    }, [socket, studentData?.unique_code, studentData?.id]);

    const loadInitialData = async () => {
        // Only show full-screen loader if we don't have any data yet
        if (!studentData) {
            setLoading(true);
        }
        
        try {
            const data = await AsyncStorage.getItem('studentData');
            const token = await AsyncStorage.getItem('studentToken');
            
            if (data && token) {
                let parsed = JSON.parse(data);
                
                // 1. Ensure current student data has the token attached
                if (!parsed.authToken) {
                    parsed.authToken = token;
                    await AsyncStorage.setItem('studentData', JSON.stringify(parsed));
                }
                setStudentData(parsed);

                // 2. Load saved accounts and ensure the current one is backed up
                const accountsStr = await AsyncStorage.getItem('studentAccounts');
                let accounts = accountsStr ? JSON.parse(accountsStr) : [];
                
                const existingIdx = accounts.findIndex((acc: any) => String(acc.unique_code) === String(parsed.unique_code));
                if (existingIdx === -1) {
                    accounts.push(parsed);
                    await AsyncStorage.setItem('studentAccounts', JSON.stringify(accounts));
                } else if (!accounts[existingIdx].authToken) {
                    // Backfill token if it's missing (for older sessions)
                    accounts[existingIdx].authToken = token;
                    await AsyncStorage.setItem('studentAccounts', JSON.stringify(accounts));
                }
                
                setSavedAccounts(accounts);

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

    const fetchAllAccounts = async (currentMobile?: string) => {
        setFetchingAccounts(true);
        try {
            // 1. Collect all unique mobile numbers ever used on this device
            const mobiles = new Set<string>();
            if (currentMobile) mobiles.add(currentMobile);
            if (studentData?.mobile) mobiles.add(studentData.mobile);
            savedAccounts.forEach(acc => {
                if (acc.mobile) mobiles.add(acc.mobile);
            });

            if (mobiles.size === 0) return;

            // 2. Fetch accounts for ALL these mobile numbers in parallel
            const fetchPromises = Array.from(mobiles).map(m => 
                axios.post(`${API_URL}/get-all-accounts`, { mobile: m })
            );
            
            const results = await Promise.all(fetchPromises);
            
            // 3. Flatten and deduplicate by unique_code
            const aggregated: any[] = [];
            const seenCodes = new Set();

            results.forEach(res => {
                if (res.data.accounts) {
                    res.data.accounts.forEach((acc: any) => {
                        if (!seenCodes.has(acc.unique_code)) {
                            seenCodes.add(acc.unique_code);
                            aggregated.push(acc);
                        }
                    });
                }
            });

            setAllAccounts(aggregated);
        } catch (error) {
            console.error('Fetch all accounts error:', error);
        } finally {
            setFetchingAccounts(false);
        }
    };

    const handleSwitchPress = (account: any) => {
        if (String(account.unique_code) === String(studentData.unique_code)) {
            setShowAccountModal(false);
            return;
        }
        
        // Check if we have this account saved WITH an authentication token
        const savedAccount = savedAccounts.find(acc => String(acc.unique_code) === String(account.unique_code));
        const hasToken = !!savedAccount?.authToken;

        if (hasToken) {
            performSwitch(account);
        } else {
            // If no token exists (old login or first time on this device), 
            // force verification to securely fetch a fresh token.
            setTargetAccount(account);
            setAccessCode('');
            setShowCodeModal(true);
        }
    };

    const performSwitch = async (account: any) => {
        try {
            const savedAcc = savedAccounts.find(acc => acc.id === account.id);
            
            if (!savedAcc || !savedAcc.authToken) {
                console.warn('[Switch] Cannot switch: Missing authentication token');
                // Fallback to verification if somehow we got here without a token
                setTargetAccount(account);
                setAccessCode('');
                setShowCodeModal(true);
                return;
            }

            console.log(`[Switch] Switching to ${savedAcc.name}...`);
            
            // 1. Update Token
            await AsyncStorage.setItem('studentToken', savedAcc.authToken);
            
            // 2. Update Student Data
            await AsyncStorage.setItem('studentData', JSON.stringify(savedAcc));
            
            // 3. Update State
            setStudentData(savedAcc);
            setShowAccountModal(false);
            
            // 4. Refresh Dashboard Content
            await onRefresh();
            
            Toast.show({
                type: 'success',
                text1: 'Switched Account',
                text2: `Logged in as ${savedAcc.name}`
            });
        } catch (error) {
            console.error('Perform switch error:', error);
            Toast.show({ type: 'error', text1: 'Switch Failed', text2: 'Please try again' });
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
            // Add token to the student object so we can swap it later
            const studentWithToken = { ...student, authToken: token };
            
            await AsyncStorage.setItem('studentToken', token);
            await AsyncStorage.setItem('studentData', JSON.stringify(studentWithToken));
            
            let updatedSaved = [...savedAccounts];
            const existingIdx = updatedSaved.findIndex(acc => String(acc.unique_code) === String(student.unique_code));
            if (existingIdx !== -1) {
                updatedSaved[existingIdx] = studentWithToken;
            } else {
                updatedSaved.push(studentWithToken);
            }
            await AsyncStorage.setItem('studentAccounts', JSON.stringify(updatedSaved));
            setSavedAccounts(updatedSaved);
            setStudentData(studentWithToken);
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
            await AsyncStorage.setItem('loggedOut', 'true');
            await AsyncStorage.removeItem('studentToken');
            await AsyncStorage.removeItem('studentData');
            await AsyncStorage.removeItem('studentAccounts');
            await AsyncStorage.removeItem('selectedSessionId');
            router.replace('/(auth)/student-login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            backgroundColor: 'transparent',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 0,
            paddingRight: 12,
            paddingTop: insets.top,
            paddingBottom: 10,
            zIndex: 100,
        },
        headerTouchArea: {
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: -5,
        },
        headerLogo: { width: 100, height: 45 },
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
            marginHorizontal: 15,
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
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', paddingBottom: 60 },
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
        addAccountBtn: { 
            flexDirection: 'row', 
            alignItems: 'center', 
            padding: 14, 
            marginTop: 18, 
            borderStyle: 'dashed', 
            borderWidth: 1.5, 
            borderColor: theme.primary, 
            borderRadius: 18,
            backgroundColor: theme.primary + '05'
        },
        addIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
        addAccountText: { color: theme.primary, fontWeight: '800', fontSize: 14 },
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
        
        // Modern Single Input Styles
        inputWrapper: {
            marginTop: 30,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? theme.background : '#F1F5F9',
            borderRadius: 18,
            paddingHorizontal: 15,
            borderWidth: 1.5,
            borderColor: theme.border,
            height: 64,
        },
        inputIcon: {
            marginRight: 12,
            opacity: 0.8,
        },
        modernInput: {
            flex: 1,
            height: '100%',
            fontSize: 18,
            fontWeight: '700',
            color: theme.text,
            letterSpacing: 2,
        },
        verifyBtn: { backgroundColor: theme.primary, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
        verifyBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

        // Actions Container
        actionsBox: {
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderRadius: 32,
            marginHorizontal: 15,
            paddingTop: 20,
            paddingBottom: 10,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)',
            position: 'relative',
            marginBottom: 35,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isDark ? 0.3 : 0.1,
            shadowRadius: 20,
            elevation: 8,
        },
        actionCard: {
            width: '33.33%',
            alignItems: 'center',
            marginBottom: 20,
        },
        actionIconCircle: {
            width: 60,
            height: 60,
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 2,
        },
        actionText: {
            fontSize: 12,
            fontWeight: '800',
            color: theme.text,
            textAlign: 'center',
            paddingHorizontal: 4,
            letterSpacing: -0.2,
        },
        expandButton: {
            position: 'absolute',
            bottom: -18,
            left: '50%',
            marginLeft: -20,
            width: 40,
            height: 36,
            backgroundColor: theme.background,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
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
        todayRoutineCard: { backgroundColor: 'transparent', padding: 0 },
        slotsContainer: { paddingVertical: 10 },
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
        routineModalContent: { backgroundColor: theme.card, borderTopLeftRadius: 35, borderTopRightRadius: 35, height: '90%', padding: 20, position: 'relative' },
        gridScroll: { marginTop: 20 },
        routineGrid: { flexDirection: 'row' },
        gridColumn: { width: 150, marginRight: 15 },
        dayHeader: { fontSize: 16, fontWeight: '900', color: theme.primary, marginBottom: 15, textAlign: 'center', backgroundColor: theme.primary + '10', paddingVertical: 8, borderRadius: 12 },
        gridSlot: { backgroundColor: theme.background, borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.border, minHeight: 80, justifyContent: 'center' },
        gridSlotTime: { fontSize: 9, color: theme.textLight, marginBottom: 4, fontWeight: 'bold' },
        gridSlotSubject: { fontSize: 13, fontWeight: '800', color: theme.text },
        gridSlotTeacher: { fontSize: 10, color: theme.textLight, marginTop: 4 },
        routineModalHeader: { marginBottom: 20 },
        closeModalBtn: { position: 'absolute', top: 15, right: 15, zIndex: 100 },
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
                    onPress={() => {
                        setShowAccountModal(true);
                        if (studentData?.mobile) fetchAllAccounts(studentData.mobile);
                    }} 
                    style={styles.headerTouchArea}
                >
                    {studentData?.institute_logo ? (
                        <Image source={{ uri: getFullImageUrl(studentData.institute_logo) ?? undefined }} style={[styles.headerLogo, isDark && styles.headerLogoDark]} resizeMode="contain" />
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
                            <Image source={{ uri: getFullImageUrl(studentData.photo_url) ?? undefined }} style={styles.headerAvatar} />
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
                contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} // Add insets.bottom here
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

                        <View style={{ marginTop: 5 }}>
                            <ScrollView 
                                ref={studentScrollRef}
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                contentContainerStyle={{ paddingLeft: 20, paddingRight: 20, paddingVertical: 10 }}
                            >
                                {(() => {
                                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                    const todayName = days[new Date().getDay()];
                                    const slots = routine.config.slots || [];
                                    const todayData = routine.data[todayName] || [];

                                    if (slots.length === 0 || todayData.length === 0) {
                                        return (
                                            <View style={{ width: SCREEN_WIDTH - 40, height: 100, backgroundColor: theme.card, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border, borderStyle: 'dashed' }}>
                                                <Text style={{ color: theme.textLight, fontSize: 14, fontWeight: '600' }}>No lectures today ☕</Text>
                                            </View>
                                        );
                                    }

                                    return slots.map((slotConfig: any, pIdx: number) => {
                                        const slotData = todayData[pIdx] || {};
                                        const teacherObj = teachers.find(t => String(t.id) === String(slotData.teacherId));
                                        const teacherName = teacherObj?.name || 'Faculty';

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
                                                <View key={pIdx} style={{ width: 120, height: 130, backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5', borderRadius: 28, marginRight: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border }}>
                                                    <Ionicons name="cafe-outline" size={24} color={theme.textLight} />
                                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.textLight, marginTop: 8 }}>{slotConfig.startTime}</Text>
                                                    <Text style={{ fontSize: 12, fontWeight: '900', color: theme.textLight, letterSpacing: 1, marginTop: 2 }}>BREAK</Text>
                                                </View>
                                            );
                                        }

                                        const gradient = PREMIUM_GRADIENTS[pIdx % PREMIUM_GRADIENTS.length];

                                        return (
                                            <TouchableOpacity 
                                                key={pIdx} 
                                                activeOpacity={0.95}
                                                style={{ 
                                                    width: 185, 
                                                    height: 130, 
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
                                                    <View style={{ position: 'absolute', right: -25, top: -25, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 0 }} />
                                                    <View style={{ position: 'absolute', left: -30, bottom: -30, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.08)', zIndex: 0 }} />

                                                    <View style={{ zIndex: 1 }}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.28)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                                                                <Ionicons name="time" size={12} color="#fff" />
                                                                <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff', marginLeft: 4 }}>{slotConfig.startTime} - {slotConfig.endTime}</Text>
                                                            </View>
                                                            {isLive && <LiveBadge />}
                                                        </View>
                                                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 3 }} numberOfLines={1}>
                                                            {slotData.subject || 'Free Period'}
                                                        </Text>
                                                    </View>

                                                    <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 1 }}>
                                                        <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginRight: 10, overflow: 'hidden' }}>
                                                            {teacherObj?.photo_url ? (
                                                                <Image source={{ uri: getFullImageUrl(teacherObj.photo_url) ?? undefined }} style={{ width: '100%', height: '100%' }} />
                                                            ) : (
                                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>
                                                                    {teacherName?.charAt(0) || '?'}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        <Text style={{ fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.95)', flex: 1 }} numberOfLines={1}>
                                                            {teacherName}
                                                        </Text>
                                                    </View>
                                                </LinearGradient>
                                            </TouchableOpacity>
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
                    <View style={{ ...StyleSheet.absoluteFillObject, borderRadius: 32, overflow: 'hidden' }}>
                        <LinearGradient
                            colors={isDark ? ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)'] : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.5)']}
                            style={StyleSheet.absoluteFill}
                        />
                    </View>
                    
                    {/* Row 1 - Always Visible (3 Icons) */}
                    <View style={styles.row}>
                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => setIsRoutineModalOpen(true)}
                        >
                            <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#0288D120' : '#E1F5FE' }]}>
                                <Ionicons name="calendar" size={26} color="#0288D1" />
                            </View>
                            <Text style={styles.actionText}>Routine</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => router.push('/(student)/absent-note')}
                        >
                            <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#9C27B020' : '#F3E5F5' }]}>
                                <Ionicons name="checkmark-done" size={26} color="#9C27B0" />
                            </View>
                            <Text style={styles.actionText}>Attendance</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={() => router.push('/(student)/fees')}
                        >
                            <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#00897B20' : '#E0F2F1' }]}>
                                <Ionicons name="wallet" size={26} color="#00897B" />
                            </View>
                            <Text style={styles.actionText}>Fees</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Expanded Rows (Rest of the Icons - 3 Per Row) */}
                    {isActionsExpanded && (
                        <>
                            <View style={[styles.row, { marginTop: 10 }]}>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/admit-card')}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#6366f120' : '#EEF2FF' }]}>
                                        <Ionicons name="card-outline" size={26} color="#6366f1" />
                                    </View>
                                    <Text style={styles.actionText}>Admit Card</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/homework')}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#F39C1220' : '#FFF3E0' }]}>
                                        <Ionicons name="book" size={26} color="#F39C12" />
                                    </View>
                                    <Text style={styles.actionText}>Homework</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/notice')}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#E91E6320' : '#FCE4EC' }]}>
                                        <Ionicons name="notifications-outline" size={26} color="#E91E63" />
                                    </View>
                                    <Text style={styles.actionText}>Notice</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/academic-calendar')}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#79554820' : '#EFEBE9' }]}>
                                        <Ionicons name="calendar-number-outline" size={26} color="#795548" />
                                    </View>
                                    <Text style={styles.actionText}>Academic Calendar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/transport')}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#00ACC120' : '#E0F7FA' }]}>
                                        <Ionicons name="bus" size={26} color="#00ACC1" />
                                    </View>
                                    <Text style={styles.actionText}>Transport</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/id-card')}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#FBC02D20' : '#FFFDE7' }]}>
                                        <Ionicons name="person-circle-outline" size={26} color="#FBC02D" />
                                    </View>
                                    <Text style={styles.actionText}>Identity Card</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.actionCard}
                                    onPress={() => router.push('/(student)/results' as any)}
                                >
                                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? '#8E44AD20' : '#F3E5F5' }]}>
                                        <Ionicons name="document-text-outline" size={26} color="#8E44AD" />
                                    </View>
                                    <Text style={styles.actionText}>Result</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}

                    {/* Toggle Arrow */}
                    <TouchableOpacity
                        style={styles.expandButton}
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setIsActionsExpanded(!isActionsExpanded);
                        }}
                    >
                        <Ionicons
                            name={isActionsExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
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
                                <Image source={{ uri: getFullImageUrl(studentData.photo_url) ?? undefined }} style={styles.headerAvatar} />
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

                        <TouchableOpacity style={styles.menuItem} onPress={() => {
                            setShowProfileMenu(false);
                            router.push('/(student)/profile');
                        }}>
                            <Ionicons name="person-outline" size={20} color={theme.text} />
                            <Text style={styles.menuText}>My Profile</Text>
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
                                                </View>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}

                        <TouchableOpacity style={styles.menuItem} onPress={() => toggleTheme()}>
                            <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={theme.text} />
                            <Text style={styles.menuText}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
                            <View style={{ flex: 1 }} />
                            <View style={[styles.toggleBackground, isDark && { backgroundColor: theme.primary }]}>
                                <View style={[styles.toggleCircle, isDark && styles.toggleCircleActive]} />
                            </View>
                        </TouchableOpacity>

                        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 8 }} />

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
                onRequestClose={() => {
                    if (addAccountStep !== 'LIST') {
                        setAddAccountStep('LIST');
                    } else {
                        setShowAccountModal(false);
                    }
                }}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => {
                            if (addAccountStep === 'LIST') setShowAccountModal(false);
                        }}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <View style={styles.modalHandle} />
                                <Text style={styles.modalTitle}>
                                    {addAccountStep === 'LIST' ? 'Multi-Institute Access' :
                                     addAccountStep === 'PHONE' ? 'Link Account' :
                                     addAccountStep === 'INSTITUTE' ? 'Select Institute' :
                                     addAccountStep === 'STUDENT' ? 'Select Profile' : 'Verify Access'}
                                </Text>
                                <Text style={styles.modalSubtitle}>
                                    {addAccountStep === 'LIST' ? 'Select student profile to manage' :
                                     addAccountStep === 'PHONE' ? 'Enter registered mobile number' :
                                     addAccountStep === 'INSTITUTE' ? 'Choose school for this student' :
                                     addAccountStep === 'STUDENT' ? 'Select identity to link' : 'Enter 6-digit access code'}
                                </Text>
                            </View>

                            <ScrollView 
                                style={styles.accountList} 
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                            >
                                {addAccountStep === 'LIST' && (
                                    <>
                                        {fetchingAccounts ? (
                                            <ActivityIndicator style={{ margin: 20 }} color={theme.primary} />
                                        ) : (
                                            combinedAccounts.map((acc) => {
                                                const isActive = String(acc.unique_code) === String(studentData.unique_code);
                                                const isLoggedIn = savedAccounts.some(s => String(s.unique_code) === String(acc.unique_code));

                                                return (
                                                    <TouchableOpacity
                                                        key={acc.unique_code || acc.id}
                                                        style={[styles.accItem, isActive && styles.accItemActive]}
                                                        onPress={() => handleSwitchPress(acc)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <View style={styles.accAvatarWrapper}>
                                                            {acc.photo_url ? (
                                                                <Image source={{ uri: getFullImageUrl(acc.photo_url) ?? undefined }} style={styles.accAvatar} />
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
                                            onPress={() => setAddAccountStep('PHONE')}
                                        >
                                            <View style={styles.addIconCircle}>
                                                <Ionicons name="add" size={24} color={theme.primary} />
                                            </View>
                                            <Text style={styles.addAccountText}>Link Another Account</Text>
                                        </TouchableOpacity>
                                    </>
                                )}

                                {addAccountStep === 'PHONE' && (
                                    <View style={{ padding: 10 }}>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="call-outline" size={22} color={theme.primary} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.modernInput}
                                                placeholder="Mobile Number"
                                                placeholderTextColor={theme.textLight}
                                                keyboardType="phone-pad"
                                                maxLength={10}
                                                value={newPhone}
                                                onChangeText={setNewPhone}
                                                autoFocus
                                            />
                                        </View>
                                        <TouchableOpacity 
                                            style={[styles.verifyBtn, isProcessing && { opacity: 0.7 }]}
                                            onPress={handleVerifyPhone}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyBtnText}>Find Institutes</Text>}
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={{ marginTop: 20, alignItems: 'center' }}
                                            onPress={() => setAddAccountStep('LIST')}
                                        >
                                            <Text style={{ color: theme.textLight, fontWeight: '700' }}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {addAccountStep === 'INSTITUTE' && (
                                    <View style={{ gap: 12 }}>
                                        {foundInstitutes.map((inst) => (
                                            <TouchableOpacity 
                                                key={inst.id} 
                                                style={[styles.accItem, { paddingVertical: 15 }]}
                                                onPress={() => handleSelectInstitute(inst)}
                                            >
                                                <Image source={{ uri: getFullImageUrl(inst.logo_url) || undefined }} style={{ width: 40, height: 40, borderRadius: 10 }} resizeMode="contain" />
                                                <View style={{ marginLeft: 15, flex: 1 }}>
                                                    <Text style={[styles.accName, { fontSize: 16 }]}>{inst.institute_name}</Text>
                                                    <Text style={styles.accSchool} numberOfLines={1}>{inst.address}</Text>
                                                </View>
                                                <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                {addAccountStep === 'STUDENT' && (
                                    <View style={{ gap: 12 }}>
                                        {foundStudents.map((stu) => (
                                            <TouchableOpacity 
                                                key={stu.id} 
                                                style={[styles.accItem, { paddingVertical: 15 }]}
                                                onPress={() => handleSelectStudentForAdd(stu)}
                                            >
                                                <View style={styles.accAvatar}>
                                                    <Text style={{ color: theme.primary, fontWeight: '900' }}>{stu.name[0]}</Text>
                                                </View>
                                                <View style={{ marginLeft: 15, flex: 1 }}>
                                                    <Text style={[styles.accName, { fontSize: 16 }]}>{stu.name}</Text>
                                                    <Text style={styles.accSchool}>Roll: {stu.roll_no}</Text>
                                                </View>
                                                <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                {addAccountStep === 'CODE' && (
                                    <View style={{ padding: 10 }}>
                                        <Text style={{ textAlign: 'center', color: theme.primary, fontWeight: '800', marginBottom: 20 }}>
                                            Link: {targetAccount?.name}
                                        </Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="key-outline" size={22} color={theme.primary} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.modernInput}
                                                placeholder="6-digit access code"
                                                placeholderTextColor={theme.textLight}
                                                keyboardType="default"                             
                                                autoCapitalize="none"                                                 
                                                autoCorrect={false} 
                                                maxLength={6}
                                                value={accessCode}
                                                onChangeText={setAccessCode}
                                                autoFocus
                                            />
                                        </View>
                                        <TouchableOpacity 
                                            style={[styles.verifyBtn, isProcessing && { opacity: 0.7 }]}
                                            onPress={handleNewCodeVerify}
                                            disabled={isProcessing}
                                        >
                                            {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyBtnText}>Verify & Link</Text>}
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
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

                            <View style={styles.inputWrapper}>
                                <Ionicons name="key-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.modernInput}
                                    placeholder="Enter 6-digit code"
                                    placeholderTextColor={theme.textLight + '70'}
                                    value={accessCode}
                                    onChangeText={setAccessCode}
                                    maxLength={6}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="default"
                                    selectionColor={theme.primary}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.verifyBtn, (verifyingCode || accessCode.length < 6) && { opacity: 0.6 }]}
                                onPress={handleCodeVerify}
                                disabled={verifyingCode || accessCode.length < 6}
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
            <Modal 
                visible={isRoutineModalOpen} 
                animationType="slide" 
                transparent={true}
                onRequestClose={() => setIsRoutineModalOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.routineModalContent}>
                        <TouchableOpacity onPress={() => setIsRoutineModalOpen(false)} style={styles.closeModalBtn}>
                            <Ionicons name="close-circle" size={32} color={theme.textLight} />
                        </TouchableOpacity>

                        <View style={styles.routineModalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Weekly Flow</Text>
                                <Text style={{ color: theme.textLight }}>Class {studentData?.class}-{studentData?.section}</Text>
                            </View>
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
                <View style={styles.notifModalOverlay}>
                    {/* Backdrop - Tap to close */}
                    <Pressable 
                        style={StyleSheet.absoluteFill} 
                        onPress={() => setShowNotifList(false)} 
                    />
                    
                    {/* Dropdown Container - No Pressable here to avoid blocking scroll */}
                    <View style={[styles.notifDropdown, { maxHeight: 400, padding: 0, overflow: 'hidden', elevation: 20 }]}>
                        <FlatList
                            data={notifications}
                            keyExtractor={(item) => item.id}
                            showsVerticalScrollIndicator={true}
                            contentContainerStyle={{ padding: 20 }}
                            stickyHeaderIndices={[0]}
                            scrollEnabled={true}
                            bounces={true}
                            overScrollMode="always"
                            onStartShouldSetResponder={() => true}
                            ListHeaderComponent={
                                <View style={[styles.notifDropdownHeader, { backgroundColor: theme.card, marginBottom: 10, paddingBottom: 15 }]}>
                                    <Text style={styles.notifDropdownTitle}>Recent Updates</Text>
                                    <TouchableOpacity onPress={clearAllNotifications}>
                                        <Text style={styles.clearAllBtn}>Clear All</Text>
                                    </TouchableOpacity>
                                </View>
                            }
                            ListEmptyComponent={
                                <View style={{ padding: 40, alignItems: 'center' }}>
                                    <Ionicons name="notifications-off-outline" size={40} color={theme.textLight} />
                                    <Text style={{ color: theme.textLight, marginTop: 10, fontWeight: '600' }}>No recent updates</Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    style={styles.notifItem}
                                    onPress={() => {
                                        setShowNotifList(false);
                                        if (item.type === 'result') router.push('/(student)/results');
                                        else if (item.type === 'admit-card') router.push('/(student)/admit-card');
                                        else if (item.type === 'homework') router.push('/(student)/homework');
                                        else if (item.type === 'attendance') router.push('/(student)/absent-note');
                                        else if (item.type === 'notice') router.push('/(student)/notice');
                                        else if (item.type === 'fees') router.push('/(student)/fees');
                                    }}
                                >
                                    <View style={[styles.notifItemDot, { 
                                        backgroundColor: 
                                            item.type === 'attendance' ? theme.primary : 
                                            item.type === 'fees' ? theme.success : 
                                            item.type === 'result' ? '#E91E63' : 
                                            item.type === 'admit-card' ? '#af52de' : 
                                            item.type === 'homework' ? '#f97316' : 
                                            item.type === 'notice' ? '#6366f1' : '#f59e0b' 
                                    }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.notifItemTitle}>{item.title}</Text>
                                        <Text style={styles.notifItemMsg}>{item.message}</Text>
                                    </View>
                                    <Text style={styles.notifItemTime}>{item.time}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}
