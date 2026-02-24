/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ffd966',
          dark: '#211d1d',
        },
        secondary: {
          DEFAULT: '#fff366',
          light: '#ffffff',
        },
        background: '#0a0808',
        surface: '#1a1616',
        border: '#ffd966',
        'text-primary': '#ffffff',
        'text-secondary': '#aaa',
        'text-inverse': '#0a0a0a',
        accent: '#ffd966',
        'accent-neon': '#00ff88',
      },
      fontFamily: {
        proxima: ['var(--font-proxima)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        geist: ['var(--font-geist)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
