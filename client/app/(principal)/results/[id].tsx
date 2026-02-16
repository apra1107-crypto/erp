import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert, ScrollView, StatusBar, Platform, Image, KeyboardAvoidingView, SafeAreaView, BackHandler, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

export default function ExamDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { theme, isDark } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  
  // Stats Data
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [sectionSuggestions, setSectionSuggestions] = useState<any[]>([]);
  const [classSuggestions, setClassSuggestions] = useState<any[]>([]);
  const [showSectionList, setShowSectionList] = useState(false);
  const [showClassList, setShowClassList] = useState(false);

  // Edit Marks Modal State
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentMarks, setCurrentMarks] = useState<any[]>([]); 
  const [currentRemark, setCurrentRemark] = useState('');
  const [saving, setSaving] = useState(false);

  // Stats Modal State
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [manualStats, setManualStats] = useState<any>({});
  const [savingStats, setSavingStats] = useState(false);

  useEffect(() => {
    const backAction = () => {
      if (editModalVisible) {
        setEditModalVisible(false);
        return true;
      }
      if (statsModalVisible) {
        setStatsModalVisible(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [editModalVisible, statsModalVisible]);

  useEffect(() => {
    fetchExamData();
  }, [id]);

  const fetchExamData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${API_ENDPOINTS.EXAM}/${id}/grid`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExam(response.data.exam);
      setStudents(response.data.students);
      setFilteredStudents(response.data.students);
      setManualStats(response.data.exam.manual_stats || {});

      if (response.data.exam.class_name) {
        const classResp = await axios.get(`${API_ENDPOINTS.EXAM}/students/search-class?class_name=${response.data.exam.class_name}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setClassStudents(classResp.data);
      }

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load exam data');
    } finally {
      setLoading(false);
    }
  };

  // --- Auto-Complete Logic ---
  const handleSectionTopperSearch = (text: string) => {
    updateStats('section_topper_name', text);
    if (text.trim().length > 0) {
      const matches = students.filter(s => s.student.name.toLowerCase().includes(text.toLowerCase()));
      setSectionSuggestions(matches.slice(0, 10)); 
      setShowSectionList(true);
    } else {
      setShowSectionList(false);
    }
  };

  const selectSectionTopper = (name: string) => {
    updateStats('section_topper_name', name);
    setShowSectionList(false);
  };

  const handleClassTopperSearch = (text: string) => {
    updateStats('class_topper_name', text);
    if (text.trim().length > 0) {
      const matches = classStudents.filter(s => s.name.toLowerCase().includes(text.toLowerCase()));
      setClassSuggestions(matches.slice(0, 10));
      setShowClassList(true);
    } else {
      setShowClassList(false);
    }
  };

  const selectClassTopper = (student: any) => {
    const val = `${student.name} (Sec ${student.section})`;
    updateStats('class_topper_name', val);
    setShowClassList(false);
  };

  const onSectionInputFocus = () => {
    if (manualStats.section_topper_name?.trim().length > 0) {
      setShowSectionList(true);
    }
  };

  const onClassInputFocus = () => {
    if (manualStats.class_topper_name?.trim().length > 0) {
      setShowClassList(true);
    }
  };

  const openEditModal = (studentItem: any) => {
    setSelectedStudent(studentItem);
    
    const subjects = exam.subjects_blueprint || [];
    const existingMarks = studentItem.marks_data || [];
    
    const initializedMarks = subjects.map((sub: any) => {
      const found = existingMarks.find((m: any) => m.subject === sub.name);
      return found ? { ...found } : { subject: sub.name, theory: '', practical: '', grade: '' };
    });

    setCurrentMarks(initializedMarks);
    setCurrentRemark(studentItem.overall_remark || '');
    setEditModalVisible(true);
  };

  const updateMark = (index: number, field: string, value: string) => {
    const updated = [...currentMarks];
    updated[index][field] = value;

    // Auto-calculate Grade when Marks (theory) change
    if (field === 'theory' && exam?.grading_rules) {
      const blueprint = exam.subjects_blueprint.find((s: any) => s.name === updated[index].subject);
      if (blueprint) {
        const max = parseInt(blueprint.max_theory) || 100;
        const obt = parseFloat(value) || 0;
        const percent = (obt / max) * 100;
        
        // Find rule: min <= percent <= max
        const rule = exam.grading_rules.find((r: any) => percent >= r.min && percent <= r.max);
        if (rule) {
          updated[index].grade = rule.grade;
        } else if (percent < 0) {
          updated[index].grade = 'F';
        }
      }
    }

    setCurrentMarks(updated);
  };

  const calculateCurrentTotal = () => {
    return currentMarks.reduce((sum, m) => sum + (parseFloat(m.theory) || 0), 0);
  };

  const saveMarks = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      
      let totalObtained = 0;
      let maxTotal = 0;
      
      currentMarks.forEach((m: any) => {
          const val = parseFloat(m.theory) || 0;
          totalObtained += val;
          const blueprint = exam.subjects_blueprint.find((s: any) => s.name === m.subject);
          if (blueprint) maxTotal += parseInt(blueprint.max_theory) || 0;
      });

      let percentage = maxTotal > 0 ? ((totalObtained / maxTotal) * 100).toFixed(2) : 0;
      
      let grade = 'F';
      if (exam.grading_rules) {
          const p = parseFloat(percentage as string);
          const rule = exam.grading_rules.find((r: any) => p >= r.min && p <= r.max);
          if (rule) grade = rule.grade;
      }

      const calculated_stats = {
          total: totalObtained,
          percentage,
          grade
      };

      await axios.post(`${API_ENDPOINTS.EXAM}/${id}/student/save`, {
        student_id: selectedStudent.student.id,
        marks_data: currentMarks,
        calculated_stats,
        overall_remark: currentRemark
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const updatedStudents = students.map((s: any) => {
        if (s.student.id === selectedStudent.student.id) {
          return { ...s, marks_data: currentMarks, calculated_stats, overall_remark: currentRemark };
        }
        return s;
      });
      
      setStudents(updatedStudents);
      setFilteredStudents(updatedStudents);
      setEditModalVisible(false);

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  const openStatsModal = () => {
    setManualStats(exam.manual_stats || {});
    setStatsModalVisible(true);
  };

  const updateStats = (field: string, value: string) => {
    setManualStats((prev: any) => ({ ...prev, [field]: value }));
  };

  const saveStats = async () => {
    setSavingStats(true);
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(`${API_ENDPOINTS.EXAM}/${id}/stats`, {
        manual_stats: manualStats
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setExam((prev: any) => ({ ...prev, manual_stats: manualStats }));
      Alert.alert('Success', 'Topper details updated');
      setStatsModalVisible(false);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save stats');
    } finally {
      setSavingStats(false);
    }
  };

  const renderStudent = ({ item }: { item: any }) => {
    const total = item.calculated_stats?.total || 0;
    const grade = item.calculated_stats?.grade || '-';
    const isFilled = item.marks_data && item.marks_data.length > 0 && item.marks_data.some((m: any) => m.theory !== '' && m.theory !== null);

    return (
      <TouchableOpacity 
        style={[styles.studentCard, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => openEditModal(item)}
      >
        <View style={styles.row}>
          <View style={styles.avatarContainer}>
            {item.student.profile_image ? (
              <Image source={{ uri: item.student.profile_image }} style={styles.avatar} />
            ) : (
              <View style={[styles.rollBadge, { backgroundColor: theme.primary + '20' }]}>
                <Text style={[styles.rollText, { color: theme.primary }]}>{item.student.roll_no}</Text>
              </View>
            )}
          </View>
          <View style={styles.info}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.name, { color: theme.text }]}>{item.student.name}</Text>
              {isFilled && <Ionicons name="checkmark-circle" size={16} color="#27AE60" />}
            </View>
            <Text style={[styles.subText, { color: theme.textLight }]}>
              Roll: {item.student.roll_no} • Marks: {total} • Grade: {grade}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.previewBtn}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/(principal)/results/preview?examId=${id}&studentId=${item.student.id}`);
            }}
          >
             <Ionicons name="eye-outline" size={22} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      
      <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 5 : 5 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnFree}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>{exam?.name || 'Loading...'}</Text>
          <Text style={[styles.headerSub, { color: theme.textLight }]}>
             {exam ? `Class ${exam.class_name} - ${exam.section}` : ''}
          </Text>
        </View>
        {!!exam?.show_highest_marks && (
          <TouchableOpacity onPress={openStatsModal} style={styles.statsBtn}>
            <Ionicons name="trophy-outline" size={24} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredStudents}
          renderItem={renderStudent}
          keyExtractor={(item) => item.student.id.toString()}
          contentContainerStyle={styles.list}
        />
      )}

      <Modal 
        visible={editModalVisible} 
        animationType="slide" 
        transparent={false}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={[styles.modalHeader, { borderBottomColor: theme.border, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 5 : 5 }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                 {selectedStudent?.student.name}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={{ color: theme.primary, fontSize: 16, fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
               <Text style={[styles.sectionLabel, { color: theme.textLight }]}>SUBJECT MARKS</Text>
               
               {currentMarks.map((mark: any, index: number) => {
                 const blueprint = exam?.subjects_blueprint?.find((s: any) => s.name === mark.subject);
                 const max = blueprint?.max_theory || 100;
                 
                 return (
                   <View key={index} style={[styles.markInputRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                     <View style={styles.markLabelContainer}>
                       <Text style={[styles.subjectName, { color: theme.text }]}>{mark.subject}</Text>
                       <Text style={[styles.maxMarks, { color: theme.textLight }]}>Max: {max}</Text>
                     </View>
                     
                     <View style={styles.inputsContainer}>
                       <View style={styles.inputWrapper}>
                         <Text style={styles.miniLabel}>Marks</Text>
                         <TextInput
                           style={[styles.markInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                           placeholder="0"
                           keyboardType="numeric"
                           placeholderTextColor={theme.textLight}
                           value={mark.theory}
                           onChangeText={(val) => updateMark(index, 'theory', val)}
                           selectTextOnFocus
                         />
                       </View>

                       <View style={styles.inputWrapper}>
                         <Text style={styles.miniLabel}>Grade</Text>
                         <TextInput
                           style={[styles.markInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border, width: 50 }]}
                           placeholder="-"
                           placeholderTextColor={theme.textLight}
                           value={mark.grade}
                           onChangeText={(val) => updateMark(index, 'grade', val)}
                           autoCapitalize="characters"
                         />
                       </View>
                     </View>
                   </View>
                 );
               })}

               <Text style={[styles.sectionLabel, { color: theme.textLight, marginTop: 24 }]}>REMARKS</Text>
               <TextInput
                 style={[styles.remarkInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                 placeholder="Enter overall remark (e.g. Excellent)"
                 placeholderTextColor={theme.textLight}
                 value={currentRemark}
                 onChangeText={setCurrentRemark}
                 multiline
               />

               <View style={{ height: 100 }} />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: theme.textLight }]}>Current Total:</Text>
                <Text style={[styles.totalValue, { color: theme.primary }]}>{calculateCurrentTotal()}</Text>
              </View>
              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={saveMarks}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save All Marks</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal 
        visible={statsModalVisible} 
        animationType="slide" 
        transparent={false}
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={[styles.compactHeader, { borderBottomColor: theme.border, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 5 : 5 }]}>
              <TouchableOpacity onPress={() => setStatsModalVisible(false)} style={styles.headerIconBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.compactHeaderTitle, { color: theme.text }]}>Highest Marks</Text>
              <TouchableOpacity onPress={saveStats} disabled={savingStats} style={[styles.saveHeaderBtn, {backgroundColor: theme.primary}]}>
                {savingStats ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveHeaderText}>Save</Text>}
              </TouchableOpacity>
            </View>

            <Pressable 
              style={{ flex: 1 }} 
              onPress={() => { setShowSectionList(false); setShowClassList(false); }}
            >
              <ScrollView 
                contentContainerStyle={[styles.modalContent, { paddingHorizontal: 12 }]} 
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
              <View style={styles.statsSection}>
                <Text style={[styles.sectionTitleLabel, { color: theme.primary }]}>SECTION TOPPER</Text>
                <View style={[styles.statsInputGroup, { backgroundColor: theme.card, borderColor: theme.border, zIndex: 3000 }]}>
                  <View style={{ position: 'relative', zIndex: 3000 }}>
                    <View style={[styles.inputWithIcon, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Ionicons name="person-outline" size={18} color={theme.textLight} />
                      <TextInput
                        style={[styles.statsInputPlain, { color: theme.text }]}
                        placeholder="Search Section Student"
                        placeholderTextColor={theme.textLight}
                        value={manualStats.section_topper_name}
                        onChangeText={handleSectionTopperSearch}
                        onFocus={onSectionInputFocus}
                      />
                    </View>
                    {showSectionList && (
                      <View style={[styles.dropdownList, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        {sectionSuggestions.map((s, i) => (
                          <TouchableOpacity key={i} style={[styles.dropdownItem, { borderBottomColor: theme.border }]} onPress={() => selectSectionTopper(s.student.name)}>
                            <Text style={{color: theme.text}}>{s.student.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  
                  <View style={[styles.inputWithIcon, { backgroundColor: theme.background, borderColor: theme.border, marginTop: 10 }]}>
                    <Ionicons name="trophy-outline" size={18} color={theme.textLight} />
                    <TextInput
                      style={[styles.statsInputPlain, { color: theme.text }]}
                      placeholder="Total Marks"
                      keyboardType="numeric"
                      placeholderTextColor={theme.textLight}
                      value={manualStats.section_topper_total}
                      onChangeText={(val) => updateStats('section_topper_total', val)}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.statsSection}>
                <Text style={[styles.sectionTitleLabel, { color: theme.primary }]}>CLASS TOPPER</Text>
                <View style={[styles.statsInputGroup, { backgroundColor: theme.card, borderColor: theme.border, zIndex: 2000 }]}>
                  <View style={{ position: 'relative', zIndex: 2000 }}>
                    <View style={[styles.inputWithIcon, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Ionicons name="school-outline" size={18} color={theme.textLight} />
                      <TextInput
                        style={[styles.statsInputPlain, { color: theme.text }]}
                        placeholder="Search Any Student in Class"
                        placeholderTextColor={theme.textLight}
                        value={manualStats.class_topper_name}
                        onChangeText={handleClassTopperSearch}
                        onFocus={onClassInputFocus}
                      />
                    </View>
                    {showClassList && (
                      <View style={[styles.dropdownList, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        {classSuggestions.map((s, i) => (
                          <TouchableOpacity key={i} style={[styles.dropdownItem, { borderBottomColor: theme.border }]} onPress={() => selectClassTopper(s)}>
                            <Text style={{color: theme.text}}>{s.name} (Sec {s.section})</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={[styles.inputWithIcon, { backgroundColor: theme.background, borderColor: theme.border, marginTop: 10 }]}>
                    <Ionicons name="stats-chart-outline" size={18} color={theme.textLight} />
                    <TextInput
                      style={[styles.statsInputPlain, { color: theme.text }]}
                      placeholder="Total Marks"
                      keyboardType="numeric"
                      placeholderTextColor={theme.textLight}
                      value={manualStats.class_topper_total}
                      onChangeText={(val) => updateStats('class_topper_total', val)}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.statsSection}>
                <Text style={[styles.sectionTitleLabel, { color: theme.primary }]}>SUBJECT HIGHEST MARKS</Text>
                <View style={[styles.statsInputGroup, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {exam?.subjects_blueprint?.map((sub: any, index: number) => (
                    <View key={index} style={[styles.compactStatsRow, { borderBottomColor: theme.border, borderBottomWidth: index === (exam.subjects_blueprint.length -1) ? 0 : 1 }]}>
                      <Text style={[styles.compactStatsLabel, { color: theme.text }]}>{sub.name}</Text>
                      <TextInput
                        style={[styles.compactStatsInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                        placeholder="0"
                        keyboardType="numeric"
                        placeholderTextColor={theme.textLight}
                        value={manualStats[`highest_${sub.name}`]}
                        onChangeText={(val) => updateStats(`highest_${sub.name}`, val)}
                      />
                    </View>
                  ))}
                </View>
              </View>
              
              <View style={{ height: 100 }} />
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtnFree: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  statsBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSub: {
    fontSize: 12,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  studentCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  rollBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rollText: {
    fontWeight: 'bold',
  },
  info: {
    flex: 1,
  },
  name: {
    fontWeight: '600',
    fontSize: 16,
  },
  subText: {
    fontSize: 12,
    marginTop: 2,
  },
  previewBtn: {
    padding: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  markInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  markLabelContainer: {
    flex: 1,
  },
  inputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrapper: {
    alignItems: 'center',
  },
  miniLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#999',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
  },
  maxMarks: {
    fontSize: 12,
    marginTop: 2,
  },
  markInput: {
    width: 80,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  remarkInput: {
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  saveBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  compactHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerIconBtn: {
    padding: 6,
  },
  saveHeaderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  saveHeaderText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  statsSection: {
    marginTop: 20,
  },
  sectionTitleLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  statsInputGroup: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  statsInputPlain: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    height: '100%',
  },
  dropdownList: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    borderRadius: 10,
    borderWidth: 1,
    maxHeight: 200,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
  },
  compactStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  compactStatsLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  compactStatsInput: {
    width: 70,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
  },
});
