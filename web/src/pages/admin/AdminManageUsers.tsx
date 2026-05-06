import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { CREATABLE_ROLES, ROLE_DISPLAY_NAMES, POWER_ADMIN_ROLES, SELECTABLE_ROLE_DISPLAY, TEACHER_ADDABLE_ROLES } from '../../types/database';
import type { UserRole } from '../../types/database';
import { UserPlus, Trash2, Search, X, Loader2, Edit3, ChevronUp, ChevronDown } from 'lucide-react';
import '../admin/Dashboard.css';

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    last_name: string | null;
    first_name: string | null;
    middle_initial: string | null;
    suffix: string | null;
    role: string;
    department: string | null;
    department_id?: string | null;
    program: string | null;
    year_level: number | null;
    section: string | null;
    avatar_url: string | null;
}

interface ProfileData {
    id: string;
    full_name: string;
    last_name: string | null;
    first_name: string | null;
    middle_initial: string | null;
    suffix: string | null;
    role: string;
    email: string;
    section?: string | null;
    program?: string | null;
    year_level?: number | null;
    department?: string | null;
}

// Helper function to combine name fields into full_name
// Format: Last Name, First Name M.I. Suffix (e.g., "Dela Cruz, Juan A. Jr.")
const combineFullName = (lastName: string, firstName: string, middleInitial: string, suffix: string): string => {
    const parts = [];
    
    // Add last name first
    if (lastName && lastName.trim()) {
        parts.push(lastName.trim());
    }
    
    // Add first name after comma
    if (firstName && firstName.trim()) {
        if (parts.length > 0) {
            parts.push(',');
            parts.push(firstName.trim());
        } else {
            parts.push(firstName.trim());
        }
    }
    
    // Add middle initial if present
    if (middleInitial && middleInitial.trim()) {
        parts.push(middleInitial.trim().toUpperCase() + '.');
    }
    
    // Add suffix if present
    if (suffix && suffix.trim()) {
        parts.push(suffix.trim());
    }
    
    return parts.join(' ') || 'Unknown';
};

const EMAIL_DOMAIN = 'meycauayan.sti.edu.ph';
const STUDENT_ROLES = ['student'];
const TEACHER_ROLES = ['teacher'];
const ADMIN_VARIANT_ROLES = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'];

// Department options for dropdown
const DEPARTMENT_OPTIONS = [
    'Computer Science',
    'Information Technology',
    'Hospitality Management',
    'Business Administration',
    'Engineering',
    'Arts and Sciences',
    'Mathematics',
    'Science',
    'Physical Education',
    'Business',
    'Research',
    'General',
];

