import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        backgroundColor: '#ffffff',
        fontFamily: 'Helvetica',
    },
    watermark: {
        position: 'absolute',
        top: '35%',
        left: '10%',
        width: '80%',
        textAlign: 'center',
        fontSize: 120,
        fontFamily: 'Helvetica-Bold',
        color: '#10b981',
        opacity: 0.06,
        transform: 'rotate(-30deg)',
        borderWidth: 10,
        borderColor: '#10b981',
        padding: 20,
        borderRadius: 20,
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderBottom: 2,
        borderBottomColor: '#1a1a1a',
        paddingBottom: 15,
        marginBottom: 20,
    },
    headerMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 4,
    },
    logo: {
        width: 50,
        height: 50,
        objectFit: 'contain',
    },
    instName: {
        fontSize: 22,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        color: '#1a1a1a',
    },
    instAff: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    instAddress: {
        fontSize: 8,
        color: '#475569',
        textAlign: 'center',
        marginTop: 6,
        maxWidth: '80%',
    },
    titleRow: {
        marginBottom: 25,
    },
    title: {
        fontSize: 16,
        fontFamily: 'Helvetica-Bold',
        letterSpacing: 2,
        color: '#1a1a1a',
        borderLeft: 5,
        borderLeftColor: '#6366f1',
        paddingLeft: 10,
    },
    detailsContainer: {
        flexDirection: 'column',
        gap: 15,
        marginBottom: 25,
    },
    detailSection: {
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 10,
    },
    sectionLabel: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        color: '#64748b',
        marginBottom: 8,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    detailsFlexRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
    },
    detailText: {
        fontSize: 10,
        color: '#475569',
    },
    bold: {
        color: '#1a1a1a',
        fontFamily: 'Helvetica-Bold',
    },
    table: {
        width: '100%',
        marginBottom: 30,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        padding: 10,
    },
    tableHeaderText: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        color: '#475569',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        padding: 12,
    },
    tableCell: {
        fontSize: 10,
        color: '#1a1a1a',
    },
    colDesc: { flex: 2 },
    colAmt: { flex: 1, textAlign: 'right' },
    tableFooter: {
        flexDirection: 'row',
        backgroundColor: '#2563eb',
        padding: 12,
        color: '#ffffff',
    },
    footerLabel: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        flex: 1,
    },
    footerValue: {
        fontSize: 12,
        fontFamily: 'Helvetica-Bold',
        flex: 1,
        textAlign: 'right',
    },
    historySection: {
        marginTop: 20,
        backgroundColor: '#fafafa',
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#eeeeee',
    },
    historyLabel: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        color: '#1e293b',
        marginBottom: 10,
        letterSpacing: 1,
        borderBottomWidth: 2,
        borderBottomColor: '#6366f1',
        width: 150,
        paddingBottom: 4,
    },
    historyTable: {
        width: '100%',
    },
    historyHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        paddingBottom: 5,
        marginBottom: 5,
    },
    historyHeaderText: {
        fontSize: 7,
        fontFamily: 'Helvetica-Bold',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    historyRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingVertical: 8,
    },
    historyCell: {
        fontSize: 9,
        color: '#1a1a1a',
    },
    hColDate: { flex: 1.5 },
    hColTime: { flex: 1 },
    hColMethod: { flex: 1 },
    hColAmt: { flex: 1, textAlign: 'right' },
    hTotalRow: {
        flexDirection: 'row',
        marginTop: 5,
        paddingTop: 5,
    },
    hTotalText: {
        fontSize: 9,
        fontFamily: 'Helvetica-Bold',
        color: '#1a1a1a',
    },
    footerNoteArea: {
        marginTop: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    paymentMeta: {
        fontSize: 9,
        color: '#475569',
    },
    footerNote: {
        textAlign: 'right',
        flex: 1,
    },
    computerGen: {
        fontSize: 8,
        color: '#94a3b8',
        marginBottom: 5,
    },
    thankYou: {
        fontSize: 11,
        fontFamily: 'Helvetica-BoldOblique',
        color: '#1a1a1a',
    },
    tDateStack: {
        flexDirection: 'column',
    },
    tDay: {
        fontSize: 7,
        color: '#64748b',
    }
});

