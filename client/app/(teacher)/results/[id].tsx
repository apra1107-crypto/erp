import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  ActivityIndicator, 
  Alert, 
  ScrollView, 
  StatusBar, 
  Platform, 
  Image, 
  KeyboardAvoidingView, 
  Dimensions 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../context/ThemeContext';
import { API_ENDPOINTS, BASE_URL } from '../../../constants/Config';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const SmartMarkInput = React.memo(({ value, onChange, placeholder, style, keyboardType = 'default', theme, isDark }: any) => {
    const [isFocused, setIsFocused] = useState(false);
    return (
        <TextInput
            style={[
                {
                    backgroundColor: isDark ? '#1a1a1a' : '#f8fafc',
                    borderRadius: 8,
                    height: '100%',
                    width: '100%',
                    textAlign: 'center',
                    fontSize: 14,
                    fontWeight: '700',
                    color: theme.text,
                },
                isFocused && { backgroundColor: theme.primary + '15' },
                style
            ]}
            value={value?.toString()}
            placeholder={placeholder}
            placeholderTextColor={theme.textLight}
            onChangeText={onChange}
            keyboardType={keyboardType}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            selectTextOnFocus={true}
        />
    );
});

export default function TeacherExamDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme, isDark } = useTheme();

    const [loading, setLoading] = useState(true);
    const [exam, setExam] = useState<any>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const [fillModalVisible, setFillModalVisible] = useState(false);
    const [statsModalVisible, setStatsModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);

    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectionMap, setSelectionMap] = useState<Record<string, boolean>>({});
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    const [gridMarks, setGridMarks] = useState<any>({}); 
    const [gridRemarks, setGridRemarks] = useState<any>({}); 
    const [manualStats, setManualStats] = useState<any>({});
    const [classStudents, setClassStudents] = useState<any[]>([]);

    const [sectionSuggestions, setSectionSuggestions] = useState<any[]>([]);
    const [classSuggestions, setClassSuggestions] = useState<any[]>([]);
    const [showSectionList, setShowSectionList] = useState(false);
    const [showClassList, setShowClassList] = useState(false);

    useEffect(() => {
        fetchExamData();
    }, [id]);

    const fetchExamData = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            const headers = { 
                Authorization: `Bearer ${token}`,
                'x-academic-session-id': sessionId?.toString()
            };

            const response = await axios.get(`${API_ENDPOINTS.EXAM}/${id}/grid`, {
                headers
            });

            setExam(response.data.exam);
            const sorted = response.data.students.sort((a: any, b: any) => (parseInt(a.student.roll_no) || 0) - (parseInt(b.student.roll_no) || 0));
            setStudents(sorted);
            setFilteredStudents(sorted);
            setManualStats(response.data.exam.manual_stats || {});

            if (response.data.exam.class_name) {
                const classResp = await axios.get(`${API_ENDPOINTS.EXAM}/students/search-class?class_name=${response.data.exam.class_name}`, {
                    headers
                });
                setClassStudents(classResp.data);
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Failed to load data' });
        } finally {
            setLoading(false);
        }
    };

    const handleSectionTopperSearch = (text: string) => {
        setManualStats({ ...manualStats, section_topper_name: text });
        if (text.trim().length > 0) {
            const matches = students.filter(s => s.student.name.toLowerCase().includes(text.toLowerCase()));
            setSectionSuggestions(matches.slice(0, 5));
            setShowSectionList(true);
        } else setShowSectionList(false);
    };

    const handleClassTopperSearch = (text: string) => {
        setManualStats({ ...manualStats, class_topper_name: text });
        if (text.trim().length > 0) {
            const matches = classStudents.filter(s => s.name.toLowerCase().includes(text.toLowerCase()));
            setClassSuggestions(matches.slice(0, 5));
            setShowClassList(true);
        } else setShowClassList(false);
    };

    const toggleStudentSelection = (studentId: string | number) => {
        setSelectionMap(prev => ({ ...prev, [studentId]: !prev[studentId] }));
    };

    const getSelectedCount = () => Object.values(selectionMap).filter(Boolean).length;

    const toBase64 = async (url: string | null | undefined) => {
        if (!url) return null;
        try {
            const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const response = await fetch(fullUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) { 
            console.warn("Photo conversion failed:", url, e);
            return null; 
        }
    };

    const generatePDF = async () => {
        const selectedStudentsData = students.filter(s => selectionMap[s.student.id]);
        if (selectedStudentsData.length === 0) return Alert.alert('Warning', 'Select students first');

        try {
            setIsGeneratingPDF(true);
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            const profileRes = await axios.get(`${API_ENDPOINTS.AUTH.TEACHER}/profile`, { 
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                } 
            });
            
            if (!profileRes.data?.teacher) {
                throw new Error("Failed to fetch institute profile details");
            }

            const inst = profileRes.data.teacher;
            // For teachers, the key is institute_logo
            const logoB64 = await toBase64(inst.institute_logo);

            let htmlContent = `
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
            `;

            const totalMax = exam.subjects_blueprint.reduce((sum: number, sub: any) => sum + (parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0), 0);

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

            // Fetch all student photos with a 5s timeout per photo to prevent hanging
            const studentsWithPhotos = await Promise.all(selectedStudentsData.map(async (item) => {
                try {
                    const b64 = await toBase64(item.student.profile_image || item.student.photo_url);
                    return { ...item, photoB64: b64 };
                } catch (e) {
                    return { ...item, photoB64: null };
                }
            }));

            for (const item of studentsWithPhotos) {
                const s = item.student; const r = item.calculated_stats || {}; const m = item.marks_data || [];
                const instName = inst.institute_name || "INSTITUTE NAME";
                const instAddress = `${inst.institute_address || ''} ${inst.landmark || ''} ${inst.district || ''} ${inst.state || ''} ${inst.pincode || ''}`;

                htmlContent += `
                    <div class="report-card">
                        <div class="inner-border"></div>
                        <div class="header">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 2px;">
                                ${logoB64 ? `<img src="${logoB64}" style="width: 80px; height: 80px; object-fit: contain;" />` : ''}
                                <h1 class="inst-name">${instName}</h1>
                            </div>
                            ${inst.affiliation ? `<p class="inst-affiliation">${inst.affiliation}</p>` : ''}
                            <p class="inst-sub" style="margin-top: 0;">${instAddress}</p>
                            <div class="exam-title-box">${exam.name}</div>
                        </div>
                        <div class="student-section">
                            <div class="info-grid">
                                <div class="info-row"><div class="info-label">STUDENT NAME</div><div class="info-value">${s.name}</div></div>
                                <div class="info-row"><div class="info-label">CLASS & SECTION</div><div class="info-value">${s.class} - ${s.section}</div></div>
                                <div class="info-row"><div class="info-label">ROLL NUMBER</div><div class="info-value">${s.roll_no}</div></div>
                                <div class="info-row"><div class="info-label">FATHER'S NAME</div><div class="info-value">${s.father_name}</div></div>
                                <div class="info-row"><div class="info-label">DATE OF BIRTH</div><div class="info-value">${formatDOB(s.dob)}</div></div>
                                <div class="info-row"><div class="info-label">CONTACT NO.</div><div class="info-value">${s.mobile || s.phone || '-'}</div></div>
                            </div>
                            <div class="photo-box">${item.photoB64 ? `<img src="${item.photoB64}" />` : '<span style="font-size: 10px; color: #999;">PHOTO</span>'}</div>
                        </div>
                        <table>
                            <thead><tr><th class="text-left">SUBJECT</th><th>MAX</th><th>PASS</th><th>OBT</th>${exam.show_highest_marks ? '<th>HIGH</th>' : ''}<th>GRADE</th></tr></thead>
                            <tbody>
                                ${exam.subjects_blueprint.map((sub: any) => {
                                    const mk = m.find((x: any) => x.subject === sub.name) || {};
                                    return `<tr><td class="text-left">${sub.name}</td><td>${(parseFloat(sub.max_theory) || 0) + (parseFloat(sub.max_practical) || 0)}</td><td>${sub.passing_marks || '-'}</td><td style="color: #4f46e5; font-size: 16px; font-weight: 900;">${mk.theory || '-'}</td>${exam.show_highest_marks ? `<td>${manualStats[`highest_${sub.name}`] || '-'}</td>` : ''}<td>${mk.grade || '-'}</td></tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                        <div class="summary-box">
                            <div class="stat-item"><div class="stat-label">GRAND TOTAL</div><div class="stat-value">${r.total || 0} / ${totalMax}</div></div>
                            <div class="stat-item"><div class="stat-label">PERCENTAGE</div><div class="stat-value">${r.percentage || 0}%</div></div>
                            <div class="stat-item"><div class="stat-label">FINAL GRADE</div><div class="stat-value" style="color: #fbbf24;">${r.grade || '-'}</div></div>
                        </div>
                        ${(manualStats.section_topper_name || manualStats.class_topper_name) ? `<div class="medal-row">${manualStats.section_topper_name ? `<div class="medal"><div style="font-size: 24px;">🏆</div><div><div class="medal-text">Section Topper: ${manualStats.section_topper_name}</div><div class="medal-score">Score: ${manualStats.section_topper_total} / ${totalMax}</div></div></div>` : ''}${manualStats.class_topper_name ? `<div class="medal"><div style="font-size: 24px;">🎖️</div><div><div class="medal-text">Class Topper: ${manualStats.class_topper_name}</div><div class="medal-score">Score: ${manualStats.class_topper_total} / ${totalMax}</div></div></div>` : ''}</div>` : ''}
                        <div class="remarks-box"><div class="remark-title">OFFICIAL REMARKS</div><div class="remark-text">"${item.overall_remark || 'Satisfactory performance. Keep it up.'}"</div></div>
                        <div class="footer"><div class="sig-line">TEACHER'S SIGNATURE</div><div class="sig-line">PRINCIPAL'S SIGNATURE</div><div class="sig-line">PARENT'S SIGNATURE</div></div>
                    </div>
                `;
            }
            htmlContent += `</body></html>`;
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            setIsSelectionMode(false); setSelectionMap({});
        } catch (error: any) { 
            console.error("PDF Generation Error:", error);
            Alert.alert('Error', `Failed to generate PDF: ${error.message || 'Unknown error'}`); 
        } finally { 
            setIsGeneratingPDF(false); 
        }
    };

    const handleSaveAllMarks = async () => {
        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            const promises = students.map(async (s) => {
                const marks = gridMarks[s.student.id];
                const remark = gridRemarks[s.student.id];
                let totalObtained = 0; let maxTotal = 0;
                marks.forEach((m: any) => {
                    const evalMark = (v: any) => v?.toString().includes('+') ? v.split('+').reduce((a: any, b: any) => parseFloat(a) + parseFloat(b), 0) : parseFloat(v) || 0;
                    totalObtained += evalMark(m.theory) + evalMark(m.practical);
                    const bp = exam.subjects_blueprint.find((sub: any) => sub.name === m.subject);
                    if (bp) maxTotal += (parseInt(bp.max_theory) || 0) + (parseInt(bp.max_practical) || 0);
                });
                let percentage = maxTotal > 0 ? ((totalObtained / maxTotal) * 100).toFixed(2) : 0;
                let grade = 'F';
                if (exam.grading_rules) {
                    const rule = exam.grading_rules.find((r: any) => parseFloat(percentage as string) >= r.min && parseFloat(percentage as string) <= r.max);
                    if (rule) grade = rule.grade;
                }
                return axios.post(`${API_ENDPOINTS.EXAM}/${id}/student/save`, { student_id: s.student.id, marks_data: marks, calculated_stats: { total: totalObtained, percentage, grade }, overall_remark: remark }, { 
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-academic-session-id': sessionId?.toString()
                    } 
                });
            });
            await Promise.all(promises);
            Toast.show({ type: 'success', text1: 'Marks Saved!' });
            setFillModalVisible(false); fetchExamData();
        } catch (error) { Toast.show({ type: 'error', text1: 'Save Failed' }); } finally { setSaving(false); }
    };

    const handleSaveStats = async () => {
        try {
            const token = await AsyncStorage.getItem('teacherToken');
            const storedSessionId = await AsyncStorage.getItem('selectedSessionId');
            const userDataStr = await AsyncStorage.getItem('teacherData');
            const userData = userDataStr ? JSON.parse(userDataStr) : null;
            const sessionId = storedSessionId || (userData ? userData.current_session_id : null);

            await axios.put(`${API_ENDPOINTS.EXAM}/${id}/stats`, {
                manual_stats: manualStats
            }, { 
                headers: { 
                    Authorization: `Bearer ${token}`,
                    'x-academic-session-id': sessionId?.toString()
                } 
            });
            Toast.show({ type: 'success', text1: 'Stats updated!' });
            setStatsModalVisible(false);
            fetchExamData();
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Failed to save stats' });
        }
    };

    const selectSectionTopper = (name: string) => {
        setManualStats({ ...manualStats, section_topper_name: name });
        setShowSectionList(false);
    };

    const selectClassTopper = (student: any) => {
        setManualStats({ ...manualStats, class_topper_name: `${student.name} (Sec ${student.section})` });
        setShowClassList(false);
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        headerTitle: { fontSize: 18, fontWeight: '900', color: theme.text },
        floatingHeaderBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center', elevation: 4 },
        actionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.card, borderWidth: 1.5, gap: 8, elevation: 2 },
        actionChipText: { fontSize: 13, fontWeight: '800' },
        studentCard: { padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, elevation: 2, backgroundColor: theme.card },
        studentRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
        avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary + '10', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
        studentName: { fontSize: 16, fontWeight: '800' },
        gridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.border, alignItems: 'center' },
        subHeaderLabel: { fontSize: 10, fontWeight: '800', color: theme.textLight, textAlign: 'center', marginBottom: 4 },
        subInput: { backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', padding: 8, borderRadius: 8, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 12, textAlign: 'center' }
    }), [theme, isDark]);

    if (loading) return <View style={{flex:1, justifyContent:'center'}}><ActivityIndicator size="large" color={theme.primary} /></View>;

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
            <View style={{ position: 'absolute', top: insets.top + 10, left: 0, right: 0, zIndex: 100 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 }}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.floatingHeaderBtn}><Ionicons name="arrow-back" size={24} color={theme.text} /></TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 15 }}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{exam?.name}</Text>
                        <Text style={{ fontSize: 11, color: theme.textLight, fontWeight: '700' }}>Class {exam.class_name}-{exam.section}</Text>
                    </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 15 }}>
                    <TouchableOpacity onPress={() => {
                        const initMarks: any = {}; const initRem: any = {};
                        students.forEach(s => {
                            initMarks[s.student.id] = exam.subjects_blueprint.map((sub: any) => {
                                const found = s.marks_data.find((m: any) => m.subject === sub.name);
                                return found ? { ...found } : { subject: sub.name, theory: '', practical: '', grade: '' };
                            });
                            initRem[s.student.id] = s.overall_remark || '';
                        });
                        setGridMarks(initMarks); setGridRemarks(initRem); setFillModalVisible(true);
                    }} style={styles.actionChip}><Ionicons name="grid" size={16} color={theme.primary} /><Text style={[styles.actionChipText, { color: theme.primary }]}>Fill Marks</Text></TouchableOpacity>
                    
                    {!!exam?.show_highest_marks && (
                        <TouchableOpacity onPress={() => setStatsModalVisible(true)} style={[styles.actionChip, { borderColor: '#FFD70080', backgroundColor: theme.card }]}>
                            <Ionicons name="trophy" size={16} color="#FFD700" />
                            <Text style={[styles.actionChipText, { color: isDark ? '#FFD700' : '#B8860B' }]}>Toppers</Text>
                        </TouchableOpacity>
                    )}

                    {/* Share Results Toggle */}
                    <TouchableOpacity 
                        onPress={() => {
                            setIsSelectionMode(!isSelectionMode);
                            if (isSelectionMode) setSelectionMap({});
                        }} 
                        style={[
                            styles.actionChip, 
                            { 
                                borderColor: isSelectionMode ? theme.danger : '#6366f1', 
                                backgroundColor: isSelectionMode ? theme.danger + '10' : '#6366f110',
                                width: 45,
                                justifyContent: 'center',
                                paddingHorizontal: 0
                            }
                        ]}
                    >
                        <Ionicons 
                            name={isSelectionMode ? "close" : "share-social"} 
                            size={20} 
                            color={isSelectionMode ? theme.danger : "#6366f1"} 
                        />
                    </TouchableOpacity>

                    {isSelectionMode && (
                        <TouchableOpacity 
                            onPress={() => {
                                const allSelected = filteredStudents.every(s => selectionMap[s.student.id]);
                                const newMap = { ...selectionMap };
                                filteredStudents.forEach(s => newMap[s.student.id] = !allSelected);
                                setSelectionMap(newMap);
                            }} 
                            style={[
                                styles.actionChip, 
                                { 
                                    borderColor: theme.primary, 
                                    backgroundColor: theme.primary + '10',
                                    borderStyle: 'dashed',
                                    width: 45,
                                    justifyContent: 'center',
                                    paddingHorizontal: 0
                                }
                            ]}
                        >
                            <Ionicons 
                                name={filteredStudents.length > 0 && filteredStudents.every(s => selectionMap[s.student.id]) ? "remove-circle" : "checkmark-done"} 
                                size={20} 
                                color={theme.primary} 
                            />
                        </TouchableOpacity>
                    )}
                </ScrollView>
            </View>

            <FlatList
                data={filteredStudents}
                keyExtractor={(item) => item.student.id.toString()}
                contentContainerStyle={{ padding: 15, paddingTop: insets.top + 120 }}
                renderItem={({ item }) => {
                    const isFilled = item.marks_data && 
                                     item.marks_data.length > 0 && 
                                     item.marks_data.some((m: any) => m.theory !== '' && m.theory !== null && m.theory !== undefined);
                    
                    return (
                        <TouchableOpacity 
                            style={[styles.studentCard, { borderColor: isSelectionMode && selectionMap[item.student.id] ? theme.primary : theme.border }]} 
                            onPress={() => isSelectionMode ? toggleStudentSelection(item.student.id) : router.push(`/(teacher)/results/preview?examId=${id}&studentId=${item.student.id}`)}
                        >
                            <View style={styles.studentRow}>
                                <View style={styles.avatar}>{item.student.profile_image ? <Image source={{ uri: item.student.profile_image }} style={{width:'100%', height:'100%'}} /> : <Text style={{fontSize:18, fontWeight:'900', color:theme.primary}}>{item.student.name[0]}</Text>}</View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={[styles.studentName, { color: theme.text }]}>{item.student.name}</Text>
                                        {isFilled && <Ionicons name="checkmark-circle" size={16} color="#27AE60" />}
                                    </View>
                                    <Text style={{fontSize:12, color:theme.textLight}}>Roll: {item.student.roll_no} • Total: {item.calculated_stats?.total || 0}</Text>
                                </View>
                                {isSelectionMode ? <View style={[{width:24, height:24, borderRadius:6, borderWidth:2, borderColor:theme.primary}, selectionMap[item.student.id] && {backgroundColor:theme.primary}]}>{selectionMap[item.student.id] && <Ionicons name="checkmark" size={16} color="#fff" />}</View> : <Ionicons name="chevron-forward" size={20} color={theme.border} />}
                            </View>
                        </TouchableOpacity>
                    );
                }}
            />

            {isSelectionMode && getSelectedCount() > 0 && (
                <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 20, right: 20 }}>
                    <TouchableOpacity onPress={generatePDF} disabled={isGeneratingPDF}>
                        <LinearGradient colors={['#4f46e5', '#7c3aed']} start={{x:0,y:0}} end={{x:1,y:0}} style={{ padding: 18, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 12 }}>
                            {isGeneratingPDF ? <ActivityIndicator color="#fff" /> : <><Ionicons name="share-social" size={24} color="#fff" style={{ marginRight: 12 }} /><Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>SHARE {getSelectedCount()} RESULTS</Text></>}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            <Modal visible={fillModalVisible} animationType="slide">
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={{ position: 'absolute', top: 50, left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, justifyContent: 'space-between' }}>
                        <TouchableOpacity onPress={() => setFillModalVisible(false)} style={styles.floatingHeaderBtn}><Ionicons name="close" size={28} color={theme.text} /></TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text }}>Marks Entry</Text>
                        <TouchableOpacity onPress={handleSaveAllMarks} style={[styles.floatingHeaderBtn, { backgroundColor: theme.primary }]}><Ionicons name="checkmark" size={28} color="#fff" /></TouchableOpacity>
                    </View>
                    <ScrollView 
                        horizontal 
                        style={{ marginTop: 120 }} 
                        directionalLockEnabled={false}
                        nestedScrollEnabled={true}
                        keyboardShouldPersistTaps="always"
                    >
                        <View>
                            <View style={[styles.gridRow, { backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', borderBottomWidth: 2, borderBottomColor: theme.border }]}>
                                <View style={{ width: 150, padding: 15, borderRightWidth: 1, borderRightColor: theme.border }}><Text style={styles.subHeaderLabel}>STUDENT</Text></View>
                                {exam?.subjects_blueprint.map((s: any, i: number) => (
                                    <View key={i} style={{ width: 80, padding: 15, borderRightWidth: 1, borderRightColor: theme.border }}><Text style={styles.subHeaderLabel}>{s.name.toUpperCase()}</Text></View>
                                ))}
                                <View style={{ width: 150, padding: 15, borderRightWidth: 1, borderRightColor: theme.border }}><Text style={styles.subHeaderLabel}>OVERALL REMARK</Text></View>
                            </View>
                            <ScrollView 
                                style={{ flex: 1 }}
                                nestedScrollEnabled={true}
                                directionalLockEnabled={false}
                                keyboardShouldPersistTaps="always"
                            >
                                {students.map((s) => (
                                    <View key={s.student.id} style={styles.gridRow}>
                                        <View style={{ width: 150, padding: 12, borderRightWidth: 1, borderRightColor: theme.border }}><Text style={{fontSize:12, fontWeight:'800', color:theme.text}} numberOfLines={1}>{s.student.name}</Text></View>
                                        {gridMarks[s.student.id]?.map((m: any, idx: number) => (
                                            <View key={idx} style={{ width: 80, height: 50, borderRightWidth: 1, borderRightColor: theme.border }}>
                                                <SmartMarkInput value={m.theory} onChange={(v: string) => {
                                                    const updated = [...gridMarks[s.student.id]]; updated[idx].theory = v;
                                                    setGridMarks({ ...gridMarks, [s.student.id]: updated });
                                                }} theme={theme} isDark={isDark} />
                                            </View>
                                        ))}
                                        <View style={{ width: 150, height: 50, borderRightWidth: 1, borderRightColor: theme.border }}>
                                            <TextInput
                                                style={[
                                                    {
                                                        backgroundColor: isDark ? '#1a1a1a' : '#f8fafc',
                                                        borderRadius: 8,
                                                        height: '100%',
                                                        width: '100%',
                                                        textAlign: 'left',
                                                        paddingHorizontal: 10,
                                                        fontSize: 12,
                                                        fontWeight: '700',
                                                        color: theme.text,
                                                    }
                                                ]}
                                                value={gridRemarks[s.student.id]}
                                                placeholder="Remark..."
                                                placeholderTextColor={theme.textLight}
                                                onChangeText={(v) => setGridRemarks({ ...gridRemarks, [s.student.id]: v })}
                                            />
                                        </View>
                                    </View>
                                ))}
                                <View style={{ height: 100 }} />
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* Toppers Modal */}
            <Modal visible={statsModalVisible} animationType="slide" transparent={false} onRequestClose={() => setStatsModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1 }}
                    >
                        {/* Free Flow Header for Toppers */}
                        <View style={{ position: 'absolute', top: insets.top + 10, left: 0, right: 0, zIndex: 100, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, justifyContent: 'space-between' }}>
                            <TouchableOpacity onPress={() => setStatsModalVisible(false)} style={styles.floatingHeaderBtn}>
                                <Ionicons name="close" size={28} color={theme.text} />
                            </TouchableOpacity>
                            <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={{ fontSize: 18, fontWeight: '900', color: theme.text }}>Toppers</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={handleSaveStats} 
                                style={[styles.floatingHeaderBtn, { backgroundColor: theme.primary }]}
                            >
                                <Ionicons name="checkmark" size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView 
                            style={{ flex: 1 }}
                            contentContainerStyle={{ padding: 20, paddingTop: insets.top + 80, paddingBottom: 40 }}
                            showsVerticalScrollIndicator={true}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={{ backgroundColor: theme.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: theme.border, elevation: 2 }}>
                                <Text style={[styles.subHeaderLabel, { textAlign: 'left', color: theme.primary, marginBottom: 15, fontSize: 11 }]}>SECTION TOPPER</Text>
                                <View style={{ gap: 15, marginBottom: 30 }}>
                                    <View style={{ position: 'relative', zIndex: 3000 }}>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.textLight, marginBottom: 5 }}>STUDENT NAME</Text>
                                        <TextInput
                                            style={[styles.subInput, { width: '100%', textAlign: 'left', paddingHorizontal: 15, height: 50, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                                            placeholder="Search student..."
                                            placeholderTextColor={theme.textLight}
                                            value={manualStats.section_topper_name}
                                            onChangeText={handleSectionTopperSearch}
                                        />
                                        {showSectionList && (
                                            <View style={{ position: 'absolute', top: 75, left: 0, right: 0, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, elevation: 10, zIndex: 5000 }}>
                                                {sectionSuggestions.map((s, i) => (
                                                    <TouchableOpacity key={i} style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border }} onPress={() => selectSectionTopper(s.student.name)}>
                                                        <Text style={{color: theme.text, fontWeight: '700'}}>{s.student.name}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.textLight, marginBottom: 5 }}>TOTAL MARKS</Text>
                                        <TextInput
                                            style={[styles.subInput, { width: '100%', textAlign: 'left', paddingHorizontal: 15, height: 50, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                                            placeholder="e.g. 580"
                                            placeholderTextColor={theme.textLight}
                                            keyboardType="numeric"
                                            value={manualStats.section_topper_total?.toString()}
                                            onChangeText={(v) => setManualStats({ ...manualStats, section_topper_total: v })}
                                        />
                                    </View>
                                </View>

                                <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 30, marginHorizontal: -20 }} />

                                <Text style={[styles.subHeaderLabel, { textAlign: 'left', color: theme.primary, marginBottom: 15, fontSize: 11 }]}>CLASS TOPPER</Text>
                                <View style={{ gap: 15, marginBottom: 30 }}>
                                    <View style={{ position: 'relative', zIndex: 2000 }}>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.textLight, marginBottom: 5 }}>STUDENT NAME (ALL SECTIONS)</Text>
                                        <TextInput
                                            style={[styles.subInput, { width: '100%', textAlign: 'left', paddingHorizontal: 15, height: 50, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                                            placeholder="Search across sections..."
                                            placeholderTextColor={theme.textLight}
                                            value={manualStats.class_topper_name}
                                            onChangeText={handleClassTopperSearch}
                                        />
                                        {showClassList && (
                                            <View style={{ position: 'absolute', top: 75, left: 0, right: 0, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, elevation: 10, zIndex: 5000 }}>
                                                {classSuggestions.map((s, i) => (
                                                    <TouchableOpacity key={i} style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: theme.border }} onPress={() => selectClassTopper(s)}>
                                                        <Text style={{color: theme.text, fontWeight: '700'}}>{s.name} <Text style={{fontSize: 10, fontWeight: '400', color: theme.textLight}}>(Sec {s.section})</Text></Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                    <View>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: theme.textLight, marginBottom: 5 }}>GRAND TOTAL</Text>
                                        <TextInput
                                            style={[styles.subInput, { width: '100%', textAlign: 'left', paddingHorizontal: 15, height: 50, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                                            placeholder="e.g. 595"
                                            placeholderTextColor={theme.textLight}
                                            keyboardType="numeric"
                                            value={manualStats.class_topper_total?.toString()}
                                            onChangeText={(v) => setManualStats({ ...manualStats, class_topper_total: v })}
                                        />
                                    </View>
                                </View>

                                <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 30, marginHorizontal: -20 }} />

                                <Text style={[styles.subHeaderLabel, { textAlign: 'left', color: theme.primary, marginBottom: 15, fontSize: 11 }]}>SUBJECT WISE HIGHEST</Text>
                                {exam?.subjects_blueprint.map((sub: any, i: number) => (
                                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                                        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>{sub.name}</Text>
                                        <TextInput
                                            style={[styles.subInput, { width: 90, height: 44, backgroundColor: isDark ? '#1a1a1a' : '#f8fafc', color: theme.text, borderColor: theme.border }]}
                                            placeholder="0"
                                            placeholderTextColor={theme.textLight}
                                            keyboardType="numeric"
                                            value={manualStats[`highest_${sub.name}`]?.toString()}
                                            onChangeText={(v) => setManualStats({ ...manualStats, [`highest_${sub.name}`]: v })}
                                        />
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}
