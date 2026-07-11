import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Automotive palette
        ink: {
          DEFAULT: "#0B0B0D", // near-black background
          800: "#141418",
          700: "#1C1C22",
          600: "#26262E",
        },
        surface: {
          DEFAULT: "#F5F3EE", // off-white "window sticker" paper
          muted: "#E7E4DC",
          line: "#D8D4C8",
        },
        amber: {
          // signal-amber accent
          DEFAULT: "#F5A623",
          400: "#F7B547",
          500: "#F5A623",
          600: "#DB9012",
          700: "#B9760C",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 10px 40px -12px rgba(0,0,0,0.55)",
        amber: "0 8px 24px -6px rgba(245,166,35,0.45)",
      },
      keyframes: {
        "fade-slide": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-slide": "fade-slide 0.28s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
