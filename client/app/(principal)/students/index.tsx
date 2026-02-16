import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, StatusBar, Modal, TextInput, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

export default function SelectClass() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [filterClass, setFilterClass] = useState<string>('');
    const [filterSection, setFilterSection] = useState<string>('');
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { isDark, theme } = useTheme();

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
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
            setFilterClass('');
            setSections([]);
            setFilterSection('');
        } else {
            setFilterClass(cls);
            // Get sections for this class
            const classStudents = allStudents.filter((s: any) => s.class === cls);
            const uniqueSections = [...new Set(classStudents.map((s: any) => s.section))].sort();
            setSections(uniqueSections as string[]);
            setFilterSection('');
            setFilteredStudents(classStudents);
        }
    };

    const resetFilters = () => {
        setFilterClass('');
        setSections([]);
        setFilterSection('');
        setFilteredStudents(allStudents);
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

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        centerContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        header: {
            backgroundColor: 'transparent',
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            zIndex: 10,
        },
        backButton: {
            padding: 5,
            marginRight: 15,
        },
        title: {
            fontSize: 20,
            fontWeight: 'bold',
        },
        listContainer: {
            padding: 20,
        },
        card: {
            backgroundColor: theme.card,
            borderRadius: 16,
            padding: 15,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 5,
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
            fontWeight: '700',
        },
        studentMeta: {
            fontSize: 13,
            marginTop: 4,
        },
        filterHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
        },
        clearText: {
            color: theme.primary,
            fontSize: 12,
            fontWeight: 'bold',
        },
        noDataText: {
            textAlign: 'center',
            fontSize: 16,
            color: theme.textLight,
            marginTop: 50,
        },
        filterBar: {
            backgroundColor: 'transparent',
            paddingHorizontal: 20,
            paddingVertical: 10,
        },
        filterTitle: {
            fontSize: 12,
            fontWeight: 'bold',
            color: theme.text,
        },
        filterGroup: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        filterLabel: {
            fontWeight: 'bold',
            marginRight: 10,
            fontSize: 12,
            color: theme.text,
        },
        filterChip: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            marginRight: 8,
            borderWidth: 1,
            borderColor: theme.border,
        },
        filterChipActive: {
            backgroundColor: theme.primary,
            borderColor: theme.primary,
        },
        filterText: {
            fontSize: 12,
            color: theme.text,
        },
        filterTextActive: {
            color: '#fff',
            fontWeight: 'bold',
        },
        promoteBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.primary + '15',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 8,
            marginRight: 10,
        },
        promoteBtnText: {
            fontSize: 11,
            fontWeight: 'bold',
            color: theme.primary,
            marginLeft: 4,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            padding: 20,
        },
        modalContent: {
            backgroundColor: theme.card,
            borderRadius: 24,
            padding: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.2,
            shadowRadius: 20,
            elevation: 10,
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 5,
        },
        modalTitle: {
            fontSize: 20,
            fontWeight: '900',
            color: theme.text,
        },
        modalSubtitle: {
            fontSize: 14,
            color: theme.textLight,
            marginBottom: 20,
        },
        label: {
            fontSize: 13,
            fontWeight: 'bold',
            color: theme.text,
            marginBottom: 8,
            marginTop: 15,
        },
        modalInput: {
            backgroundColor: theme.background,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            color: theme.text,
            fontSize: 15,
        },
        sessionChips: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
        },
        sessionChip: {
            paddingHorizontal: 15,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: theme.background,
            borderWidth: 1,
            borderColor: theme.border,
        },
        sessionChipActive: {
            backgroundColor: theme.primary,
            borderColor: theme.primary,
        },
        sessionChipText: {
            fontSize: 13,
            color: theme.text,
        },
        sessionChipTextActive: {
            color: '#fff',
            fontWeight: 'bold',
        },
        promoteSubmitBtn: {
            backgroundColor: theme.primary,
            paddingVertical: 15,
            borderRadius: 15,
            alignItems: 'center',
            marginTop: 30,
        },
        promoteSubmitText: {
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 16,
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
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>All Students</Text>
            </View>

            {/* Filter Bar */}
            <View style={styles.filterBar}>
                <View style={styles.filterHeader}>
                    <Text style={styles.filterTitle}>Filter Students:</Text>
                    {(filterClass || filterSection) && (
                        <TouchableOpacity onPress={resetFilters}>
                            <Text style={styles.clearText}>Clear All</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Class:</Text>
                        {classes.map((cls: string) => (
                            <TouchableOpacity
                                key={cls}
                                style={[styles.filterChip, { backgroundColor: isDark ? '#333' : '#f8f9fa' }, filterClass === cls && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                onPress={() => handleClassFilter(cls)}
                            >
                                <Text style={[styles.filterText, { color: theme.text }, filterClass === cls && { color: '#fff', fontWeight: 'bold' }]}>{cls}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>

                {filterClass && sections.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.filterGroup}>
                            <Text style={styles.filterLabel}>Section:</Text>
                            {sections.map(sec => (
                                <TouchableOpacity
                                    key={sec}
                                    style={[styles.filterChip, { backgroundColor: isDark ? '#333' : '#f8f9fa' }, filterSection === sec && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                    onPress={() => handleSectionFilter(sec)}
                                >
                                    <Text style={[styles.filterText, { color: theme.text }, filterSection === sec && { color: '#fff', fontWeight: 'bold' }]}>{sec}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.listContainer}>
                {filteredStudents.length === 0 ? (
                    <Text style={styles.noDataText}>No students matching filters</Text>
                ) : (
                    filteredStudents.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.card}
                            onPress={() => router.push(`/(principal)/students/details/${item.id}`)}
                        >
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
                                <Text style={[styles.studentName, { color: theme.text }]}>{item.name}</Text>
                                <Text style={[styles.studentMeta, { color: theme.textLight }]}>Class {item.class}-{item.section} • Roll: {item.roll_no}</Text>
                            </View>
                            <TouchableOpacity onPress={() => router.push(`/(principal)/students/details/${item.id}`)}>
                                <Ionicons name="chevron-forward" size={20} color={theme.icon} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}
