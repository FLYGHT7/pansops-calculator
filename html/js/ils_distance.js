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
  document
    .getElementById("thrElevUnit")
    .addEventListener("change", function () {
      handleUnitChange("thrElev", "thrElevUnit");
    });
  document.getElementById("rdhUnit").addEventListener("change", function () {
    handleUnitChange("rdh", "rdhUnit");
  });
  document
    .getElementById("btnCalculate")
    .addEventListener("click", calculateBoth);
  document.getElementById("btnCopy").addEventListener("click", function () {
    copyToWordDocument("both");
  });
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

// Conversion constants are provided by aviation-utils.js (FT_PER_M, FT_PER_NM)

// In this app, we know the FAP altitude and need to solve for distance.
// Method A (Right Angle Computation):
// FAP_alt = THR + RDH + (NM * FT_PER_NM * tan(gp))
// → NM = (FAP_alt - THR - RDH) / (FT_PER_NM * tan(gp))
//
// Method B (Considering Earth Curvature):
// FAP_alt = THR + RDH + ΔH + (NM * FT_PER_NM * tan(gp)) + (0.8833 * NM²)
// where ΔH = (RDH - (15/0.3048)) if RDH > (15/0.3048), else 0.
// Rearranging gives a quadratic:
// 0.8833 * NM² + (FT_PER_NM * tan(gp)) * NM + (THR + RDH + ΔH - FAP_alt) = 0
// We solve for NM (choose the positive solution).

function calculateBoth() {
  const calcType = document.querySelector(
    'input[name="calcType"]:checked',
  ).value;
  document.getElementById("calcTypeOutput").textContent =
    "Point/Fix Type: " + calcType;

  // Get THR Elevation:
  const thrElevVal = parseFloat(document.getElementById("thrElev").value);
  const thrElevUnit = document.getElementById("thrElevUnit").value;
  if (isNaN(thrElevVal)) {
    showToast("Please enter a valid THR Elevation.", "error");
    return;
  }
  // Convert to feet if needed
  let thrElev_ft = thrElevVal;
  if (thrElevUnit === "m") {
    thrElev_ft = thrElevVal * FT_PER_M;
  }

  // Get RDH:
  const rdhVal = parseFloat(document.getElementById("rdh").value);
  const rdhUnit = document.getElementById("rdhUnit").value;
  if (isNaN(rdhVal)) {
    showToast("Please enter a valid RDH.", "error");
    return;
  }
  // Convert to feet if needed
  let rdh_ft = rdhVal;
  if (rdhUnit === "m") {
    rdh_ft = rdhVal * FT_PER_M;
  }

  // Get Glidepath Angle (in degrees):
  const glideAngle = parseFloat(document.getElementById("glideAngle").value);
  if (isNaN(glideAngle)) {
    showToast("Please enter a valid Glidepath Angle.", "error");
    return;
  }
  const gp_rad = (glideAngle * Math.PI) / 180;

  // Get FAP Altitude (in ft) - input for this app:
  const fap_alt = parseFloat(document.getElementById("fapAltitude").value);
  if (isNaN(fap_alt)) {
    showToast("Please enter a valid FAP Altitude.", "error");
    return;
  }

  // Compute RDH adjustment:
  const threshold_ft = 15 / 0.3048; // ≈ 49.2126 ft
  const deltaH_candidate = rdh_ft - threshold_ft;
  const deltaH =
    rdh_ft > threshold_ft && Math.abs(deltaH_candidate) >= 0.001
      ? deltaH_candidate
      : 0;

  // Method A:
  const numeratorA = fap_alt - thrElev_ft - rdh_ft;
  const denominatorA = FT_PER_NM * Math.tan(gp_rad);
  const NM_A = numeratorA / denominatorA;

  // Method B: Solve quadratic:
  // Let A_coeff = 0.8833, B_coeff = FT_PER_NM * tan(gp_rad), C_coeff = (thrElev_ft + rdh_ft + deltaH - fap_alt)
  const A_coeff = 0.8833;
  const B_coeff = FT_PER_NM * Math.tan(gp_rad);
  const C_coeff = thrElev_ft + rdh_ft + deltaH - fap_alt;
  const discriminant = B_coeff * B_coeff - 4 * A_coeff * C_coeff;
  let NM_B = NaN;
  if (discriminant < 0) {
    showToast(
      "No solution found for the given parameters (discriminant < 0).",
      "error",
    );
    return;
  } else {
    NM_B = (-B_coeff + Math.sqrt(discriminant)) / (2 * A_coeff);
  }

  document.getElementById("distanceA").textContent = NM_A.toFixed(4);
  document.getElementById("distanceB").textContent = NM_B.toFixed(4);

  const rdhAdjustmentEl = document.getElementById("rdhAdjustment");
  if (deltaH > 0) {
    document.getElementById("deltaHOutput").textContent = deltaH.toFixed(4);
    rdhAdjustmentEl.classList.remove("hidden");
  } else {
    rdhAdjustmentEl.classList.add("hidden");
  }

  document.getElementById("resultsOutput").classList.remove("hidden");
}

