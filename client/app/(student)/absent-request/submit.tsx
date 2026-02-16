import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, StatusBar, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';

export default function SubmitAbsentNote() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [date, setDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const formatDate = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatDateForAPI = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleSubmit = async () => {
        if (!reason.trim()) {
            Toast.show({
                type: 'error',
                text1: 'Required',
                text2: 'Please provide a reason for absence'
            });
            return;
        }

        setSubmitting(true);
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const dateStr = formatDateForAPI(date);

            await axios.post(
                `${API_ENDPOINTS.ABSENT_REQUEST}/submit`,
                { date: dateStr, reason: reason.trim() },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            Toast.show({
                type: 'success',
                text1: 'Submitted',
                text2: 'Absent note submitted successfully'
            });

            router.replace('/(student)/absent-request/my-requests');
        } catch (error: any) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.message || 'Failed to submit request'
            });
        } finally {
            setSubmitting(false);
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
        backBtn: { padding: 8, borderRadius: 12, backgroundColor: theme.background, marginRight: 15 },
        title: { fontSize: 20, fontWeight: '900', color: theme.text },
        content: { flex: 1, padding: 20 },
        label: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 10, marginTop: 20 },
        dateButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.card,
            padding: 18,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
        },
        dateButtonText: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.text, marginLeft: 10 },
        textArea: {
            backgroundColor: theme.card,
            borderRadius: 18,
            padding: 18,
            height: 150,
            fontSize: 16,
            color: theme.text,
            borderWidth: 1,
            borderColor: theme.border,
            textAlignVertical: 'top',
        },
        submitBtn: {
            backgroundColor: theme.primary,
            padding: 18,
            borderRadius: 20,
            alignItems: 'center',
            marginTop: 40,
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 5,
        },
        submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },
    }), [theme, isDark]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.card} translucent={true} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>New Absent Note</Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    <Text style={styles.label}>Select Date</Text>
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                        <Ionicons name="calendar-outline" size={24} color={theme.primary} />
                        <Text style={styles.dateButtonText}>{formatDate(date)}</Text>
                        <Ionicons name="chevron-down" size={20} color={theme.textLight} />
                    </TouchableOpacity>

                    <Text style={styles.label}>Reason for Absence</Text>
                    <TextInput
                        style={styles.textArea}
                        placeholder="Explain why you will be absent..."
                        placeholderTextColor={theme.textLight}
                        multiline
                        numberOfLines={6}
                        value={reason}
                        onChangeText={setReason}
                    />

                    <TouchableOpacity
                        style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.submitBtnText}>Submit Request</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            {showDatePicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) setDate(selectedDate);
                    }}
                />
            )}
        </View>
    );
}
