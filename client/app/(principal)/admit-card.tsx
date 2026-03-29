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
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_ENDPOINTS, BASE_URL } from '../../constants/Config';
import { useNavigation } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

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

const ModernToggle = ({ active, onToggle, theme }: { active: boolean, onToggle: () => void, theme: any }) => {
    return (
        <TouchableOpacity 
            activeOpacity={0.8}
            onPress={onToggle}
            style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                backgroundColor: active ? '#27AE60' : (theme.isDark ? '#333' : '#fff'),
                borderWidth: active ? 0 : 1.5,
                borderColor: active ? 'transparent' : '#E0E0E0',
                padding: 2,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: active ? 'flex-end' : 'flex-start',
            }}
        >
            <View style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: active ? '#fff' : (theme.isDark ? '#bbb' : '#E0E0E0'),
                elevation: 2,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 1.5,
            }} />
        </TouchableOpacity>
    );
};

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

    const filteredEvents = useMemo(() => {
        return admitCardEvents.filter(event => {
            const matchesTitle = filterTitle === 'All' || event.exam_name === filterTitle;
            const matchesClass = filterClass === 'All' || (event.classes && event.classes.some(c => `${c.class}-${c.section}` === filterClass));
            return matchesTitle && matchesClass;
        });
    }, [admitCardEvents, filterTitle, filterClass]);

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: theme.card },
        title: { fontSize: 24, fontWeight: 'bold', color: theme.text },
        subtitle: { fontSize: 14, color: theme.textLight },
        floatingAddBtn: {
            position: 'absolute',
            bottom: 25,
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
        emptyText: { fontSize: 18, color: theme.textLight, marginVertical: 20 },
        createBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: theme.primary, borderRadius: 10 },
        createBtnText: { color: '#fff', fontWeight: 'bold' },
        grid: { padding: 15 },
        eventCard: { backgroundColor: theme.card, borderRadius: 20, padding: 18, marginBottom: 18, elevation: 3, position: 'relative', borderWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6 },
        eventIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: isDark ? '#1a2a33' : '#e3f2fd', justifyContent: 'center', alignItems: 'center', marginRight: 18 },
        eventName: { fontSize: 18, fontWeight: '900', color: theme.text, marginBottom: 6 },
        eventMetaRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
        metaBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#1b2c1b' : '#e8f5e9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
        metaBadgeText: { fontSize: 11, fontWeight: '800', color: '#27ae60' },
        classChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
        miniClassChip: { fontSize: 10, fontWeight: '700', color: theme.textLight, backgroundColor: isDark ? '#333' : '#f1f5f9', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: 1, borderColor: theme.border },
        deleteIcon: { padding: 8, position: 'absolute', bottom: 12, right: 12 },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60, backgroundColor: 'transparent', borderBottomWidth: 0 },
        modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
        createContent: { padding: 20 },
        inputGroup: { marginBottom: 20 },
        label: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 8 },
        input: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 16, color: theme.text },
        chipContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
        chip: { paddingVertical: 8, paddingHorizontal: 15, backgroundColor: isDark ? '#2a2a2a' : '#f1f5f9', borderRadius: 20, marginRight: 10, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
        chipSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
        chipText: { color: theme.textLight, fontSize: 13, fontWeight: '500' },
        chipTextSelected: { color: '#fff' },
        footer: { 
            padding: 20, 
            paddingBottom: 25,
            backgroundColor: 'transparent', 
            borderTopWidth: 0, 
        },
        footerRow: { flexDirection: 'row' },
        primaryBtn: { backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
        primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
        secondaryBtn: { backgroundColor: isDark ? '#333' : '#f1f5f9', padding: 16, borderRadius: 12, alignItems: 'center', paddingHorizontal: 30 },
        secondaryBtnText: { color: theme.text, fontSize: 16, fontWeight: 'bold' },
        scheduleRow: { backgroundColor: theme.card, padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: theme.border },
        rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
        rowNum: { fontSize: 14, fontWeight: 'bold', color: theme.textLight },
        rowInputs: { flexDirection: 'row' },
        addRowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.primary, borderRadius: 12, marginTop: 10 },
        addRowBtnText: { marginLeft: 5, color: theme.primary, fontWeight: 'bold' },
        tabBarContainer: { backgroundColor: theme.card, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
        tabBar: { paddingHorizontal: 15 },
        tab: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginRight: 10, backgroundColor: isDark ? '#2a2a2a' : '#f1f5f9', borderWidth: 1, borderColor: theme.border },
        tabActive: { backgroundColor: theme.primary, borderColor: theme.primary },
        tabText: { color: theme.textLight, fontWeight: 'bold', fontSize: 14 },
        tabTextActive: { color: '#fff' },
        studentList: { padding: 15 },
        studentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 15, borderRadius: 16, marginBottom: 12, elevation: 2, borderWidth: 1, borderColor: theme.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
        studentCardSelected: { borderColor: theme.primary, backgroundColor: isDark ? '#1a2233' : '#f0f4ff' },
        studentAvatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: isDark ? '#2a2a2a' : '#f0f0ff', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
        avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
        avatarText: { color: theme.primary, fontWeight: 'bold', fontSize: 20 },
        studentInfo: { flex: 1 },
        studentName: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 2 },
        studentRollContainer: { flexDirection: 'row', alignItems: 'center' },
        studentRollLabel: { fontSize: 12, color: theme.textLight, fontWeight: '600' },
        studentRollValue: { fontSize: 13, color: theme.primary, fontWeight: '700', marginLeft: 4 },
        classBadge: { backgroundColor: isDark ? '#333' : '#eef2ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 4 },
        classBadgeText: { fontSize: 10, color: theme.primary, fontWeight: '800' },
        checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
        checkboxSelected: { backgroundColor: theme.primary },
        selectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', borderBottomWidth: 1, borderBottomColor: theme.border },
        selectionHeaderText: { fontSize: 14, fontWeight: '700', color: theme.textLight },
        bulkFooter: { position: 'absolute', bottom: 25, left: 20, right: 20, zIndex: 1000 },
        downloadBtn: { backgroundColor: theme.success, padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: theme.success, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10 },
        downloadBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

        // Individual Preview Styles
        previewScroll: { flex: 1, backgroundColor: isDark ? '#000' : '#f0f2f5' },
        previewContainer: { padding: 20, alignItems: 'center' },
        admitCardPaper: {
            width: width - 40,
            backgroundColor: '#fff',
            padding: 20,
            borderWidth: 2,
            borderColor: '#000',
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 15,
        },
        paperHeader: { alignItems: 'center', paddingBottom: 15, marginBottom: 20 },
        paperInstName: { fontSize: 22, fontWeight: '900', color: '#000', textAlign: 'center', textTransform: 'uppercase' },
        paperInstSub: { fontSize: 11, color: '#333', textAlign: 'center', marginTop: 4, fontWeight: '600' },
        paperExamTitle: { fontSize: 18, fontWeight: '900', color: '#000', borderWidth: 1, borderColor: '#000', paddingHorizontal: 15, paddingVertical: 5, marginTop: 15, textTransform: 'uppercase' },
        paperInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
        paperTable: { flex: 1, marginRight: 15 },
        paperTableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#eee', paddingVertical: 5 },
        paperLabel: { width: 100, fontSize: 10, fontWeight: 'bold', color: '#555' },
        paperValue: { flex: 1, fontSize: 12, fontWeight: '900', color: '#000' },
        paperPhoto: { width: 100, height: 120, borderWidth: 1, borderColor: '#000', backgroundColor: '#f9f9f9', justifyContent: 'center', alignItems: 'center' },
        paperTimetable: { marginBottom: 20 },
        paperTableTitle: { fontSize: 12, fontWeight: '900', textDecorationLine: 'underline', marginBottom: 10, color: '#000' },
        paperGrid: { borderWidth: 1.5, borderColor: '#000' },
        paperGridHeader: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderBottomWidth: 1.5, borderBottomColor: '#000' },
        paperGridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000' },
        paperGridCell: { padding: 8, borderRightWidth: 1, borderRightColor: '#000', flex: 1 },
        paperGridText: { fontSize: 10, fontWeight: 'bold', color: '#000' },
        paperInstructions: { borderWidth: 1, borderColor: '#000', padding: 10, borderRadius: 4 },
        paperInstTitle: { fontSize: 10, fontWeight: '900', textDecorationLine: 'underline', marginBottom: 5 },
        paperInstItem: { fontSize: 9, fontWeight: '700', color: '#333', marginBottom: 2 },
        paperFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 50, paddingHorizontal: 20 },
        paperSigLine: { borderTopWidth: 1, borderTopColor: '#000', width: 120, alignItems: 'center', paddingTop: 5 },
        paperSigText: { fontSize: 9, fontWeight: '900' },
        modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
        
        // Filter Modal Styles
        filterModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
        filterModalContent: { backgroundColor: theme.background, borderRadius: 24, padding: 25, maxHeight: '80%', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10 },
        filterSection: { marginBottom: 25 },
        filterLabel: { fontSize: 16, fontWeight: 'bold', color: theme.text, marginBottom: 15 },
        filterScroll: { maxHeight: 200 },
        filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginRight: 10, marginBottom: 10 },
        filterChipSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
        filterChipText: { fontSize: 14, fontWeight: '600', color: theme.textLight },
        filterChipTextSelected: { color: '#fff' },
        filterFooter: { flexDirection: 'row', gap: 15, marginTop: 10, paddingBottom: 20 },
        resetBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
        applyBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center' },
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
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInstProfile(response.data.profile || response.data);
        } catch (error) {
            console.error('Error fetching institute profile:', error);
        }
    };

    const fetchAdmitCardEvents = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.ADMIT_CARD}/list`, {
                headers: { Authorization: `Bearer ${token}` }
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
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const newStatus = !event.is_published;
            
            console.log(`[AdmitCard] Toggling visibility for ${event.id} to ${newStatus}`);

            // Optimistic local update
            setAdmitCardEvents(prev => prev.map(e => 
                e.id === event.id ? { ...e, is_published: newStatus } : e
            ));

            const response = await axios.patch(`${API_ENDPOINTS.ADMIT_CARD}/visibility/${event.id}`, 
                { is_published: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            console.log('[AdmitCard] Toggle Response:', response.data);

            Toast.show({ 
                type: 'success', 
                text1: newStatus ? 'Published' : 'Unpublished',
                text2: newStatus ? 'Students can now see this admit card' : 'Hidden from student dashboard'
            });
        } catch (error: any) {
            console.error('[AdmitCard] Toggle Error Details:', error.response?.data || error.message);
            // Revert on error
            fetchAdmitCardEvents();
            Toast.show({ type: 'error', text1: 'Update failed', text2: error.response?.data?.message || '' });
        }
    };

    const fetchClassSections = async () => {
        try {
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const allStudents = response.data.students || [];
            const unique = [];
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
        
        // Auto-update 'time' string when startTime or endTime changes
        if (field === 'startTime' || field === 'endTime') {
            const s = newSchedule[index].startTime || '';
            const e = newSchedule[index].endTime || '';
            if (s && e) {
                newSchedule[index].time = `${s} - ${e}`;
            } else if (s) {
                newSchedule[index].time = s;
            } else if (e) {
                newSchedule[index].time = e;
            }
        }
        
        setSchedule(newSchedule);
    };

    const handleCreateEvent = async () => {
        if (!examName) return Alert.alert('Error', 'Enter exam name');
        if (selectedClasses.length === 0) return Alert.alert('Error', 'Select at least one class');
        if (schedule.some(s => !s.date || !s.subject || !s.time)) return Alert.alert('Error', 'Fill all schedule details');

        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            await axios.post(`${API_ENDPOINTS.ADMIT_CARD}/create`, {
                exam_name: examName,
                classes: selectedClasses,
                schedule: schedule
            }, {
                headers: { Authorization: `Bearer ${token}` }
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
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const response = await axios.post(`${API_ENDPOINTS.ADMIT_CARD}/students`, {
                classes: event.classes
            }, {
                headers: { Authorization: `Bearer ${token}` }
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

    const formatDate = (dateStr: string | null | undefined): string => {
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

    const toBase64 = async (url: string | null | undefined) => {
        if (!url) return null;
        try {
            const fullUrl = getFullImageUrl(url);
            if (!fullUrl) return null;
            const response = await fetch(fullUrl);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn("Base64 conversion failed for:", url);
            return null;
        }
    };

    const generatePDF = async () => {
        if (!currentEvent) return Alert.alert('Error', 'No exam event selected');
        
        const selectedIds = Object.keys(selectionMap).filter(id => selectionMap[id]);
        if (selectedIds.length === 0 && !selectedStudent) {
            return Alert.alert('Warning', 'Select students first');
        }

        // If it's a bulk operation (Selection Mode)
        if (isSelectionMode && selectedIds.length > 0) {
            try {
                setIsGeneratingPDF(true);
                const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
                
                const response = await axios.post(
                    `${API_ENDPOINTS.ADMIT_CARD}/generate-bulk-pdf/${currentEvent.id}`,
                    { studentIds: selectedIds },
                    {
                        headers: { Authorization: `Bearer ${token}` },
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
                // Ensure btoa is available, fallback if not (Expo usually polyfills it)
                const base64data = btoa(base64);
                
                const fileName = `admit_cards_${currentEvent.id}_${Date.now()}.pdf`;
                const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

                await FileSystem.writeAsStringAsync(fileUri, base64data, {
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
                console.error('Bulk Admit Card Error:', error.message);
                Alert.alert('Error', 'Failed to generate bundle. Please try again.');
            } finally {
                setIsGeneratingPDF(false);
            }
            return;
        }

        // Individual Preview Print (Original logic for single card)
        try {
            setIsGeneratingPDF(true);
            const dataToPrint = [selectedStudent as Student];
            const instLogoB64 = await toBase64(instProfile?.logo_url || instProfile?.institute_logo);
            const studentsWithPhotos = await Promise.all(dataToPrint.map(async (s) => ({
                ...s,
                photoB64: s.photo_url ? await toBase64(s.photo_url) : null
            })));

            const fullAddress = [
                instProfile?.address || instProfile?.institute_address,
                instProfile?.landmark,
                instProfile?.district,
                instProfile?.state,
                instProfile?.pincode
            ].filter(Boolean).join(' ');

            const eventName = currentEvent.exam_name;
            const eventSchedule = currentEvent.schedule;
            let htmlContent = `
                <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <style>
                        @page { size: A4; margin: 0; }
                        * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
                        body { 
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                            padding: 0; 
                            margin: 0; 
                            color: #333; 
                            background: #fff; 
                        }
                        
                        .page-container {
                            width: 210mm;
                            height: 297mm;
                            padding: 15mm;
                            box-sizing: border-box;
                            page-break-after: always;
                            display: flex;
                            flex-direction: column;
                            background: #fff;
                            position: relative;
                        }

                        /* A4 Page Border */
                        .page-border {
                            position: absolute;
                            top: 10mm;
                            left: 10mm;
                            right: 10mm;
                            bottom: 10mm;
                            border: 2px solid #000;
                            pointer-events: none;
                            z-index: 10;
                        }

                        .content-wrapper {
                            position: relative;
                            z-index: 5;
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                            padding: 5mm;
                        }
                        
                        .header-container { 
                            display: flex; 
                            flex-direction: row; 
                            align-items: center; 
                            justify-content: center; 
                            margin-bottom: 5px; 
                            gap: 20px;
                        }
                        
                        .logo { 
                            width: 80px; 
                            height: 80px; 
                            object-fit: contain;
                        }
                        
                        .institute-info { 
                            text-align: center; 
                        }
                        
                        .institute-name { 
                            font-size: 28px; 
                            font-weight: 900; 
                            color: #1A237E; 
                            margin: 0; 
                            text-transform: uppercase; 
                            letter-spacing: 1px; 
                        }
                        
                        .affiliation-text { 
                            font-size: 14px; 
                            color: #444; 
                            margin: 4px 0 0 0; 
                            font-weight: 700; 
                        }
                        
                        .address-text { 
                            font-size: 12px; 
                            color: #666; 
                            margin-top: 4px; 
                            font-weight: 600; 
                            text-align: center; 
                        }
                        
                        .divider { 
                            height: 2px; 
                            background-color: #000; 
                            margin: 15px 0; 
                        }
                        
                        .exam-box { 
                            font-size: 22px; 
                            font-weight: 900; 
                            text-align: center; 
                            margin: 0px auto 10px auto; /* Moved up further */
                            text-transform: uppercase; 
                            padding: 8px 45px; 
                            border: 2.5px solid #000; 
                            display: table; 
                        }
                        
                        .details-section { 
                            display: flex; 
                            flex-direction: row; 
                            justify-content: space-between; 
                            margin: 20px 0; /* Reduced margin */
                            align-items: flex-start;
                        }
                        
                        .info-table { 
                            width: 70%; 
                            border-collapse: collapse; 
                        }
                        
                        .info-table td { 
                            padding: 10px 0; 
                            font-size: 15px; 
                            border-bottom: 1px solid #eee; 
                        }
                        
                        .label { 
                            font-weight: bold; 
                            width: 150px; 
                            color: #555; 
                            font-size: 12px; 
                            text-transform: uppercase; 
                        }
                        
                        .value { 
                            font-weight: 900; 
                            color: #000; 
                            font-size: 16px; 
                        }
                        
                        .photo-box { 
                            width: 130px; 
                            height: 160px; 
                            border: 2.5px solid #000; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            background: #fff; 
                            overflow: hidden; 
                        }
                        
                        .photo-box img { 
                            width: 100%; 
                            height: 100%; 
                            object-fit: cover; 
                        }
                        
                        .timetable-section { 
                            width: 100%; 
                            margin-top: 10px; 
                        }
                        
                        .section-title { 
                            font-weight: 900; 
                            text-decoration: underline; 
                            font-size: 14px; 
                            margin-bottom: 12px; 
                            color: #000;
                        }
                        
                        table.schedule { 
                            width: 100%; 
                            border-collapse: collapse; 
                            border: 2px solid #000; 
                        }
                        
                        .schedule th { 
                            background-color: #f8f9fa; 
                            border: 1.5px solid #000; 
                            padding: 12px; 
                            text-align: left; 
                            font-size: 13px; 
                            font-weight: 900; 
                            text-transform: uppercase;
                        }
                        
                        .schedule td { 
                            border: 1.5px solid #000; 
                            padding: 10px; 
                            font-size: 13px; 
                            font-weight: bold; 
                            color: #000;
                        }
                        
                        .instructions { 
                            border: 2px solid #000; 
                            padding: 15px; 
                            border-radius: 4px; 
                            margin-top: 20px; /* Reduced margin */
                            background: #fafafa; 
                        }
                        
                        .inst-title { 
                            font-weight: 900; 
                            font-size: 13px; 
                            text-decoration: underline; 
                            margin-bottom: 8px; 
                        }
                        
                        .inst-list { 
                            font-size: 12px; 
                            font-weight: bold; 
                            margin: 0; 
                            padding-left: 20px; 
                            line-height: 1.5; 
                        }
                        
                        .signature-section { 
                            margin-top: auto; 
                            padding-top: 30px; /* Reduced padding */
                            display: flex; 
                            justify-content: space-between; 
                            padding-bottom: 20px; 
                        }
                        
                        .sig-line { 
                            border-top: 2px solid #000; 
                            width: 200px; 
                            text-align: center; 
                            font-size: 12px; 
                            font-weight: 900; 
                            padding-top: 8px; 
                            text-transform: uppercase; 
                        }
                    </style>
                </head>
                <body>
            `;

            for (const student of studentsWithPhotos) {
                const logoHtml = instLogoB64 ? `<img src="${instLogoB64}" class="logo" />` : '';
                const photoHtml = student.photoB64 
                    ? `<img src="${student.photoB64}" />` 
                    : '<div style="font-size: 10px; color: #999; font-weight: bold; text-align: center;">AFFIX PHOTO</div>';

                htmlContent += `
                    <div class="page-container">
                        <div class="page-border"></div>
                        <div class="content-wrapper">
                            <div class="header-container">
                                ${logoHtml}
                                <div class="institute-info">
                                    <h1 class="institute-name">${(instProfile?.institute_name || 'INSTITUTE').toUpperCase()}</h1>
                                    ${instProfile?.affiliation ? `<p class="affiliation-text">${instProfile.affiliation}</p>` : ''}
                                    <p class="address-text">${fullAddress}</p>
                                </div>
                            </div>

                            <div class="divider"></div>
                            
                            <div class="exam-box">${eventName}</div>

                            <div class="details-section">
                                <table class="info-table">
                                    <tr><td class="label">Student Name</td><td class="value">${student.name}</td></tr>
                                    <tr><td class="label">Class & Section</td><td class="value">${student.class} - ${student.section}</td></tr>
                                    <tr><td class="label">Roll Number</td><td class="value">${student.roll_no || 'TBD'}</td></tr>
                                    <tr><td class="label">Date of Birth</td><td class="value">${student.dob ? formatDate(student.dob) : 'N/A'}</td></tr>
                                    <tr><td class="label">Father's Name</td><td class="value">${student.father_name}</td></tr>
                                    <tr><td class="label">Contact Number</td><td class="value">${student.mobile}</td></tr>
                                </table>
                                <div class="photo-box">${photoHtml}</div>
                            </div>

                            <div class="timetable-section">
                                <div class="section-title">EXAMINATION TIMETABLE</div>
                                <table class="schedule">
                                    <thead>
                                        <tr>
                                            <th>Date & Day</th>
                                            <th>Subject Name</th>
                                            <th>Time / Shift</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${eventSchedule.map(row => `
                                            <tr>
                                                <td>${formatDate(row.date)} (${row.day})</td>
                                                <td>${row.subject}</td>
                                                <td>${row.time}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>

                            <div class="instructions">
                                <div class="inst-title">IMPORTANT INSTRUCTIONS:</div>
                                <ol class="inst-list">
                                    <li>Candidate must carry this Admit Card to the examination hall for all sessions.</li>
                                    <li>Possession of mobile phones, electronic gadgets, or calculators is strictly prohibited.</li>
                                    <li>Candidates must report at the examination center at least 20 minutes before time.</li>
                                    <li>The card must be signed by the invigilator during every examination session.</li>
                                </ol>
                            </div>

                            <div class="signature-section">
                                <div class="sig-line">TEACHER'S SIGNATURE</div>
                                <div class="sig-line">PRINCIPAL'S SIGNATURE</div>
                            </div>
                        </div>
                    </div>
                `;
            }

            htmlContent += `</body></html>`;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            
            if (Platform.OS === 'ios') {
                await Sharing.shareAsync(uri);
            } else {
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Admit Card',
                    UTI: 'com.adobe.pdf'
                });
            }
            setIsSelectionMode(false);
            setSelectionMap({});
        } catch (error) {
            console.error('PDF generation error:', error);
            Alert.alert('Error', 'Failed to generate PDF');
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
                            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
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
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <View style={[styles.headerRow, { backgroundColor: 'transparent', paddingTop: 50, alignItems: 'center' }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 5 }}>
                        <Ionicons name="arrow-back" size={28} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { flex: 1, textAlign: 'center' }]}>Admit Card</Text>
                    <TouchableOpacity onPress={() => setIsFilterModalVisible(true)} style={{ padding: 5 }}>
                        <Ionicons name="options-outline" size={26} color={theme.text} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                ) : filteredEvents.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="document-text-outline" size={80} color={theme.border} />
                        <Text style={styles.emptyText}>
                            {filterTitle === 'All' && filterClass === 'All' ? 'No exam events found' : 'No events match your filters'}
                        </Text>
                        {filterTitle === 'All' && filterClass === 'All' && (
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
                                        active={event.is_published} 
                                        onToggle={() => toggleVisibility(event)}
                                        theme={{ isDark }}
                                    />
                                    <Text style={{ fontSize: 8, fontWeight: '900', color: event.is_published ? '#27AE60' : theme.textLight, marginTop: 4 }}>
                                        {event.is_published ? 'PUBLISHED' : 'DRAFT'}
                                    </Text>
                                </View>

                                <View style={styles.eventIcon}>
                                    <Ionicons name="document-text" size={28} color={theme.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.eventName}>{event.exam_name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                                        <Ionicons name="calendar-outline" size={12} color={theme.textLight} />
                                        <Text style={{ fontSize: 11, color: theme.textLight, fontWeight: '600' }}>
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
                                    style={{ position: 'absolute', bottom: 12, right: 12, padding: 6, backgroundColor: theme.danger + '10', borderRadius: 8 }}
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

            {/* Filter Modal */}
            <Modal
                visible={isFilterModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsFilterModalVisible(false)}
            >
                <View style={styles.filterModalContainer}>
                    <TouchableOpacity 
                        style={{ flex: 1 }} 
                        onPress={() => setIsFilterModalVisible(false)} 
                    />
                    <View style={styles.filterModalContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text }}>Filter Registry</Text>
                            <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.filterSection}>
                            <Text style={styles.filterLabel}>Exam Title</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {uniqueTitles.map((title) => (
                                    <TouchableOpacity 
                                        key={title} 
                                        onPress={() => setFilterTitle(title)}
                                        style={[styles.filterChip, filterTitle === title && styles.filterChipSelected]}
                                    >
                                        <Text style={[styles.filterChipText, filterTitle === title && styles.filterChipTextSelected]}>
                                            {title}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.filterSection}>
                            <Text style={styles.filterLabel}>Class & Section</Text>
                            <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap' }} style={styles.filterScroll}>
                                <TouchableOpacity 
                                    onPress={() => setFilterClass('All')}
                                    style={[styles.filterChip, filterClass === 'All' && styles.filterChipSelected]}
                                >
                                    <Text style={[styles.filterChipText, filterClass === 'All' && styles.filterChipTextSelected]}>
                                        All Classes
                                    </Text>
                                </TouchableOpacity>
                                {availableClassSections.map((cs, i) => {
                                    const key = `${cs.class}-${cs.section}`;
                                    return (
                                        <TouchableOpacity 
                                            key={i} 
                                            onPress={() => setFilterClass(key)}
                                            style={[styles.filterChip, filterClass === key && styles.filterChipSelected]}
                                        >
                                            <Text style={[styles.filterChipText, filterClass === key && styles.filterChipTextSelected]}>
                                                {cs.class}-{cs.section}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        <View style={styles.filterFooter}>
                            <TouchableOpacity 
                                style={styles.resetBtn} 
                                onPress={() => { setFilterTitle('All'); setFilterClass('All'); }}
                            >
                                <Text style={[styles.secondaryBtnText, { fontSize: 14 }]}>Reset Filters</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.applyBtn} 
                                onPress={() => setIsFilterModalVisible(false)}
                            >
                                <Text style={[styles.primaryBtnText, { fontSize: 14 }]}>Apply Filters</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );

    const renderCreate = () => (
        <View style={styles.container}>
            <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => { setViewMode('list'); resetForm(); }}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>
                    {creationStep === 1 ? 'Exam Configuration' : 'Exam Schedule'}
                </Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.createContent}>
                {creationStep === 1 ? (
                    <View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Examination Title</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Annual Final Term 2026"
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
                                    <Text style={styles.rowNum}>Schedule {i + 1}</Text>
                                    <TouchableOpacity onPress={() => setSchedule(schedule.filter((_, idx) => idx !== i))}>
                                        <Ionicons name="close-circle" size={20} color={theme.danger} />
                                    </TouchableOpacity>
                                </View>
                                
                                <View style={[styles.rowInputs, { marginBottom: 10 }]}>
                                    {/* Date Selection */}
                                    <TouchableOpacity 
                                        style={[styles.input, { flex: 1, marginRight: 5, justifyContent: 'center' }]} 
                                        onPress={() => {
                                            setActiveScheduleRowIdx(i);
                                            setShowScheduleDatePicker(true);
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="calendar-outline" size={16} color={theme.primary} style={{ marginRight: 8 }} />
                                            <Text style={{ color: row.date ? theme.text : theme.textLight, fontSize: 13 }}>
                                                {row.date ? formatDate(row.date) : 'Pick Date'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    {/* Subject Input */}
                                    <TextInput
                                        style={[styles.input, { flex: 1 }]}
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
                                            <Ionicons name="time-outline" size={16} color={theme.success} style={{ marginRight: 8 }} />
                                            <View>
                                                <Text style={{ fontSize: 9, color: theme.textLight, fontWeight: '700' }}>START TIME</Text>
                                                <Text style={{ color: row.startTime ? theme.text : theme.textLight, fontSize: 13, fontWeight: '600' }}>
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
                                            <Ionicons name="time-outline" size={16} color={theme.danger} style={{ marginRight: 8 }} />
                                            <View>
                                                <Text style={{ fontSize: 9, color: theme.textLight, fontWeight: '700' }}>END TIME</Text>
                                                <Text style={{ color: row.endTime ? theme.text : theme.textLight, fontSize: 13, fontWeight: '600' }}>
                                                    {row.endTime || '--:--'}
                                                </Text>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity style={styles.addRowBtn} onPress={addScheduleRow}>
                            <Ionicons name="add" size={20} color={theme.primary} />
                            <Text style={styles.addRowBtnText}>Add Subject</Text>
                        </TouchableOpacity>
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
                        <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginLeft: 10 }]} onPress={handleCreateEvent}>
                            <Text style={styles.primaryBtnText}>Finalize & Create</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Modal Date Picker */}
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

            {/* Start Time Picker */}
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

            {/* End Time Picker */}
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
        <View style={styles.container}>
            <View style={[styles.modalHeader, { backgroundColor: 'transparent', borderBottomWidth: 0, paddingTop: 50 }]}>
                <TouchableOpacity onPress={() => { setViewMode('list'); setIsSelectionMode(false); }} style={{ padding: 5 }}>
                    <Ionicons name="arrow-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={[styles.modalTitle, { fontSize: 22, fontWeight: '900' }]} numberOfLines={1}>{currentEvent?.exam_name}</Text>
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

            <View style={[styles.tabBarContainer, { backgroundColor: 'transparent', borderBottomWidth: 0 }]}>
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
                <View style={[styles.selectionHeader, { backgroundColor: 'transparent', borderBottomWidth: 0, paddingTop: 0 }]}>
                    <Text style={[styles.selectionHeaderText, { fontSize: 16 }]}>
                        {getSelectedCount()} Identities Selected
                    </Text>
                    <TouchableOpacity onPress={() => {
                        const allSelected = filteredStudents.every(s => selectionMap[s.id]);
                        const newMap = { ...selectionMap };
                        filteredStudents.forEach(s => newMap[s.id] = !allSelected);
                        setSelectionMap(newMap);
                    }} style={{ paddingVertical: 5, paddingHorizontal: 10 }}>
                        <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 15 }}>
                            {filteredStudents.every(s => selectionMap[s.id]) ? 'UNSELECT ALL' : 'SELECT ALL'}
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
                            <Text style={{ color: theme.textLight, marginTop: 15, fontSize: 16 }}>No students in this class</Text>
                        </View>
                    }
                />
            )}

            {isSelectionMode && getSelectedCount() > 0 && (
                <View style={styles.bulkFooter}>
                    <TouchableOpacity style={styles.downloadBtn} onPress={generatePDF} activeOpacity={0.9}>
                        {isGeneratingPDF ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="cloud-download-outline" size={24} color="#fff" style={{ marginRight: 10 }} />
                                <Text style={styles.downloadBtnText}>Download {getSelectedCount()} Admit Cards</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const renderIndividualPreview = () => (
        <View style={styles.container}>
            {/* Free Flow Back Button */}
            <TouchableOpacity 
                onPress={() => setViewMode('event-details')}
                style={{ 
                    position: 'absolute', 
                    top: insets.top + 15, 
                    left: 20, 
                    zIndex: 100,
                    width: 45,
                    height: 45,
                    borderRadius: 22.5,
                    backgroundColor: theme.card,
                    justifyContent: 'center',
                    alignItems: 'center',
                    elevation: 4,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4
                }}
            >
                <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>

            <ScrollView style={styles.previewScroll} showsVerticalScrollIndicator={false}>
                <View style={[styles.previewContainer, { paddingTop: insets.top + 80 }]}>
                    <View style={styles.admitCardPaper}>
                        {/* Professional Header Section */}
                        <View style={styles.paperHeader}>
                            {/* Logo and Name Row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 5, marginTop: -10 }}>
                                {instProfile?.logo_url || instProfile?.institute_logo ? (
                                        <Image 
                                            source={{ uri: getFullImageUrl(instProfile.logo_url || instProfile.institute_logo) || '' }} 
                                            style={{ width: 50, height: 50, resizeMode: 'contain', marginRight: 12, marginTop: 12 }} 
                                        />
                                    ) : null}
                                <Text 
                                    style={[styles.paperInstName, { flexShrink: 1 }]} 
                                    numberOfLines={1} 
                                    adjustsFontSizeToFit
                                >
                                    {(instProfile?.institute_name || 'INSTITUTE NAME').toUpperCase()}
                                </Text>
                            </View>
                            
                            {/* Affiliation Row */}
                            {instProfile?.affiliation && (
                                <Text style={{ 
                                    fontSize: 9.5, 
                                    fontWeight: '700', 
                                    color: '#333', 
                                    marginTop: -25, 
                                    paddingLeft: 50,
                                    textAlign: 'center', 
                                    marginBottom: 8
                                }}>
                                    {instProfile.affiliation}
                                </Text>
                            )}

                            {/* Detailed Address Row */}
                            <Text style={[styles.paperInstSub, { fontSize: 9.5, marginTop: -8, paddingLeft: 40 }]}>
                                {instProfile?.address || instProfile?.institute_address}
                                {instProfile?.landmark ? ` ${instProfile.landmark}` : ''}
                                {"\n"}{instProfile?.district} {instProfile?.state} {instProfile?.pincode}
                            </Text>

                            <View style={{ width: '100%', height: 2, backgroundColor: '#000', marginTop: 15 }} />
                            
                            <Text style={styles.paperExamTitle}>{currentEvent?.exam_name}</Text>
                        </View>

                        {/* Student Info Section */}
                        <View style={styles.paperInfoRow}>
                            <View style={styles.paperTable}>
                                <View style={styles.paperTableRow}><Text style={styles.paperLabel}>STUDENT NAME</Text><Text style={styles.paperValue}>{selectedStudent?.name}</Text></View>
                                <View style={styles.paperTableRow}><Text style={styles.paperLabel}>CLASS & SECTION</Text><Text style={styles.paperValue}>{selectedStudent?.class} - {selectedStudent?.section}</Text></View>
                                <View style={styles.paperTableRow}><Text style={styles.paperLabel}>ROLL NUMBER</Text><Text style={styles.paperValue}>{selectedStudent?.roll_no || 'TBD'}</Text></View>
                                <View style={styles.paperTableRow}><Text style={styles.paperLabel}>FATHER'S NAME</Text><Text style={styles.paperValue}>{selectedStudent?.father_name}</Text></View>
                                <View style={styles.paperTableRow}><Text style={styles.paperLabel}>MOBILE NO.</Text><Text style={styles.paperValue}>{selectedStudent?.mobile}</Text></View>
                            </View>
                            <View style={styles.paperPhoto}>
                                {selectedStudent?.photo_url && getFullImageUrl(selectedStudent.photo_url) ? (
                                    <Image source={{ uri: getFullImageUrl(selectedStudent.photo_url) as string }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <Text style={{ fontSize: 8, textAlign: 'center' }}>AFFIX PHOTO</Text>
                                )}
                            </View>
                        </View>

                        {/* Timetable */}
                        <View style={styles.paperTimetable}>
                            <Text style={styles.paperTableTitle}>EXAMINATION TIMETABLE</Text>
                            <View style={styles.paperGrid}>
                                <View style={styles.paperGridHeader}>
                                    <View style={styles.paperGridCell}><Text style={styles.paperGridText}>DATE & DAY</Text></View>
                                    <View style={styles.paperGridCell}><Text style={styles.paperGridText}>SUBJECT</Text></View>
                                    <View style={styles.paperGridCell}><Text style={styles.paperGridText}>TIME / SHIFT</Text></View>
                                </View>
                                {currentEvent?.schedule.map((row, idx) => (
                                    <View key={idx} style={styles.paperGridRow}>
                                        <View style={styles.paperGridCell}><Text style={styles.paperGridText}>{`${String(formatDate(row.date)).trim()} (${String(row.day).trim()})`}</Text></View>
                                        <View style={styles.paperGridCell}><Text style={styles.paperGridText}>{row.subject}</Text></View>
                                        <View style={styles.paperGridCell}><Text style={styles.paperGridText}>{row.time}</Text></View>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Instructions */}
                        <View style={styles.paperInstructions}>
                            <Text style={styles.paperInstTitle}>IMPORTANT INSTRUCTIONS:</Text>
                            <Text style={styles.paperInstItem}>1. Candidate must carry this Admit Card to the examination hall for all papers.</Text>
                            <Text style={styles.paperInstItem}>2. Possession of mobile phones, electronic gadgets, or calculators is strictly prohibited.</Text>
                            <Text style={styles.paperInstItem}>3. Candidates must report at the examination center at least 20 minutes before time.</Text>
                            <Text style={styles.paperInstItem}>4. Ensure invigilator signature on this card during every examination session.</Text>
                        </View>

                        {/* Footer Signatures */}
                        <View style={styles.paperFooter}>
                            <View style={styles.paperSigLine}>
                                <Text style={styles.paperSigText}>TEACHER'S SIGNATURE</Text>
                            </View>
                            <View style={styles.paperSigLine}>
                                <Text style={styles.paperSigText}>PRINCIPAL'S SIGNATURE</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );

    return (
        <View style={{ flex: 1 }}>
            <StatusBar barStyle={theme.statusBarStyle} />
            {viewMode === 'list' && renderList()}
            {viewMode === 'create' && renderCreate()}
            {viewMode === 'event-details' && renderDetails()}
            {viewMode === 'individual-preview' && renderIndividualPreview()}
            {isGeneratingPDF && (
                <View style={[styles.modalOverlay, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={{ color: '#fff', marginTop: 15, fontWeight: 'bold' }}>Preparing High Quality PDF...</Text>
                </View>
            )}
        </View>
    );
};

export default AdmitCardScreen;
