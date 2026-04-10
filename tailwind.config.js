/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './config/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        gold: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        cral: {
          bg:      '#0a0a0f',
          surface: '#12121a',
          card:    '#1a1a26',
          border:  '#2a2a40',
          muted:   '#3a3a55',
          text:    '#e8e8f0',
          sub:     '#9090b0',
        }
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'slot-spin': 'slotSpin 0.15s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'shake': 'shake 0.4s ease-in-out infinite',
      },
      keyframes: {
        pulseGold: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        slotSpin: {
          '0%': { transform: 'translateY(0%)' },
          '100%': { transform: 'translateY(-100%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0) rotate(0deg)' },
          '25%': { transform: 'translateX(-5px) rotate(-5deg)' },
          '50%': { transform: 'translateX(5px) rotate(5deg)' },
          '75%': { transform: 'translateX(-5px) rotate(-5deg)' },
        }
      },
      backgroundImage: {
        'gold-shimmer': 'linear-gradient(90deg, transparent 0%, #fbbf24 50%, transparent 100%)',
      }
    },
  },
  plugins: [],
}