// --- Save & Load Functions ---
function saveParameters() {
  const thrElev = document.getElementById("thrElev").value || "";
  const thrElevUnit = document.getElementById("thrElevUnit").value || "ft";
  const rdh = document.getElementById("rdh").value || "";
  const rdhUnit = document.getElementById("rdhUnit").value || "ft";
  const fapAltitude = document.getElementById("fapAltitude").value || "";
  const glideAngle = document.getElementById("glideAngle").value || "";
  const calcType =
    document.querySelector('input[name="calcType"]:checked')?.value || "";

  const data = {
    "THR Elev": thrElev,
    thrElevUnit: thrElevUnit,
    RDH: rdh,
    rdhUnit: rdhUnit,
    "FAP Altitude": fapAltitude,
    "Glidepath Angle": glideAngle,
    calcType: calcType,
  };

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_ils_distance.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

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
      if (data["THR Elev"])
        document.getElementById("thrElev").value = data["THR Elev"];
      if (data["thrElevUnit"]) {
        const unitSelect = document.getElementById("thrElevUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["thrElevUnit"];
      }
      if (data["RDH"]) document.getElementById("rdh").value = data["RDH"];
      if (data["rdhUnit"]) {
        const unitSelect = document.getElementById("rdhUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["rdhUnit"];
      }
      if (data["FAP Altitude"])
        document.getElementById("fapAltitude").value = data["FAP Altitude"];
      if (data["Glidepath Angle"])
        document.getElementById("glideAngle").value = data["Glidepath Angle"];
      if (data["calcType"]) {
        const radioToCheck = document.querySelector(
          'input[name="calcType"][value="' + data["calcType"] + '"]',
        );
        if (radioToCheck) radioToCheck.checked = true;
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

// --- Copy to Word Function ---
function copyToWordDocument(type) {
  let htmlContent = "";
  let textRows = [];
  if (type === "both") {
    const calcType =
      document.querySelector('input[name="calcType"]:checked').value || "N/A";
    const thrElev = document.getElementById("thrElev").value || "N/A";
    const thrElevUnit = document.getElementById("thrElevUnit").value || "N/A";
    const rdh = document.getElementById("rdh").value || "N/A";
    const rdhUnit = document.getElementById("rdhUnit").value || "N/A";
    const fapAltitude = document.getElementById("fapAltitude").value || "N/A";
    const glideAngle = document.getElementById("glideAngle").value || "N/A";
    const distanceA = document.getElementById("distanceA").textContent || "N/A";
    const distanceB = document.getElementById("distanceB").textContent || "N/A";
    const deltaHValue =
      document.getElementById("deltaHOutput").textContent || "0.0000";

    htmlContent = `
          <table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">
            <tr style="background:#0c2240;color:#ffffff"><th style="padding:8px;text-align:left;font-weight:bold">Parameter</th><th style="padding:8px;text-align:left;font-weight:bold">Value</th></tr>
            <tr><td style="padding:8px;text-align:left">Point/Fix Type</td><td style="padding:8px;text-align:left">${calcType}</td></tr>
            <tr><td style="padding:8px;text-align:left">THR Elevation</td><td style="padding:8px;text-align:left">${thrElev} ${thrElevUnit}</td></tr>
            <tr><td style="padding:8px;text-align:left">RDH</td><td style="padding:8px;text-align:left">${rdh} ${rdhUnit}</td></tr>
            <tr><td style="padding:8px;text-align:left">FAP Altitude</td><td style="padding:8px;text-align:left">${parseFloat(fapAltitude).toFixed(
              2,
            )} ft</td></tr>
            <tr><td style="padding:8px;text-align:left">Glidepath Angle</td><td style="padding:8px;text-align:left">${parseFloat(glideAngle).toFixed(
              2,
            )}°</td></tr>
            <tr><td style="padding:8px;text-align:left">Right Angle Computation Distance</td><td style="padding:8px;text-align:left">${distanceA} NM</td></tr>
            <tr><td style="padding:8px;text-align:left">Considering Earth Curvature Distance</td><td style="padding:8px;text-align:left">${distanceB} NM</td></tr>`;

    if (parseFloat(deltaHValue) > 0) {
      htmlContent += `<tr><td style="padding:8px;text-align:left">RDH &gt;15m Adjustment</td><td style="padding:8px;text-align:left">${deltaHValue} ft</td></tr>`;
    }

    htmlContent += `</table>`;

    textRows = [
      ["Parameter", "Value"],
      ["Point/Fix Type", `${calcType}`],
      ["THR Elevation", `${thrElev} ${thrElevUnit}`],
      ["RDH", `${rdh} ${rdhUnit}`],
      ["FAP Altitude", `${parseFloat(fapAltitude).toFixed(2)} ft`],
      ["Glidepath Angle", `${parseFloat(glideAngle).toFixed(2)}°`],
      ["Right Angle Computation Distance", `${distanceA} NM`],
      ["Considering Earth Curvature Distance", `${distanceB} NM`],
    ];
    if (parseFloat(deltaHValue) > 0) {
      textRows.push(["RDH >15m Adjustment", `${deltaHValue} ft`]);
    }
  }

  const blob = new Blob([htmlContent], { type: "text/html" });
  const textContent = textRows.map((r) => r.join("\t")).join("\n");
  const textBlob = new Blob([textContent], { type: "text/plain" });
  navigator.clipboard
    .write([new ClipboardItem({ "text/html": blob, "text/plain": textBlob })])
    .then(() => {
      showToast(
        "Results copied — paste into Word.",
        "success",
      );
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
