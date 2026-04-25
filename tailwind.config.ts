import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Light mode
        'glass-light': 'rgba(255, 255, 255, 0.65)',
        'glass-light-border': 'rgba(255, 255, 255, 0.4)',
        // Dark mode
        'glass-dark': 'rgba(15, 15, 25, 0.65)',
        'glass-dark-border': 'rgba(255, 255, 255, 0.08)',
        // Backgrounds
        'bg-light': '#F2F2F7',
        'bg-dark': '#090910',
        // Text
        'text-light': '#111111',
        'text-dark': '#E8E8F0',
        // Accents
        'accent-blue': '#4F8EF7',
        'accent-purple': '#A855F7',
        'accent-teal': '#06B6D4',
        'neon-blue': '#3B82F6',
        'neon-purple': '#8B5CF6',
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #4F8EF7 0%, #A855F7 100%)',
        'gradient-accent-dark': 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
      },
      backdropBlur: {
        'glass': '24px',
        'glass-lg': '40px',
      },
      boxShadow: {
        'glass': '0 4px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        'glass-dark': '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glow-blue': '0 0 20px rgba(79,142,247,0.35)',
        'glow-purple': '0 0 20px rgba(168,85,247,0.35)',
        'lift': '0 8px 32px rgba(0,0,0,0.12)',
        'lift-dark': '0 8px 40px rgba(0,0,0,0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-in': 'slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-up': 'fadeUp 0.4s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 10px rgba(79,142,247,0.2)' },
          '100%': { boxShadow: '0 0 25px rgba(168,85,247,0.4)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-mono)', 'SF Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'glass': '16px',
        'glass-sm': '10px',
        'glass-lg': '24px',
      },
    },
  },
  plugins: [],
};

export default config;
