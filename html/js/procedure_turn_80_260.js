// ICAO Doc 8168, Table I-4-3-App C-3 (80°–260° procedure turn).
const PROCEDURE_TURN_80260_CALCULATOR = "procedure-turn-80-260";

let procedureTurn80260Snapshot = null;
let procedureTurn80260UnitSystem = "non-si";

document.addEventListener("DOMContentLoaded", () => {
  checkDarkMode();
  if (window.I18N) {
    I18N.init({ defaultLang: "en", supported: ["en", "es"], path: "../i18n" }).catch(console.error);
  }

  const form = document.getElementById("procedureTurn80260Form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculateProcedureTurn80260Results();
  });
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", () => {
    document.getElementById("loadFile").click();
  });
  document.getElementById("loadFile").addEventListener("change", loadParameters);
  document.getElementById("btnCopy").addEventListener("click", copyResultsToClipboard);
  document.getElementById("btnNonSi").addEventListener("click", () => changeUnitSystem("non-si"));
  document.getElementById("btnSi").addEventListener("click", () => changeUnitSystem("si"));
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

function readInputs() {
  const number = (id) => {
    const value = document.getElementById(id).value.trim();
    return value === "" ? Number.NaN : Number(value);
  };
  const isSi = procedureTurn80260UnitSystem === "si";
  return {
    iasKt: number("ias") / (isSi ? 1.852 : 1),
    altitudeFt: number("altitude") / (isSi ? 0.3048 : 1),
    isaDeviationC: number("isaDeviation"),
    unitSystem: procedureTurn80260UnitSystem,
  };
}

function applyUnitSystem(unitSystem) {
  procedureTurn80260UnitSystem = unitSystem;
  const isSi = unitSystem === "si";
  document.getElementById("btnNonSi").setAttribute("aria-pressed", String(!isSi));
  document.getElementById("btnSi").setAttribute("aria-pressed", String(isSi));
  document.getElementById("iasUnit").textContent = isSi ? "km/h" : "kt";
  document.getElementById("altitudeUnit").textContent = isSi ? "m" : "ft";
}

function displayInputValues(inputs) {
  const isSi = procedureTurn80260UnitSystem === "si";
  const displayNumber = (value) => Number.isFinite(value) ? String(Number(value.toPrecision(12))) : "";
  document.getElementById("ias").value = displayNumber(inputs.iasKt * (isSi ? 1.852 : 1));
  document.getElementById("altitude").value = displayNumber(inputs.altitudeFt * (isSi ? 0.3048 : 1));
}

function changeUnitSystem(unitSystem) {
  if (unitSystem === procedureTurn80260UnitSystem) return;
  const inputs = readInputs();
  const hadResults = procedureTurn80260Snapshot !== null;
  applyUnitSystem(unitSystem);
  displayInputValues(inputs);
  invalidateResults();
  if (hadResults) calculateProcedureTurn80260Results();
}

function procedureTurn80260KFactor(inputs) {
  if (inputs.unitSystem !== "si") {
    return calculateKFactor(inputs.altitudeFt, inputs.isaDeviationC);
  }
  const standardTemperature = 288 - 0.0065 * inputs.altitudeFt * 0.3048;
  return 171233 * Math.sqrt(standardTemperature + inputs.isaDeviationC)
    / Math.pow(standardTemperature, 2.628);
}

function validateInputs(inputs) {
  if (![inputs.iasKt, inputs.altitudeFt, inputs.isaDeviationC].every(Number.isFinite)
    || !["non-si", "si"].includes(inputs.unitSystem)) {
    return { key: "invalidInputs", fallback: "Enter valid numeric values for all inputs." };
  }
  if (inputs.iasKt <= 0) {
    return { key: "invalidIas", fallback: "IAS must be greater than zero." };
  }
  if (inputs.altitudeFt < 0) {
    return { key: "invalidAltitude", fallback: "Altitude must be zero or greater." };
  }
  const kFactor = procedureTurn80260KFactor(inputs);
  if (!Number.isFinite(kFactor) || kFactor <= 0) {
    return { key: "invalidAtmosphere", fallback: "These altitude and ISA inputs are outside the valid TAS calculation range." };
  }
  if (!computeProcedureTurn80260(inputs).rows.every((item) => Number.isFinite(item.rawValue))) {
    return { key: "invalidCalculation", fallback: "These inputs produce a non-finite result. Check the entered values." };
  }
  return null;
}

