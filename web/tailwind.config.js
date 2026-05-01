/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  // Disable preflight so existing custom CSS in LandingPage.css / LoginPage.css etc. is not reset.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // Brand palette — per docs/BRAND_SYSTEM.md
        brand: {
          navy: "#0F2854",      // Deep Navy — structural anchor
          core: "#1C4D8D",      // Core Blue — nav, headers, active
          bright: "#4988C4",    // Bright Blue — highlights, active indicators
          ice: "#BDE8F5",       // Ice Blue — wash, glow, hover
        },
      },
      animation: {
        aurora: "aurora 60s linear infinite",
      },
      keyframes: {
        aurora: {
          from: { backgroundPosition: "50% 50%, 50% 50%" },
          to:   { backgroundPosition: "350% 50%, 350% 50%" },
        },
      },
    },
  },
  plugins: [addBrandColorVars],
};

// Expose the brand colors as CSS variables so the aurora gradient can reference them
// as var(--brand-navy), var(--brand-core), var(--brand-bright), var(--brand-ice), plus
// var(--white), var(--black), var(--transparent) used by the component.
function addBrandColorVars({ addBase, theme }) {
  const brand = theme("colors.brand");
  addBase({
    ":root": {
      "--brand-navy": brand.navy,
      "--brand-core": brand.core,
      "--brand-bright": brand.bright,
      "--brand-ice": brand.ice,
      "--white": "#ffffff",
      "--black": "#000000",
      "--transparent": "transparent",
    },
  });
}
