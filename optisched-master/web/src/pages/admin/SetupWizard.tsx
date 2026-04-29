import React, { useState, useEffect } from 'react';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { CheckCircle, ArrowRight, ArrowLeft, Users, BookOpen, MapPin, Layers, Zap } from 'lucide-react';
import '../admin/Dashboard.css';

const STEPS = ['Welcome', 'Sections', 'Subjects', 'Rooms', 'Teachers', 'Complete'];

const SetupWizard: React.FC = () => {
    const [step, setStep] = useState(0);
    const [counts, setCounts] = useState({ sections: 0, subjects: 0, rooms: 0, teachers: 0 });
    const [loading, setLoading] = useState(true);

    // Quick-add states
    const [secName, setSecName] = useState('');
    const [secProgram, setSecProgram] = useState('');
    const [secYear, setSecYear] = useState('1');
    const [secCount, setSecCount] = useState('30');

    const [subCode, setSubCode] = useState('');
    const [subName, setSubName] = useState('');
    const [subUnits, setSubUnits] = useState('3');

    const [roomName, setRoomName] = useState('');
    const [roomCap, setRoomCap] = useState('40');
    const [roomType, setRoomType] = useState('lecture');

    const [tName, setTName] = useState('');
    const [tEmail, setTEmail] = useState('');

    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => { fetchCounts(); }, []);

    const fetchCounts = async () => {
        setLoading(true);
        const [sec, sub, rm, tch] = await Promise.all([
            supabase.from('sections').select('id', { count: 'exact', head: true }),
            supabase.from('subjects').select('id', { count: 'exact', head: true }),
            supabase.from('rooms').select('id', { count: 'exact', head: true }),
            supabase.from('teachers').select('id', { count: 'exact', head: true }),
        ]);
        setCounts({
            sections: sec.count || 0,
            subjects: sub.count || 0,
            rooms: rm.count || 0,
            teachers: tch.count || 0,
        });
        setLoading(false);
    };

    const addSection = async () => {
        if (!secName.trim()) return;
        setSaving(true); setMsg('');
        try {
            const { error } = await supabase.from('sections').insert({
                name: secName.trim(), program: secProgram.trim(),
                year_level: parseInt(secYear) || 1, student_count: parseInt(secCount) || 30,
            });
            if (error) throw error;
            setMsg(`Added section "${secName.trim()}"`);
            setSecName(''); setSecProgram('');
            fetchCounts();
        } catch (e: any) { setMsg('Error: ' + e.message); }
        finally { setSaving(false); }
    };

    const addSubject = async () => {
        if (!subCode.trim() || !subName.trim()) return;
        setSaving(true); setMsg('');
        try {
            const { error } = await supabase.from('subjects').insert({
                code: subCode.trim(), name: subName.trim(),
                units: parseInt(subUnits) || 3, type: 'lecture',
                duration_hours: parseInt(subUnits) || 3,
                program: secProgram || '', year_level: 1,
            });
            if (error) throw error;
            setMsg(`Added subject "${subCode.trim()}"`);
            setSubCode(''); setSubName('');
            fetchCounts();
        } catch (e: any) { setMsg('Error: ' + e.message); }
        finally { setSaving(false); }
    };

    const addRoom = async () => {
        if (!roomName.trim()) return;
        setSaving(true); setMsg('');
        try {
            const { error } = await supabase.from('rooms').insert({
                name: roomName.trim(), capacity: parseInt(roomCap) || 40,
                type: roomType, building: '', floor: 1, is_available: true,
            });
            if (error) throw error;
            setMsg(`Added room "${roomName.trim()}"`);
            setRoomName('');
            fetchCounts();
        } catch (e: any) { setMsg('Error: ' + e.message); }
        finally { setSaving(false); }
    };

    const addTeacher = async () => {
        if (!tName.trim() || !tEmail.trim()) return;
        if (!/^[a-zA-Z\s.-]+$/.test(tName.trim())) { setMsg('Names cannot contain numbers'); return; }
        if (tEmail.trim().length < 5 || !tEmail.includes('@')) { setMsg('Enter a valid email'); return; }
        setSaving(true); setMsg('');
        try {
            if (!supabaseAdmin) { setMsg('Error: Service key not configured. Add teachers via User Management instead.'); setSaving(false); return; }
            const password = 'Teacher' + Math.floor(1000 + Math.random() * 9000);
            const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
                email: tEmail.trim(), password, email_confirm: true,
                user_metadata: { full_name: tName.trim(), role: 'teacher' },
            });
            if (authErr) throw authErr;
            if (authData.user) {
                await supabase.from('profiles').upsert({ id: authData.user.id, email: tEmail.trim(), full_name: tName.trim(), role: 'teacher' });
                await supabase.from('teachers').insert({ id: authData.user.id, max_hours: 40 });
            }
            setMsg(`Added teacher "${tName.trim()}" (pw: ${password})`);
            setTName(''); setTEmail('');
            fetchCounts();
        } catch (e: any) { setMsg('Error: ' + e.message); }
        finally { setSaving(false); }
    };

    const stepIcons = [Zap, Layers, BookOpen, MapPin, Users, CheckCircle];

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Setup Wizard</h1>
                    <p className="dashboard-subtitle">Step {step + 1} of {STEPS.length}</p>
                </div>
            </div>

            {/* Progress */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
                {STEPS.map((s, i) => {
                    const Icon = stepIcons[i];
                    const isActive = i === step;
                    const isDone = i < step;
                    return (
                        <div key={i} style={{ flex: 1, cursor: 'pointer' }} onClick={() => setStep(i)}>
                            <div style={{
                                height: 4, borderRadius: 2, marginBottom: 8,
                                background: isDone ? '#34d399' : isActive ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                transition: 'background 300ms ease',
                            }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Icon size={14} style={{ color: isDone ? '#34d399' : isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                                <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : (
                <>
                    {/* Step Content */}
                    <div className="card" style={{ minHeight: 300 }}>
                        {step === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <Zap size={48} style={{ color: 'var(--accent-primary)', margin: '0 auto 16px' }} />
                                <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Welcome to OptiSched Setup</h2>
                                <p style={{ color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
                                    This wizard will guide you through adding the essential data needed for schedule generation:
                                    sections, subjects, rooms, and teachers.
                                </p>
                                <div className="stats-grid" style={{ marginTop: 24, maxWidth: 500, margin: '24px auto 0' }}>
                                    <div className="stat-card"><div className="stat-number">{counts.sections}</div><div className="stat-label">Sections</div></div>
                                    <div className="stat-card"><div className="stat-number">{counts.subjects}</div><div className="stat-label">Subjects</div></div>
                                    <div className="stat-card"><div className="stat-number">{counts.rooms}</div><div className="stat-label">Rooms</div></div>
                                    <div className="stat-card"><div className="stat-number">{counts.teachers}</div><div className="stat-label">Teachers</div></div>
                                </div>
                            </div>
                        )}

                        {step === 1 && (
                            <div>
                                <h3 className="card-title"><Layers size={18} style={{ color: 'var(--accent-primary)' }} /> Add Sections ({counts.sections} existing)</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div><label className="input-label">Section Name</label><input className="input" value={secName} onChange={e => setSecName(e.target.value)} placeholder="e.g. BSIT 3A" /></div>
                                    <div><label className="input-label">Program</label><input className="input" value={secProgram} onChange={e => setSecProgram(e.target.value)} placeholder="e.g. BSIT" /></div>
                                    <div><label className="input-label">Year Level</label><input className="input" type="number" value={secYear} onChange={e => setSecYear(e.target.value)} /></div>
                                    <div><label className="input-label">Student Count</label><input className="input" type="number" value={secCount} onChange={e => setSecCount(e.target.value)} /></div>
                                </div>
                                <button className="btn btn-primary" onClick={addSection} disabled={saving || !secName.trim()} style={{ marginTop: 16 }}>Add Section</button>
                            </div>
                        )}

                        {step === 2 && (
                            <div>
                                <h3 className="card-title"><BookOpen size={18} style={{ color: 'var(--accent-primary)' }} /> Add Subjects ({counts.subjects} existing)</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12 }}>
                                    <div><label className="input-label">Code</label><input className="input" value={subCode} onChange={e => setSubCode(e.target.value)} placeholder="e.g. CS101" /></div>
                                    <div><label className="input-label">Name</label><input className="input" value={subName} onChange={e => setSubName(e.target.value)} placeholder="e.g. Intro to Computing" /></div>
                                    <div><label className="input-label">Units</label><input className="input" type="number" value={subUnits} onChange={e => setSubUnits(e.target.value)} /></div>
                                </div>
                                <button className="btn btn-primary" onClick={addSubject} disabled={saving || !subCode.trim() || !subName.trim()} style={{ marginTop: 16 }}>Add Subject</button>
                            </div>
                        )}

                        {step === 3 && (
                            <div>
                                <h3 className="card-title"><MapPin size={18} style={{ color: 'var(--accent-primary)' }} /> Add Rooms ({counts.rooms} existing)</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 12 }}>
                                    <div><label className="input-label">Room Name</label><input className="input" value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="e.g. Lab 204" /></div>
                                    <div><label className="input-label">Capacity</label><input className="input" type="number" value={roomCap} onChange={e => setRoomCap(e.target.value)} /></div>
                                    <div><label className="input-label">Type</label>
                                        <select className="input" value={roomType} onChange={e => setRoomType(e.target.value)}>
                                            <option value="lecture">Lecture</option>
                                            <option value="laboratory">Laboratory</option>
                                            <option value="computer_lab">Computer Lab</option>
                                        </select>
                                    </div>
                                </div>
                                <button className="btn btn-primary" onClick={addRoom} disabled={saving || !roomName.trim()} style={{ marginTop: 16 }}>Add Room</button>
                            </div>
                        )}

                        {step === 4 && (
                            <div>
                                <h3 className="card-title"><Users size={18} style={{ color: 'var(--accent-primary)' }} /> Add Teachers ({counts.teachers} existing)</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div><label className="input-label">Full Name</label><input className="input" value={tName} onChange={e => setTName(e.target.value)} placeholder="e.g. John Doe" /></div>
                                    <div><label className="input-label">Email</label><input className="input" value={tEmail} onChange={e => setTEmail(e.target.value)} placeholder="e.g. john@school.edu" /></div>
                                </div>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>A random password will be generated. Names must not contain numbers.</p>
                                <button className="btn btn-primary" onClick={addTeacher} disabled={saving || !tName.trim() || !tEmail.trim()} style={{ marginTop: 12 }}>Add Teacher</button>
                            </div>
                        )}

                        {step === 5 && (
                            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                                <CheckCircle size={56} style={{ color: '#34d399', margin: '0 auto 16px' }} />
                                <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Setup Complete!</h2>
                                <p style={{ color: 'var(--text-muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
                                    Your data is ready. Go to the Schedule Generator to auto-create your schedule, or use the Editor to build it manually.
                                </p>
                                <div className="stats-grid" style={{ marginTop: 24, maxWidth: 500, margin: '24px auto 0' }}>
                                    <div className="stat-card"><div className="stat-number" style={{ color: counts.sections > 0 ? '#34d399' : '#ef4444' }}>{counts.sections}</div><div className="stat-label">Sections</div></div>
                                    <div className="stat-card"><div className="stat-number" style={{ color: counts.subjects > 0 ? '#34d399' : '#ef4444' }}>{counts.subjects}</div><div className="stat-label">Subjects</div></div>
                                    <div className="stat-card"><div className="stat-number" style={{ color: counts.rooms > 0 ? '#34d399' : '#ef4444' }}>{counts.rooms}</div><div className="stat-label">Rooms</div></div>
                                    <div className="stat-card"><div className="stat-number" style={{ color: counts.teachers > 0 ? '#34d399' : '#ef4444' }}>{counts.teachers}</div><div className="stat-label">Teachers</div></div>
                                </div>
                            </div>
                        )}

                        {/* Feedback */}
                        {msg && (
                            <div style={{ marginTop: 14, padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, background: msg.startsWith('Error') ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', color: msg.startsWith('Error') ? '#ef4444' : '#34d399' }}>
                                {msg}
                            </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                        <button className="btn btn-ghost" onClick={() => { setStep(step - 1); setMsg(''); }} disabled={step === 0}>
                            <ArrowLeft size={16} /> Previous
                        </button>
                        <button className="btn btn-primary" onClick={() => { setStep(step + 1); setMsg(''); }} disabled={step === STEPS.length - 1}>
                            Next <ArrowRight size={16} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default SetupWizard;
