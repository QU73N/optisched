// OptiSched Mobile — Design System Colors
// Aligned with web/src/index.css (Design System v2.0)
// Brand palette: docs/BRAND_SYSTEM.md

export const Colors = {
    // ── Brand palette (per BRAND_SYSTEM) ──
    brandNavy: '#0F2854',       // Deep Navy — structural anchor
    brandCore: '#1C4D8D',       // Core Blue — nav, headers, active
    brandBright: '#4988C4',     // Bright Blue — highlights, active indicators
    brandIce: '#BDE8F5',        // Ice Blue — wash, glow, hover

    // ── Primary (= web --accent-primary) ──
    primary: '#4988C4',
    primaryDark: '#1C4D8D',     // = brand-core
    primaryLight: '#BDE8F5',    // = brand-ice
    primaryContent: '#ffffff',

    // ── Surfaces — Dark mode (web :root) ──
    bgPrimary: '#0B0F14',       // --bg-primary
    bgSecondary: '#121821',     // --bg-secondary
    bgSurface: '#161D26',       // --bg-surface
    bgElevated: '#1B2430',      // --bg-elevated
    bgHover: '#202A36',         // --bg-hover
    bgInset: '#0F141B',         // --bg-inset
    bgOverlay: 'rgba(0, 0, 0, 0.5)',  // --bg-overlay

    // ── Surfaces — Light mode (web [data-theme="light"]) ──
    bgPrimaryLight: '#F8FAFC',
    bgSecondaryLight: '#ffffff',
    bgSurfaceLight: '#EEF4FA',
    bgElevatedLight: '#ffffff',
    bgHoverLight: '#e8eff7',
    bgInsetLight: '#e3ebf4',

    // ── Legacy surface aliases (kept for backward compatibility) ──
    backgroundLight: '#F8FAFC',
    backgroundDark: '#0B0F14',
    surfaceLight: '#ffffff',
    surfaceDark: '#161D26',

    // ── Text — Dark mode ──
    textPrimaryDark: '#E6EDF5',   // --text-primary
    textSecondaryDark: '#A9B4C2', // --text-secondary
    textMutedDark: '#7C8A9A',     // --text-muted

    // ── Text — Light mode ──
    textPrimaryLight: '#0F172A',  // --text-primary (light)
    textSecondaryLight: '#475569', // --text-secondary (light)
    textMutedLight: '#64748B',    // --text-muted (light)

    // ── Text — On accent / inverse ──
    textOnAccent: '#FFFFFF',
    textInverseDark: '#0B0F14',
    textInverseLight: '#F8FAFC',

    // ── Borders — Dark mode ──
    borderDefault: '#263241',     // --border-default
    borderSubtle: '#1E2935',      // --border-subtle
    borderAccent: 'rgba(73, 136, 196, 0.35)', // --border-accent

    // ── Borders — Light mode ──
    borderDefaultLight: '#D7E3F1',
    borderSubtleLight: '#c5d4e8',
    borderAccentLight: 'rgba(73, 136, 196, 0.25)',

    // ── Legacy border aliases ──
    borderLight: '#D7E3F1',
    borderDark: '#263241',

    // ── Accent / Status ──
    accentPrimary: '#4988C4',           // --accent-primary
    accentPrimaryHover: '#BDE8F5',      // --accent-primary-hover (ice)
    accentPrimarySubtle: 'rgba(73, 136, 196, 0.15)', // --accent-primary-subtle
    accentSecondary: '#1C4D8D',         // --accent-secondary (core)

    success: '#3FAF73',                 // --accent-success
    successLight: 'rgba(63, 175, 115, 0.15)',
    successDark: '#257349',             // --accent-success-hover
    warning: '#E6A23C',                 // --accent-warning
    warningLight: 'rgba(230, 162, 60, 0.15)',
    warningDark: '#D38B20',             // --accent-warning-hover
    error: '#E05D5D',                   // --accent-error
    errorLight: 'rgba(224, 93, 93, 0.15)',
    errorDark: '#a83838',               // --accent-error-hover
    info: '#4988C4',                    // --accent-info

    // ── Light-mode accent overrides ──
    accentPrimaryLM: '#1C4D8D',         // --accent-primary (light)
    accentPrimaryHoverLM: '#0F2854',    // --accent-primary-hover (light)
    successLM: '#2F8F5B',
    warningLM: '#D38B20',
    errorLM: '#C84B4B',

    // ── Subject accent colors ──
    subjectScience: '#4C1D95',
    subjectMath: '#1E3A8A',
    subjectLang: '#064E3B',
    subjectArts: '#7C2D12',
    subjectPE: '#831843',

    // ── Slate scale (utility grays) ──
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

    // ── Specific UI ──
    toggleBg: '#334155',
    inputBg: '#0F141B',       // = bgInset
    inputBorder: '#263241',   // = borderDefault

    // ── Transparent variants (using brand-bright base) ──
    primaryAlpha10: 'rgba(73, 136, 196, 0.1)',
    primaryAlpha20: 'rgba(73, 136, 196, 0.2)',
    primaryAlpha30: 'rgba(73, 136, 196, 0.3)',
    successAlpha10: 'rgba(63, 175, 115, 0.1)',
    warningAlpha10: 'rgba(230, 162, 60, 0.1)',
    errorAlpha10: 'rgba(224, 93, 93, 0.1)',

    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
};

export type ColorScheme = 'light' | 'dark';

export const getColors = (scheme: ColorScheme) => ({
    background: scheme === 'dark' ? Colors.bgPrimary : Colors.bgPrimaryLight,
    surface: scheme === 'dark' ? Colors.bgSurface : Colors.bgSurfaceLight,
    textPrimary: scheme === 'dark' ? Colors.textPrimaryDark : Colors.textPrimaryLight,
    textSecondary: scheme === 'dark' ? Colors.textSecondaryDark : Colors.textSecondaryLight,
    border: scheme === 'dark' ? Colors.borderDefault : Colors.borderDefaultLight,
    primary: Colors.primary,
    card: scheme === 'dark' ? Colors.bgSecondary : Colors.white,
});
