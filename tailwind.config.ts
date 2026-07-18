import type { Config } from "tailwindcss";

/**
 * White-label: every color maps to a --bb-* CSS variable defined per theme
 * (dark/light) and per tenant. NEVER hardcode hex in components — use these
 * tokens so swapping a tenant = swapping the token values at runtime.
 */
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bb-bg)",
        surface: "var(--bb-surface)",
        elevated: "var(--bb-elevated)",
        inset: "var(--bb-inset)",
        border: "var(--bb-border)",
        "border-subtle": "var(--bb-border-subtle)",
        text: {
          DEFAULT: "var(--bb-text)",
          2: "var(--bb-text-2)",
          muted: "var(--bb-text-muted)",
          inverse: "var(--bb-text-inverse)",
        },
        accent: {
          DEFAULT: "var(--bb-accent)",
          hover: "var(--bb-accent-hover)",
          down: "var(--bb-accent-down)",
          wash: "var(--bb-accent-wash)",
        },
        focus: "var(--bb-focus)",
        gold: {
          300: "var(--bb-gold-300)",
          400: "var(--bb-gold-400)",
          500: "var(--bb-gold-500)",
          600: "var(--bb-gold-600)",
          700: "var(--bb-gold-700)",
        },
        pole: {
          red: "var(--bb-pole-red)",
          blue: "var(--bb-pole-blue)",
          white: "var(--bb-pole-white)",
        },
        success: { DEFAULT: "var(--bb-success)", strong: "var(--bb-success-strong)", bg: "var(--bb-success-bg)" },
        warning: { DEFAULT: "var(--bb-warning)", strong: "var(--bb-warning-strong)", bg: "var(--bb-warning-bg)" },
        danger: { DEFAULT: "var(--bb-danger)", strong: "var(--bb-danger-strong)", bg: "var(--bb-danger-bg)" },
        info: { DEFAULT: "var(--bb-info)", bg: "var(--bb-info-bg)" },
        n: {
          50: "var(--bb-n50)", 100: "var(--bb-n100)", 200: "var(--bb-n200)", 300: "var(--bb-n300)",
          400: "var(--bb-n400)", 500: "var(--bb-n500)", 600: "var(--bb-n600)", 700: "var(--bb-n700)",
          800: "var(--bb-n800)", 900: "var(--bb-n900)",
        },
      },
      borderRadius: {
        sm: "var(--bb-radius-sm)",
        md: "var(--bb-radius-md)",
        lg: "var(--bb-radius-lg)",
        pill: "var(--bb-radius-pill)",
      },
      boxShadow: {
        sm: "var(--bb-shadow-sm)",
        md: "var(--bb-shadow-md)",
        lg: "var(--bb-shadow-lg)",
      },
      fontFamily: {
        display: "var(--bb-font-display)",
        ui: "var(--bb-font-ui)",
      },
      fontSize: {
        display: ["64px", { lineHeight: "0.95", fontWeight: "900" }],
        h1: ["48px", { lineHeight: "1.0", fontWeight: "800" }],
        h2: ["32px", { lineHeight: "1.05", fontWeight: "800" }],
        h3: ["24px", { lineHeight: "1.2", fontWeight: "700" }],
        h4: ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        h5: ["16px", { lineHeight: "1.4", fontWeight: "600" }],
        h6: ["14px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "1.5" }],
        body: ["14px", { lineHeight: "1.5" }],
        caption: ["12px", { lineHeight: "1.4" }],
        overline: ["11px", { lineHeight: "1.2", letterSpacing: "0.08em", fontWeight: "600" }],
      },
      zIndex: {
        sticky: "50",
        drawer: "100",
        modal: "200",
        toast: "300",
        tooltip: "400",
      },
      keyframes: {
        "bb-spin": { to: { transform: "rotate(360deg)" } },
        "bb-shimmer": {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "bb-spin": "bb-spin .7s linear infinite",
        "bb-shimmer": "bb-shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
