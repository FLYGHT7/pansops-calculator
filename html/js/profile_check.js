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
  document.getElementById("tchUnit").addEventListener("change", function () {
    handleUnitChange("tch", "tchUnit");
  });
  document
    .getElementById("btnCalculate")
    .addEventListener("click", estimateProfile);
  document
    .getElementById("btnCopy")
    .addEventListener("click", copyToWordDocument);
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

// Load parameters from a JSON file.
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
      if (data["TCH"]) document.getElementById("tch").value = data["TCH"];
      if (data["tchUnit"]) {
        const unitSelect = document.getElementById("tchUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["tchUnit"];
      }
      if (data["VPA"]) document.getElementById("vpa").value = data["VPA"];
      if (data["Distance to FAF"])
        document.getElementById("distToFaf").value = data["Distance to FAF"];
      if (data["Intermediate Length"])
        document.getElementById("intermediateLength").value =
          data["Intermediate Length"];
      if (data["Initial Length"])
        document.getElementById("initialLength").value = data["Initial Length"];
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

// Save parameters to a JSON file.
function saveParameters() {
  const thrElev = document.getElementById("thrElev").value || "";
  const thrElevUnit = document.getElementById("thrElevUnit").value || "ft";
  const tch = document.getElementById("tch").value || "";
  const tchUnit = document.getElementById("tchUnit").value || "ft";
  const vpa = document.getElementById("vpa").value || "";
  const distToFaf = document.getElementById("distToFaf").value || "";
  const intermediateLength =
    document.getElementById("intermediateLength").value || "";
  const initialLength = document.getElementById("initialLength").value || "";

  const data = {
    "THR Elev": thrElev,
    thrElevUnit: thrElevUnit,
    TCH: tch,
    tchUnit: tchUnit,
    VPA: vpa,
    "Distance to FAF": distToFaf,
    "Intermediate Length": intermediateLength,
    "Initial Length": initialLength,
  };

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_profileestimator.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Estimate the profile, update results and draw the SVG diagram with annotations.
function estimateProfile() {
  let thrElev = parseFloat(document.getElementById("thrElev").value);
  let tch = parseFloat(document.getElementById("tch").value);
  const thrElevUnit = document.getElementById("thrElevUnit").value;
  const tchUnit = document.getElementById("tchUnit").value;
  const vpa = parseFloat(document.getElementById("vpa").value);
  const distToFaf = parseFloat(document.getElementById("distToFaf").value);
  const intermediateLength = parseFloat(
    document.getElementById("intermediateLength").value,
  );
  const initialLength = parseFloat(
    document.getElementById("initialLength").value,
  );

  if (
    isNaN(thrElev) ||
    isNaN(tch) ||
    isNaN(vpa) ||
    isNaN(distToFaf) ||
    isNaN(intermediateLength) ||
    isNaN(initialLength)
  ) {
    showToast("Please enter valid values for all inputs.", "error");
    return;
  }

  // Convert THR Elev and TCH to feet if needed.
  let thrElev_ft = thrElev;
  let tch_ft = tch;
  if (thrElevUnit === "m") {
    thrElev_ft = thrElev / 0.3048;
  }
  if (tchUnit === "m") {
    tch_ft = tch / 0.3048;
  }

  // Set output values for THR Elev and TCH.
  document.getElementById("outputThrElev").textContent = thrElev_ft.toFixed(2);
  document.getElementById("outputTch").textContent = tch_ft.toFixed(2);

  // Compute slope from VPA in degrees.
  const slope = Math.tan(vpa * (Math.PI / 180));

  // Conversion constant for NM to ft.
  const nmToFt = 1852 / 0.3048;

  // Base elevation is the sum of THR Elev and TCH.
  const baseElevation = thrElev_ft + tch_ft;

  // Calculate elevations.
  const fafElevation = baseElevation + distToFaf * slope * nmToFt;
  const intermediateElevation =
    fafElevation + intermediateLength * slope * nmToFt;
  const initialElevation =
    intermediateElevation + initialLength * nmToFt * 0.08;

  // Display computed elevations.
  document.getElementById("fafElevation").textContent = fafElevation.toFixed(2);
  document.getElementById("intermediateElevation").textContent =
    intermediateElevation.toFixed(2);
  document.getElementById("initialElevation").textContent =
    initialElevation.toFixed(2);

  // Prepare to update SVG diagram.
  // Horizontal scale: 50 px per NM.
  // Vertical scale: 0.03 px per ft.
  // Base Y (datum) is set at 300.
  const xScale = 50;
  const yScale = 0.03;
  const baseY = 300;

  // Compute x coordinates for key points.
  const x0 = 0;
  const x1 = distToFaf * xScale;
  const x2 = (distToFaf + intermediateLength) * xScale;
  const x3 = (distToFaf + intermediateLength + initialLength) * xScale;

  // Compute y coordinates using the formula: y = baseY - ((E - baseElevation) * yScale).
  const y0 = baseY; // THR level.
  const y1 = baseY - (fafElevation - baseElevation) * yScale;
  const y2 = baseY - (intermediateElevation - baseElevation) * yScale;
  const y3 = baseY - (initialElevation - baseElevation) * yScale;

  // Set the polyline points.
  const polylinePoints = `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
  document
    .getElementById("profilePolyline")
    .setAttribute("points", polylinePoints);

  // Determine total distance to cover.
  const totalDistance = distToFaf + intermediateLength + initialLength;
  const gridMax = Math.ceil(totalDistance / 5) * 5 || 5;
  const newSvgWidth = gridMax * xScale + 20;

  // Update the SVG width and viewBox.
  const profileSvg = document.getElementById("profileSvg");
  profileSvg.setAttribute("width", newSvgWidth);
  profileSvg.setAttribute("viewBox", `-20 0 ${newSvgWidth} 400`);

  // Prepare grid/annotation HTML.
  const isDark = document.documentElement.classList.contains("dark");
  let gridHtml = "";

  // Filled area under the profile line (shows vertical clearance visually)
  const areaPoints = `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3} ${x3},${baseY} ${x0},${baseY}`;
  gridHtml += `<polygon points="${areaPoints}" fill="${isDark ? "rgba(56,189,248,0.07)" : "rgba(2,132,199,0.08)"}" />`;

  // Horizontal datum line.
  gridHtml += `<line x1="0" y1="${baseY}" x2="${newSvgWidth}" y2="${baseY}" stroke="#94a3b8" class="dark:stroke-slate-500" stroke-width="1" stroke-dasharray="6,3" />`;

  // Vertical key lines for THR, FAF, IF, IAF.
  const stations = [
    { x: x0, label: "THR" },
    { x: x1, label: "FAF" },
    { x: x2, label: "IF" },
    { x: x3, label: "IAF" },
  ];
  stations.forEach(({ x, label }) => {
    const stationLineColor = isDark ? "#334155" : "#94a3b8";
    gridHtml += `<line x1="${x}" y1="20" x2="${x}" y2="${baseY}" stroke="${stationLineColor}" stroke-width="1" stroke-dasharray="4,3" />`;
    if (label === "THR") {
      const thrColor = isDark ? "#f59e0b" : "#0369a1";
      gridHtml += `<rect x="${x - 5}" y="${baseY - 24}" width="10" height="24" fill="${thrColor}" rx="1" opacity="0.85" />`;
      gridHtml += `<text x="${x}" y="14" font-size="11" font-family="Rajdhani, sans-serif" font-weight="700" text-anchor="middle" fill="${thrColor}" letter-spacing="0.5">${label}</text>`;
    } else {
      const labelColor = isDark ? "#38bdf8" : "#0369a1";
      gridHtml += `<text x="${x}" y="14" font-size="11" font-family="Rajdhani, sans-serif" font-weight="600" text-anchor="middle" fill="${labelColor}" letter-spacing="0.5">${label}</text>`;
    }
  });

  // Distance hash marks every 1 NM, label every 5 NM.
  for (let i = 0; i <= gridMax; i++) {
    const xi = i * xScale;
    gridHtml += `<line x1="${xi}" y1="${baseY}" x2="${xi}" y2="${baseY + 5}" stroke="#94a3b8" class="dark:stroke-slate-500" stroke-width="1" />`;
    if (i % 5 === 0) {
      gridHtml += `<text x="${xi}" y="${baseY + 18}" font-size="10" font-family="Barlow, sans-serif" text-anchor="middle" fill="#64748b" class="dark:fill-slate-400">${i}</text>`;
    }
  }
  // Distance axis label
  gridHtml += `<text x="${newSvgWidth / 2}" y="${baseY + 32}" font-size="9" font-family="Rajdhani, sans-serif" font-weight="600" text-anchor="middle" fill="#64748b" class="dark:fill-slate-400" letter-spacing="1">NM</text>`;

  // Annotate key profile points with double-ring markers + elevation labels.
  const keyPoints = [
    { x: x1, y: y1, label: `FAF: ${fafElevation.toFixed(0)} ft` },
    { x: x2, y: y2, label: `IF: ${intermediateElevation.toFixed(0)} ft` },
    { x: x3, y: y3, label: `IAF: ${initialElevation.toFixed(0)} ft` },
  ];
  keyPoints.forEach(({ x, y, label }) => {
    const parts = label.split(": ");
    const wptName = parts[0];
    const elevText = parts[1] || "";
    const markerFill = isDark ? "#0d1726" : "#fff";
    const markerStroke = isDark ? "#38bdf8" : "#0284c7";
    const dotFill = isDark ? "#38bdf8" : "#0284c7";
    gridHtml += `<circle cx="${x}" cy="${y}" r="6" fill="${markerFill}" stroke="${markerStroke}" stroke-width="2" />`;
    gridHtml += `<circle cx="${x}" cy="${y}" r="2.5" fill="${dotFill}" />`;
    gridHtml += `<text x="${x + 9}" y="${y - 7}" font-size="10" font-family="Rajdhani, sans-serif" font-weight="700" fill="${isDark ? "#7dd3fc" : "#1e3a5f"}">${wptName}</text>`;
    gridHtml += `<text x="${x + 9}" y="${y + 5}" font-size="10" font-family="Share Tech Mono, monospace" fill="${isDark ? "#38bdf8" : "#0369a1"}">${elevText}</text>`;
  });

  // Update the annotations group.
  document.getElementById("profileAnnotations").innerHTML = gridHtml;

  // Finally, show the results section.
  document.getElementById("results").classList.remove("hidden");
}

