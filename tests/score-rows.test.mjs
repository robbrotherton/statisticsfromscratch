import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { divById, readChapter, tutorialSteps } from "./helpers/qmd.mjs";

function loadScoreRows() {
  const context = { console };
  context.window = context;
  vm.createContext(context);
  for (const name of ["d3.min.js", "score-rows.js"]) {
    const source = readFileSync(new URL(`../resources/js/${name}`, import.meta.url), "utf8");
    vm.runInContext(source, context, { filename: name });
  }
  return context.sfsScoreRows;
}

function figureOptions(qmd, figureId) {
  const match = new RegExp(`interactive-figure ${figureId} makeScoreRows options='([^']+)'`).exec(qmd);
  assert.ok(match, `makeScoreRows figure ${figureId} not found`);
  return JSON.parse(match[1]);
}

const rows = loadScoreRows();

test("paired statistics take each person's second score minus their first", () => {
  const groups = [
    { name: "Alone", values: [54, 67, 38, 46, 42] },
    { name: "Competition", values: [43, 57, 39, 41, 36] }
  ];
  const stats = rows.computeStats(groups, true);
  assert.equal(stats.paired, true);
  assert.deepEqual(Array.from(stats.differences), [-11, -10, 1, -5, -6]);
  assert.ok(Math.abs(stats.meanDifference - -6.2) < 1e-12);
  assert.ok(Math.abs(stats.meanDifference - (stats.means[1] - stats.means[0])) < 1e-12);
});

test("groups of different sizes cannot be paired", () => {
  const stats = rows.computeStats([{ values: [1, 2, 3] }, { values: [1, 2] }], true);
  assert.equal(stats.paired, false);
  assert.equal(stats.differences.length, 0);
  assert.equal(stats.meanDifference, null);
});

test("stacking separates ties and near neighbors, and leaves spaced dots on the row", () => {
  const ties = Array.from(rows.stackOffsets([5, 5, 5], { step: 10 }));
  assert.deepEqual([...ties].sort((a, b) => a - b), [-10, 0, 10]);

  assert.deepEqual(Array.from(rows.stackOffsets([1, 20, 40], { step: 10, minGap: 14 })), [0, 0, 0]);

  // 39 and 41 are 10 px apart at 5 px per unit: too close for 14 px dots.
  const near = Array.from(rows.stackOffsets([39, 41, 60], { step: 10, minGap: 14, position: (v) => v * 5 }));
  assert.notEqual(near[0], near[1]);
  assert.equal(near[2], 0);
});

test("upward stacking piles tied dots above the row only", () => {
  const offsets = Array.from(rows.stackOffsets([5, 7, 5, 5], { step: 3, minGap: 1e-6, upward: true }));
  assert.deepEqual(offsets, [0, 0, -3, -6]);
});

test("the difference axis keeps the score axis's scale and always includes zero", () => {
  const domain = rows.differenceDomain([-11, -10, 1, -5, -6], [30, 70]);
  assert.equal(domain[1] - domain[0], 40);
  assert.ok(domain[0] <= -11 && domain[1] >= 1);
  assert.ok(domain[0] < 0 && domain[1] > 0);

  const allPositive = rows.differenceDomain([3, 4], [0, 10]);
  assert.ok(allPositive[0] <= 0 && allPositive[1] >= 4);
});

test("anchored at the first mean, zero sits under it and the mean difference under the second mean", () => {
  const alone = [54, 67, 38, 46, 42];
  const competition = [43, 57, 39, 41, 36];
  const differences = competition.map((value, i) => value - alone[i]);
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  const domain = rows.differenceDomain(differences, [30, 70], mean(alone));
  const toScore = (d) => 30 + (d - domain[0]);
  assert.ok(Math.abs(toScore(0) - mean(alone)) < 1e-9);
  assert.ok(Math.abs(toScore(mean(differences)) - mean(competition)) < 1e-9);

  // A difference that would fall off the anchored axis falls back to centering.
  const fallback = rows.differenceDomain([-9], [0, 10], 8);
  assert.ok(fallback[0] <= -9 && fallback[1] >= 0);
});

