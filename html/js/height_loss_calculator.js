// Fixed reference table (matches the source workbook's hardcoded Vat per
// aircraft category — not user-editable).
const CATEGORIES = [
  { id: "A", vat: 90 },
  { id: "B", vat: 120 },
  { id: "C", vat: 140 },
  { id: "D", vat: 165 },
];

// Last computed rows in meters, so switching the Results Unit selector
// re-renders from the source values instead of round-tripping displayed ones.
let lastComputedRows = null;
let lastIndicators = null;

document.addEventListener("DOMContentLoaded", function () {
  checkDarkMode();
  initializeUnitSelectors();

  I18N.init({
    defaultLang: "en",
    supported: ["en", "es"],
    path: "i18n",
  }).catch(console.error);

  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", function () {
    document.getElementById("loadFile").click();
  });
  document
    .getElementById("loadFile")
    .addEventListener("change", loadParameters);
  document
    .getElementById("adElevationUnit")
    .addEventListener("change", function () {
      handleUnitChange("adElevation", "adElevationUnit");
    });
  document
    .getElementById("btnCalculate")
    .addEventListener("click", calculateHeightLoss);
  document
    .getElementById("resultsUnit")
    .addEventListener("change", renderHeightLossTable);
  document
    .getElementById("btnCopy")
    .addEventListener("click", copyToWordDocument);
});

function calculateHeightLoss() {
  const elevationM = getValueInUnit("adElevation", "adElevationUnit", "m");
  const vpaDeg = parseFloat(document.getElementById("vpa").value);

  if (isNaN(elevationM) || isNaN(vpaDeg)) {
    showToast(
      I18N.get(
        "messages.enterValid",
        "Please enter valid values for all inputs.",
      ),
      "error",
    );
    return;
  }

  const elevAdjustmentRequired = elevationM > 900;
  const vpaAdjustmentRequired = vpaDeg > 3.2;

  document.getElementById("elevAdjustmentRequired").textContent =
    elevAdjustmentRequired
      ? I18N.get("common.yes", "Yes")
      : I18N.get("common.no", "No");
  document.getElementById("vpaAdjustmentRequired").textContent =
    vpaAdjustmentRequired
      ? I18N.get("common.yes", "Yes")
      : I18N.get("common.no", "No");
  lastIndicators = { elevAdjustmentRequired, vpaAdjustmentRequired };

  lastComputedRows = CATEGORIES.map(function (cat) {
    const radioAltM = 0.177 * cat.vat - 3.2;
    const pressureAltM = 0.125 * cat.vat + 28.3;
    const adjElevM = elevAdjustmentRequired
      ? 0.02 * (elevationM / 300) * radioAltM
      : 0;
    const adjVpaM = vpaAdjustmentRequired
      ? 0.05 * ((vpaDeg - 3.2) / 0.1) * radioAltM
      : 0;
    const adjustedHeightLossM = pressureAltM + adjElevM + adjVpaM;

    return {
      category: cat.id,
      vat: cat.vat,
      radioAltM,
      pressureAltM,
      adjElevM,
      adjVpaM,
      adjustedHeightLossM,
    };
  });

  renderHeightLossTable();
  document.getElementById("results").classList.remove("hidden");
}

function renderHeightLossTable() {
  if (!lastComputedRows) return;

  const unit = document.getElementById("resultsUnit").value;
  const convert = (m) => (unit === "ft" ? metersToFeet(m) : m);

  let rowsHtml = "";
  lastComputedRows.forEach(function (row) {
    rowsHtml += `<tr>
      <td class="p-2 text-gray-700 dark:text-gray-300">${row.category}</td>
      <td class="p-2 tabular-nums text-gray-700 dark:text-gray-300">${row.vat}</td>
      <td class="p-2 tabular-nums text-gray-700 dark:text-gray-300">${convert(row.radioAltM).toFixed(2)}</td>
      <td class="p-2 tabular-nums text-gray-700 dark:text-gray-300">${convert(row.pressureAltM).toFixed(2)}</td>
      <td class="p-2 tabular-nums text-gray-700 dark:text-gray-300">${convert(row.adjElevM).toFixed(2)}</td>
      <td class="p-2 tabular-nums text-gray-700 dark:text-gray-300">${convert(row.adjVpaM).toFixed(2)}</td>
      <td class="p-2 tabular-nums text-gray-700 dark:text-gray-300">${convert(row.adjustedHeightLossM).toFixed(2)}</td>
    </tr>`;
  });
  document.getElementById("heightLossRows").innerHTML = rowsHtml;
}

