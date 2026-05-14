// Shared Tailwind CSS configuration for all calculator pages.
// Loaded with <script src="shared-config.js"></script> after cdn.tailwindcss.com.

// Phase 4.3 — inject distinctive typography (Rajdhani + Barlow + Share Tech Mono)
(function () {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Rajdhani:wght@600;700&family=Share+Tech+Mono&display=swap";
  document.head.appendChild(link);
})();

tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Primary — sky / aviation blue
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        // Phase 1.4 — semantic palette for result status coding
        ok: {
          400: "#34d399", // emerald-400 (dark)
          500: "#10b981", // emerald-500 (light)
          600: "#059669",
        },
        warn: {
          400: "#fbbf24", // amber-400 (dark)
          500: "#f59e0b", // amber-500 (light)
          600: "#d97706",
        },
        danger: {
          400: "#f87171", // red-400 (dark)
          500: "#ef4444", // red-500 (light)
          600: "#dc2626",
        },
        // Panel surfaces — blue-tinted dark card backdrop
        panel: {
          900: "#0a0f1a", // body bg dark
          800: "#1a2235", // card dark
          700: "#141e30", // nested card dark
          border: "#1e3a5f", // border dark
        },
      },
    },
  },
};

window.APP_VERSION = "0.4.0";
