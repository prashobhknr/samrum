/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Samrum design tokens
        samrum: {
          header: '#1e2a3a',
          accent: '#f59e0b',
          'accent-hover': '#d97706',
          blue: '#0ea5e9',
          'blue-dark': '#0369a1',
          bg: '#f1f5f9',
          panel: '#ffffff',
          border: '#e2e8f0',
          text: '#1e293b',
          muted: '#64748b',
          tree: '#fbbf24',
          selected: '#dbeafe',
          'selected-text': '#1d4ed8',
        },
        // Keep legacy tokens
        primary: '#0ea5e9',
        secondary: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)',
        nav: '0 2px 8px 0 rgba(0,0,0,0.15)',
      },
    },
  },
  plugins: [],
};
