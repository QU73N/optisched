import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
    variant?: 'inline' | 'block' | 'skeleton';
    text?: string;
    count?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
    variant = 'block',
    text = 'Loading...',
    count = 3,
}) => {
    if (variant === 'inline') {
        return (
            <span className="inline-flex items-center gap-2" role="status" aria-label="Loading">
                <Loader2 size={14} className="spin" />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</span>
            </span>
        );
    }

    if (variant === 'skeleton') {
        return (
            <div className="dash-list" style={{ gap: 10 }} aria-busy="true" aria-label="Loading">
                {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="card dash-skeleton" style={{ padding: 20, minHeight: 56 }} />
                ))}
            </div>
        );
    }

    return (
        <div className="dash-loading-center" role="status" aria-label="Loading">
            <Loader2 className="spin" size={28} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, display: 'block' }}>{text}</span>
        </div>
    );
};

export default LoadingState;
