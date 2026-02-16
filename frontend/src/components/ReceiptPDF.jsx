import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';

Font.register({
    family: 'Noto Sans',
    src: 'https://fonts.gstatic.com/s/notosans/v42/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99d.ttf',
});

const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontFamily: 'Noto Sans',
        backgroundColor: '#ffffff',
    },
    container: {
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        border: '1pt solid #e2e8f0',
        borderRadius: 16,
        padding: 0,
        position: 'relative',
        overflow: 'hidden',
    },
    watermark: {
        position: 'absolute',
        top: '40%',
        left: '25%',
        fontSize: 100,
        fontWeight: 'bold',
        color: '#10b981',
        opacity: 0.08,
        transform: 'rotate(-30deg)',
    },
    header: {
        padding: '20px 20px 12px',
        textAlign: 'center',
        borderBottomWidth: 2,
        borderBottomColor: '#e2e8f0',
        borderBottomStyle: 'dashed',
        alignItems: 'center',
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        width: '100%',
    },
    logo: {
        width: 42,
        height: 42,
        marginRight: 8,
        borderRadius: 6,
    },
    nameAffGroup: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    instName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        textTransform: 'uppercase',
        textAlign: 'left',
    },
    instAff: {
        fontSize: 7.5,
        color: '#475569',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginTop: 2,
        textAlign: 'left',
    },
    instAddress: {
        fontSize: 8.5,
        color: '#64748b',
        textAlign: 'center',
        width: '100%',
        lineHeight: 1.3,
        marginTop: -3,
    },
    receiptBody: {
        padding: '20px 30px',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#f0fdf4',
        border: '1pt solid #bbf7d0',
        marginBottom: 20,
    },
    statusBadgeCounter: {
        backgroundColor: '#f5f3ff',
        border: '1pt solid #ddd6fe',
    },
    statusText: {
        color: '#059669',
        fontSize: 11,
        fontWeight: 'bold',
    },
    statusTextCounter: {
        color: '#0f0f0f',
    },
    sectionTitle: {
        fontSize: 10.5,
        fontWeight: 'bold',
        color: '#080808',
        textTransform: 'uppercase',
        marginBottom: 10,
        marginTop: 15,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 15,
        marginBottom: 20,
        border: '1pt solid #070707',
    },
    gridItem: {
        width: '50%',
        marginBottom: 10,
    },
    label: {
        fontSize: 8.5,
        color: '#000000',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 3,
    },
    value: {
        fontSize: 11,
        color: '#000000',
        fontWeight: 'bold',
    },
    table: {
        width: '100%',
        marginBottom: 20,
    },
    tableHeaderRow: {
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 8,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f8fafc',
        paddingVertical: 10,
    },
    colLabel: {
        flex: 3,
        fontSize: 9.5,
        color: '#000000',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        paddingLeft: 8,
    },
    colAmt: {
        flex: 1,
        textAlign: 'right',
        fontSize: 9.5,
        color: '#000000',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        paddingRight: 8,
    },
    rowLabel: {
        flex: 3,
        fontSize: 10.5,
        color: '#000000',
        paddingLeft: 8,
    },
    rowAmt: {
        flex: 1,
        textAlign: 'right',
        fontSize: 10.5,
        color: '#000000',
        fontWeight: 'bold',
        paddingRight: 8,
    },
    totalSection: {
        backgroundColor: '#fdfdfd',
        borderRadius: 12,
        padding: 15,
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: 13,
        color: '#020202',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    totalAmount: {
        fontSize: 20,
        color: '#0a0a0a',
        fontWeight: 'bold',
    },
    footerContainer: {
        padding: '20px 30px 40px',
        textAlign: 'center',
    },
    txnId: {
        fontSize: 9,
        color: '#000000',
        marginBottom: 10,
        fontWeight: 'bold',
    },
    disclaimer: {
        fontSize: 8,
        color: '#000000',
        fontWeight: 'bold',
    },
});

