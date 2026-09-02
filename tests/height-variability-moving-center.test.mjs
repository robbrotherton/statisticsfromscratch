import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const d3 = require("../resources/js/d3.min.js");

const chapter = readFileSync(new URL("../04-variability.qmd", import.meta.url), "utf8");
const source = readFileSync(
  new URL("../resources/js/height-variability-interactive.js", import.meta.url),
  "utf8"
);

function movingCenterTutorial() {
  const start = chapter.indexOf("## The moving center");
  const end = chapter.indexOf("## Variability equations for samples", start);
  assert.ok(start >= 0 && end > start, "the moving-center tutorial should be present");
  return chapter.slice(start, end);
}

function loadMathHelpers() {
  const context = {
    console,
    d3,
    document: {},
    window: {
      bcStats: {},
      matchMedia() {
        return { matches: false };
      }
    }
  };
  vm.runInNewContext(source, context);
  return context;
}

test("the moving-center tutorial compares both centers before lining up the spans", () => {
  const tutorial = movingCenterTutorial();
  const titles = Array.from(tutorial.matchAll(/data-title="([^"]+)"/g), (match) => match[1]);
  const actions = Array.from(
    tutorial.matchAll(/data-action='([^']+)'/g),
    (match) => JSON.parse(match[1])
  );

  assert.deepEqual(titles, [
    "Population",
    "Take a sample",
    "From μ",
    "From M",
    "Line them up",
    "Can be high",
    "Can be low",
    "Keep sampling"
  ]);
  assert.match(tutorial, /heightVariability\.displaySampleSdFromMu/);
  assert.match(tutorial, /heightVariability\.displaySampleSdFromM/);
  assert.doesNotMatch(tutorial, /=\{\{< interactive-value/);
  assert.match(tutorial, /"axisMode":"center"/);
  assert.match(tutorial, /"axisLabel":false/);
  assert.match(tutorial, /"unitLabel":""/);
  assert.match(tutorial, /"sdScale":"population"/);
  assert.doesNotMatch(tutorial, /root mean squared|inches|height-sampling/i);
  assert.match(tutorial, /"show-fixed-center-rms":true/);
  assert.match(tutorial, /"focus-sample":true/);
  assert.match(tutorial, /red span fits inside the dashed blue one/);
  assert.match(tutorial, /data-repeat-label="New sample"/);

  assert.equal(actions[0]["show-sample"], false);
  assert.equal(actions[1]["show-sample"], true);
  assert.equal(actions[1]["focus-sample"], true);
  assert.equal(actions[1]["show-fixed-center-rms"], false);
  assert.equal(actions[1]["show-sample-sd"], false);
  assert.equal(actions[2]["show-fixed-center-rms"], true);
  assert.equal(actions[2]["show-sample-sd"], false);
  assert.equal(actions[3]["show-sample-sd"], true);
  assert.equal(actions[3]["sample-span-center"], "sample");
  assert.equal(actions[4]["sample-span-center"], "population");
  assert.equal(actions[7]["recenter-sample-span"], true);

  const repeatAction = JSON.parse(
    tutorial.match(/data-repeat-action='([^']+)'/)[1]
  );
  assert.equal(repeatAction["recenter-sample-span"], true);
});

test("deviations around the fitted mean cannot exceed deviations around mu", () => {
  const helpers = loadMathHelpers();
  const values = [62, 64, 65, 69, 71];
  const mu = 65;
  const mean = helpers.heightVariabilityMean(values);
  const aroundMean = helpers.heightVariabilityVariance(values, values.length);
  const aroundMu = helpers.heightVariabilityMeanSquaredDeviation(values, mu);

  assert.ok(aroundMean < aroundMu);
  assert.ok(Math.abs(aroundMu - (aroundMean + (mean - mu) ** 2)) < 1e-12);
});

test("the chosen follow-up samples preserve the high and low comparisons", () => {
  const helpers = loadMathHelpers();
  const population = helpers.heightVariabilityBuildPopulation({
    populationMean: 65,
    populationSd: 3,
    populationSize: 197,
    binWidth: 0.5
  });

  function sampleStats(drawIndex) {
    const values = helpers.heightVariabilitySampleFromPopulation(
      population,
      "height-variability-v1",
      drawIndex,
      10
    ).map((dot) => dot.value);
    const varianceAroundM = helpers.heightVariabilityVariance(values, values.length);
    const varianceAroundMu = helpers.heightVariabilityMeanSquaredDeviation(
      values,
      population.mean
    );
    return {
      sdAroundM: Math.sqrt(varianceAroundM),
      rmsAroundMu: Math.sqrt(varianceAroundMu)
    };
  }

  const high = sampleStats(12);
  const low = sampleStats(5);
  assert.ok(high.sdAroundM > population.sdN);
  assert.ok(low.sdAroundM < population.sdN);
  assert.ok(high.sdAroundM <= high.rmsAroundMu);
  assert.ok(low.sdAroundM <= low.rmsAroundMu);
});

test("the interactive exposes and distinguishes the fixed-center comparison", () => {
  assert.match(source, /sampleRmsDeviationFromPopulationMean/);
  assert.match(source, /hv-fixed-center-line/);
  assert.match(source, /stroke-dasharray: 6 4/);
  assert.match(source, /sample = comparisonLast \+ Math\.max/);
  assert.match(source, /case "show-fixed-center-rms":/);
  assert.match(source, /deviations from μ: SD =/);
  assert.match(source, /deviations from M: SD =/);
  assert.match(source, /centerOnlyAxis \? \[population\.mean\] : tickValues/);
  assert.match(source, /hv-population-center-mark/);
  assert.match(source, /hv-fixed-center-mark/);
  assert.match(source, /usePopulationSdScale \? value \/ population\.sdN : value/);
  assert.match(source, /displayPopulationSd: displaySd\(population\.sdN\)/);
  assert.match(source, /usePopulationSdScale\s*\? "1"/);
  assert.match(source, /displaySampleSdFromMu: displaySd/);
  assert.match(source, /displaySampleSdFromM: displaySd/);
  assert.match(source, /recenterSampleSpanOverride/);
  assert.match(source, /function growLineWithCaps/);
  assert.match(source, /function growThenShiftSampleSpan/);
  assert.match(source, /attr\("x1", centerX\)[\s\S]*attr\("x2", centerX\)/);
  assert.match(source, /attr\("x1", fittedCenterX\)[\s\S]*attr\("x2", fittedCenterX\)/);
  assert.match(source, /growFixedCenterSpan/);
  assert.match(source, /growSampleSpan/);
  assert.match(source, /spanMotionEnabled = animate && !trackingEnabled && !heightVariabilityReducedMotion/);
  assert.match(source, /animate: animate && !growFixedCenterSpan/);
  assert.match(source, /animate: animate && !growSampleSpan/);
});
