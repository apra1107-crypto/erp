import { Stack, usePathname, useRouter } from 'expo-router';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { SocketProvider } from '../context/SocketContext';
import { useEffect, useRef } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import Toast from 'react-native-toast-message';
import { View, Text, Platform, Alert } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '../constants/Config';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import UpdateModal from '../components/UpdateModal';
import * as NavigationBar from 'expo-navigation-bar';
import {
  PaperProvider,
  MD3LightTheme as DefaultTheme,
  MD3DarkTheme as DarkTheme,
} from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { LinearGradient } from 'expo-linear-gradient';

const toastConfig = {
  subscription: ({ props }: any) => {
    // Define stunning gradient backgrounds and text colors based on status
    const themes: {
      [key: string]: {
        gradient: readonly [string, string, ...string[]];
        text: string;
        subText: string;
        dialText: string;
        dialSubText: string;
        borderColor: string;
      };
    } = {
      default: { gradient: ['#475569', '#1e293b'], text: '#FFFFFF', subText: '#cbd5e1', dialText: '#FFFFFF', dialSubText: '#94a3b8', borderColor: '#475569' },
      active: { gradient: ['#0d9488', '#0f766e'], text: '#FFFFFF', subText: '#99f6e4', dialText: '#FFFFFF', dialSubText: '#5eead4', borderColor: '#0d9488' },
      warning: { gradient: ['#f59e0b', '#d97706'], text: '#FFFFFF', subText: '#fef3c7', dialText: '#FFFFFF', dialSubText: '#fde68a', borderColor: '#f59e0b' },
      critical: { gradient: ['#e11d48', '#be123c'], text: '#FFFFFF', subText: '#fda4af', dialText: '#FFFFFF', dialSubText: '#fda4af', borderColor: '#e11d48' },
      special: { gradient: ['#6d28d9', '#5b21b6'], text: '#FFFFFF', subText: '#ddd6fe', dialText: '#FFFFFF', dialSubText: '#c4b5fd', borderColor: '#6d28d9' },
    };

    let currentTheme;
    if (props.label === 'Premium Active') {
        if (props.color === '#22d3ee' || props.color === '#34d399') currentTheme = themes.active;
        else if (props.color === '#fcd34d') currentTheme = themes.warning;
        else currentTheme = themes.critical;
    } else if (props.label === 'Special Access') {
        currentTheme = themes.special;
    } else {
        currentTheme = themes.default; // Expired
    }
    
    return (
      <View style={{ width: '95%', borderRadius: 28, overflow: 'hidden' }}>
        <LinearGradient
          colors={currentTheme.gradient}
          style={{
            paddingVertical: 22,
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: currentTheme.borderColor,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 15,
            elevation: 12,
          }}
        >
          {/* Status Icon */}
          <View style={{
            width: 55, height: 55, borderRadius: 20,
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            justifyContent: 'center', alignItems: 'center', marginRight: 15,
          }}>
            <Ionicons 
              name={props.label === 'Expired' ? 'lock-closed' : (props.label === 'Special Access' ? 'shield-checkmark' : 'checkmark-done')} 
              size={28} color={currentTheme.text} 
            />
          </View>

          {/* Main Content */}
          <View style={{ flex: 1 }}>
            <Text style={{ color: currentTheme.text, fontWeight: '900', fontSize: 17, textTransform: 'uppercase' }}>
              {props.label}
            </Text>
            <Text style={{ color: currentTheme.subText, fontSize: 13, marginTop: 5, fontWeight: '500' }}>
              Plan: ₹{props.monthlyPrice?.toLocaleString()}/mo • Since: {new Date(props.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </Text>
            <Text style={{ color: currentTheme.subText, fontSize: 13, marginTop: 2, fontWeight: '500' }}>
              Valid Till: {props.expiryDate}
            </Text>
          </View>

          {/* Days Left Dial */}
          <View style={{
            width: 75, height: 75, borderRadius: 40,
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            alignItems: 'center', justifyContent: 'center', marginLeft: 10,
          }}>
            <Text style={{ color: currentTheme.dialText, fontSize: 28, fontWeight: '900' }}>
              {props.label === 'Expired' ? '0' : props.timeLeft.split('d')[0]}
            </Text>
            <Text style={{ color: currentTheme.dialSubText, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: -2 }}>
              Days Left
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
  },
  attendance: (props: any) => {
    const { status, teacher_name, date, student_name } = props.props;
    const isPresent = status === 'present';
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('en-IN', { weekday: 'long' });
    const formattedDate = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    return (
      <View style={{
        width: '95%',
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#eee',
        marginTop: 20
      }}>
        <Text style={{ fontSize: 15, color: '#2E3A59', fontWeight: '600', lineHeight: 22, marginBottom: 15 }}>
          Dear <Text style={{ fontWeight: '900' }}>{student_name}</Text>, you have been marked <Text style={{ color: isPresent ? '#00C853' : '#FF3D00', fontWeight: '900' }}>{status.toUpperCase()}</Text> today.
        </Text>

        <View style={{
          backgroundColor: isPresent ? '#00C853' : '#FF3D00',
          height: 60,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 15,
          shadowColor: isPresent ? '#00C853' : '#FF3D00',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4
        }}>
          <Ionicons name={isPresent ? "checkmark-circle" : "close-circle"} size={32} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12, marginTop: 2, letterSpacing: 1 }}>
            {isPresent ? 'VERIFIED PRESENT' : 'MARKED ABSENT'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 }}>
          <View>
            <Text style={{ fontSize: 11, color: '#8F9BB3', fontWeight: '700' }}>{dayName}, {formattedDate}</Text>
            <Text style={{ fontSize: 11, color: '#8F9BB3', fontWeight: '700', marginTop: 2 }}>⏰ {timeStr}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, color: '#8F9BB3', fontWeight: '600', textTransform: 'uppercase' }}>Marked By</Text>
            <Text style={{ fontSize: 12, color: '#2E3A59', fontWeight: '800', marginTop: 2 }}>{teacher_name || 'Principal'}</Text>
          </View>
        </View>
      </View>
    );
  },
};

