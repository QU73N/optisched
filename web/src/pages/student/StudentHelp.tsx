// StudentHelp - guided contact form. Creates a tagged admin_message for triage.

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logActivity } from '../../hooks/useActivityLogger';
import { HelpCircle, Send, Loader2, CheckCircle, BookOpen, Calendar, AlertTriangle, MessageSquare } from 'lucide-react';
import '../admin/Dashboard.css';

const TOPICS = [
    { value: 'schedule_question', label: 'Schedule question', icon: Calendar },
    { value: 'room_or_teacher', label: 'Room or teacher info', icon: BookOpen },
    { value: 'access_problem', label: 'Cannot access something', icon: AlertTriangle },
    { value: 'other', label: 'Something else', icon: MessageSquare },
];

const FAQS = [
    { q: 'Where can I see my schedule?', a: 'Open "My Schedule" in the sidebar or use the dashboard.' },
    { q: 'When is my next break?', a: 'The "Upcoming" tab shows your next class and next break for today.' },
    { q: 'Why is my section schedule empty?', a: 'It only fills once a Schedule Admin publishes the schedule for your term.' },
    { q: 'How do I change my password?', a: 'Open Settings from the sidebar, then "Change password".' },
];

const StudentHelp: React.FC = () => {
    const { profile } = useAuth();
    const [topic, setTopic] = useState<string>('schedule_question');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    const submit = async () => {
        if (!message.trim() || !profile?.id) return;
        setSubmitting(true);
        try {
            const tag = `[${topic}]`;
            const { error } = await supabase.from('admin_messages').insert({
                sender_id: profile.id,
                sender_name: profile.full_name,
                message: `${tag} ${message.trim()}`,
                direction: 'teacher_to_admin', // re-used channel; admins see it in their inbox
            });
            if (error) throw error;
            await logActivity({ actionType: 'mutation', resource: 'admin_messages:INSERT', details: { topic } });
            setDone(true);
            setMessage('');
        } catch (err) {
            console.error('[StudentHelp] submit failed', err);
            alert('Could not send. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><HelpCircle size={20} /> Help</h1>
                <p className="dashboard-subtitle">
                    Find a quick answer below, or send a message to your administrator.
                </p>
            </div>

            <div className="admin-dash-grid">
                <div className="admin-dash-left">
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><MessageSquare size={16} /> Contact admin</div>
                        </div>

                        {done ? (
                            <div className="dash-list-item" style={{ padding: 14, background: 'var(--accent-success-subtle)', borderRadius: 6 }}>
                                <CheckCircle size={20} color="var(--accent-success)" />
                                <div className="dash-list-item-body">
                                    <div className="dash-list-item-title">Message sent</div>
                                    <div className="dash-list-item-meta">An administrator will respond as soon as possible.</div>
                                </div>
                                <button className="btn btn-secondary" onClick={() => setDone(false)}>Send another</button>
                            </div>
                        ) : (
                            <div className="dash-flex-col dash-gap-10">
                                <label>Topic</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                                    {TOPICS.map(t => (
                                        <button
                                            key={t.value}
                                            className={`btn ${topic === t.value ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{ justifyContent: 'flex-start', gap: 6 }}
                                            onClick={() => setTopic(t.value)}
                                        >
                                            <t.icon size={14} /> {t.label}
                                        </button>
                                    ))}
                                </div>
                                <label>Your message</label>
                                <textarea
                                    className="input"
                                    rows={5}
                                    placeholder="Describe what you need help with…"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                                <button className="btn btn-primary" disabled={submitting || !message.trim()} onClick={submit}>
                                    {submitting ? <Loader2 className="spin" size={14} /> : <Send size={14} />} Send
                                </button>
                                <p className="dash-meta-text">
                                    Your message is sent to the administrator group, not posted publicly.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="admin-dash-right">
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><HelpCircle size={16} /> Quick answers</div>
                        </div>
                        <div className="dash-list" style={{ gap: 8 }}>
                            {FAQS.map((f, i) => (
                                <details key={i} style={{ padding: '8px 12px', background: 'var(--bg-inset)', borderRadius: 'var(--radius-sm)' }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{f.q}</summary>
                                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>{f.a}</div>
                                </details>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentHelp;
