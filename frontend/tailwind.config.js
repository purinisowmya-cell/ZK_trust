/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          950: '#030712',
          900: '#070b14',
          800: '#0c1322',
          700: '#141e34',
          600: '#1e2c4a',
          500: '#2b3f68',
          cyan: '#00f0ff',
          neon: '#00e599',
          amber: '#ffb300',
          rose: '#ff3366',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
