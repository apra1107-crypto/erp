import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFullImageUrl } from '../utils/imageHelper';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface Student {
    id: string | number;
    name: string;
    roll_no: string;
    class: string | number;
    section: string;
    father_name: string;
    mobile: string;
    photo_url?: string;
    dob?: string;
}

interface AdmitCardEvent {
    id: string | number;
    exam_name: string;
    schedule: Array<{
        date: string;
        day: string;
        subject: string;
        time: string;
    }>;
}

interface InstituteProfile {
    institute_name: string;
    affiliation?: string;
    address?: string;
    institute_address?: string;
    landmark?: string;
    district?: string;
    state?: string;
    pincode?: string;
    logo_url?: string;
    institute_logo?: string;
}

interface AdmitCardPreviewProps {
    student: Student | null;
    event: AdmitCardEvent | null;
    institute: InstituteProfile | null;
}

const AdmitCardPreview: React.FC<AdmitCardPreviewProps> = ({ student, event, institute }) => {
    const { isDark } = useTheme();

    if (!student || !event) return null;

    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    return (
        <View style={styles.admitCardPaper}>
            {/* Professional Header Section */}
            <View style={styles.paperHeader}>
                <View style={styles.headerContainer}>
                    {(institute?.logo_url || institute?.institute_logo) ? (
                        <Image 
                            source={{ uri: getFullImageUrl(institute?.logo_url || institute?.institute_logo) || '' }} 
                            style={styles.logo} 
                        />
                    ) : (
                        <View style={styles.logoPlaceholder}>
                            <Ionicons name="school" size={40} color="#000" />
                        </View>
                    )}
                    <View style={styles.instituteInfo}>
                        <Text style={styles.instituteName} numberOfLines={1} adjustsFontSizeToFit>
                            {(institute?.institute_name || 'INSTITUTE NAME').toUpperCase()}
                        </Text>
                        {institute?.affiliation && (
                            <Text style={styles.affiliationText} numberOfLines={1} adjustsFontSizeToFit>{institute.affiliation}</Text>
                        )}
                        <Text style={styles.addressText} numberOfLines={2} adjustsFontSizeToFit>
                            {[
                                institute?.address || institute?.institute_address,
                                institute?.landmark,
                                institute?.district,
                                institute?.state,
                                institute?.pincode
                            ].filter(Boolean).join(', ')}
                        </Text>
                    </View>
                </View>

                <View style={styles.headerDivider} />
                
                <Text style={styles.paperExamTitle}>{event?.exam_name}</Text>
            </View>

            {/* Student Info Section */}
            <View style={styles.paperInfoRow}>
                <View style={styles.paperTable}>
                    <View style={styles.paperTableRow}>
                        <Text style={styles.paperLabel}>STUDENT NAME</Text>
                        <Text style={styles.paperValue}>{student?.name}</Text>
                    </View>
                    <View style={styles.paperTableRow}>
                        <Text style={styles.paperLabel}>CLASS & SECTION</Text>
                        <Text style={styles.paperValue}>{student?.class} - {student?.section}</Text>
                    </View>
                    <View style={styles.paperTableRow}>
                        <Text style={styles.paperLabel}>ROLL NUMBER</Text>
                        <Text style={styles.paperValue}>{student?.roll_no || 'TBD'}</Text>
                    </View>
                    <View style={styles.paperTableRow}>
                        <Text style={styles.paperLabel}>FATHER'S NAME</Text>
                        <Text style={styles.paperValue}>{student?.father_name}</Text>
                    </View>
                    <View style={styles.paperTableRow}>
                        <Text style={styles.paperLabel}>MOBILE NO.</Text>
                        <Text style={styles.paperValue}>{student?.mobile}</Text>
                    </View>
                </View>
                <View style={styles.paperPhoto}>
                    {student?.photo_url && getFullImageUrl(student.photo_url) ? (
                        <Image source={{ uri: getFullImageUrl(student.photo_url) as string }} style={styles.fullImage} />
                    ) : (
                        <Text style={styles.photoPlaceholderText}>AFFIX PHOTO</Text>
                    )}
                </View>
            </View>

            {/* Timetable */}
            <View style={styles.paperTimetable}>
                <Text style={styles.paperTableTitle}>EXAMINATION TIMETABLE</Text>
                <View style={styles.paperGrid}>
                    <View style={styles.paperGridHeader}>
                        <View style={styles.paperGridCell}><Text style={styles.paperGridText}>DATE & DAY</Text></View>
                        <View style={styles.paperGridCell}><Text style={styles.paperGridText}>SUBJECT</Text></View>
                        <View style={styles.paperGridCell}><Text style={styles.paperGridText}>TIME / SHIFT</Text></View>
                    </View>
                    {event?.schedule.map((row, idx) => (
                        <View key={idx} style={styles.paperGridRow}>
                            <View style={styles.paperGridCell}>
                                <Text style={styles.paperGridText}>
                                    {`${String(formatDate(row.date)).trim()} (${String(row.day).trim()})`}
                                </Text>
                            </View>
                            <View style={styles.paperGridCell}><Text style={styles.paperGridText}>{row.subject}</Text></View>
                            <View style={styles.paperGridCell}><Text style={styles.paperGridText}>{row.time}</Text></View>
                        </View>
                    ))}
                </View>
            </View>

            {/* Instructions */}
            <View style={styles.paperInstructions}>
                <Text style={styles.paperInstTitle}>IMPORTANT INSTRUCTIONS:</Text>
                <Text style={styles.paperInstItem}>1. Candidate must carry this Admit Card to the examination hall for all papers.</Text>
                <Text style={styles.paperInstItem}>2. Possession of mobile phones, electronic gadgets, or calculators is strictly prohibited.</Text>
                <Text style={styles.paperInstItem}>3. Candidates must report at the examination center at least 20 minutes before time.</Text>
                <Text style={styles.paperInstItem}>4. Ensure invigilator signature on this card during every examination session.</Text>
            </View>

            {/* Footer Signatures */}
            <View style={styles.paperFooter}>
                <View style={styles.paperSigLine}>
                    <Text style={styles.paperSigText}>TEACHER'S SIGNATURE</Text>
                </View>
                <View style={styles.paperSigLine}>
                    <Text style={styles.paperSigText}>PRINCIPAL'S SIGNATURE</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    admitCardPaper: {
        width: width - 40,
        backgroundColor: '#fff',
        padding: 20,
        borderWidth: 2,
        borderColor: '#000',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
    },
    paperHeader: { alignItems: 'center', marginBottom: 5 },
    headerContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        marginBottom: 5, 
        gap: 20,
        width: '100%'
    },
    logo: { 
        width: 60, 
        height: 60, 
        resizeMode: 'contain',
    },
    logoPlaceholder: { 
        width: 60, 
        height: 60, 
        backgroundColor: '#f0f0f0', 
        borderRadius: 30, 
        justifyContent: 'center', 
        alignItems: 'center', 
        borderWidth: 1.5, 
        borderColor: '#000' 
    },
    instituteInfo: { 
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    instituteName: { 
        fontSize: 36, 
        fontWeight: '900', 
        color: '#1A237E', 
        textAlign: 'center',
        textTransform: 'uppercase', 
        letterSpacing: 1,
    },
    affiliationText: { 
        fontSize: 30, 
        color: '#000000', 
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 4,
        marginLeft: 2
    },
    addressText: { 
        fontSize: 9, 
        color: '#000000', 
        fontWeight: '600', 
        textAlign: 'center',
        marginTop: 4,
        marginLeft: 2,
    },
    headerDivider: { 
        width: '100%', 
        height: 2, 
        backgroundColor: '#000', 
        marginVertical: 15 
    },
    paperExamTitle: { 
        fontSize: 22, 
        fontWeight: '900', 
        color: '#000', 
        borderWidth: 2.5, 
        borderColor: '#000', 
        paddingHorizontal: 45, 
        paddingVertical: 8, 
        textTransform: 'uppercase', 
        textAlign: 'center',
        alignSelf: 'center'
    },
    paperInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    paperTable: { flex: 1, marginRight: 15 },
    paperTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 5 },
    paperLabel: { width: 100, fontSize: 10, fontWeight: 'bold', color: '#555', textTransform: 'uppercase' },
    paperValue: { flex: 1, fontSize: 12, fontWeight: '900', color: '#000' },
    paperPhoto: { width: 105, height: 130, borderWidth: 2, borderColor: '#000', backgroundColor: '#f9f9f9', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    photoPlaceholderText: { fontSize: 8, textAlign: 'center', color: '#999', fontWeight: 'bold' },
    paperTimetable: { marginBottom: 20 },
    paperTableTitle: { fontSize: 12, fontWeight: '900', textDecorationLine: 'underline', marginBottom: 10, color: '#000' },
    paperGrid: { borderWidth: 2, borderColor: '#000' },
    paperGridHeader: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderBottomWidth: 2, borderBottomColor: '#000' },
    paperGridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000' },
    paperGridCell: { padding: 8, borderRightWidth: 1, borderRightColor: '#000', flex: 1 },
    paperGridText: { fontSize: 10, fontWeight: 'bold', color: '#000' },
    paperInstructions: { borderWidth: 1.5, borderColor: '#000', padding: 10, borderRadius: 4, backgroundColor: '#fdfdfd' },
    paperInstTitle: { fontSize: 10, fontWeight: '900', textDecorationLine: 'underline', marginBottom: 6 },
    paperInstItem: { fontSize: 9, fontWeight: '700', color: '#333', marginBottom: 3, lineHeight: 12 },
    paperFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 50, paddingHorizontal: 10 },
    paperSigLine: { borderTopWidth: 1.5, borderTopColor: '#000', width: 120, alignItems: 'center', paddingTop: 6 },
    paperSigText: { fontSize: 9, fontWeight: '900' },
});

export default AdmitCardPreview;