function computeProcedureTurn80260(inputs) {
  const isSi = inputs.unitSystem === "si";
  const distanceUnit = isSi ? "km" : "NM";
  const speedUnit = isSi ? "km/h" : "kt";
  const kFactor = procedureTurn80260KFactor(inputs);
  const tas = calculateTAS(inputs.iasKt * (isSi ? 1.852 : 1), kFactor);
  const v = tas / 3600;
  const rawRateDegS = (isSi ? 943.27 : 509.26) / tas;
  const rateDegS = Math.min(rawRateDegS, 3);
  const radius = tas / (62.83 * rateDegS);
  const h = inputs.altitudeFt * (isSi ? 0.3048 : 1) / 1000;
  const wind = isSi ? 12 * h + 87 : 2 * h + 47;
  const windPerSecond = wind / 3600;
  const e = windPerSecond / rateDegS;
  const row = (line, parameter, rawValue, unit, decimals, compact = false) => ({
    line, parameter, rawValue, unit, decimals, compact,
  });

  // Source order is intentional: Wj uses 265 E, while Wk uses 255 E.
  const rows = [
    row(1, "K", kFactor, "", 4),
    row(2, "V", tas, speedUnit, 2),
    row(3, "v", v, `${distanceUnit}/s`, 4),
    row(4, "R", rateDegS, "°/s", 2, true),
    row(5, "r", radius, distanceUnit, 2),
    row(6, "h", h, isSi ? "1000 m" : "1000 ft", isSi ? 3 : 2, true),
    row(7, "w", wind, speedUnit, 2, true),
    row(8, "w′", windPerSecond, `${distanceUnit}/s`, 4),
    row(9, "E", e, `${distanceUnit}/°`, 5),
    row(10, "ab", 5 * v, distanceUnit, 2),
    row(11, "dₑ = dₑ₁ = dₑ₂", 10 * v, distanceUnit, 2),
    row(12, "Wₑ₂", 15 * windPerSecond + 85 * e, distanceUnit, 2),
    row(13, "Wg", 15 * windPerSecond + 130 * e, distanceUnit, 2),
    row(14, "Wh", 15 * windPerSecond + 175 * e, distanceUnit, 2),
    row(15, "Wi", 15 * windPerSecond + 220 * e, distanceUnit, 2),
    row(16, "Wj", 15 * windPerSecond + 265 * e, distanceUnit, 2),
    row(17, "Wk", 15 * windPerSecond + 255 * e, distanceUnit, 2),
    row(18, "Wl", 15 * windPerSecond + 300 * e, distanceUnit, 2),
    row(19, "Wm", 15 * windPerSecond + 345 * e, distanceUnit, 2),
  ];
  return { rows, rawRateDegS, rateDegS };
}

function calculateProcedureTurn80260Results() {
  const inputs = readInputs();
  const error = validateInputs(inputs);
  if (error) {
    showToast(message(error.key, error.fallback), "error");
    invalidateResults();
    return;
  }
  const isSi = inputs.unitSystem === "si";
  const result = computeProcedureTurn80260(inputs);
  procedureTurn80260Snapshot = {
    inputValues: [
      [message("units", "Units"), isSi ? "SI" : "NON-SI"],
      [message("ias", "IAS"), `${formatValue(inputs.iasKt * (isSi ? 1.852 : 1), 1, true)} ${isSi ? "km/h" : "kt"}`],
      [message("altitude", "Altitude"), `${formatValue(inputs.altitudeFt * (isSi ? 0.3048 : 1), 1, true)} ${isSi ? "m" : "ft"}`],
      [message("isaDeviation", "ISA Deviation"), `ISA ${inputs.isaDeviationC >= 0 ? "+" : ""}${formatValue(inputs.isaDeviationC, 1, true)} °C`],
    ],
    rows: result.rows.map((item) => ({
      line: item.line,
      parameter: item.parameter,
      value: formatValue(item.rawValue, item.decimals, item.compact),
      unit: item.unit,
    })),
  };
  renderResults(procedureTurn80260Snapshot);
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
    { key: "geometryGroup", rows: snapshot.rows.slice(9, 11) },
    { key: "toleranceGroup", rows: snapshot.rows.slice(11) },
  ];
  const table = document.getElementById("resultTable");
  table.querySelectorAll("tbody").forEach((tbody) => tbody.remove());
  table.insertAdjacentHTML("beforeend", groups.map(({ key, rows }) => `
    <tbody>
      <tr class="procedure-turn-80260-group-row">
        <th scope="rowgroup" colspan="3">${escapeHtml(message(key, ""))}</th>
      </tr>
      ${rows.map((item) => `
        <tr class="procedure-turn-80260-data-row text-gray-800 dark:text-gray-100">
          <th scope="row" class="whitespace-nowrap px-3 py-2 font-medium">${item.line}</th>
          <td class="whitespace-nowrap px-3 py-2">${escapeHtml(item.parameter)}</td>
          <td class="procedure-turn-80260-result whitespace-nowrap px-3 py-2 font-mono tabular-nums">
            <span>${item.value}</span>${item.unit ? `<span class="procedure-turn-80260-unit">${escapeHtml(item.unit)}</span>` : ""}
          </td>
        </tr>`).join("")}
    </tbody>`).join(""));
  document.getElementById("results").classList.remove("hidden");
}

