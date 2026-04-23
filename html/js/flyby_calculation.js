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
if (typeof calculateRateOfTurn === "undefined") {
  // eslint-disable-next-line no-unused-vars
  function calculateRateOfTurn(tas, radius_nm) {
    return tas / (111.95 * radius_nm);
  }
}
if (typeof calculateRadiusWithRateOfTurnCap === "undefined") {
  var _DEG_TO_RAD_FB3 = Math.PI / 180;
  // eslint-disable-next-line no-unused-vars
  function calculateRadiusWithRateOfTurnCap(tas, bankAngle_deg) {
    var radius =
      (tas * tas) / (68625 * Math.tan(bankAngle_deg * _DEG_TO_RAD_FB3));
    var rateOfTurn = tas / (111.95 * radius);
    var rateOfTurnCapped = Math.min(rateOfTurn, 3);
    var radiusForCalc =
      rateOfTurnCapped < rateOfTurn
        ? tas / (111.95 * rateOfTurnCapped)
        : radius;
    return {
      radius: radius,
      rateOfTurn: rateOfTurn,
      rateOfTurnCapped: rateOfTurnCapped,
      radiusForCalc: radiusForCalc,
    };
  }
}

// Raw results store — populated after each calculation
const _raw = {};

// Update displayed result values based on the selected precision mode
function applyDisplayPrecision() {
  if (_raw.M === undefined) return;
  const exact = document.getElementById("copyPrecision").value === "exact";
  const fmt = (v) => (exact ? v.toString() : v.toFixed(4));
  document.getElementById("outKFactor").textContent = fmt(_raw.kFactor);
  document.getElementById("outTas").textContent = fmt(_raw.tas);
  document.getElementById("outR").textContent = fmt(_raw.r);
  document.getElementById("outL1").textContent = fmt(_raw.L1);
  document.getElementById("outL2").textContent = fmt(_raw.L2);
  document.getElementById("outM").textContent = fmt(_raw.M);
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
  document
    .getElementById("copyPrecision")
    .addEventListener("change", applyDisplayPrecision);

  const altUnit = document.getElementById("altitudeUnit");
  if (altUnit) {
    altUnit.addEventListener("change", () =>
      handleUnitChange("altitude", "altitudeUnit"),
    );
  }
}

// --- Core calculation ---------------------------------------------------------

