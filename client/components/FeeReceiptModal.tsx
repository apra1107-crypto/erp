import React, { useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { GestureHandlerRootView, PinchGestureHandler, State } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

interface FeeReceiptModalProps {
    visible: boolean;
    onClose: () => void;
    feeData: any;
    institute: any;
    student: any;
    onShare: () => void;
}

export default function FeeReceiptModal({ visible, onClose, feeData, institute, student, onShare }: FeeReceiptModalProps) {
    const { theme, isDark } = useTheme();
    
    // Scale value for Android pinch to zoom
    const scale = useRef(new Animated.Value(1)).current;

    if (!feeData || !institute || !student) return null;

    const onPinchEvent = Animated.event(
        [{ nativeEvent: { scale: scale } }],
        { useNativeDriver: true }
    );

    const onPinchStateChange = (event: any) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
            Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
                bounciness: 1,
            }).start();
        }
    };

    const isMonthly = !!feeData.breakdown;
    const items = isMonthly 
        ? Object.entries(feeData.breakdown)
        : (feeData.items || '').split(' + ').map((name: string, i: number) => [name, (feeData.amount_breakdown || '').split(' + ')[i]]);

    const fullAddress = [
        institute.address || institute.institute_address,
        institute.landmark,
        institute.district,
        institute.state,
        institute.pincode
    ].filter(Boolean).join(', ');

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.container, { backgroundColor: isDark ? '#121212' : '#F8F9FA' }]}>
                        {/* Header */}
                        <View style={[styles.header, { borderBottomColor: theme.border }]}>
                            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                                <Ionicons name="close" size={28} color={theme.text} />
                            </TouchableOpacity>
                            <View style={{ alignItems: 'center' }}>
                                <Text style={[styles.headerTitle, { color: theme.text }]}>Fee Receipt</Text>
                                <Text style={{ fontSize: 10, color: theme.textLight, fontWeight: '700' }}>Pinch to zoom</Text>
                            </View>
                            <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
                                <Ionicons name="share-outline" size={24} color={theme.primary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView 
                            showsVerticalScrollIndicator={false} 
                            contentContainerStyle={styles.scrollContent}
                            maximumZoomScale={3} // Native for iOS
                            minimumZoomScale={1}
                        >
                            <PinchGestureHandler
                                onGestureEvent={onPinchEvent}
                                onHandlerStateChange={onPinchStateChange}
                            >
                                <Animated.View style={[
                                    styles.receiptPaper, 
                                    { 
                                        backgroundColor: '#FFFFFF', 
                                        shadowColor: '#000',
                                        transform: [{ scale: scale }]
                                    }
                                ]}>
                                    
                                    {/* School Header */}
                                    <View style={styles.schoolHeader}>
                                        {institute.logo_url && (
                                            <Image source={{ uri: institute.logo_url }} style={styles.logo} resizeMode="contain" />
                                        )}
                                        <View style={styles.schoolInfo}>
                                            <Text style={[styles.schoolName, { color: '#1A237E' }]}>{institute?.institute_name || 'INSTITUTE'}</Text>
                                            {institute?.affiliation && (
                                                <Text style={styles.affiliation}>{institute.affiliation}</Text>
                                            )}
                                            <Text style={styles.address}>{fullAddress}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.divider} />

                                    {/* Receipt Details Grid */}
                                    <View style={styles.detailsGrid}>
                                        <View style={styles.detailBox}>
                                            <Text style={styles.detailLabel}>RECEIPT NO</Text>
                                            <Text style={[styles.detailValue, { color: '#333' }]}>{feeData?.payment_id || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.detailBox}>
                                            <Text style={styles.detailLabel}>DATE</Text>
                                            <Text style={[styles.detailValue, { color: '#333' }]}>{feeData?.paid_at ? new Date(feeData.paid_at).toLocaleDateString('en-IN') : 'N/A'}</Text>
                                        </View>
                                        <View style={styles.detailBox}>
                                            <Text style={styles.detailLabel}>STUDENT</Text>
                                            <Text style={[styles.detailValue, { color: '#333' }]}>{student?.name || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.detailBox}>
                                            <Text style={styles.detailLabel}>CLASS</Text>
                                            <Text style={[styles.detailValue, { color: '#333' }]}>{student?.class || 'N/A'} - {student?.section || 'N/A'}</Text>
                                        </View>
                                    </View>

                                    {/* Table Header */}
                                    <View style={[styles.tableHeader, { backgroundColor: '#F8F9FA' }]}>
                                        <Text style={styles.tableHeadText}>DESCRIPTION</Text>
                                        <Text style={[styles.tableHeadText, { textAlign: 'right' }]}>AMOUNT (INR)</Text>
                                    </View>

                                    {/* Table Rows */}
                                    {items.map(([name, amt]: any, idx: number) => (
                                        <View key={idx} style={[styles.tableRow, { borderBottomColor: '#EEEEEE' }]}>
                                            <Text style={[styles.rowText, { color: '#333' }]}>{name}</Text>
                                            <Text style={[styles.rowAmt, { color: '#333' }]}>₹{parseFloat(amt || 0).toLocaleString()}</Text>
                                        </View>
                                    ))}

                                    {/* Total Row */}
                                    <View style={[styles.totalRow, { backgroundColor: '#E8EAF6' }]}>
                                        <Text style={[styles.totalLabel, { color: '#1A237E' }]}>GRAND TOTAL</Text>
                                        <Text style={[styles.totalValue, { color: '#1A237E' }]}>₹{parseFloat(feeData?.total_amount || 0).toLocaleString()}</Text>
                                    </View>

                                    <View style={styles.paymentMeta}>
                                        <Text style={styles.metaText}><Text style={styles.metaLabel}>Mode: </Text>{feeData?.payment_id?.startsWith('COUNTER_') ? 'Counter Cash' : 'Online / Digital'}</Text>
                                        <Text style={styles.metaText}><Text style={styles.metaLabel}>Collected By: </Text>{feeData?.payment_id?.startsWith('COUNTER_') ? (feeData?.collected_by || 'Office') : 'System'}</Text>
                                    </View>

                                    {/* Signatures */}
                                    <View style={styles.sigSection}>
                                        <View style={styles.sigBox}>
                                            <View style={[styles.sigLine, { backgroundColor: '#999' }]}/>
                                            <Text style={styles.sigLabel}>Parent/Student</Text>
                                        </View>
                                        <View style={styles.sigBox}>
                                            <View style={[styles.sigLine, { backgroundColor: '#999' }]}/>
                                            <Text style={styles.sigLabel}>Authorized Sign</Text>
                                        </View>
                                    </View>

                                    <View style={styles.footer}>
                                        <Text style={styles.footerText}>This is a computer generated document.</Text>
                                        <Text style={styles.footerText}>{institute?.mobile} | {institute?.email}</Text>
                                    </View>

                                    {/* Watermark */}
                                    <View style={styles.watermarkContainer} pointerEvents="none">
                                        <Text style={[styles.watermarkText, { color: 'rgba(0, 200, 83, 0.12)' }]}>PAID</Text>
                                    </View>
                                </Animated.View>
                            </PinchGestureHandler>
                        </ScrollView>
                    </View>
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' },
    container: { flex: 1, marginTop: 50, borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
    header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1 },
    closeBtn: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    shareBtn: { padding: 5 },
    scrollContent: { padding: 20, paddingBottom: 60 },
    receiptPaper: {
        padding: 20,
        borderRadius: 10,
        elevation: 10,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        position: 'relative',
        overflow: 'hidden'
    },
    watermarkContainer: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center', alignItems: 'center',
        zIndex: 100, // Higher layer to be visible above components
    },
    watermarkText: {
        fontSize: 100,
        fontWeight: '900',
        transform: [{ rotate: '-35deg' }],
    },
    schoolHeader: { alignItems: 'center', marginBottom: 20, zIndex: 1 },
    logo: { width: 60, height: 60, marginBottom: 10, borderRadius: 10 },
    schoolInfo: { alignItems: 'center' },
    schoolName: { fontSize: 22, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase' },
    affiliation: { fontSize: 10, color: '#666', fontWeight: '700', marginBottom: 2 },
    address: { fontSize: 10, color: '#888', textAlign: 'center' },
    divider: { height: 2, backgroundColor: '#1A237E', marginVertical: 15, width: '100%' },
    detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, zIndex: 1 },
    detailBox: { width: '50%', marginBottom: 15 },
    detailLabel: { fontSize: 9, color: '#999', fontWeight: '800', marginBottom: 2 },
    detailValue: { fontSize: 12, fontWeight: '700' },
    tableHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderRadius: 5, marginBottom: 5 },
    tableHeadText: { fontSize: 10, fontWeight: '800', color: '#999' },
    tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 12, borderBottomWidth: 1 },
    rowText: { fontSize: 13, fontWeight: '600' },
    rowAmt: { fontSize: 13, fontWeight: '700' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderRadius: 10, marginTop: 15 },
    totalLabel: { fontSize: 14, fontWeight: '900' },
    totalValue: { fontSize: 18, fontWeight: '900' },
    paymentMeta: { marginTop: 20, gap: 5 },
    metaLabel: { fontSize: 11, color: '#999', fontWeight: '700' },
    metaText: { fontSize: 12, color: '#666', fontWeight: '600' },
    sigSection: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 50, marginBottom: 30 },
    sigBox: { alignItems: 'center', width: 120 },
    sigLine: { height: 1, width: '100%', marginBottom: 5 },
    sigLabel: { fontSize: 10, color: '#999', fontWeight: '700' },
    footer: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15, alignItems: 'center' },
    footerText: { fontSize: 9, color: '#aaa', marginBottom: 2 }
});