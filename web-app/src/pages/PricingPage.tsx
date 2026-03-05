import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Zap, Crown, ArrowLeft } from 'lucide-react';
import './PricingPage.css';

const features = [
    { name: 'Schedule Management', core: true, premium: true },
    { name: 'Teacher Preferences', core: true, premium: true },
    { name: 'Student Schedule View', core: true, premium: true },
    { name: 'Basic Conflict Detection', core: true, premium: true },
    { name: 'Data Management (Rooms, Subjects, Sections)', core: true, premium: true },
    { name: 'In-App Messaging', core: true, premium: true },
    { name: 'Light & Dark Mode', core: true, premium: true },
    { name: 'AI-Powered Schedule Generation', core: false, premium: true },
    { name: 'OptiBot AI Assistant', core: false, premium: true },
    { name: 'Advanced Analytics Dashboard', core: false, premium: true },
    { name: 'Schedule Versioning & History', core: false, premium: true },
    { name: 'Advanced Conflict Resolution', core: false, premium: true },
    { name: 'Export CSV & Print', core: false, premium: true },
    { name: 'Real-time Collaboration', core: false, premium: true },
    { name: 'Audit Log & Activity Tracking', core: false, premium: true },
    { name: 'Schedule Editor (Drag & Drop)', core: false, premium: true },
    { name: 'Priority Support', core: false, premium: true },
    { name: 'Custom Branding', core: false, premium: true },
];

const PricingPage: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        const saved = localStorage.getItem('optisched-theme');
        if (saved) document.documentElement.setAttribute('data-theme', saved);
    }, []);

    return (
        <div className="pricing-page">
            <div className="pricing-bg-pattern" />

            <header className="pricing-header">
                <button className="pricing-back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={20} />
                    Back
                </button>
                <div className="pricing-logo">
                    <img src="/logo.png" alt="OptiSched" width={36} height={36} />
                    <span>OptiSched</span>
                </div>
            </header>

            <div className="pricing-hero">
                <h1>Choose Your Plan</h1>
                <p>Flexible scheduling solutions for schools of any size</p>
            </div>

            <div className="pricing-cards">
                {/* Core Plan */}
                <div className="pricing-card pricing-card-core">
                    <div className="pricing-card-badge">
                        <Zap size={16} />
                        CORE
                    </div>
                    <div className="pricing-card-price">
                        <span className="pricing-amount">Free</span>
                        <span className="pricing-period">forever</span>
                    </div>
                    <p className="pricing-card-desc">Essential scheduling tools for getting started</p>
                    <button className="pricing-card-btn pricing-btn-core" onClick={() => navigate('/login')}>
                        Get Started
                    </button>
                    <div className="pricing-card-features">
                        {features.map(f => (
                            <div key={f.name} className={`pricing-feature ${!f.core ? 'pricing-feature-disabled' : ''}`}>
                                {f.core ? <Check size={16} className="pricing-check" /> : <X size={16} className="pricing-x" />}
                                <span>{f.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Premium Plan */}
                <div className="pricing-card pricing-card-premium">
                    <div className="pricing-card-badge pricing-badge-premium">
                        <Crown size={16} />
                        PREMIUM
                    </div>
                    <div className="pricing-card-popular">Most Popular</div>
                    <div className="pricing-card-price">
                        <span className="pricing-currency">₱</span>
                        <span className="pricing-amount">2,499</span>
                        <span className="pricing-period">/month</span>
                    </div>
                    <p className="pricing-card-desc">Full-featured AI-powered scheduling suite</p>
                    <button className="pricing-card-btn pricing-btn-premium" onClick={() => navigate('/login')}>
                        Upgrade to Premium
                    </button>
                    <div className="pricing-card-features">
                        {features.map(f => (
                            <div key={f.name} className="pricing-feature">
                                <Check size={16} className="pricing-check" />
                                <span>{f.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="pricing-footer">
                <p>All plans include unlimited users. <strong>Contact us</strong> for enterprise pricing.</p>
                <p style={{ fontSize: 12, marginTop: 8, opacity: 0.6 }}>© 2026 OptiSched - STI College Meycauayan</p>
            </div>
        </div>
    );
};

export default PricingPage;
