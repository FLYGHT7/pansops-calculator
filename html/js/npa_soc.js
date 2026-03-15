// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  // Check for dark mode
  checkDarkMode();

  // Initialize unit selectors
  initializeUnitSelectors();

  // Set up event listeners
  setupEventListeners();

  // Initialize i18n (robust)
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
});

// Set up event listeners
function setupEventListeners() {
  // Aerodrome Elevation to Altitude sync
  const aeroInput = document.getElementById("aeroElev");
  const altitudeInput = document.getElementById("altitude");

  // Set initial altitude value
  altitudeInput.value = aeroInput.value;

  // Update altitude when aerodrome elevation changes
  aeroInput.addEventListener("input", function () {
    const overrideChk = document.getElementById("overrideAltitude").checked;
    if (!overrideChk) {
      altitudeInput.value = aeroInput.value;
      document.getElementById("altitudeNote").textContent = "";
    }
  });

  // Handle altitude override checkbox
  document
    .getElementById("overrideAltitude")
    .addEventListener("change", function () {
      const altInput = document.getElementById("altitude");
      if (this.checked) {
        altInput.disabled = false;
        document.getElementById("altitudeNote").textContent =
          "You have overridden the default altitude.";
      } else {
        altInput.disabled = true;
        altInput.value = document.getElementById("aeroElev").value;
        document.getElementById("altitudeNote").textContent = "";
      }
    });

  // Handle approach type radio buttons
  const approachRadios = document.querySelectorAll(
    'input[name="approachType"]',
  );
  approachRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      if (this.value === "CONV") {
        document.getElementById("att").readOnly = false;
        document.getElementById("overrideAttDiv").style.display = "none";
      } else {
        document.getElementById("att").readOnly = true;
        document.getElementById("overrideAttDiv").style.display = "block";
        document.getElementById("overrideAtt").checked = false;
      }
    });
  });

  // Handle ATT override checkbox
  document
    .getElementById("overrideAtt")
    .addEventListener("change", function () {
      const attInput = document.getElementById("att");
      if (this.checked) {
        attInput.readOnly = false;
      } else {
        attInput.readOnly = true;
        attInput.value = "0.2400"; // Reset to default value
      }
    });

  // Button and input event bindings
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", function () {
    document.getElementById("loadFile").click();
  });
  document
    .getElementById("loadFile")
    .addEventListener("change", loadParameters);
  document
    .getElementById("aeroElevUnit")
    .addEventListener("change", function () {
      handleUnitChange("aeroElev", "aeroElevUnit");
    });
  document
    .getElementById("btnCalculate")
    .addEventListener("click", calculateSOC);
  document
    .getElementById("btnCopy")
    .addEventListener("click", copyResultsToWord);
}

