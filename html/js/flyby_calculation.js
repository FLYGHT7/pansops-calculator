// --- Fallback helpers --------------------------------------------------------
// aviation-utils.js is loaded by the parent shell (Main.html).
// When the page runs standalone on the server the relative <script> tag in the
// <head> may fail to resolve, leaving these functions undefined.  The guards
// below ensure the page always works regardless of loading context.
if (typeof calculateKFactor === "undefined") {
  // eslint-disable-next-line no-unused-vars
  function calculateKFactor(altitude_ft, isaDeviation) {
    return (
      (171233 * Math.sqrt(288 + isaDeviation - 0.00198 * altitude_ft)) /
      Math.pow(288 - 0.00198 * altitude_ft, 2.628)
    );
  }
}
if (typeof calculateTAS === "undefined") {
  // eslint-disable-next-line no-unused-vars
  function calculateTAS(ias, kFactor) {
    return ias * kFactor;
  }
}
if (typeof calculateRadius === "undefined") {
  var _DEG_TO_RAD_FB2 = Math.PI / 180;
  // eslint-disable-next-line no-unused-vars
  function calculateRadius(tas, bankAngle_deg) {
    return (tas * tas) / (68625 * Math.tan(bankAngle_deg * _DEG_TO_RAD_FB2));
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  checkDarkMode();
  initializeUnitSelectors();
  setupEventListeners();

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
});

function setupEventListeners() {
  document
    .getElementById("btnCalculate")
    .addEventListener("click", calculateFlyby);
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document
    .getElementById("btnLoad")
    .addEventListener("click", () =>
      document.getElementById("loadFile").click(),
    );
  document
    .getElementById("loadFile")
    .addEventListener("change", loadParameters);
  document.getElementById("btnCopy").addEventListener("click", copyToWord);

  const altUnit = document.getElementById("altitudeUnit");
  if (altUnit) {
    altUnit.addEventListener("change", () =>
      handleUnitChange("altitude", "altitudeUnit"),
    );
  }
}

// --- Core calculation ---------------------------------------------------------

function calculateFlyby() {
  // --- Read inputs (4 inputs only) ---
  const iasVal = parseFloat(document.getElementById("ias").value);
  const altitudeRaw = parseFloat(document.getElementById("altitude").value);
  const altitudeUnit = document.getElementById("altitudeUnit").value;
  const bankAngleVal = parseFloat(document.getElementById("bankAngle").value);
  const turnAngleRaw = parseFloat(document.getElementById("turnAngle").value);

  // --- Validate ---
  if (isNaN(iasVal) || iasVal <= 0) {
    showToast("Please enter a valid IAS (> 0).", "error");
    return;
  }
  if (isNaN(altitudeRaw) || altitudeRaw < 0) {
    showToast("Please enter a valid altitude (>=0).", "error");
    return;
  }
  if (isNaN(bankAngleVal) || bankAngleVal <= 0 || bankAngleVal >= 90) {
    showToast("Please enter a valid bank angle (1-89).", "error");
    return;
  }
  if (isNaN(turnAngleRaw) || turnAngleRaw <= 0 || turnAngleRaw >= 360) {
    showToast("Please enter a valid turn angle (1-359).", "error");
    return;
  }

  // --- PANS-OPS S1.4.2.2: minimum 50 for regular aircraft ---
  const minAngle = 50;
  const turnAngle = Math.max(turnAngleRaw, minAngle);
  const minApplied = turnAngle !== turnAngleRaw;

  // --- Convert altitude to feet ---
  const altitude_ft =
    altitudeUnit === "ft" ? altitudeRaw : altitudeRaw / 0.3048;

  // --- kFactor and TAS (ISA+15 hardcoded per PANS-OPS procedure design standard) ---
  const kFactor = calculateKFactor(altitude_ft, 15);
  const tas = calculateTAS(iasVal, kFactor);

  // --- Radius ---
  const r = calculateRadius(tas, bankAngleVal);

  // --- Flyby MSD (PANS-OPS S1.4.2.1) ---
  // L1 = r x tan(A/2)
  // L2 = 5 x V/3600
  const turnHalf_rad = (turnAngle / 2) * (Math.PI / 180);
  const L1 = r * Math.tan(turnHalf_rad);
  const L2 = (5 * tas) / 3600;
  const M = L1 + L2;

  // --- Populate outputs ---
  document.getElementById("outKFactor").textContent = kFactor.toFixed(4);
  document.getElementById("outTas").textContent = tas.toFixed(4);
  document.getElementById("outR").textContent = r.toFixed(4);
  document.getElementById("outTurnUsed").textContent = turnAngle + "\u00b0";
  document.getElementById("outL1").textContent = L1.toFixed(4);
  document.getElementById("outL2").textContent = L2.toFixed(4);
  document.getElementById("outM").textContent = M.toFixed(4);

  const warnEl = document.getElementById("turnAngleWarning");
  if (minApplied) {
    warnEl.classList.remove("hidden");
  } else {
    warnEl.classList.add("hidden");
  }

  document.getElementById("resultsSection").classList.remove("hidden");
  renderFlybyDiagram(L1, L2, r, turnAngle);
}

