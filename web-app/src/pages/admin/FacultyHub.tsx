import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTeachers, useSchedules } from '../../hooks/useSupabase';
import { Users, BookOpen, Clock, Search, BarChart3, Calendar, ChevronRight, Briefcase, GraduationCap } from 'lucide-react';

const FacultyHub: React.FC = () => {
    useAuth();
    const { teachers, loading: loadingTeachers } = useTeachers();
    const { schedules } = useSchedules({ status: 'published' });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);

    const teacherWorkloads = React.useMemo(() => {
        const map = new Map<string, { classes: number; hours: number; days: Set<string>; subjects: Set<string>; sections: Set<string> }>();
        schedules.forEach((s: any) => {
            const tid = s.teacher_id;
            if (!tid) return;
            if (!map.has(tid)) map.set(tid, { classes: 0, hours: 0, days: new Set(), subjects: new Set(), sections: new Set() });
            const w = map.get(tid)!;
            w.classes++;
            if (s.day_of_week) w.days.add(s.day_of_week);
            if (s.subject?.name) w.subjects.add(s.subject.name);
            if (s.section?.name) w.sections.add(s.section.name);
            if (s.start_time && s.end_time) {
                const [sh, sm] = s.start_time.split(':').map(Number);
                const [eh, em] = s.end_time.split(':').map(Number);
                w.hours += (eh * 60 + em - sh * 60 - sm) / 60;
            }
        });
        return map;
    }, [schedules]);

    const filteredTeachers = teachers.filter((t: any) => {
        const name = t.profile?.full_name || t.full_name || '';
        const dept = t.department || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase()) || dept.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const totalClasses = schedules.length;
    const avgLoad = teachers.length > 0 ? (totalClasses / teachers.length).toFixed(1) : '0';
    const totalHours = Array.from(teacherWorkloads.values()).reduce((sum, w) => sum + w.hours, 0);

    return (
        <div className="fhub">
            {/* Header */}
            <div className="fhub-header">
                <div>
                    <h1>Faculty Hub</h1>
                    <p>Manage and monitor faculty workloads and assignments</p>
                </div>
            </div>

            {/* Stats */}
            <div className="fhub-stats">
                <div className="fhub-stat-card">
                    <div className="fhub-stat-icon" style={{ background: 'rgba(99,102,241,0.12)' }}><Users size={22} color="#818cf8" /></div>
                    <div className="fhub-stat-info">
                        <span className="fhub-stat-num">{teachers.length}</span>
                        <span className="fhub-stat-label">Total Faculty</span>
                    </div>
                </div>
                <div className="fhub-stat-card">
                    <div className="fhub-stat-icon" style={{ background: 'rgba(16,185,129,0.12)' }}><BookOpen size={22} color="#10b981" /></div>
                    <div className="fhub-stat-info">
                        <span className="fhub-stat-num">{totalClasses}</span>
                        <span className="fhub-stat-label">Total Classes</span>
                    </div>
                </div>
                <div className="fhub-stat-card">
                    <div className="fhub-stat-icon" style={{ background: 'rgba(139,92,246,0.12)' }}><BarChart3 size={22} color="#a78bfa" /></div>
                    <div className="fhub-stat-info">
                        <span className="fhub-stat-num">{avgLoad}</span>
                        <span className="fhub-stat-label">Avg Classes/Teacher</span>
                    </div>
                </div>
                <div className="fhub-stat-card">
                    <div className="fhub-stat-icon" style={{ background: 'rgba(59,130,246,0.12)' }}><Clock size={22} color="#60a5fa" /></div>
                    <div className="fhub-stat-info">
                        <span className="fhub-stat-num">{totalHours.toFixed(0)}</span>
                        <span className="fhub-stat-label">Total Hours/Week</span>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="fhub-search">
                <Search size={18} color="var(--text-muted)" />
                <input type="text" placeholder="Search by name or department..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {searchQuery && (
                    <span className="fhub-result-count">{filteredTeachers.length} result{filteredTeachers.length !== 1 ? 's' : ''}</span>
                )}
            </div>

            {/* Faculty Grid */}
            <div className="fhub-grid">
                {loadingTeachers ? (
                    <div className="fhub-empty"><div className="spinner" /></div>
                ) : filteredTeachers.length === 0 ? (
                    <div className="fhub-empty"><Users size={48} style={{ opacity: 0.2 }} /><p>No faculty members found</p></div>
                ) : filteredTeachers.map((teacher: any) => {
                    const name = teacher.profile?.full_name || teacher.full_name || 'Unknown';
                    const workload = teacherWorkloads.get(teacher.id);
                    const classes = workload?.classes || 0;
                    const hours = workload?.hours?.toFixed(1) || '0';
                    const days = workload?.days?.size || 0;
                    const subjects = workload?.subjects ? Array.from(workload.subjects) : [];
                    const sectionsList = workload?.sections ? Array.from(workload.sections) : [];
                    const empType = teacher.employment_type;
                    const maxHours = teacher.max_hours || 30;
                    const loadPct = Math.min(100, ((workload?.hours || 0) / maxHours) * 100);

                    let loadColor = '#10b981';
                    let loadLabel = 'Light';
                    if (loadPct > 80) { loadColor = '#ef4444'; loadLabel = 'Heavy'; }
                    else if (loadPct > 50) { loadColor = '#f59e0b'; loadLabel = 'Moderate'; }

                    const isExpanded = selectedTeacher === teacher.id;

                    return (
                        <div key={teacher.id} className={`fhub-card ${isExpanded ? 'expanded' : ''}`} onClick={() => setSelectedTeacher(isExpanded ? null : teacher.id)}>
                            <div className="fhub-card-top">
                                <div className="fhub-avatar" style={{ background: `${loadColor}15`, color: loadColor }}>
                                    {name.charAt(0).toUpperCase()}
                                </div>
                                <div className="fhub-name">
                                    <h4>{name}</h4>
                                    <span className="fhub-dept">{teacher.department || 'Faculty'}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {empType && (
                                        <span className="fhub-emp-badge" style={{
                                            background: empType === 'full-time' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                            color: empType === 'full-time' ? '#10b981' : '#f59e0b'
                                        }}>
                                            <Briefcase size={10} /> {empType === 'full-time' ? 'FT' : 'PT'}
                                        </span>
                                    )}
                                    <span className="fhub-load-badge" style={{ background: `${loadColor}15`, color: loadColor }}>{loadLabel}</span>
                                    <ChevronRight size={16} color="var(--text-muted)" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="fhub-card-stats">
                                <div className="fhub-mini-stat"><BookOpen size={13} /><span>{classes}</span><small>Classes</small></div>
                                <div className="fhub-mini-stat"><Clock size={13} /><span>{hours}</span><small>Hrs/wk</small></div>
                                <div className="fhub-mini-stat"><Calendar size={13} /><span>{days}</span><small>Days/wk</small></div>
                                <div className="fhub-mini-stat"><GraduationCap size={13} /><span>{subjects.length}</span><small>Subjects</small></div>
                            </div>

                            {/* Load Bar */}
                            <div className="fhub-load-bar">
                                <div className="fhub-load-fill" style={{ width: `${loadPct}%`, background: `linear-gradient(90deg, ${loadColor}, ${loadColor}90)` }} />
                            </div>
                            <div className="fhub-load-meta">
                                <span>{hours} / {maxHours} hrs</span>
                                <span style={{ color: loadColor, fontWeight: 600 }}>{loadPct.toFixed(0)}%</span>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="fhub-expanded" onClick={e => e.stopPropagation()}>
                                    {subjects.length > 0 && (
                                        <div className="fhub-detail-group">
                                            <label>Subjects</label>
                                            <div className="fhub-chips">
                                                {subjects.map((s: string) => <span key={s} className="fhub-chip">{s}</span>)}
                                            </div>
                                        </div>
                                    )}
                                    {sectionsList.length > 0 && (
                                        <div className="fhub-detail-group">
                                            <label>Sections</label>
                                            <div className="fhub-chips">
                                                {sectionsList.map((s: string) => <span key={s} className="fhub-chip sec">{s}</span>)}
                                            </div>
                                        </div>
                                    )}
                                    {workload?.days && workload.days.size > 0 && (
                                        <div className="fhub-detail-group">
                                            <label>Active Days</label>
                                            <div className="fhub-day-pills">
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => {
                                                    const full = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(d)];
                                                    const active = workload.days.has(full);
                                                    return <span key={d} className={`fhub-day-pill ${active ? 'active' : ''}`}>{d}</span>;
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <style>{`
                .fhub { display: flex; flex-direction: column; gap: 1.5rem; }
                .fhub-header h1 { font-size: 1.5rem; font-weight: 700; }
                .fhub-header p { color: var(--text-secondary); font-size: 0.9rem; margin-top: 4px; }

                .fhub-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
                .fhub-stat-card { display: flex; align-items: center; gap: 1rem; padding: 1.25rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 14px; transition: all 0.2s; }
                .fhub-stat-card:hover { border-color: var(--border-subtle); transform: translateY(-1px); }
                .fhub-stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .fhub-stat-info { display: flex; flex-direction: column; }
                .fhub-stat-num { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); line-height: 1.2; }
                .fhub-stat-label { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }

                .fhub-search { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 12px; }
                .fhub-search input { flex: 1; background: none; border: none; color: var(--text-primary); font-size: 0.9rem; outline: none; }
                .fhub-result-count { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; }

                .fhub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 0.75rem; }
                .fhub-card { background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 14px; padding: 1.25rem; cursor: pointer; transition: all 0.25s ease; }
                .fhub-card:hover { border-color: rgba(99,102,241,0.3); box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                .fhub-card.expanded { border-color: rgba(99,102,241,0.4); box-shadow: 0 8px 30px rgba(0,0,0,0.15); }

                .fhub-card-top { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
                .fhub-avatar { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.2rem; flex-shrink: 0; }
                .fhub-name { flex: 1; }
                .fhub-name h4 { font-size: 0.95rem; font-weight: 600; color: var(--text-primary); }
                .fhub-dept { font-size: 0.75rem; color: var(--text-muted); }

                .fhub-emp-badge { font-size: 0.65rem; font-weight: 600; padding: 3px 8px; border-radius: 6px; display: flex; align-items: center; gap: 3px; }
                .fhub-load-badge { font-size: 0.65rem; font-weight: 700; padding: 3px 10px; border-radius: 6px; letter-spacing: 0.3px; }

                .fhub-card-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.75rem; }
                .fhub-mini-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; background: rgba(255,255,255,0.02); border-radius: 8px; color: var(--text-secondary); }
                .fhub-mini-stat span { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); }
                .fhub-mini-stat small { font-size: 0.65rem; color: var(--text-muted); }

                .fhub-load-bar { height: 4px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
                .fhub-load-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
                .fhub-load-meta { display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; }

                .fhub-expanded { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-default); display: flex; flex-direction: column; gap: 0.75rem; animation: fadeInDown 0.2s ease; }
                .fhub-detail-group label { font-size: 0.65rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; display: block; }
                .fhub-chips { display: flex; flex-wrap: wrap; gap: 4px; }
                .fhub-chip { padding: 4px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 500; background: rgba(139,92,246,0.1); color: #c4b5fd; }
                .fhub-chip.sec { background: rgba(59,130,246,0.1); color: #93c5fd; }

                .fhub-day-pills { display: flex; gap: 4px; }
                .fhub-day-pill { padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 500; background: rgba(255,255,255,0.04); color: var(--text-muted); border: 1px solid var(--border-default); }
                .fhub-day-pill.active { background: rgba(16,185,129,0.12); color: #10b981; border-color: rgba(16,185,129,0.3); font-weight: 600; }

                .fhub-empty { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; color: var(--text-muted); gap: 0.75rem; }

                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 1024px) {
                    .fhub-stats { grid-template-columns: repeat(2, 1fr); }
                    .fhub-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default FacultyHub;
