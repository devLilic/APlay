/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        app: '#0B0F14',
        panel: '#111827',
        card: '#1F2937',
        surface: '#1F2937',
        'surface-app': '#0B0F14',
        'surface-panel': '#111827',
        'surface-raised': '#243041',
        'surface-muted': '#182130',
        ink: '#F9FAFB',
        muted: '#9CA3AF',
        disabled: '#4B5563',
        text: {
          primary: '#F9FAFB',
          secondary: '#9CA3AF',
          disabled: '#4B5563',
        },
        accent: {
          DEFAULT: '#22D3EE',
          blue: '#3B82F6',
          cyan: '#22D3EE',
          green: '#22C55E',
          amber: '#F59E0B',
          red: '#EF4444',
        },
        border: {
          DEFAULT: '#243041',
          strong: '#364152',
          muted: '#1A2432',
          focus: '#22D3EE',
          selection: '#3B82F6',
          multi: '#22D3EE',
          active: '#22C55E',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
        state: {
          selected: '#3B82F6',
          multi: '#22D3EE',
          active: '#22C55E',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(148, 163, 184, 0.04)',
      },
      ringColor: {
        DEFAULT: '#22D3EE',
      },
    },
  },
  plugins: [],
}
