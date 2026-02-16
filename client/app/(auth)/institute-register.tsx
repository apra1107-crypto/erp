import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';

export default function InstituteRegister() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    institute_name: '',
    principal_name: '',
    email: '',
    mobile: '',
    state: '',
    district: '',
    pincode: '',
    landmark: '',
    address: '',
    password: '',
    confirm_password: '',
  });

  const handleRegister = async () => {
    if (!formData.institute_name || !formData.principal_name || !formData.email ||
      !formData.mobile || !formData.password || !formData.confirm_password) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please fill all required fields' });
      return;
    }

    if (formData.password !== formData.confirm_password) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Passwords do not match' });
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_ENDPOINTS.AUTH.INSTITUTE}/register`, { ...formData });
      Toast.show({ type: 'success', text1: 'Success', text2: 'Institute registered successfully!' });
      setTimeout(() => router.replace('/(auth)/institute-login'), 1500);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Registration Failed', text2: error.response?.data?.message || 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { padding: 25 },
    header: { marginBottom: 30, alignItems: 'center' },
    iconWrapper: { width: 70, height: 70, borderRadius: 24, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    title: { fontSize: 28, fontWeight: '900', color: theme.text },
    subtitle: { fontSize: 15, color: theme.textLight, marginTop: 8 },

    sectionTitle: { fontSize: 13, fontWeight: '800', color: theme.primary, marginBottom: 15, marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 },
    card: { backgroundColor: theme.card, borderRadius: 25, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: theme.border },

    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      marginBottom: 12,
      height: 56
    },
    input: { flex: 1, height: '100%', color: theme.text, fontSize: 15, fontWeight: '600', marginLeft: 10 },
    textArea: { height: 100, textAlignVertical: 'top', paddingTop: 15 },

    button: { backgroundColor: theme.primary, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 10, marginBottom: 20 },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    link: { color: theme.primary, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 30 },
  }), [theme, isDark]);

  const InputField = ({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, multiline }: any) => (
    <View style={[styles.inputWrapper, multiline && { height: 100 }]}>
      <Ionicons name={icon} size={20} color={theme.primary} />
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        placeholder={placeholder}
        placeholderTextColor={theme.textLight}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Ionicons name="business" size={35} color={theme.primary} />
          </View>
          <Text style={styles.title}>Register Institute</Text>
          <Text style={styles.subtitle}>Create your educational hub today</Text>
        </View>

        <Text style={styles.sectionTitle}>Basic Information</Text>
        <View style={styles.card}>
          <InputField icon="school-outline" placeholder="Institute Name *" value={formData.institute_name} onChangeText={(t: string) => setFormData({ ...formData, institute_name: t })} />
          <InputField icon="person-outline" placeholder="Principal Name *" value={formData.principal_name} onChangeText={(t: string) => setFormData({ ...formData, principal_name: t })} />
          <InputField icon="mail-outline" placeholder="Official Email *" value={formData.email} onChangeText={(t: string) => setFormData({ ...formData, email: t })} keyboardType="email-address" />
          <InputField icon="call-outline" placeholder="Mobile Number *" value={formData.mobile} onChangeText={(t: string) => setFormData({ ...formData, mobile: t })} keyboardType="phone-pad" />
        </View>

        <Text style={styles.sectionTitle}>Location Details</Text>
        <View style={styles.card}>
          <InputField icon="map-outline" placeholder="State" value={formData.state} onChangeText={(t: string) => setFormData({ ...formData, state: t })} />
          <InputField icon="location-outline" placeholder="District" value={formData.district} onChangeText={(t: string) => setFormData({ ...formData, district: t })} />
          <InputField icon="navigate-outline" placeholder="Pincode" value={formData.pincode} onChangeText={(t: string) => setFormData({ ...formData, pincode: t })} keyboardType="numeric" />
          <InputField icon="pin-outline" placeholder="Landmark" value={formData.landmark} onChangeText={(t: string) => setFormData({ ...formData, landmark: t })} />
          <InputField icon="home-outline" placeholder="Complete Address" value={formData.address} onChangeText={(t: string) => setFormData({ ...formData, address: t })} multiline />
        </View>

        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.card}>
          <InputField icon="lock-closed-outline" placeholder="Password *" value={formData.password} onChangeText={(t: string) => setFormData({ ...formData, password: t })} secureTextEntry />
          <InputField icon="shield-checkmark-outline" placeholder="Confirm Password *" value={formData.confirm_password} onChangeText={(t: string) => setFormData({ ...formData, confirm_password: t })} secureTextEntry />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register Now</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Joined already? Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
