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
    .getElementById("noTurnAtFaf")
    .addEventListener("change", function () {
      const turnInput = document.getElementById("turnAngle");
      const hintEl = document.getElementById("turnAngleHint");
      if (this.checked) {
        turnInput.disabled = true;
        turnInput.classList.add("opacity-40", "cursor-not-allowed");
        if (hintEl) hintEl.classList.add("opacity-40");
      } else {
        turnInput.disabled = false;
        turnInput.classList.remove("opacity-40", "cursor-not-allowed");
        if (hintEl) hintEl.classList.remove("opacity-40");
      }
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
  const isaDevVal = parseFloat(document.getElementById("isaDeviation").value);
  const bankAngleVal = parseInt(document.getElementById("bankAngle").value, 10); // 15, 20, or 25
  const noTurnAtFaf = document.getElementById("noTurnAtFaf").checked;
  const catH = document.getElementById("catH").checked;
  const turnAngleRaw = parseFloat(document.getElementById("turnAngle").value);

  // --- Validate ---
  if (isNaN(iasVal) || iasVal <= 0) {
    showToast("Please enter a valid IAS (> 0).", "error");
    return;
  }
  if (isNaN(altitudeRaw) || altitudeRaw < 0) {
    showToast("Please enter a valid altitude (≥ 0).", "error");
    return;
  }
  if (isNaN(isaDevVal)) {
    showToast("Please enter a valid ISA deviation.", "error");
    return;
  }
  if (!noTurnAtFaf && (isNaN(turnAngleRaw) || turnAngleRaw <= 0)) {
    showToast(
      "Please enter a valid turn angle, or check 'No turn at FAF'.",
      "error",
    );
    return;
  }

  // --- Convert altitude to feet ---
  const altitude_ft =
    altitudeUnit === "ft" ? altitudeRaw : altitudeRaw / 0.3048;

  // --- TAS ---
  const kFactor = calculateKFactor(altitude_ft, isaDevVal);
  const tas = calculateTAS(iasVal, kFactor);

  // --- Radii ---
  const r1 = calculateRadius(tas, bankAngleVal); // roll-in (user bank)
  const r2 = calculateRadius(tas, 15); // roll-out (fixed 15°)

  // --- Turn angle effective ---
  const ALPHA_DEG = 30;
  let thetaEff;
  let thetaAdjusted = false;

  if (noTurnAtFaf) {
    thetaEff = 0;
  } else {
    if (turnAngleRaw < 50) {
      thetaEff = 50;
      thetaAdjusted = true;
    } else {
      thetaEff = turnAngleRaw;
    }
  }

  // --- Segment lengths ---
  const theta_rad = thetaEff * (Math.PI / 180);
  const alpha_rad = ALPHA_DEG * (Math.PI / 180);
  const comp90_rad = (90 - ALPHA_DEG) * (Math.PI / 180); // sin(60°)

  let L1, L2, L3;
  if (thetaEff === 0) {
    // No turn at FAF — protection is only L4 + L5
    L1 = 0;
    L2 = 0;
    L3 = 0;
  } else {
    L1 = r1 * Math.sin(theta_rad);
    L2 = r1 * Math.cos(theta_rad) * Math.tan(alpha_rad);
    L3 =
      r1 *
      (1 / Math.sin(alpha_rad) -
        (2 * Math.cos(theta_rad)) / Math.sin(comp90_rad));
  }
  const L4 = r2 * Math.tan(alpha_rad / 2);
  // c = 10s for Cat A–E; c = 5s for Cat H (PANS-OPS §1.4.1.2)
  const c = catH ? 5 : 10;
  const L5 = (c * tas) / 3600;

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

  // Turn angle used display
  const thetaEffEl = document.getElementById("outThetaEff");
  if (noTurnAtFaf) {
    thetaEffEl.textContent = "0° (no turn)";
  } else if (thetaAdjusted) {
    thetaEffEl.textContent = "50° (min)";
  } else {
    thetaEffEl.textContent = thetaEff + "°";
  }

  // Warning card
  const warnCard = document.getElementById("turnAngleWarningCard");
  if (!noTurnAtFaf && thetaAdjusted) {
    warnCard.classList.remove("hidden");
  } else {
    warnCard.classList.add("hidden");
  }

  // Show results and diagram
  document.getElementById("resultsSection").classList.remove("hidden");
  renderSegmentDiagram(L1, L2, L3, L4, L5);
}

// ─── SVG Diagram ──────────────────────────────────────────────────────────────

function renderSegmentDiagram(L1, L2, L3, L4, L5) {
  const msd = L1 + L2 + L3 + L4 + L5;
  const container = document.getElementById("segmentDiagram");
  const diagramSection = document.getElementById("diagramSection");

  if (msd <= 0) {
    diagramSection.classList.add("hidden");
    return;
  }

  const SVG_W = 560;
  const PAD = 10;
  const BAR_Y = 44;
  const BAR_H = 32;
  const LABEL_Y = 36; // label above bar
  const VALUE_Y = BAR_Y + BAR_H + 14; // NM values below bar

  const usableW = SVG_W - PAD * 2;
  const scale = usableW / msd;

  const segments = [
    { id: "L1", value: L1, fill: "#2563eb", textFill: "#1e40af" },
    { id: "L2", value: L2, fill: "#6366f1", textFill: "#4338ca" },
    { id: "L3", value: L3, fill: "#9ca3af", textFill: "#6b7280" },
    { id: "L4", value: L4, fill: "#f59e0b", textFill: "#b45309" },
    { id: "L5", value: L5, fill: "#22c55e", textFill: "#15803d" },
  ];

  let rects = "";
  let labels = "";
  let values = "";
  let x = PAD;

  segments.forEach((seg) => {
    const w = Math.max(seg.value * scale, 0);
    if (w < 1) {
      x += w;
      return;
    }
    const cx = x + w / 2;
    // gap between segments: 1px visual separator
    rects += `<rect x="${x.toFixed(2)}" y="${BAR_Y}" width="${Math.max(w - 1, 1).toFixed(2)}" height="${BAR_H}" fill="${seg.fill}" rx="3"/>`;
    // show label only if segment is wide enough
    if (w >= 20) {
      labels += `<text x="${cx.toFixed(2)}" y="${LABEL_Y}" text-anchor="middle" font-size="11" font-weight="700" fill="${seg.fill}" font-family="monospace">${seg.id}</text>`;
      values += `<text x="${cx.toFixed(2)}" y="${VALUE_Y}" text-anchor="middle" font-size="10" fill="${seg.textFill}" font-family="monospace">${seg.value.toFixed(3)}</text>`;
    }
    x += w;
  });

  // Total MSD label at end
  const totalLabel = `<text x="${(SVG_W - PAD).toFixed(2)}" y="${BAR_Y + BAR_H / 2 + 5}" text-anchor="end" font-size="10" fill="#374151" font-family="monospace" font-weight="600">= ${msd.toFixed(4)} NM</text>`;

  // Legend below diagram
  const legendItems = segments.map((seg, i) => {
    const lx = PAD + i * 110;
    const ly = BAR_Y + BAR_H + 30;
    return (
      `<rect x="${lx}" y="${ly}" width="12" height="12" fill="${seg.fill}" rx="2"/>` +
      `<text x="${lx + 16}" y="${ly + 10}" font-size="10" fill="#6b7280" font-family="sans-serif">${seg.id}: ${seg.value.toFixed(3)} NM</text>`
    );
  });

  const SVG_H = BAR_Y + BAR_H + 52;

  const isDark = document.documentElement.classList.contains("dark");
  const bgFill = isDark ? "#1f2937" : "#ffffff";
  const separatorColor = isDark ? "#374151" : "#e5e7eb";

  container.innerHTML = `<svg viewBox="0 0 ${SVG_W} ${SVG_H}" class="w-full" role="img" aria-label="MSD segment breakdown diagram" style="background:${bgFill};border-radius:6px">
  <line x1="${PAD}" y1="${BAR_Y + BAR_H + 2}" x2="${SVG_W - PAD}" y2="${BAR_Y + BAR_H + 2}" stroke="${separatorColor}" stroke-width="1"/>
  ${rects}
  ${labels}
  ${values}
  ${legendItems.join("\n")}
</svg>`;

  diagramSection.classList.remove("hidden");
}

// ─── Save / Load parameters ───────────────────────────────────────────────────

function saveParameters() {
  const data = {
    ias: document.getElementById("ias").value || "",
    altitude: document.getElementById("altitude").value || "",
    altitudeUnit: document.getElementById("altitudeUnit").value || "ft",
    isaDeviation: document.getElementById("isaDeviation").value || "",
    bankAngle: document.getElementById("bankAngle").value || "",
    turnAngle: document.getElementById("turnAngle").value || "",
    noTurnAtFaf: document.getElementById("noTurnAtFaf").checked,
    catH: document.getElementById("catH").checked,
  };

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_flyover_msd.json`;
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

      if (data.ias !== undefined)
        document.getElementById("ias").value = data.ias;
      if (data.altitude !== undefined)
        document.getElementById("altitude").value = data.altitude;
      if (data.altitudeUnit) {
        const sel = document.getElementById("altitudeUnit");
        sel.dataset.lastUnit = sel.value;
        sel.value = data.altitudeUnit;
      }
      if (data.isaDeviation !== undefined)
        document.getElementById("isaDeviation").value = data.isaDeviation;
      if (data.bankAngle !== undefined)
        document.getElementById("bankAngle").value = data.bankAngle;
      if (data.noTurnAtFaf !== undefined) {
        const chk = document.getElementById("noTurnAtFaf");
        chk.checked = data.noTurnAtFaf;
        chk.dispatchEvent(new Event("change"));
      }
      if (data.catH !== undefined) {
        document.getElementById("catH").checked = data.catH;
      }
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
    "ISA Deviation": document.getElementById("isaDeviation").value + " °C",
    "k Factor": document.getElementById("outKFactor").textContent,
    "Bank Angle r1": document.getElementById("bankAngle").value + "° (per PANS-OPS §1.4.1.3)",
    "Turn Angle (input)": document.getElementById("noTurnAtFaf").checked
      ? "No turn at FAF"
      : document.getElementById("turnAngle").value + "°",
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
