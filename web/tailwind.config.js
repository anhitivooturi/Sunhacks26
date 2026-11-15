/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        // student app (Person D)
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        hand: ['Caveat', '"Comic Sans MS"', 'cursive'],
      },
      colors: {
        pulse: { 50: '#fff1f2', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48' },
        // student app (Person D)
        ink: '#0f1a17', chalk: '#f4f1e6', hl: '#ffe14d',
        lost: '#ff5a47', slow: '#ff9f1c', fast: '#4cc2ff', got: '#3ddc97', violet: '#8b7bff',
      },
      opacity: { 6: '0.06', 8: '0.08', 12: '0.12' },
    },
  },
  plugins: [],
};
