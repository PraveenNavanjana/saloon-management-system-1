/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'background-main': 'var(--background-main)',
        'background-card': 'var(--background-card)',
        'background-surface': 'var(--background-surface)',
        'primary': 'var(--primary-color)',
        'primary-hover': 'var(--primary-hover)',
        'secondary': 'var(--secondary-color)',
        'secondary-hover': 'var(--secondary-hover)',
        'accent': 'var(--accent-color)',
        'accent-hover': 'var(--accent-hover)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-heading': 'var(--text-heading)',
        'text-muted': 'var(--text-muted)',
        'border': 'var(--border-color)',
        'divider': 'var(--divider-color)',
      },
      boxShadow: {
        'card': 'var(--card-shadow)',
        'card-hover': 'var(--card-hover-shadow)',
      }
    },
  },
  plugins: [],
}
