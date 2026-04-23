// ─── Fallback helpers ────────────────────────────────────────────────────────
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
  var _DEG_TO_RAD_FB = Math.PI / 180;
  // eslint-disable-next-line no-unused-vars
  function calculateRadius(tas, bankAngle_deg) {
    return (tas * tas) / (68625 * Math.tan(bankAngle_deg * _DEG_TO_RAD_FB));
  }
}
if (typeof calculateRateOfTurn === "undefined") {
  // eslint-disable-next-line no-unused-vars
  function calculateRateOfTurn(tas, radius_nm) {
    return tas / (111.95 * radius_nm);
  }
}
if (typeof calculateRadiusWithRateOfTurnCap === "undefined") {
  var _DEG_TO_RAD_FB2 = Math.PI / 180;
  // eslint-disable-next-line no-unused-vars
  function calculateRadiusWithRateOfTurnCap(tas, bankAngle_deg) {
    var radius =
      (tas * tas) / (68625 * Math.tan(bankAngle_deg * _DEG_TO_RAD_FB2));
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

// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  checkDarkMode();
  initializeUnitSelectors();
  setupEventListeners();

  // Initialize i18n
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

// ─── Event listeners ─────────────────────────────────────────────────────────

function setupEventListeners() {
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", function () {
    document.getElementById("loadFile").click();
  });
  document
    .getElementById("loadFile")
    .addEventListener("change", loadParameters);
  document
    .getElementById("btnCalculate")
    .addEventListener("click", calculateFlyover);
  document.getElementById("btnCopy").addEventListener("click", copyToWord);
  document.getElementById("copyPrecision").addEventListener("click", () => {
    const btn = document.getElementById("copyPrecision");
    const nowExact = btn.dataset.value !== "exact";
    btn.dataset.value = nowExact ? "exact" : "rounded";
    const span = btn.querySelector("span");
    if (span) {
      const key = nowExact ? "common.copyExact" : "common.copyRounded";
      span.dataset.i18n = key;
      span.textContent =
        (window.I18N && I18N.get(key)) ||
        (nowExact ? "Exact" : "Rounded (4 dec.)");
    }
    applyDisplayPrecision();
  });

  document
    .getElementById("altitudeUnit")
    .addEventListener("change", function () {
      handleUnitChange("altitude", "altitudeUnit");
    });
}

// ─── Unit handling ────────────────────────────────────────────────────────────

function initializeUnitSelectors() {
  const unitSelectors = document.querySelectorAll('select[id$="Unit"]');
  unitSelectors.forEach((selector) => {
    selector.dataset.lastUnit = selector.value;
  });
}

function handleUnitChange(inputId, unitSelectId) {
  const input = document.getElementById(inputId);
  const unitSelect = document.getElementById(unitSelectId);
  const currentValue = parseFloat(input.value);

  if (!isNaN(currentValue)) {
    const oldUnit = unitSelect.dataset.lastUnit || unitSelect.value;
    const newUnit = unitSelect.value;
    if (oldUnit !== newUnit) {
      if (oldUnit === "ft" && newUnit === "m") {
        input.value = (currentValue * 0.3048).toFixed(4);
      } else if (oldUnit === "m" && newUnit === "ft") {
        input.value = (currentValue / 0.3048).toFixed(4);
      }
    }
  }
  unitSelect.dataset.lastUnit = unitSelect.value;
}

// ─── Stored raw results ───────────────────────────────────────────────────────

const _raw = {};

// Re-render all result spans using the selected precision mode
function applyDisplayPrecision() {
  if (_raw.msd === undefined) return;
  const exact =
    document.getElementById("copyPrecision").dataset.value === "exact";
  const fmt = (v) => (exact ? v.toString() : v.toFixed(4));
  document.getElementById("outKFactor").textContent = fmt(_raw.kFactor);
  document.getElementById("outTas").textContent = fmt(_raw.tas);
  document.getElementById("outR1").textContent = fmt(_raw.r1);
  document.getElementById("outR2").textContent = fmt(_raw.r2);
  document.getElementById("outL1").textContent = fmt(_raw.L1);
  document.getElementById("outL2").textContent = fmt(_raw.L2);
  document.getElementById("outL3").textContent = fmt(_raw.L3);
  document.getElementById("outL4").textContent = fmt(_raw.L4);
  document.getElementById("outL5").textContent = fmt(_raw.L5);
  document.getElementById("outMsd").textContent = fmt(_raw.msd);
}

