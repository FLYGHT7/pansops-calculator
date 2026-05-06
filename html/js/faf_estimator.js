document.addEventListener("DOMContentLoaded", function () {
  try {
    if (
      window.parent &&
      window.parent.document.documentElement.classList.contains("dark")
    ) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {
    console.log("Running in standalone mode");
  }

  // Auto-fill lower/upper whenever VPA changes
  document.getElementById("vpa").addEventListener("input", function () {
    const v = parseFloat(this.value);
    if (!isNaN(v)) {
      document.getElementById("lowerValue").value = (v - 0.05).toFixed(2);
      document.getElementById("upperValue").value = (v + 0.05).toFixed(2);
    }
  });

  document.getElementById("btnCalculate").addEventListener("click", estimateFAF);
  document.getElementById("btnCopy").addEventListener("click", copyToWordDocument);

  // Filter pill buttons
  document.getElementById("btnFilterAll").addEventListener("click", function () {
    setFilter("all");
  });
  document.getElementById("btnFilterUsable").addEventListener("click", function () {
    setFilter("usable");
  });
  document.getElementById("btnFilterNotUsable").addEventListener("click", function () {
    setFilter("notUsable");
  });
});

const NM_TO_M = 1852;
const FT_TO_M = 0.3048;

let _rows = [];
let _params = {};
let _filter = "all";

function toMetres(value, unit) {
  return unit === "m" ? value : value * FT_TO_M;
}

function estimateFAF() {
  const thrRaw = parseFloat(document.getElementById("thr").value);
  const thrUnit = document.getElementById("thrUnit").value;
  const rdhRaw = parseFloat(document.getElementById("rdh").value);
  const rdhUnit = document.getElementById("rdhUnit").value;
  const vpa = parseFloat(document.getElementById("vpa").value);
  const lower = parseFloat(document.getElementById("lowerValue").value);
  const upper = parseFloat(document.getElementById("upperValue").value);

  if (
    isNaN(thrRaw) ||
    isNaN(rdhRaw) ||
    isNaN(vpa) ||
    isNaN(lower) ||
    isNaN(upper)
  ) {
    showToast("Please enter valid values for all inputs.", "error");
    return;
  }
  if (lower >= upper) {
    showToast("Lower value must be less than Upper value.", "error");
    return;
  }

  const thrM = toMetres(thrRaw, thrUnit);
  const rdhM = toMetres(rdhRaw, rdhUnit);
  const vpaRad = vpa * (Math.PI / 180);

  _params = { thrRaw, thrUnit, rdhRaw, rdhUnit, vpa, lower, upper };
  _rows = [];

  for (let i = 0; i <= 70; i++) {
    const d = Math.round((3.0 + i * 0.1) * 10) / 10;
    const exactFt = (thrM + rdhM + d * NM_TO_M * Math.tan(vpaRad)) / FT_TO_M;
    const roundedFt = Math.round(exactFt / 100) * 100;
    const backVPA =
      Math.atan((roundedFt * FT_TO_M - thrM - rdhM) / (d * NM_TO_M)) *
      (180 / Math.PI);
    const usable = backVPA > lower && backVPA < upper;
    _rows.push({ d, exactFt, roundedFt, backVPA, usable });
  }

  const usableRows = _rows.filter((r) => r.usable);
  const usableCount = usableRows.length;
  const distMin =
    usableCount > 0 ? usableRows[0].d.toFixed(1) + " NM" : "—";
  const distMax =
    usableCount > 0 ? usableRows[usableRows.length - 1].d.toFixed(1) + " NM" : "—";

  document.getElementById("summaryCount").textContent = usableCount;
  document.getElementById("summaryDistRange").textContent =
    usableCount > 0 ? distMin + " – " + distMax : "—";
  document.getElementById("summaryVpaTolerance").textContent =
    lower.toFixed(2) + "° – " + upper.toFixed(2) + "°";

  _filter = "all";
  setFilter("all");
  document.getElementById("resultsSection").classList.remove("hidden");
}

function setFilter(mode) {
  _filter = mode;
  const buttons = {
    all: document.getElementById("btnFilterAll"),
    usable: document.getElementById("btnFilterUsable"),
    notUsable: document.getElementById("btnFilterNotUsable"),
  };
  const activeClass = "bg-primary-600 dark:bg-primary-700 text-white font-semibold";
  const inactiveClass =
    "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600";

  Object.entries(buttons).forEach(function (entry) {
    var key = entry[0];
    var btn = entry[1];
    var isActive = key === mode;
    btn.className = btn.className
      .replace(activeClass, "")
      .replace(inactiveClass, "")
      .trim() +
      " " + (isActive ? activeClass : inactiveClass);
  });

  renderTable();
}

function renderTable() {
  const visible =
    _filter === "usable"
      ? _rows.filter((r) => r.usable)
      : _filter === "notUsable"
      ? _rows.filter((r) => !r.usable)
      : _rows;
  const tbody = document.getElementById("fafTableBody");

  if (visible.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No usable altitudes found for the given parameters.</td></tr>';
    return;
  }

  tbody.innerHTML = visible
    .map((r) => {
      const rowBg = r.usable
        ? "bg-green-50 dark:bg-green-900/20"
        : "hover:bg-gray-50 dark:hover:bg-gray-700/50";
      const badge = r.usable
        ? '<span class="inline-block bg-green-100 text-green-800 dark:bg-green-800/60 dark:text-green-200 text-xs font-bold px-2 py-0.5 rounded-full">YES</span>'
        : '<span class="inline-block bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 text-xs font-medium px-2 py-0.5 rounded-full">NO</span>';
      const roundedClass = r.usable
        ? "font-bold text-green-700 dark:text-green-300"
        : "text-gray-700 dark:text-gray-300";
      return (
        "<tr class=\"" +
        rowBg +
        " transition-colors\">" +
        '<td class="px-4 py-2 text-center tabular-nums text-sm text-gray-700 dark:text-gray-300">' +
        r.d.toFixed(1) +
        "</td>" +
        '<td class="px-4 py-2 text-right tabular-nums text-sm text-gray-600 dark:text-gray-400">' +
        r.exactFt.toFixed(2) +
        "</td>" +
        '<td class="px-4 py-2 text-right tabular-nums text-sm ' +
        roundedClass +
        '">' +
        r.roundedFt +
        "</td>" +
        '<td class="px-4 py-2 text-right tabular-nums text-sm text-gray-700 dark:text-gray-300">' +
        r.backVPA.toFixed(4) +
        "</td>" +
        '<td class="px-4 py-2 text-center">' +
        badge +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

function copyToWordDocument() {
  if (_rows.length === 0) {
    showToast("Run a calculation first.", "error");
    return;
  }

  const { thrRaw, thrUnit, rdhRaw, rdhUnit, vpa, lower, upper } = _params;
  const th =
    "padding:6px 10px;border:1px solid #ccc;background:#0c2240;color:#fff;font-weight:bold;text-align:center;";
  const td = "padding:6px 10px;border:1px solid #ccc;text-align:right;";
  const tdc = "padding:6px 10px;border:1px solid #ccc;text-align:center;";

  const inputHtml =
    '<p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;margin:0 0 4px">FAF Estimator — Inputs</p>' +
    '<table border="1" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:10pt;margin-bottom:14px">' +
    "<tr><th style=\"" + th + "\">Parameter</th><th style=\"" + th + "\">Value</th></tr>" +
    "<tr><td style=\"" + tdc + "\">THR Elevation</td><td style=\"" + tdc + "\">" + thrRaw + " " + thrUnit + "</td></tr>" +
    "<tr><td style=\"" + tdc + "\">RDH</td><td style=\"" + tdc + "\">" + rdhRaw + " " + rdhUnit + "</td></tr>" +
    "<tr><td style=\"" + tdc + "\">VPA</td><td style=\"" + tdc + "\">" + vpa + "°</td></tr>" +
    "<tr><td style=\"" + tdc + "\">Lower limit</td><td style=\"" + tdc + "\">" + lower.toFixed(2) + "°</td></tr>" +
    "<tr><td style=\"" + tdc + "\">Upper limit</td><td style=\"" + tdc + "\">" + upper.toFixed(2) + "°</td></tr>" +
    "</table>";

  const usableOnly = _rows.filter((r) => r.usable);
  const resultRows = usableOnly
    .map(
      (r) =>
        "<tr style=\"background:#e8f5e9\">" +
        "<td style=\"" + tdc + "\">" + r.d.toFixed(1) + "</td>" +
        "<td style=\"" + td + "\">" + r.exactFt.toFixed(2) + "</td>" +
        "<td style=\"" + td + ";font-weight:bold\">" + r.roundedFt + "</td>" +
        "<td style=\"" + td + "\">" + r.backVPA.toFixed(4) + "</td>" +
        "<td style=\"" + tdc + "\">YES</td>" +
        "</tr>"
    )
    .join("");

  const resultHtml =
    '<p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:bold;margin:0 0 4px">FAF Estimator — Usable Altitudes</p>' +
    '<table border="1" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:10pt">' +
    "<tr>" +
    "<th style=\"" + th + "\">Dist (NM)</th>" +
    "<th style=\"" + th + "\">Exact Alt (ft)</th>" +
    "<th style=\"" + th + "\">Rounded (ft)</th>" +
    "<th style=\"" + th + "\">Back VPA (°)</th>" +
    "<th style=\"" + th + "\">Usable</th>" +
    "</tr>" +
    (resultRows ||
      "<tr><td colspan=\"5\" style=\"" + tdc + "\">No usable altitudes found</td></tr>") +
    "</table>";

  const htmlContent = inputHtml + resultHtml;
  const textContent =
    "FAF Estimator Results\n" +
    "THR: " + thrRaw + " " + thrUnit + "  RDH: " + rdhRaw + " " + rdhUnit + "  VPA: " + vpa + "°\n" +
    "Bounds: " + lower.toFixed(2) + "° – " + upper.toFixed(2) + "°\n\n" +
    "Dist(NM)\tExact(ft)\tRounded(ft)\tBack VPA(°)\tUsable\n" +
    _rows
      .map(
        (r) =>
          r.d.toFixed(1) + "\t" +
          r.exactFt.toFixed(2) + "\t" +
          r.roundedFt + "\t" +
          r.backVPA.toFixed(4) + "\t" +
          (r.usable ? "YES" : "NO")
      )
      .join("\n");

  const blob = new Blob([htmlContent], { type: "text/html" });
  const textBlob = new Blob([textContent], { type: "text/plain" });
  navigator.clipboard
    .write([new ClipboardItem({ "text/html": blob, "text/plain": textBlob })])
    .then(() => showToast("Results copied — paste into Word.", "success"))
    .catch(() => showToast("Copy failed. Please try again.", "error"));
}
