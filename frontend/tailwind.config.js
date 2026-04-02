/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
      colors: {
        background: "#080a0e", // Deep Deep black
        foreground: "#ffffff",
        card: {
          DEFAULT: "#0f1117",
          foreground: "#ffffff",
        },
        primary: {
          DEFAULT: "#6366f1", // Electric Indigo
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#1e293b",
          foreground: "#ffffff",
        },
        accent: {
          DEFAULT: "#8b5cf6", // Purple
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#1e1e2e",
          foreground: "#94a3b8",
        },
        border: "rgba(255, 255, 255, 0.08)",
        ring: "#6366f1",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        "premium-sm": "0 2px 4px 0 rgba(0, 0, 0, 0.4)",
        "premium-md": "0 4px 12px 0 rgba(0, 0, 0, 0.5)",
        "premium-lg": "0 12px 24px -4px rgba(0, 0, 0, 0.6)",
        "indigo-glow": "0 0 20px -5px rgba(99, 102, 241, 0.3)",
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: 1, transform: "scale(1)" },
          "50%": { opacity: 0.5, transform: "scale(1.05)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
