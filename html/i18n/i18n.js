// Minimal JSON-based i18n loader (no auto-translation)
// Usage:
//  - add data-i18n="key" to elements containing text, optional data-i18n-attr="placeholder|value|aria-label" to target attributes
//  - call I18N.init({ defaultLang: 'en', supported: ['en','es'], path: 'i18n' })
//  - call I18N.setLanguage('es') to switch

const I18N = (function () {
  let current = "en";
  let dict = {};
  let config = { defaultLang: "en", supported: ["en"], path: "i18n" };

  // Helper: read lang from query string (?lang=es)
  function getQueryLang() {
    try {
      const qs = new URLSearchParams(window.location.search);
      const v = (qs.get("lang") || "").trim();
      if (v) return v;
    } catch {}
    return null;
  }

  function getStoredLang() {
    try {
      return localStorage.getItem("lang");
    } catch {
      return null;
    }
  }

  function storeLang(lang) {
    try {
      localStorage.setItem("lang", lang);
    } catch {}
  }

  async function load(lang) {
    const url = `${config.path}/${lang}.json`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load translations: ${url}`);
    dict = await res.json();
    current = lang;
  }

  function apply() {
    const nodes = document.querySelectorAll("[data-i18n]");

    nodes.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const attr = el.getAttribute("data-i18n-attr");
      const value = get(key);

      if (value == null) return;

      if (attr) {
        // Support multiple attributes separated by comma
        attr.split(",").forEach((a) => {
          const name = a.trim();
          if (name) el.setAttribute(name, value);
        });
      } else {
        el.innerHTML = value;
      }
    });
  }

  function get(key, fallback) {
    const parts = key.split(".");
    let cur = dict;
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
        cur = cur[p];
      } else {
        return fallback;
      }
    }
    return cur;
  }

  async function init(options = {}) {
    config = { ...config, ...options };
    // Prefer explicit ?lang=xx in the URL, then stored, then navigator
    const urlLang = getQueryLang();
    const initial =
      urlLang ||
      getStoredLang() ||
      navigator.language?.slice(0, 2) ||
      config.defaultLang;
    const lang = config.supported.includes(initial)
      ? initial
      : config.defaultLang;

    await load(lang);
    apply();
  }

  async function setLanguage(lang) {
    if (lang === current) return;
    if (!config.supported.includes(lang)) return;
    await load(lang);
    storeLang(lang);
    apply();
  }

  return { init, setLanguage, get, apply };
})();

// Expose on window for cross-frame access and for guards like `if (window.I18N)`
try {
  if (typeof window !== "undefined") {
    // Avoid overwriting if already set by another inclusion
    if (!window.I18N) {
      window.I18N = I18N;
    }
  }
} catch {}
