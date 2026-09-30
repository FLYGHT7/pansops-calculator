const BASE_TURN_BANK_ANGLE_DEG = 25;
const BASE_TURN_MAX_RATE_DEG_S = 3;
const BASE_TURN_NM_FT_FACTOR = 0.164;
const BASE_TURN_RATE_CONSTANT = 3431;

let baseTurnSnapshot = null;

document.addEventListener("DOMContentLoaded", () => {
  checkDarkMode();
  initializeI18n();

  const form = document.getElementById("baseTurnForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculateBaseTurn();
  });
  document.getElementById("mode").addEventListener("change", updateModeInputs);
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", () => {
    document.getElementById("loadFile").click();
  });
  document.getElementById("loadFile").addEventListener("change", loadParameters);
  document.getElementById("btnCopy").addEventListener("click", copyResultsToClipboard);

  form.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", invalidateResults);
    input.addEventListener("change", invalidateResults);
  });
  updateModeInputs();
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

function updateModeInputs() {
  const distanceMode = document.getElementById("mode").value === "distance";
  document.getElementById("timeGroup").classList.toggle("hidden", distanceMode);
  document.getElementById("distanceGroup").classList.toggle("hidden", !distanceMode);
  document.getElementById("navaidGroup").classList.toggle("hidden", distanceMode);
  invalidateResults();
}

function invalidateResults() {
  baseTurnSnapshot = null;
  document.getElementById("results").classList.add("hidden");
}

function calculateBaseTurn() {
  const values = readInputs();
  const error = validateInputs(values);
  if (error) {
    showToast(message(error.key, error.fallback), "error");
    invalidateResults();
    return;
  }

  const result = computeBaseTurn(values);
  if (!result || !result.rows.every((row) => Number.isFinite(row.rawValue))) {
    showToast(message("invalidCalculation", "These inputs produce a non-finite result. Check the entered values."), "error");
    invalidateResults();
    return;
  }

  baseTurnSnapshot = {
    inputs: values,
    rows: result.rows.map((row) => ({
      line: row.line,
      parameter: row.parameter,
      rawValue: row.rawValue,
      value: row.usedValue === undefined
        ? formatValue(row.rawValue, row.decimals)
        : `${formatValue(row.rawValue, row.decimals)} / ${formatValue(row.usedValue, row.decimals)}`,
      unit: row.unit,
    })),
    modeValues: result.modeValues,
  };
  renderResults(baseTurnSnapshot);
}

function readInputs() {
  const number = (id) => Number.parseFloat(document.getElementById(id).value);
  const mode = document.getElementById("mode").value;
  return {
    mode,
    navaid: mode === "distance" ? "VOR" : document.getElementById("navaid").value,
    iasKt: number("ias"),
    altitudeFt: number("altitude"),
    stationElevationFt: number("stationElevation"),
    isaDeviationC: number("isaDeviation"),
    timeMinutes: number("timeMinutes"),
    dmeDistanceNm: number("dmeDistance"),
  };
}

function validateInputs(values) {
  const common = [values.iasKt, values.altitudeFt, values.stationElevationFt, values.isaDeviationC];
  if (!common.every(Number.isFinite)) {
    return { key: "invalidCommonInputs", fallback: "Enter valid values for IAS, altitude, station elevation, and ISA deviation." };
  }
  if (values.iasKt <= 0) {
    return { key: "invalidIas", fallback: "IAS must be greater than zero." };
  }
  if (values.altitudeFt <= values.stationElevationFt) {
    return { key: "invalidHeight", fallback: "Aircraft altitude must be above the navaid elevation." };
  }
  if (values.mode === "time" && (!Number.isFinite(values.timeMinutes) || values.timeMinutes <= 0)) {
    return { key: "invalidTime", fallback: "Outbound time must be greater than zero." };
  }
  if (values.mode === "distance" && (!Number.isFinite(values.dmeDistanceNm) || values.dmeDistanceNm <= 0)) {
    return { key: "invalidDistance", fallback: "DME distance must be greater than zero." };
  }

  const kFactor = calculateKFactor(values.altitudeFt, values.isaDeviationC);
  const tasKt = calculateTAS(values.iasKt, kFactor);
  const windKt = 2 * (values.altitudeFt / 1000) + 47;
  if (![kFactor, tasKt, windKt].every(Number.isFinite) || kFactor <= 0 || tasKt <= 0) {
    return { key: "invalidAtmosphere", fallback: "Altitude and ISA deviation are outside the valid TAS calculation range." };
  }
  if (Math.abs(windKt / tasKt) > 1) {
    return { key: "invalidWind", fallback: "Calculated wind must not exceed TAS for the drift angle calculation." };
  }
  return null;
}

