import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Clock, MapPin, Search } from 'lucide-react';
import '../admin/Dashboard.css';

interface ScheduleRow {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    status: string;
    semester: string;
    academic_year: string;
    subject: { name: string; code: string } | null;
    teacher: { profile: { full_name: string } | null } | null;
    room: { name: string; building: string } | null;
    section: { name: string; program: string } | null;
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ScheduleManagement: React.FC = () => {
    const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDay, setFilterDay] = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [search, setSearch] = useState('');
    const [sections, setSections] = useState<{ id: string; name: string; program: string }[]>([]);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        const [schedRes, secRes] = await Promise.all([
            supabase.from('schedules')
                .select('id, day_of_week, start_time, end_time, status, semester, academic_year, subject:subjects(name, code), teacher:teachers(profile:profiles(full_name)), room:rooms(name, building), section:sections(name, program)')
                .order('day_of_week')
                .order('start_time'),
            supabase.from('sections').select('id, name, program').order('name'),
        ]);
        setSchedules((schedRes.data as any[]) || []);
        setSections(secRes.data || []);
        setLoading(false);
    };

    const filtered = schedules
        .filter(s => !filterDay || s.day_of_week === filterDay)
        .filter(s => !filterSection || (s.section as any)?.name === filterSection)
        .filter(s => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (s.subject as any)?.code?.toLowerCase().includes(q) ||
                (s.subject as any)?.name?.toLowerCase().includes(q) ||
                (s.teacher as any)?.profile?.full_name?.toLowerCase().includes(q) ||
                (s.room as any)?.name?.toLowerCase().includes(q);
        })
        .sort((a, b) => {
            const dayDiff = dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
            if (dayDiff !== 0) return dayDiff;
            return a.start_time.localeCompare(b.start_time);
        });

    const getStatusStyle = (status: string) => {
        if (status === 'published') return { background: 'rgba(16,185,129,0.15)', color: '#34d399' };
        if (status === 'draft') return { background: 'rgba(245,158,11,0.15)', color: '#fbbf24' };
        return { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Schedule Management</h1>
                    <p className="dashboard-subtitle">{schedules.length} total schedule entries</p>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: 360 }}>
                    <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="input" style={{ paddingLeft: 40 }} placeholder="Search subject, teacher, room..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="input" style={{ width: 'auto', minWidth: 160 }} value={filterDay} onChange={e => setFilterDay(e.target.value)}>
                    <option value="">All Days</option>
                    {dayOrder.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className="input" style={{ width: 'auto', minWidth: 180 }} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                    <option value="">All Sections</option>
                    {sections.map(s => <option key={s.id} value={s.name}>{s.program} - {s.name}</option>)}
                </select>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-number">{schedules.filter(s => s.status === 'published').length}</div>
                    <div className="stat-label">Published</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{schedules.filter(s => s.status === 'draft').length}</div>
                    <div className="stat-label">Drafts</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{new Set(schedules.map(s => (s.section as any)?.name)).size}</div>
                    <div className="stat-label">Sections</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{new Set(schedules.map(s => (s.subject as any)?.code)).size}</div>
                    <div className="stat-label">Subjects</div>
                </div>
            </div>

            {/* Schedule Table */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Day</th>
                                <th>Time</th>
                                <th>Subject</th>
                                <th>Teacher</th>
                                <th>Room</th>
                                <th>Section</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(s => (
                                <tr key={s.id}>
                                    <td style={{ fontWeight: 600 }}>{s.day_of_week}</td>
                                    <td>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                                            <Clock size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                            {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 600 }}>{(s.subject as any)?.code}</span>
                                        <br />
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(s.subject as any)?.name}</span>
                                    </td>
                                    <td>{(s.teacher as any)?.profile?.full_name || 'TBA'}</td>
                                    <td>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <MapPin size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                            {(s.room as any)?.name}
                                        </span>
                                    </td>
                                    <td><span className="badge badge-student">{(s.section as any)?.name}</span></td>
                                    <td>
                                        <span className="badge" style={getStatusStyle(s.status)}>
                                            {s.status?.toUpperCase()}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                                    {schedules.length === 0 ? 'No schedules created yet.' : 'No schedules match your filters.'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ScheduleManagement;
