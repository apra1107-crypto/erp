import { Stack, usePathname, useRouter } from 'expo-router';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { SocketProvider } from '../context/SocketContext';
import { useEffect, useRef } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import Toast from 'react-native-toast-message';
import { View, Text, Platform, Alert, TouchableOpacity, DeviceEventEmitter } from 'react-native';
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

export const toastConfig = {
  subscription: ({ props }: any) => {
    // Define stunning gradient backgrounds and text colors based on status
    const themes: any = {
      default: { gradient: ['#475569', '#1e293b'], text: '#FFFFFF', subText: '#cbd5e1', dialText: '#FFFFFF', dialSubText: '#94a3b8', borderColor: '#475569' },
      active: { gradient: ['#0d9488', '#0f766e'], text: '#FFFFFF', subText: '#99f6e4', dialText: '#FFFFFF', dialSubText: '#5eead4', borderColor: '#0d9488' },
      warning: { gradient: ['#f59e0b', '#d97706'], text: '#FFFFFF', subText: '#fef3c7', dialText: '#FFFFFF', dialSubText: '#fde68a', borderColor: '#f59e0b' },
      critical: { gradient: ['#e11d48', '#be123c'], text: '#FFFFFF', subText: '#fda4af', dialText: '#FFFFFF', dialSubText: '#fda4af', borderColor: '#e11d48' },
      special: { gradient: ['#6d28d9', '#5b21b6'], text: '#FFFFFF', subText: '#ddd6fe', dialText: '#FFFFFF', dialSubText: '#c4b5fd', borderColor: '#6d28d9' },
    };

    let currentTheme = themes.default;
    const label = props?.label || 'Premium Status';
    
    if (label === 'Premium Active') {
        if (props.color === '#22d3ee' || props.color === '#34d399') currentTheme = themes.active;
        else if (props.color === '#fcd34d') currentTheme = themes.warning;
        else currentTheme = themes.critical;
    } else if (label === 'Special Access') {
        currentTheme = themes.special;
    }

    const startDate = props?.startDate ? new Date(props.startDate) : new Date();
    const formattedStartDate = isNaN(startDate.getTime()) ? 'Recently' : startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const timeLeft = props?.timeLeft || '0d';
    const daysLeft = timeLeft.match(/\d+/)?.[0] || '0';
    
    return (
      <View style={{ width: '95%', borderRadius: 28, alignSelf: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 }}>
        <View style={{ borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <LinearGradient
            colors={currentTheme.gradient}
            style={{
                paddingVertical: 22,
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
            }}
            >
            {/* Status Icon */}
            <View style={{
                width: 56, height: 56, borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                justifyContent: 'center', alignItems: 'center', marginRight: 15,
            }}>
                <Ionicons 
                name={label === 'Expired' ? 'lock-closed' : (label === 'Special Access' ? 'shield-checkmark' : 'checkmark-done')} 
                size={28} color="#fff" 
                />
            </View>

            {/* Main Content */}
            <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {label}
                </Text>
                <View style={{ marginTop: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '800' }}>
                    Plan: ₹{(props?.monthlyPrice || 0).toLocaleString()}/month
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2, fontWeight: '700' }}>
                    Valid Till: {props?.expiryDate}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2, fontWeight: '600' }}>
                    Taken On: {props?.takenOn}
                    </Text>
                </View>
            </View>

            {/* Days Left Dial */}
            <View style={{
                width: 75, height: 75, borderRadius: 40,
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                alignItems: 'center', justifyContent: 'center', marginLeft: 10,
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.1)'
            }}>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>
                {label === 'Expired' ? '0' : daysLeft}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', marginTop: -2 }}>
                {timeLeft.includes('h') ? 'Hours' : 'Days'} Left
                </Text>
            </View>
            </LinearGradient>
        </View>
      </View>
    );
  },
  success: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#10b981', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#10b98120', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
            {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
        </View>
    </View>
  ),
  error: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#ef4444', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ef444420', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="alert-circle" size={24} color="#ef4444" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
            {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
        </View>
    </View>
  ),
  info: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#3b82f6', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f620', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="information-circle" size={24} color="#3b82f6" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
            {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
        </View>
    </View>
  ),
  homework: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#f97316', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} activeOpacity={0.9} onPress={() => props.onPress ? props.onPress() : (props.props?.onPress ? props.props.onPress() : null)}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f9731620', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="book" size={22} color="#f97316" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
                {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
            </View>
        </TouchableOpacity>
    </View>
  ),
  notice: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#6366f1', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} activeOpacity={0.9} onPress={() => props.onPress ? props.onPress() : (props.props?.onPress ? props.props.onPress() : null)}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f120', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="notifications" size={22} color="#6366f1" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
                {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
            </View>
        </TouchableOpacity>
    </View>
  ),
  'admit-card': (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#af52de', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} activeOpacity={0.9} onPress={() => props.onPress ? props.onPress() : (props.props?.onPress ? props.props.onPress() : null)}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#af52de20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="card" size={22} color="#af52de" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
                {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
            </View>
        </TouchableOpacity>
    </View>
  ),
  'RESULT_PUBLISHED': (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#E91E63', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} activeOpacity={0.9} onPress={() => props.onPress ? props.onPress() : (props.props?.onPress ? props.props.onPress() : null)}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E91E6320', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="trophy" size={22} color="#E91E63" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
                {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
            </View>
        </TouchableOpacity>
    </View>
  ),
  'result': (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#E91E63', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} activeOpacity={0.9} onPress={() => props.onPress ? props.onPress() : (props.props?.onPress ? props.props.onPress() : null)}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#E91E6320', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="trophy" size={22} color="#E91E63" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
                {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
            </View>
        </TouchableOpacity>
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
  pay_now_enabled: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#3b82f6', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} activeOpacity={0.9} onPress={() => props.onPress ? props.onPress() : (props.props?.onPress ? props.props.onPress() : null)}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f620', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="card" size={22} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
                {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
            </View>
        </TouchableOpacity>
    </View>
  ),
  fee_payment: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#10b981', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#10b98120', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
            {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
        </View>
    </View>
  ),
  monthly_fee: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#6366f1', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f120', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="wallet" size={22} color="#6366f1" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
            {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
        </View>
    </View>
  ),
  one_time_fee: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#f59e0b', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} activeOpacity={0.9} onPress={() => props.onPress ? props.onPress() : (props.props?.onPress ? props.props.onPress() : null)}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f59e0b20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Ionicons name="flash" size={22} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
                {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
            </View>
        </TouchableOpacity>
    </View>
  ),
  teacher_attendance: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#8b5cf6', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#8b5cf620', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="people" size={22} color="#8b5cf6" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
            {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
        </View>
    </View>
  ),
  salary: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#10b981', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#10b98120', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="cash" size={22} color="#10b981" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
            {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
        </View>
    </View>
  ),
  request: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#f59e0b', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f59e0b20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="mail" size={22} color="#f59e0b" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
            {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
        </View>
    </View>
  ),
  transport_proximity: (props: any) => (
    <View style={{ width: '95%', backgroundColor: '#fff', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: '#06b6d4', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#06b6d420', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Ionicons name="bus" size={22} color="#06b6d4" />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{props.text1}</Text>
            {props.text2 && <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '600' }}>{props.text2}</Text>}
        </View>
    </View>
  ),
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
      const toastType = data?.type || 'success';
      
      // PERSISTENCE FIX: Save important notifications to history box immediately
      if (['attendance', 'homework', 'notice', 'admit-card', 'RESULT_PUBLISHED', 'fee_payment', 'monthly_fee', 'one_time_fee'].includes(toastType)) {
        (async () => {
          try {
            const studentStr = await AsyncStorage.getItem('studentData');
            if (studentStr) {
              const student = JSON.parse(studentStr);
              if (student.unique_code) {
                const key = `notifs_${student.unique_code}`;
                const saved = await AsyncStorage.getItem(key);
                const list = saved ? JSON.parse(saved) : [];
                
                // Add new one
                const newNotif = {
                  id: Math.random().toString(36).substr(2, 9),
                  time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                  title: (notification as any).request.content.title,
                  message: (notification as any).request.content.body,
                  type: toastType === 'RESULT_PUBLISHED' ? 'result' : toastType
                };

                // Prevent duplicates (simple check by title/message)
                const exists = list.some((n: any) => n.title === newNotif.title && n.message === newNotif.message);
                if (!exists) {
                  const updated = [newNotif, ...list].slice(0, 20);
                  await AsyncStorage.setItem(key, JSON.stringify(updated));
                  // GLOBAL UI SYNC: Tell the dashboard to reload its list
                  DeviceEventEmitter.emit('notificationReceived');
                }
              }
            }
          } catch (e) {
            console.error('Error persisting push to history:', e);
          }
        })();
      }

      Toast.show({
        type: toastType,
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
            } else if (data?.type === 'pay_now_enabled' || data?.type === 'monthly_fee' || data?.type === 'one_time_fee') {
              router.push('/(student)/fees');
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
      } else if (data?.type === 'pay_now_enabled' || data?.type === 'monthly_fee' || data?.type === 'one_time_fee') {
        router.push('/(student)/fees');
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
