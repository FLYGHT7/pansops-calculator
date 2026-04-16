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
  // Initialize i18n
  I18N.init({
    defaultLang: "en",
    supported: ["en", "es"],
    path: "i18n",
  }).catch(console.error);

  // Event bindings
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", function () {
    document.getElementById("loadFile").click();
  });
  document
    .getElementById("loadFile")
    .addEventListener("change", loadParameters);
  document
    .getElementById("elevationUnit")
    .addEventListener("change", function () {
      handleUnitChange("elevation", "elevationUnit");
    });
  document
    .getElementById("btnCalculate")
    .addEventListener("click", calculateISA);
  document
    .getElementById("btnCopy")
    .addEventListener("click", copyResultsToClipboard);

  // Sync roundMode dropdown → roundStep input visibility
  var roundModeEl = document.getElementById("roundMode");
  var roundStepEl = document.getElementById("roundStep");
  var roundStepGroup = document.getElementById("roundStepGroup");
  roundModeEl.addEventListener("change", function () {
    var mode = parseInt(roundModeEl.value, 10);
    if (mode === 5) {
      // Default mode: hide input, fixed step = 5
      roundStepGroup.classList.add("hidden");
      roundStepEl.value = 5;
      roundStepEl.disabled = false;
    } else if (mode === 0) {
      // No rounding: show input disabled
      roundStepGroup.classList.remove("hidden");
      roundStepEl.value = 0;
      roundStepEl.disabled = true;
    } else {
      // Next integer: show input editable
      roundStepGroup.classList.remove("hidden");
      roundStepEl.value = mode;
      roundStepEl.disabled = false;
    }
  });
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

function roundUpTo(value, step) {
  return Math.ceil(value / step) * step;
}

function calculateISA() {
  const elevation = parseFloat(document.getElementById("elevation").value);
  const unit = document.getElementById("elevationUnit").value;
  const tRef = parseFloat(document.getElementById("tRef").value);
  const roundMode = parseInt(document.getElementById("roundMode").value, 10);
  const roundStepRaw = document.getElementById("roundStep").value;
  const roundStep = roundMode === 0 ? 0 : parseInt(roundStepRaw, 10);

  if (isNaN(elevation) || isNaN(tRef)) {
    showToast(
      I18N.get(
        "messages.enterValid",
        "Please enter valid values for both Aerodrome Elevation and Reference Temperature.",
      ),
      "error",
    );
    return;
  }

  // Validate rounding step when rounding is active
  if (roundMode !== 0) {
    if (
      roundStepRaw === "" ||
      isNaN(roundStep) ||
      roundStep < 1 ||
      !Number.isInteger(parseFloat(roundStepRaw))
    ) {
      showToast(
        I18N.get(
          "isa.invalidStep",
          "Rounding step must be a positive integer.",
        ),
        "error",
      );
      return;
    }
  }

  // Convert elevation to feet if needed
  let elevationFt = elevation;
  if (unit === "m") {
    elevationFt = elevation / 0.3048;
  }

  // Calculate ISA temperature at the given elevation
  const tISA = 15 - 0.00198 * elevationFt;

  // Calculate the deviation from ISA
  const deltaISA = tRef - tISA;

  // Round up to nearest step; step=0 means no rounding
  const roundedDeltaISA =
    roundStep === 0 ? deltaISA : roundUpTo(deltaISA, roundStep);
  const roundedDisplay =
    roundStep === 0 ? roundedDeltaISA.toFixed(5) : String(roundedDeltaISA);

  document.getElementById("tISA").textContent = tISA.toFixed(5);
  document.getElementById("deltaISA").textContent = deltaISA.toFixed(5);
  document.getElementById("roundedDeltaISA").textContent = roundedDisplay;
  document.getElementById("finalISA").textContent = `ISA + ${roundedDisplay}`;

  // Show/hide non-integer warning
  var warningEl = document.getElementById("nonIntegerWarning");
  if (!Number.isInteger(roundedDeltaISA)) {
    warningEl.classList.remove("hidden");
  } else {
    warningEl.classList.add("hidden");
  }

  document.getElementById("results").classList.remove("hidden");
}

