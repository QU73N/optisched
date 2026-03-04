import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
    View, Text, ScrollView,  StyleSheet, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { AnimatedPressable } from '../../components/AnimatedPressable';
// Slider is built with custom View components below

const ConstraintSettings: React.FC = () => {
    const [blockRestDays, setBlockRestDays] = useState(true);
    const [forceLunch, setForceLunch] = useState(true);
    const [maxConsecutive, setMaxConsecutive] = useState(4);
    const [labCap, setLabCap] = useState('40');
    const [lectureCap, setLectureCap] = useState('50');
    const [overflowAllowed, setOverflowAllowed] = useState(false);

    const subjectConstraints = [
        { icon: 'science', label: 'Science Subjects', rule: 'Must use Laboratory Rooms', color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
        { icon: 'sports-basketball', label: 'PE Classes', rule: 'Requires Gymnasium / Court', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
        { icon: 'devices', label: 'IT Electives', rule: 'Specific Rooms: Mac Lab', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <AnimatedPressable style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
                </AnimatedPressable>
                <View style={styles.headerText}>
                    <Text style={styles.headerTitle}>Constraint Settings</Text>
                    <Text style={styles.headerSubtitle}>Manage scheduling rules & limits</Text>
                </View>
                <AnimatedPressable>
                    <Text style={styles.saveBtn}>Save</Text>
                </AnimatedPressable>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Info Banner */}
                <View style={styles.infoBanner}>
                    <MaterialIcons name="info" size={20} color="#3b82f6" />
                    <Text style={styles.infoText}>
                        Adjusting these constraints will trigger a recalculation of the conflict matrix for the current semester.
                    </Text>
                </View>

                {/* Faculty Availability */}
                <Text style={styles.sectionLabel}>FACULTY AVAILABILITY</Text>
                <View style={styles.card}>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleLeft}>
                            <View style={[styles.toggleIcon, { backgroundColor: 'rgba(129,140,248,0.15)' }]}>
                                <MaterialIcons name="person-off" size={22} color="#818cf8" />
                            </View>
                            <View>
                                <Text style={styles.toggleLabel}>Block Rest Days</Text>
                                <Text style={styles.toggleDesc}>Respect teacher's off days</Text>
                            </View>
                        </View>
                        <Switch value={blockRestDays} onValueChange={setBlockRestDays} trackColor={{ false: '#334155', true: Colors.primary }} thumbColor={Colors.white} />
                    </View>

                    <View style={styles.toggleRow}>
                        <View style={styles.toggleLeft}>
                            <View style={[styles.toggleIcon, { backgroundColor: 'rgba(244,114,182,0.15)' }]}>
                                <MaterialIcons name="lunch-dining" size={22} color="#f472b6" />
                            </View>
                            <View>
                                <Text style={styles.toggleLabel}>Force Lunch Break</Text>
                                <Text style={styles.toggleDesc}>12:00 PM - 1:00 PM blocked</Text>
                            </View>
                        </View>
                        <Switch value={forceLunch} onValueChange={setForceLunch} trackColor={{ false: '#334155', true: Colors.primary }} thumbColor={Colors.white} />
                    </View>

                    <View style={styles.sliderSection}>
                        <View style={styles.sliderHeader}>
                            <Text style={styles.toggleLabel}>Max Consecutive Hours</Text>
                            <View style={styles.sliderBadge}>
                                <Text style={styles.sliderBadgeText}>{maxConsecutive} hrs</Text>
                            </View>
                        </View>
                        <View style={styles.sliderTrack}>
                            <View style={[styles.sliderFill, { width: `${((maxConsecutive - 1) / 7) * 100}%` }]} />
                        </View>
                        <View style={styles.sliderLabels}>
                            <Text style={styles.sliderLabel}>1 hr</Text>
                            <Text style={styles.sliderLabel}>8 hrs</Text>
                        </View>
                    </View>
                </View>

                {/* Room Capacity */}
                <Text style={styles.sectionLabel}>ROOM CAPACITY & UTILIZATION</Text>
                <View style={styles.card}>
                    <View style={styles.capacityGrid}>
                        <View style={styles.capacityInput}>
                            <Text style={styles.capacityLabel}>STANDARD LAB CAP.</Text>
                            <View style={styles.capacityValueRow}>
                                <MaterialIcons name="computer" size={18} color={Colors.slate500} />
                                <Text style={styles.capacityValue}>{labCap}</Text>
                            </View>
                        </View>
                        <View style={styles.capacityInput}>
                            <Text style={styles.capacityLabel}>STANDARD LECTURE CAP.</Text>
                            <View style={styles.capacityValueRow}>
                                <MaterialIcons name="event-seat" size={18} color={Colors.slate500} />
                                <Text style={styles.capacityValue}>{lectureCap}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.toggleRow, { borderTopWidth: 1, borderTopColor: 'rgba(51,65,85,0.5)', paddingTop: 16 }]}>
                        <View style={styles.toggleLeft}>
                            <View style={[styles.toggleIcon, { backgroundColor: 'rgba(45,212,191,0.15)' }]}>
                                <MaterialIcons name="group-add" size={22} color="#2dd4bf" />
                            </View>
                            <View>
                                <Text style={styles.toggleLabel}>Overflow Allowance</Text>
                                <Text style={styles.toggleDesc}>Allow 10% capacity surge</Text>
                            </View>
                        </View>
                        <Switch value={overflowAllowed} onValueChange={setOverflowAllowed} trackColor={{ false: '#334155', true: Colors.primary }} thumbColor={Colors.white} />
                    </View>
                </View>

                {/* Subject Constraints */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>SUBJECT CONSTRAINTS</Text>
                    <AnimatedPressable style={styles.addRuleBtn}>
                        <MaterialIcons name="add" size={14} color={Colors.primary} />
                        <Text style={styles.addRuleText}>Add Rule</Text>
                    </AnimatedPressable>
                </View>
                <View style={styles.constraintList}>
                    {subjectConstraints.map((item, index) => (
                        <AnimatedPressable
                            key={index}
                            style={[styles.constraintItem, index < subjectConstraints.length - 1 && styles.constraintBorder]}
                            activeOpacity={0.6}
                        >
                            <View style={styles.constraintLeft}>
                                <View style={[styles.constraintIcon, { backgroundColor: item.bg }]}>
                                    <MaterialIcons name={item.icon as keyof typeof MaterialIcons.glyphMap} size={18} color={item.color} />
                                </View>
                                <View>
                                    <Text style={styles.constraintLabel}>{item.label}</Text>
                                    <View style={styles.constraintRuleRow}>
                                        <MaterialIcons name="arrow-right-alt" size={10} color={Colors.slate400} />
                                        <Text style={styles.constraintRule}>{item.rule}</Text>
                                    </View>
                                </View>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color={Colors.slate600} />
                        </AnimatedPressable>
                    ))}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: Colors.borderDark },
    backBtn: { padding: 8, marginLeft: -8, borderRadius: 999 },
    headerText: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#fbbf24' },
    headerSubtitle: { fontSize: 12, color: Colors.textSecondaryDark },
    saveBtn: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
    scrollView: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

    infoBanner: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 12,
        backgroundColor: 'rgba(30,58,138,0.2)', borderWidth: 1, borderColor: 'rgba(30,58,138,0.5)',
        marginBottom: 24 },
    infoText: { flex: 1, fontSize: 13, color: 'rgba(191,219,254,0.8)', lineHeight: 18 },

    sectionLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondaryDark, letterSpacing: 1.5, marginBottom: 12, paddingLeft: 4 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, paddingLeft: 4 },
    addRuleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addRuleText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

    card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 24, gap: 24 },

    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    toggleIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    toggleLabel: { fontSize: 14, fontWeight: '500', color: Colors.textPrimaryDark },
    toggleDesc: { fontSize: 12, color: Colors.textSecondaryDark, marginTop: 2 },

    sliderSection: { paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(51,65,85,0.5)' },
    sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sliderBadge: { backgroundColor: Colors.slate700, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    sliderBadgeText: { color: Colors.white, fontSize: 12 },
    sliderTrack: { height: 8, backgroundColor: '#0f172a', borderRadius: 4, overflow: 'hidden' },
    sliderFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
    sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    sliderLabel: { fontSize: 10, color: Colors.textSecondaryDark },

    capacityGrid: { flexDirection: 'row', gap: 16 },
    capacityInput: { flex: 1, backgroundColor: '#0f172a', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)' },
    capacityLabel: { fontSize: 10, color: Colors.textSecondaryDark, letterSpacing: 0.5, marginBottom: 4 },
    capacityValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    capacityValue: { color: Colors.white, fontSize: 14, fontWeight: '600' },

    constraintList: { backgroundColor: '#1e293b', borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
    constraintItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    constraintBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.5)' },
    constraintLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
    constraintIcon: { padding: 6, borderRadius: 8, marginTop: 4 },
    constraintLabel: { fontSize: 14, fontWeight: '600', color: Colors.white },
    constraintRuleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    constraintRule: { fontSize: 12, color: Colors.textSecondaryDark } });

export default ConstraintSettings;
