import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../../constants/Config';

export default function SelectSection() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const { class: selectedClass } = useLocalSearchParams();
    const [sections, setSections] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSections();
    }, [selectedClass]);

    const fetchSections = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(
                `${API_ENDPOINTS.PRINCIPAL}/student/list`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const students = response.data.students;
            const classStudents = students.filter((s: any) => s.class === selectedClass);
            const uniqueSections = [...new Set(classStudents.map((s: any) => s.section))].sort();
            setSections(uniqueSections as string[]);
        } catch (error) {
            console.error('Error fetching sections:', error);
        } finally {
            setLoading(false);
        }
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

        listContainer: { padding: 20 },
        card: {
            backgroundColor: theme.card,
            borderRadius: 24,
            padding: 24,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05, shadowRadius: 15, elevation: 3,
        },
        iconContainer: {
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: theme.primary + '15',
            justifyContent: 'center', alignItems: 'center',
            marginRight: 20,
        },
        cardText: { fontSize: 18, fontWeight: '800', color: theme.text, flex: 1 },

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
                <Text style={styles.title}>Class {selectedClass} - Sections</Text>
            </View>

            <ScrollView contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false}>
                {sections.length === 0 ? (
                    <View style={styles.noDataContainer}>
                        <Ionicons name="layers-outline" size={60} color={theme.border} />
                        <Text style={styles.noDataText}>No sections found</Text>
                    </View>
                ) : (
                    sections.map((sec, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.card}
                            onPress={() => router.push(`/(principal)/students/${selectedClass}/${sec}`)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.iconContainer}>
                                <Ionicons name="grid-outline" size={28} color={theme.primary} />
                            </View>
                            <Text style={styles.cardText}>Section {sec}</Text>
                            <Ionicons name="chevron-forward" size={24} color={theme.textLight} />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
