// Check for dark mode on page load
document.addEventListener("DOMContentLoaded", function () {
  // Check if parent has set dark mode
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

  // Initialize unit selectors
  initializeUnitSelectors();

  // Event bindings
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", function () {
    document.getElementById("loadFile").click();
  });
  document
    .getElementById("loadFile")
    .addEventListener("change", loadParameters);
  document.getElementById("navaidUnit").addEventListener("change", function () {
    handleUnitChange("navaidElevation", "navaidUnit");
  });
  document
    .getElementById("aircraftUnit")
    .addEventListener("change", function () {
      handleUnitChange("aircraftElevation", "aircraftUnit");
    });
  document
    .getElementById("btnCalculate")
    .addEventListener("click", calculateSlantRange);
  document
    .getElementById("btnCopy")
    .addEventListener("click", copyResultsToClipboard);
});

// Function to handle unit conversion when unit selector changes
function handleUnitChange(inputId, unitSelectId) {
  const unitSelect = document.getElementById(unitSelectId);

  // Just update the last unit - no conversion in the UI
  unitSelect.dataset.lastUnit = unitSelect.value;

  // No need to convert the value in the input field
  // The conversion will happen only during calculations
}

// Function to initialize all unit selectors
function initializeUnitSelectors() {
  // Get all unit selectors
  const unitSelectors = document.querySelectorAll('select[id$="Unit"]');

  unitSelectors.forEach((selector) => {
    // Save the initial unit
    selector.dataset.lastUnit = selector.value;
  });
}

