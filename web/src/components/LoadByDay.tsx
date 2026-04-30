import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface LoadDataPoint {
    day: string;
    count: number;
}

const LoadByDay: React.FC = () => {
    const { role, roles } = useAuth();
    const [loadData, setLoadData] = useState<LoadDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isPowerAdmin = roles.includes('power_admin') || roles.includes('admin');
    const isSystemAdmin = roles.includes('system_admin');
    const isScheduleAdmin = roles.includes('schedule_admin');
    const isScheduleManager = roles.includes('schedule_manager');
    const isTeacher = role === 'teacher';

    const shouldShow = isPowerAdmin || isSystemAdmin || isScheduleAdmin || isScheduleManager || isTeacher;

    useEffect(() => {
        if (!shouldShow) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
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
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [role, roles, shouldShow, isPowerAdmin, isSystemAdmin, isScheduleAdmin, isScheduleManager, isTeacher]);

    if (!shouldShow) return null;

    if (loading) {
        return (
            <div className="siderail-section">
                <h4>Load by Day</h4>
                <div className="siderail-chart">
                    <div className="siderail-chart-placeholder">Loading...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="siderail-section">
                <h4>Load by Day</h4>
                <div className="siderail-chart">
                    <div className="siderail-chart-placeholder" style={{color: 'var(--accent-error)'}}>{error}</div>
                </div>
            </div>
        );
    }

    return (
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
    );
};

export default LoadByDay;
