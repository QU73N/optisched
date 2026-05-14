import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
    Lock, Mail, Eye, EyeOff, Loader2, ArrowLeft, ArrowRight,
    Shield, Users, Zap, GitBranch, Bell, MessageSquare,
    Sparkles, Layers, X, Sun, Moon, Pause,
    BookOpen, Gauge, TrendingUp, AlertCircle,
    FileCheck, ShieldCheck, UserCog, Send, Smartphone,
    Clock, Scale, KeyRound, Workflow, Check,
    FolderTree, Building2, ArrowUp, Facebook, Linkedin, Twitter,
    Instagram, Youtube, Phone, MapPin, Globe,
} from 'lucide-react';
import { AuroraBackground } from '@/components/ui/aurora-background';
import FloatingOptiBot from '../components/FloatingOptiBot';
import './LandingPage.css';

/* ============================================================
   useReveal - IntersectionObserver scroll reveal
   ============================================================ */
const useReveal = (animationsEnabled: boolean) => {
    useEffect(() => {
        const selector = '.reveal, .reveal-stage, .reveal-left, .reveal-right';
        const els = document.querySelectorAll<HTMLElement>(selector);

        if (!animationsEnabled || !('IntersectionObserver' in window) || els.length === 0) {
            els.forEach(el => el.classList.add('in-view'));
            return;
        }

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        e.target.classList.add('in-view');
                        io.unobserve(e.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
        );
        els.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, [animationsEnabled]);
};

/* ============================================================
   Theme toggle (local to landing page)
   ============================================================ */
const useTheme = () => {
    const [theme, setTheme] = useState<string>(() =>
        (typeof window !== 'undefined' && localStorage.getItem('optisched-theme')) || 'light'
    );

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('optisched-theme', theme);
    }, [theme]);

    const toggle = useCallback(() => {
        document.documentElement.setAttribute('data-transitioning-theme', '');
        setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
        setTimeout(() => {
            document.documentElement.removeAttribute('data-transitioning-theme');
        }, 450);
    }, []);

    return { theme, toggle };
};

/* ============================================================
   Animations toggle (for low-end devices)
   ============================================================ */
const useAnimations = () => {
    const [animationsEnabled, setAnimationsEnabled] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        const stored = localStorage.getItem('optisched-animations');
        return stored === null ? true : stored === 'true';
    });

    useEffect(() => {
        localStorage.setItem('optisched-animations', String(animationsEnabled));
        // Set a data attribute on body for CSS-based animation control
        document.body.setAttribute('data-animations', animationsEnabled ? 'on' : 'off');
    }, [animationsEnabled]);

    const toggle = useCallback(() => {
        setAnimationsEnabled((prev) => !prev);
    }, []);

    return { animationsEnabled, toggle };
};

/* ============================================================
   BrandMark, theme aware logo
   ============================================================ */
const BrandMark: React.FC<{ theme: string; size?: number; className?: string }> = ({
    theme, size = 32, className = 'lp-brand-logo',
}) => (
    <img
        className={className}
        src={theme === 'light' ? '/logo.png' : '/logo-white.png'}
        alt="OptiSched"
        width={size}
        height={size}
        draggable={false}
    />
);

/* ============================================================
   Login Modal
   ============================================================ */
interface LoginModalProps {
    open: boolean;
    onClose: () => void;
    theme: string;
}