function invalidateResults() {
  procedureTurn80260Snapshot = null;
  document.getElementById("results").classList.add("hidden");
}

function saveParameters() {
  const inputs = readInputs();
  const error = validateInputs(inputs);
  if (error) {
    showToast(message(error.key, error.fallback), "error");
    return;
  }
  const data = {
    calculator: PROCEDURE_TURN_80260_CALCULATOR,
    schemaVersion: 1,
    unitSystem: inputs.unitSystem,
    parameters: {
      iasKt: inputs.iasKt,
      altitudeFt: inputs.altitudeFt,
      isaDeviationC: inputs.isaDeviationC,
    },
  };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  link.download = `${new Date().toISOString().replace(/[:.]/g, "-")}_procedure_turn_80_260.json`;
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
      const parameters = data?.parameters;
      if (data?.calculator !== PROCEDURE_TURN_80260_CALCULATOR
        || data.schemaVersion !== 1
        || !["non-si", "si"].includes(data.unitSystem)
        || !parameters
        || ![parameters.iasKt, parameters.altitudeFt, parameters.isaDeviationC].every(Number.isFinite)) {
        throw new Error("Invalid parameters");
      }
      const error = validateInputs({ ...parameters, unitSystem: data.unitSystem });
      if (error) {
        showToast(message(error.key, error.fallback), "error");
        return;
      }
      applyUnitSystem(data.unitSystem);
      displayInputValues(parameters);
      document.getElementById("isaDeviation").value = parameters.isaDeviationC;
      invalidateResults();
      showToast(message("loaded", "Parameters loaded."), "success");
    } catch {
      showToast(message("invalidJson", "Invalid or unsupported parameter file."), "error");
    }
  };
  reader.onerror = () => showToast(message("invalidJson", "Invalid or unsupported parameter file."), "error");
  reader.readAsText(file);
}

async function copyResultsToClipboard() {
  if (!procedureTurn80260Snapshot) return;
  const snapshot = procedureTurn80260Snapshot;
  const allRows = [
    [message("inputs", "Inputs"), "", ""],
    ...snapshot.inputValues.map(([label, value]) => ["", label, value]),
    ["", "", ""],
    [message("line", "Line"), message("parameter", "Parameter"), message("value", "Value")],
    ...snapshot.rows.map((item) => [String(item.line), item.parameter, `${item.value}${item.unit ? ` ${item.unit}` : ""}`]),
  ];
  const headingIndex = snapshot.inputValues.length + 2;
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
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    showToast(message("copied", "Results copied to clipboard."), "success");
  } catch (error) {
    console.error("Copy failed:", error);
    showToast(message("copyFailed", "Copy failed. Check browser permissions."), "error");
  }
}

function formatValue(value, decimals, compact = false) {
  const formatted = value.toFixed(decimals);
  return compact && formatted.includes(".")
    ? formatted.replace(/0+$/, "").replace(/\.$/, "")
    : formatted;
}

function message(key, fallback) {
  return window.I18N ? I18N.get(`procedureTurn80260.${key}`, fallback) : fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
