// OptiSched Design System Colors
// Derived from the HTML mockup designs

export const Colors = {
    // Primary brand
    primary: '#135bec',
    primaryDark: '#0e44b3',
    primaryLight: '#4580f5',
    primaryContent: '#ffffff',

    // Backgrounds
    backgroundLight: '#f8fafc',
    backgroundDark: '#101622',

    // Surfaces (cards, elevated elements)
    surfaceLight: '#ffffff',
    surfaceDark: '#1c2333',

    // Text
    textPrimaryLight: '#0f172a',
    textPrimaryDark: '#f1f5f9',
    textSecondaryLight: '#475569',
    textSecondaryDark: '#94a3b8',

    // Borders
    borderLight: '#e2e8f0',
    borderDark: '#2a3447',

    // Status colors
    success: '#10b981',
    successLight: '#d1fae5',
    successDark: '#065f46',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    warningDark: '#92400e',
    error: '#ef4444',
    errorLight: '#fee2e2',
    errorDark: '#991b1b',
    info: '#3b82f6',

    // Accent colors for subjects
    subjectScience: '#4C1D95',
    subjectMath: '#1E3A8A',
    subjectLang: '#064E3B',
    subjectArts: '#7C2D12',
    subjectPE: '#831843',

    // UI elements
    slate50: '#f8fafc',
    slate100: '#f1f5f9',
    slate200: '#e2e8f0',
    slate300: '#cbd5e1',
    slate400: '#94a3b8',
    slate500: '#64748b',
    slate600: '#475569',
    slate700: '#334155',
    slate800: '#1e293b',
    slate900: '#0f172a',

    // Specific UI
    toggleBg: '#334155',
    inputBg: '#1f2937',
    inputBorder: '#374151',

    // Transparent variants
    primaryAlpha10: 'rgba(19, 91, 236, 0.1)',
    primaryAlpha20: 'rgba(19, 91, 236, 0.2)',
    primaryAlpha30: 'rgba(19, 91, 236, 0.3)',
    successAlpha10: 'rgba(16, 185, 129, 0.1)',
    warningAlpha10: 'rgba(245, 158, 11, 0.1)',
    errorAlpha10: 'rgba(239, 68, 68, 0.1)',

    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
};

export type ColorScheme = 'light' | 'dark';

export const getColors = (scheme: ColorScheme) => ({
    background: scheme === 'dark' ? Colors.backgroundDark : Colors.backgroundLight,
    surface: scheme === 'dark' ? Colors.surfaceDark : Colors.surfaceLight,
    textPrimary: scheme === 'dark' ? Colors.textPrimaryDark : Colors.textPrimaryLight,
    textSecondary: scheme === 'dark' ? Colors.textSecondaryDark : Colors.textSecondaryLight,
    border: scheme === 'dark' ? Colors.borderDark : Colors.borderLight,
    primary: Colors.primary,
    card: scheme === 'dark' ? Colors.surfaceDark : Colors.white,
});
