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

  // Initialize unit selectors
  initializeUnitSelectors();

  // Event bindings
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", function () {
    document.getElementById("loadFile").click();
  });
  document
    .getElementById("loadFile")
    .addEventListener("change", loadParameters);
  document
    .getElementById("altitudeUnit")
    .addEventListener("change", function () {
      handleUnitChange("altitude", "altitudeUnit");
    });
  document.getElementById("btnCalcTAS").addEventListener("click", calculateTAS);
  document
    .getElementById("btnCalcTurn")
    .addEventListener("click", calculateTurn);
  document
    .getElementById("btnCopy")
    .addEventListener("click", copyResultsToClipboard);
});

// Function to handle unit conversion when unit selector changes
function handleUnitChange(inputId, unitSelectId) {
  const unitSelect = document.getElementById(unitSelectId);

  // Just update the last unit - no conversion in the UI
  unitSelect.dataset.lastUnit = unitSelect.value;

  // No need to convert the value in the input field
  // The conversion will happen only during calculations
}

// Function to initialize all unit selectors
function initializeUnitSelectors() {
  // Get all unit selectors
  const unitSelectors = document.querySelectorAll('select[id$="Unit"]');

  unitSelectors.forEach((selector) => {
    // Save the initial unit
    selector.dataset.lastUnit = selector.value;
  });
}

