import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface LoadDataPoint {
    day: string;
    count: number;
}

interface SystemDataPoint {
    time: string;
    cpu: number;
    memory: number;
}

const SiderailCharts: React.FC = () => {
    const { role, roles } = useAuth();
    const [loadData, setLoadData] = useState<LoadDataPoint[]>([]);
    const [systemData, setSystemData] = useState<SystemDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isPowerAdmin = roles.includes('power_admin') || roles.includes('admin');
    const isSystemAdmin = roles.includes('system_admin');
    const isScheduleAdmin = roles.includes('schedule_admin');
    const isScheduleManager = roles.includes('schedule_manager');
    const isTeacher = role === 'teacher';

    const shouldShowLoadChart = isPowerAdmin || isSystemAdmin || isScheduleAdmin || isScheduleManager || isTeacher;
    const shouldShowSystemChart = isPowerAdmin || isSystemAdmin;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            
            // Fetch load by day data for relevant roles
            if (shouldShowLoadChart) {
                try {
                    if (isPowerAdmin || isSystemAdmin || isScheduleAdmin || isScheduleManager) {
                        // Admin roles: fetch schedules count by day_of_week
                        const { data: schedules } = await supabase
                            .from('schedules')
                            .select('day_of_week');
                        
                        if (schedules) {
                            const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const counts = dayOrder.map(day => ({
                                day: day.substring(0, 3),
                                count: schedules.filter((s: { day_of_week: string }) => s.day_of_week === day).length
                            }));
                            setLoadData(counts);
                        }
                    } else if (isTeacher) {
                        // Teacher: simplified placeholder data
                        // TODO: Fetch actual teacher class load by day
                        setLoadData([
                            { day: 'Mon', count: 3 },
                            { day: 'Tue', count: 4 },
                            { day: 'Wed', count: 3 },
                            { day: 'Thu', count: 4 },
                            { day: 'Fri', count: 3 },
                        ]);
                    }
                } catch (err) {
                    console.error('Error fetching load data:', err);
                    setError('Failed to load chart data');
                }
            }

            // Fetch system status data for admin roles
            if (shouldShowSystemChart) {
                try {
                    // Simulated system metrics over time
                    const now = Date.now();
                    const data = Array.from({ length: 7 }, (_, i) => ({
                        time: new Date(now - (6 - i) * 3600000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                        cpu: Math.floor(Math.random() * 30) + 20,
                        memory: Math.floor(Math.random() * 20) + 60,
                    }));
                    setSystemData(data);
                } catch (err) {
                    console.error('Error fetching system data:', err);
                }
            }

            setLoading(false);
        };

        fetchData();
    }, [role, roles, shouldShowLoadChart, shouldShowSystemChart, isPowerAdmin, isSystemAdmin, isScheduleAdmin, isScheduleManager, isTeacher]);

    if (loading) {
        return (
            <>
                {shouldShowLoadChart && (
                    <div className="siderail-section">
                        <h4>Load by Day</h4>
                        <div className="siderail-chart">
                            <div className="siderail-chart-placeholder">Loading...</div>
                        </div>
                    </div>
                )}
                {shouldShowSystemChart && (
                    <div className="siderail-section">
                        <h4>System Status</h4>
                        <div className="siderail-chart">
                            <div className="siderail-chart-placeholder">Loading...</div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    if (error) {
        return (
            <>
                {shouldShowLoadChart && (
                    <div className="siderail-section">
                        <h4>Load by Day</h4>
                        <div className="siderail-chart">
                            <div className="siderail-chart-placeholder" style={{color: 'var(--accent-error)'}}>{error}</div>
                        </div>
                    </div>
                )}
                {shouldShowSystemChart && (
                    <div className="siderail-section">
                        <h4>System Status</h4>
                        <div className="siderail-chart">
                            <div className="siderail-chart-placeholder" style={{color: 'var(--accent-error)'}}>{error}</div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return (
        <>
            {shouldShowLoadChart && (
                <div className="siderail-section">
                    <h4>Load by Day</h4>
                    <div className="siderail-chart">
                        <ResponsiveContainer width="100%" height={120}>
                            <BarChart data={loadData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-elevated)', opacity: 0.4 }} />
                                <Bar dataKey="count" name="Load" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
            {shouldShowSystemChart && (
                <div className="siderail-section">
                    <h4>System Status</h4>
                    <div className="siderail-chart">
                        <ResponsiveContainer width="100%" height={120}>
                            <LineChart data={systemData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                                <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                                <Tooltip content={<ChartTooltip />} />
                                <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 3 }} />
                                <Line type="monotone" dataKey="memory" name="Memory %" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </>
    );
};

export default SiderailCharts;
