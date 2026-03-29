import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, StatusBar, Modal, TextInput, Alert, FlatList, LayoutAnimation, Platform, UIManager, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CACHE_KEY = 'principal_students_cache';

export default function SelectClass() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [filterClass, setFilterClass] = useState<string>('');
    const [filterSection, setFilterSection] = useState<string>('');
    const [filterGender, setFilterGender] = useState<string>('');
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const { isDark, theme } = useTheme();

    // Load Cache First
    useEffect(() => {
        const loadCache = async () => {
            try {
                const cached = await AsyncStorage.getItem(CACHE_KEY);
                if (cached) {
                    const data = JSON.parse(cached);
                    setAllStudents(data);
                    setFilteredStudents(data);
                    const uniqueClasses = [...new Set(data.map((s: any) => s.class))].sort();
                    setClasses(uniqueClasses as string[]);
                    setLoading(false); // Hide spinner immediately if we have cache
                }
            } catch (e) {
                console.error('Cache load error:', e);
            }
            fetchClasses(); // Background fetch
        };
        loadCache();
    }, []);

    useEffect(() => {
        let filtered = allStudents;
        if (filterClass) filtered = filtered.filter(s => s.class === filterClass);
        if (filterSection) filtered = filtered.filter(s => s.section === filterSection);
        if (filterGender) filtered = filtered.filter(s => (s.gender || '').toLowerCase() === filterGender.toLowerCase());
        
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFilteredStudents(filtered);
    }, [filterClass, filterSection, filterGender, allStudents]);

    const fetchClasses = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
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

            const data = response.data.students;
            const sortedData = data.sort((a: any, b: any) => {
                if (a.class !== b.class) return a.class.toString().localeCompare(b.class.toString(), undefined, { numeric: true });
                if (a.section !== b.section) return a.section.localeCompare(b.section);
                return parseInt(a.roll_no) - parseInt(b.roll_no);
            });

            // Update UI smoothly
            LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
            setAllStudents(sortedData);
            setFilteredStudents(sortedData);
            
            const uniqueClasses = [...new Set(data.map((s: any) => s.class))].sort();
            setClasses(uniqueClasses as string[]);
            
            // Background update cache
            AsyncStorage.setItem(CACHE_KEY, JSON.stringify(sortedData));
        } catch (error) {
            console.error('Error fetching classes:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
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
    };

    const handleSectionFilter = (sec: string) => {
        setFilterSection(filterSection === sec ? '' : sec);
    };

    const renderStudentItem = useCallback(({ item }: { item: any }) => (
        <TouchableOpacity
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
            <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
                <View style={{ backgroundColor: theme.primary + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <Text style={{ fontSize: 10, color: theme.primary, fontWeight: '900' }}>{item.unique_code}</Text>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.icon} />
        </TouchableOpacity>
    ), [theme]);

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        header: { backgroundColor: 'transparent', paddingTop: insets.top + 10, paddingBottom: 15, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
        backButton: { padding: 5, marginRight: 15 },
        title: { fontSize: 20, fontWeight: 'bold' },
        listContainer: { padding: 20, paddingBottom: 100 },
        card: { backgroundColor: theme.card, borderRadius: 16, padding: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
        avatarContainer: { marginRight: 15 },
        studentImg: { width: 50, height: 50, borderRadius: 25 },
        placeholderIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
        studentInfo: { flex: 1 },
        studentName: { fontSize: 16, fontWeight: '700' },
        studentMeta: { fontSize: 13, marginTop: 4 },
        clearText: { color: theme.primary, fontSize: 14, fontWeight: '900' },
        noDataText: { textAlign: 'center', fontSize: 16, color: theme.textLight, marginTop: 50 },
        filterIconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.border },
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        bottomSheet: { backgroundColor: theme.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '80%' },
        sheetHeader: { alignItems: 'center', paddingVertical: 10 },
        sheetHandle: { width: 40, height: 5, backgroundColor: theme.border, borderRadius: 3, marginTop: 10, marginBottom: 5 },
        sheetTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        filterGroup: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
        filterLabel: { fontWeight: '900', fontSize: 13, color: theme.textLight, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
        filterChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, marginRight: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.background },
        filterChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
        filterText: { fontSize: 14, color: theme.text, fontWeight: '700' },
        filterTextActive: { color: '#fff', fontWeight: '900' },
        applyBtn: { backgroundColor: theme.primary, paddingVertical: 18, borderRadius: 18, alignItems: 'center', marginTop: 10, elevation: 4, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
        applyBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
    }), [theme, insets]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: theme.text }]}>All Students</Text>
                    <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '800' }}>
                        Total: {filteredStudents.length} Students
                    </Text>
                </View>
                <TouchableOpacity 
                    style={[styles.filterIconBtn, (filterClass || filterSection || filterGender) && { backgroundColor: theme.primary }]} 
                    onPress={() => setShowFilters(true)}
                >
                    <Ionicons name="filter" size={20} color={(filterClass || filterSection || filterGender) ? "#fff" : theme.text} />
                </TouchableOpacity>
            </View>

            {loading && allStudents.length === 0 ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={{ marginTop: 10, color: theme.textLight, fontWeight: '600' }}>Loading student records...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredStudents}
                    renderItem={renderStudentItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContainer}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    onRefresh={() => fetchClasses(true)}
                    refreshing={refreshing}
                    ListEmptyComponent={<Text style={styles.noDataText}>No students matching filters</Text>}
                />
            )}

            <Modal visible={showFilters} transparent animationType="slide" onRequestClose={() => setShowFilters(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFilters(false)}>
                    <TouchableOpacity activeOpacity={1} style={styles.bottomSheet}>
                        <View style={styles.sheetHeader}><View style={styles.sheetHandle} /><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20, marginTop: 10 }}><Text style={styles.sheetTitle}>Filter Students</Text><TouchableOpacity onPress={resetFilters}><Text style={styles.clearText}>Reset All</Text></TouchableOpacity></View></View>
                        <ScrollView style={{ padding: 20 }}>
                            <Text style={styles.filterLabel}>Select Class:</Text>
                            <View style={styles.filterGroup}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {classes.map((cls: string) => (
                                        <TouchableOpacity key={cls} style={[styles.filterChip, filterClass === cls && styles.filterChipActive]} onPress={() => handleClassFilter(cls)}>
                                            <Text style={[styles.filterText, filterClass === cls && styles.filterTextActive]}>{cls}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                            {filterClass && sections.length > 0 && (
                                <>
                                    <Text style={styles.filterLabel}>Select Section:</Text>
                                    <View style={styles.filterGroup}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            {sections.map(sec => (
                                                <TouchableOpacity key={sec} style={[styles.filterChip, filterSection === sec && styles.filterChipActive]} onPress={() => handleSectionFilter(sec)}>
                                                    <Text style={[styles.filterText, filterSection === sec && styles.filterTextActive]}>{sec}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                </>
                            )}
                            <Text style={styles.filterLabel}>Gender:</Text>
                            <View style={styles.filterGroup}>
                                {['Male', 'Female', 'Other'].map(g => (
                                    <TouchableOpacity key={g} style={[styles.filterChip, filterGender.toLowerCase() === g.toLowerCase() && styles.filterChipActive]} onPress={() => setFilterGender(filterGender.toLowerCase() === g.toLowerCase() ? '' : g)}>
                                        <Text style={[styles.filterText, filterGender.toLowerCase() === g.toLowerCase() && styles.filterTextActive]}>{g}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilters(false)}><Text style={styles.applyBtnText}>Apply Filters</Text></TouchableOpacity>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

