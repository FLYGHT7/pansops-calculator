// Fallback stubs — replaced at runtime by aviation-utils.js if loaded first
if (typeof calculateKFactor === "undefined") {
  var calculateKFactor = function (altitude_ft, isaDeviation) {
    return (
      (171233 * Math.sqrt(288 + isaDeviation - 0.00198 * altitude_ft)) /
      Math.pow(288 - 0.00198 * altitude_ft, 2.628)
    );
  };
}
if (typeof calculateTAS === "undefined") {
  var calculateTAS = function (ias, kFactor) {
    return ias * kFactor;
  };
}
if (typeof calculateRadius === "undefined") {
  var calculateRadius = function (tas, bankAngle_deg) {
    var DEG_TO_RAD = Math.PI / 180;
    return (tas * tas) / (68625 * Math.tan(bankAngle_deg * DEG_TO_RAD));
  };
}
if (typeof calculateRateOfTurn === "undefined") {
  var calculateRateOfTurn = function (tas, radius_nm) {
    return tas / (111.95 * radius_nm);
  };
}
if (typeof calculateRadiusWithRateOfTurnCap === "undefined") {
  var calculateRadiusWithRateOfTurnCap = function (tas, bankAngle_deg) {
    var DEG_TO_RAD = Math.PI / 180;
    var radius = (tas * tas) / (68625 * Math.tan(bankAngle_deg * DEG_TO_RAD));
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
  };
}

// Module-level stored results for copy-to-word
var _raw1 = null;
var _raw2 = null;

// Update all displayed result values based on the selected precision mode
function applyDisplayPrecision() {
  if (!_raw1 || !_raw2) return;
  var exact = document.getElementById("copyPrecision").value === "exact";
  var fmt = function (v) {
    return exact ? v.toString() : v.toFixed(4);
  };
  var FT_PER_NM = 1852 / 0.3048;
  var DEG_TO_RAD = Math.PI / 180;

  // WP1
  document.getElementById("out1KFactor").textContent = fmt(_raw1.kFactor);
  document.getElementById("out1Tas").textContent = fmt(_raw1.tas);
  if (_raw1.type === "flyby") {
    document.getElementById("out1Radius").textContent = fmt(_raw1.r);
    document.getElementById("out1L1").textContent = fmt(_raw1.L1);
    document.getElementById("out1L2").textContent = fmt(_raw1.L2);
  } else {
    document.getElementById("out1Radius").textContent = fmt(_raw1.r1);
    document.getElementById("out1L1").textContent = fmt(_raw1.arcPlusTrans);
    document.getElementById("out1L2").textContent = fmt(_raw1.bankEstab);
  }
  document.getElementById("out1M").textContent = fmt(_raw1.M);

  // WP2
  document.getElementById("out2KFactor").textContent = fmt(_raw2.kFactor);
  document.getElementById("out2Tas").textContent = fmt(_raw2.tas);
  if (_raw2.type === "flyby") {
    document.getElementById("out2Radius").textContent = fmt(_raw2.r);
    document.getElementById("out2L1").textContent = fmt(_raw2.L1);
    document.getElementById("out2L2").textContent = fmt(_raw2.L2);
  } else {
    document.getElementById("out2Radius").textContent = fmt(_raw2.r1);
    document.getElementById("out2L1").textContent = fmt(_raw2.arcPlusTrans);
    document.getElementById("out2L2").textContent = fmt(_raw2.bankEstab);
  }
  document.getElementById("out2M").textContent = fmt(_raw2.M);

  // MSD total
  var msd = _raw1.M + _raw2.M;
  document.getElementById("outMSD").textContent = fmt(msd);
  document.getElementById("outDValue").textContent = fmt(_distanceD);

  // TRD (only if visible)
  if (_raw1.type === "flyby" && _raw2.type === "flyby") {
    var halfA_rad = (_raw1.effectiveTurn / 2) * DEG_TO_RAD;
    var halfB_rad = (_raw2.effectiveTurn / 2) * DEG_TO_RAD;
    var r1Arc = _raw1.r * halfA_rad;
    var r2Arc = _raw2.r * halfB_rad;
    var trd = _distanceD - _raw1.L1 - _raw2.L1 + r1Arc + r2Arc;
    document.getElementById("outR1Arc").textContent = fmt(r1Arc);
    document.getElementById("outR2Arc").textContent = fmt(r2Arc);
    document.getElementById("outTRD").textContent = fmt(trd);
    if (trd > 0 && _alt1_ft !== null && _alt2_ft !== null) {
      var gradient = ((_alt1_ft - _alt2_ft) / (trd * FT_PER_NM)) * 100;
      document.getElementById("outGradient").textContent = fmt(gradient);
    }
  }
}
// Store validated altitude values in ft for gradient calculation
var _alt1_ft = null;
var _alt2_ft = null;
var _distanceD = null;

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  checkDarkMode();
  initializeUnitSelectors();
  setupEventListeners();
  updateCaseDiagram();

  if (window.I18N) {
    I18N.init({
      defaultLang: "en",
      supported: ["en", "es"],
      path: "i18n",
    }).catch(console.error);
  }
});

