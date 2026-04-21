import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import './LoginPage.css';

const LoginPage: React.FC = () => {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [theme] = useState(() => localStorage.getItem('optisched-theme') || 'light');

    useEffect(() => {
        // Apply theme on mount
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Forgot password state
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);
    const [forgotError, setForgotError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setError(null);
        setIsLoading(true);
        const result = await signIn(email, password);
        if (result.error) {
            setError(result.error);
        }
        setIsLoading(false);
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail) {
            setForgotError('Please enter your email');
            return;
        }
        setForgotError(null);
        setForgotLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                redirectTo: `${window.location.origin}/login`,
            });
            if (error) {
                setForgotError(error.message);
            } else {
                setForgotSent(true);
            }
        } catch (err: unknown) {
            setForgotError((err as Error)?.message || 'Failed to send reset email');
        }
        setForgotLoading(false);
    };

    // Forgot password view
    if (showForgot) {
        return (
            <div className="login-page">
                <div className="login-bg-pattern" />
                <div className="login-container fade-in">
                    <div className="login-logo-section">
                        <div className="login-logo">
                            <img src={theme === 'light' ? '/logo-with-text.png' : '/logo-white-with-text.png'} alt="OptiSched" width={176} height={176} style={{ objectFit: 'contain' }} />
                        </div>
                        <h1 className="login-title">Reset Password</h1>
                        <p className="login-subtitle">
                            Enter your institutional email to receive a password reset link.
                        </p>
                    </div>

                    {forgotSent ? (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                width: 64, height: 64, borderRadius: 20, margin: '0 auto 20px',
                                background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Mail size={28} style={{ color: '#22c55e' }} />
                            </div>
                            <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Check Your Email</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
                                We've sent a password reset link to<br />
                                <strong style={{ color: 'var(--text-primary)' }}>{forgotEmail}</strong>
                            </p>
                            <button
                                className="btn btn-primary login-submit"
                                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
                            >
                                <ArrowLeft size={16} /> Back to Login
                            </button>
                        </div>
                    ) : (
                        <form className="login-form" onSubmit={handleForgotPassword}>
                            <div className="login-field">
                                <label className="login-label" htmlFor="forgot-email">INSTITUTIONAL EMAIL</label>
                                <div className="login-input-wrapper">
                                    <Mail size={18} className="login-input-icon" />
                                    <input
                                        id="forgot-email"
                                        className="input"
                                        type="email"
                                        placeholder="student@meycauayan.sti.edu.ph"
                                        value={forgotEmail}
                                        onChange={e => setForgotEmail(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {forgotError && (
                                <div className="login-error slide-up">
                                    <span>{forgotError}</span>
                                </div>
                            )}

                            <button type="submit" className="btn btn-primary login-submit" disabled={forgotLoading}>
                                {forgotLoading ? (
                                    <><Loader2 size={18} className="spin" /> Sending...</>
                                ) : (
                                    'Send Reset Link'
                                )}
                            </button>

                            <button
                                type="button"
                                className="login-forgot-link"
                                onClick={() => { setShowForgot(false); setForgotError(null); }}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 13, marginTop: 4, textAlign: 'center' }}
                            >
                                <ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Back to Login
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <div className="login-bg-pattern" />
            <div className="login-container fade-in">
                <div className="login-logo-section">
                    <div className="login-logo">
                        <img src={theme === 'light' ? '/logo-with-text.png' : '/logo-white-with-text.png'} alt="OptiSched" width={192} height={192} style={{ objectFit: 'contain' }} />
                    </div>
                    <p className="login-subtitle">
                        Smart Scheduling, Simple Solutions
                    </p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="login-field">
                        <label className="login-label" htmlFor="login-email">INSTITUTIONAL EMAIL</label>
                        <div className="login-input-wrapper">
                            <Mail size={18} className="login-input-icon" />
                            <input
                                id="login-email"
                                className="input"
                                type="email"
                                placeholder="student@meycauayan.sti.edu.ph"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                autoComplete="email"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="login-field">
                        <label className="login-label" htmlFor="login-password">PASSWORD</label>
                        <div className="login-input-wrapper">
                            <Lock size={18} className="login-input-icon" />
                            <input
                                id="login-password"
                                className="input"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                            <button
                                type="button"
                                className="login-eye-btn"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right', marginTop: -8 }}>
                        <button
                            type="button"
                            onClick={() => setShowForgot(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                        >
                            Forgot password?
                        </button>
                    </div>

                    {error && (
                        <div className="login-error slide-up">
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary login-submit"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={18} className="spin" />
                                Signing In...
                            </>
                        ) : (
                            'Get Started'
                        )}
                    </button>
                </form>

                <p className="login-footer">
                    New to OptiSched?
                    <br />
                    <span>Contact the administrator for access.</span>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;



