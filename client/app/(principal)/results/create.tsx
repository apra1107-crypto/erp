import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, StatusBar, Platform, KeyboardAvoidingView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

export default function CreateExam() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Step 1: Details
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('');
  
  // Step 2: Config & Subjects
  const [showHighest, setShowHighest] = useState(false);
  const [includeGrade, setIncludeGrade] = useState(true);
  const [includePercentage, setIncludePercentage] = useState(true);
  
  const [subjects, setSubjects] = useState([
    { name: 'English', max_theory: '100', passing_marks: '33' },
    { name: 'Mathematics', max_theory: '100', passing_marks: '33' },
  ]);

  const [gradingRules, setGradingRules] = useState([
    { grade: 'A+', min: '90', max: '100' },
    { grade: 'A', min: '80', max: '90' },
    { grade: 'B', min: '70', max: '80' },
    { grade: 'C', min: '60', max: '70' },
    { grade: 'D', min: '40', max: '60' },
    { grade: 'F', min: '0', max: '40' }
  ]);

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState({});

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      // Using existing endpoint to get student list and extract classes
      const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const students = response.data.students || [];
      const classSet = new Set();
      const sectionMap = {};

      students.forEach((s: any) => {
        const cls = String(s.class || '').trim();
        const sec = String(s.section || '').trim();
        if (cls && sec) {
            classSet.add(cls);
            if (!sectionMap[cls]) sectionMap[cls] = new Set();
            sectionMap[cls].add(sec);
        }
      });

      const sortedClasses = Array.from(classSet).sort((a: any, b: any) => a.localeCompare(b, undefined, { numeric: true }));
      const finalSections = {};
      sortedClasses.forEach((c: any) => {
          finalSections[c] = Array.from(sectionMap[c]).sort();
      });

      setClasses(sortedClasses);
      setSections(finalSections);

    } catch (error) {
      console.error('Error fetching classes', error);
    }
  };

  const handleAddSubject = () => {
    setSubjects([...subjects, { name: '', max_theory: '100', passing_marks: '33' }]);
  };

  const handleRemoveSubject = (index: number) => {
    const newSubjects = subjects.filter((_, i) => i !== index);
    setSubjects(newSubjects);
  };

  const updateSubject = (index: number, field: string, value: string) => {
    const newSubjects = [...subjects];
    newSubjects[index][field] = value;
    setSubjects(newSubjects);
  };

  const updateGradingRule = (index: number, field: string, value: string) => {
    const newRules = [...gradingRules];
    newRules[index][field] = value;
    setGradingRules(newRules);
  };

  const handleCreate = async () => {
    if (!name || !className || !section) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      
      const formattedSubjects = subjects.map(s => ({
        name: s.name,
        max_theory: parseInt(s.max_theory) || 0,
        max_practical: 0,
        passing_marks: parseInt(s.passing_marks) || 0
      }));

      const formattedGradingRules = gradingRules.map(r => ({
        grade: r.grade,
        min: parseInt(r.min) || 0,
        max: parseInt(r.max) || 0
      }));

      const payload = {
        name,
        class_name: className,
        section,
        show_highest_marks: showHighest,
        include_grade: includeGrade,
        include_percentage: includePercentage,
        subjects_blueprint: formattedSubjects,
        grading_rules: includeGrade ? formattedGradingRules : [],
        manual_stats: {}
      };

      await axios.post(`${API_ENDPOINTS.EXAM}/create`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Marksheet Created!');
      router.back();

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to create marksheet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtnFree}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {step === 1 ? 'Create Marksheet' : 'Configure Subjects'}
          </Text>
          <TouchableOpacity onPress={() => {
            if (step === 1) setStep(2);
            else handleCreate();
          }}>
             <Text style={[styles.nextBtn, { color: theme.primary }]}>
               {step === 1 ? 'Next' : (loading ? 'Saving...' : 'Create')}
             </Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 ? (
            <View>
              <Text style={[styles.label, { color: theme.text }]}>Exam / Report Card Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                placeholder="e.g. Final Term 2026"
                placeholderTextColor={theme.textLight}
                value={name}
                onChangeText={setName}
              />

              <Text style={[styles.label, { color: theme.text }]}>Class</Text>
              <View style={styles.tagContainer}>
                {classes.map((cls: any) => (
                  <TouchableOpacity
                    key={cls}
                    style={[
                      styles.tag, 
                      className === cls ? { backgroundColor: theme.primary } : { backgroundColor: theme.card, borderColor: theme.border }
                    ]}
                    onPress={() => { setClassName(cls); setSection(''); }}
                  >
                    <Text style={[styles.tagText, className === cls ? { color: '#fff' } : { color: theme.text }]}>{cls}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {className && (
                <>
                  <Text style={[styles.label, { color: theme.text }]}>Section</Text>
                  <View style={styles.tagContainer}>
                    {sections[className]?.map((sec: any) => (
                      <TouchableOpacity
                        key={sec}
                        style={[
                          styles.tag, 
                          section === sec ? { backgroundColor: theme.primary } : { backgroundColor: theme.card, borderColor: theme.border }
                        ]}
                        onPress={() => setSection(sec)}
                      >
                        <Text style={[styles.tagText, section === sec ? { color: '#fff' } : { color: theme.text }]}>{sec}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          ) : (
            <View>
              <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>Show Grading (A, B, C)</Text>
                  <Switch value={includeGrade} onValueChange={setIncludeGrade} trackColor={{ false: '#767577', true: theme.primary }} />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>Show Percentage (%)</Text>
                  <Switch value={includePercentage} onValueChange={setIncludePercentage} trackColor={{ false: '#767577', true: theme.primary }} />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>Show Topper Marks</Text>
                  <Switch value={showHighest} onValueChange={setShowHighest} trackColor={{ false: '#767577', true: theme.primary }} />
                </View>
              </View>

              {includeGrade && (
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 12 }]}>Grading Matrix</Text>
                  {gradingRules.map((rule, index) => (
                    <View key={index} style={styles.gradingRow}>
                      <Text style={[styles.gradeLabel, { color: theme.text }]}>{rule.grade}</Text>
                      <View style={styles.rangeInputs}>
                        <TextInput
                          style={[styles.smallInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                          value={rule.min}
                          keyboardType="numeric"
                          onChangeText={(val) => updateGradingRule(index, 'min', val)}
                        />
                        <Text style={{ color: theme.textLight, marginHorizontal: 4 }}>to</Text>
                        <TextInput
                          style={[styles.smallInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                          value={rule.max}
                          keyboardType="numeric"
                          onChangeText={(val) => updateGradingRule(index, 'max', val)}
                        />
                        <Text style={{ color: theme.textLight, marginLeft: 4 }}>%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Subjects</Text>
                <TouchableOpacity onPress={handleAddSubject}>
                  <Text style={{ color: theme.primary, fontWeight: 'bold' }}>+ Add Subject</Text>
                </TouchableOpacity>
              </View>

              {subjects.map((sub, index) => (
                <View key={index} style={[styles.subjectCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={styles.subjectHeader}>
                    <Text style={[styles.subjectIndex, { color: theme.textLight }]}>#{index + 1}</Text>
                    <TouchableOpacity onPress={() => handleRemoveSubject(index)}>
                      <Ionicons name="close-circle" size={20} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                  
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, marginBottom: 8 }]}
                    placeholder="Subject Name (e.g. Physics)"
                    placeholderTextColor={theme.textLight}
                    value={sub.name}
                    onChangeText={(text) => updateSubject(index, 'name', text)}
                  />

                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.subLabel, { color: theme.textLight }]}>Max Marks</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                        placeholder="100"
                        keyboardType="numeric"
                        placeholderTextColor={theme.textLight}
                        value={sub.max_theory}
                        onChangeText={(text) => updateSubject(index, 'max_theory', text)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.subLabel, { color: theme.textLight }]}>Passing Marks</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                        placeholder="33"
                        keyboardType="numeric"
                        placeholderTextColor={theme.textLight}
                        value={sub.passing_marks}
                        onChangeText={(text) => updateSubject(index, 'passing_marks', text)}
                      />
                    </View>
                  </View>
                </View>
              ))}
              
              <View style={{ height: 100 }} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  backText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  nextBtn: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagText: {
    fontWeight: '600',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subjectCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subjectIndex: {
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  subLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  gradingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  gradeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    width: 40,
  },
  rangeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallInput: {
    width: 50,
    borderWidth: 1,
    borderRadius: 6,
    padding: 6,
    textAlign: 'center',
    fontSize: 14,
  },
});