/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        pulse: { 50: '#fff1f2', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48' },
      },
    },
  },
  plugins: [],
};
