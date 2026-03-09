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
  Switch, 
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

export default function ResultsDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Creation Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const [gradingRules, setGradingRules] = useState([
    { grade: 'A+', min: 90, max: 100 },
    { grade: 'A', min: 80, max: 89 },
    { grade: 'B', min: 60, max: 79 },
    { grade: 'C', min: 40, max: 59 },
    { grade: 'F', min: 0, max: 39 },
  ]);

  const [subjects, setSubjects] = useState<any[]>([]);

  const uniqueExamTitles = useMemo(() => {
    return ['All', ...new Set(exams.map((e: any) => e.name))];
  }, [exams]);

  const uniqueClasses = useMemo(() => {
    const classes = ['All', ...new Set(exams.map((e: any) => e.class_name.toString()))];
    return classes.sort((a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return a.localeCompare(b, undefined, { numeric: true });
    });
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
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${API_ENDPOINTS.EXAM}/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExams(response.data);
    } catch (error) {
      console.error('Error fetching exams', error);
      Alert.alert('Error', 'Failed to load marksheets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAvailableClasses = async () => {
    try {
        const token = await AsyncStorage.getItem('token');
        const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
            headers: { Authorization: `Bearer ${token}` }
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
        console.error('Error fetching classes:', error);
    }
  };

  useEffect(() => {
    fetchExams();
    fetchAvailableClasses();
  }, []);

  const handleSubjectChange = (index: number, field: string, value: any) => {
    const updated = [...subjects];
    // @ts-ignore
    updated[index][field] = field === 'name' ? value : (parseInt(value) || 0);
    setSubjects(updated);
  };

  const handleGradeChange = (index: number, field: string, value: any) => {
    const updated = [...gradingRules];
    // @ts-ignore
    updated[index][field] = field === 'grade' ? value : (parseInt(value) || 0);
    setGradingRules(updated);
  };

  const handleCreateSubmit = async () => {
    if (!formData.name || !formData.class_name || !formData.section) {
        return Alert.alert('Error', 'Please fill all details');
    }
    try {
        setIsCreating(true);
        const token = await AsyncStorage.getItem('token');
        const payload = {
            ...formData,
            subjects_blueprint: subjects,
            grading_rules: gradingRules,
            manual_stats: { class_topper_name: '', class_topper_marks: '', section_topper_name: '', section_topper_marks: '' }
        };

        await axios.post(`${API_ENDPOINTS.EXAM}/create`, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });

        Toast.show({ type: 'success', text1: 'Marksheet Created!' });
        setShowCreateModal(false);
        setCreateStep(1);
        setFormData({ name: '', class_name: '', section: '', show_highest_marks: false, include_percentage: true, include_grade: true });
        fetchExams();
    } catch (error) {
        Toast.show({ type: 'error', text1: 'Creation Failed' });
    } finally {
        setIsCreating(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchExams();
  };

  const deleteExam = async (id: number) => {
    Alert.alert(
      "Delete Marksheet",
      "Are you sure you want to delete this Marksheet? All data will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              await axios.delete(`${API_ENDPOINTS.EXAM}/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              setExams(prev => prev.filter((e: any) => e.id !== id));
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Failed to delete");
            }
          }
        }
      ]
    );
  };

  const toggleResultStatus = async (id: any, currentStatus: boolean) => {
    try {
        const newStatus = !currentStatus;
        const token = await AsyncStorage.getItem('token');
        
        // Optimistic Update
        setExams(prev => prev.map((exam: any) => 
            exam.id === id ? { ...exam, is_published: newStatus } : exam
        ));

        await axios.patch(`${API_ENDPOINTS.EXAM}/${id}/toggle-publish`, {
            is_published: newStatus
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        Toast.show({ 
            type: 'success', 
            text1: newStatus ? 'Results Published! 📊' : 'Results Hidden',
            text2: newStatus ? 'Students have been notified.' : 'Students can no longer view these results.'
        });
    } catch (error) {
        console.error(error);
        // Revert on error
        setExams(prev => prev.map((exam: any) => 
            exam.id === id ? { ...exam, is_published: currentStatus } : exam
        ));
        Toast.show({ type: 'error', text1: 'Update Failed' });
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: insets.top + 10 },
    backBtnFree: { flexDirection: 'row', alignItems: 'center', padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 16, paddingBottom: 100 },
    card: { borderRadius: 20, marginBottom: 16, borderWidth: 1, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, backgroundColor: theme.card, borderColor: theme.border, minHeight: 120 },
    iconContainer: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    examName: { fontSize: 18, fontWeight: '900', color: theme.text },
    examDate: { fontSize: 12, fontWeight: '700', color: theme.primary },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyText: { fontSize: 18, fontWeight: '800', marginTop: 16, color: theme.textLight },
    emptySubText: { fontSize: 14, marginTop: 8, color: theme.textLight },
    fab: { position: 'absolute', bottom: Math.max(30, insets.bottom + 10), right: 25, width: 65, height: 65, borderRadius: 32.5, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
    
    // Modal Styles
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
    btnText: { fontWeight: '800', fontSize: 14 },
    subRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
    subInput: { flex: 1, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', padding: 8, borderRadius: 8, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 12, textAlign: 'center' },
  }), [insets, theme, isDark, createStep]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/(principal)/results/${item.id}`)}
      activeOpacity={0.9}
    >
      <View style={{ padding: 18, flex: 1 }}>
        {/* Modern Visibility Toggle - Top Right */}
        <View style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, alignItems: 'center' }}>
            <ModernToggle 
                active={item.is_published} 
                onToggle={() => toggleResultStatus(item.id, item.is_published)}
                theme={{ isDark }}
            />
            <Text style={{ fontSize: 8, fontWeight: '900', color: item.is_published ? '#27AE60' : theme.textLight, marginTop: 4 }}>
                {item.is_published ? 'PUBLISHED' : 'DRAFT'}
            </Text>
        </View>

        {/* Top Row: Icon, Class, and Exam Name */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#3E1A23' : '#FCE4EC', width: 48, height: 48, marginRight: 15 }]}>
                <Ionicons name="document-text" size={24} color="#E91E63" />
            </View>
            <View style={{ flex: 1, paddingRight: 45 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Text style={[styles.examName, { marginBottom: 0 }]} numberOfLines={1}>{item.name}</Text>
                    <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '900', color: theme.primary }}>{item.class_name}-{item.section}</Text>
                    </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <Ionicons name="calendar-outline" size={12} color={theme.textLight} />
                    <Text style={[styles.examDate, { color: theme.textLight, fontSize: 11, fontWeight: '600' }]}>
                        {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                </View>
            </View>
        </View>

        {/* Bottom Area: Delete Action Only */}
        <View style={{ position: 'absolute', bottom: 8, right: 8 }}>
            <TouchableOpacity 
                onPress={() => deleteExam(item.id)} 
                style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: 10, 
                    backgroundColor: theme.danger + '10', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: theme.danger + '20'
                }}
            >
                <Ionicons name="trash-outline" size={18} color={theme.danger} />
            </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const isAnyFilterActive = filterTitle !== 'All' || filterClass !== 'All' || filterSection !== 'All';

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnFree}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Results Registry</Text>
        <TouchableOpacity 
            onPress={() => setShowFilterSheet(true)}
            style={{ 
                width: 44, 
                height: 44, 
                borderRadius: 12, 
                backgroundColor: isAnyFilterActive ? theme.primary + '20' : 'transparent',
                justifyContent: 'center', 
                alignItems: 'center' 
            }}
        >
            <Ionicons name="filter" size={24} color={isAnyFilterActive ? theme.primary : theme.text} />
            {isAnyFilterActive && (
                <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary, borderWidth: 1.5, borderColor: theme.card }} />
            )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredExams}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={80} color={theme.border} />
              <Text style={styles.emptyText}>{isAnyFilterActive ? 'No matching marksheets' : 'No Marksheets Created'}</Text>
              <Text style={styles.emptySubText}>{isAnyFilterActive ? 'Try changing your filter criteria' : 'Tap + to create a new blueprint'}</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

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
                                    <View key={idx} style={styles.subRow}>
                                        <TextInput 
                                            style={[styles.subInput, { flex: 2, textAlign: 'left', paddingLeft: 10 }]} 
                                            value={sub.name} 
                                            placeholder="e.g. Maths"
                                            onChangeText={t => handleSubjectChange(idx, 'name', t)}
                                        />
                                        <TextInput 
                                            style={styles.subInput} 
                                            value={sub.max_theory.toString()} 
                                            keyboardType="numeric"
                                            onChangeText={t => handleSubjectChange(idx, 'max_theory', t)}
                                        />
                                        <TextInput 
                                            style={styles.subInput} 
                                            value={sub.passing_marks.toString()} 
                                            keyboardType="numeric"
                                            onChangeText={t => handleSubjectChange(idx, 'passing_marks', t)}
                                        />
                                        <TouchableOpacity onPress={() => setSubjects(subjects.filter((_, i) => i !== idx))}>
                                            <Ionicons name="remove-circle" size={24} color={theme.danger} />
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
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={[styles.btnText, { color: '#fff' }]}>
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

      {/* FILTER BOTTOM SHEET */}
      <Modal 
        visible={showFilterSheet} 
        transparent 
        animationType="slide"
        onRequestClose={() => setShowFilterSheet(false)}
      >
        <TouchableOpacity 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} 
            activeOpacity={1} 
            onPress={() => setShowFilterSheet(false)}
        >
            <View 
                style={{ 
                    backgroundColor: theme.card, 
                    borderTopLeftRadius: 30, 
                    borderTopRightRadius: 30, 
                    paddingBottom: insets.bottom + 20,
                    maxHeight: '80%'
                }}
            >
                <View style={{ width: 40, height: 5, backgroundColor: theme.border, borderRadius: 3, alignSelf: 'center', marginTop: 12 }} />
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: theme.text }}>Filter Results</Text>
                    <TouchableOpacity onPress={() => { setFilterTitle('All'); setFilterClass('All'); setFilterSection('All'); }}>
                        <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 14 }}>Reset All</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={{ paddingHorizontal: 20 }}>
                    {/* Exam Titles */}
                    <Text style={[styles.label, { marginBottom: 12 }]}>By Examination</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25 }}>
                        {uniqueExamTitles.map(t => (
                            <TouchableOpacity 
                                key={t} 
                                onPress={() => setFilterTitle(t)}
                                style={[
                                    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
                                    filterTitle === t && { backgroundColor: theme.primary, borderColor: theme.primary }
                                ]}
                            >
                                <Text style={[{ fontSize: 13, fontWeight: '700', color: theme.textLight }, filterTitle === t && { color: '#fff' }]}>{t}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Classes */}
                    <Text style={[styles.label, { marginBottom: 12 }]}>By Class</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25 }}>
                        {uniqueClasses.map(c => (
                            <TouchableOpacity 
                                key={c} 
                                onPress={() => { setFilterClass(c); setFilterSection('All'); }}
                                style={[
                                    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
                                    filterClass === c && { backgroundColor: theme.secondary, borderColor: theme.secondary }
                                ]}
                            >
                                <Text style={[{ fontSize: 13, fontWeight: '700', color: theme.textLight }, filterClass === c && { color: '#fff' }]}>
                                    {c === 'All' ? 'All Classes' : `Class ${c}`}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Sections (Conditional) */}
                    {filterClass !== 'All' && (
                        <>
                            <Text style={[styles.label, { marginBottom: 12 }]}>By Section</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25 }}>
                                {availableSections.map(s => (
                                    <TouchableOpacity 
                                        key={s} 
                                        onPress={() => setFilterSection(s)}
                                        style={[
                                            { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.border },
                                            filterSection === s && { backgroundColor: '#6366f1', borderColor: '#6366f1' }
                                        ]}
                                    >
                                        <Text style={[{ fontSize: 13, fontWeight: '700', color: theme.textLight }, filterSection === s && { color: '#fff' }]}>
                                            {s === 'All' ? 'All Sections' : `Sec ${s}`}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    )}
                </ScrollView>

                <View style={{ padding: 20 }}>
                    <TouchableOpacity 
                        style={{ backgroundColor: theme.primary, padding: 16, borderRadius: 16, alignItems: 'center' }}
                        onPress={() => setShowFilterSheet(false)}
                    >
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Apply Filters</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}