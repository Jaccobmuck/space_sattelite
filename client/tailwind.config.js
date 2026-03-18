/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#020817',
        'bg-secondary': '#0a1628',
        'bg-panel': 'rgba(10, 22, 40, 0.85)',
        'border-glow': 'rgba(56, 189, 248, 0.3)',
        'text-primary': '#e2e8f0',
        'text-secondary': '#64748b',
        'accent-blue': '#38bdf8',
        'accent-cyan': '#22d3ee',
        'accent-green': '#4ade80',
        'accent-orange': '#fb923c',
        'accent-red': '#f87171',
        'accent-purple': '#a855f7',
      },
      fontFamily: {
        'orbitron': ['Orbitron', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(56, 189, 248, 0.4)',
        'glow-green': '0 0 20px rgba(74, 222, 128, 0.4)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.4)',
        'glow-orange': '0 0 20px rgba(251, 146, 60, 0.4)',
        'glow-red': '0 0 20px rgba(248, 113, 113, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'glow-pulse': {
          '0%': { boxShadow: '0 0 5px rgba(56, 189, 248, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(56, 189, 248, 0.6)' },
        },
      },
      backdropBlur: {
        'panel': '12px',
      },
    },
  },
  plugins: [],
};
