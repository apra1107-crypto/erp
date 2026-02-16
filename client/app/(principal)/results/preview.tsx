import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert, StatusBar, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

export default function MarksheetPreview() {
  const { examId, studentId } = useLocalSearchParams();
  const router = useRouter();
  const { theme, isDark } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchMarksheet();
  }, [examId, studentId]);

  const fetchMarksheet = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${API_ENDPOINTS.EXAM}/${examId}/marksheet/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load report card');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!data) return null;

  const { exam, student, institute, result } = data;
  const marks = result?.marks_data || [];
  const stats = result?.calculated_stats || {};

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnFree}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Report Card Preview</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.reportCard, { backgroundColor: '#fff' }]}>
          
          <View style={styles.rcHeader}>
            <View style={styles.logoContainer}>
              {!!institute.logo_url ? (
                <Image source={{ uri: institute.logo_url }} style={styles.logo} resizeMode="contain" />
              ) : (
                <View style={[styles.placeholderLogo, { backgroundColor: theme.primary }]}>
                   <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20 }}>{(institute.institute_name || '?').charAt(0)}</Text>
                </View>
              )}
            </View>
            <View style={styles.instInfo}>
              <Text style={styles.instName}>{(institute.institute_name || '').toUpperCase()}</Text>
              {!!institute.affiliation && (
                <Text style={styles.instAffiliation} numberOfLines={1}>{institute.affiliation}</Text>
              )}
              <Text style={styles.instAddress}>{institute.address} {institute.landmark}</Text>
              <Text style={[styles.instAddress, { marginLeft: 10 }]}>{institute.district} {institute.state} {institute.pincode}</Text>
            </View>
          </View>

          <View style={styles.divider} />
          
          <Text style={styles.examTitle}>{exam.name}</Text>

          {/* Student Details Section */}
          <View style={styles.studentSection}>
            <View style={styles.studentInfoContainer}>
              <View style={styles.detailItem}>
                <Text style={styles.infoLabel}>NAME</Text>
                <Text style={styles.infoValue}>{student.name || '-'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.infoLabel}>ROLL NO</Text>
                <Text style={styles.infoValue}>{student.roll_no || '-'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.infoLabel}>CLASS</Text>
                <Text style={styles.infoValue}>{student.class} - {student.section}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.infoLabel}>FATHER'S NAME</Text>
                <Text style={styles.infoValue}>{student.father_name || '-'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.infoLabel}>MOTHER'S NAME</Text>
                <Text style={styles.infoValue}>{student.mother_name || '-'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.infoLabel}>DOB</Text>
                <Text style={styles.infoValue}>
                  {student.dob 
                    ? new Date(student.dob).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) 
                    : '-'}
                </Text>
              </View>
            </View>

            <View style={[styles.studentImageContainer, { marginRight: 0, marginLeft: 15 }]}>
              {!!student.photo_url || !!student.profile_image ? (
                <Image 
                  source={{ uri: student.photo_url || student.profile_image }} 
                  style={styles.studentPhoto} 
                />
              ) : (
                <View style={styles.studentPhotoPlaceholder}>
                  <Ionicons name="person" size={40} color="#ccc" />
                </View>
              )}
            </View>
          </View>

          {/* Marks Table */}
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2, textAlign: 'left' }]}>Subject</Text>
              <Text style={styles.th}>Max</Text>
              <Text style={styles.th}>Obt</Text>
              {!!exam.include_grade && <Text style={styles.th}>Grade</Text>}
            </View>
            
            {exam.subjects_blueprint.map((sub: any, index: number) => {
              const mark = marks.find((m: any) => m.subject === sub.name);
              const score = mark ? (mark.theory || '-') : '-';
              const grade = mark ? (mark.grade || '-') : '-';
              
              return (
                <View key={index} style={styles.tr}>
                  <Text style={[styles.td, { flex: 2, textAlign: 'left' }]}>{sub.name}</Text>
                  <Text style={styles.td}>{sub.max_theory}</Text>
                  <Text style={[styles.td, { fontWeight: 'bold' }]}>{score}</Text>
                  {!!exam.include_grade && <Text style={styles.td}>{grade}</Text>}
                </View>
              );
            })}
          </View>

          {/* Footer Stats */}
          <View style={styles.statsBox}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>{stats.total || 0}</Text>
            </View>
            {!!exam.include_percentage ? (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Percentage</Text>
                <Text style={styles.statValue}>{stats.percentage || 0}%</Text>
              </View>
            ) : null}
            {!!exam.include_grade ? (
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Grade</Text>
                <Text style={styles.statValue}>{stats.grade || '-'}</Text>
              </View>
            ) : null}
          </View>

          {result.overall_remark ? (
            <View style={styles.remarkBox}>
              <Text style={styles.remarkLabel}>Remarks:</Text>
              <Text style={styles.remarkText}>{result.overall_remark}</Text>
            </View>
          ) : null}

          <View style={styles.signatures}>
            <View style={styles.sigBox}>
              <Text style={styles.sigLine}>Class Teacher</Text>
            </View>
            <View style={styles.sigBox}>
              <Text style={styles.sigLine}>Principal</Text>
            </View>
          </View>

        </View>
      </ScrollView>
    </View>
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
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  reportCard: {
    borderRadius: 8,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    minHeight: 500,
  },
  rcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoContainer: {
    width: 60,
    height: 60,
    marginRight: 8,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  placeholderLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instInfo: {
    flex: 1,
    marginLeft: 0,
    alignItems: 'flex-start',
  },
  instName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
    textAlign: 'left',
  },
  instAffiliation: {
    fontSize: 9,
    fontWeight: '600',
    color: '#444',
    marginBottom: 2,
    textAlign: 'left',
  },
  instAddress: {
    fontSize: 10,
    color: '#666',
    textAlign: 'left',
  },
  divider: {
    height: 2,
    backgroundColor: '#000',
    marginVertical: 10,
  },
  examTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
    marginTop: 8,
  },
  session: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
  },
  studentSection: {
    flexDirection: 'row',
    marginBottom: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
  },
  studentImageContainer: {
    width: 80,
    height: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  studentPhoto: {
    width: '100%',
    height: '100%',
  },
  studentPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  detailItem: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#666',
    width: 80,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000',
    flex: 1,
  },
  table: {
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
  th: {
    flex: 1,
    padding: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 12,
    color: '#000',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  td: {
    flex: 1,
    padding: 8,
    textAlign: 'center',
    fontSize: 12,
    color: '#000',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  statsBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  remarkBox: {
    marginBottom: 30,
    padding: 10,
    backgroundColor: '#fdfdfd',
    borderWidth: 1,
    borderColor: '#eee',
  },
  remarkLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#000',
  },
  remarkText: {
    color: '#444',
    fontStyle: 'italic',
  },
  signatures: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  sigBox: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    width: 100,
    alignItems: 'center',
    paddingTop: 8,
  },
  sigLine: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
});