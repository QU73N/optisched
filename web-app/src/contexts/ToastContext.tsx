import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface ToastOptions {
    title: string;
    message?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
    actions?: {
        text: string;
        onPress?: () => void;
        style?: 'default' | 'cancel' | 'destructive';
    }[];
}

interface ToastContextType {
    showToast: (options: ToastOptions) => void;
    hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toast, setToast] = useState<ToastOptions | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    const showToast = useCallback((options: ToastOptions) => {
        setToast(options);
        setIsVisible(true);

        if (!options.actions || options.actions.length === 0) {
            const duration = options.duration || 4000;
            setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => setToast(null), 300);
            }, duration);
        }
    }, []);

    const hideToast = useCallback(() => {
        setIsVisible(false);
        setTimeout(() => setToast(null), 300);
    }, []);

    const handleAction = (onPress?: () => void) => {
        hideToast();
        if (onPress) setTimeout(onPress, 200);
    };

    const getIcon = (type?: string) => {
        switch (type) {
            case 'success': return <CheckCircle size={22} color="#10b981" />;
            case 'error': return <AlertCircle size={22} color="#ef4444" />;
            case 'warning': return <AlertTriangle size={22} color="#f59e0b" />;
            default: return <Info size={22} color="#3b82f6" />;
        }
    };

    const getAccentColor = (type?: string) => {
        switch (type) {
            case 'success': return '#10b981';
            case 'error': return '#ef4444';
            case 'warning': return '#f59e0b';
            default: return '#3b82f6';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}
            {toast && (
                <div className={`toast-overlay ${isVisible ? 'toast-visible' : 'toast-hidden'}`}>
                    <div className="toast-box" style={{ borderLeftColor: getAccentColor(toast.type) }}>
                        <div className="toast-header">
                            <div className="toast-icon">{getIcon(toast.type)}</div>
                            <div className="toast-content">
                                <h4 className="toast-title">{toast.title}</h4>
                                {toast.message && <p className="toast-message">{toast.message}</p>}
                            </div>
                            <button className="toast-close" onClick={hideToast}><X size={16} /></button>
                        </div>
                        {toast.actions && toast.actions.length > 0 && (
                            <div className="toast-actions">
                                {toast.actions.map((action, idx) => (
                                    <button
                                        key={idx}
                                        className={`toast-action-btn ${action.style === 'destructive' ? 'destructive' : action.style === 'cancel' ? 'cancel' : 'primary'}`}
                                        onClick={() => handleAction(action.onPress)}
                                    >
                                        {action.text}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .toast-overlay {
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    z-index: 10000;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .toast-visible { opacity: 1; transform: translateX(0); }
                .toast-hidden { opacity: 0; transform: translateX(100px); pointer-events: none; }

                .toast-box {
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-left: 4px solid;
                    border-radius: 12px;
                    padding: 16px 20px;
                    min-width: 320px;
                    max-width: 420px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                }

                .toast-header {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }

                .toast-icon { flex-shrink: 0; margin-top: 2px; }
                .toast-content { flex: 1; }
                .toast-title { font-size: 14px; font-weight: 600; color: white; margin: 0; }
                .toast-message { font-size: 13px; color: var(--text-secondary, #94a3b8); margin: 4px 0 0; line-height: 1.4; }

                .toast-close {
                    background: none;
                    border: none;
                    color: var(--text-muted, #64748b);
                    cursor: pointer;
                    padding: 2px;
                    border-radius: 4px;
                    transition: color 0.2s;
                }
                .toast-close:hover { color: white; }

                .toast-actions {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid rgba(255, 255, 255, 0.06);
                }

                .toast-action-btn {
                    padding: 6px 16px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                }
                .toast-action-btn.primary { background: #3b82f6; color: white; }
                .toast-action-btn.primary:hover { background: #2563eb; }
                .toast-action-btn.destructive { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
                .toast-action-btn.destructive:hover { background: rgba(239, 68, 68, 0.25); }
                .toast-action-btn.cancel { background: rgba(255, 255, 255, 0.05); color: var(--text-secondary, #94a3b8); }
                .toast-action-btn.cancel:hover { background: rgba(255, 255, 255, 0.1); }
            `}</style>
        </ToastContext.Provider>
    );
};
