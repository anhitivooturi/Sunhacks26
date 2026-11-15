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
        // Professor screens (Person C). "Wait, what?" brand: the emphasis color is the student "Lost" coral,
        // and the neutral scale is tinted toward the chalkboard ink so both apps feel like one product.
        // slate is only used by the professor screens (the student app uses ink/chalk directly).
        pulse: { 50: '#fff1ee', 400: '#ff7a6a', 500: '#ff5a47', 600: '#e5402e' },
        slate: {
          50: '#f7f6f0', 100: '#eeece3', 200: '#dfddd2', 300: '#c4c6bb', 400: '#949b93', 500: '#6b746d',
          600: '#4d5751', 700: '#36413c', 800: '#22302a', 900: '#17241f', 950: '#0f1a17',
        },
        // student app (Person D)
        ink: '#0f1a17', chalk: '#f4f1e6', hl: '#ffe14d',
        lost: '#ff5a47', slow: '#ff9f1c', fast: '#4cc2ff', got: '#3ddc97', violet: '#8b7bff',
      },
      opacity: { 6: '0.06', 8: '0.08', 12: '0.12' },
    },
  },
  plugins: [],
};