function saveParameters() {
  const params = {
    adElevation: document.getElementById("adElevation").value,
    adElevationUnit: document.getElementById("adElevationUnit").value,
    vpa: document.getElementById("vpa").value,
    resultsUnit: document.getElementById("resultsUnit").value,
  };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_Height_Loss_Calculation.json`;

  const blob = new Blob([JSON.stringify(params, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function loadParameters(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      document.getElementById("adElevation").value = data.adElevation || "";
      document.getElementById("vpa").value = data.vpa || "";

      if (data.adElevationUnit) {
        const unitSelect = document.getElementById("adElevationUnit");
        unitSelect.dataset.lastUnit = unitSelect.value;
        unitSelect.value = data.adElevationUnit;
      }
      if (data.resultsUnit) {
        document.getElementById("resultsUnit").value = data.resultsUnit;
      }

      showToast(
        I18N.get("messages.saved", "Parameters successfully loaded!"),
        "success",
      );
    } catch (err) {
      showToast(
        I18N.get("messages.invalidJson", "Invalid JSON file."),
        "error",
      );
    }
  };
  reader.readAsText(file);
}

function copyToWordDocument() {
  if (document.getElementById("results").classList.contains("hidden")) {
    showToast("Please calculate first.", "error");
    return;
  }

  const unit = document.getElementById("resultsUnit").value;
  const summaryData = {
    "AD Elevation": `${document.getElementById("adElevation").value} ${document.getElementById("adElevationUnit").value}`,
    VPA: `${document.getElementById("vpa").value}°`,
    "Adjustment due to Elevation Required": document.getElementById(
      "elevAdjustmentRequired",
    ).textContent,
    "Adjustment due to VPA Required": document.getElementById(
      "vpaAdjustmentRequired",
    ).textContent,
  };
  const summaryHtml = createHTMLTable(summaryData, "Height Loss Parameters");

  const unitLabel = unit === "ft" ? "ft" : "m";
  let tableHtml = `
    <table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;margin-top:12px">
      <tr style="background:#0c2240;color:#ffffff">
        <th style="padding:8px;text-align:left;font-weight:bold">Category</th>
        <th style="padding:8px;text-align:left;font-weight:bold">Vat (kt)</th>
        <th style="padding:8px;text-align:left;font-weight:bold">Radio Altimeter (${unitLabel})</th>
        <th style="padding:8px;text-align:left;font-weight:bold">Pressure Altimeter (${unitLabel})</th>
        <th style="padding:8px;text-align:left;font-weight:bold">Adjustment due to Elevation (${unitLabel})</th>
        <th style="padding:8px;text-align:left;font-weight:bold">Adjustment due to VPA (${unitLabel})</th>
        <th style="padding:8px;text-align:left;font-weight:bold">Adjusted Height Loss (${unitLabel})</th>
      </tr>
  `;
  document.querySelectorAll("#heightLossRows tr").forEach((row) => {
    const cells = row.querySelectorAll("td");
    tableHtml += `<tr>${Array.from(cells)
      .map((td) => `<td style="padding:8px;text-align:left">${td.textContent}</td>`)
      .join("")}</tr>`;
  });
  tableHtml += `</table>`;

  copyToClipboard(summaryHtml + tableHtml);
}
