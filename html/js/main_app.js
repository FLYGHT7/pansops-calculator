// Initialize i18n for Main shell (sidebar labels, headings)
(function () {
  function initI18n() {
    if (window.I18N && typeof I18N.init === "function") {
      I18N.init({
        defaultLang: "en",
        supported: ["en", "es"],
        path: "i18n",
      }).catch(console.error);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initI18n);
  } else {
    initI18n();
  }
})();

// Check if we're on mobile
const isMobile = () => window.innerWidth < 768;

// Initialize sidebar state based on screen size
document.addEventListener("DOMContentLoaded", function () {
  if (isMobile()) {
    closeSidebar(false); // Don't animate on initial load
  }

  // Initialize touch events for swipe gestures
  initTouchEvents();
});

// Handle window resize
window.addEventListener("resize", function () {
  if (isMobile()) {
    closeSidebar(false);
  } else {
    openSidebar(false);
  }
});

// Initialize touch events for swipe gestures
function initTouchEvents() {
  const swipeArea = document.getElementById("swipeArea");
  const sidebar = document.getElementById("sidebar");
  let touchStartX = 0;
  let touchEndX = 0;

  // For the edge swipe to open sidebar
  swipeArea.addEventListener(
    "touchstart",
    function (e) {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true },
  );

  swipeArea.addEventListener(
    "touchend",
    function (e) {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipeGesture(touchStartX, touchEndX);
    },
    { passive: true },
  );

  // For swiping the sidebar closed
  sidebar.addEventListener(
    "touchstart",
    function (e) {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true },
  );

  sidebar.addEventListener(
    "touchend",
    function (e) {
      touchEndX = e.changedTouches[0].screenX;
      handleSidebarSwipe(touchStartX, touchEndX);
    },
    { passive: true },
  );

  // For the main content area - to detect swipes
  document.addEventListener(
    "touchstart",
    function (e) {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchend",
    function (e) {
      touchEndX = e.changedTouches[0].screenX;
      // Only process if we're not in the sidebar or swipe area
      if (!sidebar.contains(e.target) && !swipeArea.contains(e.target)) {
        handleContentSwipe(touchStartX, touchEndX);
      }
    },
    { passive: true },
  );
}

// Handle swipe gesture from edge
function handleSwipeGesture(startX, endX) {
  const swipeThreshold = 50; // Minimum distance required for a swipe

  if (endX - startX > swipeThreshold) {
    // Right swipe from left edge
    openSidebar();
  }
}

// Handle swipe gesture within sidebar
function handleSidebarSwipe(startX, endX) {
  const swipeThreshold = 100; // Larger threshold for sidebar close

  if (startX - endX > swipeThreshold && isMobile()) {
    // Left swipe within sidebar
    closeSidebar();
  }
}

// Handle swipe gesture in content area
function handleContentSwipe(startX, endX) {
  const swipeThreshold = 100;
  const sidebar = document.getElementById("sidebar");

  if (
    endX - startX > swipeThreshold &&
    isMobile() &&
    sidebar.classList.contains("sidebar-closed")
  ) {
    // Right swipe in content area when sidebar is closed
    openSidebar();
  } else if (
    startX - endX > swipeThreshold &&
    isMobile() &&
    !sidebar.classList.contains("sidebar-closed")
  ) {
    // Left swipe in content area when sidebar is open
    closeSidebar();
  }
}

// Open sidebar function
function openSidebar(animate = true) {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (animate) {
    sidebar.classList.add("transition-transform");
  } else {
    sidebar.classList.remove("transition-transform");
  }

  sidebar.classList.remove("sidebar-closed");
  overlay.classList.remove("hidden");

  // Add haptic feedback if available
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
}

// Close sidebar function
function closeSidebar(animate = true) {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (animate) {
    sidebar.classList.add("transition-transform");
  } else {
    sidebar.classList.remove("transition-transform");
  }

  if (isMobile()) {
    sidebar.classList.add("sidebar-closed");
    overlay.classList.add("hidden");

    // Add haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }
}

// Hash ↔ page mapping (4.1 hash routing)
const PAGE_MAP = {
  "#isa": { url: "calculators/isa_deviation.html", buttonId: "isaButton" },
  "#tas": { url: "calculators/tas.html", buttonId: "tasButton" },
  "#rate-turn": { url: "calculators/rate_turn.html", buttonId: "rateTurnButton" },
  "#dme": { url: "calculators/dme_tolerance.html", buttonId: "dmeButton" },
  "#profile": { url: "calculators/profile_check.html", buttonId: "elevationButton" },
  "#faf-estimator": { url: "calculators/faf_estimator.html", buttonId: "fafEstimatorButton" },
  "#npa-soc": {
    url: "calculators/npa_soc.html",
    buttonId: "npaSocButton",
  },
  "#vss-ocs": { url: "calculators/vss_ocs.html", buttonId: "vssOcsButton" },
  "#omni-sid": { url: "calculators/omni.html", buttonId: "omniSidButton" },
  "#wind-spiral": {
    url: "calculators/wind_spiral.html",
    buttonId: "windSpiralButton",
  },
  "#flyover": {
    url: "calculators/flyover_calculation.html",
    buttonId: "flyoverButton",
  },
  "#flyby": {
    url: "calculators/flyby_calculation.html",
    buttonId: "flybyButton",
  },
  "#msd": {
    url: "calculators/msd_calculation.html",
    buttonId: "msdCombinedButton",
  },
  "#circling": {
    url: "calculators/circling_parameters.html",
    buttonId: "circlingButton",
  },
  "#ils-height": {
    url: "calculators/ils_height.html",
    buttonId: "ilsHeightButton",
  },
  "#ils-distance": {
    url: "calculators/ils_distance.html",
    buttonId: "ilsDistanceButton",
  },
  "#bearings": {
    url: "calculators/bearings_angles.html",
    buttonId: "bearingsAnglesButton",
  },
  "#about": { url: "calculators/about.html", buttonId: "aboutButton" },
};
// Reverse lookup: url → hash
const URL_TO_HASH = Object.fromEntries(
  Object.entries(PAGE_MAP).map(([hash, { url }]) => [url, hash]),
);

// Pending navigation timer — cancelled on rapid successive clicks (fix #37)
let _navTimer = null;

// Phase 2.5 — display names for desktop topbar breadcrumb
const PAGE_TITLES = {
  "calculators/isa_deviation.html": "ISA Deviation",
  "calculators/tas.html": "True Airspeed",
  "calculators/rate_turn.html": "Rate & Radius of Turn",
  "calculators/dme_tolerance.html": "DME Tolerance",
  "calculators/profile_check.html": "Profile Estimator",
  "calculators/faf_estimator.html": "FAF Estimator",
  "calculators/rod_timing.html": "GS / Rate of Descent",
  "calculators/npa_soc.html": "NPA SOC Calculation",
  "calculators/vss_ocs.html": "VSS / OCS Parameters",
  "calculators/flyover_calculation.html": "Flyover MSD",
  "calculators/msd_calculation.html": "MSD Combined",
  "calculators/circling_parameters.html": "Circling Protection Area",
  "calculators/ils_height.html": "ILS Height Calculations",
  "calculators/ils_distance.html": "ILS Distance Calculations",
  "calculators/bearings_angles.html": "Bearings & Angles",
  "calculators/about.html": "About",
};

// Load page in iframe and update active button - OPTIMIZED
function loadPage(pageUrl, buttonElement) {
  const iframe = document.getElementById("iframe");

  // Push hash to browser history so back/forward works
  const hash = URL_TO_HASH[pageUrl];
  if (hash && location.hash !== hash) {
    history.pushState({ pageUrl, buttonId: buttonElement.id }, "", hash);
  }

  // Save state immediately (synchronous)
  localStorage.setItem("lastPage", pageUrl);
  localStorage.setItem("lastButtonId", buttonElement.id);

  // Update topbar breadcrumb
  const topbarTitle = document.getElementById("topbarPageTitle");
  if (topbarTitle)
    topbarTitle.textContent =
      PAGE_TITLES[pageUrl] || pageUrl.replace(".html", "");

  // Update UI immediately (no delay)
  document.querySelectorAll(".sidebar-item").forEach((btn) => {
    btn.classList.remove("active");
    btn.removeAttribute("aria-current");
  });
  buttonElement.classList.add("active");
  buttonElement.setAttribute("aria-current", "page");

  // Ensure active item is visible in the list
  try {
    buttonElement.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  } catch {}

  // Close sidebar on mobile
  if (window.innerWidth < 768) {
    closeSidebar();
  }

  // Load page with language parameter
  const lang = localStorage.getItem("lang") || "en";
  const url = new URL(pageUrl, window.location.href);
  url.searchParams.set("lang", lang);

  // Cancel any in-flight navigation (rapid clicks) before starting a new one
  clearTimeout(_navTimer);
  iframe.onload = null;

  // Fade out → swap src → fade in (fix #37 flicker)
  iframe.classList.add("loading");

  // Wait for the CSS fade-out (200ms) before swapping src so the old
  // content is fully invisible when the blank document briefly appears.
  const FADE_MS = 200;
  _navTimer = setTimeout(() => {
    iframe.src = url.toString();

    // Capture the nav sequence so a stale onload from a previous
    // navigation cannot accidentally show/hide the wrong state.
    const navSrc = url.toString();

    iframe.onload = function () {
      // Guard: ignore if another navigation already changed src
      if (iframe.src !== navSrc) return;

      const isDark = document.documentElement.classList.contains("dark");

      try {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow.document;

        // Apply dark mode
        if (isDark) {
          iframeDoc.documentElement.classList.add("dark");
        }

        // Also force-set language inside the iframe in case the page ignores ?lang
        try {
          const iw = iframe.contentWindow;
          if (
            iw &&
            iw.I18N &&
            typeof iw.I18N.setLanguage === "function"
          ) {
            iw.I18N.setLanguage(lang).catch(() => {});
          }
        } catch {}
      } catch (e) {
        console.error("Error setting iframe properties:", e);
      }

      // Fade the new page in
      iframe.classList.remove("loading");

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(15);
      }
    };
  }, FADE_MS);
}

// Dark mode functionality
document.addEventListener("DOMContentLoaded", function () {
  const darkModeToggle = document.getElementById("darkModeToggle");
  const darkModeIndicator = document.getElementById("darkModeIndicator");
  const html = document.documentElement;
  const iframe = document.getElementById("iframe");
  const sidebar = document.getElementById("sidebar");
  const langSelectGlobal = document.getElementById("langSelectGlobal");

  // Helper: load a page by url+buttonId and apply iframe dark mode + lang
  function _applyIframeDefaults() {
    const lang = localStorage.getItem("lang") || "en";
    iframe.onload = function () {
      try {
        const idoc = iframe.contentDocument || iframe.contentWindow.document;
        if (document.documentElement.classList.contains("dark")) {
          idoc?.documentElement?.classList?.add("dark");
        }
        const scale = localStorage.getItem("pansops-font-scale");
        if (idoc?.documentElement) {
          idoc.documentElement.style.fontSize = (scale === "large") ? "112.5%" : "";
        }
        try {
          const iw = iframe.contentWindow;
          if (
            iw &&
            iw.I18N &&
            typeof iw.I18N.setLanguage === "function"
          ) {
            iw.I18N.setLanguage(lang).catch(() => {});
          }
        } catch {}
      } catch {}
    };
    return lang;
  }

  function _activateButton(btn) {
    document.querySelectorAll(".sidebar-item").forEach((b) => {
      b.classList.remove("active");
      b.removeAttribute("aria-current");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-current", "page");
    try {
      btn.scrollIntoView({ block: "nearest" });
    } catch {}
  }

  function _loadByPageUrl(pageUrl, buttonId) {
    const btn = document.getElementById(buttonId);
    if (!btn) return false;
    _activateButton(btn);
    // Update topbar breadcrumb
    const topbarTitle = document.getElementById("topbarPageTitle");
    if (topbarTitle)
      topbarTitle.textContent =
        PAGE_TITLES[pageUrl] || pageUrl.replace(".html", "");
    const lang = _applyIframeDefaults();
    const url = new URL(pageUrl, window.location.href);
    url.searchParams.set("lang", lang);
    iframe.src = url.toString();
    return true;
  }

  // popstate — browser back/forward
  window.addEventListener("popstate", function (e) {
    const hash = location.hash;
    const entry = PAGE_MAP[hash];
    if (entry) {
      _loadByPageUrl(entry.url, entry.buttonId);
      localStorage.setItem("lastPage", entry.url);
      localStorage.setItem("lastButtonId", entry.buttonId);
    }
  });

  // Restore last active page — hash wins over localStorage - OPTIMIZED
  (function restoreLastPage() {
    // 1. Try URL hash first (shared link / browser back)
    const hashEntry = PAGE_MAP[location.hash];
    if (hashEntry) {
      _loadByPageUrl(hashEntry.url, hashEntry.buttonId);
      localStorage.setItem("lastPage", hashEntry.url);
      localStorage.setItem("lastButtonId", hashEntry.buttonId);
      return;
    }

    // 2. Fall back to localStorage
    const lastPage = localStorage.getItem("lastPage");
    const lastButtonId = localStorage.getItem("lastButtonId");

    if (lastPage && lastButtonId) {
      if (_loadByPageUrl(lastPage, lastButtonId)) {
        // Push hash so the address bar reflects the restored page
        const restoredHash = URL_TO_HASH[lastPage];
        if (restoredHash)
          history.replaceState(
            { pageUrl: lastPage, buttonId: lastButtonId },
            "",
            restoredHash,
          );
        return;
      }
    }

    // 3. Default: load ISA
    const lang = localStorage.getItem("lang") || "en";
    const url = new URL("calculators/isa_deviation.html", window.location.href);
    url.searchParams.set("lang", lang);
    iframe.onload = function () {
      try {
        if (document.documentElement.classList.contains("dark")) {
          const idoc =
            iframe.contentDocument || iframe.contentWindow.document;
          idoc?.documentElement?.classList?.add("dark");
        }
        // Force-set language inside the iframe as an extra safeguard
        try {
          const iw = iframe.contentWindow;
          if (
            iw &&
            iw.I18N &&
            typeof iw.I18N.setLanguage === "function"
          ) {
            iw.I18N.setLanguage(lang).catch(() => {});
          }
        } catch {}
      } catch {}
    };
    iframe.src = url.toString();
  })(); // Dark mode - OPTIMIZED
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;

  // Apply initial theme
  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    html.classList.add("dark");
    darkModeIndicator.style.transform = "translateX(100%)";
  }

  // Toggle dark mode
  darkModeToggle.addEventListener("click", function () {
    const isDark = html.classList.toggle("dark");
    // Phase 8 — icon spin animation
    darkModeToggle.classList.add("dark-toggle-animating");
    setTimeout(function () {
      darkModeToggle.classList.remove("dark-toggle-animating");
    }, 430);
    darkModeIndicator.style.transform = isDark
      ? "translateX(100%)"
      : "translateX(0)";
    localStorage.setItem("theme", isDark ? "dark" : "light");

    // Apply to iframe immediately
    try {
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDoc?.documentElement) {
        if (isDark) {
          iframeDoc.documentElement.classList.add("dark");
        } else {
          iframeDoc.documentElement.classList.remove("dark");
        }
      }
    } catch (e) {}

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }
  });

  // Font size toggle
  const fontSizeToggle = document.getElementById("fontSizeToggle");
  const savedScale = localStorage.getItem("pansops-font-scale");
  if (savedScale === "large") {
    html.style.fontSize = "112.5%";
    fontSizeToggle?.classList.add("bg-white/10");
  }
  if (fontSizeToggle) {
    fontSizeToggle.addEventListener("click", function () {
      const isLarge = html.style.fontSize === "112.5%";
      const nextSize = isLarge ? "" : "112.5%";
      html.style.fontSize = nextSize;
      localStorage.setItem("pansops-font-scale", isLarge ? "normal" : "large");
      fontSizeToggle.classList.toggle("bg-white/10", !isLarge);
      try {
        const idoc = iframe.contentDocument || iframe.contentWindow.document;
        if (idoc?.documentElement) idoc.documentElement.style.fontSize = nextSize;
      } catch (e) {}
      if (navigator.vibrate) navigator.vibrate(15);
    });
  }

  // Initialize and handle language changes globally - OPTIMIZED
  (function initLanguage() {
    const savedLang = localStorage.getItem("lang") || "en";

    if (langSelectGlobal) {
      langSelectGlobal.value = savedLang;
      langSelectGlobal.addEventListener("change", function (e) {
        const lang = e.target.value;
        localStorage.setItem("lang", lang);

        // Update Main shell translations immediately
        try {
          if (window.I18N && typeof I18N.setLanguage === "function") {
            I18N.setLanguage(lang).catch(console.error);
          }
        } catch (e) {}

        // Simply reload the iframe with new lang parameter
        const currentSrc = iframe.src;
        const url = new URL(currentSrc);
        url.searchParams.set("lang", lang);
        // Assign new URL and also set language after load to ensure immediate update
        iframe.onload = function () {
          try {
            const iw = iframe.contentWindow;
            if (
              iw &&
              iw.I18N &&
              typeof iw.I18N.setLanguage === "function"
            ) {
              iw.I18N.setLanguage(lang).catch(() => {});
            }
          } catch {}
        };
        iframe.src = url.toString();

        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      });
    }
  })();

  // Sync mobile header controls with topbar equivalents
  (function syncMobileControls() {
    const darkModeToggleMobile = document.getElementById(
      "darkModeToggleMobile",
    );
    const langSelectMobile = document.getElementById("langSelectMobile");
    if (darkModeToggleMobile) {
      darkModeToggleMobile.addEventListener("click", function () {
        darkModeToggle.click();
      });
    }
    if (langSelectMobile) {
      langSelectMobile.value = localStorage.getItem("lang") || "en";
      langSelectMobile.addEventListener("change", function (e) {
        if (langSelectGlobal) {
          langSelectGlobal.value = e.target.value;
          langSelectGlobal.dispatchEvent(new Event("change"));
        }
      });
    }
  })();

  // Sidebar scroll shadows
  function updateSidebarShadows() {
    try {
      const atTop = sidebar.scrollTop <= 0;
      const atBottom =
        Math.ceil(sidebar.scrollTop + sidebar.clientHeight) >=
        sidebar.scrollHeight;
      sidebar.classList.toggle("shadow-top", !atTop);
      sidebar.classList.toggle("shadow-bottom", !atBottom);
    } catch {}
  }
  if (sidebar) {
    sidebar.addEventListener("scroll", updateSidebarShadows, {
      passive: true,
    });
    // Initial state after content settles
    setTimeout(updateSidebarShadows, 50);
  }
});

