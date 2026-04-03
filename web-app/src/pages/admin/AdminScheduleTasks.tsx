import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
    ClipboardList, Plus, Flag, CheckCircle, Clock, Loader2,
    MoreVertical, Trash2, Edit3, X, ArrowUpDown
} from 'lucide-react';

interface AdminTask {
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    status: 'pending' | 'in_progress' | 'completed';
    progress: number;
    created_at: string;
}

const AdminScheduleTasks: React.FC = () => {
    useAuth();
    const [tasks, setTasks] = useState<AdminTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('All Tasks');
    const [sortMode, setSortMode] = useState<'priority' | 'progress' | 'title'>('priority');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
    const [modalTitle, setModalTitle] = useState('');
    const [modalDesc, setModalDesc] = useState('');
    const [modalPriority, setModalPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const [saving, setSaving] = useState(false);
    const [actionMenuId, setActionMenuId] = useState<string | null>(null);

    const fetchTasks = async () => {
        try {
            const { data } = await supabase.from('admin_tasks').select('*').order('created_at', { ascending: false });
            setTasks((data || []) as AdminTask[]);
        } catch { /* ignore */ }
        setLoading(false);
    };

    React.useEffect(() => {
        fetchTasks();
        const channel = supabase
            .channel('admin-tasks-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_tasks' }, () => fetchTasks())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const filters = ['All Tasks', 'In Progress', 'Pending', 'Completed'];

    const filteredTasks = useMemo(() => {
        let result = [...tasks];
        if (activeFilter === 'In Progress') result = tasks.filter(t => t.status === 'in_progress');
        else if (activeFilter === 'Pending') result = tasks.filter(t => t.status === 'pending');
        else if (activeFilter === 'Completed') result = tasks.filter(t => t.status === 'completed');

        const prio = { high: 0, medium: 1, low: 2 };
        if (sortMode === 'priority') result.sort((a, b) => prio[a.priority] - prio[b.priority]);
        else if (sortMode === 'progress') result.sort((a, b) => b.progress - a.progress);
        else result.sort((a, b) => a.title.localeCompare(b.title));

        return result;
    }, [tasks, activeFilter, sortMode]);

    const handleSave = async () => {
        if (!modalTitle.trim()) return;
        setSaving(true);
        try {
            if (editingTask) {
                await supabase.from('admin_tasks').update({
                    title: modalTitle.trim(), description: modalDesc.trim(), priority: modalPriority
                }).eq('id', editingTask.id);
            } else {
                await supabase.from('admin_tasks').insert({
                    title: modalTitle.trim(), description: modalDesc.trim(),
                    priority: modalPriority, status: 'pending', progress: 0
                });
            }
            setShowModal(false);
            fetchTasks();
        } catch (err: any) {
            window.alert('Error: ' + err.message);
        } finally { setSaving(false); }
    };

    const handleComplete = async (task: AdminTask) => {
        await supabase.from('admin_tasks').update({ status: 'completed', progress: 100 }).eq('id', task.id);
        fetchTasks();
        setActionMenuId(null);
    };

    const handleDelete = async (task: AdminTask) => {
        if (!window.confirm(`Delete "${task.title}"?`)) return;
        await supabase.from('admin_tasks').delete().eq('id', task.id);
        fetchTasks();
        setActionMenuId(null);
    };

    const openEdit = (task: AdminTask) => {
        setEditingTask(task);
        setModalTitle(task.title);
        setModalDesc(task.description);
        setModalPriority(task.priority);
        setShowModal(true);
        setActionMenuId(null);
    };

    const openAdd = () => {
        setEditingTask(null);
        setModalTitle('');
        setModalDesc('');
        setModalPriority('medium');
        setShowModal(true);
    };

    const cycleSortMode = () => {
        const modes: typeof sortMode[] = ['priority', 'progress', 'title'];
        setSortMode(modes[(modes.indexOf(sortMode) + 1) % modes.length]);
    };

    const prioColors = {
        high: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', badge: 'High' },
        medium: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', badge: 'Medium' },
        low: { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', badge: 'Low' },
    };

    const progressColor = { high: '#3b82f6', medium: '#10b981', low: '#a855f7' };

    return (
        <div className="admin-tasks-page">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1><ClipboardList size={24} /> Admin Tasks</h1>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button className="sort-btn" onClick={cycleSortMode}>
                        <ArrowUpDown size={14} /> Sort: {sortMode}
                    </button>
                    <button className="add-btn" onClick={openAdd}>
                        <Plus size={16} /> New Task
                    </button>
                </div>
            </div>

            {/* Filter chips */}
            <div className="filter-chips">
                {filters.map(f => (
                    <button key={f} className={`filter-chip ${activeFilter === f ? 'active' : ''}`}
                        onClick={() => setActiveFilter(f)}>{f}</button>
                ))}
            </div>

            {/* Task count */}
            <div className="section-header">
                <span className="section-title">Active Priority</span>
                <span className="section-count">{filteredTasks.length} Tasks</span>
            </div>

            {/* Tasks */}
            {loading ? (
                <div className="loading-state"><Loader2 size={32} className="spin" /> <p>Loading tasks...</p></div>
            ) : filteredTasks.length === 0 ? (
                <div className="empty-state">
                    <CheckCircle size={48} />
                    <p>No tasks in this category</p>
                </div>
            ) : (
                <div className="tasks-grid">
                    {filteredTasks.map(task => {
                        const prio = prioColors[task.priority];
                        return (
                            <div key={task.id} className="task-card glass-panel">
                                <div className="task-card-header">
                                    <div className="task-card-left">
                                        <div className="task-icon" style={{ background: prio.bg }}>
                                            <Flag size={18} color={prio.text} />
                                        </div>
                                        <div>
                                            <h3 className="task-title">{task.title}</h3>
                                            <p className="task-desc">{task.description}</p>
                                        </div>
                                    </div>
                                    <div className="task-actions-wrap">
                                        <button className="action-trigger" onClick={() => setActionMenuId(actionMenuId === task.id ? null : task.id)}>
                                            <MoreVertical size={16} />
                                        </button>
                                        {actionMenuId === task.id && (
                                            <div className="action-menu">
                                                {task.status !== 'completed' && (
                                                    <button onClick={() => handleComplete(task)}><CheckCircle size={14} /> Complete</button>
                                                )}
                                                <button onClick={() => openEdit(task)}><Edit3 size={14} /> Edit</button>
                                                <button className="danger" onClick={() => handleDelete(task)}><Trash2 size={14} /> Delete</button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Progress */}
                                <div className="task-progress">
                                    <div className="progress-header">
                                        <span>Progress</span>
                                        <span style={{ color: progressColor[task.priority], fontWeight: 700 }}>{task.progress}%</span>
                                    </div>
                                    <div className="progress-track">
                                        <div className="progress-fill" style={{ width: `${task.progress}%`, background: progressColor[task.priority] }} />
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="task-footer">
                                    {task.status === 'completed' ? (
                                        <span className="status-chip done"><CheckCircle size={12} /> Done</span>
                                    ) : (
                                        <span className="status-chip in-progress"><Clock size={12} /> {task.status === 'in_progress' ? 'In Progress' : 'Pending'}</span>
                                    )}
                                    <span className="prio-chip" style={{ background: prio.bg, color: prio.text }}>
                                        <Flag size={10} /> {prio.badge}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingTask ? 'Edit Task' : 'New Admin Task'}</h2>
                            <button onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <div className="form-group">
                            <label>TASK TITLE</label>
                            <input value={modalTitle} onChange={e => setModalTitle(e.target.value)} placeholder="e.g. Finalize Room Assignments" />
                        </div>
                        <div className="form-group">
                            <label>DESCRIPTION</label>
                            <textarea value={modalDesc} onChange={e => setModalDesc(e.target.value)} placeholder="Task details..." rows={3} />
                        </div>
                        <div className="form-group">
                            <label>PRIORITY</label>
                            <div className="prio-selector">
                                {(['high', 'medium', 'low'] as const).map(p => (
                                    <button key={p} className={`prio-btn ${modalPriority === p ? 'active' : ''}`}
                                        style={{ borderColor: modalPriority === p ? prioColors[p].text : '' }}
                                        onClick={() => setModalPriority(p)}>
                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button className="save-modal-btn" onClick={handleSave} disabled={saving}>
                            {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : editingTask ? 'Save Changes' : 'Create Task'}
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .admin-tasks-page { display: flex; flex-direction: column; gap: 1.25rem; }
                .sort-btn { display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem; border-radius: 10px; border: 1px solid var(--border-light); background: transparent; color: var(--brand-primary); font-size: 0.8rem; font-weight: 600; cursor: pointer; }
                .add-btn { display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1.25rem; border-radius: 10px; background: var(--brand-primary); color: white; border: none; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: transform 0.15s; }
                .add-btn:hover { transform: scale(1.03); }
                .filter-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; }
                .filter-chip { padding: 0.5rem 1.25rem; border-radius: 20px; border: 1px solid var(--border-light); background: transparent; color: var(--text-muted); font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
                .filter-chip.active { background: var(--brand-primary); color: white; border-color: transparent; }
                .filter-chip:hover:not(.active) { background: rgba(255,255,255,0.05); }
                .section-header { display: flex; justify-content: space-between; align-items: center; }
                .section-title { font-size: 1.1rem; font-weight: 700; }
                .section-count { font-size: 0.8rem; color: var(--text-muted); }
                .tasks-grid { display: flex; flex-direction: column; gap: 1rem; }
                .task-card { padding: 1.25rem; }
                .task-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
                .task-card-left { display: flex; gap: 0.75rem; flex: 1; }
                .task-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .task-title { font-size: 1rem; font-weight: 700; margin-bottom: 2px; }
                .task-desc { font-size: 0.8rem; color: var(--text-muted); }
                .task-actions-wrap { position: relative; }
                .action-trigger { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 6px; }
                .action-trigger:hover { background: rgba(255,255,255,0.05); }
                .action-menu { position: absolute; right: 0; top: 100%; background: #1e293b; border: 1px solid var(--border-light); border-radius: 10px; padding: 0.25rem; min-width: 140px; z-index: 50; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
                .action-menu button { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.75rem; border: none; background: none; color: var(--text-secondary); font-size: 0.8rem; cursor: pointer; border-radius: 6px; }
                .action-menu button:hover { background: rgba(255,255,255,0.05); }
                .action-menu button.danger { color: #ef4444; }
                .task-progress { margin-bottom: 1rem; }
                .progress-header { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px; }
                .progress-track { height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
                .progress-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
                .task-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid rgba(51,65,85,0.5); }
                .status-chip { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 600; padding: 4px 10px; border-radius: 6px; }
                .status-chip.done { background: rgba(16,185,129,0.15); color: #10b981; }
                .status-chip.in-progress { background: rgba(59,130,246,0.12); color: #3b82f6; }
                .prio-chip { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 600; padding: 4px 10px; border-radius: 6px; }
                .loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 0; color: var(--text-muted); gap: 0.75rem; }
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 1rem; }
                .modal-content { width: 100%; max-width: 480px; padding: 1.75rem; }
                .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                .modal-header h2 { font-size: 1.25rem; }
                .modal-header button { background: none; border: none; color: var(--text-muted); cursor: pointer; }
                .form-group { margin-bottom: 1rem; }
                .form-group label { font-size: 0.65rem; font-weight: 600; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 0.4rem; display: block; }
                .form-group input, .form-group textarea { width: 100%; padding: 0.75rem 1rem; background: rgba(15,23,42,0.8); border: 1px solid var(--border-light); border-radius: 10px; color: white; font-size: 0.9rem; outline: none; resize: vertical; }
                .form-group input:focus, .form-group textarea:focus { border-color: var(--brand-primary); }
                .prio-selector { display: flex; gap: 0.5rem; }
                .prio-btn { flex: 1; padding: 0.6rem; border-radius: 10px; border: 1px solid var(--border-light); background: transparent; color: var(--text-muted); font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
                .prio-btn.active { background: rgba(59,130,246,0.1); color: white; }
                .save-modal-btn { width: 100%; padding: 0.85rem; border-radius: 12px; background: var(--brand-primary); color: white; border: none; font-weight: 600; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 0.5rem; }
                .save-modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default AdminScheduleTasks;
