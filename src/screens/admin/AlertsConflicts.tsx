import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet, Alert,
    Modal, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useConflicts, useSchedules, useRooms } from '../../hooks/useSupabase';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../config/supabase';
import { sendToGemini } from '../../services/optibotService';
import { AnimatedPressable } from '../../components/AnimatedPressable';

interface DetectedConflict {
    id: string;
    type: 'room' | 'teacher' | 'unassigned' | 'capacity';
    priority: 'high' | 'medium' | 'low';
    title: string;
    desc: string;
    time: string;
    source: 'db' | 'detected';
    dbConflictId?: string;
    scheduleAId?: string;
    scheduleBId?: string;
    // Extra data for resolution
    roomId?: string;
    teacherId?: string;
    dayOfWeek?: string;
    startTime?: string;
    endTime?: string;
}

const AlertsConflicts: React.FC = () => {
    const { profile } = useAuth();
    const { conflicts: dbConflicts, loading: conflictsLoading, resolveConflict, refetch: refetchConflicts } = useConflicts(false);
    const { schedules, loading: schedulesLoading, refetch: refetchSchedules } = useSchedules({ status: 'published' });
    const { rooms } = useRooms();
    const [activeFilter, setActiveFilter] = useState('All Alerts');
    const filters = ['All Alerts', 'Room Conflicts', 'Teacher Overlaps', 'Unassigned'];
    const [resolving, setResolving] = useState<string | null>(null);
    const [showResolutionModal, setShowResolutionModal] = useState(false);
    const [resolutionDetails, setResolutionDetails] = useState<{
        conflictId: string;
        title: string;
        suggestion: string;
        action: string;
        newRoomId?: string;
        newRoomName?: string;
        scheduleId?: string;
    } | null>(null);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    // Build alerts from DB conflicts + live detection from schedules
    const alerts = useMemo<DetectedConflict[]>(() => {
        const result: DetectedConflict[] = [];

        // 1. Add DB-stored conflicts
        dbConflicts.forEach(c => {
            const typeMap: Record<string, 'room' | 'teacher' | 'unassigned' | 'capacity'> = {
                room_conflict: 'room',
                teacher_overlap: 'teacher',
                capacity_exceeded: 'capacity',
                unassigned: 'unassigned'
            };
            result.push({
                id: `db-${c.id}`,
                type: typeMap[c.type] || 'room',
                priority: c.severity,
                title: c.title,
                desc: c.description,
                time: getTimeAgo(c.created_at),
                source: 'db',
                dbConflictId: c.id,
                scheduleAId: c.schedule_a_id || undefined,
                scheduleBId: c.schedule_b_id || undefined
            });
        });

        // 2. Detect live room conflicts from schedules
        const roomTimeMap = new Map<string, typeof schedules>();
        schedules.forEach(s => {
            const key = `${s.room_id}-${s.day_of_week}-${s.start_time}`;
            if (!roomTimeMap.has(key)) roomTimeMap.set(key, []);
            roomTimeMap.get(key)!.push(s);
        });

        roomTimeMap.forEach((group, key) => {
            if (group.length > 1) {
                const dedupId = `live-room-${key}`;
                if (!result.find(r => r.id === dedupId)) {
                    const roomName = group[0].room?.name || 'Unknown Room';
                    const subjects = group.map(s => s.subject?.name || 'Unknown').join(' and ');
                    result.push({
                        id: dedupId,
                        type: 'room',
                        priority: 'high',
                        title: `Room Conflict: ${roomName}`,
                        desc: `Double booking: ${subjects} at ${formatTime(group[0].start_time)} on ${group[0].day_of_week}.`,
                        time: 'Live',
                        source: 'detected',
                        roomId: group[0].room_id,
                        dayOfWeek: group[0].day_of_week,
                        startTime: group[0].start_time,
                        endTime: group[0].end_time,
                        scheduleAId: group[0].id,
                        scheduleBId: group[1].id
                    });
                }
            }
        });

        // 3. Detect teacher overlaps (same teacher, same day, overlapping times)
        const teacherDayMap = new Map<string, typeof schedules>();
        schedules.forEach(s => {
            if (!s.teacher_id) return;
            const key = `${s.teacher_id}-${s.day_of_week}`;
            if (!teacherDayMap.has(key)) teacherDayMap.set(key, []);
            teacherDayMap.get(key)!.push(s);
        });

        teacherDayMap.forEach((group) => {
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    const a = group[i], b = group[j];
                    if (timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) {
                        const dedupId = `live-teacher-${a.id}-${b.id}`;
                        if (!result.find(r => r.id === dedupId)) {
                            const teacherName = a.teacher?.profile?.full_name || 'Teacher';
                            result.push({
                                id: dedupId,
                                type: 'teacher',
                                priority: 'medium',
                                title: `Teacher Overlap: ${teacherName}`,
                                desc: `${a.subject?.name || 'Subject'} and ${b.subject?.name || 'Subject'} overlap on ${a.day_of_week} (${formatTime(a.start_time)}-${formatTime(a.end_time)} vs ${formatTime(b.start_time)}-${formatTime(b.end_time)}).`,
                                time: 'Live',
                                source: 'detected',
                                teacherId: a.teacher_id,
                                scheduleAId: a.id,
                                scheduleBId: b.id
                            });
                        }
                    }
                }
            }
        });

        // 4. Detect capacity issues
        schedules.forEach(s => {
            if (s.room && s.section) {
                const roomCap = s.room.capacity || 0;
                const sectionSize = (s.section as any)?.student_count || (s.section as any)?.max_students || 0;
                if (sectionSize > roomCap && roomCap > 0) {
                    const dedupId = `live-cap-${s.id}`;
                    if (!result.find(r => r.id === dedupId)) {
                        result.push({
                            id: dedupId,
                            type: 'capacity',
                            priority: 'low',
                            title: `Capacity Warning: ${s.room.name}`,
                            desc: `${s.subject?.name || 'Subject'} has ${sectionSize} students but ${s.room.name} only fits ${roomCap}.`,
                            time: 'Live',
                            source: 'detected',
                            roomId: s.room_id,
                            scheduleAId: s.id
                        });
                    }
                }
            }
        });

        return result;
    }, [dbConflicts, schedules]);

    // Filter
    const filteredAlerts = alerts.filter(a => {
        if (dismissed.has(a.id)) return false;
        if (activeFilter === 'Room Conflicts') return a.type === 'room';
        if (activeFilter === 'Teacher Overlaps') return a.type === 'teacher';
        if (activeFilter === 'Unassigned') return a.type === 'unassigned';
        return true;
    });

    const criticalCount = filteredAlerts.filter(a => a.priority === 'high' || a.priority === 'medium').length;
    const warningCount = filteredAlerts.filter(a => a.priority === 'low').length;
    const isLoading = conflictsLoading || schedulesLoading;

    // AI Resolve: Analyze conflict and suggest a fix
    const handleAIResolve = async (alert: DetectedConflict) => {
        setResolving(alert.id);

        try {
            if (alert.type === 'room' && alert.scheduleBId) {
                // Find an available room for schedule B at the same day/time
                const scheduleB = schedules.find(s => s.id === alert.scheduleBId);
                if (!scheduleB) throw new Error('Schedule not found');

                const busyRoomIds = schedules
                    .filter(s => s.day_of_week === scheduleB.day_of_week && timesOverlap(s.start_time, s.end_time, scheduleB.start_time, scheduleB.end_time))
                    .map(s => s.room_id);

                const availableRooms = rooms.filter(r => !busyRoomIds.includes(r.id));

                if (availableRooms.length > 0) {
                    // Pick the best room (closest capacity match)
                    const sectionSize = (scheduleB.section as any)?.student_count || (scheduleB.section as any)?.max_students || 30;
                    const bestRoom = availableRooms.sort((a, b) => {
                        const diffA = Math.abs((a.capacity || 0) - sectionSize);
                        const diffB = Math.abs((b.capacity || 0) - sectionSize);
                        return diffA - diffB;
                    })[0];

                    setResolutionDetails({
                        conflictId: alert.id,
                        title: alert.title,
                        suggestion: `Move "${scheduleB.subject?.name || 'Subject'}" to ${bestRoom.name} (${bestRoom.building}, Floor ${bestRoom.floor}, Capacity: ${bestRoom.capacity}).`,
                        action: 'reassign_room',
                        newRoomId: bestRoom.id,
                        newRoomName: bestRoom.name,
                        scheduleId: scheduleB.id
                    });
                    setShowResolutionModal(true);
                } else {
                    Alert.alert('No Available Rooms', 'All rooms are occupied at this time slot. Consider rescheduling to a different day or time.');
                }
            } else if (alert.type === 'teacher' && alert.scheduleBId) {
                // For teacher overlaps, suggest moving schedule B to a different time
                const scheduleB = schedules.find(s => s.id === alert.scheduleBId);
                if (!scheduleB) throw new Error('Schedule not found');

                // Find a time slot where the teacher is free
                const teacherSchedules = schedules.filter(
                    s => s.teacher_id === scheduleB.teacher_id && s.day_of_week === scheduleB.day_of_week && s.id !== scheduleB.id
                );

                const busySlots = teacherSchedules.map(s => `${formatTime(s.start_time)}-${formatTime(s.end_time)}`).join(', ');

                setResolutionDetails({
                    conflictId: alert.id,
                    title: alert.title,
                    suggestion: `The teacher's busy slots on ${scheduleB.day_of_week}: ${busySlots || 'none'}.\n\nConsider moving "${scheduleB.subject?.name || 'Subject'}" (${formatTime(scheduleB.start_time)}-${formatTime(scheduleB.end_time)}) to a non-overlapping time, or assign a different teacher.`,
                    action: 'manual',
                    scheduleId: scheduleB.id
                });
                setShowResolutionModal(true);
            } else if (alert.type === 'capacity' && alert.scheduleAId) {
                // Find a bigger room
                const schedule = schedules.find(s => s.id === alert.scheduleAId);
                if (!schedule) throw new Error('Schedule not found');

                const sectionSize = (schedule.section as any)?.student_count || (schedule.section as any)?.max_students || 30;

                const busyRoomIds = schedules
                    .filter(s => s.day_of_week === schedule.day_of_week && timesOverlap(s.start_time, s.end_time, schedule.start_time, schedule.end_time))
                    .map(s => s.room_id);

                const biggerRooms = rooms
                    .filter(r => !busyRoomIds.includes(r.id) && (r.capacity || 0) >= sectionSize)
                    .sort((a, b) => (a.capacity || 0) - (b.capacity || 0));

                if (biggerRooms.length > 0) {
                    const bestRoom = biggerRooms[0];
                    setResolutionDetails({
                        conflictId: alert.id,
                        title: alert.title,
                        suggestion: `Move to ${bestRoom.name} (Capacity: ${bestRoom.capacity}, ${bestRoom.building} Floor ${bestRoom.floor}).`,
                        action: 'reassign_room',
                        newRoomId: bestRoom.id,
                        newRoomName: bestRoom.name,
                        scheduleId: schedule.id
                    });
                    setShowResolutionModal(true);
                } else {
                    Alert.alert('No Larger Rooms', `No available rooms with capacity ≥ ${sectionSize} at this time slot.`);
                }
            } else {
                // Use Gemini AI for complex or unhandled conflict types
                try {
                    const conflictContext = `Conflict Type: ${alert.type}\nTitle: ${alert.title}\nDescription: ${alert.desc}\nTime: ${alert.time}\nDay: ${alert.dayOfWeek || 'N/A'}`;
                    const prompt = `As a schedule conflict resolver, analyze this conflict and provide a specific resolution:\n\n${conflictContext}\n\nProvide: 1) What the problem is 2) A specific action to fix it 3) Why this fix works. Keep it concise (3-4 sentences).`;
                    const aiSuggestion = await sendToGemini(prompt, [], { full_name: 'Admin', role: 'admin' });
                    setResolutionDetails({
                        conflictId: alert.id,
                        title: alert.title,
                        suggestion: `AI Analysis:\n\n${aiSuggestion}`,
                        action: 'manual',
                        scheduleId: alert.scheduleAId || undefined,
                    });
                    setShowResolutionModal(true);
                } catch {
                    Alert.alert('AI Analysis', 'This conflict requires manual resolution. Please update the schedule directly.');
                }
            }
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to analyze conflict.');
        } finally {
            setResolving(null);
        }
    };

    // Apply the AI suggestion
    const applyResolution = async () => {
        if (!resolutionDetails) return;
        setResolving(resolutionDetails.conflictId);

        try {
            if (resolutionDetails.action === 'reassign_room' && resolutionDetails.newRoomId && resolutionDetails.scheduleId) {
                // Update the schedule's room
                const { error } = await supabase
                    .from('schedules')
                    .update({ room_id: resolutionDetails.newRoomId })
                    .eq('id', resolutionDetails.scheduleId);

                if (error) throw error;

                // If there's a DB conflict record, mark it resolved
                const alert = alerts.find(a => a.id === resolutionDetails.conflictId);
                if (alert?.dbConflictId && profile?.id) {
                    await resolveConflict(alert.dbConflictId, profile.id);
                }

                // Dismiss the alert and refresh data
                setDismissed(prev => new Set([...prev, resolutionDetails.conflictId]));
                refetchSchedules();
                refetchConflicts();

                Alert.alert('Resolved', `Schedule moved to ${resolutionDetails.newRoomName}.`);
            } else {
                // For manual resolutions, just mark as dismissed
                const alert = alerts.find(a => a.id === resolutionDetails.conflictId);
                if (alert?.dbConflictId && profile?.id) {
                    await resolveConflict(alert.dbConflictId, profile.id);
                }
                setDismissed(prev => new Set([...prev, resolutionDetails.conflictId]));
                Alert.alert('Noted', 'Conflict acknowledged. Please update the schedule manually.');
            }
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to apply fix.');
        } finally {
            setResolving(null);
            setShowResolutionModal(false);
            setResolutionDetails(null);
        }
    };

    const handleIgnore = (id: string) => {
        Alert.alert('Ignore Alert?', 'This alert will be dismissed until the next refresh.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Ignore', style: 'destructive', onPress: async () => {
                    const alert = alerts.find(a => a.id === id);
                    if (alert?.dbConflictId && profile?.id) {
                        await resolveConflict(alert.dbConflictId, profile.id);
                    }
                    setDismissed(prev => new Set([...prev, id]));
                }
            },
        ]);
    };

    const handleRefresh = () => {
        setDismissed(new Set());
        refetchConflicts();
        refetchSchedules();
    };

    const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
        high: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'HIGH PRIORITY' },
        medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'MEDIUM PRIORITY' },
        low: { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', label: 'LOW PRIORITY' }
    };

    const typeIcons: Record<string, { icon: string; color: string }> = {
        room: { icon: 'meeting-room', color: '#ef4444' },
        teacher: { icon: 'directions-run', color: '#f59e0b' },
        unassigned: { icon: 'domain-disabled', color: '#94a3b8' },
        capacity: { icon: 'groups', color: '#94a3b8' }
    };

    const renderAlertCard = (alert: DetectedConflict) => {
        const pCfg = priorityConfig[alert.priority];
        const tCfg = typeIcons[alert.type];
        const isResolving = resolving === alert.id;

        return (
            <View key={alert.id} style={styles.alertCard}>
                <View style={[styles.alertStripe, { backgroundColor: pCfg.color }]} />
                <View style={styles.alertContent}>
                    <View style={styles.alertTop}>
                        <View style={styles.alertTopLeft}>
                            <View style={styles.alertMeta}>
                                <View style={[styles.priorityBadge, { backgroundColor: pCfg.bg }]}>
                                    <Text style={[styles.priorityText, { color: pCfg.color }]}>{pCfg.label}</Text>
                                </View>
                                <Text style={styles.alertTime}>{alert.time}</Text>
                                {alert.source === 'detected' && (
                                    <View style={{ backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                        <Text style={{ color: '#10b981', fontSize: 9, fontWeight: '600' }}>LIVE</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.alertTitle}>{alert.title}</Text>
                            <Text style={styles.alertDesc}>{alert.desc}</Text>
                        </View>
                        <View style={[styles.alertIcon, { backgroundColor: `${tCfg.color}15` }]}>
                            <MaterialIcons name={tCfg.icon as any} size={22} color={tCfg.color} />
                        </View>
                    </View>
                    <View style={styles.alertActions}>
                        <AnimatedPressable onPress={() => handleIgnore(alert.id)}>
                            <Text style={styles.ignoreBtn}>Ignore</Text>
                        </AnimatedPressable>
                        <AnimatedPressable
                            style={[styles.resolveBtn, isResolving && { opacity: 0.6 }]}
                            onPress={() => handleAIResolve(alert)}
                            disabled={isResolving}
                        >
                            {isResolving ? (
                                <ActivityIndicator size="small" color={Colors.white} />
                            ) : (
                                <>
                                    <MaterialIcons name="auto-fix-high" size={16} color={Colors.white} />
                                    <Text style={styles.resolveBtnText}>AI Resolve</Text>
                                </>
                            )}
                        </AnimatedPressable>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>⚠️ Alerts & Conflicts</Text>
                    <AnimatedPressable onPress={handleRefresh}>
                        <MaterialIcons name="refresh" size={24} color={Colors.slate400} />
                    </AnimatedPressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                    {filters.map(f => (
                        <AnimatedPressable key={f} style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                            onPress={() => setActiveFilter(f)}>
                            <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
                        </AnimatedPressable>
                    ))}
                </ScrollView>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {isLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={{ color: Colors.slate400, marginTop: 12 }}>Scanning for conflicts...</Text>
                    </View>
                ) : (
                    <>
                        {/* Critical Section */}
                        {criticalCount > 0 && (
                            <>
                                <View style={styles.sectionHeader}>
                                    <MaterialIcons name="error" size={24} color={Colors.error} />
                                    <Text style={styles.sectionTitle}>Critical Attention Needed</Text>
                                    <View style={styles.countBadge}>
                                        <Text style={styles.countBadgeText}>{criticalCount}</Text>
                                    </View>
                                </View>
                                {filteredAlerts.filter(a => a.priority !== 'low').map(renderAlertCard)}
                            </>
                        )}

                        {/* Warnings Section */}
                        {warningCount > 0 && (
                            <>
                                <View style={[styles.sectionHeader, { marginTop: 8 }]}>
                                    <MaterialIcons name="warning" size={24} color="#f59e0b" />
                                    <Text style={styles.sectionTitle}>Warnings</Text>
                                    <View style={[styles.countBadge, { backgroundColor: Colors.slate700 }]}>
                                        <Text style={[styles.countBadgeText, { color: Colors.slate300 }]}>{warningCount}</Text>
                                    </View>
                                </View>
                                {filteredAlerts.filter(a => a.priority === 'low').map(renderAlertCard)}
                            </>
                        )}

                        {filteredAlerts.length === 0 && (
                            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                                <MaterialIcons name="check-circle" size={56} color="#10b981" />
                                <Text style={{ color: '#10b981', fontSize: 18, fontWeight: '600', marginTop: 16 }}>All Clear!</Text>
                                <Text style={{ color: Colors.slate500, marginTop: 4 }}>No conflicts or alerts at this time.</Text>
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 32 }} />
            </ScrollView>

            {/* AI Resolution Modal */}
            <Modal visible={showResolutionModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                    <MaterialIcons name="auto-fix-high" size={20} color="#818cf8" />
                                </View>
                                <Text style={styles.modalTitle}>AI Resolution</Text>
                            </View>
                            <AnimatedPressable onPress={() => { setShowResolutionModal(false); setResolutionDetails(null); }}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        {resolutionDetails && (
                            <View>
                                <View style={{ backgroundColor: '#0f172a', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' }}>
                                    <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 }}>CONFLICT</Text>
                                    <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>{resolutionDetails.title}</Text>
                                </View>

                                <View style={{ backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                        <MaterialIcons name="lightbulb" size={16} color="#10b981" />
                                        <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '600', letterSpacing: 1 }}>SUGGESTED FIX</Text>
                                    </View>
                                    <Text style={{ color: Colors.white, fontSize: 14, lineHeight: 22 }}>{resolutionDetails.suggestion}</Text>
                                </View>

                                {resolutionDetails.action === 'reassign_room' ? (
                                    <AnimatedPressable
                                        style={[styles.applyBtn, resolving ? { opacity: 0.6 } : {}]}
                                        onPress={applyResolution}
                                        disabled={!!resolving}
                                    >
                                        {resolving ? (
                                            <ActivityIndicator color={Colors.white} />
                                        ) : (
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <MaterialIcons name="check-circle" size={18} color={Colors.white} />
                                                <Text style={styles.applyBtnText}>Apply Fix</Text>
                                            </View>
                                        )}
                                    </AnimatedPressable>
                                ) : (
                                    <AnimatedPressable
                                        style={[styles.applyBtn, { backgroundColor: '#f59e0b' }]}
                                        onPress={() => {
                                            applyResolution();
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <MaterialIcons name="done" size={18} color={Colors.white} />
                                            <Text style={styles.applyBtnText}>Acknowledge</Text>
                                        </View>
                                    </AnimatedPressable>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

// Helpers
function getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function formatTime(time: string | null): string {
    if (!time) return '--';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function timesOverlap(s1: string | null, e1: string | null, s2: string | null, e2: string | null): boolean {
    if (!s1 || !e1 || !s2 || !e2) return false;
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1);
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundDark },
    header: { backgroundColor: Colors.backgroundDark, borderBottomWidth: 1, borderBottomColor: Colors.borderDark },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimaryDark },
    filterRow: { paddingHorizontal: 16, paddingBottom: 16 },
    filterChip: { height: 32, paddingHorizontal: 16, borderRadius: 999, marginRight: 12, justifyContent: 'center', backgroundColor: Colors.surfaceDark, borderWidth: 1, borderColor: Colors.borderDark },
    filterChipActive: { backgroundColor: Colors.primary, borderColor: 'transparent' },
    filterChipText: { fontSize: 14, fontWeight: '500', color: Colors.slate400 },
    filterChipTextActive: { color: Colors.white },
    scrollView: { flex: 1, paddingHorizontal: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimaryDark, flex: 1 },
    countBadge: { height: 20, minWidth: 20, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
    countBadgeText: { fontSize: 12, fontWeight: '500', color: Colors.error },
    alertCard: { backgroundColor: Colors.surfaceDark, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.borderDark, overflow: 'hidden', flexDirection: 'row' },
    alertStripe: { width: 4 },
    alertContent: { flex: 1, padding: 16, gap: 16 },
    alertTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    alertTopLeft: { flex: 1 },
    alertMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    priorityText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    alertTime: { fontSize: 12, color: Colors.slate400 },
    alertTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimaryDark, marginBottom: 4 },
    alertDesc: { fontSize: 14, color: Colors.slate400, lineHeight: 20 },
    alertIcon: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    alertActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.borderDark },
    ignoreBtn: { color: Colors.slate400, fontSize: 14, fontWeight: '500', paddingHorizontal: 12, paddingVertical: 6 },
    resolveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, minWidth: 120, justifyContent: 'center' },
    resolveBtnText: { color: Colors.white, fontSize: 14, fontWeight: '500' },
    secondaryBtn: { backgroundColor: Colors.slate700, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
    secondaryBtnText: { color: Colors.textPrimaryDark, fontSize: 14, fontWeight: '500' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
    applyBtn: {
        backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 16,
        alignItems: 'center', marginTop: 8
    },
    applyBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' }
});

export default AlertsConflicts;