// ── Event listeners ───────────────────────────────────────────────────────────

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
    .addEventListener("click", calculateMSD);
  document.getElementById("btnCopy").addEventListener("click", copyToWord);
  document
    .getElementById("copyPrecision")
    .addEventListener("change", applyDisplayPrecision);

  document
    .getElementById("wp1AltitudeUnit")
    .addEventListener("change", function () {
      handleUnitChange("wp1Altitude", "wp1AltitudeUnit");
    });
  document
    .getElementById("wp2AltitudeUnit")
    .addEventListener("change", function () {
      handleUnitChange("wp2Altitude", "wp2AltitudeUnit");
    });

  // Show/hide turn-angle warning badges in real time
  ["wp1", "wp2"].forEach(function (prefix) {
    document
      .getElementById(prefix + "TurnAngle")
      .addEventListener("input", function () {
        var val = parseFloat(this.value);
        var type = document.getElementById(prefix + "Type").value;
        var warning = document.getElementById(prefix + "TurnWarning");
        if (type === "flyby" && !isNaN(val) && val < 50) {
          warning.classList.remove("hidden");
        } else {
          warning.classList.add("hidden");
        }
      });
    document
      .getElementById(prefix + "Type")
      .addEventListener("change", function () {
        // Re-check warning when type changes
        var angleEl = document.getElementById(prefix + "TurnAngle");
        angleEl.dispatchEvent(new Event("input"));
        updateCaseDiagram();
      });
  });
}

// ── Case diagram ──────────────────────────────────────────────────────────────

function updateCaseDiagram() {
  var wp1Type = document.getElementById("wp1Type").value;
  var wp2Type = document.getElementById("wp2Type").value;
  var cases = {
    "flyby-flyby":     { src: "img/two fly-by waypoints.png",          fig: "Fig. III-2-1-2", label: "Two Flyby Waypoints" },
    "flyby-flyover":   { src: "img/fly-by,then flyover waypoint.png",  fig: "Fig. III-2-1-3", label: "Flyby then Flyover" },
    "flyover-flyover": { src: "img/two flyover waypoints.png",          fig: "Fig. III-2-1-4", label: "Two Flyover Waypoints" },
    "flyover-flyby":   { src: "img/flyover, then fly-by waypoint.png",  fig: "Fig. III-2-1-5", label: "Flyover then Flyby" },
  };
  var match = cases[wp1Type + "-" + wp2Type];
  if (!match) return;
  var img = document.getElementById("caseDiagramImg");
  img.src = match.src;
  img.alt = match.label;
  document.getElementById("caseFigBadge").textContent = match.fig;
  document.getElementById("caseDiagramCaption").textContent = match.label;
}

// ── Unit handling ─────────────────────────────────────────────────────────────

function initializeUnitSelectors() {
  var unitSelectors = document.querySelectorAll('select[id$="AltitudeUnit"]');
  unitSelectors.forEach(function (sel) {
    sel.dataset.lastUnit = sel.value;
  });
}

