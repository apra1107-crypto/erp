import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AttendanceIndex() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<string[]>([]);
    const [sections, setSections] = useState<{ [key: string]: string[] }>({});
    const [studentCounts, setStudentCounts] = useState<{ [key: string]: { [key: string]: number } }>({});
    const [markedSections, setMarkedSections] = useState<{class: string, section: string}[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        fetchClassSections();
    }, []);

    useEffect(() => {
        fetchAttendanceStatus();
    }, [selectedDate]);

    const formatDateForAPI = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const fetchAttendanceStatus = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const userData = await AsyncStorage.getItem('userData');
            const sessionId = userData ? JSON.parse(userData).current_session_id : null;
            const dateStr = formatDateForAPI(selectedDate);

            const response = await axios.get(
                `${API_ENDPOINTS.ATTENDANCE}/get-status?date=${dateStr}`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    } 
                }
            );
            setMarkedSections(response.data.markedSections || []);
        } catch (error) {
            console.error('Error fetching attendance status:', error);
        }
    };

    const fetchClassSections = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const userData = await AsyncStorage.getItem('userData');
            const sessionId = userData ? JSON.parse(userData).current_session_id : null;

            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/student/list`,
                { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    } 
                }
            );

            const students = response.data.students || [];
            const classSet = new Set<string>();
            const sectionMap: { [key: string]: Set<string> } = {};

            students.forEach((s: any) => {
                classSet.add(s.class);
                if (!sectionMap[s.class]) {
                    sectionMap[s.class] = new Set();
                }
                sectionMap[s.class].add(s.section);
            });

            // numeric sort if possible, else text sort
            const sortedClasses = Array.from(classSet).sort((a, b) => {
                const numA = parseInt(a);
                const numB = parseInt(b);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
            });

            const sectionObj: { [key: string]: string[] } = {};
            const countObj: { [key: string]: { [key: string]: number } } = {};

            sortedClasses.forEach(cls => {
                sectionObj[cls] = Array.from(sectionMap[cls]).sort();
                countObj[cls] = {};
                sectionObj[cls].forEach(sec => {
                    countObj[cls][sec] = students.filter((s: any) => s.class === cls && s.section === sec).length;
                });
            });

            setClasses(sortedClasses);
            setSections(sectionObj);
            setStudentCounts(countObj);
        } catch (error) {
            console.error('Error fetching class sections:', error);
        } finally {
            setLoading(false);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            paddingTop: insets.top + 10,
            paddingBottom: 20,
            paddingHorizontal: 24,
            backgroundColor: theme.background,
            zIndex: 10,
        },
        headerTop: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        backBtn: { 
            width: 40, 
            height: 40, 
            borderRadius: 12, 
            backgroundColor: isDark ? '#333' : '#f4f4f5', 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginRight: 16 
        },
        headerTitle: { fontSize: 24, fontWeight: '900', color: theme.text, letterSpacing: -0.5 },
        headerSubtitle: { fontSize: 13, color: theme.textLight, marginTop: 2, fontWeight: '500' },
        
        content: { flex: 1, paddingHorizontal: 20 },
        
        // Grid Layout
        gridContainer: {
            paddingBottom: 40,
        },
        classCard: {
            backgroundColor: theme.card,
            borderRadius: 24,
            marginBottom: 20,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.2 : 0.06,
            shadowRadius: 12,
            elevation: 4,
            borderWidth: 1,
            borderColor: isDark ? '#333' : '#f0f0f0',
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16,
        },
        classBadge: {
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: theme.primary + '15',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 14,
        },
        classBadgeText: {
            fontSize: 20,
            fontWeight: '900',
            color: theme.primary,
        },
        cardTitleBlock: {
            flex: 1,
        },
        className: {
            fontSize: 18,
            fontWeight: '800',
            color: theme.text,
        },
        totalStudents: {
            fontSize: 13,
            color: theme.textLight,
            marginTop: 2,
            fontWeight: '600'
        },
        
        // Section Chips
        sectionsRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        sectionChip: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: isDark ? theme.background : '#f8f9fa',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: isDark ? '#444' : '#e9ecef',
        },
        sectionName: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.text,
            marginRight: 8,
        },
        countPill: {
            backgroundColor: theme.primary + '20',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
        },
        countText: {
            fontSize: 11,
            fontWeight: '800',
            color: theme.primary,
        },
        
        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
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
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} translucent={true} />
            
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>Attendance</Text>
                        <Text style={styles.headerSubtitle}>Select a class & section to manage records</Text>
                    </View>
                </View>

                {/* Date Selection */}
                <TouchableOpacity 
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isDark ? '#333' : '#f4f4f5',
                        padding: 12,
                        borderRadius: 12,
                        marginTop: 15,
                    }}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Ionicons name="calendar" size={20} color={theme.primary} />
                    <Text style={{ marginLeft: 10, fontSize: 16, fontWeight: '700', color: theme.text, flex: 1 }}>
                        {selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={theme.textLight} />
                </TouchableOpacity>

                {showDatePicker && (
                    <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display="default"
                        onChange={(event, date) => {
                            setShowDatePicker(false);
                            if (date) setSelectedDate(date);
                        }}
                    />
                )}
            </View>

            <ScrollView 
                style={styles.content} 
                contentContainerStyle={styles.gridContainer}
                showsVerticalScrollIndicator={false}
            >
                {classes.map((cls) => {
                    const totalInClass = sections[cls]?.reduce((acc, sec) => acc + (studentCounts[cls]?.[sec] || 0), 0) || 0;
                    
                    return (
                        <View key={cls} style={styles.classCard}>
                            <View style={styles.cardHeader}>
                                <View style={styles.classBadge}>
                                    <Text style={styles.classBadgeText}>{cls}</Text>
                                </View>
                                <View style={styles.cardTitleBlock}>
                                    <Text style={styles.className}>Class {cls}</Text>
                                    <Text style={styles.totalStudents}>{totalInClass} Students Total</Text>
                                </View>
                            </View>
                            
                            <View style={styles.sectionsRow}>
                                {sections[cls]?.map((sec) => {
                                    const isMarked = markedSections.some(m => String(m.class) === String(cls) && String(m.section) === String(sec));
                                    
                                    return (
                                        <TouchableOpacity
                                            key={sec}
                                            style={[styles.sectionChip, isMarked && { borderColor: theme.success + '40', backgroundColor: theme.success + '05' }]}
                                            activeOpacity={0.7}
                                            onPress={() => router.push(`/(principal)/attendance/${cls}/${sec}`)}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={[styles.sectionName, isMarked && { color: theme.success }]}>Sec {sec}</Text>
                                                {isMarked && (
                                                    <Ionicons name="checkmark-circle" size={14} color={theme.success} style={{ marginRight: 6 }} />
                                                )}
                                            </View>
                                            <View style={styles.countPill}>
                                                <Ionicons name="person" size={10} color={theme.primary} />
                                                <Text style={styles.countText}>{studentCounts[cls]?.[sec] || 0}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}
