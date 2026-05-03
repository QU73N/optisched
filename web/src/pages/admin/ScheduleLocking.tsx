import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ADMIN_ROLES } from '../../types/database';
import { Lock, Unlock, Calendar } from 'lucide-react';
import '../admin/Dashboard.css';
import {
    unlockSchedule,
    lockSemesterSchedules,
    unlockSemesterSchedules,
    getLockedSchedules
} from '../../services/scheduleLockService';

const ScheduleLocking: React.FC = () => {
    const { role, roles } = useAuth();
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const canManage = allRoles.some((r: string) => ADMIN_ROLES.includes(r as 'admin' | 'power_admin' | 'system_admin' | 'schedule_admin' | 'schedule_manager'));

    const [lockedSchedules, setLockedSchedules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
    // Bulk lock state
    const [bulkAcademicYear, setBulkAcademicYear] = useState('');
    const [bulkSemester, setBulkSemester] = useState('');
    const [bulkReason, setBulkReason] = useState('');
    const [processing, setProcessing] = useState(false);

    const loadLockedSchedules = async () => {
        setLoading(true);
        try {
            const data = await getLockedSchedules();
            setLockedSchedules(data || []);
        } catch (error: unknown) {
            console.error('Error loading locked schedules:', error);
            setMessage({ type: 'error', text: 'Failed to load locked schedules' });
        }
        setLoading(false);
    };

    useEffect(() => {
        loadLockedSchedules();
    }, []);

    const handleUnlock = async (scheduleId: string) => {
        if (!confirm('Unlock this schedule?')) return;
        try {
            await unlockSchedule(scheduleId);
            setMessage({ type: 'success', text: 'Schedule unlocked successfully' });
            await loadLockedSchedules();
        } catch (error: unknown) {
            console.error('Error unlocking schedule:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to unlock schedule';
            setMessage({ type: 'error', text: errorMessage });
        }
    };

    const handleBulkLock = async () => {
        if (!bulkAcademicYear || !bulkSemester) {
            setMessage({ type: 'error', text: 'Please provide academic year and semester' });
            return;
        }
        setProcessing(true);
        try {
            const count = await lockSemesterSchedules(bulkAcademicYear, bulkSemester, bulkReason);
            setMessage({ type: 'success', text: `Locked ${count} schedules` });
            setBulkReason('');
            await loadLockedSchedules();
        } catch (error: unknown) {
            console.error('Error locking schedules:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to lock schedules';
            setMessage({ type: 'error', text: errorMessage });
        }
        setProcessing(false);
    };

    const handleBulkUnlock = async () => {
        if (!bulkAcademicYear || !bulkSemester) {
            setMessage({ type: 'error', text: 'Please provide academic year and semester' });
            return;
        }
        if (!confirm('Unlock all schedules for this semester?')) return;
        setProcessing(true);
        try {
            const count = await unlockSemesterSchedules(bulkAcademicYear, bulkSemester);
            setMessage({ type: 'success', text: `Unlocked ${count} schedules` });
            await loadLockedSchedules();
        } catch (error: unknown) {
            console.error('Error unlocking schedules:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to unlock schedules';
            setMessage({ type: 'error', text: errorMessage });
        }
        setProcessing(false);
    };

    if (!canManage) {
        return (
            <div className="dashboard fade-in">
                <div className="dashboard-header">
                    <div>
                        <h1 className="dashboard-title"><Lock size={20} /> Schedule Locking</h1>
                        <p className="dashboard-subtitle">Manage schedule locks</p>
                    </div>
                </div>
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    You don't have permission to manage schedule locks
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="dashboard fade-in">
                <div className="dashboard-header">
                    <div>
                        <h1 className="dashboard-title"><Lock size={20} /> Schedule Locking</h1>
                        <p className="dashboard-subtitle">Manage schedule locks to prevent unauthorized modifications</p>
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
                    <h1 className="dashboard-title"><Lock size={20} /> Schedule Locking</h1>
                    <p className="dashboard-subtitle">Manage schedule locks to prevent unauthorized modifications</p>
                </div>
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

            <div className="dash-card" style={{ padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Bulk Lock/Unlock</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Academic Year</label>
                        <input
                            className="input"
                            value={bulkAcademicYear}
                            onChange={(e) => setBulkAcademicYear(e.target.value)}
                            placeholder="e.g. 2024-2025"
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 150 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Semester</label>
                        <input
                            className="input"
                            value={bulkSemester}
                            onChange={(e) => setBulkSemester(e.target.value)}
                            placeholder="e.g. Fall"
                        />
                    </div>
                    <div style={{ flex: 2, minWidth: 250 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Reason (optional)</label>
                        <input
                            className="input"
                            value={bulkReason}
                            onChange={(e) => setBulkReason(e.target.value)}
                            placeholder="e.g. Schedule finalized for publication"
                        />
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleBulkLock}
                        disabled={processing}
                    >
                        <Lock size={16} style={{ marginRight: 8 }} />
                        Lock All
                    </button>
                    <button
                        className="btn btn-ghost"
                        style={{ color: '#ef4444', border: '1px solid #ef4444' }}
                        onClick={handleBulkUnlock}
                        disabled={processing}
                    >
                        <Unlock size={16} style={{ marginRight: 8 }} />
                        Unlock All
                    </button>
                </div>
            </div>

            <div className="dash-card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                    Locked Schedules ({lockedSchedules.length})
                </h3>

                {lockedSchedules.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        No locked schedules found
                    </div>
                ) : (
                    <div style={{ overflow: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Day/Time</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Teacher</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Room</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Section</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Locked By</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Locked At</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Reason</th>
                                    <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lockedSchedules.map(schedule => (
                                    <tr key={schedule.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Calendar size={12} />
                                                {schedule.day_of_week}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                {schedule.start_time} - {schedule.end_time}
                                            </div>
                                        </td>
                                        <td style={{ padding: 8 }}>
                                            {schedule.teacher?.profile?.full_name || 'Unassigned'}
                                        </td>
                                        <td style={{ padding: 8 }}>
                                            {schedule.room ? `${schedule.room.name} (${schedule.room.building})` : 'Unassigned'}
                                        </td>
                                        <td style={{ padding: 8 }}>
                                            {schedule.section ? schedule.section.name : 'Unassigned'}
                                        </td>
                                        <td style={{ padding: 8 }}>
                                            {schedule.locked_by_user?.full_name || 'Unknown'}
                                        </td>
                                        <td style={{ padding: 8 }}>
                                            {schedule.locked_at ? new Date(schedule.locked_at).toLocaleString() : 'Unknown'}
                                        </td>
                                        <td style={{ padding: 8 }}>
                                            {schedule.lock_reason || '-'}
                                        </td>
                                        <td style={{ padding: 8 }}>
                                            <button
                                                className="btn btn-ghost"
                                                style={{ padding: 4, color: '#ef4444' }}
                                                onClick={() => handleUnlock(schedule.id)}
                                            >
                                                <Unlock size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScheduleLocking;
