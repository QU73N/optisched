import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    confirmVariant?: 'danger' | 'primary' | 'warning';
    onConfirm: () => void;
    onCancel: () => void;
    destructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title,
    message,
    confirmText = 'Confirm',
    confirmVariant = 'danger',
    onConfirm,
    onCancel,
    destructive = true,
}) => {
    if (!open) return null;
    return (
        <div
            className="modal-overlay"
            onClick={onCancel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
        >
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 id="confirm-title" style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {destructive && <AlertTriangle size={18} color="var(--accent-warning)" />}
                        {title}
                    </h2>
                    <button className="btn btn-ghost" onClick={onCancel} aria-label="Close dialog">
                        <X size={20} />
                    </button>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>{message}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button
                        className={`btn btn-${confirmVariant}`}
                        onClick={() => { onConfirm(); onCancel(); }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
