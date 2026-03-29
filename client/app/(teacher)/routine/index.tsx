import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Modal, TextInput, Alert, Dimensions, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function RoutineManager() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isDark, theme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [overview, setOverview] = useState<any[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [rawStudents, setRawStudents] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [instituteId, setInstituteId] = useState<string>('');

    // Builder State
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [builderStep, setBuilderStep] = useState(1);
    const [target, setTarget] = useState({ class: '', section: '' });
    const [config, setConfig] = useState<any>({
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        slots: [{ id: Date.now(), label: 'Period 1', startTime: '09:00', endTime: '09:45', type: 'period' }]
    });
    const [routineData, setRoutineData] = useState<any>({});
    const [isEditMode, setIsEditMode] = useState(false);
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [selectedDay, setSelectedDay] = useState('Monday');

    // Filter State
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [filterClass, setFilterClass] = useState<string>('');
    const [filterSection, setFilterSection] = useState<string>('');

    // Time Picker State
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [pickerConfig, setPickerConfig] = useState<{ idx: number, field: string }>({ idx: -1, field: '' });

    // Slot Assign State
    const [activeSlot, setActiveSlot] = useState<any>(null);
    const [tempSlot, setTempSlot] = useState({ subject: '', teacherId: '' });

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (config.days.length > 0 && !config.days.includes(selectedDay)) {
            setSelectedDay(config.days[0]);
        }
    }, [config.days]);

    const fetchInitialData = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const userType = await AsyncStorage.getItem('userType') || 'teacher';
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            if (!userData) return;

            const instId = userType === 'principal' ? userData.id : (userData.institute_id || userData.id);
            setInstituteId(instId);

            const headers = { 
                Authorization: `Bearer ${token}`,
                'x-academic-session-id': sessionId?.toString()
            };

            const overviewRes = await axios.get(`${API_ENDPOINTS.ROUTINE}/overview/${instId}`, {
                headers
            });
            setOverview(overviewRes.data || []);

            const studentsRes = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers
            });
            const allStudents = studentsRes.data.students || [];
            setRawStudents(allStudents);
            const uniqueClasses = [...new Set(allStudents.map((s: any) => String(s.class).trim()))]
                .filter(Boolean)
                .sort((a: any, b: any) => a.localeCompare(b, undefined, { numeric: true }));
            setClasses(uniqueClasses as string[]);

            const teachersRes = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/teacher/list`, {
                headers
            });
            setTeachers(teachersRes.data.teachers || []);

        } catch (error) {
            console.error('Error fetching initial data:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load routine data' });
        } finally {
            setLoading(false);
        }
    };

    const handleClassChange = (cls: string) => {
        setTarget({ ...target, class: cls, section: '' });
        const classSections = [...new Set(rawStudents.filter((s: any) => String(s.class).trim() === cls).map((s: any) => String(s.section).trim()))]
            .filter(Boolean)
            .sort();
        setSections(classSections as string[]);
    };

    const startBuilder = () => {
        setTarget({ class: '', section: '' });
        setConfig({
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            slots: [{ id: Date.now(), label: 'Period 1', startTime: '09:00', endTime: '09:45', type: 'period' }]
        });
        setRoutineData({});
        setIsEditMode(false);
        setIsViewOnly(false);
        setBuilderStep(1);
        setSelectedDay('Monday');
        setIsBuilderOpen(true);
    };

    const handleViewRoutine = async (r: any) => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const sessionId = storedSessionId || (userDataStr ? JSON.parse(userDataStr).current_session_id : null);

            const res = await axios.get(`${API_ENDPOINTS.ROUTINE}/${instituteId}/${r.class_name}/${r.section}`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            if (res.data) {
                setTarget({ class: r.class_name, section: r.section });
                setConfig(res.data.config);
                setRoutineData(res.data.data);
                setIsEditMode(true);
                setIsViewOnly(true);
                setBuilderStep(3);
                if (res.data.config.days.length > 0) setSelectedDay(res.data.config.days[0]);
                setIsBuilderOpen(true);
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load routine' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRoutine = async (r: any) => {
        Alert.alert(
            "Delete Routine",
            `Are you sure you want to delete routine for Class ${r.class_name}-${r.section}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('teacherToken');
                            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
                            const userDataStr = await AsyncStorage.getItem('teacherData');
                            const sessionId = storedSessionId || (userDataStr ? JSON.parse(userDataStr).current_session_id : null);

                            await axios.delete(`${API_ENDPOINTS.ROUTINE}/${instituteId}/${r.class_name}/${r.section}`, {
                                headers: { 
                                    Authorization: `Bearer ${token}`,
                                    'x-academic-session-id': sessionId?.toString()
                                }
                            });
                            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Routine deleted successfully' });
                            fetchInitialData();
                        } catch (error) {
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to delete routine' });
                        }
                    }
                }
            ]
        );
    };

    const handleSaveRoutine = async (publish = false) => {
        if (!target.class || !target.section) {
            Toast.show({ type: 'error', text1: 'Required', text2: 'Please select class and section' });
            return;
        }
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const sessionId = storedSessionId || (userDataStr ? JSON.parse(userDataStr).current_session_id : null);

            await axios.post(`${API_ENDPOINTS.ROUTINE}/save`, {
                instituteId,
                className: target.class,
                section: target.section,
                config,
                data: routineData,
                isPublished: publish
            }, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });

            Toast.show({ type: 'success', text1: 'Success', text2: `Routine ${publish ? 'published' : 'saved'}` });
            setIsBuilderOpen(false);
            fetchInitialData();
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save routine' });
        }
    };

    const addSlot = () => {
        const slots = config.slots;
        let nextStart = '';
        let nextEnd = '';

        if (slots.length > 0) {
            const firstSlot = slots[0];
            const lastSlot = slots[slots.length - 1];

            const parseTime = (t: string) => {
                if (!t || !t.includes(':')) return NaN;
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            const formatTime = (m: number) => {
                const hours = Math.floor(m / 60) % 24;
                const mins = m % 60;
                return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
            };

            const firstStart = parseTime(firstSlot.startTime);
            const firstEnd = parseTime(firstSlot.endTime);
            const lastEnd = parseTime(lastSlot.endTime);

            if (!isNaN(firstStart) && !isNaN(firstEnd) && !isNaN(lastEnd)) {
                const duration = firstEnd - firstStart;
                nextStart = lastSlot.endTime;
                nextEnd = formatTime(lastEnd + duration);
            }
        }

        setConfig({
            ...config,
            slots: [...config.slots, { 
                id: Date.now(), 
                label: `Period ${config.slots.length + 1}`, 
                startTime: nextStart, 
                endTime: nextEnd, 
                type: 'period' 
            }]
        });
    };

    const removeSlot = (id: number) => {
        setConfig({ ...config, slots: config.slots.filter((s: any) => s.id !== id) });
    };

    const updateSlot = (idx: number, field: string, value: string) => {
        const newSlots = [...config.slots];
        newSlots[idx][field] = value;
        setConfig({ ...config, slots: newSlots });
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        setShowTimePicker(false);
        if (event.type === 'set' && selectedDate) {
            const hours = selectedDate.getHours().toString().padStart(2, '0');
            const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
            const timeString = `${hours}:${minutes}`;
            updateSlot(pickerConfig.idx, pickerConfig.field, timeString);
        }
    };

    const openTimePicker = (idx: number, field: string) => {
        if (isViewOnly) return;
        setPickerConfig({ idx, field });
        setShowTimePicker(true);
    };

    const toggleDay = (day: string) => {
        if (isViewOnly) return;
        const newDays = config.days.includes(day) 
            ? config.days.filter((d: string) => d !== day) 
            : [...config.days, day];
        setConfig({ ...config, days: newDays });
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: insets.top + 15,
            paddingBottom: 10,
            paddingHorizontal: 20,
            zIndex: 10,
        },
        headerTitle: { fontSize: 24, fontWeight: '900', color: theme.text, marginLeft: 0, letterSpacing: -0.5 },
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
        scrollView: { padding: 20, paddingBottom: insets.bottom + 100 },
        card: {
            backgroundColor: theme.card,
            borderRadius: 20,
            padding: 20,
            marginBottom: 15,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
            elevation: 3,
            position: 'relative'
        },
        cardTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
        cardSubtitle: { fontSize: 14, color: theme.textLight, marginTop: 4 },
        cardBadge: {
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 8,
            alignSelf: 'flex-start',
            marginTop: 10
        },
        cardBadgeText: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
        deleteBtn: { position: 'absolute', top: 15, right: 15, padding: 8 },
        fab: {
            position: 'absolute',
            bottom: 20,
            right: 25,
            width: 65,
            height: 65,
            borderRadius: 32.5,
            backgroundColor: theme.primary,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 15,
            elevation: 8,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end'
        },
        modalContent: {
            backgroundColor: theme.card,
            borderTopLeftRadius: 35,
            borderTopRightRadius: 35,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 20,
            height: '95%',
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 15,
            paddingHorizontal: 5
        },
        modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text },
        stepIndicator: { flexDirection: 'row', marginBottom: 20, gap: 10, paddingHorizontal: 5 },
        stepBadge: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, backgroundColor: isDark ? '#222' : '#f0f0f0' },
        stepBadgeActive: { backgroundColor: theme.primary },
        stepText: { fontSize: 12, fontWeight: 'bold', color: theme.textLight },
        stepTextActive: { color: '#fff' },
        
        label: { fontSize: 14, fontWeight: 'bold', color: theme.text, marginBottom: 10, marginTop: 20 },
        input: {
            backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
            borderRadius: 15,
            padding: 15,
            color: theme.text,
            borderWidth: 1,
            borderColor: theme.border,
            fontSize: 16
        },
        dayChip: {
            paddingVertical: 12,
            paddingHorizontal: 18,
            borderRadius: 15,
            marginRight: 10,
            marginBottom: 10,
            backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5',
            borderWidth: 1,
            borderColor: theme.border
        },
        dayChipActive: {
            backgroundColor: theme.primary,
            borderColor: theme.primary
        },
        dayChipText: { color: theme.text, fontWeight: '700', fontSize: 14 },
        dayChipTextActive: { color: '#fff' },

        slotCard: {
            backgroundColor: isDark ? '#1a1a1a' : '#fff',
            padding: 20,
            borderRadius: 20,
            marginBottom: 15,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 5,
            elevation: 2
        },
        slotHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
        slotLabel: { fontSize: 16, fontWeight: '800', color: theme.text },
        slotRow: { flexDirection: 'row', gap: 15 },
        slotInputGroup: { flex: 1 },
        
        agendaDaySelector: { marginBottom: 20, paddingVertical: 5 },
        agendaDayChip: {
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 25,
            marginRight: 10,
            backgroundColor: isDark ? '#222' : '#f0f0f0',
            borderWidth: 1,
            borderColor: theme.border
        },
        agendaDayChipActive: {
            backgroundColor: theme.primary,
            borderColor: theme.primary,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4
        },
        agendaDayText: { color: theme.textLight, fontWeight: 'bold' },
        agendaDayTextActive: { color: '#fff' },

        agendaList: { flex: 1 },
        agendaItem: {
            flexDirection: 'row',
            backgroundColor: isDark ? '#1a1a1a' : '#fff',
            borderRadius: 20,
            marginBottom: 15,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.border,
            minHeight: 100
        },
        agendaTimeContainer: {
            width: 90,
            backgroundColor: isDark ? '#222' : '#f8f9fa',
            padding: 15,
            justifyContent: 'center',
            alignItems: 'center',
            borderRightWidth: 1,
            borderRightColor: theme.border
        },
        agendaTimeText: { fontSize: 13, fontWeight: '800', color: theme.text, textAlign: 'center' },
        agendaTimeSub: { fontSize: 10, color: theme.textLight, marginTop: 4 },
        
        agendaContent: { flex: 1, padding: 15, justifyContent: 'center' },
        agendaSubject: { fontSize: 17, fontWeight: '800', color: theme.text },
        agendaTeacher: { fontSize: 13, color: theme.textLight, marginTop: 5 },
        agendaEmptyText: { fontSize: 15, color: theme.textLight, fontStyle: 'italic' },
        agendaBreakTag: {
            backgroundColor: theme.warning + '20',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 8,
            alignSelf: 'flex-start',
            marginTop: 5
        },
        agendaBreakText: { color: theme.warning, fontSize: 11, fontWeight: '900', letterSpacing: 1 },

        builderFooter: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 15,
            paddingBottom: 10,
            gap: 12
        },
        button: {
            flex: 1,
            paddingVertical: 16,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center'
        },
        buttonPrimary: { backgroundColor: theme.primary },
        buttonSecondary: { backgroundColor: isDark ? '#333' : '#f0f0f0' },
        buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
        buttonTextSecondary: { color: theme.text }
    }), [theme, isDark, insets]);

    // Filter Options derived from actual routines
    const availableFilterOptions = useMemo(() => {
        const classes = [...new Set(overview.map(r => String(r.class_name)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const sections = [...new Set(overview.map(r => String(r.section)))].sort();
        return { classes, sections };
    }, [overview]);

    const filteredOverview = useMemo(() => {
        return overview.filter(r => {
            const classMatch = !filterClass || String(r.class_name) === filterClass;
            const sectionMatch = !filterSection || String(r.section) === filterSection;
            return classMatch && sectionMatch;
        });
    }, [overview, filterClass, filterSection]);

    if (loading && !isBuilderOpen) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const renderStep1 = () => (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Choose Class</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {classes.map(c => (
                    <TouchableOpacity
                        key={c}
                        style={[styles.dayChip, target.class === c && styles.dayChipActive]}
                        onPress={() => !isViewOnly && handleClassChange(c)}
                    >
                        <Text style={[styles.dayChipText, target.class === c && styles.dayChipTextActive]}>Class {c}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {target.class && (
                <>
                    <Text style={styles.label}>Choose Section</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {sections.map(s => (
                            <TouchableOpacity
                                key={s}
                                style={[styles.dayChip, target.section === s && styles.dayChipActive]}
                                onPress={() => !isViewOnly && setTarget({ ...target, section: s })}
                            >
                                <Text style={[styles.dayChipText, target.section === s && styles.dayChipTextActive]}>Section {s}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}

            <Text style={styles.label}>Active Days</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {DAYS.map(day => (
                    <TouchableOpacity
                        key={day}
                        style={[styles.dayChip, config.days.includes(day) && styles.dayChipActive]}
                        onPress={() => toggleDay(day)}
                    >
                        <Text style={[styles.dayChipText, config.days.includes(day) && styles.dayChipTextActive, { fontSize: 12 }]}>{day}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );

    const renderStep2 = () => (
        <ScrollView 
            showsVerticalScrollIndicator={false} 
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 150 }} // Huge padding to allow scrolling above keyboard
        >
            <Text style={styles.label}>Configure Time Slots</Text>
            {config.slots.map((slot: any, idx: number) => (
                <View key={slot.id} style={styles.slotCard}>
                    <View style={styles.slotHeader}>
                        <TextInput
                            style={[styles.slotLabel, { flex: 1, padding: 0, color: theme.text }]}
                            value={slot.label}
                            onChangeText={(val) => updateSlot(idx, 'label', val)}
                            editable={!isViewOnly}
                            placeholder="Slot Label"
                            placeholderTextColor={theme.textLight}
                        />
                        {!isViewOnly && (
                            <TouchableOpacity onPress={() => removeSlot(slot.id)}>
                                <Ionicons name="trash-outline" size={22} color={theme.danger} />
                            </TouchableOpacity>
                        )}
                    </View>
                    
                    <View style={styles.slotRow}>
                        <View style={styles.slotInputGroup}>
                            <Text style={{ fontSize: 11, color: theme.textLight, marginBottom: 6, fontWeight: '700' }}>Start</Text>
                            <TouchableOpacity 
                                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                                onPress={() => openTimePicker(idx, 'startTime')}
                                disabled={isViewOnly}
                            >
                                <Text style={{ color: slot.startTime ? theme.text : theme.textLight, fontSize: 16 }}>
                                    {slot.startTime || '09:00'}
                                </Text>
                                <Ionicons name="time-outline" size={20} color={theme.primary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.slotInputGroup}>
                            <Text style={{ fontSize: 11, color: theme.textLight, marginBottom: 6, fontWeight: '700' }}>End</Text>
                            <TouchableOpacity 
                                style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                                onPress={() => openTimePicker(idx, 'endTime')}
                                disabled={isViewOnly}
                            >
                                <Text style={{ color: slot.endTime ? theme.text : theme.textLight, fontSize: 16 }}>
                                    {slot.endTime || '09:45'}
                                </Text>
                                <Ionicons name="time-outline" size={20} color={theme.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={[styles.slotRow, { marginTop: 15 }]}>
                        <TouchableOpacity 
                            style={[styles.dayChip, { flex: 1, marginBottom: 0, alignItems: 'center' }, slot.type === 'period' && styles.dayChipActive]}
                            onPress={() => !isViewOnly && updateSlot(idx, 'type', 'period')}
                        >
                            <Text style={[styles.dayChipText, slot.type === 'period' && styles.dayChipTextActive]}>Lecture</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.dayChip, { flex: 1, marginBottom: 0, alignItems: 'center' }, slot.type === 'break' && styles.dayChipActive]}
                            onPress={() => !isViewOnly && updateSlot(idx, 'type', 'break')}
                        >
                            <Text style={[styles.dayChipText, slot.type === 'break' && styles.dayChipTextActive]}>Break</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
            {!isViewOnly && (
                <TouchableOpacity 
                    style={[
                        styles.button, 
                        { 
                            backgroundColor: isDark ? theme.primary + '30' : theme.primary + '10', 
                            borderWidth: 1, 
                            borderColor: theme.primary,
                            marginTop: 15,
                            borderStyle: 'dashed'
                        }
                    ]} 
                    onPress={addSlot}
                >
                    <Text style={[styles.buttonText, { color: theme.primary }]}>+ Add New Slot</Text>
                </TouchableOpacity>
            )}

            {showTimePicker && (
                <DateTimePicker
                    value={(() => {
                        const currentVal = config.slots[pickerConfig.idx]?.[pickerConfig.field] || '09:00';
                        const [h, m] = currentVal.split(':').map(Number);
                        const d = new Date();
                        d.setHours(h || 9, m || 0, 0, 0);
                        return d;
                    })()}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                    onChange={onTimeChange}
                />
            )}
        </ScrollView>
    );

    const renderStep3 = () => (
        <View style={{ flex: 1 }}>
            <View style={[styles.agendaDaySelector, { paddingHorizontal: 5 }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 5 }}>
                    {config.days.map((day: string) => (
                        <TouchableOpacity
                            key={day}
                            style={[
                                styles.agendaDayChip, 
                                selectedDay === day && styles.agendaDayChipActive,
                                { borderRadius: 14, paddingHorizontal: 22, height: 44, justifyContent: 'center' }
                            ]}
                            onPress={() => setSelectedDay(day)}
                        >
                            <Text style={[
                                styles.agendaDayText, 
                                selectedDay === day && styles.agendaDayTextActive,
                                { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }
                            ]}>
                                {day}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView 
                style={styles.agendaList} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 5, paddingBottom: 100 }}
            >
                {config.slots.map((slot: any, sIdx: number) => {
                    const cellData = routineData[selectedDay]?.[sIdx] || { subject: '', teacherId: '' };
                    const teacherName = teachers.find(t => String(t.id) === String(cellData.teacherId))?.name;
                    const isBreak = slot.type === 'break';
                    
                    const slotGradients = [
                        ['#EEF2FF', '#E0E7FF'], // Indigo
                        ['#ECFDF5', '#D1FAE5'], // Emerald
                        ['#FFFBEB', '#FEF3C7'], // Amber
                        ['#FDF2F8', '#FCE7F3'], // Pink
                    ];
                    const bgColors = slotGradients[sIdx % slotGradients.length];

                    return (
                        <TouchableOpacity
                            key={slot.id}
                            style={[
                                styles.agendaItem,
                                { 
                                    borderWidth: 0, 
                                    elevation: 2, 
                                    shadowColor: '#000', 
                                    shadowOpacity: 0.05, 
                                    shadowRadius: 10,
                                    minHeight: 110,
                                    backgroundColor: isDark ? '#1a1a1a' : '#fff',
                                    marginBottom: 16
                                }
                            ]}
                            activeOpacity={isViewOnly ? 1 : 0.7}
                            onPress={() => {
                                if (!isViewOnly && slot.type !== 'break') {
                                    setActiveSlot({ day: selectedDay, index: sIdx });
                                    setTempSlot(cellData);
                                }
                            }}
                        >
                            <View style={[
                                styles.agendaTimeContainer, 
                                { 
                                    width: 100, 
                                    backgroundColor: isDark ? '#222' : bgColors[0],
                                    borderRightWidth: 0,
                                    padding: 12
                                }
                            ]}>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={[styles.agendaTimeText, { fontSize: 14, color: isDark ? '#fff' : '#1e293b' }]}>{slot.startTime}</Text>
                                    <View style={{ height: 20, width: 2, backgroundColor: isDark ? theme.primary : bgColors[1], marginVertical: 4, borderRadius: 1 }} />
                                    <Text style={[styles.agendaTimeText, { fontSize: 14, color: isDark ? '#fff' : '#1e293b' }]}>{slot.endTime}</Text>
                                </View>
                                <View style={{ marginTop: 8, backgroundColor: isDark ? '#333' : '#fff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                    <Text style={[styles.agendaTimeSub, { fontSize: 9, fontWeight: '900', color: isDark ? theme.textLight : '#64748b' }]}>
                                        {slot.label.toUpperCase()}
                                    </Text>
                                </View>
                            </View>

                            <View style={[styles.agendaContent, { padding: 18 }]}>
                                {isBreak ? (
                                    <View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                            <MaterialCommunityIcons name="coffee" size={18} color={theme.warning} />
                                            <Text style={[styles.agendaSubject, { color: theme.warning, marginLeft: 8, fontSize: 18 }]}>Recess / Break</Text>
                                        </View>
                                        <View style={[styles.agendaBreakTag, { backgroundColor: theme.warning + '15', borderRadius: 8 }]}>
                                            <Text style={[styles.agendaBreakText, { color: theme.warning, letterSpacing: 0.5 }]}>TIME TO RECHARGE</Text>
                                        </View>
                                    </View>
                                ) : cellData.subject ? (
                                    <View>
                                        <Text style={[styles.agendaSubject, { fontSize: 19, color: theme.text }]}>{cellData.subject}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                                                <Ionicons name="person" size={12} color={theme.primary} />
                                            </View>
                                            <Text style={[styles.agendaTeacher, { color: theme.textLight, fontSize: 14, fontWeight: '600' }]}>
                                                {teacherName || 'Not Assigned'}
                                            </Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="add-circle-outline" size={20} color={theme.border} />
                                        <Text style={[styles.agendaEmptyText, { marginLeft: 8, fontSize: 15, fontWeight: '600' }]}>
                                            {isViewOnly ? 'Free Period' : 'Tap to Assign Subject'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            
                            {!isViewOnly && !isBreak && (
                                <View style={{ justifyContent: 'center', paddingRight: 20 }}>
                                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="pencil" size={16} color={theme.primary} />
                                    </View>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent={true} />
            <View style={[styles.header, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={22} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Routine Manager</Text>
                </View>
                <TouchableOpacity 
                    style={[
                        styles.backBtn, 
                        { marginRight: 0 }, 
                        (filterClass || filterSection) && { backgroundColor: theme.primary + '20', borderColor: theme.primary }
                    ]} 
                    onPress={() => setFilterModalVisible(true)}
                >
                    <Ionicons name="filter" size={20} color={(filterClass || filterSection) ? theme.primary : theme.text} />
                    {(filterClass || filterSection) && (
                        <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary, borderWidth: 1.5, borderColor: theme.card }} />
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollView} showsVerticalScrollIndicator={false}>
                {filteredOverview.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 100 }}>
                        <Ionicons name="search-outline" size={80} color={theme.border} />
                        <Text style={{ color: theme.textLight, marginTop: 20, fontSize: 16 }}>
                            {overview.length === 0 ? 'No routines created yet' : 'No matching routines found'}
                        </Text>
                        {(filterClass || filterSection) && (
                            <TouchableOpacity onPress={() => { setFilterClass(''); setFilterSection(''); }}>
                                <Text style={{ color: theme.primary, fontWeight: 'bold', marginTop: 10 }}>Clear Filters</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    filteredOverview.map((r, idx) => {
                        const gradients = [
                            ['#6366f1', '#a855f7'],
                            ['#0ea5e9', '#2563eb'],
                            ['#10b981', '#3b82f6'],
                            ['#f59e0b', '#ef4444'],
                        ];
                        const gradient = gradients[idx % gradients.length];
                        
                        return (
                            <TouchableOpacity 
                                key={idx} 
                                activeOpacity={0.9}
                                style={{
                                    marginBottom: 20,
                                    borderRadius: 24,
                                    elevation: 8,
                                    shadowColor: gradient[0],
                                    shadowOpacity: 0.2,
                                    shadowRadius: 10,
                                    shadowOffset: { width: 0, height: 4 },
                                    backgroundColor: theme.card,
                                }}
                                onPress={() => handleViewRoutine(r)}
                            >
                                <LinearGradient
                                    colors={isDark ? ['#1a1a1a', '#121212'] : ['#ffffff', '#f8fafc']}
                                    style={{ borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.border }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <LinearGradient
                                            colors={gradient}
                                            style={{ width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', elevation: 4 }}
                                        >
                                            <MaterialCommunityIcons name="calendar-clock" size={28} color="#fff" />
                                        </LinearGradient>
                                        
                                        <View style={{ marginLeft: 18, flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text, letterSpacing: -0.5 }}>
                                                    Class {r.class_name}
                                                </Text>
                                                <View style={{ backgroundColor: r.is_published ? '#27AE6020' : '#F39C1220', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '900', color: r.is_published ? '#27AE60' : '#F39C12', textTransform: 'uppercase' }}>
                                                        {r.is_published ? 'Published' : 'Draft'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={{ fontSize: 14, color: theme.textLight, fontWeight: '600', marginTop: 2 }}>
                                                Section {r.section} • {r.config?.slots?.length || 0} Slots
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 15, opacity: 0.5 }} />

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flexDirection: 'row', gap: 6 }}>
                                            {r.config?.days?.slice(0, 3).map((day: string) => (
                                                <View key={day} style={{ backgroundColor: theme.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '800', color: theme.primary }}>{day.substring(0, 3)}</Text>
                                                </View>
                                            ))}
                                            {(r.config?.days?.length || 0) > 3 && (
                                                <Text style={{ fontSize: 10, color: theme.textLight, fontWeight: 'bold', alignSelf: 'center' }}>
                                                    +{(r.config?.days?.length || 0) - 3} more
                                                </Text>
                                            )}
                                        </View>
                                        
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <TouchableOpacity 
                                                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.danger + '15', justifyContent: 'center', alignItems: 'center' }}
                                                onPress={() => handleDeleteRoutine(r)}
                                            >
                                                <Ionicons name="trash-outline" size={18} color={theme.danger} />
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center' }}
                                                onPress={() => handleViewRoutine(r)}
                                            >
                                                <Ionicons name="arrow-forward" size={18} color={theme.primary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>

            <TouchableOpacity style={styles.fab} onPress={startBuilder}>
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>

            <Modal 
                visible={isBuilderOpen} 
                animationType="slide" 
                transparent={true}
                onRequestClose={() => setIsBuilderOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                        style={styles.modalContent}
                    >
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>{isEditMode ? (isViewOnly ? 'View Schedule' : 'Edit Routine') : 'New Routine'}</Text>
                                {isViewOnly && <Text style={{ color: theme.textLight, fontSize: 13 }}>Class {target.class} - {target.section}</Text>}
                            </View>
                            <TouchableOpacity onPress={() => setIsBuilderOpen(false)} style={{ padding: 5 }}>
                                <Ionicons name="close-circle" size={32} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        {!isViewOnly && (
                            <View style={styles.stepIndicator}>
                                {[1, 2, 3].map(s => (
                                    <View key={s} style={[styles.stepBadge, builderStep === s && styles.stepBadgeActive]}>
                                        <Text style={[styles.stepText, builderStep === s && styles.stepTextActive]}>Step {s}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        <View style={{ flex: 1 }}>
                            {builderStep === 1 && renderStep1()}
                            {builderStep === 2 && renderStep2()}
                            {builderStep === 3 && renderStep3()}
                        </View>

                        <View style={styles.builderFooter}>
                            {builderStep > 1 && !isViewOnly && (
                                <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => setBuilderStep(builderStep - 1)}>
                                    <Text style={styles.buttonTextSecondary}>Back</Text>
                                </TouchableOpacity>
                            )}
                            {builderStep < 3 && !isViewOnly ? (
                                <TouchableOpacity 
                                    style={[styles.button, styles.buttonPrimary, (builderStep === 1 && (!target.class || !target.section)) && { opacity: 0.5 }]} 
                                    onPress={() => setBuilderStep(builderStep + 1)}
                                    disabled={builderStep === 1 && (!target.class || !target.section)}
                                >
                                    <Text style={styles.buttonText}>Continue</Text>
                                </TouchableOpacity>
                            ) : (
                                !isViewOnly ? (
                                    <>
                                        <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => handleSaveRoutine(false)}>
                                            <Text style={styles.buttonTextSecondary}>Save Draft</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.button, styles.buttonPrimary, { marginLeft: 10 }]} onPress={() => handleSaveRoutine(true)}>
                                            <Text style={styles.buttonText}>Publish</Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={() => setIsViewOnly(false)}>
                                        <Text style={styles.buttonText}>Edit Routine</Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    </KeyboardAvoidingView>
                </View>

                {/* Assignment Sub-Modal */}
                <Modal 
                    visible={activeSlot !== null} 
                    transparent={true} 
                    animationType="fade"
                    onRequestClose={() => setActiveSlot(null)}
                >
                    <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                        <KeyboardAvoidingView 
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ width: '100%' }}
                        >
                            <View style={[styles.modalContent, { borderRadius: 30, height: 'auto', maxHeight: SCREEN_HEIGHT * 0.8, width: '100%', padding: 0, overflow: 'hidden' }]}>
                                <ScrollView 
                                    showsVerticalScrollIndicator={false} 
                                    keyboardShouldPersistTaps="handled"
                                    contentContainerStyle={{ padding: 25, paddingBottom: 200 }}
                                >
                                    <View style={styles.modalHeader}>
                                        <View>
                                            <Text style={styles.modalTitle}>Assign Session</Text>
                                            <Text style={{ color: theme.textLight, marginTop: 4, fontSize: 14 }}>
                                                {activeSlot?.day} • {config.slots[activeSlot?.index]?.startTime} - {config.slots[activeSlot?.index]?.endTime}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={() => setActiveSlot(null)} style={{ padding: 5 }}>
                                            <Ionicons name="close-circle" size={30} color={theme.textLight} />
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <Text style={styles.label}>Subject Name</Text>
                                    <TextInput
                                        style={[styles.input, { color: theme.text }]}
                                        placeholder="e.g. Mathematics"
                                        placeholderTextColor={theme.textLight}
                                        value={tempSlot.subject}
                                        onChangeText={(val) => setTempSlot({ ...tempSlot, subject: val })}
                                    />

                                    <Text style={styles.label}>Assign Teacher</Text>
                                    <View style={{ maxHeight: 200, marginBottom: 10 }}>
                                        <ScrollView nestedScrollEnabled={true}>
                                            {teachers.map(t => (
                                                <TouchableOpacity 
                                                    key={t.id} 
                                                    style={[styles.dayChip, { marginRight: 0, width: '100%', marginBottom: 8 }, String(tempSlot.teacherId) === String(t.id) && styles.dayChipActive]}
                                                    onPress={() => setTempSlot({ ...tempSlot, teacherId: String(t.id) })}
                                                >
                                                    <Text style={[styles.dayChipText, String(tempSlot.teacherId) === String(t.id) && styles.dayChipTextActive]}>
                                                        {t.name} <Text style={{ fontSize: 12, opacity: 0.8 }}>({t.subject})</Text>
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>

                                    <View style={[styles.builderFooter, { marginTop: 20 }]}>
                                        <TouchableOpacity 
                                            style={[styles.button, { backgroundColor: theme.danger + '20', flex: 0.4 }]} 
                                            onPress={() => {
                                                const newData = { ...routineData };
                                                if (!newData[activeSlot.day]) newData[activeSlot.day] = [];
                                                newData[activeSlot.day][activeSlot.index] = { subject: '', teacherId: '' };
                                                setRoutineData(newData);
                                                setActiveSlot(null);
                                            }}
                                        >
                                            <Text style={[styles.buttonText, { color: theme.danger }]}>Clear</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            style={[styles.button, styles.buttonPrimary, { flex: 1 }]} 
                                            onPress={() => {
                                                if (!tempSlot.subject) { Toast.show({ type: 'info', text1: 'Subject required' }); return; }
                                                const newData = { ...routineData };
                                                if (!newData[activeSlot.day]) newData[activeSlot.day] = [];
                                                newData[activeSlot.day][activeSlot.index] = tempSlot;
                                                setRoutineData(newData);
                                                setActiveSlot(null);
                                            }}
                                        >
                                            <Text style={styles.buttonText}>Apply Assignment</Text>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                                </Modal>
                            </Modal>
                
                            {/* Filter Bottom Sheet */}
                            <Modal
                                visible={filterModalVisible}
                                transparent={true}
                                animationType="slide"
                                onRequestClose={() => setFilterModalVisible(false)}
                            >
                                <TouchableOpacity 
                                    style={styles.modalOverlay} 
                                    activeOpacity={1} 
                                    onPress={() => setFilterModalVisible(false)}
                                >
                                    <TouchableOpacity 
                                        activeOpacity={1} 
                                        style={[styles.modalContent, { height: 'auto', paddingBottom: insets.bottom + 30 }]}
                                    >
                                        <View style={{ width: 40, height: 5, backgroundColor: theme.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
                                        <View style={styles.modalHeader}>
                                            <Text style={styles.modalTitle}>Filter Routines</Text>
                                            <TouchableOpacity onPress={() => { setFilterClass(''); setFilterSection(''); setFilterModalVisible(false); }}>
                                                <Text style={{ color: theme.danger, fontWeight: '700' }}>Reset</Text>
                                            </TouchableOpacity>
                                        </View>
                
                                                                <Text style={styles.label}>By Class</Text>
                                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                                                                    {availableFilterOptions.classes.map(c => (
                                                                        <TouchableOpacity
                                                                            key={c}
                                                                            style={[styles.dayChip, filterClass === c && styles.dayChipActive, { marginRight: 10 }]}
                                                                            onPress={() => setFilterClass(filterClass === c ? '' : c)}
                                                                        >
                                                                            <Text style={[styles.dayChipText, filterClass === c && styles.dayChipTextActive]}>Class {c}</Text>
                                                                        </TouchableOpacity>
                                                                    ))}
                                                                </ScrollView>
                                        
                                                                <Text style={styles.label}>By Section</Text>
                                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                                    {availableFilterOptions.sections.map(s => (
                                                                        <TouchableOpacity
                                                                            key={s}
                                                                            style={[styles.dayChip, filterSection === s && styles.dayChipActive, { marginRight: 10 }]}
                                                                            onPress={() => setFilterSection(filterSection === s ? '' : s)}
                                                                        >
                                                                            <Text style={[styles.dayChipText, filterSection === s && styles.dayChipTextActive]}>Sec {s}</Text>
                                                                        </TouchableOpacity>
                                                                    ))}
                                                                </ScrollView>                
                                        <TouchableOpacity 
                                            style={[styles.button, styles.buttonPrimary, { marginTop: 30 }]} 
                                            onPress={() => setFilterModalVisible(false)}
                                        >
                                            <Text style={styles.buttonText}>Apply Filter</Text>
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            </Modal>
                        </View>
                    );
}
