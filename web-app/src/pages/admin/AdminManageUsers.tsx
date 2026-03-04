import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CREATABLE_ROLES, ROLE_DISPLAY_NAMES } from '../../types/database';
import type { UserRole } from '../../types/database';
import { UserPlus, Trash2, Search, X, Loader2 } from 'lucide-react';
import '../admin/Dashboard.css';

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: string;
}

const AdminManageUsers: React.FC = () => {
    const { role: currentRole } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newUser, setNewUser] = useState({
        fullName: '', email: '', password: '', role: 'student' as string, studentId: '',
    });
    const [formError, setFormError] = useState<string | null>(null);

    // Determine what roles the current user can create
    const creatableRoles = currentRole ? (CREATABLE_ROLES[currentRole] || []) : [];

    useEffect(() => { fetchUsers(); }, []);

    const fetchUsers = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('profiles')
            .select('id, email, full_name, role')
            .order('created_at', { ascending: false });
        setUsers(data || []);
        setLoading(false);
    };

    const filtered = users.filter(u =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.role?.toLowerCase().includes(search.toLowerCase()) ||
        (ROLE_DISPLAY_NAMES[u.role as UserRole] || '').toLowerCase().includes(search.toLowerCase())
    );

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!newUser.fullName || !newUser.password) {
            setFormError('Please fill in name and password.');
            return;
        }
        if (!/^[a-zA-Z\s.\-]+$/.test(newUser.fullName)) {
            setFormError('Name can only contain letters, spaces, dots, and hyphens.');
            return;
        }
        if (newUser.password.length < 8) {
            setFormError('Password must be at least 8 characters.');
            return;
        }
        if (!creatableRoles.includes(newUser.role as UserRole)) {
            setFormError('You do not have permission to create this role.');
            return;
        }

        let email = newUser.email.trim();
        if (!email) {
            const nameParts = newUser.fullName.trim().split(' ');
            const surname = nameParts[nameParts.length - 1]?.toLowerCase() || 'user';
            const idStr = newUser.studentId?.trim() || Math.random().toString(36).slice(-6);
            email = `${surname}.${idStr.slice(-6)}@optisched.sti.edu`;
        }

        setCreating(true);
        try {
            const client = supabaseAdmin || supabase;
            if (supabaseAdmin) {
                const { data, error } = await supabaseAdmin.auth.admin.createUser({
                    email, password: newUser.password, email_confirm: true,
                    user_metadata: { role: newUser.role, full_name: newUser.fullName },
                });
                if (error) { setFormError(error.message); setCreating(false); return; }
                if (data.user) {
                    await new Promise(r => setTimeout(r, 500));
                    await client.from('profiles').upsert({
                        id: data.user.id, full_name: newUser.fullName, role: newUser.role, email,
                    }, { onConflict: 'id' });
                }
            }
            setShowCreateModal(false);
            setNewUser({ fullName: '', email: '', password: '', role: 'student', studentId: '' });
            fetchUsers();
        } catch {
            setFormError('Failed to create account.');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (user: UserProfile) => {
        // Prevent deleting power admins
        if (['admin', 'power_admin'].includes(user.role)) {
            alert('Cannot delete the Power User account.');
            return;
        }
        if (!confirm(`Delete ${user.full_name || user.email}? This cannot be undone.`)) return;
        try {
            if (supabaseAdmin) await supabaseAdmin.auth.admin.deleteUser(user.id);
            const client = supabaseAdmin || supabase;
            await client.from('teachers').delete().eq('profile_id', user.id);
            await client.from('profiles').delete().eq('id', user.id);
            fetchUsers();
        } catch {
            alert('Failed to delete user.');
        }
    };

    const getBadgeClass = (role: string) => {
        if (['admin', 'power_admin'].includes(role)) return 'badge badge-admin';
        if (['system_admin', 'schedule_admin', 'schedule_manager'].includes(role)) return 'badge badge-admin';
        if (role === 'teacher') return 'badge badge-teacher';
        return 'badge badge-student';
    };

    const getRoleLabel = (role: string): string => {
        return ROLE_DISPLAY_NAMES[role as UserRole] || role;
    };

    // Stats
    const adminCount = users.filter(u => ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'].includes(u.role)).length;
    const teacherCount = users.filter(u => u.role === 'teacher').length;
    const studentCount = users.filter(u => u.role === 'student').length;

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">User Management</h1>
                    <p className="dashboard-subtitle">{users.length} registered users</p>
                </div>
                {creatableRoles.length > 0 && (
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <UserPlus size={16} />
                        Add User
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-number">{users.length}</div>
                    <div className="stat-label">Total</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{adminCount}</div>
                    <div className="stat-label">Administrators</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{teacherCount}</div>
                    <div className="stat-label">Teachers</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{studentCount}</div>
                    <div className="stat-label">Students</div>
                </div>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 16 }}>
                <div style={{ position: 'relative', maxWidth: 400 }}>
                    <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        className="input"
                        style={{ paddingLeft: 40 }}
                        placeholder="Search by name, email, or role..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* User Table */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th style={{ width: 100 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(user => (
                                <tr key={user.id}>
                                    <td style={{ fontWeight: 600 }}>{user.full_name || 'Unnamed'}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                                    <td><span className={getBadgeClass(user.role)}>{getRoleLabel(user.role)}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {!['admin', 'power_admin'].includes(user.role) && (
                                                <button className="btn btn-ghost" style={{ padding: 6 }} title="Delete" onClick={() => handleDelete(user)}>
                                                    <Trash2 size={16} style={{ color: 'var(--accent-error)' }} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No users found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Create New Account</h2>
                            <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreate} className="modal-form">
                            {/* Role */}
                            <div className="field">
                                <label className="field-label">ROLE</label>
                                <div className="role-selector">
                                    {creatableRoles.map(r => (
                                        <button key={r} type="button"
                                            className={`role-btn ${newUser.role === r ? 'role-btn-active' : ''}`}
                                            onClick={() => setNewUser(p => ({ ...p, role: r }))}
                                        >{ROLE_DISPLAY_NAMES[r]}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="field">
                                <label className="field-label">FULL NAME</label>
                                <input className="input" placeholder="Full Name (Surname Last)" value={newUser.fullName} onChange={e => setNewUser(p => ({ ...p, fullName: e.target.value }))} />
                            </div>
                            <div className="field">
                                <label className="field-label">STUDENT / EMPLOYEE ID</label>
                                <input className="input" placeholder="e.g. 02000123456" value={newUser.studentId} onChange={e => setNewUser(p => ({ ...p, studentId: e.target.value }))} />
                            </div>
                            <div className="field">
                                <label className="field-label">EMAIL (or leave blank for auto-generate)</label>
                                <input className="input" placeholder="Auto-generated from name + ID" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
                            </div>
                            <div className="field">
                                <label className="field-label">PASSWORD</label>
                                <input className="input" type="password" placeholder="Min 8 characters" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
                            </div>

                            {formError && (
                                <div className="login-error">{formError}</div>
                            )}

                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={creating}>
                                {creating ? <><Loader2 size={16} className="spin" /> Creating...</> : 'Create Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
                    display: flex; align-items: center; justify-content: center; z-index: 100; padding: 24px;
                }
                .modal-content {
                    background: var(--bg-surface); border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-xl); padding: 28px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto;
                }
                .modal-header {
                    display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;
                }
                .modal-header h2 { font-size: 20px; font-weight: 700; color: var(--text-primary); }
                .modal-form { display: flex; flex-direction: column; gap: 16px; }
                .field { display: flex; flex-direction: column; gap: 6px; }
                .field-label {
                    font-size: 10px; font-weight: 600; color: var(--text-muted);
                    letter-spacing: 1.5px; padding-left: 2px;
                }
                .role-selector { display: flex; gap: 8px; flex-wrap: wrap; }
                .role-btn {
                    flex: 1; min-width: 100px; padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);
                    background: var(--bg-secondary); color: var(--text-secondary); font-weight: 600;
                    cursor: pointer; transition: all var(--transition-fast); font-family: var(--font-family); font-size: 11px;
                }
                .role-btn:hover { border-color: var(--accent-primary); }
                .role-btn-active { background: var(--accent-primary); border-color: var(--accent-primary); color: white; }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default AdminManageUsers;