const LoginModal: React.FC<LoginModalProps> = ({ open, onClose, theme }) => {
    const { signIn } = useAuth();
    const modalRef = useRef<HTMLDivElement>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);
    const [forgotMode, setForgotMode] = useState<'admin_request' | 'email_link'>('admin_request');
    const [forgotError, setForgotError] = useState<string | null>(null);

    // Focus trap for accessibility
    useFocusTrap(open, modalRef);

    // ESC to close + scroll lock
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    // Reset state when closed
    useEffect(() => {
        if (!open) {
            setTimeout(() => {
                setError(null);
                setShowForgot(false);
                setForgotSent(false);
                setForgotEmail('');
                setForgotError(null);
            }, 250);
        }
    }, [open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) { setError('Please fill in all fields'); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
        setError(null);
        setIsLoading(true);
        const result = await signIn(email, password);
        if (result.error) setError(result.error);
        setIsLoading(false);
    };

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        const normalizedEmail = forgotEmail.trim().toLowerCase();
        if (!normalizedEmail) { setForgotError('Please enter your email'); return; }
        setForgotError(null);
        setForgotLoading(true);
        try {
            const { error } = await supabase.from('password_reset_requests').insert({
                email: normalizedEmail,
                status: 'pending',
            });

            if (!error) {
                setForgotSent(true);
                setForgotMode('admin_request');
                setForgotEmail(normalizedEmail);
            } else {
                const isRlsError = /row-level security|permission denied|violates/i.test(error.message || '');
                if (!isRlsError) {
                    setForgotError(error.message);
                } else {
                    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
                        redirectTo: `${window.location.origin}/login`,
                    });
                    if (resetError) {
                        setForgotError(resetError.message);
                    } else {
                        setForgotSent(true);
                        setForgotMode('email_link');
                        setForgotEmail(normalizedEmail);
                    }
                }
            }
        } catch (err) {
            setForgotError((err as Error)?.message || 'Failed to send reset request');
        }
        setForgotLoading(false);
    };

    if (!open) return null;

    return (
        <div className="lp-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div ref={modalRef} className="lp-modal" role="dialog" aria-modal="true" aria-labelledby="lp-modal-title">
                <button className="lp-modal-close" onClick={onClose} aria-label="Close login">
                    <X size={18} />
                </button>

                <div className="lp-modal-head">
                    <div className="lp-modal-logo">
                        <BrandMark theme={theme} size={56} className="lp-modal-logo-img" />
                    </div>
                    <h2 id="lp-modal-title" className="lp-modal-title">
                        {showForgot ? 'Reset password' : 'Sign in to OptiSched'}
                    </h2>
                    <p className="lp-modal-sub">
                        {showForgot
                            ? 'Enter your institutional email and we will send your reset request to admin.'
                            : 'Use your institutional credentials to reach your dashboard.'}
                    </p>
                </div>

                {showForgot ? (
                    forgotSent ? (
                        <div className="lp-form-success">
                            <div className="lp-form-success-icon">
                                <Mail size={26} />
                            </div>
                            <h4>{forgotMode === 'admin_request' ? 'Request sent' : 'Check your email'}</h4>
                            <p>
                                {forgotMode === 'admin_request' ? 'Your reset request was sent for' : "We've sent a password reset link to"}<br />
                                <strong>{forgotEmail}</strong>
                            </p>
                            <button
                                className="lp-btn lp-btn-primary lp-form-submit"
                                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
                            >
                                <ArrowLeft size={16} /> Back to sign in
                            </button>
                        </div>
                    ) : (
                        <form className="lp-form" onSubmit={handleForgot}>
                            <div className="lp-field">
                                <label className="lp-label" htmlFor="lp-forgot-email">Institutional Email</label>
                                <div className="lp-input-wrap">
                                    <Mail size={16} className="lp-input-icon" />
                                    <input
                                        id="lp-forgot-email"
                                        className="lp-input"
                                        type="email"
                                        placeholder="name@institution.edu"
                                        value={forgotEmail}
                                        onChange={(e) => setForgotEmail(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {forgotError && (
                                <div className="lp-form-error" role="alert" aria-live="polite">
                                    <AlertCircle size={15} />
                                    <span>{forgotError}</span>
                                </div>
                            )}

                            <button type="submit" className="lp-btn lp-btn-primary lp-form-submit" disabled={forgotLoading}>
                                {forgotLoading ? (
                                    <><Loader2 size={16} className="lp-spin" /> Sending…</>
                                ) : (
                                    <>Send reset request <ArrowRight size={16} /></>
                                )}
                            </button>

                            <button
                                type="button"
                                className="lp-link-btn"
                                onClick={() => { setShowForgot(false); setForgotError(null); }}
                                style={{ alignSelf: 'center', marginTop: 4 }}
                            >
                                <ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Back to sign in
                            </button>
                        </form>
                    )
                ) : (
                    <form className="lp-form" onSubmit={handleSubmit}>
                        <div className="lp-field">
                            <label className="lp-label" htmlFor="lp-email">Institutional Email</label>
                            <div className="lp-input-wrap">
                                <Mail size={16} className="lp-input-icon" />
                                <input
                                    id="lp-email"
                                    className="lp-input"
                                    type="email"
                                    placeholder="name@institution.edu"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="lp-field">
                            <label className="lp-label" htmlFor="lp-password">Password</label>
                            <div className="lp-input-wrap">
                                <Lock size={16} className="lp-input-icon" />
                                <input
                                    id="lp-password"
                                    className="lp-input"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="lp-input-eye"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="lp-form-row">
                            <button type="button" className="lp-link-btn" onClick={() => setShowForgot(true)}>
                                Forgot password?
                            </button>
                        </div>

                        {error && (
                            <div className="lp-form-error" role="alert" aria-live="polite">
                                <AlertCircle size={15} />
                                <span>{error}</span>
                            </div>
                        )}

                        <button type="submit" className="lp-btn lp-btn-primary lp-form-submit" disabled={isLoading}>
                            {isLoading ? (
                                <><Loader2 size={16} className="lp-spin" /> Signing in…</>
                            ) : (
                                <>Sign in to OptiSched <ArrowRight size={16} /></>
                            )}
                        </button>

                        <p className="lp-form-foot">
                            New to OptiSched?<br />
                            Contact your institution's administrator for access.
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
};

/* ============================================================
   Navigation
   ============================================================ */
interface NavProps {
    onLogin: () => void;
    theme: 'dark' | 'light';
    onToggleTheme: () => void;
    animationsEnabled: boolean;
    onToggleAnimations: () => void;
    activeView: 'landing' | 'pricing';
    onSwitchToLanding: (sectionId?: string) => void;
    onSwitchToPricing: () => void;
}

const Navigation: React.FC<NavProps> = ({ onLogin, theme, onToggleTheme, animationsEnabled, onToggleAnimations, activeView, onSwitchToLanding, onSwitchToPricing }) => {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
            <div className="lp-nav-inner">
                <a className="lp-brand" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                    <BrandMark theme={theme} size={34} />
                    <span className="lp-brand-word">OptiSched</span>
                </a>

                <div className="lp-nav-links">
                    <button className="lp-nav-link" onClick={() => onSwitchToLanding()}>Features</button>
                    <button className="lp-nav-link" onClick={() => onSwitchToLanding('workflow')}>Workflow</button>
                    <button className="lp-nav-link" onClick={() => onSwitchToLanding('roles')}>Roles</button>
                    <button className="lp-nav-link" onClick={() => onSwitchToLanding('security')}>Security</button>
                    <button className={`lp-nav-link ${activeView === 'pricing' ? 'lp-nav-link-active' : ''}`} onClick={onSwitchToPricing}>Pricing</button>
                </div>

                <div className="lp-nav-right">
                    <button
                        className="lp-theme-btn"
                        onClick={onToggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <button
                        className="lp-theme-btn"
                        onClick={onToggleAnimations}
                        title={animationsEnabled ? 'Disable animations (for low-end devices)' : 'Enable animations'}
                        aria-label="Toggle animations"
                    >
                        {animationsEnabled ? <Sparkles size={16} /> : <Pause size={16} />}
                    </button>
                    <button className="lp-btn lp-btn-primary lp-btn-sm" onClick={onLogin}>
                        Sign in <ArrowRight size={14} />
                    </button>
                </div>
            </div>
        </nav>
    );
};

/* ============================================================
   Hero Visual, Command Center Composition
   ============================================================ */
type Tone = 'navy' | 'blue' | 'sky' | 'teal';
type Slot = { subject: string; room: string; tone: Tone; span?: 2 } | null;

const HeroVisual: React.FC = () => {
    const ref = useRef<HTMLDivElement>(null);

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const py = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        el.style.setProperty('--px', px.toFixed(3));
        el.style.setProperty('--py', py.toFixed(3));
    };

    const onLeave = () => {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty('--px', '0');
        el.style.setProperty('--py', '0');
    };

    const row8: Slot[] = [
        { subject: 'Calculus', room: 'Room 302', tone: 'navy' },
        null,
        { subject: 'Physics', room: 'Lab 1', tone: 'blue' },
        null,
        { subject: 'English', room: 'Room 204', tone: 'sky' },
    ];
    const row930: Slot[] = [
        { subject: 'Chemistry', room: 'Lab 2', tone: 'blue', span: 2 },
        { subject: 'Calculus', room: 'Room 302', tone: 'navy' },
        { subject: 'History', room: 'Room 207', tone: 'sky' },
        { subject: 'Programming', room: 'Room 108', tone: 'teal' },
        { subject: 'Literature', room: 'Room 211', tone: 'sky' },
    ];
    // Monday 11:00 is occupied by the span-2 Chemistry above
    const row11: Slot[] = [
        null,
        null,
        { subject: 'Calculus', room: 'Room 302', tone: 'navy' },
        { subject: 'Physics', room: 'Lab 1', tone: 'blue' },
    ];
    const row13: Slot[] = [
        null,
        { subject: 'Programming', room: 'Room 108', tone: 'teal' },
        { subject: 'History', room: 'Room 207', tone: 'sky' },
        null,
        { subject: 'Chemistry', room: 'Lab 2', tone: 'blue' },
    ];
    const row1430: Slot[] = [
        { subject: 'Statistics', room: 'Room 305', tone: 'navy' },
        { subject: 'English', room: 'Room 204', tone: 'sky' },
        null,
        { subject: 'Statistics', room: 'Room 305', tone: 'navy' },
        null,
    ];

    const renderSlot = (s: Slot, key: string, delay: number) => {
        if (!s) return <span key={key} className="lp-hero-slot" />;
        const cls = `lp-hero-slot filled c-${s.tone}${s.span === 2 ? ' span-2' : ''}`;
        return (
            <span key={key} className={cls} style={{ animationDelay: `${delay}ms` }}>
                <span className="lp-slot-subject">{s.subject}</span>
                <span className="lp-slot-room">{s.room}</span>
            </span>
        );
    };

    return (
        <div
            className="lp-hero-visual"
            ref={ref}
            onMouseMove={onMove}
            onMouseLeave={onLeave}
            aria-hidden="true"
        >
            <div className="lp-hero-glow" />

            {/* Main schedule panel */}
            <div className="lp-hero-card lp-hero-main">
                <div className="lp-hero-main-head">
                    <div>
                        <div className="lp-hero-main-title">Grade 12, STEM A</div>
                        <div className="lp-hero-main-sub">Week of Oct 14 · 34 sessions</div>
                    </div>
                </div>

                <div className="lp-hero-grid">
                    <span />
                    <span className="lp-hero-grid-head">MON</span>
                    <span className="lp-hero-grid-head">TUE</span>
                    <span className="lp-hero-grid-head">WED</span>
                    <span className="lp-hero-grid-head">THU</span>
                    <span className="lp-hero-grid-head">FRI</span>

                    <span className="lp-hero-grid-time">8:00</span>
                    {row8.map((s, i) => renderSlot(s, `r8-${i}`, 80 + i * 55))}

                    <span className="lp-hero-grid-time">9:30</span>
                    {row930.map((s, i) => renderSlot(s, `r930-${i}`, 360 + i * 55))}

                    <span className="lp-hero-grid-time">11:00</span>
                    {row11.map((s, i) => renderSlot(s, `r11-${i}`, 640 + i * 55))}

                    <span className="lp-hero-grid-time">13:00</span>
                    {row13.map((s, i) => renderSlot(s, `r13-${i}`, 880 + i * 55))}

                    <span className="lp-hero-grid-time">14:30</span>
                    {row1430.map((s, i) => renderSlot(s, `r1430-${i}`, 1120 + i * 55))}
                </div>
            </div>

            {/* Floating stat card */}
            <div className="lp-hero-card lp-hero-stat">
                <div className="lp-hero-stat-label">Optimization</div>
                <div className="lp-hero-stat-value">
                    98<span className="lp-hero-stat-unit">%</span>
                </div>
                <div className="lp-hero-stat-trend">
                    <TrendingUp size={11} /> 0 conflicts
                </div>
                <div className="lp-hero-stat-bars">
                    {[40, 70, 55, 82, 95, 68, 88, 72].map((h, i) => (
                        <div
                            key={i}
                            className="lp-hero-stat-bar"
                            style={{
                                ['--h' as string]: `${h}%`,
                                animationDelay: `${1300 + i * 70}ms`,
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Floating approval badge */}
            <div className="lp-hero-card lp-hero-badge">
                <div className="lp-hero-badge-icon">
                    <ShieldCheck size={16} />
                </div>
                <div className="lp-hero-badge-copy">
                    <h5>Approved</h5>
                    <p>by M. Santos, 2 min ago</p>
                </div>
            </div>

            {/* Floating pill, section summary */}
            <div className="lp-hero-pill">
                <span className="lp-hero-pill-dot" />
                32 sections scheduled
            </div>
        </div>
    );
};

/* ============================================================
   Hero Section
   ============================================================ */
const HeroSection: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
    <section className="lp-hero landing-container" id="top">
        <div className="lp-hero-inner">
            <div className="lp-hero-copy">
                <h1 className="lp-hero-title reveal">
                    Smart Scheduling,<br />
                    <span className="lp-grad">Simple Solutions</span>
                </h1>
                <p className="lp-hero-sub reveal delay-1">
                    OptiSched generates conflict free weekly schedules, respects every hard
                    constraint, and routes approvals through the right hands. Your institution
                    runs on structure, not spreadsheets.
                </p>
                <div className="lp-hero-cta reveal delay-2">
                    <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={onLogin}>
                        Sign in to dashboard <ArrowRight size={16} />
                    </button>
                    <button className="lp-btn lp-btn-secondary lp-btn-lg" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        Explore the platform
                    </button>
                </div>
            </div>

            <div className="reveal-stage delay-2">
                <HeroVisual />
            </div>
        </div>
    </section>
);

/* ============================================================
   Trust strip
   ============================================================ */
const TrustStrip: React.FC = () => (
    <section className="lp-trust landing-container">
        <div className="lp-trust-row">
            <span className="lp-trust-pill reveal"><Shield size={14} /> Secure Password Hashing</span>
            <span className="lp-trust-pill reveal delay-1"><Scale size={14} /> Hard and Soft Constraints</span>
            <span className="lp-trust-pill reveal delay-2"><FileCheck size={14} /> Versioned and Audited</span>
            <span className="lp-trust-pill reveal delay-3"><Workflow size={14} /> Role Based Dashboards</span>
            <span className="lp-trust-pill reveal delay-4"><Smartphone size={14} /> Cross-Platform Website and Mobile</span>
        </div>
    </section>
);

/* ============================================================
   Problem / Solution
   ============================================================ */
const ProblemSolution: React.FC = () => (
    <section className="lp-section landing-container">
        <div className="lp-section-head reveal">
            <span className="lp-section-label">The shift</span>
            <h2 className="lp-section-title">From spreadsheet chaos to structured intelligence.</h2>
            <p className="lp-section-sub">
                Scheduling is the most fragile part of an academic term. One change cascades into
                conflicts, overloaded faculty, and frustrated students. OptiSched is built to
                replace that fragility with a disciplined, collaborative system.
            </p>
        </div>

        <div className="lp-ps-grid">
            <div className="lp-ps-card problem reveal-left delay-1">
                <span className="lp-ps-tag">Before</span>
                <h3 className="lp-ps-title">Manual scheduling breaks quietly.</h3>
                <p className="lp-ps-intro">
                    Most institutions still stitch together timetables in shared spreadsheets,
                    and only discover the problems once the term has already started.
                </p>
                <ul className="lp-ps-list">
                    <li>
                        <span className="lp-ps-list-icon"><X size={11} /></span>
                        Teacher, room, and section conflicts discovered too late.
                    </li>
                    <li>
                        <span className="lp-ps-list-icon"><X size={11} /></span>
                        No single source of truth. Every edit risks overwriting another.
                    </li>
                    <li>
                        <span className="lp-ps-list-icon"><X size={11} /></span>
                        Overloaded faculty, underused special rooms, uneven workloads.
                    </li>
                    <li>
                        <span className="lp-ps-list-icon"><X size={11} /></span>
                        Approvals happen by email, with no audit trail.
                    </li>
                </ul>
            </div>

            <div className="lp-ps-card solution reveal-right delay-2">
                <span className="lp-ps-tag">With OptiSched</span>
                <h3 className="lp-ps-title">Structure that scales with your institution.</h3>
                <p className="lp-ps-intro">
                    A disciplined scheduling engine, a clear approval workflow, and role based
                    access, all working together from one source of truth.
                </p>
                <ul className="lp-ps-list">
                    <li>
                        <span className="lp-ps-list-icon"><Check size={12} /></span>
                        Conflict-free weekly schedules respecting every hard constraint.
                    </li>
                    <li>
                        <span className="lp-ps-list-icon"><Check size={12} /></span>
                        Full versioning. Compare, roll back, and review every edit.
                    </li>
                    <li>
                        <span className="lp-ps-list-icon"><Check size={12} /></span>
                        Faculty load calculated automatically against role-based limits.
                    </li>
                    <li>
                        <span className="lp-ps-list-icon"><Check size={12} /></span>
                        Draft, Submit, Approve, Publish. Every action logged along the way.
                    </li>
                </ul>
            </div>
        </div>
    </section>
);

/* ============================================================
   Bento Features
   ============================================================ */
const FeaturesBento: React.FC = () => (
    <section className="lp-section lp-section-alt" id="features">
        <div className="landing-container">
            <div className="lp-section-head reveal">
                <span className="lp-section-label">Platform</span>
                <h2 className="lp-section-title">Every piece of the schedule, under one roof.</h2>
                <p className="lp-section-sub">
                    A modular platform purpose-built for fixed block scheduling, with the intelligence
                    and governance institutions need.
                </p>
            </div>

            <div className="lp-bento" onMouseMove={(e) => {
                const target = e.target as HTMLElement;
                const card = target.closest('.lp-bento-card') as HTMLElement | null;
                if (!card) return;
                const rect = card.getBoundingClientRect();
                card.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
                card.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
            }}>
                {/* Tile 1 - wide: Schedule generation */}
                <div className="lp-bento-card lp-b-wide reveal">
                    <div className="lp-bento-icon"><Sparkles size={20} /></div>
                    <h3 className="lp-bento-title">Conflict-free schedule generation</h3>
                    <p className="lp-bento-desc">
                        A constraint driven engine produces weekly schedules that respect teacher
                        availability, room capacity, section overlap, qualifications, and block
                        structure, with partial regeneration for targeted changes.
                    </p>
                    <div className="lp-bento-visual">
                        <div className="lp-bento-pills">
                            <span className="lp-bento-pill hard">Fixed blocks</span>
                            <span className="lp-bento-pill hard">Split sessions</span>
                            <span className="lp-bento-pill">Custom breaks</span>
                            <span className="lp-bento-pill">Priority weighting</span>
                            <span className="lp-bento-pill">Partial regen</span>
                        </div>
                    </div>
                </div>

                {/* Tile 2 - third: Approval workflow */}
                <div className="lp-bento-card lp-b-third reveal delay-1">
                    <div className="lp-bento-icon"><FileCheck size={20} /></div>
                    <h3 className="lp-bento-title">Approval workflow</h3>
                    <p className="lp-bento-desc">
                        Draft, Submit, Approve, Publish. Every transition is logged, and nothing
                        reaches users until an administrator signs off.
                    </p>
                </div>

                {/* Tile 3 - half: Constraints */}
                <div className="lp-bento-card lp-b-half reveal delay-2">
                    <div className="lp-bento-icon"><Scale size={20} /></div>
                    <h3 className="lp-bento-title">Hard &amp; soft constraints</h3>
                    <p className="lp-bento-desc">
                        Hard constraints are enforced; soft constraints are optimized. Configure weights
                        to match your institution&apos;s priorities.
                    </p>
                    <div className="lp-bento-visual">
                        <div className="lp-bento-minigrid">
                            <div className="lp-bento-stat">
                                <div className="lp-bento-stat-value">17</div>
                                <div className="lp-bento-stat-label">Hard rules</div>
                            </div>
                            <div className="lp-bento-stat">
                                <div className="lp-bento-stat-value">17</div>
                                <div className="lp-bento-stat-label">Soft goals</div>
                            </div>
                            <div className="lp-bento-stat">
                                <div className="lp-bento-stat-value">0</div>
                                <div className="lp-bento-stat-label">Conflicts</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tile 4 - half: Faculty workload */}
                <div className="lp-bento-card lp-b-half reveal delay-3">
                    <div className="lp-bento-icon"><Gauge size={20} /></div>
                    <h3 className="lp-bento-title">Faculty load, automatically balanced</h3>
                    <p className="lp-bento-desc">
                        Role based limits on daily hours, weekly hours, and consecutive sessions,
                        with deloading rules for teachers who also administer.
                    </p>
                    <div className="lp-bento-visual">
                        <div className="lp-bento-mini">
                            {['f','f','','','','','g','g','','','','h','','','',''].map((c, i) => (
                                <div key={i} className={`lp-bento-mini-cell ${c}`} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tile 5 - third: AI assistant */}
                <div className="lp-bento-card lp-b-third reveal delay-1">
                    <div className="lp-bento-icon"><MessageSquare size={20} /></div>
                    <h3 className="lp-bento-title">AI schedule assistant</h3>
                    <p className="lp-bento-desc">
                        A provider agnostic AI layer that answers schedule questions for teachers
                        and students, and helps managers with natural language data entry.
                    </p>
                </div>

                {/* Tile 6 - third: Versioning */}
                <div className="lp-bento-card lp-b-third reveal delay-2">
                    <div className="lp-bento-icon"><GitBranch size={20} /></div>
                    <h3 className="lp-bento-title">Versioning &amp; rollback</h3>
                    <p className="lp-bento-desc">
                        Compare versions side-by-side, roll back in one click, and review the full
                        edit history of every schedule.
                    </p>
                    <div className="lp-bento-visual">
                        <div className="lp-bento-versions">
                            <div className="lp-bento-version current">
                                <span className="lp-bento-version-dot" />
                                <span className="lp-bento-version-label">v2.4</span>
                                <span className="lp-bento-version-meta">current</span>
                            </div>
                            <div className="lp-bento-version">
                                <span className="lp-bento-version-dot" />
                                <span className="lp-bento-version-label">v2.3</span>
                                <span className="lp-bento-version-meta">2d ago</span>
                            </div>
                            <div className="lp-bento-version">
                                <span className="lp-bento-version-dot" />
                                <span className="lp-bento-version-label">v2.2</span>
                                <span className="lp-bento-version-meta">5d ago</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tile 7 - third: Collaboration */}
                <div className="lp-bento-card lp-b-third reveal delay-3">
                    <div className="lp-bento-icon"><Users size={20} /></div>
                    <h3 className="lp-bento-title">Built for coordination</h3>
                    <p className="lp-bento-desc">
                        Schedule managers share teachers, rooms, subjects, and sections. Public
                        for reuse, private for sensitive work.
                    </p>
                </div>

                {/* Tile 8 - third: Notifications */}
                <div className="lp-bento-card lp-b-third reveal delay-4">
                    <div className="lp-bento-icon"><Bell size={20} /></div>
                    <h3 className="lp-bento-title">Targeted notifications</h3>
                    <p className="lp-bento-desc">
                        Teachers and students are notified only about schedules that actually
                        affect them. Available on the cross-platform website and mobile.
                    </p>
                </div>

                {/* Tile 9 - third: Section hierarchy */}
                <div className="lp-bento-card lp-b-third reveal delay-5">
                    <div className="lp-bento-icon"><FolderTree size={20} /></div>
                    <h3 className="lp-bento-title">Section hierarchy</h3>
                    <p className="lp-bento-desc">
                        Folder-style grouping with configurable weights for Senior High and College.
                        Prioritize critical programs during schedule generation.
                    </p>
                </div>

                {/* Tile 10 - third: Special rooms */}
                <div className="lp-bento-card lp-b-third reveal delay-6">
                    <div className="lp-bento-icon"><Building2 size={20} /></div>
                    <h3 className="lp-bento-title">Special room priority</h3>
                    <p className="lp-bento-desc">
                        Special subjects get priority access to specialized rooms while maintaining
                        flexibility for general use when capacity allows.
                    </p>
                </div>
            </div>
        </div>
    </section>
);

/* ============================================================
   Workflow
   ============================================================ */
const WorkflowSection: React.FC = () => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el || !('IntersectionObserver' in window)) return;
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((e) => {
                    if (e.isIntersecting) {
                        el.classList.add('in-view');
                        io.disconnect();
                    }
                });
            },
            { threshold: 0.4 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    const steps = [
        { icon: <KeyRound size={22} />, title: 'Sign in & detect role', desc: 'Single sign-on routes each user to their dashboard based on role.' },
        { icon: <Layers size={22} />, title: 'Managers build data', desc: 'Teachers, subjects, rooms, sections, and hierarchies, all in one place.' },
        { icon: <Sparkles size={22} />, title: 'Generate & review', desc: 'The engine produces a draft, managers refine it and resolve soft issues.' },
        { icon: <Send size={22} />, title: 'Approve & publish', desc: 'Administrators sign off; users receive their schedules, notifications sent.' },
    ];

    return (
        <section className="lp-section landing-container" id="workflow">
            <div className="lp-section-head reveal">
                <span className="lp-section-label">How it works</span>
                <h2 className="lp-section-title">A controlled path from draft to delivery.</h2>
                <p className="lp-section-sub">
                    OptiSched is not one big button. It is a governed flow, with clear handoffs,
                    checkpoints, and an audit trail at every step.
                </p>
            </div>

            <div className="lp-workflow" ref={ref}>
                <div className="lp-workflow-track">
                    <div className="lp-workflow-line" />
                    {steps.map((s, i) => (
                        <div key={i} className={`lp-workflow-step reveal delay-${i + 1}`}>
                            <div className="lp-workflow-node" data-step={i + 1}>{s.icon}</div>
                            <h4 className="lp-workflow-title">{s.title}</h4>
                            <p className="lp-workflow-desc">{s.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

/* ============================================================
   Roles
   ============================================================ */
const RolesSection: React.FC = () => {
    const roles = [
        {
            tag: 'Tier 1',
            name: 'Power Admin',
            desc: 'Emergency-only authority reserved for recovery and critical overrides.',
            icon: <ShieldCheck size={20} />,
            c1: '#0f2854', c2: '#1c4d8d',
            caps: [
                { label: 'System-wide override', ok: true },
                { label: 'Full audit log access', ok: true },
                { label: 'Recovery & emergency', ok: true },
            ],
        },
        {
            tag: 'Tier 2',
            name: 'Administrator',
            desc: 'Approval authority that reviews, edits, and signs off on every schedule.',
            icon: <UserCog size={20} />,
            c1: '#1c4d8d', c2: '#2f67aa',
            caps: [
                { label: 'Approve & publish', ok: true },
                { label: 'Lock / unlock versions', ok: true },
                { label: 'Review manager work', ok: true },
            ],
        },
        {
            tag: 'Tier 3',
            name: 'Schedule Manager',
            desc: 'Builds the schedule: data, generation, manual edits, and submission.',
            icon: <Workflow size={20} />,
            c1: '#2f67aa', c2: '#4988c4',
            caps: [
                { label: 'Create & edit data', ok: true },
                { label: 'Generate schedules', ok: true },
                { label: 'Collaborate & share', ok: true },
            ],
        },
        {
            tag: 'Tier 4',
            name: 'Teachers & Students',
            desc: 'View-only access to their own schedules, with notifications on changes.',
            icon: <BookOpen size={20} />,
            c1: '#4988c4', c2: '#7fb0db',
            caps: [
                { label: 'Personal schedule', ok: true },
                { label: 'Targeted notifications', ok: true },
                { label: 'AI schedule assistant', ok: true },
            ],
        },
    ];

    return (
        <section className="lp-section lp-section-alt" id="roles">
            <div className="landing-container">
                <div className="lp-section-head reveal">
                    <span className="lp-section-label">Governance</span>
                    <h2 className="lp-section-title">A clear hierarchy, by design.</h2>
                    <p className="lp-section-sub">
                        Four roles, four sets of responsibilities. Every dashboard exposes only
                        what its role is allowed to do, so there is no accidental overreach.
                    </p>
                </div>

                <div className="lp-roles">
                    {roles.map((r, i) => (
                        <div
                            key={r.name}
                            className={`lp-role-card reveal delay-${i + 1}`}
                            style={{ ['--role-c1' as string]: r.c1, ['--role-c2' as string]: r.c2 }}
                        >
                            <div className="lp-role-icon">{r.icon}</div>
                            <div className="lp-role-tag">{r.tag}</div>
                            <h3 className="lp-role-title">{r.name}</h3>
                            <p className="lp-role-desc">{r.desc}</p>
                            <div className="lp-role-caps">
                                {r.caps.map((c) => (
                                    <div key={c.label} className="lp-role-cap">
                                        <Check size={14} />
                                        <span>{c.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

/* ============================================================
   Security
   ============================================================ */
const SecuritySection: React.FC = () => (
    <section className="lp-section landing-container" id="security">
        <div className="lp-section-head reveal">
            <span className="lp-section-label">Security &amp; trust</span>
            <h2 className="lp-section-title">Built for institutional stakes.</h2>
            <p className="lp-section-sub">
                Every part of OptiSched assumes a real institution is running on it. Security,
                separation of duties, and auditability are foundational, not afterthoughts.
            </p>
        </div>

        <div className="lp-security-grid">
            <div className="lp-security-visual reveal-stage" aria-hidden="true">
                <svg className="lp-security-graphic" viewBox="0 0 7593.75 7593.75" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="dashboardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--lp-surface)"/>
                            <stop offset="100%" stopColor="var(--lp-surface-2)"/>
                        </linearGradient>
                        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--lp-surface-2)" stopOpacity="0.5"/>
                            <stop offset="100%" stopColor="var(--lp-surface)" stopOpacity="0.3"/>
                        </linearGradient>
                        <radialGradient id="iconGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="var(--lp-accent)" stopOpacity="0.2"/>
                            <stop offset="100%" stopColor="var(--lp-accent)" stopOpacity="0"/>
                        </radialGradient>
                    </defs>
                    
                    {/* Dashboard window frame */}
                    <rect x="683.4375" y="1025.15625" width="5467.5" height="4442.34375" rx="136.6875" fill="url(#dashboardGrad)" stroke="var(--lp-border-strong)" strokeWidth="25.62890625"/>
                    
                    {/* Window header */}
                    <rect x="683.4375" y="1025.15625" width="5467.5" height="546.75" rx="136.6875" fill="var(--lp-surface-2)" opacity="0.5"/>
                    <rect x="683.4375" y="1435.21875" width="5467.5" height="136.6875" fill="var(--lp-surface-2)" opacity="0.5"/>
                    
                    {/* Window dots */}
                    <circle cx="990.984375" cy="1298.53125" r="68.34375" fill="#ef4444"/>
                    <circle cx="1264.359375" cy="1298.53125" r="68.34375" fill="#f59e0b"/>
                    <circle cx="1537.734375" cy="1298.53125" r="68.34375" fill="#22c55e"/>
                    
                    {/* Sidebar */}
                    <rect x="683.4375" y="1708.59375" width="1025.15625" height="3758.90625" fill="var(--lp-surface)" opacity="0.3"/>
                    
                    {/* Sidebar items */}
                    <rect x="820.125" y="1964.8828125" width="751.78125" height="136.6875" rx="34.171875" fill="var(--lp-accent)" opacity="0.6"/>
                    <rect x="820.125" y="2306.6015625" width="615.09375" height="102.515625" rx="25.62890625" fill="var(--lp-border-strong)" opacity="0.4"/>
                    <rect x="820.125" y="2562.890625" width="683.4375" height="102.515625" rx="25.62890625" fill="var(--lp-border-strong)" opacity="0.4"/>
                    <rect x="820.125" y="2819.1796875" width="546.75" height="102.515625" rx="25.62890625" fill="var(--lp-border-strong)" opacity="0.4"/>
                    
                    {/* Main content area */}
                    {/* Stat cards row */}
                    <rect x="1913.625" y="1964.8828125" width="1196.015625" height="854.296875" rx="68.34375" fill="url(#cardGrad)" stroke="var(--lp-border-strong)" strokeWidth="17.0859375"/>
                    <rect x="2050.3125" y="2135.7421875" width="341.71875" height="341.71875" rx="68.34375" fill="var(--lp-accent-soft)"/>
                    <rect x="2050.3125" y="2562.890625" width="512.578125" height="68.34375" rx="17.0859375" fill="var(--lp-ink)" opacity="0.6"/>
                    <rect x="2050.3125" y="2682.4921875" width="341.71875" height="51.2578125" rx="12.814453125" fill="var(--lp-ink-dim)" opacity="0.4"/>
                    
                    <rect x="3280.5" y="1964.8828125" width="1196.015625" height="854.296875" rx="68.34375" fill="url(#cardGrad)" stroke="var(--lp-border-strong)" strokeWidth="17.0859375"/>
                    <rect x="3417.1875" y="2135.7421875" width="341.71875" height="341.71875" rx="68.34375" fill="var(--lp-accent-soft)"/>
                    <rect x="3417.1875" y="2562.890625" width="512.578125" height="68.34375" rx="17.0859375" fill="var(--lp-ink)" opacity="0.6"/>
                    <rect x="3417.1875" y="2682.4921875" width="341.71875" height="51.2578125" rx="12.814453125" fill="var(--lp-ink-dim)" opacity="0.4"/>
                    
                    <rect x="4647.375" y="1964.8828125" width="1196.015625" height="854.296875" rx="68.34375" fill="url(#cardGrad)" stroke="var(--lp-border-strong)" strokeWidth="17.0859375"/>
                    <rect x="4784.0625" y="2135.7421875" width="341.71875" height="341.71875" rx="68.34375" fill="var(--lp-accent-soft)"/>
                    <rect x="4784.0625" y="2562.890625" width="512.578125" height="68.34375" rx="17.0859375" fill="var(--lp-ink)" opacity="0.6"/>
                    <rect x="4784.0625" y="2682.4921875" width="341.71875" height="51.2578125" rx="12.814453125" fill="var(--lp-ink-dim)" opacity="0.4"/>
                    
                    {/* Chart area */}
                    <rect x="1913.625" y="2990.0390625" width="3929.765625" height="1366.875" rx="68.34375" fill="url(#cardGrad)" stroke="var(--lp-border-strong)" strokeWidth="17.0859375"/>
                    <rect x="2050.3125" y="3160.8984375" width="683.4375" height="68.34375" rx="17.0859375" fill="var(--lp-ink)" opacity="0.5"/>
                    {/* Chart bars */}
                    <rect x="2050.3125" y="3417.1875" width="205.03125" height="683.4375" rx="34.171875" fill="var(--lp-accent)" opacity="0.4"/>
                    <rect x="2357.859375" y="3588.046875" width="205.03125" height="512.578125" rx="34.171875" fill="var(--lp-accent)" opacity="0.5"/>
                    <rect x="2665.40625" y="3331.7578125" width="205.03125" height="768.8671875" rx="34.171875" fill="var(--lp-accent)" opacity="0.6"/>
                    <rect x="2972.953125" y="3502.6171875" width="205.03125" height="598.0078125" rx="34.171875" fill="var(--lp-accent)" opacity="0.5"/>
                    <rect x="3280.5" y="3246.328125" width="205.03125" height="854.296875" rx="34.171875" fill="var(--lp-accent)" opacity="0.7"/>
                    <rect x="3588.046875" y="3673.4765625" width="205.03125" height="427.1484375" rx="34.171875" fill="var(--lp-accent)" opacity="0.4"/>
                    <rect x="3895.59375" y="3417.1875" width="205.03125" height="683.4375" rx="34.171875" fill="var(--lp-accent)" opacity="0.5"/>
                    <rect x="4203.140625" y="3160.8984375" width="205.03125" height="939.7265625" rx="34.171875" fill="var(--lp-accent)" opacity="0.6"/>
                    <rect x="4510.6875" y="3331.7578125" width="205.03125" height="768.8671875" rx="34.171875" fill="var(--lp-accent)" opacity="0.5"/>
                    <rect x="4818.234375" y="3588.046875" width="205.03125" height="512.578125" rx="34.171875" fill="var(--lp-accent)" opacity="0.4"/>
                    <rect x="5125.78125" y="3502.6171875" width="205.03125" height="598.0078125" rx="34.171875" fill="var(--lp-accent)" opacity="0.5"/>
                    
                    {/* Table/list area */}
                    <rect x="1913.625" y="4527.7734375" width="3929.765625" height="939.7265625" rx="68.34375" fill="url(#cardGrad)" stroke="var(--lp-border-strong)" strokeWidth="17.0859375"/>
                    <rect x="2050.3125" y="4698.6328125" width="427.1484375" height="68.34375" rx="17.0859375" fill="var(--lp-ink)" opacity="0.5"/>
                    <rect x="2050.3125" y="4869.4921875" width="1366.875" height="51.2578125" rx="12.814453125" fill="var(--lp-ink-dim)" opacity="0.3"/>
                    <rect x="2050.3125" y="4989.09375" width="1025.15625" height="51.2578125" rx="12.814453125" fill="var(--lp-ink-dim)" opacity="0.3"/>
                    <rect x="2050.3125" y="5108.6953125" width="1196.015625" height="51.2578125" rx="12.814453125" fill="var(--lp-ink-dim)" opacity="0.3"/>
                    <rect x="2050.3125" y="5228.296875" width="854.296875" height="51.2578125" rx="12.814453125" fill="var(--lp-ink-dim)" opacity="0.3"/>
                    
                    {/* Security icon - bottom right, overlapping */}
                    <g className="lp-security-icon lp-security-icon-1">
                        <circle cx="6150.9375" cy="5325.78125" r="615.09375" fill="url(#iconGlow)"/>
                        <path d="M6150.9375 4984.0625 L6424.3125 5069.4921875 V5308.6953125 C6424.3125 5496.640625 6287.625 5610.546875 6150.9375 5686.484375 C6014.25 5610.546875 5877.5625 5496.640625 5877.5625 5308.6953125 V5069.4921875 L6150.9375 4984.0625Z" 
                              fill="var(--lp-surface)" stroke="var(--lp-accent)" strokeWidth="34.171875"/>
                        <path d="M6150.9375 5120.75 L6321.796875 5189.09375 V5308.6953125 C6321.796875 5405.515625 6253.453125 5496.640625 6150.9375 5530.8125 C6048.421875 5496.640625 5980.078125 5405.515625 5980.078125 5308.6953125 V5189.09375 L6150.9375 5120.75Z" 
                              fill="var(--lp-accent)" opacity="0.15"/>
                        <path d="M6014.25 5308.6953125 L6082.59375 5377.0390625 L6287.625 5172.0078125" stroke="var(--lp-accent)" strokeWidth="34.171875" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                </svg>
            </div>

            <div className="lp-security-list">
                <div className="lp-security-item reveal delay-1">
                    <div className="lp-security-item-icon"><KeyRound size={18} /></div>
                    <div>
                        <h4 className="lp-security-item-title">Argon2id password hashing</h4>
                        <p className="lp-security-item-desc">
                            Modern, memory hard password hashing. No client side secrets, no
                            plaintext storage.
                        </p>
                    </div>
                </div>

                <div className="lp-security-item reveal delay-2">
                    <div className="lp-security-item-icon"><Shield size={18} /></div>
                    <div>
                        <h4 className="lp-security-item-title">Server-enforced role access</h4>
                        <p className="lp-security-item-desc">
                            The frontend is never trusted for security decisions. Every privileged action
                            is checked on the backend.
                        </p>
                    </div>
                </div>

                <div className="lp-security-item reveal delay-3">
                    <div className="lp-security-item-icon"><FileCheck size={18} /></div>
                    <div>
                        <h4 className="lp-security-item-title">Immutable audit log</h4>
                        <p className="lp-security-item-desc">
                            Every schedule change, approval, and Power Admin override is recorded with
                            actor, target, and timestamp.
                        </p>
                    </div>
                </div>

                <div className="lp-security-item reveal delay-4">
                    <div className="lp-security-item-icon"><Zap size={18} /></div>
                    <div>
                        <h4 className="lp-security-item-title">AI with guardrails</h4>
                        <p className="lp-security-item-desc">
                            The AI layer can read context and draft actions, but it never bypasses
                            hard constraints or writes to the database without explicit permission
                            checks.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>
);

/* ============================================================
   Cross-platform
   ============================================================ */
const CrossPlatformSection: React.FC = () => (
    <section className="lp-section lp-section-alt">
        <div className="landing-container">
            <div className="lp-cross">
                <div className="lp-cross-copy reveal">
                    <span className="lp-section-label">Cross-platform</span>
                    <h3>One backend. Web today, mobile next.</h3>
                    <p>
                        OptiSched is API first. The same backend powers the web dashboards today
                        and the mobile app tomorrow, with no forked logic and no drift. Teachers
                        and students get clean, focused access wherever they are.
                    </p>

                    <div className="lp-cross-list">
                        <div className="lp-cross-item">
                            <span className="lp-cross-item-check"><Check size={13} /></span>
                            <span>Shared source of truth. Schedules never diverge between devices.</span>
                        </div>
                        <div className="lp-cross-item">
                            <span className="lp-cross-item-check"><Check size={13} /></span>
                            <span>Mobile focuses on viewing, notifications, and the AI assistant, never heavy generation.</span>
                        </div>
                        <div className="lp-cross-item">
                            <span className="lp-cross-item-check"><Check size={13} /></span>
                            <span>Offline-friendly architecture planned for teachers in low-connectivity rooms.</span>
                        </div>
                        <div className="lp-cross-item">
                            <span className="lp-cross-item-check"><Check size={13} /></span>
                            <span>Clean, modular deployments, ready to scale to multi branch or multi institution later.</span>
                        </div>
                    </div>
                </div>

                <div className="lp-cross-visual reveal-stage delay-2" aria-hidden="true">
                    <div className="lp-cross-web">
                        <div className="lp-cross-web-bar">
                            <div className="lp-cross-web-dot" />
                            <div className="lp-cross-web-dot" />
                            <div className="lp-cross-web-dot" />
                        </div>
                        <div className="lp-cross-web-content">
                            <div className="lp-cross-web-sidebar">
                                <div className="lp-cross-web-sideitem active" />
                                <div className="lp-cross-web-sideitem" />
                                <div className="lp-cross-web-sideitem" />
                                <div className="lp-cross-web-sideitem" />
                                <div className="lp-cross-web-sideitem" />
                                <div className="lp-cross-web-sideitem" />
                                <div className="lp-cross-web-sideitem" />
                            </div>
                            <div className="lp-cross-web-main">
                                {['f1','','f2','','','','f1','f3','f2','','','f3','','f1','','f2','','','f3','','','f1','','f2',''].map((c, i) => (
                                    <div key={i} className={`lp-cross-web-cell ${c}`} />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lp-cross-mobile">
                        <div className="lp-cross-mobile-head">
                            <div className="lp-cross-mobile-title" />
                            <div className="lp-cross-mobile-icon" />
                        </div>
                        <div className="lp-cross-mobile-card">
                            <div className="lp-cross-mobile-bar a" />
                            <div className="lp-cross-mobile-bar b" />
                        </div>
                        <div className="lp-cross-mobile-card">
                            <div className="lp-cross-mobile-bar c" />
                            <div className="lp-cross-mobile-bar b" />
                        </div>
                        <div className="lp-cross-mobile-card">
                            <div className="lp-cross-mobile-bar a" />
                            <div className="lp-cross-mobile-bar b" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
);

/* ============================================================
   Final CTA
   ============================================================ */
const FinalCTA: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
    <section className="lp-final landing-container" id="signin">
        <div className="lp-final-card reveal-stage">
            <span className="lp-final-eyebrow">
                <Clock size={13} /> Ready when you are
            </span>
            <h2 className="lp-final-title">
                Step into a calmer, more disciplined scheduling term.
            </h2>
            <p className="lp-final-sub">
                Sign in with your institutional credentials to reach your dashboard.
                Schedule managers, administrators, teachers, and students each land
                exactly where they need to be.
            </p>
            <div className="lp-final-actions">
                <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={onLogin}>
                    Sign in to dashboard <ArrowRight size={16} />
                </button>
                <a className="lp-btn lp-btn-secondary lp-btn-lg" href="#features">
                    Review the platform
                </a>
            </div>
        </div>
    </section>
);

/* ============================================================
   Pricing Section
   ============================================================ */
const PricingSection: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    const pricingData = [
        {
            tier: 'Standard',
            description: 'Essential scheduling infrastructure',
            price: 'PHP 24,900',
            period: 'one-time',
            features: [
                'Up to 50 teachers',
                'Up to 20 sections',
                'Basic conflict detection',
                'Schedule generation',
                'Standard reports',
                'Email support',
            ],
            popular: false,
        },
        {
            tier: 'Premium',
            description: 'Intelligent scheduling optimization',
            price: 'PHP 39,900',
            period: 'one-time',
            features: [
                'Up to 100 teachers',
                'Up to 50 sections',
                'Advanced conflict resolution',
                'AI-powered optimization',
                'Custom reports & analytics',
                'Priority email & chat support',
                'Partial regeneration mode',
                'Multi-institution support',
            ],
            popular: true,
        },
        {
            tier: 'Enterprise',
            description: 'Tailored for your institution',
            price: 'Custom Quote',
            period: 'contact sales',
            features: [
                'Unlimited teachers & sections',
                'White-label customization',
                'Dedicated account manager',
                'Custom integrations',
                'On-premise deployment option',
                '24/7 phone support',
                'SLA guarantee',
                'Training & onboarding',
            ],
            popular: false,
        },
    ];

    return (
        <section className="lp-section landing-container">
            <div className="lp-section-head">
                <h1 className="lp-section-title">Invest in Scheduling Excellence</h1>
                <p className="lp-section-sub">
                    Choose the tier that matches your institution's ambition.
                </p>
            </div>

            <div className="pricing-grid">
                {pricingData.map((plan) => (
                    <div
                        key={plan.tier}
                        className={`pricing-card ${plan.tier.toLowerCase()} ${plan.popular ? 'pricing-card-premium' : ''}`}
                    >
                        {plan.popular && (
                            <div className="pricing-popular-badge">
                                <Sparkles size={12} /> Most Popular
                            </div>
                        )}
                        <div className="pricing-card-header">
                            <div className={`pricing-tier-badge ${plan.tier.toLowerCase() === 'premium' ? 'pricing-tier-badge-premium' : plan.tier.toLowerCase() === 'enterprise' ? 'pricing-tier-badge-enterprise' : ''}`}>
                                {plan.tier}
                            </div>
                            <div className="pricing-tier-name">{plan.tier}</div>
                            <div className="pricing-tier-sub">{plan.description}</div>
                        </div>
                        <div className="pricing-tier-price">
                            <span className="pricing-currency">{plan.price === 'Custom Quote' ? '' : 'PHP'}</span>
                            <span className="pricing-amount">{plan.price === 'Custom Quote' ? 'Custom' : plan.price.replace('PHP ', '').replace(',', '')}</span>
                            {plan.price !== 'Custom Quote' && <span className="pricing-period">/{plan.period}</span>}
                        </div>
                        <div className="pricing-features">
                            <div className="pricing-features-include">Includes:</div>
                            {plan.features.map((feature, index) => (
                                <div key={index} className="pricing-feature">
                                    <Check className="pricing-feature-icon" size={16} />
                                    {feature}
                                </div>
                            ))}
                        </div>
                        <button
                            className={`lp-btn lp-btn-lg ${plan.popular ? 'lp-btn-primary' : 'lp-btn-secondary'}`}
                            onClick={plan.price === 'Custom Quote' ? () => window.location.href = 'mailto:sales@optisched.edu' : onLogin}
                        >
                            {plan.price === 'Custom Quote' ? 'Contact Sales' : 'Get Started'}
                            {plan.price !== 'Custom Quote' && <ArrowRight size={16} />}
                        </button>
                    </div>
                ))}
            </div>

            <div className="pricing-cta">
                <p style={{ fontSize: '14px', color: 'var(--lp-ink-soft)', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
                    All plans include lifetime updates, security patches, and access to our knowledge base.
                    <br />
                    Need help deciding? <a href="mailto:sales@optisched.edu" style={{ color: 'var(--lp-accent)' }}>Contact our sales team</a>.
                </p>
            </div>
        </section>
    );
};

/* ============================================================
   Footer
   ============================================================ */
interface FooterProps {
    onLogin: () => void;
    theme: 'dark' | 'light';
    activeView: 'landing' | 'pricing';
    onSwitchToLanding: (sectionId?: string) => void;
    onSwitchToPricing: () => void;
}

const Footer: React.FC<FooterProps> = ({ onLogin, theme, activeView, onSwitchToLanding, onSwitchToPricing }) => (
    <footer className="lp-footer">
        <div className="landing-container lp-footer-inner">
            <div className="lp-footer-top">
                <div className="lp-footer-about">
                    <div className="lp-brand">
                        <BrandMark theme={theme} size={34} />
                        <span className="lp-brand-word">OptiSched</span>
                    </div>
                    <p>
                        An academic scheduling platform for institutions with fixed block
                        schedules, role based access, approval workflows, and cross platform
                        delivery.
                    </p>
                    <div className="lp-footer-socials">
                        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                            <Facebook size={18} />
                        </a>
                        <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                            <Twitter size={18} />
                        </a>
                        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                            <Linkedin size={18} />
                        </a>
                        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                            <Instagram size={18} />
                        </a>
                        <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                            <Youtube size={18} />
                        </a>
                    </div>
                </div>

                <div className="lp-footer-col">
                    <h5>Platform</h5>
                    <button onClick={() => onSwitchToLanding()}>Features</button>
                    <button onClick={() => onSwitchToLanding('workflow')}>Workflow</button>
                    <button onClick={() => onSwitchToLanding('roles')}>Roles</button>
                    <button onClick={() => onSwitchToLanding('security')}>Security</button>
                    <button onClick={onSwitchToPricing} className={activeView === 'pricing' ? 'lp-footer-link-active' : ''}>Pricing</button>
                </div>

                <div className="lp-footer-col">
                    <h5>Access</h5>
                    <button onClick={onLogin}>Sign in</button>
                    <button onClick={onLogin}>Forgot password</button>
                    <a href="mailto:support@optisched.edu?subject=OptiSched Support Request" className="lp-footer-contact">
                        <Mail size={14} /> Contact support
                    </a>
                    <a href="mailto:admin@institution.edu" className="lp-footer-contact">
                        <UserCog size={14} /> Contact administrator
                    </a>
                </div>

                <div className="lp-footer-col">
                    <h5>Contact</h5>
                    <a href="mailto:info@optisched.edu" className="lp-footer-contact">
                        <Mail size={14} /> info@optisched.edu
                    </a>
                    <a href="tel:+1234567890" className="lp-footer-contact">
                        <Phone size={14} /> +1 (234) 567-890
                    </a>
                    <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="lp-footer-contact">
                        <MapPin size={14} /> 123 Academic Way, Campus City
                    </a>
                    <a href="https://optisched.edu" target="_blank" rel="noopener noreferrer" className="lp-footer-contact">
                        <Globe size={14} /> www.optisched.edu
                    </a>
                </div>

                <div className="lp-footer-col">
                    <h5>Institution</h5>
                    <a href="#top">Licensing model</a>
                    <a href="#security">Security posture</a>
                    <a href="#features">Deployment</a>
                    <a href="https://docs.optisched.edu" target="_blank" rel="noopener noreferrer">Documentation</a>
                    <a href="https://status.optisched.edu" target="_blank" rel="noopener noreferrer">System status</a>
                </div>

                <div className="lp-footer-col">
                    <h5>System Requirements</h5>
                    <span>Browser: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+</span>
                    <span>Screen: 1280×720 minimum (responsive)</span>
                    <span>RAM: 4GB recommended, 2GB minimum</span>
                    <span>Network: Stable internet connection</span>
                    <span>JavaScript: Enabled (ES2020+)</span>
                    <span>Animations: Optional (disable in settings)</span>
                </div>
            </div>

            <div className="lp-footer-bottom">
                <span>© {new Date().getFullYear()} OptiSched · Built for serious institutions.</span>
                <div className="lp-footer-trust">
                    <span><Shield size={13} /> Role-based access</span>
                    <span><FileCheck size={13} /> Audited</span>
                    <span><Scale size={13} /> Policy-aware</span>
                </div>
            </div>
        </div>
    </footer>
);

/* ============================================================
   Scroll To Top Button
   ============================================================ */
const ScrollToTop: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => {
            setVisible(window.scrollY > 400);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollToTop = useCallback(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    if (!visible) return null;

    return (
        <button
            className="lp-scroll-top"
            onClick={scrollToTop}
            aria-label="Scroll to top"
            title="Back to top"
        >
            <ArrowUp size={18} />
        </button>
    );
};

/* ============================================================
   LandingPage (root)
   ============================================================ */
const LandingPage: React.FC = () => {
    const { theme, toggle } = useTheme();
    const { animationsEnabled, toggle: toggleAnimations } = useAnimations();
    const [loginOpen, setLoginOpen] = useState(false);
    const [activeView, setActiveView] = useState<'landing' | 'pricing'>('landing');
    const [pendingScroll, setPendingScroll] = useState<string | null>(null);

    useReveal(animationsEnabled);

    // Scroll to top on refresh
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, []);

    const scrollTo = useCallback((id: string) => {
        const el = document.getElementById(id);
        if (!el) return;
        const navHeight = window.innerWidth <= 820 ? 60 : 68;
        const y = el.getBoundingClientRect().top + window.scrollY - navHeight - 8;
        window.scrollTo({ top: y, behavior: 'smooth' });
    }, []);

    // Scroll to pending section after view switch
    useEffect(() => {
        if (activeView === 'landing' && pendingScroll) {
            setTimeout(() => {
                scrollTo(pendingScroll);
                setPendingScroll(null);
            }, 400);
        }
    }, [activeView, pendingScroll, scrollTo]);

    const openLogin = useCallback(() => setLoginOpen(true), []);
    const closeLogin = useCallback(() => setLoginOpen(false), []);

    const handleSwitchToLanding = useCallback((sectionId?: string) => {
        // No animations for landing transition - switch immediately
        if (sectionId) {
            setPendingScroll(sectionId);
            setActiveView('landing');
        } else {
            setActiveView('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, []);

    const handleSwitchToPricing = useCallback(() => {
        // No animations for pricing transition - switch immediately
        setActiveView('pricing');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    return (
        <AuroraBackground className={`landing ${animationsEnabled ? 'animations-enabled' : ''}`} disabled={!animationsEnabled}>
            <div className="lp-grid-bg" aria-hidden="true" />
            <div className="lp-ambient" aria-hidden="true" />

            <div className="lp-page-content">
                <Navigation onLogin={openLogin} theme={theme as 'dark' | 'light'} onToggleTheme={toggle} animationsEnabled={animationsEnabled} onToggleAnimations={toggleAnimations} activeView={activeView} onSwitchToLanding={handleSwitchToLanding} onSwitchToPricing={handleSwitchToPricing} />

                <main className="lp-main-content">
                    <div className={`lp-view-container lp-view-${activeView}`}>
                        {/* Landing content */}
                        <div className={`lp-view-landing-content ${activeView === 'landing' ? 'lp-view-visible' : 'lp-view-hidden'}`}>
                            <HeroSection onLogin={openLogin} />
                            <TrustStrip />
                            <ProblemSolution />
                            <FeaturesBento />
                            <WorkflowSection />
                            <RolesSection />
                            <SecuritySection />
                            <CrossPlatformSection />
                            <FinalCTA onLogin={openLogin} />
                        </div>
                        {/* Pricing content */}
                        <div className={`lp-view-pricing-content ${activeView === 'pricing' ? 'lp-view-visible' : 'lp-view-hidden'}`}>
                            <PricingSection onLogin={openLogin} />
                        </div>
                    </div>
                </main>

                <Footer onLogin={openLogin} theme={theme as 'dark' | 'light'} activeView={activeView} onSwitchToLanding={handleSwitchToLanding} onSwitchToPricing={handleSwitchToPricing} />
            </div>

            <LoginModal open={loginOpen} onClose={closeLogin} theme={theme} />
            <ScrollToTop />
            <FloatingOptiBot />
        </AuroraBackground>
    );
};

export default LandingPage;
