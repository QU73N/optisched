import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, Search } from 'lucide-react';
import '../admin/Dashboard.css';


interface DetectedConflict {
    id: string;
    type: 'room_conflict' | 'teacher_overlap' | 'section_overlap';
    severity: 'high' | 'medium';
    title: string;
    description: string;
    day: string;
    scheduleIds: string[];
}

interface ConflictRow {
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    is_resolved: boolean;
    created_at: string;
    resolved_at: string | null;
}

const ConflictsAlerts: React.FC = () => {
    const [dbConflicts, setDbConflicts] = useState<ConflictRow[]>([]);
    const [detectedConflicts, setDetectedConflicts] = useState<DetectedConflict[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [showResolved, setShowResolved] = useState(false);

    // Fetch from conflicts table
    const fetchDbConflicts = useCallback(async () => {
        const { data } = await supabase
            .from('conflicts')
            .select('*')
            .order('is_resolved')
            .order('created_at', { ascending: false });
        setDbConflicts(data || []);
    }, []);

    // Time overlap checker
    const timesOverlap = (s1: string, e1: string, s2: string, e2: string) => {
        return s1 < e2 && s2 < e1;
    };

    // Live scan schedules for conflicts
    const scanSchedules = useCallback(async () => {
        setScanning(true);
        const { data: schedules } = await supabase
            .from('schedules')
            .select(`
                id, teacher_id, room_id, section_id, subject_id,
                day_of_week, start_time, end_time, status,
                teachers:teacher_id(full_name),
                rooms:room_id(name),
                sections:section_id(name),
                subjects:subject_id(name)
            `)
            .in('status', ['published', 'draft']);

        if (!schedules || schedules.length === 0) {
            setDetectedConflicts([]);
            setScanning(false);
            return;
        }

        const conflicts: DetectedConflict[] = [];
        const seen = new Set<string>();

        for (let i = 0; i < schedules.length; i++) {
            for (let j = i + 1; j < schedules.length; j++) {
                const a = schedules[i] as any;
                const b = schedules[j] as any;

                if (a.day_of_week !== b.day_of_week) continue;
                if (!timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) continue;

                // Room conflict
                if (a.room_id && b.room_id && a.room_id === b.room_id) {
                    const key = `room_${a.room_id}_${a.day_of_week}_${[a.id, b.id].sort().join('_')}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        const roomName = a.rooms?.name || 'Unknown Room';
                        conflicts.push({
                            id: key,
                            type: 'room_conflict',
                            severity: 'high',
                            title: `Room Conflict: ${roomName}`,
                            description: `${a.subjects?.name || 'Subject'} (${a.start_time}-${a.end_time}) and ${b.subjects?.name || 'Subject'} (${b.start_time}-${b.end_time}) are both assigned to ${roomName} on ${a.day_of_week}.`,
                            day: a.day_of_week,
                            scheduleIds: [a.id, b.id],
                        });
                    }
                }

                // Teacher overlap
                if (a.teacher_id && b.teacher_id && a.teacher_id === b.teacher_id) {
                    const key = `teacher_${a.teacher_id}_${a.day_of_week}_${[a.id, b.id].sort().join('_')}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        const teacherName = a.teachers?.full_name || 'Teacher';
                        conflicts.push({
                            id: key,
                            type: 'teacher_overlap',
                            severity: 'high',
                            title: `Teacher Overlap: ${teacherName}`,
                            description: `${teacherName} is assigned to ${a.subjects?.name || 'Subject'} (${a.start_time}-${a.end_time}) and ${b.subjects?.name || 'Subject'} (${b.start_time}-${b.end_time}) on ${a.day_of_week}.`,
                            day: a.day_of_week,
                            scheduleIds: [a.id, b.id],
                        });
                    }
                }

                // Section overlap
                if (a.section_id && b.section_id && a.section_id === b.section_id) {
                    const key = `section_${a.section_id}_${a.day_of_week}_${[a.id, b.id].sort().join('_')}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        const sectionName = a.sections?.name || 'Section';
                        conflicts.push({
                            id: key,
                            type: 'section_overlap',
                            severity: 'medium',
                            title: `Section Overlap: ${sectionName}`,
                            description: `${sectionName} has ${a.subjects?.name || 'Subject'} (${a.start_time}-${a.end_time}) and ${b.subjects?.name || 'Subject'} (${b.start_time}-${b.end_time}) scheduled at the same time on ${a.day_of_week}.`,
                            day: a.day_of_week,
                            scheduleIds: [a.id, b.id],
                        });
                    }
                }
            }
        }

        setDetectedConflicts(conflicts);
        setScanning(false);
    }, []);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([fetchDbConflicts(), scanSchedules()]);
            setLoading(false);
        };
        init();

        // Subscribe to schedule changes
        const channel = supabase
            .channel('schedule-conflicts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
                scanSchedules();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchDbConflicts, scanSchedules]);

    const handleResolveDb = async (id: string) => {
        await supabase.from('conflicts').update({
            is_resolved: true,
            resolved_at: new Date().toISOString(),
        }).eq('id', id);
        fetchDbConflicts();
    };

    const allConflicts = [
        ...detectedConflicts.map(c => ({ ...c, source: 'live' as const, is_resolved: false, created_at: new Date().toISOString() })),
        ...dbConflicts.map(c => ({ ...c, source: 'db' as const, scheduleIds: [] as string[], day: '' })),
    ];

    const unresolvedCount = allConflicts.filter(c => !c.is_resolved).length;
    const filtered = allConflicts.filter(c => showResolved || !c.is_resolved);

    const getSeverityStyle = (severity: string) => {
        if (severity === 'high') return { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' };
        if (severity === 'medium') return { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' };
        return { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' };
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'room_conflict': return 'Room Conflict';
            case 'teacher_overlap': return 'Teacher Overlap';
            case 'section_overlap': return 'Section Overlap';
            case 'capacity_exceeded': return 'Capacity Exceeded';
            default: return type.replace(/_/g, ' ');
        }
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Conflicts & Alerts</h1>
                    <p className="dashboard-subtitle">
                        {unresolvedCount > 0
                            ? `${unresolvedCount} active conflict${unresolvedCount > 1 ? 's' : ''} detected`
                            : 'No active conflicts'}
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => { scanSchedules(); fetchDbConflicts(); }}
                    disabled={scanning}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    <RefreshCw size={16} className={scanning ? 'spinning' : ''} />
                    {scanning ? 'Scanning...' : 'Scan Now'}
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-number">{allConflicts.length}</div>
                    <div className="stat-label">Total</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number" style={{ color: unresolvedCount > 0 ? '#ef4444' : undefined }}>{unresolvedCount}</div>
                    <div className="stat-label">Active</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{detectedConflicts.filter(c => c.severity === 'high').length}</div>
                    <div className="stat-label">High Severity</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{detectedConflicts.length}</div>
                    <div className="stat-label">Live Detected</div>
                </div>
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
                    Show resolved conflicts
                </label>
                {detectedConflicts.length > 0 && (
                    <span style={{ fontSize: 12, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: 20 }}>
                        <Search size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        Live scan: {detectedConflicts.length} found
                    </span>
                )}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                    <CheckCircle size={48} style={{ color: 'var(--accent-success)', margin: '0 auto 16px' }} />
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>All Clear!</h3>
                    <p style={{ color: 'var(--text-muted)' }}>
                        No scheduling conflicts detected. All schedules are conflict-free.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filtered.map(c => {
                        const severity = getSeverityStyle(c.severity);
                        return (
                            <div key={c.id}
                                className="card"
                                style={{
                                    borderLeftWidth: 4,
                                    borderLeftStyle: 'solid',
                                    borderLeftColor: severity.color,
                                    opacity: c.is_resolved ? 0.6 : 1,
                                    padding: '16px 20px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                            <AlertTriangle size={16} style={{ color: severity.color, flexShrink: 0 }} />
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</span>
                                            <span className="badge" style={{ background: severity.bg, color: severity.color }}>{c.severity?.toUpperCase()}</span>
                                            <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{getTypeLabel(c.type)}</span>
                                            {c.source === 'live' && (
                                                <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>LIVE</span>
                                            )}
                                        </div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>{c.description}</p>
                                        {c.day && (
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {c.day}
                                            </span>
                                        )}
                                        {c.source === 'db' && (
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 12 }}>
                                                <Clock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                                {new Date(c.created_at).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    {!c.is_resolved && c.source === 'db' && (
                                        <button className="btn btn-secondary" style={{ flexShrink: 0 }} onClick={() => handleResolveDb(c.id)}>
                                            <CheckCircle size={14} />
                                            Resolve
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                .spinning { animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default ConflictsAlerts;