function computeBaseTurn(values) {
  const kFactor = calculateKFactor(values.altitudeFt, values.isaDeviationC);
  const tasKt = calculateTAS(values.iasKt, kFactor);
  const speedNmPerSecond = tasKt / 3600;
  const rawRate = BASE_TURN_RATE_CONSTANT * Math.tan(BASE_TURN_BANK_ANGLE_DEG * DEG_TO_RAD) / (Math.PI * tasKt);
  const rate = Math.min(rawRate, BASE_TURN_MAX_RATE_DEG_S);
  const radiusNm = tasKt / (20 * Math.PI * rate);
  const altitudeThousandsFt = values.altitudeFt / 1000;
  const windKt = 2 * altitudeThousandsFt + 47;
  const windNmPerSecond = windKt / 3600;
  const windEffectNmPerDegree = windNmPerSecond / rate;
  const divergenceDeg = tasKt <= 170
    ? 36 / (values.mode === "time" ? values.timeMinutes : distanceTime(values.dmeDistanceNm, speedNmPerSecond))
    : 0.215 * tasKt / (values.mode === "time" ? values.timeMinutes : distanceTime(values.dmeDistanceNm, speedNmPerSecond));
  const coneAngleDeg = values.navaid === "NDB" ? 40 : 50;
  const heightAboveStationThousandsFt = (values.altitudeFt - values.stationElevationFt) / 1000;
  const coneRadiusNm = BASE_TURN_NM_FT_FACTOR * heightAboveStationThousandsFt * Math.tan(coneAngleDeg * DEG_TO_RAD);
  const timeMinutes = values.mode === "time" ? values.timeMinutes : distanceTime(values.dmeDistanceNm, speedNmPerSecond);
  const timeSeconds = 60 * timeMinutes;
  const outboundDistanceNm = speedNmPerSecond * timeSeconds;
  const dmeToleranceNm = values.mode === "distance" ? 0.25 + 0.0125 * values.dmeDistanceNm : null;
  const ab1 = values.mode === "time"
    ? (timeSeconds - 5) * (speedNmPerSecond - windNmPerSecond) - coneRadiusNm
    : values.dmeDistanceNm - dmeToleranceNm + 5 * (speedNmPerSecond - windNmPerSecond);
  const ab2 = values.mode === "time"
    ? (timeSeconds + 21) * (speedNmPerSecond + windNmPerSecond) + coneRadiusNm
    : values.dmeDistanceNm + dmeToleranceNm + 11 * (speedNmPerSecond + windNmPerSecond);
  const driftDeg = Math.asin(windKt / tasKt) / DEG_TO_RAD;
  const rows = [
    row(1, "K", "(171233 × √(288 + ΔISA − 0.00198a)) / (288 − 0.00198a)<sup>2.628</sup>", kFactor, "", 4),
    row(2, "V", "K × IAS", tasKt, "kt", 2),
    row(3, "v", "V / 3600", speedNmPerSecond, "NM/s", 4),
    { ...row(4, "Rraw / R", "Rraw = 3431 × tan 25° / (π × V); R = min(Rraw, 3)", rawRate, "°/s (raw / used)", 2), usedValue: rate },
    row(5, "r", "V / (20 × π × R)", radiusNm, "NM", 2),
    row(6, "h", "a / 1000", altitudeThousandsFt, "1000 ft", 0),
    row(7, "w", "2h + 47", windKt, "kt", 0),
    row(8, "w′", "w / 3600", windNmPerSecond, "NM/s", 4),
    row(9, "E", "w′ / R", windEffectNmPerDegree, "NM/°", 5),
    row(10, "φ", "TAS ≤ 170 kt: 36 / T; TAS > 170 kt: 0.215 × V / T", divergenceDeg, "°", 0),
    row(11, values.navaid === "NDB" ? "zN" : "zV", `0.164 × ((a − station) / 1000) × tan ${coneAngleDeg}°`, coneRadiusNm, "NM", 2),
    row(12, "t", "60 × T", timeSeconds, "s", 2),
    row(13, "L", "v × t", outboundDistanceNm, "NM", 2),
    row(14, "ab1 = ab3", values.mode === "time" ? "(t − 5) × (v − w′) − z" : "D − d1 + 5 × (v − w′)", ab1, "NM", 3),
    row(15, "ab2 = ab4", values.mode === "time" ? "(t + 21) × (v + w′) + z" : "D + d1 + 11 × (v + w′)", ab2, "NM", 3),
    row(16, "Wd = Wg", "50 × E", 50 * windEffectNmPerDegree, "NM", 2),
    row(17, "We = Wf = Wh", "100 × E", 100 * windEffectNmPerDegree, "NM", 2),
    row(18, "Wi", "190 × E", 190 * windEffectNmPerDegree, "NM", 2),
    row(19, "Wj", "235 × E", 235 * windEffectNmPerDegree, "NM", 2),
    row(20, "Drift d", "asin(w / V)", driftDeg, "°", 0),
    row(21, "N3l", "11 × v", 11 * speedNmPerSecond, "NM", 2),
    row(22, "Wl", "11 × w′", 11 * windNmPerSecond, "NM", 2),
    row(23, "Wm", "Wl + 50 × E", 11 * windNmPerSecond + 50 * windEffectNmPerDegree, "NM", 2),
    row(24, "Wn", "Wl + 100 × E", 11 * windNmPerSecond + 100 * windEffectNmPerDegree, "NM", 2),
  ];

  const modeValues = [
    [message("mode", "Mode"), values.mode === "time" ? message("timeMode", "Time") : message("distanceMode", "VOR/DME distance")],
    [message("navaid", "Navaid"), values.mode === "time" ? values.navaid : "VOR/DME"],
    [message("ias", "IAS"), `${values.iasKt} kt`],
    [message("altitude", "Aircraft altitude"), `${values.altitudeFt} ft`],
    [message("stationElevation", "Navaid elevation"), `${values.stationElevationFt} ft`],
    [message("isaDeviation", "ISA Deviation"), `${values.isaDeviationC} °C`],
  ];
  if (values.mode === "time") {
    modeValues.push([message("outboundTime", "Outbound time (T)"), `${values.timeMinutes} min (${timeSeconds.toFixed(2)} s)`]);
  } else {
    modeValues.push([message("dmeDistance", "DME distance (D)"), `${values.dmeDistanceNm} NM`]);
    modeValues.push([message("calculatedTime", "Calculated outbound time (T)"), `${timeMinutes.toFixed(4)} min`]);
    modeValues.push([message("dmeTolerance", "DME tolerance (d1)"), `${dmeToleranceNm.toFixed(4)} NM`]);
  }
  return { rows, modeValues };
}

