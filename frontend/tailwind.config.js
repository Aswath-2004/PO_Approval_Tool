/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["'Cormorant Garamond'", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "'Courier New'", "monospace"],
      },
      colors: {
        gold: { DEFAULT: "#B8860B", light: "#D4A017", pale: "#FDF6E3" },
        ink: { DEFAULT: "#1A1A2E", soft: "#2D2D44" },
      },
    },
  },
  plugins: [],
};
