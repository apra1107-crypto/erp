import { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform, Dimensions, FlatList, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS, BASE_URL } from '../../constants/Config';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight, Layout } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AccountSetup() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [bankAccounts, setBankAccounts] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);

    const [formData, setFormData] = useState({
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        account_holder_name: '',
        is_primary: false
    });

    useFocusEffect(
        useCallback(() => {
            fetchBankAccounts();
        }, [])
    );

    const fetchBankAccounts = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(`${BASE_URL}/api/principal/bank-accounts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBankAccounts(response.data);
            if (response.data.length === 0) setShowForm(true);
            else setShowForm(false);
        } catch (error) {
            console.error('Fetch bank accounts error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to fetch bank accounts' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.bank_name || !formData.account_number || !formData.ifsc_code || !formData.account_holder_name) {
            Toast.show({ type: 'error', text1: 'Required Fields', text2: 'Please fill all bank details' });
            return;
        }

        try {
            setSaving(true);
            const token = await AsyncStorage.getItem('token');
            
            if (editingAccount) {
                await axios.put(
                    `${BASE_URL}/api/principal/bank-accounts/${editingAccount.id}`,
                    formData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                Toast.show({ type: 'success', text1: 'Success', text2: 'Account updated successfully' });
            } else {
                await axios.post(
                    `${BASE_URL}/api/principal/bank-accounts`,
                    formData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                Toast.show({ type: 'success', text1: 'Success', text2: 'New account added successfully' });
            }

            setEditingAccount(null);
            setFormData({ bank_name: '', account_number: '', ifsc_code: '', account_holder_name: '', is_primary: false });
            fetchBankAccounts();
        } catch (error) {
            console.error('Save bank account error:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to save account' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert('Delete Account', 'Are you sure you want to remove this bank account?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive', 
                onPress: async () => {
                    try {
                        const token = await AsyncStorage.getItem('token');
                        await axios.delete(`${BASE_URL}/api/principal/bank-accounts/${id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        Toast.show({ type: 'success', text1: 'Deleted', text2: 'Account removed' });
                        fetchBankAccounts();
                    } catch (e) {
                        Toast.show({ type: 'error', text1: 'Error', text2: 'Delete failed' });
                    }
                }
            }
        ]);
    };

    const startEditing = (acc: any) => {
        setEditingAccount(acc);
        setFormData({
            bank_name: acc.bank_name,
            account_number: acc.account_number,
            ifsc_code: acc.ifsc_code,
            account_holder_name: acc.account_holder_name,
            is_primary: acc.is_primary
        });
        setShowForm(true);
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        header: {
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        backBtn: {
            padding: 8,
            borderRadius: 12,
            backgroundColor: theme.card,
        },
        title: { fontSize: 22, fontWeight: '900', color: theme.text },
        content: { paddingHorizontal: 20 },
        
        // FLASHCARD STYLE
        bankCard: {
            width: SCREEN_WIDTH - 40,
            height: 200,
            borderRadius: 24,
            marginBottom: 20,
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            overflow: 'hidden',
        },
        cardGradient: {
            flex: 1,
            padding: 24,
            justifyContent: 'space-between',
        },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
        },
        chip: {
            width: 45,
            height: 32,
            borderRadius: 6,
            backgroundColor: '#FFD700',
            opacity: 0.8,
            marginBottom: 10,
        },
        cardBankName: {
            fontSize: 18,
            fontWeight: '900',
            color: '#fff',
            letterSpacing: 1,
            textTransform: 'uppercase',
        },
        cardPrimaryBadge: {
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
        },
        cardPrimaryText: {
            color: '#fff',
            fontSize: 10,
            fontWeight: '900',
        },
        cardNumber: {
            fontSize: 22,
            color: '#fff',
            letterSpacing: 3,
            fontWeight: '700',
            marginVertical: 15,
        },
        cardFooter: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
        },
        cardHolderLabel: {
            fontSize: 10,
            color: 'rgba(255,255,255,0.7)',
            textTransform: 'uppercase',
            marginBottom: 4,
        },
        cardHolderName: {
            fontSize: 14,
            color: '#fff',
            fontWeight: '800',
        },
        cardIfsc: {
            fontSize: 12,
            color: '#fff',
            fontWeight: '700',
            opacity: 0.9,
        },
        cardActions: {
            flexDirection: 'row',
            gap: 12,
            alignItems: 'center',
        },
        actionBtn: {
            padding: 4,
        },

        // FORM STYLE
        formCard: {
            backgroundColor: theme.card,
            borderRadius: 24,
            padding: 24,
            elevation: 8,
            borderWidth: 1,
            borderColor: theme.border,
            marginBottom: 30,
        },
        formHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
            gap: 12,
        },
        iconContainer: {
            width: 44,
            height: 44,
            borderRadius: 14,
            justifyContent: 'center',
            alignItems: 'center',
        },
        formTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
        
        inputGroup: { marginBottom: 18 },
        label: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.textLight,
            marginBottom: 8,
            marginLeft: 4,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        inputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.background,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 15,
        },
        input: { flex: 1, paddingVertical: 12, fontSize: 16, color: theme.text, fontWeight: '600' },
        
        primaryToggle: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20,
            paddingHorizontal: 5,
        },
        toggleText: { fontSize: 14, color: theme.text, fontWeight: '700' },

        saveBtn: { borderRadius: 18, overflow: 'hidden', elevation: 6 },
        gradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
        saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
        
        cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 10 },
        cancelText: { color: theme.textLight, fontWeight: '700' },

        addAnotherBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
            borderRadius: 20,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: theme.primary,
            marginBottom: 30,
            gap: 10,
        },
        addAnotherText: { color: theme.primary, fontSize: 16, fontWeight: '800' },
    }), [theme, insets]);

    const renderBankAccount = ({ item, index }: { item: any, index: number }) => {
        const gradientColors = index % 2 === 0 ? ['#1e3a8a', '#1e40af', '#1d4ed8'] : ['#4c1d95', '#5b21b6', '#6d28d9'];
        
        return (
            <Animated.View 
                entering={FadeInRight.delay(index * 100)} 
                layout={Layout.springify()}
                style={styles.bankCard}
            >
                <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient}>
                    <View style={styles.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <View style={styles.chip} />
                            <Text style={styles.cardBankName} numberOfLines={1}>{item.bank_name}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <View style={styles.cardActions}>
                                <TouchableOpacity onPress={() => startEditing(item)} style={styles.actionBtn}>
                                    <Ionicons name="pencil-outline" size={20} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                                    <Ionicons name="trash-outline" size={20} color="rgba(255,255,255,0.8)" />
                                </TouchableOpacity>
                            </View>
                            {item.is_primary && (
                                <View style={[styles.cardPrimaryBadge, { marginTop: 8 }]}>
                                    <Text style={styles.cardPrimaryText}>PRIMARY</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <Text style={styles.cardNumber}>
                        {item.account_number}
                    </Text>

                    <View style={styles.cardFooter}>
                        <View>
                            <Text style={styles.cardHolderLabel}>Account Holder</Text>
                            <Text style={styles.cardHolderName}>{item.account_holder_name}</Text>
                        </View>
                        <Text style={styles.cardIfsc}>IFSC: {item.ifsc_code}</Text>
                    </View>
                </LinearGradient>
            </Animated.View>
        );
    };

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <StatusBar barStyle={theme.statusBarStyle} />
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: insets.top + 10 }}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Account Setup</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.content}>
                    {!showForm && bankAccounts.length > 0 && (
                        <>
                            {bankAccounts.map((item, index) => (
                                <View key={item.id}>
                                    {renderBankAccount({ item, index })}
                                </View>
                            ))}

                            <TouchableOpacity 
                                style={styles.addAnotherBtn} 
                                onPress={() => {
                                    setEditingAccount(null);
                                    setFormData({ bank_name: '', account_number: '', ifsc_code: '', account_holder_name: '', is_primary: false });
                                    setShowForm(true);
                                }}
                            >
                                <Ionicons name="add-circle-outline" size={24} color={theme.primary} />
                                <Text style={styles.addAnotherText}>Add Another Account</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {showForm && (
                        <Animated.View entering={FadeInDown} style={styles.formCard}>
                            <View style={styles.formHeader}>
                                <LinearGradient colors={[theme.primary, theme.primary + '80']} style={styles.iconContainer}>
                                    <Ionicons name={editingAccount ? "pencil" : "add"} size={24} color="#fff" />
                                </LinearGradient>
                                <Text style={styles.formTitle}>{editingAccount ? 'Edit Account' : 'Add New Account'}</Text>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Account Holder Name</Text>
                                <View style={styles.inputContainer}>
                                    <TextInput 
                                        style={styles.input}
                                        value={formData.account_holder_name}
                                        onChangeText={(t) => setFormData({ ...formData, account_holder_name: t })}
                                        placeholder="Full Name"
                                        placeholderTextColor={theme.textLight + '80'}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Bank Name</Text>
                                <View style={styles.inputContainer}>
                                    <TextInput 
                                        style={styles.input}
                                        value={formData.bank_name}
                                        onChangeText={(t) => setFormData({ ...formData, bank_name: t })}
                                        placeholder="Bank Name"
                                        placeholderTextColor={theme.textLight + '80'}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Account Number</Text>
                                <View style={styles.inputContainer}>
                                    <TextInput 
                                        style={styles.input}
                                        value={formData.account_number}
                                        onChangeText={(t) => setFormData({ ...formData, account_number: t })}
                                        placeholder="Account Number"
                                        keyboardType="number-pad"
                                        placeholderTextColor={theme.textLight + '80'}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>IFSC Code</Text>
                                <View style={styles.inputContainer}>
                                    <TextInput 
                                        style={styles.input}
                                        value={formData.ifsc_code}
                                        onChangeText={(t) => setFormData({ ...formData, ifsc_code: t.toUpperCase() })}
                                        placeholder="IFSC Code"
                                        autoCapitalize="characters"
                                        placeholderTextColor={theme.textLight + '80'}
                                    />
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={styles.primaryToggle}
                                onPress={() => setFormData({ ...formData, is_primary: !formData.is_primary })}
                            >
                                <Ionicons 
                                    name={formData.is_primary ? "checkbox" : "square-outline"} 
                                    size={24} 
                                    color={theme.primary} 
                                />
                                <Text style={styles.toggleText}>Set as Primary Account</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                                <LinearGradient colors={[theme.primary, theme.primary + 'CC']} style={styles.gradient}>
                                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editingAccount ? 'Update Account' : 'Save Account'}</Text>}
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.cancelBtn} 
                                onPress={() => {
                                    if (bankAccounts.length > 0) setShowForm(false);
                                    else router.back();
                                }}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}