// Load parameters from a JSON file and populate input fields.
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
      if (data["IAS"]) {
        document.getElementById("ias").value = data["IAS"];
      }
      if (data["Altitude"]) {
        document.getElementById("altitude").value = data["Altitude"];
      }
      if (data["altitudeUnit"]) {
        const unitSelect = document.getElementById("altitudeUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["altitudeUnit"];
      }
      if (data["ISA Deviation"]) {
        document.getElementById("isaDeviation").value = data["ISA Deviation"];
      }
      if (data["Bank Angle"]) {
        document.getElementById("bankAngle").value = data["Bank Angle"];
      }
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

// Save all input parameters with a timestamp in the filename.
function saveParameters() {
  const ias = document.getElementById("ias").value || "";
  const altitude = document.getElementById("altitude").value || "";
  const altitudeUnit = document.getElementById("altitudeUnit").value || "ft";
  const isaDeviation = document.getElementById("isaDeviation").value || "";
  const bankAngle = document.getElementById("bankAngle").value || "";
  const data = {
    IAS: ias,
    iasUnit: "knots", // Always knots
    Altitude: altitude,
    altitudeUnit: altitudeUnit,
    "ISA Deviation": isaDeviation,
    "Bank Angle": bankAngle,
  };
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = "parameters_" + timestamp + "_radius.json";
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Calculate TAS from IAS, Altitude, and ISA Deviation.
function calculateTAS() {
  const iasInput = parseFloat(document.getElementById("ias").value);
  const altitudeInput = parseFloat(document.getElementById("altitude").value);
  const altitudeUnit = document.getElementById("altitudeUnit").value;
  const isaDeviation = parseFloat(
    document.getElementById("isaDeviation").value,
  );

  if (isNaN(iasInput) || isNaN(altitudeInput) || isNaN(isaDeviation)) {
    showToast(
      "Please enter valid values for IAS, altitude, and ISA deviation.",
      "error",
    );
    return;
  }

  // IAS is always in knots now
  let ias = iasInput;

  // Convert altitude to feet if needed
  let altitude = altitudeInput;
  if (altitudeUnit === "m") {
    altitude = altitudeInput / 0.3048;
  }

  const k =
    (171233 * Math.sqrt(288 + isaDeviation - 0.00198 * altitude)) /
    Math.pow(288 - 0.00198 * altitude, 2.628);

  // Calculate True Airspeed
  let tas = k * ias;

  document.getElementById("kFactor").textContent = k.toFixed(4);
  document.getElementById("tas").textContent = tas.toFixed(4);
  document.getElementById("tasResults").classList.remove("hidden");

  return tas;
}

// Calculate Rate of Turn (cap at 3°/s) and Radius of Turn.
function calculateTurn() {
  let tas;

  // Check if TAS has been calculated
  if (document.getElementById("tas").textContent === "") {
    tas = calculateTAS();
  } else {
    tas = parseFloat(document.getElementById("tas").textContent);
  }

  const bankAngle = parseFloat(document.getElementById("bankAngle").value);

  if (isNaN(tas) || isNaN(bankAngle)) {
    showToast(
      "Please ensure TAS is calculated and enter a valid Bank Angle.",
      "error",
    );
    return;
  }

  // Compute the uncapped rate.
  const uncappedRate =
    (3431 * Math.tan((bankAngle * Math.PI) / 180)) / (Math.PI * tas);
  const cappedRate = Math.min(uncappedRate, 3);

  // If the uncapped value exceeds 3, display both; otherwise, display only one.
  if (uncappedRate > 3) {
    document.getElementById("rateOfTurn").textContent =
      cappedRate.toFixed(4) + " °/s";
    document.getElementById("uncappedRateOfTurn").textContent =
      uncappedRate.toFixed(4) + " °/s";
    document.getElementById("uncappedRow").classList.remove("hidden");
    document.getElementById("cappedMessage").textContent =
      "Rate of Turn capped at 3°/s for radius calculation.";
  } else {
    document.getElementById("rateOfTurn").textContent =
      uncappedRate.toFixed(4) + " °/s";
    document.getElementById("uncappedRow").classList.add("hidden");
    document.getElementById("cappedMessage").textContent = "";
  }

  const radiusOfTurnNM = tas / (20 * Math.PI * cappedRate);
  document.getElementById("radiusOfTurn").textContent =
    radiusOfTurnNM.toFixed(4) + " NM";
  document.getElementById("turnResults").classList.remove("hidden");
}

// Copy results as a formatted table to the clipboard.
function copyResultsToClipboard() {
  const ias = document.getElementById("ias").value || "N/A";
  const altitude = document.getElementById("altitude").value || "N/A";
  const altitudeUnit = document.getElementById("altitudeUnit").value || "ft";
  const isaDeviation = document.getElementById("isaDeviation").value || "N/A";
  const bankAngle = document.getElementById("bankAngle").value || "N/A";
  const kFactor = document.getElementById("kFactor").textContent || "N/A";
  const tas = document.getElementById("tas").textContent || "N/A";

  // Determine how to display Rate of Turn in the table.
  let rateRow = "";
  if (document.getElementById("turnResults").classList.contains("hidden")) {
    rateRow = "";
  } else {
    const rateOfTurn =
      document.getElementById("rateOfTurn").textContent || "N/A";
    if (document.getElementById("uncappedRow").classList.contains("hidden")) {
      rateRow = `<tr><td>Rate of Turn</td><td>${rateOfTurn}</td></tr>`;
    } else {
      const uncappedRateOfTurn =
        document.getElementById("uncappedRateOfTurn").textContent || "N/A";
      rateRow = `<tr><td>Rate of Turn (Capped)</td><td>${rateOfTurn}</td></tr>
                     <tr><td>Rate of Turn (Uncapped)</td><td>${uncappedRateOfTurn}</td></tr>`;
    }
  }

  const radiusOfTurn =
    document.getElementById("radiusOfTurn").textContent || "N/A";

  const htmlContent = `
        <table border="1" style="border-collapse: collapse; text-align: center; width: 100%;">
          <tr style="background-color: #f1f5f9;"><th>Parameter</th><th>Value</th></tr>
          <tr><td>IAS</td><td>${ias} knots</td></tr>
          <tr><td>Altitude</td><td>${altitude} ${altitudeUnit}</td></tr>
          <tr><td>ISA Deviation (VAR)</td><td>${isaDeviation} °C</td></tr>
          <tr><td>Bank Angle</td><td>${bankAngle} °</td></tr>
          <tr><td>k Factor</td><td>${kFactor}</td></tr>
          <tr><td>True Airspeed (TAS)</td><td>${tas} knots</td></tr>
          ${rateRow}
          <tr><td>Radius of Turn</td><td>${radiusOfTurn}</td></tr>
        </table>
      `;

  // Build a plain-text fallback. If rateRow contained two rows, reflect them too.
  const rows = [
    ["Parameter", "Value"],
    ["IAS", `${ias} knots`],
    ["Altitude", `${altitude} ${altitudeUnit}`],
    ["ISA Deviation (VAR)", `${isaDeviation} °C`],
    ["Bank Angle", `${bankAngle} °`],
    ["k Factor", `${kFactor}`],
    ["True Airspeed (TAS)", `${tas} knots`],
  ];
  if (!document.getElementById("turnResults").classList.contains("hidden")) {
    const rateOfTurn =
      document.getElementById("rateOfTurn").textContent || "N/A";
    if (document.getElementById("uncappedRow").classList.contains("hidden")) {
      rows.push(["Rate of Turn", `${rateOfTurn}`]);
    } else {
      const uncappedRateOfTurn =
        document.getElementById("uncappedRateOfTurn").textContent || "N/A";
      rows.push(["Rate of Turn (Capped)", `${rateOfTurn}`]);
      rows.push(["Rate of Turn (Uncapped)", `${uncappedRateOfTurn}`]);
    }
  }
  rows.push(["Radius of Turn", `${radiusOfTurn}`]);

  const textContent = rows.map((r) => r.join("\t")).join("\n");

  const htmlBlob = new Blob([htmlContent], { type: "text/html" });
  const textBlob = new Blob([textContent], { type: "text/plain" });
  navigator.clipboard
    .write([
      new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob }),
    ])
    .then(() => {
      showToast("Results copied to clipboard!", "success");
    })
    .catch((err) => {
      console.error("Copy failed: ", err);
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
