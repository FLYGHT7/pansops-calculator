// ─── OMNI SID PDG Calculator — ICAO PANS-OPS ─────────────────────────────────
// PDG   = (((obs_m - (der_m + 5)) / dist_m) + 0.008) × 100   [%]
// OIS   = (der_m + 5) + (dist_m × 0.025)                      [m]
// MOC   = dist_m × 0.008                                       [m]
// ReqAlt= obs_m + MOC                                          [m]
//
// Depends on: aviation-utils.js (feetToMeters, nmToMeters, showToast, copyToClipboard)

// ── Validation ─────────────────────────────────────────────────────────────────

function showValidationError(msg) {
  const banner = document.getElementById("validationBanner");
  document.getElementById("validationMessage").textContent = msg;
  banner.classList.remove("hidden");
  banner.classList.add("shake");
  banner.addEventListener(
    "animationend",
    () => banner.classList.remove("shake"),
    { once: true },
  );
}

function hideValidationError() {
  document.getElementById("validationBanner").classList.add("hidden");
}

function validate() {
  const derEl = document.getElementById("derElevation");
  const obsEl = document.getElementById("obsElevation");
  const distEl = document.getElementById("distance");

  if (derEl.value.trim() === "") {
    showValidationError("Please enter the DER Elevation.");
    derEl.focus();
    return false;
  }
  if (obsEl.value.trim() === "") {
    showValidationError("Please enter the Obstacle Elevation.");
    obsEl.focus();
    return false;
  }
  if (distEl.value.trim() === "") {
    showValidationError("Please enter the Horizontal Distance to Obstacle.");
    distEl.focus();
    return false;
  }

  const derVal = parseFloat(derEl.value);
  const obsVal = parseFloat(obsEl.value);
  const distVal = parseFloat(distEl.value);

  if (isNaN(derVal)) {
    showValidationError("DER Elevation must be a valid number.");
    derEl.focus();
    return false;
  }
  if (isNaN(obsVal)) {
    showValidationError("Obstacle Elevation must be a valid number.");
    obsEl.focus();
    return false;
  }
  if (isNaN(distVal) || distVal <= 0) {
    showValidationError("Horizontal Distance must be a positive number.");
    distEl.focus();
    return false;
  }

  hideValidationError();
  return true;
}

// ── Unit helpers ───────────────────────────────────────────────────────────────

function getMeters(inputId, unitId) {
  const val = parseFloat(document.getElementById(inputId).value);
  const unit = document.getElementById(unitId).value;
  if (unit === "ft") return feetToMeters(val);
  if (unit === "NM") return nmToMeters(val);
  return val;
}

function fmt(val, dec) {
  return typeof val === "number" ? val.toFixed(dec) : "—";
}

// ── Main calculation ───────────────────────────────────────────────────────────

function calculate() {
  if (!validate()) return;

  const derVal = parseFloat(document.getElementById("derElevation").value);
  const obsVal = parseFloat(document.getElementById("obsElevation").value);
  const distVal = parseFloat(document.getElementById("distance").value);

  const unitDer = document.getElementById("unitsDer").value;
  const unitObs = document.getElementById("unitsObs").value;
  const unitDist = document.getElementById("unitsDist").value;

  const der_m = unitDer === "ft" ? feetToMeters(derVal) : derVal;
  const obs_m = unitObs === "ft" ? feetToMeters(obsVal) : obsVal;
  const dist_m = unitDist === "NM" ? nmToMeters(distVal) : distVal;

  // Core PANS-OPS calculations
  const pdg = ((obs_m - (der_m + 5)) / dist_m + 0.008) * 100;
  const ois = der_m + 5 + dist_m * 0.025;
  const moc = dist_m * 0.008;
  const reqAlt = obs_m + moc;

  const oisPenetration = obs_m > ois;
  const pdgExceeds = pdg > 3.3;

  // Populate KPI cards
  document.getElementById("kpiPdg").textContent = fmt(pdg, 2) + "%";
  document.getElementById("kpiOis").textContent = fmt(ois, 2) + " m";
  document.getElementById("kpiMoc").textContent = fmt(moc, 2) + " m";
  document.getElementById("kpiReqAlt").textContent = fmt(reqAlt, 2) + " m";

  // Input summary
  const derDisplay =
    unitDer === "ft" ? `${derVal} ft (${fmt(der_m, 2)} m)` : `${derVal} m`;
  const obsDisplay =
    unitObs === "ft" ? `${obsVal} ft (${fmt(obs_m, 2)} m)` : `${obsVal} m`;
  const distDisplay =
    unitDist === "NM" ? `${distVal} NM (${fmt(dist_m, 2)} m)` : `${distVal} m`;

  document.getElementById("summaryDer").textContent = derDisplay;
  document.getElementById("summaryObs").textContent = obsDisplay;
  document.getElementById("summaryDist").textContent = distDisplay;
  document.getElementById("summaryMocFt").textContent =
    `${fmt(moc / 0.3048, 2)} ft`;
  document.getElementById("summaryReqAltFt").textContent =
    `(${fmt(reqAlt / 0.3048, 2)} ft)`;

  // Status indicators
  const oisStatus = document.getElementById("oisStatus");
  oisStatus.textContent = oisPenetration
    ? "⚠ Obstacle penetrates the OIS."
    : "✓ Obstacle does not penetrate the OIS.";
  oisStatus.className = oisPenetration
    ? "inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium status-warn"
    : "inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium status-ok";

  const pdgStatus = document.getElementById("pdgStatus");
  pdgStatus.textContent = pdgExceeds
    ? "⚠ Exceeds standard 3.3% — special aircraft performance required."
    : "✓ Within standard 3.3% PDG.";
  pdgStatus.className = pdgExceeds
    ? "inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium status-warn"
    : "inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium status-ok";

  // Show results
  document.getElementById("results").classList.remove("hidden");

  if (window.I18N && typeof I18N.applyToElement === "function") {
    I18N.applyToElement(document.getElementById("results"));
  }
}

