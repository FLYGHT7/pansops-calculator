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

  // Draw the diagram
  drawDiagram();

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

  // Get Distance to FAP/Fix (in NM):
  const distFAP = parseFloat(document.getElementById("distFAP").value);
  if (isNaN(distFAP)) {
    showToast("Please enter a valid distance.", "error");
    return;
  }

  // Compute RDH adjustment:
  const threshold_ft = 15 / 0.3048; // ≈ 49.2126 ft
  const deltaH_candidate = rdh_ft - threshold_ft;
  const deltaH =
    rdh_ft > threshold_ft && Math.abs(deltaH_candidate) >= 0.001
      ? deltaH_candidate
      : 0;

  // Method A (Right Angle Computation):
  const fapAltitudeA =
    thrElev_ft + rdh_ft + distFAP * FT_PER_NM * Math.tan(gp_rad);

  // Method B (Considering Earth Curvature):
  const fapAltitudeB =
    thrElev_ft +
    rdh_ft +
    deltaH +
    distFAP * FT_PER_NM * Math.tan(gp_rad) +
    0.8833 * distFAP * distFAP;

  document.getElementById("fapAltitudeA").textContent = fapAltitudeA.toFixed(2);
  document.getElementById("fapAltitudeB").textContent = fapAltitudeB.toFixed(2);

  const rdhAdjustmentEl = document.getElementById("rdhAdjustment");
  if (deltaH > 0) {
    document.getElementById("deltaHOutput").textContent = deltaH.toFixed(4);
    rdhAdjustmentEl.classList.remove("hidden");
  } else {
    rdhAdjustmentEl.classList.add("hidden");
  }

  document.getElementById("resultsOutput").classList.remove("hidden");

  // Update the diagram with current values
  drawDiagram(thrElev_ft, rdh_ft, gp_rad);
}

