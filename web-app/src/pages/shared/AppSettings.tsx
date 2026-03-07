import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, Bell, Shield, Palette, LogOut } from 'lucide-react';
import '../admin/Dashboard.css';

const AppSettings: React.FC = () => {
    const { profile, role, signOut } = useAuth();

    const [notifications, setNotifications] = useState({
        scheduleChanges: true,
        conflictAlerts: true,
        messageNotifs: true,
        systemUpdates: false,
    });

    const [appearance, setAppearance] = useState({
        theme: localStorage.getItem('optisched-theme') || 'light',
        compactMode: false,
        showAnimations: true,
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', appearance.theme);
        localStorage.setItem('optisched-theme', appearance.theme);
    }, [appearance.theme]);

    const toggleNotif = (key: keyof typeof notifications) => {
        setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const SettingsSection: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
        <div className="card" style={{ marginBottom: 16 }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={18} style={{ color: 'var(--accent-primary)' }} /> {title}
            </h3>
            {children}
        </div>
    );

    const ToggleRow: React.FC<{ label: string; desc: string; checked: boolean; onChange: () => void }> = ({ label, desc, checked, onChange }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }}>
                <input type="checkbox" checked={checked} onChange={onChange}
                    style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{
                    position: 'absolute', cursor: 'pointer', inset: 0, borderRadius: 12,
                    background: checked ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    transition: 'background 200ms ease',
                    border: `1px solid ${checked ? 'transparent' : 'var(--border-default)'}`,
                }}>
                    <span style={{
                        position: 'absolute', height: 18, width: 18, left: checked ? 22 : 2, top: 2,
                        background: checked ? '#fff' : 'var(--text-muted)', borderRadius: '50%',
                        transition: 'left 200ms ease, background 200ms ease',
                    }} />
                </span>
            </label>
        </div>
    );

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Settings</h1>
                    <p className="dashboard-subtitle">Manage your account and preferences</p>
                </div>
            </div>

            {/* Account */}
            <SettingsSection title="Account" icon={User}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                    <div>
                        <div className="input-label">Full Name</div>
                        <div className="input" style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}>{profile?.full_name || 'Not set'}</div>
                    </div>
                    <div>
                        <div className="input-label">Email</div>
                        <div className="input" style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}>{profile?.email || 'Not set'}</div>
                    </div>
                    <div>
                        <div className="input-label">Role</div>
                        <div className="input" style={{ display: 'flex', alignItems: 'center', opacity: 0.7, textTransform: 'capitalize' }}>{role || 'Unknown'}</div>
                    </div>
                    {profile?.program && (
                        <div>
                            <div className="input-label">Program</div>
                            <div className="input" style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}>{profile.program}</div>
                        </div>
                    )}
                </div>
            </SettingsSection>

            {/* Notifications */}
            <SettingsSection title="Notifications" icon={Bell}>
                <ToggleRow label="Schedule Changes" desc="Get notified when schedules are modified" checked={notifications.scheduleChanges} onChange={() => toggleNotif('scheduleChanges')} />
                <ToggleRow label="Conflict Alerts" desc="Alert when scheduling conflicts are detected" checked={notifications.conflictAlerts} onChange={() => toggleNotif('conflictAlerts')} />
                <ToggleRow label="Messages" desc="Notifications for new messages" checked={notifications.messageNotifs} onChange={() => toggleNotif('messageNotifs')} />
                <ToggleRow label="System Updates" desc="Platform updates and maintenance notices" checked={notifications.systemUpdates} onChange={() => toggleNotif('systemUpdates')} />
            </SettingsSection>

            {/* Appearance */}
            <SettingsSection title="Appearance" icon={Palette}>
                <div style={{ marginBottom: 14 }}>
                    <div className="input-label">Theme</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {['dark', 'light'].map(t => (
                            <button key={t} className={`btn ${appearance.theme === t ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ flex: 1, textTransform: 'capitalize' }}
                                onClick={() => setAppearance(prev => ({ ...prev, theme: t }))}>
                                {t} Mode
                            </button>
                        ))}
                    </div>
                </div>
                <ToggleRow label="Compact Mode" desc="Reduce spacing for dense information display" checked={appearance.compactMode} onChange={() => setAppearance(prev => ({ ...prev, compactMode: !prev.compactMode }))} />
                <ToggleRow label="Animations" desc="Enable smooth transitions and motion effects" checked={appearance.showAnimations} onChange={() => setAppearance(prev => ({ ...prev, showAnimations: !prev.showAnimations }))} />
            </SettingsSection>

            {/* Security */}
            <SettingsSection title="Security" icon={Shield}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Password</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Change your password (minimum 8 characters)</div>
                    </div>
                    <button className="btn btn-secondary" style={{ fontSize: 12 }}>Change Password</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Active Sessions</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>You are currently signed in on this device</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--accent-success)', fontWeight: 600 }}>1 active</span>
                </div>
            </SettingsSection>

            {/* Sign Out */}
            <div className="card" style={{ textAlign: 'center' }}>
                <button className="btn btn-secondary" onClick={signOut} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', padding: '10px 24px' }}>
                    <LogOut size={16} /> Sign Out
                </button>
            </div>
        </div>
    );
};

export default AppSettings;
