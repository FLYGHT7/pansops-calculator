const OVERHEAD_ENTRY_TOLERANCE_DEG = 5;

document.addEventListener("DOMContentLoaded", () => {
  checkDarkMode();

  document.getElementById("btnCalculate").addEventListener("click", calculateOverheadTolerance);
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", () => {
    document.getElementById("loadFile").click();
  });
  document.getElementById("loadFile").addEventListener("change", loadParameters);
  document.getElementById("btnCopy").addEventListener("click", copyResultsToClipboard);

  ["aircraftAltitude", "aircraftUnit", "stationElevation", "stationUnit", "coneAngle"].forEach((id) => {
    document.getElementById(id).addEventListener("input", clearResults);
    document.getElementById(id).addEventListener("change", clearResults);
  });

  initializeI18n();
});

function checkDarkMode() {
  try {
    if (window.parent && window.parent.document.documentElement.classList.contains("dark")) {
      document.documentElement.classList.add("dark");
    }
  } catch {
    // The calculator can also run outside the application shell.
  }
}

function initializeI18n() {
  if (window.I18N) {
    I18N.init({ defaultLang: "en", supported: ["en", "es"], path: "../i18n" }).catch(console.error);
  }
}

function clearResults() {
  document.getElementById("results").classList.add("hidden");
}

function calculateOverheadTolerance() {
  const aircraftAltitudeFt = getValueInUnit("aircraftAltitude", "aircraftUnit", "ft");
  const stationElevationFt = getValueInUnit("stationElevation", "stationUnit", "ft");
  const coneAngleDeg = Number.parseFloat(document.getElementById("coneAngle").value);
  const heightFt = aircraftAltitudeFt - stationElevationFt;

  if (![aircraftAltitudeFt, stationElevationFt, coneAngleDeg].every(Number.isFinite)) {
    showToast(message("invalidInputs", "Please enter valid values for all inputs."), "error");
    clearResults();
    return;
  }
  if (heightFt <= 0) {
    showToast(message("invalidHeight", "Aircraft altitude must be above the station elevation."), "error");
    clearResults();
    return;
  }
  if (coneAngleDeg <= 0 || coneAngleDeg >= 90) {
    showToast(message("invalidAngle", "Cone semi-angle must be greater than 0° and less than 90°."), "error");
    clearResults();
    return;
  }

  const heightThousandsFt = heightFt / 1000;
  const radiusNm = 0.164 * heightThousandsFt * Math.tan(coneAngleDeg * DEG_TO_RAD);
  const offsetNm = radiusNm * Math.sin(OVERHEAD_ENTRY_TOLERANCE_DEG * DEG_TO_RAD);
  if (![radiusNm, offsetNm].every(Number.isFinite)) {
    showToast(message("invalidInputs", "Please enter valid values for all inputs."), "error");
    clearResults();
    return;
  }

  const heightInSelectedUnit = document.getElementById("aircraftUnit").value === "meters"
    && document.getElementById("stationUnit").value === "meters"
    ? heightFt * M_PER_FT
    : heightFt;
  const resultHeightUnit = document.getElementById("aircraftUnit").value === "meters"
    && document.getElementById("stationUnit").value === "meters"
    ? "m"
    : "ft";

  document.getElementById("heightResult").textContent = heightInSelectedUnit.toFixed(2);
  document.getElementById("heightUnitResult").textContent = resultHeightUnit;
  document.getElementById("radiusResult").textContent = radiusNm.toFixed(4);
  document.getElementById("offsetResult").textContent = offsetNm.toFixed(4);
  document.getElementById("results").classList.remove("hidden");
}

function readParameters() {
  return {
    "Aircraft Altitude": document.getElementById("aircraftAltitude").value,
    "Aircraft Unit": document.getElementById("aircraftUnit").value,
    "Station Elevation": document.getElementById("stationElevation").value,
    "Station Unit": document.getElementById("stationUnit").value,
    "Cone Semi-angle": document.getElementById("coneAngle").value,
  };
}

function saveParameters() {
  const data = readParameters();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${timestamp}_overhead_vor_tolerance.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function loadParameters(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const fields = [
        ["aircraftAltitude", "Aircraft Altitude"],
        ["stationElevation", "Station Elevation"],
        ["coneAngle", "Cone Semi-angle"],
      ];
      fields.forEach(([id, key]) => {
        if (Object.hasOwn(data, key)) document.getElementById(id).value = data[key];
      });
      [["aircraftUnit", "Aircraft Unit"], ["stationUnit", "Station Unit"]].forEach(([id, key]) => {
        if (["feet", "meters"].includes(data[key])) document.getElementById(id).value = data[key];
      });
      clearResults();
      showToast(message("loaded", "Parameters loaded."), "success");
    } catch {
      showToast(message("invalidJson", "Invalid JSON file."), "error");
    }
  };
  reader.readAsText(file);
}

function copyResultsToClipboard() {
  const labels = [
    [message("aircraftAltitude", "Aircraft altitude"), `${document.getElementById("aircraftAltitude").value} ${unitLabel("aircraftUnit")}`],
    [message("stationElevation", "Station elevation"), `${document.getElementById("stationElevation").value} ${unitLabel("stationUnit")}`],
    [message("coneAngle", "Cone semi-angle β"), `${document.getElementById("coneAngle").value}°`],
    [message("heightAboveStation", "Height above station (h)"), `${document.getElementById("heightResult").textContent} ${document.getElementById("heightUnitResult").textContent}`],
    [message("coneRadius", "Cone radius (zV)"), `${document.getElementById("radiusResult").textContent} NM`],
    [message("trackOffset", "Track offset (qV)"), `${document.getElementById("offsetResult").textContent} NM`],
  ];
  const rows = labels.map(([label, value]) => `<tr><td style="padding:8px;border:1px solid #cbd5e1">${escapeHtml(label)}</td><td style="padding:8px;border:1px solid #cbd5e1">${escapeHtml(value)}</td></tr>`).join("");
  const parameterHeader = message("parameter", "Parameter");
  const valueHeader = message("value", "Value");
  const html = `<table style="border-collapse:collapse;font-family:Arial,sans-serif"><thead><tr style="background:#0c2240;color:white"><th style="padding:8px;text-align:left">${escapeHtml(parameterHeader)}</th><th style="padding:8px;text-align:left">${escapeHtml(valueHeader)}</th></tr></thead><tbody>${rows}</tbody></table>`;
  const plain = [[parameterHeader, valueHeader], ...labels].map((row) => row.join("\t")).join("\n");

  navigator.clipboard.write([
    new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plain], { type: "text/plain" }),
    }),
  ]).then(() => {
    showToast(message("copied", "Results copied to clipboard."), "success");
  }).catch((error) => {
    console.error("Copy failed:", error);
    showToast(message("copyFailed", "Copy failed. Check browser permissions."), "error");
  });
}

function unitLabel(id) {
  return document.getElementById(id).value === "meters" ? "m" : "ft";
}

function message(key, fallback) {
  return window.I18N ? I18N.get(`overhead.${key}`, fallback) : fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
