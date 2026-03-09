import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { generateReceiptPDF } from '../utils/receiptGenerator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_ENDPOINTS } from '../constants/Config';
import Toast from 'react-native-toast-message';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FeeReceiptBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        student: any;
        payment: any;
        month?: number;
        year?: number;
        type?: 'MONTHLY' | 'ONE-TIME';
    } | null;
}

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function FeeReceiptBottomSheet({ isOpen, onClose, data }: FeeReceiptBottomSheetProps) {
    const { theme, isDark } = useTheme();
    const [downloading, setDownloading] = React.useState(false);
    const [institute, setInstitute] = React.useState<any>(null);

    React.useEffect(() => {
        if (isOpen) {
            fetchInstituteProfile();
        }
    }, [isOpen]);

    const fetchInstituteProfile = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(`${API_ENDPOINTS.PRINCIPAL}/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInstitute(response.data.profile);
        } catch (error) {}
    };

    const breakage = useMemo(() => {
        if (!data?.student) return [];
        if (data.type === 'ONE-TIME' && data.student.breakdown) return data.student.breakdown;
        const items = [{ label: 'Monthly Tuition Fee', amount: parseFloat(data.student.monthly_fees || 0) }];
        if (data.student.transport_facility) items.push({ label: 'Transport Fee', amount: parseFloat(data.student.transport_fees || 0) });
        (data.student.extra_charges || []).forEach((ec: any) => items.push({ label: ec.reason, amount: parseFloat(ec.amount) }));
        return items;
    }, [data]);

    const handleDownload = async () => {
        if (!data || !institute) return;
        setDownloading(true);
        try {
            await generateReceiptPDF({ institute, student: data.student, payment: data.payment, breakage, type: data.type || 'MONTHLY', months });
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to generate PDF' });
        } finally {
            setDownloading(false);
        }
    };

    const totalAmount = breakage.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const paidDate = data?.payment?.paid_at ? new Date(data.payment.paid_at) : new Date();
    const formattedDate = paidDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const dayName = paidDate.toLocaleDateString('en-IN', { weekday: 'long' });
    const formattedTime = paidDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const styles = StyleSheet.create({
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
        container: { backgroundColor: '#fff', width: '95%', maxHeight: SCREEN_HEIGHT * 0.9, borderRadius: 20, overflow: 'hidden', elevation: 20 },
        actions: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#fff' },
        closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
        
        receiptContent: { padding: 25, position: 'relative' },
        watermark: { position: 'absolute', top: '40%', alignSelf: 'center', transform: [{ rotate: '-35deg' }], zIndex: 0 },
        watermarkText: { fontSize: 80, fontWeight: '900', color: 'rgba(16, 185, 129, 0.06)', borderWidth: 8, borderColor: 'rgba(16, 185, 129, 0.06)', paddingHorizontal: 20, borderRadius: 15 },

        headerCentered: { alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#1a1a1a', paddingBottom: 20, marginBottom: 25 },
        headerMainRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 5 },
        logo: { width: 50, height: 50 },
        instName: { fontSize: 22, fontWeight: '900', color: '#1a1a1a', textTransform: 'uppercase' },
        instAff: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
        instAddr: { fontSize: 9, color: '#475569', fontWeight: '600', textAlign: 'center', marginTop: 8, lineHeight: 14, maxWidth: '90%' },

        receiptTitle: { marginBottom: 25 },
        titleText: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', letterSpacing: 2, borderLeftWidth: 5, borderLeftColor: '#6366f1', paddingLeft: 12 },

        detailsGrid: { gap: 20, marginBottom: 25 },
        detailSection: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 15 },
        sectionLabel: { fontSize: 8, fontWeight: '800', color: '#64748b', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
        flexRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
        detailText: { fontSize: 12, color: '#475569' },
        bold: { color: '#1a1a1a', fontWeight: '700' },

        table: { marginBottom: 30, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden' },
        tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 12 },
        tableHeaderText: { fontSize: 10, fontWeight: '800', color: '#475569', textTransform: 'uppercase' },
        tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
        tableCell: { fontSize: 12, fontWeight: '600', color: '#1a1a1a' },
        tableFooter: { flexDirection: 'row', backgroundColor: '#2563eb', padding: 15 },
        footerLabel: { fontSize: 12, fontWeight: '800', color: '#fff', flex: 1 },
        footerValue: { fontSize: 16, fontWeight: '900', color: '#fff', textAlign: 'right', flex: 1 },

        historySection: { marginTop: 25, backgroundColor: '#fafafa', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
        historyLabel: { fontSize: 9, fontWeight: '900', color: '#1e293b', borderBottomWidth: 2, borderBottomColor: '#6366f1', paddingBottom: 4, marginBottom: 15, alignSelf: 'flex-start' },
        hRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
        hCell: { fontSize: 11, color: '#1a1a1a' },

        footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fff' },
        downloadBtn: { height: 52, backgroundColor: '#2563eb', borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
        downloadBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

        receiptFooter: { marginTop: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
        paymentMeta: { gap: 4 },
        metaText: { fontSize: 10, color: '#475569' },
        txId: { backgroundColor: '#f1f5f9', paddingHorizontal: 4, borderRadius: 4, fontWeight: '700' },
        thankYou: { textAlign: 'right' },
        compGen: { fontSize: 8, fontWeight: '600', color: '#94a3b8', marginBottom: 4 },
        thankText: { fontSize: 12, fontWeight: '800', color: '#1a1a1a', fontStyle: 'italic' }
    });

    if (!data) return null;

    return (
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Ionicons name="close" size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.receiptContent}>
                            <View style={styles.watermark} pointerEvents="none">
                                <Text style={styles.watermarkText}>PAID</Text>
                            </View>

                            <View style={styles.headerCentered}>
                                <View style={styles.headerMainRow}>
                                    {institute?.logo_url && <Image source={{ uri: institute.logo_url }} style={styles.logo} resizeMode="contain" />}
                                    <Text style={styles.instName}>{institute?.institute_name || 'Institute'}</Text>
                                </View>
                                {institute?.affiliation && <Text style={styles.instAff}>{institute.affiliation}</Text>}
                                <Text style={styles.instAddr}>
                                    {institute?.address || ''}{institute?.landmark ? `, ${institute.landmark}` : ''}, {institute?.district || ''}, {institute?.state || ''} - {institute?.pincode || ''}
                                </Text>
                            </View>

                            <View style={styles.receiptTitle}>
                                <Text style={styles.titleText}>FEE RECEIPT</Text>
                            </View>

                            <View style={styles.detailsGrid}>
                                {data.type === 'MONTHLY' && (
                                    <View style={styles.detailSection}>
                                        <Text style={styles.sectionLabel}>PAYMENT DETAILS</Text>
                                        <View style={styles.flexRow}>
                                            <Text style={styles.detailText}>Billing: <Text style={styles.bold}>{months[(data.payment?.month || 1) - 1]} {data.payment?.year}</Text></Text>
                                            <Text style={styles.detailText}>Date: <Text style={styles.bold}>{formattedDate}</Text></Text>
                                            <Text style={styles.detailText}>Day: <Text style={styles.bold}>{dayName}</Text></Text>
                                            <Text style={styles.detailText}>By: <Text style={styles.bold}>{data.payment?.collected_by || 'Staff'}</Text></Text>
                                        </View>
                                    </View>
                                )}

                                <View style={styles.detailSection}>
                                    <Text style={styles.sectionLabel}>STUDENT DETAILS</Text>
                                    <View style={styles.flexRow}>
                                        <Text style={styles.detailText}>Name: <Text style={styles.bold}>{data.student?.name}</Text></Text>
                                        <Text style={styles.detailText}>Class: <Text style={styles.bold}>{data.student?.class}-{data.student?.section}</Text></Text>
                                        <Text style={styles.detailText}>Roll No: <Text style={styles.bold}>{data.student?.roll_no}</Text></Text>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.table}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.tableHeaderText, { flex: 2 }]}>Description</Text>
                                    <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>Amount</Text>
                                </View>
                                {breakage.map((item, i) => (
                                    <View key={i} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { flex: 2 }]}>{item.reason || item.label}</Text>
                                        <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>₹{parseFloat(item.amount).toLocaleString()}</Text>
                                    </View>
                                ))}
                                <View style={styles.tableFooter}>
                                    <Text style={styles.footerLabel}>TOTAL PAYABLE</Text>
                                    <Text style={styles.footerValue}>₹{totalAmount.toLocaleString()}</Text>
                                </View>
                            </View>

                            {data.type === 'ONE-TIME' && data.payment?.transactions?.length > 0 && (
                                <View style={styles.historySection}>
                                    <Text style={styles.historyLabel}>PAYMENT BREAKDOWN (TRANSACTIONS)</Text>
                                    {data.payment.transactions.map((t: any, idx: number) => {
                                        const tDate = new Date(t.created_at);
                                        return (
                                            <View key={idx} style={styles.hRow}>
                                                <View style={{ flex: 1.5 }}>
                                                    <Text style={[styles.hCell, { fontWeight: '700' }]}>{tDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
                                                    <Text style={{ fontSize: 8, color: '#64748b' }}>{tDate.toLocaleDateString('en-IN', { weekday: 'long' })}</Text>
                                                </View>
                                                <Text style={[styles.hCell, { flex: 1 }]}>{tDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                                                <Text style={[styles.hCell, { flex: 1 }]}>{t.payment_method}</Text>
                                                <Text style={[styles.hCell, { flex: 1, textAlign: 'right', fontWeight: '800' }]}>₹{parseFloat(t.amount).toLocaleString()}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            <View style={styles.receiptFooter}>
                                <View style={styles.paymentMeta}>
                                    {data.type === 'MONTHLY' && (
                                        <>
                                            <Text style={styles.metaText}>Method: <Text style={styles.bold}>{data.payment?.payment_method}</Text></Text>
                                            {data.payment?.transaction_id && <Text style={styles.metaText}>TXID: <Text style={styles.txId}>{data.payment.transaction_id}</Text></Text>}
                                        </>
                                    )}
                                </View>
                                <View style={styles.thankYou}>
                                    <Text style={styles.compGen}>Computer generated receipt.</Text>
                                    <Text style={styles.thankText}>Thank you for your payment!</Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={[styles.downloadBtn, (downloading || !institute) && { opacity: 0.6 }]} activeOpacity={0.8} onPress={handleDownload} disabled={downloading || !institute}>
                            {downloading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="download-outline" size={20} color="#fff" /><Text style={styles.downloadBtnText}>Download PDF</Text></>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
