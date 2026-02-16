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
            const token = await AsyncStorage.getItem('token');
            const userDataStr = await AsyncStorage.getItem('userData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const userType = await AsyncStorage.getItem('userType');
            const sessionId = userData ? JSON.parse(userDataStr || '{}').current_session_id : null;

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
            const token = await AsyncStorage.getItem('token');
            const userDataStr = await AsyncStorage.getItem('userData');
            const sessionId = userDataStr ? JSON.parse(userDataStr).current_session_id : null;

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
                            const token = await AsyncStorage.getItem('token');
                            const userDataStr = await AsyncStorage.getItem('userData');
                            const sessionId = userDataStr ? JSON.parse(userDataStr).current_session_id : null;

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
            const token = await AsyncStorage.getItem('token');
            const userDataStr = await AsyncStorage.getItem('userData');
            const sessionId = userDataStr ? JSON.parse(userDataStr).current_session_id : null;

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
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            backgroundColor: theme.card,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        headerTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginLeft: 15 },
        scrollView: { padding: 20 },
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
            bottom: 30,
            right: 30,
            width: 60,
            height: 60,
            borderRadius: 30,
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
            padding: 20,
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
            paddingBottom: Platform.OS === 'ios' ? 20 : 10,
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
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                value={slot.startTime}
                                placeholder="09:00"
                                placeholderTextColor={theme.textLight}
                                onChangeText={(val) => updateSlot(idx, 'startTime', val)}
                                editable={!isViewOnly}
                                keyboardType="numbers-and-punctuation"
                            />
                        </View>
                        <View style={styles.slotInputGroup}>
                            <Text style={{ fontSize: 11, color: theme.textLight, marginBottom: 6, fontWeight: '700' }}>End</Text>
                            <TextInput
                                style={[styles.input, { color: theme.text }]}
                                value={slot.endTime}
                                placeholder="09:45"
                                placeholderTextColor={theme.textLight}
                                onChangeText={(val) => updateSlot(idx, 'endTime', val)}
                                editable={!isViewOnly}
                                keyboardType="numbers-and-punctuation"
                            />
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
                <TouchableOpacity style={[styles.button, { backgroundColor: theme.accent, marginTop: 5 }]} onPress={addSlot}>
                    <Text style={styles.buttonText}>+ Add New Slot</Text>
                </TouchableOpacity>
            )}
        </ScrollView>
    );

    const renderStep3 = () => (
        <View style={{ flex: 1 }}>
            <View style={styles.agendaDaySelector}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {config.days.map((day: string) => (
                        <TouchableOpacity
                            key={day}
                            style={[styles.agendaDayChip, selectedDay === day && styles.agendaDayChipActive]}
                            onPress={() => setSelectedDay(day)}
                        >
                            <Text style={[styles.agendaDayText, selectedDay === day && styles.agendaDayTextActive]}>{day}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView style={styles.agendaList} showsVerticalScrollIndicator={false}>
                {config.slots.map((slot: any, sIdx: number) => {
                    const cellData = routineData[selectedDay]?.[sIdx] || { subject: '', teacherId: '' };
                    const teacherName = teachers.find(t => String(t.id) === String(cellData.teacherId))?.name;

                    return (
                        <TouchableOpacity
                            key={slot.id}
                            style={styles.agendaItem}
                            activeOpacity={isViewOnly ? 1 : 0.7}
                            onPress={() => {
                                if (!isViewOnly && slot.type !== 'break') {
                                    setActiveSlot({ day: selectedDay, index: sIdx });
                                    setTempSlot(cellData);
                                }
                            }}
                        >
                            <View style={styles.agendaTimeContainer}>
                                <Text style={styles.agendaTimeText}>{slot.startTime}</Text>
                                <View style={{ height: 10, width: 1, backgroundColor: theme.border, marginVertical: 2 }} />
                                <Text style={styles.agendaTimeText}>{slot.endTime}</Text>
                                <Text style={styles.agendaTimeSub}>{slot.label}</Text>
                            </View>

                            <View style={styles.agendaContent}>
                                {slot.type === 'break' ? (
                                    <View>
                                        <Text style={[styles.agendaSubject, { color: theme.warning }]}>Recess / Break</Text>
                                        <View style={styles.agendaBreakTag}>
                                            <Text style={styles.agendaBreakText}>NON-ACADEMIC</Text>
                                        </View>
                                    </View>
                                ) : cellData.subject ? (
                                    <View>
                                        <Text style={styles.agendaSubject}>{cellData.subject}</Text>
                                        <View style={styles.agendaTeacher}>
                                            <Text style={{ color: theme.textLight }}>{teacherName || 'Not Assigned'}</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <Text style={styles.agendaEmptyText}>{isViewOnly ? 'Free Period' : 'Tap to Assign'}</Text>
                                )}
                            </View>
                            
                            {!isViewOnly && slot.type !== 'break' && (
                                <View style={{ justifyContent: 'center', paddingRight: 15 }}>
                                    <Ionicons name="create-outline" size={20} color={theme.primary + '80'} />
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
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.card} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Routine Manager</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollView}>
                {overview.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 100 }}>
                        <Ionicons name="calendar-outline" size={80} color={theme.border} />
                        <Text style={{ color: theme.textLight, marginTop: 20, fontSize: 16 }}>No routines created yet</Text>
                    </View>
                ) : (
                    overview.map((r, idx) => (
                        <TouchableOpacity key={idx} style={styles.card} onPress={() => handleViewRoutine(r)}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ width: 50, height: 50, borderRadius: 15, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="calendar-clock" size={26} color={theme.primary} />
                                </View>
                                <View style={{ marginLeft: 15, flex: 1 }}>
                                    <Text style={styles.cardTitle}>Class {r.class_name}</Text>
                                    <Text style={styles.cardSubtitle}>Section {r.section}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.border} />
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
                                <View style={[styles.cardBadge, { backgroundColor: r.is_published ? '#27AE6015' : '#F39C1215', marginTop: 0 }]}>
                                    <Text style={[styles.cardBadgeText, { color: r.is_published ? '#27AE60' : '#F39C12' }]}>
                                        {r.is_published ? 'Published' : 'Draft'}
                                    </Text>
                                </View>
                                <TouchableOpacity style={{ padding: 5 }} onPress={() => handleDeleteRoutine(r)}>
                                    <Ionicons name="trash-outline" size={20} color={theme.danger} />
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            <TouchableOpacity style={styles.fab} onPress={startBuilder}>
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>

            <Modal visible={isBuilderOpen} animationType="slide" transparent={true}>
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
                <Modal visible={activeSlot !== null} transparent={true} animationType="fade">
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

        </View>
    );
}