function handleUnitChange(inputId, unitSelectId) {
  var input = document.getElementById(inputId);
  var unitSelect = document.getElementById(unitSelectId);
  var currentValue = parseFloat(input.value);
  if (!isNaN(currentValue)) {
    var oldUnit = unitSelect.dataset.lastUnit || unitSelect.value;
    var newUnit = unitSelect.value;
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

// ── Aviation formulas ─────────────────────────────────────────────────────────

function computeFlyby(ias, altitude_ft, bankAngle, turnAngle, isaDeviation) {
  var DEG_TO_RAD = Math.PI / 180;
  var kFactor = calculateKFactor(altitude_ft, isaDeviation);
  var tas = calculateTAS(ias, kFactor);
  var rObj = calculateRadiusWithRateOfTurnCap(tas, bankAngle);
  var r = rObj.radiusForCalc;
  var effectiveTurn = Math.max(turnAngle, 50);
  var minApplied = effectiveTurn !== turnAngle;
  var L1 = r * Math.tan((effectiveTurn / 2) * DEG_TO_RAD);
  var L2 = (5 * tas) / 3600;
  var M = L1 + L2;
  return {
    type: "flyby",
    kFactor: kFactor,
    tas: tas,
    r: r,
    L1: L1,
    L2: L2,
    M: M,
    effectiveTurn: effectiveTurn,
    minApplied: minApplied,
  };
}

function computeFlyover(ias, altitude_ft, bankAngle, turnAngle, isaDeviation) {
  var DEG_TO_RAD = Math.PI / 180;
  var kFactor = calculateKFactor(altitude_ft, isaDeviation);
  var tas = calculateTAS(ias, kFactor);
  var r1Obj = calculateRadiusWithRateOfTurnCap(tas, bankAngle);
  var r1 = r1Obj.radiusForCalc;
  var r2Obj = calculateRadiusWithRateOfTurnCap(tas, 15); // fixed 15° roll-out bank per §1.4.1.3
  var r2 = r2Obj.radiusForCalc;
  var theta_rad = turnAngle * DEG_TO_RAD;
  var alpha_rad = 30 * DEG_TO_RAD;
  var L1fo = r1 * Math.sin(theta_rad);
  var L2fo = r1 * Math.cos(theta_rad) * Math.tan(alpha_rad);
  var L3fo =
    r1 *
    (1 / Math.sin(alpha_rad) -
      (2 * Math.cos(theta_rad)) / Math.sin(60 * DEG_TO_RAD));
  var L4fo = r2 * Math.tan(alpha_rad / 2);
  var L5fo = (10 * tas) / 3600;
  var arcPlusTrans = L1fo + L2fo + L3fo + L4fo; // "L1 display"
  var bankEstab = L5fo; // "L2 display"
  var M = arcPlusTrans + bankEstab;
  return {
    type: "flyover",
    kFactor: kFactor,
    tas: tas,
    r1: r1,
    r2: r2,
    arcPlusTrans: arcPlusTrans,
    bankEstab: bankEstab,
    M: M,
  };
}

// ── Main calculation ──────────────────────────────────────────────────────────

function calculateMSD() {
  // Read shared inputs
  var distanceD = parseFloat(document.getElementById("distance").value);
  var isaRaw = document.getElementById("isaDeviation").value.trim();

  // Read WP names (optional — fall back to defaults)
  var wp1Name = document.getElementById("wp1Name").value.trim() || "WP 1";
  var wp2Name = document.getElementById("wp2Name").value.trim() || "WP 2";

  // Read WP1 inputs
  var wp1Type = document.getElementById("wp1Type").value;
  var wp1Ias = parseFloat(document.getElementById("wp1Ias").value);
  var wp1AltRaw = parseFloat(document.getElementById("wp1Altitude").value);
  var wp1AltUnit = document.getElementById("wp1AltitudeUnit").value;
  var wp1Bank = parseFloat(document.getElementById("wp1BankAngle").value);
  var wp1Turn = parseFloat(document.getElementById("wp1TurnAngle").value);

  // Read WP2 inputs
  var wp2Type = document.getElementById("wp2Type").value;
  var wp2Ias = parseFloat(document.getElementById("wp2Ias").value);
  var wp2AltRaw = parseFloat(document.getElementById("wp2Altitude").value);
  var wp2AltUnit = document.getElementById("wp2AltitudeUnit").value;
  var wp2Bank = parseFloat(document.getElementById("wp2BankAngle").value);
  var wp2Turn = parseFloat(document.getElementById("wp2TurnAngle").value);

  // Validate
  if (isNaN(distanceD) || distanceD <= 0) {
    showToast("Please enter a valid IAF–IF distance (D > 0).", "error");
    return;
  }
  if (isaRaw === "") {
    showToast("ISA Deviation is required.", "error");
    return;
  }
  var isaDeviation = parseFloat(isaRaw);
  if (isNaN(isaDeviation)) {
    showToast("Please enter a valid ISA Deviation.", "error");
    return;
  }
  if (isNaN(wp1Ias) || wp1Ias <= 0) {
    showToast("WP1: Please enter a valid IAS.", "error");
    return;
  }
  if (isNaN(wp1AltRaw) || wp1AltRaw < 0) {
    showToast("WP1: Please enter a valid altitude.", "error");
    return;
  }
  if (isNaN(wp1Bank) || wp1Bank <= 0 || wp1Bank >= 90) {
    showToast("WP1: Bank angle must be between 1° and 89°.", "error");
    return;
  }
  if (isNaN(wp1Turn) || wp1Turn <= 0 || wp1Turn >= 360) {
    showToast("WP1: Turn angle must be between 1° and 359°.", "error");
    return;
  }
  if (isNaN(wp2Ias) || wp2Ias <= 0) {
    showToast("WP2: Please enter a valid IAS.", "error");
    return;
  }
  if (isNaN(wp2AltRaw) || wp2AltRaw < 0) {
    showToast("WP2: Please enter a valid altitude.", "error");
    return;
  }
  if (isNaN(wp2Bank) || wp2Bank <= 0 || wp2Bank >= 90) {
    showToast("WP2: Bank angle must be between 1° and 89°.", "error");
    return;
  }
  if (isNaN(wp2Turn) || wp2Turn <= 0 || wp2Turn >= 360) {
    showToast("WP2: Turn angle must be between 1° and 359°.", "error");
    return;
  }

  // Convert altitudes to ft
  var wp1Alt_ft = wp1AltUnit === "m" ? wp1AltRaw / 0.3048 : wp1AltRaw;
  var wp2Alt_ft = wp2AltUnit === "m" ? wp2AltRaw / 0.3048 : wp2AltRaw;

  // Compute per WP
  var res1 =
    wp1Type === "flyby"
      ? computeFlyby(wp1Ias, wp1Alt_ft, wp1Bank, wp1Turn, isaDeviation)
      : computeFlyover(wp1Ias, wp1Alt_ft, wp1Bank, wp1Turn, isaDeviation);

  var res2 =
    wp2Type === "flyby"
      ? computeFlyby(wp2Ias, wp2Alt_ft, wp2Bank, wp2Turn, isaDeviation)
      : computeFlyover(wp2Ias, wp2Alt_ft, wp2Bank, wp2Turn, isaDeviation);

  // Store
  _raw1 = res1;
  _raw2 = res2;
  _alt1_ft = wp1Alt_ft;
  _alt2_ft = wp2Alt_ft;
  _distanceD = distanceD;

  // Render WP results
  renderWPResults(1, res1, wp1Name);
  renderWPResults(2, res2, wp2Name);

  // TRD section (flyby + flyby only)
  var trdSection = document.getElementById("trdSection");
  if (res1.type === "flyby" && res2.type === "flyby") {
    var DEG_TO_RAD = Math.PI / 180;
    var FT_PER_NM = 1852 / 0.3048;
    var halfA_rad = (res1.effectiveTurn / 2) * DEG_TO_RAD;
    var halfB_rad = (res2.effectiveTurn / 2) * DEG_TO_RAD;
    var r1Arc = res1.r * halfA_rad;
    var r2Arc = res2.r * halfB_rad;
    var trd = distanceD - res1.L1 - res2.L1 + r1Arc + r2Arc;

    document.getElementById("outR1Arc").textContent = r1Arc.toFixed(4);
    document.getElementById("outR2Arc").textContent = r2Arc.toFixed(4);
    document.getElementById("outTRD").textContent = trd.toFixed(4);

    var trdStatus = document.getElementById("outTRDStatus");
    if (trd > 0) {
      trdStatus.textContent = "OK";
      trdStatus.className =
        "text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
    } else {
      trdStatus.textContent = "Negative";
      trdStatus.className =
        "text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
    }

    var gradient = null;
    var gradientStatus = document.getElementById("outGradientStatus");
    if (trd > 0) {
      gradient = ((wp1Alt_ft - wp2Alt_ft) / (trd * FT_PER_NM)) * 100;
      document.getElementById("outGradient").textContent = gradient.toFixed(2);
      var maxGradient = 8.0;
      if (gradient <= maxGradient) {
        gradientStatus.textContent = "\u2264 8% OK";
        gradientStatus.className =
          "text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      } else {
        gradientStatus.textContent = "> 8% STEEP";
        gradientStatus.className =
          "text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
      }
    } else {
      document.getElementById("outGradient").textContent = "N/A";
      gradientStatus.textContent = "";
      gradientStatus.className = "";
    }

    trdSection.classList.remove("hidden");
  } else {
    trdSection.classList.add("hidden");
  }

  // MSD total
  var msd = res1.M + res2.M;
  var msdCard = document.getElementById("msdPrimaryCard");
  document.getElementById("outMSD").textContent = msd.toFixed(4);
  document.getElementById("outDValue").textContent = distanceD.toFixed(4);

  var msdStatus = document.getElementById("outMSDStatus");
  if (distanceD >= msd) {
    msdStatus.textContent = "\u2265 MSD \u2714 PASS";
    msdStatus.className = "font-bold";
    msdCard.className =
      "bg-green-600 dark:bg-green-700 rounded-xl p-5 text-white text-center shadow-md";
  } else {
    msdStatus.textContent = "< MSD \u2718 FAIL";
    msdStatus.className = "font-bold";
    msdCard.className =
      "bg-red-600 dark:bg-red-700 rounded-xl p-5 text-white text-center shadow-md";
  }

  // Apply current precision mode to all outputs
  applyDisplayPrecision();

  // Show results
  document.getElementById("resultsSection").classList.remove("hidden");
  document
    .getElementById("resultsSection")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Render WP output ──────────────────────────────────────────────────────────

function renderWPResults(n, result, name) {
  var prefix = "out" + n;
  // Labels and structural changes only — numeric values are set by applyDisplayPrecision()
  var suffix = n === 1 ? "IAF" : "IF";
  document.getElementById(prefix + "WPHeader").textContent = name + " — " + suffix;
  var typeBadge = document.getElementById(prefix + "TypeBadge");
  var radiusLabel = document.getElementById(prefix + "RadiusLabel");
  var l1Label = document.getElementById(prefix + "L1Label");
  var l2Label = document.getElementById(prefix + "L2Label");

  if (result.type === "flyby") {
    typeBadge.textContent = "Flyby";
    radiusLabel.textContent = "Radius r";
    l1Label.textContent = "r\u00B7tan(A/2)";
    l2Label.textContent = "5s\u00B7TAS/3600";
  } else {
    typeBadge.textContent = "Flyover";
    radiusLabel.textContent = "r\u2081 (roll-in)";
    l1Label.textContent = "Arc+transition (L1\u2013L4)";
    l2Label.textContent = "L5 (bank estab.)";
  }

  document.getElementById(prefix + "L1Cell").classList.remove("hidden");
  document.getElementById(prefix + "L2Cell").classList.remove("hidden");
  document.getElementById(prefix + "L2Cell").classList.remove("col-span-2");
  document.getElementById(prefix + "L2Cell").classList.add("col-span-2");
}

// ── Save / Load ───────────────────────────────────────────────────────────────

function saveParameters() {
  var params = {
    distance: document.getElementById("distance").value,
    isaDeviation: document.getElementById("isaDeviation").value,
    wp1Name: document.getElementById("wp1Name").value,
    wp2Name: document.getElementById("wp2Name").value,
    wp1Type: document.getElementById("wp1Type").value,
    wp1Ias: document.getElementById("wp1Ias").value,
    wp1Altitude: document.getElementById("wp1Altitude").value,
    wp1AltitudeUnit: document.getElementById("wp1AltitudeUnit").value,
    wp1BankAngle: document.getElementById("wp1BankAngle").value,
    wp1TurnAngle: document.getElementById("wp1TurnAngle").value,
    wp2Type: document.getElementById("wp2Type").value,
    wp2Ias: document.getElementById("wp2Ias").value,
    wp2Altitude: document.getElementById("wp2Altitude").value,
    wp2AltitudeUnit: document.getElementById("wp2AltitudeUnit").value,
    wp2BankAngle: document.getElementById("wp2BankAngle").value,
    wp2TurnAngle: document.getElementById("wp2TurnAngle").value,
  };

  var blob = new Blob([JSON.stringify(params, null, 2)], {
    type: "application/json",
  });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "msd_parameters.json";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Parameters saved.", "success");
}

function loadParameters(event) {
  var file = event.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var params = JSON.parse(e.target.result);

      var setVal = function (id, val) {
        var el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
      };

      setVal("distance", params.distance);
      setVal("isaDeviation", params.isaDeviation);
      setVal("wp1Name", params.wp1Name);
      setVal("wp2Name", params.wp2Name);
      setVal("wp1Type", params.wp1Type);
      setVal("wp1Ias", params.wp1Ias);
      setVal("wp1Altitude", params.wp1Altitude);
      setVal("wp1AltitudeUnit", params.wp1AltitudeUnit);
      setVal("wp1BankAngle", params.wp1BankAngle);
      setVal("wp1TurnAngle", params.wp1TurnAngle);
      setVal("wp2Type", params.wp2Type);
      setVal("wp2Ias", params.wp2Ias);
      setVal("wp2Altitude", params.wp2Altitude);
      setVal("wp2AltitudeUnit", params.wp2AltitudeUnit);
      setVal("wp2BankAngle", params.wp2BankAngle);
      setVal("wp2TurnAngle", params.wp2TurnAngle);

      // Sync lastUnit for unit selectors
      ["wp1AltitudeUnit", "wp2AltitudeUnit"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.dataset.lastUnit = el.value;
      });

      showToast("Parameters loaded.", "success");
    } catch (err) {
      showToast("Failed to load parameters: " + err.message, "error");
    }
  };
  reader.readAsText(file);
  // Reset input so the same file can be loaded again
  event.target.value = "";
}

