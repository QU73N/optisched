import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';

interface SystemDataPoint {
    time: string;
    cpu: number;
    memory: number;
}

const SystemStats: React.FC = () => {
    const { roles } = useAuth();
    const [systemData, setSystemData] = useState<SystemDataPoint[]>([]);
    const [loading, setLoading] = useState(true);

    const isPowerAdmin = roles.includes('power_admin') || roles.includes('admin');
    const isSystemAdmin = roles.includes('system_admin');
    const shouldShow = isPowerAdmin || isSystemAdmin;

    useEffect(() => {
        if (!shouldShow) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
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
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [shouldShow]);

    if (!shouldShow) return null;

    if (loading) {
        return (
            <div className="siderail-section">
                <h4>System Stats</h4>
                <div className="siderail-chart">
                    <div className="siderail-chart-placeholder">Loading...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="siderail-section">
            <h4>System Stats</h4>
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
    );
};

export default SystemStats;
