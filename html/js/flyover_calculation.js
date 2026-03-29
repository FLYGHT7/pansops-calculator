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
        input.value = (currentValue * 0.3048).toFixed(2);
      } else if (oldUnit === "m" && newUnit === "ft") {
        input.value = (currentValue / 0.3048).toFixed(2);
      }
    }
  }
  unitSelect.dataset.lastUnit = unitSelect.value;
}

// ─── Core calculation ─────────────────────────────────────────────────────────

function calculateFlyover() {
  // --- Read inputs ---
  const iasVal = parseFloat(document.getElementById("ias").value);
  const altitudeRaw = parseFloat(document.getElementById("altitude").value);
  const altitudeUnit = document.getElementById("altitudeUnit").value;
  const bankAngleVal = parseFloat(document.getElementById("bankAngle").value);
  const turnAngle = parseFloat(document.getElementById("turnAngle").value);

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

  // --- Convert altitude to feet ---
  const altitude_ft =
    altitudeUnit === "ft" ? altitudeRaw : altitudeRaw / 0.3048;

  // --- TAS (ISA+15 per PANS-OPS procedure design standard) ---
  const kFactor = calculateKFactor(altitude_ft, 15);
  const tas = calculateTAS(iasVal, kFactor);

  // --- Radii ---
  const r1 = calculateRadius(tas, bankAngleVal); // roll-in (user bank)
  const r2 = calculateRadius(tas, 15); // roll-out fixed 15° §1.4.1.3

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

  // --- Populate outputs ---
  document.getElementById("outKFactor").textContent = kFactor.toFixed(4);
  document.getElementById("outTas").textContent = tas.toFixed(4);
  document.getElementById("outR1").textContent = r1.toFixed(4);
  document.getElementById("outR2").textContent = r2.toFixed(4);
  document.getElementById("outL1").textContent = L1.toFixed(4);
  document.getElementById("outL2").textContent = L2.toFixed(4);
  document.getElementById("outL3").textContent = L3.toFixed(4);
  document.getElementById("outL4").textContent = L4.toFixed(4);
  document.getElementById("outL5").textContent = L5.toFixed(4);
  document.getElementById("outMsd").textContent = msd.toFixed(4);
  document.getElementById("outThetaEff").textContent = turnAngle + "°";

  // Show results and diagram
  document.getElementById("resultsSection").classList.remove("hidden");
  renderSegmentDiagram(L1, L2, L3, L4, L5, r1, r2, turnAngle);
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
  // VR1 is bounded so the r1 arc fits cleanly above the baseline.
  // VR2 uses the same scale factor (same px/NM) so ratio is visually preserved.
  const baseY = PAD_T + 200; // baseline Y in SVG  (= 218)
  const VR1 = Math.min(100, baseY - PAD_T - 10); // r1 visual radius ≤ 100 px
  const VR2 = VR1 * (r2 / r1); // preserves r1/r2 ratio

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

  // ─── Flight-path geometry (schematic radii, exact x positions) ──────────────
  //
  // COORDINATE SYSTEM: SVG (Y increases downward).
  // Baseline (outbound track) = baseY.  Above = smaller Y.
  //
  // Segment definitions (all measured along the outbound horizontal):
  //   L1  inbound straight + roll-in arc projected onto outbound track
  //   L2  roll-out dip arc (on r1) projected onto outbound track
  //   L3  30° straight climb projected onto outbound track
  //   L4  upper roll-out arc (on r2) projected onto outbound track
  //   L5  stabilisation distance
  //
  // The WAYPOINT is at (xWP, baseY).  L2 starts there, L3 starts at x2, L4 at x3,
  // L5 at x4 — matching the dimension-line boundary markers exactly.
  //
  // Arc geometry:
  //   • r1 circle: centre ABOVE waypoint  →  cx1 = xWP,  cy1 = baseY - VR1
  //     TIP (start of roll-in arc) is theta degrees CCW from the bottom of the circle:
  //       tipX = cx1 - VR1·sin(θ),  tipY = cy1 + VR1·cos(θ)  →  WP at bottom
  //     Inbound straight extends back from the TIP tangentially to x0.
  //     After the WP, the r1 arc continues CW (sweep=1 in SVG) by alpha=30°:
  //       dipX = cx1 + VR1·sin(α),  dipY = cy1 + VR1·cos(α)
  //       (this point is to the RIGHT and slightly BELOW the WP — L2 dip)
  //
  //   • 30° climb line: from (dipX, dipY) to (x3, climbEndY), slope -tan(30°)
  //     (in SVG y decreases as aircraft climbs, so negative slope going rightward)
  //
  //   • r2 upper arc: from (x3, climbEndY) levels out to horizontal.
  //     Centre is above-right of the entry point (perpendicular to 30° direction):
  //       cx2 = x3 + VR2·sin(α)   — to the right along outbound track
  //       cy2 = climbEndY - VR2·cos(α)  — above entry
  //     Exit when tangent is horizontal: bottommost point of r2 = (cx2, cy2+VR2)
  //     That exit y = cy2 + VR2 = climbEndY + VR2·(1-cos α) → aircraft levels at baseY-ish
  //     BUT: to make x4 the exact visual boundary we position the exit at x4:
  //       levelY = climbEndY + VR2·(1 - cos(α))   (final level height)
  //       exitX  = cx2                             (horizontally aligned with cx2)

  const cx1 = xWP;
  const cy1 = baseY - VR1;

  // TIP of roll-in arc (theta CCW from bottom of r1 circle):
  const tipX = cx1 - VR1 * Math.sin(theta);
  const tipY = cy1 + VR1 * Math.cos(theta);

  // Inbound tangent at TIP: the tangent of a CW arc at TIP points "rightward-downward"
  // toward the WP. Slope = dx/dy along that tangent. We extend it back to x0.
  // Tangent direction at TIP (CW arc): perpendicular to radius (cx1-tipX, cy1-tipY), rotated CW:
  //   radius = (cx1-tipX, cy1-tipY) = (VR1·sinθ, -VR1·cosθ)  [in SVG units]
  //   CW perp = (ry, -rx) in screen CW = rotated 90° CW = (-cosθ, -sinθ) (normalised)
  //   Opposite direction (coming FROM the left) = (cosθ, sinθ) in SVG
  // so slope going rightward = sinθ / cosθ = tanθ  (y increases as x increases → going DOWN-right)
  // inbound slope in SVG (dy/dx) = tanθ  (positive = going downward to the right)
  // inbSlope = tan(theta); guard against theta≥90° (near-vertical or vertical tangent)
  const inbSlope =
    Math.abs(Math.cos(theta)) < 0.1
      ? Math.sign(Math.sin(theta)) * 10
      : Math.tan(theta);
  const y0 = Math.max(
    PAD_T,
    Math.min(H - PAD_B, tipY - inbSlope * (tipX - x0)),
  );

  // Dip exit: r1 arc continues CW from WP by alpha=30°
  const dipX = cx1 + VR1 * Math.sin(alpha);
  const dipY = cy1 + VR1 * Math.cos(alpha);

  // 30° climb line from dip exit up to x3:
  const climbSlope = -Math.tan(alpha); // dy/dx in SVG (negative = going up)
  const climbEndYraw = dipY + climbSlope * (x3 - dipX);
  // Cap within canvas (path is schematic — if it would exit top, clamp to PAD_T + margin)
  const climbEndY = Math.max(climbEndYraw, PAD_T + 8);
  // If clamped, adjust climbEndX so the final line still ends at the right height
  const climbEndX =
    climbEndY === climbEndYraw ? x3 : dipX + (climbEndY - dipY) / climbSlope;
  // The aircraft enters with heading 30° above horizontal (direction (cos30, -sin30) in SVG)
  // Centre is 90° left-of-heading (port side):
  //   left-of (cosα, -sinα) in SVG = rotate 90° CCW in screen = (-sinα, -cosα)...
  //   but for a CW arc (levelling out), centre must be to the RIGHT of travel direction.
  //   right-of (cosα, -sinα) in SVG = rotate 90° CW = (-sinα, cosα)...
  //   Empirically correct: cx2 = x3 + VR2·sinα, cy2 = climbEndY - VR2·cosα
  const cx2 = climbEndX + VR2 * Math.sin(alpha);
  const cy2 = climbEndY - VR2 * Math.cos(alpha);
  // Arc sweeps CCW (sweep=0 in SVG) from 30°-climb heading to horizontal.
  // Exit = bottom of r2 circle from this centre:
  const levelX = cx2; // exit x (directly below centre)
  const levelY = cy2 + VR2; // exit y = centre + radius downward

  // Final level leg to x5 at levelY
  // ─── SVG paths ───────────────────────────────────────────────────────────────
  const largeArc1 = theta > Math.PI ? 1 : 0;
  const pathInbound = `M ${f(x0)},${f(y0)} L ${f(tipX)},${f(tipY)}`;
  const pathRollIn = `M ${f(tipX)},${f(tipY)} A ${f(VR1)},${f(VR1)} 0 ${largeArc1},1 ${f(xWP)},${f(baseY)}`;
  // After WP, r1 continues CW by alpha (dip to the right):
  const pathDipArc = `M ${f(xWP)},${f(baseY)} A ${f(VR1)},${f(VR1)} 0 0,1 ${f(dipX)},${f(dipY)}`;
  const pathClimb = `M ${f(dipX)},${f(dipY)} L ${f(climbEndX)},${f(climbEndY)}`;
  // Upper r2 arc (CCW = sweep=0) from (climbEndX,climbEndY) to (levelX,levelY):
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
  // θ at waypoint: small arc from horizontal-left to inbound tangent direction
  const thetaR = Math.min(VR1 * 0.26, 40);
  // From WP, the inbound direction arrives going lower-left (slope +tanθ going rightward).
  // Show angle between the inbound track and the horizontal (baseline).
  // Arc from angle π (west) turning CW by theta to show the approach angle:
  const thA1 = Math.PI; // points left (along baseline backward)
  const thA2 = Math.PI + theta; // rotated CW (downward) by theta
  const thSx = xWP + thetaR * Math.cos(thA1);
  const thSy = baseY + thetaR * Math.sin(thA1);
  const thEx = xWP + thetaR * Math.cos(thA2);
  const thEy = baseY + thetaR * Math.sin(thA2);
  const thetaArcSvg = `<path d="M ${f(thSx)},${f(thSy)} A ${thetaR},${thetaR} 0 0,1 ${f(thEx)},${f(thEy)}" fill="none" stroke="${dim}" stroke-width="1.2"/>`;
  const thetaLblX = xWP + (thetaR + 14) * Math.cos(Math.PI + theta / 2);
  const thetaLblY = baseY + (thetaR + 14) * Math.sin(Math.PI + theta / 2);

  // 30° annotation at dip exit (angle between outbound horizontal and 30° climb line)
  const a30R = Math.min(VR1 * 0.18, 28);
  const a30Sx = dipX + a30R; // horizontal direction from dipX,dipY
  const a30Sy = dipY;
  // Climb direction angle in SVG: going right and UP = -alpha from +x axis
  const a30Ex = dipX + a30R * Math.cos(-alpha);
  const a30Ey = dipY + a30R * Math.sin(-alpha);
  const ang30Svg = `<path d="M ${f(a30Sx)},${f(a30Sy)} A ${a30R},${a30R} 0 0,0 ${f(a30Ex)},${f(a30Ey)}" fill="none" stroke="${dim}" stroke-width="1.2"/>`;

  // 60° annotation at the same point (complement annotation, shown in PANS-OPS fig)
  const ang60X = dipX - 4;
  const ang60Y = dipY - a30R - 6;

  // 30° annotation near the upper roll-out arc
  const upper30X = climbEndX + 10;
  const upper30Y = climbEndY - 8;

  // r1 dashed radius from centre to mid-arc
  const r1midA = Math.PI / 2 + theta / 2; // midway through roll-in arc
  const r1midX = cx1 + VR1 * Math.cos(r1midA);
  const r1midY = cy1 + VR1 * Math.sin(r1midA);

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
  ${dropLine(x0, Math.min(y0, baseY) - 2)}
  ${dropLine(x1, baseY + 2)}
  ${dropLine(x2, dipY + 2)}
  ${dropLine(x3, Math.min(climbEndY, levelY) - 2)}
  ${dropLine(x4, levelY - 2)}
  ${dropLine(x5, levelY - 2)}

  <!-- r1 dashed radius line -->
  ${dashLine(cx1, cy1, r1midX, r1midY, dim)}
  ${txt(cx1 - VR1 * 0.28 - 14, cy1 + VR1 * 0.5 + 4, "r1", dim, 11, "middle", true)}

  <!-- r2 dashed radius line -->
  ${dashLine(cx2, cy2, r2midX, r2midY, dim)}
  ${txt(cx2 + VR2 * 0.15 + 18, cy2 + VR2 * 0.25, "r2", dim, 11, "middle", true)}

  <!-- ── FLIGHT PATH ─────────────────────────────────────── -->
  <path d="${pathInbound}"  fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="${pathRollIn}"   fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="${pathDipArc}"   fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round"/>
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

  <!-- 60° label at dip exit -->
  ${txt(ang60X, ang60Y, "60°", dim, 10)}

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
  const msdVal = document.getElementById("outMsd").textContent;
  if (!msdVal) return;

  const tableData = {
    IAS: document.getElementById("ias").value + " KT",
    "Altitude h1":
      document.getElementById("altitude").value +
      " " +
      document.getElementById("altitudeUnit").value,
    "k Factor": document.getElementById("outKFactor").textContent,
    "Bank Angle r1": document.getElementById("bankAngle").value + "°",
    "Turn Angle (input)": document.getElementById("turnAngle").value + "°",
    "": "",
    TAS: document.getElementById("outTas").textContent + " KT",
    "Turn Angle Used": document.getElementById("outThetaEff").textContent,
    "r1 (roll-in)": document.getElementById("outR1").textContent + " NM",
    "r2 (roll-out, 15° fixed)":
      document.getElementById("outR2").textContent + " NM",
    " ": "",
    L1: document.getElementById("outL1").textContent + " NM",
    L2: document.getElementById("outL2").textContent + " NM",
    L3: document.getElementById("outL3").textContent + " NM",
    L4: document.getElementById("outL4").textContent + " NM",
    "L5 (bank establishment)":
      document.getElementById("outL5").textContent + " NM",
    "  ": "",
    "MSD Total": msdVal + " NM",
  };

  const htmlContent = createHTMLTable(
    tableData,
    "Flyover MSD — PANS-OPS Vol II §1.4.1",
  );
  copyToClipboard(htmlContent);
}
