/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#050510',
        primary: '#00d2ff',
        secondary: '#bc13fe',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}