// Prevent iframe content from scrolling the main page on tablets
document.addEventListener("DOMContentLoaded", function () {
  const iframe = document.getElementById("iframe");

  iframe.addEventListener("load", function () {
    try {
      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow.document;

      // Prevent touchmove events from propagating to parent
      iframeDoc.addEventListener(
        "touchmove",
        function (e) {
          e.stopPropagation();
        },
        { passive: true },
      );
    } catch (e) {
      console.error("Error setting up iframe touch handling:", e);
    }
  });
});

// =====================================================
// Phase 10 — Sidebar Collapse + Section Accordion
// =====================================================
document.addEventListener("DOMContentLoaded", function () {
  var sidebar = document.getElementById("sidebar");
  var collapseBtn = document.getElementById("sidebarCollapseBtn");
  var chevronIcon = collapseBtn
    ? collapseBtn.querySelector(".chevron-icon")
    : null;

  // ── 10.1 Restore sidebar rail state ──────────────────
  var isExpanded = localStorage.getItem("sidebarExpanded") !== "false";
  if (!isExpanded && sidebar) {
    sidebar.classList.add("rail");
  }
  if (chevronIcon && !isExpanded) {
    chevronIcon.style.transform = "rotate(180deg)";
  }

  // ── 10.5 Collapse button click ────────────────────────
  if (collapseBtn && sidebar) {
    collapseBtn.addEventListener("click", function () {
      var nowRail = sidebar.classList.toggle("rail");
      localStorage.setItem("sidebarExpanded", String(!nowRail));
      if (chevronIcon) {
        chevronIcon.style.transform = nowRail ? "rotate(180deg)" : "";
      }
      collapseBtn.setAttribute(
        "aria-label",
        nowRail ? "Expand sidebar" : "Collapse sidebar",
      );
    });
  }

  // ── 10.3 Section accordion ────────────────────────────
  document
    .querySelectorAll(".section-header[data-section]")
    .forEach(function (header) {
      var sectionName = header.getAttribute("data-section");
      var group = document.querySelector(
        ".section-group[data-for='" + sectionName + "']",
      );
      if (!group) return;

      // Restore collapsed state
      var isCollapsed =
        localStorage.getItem("section-" + sectionName + "-collapsed") ===
        "true";
      if (isCollapsed) {
        header.classList.add("collapsed");
        group.classList.add("collapsed");
      }

      header.addEventListener("click", function () {
        // Don't collapse sections while in rail mode (icons need to stay visible)
        if (sidebar && sidebar.classList.contains("rail")) return;

        var nowCollapsed = header.classList.toggle("collapsed");
        group.classList.toggle("collapsed", nowCollapsed);
        localStorage.setItem(
          "section-" + sectionName + "-collapsed",
          String(nowCollapsed),
        );
      });
    });
});
// END PHASE 10
