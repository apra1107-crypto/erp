import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, TextInput, RefreshControl, StatusBar, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';
import { getFullImageUrl } from '../../../utils/imageHelper';

export default function SelectClass() {
    const router = useRouter();
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [filterClass, setFilterClass] = useState<string>('');
    const [filterSection, setFilterSection] = useState<string>('');
    const [filterGender, setFilterGender] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    const { isDark, theme } = useTheme();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            const response = await axios.get(
                `${API_ENDPOINTS.TEACHER}/student/list`,
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    }
                }
            );

            const data = response.data.students || [];
            // Sort by roll number numerically
            const sorted = data.sort((a: any, b: any) => (parseInt(a.roll_no) || 0) - (parseInt(b.roll_no) || 0));
            setAllStudents(sorted);
            const uniqueClasses = [...new Set(sorted.map((s: any) => s.class))].sort();
            setClasses(uniqueClasses as string[]);
        } catch (error) {
            console.error('Error fetching classes:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchClasses();
    };

    const handleClassFilter = (cls: string) => {
        if (filterClass === cls) {
            setFilterClass('');
            setSections([]);
            setFilterSection('');
        } else {
            setFilterClass(cls);
            const classStudents = allStudents.filter((s: any) => s.class === cls);
            const uniqueSections = [...new Set(classStudents.map((s: any) => s.section))].sort();
            setSections(uniqueSections as string[]);
            setFilterSection('');
        }
    };

    const resetFilters = () => {
        setFilterClass('');
        setSections([]);
        setFilterSection('');
        setFilterGender('');
        setFilterModalVisible(false);
    };

    const filteredStudents = useMemo(() => {
        return allStudents.filter((s: any) => {
            const classMatch = !filterClass || String(s.class) === String(filterClass);
            const sectionMatch = !filterSection || String(s.section) === String(filterSection);
            const genderMatch = !filterGender || s.gender?.toLowerCase() === filterGender.toLowerCase();
            return classMatch && sectionMatch && genderMatch;
        });
    }, [allStudents, filterClass, filterSection, filterGender]);

    const handleSectionFilter = (sec: string) => {
        setFilterSection(filterSection === sec ? '' : sec);
    };

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        centerContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.background,
        },
        header: {
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        backButton: {
            width: 40, 
            height: 40, 
            borderRadius: 20, 
            backgroundColor: theme.card, 
            justifyContent: 'center', 
            alignItems: 'center', 
            marginRight: 15,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        title: {
            fontSize: 24,
            fontWeight: '900',
            color: theme.text,
            letterSpacing: -0.5,
        },
        listContainer: {
            padding: 20,
            paddingBottom: 40
        },
        card: {
            backgroundColor: theme.card,
            borderRadius: 24,
            padding: 15,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 15,
            elevation: 2,
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
        studentInfo: {
            flex: 1,
        },
        studentName: {
            fontSize: 16,
            fontWeight: '800',
            color: theme.text,
        },
        studentMeta: {
            fontSize: 13,
            color: theme.textLight,
            marginTop: 4,
            fontWeight: '600',
        },
        filterHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        clearText: {
            color: theme.danger,
            fontSize: 12,
            fontWeight: '800',
        },
        noDataText: {
            textAlign: 'center',
            fontSize: 14,
            color: theme.textLight,
            marginTop: 50,
            fontWeight: '600'
        },
        filterBar: {
            paddingHorizontal: 20,
            paddingBottom: 15,
        },
        filterTitle: {
            fontSize: 12,
            fontWeight: '800',
            color: theme.primary,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        filterGroup: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        filterLabel: {
            fontWeight: '900',
            marginRight: 12,
            color: theme.textLight,
            fontSize: 11,
            textTransform: 'uppercase',
        },
        filterChip: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 14,
            backgroundColor: theme.card,
            marginRight: 10,
            borderWidth: 1,
            borderColor: theme.border,
        },
        filterChipActive: {
            backgroundColor: theme.primary,
            borderColor: theme.primary,
            elevation: 4,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
        },
        filterText: {
            fontSize: 13,
            color: theme.text,
            fontWeight: '700',
        },
        filterTextActive: {
            color: '#fff',
            fontWeight: '900',
        },
    }), [theme, isDark, insets]);

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.title, { marginRight: 15 }]}>Students</Text>
                    <View style={{ backgroundColor: '#4f46e5' + '15', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#4f46e5' }}>{filteredStudents.length}</Text>
                    </View>
                </View>
                <TouchableOpacity 
                    onPress={() => setFilterModalVisible(true)} 
                    style={[
                        styles.backButton, 
                        { marginRight: 0 },
                        (filterClass || filterSection || filterGender) && { backgroundColor: theme.primary + '15', borderColor: theme.primary }
                    ]}
                >
                    <Ionicons name="filter" size={20} color={(filterClass || filterSection || filterGender) ? theme.primary : theme.text} />
                    {(filterClass || filterSection || filterGender) && (
                        <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary, borderWidth: 1.5, borderColor: theme.card }} />
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.listContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />
                }
            >
                {(filterClass || filterSection || filterGender) && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 5 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textLight }}>
                            {filterClass ? `Cls ${filterClass}` : ''} {filterSection ? `Sec ${filterSection}` : ''} {filterGender ? `- ${filterGender}` : ''}
                        </Text>
                        <TouchableOpacity onPress={resetFilters}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: theme.danger }}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {filteredStudents.length === 0 ? (
                    <Text style={styles.noDataText}>No students matching filters</Text>
                ) : (
                    filteredStudents.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.card}
                            onPress={() => router.push(`/(teacher)/students/details/${item.id}`)}
                        >
                            <View style={styles.avatarContainer}>
                                {item.photo_url ? (
                                    <Image source={{ uri: getFullImageUrl(item.photo_url) ?? undefined }} style={styles.studentImg} />
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
                            
                            <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                                <View style={{ backgroundColor: theme.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.primary + '20' }}>
                                    <Text style={{ fontSize: 10, fontWeight: '900', color: theme.primary, letterSpacing: 0.5 }}>{item.unique_code}</Text>
                                </View>
                            </View>

                            <Ionicons name="chevron-forward" size={20} color={theme.border} />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Filter Modal */}
            <Modal
                visible={filterModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setFilterModalVisible(false)}
            >
                <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} 
                    activeOpacity={1} 
                    onPress={() => setFilterModalVisible(false)}
                >
                    <TouchableOpacity 
                        activeOpacity={1} 
                        style={{ 
                            backgroundColor: theme.card, 
                            borderTopLeftRadius: 30, 
                            borderTopRightRadius: 30, 
                            padding: 25, 
                            paddingBottom: insets.bottom + 20 
                        }}
                    >
                        <View style={{ width: 40, height: 5, backgroundColor: theme.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 }}>
                            <Text style={{ fontSize: 22, fontWeight: '900', color: theme.text }}>Filter Students</Text>
                            <TouchableOpacity onPress={resetFilters}>
                                <Text style={{ fontSize: 14, fontWeight: '800', color: theme.danger }}>Reset All</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 }}>Select Class</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 25 }}>
                            {classes.map(cls => (
                                <TouchableOpacity
                                    key={cls}
                                    style={[
                                        { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 15, backgroundColor: theme.background, marginRight: 10, borderWidth: 1, borderColor: theme.border },
                                        filterClass === cls && { backgroundColor: theme.primary, borderColor: theme.primary }
                                    ]}
                                    onPress={() => handleClassFilter(cls)}
                                >
                                    <Text style={[{ fontSize: 14, fontWeight: '700', color: theme.text }, filterClass === cls && { color: '#fff', fontWeight: '800' }]}>Class {cls}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {filterClass && sections.length > 0 && (
                            <>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 }}>Select Section</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 25 }}>
                                    {sections.map(sec => (
                                        <TouchableOpacity
                                            key={sec}
                                            style={[
                                                { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 15, backgroundColor: theme.background, marginRight: 10, borderWidth: 1, borderColor: theme.border },
                                                filterSection === sec && { backgroundColor: theme.primary, borderColor: theme.primary }
                                            ]}
                                            onPress={() => handleSectionFilter(sec)}
                                        >
                                            <Text style={[{ fontSize: 14, fontWeight: '700', color: theme.text }, filterSection === sec && { color: '#fff', fontWeight: '800' }]}>Sec {sec}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </>
                        )}

                        <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 }}>Gender</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 25 }}>
                            {['Male', 'Female'].map(g => (
                                <TouchableOpacity
                                    key={g}
                                    style={[
                                        { flex: 1, paddingVertical: 12, borderRadius: 15, backgroundColor: theme.background, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
                                        filterGender === g && { backgroundColor: theme.primary, borderColor: theme.primary }
                                    ]}
                                    onPress={() => setFilterGender(filterGender === g ? '' : g)}
                                >
                                    <Text style={[{ fontSize: 14, fontWeight: '700', color: theme.text }, filterGender === g && { color: '#fff', fontWeight: '800' }]}>{g}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity 
                            style={{ backgroundColor: theme.primary, paddingVertical: 18, borderRadius: 20, alignItems: 'center', marginTop: 10 }}
                            onPress={() => setFilterModalVisible(false)}
                        >
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Apply Filters</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}