function calculateFlyby() {
  // --- Read inputs ---
  const iasVal = parseFloat(document.getElementById("ias").value);
  const altitudeRaw = parseFloat(document.getElementById("altitude").value);
  const altitudeUnit = document.getElementById("altitudeUnit").value;
  const bankAngleVal = parseFloat(document.getElementById("bankAngle").value);
  const turnAngleRaw = parseFloat(document.getElementById("turnAngle").value);
  const isaDeviationRaw = document.getElementById("isaDeviation").value;
  const isaDeviation = isaDeviationRaw === "" ? 0 : parseFloat(isaDeviationRaw);

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
  if (isNaN(isaDeviation)) {
    showToast("Please enter a valid ISA deviation.", "error");
    return;
  }

  // --- PANS-OPS S1.4.2.2: minimum 50 for regular aircraft ---
  const minAngle = 50;
  const turnAngle = Math.max(turnAngleRaw, minAngle);
  const minApplied = turnAngle !== turnAngleRaw;

  // --- Convert altitude to feet ---
  const altitude_ft =
    altitudeUnit === "ft" ? altitudeRaw : altitudeRaw / 0.3048;

  // --- kFactor and TAS ---
  const kFactor = calculateKFactor(altitude_ft, isaDeviation);
  const tas = calculateTAS(iasVal, kFactor);

  // --- Radius (with rate of turn cap: max 3°/s per PANS-OPS) ---
  const radiusObj = calculateRadiusWithRateOfTurnCap(tas, bankAngleVal);
  const r = radiusObj.radiusForCalc;

  // --- Flyby MSD (PANS-OPS S1.4.2.1) ---
  // L1 = r x tan(A/2)
  // L2 = 5 x V/3600
  const turnHalf_rad = (turnAngle / 2) * (Math.PI / 180);
  const L1 = r * Math.tan(turnHalf_rad);
  const L2 = (5 * tas) / 3600;
  const M = L1 + L2;

  // --- Store raw results and render with current precision ---
  _raw.kFactor = kFactor;
  _raw.tas = tas;
  _raw.r = r;
  _raw.L1 = L1;
  _raw.L2 = L2;
  _raw.M = M;
  document.getElementById("outTurnUsed").textContent = turnAngle + "\u00b0";
  applyDisplayPrecision();

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
  const container = document.getElementById("flybyDiagram");
  const diagramSection = document.getElementById("diagramSection");

  if (L1 + L2 <= 0) {
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
  const CMSD = "#f97316";
  const CNORTH = "#3b82f6";

  const W = 860,
    H = 460;
  const PAD_L = 60,
    PAD_R = 60,
    PAD_T = 32,
    PAD_B = 48;
  const drawW = W - PAD_L - PAD_R;
  const drawH = H - PAD_T - PAD_B;

  const theta = theta_deg * (Math.PI / 180);

  // ── PANS-OPS Flyby geometry ───────────────────────────────────────────────
  // WP = (0,0) = intersection of nominal inbound & outbound tracks.
  // INBOUND = north = straight DOWN from WP (so the north arrow IS the inbound
  // extension above WP, giving a clear θ arc from 0° to outbound).
  // SVG: x→right, y→down.
  //
  // Inbound direction (toward WP, from below): (0, -1)
  // Right-perpendicular (CW turn): (1, 0)  → arc center to the right of SOT
  //
  // SOT  = [0, L1]   (directly below WP by L1)
  // cNM  = [r, L1]   (right of SOT by r)
  // sotAng = π        (SOT is directly left of center)
  // eotAng = π + θ
  // oDX = sin(θ),  oDY = -cos(θ)   (outbound goes lower-right)

  const sotNM = [0, L1];
  const cNM = [r, L1];
  const sotAng = Math.PI;
  const eotAng = Math.PI + theta;
  const eotNM = [r + r * Math.cos(eotAng), L1 + r * Math.sin(eotAng)];
  const oDX = Math.sin(theta); // = -sin(eotAng)
  const oDY = -Math.cos(theta); // =  cos(eotAng)

  const l2EndNM = [eotNM[0] + L2 * oDX, eotNM[1] + L2 * oDY];

  const inbExt = Math.max(r * 0.28, L1 * 0.3);
  const outExt = Math.max(r * 0.28, L2 * 0.3);
  const inbStNM = [0, L1 + inbExt]; // below SOT (inbound goes straight down)
  const outEndNM = [l2EndNM[0] + outExt * oDX, l2EndNM[1] + outExt * oDY];

  // Arc midpoint for r label
  const rMidAng = Math.PI + theta / 2;
  const rMidNM = [r + r * Math.cos(rMidAng), L1 + r * Math.sin(rMidAng)];

  // ── Bounding box in NM ───────────────────────────────────────────────────
  // WP (0,0) is the topmost, left-most point; all content is at x≥0, y≥0.
  const allNMx = [0, eotNM[0], l2EndNM[0], outEndNM[0], rMidNM[0]];
  const allNMy = [
    inbStNM[1],
    sotNM[1],
    0,
    eotNM[1],
    l2EndNM[1],
    outEndNM[1],
    rMidNM[1],
  ];
  const minXnm = 0; // inbound is on x=0
  const maxXnm = Math.max(...allNMx);
  const maxYnm = Math.max(...allNMy);

  // ── Scale & WP position ──────────────────────────────────────────────────
  const northLen = 64;
  const northLblMg = 18;
  const topPad = northLen + northLblMg + 4;

  const contentH = drawH - topPad - 4;
  const contentW = drawW;
  const scH = contentH / Math.max(maxYnm, 0.01);
  // reserve ~60px left of WP for the M dimension label offset
  const dimLeftPad = 60;
  const scW = (contentW - dimLeftPad) / Math.max(maxXnm + 0.1, 0.01);
  const sc = Math.min(scH, scW) * 0.9;

  // Center the full scene (dimLeftPad + scene width) in the draw area
  const scenePxW = dimLeftPad + maxXnm * sc;
  const wpX = PAD_L + dimLeftPad + Math.round((contentW - scenePxW) / 2);
  const wpY = PAD_T + topPad;

  // NM → SVG pixel
  function px(nm) {
    return [wpX + nm[0] * sc, wpY + nm[1] * sc];
  }
  const rPx = r * sc;

  const [sotX, sotY] = px(sotNM);
  const [inbStX, inbStY] = px(inbStNM);
  const [cX, cY] = px(cNM);
  const [eotX, eotY] = px(eotNM);
  const [l2EndX, l2EndY] = px(l2EndNM);
  const [outEndX, outEndY] = px(outEndNM);
  const [rMidX, rMidY] = px(rMidNM);

  const largeArc = theta > Math.PI ? 1 : 0;

  // ── SVG helpers ───────────────────────────────────────────────────────────
  function f(v) {
    return v.toFixed(1);
  }

  function line(x1, y1, x2, y2, col, sw, dash) {
    let s =
      '<line x1="' +
      f(x1) +
      '" y1="' +
      f(y1) +
      '" x2="' +
      f(x2) +
      '" y2="' +
      f(y2) +
      '" stroke="' +
      col +
      '" stroke-width="' +
      (sw || 1.5) +
      '"';
    if (dash) s += ' stroke-dasharray="' + dash + '"';
    return s + "/>";
  }

  function txt(x, y, s, col, sz, anchor, bold) {
    return (
      '<text x="' +
      f(x) +
      '" y="' +
      f(y) +
      '" text-anchor="' +
      (anchor || "middle") +
      '" font-size="' +
      (sz || 11) +
      '" fill="' +
      col +
      '" font-family="sans-serif"' +
      (bold ? ' font-weight="700"' : "") +
      ">" +
      s +
      "</text>"
    );
  }

  // Parallel-offset dimension line along a track segment
  function dimLine(ax, ay, bx, by, col, lbl, val, od) {
    od = od || 20;
    const dx = bx - ax,
      dy = by - ay,
      len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return "";
    const px2 = (-dy / len) * od,
      py2 = (dx / len) * od; // left-perpendicular offset
    const ax2 = ax + px2,
      ay2 = ay + py2,
      bx2 = bx + px2,
      by2 = by + py2;
    const mx = (ax2 + bx2) / 2,
      my = (ay2 + by2) / 2;
    const tk = 5,
      nx = (-dy / len) * tk,
      ny = (dx / len) * tk;
    return (
      line(ax2, ay2, bx2, by2, col, 1.5) +
      line(ax2 - nx, ay2 - ny, ax2 + nx, ay2 + ny, col, 1.5) +
      line(bx2 - nx, by2 - ny, bx2 + nx, by2 + ny, col, 1.5) +
      line(ax, ay, ax2, ay2, col, 0.6, "3 3") +
      line(bx, by, bx2, by2, col, 0.6, "3 3") +
      txt(mx, my - 7, lbl, col, 11, "middle", true) +
      txt(mx, my + 14, val, col, 10, "middle", false)
    );
  }

  // Waypoint symbol (circle with crosshair)
  function wpSym(x, y) {
    const wr = 9;
    return (
      '<circle cx="' +
      f(x) +
      '" cy="' +
      f(y) +
      '" r="' +
      wr +
      '" fill="' +
      white +
      '" stroke="' +
      stroke +
      '" stroke-width="1.8"/>' +
      line(x - wr, y, x + wr, y, stroke, 1.2) +
      line(x, y - wr, x, y + wr, stroke, 1.2)
    );
  }

  // ── North arrow ───────────────────────────────────────────────────────────
  const northTopX = wpX,
    northTopY = wpY - northLen;
  const northSvg =
    line(wpX, wpY, northTopX, northTopY, CNORTH, 1.8, "6 3") +
    '<polygon points="' +
    f(northTopX) +
    "," +
    f(northTopY - 7) +
    " " +
    f(northTopX - 4) +
    "," +
    f(northTopY + 4) +
    " " +
    f(northTopX + 4) +
    "," +
    f(northTopY + 4) +
    '" fill="' +
    CNORTH +
    '"/>' +
    txt(northTopX, northTopY - 10, "0\u00b0", CNORTH, 10, "middle", false);

  // ── Angle annotation arc at WP ────────────────────────────────────────────
  // Sweep CW from north (0° = up, touching the north arrow) to the outbound
  // direction (touching the outbound solid line). Arc spans exactly θ.
  const tR = Math.min(rPx * 0.28, 36);
  const tSAng = -Math.PI / 2; // north = straight up in SVG
  const tEAng = tSAng + theta; // CW sweep of theta → outbound direction
  const tSx = wpX + tR * Math.cos(tSAng); // = wpX (on north arrow line)
  const tSy = wpY + tR * Math.sin(tSAng); // = wpY - tR (above WP)
  const tEx = wpX + tR * Math.cos(tEAng);
  const tEy = wpY + tR * Math.sin(tEAng);
  const tLargeArc = theta > Math.PI ? 1 : 0;
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
    tLargeArc +
    ",1 " +
    f(tEx) +
    "," +
    f(tEy) +
    '" fill="none" stroke="' +
    dim +
    '" stroke-width="1.5"/>';
  const tMidA = tSAng + theta / 2;
  const tLblX = wpX + (tR + 20) * Math.cos(tMidA);
  const tLblY = wpY + (tR + 20) * Math.sin(tMidA);

  // ── MSD highlight path: SOT → arc → EOT → l2End ──────────────────────────
  const msdPath =
    '<path d="M ' +
    f(sotX) +
    "," +
    f(sotY) +
    " A " +
    f(rPx) +
    "," +
    f(rPx) +
    " 0 " +
    largeArc +
    ",1 " +
    f(eotX) +
    "," +
    f(eotY) +
    " L " +
    f(l2EndX) +
    "," +
    f(l2EndY) +
    '" fill="none" stroke="' +
    CMSD +
    '" stroke-width="2.5" stroke-dasharray="8 3" opacity="0.75"/>';

  // ── Assemble SVG ──────────────────────────────────────────────────────────
  const svg =
    '<svg viewBox="0 0 ' +
    W +
    " " +
    H +
    '" class="w-full" role="img" ' +
    'aria-label="Flyby MSD diagram PANS-OPS III-2-1-8" style="background:' +
    bg +
    ';border-radius:8px;font-family:sans-serif">\n' +
    "<!-- Inbound nominal track (\u2192 WP corner) -->\n" +
    '<path d="M ' +
    f(inbStX) +
    "," +
    f(inbStY) +
    " L " +
    f(wpX) +
    "," +
    f(wpY) +
    '" fill="none" stroke="' +
    stroke +
    '" stroke-width="2.2" stroke-linecap="round"/>\n' +
    "<!-- Aircraft path arc (SOT→EOT, cuts the corner before WP) -->\n" +
    '<path d="M ' +
    f(sotX) +
    "," +
    f(sotY) +
    " A " +
    f(rPx) +
    "," +
    f(rPx) +
    " 0 " +
    largeArc +
    ",1 " +
    f(eotX) +
    "," +
    f(eotY) +
    '" fill="none" stroke="' +
    stroke +
    '" stroke-width="2.2" stroke-dasharray="6 3" stroke-linecap="round"/>\n' +
    "<!-- Outbound nominal track (from WP) -->\n" +
    '<path d="M ' +
    f(wpX) +
    "," +
    f(wpY) +
    " L " +
    f(outEndX) +
    "," +
    f(outEndY) +
    '" fill="none" stroke="' +
    stroke +
    '" stroke-width="2.2" stroke-linecap="round"/>\n' +
    "<!-- MSD path highlight -->\n" +
    msdPath +
    "\n" +
    "<!-- Dashed radius -->\n" +
    line(cX, cY, rMidX, rMidY, dim, 1, "5 3") +
    "\n" +
    txt(
      cX + (rMidX - cX) * 0.58 + 8,
      cY + (rMidY - cY) * 0.58,
      "r",
      dim,
      11,
      "start",
      false,
    ) +
    "\n" +
    "<!-- M dimension (MSD total, shown along inbound) -->\n" +
    dimLine(sotX, sotY, wpX, wpY, CL1, "M", (L1 + L2).toFixed(3) + " NM", -26) +
    "\n" +
    "<!-- North arrow -->\n" +
    northSvg +
    "\n" +
    "<!-- WP symbol -->\n" +
    wpSym(wpX, wpY) +
    "\n" +
    "<!-- Angle arc -->\n" +
    tArc +
    "\n" +
    txt(tLblX, tLblY + 4, theta_deg + "\u00b0", dim, 10, "middle", false) +
    "\n" +
    "<!-- MSD label box -->\n" +
    '<rect x="' +
    f(PAD_L) +
    '" y="' +
    f(PAD_T) +
    '" width="110" height="22" rx="4" fill="' +
    CMSD +
    '" fill-opacity="0.12" stroke="' +
    CMSD +
    '" stroke-width="1"/>\n' +
    txt(PAD_L + 55, PAD_T + 15, "MSD = L1 + L2", CMSD, 11, "middle", true) +
    "\n" +
    "<!-- Total -->\n" +
    '<text x="' +
    f(W / 2) +
    '" y="' +
    f(H - 14) +
    '" text-anchor="middle" font-size="12" ' +
    'font-weight="700" fill="' +
    textC +
    '" font-family="monospace">' +
    "M = L1 + L2 = " +
    (L1 + L2).toFixed(4) +
    " NM</text>\n" +
    "</svg>";

  container.innerHTML = svg;
  diagramSection.classList.remove("hidden");
}

// --- Save / Load parameters ---------------------------------------------------

function saveParameters() {
  const data = {
    ias: document.getElementById("ias").value || "",
    altitude: document.getElementById("altitude").value || "",
    altitudeUnit: document.getElementById("altitudeUnit").value || "ft",
    isaDeviation: document.getElementById("isaDeviation").value || "",
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
      if (data.isaDeviation !== undefined)
        document.getElementById("isaDeviation").value = data.isaDeviation;
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
  if (_raw.M === undefined) return;

  const exact = document.getElementById("copyPrecision").value === "exact";
  const fmt = (v) => (exact ? v.toString() : v.toFixed(4));

  const tableData = {
    IAS: document.getElementById("ias").value + " KT",
    "Altitude h1":
      document.getElementById("altitude").value +
      " " +
      document.getElementById("altitudeUnit").value,
    "ISA Deviation (VAR)":
      document.getElementById("isaDeviation").value + " \u00b0C",
    "k Factor": fmt(_raw.kFactor),
    "Bank Angle": document.getElementById("bankAngle").value + "\u00b0",
    "Turn Angle A": document.getElementById("outTurnUsed").textContent,
    TAS: fmt(_raw.tas) + " KT",
    "Radius (r)": fmt(_raw.r) + " NM",
    "L1 = r x tan(A/2)": fmt(_raw.L1) + " NM",
    "L2 = 5 x V/3600": fmt(_raw.L2) + " NM",
    "M (Flyby MSD)": fmt(_raw.M) + " NM",
  };

  const htmlContent = createHTMLTable(
    tableData,
    "Flyby MSD \u2014 PANS-OPS S1.4.2",
  );
  copyToClipboard(htmlContent);
}
