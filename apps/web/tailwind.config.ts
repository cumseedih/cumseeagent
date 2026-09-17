import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        accent: "var(--accent)",
      },
      fontFamily: {
        body: ["Delvin Roboto Slab", "Georgia", "serif"],
        display: ["Delvin Oswald", "Impact", "sans-serif"],
        ui: ["Delvin Roboto", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
