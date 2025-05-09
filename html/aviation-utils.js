/**
 * Aviation Utilities - Common calculations for aviation calculators
 */

// Constants
const FT_PER_M = 1 / 0.3048; // ≈ 3.280839895...
const M_PER_FT = 0.3048;
const FT_PER_NM = 1852 / 0.3048; // ≈ 6076.1154855643 ft per NM
const NM_PER_M = 1 / 1852; // Nautical miles per meter

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

  // Convert based on the units
  if (currentUnit === "ft" && targetUnit === "m") {
    return feetToMeters(value);
  } else if (currentUnit === "m" && targetUnit === "ft") {
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
    <table border="1" style="border-collapse: collapse; text-align: center; width: 100%;">
      <tr style="background-color: #f1f5f9;"><th colspan="2">${title}</th></tr>
      <tr style="background-color: #f1f5f9;"><th>Parameter</th><th>Value</th></tr>
  `;

  for (const [key, value] of Object.entries(data)) {
    htmlContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
  }

  htmlContent += `</table>`;
  return htmlContent;
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
      alert("Results copied; paste into Word.");
    })
    .catch((err) => {
      console.error("Copy failed:", err);
    });
}