const AdminManageUsers: React.FC = () => {
    const { role: currentRole, user: currentUser } = useAuth();
    const { canEditUser: canEditUserByRole } = usePermissions();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [dbSections, setDbSections] = useState<{ id: string; name: string; program: string; year_level: number }[]>([]);
    const [sortColumn, setSortColumn] = useState<string>('full_name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Create modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newUser, setNewUser] = useState({
        lastName: '', firstName: '', middleInitial: '', suffix: '', fullName: '', email: '', password: '', role: 'student' as string, studentId: '',
        section: '', program: '', yearLevel: '', department: '',
        // Teacher-specific fields for generation
        max_hours: 40,
        max_hours_per_day: 8,
        max_consecutive_classes: null as number | null,
        max_daily_load: null as number | null,
        preferred_days: [] as string[],
        preferred_time_start: null as string | null,
        preferred_time_end: null as string | null,
        is_shared: false,
        priority_flag: 50,
    });
    const [formError, setFormError] = useState<string | null>(null);

    // Edit modal
    const [editUser, setEditUser] = useState<UserProfile | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        last_name: '', first_name: '', middle_initial: '', suffix: '', full_name: '', email: '', role: '', department: '', program: '',
        year_level: '', section: '',
        // Teacher-specific fields for generation
        max_hours: 40,
        max_hours_per_day: 8,
        max_consecutive_classes: null as number | null,
        max_daily_load: null as number | null,
        preferred_days: [] as string[],
        preferred_time_start: null as string | null,
        preferred_time_end: null as string | null,
        is_shared: false,
        priority_flag: 50,
    });
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);
    const [editAdditionalRoles, setEditAdditionalRoles] = useState<string[]>([]);

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
            .select('id, email, full_name, last_name, first_name, middle_initial, suffix, role, department, program, year_level, section, avatar_url')
            .order('created_at', { ascending: false });
        setUsers(data || []);
        setLoading(false);
    };

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const getSortedUsers = (usersToSort: UserProfile[]) => {
        return [...usersToSort].sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;

            switch (sortColumn) {
                case 'full_name':
                    aValue = a.full_name?.toLowerCase() || '';
                    bValue = b.full_name?.toLowerCase() || '';
                    break;
                case 'email':
                    aValue = a.email?.toLowerCase() || '';
                    bValue = b.email?.toLowerCase() || '';
                    break;
                case 'role':
                    aValue = ROLE_DISPLAY_NAMES[a.role as UserRole] || a.role;
                    bValue = ROLE_DISPLAY_NAMES[b.role as UserRole] || b.role;
                    break;
                case 'section_dept':
                    aValue = a.section || a.department || '';
                    bValue = b.section || b.department || '';
                    break;
                case 'program_year':
                    aValue = a.program ? `${a.program}${a.year_level ? ` • Year ${a.year_level}` : ''}` : '';
                    bValue = b.program ? `${b.program}${b.year_level ? ` • Year ${b.year_level}` : ''}` : '';
                    break;
                default:
                    aValue = a.full_name?.toLowerCase() || '';
                    bValue = b.full_name?.toLowerCase() || '';
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
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

    const sortedFiltered = getSortedUsers(filtered);

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
        if (!/^[a-zA-Z\s.-]+$/.test(newUser.fullName)) {
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

        let email = newUser.email.trim().toLowerCase();
        if (!email) {
            email = generateEmail(newUser.fullName, newUser.studentId).toLowerCase();
        }

        setCreating(true);
        try {
            let userId: string | null = null;

            // NOTE: Service role operations moved to Edge Functions for security
            // Using client-side signUp with user_metadata (requires RLS policies)
            const { data, error } = await supabase.auth.signUp({
                email, password: newUser.password,
                options: { data: { role: newUser.role, full_name: newUser.fullName } },
            });
            if (error) { setFormError(error.message); setCreating(false); return; }
            const user = data.user;
            if (!user) {
                setFormError('Account was not created. Please try again.');
                setCreating(false);
                return;
            }

            // Supabase can return a user-like payload for an already-registered email.
            if (Array.isArray(user.identities) && user.identities.length === 0) {
                setFormError('This email is already registered. Use another email or reset its password.');
                setCreating(false);
                return;
            }

            userId = user.id || null;
            if (!userId) {
                setFormError('Account ID was not returned. Please try again.');
                setCreating(false);
                return;
            }

            if (userId) {
                await new Promise(r => setTimeout(r, 500));
                const profileData: ProfileData = {
                    id: userId,
                    last_name: newUser.lastName || null,
                    first_name: newUser.firstName || null,
                    middle_initial: newUser.middleInitial || null,
                    suffix: newUser.suffix || null,
                    full_name: newUser.fullName,
                    role: newUser.role,
                    email,
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
                const { error: profileError } = await supabase.from('profiles').upsert(profileData, { onConflict: 'id' });
                if (profileError) throw profileError;

                // Create teacher record if role is teacher
                if (TEACHER_ROLES.includes(newUser.role)) {
                    const { error: teacherError } = await supabase.from('teachers').insert({
                        profile_id: userId,
                        department: newUser.department || 'General',
                        employment_type: 'full-time',
                        is_public: true,
                        max_hours: newUser.max_hours,
                        max_hours_per_day: newUser.max_hours_per_day,
                        weight: newUser.priority_flag,
                        shared_assignment: newUser.is_shared,
                        preferred_days: newUser.preferred_days,
                        preferred_time_start: newUser.preferred_time_start,
                        preferred_time_end: newUser.preferred_time_end,
                        max_classes_per_day: newUser.max_daily_load,
                        max_consecutive_classes: newUser.max_consecutive_classes,
                    });
                    if (teacherError) throw teacherError;
                    
                    // Create teacher preferences record
                    const { error: prefError } = await supabase.from('teacher_preferences').insert({
                        teacher_id: userId,
                        max_hours: newUser.max_hours,
                        weight: newUser.priority_flag,
                        shared_assignment: newUser.is_shared,
                        preferred_days: newUser.preferred_days,
                        preferred_time_start: newUser.preferred_time_start,
                        preferred_time_end: newUser.preferred_time_end,
                        max_classes_per_day: newUser.max_daily_load,
                        max_consecutive_classes: newUser.max_consecutive_classes,
                        max_daily_load: newUser.max_daily_load,
                    });
                    if (prefError) throw prefError;
                }
            }

            setShowCreateModal(false);
            setNewUser({ 
                lastName: '', firstName: '', middleInitial: '', suffix: '', fullName: '', email: '', password: '', role: 'student', studentId: '', 
                section: '', program: '', yearLevel: '', department: '',
                // Teacher-specific fields for generation
                max_hours: 40,
                max_hours_per_day: 8,
                max_consecutive_classes: null,
                max_daily_load: null,
                preferred_days: [],
                preferred_time_start: null,
                preferred_time_end: null,
                is_shared: false,
                priority_flag: 50,
            });
            fetchUsers();
        } catch (err: unknown) {
            console.error('Create user error:', err);
            setFormError(err instanceof Error ? err.message : 'Failed to create account.');
        } finally {
            setCreating(false);
        }
    };

    // ── EDIT ──
    const openEditModal = async (user: UserProfile) => {
        // Prevent users from editing their own profile administratively
        if (user.id === currentUser?.id) {
            alert('You cannot edit your own profile through the admin interface. Use Settings instead.');
            return;
        }
        setEditUser(user);
        setEditForm({
            last_name: user.last_name || '',
            first_name: user.first_name || '',
            middle_initial: user.middle_initial || '',
            suffix: user.suffix || '',
            full_name: user.full_name || '',
            email: user.email || '',
            role: user.role || 'student',
            department: user.department || '',
            program: user.program || '',
            year_level: user.year_level?.toString() || '',
            section: user.section || '',
            // Teacher-specific fields for generation (will be loaded from teacher_preferences)
            max_hours: 40,
            max_hours_per_day: 8,
            max_consecutive_classes: null,
            max_daily_load: null,
            preferred_days: [],
            preferred_time_start: null,
            preferred_time_end: null,
            is_shared: false,
            priority_flag: 50,
        });
        setEditError(null);
        setShowEditModal(true);
        
        // Load additional_roles from auth metadata via Edge Function
        try {
            const { data, error } = await supabase.functions.invoke('get-additional-roles', {
                body: { userId: user.id }
            });
            if (error) throw error;
            setEditAdditionalRoles(data?.additional_roles || []);
        } catch (err) {
            console.error('Error loading additional roles:', err);
            setEditAdditionalRoles([]);
        }
        
        // Load teacher preferences if role is teacher
        if (TEACHER_ROLES.includes(user.role || '')) {
            try {
                const { data: teacherData } = await supabase
                    .from('teachers')
                    .select('*')
                    .eq('profile_id', user.id)
                    .single();
                if (teacherData) {
                    setEditForm(prev => ({
                        ...prev,
                        max_hours: teacherData.max_hours || 40,
                        max_hours_per_day: teacherData.max_hours_per_day || 8,
                        priority_flag: teacherData.weight || 50,
                        is_shared: teacherData.shared_assignment || false,
                    }));
                }
                const { data: teacherPref } = await supabase
                    .from('teacher_preferences')
                    .select('*')
                    .eq('teacher_id', user.id)
                    .single();
                if (teacherPref) {
                    setEditForm(prev => ({
                        ...prev,
                        max_consecutive_classes: teacherPref.max_consecutive_classes || null,
                        max_daily_load: teacherPref.max_daily_load || null,
                        preferred_days: teacherPref.preferred_days || [],
                        preferred_time_start: teacherPref.preferred_time_start || null,
                        preferred_time_end: teacherPref.preferred_time_end || null,
                    }));
                }
            } catch (err) {
                console.error('Error loading teacher preferences:', err);
            }
        }
    };

    const handleEditSave = async () => {
        if (!editUser) return;
        setEditError(null);
        setEditSaving(true);
        try {
            // Update profile data
            const updateData: ProfileData = {
                id: editUser.id,
                last_name: editForm.last_name || null,
                first_name: editForm.first_name || null,
                middle_initial: editForm.middle_initial || null,
                suffix: editForm.suffix || null,
                full_name: editForm.full_name,
                role: editForm.role,
                email: editForm.email,
                department: editForm.department || null,
                program: editForm.program || null,
                year_level: editForm.year_level ? parseInt(editForm.year_level) : null,
                section: editForm.section || null,
            };
            const { error } = await supabase.from('profiles').update(updateData).eq('id', editUser.id);
            if (error) throw error;

            // Update teachers table department if role is teacher
            if (editForm.role === 'teacher') {
                // First check if teacher record exists
                const { data: teacherRecord } = await supabase
                    .from('teachers')
                    .select('id')
                    .eq('profile_id', editUser.id)
                    .single();
                
                if (teacherRecord) {
                    // Update existing teacher record with all generation fields
                    const { error: teacherError } = await supabase
                        .from('teachers')
                        .update({ 
                            department: editForm.department || null,
                            max_hours: editForm.max_hours,
                            max_hours_per_day: editForm.max_hours_per_day,
                            weight: editForm.priority_flag,
                            shared_assignment: editForm.is_shared,
                            preferred_days: editForm.preferred_days,
                            preferred_time_start: editForm.preferred_time_start,
                            preferred_time_end: editForm.preferred_time_end,
                            max_classes_per_day: editForm.max_daily_load,
                            max_consecutive_classes: editForm.max_consecutive_classes,
                        })
                        .eq('profile_id', editUser.id);
                    if (teacherError) throw teacherError;
                } else {
                    // Create teacher record if it doesn't exist
                    const { error: createTeacherError } = await supabase
                        .from('teachers')
                        .insert({
                            profile_id: editUser.id,
                            department: editForm.department || 'General',
                            employment_type: 'full-time',
                            is_public: true,
                            max_hours: editForm.max_hours,
                            max_hours_per_day: editForm.max_hours_per_day,
                            weight: editForm.priority_flag,
                            shared_assignment: editForm.is_shared,
                            preferred_days: editForm.preferred_days,
                            preferred_time_start: editForm.preferred_time_start,
                            preferred_time_end: editForm.preferred_time_end,
                            max_classes_per_day: editForm.max_daily_load,
                            max_consecutive_classes: editForm.max_consecutive_classes,
                        });
                    if (createTeacherError) throw createTeacherError;
                }
                
                // Update teacher preferences record
                const { data: prefRecord } = await supabase
                    .from('teacher_preferences')
                    .select('id')
                    .eq('teacher_id', editUser.id)
                    .single();
                
                if (prefRecord) {
                    const { error: prefError } = await supabase
                        .from('teacher_preferences')
                        .update({
                            max_hours: editForm.max_hours,
                            weight: editForm.priority_flag,
                            shared_assignment: editForm.is_shared,
                            preferred_days: editForm.preferred_days,
                            preferred_time_start: editForm.preferred_time_start,
                            preferred_time_end: editForm.preferred_time_end,
                            max_classes_per_day: editForm.max_daily_load,
                            max_consecutive_classes: editForm.max_consecutive_classes,
                            max_daily_load: editForm.max_daily_load,
                        })
                        .eq('teacher_id', editUser.id);
                    if (prefError) throw prefError;
                } else {
                    const { error: createPrefError } = await supabase
                        .from('teacher_preferences')
                        .insert({
                            teacher_id: editUser.id,
                            max_hours: editForm.max_hours,
                            weight: editForm.priority_flag,
                            shared_assignment: editForm.is_shared,
                            preferred_days: editForm.preferred_days,
                            preferred_time_start: editForm.preferred_time_start,
                            preferred_time_end: editForm.preferred_time_end,
                            max_classes_per_day: editForm.max_daily_load,
                            max_consecutive_classes: editForm.max_consecutive_classes,
                            max_daily_load: editForm.max_daily_load,
                        });
                    if (createPrefError) throw createPrefError;
                }
            }

            // Update additional_roles via Edge Function (requires service role)
            if (editForm.role === 'teacher') {
                const { error: rolesError } = await supabase.functions.invoke('set-additional-roles', {
                    body: { userId: editUser.id, additionalRoles: editAdditionalRoles }
                });
                if (rolesError) {
                    console.error('Error updating additional roles:', rolesError);
                    // Don't fail the entire save if additional roles fail, just log it
                }
            } else {
                // Clear additional roles if primary role is not teacher
                const { error: clearError } = await supabase.functions.invoke('set-additional-roles', {
                    body: { userId: editUser.id, additionalRoles: [] }
                });
                if (clearError) {
                    console.error('Error clearing additional roles:', clearError);
                }
            }

            setShowEditModal(false);
            fetchUsers();
        } catch (err: unknown) {
            setEditError(err instanceof Error ? err.message : 'Failed to update user.');
        } finally {
            setEditSaving(false);
        }
    };

    // ── DELETE ──
    const handleDelete = async (user: UserProfile) => {
        if (['admin', 'power_admin'].includes(user.role)) {
            alert('Cannot delete the Power Admin account.');
            return;
        }
        if (!confirm(`Delete ${user.full_name || user.email}? This cannot be undone.`)) return;
        try {
            // NOTE: Deleting auth user requires service role - move to Edge Function
            // For now, only delete profile (auth user remains orphaned)
            await supabase.from('teachers').delete().eq('profile_id', user.id);
            await supabase.from('profiles').delete().eq('id', user.id);
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
    const renderRoleFields = (role: string, values: Record<string, string>, onChange: (field: string, value: string) => void) => {
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
                    <select
                        className="input"
                        value={values.department || ''}
                        onChange={e => onChange('department', e.target.value)}
                        style={{ appearance: 'auto' }}
                    >
                        <option value="">Select Department</option>
                        {DEPARTMENT_OPTIONS.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
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
                                <th>
                                    <button
                                        onClick={() => handleSort('full_name')}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}
                                    >
                                        Name
                                        {sortColumn === 'full_name' && (
                                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                        )}
                                    </button>
                                </th>
                                <th>
                                    <button
                                        onClick={() => handleSort('email')}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}
                                    >
                                        Email
                                        {sortColumn === 'email' && (
                                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                        )}
                                    </button>
                                </th>
                                <th style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                    <button
                                        onClick={() => handleSort('role')}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', justifyContent: 'center', width: '100%' }}
                                    >
                                        Role
                                        {sortColumn === 'role' && (
                                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                        )}
                                    </button>
                                </th>
                                <th>
                                    <button
                                        onClick={() => handleSort('section_dept')}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}
                                    >
                                        Section / Dept
                                        {sortColumn === 'section_dept' && (
                                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                        )}
                                    </button>
                                </th>
                                <th>
                                    <button
                                        onClick={() => handleSort('program_year')}
                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}
                                    >
                                        Program / Year
                                        {sortColumn === 'program_year' && (
                                            sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                        )}
                                    </button>
                                </th>
                                <th style={{ width: 140 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedFiltered.map(user => (
                                <tr key={user.id}>
                                    <td style={{ fontWeight: 600 }}>{user.full_name || 'Unnamed'}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{user.email}</td>
                                    <td style={{ verticalAlign: 'middle', textAlign: 'center' }}><span className={getBadgeClass(user.role)}>{getRoleLabel(user.role)}</span></td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                        {user.section || user.department || '-'}
                                    </td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                                        {user.program ? `${user.program}${user.year_level ? ` • Year ${user.year_level}` : ''}` : '-'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {canEditUserByRole(user.role) && user.id !== currentUser?.id && (
                                                <>
                                                    <button className="btn btn-ghost" style={{ padding: 6 }} aria-label={`Edit user ${user.full_name || user.email}`} onClick={() => openEditModal(user)}>
                                                        <Edit3 size={15} style={{ color: 'var(--accent-primary)' }} />
                                                    </button>
                                                </>
                                            )}
                                            {!['admin', 'power_admin'].includes(user.role) && (
                                                <button className="btn btn-ghost" style={{ padding: 6 }} aria-label={`Delete user ${user.full_name || user.email}`} onClick={() => handleDelete(user)}>
                                                    <Trash2 size={15} style={{ color: 'var(--accent-error)' }} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {sortedFiltered.length === 0 && (
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
                            <button className="btn btn-ghost" onClick={() => setShowCreateModal(false)} aria-label="Close modal"><X size={20} /></button>
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                                <div className="field">
                                    <label className="field-label">LAST NAME</label>
                                    <input className="input" placeholder="e.g. Dela Cruz" value={newUser.lastName} onChange={e => setNewUser(p => ({
                                        ...p,
                                        lastName: e.target.value,
                                        fullName: combineFullName(e.target.value, p.firstName, p.middleInitial, p.suffix)
                                    }))} required />
                                </div>
                                <div className="field">
                                    <label className="field-label">FIRST NAME</label>
                                    <input className="input" placeholder="e.g. Juan" value={newUser.firstName} onChange={e => setNewUser(p => ({
                                        ...p,
                                        firstName: e.target.value,
                                        fullName: combineFullName(p.lastName, e.target.value, p.middleInitial, p.suffix)
                                    }))} required />
                                </div>
                                <div className="field">
                                    <label className="field-label">MIDDLE INITIAL (optional)</label>
                                    <input className="input" placeholder="A" maxLength={1} value={newUser.middleInitial} onChange={e => setNewUser(p => ({
                                        ...p,
                                        middleInitial: e.target.value,
                                        fullName: combineFullName(p.lastName, p.firstName, e.target.value, p.suffix)
                                    }))} />
                                </div>
                                <div className="field">
                                    <label className="field-label">SUFFIX (optional)</label>
                                    <input className="input" placeholder="Jr., Sr., II, III" value={newUser.suffix} onChange={e => setNewUser(p => ({
                                        ...p,
                                        suffix: e.target.value,
                                        fullName: combineFullName(p.lastName, p.firstName, p.middleInitial, e.target.value)
                                    }))} />
                                </div>
                            </div>
                            <div className="field">
                                <label className="field-label">FULL NAME (preview)</label>
                                <div style={{
                                    padding: '10px 12px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-default)',
                                    fontSize: 14,
                                    color: 'var(--text-primary)',
                                    fontStyle: 'italic'
                                }}>
                                    {newUser.fullName || 'Enter name components to see preview'}
                                </div>
                            </div>
                            <div className="field">
                                <label className="field-label">STUDENT / EMPLOYEE ID</label>
                                <input className="input" placeholder="e.g. 02000123456" value={newUser.studentId} onChange={e => setNewUser(p => ({ ...p, studentId: e.target.value }))} />
                            </div>

                            {/* Role-specific fields */}
                            {renderRoleFields(newUser.role, {
                                lastName: newUser.lastName,
                                firstName: newUser.firstName,
                                middleInitial: newUser.middleInitial,
                                suffix: newUser.suffix,
                                fullName: newUser.fullName,
                                email: newUser.email,
                                password: newUser.password,
                                role: newUser.role,
                                studentId: newUser.studentId,
                                section: newUser.section,
                                program: newUser.program,
                                yearLevel: newUser.yearLevel,
                                department: newUser.department,
                            }, (field, value) => setNewUser(p => ({ ...p, [field]: value })))}

                            {/* Teacher-specific fields for generation */}
                            {TEACHER_ROLES.includes(newUser.role) && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 16 }}>
                                        <div className="field">
                                            <label className="field-label">MAX HOURS (WEEKLY)</label>
                                            <input className="input" type="number" min={1} max={60} value={newUser.max_hours} onChange={e => setNewUser(p => ({ ...p, max_hours: parseInt(e.target.value) || 40 }))} />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">MAX HOURS PER DAY</label>
                                            <input className="input" type="number" min={1} max={12} value={newUser.max_hours_per_day} onChange={e => setNewUser(p => ({ ...p, max_hours_per_day: parseInt(e.target.value) || 8 }))} />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">PRIORITY (0-100)</label>
                                            <input className="input" type="number" min={0} max={100} value={newUser.priority_flag} onChange={e => setNewUser(p => ({ ...p, priority_flag: parseInt(e.target.value) || 50 }))} />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">MAX CONSECUTIVE CLASSES</label>
                                            <input className="input" type="number" min={1} max={6} value={newUser.max_consecutive_classes || ''} onChange={e => setNewUser(p => ({ ...p, max_consecutive_classes: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Optional" />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">MAX DAILY LOAD</label>
                                            <input className="input" type="number" min={1} max={10} value={newUser.max_daily_load || ''} onChange={e => setNewUser(p => ({ ...p, max_daily_load: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Optional" />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">PREFERRED START TIME</label>
                                            <input className="input" type="time" value={newUser.preferred_time_start || ''} onChange={e => setNewUser(p => ({ ...p, preferred_time_start: e.target.value || null }))} />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">PREFERRED END TIME</label>
                                            <input className="input" type="time" value={newUser.preferred_time_end || ''} onChange={e => setNewUser(p => ({ ...p, preferred_time_end: e.target.value || null }))} />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 16 }}>
                                        <label className="field-label">PREFERRED DAYS</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                                                <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                                                    <input type="checkbox" checked={newUser.preferred_days.includes(day)} onChange={e => {
                                                        if (e.target.checked) {
                                                            setNewUser(p => ({ ...p, preferred_days: [...p.preferred_days, day] }));
                                                        } else {
                                                            setNewUser(p => ({ ...p, preferred_days: p.preferred_days.filter(d => d !== day) }));
                                                        }
                                                    }} />
                                                    {day}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="field" style={{ marginTop: 16 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={newUser.is_shared} onChange={e => setNewUser(p => ({ ...p, is_shared: e.target.checked }))} />
                                            Allow Shared Assignment (teaches across multiple programs)
                                        </label>
                                    </div>
                                </>
                            )}

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
                                <div className="login-error" role="alert" aria-live="polite">{formError}</div>
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
                            <button className="btn btn-ghost" onClick={() => setShowEditModal(false)} aria-label="Close modal"><X size={20} /></button>
                        </div>
                        <div className="modal-form">
                            {(() => {
                                const isPowerUser = POWER_ADMIN_ROLES.includes(editUser.role as UserRole);
                                const isStudentPrimary = editForm.role === 'student';
                                const isTeacherPrimary = editForm.role === 'teacher';

                                const primaryOptions = SELECTABLE_ROLE_DISPLAY.filter(r => {
                                    if (isTeacherPrimary && TEACHER_ADDABLE_ROLES.includes(r.value)) return false;
                                    return true;
                                });

                                const handlePrimaryChange = (newPrimary: string) => {
                                    setEditForm(p => ({ ...p, role: newPrimary }));
                                    // Clear additional roles when switching away from teacher
                                    if (newPrimary !== 'teacher') setEditAdditionalRoles([]);
                                };

                                const handleToggleAdditional = (addRole: string) => {
                                    setEditAdditionalRoles(prev => {
                                        if (prev.includes(addRole)) return prev.filter(r => r !== addRole);
                                        return [...prev, addRole];
                                    });
                                };

                                return (
                                    <>
                                        <div className="field">
                                            <label className="field-label">PRIMARY ROLE</label>
                                            <select className="input" value={editForm.role}
                                                onChange={e => handlePrimaryChange(e.target.value)}
                                                style={{ appearance: 'auto' }}
                                                disabled={isPowerUser}
                                            >
                                                {primaryOptions.map(r => (
                                                    <option key={r.value} value={r.value}>{r.label}</option>
                                                ))}
                                            </select>
                                            {isPowerUser && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Power Admin role cannot be changed</span>}
                                        </div>

                                        {isTeacherPrimary && (
                                            <div className="field">
                                                <label className="field-label">ADDITIONAL ROLES</label>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {TEACHER_ADDABLE_ROLES.map(ar => (
                                                        <label key={ar} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: editAdditionalRoles.includes(ar) ? 'rgba(59,130,246,0.1)' : 'var(--bg-secondary)', border: editAdditionalRoles.includes(ar) ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border-default)', transition: 'all 0.2s' }}>
                                                            <input type="checkbox" checked={editAdditionalRoles.includes(ar)} onChange={() => handleToggleAdditional(ar)} style={{ accentColor: 'var(--accent-primary)' }} />
                                                            <div>
                                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{ROLE_DISPLAY_NAMES[ar]}</div>
                                                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ar === 'schedule_admin' ? 'Can approve/reject schedules' : 'Can create & manage schedules'}</div>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Teachers can also hold schedule management roles</span>
                                            </div>
                                        )}

                                        {isStudentPrimary && (
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>Students cannot have multiple roles.</div>
                                        )}
                                    </>
                                );
                            })()}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                                <div className="field">
                                    <label className="field-label">LAST NAME</label>
                                    <input className="input" placeholder="e.g. Dela Cruz" value={editForm.last_name} onChange={e => setEditForm(p => ({
                                        ...p,
                                        last_name: e.target.value,
                                        full_name: combineFullName(e.target.value, p.first_name, p.middle_initial, p.suffix)
                                    }))} />
                                </div>
                                <div className="field">
                                    <label className="field-label">FIRST NAME</label>
                                    <input className="input" placeholder="e.g. Juan" value={editForm.first_name} onChange={e => setEditForm(p => ({
                                        ...p,
                                        first_name: e.target.value,
                                        full_name: combineFullName(p.last_name, e.target.value, p.middle_initial, p.suffix)
                                    }))} />
                                </div>
                                <div className="field">
                                    <label className="field-label">MIDDLE INITIAL (optional)</label>
                                    <input className="input" placeholder="A" maxLength={1} value={editForm.middle_initial || ''} onChange={e => setEditForm(p => ({
                                        ...p,
                                        middle_initial: e.target.value,
                                        full_name: combineFullName(p.last_name, p.first_name, e.target.value, p.suffix)
                                    }))} />
                                </div>
                                <div className="field">
                                    <label className="field-label">SUFFIX (optional)</label>
                                    <input className="input" placeholder="Jr., Sr., II, III" value={editForm.suffix || ''} onChange={e => setEditForm(p => ({
                                        ...p,
                                        suffix: e.target.value,
                                        full_name: combineFullName(p.last_name, p.first_name, p.middle_initial, e.target.value)
                                    }))} />
                                </div>
                            </div>
                            <div className="field">
                                <label className="field-label">FULL NAME (preview)</label>
                                <div style={{
                                    padding: '10px 12px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-default)',
                                    fontSize: 14,
                                    color: 'var(--text-primary)',
                                    fontStyle: 'italic'
                                }}>
                                    {editForm.full_name || 'Enter name components to see preview'}
                                </div>
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
                                    <select
                                        className="input"
                                        value={editForm.department}
                                        onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
                                        style={{ appearance: 'auto' }}
                                    >
                                        <option value="">Select Department</option>
                                        {DEPARTMENT_OPTIONS.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Teacher-specific fields for generation */}
                            {TEACHER_ROLES.includes(editForm.role) && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 16 }}>
                                        <div className="field">
                                            <label className="field-label">MAX HOURS (WEEKLY)</label>
                                            <input className="input" type="number" min={1} max={60} value={editForm.max_hours} onChange={e => setEditForm(p => ({ ...p, max_hours: parseInt(e.target.value) || 40 }))} />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">MAX HOURS PER DAY</label>
                                            <input className="input" type="number" min={1} max={12} value={editForm.max_hours_per_day} onChange={e => setEditForm(p => ({ ...p, max_hours_per_day: parseInt(e.target.value) || 8 }))} />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">PRIORITY (0-100)</label>
                                            <input className="input" type="number" min={0} max={100} value={editForm.priority_flag} onChange={e => setEditForm(p => ({ ...p, priority_flag: parseInt(e.target.value) || 50 }))} />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">MAX CONSECUTIVE CLASSES</label>
                                            <input className="input" type="number" min={1} max={6} value={editForm.max_consecutive_classes || ''} onChange={e => setEditForm(p => ({ ...p, max_consecutive_classes: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Optional" />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">MAX DAILY LOAD</label>
                                            <input className="input" type="number" min={1} max={10} value={editForm.max_daily_load || ''} onChange={e => setEditForm(p => ({ ...p, max_daily_load: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Optional" />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">PREFERRED START TIME</label>
                                            <input className="input" type="time" value={editForm.preferred_time_start || ''} onChange={e => setEditForm(p => ({ ...p, preferred_time_start: e.target.value || null }))} />
                                        </div>
                                        <div className="field">
                                            <label className="field-label">PREFERRED END TIME</label>
                                            <input className="input" type="time" value={editForm.preferred_time_end || ''} onChange={e => setEditForm(p => ({ ...p, preferred_time_end: e.target.value || null }))} />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 16 }}>
                                        <label className="field-label">PREFERRED DAYS</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                                                <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                                                    <input type="checkbox" checked={editForm.preferred_days.includes(day)} onChange={e => {
                                                        if (e.target.checked) {
                                                            setEditForm(p => ({ ...p, preferred_days: [...p.preferred_days, day] }));
                                                        } else {
                                                            setEditForm(p => ({ ...p, preferred_days: p.preferred_days.filter(d => d !== day) }));
                                                        }
                                                    }} />
                                                    {day}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="field" style={{ marginTop: 16 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={editForm.is_shared} onChange={e => setEditForm(p => ({ ...p, is_shared: e.target.checked }))} />
                                            Allow Shared Assignment (teaches across multiple programs)
                                        </label>
                                    </div>
                                </>
                            )}

                            {editError && <div className="login-error" role="alert" aria-live="polite">{editError}</div>}

                            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={editSaving} onClick={handleEditSave}>
                                {editSaving ? <><Loader2 size={16} className="spin" /> Saving...</> : 'Save Changes'}
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
