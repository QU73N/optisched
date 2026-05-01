import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeColors {
    background: string;
    surface: string;
    elevated: string;
    hover: string;
    inset: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    borderSubtle: string;
    card: string;
    inputBg: string;
    inputBorder: string;
    accentPrimary: string;
    accentPrimaryHover: string;
    accentPrimarySubtle: string;
    isDark: boolean;
}

interface ThemeContextType {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    colors: ThemeColors;
}

// Aligned with web :root (dark mode default)
const darkColors: ThemeColors = {
    background: '#0B0F14',       // --bg-primary
    surface: '#161D26',          // --bg-surface
    elevated: '#1B2430',         // --bg-elevated
    hover: '#202A36',            // --bg-hover
    inset: '#0F141B',            // --bg-inset
    textPrimary: '#E6EDF5',      // --text-primary
    textSecondary: '#A9B4C2',    // --text-secondary
    textMuted: '#7C8A9A',        // --text-muted
    border: '#263241',           // --border-default
    borderSubtle: '#1E2935',     // --border-subtle
    card: '#121821',             // --bg-secondary
    inputBg: '#0F141B',          // --bg-inset
    inputBorder: '#263241',      // --border-default
    accentPrimary: '#4988C4',    // --accent-primary
    accentPrimaryHover: '#BDE8F5', // --accent-primary-hover
    accentPrimarySubtle: 'rgba(73, 136, 196, 0.15)',
    isDark: true,
};

// Aligned with web [data-theme="light"]
const lightColors: ThemeColors = {
    background: '#F8FAFC',       // --bg-primary
    surface: '#EEF4FA',          // --bg-surface
    elevated: '#ffffff',         // --bg-elevated
    hover: '#e8eff7',            // --bg-hover
    inset: '#e3ebf4',            // --bg-inset
    textPrimary: '#0F172A',      // --text-primary
    textSecondary: '#475569',    // --text-secondary
    textMuted: '#64748B',        // --text-muted
    border: '#D7E3F1',           // --border-default
    borderSubtle: '#c5d4e8',     // --border-subtle
    card: '#ffffff',             // --bg-secondary
    inputBg: '#F8FAFC',          // --bg-primary
    inputBorder: '#D7E3F1',      // --border-default
    accentPrimary: '#1C4D8D',    // --accent-primary (light uses brand-core)
    accentPrimaryHover: '#0F2854', // --accent-primary-hover (light uses brand-navy)
    accentPrimarySubtle: 'rgba(28, 77, 141, 0.08)',
    isDark: false,
};

const THEME_KEY = 'optisched_theme';

const ThemeContext = createContext<ThemeContextType>({
    themeMode: 'light',
    setThemeMode: () => { },
    colors: lightColors,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

    useEffect(() => {
        AsyncStorage.getItem(THEME_KEY).then(saved => {
            if (saved === 'dark' || saved === 'light' || saved === 'system') {
                setThemeModeState(saved);
            }
        }).catch(() => { });
    }, []);

    const setThemeMode = (mode: ThemeMode) => {
        setThemeModeState(mode);
        AsyncStorage.setItem(THEME_KEY, mode).catch(() => { });
    };

    const colors = useMemo(() => {
        if (themeMode === 'system') {
            return systemScheme === 'light' ? lightColors : darkColors;
        }
        return themeMode === 'light' ? lightColors : darkColors;
    }, [themeMode, systemScheme]);

    return (
        <ThemeContext.Provider value={{ themeMode, setThemeMode, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
export { darkColors, lightColors };
