import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Platform, StatusBar, Image, KeyboardAvoidingView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../constants/Config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ModernToggle = ({ active, onToggle, theme }: { active: boolean, onToggle: () => void, theme: any }) => {
    return (
        <TouchableOpacity 
            activeOpacity={0.8}
            onPress={onToggle}
            style={{
                width: 50,
                height: 28,
                borderRadius: 15,
                backgroundColor: active ? '#AF52DE' : (theme.isDark ? '#333' : '#E9E9EB'),
                padding: 2,
                justifyContent: 'center',
            }}
        >
            <View style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: '#fff',
                elevation: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                alignSelf: active ? 'flex-end' : 'flex-start',
            }} />
        </TouchableOpacity>
    );
};

export default function AddTeacher() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    dob: new Date(),
    mobile: '',
    email: '',
    subject: '',
    qualification: '',
    gender: '',
    address: '',
    special_permission: false,
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
      aspect: [1, 1],
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
    if (!formData.name || !formData.mobile || !formData.email || !formData.subject ||
      !formData.qualification || !formData.gender || !formData.address) {
      Toast.show({
        type: 'error',
        text1: 'Required Fields',
        text2: 'Please fill all mandatory information',
      });
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');

      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('dob', formData.dob.toISOString().split('T')[0]);
      formDataToSend.append('mobile', formData.mobile);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('subject', formData.subject);
      formDataToSend.append('qualification', formData.qualification);
      formDataToSend.append('gender', formData.gender);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('special_permission', String(formData.special_permission));

      if (photo) {
        const photoFile: any = {
          uri: photo.uri,
          type: 'image/jpeg',
          name: 'photo.jpg',
        };
        formDataToSend.append('photo', photoFile);
      }

      const response = await axios.post(
        `${API_ENDPOINTS.PRINCIPAL}/teacher/add`,
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
        text1: 'Registration Successful',
        text2: `${formData.name} is now part of the faculty!`,
        visibilityTime: 4000,
      });

      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: error.response?.data?.message || 'Server error occurred',
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
      paddingHorizontal: 20,
      paddingBottom: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor: theme.card,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      elevation: 2,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.text,
      letterSpacing: -0.5,
    },
    saveBtn: {
      backgroundColor: '#AF52DE',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 14,
      elevation: 4,
      shadowColor: '#AF52DE',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    saveBtnText: {
      color: '#fff',
      fontWeight: '900',
      fontSize: 14,
      textTransform: 'uppercase',
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 50,
    },
    photoSection: {
      alignItems: 'center',
      marginVertical: 25,
    },
    photoUploadBtn: {
      width: 130,
      height: 130,
      borderRadius: 65,
      padding: 3,
      backgroundColor: theme.border,
    },
    photoInner: {
      flex: 1,
      borderRadius: 62,
      backgroundColor: theme.card,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: theme.card,
    },
    photoPlaceholder: {
      alignItems: 'center',
    },
    photoImg: {
      width: '100%',
      height: '100%',
    },
    cameraBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: '#AF52DE',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: theme.background,
      elevation: 5,
    },
    formSection: {
      paddingHorizontal: 20,
      marginBottom: 30,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '900',
      color: '#AF52DE',
      marginBottom: 15,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
    inputCard: {
      backgroundColor: theme.card,
      borderRadius: 28,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 15,
      elevation: 3,
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 8,
      opacity: 0.8,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 15,
      height: 56,
    },
    inputIcon: {
      marginRight: 12,
    },
    textInput: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    dualRow: {
      flexDirection: 'row',
      gap: 15,
    },
    datePickerBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 15,
      height: 56,
    },
    dateValue: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    genderPicker: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
      borderRadius: 16,
      padding: 5,
      borderWidth: 1,
      borderColor: theme.border,
    },
    genderOption: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    genderOptionActive: {
      backgroundColor: '#AF52DE',
      elevation: 3,
      shadowColor: '#AF52DE',
      shadowOpacity: 0.3,
      shadowRadius: 5,
    },
    genderLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.textLight,
    },
    genderLabelActive: {
      color: '#fff',
    },
    addressInput: {
      minHeight: 100,
      textAlignVertical: 'top',
      paddingTop: 15,
    },
    permissionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      padding: 20,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: theme.border,
      marginHorizontal: 20,
      marginBottom: 40,
      elevation: 3,
    },
    permInfo: {
      flex: 1,
      marginRight: 15,
    },
    permTitle: {
      fontSize: 15,
      fontWeight: '900',
      color: theme.text,
    },
    permSub: {
      fontSize: 11,
      color: theme.textLight,
      marginTop: 4,
      fontWeight: '600',
    }
  }), [theme, isDark]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle} />
      
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Faculty Registration</Text>
        <TouchableOpacity 
          style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.photoSection}>
            <TouchableOpacity style={styles.photoUploadBtn} onPress={pickImage} activeOpacity={0.9}>
              <View style={styles.photoInner}>
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={styles.photoImg} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="person" size={50} color={isDark ? '#444' : '#E2E8F0'} />
                  </View>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={{ fontSize: 13, fontWeight: '800', color: theme.textLight, marginTop: 15 }}>Upload Profile Photo</Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Academic Profile</Text>
            <View style={styles.inputCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#AF52DE" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter teacher's name"
                    placeholderTextColor={theme.textLight}
                    value={formData.name}
                    onChangeText={(t) => setFormData({ ...formData, name: t })}
                  />
                </View>
              </View>

              <View style={styles.dualRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Subject Expert</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="book-outline" size={20} color="#AF52DE" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Science"
                      placeholderTextColor={theme.textLight}
                      value={formData.subject}
                      onChangeText={(t) => setFormData({ ...formData, subject: t })}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Professional Qualification</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="ribbon-outline" size={20} color="#AF52DE" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. Ph.D, M.Ed"
                    placeholderTextColor={theme.textLight}
                    value={formData.qualification}
                    onChangeText={(t) => setFormData({ ...formData, qualification: t })}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Identity & Verification</Text>
            <View style={styles.inputCard}>
              <View style={styles.dualRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Date of Birth</Text>
                  <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={20} color="#AF52DE" style={styles.inputIcon} />
                    <Text style={styles.dateValue}>{formatDate(formData.dob)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gender Identification</Text>
                <View style={styles.genderPicker}>
                  {['Male', 'Female', 'Other'].map((g) => (
                    <TouchableOpacity 
                      key={g} 
                      style={[styles.genderOption, formData.gender === g && styles.genderOptionActive]}
                      onPress={() => setFormData({ ...formData, gender: g })}
                    >
                      <Text style={[styles.genderLabel, formData.gender === g && styles.genderLabelActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Communication</Text>
            <View style={styles.inputCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Connectivity</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={20} color="#AF52DE" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="10-digit number"
                    placeholderTextColor={theme.textLight}
                    keyboardType="phone-pad"
                    value={formData.mobile}
                    onChangeText={(t) => setFormData({ ...formData, mobile: t })}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Official Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#AF52DE" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="faculty@institute.com"
                    placeholderTextColor={theme.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(t) => setFormData({ ...formData, email: t })}
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                <Text style={styles.inputLabel}>Permanent Residence</Text>
                <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingVertical: 12 }]}>
                  <Ionicons name="location-outline" size={20} color="#AF52DE" style={[styles.inputIcon, { marginTop: 3 }]} />
                  <TextInput
                    style={[styles.textInput, { height: '100%' }]}
                    placeholder="Complete residential address"
                    placeholderTextColor={theme.textLight}
                    multiline
                    value={formData.address}
                    onChangeText={(t) => setFormData({ ...formData, address: t })}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.permissionCard}>
            <View style={styles.permInfo}>
              <Text style={styles.permTitle}>Special Administrative Access</Text>
              <Text style={styles.permSub}>Allow this teacher to edit financial records and manage institute-wide data.</Text>
            </View>
            <ModernToggle 
              active={formData.special_permission} 
              onToggle={() => setFormData({ ...formData, special_permission: !formData.special_permission })} 
              theme={{ isDark }} 
            />
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={formData.dob}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setFormData({ ...formData, dob: selectedDate });
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}