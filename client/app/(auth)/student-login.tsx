import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Image, ScrollView, Modal, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';
import { useSocket } from '../../context/SocketContext';

const API_URL = API_ENDPOINTS.AUTH.STUDENT;

interface Institute {
  id: string;
  institute_name: string;
  logo_url?: string;
  landmark?: string;
  address?: string;
}

interface Student {
  id: string;
  name: string;
  class: string;
  section: string;
  roll_no: string;
  photo_url?: string;
  code_used: boolean;
}

export default function StudentLogin() {
  const router = useRouter();
  const { theme, isDark } = useTheme();

  const [step, setStep] = useState('phone'); // phone, institutes, students, code
  const [phone, setPhone] = useState('');
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<Institute | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = await AsyncStorage.getItem('studentToken');
      const userData = await AsyncStorage.getItem('studentData');
      if (token && userData) {
        router.replace('/(student)/dashboard');
      }
    } catch (error) {
      console.error('Session check error:', error);
    }
  };

  const handleVerifyPhone = async () => {
    setError('');
    if (!phone || phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/verify-phone`, { mobile: phone });
      if (response.data.institutes && response.data.institutes.length > 0) {
        setInstitutes(response.data.institutes);
        setStep('institutes');
      } else {
        setError('No institutes found for this phone number');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to verify phone number');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInstitute = async (institute: Institute) => {
    setSelectedInstitute(institute);
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/get-students`, {
        mobile: phone,
        institute_id: institute.id
      });
      if (response.data.students && response.data.students.length > 0) {
        setStudents(response.data.students);
        setStep('students');
      } else {
        setError('No students found for this institute');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    if (student.code_used) {
      handleDirectLogin(student.id);
    } else {
      setStep('code');
    }
  };

  const handleVerifyCode = async () => {
    setError('');
    if (!selectedStudent || !code) {
      setError('Please enter your access code');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/verify-code`, {
        student_id: selectedStudent.id,
        access_code: code
      });
      await saveSessionAndNavigate(response.data.token, response.data.student);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid access code');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectLogin = async (studentId: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API_URL}/login`, { student_id: studentId });
      await saveSessionAndNavigate(response.data.token, response.data.student);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
      setLoading(false);
    }
  };

  const { joinRoom } = useSocket();



  const saveSessionAndNavigate = async (token: string, studentData: any) => {
    try {
      await AsyncStorage.setItem('studentToken', token);
      await AsyncStorage.setItem('studentData', JSON.stringify(studentData));

      // Join Socket Room
      if (studentData.institute_id && studentData.class && studentData.section) {
        const room = `${studentData.institute_id}-${studentData.class}-${studentData.section}`;
        joinRoom(room);
      } else if (selectedInstitute?.id && studentData.class && studentData.section) {
        // Fallback if institute_id is missing in student object but we have it from selection
        const room = `${selectedInstitute.id}-${studentData.class}-${studentData.section}`;
        joinRoom(room);
      }

      const savedAccounts = await AsyncStorage.getItem('studentAccounts');
      let accounts = savedAccounts ? JSON.parse(savedAccounts) : [];
      const existingIndex = accounts.findIndex((acc: any) => acc.id === studentData.id);
      if (existingIndex !== -1) {
        accounts[existingIndex] = studentData;
      } else {
        accounts.push(studentData);
      }
      await AsyncStorage.setItem('studentAccounts', JSON.stringify(accounts));
      Toast.show({ type: 'success', text1: 'Login Successful', text2: `Welcome, ${studentData.name}!` });
      router.replace('/(student)/dashboard');
    } catch (error) {
      console.error('Save session error:', error);
      setError('Failed to save session');
      setLoading(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    content: { flex: 1, padding: 25, justifyContent: 'center' },
    card: {
      backgroundColor: theme.card,
      borderRadius: 30,
      padding: 30,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1, shadowRadius: 20, elevation: 5
    },
    iconHeader: {
      width: 80, height: 80, borderRadius: 25,
      backgroundColor: theme.primary + '10',
      justifyContent: 'center', alignItems: 'center',
      alignSelf: 'center', marginBottom: 25
    },
    title: { fontSize: 28, fontWeight: '900', color: theme.text, textAlign: 'center', marginBottom: 10 },
    subtitle: { fontSize: 15, color: theme.textLight, textAlign: 'center', marginBottom: 35, lineHeight: 22 },

    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 15,
      marginBottom: 20
    },
    input: { flex: 1, height: 60, color: theme.text, fontSize: 16, fontWeight: '700' },
    button: {
      backgroundColor: theme.primary,
      height: 60, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 10, elevation: 8
    },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    errorText: { color: theme.danger, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: -10, marginBottom: 15 },

    linksContainer: { marginTop: 30, alignItems: 'center' },
    link: { color: theme.primary, fontSize: 15, fontWeight: '800', marginVertical: 10 },

    // Selection steps
    stepContainer: { flex: 1, padding: 20 },
    backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    backText: { fontSize: 16, color: theme.text, fontWeight: '700', marginLeft: 10 },
    pageTitle: { fontSize: 26, fontWeight: '900', color: theme.text, marginBottom: 8 },
    pageSubtitle: { fontSize: 15, color: theme.textLight, marginBottom: 25 },

    listItem: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: theme.card, padding: 18,
      borderRadius: 24, marginBottom: 15,
      borderWidth: 1, borderColor: theme.border,
    },
    listIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    listContent: { flex: 1 },
    listTitle: { fontSize: 17, fontWeight: '800', color: theme.text, marginBottom: 4 },
    listSubtitle: { fontSize: 13, color: theme.textLight, fontWeight: '600' },
    logoImg: { width: '100%', height: '100%', borderRadius: 18 },

    avatar: { width: 56, height: 56, borderRadius: 28 },
    statusBadge: { fontSize: 11, fontWeight: '800', color: theme.success, marginTop: 5, textTransform: 'uppercase' },

    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  }), [theme, isDark]);

  const renderPhoneStep = () => (
    <View style={styles.content}>
      <View style={styles.card}>
        <View style={styles.iconHeader}>
          <Ionicons name="school" size={40} color={theme.primary} />
        </View>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Enter your registered mobile number to access your student profile</Text>

        <View style={styles.inputWrapper}>
          <Ionicons name="call-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
          <TextInput
            style={styles.input}
            placeholder="Mobile Number"
            placeholderTextColor={theme.textLight}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 10))}
            maxLength={10}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleVerifyPhone} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
        </TouchableOpacity>

        <View style={styles.linksContainer}>
          <TouchableOpacity onPress={() => router.push('/(auth)/teacher-login')}>
            <Text style={styles.link}>I am a Teacher</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(auth)/institute-login')}>
            <Text style={styles.link}>Institute Administration</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderInstitutesStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backBtn} onPress={() => setStep('phone')}>
        <Ionicons name="arrow-back" size={24} color={theme.text} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.pageTitle}>Select Institute</Text>
      <Text style={styles.pageSubtitle}>We found multiple institutes linked to your number</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {institutes.map((inst) => (
          <TouchableOpacity key={inst.id} style={styles.listItem} onPress={() => handleSelectInstitute(inst)}>
            <View style={styles.listIcon}>
              {inst.logo_url ? <Image source={{ uri: inst.logo_url }} style={styles.logoImg} /> : <Ionicons name="business" size={24} color={theme.primary} />}
            </View>
            <View style={styles.listContent}>
              <Text style={styles.listTitle}>{inst.institute_name}</Text>
              <Text style={styles.listSubtitle}>{inst.landmark || inst.address}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderStudentsStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity style={styles.backBtn} onPress={() => setStep('institutes')}>
        <Ionicons name="arrow-back" size={24} color={theme.text} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.pageTitle}>Choose Profile</Text>
      <Text style={styles.pageSubtitle}>{selectedInstitute?.institute_name}</Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {students.map((stud) => (
          <TouchableOpacity key={stud.id} style={styles.listItem} onPress={() => handleSelectStudent(stud)}>
            <View style={styles.listIcon}>
              {stud.photo_url ? <Image source={{ uri: stud.photo_url }} style={styles.avatar} /> : <Ionicons name="person" size={24} color={theme.primary} />}
            </View>
            <View style={styles.listContent}>
              <Text style={styles.listTitle}>{stud.name}</Text>
              <Text style={styles.listSubtitle}>Class {stud.class}-{stud.section} • Roll: {stud.roll_no}</Text>
              {stud.code_used && <Text style={styles.statusBadge}>Verified Profile</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderCodeStep = () => (
    <View style={styles.content}>
      <View style={styles.card}>
        <TouchableOpacity style={{ alignSelf: 'flex-start', marginBottom: 20 }} onPress={() => setStep('students')}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.iconHeader}>
          <Ionicons name="shield-checkmark" size={40} color={theme.primary} />
        </View>
        <Text style={styles.title}>Verification</Text>
        <Text style={styles.subtitle}>Enter 6-digit access code for {selectedStudent?.name}</Text>

        <View style={styles.inputWrapper}>
          <Ionicons name="key-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
          <TextInput
            style={[styles.input, { letterSpacing: 5, fontSize: 22, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
            placeholder="XXXXXX"
            placeholderTextColor={theme.textLight}
            value={code}
            onChangeText={setCode}
            maxLength={6}
            autoCapitalize="none"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleVerifyCode} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Authorize</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle} />
      {step === 'phone' && renderPhoneStep()}
      {step === 'institutes' && renderInstitutesStep()}
      {step === 'students' && renderStudentsStep()}
      {step === 'code' && renderCodeStep()}
      {loading && step !== 'phone' && step !== 'code' && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color="#fff" /></View>}
    </SafeAreaView>
  );
}