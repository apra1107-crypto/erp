import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../context/ThemeContext';
import axios from 'axios';
import { API_ENDPOINTS } from '../../../constants/Config';
import Toast from 'react-native-toast-message';

export default function PrincipalHomeworkClassSelection() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [classes, setClasses] = useState<string[]>([]);
    const [sectionsMap, setSectionsMap] = useState<{ [key: string]: string[] }>({});

    useEffect(() => {
        fetchAllClasses();
    }, []);

    const fetchAllClasses = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token'); // Principal token
            
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data && Array.isArray(response.data.students)) {
                const students = response.data.students;
                const classMap: { [key: string]: Set<string> } = {};
                
                students.forEach((s: any) => {
                    if (!classMap[s.class]) {
                        classMap[s.class] = new Set();
                    }
                    classMap[s.class].add(s.section);
                });

                const sortedClasses = Object.keys(classMap).sort((a, b) => {
                    const numA = parseInt(a);
                    const numB = parseInt(b);
                    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                    return a.localeCompare(b);
                });

                const finalSectionsMap: { [key: string]: string[] } = {};
                sortedClasses.forEach(cls => {
                    finalSectionsMap[cls] = Array.from(classMap[cls]).sort();
                });

                setClasses(sortedClasses);
                setSectionsMap(finalSectionsMap);
            }
        } catch (error) {
            console.error('Error fetching all classes for homework:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load classes' });
        } finally {
            setLoading(false);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            backgroundColor: theme.card,
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        backBtn: { padding: 5, marginRight: 15 },
        headerTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        content: { padding: 20 },
        sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.textLight, marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1 },
        classCard: {
            backgroundColor: theme.card,
            borderRadius: 24,
            marginBottom: 20,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05, elevation: 2,
        },
        cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
        classBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
        classBadgeText: { fontSize: 18, fontWeight: '900', color: theme.primary },
        className: { fontSize: 18, fontWeight: '800', color: theme.text },
        sectionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
        sectionChip: { backgroundColor: isDark ? theme.background : '#f8f9fa', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, minWidth: 80, alignItems: 'center' },
        sectionName: { fontSize: 14, fontWeight: '700', color: theme.text },
        emptyBox: { alignItems: 'center', marginTop: 100 },
        emptyText: { color: theme.textLight, fontSize: 16, fontWeight: '600', marginTop: 15 }
    }), [theme, insets, isDark]);

    if (loading) return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator size="large" color={theme.primary} /></View>;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
                <Text style={styles.headerTitle}>Homework Hub</Text>
            </View>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionTitle}>Select Class & Section</Text>
                {classes.length > 0 ? (
                    classes.map((cls) => (
                        <View key={cls} style={styles.classCard}>
                            <View style={styles.cardHeader}>
                                <View style={styles.classBadge}><Text style={styles.classBadgeText}>{cls}</Text></View>
                                <Text style={styles.className}>Class {cls}</Text>
                            </View>
                            <View style={styles.sectionsRow}>
                                {sectionsMap[cls]?.map((sec) => (
                                    <TouchableOpacity
                                        key={sec}
                                        style={styles.sectionChip}
                                        onPress={() => router.push({
                                            pathname: `/(principal)/homework/[classSection]`,
                                            params: { classSection: `${cls}-${sec}`, className: cls, section: sec }
                                        })}
                                    >
                                        <Text style={styles.sectionName}>Section {sec}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyBox}><Ionicons name="school-outline" size={60} color={theme.border} /><Text style={styles.emptyText}>No classes found</Text></View>
                )}
            </ScrollView>
        </View>
    );
}
