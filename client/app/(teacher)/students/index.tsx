import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, TextInput, RefreshControl, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

export default function SelectClass() {
    const router = useRouter();
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [filterClass, setFilterClass] = useState<string>('');
    const [filterSection, setFilterSection] = useState<string>('');
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const { isDark, theme } = useTheme();
    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const userData = await AsyncStorage.getItem('teacherData');
            const sessionId = userData ? JSON.parse(userData).current_session_id : null;

            const response = await axios.get(
                `${API_ENDPOINTS.TEACHER}/student/list`,
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
            backgroundColor: theme.background,
        },
        header: {
            backgroundColor: theme.card,
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            zIndex: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 10,
            elevation: 5,
        },
        backButton: {
            padding: 8,
            borderRadius: 12,
            backgroundColor: theme.background,
        },
        title: {
            fontSize: 20,
            fontWeight: '900',
            color: theme.text,
        },
        listContainer: {
            padding: 20,
            paddingBottom: 40
        },
        card: {
            backgroundColor: theme.card,
            borderRadius: 22,
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
            color: theme.primary,
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
            backgroundColor: theme.card,
            padding: 15,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        filterTitle: {
            fontSize: 12,
            fontWeight: '800',
            color: theme.primary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        filterGroup: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        filterLabel: {
            fontWeight: '800',
            marginRight: 10,
            color: theme.textLight,
            fontSize: 12,
        },
        filterChip: {
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: theme.background,
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
            fontWeight: '700',
        },
        filterTextActive: {
            color: '#fff',
            fontWeight: '800',
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
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>All Students</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.filterBar}>
                <View style={styles.filterHeader}>
                    <Text style={styles.filterTitle}>Filter Students</Text>
                    {(filterClass || filterSection) && (
                        <TouchableOpacity onPress={resetFilters}>
                            <Text style={styles.clearText}>Clear All</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <View style={styles.filterGroup}>
                        <Text style={styles.filterLabel}>Class:</Text>
                        {classes.map(cls => (
                            <TouchableOpacity
                                key={cls}
                                style={[styles.filterChip, filterClass === cls && styles.filterChipActive]}
                                onPress={() => handleClassFilter(cls)}
                            >
                                <Text style={[styles.filterText, filterClass === cls && styles.filterTextActive]}>{cls}</Text>
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
                                    style={[styles.filterChip, filterSection === sec && styles.filterChipActive]}
                                    onPress={() => handleSectionFilter(sec)}
                                >
                                    <Text style={[styles.filterText, filterSection === sec && styles.filterTextActive]}>{sec}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                )}
            </View>

            <ScrollView
                contentContainerStyle={styles.listContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />
                }
            >
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
                            <Ionicons name="chevron-forward" size={20} color={theme.icon} />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}
