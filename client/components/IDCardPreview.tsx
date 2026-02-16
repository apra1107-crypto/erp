import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
                        <Image source={{ uri: institute.logo_url }} style={styles.schoolLogo} resizeMode="contain" />
                    )}
                    <View style={styles.schoolInfo}>
                        <Text style={styles.schoolName} numberOfLines={2}>{institute.name}</Text>
                        <Text style={styles.schoolAddress} numberOfLines={1}>{institute.address}</Text>
                    </View>
                </View>
                <View style={styles.photoContainer}>
                    <Image
                        source={student.photo_url ? { uri: student.photo_url } : require('../assets/images/react-logo.png')}
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
                        <Image source={{ uri: institute.logo_url }} style={styles.modernLogo} />
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.modernSchoolName} numberOfLines={2}>{institute.name}</Text>
                        <Text style={styles.modernAddress} numberOfLines={1}>{institute.address}</Text>
                    </View>
                </View>

                <View style={styles.modernPhotoRow}>
                    <Image
                        source={student.photo_url ? { uri: student.photo_url } : require('../assets/images/react-logo.png')}
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
                        <Image source={{ uri: institute.logo_url }} style={styles.elegantLogo} />
                    )}
                    <Text style={styles.elegantSchoolName}>{institute.name}</Text>
                    <Text style={styles.elegantAddress}>{institute.address}</Text>
                    <View style={styles.elegantDivider} />
                </View>

                <View style={{ alignItems: 'center', marginBottom: 15 }}>
                    <Image
                        source={student.photo_url ? { uri: student.photo_url } : require('../assets/images/react-logo.png')}
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
                    {institute.logo_url && <Image source={{ uri: institute.logo_url }} style={styles.proLogo} />}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.proSchoolName}>{institute.name}</Text>
                        <Text style={styles.proAddress}>{institute.address}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.proBody}>
                <Image
                    source={student.photo_url ? { uri: student.photo_url } : require('../assets/images/react-logo.png')}
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

    const renderLandscape = () => (
        <View style={[styles.card, styles.landscapeCard, cardStyle]}>
            {/* Left Side: Photo & Basic Info */}
            <View style={styles.landLeft}>
                <Image
                    source={student.photo_url ? { uri: student.photo_url } : require('../assets/images/react-logo.png')}
                    style={styles.landPhoto}
                />
                <Text style={styles.landStudentName}>{student.name}</Text>
                <Text style={styles.landClass}>Class {student.class}-{student.section}</Text>
                <Text style={styles.landRoll}>Roll: {student.roll_no}</Text>
            </View>

            {/* Right Side: Header & Details */}
            <View style={styles.landRight}>
                <View style={styles.landHeader}>
                    {institute.logo_url && <Image source={{ uri: institute.logo_url }} style={styles.landLogo} />}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.landSchoolName} numberOfLines={2}>{institute.name}</Text>
                        <Text style={styles.landAddress} numberOfLines={1}>{institute.address}</Text>
                    </View>
                </View>

                <View style={styles.landDivider} />

                <View style={styles.landGrid}>
                    <View style={styles.landRow}><Text style={styles.landLabel}>Father:</Text><Text style={styles.landValue} numberOfLines={1}>{student.father_name}</Text></View>
                    <View style={styles.landRow}><Text style={styles.landLabel}>Contact:</Text><Text style={styles.landValue}>{student.mobile}</Text></View>
                    <View style={styles.landRow}><Text style={styles.landLabel}>Email:</Text><Text style={styles.landValue} numberOfLines={1}>{student.email}</Text></View>
                    <View style={styles.landRow}><Text style={styles.landLabel}>Address:</Text><Text style={styles.landValue} numberOfLines={1}>{student.address}</Text></View>
                </View>

                <View style={styles.landFooter}>
                    <Text style={styles.landFooterText}>Identity Card</Text>
                </View>
            </View>
        </View>
    );

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
    cardContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
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
    landscapeCard: { flexDirection: 'row', backgroundColor: '#fff' },
    landLeft: { width: '35%', backgroundColor: '#f0f4f8', alignItems: 'center', justifyContent: 'center', padding: 10 },
    landPhoto: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#fff', marginBottom: 10 },
    landStudentName: { fontSize: 14, fontWeight: 'bold', color: '#333', textAlign: 'center' },
    landClass: { fontSize: 10, color: '#666', fontWeight: '600' },
    landRoll: { fontSize: 9, color: '#888', marginTop: 2 },

    landRight: { flex: 1, padding: 15, position: 'relative' },
    landHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
    landLogo: { width: 30, height: 30 },
    landSchoolName: { fontSize: 14, fontWeight: 'bold', color: '#1e3c72', textTransform: 'uppercase' },
    landAddress: { fontSize: 8, color: '#666', marginTop: 1 },
    landDivider: { height: 1, backgroundColor: '#eee', width: '100%', marginVertical: 8 },
    landGrid: { gap: 4 },
    landRow: { flexDirection: 'row', gap: 5 },
    landLabel: { fontSize: 9, fontWeight: 'bold', color: '#888', width: 45 },
    landValue: { fontSize: 9, color: '#333', flex: 1, fontWeight: '600' },
    landFooter: { position: 'absolute', bottom: 10, right: 15 },
    landFooterText: { fontSize: 8, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase' }
});
