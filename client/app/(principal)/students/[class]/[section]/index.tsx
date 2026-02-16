import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../../../constants/Config';

export default function StudentList() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const { class: initialClass, section: initialSection } = useLocalSearchParams();
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [classes, setClasses] = useState<string[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [filterClass, setFilterClass] = useState<string>('');
    const [filterSection, setFilterSection] = useState<string>('');

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        filterStudents();
    }, [allStudents, filterClass, filterSection]);

    const fetchAllData = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/student/list`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const data = response.data.students;
            setAllStudents(data);

            const uniqueClasses = [...new Set(data.map((s: any) => s.class))].sort();
            setClasses(uniqueClasses as string[]);

            const initialSelectedClass = (initialClass && uniqueClasses.includes(initialClass as string) ? initialClass : (uniqueClasses[0] || '')) as string;
            setFilterClass(initialSelectedClass);

            if (initialSelectedClass) {
                const classStudents = data.filter((s: any) => s.class === initialSelectedClass);
                const uniqueSections = [...new Set(classStudents.map((s: any) => s.section))].sort();
                setSections(uniqueSections as string[]);
                const initialSelectedSection = (initialSection && uniqueSections.includes(initialSection as string) ? initialSection : (uniqueSections[0] || '')) as string;
                setFilterSection(initialSelectedSection);
            }
        } catch (error) {
            console.error('Error fetching students:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterStudents = () => {
        if (filterClass) {
            const classStudents = allStudents.filter((s: any) => s.class === filterClass);
            const uniqueSections = [...new Set(classStudents.map((s: any) => s.section))].sort();
            setSections(uniqueSections as string[]);

            if (!uniqueSections.includes(filterSection)) {
                setFilterSection(uniqueSections[0] || '');
            }
        } else {
            setSections([]);
            setFilterSection('');
        }

        const filtered = allStudents.filter(
            (s: any) => s.class === filterClass && s.section === filterSection
        );
        setStudents(filtered);
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            height: 80,
            backgroundColor: 'transparent',
            paddingTop: 25,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
        },
        backBtn: {
            padding: 8,
            borderRadius: 12,
            backgroundColor: 'transparent',
            marginRight: 15
        },
        title: { fontSize: 20, fontWeight: '900', color: theme.text },

        filterBar: {
            backgroundColor: 'transparent',
            paddingVertical: 12,
        },
        filterGroup: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
        filterLabel: { fontWeight: '800', marginRight: 12, color: theme.text, fontSize: 13, textTransform: 'uppercase' },
        filterScroll: { flex: 1 },
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
        filterText: { fontSize: 13, color: theme.text, fontWeight: '700' },
        filterTextActive: { color: '#fff' },

        listContainer: { padding: 20, paddingBottom: 40 },
        card: {
            backgroundColor: theme.card,
            borderRadius: 24,
            padding: 16,
            marginBottom: 15,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
        },
        imageContainer: { marginRight: 15 },
        studentImage: { width: 60, height: 60, borderRadius: 30 },
        placeholderImage: {
            width: 60, height: 60, borderRadius: 30,
            backgroundColor: theme.background,
            justifyContent: 'center', alignItems: 'center',
            borderWidth: 1, borderColor: theme.border
        },
        infoContainer: { flex: 1 },
        nameText: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4 },
        rollText: { fontSize: 14, color: theme.textLight, fontWeight: '600' },

        noDataContainer: { alignItems: 'center', marginTop: 100 },
        noDataText: { fontSize: 16, color: theme.textLight, fontWeight: '600', marginTop: 15 },

        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }
    }), [theme, isDark]);

    if (loading) return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Section Roster</Text>
            </View>

            <View style={styles.filterBar}>
                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Cls:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                        {classes.map(cls => (
                            <TouchableOpacity
                                key={cls}
                                style={[styles.filterChip, filterClass === cls && styles.filterChipActive]}
                                onPress={() => setFilterClass(cls)}
                            >
                                <Text style={[styles.filterText, filterClass === cls && styles.filterTextActive]}>{cls}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
                <View style={[styles.filterGroup, { marginTop: 12 }]}>
                    <Text style={styles.filterLabel}>Sec:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                        {sections.map(sec => (
                            <TouchableOpacity
                                key={sec}
                                style={[styles.filterChip, filterSection === sec && styles.filterChipActive]}
                                onPress={() => setFilterSection(sec)}
                            >
                                <Text style={[styles.filterText, filterSection === sec && styles.filterTextActive]}>{sec}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            <FlatList
                data={students}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.noDataContainer}>
                        <Ionicons name="school-outline" size={60} color={theme.border} />
                        <Text style={styles.noDataText}>No students in this section</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => router.push(`/(principal)/students/details/${item.id}`)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.imageContainer}>
                            {item.photo_url ? (
                                <Image source={{ uri: item.photo_url }} style={styles.studentImage} />
                            ) : (
                                <View style={styles.placeholderImage}>
                                    <Ionicons name="person" size={24} color={theme.border} />
                                </View>
                            )}
                        </View>
                        <View style={styles.infoContainer}>
                            <Text style={styles.nameText}>{item.name}</Text>
                            <Text style={styles.rollText}>Roll No: {item.roll_no || 'N/A'}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                    </TouchableOpacity>
                )}
            />
        </SafeAreaView>
    );
}
