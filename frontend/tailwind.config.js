/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta oficial Geopixel (idêntica ao dashboard-movidesk).
        gp: {
          navy: "#172C51", // Dark Blue (primária)
          deep: "#0e1d38", // navy mais escuro (fundo command-center)
          abyss: "#0a1526", // fundo base
          teal: "#3F728A", // Teal/Blue
          lightgray: "#F0F0F0",
          offwhite: "#E8EEE2",
          darkgray: "#C6C6C6",
          warn: "#E4703A", // alerta/atenção
          // Barra de acento (assinatura)
          bar1: "#20446E", bar2: "#2C4997", bar3: "#3671B5", bar4: "#489CD5",
          bar5: "#63BECA", bar6: "#64B99B", bar7: "#88C17A", bar8: "#A3C368",
        },
      },
      fontFamily: {
        display: ["var(--font-roboto)", "system-ui", "sans-serif"],
        body: ["var(--font-opensans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(99,190,202,0.10), 0 20px 45px -25px rgba(0,0,0,0.8)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 50px -30px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "accent-bar":
          "linear-gradient(90deg,#20446E,#2C4997,#3671B5,#489CD5,#63BECA,#64B99B,#88C17A,#A3C368)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        sheen: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        sheen: "sheen 8s linear infinite",
      },
    },
  },
  plugins: [],
};
