// ─── Constants ────────────────────────────────────────────────────────────────
var NM_TO_FT_ROD = 1852 / 0.3048; // ft per NM (matches aviation-utils.js FT_PER_NM)

// ─── Core formulas ────────────────────────────────────────────────────────────
function formatSeconds(totalSeconds, unit) {
  if (unit === "s") return Math.round(totalSeconds).toString();
  if (unit === "min") return (totalSeconds / 60).toFixed(2);
  var mins = Math.floor(totalSeconds / 60);
  var secs = Math.round(totalSeconds % 60);
  if (secs === 60) { mins++; secs = 0; }
  return mins + ":" + (secs < 10 ? "0" : "") + secs;
}

function computeTiming(distanceNM, gsKt, unit) {
  return formatSeconds((distanceNM / gsKt) * 3600, unit || "min:s");
}

function computeROD(gsKt, gradientPct) {
  return Math.round((gsKt * gradientPct * NM_TO_FT_ROD) / 100 / 60);
}

// ─── Gradient (%) ↔ VPA (°) conversion ─────────────────────────────────────────
function pctToVPA(pct) { return Math.atan(pct / 100) * 180 / Math.PI; }
function vpaToPct(deg) { return Math.tan(deg * Math.PI / 180) * 100; }
function gradientToPct(rawValue, mode) {
  return mode === "vpa" ? vpaToPct(rawValue) : rawValue;
}

