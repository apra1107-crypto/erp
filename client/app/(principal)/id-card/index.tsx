import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Dimensions, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function IDCardSections() {
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [allSections, setAllSections] = useState<any[]>([]);
    const [filteredSections, setFilteredSections] = useState<any[]>([]);
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [filterClass, setFilterClass] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);

    const fetchSections = async () => {
        try {
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/student/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const students = response.data.students || [];
            const sectionsMap = students.reduce((acc: any, student: any) => {
                const key = `${student.class}-${student.section}`;
                if (!acc[key]) {
                    acc[key] = { class: student.class, section: student.section, count: 0 };
                }
                acc[key].count++;
                return acc;
            }, {});

            const sectionList = Object.values(sectionsMap).sort((a: any, b: any) => {
                if (a.class !== b.class) return a.class.localeCompare(b.class, undefined, { numeric: true });
                return a.section.localeCompare(b.section);
            });
            
            // Extract unique classes for the filter
            const uniqueClasses = [...new Set(sectionList.map((s: any) => s.class))].sort((a: any, b: any) => a.localeCompare(b, undefined, { numeric: true }));

            setAllSections(sectionList);
            setFilteredSections(sectionList);
            setAvailableClasses(uniqueClasses);
        } catch (error) {
            console.error('Error fetching students:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load students' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchSections(); }, []));

    useEffect(() => {
        let filtered = allSections;
        if (filterClass) {
            filtered = allSections.filter(s => s.class === filterClass);
        }
        setFilteredSections(filtered);
    }, [filterClass, allSections]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchSections();
    };

    const renderSectionCard = ({ item, index }: { item: any, index: number }) => (
        <Animated.View entering={FadeInUp.delay(index * 100)}>
            <TouchableOpacity 
                style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => router.push({
                    pathname: `/(principal)/id-card/[classSection]`,
                    params: { classSection: `${item.class}-${item.section}`, className: item.class, section: item.section }
                })}
            >
                <View style={styles.cardIconWrapper}>
                    <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                        <Ionicons name="person-circle-outline" size={28} color={theme.primary} />
                    </View>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{item.count}</Text>
                    </View>
                </View>
                <View style={styles.cardContent}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Class {item.class} - {item.section}</Text>
                    <Text style={[styles.sectionSub, { color: theme.textLight }]}>Generate Digital IDs</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.border} />
            </TouchableOpacity>
        </Animated.View>
    );

    const styles = StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            paddingHorizontal: 20, 
            paddingBottom: 15, 
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
        },
        backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
        headerText: { marginLeft: 15 },
        title: { fontSize: 20, fontWeight: '800', color: theme.text },
        subtitle: { fontSize: 12, color: theme.textLight },
        activeFilterDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary, borderWidth: 1, borderColor: theme.card },
        
        listContent: { padding: 20, paddingBottom: 40 },
        sectionCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 15, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
        cardIconWrapper: { position: 'relative', marginRight: 15 },
        iconCircle: { width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
        countBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: theme.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 2, borderColor: theme.card },
        countText: { color: '#fff', fontSize: 10, fontWeight: '900' },
        cardContent: { flex: 1 },
        sectionTitle: { fontSize: 16, fontWeight: '800' },
        sectionSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },

        // Modal Styles
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
        filterModal: { width: '85%', maxHeight: '70%', borderRadius: 25, padding: 20, elevation: 10 },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: theme.border },
        modalTitle: { fontSize: 18, fontWeight: '800' },
        modalBody: { maxHeight: 400 },
        filterOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 8 },
        filterOptionText: { fontSize: 16, fontWeight: '700' }
    });

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <View style={styles.headerText}>
                        <Text style={styles.title}>ID Cards</Text>
                        <Text style={styles.subtitle}>Select a section to manage IDs</Text>
                    </View>
                </View>

                <TouchableOpacity 
                    style={[styles.backBtn, filterClass && { borderColor: theme.primary, backgroundColor: theme.primary + '10' }]} 
                    onPress={() => setShowFilterModal(true)}
                >
                    <Ionicons name="filter" size={20} color={filterClass ? theme.primary : theme.text} />
                    {filterClass ? <View style={styles.activeFilterDot} /> : null}
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : (
                <FlatList 
                    data={filteredSections}
                    renderItem={renderSectionCard}
                    keyExtractor={(item) => `${item.class}-${item.section}`}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Ionicons name="card-outline" size={64} color={theme.border} />
                            <Text style={{ color: theme.textLight, marginTop: 10, fontSize: 16 }}>
                                {filterClass ? `No sections found for Grade ${filterClass}` : "No students found"}
                            </Text>
                            {filterClass && (
                                <TouchableOpacity 
                                    style={{ marginTop: 20, padding: 10 }}
                                    onPress={() => setFilterClass('')}
                                >
                                    <Text style={{ color: theme.primary, fontWeight: '800' }}>Clear Filter</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}

            {/* Filter Modal */}
            <Modal
                visible={showFilterModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowFilterModal(false)}
            >
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowFilterModal(false)}
                >
                    <View style={[styles.filterModal, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Grade</Text>
                            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <TouchableOpacity 
                                style={[styles.filterOption, !filterClass && { backgroundColor: theme.primary + '15' }]}
                                onPress={() => { setFilterClass(''); setShowFilterModal(false); }}
                            >
                                <Text style={[styles.filterOptionText, { color: !filterClass ? theme.primary : theme.text }]}>All Grades</Text>
                                {!filterClass && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                            </TouchableOpacity>

                            {availableClasses.map((cls) => (
                                <TouchableOpacity 
                                    key={cls}
                                    style={[styles.filterOption, filterClass === cls && { backgroundColor: theme.primary + '15' }]}
                                    onPress={() => { setFilterClass(cls); setShowFilterModal(false); }}
                                >
                                    <Text style={[styles.filterOptionText, { color: filterClass === cls ? theme.primary : theme.text }]}>Grade {cls}</Text>
                                    {filterClass === cls && <Ionicons name="checkmark" size={20} color={theme.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}
