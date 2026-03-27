// Check for dark mode on page load
document.addEventListener("DOMContentLoaded", function () {
  // Check if parent has set dark mode
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

  // Event bindings
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", function () {
    document.getElementById("loadFile").click();
  });
  document
    .getElementById("loadFile")
    .addEventListener("change", loadParameters);
  document
    .getElementById("calcBtn")
    .addEventListener("click", calculateBearing);
  document.getElementById("btnCopy").addEventListener("click", function () {
    copyToWordDocument("both");
  });
});

// Normalize an angle to [0, 360)
function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

// Process the date input: if only a 4-digit year is provided, assume YYYY-01-01.
function processDate(inputStr) {
  const trimmed = inputStr.trim();
  if (trimmed === "") return "";
  if (trimmed.length === 4 && /^\d{4}$/.test(trimmed)) {
    return trimmed + "-01-01";
  }
  return trimmed;
}

// Update the Bearing label and Calculate button text based on selected Input Type.
function updateBearingLabelAndButton() {
  const inputType = document.querySelector(
    'input[name="inputType"]:checked',
  ).value;
  const bearingLabel = document.getElementById("bearingLabel");
  const calcBtn = document.getElementById("calcBtn");
  const magneticBlock = document.getElementById("magneticBlock");
  const trueBlock = document.getElementById("trueBlock");
  if (inputType === "magnetic") {
    bearingLabel.textContent =
      window.I18N && I18N.get
        ? I18N.get("bearings.bearingLabelMagnetic", "Magnetic Bearing (°)")
        : "Magnetic Bearing (°)";
    const btnText = document.getElementById("calcBtnText");
    if (btnText)
      btnText.textContent =
        window.I18N && I18N.get
          ? I18N.get("bearings.calcTrueAzimuth", "Calculate True Azimuth")
          : "Calculate True Azimuth";
    magneticBlock.classList.remove("hidden");
    trueBlock.classList.add("hidden");
  } else {
    bearingLabel.textContent =
      window.I18N && I18N.get
        ? I18N.get("bearings.bearingLabelTrue", "True Azimuth (°)")
        : "True Azimuth (°)";
    const btnText = document.getElementById("calcBtnText");
    if (btnText)
      btnText.textContent =
        window.I18N && I18N.get
          ? I18N.get(
              "bearings.calcMagneticBearing",
              "Calculate Magnetic Bearing",
            )
          : "Calculate Magnetic Bearing";
    magneticBlock.classList.add("hidden");
    trueBlock.classList.remove("hidden");
  }
}

// Attach event listeners for input type changes.
document.querySelectorAll('input[name="inputType"]').forEach((radio) => {
  radio.addEventListener("change", updateBearingLabelAndButton);
});
updateBearingLabelAndButton();

// Main calculation function for bearing conversion.
function calculateBearing() {
  const inputType = document.querySelector(
    'input[name="inputType"]:checked',
  ).value;
  const bearingInput = parseFloat(document.getElementById("bearing").value);
  if (isNaN(bearingInput)) {
    showToast(
      window.I18N && I18N.get
        ? I18N.get(
            "messages.invalidBearing",
            "Please enter a valid bearing value.",
          )
        : "Please enter a valid bearing value.",
      "error",
    );
    return;
  }

  const varDeg = parseFloat(document.getElementById("var_deg").value) || 0;
  const varMin = parseFloat(document.getElementById("var_min").value) || 0;
  const varSec = parseFloat(document.getElementById("var_sec").value) || 0;
  const variation = varDeg + varMin / 60 + varSec / 3600;

  const varDir = document.getElementById("var_dir").value;
  const signedVariation = varDir === "W" ? -variation : variation;

  let magneticBearing, trueAzimuth;
  if (inputType === "magnetic") {
    magneticBearing = bearingInput;
    trueAzimuth = normalizeAngle(bearingInput + signedVariation);
  } else {
    trueAzimuth = bearingInput;
    magneticBearing = normalizeAngle(bearingInput - signedVariation);
  }

  let diff = Math.abs(trueAzimuth - 450);
  let qgisAngle = diff < 360 ? diff : diff - 360;
  qgisAngle = normalizeAngle(qgisAngle);

  if (inputType === "magnetic") {
    document.getElementById("magneticBearing").textContent =
      magneticBearing.toFixed(4);
    document.getElementById("trueAzimuth").textContent = trueAzimuth.toFixed(4);
  } else {
    document.getElementById("trueAzimuthInput").textContent =
      trueAzimuth.toFixed(4);
    document.getElementById("magneticBearingCalc").textContent =
      magneticBearing.toFixed(4);
  }
  document.getElementById("qgisAngle").textContent = qgisAngle.toFixed(4);

  // Show/hide QGIS row based on checkbox
  if (document.getElementById("includeQGIS").checked) {
    document.getElementById("qgisRow").classList.remove("hidden");
  } else {
    document.getElementById("qgisRow").classList.add("hidden");
  }

  // Reveal the results
  document.getElementById("resultsOutput").classList.remove("hidden");
}

