// TeacherSections - sections this teacher teaches and roster size.
// Roster visibility gated by `teachers_can_view_section_rosters` rule.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Users, BookOpen, Loader2, Lock, GraduationCap } from 'lucide-react';
import '../admin/Dashboard.css';

interface Row {
    section_id: string;
    section_name: string;
    program: string;
    year_level: number;
    student_count: number;
    subject_codes: string[];
}

const TeacherSections: React.FC = () => {
    const { profile } = useAuth();
    const perms = usePermissions();
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<Row[]>([]);
    const [rosters, setRosters] = useState<Record<string, { full_name: string; email: string }[]>>({});

    useEffect(() => {
        if (!profile?.id) return;
        (async () => {
            try {
                const { data: t } = await supabase.from('teachers').select('id').eq('profile_id', profile.id).maybeSingle();
                if (!t) { setLoading(false); return; }
                const { data: scheds } = await supabase
                    .from('schedules')
                    .select('section_id, section:sections(id, name, program, year_level, student_count), subject:subjects(code)')
                    .eq('teacher_id', t.id)
                    .eq('status', 'published');

                const map = new Map<string, Row>();
                ((scheds || []) as unknown as Array<{
                    section_id: string;
                    section: { id: string; name: string; program: string; year_level: number; student_count: number } | { id: string; name: string; program: string; year_level: number; student_count: number }[] | null;
                    subject: { code: string } | { code: string }[] | null;
                }>).forEach(s => {
                    const sec = Array.isArray(s.section) ? s.section[0] : s.section;
                    const sub = Array.isArray(s.subject) ? s.subject[0] : s.subject;
                    if (!sec) return;
                    const cur = map.get(sec.id) || {
                        section_id: sec.id,
                        section_name: sec.name,
                        program: sec.program,
                        year_level: sec.year_level,
                        student_count: sec.student_count,
                        subject_codes: [],
                    };
                    if (sub?.code && !cur.subject_codes.includes(sub.code)) cur.subject_codes.push(sub.code);
                    map.set(sec.id, cur);
                });
                setRows(Array.from(map.values()).sort((a, b) => a.section_name.localeCompare(b.section_name)));

                if (perms.ruleEnabled('teachers_can_view_section_rosters')) {
                    const ids = Array.from(map.keys());
                    if (ids.length) {
                        const { data: students } = await supabase
                            .from('profiles')
                            .select('full_name, email, section')
                            .eq('role', 'student');
                        const r: Record<string, { full_name: string; email: string }[]> = {};
                        const sectionNames = new Map<string, string>();
                        Array.from(map.values()).forEach(v => sectionNames.set(v.section_name.toLowerCase(), v.section_id));
                        (students || []).forEach((p: { full_name: string; email: string; section: string | null }) => {
                            if (!p.section) return;
                            const id = sectionNames.get(p.section.toLowerCase());
                            if (!id) return;
                            if (!r[id]) r[id] = [];
                            r[id].push({ full_name: p.full_name, email: p.email });
                        });
                        setRosters(r);
                    }
                }
            } catch (err) {
                console.error('[TeacherSections] load failed', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [profile?.id, perms]);

    const totalStudents = useMemo(() => rows.reduce((s, r) => s + (r.student_count || 0), 0), [rows]);

    if (!perms.isTeacher) {
        return <div className="dashboard"><div className="dash-empty"><Lock size={28} /><div>For teachers only.</div></div></div>;
    }

    if (loading) {
        return <div className="dashboard"><div className="dash-loading-center"><Loader2 className="spin" size={28} /></div></div>;
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><Users size={20} /> My Sections</h1>
                <p className="dashboard-subtitle">
                    Sections you teach and the subjects you cover with each.
                </p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon"><GraduationCap size={20} /></div>
                    <div className="stat-number">{rows.length}</div>
                    <div className="stat-label">Sections</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Users size={20} /></div>
                    <div className="stat-number">{totalStudents}</div>
                    <div className="stat-label">Total students</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><BookOpen size={20} /></div>
                    <div className="stat-number">{Array.from(new Set(rows.flatMap(r => r.subject_codes))).length}</div>
                    <div className="stat-label">Distinct subjects</div>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="dash-empty"><Users size={28} /><div>No sections assigned yet.</div></div>
            ) : (
                <div className="dash-list" style={{ gap: 10 }}>
                    {rows.map(r => (
                        <div key={r.section_id} className="dash-card dash-stagger" style={{ padding: 14 }}>
                            <div className="dash-card-header" style={{ marginBottom: 8 }}>
                                <div className="dash-card-title">
                                    <Users size={16} /> {r.section_name}
                                </div>
                                <span className="dash-card-badge dash-badge-info">{r.student_count} students</span>
                            </div>
                            <div className="dash-meta-text" style={{ marginBottom: 8 }}>
                                {r.program} · Year {r.year_level}
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {r.subject_codes.map(c => (
                                    <code key={c} style={{ background: 'var(--bg-inset)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{c}</code>
                                ))}
                            </div>
                            {perms.ruleEnabled('teachers_can_view_section_rosters') && rosters[r.section_id] && (
                                <details style={{ marginTop: 10 }}>
                                    <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>View roster ({rosters[r.section_id].length})</summary>
                                    <ul style={{ margin: '8px 0 0 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                                        {rosters[r.section_id].map(s => (
                                            <li key={s.email}>{s.full_name}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TeacherSections;