// ── Copy to Word ──────────────────────────────────────────────────────────────

function copyToWord() {
  if (!_raw1 || !_raw2) {
    showToast("Please calculate first.", "error");
    return;
  }

  var exact = document.getElementById("copyPrecision").value === "exact";
  var fmt = function (v) {
    return exact ? v.toString() : v.toFixed(4);
  };
  var FT_PER_NM = 1852 / 0.3048;
  var wp1Name = document.getElementById("wp1Name").value.trim() || "WP 1";
  var wp2Name = document.getElementById("wp2Name").value.trim() || "WP 2";

  // Build WP1 rows
  var wp1Rows = {
    "WP1 Type": _raw1.type.charAt(0).toUpperCase() + _raw1.type.slice(1),
    "WP1 k Factor": fmt(_raw1.kFactor),
    "WP1 TAS (KT)": fmt(_raw1.tas),
  };
  if (_raw1.type === "flyby") {
    wp1Rows["WP1 Radius r (NM)"] = fmt(_raw1.r);
    wp1Rows["WP1 r\u00B7tan(A/2) (NM)"] = fmt(_raw1.L1);
    wp1Rows["WP1 5s\u00B7TAS/3600 (NM)"] = fmt(_raw1.L2);
  } else {
    wp1Rows["WP1 r\u2081 roll-in (NM)"] = fmt(_raw1.r1);
    wp1Rows["WP1 Arc+transition L1\u2013L4 (NM)"] = fmt(_raw1.arcPlusTrans);
    wp1Rows["WP1 L5 bank estab. (NM)"] = fmt(_raw1.bankEstab);
  }
  wp1Rows["M\u2081 (NM)"] = fmt(_raw1.M);

  // Build WP2 rows
  var wp2Rows = {
    "WP2 Type": _raw2.type.charAt(0).toUpperCase() + _raw2.type.slice(1),
    "WP2 k Factor": fmt(_raw2.kFactor),
    "WP2 TAS (KT)": fmt(_raw2.tas),
  };
  if (_raw2.type === "flyby") {
    wp2Rows["WP2 Radius r (NM)"] = fmt(_raw2.r);
    wp2Rows["WP2 r\u00B7tan(B/2) (NM)"] = fmt(_raw2.L1);
    wp2Rows["WP2 5s\u00B7TAS/3600 (NM)"] = fmt(_raw2.L2);
  } else {
    wp2Rows["WP2 r\u2081 roll-in (NM)"] = fmt(_raw2.r1);
    wp2Rows["WP2 Arc+transition L1\u2013L4 (NM)"] = fmt(_raw2.arcPlusTrans);
    wp2Rows["WP2 L5 bank estab. (NM)"] = fmt(_raw2.bankEstab);
  }
  wp2Rows["M\u2082 (NM)"] = fmt(_raw2.M);

  // Combined rows
  var msd = _raw1.M + _raw2.M;
  var combinedRows = {
    "D (NM)": fmt(_distanceD),
    "MSD = M\u2081 + M\u2082 (NM)": fmt(msd),
    Result: _distanceD >= msd ? "PASS (D \u2265 MSD)" : "FAIL (D < MSD)",
  };

  // TRD rows if flyby+flyby
  if (_raw1.type === "flyby" && _raw2.type === "flyby") {
    var DEG_TO_RAD = Math.PI / 180;
    var halfA_rad = (_raw1.effectiveTurn / 2) * DEG_TO_RAD;
    var halfB_rad = (_raw2.effectiveTurn / 2) * DEG_TO_RAD;
    var r1Arc = _raw1.r * halfA_rad;
    var r2Arc = _raw2.r * halfB_rad;
    var trd = _distanceD - _raw1.L1 - _raw2.L1 + r1Arc + r2Arc;
    combinedRows["r\u2081\u00B7(A/2)\u00B7\u03C0/180 (NM)"] = fmt(r1Arc);
    combinedRows["r\u2082\u00B7(B/2)\u00B7\u03C0/180 (NM)"] = fmt(r2Arc);
    combinedRows["TRD (NM)"] = fmt(trd);
    if (trd > 0 && _alt1_ft !== null && _alt2_ft !== null) {
      var gradient = ((_alt1_ft - _alt2_ft) / (trd * FT_PER_NM)) * 100;
      combinedRows["Descent Gradient (%)"] = fmt(gradient);
    }
  }

  // Rename WP1/WP2 key prefixes to use custom names
  var renamedWp1 = {};
  Object.keys(wp1Rows).forEach(function (k) {
    renamedWp1[k.slice(0, 3) === "WP1" ? wp1Name + k.slice(3) : k] = wp1Rows[k];
  });
  var renamedWp2 = {};
  Object.keys(wp2Rows).forEach(function (k) {
    renamedWp2[k.slice(0, 3) === "WP2" ? wp2Name + k.slice(3) : k] = wp2Rows[k];
  });
  var allRows = Object.assign({}, renamedWp1, renamedWp2, combinedRows);
  var htmlContent = createHTMLTable(
    allRows,
    "MSD Combined \u2014 PANS-OPS Vol II \u00A7 1.4.2",
  );
  copyToClipboard(htmlContent);
}
