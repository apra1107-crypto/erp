import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, StatusBar, Modal, TextInput, Alert, Switch, Platform, Animated, Easing, RefreshControl, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';
import { getFullImageUrl } from '../../../utils/imageHelper';
import Toast from 'react-native-toast-message';

export default function PromotionScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isDark, theme } = useTheme();

    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [filterClass, setFilterClass] = useState<string>('');
    const [filterSection, setFilterSection] = useState<string>('');
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [targetSessionId, setTargetSessionId] = useState<any>(null);
    const [showTargetPicker, setShowTargetPicker] = useState(false);

    // Promoted Tracking
    const [promotedCodes, setPromotedCodes] = useState<string[]>([]);

    // Promotion State
    const [promotionModalVisible, setPromotionModalVisible] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [promotionData, setPromotionData] = useState({
        newClass: '',
        newSection: '',
        newRollNo: '',
        targetSessionId: '',
        monthlyFees: '',
        transportFacility: false,
        transportFees: ''
    });
    const [promoting, setPromoting] = useState(false);

    // Toggle Animation
    const switchAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
        Animated.timing(switchAnim, {
            toValue: promotionData.transportFacility ? 1 : 0,
            duration: 250,
            useNativeDriver: false,
        }).start();
    }, [promotionData.transportFacility]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchClasses(), fetchSessions()]);
        setRefreshing(false);
    };

    const resetFilters = () => {
        setFilterClass('');
        setSections([]);
        setFilterSection('');
        setFilteredStudents(allStudents);
    };

    useEffect(() => {
        fetchClasses();
        fetchSessions();
    }, []);

    useEffect(() => {
        if (targetSessionId) {
            fetchPromotedTracking(targetSessionId);
        }
    }, [targetSessionId]);

    const fetchSessions = async () => {
        try {
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const response = await axios.get(API_ENDPOINTS.ACADEMIC_SESSIONS, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const allSessions = response.data;
            const currentSource = storedSessionId ? parseInt(storedSessionId) : (allSessions.find((s: any) => s.is_active)?.id || allSessions[0]?.id);
            
            // Potential targets are any session EXCEPT the current source one
            const potentialTargets = allSessions.filter((s: any) => s.id !== currentSource);
            setSessions(potentialTargets);
            
            if (potentialTargets.length > 0 && !targetSessionId) {
                setTargetSessionId(potentialTargets[0].id);
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        }
    };

    const fetchPromotedTracking = async (sessionId: any) => {
        if (!sessionId) return;
        try {
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/students-by-session/${sessionId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPromotedCodes(response.data.codes || []);
        } catch (e) {
            console.error('Error fetching promotion tracking:', e);
        }
    };

    const fetchClasses = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userData = await AsyncStorage.getItem('userData');
            const sessionId = storedSessionId || (userData ? JSON.parse(userData).current_session_id : null);

            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/student/list`,
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    }
                }
            );

            const data = response.data.students || [];
            setAllStudents(data);
            setFilteredStudents(data);
            const uniqueClasses = [...new Set(data.map((s: any) => s.class))].sort();
            setClasses(uniqueClasses as string[]);
        } catch (error) {
            console.error('Error fetching classes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClassFilter = (cls: string) => {
        if (filterClass === cls) {
            resetFilters();
        } else {
            setFilterClass(cls);
            const classStudents = allStudents.filter((s: any) => s.class === cls);
            const uniqueSections = [...new Set(classStudents.map((s: any) => s.section))].sort();
            setSections(uniqueSections as string[]);
            setFilterSection('');
            setFilteredStudents(classStudents);
        }
    };

    const handleSectionFilter = (sec: string) => {
        if (filterSection === sec) {
            setFilterSection('');
            const classStudents = allStudents.filter((s: any) => s.class === filterClass);
            setFilteredStudents(classStudents);
        } else {
            setFilterSection(sec);
            const sectionStudents = allStudents.filter((s: any) => s.class === filterClass && s.section === sec);
            setFilteredStudents(sectionStudents);
        }
    };

    const handlePromotePress = (student: any) => {
        setSelectedStudent(student);
        setPromotionData({
            newClass: String(parseInt(student.class) + 1) || student.class,
            newSection: student.section,
            newRollNo: student.roll_no,
            targetSessionId: targetSessionId || '',
            monthlyFees: String(student.monthly_fees || ''),
            transportFacility: !!student.transport_facility,
            transportFees: String(student.transport_fees || '')
        });
        setPromotionModalVisible(true);
    };

    const handlePromoteSubmit = async () => {
        if (!promotionData.targetSessionId || !promotionData.newClass || !promotionData.newSection || !promotionData.newRollNo || !promotionData.monthlyFees) {
            Alert.alert("Error", "Please fill all promotion details (including Monthly Fees)");
            return;
        }

        try {
            setPromoting(true);
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            await axios.post(API_ENDPOINTS.PROMOTION + '/student', {
                studentId: selectedStudent.id,
                ...promotionData
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            Toast.show({ type: 'success', text1: 'Promoted', text2: `${selectedStudent.name} promoted successfully` });
            setPromotionModalVisible(false);
            // Refresh tracking for global target
            fetchPromotedTracking(targetSessionId);
        } catch (error: any) {
            const msg = error.response?.data?.message || "Failed to promote student";
            Alert.alert("Error", msg);
        } finally {
            setPromoting(false);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'transparent',
        },
        title: { fontSize: 20, fontWeight: 'bold', marginLeft: 15, color: theme.text },
        filterBar: { paddingHorizontal: 20, paddingBottom: 10, backgroundColor: 'transparent' },
        filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
        clearText: { color: theme.primary, fontSize: 12, fontWeight: 'bold' },
        filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: theme.border },
        filterText: { fontSize: 12, color: theme.text },
        card: {
            backgroundColor: theme.card, borderRadius: 16, padding: 15, marginBottom: 12, marginHorizontal: 20,
            flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5
        },
        avatarContainer: {
            marginRight: 15,
        },
        studentImg: {
            width: 50,
            height: 50,
            borderRadius: 25,
        },
        placeholderIcon: {
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: theme.primary,
            justifyContent: 'center',
            alignItems: 'center',
        },
        studentInfo: { flex: 1 },
        studentName: { fontSize: 16, fontWeight: '700', color: theme.text },
        studentMeta: { fontSize: 13, color: theme.textLight, marginTop: 4 },
        promoteBtn: { 
            flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary + '15',
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 
        },
        promoteBtnText: { fontSize: 12, fontWeight: 'bold', color: theme.primary, marginLeft: 6 },
        promotedBadge: {
            flexDirection: 'row', alignItems: 'center', backgroundColor: theme.success + '15',
            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10
        },
        promotedText: { fontSize: 12, fontWeight: 'bold', color: theme.success, marginLeft: 6 },
        
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
        modalContent: { backgroundColor: theme.card, borderRadius: 24, padding: 24 },
        modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text, marginBottom: 5 },
        label: { fontSize: 13, fontWeight: 'bold', color: theme.text, marginBottom: 8, marginTop: 15 },
        modalInput: { backgroundColor: theme.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, color: theme.text },
        sessionChip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border, marginRight: 10, marginBottom: 10 },
        activeSessionChip: { backgroundColor: theme.primary, borderColor: theme.primary },
        promoteSubmitBtn: { backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 30 },
        promoteSubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
        switchRow: { 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginTop: 20, 
            backgroundColor: theme.card, 
            padding: 16, 
            borderRadius: 18,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 10,
        },
        pillToggle: {
            width: 50,
            height: 30,
            borderRadius: 15,
            padding: 2,
            justifyContent: 'center',
        },
        pillThumb: {
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 2,
        },
        sessionToggleBtn: {
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: theme.card,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
        },
        dropdownContainer: {
            position: 'absolute',
            top: insets.top + 65,
            right: 20,
            width: 220,
            backgroundColor: theme.card,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            elevation: 10,
            zIndex: 1000,
            overflow: 'hidden',
        },
        dropdownHeader: {
            padding: 15,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            backgroundColor: isDark ? '#1a1a1a' : '#f9f9f9',
        },
        dropdownTitle: {
            fontSize: 12,
            fontWeight: '900',
            color: theme.textLight,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        dropdownItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 15,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        dropdownItemText: {
            fontSize: 14,
            color: theme.text,
            fontWeight: '600',
        },
    }), [theme, insets, isDark]);

    if (loading) return <View style={{flex:1, justifyContent:'center', alignItems:'center'}}><ActivityIndicator size="large" color={theme.primary}/></View>;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} translucent backgroundColor="transparent" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Student Promotion</Text>
                    {targetSessionId && (
                        <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '800', marginLeft: 15 }}>
                            Target: {sessions.find(s => s.id === targetSessionId)?.name}
                        </Text>
                    )}
                </View>
                <TouchableOpacity 
                    style={[styles.sessionToggleBtn, showTargetPicker && { backgroundColor: theme.primary }]} 
                    onPress={() => setShowTargetPicker(!showTargetPicker)}
                >
                    <Ionicons name="calendar" size={20} color={showTargetPicker ? "#fff" : theme.text} />
                </TouchableOpacity>
            </View>

            {/* Target Session Dropdown */}
            {showTargetPicker && (
                <View style={styles.dropdownContainer}>
                    <View style={styles.dropdownHeader}>
                        <Text style={styles.dropdownTitle}>Select Target Session</Text>
                    </View>
                    <ScrollView style={{ maxHeight: 200 }}>
                        {sessions.map(s => (
                            <TouchableOpacity 
                                key={s.id} 
                                style={[styles.dropdownItem, targetSessionId === s.id && { backgroundColor: theme.primary + '10' }]}
                                onPress={() => {
                                    setTargetSessionId(s.id);
                                    setShowTargetPicker(false);
                                }}
                            >
                                <Text style={[styles.dropdownItemText, targetSessionId === s.id && { color: theme.primary, fontWeight: '800' }]}>
                                    {s.name}
                                </Text>
                                {targetSessionId === s.id && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <View style={styles.filterBar}>
                <View style={styles.filterHeader}>
                    <Text style={{fontSize: 12, fontWeight:'bold', color: theme.textLight}}>Filters:</Text>
                    {(filterClass !== '' || filterSection !== '') && (
                        <TouchableOpacity onPress={resetFilters}>
                            <Text style={styles.clearText}>Clear All</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 10}}>
                    {classes.map(cls => (
                        <TouchableOpacity key={cls} style={[styles.filterChip, filterClass === cls && {backgroundColor: theme.primary}]} onPress={() => handleClassFilter(cls)}>
                            <Text style={[styles.filterText, filterClass === cls && {color:'#fff'}]}>Class {cls}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                {filterClass !== '' && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {sections.map(sec => (
                            <TouchableOpacity key={sec} style={[styles.filterChip, filterSection === sec && {backgroundColor: theme.primary}]} onPress={() => handleSectionFilter(sec)}>
                                <Text style={[styles.filterText, filterSection === sec && {color:'#fff'}]}>Section {sec}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            <ScrollView 
                contentContainerStyle={{paddingBottom: 40}}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
            >
                {filteredStudents.length === 0 ? (
                    <View style={{alignItems:'center', marginTop: 50}}>
                        <Ionicons name="people-outline" size={60} color={theme.border} />
                        <Text style={{marginTop: 15, color: theme.textLight, fontWeight: '600'}}>No students found in this session</Text>
                    </View>
                ) : (
                    filteredStudents.map((item, idx) => {
                        const isPromoted = promotedCodes.includes(item.unique_code);
                        return (
                            <View key={idx} style={styles.card}>
                                <View style={styles.avatarContainer}>
                                    {item.photo_url ? (
                                        <Image source={{ uri: getFullImageUrl(item.photo_url) || undefined }} style={styles.studentImg} />
                                    ) : (
                                        <View style={styles.placeholderIcon}>
                                            <Ionicons name="person" size={24} color="#fff" />
                                        </View>
                                    )}
                                </View>
                                <View style={styles.studentInfo}>
                                    <Text style={styles.studentName}>{item.name}</Text>
                                    <Text style={styles.studentMeta}>Class {item.class}-{item.section} • Roll: {item.roll_no}</Text>
                                </View>
                                
                                {isPromoted ? (
                                    <View style={styles.promotedBadge}>
                                        <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                                        <Text style={styles.promotedText}>Promoted</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity style={styles.promoteBtn} onPress={() => handlePromotePress(item)}>
                                        <MaterialCommunityIcons name="account-arrow-up" size={20} color={theme.primary} />
                                        <Text style={styles.promoteBtnText}>Promote</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>

            <Modal 
                visible={promotionModalVisible} 
                animationType="fade" 
                transparent={true}
                onRequestClose={() => setPromotionModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    style={{ flex: 1 }}
                >
                    <View style={styles.modalOverlay}>
                        <ScrollView 
                            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={styles.modalContent}>
                                <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                                    <Text style={styles.modalTitle}>Promote Student</Text>
                                    <TouchableOpacity onPress={() => setPromotionModalVisible(false)}><Ionicons name="close-circle" size={30} color={theme.textLight}/></TouchableOpacity>
                                </View>
                                <Text style={{color: theme.textLight, marginBottom: 20}}>Promoting {selectedStudent?.name}</Text>

                                <Text style={styles.label}>Target Session</Text>
                                <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                                    {sessions.map(s => (
                                        <TouchableOpacity 
                                            key={s.id} 
                                            style={[styles.sessionChip, promotionData.targetSessionId === s.id && styles.activeSessionChip]} 
                                            onPress={() => {
                                                setPromotionData({...promotionData, targetSessionId: s.id});
                                                fetchPromotedTracking(s.id);
                                            }}
                                        >
                                            <Text style={{color: promotionData.targetSessionId === s.id ? '#fff' : theme.text}}>{s.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.label}>New Class</Text>
                                <TextInput style={styles.modalInput} value={promotionData.newClass} onChangeText={t => setPromotionData({...promotionData, newClass: t})} />
                                
                                <View style={{flexDirection:'row', gap: 15}}>
                                    <View style={{flex:1}}>
                                        <Text style={styles.label}>Section</Text>
                                        <TextInput style={styles.modalInput} value={promotionData.newSection} onChangeText={t => setPromotionData({...promotionData, newSection: t})} />
                                    </View>
                                    <View style={{flex:1}}>
                                        <Text style={styles.label}>Roll No</Text>
                                        <TextInput style={styles.modalInput} value={promotionData.newRollNo} onChangeText={t => setPromotionData({...promotionData, newRollNo: t})} />
                                    </View>
                                </View>

                                <Text style={styles.label}>Monthly Tuition Fees</Text>
                                <TextInput 
                                    style={styles.modalInput} 
                                    placeholder="Amount in ₹" 
                                    keyboardType="numeric" 
                                    value={promotionData.monthlyFees} 
                                    onChangeText={t => setPromotionData({...promotionData, monthlyFees: t})} 
                                />

                                <View style={styles.switchRow}>
                                    <View>
                                        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Transport Facility</Text>
                                        <Text style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>Include bus service for next session</Text>
                                    </View>
                                    <TouchableOpacity 
                                        activeOpacity={0.8}
                                        onPress={() => setPromotionData({...promotionData, transportFacility: !promotionData.transportFacility})}
                                    >
                                        <Animated.View style={[
                                            styles.pillToggle, 
                                            {
                                                backgroundColor: switchAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [isDark ? '#333' : '#E9E9EB', '#34C759']
                                                })
                                            }
                                        ]}>
                                            <Animated.View style={[
                                                styles.pillThumb,
                                                {
                                                    transform: [{
                                                        translateX: switchAnim.interpolate({
                                                            inputRange: [0, 1],
                                                            outputRange: [2, 22]
                                                        })
                                                    }]
                                                }
                                            ]} />
                                        </Animated.View>
                                    </TouchableOpacity>
                                </View>

                                {promotionData.transportFacility && (
                                    <>
                                        <Text style={styles.label}>Monthly Transport Fees</Text>
                                        <TextInput 
                                            style={styles.modalInput} 
                                            placeholder="Amount in ₹" 
                                            keyboardType="numeric" 
                                            value={promotionData.transportFees} 
                                            onChangeText={t => setPromotionData({...promotionData, transportFees: t})} 
                                        />
                                    </>
                                )}

                                <TouchableOpacity style={styles.promoteSubmitBtn} onPress={handlePromoteSubmit} disabled={promoting}>
                                    {promoting ? <ActivityIndicator color="#fff"/> : <Text style={styles.promoteSubmitText}>Confirm Promotion</Text>}
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={{ marginTop: 15, paddingVertical: 10, alignItems: 'center' }}
                                    onPress={() => setPromotionModalVisible(false)}
                                >
                                    <Text style={{ color: theme.textLight, fontWeight: '700' }}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}