// ── Copy table ─────────────────────────────────────────────────────────────────

function copyTable() {
  const derVal = parseFloat(document.getElementById("derElevation").value);
  const obsVal = parseFloat(document.getElementById("obsElevation").value);
  const distVal = parseFloat(document.getElementById("distance").value);

  const unitDer = document.getElementById("unitsDer").value;
  const unitObs = document.getElementById("unitsObs").value;
  const unitDist = document.getElementById("unitsDist").value;

  const der_m = unitDer === "ft" ? feetToMeters(derVal) : derVal;
  const obs_m = unitObs === "ft" ? feetToMeters(obsVal) : obsVal;
  const dist_m = unitDist === "NM" ? nmToMeters(distVal) : distVal;

  const pdg = ((obs_m - (der_m + 5)) / dist_m + 0.008) * 100;
  const ois = der_m + 5 + dist_m * 0.025;
  const moc = dist_m * 0.008;
  const reqAlt = obs_m + moc;

  const tableHTML = `<table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">
  <tr style="background:#0c2240;color:#ffffff"><th style="padding:8px;text-align:left;font-weight:bold">Parameter</th><th style="padding:8px;text-align:left;font-weight:bold">Value</th></tr>
  <tr><td style="padding:8px;text-align:left">DER Elevation</td><td style="padding:8px;text-align:left">${unitDer === "ft" ? derVal + " ft (" + fmt(der_m, 2) + " m)" : derVal + " m"}</td></tr>
  <tr><td style="padding:8px;text-align:left">Obstacle Elevation</td><td style="padding:8px;text-align:left">${unitObs === "ft" ? obsVal + " ft (" + fmt(obs_m, 2) + " m)" : obsVal + " m"}</td></tr>
  <tr><td style="padding:8px;text-align:left">Horizontal Distance</td><td style="padding:8px;text-align:left">${unitDist === "NM" ? distVal + " NM (" + fmt(dist_m, 2) + " m)" : distVal + " m"}</td></tr>
  <tr style="font-weight:700"><td style="padding:8px;text-align:left">Required PDG</td><td style="padding:8px;text-align:left">${fmt(pdg, 2)}%</td></tr>
  <tr><td style="padding:8px;text-align:left">OIS Elevation</td><td style="padding:8px;text-align:left">${fmt(ois, 2)} m</td></tr>
  <tr><td style="padding:8px;text-align:left">MOC Clearance</td><td style="padding:8px;text-align:left">${fmt(moc, 2)} m (${fmt(moc / 0.3048, 2)} ft)</td></tr>
  <tr><td style="padding:8px;text-align:left">Required Altitude</td><td style="padding:8px;text-align:left">${fmt(reqAlt, 2)} m (${fmt(reqAlt / 0.3048, 2)} ft)</td></tr>
  <tr><td style="padding:8px;text-align:left">OIS Penetration</td><td style="padding:8px;text-align:left">${obs_m > ois ? "YES" : "No"}</td></tr>
  <tr><td style="padding:8px;text-align:left">PDG Note</td><td style="padding:8px;text-align:left">${pdg > 3.3 ? "Exceeds 3.3% standard" : "Within 3.3% standard"}</td></tr>
</table>`;

  copyToClipboard(tableHTML);
}

// ── Save / Load parameters ─────────────────────────────────────────────────────

function saveParameters() {
  const data = {
    derElevation: document.getElementById("derElevation").value || "",
    obsElevation: document.getElementById("obsElevation").value || "",
    distance: document.getElementById("distance").value || "",
    unitsDer: document.getElementById("unitsDer").value || "m",
    unitsObs: document.getElementById("unitsObs").value || "m",
    unitsDist: document.getElementById("unitsDist").value || "m",
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${timestamp}_omni_sid.json`;
  a.click();
  showToast("Parameters saved!", "success");
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
      const fields = [
        "derElevation",
        "obsElevation",
        "distance",
        "unitsDer",
        "unitsObs",
        "unitsDist",
      ];
      fields.forEach((id) => {
        if (data[id] !== undefined)
          document.getElementById(id).value = data[id];
      });
      showToast("Parameters loaded!", "success");
    } catch {
      showToast("Invalid JSON file.", "error");
    }
  };
  // Reset file input so same file can be loaded again
  event.target.value = "";
  reader.readAsText(file);
}

// ── Init ───────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", () => {
    document.getElementById("loadFile").click();
  });
  document
    .getElementById("loadFile")
    .addEventListener("change", loadParameters);
  document.getElementById("btnCalcOmni").addEventListener("click", calculate);
  document.getElementById("btnCopy").addEventListener("click", copyTable);

  // Enter key on any input triggers calculation
  document.getElementById("inputForm").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      calculate();
    }
  });
});