// ─── Core calculation ─────────────────────────────────────────────────────────

function calculateFlyover() {
  // --- Read inputs ---
  const iasVal = parseFloat(document.getElementById("ias").value);
  const altitudeRaw = parseFloat(document.getElementById("altitude").value);
  const altitudeUnit = document.getElementById("altitudeUnit").value;
  const bankAngleVal = parseFloat(document.getElementById("bankAngle").value);
  const turnAngle = parseFloat(document.getElementById("turnAngle").value);
  const isaRaw = document.getElementById("isaDeviation").value.trim();
  const isaDeviation = isaRaw === "" ? 0 : parseFloat(isaRaw);

  // --- Validate ---
  if (isNaN(iasVal) || iasVal <= 0) {
    showToast("Please enter a valid IAS (> 0).", "error");
    return;
  }
  if (isNaN(altitudeRaw) || altitudeRaw < 0) {
    showToast("Please enter a valid altitude (≥ 0).", "error");
    return;
  }
  if (isNaN(bankAngleVal) || bankAngleVal <= 0 || bankAngleVal >= 90) {
    showToast("Please enter a valid bank angle (1–89°).", "error");
    return;
  }
  if (isNaN(turnAngle) || turnAngle <= 0) {
    showToast("Please enter a valid turn angle (> 0).", "error");
    return;
  }
  if (!isNaN(parseFloat(isaRaw)) && isNaN(isaDeviation)) {
    showToast("Please enter a valid ISA Deviation.", "error");
    return;
  }

  // --- Convert altitude to feet ---
  const altitude_ft =
    altitudeUnit === "ft" ? altitudeRaw : altitudeRaw / 0.3048;

  // --- TAS ---
  const kFactor = calculateKFactor(altitude_ft, isaDeviation);
  const tas = calculateTAS(iasVal, kFactor);

  // --- Radii (with rate of turn cap: max 3°/s per PANS-OPS) ---
  const r1Obj = calculateRadiusWithRateOfTurnCap(tas, bankAngleVal); // roll-in (user bank)
  const r1 = r1Obj.radiusForCalc;
  const r2Obj = calculateRadiusWithRateOfTurnCap(tas, 15); // roll-out fixed 15° §1.4.1.3
  const r2 = r2Obj.radiusForCalc;

  // --- Segment lengths (PANS-OPS Vol II §1.4.1) ---
  const ALPHA_DEG = 30;
  const theta_rad = turnAngle * (Math.PI / 180);
  const alpha_rad = ALPHA_DEG * (Math.PI / 180);

  const L1 = r1 * Math.sin(theta_rad);
  const L2 = r1 * Math.cos(theta_rad) * Math.tan(alpha_rad);
  const L3 =
    r1 *
    (1 / Math.sin(alpha_rad) -
      (2 * Math.cos(theta_rad)) / Math.sin((60 * Math.PI) / 180));
  const L4 = r2 * Math.tan(alpha_rad / 2);
  const L5 = (10 * tas) / 3600;

  const msd = L1 + L2 + L3 + L4 + L5;

  // --- Store raw values ---
  _raw.kFactor = kFactor;
  _raw.tas = tas;
  _raw.r1 = r1;
  _raw.r2 = r2;
  _raw.L1 = L1;
  _raw.L2 = L2;
  _raw.L3 = L3;
  _raw.L4 = L4;
  _raw.L5 = L5;
  _raw.msd = msd;

  // --- Populate outputs ---
  document.getElementById("outThetaEff").textContent = turnAngle + "°";
  applyDisplayPrecision();

  // Show results (diagram temporarily hidden — pending geometry fix)
  document.getElementById("resultsSection").classList.remove("hidden");
  // renderSegmentDiagram(L1, L2, L3, L4, L5, r1, r2, turnAngle);
}

// ─── SVG Diagram ──────────────────────────────────────────────────────────────

