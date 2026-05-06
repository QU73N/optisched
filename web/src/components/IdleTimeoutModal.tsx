// IdleTimeoutModal - Session 2 / Task C4 of HARDENING_PLAN.md
//
// Shown when the idle timer fires. Two flavours:
//   - 'reauth' (Power Admin): user must re-enter password; on success the
//     idle clock resets without a sign-out.
//   - 'signout' (everyone else): countdown bar; user clicks "Stay" to
//     reset, or "Sign out" / inaction triggers immediate sign-out.

import React, { useState } from 'react';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type IdleMode = 'reauth' | 'signout';

interface Props {
    open: boolean;
    mode: IdleMode;
    secondsLeft: number;
    onStay: () => void;
    onSignOut: () => void;
}

const IdleTimeoutModal: React.FC<Props> = ({ open, mode, secondsLeft, onStay, onSignOut }) => {
    const { profile } = useAuth();
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Parent is expected to mount this component only while `open` is true,
    // so closing naturally discards local state. The `open` guard remains
    // as a safety net but no synchronous state reset is needed.
    if (!open) return null;

    const handleReauth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.email) return;
        setSubmitting(true);
        setError(null);
        const { error: err } = await supabase.auth.signInWithPassword({
            email: profile.email,
            password,
        });
        setSubmitting(false);
        if (err) {
            setError(err.message);
            return;
        }
        onStay();
    };

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="idle-title">
            <div className="modal-content" style={{ maxWidth: 420 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    <ShieldAlert size={28} color="var(--accent-warning, #c79a3a)" />
                    <h2 id="idle-title" style={{ margin: 0, fontSize: 18 }}>
                        {mode === 'reauth' ? 'Confirm your identity' : 'Are you still there?'}
                    </h2>
                </div>

                <p style={{ margin: 0, marginBottom: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
                    {mode === 'reauth'
                        ? `For security, please re-enter your password to continue your session. Auto sign-out in ${secondsLeft}s.`
                        : `You've been inactive for a while. You'll be signed out in ${secondsLeft}s.`}
                </p>

                {mode === 'reauth' ? (
                    <form onSubmit={handleReauth} className="modal-form">
                        <label htmlFor="reauth-pw">Password</label>
                        <input
                            id="reauth-pw"
                            className="input"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoFocus
                            required
                            autoComplete="current-password"
                            disabled={submitting}
                        />
                        {error && (
                            <div role="alert" style={{ color: 'var(--accent-error)', fontSize: 13 }}>{error}</div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                            <button type="button" className="btn btn-ghost" onClick={onSignOut} disabled={submitting}>
                                <LogOut size={14} /> Sign out
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={submitting || !password}>
                                {submitting ? <Loader2 size={14} className="spin" /> : null}
                                Continue session
                            </button>
                        </div>
                    </form>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                        <button className="btn btn-ghost" onClick={onSignOut}>
                            <LogOut size={14} /> Sign out
                        </button>
                        <button className="btn btn-primary" onClick={onStay} autoFocus>
                            Stay signed in
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IdleTimeoutModal;
