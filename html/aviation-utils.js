/**
 * Aviation Utilities - Common calculations for aviation calculators
 */

// Constants
const FT_PER_M = 1 / 0.3048; // ≈ 3.280839895...
const M_PER_FT = 0.3048;
const FT_PER_NM = 1852 / 0.3048; // ≈ 6076.1154855643 ft per NM
const NM_PER_M = 1 / 1852; // Nautical miles per meter
const DEG_TO_RAD = Math.PI / 180;
const KT_TO_MS = 0.514444; // 1 knot in m/s

/**
 * Converts feet to meters
 * @param {number} feet - Value in feet
 * @return {number} Value in meters
 */
function feetToMeters(feet) {
  return feet * M_PER_FT;
}

/**
 * Converts meters to feet
 * @param {number} meters - Value in meters
 * @return {number} Value in feet
 */
function metersToFeet(meters) {
  return meters * FT_PER_M;
}

/**
 * Converts meters to nautical miles
 * @param {number} meters - Value in meters
 * @return {number} Value in nautical miles
 */
function metersToNM(meters) {
  return meters * NM_PER_M;
}

/**
 * Converts nautical miles to meters
 * @param {number} nm - Value in nautical miles
 * @return {number} Value in meters
 */
function nmToMeters(nm) {
  return nm * 1852;
}

/**
 * Calculates the k-factor for TAS calculation
 * @param {number} altitude_ft - Altitude in feet
 * @param {number} isaDeviation - ISA deviation in degrees Celsius
 * @return {number} k-factor
 */
function calculateKFactor(altitude_ft, isaDeviation) {
  return (
    (171233 * Math.sqrt(288 + isaDeviation - 0.00198 * altitude_ft)) /
    Math.pow(288 - 0.00198 * altitude_ft, 2.628)
  );
}

/**
 * Calculates True Airspeed (TAS) from Indicated Airspeed (IAS)
 * @param {number} ias - Indicated Airspeed in knots
 * @param {number} kFactor - k-factor
 * @return {number} True Airspeed in knots
 */
function calculateTAS(ias, kFactor) {
  return ias * kFactor;
}

/**
 * Calculates the transitional distance (X)
 * @param {number} tasPlusWind - TAS plus wind in knots
 * @return {number} Transitional distance in nautical miles
 */
function calculateTransitionalDistance(tasPlusWind) {
  return (15 / 3600) * tasPlusWind;
}

/**
 * Calculates the radius of turn (PANS-OPS Vol II formula)
 * @param {number} tas - True Airspeed in knots
 * @param {number} bankAngle_deg - Bank angle in degrees
 * @return {number} Radius of turn in nautical miles
 */
function calculateRadius(tas, bankAngle_deg) {
  return (tas * tas) / (68625 * Math.tan(bankAngle_deg * DEG_TO_RAD));
}

/**
 * Calculates the rate of turn (PANS-OPS Vol II)
 * @param {number} tas - True Airspeed in knots
 * @param {number} radius_nm - Radius of turn in nautical miles
 * @return {number} Rate of turn in degrees per second
 */
function calculateRateOfTurn(tas, radius_nm) {
  return tas / (111.95 * radius_nm);
}

/**
 * Calculates radius of turn with Rate of Turn cap (max 3°/s per PANS-OPS Vol II)
 * If calculated rate of turn > 3°/s, uses 3°/s to calculate the radius instead
 * @param {number} tas - True Airspeed in knots
 * @param {number} bankAngle_deg - Bank angle in degrees
 * @return {object} Object with { radius, rateOfTurn, rateOfTurnCapped, radiusForCalc }
 *   - radius: uncapped radius
 *   - rateOfTurn: calculated rate of turn
 *   - rateOfTurnCapped: min(rateOfTurn, 3)
 *   - radiusForCalc: radius to use for further calculations (uses capped rate)
 */
function calculateRadiusWithRateOfTurnCap(tas, bankAngle_deg) {
  const radius = calculateRadius(tas, bankAngle_deg);
  const rateOfTurn = calculateRateOfTurn(tas, radius);
  const rateOfTurnCapped = Math.min(rateOfTurn, 3);
  const radiusForCalc =
    rateOfTurnCapped < rateOfTurn
      ? tas / (111.95 * rateOfTurnCapped)
      : radius;

  return {
    radius,
    rateOfTurn,
    rateOfTurnCapped,
    radiusForCalc,
  };
}

/**
 * Calculates the flight distance (d)
 * @param {number} tasPlusWind - TAS plus wind in knots
 * @return {number} Flight distance in nautical miles
 */
function calculateFlightDistance(tasPlusWind) {
  return (3 / 3600) * tasPlusWind;
}

/**
 * Handles unit selection change without converting the displayed value
 * @param {string} inputId - ID of the input element
 * @param {string} unitSelectId - ID of the unit select element
 */
function handleUnitChange(inputId, unitSelectId) {
  const unitSelect = document.getElementById(unitSelectId);

  // Just update the last unit - no conversion in the UI
  unitSelect.dataset.lastUnit = unitSelect.value;

  // No need to convert the value in the input field
  // The conversion will happen only during calculations
}

/**
 * Gets the value from an input in the specified unit for calculations
 * @param {string} inputId - ID of the input element
 * @param {string} unitId - ID of the unit select element
 * @param {string} targetUnit - The unit to convert to ('ft', 'm', etc.)
 * @return {number} The value in the target unit
 */
