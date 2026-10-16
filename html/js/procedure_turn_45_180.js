const PROCEDURE_TURN_RATE_CONSTANT = 509.26;
const PROCEDURE_TURN_SI_RATE_CONSTANT = 943.27;
const PROCEDURE_TURN_RADIUS_CONSTANT = 62.83;
const PROCEDURE_TURN_MAX_RATE_DEG_S = 3;
const PROCEDURE_TURN_SECONDS_BY_CATEGORY = Object.freeze({
  A: 60,
  B: 60,
  C: 75,
  D: 75,
  E: 75,
});

let procedureTurnSnapshot = null;
let procedureTurnUnitSystem = "non-si";

document.addEventListener("DOMContentLoaded", () => {
  checkDarkMode();
  initializeI18n();

  const form = document.getElementById("procedureTurnForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    calculateProcedureTurnResults();
  });
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", () => {
    document.getElementById("loadFile").click();
  });
  document.getElementById("loadFile").addEventListener("change", loadParameters);
  document.getElementById("btnCopy").addEventListener("click", copyResultsToClipboard);
  document.getElementById("btnNonSi").addEventListener("click", () => changeUnitSystem("non-si"));
  document.getElementById("btnSi").addEventListener("click", () => changeUnitSystem("si"));

  form.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", handleInputChange);
    input.addEventListener("change", handleInputChange);
  });

  updateDerivedTime();
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

function readInputs() {
  const number = (id) => {
    const rawValue = document.getElementById(id).value.trim();
    return rawValue === "" ? Number.NaN : Number(rawValue);
  };
  const isSi = procedureTurnUnitSystem === "si";
  return {
    iasKt: isSi ? number("ias") / 1.852 : number("ias"),
    altitudeFt: isSi ? number("altitude") / 0.3048 : number("altitude"),
    isaDeviationC: number("isaDeviation"),
    category: document.getElementById("category").value,
    unitSystem: procedureTurnUnitSystem,
  };
}

function applyUnitSystem(unitSystem) {
  procedureTurnUnitSystem = unitSystem;
  const isSi = unitSystem === "si";
  document.getElementById("btnNonSi").setAttribute("aria-pressed", String(!isSi));
  document.getElementById("btnSi").setAttribute("aria-pressed", String(isSi));
  document.getElementById("iasUnit").textContent = isSi ? "km/h" : "kt";
  document.getElementById("altitudeUnit").textContent = isSi ? "m" : "ft";
}

function displayInputValues(inputs) {
  const isSi = procedureTurnUnitSystem === "si";
  const displayNumber = (value) => Number.isFinite(value) ? String(Number(value.toPrecision(12))) : "";
  document.getElementById("ias").value = displayNumber(inputs.iasKt * (isSi ? 1.852 : 1));
  document.getElementById("altitude").value = displayNumber(inputs.altitudeFt * (isSi ? 0.3048 : 1));
}

function changeUnitSystem(unitSystem) {
  if (unitSystem === procedureTurnUnitSystem) return;
  const inputs = readInputs();
  const hadResults = procedureTurnSnapshot !== null;
  applyUnitSystem(unitSystem);
  displayInputValues(inputs);
  invalidateResults();
  if (hadResults) calculateProcedureTurnResults();
}

function procedureTurnKFactor(inputs) {
  if (inputs.unitSystem !== "si") {
    return calculateKFactor(inputs.altitudeFt, inputs.isaDeviationC);
  }
  // Table C-2 uses the SI lapse coefficient with altitude in metres.
  const standardTemperature = 288 - 0.0065 * inputs.altitudeFt * 0.3048;
  return 171233 * Math.sqrt(standardTemperature + inputs.isaDeviationC)
    / Math.pow(standardTemperature, 2.628);
}

function timeSecondsForCategory(category) {
  return PROCEDURE_TURN_SECONDS_BY_CATEGORY[category] ?? Number.NaN;
}

function validateInputs(inputs) {
  const numericValues = [inputs.iasKt, inputs.altitudeFt, inputs.isaDeviationC];
  if (!numericValues.every(Number.isFinite)) {
    return { key: "invalidInputs", fallback: "Enter valid numeric values for all inputs." };
  }
  if (inputs.iasKt <= 0) {
    return { key: "invalidIas", fallback: "IAS must be greater than zero." };
  }
  if (inputs.altitudeFt < 0) {
    return { key: "invalidAltitude", fallback: "Altitude must be zero or greater." };
  }
  if (!Object.hasOwn(PROCEDURE_TURN_SECONDS_BY_CATEGORY, inputs.category)) {
    return { key: "invalidCategory", fallback: "Select an aircraft category from A to E." };
  }

  const kFactor = procedureTurnKFactor(inputs);
  const tasKt = calculateTAS(inputs.iasKt, kFactor);
  if (![kFactor, tasKt].every(Number.isFinite) || kFactor <= 0 || tasKt <= 0) {
    return { key: "invalidAtmosphere", fallback: "These altitude and ISA inputs are outside the valid TAS calculation range." };
  }
  const result = computeProcedureTurn(inputs);
  if (!result.rows.every((item) => Number.isFinite(item.rawValue))) {
    return { key: "invalidCalculation", fallback: "These inputs produce a non-finite result. Check the entered values." };
  }
  return null;
}

