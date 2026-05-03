import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CREATABLE_ROLES, ROLE_DISPLAY_NAMES } from '../../types/database';
import type { UserRole } from '../../types/database';
import { 
    ArrowLeft, UserPlus, Save, X, Loader2, CheckCircle, 
    AlertCircle, Upload, BookOpen, Building2,
    Shield, Users
} from 'lucide-react';
import styles from './AddUser.module.css';

interface Department {
    id: string;
    name: string;
}

interface Subject {
    id: string;
    name: string;
    code: string;
}

interface Section {
    id: string;
    name: string;
    program: string | null;
    year_level: number | null;
}

interface Program {
    name: string;
}

interface AvailabilitySlot {
    day: string;
    start_time: string;
    end_time: string;
}

interface ProfileUpdate {
    id: string;
    full_name: string;
    role: string;
    email: string;
    id_number?: string | null;
    avatar_url?: string | null;
    section?: string | null;
    program?: string | null;
    year_level?: number | null;
    student_type?: 'shs' | 'college' | null;
    department?: string | null;
    access_permissions?: {
        canApproveSchedules: boolean;
        canManageSchedules: boolean;
        canViewAllDepartments: boolean;
        canManageUsers: boolean;
    } | null;
}

const EMAIL_DOMAIN = 'meycauayan.sti.edu.ph';
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
    '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

