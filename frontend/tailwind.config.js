/** @type {import('tailwindcss').Config} */
// NTS brand colours come from CSS variables so the admin can change them in Site Settings
// (defaults are declared in src/index.css, runtime values are set by src/services/theme.js).
// "green", "emerald", "teal" and "nts-green" are remapped to the brand colour so every
// existing page follows the brand without editing each class.
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const scale = (name, list = shades) =>
  Object.fromEntries(list.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));

const brand = scale('nts');
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        green: brand,
        emerald: brand,
        teal: brand,
        'nts-green': brand,
        'nts-blue': brand,
        'nts-gold': scale('gold', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
      },
    },
  },
  plugins: [],
}
