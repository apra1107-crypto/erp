import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator, ScrollView, StatusBar } from 'react-native';
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTeachers();
    }, []);

    useEffect(() => {
        filterTeachers();
    }, [selectedSubject, allTeachers]);

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
        if (selectedSubject === 'All') {
            setTeachers(allTeachers);
        } else {
            setTeachers(allTeachers.filter(t => t.subject === selectedSubject));
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
            zIndex: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDark ? 0.2 : 0.05,
            shadowRadius: 10,
            elevation: 5,
        },
        backBtn: {
            padding: 8,
            borderRadius: 12,
            backgroundColor: theme.background,
            marginRight: 15
        },
        title: { fontSize: 20, fontWeight: '900', color: theme.text },

        filterContainer: {
            backgroundColor: theme.card,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        filterScroll: { paddingHorizontal: 20 },
        filterChip: {
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 15,
            backgroundColor: theme.background,
            marginRight: 10,
            borderWidth: 1,
            borderColor: theme.border,
        },
        filterChipActive: {
            backgroundColor: theme.primary,
            borderColor: theme.primary,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
        },
        filterText: { color: theme.textLight, fontWeight: '700', fontSize: 13 },
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

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Faculty Directory</Text>
            </View>

            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
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
                </ScrollView>
            </View>

            <FlatList
                data={teachers}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.noDataContainer}>
                        <Ionicons name="people-outline" size={60} color={theme.border} />
                        <Text style={styles.noDataText}>No teachers found</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
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
                        <Ionicons name="chevron-forward" size={20} color={theme.textLight} />
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}
