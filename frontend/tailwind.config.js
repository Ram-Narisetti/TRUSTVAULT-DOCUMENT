/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          bg: "#0A0B0D",
          sidebar: "#101114",
          card: "#15161A",
          elevated: "#1C1E23",
          border: "#282A33",
          "border-light": "#363945",
          white: "#FFFFFF",
          text: "#F4F4F6",
          muted: "#9396A1",
          beige: {
            DEFAULT: "#E8DFD8",
            light: "#F5EFEB",
            dark: "#C7B9AA",
            hover: "#DDD3CA",
            glow: "rgba(232, 223, 216, 0.18)",
          },
          error: "#F87171",
          warning: "#FBBF24",
          success: "#34D399",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(0.98)' },
          '50%': { opacity: '0.8', transform: 'scale(1.02)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
        pulseGlow: 'pulseGlow 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
