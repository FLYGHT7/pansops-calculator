const HOLDING_TURN_RATE_CONSTANT = 3431;
const HOLDING_RADIUS_CONSTANT = 62.83;
const HOLDING_BANK_ANGLE_DEG = 25;
const HOLDING_MAX_RATE_DEG_S = 3;
const HOLDING_RAD = Math.PI / 180;

let holdingSnapshot = null;

document.addEventListener("DOMContentLoaded", () => {
  checkDarkMode();
  initializeI18n();

  const form = document.getElementById("holdingForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculateHoldingTable();
  });
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", () => {
    document.getElementById("loadFile").click();
  });
  document.getElementById("loadFile").addEventListener("change", loadParameters);
  document.getElementById("btnCopy").addEventListener("click", copyResultsToClipboard);

  form.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", invalidateResults);
    input.addEventListener("change", invalidateResults);
  });
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

function invalidateResults() {
  holdingSnapshot = null;
  document.getElementById("results").classList.add("hidden");
}

function readInputs() {
  const number = (id) => Number(document.getElementById(id).value);
  return {
    iasKt: number("ias"),
    altitudeFt: number("altitude"),
    timeMinutes: number("legTime"),
    isaDeviationC: number("isaDeviation"),
  };
}

function validateInputs(inputs) {
  if (!Object.values(inputs).every(Number.isFinite)) {
    return { key: "invalidInputs", fallback: "Enter valid numeric values for all inputs." };
  }
  if (inputs.iasKt <= 0) {
    return { key: "invalidIas", fallback: "IAS must be greater than zero." };
  }
  if (inputs.altitudeFt < 0) {
    return { key: "invalidAltitude", fallback: "Altitude must be zero or greater." };
  }
  if (inputs.timeMinutes <= 0) {
    return { key: "invalidTime", fallback: "Outbound leg time must be greater than zero." };
  }
  const kFactor = calculateKFactor(inputs.altitudeFt, inputs.isaDeviationC);
  const tasKt = calculateTAS(inputs.iasKt, kFactor);
  if (![kFactor, tasKt].every(Number.isFinite) || kFactor <= 0 || tasKt <= 0) {
    return { key: "invalidAtmosphere", fallback: "These altitude and ISA inputs are outside the valid TAS calculation range." };
  }
  return null;
}

function calculateHoldingTable() {
  const inputs = readInputs();
  const error = validateInputs(inputs);
  if (error) {
    showToast(message(error.key, error.fallback), "error");
    invalidateResults();
    return;
  }

  const result = computeHoldingTable(inputs);
  if (!result.rows.every((item) => Number.isFinite(item.rawValue))) {
    showToast(message("invalidCalculation", "These inputs produce a non-finite result. Check the entered values."), "error");
    invalidateResults();
    return;
  }

  holdingSnapshot = {
    inputs,
    inputValues: [
      [message("ias", "IAS"), `${formatValue(inputs.iasKt, 1, true)} kt`],
      [message("altitude", "Altitude"), `${formatValue(inputs.altitudeFt, 1, true)} ft`],
      [message("legTime", "Outbound leg time (T)"), `${formatValue(inputs.timeMinutes, 2, true)} min`],
      [message("isaDeviation", "ISA Deviation"), `ISA ${inputs.isaDeviationC >= 0 ? "+" : ""}${formatValue(inputs.isaDeviationC, 1, true)} °C`],
    ],
    rows: result.rows.map((item) => ({
      line: item.line,
      parameter: item.parameter,
      value: formatValue(item.rawValue, item.decimals, item.compact),
      rawValue: item.rawValue,
      unit: item.unit,
    })),
  };
  renderResults(holdingSnapshot);
}