function calculateProcedureTurnResults() {
  const inputs = readInputs();
  const error = validateInputs(inputs);
  if (error) {
    showToast(message(error.key, error.fallback), "error");
    invalidateResults();
    return;
  }

  const result = computeProcedureTurn(inputs);
  const isSi = inputs.unitSystem === "si";
  procedureTurnSnapshot = {
    inputs,
    inputValues: [
      [message("units", "Units"), isSi ? "SI" : "NON-SI"],
      [message("ias", "IAS"), `${formatValue(inputs.iasKt * (isSi ? 1.852 : 1), 1, true)} ${isSi ? "km/h" : "kt"}`],
      [message("altitude", "Altitude"), `${formatValue(inputs.altitudeFt * (isSi ? 0.3048 : 1), 1, true)} ${isSi ? "m" : "ft"}`],
      [message("isaDeviation", "ISA Deviation"), `ISA ${inputs.isaDeviationC >= 0 ? "+" : ""}${formatValue(inputs.isaDeviationC, 1, true)} °C`],
      [message("category", "Aircraft category"), inputs.category],
      [message("time", "Procedure turn time (T)"), formatTime(result.timeSeconds)],
    ],
    rows: result.rows.map((item) => ({
      line: item.line,
      parameter: item.parameter,
      value: formatValue(item.rawValue, item.decimals, item.compact),
      rawValue: item.rawValue,
      unit: item.unit,
    })),
  };
  renderResults(procedureTurnSnapshot);
  updateDerivedTime();
}

function computeProcedureTurn(inputs) {
  const isSi = inputs.unitSystem === "si";
  const distanceUnit = isSi ? "km" : "NM";
  const speedUnit = isSi ? "km/h" : "kt";
  const kFactor = procedureTurnKFactor(inputs);
  const tas = calculateTAS(inputs.iasKt * (isSi ? 1.852 : 1), kFactor);
  const speedPerSecond = tas / 3600;
  const rawRateDegS = (isSi ? PROCEDURE_TURN_SI_RATE_CONSTANT : PROCEDURE_TURN_RATE_CONSTANT) / tas;
  const rateDegS = Math.min(rawRateDegS, PROCEDURE_TURN_MAX_RATE_DEG_S);
  const radius = tas / (PROCEDURE_TURN_RADIUS_CONSTANT * rateDegS);
  const altitudeThousands = inputs.altitudeFt * (isSi ? 0.3048 : 1) / 1000;
  const wind = isSi ? 12 * altitudeThousands + 87 : 2 * altitudeThousands + 47;
  const windPerSecond = wind / 3600;
  const windEffectPerDegree = windPerSecond / rateDegS;
  const timeSeconds = timeSecondsForCategory(inputs.category);

  const cd = (timeSeconds - 5 - 45 / rateDegS) * speedPerSecond;
  const wd = (timeSeconds + 15) * windPerSecond;
  const wk = (timeSeconds - 5) * windPerSecond + 200 * windEffectPerDegree;
  const row = (line, parameter, rawValue, unit, decimals, compact = false) => ({
    line,
    parameter,
    rawValue,
    unit,
    decimals,
    compact,
  });

  const rows = [
    row(1, "K", kFactor, "", 4),
    row(2, "V", tas, speedUnit, 2),
    row(3, "v", speedPerSecond, `${distanceUnit}/s`, 4),
    row(4, "R", rateDegS, "°/s", 2, true),
    row(5, "r", radius, distanceUnit, 2),
    row(6, "h", altitudeThousands, isSi ? "1000 m" : "1000 ft", isSi ? 3 : 2, true),
    row(7, "w", wind, speedUnit, 2, true),
    row(8, "w′", windPerSecond, `${distanceUnit}/s`, 4),
    row(9, "E", windEffectPerDegree, `${distanceUnit}/°`, 5),
    row(10, "ab", 5 * speedPerSecond, distanceUnit, 2),
    row(11, "cd", cd, distanceUnit, 2),
    row(12, "cd₁ = cd₃", cd - 5 * speedPerSecond, distanceUnit, 2),
    row(13, "cd₂ = cd₄", cd + 15 * speedPerSecond, distanceUnit, 2),
    row(14, "Wc", 5 * windPerSecond + 45 * windEffectPerDegree, distanceUnit, 2),
    row(15, "Wd₂ = Wd₄", wd, distanceUnit, 2),
    row(16, "Wf", wd + 50 * windEffectPerDegree, distanceUnit, 2),
    row(17, "Wg = Wh", wd + 100 * windEffectPerDegree, distanceUnit, 2),
    row(18, "Wi", wd + 150 * windEffectPerDegree, distanceUnit, 2),
    row(19, "Wj", wd + 200 * windEffectPerDegree, distanceUnit, 2),
    row(20, "Wk", wk, distanceUnit, 2),
    row(21, "Wl", wk + 50 * windEffectPerDegree, distanceUnit, 2),
  ];

  return { rows, timeSeconds, rawRateDegS, rateDegS };
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
    { key: "geometryGroup", rows: snapshot.rows.slice(9, 13) },
    { key: "toleranceGroup", rows: snapshot.rows.slice(13) },
  ];
  const table = document.getElementById("resultTable");
  table.querySelectorAll("tbody").forEach((tbody) => tbody.remove());
  table.insertAdjacentHTML("beforeend", groups.map(({ key, rows }) => `
    <tbody>
      <tr class="procedure-turn-group-row">
        <th scope="rowgroup" colspan="3">${escapeHtml(message(key, ""))}</th>
      </tr>
      ${rows.map((item) => `
        <tr class="procedure-turn-data-row text-gray-800 dark:text-gray-100">
          <th scope="row" class="whitespace-nowrap px-3 py-2 font-medium">${item.line}</th>
          <td class="whitespace-nowrap px-3 py-2">${escapeHtml(item.parameter)}</td>
          <td class="procedure-turn-result whitespace-nowrap px-3 py-2 font-mono tabular-nums">
            <span>${item.value}</span>${item.unit ? `<span class="procedure-turn-unit">${escapeHtml(item.unit)}</span>` : ""}
          </td>
        </tr>`).join("")}
    </tbody>`).join(""));
  document.getElementById("results").classList.remove("hidden");
}

