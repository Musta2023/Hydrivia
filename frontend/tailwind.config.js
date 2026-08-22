/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        hydra: {
          darkest: '#070a09',
          dark: '#0d1311',
          card: '#121a17',
          cardHover: '#16221e',
          border: '#1e2e28',
          borderHighlight: '#2a423a',
          neon: '#00ff88',
          neonGlow: '#00c26e',
          neonDim: '#00a35c',
          alert: '#ff3b3b',
          alertGlow: '#ff5c5c',
          warning: '#ffaa00',
          info: '#00b4d8',
          textMain: '#e0ece6',
          textMuted: '#8da89c',
          textDim: '#526b60'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'neon': '0 0 15px rgba(0, 255, 136, 0.25)',
        'neon-lg': '0 0 25px rgba(0, 255, 136, 0.4)',
        'alert': '0 0 20px rgba(255, 59, 59, 0.4)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.5)'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 255, 136, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 255, 136, 0.6)' }
        }
      }
    },
  },
  plugins: [],
}