function renderSegmentDiagram(L1, L2, L3, L4, L5, r1, r2, theta_deg) {
  const msd = L1 + L2 + L3 + L4 + L5;
  const container = document.getElementById("segmentDiagram");
  const diagramSection = document.getElementById("diagramSection");

  if (msd <= 0) {
    diagramSection.classList.add("hidden");
    return;
  }

  const isDark = document.documentElement.classList.contains("dark");
  const bg = isDark ? "#1f2937" : "#f8fafc";
  const stroke = isDark ? "#c8d6e8" : "#334155";
  const dim = isDark ? "#64748b" : "#94a3b8";
  const white = isDark ? "#1f2937" : "#ffffff";
  const textC = isDark ? "#e2e8f0" : "#1e293b";

  const C = {
    L1: "#2563eb",
    L2: "#6366f1",
    L3: "#9ca3af",
    L4: "#f59e0b",
    L5: "#22c55e",
  };

  // ─── Canvas & horizontal scale ───────────────────────────────────────────────
  // X scale: exact (px per NM), so segment widths are proportional to real lengths.
  // Radii: SCHEMATIC (fixed visual size proportional to r1/r2 ratio, not to NM scale)
  // because r1 ≈ 3.6 NM and r2 ≈ 6.3 NM would produce arcs far larger than the canvas.
  // This matches the PANS-OPS figure which is also schematic in the vertical direction.
  const W = 860,
    H = 460;
  const PAD_L = 50,
    PAD_R = 30,
    PAD_T = 18,
    PAD_B = 90;
  const drawW = W - PAD_L - PAD_R;
  const sc = drawW / msd; // px per NM (horizontal only)

  // Visual radii: SCHEMATIC only — preserve r1/r2 ratio but cap to a fixed visual size.
  // VR1 is bounded so the dome fits within the canvas.
  // VR2 uses the same scale factor (same px/NM) so ratio is visually preserved.
  // baseY sits ~60 % of the drawable height below PAD_T so there is room for
  // the dome above AND the dip below the baseline.
  const baseY = PAD_T + Math.round((H - PAD_T - PAD_B) * 0.6);

  const theta = (theta_deg * Math.PI) / 180;
  const alpha = (30 * Math.PI) / 180; // 30° PANS-OPS semi-angle

  // ─── Segment x-boundaries (exact horizontal scale) ──────────────────────────
  const x0 = PAD_L;
  const x1 = PAD_L + L1 * sc; // waypoint
  const x2 = x1 + L2 * sc;
  const x3 = x2 + L3 * sc;
  const x4 = x3 + L4 * sc;
  const x5 = x4 + L5 * sc;
  const xWP = x1;

  // The dome top is at cy1 − VR1 (see below); the dip is at cy1 + VR1·sin(60°).
  // cy1 = baseY − VR1·cos(θ).  Top = baseY − VR1·cosθ − VR1 = baseY − VR1·(1+cosθ).
  // Dip  = baseY − VR1·cosθ + VR1·sin60° = baseY + VR1·(sin60°−cosθ).
  // Constraints:  Top ≥ PAD_T+4,  Dip ≤ baseY+maxDip,  Left edge ≥ PAD_L−10.
  const maxDip = 70; // max pixels below baseline for dip
  const vr1Top = (baseY - PAD_T - 4) / (1 + Math.cos(theta));
  const vr1Bot =
    Math.cos(theta) > Math.sin(Math.PI / 3)
      ? maxDip / (Math.cos(theta) - Math.sin(Math.PI / 3))
      : 999;
  const vr1Left = (xWP - PAD_L + 10) / (1 + Math.sin(theta));
  const VR1 = Math.floor(Math.min(vr1Top, vr1Bot, vr1Left, 130));
  const VR2 = VR1 * (r2 / r1); // preserves r1/r2 ratio

  // ─── Helper SVG primitives ───────────────────────────────────────────────────
  function solidLine(ax, ay, bx, by, col, sw = 1.5) {
    return `<line x1="${f(ax)}" y1="${f(ay)}" x2="${f(bx)}" y2="${f(by)}" stroke="${col}" stroke-width="${sw}"/>`;
  }
  function dashLine(ax, ay, bx, by, col, sw = 1, da = "5 3") {
    return `<line x1="${f(ax)}" y1="${f(ay)}" x2="${f(bx)}" y2="${f(by)}" stroke="${col}" stroke-width="${sw}" stroke-dasharray="${da}"/>`;
  }
  function f(v) {
    return v.toFixed(1);
  }
  function txt(x, y, s, col, sz = 11, anchor = "middle", italic = false) {
    return `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" font-size="${sz}" fill="${col}" font-family="sans-serif"${italic ? ' font-style="italic"' : ""}>${s}</text>`;
  }
  function arrowDim(xA, xB, y, col, lbl, val) {
    const mid = (xA + xB) / 2,
      tk = 6;
    return `${solidLine(xA, y, xB, y, col, 1.5)}
      <line x1="${f(xA)}" y1="${f(y - tk)}" x2="${f(xA)}" y2="${f(y + tk)}" stroke="${col}" stroke-width="1.5"/>
      <line x1="${f(xB)}" y1="${f(y - tk)}" x2="${f(xB)}" y2="${f(y + tk)}" stroke="${col}" stroke-width="1.5"/>
      <text x="${f(mid)}" y="${f(y - 7)}" text-anchor="middle" font-size="11" font-weight="700" fill="${col}" font-family="monospace">${lbl}</text>
      <text x="${f(mid)}" y="${f(y + 18)}" text-anchor="middle" font-size="10" fill="${col}" font-family="monospace">${val}</text>`;
  }

  // ─── Flight-path geometry ────────────────────────────────────────────────────
  //
  // PANS-OPS Fig III-2-1-7 (SVG y-down coordinates).
  //
  //  r1 circle — LEFT turn after overflying WP
  //    Centre is perpendicular-LEFT of the inbound heading at WP.
  //    Inbound heading at WP: (cos θ, −sin θ) in SVG (right + up).
  //    Left-perpendicular: rotate 90° CW in SVG → (−sin θ, −cos θ).
  //    Centre:  cx1 = xWP − VR1·sin θ,   cy1 = baseY − VR1·cos θ.
  //    WP is on the circle at angle  (π/2 − θ)  from centre.
  //
  //  Dome arc (sweep=1 in SVG, CW on canvas = LEFT turn visually)
  //    From WP the aircraft heads right-upward, then turns LEFT.
  //    The arc goes the LONG way around (largeArc=1 always).
  //    Path: WP → right → up → over top → down-left → below baseline → dip "b".
  //    It ends at dip point "b" where the tangent exits the circle at angle
  //    α = 30° above horizontal going rightward (the climb direction).
  //    Tangent for CW canvas motion at angle t: (sin t, −cos t).
  //    Condition: (sin t, −cos t) = (cos α, −sin α) → t = π/3 = 60°.
  //
  //  Dip point "b"
  //    bx = cx1 + VR1·cos 60°   [position depends on θ, can be left or right of WP]
  //    by = cy1 + VR1·sin 60°   [BELOW baseline when θ > ~30°]
  //    Vertical depth below baseline: VR1·(sin60° − cosθ).
  //
  //  Inbound track
  //    Straight line from (x0, y0) to WP at angle θ above horizontal.
  //
  //  30° climb line
  //    From "b" rightward-upward at 30° until reaching L3 boundary or top.
  //
  //  r2 arc (sweep 0) levels the climb to horizontal flight.

  // ── Circle r1 ────────────────────────────────────────────────────────────────
  const cx1 = xWP - VR1 * Math.sin(theta);
  const cy1 = baseY - VR1 * Math.cos(theta);

  // ── Inbound straight line to WP ──────────────────────────────────────────────
  const tanTheta =
    Math.abs(Math.cos(theta)) < 0.1
      ? Math.sign(Math.sin(theta)) * 10
      : Math.tan(theta);
  // y0 = baseY + tanθ·(xWP − x0)  (below baseline since tanθ > 0 and xWP > x0)
  const y0raw = baseY + tanTheta * (xWP - x0);
  const y0 = Math.min(H - PAD_B - 5, Math.max(baseY + 2, y0raw));

  // ── Dip point "b" at angle 60° (π/3) from centre ────────────────────────────
  const dipAngleRad = Math.PI / 3; // 60°
  const dipX = cx1 + VR1 * Math.cos(dipAngleRad);
  const dipY = cy1 + VR1 * Math.sin(dipAngleRad);

  // ── 30° climb from "b" ──────────────────────────────────────────────────────
  const climbSlope = -Math.tan(alpha); // dy/dx negative = rising rightward
  const climbEndYraw = dipY + climbSlope * (x3 - dipX);
  const climbEndY = Math.max(climbEndYraw, PAD_T + 8);
  const climbEndX =
    climbEndY === climbEndYraw ? x3 : dipX + (climbEndY - dipY) / climbSlope;

  // ── r2 levelling arc ─────────────────────────────────────────────────────────
  const cx2 = climbEndX + VR2 * Math.sin(alpha);
  const cy2 = climbEndY - VR2 * Math.cos(alpha);
  const levelX = cx2;
  const levelY = cy2 + VR2;

  // ── SVG paths ────────────────────────────────────────────────────────────────
  const pathInbound = `M ${f(x0)},${f(y0)} L ${f(xWP)},${f(baseY)}`;
  // Dome: WP → b.  sweep=0 picks the upper-left centre (Centre B) so the arc
  // bulges UPWARD like a mountain.  largeArc=1 because the dome spans ~320°.
  // Aircraft heads right+up at WP, curves LEFT over the top, dips below baseline.
  const pathDome = `M ${f(xWP)},${f(baseY)} A ${f(VR1)},${f(VR1)} 0 1,0 ${f(dipX)},${f(dipY)}`;
  const pathClimb = `M ${f(dipX)},${f(dipY)} L ${f(climbEndX)},${f(climbEndY)}`;
  const pathRollHi = `M ${f(climbEndX)},${f(climbEndY)} A ${f(VR2)},${f(VR2)} 0 0,0 ${f(levelX)},${f(levelY)}`;
  const pathLevel = `M ${f(levelX)},${f(levelY)} L ${f(x5)},${f(levelY)}`;

  // ─── Annotation rows ─────────────────────────────────────────────────────────
  const annY1 = H - PAD_B + 10;
  const annY2 = annY1 + 28;

  // Drop-lines from segment boundary x positions down to annotation row
  const dropBot = annY1 - 18;
  function dropLine(xv, topY) {
    return dashLine(xv, topY, xv, dropBot, dim, 0.8, "3 3");
  }

  // ─── Angle annotations ───────────────────────────────────────────────────────
  // θ at waypoint: angle between the horizontal baseline (leftward) and the inbound
  // track arriving from below-left.  The angle sits BELOW the baseline in the figure.
  // Inbound ray from WP goes at angle (π − θ) in SVG: left & downward.
  // We draw the SHORT arc from π to (π − θ) with sweep=0 (CCW).
  // Since sin(angle) > 0 for angles in (π−θ, π) the arc sits BELOW baseline.
  const thetaR = Math.min(VR1 * 0.12, 38);
  const thA1 = Math.PI; // start: points left along baseline
  const thA2 = Math.PI - theta; // end: inbound direction from WP
  const thSx = xWP + thetaR * Math.cos(thA1);
  const thSy = baseY + thetaR * Math.sin(thA1);
  const thEx = xWP + thetaR * Math.cos(thA2);
  const thEy = baseY + thetaR * Math.sin(thA2);
  // sweep=0 (CCW in SVG): short arc from 180° down to (180°−θ)
  const thetaArcSvg = `<path d="M ${f(thSx)},${f(thSy)} A ${thetaR},${thetaR} 0 0,0 ${f(thEx)},${f(thEy)}" fill="none" stroke="${dim}" stroke-width="1.2"/>`;
  const thetaLblX = xWP + (thetaR + 13) * Math.cos(Math.PI - theta / 2);
  const thetaLblY = baseY + (thetaR + 13) * Math.sin(Math.PI - theta / 2);

  // 30° annotation at dip exit (angle between horizontal and 30° climb line)
  const a30R = Math.min(VR1 * 0.18, 28);
  const a30Sx = dipX + a30R; // horizontal direction from dipX,dipY
  const a30Sy = dipY;
  // Climb direction angle in SVG: going right and UP = -alpha from +x axis
  const a30Ex = dipX + a30R * Math.cos(-alpha);
  const a30Ey = dipY + a30R * Math.sin(-alpha);
  const ang30Svg = `<path d="M ${f(a30Sx)},${f(a30Sy)} A ${a30R},${a30R} 0 0,0 ${f(a30Ex)},${f(a30Ey)}" fill="none" stroke="${dim}" stroke-width="1.2"/>`;

  // 60° label: where the climb line crosses the baseline, angle between
  // the vertical (b arrow) and the climb line = 90° − 30° = 60°.
  // Position the label near the climb/baseline crossing point.
  // The climb from dipX,dipY at slope −tan(α) crosses baseY at:
  const climbBaseX =
    dipY > baseY ? dipX + (dipY - baseY) / Math.tan(alpha) : dipX;
  const ang60LblX = climbBaseX - 6;
  const ang60LblY = baseY - 14;

  // 30° annotation near the upper roll-out arc
  const upper30X = climbEndX + 10;
  const upper30Y = climbEndY - 8;

  // r1 dashed radius: from centre to WP (WP is on the circle).
  // In the PANS-OPS figure the r1 label is between centre and the arc.
  const r1midX = (cx1 + xWP) / 2;
  const r1midY = (cy1 + baseY) / 2;

  // "b" dip depth annotation: vertical arrow from baseline to dip
  const bAnnotation = dipY > baseY + 4; // only show if dip is noticeably below baseline

  // r2 dashed radius from centre to mid-arc
  const r2midA = -(Math.PI / 2) + alpha / 2; // midway through upper roll-out arc
  const r2midX = cx2 + VR2 * Math.cos(r2midA);
  const r2midY = cy2 + VR2 * Math.sin(r2midA);

  // Waypoint symbol
  const wpR = 10;
  const wpSvg = `
    <circle cx="${f(xWP)}" cy="${f(baseY)}" r="${wpR}" fill="${white}" stroke="${stroke}" stroke-width="1.8"/>
    <line x1="${f(xWP - wpR)}" y1="${f(baseY)}" x2="${f(xWP + wpR)}" y2="${f(baseY)}" stroke="${stroke}" stroke-width="1.2"/>
    <line x1="${f(xWP)}" y1="${f(baseY - wpR)}" x2="${f(xWP)}" y2="${f(baseY + wpR)}" stroke="${stroke}" stroke-width="1.2"/>`;

  // ─── Build SVG ───────────────────────────────────────────────────────────────
  const svgContent = `
<svg viewBox="0 0 ${W} ${H}" class="w-full" role="img" aria-label="Flyover MSD diagram PANS-OPS III-2-1-7"
     style="background:${bg};border-radius:8px;font-family:sans-serif">

  <!-- Baseline (outbound track reference, dashed) -->
  ${dashLine(x0 - 12, baseY, x5 + 12, baseY, dim, 0.8, "6 4")}

  <!-- Drop lines at segment boundaries -->
  ${dropLine(x0, y0 - 2)}
  ${dropLine(x1, baseY + 2)}
  ${dropLine(x2, Math.max(dipY, baseY) + 2)}
  ${dropLine(x3, Math.min(climbEndY, levelY) - 2)}
  ${dropLine(x4, levelY - 2)}
  ${dropLine(x5, levelY - 2)}

  <!-- r1 dashed radius line (centre → WP) -->
  ${dashLine(cx1, cy1, xWP, baseY, dim)}
  ${txt(r1midX + 8, r1midY - 4, "r1", dim, 11, "start", true)}

  <!-- r2 dashed radius line -->
  ${dashLine(cx2, cy2, r2midX, r2midY, dim)}
  ${txt(cx2 + VR2 * 0.15 + 18, cy2 + VR2 * 0.25, "r2", dim, 11, "middle", true)}

  <!-- ── FLIGHT PATH ─────────────────────────────────────── -->
  <path d="${pathInbound}"  fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="${pathDome}"     fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="${pathClimb}"    fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="${pathRollHi}"   fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="${pathLevel}"    fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>

  <!-- Waypoint symbol -->
  ${wpSvg}

  <!-- θ angle annotation at waypoint -->
  ${thetaArcSvg}
  ${txt(thetaLblX, thetaLblY + 4, "θ", dim, 12, "middle", true)}

  <!-- 30° arc at dip exit -->
  ${ang30Svg}
  ${txt(dipX + a30R + 14, dipY - 2, "30°", dim, 10)}

  <!-- 60° label near climb/baseline crossing -->
  ${txt(ang60LblX, ang60LblY, "60°", dim, 10)}

  <!-- "b" depth annotation (vertical arrow from baseline to dip) -->
  ${
    bAnnotation
      ? `
    ${dashLine(dipX, baseY, dipX, dipY, dim, 0.8, "3 3")}
    <line x1="${f(dipX - 4)}" y1="${f(baseY)}" x2="${f(dipX + 4)}" y2="${f(baseY)}" stroke="${dim}" stroke-width="1"/>
    <line x1="${f(dipX - 4)}" y1="${f(dipY)}" x2="${f(dipX + 4)}" y2="${f(dipY)}" stroke="${dim}" stroke-width="1"/>
    ${txt(dipX + 10, (baseY + dipY) / 2 + 4, "b", dim, 11, "start", true)}
  `
      : ""
  }

  <!-- 30° label near upper roll-out -->
  ${txt(upper30X, upper30Y, "30°", dim, 10)}

  <!-- Segment dimension arrows (exact horizontal scale) -->
  ${arrowDim(x0, x1, annY1, C.L1, "L1", L1.toFixed(3) + " NM")}
  ${arrowDim(x1, x2, annY1, C.L2, "L2", L2.toFixed(3) + " NM")}
  ${arrowDim(x2, x3, annY1, C.L3, "L3", L3.toFixed(3) + " NM")}
  ${arrowDim(x3, x4, annY2, C.L4, "L4", L4.toFixed(3) + " NM")}
  ${arrowDim(x4, x5, annY2, C.L5, "L5", L5.toFixed(3) + " NM")}

  <!-- MSD total brace -->
  ${solidLine(x0, annY2 + 26, x5, annY2 + 26, textC, 1.2)}
  <text x="${f((x0 + x5) / 2)}" y="${f(annY2 + 40)}" text-anchor="middle" font-size="12" font-weight="700" fill="${textC}" font-family="monospace">MSD = ${msd.toFixed(4)} NM</text>

</svg>`;

  container.innerHTML = svgContent;
  diagramSection.classList.remove("hidden");
}

