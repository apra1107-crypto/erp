import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, StatusBar, Platform, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS, BASE_URL } from '../../../constants/Config';
import { getFullImageUrl } from '../../../utils/imageHelper';

const { width } = Dimensions.get('window');

export default function StudentReportCardPreview() {
    const { examId } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();
    
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    useEffect(() => { fetchMarksheet(); }, [examId]);

    const generatePDF = async () => {
        try {
            setIsGeneratingPDF(true);
            const token = await AsyncStorage.getItem('studentToken');
            
            // Call the professional server-side engine
            const response = await axios.post(
                `${API_ENDPOINTS.EXAM}/${examId}/generate-student-pdf`,
                {}, 
                {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'arraybuffer',
                    timeout: 60000 
                }
            );

            // Convert to Base64 safely
            // @ts-ignore
            const base64data = btoa(
                new Uint8Array(response.data)
                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
            );

            const fileName = `marksheet_${examId}_${Date.now()}.pdf`;
            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

            await FileSystem.writeAsStringAsync(fileUri, base64data, {
                encoding: 'base64',
            });

            await Sharing.shareAsync(fileUri, {
                UTI: '.pdf',
                mimeType: 'application/pdf',
                dialogTitle: 'My Official Report Card'
            });

        } catch (error: any) {
            console.error('Student PDF Download Error:', error.message);
            Alert.alert('Error', 'Failed to generate professional report card. Please try again.');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const fetchMarksheet = async () => {
        try {
            const token = await AsyncStorage.getItem('studentToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const studentDataStr = await AsyncStorage.getItem('studentData');
            if (!studentDataStr) return;
            const student = JSON.parse(studentDataStr);
            const sessionId = storedSessionId || student.current_session_id;

            const response = await axios.get(`${API_ENDPOINTS.EXAM}/${examId}/marksheet/${student.id}`, { 
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                } 
            });
            setData(response.data);
        } catch (error) { 
            Alert.alert('Error', 'Failed to load marksheet data'); 
        } finally { 
            setLoading(false); 
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: isDark ? '#000' : '#f0f2f5' },
        backBtn: {
            width: 45, height: 45, borderRadius: 22.5, backgroundColor: theme.card,
            justifyContent: 'center', alignItems: 'center', elevation: 4,
        },
        scroll: { flex: 1 },
        content: { padding: 10, paddingTop: insets.top + 80, alignItems: 'center' },
        paper: {
            width: width - 20, backgroundColor: '#fff', padding: 15, paddingTop: 25,
            borderWidth: 2.5, borderColor: '#000', borderRadius: 2, elevation: 15, position: 'relative',
        },
        paperInnerBorder: {
            position: 'absolute', top: 4, left: 4, right: 4, bottom: 4,
            borderWidth: 0.8, borderColor: '#333', zIndex: 0
        },
        header: { alignItems: 'center', marginBottom: 20, zIndex: 10 },
        instRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 5 },
        logo: { width: 60, height: 60, resizeMode: 'contain' },
        instName: { fontSize: 26, fontWeight: '900', color: '#1e1b4b', textAlign: 'center', textTransform: 'uppercase', flexShrink: 1, lineHeight: 28 },
        instAffiliation: { fontSize: 14, color: '#4f46e5', fontWeight: '700', marginTop: -8, marginBottom: 2 },
        instSub: { fontSize: 10.5, color: '#444', textAlign: 'center', fontWeight: '700' },
        examTitleContainer: { 
            marginTop: 15, paddingVertical: 6, paddingHorizontal: 35, 
            backgroundColor: '#1e1b4b', borderRadius: 4, transform: [{ skewX: '-10deg' }]
        },
        examTitle: { fontSize: 15, fontWeight: '900', color: '#fff', textAlign: 'center', textTransform: 'uppercase' },
        studentSection: { 
            flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, 
            padding: 12, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0'
        },
        infoGrid: { flex: 1, marginRight: 10 },
        infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', paddingVertical: 5 },
        infoLabel: { width: 90, fontSize: 9, fontWeight: '800', color: '#64748b' },
        infoValue: { flex: 1, fontSize: 12, fontWeight: '900', color: '#0f172a' },
        photoBox: { 
            width: 85, height: 105, borderWidth: 3, borderColor: '#fff', 
            backgroundColor: '#fff', elevation: 5, justifyContent: 'center', alignItems: 'center', borderRadius: 4
        },
        photo: { width: '100%', height: '100%' },
        table: { marginBottom: 20, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#1e1b4b' },
        tableHeader: { flexDirection: 'row', backgroundColor: '#1e1b4b', paddingVertical: 10 },
        tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 10 },
        cell: { paddingHorizontal: 6, justifyContent: 'center' },
        cellText: { fontSize: 10, fontWeight: '800', color: '#000', textAlign: 'center' },
        headerCellText: { fontSize: 10, fontWeight: '900', color: '#fff', textAlign: 'center' },
        summaryBox: { 
            flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1e1b4b', 
            padding: 15, borderRadius: 12, marginBottom: 15, elevation: 5
        },
        summaryItem: { alignItems: 'center' },
        summaryLabel: { fontSize: 9, fontWeight: '800', color: '#94a3b8', marginBottom: 2 },
        summaryValue: { fontSize: 18, fontWeight: '900', color: '#fff' },
        medalRow: { flexDirection: 'row', gap: 10, marginTop: 5, marginBottom: 15 },
        medal: { 
            flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f3ff', 
            borderWidth: 1.5, borderColor: '#4f46e5', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, gap: 10 
        },
        medalText: { fontSize: 10, fontWeight: '900', color: '#1e1b4b' },
        remarks: { padding: 12, backgroundColor: '#fffbeb', borderRadius: 10, borderLeftWidth: 5, borderLeftColor: '#f59e0b', marginBottom: 20 },
        remarkTitle: { fontSize: 10, fontWeight: '900', color: '#92400e', marginBottom: 3 },
        remarkText: { fontSize: 11, fontStyle: 'italic', color: '#451a03', fontWeight: '600' },
        signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, paddingHorizontal: 5 },
        sigLine: { borderTopWidth: 2, borderTopColor: '#1e1b4b', width: 85, alignItems: 'center', paddingTop: 8 },
        sigText: { fontSize: 9, fontWeight: '900', color: '#1e1b4b' },
    }), [theme, insets, isDark]);

    if (loading) return <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center' }}><ActivityIndicator size="large" color={theme.primary} /></View>;
    if (!data) return null;

    const { exam, student, institute, result, attendance } = data;
    const marks = result?.marks_data || [];
    const stats = result?.calculated_stats || {};
    const manualStats = exam?.manual_stats || {};
    const isJunior = exam.evaluation_mode === 'junior';

    const totalMax = (exam.subjects_blueprint || []).reduce((sum: number, sub: any) => sum + (parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0), 0);

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            
            <View style={{ position: 'absolute', top: insets.top + 15, left: 20, right: 20, zIndex: 100, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={generatePDF} 
                    style={[styles.backBtn, { backgroundColor: theme.primary }]}
                    disabled={isGeneratingPDF}
                >
                    {isGeneratingPDF ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={24} color="#fff" />}
                </TouchableOpacity>
            </View>

            {isGeneratingPDF && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <ActivityIndicator size="large" color={theme.primary} />
                    <Text style={{ color: '#fff', marginTop: 15, fontWeight: '900' }}>Generating Professional PDF...</Text>
                </View>
            )}

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <View style={styles.paper}>
                        <View style={styles.paperInnerBorder} />
                        
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.instRow}>
                                {institute.logo_url && <Image source={{ uri: institute.logo_url }} style={styles.logo} />}
                                <Text style={styles.instName}>{institute.institute_name}</Text>
                            </View>
                            {institute.affiliation && <Text style={styles.instAffiliation}>{institute.affiliation}</Text>}
                            <Text style={styles.instSub}>
                                {institute.address} {institute.landmark} {institute.district} {institute.state} {institute.pincode}
                            </Text>
                            
                            <View style={styles.examTitleContainer}>
                                <Text style={styles.examTitle}>{exam.name}</Text>
                            </View>
                        </View>

                        {/* Student Details */}
                        <View style={styles.studentSection}>
                            <View style={styles.infoGrid}>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>STUDENT NAME</Text><Text style={styles.infoValue}>{student.name}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>CLASS & SECTION</Text><Text style={styles.infoValue}>{student.class} - {student.section}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>ROLL NUMBER</Text><Text style={styles.infoValue}>{student.roll_no}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>FATHER'S NAME</Text><Text style={styles.infoValue}>{student.father_name}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>MOTHER'S NAME</Text><Text style={styles.infoValue}>{student.mother_name || '-'}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>DATE OF BIRTH</Text><Text style={styles.infoValue}>{student.dob ? new Date(student.dob).toLocaleDateString('en-IN') : '-'}</Text></View>
                            </View>
                            <View style={styles.photoBox}>
                                {(student.photo_url || student.profile_image) ? (
                                    <Image source={{ uri: getFullImageUrl(student.photo_url) ?? undefined }} style={styles.photo} />
                                ) : (
                                    <Ionicons name="person" size={40} color="#e2e8f0" />
                                )}
                            </View>
                        </View>

                        {/* Marks/Assessment Table */}
                        <View style={styles.table}>
                            <View style={styles.tableHeader}>
                                <View style={[styles.cell, { flex: isJunior ? 3 : 2.5, alignItems: 'flex-start' }]}><Text style={styles.headerCellText}>{isJunior ? 'ASSESSMENT INDICATOR' : 'SUBJECT'}</Text></View>
                                {!isJunior && (
                                    <>
                                        <View style={[styles.cell, { flex: 1 }]}><Text style={styles.headerCellText}>MAX</Text></View>
                                        <View style={[styles.cell, { flex: 1 }]}><Text style={styles.headerCellText}>PASS</Text></View>
                                        <View style={[styles.cell, { flex: 1 }]}><Text style={styles.headerCellText}>OBT</Text></View>
                                        {!!exam.show_highest_marks && (
                                            <View style={[styles.cell, { flex: 1 }]}><Text style={styles.headerCellText}>HIGH</Text></View>
                                        )}
                                    </>
                                )}
                                <View style={[styles.cell, { flex: isJunior ? 1.5 : 1, borderRightWidth: 0 }]}><Text style={styles.headerCellText}>{isJunior ? 'GRADE / PERFORMANCE' : 'GRADE'}</Text></View>
                            </View>
                            {(exam.subjects_blueprint || []).map((sub: any, idx: number) => {
                                const m = marks.find((m: any) => m.subject === sub.name) || {};
                                const highest = manualStats[`highest_${sub.name}`] || '-';
                                return (
                                    <View key={idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#f8fafc' }]}>
                                        <View style={[styles.cell, { flex: isJunior ? 3 : 2.5, alignItems: 'flex-start' }]}><Text style={[styles.cellText, { fontWeight: '900', color: '#1e293b', textAlign: 'left' }]}>{sub.name}</Text></View>
                                        {!isJunior && (
                                            <>
                                                <View style={[styles.cell, { flex: 1 }]}><Text style={styles.cellText}>{(parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0)}</Text></View>
                                                <View style={[styles.cell, { flex: 1 }]}><Text style={styles.cellText}>{sub.passing_marks || '-'}</Text></View>
                                                <View style={[styles.cell, { flex: 1 }]}><Text style={[styles.cellText, { color: '#4f46e5', fontSize: 12, fontWeight: '900' }]}>{m.theory || '-'}</Text></View>
                                                {!!exam.show_highest_marks && (
                                                    <View style={[styles.cell, { flex: 1 }]}><Text style={[styles.cellText, { color: '#6366f1' }]}>{highest}</Text></View>
                                                )}
                                            </>
                                        )}
                                        <View style={[styles.cell, { flex: isJunior ? 1.5 : 1, borderRightWidth: 0 }]}><Text style={[styles.cellText, { fontWeight: '900', color: isJunior ? '#4f46e5' : '#000', fontSize: isJunior ? 13 : 10 }]}>{m.grade || '-'}</Text></View>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Summary Footer (Only for Senior) */}
                        {!isJunior && (
                            <View style={styles.summaryBox}>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>GRAND TOTAL</Text>
                                    <Text style={styles.summaryValue}>{stats.total} / {totalMax}</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>PERCENTAGE</Text>
                                    <Text style={styles.summaryValue}>{stats.percentage}%</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryLabel}>FINAL GRADE</Text>
                                    <Text style={[styles.summaryValue, { color: '#fbbf24' }]}>{stats.grade}</Text>
                                </View>
                            </View>
                        )}

                        {/* Achievement Medals (Only for Senior) */}
                        {!isJunior && (manualStats.section_topper_name || manualStats.class_topper_name) && (
                            <View style={styles.medalRow}>
                                {manualStats.section_topper_name && (
                                    <View style={styles.medal}>
                                        <Ionicons name="trophy" size={18} color="#4f46e5" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.medalText} numberOfLines={1}>Section Topper: {manualStats.section_topper_name}</Text>
                                            <Text style={{ fontSize: 8, fontWeight: '800', color: '#4338ca' }}>
                                                Score: {manualStats.section_topper_total} / {totalMax}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                                {manualStats.class_topper_name && (
                                    <View style={styles.medal}>
                                        <Ionicons name="ribbon" size={18} color="#4f46e5" />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.medalText} numberOfLines={1}>Class Topper: {manualStats.class_topper_name}</Text>
                                            <Text style={{ fontSize: 8, fontWeight: '800', color: '#4338ca' }}>
                                                Score: {manualStats.class_topper_total} / {totalMax}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Remarks */}
                        <View style={styles.remarks}>
                            <Text style={styles.remarkTitle}>OFFICIAL REMARKS</Text>
                            <Text style={styles.remarkText}>"{result.overall_remark || 'Satisfactory performance. Aim for higher goals in the next academic term.'}"</Text>
                        </View>

                        {/* Attendance Summary (Junior Only) */}
                        {isJunior && attendance && (
                            <View style={{ backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-around', borderWidth: 1, borderColor: '#cbd5e1' }}>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 8, fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>TOTAL DAYS</Text>
                                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{attendance.total_days}</Text>
                                </View>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 8, fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>PRESENT</Text>
                                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{attendance.present_days}</Text>
                                </View>
                                <View style={{ alignItems: 'center' }}>
                                    <Text style={{ fontSize: 8, fontWeight: '900', color: '#64748b', textTransform: 'uppercase' }}>PERCENTAGE</Text>
                                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#1e293b' }}>{attendance.percentage}%</Text>
                                </View>
                            </View>
                        )}

                        {/* Signatures */}
                        <View style={styles.signatures}>
                            <View style={styles.sigLine}><Text style={styles.sigText}>CLASS TEACHER</Text></View>
                            <View style={styles.sigLine}><Text style={styles.sigText}>PRINCIPAL</Text></View>
                            {isJunior ? null : <View style={styles.sigLine}><Text style={styles.sigText}>PARENT</Text></View>}
                        </View>
                    </View>
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}