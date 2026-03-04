import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeColors {
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    card: string;
    inputBg: string;
    inputBorder: string;
    isDark: boolean;
}

interface ThemeContextType {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    colors: ThemeColors;
}

const darkColors: ThemeColors = {
    background: '#101622',
    surface: '#1c2333',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    border: '#2a3447',
    card: '#1c2333',
    inputBg: '#0f172a',
    inputBorder: '#334155',
    isDark: true,
};

const lightColors: ThemeColors = {
    background: '#f6f6f8',
    surface: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    border: '#e2e4e8',
    card: '#ffffff',
    inputBg: '#f8fafc',
    inputBorder: '#e2e8f0',
    isDark: false,
};

const THEME_KEY = 'optisched_theme';

const ThemeContext = createContext<ThemeContextType>({
    themeMode: 'dark',
    setThemeMode: () => { },
    colors: darkColors,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');

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
