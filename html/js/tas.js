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
  document
    .getElementById("btnCalculate")
    .addEventListener("click", calculateTAS);
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

let loadedDeviation = null; // Stores loaded ISA deviation

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

      // Check for ISA Deviation in different formats
      if (data["ISA Deviation"] !== undefined) {
        loadedDeviation = parseFloat(data["ISA Deviation"]);
        document.getElementById("isaDeviation").value = loadedDeviation;
      } else if (data["roundedDeltaISA"] !== undefined) {
        loadedDeviation = parseFloat(data["roundedDeltaISA"]);
        document.getElementById("isaDeviation").value = loadedDeviation;
      } else if (data["deltaISA"] !== undefined) {
        loadedDeviation = parseFloat(data["deltaISA"]);
        document.getElementById("isaDeviation").value = loadedDeviation;
      }

      // Load other parameters if available
      if (data["IAS"] !== undefined) {
        document.getElementById("ias").value = data["IAS"];
      }

      if (data["Altitude"] !== undefined) {
        document.getElementById("altitude").value = data["Altitude"];
      }

      if (data["altitudeUnit"] !== undefined) {
        const unitSelect = document.getElementById("altitudeUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["altitudeUnit"];
      }

      showToast("Parameters successfully loaded!", "success");
    } catch (err) {
      showToast(
        "Invalid JSON file. Please upload a valid ISA parameters file.",
        "error",
      );
    }
  };
  reader.readAsText(file);
}

function saveParameters() {
  const ias = document.getElementById("ias").value || "";
  const altitude = document.getElementById("altitude").value || "";
  const altitudeUnit = document.getElementById("altitudeUnit").value || "ft";
  const isaDeviation = document.getElementById("isaDeviation").value || "";

  const data = {
    IAS: ias,
    iasUnit: "knots", // Always knots
    Altitude: altitude,
    altitudeUnit: altitudeUnit,
    "ISA Deviation": isaDeviation,
  };

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_TAS_parameters.json`;

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

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

  // Calculate 'k' based on altitude and ISA deviation
  const k =
    (171233 * Math.sqrt(288 + isaDeviation - 0.00198 * altitude)) /
    Math.pow(288 - 0.00198 * altitude, 2.628);

  // Calculate True Airspeed
  let tas = k * ias;

  // Display results with 4 decimal places
  document.getElementById("kFactor").textContent = k.toFixed(4);
  document.getElementById("tas").textContent = tas.toFixed(4);
  document.getElementById("tasResults").classList.remove("hidden");
}

function copyResultsToClipboard() {
  const ias = document.getElementById("ias").value || "N/A";
  const altitude = document.getElementById("altitude").value || "N/A";
  const altitudeUnit = document.getElementById("altitudeUnit").value || "ft";
  const isaDeviation = document.getElementById("isaDeviation").value || "N/A";
  const kFactor = document.getElementById("kFactor").textContent || "N/A";
  const tas = document.getElementById("tas").textContent || "N/A";

  // Create a formatted Word-style table as HTML
  const htmlContent = `
        <table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">
          <tr style="background:#0c2240;color:#ffffff"><th style="padding:8px;text-align:left;font-weight:bold">Parameter</th><th style="padding:8px;text-align:left;font-weight:bold">Value</th></tr>
          <tr><td style="padding:8px;text-align:left">Indicated Airspeed (IAS)</td><td style="padding:8px;text-align:left">${ias} knots</td></tr>
          <tr><td style="padding:8px;text-align:left">Altitude</td><td style="padding:8px;text-align:left">${altitude} ${altitudeUnit}</td></tr>
          <tr><td style="padding:8px;text-align:left">ISA Deviation (VAR)</td><td style="padding:8px;text-align:left">${isaDeviation} °C</td></tr>
          <tr><td style="padding:8px;text-align:left">k Factor</td><td style="padding:8px;text-align:left">${kFactor}</td></tr>
          <tr><td style="padding:8px;text-align:left">True Airspeed (TAS)</td><td style="padding:8px;text-align:left">${tas} knots</td></tr>
        </table>
      `;

  // Build a plain-text fallback (tab-separated)
  const textContent = [
    ["Parameter", "Value"],
    ["Indicated Airspeed (IAS)", `${ias} knots`],
    ["Altitude", `${altitude} ${altitudeUnit}`],
    ["ISA Deviation (VAR)", `${isaDeviation} °C`],
    ["k Factor", `${kFactor}`],
    ["True Airspeed (TAS)", `${tas} knots`],
  ]
    .map((row) => row.join("\t"))
    .join("\n");

  const htmlBlob = new Blob([htmlContent], { type: "text/html" });
  const textBlob = new Blob([textContent], { type: "text/plain" });

  // Use Clipboard API to copy both HTML and plain text
  navigator.clipboard
    .write([
      new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      }),
    ])
    .then(() => {
      showToast(
        "Results copied — paste into Word.",
        "success",
      );
    })
    .catch((err) => {
      console.error("Error copying content to clipboard:", err);
    });
}

// Initialize i18n robustly (runs immediately if DOM is ready, or on DOMContentLoaded)
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
