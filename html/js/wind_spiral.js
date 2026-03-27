// ─── Wind Spiral Calculator — PANS-OPS Vol I ──────────────────────────────────
// Formula 006: E_θ = (θ/R) × (W/3600)   [wind effect per step, NM]
// Formula 007: d   = arcsin(W/V)          [drift angle, degrees]
//
// R_calc = 9.81 × tan(φ_rad) / (TAS_m_s) × (180/π)  [°/s]
// R_used = min(3.0, R_calc)
// If R_calc > 3: bank angle auto-adjusted to give exactly R_used = 3°/s
//
// Depends on: aviation-utils.js (DEG_TO_RAD, KT_TO_MS, showToast)

// ── PANS-OPS calculations ──────────────────────────────────────────────────────

function calcRateOfTurn(tas_kt, bankDeg) {
  const v_ms = tas_kt * KT_TO_MS;
  return ((9.81 * Math.tan(bankDeg * DEG_TO_RAD)) / v_ms) * (180 / Math.PI);
}

function adjBankForMaxR(tas_kt) {
  const v_ms = tas_kt * KT_TO_MS;
  return Math.atan((3 * DEG_TO_RAD * v_ms) / 9.81) / DEG_TO_RAD;
}

function calcDriftAngle(windKt, tasKt) {
  const ratio = windKt / tasKt;
  if (ratio > 1) return 90;
  return Math.asin(ratio) / DEG_TO_RAD;
}

function calcWindEffect(thetaDeg, R_used, windKt) {
  return (thetaDeg / R_used) * (windKt / 3600);
}

function fmt(val, dec) {
  return typeof val === "number" ? val.toFixed(dec) : "—";
}

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
  const tas = document.getElementById("tas").value.trim();
  const wind = document.getElementById("windSpeed").value.trim();
  const bank = document.getElementById("bankAngle").value.trim();

  if (tas === "" || wind === "" || bank === "") {
    showValidationError(
      "Please fill in TAS, Wind Speed, and Bank Angle before calculating.",
    );
    document
      .getElementById(
        tas === "" ? "tas" : wind === "" ? "windSpeed" : "bankAngle",
      )
      .focus();
    return false;
  }
  const tasVal = parseFloat(tas);
  const windVal = parseFloat(wind);
  const bankVal = parseFloat(bank);

  if (isNaN(tasVal) || tasVal <= 0) {
    showValidationError("TAS must be a positive number.");
    document.getElementById("tas").focus();
    return false;
  }
  if (isNaN(windVal) || windVal < 0) {
    showValidationError("Wind Speed must be zero or greater.");
    document.getElementById("windSpeed").focus();
    return false;
  }
  if (isNaN(bankVal) || bankVal < 1 || bankVal > 45) {
    showValidationError("Bank angle must be between 1° and 45°.");
    document.getElementById("bankAngle").focus();
    return false;
  }
  if (windVal >= tasVal) {
    showValidationError(
      "Wind speed must be less than TAS for a valid drift angle.",
    );
    document.getElementById("windSpeed").focus();
    return false;
  }
  hideValidationError();
  return true;
}

// ── Main calculation ───────────────────────────────────────────────────────────

