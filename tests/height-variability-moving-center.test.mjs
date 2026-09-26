import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

import { divById, tutorialSteps } from "./helpers/qmd.mjs";

const require = createRequire(import.meta.url);
const d3 = require("../resources/js/d3.min.js");

const chapter = readFileSync(new URL("../04-variability.qmd", import.meta.url), "utf8");
const source = readFileSync(
  new URL("../resources/js/height-variability-interactive.js", import.meta.url),
  "utf8"
);

function movingCenterTutorial() {
  return divById(chapter, "act-moving-center");
}

function trackingBiasTutorial() {
  return divById(chapter, "act-tracking-bias");
}

function loadMathHelpers() {
  const context = {
    console,
    d3,
    document: {},
    window: {
      sfsStats: {},
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
  const actions = tutorialSteps(tutorial).map((step) => step.action);
  const fromMu = actions.findIndex((action) => action["deviation-guides"] === "population");
  const fromM = actions.findIndex((action) => action["deviation-guides"] === "sample");
  const linedUp = actions.findIndex((action) => action["sample-span-center"] === "population");

  assert.match(tutorial, /heightVariability\.displaySampleSdFromMu/);
  assert.match(tutorial, /heightVariability\.displaySampleSdFromM/);
  assert.doesNotMatch(tutorial, /=\{\{< interactive-value/);
  assert.match(tutorial, /"axisMode":"center"/);
  assert.match(tutorial, /"axisLabel":false/);
  assert.match(tutorial, /"unitLabel":""/);
  assert.match(tutorial, /"sdScale":"population"/);
  assert.match(tutorial, /data-repeat-label="New sample"/);

  // Population alone, then a sample, then deviations from mu, then from M,
  // and only then are the two spans lined up on the population center.
  assert.equal(actions[0]["show-sample"], false);
  assert.ok(actions.slice(1).every((action) => action["show-sample"] && action["focus-sample"]));
  assert.ok(fromMu > 0 && fromM > fromMu && linedUp > fromM);
  assert.equal(actions[fromMu]["show-fixed-center-rms"], true);
  assert.equal(actions[fromMu]["show-sample-sd"], false);
  assert.equal(actions[fromM]["show-sample-sd"], true);
  assert.equal(actions[fromM]["sample-span-center"], "sample");
  actions.slice(0, fromMu).forEach((action) => {
    assert.equal(action["show-fixed-center-rms"], false);
    assert.equal(action["deviation-guides"], "none");
  });
  actions.slice(linedUp).forEach((action) => {
    assert.equal(action["deviation-guides"], "none");
    assert.equal(action["sample-span-center"], "population");
  });
  assert.equal(actions.at(-1)["recenter-sample-span"], true);

  const repeatAction = JSON.parse(
    tutorial.match(/data-repeat-action='([^']+)'/)[1]
  );
  assert.equal(repeatAction["recenter-sample-span"], true);
  assert.equal(repeatAction["deviation-guides"], "none");
});

test("the bias tutorial begins with only an abstract population display", () => {
  const tutorial = trackingBiasTutorial();
  const steps = tutorialSteps(tutorial);
  const actions = steps.map((step) => step.action);
  const phase = (major) => {
    const found = steps.filter((step) => step.major === major).map((step) => step.action);
    assert.ok(found.length > 0, `the bias tutorial should have a ${major} phase`);
    return found;
  };

  assert.match(tutorial, /"axisMode":"center"/);
  assert.match(tutorial, /"axisLabel":false/);
  assert.match(tutorial, /"unitLabel":""/);
  assert.match(tutorial, /"populationVarianceLift":6/);
  assert.doesNotMatch(tutorial, /averageMeanError/);

  assert.equal("samples" in actions[0], false);
  assert.equal(actions[0]["show-sample"], false);
  assert.equal(actions[0]["focus-sample"], false);
  actions.slice(1).forEach((action) => {
    assert.equal(action["show-sample"], true);
    assert.equal(action["focus-sample"], true);
    assert.equal(action["sample-opacity"], 0.32);
  });

  // The tracker axis only ever widens, and always has room for the samples.
  actions.forEach((action, index) => {
    if (index > 0) {
      assert.ok(action["tracker-axis-maximum"] >= actions[index - 1]["tracker-axis-maximum"]);
    }
    assert.ok((action.samples || 0) <= action["tracker-axis-maximum"]);
  });

  [...phase("one-sample"), ...phase("means")].forEach((action) => {
    assert.equal(action.estimator, "mean");
  });

  const uncorrected = phase("variance-uncorrected");
  uncorrected.forEach((action) => {
    assert.equal(action.estimator, "variance");
    assert.equal(action["variance-indicator"], "uncorrected");
    assert.equal(action["show-uncorrected-tracker"], true);
    assert.equal(action["show-corrected-tracker"], false);
    assert.equal(action["hold-uncorrected-history"], false);
  });
  assert.equal(uncorrected[0].fall, true);

  // The corrected replay keeps every red uncorrected estimate on screen.
  const uncorrectedTotal = Math.max(...uncorrected.map((action) => action.samples));
  const corrected = phase("variance-corrected");
  corrected.forEach((action) => {
    assert.equal(action.estimator, "variance");
    assert.equal(action["variance-indicator"], "corrected");
    assert.equal(action["show-uncorrected-tracker"], true);
    assert.equal(action["show-corrected-tracker"], true);
    assert.equal(action["hold-uncorrected-history"], true);
    assert.equal(action["uncorrected-history-samples"], uncorrectedTotal);
  });
  assert.equal(corrected[0].fall, true);
  assert.equal(Math.max(...corrected.map((action) => action.samples)), uncorrectedTotal);
});

test("the corrected replay holds the completed uncorrected history", () => {
  const helpers = loadMathHelpers();
  const replayState = {
    drawIndex: 37,
    holdUncorrectedHistory: true,
    uncorrectedHistorySamples: 1000
  };

  assert.deepEqual(
    { ...helpers.heightVariabilityBiasHistoryCounts(replayState, "variance") },
    { uncorrected: 1000, corrected: 37 }
  );
  assert.deepEqual(
    {
      ...helpers.heightVariabilityBiasHistoryCounts(
        { ...replayState, holdUncorrectedHistory: false },
        "variance"
      )
    },
    { uncorrected: 37, corrected: 37 }
  );
});

test("the bias tutorial reserves one stable stage and centers undocked source views", () => {
  const helpers = loadMathHelpers();
  const geometry = {
    sampleViewTop: 180,
    sampleViewBottom: 280,
    populationViewBottom: 150,
    dynamicHeight: 340,
    trackerGap: 12,
    trackerFootprint: 334,
    showMeans: true
  };
  const populationOnly = helpers.heightVariabilityTrackingLayout({
    ...geometry,
    sourceView: "full",
    showSample: false
  });
  const populationAndSample = helpers.heightVariabilityTrackingLayout({
    ...geometry,
    sourceView: "full",
    showSample: true
  });
  const dockedSample = helpers.heightVariabilityTrackingLayout({
    ...geometry,
    sourceView: "sample",
    showSample: true
  });

  assert.equal(populationOnly.stageHeight, 446);
  assert.equal(populationAndSample.stageHeight, populationOnly.stageHeight);
  assert.equal(dockedSample.stageHeight, populationOnly.stageHeight);
  assert.equal(populationOnly.overviewTop, 148);
  assert.equal(populationAndSample.overviewTop, 83);
  assert.equal(dockedSample.overviewTop, 0);
  assert.equal(populationOnly.trackerTop, 112);
  assert.equal(populationAndSample.trackerTop, populationOnly.trackerTop);
  assert.equal(dockedSample.trackerTop, populationOnly.trackerTop);
});

test("both variance estimators define one stable tracker scale", () => {
  const helpers = loadMathHelpers();
  const history = [
    {
      meanError: 0.5,
      meanAverage: 0.5,
      biasedRelativeError: -0.7,
      correctedRelativeError: 1.8,
      biasedRelativeAverage: -0.22,
      correctedRelativeAverage: 0.61
    }
  ];

  assert.deepEqual(
    { ...helpers.heightVariabilityBiasScaleExtents(history, "variance", 3) },
    { rawAbs: 1.8, averageAbs: 0.61 }
  );
  assert.deepEqual(
    { ...helpers.heightVariabilityBiasScaleExtents(history, "mean", 3) },
    { rawAbs: 4.050000000000001, averageAbs: 1.35 }
  );
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
  assert.match(source, /state\.showMeans && state\.showSample/);
  assert.match(source, /sampleLayer, showSourceSample, \{ root: rootNode, animate \}/);
  assert.match(source, /trackingEnabled && state\.showSample/);
  assert.match(source, /semanticTickFormat/);
  assert.doesNotMatch(source, /Error = M − μ \(inches\)/);
  assert.match(source, /comparisonRowGap: spacing\.row/);
  const correctedRule = source.match(/\.height-variability-demo \.hv-corrected-line \{([^}]+)\}/)?.[1] || "";
  assert.match(correctedRule, /stroke: var\(--hv-corrected-color\)/);
  assert.doesNotMatch(correctedRule, /stroke-dasharray/);
  assert.match(source, /update\(true, \{ animate, fall \}\);/);
  assert.match(source, /sampleAxisY - sampleDotRadius/);
  assert.match(source, /sampleLandingDelay/);
  assert.match(source, /sequenceMeanAfterFall/);
  assert.match(source, /sequenceVarianceAfterFall/);
  assert.match(source, /showSourceSample && state\.showMeans/);
  assert.match(source, /case "sample-opacity":/);
  assert.match(source, /case "sample-duration":/);
  assert.match(source, /durationMs: sampleDuration/);
  assert.match(source, /Math\.min\(30000, requestedDuration\)/);
  assert.match(source, /case "tracker-axis-maximum":/);
  assert.match(source, /case "tracker-axis-duration":/);
  assert.match(source, /function animateAxisTo/);
  assert.match(source, /trackerAxisMaximum/);
  assert.match(source, /case "variance-indicator":/);
  assert.match(source, /case "show-uncorrected-tracker":/);
  assert.match(source, /case "show-corrected-tracker":/);
  assert.match(source, /case "hold-uncorrected-history":/);
  assert.match(source, /case "uncorrected-history-samples":/);
  assert.match(source, /hv-variance-comparison sfs-if-reveal/);
  assert.match(source, /state\.showUncorrectedTracker/);
  assert.match(source, /state\.showCorrectedTracker/);
  assert.match(source, /showBothVarianceIndicators \? 2 : 1/);
  assert.match(source, /label: "corrected variance \(divide by n − 1\)"[\s\S]*label: "uncorrected variance \(divide by n\)"/);
  assert.match(source, /--hv-corrected-color: var\(--graph-series-3, #009e73\)/);
  assert.match(source, /"hv-corrected-line", "hv-corrected-label", "square"/);
  assert.match(source, /"hv-sample-line", "hv-biased", "square"/);
  assert.match(source, /"is-biased", "is-square"/);
  assert.match(source, /"is-corrected", "is-square"/);
  assert.match(source, /const markerShape = "square"/);
  assert.match(source, /populationVarianceLift/);
  assert.match(source, /varianceComparisonFirstY - \(trackingEnabled \? populationVarianceLift : 0\)/);
  assert.match(source, /hv-population-context/);
  assert.match(source, /--sfs-if-reveal-duration: 680ms/);
  assert.match(source, /biasTracker\.getMaximumFootprint\(\)/);
  assert.match(source, /style\("top", `\$\{layout\.overviewTop\}px`\)/);
  assert.match(source, /style\("height", `\$\{layout\.stageHeight\}px`\)/);
  assert.match(source, /renderedSourceView === "full" && state\.sourceView === "sample"/);
  assert.match(source, /trackerRevealDelay === 0/);
  assert.match(source, /bt-reveal-after-source\.is-visible/);
  assert.doesNotMatch(source, /slideErrorTracker/);
  assert.match(source, /heightVariabilityBiasScaleExtents/);
  assert.doesNotMatch(source, /const seriesKey = series\.map/);
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
  assert.match(source, /hv-population-deviation-guides/);
  assert.match(source, /hv-sample-deviation-guides/);
  assert.match(source, /stroke-dasharray: 2 7/);
  assert.match(source, /function updateDeviationGuides/);
  assert.match(source, /deviationGuideLeadIn/);
  assert.match(source, /spanMotionEnabled = animate && !trackingEnabled && !heightVariabilityReducedMotion/);
  assert.match(source, /animate: animate && !growFixedCenterSpan/);
  assert.match(source, /animate: animate && !growSampleSpan/);
});

test("cumulative tracker paths remain unfilled when mean-mode colors are applied", () => {
  const historyRule = source.match(/\.bias-tracking-demo \.bt-history-line \{([^}]+)\}/)?.[1] || "";
  const meanModeRule = source.match(/\.bias-tracking-demo\.is-mean-mode \.bt-corrected-mark \{([^}]+)\}/)?.[1] || "";

  assert.match(historyRule, /fill: none/);
  assert.match(meanModeRule, /stroke: var\(--bt-mean\)/);
  assert.doesNotMatch(meanModeRule, /fill:/);
  assert.match(
    source,
    /\.bias-tracking-demo\.is-mean-mode \.bt-corrected-mark:not\(\.bt-history-line\) \{[\s\S]*?fill: var\(--bt-mean\)/
  );
});

test("bulk sampling advances at a constant rate", () => {
  const start = source.indexOf("function animateTo");
  const end = source.indexOf("function animateAxisTo", start);
  const animateToSource = source.slice(start, end);

  assert.ok(start >= 0 && end > start, "the bulk-sampling animation should be present");
  assert.match(animateToSource, /Math\.floor\(total \* progress\)/);
  assert.match(animateToSource, /\(finalDomain - startDomain\) \* progress/);
  assert.doesNotMatch(animateToSource, /easedProgress|easeCubic/);
});

test("the tracker axis expands independently at a constant rate", () => {
  const start = source.indexOf("function animateAxisTo");
  const end = source.indexOf("function addSamples", start);
  const animateAxisSource = source.slice(start, end);

  assert.ok(start >= 0 && end > start, "the tracker-axis animation should be present");
  assert.match(animateAxisSource, /startDomain \+ \(finalDomain - startDomain\) \* progress/);
  assert.doesNotMatch(animateAxisSource, /state\.drawIndex\s*=/);
  assert.doesNotMatch(animateAxisSource, /easedProgress|easeCubic/);
});
