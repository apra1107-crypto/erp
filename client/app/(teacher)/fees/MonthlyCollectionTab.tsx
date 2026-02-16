import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, Image, Dimensions } from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../../../constants/Config';
import Toast from 'react-native-toast-message';
import { generateFeeReceipt, previewFeeReceipt } from '../../../utils/feeReceiptGenerator';

interface MonthlyCollectionTabProps {
    selectedMonth: string;
    onPreviewReceipt: (fee: any, student: any) => void;
}

const MonthlyCollectionTab = ({ selectedMonth, onPreviewReceipt }: MonthlyCollectionTabProps) => {
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [trackingData, setTrackingData] = useState<any[]>([]);
    const [isPublished, setIsPublished] = useState(false);
    const [isPublishModalVisible, setIsPublishModalVisible] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAddColumnModalVisible, setIsAddColumnModalVisible] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');

    // Details Modal State
    const [isDetailsVisible, setIsDetailsVisible] = useState(false);
    const [selectedClass, setSelectedClass] = useState<string | null>(null);
    const [studentFees, setStudentFees] = useState<any[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [instituteInfo, setInstituteInfo] = useState<any>(null);
    const [isReceiptGenerating, setIsReceiptGenerating] = useState(false);

    // Fee Structure Editor State
    const [feeColumns, setFeeColumns] = useState<string[]>(['Tuition', 'Transport']);
    const [classFees, setClassFees] = useState<any>({});
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);

    // Auth Helpers
    const getToken = async () => {
        return await AsyncStorage.getItem('token') || await AsyncStorage.getItem('teacherToken');
    };

    const getUserData = async () => {
        const data = await AsyncStorage.getItem('userData') || await AsyncStorage.getItem('teacherData');
        return data ? JSON.parse(data) : null;
    };

    useEffect(() => {
        fetchData();
    }, [selectedMonth]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const user = await getUserData();
            if (!user) return;
            
            setInstituteInfo(user);
            const instId = user.institute_id || user.id;

            const trackingRes = await axios.get(
                `${API_ENDPOINTS.FEES}/tracking/${instId}?month=${selectedMonth}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setTrackingData(trackingRes.data);

            const studentListRes = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/student/list`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const students = studentListRes.data.students || [];
            const uniqueClasses = Array.from(new Set(students.map((s: any) => s.class))).sort() as string[];
            setAvailableClasses(uniqueClasses);

            const configRes = await axios.get(
                `${API_ENDPOINTS.FEES}/config/${instId}?month=${selectedMonth}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (configRes.data && !configRes.data.isNew) {
                setFeeColumns(configRes.data.columns || ['Tuition', 'Transport']);
                setClassFees(configRes.data.class_data || {});
                setIsPublished(true);
            } else {
                setIsPublished(false);
                const initialFees: any = {};
                uniqueClasses.forEach(cls => { initialFees[cls] = {}; });
                setClassFees(initialFees);
            }
        } catch (error) {
            console.error('Error fetching monthly data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchClassDetails = async (className: string) => {
        try {
            setDetailsLoading(true);
            setSelectedClass(className);
            setIsDetailsVisible(true);
            const token = await getToken();
            const user = await getUserData();
            const instId = user.institute_id || user.id;
            
            const res = await axios.get(
                `${API_ENDPOINTS.FEES}/section/${instId}/${className}/ALL?month=${selectedMonth}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setStudentFees(res.data);
        } catch (error) {
            console.error('Error fetching class details:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load student list' });
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleMarkPaid = async (student: any) => {
        Alert.alert(
            "Confirm Payment",
            `Mark ₹${student.total_amount} as paid for ${student.name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                    onPress: async () => {
                        try {
                            const token = await getToken();
                            const user = await getUserData();
                            const instId = user.id || user.institute_id;

                            await axios.put(
                                `${API_ENDPOINTS.FEES}/manual-pay/${student.fee_record_id}`,
                                {
                                    instituteId: instId,
                                    studentId: student.id,
                                    month_year: selectedMonth,
                                    collectedBy: user.principal_name || user.name
                                },
                                { headers: { Authorization: `Bearer ${token}` } }
                            );

                            Toast.show({ type: 'success', text1: 'Success', text2: 'Payment recorded successfully' });
                            fetchClassDetails(selectedClass!);
                            fetchData();
                        } catch (error) {
                            console.error('Payment error:', error);
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to record payment' });
                        }
                    }
                }
            ]
        );
    };

    const handleViewReceipt = async (student: any) => {
        if (isReceiptGenerating) return;
        try {
            setIsReceiptGenerating(true);
            const feeData = {
                ...student,
                month_year: selectedMonth
            };
            await generateFeeReceipt(feeData, instituteInfo, student);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to generate receipt' });
        } finally {
            setIsReceiptGenerating(false);
        }
    };

    const handlePreviewReceipt = (student: any) => {
        const feeData = {
            ...student,
            month_year: selectedMonth
        };
        onPreviewReceipt(feeData, student);
    };

    const handlePublish = async () => {
        try {
            setIsSubmitting(true);
            const token = await getToken();
            const user = await getUserData();
            const instId = user.id || user.institute_id;

            await axios.post(
                `${API_ENDPOINTS.FEES}/publish/${instId}`,
                {
                    month_year: selectedMonth,
                    columns: feeColumns,
                    class_data: classFees
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            Toast.show({ 
                type: 'success', 
                text1: 'Success', 
                text2: `Fees published for ${selectedMonth}` 
            });
            setIsPublishModalVisible(false);
            fetchData();
        } catch (error) {
            console.error('Publish error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to publish fees' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateFeeAmount = (cls: string, col: string, amt: string) => {
        setClassFees((prev: any) => ({
            ...prev,
            [cls]: { ...prev[cls], [col]: amt }
        }));
    };

    const addColumn = () => {
        setIsAddColumnModalVisible(true);
    };

    const handleConfirmAddColumn = () => {
        const name = newColumnName.trim();
        if (name && !feeColumns.includes(name)) {
            setFeeColumns([...feeColumns, name]);
            setNewColumnName('');
            setIsAddColumnModalVisible(false);
        } else if (!name) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter a column name' });
        } else {
            Toast.show({ type: 'info', text1: 'Info', text2: 'Column already exists' });
        }
    };

    const summary = useMemo(() => {
        const total = trackingData.reduce((acc, curr) => acc + parseFloat(curr.total_expected || 0), 0);
        const collected = trackingData.reduce((acc, curr) => acc + parseFloat(curr.total_collected || 0), 0);
        return { total, collected };
    }, [trackingData]);

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, padding: 16 },
        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        flashCard: {
            backgroundColor: theme.card,
            padding: 20,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.05,
            shadowRadius: 10,
            elevation: 5,
        },
        cardTitle: { color: theme.textLight, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
        cardValue: { color: theme.text, fontSize: 24, fontWeight: '900' },
        collectedValue: { color: theme.primary, fontSize: 24, fontWeight: '900' },
        classItem: {
            backgroundColor: theme.card,
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.3 : 0.05,
            shadowRadius: 8,
            elevation: 3,
        },
        className: { fontSize: 16, fontWeight: '800', color: theme.text },
        classStats: { fontSize: 13, color: theme.textLight, marginLeft: 4 },
        classAmount: { fontSize: 16, fontWeight: '800', color: theme.primary },
        emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
        emptyText: { color: theme.textLight, fontSize: 16, textAlign: 'center', marginTop: 16, fontWeight: '600' },
        fab: {
            position: 'absolute',
            bottom: 16,
            right: 16,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.primary,
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 8,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
        },
        
        // Modal Styles
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
        modalContent: {
            backgroundColor: theme.card,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            height: '92%',
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -5 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            elevation: 20,
        },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
        modalTitle: { fontSize: 24, fontWeight: '900', color: theme.text },
        closeBtn: { padding: 8, borderRadius: 20, backgroundColor: theme.background },
        
        // Sections
        sectionContainer: { marginBottom: 30 },
        sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4 },
        sectionSubtitle: { fontSize: 13, color: theme.textLight, marginBottom: 15 },

        // Chips
        chipWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
        cleanChip: { 
            backgroundColor: theme.background,
            paddingHorizontal: 12, 
            paddingVertical: 8, 
            borderRadius: 12, 
            borderWidth: 1, 
            borderColor: theme.border, 
            flexDirection: 'row', 
            alignItems: 'center' 
        },
        cleanChipText: { fontSize: 14, fontWeight: '600', color: theme.text },
        addCleanChip: { 
            paddingHorizontal: 12, 
            paddingVertical: 8, 
            borderRadius: 12, 
            borderWidth: 1, 
            borderColor: theme.primary, 
            borderStyle: 'dashed',
            flexDirection: 'row', 
            alignItems: 'center',
            backgroundColor: theme.primary + '05'
        },
        addCleanChipText: { fontSize: 14, fontWeight: '700', color: theme.primary, marginLeft: 4 },

        // Table
        tableScroll: { marginHorizontal: -24, paddingHorizontal: 24 },
        cleanTableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 10, marginBottom: 5 },
        cleanHeaderCell: { fontSize: 12, fontWeight: '700', color: theme.textLight, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
        cleanTableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
        classCell: { width: 60, justifyContent: 'center', alignItems: 'center' },
        classCellText: { fontSize: 15, fontWeight: '700', color: theme.text },
        cleanInput: { 
            backgroundColor: theme.background,
            height: 40, 
            borderRadius: 8, 
            borderWidth: 1, 
            borderColor: theme.border, 
            paddingHorizontal: 5, 
            color: theme.text, 
            fontWeight: '600', 
            textAlign: 'center',
            fontSize: 14
        },

        // Buttons
        cleanPublishBtn: { 
            backgroundColor: theme.primary, 
            height: 52, 
            borderRadius: 14, 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginTop: 10,
        },
        cleanPublishBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

        // Common
        columnInput: { 
            backgroundColor: theme.background, 
            height: 56, 
            borderRadius: 16, 
            borderWidth: 1, 
            borderColor: theme.border, 
            paddingHorizontal: 16, 
            color: theme.text, 
            fontWeight: '700',
            fontSize: 16,
            marginBottom: 10
        },
        publishBtn: { backgroundColor: theme.primary, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
        publishBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },

        // Student List Styles
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
        payBtn: { backgroundColor: theme.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, shadowColor: theme.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
        payBtnText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
        receiptBtnCompact: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.primary + '20' },
        paidBadge: { backgroundColor: theme.success + '15', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.success + '20' },
        paidText: { color: theme.success, fontSize: 11, fontWeight: '900', marginLeft: 4, letterSpacing: 0.5 }
    }), [theme, isDark]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {isPublished ? (
                <>
                    <View style={styles.flashCard}>
                        <View>
                            <Text style={styles.cardTitle}>Total Expected</Text>
                            <Text style={styles.cardValue}>₹{summary.total.toLocaleString()}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.cardTitle}>Total Collected</Text>
                            <Text style={styles.collectedValue}>₹{summary.collected.toLocaleString()}</Text>
                        </View>
                    </View>

                    <FlatList
                        data={trackingData}
                        keyExtractor={(item) => item.class}
                        renderItem={({ item }) => {
                            const isFullyPaid = parseInt(item.paid_count) === parseInt(item.total_students);
                            return (
                                <TouchableOpacity style={styles.classItem} onPress={() => fetchClassDetails(item.class)}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.className}>Class {item.class}</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <Ionicons name="people-outline" size={12} color={theme.textLight} />
                                                <Text style={styles.classStats}>
                                                    {item.paid_count} / {item.total_students} Students Paid
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={styles.classAmount}>₹{parseFloat(item.total_collected || 0).toLocaleString()}</Text>
                                            <Text style={{ fontSize: 11, color: theme.textLight }}>Expected ₹{parseFloat(item.total_expected || 0).toLocaleString()}</Text>
                                        </View>
                                    </View>
                                    
                                    {/* Progress Bar */}
                                    <View style={{ height: 4, backgroundColor: theme.border + '50', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
                                        <View 
                                            style={{ 
                                                height: '100%', 
                                                backgroundColor: isFullyPaid ? theme.success : theme.primary, 
                                                width: `${(item.paid_count / item.total_students) * 100}%` 
                                            }} 
                                        />
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                        showsVerticalScrollIndicator={false}
                    />
                </>
            ) : (
                <View style={styles.emptyState}>
                    <Ionicons name="document-text-outline" size={80} color={theme.primary + '30'} />
                    <Text style={styles.emptyText}>No fee structure published for {selectedMonth}.</Text>
                    <Text style={{ color: theme.textLight, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                        Define and publish the monthly fees for each class to start tracking collections.
                    </Text>
                </View>
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => setIsPublishModalVisible(true)}
            >
                <Ionicons name={isPublished ? "create" : "add"} size={30} color="#fff" />
            </TouchableOpacity>

            {/* Publish Modal */}
            <Modal visible={isPublishModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsPublishModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
                        style={{flex: 1, justifyContent: 'flex-end'}}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 40}
                    >
                    <View style={[styles.modalContent, { height: undefined, maxHeight: '95%' }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Publish Fees</Text>
                                <Text style={{fontSize: 14, color: theme.textLight, marginTop: 2}}>{selectedMonth}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsPublishModalVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView 
                            showsVerticalScrollIndicator={false} 
                            contentContainerStyle={{paddingBottom: Platform.OS === 'ios' ? 120 : 180}}
                            keyboardShouldPersistTaps="handled"
                        >
                            
                            {/* Fee Components Section */}
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>Fee Components</Text>
                                <Text style={styles.sectionSubtitle}>Add or remove fee types for this month.</Text>
                                
                                <View style={styles.chipWrapper}>
                                    {feeColumns.map((col, idx) => (
                                        <View key={idx} style={styles.cleanChip}>
                                            <Text style={styles.cleanChipText}>{col}</Text>
                                            <TouchableOpacity 
                                                style={{marginLeft: 8}}
                                                onPress={() => setFeeColumns(feeColumns.filter(c => c !== col))}
                                            >
                                                <Ionicons name="close-circle" size={16} color={theme.textLight} />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    <TouchableOpacity style={styles.addCleanChip} onPress={addColumn}>
                                        <Ionicons name="add" size={18} color={theme.primary} />
                                        <Text style={styles.addCleanChipText}>Add</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Amount Table Section */}
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>Amounts</Text>
                                <Text style={styles.sectionSubtitle}>Set the fee amount for each class.</Text>

                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
                                    <View>
                                        {/* Table Header */}
                                        <View style={styles.cleanTableHeader}>
                                            <Text style={[styles.cleanHeaderCell, {width: 60}]}>Class</Text>
                                            {feeColumns.map(col => (
                                                <Text key={col} style={[styles.cleanHeaderCell, {width: 100}]}>{col}</Text>
                                            ))}
                                        </View>
                                        
                                        {/* Table Body */}
                                        {availableClasses.map((cls, index) => (
                                            <View key={cls} style={styles.cleanTableRow}>
                                                <View style={styles.classCell}>
                                                    <Text style={styles.classCellText}>{cls}</Text>
                                                </View>
                                                {feeColumns.map(col => (
                                                    <View key={col} style={{width: 100, paddingHorizontal: 4}}>
                                                        <TextInput 
                                                            style={styles.cleanInput} 
                                                            keyboardType="numeric" 
                                                            placeholder="0" 
                                                            placeholderTextColor={theme.textLight + '50'} 
                                                            value={classFees[cls]?.[col] || ''} 
                                                            onChangeText={(amt) => updateFeeAmount(cls, col, amt)} 
                                                            selectTextOnFocus
                                                        />
                                                    </View>
                                                ))}
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>

                            <TouchableOpacity 
                                style={[styles.cleanPublishBtn, isSubmitting && {opacity: 0.7}]} 
                                onPress={handlePublish} 
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.cleanPublishBtnText}>Publish Fees</Text>
                                )}
                            </TouchableOpacity>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Details Modal */}
            <Modal visible={isDetailsVisible} animationType="fade" transparent={true} onRequestClose={() => setIsDetailsVisible(false)}>
                <View style={[styles.modalOverlay, {backgroundColor: 'rgba(0,0,0,0.7)'}]}>
                    <View style={[styles.modalContent, {height: '85%'}]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Class {selectedClass}</Text>
                                <Text style={[styles.classStats, { marginTop: 0 }]}>{selectedMonth}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsDetailsVisible(false)}>
                                <Ionicons name="close-circle" size={32} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>

                        {/* Fee Structure Display */}
                        {selectedClass && classFees[selectedClass] && (
                            <View style={{ backgroundColor: theme.primary + '10', padding: 12, borderRadius: 12, marginBottom: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                {Object.entries(classFees[selectedClass]).map(([name, amt]: [string, any]) => (
                                    <View key={name} style={{ backgroundColor: theme.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.primary + '20' }}>
                                        <Text style={{ fontSize: 11, color: theme.textLight }}>{name}</Text>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: theme.primary }}>₹{amt}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {detailsLoading ? (
                            <View style={{flex: 1, justifyContent: 'center'}}><ActivityIndicator size="large" color={theme.primary} /></View>
                        ) : (
                            <FlatList
                                data={studentFees}
                                keyExtractor={(item) => item.id.toString()}
                                renderItem={({ item }) => (
                                    <View style={styles.studentItem}>
                                        <Image 
                                            source={item.photo_url ? { uri: item.photo_url } : require('../../../assets/images/favicon.png')} 
                                            style={styles.studentImage} 
                                        />
                                        <View style={styles.studentInfo}>
                                            <Text style={[styles.studentName, { marginBottom: 6 }]} numberOfLines={1}>{item.name}</Text>
                                            <Text style={styles.studentSub}>Roll: {item.roll_no} • Sec: {item.section}</Text>
                                            {item.transport_facility && <Text style={{fontSize: 10, color: '#FF9800', fontWeight: '800', marginTop: 3}}>🚐 Transport User</Text>}
                                        </View>
                                        <View style={{ alignItems: 'flex-end', minWidth: 95 }}>
                                            <Text style={{ fontWeight: '900', fontSize: 16, color: theme.text, marginBottom: 6 }}>
                                                ₹{parseFloat(item.total_amount || 0).toLocaleString()}
                                            </Text>
                                            {item.status === 'paid' ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <View style={styles.paidBadge}>
                                                        <Ionicons name="checkmark-done" size={12} color={theme.success} />
                                                        <Text style={styles.paidText}>PAID</Text>
                                                    </View>
                                                    <TouchableOpacity 
                                                        style={[styles.receiptBtnCompact, { marginLeft: 8 }]} 
                                                        onPress={() => handlePreviewReceipt(item)}
                                                    >
                                                        <Ionicons name="eye-outline" size={18} color={theme.primary} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity 
                                                        style={[styles.receiptBtnCompact, { marginLeft: 8 }, isReceiptGenerating && { opacity: 0.5 }]} 
                                                        onPress={() => handleViewReceipt(item)}
                                                        disabled={isReceiptGenerating}
                                                    >
                                                        {isReceiptGenerating ? (
                                                            <ActivityIndicator size="small" color={theme.primary} />
                                                        ) : (
                                                            <Ionicons name="share-outline" size={18} color={theme.primary} />
                                                        )}
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <TouchableOpacity style={styles.payBtn} onPress={() => handleMarkPaid(item)}>
                                                    <Text style={styles.payBtnText}>COLLECT</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                )}
                                ListEmptyComponent={() => (
                                    <View style={{alignItems: 'center', marginTop: 40}}>
                                        <Text style={{color: theme.textLight}}>No students found in this class.</Text>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Add Column Modal */}
            <Modal visible={isAddColumnModalVisible} animationType="fade" transparent={true} onRequestClose={() => setIsAddColumnModalVisible(false)}>
                <View style={[styles.modalOverlay, {backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20}]}>
                    <View style={[styles.modalContent, {height: 'auto', borderRadius: 20}]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Fee Component</Text>
                            <TouchableOpacity onPress={() => setIsAddColumnModalVisible(false)}>
                                <Ionicons name="close-circle" size={32} color={theme.textLight} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{color: theme.textLight, marginBottom: 15, fontWeight: '600'}}>Enter the name of the new fee component (e.g. Admission Fee, Sports Fee).</Text>
                        <TextInput 
                            style={styles.columnInput} 
                            placeholder="Component Name" 
                            placeholderTextColor={theme.textLight} 
                            value={newColumnName}
                            onChangeText={setNewColumnName}
                            autoFocus={true}
                        />
                        <TouchableOpacity style={styles.publishBtn} onPress={handleConfirmAddColumn}>
                            <Text style={styles.publishBtnText}>Add Component</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default MonthlyCollectionTab;