// ─── Wind Spiral Calculator — PANS-OPS Vol I ──────────────────────────────────
// E_θ = (θ/R) × (W/3600); d = arcsin(W/V).
// IAS is converted to TAS with the shared k-factor calculation. Radius and wind
// effect use the same rate of turn, capped at 3°/s.

let lastCalculation = null;

function adjBankForMaxR(tasKt) {
  return Math.atan((3 * Math.PI * tasKt) / 3431) / DEG_TO_RAD;
}

function calcDriftAngle(windKt, tasKt) {
  return Math.asin(windKt / tasKt) / DEG_TO_RAD;
}

function calcWindEffect(thetaDeg, rateOfTurn, windKt) {
  return (thetaDeg / rateOfTurn) * (windKt / 3600);
}

function fmt(value, decimals) {
  return Number.isFinite(value) ? value.toFixed(decimals) : "—";
}

function translate(key, fallback) {
  if (window.I18N && typeof I18N.get === "function") {
    return I18N.get(key, fallback);
  }
  return fallback;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showValidationError(message, inputId) {
  const banner = document.getElementById("validationBanner");
  document.getElementById("validationMessage").textContent = message;
  banner.classList.remove("hidden");
  banner.classList.add("shake");
  banner.addEventListener(
    "animationend",
    () => banner.classList.remove("shake"),
    { once: true },
  );
  if (inputId) document.getElementById(inputId).focus();
}

function hideValidationError() {
  document.getElementById("validationBanner").classList.add("hidden");
}

function readAndValidateInputs() {
  const inputIds = [
    "ias",
    "altitude",
    "isaDeviation",
    "windSpeed",
    "bankAngle",
  ];
  const emptyId = inputIds.find(
    (id) => document.getElementById(id).value.trim() === "",
  );

  if (emptyId) {
    showValidationError(
      translate(
        "windSpiral.validationRequired",
        "Please fill in IAS, Altitude, ISA Deviation, Wind Speed, and Bank Angle before calculating.",
      ),
      emptyId,
    );
    return null;
  }

  const inputs = {
    ias: Number.parseFloat(document.getElementById("ias").value),
    altitude: Number.parseFloat(document.getElementById("altitude").value),
    altitudeUnit: document.getElementById("altitudeUnit").value,
    isaDeviation: Number.parseFloat(
      document.getElementById("isaDeviation").value,
    ),
    windSpeed: Number.parseFloat(document.getElementById("windSpeed").value),
    bankAngle: Number.parseFloat(document.getElementById("bankAngle").value),
    thetaStep: Number.parseFloat(document.getElementById("thetaStep").value),
    totalAngle: Number.parseFloat(document.getElementById("totalAngle").value),
  };

  if (!Number.isFinite(inputs.ias) || inputs.ias <= 0) {
    showValidationError(
      translate("windSpiral.validationIas", "IAS must be a positive number."),
      "ias",
    );
    return null;
  }
  if (!Number.isFinite(inputs.altitude) || inputs.altitude < 0) {
    showValidationError(
      translate(
        "windSpiral.validationAltitude",
        "Altitude must be zero or greater.",
      ),
      "altitude",
    );
    return null;
  }

  const altitudeFt =
    inputs.altitudeUnit === "m"
      ? metersToFeet(inputs.altitude)
      : inputs.altitude;
  if (altitudeFt > 60000) {
    showValidationError(
      translate(
        "windSpiral.validationAltitudeMax",
        "Altitude must not exceed 60,000 ft.",
      ),
      "altitude",
    );
    return null;
  }
  if (
    !Number.isFinite(inputs.isaDeviation) ||
    inputs.isaDeviation < -100 ||
    inputs.isaDeviation > 100
  ) {
    showValidationError(
      translate(
        "windSpiral.validationIsa",
        "ISA deviation must be between -100°C and 100°C.",
      ),
      "isaDeviation",
    );
    return null;
  }
  if (!Number.isFinite(inputs.windSpeed) || inputs.windSpeed < 0) {
    showValidationError(
      translate(
        "windSpiral.validationWind",
        "Wind Speed must be zero or greater.",
      ),
      "windSpeed",
    );
    return null;
  }
  if (
    !Number.isFinite(inputs.bankAngle) ||
    inputs.bankAngle < 1 ||
    inputs.bankAngle > 45
  ) {
    showValidationError(
      translate(
        "windSpiral.validationBank",
        "Bank angle must be between 1° and 45°.",
      ),
      "bankAngle",
    );
    return null;
  }

  const kFactor = calculateKFactor(altitudeFt, inputs.isaDeviation);
  const tas = calculateTAS(inputs.ias, kFactor);
  if (!Number.isFinite(tas) || tas <= 0) {
    showValidationError(
      translate(
        "windSpiral.validationAtmosphere",
        "The altitude and ISA deviation do not produce a valid TAS.",
      ),
      "altitude",
    );
    return null;
  }
  if (inputs.windSpeed >= tas) {
    showValidationError(
      translate(
        "windSpiral.validationWindTas",
        "Wind speed must be less than TAS for a valid drift angle.",
      ),
      "windSpeed",
    );
    return null;
  }

  hideValidationError();
  return { ...inputs, altitudeFt, kFactor, tas };
}

function calculate() {
  const inputs = readAndValidateInputs();
  if (!inputs) return;

  const rateCalculated =
    (3431 * Math.tan(inputs.bankAngle * DEG_TO_RAD)) /
    (Math.PI * inputs.tas);
  const rateUsed = Math.min(rateCalculated, 3);
  const radius = inputs.tas / (20 * Math.PI * rateUsed);
  const bankCapped = rateCalculated > rateUsed;
  const bankAdjusted = bankCapped
    ? adjBankForMaxR(inputs.tas)
    : inputs.bankAngle;
  const driftAngle = calcDriftAngle(inputs.windSpeed, inputs.tas);
  const windEffectPerStep = calcWindEffect(
    inputs.thetaStep,
    rateUsed,
    inputs.windSpeed,
  );
  const fullTurnTime = 360 / rateUsed;

  const rows = [];
  for (
    let cumulativeAngle = inputs.thetaStep;
    cumulativeAngle < inputs.totalAngle;
    cumulativeAngle += inputs.thetaStep
  ) {
    rows.push({
      angle: cumulativeAngle,
      windEffect: calcWindEffect(
        cumulativeAngle,
        rateUsed,
        inputs.windSpeed,
      ),
    });
  }
  rows.push({
    angle: inputs.totalAngle,
    windEffect: calcWindEffect(
      inputs.totalAngle,
      rateUsed,
      inputs.windSpeed,
    ),
  });

  lastCalculation = {
    ...inputs,
    rateCalculated,
    rateUsed,
    bankCapped,
    bankAdjusted,
    radius,
    driftAngle,
    windEffectPerStep,
    fullTurnTime,
    rows,
  };

  document.getElementById("kpiTas").textContent = fmt(inputs.tas, 4);
  document.getElementById("kpiR").textContent = fmt(rateUsed, 4);
  document.getElementById("kpiRadius").textContent = fmt(radius, 4);
  document.getElementById("kpiD").textContent = fmt(driftAngle, 4);
  document.getElementById("kpiE").textContent = fmt(windEffectPerStep, 4);
  document.getElementById("kpiT").textContent = fmt(fullTurnTime, 1);

  const notice = document.getElementById("adjBankNotice");
  if (bankCapped) {
    document.getElementById("adjBankText").textContent = translate(
      "windSpiral.bankAdjustedNotice",
      "Calculated rate {calculated}°/s exceeds 3°/s. Rate capped at 3°/s and bank angle adjusted to {bank}°.",
    )
      .replace("{calculated}", fmt(rateCalculated, 3))
      .replace("{bank}", fmt(bankAdjusted, 2));
    notice.classList.remove("hidden");
  } else {
    notice.classList.add("hidden");
  }

  const tbody = document.getElementById("spiralBody");
  tbody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    if (row.angle === 360) tr.classList.add("row-360");

    const angleCell = document.createElement("td");
    angleCell.textContent = row.angle.toFixed(0) + "°";

    const effectCell = document.createElement("td");
    effectCell.textContent = fmt(row.windEffect, 4);
    tr.appendChild(angleCell);
    tr.appendChild(effectCell);
    tbody.appendChild(tr);
  });

  document.getElementById("results").classList.remove("hidden");
  if (window.I18N && typeof I18N.applyToElement === "function") {
    I18N.applyToElement(document.getElementById("results"));
  }
}