function RootLayoutContent() {
  const { isDark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { expoPushToken, notification, lastResponse } = usePushNotifications();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(isDark ? '#000' : '#fff');
      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (notification) {
      const { data } = (notification as any).request.content;
      
      // Show custom toast for all notifications
      Toast.show({
        type: data?.type === 'attendance' ? 'attendance' : 'success',
        text1: (notification as any).request.content.title || 'Notification',
        text2: (notification as any).request.content.body || '',
        visibilityTime: 6000,
        props: {
          status: data?.status,
          teacher_name: data?.teacher_name,
          date: data?.date,
          student_name: data?.student_name || 'Student',
          onPress: () => {
            if (data?.type === 'admit-card') {
              router.push({ pathname: '/(student)/admit-card', params: { id: data.id } });
            } else if (data?.type === 'attendance') {
              router.push('/(student)/absent-note');
            } else if (data?.type === 'homework') {
              router.push('/(student)/homework');
            } else if (data?.type === 'notice') {
              if (pathname.includes('(student)')) router.push('/(student)/notice');
              else if (pathname.includes('(teacher)')) router.push('/(teacher)/notice');
              else if (pathname.includes('(principal)')) router.push('/(principal)/notice');
            }
            Toast.hide();
          }
        }
      });
    }
  }, [notification]);

  useEffect(() => {
    if (lastResponse) {
      const data = (lastResponse as any).notification.request.content.data;
      if (data?.type === 'admit-card') {
        router.push({ pathname: '/(student)/admit-card', params: { id: data.id } });
      } else if (data?.type === 'attendance') {
        router.push('/(student)/absent-note');
      } else if (data?.type === 'homework') {
        router.push('/(student)/homework');
      } else if (data?.type === 'notice') {
        if (pathname.includes('(student)')) router.push('/(student)/notice');
        else if (pathname.includes('(teacher)')) router.push('/(teacher)/notice');
        else if (pathname.includes('(principal)')) router.push('/(principal)/notice');
      }
    }
  }, [lastResponse]);

  useEffect(() => {
    const syncPushToken = async () => {
      if (!expoPushToken) return;

      try {
        const studentToken = await AsyncStorage.getItem('studentToken');
        const teacherToken = await AsyncStorage.getItem('teacherToken');
        const principalToken = await AsyncStorage.getItem('principalToken') || await AsyncStorage.getItem('token');

        // Student Sync
        if (studentToken) {
          await axios.put(`${API_ENDPOINTS.AUTH.STUDENT}/update-token`, 
            { push_token: expoPushToken },
            { headers: { Authorization: `Bearer ${studentToken}` } }
          );
        }

        // Teacher Sync
        if (teacherToken) {
          await axios.put(`${API_ENDPOINTS.AUTH.TEACHER}/update-token`, 
            { push_token: expoPushToken },
            { headers: { Authorization: `Bearer ${teacherToken}` } }
          );
        }

        // Principal Sync
        if (principalToken) {
          await axios.put(`${API_ENDPOINTS.AUTH.INSTITUTE}/update-token`, 
            { push_token: expoPushToken },
            { headers: { Authorization: `Bearer ${principalToken}` } }
          );
        }
      } catch (error: any) {
        // Silently fail in production
      }
    };

    syncPushToken();
  }, [expoPushToken, pathname]);

    return (

            <PaperProvider theme={isDark ? DarkTheme : DefaultTheme}>

      

              <GestureHandlerRootView style={{ flex: 1, backgroundColor: isDark ? '#000' : '#fff' }}>

                  <View style={{ flex: 1, paddingBottom: insets.bottom }}>

                      <Stack

      

                        screenOptions={{

      

                          headerShown: false,

      

                          statusBarStyle: isDark ? 'light' : 'dark',

      

                          animation: 'slide_from_right',

      

                        }}

      

                      >

      

                        <Stack.Screen name="index" />

      

                        <Stack.Screen name="(auth)/role-selection" />

      

                        <Stack.Screen name="(auth)/student-login" />

      

                        <Stack.Screen name="(auth)/institute-login" />

      

                        <Stack.Screen name="(auth)/institute-register" />

      

                        <Stack.Screen name="(auth)/teacher-login" />

      

                        <Stack.Screen name="(principal)/dashboard" />

      

                      </Stack>

                  </View>

      

                  <Toast
                    config={toastConfig}
                    position="bottom"
                    bottomOffset={100 + insets.bottom}
                  />
      

                  <UpdateModal />

      

              </GestureHandlerRootView>

      

            </PaperProvider>

    );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SocketProvider>
          <RootLayoutContent />
        </SocketProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