// --- Save & Load Functions ---
function saveParameters() {
  const thrElev = document.getElementById("thrElev").value || "";
  const thrElevUnit = document.getElementById("thrElevUnit").value || "ft";
  const rdh = document.getElementById("rdh").value || "";
  const rdhUnit = document.getElementById("rdhUnit").value || "ft";
  const distFAP = document.getElementById("distFAP").value || "";
  const glideAngle = document.getElementById("glideAngle").value || "";
  const calcType =
    document.querySelector('input[name="calcType"]:checked')?.value || "";

  const data = {
    "THR Elev": thrElev,
    thrElevUnit: thrElevUnit,
    RDH: rdh,
    rdhUnit: rdhUnit,
    "Distance to FAP": distFAP,
    "Glidepath Angle": glideAngle,
    calcType: calcType,
  };

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_ils_height.json`;
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
      if (data["Distance to FAP"])
        document.getElementById("distFAP").value = data["Distance to FAP"];
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
    const distFAP = document.getElementById("distFAP").value || "N/A";
    const glideAngle = document.getElementById("glideAngle").value || "N/A";
    const methodA =
      document.getElementById("fapAltitudeA").textContent || "N/A";
    const methodB =
      document.getElementById("fapAltitudeB").textContent || "N/A";
    const deltaHValue =
      document.getElementById("deltaHOutput").textContent || "0.0000";

    htmlContent = `
          <table border="1" style="border-collapse: collapse; text-align: center; width: 100%;">
            <tr style="background-color: #f1f5f9;"><th>Parameter</th><th>Value</th></tr>
            <tr><td>Point/Fix Type</td><td>${calcType}</td></tr>
            <tr><td>THR Elevation</td><td>${thrElev} ${thrElevUnit}</td></tr>
            <tr><td>RDH</td><td>${rdh} ${rdhUnit}</td></tr>
            <tr><td>Distance to the ${calcType}</td><td>${parseFloat(
              distFAP,
            ).toFixed(2)} NM</td></tr>
            <tr><td>Glidepath Angle</td><td>${parseFloat(glideAngle).toFixed(
              2,
            )}°</td></tr>
            <tr><td>Right Angle Computation FAP Altitude</td><td>${methodA} ft</td></tr>
            <tr><td>Considering Earth Curvature FAP Altitude</td><td>${methodB} ft</td></tr>`;

    if (parseFloat(deltaHValue) > 0) {
      htmlContent += `<tr><td>RDH &gt;15m Adjustment</td><td>${deltaHValue} ft</td></tr>`;
    }

    htmlContent += `</table>`;

    // Construct a plain-text version from the same values
    textRows = [
      ["Parameter", "Value"],
      ["Point/Fix Type", `${calcType}`],
      ["THR Elevation", `${thrElev} ${thrElevUnit}`],
      ["RDH", `${rdh} ${rdhUnit}`],
      [`Distance to the ${calcType}`, `${parseFloat(distFAP).toFixed(2)} NM`],
      ["Glidepath Angle", `${parseFloat(glideAngle).toFixed(2)}°`],
      ["Right Angle Computation FAP Altitude", `${methodA} ft`],
      ["Considering Earth Curvature FAP Altitude", `${methodB} ft`],
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
        "Results copied — paste into Word or a text editor.",
        "success",
      );
    })
    .catch((err) => {
      console.error("Copy failed:", err);
    });
}

// --- SVG Diagram Drawing ---
// Fixed test values:
// THR Elevation: 134.1 ft, RDH: 15 m (≈49.2126 ft), Glidepath: 3°
const fixed_THR = 134.1; // ft
const fixed_RDH_ft = 15 / 0.3048; // ≈49.2126 ft
const fixedBase = fixed_THR + fixed_RDH_ft; // ~183.3126 ft
const fixedTan3 = Math.tan((3 * Math.PI) / 180); // ≈0.05240778
// Right Triangle altitude (in ft) using fixed values:
function altTriangle(x_nm) {
  return fixedBase + FT_PER_NM * fixedTan3 * x_nm;
}
// Earth Curvature altitude (in ft) using fixed values:
function altCurvature(x_nm) {
  return altTriangle(x_nm) + 0.8833 * x_nm * x_nm;
}

// --- SVG Setup ---
const svgWidth = 720; // 20% wider than before
const svgHeight = 855; // To fit vertical domain from 0 to 4000 ft fully
const marginLeft = 50,
  marginRight = 20;
const drawWidth = svgWidth - marginLeft - marginRight; // 720 - 50 - 20 = 650 px
const xMin = 0,
  xMax = 10; // Horizontal domain in NM
const scaleX = drawWidth / (xMax - xMin); // 650/10 = 65 px per NM

function drawDiagram(
  thrElev = fixed_THR,
  rdh = fixed_RDH_ft,
  gpRad = (3 * Math.PI) / 180,
) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById("diagram");
  const isDark = document.documentElement.classList.contains("dark");

  // Calculate the base height (THR + RDH)
  const baseHeight = thrElev + rdh;
  const tanGP = Math.tan(gpRad);

  // Functions to calculate altitudes with current values
  function currentAltTriangle(x_nm) {
    return baseHeight + FT_PER_NM * tanGP * x_nm;
  }

  function currentAltCurvature(x_nm) {
    return currentAltTriangle(x_nm) + 0.8833 * x_nm * x_nm;
  }

  // Calculate the minimum and maximum altitudes for the diagram
  const distFAPElement = document.getElementById("distFAP");
  const distFAP = distFAPElement ? parseFloat(distFAPElement.value) : 10;
  const maxDistance =
    isNaN(distFAP) || distFAP <= 0 ? 10 : Math.min(distFAP * 1.5, 10);

  // Calculate the altitude at the maximum distance
  const maxAltitude = currentAltCurvature(maxDistance);

  // Find the lowest multiple of 500 ft below the base height
  const yMin_ft = Math.floor(baseHeight / 500) * 500;

  // Find the highest multiple of 500 ft above the maximum altitude
  const yMax_ft = Math.ceil(maxAltitude / 500) * 500;

  // Convert to NM for scaling
  const yMin_nm = yMin_ft / FT_PER_NM;
  const yMax_nm = yMax_ft / FT_PER_NM;

  // Vertical exaggeration factor = 20× horizontal scale:
  const verticalExaggeration = 20;
  const verticalScale = verticalExaggeration * scaleX; // 20 * 65 = 1300 px per NM (model scale)
  const idealVerticalSpan = (yMax_nm - yMin_nm) * verticalScale;

  // Add extra top & bottom padding in model units
  const topPadding = 20,
    bottomPadding = 20;
  const viewBoxHeight = idealVerticalSpan + topPadding + bottomPadding;

  // Set the SVG viewBox
  svg.setAttribute("viewBox", `0 0 ${svgWidth} ${viewBoxHeight.toFixed(0)}`);
  svg.innerHTML = "";

  // Background rect (avionics dark panel or clean light)
  const bgRect = document.createElementNS(svgNS, "rect");
  bgRect.setAttribute("x", "0");
  bgRect.setAttribute("y", "0");
  bgRect.setAttribute("width", svgWidth.toString());
  bgRect.setAttribute("height", viewBoxHeight.toFixed(0));
  bgRect.setAttribute("fill", isDark ? "#080e1c" : "#f8fafc");
  svg.appendChild(bgRect);

  // Glow filter defs (used in dark mode for FAP line and markers)
  const defs = document.createElementNS(svgNS, "defs");
  defs.innerHTML = `
    <filter id="glow-blue" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  svg.appendChild(defs);

  // Conversion functions:
  function getXPixel(x_nm) {
    return marginLeft + (x_nm - xMin) * scaleX;
  }

  function getYPixel(alt_ft) {
    // Map altitude in ft to model NM value then to px, with topPadding added.
    const alt_nm = alt_ft / FT_PER_NM;
    return topPadding + (yMax_nm - alt_nm) * verticalScale;
  }

  // Draw vertical grid lines every 2 NM:
  for (let x = xMin; x <= xMax; x += 2) {
    const x_px = getXPixel(x);
    const vLine = document.createElementNS(svgNS, "line");
    vLine.setAttribute("x1", x_px);
    vLine.setAttribute("y1", 0);
    vLine.setAttribute("x2", x_px);
    vLine.setAttribute("y2", viewBoxHeight);
    vLine.setAttribute("class", "grid-line");
    svg.appendChild(vLine);
    // Label x-axis at the bottom:
    const xText = document.createElementNS(svgNS, "text");
    xText.setAttribute("x", x_px);
    xText.setAttribute("y", viewBoxHeight - 5);
    xText.setAttribute("font-size", "10");
    xText.setAttribute("text-anchor", "middle");
    xText.setAttribute("font-family", "Barlow, sans-serif");
    xText.textContent = x.toFixed(1) + " NM";
    svg.appendChild(xText);
  }

  // Draw horizontal grid lines every 500 ft:
  for (let alt_ft = yMin_ft; alt_ft <= yMax_ft; alt_ft += 500) {
    const y_px = getYPixel(alt_ft);
    const hLine = document.createElementNS(svgNS, "line");
    hLine.setAttribute("x1", marginLeft);
    hLine.setAttribute("y1", y_px);
    hLine.setAttribute("x2", svgWidth - marginRight);
    hLine.setAttribute("y2", y_px);
    hLine.setAttribute("class", "grid-line");
    svg.appendChild(hLine);
    // Label horizontal grid line:
    const yText = document.createElementNS(svgNS, "text");
    yText.setAttribute("x", marginLeft - 5);
    yText.setAttribute("y", y_px + 3);
    yText.setAttribute("font-size", "10");
    yText.setAttribute("text-anchor", "end");
    yText.setAttribute("font-family", "Barlow, sans-serif");
    yText.textContent = Math.round(alt_ft) + " ft";
    svg.appendChild(yText);
  }

  // Build point arrays for the polylines (increment = 0.1 NM):
  let trianglePoints = "";
  let curvaturePoints = "";
  for (let x = xMin; x <= xMax; x += 0.1) {
    const x_px = getXPixel(x);
    const y_tri = getYPixel(currentAltTriangle(x));
    const y_curv = getYPixel(currentAltCurvature(x));
    trianglePoints += `${x_px},${y_tri} `;
    curvaturePoints += `${x_px},${y_curv} `;
  }

  // Create red polyline for Right Triangle:
  const triangleLine = document.createElementNS(svgNS, "polyline");
  triangleLine.setAttribute("points", trianglePoints.trim());
  triangleLine.setAttribute("stroke", "#dc2626");
  triangleLine.setAttribute("stroke-width", "2.5");
  triangleLine.setAttribute("fill", "none");
  svg.appendChild(triangleLine);

  // Create green polyline for Earth Curvature:
  const curvatureLine = document.createElementNS(svgNS, "polyline");
  curvatureLine.setAttribute("points", curvaturePoints.trim());
  curvatureLine.setAttribute("stroke", "#059669");
  curvatureLine.setAttribute("stroke-width", "2.5");
  curvatureLine.setAttribute("fill", "none");
  svg.appendChild(curvatureLine);

  // Place the "Earth Curvature" label at 4 NM and 2000 ft:
  const greenLabel = document.createElementNS(svgNS, "text");
  const greenX = getXPixel(Math.min(4, maxDistance * 0.6));
  const greenY = getYPixel(
    currentAltCurvature(Math.min(4, maxDistance * 0.6)) - 100,
  ); // Offset label slightly above the line
  greenLabel.setAttribute("x", greenX);
  greenLabel.setAttribute("y", greenY);
  greenLabel.setAttribute("fill", isDark ? "#34d399" : "#059669");
  greenLabel.setAttribute("font-size", "12");
  greenLabel.setAttribute("font-family", "Rajdhani, sans-serif");
  greenLabel.setAttribute("font-weight", "600");
  greenLabel.textContent = "Earth Curvature";
  svg.appendChild(greenLabel);

  // Place the "Right Triangle" label at 6 NM and 1500 ft:
  const redLabel = document.createElementNS(svgNS, "text");
  const redX = getXPixel(Math.min(6, maxDistance * 0.8));
  const redY = getYPixel(
    currentAltTriangle(Math.min(6, maxDistance * 0.8)) + 100,
  ); // Offset label slightly below the line
  redLabel.setAttribute("x", redX);
  redLabel.setAttribute("y", redY);
  redLabel.setAttribute("fill", isDark ? "#f87171" : "#dc2626");
  redLabel.setAttribute("font-size", "12");
  redLabel.setAttribute("font-family", "Rajdhani, sans-serif");
  redLabel.setAttribute("font-weight", "600");
  redLabel.setAttribute("text-anchor", "middle");
  redLabel.textContent = "Right Triangle";
  svg.appendChild(redLabel);

  // THR amber vertical marker at x = 0 (touchdown threshold)
  const thrLineEl = document.createElementNS(svgNS, "line");
  const thrXPx = getXPixel(0);
  thrLineEl.setAttribute("x1", thrXPx.toString());
  thrLineEl.setAttribute("y1", "0");
  thrLineEl.setAttribute("x2", thrXPx.toString());
  thrLineEl.setAttribute("y2", viewBoxHeight.toString());
  thrLineEl.setAttribute("stroke", isDark ? "#f59e0b" : "#d97706");
  thrLineEl.setAttribute("stroke-width", "2");
  thrLineEl.setAttribute("stroke-dasharray", "7,5");
  thrLineEl.setAttribute("class", "thr-line");
  svg.appendChild(thrLineEl);
  const thrLabelEl = document.createElementNS(svgNS, "text");
  thrLabelEl.setAttribute("x", (thrXPx + 4).toString());
  thrLabelEl.setAttribute("y", "18");
  thrLabelEl.setAttribute("font-size", "10");
  thrLabelEl.setAttribute("font-family", "Rajdhani, sans-serif");
  thrLabelEl.setAttribute("font-weight", "700");
  thrLabelEl.setAttribute("fill", isDark ? "#f59e0b" : "#d97706");
  thrLabelEl.setAttribute("letter-spacing", "1");
  thrLabelEl.textContent = "THR";
  svg.appendChild(thrLabelEl);

  // Panel legend box
  const legendPad = 8,
    legendW = 138,
    legendH = 62;
  const legendX = svgWidth - marginRight - legendW - 2;
  const legendY = topPadding + 4;
  const legendBox = document.createElementNS(svgNS, "rect");
  legendBox.setAttribute("x", legendX.toString());
  legendBox.setAttribute("y", legendY.toString());
  legendBox.setAttribute("width", legendW.toString());
  legendBox.setAttribute("height", legendH.toString());
  legendBox.setAttribute("fill", isDark ? "#0d1726" : "#f8fafc");
  legendBox.setAttribute("stroke", isDark ? "#1e3a5f" : "#cbd5e1");
  legendBox.setAttribute("stroke-width", "1");
  legendBox.setAttribute("rx", "4");
  svg.appendChild(legendBox);
  const legendItems = [
    { color: isDark ? "#f87171" : "#dc2626", label: "Right Triangle" },
    { color: isDark ? "#34d399" : "#059669", label: "Earth Curvature" },
    { color: isDark ? "#f59e0b" : "#d97706", label: "THR" },
  ];
  legendItems.forEach(({ color, label }, i) => {
    const ly = legendY + legendPad + 14 + i * 16;
    const ll = document.createElementNS(svgNS, "line");
    ll.setAttribute("x1", (legendX + legendPad).toString());
    ll.setAttribute("y1", ly.toString());
    ll.setAttribute("x2", (legendX + legendPad + 20).toString());
    ll.setAttribute("y2", ly.toString());
    ll.setAttribute("stroke", color);
    ll.setAttribute("stroke-width", "2.5");
    svg.appendChild(ll);
    const lt = document.createElementNS(svgNS, "text");
    lt.setAttribute("x", (legendX + legendPad + 26).toString());
    lt.setAttribute("y", (ly + 4).toString());
    lt.setAttribute("font-size", "10");
    lt.setAttribute("font-family", "Rajdhani, sans-serif");
    lt.setAttribute("font-weight", "600");
    lt.setAttribute("fill", isDark ? "#94a3b8" : "#374151");
    lt.textContent = label;
    svg.appendChild(lt);
  });

  // Add a marker for the FAP/Fix point if distance is available
  if (!isNaN(distFAP) && distFAP > 0 && distFAP <= xMax) {
    // Draw vertical line at the FAP/Fix distance
    const fapX = getXPixel(distFAP);
    const fapLine = document.createElementNS(svgNS, "line");
    fapLine.setAttribute("x1", fapX);
    fapLine.setAttribute("y1", 0);
    fapLine.setAttribute("x2", fapX);
    fapLine.setAttribute("y2", viewBoxHeight);
    fapLine.setAttribute("stroke", "#0284c7");
    fapLine.setAttribute("stroke-width", "2");
    fapLine.setAttribute("stroke-dasharray", "5,5");
    fapLine.setAttribute("class", "fap-line");
    if (isDark) fapLine.setAttribute("filter", "url(#glow-blue)");
    svg.appendChild(fapLine);

    // Add markers at the calculated altitudes
    const triY = getYPixel(currentAltTriangle(distFAP));
    const curvY = getYPixel(currentAltCurvature(distFAP));

    // Triangle marker (red circle)
    const triMarker = document.createElementNS(svgNS, "circle");
    triMarker.setAttribute("cx", fapX);
    triMarker.setAttribute("cy", triY);
    triMarker.setAttribute("r", "5");
    triMarker.setAttribute("fill", "#dc2626");
    triMarker.setAttribute("stroke", isDark ? "#0d1726" : "#fff");
    triMarker.setAttribute("stroke-width", "1.5");
    if (isDark) triMarker.setAttribute("filter", "url(#glow-red)");
    svg.appendChild(triMarker);

    // Curvature marker (green circle)
    const curvMarker = document.createElementNS(svgNS, "circle");
    curvMarker.setAttribute("cx", fapX);
    curvMarker.setAttribute("cy", curvY);
    curvMarker.setAttribute("r", "5");
    curvMarker.setAttribute("fill", isDark ? "#34d399" : "#059669");
    curvMarker.setAttribute("stroke", isDark ? "#0d1726" : "#fff");
    curvMarker.setAttribute("stroke-width", "1.5");
    if (isDark) curvMarker.setAttribute("filter", "url(#glow-blue)");
    svg.appendChild(curvMarker);

    // Add FAP/Fix label
    const calcTypeElement = document.querySelector(
      'input[name="calcType"]:checked',
    );
    const calcType = calcTypeElement ? calcTypeElement.value : "FAP";
    const fapLabel = document.createElementNS(svgNS, "text");
    fapLabel.setAttribute("x", fapX);
    fapLabel.setAttribute("y", viewBoxHeight - 25);
    fapLabel.setAttribute("font-size", "12");
    fapLabel.setAttribute("fill", isDark ? "#38bdf8" : "#0284c7");
    fapLabel.setAttribute("font-family", "Rajdhani, sans-serif");
    fapLabel.setAttribute("font-weight", "600");
    fapLabel.setAttribute("text-anchor", "middle");
    fapLabel.textContent = calcType;
    svg.appendChild(fapLabel);
  }
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
