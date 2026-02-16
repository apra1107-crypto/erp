import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, StatusBar, TextInput, Alert, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS } from '../../../constants/Config';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

export default function SalaryManagementScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { isDark, theme } = useTheme();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [salaryAmounts, setSalaryAmounts] = useState<{ [key: number]: string }>({});
    const [paying, setPaying] = useState<number | null>(null);

    const selectedMonth = useMemo(() => {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }, [currentDate]);

    useEffect(() => {
        fetchSalaries();
    }, [selectedMonth]);

    const fetchSalaries = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('token');
            const userData = await AsyncStorage.getItem('userData');
            const sessionId = userData ? JSON.parse(userData).current_session_id : null;

            const res = await axios.get(`${API_ENDPOINTS.SALARY}/list?month=${selectedMonth}`, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            setTeachers(res.data);
            
            // Pre-fill amounts with existing paid amounts or empty
            const amounts: any = {};
            res.data.forEach((t: any) => {
                amounts[t.id] = t.amount ? String(t.amount) : '';
            });
            setSalaryAmounts(amounts);
        } catch (error) {
            console.error('Error fetching salaries:', error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to load teacher salaries' });
        } finally {
            setLoading(false);
        }
    };

    const handlePay = async (teacher: any) => {
        const amount = salaryAmounts[teacher.id];
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid salary amount");
            return;
        }

        Alert.alert(
            "Confirm Payment",
            `Mark salary of ₹${amount} as paid for ${teacher.name} for ${selectedMonth}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Pay",
                    onPress: async () => {
                        try {
                            setPaying(teacher.id);
                            const token = await AsyncStorage.getItem('token');
                            const userData = await AsyncStorage.getItem('userData');
                            const sessionId = userData ? JSON.parse(userData).current_session_id : null;

                            await axios.post(`${API_ENDPOINTS.SALARY}/pay`, {
                                teacherId: teacher.id,
                                amount: parseFloat(amount),
                                month_year: selectedMonth
                            }, {
                                headers: { 
                                    Authorization: `Bearer ${token}`,
                                    'x-academic-session-id': sessionId?.toString()
                                }
                            });

                            Toast.show({ type: 'success', text1: 'Success', text2: `Salary paid to ${teacher.name}` });
                            fetchSalaries();
                        } catch (error) {
                            console.error('Pay error:', error);
                            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to process payment' });
                        } finally {
                            setPaying(null);
                        }
                    }
                }
            ]
        );
    };

    const handlePreviousMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        header: {
            paddingTop: insets.top + 10,
            paddingBottom: 15,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'transparent',
        },
        title: { fontSize: 22, fontWeight: '900', color: theme.text, marginLeft: 15 },
        monthSelector: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            marginHorizontal: 20,
            backgroundColor: theme.card,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
            marginBottom: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            elevation: 2,
        },
        monthText: { color: theme.text, fontWeight: '800', fontSize: 16, marginHorizontal: 20, minWidth: 140, textAlign: 'center' },
        list: { paddingHorizontal: 20, paddingBottom: 40 },
        card: {
            backgroundColor: theme.card, borderRadius: 24, padding: 16, marginBottom: 15,
            borderWidth: 1, borderColor: theme.border, shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3
        },
        teacherInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
        avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12, borderWidth: 1, borderColor: theme.border },
        name: { fontSize: 16, fontWeight: '800', color: theme.text },
        subject: { fontSize: 12, color: theme.textLight, marginTop: 2 },
        paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        inputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.background, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12 },
        currency: { fontSize: 16, fontWeight: '800', color: theme.textLight, marginRight: 4 },
        input: { flex: 1, height: 48, color: theme.text, fontSize: 16, fontWeight: '700' },
        payBtn: { backgroundColor: theme.primary, paddingHorizontal: 20, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
        payBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
        paidBadge: { backgroundColor: '#27AE6015', paddingHorizontal: 15, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#27AE6030', gap: 6 },
        paidText: { color: '#27AE60', fontWeight: '900', fontSize: 13 },
        paidDate: { fontSize: 10, color: theme.textLight, marginTop: 4, textAlign: 'right' },
    }), [theme, insets]);

    if (loading) return <View style={{flex:1, justifyContent:'center', alignItems:'center', backgroundColor:theme.background}}><ActivityIndicator size="large" color={theme.primary}/></View>;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Salary Manager</Text>
            </View>

            <View style={styles.monthSelector}>
                <TouchableOpacity onPress={handlePreviousMonth}><Ionicons name="chevron-back" size={24} color={theme.primary} /></TouchableOpacity>
                <Text style={styles.monthText}>{selectedMonth}</Text>
                <TouchableOpacity onPress={handleNextMonth}><Ionicons name="chevron-forward" size={24} color={theme.primary} /></TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
                {teachers.length === 0 ? (
                    <View style={{alignItems:'center', marginTop: 100}}>
                        <Ionicons name="people-outline" size={80} color={theme.border} />
                        <Text style={{color: theme.textLight, marginTop: 20}}>No active teachers found in this session.</Text>
                    </View>
                ) : (
                    teachers.map((teacher) => (
                        <View key={teacher.id} style={styles.card}>
                            <View style={styles.teacherInfo}>
                                <Image 
                                    source={teacher.photo_url ? { uri: teacher.photo_url } : require('../../../assets/images/favicon.png')} 
                                    style={styles.avatar} 
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.name}>{teacher.name}</Text>
                                    <Text style={styles.subject}>{teacher.subject}</Text>
                                </View>
                                {teacher.status === 'paid' && (
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 14, fontWeight: '900', color: theme.text }}>₹{parseFloat(teacher.amount).toLocaleString()}</Text>
                                        <Text style={styles.paidDate}>Paid on {new Date(teacher.paid_at).toLocaleDateString('en-IN')}</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.paymentRow}>
                                {teacher.status === 'paid' ? (
                                    <View style={[styles.paidBadge, { flex: 1, justifyContent: 'center' }]}>
                                        <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
                                        <Text style={styles.paidText}>SALARY PAID</Text>
                                    </View>
                                ) : (
                                    <>
                                        <View style={styles.inputContainer}>
                                            <Text style={styles.currency}>₹</Text>
                                            <TextInput 
                                                style={styles.input}
                                                placeholder="Enter Amount"
                                                placeholderTextColor={theme.textLight + '60'}
                                                keyboardType="numeric"
                                                value={salaryAmounts[teacher.id]}
                                                onChangeText={(val) => setSalaryAmounts({ ...salaryAmounts, [teacher.id]: val })}
                                            />
                                        </View>
                                        <TouchableOpacity 
                                            style={[styles.payBtn, paying === teacher.id && { opacity: 0.7 }]} 
                                            onPress={() => handlePay(teacher)}
                                            disabled={paying !== null}
                                        >
                                            {paying === teacher.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.payBtnText}>MARK PAID</Text>}
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}
