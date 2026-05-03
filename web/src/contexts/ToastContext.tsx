import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

/* eslint-disable react-refresh/only-export-components */

interface ToastOptions {
    id?: string;
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

interface ToastItem extends ToastOptions {
    id: string;
    isVisible: boolean;
}

interface ToastContextType {
    showToast: (options: ToastOptions) => void;
    hideToast: (id: string) => void;
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
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const showToast = useCallback((options: ToastOptions) => {
        const id = options.id || `toast-${Date.now()}-${Math.random()}`;
        const newToast: ToastItem = { ...options, id, isVisible: true };

        setToasts(prev => {
            // Remove existing toast with same id if exists
            const filtered = prev.filter(t => t.id !== id);
            // Add new toast at the beginning (top of stack)
            return [newToast, ...filtered].slice(0, 5); // Max 5 toasts
        });

        // Auto-hide if no actions
        if (!options.actions || options.actions.length === 0) {
            const duration = options.duration || 4000;
            setTimeout(() => {
                setToasts(prev => {
                    const toast = prev.find(t => t.id === id);
                    if (!toast) return prev;
                    return prev.map(t => t.id === id ? { ...t, isVisible: false } : t);
                });
                // Remove from DOM after animation
                setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== id));
                }, 300);
            }, duration);
        }
    }, []);

    const hideToast = useCallback((id: string) => {
        setToasts(prev => {
            const toast = prev.find(t => t.id === id);
            if (!toast) return prev;
            return prev.map(t => t.id === id ? { ...t, isVisible: false } : t);
        });
        // Remove from DOM after animation
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300);
    }, []);

    const handleAction = (id: string, onPress?: () => void) => {
        hideToast(id);
        if (onPress) setTimeout(onPress, 200);
    };

    const getIcon = (type?: string) => {
        switch (type) {
            case 'success': return <CheckCircle size={22} style={{ color: 'var(--accent-success, #3FAF73)' }} />;
            case 'error': return <AlertCircle size={22} style={{ color: 'var(--accent-error, #E05D5D)' }} />;
            case 'warning': return <AlertTriangle size={22} style={{ color: 'var(--accent-warning, #E6A23C)' }} />;
            default: return <Info size={22} style={{ color: 'var(--accent-primary, #4988C4)' }} />;
        }
    };

    const getAccentColor = (type?: string) => {
        switch (type) {
            case 'success': return 'var(--accent-success, #3FAF73)';
            case 'error': return 'var(--accent-error, #E05D5D)';
            case 'warning': return 'var(--accent-warning, #E6A23C)';
            default: return 'var(--accent-primary, #4988C4)';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`toast-overlay ${toast.isVisible ? 'toast-visible' : 'toast-hidden'}`}
                        style={{ top: `${24 + toasts.indexOf(toast) * 80}px` }}
                    >
                        <div className="toast-box" style={{ borderLeftColor: getAccentColor(toast.type) }}>
                            <div className="toast-header">
                                <div className="toast-icon">{getIcon(toast.type)}</div>
                                <div className="toast-content">
                                    <h4 className="toast-title">{toast.title}</h4>
                                    {toast.message && <p className="toast-message">{toast.message}</p>}
                                </div>
                                <button className="toast-close" onClick={() => hideToast(toast.id)}><X size={16} /></button>
                            </div>
                            {toast.actions && toast.actions.length > 0 && (
                                <div className="toast-actions">
                                    {toast.actions.map((action, idx) => (
                                        <button
                                            key={idx}
                                            className={`toast-action-btn ${action.style === 'destructive' ? 'destructive' : action.style === 'cancel' ? 'cancel' : 'primary'}`}
                                            onClick={() => handleAction(toast.id, action.onPress)}
                                        >
                                            {action.text}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                .toast-container {
                    position: fixed;
                    top: 0;
                    right: 24px;
                    z-index: 10000;
                }
                .toast-overlay {
                    position: absolute;
                    right: 0;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .toast-visible { opacity: 1; transform: translateX(0); }
                .toast-hidden { opacity: 0; transform: translateX(100px); pointer-events: none; }

                .toast-box {
                    background: var(--bg-elevated, rgba(15, 23, 42, 0.95));
                    backdrop-filter: blur(20px);
                    border: 1px solid var(--border-default, rgba(255, 255, 255, 0.1));
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
                .toast-title { font-size: 14px; font-weight: 600; color: var(--text-primary, #E6EDF5); margin: 0; }
                .toast-message { font-size: 13px; color: var(--text-secondary, #A9B4C2); margin: 4px 0 0; line-height: 1.4; }

                .toast-close {
                    background: none;
                    border: none;
                    color: var(--text-muted, #7C8A9A);
                    cursor: pointer;
                    padding: 2px;
                    border-radius: 4px;
                    transition: color 0.2s;
                }
                .toast-close:hover { color: var(--text-primary, #E6EDF5); }

                .toast-actions {
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
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
                .toast-action-btn.primary { background: var(--accent-primary, #4988C4); color: white; }
                .toast-action-btn.primary:hover { background: var(--accent-primary-hover, #BDE8F5); }
                .toast-action-btn.destructive { background: var(--accent-error-subtle, rgba(224, 93, 93, 0.15)); color: var(--accent-error, #E05D5D); }
                .toast-action-btn.destructive:hover { background: var(--accent-error-subtle, rgba(224, 93, 93, 0.25)); }
                .toast-action-btn.cancel { background: var(--bg-inset, rgba(255, 255, 255, 0.05)); color: var(--text-secondary, #A9B4C2); }
                .toast-action-btn.cancel:hover { background: var(--bg-hover, rgba(255, 255, 255, 0.1)); }
            `}</style>
        </ToastContext.Provider>
    );
};