function saveParameters() {
  const params = {
    elevation: document.getElementById("elevation").value,
    elevationUnit: document.getElementById("elevationUnit").value,
    tRef: document.getElementById("tRef").value,
    roundMode: document.getElementById("roundMode").value,
    roundStep: document.getElementById("roundStep").value,
    icaoCode: document.getElementById("icaoCode").value,
  };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_${
    params.icaoCode || "ICAO"
  }_ISA_Calculation.json`;

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
      document.getElementById("elevation").value = data.elevation || "";

      if (data.elevationUnit) {
        const unitSelect = document.getElementById("elevationUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data.elevationUnit;
      }

      document.getElementById("tRef").value = data.tRef || "";
      if (data.roundMode) {
        document.getElementById("roundMode").value = data.roundMode;
      }
      document.getElementById("roundStep").value = data.roundStep || "5";
      // Show/hide roundStep group based on loaded mode
      var loadedMode = data.roundMode || "5";
      var grp = document.getElementById("roundStepGroup");
      if (loadedMode === "5") {
        grp.classList.add("hidden");
        document.getElementById("roundStep").disabled = false;
      } else if (loadedMode === "0") {
        grp.classList.remove("hidden");
        document.getElementById("roundStep").disabled = true;
      } else {
        grp.classList.remove("hidden");
        document.getElementById("roundStep").disabled = false;
      }
      document.getElementById("icaoCode").value = data.icaoCode || "";

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

function copyResultsToClipboard() {
  const icaoCode = document.getElementById("icaoCode").value || "N/A";
  const elevation = document.getElementById("elevation").value || "N/A";
  const elevationUnit = document.getElementById("elevationUnit").value || "N/A";
  const tRef = document.getElementById("tRef").value || "N/A";
  const roundModeSelect = document.getElementById("roundMode");
  const roundModeLabel =
    roundModeSelect.options[roundModeSelect.selectedIndex].text || "N/A";
  const roundStep = document.getElementById("roundStep").value || "N/A";
  const tISA = document.getElementById("tISA").textContent || "N/A";
  const deltaISA = document.getElementById("deltaISA").textContent || "N/A";
  const roundedDeltaISA =
    document.getElementById("roundedDeltaISA").textContent || "N/A";
  const finalISA = document.getElementById("finalISA").textContent || "N/A";

  // Create a formatted table as HTML with proper symbols and subscripts
  const htmlContent = `
        <table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">
          <tr style="background:#0c2240;color:#ffffff"><th style="padding:8px;text-align:left;font-weight:bold">Parameter</th><th style="padding:8px;text-align:left;font-weight:bold">Value</th></tr>
          <tr><td style="padding:8px;text-align:left">ICAO Airport Code</td><td style="padding:8px;text-align:left">${icaoCode}</td></tr>
          <tr><td style="padding:8px;text-align:left">Aerodrome Elevation</td><td style="padding:8px;text-align:left">${elevation} ${elevationUnit}</td></tr>
          <tr><td style="padding:8px;text-align:left">Reference Temperature</td><td style="padding:8px;text-align:left">${tRef} °C</td></tr>
          <tr><td style="padding:8px;text-align:left">Rounding Mode</td><td style="padding:8px;text-align:left">${roundModeLabel}</td></tr>
          <tr><td style="padding:8px;text-align:left">Rounding Step</td><td style="padding:8px;text-align:left">${roundStep}</td></tr>
          <tr><td style="padding:8px;text-align:left">T<sub>ISA</sub></td><td style="padding:8px;text-align:left">${tISA} °C</td></tr>
          <tr><td style="padding:8px;text-align:left">ΔISA</td><td style="padding:8px;text-align:left">${deltaISA} °C</td></tr>
          <tr><td style="padding:8px;text-align:left">Rounded ΔISA</td><td style="padding:8px;text-align:left">${roundedDeltaISA} °C</td></tr>
          <tr><td style="padding:8px;text-align:left">ISA + ΔISA</td><td style="padding:8px;text-align:left">${finalISA}</td></tr>
        </table>
      `;

  // Also create a plain-text fallback with readable symbols
  const textContent = [
    ["Parameter", "Value"],
    ["ICAO Airport Code", `${icaoCode}`],
    ["Aerodrome Elevation", `${elevation} ${elevationUnit}`],
    ["Reference Temperature", `${tRef} °C`],
    ["Rounding Mode", `${roundModeLabel}`],
    ["Rounding Step", `${roundStep}`],
    ["TISA", `${tISA} °C`],
    ["ΔISA", `${deltaISA} °C`],
    ["Rounded ΔISA", `${roundedDeltaISA} °C`],
    ["ISA + ΔISA", `${finalISA}`],
  ]
    .map((row) => row.join("\t"))
    .join("\n");

  // Create Blobs for the content
  const htmlBlob = new Blob([htmlContent], { type: "text/html" });
  const textBlob = new Blob([textContent], { type: "text/plain" });

  // Use Clipboard API to copy both HTML and plain-text representations
  navigator.clipboard
    .write([
      new ClipboardItem({
        [htmlBlob.type]: htmlBlob,
        [textBlob.type]: textBlob,
      }),
    ])
    .then(() => {
      showToast("Results copied — paste into Word.", "success");
    })
    .catch((err) => {
      console.error("Error copying content to clipboard:", err);
    });
}
