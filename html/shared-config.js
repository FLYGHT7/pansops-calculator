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
      },
    },
  },
};
