import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getFullImageUrl } from '../utils/imageHelper';

const { width } = Dimensions.get('window');
const PORTRAIT_WIDTH = width * 0.85;
const PORTRAIT_HEIGHT = PORTRAIT_WIDTH * 1.58;

const LANDSCAPE_WIDTH = width * 0.90;
const LANDSCAPE_HEIGHT = LANDSCAPE_WIDTH * 0.63; // Approx credit card ratio

interface IDCardPreviewProps {
    student: any;
    institute: any;
    isDark?: boolean;
    template?: 'classic' | 'modern' | 'elegant' | 'professional' | 'landscape';
}

export default function IDCardPreview({ student, institute, isDark, template = 'classic' }: IDCardPreviewProps) {
    if (!student || !institute) return null;

    const isLandscape = template === 'landscape';
    const cardStyle = isLandscape
        ? { width: LANDSCAPE_WIDTH, height: LANDSCAPE_HEIGHT }
        : { width: PORTRAIT_WIDTH, height: PORTRAIT_HEIGHT };

    const renderClassic = () => (
        <View style={[styles.card, styles.classicCard, cardStyle]}>
            <LinearGradient colors={['#1e3c72', '#2a5298']} style={styles.classicHeader}>
                <View style={styles.headerContent}>
                    {institute.logo_url && (
                        <Image source={{ uri: getFullImageUrl(institute.logo_url) || undefined }} style={styles.schoolLogo} resizeMode="contain" />
                    )}
                    <View style={styles.schoolInfo}>
                        <Text style={styles.schoolName} numberOfLines={2}>{institute.name}</Text>
                        <Text style={styles.schoolAddress} numberOfLines={1}>{institute.address}</Text>
                    </View>
                </View>
                <View style={styles.photoContainer}>
                    <Image
                        source={student.photo_url ? { uri: getFullImageUrl(student.photo_url) ?? undefined } : require('../assets/images/react-logo.png')}
                        style={styles.photo}
                    />
                </View>
            </LinearGradient>

            <View style={styles.body}>
                <Text style={styles.studentName}>{student.name}</Text>
                <View style={styles.classBadge}>
                    <Text style={styles.classText}>Class {student.class} - {student.section}</Text>
                </View>
                <View style={styles.infoGrid}>
                    <InfoRow label="Roll No" value={student.roll_no} />
                    <InfoRow label="Mobile" value={student.mobile} />
                    <InfoRow label="Father" value={student.father_name} />
                    <InfoRow label="Email" value={student.email} />
                    <InfoRow label="Address" value={student.address} fullWidth />
                </View>
            </View>
        </View>
    );

    const renderModern = () => (
        <View style={[styles.card, styles.modernCard, cardStyle]}>
            <View style={styles.modernLeftBar} />
            <View style={styles.modernContent}>
                <View style={styles.modernHeader}>
                    {institute.logo_url && (
                        <Image source={{ uri: getFullImageUrl(institute.logo_url) || undefined }} style={styles.modernLogo} />
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.modernSchoolName} numberOfLines={2}>{institute.name}</Text>
                        <Text style={styles.modernAddress} numberOfLines={1}>{institute.address}</Text>
                    </View>
                </View>

                <View style={styles.modernPhotoRow}>
                    <Image
                        source={student.photo_url ? { uri: getFullImageUrl(student.photo_url) ?? undefined } : require('../assets/images/react-logo.png')}
                        style={styles.modernPhoto}
                    />
                    <View style={{ marginLeft: 15, justifyContent: 'center' }}>
                        <Text style={styles.modernStudentName}>{student.name}</Text>
                        <Text style={styles.modernClass}>Class {student.class}-{student.section}</Text>
                    </View>
                </View>

                <View style={styles.modernInfoGrid}>
                    <InfoRow label="Roll No" value={student.roll_no} modern />
                    <InfoRow label="Mobile" value={student.mobile} modern />
                    <InfoRow label="Email" value={student.email} modern fullWidth />
                    <InfoRow label="Father" value={student.father_name} modern />
                    <InfoRow label="Mother" value={student.mother_name} modern />
                    <InfoRow label="Address" value={student.address} modern fullWidth />
                </View>
            </View>
            <View style={styles.modernFooter} />
        </View>
    );

    const renderElegant = () => (
        <View style={[styles.card, styles.elegantCard, cardStyle]}>
            <View style={styles.elegantBorder}>
                <View style={{ alignItems: 'center', marginBottom: 10 }}>
                    {institute.logo_url && (
                        <Image source={{ uri: getFullImageUrl(institute.logo_url) || undefined }} style={styles.elegantLogo} />
                    )}
                    <Text style={styles.elegantSchoolName}>{institute.name}</Text>
                    <Text style={styles.elegantAddress}>{institute.address}</Text>
                    <View style={styles.elegantDivider} />
                </View>

                <View style={{ alignItems: 'center', marginBottom: 15 }}>
                    <Image
                        source={student.photo_url ? { uri: getFullImageUrl(student.photo_url) ?? undefined } : require('../assets/images/react-logo.png')}
                        style={styles.elegantPhoto}
                    />
                    <Text style={styles.elegantStudentName}>{student.name}</Text>
                    <Text style={styles.elegantClass}>Student | Class {student.class}-{student.section}</Text>
                </View>

                <View style={styles.elegantInfo}>
                    <Text style={styles.elegantInfoText}>Roll No: {student.roll_no} | Contact: {student.mobile}</Text>
                    <Text style={styles.elegantInfoText}>{student.email}</Text>
                    <Text style={styles.elegantInfoText} numberOfLines={2}>{student.address}</Text>
                </View>
            </View>
        </View>
    );

    // PROFESSIONAL (Now Light Theme)
    const renderProfessional = () => (
        <View style={[styles.card, styles.proCard, cardStyle]}>
            <View style={styles.proHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    {institute.logo_url && <Image source={{ uri: getFullImageUrl(institute.logo_url) || undefined }} style={styles.proLogo} />}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.proSchoolName}>{institute.name}</Text>
                        <Text style={styles.proAddress}>{institute.address}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.proBody}>
                <Image
                    source={student.photo_url ? { uri: getFullImageUrl(student.photo_url) ?? undefined } : require('../assets/images/react-logo.png')}
                    style={styles.proPhoto}
                />
                <View style={{ marginTop: 45, alignItems: 'center' }}>
                    <Text style={styles.proName}>{student.name}</Text>
                    <Text style={styles.proClass}>CLASS {student.class} - {student.section}</Text>
                </View>

                <View style={styles.proGrid}>
                    <View style={styles.proRow}><Text style={styles.proLabel}>ID NO</Text><Text style={styles.proValue}>{student.roll_no}</Text></View>
                    <View style={styles.proRow}><Text style={styles.proLabel}>PHONE</Text><Text style={styles.proValue}>{student.mobile}</Text></View>
                    <View style={styles.proRow}><Text style={styles.proLabel}>EMAIL</Text><Text style={styles.proValue}>{student.email}</Text></View>
                    <View style={styles.proRow}><Text style={styles.proLabel}>ADDRESS</Text><Text style={styles.proValue}>{student.address}</Text></View>
                </View>
            </View>

            <View style={styles.proFooter} />
        </View>
    );

    const renderLandscape = () => {
        const fullInstituteAddress = [
            institute.address,
            institute.landmark,
            institute.district,
            institute.state,
            institute.pincode
        ].filter(Boolean).join(' ');

        return (
            <View style={[styles.card, styles.landscapeCard, cardStyle]}>
                <LinearGradient colors={['#667eea', '#764ba2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.landHeaderStrip}>
                    {institute.logo_url ? <Image source={{ uri: getFullImageUrl(institute.logo_url) || undefined }} style={styles.landInstLogo} /> : <View style={styles.landInstLogoPlaceholder}><Text style={styles.landInstLogoText}>{institute.name?.charAt(0)}</Text></View>}
                    <Text style={styles.landInstName} numberOfLines={1}>{institute.name}</Text>
                </LinearGradient>
                
                <View style={styles.landSubHeader}>
                    <Text style={styles.landSubHeaderText} numberOfLines={1}>{fullInstituteAddress}</Text>
                </View>

                <View style={styles.landCardBody}>
                    <View style={styles.landLeftCol}>
                        <View style={styles.landNameBox}>
                            <Text style={styles.landFieldLabel}>Student Name</Text>
                            <Text style={styles.landStudentNameVal} numberOfLines={1}>{student.name}</Text>
                        </View>
                        <View style={styles.landStatsRow}>
                            <View style={{ flex: 1 }}><Text style={styles.landFieldLabel}>Class</Text><Text style={styles.landStatVal}>{student.class}</Text></View>
                            <View style={{ flex: 1 }}><Text style={styles.landFieldLabel}>Sec</Text><Text style={styles.landStatVal}>{student.section}</Text></View>
                            <View style={{ flex: 1 }}><Text style={styles.landFieldLabel}>Roll</Text><Text style={styles.landStatVal}>{student.roll_no}</Text></View>
                        </View>
                        <View style={styles.landDetailsGrid}>
                            <View style={styles.landDetailItem}><Text style={styles.landFieldLabel}>Father</Text><Text style={styles.landDetailVal} numberOfLines={1}>{student.father_name}</Text></View>
                            <View style={styles.landDetailItem}><Text style={styles.landFieldLabel}>Mother</Text><Text style={styles.landDetailVal} numberOfLines={1}>{student.mother_name || 'N/A'}</Text></View>
                            <View style={styles.landDetailItem}><Text style={styles.landFieldLabel}>DOB</Text><Text style={styles.landDetailVal}>{student.dob || '-'}</Text></View>
                            <View style={styles.landDetailItem}><Text style={styles.landFieldLabel}>Contact</Text><Text style={styles.landDetailVal}>{student.mobile}</Text></View>
                            <View style={{ width: '100%', marginTop: 4 }}>
                                <Text style={styles.landFieldLabel}>Address</Text>
                                <Text style={styles.landAddrText} numberOfLines={2}>{student.address}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.landRightCol}>
                        <View style={styles.landPhotoBox}>
                            <Image source={student.photo_url ? { uri: getFullImageUrl(student.photo_url) ?? undefined } : require('../assets/images/react-logo.png')} style={styles.landPhotoImg} />
                        </View>
                    </View>
                </View>

                <View style={styles.landFooterStrip}>
                    <Text style={styles.landFooterText}>STUDENT IDENTITY CARD</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.cardContainer}>
            {template === 'classic' && renderClassic()}
            {template === 'modern' && renderModern()}
            {template === 'elegant' && renderElegant()}
            {template === 'professional' && renderProfessional()}
            {template === 'landscape' && renderLandscape()}
        </View>
    );
}

const InfoRow = ({ label, value, fullWidth, modern }: any) => (
    <View style={[
        modern ? styles.modernInfoItem : styles.infoItem,
        fullWidth && { width: '100%', flex: 'none' }
    ]}>
        <Text style={modern ? styles.modernLabel : styles.label}>{label}</Text>
        <Text style={modern ? styles.modernValue : styles.value} numberOfLines={1}>{value || '-'}</Text>
    </View>
);

const styles = StyleSheet.create({
    cardContainer: { alignItems: 'center', justifyContent: 'center' },
    card: {
        borderRadius: 15,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        backgroundColor: '#fff',
    },

    // CLASSIC
    classicCard: { backgroundColor: '#fff' },
    classicHeader: { height: '28%', alignItems: 'center', paddingTop: 10, paddingHorizontal: 15 },
    headerContent: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 10, justifyContent: 'center' },
    schoolLogo: { width: 40, height: 40, backgroundColor: '#fff', borderRadius: 20 },
    schoolInfo: { flex: 1, alignItems: 'center' },
    schoolName: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' },
    schoolAddress: { color: 'rgba(255,255,255,0.85)', fontSize: 10, textAlign: 'center', marginTop: 2 },
    photoContainer: {
        width: 90, height: 90, borderRadius: 45, borderWidth: 4, borderColor: '#fff',
        position: 'absolute', bottom: -45, backgroundColor: '#fff', justifyContent: 'center',
        alignItems: 'center', overflow: 'hidden', left: '50%', marginLeft: -45
    },
    photo: { width: '100%', height: '100%' },
    body: { flex: 1, marginTop: 55, alignItems: 'center', paddingHorizontal: 20 },
    studentName: { fontSize: 20, fontWeight: '800', color: '#333', marginBottom: 5 },
    classBadge: { backgroundColor: '#eef2f5', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 15 },
    classText: { color: '#555', fontWeight: '700', fontSize: 13 },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
    infoItem: { flex: 1, minWidth: '45%', backgroundColor: '#f8f9fa', padding: 8, borderRadius: 8 },
    label: { fontSize: 9, color: '#888', fontWeight: '700', textTransform: 'uppercase', marginBottom: 3 },
    value: { fontSize: 11, color: '#333', fontWeight: '700' },

    // MODERN
    modernCard: { flexDirection: 'row', backgroundColor: '#fff' },
    modernLeftBar: { width: 12, height: '100%', backgroundColor: '#E91E63' },
    modernContent: { flex: 1, padding: 15 },
    modernHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 10 },
    modernLogo: { width: 35, height: 35 },
    modernSchoolName: { fontSize: 14, fontWeight: 'bold', color: '#333', textTransform: 'uppercase' },
    modernAddress: { fontSize: 9, color: '#777', marginTop: 2 },
    modernPhotoRow: { flexDirection: 'row', marginBottom: 15 },
    modernPhoto: { width: 70, height: 70, borderRadius: 10, borderWidth: 1, borderColor: '#ddd' },
    modernStudentName: { fontSize: 18, fontWeight: 'bold', color: '#E91E63' },
    modernClass: { fontSize: 12, color: '#555', fontWeight: '600' },
    modernInfoGrid: { gap: 6, flexDirection: 'row', flexWrap: 'wrap' },
    modernInfoItem: { width: '48%', borderLeftWidth: 3, borderLeftColor: '#E91E63', paddingLeft: 8 },
    modernLabel: { fontSize: 8, color: '#aaa', fontWeight: '600' },
    modernValue: { fontSize: 10, fontWeight: '600', color: '#333' },
    modernFooter: { position: 'absolute', bottom: 0, left: 12, right: 0, height: 8, backgroundColor: '#E91E63' },

    // ELEGANT
    elegantCard: { backgroundColor: '#fffcf5', justifyContent: 'center', alignItems: 'center', padding: 15 },
    elegantBorder: { width: '100%', height: '100%', borderWidth: 1.5, borderColor: '#d4af37', borderRadius: 10, padding: 10, alignItems: 'center' },
    elegantLogo: { width: 35, height: 35, marginBottom: 5 },
    elegantSchoolName: { fontFamily: 'serif', fontSize: 15, fontWeight: 'bold', color: '#333', textAlign: 'center' },
    elegantAddress: { fontSize: 9, color: '#666', textAlign: 'center', marginTop: 2 },
    elegantDivider: { width: 40, height: 2, backgroundColor: '#d4af37', marginTop: 8 },
    elegantPhoto: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#d4af37', marginBottom: 10 },
    elegantStudentName: { fontSize: 18, fontWeight: 'bold', color: '#333', fontFamily: 'serif' },
    elegantClass: { fontSize: 11, color: '#666', fontStyle: 'italic' },
    elegantInfo: { width: '100%', marginTop: 15, alignItems: 'center', gap: 4 },
    elegantInfoText: { fontSize: 10, color: '#444', fontFamily: 'serif' },

    // PROFESSIONAL (LIGHT)
    proCard: { backgroundColor: '#F5F5F7' },
    proHeader: { height: 70, justifyContent: 'center', paddingHorizontal: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
    proLogo: { width: 35, height: 35, borderRadius: 5 },
    proSchoolName: { color: '#333', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase' },
    proAddress: { color: '#666', fontSize: 9, marginTop: 2 },
    proBody: { flex: 1, padding: 15, alignItems: 'center' },
    proPhoto: { width: 90, height: 90, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', position: 'absolute', top: -30, backgroundColor: '#fff' },
    proName: { color: '#333', fontSize: 18, fontWeight: '800', textTransform: 'uppercase', marginTop: 55 },
    proClass: { color: '#555', fontSize: 11, fontWeight: '600', marginTop: 2 },
    proGrid: { width: '100%', marginTop: 20, gap: 8 },
    proRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', paddingBottom: 4 },
    proLabel: { color: '#888', fontSize: 9, fontWeight: '700' },
    proValue: { color: '#333', fontSize: 10, fontWeight: '600' },
    proFooter: { height: 10, backgroundColor: '#333', width: '100%', position: 'absolute', bottom: 0 },

    // LANDSCAPE
    landscapeCard: { backgroundColor: '#fff', flexDirection: 'column' },
    landHeaderStrip: { paddingVertical: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    landInstLogo: { width: 22, height: 22, resizeMode: 'contain' },
    landInstLogoPlaceholder: { width: 22, height: 22, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
    landInstLogoText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    landInstName: { color: '#fff', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
    
    landSubHeader: { backgroundColor: '#fff', paddingVertical: 4, paddingHorizontal: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    landSubHeaderText: { color: '#000', fontSize: 6, fontWeight: '800', letterSpacing: 0.1 },
    
    landCardBody: { flex: 1, padding: 10, flexDirection: 'row', gap: 12 },
    landLeftCol: { flex: 1 },
    landNameBox: { marginBottom: 4 },
    landFieldLabel: { fontSize: 6, color: '#000', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.2, marginBottom: 1 },
    landStudentNameVal: { fontSize: 11, color: '#000', fontWeight: '900', textTransform: 'uppercase' },
    
    landStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    landStatVal: { fontSize: 9, fontWeight: '900', color: '#000' },
    
    landDetailsGrid: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    landDetailItem: { width: '48%' },
    landDetailVal: { fontSize: 8, color: '#000', fontWeight: '900' },
    
    landRightCol: { width: 80, alignItems: 'center' },
    landPhotoBox: { width: 75, height: 75, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', backgroundColor: '#fff' },
    landPhotoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    landAddrText: { fontSize: 6.5, fontWeight: '900', color: '#000', lineHeight: 8 },
    
    landFooterStrip: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 4, alignItems: 'center' },
    landFooterText: { color: '#000', fontSize: 8, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' }
});
