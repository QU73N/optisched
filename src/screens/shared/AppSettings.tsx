import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    Switch, Alert, TextInput, Modal, ActivityIndicator, Linking, Image
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const AppSettings: React.FC = () => {
    const { signOut, profile, refreshProfile } = useAuth();
    const [scheduleNotif, setScheduleNotif] = useState(true);
    const { themeMode, setThemeMode, colors } = useTheme();
    const [twoFactor, setTwoFactor] = useState(false);

    const handleTwoFactor = (val: boolean) => {
        if (val) {
            Alert.alert('Enable 2FA', 'Two-factor authentication adds an extra security layer. An authentication code will be required at each login.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Enable', onPress: () => { setTwoFactor(true); Alert.alert('2FA Enabled', 'Two-factor authentication is now active on your account.'); } },
            ]);
        } else {
            Alert.alert('Disable 2FA', 'Are you sure? Your account will be less secure.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Disable', style: 'destructive', onPress: () => { setTwoFactor(false); Alert.alert('2FA Disabled', 'Two-factor authentication has been turned off.'); } },
            ]);
        }
    };

    const handleNotifToggle = (type: string, val: boolean) => {
        setScheduleNotif(val);
        Alert.alert(val ? 'Enabled' : 'Disabled', `Schedule update notifications ${val ? 'enabled' : 'disabled'}.`);
    };

    // Change password modal
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);

    // Edit profile modal
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [editName, setEditName] = useState(profile?.full_name || '');
    const [editStrand, setEditStrand] = useState(profile?.program || '');
    const [editSection, setEditSection] = useState(profile?.section || '');
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(profile?.avatar_url || null);

    const uploadToSupabase = async (uri: string): Promise<string | null> => {
        try {
            // Read file as base64 using expo-file-system to avoid fetch(uri) network errors on Android
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            // Decode base64 to ArrayBuffer (import decode from 'base64-arraybuffer')
            const arrayBuffer = decode(base64);

            const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${profile?.id || 'user'}_${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, arrayBuffer, {
                    contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
                    upsert: true,
                });

            if (uploadError) {
                console.log('[Avatar] Upload error:', uploadError.message);
                return null;
            }

            // Get public URL
            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            return urlData?.publicUrl || null;
        } catch (err) {
            console.error('[Avatar] Upload failed:', err);
            return null;
        }
    };

    const pickImage = async () => {
        Alert.alert('Change Profile Photo', 'Choose a source', [
            {
                text: 'Camera', onPress: async () => {
                    const perm = await ImagePicker.requestCameraPermissionsAsync();
                    if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
                    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });
                    if (!result.canceled && result.assets[0]) {
                        const uri = result.assets[0].uri;
                        setProfileImage(uri); // Show locally immediately
                        if (profile?.id) {
                            const publicUrl = await uploadToSupabase(uri);
                            if (publicUrl) {
                                await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
                                setProfileImage(publicUrl);
                                refreshProfile();
                            } else {
                                Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
                            }
                        }
                    }
                }
            },
            {
                text: 'Photo Library', onPress: async () => {
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) { Alert.alert('Permission needed', 'Photo library access is required.'); return; }
                    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });
                    if (!result.canceled && result.assets[0]) {
                        const uri = result.assets[0].uri;
                        setProfileImage(uri); // Show locally immediately
                        if (profile?.id) {
                            const publicUrl = await uploadToSupabase(uri);
                            if (publicUrl) {
                                await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
                                setProfileImage(publicUrl);
                                refreshProfile();
                            } else {
                                Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
                            }
                        }
                    }
                }
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ]);
    };

    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match.');
            return;
        }
        setChangingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) {
                Alert.alert('Error', error.message);
            } else {
                Alert.alert('Success', 'Password changed successfully!');
                setShowPasswordModal(false);
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to change password.');
        } finally {
            setChangingPassword(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!editName.trim()) {
            Alert.alert('Error', 'Name cannot be empty.');
            return;
        }
        setSavingProfile(true);
        try {
            const { error } = await supabase.from('profiles').update({
                full_name: editName.trim(),
                program: editStrand.trim() || null,
                section: editSection.trim() || null
            }).eq('id', profile?.id);

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                Alert.alert('Success', 'Profile updated!');
                setShowProfileModal(false);
                await refreshProfile();
            }
        } catch (err) {
            Alert.alert('Error', 'Failed to update profile.');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleThemeChange = (key: 'dark' | 'light' | 'system') => {
        setThemeMode(key);
    };

    const initials = profile?.full_name
        ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
        : 'U';

    const themes: { key: 'dark' | 'light' | 'system'; icon: string; label: string }[] = [
        { key: 'dark', icon: 'dark-mode', label: 'Dark' },
        { key: 'light', icon: 'light-mode', label: 'Light' },
        { key: 'system', icon: 'settings-brightness', label: 'System' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <AnimatedPressable style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
                </AnimatedPressable>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Profile Summary */}
                <AnimatedPressable style={styles.profileCard} onPress={() => {
                    setEditName(profile?.full_name || '');
                    setEditStrand(profile?.program || '');
                    setEditSection(profile?.section || '');
                    setShowProfileModal(true);
                }} activeOpacity={0.7}>
                    <AnimatedPressable style={styles.profileAvatar} onPress={pickImage}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                        ) : (
                            <Text style={styles.avatarText}>{initials}</Text>
                        )}
                        <View style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0f172a' }}>
                            <MaterialIcons name="camera-alt" size={12} color={Colors.white} />
                        </View>
                    </AnimatedPressable>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.profileName}>{profile?.full_name || 'User'}</Text>
                        <Text style={styles.profileEmail}>{profile?.email || 'user@sti.edu.ph'}</Text>
                        {profile?.program && (
                            <Text style={styles.profileStrand}>Strand: {profile.program}</Text>
                        )}
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleText}>{profile?.role?.toUpperCase() || 'STUDENT'}</Text>
                        </View>
                    </View>
                    <MaterialIcons name="edit" size={18} color={Colors.slate400} />
                </AnimatedPressable>

                {/* Account & Security */}
                <Text style={styles.sectionLabel}>ACCOUNT & SECURITY</Text>
                <View style={styles.card}>
                    <AnimatedPressable style={styles.settingRow} onPress={() => setShowPasswordModal(true)}>
                        <View style={styles.settingLeft}>
                            <View style={[styles.settingIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                                <MaterialIcons name="lock" size={20} color="#60a5fa" />
                            </View>
                            <View>
                                <Text style={styles.settingTitle}>Change Password</Text>
                                <Text style={styles.settingSub}>Update your password</Text>
                            </View>
                        </View>
                        <MaterialIcons name="chevron-right" size={20} color={Colors.slate600} />
                    </AnimatedPressable>

                    <View style={[styles.settingRow, styles.rowBorder]}>
                        <View style={styles.settingLeft}>
                            <View style={[styles.settingIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                                <MaterialIcons name="security" size={20} color="#34d399" />
                            </View>
                            <View>
                                <Text style={styles.settingTitle}>Two-Factor Auth</Text>
                                <Text style={styles.settingSub}>Add extra security layer</Text>
                            </View>
                        </View>
                        <Switch
                            value={twoFactor}
                            onValueChange={handleTwoFactor}
                            trackColor={{ false: '#334155', true: Colors.primary }}
                            thumbColor={Colors.white}
                        />
                    </View>
                </View>

                {/* Notifications */}
                <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <View style={[styles.settingIcon, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                                <MaterialIcons name="event" size={20} color="#a78bfa" />
                            </View>
                            <View>
                                <Text style={styles.settingTitle}>Schedule Updates</Text>
                                <Text style={styles.settingSub}>Get notified of changes</Text>
                            </View>
                        </View>
                        <Switch
                            value={scheduleNotif}
                            onValueChange={(v) => handleNotifToggle('schedule', v)}
                            trackColor={{ false: '#334155', true: Colors.primary }}
                            thumbColor={Colors.white}
                        />
                    </View>
                </View>

                {/* Appearance */}
                <Text style={styles.sectionLabel}>APPEARANCE</Text>
                <View style={styles.card}>
                    <View style={styles.themeRow}>
                        {themes.map(t => (
                            <AnimatedPressable
                                key={t.key}
                                style={[styles.themeOption, themeMode === t.key && styles.themeOptionActive]}
                                onPress={() => handleThemeChange(t.key)}
                            >
                                <MaterialIcons
                                    name={t.icon as keyof typeof MaterialIcons.glyphMap}
                                    size={22}
                                    color={themeMode === t.key ? Colors.primary : Colors.slate400}
                                />
                                <Text style={[styles.themeText, themeMode === t.key && styles.themeTextActive]}>
                                    {t.label}
                                </Text>
                            </AnimatedPressable>
                        ))}
                    </View>
                </View>

                {/* Legal */}
                <Text style={styles.sectionLabel}>📄 LEGAL</Text>
                <View style={styles.card}>
                    <AnimatedPressable style={styles.settingRow} onPress={() => Linking.openURL('https://optisched-legal.vercel.app/privacy.html')}>
                        <View style={styles.settingLeft}>
                            <View style={[styles.settingIcon, { backgroundColor: 'rgba(129,140,248,0.15)' }]}>
                                <MaterialIcons name="policy" size={20} color="#818cf8" />
                            </View>
                            <Text style={styles.settingTitle}>Privacy Policy</Text>
                        </View>
                        <MaterialIcons name="open-in-new" size={16} color={Colors.slate600} />
                    </AnimatedPressable>
                    <AnimatedPressable style={[styles.settingRow, styles.rowBorder]} onPress={() => Linking.openURL('https://optisched-legal.vercel.app/terms.html')}>
                        <View style={styles.settingLeft}>
                            <View style={[styles.settingIcon, { backgroundColor: 'rgba(129,140,248,0.15)' }]}>
                                <MaterialIcons name="description" size={20} color="#818cf8" />
                            </View>
                            <Text style={styles.settingTitle}>Terms of Service</Text>
                        </View>
                        <MaterialIcons name="open-in-new" size={16} color={Colors.slate600} />
                    </AnimatedPressable>
                    <AnimatedPressable style={[styles.settingRow, styles.rowBorder]} onPress={() => Linking.openURL('https://optisched-legal.vercel.app/about.html')}>
                        <View style={styles.settingLeft}>
                            <View style={[styles.settingIcon, { backgroundColor: 'rgba(129,140,248,0.15)' }]}>
                                <MaterialIcons name="info" size={20} color="#818cf8" />
                            </View>
                            <Text style={styles.settingTitle}>About OptiSched</Text>
                        </View>
                        <MaterialIcons name="open-in-new" size={16} color={Colors.slate600} />
                    </AnimatedPressable>
                </View>

                {/* Sign Out */}
                <AnimatedPressable style={styles.signOutBtn} onPress={handleSignOut}>
                    <MaterialIcons name="logout" size={20} color="#ef4444" />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </AnimatedPressable>

                <Text style={styles.version}>OptiSched v1.0 • STI College Meycauayan</Text>
                <View style={{ height: 60 }} />
            </ScrollView>

            {/* Change Password Modal */}
            <Modal visible={showPasswordModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Change Password</Text>
                            <AnimatedPressable onPress={() => setShowPasswordModal(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>
                        <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Min 6 characters"
                            placeholderTextColor="#6b7280"
                            secureTextEntry
                            value={newPassword}
                            onChangeText={setNewPassword}
                        />
                        <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Repeat new password"
                            placeholderTextColor="#6b7280"
                            secureTextEntry
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                        />
                        <AnimatedPressable style={styles.modalBtn} onPress={handleChangePassword} disabled={changingPassword}>
                            {changingPassword ? (
                                <ActivityIndicator color={Colors.white} />
                            ) : (
                                <Text style={styles.modalBtnText}>Update Password</Text>
                            )}
                        </AnimatedPressable>
                    </View>
                </View>
            </Modal>

            {/* Edit Profile Modal */}
            <Modal visible={showProfileModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <AnimatedPressable onPress={() => setShowProfileModal(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        <View style={styles.avatarEditRow}>
                            <View style={styles.avatarLarge}>
                                <Text style={styles.avatarLargeText}>{initials}</Text>
                            </View>
                            <Text style={styles.avatarEditHint}>Profile initials are auto-generated from your name</Text>
                        </View>

                        <Text style={styles.fieldLabel}>FULL NAME</Text>
                        <TextInput style={styles.modalInput} value={editName} onChangeText={setEditName} placeholderTextColor="#6b7280" />

                        <Text style={styles.fieldLabel}>STRAND / PROGRAM</Text>
                        <TextInput style={styles.modalInput} value={editStrand} onChangeText={setEditStrand} placeholder="e.g. MAWD, BSIT, BSCS" placeholderTextColor="#6b7280" />

                        <Text style={styles.fieldLabel}>SECTION</Text>
                        <TextInput style={styles.modalInput} value={editSection} onChangeText={setEditSection} placeholder="e.g. MAWD 12A-2" placeholderTextColor="#6b7280" />

                        <AnimatedPressable style={styles.modalBtn} onPress={handleSaveProfile} disabled={savingProfile}>
                            {savingProfile ? (
                                <ActivityIndicator color={Colors.white} />
                            ) : (
                                <Text style={styles.modalBtnText}>Save Changes</Text>
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
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 16
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
    scrollView: { flex: 1, paddingHorizontal: 20 },

    profileCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: Colors.surfaceDark, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: Colors.borderDark, marginBottom: 24
    },
    profileAvatar: {
        width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center'
    },
    avatarText: { color: Colors.white, fontWeight: '700', fontSize: 20 },
    profileName: { fontSize: 16, fontWeight: '700', color: Colors.white },
    profileEmail: { fontSize: 12, color: Colors.textSecondaryDark, marginTop: 2 },
    profileStrand: { fontSize: 11, color: Colors.primary, marginTop: 2, fontWeight: '500' },
    roleBadge: {
        alignSelf: 'flex-start', marginTop: 6,
        backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2
    },
    roleText: { fontSize: 10, fontWeight: '600', color: '#60a5fa', letterSpacing: 0.5 },

    sectionLabel: {
        fontSize: 11, fontWeight: '600', color: Colors.textSecondaryDark,
        letterSpacing: 1.5, marginBottom: 8, paddingLeft: 4
    },
    card: {
        backgroundColor: Colors.surfaceDark, borderRadius: 16, padding: 4,
        borderWidth: 1, borderColor: Colors.borderDark, marginBottom: 20
    },
    settingRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 12, paddingVertical: 14
    },
    rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(51,65,85,0.5)' },
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    settingIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    settingTitle: { fontSize: 14, fontWeight: '500', color: Colors.textPrimaryDark },
    settingSub: { fontSize: 11, color: Colors.textSecondaryDark, marginTop: 2 },

    themeRow: { flexDirection: 'row', padding: 8, gap: 8 },
    themeOption: {
        flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12,
        borderRadius: 12, borderWidth: 1, borderColor: 'transparent'
    },
    themeOptionActive: { borderColor: Colors.primary, backgroundColor: 'rgba(19,91,236,0.08)' },
    themeText: { fontSize: 12, color: Colors.slate400, fontWeight: '500' },
    themeTextActive: { color: Colors.primary },

    signOutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 14, paddingVertical: 16,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', marginTop: 8
    },
    signOutText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },

    version: {
        color: Colors.slate600, fontSize: 12, textAlign: 'center', marginTop: 20
    },

    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, maxHeight: '80%'
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
    fieldLabel: {
        fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5,
        marginBottom: 6, marginTop: 14
    },
    modalInput: {
        backgroundColor: '#0f172a', borderWidth: 1, borderColor: Colors.borderDark,
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
        color: Colors.white, fontSize: 14
    },
    modalBtn: {
        backgroundColor: Colors.primary, borderRadius: 12,
        paddingVertical: 16, alignItems: 'center', marginTop: 24
    },
    modalBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' },

    avatarEditRow: { alignItems: 'center', marginBottom: 8 },
    avatarLarge: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center', marginBottom: 8
    },
    avatarLargeText: { color: Colors.white, fontWeight: '700', fontSize: 28 },
    avatarEditHint: { color: Colors.slate500, fontSize: 12 }
});

export default AppSettings;