function updateDerivedTime() {
  const timeSeconds = timeSecondsForCategory(document.getElementById("category").value);
  if (Number.isFinite(timeSeconds)) {
    document.getElementById("timeDisplay").textContent = formatTime(timeSeconds);
  }
}

function formatTime(timeSeconds) {
  const minutes = formatValue(timeSeconds / 60, 2, true);
  return `${timeSeconds} s (${minutes} min)`;
}

function formatValue(value, decimals, compact = false) {
  const formatted = value.toFixed(decimals);
  return compact && formatted.includes(".")
    ? formatted.replace(/0+$/, "").replace(/\.$/, "")
    : formatted;
}

function handleInputChange() {
  invalidateResults();
  updateDerivedTime();
}

function invalidateResults() {
  procedureTurnSnapshot = null;
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
    schemaVersion: 1,
    unitSystem: procedureTurnUnitSystem,
    parameters: {
      iasKt: inputs.iasKt,
      altitudeFt: inputs.altitudeFt,
      isaDeviationC: inputs.isaDeviationC,
      category: inputs.category,
    },
  };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  link.download = `${new Date().toISOString().replace(/[:.]/g, "-")}_procedure_turn_45_180.json`;
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
      const parameters = data && data.schemaVersion === 1 && data.parameters;
      const unitSystem = data?.unitSystem ?? "non-si";
      const hasValidShape = parameters
        && ["non-si", "si"].includes(unitSystem)
        && Number.isFinite(parameters.iasKt)
        && Number.isFinite(parameters.altitudeFt)
        && Number.isFinite(parameters.isaDeviationC)
        && typeof parameters.category === "string";
      if (!hasValidShape) throw new Error("Invalid parameters");

      const error = validateInputs({ ...parameters, unitSystem });
      if (error) {
        showToast(message(error.key, error.fallback), "error");
        return;
      }

      applyUnitSystem(unitSystem);
      displayInputValues(parameters);
      document.getElementById("isaDeviation").value = parameters.isaDeviationC;
      document.getElementById("category").value = parameters.category;
      invalidateResults();
      updateDerivedTime();
      showToast(message("loaded", "Parameters loaded."), "success");
    } catch {
      showToast(message("invalidJson", "Invalid or unsupported parameter file."), "error");
    }
  };
  reader.onerror = () => showToast(message("invalidJson", "Invalid or unsupported parameter file."), "error");
  reader.readAsText(file);
}

async function copyResultsToClipboard() {
  if (!procedureTurnSnapshot) return;
  const headers = [message("line", "Line"), message("parameter", "Parameter"), message("value", "Value")];
  const resultRows = procedureTurnSnapshot.rows.map((item) => [
    String(item.line),
    item.parameter,
    `${item.value}${item.unit ? ` ${item.unit}` : ""}`,
  ]);
  const allRows = [
    [message("inputs", "Inputs"), "", ""],
    ...procedureTurnSnapshot.inputValues.map(([label, value]) => ["", label, value]),
    ["", "", ""],
    headers,
    ...resultRows,
  ];
  const headingIndex = procedureTurnSnapshot.inputValues.length + 2;
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

function message(key, fallback) {
  return window.I18N ? I18N.get(`procedureTurn.${key}`, fallback) : fallback;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
