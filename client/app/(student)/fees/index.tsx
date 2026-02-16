import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../../../constants/Config';
import MonthlyFeesTab from './MonthlyFeesTab';
import OccasionalFeesTab from './OccasionalFeesTab';
import FeeReceiptModal from '../../../components/FeeReceiptModal';
import { generateFeeReceipt } from '../../../utils/feeReceiptGenerator';

export default function StudentFeesScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'monthly' | 'occasional'>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [feeHistory, setFeeHistory] = useState<any[]>([]);
  const [totalArrears, setTotalArrears] = useState(0);
  const [instituteInfo, setInstituteInfo] = useState<any>(null);

  // Receipt Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedFeeData, setSelectedFeeData] = useState<any>(null);

  const selectedMonth = useMemo(() => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [currentDate]);

  useEffect(() => {
    fetchFeeData();
  }, []);

  const fetchFeeData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('studentToken');
      const studentStr = await AsyncStorage.getItem('studentData');
      const selectedSessionId = await AsyncStorage.getItem('selectedSessionId');
      
      if (!studentStr) return;
      const student = JSON.parse(studentStr);

      const headers: any = { Authorization: `Bearer ${token}` };
      if (selectedSessionId) {
          headers['x-academic-session-id'] = selectedSessionId;
      }

      const res = await axios.get(`${API_ENDPOINTS.FEES}/student/${student.id}`, {
        headers
      });
      
      setFeeHistory(res.data.history || []);
      setTotalArrears(res.data.totalArrears || 0);

      // Fetch profile for institute info (headers)
      const profileRes = await axios.get(`${API_ENDPOINTS.AUTH.STUDENT}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fullProfile = profileRes.data.student;
      if (fullProfile) {
        setInstituteInfo({
          ...fullProfile,
          institute_name: fullProfile.institute_name,
          logo_url: fullProfile.institute_logo,
          address: fullProfile.institute_address,
          mobile: fullProfile.mobile, // optional: could be institute mobile if available
          email: fullProfile.email // optional: could be institute email if available
        });
      }

    } catch (error) {
      console.error('Error fetching student fees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handlePreviewReceipt = (fee: any) => {
    setSelectedFeeData(fee);
    setIsModalVisible(true);
  };

  const handleShareReceipt = async () => {
    if (selectedFeeData && instituteInfo) {
      const studentStr = await AsyncStorage.getItem('studentData');
      const student = JSON.parse(studentStr!);
      await generateFeeReceipt(selectedFeeData, instituteInfo, student);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
        paddingTop: insets.top + 10,
        paddingBottom: 10,
        paddingHorizontal: 10, // Reduced horizontal padding to shift left
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent', // Free flow
    },
    backBtn: { padding: 8, borderRadius: 12, marginRight: 5 }, // Reduced marginRight
    headerTitle: { fontSize: 22, fontWeight: '900', color: theme.text },
    
    summaryCard: {
        margin: 16,
        padding: 20,
        borderRadius: 24,
        backgroundColor: theme.primary,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
    summaryValue: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4 },
    
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    tabItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 12,
      marginHorizontal: 4,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activeTabItem: { backgroundColor: theme.primary, borderColor: theme.primary },
    tabText: { fontSize: 14, fontWeight: '700', color: theme.textLight, marginLeft: 8 },
    activeTabText: { color: '#FFFFFF' },

    monthSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      marginHorizontal: 20,
      backgroundColor: theme.card,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 15,
    },
    monthText: { color: theme.text, fontWeight: '800', fontSize: 15, marginHorizontal: 20, minWidth: 120, textAlign: 'center' },
  }), [theme, insets, isDark]);

  if (loading) {
    return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background}}>
            <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} translucent={true} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Fees</Text>
      </View>

      <View style={styles.summaryCard}>
        <View>
            <Text style={styles.summaryLabel}>Total Arrears</Text>
            <Text style={styles.summaryValue}>₹{totalArrears.toLocaleString()}</Text>
        </View>
        <Ionicons name="wallet-outline" size={40} color="rgba(255,255,255,0.5)" />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'monthly' && styles.activeTabItem]}
          onPress={() => setActiveTab('monthly')}
        >
          <Ionicons name="calendar" size={18} color={activeTab === 'monthly' ? '#fff' : theme.textLight} />
          <Text style={[styles.tabText, activeTab === 'monthly' && styles.activeTabText]}>Monthly</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'occasional' && styles.activeTabItem]}
          onPress={() => setActiveTab('occasional')}
        >
          <Ionicons name="gift" size={18} color={activeTab === 'occasional' ? '#fff' : theme.textLight} />
          <Text style={[styles.tabText, activeTab === 'occasional' && styles.activeTabText]}>Occasional</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={handlePreviousMonth}><Ionicons name="chevron-back" size={20} color={theme.primary} /></TouchableOpacity>
        <Text style={styles.monthText}>{selectedMonth}</Text>
        <TouchableOpacity onPress={handleNextMonth}><Ionicons name="chevron-forward" size={20} color={theme.primary} /></TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        {activeTab === 'monthly' ? (
          <MonthlyFeesTab 
            history={feeHistory.filter(f => f.fee_type === 'monthly')} 
            selectedMonth={selectedMonth} 
            instituteInfo={instituteInfo}
            refreshData={fetchFeeData}
            onPreviewReceipt={handlePreviewReceipt}
          />
        ) : (
          <OccasionalFeesTab 
            history={feeHistory.filter(f => f.fee_type === 'occasional')} 
            selectedMonth={selectedMonth} 
            instituteInfo={instituteInfo}
            refreshData={fetchFeeData}
            onPreviewReceipt={handlePreviewReceipt}
          />
        )}
      </ScrollView>

      {selectedFeeData && (
        <FeeReceiptModal
          visible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          feeData={selectedFeeData}
          institute={instituteInfo}
          student={instituteInfo} // In student app, instituteInfo from profile has student details too
          onShare={handleShareReceipt}
        />
      )}
    </View>
  );
}