const ReceiptPDF = ({ feeRecord, userData, instName, instLogo, instAff, fullAddress, stName, stRoll, stClass, stSection, formattedDate }) => {
    const isCounter = feeRecord?.payment_id?.startsWith('COUNTER_');

    // Robust breakdown parsing
    let breakdown = {};
    try {
        if (feeRecord?.breakdown) {
            breakdown = typeof feeRecord.breakdown === 'string'
                ? JSON.parse(feeRecord.breakdown)
                : feeRecord.breakdown;
        }
    } catch (e) {
        console.error('Breakdown parse error:', e);
        breakdown = {};
    }

    // Split address into two logical lines for better length and layout
    const addressParts = (fullAddress || '').split(', ');
    const line1 = addressParts.slice(0, 2).join(', ');
    const line2 = addressParts.slice(2).join(', ');

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.container}>

                    <View style={styles.header}>
                        <View style={styles.headerTop}>
                            {instLogo ? (
                                <Image src={instLogo} style={styles.logo} />
                            ) : null}
                            <View style={styles.nameAffGroup}>
                                <Text style={styles.instName}>{instName}</Text>
                                <Text style={styles.instAff}>{instAff}</Text>
                            </View>
                        </View>
                        <View style={styles.instAddress}>
                            <Text>{line1}</Text>
                            {line2 ? <Text>{line2}</Text> : null}
                        </View>
                    </View>

                    <View style={styles.receiptBody}>
                        <View style={[styles.statusBadge, isCounter && styles.statusBadgeCounter]}>
                            <Text style={[styles.statusText, isCounter && styles.statusTextCounter]}>
                                {isCounter ? 'FEE PAID AT COUNTER' : 'ONLINE FEE PAYMENT SUCCESSFUL'}
                            </Text>
                        </View>

                        <Text style={styles.sectionTitle}>Student Particulars</Text>
                        <View style={styles.grid}>
                            <View style={styles.gridItem}>
                                <Text style={styles.label}>Student Name</Text>
                                <Text style={styles.value}>{stName}</Text>
                            </View>
                            <View style={styles.gridItem}>
                                <Text style={styles.label}>Roll Number</Text>
                                <Text style={styles.value}>{stRoll}</Text>
                            </View>
                            <View style={styles.gridItem}>
                                <Text style={styles.label}>Class - Section</Text>
                                <Text style={styles.value}>{stClass} - {stSection}</Text>
                            </View>
                            <View style={styles.gridItem}>
                                <Text style={styles.label}>Payment Date</Text>
                                <Text style={styles.value}>{formattedDate}</Text>
                            </View>
                            <View style={styles.gridItem}>
                                <Text style={styles.label}>Collected By</Text>
                                <Text style={styles.value}>{feeRecord?.collected_by || (isCounter ? 'Staff' : 'Online System')}</Text>
                            </View>
                        </View>

                        <Text style={styles.sectionTitle}>Fee Breakdown ({feeRecord?.month_year})</Text>
                        <View style={styles.table}>
                            <View style={styles.tableHeaderRow}>
                                <Text style={styles.colLabel}>Description</Text>
                                <Text style={styles.colAmt}>Amount (₹)</Text>
                            </View>
                            {breakdown && Object.entries(breakdown).map(([label, amount]) => (
                                <View style={styles.tableRow} key={label}>
                                    <Text style={styles.rowLabel}>{label}</Text>
                                    <Text style={styles.rowAmt}>{parseFloat(amount).toLocaleString('en-IN')}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.totalSection}>
                            <Text style={styles.totalLabel}>Grand Total</Text>
                            <Text style={styles.totalAmount}>₹{parseFloat(feeRecord?.total_amount || 0).toLocaleString('en-IN')}</Text>
                        </View>
                    </View>

                    <View style={styles.footerContainer}>
                        <Text style={styles.txnId}>TRANSACTION ID: {feeRecord?.payment_id || 'RCV_123_TXN_PRM'}</Text>
                        <Text style={styles.disclaimer}>
                            This is a computer generated receipt and does not require a physical signature.
                        </Text>
                    </View>

                    {/* Watermark moved to end to be on top of backgrounds */}
                    <Text style={styles.watermark}>PAID</Text>
                </View>
            </Page>
        </Document>
    );
};

export default ReceiptPDF;
