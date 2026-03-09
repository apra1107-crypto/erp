import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  StatusBar, 
  Image, 
  Dimensions 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

const { width } = Dimensions.get('window');

export default function StudentResultsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const token = await AsyncStorage.getItem('studentToken');
      const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
      const studentStr = await AsyncStorage.getItem('studentData');
      const student = studentStr ? JSON.parse(studentStr) : null;
      const sessionId = storedSessionId || (student ? student.current_session_id : null);

      const response = await axios.get(`${API_ENDPOINTS.EXAM}/student/published`, {
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchExams();
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => router.push(`/(student)/results/preview?examId=${item.id}`)}
      activeOpacity={0.9}
    >
      <View style={styles.cardContent}>
        <View style={[styles.iconContainer, { backgroundColor: isDark ? '#2D1B36' : '#F3E5F5' }]}>
            <Ionicons name="document-text" size={28} color="#8E44AD" />
        </View>
        <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={[styles.examName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.examMeta, { color: theme.textLight }]}>
                {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Examination Results</Text>
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
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="documents-outline" size={80} color={theme.border} />
              <Text style={[styles.emptyText, { color: theme.textLight }]}>No Results Published Yet</Text>
              <Text style={[styles.emptySubText, { color: theme.textLight }]}>When your results are ready, they will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingBottom: 15,
    backgroundColor: 'transparent'
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  card: { 
    borderRadius: 20, 
    marginBottom: 16, 
    borderWidth: 1, 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 5 
  },
  cardContent: { padding: 18, flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  examName: { fontSize: 17, fontWeight: '800' },
  examMeta: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: 18, fontWeight: '800', marginTop: 16 },
  emptySubText: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
});
