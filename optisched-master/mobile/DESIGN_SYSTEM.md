# OptiSched Mobile Design System

Aligned with **docs/BRAND_SYSTEM.md** and **web/src/index.css**

## Color Palette

### Brand Colors
```typescript
Colors.brandNavy    // #0F2854 — Deep Navy (structural anchor)
Colors.brandCore    // #1C4D8D — Core Blue (navigation, headers, active states)
Colors.brandBright  // #4988C4 — Bright Blue (highlights, active indicators)
Colors.brandIce     // #BDE8F5 — Ice Blue (background wash, glow, hover)
```

### Dark Mode Surfaces (Default)
```typescript
Colors.bgPrimary    // #0a1428 — Main canvas
Colors.bgSecondary  // #0f1a35 — Secondary background
Colors.bgSurface    // #14203d — Cards, elevated content
Colors.bgElevated   // #1a2a4a — Modals, popovers
Colors.bgHover      // #1e3055 — Hover states
Colors.bgInset      // #081022 — Recessed backgrounds
```

### Light Mode Surfaces
```typescript
Colors.bgLightPrimary     // #ffffff
Colors.bgLightSecondary   // #f8fafc
Colors.bgLightSurface     // #f1f5f9
Colors.bgLightElevated    // #eef4fa
Colors.bgLightHover       // #e8eef7
```

### Text Colors
```typescript
// Dark mode
Colors.textPrimaryDark      // #e8ecf5
Colors.textSecondaryDark    // #8a9ab8
Colors.textMutedDark        // #5c6c88

// Light mode
Colors.textPrimaryLight     // #0f172a
Colors.textSecondaryLight   // #475569
Colors.textMutedLight       // #64748b
```

### Semantic Colors
```typescript
Colors.success  // #2F8F5B
Colors.warning  // #D38B20
Colors.error    // #C84B4B
Colors.info     // #4988C4 (brand bright)
```

## Usage

### Dynamic Colors with Theme
```typescript
import { useTheme } from '../contexts/ThemeContext';

const MyComponent = () => {
  const { colors } = useTheme();
  
  return (
    <View style={{ backgroundColor: colors.surface }}>
      <Text style={{ color: colors.textPrimary }}>Hello</Text>
    </View>
  );
};
```

### Static Brand Colors
```typescript
import { Colors } from '../constants/colors';

// Use brand colors directly for emphasis
<TouchableOpacity style={{ backgroundColor: Colors.brandCore }}>
  <Text style={{ color: Colors.white }}>Action</Text>
</TouchableOpacity>
```

### Theme-Aware Colors
```typescript
const { colors } = useTheme();

const containerStyle = {
  backgroundColor: colors.surface,      // Card/content background
  borderColor: colors.border,           // Borders
  color: colors.textPrimary,            // Primary text
};
```

## Typography

### Fonts
- **Display/Headings**: `Lexend` (bold, confident)
- **Body/UI**: `Inter` (clean, legible)

### Font Sizes
```typescript
Theme.fontSizes = {
  xs: 10,      // Caption
  sm: 12,      // Small text
  base: 14,    // Body default
  md: 16,      // Body emphasis
  lg: 18,      // Heading 3
  xl: 20,      // Heading 2
  '2xl': 24,   // Large heading
  '3xl': 30,   // Hero heading
};
```

### Font Weights
```typescript
Theme.fontWeights = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};
```

## Spacing & Radius

### Spacing Scale
```typescript
Theme.spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};
```

### Border Radius
```typescript
Theme.radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
};
```

## Shadows

```typescript
Theme.shadows = {
  xs: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2 },
  sm: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3 },
  md: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8 },
  lg: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 24 },
  xl: { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 40 },
  primaryGlow: { shadowColor: '#4988C4', shadowOpacity: 0.25, shadowRadius: 12 },
};
```

## Animation

### Timing
```typescript
Theme.animation = {
  fast: 120,    // Quick feedback
  normal: 200,  // Standard transition
  slow: 350,    // Deliberate emphasis
};
```

### Easing
```typescript
Theme.easing = {
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeInOut: 'cubic-bezier(0.45, 0, 0.55, 1)',
};
```

## Design Principles

1. **Calm & Trustworthy**: Use the navy/blue color system — avoid oversaturation
2. **Modular**: Group content into clear card-based sections
3. **Accessible**: Maintain high contrast ratios (WCAG AA minimum, AAA preferred)
4. **Responsive**: Design for multiple screen sizes
5. **Premium**: Subtle shadows, refined motion, controlled spacing
6. **Dark by Default**: The app defaults to dark mode (matches institutional software)

## Color Usage Rules

- **60% neutral surfaces** (bgPrimary, bgSurface) — background fills
- **25% brand blue surfaces** (brandNavy, brandCore) — structural elements
- **10% bright blue emphasis** (brandBright) — highlights, CTAs, active states
- **5% accent colors** (success, warning, error) — status indicators

## Migration Checklist

- [x] Color system defined
- [x] ThemeContext updated
- [x] LoginScreen updated
- [ ] Dashboard screens updated
- [ ] Schedule screens updated
- [ ] Teacher/Student/Admin screens reviewed
- [ ] Toast/Alert components updated
- [ ] All hardcoded colors replaced
- [ ] Contrast testing completed
- [ ] Dark/light mode toggle tested

## Related Files

- `src/constants/colors.ts` — Color definitions
- `src/constants/theme.ts` — Design tokens (spacing, radius, shadows, animation)
- `src/contexts/ThemeContext.tsx` — Theme provider and hook
- `docs/BRAND_SYSTEM.md` — Brand guidelines