// ─── Save / Load parameters ───────────────────────────────────────────────────

function saveParameters() {
  const data = {
    ias: document.getElementById("ias").value || "",
    altitude: document.getElementById("altitude").value || "",
    altitudeUnit: document.getElementById("altitudeUnit").value || "ft",
    bankAngle: document.getElementById("bankAngle").value || "",
    turnAngle: document.getElementById("turnAngle").value || "",
    isaDeviation: document.getElementById("isaDeviation").value || "",
  };

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_flyover_msd.json`;
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
  // Reset file input so the same file can be reloaded
  event.target.value = "";
}

// ─── Copy to Word ─────────────────────────────────────────────────────────────

function copyToWord() {
  if (_raw.msd === undefined) return;

  const exact =
    document.getElementById("copyPrecision").dataset.value === "exact";
  const fmt = (v) => (exact ? v.toString() : v.toFixed(4));

  const tableData = {
    IAS: document.getElementById("ias").value + " KT",
    "Altitude h1":
      document.getElementById("altitude").value +
      " " +
      document.getElementById("altitudeUnit").value,
    "ISA Deviation (VAR)":
      (document.getElementById("isaDeviation").value || "0") + " °C",
    "k Factor": fmt(_raw.kFactor),
    "Bank Angle r1": document.getElementById("bankAngle").value + "°",
    "Turn Angle (input)": document.getElementById("turnAngle").value + "°",
    TAS: fmt(_raw.tas) + " KT",
    "Turn Angle Used": document.getElementById("outThetaEff").textContent,
    "r1 (roll-in)": fmt(_raw.r1) + " NM",
    "r2 (roll-out, 15° fixed)": fmt(_raw.r2) + " NM",
    L1: fmt(_raw.L1) + " NM",
    L2: fmt(_raw.L2) + " NM",
    L3: fmt(_raw.L3) + " NM",
    L4: fmt(_raw.L4) + " NM",
    "L5 (bank establishment)": fmt(_raw.L5) + " NM",
    "MSD Total": fmt(_raw.msd) + " NM",
  };

  const htmlContent = createHTMLTable(
    tableData,
    "Flyover MSD — PANS-OPS Vol II §1.4.1",
  );
  copyToClipboard(htmlContent);
}
