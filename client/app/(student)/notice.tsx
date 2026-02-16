import { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Modal, FlatList, Dimensions, RefreshControl, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';
import { API_ENDPOINTS } from '../../constants/Config';

export default function StudentNoticeScreen() {
    const router = useRouter();
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [notices, setNotices] = useState<any[]>([]);
    const [institute, setInstitute] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Preview Modal State
    const [previewVisible, setPreviewVisible] = useState(false);
    const [selectedNotice, setSelectedNotice] = useState<any>(null);

    useFocusEffect(
        useCallback(() => {
            fetchNotices();
        }, [])
    );

    const fetchNotices = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('studentToken');
            const userData = await AsyncStorage.getItem('studentData');
            const selectedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const sessionId = selectedSessionId || (userData ? JSON.parse(userData).current_session_id : null);

            const response = await axios.get(API_ENDPOINTS.NOTICE, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                }
            });
            setNotices(response.data.notices);
            setInstitute(response.data.institute);
        } catch (error) {
            console.error('Error fetching notices:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotices();
    };

    const openPreview = (notice: any) => {
        setSelectedNotice(notice);
        setPreviewVisible(true);
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
        },
        backBtn: { padding: 5, marginRight: 15 },
        headerTitle: { fontSize: 20, fontWeight: '900', color: theme.text },
        listContent: { padding: 15 },
        noticeCard: {
            backgroundColor: theme.card,
            borderRadius: 20,
            padding: 18,
            marginBottom: 15,
            borderWidth: 1,
            borderColor: theme.border,
        },
        noticeTopic: { fontSize: 18, fontWeight: '800', color: theme.text, marginBottom: 8 },
        noticeDate: { fontSize: 12, color: theme.textLight, fontWeight: '600' },

        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
        previewContent: {
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 20,
            minHeight: 400,
        },
        previewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
        previewLogo: { width: 50, height: 50, borderRadius: 10, marginRight: 15 },
        previewInstName: { fontSize: 20, fontWeight: '900', color: '#1a1a1a', flex: 1 },
        previewAffiliation: { fontSize: 12, fontWeight: '700', color: '#666', textAlign: 'center', marginVertical: 5 },
        previewAddress: { fontSize: 11, color: '#888', textAlign: 'center', lineHeight: 16 },
        previewLine: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
        previewNoticeContent: { fontSize: 16, color: '#333', lineHeight: 24, minHeight: 150 },
        previewDate: { fontSize: 13, color: '#999', fontWeight: '700', marginTop: 20, textAlign: 'right' },
        closePreview: {
            marginTop: 20,
            backgroundColor: '#1a1a1a',
            height: 50,
            borderRadius: 15,
            justifyContent: 'center',
            alignItems: 'center'
        }
    }), [theme, insets, isDark]);

    if (loading && !refreshing) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle={theme.statusBarStyle} />
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notice Board</Text>
            </View>

            <FlatList
                data={notices}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.noticeCard} onPress={() => openPreview(item)}>
                        <Text style={styles.noticeTopic}>{item.topic}</Text>
                        <Text style={{ fontSize: 13, color: theme.primary, fontWeight: '700', marginBottom: 8 }}>
                            Posted by: {item.creator_name}
                        </Text>
                        <Text style={styles.noticeDate}>
                            {new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 100 }}>
                        <Ionicons name="notifications-off-outline" size={60} color={theme.border} />
                        <Text style={{ color: theme.textLight, marginTop: 10 }}>No notices for you</Text>
                    </View>
                }
            />

            <Modal visible={previewVisible} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.previewContent}>
                        <View style={styles.previewHeader}>
                            {institute?.logo_url && <Image source={{ uri: institute.logo_url }} style={styles.previewLogo} />}
                            <Text style={styles.previewInstName}>{institute?.institute_name}</Text>
                        </View>
                        <Text style={styles.previewAffiliation}>{institute?.affiliation || 'N/A'}</Text>
                        <Text style={styles.previewAddress}>
                            {institute?.address}, {institute?.landmark && `${institute.landmark}, `}
                            {institute?.district}, {institute?.state} - {institute?.pincode}
                        </Text>
                        <View style={styles.previewLine} />
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#1a1a1a', marginBottom: 15, textAlign: 'center' }}>{selectedNotice?.topic}</Text>
                            <Text style={styles.previewNoticeContent}>{selectedNotice?.content}</Text>
                            <Text style={styles.previewDate}>Date: {new Date(selectedNotice?.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
                        </ScrollView>
                        <TouchableOpacity style={styles.closePreview} onPress={() => setPreviewVisible(false)}>
                            <Text style={{ color: '#fff', fontWeight: '800' }}>CLOSE</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
