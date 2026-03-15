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
  const roundStep = parseInt(document.getElementById("roundStep").value || 5);

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

  // Convert elevation to feet if needed
  let elevationFt = elevation;
  if (unit === "m") {
    elevationFt = elevation / 0.3048;
  }

  // Calculate ISA temperature at the given elevation
  const tISA = 15 - 0.00198 * elevationFt;

  // Calculate the deviation from ISA
  const deltaISA = tRef - tISA;

  // Round up to the nearest step value
  const roundedDeltaISA = roundUpTo(deltaISA, roundStep);

  document.getElementById("tISA").textContent = tISA.toFixed(5);
  document.getElementById("deltaISA").textContent = deltaISA.toFixed(5);
  document.getElementById("roundedDeltaISA").textContent = roundedDeltaISA;
  document.getElementById("finalISA").textContent = `ISA + ${roundedDeltaISA}`;

  document.getElementById("results").classList.remove("hidden");
}

function saveParameters() {
  const params = {
    elevation: document.getElementById("elevation").value,
    elevationUnit: document.getElementById("elevationUnit").value,
    tRef: document.getElementById("tRef").value,
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
      document.getElementById("roundStep").value = data.roundStep || "5";
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
  const roundStep = document.getElementById("roundStep").value || "N/A";
  const tISA = document.getElementById("tISA").textContent || "N/A";
  const deltaISA = document.getElementById("deltaISA").textContent || "N/A";
  const roundedDeltaISA =
    document.getElementById("roundedDeltaISA").textContent || "N/A";
  const finalISA = document.getElementById("finalISA").textContent || "N/A";

  // Create a formatted table as HTML with proper symbols and subscripts
  const htmlContent = `
        <table border="1" style="border-collapse: collapse; text-align: center; width: 100%;">
          <tr style="background-color: #f1f5f9;"><th>Parameter</th><th>Value</th></tr>
          <tr><td>ICAO Airport Code</td><td>${icaoCode}</td></tr>
          <tr><td>Aerodrome Elevation</td><td>${elevation} ${elevationUnit}</td></tr>
          <tr><td>Reference Temperature</td><td>${tRef} °C</td></tr>
          <tr><td>Rounding Step</td><td>${roundStep}</td></tr>
          <tr><td>T<sub>ISA</sub></td><td>${tISA} °C</td></tr>
          <tr><td>ΔISA</td><td>${deltaISA} °C</td></tr>
          <tr><td>Rounded ΔISA</td><td>${roundedDeltaISA} °C</td></tr>
          <tr><td>ISA + ΔISA</td><td>${finalISA}</td></tr>
        </table>
      `;

  // Also create a plain-text fallback with readable symbols
  const textContent = [
    ["Parameter", "Value"],
    ["ICAO Airport Code", `${icaoCode}`],
    ["Aerodrome Elevation", `${elevation} ${elevationUnit}`],
    ["Reference Temperature", `${tRef} °C`],
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
      showToast(
        I18N.get(
          "messages.copied",
          "Formatted table copied to clipboard! You can paste it into Word or any text editor.",
        ),
        "success",
      );
    })
    .catch((err) => {
      console.error("Error copying content to clipboard:", err);
    });
}
