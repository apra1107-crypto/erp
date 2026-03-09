import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, StatusBar, Platform, Dimensions, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS, BASE_URL } from '../../../constants/Config';

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

    const toBase64 = async (url: string | null | undefined) => {
        if (!url) return null;
        try {
            const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
            const response = await fetch(fullUrl);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn("Base64 conversion failed for:", url);
            return null;
        }
    };

    const generatePDF = async () => {
        if (!data) return;
        try {
            setIsGeneratingPDF(true);
            const { exam, student, institute, result } = data;
            const marks = result?.marks_data || [];
            const stats = result?.calculated_stats || {};
            const manualStats = exam?.manual_stats || {};
            const totalMax = (exam.subjects_blueprint || []).reduce((sum: number, sub: any) => sum + (parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0), 0);

            const [logoB64, photoB64] = await Promise.all([
                toBase64(institute.logo_url),
                toBase64(student.photo_url)
            ]);

            const instName = institute.institute_name || "INSTITUTE NAME";
            const instAddress = `${institute.address || ''} ${institute.landmark || ''} ${institute.district || ''} ${institute.state || ''} ${institute.pincode || ''}`;

            const formatDOB = (dateStr: string) => {
                if (!dateStr) return '-';
                try {
                    const date = new Date(dateStr);
                    if (isNaN(date.getTime())) return dateStr;
                    const d = date.getDate().toString().padStart(2, '0');
                    const m = (date.getMonth() + 1).toString().padStart(2, '0');
                    const y = date.getFullYear();
                    return `${d}-${m}-${y}`;
                } catch (e) { return dateStr; }
            };

            const htmlContent = `
                <html>
                <head>
                    <style>
                        @page { size: A4; margin: 0; }
                        body { font-family: 'Helvetica', Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
                        .report-card { width: 210mm; height: 290mm; padding: 12mm; padding-top: 6mm; box-sizing: border-box; background: #fff; page-break-after: always; display: flex; flex-direction: column; position: relative; border: 2.5px solid #000; overflow: hidden; margin: 2mm 0; }
                        .inner-border { position: absolute; top: 2mm; left: 2mm; right: 2mm; bottom: 2mm; border: 0.8px solid #333; pointer-events: none; }
                        .header { text-align: center; margin-bottom: 10px; padding-top: 0; }
                        .inst-name { font-size: 36px; font-weight: 900; text-transform: uppercase; color: #1e1b4b; margin: 0; line-height: 1; }
                        .inst-sub { font-size: 13.5px; color: #444; font-weight: 700; margin-top: -5px; line-height: 1.2; }
                        .inst-affiliation { font-size: 17px; color: #4f46e5; font-weight: 700; margin-top: -15px; margin-bottom: 2px; margin-left: 25px; }
                        .exam-title-box { display: inline-block; background: #1e1b4b; color: #fff; padding: 6px 35px; border-radius: 4px; margin-top: 10px; transform: skewX(-10deg); font-weight: 900; font-size: 16px; }
                        .student-section { display: flex; justify-content: space-between; margin-bottom: 15px; padding: 12px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; }
                        .info-grid { flex: 1; }
                        .info-row { display: flex; border-bottom: 1px solid #cbd5e1; padding: 6px 0; }
                        .info-label { width: 140px; font-size: 10px; font-weight: bold; color: #64748b; }
                        .info-value { flex: 1; font-size: 14px; font-weight: 900; color: #0f172a; }
                        .photo-box { width: 90px; height: 110px; border: 4px solid #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden; }
                        .photo-box img { width: 100%; height: 100%; object-fit: cover; }
                        table { width: 100%; border-collapse: collapse; border: 2px solid #1e1b4b; border-radius: 12px; overflow: hidden; margin-bottom: 15px; }
                        th { background: #1e1b4b; color: #fff; padding: 8px; font-size: 11px; font-weight: 900; }
                        td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: center; font-size: 13px; font-weight: 800; }
                        .text-left { text-align: left; padding-left: 15px; }
                        tr:nth-child(even) { background-color: #f8fafc; }
                        .summary-box { display: flex; justify-content: space-between; background: #1e1b4b; padding: 15px; border-radius: 12px; margin-bottom: 15px; color: #fff; }
                        .stat-item { text-align: center; }
                        .stat-label { font-size: 9px; font-weight: bold; color: #94a3b8; margin-bottom: 2px; }
                        .stat-value { font-size: 20px; font-weight: 900; }
                        .medal-row { display: flex; flex-direction: row; gap: 10px; margin-bottom: 15px; }
                        .medal { flex: 1; border: 1.5px solid #4f46e5; background: #f5f3ff; padding: 10px; border-radius: 10px; display: flex; align-items: center; gap: 12px; }
                        .medal-text { font-size: 13px; font-weight: 900; color: #1e1b4b; }
                        .medal-score { font-size: 10px; font-weight: 800; color: #4338ca; }
                        .remarks-box { padding: 10px; background: #fffbeb; border-radius: 10px; border-left: 5px solid #f59e0b; margin-bottom: 10px; }
                        .remark-title { font-size: 10px; font-weight: 900; color: #92400e; margin-bottom: 3px; text-decoration: underline; }
                        .remark-text { font-size: 12px; font-style: italic; color: #451a03; font-weight: 600; line-height: 1.2; }
                        .footer { margin-top: auto; display: flex; justify-content: space-between; padding: 0 10px 25px 10px; }
                        .sig-line { border-top: 2.5px solid #1e1b4b; width: 150px; text-align: center; font-size: 10px; font-weight: 900; padding-top: 8px; }
                    </style>
                </head>
                <body>
                    <div class="report-card">
                        <div class="inner-border"></div>
                        <div class="header">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 2px;">
                                ${logoB64 ? `<img src="${logoB64}" style="width: 80px; height: 80px; object-fit: contain;" />` : ''}
                                <h1 class="inst-name">${instName}</h1>
                            </div>
                            ${institute.affiliation ? `<p class="inst-affiliation">${institute.affiliation}</p>` : ''}
                            <p class="inst-sub" style="margin-top: 0;">${instAddress}</p>
                            <div class="exam-title-box">${exam.name}</div>
                        </div>
                        <div class="student-section">
                            <div class="info-grid">
                                <div class="info-row"><div class="info-label">STUDENT NAME</div><div class="info-value">${student.name}</div></div>
                                <div class="info-row"><div class="info-label">CLASS & SECTION</div><div class="info-value">${student.class} - ${student.section}</div></div>
                                <div class="info-row"><div class="info-label">ROLL NUMBER</div><div class="info-value">${student.roll_no}</div></div>
                                <div class="info-row"><div class="info-label">FATHER'S NAME</div><div class="info-value">${student.father_name}</div></div>
                                <div class="info-row"><div class="info-label">DATE OF BIRTH</div><div class="info-value">${formatDOB(student.dob)}</div></div>
                                <div class="info-row"><div class="info-label">CONTACT NO.</div><div class="info-value">${student.mobile || '-'}</div></div>
                            </div>
                            <div class="photo-box">${photoB64 ? `<img src="${photoB64}" />` : '<span style="font-size: 10px; color: #999;">PHOTO</span>'}</div>
                        </div>
                        <table>
                            <thead><tr><th class="text-left">SUBJECT</th><th>MAX</th><th>PASS</th><th>OBT</th>${exam.show_highest_marks ? '<th>HIGH</th>' : ''}<th>GRADE</th></tr></thead>
                            <tbody>
                                ${exam.subjects_blueprint.map((sub: any) => {
                                    const mk = marks.find((x: any) => x.subject === sub.name) || {};
                                    return `<tr><td class="text-left">${sub.name}</td><td>${(parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0)}</td><td>${sub.passing_marks || '-'}</td><td style="color: #4f46e5; font-size: 16px; font-weight: 900;">${mk.theory || '-'}</td>${exam.show_highest_marks ? `<td>${manualStats[`highest_${sub.name}`] || '-'}</td>` : ''}<td>${mk.grade || '-'}</td></tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                        <div class="summary-box">
                            <div class="stat-item"><div class="stat-label">GRAND TOTAL</div><div class="stat-value">${stats.total || 0} / ${totalMax}</div></div>
                            <div class="stat-item"><div class="stat-label">PERCENTAGE</div><div class="stat-value">${stats.percentage || 0}%</div></div>
                            <div class="stat-item"><div class="stat-label">FINAL GRADE</div><div class="stat-value" style="color: #fbbf24;">${stats.grade || '-'}</div></div>
                        </div>
                        ${(manualStats.section_topper_name || manualStats.class_topper_name) ? `<div class="medal-row">${manualStats.section_topper_name ? `<div class="medal"><div style="font-size: 24px;">🏆</div><div><div class="medal-text">Section Topper: ${manualStats.section_topper_name}</div><div class="medal-score">Score: ${manualStats.section_topper_total} / ${totalMax}</div></div></div>` : ''}${manualStats.class_topper_name ? `<div class="medal"><div style="font-size: 24px;">🎖️</div><div><div class="medal-text">Class Topper: ${manualStats.class_topper_name}</div><div class="medal-score">Score: ${manualStats.class_topper_total} / ${totalMax}</div></div></div>` : ''}</div>` : ''}
                        <div class="remarks-box"><div class="remark-title">OFFICIAL REMARKS</div><div class="remark-text">"${result.overall_remark || 'Satisfactory performance. Keep it up.'}"</div></div>
                        <div class="footer"><div class="sig-line">TEACHER'S SIGNATURE</div><div class="sig-line">PRINCIPAL'S SIGNATURE</div><div class="sig-line">PARENT'S SIGNATURE</div></div>
                    </div>
                </body></html>`;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Report Card' });
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to download report card');
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
        } catch (error) { Alert.alert('Error', 'Failed to load marksheet data'); } finally { setLoading(false); }
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

    const { exam, student, institute, result } = data;
    const marks = result?.marks_data || []; const stats = result?.calculated_stats || {};
    const manualStats = exam?.manual_stats || {};
    const totalMax = (exam.subjects_blueprint || []).reduce((sum: number, sub: any) => sum + (parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0), 0);

    const formatDOB = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const d = date.getDate().toString().padStart(2, '0');
            const m = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear();
            return `${d}-${m}-${y}`;
        } catch (e) { return dateStr; }
    };

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
                    <Text style={{ color: '#fff', marginTop: 15, fontWeight: '900' }}>Generating PDF...</Text>
                </View>
            )}

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <View style={styles.paper}>
                        <View style={styles.paperInnerBorder} />
                        <View style={styles.header}>
                            <View style={styles.instRow}>
                                {institute.logo_url && <Image source={{ uri: institute.logo_url }} style={styles.logo} />}
                                <Text style={styles.instName}>{institute.institute_name}</Text>
                            </View>
                            {institute.affiliation && <Text style={styles.instAffiliation}>{institute.affiliation}</Text>}
                            <Text style={styles.instSub}>{institute.address} {institute.district} {institute.state}</Text>
                            <View style={styles.examTitleContainer}><Text style={styles.examTitle}>{exam.name}</Text></View>
                        </View>
                        <View style={styles.studentSection}>
                            <View style={styles.infoGrid}>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>STUDENT NAME</Text><Text style={styles.infoValue}>{student.name}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>CLASS & SECTION</Text><Text style={styles.infoValue}>{student.class} - {student.section}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>ROLL NUMBER</Text><Text style={styles.infoValue}>{student.roll_no}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>FATHER'S NAME</Text><Text style={styles.infoValue}>{student.father_name}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>DATE OF BIRTH</Text><Text style={styles.infoValue}>{formatDOB(student.dob)}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>CONTACT NO.</Text><Text style={styles.infoValue}>{student.mobile || '-'}</Text></View>
                            </View>
                            <View style={styles.photoBox}>{student.photo_url ? <Image source={{ uri: student.photo_url }} style={styles.photo} /> : <Ionicons name="person" size={40} color="#e2e8f0" />}</View>
                        </View>
                        <View style={styles.table}>
                            <View style={styles.tableHeader}>
                                <View style={[styles.cell, { flex: 2.5, alignItems: 'flex-start' }]}><Text style={styles.headerCellText}>SUBJECT</Text></View>
                                <View style={[styles.cell, { flex: 1 }]}><Text style={styles.headerCellText}>MAX</Text></View>
                                <View style={[styles.cell, { flex: 1 }]}><Text style={styles.headerCellText}>PASS</Text></View>
                                <View style={[styles.cell, { flex: 1 }]}><Text style={styles.headerCellText}>OBT</Text></View>
                                {!!exam.show_highest_marks && <View style={[styles.cell, { flex: 1 }]}><Text style={styles.headerCellText}>HIGH</Text></View>}
                                <View style={[styles.cell, { flex: 1, borderRightWidth: 0 }]}><Text style={styles.headerCellText}>GRADE</Text></View>
                            </View>
                            {exam.subjects_blueprint.map((sub: any, idx: number) => {
                                const m = marks.find((x: any) => x.subject === sub.name) || {};
                                const highest = manualStats[`highest_${sub.name}`] || '-';
                                return (
                                    <View key={idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#f8fafc' }]}>
                                        <View style={[styles.cell, { flex: 2.5, alignItems: 'flex-start' }]}><Text style={[styles.cellText, { fontWeight: '900', color: '#1e293b' }]}>{sub.name}</Text></View>
                                        <View style={[styles.cell, { flex: 1 }]}><Text style={styles.cellText}>{(parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0)}</Text></View>
                                        <View style={[styles.cell, { flex: 1 }]}><Text style={styles.cellText}>{sub.passing_marks || '-'}</Text></View>
                                        <View style={[styles.cell, { flex: 1 }]}><Text style={[styles.cellText, { color: '#4f46e5', fontWeight: '900' }]}>{m.theory || '-'}</Text></View>
                                        {!!exam.show_highest_marks && <View style={[styles.cell, { flex: 1 }]}><Text style={[styles.cellText, { color: '#6366f1' }]}>{highest}</Text></View>}
                                        <View style={[styles.cell, { flex: 1, borderRightWidth: 0 }]}><Text style={styles.cellText}>{m.grade || '-'}</Text></View>
                                    </View>
                                );
                            })}
                        </View>
                        <View style={styles.summaryBox}>
                            <View style={styles.summaryItem}><Text style={styles.summaryLabel}>GRAND TOTAL</Text><Text style={styles.summaryValue}>{stats.total} / {totalMax}</Text></View>
                            <View style={styles.summaryItem}><Text style={styles.summaryLabel}>PERCENTAGE</Text><Text style={styles.summaryValue}>{stats.percentage}%</Text></View>
                            <View style={styles.summaryItem}><Text style={styles.summaryLabel}>FINAL GRADE</Text><Text style={[styles.summaryValue, { color: '#fbbf24' }]}>{stats.grade}</Text></View>
                        </View>
                        {(manualStats.section_topper_name || manualStats.class_topper_name) && (
                            <View style={styles.medalRow}>
                                {manualStats.section_topper_name && <View style={styles.medal}><Ionicons name="trophy" size={18} color="#4f46e5" /><View style={{flex:1}}><Text style={styles.medalText} numberOfLines={1}>Section Topper: {manualStats.section_topper_name}</Text><Text style={{fontSize:8, fontWeight:'800', color:'#4338ca'}}>Score: {manualStats.section_topper_total}</Text></View></View>}
                                {manualStats.class_topper_name && <View style={styles.medal}><Ionicons name="ribbon" size={18} color="#4f46e5" /><View style={{flex:1}}><Text style={styles.medalText} numberOfLines={1}>Class Topper: {manualStats.class_topper_name}</Text><Text style={{fontSize:8, fontWeight:'800', color:'#4338ca'}}>Score: {manualStats.class_topper_total}</Text></View></View>}
                            </View>
                        )}
                        <View style={styles.remarks}><Text style={styles.remarkTitle}>OFFICIAL REMARKS</Text><Text style={styles.remarkText}>"{result.overall_remark || 'Satisfactory performance.'}"</Text></View>
                        <View style={styles.signatures}><View style={styles.sigLine}><Text style={styles.sigText}>TEACHER</Text></View><View style={styles.sigLine}><Text style={styles.sigText}>PRINCIPAL</Text></View><View style={styles.sigLine}><Text style={styles.sigText}>PARENT</Text></View></View>
                    </View>
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}