function calculate() {
  if (!validate()) return;

  const tas_kt = parseFloat(document.getElementById("tas").value);
  const wind_kt = parseFloat(document.getElementById("windSpeed").value);
  const bank_deg = parseFloat(document.getElementById("bankAngle").value);
  const theta = parseFloat(document.getElementById("thetaStep").value);
  const total = parseFloat(document.getElementById("totalAngle").value);

  const R_calc = calcRateOfTurn(tas_kt, bank_deg);
  const R_used = Math.min(3.0, R_calc);
  const bankCapped = R_calc > 3.0;
  const bankAdj = bankCapped ? adjBankForMaxR(tas_kt) : bank_deg;
  const d = calcDriftAngle(wind_kt, tas_kt);
  const E_step = calcWindEffect(theta, R_used, wind_kt);
  const t360 = 360 / R_used;

  document.getElementById("kpiR").textContent = fmt(R_used, 4);
  document.getElementById("kpiD").textContent = fmt(d, 4);
  document.getElementById("kpiE").textContent = fmt(E_step, 4);
  document.getElementById("kpiT").textContent = fmt(t360, 1);

  const notice = document.getElementById("adjBankNotice");
  if (bankCapped) {
    document.getElementById("adjBankText").textContent =
      `R_calc = ${fmt(R_calc, 3)}°/s exceeds 3°/s — rate capped at 3°/s. Bank angle adjusted to ${fmt(bankAdj, 2)}°.`;
    notice.classList.remove("hidden");
  } else {
    notice.classList.add("hidden");
  }

  const tbody = document.getElementById("spiralBody");
  tbody.innerHTML = "";
  const steps = Math.round(total / theta);
  let cumulE = 0;

  for (let i = 1; i <= steps; i++) {
    const cumAngle = i * theta;
    const timeStep = cumAngle / R_used;
    cumulE += E_step;

    const tr = document.createElement("tr");
    if (cumAngle % 360 === 0) tr.classList.add("row-360");

    const vals = [
      cumAngle.toFixed(0) + "°",
      fmt(timeStep, 1),
      fmt(E_step, 4),
      fmt(cumulE, 4),
    ];
    vals.forEach((v) => {
      const td = document.createElement("td");
      td.textContent = v;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  document.getElementById("results").classList.remove("hidden");

  if (window.I18N && typeof I18N.applyToElement === "function") {
    I18N.applyToElement(document.getElementById("results"));
  }
}

// ── Save / Load parameters ─────────────────────────────────────────────────────

function saveParameters() {
  const data = {
    tas: document.getElementById("tas").value || "",
    windSpeed: document.getElementById("windSpeed").value || "",
    bankAngle: document.getElementById("bankAngle").value || "",
    thetaStep: document.getElementById("thetaStep").value || "30",
    totalAngle: document.getElementById("totalAngle").value || "360",
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${timestamp}_wind_spiral.json`;
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
      if (data.tas) document.getElementById("tas").value = data.tas;
      if (data.windSpeed)
        document.getElementById("windSpeed").value = data.windSpeed;
      if (data.bankAngle)
        document.getElementById("bankAngle").value = data.bankAngle;
      if (data.thetaStep)
        document.getElementById("thetaStep").value = data.thetaStep;
      if (data.totalAngle)
        document.getElementById("totalAngle").value = data.totalAngle;
      showToast("Parameters loaded!", "success");
    } catch {
      showToast(
        "Invalid JSON file. Please upload a valid parameters file.",
        "error",
      );
    }
  };
  reader.readAsText(file);
}

// ── Copy table ─────────────────────────────────────────────────────────────────

function copyTable() {
  const tbody = document.getElementById("spiralBody");
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll("tr"));

  const tableHTML = `<table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">
  <tr style="background:#0c2240;color:#ffffff">
    <th style="padding:8px;text-align:left;font-weight:bold">Cumul. Angle (°)</th>
    <th style="padding:8px;text-align:left;font-weight:bold">Time (s)</th>
    <th style="padding:8px;text-align:left;font-weight:bold">Eθ / step (NM)</th>
    <th style="padding:8px;text-align:left;font-weight:bold">Cumul. E (NM)</th>
  </tr>
  ${rows
    .map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td"));
      const is360 = tr.classList.contains("row-360");
      const rowStyle = is360 ? ' style="font-weight:700;color:#0369a1"' : "";
      return `<tr${rowStyle}>${cells.map((td) => `<td style="padding:8px;text-align:left">${td.textContent.trim()}</td>`).join("")}</tr>`;
    })
    .join("\n  ")}
</table>`;

  copyToClipboard(tableHTML);
}

// ── Init ───────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  try {
    if (
      window.parent &&
      window.parent.document.documentElement.classList.contains("dark")
    ) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    // standalone mode
  }

  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", function () {
    document.getElementById("loadFile").click();
  });
  document
    .getElementById("loadFile")
    .addEventListener("change", loadParameters);
  document.getElementById("btnCalcSpiral").addEventListener("click", calculate);
  document.getElementById("btnCopy").addEventListener("click", copyTable);
  document
    .getElementById("inputForm")
    .addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("btnCalcSpiral").click();
      }
    });
});
