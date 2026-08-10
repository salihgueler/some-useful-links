import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#5C4FB3",
        secondary: "#BFECE6",
        lavender: "#E8E4FB",
        accent: "#FFB891",
        supporting: "#FDEDBF",
        background: "#F8F7FC",
        surface: "#FFFFFF",
        ink: "#2A2738",
        muted: "#6C6878",
        border: "#E5E2EC",
        positive: "#186B61",
        "positive-surface": "#DFF4EC",
      },
      borderRadius: {
        sm: "10px",
        md: "13px",
        lg: "16px",
        xl: "17px",
        "2xl": "22px",
        "3xl": "24px",
        full: "50%",
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "Manrope", "DM Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        caption: ["11px", "16px"],
        label: ["13px", "18px"],
        body: ["15px", "22px"],
        link: ["15px", "20px"],
        section: ["18px", "26px"],
        title: ["32px", "40px"],
        dashboard: ["34px", "42px"],
      },
      transitionDuration: {
        fast: "160ms",
        DEFAULT: "200ms",
        modal: "220ms",
        chart: "500ms",
      },
      transitionTimingFunction: {
        DEFAULT: "ease-out",
      },
      boxShadow: {
        row: "0 5px 14px rgba(42, 39, 56, 0.06)",
        "row-hover": "0 9px 20px rgba(42, 39, 56, 0.1)",
        primary: "0 10px 22px rgba(54, 43, 128, 0.2)",
        modal: "0 24px 64px rgba(42, 39, 56, 0.22)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "modal-in": {
          from: { opacity: "0", transform: "translateY(12px) scale(.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 300ms ease-out both",
        "modal-in": "modal-in 220ms ease-out both",
        spin: "spin 800ms linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
