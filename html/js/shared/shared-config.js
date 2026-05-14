// Shared configuration for all calculator pages.

// Phase 4.3 — inject distinctive typography (Rajdhani + Barlow + Share Tech Mono)
(function () {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Rajdhani:wght@600;700&family=Share+Tech+Mono&display=swap";
  document.head.appendChild(link);
})();

window.APP_VERSION = "0.4.0";
