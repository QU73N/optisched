/**
 * Publish Overwrite Confirmation Modal
 * 
 * This modal is shown when a user attempts to publish a schedule and an active
 * published schedule already exists. It requires explicit confirmation before
 * proceeding with the overwrite.
 * 
 * Key features:
 * - Shows current active schedule details
 * - Explains impact of overwrite
 * - Requires explicit confirmation
 * - Preserves version history
 * 
 * Brand-aligned design following OptiSched brand system
 */

import React from 'react';
import { AlertTriangle, Clock, FileClock } from 'lucide-react';

interface PublishOverwriteConfirmProps {
    isOpen: boolean;
    currentSchedule: {
        version?: string;
        timestamp?: string;
        sessionCount?: number;
        score?: number;
    } | null;
    newSchedule: {
        sessionCount: number;
        score?: number;
    };
    onConfirm: () => void;
    onCancel: () => void;
}

export const PublishOverwriteConfirm: React.FC<PublishOverwriteConfirmProps> = ({
    isOpen,
    currentSchedule,
    newSchedule,
    onConfirm,
    onCancel,
}) => {
    if (!isOpen) return null;

    const formatDate = (timestamp?: string) => {
        if (!timestamp) return 'Unknown';
        return new Date(timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 40, 84, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }}>
            <div style={{
                backgroundColor: 'var(--surface-light)',
                borderRadius: 'var(--radius-lg)',
                padding: 24,
                maxWidth: 520,
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
                border: '1px solid var(--border-light)',
                boxShadow: '0 8px 32px rgba(15, 40, 84, 0.12)',
            }}>
                {/* Header */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{
                            width: 40,
                            height: 40,
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--accent-warning-10, rgba(211, 139, 32, 0.1))',
                            border: '2px solid var(--accent-warning)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <AlertTriangle size={20} style={{ color: 'var(--accent-warning)' }} />
                        </div>
                        <h2 style={{ 
                            margin: 0, 
                            fontSize: 18, 
                            fontWeight: 700, 
                            color: 'var(--text-primary)',
                            letterSpacing: '-0.01em'
                        }}>
                            Overwrite Published Schedule?
                        </h2>
                    </div>
                    <p style={{ 
                        margin: 0, 
                        color: 'var(--text-secondary)', 
                        fontSize: 14,
                        lineHeight: 1.5
                    }}>
                        You are about to overwrite the current published schedule with a new version.
                    </p>
                </div>

                {/* Current Schedule Details */}
                {currentSchedule && (
                    <div style={{
                        backgroundColor: 'var(--accent-warning-10, rgba(211, 139, 32, 0.1))',
                        border: '1px solid var(--accent-warning)',
                        borderRadius: 'var(--radius-md)',
                        padding: 16,
                        marginBottom: 16,
                    }}>
                        <h3 style={{ 
                            margin: '0 0 12px 0', 
                            fontSize: 14, 
                            fontWeight: 600, 
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            <FileClock size={16} style={{ color: 'var(--accent-warning)' }} />
                            Current Published Schedule
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>v{currentSchedule.version || 'Unknown'}</strong>
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    {formatDate(currentSchedule.timestamp)}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    Sessions: <strong style={{ color: 'var(--text-primary)' }}>{currentSchedule.sessionCount || 0}</strong>
                                </span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    Score: <strong style={{ color: 'var(--text-primary)' }}>{currentSchedule.score?.toFixed(0) || 'N/A'}</strong>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* New Schedule Details */}
                <div style={{
                    backgroundColor: 'var(--accent-success-10, rgba(47, 143, 91, 0.1))',
                    border: '1px solid var(--accent-success)',
                    borderRadius: 'var(--radius-md)',
                    padding: 16,
                    marginBottom: 16,
                }}>
                    <h3 style={{ 
                        margin: '0 0 12px 0', 
                        fontSize: 14, 
                        fontWeight: 600, 
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}>
                        <FileClock size={16} style={{ color: 'var(--accent-success)' }} />
                        New Schedule to Publish
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13 }}>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>
                                Sessions: <strong style={{ color: 'var(--text-primary)' }}>{newSchedule.sessionCount}</strong>
                            </span>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)' }}>
                                Score: <strong style={{ color: 'var(--text-primary)' }}>{newSchedule.score?.toFixed(0) || 'N/A'}</strong>
                            </span>
                        </div>
                    </div>
                </div>

                {/* Impact Explanation */}
                <div style={{
                    backgroundColor: 'var(--surface-soft)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: 16,
                    marginBottom: 24,
                }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--accent-warning-10, rgba(211, 139, 32, 0.1))',
                            border: '2px solid var(--accent-warning)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <AlertTriangle size={24} style={{ color: 'var(--accent-warning)' }} />
                        </div>
                        <div>
                            <h4 style={{ 
                                margin: '0 0 8px 0', 
                                fontSize: 14, 
                                fontWeight: 600, 
                                color: 'var(--text-primary)' 
                            }}>
                                What will happen:
                            </h4>
                            <ul style={{ 
                                margin: 0, 
                                paddingLeft: 20, 
                                fontSize: 13, 
                                color: 'var(--text-secondary)',
                                lineHeight: 1.6
                            }}>
                                <li style={{ marginBottom: 4 }}>The current published schedule will be replaced</li>
                                <li style={{ marginBottom: 4 }}>A new version will be created for the new schedule</li>
                                <li style={{ marginBottom: 4 }}>Previous versions will remain available in version history</li>
                                <li>You can restore previous versions at any time from the Versions tab</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-light)',
                            backgroundColor: 'var(--surface-light)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 500,
                            fontFamily: 'var(--font-sans)',
                            transition: 'background-color 150ms ease, border-color 150ms ease',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--surface-soft)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 'var(--radius-md)',
                            border: 'none',
                            backgroundColor: 'var(--accent-warning)',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 600,
                            fontFamily: 'var(--font-sans)',
                            transition: 'background-color 150ms ease',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--accent-warning-dark, #b87718)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--accent-warning)';
                        }}
                    >
                        Confirm Overwrite
                    </button>
                </div>
            </div>
        </div>
    );
};
