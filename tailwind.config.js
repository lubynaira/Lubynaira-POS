/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgp: '#0a0a0f',
        bgs: '#111118',
        bgc: '#16161f',
        bge: '#1c1c28',
        accent: {
          DEFAULT: '#8b5cf6',
          light: '#a78bfa',
          dark: '#6366f1',
        },
        success: '#10d98a',
        danger: '#ff4d6a',
        warn: '#f59e0b',
        info: '#3b82f6',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(139,92,246,0.25), 0 0 4px rgba(139,92,246,0.15)',
        'glow-green': '0 0 24px rgba(16,217,138,0.25), 0 0 4px rgba(16,217,138,0.15)',
        premium: '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)',
        'premium-lg': '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease forwards',
        'slide-up': 'slideUp 0.3s ease forwards',
        'scale-in': 'scaleIn 0.2s ease forwards',
      },
    },
  },
  plugins: [],
}