// --- SVG Diagram --------------------------------------------------------------

function renderFlybyDiagram(L1, L2, r, theta_deg) {
  const M = L1 + L2;
  const container = document.getElementById("flybyDiagram");
  const diagramSection = document.getElementById("diagramSection");

  if (M <= 0) {
    diagramSection.classList.add("hidden");
    return;
  }

  const isDark = document.documentElement.classList.contains("dark");
  const bg = isDark ? "#1f2937" : "#f8fafc";
  const stroke = isDark ? "#c8d6e8" : "#334155";
  const dim = isDark ? "#64748b" : "#94a3b8";
  const white = isDark ? "#1f2937" : "#ffffff";
  const textC = isDark ? "#e2e8f0" : "#1e293b";
  const CL1 = "#2563eb";
  const CL2 = "#22c55e";

  const W = 760,
    H = 340;
  const PAD_L = 40,
    PAD_R = 40,
    PAD_T = 28,
    PAD_B = 70;

  const VR = Math.min((H - PAD_T - PAD_B) * 0.5, 100);

  // WP near horizontal centre-left so arc and outbound have room to the right
  const wpX = PAD_L + (W - PAD_L - PAD_R) * 0.4;
  const wpY = PAD_T + (H - PAD_T - PAD_B) / 2;

  const theta = theta_deg * (Math.PI / 180);
  const halfTheta = theta / 2;

  // Horizontal scale for L1/L2 annotations (schematic)
  const availW = wpX - PAD_L - 10;
  const scL = Math.min((availW * 0.65) / Math.max(L1, 0.01), 80);
  const L1px = Math.min(L1 * scL, availW * 0.65);
  const L2px = Math.min(L2 * scL, 60);

  // Inbound arrives from lower-left at halfTheta below horizontal, ends at WP
  const inbLen = L1px + 50;
  const inbStartX = wpX - inbLen * Math.cos(halfTheta);
  const inbStartY = wpY + inbLen * Math.sin(halfTheta);

  // Arc centre: perpendicular left of the heading direction at WP
  // Heading at WP = (cos(halfTheta), -sin(halfTheta)) (right + up in SVG, inbound direction)
  // Left perp (CCW 90 deg) = (sin(halfTheta), cos(halfTheta))
  const cx = wpX + VR * Math.sin(halfTheta);
  const cy = wpY + VR * Math.cos(halfTheta);

  // Angle from centre to WP in SVG
  const wpAngle = Math.atan2(wpY - cy, wpX - cx);

  // Arc end: rotate CW by theta
  const arcEndAngle = wpAngle + theta;
  const arcEndX = cx + VR * Math.cos(arcEndAngle);
  const arcEndY = cy + VR * Math.sin(arcEndAngle);

  // Outbound direction: CW tangent at arcEnd = (sin(arcEndAngle), -cos(arcEndAngle))
  const outDirX = Math.sin(arcEndAngle);
  const outDirY = -Math.cos(arcEndAngle);
  const outLen = L2px + 60;
  const outEndX = arcEndX + outLen * outDirX;
  const outEndY = arcEndY + outLen * outDirY;

  // L2 endpoint on the outbound (for dimension)
  const l2EndX = arcEndX + L2px * outDirX;
  const l2EndY = arcEndY + L2px * outDirY;

  // Start-of-turn point on inbound (L1 back from WP)
  const sotX = wpX - L1px * Math.cos(halfTheta);
  const sotY = wpY + L1px * Math.sin(halfTheta);

  function f(v) {
    return v.toFixed(1);
  }
  function solidLine(ax, ay, bx, by, col, sw) {
    sw = sw || 1.5;
    return (
      '<line x1="' +
      f(ax) +
      '" y1="' +
      f(ay) +
      '" x2="' +
      f(bx) +
      '" y2="' +
      f(by) +
      '" stroke="' +
      col +
      '" stroke-width="' +
      sw +
      '"/>'
    );
  }
  function dashLine(ax, ay, bx, by, col, sw, da) {
    sw = sw || 1;
    da = da || "5 3";
    return (
      '<line x1="' +
      f(ax) +
      '" y1="' +
      f(ay) +
      '" x2="' +
      f(bx) +
      '" y2="' +
      f(by) +
      '" stroke="' +
      col +
      '" stroke-width="' +
      sw +
      '" stroke-dasharray="' +
      da +
      '"/>'
    );
  }
  function txt(x, y, s, col, sz, anchor, italic) {
    sz = sz || 11;
    anchor = anchor || "middle";
    return (
      '<text x="' +
      f(x) +
      '" y="' +
      f(y) +
      '" text-anchor="' +
      anchor +
      '" font-size="' +
      sz +
      '" fill="' +
      col +
      '" font-family="sans-serif"' +
      (italic ? ' font-style="italic"' : "") +
      ">" +
      s +
      "</text>"
    );
  }

  // Dimension arrow helper (axis-aligned horizontal only for simplicity)
  function hArrow(x1, x2, y, col, lbl, val) {
    const mid = (x1 + x2) / 2,
      tk = 5;
    return (
      solidLine(x1, y, x2, y, col, 1.5) +
      '<line x1="' +
      f(x1) +
      '" y1="' +
      f(y - tk) +
      '" x2="' +
      f(x1) +
      '" y2="' +
      f(y + tk) +
      '" stroke="' +
      col +
      '" stroke-width="1.5"/>' +
      '<line x1="' +
      f(x2) +
      '" y1="' +
      f(y - tk) +
      '" x2="' +
      f(x2) +
      '" y2="' +
      f(y + tk) +
      '" stroke="' +
      col +
      '" stroke-width="1.5"/>' +
      '<text x="' +
      f(mid) +
      '" y="' +
      f(y - 8) +
      '" text-anchor="middle" font-size="11" font-weight="700" fill="' +
      col +
      '" font-family="monospace">' +
      lbl +
      "</text>" +
      '<text x="' +
      f(mid) +
      '" y="' +
      f(y + 18) +
      '" text-anchor="middle" font-size="10" fill="' +
      col +
      '" font-family="monospace">' +
      val +
      "</text>"
    );
  }

  // Dimension annotation row (below the diagram)
  const annY = H - PAD_B + 16;

  // For L1 annotation: project WP and SOT horizontally to annY row
  const l1AnnX1 = sotX;
  const l1AnnX2 = wpX;

  // For L2 annotation: project arcEnd and l2End horizontally to annY row
  const l2AnnX1 = arcEndX;
  const l2AnnX2 = arcEndX + L2px; // use horizontal projection

  // Large arc flag
  const largeArc = theta > Math.PI ? 1 : 0;

  // WP symbol
  const wpR2 = 8;
  const wpSvg =
    '<circle cx="' +
    f(wpX) +
    '" cy="' +
    f(wpY) +
    '" r="' +
    wpR2 +
    '" fill="' +
    white +
    '" stroke="' +
    stroke +
    '" stroke-width="1.8"/>' +
    '<line x1="' +
    f(wpX - wpR2) +
    '" y1="' +
    f(wpY) +
    '" x2="' +
    f(wpX + wpR2) +
    '" y2="' +
    f(wpY) +
    '" stroke="' +
    stroke +
    '" stroke-width="1.2"/>' +
    '<line x1="' +
    f(wpX) +
    '" y1="' +
    f(wpY - wpR2) +
    '" x2="' +
    f(wpX) +
    '" y2="' +
    f(wpY + wpR2) +
    '" stroke="' +
    stroke +
    '" stroke-width="1.2"/>';

  // Angle annotation arc
  const tR = Math.min(VR * 0.22, 28);
  // From inbound departure direction at WP to outbound departure direction
  const inbDirAngle = Math.PI + halfTheta; // backward along inbound
  const outbDirAngle = wpAngle + Math.PI / 2; // CW tangent at WP
  const tSx = wpX + tR * Math.cos(inbDirAngle);
  const tSy = wpY + tR * Math.sin(inbDirAngle);
  const tEx = wpX + tR * Math.cos(outbDirAngle);
  const tEy = wpY + tR * Math.sin(outbDirAngle);
  const tArc =
    '<path d="M ' +
    f(tSx) +
    "," +
    f(tSy) +
    " A " +
    tR +
    "," +
    tR +
    " 0 " +
    largeArc +
    ",1 " +
    f(tEx) +
    "," +
    f(tEy) +
    '" fill="none" stroke="' +
    dim +
    '" stroke-width="1.2"/>';
  const tMidAngle = inbDirAngle + theta / 2;
  const tLblX = wpX + (tR + 16) * Math.cos(tMidAngle);
  const tLblY = wpY + (tR + 16) * Math.sin(tMidAngle);

  // Dashed radius
  const rMidAngle = wpAngle + theta / 2;
  const rMidX = cx + VR * Math.cos(rMidAngle);
  const rMidY = cy + VR * Math.sin(rMidAngle);

  const svgContent =
    '<svg viewBox="0 0 ' +
    W +
    " " +
    H +
    '" class="w-full" role="img" aria-label="Flyby MSD diagram PANS-OPS III-2-1-8" style="background:' +
    bg +
    ';border-radius:8px;font-family:sans-serif">\n' +
    "<!-- Inbound track -->\n" +
    '<path d="M ' +
    f(inbStartX) +
    "," +
    f(inbStartY) +
    " L " +
    f(wpX) +
    "," +
    f(wpY) +
    '" fill="none" stroke="' +
    stroke +
    '" stroke-width="2.2" stroke-linecap="round"/>\n' +
    "<!-- Turn arc (CW, left turn) -->\n" +
    '<path d="M ' +
    f(wpX) +
    "," +
    f(wpY) +
    " A " +
    f(VR) +
    "," +
    f(VR) +
    " 0 " +
    largeArc +
    ",1 " +
    f(arcEndX) +
    "," +
    f(arcEndY) +
    '" fill="none" stroke="' +
    stroke +
    '" stroke-width="2.2" stroke-linecap="round"/>\n' +
    "<!-- Outbound track -->\n" +
    '<path d="M ' +
    f(arcEndX) +
    "," +
    f(arcEndY) +
    " L " +
    f(outEndX) +
    "," +
    f(outEndY) +
    '" fill="none" stroke="' +
    stroke +
    '" stroke-width="2.2" stroke-linecap="round"/>\n' +
    "<!-- Dashed radius -->\n" +
    dashLine(cx, cy, rMidX, rMidY, dim) +
    "\n" +
    txt(
      cx + (rMidX - cx) * 0.55 + 8,
      cy + (rMidY - cy) * 0.55,
      "r",
      dim,
      11,
      "start",
      true,
    ) +
    "\n" +
    "<!-- WP symbol -->\n" +
    wpSvg +
    "\n" +
    "<!-- Theta annotation -->\n" +
    tArc +
    "\n" +
    txt(
      tLblX,
      tLblY + 4,
      "\u03b8 = " + theta_deg + "\u00b0",
      dim,
      10,
      "middle",
      true,
    ) +
    "\n" +
    "<!-- Drop lines for dimension row -->\n" +
    dashLine(sotX, sotY, l1AnnX1, annY - 18, dim, 0.7, "3 3") +
    "\n" +
    dashLine(wpX, wpY, l1AnnX2, annY - 18, dim, 0.7, "3 3") +
    "\n" +
    dashLine(arcEndX, arcEndY, l2AnnX1, annY - 18, dim, 0.7, "3 3") +
    "\n" +
    dashLine(l2EndX, l2EndY, l2AnnX2, annY - 18, dim, 0.7, "3 3") +
    "\n" +
    "<!-- L1 dimension -->\n" +
    hArrow(l1AnnX1, l1AnnX2, annY, CL1, "L1", L1.toFixed(3) + " NM") +
    "\n" +
    "<!-- L2 dimension -->\n" +
    hArrow(l2AnnX1, l2AnnX2, annY, CL2, "L2", L2.toFixed(3) + " NM") +
    "\n" +
    "<!-- MSD total -->\n" +
    '<text x="' +
    f(W / 2) +
    '" y="' +
    f(H - 12) +
    '" text-anchor="middle" font-size="12" font-weight="700" fill="' +
    textC +
    '" font-family="monospace">M = L1 + L2 = ' +
    (L1 + L2).toFixed(4) +
    " NM</text>\n" +
    "</svg>";

  container.innerHTML = svgContent;
  diagramSection.classList.remove("hidden");
}

