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
  ["fafAltitudeUnit", "maptAltitudeUnit", "tchRdhUnit", "ocaUnit"].forEach(
    function (unitId) {
      const inputId = unitId.replace(/Unit$/, "");
      document.getElementById(unitId).addEventListener("change", function () {
        handleUnitChange(inputId, unitId);
      });
    },
  );
  document
    .getElementById("btnCalculate")
    .addEventListener("click", calculateDistAlt);
  document
    .getElementById("btnCopy")
    .addEventListener("click", copyToWordDocument);
});

function calculateDistAlt() {
  const fafAltitude = getValueInUnit("fafAltitude", "fafAltitudeUnit", "ft");
  const maptAltitude = getValueInUnit(
    "maptAltitude",
    "maptAltitudeUnit",
    "ft",
  );
  const distanceNM = parseFloat(
    document.getElementById("fafMaptDistance").value,
  );
  const tchRdh = getValueInUnit("tchRdh", "tchRdhUnit", "ft");
  const oca = getValueInUnit("oca", "ocaUnit", "ft");

  if (
    isNaN(fafAltitude) ||
    isNaN(maptAltitude) ||
    isNaN(distanceNM) ||
    isNaN(tchRdh) ||
    isNaN(oca) ||
    distanceNM <= 0
  ) {
    showToast(
      I18N.get(
        "messages.enterValid",
        "Please enter valid values for all inputs.",
      ),
      "error",
    );
    return;
  }

  // Gradient (fraction) and VPA (degrees) between FAF and MAPt.
  const gradient =
    (fafAltitude - maptAltitude - tchRdh) / (distanceNM * FT_PER_NM);
  const vpaDeg = Math.atan(gradient) * (180 / Math.PI);
  const heightLossPerMile = (fafAltitude - maptAltitude - tchRdh) / distanceNM;

  document.getElementById("gradientPct").textContent = (
    gradient * 100
  ).toFixed(2);
  document.getElementById("vpaDeg").textContent = vpaDeg.toFixed(2);
  document.getElementById("heightLossPerMile").textContent =
    Math.round(heightLossPerMile);

  // Distance/Altitude table — one row per whole NM from the FAF-MAPt
  // distance down to the MAPt (0).
  let rowsHtml = "";
  for (let d = Math.floor(distanceNM); d >= 0; d--) {
    const calculatedAltitude =
      fafAltitude - gradient * (distanceNM - d) * FT_PER_NM;
    const publicationAltitude = Math.ceil(calculatedAltitude / 10) * 10;
    const calculatedHeight = publicationAltitude - maptAltitude;
    const advisoryAltitude =
      publicationAltitude > oca
        ? `${d} NM - ${publicationAltitude} (${Math.round(calculatedHeight)})`
        : I18N.get("distAlt.belowOca", "below OCA");

    rowsHtml += `<tr>
      <td class="p-2 tabular-nums text-gray-700 dark:text-gray-300">${d} NM</td>
      <td class="p-2 tabular-nums text-gray-700 dark:text-gray-300">${calculatedAltitude.toFixed(2)}</td>
      <td class="p-2 tabular-nums text-gray-700 dark:text-gray-300">${publicationAltitude}</td>
      <td class="p-2 tabular-nums text-gray-700 dark:text-gray-300">${Math.round(calculatedHeight)}</td>
      <td class="p-2 text-gray-700 dark:text-gray-300">${advisoryAltitude}</td>
    </tr>`;
  }
  document.getElementById("distAltRows").innerHTML = rowsHtml;

  document.getElementById("results").classList.remove("hidden");
}

function saveParameters() {
  const params = {
    fafAltitude: document.getElementById("fafAltitude").value,
    fafAltitudeUnit: document.getElementById("fafAltitudeUnit").value,
    maptAltitude: document.getElementById("maptAltitude").value,
    maptAltitudeUnit: document.getElementById("maptAltitudeUnit").value,
    fafMaptDistance: document.getElementById("fafMaptDistance").value,
    tchRdh: document.getElementById("tchRdh").value,
    tchRdhUnit: document.getElementById("tchRdhUnit").value,
    oca: document.getElementById("oca").value,
    ocaUnit: document.getElementById("ocaUnit").value,
  };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_Dist_Alt_Calculation.json`;

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
      document.getElementById("fafAltitude").value = data.fafAltitude || "";
      document.getElementById("maptAltitude").value = data.maptAltitude || "";
      document.getElementById("fafMaptDistance").value =
        data.fafMaptDistance || "";
      document.getElementById("tchRdh").value = data.tchRdh || "";
      document.getElementById("oca").value = data.oca || "";

      [
        ["fafAltitudeUnit", data.fafAltitudeUnit],
        ["maptAltitudeUnit", data.maptAltitudeUnit],
        ["tchRdhUnit", data.tchRdhUnit],
        ["ocaUnit", data.ocaUnit],
      ].forEach(function ([unitId, value]) {
        if (value) {
          const unitSelect = document.getElementById(unitId);
          unitSelect.dataset.lastUnit = unitSelect.value;
          unitSelect.value = value;
        }
      });

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

  const summaryData = {
    "FAF Altitude": `${document.getElementById("fafAltitude").value} ${document.getElementById("fafAltitudeUnit").value}`,
    "MAPt Altitude": `${document.getElementById("maptAltitude").value} ${document.getElementById("maptAltitudeUnit").value}`,
    "FAF - MAPt Distance": `${document.getElementById("fafMaptDistance").value} NM`,
    "TCH/RDH": `${document.getElementById("tchRdh").value} ${document.getElementById("tchRdhUnit").value}`,
    OCA: `${document.getElementById("oca").value} ${document.getElementById("ocaUnit").value}`,
    "Gradient/VPA": `${document.getElementById("gradientPct").textContent}% (${document.getElementById("vpaDeg").textContent}°)`,
    "Height loss per mile": `${document.getElementById("heightLossPerMile").textContent} ft`,
  };
  const summaryHtml = createHTMLTable(
    summaryData,
    "Distance/Altitude Parameters",
  );

  let tableHtml = `
    <table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;margin-top:12px">
      <tr style="background:#0c2240;color:#ffffff">
        <th style="padding:8px;text-align:left;font-weight:bold">Distance from MAPt (NM)</th>
        <th style="padding:8px;text-align:left;font-weight:bold">Calculated Altitude (ft)</th>
        <th style="padding:8px;text-align:left;font-weight:bold">Publication Altitude (ft)</th>
        <th style="padding:8px;text-align:left;font-weight:bold">Calculated Height (ft)</th>
        <th style="padding:8px;text-align:left;font-weight:bold">Advisory Altitude</th>
      </tr>
  `;
  document.querySelectorAll("#distAltRows tr").forEach((row) => {
    const cells = row.querySelectorAll("td");
    tableHtml += `<tr>${Array.from(cells)
      .map((td) => `<td style="padding:8px;text-align:left">${td.textContent}</td>`)
      .join("")}</tr>`;
  });
  tableHtml += `</table>`;

  copyToClipboard(summaryHtml + tableHtml);
}