function computeHoldingTable(inputs) {
  const kFactor = calculateKFactor(inputs.altitudeFt, inputs.isaDeviationC);
  const tasKt = calculateTAS(inputs.iasKt, kFactor);
  const speedNmPerSecond = tasKt / 3600;
  const rawRateDegS = (HOLDING_TURN_RATE_CONSTANT * Math.tan(HOLDING_BANK_ANGLE_DEG * HOLDING_RAD))
    / (Math.PI * tasKt);
  const rateDegS = Math.min(rawRateDegS, HOLDING_MAX_RATE_DEG_S);
  const radiusNm = tasKt / (HOLDING_RADIUS_CONSTANT * rateDegS);
  const altitudeThousandsFt = inputs.altitudeFt / 1000;
  const windKt = 2 * altitudeThousandsFt + 47;
  const windNmPerSecond = windKt / 3600;
  const e45Nm = (45 * windNmPerSecond) / rateDegS;
  const timeSeconds = 60 * inputs.timeMinutes;

  const abNm = 5 * speedNmPerSecond;
  const acNm = 11 * speedNmPerSecond;
  const g1Nm = (timeSeconds - 5) * speedNmPerSecond;
  const g2Nm = (timeSeconds + 21) * speedNmPerSecond;
  const wbNm = 5 * windNmPerSecond;
  const wcNm = 11 * windNmPerSecond;
  const w1Nm = (timeSeconds + 6) * windNmPerSecond + 4 * e45Nm;
  const w2Nm = w1Nm + 14 * windNmPerSecond;
  const xeNm = 2 * radiusNm + (timeSeconds + 15) * speedNmPerSecond
    + (timeSeconds + 26 + 195 / rateDegS) * windNmPerSecond;
  const yeNm = 11 * speedNmPerSecond * Math.cos(20 * HOLDING_RAD)
    + radiusNm * (1 + Math.sin(20 * HOLDING_RAD))
    + (timeSeconds + 15) * speedNmPerSecond * Math.tan(5 * HOLDING_RAD)
    + (timeSeconds + 26 + 125 / rateDegS) * windNmPerSecond;

  const row = (line, parameter, rawValue, unit, decimals, compact = false) => ({
    line, parameter, rawValue, unit, decimals, compact,
  });
  const rows = [
    row(1, "K", kFactor, "", 4),
    row(2, "V", tasKt, "kt", 2),
    row(3, "v", speedNmPerSecond, "NM/s", 5),
    row(4, "R", rateDegS, "°/s", 2),
    row(5, "r", radiusNm, "NM", 2),
    row(6, "h", altitudeThousandsFt, "1000 ft", 2, true),
    row(7, "w", windKt, "kt", 0, true),
    row(8, "w′", windNmPerSecond, "NM/s", 4),
    row(9, "E₄₅", e45Nm, "NM", 3),
    row(10, "t", timeSeconds, "s", 0, true),
    row(11, "L", speedNmPerSecond * timeSeconds, "NM", 2),
    row(12, "ab", abNm, "NM", 2),
    row(13, "ac", acNm, "NM", 2),
    row(14, "gᵢ₁ = gᵢ₃", g1Nm, "NM", 2),
    row(15, "gᵢ₂ = gᵢ₄", g2Nm, "NM", 2),
    row(16, "Wb", wbNm, "NM", 2),
    row(17, "Wc", wcNm, "NM", 2),
    row(18, "Wd", wcNm + e45Nm, "NM", 2),
    row(19, "We", wcNm + 2 * e45Nm, "NM", 2),
    row(20, "Wf", wcNm + 3 * e45Nm, "NM", 2),
    row(21, "Wg", wcNm + 4 * e45Nm, "NM", 2),
    row(22, "Wh", wbNm + 4 * e45Nm, "NM", 2),
    row(23, "Wo", wbNm + 5 * e45Nm, "NM", 2),
    row(24, "Wp", wbNm + 6 * e45Nm, "NM", 2),
    row(25, "Wᵢ₁ = Wᵢ₃", w1Nm, "NM", 2),
    row(26, "Wᵢ₂ = Wᵢ₄", w2Nm, "NM", 2),
    row(27, "Wj", w2Nm + e45Nm, "NM", 2),
    row(28, "Wk = Wl", w2Nm + 2 * e45Nm, "NM", 2),
    row(29, "Wm", w2Nm + 3 * e45Nm, "NM", 2),
    row(30, "Wₙ₃", w1Nm + 4 * e45Nm, "NM", 2),
    row(31, "Wₙ₄", w2Nm + 4 * e45Nm, "NM", 2),
    row(32, "XE", xeNm, "NM", 2),
    row(33, "YE", yeNm, "NM", 2),
  ];
  return { rows, rawRateDegS, rateDegS, radiusNm };
}

