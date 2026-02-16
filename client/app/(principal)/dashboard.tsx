import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, FlatList, Image, ScrollView, RefreshControl, Modal, StatusBar, Platform, Dimensions, LayoutAnimation, UIManager, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import axios from 'axios';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, useAnimatedScrollHandler, interpolateColor, interpolate, Extrapolate } from 'react-native-reanimated';

import { API_ENDPOINTS } from '../../constants/Config';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GRADIENTS = {
    student: ['#FF2D55', '#5856D6'],
    teacher: ['#AF52DE', '#007AFF'],
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
    if (hour >= 6 && hour < 12) return { greeting: "Good Morning", quote: "Start your day with a smile and a grateful heart.", type: 'morning' };
    else if (currentTime >= 12 * 60 && currentTime < 16 * 60 + 55) return { greeting: "Good Afternoon", quote: "Your hard work is the bridge between goals and accomplishment.", type: 'afternoon' };
    else return { greeting: "Good Evening", quote: "You've done great work today. Rest well and recharge for tomorrow.", type: 'evening' };
};

export default function PrincipalDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();
  const { isDark, theme, toggleTheme } = useTheme();

  // Carousel Animation
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => { scrollX.value = event.contentOffset.x; },
  });

  const [flashcards, setFlashcards] = useState<any>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const isInteracting = useRef(false);
  const timerRef = useRef<any>(null);

  const flashcardData = useMemo(() => {
      if (!flashcards) return [];
      const data = [];
      if (flashcards.today_events?.length > 0) data.push({ type: 'event', data: flashcards.today_events[0] });
      else data.push({ type: 'greeting', data: getGreetingAndQuote() });
      data.push(
          { type: 'student', data: flashcards.student_attendance },
          { type: 'teacher', data: flashcards.teacher_attendance },
          { type: 'revenue', data: flashcards.revenue }
      );
      return data;
  }, [flashcards]);

  const AnimatedDot = ({ index }: { index: number }) => {
    const animatedDotStyle = useAnimatedStyle(() => {
      const width = interpolate(scrollX.value, [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH], [8, 20, 8], Extrapolate.CLAMP);
      const backgroundColor = interpolateColor(scrollX.value, [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH], [theme.border, theme.primary, theme.border]);
      return { width, backgroundColor };
    });
    return <Animated.View style={[styles.dot, animatedDotStyle]} />;
  };

  const actions = useMemo(() => [
    { title: 'Routine', icon: 'calendar', color: '#0288D1', bgDark: '#1A2A33', bgLight: '#E1F5FE', path: '/(principal)/routine' },
    { title: 'Stats', icon: 'stats-chart', color: '#27AE60', bgDark: '#1B2C1B', bgLight: '#E8F5E9', path: '/(principal)/stats' },
    { title: 'Notice', icon: 'notifications-outline', color: '#E91E63', bgDark: '#3E1A23', bgLight: '#FCE4EC', path: '/(principal)/notice' },
    { title: 'Add Student', icon: 'person-add', color: '#27AE60', bgDark: '#1B2C1B', bgLight: '#E8F5E9', path: '/(principal)/add-student' },
    { title: 'Add Teacher', icon: 'shirt-outline', color: '#AF52DE', bgDark: '#2D1B36', bgLight: '#F3E5F5', path: '/(principal)/add-teacher' },
    { title: 'Students', icon: 'school', color: '#3498DB', bgDark: '#1B263B', bgLight: '#E3F2FD', path: '/(principal)/students' },
    { title: 'Teachers', icon: 'people', color: '#AF52DE', bgDark: '#2D1B36', bgLight: '#F3E5F5', path: '/(principal)/teachers' },
    { title: 'Attendance', icon: 'checkmark-done', color: '#9C27B0', bgDark: '#2E1A47', bgLight: '#F3E5F5', path: '/(principal)/attendance' },
    { title: 'Fees', icon: 'cash-outline', color: '#009688', bgDark: '#1A332D', bgLight: '#E0F2F1', path: '/(principal)/fees' },
    { title: 'Salary', icon: 'wallet-outline', color: '#795548', bgDark: '#3E2723', bgLight: '#EFEBE9', path: '/(principal)/salary' },
    { title: 'Homework', icon: 'book-outline', color: '#F39C12', bgDark: '#3D2B1B', bgLight: '#FFF3E0', path: '/(principal)/homework' },
    { title: 'Results', icon: 'trophy-outline', color: '#E91E63', bgDark: '#3E1A23', bgLight: '#FCE4EC', path: '/(principal)/results' },
    { title: 'Promotion', icon: 'trending-up-outline', color: '#E91E63', bgDark: '#3E1A23', bgLight: '#FCE4EC', path: '/(principal)/promotion' },
    { title: 'Admit Card', icon: 'card-outline', color: '#6366f1', bgDark: '#2D1B36', bgLight: '#F3E5F5', path: '/(principal)/admit-card' },
    { title: 'Academic Calendar', icon: 'calendar-number-outline', color: '#795548', bgDark: '#3E2723', bgLight: '#FFF3E0', path: '/(principal)/academic-calendar' },
  ], [isDark]);

  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchBarWidth = useSharedValue(0);
  const searchBarOpacity = useSharedValue(0);
  const animatedSearchStyle = useAnimatedStyle(() => ({ width: searchBarWidth.value, opacity: searchBarOpacity.value }));

  const toggleSearch = () => {
    if (isSearchActive) {
      searchBarWidth.value = withTiming(0, { duration: 300 });
      searchBarOpacity.value = withTiming(0, { duration: 200 });
      setSearchQuery('');
      setShowResults(false);
      setTimeout(() => setIsSearchActive(false), 300);
    } else {
      setIsSearchActive(true);
      searchBarWidth.value = withSpring(SCREEN_WIDTH - 40, { damping: 15 });
      searchBarOpacity.value = withTiming(1, { duration: 300 });
    }
  };

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifList, setShowNotifList] = useState(false);
  const clearAllNotifications = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.spring); setNotifications([]); setShowNotifList(false); };

  // Dedicated Socket Listener for Subscription & Room Joining
  useEffect(() => {
    if (!socket || !userData?.id) return;

    // Join principal room
    socket.emit('join_room', `principal-${userData.id}`);
    console.log(`📡 Principal joined room: principal-${userData.id}`);

    const handleSubUpdate = (data: any) => {
        console.log('Principal Real-time sub update:', data);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
        if (data.status) setSubStatus(data.status);
        if (data.settings) setSubData(data.settings);
        
        if (data.status === 'disabled') {
            Toast.show({ type: 'error', text1: 'Access Revoked', text2: 'Institute account disabled by admin.', position: 'bottom', bottomOffset: 40 });
        } else if (data.status === 'active') {
            Toast.show({ type: 'success', text1: 'Active', text2: 'Your subscription is now active!', position: 'bottom', bottomOffset: 40 });
        } else if (data.status === 'expired') {
            Toast.show({ type: 'error', text1: 'Expired', text2: 'Subscription expired. Please renew.', position: 'bottom', bottomOffset: 40 });
        }
    };

    socket.on('subscription_update', handleSubUpdate);

    return () => {
        socket.off('subscription_update', handleSubUpdate);
    };
  }, [socket, socket?.id, userData?.id]);

  useEffect(() => {
    if (!socket || !userData?.id) return;
    
    const addNotif = (notif: any) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setNotifications(prev => [{ id: Math.random().toString(36).substr(2, 9), time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), ...notif }, ...prev]);
    };

    socket.on('fee_received', (data) => addNotif({ title: 'Fee Payment', message: `${data.student_name} paid ₹${data.amount}`, type: 'fee' }));
    socket.on('absent_request', (data) => addNotif({ title: 'Absent Request', message: `New request from Roll ${data.roll_no}`, type: 'request' }));
    socket.on('teacher_attendance', (data) => addNotif({ title: 'Teacher Attendance', message: `${data.teacher_name} marked himself ${data.status.toUpperCase()} today`, type: 'attendance' }));
    socket.on('new_notice', (data) => addNotif({ title: data.isUpdate ? `Notice Updated: ${data.topic}` : `Notice: ${data.topic}`, message: `By ${data.creator_name}`, type: 'notice' }));
    return () => { 
        socket.off('subscription_update');
        socket.off('fee_received'); 
        socket.off('absent_request'); 
        socket.off('teacher_attendance'); 
        socket.off('new_notice'); 
    };
  }, [socket, userData?.id]);

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const [isActionsExpanded, setIsActionsExpanded] = useState(false);
  
  // Session States
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);

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
                text2: 'Time limit reached. Please renew.', 
                position: 'bottom', 
                bottomOffset: 40 
            });
        }
    };

    const timer = setInterval(checkExpiry, 1000);
    return () => clearInterval(timer);
  }, [subStatus, subData?.subscription_end_date]);

  const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (flashcardData.length <= 1) return;
      const currentCard = flashcardData[activeSlide];
      let delay = 3000;
      if (currentCard?.type === 'greeting') delay = 30000;
      if (currentCard?.type === 'event') delay = 60000;
      timerRef.current = setInterval(() => {
          if (!isInteracting.current && flashcards) {
              const nextIndex = (activeSlide + 1) % flashcardData.length;
              flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
              setActiveSlide(nextIndex);
          }
      }, delay);
  };

  useEffect(() => { if (flashcards) startTimer(); return () => clearInterval(timerRef.current); }, [flashcards, activeSlide]);

  const onMomentumScrollEnd = (event: any) => { setActiveSlide(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH)); isInteracting.current = false; startTimer(); };

  const getSubscriptionInfo = () => {
    if (!subData) return { color: '#27AE60', percent: 100, label: 'Premium Access', timeLeft: '' };
    const now = new Date();
    const expiry = new Date(subData.subscription_end_date);
    const diffMs = expiry.getTime() - now.getTime();
    const diffMins = Math.max(0, Math.ceil(diffMs / (1000 * 60)));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    let color = '#27AE60'; let percent = 100; let label = 'Premium Access';
    if (subStatus === 'grant') { color = '#8E44AD'; percent = 100; label = 'Special Access'; }
    else if (subStatus === 'expired' || subStatus === 'disabled') { color = theme.danger; percent = 10; label = 'Inactive'; }
    else { if (diffMins < 60) { color = '#E74C3C'; percent = 20; } else if (diffDays < 7) { color = '#F39C12'; percent = 50; } }
    let timeLeft = diffDays > 0 ? `${diffDays}d left` : `${diffHours}h left`;
    return { color, percent, label, timeLeft };
  };

  const renderFlashcardItem = ({ item }: any) => {
      let gradientColors = GRADIENTS.student;
      let iconName: any = 'people';
      let title = 'Student Attendance';
      let subTitle = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      let mainText = '';
      let bottomText = '';
      let extraContent = null;

      if (item.type === 'student') {
          mainText = `${item.data?.total_present || 0} / ${item.data?.total_students || 0}`;
          bottomText = item.data?.status === 'complete' ? 'Present Today' : `In Progress (${item.data?.pending_count || 0} left)`;
      } else if (item.type === 'teacher') {
          gradientColors = GRADIENTS.teacher; iconName = 'school'; title = 'Teacher Attendance'; mainText = `${item.data?.present || 0} / ${item.data?.total || 0}`; bottomText = 'Teachers Present';
      } else if (item.type === 'revenue') {
          gradientColors = GRADIENTS.revenue; title = 'Revenue'; mainText = `₹${((Number(item.data.monthly_month) || 0) + (Number(item.data.occasional_month) || 0)).toLocaleString()}`; bottomText = `${item.data.month_name || ''} Total`;
          extraContent = <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)', flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' }}>Today</Text><Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>₹${((Number(item.data.monthly_day) || 0) + (Number(item.data.occasional_day) || 0)).toLocaleString()}</Text></View>;
      } else if (item.type === 'greeting') {
          title = item.data.greeting; mainText = item.data.quote; bottomText = "Have a great day!"; gradientColors = (GRADIENTS as any)[item.data.type]; iconName = item.data.type === 'morning' ? 'sunny' : item.data.type === 'afternoon' ? 'partly-sunny' : 'moon';
      } else if (item.type === 'event') {
          title = "Institute Event"; mainText = item.data.title; bottomText = item.data.description || "Check calendar"; gradientColors = GRADIENTS.event; iconName = 'star';
      }

      return (
        <TouchableOpacity 
            activeOpacity={0.95} 
            onPress={() => { 
                if (isLocked && item.type !== 'greeting') {
                    Toast.show({ 
                        type: 'error', 
                        text1: 'Locked', 
                        text2: 'Please renew subscription to access details',
                        position: 'bottom',
                        bottomOffset: 40
                    });
                    return;
                }
                if (item.type === 'student') router.push({ pathname: '/(principal)/stats', params: { initialTab: 'students' } }); 
                else if (item.type === 'teacher') router.push({ pathname: '/(principal)/stats', params: { initialTab: 'teachers' } }); 
                else if (item.type === 'revenue') router.push({ pathname: '/(principal)/stats', params: { initialTab: 'revenue' } }); 
                else if (item.type === 'event') router.push('/(principal)/academic-calendar'); 
            }} 
            style={[styles.flashcard, isLocked && item.type !== 'greeting' && { opacity: 0.6 }]} 
            onPressIn={() => { isInteracting.current = true; }} 
            onPressOut={() => { isInteracting.current = false; }}
        >
            <LinearGradient colors={gradientColors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.cardTitle}>{title}</Text>
                        <Text style={styles.cardSub}>{subTitle}</Text>
                    </View>
                    <View style={styles.cardIconBg}>
                        {isLocked && item.type !== 'greeting' ? (
                            <Ionicons name="lock-closed" size={22} color="#fff" />
                        ) : (
                            item.type === 'revenue' ? <Text style={{ fontSize: 24, color: '#fff', fontWeight: '900' }}>₹</Text> : <Ionicons name={iconName} size={22} color="#fff" />
                        )}
                    </View>
                </View>
                <View><Text style={{ fontSize: item.type === 'greeting' ? 20 : 28, fontWeight: '900', color: '#fff' }} numberOfLines={2}>{mainText}</Text><Text style={styles.cardBottomText}>{bottomText}</Text>{extraContent}</View>
            </LinearGradient>
        </TouchableOpacity>
      );
  };

  const fetchProfileImages = async (forcedToken?: string) => {
    try {
      const token = forcedToken || await AsyncStorage.getItem('token');
      const res = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      setProfileData(res.data.profile);
      setUserData((prev: any) => ({ ...prev, ...res.data.profile }));
    } catch (e) {}
  };

  const checkSubscription = async (id: any) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await axios.get(`${API_ENDPOINTS.SUBSCRIPTION}/${id}/status`, { headers: { Authorization: `Bearer ${token}` } });
      setSubStatus(res.data.status); setSubData(res.data);
    } catch (e) {}
  };

  const fetchDashboardData = async (forcedId?: number) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const data = await AsyncStorage.getItem('userData');
      const sId = forcedId || (data ? JSON.parse(data).current_session_id : null);
      if (!sId) return;
      const res = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/dashboard`, { headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': sId.toString() } });
      if (res.data.flashcards) setFlashcards(res.data.flashcards);
    } catch (e) {}
  };

  const fetchSessions = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const sId = await AsyncStorage.getItem('selectedSessionId');
      const res = await axios.get(API_ENDPOINTS.ACADEMIC_SESSIONS, { headers: { Authorization: `Bearer ${token}` } });
      setSessions(res.data);
      if (sId) setSelectedSessionId(Number(sId));
      else { const active = res.data.find((s: any) => s.is_active); if (active) setSelectedSessionId(active.id); }
    } catch (e) {}
  };

  const handleAddSession = async () => {
    if (!newSessionName.trim()) return;
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.post(API_ENDPOINTS.ACADEMIC_SESSIONS, { name: newSessionName }, { headers: { Authorization: `Bearer ${token}` } });
      setNewSessionName(''); setIsAddingSession(false); fetchSessions();
      Toast.show({ type: 'success', text1: 'Success', text2: 'New session added' });
    } catch (e) { Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to add session' }); }
  };

  const handleUpdateSession = async (id: number, name: string, isActive: boolean = false) => {
    try {
      await AsyncStorage.setItem('selectedSessionId', String(id));
      setSelectedSessionId(id);
      const token = await AsyncStorage.getItem('token');
      await axios.put(`${API_ENDPOINTS.ACADEMIC_SESSIONS}/${id}`, { name, is_active: isActive }, { headers: { Authorization: `Bearer ${token}`, 'x-academic-session-id': id.toString() } });
      setEditingSessionId(null);
      Toast.show({ type: 'success', text1: 'Success', text2: 'Session updated' });
      onRefresh(id);
    } catch (e) { Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to update session' }); }
  };

  const handleDeleteSession = async (id: number, name: string) => {
    Alert.alert('Delete Session', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('token');
            await axios.delete(`${API_ENDPOINTS.ACADEMIC_SESSIONS}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            fetchSessions();
            Toast.show({ type: 'success', text1: 'Success', text2: 'Session deleted' });
          } catch (e) { Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete' }); }
        }}
    ]);
  };

  const onRefresh = async (forcedId?: number) => {
    setRefreshing(true);
    try {
        const token = await AsyncStorage.getItem('token');
        const profileRes = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/profile`, { headers: { Authorization: `Bearer ${token}` } });
        const profile = profileRes.data.profile;
        
        setProfileData(profile);
        setUserData(profile);
        
        await Promise.all([
            fetchDashboardData(forcedId), 
            fetchSessions(),
            checkSubscription(profile.id)
        ]);
    } catch (e) {
        console.error('Refresh error:', e);
    } finally {
        setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { onRefresh(); }, []));

  const handleSearch = async (t: string) => {
    setSearchQuery(t);
    if (t.length < 2) { setSearchResults([]); setShowResults(false); return; }
    setIsSearching(true); setShowResults(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/search?query=${t}`, { headers: { Authorization: `Bearer ${token}` } });
      setSearchResults(res.data.results);
    } catch (e) {} finally { setIsSearching(false); }
  };

  const handleCreateResult = (item: any) => { router.push(item.type === 'student' ? `/(principal)/students/details/${item.id}` : `/(principal)/teachers/details/${item.id}`); };
  const switchAccount = async (acc: any) => { await AsyncStorage.setItem('token', acc.token); await AsyncStorage.setItem('userData', JSON.stringify(acc.userData)); onRefresh(); setShowAccountMenu(false); };
  const handleLogout = async () => { await AsyncStorage.clear(); router.replace('/(auth)/institute-login'); };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 20, paddingTop: insets.top + 10, paddingBottom: 10, zIndex: 10 },
    headerTouchArea: { marginLeft: 5 },
    headerLogo: { width: 100, height: 45 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: theme.primary },
    placeholderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    subIndicatorContainer: { width: 160, height: 20, backgroundColor: isDark ? '#ffffff10' : '#00000005', borderRadius: 10, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
    subLineFill: { height: '100%', borderRadius: 9 },
    content: { flex: 1 },
    flashcard: { width: SCREEN_WIDTH - 30, height: 170, marginHorizontal: 15, borderRadius: 24, elevation: 8 },
    cardGradient: { flex: 1, borderRadius: 24, padding: 20, justifyContent: 'space-between' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
    cardSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '600' },
    cardIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    cardBottomText: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 4, fontWeight: '600' },
    paginationDots: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
    dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
    notificationBar: { flex: 1, height: 52, backgroundColor: theme.card, borderRadius: 16, marginRight: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border, elevation: 4 },
    notifIconCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#f59e0b', justifyContent: 'center', alignItems: 'center' },
    notifTitle: { fontSize: 10, fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase' },
    notifText: { fontSize: 13, fontWeight: '600', color: theme.text, marginTop: 1 },
    notifBadgeRed: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', borderWidth: 2, borderColor: '#fff' },
    gradientIconBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 6 },
    animatedSearchBar: { position: 'absolute', top: insets.top + 70, right: 20, height: 52, backgroundColor: theme.card, borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, zIndex: 100, borderWidth: 1, borderColor: theme.border, elevation: 10 },
    searchInput: { flex: 1, fontSize: 15, color: theme.text, marginLeft: 10 },
    resultsContainer: { position: 'absolute', top: insets.top + 70, left: 20, right: 20, backgroundColor: theme.card, borderRadius: 15, maxHeight: 350, zIndex: 1000, borderWidth: 1, borderColor: theme.border, elevation: 10 },
    resultItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border },
    resultAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.background, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
    avatarImg: { width: 44, height: 44, borderRadius: 22 },
    resultName: { fontSize: 16, fontWeight: '700', color: theme.text },
    resultInfo: { fontSize: 13, color: theme.textLight },
    typeBadge: { marginLeft: 'auto', fontSize: 10, color: '#fff', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, fontWeight: 'bold' },
    actionsContainer: { padding: 15 },
    actionsBox: { borderWidth: 1, borderColor: theme.border, borderRadius: 22, paddingTop: 15, paddingBottom: 10, backgroundColor: theme.card, position: 'relative', marginBottom: 10, elevation: 8 },
    actionCard: { width: '33.33%', alignItems: 'center', marginBottom: 15 },
    actionIconCircle: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    actionText: { fontSize: 11, fontWeight: '700', color: theme.text, textAlign: 'center' },
    expandButton: { position: 'absolute', bottom: -20, left: '50%', marginLeft: -20, width: 40, height: 40, borderRadius: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', zIndex: 10, elevation: 3 },
    row: { flexDirection: 'row', flexWrap: 'wrap' },
    profileMenu: { position: 'absolute', top: 75, right: 20, backgroundColor: theme.card, borderRadius: 24, width: 300, zIndex: 2000, elevation: 15, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
    menuHeader: { padding: 20, backgroundColor: isDark ? '#252525' : '#f8f9fa', borderBottomWidth: 1, borderBottomColor: theme.border },
    menuAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: theme.primary, marginBottom: 10 },
    menuName: { fontWeight: '800', fontSize: 18, color: theme.text },
    menuInfo: { fontSize: 13, color: theme.textLight },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, gap: 12 },
    menuText: { fontSize: 15, color: theme.text, fontWeight: '600' },
    toggleBackground: { width: 40, height: 22, borderRadius: 11, backgroundColor: '#ddd', padding: 2 },
    toggleCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' },
    toggleCircleActive: { alignSelf: 'flex-end' },
    sessionMenuPicker: { backgroundColor: isDark ? '#1a1a1a' : '#f9f9f9', margin: 10, borderRadius: 12, padding: 10 },
    sessionMenuItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
    sessionMenuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sessionMenuName: { fontSize: 14, color: theme.text },
    sessionMenuInput: { flex: 1, backgroundColor: theme.background, padding: 6, borderRadius: 8, color: theme.text, fontSize: 13, borderWidth: 1, borderColor: theme.primary },
    addSessionMenuRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 3000 },
    accountMenu: { position: 'absolute', top: 95, left: 20, width: 300, backgroundColor: theme.card, borderRadius: 20, padding: 15, elevation: 15 },
    accountItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 15, marginBottom: 8 },
    accountLogo: { width: 40, height: 40, borderRadius: 10, marginRight: 12 },
    noResults: { padding: 25, textAlign: 'center', color: theme.textLight },
    notifModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-start', paddingTop: 130, paddingHorizontal: 20 },
    notifDropdown: { backgroundColor: theme.card, borderRadius: 24, padding: 20, elevation: 10 },
    notifItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border + '40' },
    notifItemDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
    notifItemTitle: { fontSize: 14, fontWeight: '800', color: theme.text },
    notifItemMsg: { fontSize: 12, color: theme.textLight },
    notifItemTime: { fontSize: 10, color: theme.textLight, marginLeft: 10 },
  }), [theme, isDark, insets]);

  const subInfo = getSubscriptionInfo();

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent />
      <View style={styles.header}>
        <TouchableOpacity 
            onPress={() => setShowAccountMenu(true)} 
            style={styles.headerTouchArea}
        >
            <View style={{ position: 'relative' }}>
                <Image source={profileData?.logo_url ? { uri: profileData.logo_url } : require('../../assets/images/react-logo.png')} style={styles.headerLogo} resizeMode="contain" />
            </View>
        </TouchableOpacity>
        
        <View style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 10, bottom: 10, alignItems: 'center', justifyContent: 'center', zIndex: 1, pointerEvents: 'box-none' }}>
            <TouchableOpacity 
                onPress={() => {
                    const expiryDate = subData?.subscription_end_date 
                        ? new Date(subData.subscription_end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                        : 'Unlimited';
                    
                    Toast.show({ 
                        type: 'subscription', 
                        position: 'bottom',
                        bottomOffset: 40,
                        props: { 
                            label: subInfo.label, 
                            timeLeft: subInfo.timeLeft,
                            expiryDate: expiryDate,
                            color: subInfo.color
                        } 
                    });
                }} 
                style={styles.subIndicatorContainer}
            >
                <View style={[styles.subLineFill, { width: `${subInfo.percent}%`, backgroundColor: subInfo.color }]} />
            </TouchableOpacity>
        </View>

        <TouchableOpacity 
            onPress={() => !isLocked && setShowProfileMenu(!showProfileMenu)} 
            style={[{ marginRight: 5 }, isLocked && { opacity: 0.7 }]}
            activeOpacity={isLocked ? 1 : 0.7}
        >
            <View style={{ position: 'relative' }}>
                {profileData?.principal_photo_url ? <Image source={{ uri: profileData.principal_photo_url }} style={styles.headerAvatar} /> : <View style={styles.placeholderAvatar}><Text style={styles.avatarText}>{userData?.principal_name?.charAt(0) || 'P'}</Text></View>}
                {isLocked && (
                    <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: theme.danger, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.background }}>
                        <Ionicons name="lock-closed" size={10} color="#fff" />
                    </View>
                )}
            </View>
        </TouchableOpacity>
      </View>

      {isSearchActive && <Animated.View style={[styles.animatedSearchBar, animatedSearchStyle]}><Ionicons name="search" size={20} color={theme.textLight} /><TextInput style={styles.searchInput} placeholder="Search Student or Teacher..." placeholderTextColor={theme.textLight} value={searchQuery} onChangeText={handleSearch} autoFocus /><TouchableOpacity onPress={toggleSearch}><Ionicons name="close-circle" size={20} color={theme.textLight} /></TouchableOpacity></Animated.View>}

      <View style={{ position: 'relative', marginTop: 10, marginHorizontal: 20, zIndex: 90, flexDirection: 'row', alignItems: 'center', opacity: isSearchActive ? 0 : 1 }}>
        <TouchableOpacity 
            style={[styles.notificationBar]} 
            onPress={() => !isLocked && notifications.length > 0 && setShowNotifList(true)}
            activeOpacity={isLocked ? 1 : 0.7}
        >
            <View style={styles.notifIconCircle}><Ionicons name="notifications" size={18} color="#fff" />{notifications.length > 0 && <View style={styles.notifBadgeRed} />}</View>
            <View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.notifTitle}>{notifications.length > 0 ? `${notifications.length} New Updates` : 'No updates'}</Text><Text style={styles.notifText} numberOfLines={1}>{notifications.length > 0 ? notifications[0].message : 'Everything caught up'}</Text></View>
            <Ionicons name="chevron-down" size={16} color={theme.textLight} />
        </TouchableOpacity>
        <TouchableOpacity 
            onPress={() => {
                if (isLocked) {
                    Toast.show({ type: 'error', text1: 'Locked', text2: 'Subscription expired', position: 'bottom', bottomOffset: 40 });
                    return;
                }
                toggleSearch();
            }}
            activeOpacity={isLocked ? 1 : 0.7}
        >
            <LinearGradient colors={['#3b82f6', '#8b5cf6', '#ec4899']} style={[styles.gradientIconBtn]}><Ionicons name="search" size={22} color="#fff" /></LinearGradient>
        </TouchableOpacity>

        {isLocked && (
            <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)', borderRadius: 16, zIndex: 100, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="lock-closed" size={16} color={theme.danger} />
            </View>
        )}
      </View>

      {showResults && <View style={styles.resultsContainer}>{searchResults.length === 0 ? <Text style={styles.noResults}>No results found</Text> : <FlatList data={searchResults} keyExtractor={(item, index) => item.id.toString() + index} renderItem={({ item }) => <TouchableOpacity style={styles.resultItem} onPress={() => handleCreateResult(item)}><View style={styles.resultAvatar}>{item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.avatarImg} /> : <Ionicons name="person" size={20} color={theme.textLight} />}</View><View><Text style={styles.resultName}>{item.name}</Text><Text style={styles.resultInfo}>{item.type === 'student' ? `Class: ${item.class}-${item.section}` : `Subject: ${item.subject}`}</Text></View><Text style={[styles.typeBadge, { backgroundColor: item.type === 'student' ? theme.primary : theme.secondary }]}>{item.type}</Text></TouchableOpacity>} />}</View>}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />} contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 10 }}>
        {/* Flashcards Carousel */}
        {flashcards && (
            <View style={{ position: 'relative', marginTop: 5, marginBottom: 15 }}>
                <Animated.FlatList ref={flatListRef as any} data={flashcardData} renderItem={renderFlashcardItem} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onMomentumScrollEnd} onScroll={scrollHandler} scrollEventThrottle={16} keyExtractor={(item, index) => item.type + index} snapToInterval={SCREEN_WIDTH} decelerationRate="fast" style={{ width: SCREEN_WIDTH }} />
                <View style={styles.paginationDots}>{flashcardData.map((_, i) => (<AnimatedDot key={i} index={i} />))}</View>
                
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
                        <Text style={{ color: theme.text, fontWeight: '900', marginTop: 15, fontSize: 18 }}>Data Insights Locked</Text>
                        <Text style={{ color: theme.textLight, fontSize: 13, marginTop: 5, fontWeight: '600' }}>Renew Subscription to View Statistics</Text>
                    </View>
                )}
            </View>
        )}

        {/* Action Grid */}
        <View style={styles.actionsContainer}>
          <View style={styles.actionsBox}>
            <View style={styles.row}>
              {(isActionsExpanded ? actions : actions.slice(0, 3)).map((action, index) => {
                return (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.actionCard} 
                    onPress={() => router.push(action.path as any)}
                  >
                    <View style={[styles.actionIconCircle, { backgroundColor: isDark ? action.bgDark : action.bgLight }]}>
                      <Ionicons name={action.icon as any} size={24} color={action.color} />
                    </View>
                    <Text style={styles.actionText}>{action.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity 
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                style={styles.expandButton} 
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsActionsExpanded(!isActionsExpanded); }}
            >
                <Ionicons name={isActionsExpanded ? "chevron-up" : "chevron-down"} size={22} color={theme.textLight} />
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
                        onPress={() => Toast.show({ type: 'error', text1: 'Renewal Required', text2: 'Please renew from the web dashboard', position: 'bottom', bottomOffset: 40 })}
                        style={{ marginTop: 15, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.danger }}
                    >
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>GET ACCESS</Text>
                    </TouchableOpacity>
                </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Profile Menu with Session Management Restore */}
      <Modal visible={showProfileMenu} transparent animationType="fade" onRequestClose={() => setShowProfileMenu(false)}><TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowProfileMenu(false)}><View style={styles.profileMenu}><View style={styles.menuHeader}><View style={{ flexDirection: 'row', alignItems: 'center' }}>{profileData?.principal_photo_url ? <Image source={{ uri: profileData.principal_photo_url }} style={styles.menuAvatar} /> : <View style={[styles.menuAvatar, { backgroundColor: theme.primary + '20', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: theme.primary, fontSize: 24, fontWeight: 'bold' }}>{userData?.principal_name?.charAt(0)}</Text></View>}<View style={{ marginLeft: 15 }}><Text style={styles.menuName}>{userData?.principal_name}</Text><Text style={styles.menuInfo}>{userData?.mobile}</Text></View></View></View><TouchableOpacity style={styles.menuItem} onPress={() => { setShowProfileMenu(false); router.push('/(principal)/profile'); }}><Ionicons name="person-outline" size={20} color={theme.text} /><Text style={styles.menuText}>Profile</Text></TouchableOpacity>
        
        {/* Session Picker & Management */}
        <TouchableOpacity style={styles.menuItem} onPress={() => setShowSessionPicker(!showSessionPicker)}><Ionicons name="calendar-outline" size={20} color={theme.text} /><View style={{ flex: 1 }}><Text style={styles.menuText}>Academic Session</Text><Text style={{ fontSize: 11, color: theme.primary, fontWeight: '700' }}>{sessions.find(s => s.id === selectedSessionId)?.name || 'Select Session'}</Text></View><Ionicons name={showSessionPicker ? "chevron-up" : "chevron-down"} size={16} color={theme.textLight} /></TouchableOpacity>
        {showSessionPicker && <View style={styles.sessionMenuPicker}>
            {sessions.map((session) => (
              <View key={session.id} style={styles.sessionMenuItem}>
                {editingSessionId === session.id ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TextInput style={styles.sessionMenuInput} value={newSessionName} onChangeText={setNewSessionName} autoFocus />
                    <TouchableOpacity onPress={() => handleUpdateSession(session.id, newSessionName, session.is_active)}><Ionicons name="checkmark-circle" size={24} color="#27AE60" /></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.sessionMenuRow} onPress={() => handleUpdateSession(session.id, session.name, true)}>
                    <Text style={[styles.sessionMenuName, session.id === selectedSessionId && { color: theme.primary, fontWeight: '800' }]}>{session.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      {session.id === selectedSessionId && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                      <TouchableOpacity onPress={() => { setEditingSessionId(session.id); setNewSessionName(session.name); }}><Ionicons name="create-outline" size={16} color={theme.textLight} /></TouchableOpacity>
                      {!session.is_active && <TouchableOpacity onPress={() => handleDeleteSession(session.id, session.name)}><Ionicons name="trash-outline" size={16} color={theme.danger} /></TouchableOpacity>}
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {isAddingSession ? (
              <View style={styles.addSessionMenuRow}><TextInput style={styles.sessionMenuInput} placeholder="e.g. 2025-26" value={newSessionName} onChangeText={setNewSessionName} autoFocus /><TouchableOpacity onPress={handleAddSession}><Ionicons name="add-circle" size={28} color={theme.primary} /></TouchableOpacity></View>
            ) : (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 5 }} onPress={() => { setIsAddingSession(true); setNewSessionName(''); }}><Ionicons name="add" size={16} color={theme.primary} /><Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700' }}>Add Session</Text></TouchableOpacity>
            )}
        </View>}

        <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}><Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={theme.text} /><Text style={styles.menuText}>{isDark ? 'Light' : 'Dark'}</Text></TouchableOpacity><TouchableOpacity style={styles.menuItem} onPress={handleLogout}><Ionicons name="log-out-outline" size={20} color={theme.danger} /><Text style={[styles.menuText, { color: theme.danger }]}>Logout</Text></TouchableOpacity></View></TouchableOpacity></Modal>

      <Modal visible={showNotifList} transparent animationType="fade" onRequestClose={() => setShowNotifList(false)}><TouchableOpacity style={styles.notifModalOverlay} activeOpacity={1} onPress={() => setShowNotifList(false)}><View style={styles.notifDropdown}><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}><Text style={{ fontWeight: '800', fontSize: 16, color: theme.text }}>Recent Updates</Text><TouchableOpacity onPress={clearAllNotifications}><Text style={{ color: '#ef4444', fontWeight: '700' }}>Clear All</Text></TouchableOpacity></View><ScrollView style={{ maxHeight: 400 }}>{notifications.map((item) => (<View key={item.id} style={styles.notifItem}><View style={[styles.notifItemDot, { backgroundColor: item.type === 'fee' ? '#10b981' : '#f59e0b' }]} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: theme.text }}>{item.title}</Text><Text style={{ fontSize: 12, color: theme.textLight }}>{item.message}</Text></View><Text style={{ fontSize: 10, color: theme.textLight }}>{item.time}</Text></View>))}</ScrollView></View></TouchableOpacity></Modal>
      {showAccountMenu && <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAccountMenu(false)}><View style={styles.accountMenu}><Text style={{ fontSize: 12, fontWeight: '800', color: theme.textLight, marginBottom: 15, textTransform: 'uppercase' }}>Switch Account</Text>{savedAccounts.map((acc, index) => (<TouchableOpacity key={index} style={[styles.accountItem, userData?.email === acc.email && { backgroundColor: theme.primary + '10' }]} onPress={() => switchAccount(acc)}><Image source={acc.logo_url ? { uri: acc.logo_url } : require('../../assets/images/react-logo.png')} style={styles.accountLogo} /><View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{acc.userData?.institute_name || 'Institute'}</Text><Text style={{ fontSize: 12, color: theme.textLight }}>{acc.email}</Text></View>{userData?.email === acc.email && <Ionicons name="checkmark-circle" size={20} color="#27AE60" />}</TouchableOpacity>))}<TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 15, marginTop: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.primary, borderRadius: 15 }} onPress={() => { setShowAccountMenu(false); router.replace('/(auth)/institute-login'); }}><Ionicons name="add-circle-outline" size={24} color={theme.primary} /><Text style={{ marginLeft: 12, color: theme.primary, fontWeight: '800' }}>Login to another account</Text></TouchableOpacity></View></TouchableOpacity>}
    </View>
  );
}
