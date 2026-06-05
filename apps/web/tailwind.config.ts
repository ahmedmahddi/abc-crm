import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "rgb(var(--color-border) / <alpha-value>)",
        input: "rgb(var(--color-border) / <alpha-value>)",
        ring: "rgb(var(--color-brand-500) / <alpha-value>)",
        background: "rgb(var(--color-bg) / <alpha-value>)",
        foreground: "rgb(var(--color-text) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--color-brand-500) / <alpha-value>)",
          foreground: "rgb(var(--color-surface) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--color-neutral-100) / <alpha-value>)",
          foreground: "rgb(var(--color-text-muted) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          foreground: "rgb(var(--color-text) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--color-error) / <alpha-value>)",
          foreground: "rgb(var(--color-surface) / <alpha-value>)",
        },
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
        brand: {
          50: "rgb(var(--color-brand-100) / <alpha-value>)",
          100: "rgb(var(--color-brand-100) / <alpha-value>)",
          200: "rgb(var(--color-brand-200) / <alpha-value>)",
          300: "rgb(var(--color-brand-300) / <alpha-value>)",
          400: "rgb(var(--color-brand-400) / <alpha-value>)",
          500: "rgb(var(--color-brand-500) / <alpha-value>)",
          600: "rgb(var(--color-brand-600) / <alpha-value>)",
          700: "rgb(var(--color-brand-700) / <alpha-value>)",
          800: "rgb(var(--color-brand-800) / <alpha-value>)",
          900: "rgb(var(--color-brand-900) / <alpha-value>)",
        },
        abcNeutral: {
          50: "rgb(var(--color-neutral-50) / <alpha-value>)",
          100: "rgb(var(--color-neutral-100) / <alpha-value>)",
          200: "rgb(var(--color-neutral-200) / <alpha-value>)",
          300: "rgb(var(--color-neutral-300) / <alpha-value>)",
          400: "rgb(var(--color-neutral-400) / <alpha-value>)",
          500: "rgb(var(--color-neutral-500) / <alpha-value>)",
          600: "rgb(var(--color-neutral-600) / <alpha-value>)",
          700: "rgb(var(--color-neutral-700) / <alpha-value>)",
          800: "rgb(var(--color-neutral-800) / <alpha-value>)",
          900: "rgb(var(--color-neutral-900) / <alpha-value>)",
          950: "rgb(var(--color-neutral-950) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        soft: "var(--shadow-sm)",
      },
      fontFamily: {
        body: "var(--font-body)",
        display: "var(--font-display)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
      },
      transitionTimingFunction: {
        "abc-out": "var(--ease-out)",
        "abc-in-out": "var(--ease-in-out)",
        "abc-spring": "var(--ease-spring)",
      },
    },
  },
  plugins: [],
};

export default config;