test("paired people keep one color across rows; unpaired people never share one", () => {
  const groups = [{ values: [1, 2, 3, 4, 5] }, { values: [1, 2, 3, 4, 5] }];
  for (let i = 0; i < 5; i += 1) {
    assert.equal(rows.personColor(groups, 0, i, true), rows.personColor(groups, 1, i, true));
  }
  const unpaired = new Set();
  groups.forEach((group, g) => group.values.forEach((v, i) => unpaired.add(rows.personColor(groups, g, i, false))));
  assert.equal(unpaired.size, 10);
});

test("chapter 13's pairs tutorial uses Triplett's table and ends on the difference scores", () => {
  const qmd = readChapter("13-related-samples-t-test.qmd");
  const tableRows = Array.from(
    qmd.matchAll(/^\| [A-Z][a-z]+ [A-Z]\. \| (\d+) \| (\d+) \|$/gm),
    (match) => [Number(match[1]), Number(match[2])]
  );
  assert.equal(tableRows.length, 5);

  const options = figureOptions(qmd, "triplettScoreRows");
  assert.equal(options.paired, true);
  assert.equal(options.tutorial, true);
  assert.deepEqual(options.groups[0].values, tableRows.map((row) => row[0]));
  assert.deepEqual(options.groups[1].values, tableRows.map((row) => row[1]));
  assert.ok(options.differences);

  const steps = tutorialSteps(divById(qmd, "act-triplett-pairs"));
  assert.deepEqual(steps.map((step) => rows.normalizeStage(step.action.stage)),
    ["scores", "pairs", "differences", "differences", "differences", "differences", "differences"]);
  assert.deepEqual(steps.map((step) => rows.normalizeSpread(step.action.spread)), ["sd", "none", "none", "none", "sd", "se", "se"]);
  assert.deepEqual(steps.map((step) => step.action.meanGap), [false, false, false, true, true, true, true]);
  assert.deepEqual(steps.map((step) => step.action.tScale), [false, false, false, false, false, false, true]);

  // The tutorial follows the abstract design figure it makes concrete.
  assert.ok(qmd.indexOf("{#fig-design-dots}") < qmd.indexOf("{#act-triplett-pairs"));
});

test("the design figures show different people, then the same people twice", () => {
  const qmd = readChapter("13-related-samples-t-test.qmd");
  const independent = figureOptions(qmd, "independentDesignDotsReprise");
  const related = figureOptions(qmd, "relatedDesignDots");
  assert.notEqual(independent.paired, true);
  assert.equal(related.paired, true);
  assert.equal(related.groups[0].values.length, related.groups[1].values.length);
  assert.deepEqual(related.groups[0].values, independent.groups[0].values);
});

test("SDs, pooled SD, and the SD of differences match the chapters' worked values", () => {
  const spending = rows.computeStats([{ values: [4, 1, 7, 3, 5] }, { values: [6, 3, 5, 7, 4] }], false);
  assert.deepEqual(Array.from(spending.sumsOfSquares), [20, 10]);
  assert.ok(Math.abs(spending.sds[0] - Math.sqrt(5)) < 1e-12);
  assert.ok(Math.abs(spending.sds[1] - Math.sqrt(2.5)) < 1e-12);
  assert.ok(Math.abs(spending.pooledSd - Math.sqrt(3.75)) < 1e-12);
  assert.ok(Math.abs(spending.seDifference - Math.sqrt(1.5)) < 1e-12);

  const triplett = rows.computeStats([
    { values: [54, 67, 38, 46, 42] },
    { values: [43, 57, 39, 41, 36] }
  ], true);
  assert.ok(Math.abs(triplett.sdDifference - Math.sqrt(22.7)) < 1e-12);
  assert.ok(triplett.sdDifference < Math.min(...triplett.sds));
});

