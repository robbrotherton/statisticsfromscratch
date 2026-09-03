import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const chapter = readFileSync(new URL("../03-central-tendency.qmd", import.meta.url), "utf8");
const statsSource = readFileSync(new URL("../resources/js/stat-helpers.js", import.meta.url), "utf8");
const distributionSource = readFileSync(new URL("../resources/js/distribution-generator.js", import.meta.url), "utf8");
const graphSource = readFileSync(new URL("../resources/js/graph-generator.js", import.meta.url), "utf8");

function comparisonSteps() {
  const start = chapter.indexOf("## Watch the center change");
  const end = chapter.indexOf("## Summary", start);
  assert.ok(start >= 0 && end > start, "comparison tutorial should be present");

  return Array.from(chapter.slice(start, end).matchAll(
    /data-title="([^"]+)" data-action='([^']+)'/g
  )).map((match) => ({
    title: match[1],
    action: JSON.parse(match[2])
  }));
}

function mathContext() {
  const context = vm.createContext({
    console,
    window: {},
    d3: {
      max(values) {
        return Math.max(...values);
      },
      range(count) {
        return Array.from({ length: count }, (_, index) => index);
      }
    }
  });
  vm.runInContext(statsSource, context);
  vm.runInContext(distributionSource, context);
  return context;
}

function graphContext() {
  const context = vm.createContext({ console, window: {} });
  vm.runInContext(graphSource, context);
  return context;
}

test("the comparison moves from concrete distributions to one guided morph", () => {
  assert.match(chapter, /Stepping back from real data/);
  assert.ok(
    chapter.indexOf("#fig-income-distribution") < chapter.indexOf("## Watch the center change"),
    "the concrete income example should precede the generic distribution morph"
  );
  assert.ok(
    chapter.indexOf("#fig-tone-scramble-centers") < chapter.indexOf("## Watch the center change"),
    "the tone-identification data should precede the generic distribution morph"
  );
  assert.equal((chapter.match(/makeCentralTendencyMorph/g) || []).length, 1);
  assert.doesNotMatch(chapter, /centralTendency(?:Normal|Positive|Negative|Bimodal)/);
  assert.match(chapter, /#act-distributions \.callout-tip \.interactive/);

  const steps = comparisonSteps();
  assert.deepEqual(
    steps.map((step) => step.title),
    ["Normal", "Asymmetrical", "Positive skew", "Negative skew", "Bimodal"]
  );
  assert.deepEqual(
    steps.map((step) => [step.action.skew, step.action.bimodal]),
    [[0, 0], [0.35, 0], [1, 0], [-1, 0], [0, 1]]
  );
  assert.ok(steps.every((step) => step.action["controls-open"] === false));
});

test("the morph preserves the three conceptual marker encodings", () => {
  assert.match(distributionSource, /class", "dg-mode-cap"/);
  assert.match(distributionSource, /class", "dg-median-divider"/);
  assert.match(distributionSource, /class", "dg-mean-fulcrum"/);
  assert.match(distributionSource, /dg-median-half-label/);
  assert.match(distributionSource, /d3\.easeCubicInOut/);
  assert.match(distributionSource, /sfsDistributionPrefersReducedMotion\(\)/);
  assert.match(distributionSource, /action\["controls-open"\]/);
});

test("the continuous family passes through the intended statistical states", () => {
  const context = mathContext();
  const domain = [-4, 6];
  const snapshot = (skew, bimodal = 0) => {
    const distribution = context.sfsCentralTendencyMorphSpec(skew, bimodal);
    return {
      distribution,
      mean: context.sfsDistributionMeanValue(distribution),
      median: context.sfsDistributionQuantile(distribution, 0.5),
      modes: Array.from(context.sfsDistributionModes(distribution, domain))
    };
  };

  const normal = snapshot(0);
  assert.ok(Math.abs(normal.mean) < 1e-10);
  assert.ok(Math.abs(normal.median) < 1e-5);
  assert.equal(normal.modes.length, 1);
  assert.ok(Math.abs(normal.modes[0]) < 0.02);

  const skewed = snapshot(0.65);
  assert.equal(skewed.modes.length, 1);
  assert.ok(skewed.modes[0] < skewed.median);
  assert.ok(skewed.median < skewed.mean);

  const bimodal = snapshot(0, 1);
  assert.equal(bimodal.modes.length, 2);
  assert.ok(bimodal.modes[0] < bimodal.mean && bimodal.mean < bimodal.modes[1]);
  assert.ok(Math.abs(bimodal.mean) < 1e-10);
  assert.ok(Math.abs(bimodal.median) < 1e-5);
});

test("every sampled intermediate shape remains a normalized mixture", () => {
  const context = mathContext();
  const shapes = [
    [0, 0], [0.2, 0], [0.65, 0], [1, 0], [-1, 0], [0, 0.5], [0, 1], [0.65, 0.8]
  ];

  shapes.forEach(([skew, bimodal]) => {
    const distribution = context.sfsCentralTendencyMorphSpec(skew, bimodal);
    const weights = Array.from(distribution.components, (component) => component.weight);
    assert.ok(weights.every((weight) => weight > 0));
    assert.ok(Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) < 1e-12);

    const lower = -10;
    const upper = 10;
    const steps = 20000;
    const step = (upper - lower) / steps;
    let area = 0;
    let previous = context.sfsDistributionPdf(distribution, lower);
    for (let index = 1; index <= steps; index += 1) {
      const current = context.sfsDistributionPdf(distribution, lower + index * step);
      area += (previous + current) * step / 2;
      previous = current;
    }
    assert.ok(Math.abs(area - 1) < 1e-6, `shape ${skew}, ${bimodal} should integrate to one`);
  });
});

test("the tone-identification comparison uses honest grouped estimates", () => {
  assert.equal((chapter.match(/makeToneIdentificationGraph/g) || []).length, 2);
  assert.match(chapter, /toneIdentificationCenters makeToneIdentificationGraph options='\{"showCenters":true\}'/);
  assert.match(chapter, /median and mean estimated from the grouped data/);

  const context = graphContext();
  const centers = context.sfsToneIdentificationGroupedCenters();
  assert.equal(centers.total, 275);
  assert.ok(Math.abs(centers.median - 0.6201) < 0.0001);
  assert.ok(Math.abs(centers.mean - 0.6727) < 0.0001);
  assert.ok(centers.mean > centers.median);
  assert.match(graphSource, /sfsGraphAddReferenceMarkers\(svg, opts, x, margin, height\)/);
});
