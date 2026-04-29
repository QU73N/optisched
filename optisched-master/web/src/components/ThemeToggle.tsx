import React, { useEffect, useState, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';

const THEME_TRANSITION_MS = 450;

const ThemeToggle: React.FC = () => {
    const [theme, setTheme] = useState(() => localStorage.getItem('optisched-theme') || 'light');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('optisched-theme', theme);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        document.documentElement.setAttribute('data-transitioning-theme', '');
        setTheme(t => t === 'dark' ? 'light' : 'dark');
        setTimeout(() => {
            document.documentElement.removeAttribute('data-transitioning-theme');
        }, THEME_TRANSITION_MS);
    }, []);

    return (
        <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 8,
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    );
};

export default ThemeToggle;
