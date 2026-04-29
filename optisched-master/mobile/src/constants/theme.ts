import { Platform } from 'react-native';

// Design tokens aligned with web design system
// Based on docs/BRAND_SYSTEM.md and web/src/index.css
export const Theme = {
    // Typography — matches web design system
    // Uses 'Inter' for body, 'Lexend' for display
    fonts: {
        display: 'Lexend',  // Display/heading font
        sans: 'Inter',      // Body/UI font
    },

    fontSizes: {
        xs: 10,     // Caption
        sm: 12,     // Small text
        base: 14,   // Body default
        md: 16,     // Body emphasis
        lg: 18,     // Heading 3
        xl: 20,     // Heading 2
        '2xl': 24,  // Heading 1 small
        '3xl': 30,  // Heading 1
    },

    fontWeights: {
        light: '300' as const,
        normal: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
    },

    // Border radius — professional, moderate roundness
    radii: {
        xs: 4,      // Extra small, minimal
        sm: 6,      // Small
        md: 8,      // Medium (default)
        lg: 12,     // Large
        xl: 16,     // Extra large
        '2xl': 20,  // 2X large
        full: 9999, // Fully rounded
    },

    // Spacing scale
    spacing: {
        xs: 4,
        sm: 8,
        md: 12,
        lg: 16,
        xl: 20,
        '2xl': 24,
        '3xl': 32,
        '4xl': 40,
    },

    // Shadows — stronger for dark mode depth
    // Aligned with web design system
    shadows: {
        xs: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.25,
            shadowRadius: 2,
            elevation: 1,
        },
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 3,
            elevation: 2,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
            elevation: 4,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.4,
            shadowRadius: 24,
            elevation: 8,
        },
        xl: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.5,
            shadowRadius: 40,
            elevation: 12,
        },
        // Brand-colored glow (for CTAs, highlights)
        primaryGlow: {
            shadowColor: '#4988C4',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 4,
        },
    },

    // Animation/transition durations — web-aligned
    animation: {
        fast: 120,      // Quick feedback
        normal: 200,    // Standard transition
        slow: 350,      // Deliberate, emphasis
    },

    // Easing functions (use these for Animated components)
    // Matches web's --ease-out and --ease-in-out
    easing: {
        easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
        easeInOut: 'cubic-bezier(0.45, 0, 0.55, 1)',
    },
};
