import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  RefreshControl, 
  StatusBar, 
  Platform, 
  Dimensions, 
  Modal, 
  ScrollView, 
  TextInput,
  KeyboardAvoidingView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type GradingRule = {
  grade: string;
  min: number;
  max: number;
};

type SubjectRule = {
  name: string;
  max_theory: number;
  max_practical: number;
  passing_marks: number;
};

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

export default function TeacherResultsDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Creation Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJuniorModal, setShowJuniorModal] = useState(false);
  const [juniorStep, setJuniorStep] = useState(1);
  const [showModeModal, setShowModeModal] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'senior' | 'junior' | null>(null);
  const [createStep, setCreateStep] = useState(1);
  const [availableClasses, setAvailableClasses] = useState<{class: string, section: string}[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Filter States
  const [filterTitle, setFilterTitle] = useState('All');
  const [filterClass, setFilterClass] = useState('All');
  const [filterSection, setFilterSection] = useState('All');
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    class_name: '',
    section: '',
    show_highest_marks: false,
    include_percentage: true,
    include_grade: true,
  });

  const [gradingRules, setGradingRules] = useState<GradingRule[]>([
    { grade: 'A+', min: 90, max: 100 },
    { grade: 'A', min: 80, max: 89 },
    { grade: 'B', min: 60, max: 79 },
    { grade: 'C', min: 40, max: 59 },
    { grade: 'F', min: 0, max: 39 },
  ]);

  const [subjects, setSubjects] = useState<SubjectRule[]>([]);

  const uniqueExamTitles = useMemo(() => ['All', ...new Set(exams.map((e: any) => e.name))], [exams]);
  const uniqueClasses = useMemo(() => {
    const classes = ['All', ...new Set(exams.map((e: any) => e.class_name.toString()))];
    return classes.sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b, undefined, { numeric: true }));
  }, [exams]);

  const availableSections = useMemo(() => {
    if (filterClass === 'All') return ['All'];
    const sections = ['All', ...new Set(exams.filter((e: any) => e.class_name.toString() === filterClass).map((e: any) => e.section))];
    return sections.sort();
  }, [exams, filterClass]);

  const filteredExams = useMemo(() => {
    return exams.filter((e: any) => {
        const matchTitle = filterTitle === 'All' || e.name === filterTitle;
        const matchClass = filterClass === 'All' || e.class_name.toString() === filterClass;
        const matchSection = filterSection === 'All' || e.section === filterSection;
        return matchTitle && matchClass && matchSection;
    });
  }, [exams, filterTitle, filterClass, filterSection]);

  const fetchExams = async () => {
    try {
      const token = await AsyncStorage.getItem('teacherToken');
      const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
      const userDataStr = await AsyncStorage.getItem('teacherData');
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

      const response = await axios.get(`${API_ENDPOINTS.EXAM}/list`, {
        headers: { 
            Authorization: `Bearer ${token}`,
            'x-academic-session-id': sessionId?.toString()
        }
      });
      setExams(response.data);
    } catch (error) {
      console.error('Error fetching exams', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAvailableClasses = async () => {
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
        const studentsList = response.data.students || [];
        const unique = [];
        const map = new Map();
        for (const s of studentsList) {
            const key = `${s.class}-${s.section}`;
            if (!map.has(key)) {
                map.set(key, true);
                unique.push({ class: s.class, section: s.section });
            }
        }
        setAvailableClasses(unique.sort((a, b) => String(a.class).localeCompare(String(b.class), undefined, { numeric: true }) || a.section.localeCompare(b.section)));
    } catch (error) {
        console.error('Error fetching teacher classes:', error);
    }
  };

  useEffect(() => {
    fetchExams();
    fetchAvailableClasses();
  }, []);

  const handleSubjectChange = <K extends keyof SubjectRule>(index: number, field: K, value: string) => {
    const updated = [...subjects];
    const nextValue = (field === 'name' ? value : (parseInt(value, 10) || 0)) as SubjectRule[K];
    updated[index][field] = nextValue;
    setSubjects(updated);
  };

  const handleGradeChange = <K extends keyof GradingRule>(index: number, field: K, value: string) => {
    const updated = [...gradingRules];
    const nextValue = (field === 'grade' ? value : (parseInt(value, 10) || 0)) as GradingRule[K];
    updated[index][field] = nextValue;
    setGradingRules(updated);
  };

  const handleCreateSubmit = async () => {
    if (!formData.name || !formData.class_name || !formData.section) return Alert.alert('Error', 'Please fill all details');
    try {
        setIsCreating(true);
        const token = await AsyncStorage.getItem('teacherToken');
        const payload = { 
            ...formData, 
            subjects_blueprint: subjects, 
            grading_rules: gradingRules, 
            evaluation_mode: selectedMode || 'senior',
            manual_stats: { class_topper_name: '', class_topper_marks: '', section_topper_name: '', section_topper_marks: '' } 
        };
        await axios.post(`${API_ENDPOINTS.EXAM}/create`, payload, { headers: { Authorization: `Bearer ${token}` } });
        Toast.show({ type: 'success', text1: 'Marksheet Created!' });
        setShowCreateModal(false); 
        setShowJuniorModal(false);
        setJuniorStep(1);
        setCreateStep(1);
        setSelectedMode(null);
        setFormData({ name: '', class_name: '', section: '', show_highest_marks: false, include_percentage: true, include_grade: true });
        setSubjects([]);
        fetchExams();
    } catch (error) {
        Toast.show({ type: 'error', text1: 'Creation Failed' });
    } finally { setIsCreating(false); }
  };

  const toggleResultStatus = async (id: any, currentStatus: boolean) => {
    try {
        const newStatus = !currentStatus;
        const token = await AsyncStorage.getItem('teacherToken');
        setExams(prev => prev.map((exam: any) => exam.id === id ? { ...exam, is_published: newStatus } : exam));
        await axios.patch(`${API_ENDPOINTS.EXAM}/${id}/toggle-publish`, { is_published: newStatus }, { headers: { Authorization: `Bearer ${token}` } });
        Toast.show({ type: 'success', text1: newStatus ? 'Results Published! 📊' : 'Results Hidden' });
    } catch (error) {
        setExams(prev => prev.map((exam: any) => exam.id === id ? { ...exam, is_published: currentStatus } : exam));
        Toast.show({ type: 'error', text1: 'Update Failed' });
    }
  };

  const deleteExam = async (id: number) => {
    Alert.alert("Delete Marksheet", "Are you sure? All data will be lost.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            try {
                const token = await AsyncStorage.getItem('teacherToken');
                await axios.delete(`${API_ENDPOINTS.EXAM}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                setExams(prev => prev.filter((e: any) => e.id !== id));
            } catch (error) {}
        }}
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: insets.top + 10 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
    card: { borderRadius: 20, marginBottom: 16, borderWidth: 1, overflow: 'hidden', elevation: 4, backgroundColor: theme.card, borderColor: theme.border, minHeight: 120 },
    iconContainer: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    examName: { fontSize: 18, fontWeight: '900', color: theme.text },
    fab: { position: 'absolute', bottom: 30, right: 25, width: 65, height: 65, borderRadius: 32.5, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', elevation: 8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalBox: { width: SCREEN_WIDTH - 40, backgroundColor: theme.card, borderRadius: 24, overflow: 'hidden' },
    modalHeader: { padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: '900', color: theme.text },
    modalBody: { padding: 20 },
    label: { fontSize: 12, fontWeight: '800', color: theme.textLight, marginBottom: 8, textTransform: 'uppercase' },
    input: { backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', borderRadius: 12, padding: 12, color: theme.text, borderWidth: 1, borderColor: theme.border, marginBottom: 20 },
    pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    pickerChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background },
    pickerChipSelected: { borderColor: theme.primary, backgroundColor: theme.primary + '15' },
    pickerChipText: { fontSize: 13, fontWeight: '700', color: theme.textLight },
    pickerChipTextSelected: { color: theme.primary },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    toggleLabel: { fontSize: 14, fontWeight: '700', color: theme.text },
    toggleSub: { fontSize: 10, color: theme.textLight },
    stepIndicator: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
    stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.border },
    stepDotActive: { backgroundColor: theme.primary, width: 20 },
    modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', gap: 12 },
    btnSecondary: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: isDark ? '#333' : '#f1f5f9', alignItems: 'center' },
    btnPrimary: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center' },
    btnText: { fontSize: 14, fontWeight: '800' },
    subRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
    subInput: { flex: 1, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', padding: 8, borderRadius: 8, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 12, textAlign: 'center' },
    // Mode Selection Styles
    modeCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, borderWidth: 1.5, marginBottom: 15, backgroundColor: theme.background },
    modeIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    modeName: { fontSize: 17, fontWeight: '900', marginBottom: 4 },
    modeDesc: { fontSize: 11, color: theme.textLight, lineHeight: 15, fontWeight: '600' },
  }), [insets, theme, isDark, createStep]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/(teacher)/results/${item.id}`)} activeOpacity={0.9}>
      <View style={{ padding: 18, flex: 1 }}>
        <View style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 7, fontWeight: '900', color: item.evaluation_mode === 'junior' ? '#0288D1' : '#E91E63', marginBottom: 2, letterSpacing: 0.5 }}>
                {(item.evaluation_mode || 'senior').toUpperCase()}
            </Text>
            <ModernToggle active={item.is_published} onToggle={() => toggleResultStatus(item.id, item.is_published)} theme={{ isDark }} />
            <Text style={{ fontSize: 8, fontWeight: '900', color: item.is_published ? '#27AE60' : theme.textLight, marginTop: 4 }}>{item.is_published ? 'PUBLISHED' : 'DRAFT'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#3E1A23' : '#FCE4EC', marginRight: 15 }]}>
                <Ionicons name="document-text" size={24} color="#E91E63" />
            </View>
            <View style={{ flex: 1, paddingRight: 45 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Text style={styles.examName} numberOfLines={1}>{item.name}</Text>
                    <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: theme.primary }}>{item.class_name}-{item.section}</Text>
                    </View>
                </View>
                <Text style={{ color: theme.textLight, fontSize: 11, fontWeight: '600', marginTop: 4 }}>
                    {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
            </View>
        </View>
        <View style={{ position: 'absolute', bottom: 8, right: 8 }}>
            <TouchableOpacity onPress={() => deleteExam(item.id)} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.danger + '10', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.danger + '20' }}>
                <Ionicons name="trash-outline" size={18} color={theme.danger} />
            </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={28} color={theme.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Results Registry</Text>
        <TouchableOpacity onPress={() => setShowFilterSheet(true)} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: filterTitle !== 'All' || filterClass !== 'All' ? theme.primary + '20' : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="filter" size={24} color={filterTitle !== 'All' || filterClass !== 'All' ? theme.primary : theme.text} />
        </TouchableOpacity>
      </View>

      {loading ? <View style={{flex:1, justifyContent:'center'}}><ActivityIndicator size="large" color={theme.primary} /></View> : (
        <FlatList
          data={filteredExams}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchExams} colors={[theme.primary]} />}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowModeModal(true)}><Ionicons name="add" size={32} color="#fff" /></TouchableOpacity>

      {/* MODE SELECTION MODAL */}
      <Modal visible={showModeModal} transparent animationType="fade" onRequestClose={() => setShowModeModal(false)}>
        <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowModeModal(false)}
        >
            <View style={[styles.modalBox, { padding: 25 }]}>
                <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 10 }]}>Select Evaluation Mode</Text>
                <Text style={{ color: theme.textLight, textAlign: 'center', marginBottom: 25, fontSize: 13, fontWeight: '600' }}>
                    Choose the type of marksheet you want to build
                </Text>

                <TouchableOpacity 
                    style={[styles.modeCard, { borderColor: '#E91E63' }]}
                    onPress={() => {
                        setSelectedMode('senior');
                        setShowModeModal(false);
                        setShowCreateModal(true);
                    }}
                >
                    <View style={[styles.modeIcon, { backgroundColor: '#FCE4EC' }]}>
                        <Ionicons name="school" size={28} color="#E91E63" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.modeName, { color: theme.text }]}>Senior Mode</Text>
                        <Text style={styles.modeDesc}>Numerical marks, theory/practical breakdown, and percentage.</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.modeCard, { borderColor: '#0288D1' }]}
                    onPress={() => {
                        setSelectedMode('junior');
                        setShowModeModal(false);
                        setShowJuniorModal(true);
                    }}
                >
                    <View style={[styles.modeIcon, { backgroundColor: '#E1F5FE' }]}>
                        <Ionicons name="color-palette" size={28} color="#0288D1" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.modeName, { color: theme.text }]}>Junior Mode</Text>
                        <Text style={styles.modeDesc}>Skill-based grading, indicators, and descriptive assessment.</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={{ marginTop: 15, padding: 15, alignItems: 'center' }}
                    onPress={() => setShowModeModal(false)}
                >
                    <Text style={{ color: theme.textLight, fontWeight: '800' }}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
      </Modal>

      {/* JUNIOR CREATION MODAL */}
      <Modal visible={showJuniorModal} transparent animationType="slide" onRequestClose={() => { setShowJuniorModal(false); setJuniorStep(1); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                keyboardVerticalOffset={60}
                style={{ flex: 1, justifyContent: 'flex-end' }}
            >
                <TouchableOpacity 
                    activeOpacity={1} 
                    onPress={e => e.stopPropagation()} 
                    style={{ 
                        backgroundColor: theme.card, 
                        borderRadius: 32, 
                        marginHorizontal: 12,
                        marginBottom: 40,
                        width: SCREEN_WIDTH - 24,
                        maxHeight: SCREEN_HEIGHT * 0.85,
                        elevation: 25,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -10 },
                        shadowOpacity: 0.2,
                        shadowRadius: 15,
                        overflow: 'hidden'
                    }}
                >
                    <View style={{ width: 40, height: 5, backgroundColor: theme.border, borderRadius: 3, alignSelf: 'center', marginTop: 12 }} />

                    <View style={[styles.modalHeader, { borderBottomWidth: 0 }]}>
                        <View>
                            <Text style={[styles.modalTitle, { color: '#0288D1', fontSize: 22 }]}>Junior Assessment</Text>
                            <Text style={{ fontSize: 11, color: theme.textLight, fontWeight: '800', letterSpacing: 1 }}>
                                STEP {juniorStep}: {juniorStep === 1 ? 'CONFIGURATION' : 'SKILLS BLUEPRINT'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => { setShowJuniorModal(false); setJuniorStep(1); setSubjects([]); }}>
                            <Ionicons name="close-circle" size={32} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        style={{ maxHeight: SCREEN_HEIGHT * 0.45 }} 
                        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="handled"
                    >
                        {juniorStep === 1 ? (
                            <View>
                                <Text style={[styles.label, { color: '#0288D1' }]}>Evaluation Title</Text>
                                <TextInput 
                                    style={[styles.input, { fontSize: 16, height: 56 }]} 
                                    placeholder="e.g. Nursery First Term 2026" 
                                    placeholderTextColor={theme.textLight}
                                    value={formData.name}
                                    onChangeText={t => setFormData({...formData, name: t})}
                                />

                                <Text style={[styles.label, { color: '#0288D1', marginTop: 10 }]}>1. Choose Grade</Text>
                                <View style={styles.pickerContainer}>
                                    {[...new Set(availableClasses.map(item => item.class))].map((cls, idx) => {
                                        const isSelected = formData.class_name === cls;
                                        return (
                                            <TouchableOpacity 
                                                key={idx} 
                                                style={[
                                                    styles.pickerChip, 
                                                    { paddingHorizontal: 20, paddingVertical: 12 },
                                                    isSelected && { borderColor: '#0288D1', backgroundColor: '#0288D115' }
                                                ]}
                                                onPress={() => setFormData({...formData, class_name: cls as string, section: ''})}
                                            >
                                                <Text style={[styles.pickerChipText, { fontSize: 15, fontWeight: '800' }, isSelected && { color: '#0288D1' }]}>
                                                    Grade {cls}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {formData.class_name ? (
                                    <View style={{ marginTop: 10 }}>
                                        <Text style={[styles.label, { color: '#0288D1' }]}>2. Select Section</Text>
                                        <View style={styles.pickerContainer}>
                                            {availableClasses
                                                .filter(item => item.class === formData.class_name)
                                                .map((item, idx) => {
                                                    const isSelected = formData.section === item.section;
                                                    return (
                                                        <TouchableOpacity 
                                                            key={idx} 
                                                            style={[
                                                                styles.pickerChip, 
                                                                { minWidth: 60, alignItems: 'center' },
                                                                isSelected && { borderColor: '#0288D1', backgroundColor: '#0288D1' }
                                                            ]}
                                                            onPress={() => setFormData({...formData, section: item.section})}
                                                        >
                                                            <Text style={[styles.pickerChipText, isSelected && { color: '#fff' }]}>
                                                                {item.section}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })
                                            }
                                        </View>
                                    </View>
                                ) : null}
                            </View>
                        ) : (
                            <View>
                                <Text style={[styles.label, { color: '#0288D1' }]}>Add Skills / Indicators to assess</Text>
                                <Text style={{ fontSize: 11, color: theme.textLight, marginBottom: 20, fontWeight: '600' }}>
                                    These are the items teachers will provide grades for (e.g. Handwriting, Social Interaction)
                                </Text>

                                {subjects.map((sub, idx) => (
                                    <View key={idx} style={[styles.subRow, { marginBottom: 15 }]}>
                                        <View style={{ flex: 1, backgroundColor: isDark ? '#333' : '#f8fafc', borderRadius: 15, paddingHorizontal: 15, height: 50, justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}>
                                            <TextInput 
                                                style={{ color: theme.text, fontWeight: '700', fontSize: 14 }} 
                                                value={sub.name} 
                                                placeholder="e.g. Language Fluency"
                                                placeholderTextColor={theme.textLight}
                                                onChangeText={(text) => {
                                                    const updated = [...subjects];
                                                    updated[idx].name = text;
                                                    setSubjects(updated);
                                                }}
                                            />
                                        </View>
                                        <TouchableOpacity 
                                            onPress={() => setSubjects(subjects.filter((_, i) => i !== idx))}
                                            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.danger + '15', justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <Ionicons name="trash" size={18} color={theme.danger} />
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                <TouchableOpacity 
                                    style={{ 
                                        flexDirection: 'row', 
                                        alignItems: 'center', 
                                        marginTop: 10, 
                                        gap: 10, 
                                        padding: 15, 
                                        borderRadius: 15, 
                                        borderWidth: 1, 
                                        borderColor: '#0288D1', 
                                        borderStyle: 'dashed',
                                        backgroundColor: '#0288D105'
                                    }}
                                    onPress={() => setSubjects([...subjects, { name: '', max_theory: 0, max_practical: 0, passing_marks: 0 }])}
                                >
                                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#0288D1', justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="add" size={20} color="#fff" />
                                    </View>
                                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 14 }}>Add Assessment Indicator</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>

                    <View style={{ padding: 24, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.card, flexDirection: 'row', gap: 12 }}>
                        {juniorStep === 2 && (
                            <TouchableOpacity 
                                style={[styles.btnSecondary, { flex: 1, height: 56, borderRadius: 18 }]}
                                onPress={() => setJuniorStep(1)}
                            >
                                <Text style={[styles.btnText, { color: theme.text }]}>Back</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                            activeOpacity={0.8}
                            style={{ 
                                backgroundColor: (juniorStep === 1 ? (formData.name && formData.class_name && formData.section) : (subjects.length > 0 && subjects.every(s => s.name.trim()))) ? '#0288D1' : theme.border, 
                                flex: 2, 
                                height: 56, 
                                borderRadius: 18, 
                                justifyContent: 'center', 
                                alignItems: 'center',
                                elevation: (juniorStep === 1 ? (formData.name && formData.class_name && formData.section) : (subjects.length > 0)) ? 8 : 0,
                                shadowColor: '#0288D1',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.3,
                                shadowRadius: 8
                            }} 
                            disabled={juniorStep === 1 ? !(formData.name && formData.class_name && formData.section) : !(subjects.length > 0 && subjects.every(s => s.name.trim()))}
                            onPress={() => {
                                if (juniorStep === 1) setJuniorStep(2);
                                else handleCreateSubmit();
                            }}
                        >
                            {isCreating ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>
                                    {juniorStep === 1 ? 'Next: Skills Setup ➔' : 'Finalize & Save ⚡️'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* REFINED CREATION MODAL */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { height: SCREEN_HEIGHT * 0.6, paddingBottom: 0 }]}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>New Marksheet Blueprint</Text>
                        <TouchableOpacity onPress={() => { setShowCreateModal(false); setCreateStep(1); }}>
                            <Ionicons name="close" size={24} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        style={{ flex: 1 }} 
                        contentContainerStyle={[styles.modalBody, { paddingBottom: 150 }]} // Increased bottom padding significantly
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="always"
                    >
                        <View style={styles.stepIndicator}>
                            {[1, 2, 3].map(s => <View key={s} style={[styles.stepDot, createStep === s && styles.stepDotActive]} />)}
                        </View>

                        {createStep === 1 && (
                            <View style={{ paddingBottom: 20 }}>
                                <Text style={styles.label}>Examination Name</Text>
                                <TextInput 
                                    style={styles.input} 
                                    placeholder="e.g. Annual Final Term 2026" 
                                    placeholderTextColor={theme.textLight}
                                    value={formData.name}
                                    onChangeText={t => setFormData({...formData, name: t})}
                                />
                                <Text style={styles.label}>Select Class & Section</Text>
                                <View style={[styles.pickerContainer, { minHeight: 300 }]}>
                                    {availableClasses.map((item, idx) => {
                                        const isSelected = formData.class_name === item.class && formData.section === item.section;
                                        return (
                                            <TouchableOpacity 
                                                key={idx} 
                                                style={[styles.pickerChip, isSelected && styles.pickerChipSelected]}
                                                onPress={() => setFormData({...formData, class_name: item.class as string, section: item.section})}
                                            >
                                                <Text style={[styles.pickerChipText, isSelected && styles.pickerChipTextSelected]}>
                                                    {item.class}-{item.section}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {createStep === 2 && (
                            <View>
                                <Text style={[styles.label, { marginBottom: 20 }]}>Marksheet Display Features</Text>
                                
                                <View style={styles.toggleRow}>
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={styles.toggleLabel}>Highest Marks Column</Text>
                                        <Text style={styles.toggleSub}>Show class topper marks for each subject</Text>
                                    </View>
                                    <ModernToggle 
                                        active={formData.show_highest_marks} 
                                        onToggle={() => setFormData({...formData, show_highest_marks: !formData.show_highest_marks})}
                                        theme={{ isDark }}
                                    />
                                </View>

                                <View style={styles.toggleRow}>
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={styles.toggleLabel}>Include Percentage</Text>
                                        <Text style={styles.toggleSub}>Auto-calculate aggregate percentage</Text>
                                    </View>
                                    <ModernToggle 
                                        active={formData.include_percentage} 
                                        onToggle={() => setFormData({...formData, include_percentage: !formData.include_percentage})}
                                        theme={{ isDark }}
                                    />
                                </View>

                                <View style={styles.toggleRow}>
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={styles.toggleLabel}>Include Grading</Text>
                                        <Text style={styles.toggleSub}>Display letter grades on report card</Text>
                                    </View>
                                    <ModernToggle 
                                        active={formData.include_grade} 
                                        onToggle={() => setFormData({...formData, include_grade: !formData.include_grade})}
                                        theme={{ isDark }}
                                    />
                                </View>

                                {formData.include_grade && (
                                    <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 20 }}>
                                        <Text style={styles.label}>MANUAL GRADING RULES (%)</Text>
                                        {gradingRules.map((rule, idx) => (
                                            <View key={idx} style={[styles.subRow, { marginBottom: 15 }]}>
                                                <TextInput 
                                                    style={[styles.subInput, { flex: 1, fontWeight: '900' }]} 
                                                    value={rule.grade} 
                                                    onChangeText={t => handleGradeChange(idx, 'grade', t)}
                                                />
                                                <Text style={{ fontSize: 12, color: theme.textLight }}>from</Text>
                                                <TextInput 
                                                    style={styles.subInput} 
                                                    value={rule.min.toString()} 
                                                    keyboardType="numeric"
                                                    onChangeText={t => handleGradeChange(idx, 'min', t)}
                                                />
                                                <Text style={{ fontSize: 12, color: theme.textLight }}>to</Text>
                                                <TextInput 
                                                    style={styles.subInput} 
                                                    value={rule.max.toString()} 
                                                    keyboardType="numeric"
                                                    onChangeText={t => handleGradeChange(idx, 'max', t)}
                                                />
                                                <TouchableOpacity onPress={() => setGradingRules(gradingRules.filter((_, i) => i !== idx))}>
                                                    <Ionicons name="close-circle" size={20} color={theme.danger} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        <TouchableOpacity 
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                                            onPress={() => setGradingRules([...gradingRules, { grade: '', min: 0, max: 0 }])}
                                        >
                                            <Ionicons name="add-circle" size={18} color={theme.primary} />
                                            <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 12 }}>Add Grade Rule</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}

                        {createStep === 3 && (
                            <View>
                                <View style={{ flexDirection: 'row', paddingBottom: 10 }}>
                                    <Text style={[styles.label, { flex: 2 }]}>Subject</Text>
                                    <Text style={[styles.label, { flex: 1, textAlign: 'center' }]}>Max Marks</Text>
                                    <Text style={[styles.label, { flex: 1, textAlign: 'center' }]}>Pass</Text>
                                    <View style={{ width: 30 }} />
                                </View>
                                {subjects.map((sub, idx) => (
                                    <View key={idx} style={[styles.subRow, { marginBottom: 15 }]}>
                                        <View style={{ flex: 2, backgroundColor: isDark ? '#333' : '#f8fafc', borderRadius: 12, paddingHorizontal: 12, height: 45, justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}>
                                            <TextInput 
                                                style={{ color: theme.text, fontWeight: '700', fontSize: 13 }} 
                                                value={sub.name} 
                                                placeholder="Subject"
                                                placeholderTextColor={theme.textLight}
                                                onChangeText={(t) => handleSubjectChange(idx, 'name', t)}
                                            />
                                        </View>
                                        <TextInput 
                                            style={[styles.subInput, { height: 45, flex: 1, borderRadius: 12 }]} 
                                            value={sub.max_theory.toString()} 
                                            keyboardType="numeric"
                                            onChangeText={(t) => handleSubjectChange(idx, 'max_theory', t)}
                                        />
                                        <TextInput 
                                            style={[styles.subInput, { height: 45, flex: 1, borderRadius: 12 }]} 
                                            value={sub.passing_marks.toString()} 
                                            keyboardType="numeric"
                                            onChangeText={(t) => handleSubjectChange(idx, 'passing_marks', t)}
                                        />
                                        <TouchableOpacity 
                                            onPress={() => setSubjects(subjects.filter((_, i) => i !== idx))}
                                            style={{ width: 35, height: 35, borderRadius: 10, backgroundColor: theme.danger + '15', justifyContent: 'center', alignItems: 'center' }}
                                        >
                                            <Ionicons name="trash" size={16} color={theme.danger} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity 
                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 5 }}
                                    onPress={() => setSubjects([...subjects, { name: '', max_theory: 100, max_practical: 0, passing_marks: 33 }])}
                                >
                                    <Ionicons name="add-circle" size={20} color={theme.primary} />
                                    <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 13 }}>Add New Subject</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Sticky-feeling scrollable footer */}
                        <View style={[styles.modalFooter, { borderTopWidth: 0, paddingHorizontal: 0, marginTop: 30 }]}>
                            {createStep > 1 && (
                                <TouchableOpacity style={styles.btnSecondary} onPress={() => setCreateStep(prev => prev - 1)}>
                                    <Text style={[styles.btnText, { color: theme.text }]}>Back</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity 
                                style={styles.btnPrimary} 
                                onPress={() => {
                                    if (createStep < 3) setCreateStep(prev => prev + 1);
                                    else handleCreateSubmit();
                                }}
                                disabled={isCreating}
                            >
                                {isCreating ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>
                                        {createStep === 3 ? 'Finalize Blueprint' : 'Next Step'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </View>
      </Modal>

      {/* FILTER SHEET */}
      <Modal visible={showFilterSheet} transparent animationType="slide" onRequestClose={() => setShowFilterSheet(false)}>
        <TouchableOpacity 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} 
            activeOpacity={1} 
            onPress={() => setShowFilterSheet(false)}
        >
            <TouchableOpacity 
                activeOpacity={1} 
                style={{ 
                    backgroundColor: theme.card, 
                    borderTopLeftRadius: 30, 
                    borderTopRightRadius: 30, 
                    padding: 25, 
                    paddingBottom: insets.bottom + 20,
                    maxHeight: SCREEN_HEIGHT * 0.8
                }}
            >
                <View style={{ width: 40, height: 5, backgroundColor: theme.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text }}>Filter Results</Text>
                    <TouchableOpacity onPress={() => { setFilterTitle('All'); setFilterClass('All'); setFilterSection('All'); }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: theme.danger }}>Reset</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Exam Name Filter */}
                    <Text style={[styles.label, { color: theme.primary, letterSpacing: 1, marginBottom: 12 }]}>EXAM NAME</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 }}>
                        {uniqueExamTitles.map((title) => (
                            <TouchableOpacity
                                key={title}
                                style={[
                                    styles.pickerChip,
                                    filterTitle === title && styles.pickerChipSelected
                                ]}
                                onPress={() => setFilterTitle(title)}
                            >
                                <Text style={[styles.pickerChipText, filterTitle === title && { color: theme.primary }]}>{title}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Class Filter */}
                    <Text style={[styles.label, { color: theme.primary, letterSpacing: 1, marginBottom: 12 }]}>CLASS</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 }}>
                        {uniqueClasses.map((cls) => (
                            <TouchableOpacity
                                key={cls}
                                style={[
                                    styles.pickerChip,
                                    filterClass === cls && styles.pickerChipSelected
                                ]}
                                onPress={() => { setFilterClass(cls); setFilterSection('All'); }}
                            >
                                <Text style={[styles.pickerChipText, filterClass === cls && { color: theme.primary }]}>{cls === 'All' ? 'All Classes' : `Class ${cls}`}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Section Filter */}
                    <Text style={[styles.label, { color: theme.primary, letterSpacing: 1, marginBottom: 12 }]}>SECTION</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 25 }}>
                        {availableSections.map((sec) => (
                            <TouchableOpacity
                                key={sec}
                                style={[
                                    styles.pickerChip,
                                    filterSection === sec && styles.pickerChipSelected
                                ]}
                                onPress={() => setFilterSection(sec)}
                            >
                                <Text style={[styles.pickerChipText, filterSection === sec && { color: theme.primary }]}>{sec === 'All' ? 'All Sections' : `Section ${sec}`}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                <TouchableOpacity 
                    style={[styles.btnPrimary, { marginTop: 20, paddingVertical: 18, borderRadius: 20 }]} 
                    onPress={() => setShowFilterSheet(false)}
                >
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Apply Filters</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