function saveParameters() {
  const data = {
    version: 2,
    ias: document.getElementById("ias").value,
    altitude: document.getElementById("altitude").value,
    altitudeUnit: document.getElementById("altitudeUnit").value,
    isaDeviation: document.getElementById("isaDeviation").value,
    windSpeed: document.getElementById("windSpeed").value,
    bankAngle: document.getElementById("bankAngle").value,
    thetaStep: document.getElementById("thetaStep").value,
    totalAngle: document.getElementById("totalAngle").value,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(blob);
  anchor.href = url;
  anchor.download = `${timestamp}_wind_spiral.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast(
    translate("windSpiral.parametersSaved", "Parameters saved!"),
    "success",
  );
}

function parseParameterFile(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("invalid");
  }
  if (!("ias" in data) && "tas" in data) {
    throw new Error("legacy");
  }

  const requiredKeys = [
    "ias",
    "altitude",
    "altitudeUnit",
    "isaDeviation",
    "windSpeed",
    "bankAngle",
    "thetaStep",
    "totalAngle",
  ];
  if (!requiredKeys.every((key) => Object.hasOwn(data, key))) {
    throw new Error("invalid");
  }

  const altitudeUnit = String(data.altitudeUnit);
  const thetaStep = String(data.thetaStep);
  const totalAngle = String(data.totalAngle);
  if (
    !["ft", "m"].includes(altitudeUnit) ||
    !["10", "15", "20", "30", "45"].includes(thetaStep) ||
    !["90", "180", "270", "360"].includes(totalAngle)
  ) {
    throw new Error("invalid");
  }

  return {
    ias: String(data.ias),
    altitude: String(data.altitude),
    altitudeUnit,
    isaDeviation: String(data.isaDeviation),
    windSpeed: String(data.windSpeed),
    bankAngle: String(data.bankAngle),
    thetaStep,
    totalAngle,
  };
}

function loadParameters(event) {
  const file = event.target.files[0];
  if (!file) {
    showToast(
      translate(
        "windSpiral.selectValidFile",
        "Please select a valid JSON file.",
      ),
      "error",
    );
    return;
  }

  const reader = new FileReader();
  reader.onload = function (loadEvent) {
    try {
      const values = parseParameterFile(JSON.parse(loadEvent.target.result));
      Object.entries(values).forEach(([id, value]) => {
        document.getElementById(id).value = value;
      });
      lastCalculation = null;
      document.getElementById("results").classList.add("hidden");
      hideValidationError();
      showToast(
        translate("windSpiral.parametersLoaded", "Parameters loaded!"),
        "success",
      );
    } catch (error) {
      const message =
        error.message === "legacy"
          ? translate(
              "windSpiral.legacyFile",
              "This file contains TAS only. Enter IAS, altitude, and ISA deviation and save it again.",
            )
          : translate(
              "windSpiral.invalidFile",
              "Invalid Wind Spiral parameter file.",
            );
      showToast(message, "error");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function tableRow(label, value) {
  return `<tr><td style="padding:8px;text-align:left">${escapeHTML(label)}</td><td style="padding:8px;text-align:left">${escapeHTML(value)}</td></tr>`;
}

function copyTable() {
  if (!lastCalculation) {
    showToast(
      translate(
        "windSpiral.calculateBeforeCopy",
        "Calculate the wind spiral before copying results.",
      ),
      "error",
    );
    return;
  }

  const result = lastCalculation;
  const parameterRows = [
    ["IAS", `${fmt(result.ias, 4)} kt`],
    ["Altitude", `${fmt(result.altitude, 4)} ${result.altitudeUnit}`],
    ["ISA Deviation (VAR)", `${fmt(result.isaDeviation, 2)} °C`],
    ["Wind Speed", `${fmt(result.windSpeed, 4)} kt`],
    ["Bank Angle", `${fmt(result.bankAngle, 2)}°`],
    ["Angular Step (θ)", `${fmt(result.thetaStep, 0)}°`],
    ["Total Turn Angle", `${fmt(result.totalAngle, 0)}°`],
    ["k Factor", fmt(result.kFactor, 4)],
    ["True Airspeed (TAS)", `${fmt(result.tas, 4)} kt`],
    ["Rate of Turn", `${fmt(result.rateUsed, 4)} °/s`],
    ["Radius of Turn", `${fmt(result.radius, 4)} NM`],
    ["Drift Angle", `${fmt(result.driftAngle, 4)}°`],
    ["Wind Effect per Step", `${fmt(result.windEffectPerStep, 4)} NM`],
    ["Full 360° Time", `${fmt(result.fullTurnTime, 1)} s`],
  ];
  if (result.bankCapped) {
    parameterRows.splice(10, 0, [
      "Calculated Rate of Turn",
      `${fmt(result.rateCalculated, 4)} °/s`,
    ]);
    parameterRows.splice(11, 0, [
      "Adjusted Bank Angle",
      `${fmt(result.bankAdjusted, 2)}°`,
    ]);
  }

  const headerStyle =
    'style="background:#0c2240;color:#ffffff;padding:8px;text-align:left;font-weight:bold"';
  const parametersHTML = `<table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">
  <tr><th colspan="2" ${headerStyle}>Wind Spiral — Parameters and Results</th></tr>
  <tr><th ${headerStyle}>Parameter</th><th ${headerStyle}>Value</th></tr>
  ${parameterRows.map(([label, value]) => tableRow(label, value)).join("\n  ")}
</table>`;

  const spiralRows = result.rows
    .map(
      (row) =>
        `<tr><td style="padding:8px;text-align:left">${row.angle.toFixed(0)}°</td><td style="padding:8px;text-align:left">${fmt(row.windEffect, 4)}</td></tr>`,
    )
    .join("\n  ");
  const spiralHTML = `<table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;margin-top:12px">
  <tr><th ${headerStyle}>Cumul. Angle (°)</th><th ${headerStyle}>E(θ) - NM</th></tr>
  ${spiralRows}
</table>`;

  copyToClipboard(`${parametersHTML}<br>${spiralHTML}`);
}

document.addEventListener("DOMContentLoaded", function () {
  try {
    if (
      window.parent &&
      window.parent.document.documentElement.classList.contains("dark")
    ) {
      document.documentElement.classList.add("dark");
    }
  } catch {
    // Standalone mode.
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
    .addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        calculate();
      }
    });
});
