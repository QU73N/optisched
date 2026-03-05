import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CREATABLE_ROLES, ROLE_DISPLAY_NAMES, POWER_ADMIN_ROLES } from '../../types/database';
import type { UserRole } from '../../types/database';
import { UserPlus, Trash2, Search, X, Loader2, Edit3, KeyRound, Eye, EyeOff } from 'lucide-react';
import '../admin/Dashboard.css';

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    role: string;
    department: string | null;
    program: string | null;
    year_level: number | null;
    section: string | null;
    avatar_url: string | null;
}

const EMAIL_DOMAIN = 'meycauayan.sti.edu.ph';
const STUDENT_ROLES = ['student'];
const TEACHER_ROLES = ['teacher'];
const ADMIN_VARIANT_ROLES = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'];

const AdminManageUsers: React.FC = () => {
    const { role: currentRole } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [dbSections, setDbSections] = useState<{ id: string; name: string; program: string; year_level: number }[]>([]);

    // Create modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newUser, setNewUser] = useState({
        fullName: '', email: '', password: '', role: 'student' as string, studentId: '',
        section: '', program: '', yearLevel: '', department: '',
    });
    const [formError, setFormError] = useState<string | null>(null);

    // Edit modal
    const [editUser, setEditUser] = useState<UserProfile | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        full_name: '', email: '', role: '', department: '', program: '',
        year_level: '', section: '',
    });
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    // Reset password
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetUser, setResetUser] = useState<UserProfile | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);
    const [resetSuccess, setResetSuccess] = useState(false);

    const isSuperUser = POWER_ADMIN_ROLES.includes(currentRole as UserRole);
    const creatableRoles = currentRole ? (CREATABLE_ROLES[currentRole] || []) : [];

    useEffect(() => { fetchUsers(); fetchSections(); }, []);

    const fetchSections = async () => {
        const { data } = await supabase
            .from('sections')
            .select('id, name, program, year_level')
            .order('name', { ascending: true });
        setDbSections(data || []);
    };

    const fetchUsers = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, department, program, year_level, section, avatar_url')
            .order('created_at', { ascending: false });
        setUsers(data || []);
        setLoading(false);
    };

    const filtered = users.filter(u => {
        const matchesSearch =
            u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            u.email?.toLowerCase().includes(search.toLowerCase()) ||
            u.role?.toLowerCase().includes(search.toLowerCase()) ||
            u.section?.toLowerCase().includes(search.toLowerCase()) ||
            u.department?.toLowerCase().includes(search.toLowerCase()) ||
            u.program?.toLowerCase().includes(search.toLowerCase()) ||
            (ROLE_DISPLAY_NAMES[u.role as UserRole] || '').toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === 'all' || u.role === roleFilter ||
            (roleFilter === 'admin_all' && ADMIN_VARIANT_ROLES.includes(u.role));
        return matchesSearch && matchesRole;
    });

    const generateEmail = (fullName: string, studentId: string) => {
        const nameParts = fullName.trim().split(' ');
        const surname = nameParts[nameParts.length - 1]?.toLowerCase() || 'user';
        const idStr = studentId?.trim() || Math.random().toString(36).slice(-6);
        const last6 = idStr.slice(-6);
        return `${surname}.${last6}@${EMAIL_DOMAIN}`;
    };

    const getEmailPlaceholder = (role: string) => {
        if (STUDENT_ROLES.includes(role)) return `e.g. surname.123456@${EMAIL_DOMAIN}`;
        if (TEACHER_ROLES.includes(role)) return `e.g. surname.123456@${EMAIL_DOMAIN}`;
        return `e.g. surname.123456@${EMAIL_DOMAIN}`;
    };

    // ── CREATE ──
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
            email = generateEmail(newUser.fullName, newUser.studentId);
        }

        setCreating(true);
        try {
            let userId: string | null = null;

            if (supabaseAdmin) {
                const { data, error } = await supabaseAdmin.auth.admin.createUser({
                    email, password: newUser.password, email_confirm: true,
                    user_metadata: { role: newUser.role, full_name: newUser.fullName },
                });
                if (error) {
                    console.warn('Admin createUser failed, trying signUp fallback:', error.message);
                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email, password: newUser.password,
                        options: { data: { role: newUser.role, full_name: newUser.fullName } },
                    });
                    if (signUpError) { setFormError(signUpError.message); setCreating(false); return; }
                    userId = signUpData.user?.id || null;
                } else {
                    userId = data.user?.id || null;
                }
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email, password: newUser.password,
                    options: { data: { role: newUser.role, full_name: newUser.fullName } },
                });
                if (error) { setFormError(error.message); setCreating(false); return; }
                userId = data.user?.id || null;
            }

            if (userId) {
                await new Promise(r => setTimeout(r, 500));
                const client = supabaseAdmin || supabase;
                const profileData: any = {
                    id: userId, full_name: newUser.fullName, role: newUser.role, email,
                };
                // Add role-specific fields
                if (STUDENT_ROLES.includes(newUser.role)) {
                    if (newUser.section) profileData.section = newUser.section;
                    if (newUser.program) profileData.program = newUser.program;
                    if (newUser.yearLevel) profileData.year_level = parseInt(newUser.yearLevel) || null;
                }
                if (TEACHER_ROLES.includes(newUser.role)) {
                    if (newUser.department) profileData.department = newUser.department;
                }
                if (ADMIN_VARIANT_ROLES.includes(newUser.role)) {
                    if (newUser.department) profileData.department = newUser.department;
                }
                await client.from('profiles').upsert(profileData, { onConflict: 'id' });
            }

            setShowCreateModal(false);
            setNewUser({ fullName: '', email: '', password: '', role: 'student', studentId: '', section: '', program: '', yearLevel: '', department: '' });
            fetchUsers();
        } catch (err: any) {
            console.error('Create user error:', err);
            setFormError(err?.message || 'Failed to create account.');
        } finally {
            setCreating(false);
        }
    };

    // ── EDIT ──
    const openEditModal = (user: UserProfile) => {
        setEditUser(user);
        setEditForm({
            full_name: user.full_name || '',
            email: user.email || '',
            role: user.role || 'student',
            department: user.department || '',
            program: user.program || '',
            year_level: user.year_level?.toString() || '',
            section: user.section || '',
        });
        setEditError(null);
        setShowEditModal(true);
    };

    const handleEditSave = async () => {
        if (!editUser) return;
        setEditError(null);
        setEditSaving(true);
        try {
            const client = supabaseAdmin || supabase;
            const updateData: any = {
                full_name: editForm.full_name,
                role: editForm.role,
                department: editForm.department || null,
                program: editForm.program || null,
                year_level: editForm.year_level ? parseInt(editForm.year_level) : null,
                section: editForm.section || null,
            };
            // Update email if changed
            if (editForm.email !== editUser.email) {
                updateData.email = editForm.email;
                // Also update auth email if admin client available
                if (supabaseAdmin) {
                    await supabaseAdmin.auth.admin.updateUserById(editUser.id, { email: editForm.email });
                }
            }
            const { error } = await client.from('profiles').update(updateData).eq('id', editUser.id);
            if (error) throw error;
            setShowEditModal(false);
            fetchUsers();
        } catch (err: any) {
            setEditError(err?.message || 'Failed to update user.');
        } finally {
            setEditSaving(false);
        }
    };

    // ── RESET PASSWORD ──
    const openResetModal = (user: UserProfile) => {
        setResetUser(user);
        setNewPassword('');
        setResetError(null);
        setResetSuccess(false);
        setShowPassword(false);
        setShowResetModal(true);
    };

    const handleResetPassword = async () => {
        if (!resetUser || !newPassword) return;
        if (newPassword.length < 8) { setResetError('Password must be at least 8 characters.'); return; }
        setResetting(true);
        setResetError(null);
        try {
            if (!supabaseAdmin) throw new Error('Service role key not configured. Cannot reset passwords.');
            const { error } = await supabaseAdmin.auth.admin.updateUserById(resetUser.id, { password: newPassword });
            if (error) throw error;
            setResetSuccess(true);
            setTimeout(() => { setShowResetModal(false); }, 1500);
        } catch (err: any) {
            setResetError(err?.message || 'Failed to reset password.');
        } finally {
            setResetting(false);
        }
    };

    // ── DELETE ──
    const handleDelete = async (user: UserProfile) => {
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
    const adminCount = users.filter(u => ADMIN_VARIANT_ROLES.includes(u.role)).length;
    const teacherCount = users.filter(u => u.role === 'teacher').length;
    const studentCount = users.filter(u => u.role === 'student').length;

    // ── Render role-specific fields ──
    const renderRoleFields = (role: string, values: any, onChange: (field: string, value: string) => void) => {
        if (STUDENT_ROLES.includes(role)) {
            return (
                <>
                    <div className="field">
                        <label className="field-label">PROGRAM</label>
                        <input className="input" placeholder="e.g. BSIT, BSCS, BSHM" value={values.program || ''} onChange={e => onChange('program', e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <div className="field" style={{ flex: 1 }}>
                            <label className="field-label">YEAR LEVEL</label>
                            <select className="input" value={values.yearLevel || values.year_level || ''} onChange={e => onChange('yearLevel', e.target.value)} style={{ appearance: 'auto' }}>
                                <option value="">Select</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </select>
                        </div>
                        <div className="field" style={{ flex: 1 }}>
                            <label className="field-label">SECTION</label>
                            <select className="input" value={values.section || ''} onChange={e => onChange('section', e.target.value)} style={{ appearance: 'auto' }}>
                                <option value="">Select section</option>
                                {dbSections.map(s => (
                                    <option key={s.id} value={s.name}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </>
            );
        }
        if (TEACHER_ROLES.includes(role) || ADMIN_VARIANT_ROLES.includes(role)) {
            return (
                <div className="field">
                    <label className="field-label">DEPARTMENT</label>
                    <input className="input" placeholder="e.g. Computer Science, Information Technology" value={values.department || ''} onChange={e => onChange('department', e.target.value)} />
                </div>
            );
        }
        return null;
    };

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
                <div className="stat-card" style={{ cursor: 'pointer', border: roleFilter === 'all' ? '1px solid var(--accent-primary)' : undefined }} onClick={() => setRoleFilter('all')}>
                    <div className="stat-number">{users.length}</div>
                    <div className="stat-label">Total</div>
                </div>
                <div className="stat-card" style={{ cursor: 'pointer', border: roleFilter === 'admin_all' ? '1px solid var(--accent-primary)' : undefined }} onClick={() => setRoleFilter(roleFilter === 'admin_all' ? 'all' : 'admin_all')}>
                    <div className="stat-number">{adminCount}</div>
                    <div className="stat-label">Administrators</div>
                </div>
                <div className="stat-card" style={{ cursor: 'pointer', border: roleFilter === 'teacher' ? '1px solid var(--accent-primary)' : undefined }} onClick={() => setRoleFilter(roleFilter === 'teacher' ? 'all' : 'teacher')}>
                    <div className="stat-number">{teacherCount}</div>
                    <div className="stat-label">Teachers</div>
                </div>
                <div className="stat-card" style={{ cursor: 'pointer', border: roleFilter === 'student' ? '1px solid var(--accent-primary)' : undefined }} onClick={() => setRoleFilter(roleFilter === 'student' ? 'all' : 'student')}>
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
                        placeholder="Search by name, email, role, section, department..."
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
                                <th>Section / Dept</th>
                                <th>Program / Year</th>
                                <th style={{ width: 140 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(user => (
                                <tr key={user.id}>
                                    <td style={{ fontWeight: 600 }}>{user.full_name || 'Unnamed'}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{user.email}</td>
                                    <td><span className={getBadgeClass(user.role)}>{getRoleLabel(user.role)}</span></td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                        {user.section || user.department || '-'}
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                        {user.program ? `${user.program}${user.year_level ? ` • Year ${user.year_level}` : ''}` : '-'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {isSuperUser && (
                                                <>
                                                    <button className="btn btn-ghost" style={{ padding: 6 }} title="Edit User" onClick={() => openEditModal(user)}>
                                                        <Edit3 size={15} style={{ color: 'var(--accent-primary)' }} />
                                                    </button>
                                                    {supabaseAdmin && (
                                                        <button className="btn btn-ghost" style={{ padding: 6 }} title="Reset Password" onClick={() => openResetModal(user)}>
                                                            <KeyRound size={15} style={{ color: '#f59e0b' }} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            {!['admin', 'power_admin'].includes(user.role) && (
                                                <button className="btn btn-ghost" style={{ padding: 6 }} title="Delete" onClick={() => handleDelete(user)}>
                                                    <Trash2 size={15} style={{ color: 'var(--accent-error)' }} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No users found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Create User Modal ── */}
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

                            {/* Role-specific fields */}
                            {renderRoleFields(newUser.role, newUser, (field, value) => setNewUser(p => ({ ...p, [field]: value })))}

                            <div className="field">
                                <label className="field-label">EMAIL (or leave blank for auto-generate)</label>
                                <input className="input" placeholder={getEmailPlaceholder(newUser.role)} value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
                                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                    Format: surname.last6digits@{EMAIL_DOMAIN}
                                </span>
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

            {/* ── Edit User Modal ── */}
            {showEditModal && editUser && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Edit User</h2>
                            <button className="btn btn-ghost" onClick={() => setShowEditModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-form">
                            <div className="field">
                                <label className="field-label">ROLE</label>
                                <select className="input" value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))} style={{ appearance: 'auto' }}>
                                    {Object.entries(ROLE_DISPLAY_NAMES).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field">
                                <label className="field-label">FULL NAME</label>
                                <input className="input" value={editForm.full_name} onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} />
                            </div>
                            <div className="field">
                                <label className="field-label">EMAIL</label>
                                <input className="input" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
                            </div>

                            {/* Role-specific fields */}
                            {STUDENT_ROLES.includes(editForm.role) && (
                                <>
                                    <div className="field">
                                        <label className="field-label">PROGRAM</label>
                                        <input className="input" placeholder="e.g. BSIT, BSCS, BSHM" value={editForm.program} onChange={e => setEditForm(p => ({ ...p, program: e.target.value }))} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <div className="field" style={{ flex: 1 }}>
                                            <label className="field-label">YEAR LEVEL</label>
                                            <select className="input" value={editForm.year_level} onChange={e => setEditForm(p => ({ ...p, year_level: e.target.value }))} style={{ appearance: 'auto' }}>
                                                <option value="">Select</option>
                                                <option value="1">1st Year</option>
                                                <option value="2">2nd Year</option>
                                                <option value="3">3rd Year</option>
                                                <option value="4">4th Year</option>
                                            </select>
                                        </div>
                                        <div className="field" style={{ flex: 1 }}>
                                            <label className="field-label">SECTION</label>
                                            <select className="input" value={editForm.section} onChange={e => setEditForm(p => ({ ...p, section: e.target.value }))} style={{ appearance: 'auto' }}>
                                                <option value="">Select section</option>
                                                {dbSections.map(s => (
                                                    <option key={s.id} value={s.name}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}
                            {(TEACHER_ROLES.includes(editForm.role) || ADMIN_VARIANT_ROLES.includes(editForm.role)) && (
                                <div className="field">
                                    <label className="field-label">DEPARTMENT</label>
                                    <input className="input" placeholder="e.g. Computer Science" value={editForm.department} onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))} />
                                </div>
                            )}

                            {editError && <div className="login-error">{editError}</div>}

                            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={editSaving} onClick={handleEditSave}>
                                {editSaving ? <><Loader2 size={16} className="spin" /> Saving...</> : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Reset Password Modal ── */}
            {showResetModal && resetUser && (
                <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h2>Reset Password</h2>
                            <button className="btn btn-ghost" onClick={() => setShowResetModal(false)}><X size={20} /></button>
                        </div>
                        <div className="modal-form">
                            <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{resetUser.full_name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{resetUser.email}</div>
                            </div>

                            <div className="field">
                                <label className="field-label">NEW PASSWORD</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="input" type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters"
                                        value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                        style={{ paddingRight: 40 }}
                                    />
                                    <button type="button" className="btn btn-ghost"
                                        style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', padding: 6 }}
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {resetError && <div className="login-error">{resetError}</div>}
                            {resetSuccess && <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Password reset successfully!</div>}

                            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8, background: '#f59e0b' }} disabled={resetting || resetSuccess || !newPassword} onClick={handleResetPassword}>
                                {resetting ? <><Loader2 size={16} className="spin" /> Resetting...</> : 'Reset Password'}
                            </button>
                        </div>
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
                    border-radius: var(--radius-xl); padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
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
