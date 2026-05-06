import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRooms, useSchedules } from '../../hooks/useSupabase';
import { Building2, DoorOpen, Clock, Search, BarChart3, Calendar, ChevronRight, MapPin, Users } from 'lucide-react';

const RoomHub: React.FC = () => {
    useAuth();
    const { rooms, loading: loadingRooms } = useRooms();
    const { schedules } = useSchedules({ isActive: true }); // Fetch all active schedules (draft and published)
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

    const roomUtilizations = React.useMemo(() => {
        const map = new Map<string, { classes: number; hours: number; days: Set<string>; subjects: Set<string>; sections: Set<string>; capacity: number }>();
        schedules.forEach((s: any) => {
            const rid = s.room_id;
            if (!rid) return;
            if (!map.has(rid)) {
                const room = rooms.find((r: any) => r.id === rid);
                map.set(rid, { classes: 0, hours: 0, days: new Set(), subjects: new Set(), sections: new Set(), capacity: room?.capacity || 0 });
            }
            const u = map.get(rid)!;
            u.classes++;
            if (s.day_of_week) u.days.add(s.day_of_week);
            const subjectName = s.subject?.name || s.subject_name;
            if (subjectName) u.subjects.add(subjectName);
            const sectionName = s.section?.name || s.section_name;
            if (sectionName) u.sections.add(sectionName);
            if (s.start_time && s.end_time) {
                const [sh, sm] = s.start_time.split(':').map(Number);
                const [eh, em] = s.end_time.split(':').map(Number);
                u.hours += (eh * 60 + em - sh * 60 - sm) / 60;
            }
        });
        return map;
    }, [schedules, rooms]);

    const filteredRooms = rooms.filter((r: any) => {
        const name = r.name || '';
        const building = r.building || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase()) || building.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const totalClasses = schedules.length;
    const avgUtilization = rooms.length > 0 ? (totalClasses / rooms.length).toFixed(1) : '0';
    const totalHours = Array.from(roomUtilizations.values()).reduce((sum, u) => sum + u.hours, 0);

    return (
        <div className="fhub">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1>Room Utilization</h1>
                    <p>View room availability, capacity, and scheduling patterns.</p>
                </div>
            </div>

            {/* Stats */}
            <div className="fhub-stats">
                <div className="fhub-stat-card">
                    <div className="fhub-stat-icon" style={{ background: 'var(--accent-primary-subtle)' }}><Building2 size={22} color="var(--accent-primary)" /></div>
                    <div className="fhub-stat-info">
                        <span className="fhub-stat-num">{rooms.length}</span>
                        <span className="fhub-stat-label">Total Rooms</span>
                    </div>
                </div>
                <div className="fhub-stat-card">
                    <div className="fhub-stat-icon" style={{ background: 'var(--accent-success-subtle)' }}><DoorOpen size={22} color="var(--accent-success)" /></div>
                    <div className="fhub-stat-info">
                        <span className="fhub-stat-num">{totalClasses}</span>
                        <span className="fhub-stat-label">Total Classes</span>
                    </div>
                </div>
                <div className="fhub-stat-card">
                    <div className="fhub-stat-icon" style={{ background: 'var(--accent-primary-subtle)' }}><BarChart3 size={22} color="var(--accent-primary)" /></div>
                    <div className="fhub-stat-info">
                        <span className="fhub-stat-num">{avgUtilization}</span>
                        <span className="fhub-stat-label">Avg Classes/Room</span>
                    </div>
                </div>
                <div className="fhub-stat-card">
                    <div className="fhub-stat-icon" style={{ background: 'var(--accent-primary-subtle)' }}><Clock size={22} color="var(--accent-primary)" /></div>
                    <div className="fhub-stat-info">
                        <span className="fhub-stat-num">{totalHours.toFixed(0)}</span>
                        <span className="fhub-stat-label">Total Hours/Week</span>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="fhub-search">
                <Search size={18} color="var(--text-muted)" />
                <input type="text" placeholder="Search by room name or building..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {searchQuery && (
                    <span className="fhub-result-count">{filteredRooms.length} result{filteredRooms.length !== 1 ? 's' : ''}</span>
                )}
            </div>

            {/* Room Grid */}
            <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', overflowX: 'hidden', paddingBottom: '1rem' }}>
            <div className="fhub-grid">
                {loadingRooms ? (
                    <div className="fhub-empty"><div className="spinner" /></div>
                ) : filteredRooms.length === 0 ? (
                    <div className="fhub-empty"><Building2 size={48} style={{ opacity: 0.2 }} /><p>No rooms found</p></div>
                ) : filteredRooms.map((room: any) => {
                    const name = room.name || 'Unknown';
                    const building = room.building || 'Main Building';
                    const utilization = roomUtilizations.get(room.id);
                    const classes = utilization?.classes || 0;
                    const hours = utilization?.hours?.toFixed(1) || '0';
                    const days = utilization?.days?.size || 0;
                    const subjects = utilization?.subjects ? Array.from(utilization.subjects) : [];
                    const sectionsList = utilization?.sections ? Array.from(utilization.sections) : [];
                    const capacity = room.capacity || 0;
                    const roomType = (room.room_type || 'classroom').replace(/\b\w/g, (l: string) => l.toUpperCase());
                    const maxHours = 40; // Assuming 8 hours/day * 5 days
                    const utilizationPct = Math.min(100, ((utilization?.hours || 0) / maxHours) * 100);

                    let utilColor = '#10b981';
                    let utilLabel = 'Low';
                    if (utilizationPct > 80) { utilColor = '#ef4444'; utilLabel = 'High'; }
                    else if (utilizationPct > 50) { utilColor = '#f59e0b'; utilLabel = 'Medium'; }

                    const isExpanded = selectedRoom === room.id;

                    return (
                        <div key={room.id} className={`fhub-card ${isExpanded ? 'expanded' : ''}`} onClick={() => setSelectedRoom(isExpanded ? null : room.id)}>
                            <div className="fhub-card-top">
                                <div className="fhub-avatar" style={{ background: `${utilColor}15`, color: utilColor }}>
                                    <DoorOpen size={20} />
                                </div>
                                <div className="fhub-name">
                                    <h4>{name}</h4>
                                    <span className="fhub-dept">{building}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="fhub-emp-badge" style={{
                                        background: 'var(--accent-primary-subtle)',
                                        color: 'var(--accent-primary)'
                                    }}>
                                        <MapPin size={10} /> {roomType}
                                    </span>
                                    <span className="fhub-load-badge" style={{ background: `${utilColor}15`, color: utilColor }}>{utilLabel}</span>
                                    <ChevronRight size={16} color="var(--text-muted)" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="fhub-card-stats">
                                <div className="fhub-mini-stat"><DoorOpen size={13} /><span>{classes}</span><small>Classes</small></div>
                                <div className="fhub-mini-stat"><Clock size={13} /><span>{hours}</span><small>Hrs/wk</small></div>
                                <div className="fhub-mini-stat"><Calendar size={13} /><span>{days}</span><small>Days/wk</small></div>
                                <div className="fhub-mini-stat"><Users size={13} /><span>{capacity}</span><small>Capacity</small></div>
                            </div>

                            {/* Utilization Bar */}
                            <div className="fhub-load-bar">
                                <div className="fhub-load-fill" style={{ width: `${utilizationPct}%`, background: `linear-gradient(90deg, ${utilColor}, ${utilColor}90)` }} />
                            </div>
                            <div className="fhub-load-meta">
                                <span>{hours} / {maxHours} hrs</span>
                                <span style={{ color: utilColor, fontWeight: 600 }}>{utilizationPct.toFixed(0)}%</span>
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
                                    {utilization?.days && utilization.days.size > 0 && (
                                        <div className="fhub-detail-group">
                                            <label>Active Days</label>
                                            <div className="fhub-day-pills">
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => {
                                                    const full = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(d)];
                                                    const active = utilization.days.has(full);
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
            </div>

            <style>{`
                .fhub { display: flex; flex-direction: column; gap: 0.75rem; }

                .fhub-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
                .fhub-stat-card { 
                    display: flex; 
                    align-items: center; 
                    gap: 1rem; 
                    padding: 1.25rem 1.5rem; 
                    background: var(--bg-surface); 
                    border: 1px solid var(--border-default); 
                    border-radius: 12px; 
                    transition: all 0.2s ease; 
                }
                .fhub-stat-card:hover { 
                    border-color: var(--accent-primary); 
                    transform: translateY(-2px); 
                    box-shadow: 0 4px 12px rgba(73, 136, 196, 0.1);
                }
                .fhub-stat-icon { 
                    width: 48px; 
                    height: 48px; 
                    border-radius: 10px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    flex-shrink: 0; 
                }
                .fhub-stat-info { display: flex; flex-direction: column; }
                .fhub-stat-num { 
                    font-size: 1.5rem; 
                    font-weight: 700; 
                    color: var(--text-primary); 
                    line-height: 1.2; 
                    font-feature-settings: 'tnum' on, 'lnum' on;
                }
                .fhub-stat-label { 
                    font-size: 0.75rem; 
                    color: var(--text-muted); 
                    margin-top: 2px; 
                    text-transform: none;
                    letter-spacing: normal;
                }

                .fhub-search { 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    padding: 0.875rem 1.25rem; 
                    background: var(--bg-surface); 
                    border: 1px solid var(--border-default); 
                    border-radius: 10px; 
                    transition: border-color 0.2s ease;
                }
                .fhub-search:focus-within {
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 0 3px rgba(73, 136, 196, 0.1);
                }
                .fhub-search input { 
                    flex: 1; 
                    background: none; 
                    border: none; 
                    color: var(--text-primary); 
                    font-size: 0.9rem; 
                    outline: none; 
                }
                .fhub-search input::placeholder {
                    color: var(--text-muted);
                }
                .fhub-result-count { 
                    font-size: 0.75rem; 
                    color: var(--text-muted); 
                    white-space: nowrap; 
                }

                .fhub-grid { 
                    display: grid; 
                    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); 
                    gap: 1rem; 
                }
                .fhub-card { 
                    background: var(--bg-secondary); 
                    border: 1px solid var(--border-default); 
                    border-radius: 12px; 
                    padding: 1.25rem; 
                    cursor: pointer; 
                    transition: all 0.25s ease; 
                }
                .fhub-card:hover { 
                    border-color: var(--accent-primary); 
                    box-shadow: 0 4px 16px rgba(73, 136, 196, 0.12); 
                    transform: translateY(-2px);
                }
                .fhub-card.expanded { 
                    border-color: var(--accent-primary); 
                    box-shadow: 0 8px 24px rgba(73, 136, 196, 0.15); 
                }

                .fhub-card-top { 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    margin-bottom: 1rem; 
                }
                .fhub-avatar { 
                    width: 44px; 
                    height: 44px; 
                    border-radius: 10px; 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    font-weight: 700; 
                    font-size: 1.2rem; 
                    flex-shrink: 0; 
                }
                .fhub-name { flex: 1; }
                .fhub-name h4 { 
                    font-size: 0.95rem; 
                    font-weight: 600; 
                    color: var(--text-primary); 
                }
                .fhub-dept { 
                    font-size: 0.75rem; 
                    color: var(--text-muted); 
                }

                .fhub-emp-badge { 
                    font-size: 0.65rem; 
                    font-weight: 600; 
                    padding: 3px 8px; 
                    border-radius: 6px; 
                    display: flex; 
                    align-items: center; 
                    gap: 3px; 
                    text-transform: none;
                    letter-spacing: normal;
                }
                .fhub-load-badge { 
                    font-size: 0.65rem; 
                    font-weight: 700; 
                    padding: 3px 10px; 
                    border-radius: 6px; 
                    letter-spacing: normal; 
                }

                .fhub-card-stats { 
                    display: grid; 
                    grid-template-columns: repeat(4, 1fr); 
                    gap: 0.5rem; 
                    margin-bottom: 0.75rem; 
                }
                .fhub-mini-stat { 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    gap: 2px; 
                    padding: 8px 4px; 
                    background: var(--bg-hover); 
                    border-radius: 8px; 
                    color: var(--text-secondary); 
                }
                .fhub-mini-stat span { 
                    font-size: 1.1rem; 
                    font-weight: 700; 
                    color: var(--text-primary); 
                    font-feature-settings: 'tnum' on, 'lnum' on;
                }
                .fhub-mini-stat small { 
                    font-size: 0.65rem; 
                    color: var(--text-muted); 
                }

                .fhub-load-bar { 
                    height: 4px; 
                    background: var(--bg-hover); 
                    border-radius: 4px; 
                    overflow: hidden; 
                }
                .fhub-load-fill { 
                    height: 100%; 
                    border-radius: 4px; 
                    transition: width 0.6s ease; 
                }
                .fhub-load-meta { 
                    display: flex; 
                    justify-content: space-between; 
                    font-size: 0.7rem; 
                    color: var(--text-muted); 
                    margin-top: 4px; 
                }

                .fhub-expanded { 
                    margin-top: 1rem; 
                    padding-top: 1rem; 
                    border-top: 1px solid var(--border-default); 
                    display: flex; 
                    flex-direction: column; 
                    gap: 0.75rem; 
                    animation: fadeInDown 0.25s ease; 
                }
                .fhub-detail-group label { 
                    font-size: 0.65rem; 
                    font-weight: 600; 
                    color: var(--text-muted); 
                    text-transform: none; 
                    letter-spacing: normal; 
                    margin-bottom: 6px; 
                    display: block; 
                }
                .fhub-chips { 
                    display: flex; 
                    flex-wrap: wrap; 
                    gap: 6px; 
                }
                .fhub-chip { 
                    padding: 4px 10px; 
                    border-radius: 8px; 
                    font-size: 0.7rem; 
                    font-weight: 500; 
                    background: var(--accent-primary-subtle); 
                    color: var(--accent-primary); 
                    border: 1px solid var(--accent-primary);
                }
                .fhub-chip.sec { 
                    background: var(--accent-primary-subtle); 
                    color: var(--accent-primary); 
                    border-color: var(--accent-primary);
                }

                .fhub-day-pills { display: flex; gap: 4px; }
                .fhub-day-pill { 
                    padding: 4px 10px; 
                    border-radius: 6px; 
                    font-size: 0.7rem; 
                    font-weight: 500; 
                    background: var(--bg-surface); 
                    color: var(--text-muted); 
                    border: 1px solid var(--border-default);
                    transition: all 0.2s ease;
                }
                .fhub-day-pill.active { 
                    background: var(--accent-success-subtle); 
                    color: var(--accent-success); 
                    border-color: var(--accent-success); 
                    font-weight: 600; 
                }

                .fhub-empty { 
                    grid-column: 1 / -1; 
                    display: flex; 
                    flex-direction: column; 
                    align-items: center; 
                    justify-content: center; 
                    padding: 4rem; 
                    color: #64748B; 
                    gap: 0.75rem; 
                }

                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 1024px) {
                    .fhub-stats { grid-template-columns: repeat(2, 1fr); }
                    .fhub-grid { grid-template-columns: 1fr; }
                }

                @media (prefers-reduced-motion: reduce) {
                    .fhub-stat-card, .fhub-card, .fhub-search {
                        transition: none;
                    }
                    .fhub-load-fill {
                        transition: none;
                    }
                    .fhub-expanded {
                        animation: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default RoomHub;
