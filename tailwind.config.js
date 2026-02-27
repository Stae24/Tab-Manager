/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gx: {
          red: '#ff1b1b',
          dark: '#0e0e0e',
          accent: '#7f22fe',
          gray: '#1c1c1c',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
}
