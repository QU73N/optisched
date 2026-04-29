import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeColors {
    background: string;
    surface: string;
    surfaceElevated: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    borderSubtle: string;
    card: string;
    inputBg: string;
    inputBorder: string;
    primary: string;
    primaryHover: string;
    isDark: boolean;
}

interface ThemeContextType {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    colors: ThemeColors;
}

// Dark mode — default, aligned with web design system
const darkColors: ThemeColors = {
    background: Colors.bgPrimary,           // #0a1428
    surface: Colors.bgSurface,              // #14203d
    surfaceElevated: Colors.bgElevated,     // #1a2a4a
    textPrimary: Colors.textPrimaryDark,    // #e8ecf5
    textSecondary: Colors.textSecondaryDark,// #8a9ab8
    textMuted: Colors.textMutedDark,        // #5c6c88
    border: Colors.borderDefault,           // #1c3055
    borderSubtle: Colors.borderSubtle,      // #253a60
    card: Colors.bgSurface,                 // #14203d
    inputBg: Colors.bgInset,                // #081022
    inputBorder: Colors.borderDefault,      // #1c3055
    primary: Colors.accentPrimary,          // #1C4D8D
    primaryHover: Colors.accentPrimaryHover,// #4988C4
    isDark: true,
};

// Light mode
const lightColors: ThemeColors = {
    background: Colors.bgLightPrimary,      // #ffffff
    surface: Colors.bgLightSurface,         // #f1f5f9
    surfaceElevated: Colors.bgLightElevated,// #eef4fa
    textPrimary: Colors.textPrimaryLight,   // #0f172a
    textSecondary: Colors.textSecondaryLight,// #475569
    textMuted: Colors.textMutedLight,       // #64748b
    border: Colors.borderLight,             // #d7e3f1
    borderSubtle: Colors.borderLightSubtle, // #cfe3f1
    card: Colors.white,                     // #ffffff
    inputBg: Colors.bgLightSecondary,       // #f8fafc
    inputBorder: Colors.borderLight,        // #d7e3f1
    primary: Colors.accentPrimary,          // #1C4D8D
    primaryHover: Colors.accentPrimaryHover,// #4988C4
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
