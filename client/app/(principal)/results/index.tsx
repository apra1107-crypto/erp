import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, RefreshControl, StatusBar, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

export default function ResultsDashboard() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    fetchExams();
  }, []);

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

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => router.push(`/(principal)/results/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: isDark ? '#3E1A23' : '#FCE4EC' }]}>
          <Ionicons name="document-text-outline" size={24} color="#E91E63" />
        </View>
        <TouchableOpacity onPress={() => deleteExam(item.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color={theme.danger} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.cardContent}>
        <Text style={[styles.examName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.examDetail, { color: theme.textLight }]}>
          Class {item.class_name} • Section {item.section}
        </Text>
        <Text style={[styles.examDate, { color: theme.textLight }]}>
          {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </Text>
      </View>
      
      <View style={styles.fillMarksContainer}>
        <View style={[styles.fillMarksBtn, { backgroundColor: theme.primary + '15' }]}>
          <Text style={[styles.footerAction, { color: theme.primary }]}>Fill Marks</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnFree}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Results & Marksheets</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={exams}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={64} color={theme.textLight} />
              <Text style={[styles.emptyText, { color: theme.textLight }]}>No Marksheets Created Yet</Text>
              <Text style={[styles.emptySubText, { color: theme.textLight }]}>Tap + to create a new blueprint</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/(principal)/results/create')}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
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
    fontWeight: '700',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    padding: 8,
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  examName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  examDetail: {
    fontSize: 14,
    marginBottom: 4,
  },
  examDate: {
    fontSize: 12,
  },
  fillMarksContainer: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  fillMarksBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 4,
  },
  footerAction: {
    fontWeight: '700',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});