test("chapter 12's spending tutorial builds from means to the difference, spread, pooled SD and SE", () => {
  const qmd = readChapter("12-independent-samples-t-test.qmd");
  const listed = (label) => /^Spend on (self|other): (.+)$/m.test(qmd) &&
    new RegExp(`^Spend on ${label}: (.+)$`, "m").exec(qmd)[1].split("&emsp;").map(Number);
  const options = figureOptions(qmd, "spendingScoreRows");
  assert.deepEqual(options.groups[0].values, listed("self"));
  assert.deepEqual(options.groups[1].values, listed("other"));
  assert.equal(options.tutorial, true);
  assert.equal(options.middle, true);
  // Unique values within each row, so no dots need stacking.
  for (const group of options.groups) assert.equal(new Set(group.values).size, group.values.length);

  const steps = tutorialSteps(divById(qmd, "act-spending-rows")).map((step) => step.action);
  assert.deepEqual(steps.map((action) => rows.normalizeSpread(action.spread)), ["none", "none", "none", "sd", "pooled", "se", "se"]);
  assert.deepEqual(steps.map((action) => action.means), [false, true, true, true, true, true, true]);
  // The difference stays on screen from the moment it appears, so the
  // numerator and the denominator end up side by side.
  assert.deepEqual(steps.map((action) => action.meanGap), [false, false, true, true, true, true, true]);
  assert.deepEqual(steps.map((action) => action.tScale), [false, false, false, false, false, false, true]);

  // The tutorial comes before the formulas it illustrates.
  assert.ok(qmd.indexOf("{#act-spending-rows") < qmd.indexOf("### The numerator"));
  // Every step sets every switch, so stepping backward restores the state.
  for (const action of steps) {
    for (const key of ["means", "meanGap", "spread", "tScale"]) assert.ok(key in action, key);
  }
});

test("chapters using makeScoreRows load its script", () => {
  const manifest = readFileSync(new URL("../filters/interactive-scripts.lua", import.meta.url), "utf8");
  assert.match(manifest, /\["score-rows"\] = \{\s*file = "resources\/js\/score-rows\.js"/);
  for (const name of ["12-independent-samples-t-test.qmd", "13-related-samples-t-test.qmd"]) {
    const qmd = readChapter(name);
    assert.match(qmd, /makeScoreRows/);
    assert.match(qmd.split("---")[1], /- score-rows/);
  }
});

test("SD spans come from one shared helper wherever they are drawn", () => {
  const manifest = readFileSync(new URL("../filters/interactive-scripts.lua", import.meta.url), "utf8");
  assert.match(manifest, /\["span-marks"\] = \{\s*file = "resources\/js\/span-marks\.js"/);
  for (const name of ["score-rows", "height-variability-interactive", "distribution-generator"]) {
    const entry = new RegExp(`\\["${name}"\\] = \\{[^}]*deps = \\{[^}]*"span-marks"`);
    assert.match(manifest, entry, `${name} should load span-marks`);
    const source = readFileSync(new URL(`../resources/js/${name}.js`, import.meta.url), "utf8");
    assert.match(source, /sfsSpanMarks\.(append|set|grow)/, `${name} should draw spans with sfsSpanMarks`);
    assert.doesNotMatch(source, /bracket-cap|interval-caps|sr-strip/, `${name} should not draw its own caps`);
  }
});

test("chapter 11's tutorial pictures the class data against the reference and zooms only at the end", () => {
  const qmd = readChapter("11-t-test.qmd");
  const listed = JSON.parse(/classRtScores makeDataDisplay options='(\{[^']+\})'/.exec(qmd)[1]).values;
  const options = figureOptions(qmd, "classRtScoreRows");
  assert.deepEqual(options.groups[0].values, listed);
  assert.equal(options.reference.value, 284);
  assert.ok(options.zoomDomain[0] <= 284 && options.zoomDomain[1] >= 299, "zoom keeps the reference and the mean in view");

  const stats = rows.computeStats(options.groups, false);
  assert.ok(Math.abs(stats.seMean - 47.7552 / Math.sqrt(65)) < 1e-3);
  assert.ok(Math.abs((stats.means[0] - 284) / stats.seMean - 2.3947) < 1e-3);

  const steps = tutorialSteps(divById(qmd, "act-class-rt-rows")).map((step) => step.action);
  assert.deepEqual(steps.map((action) => rows.normalizeSpread(action.spread)), ["none", "none", "none", "sd", "se", "se", "se"]);
  assert.deepEqual(steps.map((action) => action.zoom), [false, false, false, false, false, true, true]);
  assert.deepEqual(steps.map((action) => action.tScale), [false, false, false, false, false, false, true]);

  // Ch 11 is published: the tutorial stays draft-only until its text is written.
  const fenceStart = qmd.lastIndexOf('{.content-visible when-profile="draft"}', qmd.indexOf("{#act-class-rt-rows"));
  assert.ok(fenceStart > 0);
});
