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

function trackingBiasTutorial() {
  const start = chapter.indexOf("## Tracking bias across repeated samples");
  const end = chapter.indexOf("{{< include quizzes/04-variability-learning-checks.qmd >}}", start);
  assert.ok(start >= 0 && end > start, "the repeated-sampling bias tutorial should be present");
  return chapter.slice(start, end);
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

test("the bias tutorial begins with only an abstract population display", () => {
  const tutorial = trackingBiasTutorial();
  const actions = Array.from(
    tutorial.matchAll(/data-action='([^']+)'/g),
    (match) => JSON.parse(match[1])
  );
  const majorTitles = Array.from(
    tutorial.matchAll(/data-major-title="([^"]+)"/g),
    (match) => match[1]
  );
  const majors = Array.from(
    tutorial.matchAll(/data-major="([^"]+)"/g),
    (match) => match[1]
  );
  const titles = Array.from(
    tutorial.matchAll(/data-title="([^"]+)"/g),
    (match) => match[1]
  );

  assert.match(tutorial, /"axisMode":"center"/);
  assert.match(tutorial, /"axisLabel":false/);
  assert.match(tutorial, /"unitLabel":""/);
  assert.match(tutorial, /"populationVarianceLift":6/);
  assert.equal("samples" in actions[0], false);
  assert.equal(actions[0]["show-sample"], false);
  assert.equal(actions[0]["focus-sample"], false);
  assert.equal(actions[1]["show-sample"], true);
  assert.equal(actions[1]["focus-sample"], true);
  assert.equal(actions[1]["sample-opacity"], 0.32);
  assert.equal(actions[1].fall, true);
  actions.slice(2, 7).forEach((action) => {
    assert.equal(action["show-sample"], true);
    assert.equal(action["focus-sample"], true);
    assert.equal(action["sample-opacity"], 0.32);
  });
  actions.slice(0, 5).forEach((action) => {
    assert.equal(action["tracker-axis-maximum"], 10);
  });
  actions.slice(5).forEach((action) => {
    assert.equal(action["tracker-axis-maximum"], 1000);
  });
  assert.equal(actions[3].samples, 10);
  assert.equal(actions[4].samples, 10);
  assert.equal(actions[5].samples, 10);
  assert.equal(actions[5]["tracker-axis-duration"], 1400);
  assert.equal(actions[6].samples, 1000);
  assert.equal(actions[6]["sample-duration"], 10000);
  actions.slice(7).forEach((action) => {
    assert.equal(action["show-sample"], true);
    assert.equal(action["focus-sample"], true);
    assert.equal(action["sample-opacity"], 0.32);
    assert.equal(action["source-view"], "sample");
  });
  assert.equal(actions[7].fall, true);
  assert.equal(actions[7]["variance-indicator"], "uncorrected");
  assert.equal(actions[7]["show-uncorrected-tracker"], true);
  assert.equal(actions[7]["show-corrected-tracker"], false);
  assert.equal(actions[7]["hold-uncorrected-history"], false);
  assert.equal(actions[8].samples, 1000);
  assert.equal(actions[8]["sample-duration"], 15000);
  assert.equal(actions[8]["show-corrected-tracker"], false);
  assert.equal(actions[9].samples, 1);
  assert.equal(actions[9].fall, true);
  assert.equal(actions[9]["variance-indicator"], "corrected");
  assert.equal(actions[9]["show-uncorrected-tracker"], true);
  assert.equal(actions[9]["show-corrected-tracker"], true);
  assert.equal(actions[9]["uncorrected-history-samples"], 1000);
  assert.equal(actions[9]["hold-uncorrected-history"], true);
  assert.equal(actions[10].samples, 1000);
  assert.equal(actions[10]["sample-duration"], 15000);
  assert.equal(actions[10]["variance-indicator"], "corrected");
  assert.equal(actions[10]["uncorrected-history-samples"], 1000);
  assert.equal(actions[10]["hold-uncorrected-history"], true);
  assert.match(tutorial, /The samples are identical\. Only the denominator changes\./);
  assert.match(tutorial, /green corrected squares are added on top of the existing red estimates/);
  assert.match(tutorial, /green cumulative line is drawn without removing the red one/);
  assert.deepEqual([...new Set(majorTitles)], [
    "Population",
    "One sample",
    "Repeated means",
    "Uncorrected variance",
    "Corrected variance"
  ]);
  assert.deepEqual(majors, [
    "population",
    "one-sample",
    "one-sample",
    "means",
    "means",
    "means",
    "means",
    "variance-uncorrected",
    "variance-uncorrected",
    "variance-corrected",
    "variance-corrected"
  ]);
  assert.deepEqual(titles, [
    "Meet the population",
    "Draw a sample",
    "Track its error",
    "Ten means",
    "Average error",
    "Make room for 1,000",
    "1,000 means",
    "One estimate",
    "1,000 estimates",
    "Change the denominator",
    "Replay 1,000"
  ]);
  assert.doesNotMatch(tutorial, /averageMeanError|inches/);
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
