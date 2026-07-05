import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#121212',
        paper: '#f7f3ed',
        moss: '#256d53',
        ember: '#d56f3e',
        lagoon: '#2368a2',
        plum: '#704c8f',
      },
      boxShadow: {
        soft: '0 24px 60px rgba(18, 18, 18, 0.12)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        cursor: {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        rise: 'rise 420ms ease-out both',
        cursor: 'cursor 1s ease-in-out infinite',
      },
    },
  },
  plugins: [forms],
};

export default config;
