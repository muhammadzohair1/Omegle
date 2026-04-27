/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: '#050505',
        slate: {
          900: '#0f172a',
          800: '#1e293b',
        },
        cyan: {
          neon: '#00F0FF',
        },
        purple: {
          plasma: '#A855F7',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 15px rgba(0, 240, 255, 0.4)',
        'neon-purple': '0 0 15px rgba(168, 85, 247, 0.4)',
        'glass-inset': 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar': 'radar 2s ease-out infinite',
        'running-light': 'running-light 2s linear infinite',
        'live-signal': 'live-signal 1.5s ease-in-out infinite',
      },
      keyframes: {
        radar: {
          '0%': { transform: 'scale(0.5)', opacity: '1' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        'running-light': {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
        'live-signal': {
          '0%, 100%': { transform: 'scaleY(1)', opacity: '1' },
          '50%': { transform: 'scaleY(0.4)', opacity: '0.6' },
        },
      },
      borderRadius: {
        '2xl': '1.5rem', // squircular spec
      }
    },
  },
  plugins: [],
}