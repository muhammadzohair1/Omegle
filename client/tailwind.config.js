/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f172a',
          secondary: '#1e293b',
          glass: 'rgba(30, 41, 59, 0.7)',
        },
        text: {
          primary: '#f8fafc',
          secondary: '#94a3b8',
        },
        accent: {
          primary: '#6366f1',
          hover: '#4f46e5',
        },
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        radar: 'radar 2s ease-out infinite',
      },
      keyframes: {
        radar: {
          '0%': { transform: 'scale(0.5)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}