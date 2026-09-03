import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const chapter = readFileSync(new URL("../01-variables.qmd", import.meta.url), "utf8");
const pathwaySource = readFileSync(
  new URL("../resources/js/sampling-pathway.js", import.meta.url),
  "utf8"
);
const tutorialSource = readFileSync(
  new URL("../resources/js/interactive-figure.js", import.meta.url),
  "utf8"
);
const samplingCoreSource = readFileSync(
  new URL("../resources/js/sampling-core.js", import.meta.url),
  "utf8"
);

const tutorialStart = chapter.indexOf("## Drawing samples from a population");
const tutorialEnd = chapter.indexOf("How do we deal with the inherent variability", tutorialStart);
const tutorial = chapter.slice(tutorialStart, tutorialEnd);
const optionsMatch = tutorial.match(/populationSampling\s+makeSamplingPathway\s+options='([^']+)'/s);
const options = optionsMatch ? JSON.parse(optionsMatch[1]) : null;
const steps = Array.from(tutorial.matchAll(
  /::: \{\.tutorial-step ([^\n]+)\}\n([\s\S]*?)\n:::/g
)).map((match) => {
  const attributes = match[1];
  const action = attributes.match(/data-action='([^']+)'/);
  const repeatAction = attributes.match(/data-repeat-action='([^']+)'/);
  return {
    action: action ? JSON.parse(action[1]) : null,
    repeatAction: repeatAction ? JSON.parse(repeatAction[1]) : null,
    text: match[2]
  };
});

test("chapter 1 uses the shared sampling pathway for a balanced categorical population", () => {
  assert.match(chapter, /interactive-scripts:\n(?:.|\n)*?  - sampling-pathway/);
  assert.doesNotMatch(chapter, /population-sampling-diagram/);
  assert.ok(options);
  assert.equal(options.mode, "categorical");
  assert.equal(options.populationRows, 4);
  assert.equal(options.populationColumns, 25);
  assert.equal(options.sampleSize, 10);
  assert.equal(options.categories.length, 5);
  assert.equal(options.inferenceStrip, true);
});

test("the finite tutorial ends in one repeatable state rather than unbounded steps", () => {
  assert.equal(steps.length, 6);
  assert.deepEqual(steps.map((step) => step.action.draw), [0, 1, 2, 2, 3, 4]);
  assert.ok(steps.slice(0, -1).every((step) => step.repeatAction === null));
  assert.equal(steps.at(-1).repeatAction.draw, "next");
  assert.doesNotMatch(chapter, /\.no-controls data-tutorial-nav="inline"/);
  assert.match(tutorial, /data-repeat-label="Draw another sample"/);
  assert.match(steps.at(-1).text, /Keep clicking the button/);
  assert.match(steps.at(-1).text, /each sample offers a different estimate/);
});

test("the tutorial compares two samples with known truth before concealing the population", () => {
  assert.deepEqual(
    steps.slice(0, 5).map((step) => step.action["population-known"]),
    [true, true, true, false, false]
  );
  assert.deepEqual(
    steps.map((step) => step.action["show-inference"]),
    [false, false, false, true, true, true]
  );
  assert.equal(steps[2].action.draw, steps[3].action.draw);
  assert.match(steps[2].text, /population stays the same/);
  assert.match(steps[3].text, /sample provides our best guess/i);
  assert.match(steps.at(-1).text, /revealed the true population again/i);
});

test("categorical draws are seeded per index and generated on demand", () => {
  assert.match(pathwaySource, /makeCategoricalSamplingPathway/);
  assert.match(pathwaySource, /sampling\.seededRng\(`\$\{seed\}:\$\{drawIndex\}`\)/);
  assert.match(pathwaySource, /String\(value\).*=== "next"/s);
  assert.match(pathwaySource, /Number\.MAX_SAFE_INTEGER/);
});

test("categorical dots reuse the touching-cell geometry of the numeric pathway", () => {
  assert.match(pathwaySource, /const cellSize = \(plotRight - plotLeft\) \/ columns/);
  assert.equal(pathwaySource.match(/const dotRadius = cellSize \/ 2/g)?.length, 2);
});

test("the optional inference strip separates hidden truth from the sample estimate", () => {
  assert.match(pathwaySource, /const inferenceEnabled = sampling\.boolean\(opts\.inferenceStrip, false\)/);
  assert.match(pathwaySource, /data-population-known/);
  assert.match(pathwaySource, /Estimate from this sample/);
  assert.match(pathwaySource, /item\.end - item\.start\) \* plotWidth/);
  assert.match(pathwaySource, /visuals\.reducedMotion\(\)/);
  assert.match(pathwaySource, /\.spp-inference-frame \{\s*fill: none;\s*stroke: none;/);
  assert.match(pathwaySource, /\.spp-inference-segment \{\s*stroke: none;/);
  const inferenceRenderer = pathwaySource.slice(
    pathwaySource.indexOf("function renderInference"),
    pathwaySource.indexOf("function render(settings)")
  );
  assert.doesNotMatch(inferenceRenderer, /style\("opacity", \(item\)/);
});

test("the categorical chart keeps persistent copy sparse and reports sample proportions", () => {
  assert.doesNotMatch(pathwaySource, /\.text\("No sample yet"\)/);
  assert.doesNotMatch(pathwaySource, /equal representation would be/);
  assert.doesNotMatch(pathwaySource, /observed counts by color/);
  assert.doesNotMatch(pathwaySource, /dots · .*of each color/);
  assert.match(
    pathwaySource,
    /proportionLabels[\s\S]*?`\$\{category\} \$\{d3\.format\("\.0%"\)\(counts\[index\] \/ sampleSize\)\}`/
  );
  assert.match(
    pathwaySource,
    /proportionLabels = inferenceLayer\.append\("g"\)[\s\S]*?attr\("y", inferenceSummaryY\)/
  );
});

test("the seeded tutorial samples support the claims made in the prose", () => {
  const context = {
    sfsStats: {
      normalPdf: () => 0,
      normalCdf: () => 0.5,
      normalInv: (probability) => probability
    }
  };
  context.window = context;
  vm.runInNewContext(samplingCoreSource, context);

  function categoryCounts(drawIndex) {
    const rng = context.sfsSampling.seededRng(`${options.seed}:${drawIndex}`);
    const pool = Array.from({ length: 100 }, (value, index) => index);
    for (let index = 0; index < 10; index += 1) {
      const swapIndex = index + Math.floor(rng() * (pool.length - index));
      [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    const counts = [0, 0, 0, 0, 0];
    pool.slice(0, 10).forEach((id) => {
      counts[Math.floor((id % 25) / 5)] += 1;
    });
    return counts;
  }

  assert.deepEqual(categoryCounts(1), [1, 3, 3, 1, 2]);
  assert.deepEqual(categoryCounts(2), [3, 0, 2, 3, 2]);
  assert.deepEqual(categoryCounts(3), [0, 2, 4, 2, 2]);
});

test("the shared tutorial runtime opts into terminal repetition only when declared", () => {
  assert.match(tutorialSource, /const repeatActions = steps\.map/);
  assert.match(tutorialSource, /atEnd && !repeatAction/);
  assert.match(tutorialSource, /repeatActions\[index\], true/);
  assert.match(tutorialSource, /repeatsAtEnd \? "arrow-repeat" : "chevron-right"/);
  assert.match(pathwaySource, /visually-hidden sfs-if-fit-ignore/);
  assert.match(tutorialSource, /child\.classList\.contains\("sfs-if-fit-ignore"\)/);
});
