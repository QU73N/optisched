import React from 'react';

interface ChartTooltipProps {
    active?: boolean;
    payload?: Array<{
        name: string;
        value: number;
        color: string;
    }>;
    label?: string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 8,
            padding: '10px 14px',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 12
        }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                    {p.name}: <strong style={{ color: 'var(--text-primary)' }}>{p.value}</strong>
                </div>
            ))}
        </div>
    );
};

export default ChartTooltip;
