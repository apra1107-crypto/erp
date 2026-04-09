import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    Modal,
    FlatList,
    Dimensions,
    StatusBar,
    Image,
    Platform,
    BackHandler,
    Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_ENDPOINTS, BASE_URL } from '../../constants/Config';
import { getFullImageUrl } from '../../utils/imageHelper';
import { useNavigation } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolateColor } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const ModernToggle = ({ value, onValueChange, activeColor }: { value: boolean, onValueChange: (v: boolean) => void, activeColor: string }) => {
    const translateX = useSharedValue(value ? 20 : 0);
    
    useEffect(() => {
        translateX.value = withSpring(value ? 22 : 2, { damping: 15, stiffness: 150 });
    }, [value]);

    const animatedThumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }]
    }));

    const animatedTrackStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            translateX.value,
            [2, 22],
            ['#E9E9EB', activeColor]
        );
        return { backgroundColor };
    });

    return (
        <TouchableOpacity activeOpacity={1} onPress={() => onValueChange(!value)}>
            <Animated.View style={[{ width: 50, height: 28, borderRadius: 15, justifyContent: 'center', paddingHorizontal: 2 }, animatedTrackStyle]}>
                <Animated.View style={[{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 }, animatedThumbStyle]} />
            </Animated.View>
        </TouchableOpacity>
    );
};

interface ClassSection {
    class: string | number;
    section: string;
}

interface ScheduleRow {
    date: string;
    day: string;
    subject: string;
    time: string;
    startTime?: string;
    endTime?: string;
}

interface AdmitCardEvent {
    id: string | number;
    exam_name: string;
    classes: ClassSection[];
    schedule: ScheduleRow[];
    created_at?: string;
    is_published: boolean;
}

interface Student {
    id: string | number;
    name: string;
    roll_no: string;
    class: string | number;
    section: string;
    father_name: string;
    mobile: string;
    photo_url?: string;
    photoB64?: string | null;
    dob?: string;
}

interface InstituteProfile {
    institute_name: string;
    affiliation?: string;
    address?: string;
    institute_address?: string;
    landmark?: string;
    district?: string;
    state?: string;
    pincode?: string;
    logo_url?: string;
    institute_logo?: string;
}

const AdmitCardScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    const [admitCardEvents, setAdmitCardEvents] = useState<AdmitCardEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'create' | 'event-details' | 'individual-preview'>('list');
    
    // Form States
    const [examName, setExamName] = useState('');
    const [availableClassSections, setAvailableClassSections] = useState<ClassSection[]>([]);
    const [selectedClasses, setSelectedClasses] = useState<ClassSection[]>([]); 
    const [schedule, setSchedule] = useState<ScheduleRow[]>([{ date: '', day: '', subject: '', time: '', startTime: '', endTime: '' }]);
    const [creationStep, setCreationStep] = useState(1);

    // View States
    const [currentEvent, setCurrentEvent] = useState<AdmitCardEvent | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
    const [activeClassTab, setActiveClassTab] = useState<string | null>(null);
    const [selectionMap, setSelectionMap] = useState<Record<string, boolean>>({});
    const [instProfile, setInstProfile] = useState<InstituteProfile | null>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [filterTitle, setFilterTitle] = useState('All');
    const [filterClass, setFilterClass] = useState('All');
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
    
    // Schedule Date Picker States
    const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);
    const [activeScheduleRowIdx, setActiveScheduleRowIdx] = useState<number | null>(null);

    // Time Picker States
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [activeTimeRowIdx, setActiveTimeRowIdx] = useState<number | null>(null);

    const uniqueTitles = useMemo(() => {
        const titles = ['All', ...new Set(admitCardEvents.map(e => e.exam_name))];
        return titles;
    }, [admitCardEvents]);

    const uniqueClasses = useMemo(() => {
        const classes = new Set<string>();
        admitCardEvents.forEach(event => {
            event.classes.forEach(c => classes.add(String(c.class)));
        });
        return ['All', ...Array.from(classes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))];
    }, [admitCardEvents]);

    const filteredEvents = useMemo(() => {
        return admitCardEvents.filter(event => {
            const matchTitle = filterTitle === 'All' || event.exam_name === filterTitle;
            const matchClass = filterClass === 'All' || event.classes.some(c => String(c.class) === filterClass);
            return matchTitle && matchClass;
        });
    }, [admitCardEvents, filterTitle, filterClass]);

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15 },
        backBtnHeader: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
        title: { fontSize: 24, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
        subtitle: { fontSize: 13, color: theme.textLight, fontWeight: '600', marginTop: 2 },
        floatingAddBtn: {
            position: 'absolute',
            bottom: 15,
            right: 25,
            width: 65,
            height: 65,
            borderRadius: 32.5,
            backgroundColor: theme.primary,
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 8,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            zIndex: 999,
        },
        emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
        emptyText: { fontSize: 18, color: theme.textLight, marginVertical: 20, fontWeight: '700' },
        createBtn: { paddingVertical: 14, paddingHorizontal: 28, backgroundColor: theme.primary, borderRadius: 15, elevation: 4 },
        createBtnText: { color: '#fff', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
        grid: { padding: 20 },
        eventCard: { backgroundColor: theme.card, borderRadius: 24, padding: 20, marginBottom: 18, elevation: 3, position: 'relative', borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
        eventIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 18 },
        eventName: { fontSize: 18, fontWeight: '900', color: theme.text, marginBottom: 6, letterSpacing: -0.3 },
        eventMetaRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
        metaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1b2c1b' : '#e8f5e9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
        metaBadgeText: { fontSize: 11, fontWeight: '800', color: '#27ae60' },
        classChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
        miniClassChip: { fontSize: 10, fontWeight: '800', color: theme.primary, backgroundColor: theme.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: theme.primary + '20' },
        deleteIcon: { padding: 8, position: 'absolute', bottom: 12, right: 12, backgroundColor: theme.danger + '10', borderRadius: 10 },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 15 },
        modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
        createContent: { padding: 20 },
        inputGroup: { marginBottom: 20 },
        label: { fontSize: 14, fontWeight: '800', color: theme.text, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
        input: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 15, padding: 15, fontSize: 16, color: theme.text, fontWeight: '600' },
        chipContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, gap: 10 },
        chip: { paddingVertical: 10, paddingHorizontal: 18, backgroundColor: theme.card, borderRadius: 15, borderWidth: 1, borderColor: theme.border },
        chipSelected: { backgroundColor: theme.primary, borderColor: theme.primary, elevation: 4, shadowColor: theme.primary, shadowOpacity: 0.3 },
        chipText: { color: theme.textLight, fontSize: 14, fontWeight: '700' },
        chipTextSelected: { color: '#fff', fontWeight: '800' },
        footer: { 
            paddingHorizontal: 25, 
            paddingTop: 0,
            paddingBottom: 5,
            backgroundColor: 'transparent', 
        },
        footerRow: { flexDirection: 'row', gap: 12 },
        primaryBtn: { backgroundColor: theme.primary, padding: 18, borderRadius: 18, alignItems: 'center', elevation: 4, shadowColor: theme.primary, shadowOpacity: 0.3 },
        primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
        secondaryBtn: { backgroundColor: isDark ? '#222' : '#f1f5f9', padding: 18, borderRadius: 18, alignItems: 'center', borderWidth: 1, borderColor: theme.border, minWidth: 100 },
        secondaryBtnText: { color: theme.text, fontSize: 16, fontWeight: '800' },
        scheduleRow: { backgroundColor: theme.card, padding: 20, borderRadius: 24, marginBottom: 18, borderWidth: 1, borderColor: theme.border, elevation: 2 },
        rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
        rowNum: { fontSize: 14, fontWeight: '900', color: theme.primary, textTransform: 'uppercase' },
        rowInputs: { flexDirection: 'row', gap: 10 },
        addRowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderStyle: 'dashed', borderWidth: 2, borderColor: theme.primary, borderRadius: 18, marginTop: 10, backgroundColor: theme.primary + '05' },
        addRowBtnText: { marginLeft: 8, color: theme.primary, fontWeight: '900', fontSize: 15 },
        tabBarContainer: { paddingVertical: 10, marginBottom: 5 },
        tabBar: { paddingHorizontal: 20, gap: 10 },
        tab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 15, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
        tabActive: { backgroundColor: theme.primary, borderColor: theme.primary, elevation: 4, shadowColor: theme.primary, shadowOpacity: 0.3 },
        tabText: { color: theme.textLight, fontWeight: '800', fontSize: 14 },
        tabTextActive: { color: '#fff' },
        studentList: { padding: 20 },
        studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 15, borderRadius: 24, marginBottom: 15, elevation: 2, borderWidth: 1, borderColor: theme.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
        studentCardSelected: { borderColor: theme.primary, backgroundColor: isDark ? theme.primary + '10' : theme.primary + '05', borderWidth: 2 },
        studentAvatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
        avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
        avatarText: { color: theme.primary, fontWeight: '900', fontSize: 22 },
        studentInfo: { flex: 1 },
        studentName: { fontSize: 17, fontWeight: '900', color: theme.text, marginBottom: 4, letterSpacing: -0.3 },
        studentRollContainer: { flexDirection: 'row', alignItems: 'center' },
        studentRollLabel: { fontSize: 11, color: theme.textLight, fontWeight: '800' },
        studentRollValue: { fontSize: 12, color: theme.primary, fontWeight: '900', marginLeft: 4 },
        classBadge: { backgroundColor: theme.primary + '10', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 },
        classBadgeText: { fontSize: 10, color: theme.primary, fontWeight: '900', textTransform: 'uppercase' },
        checkbox: { width: 28, height: 28, borderRadius: 10, borderWidth: 2, borderColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
        checkboxSelected: { backgroundColor: theme.primary },
        selectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 15 },
        selectionHeaderText: { fontSize: 15, fontWeight: '800', color: theme.textLight },
        bulkFooter: { position: 'absolute', bottom: Math.max(30, insets.bottom + 15), left: 20, right: 20, zIndex: 1000 },
        downloadBtn: { backgroundColor: theme.success, padding: 20, borderRadius: 22, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: theme.success, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12 },
        downloadBtnText: { color: '#fff', fontSize: 17, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },

        // Individual Preview Styles
        previewScroll: { flex: 1, backgroundColor: isDark ? '#000' : '#f8f9fa' },
        previewContainer: { padding: 20, alignItems: 'center' },
        admitCardPaper: {
            width: width - 40,
            backgroundColor: '#fff',
            padding: 25,
            borderWidth: 2,
            borderColor: '#000',
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 15,
        },
        paperHeader: { alignItems: 'center', paddingBottom: 15, marginBottom: 20 },
        paperInstName: { fontSize: 24, fontWeight: '900', color: '#000', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1 },
        paperInstSub: { fontSize: 11, color: '#333', textAlign: 'center', marginTop: 6, fontWeight: '700', lineHeight: 16 },
        paperExamTitle: { fontSize: 18, fontWeight: '900', color: '#000', borderWidth: 2, borderColor: '#000', paddingHorizontal: 20, paddingVertical: 8, marginTop: 20, textTransform: 'uppercase' },
        paperInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
        paperTable: { flex: 1, marginRight: 15 },
        paperTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 6 },
        paperLabel: { width: 110, fontSize: 10, fontWeight: 'bold', color: '#555', textTransform: 'uppercase' },
        paperValue: { flex: 1, fontSize: 13, fontWeight: '900', color: '#000' },
        paperPhoto: { width: 110, height: 135, borderWidth: 2, borderColor: '#000', backgroundColor: '#f9f9f9', justifyContent: 'center', alignItems: 'center' },
        paperTimetable: { marginBottom: 25 },
        paperTableTitle: { fontSize: 13, fontWeight: '900', textDecorationLine: 'underline', marginBottom: 12, color: '#000', letterSpacing: 0.5 },
        paperGrid: { borderWidth: 2, borderColor: '#000' },
        paperGridHeader: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderBottomWidth: 2, borderBottomColor: '#000' },
        paperGridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000' },
        paperGridCell: { padding: 10, borderRightWidth: 1, borderRightColor: '#000', flex: 1 },
        paperGridText: { fontSize: 10, fontWeight: 'bold', color: '#000' },
        paperInstructions: { borderWidth: 1.5, borderColor: '#000', padding: 12, borderRadius: 4, backgroundColor: '#fdfdfd' },
        paperInstTitle: { fontSize: 11, fontWeight: '900', textDecorationLine: 'underline', marginBottom: 8 },
        paperInstItem: { fontSize: 10, fontWeight: '700', color: '#333', marginBottom: 4, lineHeight: 14 },
        paperFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 60, paddingHorizontal: 10 },
        paperSigLine: { borderTopWidth: 1.5, borderTopColor: '#000', width: 130, alignItems: 'center', paddingTop: 8 },
        paperSigText: { fontSize: 10, fontWeight: '900' },
        modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
    }), [theme, isDark, insets]);

    useEffect(() => {
        const backAction = () => {
            if (viewMode === 'individual-preview') {
                setViewMode('event-details');
                return true;
            } else if (viewMode === 'event-details' || viewMode === 'create') {
                setViewMode('list');
                setIsSelectionMode(false);
                setSelectionMap({});
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [viewMode]);

    useEffect(() => {
        fetchAdmitCardEvents();
        fetchClassSections();
        fetchInstituteProfile();
    }, []);

    const fetchInstituteProfile = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const response = await axios.get(`${API_ENDPOINTS.AUTH.TEACHER}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const profile = response.data.teacher;
            setInstProfile({
                institute_name: profile.institute_name,
                affiliation: profile.affiliation,
                address: profile.institute_address,
                logo_url: profile.institute_logo
            });
        } catch (error) {
            console.error('Error fetching institute profile:', error);
        }
    };

    const fetchAdmitCardEvents = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            const response = await axios.get(`${API_ENDPOINTS.ADMIT_CARD}/list`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            setAdmitCardEvents(response.data || []);
        } catch (error) {
            console.error('Error fetching admit cards:', error);
            Toast.show({ type: 'error', text1: 'Failed to load admit card events' });
        } finally {
            setLoading(false);
        }
    };

    const toggleVisibility = async (event: AdmitCardEvent) => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);
            const newStatus = !event.is_published;
            
            setAdmitCardEvents(prev => prev.map(e => 
                e.id === event.id ? { ...e, is_published: newStatus } : e
            ));

            await axios.patch(`${API_ENDPOINTS.ADMIT_CARD}/visibility/${event.id}`, 
                { is_published: newStatus },
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    } 
                }
            );

            Toast.show({ 
                type: 'success', 
                text1: newStatus ? 'Published' : 'Unpublished',
                text2: newStatus ? 'Students can now see this admit card' : 'Hidden from student dashboard'
            });
        } catch (error: any) {
            fetchAdmitCardEvents();
            Toast.show({ type: 'error', text1: 'Update failed', text2: error.response?.data?.message || '' });
        }
    };

    const fetchClassSections = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            const response = await axios.get(`${API_ENDPOINTS.TEACHER}/student/list`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            const allStudents = response.data.students || [];
            const unique: ClassSection[] = [];
            const map = new Map();
            for (const s of allStudents) {
                const key = `${s.class}-${s.section}`;
                if (!map.has(key)) {
                    map.set(key, true);
                    unique.push({ class: s.class, section: s.section });
                }
            }
            setAvailableClassSections(unique.sort((a, b) => String(a.class).localeCompare(String(b.class), undefined, { numeric: true }) || a.section.localeCompare(b.section)));
        } catch (error) {
            console.error('Error fetching classes:', error);
        }
    };

    const handleClassToggle = (cs: ClassSection) => {
        const index = selectedClasses.findIndex(item => item.class === cs.class && item.section === cs.section);
        if (index > -1) {
            setSelectedClasses(selectedClasses.filter((_, i) => i !== index));
        } else {
            setSelectedClasses([...selectedClasses, cs]);
        }
    };

    const addScheduleRow = () => {
        const lastRow = schedule[schedule.length - 1];
        setSchedule([...schedule, {
            date: '',
            day: '',
            subject: '',
            time: lastRow ? lastRow.time : '',
            startTime: lastRow ? lastRow.startTime : '',
            endTime: lastRow ? lastRow.endTime : ''
        }]);
    };

    const updateScheduleRow = (index: number, field: keyof ScheduleRow, value: string) => {
        const newSchedule = [...schedule];
        // @ts-ignore
        newSchedule[index][field] = value;
        if (field === 'date' && value) {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dateObj = new Date(value);
            if (!isNaN(dateObj.getTime())) {
                newSchedule[index].day = days[dateObj.getDay()];
            }
        }
        
        if (field === 'startTime' || field === 'endTime') {
            const s = newSchedule[index].startTime || '';
            const e = newSchedule[index].endTime || '';
            if (s && e) newSchedule[index].time = `${s} - ${e}`;
            else if (s) newSchedule[index].time = s;
            else if (e) newSchedule[index].time = e;
        }
        
        setSchedule(newSchedule);
    };

    const handleCreateEvent = async () => {
        if (!examName) return Alert.alert('Error', 'Enter exam name');
        if (selectedClasses.length === 0) return Alert.alert('Error', 'Select at least one class');
        if (schedule.some(s => !s.date || !s.subject || !s.time)) return Alert.alert('Error', 'Fill all schedule details');

        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            await axios.post(`${API_ENDPOINTS.ADMIT_CARD}/create`, {
                exam_name: examName,
                classes: selectedClasses,
                schedule: schedule
            }, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            Toast.show({ type: 'success', text1: 'Admit Card Event Created!' });
            setViewMode('list');
            fetchAdmitCardEvents();
            resetForm();
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Failed to create admit card' });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setExamName('');
        setSelectedClasses([]);
        setSchedule([{ date: '', day: '', subject: '', time: '', startTime: '', endTime: '' }]);
        setCreationStep(1);
    };

    const handleViewEvent = async (event: AdmitCardEvent) => {
        setCurrentEvent(event);
        setViewMode('event-details');
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            const response = await axios.post(`${API_ENDPOINTS.ADMIT_CARD}/students`, {
                classes: event.classes
            }, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            setStudents(response.data);
            const firstClass = event.classes[0];
            if (firstClass) {
                setActiveClassTab(`${firstClass.class}-${firstClass.section}`);
                setFilteredStudents(response.data.filter((s: Student) => s.class === firstClass.class && s.section === firstClass.section));
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Failed to load students' });
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (cs: ClassSection) => {
        const key = `${cs.class}-${cs.section}`;
        setActiveClassTab(key);
        setFilteredStudents(students.filter(s => s.class === cs.class && s.section === cs.section));
    };

    const toggleStudentSelection = (studentId: string | number) => {
        setSelectionMap(prev => ({
            ...prev,
            [studentId]: !prev[studentId]
        }));
    };

    const getSelectedCount = () => {
        return Object.values(selectionMap).filter(Boolean).length;
    };

    const formatDateString = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    const getFullImageUrl = (url: string | null | undefined): string | null => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

        const generatePDF = async (isBulk: boolean) => {

            if (!currentEvent) return Alert.alert('Error', 'No exam event selected');

            

            let studentIdsToGenerate: (string | number)[] = [];

    

            if (isBulk) {

                studentIdsToGenerate = Object.keys(selectionMap).filter(id => selectionMap[id]);

                if (studentIdsToGenerate.length === 0) {

                    return Alert.alert('Warning', 'Select students first for bulk generation');

                }

            } else {

                // Individual generation

                if (!selectedStudent) {

                    return Alert.alert('Error', 'No student selected for individual PDF generation');

                }

                studentIdsToGenerate = [selectedStudent.id];

            }

    

            try {

                setIsGeneratingPDF(true);

                const token = await AsyncStorage.getItem('teacherToken');

                const storedSessionId = await AsyncStorage.getItem('selectedSessionId');

                const userDataStr = await AsyncStorage.getItem('teacherData');

                const userData = userDataStr ? JSON.parse(userDataStr) : null;

                const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

                

                const response = await axios.post(

                    `${API_ENDPOINTS.ADMIT_CARD}/generate-bulk-pdf/${currentEvent.id}`,

                    { studentIds: studentIdsToGenerate },

                    {

                        headers: { 

                            Authorization: `Bearer ${token}`,

                            'x-academic-session-id': sessionId?.toString()

                        },

                        responseType: 'arraybuffer',

                        timeout: 300000 // 5 minutes for heavy PDF generation

                    }

                );

    

                // Efficient ArrayBuffer to Base64 conversion using chunking for large files

                const arrayBuffer = response.data; // This is the ArrayBuffer

                const chunkSize = 16 * 1024; // Process in 16KB chunks (adjust as needed)

                let base64 = '';

                const bytes = new Uint8Array(arrayBuffer);

                const len = bytes.byteLength;

    

                for (let i = 0; i < len; i += chunkSize) {

                    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));

                    base64 += String.fromCharCode.apply(null, Array.from(chunk));

                }

                const base64data = btoa(base64);

    

                                const fileName = `admit_cards_${currentEvent.id}_${isBulk ? 'bulk' : studentIdsToGenerate[0]}_${Date.now()}.pdf`;

    

                                const fileUri = `${cacheDirectory}${fileName}`;

    

                

    

                                await writeAsStringAsync(fileUri, base64data, {

    

                                    encoding: 'base64',

    

                                });

    

                await Sharing.shareAsync(fileUri, {

                    UTI: '.pdf',

                    mimeType: 'application/pdf',

                    dialogTitle: 'Admit Cards'

                });

    

                setIsSelectionMode(false);

                setSelectionMap({});

            } catch (error: any) {

                console.error('Admit Card PDF generation error:', error.message);

                Alert.alert('Error', `Failed to generate PDF: ${error.message}`);

            } finally {

                setIsGeneratingPDF(false);

            }

        };

    const handleDeleteEvent = async (id: string | number) => {
        Alert.alert(
            'Confirm Delete',
            'Are you sure you want to delete this admit card event?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('teacherToken');
                            await axios.delete(`${API_ENDPOINTS.ADMIT_CARD}/${id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            Toast.show({ type: 'success', text1: 'Deleted successfully' });
                            fetchAdmitCardEvents();
                        } catch (error) {
                            Toast.show({ type: 'error', text1: 'Failed to delete' });
                        }
                    }
                }
            ]
        );
    };

    const renderList = () => (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View style={styles.headerRow}>
                    <TouchableOpacity 
                        onPress={() => navigation.goBack()} 
                        style={[styles.backBtnHeader, { marginRight: 12 }]}
                    >
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Admit Card</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => setIsFilterModalVisible(true)} 
                        style={[
                            styles.backBtnHeader, 
                            (filterTitle !== 'All' || filterClass !== 'All') && { backgroundColor: theme.primary + '15', borderColor: theme.primary }
                        ]}
                    >
                        <Ionicons name="filter" size={22} color={(filterTitle !== 'All' || filterClass !== 'All') ? theme.primary : theme.text} />
                        {(filterTitle !== 'All' || filterClass !== 'All') && (
                            <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary, borderWidth: 1.5, borderColor: theme.card }} />
                        )}
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                ) : filteredEvents.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="document-text-outline" size={80} color={theme.border} />
                        <Text style={styles.emptyText}>
                            {filterTitle === 'All' ? 'No exam events found' : `No events found for ${filterTitle}`}
                        </Text>
                        {filterTitle === 'All' && (
                            <TouchableOpacity style={styles.createBtn} onPress={() => setViewMode('create')}>
                                <Text style={styles.createBtnText}>Create Your First Event</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {filteredEvents.map(event => (
                            <TouchableOpacity 
                                key={event.id} 
                                style={styles.eventCard}
                                onPress={() => handleViewEvent(event)}
                                activeOpacity={0.9}
                            >
                                {/* Top Right Toggle Switch */}
                                <View style={{ position: 'absolute', top: 15, right: 15, zIndex: 10, alignItems: 'center' }}>
                                    <ModernToggle
                                        value={event.is_published}
                                        onValueChange={() => toggleVisibility(event)}
                                        activeColor={theme.success}
                                    />
                                    <Text style={{ fontSize: 8, fontWeight: '900', color: event.is_published ? theme.success : theme.textLight, marginTop: 4 }}>
                                        {event.is_published ? 'LIVE' : 'HIDDEN'}
                                    </Text>
                                </View>

                                <View style={styles.eventIcon}>
                                    <Ionicons name="document-text" size={28} color={theme.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.eventName}>{event.exam_name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                                        <Ionicons name="calendar-outline" size={12} color={theme.textLight} />
                                        <Text style={{ fontSize: 11, color: theme.textLight, fontWeight: '700' }}>
                                            {event.created_at ? new Date(event.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                        </Text>
                                    </View>
                                    <View style={styles.classChipsRow}>
                                        {event.classes?.slice(0, 3).map((c, idx) => (
                                            <Text key={idx} style={styles.miniClassChip}>Cl {c.class}-{c.section}</Text>
                                        ))}
                                        {event.classes?.length > 3 && <Text style={styles.miniClassChip}>+{event.classes.length - 3} More</Text>}
                                    </View>
                                </View>

                                {/* Bottom Right Delete */}
                                <TouchableOpacity 
                                    style={styles.deleteIcon}
                                    onPress={() => handleDeleteEvent(event.id)}
                                >
                                    <Ionicons name="trash-outline" size={18} color={theme.danger} />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))}
                        <View style={{ height: 100 }} />
                    </View>
                )}
            </ScrollView>

            <TouchableOpacity 
                style={styles.floatingAddBtn} 
                onPress={() => setViewMode('create')}
                activeOpacity={0.8}
            >
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>

            {/* Filter Bottom Sheet */}
            <Modal
                visible={isFilterModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsFilterModalVisible(false)}
            >
                <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} 
                    activeOpacity={1} 
                    onPress={() => setIsFilterModalVisible(false)}
                >
                    <TouchableOpacity 
                        activeOpacity={1} 
                        style={{ 
                            backgroundColor: theme.card, 
                            borderTopLeftRadius: 30, 
                            borderTopRightRadius: 30, 
                            padding: 25, 
                            paddingBottom: insets.bottom + 30 
                        }}
                    >
                        <View style={{ width: 40, height: 5, backgroundColor: theme.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                            <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text }}>Filter Exams</Text>
                            <TouchableOpacity onPress={() => { setFilterTitle('All'); setFilterClass('All'); setIsFilterModalVisible(false); }}>
                                <Text style={{ fontSize: 14, fontWeight: '800', color: theme.danger }}>Reset</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 }}>Exam Name</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 }}>
                                {uniqueTitles.map((title) => (
                                    <TouchableOpacity
                                        key={title}
                                        style={[
                                            { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 15, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                                            filterTitle === title && { backgroundColor: theme.primary, borderColor: theme.primary }
                                        ]}
                                        onPress={() => setFilterTitle(title)}
                                    >
                                        <Text style={[{ fontSize: 14, fontWeight: '700', color: theme.text }, filterTitle === title && { color: '#fff', fontWeight: '800' }]}>{title}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 }}>Class</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                {uniqueClasses.map((cls) => (
                                    <TouchableOpacity
                                        key={cls}
                                        style={[
                                            { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 15, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                                            filterClass === cls && { backgroundColor: theme.primary, borderColor: theme.primary }
                                        ]}
                                        onPress={() => setFilterClass(cls)}
                                    >
                                        <Text style={[{ fontSize: 14, fontWeight: '700', color: theme.text }, filterClass === cls && { color: '#fff', fontWeight: '800' }]}>{cls === 'All' ? 'All Classes' : `Class ${cls}`}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <TouchableOpacity 
                            style={{ backgroundColor: theme.primary, paddingVertical: 18, borderRadius: 20, alignItems: 'center', marginTop: 30 }}
                            onPress={() => setIsFilterModalVisible(false)}
                        >
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Apply Filters</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );

    const renderCreate = () => (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
                <TouchableOpacity style={styles.backBtnHeader} onPress={() => { setViewMode('list'); resetForm(); }}>
                    <Ionicons name="chevron-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                    {creationStep === 1 ? 'Configure' : 'Schedule'}
                </Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.createContent} showsVerticalScrollIndicator={false}>
                {creationStep === 1 ? (
                    <View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Examination Title</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Final Term 2026"
                                placeholderTextColor={theme.textLight}
                                value={examName}
                                onChangeText={setExamName}
                            />
                        </View>

                        <Text style={styles.label}>Select Target Classes</Text>
                        <View style={styles.chipContainer}>
                            {availableClassSections.map((cs, i) => {
                                const isSelected = selectedClasses.some(item => item.class === cs.class && item.section === cs.section);
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        style={[styles.chip, isSelected && styles.chipSelected]}
                                        onPress={() => handleClassToggle(cs)}
                                    >
                                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                            {cs.class}-{cs.section}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                ) : (
                    <View>
                        {schedule.map((row, i) => (
                            <View key={i} style={styles.scheduleRow}>
                                <View style={styles.rowHeader}>
                                    <Text style={styles.rowNum}>Date {i + 1}</Text>
                                    <TouchableOpacity onPress={() => setSchedule(schedule.filter((_, idx) => idx !== i))}>
                                        <Ionicons name="close-circle" size={24} color={theme.danger + '80'} />
                                    </TouchableOpacity>
                                </View>
                                
                                <View style={[styles.rowInputs, { marginBottom: 12 }]}>
                                    {/* Date Selection */}
                                    <TouchableOpacity 
                                        style={[styles.input, { flex: 1, justifyContent: 'center' }]} 
                                        onPress={() => {
                                            setActiveScheduleRowIdx(i);
                                            setShowScheduleDatePicker(true);
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="calendar-outline" size={18} color={theme.primary} style={{ marginRight: 8 }} />
                                            <Text style={{ color: row.date ? theme.text : theme.textLight, fontSize: 14, fontWeight: '600' }}>
                                                {row.date ? formatDateString(row.date) : 'Date'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    {/* Subject Input */}
                                    <TextInput
                                        style={[styles.input, { flex: 1.2 }]}
                                        placeholder="Subject"
                                        placeholderTextColor={theme.textLight}
                                        value={row.subject}
                                        onChangeText={(v) => updateScheduleRow(i, 'subject', v)}
                                    />
                                </View>

                                {/* Professional Time Pickers */}
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TouchableOpacity 
                                        style={[styles.input, { flex: 1, justifyContent: 'center', backgroundColor: isDark ? '#1a1a1a' : '#f8fafc' }]}
                                        onPress={() => {
                                            setActiveTimeRowIdx(i);
                                            setShowStartTimePicker(true);
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="time-outline" size={18} color="#10b981" style={{ marginRight: 8 }} />
                                            <View>
                                                <Text style={{ fontSize: 9, color: theme.textLight, fontWeight: '800', textTransform: 'uppercase' }}>Start</Text>
                                                <Text style={{ color: row.startTime ? theme.text : theme.textLight, fontSize: 14, fontWeight: '700' }}>
                                                    {row.startTime || '--:--'}
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={[styles.input, { flex: 1, justifyContent: 'center', backgroundColor: isDark ? '#1a1a1a' : '#f8fafc' }]}
                                        onPress={() => {
                                            setActiveTimeRowIdx(i);
                                            setShowEndTimePicker(true);
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="time-outline" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                                            <View>
                                                <Text style={{ fontSize: 9, color: theme.textLight, fontWeight: '800', textTransform: 'uppercase' }}>End</Text>
                                                <Text style={{ color: row.endTime ? theme.text : theme.textLight, fontSize: 14, fontWeight: '700' }}>
                                                    {row.endTime || '--:--'}
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity style={styles.addRowBtn} onPress={addScheduleRow}>
                            <Ionicons name="add-circle" size={24} color={theme.primary} />
                            <Text style={styles.addRowBtnText}>Add New Subject</Text>
                        </TouchableOpacity>
                        <View style={{ height: 100 }} />
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                {creationStep === 1 ? (
                    <TouchableOpacity 
                        style={styles.primaryBtn} 
                        onPress={() => (examName && selectedClasses.length > 0) ? setCreationStep(2) : Alert.alert('Error', 'Fill all details')}
                    >
                        <Text style={styles.primaryBtnText}>Next: Schedule Details</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.footerRow}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCreationStep(1)}>
                            <Text style={styles.secondaryBtnText}>Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={handleCreateEvent}>
                            <Text style={styles.primaryBtnText}>Finalize & Create</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {showScheduleDatePicker && (
                <DateTimePicker
                    value={activeScheduleRowIdx !== null && schedule[activeScheduleRowIdx].date ? new Date(schedule[activeScheduleRowIdx].date) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                        setShowScheduleDatePicker(false);
                        if (date && activeScheduleRowIdx !== null) {
                            const dateStr = date.toISOString().split('T')[0];
                            updateScheduleRow(activeScheduleRowIdx, 'date', dateStr);
                        }
                    }}
                />
            )}

            {showStartTimePicker && (
                <DateTimePicker
                    value={new Date()}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    onChange={(event, date) => {
                        setShowStartTimePicker(false);
                        if (date && activeTimeRowIdx !== null) {
                            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                            updateScheduleRow(activeTimeRowIdx, 'startTime', timeStr);
                        }
                    }}
                />
            )}

            {showEndTimePicker && (
                <DateTimePicker
                    value={new Date()}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    onChange={(event, date) => {
                        setShowEndTimePicker(false);
                        if (date && activeTimeRowIdx !== null) {
                            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                            updateScheduleRow(activeTimeRowIdx, 'endTime', timeStr);
                        }
                    }}
                />
            )}
        </View>
    );

    const renderDetails = () => (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.modalHeader}>
                <TouchableOpacity style={styles.backBtnHeader} onPress={() => { setViewMode('list'); setIsSelectionMode(false); }}>
                    <Ionicons name="chevron-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={styles.modalTitle} numberOfLines={1}>{currentEvent?.exam_name}</Text>
                </View>
                <TouchableOpacity 
                    onPress={() => {
                        setIsSelectionMode(!isSelectionMode);
                        if (isSelectionMode) setSelectionMap({});
                    }}
                    style={{ padding: 5 }}
                >
                    <Ionicons 
                        name={isSelectionMode ? "close-circle" : "checkmark-done-circle-outline"} 
                        size={28} 
                        color={isSelectionMode ? theme.danger : theme.primary} 
                    />
                </TouchableOpacity>
            </View>

            <View style={styles.tabBarContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
                    {currentEvent?.classes.map((cs, i) => {
                        const key = `${cs.class}-${cs.section}`;
                        return (
                            <TouchableOpacity
                                key={i}
                                style={[styles.tab, activeClassTab === key && styles.tabActive]}
                                onPress={() => handleTabChange(cs)}
                            >
                                <Text style={[styles.tabText, activeClassTab === key && styles.tabTextActive]}>
                                    Class {cs.class}-{cs.section}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {isSelectionMode && (
                <View style={styles.selectionHeader}>
                    <Text style={styles.selectionHeaderText}>
                        {getSelectedCount()} Selected
                    </Text>
                    <TouchableOpacity onPress={() => {
                        const allSelected = filteredStudents.every(s => selectionMap[s.id]);
                        const newMap = { ...selectionMap };
                        filteredStudents.forEach(s => newMap[s.id] = !allSelected);
                        setSelectionMap(newMap);
                    }}>
                        <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 14 }}>
                            {filteredStudents.every(s => selectionMap[s.id]) ? 'DESELECT ALL' : 'SELECT ALL'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredStudents}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={[
                                styles.studentCard, 
                                isSelectionMode && selectionMap[item.id] && styles.studentCardSelected
                            ]}
                            onPress={() => {
                                if (isSelectionMode) {
                                    toggleStudentSelection(item.id);
                                } else {
                                    setSelectedStudent(item);
                                    setViewMode('individual-preview');
                                }
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={styles.studentAvatar}>
                                {item.photo_url && getFullImageUrl(item.photo_url) ? (
                                    <Image 
                                        source={{ uri: getFullImageUrl(item.photo_url) as string }} 
                                        style={styles.avatarImage} 
                                    />
                                ) : (
                                    <Text style={styles.avatarText}>{item.name[0]}</Text>
                                )}
                            </View>
                            <View style={styles.studentInfo}>
                                <Text style={styles.studentName}>{item.name}</Text>
                                <View style={styles.studentRollContainer}>
                                    <Text style={styles.studentRollLabel}>ROLL NO:</Text>
                                    <Text style={styles.studentRollValue}>{item.roll_no || 'N/A'}</Text>
                                </View>
                                <View style={styles.classBadge}>
                                    <Text style={styles.classBadgeText}>SEC: {item.section}</Text>
                                </View>
                            </View>
                            {isSelectionMode && (
                                <View style={[styles.checkbox, selectionMap[item.id] && styles.checkboxSelected]}>
                                    {selectionMap[item.id] && <Ionicons name="checkmark" size={18} color="#fff" />}
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={styles.studentList}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 100 }}>
                            <Ionicons name="people-outline" size={60} color={theme.border} />
                            <Text style={{ color: theme.textLight, marginTop: 15, fontSize: 16 }}>No students found</Text>
                        </View>
                    }
                />
            )}

            {isSelectionMode && getSelectedCount() > 0 && (
                <View style={styles.bulkFooter}>
                    <TouchableOpacity style={styles.downloadBtn} onPress={() => generatePDF(true)} activeOpacity={0.9}>
                        {isGeneratingPDF ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="cloud-download-outline" size={24} color="#fff" style={{ marginRight: 10 }} />
                                <Text style={styles.downloadBtnText}>Generate Bundle ({getSelectedCount()})</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const renderIndividualPreview = () => (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 }}>
                <TouchableOpacity onPress={() => setViewMode('event-details')} style={{ padding: 5 }}>
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { marginLeft: 12, flex: 1 }]}>Preview</Text>
                <TouchableOpacity 
                    style={{ backgroundColor: theme.primary, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 5 }}
                    onPress={() => generatePDF(false)}
                    disabled={isGeneratingPDF}
                >
                    {isGeneratingPDF ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Ionicons name="download-outline" size={20} color="#fff" />
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Download PDF</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.previewContainer}>
                    <Text style={{ color: theme.textLight, fontSize: 16, textAlign: 'center', marginTop: 50 }}>
                        Preview not available for individual generation.
                    </Text>
                    <Text style={{ color: theme.textLight, fontSize: 14, textAlign: 'center', marginTop: 10 }}>
                        Tap 'Download PDF' to get the full document.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />
            {viewMode === 'list' && renderList()}
            {viewMode === 'create' && renderCreate()}
            {viewMode === 'event-details' && renderDetails()}
            {viewMode === 'individual-preview' && renderIndividualPreview()}
            {isGeneratingPDF && (
                <View style={styles.modalOverlay}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={{ color: '#fff', marginTop: 15, fontWeight: 'bold' }}>Preparing High Quality PDF...</Text>
                </View>
            )}
        </View>
    );
};

export default AdmitCardScreen;