const AddUser: React.FC = () => {
    const navigate = useNavigate();
    const { role: currentRole } = useAuth();
    
    const [step, setStep] = useState<'form' | 'confirm'>('form');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Database data
    const [departments, setDepartments] = useState<Department[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [programs, setPrograms] = useState<Program[]>([]);
    
    // Form state
    const [formData, setFormData] = useState({
        // Basic info
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'student' as string,
        idNumber: '',
        avatarUrl: '',
        
        // Student fields
        studentType: 'college' as 'shs' | 'college',
        section: '',
        program: '',
        yearLevel: '',
        
        // Teacher fields
        department: '',
        selectedSubjects: [] as string[],
        employmentStatus: 'full-time' as 'full-time' | 'part-time',
        availability: [] as AvailabilitySlot[],
        
        // Schedule Manager fields
        accessPermissions: {
            canApproveSchedules: false,
            canManageSchedules: false,
            canViewAllDepartments: false,
            canManageUsers: false,
        },
    });
    
    const creatableRoles = currentRole ? (CREATABLE_ROLES[currentRole] || []) : [];
    
    useEffect(() => {
        fetchDatabaseData();
    }, []);
    
    const fetchDatabaseData = async () => {
        setLoading(true);
        try {
            // Use hardcoded department list (department is stored as text field, not a separate table)
            const hardcodedDepartments = [
                { id: 'cs', name: 'Computer Science' },
                { id: 'it', name: 'Information Technology' },
                { id: 'hm', name: 'Hospitality Management' },
                { id: 'ba', name: 'Business Administration' },
                { id: 'eng', name: 'Engineering' },
                { id: 'arts', name: 'Arts and Sciences' },
            ];
            setDepartments(hardcodedDepartments);
            
            // Fetch subjects
            const { data: subjectData } = await supabase
                .from('subjects')
                .select('id, name, code')
                .order('name', { ascending: true });
            setSubjects(subjectData || []);
            
            // Fetch sections
            const { data: sectionData } = await supabase
                .from('sections')
                .select('id, name, program, year_level')
                .order('name', { ascending: true });
            setSections(sectionData || []);
            
            // Fetch unique programs from sections
            const uniquePrograms = new Set(
                (sectionData || [])
                    .map(s => s.program)
                    .filter((p): p is string => p !== null)
            );
            setPrograms(Array.from(uniquePrograms).map(name => ({ name })));
            
        } catch (err) {
            console.error('Error fetching database data:', err);
            setError('Failed to load required data from database.');
        } finally {
            setLoading(false);
        }
    };
    
    const generateEmail = (fullName: string, idNumber: string) => {
        const nameParts = fullName.trim().split(' ');
        const surname = nameParts[nameParts.length - 1]?.toLowerCase() || 'user';
        const idStr = idNumber?.trim() || Math.random().toString(36).slice(-6);
        const last6 = idStr.slice(-6);
        return `${surname}.${last6}@${EMAIL_DOMAIN}`;
    };
    
    const checkDuplicates = async (): Promise<boolean> => {
        setError(null);
        
        // Check email if provided
        if (formData.email) {
            const { data: emailCheck } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', formData.email)
                .single();
            if (emailCheck) {
                setError('This email is already registered.');
                return false;
            }
        }
        
        // Check ID number if provided
        if (formData.idNumber) {
            const { data: idCheck } = await supabase
                .from('profiles')
                .select('id')
                .eq('id_number', formData.idNumber)
                .single();
            if (idCheck) {
                setError('This ID number is already in use.');
                return false;
            }
        }
        
        return true;
    };
    
    const validateForm = (): boolean => {
        setError(null);
        
        // Basic validation
        if (!formData.fullName || !formData.password) {
            setError('Please fill in all required fields.');
            return false;
        }
        
        if (!/^[a-zA-Z\s.-]+$/.test(formData.fullName)) {
            setError('Name can only contain letters, spaces, dots, and hyphens.');
            return false;
        }
        
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters.');
            return false;
        }
        
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match.');
            return false;
        }
        
        if (!creatableRoles.includes(formData.role as UserRole)) {
            setError('You do not have permission to create this role.');
            return false;
        }
        
        // Role-specific validation
        if (formData.role === 'student') {
            if (!formData.studentType) {
                setError('Please select student type.');
                return false;
            }
            
            if (formData.studentType === 'college') {
                if (!formData.program) {
                    setError('Please select a program for college student.');
                    return false;
                }
                if (!formData.yearLevel) {
                    setError('Please select year level for college student.');
                    return false;
                }
            }
            
            if (!formData.section) {
                setError('Please select a section.');
                return false;
            }
        }
        
        if (formData.role === 'teacher') {
            if (!formData.department) {
                setError('Please select a department.');
                return false;
            }
            if (formData.selectedSubjects.length === 0) {
                setError('Please select at least one subject the teacher can teach.');
                return false;
            }
            if (formData.availability.length === 0) {
                setError('Please set at least one availability slot.');
                return false;
            }
        }
        
        if (formData.role === 'schedule_manager') {
            if (!formData.department) {
                setError('Please select a department.');
                return false;
            }
        }
        
        return true;
    };
    
    const handleNextStep = async () => {
        if (!validateForm()) return;
        
        const duplicatesOk = await checkDuplicates();
        if (duplicatesOk) {
            setStep('confirm');
        }
    };
    
    const handleCreateUser = async () => {
        setSaving(true);
        setError(null);
        
        try {
            let email = formData.email.trim();
            if (!email) {
                email = generateEmail(formData.fullName, formData.idNumber);
            }
            
            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password: formData.password,
                options: {
                    data: {
                        role: formData.role,
                        full_name: formData.fullName,
                    },
                },
            });
            
            if (authError) throw authError;
            
            const userId = authData.user?.id;
            if (!userId) throw new Error('Failed to create user account.');
            
            // Wait for profile creation trigger
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update profile with role-specific data
            const profileUpdate: ProfileUpdate = {
                id: userId,
                full_name: formData.fullName,
                role: formData.role,
                email,
                id_number: formData.idNumber || null,
                avatar_url: formData.avatarUrl || null,
            };
            
            // Student-specific fields
            if (formData.role === 'student') {
                profileUpdate.section = formData.section;
                profileUpdate.program = formData.program || null;
                profileUpdate.year_level = formData.yearLevel ? parseInt(formData.yearLevel) : null;
                profileUpdate.student_type = formData.studentType;
            }
            
            // Teacher-specific fields
            if (formData.role === 'teacher') {
                profileUpdate.department = formData.department;
                // employment_type is stored in teachers table, not profiles
            }
            
            // Schedule Manager-specific fields
            if (formData.role === 'schedule_manager') {
                profileUpdate.department = formData.department;
                profileUpdate.access_permissions = formData.accessPermissions;
            }
            
            const { error: profileError } = await supabase
                .from('profiles')
                .update(profileUpdate)
                .eq('id', userId);
            
            if (profileError) throw profileError;
            
            // Create teacher record if role is teacher
            if (formData.role === 'teacher') {
                const { error: teacherError } = await supabase.from('teachers').insert({
                    profile_id: userId,
                    department: formData.department,
                    employment_type: formData.employmentStatus,
                    is_public: true,
                });
                
                if (teacherError) throw teacherError;
                
                // Add teacher preferences for availability
                const { error: prefError } = await supabase.from('teacher_preferences').insert({
                    teacher_id: userId,
                    preferred_days: formData.availability.map(a => a.day),
                    preferred_time_start: formData.availability[0]?.start_time || '08:00',
                    preferred_time_end: formData.availability[0]?.end_time || '17:00',
                });
                
                if (prefError) console.error('Error creating teacher preferences:', prefError);
                
                // Link subjects to teacher by updating subjects table
                if (formData.selectedSubjects.length > 0) {
                    for (const subjectId of formData.selectedSubjects) {
                        await supabase.from('subjects').update({ teacher_id: userId }).eq('id', subjectId);
                    }
                }
            }
            
            // Create student record if role is student
            if (formData.role === 'student') {
                // Find the section ID based on section name
                const { data: sectionData } = await supabase
                    .from('sections')
                    .select('id')
                    .eq('name', formData.section)
                    .single();
                
                if (sectionData) {
                    await supabase.from('students').insert({
                        profile_id: userId,
                        section_id: sectionData.id,
                        student_number: formData.idNumber || null,
                        is_active: true,
                    });
                }
            }
            
            // Success - navigate back to user management
            navigate('/admin/users', { 
                state: { message: 'User created successfully!', type: 'success' } 
            });
            
        } catch (err) {
            console.error('Create user error:', err);
            setError(err instanceof Error ? err.message : 'Failed to create user.');
        } finally {
            setSaving(false);
        }
    };
    
    const addAvailabilitySlot = () => {
        setFormData(prev => ({
            ...prev,
            availability: [
                ...prev.availability,
                { day: 'Monday', start_time: '08:00', end_time: '17:00' }
            ]
        }));
    };
    
    const removeAvailabilitySlot = (index: number) => {
        setFormData(prev => ({
            ...prev,
            availability: prev.availability.filter((_, i) => i !== index)
        }));
    };
    
    const updateAvailabilitySlot = (index: number, field: keyof AvailabilitySlot, value: string) => {
        setFormData(prev => ({
            ...prev,
            availability: prev.availability.map((slot, i) => 
                i === index ? { ...slot, [field]: value } : slot
            )
        }));
    };
    
    const toggleSubject = (subjectId: string) => {
        setFormData(prev => ({
            ...prev,
            selectedSubjects: prev.selectedSubjects.includes(subjectId)
                ? prev.selectedSubjects.filter(id => id !== subjectId)
                : [...prev.selectedSubjects, subjectId]
        }));
    };
    
    const filteredSections = formData.program
        ? sections.filter(s => s.program === formData.program)
        : sections;
    
    const filteredSubjects = subjects; // No department filtering since subjects don't have department_id
    
    if (loading) {
        return (
            <div className="dashboard fade-in">
                <div className={styles.addUserContainer}>
                    <Loader2 className="spin" size={32} />
                </div>
            </div>
        );
    }
    
    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <button 
                    className="btn btn-ghost btn-icon" 
                    onClick={() => navigate('/admin/users')}
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="dashboard-title"><UserPlus size={20} /> Add New User</h1>
                    <p className="dashboard-subtitle">Create a new user account with role-specific information</p>
                </div>
            </div>
            
            {step === 'form' && (
                <div className={`card ${styles.addUserCard}`}>
                    <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }}>
                        {/* Role Selection */}
                        <div style={{ marginBottom: 32 }}>
                            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Shield size={18} style={{ color: 'var(--accent-primary)' }} />
                                Select Role
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                {creatableRoles.map(role => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, role }))}
                                        style={{
                                            padding: 16,
                                            borderRadius: 'var(--radius-lg)',
                                            border: `2px solid ${formData.role === role ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                            background: formData.role === role ? 'var(--accent-primary-subtle)' : 'var(--bg-surface)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {ROLE_DISPLAY_NAMES[role]}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                            {role === 'student' && 'Student account with academic information'}
                                            {role === 'teacher' && 'Teacher with subject assignments and availability'}
                                            {role === 'schedule_manager' && 'Schedule manager with department access'}
                                            {role === 'admin' && 'Administrator with system access'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* Basic Information */}
                        <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid var(--border-default)' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <UserPlus size={18} style={{ color: 'var(--accent-primary)' }} />
                                Basic Information
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        FULL NAME *
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Juan Dela Cruz"
                                        value={formData.fullName}
                                        onChange={e => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        ID NUMBER
                                    </label>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="e.g. 02000123456"
                                        value={formData.idNumber}
                                        onChange={e => setFormData(prev => ({ ...prev, idNumber: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        EMAIL
                                    </label>
                                    <input
                                        type="email"
                                        className="input"
                                        placeholder={formData.role === 'student' ? 'Auto-generated if blank' : 'Leave blank for auto-generate'}
                                        value={formData.email}
                                        onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                    />
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                                        Format: surname.last6digits@{EMAIL_DOMAIN}
                                    </span>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        PASSWORD *
                                    </label>
                                    <input
                                        type="password"
                                        className="input"
                                        placeholder="Min 8 characters"
                                        value={formData.password}
                                        onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        CONFIRM PASSWORD *
                                    </label>
                                    <input
                                        type="password"
                                        className="input"
                                        placeholder="Re-enter password"
                                        value={formData.confirmPassword}
                                        onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        PROFILE PHOTO (Optional)
                                    </label>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Avatar URL"
                                            value={formData.avatarUrl}
                                            onChange={e => setFormData(prev => ({ ...prev, avatarUrl: e.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => {/* TODO: Implement file upload */}}
                                            style={{ padding: 8 }}
                                        >
                                            <Upload size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Role-Specific Fields */}
                        {formData.role === 'student' && (
                            <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid var(--border-default)' }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Users size={18} style={{ color: 'var(--accent-primary)' }} />
                                    Student Information
                                </h3>
                                
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        STUDENT TYPE *
                                    </label>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, studentType: 'shs', program: '', section: '' }))}
                                            style={{
                                                flex: 1,
                                                padding: 12,
                                                borderRadius: 'var(--radius-md)',
                                                border: `2px solid ${formData.studentType === 'shs' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                                background: formData.studentType === 'shs' ? 'var(--accent-primary-subtle)' : 'var(--bg-surface)',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                fontSize: 13,
                                            }}
                                        >
                                            Senior High School
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, studentType: 'college', program: '', section: '' }))}
                                            style={{
                                                flex: 1,
                                                padding: 12,
                                                borderRadius: 'var(--radius-md)',
                                                border: `2px solid ${formData.studentType === 'college' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                                background: formData.studentType === 'college' ? 'var(--accent-primary-subtle)' : 'var(--bg-surface)',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                fontSize: 13,
                                            }}
                                        >
                                            College
                                        </button>
                                    </div>
                                </div>
                                
                                {formData.studentType === 'college' && (
                                    <>
                                        <div style={{ marginBottom: 16 }}>
                                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                                PROGRAM *
                                            </label>
                                            <select
                                                className="input"
                                                value={formData.program}
                                                onChange={e => setFormData(prev => ({ ...prev, program: e.target.value, section: '' }))}
                                                style={{ appearance: 'auto' }}
                                                required
                                            >
                                                <option value="">Select Program</option>
                                                {programs.map(prog => (
                                                    <option key={prog.name} value={prog.name}>{prog.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        
                                        <div style={{ marginBottom: 16 }}>
                                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                                YEAR LEVEL *
                                            </label>
                                            <select
                                                className="input"
                                                value={formData.yearLevel}
                                                onChange={e => setFormData(prev => ({ ...prev, yearLevel: e.target.value }))}
                                                style={{ appearance: 'auto' }}
                                                required
                                            >
                                                <option value="">Select Year Level</option>
                                                <option value="1">1st Year</option>
                                                <option value="2">2nd Year</option>
                                                <option value="3">3rd Year</option>
                                                <option value="4">4th Year</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                                
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        SECTION *
                                    </label>
                                    <select
                                        className="input"
                                        value={formData.section}
                                        onChange={e => setFormData(prev => ({ ...prev, section: e.target.value }))}
                                        style={{ appearance: 'auto' }}
                                        required
                                        disabled={formData.studentType === 'college' && !formData.program}
                                    >
                                        <option value="">Select Section</option>
                                        {filteredSections.map(section => (
                                            <option key={section.id} value={section.name}>
                                                {section.name} {section.program ? `(${section.program})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {filteredSections.length === 0 && (
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                                            {formData.studentType === 'college' && !formData.program 
                                                ? 'Select a program first to see available sections'
                                                : 'No sections available for this student type'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {formData.role === 'teacher' && (
                            <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid var(--border-default)' }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <BookOpen size={18} style={{ color: 'var(--accent-primary)' }} />
                                    Teacher Information
                                </h3>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                            DEPARTMENT *
                                        </label>
                                        <select
                                            className="input"
                                            value={formData.department}
                                            onChange={e => setFormData(prev => ({ ...prev, department: e.target.value, selectedSubjects: [] }))}
                                            style={{ appearance: 'auto' }}
                                            required
                                        >
                                            <option value="">Select Department</option>
                                            {departments.map(dept => (
                                                <option key={dept.id} value={dept.name}>{dept.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                            EMPLOYMENT STATUS *
                                        </label>
                                        <select
                                            className="input"
                                            value={formData.employmentStatus}
                                            onChange={e => setFormData(prev => ({ ...prev, employmentStatus: e.target.value as 'full-time' | 'part-time' }))}
                                            style={{ appearance: 'auto' }}
                                            required
                                        >
                                            <option value="full-time">Full-time</option>
                                            <option value="part-time">Part-time</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        SUBJECTS THEY CAN TEACH *
                                    </label>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                                        Select at least one subject from the department
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                                        {filteredSubjects.map(subject => (
                                            <label
                                                key={subject.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    padding: 10,
                                                    borderRadius: 'var(--radius-md)',
                                                    border: `1px solid ${formData.selectedSubjects.includes(subject.id) ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                                    background: formData.selectedSubjects.includes(subject.id) ? 'var(--accent-primary-subtle)' : 'var(--bg-surface)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={formData.selectedSubjects.includes(subject.id)}
                                                    onChange={() => toggleSubject(subject.id)}
                                                    style={{ accentColor: 'var(--accent-primary)' }}
                                                />
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {subject.name}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                        {subject.code}
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    {filteredSubjects.length === 0 && (
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            Select a department first to see available subjects
                                        </span>
                                    )}
                                </div>
                                
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                                            AVAILABILITY *
                                        </label>
                                        <button
                                            type="button"
                                            onClick={addAvailabilitySlot}
                                            className="btn btn-secondary"
                                            style={{ padding: '6px 12px', fontSize: 12 }}
                                        >
                                            + Add Slot
                                        </button>
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                                        Define when the teacher is available for scheduling (hard constraint)
                                    </div>
                                    
                                    {formData.availability.map((slot, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr auto auto auto',
                                                gap: 8,
                                                padding: 12,
                                                borderRadius: 'var(--radius-md)',
                                                background: 'var(--bg-surface)',
                                                border: '1px solid var(--border-default)',
                                                marginBottom: 8,
                                            }}
                                        >
                                            <select
                                                className="input"
                                                value={slot.day}
                                                onChange={e => updateAvailabilitySlot(index, 'day', e.target.value)}
                                                style={{ appearance: 'auto' }}
                                            >
                                                {DAYS_OF_WEEK.map(day => (
                                                    <option key={day} value={day}>{day}</option>
                                                ))}
                                            </select>
                                            <select
                                                className="input"
                                                value={slot.start_time}
                                                onChange={e => updateAvailabilitySlot(index, 'start_time', e.target.value)}
                                                style={{ appearance: 'auto' }}
                                            >
                                                {TIME_SLOTS.map(time => (
                                                    <option key={time} value={time}>{time}</option>
                                                ))}
                                            </select>
                                            <select
                                                className="input"
                                                value={slot.end_time}
                                                onChange={e => updateAvailabilitySlot(index, 'end_time', e.target.value)}
                                                style={{ appearance: 'auto' }}
                                            >
                                                {TIME_SLOTS.map(time => (
                                                    <option key={time} value={time}>{time}</option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => removeAvailabilitySlot(index)}
                                                className="btn btn-ghost"
                                                style={{ padding: 8, color: 'var(--accent-error)' }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    {formData.availability.length === 0 && (
                                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                            No availability slots added. Click "+ Add Slot" to add.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {formData.role === 'schedule_manager' && (
                            <div style={{ marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid var(--border-default)' }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Building2 size={18} style={{ color: 'var(--accent-primary)' }} />
                                    Schedule Manager Information
                                </h3>
                                
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                                        DEPARTMENT *
                                    </label>
                                    <select
                                        className="input"
                                        value={formData.department}
                                        onChange={e => setFormData(prev => ({ ...prev, department: e.target.value }))}
                                        style={{ appearance: 'auto' }}
                                        required
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map(dept => (
                                            <option key={dept.id} value={dept.name}>{dept.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
                                        ACCESS PERMISSIONS
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.accessPermissions.canApproveSchedules}
                                                onChange={e => setFormData(prev => ({
                                                    ...prev,
                                                    accessPermissions: { ...prev.accessPermissions, canApproveSchedules: e.target.checked }
                                                }))}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    Approve Schedules
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    Can approve or reject schedule submissions
                                                </div>
                                            </div>
                                        </label>
                                        
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.accessPermissions.canManageSchedules}
                                                onChange={e => setFormData(prev => ({
                                                    ...prev,
                                                    accessPermissions: { ...prev.accessPermissions, canManageSchedules: e.target.checked }
                                                }))}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    Manage Schedules
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    Can create and edit schedules
                                                </div>
                                            </div>
                                        </label>
                                        
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.accessPermissions.canViewAllDepartments}
                                                onChange={e => setFormData(prev => ({
                                                    ...prev,
                                                    accessPermissions: { ...prev.accessPermissions, canViewAllDepartments: e.target.checked }
                                                }))}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    View All Departments
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    Can view schedules from all departments
                                                </div>
                                            </div>
                                        </label>
                                        
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.accessPermissions.canManageUsers}
                                                onChange={e => setFormData(prev => ({
                                                    ...prev,
                                                    accessPermissions: { ...prev.accessPermissions, canManageUsers: e.target.checked }
                                                }))}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    Manage Users
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    Can create and manage user accounts
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {error && (
                            <div style={{
                                padding: 12,
                                borderRadius: 'var(--radius-md)',
                                background: 'rgba(200, 75, 75, 0.1)',
                                border: '1px solid #C84B4B',
                                color: '#C84B4B',
                                fontSize: 13,
                                marginBottom: 20,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                            }}>
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}
                        
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => navigate('/admin/users')}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                Continue to Confirmation
                                <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                            </button>
                        </div>
                    </form>
                </div>
            )}
            
            {step === 'confirm' && (
                <div className="card" style={{ maxWidth: 700, margin: '0 auto' }}>
                    <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border-default)' }}>
                        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CheckCircle size={20} style={{ color: 'var(--accent-success)' }} />
                            Confirm User Creation
                        </h2>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            Please review the information below before creating the user.
                        </p>
                    </div>
                    
                    <div style={{ marginBottom: 24 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Account Information
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                            <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Full Name</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{formData.fullName}</div>
                            </div>
                            <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Role</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{ROLE_DISPLAY_NAMES[formData.role as UserRole]}</div>
                            </div>
                            <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Email</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {formData.email || generateEmail(formData.fullName, formData.idNumber)}
                                </div>
                            </div>
                            <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>ID Number</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{formData.idNumber || 'Not provided'}</div>
                            </div>
                        </div>
                    </div>
                    
                    {formData.role === 'student' && (
                        <div style={{ marginBottom: 24 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                Student Information
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Student Type</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {formData.studentType === 'shs' ? 'Senior High School' : 'College'}
                                    </div>
                                </div>
                                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Section</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{formData.section}</div>
                                </div>
                                {formData.studentType === 'college' && (
                                    <>
                                        <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Program</div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{formData.program}</div>
                                        </div>
                                        <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Year Level</div>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {formData.yearLevel ? `${formData.yearLevel}${getOrdinalSuffix(parseInt(formData.yearLevel))} Year` : 'Not set'}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {formData.role === 'teacher' && (
                        <div style={{ marginBottom: 24 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                Teacher Information
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
                                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Department</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {formData.department || 'Not selected'}
                                    </div>
                                </div>
                                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Employment Status</div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {formData.employmentStatus === 'full-time' ? 'Full-time' : 'Part-time'}
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Subjects ({formData.selectedSubjects.length})</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {formData.selectedSubjects.map(subjectId => {
                                        const subject = subjects.find(s => s.id === subjectId);
                                        return subject ? (
                                            <span
                                                key={subjectId}
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: 'var(--radius-full)',
                                                    background: 'var(--accent-primary-subtle)',
                                                    color: 'var(--accent-primary)',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {subject.name}
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Availability ({formData.availability.length} slots)</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {formData.availability.map((slot, index) => (
                                        <span
                                            key={index}
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: 'var(--radius-full)',
                                                background: 'var(--bg-secondary)',
                                                color: 'var(--text-primary)',
                                                fontSize: 12,
                                            }}
                                        >
                                            {slot.day} ({slot.start_time} - {slot.end_time})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {formData.role === 'schedule_manager' && (
                        <div style={{ marginBottom: 24 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                Schedule Manager Information
                            </h3>
                            <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', marginBottom: 16 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Department</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {formData.department || 'Not selected'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Access Permissions</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {formData.accessPermissions.canApproveSchedules && (
                                        <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                                            Approve Schedules
                                        </div>
                                    )}
                                    {formData.accessPermissions.canManageSchedules && (
                                        <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                                            Manage Schedules
                                        </div>
                                    )}
                                    {formData.accessPermissions.canViewAllDepartments && (
                                        <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                                            View All Departments
                                        </div>
                                    )}
                                    {formData.accessPermissions.canManageUsers && (
                                        <div style={{ fontSize: 13, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                                            Manage Users
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {error && (
                        <div style={{
                            padding: 12,
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(200, 75, 75, 0.1)',
                            border: '1px solid #C84B4B',
                            color: '#C84B4B',
                            fontSize: 13,
                            marginBottom: 20,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setStep('form')}
                            className="btn btn-secondary"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleCreateUser}
                            className="btn btn-primary"
                            disabled={saving}
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={16} className="spin" />
                                    Creating User...
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    Create User
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

function getOrdinalSuffix(n: number): string {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
}

export default AddUser;
