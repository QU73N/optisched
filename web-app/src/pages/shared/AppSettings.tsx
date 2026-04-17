import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
    Settings, User, Shield, Moon, Sun, Bell, LogOut,
    Lock, Mail, Eye, EyeOff, Save, CheckCircle, Loader2
} from 'lucide-react';

const AppSettings: React.FC = () => {
    const { profile, session } = useAuth();
    const [activeTab, setActiveTab] = useState('account');

    // Account
    const [fullName, setFullName] = useState(profile?.full_name || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Theme — read from document
    const [theme, setTheme] = useState(() => {
        return document.documentElement.getAttribute('data-theme') || localStorage.getItem('optisched-theme') || 'light';
    });

    // Notifications
    const [emailNotifs, setEmailNotifs] = useState(true);
    const [scheduleNotifs, setScheduleNotifs] = useState(true);
    const [announcementNotifs, setAnnouncementNotifs] = useState(true);

    // Security
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    const applyTheme = (newTheme: string) => {
        document.documentElement.setAttribute('data-transitioning-theme', '');
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('optisched-theme', newTheme);
        setTimeout(() => {
            document.documentElement.removeAttribute('data-transitioning-theme');
        }, 450);
    };

    // Sync on mount
    useEffect(() => {
        const stored = localStorage.getItem('optisched-theme');
        if (stored) {
            document.documentElement.setAttribute('data-theme', stored);
            setTheme(stored);
        }
    }, []);

    const handleSaveProfile = async () => {
        if (!profile?.id) return;
        setSaving(true);
        try {
            await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            window.alert('Error: ' + err.message);
        } finally { setSaving(false); }
    };

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            window.alert('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            window.alert('Password must be at least 6 characters');
            return;
        }
        setChangingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            window.alert('Password updated successfully');
            setNewPassword(''); setConfirmPassword('');
        } catch (err: any) {
            window.alert('Error: ' + err.message);
        } finally { setChangingPassword(false); }
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
                                <div className="profile-avatar-settings">{profile?.full_name?.charAt(0) || 'U'}</div>
                                <div>
                                    <h3>{profile?.full_name}</h3>
                                    <span className="role-badge-settings">{profile?.role?.toUpperCase()}</span>
                                </div>
                            </div>
                            <div className="s-form-group">
                                <label>Full Name</label>
                                <input value={fullName} onChange={e => setFullName(e.target.value)} />
                            </div>
                            <div className="s-form-group">
                                <label>Email</label>
                                <input value={session?.user?.email || ''} disabled />
                            </div>
                            <div className="s-form-group">
                                <label>Role</label>
                                <input value={profile?.role || ''} disabled />
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
                                    <button className={`toggle-switch ${emailNotifs ? 'on' : ''}`} onClick={() => setEmailNotifs(!emailNotifs)}>
                                        <div className="toggle-thumb" />
                                    </button>
                                </div>
                                <div className="toggle-item">
                                    <div className="toggle-info">
                                        <Bell size={20} color="#10b981" />
                                        <div><strong>Schedule Changes</strong><p>Get notified when schedules update</p></div>
                                    </div>
                                    <button className={`toggle-switch ${scheduleNotifs ? 'on' : ''}`} onClick={() => setScheduleNotifs(!scheduleNotifs)}>
                                        <div className="toggle-thumb" />
                                    </button>
                                </div>
                                <div className="toggle-item">
                                    <div className="toggle-info">
                                        <Bell size={20} color="#f59e0b" />
                                        <div><strong>Announcements</strong><p>Stay updated with new announcements</p></div>
                                    </div>
                                    <button className={`toggle-switch ${announcementNotifs ? 'on' : ''}`} onClick={() => setAnnouncementNotifs(!announcementNotifs)}>
                                        <div className="toggle-thumb" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="settings-section">
                            <h2>Security Settings</h2>
                            <div className="s-form-group">
                                <label>New Password</label>
                                <div className="password-input-wrap">
                                    <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" />
                                    <button className="eye-btn" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                                </div>
                            </div>
                            <div className="s-form-group">
                                <label>Confirm New Password</label>
                                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
                            </div>
                            <button className="s-save-btn" onClick={handleChangePassword} disabled={changingPassword || !newPassword || !confirmPassword}>
                                {changingPassword ? <><Loader2 size={16} className="spin" /> Updating...</> : <><Lock size={16} /> Update Password</>}
                            </button>
                        </div>
                    )}

                    {activeTab === 'appearance' && (
                        <div className="settings-section">
                            <h2>Appearance</h2>
                            <p className="section-desc">Choose your preferred visual theme.</p>
                            <div className="theme-cards">
                                <button className={`theme-card ${theme === 'dark' ? 'active' : ''}`} onClick={() => applyTheme('dark')}>
                                    <div className="theme-preview dark-preview">
                                        <div className="tp-sidebar" /><div className="tp-content"><div className="tp-block" /><div className="tp-block sm" /></div>
                                    </div>
                                    <Moon size={18} />
                                    <span>Dark Mode</span>
                                    {theme === 'dark' && <span className="theme-active-badge">Active</span>}
                                </button>
                                <button className={`theme-card ${theme === 'light' ? 'active' : ''}`} onClick={() => applyTheme('light')}>
                                    <div className="theme-preview light-preview">
                                        <div className="tp-sidebar" /><div className="tp-content"><div className="tp-block" /><div className="tp-block sm" /></div>
                                    </div>
                                    <Sun size={18} />
                                    <span>Light Mode</span>
                                    {theme === 'light' && <span className="theme-active-badge">Active</span>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .settings-page { display: flex; flex-direction: column; gap: 1.5rem; }

                .settings-layout { display: flex; gap: 20px; min-height: calc(100vh - 220px); }
                .settings-sidebar { width: 220px; padding: 8px; display: flex; flex-direction: column; flex-shrink: 0; }
                .settings-tab { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--radius-md); background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 13px; font-weight: 500; font-family: var(--font-sans); transition: all 120ms ease; width: 100%; text-align: left; }
                .settings-tab:hover { background: var(--bg-hover); color: var(--text-primary); }
                .settings-tab.active { background: var(--accent-primary-subtle); color: var(--accent-primary); font-weight: 600; }
                .settings-tab.danger { color: var(--accent-error); margin-top: auto; }
                .settings-tab.danger:hover { background: var(--accent-error-subtle); }
                .sidebar-spacer { flex: 1; }

                .settings-content { flex: 1; padding: 28px; }
                .settings-section h2 { font-family: var(--font-display); font-size: 18px; font-weight: 600; margin-bottom: 6px; letter-spacing: -0.01em; }
                .section-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }

                .profile-card-settings { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; padding: 18px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-lg); }
                .profile-avatar-settings { width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #fff; flex-shrink: 0; }
                .profile-card-settings h3 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
                .role-badge-settings { background: var(--accent-primary-subtle); color: var(--accent-primary); padding: 2px 10px; border-radius: var(--radius-full); font-size: 10px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; }

                .s-form-group { margin-bottom: 18px; }
                .s-form-group label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; display: block; }
                .s-form-group input { width: 100%; padding: 10px 14px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-md); color: var(--text-primary); font-size: 14px; outline: none; transition: border-color 120ms ease, box-shadow 120ms ease; font-family: var(--font-sans); }
                .s-form-group input:focus { border-color: var(--accent-primary); box-shadow: var(--shadow-focus); }
                .s-form-group input:disabled { opacity: 0.45; cursor: not-allowed; }

                .password-input-wrap { position: relative; }
                .password-input-wrap input { padding-right: 44px; }
                .eye-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: var(--radius-sm); transition: color 120ms ease; }
                .eye-btn:hover { color: var(--text-primary); }

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
