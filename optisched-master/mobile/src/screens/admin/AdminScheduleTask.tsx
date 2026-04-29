import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    Alert, Modal, TextInput, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { AdminTask } from '../../types/database';
import { useAdminTasks } from '../../hooks/useSupabase';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const iconMap: Record<string, { iconName: string; iconBg: string; iconColor: string }> = {
    high: { iconName: 'meeting-room', iconBg: 'rgba(59,130,246,0.15)', iconColor: Colors.primary },
    medium: { iconName: 'fact-check', iconBg: 'rgba(16,185,129,0.15)', iconColor: '#10b981' },
    low: { iconName: 'publish', iconBg: 'rgba(168,85,247,0.15)', iconColor: '#a855f7' }
};

type SortMode = 'priority' | 'progress' | 'title';

const AdminScheduleTask: React.FC = () => {
    const [activeFilter, setActiveFilter] = useState('All Tasks');
    const [sortMode, setSortMode] = useState<SortMode>('priority');
    const filters = ['All Tasks', 'In Progress', 'Pending Review', 'Completed'];
    const { tasks: dbTasks, loading, updateTask, createTask, deleteTask } = useAdminTasks();

    // Add/Edit task modal
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
    const [modalTitle, setModalTitle] = useState('');
    const [modalDesc, setModalDesc] = useState('');
    const [modalPriority, setModalPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const [saving, setSaving] = useState(false);

    const handleSortBy = () => {
        const modes: SortMode[] = ['priority', 'progress', 'title'];
        const next = modes[(modes.indexOf(sortMode) + 1) % modes.length];
        setSortMode(next);
    };

    const tasks = useMemo(() => {
        let filtered = [...dbTasks];
        if (activeFilter === 'In Progress') filtered = dbTasks.filter(t => t.status === 'in_progress');
        else if (activeFilter === 'Pending Review') filtered = dbTasks.filter(t => t.status === 'pending');
        else if (activeFilter === 'Completed') filtered = dbTasks.filter(t => t.status === 'completed');

        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (sortMode === 'priority') filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        else if (sortMode === 'progress') filtered.sort((a, b) => b.progress - a.progress);
        else if (sortMode === 'title') filtered.sort((a, b) => a.title.localeCompare(b.title));

        return filtered.map(task => {
            const icons = iconMap[task.priority] || iconMap.low;
            const badgeLabel = task.priority === 'high' ? 'High Priority' : task.priority === 'medium' ? 'Medium' : 'Low';
            const badgeColor = task.priority === 'high' ? '#fb923c' : task.priority === 'medium' ? '#f59e0b' : Colors.slate400;
            return {
                ...task,
                ...icons,
                badgeLabel,
                badgeStyle: {
                    backgroundColor: task.priority === 'high' ? 'rgba(251,146,60,0.15)' : task.priority === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.15)',
                    color: badgeColor
                }
            };
        });
    }, [dbTasks, activeFilter, sortMode]);

    const progressColors: Record<string, string> = { high: Colors.primary, medium: '#10b981', low: '#a855f7' };

    // Mark Complete
    const handleMarkComplete = async (taskId: string, title: string) => {
        try {
            await updateTask(taskId, { status: 'completed', progress: 100 });
            Alert.alert('Done', `"${title}" marked as complete.`);
        } catch {
            Alert.alert('Error', 'Failed to update task.');
        }
    };

    // Delete Task
    const handleDeleteTask = (taskId: string, title: string) => {
        Alert.alert('Delete Task', `Are you sure you want to delete "${title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await deleteTask(taskId);
                        Alert.alert('Deleted', `"${title}" has been removed.`);
                    } catch {
                        Alert.alert('Error', 'Failed to delete task.');
                    }
                }
            },
        ]);
    };

    // Open Edit modal
    const handleEditTask = (task: AdminTask) => {
        setEditingTask(task);
        setModalTitle(task.title);
        setModalDesc(task.description);
        setModalPriority(task.priority);
        setShowModal(true);
    };

    // Open Add modal
    const handleOpenAdd = () => {
        setEditingTask(null);
        setModalTitle('');
        setModalDesc('');
        setModalPriority('medium');
        setShowModal(true);
    };

    // Three-dots action sheet
    const handleTaskAction = (task: AdminTask) => {
        Alert.alert(task.title, 'Choose an action:', [
            { text: 'Mark Complete', onPress: () => handleMarkComplete(task.id, task.title) },
            { text: 'Edit Task', onPress: () => handleEditTask(task) },
            { text: 'Delete', style: 'destructive', onPress: () => handleDeleteTask(task.id, task.title) },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    // Save (create or update)
    const handleSaveTask = async () => {
        if (!modalTitle.trim()) { Alert.alert('Error', 'Enter a task title.'); return; }
        setSaving(true);
        try {
            if (editingTask) {
                await updateTask(editingTask.id, {
                    title: modalTitle.trim(),
                    description: modalDesc.trim(),
                    priority: modalPriority
                });
                Alert.alert('Updated', `"${modalTitle.trim()}" has been updated.`);
            } else {
                await createTask({
                    title: modalTitle.trim(),
                    description: modalDesc.trim(),
                    priority: modalPriority
                });
                Alert.alert('Created', `Task "${modalTitle.trim()}" has been created.`);
            }
            setShowModal(false);
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to save task.');
        } finally {
            setSaving(false);
        }
    };

    const priorityBorderColors: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: Colors.primary };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>Admin Tasks</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <AnimatedPressable onPress={handleSortBy}>
                        <Text style={styles.sortBtn}>Sort: {sortMode}</Text>
                    </AnimatedPressable>
                    <AnimatedPressable onPress={handleOpenAdd}>
                        <MaterialIcons name="add-circle" size={24} color={Colors.primary} />
                    </AnimatedPressable>
                </View>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                    {filters.map(f => (
                        <AnimatedPressable key={f} style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                            onPress={() => setActiveFilter(f)}>
                            <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
                        </AnimatedPressable>
                    ))}
                </ScrollView>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>🔥 Active Priority</Text>
                    <Text style={styles.sectionCount}>{tasks.length} Tasks</Text>
                </View>

                {loading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={{ color: Colors.slate400, marginTop: 12 }}>Loading tasks...</Text>
                    </View>
                ) : tasks.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                        <MaterialIcons name="check-circle" size={48} color={Colors.slate600} />
                        <Text style={{ color: Colors.slate500, marginTop: 12 }}>No tasks in this category</Text>
                    </View>
                ) : tasks.map(task => (
                    <View key={task.id} style={styles.taskCard}>
                        <View style={styles.taskHeader}>
                            <View style={styles.taskHeaderLeft}>
                                <View style={[styles.taskIcon, { backgroundColor: task.iconBg }]}>
                                    <MaterialIcons name={task.iconName as keyof typeof MaterialIcons.glyphMap} size={24} color={task.iconColor} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.taskTitle}>{task.title}</Text>
                                    <Text style={styles.taskDescription}>{task.description}</Text>
                                </View>
                            </View>
                            <AnimatedPressable onPress={() => handleTaskAction(task)}>
                                <MaterialIcons name="more-vert" size={20} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        <View style={styles.progressSection}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.progressLabel}>Progress</Text>
                                <Text style={[styles.progressValue, { color: progressColors[task.priority] }]}>{task.progress}%</Text>
                            </View>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${task.progress}%`, backgroundColor: progressColors[task.priority] }]} />
                            </View>
                        </View>

                        <View style={styles.taskFooter}>
                            {task.status !== 'completed' ? (
                                <AnimatedPressable style={styles.completeSmall} onPress={() => handleMarkComplete(task.id, task.title)}>
                                    <MaterialIcons name="check" size={14} color="#10b981" />
                                    <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '600' }}>Complete</Text>
                                </AnimatedPressable>
                            ) : (
                                <View style={[styles.completeSmall, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                                    <MaterialIcons name="check-circle" size={14} color="#10b981" />
                                    <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '600' }}>Done</Text>
                                </View>
                            )}
                            <View style={[styles.taskBadge, { backgroundColor: task.badgeStyle.backgroundColor as string }]}>
                                <MaterialIcons name="flag" size={12} color={task.badgeStyle.color as string} />
                                <Text style={[styles.taskBadgeText, { color: task.badgeStyle.color as string }]}>{task.badgeLabel}</Text>
                            </View>
                        </View>
                    </View>
                ))}

                <View style={{ height: 32 }} />
            </ScrollView>

            {/* Add/Edit Task Modal */}
            <Modal visible={showModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingTask ? 'Edit Task' : 'New Admin Task'}</Text>
                            <AnimatedPressable onPress={() => setShowModal(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>
                        <Text style={styles.fieldLabel}>TASK TITLE</Text>
                        <TextInput style={styles.modalInput} value={modalTitle} onChangeText={setModalTitle}
                            placeholder="e.g. Finalize Room Assignments" placeholderTextColor="#6b7280" />
                        <Text style={styles.fieldLabel}>DESCRIPTION</Text>
                        <TextInput style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                            value={modalDesc} onChangeText={setModalDesc}
                            placeholder="Task details..." placeholderTextColor="#6b7280" multiline />
                        <Text style={styles.fieldLabel}>PRIORITY</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                            {(['high', 'medium', 'low'] as const).map(p => (
                                <AnimatedPressable key={p} onPress={() => setModalPriority(p)}
                                    style={{
                                        flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1,
                                        borderColor: modalPriority === p ? priorityBorderColors[p] : '#334155',
                                        backgroundColor: modalPriority === p ? 'rgba(59,130,246,0.1)' : 'transparent'
                                    }}>
                                    <Text style={{ fontSize: 12, fontWeight: '500', color: modalPriority === p ? Colors.white : Colors.slate400 }}>
                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </Text>
                                </AnimatedPressable>
                            ))}
                        </View>
                        <AnimatedPressable style={[styles.modalBtn, saving && { opacity: 0.6 }]} onPress={handleSaveTask} disabled={saving}>
                            {saving ? <ActivityIndicator color={Colors.white} /> : (
                                <Text style={styles.modalBtnText}>{editingTask ? 'Save Changes' : 'Create Task'}</Text>
                            )}
                        </AnimatedPressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundDark },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, paddingTop: 24, backgroundColor: '#18202f',
        borderBottomWidth: 1, borderBottomColor: Colors.borderDark
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimaryDark },
    sortBtn: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
    scrollView: { flex: 1, padding: 16 },
    filterRow: { marginBottom: 24 },
    filterChip: {
        height: 36, paddingHorizontal: 16, borderRadius: 999, marginRight: 8,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: Colors.surfaceDark, borderWidth: 1, borderColor: Colors.borderDark
    },
    filterChipActive: { backgroundColor: Colors.primary, borderColor: 'transparent' },
    filterChipText: { fontSize: 14, fontWeight: '500', color: Colors.slate400 },
    filterChipTextActive: { color: Colors.white },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimaryDark },
    sectionCount: { fontSize: 12, fontWeight: '500', color: Colors.slate400 },
    taskCard: {
        backgroundColor: '#18202f', borderRadius: 12, padding: 16, marginBottom: 16,
        borderWidth: 1, borderColor: Colors.borderDark
    },
    taskHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    taskHeaderLeft: { flexDirection: 'row', gap: 12, flex: 1 },
    taskIcon: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    taskTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimaryDark, marginBottom: 2 },
    taskDescription: { fontSize: 12, color: Colors.slate400 },
    progressSection: { marginBottom: 12 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    progressLabel: { fontSize: 12, fontWeight: '500', color: Colors.slate400 },
    progressValue: { fontSize: 12, fontWeight: '700' },
    progressBar: { height: 8, backgroundColor: Colors.slate700, borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },
    taskFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(51,65,85,0.5)'
    },
    completeSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(16,185,129,0.1)' },
    taskBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    taskBadgeText: { fontSize: 12, fontWeight: '600' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
    fieldLabel: { fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6, marginTop: 12 },
    modalInput: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14 },
    modalBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
    modalBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' }
});

export default AdminScheduleTask;
