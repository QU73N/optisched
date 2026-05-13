import React from 'react';
import {
    LayoutDashboard, Users, Sparkles, Shield,
    CheckCircle, AlertTriangle, BookOpen
} from 'lucide-react';
import './HelpSidebar.css';

interface HelpSidebarProps {
    activeSection: string;
    onSectionChange: (section: string) => void;
}

const HelpSidebar: React.FC<HelpSidebarProps> = ({ activeSection, onSectionChange }) => {
    const helpSections = [
        { id: 'getting-started', label: 'Getting Started', icon: LayoutDashboard },
        { id: 'user-roles', label: 'User Roles', icon: Users },
        { id: 'schedule-engine', label: 'Schedule Engine', icon: Sparkles },
        { id: 'key-features', label: 'Key Features', icon: Shield },
        { id: 'best-practices', label: 'Best Practices', icon: CheckCircle },
        { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertTriangle },
    ];

    return (
        <nav className="help-sidebar">
            <div className="help-sidebar-header">
                <BookOpen size={20} />
                <span>Help Topics</span>
            </div>
            <div className="help-sidebar-sections">
                {helpSections.map((section) => {
                    const Icon = section.icon;
                    return (
                        <button
                            key={section.id}
                            className={`help-sidebar-link ${activeSection === section.id ? 'active' : ''}`}
                            onClick={() => onSectionChange(section.id)}
                        >
                            <Icon size={18} />
                            <span>{section.label}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default HelpSidebar;