// Save parameters as JSON.
function saveParameters() {
  const params = {
    var_deg: document.getElementById("var_deg").value || "",
    var_min: document.getElementById("var_min").value || "",
    var_sec: document.getElementById("var_sec").value || "",
    var_dir: document.getElementById("var_dir").value || "E",
    var_date: processDate(document.getElementById("var_date").value || ""),
    bearing: document.getElementById("bearing").value || "",
    inputType:
      document.querySelector('input[name="inputType"]:checked').value ||
      "magnetic",
    includeQGIS: document.getElementById("includeQGIS").checked,
  };
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_bearings_angles.json`;
  const blob = new Blob([JSON.stringify(params, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Load parameters from JSON.
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
      if (data["var_deg"] !== undefined)
        document.getElementById("var_deg").value = data["var_deg"];
      if (data["var_min"] !== undefined)
        document.getElementById("var_min").value = data["var_min"];
      if (data["var_sec"] !== undefined)
        document.getElementById("var_sec").value = data["var_sec"];
      if (data["var_dir"] !== undefined)
        document.getElementById("var_dir").value = data["var_dir"];
      if (data["var_date"] !== undefined)
        document.getElementById("var_date").value = data["var_date"];
      if (data["bearing"] !== undefined)
        document.getElementById("bearing").value = data["bearing"];
      if (data["inputType"] !== undefined) {
        const radioToCheck = document.querySelector(
          `input[name="inputType"][value="${data["inputType"]}"]`,
        );
        if (radioToCheck) {
          radioToCheck.checked = true;
        }
      }
      if (data["includeQGIS"] !== undefined) {
        document.getElementById("includeQGIS").checked = data["includeQGIS"];
      }
      updateBearingLabelAndButton();
      showToast("Parameters successfully loaded!", "success");
    } catch (err) {
      showToast(
        "Invalid JSON file. Please upload a valid parameters file.",
        "error",
      );
    }
  };
  reader.readAsText(file);
}

// Copy results as an HTML table for pasting into Word.
function copyToWordDocument(type) {
  let htmlContent = "";
  if (type === "both") {
    const inputType = document.querySelector(
      'input[name="inputType"]:checked',
    ).value;
    const bearingVal =
      parseFloat(document.getElementById("bearing").value) || 0;

    // Compute variation.
    const var_deg = parseFloat(document.getElementById("var_deg").value) || 0;
    const var_min = parseFloat(document.getElementById("var_min").value) || 0;
    const var_sec = parseFloat(document.getElementById("var_sec").value) || 0;
    let variation = var_deg + var_min / 60 + var_sec / 3600;
    const var_dir = document.getElementById("var_dir").value;
    if (var_dir === "W") {
      variation = -variation;
    }

    let magneticBearing, trueAzimuth;
    if (inputType === "magnetic") {
      magneticBearing = bearingVal;
      trueAzimuth = normalizeAngle(bearingVal + variation);
    } else {
      trueAzimuth = bearingVal;
      magneticBearing = normalizeAngle(bearingVal - variation);
    }
    magneticBearing = normalizeAngle(magneticBearing);
    trueAzimuth = normalizeAngle(trueAzimuth);

    // Compute QGIS Angle.
    let diff = Math.abs(trueAzimuth - 450);
    let qgisAngle = diff < 360 ? diff : diff - 360;
    qgisAngle = normalizeAngle(qgisAngle);

    // Process the date.
    let varDate = processDate(document.getElementById("var_date").value || "");

    let tableRows = "";
    if (inputType === "magnetic") {
      tableRows += `<tr><td style="padding:8px;text-align:left">Input Type</td><td style="padding:8px;text-align:left">Magnetic Bearing</td></tr>`;
      tableRows += `<tr><td style="padding:8px;text-align:left">Magnetic Bearing (Input)</td><td style="padding:8px;text-align:left">${bearingVal.toFixed(
        4,
      )}°</td></tr>`;
      tableRows += `<tr><td style="padding:8px;text-align:left">Calculated True Azimuth</td><td style="padding:8px;text-align:left">${trueAzimuth.toFixed(
        4,
      )}°</td></tr>`;
    } else {
      tableRows += `<tr><td style="padding:8px;text-align:left">Input Type</td><td style="padding:8px;text-align:left">True Azimuth</td></tr>`;
      tableRows += `<tr><td style="padding:8px;text-align:left">True Azimuth (Input)</td><td style="padding:8px;text-align:left">${trueAzimuth.toFixed(
        4,
      )}°</td></tr>`;
      tableRows += `<tr><td style="padding:8px;text-align:left">Calculated Magnetic Bearing</td><td style="padding:8px;text-align:left">${magneticBearing.toFixed(
        4,
      )}°</td></tr>`;
    }
    tableRows += `<tr><td style="padding:8px;text-align:left">Magnetic Variation</td><td style="padding:8px;text-align:left">${variation.toFixed(
      4,
    )}°</td></tr>`;
    tableRows += `<tr><td style="padding:8px;text-align:left">Variation Direction</td><td style="padding:8px;text-align:left">${var_dir}</td></tr>`;
    if (varDate) {
      tableRows += `<tr><td style="padding:8px;text-align:left">Date</td><td style="padding:8px;text-align:left">${varDate}</td></tr>`;
    }
    if (document.getElementById("includeQGIS").checked) {
      tableRows += `<tr><td style="padding:8px;text-align:left">QGIS Angle</td><td style="padding:8px;text-align:left">${qgisAngle.toFixed(
        4,
      )}°</td></tr>`;
    }

    htmlContent = `
          <table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">
            <tr style="background:#0c2240;color:#ffffff"><th style="padding:8px;text-align:left;font-weight:bold">Parameter</th><th style="padding:8px;text-align:left;font-weight:bold">Value</th></tr>
            ${tableRows}
          </table>
        `;
  }
  const blob = new Blob([htmlContent], { type: "text/html" });
  // Create a simple plain-text version stripping HTML tags from rows
  const plainRows = tableRows
    .replace(/<tr>/g, "")
    .replace(/<\/tr>/g, "\n")
    .replace(/<td[^>]*>/g, "")
    .replace(/<\/td>/g, "\t")
    .replace(/\t\n/g, "\n")
    .trim();
  const textContent = ["Parameter\tValue", plainRows].join("\n");
  const textBlob = new Blob([textContent], { type: "text/plain" });
  navigator.clipboard
    .write([new ClipboardItem({ "text/html": blob, "text/plain": textBlob })])
    .then(() => {
      showToast("Results copied — paste into Word.", "success");
    })
    .catch((err) => {
      console.error("Copy failed:", err);
    });
}

(function () {
  function initI18n() {
    if (window.I18N) {
      I18N.init({
        defaultLang: "en",
        supported: ["en", "es"],
        path: "i18n",
      }).catch(console.error);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initI18n);
  } else {
    initI18n();
  }
})();