// Function to handle unit conversion when unit selector changes
function handleUnitChange(inputId, unitSelectId) {
  const input = document.getElementById(inputId);
  const unitSelect = document.getElementById(unitSelectId);
  const currentValue = parseFloat(input.value);

  if (!isNaN(currentValue)) {
    const oldUnit = unitSelect.dataset.lastUnit || unitSelect.value;
    const newUnit = unitSelect.value;

    // Only convert if the unit has changed
    if (oldUnit !== newUnit) {
      if (oldUnit === "ft" && newUnit === "m") {
        // Convert from feet to meters
        input.value = (currentValue * 0.3048).toFixed(2);
      } else if (oldUnit === "m" && newUnit === "ft") {
        // Convert from meters to feet
        input.value = (currentValue / 0.3048).toFixed(2);
      }
    }
  }

  // Save the current unit for the next change
  unitSelect.dataset.lastUnit = unitSelect.value;
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

// Main calculation function
function calculateSOC() {
  // Get Aerodrome Elevation
  const aeroElevVal = parseFloat(document.getElementById("aeroElev").value);
  const aeroElevUnit = document.getElementById("aeroElevUnit").value;

  if (isNaN(aeroElevVal)) {
    showToast("Please enter a valid Aerodrome Elevation.", "error");
    return;
  }

  // Convert to feet if needed
  const aeroElev_ft =
    aeroElevUnit === "ft" ? aeroElevVal : metersToFeet(aeroElevVal);

  // Get Altitude (either default or overridden)
  const overrideChk = document.getElementById("overrideAltitude").checked;
  let altitude_ft;

  if (overrideChk) {
    altitude_ft = parseFloat(document.getElementById("altitude").value);
    if (isNaN(altitude_ft)) {
      showToast("Please enter a valid Altitude.", "error");
      return;
    }

    // Update override display
    document.getElementById("overriddenValue").textContent =
      altitude_ft.toFixed(4);
    document.getElementById("originalAltitude").textContent =
      aeroElev_ft.toFixed(4);
    document.getElementById("overrideOutput").classList.remove("hidden");
  } else {
    altitude_ft = aeroElev_ft;
    document.getElementById("overrideOutput").classList.add("hidden");
  }

  // Get ISA Deviation
  const isaDeviation = parseFloat(document.getElementById("var").value);
  if (isNaN(isaDeviation)) {
    showToast("Please enter a valid ISA Deviation.", "error");
    return;
  }

  // Get IAS
  const ias = parseFloat(document.getElementById("ias").value);
  if (isNaN(ias)) {
    showToast("Please enter a valid IAS.", "error");
    return;
  }

  // Calculate k Factor using the utility function
  const kFactor = calculateKFactor(altitude_ft, isaDeviation);
  document.getElementById("kFactorOutput").textContent = kFactor.toFixed(4);

  // Calculate TAS using the utility function
  const tas = calculateTAS(ias, kFactor);
  document.getElementById("tasOutput").textContent = tas.toFixed(4) + " kts";

  // Get Wind
  const wind = parseFloat(document.getElementById("wind").value) || 10;

  // Calculate TAS + Wind
  const tasPlusWind = tas + wind;
  document.getElementById("tasWindOutput").textContent =
    tasPlusWind.toFixed(4) + " kts";

  // Calculate Transitional Distance (X) using the utility function
  const transDist = calculateTransitionalDistance(tasPlusWind);
  document.getElementById("transDistOutput").textContent =
    transDist.toFixed(4) + " NM";

  // Calculate Flight Distance (d) using the utility function
  const flightDist = calculateFlightDistance(tasPlusWind);
  document.getElementById("flightDistOutput").textContent =
    flightDist.toFixed(4) + " NM";

  // Calculate d + X
  const sumDist = transDist + flightDist;
  document.getElementById("sumDistOutput").textContent =
    sumDist.toFixed(4) + " NM";

  // Get ATT
  const att_input = parseFloat(document.getElementById("att").value);
  if (isNaN(att_input)) {
    showToast("Please enter a valid ATT.", "error");
    return;
  }

  // Format ATT output based on approach type
  let attOutputStr = "";
  const approachTypeVal = document.querySelector(
    'input[name="approachType"]:checked',
  ).value;

  if (approachTypeVal === "CONV") {
    attOutputStr = att_input.toFixed(4) + " NM (measured)";
  } else {
    if (Math.abs(att_input - 0.24) > 0.0001) {
      attOutputStr =
        "Overridden ATT: " +
        att_input.toFixed(4) +
        " NM<br>Default ATT: 0.2400 NM";
    } else {
      attOutputStr = att_input.toFixed(4) + " NM";
    }
  }
  document.getElementById("attOutput").innerHTML = attOutputStr;

  // Calculate MAPt to SOC Distance
  const maptSoc = att_input + sumDist;
  document.getElementById("maptSocOutput").textContent =
    maptSoc.toFixed(4) + " NM";

  // Update static outputs
  document.getElementById("aeroElevOutput").textContent =
    aeroElev_ft.toFixed(4) + " ft";
  document.getElementById("varOutput").textContent =
    isaDeviation.toFixed(4) + " °C";
  document.getElementById("iasOutput").textContent = ias.toFixed(4) + " kts";
  document.getElementById("altitudeOutput").textContent =
    altitude_ft.toFixed(4) + " ft";

  // Display Approach Type on output (use label text for i18n)
  const checkedRadio = document.querySelector(
    'input[name="approachType"]:checked',
  );
  let approachTypeDisplay = approachTypeVal;
  if (checkedRadio) {
    const label = checkedRadio.closest("label");
    const span = label ? label.querySelector("span") : null;
    if (span && span.textContent.trim()) {
      approachTypeDisplay = span.textContent.trim();
    }
  }
  document.getElementById("calcTypeOutput").textContent = approachTypeDisplay;

  // Display results
  document.getElementById("resultsOutput").classList.remove("hidden");
}

// Save parameters to a JSON file
function saveParameters() {
  const data = {
    "Aerodrome Elev": document.getElementById("aeroElev").value || "",
    aeroElevUnit: document.getElementById("aeroElevUnit").value || "ft",
    "ISA Deviation": document.getElementById("var").value || "",
    IAS: document.getElementById("ias").value || "",
    Altitude: document.getElementById("altitude").value || "",
    Override: document.getElementById("overrideAltitude").checked,
    Wind: document.getElementById("wind").value || "",
    ATT: document.getElementById("att").value || "",
    approachType:
      document.querySelector('input[name="approachType"]:checked')?.value || "",
  };

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_npa_soc.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Load parameters from a JSON file
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

      // Load all parameters
      if (data["Aerodrome Elev"]) {
        document.getElementById("aeroElev").value = data["Aerodrome Elev"];
      }

      if (data["aeroElevUnit"]) {
        const unitSelect = document.getElementById("aeroElevUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["aeroElevUnit"];
      }

      if (data["ISA Deviation"]) {
        document.getElementById("var").value = data["ISA Deviation"];
      }

      if (data["IAS"]) {
        document.getElementById("ias").value = data["IAS"];
      }

      if (data["Altitude"]) {
        document.getElementById("altitude").value = data["Altitude"];
      }

      if (data["Override"] !== undefined) {
        document.getElementById("overrideAltitude").checked = data["Override"];
        document.getElementById("altitude").disabled = !data["Override"];
      }

      if (data["Wind"]) {
        document.getElementById("wind").value = data["Wind"];
      }

      if (data["ATT"]) {
        document.getElementById("att").value = data["ATT"];
      }

      if (data["approachType"]) {
        const radioToCheck = document.querySelector(
          'input[name="approachType"][value="' + data["approachType"] + '"]',
        );
        if (radioToCheck) radioToCheck.checked = true;

        // Update ATT input based on approach type
        if (data["approachType"] === "CONV") {
          document.getElementById("att").readOnly = false;
          document.getElementById("overrideAttDiv").style.display = "none";
        } else {
          document.getElementById("att").readOnly = true;
          document.getElementById("overrideAttDiv").style.display = "block";
          document.getElementById("overrideAtt").checked = false;
        }
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

// Copy results to Word document
function copyResultsToWord() {
  // Get approach type
  const approachTypeVal =
    document.querySelector('input[name="approachType"]:checked').value || "N/A";
  // Use the on-page translated label text
  const checkedRadio = document.querySelector(
    'input[name="approachType"]:checked',
  );
  let approachTypeDisplay = approachTypeVal;
  if (checkedRadio) {
    const label = checkedRadio.closest("label");
    const span = label ? label.querySelector("span") : null;
    if (span && span.textContent.trim()) {
      approachTypeDisplay = span.textContent.trim();
    }
  }

  // Create data object for the table
  const tableData = {
    "Approach Type": approachTypeDisplay,
    "Aerodrome Elevation":
      document.getElementById("aeroElevOutput").textContent,
    "ISA Deviation": document.getElementById("varOutput").textContent,
    IAS: document.getElementById("iasOutput").textContent,
  };

  // Add altitude (either default or overridden)
  if (document.getElementById("overrideAltitude").checked) {
    tableData["Overridden Altitude"] =
      document.getElementById("overriddenValue").textContent + " ft";
    tableData["Default Altitude"] =
      document.getElementById("originalAltitude").textContent + " ft";
  } else {
    tableData["Altitude"] =
      document.getElementById("altitudeOutput").textContent;
  }

  // Add wind
  tableData["Wind"] =
    parseFloat(document.getElementById("wind").value).toFixed(4) + " kts";

  // Add ATT (format depends on approach type)
  const att_input = parseFloat(document.getElementById("att").value);
  if (approachTypeVal === "CONV") {
    tableData["ATT"] = att_input.toFixed(4) + " NM (measured)";
  } else if (Math.abs(att_input - 0.24) > 0.0001) {
    tableData["Overridden ATT"] = att_input.toFixed(4) + " NM";
    tableData["Default ATT"] = "0.2400 NM";
  } else {
    tableData["ATT"] = att_input.toFixed(4) + " NM";
  }

  // Add calculation results
  tableData["k Factor"] = document.getElementById("kFactorOutput").textContent;
  tableData["TAS"] = document.getElementById("tasOutput").textContent;
  tableData["TAS + Wind"] =
    document.getElementById("tasWindOutput").textContent;
  tableData["Transitional Distance (X)"] =
    document.getElementById("transDistOutput").textContent;
  tableData["Flight Distance (d)"] =
    document.getElementById("flightDistOutput").textContent;
  tableData["d + X"] = document.getElementById("sumDistOutput").textContent;
  tableData["MAPt to SOC Distance"] =
    document.getElementById("maptSocOutput").textContent;

  // Create HTML table and copy to clipboard
  const htmlContent = createHTMLTable(tableData, "NPA SOC Calculation Results");
  copyToClipboard(htmlContent);
}
