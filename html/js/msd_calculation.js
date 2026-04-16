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

// --- Event listeners ---

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

  document.getElementById("h1Unit").addEventListener("change", function () {
    handleUnitChange("h1", "h1Unit");
  });
  document.getElementById("h2Unit").addEventListener("change", function () {
    handleUnitChange("h2", "h2Unit");
  });
}

// --- Unit handling ---

function initializeUnitSelectors() {
  var unitSelectors = document.querySelectorAll('select[id$="Unit"]');
  unitSelectors.forEach(function (selector) {
    selector.dataset.lastUnit = selector.value;
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
        input.value = (currentValue * 0.3048).toFixed(2);
      } else if (oldUnit === "m" && newUnit === "ft") {
        input.value = (currentValue / 0.3048).toFixed(2);
      }
    }
  }
  unitSelect.dataset.lastUnit = unitSelect.value;
}

// --- Core calculation ---

function calculateMSD() {
  // Read inputs
  var distanceD = parseFloat(document.getElementById("distance").value);
  var h1Raw = parseFloat(document.getElementById("h1").value);
  var h1Unit = document.getElementById("h1Unit").value;
  var h2Raw = parseFloat(document.getElementById("h2").value);
  var h2Unit = document.getElementById("h2Unit").value;

  var r1TanHalfInput = parseFloat(document.getElementById("r1TanA").value);
  var turnA = parseFloat(document.getElementById("turnA").value);
  var m1 = parseFloat(document.getElementById("m1").value);

  var r2TanHalfInput = parseFloat(document.getElementById("r2TanB").value);
  var turnB = parseFloat(document.getElementById("turnB").value);
  var m2 = parseFloat(document.getElementById("m2").value);

  // Validate
  if (isNaN(distanceD) || distanceD <= 0) {
    showToast("Please enter a valid IAF-IF distance (> 0).", "error");
    return;
  }
  if (isNaN(h1Raw) || h1Raw < 0) {
    showToast("Please enter a valid altitude h1 (>= 0).", "error");
    return;
  }
  if (isNaN(h2Raw) || h2Raw < 0) {
    showToast("Please enter a valid altitude h2 (>= 0).", "error");
    return;
  }
  if (isNaN(r1TanHalfInput) || r1TanHalfInput <= 0) {
    showToast("IAF: Please enter a valid r1·tan(A/2) (> 0).", "error");
    return;
  }
  if (isNaN(turnA) || turnA <= 0) {
    showToast("IAF: Please enter a valid turn angle A (> 0).", "error");
    return;
  }
  if (isNaN(m1) || m1 <= 0) {
    showToast("IAF: Please enter a valid M1 (> 0).", "error");
    return;
  }
  if (isNaN(r2TanHalfInput) || r2TanHalfInput <= 0) {
    showToast("IF: Please enter a valid r2·tan(B/2) (> 0).", "error");
    return;
  }
  if (isNaN(turnB) || turnB <= 0) {
    showToast("IF: Please enter a valid turn angle B (> 0).", "error");
    return;
  }
  if (isNaN(m2) || m2 <= 0) {
    showToast("IF: Please enter a valid M2 (> 0).", "error");
    return;
  }

  // Convert altitudes to feet
  var h1_ft = h1Unit === "ft" ? h1Raw : h1Raw / 0.3048;
  var h2_ft = h2Unit === "ft" ? h2Raw : h2Raw / 0.3048;

  // TRD = D - r1*tan(A/2) - r2*tan(B/2) + r1*(A/2)*(pi/180) + r2*(B/2)*(pi/180)
  var halfA_rad = (turnA / 2) * DEG_TO_RAD;
  var halfB_rad = (turnB / 2) * DEG_TO_RAD;

  // Inputs are r1*tan(A/2) and r2*tan(B/2) directly
  var r1TanHalf = r1TanHalfInput;
  var r2TanHalf = r2TanHalfInput;

  // Derive r from input: r = r*tan(A/2) / tan(A/2), then arc = r * (A/2) * (pi/180)
  var r1 = r1TanHalf / Math.tan(halfA_rad);
  var r2 = r2TanHalf / Math.tan(halfB_rad);
  var r1ArcHalf = r1 * halfA_rad;
  var r2ArcHalf = r2 * halfB_rad;

  var trd = distanceD - r1TanHalf - r2TanHalf + r1ArcHalf + r2ArcHalf;
  var gradient =
    trd > 0 ? ((h1_ft - h2_ft) / (trd * FT_PER_NM)) * 100 : Infinity;
  var msdTotal = m1 + m2;

  var trdPass = trd > 0;
  var gradientPass = Math.abs(gradient) < 8;
  var msdPass = msdTotal <= distanceD;

  // Populate intermediate breakdown
  document.getElementById("outR1Arc").textContent = r1ArcHalf.toFixed(4);
  document.getElementById("outR2Arc").textContent = r2ArcHalf.toFixed(4);

  // Populate outputs
  document.getElementById("outTRD").textContent = trd.toFixed(4);
  var trdBadge = document.getElementById("outTRDStatus");
  trdBadge.textContent = trdPass ? "\u2705 PASS" : "\u274C FAIL";
  trdBadge.className = trdPass
    ? "ml-2 px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
    : "ml-2 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";

  document.getElementById("outGradient").textContent = trdPass
    ? gradient.toFixed(2)
    : "N/A";
  var gradBadge = document.getElementById("outGradientStatus");
  if (!trdPass) {
    gradBadge.textContent = "\u2014";
    gradBadge.className =
      "ml-2 px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400";
  } else {
    gradBadge.textContent = gradientPass ? "\u2705 PASS" : "\u274C FAIL";
    gradBadge.className = gradientPass
      ? "ml-2 px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
      : "ml-2 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }

  document.getElementById("outMSD").textContent = msdTotal.toFixed(4);
  var msdBadge = document.getElementById("outMSDStatus");
  msdBadge.textContent = msdPass ? "\u2705 PASS" : "\u274C FAIL";
  msdBadge.className = msdPass
    ? "ml-2 px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
    : "ml-2 px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";

  // Primary card color
  var primaryCard = document.getElementById("msdPrimaryCard");
  if (msdPass) {
    primaryCard.className =
      "bg-primary-700 dark:bg-primary-800 rounded-xl p-5 text-white mb-4 text-center shadow-md";
  } else {
    primaryCard.className =
      "bg-red-600 dark:bg-red-800 rounded-xl p-5 text-white mb-4 text-center shadow-md";
  }

  // Show results
  document.getElementById("resultsSection").classList.remove("hidden");
}

// --- Save / Load parameters ---

function saveParameters() {
  var data = {
    distance: document.getElementById("distance").value || "",
    h1: document.getElementById("h1").value || "",
    h1Unit: document.getElementById("h1Unit").value || "ft",
    h2: document.getElementById("h2").value || "",
    h2Unit: document.getElementById("h2Unit").value || "ft",
    r1TanA: document.getElementById("r1TanA").value || "",
    turnA: document.getElementById("turnA").value || "",
    m1: document.getElementById("m1").value || "",
    r2TanB: document.getElementById("r2TanB").value || "",
    turnB: document.getElementById("turnB").value || "",
    m2: document.getElementById("m2").value || "",
  };

  var now = new Date();
  var timestamp = now.toISOString().replace(/[:.]/g, "-");
  var filename = timestamp + "_msd_combined.json";
  var blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function loadParameters(event) {
  var file = event.target.files[0];
  if (!file) {
    showToast("Please select a valid JSON file.", "error");
    return;
  }
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var data = JSON.parse(e.target.result);

      if (data.distance !== undefined)
        document.getElementById("distance").value = data.distance;
      if (data.h1 !== undefined) document.getElementById("h1").value = data.h1;
      if (data.h1Unit) {
        var sel1 = document.getElementById("h1Unit");
        sel1.dataset.lastUnit = sel1.value;
        sel1.value = data.h1Unit;
      }
      if (data.h2 !== undefined) document.getElementById("h2").value = data.h2;
      if (data.h2Unit) {
        var sel2 = document.getElementById("h2Unit");
        sel2.dataset.lastUnit = sel2.value;
        sel2.value = data.h2Unit;
      }
      if (data.r1TanA !== undefined)
        document.getElementById("r1TanA").value = data.r1TanA;
      if (data.turnA !== undefined)
        document.getElementById("turnA").value = data.turnA;
      if (data.m1 !== undefined) document.getElementById("m1").value = data.m1;
      if (data.r2TanB !== undefined)
        document.getElementById("r2TanB").value = data.r2TanB;
      if (data.turnB !== undefined)
        document.getElementById("turnB").value = data.turnB;
      if (data.m2 !== undefined) document.getElementById("m2").value = data.m2;

      showToast("Parameters loaded.", "success");
    } catch (err) {
      showToast("Invalid JSON file.", "error");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

// --- Copy to Word ---

function copyToWord() {
  var msdVal = document.getElementById("outMSD").textContent;
  if (!msdVal) return;

  var tableData = {
    "IAF-IF Distance (D)": document.getElementById("distance").value + " NM",
    "Altitude h\u2081":
      document.getElementById("h1").value +
      " " +
      document.getElementById("h1Unit").value,
    "Altitude h\u2082":
      document.getElementById("h2").value +
      " " +
      document.getElementById("h2Unit").value,
    "IAF: r\u2081\u00B7tan(A/2)":
      document.getElementById("r1TanA").value + " NM",
    "IAF: Turn Angle A": document.getElementById("turnA").value + "\u00B0",
    "IAF: M\u2081": document.getElementById("m1").value + " NM",
    "IAF: r\u2081\u00B7(A/2)\u00B7\u03C0/180":
      document.getElementById("outR1Arc").textContent + " NM",
    "IF: r\u2082\u00B7tan(B/2)":
      document.getElementById("r2TanB").value + " NM",
    "IF: Turn Angle B": document.getElementById("turnB").value + "\u00B0",
    "IF: M\u2082": document.getElementById("m2").value + " NM",
    "IF: r\u2082\u00B7(B/2)\u00B7\u03C0/180":
      document.getElementById("outR2Arc").textContent + " NM",
    TRD:
      document.getElementById("outTRD").textContent +
      " NM \u2014 " +
      document.getElementById("outTRDStatus").textContent,
    Gradient:
      document.getElementById("outGradient").textContent +
      "% \u2014 " +
      document.getElementById("outGradientStatus").textContent,
    "MSD (M\u2081 + M\u2082)":
      msdVal +
      " NM \u2014 " +
      document.getElementById("outMSDStatus").textContent,
  };

  var htmlContent = createHTMLTable(
    tableData,
    "MSD Combined \u2014 PANS-OPS Vol II \u00A71.4.2",
  );
  copyToClipboard(htmlContent);
}
