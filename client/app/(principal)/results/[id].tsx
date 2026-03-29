import * as FileSystem from 'expo-file-system/legacy';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  ActivityIndicator, 
  Alert, 
  ScrollView, 
  StatusBar, 
  Platform, 
  Image, 
  KeyboardAvoidingView, 
  Pressable, 
  Dimensions 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS, BASE_URL } from '../../../constants/Config';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SmartMarkInput = React.memo(({ value, onChange, placeholder, style, keyboardType = 'default', theme, isDark, ...props }: any) => {
    const [isFocused, setIsFocused] = useState(false);
    return (
        <TextInput
            style={[
                {
                    backgroundColor: isDark ? '#1a1a1a' : '#f8fafc',
                    borderWidth: 0,
                    borderRadius: 8,
                    height: '100%',
                    width: '100%',
                    textAlign: 'center',
                    fontSize: 14,
                    fontWeight: '700',
                    color: theme.text,
                },
                isFocused && { backgroundColor: theme.primary + '15' },
                style
            ]}
            value={value?.toString()}
            placeholder={placeholder}
            placeholderTextColor={theme.textLight}
            onChangeText={onChange}
            keyboardType={keyboardType}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            selectTextOnFocus={true}
            {...props}
        />
    );
});

const GradePicker = React.memo(({ value, onSelect, grades, theme, isDark }: any) => {
    const [pickerVisible, setPickerVisible] = useState(false);
    const selectedGradeText = value || 'Select Grade';

    return (
        <View style={{ flex: 1, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity 
                onPress={() => setPickerVisible(true)} 
                style={{ 
                    width: '90%', 
                    height: 38, 
                    borderRadius: 8, 
                    borderWidth: 1, 
                    borderColor: theme.border, 
                    backgroundColor: isDark ? '#1a1a1a' : '#f8fafc',
                    justifyContent: 'center', 
                    alignItems: 'center',
                    flexDirection: 'row',
                    paddingHorizontal: 5
                }}
            >
                <Text style={{ fontSize: 13, fontWeight: '700', color: value ? theme.primary : theme.textLight }}>
                    {selectedGradeText}
                </Text>
                <Ionicons name="chevron-down" size={14} color={theme.textLight} style={{ marginLeft: 5 }} />
            </TouchableOpacity>

            <Modal transparent visible={pickerVisible} animationType="fade" onRequestClose={() => setPickerVisible(false)}>
                <Pressable style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setPickerVisible(false)}>
                    <View style={{ backgroundColor: theme.card, borderRadius: 15, width: '80%', maxHeight: '50%', overflow: 'hidden' }}>
                        <ScrollView>
                            {grades.map((grade: string, index: number) => (
                                <TouchableOpacity 
                                    key={index} 
                                    onPress={() => { onSelect(grade); setPickerVisible(false); }}
                                    style={{ paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: index === grades.length - 1 ? 0 : 1, borderBottomColor: theme.border }}
                                >
                                    <Text style={{ fontSize: 16, color: theme.text, fontWeight: value === grade ? '900' : '500' }}>
                                        {grade}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
});


export default function ExamDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();

    const [loading, setLoading] = useState(true);
    const [exam, setExam] = useState<any>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const isJunior = exam?.evaluation_mode === 'junior';

    // Modal States
    const [fillModalVisible, setFillModalVisible] = useState(false);
    const [statsModalVisible, setStatsModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    // Selection States for Sharing
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectionMap, setSelectionMap] = useState<Record<string, boolean>>({});
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    // Grid States for "Fill Marks"
    const [gridMarks, setGridMarks] = useState<any>({}); 
    const [gridRemarks, setGridRemarks] = useState<any>({}); 
    const [manualStats, setManualStats] = useState<any>({});
    const [classStudents, setClassStudents] = useState<any[]>([]);

    // Suggestion States
    const [sectionSuggestions, setSectionSuggestions] = useState<any[]>([]);
    const [classSuggestions, setClassSuggestions] = useState<any[]>([]);
    const [showSectionList, setShowSectionList] = useState(false);
    const [showClassList, setShowClassList] = useState(false);

    useEffect(() => {
        fetchExamData();
    }, [id]);

    const fetchExamData = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.EXAM}/${id}/grid`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setExam(response.data.exam);
            
            const sortedStudents = response.data.students.sort((a: any, b: any) => {
                const rollA = parseInt(a.student.roll_no) || 0;
                const rollB = parseInt(b.student.roll_no) || 0;
                return rollA - rollB;
            });

            setStudents(sortedStudents);
            setFilteredStudents(sortedStudents);
            setManualStats(response.data.exam.manual_stats || {});

            if (response.data.exam.class_name) {
                const classResp = await axios.get(`${API_ENDPOINTS.EXAM}/students/search-class?class_name=${response.data.exam.class_name}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setClassStudents(classResp.data);
            }
        } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Failed to load data' });
        } finally {
            setLoading(false);
        }
    };

    const handleSectionTopperSearch = (text: string) => {
        setManualStats({ ...manualStats, section_topper_name: text });
        if (text.trim().length > 0) {
            const matches = students.filter(s => s.student.name.toLowerCase().includes(text.toLowerCase()));
            setSectionSuggestions(matches.slice(0, 5));
            setShowSectionList(true);
        } else {
            setShowSectionList(false);
        }
    };

    const handleClassTopperSearch = (text: string) => {
        setManualStats({ ...manualStats, class_topper_name: text });
        if (text.trim().length > 0) {
            const matches = classStudents.filter(s => s.name.toLowerCase().includes(text.toLowerCase()));
            setClassSuggestions(matches.slice(0, 5));
            setShowClassList(true);
        } else {
            setShowClassList(false);
        }
    };

    const selectSectionTopper = (name: string) => {
        setManualStats({ ...manualStats, section_topper_name: name });
        setShowSectionList(false);
    };

    const selectClassTopper = (student: any) => {
        setManualStats({ ...manualStats, class_topper_name: `${student.name} (Sec ${student.section})` });
        setShowClassList(false);
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

    const generatePDF = async () => {
        const selectedIds = Object.keys(selectionMap).filter(id => selectionMap[id]);
        if (selectedIds.length === 0) return Alert.alert('Warning', 'Select students first');

        try {
            setIsGeneratingPDF(true);
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            
            // 1. Call the new Backend API with arraybuffer and long timeout
            const response = await axios.post(
                `${API_ENDPOINTS.EXAM}/${id}/generate-bulk-pdf`,
                { studentIds: selectedIds },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'arraybuffer', // More stable than 'blob' in RN
                    timeout: 60000 // 60 seconds for bulk generation
                }
            );

            // 2. Convert ArrayBuffer to Base64
            // @ts-ignore
            const base64data = btoa(
                new Uint8Array(response.data)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            const fileName = `marksheet_${id}_${Date.now()}.pdf`;
            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

            // 3. Write to local storage
            await FileSystem.writeAsStringAsync(fileUri, base64data, {
                encoding: 'base64',
            });

            // 4. Trigger Native Sharing
            await Sharing.shareAsync(fileUri, {
                UTI: '.pdf',
                mimeType: 'application/pdf',
                dialogTitle: 'Exam Results'
            });

            setIsSelectionMode(false);
            setSelectionMap({});

        } catch (error: any) {
            console.error('PDF Generation Error:', error.message);
            if (error.code === 'ECONNABORTED') {
                Alert.alert('Timeout', 'The server took too long to generate the PDF. Try selecting fewer students.');
            } else {
                Alert.alert('Error', 'Failed to connect to server for PDF generation');
            }
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (!text.trim()) {
            setFilteredStudents(students);
            return;
        }
        const filtered = students.filter(s => 
            s.student.name.toLowerCase().includes(text.toLowerCase()) || 
            s.student.roll_no.toString().includes(text)
        );
        setFilteredStudents(filtered);
    };

    const openFillModal = () => {
        const initialMarks: any = {};
        const initialRemarks: any = {};
        students.forEach(s => {
            const subjects_blueprint = exam.subjects_blueprint || [];
            const existingMarks = s.marks_data || [];
            initialMarks[s.student.id] = subjects_blueprint.map((sub: any) => {
                const found = existingMarks.find((m: any) => m.subject === sub.name);
                return found ? { ...found } : { subject: sub.name, theory: '', practical: '', grade: '' };
            });
            initialRemarks[s.student.id] = s.overall_remark || '';
        });
        setGridMarks(initialMarks);
        setGridRemarks(initialRemarks);
        setFillModalVisible(true);
    };

    const evaluateMark = (val: string | number) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'string' && val.includes('+')) {
            return val.split('+').reduce((sum, p) => sum + (parseFloat(p.trim()) || 0), 0);
        }
        return parseFloat(val as string) || 0;
    };

    const updateGridMark = (studentId: any, subIdx: number, field: string, value: string) => {
        const studentMarks = [...gridMarks[studentId]];
        studentMarks[subIdx] = { ...studentMarks[subIdx], [field]: value };

        const evaluateVal = (val: string) => {
            if (!val) return 0;
            if (val.includes('+')) {
                return val.split('+').reduce((sum, p) => sum + (parseFloat(p.trim()) || 0), 0);
            }
            return parseFloat(val) || 0;
        };

        if (field === 'theory' && exam?.grading_rules) {
            const blueprint = exam.subjects_blueprint.find((s: any) => s.name === studentMarks[subIdx].subject);
            if (blueprint) {
                const max = evaluateVal(blueprint.max_theory?.toString()) || 100;
                const obt = evaluateVal(value);
                const percent = (obt / max) * 100;
                const rule = exam.grading_rules.find((r: any) => percent >= r.min && percent <= r.max);
                if (rule) {
                    studentMarks[subIdx].grade = rule.grade;
                } else if (percent < 0) {
                    studentMarks[subIdx].grade = 'F';
                }
            }
        }

        setGridMarks({ ...gridMarks, [studentId]: studentMarks });
    };

    const handleSaveAllMarks = async () => {
        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const promises = students.map(async (s) => {
                const marks = gridMarks[s.student.id];
                const remark = gridRemarks[s.student.id];

                let totalObtained = 0;
                let maxTotal = 0;

                marks.forEach((m: any) => {
                    totalObtained += evaluateMark(m.theory) + evaluateMark(m.practical);
                    const blueprint = exam.subjects_blueprint.find((sub: any) => sub.name === m.subject);
                    if (blueprint) {
                        maxTotal += (parseInt(blueprint.max_theory) || 0) + (parseInt(blueprint.max_practical) || 0);
                    }
                });

                let percentage: any = maxTotal > 0 ? ((totalObtained / maxTotal) * 100).toFixed(2) : 0;
                let grade = '-';

                if (exam.evaluation_mode === 'junior') {
                    grade = '-';
                    percentage = '0';
                } else if (exam.grading_rules) {
                    const p = parseFloat(percentage as string);
                    const rule = exam.grading_rules.find((r: any) => p >= r.min && p <= r.max);
                    if (rule) grade = rule.grade;
                    else if (p < 0) grade = 'F';
                }

                return axios.post(`${API_ENDPOINTS.EXAM}/${id}/student/save`, {
                    student_id: s.student.id,
                    marks_data: marks,
                    calculated_stats: { total: totalObtained, percentage, grade },
                    overall_remark: remark
                }, { headers: { Authorization: `Bearer ${token}` } });
            });

            await Promise.all(promises);
            Toast.show({ type: 'success', text1: 'All marks saved!' });
            setFillModalVisible(false);
            fetchExamData();
        } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Failed to save some marks' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveStats = async () => {
        try {
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            await axios.put(`${API_ENDPOINTS.EXAM}/${id}/stats`, {
                manual_stats: manualStats
            }, { headers: { Authorization: `Bearer ${token}` } });
            Toast.show({ type: 'success', text1: 'Stats updated!' });
            setStatsModalVisible(false);
            fetchExamData();
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Failed to save stats' });
        }
    };

    const renderStudentItem = ({ item }: { item: any }) => {
        const isFilled = item.marks_data && 
                         item.marks_data.length > 0 && 
                         item.marks_data.some((m: any) => m.theory !== '' && m.theory !== null && m.theory !== undefined);
        
        const total = item.calculated_stats?.total || 0;
        const grade = item.calculated_stats?.grade || '-';

        return (
            <TouchableOpacity 
                style={[
                    styles.studentCard, 
                    { backgroundColor: theme.card, borderColor: isSelectionMode && selectionMap[item.student.id] ? theme.primary : theme.border }
                ]}
                onPress={() => {
                    if (isSelectionMode) {
                        toggleStudentSelection(item.student.id);
                    } else {
                        router.push(`/(principal)/results/preview?examId=${id}&studentId=${item.student.id}`);
                    }
                }}
            >
                <View style={styles.studentRow}>
                    <View style={styles.avatar}>
                        {item.student.profile_image ? (
                            <Image source={{ uri: item.student.profile_image }} style={styles.avatarImg} />
                        ) : (
                            <Text style={[styles.avatarText, { color: theme.primary }]}>{item.student.name[0]}</Text>
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.studentName, { color: theme.text }]}>{item.student.name}</Text>
                            {isFilled && <Ionicons name="checkmark-circle" size={16} color="#27AE60" />}
                        </View>
                        <Text style={[styles.studentInfo, { color: theme.textLight }]}>
                            Roll: {item.student.roll_no} • Total: {total} • Grade: {grade}
                        </Text>
                    </View>
                    
                    {isSelectionMode ? (
                        <View style={[
                            { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
                            selectionMap[item.student.id] && { backgroundColor: theme.primary }
                        ]}>
                            {selectionMap[item.student.id] && <Ionicons name="checkmark" size={16} color="#fff" />}
                        </View>
                    ) : (
                        <Ionicons name="chevron-forward" size={20} color={theme.border} />
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            backgroundColor: theme.card,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
        headerTitle: { fontSize: 18, fontWeight: '900', color: theme.text },
        searchBar: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? '#1a1a1a' : '#f1f5f9',
            borderRadius: 12,
            paddingHorizontal: 12,
            height: 44,
        },
        searchInput: { flex: 1, marginLeft: 10, color: theme.text, fontSize: 14 },
        toolbar: {
            flexDirection: 'row',
            gap: 10,
            padding: 15,
            backgroundColor: theme.card,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        toolBtn: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: theme.primary + '10',
            borderWidth: 1,
            borderColor: theme.primary + '30',
        },
        toolText: { marginLeft: 6, fontSize: 13, fontWeight: '800', color: theme.primary },
        list: { padding: 15, paddingBottom: 100 },
        studentCard: {
            padding: 15,
            borderRadius: 16,
            marginBottom: 12,
            borderWidth: 1,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 5,
        },
        studentRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
        avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
        avatarImg: { width: '100%', height: '100%' },
        avatarText: { fontSize: 18, fontWeight: '900' },
        studentName: { fontSize: 16, fontWeight: '800' },
        studentInfo: { fontSize: 12, marginTop: 2 },
        floatingHeaderBtn: {
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
        },
        actionChip: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
            backgroundColor: theme.card,
            borderWidth: 1.5,
            gap: 8,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
        },
        actionChipText: {
            fontSize: 13,
            fontWeight: '800',
        },
        // Modal Styles
        modalContainer: { flex: 1, backgroundColor: theme.background },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 20,
            paddingTop: Platform.OS === 'ios' ? 50 : 20,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            backgroundColor: theme.card,
        },
        modalTitle: { fontSize: 18, fontWeight: '900', color: theme.text },
        modalFooter: {
            padding: 20,
            paddingBottom: insets.bottom + 10,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.card,
        },
        saveBtn: { backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
        saveText: { color: '#fff', fontSize: 16, fontWeight: '900' },
        
        // Excel Grid Styles
        gridScroll: { flex: 1 },
        gridRow: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border, alignItems: 'center' },
        gridStudentInfo: { width: 120 },
        gridStudentName: { fontSize: 13, fontWeight: '800', color: theme.text },
        gridRoll: { fontSize: 10, color: theme.textLight },
        subjectInputBox: { width: 80, marginLeft: 10 },
        gridInput: {
            backgroundColor: isDark ? '#1a1a1a' : '#f8fafc',
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            height: 38,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: '700',
            color: theme.text,
        },
        subHeaderLabel: { fontSize: 10, fontWeight: '800', color: theme.textLight, textAlign: 'center', marginBottom: 4 },
        dropdownList: {
            position: 'absolute',
            top: 75,
            left: 0,
            right: 0,
            backgroundColor: theme.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.2,
            shadowRadius: 10,
            zIndex: 5000,
            overflow: 'hidden'
        },
        dropdownItem: {
            padding: 15,
            borderBottomWidth: 1,
            borderBottomColor: theme.border
        }
    }), [theme, insets, isDark]);

    if (loading) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            
            {/* Free Flow Header */}
            <View style={{ position: 'absolute', top: insets.top + 10, left: 0, right: 0, zIndex: 100 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 }}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.floatingHeaderBtn}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 15 }}>
                        <Text style={[styles.headerTitle, { color: theme.text, fontSize: 18, fontWeight: '900' }]} numberOfLines={1}>{exam?.name || 'Loading...'}</Text>
                        <Text style={{ fontSize: 11, color: theme.textLight, fontWeight: '700' }}>
                            {exam ? `Class ${exam.class_name}-${exam.section}` : ''}
                        </Text>
                    </View>
                </View>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 15 }}>
                  <TouchableOpacity onPress={openFillModal} style={[styles.actionChip, { borderColor: theme.primary + '40', backgroundColor: theme.card }]}>
                      <Ionicons name="grid" size={16} color={theme.primary} />
                      <Text style={[styles.actionChipText, { color: theme.primary }]}>{isJunior ? 'Fill Grades' : 'Fill Marks'}</Text>
                  </TouchableOpacity>
                  {!!exam?.show_highest_marks && exam?.evaluation_mode !== 'junior' && (
                      <TouchableOpacity onPress={() => setStatsModalVisible(true)} style={[styles.actionChip, { borderColor: '#FFD70080', backgroundColor: theme.card }]}>
                          <Ionicons name="trophy" size={16} color="#FFD700" />
                          <Text style={[styles.actionChipText, { color: isDark ? '#FFD700' : '#B8860B' }]}>Toppers</Text>
                      </TouchableOpacity>
                  )}
                  {/* Share Results Toggle */}
                  <TouchableOpacity 
                    onPress={() => {
                        setIsSelectionMode(!isSelectionMode);
                        if (isSelectionMode) setSelectionMap({});
                    }} 
                    style={[
                        styles.actionChip, 
                        { 
                            borderColor: isSelectionMode ? theme.danger : '#6366f1', 
                            backgroundColor: isSelectionMode ? theme.danger + '10' : '#6366f110',
                            width: 45,
                            justifyContent: 'center',
                            paddingHorizontal: 0
                        }
                    ]}
                  >
                      <Ionicons 
                        name={isSelectionMode ? "close" : "share-social"} 
                        size={20} 
                        color={isSelectionMode ? theme.danger : "#6366f1"} 
                      />
                  </TouchableOpacity>

                  {isSelectionMode && (
                      <TouchableOpacity 
                        onPress={() => {
                            const allSelected = filteredStudents.every(s => selectionMap[s.student.id]);
                            const newMap = { ...selectionMap };
                            filteredStudents.forEach(s => newMap[s.student.id] = !allSelected);
                            setSelectionMap(newMap);
                        }} 
                        style={[
                            styles.actionChip, 
                            { 
                                borderColor: theme.primary, 
                                backgroundColor: theme.primary + '10',
                                borderStyle: 'dashed',
                                width: 45,
                                justifyContent: 'center',
                                paddingHorizontal: 0
                            }
                        ]}
                      >
                          <Ionicons 
                            name={filteredStudents.length > 0 && filteredStudents.every(s => selectionMap[s.student.id]) ? "remove-circle" : "checkmark-done"} 
                            size={20} 
                            color={theme.primary} 
                          />
                      </TouchableOpacity>
                  )}
                </ScrollView>
            </View>

            {isSelectionMode && (
                <View style={{ position: 'absolute', top: insets.top + 130, left: 0, right: 0, alignItems: 'center', zIndex: 50 }}>
                    <View style={{ backgroundColor: theme.primary, paddingVertical: 6, paddingHorizontal: 15, borderRadius: 20, elevation: 4 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{getSelectedCount()} SELECTED</Text>
                    </View>
                </View>
            )}

            <FlatList
                data={filteredStudents}
                renderItem={({ item }) => {
                    const isFilled = item.marks_data && 
                                     item.marks_data.length > 0 && 
                                     item.marks_data.some((m: any) => 
                                        (m.theory !== '' && m.theory !== null && m.theory !== undefined) ||
                                        (m.grade !== '' && m.grade !== null && m.grade !== undefined)
                                     );
                    
                    return (
                        <TouchableOpacity 
                            style={[
                                styles.studentCard, 
                                { backgroundColor: theme.card, borderColor: isSelectionMode && selectionMap[item.student.id] ? theme.primary : theme.border }
                            ]}
                            onPress={() => {
                                if (isSelectionMode) {
                                    toggleStudentSelection(item.student.id);
                                } else {
                                    router.push(`/(principal)/results/preview?examId=${id}&studentId=${item.student.id}`);
                                }
                            }}
                        >
                            <View style={styles.studentRow}>
                                <View style={styles.avatar}>
                                    {item.student.profile_image ? (
                                        <Image source={{ uri: item.student.profile_image }} style={styles.avatarImg} />
                                    ) : (
                                        <Text style={[styles.avatarText, { color: theme.primary }]}>{item.student.name[0]}</Text>
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={[styles.studentName, { color: theme.text }]}>{item.student.name}</Text>
                                        {isFilled && <Ionicons name="checkmark-circle" size={16} color="#27AE60" />}
                                    </View>
                                    <Text style={[styles.studentInfo, { color: theme.textLight }]}>
                                        Roll: {item.student.roll_no} • Total: {item.calculated_stats?.total || 0} • Grade: {item.calculated_stats?.grade || '-'}
                                    </Text>
                                </View>
                                
                                {isSelectionMode ? (
                                    <View style={[
                                        { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
                                        selectionMap[item.student.id] && { backgroundColor: theme.primary }
                                    ]}>
                                        {selectionMap[item.student.id] && <Ionicons name="checkmark" size={16} color="#fff" />}
                                    </View>
                                ) : (
                                    <Ionicons name="chevron-forward" size={20} color={theme.border} />
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                }}
                keyExtractor={(item) => item.student.id.toString()}
                contentContainerStyle={[styles.list, { paddingTop: insets.top + (isSelectionMode ? 170 : 120) }]}
            />

            {/* Bulk Export Floating Button */}
            {isSelectionMode && getSelectedCount() > 0 && (
                <View style={{ position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 1000 }}>
                    <TouchableOpacity 
                        activeOpacity={0.9}
                        onPress={generatePDF}
                        disabled={isGeneratingPDF}
                    >
                        <LinearGradient
                            colors={['#4f46e5', '#7c3aed']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ 
                                padding: 18, 
                                borderRadius: 20, 
                                flexDirection: 'row', 
                                justifyContent: 'center', 
                                alignItems: 'center',
                                elevation: 12,
                                shadowColor: '#4f46e5',
                                shadowOffset: { width: 0, height: 8 },
                                shadowOpacity: 0.4,
                                shadowRadius: 12,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.2)'
                            }}
                        >
                            {isGeneratingPDF ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="share-social" size={24} color="#fff" style={{ marginRight: 12 }} />
                                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1 }}>
                                        SHARE {getSelectedCount()} RESULTS
                                    </Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            {/* Processing state is now handled by the button spinner */}

            {/* Fill Marks Modal */}
            <Modal visible={fillModalVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    {/* Free Flow Header for Modal */}
                    <View style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        zIndex: 100, 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        paddingHorizontal: 20, 
                        paddingTop: insets.top + 10,
                        paddingBottom: 15,
                        justifyContent: 'space-between',
                        backgroundColor: theme.card,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.border
                    }}>
                        <TouchableOpacity 
                            onPress={() => setFillModalVisible(false)} 
                            style={styles.floatingHeaderBtn}
                        >
                            <Ionicons name="close" size={28} color={theme.text} />
                        </TouchableOpacity>

                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={[styles.modalTitle, { fontSize: 18, fontWeight: '900', color: theme.text }]}>Bulk Marks Entry</Text>
                        </View>

                        <TouchableOpacity 
                            onPress={handleSaveAllMarks} 
                            disabled={saving}
                            style={[styles.floatingHeaderBtn, { backgroundColor: theme.primary }]}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="checkmark" size={28} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={true}
                        style={{ marginTop: insets.top + 80, flex: 1 }}
                        directionalLockEnabled={false}
                        nestedScrollEnabled={true}
                        keyboardShouldPersistTaps="always"
                    >
                        <View>
                            {/* Column Headers */}
                            <View style={[styles.gridRow, { backgroundColor: isDark ? '#111' : '#f1f5f9', borderBottomWidth: 2, borderBottomColor: theme.border, padding: 0 }]}>
                                <View style={{ width: 150, padding: 15, borderRightWidth: 1, borderRightColor: theme.border, justifyContent: 'center' }}>
                                    <Text style={[styles.subHeaderLabel, { textAlign: 'left', color: theme.text, fontSize: 11 }]}>STUDENT</Text>
                                </View>
                                {exam?.subjects_blueprint?.map((sub: any, i: number) => (
                                    <View key={i} style={{ flexDirection: 'row', borderRightWidth: 1, borderRightColor: theme.border }}>
                                        <View style={{ width: exam?.evaluation_mode === 'junior' ? 140 : 80, padding: 10, justifyContent: 'center', alignItems: 'center' }}>
                                            <Text style={[styles.subHeaderLabel, { color: theme.text, fontSize: 11 }]} numberOfLines={1}>{sub.name.toUpperCase()}</Text>
                                            <Text style={[styles.subHeaderLabel, { fontSize: 8, color: theme.primary, fontWeight: '900' }]}>
                                                {exam?.evaluation_mode === 'junior' ? 'GRADE' : 'MARKS'}
                                            </Text>
                                        </View>
                                        {exam?.evaluation_mode !== 'junior' && !!exam.include_grade && (
                                            <View style={{ width: 60, padding: 10, justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: theme.border + '20' }}>
                                                <Text style={styles.subHeaderLabel} numberOfLines={1}> </Text>
                                                <Text style={[styles.subHeaderLabel, { fontSize: 9, color: theme.primary, fontWeight: '900' }]}>GRADE</Text>
                                            </View>
                                        )}
                                    </View>
                                ))}
                                <View style={{ width: 200, padding: 15, justifyContent: 'center' }}>
                                    <Text style={[styles.subHeaderLabel, { color: theme.text, fontSize: 11 }]}>REMARK</Text>
                                </View>
                            </View>

                            <ScrollView 
                                style={styles.gridScroll} 
                                showsVerticalScrollIndicator={true}
                                nestedScrollEnabled={true}
                                directionalLockEnabled={false}
                                keyboardShouldPersistTaps="always"
                            >
                                {students.map((s, sIdx) => (
                                    <View key={s.student.id} style={[styles.gridRow, { borderBottomWidth: 1, borderBottomColor: theme.border, padding: 0 }]}>
                                        <View style={{ width: 150, padding: 12, borderRightWidth: 1, borderRightColor: theme.border, justifyContent: 'center' }}>
                                            <Text style={[styles.gridStudentName, { fontSize: 12 }]} numberOfLines={1}>{s.student.name}</Text>
                                            <Text style={styles.gridRoll}>Roll: {s.student.roll_no}</Text>
                                        </View>
                                        {gridMarks[s.student.id]?.map((mark: any, idx: number) => (
                                            <View key={idx} style={{ flexDirection: 'row', borderRightWidth: 1, borderRightColor: theme.border }}>
                                                {exam?.evaluation_mode === 'junior' ? (
                                                    <View style={{ width: 140, height: 50 }}>
                                                        <SmartMarkInput
                                                            value={mark.grade}
                                                            placeholder="Enter Grade..."
                                                            onChange={(v: string) => updateGridMark(s.student.id, idx, 'grade', v.toUpperCase())}
                                                            autoCapitalize="characters"
                                                            theme={theme}
                                                            isDark={isDark}
                                                        />
                                                    </View>
                                                ) : (
                                                    <>
                                                        <View style={{ width: 80, height: 50 }}>
                                                            <SmartMarkInput
                                                                value={mark.theory}
                                                                placeholder="0"
                                                                onChange={(v: string) => updateGridMark(s.student.id, idx, 'theory', v)}
                                                                theme={theme}
                                                                isDark={isDark}
                                                            />
                                                        </View>
                                                        {!!exam.include_grade && (
                                                            <View style={{ width: 60, height: 50, borderLeftWidth: 1, borderLeftColor: theme.border + '20' }}>
                                                                <SmartMarkInput
                                                                    style={{ color: theme.primary }}
                                                                    value={mark.grade}
                                                                    placeholder="-"
                                                                    onChange={(v: string) => updateGridMark(s.student.id, idx, 'grade', v.toUpperCase())}
                                                                    autoCapitalize="characters"
                                                                    theme={theme}
                                                                    isDark={isDark}
                                                                />
                                                            </View>
                                                        )}
                                                    </>
                                                )}
                                            </View>
                                        ))}
                                        <View style={{ width: 200, height: 50 }}>
                                            <SmartMarkInput
                                                style={{ textAlign: 'left', paddingHorizontal: 12 }}
                                                value={gridRemarks[s.student.id]}
                                                placeholder="Enter remark..."
                                                onChange={(v: string) => setGridRemarks({ ...gridRemarks, [s.student.id]: v })}
                                                theme={theme}
                                                isDark={isDark}
                                            />
                                        </View>
                                    </View>
                                ))}
                                <View style={{ height: 100 }} />
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* Toppers Modal */}
            <Modal visible={statsModalVisible} animationType="slide" transparent={false} onRequestClose={() => setStatsModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1 }}
                    >
                        {/* Free Flow Header for Toppers */}
                        <View style={{ position: 'absolute', top: insets.top + 10, left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, justifyContent: 'space-between' }}>
                            <TouchableOpacity onPress={() => setStatsModalVisible(false)} style={styles.floatingHeaderBtn}>
                                <Ionicons name="close" size={28} color={theme.text} />
                            </TouchableOpacity>
                            <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text }}>Toppers</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={handleSaveStats} 
                                style={[styles.floatingHeaderBtn, { backgroundColor: theme.primary }]}
                            >
                                <Ionicons name="checkmark" size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView 
                            style={{ flex: 1 }}
                            contentContainerStyle={{ padding: 20, paddingTop: insets.top + 80, paddingBottom: 40 }}
                            showsVerticalScrollIndicator={true}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={{ backgroundColor: theme.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.border, elevation: 2 }}>
                                <Text style={[styles.subHeaderLabel, { textAlign: 'left', color: theme.primary, marginBottom: 15, fontSize: 11 }]}>SECTION TOPPER</Text>
                                <View style={{ gap: 15, marginBottom: 30 }}>
                                    <View style={{ position: 'relative', zIndex: 3000 }}>
                                        <Text style={[styles.label, { color: theme.textLight }]}>STUDENT NAME</Text>
                                        <TextInput
                                            style={[styles.gridInput, { width: '100%', textAlign: 'left', paddingHorizontal: 15, height: 50, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                                            placeholder="Search student..."
                                            placeholderTextColor={theme.textLight}
                                            value={manualStats.section_topper_name}
                                            onChangeText={handleSectionTopperSearch}
                                        />
                                        {showSectionList && (
                                            <View style={[styles.dropdownList, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                                {sectionSuggestions.map((s, i) => (
                                                    <TouchableOpacity key={i} style={[styles.dropdownItem, { borderBottomColor: theme.border }]} onPress={() => selectSectionTopper(s.student.name)}>
                                                        <Text style={{color: theme.text, fontWeight: '700'}}>{s.student.name}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                    <View>
                                        <Text style={[styles.label, { color: theme.textLight }]}>TOTAL MARKS</Text>
                                        <TextInput
                                            style={[styles.gridInput, { width: '100%', textAlign: 'left', paddingHorizontal: 15, height: 50, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                                            placeholder="e.g. 580"
                                            placeholderTextColor={theme.textLight}
                                            keyboardType="numeric"
                                            value={manualStats.section_topper_total?.toString()}
                                            onChangeText={(v) => setManualStats({ ...manualStats, section_topper_total: v })}
                                        />
                                    </View>
                                </View>

                                <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 30, marginHorizontal: -20 }} />

                                <Text style={[styles.subHeaderLabel, { textAlign: 'left', color: theme.primary, marginBottom: 15, fontSize: 11 }]}>CLASS TOPPER</Text>
                                <View style={{ gap: 15, marginBottom: 30 }}>
                                    <View style={{ position: 'relative', zIndex: 2000 }}>
                                        <Text style={[styles.label, { color: theme.textLight }]}>STUDENT NAME (ALL SECTIONS)</Text>
                                        <TextInput
                                            style={[styles.gridInput, { width: '100%', textAlign: 'left', paddingHorizontal: 15, height: 50, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                                            placeholder="Search across sections..."
                                            placeholderTextColor={theme.textLight}
                                            value={manualStats.class_topper_name}
                                            onChangeText={handleClassTopperSearch}
                                        />
                                        {showClassList && (
                                            <View style={[styles.dropdownList, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                                {classSuggestions.map((s, i) => (
                                                    <TouchableOpacity key={i} style={[styles.dropdownItem, { borderBottomColor: theme.border }]} onPress={() => selectClassTopper(s)}>
                                                        <Text style={{color: theme.text, fontWeight: '700'}}>{s.name} <Text style={{fontSize: 10, fontWeight: '400', color: theme.textLight}}>(Sec {s.section})</Text></Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                    <View>
                                        <Text style={[styles.label, { color: theme.textLight }]}>GRAND TOTAL</Text>
                                        <TextInput
                                            style={[styles.gridInput, { width: '100%', textAlign: 'left', paddingHorizontal: 15, height: 50, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                                            placeholder="e.g. 595"
                                            placeholderTextColor={theme.textLight}
                                            keyboardType="numeric"
                                            value={manualStats.class_topper_total?.toString()}
                                            onChangeText={(v) => setManualStats({ ...manualStats, class_topper_total: v })}
                                        />
                                    </View>
                                </View>

                                <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 30, marginHorizontal: -20 }} />

                                <Text style={[styles.subHeaderLabel, { textAlign: 'left', color: theme.primary, marginBottom: 15, fontSize: 11 }]}>SUBJECT WISE HIGHEST</Text>
                                {exam.subjects_blueprint.map((sub: any, i: number) => (
                                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                                        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>{sub.name}</Text>
                                        <TextInput
                                            style={[styles.gridInput, { width: 90, height: 44, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                                            placeholder="0"
                                            placeholderTextColor={theme.textLight}
                                            keyboardType="numeric"
                                            value={manualStats[`highest_${sub.name}`]?.toString()}
                                            onChangeText={(v) => setManualStats({ ...manualStats, [`highest_${sub.name}`]: v })}
                                        />
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}