// --- Save / Load parameters ---------------------------------------------------

function saveParameters() {
  const data = {
    ias: document.getElementById("ias").value || "",
    altitude: document.getElementById("altitude").value || "",
    altitudeUnit: document.getElementById("altitudeUnit").value || "ft",
    bankAngle: document.getElementById("bankAngle").value || "",
    turnAngle: document.getElementById("turnAngle").value || "",
  };

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = timestamp + "_flyby_msd.json";
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
      if (data.ias !== undefined)
        document.getElementById("ias").value = data.ias;
      if (data.altitude !== undefined)
        document.getElementById("altitude").value = data.altitude;
      if (data.altitudeUnit) {
        const sel = document.getElementById("altitudeUnit");
        sel.dataset.lastUnit = sel.value;
        sel.value = data.altitudeUnit;
      }
      if (data.bankAngle !== undefined)
        document.getElementById("bankAngle").value = data.bankAngle;
      if (data.turnAngle !== undefined)
        document.getElementById("turnAngle").value = data.turnAngle;
      showToast("Parameters loaded.", "success");
    } catch {
      showToast("Invalid JSON file.", "error");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

// --- Copy to Word -------------------------------------------------------------

function copyToWord() {
  const mVal = document.getElementById("outM").textContent;
  if (!mVal) return;

  const tableData = {
    IAS: document.getElementById("ias").value + " KT",
    "Altitude h1":
      document.getElementById("altitude").value +
      " " +
      document.getElementById("altitudeUnit").value,
    "k Factor": document.getElementById("outKFactor").textContent,
    "Bank Angle": document.getElementById("bankAngle").value + "\u00b0",
    "Turn Angle A": document.getElementById("outTurnUsed").textContent,
    TAS: document.getElementById("outTas").textContent + " KT",
    "Radius (r)": document.getElementById("outR").textContent + " NM",
    "L1 = r x tan(A/2)": document.getElementById("outL1").textContent + " NM",
    "L2 = 5 x V/3600": document.getElementById("outL2").textContent + " NM",
    "M (Flyby MSD)": mVal + " NM",
  };

  const htmlContent = createHTMLTable(tableData, "Flyby MSD � PANS-OPS S1.4.2");
  copyToClipboard(htmlContent);
}
