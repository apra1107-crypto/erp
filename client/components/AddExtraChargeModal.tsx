import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AddExtraChargeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (charges: any[], studentIds: number[]) => Promise<void>;
    students: any[];
    monthName: string;
}

export default function AddExtraChargeModal({ isOpen, onClose, onConfirm, students, monthName }: AddExtraChargeModalProps) {
    const { theme, isDark } = useTheme();
    const [step, setStep] = useState(1);
    const [charges, setCharges] = useState([{ reason: '', amount: '' }]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [processing, setProcessing] = useState(false);
    
    // Selection filters
    const [searchTerm, setSearchTerm] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [sectionFilter, setSectionFilter] = useState('');

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const matchesSearch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.roll_no || '').toString().includes(searchTerm);
            const matchesClass = classFilter === '' || (s.class || '').toLowerCase().includes(classFilter.toLowerCase());
            const matchesSection = sectionFilter === '' || (s.section || '').toLowerCase().includes(sectionFilter.toLowerCase());
            return matchesSearch && matchesClass && matchesSection;
        });
    }, [students, searchTerm, classFilter, sectionFilter]);

    const handleAddRow = () => setCharges([...charges, { reason: '', amount: '' }]);
    const handleRemoveRow = (idx: number) => setCharges(charges.filter((_, i) => i !== idx));
    const handleUpdateRow = (idx: number, field: string, value: string) => {
        const newCharges = [...charges];
        (newCharges[idx] as any)[field] = value;
        setCharges(newCharges);
    };

    const toggleStudent = (id: number) => {
        if (selectedStudentIds.includes(id)) setSelectedStudentIds(selectedStudentIds.filter(sid => sid !== id));
        else setSelectedStudentIds([...selectedStudentIds, id]);
    };

    const selectAllVisible = () => {
        const visibleIds = filteredStudents.map(s => s.id);
        setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...visibleIds])));
    };

    const clearVisible = () => {
        const visibleIds = filteredStudents.map(s => s.id);
        setSelectedStudentIds(selectedStudentIds.filter(id => !visibleIds.includes(id)));
    };

    const handleConfirm = async () => {
        if (charges.some(c => !c.reason || !c.amount)) return;
        if (selectedStudentIds.length === 0) return;
        
        setProcessing(true);
        try {
            await onConfirm(charges, selectedStudentIds);
            resetAndClose();
        } catch (error) {
            console.error(error);
        } finally {
            setProcessing(false);
        }
    };

    const resetAndClose = () => {
        setStep(1);
        setCharges([{ reason: '', amount: '' }]);
        setSelectedStudentIds([]);
        setSearchTerm('');
        setClassFilter('');
        setSectionFilter('');
        onClose();
    };

    const styles = StyleSheet.create({
        overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
        container: { backgroundColor: theme.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, height: SCREEN_HEIGHT * 0.85, paddingBottom: 20 },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
        title: { fontSize: 18, fontWeight: '800', color: theme.text },
        subtitle: { fontSize: 12, color: theme.textLight, marginTop: 4 },
        
        stepContainer: { flex: 1, padding: 20 },
        
        // Step 1 Styles
        chargeRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' },
        reasonInput: { flex: 2, height: 45, backgroundColor: theme.background, borderRadius: 12, paddingHorizontal: 12, color: theme.text, borderWidth: 1, borderColor: theme.border },
        amountInputWrap: { flex: 1, height: 45, backgroundColor: theme.background, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: theme.border },
        amountInput: { flex: 1, color: theme.text, marginLeft: 4 },
        removeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F4433615', justifyContent: 'center', alignItems: 'center' },
        addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, alignSelf: 'flex-start' },
        addRowText: { color: theme.primary, fontWeight: '700' },
        summaryBar: { marginTop: 'auto', padding: 15, backgroundColor: theme.primary + '10', borderRadius: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        summaryLabel: { fontSize: 14, color: theme.text, fontWeight: '600' },
        summaryValue: { fontSize: 18, fontWeight: '800', color: theme.primary },

        // Step 2 Styles
        filterBar: { flexDirection: 'row', gap: 10, marginBottom: 15 },
        miniInput: { flex: 1, height: 40, backgroundColor: theme.background, borderRadius: 10, paddingHorizontal: 10, color: theme.text, borderWidth: 1, borderColor: theme.border, fontSize: 12 },
        selectionActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
        actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: theme.primary + '15' },
        actionBtnText: { color: theme.primary, fontSize: 12, fontWeight: '700' },
        selectionCount: { fontSize: 12, color: theme.textLight, fontWeight: '600' },
        
        studentGrid: { flex: 1 },
        studentCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: theme.background, borderRadius: 15, marginBottom: 8, borderWidth: 1, borderColor: theme.border },
        selectedCard: { borderColor: theme.primary, backgroundColor: theme.primary + '05' },
        studentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
        studentAvatarText: { color: theme.primary, fontWeight: '800' },
        studentInfo: { flex: 1 },
        studentName: { fontSize: 14, fontWeight: '700', color: theme.text },
        studentMeta: { fontSize: 11, color: theme.textLight },
        checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' },
        checkCircleSelected: { backgroundColor: theme.primary, borderColor: theme.primary },

        footer: { padding: 20, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', gap: 12 },
        backBtn: { flex: 1, height: 50, borderRadius: 15, backgroundColor: theme.border, justifyContent: 'center', alignItems: 'center' },
        backBtnText: { color: theme.text, fontWeight: '700' },
        nextBtn: { flex: 2, height: 50, borderRadius: 15, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
        nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 }
    });

    const totalExtra = charges.reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0);

    return (
        <Modal visible={isOpen} transparent animationType="slide" onRequestClose={resetAndClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Add Extra Charges</Text>
                            <Text style={styles.subtitle}>{step === 1 ? 'Define Charges' : 'Select Students'} • {monthName}</Text>
                        </View>
                        <TouchableOpacity onPress={resetAndClose}>
                            <Ionicons name="close" size={24} color={theme.textLight} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.stepContainer}>
                        {step === 1 ? (
                            <View style={{ flex: 1 }}>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {charges.map((charge, idx) => (
                                        <View key={idx} style={styles.chargeRow}>
                                            <TextInput 
                                                style={styles.reasonInput} 
                                                placeholder="Reason (e.g. Exam Fee)" 
                                                placeholderTextColor={theme.textLight}
                                                value={charge.reason}
                                                onChangeText={(v) => handleUpdateRow(idx, 'reason', v)}
                                            />
                                            <View style={styles.amountInputWrap}>
                                                <Text style={{ color: theme.textLight }}>₹</Text>
                                                <TextInput 
                                                    style={styles.amountInput} 
                                                    placeholder="0" 
                                                    placeholderTextColor={theme.textLight}
                                                    keyboardType="numeric"
                                                    value={charge.amount}
                                                    onChangeText={(v) => handleUpdateRow(idx, 'amount', v)}
                                                />
                                            </View>
                                            {charges.length > 1 && (
                                                <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveRow(idx)}>
                                                    <Ionicons name="trash" size={16} color="#F44336" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))}
                                    <TouchableOpacity style={styles.addRowBtn} onPress={handleAddRow}>
                                        <Ionicons name="add-circle" size={20} color={theme.primary} />
                                        <Text style={styles.addRowText}>Add Another Charge</Text>
                                    </TouchableOpacity>
                                </ScrollView>
                                
                                <View style={styles.summaryBar}>
                                    <Text style={styles.summaryLabel}>Total Extra per Student:</Text>
                                    <Text style={styles.summaryValue}>₹{totalExtra.toLocaleString()}</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={{ flex: 1 }}>
                                <View style={styles.filterBar}>
                                    <TextInput 
                                        style={[styles.miniInput, { flex: 2 }]} 
                                        placeholder="Search..." 
                                        placeholderTextColor={theme.textLight}
                                        value={searchTerm}
                                        onChangeText={setSearchTerm}
                                    />
                                    <TextInput 
                                        style={styles.miniInput} 
                                        placeholder="Class" 
                                        placeholderTextColor={theme.textLight}
                                        value={classFilter}
                                        onChangeText={setClassFilter}
                                    />
                                    <TextInput 
                                        style={styles.miniInput} 
                                        placeholder="Sec" 
                                        placeholderTextColor={theme.textLight}
                                        value={sectionFilter}
                                        onChangeText={setSectionFilter}
                                    />
                                </View>

                                <View style={styles.selectionActions}>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity style={styles.actionBtn} onPress={selectAllVisible}>
                                            <Text style={styles.actionBtnText}>Select All</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionBtn} onPress={clearVisible}>
                                            <Text style={styles.actionBtnText}>Clear</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <Text style={styles.selectionCount}>{selectedStudentIds.length} Selected</Text>
                                </View>

                                <FlatList 
                                    data={filteredStudents}
                                    keyExtractor={(item) => item.id.toString()}
                                    renderItem={({ item }) => {
                                        const isSelected = selectedStudentIds.includes(item.id);
                                        return (
                                            <TouchableOpacity 
                                                style={[styles.studentCard, isSelected && styles.selectedCard]}
                                                onPress={() => toggleStudent(item.id)}
                                            >
                                                <View style={styles.studentAvatar}>
                                                    <Text style={styles.studentAvatarText}>{item.name?.charAt(0)}</Text>
                                                </View>
                                                <View style={styles.studentInfo}>
                                                    <Text style={styles.studentName}>{item.name}</Text>
                                                    <Text style={styles.studentMeta}>Class {item.class}-{item.section} | Roll: {item.roll_no}</Text>
                                                </View>
                                                <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                                                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }}
                                    ListEmptyComponent={<Text style={{ textAlign: 'center', color: theme.textLight, marginTop: 20 }}>No students found</Text>}
                                />
                            </View>
                        )}
                    </View>

                    <View style={styles.footer}>
                        {step === 1 ? (
                            <TouchableOpacity 
                                style={[styles.nextBtn, (charges.some(c => !c.reason || !c.amount)) && { opacity: 0.5 }]} 
                                onPress={() => !charges.some(c => !c.reason || !c.amount) && setStep(2)}
                            >
                                <Text style={styles.nextBtnText}>Next: Select Students</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                                    <Text style={styles.backBtnText}>Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.nextBtn, (selectedStudentIds.length === 0 || processing) && { opacity: 0.5 }]} 
                                    onPress={handleConfirm}
                                    disabled={processing || selectedStudentIds.length === 0}
                                >
                                    {processing ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.nextBtnText}>Confirm & Add</Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
