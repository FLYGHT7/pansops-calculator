const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ document: { addEventListener() {} } });
try {
  vm.runInContext(fs.readFileSync(path.join(root, "html/js/shared/aviation-utils.js"), "utf8"), context);
} catch (error) {
  // Existing shared UI hook calls the return value of addEventListener.
  // Its calculation helpers are already defined; do not mask other failures.
  assert.equal(error.message, "document.addEventListener(...) is not a function");
}
vm.runInContext(fs.readFileSync(path.join(root, "html/js/procedure_turn_80_260.js"), "utf8"), context);
const base = { iasKt: 220, altitudeFt: 6000, isaDeviationC: 15, unitSystem: "non-si" };
const compute = (inputs) => context.computeProcedureTurn80260(inputs);
const near = (actual, expected, tolerance = 1e-9) => {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
};

// Independently evaluated C-3 formulas, retaining precision instead of the
// source image's rounded intermediate values. Source order includes Wk=255E.
const examples = [
  {
    name: "NON-SI", inputs: base,
    expected: [1.1230996668, 247.0819266932, 0.0686338685, 2.0610977372,
      1.9079866559, 6, 59, 0.0163888889, 0.0079515341, 0.3431693426,
      0.6863386853, 0.9217137297, 1.2795327631, 1.6373517965, 1.9951708298,
      2.3529898632, 2.2734745225, 2.6312935558, 2.9891125892],
    units: ["", "kt", "NM/s", "°/s", "NM", "1000 ft", "kt", "NM/s", "NM/°"],
  },
  {
    name: "SI", inputs: { ...base, iasKt: 405 / 1.852, altitudeFt: 1850 / 0.3048, unitSystem: "si" },
    expected: [1.1243709646, 455.3702406598, 0.1264917335, 2.0714353196,
      3.4988571244, 1.85, 109.2, 0.0303333333, 0.0146436305, 0.6324586676,
      1.2649173352, 1.6997085887, 2.3586719593, 3.0176353298, 3.6765987003,
      4.3355620708, 4.1891257662, 4.8480891367, 5.5070525072],
    units: ["", "km/h", "km/s", "°/s", "km", "1000 m", "km/h", "km/s", "km/°"],
  },
];

for (const example of examples) {
  test(`${example.name}: all 19 reference values, source labels and units`, () => {
    const result = compute(example.inputs);
    assert.equal(result.rows.length, 19);
    assert.equal(context.validateInputs(example.inputs), null);
    const labels = ["K", "V", "v", "R", "r", "h", "w", "w′", "E", "ab",
      "dₑ = dₑ₁ = dₑ₂", "Wₑ₂", "Wg", "Wh", "Wi", "Wj", "Wk", "Wl", "Wm"];
    result.rows.forEach((row, index) => {
      assert.equal(row.line, index + 1);
      assert.equal(row.parameter, labels[index]);
      near(row.rawValue, example.expected[index]);
      assert.equal(row.unit, example.units[index] ?? (example.name === "SI" ? "km" : "NM"));
    });
    assert(result.rows[15].rawValue > result.rows[16].rawValue, "Wk must retain the source's 255 coefficient");
  });
}

test("both unit systems cap R at 3°/s and preserve slower turns", () => {
  for (const unitSystem of ["non-si", "si"]) {
    const inputs = { ...base, unitSystem };
    const capped = compute({ ...inputs, iasKt: 60 });
    assert(capped.rawRateDegS > 3);
    assert.equal(capped.rateDegS, 3);
    assert(compute(inputs).rateDegS < 3);
    const k = context.procedureTurn80260KFactor(inputs);
    const thresholdIas = (unitSystem === "si" ? 943.27 / 1.852 : 509.26) / (3 * k);
    near(compute({ ...inputs, iasKt: thresholdIas }).rateDegS, 3, 1e-12);
  }
});

test("reject invalid numeric, atmospheric and unit inputs", () => {
  for (const unitSystem of ["non-si", "si"]) {
    for (const invalid of [{ iasKt: 0 }, { iasKt: -1 }, { iasKt: NaN },
      { altitudeFt: -1 }, { altitudeFt: Infinity }, { altitudeFt: 200000 },
      { isaDeviationC: -400 }, { isaDeviationC: NaN }, { unitSystem: "unknown" },
      { iasKt: Number.MAX_VALUE }]) {
      assert(context.validateInputs({ ...base, unitSystem, ...invalid }));
    }
    assert.equal(context.validateInputs({ ...base, unitSystem, altitudeFt: 0, isaDeviationC: -15 }), null);
  }
});

test("display rounding never feeds into dependent results", () => {
  const result = compute(base);
  assert.equal(context.formatValue(result.rows[8].rawValue, 5), "0.00795");
  assert.equal(context.formatValue(result.rows[15].rawValue, 2), "2.35");
  assert.equal(context.formatValue(result.rows[16].rawValue, 2), "2.27");
  assert.equal(context.formatValue(compute(examples[1].inputs).rows[18].rawValue, 2), "5.51");
});
