import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, StatusBar, Platform, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS, BASE_URL } from '../../../constants/Config';
import Toast from 'react-native-toast-message';

export default function CreateMarksheet() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        session: new Date().getFullYear().toString(),
        class_name: '',
        section: '',
        show_highest_marks: false
    });

    const [subjects, setSubjects] = useState([
        { name: 'English', max_theory: 80, max_practical: 20, passing_marks: 33 },
        { name: 'Mathematics', max_theory: 80, max_practical: 20, passing_marks: 33 },
        { name: 'Science', max_theory: 80, max_practical: 20, passing_marks: 33 },
        { name: 'Social Science', max_theory: 80, max_practical: 20, passing_marks: 33 },
        { name: 'Hindi', max_theory: 80, max_practical: 20, passing_marks: 33 }
    ]);

    const handleAddSubject = () => {
        setSubjects([...subjects, { name: '', max_theory: 0, max_practical: 0, passing_marks: 33 }]);
    };

    const handleSubjectChange = (index: number, field: string, value: any) => {
        const updated = [...subjects];
        // @ts-ignore
        updated[index][field] = field === 'name' ? value : (parseInt(value) || 0);
        setSubjects(updated);
    };

    const handleRemoveSubject = (index: number) => {
        if (subjects.length <= 1) return;
        setSubjects(subjects.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.class_name || !formData.section) {
            return Alert.alert('Error', 'Please fill all basic details');
        }

        if (subjects.some(s => !s.name)) {
            return Alert.alert('Error', 'Please name all subjects');
        }

        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');
            const payload = {
                ...formData,
                subjects_blueprint: subjects,
                grading_rules: [
                    { grade: 'A+', min: 90, max: 100 },
                    { grade: 'A', min: 80, max: 90 },
                    { grade: 'B+', min: 70, max: 80 },
                    { grade: 'B', min: 60, max: 70 },
                    { grade: 'C', min: 50, max: 60 },
                    { grade: 'D', min: 40, max: 50 },
                    { grade: 'F', min: 0, max: 40 }
                ],
                manual_stats: { class_topper_name: '', class_topper_marks: '', section_topper_name: '', section_topper_marks: '' }
            };

            await axios.post(`${API_ENDPOINTS.EXAM}/create`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            Toast.show({ type: 'success', text1: 'Blueprint Created!' });
            router.back();
        } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Failed to create blueprint' });
        } finally {
            setLoading(false);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 15,
            paddingTop: insets.top + 10,
            backgroundColor: theme.card,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        headerTitle: { fontSize: 18, fontWeight: '900', color: theme.text },
        content: { padding: 20 },
        sectionCard: {
            backgroundColor: theme.card,
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: theme.border,
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.05,
            shadowRadius: 10,
        },
        sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.primary, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
        inputGroup: { marginBottom: 15 },
        label: { fontSize: 12, fontWeight: '700', color: theme.textLight, marginBottom: 8, marginLeft: 4 },
        input: {
            backgroundColor: isDark ? '#1a1a1a' : '#f8fafc',
            borderRadius: 12,
            padding: 12,
            fontSize: 15,
            color: theme.text,
            borderWidth: 1,
            borderColor: theme.border,
        },
        row: { flexDirection: 'row', gap: 12 },
        flex1: { flex: 1 },
        subjectRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 12,
            alignItems: 'center',
        },
        subInput: {
            backgroundColor: isDark ? '#1a1a1a' : '#f8fafc',
            borderRadius: 10,
            padding: 10,
            fontSize: 13,
            color: theme.text,
            borderWidth: 1,
            borderColor: theme.border,
            textAlign: 'center',
        },
        addBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.primary,
            marginTop: 10,
        },
        addBtnText: { color: theme.primary, fontWeight: '800', fontSize: 14, marginLeft: 8 },
        footer: {
            padding: 20,
            paddingBottom: Math.max(20, insets.bottom + 10),
            backgroundColor: theme.card,
            borderTopWidth: 1,
            borderTopColor: theme.border,
        },
        submitBtn: {
            backgroundColor: theme.primary,
            borderRadius: 16,
            padding: 16,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 8,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
        },
        submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
        switchRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 10,
        }
    }), [theme, insets, isDark]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>New Marksheet Blueprint</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Exam Details */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Basic Configuration</Text>
                    
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>EXAMINATION NAME</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Annual Final Term 2026"
                            placeholderTextColor={theme.textLight}
                            value={formData.name}
                            onChangeText={t => setFormData({ ...formData, name: t })}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, styles.flex1]}>
                            <Text style={styles.label}>CLASS</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. X"
                                placeholderTextColor={theme.textLight}
                                value={formData.class_name}
                                onChangeText={t => setFormData({ ...formData, class_name: t })}
                            />
                        </View>
                        <View style={[styles.inputGroup, styles.flex1]}>
                            <Text style={styles.label}>SECTION</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. A"
                                placeholderTextColor={theme.textLight}
                                value={formData.section}
                                onChangeText={t => setFormData({ ...formData, section: t })}
                            />
                        </View>
                    </View>

                    <View style={styles.switchRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.label, { marginLeft: 0 }]}>SHOW HIGHEST MARKS COLUMN</Text>
                            <Text style={{ fontSize: 10, color: theme.textLight }}>Display class topper marks on report cards</Text>
                        </View>
                        <Switch
                            value={formData.show_highest_marks}
                            onValueChange={v => setFormData({ ...formData, show_highest_marks: v })}
                            trackColor={{ false: '#ddd', true: theme.primary }}
                        />
                    </View>
                </View>

                {/* Subjects Blueprint */}
                <View style={[styles.sectionCard, { paddingBottom: 15 }]}>
                    <Text style={styles.sectionTitle}>Subjects & Weightage</Text>
                    
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, paddingHorizontal: 5 }}>
                        <Text style={[styles.label, { flex: 2, textAlign: 'left' }]}>SUBJECT</Text>
                        <Text style={[styles.label, { flex: 1, textAlign: 'center' }]}>TH MAX</Text>
                        <Text style={[styles.label, { flex: 1, textAlign: 'center' }]}>PR MAX</Text>
                        <View style={{ width: 30 }} />
                    </View>

                    {subjects.map((sub, idx) => (
                        <View key={idx} style={styles.subjectRow}>
                            <TextInput
                                style={[styles.subInput, { flex: 2, textAlign: 'left', paddingHorizontal: 12 }]}
                                value={sub.name}
                                placeholder="Name"
                                placeholderTextColor={theme.textLight}
                                onChangeText={t => handleSubjectChange(idx, 'name', t)}
                            />
                            <TextInput
                                style={[styles.subInput, { flex: 1 }]}
                                value={sub.max_theory.toString()}
                                keyboardType="numeric"
                                onChangeText={t => handleSubjectChange(idx, 'max_theory', t)}
                            />
                            <TextInput
                                style={[styles.subInput, { flex: 1 }]}
                                value={sub.max_practical.toString()}
                                keyboardType="numeric"
                                onChangeText={t => handleSubjectChange(idx, 'max_practical', t)}
                            />
                            <TouchableOpacity onPress={() => handleRemoveSubject(idx)} style={{ padding: 5 }}>
                                <Ionicons name="trash-outline" size={20} color={theme.danger} />
                            </TouchableOpacity>
                        </View>
                    ))}

                    <TouchableOpacity style={styles.addBtn} onPress={handleAddSubject}>
                        <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
                        <Text style={styles.addBtnText}>Add More Subject</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Marksheet Blueprint</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
}
