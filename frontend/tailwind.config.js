/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        background: "#121212",
        surface: "#212121",
        primary: {
          DEFAULT: "#00B0FF",
          hover: "#0091EA",
        },
        text: {
          DEFAULT: "#E0E0E0",
          secondary: "#B0B0B0",
        },
        border: "#424242",
        success: "#4CAF50",
      },
    },
  },
  plugins: [],
};
