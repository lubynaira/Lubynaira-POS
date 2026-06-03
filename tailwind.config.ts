import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./styles/**/*.css"
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        coral: "rgb(var(--coral) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)"
      },
      boxShadow: {
        soft: "0 14px 40px rgb(25 31 44 / 0.08)"
      },
      borderRadius: {
        DEFAULT: "8px"
      }
    }
  },
  plugins: []
};

export default config;
