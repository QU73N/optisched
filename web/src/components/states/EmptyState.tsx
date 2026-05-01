import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title?: string;
    description?: string;
    action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon = <Inbox size={28} />,
    title = 'Nothing here yet',
    description,
    action,
}) => (
    <div className="dash-empty" role="status" aria-label="No data">
        {icon}
        <div style={{ fontWeight: 600, marginTop: 8 }}>{title}</div>
        {description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{description}</div>}
        {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
);

export default EmptyState;