function parseGSValues(raw) {
  var out = [];
  raw.split(",").forEach(function (s) {
    var n = parseInt(s.trim(), 10);
    if (!isNaN(n) && n > 0) out.push(n);
  });
  return out;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── State ────────────────────────────────────────────────────────────────────
var tableBlocks = [];
var rodGradientMode = "pct"; // "pct" | "vpa"

// ─── Gradient / VPA mode toggle ────────────────────────────────────────────────
function setRodGradientMode(mode) {
  if (mode === rodGradientMode) return;
  var input = document.getElementById("rodGradient");
  var raw = parseFloat(input.value);
  if (!isNaN(raw)) {
    var converted = mode === "vpa" ? pctToVPA(raw) : vpaToPct(raw);
    input.value = Math.round(converted * 100) / 100;
  }
  if (mode === "vpa") {
    input.max = "20";
  } else {
    input.max = "30";
  }
  document.getElementById("rodModePct").classList.toggle("rod-mode-btn-active", mode === "pct");
  document.getElementById("rodModePct").setAttribute("aria-pressed", mode === "pct");
  document.getElementById("rodModeVPA").classList.toggle("rod-mode-btn-active", mode === "vpa");
  document.getElementById("rodModeVPA").setAttribute("aria-pressed", mode === "vpa");
  rodGradientMode = mode;
}

// block shape:
// {
//   title   : string,
//   footer  : string,
//   gsLabel : string,   // "Ground Speed" header
//   gsUnit  : string,   // "KT"
//   gsColumns: string[], // ["70","90",…]
//   rows    : [{ label, unit, values: string[] }]
// }

// ─── Build a block from current form inputs ───────────────────────────────────
function createBlockFromInputs() {
  var distance    = parseFloat(document.getElementById("rodDistance").value);
  var gradientRaw = parseFloat(document.getElementById("rodGradient").value);
  var gradient    = gradientToPct(gradientRaw, rodGradientMode);
  var timingUnit = document.getElementById("rodTimingUnit").value;
  var gsUnit     = document.getElementById("rodGSUnit").value || "KT";
  var gsValues   = parseGSValues(document.getElementById("rodGSValues").value);
  var timingLabelInput = document.getElementById("rodTimingLabel").value.trim();
  var rodLabelInput    = document.getElementById("rodRODLabel").value.trim();
  var round5           = document.getElementById("rodRoundROD").checked;

  var timingLabel = timingLabelInput || "FAF-MAPt " + distance + "NM";
  var rodLabel    = rodLabelInput    || "Rate of Descent " + gradientRaw + (rodGradientMode === "vpa" ? "°" : "%");

  return {
    title    : document.getElementById("rodTitleRow").value.trim(),
    footer   : document.getElementById("rodFooterRow").value.trim(),
    gsLabel  : "Ground Speed",
    gsUnit   : gsUnit,
    gsColumns: gsValues.map(String),
    rows: [
      {
        label : timingLabel,
        unit  : timingUnit,
        values: gsValues.map(function (gs) { return computeTiming(distance, gs, timingUnit); })
      },
      {
        label : rodLabel,
        unit  : "ft/min",
        values: gsValues.map(function (gs) {
          var v = computeROD(gs, gradient);
          return String(round5 ? Math.round(v / 5) * 5 : v);
        })
      }
    ]
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateInputs() {
  var distance = parseFloat(document.getElementById("rodDistance").value);
  var gradient = parseFloat(document.getElementById("rodGradient").value);
  if (isNaN(distance) || distance <= 0) {
    showToast("Please enter a valid distance (NM > 0).", "error"); return false;
  }
  var maxGradient = rodGradientMode === "vpa" ? 20 : 30;
  if (isNaN(gradient) || gradient <= 0 || gradient > maxGradient) {
    showToast(
      rodGradientMode === "vpa"
        ? "Please enter a VPA between 0.1° and 20°."
        : "Please enter a gradient between 0.1% and 30%.",
      "error"
    );
    return false;
  }
  var gsValues = parseGSValues(document.getElementById("rodGSValues").value);
  if (gsValues.length === 0) {
    showToast("Please enter at least one valid GS value.", "error"); return false;
  }
  var seen = {};
  var dupes = [];
  gsValues.forEach(function (v) {
    if (seen[v]) dupes.push(v);
    else seen[v] = true;
  });
  if (dupes.length > 0) {
    showToast("Duplicate GS value(s): " + dupes.join(", ") + ". Remove duplicates before building.", "error");
    return false;
  }
  return true;
}

// ─── Build / Add ──────────────────────────────────────────────────────────────
function buildTable() {
  if (!validateInputs()) return;
  tableBlocks = [createBlockFromInputs()];
  renderAllBlocks();
  document.getElementById("rodEditor").classList.add("visible");
  document.getElementById("rodApp").classList.add("split");
  document.getElementById("btnAddBlock").disabled = false;
}

function addBlock() {
  if (!validateInputs()) return;
  tableBlocks.push(createBlockFromInputs());
  renderAllBlocks();
  // scroll editor into view on mobile
  document.getElementById("rodEditor").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function renderAllBlocks() {
  var container = document.getElementById("rodBlocks");
  container.innerHTML = "";
  tableBlocks.forEach(function (block, bi) {
    var el = buildBlockElement(block, bi);
    container.appendChild(el);
    attachCellListeners(el, bi);
  });
}

function buildBlockElement(block, bi) {
  var nCols     = block.gsColumns.length;
  var totalCols = nCols + 4; // row-ctrl | label | unit | gsColumns… | del

  var h = "";

  h += '<div class="rod-block">';
  h += '<div style="overflow-x:auto">';
  h += '<table class="rod-table">';

  // ── Title row (always editable) ──────────────────────────────────────────
  h += '<tr>';
  h += '<td colspan="' + totalCols + '" contenteditable="true" ' +
    'data-field="title" data-block="' + bi + '" data-ph="Title (leave blank to hide)" ' +
    'style="background:#0c2240;color:#fff;padding:7px 10px;font-weight:bold;font-size:0.8125rem">' +
    escapeHtml(block.title) + '</td>';
  h += '</tr>';

  // ── Column control row (← → ×, + add col) ───────────────────────────────
  h += '<tr style="background:rgba(15,23,42,0.35)">';
  h += '<td></td>'; // row-ctrl spacer
  h += '<td></td>'; // label spacer
  h += '<td></td>'; // unit spacer
  block.gsColumns.forEach(function (_, ci) {
    h += '<td style="padding:2px 3px;text-align:center;white-space:nowrap">';
    h += cbtn("←", "moveCol(" + bi + "," + ci + ",-1)", ci === 0);
    h += " ";
    h += cbtn("→", "moveCol(" + bi + "," + ci + ",1)", ci === nCols - 1);
    h += " ";
    h += cbtn("×", "delCol(" + bi + "," + ci + ")", false, true);
    h += '</td>';
  });
  h += '<td style="padding:2px 3px;text-align:center">';
  h += '<button type="button" class="rod-add-col-btn" onclick="addCol(' + bi + ')" title="Add column">+</button>';
  h += '</td>';
  h += '</tr>';

  // ── GS header row ────────────────────────────────────────────────────────
  h += '<tr style="background:#0c2240;color:#fff">';
  h += '<td style="width:22px;padding:2px"></td>'; // row-ctrl spacer
  h += '<th contenteditable="true" data-field="gsLabel" data-block="' + bi + '" ' +
    'style="padding:7px 10px;text-align:left;font-weight:bold;white-space:nowrap;min-width:130px">' +
    escapeHtml(block.gsLabel) + '</th>';
  h += '<th contenteditable="true" data-field="gsUnit" data-block="' + bi + '" ' +
    'style="padding:7px 10px;text-align:left;font-weight:bold;min-width:46px">' +
    escapeHtml(block.gsUnit) + '</th>';
  block.gsColumns.forEach(function (gs, ci) {
    h += '<th contenteditable="true" data-field="gsCol" data-block="' + bi + '" data-col="' + ci + '" ' +
      'style="padding:7px 10px;text-align:right;font-weight:bold;min-width:46px">' +
      escapeHtml(gs) + '</th>';
  });
  h += '<td style="width:22px;padding:2px"></td>'; // del spacer
  h += '</tr>';

  // ── Data rows ────────────────────────────────────────────────────────────
  block.rows.forEach(function (row, ri) {
    var isFirst = ri === 0;
    var isLast  = ri === block.rows.length - 1;
    h += '<tr style="border-bottom:1px solid rgba(148,163,184,0.18)">';

    // row move buttons
    h += '<td style="padding:1px 2px;white-space:nowrap;width:22px;vertical-align:middle">';
    h += rbtn("↑", "moveRow(" + bi + "," + ri + ",-1)", isFirst);
    h += rbtn("↓", "moveRow(" + bi + "," + ri + ",1)", isLast);
    h += '</td>';

    // label
    h += '<td contenteditable="true" data-field="rowLabel" data-block="' + bi + '" data-row="' + ri + '" ' +
      'data-ph="Row label" style="padding:7px 10px;font-weight:500;white-space:nowrap">' +
      escapeHtml(row.label) + '</td>';

    // unit
    h += '<td contenteditable="true" data-field="rowUnit" data-block="' + bi + '" data-row="' + ri + '" ' +
      'data-ph="unit" style="padding:7px 10px;color:#94a3b8;min-width:46px">' +
      escapeHtml(row.unit) + '</td>';

    // values
    row.values.forEach(function (val, ci) {
      h += '<td contenteditable="true" data-field="rowVal" data-block="' + bi + '" data-row="' + ri + '" data-col="' + ci + '" ' +
        'style="padding:7px 10px;text-align:right">' +
        escapeHtml(val) + '</td>';
    });

    // delete row
    h += '<td style="padding:1px 2px;text-align:center;vertical-align:middle;width:22px">';
    h += '<button type="button" class="rod-cbtn danger" onclick="delRow(' + bi + ',' + ri + ')" title="Delete row">×</button>';
    h += '</td>';

    h += '</tr>';
  });

  // ── Add row ──────────────────────────────────────────────────────────────
  h += '<tr style="border-top:1px solid rgba(148,163,184,0.12)">';
  h += '<td colspan="' + totalCols + '" style="padding:5px 8px">';
  h += '<button type="button" class="rod-add-row-btn" onclick="addRow(' + bi + ')">+ Add Row</button>';
  h += '</td>';
  h += '</tr>';

  // ── Footer row (always editable) ─────────────────────────────────────────
  h += '<tr>';
  h += '<td colspan="' + totalCols + '" contenteditable="true" ' +
    'data-field="footer" data-block="' + bi + '" data-ph="Footer (leave blank to hide)" ' +
    'style="padding:7px 10px;font-style:italic;color:#94a3b8;font-size:0.75rem">' +
    escapeHtml(block.footer) + '</td>';
  h += '</tr>';

  h += '</table>';
  h += '</div>'; // overflow-x

  // delete block button (only when >1 block)
  if (tableBlocks.length > 1) {
    h += '<div style="text-align:right;margin-top:6px">';
    h += '<button type="button" class="rod-del-block-btn" onclick="delBlock(' + bi + ')">Remove this table</button>';
    h += '</div>';
  }

  h += '</div>'; // rod-block

  var wrapper = document.createElement("div");
  wrapper.innerHTML = h;
  return wrapper.firstChild;
}

// Small helper for column control buttons
function cbtn(label, onclick, disabled, isDanger) {
  var cls = "rod-cbtn" + (isDanger ? " danger" : "");
  return '<button type="button" class="' + cls + '" onclick="' + onclick + '"' +
    (disabled ? " disabled" : "") + '>' + label + '</button>';
}

// Small helper for row move buttons
function rbtn(label, onclick, disabled) {
  return '<button type="button" class="rod-cbtn" onclick="' + onclick + '"' +
    (disabled ? " disabled" : "") + ' style="display:block;margin:1px auto">' + label + '</button>';
}

// ─── Cell edit → state sync ───────────────────────────────────────────────────
function attachCellListeners(container, bi) {
  // Duplicate-guard for inline GS column header edits
  container.querySelectorAll("[contenteditable][data-field='gsCol']").forEach(function (el) {
    el.addEventListener("focus", function () {
      el.dataset.prevVal = el.textContent.trim();
    });
    el.addEventListener("blur", function () {
      var block = tableBlocks[parseInt(el.dataset.block, 10)];
      if (!block) return;
      var ci = parseInt(el.dataset.col, 10);
      var val = el.textContent.trim();
      if (val === "") return;
      var isDupe = block.gsColumns.some(function (v, i) {
        return i !== ci && v.trim() === val;
      });
      if (isDupe) {
        var prev = el.dataset.prevVal || "";
        el.textContent = prev;
        block.gsColumns[ci] = prev;
        showToast("Duplicate GS value \"" + val + "\". Column reverted.", "error");
      }
    });
  });

  container.querySelectorAll("[contenteditable][data-field]").forEach(function (el) {
    el.addEventListener("input", function () {
      var block = tableBlocks[parseInt(el.dataset.block, 10)];
      if (!block) return;
      var val = el.textContent;
      switch (el.dataset.field) {
        case "title":   block.title = val; break;
        case "footer":  block.footer = val; break;
        case "gsLabel": block.gsLabel = val; break;
        case "gsUnit":  block.gsUnit = val; break;
        case "gsCol":
          block.gsColumns[parseInt(el.dataset.col, 10)] = val; break;
        case "rowLabel":
          block.rows[parseInt(el.dataset.row, 10)].label = val; break;
        case "rowUnit":
          block.rows[parseInt(el.dataset.row, 10)].unit = val; break;
        case "rowVal":
          block.rows[parseInt(el.dataset.row, 10)].values[parseInt(el.dataset.col, 10)] = val; break;
      }
    });
  });
}

// ─── Mutations (exposed globally for inline onclick) ─────────────────────────
function moveRow(bi, ri, dir) {
  var rows = tableBlocks[bi].rows;
  var ni = ri + dir;
  if (ni < 0 || ni >= rows.length) return;
  var tmp = rows[ri]; rows[ri] = rows[ni]; rows[ni] = tmp;
  renderAllBlocks();
}

function delRow(bi, ri) {
  tableBlocks[bi].rows.splice(ri, 1);
  renderAllBlocks();
}

function addRow(bi) {
  var block = tableBlocks[bi];
  block.rows.push({ label: "", unit: "", values: block.gsColumns.map(function () { return ""; }) });
  renderAllBlocks();
}

function moveCol(bi, ci, dir) {
  var block = tableBlocks[bi];
  var ni = ci + dir;
  if (ni < 0 || ni >= block.gsColumns.length) return;
  var tmp = block.gsColumns[ci];
  block.gsColumns[ci] = block.gsColumns[ni];
  block.gsColumns[ni] = tmp;
  block.rows.forEach(function (row) {
    var tv = row.values[ci]; row.values[ci] = row.values[ni]; row.values[ni] = tv;
  });
  renderAllBlocks();
}

function delCol(bi, ci) {
  var block = tableBlocks[bi];
  block.gsColumns.splice(ci, 1);
  block.rows.forEach(function (row) { row.values.splice(ci, 1); });
  renderAllBlocks();
}

function addCol(bi) {
  var block = tableBlocks[bi];
  block.gsColumns.push("");
  block.rows.forEach(function (row) { row.values.push(""); });
  renderAllBlocks();
}

function delBlock(bi) {
  tableBlocks.splice(bi, 1);
  if (tableBlocks.length === 0) {
    document.getElementById("rodEditor").classList.remove("visible");
    document.getElementById("rodApp").classList.remove("split");
    document.getElementById("btnAddBlock").disabled = true;
  } else {
    renderAllBlocks();
  }
}

// ─── Word export (from state) ─────────────────────────────────────────────────
function buildWordHTML() {
  return tableBlocks.map(function (block) {
    var nCols     = block.gsColumns.length;
    var totalCols = nCols + 2;
    var rows = "";

    if (block.title) {
      rows += '<tr style="background:#0c2240;color:#fff"><td colspan="' + totalCols +
        '" style="padding:7px 10px;font-weight:bold;font-size:11pt">' + escapeHtml(block.title) + '</td></tr>';
    }

    rows += '<tr style="background:#0c2240;color:#fff">';
    rows += '<th style="padding:7px 10px;text-align:left;font-weight:bold">' + escapeHtml(block.gsLabel || "Ground Speed") + '</th>';
    rows += '<th style="padding:7px 10px;text-align:left;font-weight:bold">' + escapeHtml(block.gsUnit) + '</th>';
    block.gsColumns.forEach(function (gs) {
      rows += '<th style="padding:7px 10px;text-align:right;font-weight:bold">' + escapeHtml(gs) + '</th>';
    });
    rows += '</tr>';

    block.rows.forEach(function (row) {
      rows += '<tr>';
      rows += '<td style="padding:7px 10px;font-weight:500">' + escapeHtml(row.label) + '</td>';
      rows += '<td style="padding:7px 10px">' + escapeHtml(row.unit) + '</td>';
      row.values.forEach(function (v) {
        rows += '<td style="padding:7px 10px;text-align:right">' + escapeHtml(v) + '</td>';
      });
      rows += '</tr>';
    });

    if (block.footer) {
      rows += '<tr><td colspan="' + totalCols + '" style="padding:7px 10px;font-style:italic">' +
        escapeHtml(block.footer) + '</td></tr>';
    }

    return '<table border="1" style="border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt">' +
      rows + '</table>';
  }).join("<br><br>");
}

function copyToWord() {
  if (tableBlocks.length === 0) { showToast("Build the table first.", "error"); return; }
  copyToClipboard(buildWordHTML());
}

// ─── Save / Load ──────────────────────────────────────────────────────────────
function saveParameters() {
  var data = {
    distance     : document.getElementById("rodDistance").value,
    gradient     : document.getElementById("rodGradient").value,
    gradientMode : rodGradientMode,
    titleRow   : document.getElementById("rodTitleRow").value,
    footerRow  : document.getElementById("rodFooterRow").value,
    timingLabel: document.getElementById("rodTimingLabel").value,
    rodLabel   : document.getElementById("rodRODLabel").value,
    gsUnit     : document.getElementById("rodGSUnit").value,
    timingUnit : document.getElementById("rodTimingUnit").value,
    gsValues   : document.getElementById("rodGSValues").value,
  };
  var ts   = new Date().toISOString().replace(/[:.]/g, "-");
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  var a    = document.createElement("a");
  a.href   = URL.createObjectURL(blob);
  a.download = ts + "_rod_timing.json";
  a.click();
}

function loadParameters(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var d = JSON.parse(e.target.result);
      if (d.gradientMode != null) setRodGradientMode(d.gradientMode);
      if (d.distance    != null) document.getElementById("rodDistance").value    = d.distance;
      if (d.gradient    != null) document.getElementById("rodGradient").value    = d.gradient;
      if (d.titleRow    != null) document.getElementById("rodTitleRow").value    = d.titleRow;
      if (d.footerRow   != null) document.getElementById("rodFooterRow").value   = d.footerRow;
      if (d.timingLabel != null) document.getElementById("rodTimingLabel").value = d.timingLabel;
      if (d.rodLabel    != null) document.getElementById("rodRODLabel").value    = d.rodLabel;
      if (d.gsUnit      != null) document.getElementById("rodGSUnit").value      = d.gsUnit;
      if (d.timingUnit  != null) document.getElementById("rodTimingUnit").value  = d.timingUnit;
      if (d.gsValues    != null) document.getElementById("rodGSValues").value    = d.gsValues;
      showToast("Parameters successfully loaded!", "success");
    } catch (_) {
      showToast("Invalid JSON file.", "error");
    }
  };
  reader.readAsText(file);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  checkDarkMode();

  document.getElementById("btnSave").addEventListener("click", saveParameters);
  document.getElementById("btnLoad").addEventListener("click", function () {
    document.getElementById("loadFile").click();
  });
  document.getElementById("loadFile").addEventListener("change", loadParameters);
  document.getElementById("btnCalcROD").addEventListener("click", buildTable);
  document.getElementById("btnAddBlock").addEventListener("click", addBlock);
  document.getElementById("btnCopy").addEventListener("click", copyToWord);
  document.getElementById("rodModePct").addEventListener("click", function () { setRodGradientMode("pct"); });
  document.getElementById("rodModeVPA").addEventListener("click", function () { setRodGradientMode("vpa"); });
});

(function () {
  function initI18n() {
    if (window.I18N) I18N.init({ defaultLang: "en", supported: ["en", "es"], path: "i18n" }).catch(console.error);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initI18n);
  else initI18n();
})();