// Copy inputs and outputs as a formatted HTML table for Word.
function copyToWordDocument() {
  const thrElev = document.getElementById("thrElev").value || "N/A";
  const thrElevUnit = document.getElementById("thrElevUnit").value || "N/A";
  const tch = document.getElementById("tch").value || "N/A";
  const tchUnit = document.getElementById("tchUnit").value || "N/A";
  const vpa = document.getElementById("vpa").value || "N/A";
  const distToFaf = document.getElementById("distToFaf").value || "N/A";
  const intermediateLength =
    document.getElementById("intermediateLength").value || "N/A";
  const initialLength = document.getElementById("initialLength").value || "N/A";

  const outputThrElev =
    document.getElementById("outputThrElev").textContent || "N/A";
  const outputTch = document.getElementById("outputTch").textContent || "N/A";
  const fafElevation =
    document.getElementById("fafElevation").textContent || "N/A";
  const intermediateElevation =
    document.getElementById("intermediateElevation").textContent || "N/A";
  const initialElevation =
    document.getElementById("initialElevation").textContent || "N/A";

  const htmlContent = `
        <table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">
          <tr style="background:#0c2240;color:#ffffff"><th style="padding:8px;text-align:left;font-weight:bold">Parameter</th><th style="padding:8px;text-align:left;font-weight:bold">Value</th></tr>
          <tr><td style="padding:8px;text-align:left">THR Elev (ft)</td><td style="padding:8px;text-align:left">${outputThrElev} (Input: ${thrElev} ${thrElevUnit})</td></tr>
          <tr><td style="padding:8px;text-align:left">TCH (ft)</td><td style="padding:8px;text-align:left">${outputTch} (Input: ${tch} ${tchUnit})</td></tr>
          <tr><td style="padding:8px;text-align:left">VPA (°)</td><td style="padding:8px;text-align:left">${vpa}</td></tr>
          <tr><td style="padding:8px;text-align:left">Distance to FAF (NM)</td><td style="padding:8px;text-align:left">${distToFaf}</td></tr>
          <tr><td style="padding:8px;text-align:left">Intermediate Length (NM)</td><td style="padding:8px;text-align:left">${intermediateLength}</td></tr>
          <tr><td style="padding:8px;text-align:left">Initial Length (NM)</td><td style="padding:8px;text-align:left">${initialLength}</td></tr>
          <tr><td style="padding:8px;text-align:left">FAF Elevation (ft)</td><td style="padding:8px;text-align:left">${fafElevation}</td></tr>
          <tr><td style="padding:8px;text-align:left">Intermediate Elevation (ft)</td><td style="padding:8px;text-align:left">${intermediateElevation}</td></tr>
          <tr><td style="padding:8px;text-align:left">Initial Elevation (ft)</td><td style="padding:8px;text-align:left">${initialElevation}</td></tr>
        </table>
      `;
  const blob = new Blob([htmlContent], { type: "text/html" });
  // Plain-text fallback by stripping tags and using tabs/newlines
  const stripped = htmlContent
    .replace(/<table[^>]*>/gi, "")
    .replace(/<tr[^>]*>/gi, "")
    .replace(/<th[^>]*>/gi, "")
    .replace(/<td[^>]*>/gi, "")
    .replace(/<\/th>/gi, "\t")
    .replace(/<\/td>/gi, "\t")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/table>/gi, "")
    .trim();
  const textBlob = new Blob([stripped], { type: "text/plain" });
  navigator.clipboard
    .write([new ClipboardItem({ "text/html": blob, "text/plain": textBlob })])
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
