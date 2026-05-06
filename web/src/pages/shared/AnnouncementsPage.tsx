// AnnouncementsPage - shared read-only announcements view (Teacher + Student).
// Filters by section if profile.section is set; "All Sections" announcements
// always show. Priority dot reflects severity.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Megaphone, Loader2, Info, Bell } from 'lucide-react';
import '../admin/Dashboard.css';

interface AnnRow {
    id: string;
    title: string;
    content: string;
    author_name: string;
    priority: 'normal' | 'important';
    created_at: string;
    expires_at: string | null;
    target_section: string | null;
}

const AnnouncementsPage: React.FC = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<AnnRow[]>([]);
    const [filter, setFilter] = useState<'all' | 'important' | 'normal'>('all');

    useEffect(() => {
        (async () => {
            try {
                const { data } = await supabase
                    .from('announcements')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100);
                setItems((data || []) as AnnRow[]);
            } catch (err) {
                console.error('[Announcements] load failed', err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const filtered = useMemo(() => {
        const sec = (profile?.section || '').toLowerCase().trim();
        return items.filter(a => {
            // priority filter
            if (filter !== 'all' && a.priority !== filter) return false;
            // section filter (visible if no target, "All Sections", or matching)
            if (a.target_section) {
                const t = a.target_section.toLowerCase().trim();
                if (t !== 'all sections' && t !== sec) return false;
            }
            // expiry
            if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) return false;
            return true;
        });
    }, [items, filter, profile?.section]);

    const priorityIcon = (p: string) => {
        if (p === 'important') return <Bell size={14} color="#f59e0b" />;
        return <Info size={14} color="var(--text-muted)" />;
    };
    const priorityClass = (p: string) =>
        p === 'important' ? 'dash-accent-info' : 'dash-accent-success';

    if (loading) {
        return <div className="dashboard"><div className="dash-loading-center"><Loader2 className="spin" size={28} /></div></div>;
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><Megaphone size={20} /> Announcements</h1>
                <p className="dashboard-subtitle">
                    Updates from your administrators. Filtered to your section + general announcements.
                </p>
            </div>

            <div className="scrollable-container">

            <div className="audit-toolbar">
                <div className="audit-time-range" style={{ marginLeft: 'auto' }}>
                    {(['all', 'important', 'normal'] as const).map(p => (
                        <button
                            key={p}
                            className={`audit-time-pill ${filter === p ? 'audit-time-pill-active' : ''}`}
                            onClick={() => setFilter(p)}
                        >{p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}</button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="dash-empty"><Megaphone size={28} /><div>No announcements match.</div></div>
            ) : (
                <div className="dash-list" style={{ gap: 8 }}>
                    {filtered.map(a => (
                        <div key={a.id} className="dash-list-item" style={{ padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)' }}>
                            <div className={`dash-list-item-accent ${priorityClass(a.priority)}`} />
                            <div className="dash-list-item-body">
                                <div className="dash-list-item-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {priorityIcon(a.priority)} {a.title}
                                </div>
                                <div className="dash-list-item-meta">
                                    {a.author_name} · {new Date(a.created_at).toLocaleString()}
                                    {a.target_section && a.target_section !== 'All Sections' && <> · {a.target_section}</>}
                                </div>
                                <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                    {a.content}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </div>
        </div>
    );
};

export default AnnouncementsPage;
