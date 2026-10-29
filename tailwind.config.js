/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#092C80',          // Primary navy blue
          'navy-hover': '#07246B',  // Slightly darker navy for button hover
          'navy-light': '#143FA8',  // Slightly lighter navy
          'navy-dark': '#051438',   // Deepest navy for dark mode page background
          'navy-surface': '#0B225C',// Dark mode elevated cards
          'navy-subtle': '#0E296E', // Dark mode secondary elements
          'navy-border': '#1A3C8E', // Dark mode subtle borders
          sky: '#C7E5FA',           // Light sky blue
          'sky-light': '#EBF5FD',   // Very soft sky tint for light mode cards/accents
          'sky-border': '#A8D4F5',  // Sky accent border
          grey: '#F3F6FA',          // Soft cool-grey background for light mode
          'grey-subtle': '#E8EFF7', // Slightly deeper cool grey
          dark: '#172B4D',          // Dark text
          muted: '#5E6C84',         // Secondary cool slate text
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(9, 44, 128, 0.05), 0 1px 2px -1px rgba(9, 44, 128, 0.05)',
        'card-hover': '0 4px 6px -1px rgba(9, 44, 128, 0.08), 0 2px 4px -2px rgba(9, 44, 128, 0.06)',
        'elevated': '0 10px 25px -5px rgba(9, 44, 128, 0.1), 0 8px 10px -6px rgba(9, 44, 128, 0.06)',
      }
    },
  },
  plugins: [],
}
