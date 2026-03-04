import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, Printer, CalendarDays, MapPin, Users, Clock } from 'lucide-react';
import '../admin/Dashboard.css';

type ViewMode = 'room' | 'teacher' | 'section' | 'day';
const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ScheduleViews: React.FC = () => {
    const [schedules, setSchedules] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<ViewMode>('room');

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        const [s, r, t, sec] = await Promise.all([
            supabase.from('schedules').select('*, subject:subjects(name, code), teacher:teachers(profile:profiles(full_name)), room:rooms(name, building), section:sections(name, program)'),
            supabase.from('rooms').select('id, name, building').order('name'),
            supabase.from('teachers').select('id, profile:profiles(full_name)'),
            supabase.from('sections').select('id, name, program').order('name'),
        ]);
        setSchedules((s.data as any[]) || []);
        setRooms(r.data || []);
        setTeachers((t.data as any[]) || []);
        setSections(sec.data || []);
        setLoading(false);
    };

    const handlePrint = () => window.print();

    const handleExportCSV = () => {
        const header = 'Day,Time,Subject,Teacher,Room,Section\n';
        const rows = schedules.map(s =>
            `${s.day_of_week},${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)},${s.subject?.code || ''} - ${s.subject?.name || ''},${s.teacher?.profile?.full_name || ''},${s.room?.name || ''},${s.section?.name || ''}`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'schedule_export.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const views: { key: ViewMode; label: string; icon: React.ElementType }[] = [
        { key: 'room', label: 'By Room', icon: MapPin },
        { key: 'teacher', label: 'By Teacher', icon: Users },
        { key: 'section', label: 'By Section', icon: CalendarDays },
        { key: 'day', label: 'By Day', icon: Clock },
    ];

    const renderGroupedTable = (groups: { label: string; items: any[] }[]) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {groups.filter(g => g.items.length > 0).map(g => (
                <div key={g.label} className="card print-section">
                    <h3 className="card-title">{g.label} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>({g.items.length} classes)</span></h3>
                    <div className="table-container">
                        <table>
                            <thead><tr><th>Day</th><th>Time</th><th>Subject</th>
                                {view !== 'teacher' && <th>Teacher</th>}
                                {view !== 'room' && <th>Room</th>}
                                {view !== 'section' && <th>Section</th>}
                            </tr></thead>
                            <tbody>
                                {g.items.sort((a: any, b: any) => {
                                    const dayDiff = dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
                                    return dayDiff !== 0 ? dayDiff : (a.start_time || '').localeCompare(b.start_time || '');
                                }).map((s: any) => (
                                    <tr key={s.id}>
                                        <td style={{ fontWeight: 600 }}>{s.day_of_week}</td>
                                        <td>{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</td>
                                        <td><strong>{s.subject?.code}</strong> {s.subject?.name}</td>
                                        {view !== 'teacher' && <td>{s.teacher?.profile?.full_name || 'TBA'}</td>}
                                        {view !== 'room' && <td>{s.room?.name || 'TBA'}</td>}
                                        {view !== 'section' && <td>{s.section?.name || '-'}</td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );

    const getGroups = (): { label: string; items: any[] }[] => {
        switch (view) {
            case 'room':
                return rooms.map(r => ({
                    label: `${r.name} (${r.building})`,
                    items: schedules.filter(s => s.room?.name === r.name),
                }));
            case 'teacher':
                return teachers.map(t => ({
                    label: (t as any).profile?.full_name || 'Unknown',
                    items: schedules.filter(s => s.teacher?.profile?.full_name === (t as any).profile?.full_name),
                }));
            case 'section':
                return sections.map(s => ({
                    label: `${s.program} - ${s.name}`,
                    items: schedules.filter(sch => sch.section?.name === s.name),
                }));
            case 'day':
                return dayOrder.map(d => ({
                    label: d,
                    items: schedules.filter(s => s.day_of_week === d),
                }));
        }
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header no-print">
                <div>
                    <h1 className="dashboard-title">Schedule Views</h1>
                    <p className="dashboard-subtitle">{schedules.length} schedule entries</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={handleExportCSV}>
                        <Download size={16} /> Export CSV
                    </button>
                    <button className="btn btn-secondary" onClick={handlePrint}>
                        <Printer size={16} /> Print
                    </button>
                </div>
            </div>

            {/* View Mode Tabs */}
            <div className="no-print" style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 4, border: '1px solid var(--border-default)' }}>
                {views.map(v => (
                    <button key={v.key}
                        className={`btn ${view === v.key ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ flex: 1, borderRadius: 'var(--radius-sm)' }}
                        onClick={() => setView(v.key)}>
                        <v.icon size={16} /> {v.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : schedules.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                    <CalendarDays size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>No schedules to display.</p>
                </div>
            ) : renderGroupedTable(getGroups())}

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .sidebar, .navbar { display: none !important; }
                    .main-content { margin: 0 !important; padding: 0 !important; }
                    .dashboard { padding: 0 !important; }
                    .card { border: 1px solid #ddd !important; break-inside: avoid; }
                    body { background: white !important; color: black !important; }
                    table { font-size: 11px; }
                    th, td { color: black !important; border-color: #ccc !important; }
                }
            `}</style>
        </div>
    );
};

export default ScheduleViews;
