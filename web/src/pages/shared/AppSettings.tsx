import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { supabase } from '../../lib/supabase';
import {
    Settings, User, Shield, Moon, Sun, Bell, LogOut,
    Lock, Save, CheckCircle, Loader2, Layers,
    Camera, Upload, X
} from 'lucide-react';

const AppSettings: React.FC = () => {
    const { profile, session } = useAuth();
    const { preferences, updatePreferences } = useUserPreferences();
    const [activeTab, setActiveTab] = useState('account');

    // Account
    const [fullName, setFullName] = useState(profile?.full_name || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Security — Password reset request
    const [resetReason, setResetReason] = useState('');
    const [sendingReset, setSendingReset] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    const handleSaveProfile = async () => {
        if (!profile?.id) return;
        setSaving(true);
        try {
            await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: unknown) {
            window.alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally { setSaving(false); }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            window.alert('Please select an image file');
            return;
        }
        
        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            window.alert('Image must be less than 2MB');
            return;
        }

        setAvatarFile(file);
        
        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatarPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleAvatarUpload = async () => {
        if (!avatarFile || !profile?.id) return;
        
        setUploadingAvatar(true);
        try {
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // Upload to Supabase storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, avatarFile);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Update profile with avatar URL
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', profile.id);

            if (updateError) throw updateError;

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            setAvatarFile(null);
        } catch (err: unknown) {
            window.alert('Error uploading avatar: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleRemoveAvatar = async () => {
        if (!profile?.id) return;
        
        if (!window.confirm('Are you sure you want to remove your profile picture?')) return;
        
        setSaving(true);
        try {
            await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id);
            setAvatarPreview(null);
            setAvatarFile(null);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: unknown) {
            window.alert('Error removing avatar: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordResetRequest = async () => {
        setSendingReset(true);
        try {
            const { error } = await supabase.from('password_reset_requests').insert({
                user_id: profile?.id,
                email: session?.user?.email || '',
                user_name: profile?.full_name || '',
                reason: resetReason.trim() || 'User requested password reset',
                status: 'pending',
                requested_at: new Date().toISOString(),
            });
            if (error) {
                // Fallback: create notification
                console.warn('[Settings] password_reset_requests error:', error.message);
                await supabase.from('notifications').insert({
                    user_id: profile?.id,
                    title: 'Password Reset Request',
                    message: `${profile?.full_name || 'A user'} (${session?.user?.email || ''}) has requested a password reset. Reason: ${resetReason.trim() || 'Not specified'}`,
                    type: 'password_reset',
                    is_read: false,
                });
            }
            setResetSent(true);
            setResetReason('');
            setTimeout(() => setResetSent(false), 5000);
        } catch (err: unknown) {
            window.alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally { setSendingReset(false); }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    const tabs = [
        { id: 'account', label: 'Account', icon: <User size={16} /> },
        { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
        { id: 'security', label: 'Security', icon: <Shield size={16} /> },
        { id: 'appearance', label: 'Appearance', icon: <Moon size={16} /> },
    ];

    return (
        <div className="settings-page">
            <div className="page-header">
                <h1><Settings size={24} /> Settings</h1>
            </div>

            <div className="settings-layout">
                <div className="settings-sidebar glass-panel">
                    {tabs.map(tab => (
                        <button key={tab.id} className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                    <div className="sidebar-spacer" />
                    <button className="settings-tab danger" onClick={handleSignOut}><LogOut size={16} /> Sign Out</button>
                </div>

                <div className="settings-content glass-panel">
                    {activeTab === 'account' && (
                        <div className="settings-section">
                            <h2>Account Information</h2>
                            <div className="profile-card-settings">
                                <div className="profile-avatar-container">
                                    {avatarPreview ? (
                                        <img src={avatarPreview} alt="Profile" className="profile-avatar-image" />
                                    ) : (
                                        <div className="profile-avatar-settings">{profile?.full_name?.charAt(0) || 'U'}</div>
                                    )}
                                    <div className="avatar-overlay" onClick={() => fileInputRef.current?.click()}>
                                        <Camera size={20} />
                                    </div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3>{profile?.full_name}</h3>
                                    <span className="role-badge-settings">{profile?.role?.toUpperCase()}</span>
                                </div>
                                <div className="avatar-actions">
                                    {avatarPreview && (
                                        <button className="avatar-btn remove" onClick={handleRemoveAvatar} disabled={saving}>
                                            <X size={14} /> Remove
                                        </button>
                                    )}
                                    {avatarFile && (
                                        <button className="avatar-btn upload" onClick={handleAvatarUpload} disabled={uploadingAvatar}>
                                            {uploadingAvatar ? <><Loader2 size={14} className="spin" /> Uploading...</> : <><Upload size={14} /> Upload</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleAvatarChange}
                            />
                            <div className="s-form-group">
                                <label>Full Name</label>
                                <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} />
                            </div>
                            <div className="s-form-group">
                                <label>Email</label>
                                <input className="input" value={session?.user?.email || ''} disabled />
                            </div>
                            <div className="s-form-group">
                                <label>Role</label>
                                <input className="input" value={profile?.role || ''} disabled />
                            </div>
                            <button className={`s-save-btn ${saved ? 'saved' : ''}`} onClick={handleSaveProfile} disabled={saving}>
                                {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : saved ? <><CheckCircle size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
                            </button>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="settings-section">
                            <h2>Notification Preferences</h2>
                            <div className="toggle-list">
                                <div className="toggle-item">
                                    <div className="toggle-info">
                                        <Mail size={20} color="#60a5fa" />
                                        <div><strong>Email Notifications</strong><p>Receive updates via email</p></div>
                                    </div>
                                    <button className={`toggle-switch ${preferences.email_notifications ? 'on' : ''}`} onClick={() => updatePreferences({ email_notifications: !preferences.email_notifications })}>
                                        <div className="toggle-thumb" />
                                    </button>
                                </div>
                                <div className="toggle-item">
                                    <div className="toggle-info">
                                        <Bell size={20} color="#10b981" />
                                        <div><strong>Schedule Changes</strong><p>Get notified when schedules update</p></div>
                                    </div>
                                    <button className={`toggle-switch ${preferences.schedule_notifications ? 'on' : ''}`} onClick={() => updatePreferences({ schedule_notifications: !preferences.schedule_notifications })}>
                                        <div className="toggle-thumb" />
                                    </button>
                                </div>
                                <div className="toggle-item">
                                    <div className="toggle-info">
                                        <Bell size={20} color="#f59e0b" />
                                        <div><strong>Announcements</strong><p>Stay updated with new announcements</p></div>
                                    </div>
                                    <button className={`toggle-switch ${preferences.announcement_notifications ? 'on' : ''}`} onClick={() => updatePreferences({ announcement_notifications: !preferences.announcement_notifications })}>
                                        <div className="toggle-thumb" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="settings-section">
                            <h2>Security Settings</h2>
                            <div className="reset-request-card">
                                <div className="reset-request-icon">
                                    <Lock size={24} />
                                </div>
                                <div className="reset-request-info">
                                    <h3>Request Password Reset</h3>
                                    <p>For security, password changes must be approved by an administrator. Submit a request and the admin will set a new password for your account.</p>
                                </div>
                            </div>
                            <div className="s-form-group">
                                <label>Reason (optional)</label>
                                <textarea className="input" value={resetReason} onChange={e => setResetReason(e.target.value)} placeholder="e.g. Forgot my password, need a reset..." rows={3} style={{ resize: 'none', minHeight: 80 }} />
                            </div>
                            <button className={`s-save-btn ${resetSent ? 'saved' : ''}`} onClick={handlePasswordResetRequest} disabled={sendingReset}>
                                {sendingReset ? <><Loader2 size={16} className="spin" /> Sending...</> : resetSent ? <><CheckCircle size={16} /> Request Sent!</> : <><Lock size={16} /> Send Reset Request</>}
                            </button>
                            {resetSent && (
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>Your request has been sent to the administrator. You'll be notified once it's been processed.</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="settings-section">
                            <h2>Appearance</h2>
                            <p className="section-desc">Choose your preferred visual theme and time format.</p>
                            <div className="theme-cards">
                                <button className={`theme-card ${preferences.theme === 'dark' ? 'active' : ''}`} onClick={() => updatePreferences({ theme: 'dark' })}>
                                    <div className="theme-preview dark-preview">
                                        <div className="tp-sidebar" /><div className="tp-content"><div className="tp-block" /><div className="tp-block sm" /></div>
                                    </div>
                                    <Moon size={18} />
                                    <span>Dark Mode</span>
                                    {preferences.theme === 'dark' && <span className="theme-active-badge">Active</span>}
                                </button>
                                <button className={`theme-card ${preferences.theme === 'light' ? 'active' : ''}`} onClick={() => updatePreferences({ theme: 'light' })}>
                                    <div className="theme-preview light-preview">
                                        <div className="tp-sidebar" /><div className="tp-content"><div className="tp-block" /><div className="tp-block sm" /></div>
                                    </div>
                                    <Sun size={18} />
                                    <span>Light Mode</span>
                                    {preferences.theme === 'light' && <span className="theme-active-badge">Active</span>}
                                </button>
                            </div>
                            <div style={{ marginTop: 24 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Time Format</h3>
                                <div className="theme-cards">
                                    <button className={`theme-card ${preferences.time_format === '24h' ? 'active' : ''}`} onClick={() => updatePreferences({ time_format: '24h' })}>
                                        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>24h</span>
                                        <span>24-Hour Format</span>
                                        {preferences.time_format === '24h' && <span className="theme-active-badge">Active</span>}
                                    </button>
                                    <button className={`theme-card ${preferences.time_format === '12h' ? 'active' : ''}`} onClick={() => updatePreferences({ time_format: '12h' })}>
                                        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>12h</span>
                                        <span>12-Hour Format</span>
                                        {preferences.time_format === '12h' && <span className="theme-active-badge">Active</span>}
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginTop: 24 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Animations</h3>
                                <div className="toggle-list">
                                    <div className="toggle-item">
                                        <div className="toggle-info">
                                            <strong>Landing Page Animations</strong>
                                            <p>Show animations on the landing page</p>
                                        </div>
                                        <button className={`toggle-switch ${preferences.landing_animations ? 'on' : ''}`} onClick={() => updatePreferences({ landing_animations: !preferences.landing_animations })}>
                                            <div className="toggle-thumb" />
                                        </button>
                                    </div>
                                    <div className="toggle-item">
                                        <div className="toggle-info">
                                            <strong>Dashboard Animations</strong>
                                            <p>Show animations in the dashboard</p>
                                        </div>
                                        <button className={`toggle-switch ${preferences.dashboard_animations ? 'on' : ''}`} onClick={() => updatePreferences({ dashboard_animations: !preferences.dashboard_animations })}>
                                            <div className="toggle-thumb" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div style={{ marginTop: 24 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Compact Mode</h3>
                                <div className="toggle-list">
                                    <div className="toggle-item">
                                        <div className="toggle-info">
                                            <Layers size={20} color="#8b5cf6" />
                                            <div><strong>Compact View</strong><p>Show compact layout across the site</p></div>
                                        </div>
                                        <button className={`toggle-switch ${preferences.compact_mode ? 'on' : ''}`} onClick={() => updatePreferences({ compact_mode: !preferences.compact_mode })}>
                                            <div className="toggle-thumb" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .settings-page { display: flex; flex-direction: column; gap: 1.5rem; max-width: none !important; }

                .settings-layout { display: flex; gap: 20px; height: calc(100vh - 220px); }
                .settings-sidebar { width: 220px; padding: 8px; display: flex; flex-direction: column; flex-shrink: 0; }
                .settings-tab { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--radius-md); background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 13px; font-weight: 500; font-family: var(--font-sans); transition: all 120ms ease; width: 100%; text-align: left; }
                .settings-tab:hover { background: var(--bg-hover); color: var(--text-primary); }
                .settings-tab.active { background: var(--accent-primary-subtle); color: var(--accent-primary); font-weight: 600; }
                .settings-tab.danger { color: var(--accent-error); margin-top: auto; }
                .settings-tab.danger:hover { background: var(--accent-error-subtle); }
                .sidebar-spacer { flex: 1; }

                .settings-content { flex: 1; padding: 28px; overflow-y: auto; }
                .settings-section h2 { font-family: var(--font-display); font-size: 18px; font-weight: 600; margin-bottom: 6px; letter-spacing: -0.01em; }
                .section-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }

                .profile-card-settings { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding: 20px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-lg); }
                
                .profile-avatar-container { position: relative; width: 72px; height: 72px; flex-shrink: 0; cursor: pointer; }
                .profile-avatar-settings { width: 72px; height: 72px; border-radius: var(--radius-lg); background: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: #fff; }
                .profile-avatar-image { width: 72px; height: 72px; border-radius: var(--radius-lg); object-fit: cover; }
                .avatar-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.5); border-radius: var(--radius-lg); display: flex; align-items: center; justify-content: center; color: white; opacity: 0; transition: opacity 200ms ease; }
                .profile-avatar-container:hover .avatar-overlay { opacity: 1; }
                
                .avatar-actions { display: flex; flex-direction: column; gap: 8px; margin-left: auto; }
                .avatar-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--radius-md); border: none; cursor: pointer; font-size: 12px; font-weight: 600; font-family: var(--font-sans); transition: all 150ms ease; }
                .avatar-btn.upload { background: var(--accent-primary); color: white; }
                .avatar-btn.upload:hover:not(:disabled) { background: var(--accent-primary-hover); }
                .avatar-btn.remove { background: var(--bg-elevated); color: var(--text-secondary); border: 1px solid var(--border-default); }
                .avatar-btn.remove:hover:not(:disabled) { background: var(--accent-error-subtle); color: var(--accent-error); border-color: var(--accent-error); }
                .avatar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                
                .profile-card-settings h3 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
                .role-badge-settings { background: var(--accent-primary-subtle); color: var(--accent-primary); padding: 4px 12px; border-radius: var(--radius-full); font-size: 10px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; }

                .s-form-group { margin-bottom: 18px; }
                .s-form-group label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; display: block; }
                .s-form-group input { width: 100%; padding: 10px 14px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-md); color: var(--text-primary); font-size: 14px; outline: none; transition: border-color 120ms ease, box-shadow 120ms ease; font-family: var(--font-sans); }
                .s-form-group input:focus { border-color: var(--accent-primary); box-shadow: var(--shadow-focus); }
                .s-form-group input:disabled { opacity: 0.45; cursor: not-allowed; }

                .password-input-wrap { position: relative; }
                .password-input-wrap input { padding-right: 44px; }
                .eye-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: var(--radius-sm); transition: color 120ms ease; }
                .eye-btn:hover { color: var(--text-primary); }

                .reset-request-card { display: flex; align-items: flex-start; gap: 16px; padding: 20px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-lg); margin-bottom: 20px; }
                .reset-request-icon { width: 48px; height: 48px; border-radius: var(--radius-md); background: rgba(59,130,246,0.1); display: flex; align-items: center; justify-content: center; color: var(--accent-primary); flex-shrink: 0; }
                .reset-request-info h3 { font-size: 15px; font-weight: 600; margin: 0 0 6px; }
                .reset-request-info p { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin: 0; }

                .s-save-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: var(--radius-md); background: var(--accent-primary); color: #fff; border: none; cursor: pointer; font-weight: 600; font-size: 13.5px; font-family: var(--font-sans); transition: all 150ms ease; margin-top: 4px; box-shadow: var(--shadow-sm); }
                .s-save-btn:hover:not(:disabled) { background: var(--accent-primary-hover); box-shadow: var(--shadow-md); transform: translateY(-1px); }
                .s-save-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
                .s-save-btn.saved { background: var(--accent-success); }

                .toggle-list { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
                .toggle-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-lg); transition: background 120ms ease; }
                .toggle-item:hover { background: var(--bg-hover); }
                .toggle-info { display: flex; align-items: center; gap: 12px; }
                .toggle-info strong { font-size: 13.5px; display: block; font-weight: 600; }
                .toggle-info p { font-size: 12.5px; color: var(--text-muted); margin: 2px 0 0; }

                .toggle-switch { width: 44px; height: 24px; border-radius: 12px; background: var(--bg-elevated); border: 1px solid var(--border-default); cursor: pointer; position: relative; transition: background 200ms ease, border-color 200ms ease; padding: 2px; flex-shrink: 0; }
                .toggle-switch.on { background: var(--accent-primary); border-color: var(--accent-primary); }
                .toggle-thumb { width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 200ms var(--ease-out); box-shadow: 0 1px 2px rgba(0,0,0,0.15); }
                .toggle-switch.on .toggle-thumb { transform: translateX(20px); }

                /* Light mode: make toggle thumb visible when off */
                [data-theme="light"] .toggle-switch:not(.on) .toggle-thumb {
                    background: #94a3b8;
                }

                .theme-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                .theme-card { padding: 18px; border-radius: var(--radius-lg); border: 2px solid var(--border-default); background: transparent; color: var(--text-secondary); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: all 150ms ease; font-family: var(--font-sans); }
                .theme-card:hover { border-color: var(--border-accent); background: var(--accent-primary-subtle); }
                .theme-card.active { border-color: var(--accent-primary); background: var(--accent-primary-subtle); color: var(--accent-primary); }
                .theme-card span { font-size: 13px; font-weight: 600; }

                .theme-preview { width: 100%; height: 56px; border-radius: var(--radius-sm); display: flex; gap: 3px; overflow: hidden; margin-bottom: 4px; }
                .dark-preview { background: #0b1121; border: 1px solid #1c2b44; }
                .dark-preview .tp-sidebar { width: 20%; background: #111a2e; }
                .dark-preview .tp-content { flex: 1; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
                .dark-preview .tp-block { background: #1c2a45; border-radius: 2px; height: 10px; }
                .dark-preview .tp-block.sm { width: 60%; height: 7px; }
                .light-preview { background: #f4f6fb; border: 1px solid #e2e7f0; }
                .light-preview .tp-sidebar { width: 20%; background: #ffffff; }
                .light-preview .tp-content { flex: 1; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
                .light-preview .tp-block { background: #e2e7f0; border-radius: 2px; height: 10px; }
                .light-preview .tp-block.sm { width: 60%; height: 7px; }

                .theme-active-badge { font-size: 9px; background: var(--accent-primary); color: #fff; padding: 2px 8px; border-radius: var(--radius-full); font-weight: 600; letter-spacing: 0.3px; text-transform: uppercase; }

                @media (max-width: 768px) {
                    .settings-layout { flex-direction: column; }
                    .settings-sidebar { width: 100%; flex-direction: row; overflow-x: auto; padding: 6px; gap: 4px; }
                    .sidebar-spacer { display: none; }
                    .settings-tab { white-space: nowrap; padding: 8px 12px; font-size: 12px; }
                }
            `}</style>
        </div>
    );
};

export default AppSettings;