function renderResults(snapshot) {
  document.getElementById("inputSummary").innerHTML = snapshot.inputValues.map(([label, value]) => `
    <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-600 dark:bg-gray-700">
      <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-300">${escapeHtml(label)}</dt>
      <dd class="mt-1 font-semibold text-gray-900 dark:text-white">${escapeHtml(value)}</dd>
    </div>`).join("");

  const groups = [
    { key: "performanceGroup", rows: snapshot.rows.slice(0, 6) },
    { key: "windGroup", rows: snapshot.rows.slice(6, 9) },
    { key: "geometryGroup", rows: snapshot.rows.slice(9, 15) },
    { key: "toleranceGroup", rows: snapshot.rows.slice(15, 31) },
    { key: "entryOffsetsGroup", rows: snapshot.rows.slice(31) },
  ];
  const table = document.getElementById("resultTable");
  table.querySelectorAll("tbody").forEach((tbody) => tbody.remove());
  table.insertAdjacentHTML("beforeend", groups.map(({ key, rows }) => `
    <tbody>
      <tr class="holding-group-row">
        <th scope="rowgroup" colspan="3">${escapeHtml(message(key, ""))}</th>
      </tr>
      ${rows.map((item) => `
        <tr class="holding-data-row text-gray-800 dark:text-gray-100">
          <th scope="row" class="whitespace-nowrap px-3 py-2 font-medium">${item.line}</th>
          <td class="whitespace-nowrap px-3 py-2">${escapeHtml(item.parameter)}</td>
          <td class="holding-result whitespace-nowrap px-3 py-2 font-mono tabular-nums">
            <span>${item.value}</span>${item.unit ? `<span class="holding-unit">${escapeHtml(item.unit)}</span>` : ""}
          </td>
        </tr>`).join("")}
    </tbody>`).join(""));
  document.getElementById("results").classList.remove("hidden");
}

function formatValue(value, decimals, compact = false) {
  const formatted = value.toFixed(decimals);
  return compact && formatted.includes(".")
    ? formatted.replace(/0+$/, "").replace(/\.$/, "")
    : formatted;
}

function parameterValues() {
  return {
    iasKt: document.getElementById("ias").value,
    altitudeFt: document.getElementById("altitude").value,
    timeMinutes: document.getElementById("legTime").value,
    isaDeviationC: document.getElementById("isaDeviation").value,
  };
}

function saveParameters() {
  const data = { schemaVersion: 1, parameters: parameterValues() };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  link.download = `${new Date().toISOString().replace(/[:.]/g, "-")}_holding_racetrack.json`;
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
      const inputs = data && data.schemaVersion === 1 && data.parameters;
      const keys = ["iasKt", "altitudeFt", "timeMinutes", "isaDeviationC"];
      if (!inputs || !keys.every((key) => Object.hasOwn(inputs, key) && Number.isFinite(Number(inputs[key])))) {
        throw new Error("Invalid parameters");
      }
      document.getElementById("ias").value = inputs.iasKt;
      document.getElementById("altitude").value = inputs.altitudeFt;
      document.getElementById("legTime").value = inputs.timeMinutes;
      document.getElementById("isaDeviation").value = inputs.isaDeviationC;
      invalidateResults();
      showToast(message("loaded", "Parameters loaded."), "success");
    } catch {
      showToast(message("invalidJson", "Invalid or unsupported parameter file."), "error");
    }
  };
  reader.readAsText(file);
}

function copyResultsToClipboard() {
  if (!holdingSnapshot) return;
  const headers = [message("line", "Line"), message("parameter", "Parameter"), message("value", "Value")];
  const dataRows = holdingSnapshot.rows.map((item) => [
    String(item.line),
    item.parameter,
    `${item.value}${item.unit ? ` ${item.unit}` : ""}`,
  ]);
  const allRows = [
    [message("inputs", "Inputs"), "", ""],
    ...holdingSnapshot.inputValues.map(([label, value]) => ["", label, value]),
    ["", "", ""],
    headers,
    ...dataRows,
  ];
  const headingIndex = holdingSnapshot.inputValues.length + 2;
  const htmlRows = allRows.map((values, index) => {
    const heading = index === 0 || index === headingIndex;
    const cells = values.map((value) => {
      const tag = heading ? "th" : "td";
      return `<${tag} style="padding:7px;border:1px solid #cbd5e1;text-align:left">${escapeHtml(value)}</${tag}>`;
    }).join("");
    return `<tr${heading ? ' style="background:#0c2240;color:#ffffff"' : ""}>${cells}</tr>`;
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
  return window.I18N ? I18N.get(`holding.${key}`, fallback) : fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
