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

  // Initialize approach fields
  updateApproachFields();

  // Initialize unit selectors
  initializeUnitSelectors();

  // Event bindings
  document
    .getElementById("approachType")
    .addEventListener("change", updateApproach);
  document
    .getElementById("specificApproachType")
    .addEventListener("change", updateApproachFields);
  document.getElementById("btnLoad").addEventListener("click", function () {
    document.getElementById("loadFile").click();
  });
  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document
    .getElementById("loadFile")
    .addEventListener("change", loadParameters);
  document
    .getElementById("thrElevUnit")
    .addEventListener("change", function () {
      handleUnitChange("thrElev", "thrElevUnit");
    });
  document.getElementById("rdhUnit").addEventListener("change", function () {
    handleUnitChange("rdh", "rdhUnit");
  });
  document.getElementById("ochUnit").addEventListener("change", function () {
    handleUnitChange("och", "ochUnit");
  });
  document
    .getElementById("btnCalcDVSS")
    .addEventListener("click", calculateDVSS);
  document.getElementById("btnCalcOCS").addEventListener("click", calculateOCS);
  document.getElementById("btnCopyDVSS").addEventListener("click", function () {
    copyToWordDocument("dvss");
  });
  document.getElementById("btnCopyOCS").addEventListener("click", function () {
    copyToWordDocument("ocs");
  });
  document.getElementById("btnLoadB").addEventListener("click", function () {
    document.getElementById("loadFileB").click();
  });
  document
    .getElementById("btnSaveB")
    .addEventListener("click", saveParametersB);
  document
    .getElementById("loadFileB")
    .addEventListener("change", loadParametersB);
  document
    .getElementById("thrElevUnitB")
    .addEventListener("change", function () {
      handleUnitChange("thrElevB", "thrElevUnitB");
    });
  document.getElementById("rdhUnitB").addEventListener("change", function () {
    handleUnitChange("rdhB", "rdhUnitB");
  });
  document.getElementById("daDhUnit").addEventListener("change", function () {
    handleUnitChange("daDh", "daDhUnit");
  });
  document
    .getElementById("btnCalcApproach")
    .addEventListener("click", calculateApproachParameters);
  document.getElementById("btnCopyILS").addEventListener("click", function () {
    copyToWordDocument("ils");
  });
  document.getElementById("btnCopyAPV").addEventListener("click", function () {
    copyToWordDocument("apv");
  });
  document.getElementById("btnCopyLOC").addEventListener("click", function () {
    copyToWordDocument("loc");
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

// Update displayed container based on selected approach.
function updateApproach() {
  const approach = document.getElementById("approachType").value;
  const dynamicContainer = document.getElementById("dynamicContainer");
  if (approach === "straightInNpa") {
    dynamicContainer.classList.remove("hidden");
    document.getElementById("optionAContainer").classList.remove("hidden");
    document.getElementById("optionBContainer").classList.add("hidden");
  } else if (approach === "ilsApvLoc") {
    dynamicContainer.classList.remove("hidden");
    document.getElementById("optionAContainer").classList.add("hidden");
    document.getElementById("optionBContainer").classList.remove("hidden");
  }
}

// Update fields based on specific approach type
function updateApproachFields() {
  const approachType = document.getElementById("specificApproachType").value;

  // Hide all specific fields
  document.getElementById("ilsSpecificFields").classList.add("hidden");
  document.getElementById("apvSpecificFields").classList.add("hidden");
  document.getElementById("locSpecificFields").classList.add("hidden");

  // Show fields based on selected approach type
  if (approachType === "ils") {
    document.getElementById("ilsSpecificFields").classList.remove("hidden");
  } else if (approachType === "apv") {
    document.getElementById("apvSpecificFields").classList.remove("hidden");
  } else if (approachType === "loc") {
    document.getElementById("locSpecificFields").classList.remove("hidden");
  }
}

// Function to calculate VSS Distance.
// VSS Distance = OCH / tan(radians(VPA - 1.12))
function calculateDVSS() {
  // Hide OCS results.
  document.getElementById("resultsOCS").classList.add("hidden");

  const och = parseFloat(document.getElementById("och").value);
  const vpa = parseFloat(document.getElementById("vpa").value);
  const thrElev = parseFloat(document.getElementById("thrElev").value);
  const rdh = parseFloat(document.getElementById("rdh").value);
  const ochUnit = document.getElementById("ochUnit").value;

  if (isNaN(och) || isNaN(vpa) || isNaN(thrElev) || isNaN(rdh)) {
    showToast(
      "Please enter valid values for OCH, VPA, THR Elevation, and RDH.",
      "error",
    );
    return;
  }

  // Convert OCH to meters if needed
  let och_m = och;
  if (ochUnit === "ft") {
    och_m = och * 0.3048;
  }

  // Convert THR Elevation and RDH to meters
  let thrElev_m = thrElev;
  if (document.getElementById("thrElevUnit").value === "ft") {
    thrElev_m = thrElev * 0.3048;
  }

  let rdh_m = rdh;
  if (document.getElementById("rdhUnit").value === "ft") {
    rdh_m = rdh * 0.3048;
  }

  // Calculate VSS Distance in meters.
  const vssDistance_m = och_m / Math.tan((Math.PI / 180) * (vpa - 1.12));
  const vssDistance_nm = vssDistance_m / 1852;

  document.getElementById("dvssOutput").textContent =
    vssDistance_nm.toFixed(2) + " NM (" + vssDistance_m.toFixed(4) + " m)";

  // Display input values.
  document.getElementById("thrElevOutput").textContent =
    thrElev + " " + document.getElementById("thrElevUnit").value;
  document.getElementById("rdhOutput").textContent =
    rdh + " " + document.getElementById("rdhUnit").value;
  document.getElementById("vpaOutput").textContent = vpa.toFixed(2);
  document.getElementById("ochOutput").textContent =
    parseFloat(och).toFixed(4) + " " + ochUnit;

  // Show the VSS Distance results section.
  document.getElementById("resultsDVSS").classList.remove("hidden");
}

// Function to calculate OCS parameters.
function calculateOCS() {
  // Hide VSS Distance results.
  document.getElementById("resultsDVSS").classList.add("hidden");

  const och = parseFloat(document.getElementById("och").value);
  const rdh = parseFloat(document.getElementById("rdh").value);
  const vpa = parseFloat(document.getElementById("vpa").value);
  const thrElevInput = parseFloat(document.getElementById("thrElev").value);
  const thrElevUnit = document.getElementById("thrElevUnit").value;
  const ochUnit = document.getElementById("ochUnit").value;
  const rdhUnit = document.getElementById("rdhUnit").value;

  if (isNaN(och) || isNaN(rdh) || isNaN(vpa) || isNaN(thrElevInput)) {
    showToast(
      "Please enter valid values for OCH, RDH, VPA, and THR Elevation.",
      "error",
    );
    return;
  }

  // Convert values to meters if needed
  let och_m = och;
  if (ochUnit === "ft") {
    och_m = och * 0.3048;
  }

  let rdh_m = rdh;
  if (rdhUnit === "ft") {
    rdh_m = rdh * 0.3048;
  }

  let thrElev_m = thrElevInput;
  if (thrElevUnit === "ft") {
    thrElev_m = thrElevInput * 0.3048;
  }

  // Calculate OCS Length in meters.
  const ocsLength_m = (och_m - rdh_m) / Math.tan((Math.PI / 180) * vpa);
  const ocsLength_nm = ocsLength_m / 1852;

  // Calculate OCS E (Lateral) in meters.
  const ocsE_m = ocsLength_m * Math.tan((Math.PI / 180) * 2) + 120;
  const ocsE_nm = ocsE_m / 1852;

  // Calculate OCS Elevation:
  // If RDH <= 15 m, OCS Elevation is THR Elevation (in m),
  // otherwise, OCS Elevation = THR Elevation_m + (RDH - 15)
  let ocsElev;
  let adjustment;
  if (rdh_m <= 15) {
    ocsElev = thrElev_m;
    adjustment = 0;
  } else {
    adjustment = rdh_m - 15;
    ocsElev = thrElev_m + adjustment;
  }

  // Calculate OCS θ = VPA - 1°
  const ocsTheta = vpa - 1;

  document.getElementById("ocsLengthOutput").textContent =
    ocsLength_nm.toFixed(2) + " NM (" + ocsLength_m.toFixed(4) + " m)";
  document.getElementById("ocsEOutput").textContent =
    ocsE_nm.toFixed(2) + " NM (" + ocsE_m.toFixed(4) + " m)";

  document.getElementById("ocsElevOutput").textContent = ocsElev.toFixed(4);
  document.getElementById("ocsThetaOutput").textContent = ocsTheta.toFixed(2);

  // Output the RDH adjustment if any.
  document.getElementById("ocsAdjustOutput").textContent =
    adjustment.toFixed(4);

  // Show the OCS results section.
  document.getElementById("resultsOCS").classList.remove("hidden");
}

// Function to calculate parameters for ILS, APV, or LOC
function calculateApproachParameters() {
  // Hide all result sections
  document.getElementById("resultsILS").classList.add("hidden");
  document.getElementById("resultsAPV").classList.add("hidden");
  document.getElementById("resultsLOC").classList.add("hidden");

  const approachType = document.getElementById("specificApproachType").value;
  const thrElevInput = parseFloat(document.getElementById("thrElevB").value);
  const thrElevUnit = document.getElementById("thrElevUnitB").value;
  const rdh = parseFloat(document.getElementById("rdhB").value);
  const rdhUnit = document.getElementById("rdhUnitB").value;
  const gpAngle = parseFloat(document.getElementById("gpAngle").value);
  const aircraftCategory = document.getElementById("aircraftCategory").value;
  const daDhInput = parseFloat(document.getElementById("daDh").value);
  const daDhUnit = document.getElementById("daDhUnit").value;

  if (isNaN(thrElevInput) || isNaN(rdh) || isNaN(gpAngle) || isNaN(daDhInput)) {
    showToast("Please enter valid values for all required fields.", "error");
    return;
  }

  // Convert values to meters if needed
  let thrElev_m;
  if (thrElevUnit === "ft") {
    thrElev_m = thrElevInput * 0.3048;
  } else {
    thrElev_m = thrElevInput;
  }

  let rdh_m = rdh;
  if (rdhUnit === "ft") {
    rdh_m = rdh * 0.3048;
  }

  // Convert DA/DH to meters if needed
  let daDh_m;
  if (daDhUnit === "ft") {
    daDh_m = daDhInput * 0.3048;
  } else {
    daDh_m = daDhInput;
  }

  if (approachType === "ils") {
    calculateILS(thrElev_m, rdh_m, gpAngle, aircraftCategory, daDh_m);
  } else if (approachType === "apv") {
    calculateAPV(thrElev_m, rdh_m, gpAngle, aircraftCategory, daDh_m);
  } else if (approachType === "loc") {
    calculateLOC(thrElev_m, rdh_m, gpAngle, aircraftCategory, daDh_m);
  }
}

// Function to calculate ILS parameters
function calculateILS(thrElev_m, rdh, gpAngle, aircraftCategory, daDh_m) {
  const ilsCategory = document.getElementById("ilsCategory").value;

  // Calculate OAS Height (using DA/DH)
  const oasHeight = daDh_m;

  // Calculate OAS Length
  const oasLength = oasHeight / Math.tan((Math.PI / 180) * gpAngle);

  // Calculate OAS Width (varies by ILS category)
  let oasWidth;
  if (ilsCategory === "I") {
    oasWidth = oasLength * Math.tan((Math.PI / 180) * 2.5) + 150;
  } else if (ilsCategory === "II") {
    oasWidth = oasLength * Math.tan((Math.PI / 180) * 2.0) + 120;
  } else {
    // CAT III
    oasWidth = oasLength * Math.tan((Math.PI / 180) * 1.5) + 90;
  }

  // Display results
  document.getElementById("oasHeightOutput").textContent =
    oasHeight.toFixed(2) + " m";
  document.getElementById("oasLengthOutput").textContent =
    (oasLength / 1852).toFixed(2) + " NM (" + oasLength.toFixed(2) + " m)";
  document.getElementById("oasWidthOutput").textContent =
    (oasWidth / 1852).toFixed(2) + " NM (" + oasWidth.toFixed(2) + " m)";
  document.getElementById("ilsCategoryOutput").textContent =
    "CAT " + ilsCategory;

  // Show results section
  document.getElementById("resultsILS").classList.remove("hidden");
}

// Function to calculate APV parameters
function calculateAPV(thrElev_m, rdh, gpAngle, aircraftCategory, daDh_m) {
  const apvType = document.getElementById("apvType").value;

  // Calculate OAS Height (using DA/DH)
  const oasHeight = daDh_m;

  // Calculate OAS Length
  const oasLength = oasHeight / Math.tan((Math.PI / 180) * gpAngle);

  // Calculate OAS Width (varies by APV type)
  let oasWidth;
  if (apvType === "I") {
    oasWidth = oasLength * Math.tan((Math.PI / 180) * 3.0) + 180;
  } else {
    // APV II
    oasWidth = oasLength * Math.tan((Math.PI / 180) * 2.5) + 150;
  }

  // Display results
  document.getElementById("apvOasHeightOutput").textContent =
    oasHeight.toFixed(2) + " m";
  document.getElementById("apvOasLengthOutput").textContent =
    (oasLength / 1852).toFixed(2) + " NM (" + oasLength.toFixed(2) + " m)";
  document.getElementById("apvOasWidthOutput").textContent =
    (oasWidth / 1852).toFixed(2) + " NM (" + oasWidth.toFixed(2) + " m)";
  document.getElementById("apvTypeOutput").textContent = "APV " + apvType;

  // Show results section
  document.getElementById("resultsAPV").classList.remove("hidden");
}

// Function to calculate LOC parameters
function calculateLOC(thrElev_m, rdh, gpAngle, aircraftCategory, daDh_m) {
  const locSensitivity = parseFloat(
    document.getElementById("locSensitivity").value,
  );

  if (isNaN(locSensitivity)) {
    showToast("Please enter a valid LOC Sensitivity value.", "error");
    return;
  }

  // Calculate OAS Height (using DA/DH)
  const oasHeight = daDh_m;

  // Calculate OAS Length
  const oasLength = oasHeight / Math.tan((Math.PI / 180) * gpAngle);

  // Calculate OAS Width (based on LOC sensitivity)
  const oasWidth = oasLength * Math.tan((Math.PI / 180) * 3.5) + 200;

  // Display results
  document.getElementById("locOasHeightOutput").textContent =
    oasHeight.toFixed(2) + " m";
  document.getElementById("locOasLengthOutput").textContent =
    (oasLength / 1852).toFixed(2) + " NM (" + oasLength.toFixed(2) + " m)";
  document.getElementById("locOasWidthOutput").textContent =
    (oasWidth / 1852).toFixed(2) + " NM (" + oasWidth.toFixed(2) + " m)";
  document.getElementById("locSensitivityOutput").textContent =
    locSensitivity.toFixed(2);

  // Show results section
  document.getElementById("resultsLOC").classList.remove("hidden");
}

// Function to load parameters from a JSON file.
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
      if (data["THR Elev"])
        document.getElementById("thrElev").value = data["THR Elev"];
      if (data["thrElevUnit"]) {
        const unitSelect = document.getElementById("thrElevUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["thrElevUnit"];
      }
      if (data["RDH"]) document.getElementById("rdh").value = data["RDH"];
      if (data["rdhUnit"]) {
        const unitSelect = document.getElementById("rdhUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["rdhUnit"];
      }
      if (data["VPA"]) document.getElementById("vpa").value = data["VPA"];
      if (data["OCH"]) document.getElementById("och").value = data["OCH"];
      if (data["ochUnit"]) {
        const unitSelect = document.getElementById("ochUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["ochUnit"];
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

// Function to load parameters for ILS/APV/LOC
function loadParametersB(event) {
  const file = event.target.files[0];
  if (!file) {
    showToast("Please select a valid JSON file.", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data["THR Elev"])
        document.getElementById("thrElevB").value = data["THR Elev"];
      if (data["thrElevUnit"]) {
        const unitSelect = document.getElementById("thrElevUnitB");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["thrElevUnit"];
      }
      if (data["RDH"]) document.getElementById("rdhB").value = data["RDH"];
      if (data["rdhUnit"]) {
        const unitSelect = document.getElementById("rdhUnitB");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["rdhUnit"];
      }
      if (data["GP Angle"])
        document.getElementById("gpAngle").value = data["GP Angle"];
      if (data["Aircraft Category"])
        document.getElementById("aircraftCategory").value =
          data["Aircraft Category"];
      if (data["DA/DH"]) document.getElementById("daDh").value = data["DA/DH"];
      if (data["daDhUnit"]) {
        const unitSelect = document.getElementById("daDhUnit");
        unitSelect.dataset.lastUnit = unitSelect.value; // Save current unit
        unitSelect.value = data["daDhUnit"];
      }
      if (data["Approach Type"]) {
        document.getElementById("specificApproachType").value =
          data["Approach Type"];
        updateApproachFields();
      }
      if (data["ILS Category"])
        document.getElementById("ilsCategory").value = data["ILS Category"];
      if (data["APV Type"])
        document.getElementById("apvType").value = data["APV Type"];
      if (data["LOC Sensitivity"])
        document.getElementById("locSensitivity").value =
          data["LOC Sensitivity"];
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

// Function to save parameters to a JSON file.
function saveParameters() {
  const thrElev = document.getElementById("thrElev").value || "";
  const thrElevUnit = document.getElementById("thrElevUnit").value || "ft";
  const rdh = document.getElementById("rdh").value || "";
  const rdhUnit = document.getElementById("rdhUnit").value || "m";
  const vpa = document.getElementById("vpa").value || "";
  const och = document.getElementById("och").value || "";
  const ochUnit = document.getElementById("ochUnit").value || "m";

  const data = {
    "THR Elev": thrElev,
    thrElevUnit: thrElevUnit,
    RDH: rdh,
    rdhUnit: rdhUnit,
    VPA: vpa,
    OCH: och,
    ochUnit: ochUnit,
  };

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_vssocs.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Function to save parameters for ILS/APV/LOC
function saveParametersB() {
  const thrElev = document.getElementById("thrElevB").value || "";
  const thrElevUnit = document.getElementById("thrElevUnitB").value || "ft";
  const rdh = document.getElementById("rdhB").value || "";
  const rdhUnit = document.getElementById("rdhUnitB").value || "m";
  const gpAngle = document.getElementById("gpAngle").value || "";
  const aircraftCategory =
    document.getElementById("aircraftCategory").value || "";
  const daDh = document.getElementById("daDh").value || "";
  const daDhUnit = document.getElementById("daDhUnit").value || "ft";
  const approachType =
    document.getElementById("specificApproachType").value || "";

  const data = {
    "THR Elev": thrElev,
    thrElevUnit: thrElevUnit,
    RDH: rdh,
    rdhUnit: rdhUnit,
    "GP Angle": gpAngle,
    "Aircraft Category": aircraftCategory,
    "DA/DH": daDh,
    daDhUnit: daDhUnit,
    "Approach Type": approachType,
  };

  // Add approach-specific parameters
  if (approachType === "ils") {
    data["ILS Category"] = document.getElementById("ilsCategory").value || "";
  } else if (approachType === "apv") {
    data["APV Type"] = document.getElementById("apvType").value || "";
  } else if (approachType === "loc") {
    data["LOC Sensitivity"] =
      document.getElementById("locSensitivity").value || "";
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}_ilsapvloc.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// Function to copy results as an HTML table for Word.
// 'type' is either "dvss", "ocs", "ils", "apv", or "loc". Each table will have two columns with 50% width.
function copyToWordDocument(type) {
  let htmlContent = "";
  let textRows = [];
  if (type === "dvss") {
    const thrElev = document.getElementById("thrElev").value || "N/A";
    const thrElevUnit = document.getElementById("thrElevUnit").value || "N/A";
    const rdh = document.getElementById("rdh").value || "N/A";
    const rdhUnit = document.getElementById("rdhUnit").value || "N/A";
    const vpa = document.getElementById("vpa").value || "N/A";
    const och = document.getElementById("och").value || "N/A";
    const ochUnit = document.getElementById("ochUnit").value || "N/A";
    const vssDistance =
      document.getElementById("dvssOutput").textContent || "N/A";

    htmlContent = `
          <table border="1" style="border-collapse: collapse; text-align: center; width: 100%;">
            <tr style="background-color: #f1f5f9;"><th>Parameter</th><th>Value</th></tr>
            <tr><td>THR Elev</td><td>${thrElev} ${thrElevUnit}</td></tr>
            <tr><td>RDH</td><td>${rdh} ${rdhUnit}</td></tr>
            <tr><td>VPA (°)</td><td>${parseFloat(vpa).toFixed(2)}</td></tr>
            <tr><td>OCH</td><td>${parseFloat(och).toFixed(
              4,
            )} ${ochUnit}</td></tr>
            <tr><td>VSS Distance</td><td>${vssDistance}</td></tr>
          </table>`;

    textRows = [
      ["Parameter", "Value"],
      ["THR Elev", `${thrElev} ${thrElevUnit}`],
      ["RDH", `${rdh} ${rdhUnit}`],
      ["VPA (°)", `${parseFloat(vpa).toFixed(2)}`],
      ["OCH", `${parseFloat(och).toFixed(4)} ${ochUnit}`],
      ["VSS Distance", `${vssDistance}`],
    ];
  } else if (type === "ocs") {
    const och = document.getElementById("och").value || "N/A";
    const ochUnit = document.getElementById("ochUnit").value || "N/A";
    const rdh = document.getElementById("rdh").value || "N/A";
    const rdhUnit = document.getElementById("rdhUnit").value || "N/A";
    const vpa = document.getElementById("vpa").value || "N/A";
    const ocsLength =
      document.getElementById("ocsLengthOutput").textContent || "N/A";
    const ocsE = document.getElementById("ocsEOutput").textContent || "N/A";
    const ocsElev =
      document.getElementById("ocsElevOutput").textContent || "N/A";
    const ocsTheta =
      document.getElementById("ocsThetaOutput").textContent || "N/A";
    const ocsAdjust =
      document.getElementById("ocsAdjustOutput").textContent || "N/A";

    htmlContent = `
          <table border="1" style="border-collapse: collapse; text-align: center; width: 100%;">
            <tr style="background-color: #f1f5f9;"><th>Parameter</th><th>Value</th></tr>
            <tr><td>OCH</td><td>${parseFloat(och).toFixed(
              4,
            )} ${ochUnit}</td></tr>
            <tr><td>RDH</td><td>${rdh} ${rdhUnit}</td></tr>
            <tr><td>VPA (°)</td><td>${parseFloat(vpa).toFixed(2)}</td></tr>
            <tr><td>OCS Length</td><td>${ocsLength}</td></tr>
            <tr><td>OCS E (Lateral)</td><td>${ocsE}</td></tr>
            <tr><td>OCS Elevation</td><td>${parseFloat(ocsElev).toFixed(
              4,
            )} m</td></tr>
            <tr><td>OCS θ</td><td>${parseFloat(ocsTheta).toFixed(2)}°</td></tr>
            <tr><td>OCS Elevation Adjustment</td><td>${parseFloat(
              ocsAdjust,
            ).toFixed(4)} m</td></tr>
          </table>`;

    textRows = [
      ["Parameter", "Value"],
      ["OCH", `${parseFloat(och).toFixed(4)} ${ochUnit}`],
      ["RDH", `${rdh} ${rdhUnit}`],
      ["VPA (°)", `${parseFloat(vpa).toFixed(2)}`],
      ["OCS Length", `${ocsLength}`],
      ["OCS E (Lateral)", `${ocsE}`],
      ["OCS Elevation", `${parseFloat(ocsElev).toFixed(4)} m`],
      ["OCS θ", `${parseFloat(ocsTheta).toFixed(2)}°`],
      ["OCS Elevation Adjustment", `${parseFloat(ocsAdjust).toFixed(4)} m`],
    ];
  } else if (type === "ils") {
    const thrElev = document.getElementById("thrElevB").value || "N/A";
    const thrElevUnit = document.getElementById("thrElevUnitB").value || "N/A";
    const rdh = document.getElementById("rdhB").value || "N/A";
    const rdhUnit = document.getElementById("rdhUnitB").value || "N/A";
    const gpAngle = document.getElementById("gpAngle").value || "N/A";
    const daDh = document.getElementById("daDh").value || "N/A";
    const daDhUnit = document.getElementById("daDhUnit").value || "N/A";
    const ilsCategory = document.getElementById("ilsCategory").value || "N/A";
    const oasHeight =
      document.getElementById("oasHeightOutput").textContent || "N/A";
    const oasLength =
      document.getElementById("oasLengthOutput").textContent || "N/A";
    const oasWidth =
      document.getElementById("oasWidthOutput").textContent || "N/A";

    htmlContent = `
          <table border="1" style="border-collapse: collapse; text-align: center; width: 100%;">
            <tr style="background-color: #f1f5f9;"><th>Parameter</th><th>Value</th></tr>
            <tr><td>THR Elev</td><td>${thrElev} ${thrElevUnit}</td></tr>
            <tr><td>RDH</td><td>${rdh} ${rdhUnit}</td></tr>
            <tr><td>GP Angle (°)</td><td>${parseFloat(gpAngle).toFixed(
              2,
            )}</td></tr>
            <tr><td>DA/DH</td><td>${daDh} ${daDhUnit}</td></tr>
            <tr><td>ILS Category</td><td>CAT ${ilsCategory}</td></tr>
            <tr><td>OAS Height</td><td>${oasHeight}</td></tr>
            <tr><td>OAS Length</td><td>${oasLength}</td></tr>
            <tr><td>OAS Width</td><td>${oasWidth}</td></tr>
          </table>`;

    textRows = [
      ["Parameter", "Value"],
      ["THR Elev", `${thrElev} ${thrElevUnit}`],
      ["RDH", `${rdh} ${rdhUnit}`],
      ["GP Angle (°)", `${parseFloat(gpAngle).toFixed(2)}`],
      ["DA/DH", `${daDh} ${daDhUnit}`],
      ["ILS Category", `CAT ${ilsCategory}`],
      ["OAS Height", `${oasHeight}`],
      ["OAS Length", `${oasLength}`],
      ["OAS Width", `${oasWidth}`],
    ];
  } else if (type === "apv") {
    const thrElev = document.getElementById("thrElevB").value || "N/A";
    const thrElevUnit = document.getElementById("thrElevUnitB").value || "N/A";
    const rdh = document.getElementById("rdhB").value || "N/A";
    const rdhUnit = document.getElementById("rdhUnitB").value || "N/A";
    const gpAngle = document.getElementById("gpAngle").value || "N/A";
    const daDh = document.getElementById("daDh").value || "N/A";
    const daDhUnit = document.getElementById("daDhUnit").value || "N/A";
    const apvType = document.getElementById("apvType").value || "N/A";
    const oasHeight =
      document.getElementById("apvOasHeightOutput").textContent || "N/A";
    const oasLength =
      document.getElementById("apvOasLengthOutput").textContent || "N/A";
    const oasWidth =
      document.getElementById("apvOasWidthOutput").textContent || "N/A";

    htmlContent = `
          <table border="1" style="border-collapse: collapse; text-align: center; width: 100%;">
            <tr style="background-color: #f1f5f9;"><th>Parameter</th><th>Value</th></tr>
            <tr><td>THR Elev</td><td>${thrElev} ${thrElevUnit}</td></tr>
            <tr><td>RDH</td><td>${rdh} ${rdhUnit}</td></tr>
            <tr><td>GP Angle (°)</td><td>${parseFloat(gpAngle).toFixed(
              2,
            )}</td></tr>
            <tr><td>DA/DH</td><td>${daDh} ${daDhUnit}</td></tr>
            <tr><td>APV Type</td><td>APV ${apvType}</td></tr>
            <tr><td>OAS Height</td><td>${oasHeight}</td></tr>
            <tr><td>OAS Length</td><td>${oasLength}</td></tr>
            <tr><td>OAS Width</td><td>${oasWidth}</td></tr>
          </table>`;

    textRows = [
      ["Parameter", "Value"],
      ["THR Elev", `${thrElev} ${thrElevUnit}`],
      ["RDH", `${rdh} ${rdhUnit}`],
      ["GP Angle (°)", `${parseFloat(gpAngle).toFixed(2)}`],
      ["DA/DH", `${daDh} ${daDhUnit}`],
      ["APV Type", `APV ${apvType}`],
      ["OAS Height", `${oasHeight}`],
      ["OAS Length", `${oasLength}`],
      ["OAS Width", `${oasWidth}`],
    ];
  } else if (type === "loc") {
    const thrElev = document.getElementById("thrElevB").value || "N/A";
    const thrElevUnit = document.getElementById("thrElevUnitB").value || "N/A";
    const rdh = document.getElementById("rdhB").value || "N/A";
    const rdhUnit = document.getElementById("rdhUnitB").value || "N/A";
    const gpAngle = document.getElementById("gpAngle").value || "N/A";
    const daDh = document.getElementById("daDh").value || "N/A";
    const daDhUnit = document.getElementById("daDhUnit").value || "N/A";
    const locSensitivity =
      document.getElementById("locSensitivity").value || "N/A";
    const oasHeight =
      document.getElementById("locOasHeightOutput").textContent || "N/A";
    const oasLength =
      document.getElementById("locOasLengthOutput").textContent || "N/A";
    const oasWidth =
      document.getElementById("locOasWidthOutput").textContent || "N/A";

    htmlContent = `
          <table border="1" style="border-collapse: collapse; text-align: center; width: 100%;">
            <tr style="background-color: #f1f5f9;"><th>Parameter</th><th>Value</th></tr>
            <tr><td>THR Elev</td><td>${thrElev} ${thrElevUnit}</td></tr>
            <tr><td>RDH</td><td>${rdh} ${rdhUnit}</td></tr>
            <tr><td>GP Angle (°)</td><td>${parseFloat(gpAngle).toFixed(
              2,
            )}</td></tr>
            <tr><td>DA/DH</td><td>${daDh} ${daDhUnit}</td></tr>
            <tr><td>LOC Sensitivity</td><td>${parseFloat(
              locSensitivity,
            ).toFixed(2)}</td></tr>
            <tr><td>OAS Height</td><td>${oasHeight}</td></tr>
            <tr><td>OAS Length</td><td>${oasLength}</td></tr>
            <tr><td>OAS Width</td><td>${oasWidth}</td></tr>
          </table>`;

    textRows = [
      ["Parameter", "Value"],
      ["THR Elev", `${thrElev} ${thrElevUnit}`],
      ["RDH", `${rdh} ${rdhUnit}`],
      ["GP Angle (°)", `${parseFloat(gpAngle).toFixed(2)}`],
      ["DA/DH", `${daDh} ${daDhUnit}`],
      ["LOC Sensitivity", `${parseFloat(locSensitivity).toFixed(2)}`],
      ["OAS Height", `${oasHeight}`],
      ["OAS Length", `${oasLength}`],
      ["OAS Width", `${oasWidth}`],
    ];
  }

  const blob = new Blob([htmlContent], { type: "text/html" });
  const textContent = textRows.map((r) => r.join("\t")).join("\n");
  const textBlob = new Blob([textContent], { type: "text/plain" });
  navigator.clipboard
    .write([new ClipboardItem({ "text/html": blob, "text/plain": textBlob })])
    .then(() => {
      showToast(
        "Results copied — paste into Word or a text editor.",
        "success",
      );
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