const FeeReceiptPDF = ({ data }) => {
    if (!data) return null;
    const { institute, student, payment, breakage, type, months } = data;

    const paidDate = payment?.paid_at ? new Date(payment.paid_at) : new Date();
    const dayName = paidDate.toLocaleDateString('en-IN', { weekday: 'long' });
    const formattedDate = paidDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const formattedTime = paidDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const safeBreakage = Array.isArray(breakage) ? breakage : [];
    const safeTransactions = Array.isArray(payment?.transactions) ? payment.transactions : [];

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <Text style={styles.watermark}>PAID</Text>

                <View style={styles.header}>
                    <View style={styles.headerMainRow}>
                        {institute?.logo_url && <Image src={institute.logo_url} style={styles.logo} />}
                        <Text style={styles.instName}>{institute?.institute_name || 'Institute'}</Text>
                    </View>
                    {institute?.affiliation && <Text style={styles.instAff}>{institute.affiliation}</Text>}
                    <View style={styles.instAddress}>
                        <Text>{institute?.address || ''}{institute?.landmark ? `, ${institute.landmark}` : ''}, {institute?.district || ''}, {institute?.state || ''} - {institute?.pincode || ''}</Text>
                    </View>
                </View>

                <View style={styles.titleRow}>
                    <Text style={styles.title}>FEE RECEIPT</Text>
                </View>

                <View style={styles.detailsContainer}>
                    {type === 'MONTHLY' && (
                        <View style={styles.detailSection}>
                            <Text style={styles.sectionLabel}>PAYMENT DETAILS</Text>
                            <View style={styles.detailsFlexRow}>
                                <Text style={styles.detailText}>Billing Month: <Text style={styles.bold}>{months && months[(payment?.month || 1) - 1]} {payment?.year}</Text></Text>
                                <Text style={styles.detailText}>Payment Date: <Text style={styles.bold}>{formattedDate}</Text></Text>
                                <Text style={styles.detailText}>Day: <Text style={styles.bold}>{dayName}</Text></Text>
                                <Text style={styles.detailText}>Time: <Text style={styles.bold}>{formattedTime}</Text></Text>
                                <Text style={styles.detailText}>Collected By: <Text style={styles.bold}>{payment?.collected_by || 'Staff'}</Text></Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.detailSection}>
                        <Text style={styles.sectionLabel}>STUDENT DETAILS</Text>
                        <View style={styles.detailsFlexRow}>
                            <Text style={styles.detailText}>Name: <Text style={styles.bold}>{student?.name}</Text></Text>
                            <Text style={styles.detailText}>Class: <Text style={styles.bold}>{student?.class}-{student?.section}</Text></Text>
                            <Text style={styles.detailText}>Roll No: <Text style={styles.bold}>{student?.roll_no}</Text></Text>
                        </View>
                    </View>
                </View>

                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, styles.colDesc]}>Description</Text>
                        <Text style={[styles.tableHeaderText, styles.colAmt]}>Amount</Text>
                    </View>
                    {safeBreakage.map((item, i) => (
                        <View key={i} style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.colDesc]}>{item.reason || item.label}</Text>
                            <Text style={[styles.tableCell, styles.colAmt]}>₹{parseFloat(item.amount || 0).toLocaleString()}</Text>
                        </View>
                    ))}
                    <View style={styles.tableFooter}>
                        <Text style={styles.footerLabel}>TOTAL PAYABLE</Text>
                        <Text style={styles.footerValue}>₹{safeBreakage.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0).toLocaleString()}</Text>
                    </View>
                </View>

                {type === 'ONE-TIME' && safeTransactions.length > 0 && (
                    <View style={styles.historySection}>
                        <Text style={styles.historyLabel}>PAYMENT BREAKDOWN (TRANSACTIONS)</Text>
                        <View style={styles.historyTable}>
                            <View style={styles.historyHeader}>
                                <Text style={[styles.historyHeaderText, styles.hColDate]}>Date & Day</Text>
                                <Text style={[styles.historyHeaderText, styles.hColTime]}>Time</Text>
                                <Text style={[styles.historyHeaderText, styles.hColMethod]}>Method</Text>
                                <Text style={[styles.historyHeaderText, styles.hColAmt]}>Amount</Text>
                            </View>
                            {safeTransactions.map((t, idx) => {
                                const tDate = new Date(t.created_at);
                                return (
                                    <View key={idx} style={styles.historyRow}>
                                        <View style={[styles.tDateStack, styles.hColDate]}>
                                            <Text style={styles.historyCell}>{tDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                                            <Text style={styles.tDay}>{tDate.toLocaleDateString('en-IN', { weekday: 'long' })}</Text>
                                        </View>
                                        <Text style={[styles.historyCell, styles.hColTime]}>{tDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</Text>
                                        <Text style={[styles.historyCell, styles.hColMethod]}>{t.payment_method}</Text>
                                        <Text style={[styles.historyCell, styles.hColAmt]}>₹{parseFloat(t.amount || 0).toLocaleString()}</Text>
                                    </View>
                                );
                            })}
                            <View style={styles.hTotalRow}>
                                <View style={{ flex: 3.5 }}></View>
                                <Text style={[styles.hTotalText, styles.hColAmt]}>₹{safeTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0).toLocaleString()}</Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={styles.footerNoteArea}>
                    {type === 'MONTHLY' ? (
                        <View style={{ flex: 1 }}>
                            <Text style={styles.paymentMeta}>Payment Method: <Text style={styles.bold}>{payment?.payment_method === 'Cash' ? 'Cash' : `Online (${payment?.payment_method})`}</Text></Text>
                            {payment?.transaction_id && <Text style={styles.paymentMeta}>Transaction ID: <Text style={styles.bold}>{payment.transaction_id}</Text></Text>}
                        </View>
                    ) : (
                        <View style={{ flex: 1 }}></View>
                    )}
                    <View style={styles.footerNote}>
                        <Text style={styles.computerGen}>This is a computer-generated receipt.</Text>
                        <Text style={styles.thankYou}>Thank you for your payment!</Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
};

export default FeeReceiptPDF;