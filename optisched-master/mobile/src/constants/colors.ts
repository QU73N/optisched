// OptiSched Design System Colors
// Aligned with BRAND_SYSTEM.md and web implementation
// https://optisched.io/brand-system

export const Colors = {
    // ========== BRAND PALETTE ==========
    // Per BRAND_SYSTEM.md — the core identity colors
    brandNavy: '#0F2854',      // Deep Navy — structural anchor
    brandCore: '#1C4D8D',      // Core Blue — nav, headers, active states
    brandBright: '#4988C4',    // Bright Blue — highlights, active indicators
    brandIce: '#BDE8F5',       // Ice Blue — background wash, glow, hover

    // ========== DARK MODE SURFACES (Default) ==========
    // Navy-based layered system matching web dark mode
    bgPrimary: '#0a1428',      // Darkest, main canvas
    bgSecondary: '#0f1a35',    // Secondary background
    bgSurface: '#14203d',      // Card/surface background
    bgElevated: '#1a2a4a',     // Elevated elements (modals, popovers)
    bgHover: '#1e3055',        // Hover state background
    bgInset: '#081022',        // Inset/recessed backgrounds

    // ========== LIGHT MODE SURFACES ==========
    bgLightPrimary: '#ffffff',
    bgLightSecondary: '#f8fafc',
    bgLightSurface: '#f1f5f9',
    bgLightElevated: '#eef4fa',
    bgLightHover: '#e8eef7',

    // ========== BORDERS ==========
    borderDefault: '#1c3055',       // Dark mode default
    borderSubtle: '#253a60',        // Dark mode subtle
    borderAccent: 'rgba(73, 136, 196, 0.3)', // Branded accent
    borderLight: '#d7e3f1',         // Light mode
    borderLightSubtle: '#cfe3f1',   // Light mode subtle

    // ========== TEXT ==========
    // Dark mode
    textPrimaryDark: '#e8ecf5',     // Primary text on dark
    textSecondaryDark: '#8a9ab8',   // Secondary text on dark
    textMutedDark: '#5c6c88',       // Muted text on dark

    // Light mode
    textPrimaryLight: '#0f172a',    // Primary text on light
    textSecondaryLight: '#475569',  // Secondary text on light
    textMutedLight: '#64748b',      // Muted text on light

    // Semantic
    textOnAccent: '#ffffff',        // Text on brand colors
    textInverse: '#0a1428',         // Inverse text

    // ========== ACCENT / SEMANTIC COLORS ==========
    accentPrimary: '#1C4D8D',       // Primary accent (brand core)
    accentPrimaryHover: '#4988C4',  // Hover state (brand bright)
    accentSecondary: '#4988C4',     // Secondary accent (brand bright)

    success: '#2F8F5B',             // Success states
    successLight: '#d1fae5',        // Success background
    successDark: '#065f46',         // Success dark

    warning: '#D38B20',             // Warning states
    warningLight: '#fef3c7',        // Warning background
    warningDark: '#92400e',         // Warning dark

    error: '#C84B4B',               // Error states
    errorLight: '#fee2e2',          // Error background
    errorDark: '#991b1b',           // Error dark

    info: '#4988C4',                // Info state (brand bright)

    // ========== LEGACY / ALIASES (for backward compatibility) ==========
    primary: '#1C4D8D',             // Alias for accentPrimary
    primaryDark: '#0F2854',         // Darker variant
    primaryLight: '#4988C4',        // Lighter variant
    primaryContent: '#ffffff',      // Content on primary
    
    backgroundLight: '#f8fafc',
    backgroundDark: '#0a1428',
    surfaceLight: '#ffffff',
    surfaceDark: '#14203d',
    
    // Subject colors (preserved)
    subjectScience: '#4C1D95',
    subjectMath: '#1E3A8A',
    subjectLang: '#064E3B',
    subjectArts: '#7C2D12',
    subjectPE: '#831843',

    // Slate scale (preserved)
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

    // UI elements
    toggleBg: '#334155',
    inputBg: '#14203d',
    inputBorder: '#1c3055',

    // Transparent variants
    primaryAlpha10: 'rgba(28, 77, 141, 0.1)',
    primaryAlpha20: 'rgba(28, 77, 141, 0.2)',
    primaryAlpha30: 'rgba(28, 77, 141, 0.3)',
    successAlpha10: 'rgba(47, 143, 91, 0.1)',
    warningAlpha10: 'rgba(211, 139, 32, 0.1)',
    errorAlpha10: 'rgba(200, 75, 75, 0.1)',

    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
};

export type ColorScheme = 'light' | 'dark';

/**
 * Get theme-aware color values
 * Returns dark mode colors by default (matching web default)
 */
export const getColors = (scheme: ColorScheme = 'dark') => ({
    background: scheme === 'dark' ? Colors.bgPrimary : Colors.bgLightPrimary,
    surface: scheme === 'dark' ? Colors.bgSurface : Colors.bgLightSurface,
    surfaceElevated: scheme === 'dark' ? Colors.bgElevated : Colors.bgLightElevated,
    textPrimary: scheme === 'dark' ? Colors.textPrimaryDark : Colors.textPrimaryLight,
    textSecondary: scheme === 'dark' ? Colors.textSecondaryDark : Colors.textSecondaryLight,
    textMuted: scheme === 'dark' ? Colors.textMutedDark : Colors.textMutedLight,
    border: scheme === 'dark' ? Colors.borderDefault : Colors.borderLight,
    borderSubtle: scheme === 'dark' ? Colors.borderSubtle : Colors.borderLightSubtle,
    primary: Colors.accentPrimary,
    primaryHover: Colors.accentPrimaryHover,
    card: scheme === 'dark' ? Colors.bgSurface : Colors.white,
});
