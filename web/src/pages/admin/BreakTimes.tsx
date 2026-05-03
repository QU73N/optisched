import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ADMIN_ROLES } from '../../types/database';
import { Clock, Plus, Trash2, Edit2, X } from 'lucide-react';
import '../admin/Dashboard.css';
import {
    getBreaks,
    createBreak,
    updateBreak,
    deleteBreak,
    toggleBreakActive
} from '../../services/breakService';
import type { InstitutionBreak } from '../../types/database';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BREAK_TYPES = ['lunch', 'recess', 'assembly', 'other'];

const BreakTimes: React.FC = () => {
    const { role, roles, profile } = useAuth();
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const canEdit = allRoles.some((r: string) => ADMIN_ROLES.includes(r as 'admin' | 'power_admin' | 'system_admin' | 'schedule_admin' | 'schedule_manager'));

    const [breaks, setBreaks] = useState<InstitutionBreak[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingBreak, setEditingBreak] = useState<InstitutionBreak | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState<{
        name: string;
        break_type: 'lunch' | 'recess' | 'assembly' | 'other';
        day_of_week: 'all' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
        start_time: string;
        end_time: string;
        is_active: boolean;
        academic_year: string;
        semester: string;
        description: string;
    }>({
        name: '',
        break_type: 'lunch',
        day_of_week: 'all',
        start_time: '12:00',
        end_time: '13:00',
        is_active: true,
        academic_year: '',
        semester: '',
        description: ''
    });

    const loadBreaks = async () => {
        setLoading(true);
        try {
            const data = await getBreaks();
            setBreaks(data);
        } catch (error: unknown) {
            console.error('Error loading breaks:', error);
            setMessage({ type: 'error', text: 'Failed to load break times' });
        }
        setLoading(false);
    };

    useEffect(() => {
        loadBreaks();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            if (editingBreak) {
                await updateBreak(editingBreak.id, formData);
                setMessage({ type: 'success', text: 'Break updated successfully' });
            } else {
                await createBreak({ ...formData, created_by: profile?.id || null });
                setMessage({ type: 'success', text: 'Break created successfully' });
            }
            setShowModal(false);
            resetForm();
            await loadBreaks();
        } catch (error: unknown) {
            console.error('Error saving break:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to save break';
            setMessage({ type: 'error', text: errorMessage });
        }

        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this break time? This cannot be undone.')) return;
        try {
            await deleteBreak(id);
            setMessage({ type: 'success', text: 'Break deleted successfully' });
            await loadBreaks();
        } catch (error: unknown) {
            console.error('Error deleting break:', error);
            setMessage({ type: 'error', text: 'Failed to delete break' });
        }
    };

    const handleToggleActive = async (id: string, isActive: boolean) => {
        try {
            await toggleBreakActive(id, isActive);
            setMessage({ type: 'success', text: `Break ${isActive ? 'activated' : 'deactivated'}` });
            await loadBreaks();
        } catch (error: unknown) {
            console.error('Error toggling break:', error);
            setMessage({ type: 'error', text: 'Failed to update break status' });
        }
    };

    const openEditModal = (breakItem: InstitutionBreak) => {
        setEditingBreak(breakItem);
        setFormData({
            name: breakItem.name,
            break_type: breakItem.break_type,
            day_of_week: breakItem.day_of_week,
            start_time: breakItem.start_time,
            end_time: breakItem.end_time,
            is_active: breakItem.is_active,
            academic_year: breakItem.academic_year || '',
            semester: breakItem.semester || '',
            description: breakItem.description || ''
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setEditingBreak(null);
        setFormData({
            name: '',
            break_type: 'lunch',
            day_of_week: 'all',
            start_time: '12:00',
            end_time: '13:00',
            is_active: true,
            academic_year: '',
            semester: '',
            description: ''
        });
    };

    const openAddModal = () => {
        resetForm();
        setShowModal(true);
    };

    if (loading) {
        return (
            <div className="dashboard fade-in">
                <div className="dashboard-header">
                    <div>
                        <h1 className="dashboard-title"><Clock size={20} /> Break Times Configuration</h1>
                        <p className="dashboard-subtitle">Configure institution-wide break times</p>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title"><Clock size={20} /> Break Times Configuration</h1>
                    <p className="dashboard-subtitle">Configure institution-wide break times (lunch, recess, etc.)</p>
                </div>
                {canEdit && (
                    <button className="btn btn-primary" onClick={openAddModal}>
                        <Plus size={16} />
                        Add Break Time
                    </button>
                )}
            </div>

            {message && (
                <div style={{
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 24,
                    background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
                    color: message.type === 'success' ? '#10b981' : '#ef4444',
                    fontSize: 14
                }}>
                    {message.text}
                </div>
            )}

            <div className="dash-card" style={{ padding: 24 }}>
                {breaks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No break times configured
                    </div>
                ) : (
                    <div style={{ overflow: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Name</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Type</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Day</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Time</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Academic Year</th>
                                    {canEdit && <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {breaks.map(breakItem => (
                                    <tr key={breakItem.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: 8, fontWeight: 500 }}>{breakItem.name}</td>
                                        <td style={{ padding: 8 }}>
                                            <span className="badge" style={{
                                                background: breakItem.break_type === 'lunch' ? 'rgba(245,158,11,0.15)' :
                                                           breakItem.break_type === 'recess' ? 'rgba(16,185,129,0.15)' :
                                                           breakItem.break_type === 'assembly' ? 'rgba(139,92,246,0.15)' : 'rgba(107,114,128,0.15)',
                                                color: breakItem.break_type === 'lunch' ? '#fbbf24' :
                                                       breakItem.break_type === 'recess' ? '#10b981' :
                                                       breakItem.break_type === 'assembly' ? '#a78bfa' : '#6b7280'
                                            }}>
                                                {breakItem.break_type.charAt(0).toUpperCase() + breakItem.break_type.slice(1)}
                                            </span>
                                        </td>
                                        <td style={{ padding: 8 }}>{breakItem.day_of_week}</td>
                                        <td style={{ padding: 8 }}>{breakItem.start_time} - {breakItem.end_time}</td>
                                        <td style={{ padding: 8 }}>
                                            <span className="badge" style={{
                                                background: breakItem.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)',
                                                color: breakItem.is_active ? '#10b981' : '#6b7280'
                                            }}>
                                                {breakItem.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td style={{ padding: 8 }}>{breakItem.academic_year || 'All'}</td>
                                        {canEdit && (
                                            <td style={{ padding: 8 }}>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => openEditModal(breakItem)}>
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => handleToggleActive(breakItem.id, !breakItem.is_active)}>
                                                        {breakItem.is_active ? <Clock size={14} /> : <Clock size={14} />}
                                                    </button>
                                                    <button className="btn btn-ghost" style={{ padding: 4, color: '#ef4444' }} onClick={() => handleDelete(breakItem.id)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingBreak ? 'Edit Break Time' : 'Add Break Time'}</h2>
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="modal-form">
                            <div className="field">
                                <label className="field-label">NAME</label>
                                <input className="input" required value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Lunch Break" />
                            </div>
                            <div className="field">
                                <label className="field-label">BREAK TYPE</label>
                                <select className="input" value={formData.break_type} onChange={(e) => setFormData(p => ({ ...p, break_type: e.target.value as 'lunch' | 'recess' | 'assembly' | 'other' }))}>
                                    {BREAK_TYPES.map(type => (
                                        <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field">
                                <label className="field-label">DAY OF WEEK</label>
                                <select className="input" value={formData.day_of_week} onChange={(e) => setFormData(p => ({ ...p, day_of_week: e.target.value as 'all' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' }))}>
                                    <option value="all">All Days</option>
                                    {DAYS.map(day => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 1 }}>
                                    <label className="field-label">START TIME</label>
                                    <input className="input" type="time" required value={formData.start_time} onChange={(e) => setFormData(p => ({ ...p, start_time: e.target.value }))} />
                                </div>
                                <div className="field" style={{ flex: 1 }}>
                                    <label className="field-label">END TIME</label>
                                    <input className="input" type="time" required value={formData.end_time} onChange={(e) => setFormData(p => ({ ...p, end_time: e.target.value }))} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 1 }}>
                                    <label className="field-label">ACADEMIC YEAR (OPTIONAL)</label>
                                    <input className="input" value={formData.academic_year} onChange={(e) => setFormData(p => ({ ...p, academic_year: e.target.value }))} placeholder="e.g. 2024-2025" />
                                </div>
                                <div className="field" style={{ flex: 1 }}>
                                    <label className="field-label">SEMESTER (OPTIONAL)</label>
                                    <input className="input" value={formData.semester} onChange={(e) => setFormData(p => ({ ...p, semester: e.target.value }))} placeholder="e.g. Fall" />
                                </div>
                            </div>
                            <div className="field">
                                <label className="field-label">DESCRIPTION (OPTIONAL)</label>
                                <textarea className="input" rows={3} value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Additional details..." />
                            </div>
                            <div className="field">
                                <label className="field-label">STATUS</label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData(p => ({ ...p, is_active: e.target.checked }))} />
                                    <span>Active</span>
                                </label>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={saving}>
                                {saving ? 'Saving...' : editingBreak ? 'Update Break' : 'Create Break'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BreakTimes;
