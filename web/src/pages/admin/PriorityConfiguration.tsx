import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ADMIN_ROLES } from '../../types/database';
import { Save, RotateCcw, Settings, Sliders } from 'lucide-react';
import '../admin/Dashboard.css';

interface PriorityConfig {
    id: string;
    key: string;
    value: Record<string, unknown>;
    description: string | null;
    category: string;
    is_active: boolean;
}

const PriorityConfiguration: React.FC = () => {
    const { role, roles } = useAuth();
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const canEdit = allRoles.some(r => ADMIN_ROLES.includes(r));
    
    const [configs, setConfigs] = useState<PriorityConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [sectionMultiplier, setSectionMultiplier] = useState(1.0);
    const [teacherMultiplier, setTeacherMultiplier] = useState(1.0);
    const [subjectMultiplier, setSubjectMultiplier] = useState(1.0);
    const [roomMultiplier, setRoomMultiplier] = useState(1.0);
    const [conflictStrategy, setConflictStrategy] = useState('highest_weight');
    const [priorityThreshold, setPriorityThreshold] = useState(60);

    const fetchConfigs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('priority_config')
            .select('*')
            .eq('is_active', true)
            .order('key');
        
        if (error) {
            console.error('Error fetching priority configs:', error);
            setMessage({ type: 'error', text: 'Failed to load priority configuration' });
        } else {
            setConfigs(data || []);
            
            // Populate form state
            data?.forEach(config => {
                const value = config.value as Record<string, unknown>;
                switch (config.key) {
                    case 'section_weight_multiplier':
                        setSectionMultiplier((value.multiplier as number) || 1.0);
                        break;
                    case 'teacher_weight_multiplier':
                        setTeacherMultiplier((value.multiplier as number) || 1.0);
                        break;
                    case 'subject_weight_multiplier':
                        setSubjectMultiplier((value.multiplier as number) || 1.0);
                        break;
                    case 'room_weight_multiplier':
                        setRoomMultiplier((value.multiplier as number) || 1.0);
                        break;
                    case 'conflict_resolution_strategy':
                        setConflictStrategy((value.strategy as string) || 'highest_weight');
                        break;
                    case 'priority_threshold':
                        setPriorityThreshold((value.threshold as number) || 60);
                        break;
                }
            });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchConfigs();
    }, []);

    const handleSave = async () => {
        if (!canEdit) return;
        
        setSaving(true);
        setMessage(null);

        try {
            const updates = [
                { key: 'section_weight_multiplier', value: { multiplier: sectionMultiplier } },
                { key: 'teacher_weight_multiplier', value: { multiplier: teacherMultiplier } },
                { key: 'subject_weight_multiplier', value: { multiplier: subjectMultiplier } },
                { key: 'room_weight_multiplier', value: { multiplier: roomMultiplier } },
                { key: 'conflict_resolution_strategy', value: { strategy: conflictStrategy } },
                { key: 'priority_threshold', value: { threshold: priorityThreshold } },
            ];

            for (const update of updates) {
                const { error } = await supabase.rpc('update_priority_config', {
                    p_key: update.key,
                    p_value: update.value,
                    p_updated_by: (await supabase.auth.getUser()).data.user?.id
                });
                if (error) throw error;
            }

            setMessage({ type: 'success', text: 'Priority configuration saved successfully' });
            await fetchConfigs();
        } catch (error) {
            console.error('Error saving priority config:', error);
            setMessage({ type: 'error', text: 'Failed to save priority configuration' });
        }

        setSaving(false);
    };

    const handleReset = async () => {
        if (!canEdit) return;
        
        setSectionMultiplier(1.0);
        setTeacherMultiplier(1.0);
        setSubjectMultiplier(1.0);
        setRoomMultiplier(1.0);
        setConflictStrategy('highest_weight');
        setPriorityThreshold(60);
        setMessage({ type: 'success', text: 'Configuration reset to defaults' });
    };

    if (loading) {
        return (
            <div className="dashboard fade-in">
                <div className="dashboard-header">
                    <div>
                        <h1 className="dashboard-title">Priority Configuration</h1>
                        <p className="dashboard-subtitle">Configure global priority settings for schedule generation</p>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Priority Configuration</h1>
                    <p className="dashboard-subtitle">Configure global priority settings for schedule generation</p>
                </div>
                {canEdit && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" onClick={handleReset} disabled={saving}>
                            <RotateCcw size={16} />
                            Reset to Defaults
                        </button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Save size={16} />}
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                )}
            </div>

            {message && (
                <div style={{
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 24,
                    background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
                    color: message.type === 'success' ? '#10b981' : '#ef4444',
                    fontSize: 14
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
                {/* Weight Multipliers */}
                <div className="dash-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <Sliders size={20} style={{ color: 'var(--accent-primary)' }} />
                        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Weight Multipliers</h2>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                        Adjust how much each entity type influences the final priority score. Higher multipliers give that entity type more influence.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
                                Section Weight Multiplier
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="5"
                                value={sectionMultiplier}
                                onChange={(e) => setSectionMultiplier(parseFloat(e.target.value))}
                                disabled={!canEdit}
                                className="input"
                                style={{ width: '100%' }}
                            />
                        </div>
                        
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
                                Teacher Weight Multiplier
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="5"
                                value={teacherMultiplier}
                                onChange={(e) => setTeacherMultiplier(parseFloat(e.target.value))}
                                disabled={!canEdit}
                                className="input"
                                style={{ width: '100%' }}
                            />
                        </div>
                        
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
                                Subject Weight Multiplier
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="5"
                                value={subjectMultiplier}
                                onChange={(e) => setSubjectMultiplier(parseFloat(e.target.value))}
                                disabled={!canEdit}
                                className="input"
                                style={{ width: '100%' }}
                            />
                        </div>
                        
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
                                Room Weight Multiplier
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="5"
                                value={roomMultiplier}
                                onChange={(e) => setRoomMultiplier(parseFloat(e.target.value))}
                                disabled={!canEdit}
                                className="input"
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Conflict Resolution */}
                <div className="dash-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <Settings size={20} style={{ color: 'var(--accent-primary)' }} />
                        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Conflict Resolution</h2>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                        Configure how the generator resolves scheduling conflicts when multiple assignments compete for the same slot.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
                                Conflict Resolution Strategy
                            </label>
                            <select
                                value={conflictStrategy}
                                onChange={(e) => setConflictStrategy(e.target.value)}
                                disabled={!canEdit}
                                className="input"
                                style={{ width: '100%' }}
                            >
                                <option value="highest_weight">Highest Weight Priority</option>
                                <option value="earliest_slot">Earliest Available Slot</option>
                                <option value="balanced">Balanced (Priority + Availability)</option>
                            </select>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                {conflictStrategy === 'highest_weight' && 'Assign slot to highest priority entity'}
                                {conflictStrategy === 'earliest_slot' && 'Assign slot to earliest available time'}
                                {conflictStrategy === 'balanced' && 'Balance between priority and availability'}
                            </p>
                        </div>
                        
                        <div>
                            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
                                Priority Threshold (High Priority)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={priorityThreshold}
                                onChange={(e) => setPriorityThreshold(parseInt(e.target.value))}
                                disabled={!canEdit}
                                className="input"
                                style={{ width: '100%' }}
                            />
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                Entities with weight ≥ {priorityThreshold} are considered high priority
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Configuration History */}
            <div className="dash-card" style={{ padding: 24, marginTop: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Current Configuration</h2>
                <div style={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                                <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Key</th>
                                <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Value</th>
                                <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: 'var(--text-secondary)' }}>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {configs.map(config => (
                                <tr key={config.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{config.key}</td>
                                    <td style={{ padding: 8 }}>{JSON.stringify(config.value)}</td>
                                    <td style={{ padding: 8, color: 'var(--text-muted)' }}>{config.description || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PriorityConfiguration;