function distanceTime(distanceNm, speedNmPerSecond) {
  return distanceNm / speedNmPerSecond / 60;
}

function row(line, parameter, formula, rawValue, unit, decimals) {
  return { line, parameter, formula, rawValue, unit, decimals };
}

function renderResults(snapshot) {
  const details = document.getElementById("modeResults");
  details.innerHTML = snapshot.modeValues.map(([label, value]) => `
    <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-600 dark:bg-gray-700">
      <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-300">${escapeHtml(label)}</dt>
      <dd class="mt-1 font-semibold text-gray-900 dark:text-white">${escapeHtml(value)}</dd>
    </div>`).join("");

  const groups = [
    { key: "performanceGroup", rows: snapshot.rows.slice(0, 6) },
    { key: "windGroup", rows: snapshot.rows.slice(6, 9) },
    { key: "geometryGroup", rows: snapshot.rows.slice(9, 15) },
    { key: "toleranceGroup", rows: snapshot.rows.slice(15) },
  ];
  const resultsTable = document.getElementById("resultTable");
  resultsTable.querySelectorAll("tbody").forEach((tbody) => tbody.remove());
  resultsTable.insertAdjacentHTML("beforeend", groups.map(({ key, rows }) => `
    <tbody>
      <tr class="base-turn-group-row">
        <th scope="rowgroup" colspan="3">${escapeHtml(message(key, ""))}</th>
      </tr>
      ${rows.map((item) => `
        <tr class="base-turn-data-row text-gray-800 dark:text-gray-100">
          <th scope="row" class="whitespace-nowrap px-3 py-2 font-medium">${item.line}</th>
          <td class="whitespace-nowrap px-3 py-2">${escapeHtml(item.parameter)}</td>
          <td class="base-turn-result whitespace-nowrap px-3 py-2 font-mono tabular-nums">
            <span>${item.value}</span>${item.unit ? `<span class="base-turn-unit">${escapeHtml(item.unit)}</span>` : ""}
          </td>
        </tr>`).join("")}
    </tbody>`).join(""));
  document.getElementById("results").classList.remove("hidden");
}

