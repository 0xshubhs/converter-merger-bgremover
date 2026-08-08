import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.12), 0 24px 80px rgba(0,0,0,0.35)'
      },
      colors: {
        ink: '#07111f',
        slateglass: 'rgba(11, 20, 35, 0.72)'
      }
    }
  },
  plugins: []
};

export default config;