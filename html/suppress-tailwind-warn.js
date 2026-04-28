// Suppress the Tailwind CDN production warning.
// cdn.tailwindcss.com is used intentionally in this project.
// This script must be loaded synchronously before cdn.tailwindcss.com.
(function () {
  var _warn = console.warn;
  console.warn = function () {
    if (arguments[0] && String(arguments[0]).indexOf("cdn.tailwindcss.com") >= 0) return;
    _warn.apply(console, arguments);
  };
})();
