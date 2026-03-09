import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, StatusBar, Image, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, interpolateColor, withTiming } from 'react-native-reanimated';

const ModernToggle = ({ value, onValueChange, activeColor }: { value: boolean, onValueChange: (v: boolean) => void, activeColor: string }) => {
  const translateX = useSharedValue(value ? 20 : 0);
  
  useEffect(() => {
    translateX.value = withSpring(value ? 22 : 2, { damping: 15, stiffness: 150 });
  }, [value]);

  const animatedThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }]
  }));

  const animatedTrackStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      translateX.value,
      [2, 22],
      ['#E9E9EB', activeColor]
    );
    return { backgroundColor };
  });

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => onValueChange(!value)}>
      <Animated.View style={[{ width: 50, height: 28, borderRadius: 15, justifyContent: 'center', paddingHorizontal: 2 }, animatedTrackStyle]}>
        <Animated.View style={[{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 }, animatedThumbStyle]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function AddStudent() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    class: '',
    section: '',
    roll_no: '',
    dob: new Date(),
    gender: '',
    father_name: '',
    mother_name: '',
    mobile: '',
    email: '',
    address: '',
    transport_facility: false,
    monthly_fees: '',
    transport_fees: '',
  });
  const [photo, setPhoto] = useState<any>(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission Denied',
        text2: 'Please allow access to photos',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setPhoto(result.assets[0]);
    }
  };

  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.class || !formData.section || !formData.roll_no ||
      !formData.gender || !formData.father_name || !formData.mother_name ||
      !formData.mobile || !formData.email || !formData.address || !formData.monthly_fees ||
      (formData.transport_facility && !formData.transport_fees)) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please fill all required fields, including fees',
      });
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('teacherToken');

      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('class', formData.class);
      formDataToSend.append('section', formData.section);
      formDataToSend.append('roll_no', formData.roll_no);
      formDataToSend.append('dob', formData.dob.toISOString().split('T')[0]);
      formDataToSend.append('gender', formData.gender);
      formDataToSend.append('father_name', formData.father_name);
      formDataToSend.append('mother_name', formData.mother_name);
      formDataToSend.append('mobile', formData.mobile);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('transport_facility', String(formData.transport_facility));
      formDataToSend.append('monthly_fees', formData.monthly_fees || '0');
      formDataToSend.append('transport_fees', formData.transport_facility ? (formData.transport_fees || '0') : '0');

      if (photo) {
        const photoFile: any = {
          uri: photo.uri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        };
        formDataToSend.append('photo', photoFile);
      }

      const response = await axios.post(
        `${API_ENDPOINTS.TEACHER}/student/add`,
        formDataToSend,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: `Student added! Code: ${response.data.student.unique_code}`,
        visibilityTime: 4000,
      });

      setTimeout(() => {
        router.replace('/(teacher)/dashboard');
      }, 2000);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.message || 'Failed to add student',
      });
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      paddingTop: insets.top + 10,
      paddingBottom: 10,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 10,
    },
    backButtonHeader: {
      width: 40, 
      height: 40, 
      borderRadius: 20, 
      backgroundColor: theme.card, 
      justifyContent: 'center', 
      alignItems: 'center', 
      marginRight: 15,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: theme.text,
      letterSpacing: -0.5,
    },
    saveButtonHeader: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 15,
      backgroundColor: theme.primary,
      elevation: 4,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    saveButtonText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 14,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    section: {
      marginBottom: 25,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.primary,
      marginBottom: 15,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    inputCard: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 15,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    inputGroup: {
      marginBottom: 15,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.textLight,
      marginBottom: 8,
      marginLeft: 4,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      height: 50,
      color: theme.text,
      fontSize: 15,
      fontWeight: '600',
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top',
      paddingTop: 12,
      color: theme.text,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    genderContainer: {
      flexDirection: 'row',
      backgroundColor: theme.background,
      borderRadius: 15,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    genderButton: {
      flex: 1,
      height: 42,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    genderButtonActive: {
      backgroundColor: theme.primary,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    genderText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.textLight,
    },
    genderTextActive: {
      color: '#fff',
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      height: 50,
      borderRadius: 15,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dateText: {
      flex: 1,
      color: theme.text,
      fontSize: 15,
      fontWeight: '600',
    },
    switchContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 10,
    },
    switchLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    photoContainer: {
      alignItems: 'center',
      marginVertical: 20,
    },
    photoButton: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.primary,
      borderStyle: 'dashed',
      overflow: 'hidden',
    },
    photoImage: {
      width: '100%',
      height: '100%',
    },
    photoPlaceholder: {
      alignItems: 'center',
    },
    photoText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.primary,
      marginTop: 4,
    },
  }), [theme, isDark]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent={true} />

      {/* Premium Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.backButtonHeader} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Student</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButtonHeader, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 50}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 200 }}
          keyboardShouldPersistTaps="handled"
        >

          <View style={styles.photoContainer}>
            <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
              {photo ? (
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={40} color={theme.primary} />
                  <Text style={styles.photoText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <View style={styles.inputCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. John Doe"
                    placeholderTextColor={theme.textLight}
                    value={formData.name}
                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 0.48 }]}>
                  <Text style={styles.label}>Date of Birth *</Text>
                  <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                    <Text style={styles.dateText}>{formatDate(formData.dob)}</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.inputGroup, { flex: 0.48 }]}>
                  <Text style={styles.label}>Gender *</Text>
                  <View style={styles.genderContainer}>
                    <TouchableOpacity
                      style={[styles.genderButton, formData.gender === 'Male' && styles.genderButtonActive]}
                      onPress={() => setFormData({ ...formData, gender: 'Male' })}
                    >
                      <Text style={[styles.genderText, formData.gender === 'Male' && styles.genderTextActive]}>Male</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderButton, formData.gender === 'Female' && styles.genderButtonActive]}
                      onPress={() => setFormData({ ...formData, gender: 'Female' })}
                    >
                      <Text style={[styles.genderText, formData.gender === 'Female' && styles.genderTextActive]}>Female</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Academic Details</Text>
            <View style={styles.inputCard}>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 0.48 }]}>
                  <Text style={styles.label}>Class *</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="school-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 10"
                      placeholderTextColor={theme.textLight}
                      value={formData.class}
                      onChangeText={(text) => setFormData({ ...formData, class: text })}
                    />
                  </View>
                </View>
                <View style={[styles.inputGroup, { flex: 0.48 }]}>
                  <Text style={styles.label}>Section *</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="grid-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. A"
                      placeholderTextColor={theme.textLight}
                      value={formData.section}
                      onChangeText={(text) => setFormData({ ...formData, section: text })}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Roll Number *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="list-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 101"
                    placeholderTextColor={theme.textLight}
                    value={formData.roll_no}
                    onChangeText={(text) => setFormData({ ...formData, roll_no: text })}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parents & Contact</Text>
            <View style={styles.inputCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Father's Name *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Father's full name"
                    placeholderTextColor={theme.textLight}
                    value={formData.father_name}
                    onChangeText={(text) => setFormData({ ...formData, father_name: text })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mother's Name *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Mother's full name"
                    placeholderTextColor={theme.textLight}
                    value={formData.mother_name}
                    onChangeText={(text) => setFormData({ ...formData, mother_name: text })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mobile Number *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="10-digit mobile"
                    placeholderTextColor={theme.textLight}
                    keyboardType="phone-pad"
                    value={formData.mobile}
                    onChangeText={(text) => setFormData({ ...formData, mobile: text })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="email@example.com"
                    placeholderTextColor={theme.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Residential Address *</Text>
                <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start' }]}>
                  <Ionicons name="location-outline" size={20} color={theme.primary} style={[styles.inputIcon, { marginTop: 15 }]} />
                  <TextInput
                    style={styles.textArea}
                    placeholder="Complete address"
                    placeholderTextColor={theme.textLight}
                    multiline
                    numberOfLines={4}
                    value={formData.address}
                    onChangeText={(text) => setFormData({ ...formData, address: text })}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.switchContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="bus-outline" size={20} color={theme.primary} />
              </View>
              <Text style={styles.switchLabel}>Transport Facility</Text>
            </View>
            <ModernToggle
              value={formData.transport_facility}
              onValueChange={(value) => setFormData({ ...formData, transport_facility: value })}
              activeColor={theme.primary}
            />
          </View>

          <View style={[styles.section, { marginTop: 25 }]}>
            <Text style={styles.sectionTitle}>Fees Information</Text>
            <View style={styles.inputCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Monthly Tuition Fees *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="cash-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1500"
                    placeholderTextColor={theme.textLight}
                    keyboardType="numeric"
                    value={formData.monthly_fees}
                    onChangeText={(text) => setFormData({ ...formData, monthly_fees: text })}
                  />
                </View>
              </View>

              {formData.transport_facility && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Monthly Transport Fees *</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="bus-outline" size={20} color={theme.primary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 500"
                      placeholderTextColor={theme.textLight}
                      keyboardType="numeric"
                      value={formData.transport_fees}
                      onChangeText={(text) => setFormData({ ...formData, transport_fees: text })}
                    />
                  </View>
                </View>
              )}
            </View>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={formData.dob}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setFormData({ ...formData, dob: selectedDate });
                }
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}