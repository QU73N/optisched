// Sidebar - grouped role-based navigation with search and badges.
// Source of truth for tab structure: src/config/sidebar.ts
// Source of truth for permissions: usePermissions hook (rules engine).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { resolveNav, flattenNav, type NavLink as TNavLink, type NavGroup } from '../config/sidebar';
import { ChevronDown, Search, Star, X } from 'lucide-react';

interface SidebarProps {
    badges?: Record<string, number>;
}

const STORAGE_PINS = 'optisched-pinned-tabs';
const STORAGE_COLLAPSED = 'optisched-collapsed-groups';

const Sidebar: React.FC<SidebarProps> = ({ badges = {} }) => {
    const { role, roles } = useAuth();
    const perms = usePermissions();
    const location = useLocation();

    const groups = useMemo<NavGroup[]>(
        () => resolveNav(role, roles),
        [role, roles]
    );

    // Filter Power-only links if not Power Admin
    const filteredGroups = useMemo<NavGroup[]>(() => {
        return groups.map(g => ({
            ...g,
            links: g.links.filter(l => !l.powerOnly || perms.isPowerAdmin),
        })).filter(g => g.links.length > 0);
    }, [groups, perms.isPowerAdmin]);

    // Pinned tabs (persisted)
    const [pinned, setPinned] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_PINS) || '[]'); }
        catch { return []; }
    });
    useEffect(() => {
        localStorage.setItem(STORAGE_PINS, JSON.stringify(pinned));
    }, [pinned]);

    const togglePin = (to: string) => {
        setPinned(prev => prev.includes(to)
            ? prev.filter(t => t !== to)
            : prev.length >= 5 ? prev : [...prev, to]
        );
    };

    // Collapsed groups (persisted)
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_COLLAPSED) || '{}'); }
        catch (err) { console.error('[Sidebar] Data load failed:', err); return {}; }
    });
    useEffect(() => {
        localStorage.setItem(STORAGE_COLLAPSED, JSON.stringify(collapsed));
    }, [collapsed]);

    const toggleGroup = (label: string) =>
        setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));

    // Search
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
                setTimeout(() => searchRef.current?.focus(), 50);
            } else if (e.key === 'Escape' && searchOpen) {
                setSearchOpen(false);
                setQuery('');
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [searchOpen]);

    const allLinks = useMemo(() => flattenNav(filteredGroups), [filteredGroups]);
    const searchResults = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return allLinks.filter(l => l.label.toLowerCase().includes(q)).slice(0, 8);
    }, [allLinks, query]);

    const pinnedLinks = useMemo<TNavLink[]>(() => {
        return pinned
            .map(p => allLinks.find(l => l.to === p))
            .filter((l): l is TNavLink => Boolean(l));
    }, [pinned, allLinks]);

    const renderLink = (link: TNavLink, withPin = true) => {
        const badge = link.badgeKey ? badges[link.badgeKey] : 0;
        const isPinned = pinned.includes(link.to);
        return (
            <div key={link.to} className="sidebar-link-row">
                <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                        `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                    }
                    title={link.label}
                >
                    <link.icon size={16} />
                    <span className="sidebar-link-label">{link.label}</span>
                    {badge > 0 && <span className="sidebar-link-badge">{badge > 99 ? '99+' : badge}</span>}
                </NavLink>
                {withPin && (
                    <button
                        className={`sidebar-pin-btn ${isPinned ? 'sidebar-pin-active' : ''}`}
                        onClick={() => togglePin(link.to)}
                        aria-label={isPinned ? `Unpin ${link.label}` : `Pin ${link.label}`}
                        title={isPinned ? 'Unpin' : 'Pin (max 5)'}
                    >
                        <Star size={12} />
                    </button>
                )}
            </div>
        );
    };

    return (
        <nav className="sidebar-nav-v2" aria-label="Primary navigation">
            {/* Search trigger */}
            <button className="sidebar-search-trigger" onClick={() => {
                setSearchOpen(true);
                setTimeout(() => searchRef.current?.focus(), 50);
            }}>
                <Search size={14} />
                <span>Search…</span>
                <kbd className="sidebar-kbd">⌘K</kbd>
            </button>

            {/* Search overlay */}
            {searchOpen && (
                <div className="sidebar-search-overlay">
                    <div className="sidebar-search-box">
                        <Search size={14} />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Find a tab…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            aria-label="Search tabs"
                        />
                        <button onClick={() => { setSearchOpen(false); setQuery(''); }} aria-label="Close search">
                            <X size={14} />
                        </button>
                    </div>
                    {searchResults.length > 0 && (
                        <div className="sidebar-search-results">
                            {searchResults.map(l => (
                                <NavLink
                                    key={l.to}
                                    to={l.to}
                                    className="sidebar-search-result"
                                    onClick={() => { setSearchOpen(false); setQuery(''); }}
                                >
                                    <l.icon size={14} />
                                    <span>{l.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Pinned */}
            {pinnedLinks.length > 0 && (
                <div className="sidebar-group">
                    <div className="sidebar-group-label">
                        <Star size={10} /> Pinned
                    </div>
                    <div className="sidebar-group-links">
                        {pinnedLinks.map(l => renderLink(l, false))}
                    </div>
                </div>
            )}

            {/* Groups */}
            {filteredGroups.map(group => {
                const isCollapsed = collapsed[group.label];
                const activeLink = group.links.find(l =>
                    l.end ? location.pathname === l.to : location.pathname.startsWith(l.to)
                );
                const isGroupCollapsed = isCollapsed;
                return (
                    <div key={group.label} className="sidebar-group">
                        <button
                            type="button"
                            className="sidebar-group-label sidebar-group-toggle"
                            onClick={() => toggleGroup(group.label)}
                            aria-expanded={!isGroupCollapsed}
                        >
                            <ChevronDown
                                size={10}
                                className={`sidebar-group-chevron ${isGroupCollapsed ? 'sidebar-group-chevron-collapsed' : ''}`}
                            />
                            {group.label}
                        </button>
                        <div className="sidebar-group-links">
                            <div className="sidebar-group-links-inner">
                                {group.links.map(l => {
                                    const isActive = activeLink && l.to === activeLink.to;
                                    const isVisible = !isCollapsed || isActive;
                                    return (
                                        <div 
                                            key={l.to} 
                                            className={`sidebar-link-row ${!isVisible ? 'sidebar-link-hidden' : ''}`}
                                        >
                                            <NavLink
                                                to={l.to}
                                                end={l.end}
                                                className={({ isActive: linkActive }) =>
                                                    `sidebar-link ${linkActive ? 'sidebar-link-active' : ''}`
                                                }
                                                title={l.label}
                                            >
                                                <l.icon size={16} />
                                                <span className="sidebar-link-label">{l.label}</span>
                                                {l.badgeKey && badges[l.badgeKey] > 0 && (
                                                    <span className="sidebar-link-badge">
                                                        {badges[l.badgeKey] > 99 ? '99+' : badges[l.badgeKey]}
                                                    </span>
                                                )}
                                            </NavLink>
                                            <button
                                                className={`sidebar-pin-btn ${pinned.includes(l.to) ? 'sidebar-pin-active' : ''}`}
                                                onClick={() => togglePin(l.to)}
                                                aria-label={pinned.includes(l.to) ? `Unpin ${l.label}` : `Pin ${l.label}`}
                                                title={pinned.includes(l.to) ? 'Unpin' : 'Pin (max 5)'}
                                            >
                                                <Star size={12} />
                                            </button>
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

export default Sidebar;
