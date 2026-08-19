/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#fefefe',
          100: '#fdfbf7', // Base background color
          200: '#f7f4ed',
          300: '#ece7db',
        },
        sage: {
          50: '#f4f6f5',
          100: '#e8edea',
          500: '#3a6053', // Primary brand color
          600: '#2e4d42',
          700: '#233a32',
        },
        terracotta: {
          50: '#fdf8f5',
          100: '#fcf2e8',
          500: '#c26d4b', // Accent brand color
          600: '#a65637',
          700: '#874227',
        },
        charcoal: {
          100: '#8e8e8e',
          500: '#525252',
          900: '#2d2d2d', // Base text color
        }
      },
      fontFamily: {
        serif: ['Lora', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'paper': '0 4px 20px -2px rgba(135, 120, 95, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        'paper-hover': '0 10px 25px -5px rgba(135, 120, 95, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}
