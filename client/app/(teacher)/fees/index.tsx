import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Modal, ActivityIndicator, FlatList, Image, TextInput, KeyboardAvoidingView, Platform, Dimensions, Alert } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import MonthlyCollectionTab from './MonthlyCollectionTab';
import OccasionalCollectionTab from './OccasionalCollectionTab';
import FeeReceiptModal from '../../../components/FeeReceiptModal';
import { generateFeeReceipt } from '../../../utils/feeReceiptGenerator';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../../../constants/Config';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function FeesManagementScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'monthly' | 'occasional'>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Search States
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // History States
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [totalArrears, setTotalArrears] = useState(0);
  const [isReceiptGenerating, setIsReceiptGenerating] = useState(false);

  // History Filter States
  const [historyFilterType, setHistoryFilterType] = useState<'ALL' | 'monthly' | 'occasional'>('ALL');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<'ALL' | 'paid' | 'unpaid'>('ALL');
  const [historyFilterMonth, setHistoryFilterMonth] = useState('ALL');
  const [showHistoryMonthPicker, setShowHistoryMonthPicker] = useState(false);

  // Defaulter States
  const [isDefaulterVisible, setIsDefaulterVisible] = useState(false);
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [defaulterLoading, setDefaulterLoading] = useState(false);
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterSection, setFilterSection] = useState<string>('ALL');
  const [expandedFilter, setExpandedFilter] = useState<'class' | 'section' | null>(null);
  const [allClassesSections, setAllClassesSections] = useState<{class: string, section: string}[]>([]);

  // Receipt Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedFeeData, setSelectedFeeData] = useState<any>(null);
  const [instituteInfo, setInstituteInfo] = useState<any>(null);
  const [selectedStudentForReceipt, setSelectedStudentForReceipt] = useState<any>(null);

  // Auth Helpers
  const getToken = async () => {
    return await AsyncStorage.getItem('token') || await AsyncStorage.getItem('teacherToken');
  };

  const getUserData = async () => {
    const data = await AsyncStorage.getItem('userData') || await AsyncStorage.getItem('teacherData');
    return data ? JSON.parse(data) : null;
  };

  useEffect(() => {
    fetchAllClasses();
    loadInstituteInfo();
  }, [selectedMonth]);

  const loadInstituteInfo = async () => {
    try {
        const user = await getUserData();
        if (user) setInstituteInfo(user);
    } catch (e) { console.error(e); }
  };

  const handlePreviewReceipt = (fee: any, student: any) => {
    setSelectedFeeData(fee);
    setSelectedStudentForReceipt(student);
    setIsModalVisible(true);
  };

  const handleShareReceipt = async () => {
    if (selectedFeeData && instituteInfo && selectedStudentForReceipt) {
      await generateFeeReceipt(selectedFeeData, instituteInfo, selectedStudentForReceipt);
    }
  };

  const handleViewReceiptInternal = async (item: any) => {
    // Instead of using system print dialog which is failing, 
    // we use the app's internal FeeReceiptModal which is already working elsewhere
    const studentData = {
        ...selectedStudent,
        class: selectedStudent.class,
        section: selectedStudent.section,
        roll_no: selectedStudent.roll_no
    };
    setSelectedFeeData(item);
    setSelectedStudentForReceipt(studentData);
    setIsModalVisible(true);
  };

  const handleShareReceiptInternal = async (item: any) => {
    if (isReceiptGenerating) return;
    try {
        setIsReceiptGenerating(true);
        const studentData = {
            ...selectedStudent,
            class: selectedStudent.class,
            section: selectedStudent.section,
            roll_no: selectedStudent.roll_no
        };
        await generateFeeReceipt(item, instituteInfo, studentData);
    } catch (error) {
        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to share receipt' });
    } finally {
        setIsReceiptGenerating(false);
    }
  };

  const handleMarkPaid = async (item: any) => {
    Alert.alert(
        "Confirm Collection",
        `Mark ₹${item.total_amount} as paid for ${selectedStudent.name}?`,
        [
            { text: "Cancel", style: "cancel" },
            {
                text: "Collect",
                onPress: async () => {
                    try {
                        const token = await getToken();
                        const user = await getUserData();

                        if (item.fee_type === 'monthly') {
                            await axios.put(
                                `${API_ENDPOINTS.FEES}/manual-pay/${item.id}`,
                                {
                                    instituteId: user.id || user.institute_id,
                                    studentId: selectedStudent.id,
                                    month_year: item.month_year,
                                    collectedBy: user.principal_name || user.name
                                },
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                        } else {
                            await axios.put(
                                `${API_ENDPOINTS.FEES}/occasional-batch-pay/${user.id || user.institute_id}`,
                                {
                                    batch_id: item.batch_id,
                                    student_id: selectedStudent.id,
                                    collectedBy: user.principal_name || user.name
                                },
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                        }

                        Toast.show({ type: 'success', text1: 'Success', text2: 'Payment recorded successfully' });
                        fetchStudentHistory(selectedStudent);
                    } catch (error) {
                        console.error('Payment error:', error);
                        Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to record payment' });
                    }
                }
            }
        ]
    );
  };

  const fetchAllClasses = async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const students = res.data.students || [];
      const classSections = students.map((s: any) => ({ class: s.class, section: s.section }));
      setAllClassesSections(classSections);
    } catch (error) {
      console.error('Error fetching all classes:', error);
    }
  };

  const selectedMonth = useMemo(() => {
    if (!currentDate || !(currentDate instanceof Date) || isNaN(currentDate.getTime())) {
      return 'Select Month';
    }
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [currentDate]);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const token = await getToken();
      const response = await axios.get(
        `${API_ENDPOINTS.PRINCIPAL}/search?query=${text}&type=student`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSearchResults(response.data.results.filter((r: any) => r.type === 'student'));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchStudentHistory = async (student: any) => {
    setIsSearchActive(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedStudent(student);
    setIsHistoryVisible(true);
    setHistoryLoading(true);
    
    // Reset filters
    setHistoryFilterType('ALL');
    setHistoryFilterStatus('ALL');
    setHistoryFilterMonth('ALL');

    try {
      const token = await getToken();
      const res = await axios.get(
        `${API_ENDPOINTS.FEES}/student/${student.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStudentHistory(res.data.history || []);
      setTotalArrears(res.data.totalArrears || 0);
    } catch (error) {
      console.error('Error fetching history:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load fee history' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredHistory = useMemo(() => {
    return studentHistory.filter(item => {
      const typeMatch = historyFilterType === 'ALL' || item.fee_type === historyFilterType;
      const statusMatch = historyFilterStatus === 'ALL' || item.status === historyFilterStatus;
      const monthMatch = historyFilterMonth === 'ALL' || item.month_year === historyFilterMonth;
      return typeMatch && statusMatch && monthMatch;
    });
  }, [studentHistory, historyFilterType, historyFilterStatus, historyFilterMonth]);

  const handleHistoryMonthChange = (event: any, date?: Date) => {
    setShowHistoryMonthPicker(false);
    if (date) {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const formatted = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        setHistoryFilterMonth(formatted);
    }
  };

  const fetchDefaulters = async () => {
    try {
      setDefaulterLoading(true);
      setIsDefaulterVisible(true);
      const token = await getToken();
      const user = await getUserData();
      
      const endpoint = activeTab === 'monthly' ? 'defaulters' : 'occasional-defaulters';
      const instId = user.institute_id || user.id;

      const res = await axios.get(
        `${API_ENDPOINTS.FEES}/${endpoint}/${instId}?month=${selectedMonth}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDefaulters(res.data);
    } catch (error) {
      console.error('Error fetching defaulters:', error);
    } finally {
      setDefaulterLoading(false);
    }
  };

  const handlePreviousMonth = () => {
    const validDate = (currentDate instanceof Date && !isNaN(currentDate.getTime())) ? currentDate : new Date();
    const newDate = new Date(validDate.getFullYear(), validDate.getMonth() - 1, 1);
    setCurrentDate(newDate);
  };

  const handleNextMonth = () => {
    const validDate = (currentDate instanceof Date && !isNaN(currentDate.getTime())) ? currentDate : new Date();
    const newDate = new Date(validDate.getFullYear(), validDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
  };

  // Extract unique classes and sections for filtering
  const availableFilters = useMemo(() => {
    const classes = new Set<string>(['ALL']);
    const sections = new Set<string>(['ALL']);
    
    allClassesSections.forEach(item => {
      classes.add(item.class);
      if (filterClass === 'ALL' || item.class === filterClass) {
        sections.add(item.section);
      }
    });

    return {
      classes: Array.from(classes).sort((a, b) => a === 'ALL' ? -1 : b === 'ALL' ? 1 : a.localeCompare(b, undefined, { numeric: true })),
      sections: Array.from(sections).sort()
    };
  }, [allClassesSections, filterClass]);

  const filteredDefaulters = useMemo(() => {
    return defaulters.filter(d => {
      const classMatch = filterClass === 'ALL' || d.class === filterClass;
      const sectionMatch = filterSection === 'ALL' || d.section === filterSection;
      return classMatch && sectionMatch;
    });
  }, [defaulters, filterClass, filterSection]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
        paddingTop: insets.top + 10,
        paddingBottom: 10,
        paddingLeft: 12,
        paddingRight: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 100,
        backgroundColor: theme.background,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    backBtn: { 
        padding: 8, 
        borderRadius: 12, 
        marginRight: 5 
    },
    headerTitle: { 
        fontSize: 20, 
        fontWeight: '900', 
        color: theme.text 
    },
    searchBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.primary + '10',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inlineSearchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.card,
        borderRadius: 12,
        height: 44,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: theme.border,
    },
    inlineSearchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 15,
        color: theme.text,
        fontWeight: '600',
    },
    searchDropdown: {
        position: 'absolute',
        top: insets.top + 60,
        left: 15,
        right: 15,
        backgroundColor: theme.card,
        borderRadius: 18,
        maxHeight: SCREEN_HEIGHT * 0.5,
        zIndex: 1000,
        borderWidth: 1,
        borderColor: theme.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        overflow: 'hidden',
    },
    monthSelectorContainer: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    monthSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary + '10',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.primary + '20',
    },
    defaulterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.danger + '10',
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.danger + '20',
    },
    defaulterText: {
      color: theme.danger,
      fontWeight: '800',
      fontSize: 14,
    },
    monthText: {
      color: theme.primary,
      fontWeight: '800',
      fontSize: 14,
      marginHorizontal: 8,
      minWidth: 100,
      textAlign: 'center',
    },
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    tabItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 10,
      marginHorizontal: 4,
    },
    activeTabItem: {
      backgroundColor: theme.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.textLight,
      marginLeft: 8,
    },
    activeTabText: {
      color: '#FFFFFF',
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: theme.card,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '90%',
        padding: 24,
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text },
    filterContainer: { marginBottom: 20 },
    filterDropdown: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.background,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activeDropdown: {
      borderColor: theme.primary,
      backgroundColor: theme.primary + '05',
    },
    filterLabel: { fontSize: 13, fontWeight: '800', color: theme.textLight, textTransform: 'uppercase' },
    optionsContainer: {
      backgroundColor: theme.background,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 5,
    },
    chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, marginRight: 8 },
    activeChip: { backgroundColor: theme.primary, borderColor: theme.primary },
    chipText: { fontSize: 13, fontWeight: '700', color: theme.text },
    activeChipText: { color: '#fff' },
    studentItem: {
        backgroundColor: theme.background,
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: theme.border,
        flexDirection: 'row',
        alignItems: 'center',
    },
    studentImage: { width: 50, height: 50, borderRadius: 25, backgroundColor: theme.border, marginRight: 12 },
    studentInfo: { flex: 1 },
    studentName: { fontSize: 15, fontWeight: '700', color: theme.text, includeFontPadding: false },
    studentSub: { fontSize: 12, color: theme.textLight, includeFontPadding: false },
    amountText: { fontWeight: '900', fontSize: 16, color: theme.danger },

    // Search Styles
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    searchResultAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
    },
    searchResultName: {
        fontSize: 15,
        fontWeight: '700',
        color: theme.text,
    },
    searchResultSub: {
        fontSize: 12,
        color: theme.textLight,
        marginTop: 2,
    },

    // History Bottom Sheet Styles
    historyContainer: {
        flex: 1,
    },
    historyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        backgroundColor: theme.background,
        padding: 15,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.border,
    },
    historyAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginRight: 15,
        borderWidth: 2,
        borderColor: theme.primary,
    },
    historyStudentName: {
        fontSize: 18,
        fontWeight: '900',
        color: theme.text,
    },
    historyStudentSub: {
        fontSize: 13,
        color: theme.textLight,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        backgroundColor: theme.background,
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: theme.textLight,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 16,
        fontWeight: '900',
    },
    
    // Filter Chips
    historyFilterSection: {
        marginBottom: 20,
    },
    filterScroll: {
        paddingBottom: 5,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
        marginRight: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    activeFilterChip: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: theme.text,
    },
    activeFilterChipText: {
        color: '#fff',
    },
    filterGroupLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: theme.textLight,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 2,
    },

    historyItem: {
        backgroundColor: theme.background,
        padding: 15,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.border,
    },
    historyItemTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    historyMonth: {
        fontSize: 15,
        fontWeight: '800',
        color: theme.text,
    },
    historyType: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        color: theme.primary,
        backgroundColor: theme.primary + '15',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    historySummary: {
        fontSize: 11,
        fontWeight: '700',
        color: theme.secondary,
        marginTop: 4,
    },
    historyAmount: {
        fontSize: 16,
        fontWeight: '900',
    },
    historyStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    historyStatusText: {
        fontSize: 11,
        fontWeight: '900',
    },
    historyDetails: {
        borderTopWidth: 1,
        borderTopColor: theme.border + '50',
        paddingTop: 10,
        marginTop: 5,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    detailLabel: {
        fontSize: 12,
        color: theme.textLight,
        fontWeight: '600',
    },
    detailValue: {
        fontSize: 12,
        color: theme.text,
        fontWeight: '700',
    },
    
    // Actions in History
    payBtnSmall: {
        backgroundColor: theme.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 8,
    },
    payBtnTextSmall: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
    },
    receiptActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: theme.border + '30',
        paddingTop: 10,
    },
    receiptBtnIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.primary + '10',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.primary + '20',
    },
  }), [theme, insets, isDark, filterClass, filterSection]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} translucent={true} />
      
      {/* Header */}
      <View style={styles.header}>
        {!isSearchActive ? (
            <>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Fees</Text>
                </View>
                <TouchableOpacity style={styles.searchBtn} onPress={() => setIsSearchActive(true)}>
                    <Ionicons name="search" size={20} color={theme.primary} />
                </TouchableOpacity>
            </>
        ) : (
            <View style={{flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10}}>
                <View style={styles.inlineSearchContainer}>
                    <Ionicons name="search" size={18} color={theme.textLight} />
                    <TextInput 
                        style={styles.inlineSearchInput}
                        placeholder="Search student..."
                        placeholderTextColor={theme.textLight}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        autoFocus
                    />
                    {isSearching && <ActivityIndicator size="small" color={theme.primary} />}
                </View>
                <TouchableOpacity onPress={() => {setIsSearchActive(false); setSearchQuery(''); setSearchResults([]);}}>
                    <Text style={{color: theme.primary, fontWeight: '700'}}>Cancel</Text>
                </TouchableOpacity>
            </View>
        )}
      </View>

      {/* Search Results Dropdown */}
      {isSearchActive && searchQuery.length > 0 && (
          <View style={styles.searchDropdown}>
              <FlatList 
                data={searchResults}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.searchResultItem} onPress={() => fetchStudentHistory(item)}>
                        <Image 
                            source={item.photo_url ? { uri: item.photo_url } : require('../../../assets/images/favicon.png')} 
                            style={styles.searchResultAvatar} 
                        />
                        <View style={{flex: 1}}>
                            <Text style={styles.searchResultName}>{item.name}</Text>
                            <Text style={styles.searchResultSub}>Class {item.class}-{item.section} • Roll: {item.roll_no}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.border} />
                    </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                    !isSearching ? (
                        <View style={{padding: 30, alignItems: 'center'}}>
                            <Text style={{color: theme.textLight}}>No students found</Text>
                        </View>
                    ) : null
                )}
              />
          </View>
      )}

      {/* Top Month Selector & Defaulter Btn */}
      <View style={styles.monthSelectorContainer}>
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={handlePreviousMonth} style={{ padding: 2 }}>
            <Ionicons name="chevron-back" size={18} color={theme.primary} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{selectedMonth}</Text>
          <TouchableOpacity onPress={handleNextMonth} style={{ padding: 2 }}>
            <Ionicons name="chevron-forward" size={18} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.defaulterBtn} onPress={fetchDefaulters}>
          <Text style={styles.defaulterText}>Defaulters</Text>
        </TouchableOpacity>
      </View>

      {/* Custom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'monthly' && styles.activeTabItem]}
          onPress={() => setActiveTab('monthly')}
        >
          <Ionicons 
            name="calendar-outline" 
            size={20} 
            color={activeTab === 'monthly' ? '#FFFFFF' : theme.textLight} 
          />
          <Text style={[styles.tabText, activeTab === 'monthly' && styles.activeTabText]}>
            Monthly
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'occasional' && styles.activeTabItem]}
          onPress={() => setActiveTab('occasional')}
        >
          <Ionicons 
            name="gift-outline" 
            size={20} 
            color={activeTab === 'occasional' ? '#FFFFFF' : theme.textLight} 
          />
          <Text style={[styles.tabText, activeTab === 'occasional' && styles.activeTabText]}>
            Occasional
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'monthly' ? (
          <MonthlyCollectionTab 
            selectedMonth={selectedMonth} 
            onPreviewReceipt={handlePreviewReceipt}
          />
        ) : (
          <OccasionalCollectionTab 
            selectedMonth={selectedMonth} 
            onPreviewReceipt={handlePreviewReceipt}
          />
        )}
      </View>

      {/* Student Fee History Bottom Sheet */}
      <Modal visible={isHistoryVisible} animationType="slide" transparent={true} onRequestClose={() => setIsHistoryVisible(false)}>
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Fee History</Text>
                      <TouchableOpacity onPress={() => setIsHistoryVisible(false)}>
                          <Ionicons name="close-circle" size={32} color={theme.textLight} />
                      </TouchableOpacity>
                  </View>

                  {selectedStudent && (
                      <View style={styles.historyHeader}>
                          <Image 
                            source={selectedStudent.photo_url ? { uri: selectedStudent.photo_url } : require('../../../assets/images/favicon.png')} 
                            style={styles.historyAvatar} 
                          />
                          <View>
                              <Text style={styles.historyStudentName}>{selectedStudent.name}</Text>
                              <Text style={styles.historyStudentSub}>Class {selectedStudent.class}-{selectedStudent.section} • Roll: {selectedStudent.roll_no}</Text>
                          </View>
                      </View>
                  )}

                  {historyLoading ? (
                      <View style={{flex: 1, justifyContent: 'center'}}><ActivityIndicator size="large" color={theme.primary} /></View>
                  ) : (
                      <View style={styles.historyContainer}>
                          <View style={styles.statsRow}>
                              <View style={styles.statCard}>
                                  <Text style={styles.statLabel}>Paid</Text>
                                  <Text style={[styles.statValue, {color: theme.success}]}>
                                      ₹{studentHistory.filter(h => h.status === 'paid').reduce((acc, curr) => acc + parseFloat(curr.total_amount || 0), 0).toLocaleString()}
                                  </Text>
                              </View>
                              <View style={styles.statCard}>
                                  <Text style={styles.statLabel}>Arrears</Text>
                                  <Text style={[styles.statValue, {color: theme.danger}]}>
                                      ₹{totalArrears.toLocaleString()}
                                  </Text>
                              </View>
                          </View>

                          {/* Filter Section */}
                          <View style={styles.historyFilterSection}>
                              <Text style={styles.filterGroupLabel}>Filter by Type & Status</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                                  <TouchableOpacity 
                                    style={[styles.filterChip, historyFilterType === 'ALL' && styles.activeFilterChip]}
                                    onPress={() => setHistoryFilterType('ALL')}
                                  >
                                      <Text style={[styles.filterChipText, historyFilterType === 'ALL' && styles.activeFilterChipText]}>All Types</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity 
                                    style={[styles.filterChip, historyFilterType === 'monthly' && styles.activeFilterChip]}
                                    onPress={() => setHistoryFilterType('monthly')}
                                  >
                                      <Text style={[styles.filterChipText, historyFilterType === 'monthly' && styles.activeFilterChipText]}>Monthly</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity 
                                    style={[styles.filterChip, historyFilterType === 'occasional' && styles.activeFilterChip]}
                                    onPress={() => setHistoryFilterType('occasional')}
                                  >
                                      <Text style={[styles.filterChipText, historyFilterType === 'occasional' && styles.activeFilterChipText]}>Occasional</Text>
                                  </TouchableOpacity>
                                  
                                  <View style={{width: 1, height: 20, backgroundColor: theme.border, marginHorizontal: 10, alignSelf: 'center'}} />

                                  <TouchableOpacity 
                                    style={[styles.filterChip, historyFilterStatus === 'ALL' && styles.activeFilterChip]}
                                    onPress={() => setHistoryFilterStatus('ALL')}
                                  >
                                      <Text style={[styles.filterChipText, historyFilterStatus === 'ALL' && styles.activeFilterChipText]}>All Status</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity 
                                    style={[styles.filterChip, historyFilterStatus === 'paid' && styles.activeFilterChip]}
                                    onPress={() => setHistoryFilterStatus('paid')}
                                  >
                                      <Text style={[styles.filterChipText, historyFilterStatus === 'paid' && styles.activeFilterChipText]}>Paid Only</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity 
                                    style={[styles.filterChip, historyFilterStatus === 'unpaid' && styles.activeFilterChip]}
                                    onPress={() => setHistoryFilterStatus('unpaid')}
                                  >
                                      <Text style={[styles.filterChipText, historyFilterStatus === 'unpaid' && styles.activeFilterChipText]}>Unpaid Only</Text>
                                  </TouchableOpacity>
                              </ScrollView>

                              <Text style={[styles.filterGroupLabel, {marginTop: 15}]}>Filter by Month</Text>
                              <View style={{flexDirection: 'row', gap: 10}}>
                                  <TouchableOpacity 
                                    style={[styles.filterChip, historyFilterMonth === 'ALL' && styles.activeFilterChip]}
                                    onPress={() => setHistoryFilterMonth('ALL')}
                                  >
                                      <Text style={[styles.filterChipText, historyFilterMonth === 'ALL' && styles.activeFilterChipText]}>All Months</Text>
                                  </TouchableOpacity>
                                  
                                  <TouchableOpacity 
                                    style={[styles.filterChip, historyFilterMonth !== 'ALL' && styles.activeFilterChip]}
                                    onPress={() => setShowHistoryMonthPicker(true)}
                                  >
                                      <Ionicons name="calendar-outline" size={16} color={historyFilterMonth !== 'ALL' ? "#fff" : theme.primary} />
                                      <Text style={[styles.filterChipText, historyFilterMonth !== 'ALL' && styles.activeFilterChipText]}>
                                          {historyFilterMonth === 'ALL' ? 'Select Month' : historyFilterMonth}
                                      </Text>
                                  </TouchableOpacity>
                              </View>
                          </View>
                          
                          <FlatList 
                            data={filteredHistory}
                            keyExtractor={(item, index) => index.toString()}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const isPaid = item.status === 'paid';
                                return (
                                    <View style={styles.historyItem}>
                                        <View style={styles.historyItemTop}>
                                            <View>
                                                <Text style={styles.historyMonth}>{item.month_year}</Text>
                                                <Text style={styles.historyType}>{item.fee_type}</Text>
                                                {item.fee_type === 'occasional' && item.title_summary && (
                                                    <Text style={styles.historySummary} numberOfLines={1}>
                                                        {item.title_summary}
                                                    </Text>
                                                )}
                                            </View>
                                            <View style={{alignItems: 'flex-end'}}>
                                                <Text style={[styles.historyAmount, {color: isPaid ? theme.text : theme.danger}]}>
                                                    ₹{parseFloat(item.total_amount || 0).toLocaleString()}
                                                </Text>
                                                <View style={[styles.historyStatusBadge, {backgroundColor: isPaid ? theme.success + '15' : theme.danger + '15'}]}>
                                                    <Ionicons name={isPaid ? "checkmark-circle" : "alert-circle"} size={12} color={isPaid ? theme.success : theme.danger} />
                                                    <Text style={[styles.historyStatusText, {color: isPaid ? theme.success : theme.danger}]}>
                                                        {item.status.toUpperCase()}
                                                    </Text>
                                                </View>

                                                {!isPaid && (
                                                    <TouchableOpacity 
                                                        style={styles.payBtnSmall}
                                                        onPress={() => handleMarkPaid(item)}
                                                    >
                                                        <Text style={styles.payBtnTextSmall}>COLLECT</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>

                                        {isPaid && (
                                            <View style={styles.historyDetails}>
                                                <View style={styles.detailRow}>
                                                    <Text style={styles.detailLabel}>Paid On:</Text>
                                                    <Text style={styles.detailValue}>{item.paid_at ? new Date(item.paid_at).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'}) : 'N/A'}</Text>
                                                </View>
                                                <View style={styles.detailRow}>
                                                    <Text style={styles.detailLabel}>Method:</Text>
                                                    <Text style={styles.detailValue}>{item.payment_id?.startsWith('COUNTER') ? 'Counter Cash' : 'Online'}</Text>
                                                </View>
                                                {item.collected_by && (
                                                    <View style={styles.detailRow}>
                                                        <Text style={styles.detailLabel}>Collected By:</Text>
                                                        <Text style={styles.detailValue}>{item.collected_by}</Text>
                                                    </View>
                                                )}

                                                {/* Receipt Actions */}
                                                <View style={styles.receiptActions}>
                                                    <TouchableOpacity 
                                                        style={styles.receiptBtnIcon}
                                                        onPress={() => handleViewReceiptInternal(item)}
                                                        disabled={isReceiptGenerating}
                                                    >
                                                        {isReceiptGenerating ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="eye-outline" size={18} color={theme.primary} />}
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={styles.receiptBtnIcon}
                                                        onPress={() => handleShareReceiptInternal(item)}
                                                        disabled={isReceiptGenerating}
                                                    >
                                                        {isReceiptGenerating ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="share-outline" size={18} color={theme.primary} />}
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                );
                            }}
                            ListEmptyComponent={() => (
                                <View style={{alignItems: 'center', marginTop: 40, paddingBottom: 100}}>
                                    <Ionicons name="filter-outline" size={40} color={theme.border} />
                                    <Text style={{color: theme.textLight, marginTop: 10}}>No matching records found</Text>
                                </View>
                            )}
                          />
                      </View>
                  )}
              </View>
          </View>
      </Modal>

      {/* Defaulter Modal */}
      <Modal visible={isDefaulterVisible} animationType="slide" transparent={true} onRequestClose={() => setIsDefaulterVisible(false)}>
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                      <View>
                          <Text style={styles.modalTitle}>Fee Defaulters</Text>
                          <Text style={{ fontSize: 12, color: theme.textLight }}>{selectedMonth}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setIsDefaulterVisible(false)}>
                          <Ionicons name="close-circle" size={32} color={theme.textLight} />
                      </TouchableOpacity>
                  </View>

                  <View style={styles.filterContainer}>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: expandedFilter ? 15 : 0 }}>
                      <TouchableOpacity 
                        style={[styles.filterDropdown, expandedFilter === 'class' && styles.activeDropdown]}
                        onPress={() => setExpandedFilter(expandedFilter === 'class' ? null : 'class')}
                      >
                        <Text style={styles.filterLabel}>Class: <Text style={{color: theme.primary}}>{filterClass === 'ALL' ? 'All' : filterClass}</Text></Text>
                        <Ionicons name={expandedFilter === 'class' ? "chevron-up" : "chevron-down"} size={16} color={theme.textLight} />
                      </TouchableOpacity>

                      <TouchableOpacity 
                        style={[
                          styles.filterDropdown, 
                          filterClass === 'ALL' && { opacity: 0.5 },
                          expandedFilter === 'section' && styles.activeDropdown
                        ]}
                        onPress={() => {
                          if (filterClass === 'ALL') {
                            Toast.show({ type: 'info', text1: 'Select Class First', text2: 'Please pick a class to filter by section' });
                            return;
                          }
                          setExpandedFilter(expandedFilter === 'section' ? null : 'section');
                        }}
                      >
                        <Text style={styles.filterLabel}>Section: <Text style={{color: theme.primary}}>{filterSection === 'ALL' ? 'All' : filterSection}</Text></Text>
                        <Ionicons name={expandedFilter === 'section' ? "chevron-up" : "chevron-down"} size={16} color={theme.textLight} />
                      </TouchableOpacity>
                    </View>

                    {expandedFilter === 'class' && (
                      <View style={styles.optionsContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {availableFilters.classes.map(cls => (
                            <TouchableOpacity 
                              key={`cls-${cls}`} 
                              style={[styles.chip, filterClass === cls && styles.activeChip]} 
                              onPress={() => { setFilterClass(cls); setFilterSection('ALL'); setExpandedFilter(null); }}
                            >
                              <Text style={[styles.chipText, filterClass === cls && styles.activeChipText]}>
                                {cls === 'ALL' ? 'All Classes' : `Class ${cls}`}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}

                    {expandedFilter === 'section' && (
                      <View style={styles.optionsContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {availableFilters.sections.map(sec => (
                            <TouchableOpacity 
                              key={`sec-${sec}`} 
                              style={[styles.chip, filterSection === sec && styles.activeChip]} 
                              onPress={() => { setFilterSection(sec); setExpandedFilter(null); }}
                            >
                              <Text style={[styles.chipText, filterSection === sec && styles.activeChipText]}>
                                {sec === 'ALL' ? 'All Sections' : `Section ${sec}`}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  {defaulterLoading ? (
                      <View style={{flex: 1, justifyContent: 'center'}}><ActivityIndicator size="large" color={theme.primary} /></View>
                  ) : (
                      <FlatList
                          data={filteredDefaulters}
                          keyExtractor={(item) => item.student_id.toString()}
                          renderItem={({ item }) => (
                              <View style={styles.studentItem}>
                                  <Image 
                                      source={item.photo_url ? { uri: item.photo_url } : require('../../../assets/images/favicon.png')} 
                                      style={styles.studentImage} 
                                  />
                                  <View style={styles.studentInfo}>
                                      <Text style={styles.studentName}>{item.name}</Text>
                                      <Text style={[styles.studentSub, { marginTop: 4 }]}>Class {item.class}-{item.section} • Roll: {item.roll_no}</Text>
                                      {activeTab === 'occasional' && item.fees_breakdown && (
                                        <Text style={{ fontSize: 10, color: theme.textLight, marginTop: 2 }}>
                                          {item.fees_breakdown.map((f: any) => f.fee_name).join(', ')}
                                        </Text>
                                      )}
                                  </View>
                                  <View style={{alignItems: 'flex-end'}}>
                                      <Text style={styles.amountText}>₹{parseFloat(item.total_amount || 0).toLocaleString()}</Text>
                                      <Text style={{fontSize: 10, color: theme.danger, fontWeight: '700'}}>PENDING</Text>
                                  </View>
                              </View>
                          )}
                          ListEmptyComponent={() => (
                              <View style={{alignItems: 'center', marginTop: 60}}>
                                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.success + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 15 }}>
                                      <Ionicons name="checkmark-circle" size={50} color={theme.success} />
                                  </View>
                                  <Text style={{color: theme.text, fontSize: 18, fontWeight: '900'}}>No Students Left</Text>
                                  <Text style={{color: theme.textLight, marginTop: 5}}>All fees are paid for this selection.</Text>
                              </View>
                          )}
                      />
                  )}
              </View>
          </View>
      </Modal>

      {showHistoryMonthPicker && (
          <DateTimePicker
            value={new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleHistoryMonthChange}
          />
      )}

      {selectedFeeData && (
        <FeeReceiptModal
          visible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          feeData={selectedFeeData}
          institute={instituteInfo}
          student={selectedStudentForReceipt}
          onShare={handleShareReceipt}
        />
      )}
    </View>
  );
}