// --- Load/Save Functions ---
function loadParameters(event) {
  const file = event.target.files[0];
  if (!file) {
    showToast("Please select a valid JSON file.", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data["Navaid Elevation"]) {
        document.getElementById("navaidElevation").value =
          data["Navaid Elevation"];
      }
      if (data["Navaid Unit"]) {
        const unitSelect = document.getElementById("navaidUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["Navaid Unit"];
      }
      if (data["Fix Ground Distance"]) {
        document.getElementById("groundDistance").value =
          data["Fix Ground Distance"];
      }
      if (data["Aircraft Elevation"]) {
        document.getElementById("aircraftElevation").value =
          data["Aircraft Elevation"];
      }
      if (data["Aircraft Unit"]) {
        const unitSelect = document.getElementById("aircraftUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["Aircraft Unit"];
      }
      showToast("Parameters successfully loaded!", "success");
    } catch (err) {
      showToast(
        "Invalid JSON file. Please upload a valid parameters file.",
        "error",
      );
    }
  };
  reader.readAsText(file);
}

function saveParameters() {
  const navaidElevation =
    document.getElementById("navaidElevation").value || "";
  const navaidUnit = document.getElementById("navaidUnit").value || "feet";
  const groundDistance = document.getElementById("groundDistance").value || "";
  const aircraftElevation =
    document.getElementById("aircraftElevation").value || "";
  const aircraftUnit = document.getElementById("aircraftUnit").value || "feet";

  const data = {
    "Navaid Elevation": navaidElevation,
    "Navaid Unit": navaidUnit,
    "Fix Ground Distance": groundDistance,
    "Aircraft Elevation": aircraftElevation,
    "Aircraft Unit": aircraftUnit,
  };

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_dmetolerance.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// --- Calculation Functions ---
function calculateSlantRange() {
  const navaidElevationInput = parseFloat(
    document.getElementById("navaidElevation").value,
  );
  const navaidUnit = document.getElementById("navaidUnit").value;
  const groundDistance = parseFloat(
    document.getElementById("groundDistance").value,
  );
  const aircraftElevationInput = parseFloat(
    document.getElementById("aircraftElevation").value,
  );
  const aircraftUnit = document.getElementById("aircraftUnit").value;

  if (
    isNaN(navaidElevationInput) ||
    isNaN(groundDistance) ||
    isNaN(aircraftElevationInput)
  ) {
    showToast("Please enter valid values for all inputs.", "error");
    return;
  }

  // Convert elevations to feet if in meters
  let navaidElevation = navaidElevationInput;
  let aircraftElevation = aircraftElevationInput;
  if (navaidUnit === "meters") {
    navaidElevation = navaidElevationInput / 0.3048;
  }
  if (aircraftUnit === "meters") {
    aircraftElevation = aircraftElevationInput / 0.3048;
  }

  // Conversion factor for NM to feet.
  const conversionFactor = 1852 / 0.3048;
  const groundDistanceFeet = groundDistance * conversionFactor;

  // Calculate vertical difference.
  const verticalDifference = aircraftElevation - navaidElevation;
  const slantRangeFeet = Math.sqrt(
    Math.pow(groundDistanceFeet, 2) + Math.pow(verticalDifference, 2),
  );

  // Convert slant range back to NM.
  const slantRangeNM = slantRangeFeet / conversionFactor;

  // Calculate DME tolerance: ± (0.25 NM + 1.25% of slant range)
  const dmeTolerance = 0.25 + 0.0125 * slantRangeNM;

  // Additional calculated values.
  const slantRangeMin = slantRangeNM - dmeTolerance;
  const slantRangeMax = slantRangeNM + dmeTolerance;

  document.getElementById("slantRange").textContent = slantRangeNM.toFixed(4);
  document.getElementById("dmeTolerance").textContent = dmeTolerance.toFixed(4);
  document.getElementById("slantRangeMin").textContent =
    slantRangeMin.toFixed(4);
  document.getElementById("slantRangeMax").textContent =
    slantRangeMax.toFixed(4);
  document.getElementById("results").classList.remove("hidden");
}

// --- Copy Results Function ---
function copyResultsToClipboard() {
  const navaidElevation =
    document.getElementById("navaidElevation").value || "N/A";
  const navaidUnit = document.getElementById("navaidUnit").value || "N/A";
  const groundDistance =
    document.getElementById("groundDistance").value || "N/A";
  const aircraftElevation =
    document.getElementById("aircraftElevation").value || "N/A";
  const aircraftUnit = document.getElementById("aircraftUnit").value || "N/A";
  const slantRange = document.getElementById("slantRange").textContent || "N/A";
  const dmeTolerance =
    document.getElementById("dmeTolerance").textContent || "N/A";
  const slantRangeMin =
    document.getElementById("slantRangeMin").textContent || "N/A";
  const slantRangeMax =
    document.getElementById("slantRangeMax").textContent || "N/A";

  const htmlContent = `
        <table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">
          <tr style="background:#0c2240;color:#ffffff"><th style="padding:8px;text-align:left;font-weight:bold">Parameter</th><th style="padding:8px;text-align:left;font-weight:bold">Value</th></tr>
          <tr><td style="padding:8px;text-align:left">Navaid Elevation</td><td style="padding:8px;text-align:left">${navaidElevation} ${navaidUnit}</td></tr>
          <tr><td style="padding:8px;text-align:left">Fix Ground Distance</td><td style="padding:8px;text-align:left">${groundDistance} NM</td></tr>
          <tr><td style="padding:8px;text-align:left">Aircraft Elevation</td><td style="padding:8px;text-align:left">${aircraftElevation} ${aircraftUnit}</td></tr>
          <tr><td style="padding:8px;text-align:left">Slant Range</td><td style="padding:8px;text-align:left">${slantRange} NM</td></tr>
          <tr><td style="padding:8px;text-align:left">DME Tolerance</td><td style="padding:8px;text-align:left">±${dmeTolerance} NM</td></tr>
          <tr><td style="padding:8px;text-align:left">Slant Range (Min)</td><td style="padding:8px;text-align:left">${slantRangeMin} NM</td></tr>
          <tr><td style="padding:8px;text-align:left">Slant Range (Max)</td><td style="padding:8px;text-align:left">${slantRangeMax} NM</td></tr>
        </table>
      `;

  // Build plain-text fallback
  const textContent = [
    ["Parameter", "Value"],
    ["Navaid Elevation", `${navaidElevation} ${navaidUnit}`],
    ["Fix Ground Distance", `${groundDistance} NM`],
    ["Aircraft Elevation", `${aircraftElevation} ${aircraftUnit}`],
    ["Slant Range", `${slantRange} NM`],
    ["DME Tolerance", `±${dmeTolerance} NM`],
    ["Slant Range (Min)", `${slantRangeMin} NM`],
    ["Slant Range (Max)", `${slantRangeMax} NM`],
  ]
    .map((row) => row.join("\t"))
    .join("\n");

  const htmlBlob = new Blob([htmlContent], { type: "text/html" });
  const textBlob = new Blob([textContent], { type: "text/plain" });
  navigator.clipboard
    .write([
      new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      }),
    ])
    .then(() => {
      showToast("Results copied — paste into Word.", "success");
    })
    .catch((err) => {
      console.error("Copy failed:", err);
    });
}

(function () {
  function initI18n() {
    if (window.I18N) {
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
