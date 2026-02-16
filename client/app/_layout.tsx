import { Stack, usePathname, useRouter } from 'expo-router';
import { ThemeProvider } from '../context/ThemeContext';
import { SocketProvider } from '../context/SocketContext';
import { useEffect } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_ENDPOINTS } from '../constants/Config';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export const toastConfig = {
  success: (props: any) => (
    <View style={{
      width: '90%',
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 6,
      borderLeftWidth: 6,
      borderLeftColor: '#00C853',
      marginTop: 20
    }}>
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E8F5E9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
      }}>
        <Ionicons name="checkmark" size={24} color="#00C853" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: '#2E3A59' }}>{props.text1}</Text>
        <Text style={{ fontSize: 13, color: '#8F9BB3', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>
      </View>
    </View>
  ),
  fee: (props: any) => (
    <View style={{
      width: '95%',
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      borderLeftWidth: 6,
      borderLeftColor: '#3F51B5',
      marginTop: 20
    }}>
      <View style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E8EAF6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
      }}>
        <Ionicons name="card" size={24} color="#3F51B5" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '900', color: '#1A237E' }}>{props.text1}</Text>
        <Text style={{ fontSize: 12, color: '#5C6BC0', marginTop: 2, fontWeight: '700' }}>{props.text2}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity 
          onPress={() => Toast.hide()}
          style={{
            backgroundColor: '#FFEBEE',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: '#D32F2F', fontWeight: '900', fontSize: 11 }}>IGNORE</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={props.props.onPress}
          style={{
            backgroundColor: '#3F51B5',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>PAY NOW</Text>
        </TouchableOpacity>
      </View>
    </View>
  ),
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
  subscription: (props: any) => {
    const { timeLeft, expiryDate, color, label } = props.props;
    return (
      <View style={{
        width: '95%',
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 10,
        borderTopWidth: 6,
        borderTopColor: color,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ backgroundColor: color + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
            <Text style={{ color: color, fontWeight: '900', fontSize: 12, textTransform: 'uppercase' }}>{label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="time-outline" size={16} color="#8F9BB3" style={{ marginRight: 4 }} />
            <Text style={{ color: '#8F9BB3', fontWeight: '700', fontSize: 13 }}>{timeLeft}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 18, fontWeight: '800', color: '#2E3A59', marginBottom: 4 }}>Subscription Details</Text>
        <Text style={{ fontSize: 14, color: '#8F9BB3', fontWeight: '600' }}>
          Expires on: <Text style={{ color: '#2E3A59', fontWeight: '800' }}>{expiryDate}</Text>
        </Text>

        <View style={{ marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' }}>
          <Text style={{ fontSize: 12, color: '#8F9BB3', fontWeight: '600', fontStyle: 'italic', lineHeight: 18 }}>
            Renew your subscription from the web dashboard to avoid service interruption.
          </Text>
        </View>
      </View>
    );
  },
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#FF3D00', borderRadius: 12, width: '90%', height: 70 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 16, fontWeight: 'bold', color: '#000' }}
      text2Style={{ fontSize: 13, color: '#666' }}
    />
  )
};

// ... imports

// Safely access properties to prevent crashes if modules are missing during dev
// const useSafePushNotifications = () => {
//   try {
//     return usePushNotifications();
//   } catch (e) {
//     console.warn("Push notifications module missing:", e);
//     return { expoPushToken: undefined, notification: undefined };
//   }
// }

export default function RootLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { expoPushToken, notification, lastResponse } = usePushNotifications();

  const handleFeePress = () => {
    router.push('/(student)/fees');
    Toast.hide();
  };

  useEffect(() => {
    const syncPushToken = async () => {
      if (expoPushToken) {
        try {
          // Identify active role based on path
          const isStudentPath = pathname.includes('(student)');
          const isTeacherPath = pathname.includes('(teacher)');
          const isPrincipalPath = pathname.includes('(principal)');

          if (isStudentPath) {
            const studentToken = await AsyncStorage.getItem('studentToken');
            if (studentToken) {
              const url = `${API_ENDPOINTS.AUTH.STUDENT}/update-token`;
              console.log(`[PushSync] Attempting student sync: ${url}`);
              await axios.put(url, {
                push_token: expoPushToken
              }, {
                headers: { Authorization: `Bearer ${studentToken}` }
              });
              console.log('Active Student push token synced');
              return;
            }
          }

          if (isTeacherPath) {
            const teacherToken = await AsyncStorage.getItem('teacherToken');
            if (teacherToken) {
              const url = `${API_ENDPOINTS.AUTH.TEACHER}/update-token`;
              console.log(`[PushSync] Attempting teacher sync: ${url}`);
              await axios.put(url, {
                push_token: expoPushToken
              }, {
                headers: { Authorization: `Bearer ${teacherToken}` }
              });
              console.log('Active Teacher push token synced');
              return;
            }
          }

          if (isPrincipalPath) {
            const principalToken = await AsyncStorage.getItem('token');
            if (principalToken) {
              const url = `${API_ENDPOINTS.AUTH.INSTITUTE}/update-token`;
              console.log(`[PushSync] Attempting principal sync: ${url}`);
              await axios.put(url, {
                push_token: expoPushToken
              }, {
                headers: { Authorization: `Bearer ${principalToken}` }
              });
              console.log('Active Principal push token synced');
              return;
            }
          }

          // Fallback logic if not on a specific path but tokens exist (e.g. initial load)
          if (!isStudentPath && !isTeacherPath && !isPrincipalPath) {
            // Priority: Student > Teacher > Principal
            const sToken = await AsyncStorage.getItem('studentToken');
            if (sToken) {
              await axios.put(`${API_ENDPOINTS.AUTH.STUDENT}/update-token`, { push_token: expoPushToken }, { headers: { Authorization: `Bearer ${sToken}` } });
              return;
            }
            const tToken = await AsyncStorage.getItem('teacherToken');
            if (tToken) {
              await axios.put(`${API_ENDPOINTS.AUTH.TEACHER}/update-token`, { push_token: expoPushToken }, { headers: { Authorization: `Bearer ${tToken}` } });
              return;
            }
            const pToken = await AsyncStorage.getItem('token');
            if (pToken) {
              await axios.put(`${API_ENDPOINTS.AUTH.INSTITUTE}/update-token`, { push_token: expoPushToken }, { headers: { Authorization: `Bearer ${pToken}` } });
              return;
            }
          }
        } catch (error) {
          console.error('Error syncing push token:', error);
        }
      }
    };

    syncPushToken();
  }, [expoPushToken, pathname]);


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
            if (data?.type === 'fees') {
              router.push('/(student)/fees');
            } else if (data?.type === 'admit-card') {
              router.push({ pathname: '/(student)/admit-card', params: { id: data.id } });
            } else if (data?.type === 'attendance') {
              router.push('/(student)/absent-note');
            } else if (data?.type === 'homework') {
              router.push('/(student)/homework');
            } else if (data?.type === 'notice') {
              if (pathname.includes('(student)')) router.push('/(student)/notice');
              else if (pathname.includes('(teacher)')) router.push('/(teacher)/notice');
              else if (pathname.includes('(principal)')) router.push('/(principal)/notice');
            } else if (data?.type === 'fee_received') {
              if (pathname.includes('(principal)')) {
                router.push('/(principal)/fees');
              } else if (pathname.includes('(teacher)')) {
                router.push('/(teacher)/fees');
              }
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
      if (data?.type === 'fees') {
        router.push('/(student)/fees');
      } else if (data?.type === 'admit-card') {
        router.push({ pathname: '/(student)/admit-card', params: { id: data.id } });
      } else if (data?.type === 'attendance') {
        router.push('/(student)/absent-note');
      } else if (data?.type === 'homework') {
        router.push('/(student)/homework');
      } else if (data?.type === 'notice') {
        if (pathname.includes('(student)')) router.push('/(student)/notice');
        else if (pathname.includes('(teacher)')) router.push('/(teacher)/notice');
        else if (pathname.includes('(principal)')) router.push('/(principal)/notice');
      } else if (data?.type === 'fee_received') {
        if (pathname.includes('(principal)')) {
          router.push('/(principal)/fees');
        } else if (pathname.includes('(teacher)')) {
          router.push('/(teacher)/fees');
        }
      }
    }
  }, [lastResponse]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SocketProvider>
          <Stack screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            presentation: 'card',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            animationDuration: 250,
          }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)/student-login" />
            <Stack.Screen name="(auth)/institute-login" />
            <Stack.Screen name="(auth)/institute-register" />
            <Stack.Screen name="(auth)/teacher-login" />
            <Stack.Screen name="(principal)/dashboard" />
          </Stack>
          <Toast 
            config={toastConfig} 
            position="top"
            topOffset={80}
            visibilityTime={5000}
          />
        </SocketProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
