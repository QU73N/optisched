import React, { useState, useMemo, useEffect } from 'react';
import {
    LayoutDashboard, Users, Sparkles, Shield, CheckCircle, AlertTriangle, ChevronDown, Star, Bot
} from 'lucide-react';
import './HelpSidebar.css';

interface HelpSidebarProps {
    activeSection: string;
    onSectionChange: (section: string) => void;
}

const STORAGE_PINS = 'optisched-help-pinned-tabs';
const STORAGE_COLLAPSED = 'optisched-help-collapsed-groups';

const HelpSidebar: React.FC<HelpSidebarProps> = ({ activeSection, onSectionChange }) => {
    const helpGroups = useMemo(() => [
        {
            label: 'Help Topics',
            links: [
                { id: 'getting-started', label: 'Getting Started', icon: LayoutDashboard },
                { id: 'user-roles', label: 'User Roles', icon: Users },
                { id: 'schedule-engine', label: 'Schedule Engine', icon: Sparkles },
                { id: 'key-features', label: 'Key Features', icon: Shield },
                { id: 'best-practices', label: 'Best Practices', icon: CheckCircle },
                { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertTriangle },
                { id: 'optibot', label: 'OptiBot Assistant', icon: Bot },
            ],
        },
    ], []);

    // Pinned tabs (persisted)
    const [pinned, setPinned] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_PINS) || '[]'); }
        catch { return []; }
    });
    useEffect(() => {
        localStorage.setItem(STORAGE_PINS, JSON.stringify(pinned));
    }, [pinned]);
    const togglePin = (id: string) => {
        setPinned(prev => prev.includes(id)
            ? prev.filter(t => t !== id)
            : prev.length >= 5 ? prev : [...prev, id]
        );
    };

    // Collapsed groups (persisted)
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_COLLAPSED) || '{}'); }
        catch { return {}; }
    });
    useEffect(() => {
        localStorage.setItem(STORAGE_COLLAPSED, JSON.stringify(collapsed));
    }, [collapsed]);
    const toggleGroup = (label: string) =>
        setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));

    const allLinks = useMemo(() => helpGroups.flatMap(g => g.links), [helpGroups]);
    const pinnedLinks = useMemo(() => {
        return pinned
            .map(p => allLinks.find(l => l.id === p))
            .filter((l): l is typeof allLinks[0] => Boolean(l));
    }, [pinned, allLinks]);

    const renderLinkInner = (link: { id: string; label: string; icon: React.ComponentType<{ size?: number }> }, withPin = true) => {
        const isPinned = pinned.includes(link.id);
        const isActive = activeSection === link.id;
        const Icon = link.icon;
        return (
            <>
                <button
                    className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                    onClick={() => onSectionChange(link.id)}
                    title={link.label}
                >
                    <Icon size={16} />
                    <span className="sidebar-link-label">{link.label}</span>
                </button>
                {withPin && (
                    <button
                        className={`sidebar-pin-btn ${isPinned ? 'sidebar-pin-active' : ''}`}
                        onClick={() => togglePin(link.id)}
                        aria-label={isPinned ? `Unpin ${link.label}` : `Pin ${link.label}`}
                        title={isPinned ? 'Unpin' : 'Pin (max 5)'}
                    >
                        <Star size={12} />
                    </button>
                )}
            </>
        );
    };

    return (
        <nav className="sidebar-nav-v2" aria-label="Help navigation">
            {/* Pinned */}
            {pinnedLinks.length > 0 && (
                <div className="sidebar-group">
                    <div className="sidebar-group-label">
                        <Star size={10} /> Pinned
                    </div>
                    <div className="sidebar-group-links">
                        {pinnedLinks.map(l => (
                            <div key={l.id} className="sidebar-link-row">
                                {renderLinkInner(l, false)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Groups */}
            {helpGroups.map(group => {
                const isCollapsed = collapsed[group.label];
                return (
                    <div key={group.label} className="sidebar-group">
                        <button
                            type="button"
                            className="sidebar-group-label sidebar-group-toggle"
                            onClick={() => toggleGroup(group.label)}
                            aria-expanded={!isCollapsed}
                        >
                            <ChevronDown
                                size={10}
                                className={`sidebar-group-chevron ${isCollapsed ? 'sidebar-group-chevron-collapsed' : ''}`}
                            />
                            {group.label}
                        </button>
                        <div className="sidebar-group-links">
                            <div className="sidebar-group-links-inner">
                                {group.links.map(l => {
                                    const isActive = l.id === activeSection;
                                    const isVisible = !isCollapsed || isActive;
                                    return (
                                        <div
                                            key={l.id}
                                            className={`sidebar-link-row ${!isVisible ? 'sidebar-link-hidden' : ''}`}
                                        >
                                            {renderLinkInner(l)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </nav>
    );
};

export default HelpSidebar;
