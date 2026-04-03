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
        return document.documentElement.getAttribute('data-theme') || localStorage.getItem('optisched-theme') || 'dark';
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
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('optisched-theme', newTheme);
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
                .settings-page .page-header h1 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.5rem; }

                .settings-layout { display: flex; gap: 1.5rem; min-height: calc(100vh - 220px); }
                .settings-sidebar { width: 240px; padding: 0.75rem; display: flex; flex-direction: column; flex-shrink: 0; }
                .settings-tab { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 10px; background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 0.9rem; transition: all 0.2s; width: 100%; text-align: left; }
                .settings-tab:hover { background: rgba(255,255,255,0.05); }
                .settings-tab.active { background: rgba(59,130,246,0.12); color: var(--brand-primary); font-weight: 600; }
                .settings-tab.danger { color: #ef4444; margin-top: auto; }
                .settings-tab.danger:hover { background: rgba(239,68,68,0.1); }
                .sidebar-spacer { flex: 1; }

                .settings-content { flex: 1; padding: 2rem; }
                .settings-section h2 { font-size: 1.25rem; margin-bottom: 0.5rem; }
                .section-desc { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem; }

                .profile-card-settings { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; padding: 1.25rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border-light); border-radius: 14px; }
                .profile-avatar-settings { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: white; flex-shrink: 0; }
                .profile-card-settings h3 { margin: 0 0 4px; }
                .role-badge-settings { background: rgba(139,92,246,0.15); color: #a78bfa; padding: 3px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.5px; }

                .s-form-group { margin-bottom: 1.25rem; }
                .s-form-group label { font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; display: block; }
                .s-form-group input { width: 100%; padding: 0.75rem 1rem; background: rgba(15,23,42,0.5); border: 1px solid var(--border-light); border-radius: 10px; color: var(--text-primary); font-size: 0.9rem; outline: none; transition: border-color 0.2s; }
                .s-form-group input:focus { border-color: var(--brand-primary); }
                .s-form-group input:disabled { opacity: 0.5; cursor: not-allowed; }

                .password-input-wrap { position: relative; }
                .password-input-wrap input { padding-right: 44px; }
                .eye-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; }

                .s-save-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; border-radius: 10px; background: var(--brand-primary); color: white; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; margin-top: 0.5rem; }
                .s-save-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(59,130,246,0.3); }
                .s-save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
                .s-save-btn.saved { background: #10b981; }

                .toggle-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
                .toggle-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: rgba(255,255,255,0.02); border: 1px solid var(--border-light); border-radius: 12px; transition: background 0.2s; }
                .toggle-item:hover { background: rgba(255,255,255,0.04); }
                .toggle-info { display: flex; align-items: center; gap: 0.75rem; }
                .toggle-info strong { font-size: 0.9rem; display: block; }
                .toggle-info p { font-size: 0.8rem; color: var(--text-muted); margin: 2px 0 0; }

                .toggle-switch { width: 48px; height: 26px; border-radius: 13px; background: rgba(255,255,255,0.1); border: none; cursor: pointer; position: relative; transition: background 0.3s; padding: 2px; flex-shrink: 0; }
                .toggle-switch.on { background: var(--brand-primary); }
                .toggle-thumb { width: 22px; height: 22px; border-radius: 50%; background: white; transition: transform 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
                .toggle-switch.on .toggle-thumb { transform: translateX(22px); }

                .theme-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
                .theme-card { padding: 1.25rem; border-radius: 14px; border: 2px solid var(--border-light); background: transparent; color: var(--text-secondary); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; transition: all 0.25s; }
                .theme-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.03); }
                .theme-card.active { border-color: var(--brand-primary); background: rgba(59,130,246,0.06); color: var(--brand-primary); }
                .theme-card span { font-size: 0.85rem; font-weight: 600; }

                .theme-preview { width: 100%; height: 64px; border-radius: 8px; display: flex; gap: 4px; overflow: hidden; margin-bottom: 6px; }
                .dark-preview { background: #0f172a; border: 1px solid #1e293b; }
                .dark-preview .tp-sidebar { width: 20%; background: #1e293b; }
                .dark-preview .tp-content { flex: 1; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
                .dark-preview .tp-block { background: #334155; border-radius: 3px; height: 12px; }
                .dark-preview .tp-block.sm { width: 60%; height: 8px; }
                .light-preview { background: #f1f5f9; border: 1px solid #e2e8f0; }
                .light-preview .tp-sidebar { width: 20%; background: #e2e8f0; }
                .light-preview .tp-content { flex: 1; padding: 6px; display: flex; flex-direction: column; gap: 4px; }
                .light-preview .tp-block { background: #cbd5e1; border-radius: 3px; height: 12px; }
                .light-preview .tp-block.sm { width: 60%; height: 8px; }

                .theme-active-badge { font-size: 0.65rem; background: var(--brand-primary); color: white; padding: 2px 8px; border-radius: 8px; font-weight: 600; }

                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }

                @media (max-width: 768px) {
                    .settings-layout { flex-direction: column; }
                    .settings-sidebar { width: 100%; flex-direction: row; overflow-x: auto; padding: 0.5rem; gap: 0.25rem; }
                    .sidebar-spacer { display: none; }
                    .settings-tab { white-space: nowrap; padding: 0.5rem 0.75rem; font-size: 0.8rem; }
                }
            `}</style>
        </div>
    );
};

export default AppSettings;
