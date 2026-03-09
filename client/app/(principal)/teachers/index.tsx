import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, ScrollView, StatusBar, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

export default function TeacherList() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    const [allTeachers, setAllTeachers] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('All');
    const [filterGender, setFilterGender] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        fetchTeachers();
    }, []);

    useEffect(() => {
        filterTeachers();
    }, [selectedSubject, filterGender, allTeachers]);

    const fetchTeachers = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/teacher/list`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const data = response.data.teachers;
            setAllTeachers(data);
            const uniqueSubjects = ['All', ...new Set(data.map((t: any) => t.subject))].sort();
            setSubjects(uniqueSubjects as string[]);
        } catch (error) {
            console.error('Error fetching teachers:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterTeachers = () => {
        let filtered = allTeachers;
        
        if (selectedSubject !== 'All') {
            filtered = filtered.filter(t => t.subject === selectedSubject);
        }
        
        if (filterGender !== '') {
            filtered = filtered.filter(t => (t.gender || '').toLowerCase() === filterGender.toLowerCase());
        }
        
        setTeachers(filtered);
    };

    const resetFilters = () => {
        setSelectedSubject('All');
        setFilterGender('');
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
            paddingHorizontal: 20,
        },
        backBtn: {
            padding: 8,
            borderRadius: 12,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.border,
        },
        title: { fontSize: 22, fontWeight: '900', color: theme.text },

        filterIconBtn: {
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: theme.card,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
        },

        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
        },
        bottomSheet: {
            backgroundColor: theme.card,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            maxHeight: '80%',
        },
        sheetHeader: {
            alignItems: 'center',
            paddingVertical: 10,
        },
        sheetHandle: {
            width: 40,
            height: 5,
            backgroundColor: theme.border,
            borderRadius: 3,
            marginTop: 10,
            marginBottom: 5,
        },
        sheetTitle: {
            fontSize: 20,
            fontWeight: '900',
            color: theme.text,
        },
        filterGroup: {
            marginBottom: 20,
        },
        filterLabel: {
            fontWeight: '900',
            fontSize: 13,
            color: theme.textLight,
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        filterChip: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 14,
            marginRight: 10,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.background,
        },
        filterChipActive: {
            backgroundColor: theme.primary,
            borderColor: theme.primary,
        },
        filterText: {
            fontSize: 14,
            color: theme.text,
            fontWeight: '700',
        },
        filterTextActive: {
            color: '#fff',
            fontWeight: '900',
        },
        applyBtn: {
            backgroundColor: theme.primary,
            paddingVertical: 18,
            borderRadius: 18,
            alignItems: 'center',
            marginTop: 10,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
        },
        applyBtnText: {
            color: '#fff',
            fontWeight: '900',
            fontSize: 16,
        },

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
        teacherImage: { width: 64, height: 64, borderRadius: 32 },
        placeholderImage: {
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: theme.background,
            justifyContent: 'center', alignItems: 'center',
            borderWidth: 1, borderColor: theme.border
        },
        infoContainer: { flex: 1 },
        nameText: { fontSize: 17, fontWeight: '800', color: theme.text, marginBottom: 4 },
        subjectText: { fontSize: 14, color: theme.primary, fontWeight: '700', marginBottom: 2 },
        qualText: { fontSize: 12, color: theme.textLight, fontWeight: '600' },

        noDataContainer: { alignItems: 'center', marginTop: 100 },
        noDataText: { fontSize: 16, color: theme.textLight, fontWeight: '600', marginTop: 15 },

        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }
    }), [theme, isDark]);

    if (loading) return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );

    const isFiltered = selectedSubject !== 'All' || filterGender !== '';

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />
            
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: Math.max(40, insets.top + insets.bottom + 20), paddingTop: insets.top + 10 }}
            >
                {/* Free Flow Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 15 }}>
                        <Text style={styles.title}>Faculty Directory</Text>
                        <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '800' }}>
                            Total: {teachers.length} Teachers
                        </Text>
                    </View>
                    <TouchableOpacity 
                        style={[styles.filterIconBtn, isFiltered && { backgroundColor: theme.primary }]} 
                        onPress={() => setShowFilters(true)}
                    >
                        <Ionicons name="filter" size={20} color={isFiltered ? "#fff" : theme.text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.listContainer}>
                    {teachers.length === 0 ? (
                        <View style={styles.noDataContainer}>
                            <Ionicons name="people-outline" size={60} color={theme.border} />
                            <Text style={styles.noDataText}>No teachers found</Text>
                        </View>
                    ) : (
                        teachers.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.card}
                                onPress={() => router.push(`/(principal)/teachers/details/${item.id}`)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.imageContainer}>
                                    {item.photo_url ? (
                                        <Image source={{ uri: item.photo_url }} style={styles.teacherImage} />
                                    ) : (
                                        <View style={styles.placeholderImage}>
                                            <Ionicons name="person" size={28} color={theme.border} />
                                        </View>
                                    )}
                                </View>
                                <View style={styles.infoContainer}>
                                    <Text style={styles.nameText}>{item.name}</Text>
                                    <Text style={styles.subjectText}>{item.subject}</Text>
                                    <Text style={styles.qualText}>{item.qualification}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                                    <View style={{ backgroundColor: theme.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                        <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '900' }}>{item.unique_code}</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </ScrollView>

            {/* Filter BottomSheet */}
            <Modal
                visible={showFilters}
                transparent
                animationType="slide"
                onRequestClose={() => setShowFilters(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowFilters(false)}
                >
                    <TouchableOpacity 
                        activeOpacity={1} 
                        style={styles.bottomSheet}
                    >
                        <View style={styles.sheetHeader}>
                            <View style={styles.sheetHandle} />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20, marginTop: 10 }}>
                                <Text style={styles.sheetTitle}>Filter Faculty</Text>
                                <TouchableOpacity onPress={resetFilters}>
                                    <Text style={{ color: theme.primary, fontWeight: '900' }}>Reset All</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView style={{ padding: 20 }}>
                            <Text style={styles.filterLabel}>By Subject:</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                                {subjects.map((subj, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[styles.filterChip, selectedSubject === subj && styles.filterChipActive]}
                                        onPress={() => setSelectedSubject(subj)}
                                    >
                                        <Text style={[styles.filterText, selectedSubject === subj && styles.filterTextActive]}>
                                            {subj}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.filterLabel}>By Gender:</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                                {['Male', 'Female'].map(g => (
                                    <TouchableOpacity
                                        key={g}
                                        style={[styles.filterChip, { flex: 1, marginRight: 0 }, filterGender.toLowerCase() === g.toLowerCase() && styles.filterChipActive]}
                                        onPress={() => setFilterGender(filterGender.toLowerCase() === g.toLowerCase() ? '' : g)}
                                    >
                                        <Text style={[styles.filterText, filterGender.toLowerCase() === g.toLowerCase() && styles.filterTextActive, { textAlign: 'center' }]}>
                                            {g}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity 
                                style={styles.applyBtn} 
                                onPress={() => setShowFilters(false)}
                            >
                                <Text style={styles.applyBtnText}>Apply Filters</Text>
                            </TouchableOpacity>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}
