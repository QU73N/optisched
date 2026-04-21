import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TextInput, Alert, ActivityIndicator, Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase } from '../../config/supabase';
import { supabaseAdmin } from '../../config/supabase';
import { useSections } from '../../hooks/useSupabase';
import { AnimatedPressable } from '../../components/AnimatedPressable';

interface NewUser {
    email: string;
    password: string;
    fullName: string;
    studentId: string;
    role: 'student' | 'teacher' | 'admin';
    department: string;
    program: string;
    section: string;
    yearLevel: string;
}

const AdminManageUsers: React.FC = () => {
    const [showModal, setShowModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [users, setUsers] = useState<Array<{ id: string; email: string; full_name: string; role: string }>>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const { sections: dbSections } = useSections();
    const [newUser, setNewUser] = useState<NewUser>({
        email: '', password: '', fullName: '', studentId: '', role: 'student',
        department: '', program: '', section: '', yearLevel: ''
    });
    const [deleting, setDeleting] = useState<string | null>(null);

    // Password change modal state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; full_name: string; role: string } | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // Edit user profile modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState<{ id: string; full_name: string; role: string } | null>(null);
    const [editProgram, setEditProgram] = useState('');
    const [editYearLevel, setEditYearLevel] = useState('');
    const [editSection, setEditSection] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    // Fetch existing users + realtime subscription
    React.useEffect(() => {
        fetchUsers();

        // Realtime subscription for profile changes (AI creates/deletes users)
        const channel = supabase
            .channel('profiles_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchUsers();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, role')
            .order('created_at', { ascending: false });
        if (!error && data) setUsers(data);
        setLoadingUsers(false);
    };

    const handleCreateUser = async () => {
        if (!newUser.password || !newUser.fullName) {
            Alert.alert('Error', 'Please fill in password and full name.');
            return;
        }
        if (!/^[a-zA-Z\s.-]+$/.test(newUser.fullName)) {
            Alert.alert('Error', 'Full name can only contain letters, spaces, dots, and hyphens.');
            return;
        }
        if (newUser.password.length < 8) {
            Alert.alert('Error', 'Password must be at least 8 characters.');
            return;
        }
        if (newUser.role === 'student' && !newUser.section) {
            Alert.alert('Error', 'Please select a Program, Year Level, and Section for the student.');
            return;
        }

        // Auto-generate email if blank
        let email = newUser.email.trim();
        if (!email) {
            const nameParts = newUser.fullName.trim().split(' ');
            const surname = nameParts[nameParts.length - 1]?.toLowerCase() || 'user';
            const idStr = newUser.studentId?.trim() || Math.random().toString(36).slice(-6);
            const last6 = idStr.slice(-6);
            email = `${surname}.${last6}@optisched.sti.edu`;
        }

        setCreating(true);
        try {
            let userId = '';

            // Use admin API to create user with auto-confirmed email (no pending status)
            if (supabaseAdmin) {
                const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
                    email: email,
                    password: newUser.password,
                    email_confirm: true,
                    user_metadata: {
                        role: newUser.role,
                        full_name: newUser.fullName
                    }
                });
                if (adminError) {
                    Alert.alert('Error', adminError.message);
                    setCreating(false);
                    return;
                }
                userId = adminData.user?.id || '';
            } else {
                // Fallback to regular signUp if no service key
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: email,
                    password: newUser.password,
                    options: {
                        data: {
                            role: newUser.role,
                            full_name: newUser.fullName
                        }
                    }
                });
                if (authError) {
                    Alert.alert('Error', authError.message);
                    setCreating(false);
                    return;
                }
                userId = authData.user?.id || '';
            }

            // Upsert profile — use upsert + delay so the auth trigger has time to create the row
            if (userId) {
                const client = supabaseAdmin || supabase;
                await new Promise(resolve => setTimeout(resolve, 500));

                const profileData: any = {
                    id: userId,
                    full_name: newUser.fullName,
                    role: newUser.role,
                    email: email,
                    program: newUser.program || null,
                    section: newUser.section || null,
                    year_level: newUser.yearLevel ? parseInt(newUser.yearLevel) : null,
                };
                console.log('[CreateUser] Saving profile:', JSON.stringify(profileData));

                const { error: profileError } = await client
                    .from('profiles')
                    .upsert(profileData, { onConflict: 'id' });

                if (profileError) {
                    console.error('[CreateUser] Profile save FAILED:', profileError.message);
                } else {
                    console.log('[CreateUser] Profile saved OK — section:', newUser.section, 'program:', newUser.program);
                }

                // Create teacher record if teacher role
                if (newUser.role === 'teacher') {
                    await supabase.from('teachers').insert({
                        profile_id: userId,
                        department: newUser.department || 'General',
                        employment_type: 'full-time',
                        max_hours: 40,
                        current_load_percentage: 0,
                        is_active: true
                    });
                }
            }

            Alert.alert('Success', `Account created for ${newUser.fullName}!\nEmail: ${email}\nThe user can log in immediately.`);
            setShowModal(false);
            setNewUser({ email: '', password: '', fullName: '', studentId: '', role: 'student', department: '', program: '', section: '', yearLevel: '' });
            fetchUsers();
        } catch (error) {
            Alert.alert('Error', 'Failed to create account. Please try again.');
        } finally {
            setCreating(false);
        }
    };

    const handleChangePassword = async () => {
        if (!selectedUser) return;

        if (!newPassword.trim()) {
            Alert.alert('Error', 'Please enter a new password.');
            return;
        }
        if (newPassword.length < 8) {
            Alert.alert('Error', 'Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match.');
            return;
        }
        if (!supabaseAdmin) {
            Alert.alert('Error', 'Admin service key not configured. Add EXPO_PUBLIC_SUPABASE_SERVICE_KEY to your .env.local file.');
            return;
        }

        setChangingPassword(true);
        try {
            const { error } = await supabaseAdmin.auth.admin.updateUserById(selectedUser.id, {
                password: newPassword
            });

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                Alert.alert('Success', `Password updated for ${selectedUser.full_name}!`);
                setShowPasswordModal(false);
                setNewPassword('');
                setConfirmPassword('');
                setSelectedUser(null);
            }
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to change password.');
        } finally {
            setChangingPassword(false);
        }
    };

    const openPasswordModal = (user: { id: string; email: string; full_name: string; role: string }) => {
        setSelectedUser(user);
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordModal(true);
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin': return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' };
            case 'teacher': return { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' };
            default: return { bg: 'rgba(16,185,129,0.15)', text: '#34d399' };
        }
    };

    const handleDeleteUser = (user: { id: string; full_name: string; email: string; role: string }) => {
        Alert.alert('Delete Account', `Are you sure you want to permanently delete ${user.full_name || user.email}?\n\nThis action cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    setDeleting(user.id);
                    try {
                        if (supabaseAdmin) {
                            await supabaseAdmin.auth.admin.deleteUser(user.id);
                        }
                        const client = supabaseAdmin || supabase;
                        await client.from('teachers').delete().eq('profile_id', user.id);
                        await client.from('profiles').delete().eq('id', user.id);
                        Alert.alert('Deleted', `${user.full_name || 'User'} has been removed.`);
                        fetchUsers();
                    } catch {
                        Alert.alert('Error', 'Failed to delete user.');
                    } finally {
                        setDeleting(null);
                    }
                },
            },
        ]);
    };

    const openEditModal = async (user: { id: string; full_name: string; role: string }) => {
        // Fetch full profile
        const client = supabaseAdmin || supabase;
        const { data } = await client.from('profiles').select('section, program, year_level').eq('id', user.id).single();
        setEditingUser(user);
        setEditProgram(data?.program || '');
        setEditYearLevel(data?.year_level ? String(data.year_level) : '');
        setEditSection(data?.section || '');
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        setSavingEdit(true);
        try {
            const client = supabaseAdmin || supabase;
            const { error } = await client.from('profiles').update({
                program: editProgram || null,
                year_level: editYearLevel ? parseInt(editYearLevel) : null,
                section: editSection || null,
            }).eq('id', editingUser.id);
            if (error) throw error;
            Alert.alert('Success', `Updated ${editingUser.full_name}'s profile!`);
            setShowEditModal(false);
        } catch (err) {
            Alert.alert('Error', 'Failed to update profile.');
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>User Management</Text>
                <AnimatedPressable style={styles.addBtn} onPress={() => setShowModal(true)}>
                    <MaterialIcons name="person-add" size={20} color={Colors.white} />
                    <Text style={styles.addBtnText}>Add User</Text>
                </AnimatedPressable>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{users.length}</Text>
                    <Text style={styles.statLabel}>Total Users</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{users.filter(u => u.role === 'teacher').length}</Text>
                    <Text style={styles.statLabel}>Teachers</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statNumber}>{users.filter(u => u.role === 'student').length}</Text>
                    <Text style={styles.statLabel}>Students</Text>
                </View>
            </View>

            {/* User List */}
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {loadingUsers ? (
                    <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
                ) : (
                    users.map(user => {
                        const roleColors = getRoleBadgeColor(user.role);
                        return (
                            <AnimatedPressable
                                key={user.id}
                                style={styles.userCard}
                                activeOpacity={0.7}
                                onPress={() => openPasswordModal(user)}
                            >
                                <View style={styles.userAvatar}>
                                    <Text style={styles.avatarText}>
                                        {user.full_name ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2) : '?'}
                                    </Text>
                                </View>
                                <View style={styles.userInfo}>
                                    <Text style={styles.userName}>{user.full_name || 'Unnamed'}</Text>
                                    <Text style={styles.userEmail}>{user.email}</Text>
                                </View>
                                <AnimatedPressable
                                    style={styles.passwordBtn}
                                    onPress={() => openPasswordModal(user)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <MaterialIcons name="lock-reset" size={20} color={Colors.slate400} />
                                </AnimatedPressable>
                                {user.role === 'student' && (
                                    <AnimatedPressable
                                        style={{ padding: 6 }}
                                        onPress={() => openEditModal(user)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <MaterialIcons name="edit" size={20} color="#6366f1" />
                                    </AnimatedPressable>
                                )}
                                <AnimatedPressable
                                    style={{ padding: 6 }}
                                    onPress={() => handleDeleteUser(user)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    {deleting === user.id ? <ActivityIndicator size="small" color="#ef4444" /> : <MaterialIcons name="delete-outline" size={20} color="#ef4444" />}
                                </AnimatedPressable>
                                <View style={[styles.roleBadge, { backgroundColor: roleColors.bg }]}>
                                    <Text style={[styles.roleText, { color: roleColors.text }]}>{user.role?.toUpperCase()}</Text>
                                </View>
                            </AnimatedPressable>
                        );
                    })
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Create User Modal */}
            <Modal visible={showModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create New Account</Text>
                            <AnimatedPressable onPress={() => setShowModal(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Role Selector */}
                            <Text style={styles.fieldLabel}>ROLE</Text>
                            <View style={styles.roleSelector}>
                                {(['student', 'teacher', 'admin'] as const).map(role => (
                                    <AnimatedPressable
                                        key={role}
                                        style={[styles.roleOption, newUser.role === role && styles.roleOptionActive]}
                                        onPress={() => setNewUser(prev => ({ ...prev, role }))}
                                    >
                                        <MaterialIcons
                                            name={role === 'admin' ? 'admin-panel-settings' : role === 'teacher' ? 'school' : 'person'}
                                            size={18}
                                            color={newUser.role === role ? Colors.white : Colors.slate400}
                                        />
                                        <Text style={[styles.roleOptionText, newUser.role === role && styles.roleOptionTextActive]}>
                                            {role.charAt(0).toUpperCase() + role.slice(1)}
                                        </Text>
                                    </AnimatedPressable>
                                ))}
                            </View>

                            <Text style={styles.fieldLabel}>FULL NAME</Text>
                            <TextInput style={styles.modalInput} placeholder="Full Name (Surname Last)" placeholderTextColor="#6b7280" value={newUser.fullName} onChangeText={v => setNewUser(p => ({ ...p, fullName: v }))} />

                            <Text style={styles.fieldLabel}>STUDENT / EMPLOYEE ID</Text>
                            <TextInput style={styles.modalInput} placeholder="e.g. 02000123456" placeholderTextColor="#6b7280" value={newUser.studentId} onChangeText={v => setNewUser(p => ({ ...p, studentId: v }))} keyboardType="numeric" />

                            {newUser.fullName && newUser.studentId && newUser.studentId.length >= 6 && (
                                <View style={{ backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 8, padding: 10, marginBottom: 4, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
                                    <Text style={{ fontSize: 11, color: '#34d399', fontWeight: '600' }}>Auto-generated email:</Text>
                                    <Text style={{ fontSize: 13, color: Colors.white, fontWeight: '700', marginTop: 2 }}>{newUser.fullName.split(' ').pop()?.toLowerCase()}.{newUser.studentId.slice(-6)}@optisched.sti.edu</Text>
                                </View>
                            )}

                            <Text style={styles.fieldLabel}>EMAIL (or leave blank for auto-generate)</Text>
                            <TextInput style={styles.modalInput} placeholder="Auto-generated from name + ID" placeholderTextColor="#6b7280" value={newUser.email} onChangeText={v => setNewUser(p => ({ ...p, email: v }))} keyboardType="email-address" autoCapitalize="none" />

                            <Text style={styles.fieldLabel}>PASSWORD</Text>
                            <TextInput style={styles.modalInput} placeholder="Min 8 characters" placeholderTextColor="#6b7280" value={newUser.password} onChangeText={v => setNewUser(p => ({ ...p, password: v }))} secureTextEntry />

                            {newUser.role === 'teacher' && (
                                <>
                                    <Text style={styles.fieldLabel}>DEPARTMENT</Text>
                                    <TextInput style={styles.modalInput} placeholder="e.g. Computer Science" placeholderTextColor="#6b7280" value={newUser.department} onChangeText={v => setNewUser(p => ({ ...p, department: v }))} />
                                </>
                            )}

                            {newUser.role === 'student' && (
                                <>
                                    {/* Program/Strand — derived from sections table */}
                                    <Text style={styles.fieldLabel}>PROGRAM / STRAND</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            {dbSections && dbSections.length > 0 ? (
                                                // Extract unique programs from sections table
                                                [...new Set(dbSections.map((s: any) => s.program).filter(Boolean))].map((prog: string) => (
                                                    <AnimatedPressable
                                                        key={prog}
                                                        style={{
                                                            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                                                            borderWidth: 1.5,
                                                            backgroundColor: newUser.program === prog ? '#6366f1' : 'rgba(99,102,241,0.08)',
                                                            borderColor: newUser.program === prog ? '#6366f1' : '#334155',
                                                        }}
                                                        onPress={() => setNewUser(p => ({ ...p, program: prog, yearLevel: '', section: '' }))}
                                                    >
                                                        <Text style={{ color: newUser.program === prog ? '#fff' : '#94a3b8', fontWeight: '600', fontSize: 13 }}>{prog}</Text>
                                                    </AnimatedPressable>
                                                ))
                                            ) : (
                                                <Text style={{ color: '#64748b', fontSize: 13, padding: 8 }}>No programs found. Add sections in Data Management first.</Text>
                                            )}
                                        </View>
                                    </ScrollView>

                                    {/* Year Level — derived from sections matching selected program */}
                                    {newUser.program && (
                                        <>
                                            <Text style={styles.fieldLabel}>YEAR LEVEL</Text>
                                            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                                                {[...new Set(
                                                    dbSections
                                                        ?.filter((s: any) => s.program === newUser.program)
                                                        .map((s: any) => s.year_level)
                                                        .filter(Boolean)
                                                )].sort((a: number, b: number) => a - b).map((yr: number) => (
                                                    <AnimatedPressable
                                                        key={yr}
                                                        style={{
                                                            paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                                                            backgroundColor: newUser.yearLevel === String(yr) ? '#6366f1' : 'rgba(99,102,241,0.08)',
                                                            borderWidth: 1.5,
                                                            borderColor: newUser.yearLevel === String(yr) ? '#6366f1' : '#334155',
                                                        }}
                                                        onPress={() => setNewUser(p => ({ ...p, yearLevel: String(yr), section: '' }))}
                                                    >
                                                        <Text style={{ color: newUser.yearLevel === String(yr) ? '#fff' : '#94a3b8', fontWeight: '700', fontSize: 14 }}>
                                                            {yr >= 11 ? `Grade ${yr}` : `Year ${yr}`}
                                                        </Text>
                                                    </AnimatedPressable>
                                                ))}
                                            </View>
                                        </>
                                    )}

                                    {/* Section — filtered by program + year level */}
                                    {newUser.program && (
                                        <>
                                            <Text style={styles.fieldLabel}>SECTION</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                                    {dbSections
                                                        .filter((sec: any) => {
                                                            if (sec.program !== newUser.program) return false;
                                                            if (newUser.yearLevel && sec.year_level !== parseInt(newUser.yearLevel)) return false;
                                                            return true;
                                                        })
                                                        .map((sec: any) => (
                                                            <AnimatedPressable
                                                                key={sec.id}
                                                                style={{
                                                                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                                                                    borderWidth: 1.5,
                                                                    backgroundColor: newUser.section === sec.name ? '#6366f1' : 'rgba(99,102,241,0.08)',
                                                                    borderColor: newUser.section === sec.name ? '#6366f1' : '#334155',
                                                                }}
                                                                onPress={() => setNewUser(p => ({ ...p, section: sec.name }))}
                                                            >
                                                                <Text style={{ color: newUser.section === sec.name ? '#fff' : '#94a3b8', fontWeight: '600', fontSize: 13 }}>{sec.name}</Text>
                                                            </AnimatedPressable>
                                                        ))}
                                                    {dbSections.filter((sec: any) => {
                                                        if (sec.program !== newUser.program) return false;
                                                        if (newUser.yearLevel && sec.year_level !== parseInt(newUser.yearLevel)) return false;
                                                        return true;
                                                    }).length === 0 && (
                                                            <Text style={{ color: '#64748b', fontSize: 13, padding: 8 }}>No sections for this program{newUser.yearLevel ? ` / Year ${newUser.yearLevel}` : ''}. Add them in Data Management.</Text>
                                                        )}
                                                </View>
                                            </ScrollView>
                                        </>
                                    )}
                                </>
                            )}

                            <AnimatedPressable style={styles.createBtn} onPress={handleCreateUser} disabled={creating}>
                                {creating ? (
                                    <ActivityIndicator color={Colors.white} />
                                ) : (
                                    <Text style={styles.createBtnText}>Create Account</Text>
                                )}
                            </AnimatedPressable>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Change Password Modal */}
            <Modal visible={showPasswordModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.passwordModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change Password</Text>
                            <AnimatedPressable onPress={() => { setShowPasswordModal(false); setSelectedUser(null); }}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        {/* User Info */}
                        {selectedUser && (
                            <View style={styles.passwordUserInfo}>
                                <View style={styles.passwordUserAvatar}>
                                    <MaterialIcons name={selectedUser.role === 'teacher' ? 'school' : 'person'} size={28} color="#60a5fa" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.passwordUserName}>{selectedUser.full_name || 'Unnamed'}</Text>
                                    <Text style={styles.passwordUserEmail}>{selectedUser.email}</Text>
                                </View>
                                <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(selectedUser.role).bg }]}>
                                    <Text style={[styles.roleText, { color: getRoleBadgeColor(selectedUser.role).text }]}>
                                        {selectedUser.role?.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.passwordDivider} />

                        <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Min 8 characters"
                            placeholderTextColor="#6b7280"
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry
                            autoFocus
                        />

                        <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Re-enter password"
                            placeholderTextColor="#6b7280"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />

                        {newPassword.length > 0 && newPassword.length < 8 && (
                            <Text style={styles.validationError}>Password must be at least 8 characters</Text>
                        )}
                        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                            <Text style={styles.validationError}>Passwords do not match</Text>
                        )}

                        <AnimatedPressable
                            style={[
                                styles.createBtn,
                                { backgroundColor: '#f59e0b' },
                                (changingPassword || newPassword.length < 8 || newPassword !== confirmPassword) && styles.disabledBtn,
                            ]}
                            onPress={handleChangePassword}
                            disabled={changingPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                        >
                            {changingPassword ? (
                                <ActivityIndicator color={Colors.white} />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <MaterialIcons name="lock-reset" size={18} color={Colors.white} />
                                    <Text style={styles.createBtnText}>Update Password</Text>
                                </View>
                            )}
                        </AnimatedPressable>
                    </View>
                </View>
            </Modal>

            {/* Edit User Profile Modal */}
            <Modal visible={showEditModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.passwordModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Student Profile</Text>
                            <AnimatedPressable onPress={() => setShowEditModal(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        {editingUser && (
                            <View style={styles.passwordUserInfo}>
                                <View style={styles.passwordUserAvatar}>
                                    <MaterialIcons name="person" size={28} color="#60a5fa" />
                                </View>
                                <Text style={styles.passwordUserName}>{editingUser.full_name}</Text>
                            </View>
                        )}

                        <View style={styles.passwordDivider} />

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Program / Strand */}
                            <Text style={styles.fieldLabel}>PROGRAM / STRAND</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {dbSections && [...new Set(dbSections.map((s: any) => s.program).filter(Boolean))].map((prog: string) => (
                                        <AnimatedPressable
                                            key={prog}
                                            style={{
                                                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                                                borderWidth: 1.5,
                                                backgroundColor: editProgram === prog ? '#6366f1' : 'rgba(99,102,241,0.08)',
                                                borderColor: editProgram === prog ? '#6366f1' : '#334155',
                                            }}
                                            onPress={() => { setEditProgram(prog); setEditYearLevel(''); setEditSection(''); }}
                                        >
                                            <Text style={{ color: editProgram === prog ? '#fff' : '#94a3b8', fontWeight: '600', fontSize: 13 }}>{prog}</Text>
                                        </AnimatedPressable>
                                    ))}
                                </View>
                            </ScrollView>

                            {/* Year Level */}
                            {editProgram ? (
                                <>
                                    <Text style={styles.fieldLabel}>YEAR LEVEL</Text>
                                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                                        {[...new Set(
                                            dbSections?.filter((s: any) => s.program === editProgram).map((s: any) => s.year_level).filter(Boolean)
                                        )].sort((a: number, b: number) => a - b).map((yr: number) => (
                                            <AnimatedPressable
                                                key={yr}
                                                style={{
                                                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                                                    backgroundColor: editYearLevel === String(yr) ? '#6366f1' : 'rgba(99,102,241,0.08)',
                                                    borderWidth: 1.5, borderColor: editYearLevel === String(yr) ? '#6366f1' : '#334155',
                                                }}
                                                onPress={() => { setEditYearLevel(String(yr)); setEditSection(''); }}
                                            >
                                                <Text style={{ color: editYearLevel === String(yr) ? '#fff' : '#94a3b8', fontWeight: '700', fontSize: 14 }}>
                                                    {yr >= 11 ? `Grade ${yr}` : `Year ${yr}`}
                                                </Text>
                                            </AnimatedPressable>
                                        ))}
                                    </View>
                                </>
                            ) : null}

                            {/* Section */}
                            {editProgram ? (
                                <>
                                    <Text style={styles.fieldLabel}>SECTION</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            {dbSections?.filter((sec: any) => {
                                                if (sec.program !== editProgram) return false;
                                                if (editYearLevel && sec.year_level !== parseInt(editYearLevel)) return false;
                                                return true;
                                            }).map((sec: any) => (
                                                <AnimatedPressable
                                                    key={sec.id}
                                                    style={{
                                                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                                                        borderWidth: 1.5,
                                                        backgroundColor: editSection === sec.name ? '#6366f1' : 'rgba(99,102,241,0.08)',
                                                        borderColor: editSection === sec.name ? '#6366f1' : '#334155',
                                                    }}
                                                    onPress={() => setEditSection(sec.name)}
                                                >
                                                    <Text style={{ color: editSection === sec.name ? '#fff' : '#94a3b8', fontWeight: '600', fontSize: 13 }}>{sec.name}</Text>
                                                </AnimatedPressable>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </>
                            ) : null}

                            {/* Current values */}
                            <View style={{ backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#334155' }}>
                                <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600' }}>WILL SAVE:</Text>
                                <Text style={{ color: '#e2e8f0', fontSize: 13, marginTop: 4 }}>
                                    Program: {editProgram || '(none)'} | Year: {editYearLevel || '(none)'} | Section: {editSection || '(none)'}
                                </Text>
                            </View>

                            <AnimatedPressable
                                style={[styles.createBtn, !editSection && styles.disabledBtn]}
                                onPress={handleSaveEdit}
                                disabled={savingEdit || !editSection}
                            >
                                {savingEdit ? (
                                    <ActivityIndicator color={Colors.white} />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialIcons name="save" size={18} color={Colors.white} />
                                        <Text style={styles.createBtnText}>Save Changes</Text>
                                    </View>
                                )}
                            </AnimatedPressable>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: Colors.borderDark
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
    addBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10
    },
    addBtnText: { color: Colors.white, fontSize: 13, fontWeight: '600' },

    statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
    statCard: {
        flex: 1, backgroundColor: Colors.surfaceDark, borderRadius: 12, padding: 16,
        alignItems: 'center', borderWidth: 1, borderColor: Colors.borderDark
    },
    statNumber: { fontSize: 24, fontWeight: '700', color: Colors.white },
    statLabel: { fontSize: 11, color: Colors.slate400, marginTop: 4 },

    list: { flex: 1, paddingHorizontal: 20 },
    userCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: Colors.surfaceDark, borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: Colors.borderDark, marginBottom: 8
    },
    userAvatar: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(59,130,246,0.2)',
        justifyContent: 'center', alignItems: 'center'
    },
    avatarText: { color: '#60a5fa', fontWeight: '700', fontSize: 14 },
    userInfo: { flex: 1 },
    userName: { fontSize: 14, fontWeight: '600', color: Colors.white },
    userEmail: { fontSize: 12, color: Colors.slate400, marginTop: 2 },
    passwordBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(245,158,11,0.1)', justifyContent: 'center', alignItems: 'center'
    },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    roleText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, maxHeight: '85%'
    },
    passwordModalContent: {
        backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
    fieldLabel: {
        fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5,
        marginBottom: 6, marginTop: 14
    },
    roleSelector: { flexDirection: 'row', gap: 8 },
    roleOption: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, borderRadius: 10,
        backgroundColor: '#0f172a', borderWidth: 1, borderColor: Colors.borderDark
    },
    roleOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    roleOptionText: { fontSize: 13, color: Colors.slate400, fontWeight: '500' },
    roleOptionTextActive: { color: Colors.white },
    modalInput: {
        backgroundColor: '#0f172a', borderWidth: 1, borderColor: Colors.borderDark,
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
        color: Colors.white, fontSize: 14
    },
    createBtn: {
        backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16,
        alignItems: 'center', marginTop: 24
    },
    createBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
    disabledBtn: { opacity: 0.5 },

    // Password modal specific
    passwordUserInfo: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: '#0f172a', borderRadius: 12, padding: 14,
        borderWidth: 1, borderColor: Colors.borderDark
    },
    passwordUserAvatar: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(59,130,246,0.15)',
        justifyContent: 'center', alignItems: 'center'
    },
    passwordUserName: { fontSize: 16, fontWeight: '600', color: Colors.white },
    passwordUserEmail: { fontSize: 13, color: Colors.slate400, marginTop: 2 },
    passwordDivider: {
        height: 1, backgroundColor: Colors.borderDark, marginTop: 16
    },
    validationError: {
        fontSize: 12, color: '#ef4444', marginTop: 6
    }
});

export default AdminManageUsers;
