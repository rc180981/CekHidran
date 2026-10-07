import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0E7C86',
          50: '#E8F5F6',
          100: '#C7E6E9',
          200: '#94CFD4',
          500: '#13939E',
          600: '#0E7C86',
          700: '#0B636B',
          800: '#094E55',
          900: '#073C41',
        },
        canvas: '#F6F7F9',
        sidebar: { DEFAULT: '#263238', hover: '#33434B', active: '#0E7C86' },
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,40,0.04), 0 4px 14px rgba(16,24,40,0.06)',
      },
      borderRadius: { '2xl': '1rem' },
    },
  },
  plugins: [],
};

export default config;