function getValueInUnit(inputId, unitId, targetUnit) {
  const input = document.getElementById(inputId);
  const unitSelect = document.getElementById(unitId);
  const value = Number.parseFloat(input.value);

  if (isNaN(value)) {
    return Number.NaN;
  }

  const currentUnit = unitSelect.value;

  // If units are the same, no conversion needed
  if (currentUnit === targetUnit) {
    return value;
  }

  // Convert based on the units (handles both 'ft'/'m' and 'feet'/'meters' formats)
  const isFeet = currentUnit === "ft" || currentUnit === "feet";
  const isMeters = currentUnit === "m" || currentUnit === "meters";
  const targetFeet = targetUnit === "ft" || targetUnit === "feet";
  const targetMeters = targetUnit === "m" || targetUnit === "meters";

  if (isFeet && targetMeters) {
    return feetToMeters(value);
  } else if (isMeters && targetFeet) {
    return metersToFeet(value);
  }

  // Default case - no conversion
  return value;
}

/**
 * Initializes all unit selectors
 */
function initializeUnitSelectors() {
  // Get all unit selectors
  const unitSelectors = document.querySelectorAll('select[id$="Unit"]');

  unitSelectors.forEach((selector) => {
    // Save the initial unit
    selector.dataset.lastUnit = selector.value;
  });
}

/**
 * Checks if dark mode is enabled in the parent frame
 */
function checkDarkMode() {
  try {
    if (
      window.parent &&
      window.parent.document.documentElement.classList.contains("dark")
    ) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    console.log("Running in standalone mode");
  }
}

/**
 * Creates a formatted HTML table for Word
 * @param {Object} data - Object containing the data to be displayed
 * @param {string} title - Title of the table
 * @return {string} HTML table
 */
function createHTMLTable(data, title) {
  let htmlContent = `
    <table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">
      <tr style="background:#0c2240;color:#ffffff"><th colspan="2" style="padding:8px;text-align:left;font-weight:bold">${title}</th></tr>
      <tr style="background:#0c2240;color:#ffffff"><th style="padding:8px;text-align:left;font-weight:bold">Parameter</th><th style="padding:8px;text-align:left;font-weight:bold">Value</th></tr>
  `;

  for (const [key, value] of Object.entries(data)) {
    htmlContent += `<tr><td style="padding:8px;text-align:left">${key}</td><td style="padding:8px;text-align:left">${value}</td></tr>`;
  }

  htmlContent += `</table>`;
  return htmlContent;
}

/**
 * Shows a non-blocking toast notification.
 * @param {string} message - Message to display.
 * @param {'success'|'error'|'info'} type - Visual style.
 * @param {number} duration - Auto-dismiss delay in ms (default 3000).
 */
function showToast(message, type = "info", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText =
      "position:fixed;top:1rem;right:1rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;pointer-events:none;";
    document.body.appendChild(container);
  }

  const styles = {
    success: { bg: "#dcfce7", border: "#86efac", text: "#166534" },
    error: { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b" },
    info: { bg: "#e0f2fe", border: "#7dd3fc", text: "#075985" },
  };
  const s = styles[type] || styles.info;

  const toast = document.createElement("div");
  toast.style.cssText = `background:${s.bg};border:1px solid ${s.border};color:${s.text};padding:0.625rem 1rem;border-radius:0.5rem;font-size:0.875rem;max-width:320px;box-shadow:0 2px 8px rgba(0,0,0,0.15);opacity:1;transition:opacity 0.3s ease;pointer-events:auto;`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Copies HTML content to clipboard
 * @param {string} htmlContent - HTML content to be copied
 */
function copyToClipboard(htmlContent) {
  const blob = new Blob([htmlContent], { type: "text/html" });
  navigator.clipboard
    .write([new ClipboardItem({ "text/html": blob })])
    .then(() => {
      showToast("Results copied — paste into Word.", "success");
    })
    .catch((err) => {
      console.error("Copy failed:", err);
      showToast("Copy failed. Check browser permissions.", "error");
    });
}

/**
 * Phase 4.3 — Calculate button animation hook
 * Auto-wires all buttons matching [id^="btnCalc"] on DOMContentLoaded.
 * Adds `.calculating` for the duration of the synchronous compute
 * plus a short tail (300ms) so the progress bar animation completes.
 */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("button[id^='btnCalc']").forEach(function (btn) {
    btn.addEventListener(
      "click",
      function () {
        btn.classList.add("calculating");
        // Remove after a short tail — enough for the CSS progress animation
        setTimeout(function () {
          btn.classList.remove("calculating");
        }, 1400);
      },
      { capture: true, passive: true },
    );
  });
});

/**
 * Phase 9 — Accessibility: focus result regions on reveal.
 * - Adds tabindex="-1" so regions accept programmatic focus.
 * - Derives aria-label from the inner <h2> when not already set.
 * - MutationObserver focuses the region the moment `.hidden` is removed.
 */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll('[role="region"]').forEach(function (el) {
    if (!el.getAttribute("tabindex")) {
      el.setAttribute("tabindex", "-1");
    }
    if (!el.getAttribute("aria-label")) {
      var h2 = el.querySelector("h2");
      if (h2) {
        el.setAttribute("aria-label", h2.textContent.trim());
      }
    }
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (
          m.attributeName === "class" &&
          m.oldValue &&
          m.oldValue.split(" ").includes("hidden") &&
          !el.classList.contains("hidden")
        ) {
          setTimeout(function () {
            el.focus({ preventScroll: false });
          }, 80);
        }
      });
    }).observe(el, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["class"],
    });
  });
});
