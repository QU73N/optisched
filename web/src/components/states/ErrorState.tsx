import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
    error?: string;
    retry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error = 'Something went wrong.', retry }) => (
    <div className="dash-empty" role="alert" aria-live="polite">
        <AlertTriangle size={28} color="var(--accent-error)" />
        <div style={{ fontWeight: 600, marginTop: 8, color: 'var(--accent-error)' }}>{error}</div>
        {retry && (
            <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={retry}>
                <RefreshCw size={14} /> Retry
            </button>
        )}
    </div>
);

export default ErrorState;