function formatValue(value, decimals) {
  return value.toFixed(decimals);
}

function parametersForSave() {
  return {
    mode: document.getElementById("mode").value,
    navaid: document.getElementById("navaid").value,
    iasKt: document.getElementById("ias").value,
    altitudeFt: document.getElementById("altitude").value,
    stationElevationFt: document.getElementById("stationElevation").value,
    isaDeviationC: document.getElementById("isaDeviation").value,
    timeMinutes: document.getElementById("timeMinutes").value,
    dmeDistanceNm: document.getElementById("dmeDistance").value,
  };
}

function saveParameters() {
  const blob = new Blob([JSON.stringify(parametersForSave(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${new Date().toISOString().replace(/[:.]/g, "-")}_base_turn.json`;
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
      if (!data || !["time", "distance"].includes(data.mode) || !["NDB", "VOR"].includes(data.navaid)) throw new Error("Invalid parameters");
      const fields = {
        ias: "iasKt",
        altitude: "altitudeFt",
        stationElevation: "stationElevationFt",
        isaDeviation: "isaDeviationC",
        timeMinutes: "timeMinutes",
        dmeDistance: "dmeDistanceNm",
      };
      for (const [id, key] of Object.entries(fields)) {
        if (data[key] === undefined || data[key] === null || data[key] === "") continue;
        if (!Number.isFinite(Number(data[key]))) throw new Error("Invalid numeric parameter");
      }
      document.getElementById("mode").value = data.mode;
      document.getElementById("navaid").value = data.navaid;
      for (const [id, key] of Object.entries(fields)) {
        if (data[key] !== undefined && data[key] !== null) document.getElementById(id).value = data[key];
      }
      updateModeInputs();
      showToast(message("loaded", "Parameters loaded."), "success");
    } catch {
      showToast(message("invalidJson", "Invalid or unsupported parameter file."), "error");
    }
  };
  reader.readAsText(file);
}

function copyResultsToClipboard() {
  if (!baseTurnSnapshot) return;
  const headings = [message("line", "Line"), message("parameter", "Parameter"), message("value", "Value"), message("unit", "Unit")];
  const inputRows = baseTurnSnapshot.modeValues;
  const resultRows = baseTurnSnapshot.rows.map((item) => [String(item.line), item.parameter, item.value, item.unit]);
  const allRows = [
    [message("inputs", "Inputs"), "", "", ""],
    ...inputRows.map(([label, value]) => ["", label, value, ""]),
    ["", "", "", ""],
    headings,
    ...resultRows,
  ];
  const htmlRows = allRows.map((values, index) => {
    const cells = values.map((value) => {
      const tag = index === 0 || index === inputRows.length + 2 ? "th" : "td";
      return `<${tag} style="padding:7px;border:1px solid #cbd5e1;text-align:left">${escapeHtml(value)}</${tag}>`;
    }).join("");
    return `<tr${index === 0 || index === inputRows.length + 2 ? ' style="background:#0c2240;color:#ffffff"' : ""}>${cells}</tr>`;
  }).join("");
  const html = `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:10pt">${htmlRows}</table>`;
  const plain = allRows.map((values) => values.join("\t")).join("\n");
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

function message(key, fallback) {
  return window.I18N ? I18N.get(`baseTurn.${key}`, fallback) : fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
