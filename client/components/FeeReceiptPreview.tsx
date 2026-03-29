import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FeeReceiptPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        institute: any;
        student: any;
        payment: any;
        breakage: any[];
        type: 'MONTHLY' | 'ONE-TIME';
    } | null;
}

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function FeeReceiptPreview({ isOpen, onClose, data }: FeeReceiptPreviewProps) {
    const { theme, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    if (!data) return null;

    const { institute, student, payment, breakage, type } = data;

    const paidDate = payment?.paid_at ? new Date(payment.paid_at) : new Date();
    const dayName = paidDate.toLocaleDateString('en-IN', { weekday: 'long' });
    const formattedDate = paidDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const formattedTime = paidDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const totalPayable = breakage.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const safeTransactions = Array.isArray(payment?.transactions) ? payment.transactions : [];

    return (
        <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: '#fff', paddingTop: insets.top }]}>
                    {/* Professional Header */}
                    <View style={styles.topBar}>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                        <Text style={styles.topBarTitle}>Receipt Preview</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        <View style={styles.receiptPaper}>
                            <View style={styles.watermarkContainer}>
                                <Text style={styles.watermarkText}>PAID</Text>
                            </View>

                            {/* Institute Header */}
                            <View style={styles.instHeader}>
                                <View style={styles.headerMain}>
                                    {institute?.logo_url && (
                                        <Image source={{ uri: institute.logo_url }} style={styles.logo} resizeMode="contain" />
                                    )}
                                    <Text style={styles.instName}>{institute?.institute_name?.toUpperCase() || 'INSTITUTE'}</Text>
                                </View>
                                {institute?.affiliation && <Text style={styles.instAff}>{institute.affiliation}</Text>}
                                <Text style={styles.instAddress}>
                                    {institute?.address || ''}{institute?.landmark ? `, ${institute.landmark}` : ''}, {institute?.district || ''}, {institute?.state || ''} - {institute?.pincode || ''}
                                </Text>
                            </View>

                            <View style={styles.divider} />

                            <Text style={styles.receiptTitle}>FEE RECEIPT</Text>

                            {/* Details Grid */}
                            <View style={styles.detailsGrid}>
                                <View style={styles.detailSection}>
                                    <Text style={styles.sectionLabel}>STUDENT DETAILS</Text>
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Name:</Text>
                                        <Text style={styles.value}>{student?.name}</Text>
                                    </View>
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Class:</Text>
                                        <Text style={styles.value}>{student?.class}-{student?.section}</Text>
                                    </View>
                                    <View style={styles.row}>
                                        <Text style={styles.label}>Roll No:</Text>
                                        <Text style={styles.value}>{student?.roll_no}</Text>
                                    </View>
                                </View>

                                {type === 'MONTHLY' && (
                                    <View style={styles.detailSection}>
                                        <Text style={styles.sectionLabel}>PAYMENT DETAILS</Text>
                                        <View style={styles.row}>
                                            <Text style={styles.label}>Month:</Text>
                                            <Text style={styles.value}>{months[(payment?.month || 1) - 1]} {payment?.year}</Text>
                                        </View>
                                        <View style={styles.row}>
                                            <Text style={styles.label}>Date:</Text>
                                            <Text style={styles.value}>{formattedDate}</Text>
                                        </View>
                                        <View style={styles.row}>
                                            <Text style={styles.label}>Time:</Text>
                                            <Text style={styles.value}>{formattedTime}</Text>
                                        </View>
                                        <View style={styles.row}>
                                            <Text style={styles.label}>Collected By:</Text>
                                            <Text style={styles.value}>{payment?.collected_by || 'Staff'}</Text>
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Table */}
                            <View style={styles.table}>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.tableHeaderText, { flex: 2 }]}>DESCRIPTION</Text>
                                    <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'right' }]}>AMOUNT</Text>
                                </View>
                                {breakage.map((item, idx) => (
                                    <View key={idx} style={styles.tableRow}>
                                        <Text style={[styles.tableCell, { flex: 2 }]}>{item.reason || item.label}</Text>
                                        <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>₹{parseFloat(item.amount || 0).toLocaleString()}</Text>
                                    </View>
                                ))}
                                <View style={styles.tableFooter}>
                                    <Text style={styles.footerLabel}>TOTAL PAYABLE</Text>
                                    <Text style={styles.footerValue}>₹{totalPayable.toLocaleString()}</Text>
                                </View>
                            </View>

                            {/* History Section for One-Time */}
                            {type === 'ONE-TIME' && safeTransactions.length > 0 && (
                                <View style={styles.historyContainer}>
                                    <Text style={styles.historyTitle}>PAYMENT BREAKDOWN</Text>
                                    {safeTransactions.map((t: any, i: number) => (
                                        <View key={i} style={styles.historyRow}>
                                            <View style={{ flex: 2 }}>
                                                <Text style={styles.historyDate}>{new Date(t.created_at).toLocaleDateString('en-IN')}</Text>
                                                <Text style={styles.historyMethod}>{t.payment_method}</Text>
                                            </View>
                                            <Text style={styles.historyAmount}>₹{parseFloat(t.amount || 0).toLocaleString()}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Footer Area */}
                            <View style={styles.footerArea}>
                                <View>
                                    <Text style={styles.footerNote}>Computer Generated Receipt</Text>
                                    <Text style={styles.thankYou}>Thank you for your payment!</Text>
                                </View>
                                <View style={styles.signatureBox}>
                                    <View style={styles.sigLine} />
                                    <Text style={styles.sigText}>Authorized Signature</Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' },
    container: { flex: 1, backgroundColor: '#fff' },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, height: 60, borderBottomWidth: 1, borderBottomColor: '#eee' },
    topBarTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
    closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 15, paddingBottom: 40 },
    receiptPaper: { backgroundColor: '#fff', padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10, minHeight: 600, position: 'relative', overflow: 'hidden' },
    watermarkContainer: { position: 'absolute', top: '40%', left: '20%', transform: [{ rotate: '-30deg' }], zIndex: 0, opacity: 0.05 },
    watermarkText: { fontSize: 100, fontWeight: '900', color: '#10b981', borderColor: '#10b981', borderWidth: 10, padding: 20, borderRadius: 20 },
    instHeader: { alignItems: 'center', marginBottom: 15 },
    headerMain: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    logo: { width: 40, height: 40 },
    instName: { fontSize: 18, fontWeight: '900', color: '#1A237E' },
    instAff: { fontSize: 9, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    instAddress: { fontSize: 9, color: '#475569', textAlign: 'center', marginTop: 5, width: '80%' },
    divider: { height: 2, backgroundColor: '#000', marginVertical: 15 },
    receiptTitle: { fontSize: 18, fontWeight: '800', letterSpacing: 2, marginBottom: 25, borderLeftWidth: 4, borderLeftColor: '#6366f1', paddingLeft: 10 },
    detailsGrid: { marginBottom: 30 },
    detailSection: { marginBottom: 15 },
    sectionLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', marginBottom: 8, letterSpacing: 1 },
    row: { flexDirection: 'row', marginBottom: 4 },
    label: { width: 80, fontSize: 12, fontWeight: '600', color: '#64748b' },
    value: { flex: 1, fontSize: 12, fontWeight: '800', color: '#1a1a1a' },
    table: { marginBottom: 30 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 10 },
    tableHeaderText: { fontSize: 10, fontWeight: '800', color: '#475569' },
    tableRow: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    tableCell: { fontSize: 12, fontWeight: '600', color: '#475569' },
    tableFooter: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#2563eb', padding: 15, marginTop: 10 },
    footerLabel: { color: '#fff', fontSize: 12, fontWeight: '800' },
    footerValue: { color: '#fff', fontSize: 16, fontWeight: '900' },
    historyContainer: { backgroundColor: '#fafafa', padding: 15, borderRadius: 10, marginBottom: 30 },
    historyTitle: { fontSize: 10, fontWeight: '900', color: '#1e293b', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#6366f1', alignSelf: 'flex-start', paddingBottom: 2 },
    historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
    historyDate: { fontSize: 11, fontWeight: '700', color: '#1a1a1a' },
    historyMethod: { fontSize: 9, color: '#64748b' },
    historyAmount: { fontSize: 12, fontWeight: '800', color: '#10b981' },
    footerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 40 },
    footerNote: { fontSize: 9, color: '#94a3b8', fontWeight: '600' },
    thankYou: { fontSize: 12, fontWeight: '800', fontStyle: 'italic' },
    signatureBox: { alignItems: 'center' },
    sigLine: { width: 120, height: 1, backgroundColor: '#000', marginBottom: 5 },
    sigText: { fontSize: 9, fontWeight: '700' }
});
