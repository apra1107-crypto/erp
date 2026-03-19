import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, Platform, ScrollView, KeyboardAvoidingView, Modal, Image, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';

export default function InstituteLogin() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Forgot Password States
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState('email'); // 'email', 'verify-email', 'otp', 'newPassword'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOTP, setForgotOTP] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  
  // Login error banner
  const [loginError, setLoginError] = useState('');
  const [showLoginError, setShowLoginError] = useState(false);
  
  // Animation for smooth transitions
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  
  // Institute details for verification
  const [instituteDetails, setInstituteDetails] = useState<any>(null);
  
  // OTP input refs for auto-focus
  const otpRefs = useRef([
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ]);

  // Handle OTP timer countdown
  useEffect(() => {
    // Auto-login check
    const checkSession = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        router.replace('/(principal)/dashboard');
      }
    };
    checkSession();

    // Animate in on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Original OTP timer effect
  useEffect(() => {
    if (otpTimer <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Handle expiry outside of state setter
          setTimeout(() => {
            setOtpSent(false);
            Toast.show({
              type: 'error',
              text1: '⏰ OTP Expired',
              text2: 'Please request a new OTP',
            });
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [otpTimer, otpSent]);

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: '⚠️ Missing Fields',
        text2: 'Please enter both email and password',
        visibilityTime: 5000,
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Toast.show({
        type: 'error',
        text1: '❌ Invalid Email',
        text2: 'Please enter a valid email address',
        visibilityTime: 5000,
      });
      return;
    }

    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: '⚠️ Weak Password',
        text2: 'Password must be at least 6 characters',
        visibilityTime: 5000,
      });
      return;
    }

    try {
      setLoading(true);
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      const response = await axios.post(`${API_ENDPOINTS.AUTH.INSTITUTE}/login`, {
        email: trimmedEmail,
        password: trimmedPassword,
      });

      await AsyncStorage.setItem('token', response.data.token);
      await AsyncStorage.setItem('userData', JSON.stringify(response.data.institute));

      Toast.show({
        type: 'success',
        text1: '✅ Login Successful',
        text2: `Welcome back, ${response.data.institute.institute_name}!`,
        visibilityTime: 5000,
      });

      setTimeout(() => {
        router.replace('/(principal)/dashboard');
      }, 800);
    } catch (error: any) {
      console.log('❌ Login Error Caught:', error.response?.data?.message || error.message);
      
      const errorMessage = error.response?.data?.message || 'Invalid credentials';
      
      let displayMessage = '';
      let alertTitle = '';
      
      // Check if it's a password mismatch error
      if (errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('invalid')) {
        alertTitle = 'Incorrect Credentials';
        displayMessage = 'The email or password you entered is incorrect. Please try again.';
      } else if (errorMessage.toLowerCase().includes('not found') || errorMessage.toLowerCase().includes('no institute')) {
        alertTitle = 'Institute Not Found';
        displayMessage = 'No institute account found with this email address.';
      } else {
        alertTitle = 'Login Failed';
        displayMessage = errorMessage;
      }
      
      console.log('🔴 Showing Alert:', alertTitle);
      
      // Use native Alert which will definitely be visible
      Alert.alert(alertTitle, displayMessage, [
        {
          text: 'OK',
          onPress: () => {
            console.log('✅ Alert dismissed by user');
            setLoginError('');
            setShowLoginError(false);
          },
          style: 'default',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Handlers
  const handleSendOTP = async () => {
    if (!forgotEmail) {
      Toast.show({
        type: 'error',
        text1: '⚠️ Email Required',
        text2: 'Please enter your registered email address',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      Toast.show({
        type: 'error',
        text1: '❌ Invalid Email',
        text2: 'Please enter a valid email address',
      });
      return;
    }

    try {
      setForgotLoading(true);
      setEmailError('');
      
      // First, fetch institute details to verify email and show confirmation
      const instituteResponse = await axios.get(`${API_ENDPOINTS.AUTH.INSTITUTE}/get-by-email`, {
        params: { email: forgotEmail.trim().toLowerCase() },
      });

      if (instituteResponse.data.institute) {
        setInstituteDetails(instituteResponse.data.institute);
        setForgotPasswordStep('verify-email');
        Toast.show({
          type: 'success',
          text1: '✅ Institute Found',
          text2: 'Please verify the details',
          visibilityTime: 2000,
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.status === 404 
        ? 'This email address is not registered with any institute. Please check and try again.'
        : (error.response?.data?.message || 'We could not find an institute associated with this email.');
      
      setEmailError(errorMsg);
      Toast.show({
        type: 'error',
        text1: '❌ Account Not Found',
        text2: 'The email address you entered is not registered.',
        visibilityTime: 4000,
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmAndSendOTP = async () => {
    try {
      setForgotLoading(true);
      await axios.post(`${API_ENDPOINTS.AUTH.INSTITUTE}/forgot-password`, {
        email: forgotEmail.trim().toLowerCase(),
      });

      Toast.show({
        type: 'success',
        text1: '✅ OTP Sent',
        text2: `Check your email for OTP`,
        visibilityTime: 5000,
      });

      setOtpSent(true);
      setOtpTimer(300); // 5 minutes timer
      setOtpVerified(false); // Reset OTP verified flag
      setForgotPasswordStep('otp');
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to send OTP';
      Toast.show({
        type: 'error',
        text1: '❌ Failed to Send OTP',
        text2: errorMsg,
        visibilityTime: 4000,
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOTPAndReset = async () => {
    if (!forgotOTP) {
      Toast.show({
        type: 'error',
        text1: '⚠️ OTP Required',
        text2: 'Please enter the 6-digit OTP',
      });
      return;
    }

    if (forgotOTP.length !== 6 || isNaN(Number(forgotOTP))) {
      Toast.show({
        type: 'error',
        text1: '❌ Invalid OTP',
        text2: 'OTP must be exactly 6 digits',
      });
      return;
    }

    if (!newPassword || !confirmPassword) {
      Toast.show({
        type: 'error',
        text1: '⚠️ Passwords Required',
        text2: 'Please enter and confirm your new password',
      });
      return;
    }

    if (newPassword.length < 6) {
      Toast.show({
        type: 'error',
        text1: '❌ Weak Password',
        text2: 'Password must be at least 6 characters',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: '❌ Passwords Do Not Match',
        text2: 'Please make sure both passwords are identical',
      });
      return;
    }

    if (newPassword === password) {
      Toast.show({
        type: 'error',
        text1: '⚠️ Same Password',
        text2: 'New password must be different from old password',
      });
      return;
    }

    try {
      setForgotLoading(true);
      const response = await axios.post(`${API_ENDPOINTS.AUTH.INSTITUTE}/verify-otp-reset`, {
        email: forgotEmail.trim().toLowerCase(),
        otp: forgotOTP,
        newPassword: newPassword,
      });

      Toast.show({
        type: 'success',
        text1: '✅ Password Reset Successful',
        text2: 'Your password has been updated. Please login with your new password.',
        visibilityTime: 5000,
      });

      // Reset forgot password form
      setTimeout(() => {
        setForgotEmail('');
        setForgotOTP('');
        setNewPassword('');
        setConfirmPassword('');
        setForgotPasswordStep('email');
        setShowForgotPasswordModal(false);
        setEmail(forgotEmail);
        setPassword('');
      }, 2000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to reset password';
      Toast.show({
        type: 'error',
        text1: '❌ Password Reset Failed',
        text2: errorMsg,
        visibilityTime: 4000,
      });
    } finally {
      setForgotLoading(false);
    }
  };

  // First verify OTP, then allow password entry
  const handleVerifyOTP = async () => {
    setOtpError('');
    
    if (!forgotOTP) {
      Toast.show({
        type: 'error',
        text1: '⚠️ OTP Required',
        text2: 'Please enter the 6-digit OTP',
        visibilityTime: 4000,
      });
      return;
    }

    if (forgotOTP.length !== 6 || isNaN(Number(forgotOTP))) {
      setOtpError('❌ OTP must be exactly 6 digits');
      Toast.show({
        type: 'error',
        text1: '❌ Invalid OTP',
        text2: 'OTP must be exactly 6 digits',
        visibilityTime: 4000,
      });
      return;
    }

    try {
      setForgotLoading(true);
      setOtpError('');
      
      // Actually verify OTP with backend
      const response = await axios.post(`${API_ENDPOINTS.AUTH.INSTITUTE}/verify-otp`, {
        email: forgotEmail.trim().toLowerCase(),
        otp: forgotOTP,
      });

      Toast.show({
        type: 'success',
        text1: '✅ OTP Verified',
        text2: 'Now create your new password',
        visibilityTime: 2000,
      });
      
      setOtpVerified(true);
      setOtpError('');
      setForgotPasswordStep('newPassword');
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to verify OTP';
      setOtpError(errorMsg);
      Toast.show({
        type: 'error',
        text1: '❌ OTP Verification Failed',
        text2: errorMsg,
        visibilityTime: 5000,
      });
      setOtpVerified(false);
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
    setForgotPasswordStep('email');
    setForgotEmail('');
    setForgotOTP('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpSent(false);
    setOtpTimer(0);
    setInstituteDetails(null);
    setOtpVerified(false);
    setOtpError('');
    setEmailError('');
  };

  const handleButtonPress = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.96,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    callback();
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 20 },
    content: { flex: 1, padding: 25, justifyContent: 'center' },
    card: {
      backgroundColor: theme.card,
      borderRadius: 30,
      padding: 30,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1, shadowRadius: 20, elevation: 5
    },
    iconHeader: {
      width: 80, height: 80, borderRadius: 25,
      backgroundColor: theme.primary + '10',
      justifyContent: 'center', alignItems: 'center',
      alignSelf: 'center', marginBottom: 25
    },
    title: { fontSize: 28, fontWeight: '900', color: theme.text, textAlign: 'center', marginBottom: 10 },
    subtitle: { fontSize: 15, color: theme.textLight, textAlign: 'center', marginBottom: 35, lineHeight: 22 },

    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 15,
      marginBottom: 20
    },
    input: { flex: 1, height: 60, color: theme.text, fontSize: 16, fontWeight: '700' },
    eyeIcon: { padding: 10, marginLeft: 5 },
    button: {
      backgroundColor: theme.primary,
      height: 60, borderRadius: 20,
      justifyContent: 'center', alignItems: 'center',
      shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 10, elevation: 8
    },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    linksContainer: { marginTop: 30, alignItems: 'center' },
    link: { color: theme.primary, fontSize: 15, fontWeight: '800', marginVertical: 10 },
    forgotLink: { color: theme.textLight, fontSize: 14, fontWeight: '600', marginBottom: 5 },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', paddingTop: 50 },
    modalContent: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      padding: 30,
      paddingTop: 25,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 25,
    },
    modalTitle: { fontSize: 22, fontWeight: '900', color: theme.text },
    closeButton: { padding: 5 },
    modalSubtitle: { fontSize: 13, color: theme.textLight, marginBottom: 25, lineHeight: 20 },
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 30,
    },
    stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.border },
    stepDotActive: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary },
    otpInputContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
      gap: 8,
    },
    otpInput: {
      width: '15%',
      height: 55,
      borderWidth: 2,
      borderColor: theme.border,
      borderRadius: 14,
      textAlign: 'center',
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.text,
      backgroundColor: theme.background,
    },
    timerText: { textAlign: 'center', color: theme.textLight, fontSize: 12, marginBottom: 15 },
    secondaryButton: {
      backgroundColor: theme.background,
      height: 50,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.primary,
      marginTop: 10,
    },
    secondaryButtonText: { color: theme.primary, fontSize: 16, fontWeight: '800' },
  }), [theme, isDark]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle} />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Animated.View 
              style={[
                styles.card,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }
              ]}
            >
              <TouchableOpacity 
                style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }} 
                onPress={() => router.push('/(auth)/role-selection')}
              >
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>

              <View style={styles.iconHeader}>
                <Ionicons name="business" size={40} color={theme.primary} />
              </View>
              <Text style={styles.title}>Institute Portal</Text>
              <Text style={styles.subtitle}>Sign in to manage your educational institute&apos;s dashboard</Text>

              <View style={styles.inputWrapper}>
                <Ionicons name="mail-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor={theme.textLight}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={theme.textLight}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity 
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? "eye-outline" : "eye-off-outline"} 
                    size={22} 
                    color={theme.primary} 
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={{ alignSelf: 'flex-end', marginBottom: 20 }}
                onPress={() => setShowForgotPasswordModal(true)}
              >
                <Text style={styles.forgotLink}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.button} 
                onPress={() => handleButtonPress(handleLogin)} 
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
              </TouchableOpacity>

              <View style={styles.linksContainer}>
                <TouchableOpacity onPress={() => router.push('/(auth)/institute-register')}>
                  <Text style={styles.link}>Register New Institute</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/(auth)/role-selection')}>
                  <Text style={styles.link}>Change Role</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPasswordModal}
        transparent={true}
        animationType="slide"
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.container}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalOverlay}>
            <ScrollView 
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }} 
              keyboardShouldPersistTaps="handled"
              scrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Reset Password</Text>
                  <TouchableOpacity style={styles.closeButton} onPress={closeForgotPasswordModal}>
                    <Ionicons name="close" size={28} color={theme.text} />
                  </TouchableOpacity>
                </View>

                {/* Step 1: Email */}
                {forgotPasswordStep === 'email' && (
                  <>
                    <Text style={styles.modalSubtitle}>Enter your registered email to receive an OTP</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="mail-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                      <TextInput
                        style={styles.input}
                        placeholder="Email Address"
                        placeholderTextColor={theme.textLight}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={forgotEmail}
                        onChangeText={(text) => {
                          setForgotEmail(text);
                          if (emailError) setEmailError('');
                        }}
                        editable={!forgotLoading}
                      />
                    </View>

                    {emailError ? (
                      <View style={{ 
                        backgroundColor: '#FFE5E5', 
                        padding: 12, 
                        borderRadius: 12, 
                        marginBottom: 20, 
                        borderLeftWidth: 4, 
                        borderLeftColor: '#E74C3C',
                        flexDirection: 'row',
                        alignItems: 'center'
                      }}>
                        <Ionicons name="alert-circle" size={18} color="#C73030" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#C73030', fontSize: 13, fontWeight: '600', flex: 1 }}>
                          {emailError}
                        </Text>
                      </View>
                    ) : null}

                    <TouchableOpacity 
                      style={styles.button} 
                      onPress={handleSendOTP}
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
                    </TouchableOpacity>
                  </>
                )}

                {/* Step 2: Verify Institute Details */}
                {forgotPasswordStep === 'verify-email' && instituteDetails && (
                  <>
                    <Text style={styles.modalSubtitle}>Please verify the institute details below</Text>
                    
                    {/* Institute Details Card - Horizontal Layout */}
                    <View style={{
                      flexDirection: 'row',
                      backgroundColor: theme.background,
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 25,
                      borderWidth: 2,
                      borderColor: theme.primary + '30',
                      alignItems: 'center',
                      gap: 16,
                      width: '100%',
                      alignSelf: 'center'
                    }}>
                      {/* Institute Logo */}
                      <View style={{
                        width: 70,
                        height: 70,
                        borderRadius: 14,
                        backgroundColor: theme.primary + '15',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexShrink: 0,
                        overflow: 'hidden'
                      }}>
                        {instituteDetails.logo_url ? (
                          <Image
                            source={{ uri: instituteDetails.logo_url }}
                            style={{ width: 70, height: 70, borderRadius: 14 }}
                            resizeMode="contain"
                          />
                        ) : (
                          <Ionicons name="school" size={36} color={theme.primary} />
                        )}
                      </View>

                      {/* Institute Info */}
                      <View style={{ flex: 1 }}>
                        {/* Institute Name */}
                        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text, marginBottom: 4 }}>
                          {instituteDetails.institute_name || 'N/A'}
                        </Text>
                        
                        {/* Principal Name */}
                        <Text style={{ fontSize: 12, color: theme.textLight, fontWeight: '600' }}>
                          Principal: {instituteDetails.principal_name || 'N/A'}
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <TouchableOpacity 
                      style={styles.button} 
                      onPress={handleConfirmAndSendOTP}
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.buttonText}>✓ Confirm & Send OTP</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.button, { backgroundColor: theme.background, marginTop: 12, borderWidth: 2, borderColor: theme.border }]} 
                      onPress={() => {
                        setForgotPasswordStep('email');
                        setInstituteDetails(null);
                        setForgotEmail('');
                      }}
                      disabled={forgotLoading}
                    >
                      <Text style={[styles.buttonText, { color: theme.text }]}>← Change Email</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Step 3: OTP Verification */}
                {forgotPasswordStep === 'otp' && (
                  <>
                    <Text style={styles.modalSubtitle}>A 6-digit OTP has been sent to your email</Text>
                    <View style={styles.otpInputContainer}>
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <TextInput
                          key={index}
                          ref={otpRefs.current[index]}
                          style={[
                            styles.otpInput,
                            forgotOTP[index] && { borderColor: theme.primary, backgroundColor: theme.primary + '08' },
                            focusedIndex === index && { 
                              borderColor: theme.primary, 
                              borderWidth: 2.5,
                              backgroundColor: theme.primary + '10',
                              transform: [{ scale: 1.05 }],
                              shadowColor: theme.primary,
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.2,
                              shadowRadius: 8,
                              elevation: 5
                            }
                          ]}
                          placeholder="-"
                          placeholderTextColor={theme.textLight + '50'}
                          keyboardType="numeric"
                          maxLength={1}
                          value={forgotOTP[index] || ''}
                          onFocus={() => setFocusedIndex(index)}
                          onBlur={() => setFocusedIndex(null)}
                          onChangeText={(text) => {
                            if (/^\d*$/.test(text)) {
                              const newOtp = forgotOTP.split('');
                              newOtp[index] = text;
                              const updatedOtp = newOtp.join('').slice(0, 6);
                              setForgotOTP(updatedOtp);

                              // Auto-focus to next field
                              if (text && index < 5) {
                                setTimeout(() => {
                                  otpRefs.current[index + 1]?.current?.focus();
                                }, 10);
                              }
                            }
                          }}
                          onKeyPress={(e) => {
                            // Handle backspace to move to previous field
                            if (e.nativeEvent.key === 'Backspace' && !forgotOTP[index] && index > 0) {
                              setTimeout(() => {
                                otpRefs.current[index - 1]?.current?.focus();
                              }, 10);
                            }
                          }}
                          editable={!forgotLoading && otpTimer > 0}
                          selectTextOnFocus
                        />
                      ))}
                    </View>
                    <View style={{ marginTop: 20, marginBottom: 25 }}>
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        backgroundColor: otpTimer < 60 ? '#FFE5E5' : theme.background,
                        paddingVertical: 8,
                        paddingHorizontal: 15,
                        borderRadius: 12,
                        alignSelf: 'center'
                      }}>
                        <Ionicons 
                          name="time-outline" 
                          size={16} 
                          color={otpTimer < 60 ? '#E74C3C' : theme.textLight} 
                          style={{ marginRight: 6 }} 
                        />
                        <Text style={{ 
                          color: otpTimer < 60 ? '#E74C3C' : theme.textLight, 
                          fontSize: 13, 
                          fontWeight: '700' 
                        }}>
                          Expires in {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')}
                        </Text>
                      </View>
                      
                      {otpError && (
                        <View style={{ 
                          backgroundColor: '#FFE5E5', 
                          padding: 14, 
                          borderRadius: 14, 
                          marginTop: 20, 
                          borderLeftWidth: 4, 
                          borderLeftColor: '#E74C3C',
                          flexDirection: 'row',
                          alignItems: 'center'
                        }}>
                          <Ionicons name="alert-circle" size={20} color="#C73030" style={{ marginRight: 10 }} />
                          <Text style={{ color: '#C73030', fontSize: 13, fontWeight: '600', flex: 1 }}>
                            {otpError}
                          </Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity 
                      style={[styles.button, forgotOTP.length !== 6 && { opacity: 0.5 }]} 
                      onPress={handleVerifyOTP}
                      disabled={forgotOTP.length !== 6 || forgotLoading}
                    >
                      {forgotLoading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.buttonText}>Verify & Continue</Text>
                          <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.secondaryButton, { borderStyle: 'dashed' }]} 
                      onPress={() => {
                        setForgotPasswordStep('email');
                        setForgotOTP('');
                        setEmailError('');
                      }}
                      disabled={forgotLoading}
                    >
                      <Text style={styles.secondaryButtonText}>↩️ Change Email Address</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Step 4: New Password */}
                {forgotPasswordStep === 'newPassword' && (
                  <>
                    <Text style={styles.modalSubtitle}>Create a strong new password</Text>
                    
                    <View style={styles.inputWrapper}>
                      <Ionicons name="lock-closed-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                      <TextInput
                        style={styles.input}
                        placeholder="New Password"
                        placeholderTextColor={theme.textLight}
                        secureTextEntry={!showNewPassword}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        editable={!forgotLoading}
                      />
                      <TouchableOpacity 
                        style={styles.eyeIcon}
                        onPress={() => setShowNewPassword(!showNewPassword)}
                      >
                        <Ionicons 
                          name={showNewPassword ? "eye-outline" : "eye-off-outline"} 
                          size={20} 
                          color={theme.primary} 
                        />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.inputWrapper}>
                      <Ionicons name="lock-closed-outline" size={20} color={theme.primary} style={{ marginRight: 12 }} />
                      <TextInput
                        style={styles.input}
                        placeholder="Confirm Password"
                        placeholderTextColor={theme.textLight}
                        secureTextEntry={!showConfirmPassword}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        editable={!forgotLoading}
                      />
                      <TouchableOpacity 
                        style={styles.eyeIcon}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        <Ionicons 
                          name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} 
                          size={20} 
                          color={theme.primary} 
                        />
                      </TouchableOpacity>
                    </View>

                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <View style={{ backgroundColor: '#FFF3CD', padding: 12, borderRadius: 10, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#FFC107' }}>
                        <Text style={{ color: '#856404', fontSize: 12, fontWeight: '600' }}>❌ Passwords don&apos;t match</Text>
                      </View>
                    )}

                    {newPassword && newPassword.length < 6 && (
                      <View style={{ backgroundColor: '#FFF3CD', padding: 12, borderRadius: 10, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#FFC107' }}>
                        <Text style={{ color: '#856404', fontSize: 12, fontWeight: '600' }}>⚠️ Password must be at least 6 characters</Text>
                      </View>
                    )}

                    {newPassword && confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                      <View style={{ backgroundColor: '#D4EDDA', padding: 12, borderRadius: 10, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#28A745' }}>
                        <Text style={{ color: '#155724', fontSize: 12, fontWeight: '600' }}>✅ Passwords match</Text>
                      </View>
                    )}

                    <TouchableOpacity 
                      style={[styles.button, (newPassword !== confirmPassword || newPassword.length < 6) && { opacity: 0.5 }]} 
                      onPress={handleVerifyOTPAndReset}
                      disabled={forgotLoading || newPassword !== confirmPassword || newPassword.length < 6}
                    >
                      {forgotLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset Password</Text>}
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.secondaryButton} 
                      onPress={() => setForgotPasswordStep('otp')}
                      disabled={forgotLoading}
                    >
                      <Text style={styles.secondaryButtonText}>↩️ Back</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}