import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, StatusBar, Modal, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';
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

    // Promoted Tracking
    const [promotedCodes, setPromotedCodes] = useState<string[]>([]);

    const resetFilters = () => {
        setFilterClass('');
        setSections([]);
        setFilterSection('');
        setFilteredStudents(allStudents);
    };

    // Promotion State
    const [promotionModalVisible, setPromotionModalVisible] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [promotionData, setPromotionData] = useState({
        newClass: '',
        newSection: '',
        newRollNo: '',
        targetSessionId: ''
    });
    const [promoting, setPromoting] = useState(false);

    useEffect(() => {
        fetchClasses();
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(API_ENDPOINTS.ACADEMIC_SESSIONS, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const otherSessions = response.data.filter((s: any) => !s.is_active);
            setSessions(otherSessions);
            if (otherSessions.length > 0) {
                setPromotionData(prev => ({ ...prev, targetSessionId: otherSessions[0].id }));
                fetchPromotedTracking(otherSessions[0].id);
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        }
    };

    const fetchPromotedTracking = async (sessionId: any) => {
        if (!sessionId) return;
        try {
            const token = await AsyncStorage.getItem('token');
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
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/student/list`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const data = response.data.students;
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
            targetSessionId: promotionData.targetSessionId || (sessions[0]?.id || '')
        });
        setPromotionModalVisible(true);
    };

    const handlePromoteSubmit = async () => {
        if (!promotionData.targetSessionId || !promotionData.newClass || !promotionData.newSection || !promotionData.newRollNo) {
            Alert.alert("Error", "Please fill all promotion details");
            return;
        }

        try {
            setPromoting(true);
            const token = await AsyncStorage.getItem('token');
            await axios.post(API_ENDPOINTS.PROMOTION + '/student', {
                studentId: selectedStudent.id,
                ...promotionData
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            Toast.show({ type: 'success', text1: 'Promoted', text2: `${selectedStudent.name} promoted successfully` });
            setPromotionModalVisible(false);
            // Refresh tracking
            fetchPromotedTracking(promotionData.targetSessionId);
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
    }), [theme, insets]);

    if (loading) return <View style={{flex:1, justifyContent:'center', alignItems:'center'}}><ActivityIndicator size="large" color={theme.primary}/></View>;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} translucent backgroundColor="transparent" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Student Promotion</Text>
            </View>

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

            <ScrollView contentContainerStyle={{paddingBottom: 40}}>
                {filteredStudents.length === 0 ? (
                    <Text style={{textAlign:'center', marginTop: 50, color: theme.textLight}}>No students found</Text>
                ) : (
                    filteredStudents.map((item, idx) => {
                        const isPromoted = promotedCodes.includes(item.unique_code);
                        return (
                            <View key={idx} style={styles.card}>
                                <View style={styles.avatarContainer}>
                                    {item.photo_url ? (
                                        <Image source={{ uri: item.photo_url }} style={styles.studentImg} />
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

            <Modal visible={promotionModalVisible} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
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

                        <TouchableOpacity style={styles.promoteSubmitBtn} onPress={handlePromoteSubmit} disabled={promoting}>
                            {promoting ? <ActivityIndicator color="#fff"/> : <Text style={styles.promoteSubmitText}>Confirm Promotion</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
