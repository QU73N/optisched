import React, { useState } from 'react';
import { Settings, Clock, Save, RotateCcw } from 'lucide-react';
import '../admin/Dashboard.css';

interface ConstraintConfig {
    maxTeacherHoursPerDay: number;
    maxTeacherHoursPerWeek: number;
    minBreakBetweenClasses: number;
    maxConsecutiveHours: number;
    preferredStartTime: string;
    preferredEndTime: string;
    allowSaturdayClasses: boolean;
    maxClassesPerRoom: number;
    prioritizeLabForLabSubjects: boolean;
    avoidBackToBackDifferentBuildings: boolean;
}

const defaultConfig: ConstraintConfig = {
    maxTeacherHoursPerDay: 8,
    maxTeacherHoursPerWeek: 40,
    minBreakBetweenClasses: 15,
    maxConsecutiveHours: 4,
    preferredStartTime: '07:00',
    preferredEndTime: '21:00',
    allowSaturdayClasses: true,
    maxClassesPerRoom: 10,
    prioritizeLabForLabSubjects: true,
    avoidBackToBackDifferentBuildings: true,
};

const ConstraintSettings: React.FC = () => {
    const [config, setConfig] = useState<ConstraintConfig>(defaultConfig);
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        // In a real implementation, save to Supabase
        localStorage.setItem('optisched_constraints', JSON.stringify(config));
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const handleReset = () => {
        if (confirm('Reset all constraints to defaults?')) {
            setConfig(defaultConfig);
        }
    };

    const updateConfig = <K extends keyof ConstraintConfig>(key: K, value: ConstraintConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Constraint Settings</h1>
                    <p className="dashboard-subtitle">Configure scheduling rules and constraints</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={handleReset}>
                        <RotateCcw size={16} /> Reset
                    </button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <Save size={16} /> {saved ? 'Saved!' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
                {/* Teacher Constraints */}
                <div className="card">
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Settings size={18} style={{ color: 'var(--accent-primary)' }} />
                        Teacher Constraints
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="field">
                            <label className="field-label">MAX HOURS PER DAY</label>
                            <input className="input" type="number" min={1} max={12} value={config.maxTeacherHoursPerDay} onChange={e => updateConfig('maxTeacherHoursPerDay', parseInt(e.target.value))} />
                        </div>
                        <div className="field">
                            <label className="field-label">MAX HOURS PER WEEK</label>
                            <input className="input" type="number" min={1} max={60} value={config.maxTeacherHoursPerWeek} onChange={e => updateConfig('maxTeacherHoursPerWeek', parseInt(e.target.value))} />
                        </div>
                        <div className="field">
                            <label className="field-label">MAX CONSECUTIVE HOURS</label>
                            <input className="input" type="number" min={1} max={8} value={config.maxConsecutiveHours} onChange={e => updateConfig('maxConsecutiveHours', parseInt(e.target.value))} />
                        </div>
                        <div className="field">
                            <label className="field-label">MIN BREAK BETWEEN CLASSES (minutes)</label>
                            <input className="input" type="number" min={0} max={60} step={5} value={config.minBreakBetweenClasses} onChange={e => updateConfig('minBreakBetweenClasses', parseInt(e.target.value))} />
                        </div>
                    </div>
                </div>

                {/* Time & Room Constraints */}
                <div className="card">
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={18} style={{ color: 'var(--accent-warning)' }} />
                        Time & Room Constraints
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div className="field" style={{ flex: 1 }}>
                                <label className="field-label">EARLIEST START TIME</label>
                                <input className="input" type="time" value={config.preferredStartTime} onChange={e => updateConfig('preferredStartTime', e.target.value)} />
                            </div>
                            <div className="field" style={{ flex: 1 }}>
                                <label className="field-label">LATEST END TIME</label>
                                <input className="input" type="time" value={config.preferredEndTime} onChange={e => updateConfig('preferredEndTime', e.target.value)} />
                            </div>
                        </div>
                        <div className="field">
                            <label className="field-label">MAX CLASSES PER ROOM PER DAY</label>
                            <input className="input" type="number" min={1} max={20} value={config.maxClassesPerRoom} onChange={e => updateConfig('maxClassesPerRoom', parseInt(e.target.value))} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', padding: '8px 0' }}>
                            <input type="checkbox" checked={config.allowSaturdayClasses} onChange={e => updateConfig('allowSaturdayClasses', e.target.checked)} />
                            Allow Saturday classes
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', padding: '8px 0' }}>
                            <input type="checkbox" checked={config.prioritizeLabForLabSubjects} onChange={e => updateConfig('prioritizeLabForLabSubjects', e.target.checked)} />
                            Auto-assign lab rooms for lab subjects
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer', padding: '8px 0' }}>
                            <input type="checkbox" checked={config.avoidBackToBackDifferentBuildings} onChange={e => updateConfig('avoidBackToBackDifferentBuildings', e.target.checked)} />
                            Avoid back-to-back classes in different buildings
                        </label>
                    </div>
                </div>
            </div>

            <style>{`
                .field { display: flex; flex-direction: column; gap: 6px; }
                .field-label { font-size: 10px; font-weight: 600; color: var(--text-muted); letter-spacing: 1.5px; padding-left: 2px; }
            `}</style>
        </div>
    );
};

export default ConstraintSettings;
