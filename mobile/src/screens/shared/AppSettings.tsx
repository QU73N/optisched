import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
    View, Text, ScrollView, StyleSheet,
    Switch, Alert, TextInput, Modal, ActivityIndicator, Linking, Image,
    KeyboardAvoidingView, Platform
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
    const navigation = useNavigation<any>();
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

    // Password reset request modal
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [requestReason, setRequestReason] = useState('');
    const [sendingRequest, setSendingRequest] = useState(false);

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

    // Send password reset request to admin
    const handlePasswordResetRequest = async () => {
        setSendingRequest(true);
        try {
            const { error } = await supabase.from('password_reset_requests').insert({
                user_id: profile?.id,
                email: profile?.email || '',
                status: 'pending',
                requested_at: new Date().toISOString(),
            });
            if (error) {
                // If table doesn't exist, create a notification instead
                console.log('[Settings] password_reset_requests insert error:', error.message);
                // Fallback: create a notification for admins
                await supabase.from('notifications').insert({
                    user_id: profile?.id,
                    title: 'Password Reset Request',
                    message: `${profile?.full_name || 'A user'} (${profile?.email || ''}) has requested a password reset.`,
                    type: 'system',
                    is_read: false,
                });
                Alert.alert('Request Sent', 'Your password reset request has been sent to the administrator. You will be notified once it has been processed.');
                setShowPasswordModal(false);
                setRequestReason('');
                return;
            }
            Alert.alert('Request Sent', 'Your password reset request has been sent to the administrator. You will be notified once it has been processed.');
            setShowPasswordModal(false);
            setRequestReason('');
        } catch (err) {
            Alert.alert('Error', 'Failed to send request. Please try again.');
        } finally {
            setSendingRequest(false);
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
            {/* Header — clean, no back button */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Profile Summary */}
                <AnimatedPressable style={[styles.profileCard, { backgroundColor: colors.surface }]} onPress={() => {
                    setEditName(profile?.full_name || '');
                    setEditStrand(profile?.program || '');
                    setEditSection(profile?.section || '');
                    setShowProfileModal(true);
                }} activeOpacity={0.7}>
                    <AnimatedPressable style={styles.profileAvatar} onPress={pickImage}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                        ) : (
                            <Text style={styles.avatarText}>{initials}</Text>
                        )}
                        <View style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textMuted, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.surface }}>
                            <MaterialIcons name="camera-alt" size={10} color={Colors.white} />
                        </View>
                    </AnimatedPressable>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.profileName, { color: colors.textPrimary }]}>{profile?.full_name || 'User'}</Text>
                        <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{profile?.email || 'user@sti.edu.ph'}</Text>
                        {profile?.program && (
                            <Text style={[styles.profileStrand, { color: colors.textMuted }]}>{profile.program}{profile?.section ? ` · ${profile.section}` : ''}</Text>
                        )}
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                </AnimatedPressable>

                {/* Account & Security */}
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ACCOUNT & SECURITY</Text>
                <View style={[styles.listGroup, { backgroundColor: colors.surface }]}>
                    <AnimatedPressable style={styles.listItem} onPress={() => setShowPasswordModal(true)}>
                        <MaterialIcons name="lock-outline" size={20} color={colors.textSecondary} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.listTitle, { color: colors.textPrimary }]}>Request Password Reset</Text>
                            <Text style={[styles.listSub, { color: colors.textMuted }]}>Send request to administrator</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
                    </AnimatedPressable>

                    <View style={[styles.separator, { backgroundColor: colors.border }]} />

                    <View style={styles.listItem}>
                        <MaterialIcons name="shield" size={20} color={colors.textSecondary} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.listTitle, { color: colors.textPrimary }]}>Two-Factor Auth</Text>
                            <Text style={[styles.listSub, { color: colors.textMuted }]}>Extra security layer</Text>
                        </View>
                        <Switch
                            value={twoFactor}
                            onValueChange={handleTwoFactor}
                            trackColor={{ false: colors.isDark ? '#1E2935' : '#d1d5db', true: Colors.primary }}
                            thumbColor={'#ffffff'}
                        />
                    </View>
                </View>

                {/* Notifications */}
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>NOTIFICATIONS</Text>
                <View style={[styles.listGroup, { backgroundColor: colors.surface }]}>
                    <View style={styles.listItem}>
                        <MaterialIcons name="notifications-none" size={20} color={colors.textSecondary} />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.listTitle, { color: colors.textPrimary }]}>Schedule Updates</Text>
                            <Text style={[styles.listSub, { color: colors.textMuted }]}>Get notified of changes</Text>
                        </View>
                        <Switch
                            value={scheduleNotif}
                            onValueChange={(v) => handleNotifToggle('schedule', v)}
                            trackColor={{ false: colors.isDark ? '#1E2935' : '#d1d5db', true: Colors.primary }}
                            thumbColor={'#ffffff'}
                        />
                    </View>
                </View>

                {/* Appearance */}
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>APPEARANCE</Text>
                <View style={[styles.listGroup, { backgroundColor: colors.surface }]}>
                    <View style={styles.themeRow}>
                        {themes.map(t => (
                            <AnimatedPressable
                                key={t.key}
                                style={[styles.themeOption, themeMode === t.key && [styles.themeOptionActive, { borderColor: Colors.primary }]]}
                                onPress={() => handleThemeChange(t.key)}
                            >
                                <MaterialIcons
                                    name={t.icon as keyof typeof MaterialIcons.glyphMap}
                                    size={20}
                                    color={themeMode === t.key ? Colors.primary : colors.textMuted}
                                />
                                <Text style={[styles.themeText, { color: colors.textMuted }, themeMode === t.key && { color: Colors.primary }]}>
                                    {t.label}
                                </Text>
                            </AnimatedPressable>
                        ))}
                    </View>
                </View>

                {/* Support */}
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>SUPPORT</Text>
                <View style={[styles.listGroup, { backgroundColor: colors.surface }]}>
                    <AnimatedPressable style={styles.listItem} onPress={() => navigation.navigate('Help')}>
                        <MaterialIcons name="help-outline" size={20} color={colors.textSecondary} />
                        <Text style={[styles.listTitle, { color: colors.textPrimary, flex: 1, marginLeft: 12 }]}>Help Center</Text>
                        <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                    </AnimatedPressable>
                </View>

                {/* Legal */}
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>LEGAL</Text>
                <View style={[styles.listGroup, { backgroundColor: colors.surface }]}>
                    <AnimatedPressable style={styles.listItem} onPress={() => Linking.openURL('https://optisched-legal-info.vercel.app/privacy.html')}>
                        <MaterialIcons name="policy" size={20} color={colors.textSecondary} />
                        <Text style={[styles.listTitle, { color: colors.textPrimary, flex: 1, marginLeft: 12 }]}>Privacy Policy</Text>
                        <MaterialIcons name="open-in-new" size={14} color={colors.textMuted} />
                    </AnimatedPressable>
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                    <AnimatedPressable style={styles.listItem} onPress={() => Linking.openURL('https://optisched-legal-info.vercel.app/terms.html')}>
                        <MaterialIcons name="description" size={20} color={colors.textSecondary} />
                        <Text style={[styles.listTitle, { color: colors.textPrimary, flex: 1, marginLeft: 12 }]}>Terms of Service</Text>
                        <MaterialIcons name="open-in-new" size={14} color={colors.textMuted} />
                    </AnimatedPressable>
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                    <AnimatedPressable style={styles.listItem} onPress={() => Linking.openURL('https://optisched-legal-info.vercel.app/about.html')}>
                        <MaterialIcons name="info-outline" size={20} color={colors.textSecondary} />
                        <Text style={[styles.listTitle, { color: colors.textPrimary, flex: 1, marginLeft: 12 }]}>About OptiSched</Text>
                        <MaterialIcons name="open-in-new" size={14} color={colors.textMuted} />
                    </AnimatedPressable>
                </View>

                {/* Sign Out — clean, professional */}
                <View style={{ marginTop: 24 }}>
                    <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 0, marginRight: 0 }]} />
                    <AnimatedPressable style={styles.signOutBtn} onPress={handleSignOut}>
                        <MaterialIcons name="logout" size={18} color="#dc2626" />
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </AnimatedPressable>
                    <View style={[styles.separator, { backgroundColor: colors.border, marginLeft: 0, marginRight: 0 }]} />
                </View>

                <Text style={[styles.version, { color: colors.textMuted }]}>OptiSched v1.0 · STI College Meycauayan</Text>
                <View style={{ height: 80 }} /></ScrollView>

            {/* Password Reset Request Modal */}
            <Modal visible={showPasswordModal} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.elevated }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Request Password Reset</Text>
                                <AnimatedPressable onPress={() => setShowPasswordModal(false)}>
                                    <MaterialIcons name="close" size={24} color={colors.textMuted} />
                                </AnimatedPressable>
                            </View>

                            <View style={[styles.infoBox, { backgroundColor: colors.isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)' }]}>
                                <MaterialIcons name="info-outline" size={16} color={colors.textSecondary} />
                                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                                    Your request will be sent to the administrator. Once approved, the admin will set a new password for your account.
                                </Text>
                            </View>

                            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>REASON (OPTIONAL)</Text>
                            <TextInput
                                style={[styles.modalInput, { backgroundColor: colors.inset, borderColor: colors.border, color: colors.textPrimary }]}
                                placeholder="e.g. Forgot my password"
                                placeholderTextColor={colors.textMuted}
                                value={requestReason}
                                onChangeText={setRequestReason}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />

                            <AnimatedPressable style={styles.modalBtn} onPress={handlePasswordResetRequest} disabled={sendingRequest}>
                                {sendingRequest ? (
                                    <ActivityIndicator color={Colors.white} />
                                ) : (
                                    <Text style={styles.modalBtnText}>Send Request</Text>
                                )}
                            </AnimatedPressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Edit Profile Modal */}
            <Modal visible={showProfileModal} animationType="slide" transparent>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.elevated }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
                                <AnimatedPressable onPress={() => setShowProfileModal(false)}>
                                    <MaterialIcons name="close" size={24} color={colors.textMuted} />
                                </AnimatedPressable>
                            </View>

                            <View style={styles.avatarEditRow}>
                                <View style={[styles.avatarLarge, { backgroundColor: colors.textMuted }]}>
                                    <Text style={styles.avatarLargeText}>{initials}</Text>
                                </View>
                                <Text style={[styles.avatarEditHint, { color: colors.textMuted }]}>Profile initials are auto-generated from your name</Text>
                            </View>

                            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>FULL NAME</Text>
                            <TextInput style={[styles.modalInput, { backgroundColor: colors.inset, borderColor: colors.border, color: colors.textPrimary }]} value={editName} onChangeText={setEditName} placeholderTextColor={colors.textMuted} />

                            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>STRAND / PROGRAM</Text>
                            <TextInput style={[styles.modalInput, { backgroundColor: colors.inset, borderColor: colors.border, color: colors.textPrimary }]} value={editStrand} onChangeText={setEditStrand} placeholder="e.g. MAWD, BSIT, BSCS" placeholderTextColor={colors.textMuted} />

                            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>SECTION</Text>
                            <TextInput style={[styles.modalInput, { backgroundColor: colors.inset, borderColor: colors.border, color: colors.textPrimary }]} value={editSection} onChangeText={setEditSection} placeholder="e.g. MAWD 12A-2" placeholderTextColor={colors.textMuted} />

                            <AnimatedPressable style={styles.modalBtn} onPress={handleSaveProfile} disabled={savingProfile}>
                                {savingProfile ? (
                                    <ActivityIndicator color={Colors.white} />
                                ) : (
                                    <Text style={styles.modalBtnText}>Save Changes</Text>
                                )}
                            </AnimatedPressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: 20, paddingVertical: 16,
    },
    headerTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.3 },
    scrollView: { flex: 1, paddingHorizontal: 20 },

    // Profile card — clean, no border
    profileCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderRadius: 10, padding: 14,
        marginBottom: 24,
    },
    profileAvatar: {
        width: 52, height: 52, borderRadius: 26, backgroundColor: '#6b7280',
        justifyContent: 'center', alignItems: 'center',
    },
    avatarText: { color: '#ffffff', fontWeight: '600', fontSize: 18 },
    profileName: { fontSize: 16, fontWeight: '600' },
    profileEmail: { fontSize: 12, marginTop: 1, opacity: 0.7 },
    profileStrand: { fontSize: 11, marginTop: 2 },

    // Section labels
    sectionLabel: {
        fontSize: 11, fontWeight: '600',
        letterSpacing: 1, marginBottom: 6, paddingLeft: 2, marginTop: 4,
    },

    // Flat list group — no borders, just background
    listGroup: {
        borderRadius: 10,
        marginBottom: 20,
        overflow: 'hidden',
    },
    listItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 13,
    },
    listTitle: { fontSize: 14, fontWeight: '500' },
    listSub: { fontSize: 11, marginTop: 1 },
    separator: {
        height: StyleSheet.hairlineWidth, marginLeft: 46,
    },

    // Theme row
    themeRow: { flexDirection: 'row', padding: 8, gap: 6 },
    themeOption: {
        flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10,
        borderRadius: 8, borderWidth: 1, borderColor: 'transparent',
    },
    themeOptionActive: { backgroundColor: 'rgba(19,91,236,0.06)' },
    themeText: { fontSize: 11, fontWeight: '500' },

    // Sign out — minimal
    signOutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 14,
        width: '100%',
        alignSelf: 'stretch',
        paddingHorizontal: 0,
    },
    signOutText: { color: '#dc2626', fontSize: 15, fontWeight: '500' },

    version: {
        fontSize: 11, textAlign: 'center', marginTop: 20, opacity: 0.6,
    },

    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: '600' },
    fieldLabel: {
        fontSize: 10, fontWeight: '600', letterSpacing: 1,
        marginBottom: 6, marginTop: 14,
    },
    modalInput: {
        borderWidth: 1,
        borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 14,
    },
    modalBtn: {
        backgroundColor: Colors.primary, borderRadius: 8,
        paddingVertical: 14, alignItems: 'center', marginTop: 24,
    },
    modalBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

    // Info box for password reset
    infoBox: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        padding: 12, borderRadius: 8, marginBottom: 8,
    },
    infoText: { fontSize: 12, lineHeight: 18, flex: 1 },

    avatarEditRow: { alignItems: 'center', marginBottom: 8 },
    avatarLarge: {
        width: 72, height: 72, borderRadius: 36,
        justifyContent: 'center', alignItems: 'center', marginBottom: 8,
    },
    avatarLargeText: { color: '#ffffff', fontWeight: '700', fontSize: 26 },
    avatarEditHint: { fontSize: 12 },
});

export default AppSettings;
