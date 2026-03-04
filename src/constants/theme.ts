import { Platform } from 'react-native';

// Design tokens derived from HTML mockups
export const Theme = {
    // Typography
    fonts: {
        display: Platform.select({ ios: 'Lexend', android: 'Lexend', default: 'Lexend' }),
        sans: Platform.select({ ios: 'Inter', android: 'Inter', default: 'Inter' }),
    },

    fontSizes: {
        xs: 10,
        sm: 12,
        base: 14,
        md: 16,
        lg: 18,
        xl: 20,
        '2xl': 24,
        '3xl': 30,
    },

    fontWeights: {
        light: '300' as const,
        normal: '400' as const,
        medium: '500' as const,
        semibold: '600' as const,
        bold: '700' as const,
    },

    // Border radius
    radii: {
        sm: 4,
        md: 8,
        lg: 12,
        xl: 16,
        '2xl': 20,
        full: 9999,
    },

    // Spacing
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

    // Shadows
    shadows: {
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 6,
        },
        primary: {
            shadowColor: '#135bec',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
        },
    },

    // Animation durations
    animation: {
        fast: 150,
        normal: 300,
        slow: 500,
    },
};
