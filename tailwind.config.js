/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf3',
          100: '#d6f5e3',
          200: '#aee9c8',
          300: '#77d6a5',
          400: '#3fbb7d',
          500: '#22a35f',
          600: '#17864c',
          700: '#146b3f',
          800: '#125535',
          900: '#0f462d',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Noto Sans Devanagari',
          'Nirmala UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
        cta: '0 8px 24px rgba(20, 107, 63, 0.28)',
        nav: '0 -2px 16px rgba(15, 23, 42, 0.08)',
      },
      borderRadius: {
        '4xl': '1.75rem',
      },
    },
  },
  plugins: [],
};
