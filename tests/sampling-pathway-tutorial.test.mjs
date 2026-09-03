import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chapter = readFileSync(new URL("../07-sampling.qmd", import.meta.url), "utf8");
const pathwaySource = readFileSync(
  new URL("../resources/js/sampling-pathway.js", import.meta.url),
  "utf8"
);
const visualsSource = readFileSync(
  new URL("../resources/js/sampling-visuals.js", import.meta.url),
  "utf8"
);
function parseSteps(source) {
  return Array.from(source.matchAll(
    /::: \{\.tutorial-step ([^\n]+)\}\n([\s\S]*?)\n:::/g
  )).map((match) => {
    const attributes = match[1];
    const action = attributes.match(/data-action='([^']+)'/);
    const major = attributes.match(/data-major="([^"]+)"/);
    const title = attributes.match(/data-title="([^"]+)"/);
    return {
      action: action ? JSON.parse(action[1]) : null,
      major: major ? major[1] : null,
      text: match[2],
      title: title ? title[1] : null
    };
  });
}

const start = chapter.indexOf("## Build the sampling distribution");
const end = chapter.indexOf("## The Distribution of Sample Means", start);
const tutorial = chapter.slice(start, end);
const steps = parseSteps(tutorial);
const heightStart = chapter.indexOf("## Build every sample mean");
const heightEnd = chapter.indexOf("But remember, we're not interested", heightStart);
const heightTutorial = chapter.slice(heightStart, heightEnd);
const heightSteps = parseSteps(heightTutorial);
const heightOptionsMatch = heightTutorial.match(
  /heightSamplingDistribution makeSamplingPathway options='([^']+)'/
);
const heightOptions = heightOptionsMatch ? JSON.parse(heightOptionsMatch[1]) : null;

test("the IQ tutorial splits one sample into select, compute, and place states", () => {
  assert.equal(steps.length, 7);
  const oneSample = steps.filter((step) => step.major === "one-sample");
  assert.deepEqual(oneSample.map((step) => step.title), ["Select", "Compute", "Place mean"]);

  assert.deepEqual(
    {
      draw: oneSample[0].action.draw,
      observations: oneSample[0].action.observations,
      mean: oneSample[0].action["show-mean"],
      sampleAxis: oneSample[0].action["show-sample-axis"],
      distribution: oneSample[0].action["show-distribution"],
      focus: oneSample[0].action.focus,
      fallObservations: oneSample[0].action["fall-observations"],
      fallMean: oneSample[0].action["fall-mean"]
    },
    {
      draw: 1,
      observations: true,
      mean: false,
      sampleAxis: true,
      distribution: false,
      focus: "sample",
      fallObservations: true,
      fallMean: false
    }
  );

  assert.equal(oneSample[1].action["show-mean"], true);
  assert.equal(oneSample[1].action.focus, "mean");
  assert.equal(oneSample[1].action["fall-observations"], false);
  assert.equal(oneSample[1].action["fall-mean"], false);
  assert.equal(oneSample[1].action["converge-mean"], true);
  assert.match(oneSample[1].text, /sfs-data-emphasis/);

  assert.equal(oneSample[2].action["show-mean"], false);
  assert.equal(oneSample[2].action["show-distribution"], true);
  assert.equal(oneSample[2].action.focus, "distribution");
  assert.equal(oneSample[2].action["fall-observations"], false);
  assert.equal(oneSample[2].action["fall-mean"], true);
  assert.match(oneSample[2].text, /sfs-data-emphasis/);
});

test("later states keep the active sample and its mean emphasized together", () => {
  const laterStates = steps.filter((step) =>
    ["two-samples", "thirty", "pattern"].includes(step.major)
  );

  assert.equal(laterStates.length, 3);
  for (const step of laterStates) {
    assert.equal(step.action.focus, "sample-mean");
    assert.equal(step.action.observations, true);
    assert.equal(step.action["show-distribution"], true);
    assert.match(step.text, /sfs-data-emphasis/);
  }
});

test("mean convergence runs at teaching speed and is skipped for the fast pattern", () => {
  const byMajor = Object.fromEntries(steps.map((step) => [step.major, step]));

  assert.equal(byMajor["two-samples"].action["converge-mean"], true);
  assert.equal(byMajor.thirty.action["converge-mean"], true);
  assert.equal(byMajor.thirty.action.delay, 440);
  assert.equal(byMajor.pattern.action["converge-mean"], false);
  assert.equal(byMajor.pattern.action.delay, 75);
});

test("the mean animation uses interruptible ghosts and honors reduced motion", () => {
  assert.match(pathwaySource, /case "converge-mean":/);
  assert.match(visualsSource, /bcs-mean-ghost-layer/);
  assert.match(visualsSource, /bcs-mean-ghost sfs-graph-point/);
  assert.match(visualsSource, /state\.convergeMean && !reducedMotion\(\)/);
  assert.match(visualsSource, /meanGhostLayer\.selectAll\("\*"\)\.interrupt\(\)\.remove\(\)/);
});

test("the finite height pathway reuses convergence without selection emphasis", () => {
  assert.ok(heightOptions);
  assert.equal(heightOptions.sampleAxis, true);
  assert.equal(heightOptions.showSampleAxis, true);
  assert.equal(heightOptions.sampleMeanStyle, "block");
  assert.equal(heightOptions.describeSampleValues, true);
  assert.equal(heightOptions.showEmptySampleNote, false);
  assert.equal(heightOptions.individualPalette, "graph-series-2-5");
  assert.equal(heightOptions.highlightSelected, false);
  assert.equal(heightOptions.highlightCurrent, false);
  assert.equal(heightOptions.convergeMeanOnDraw, true);
  assert.equal(heightSteps.length, 5);

  for (const step of heightSteps.slice(1)) {
    assert.equal(step.action.focus, "none");
    assert.equal(step.action["show-mean"], false);
    assert.equal(step.action["show-sample-axis"], true);
    assert.equal(step.action["show-distribution"], true);
    assert.equal(step.action["highlight-current"], false);
    assert.equal(step.action["converge-mean"], true);
    assert.match(step.text, /sfs-data-emphasis/);
  }
  assert.equal(heightSteps.at(-1).action.delay, 1200);
});

test("the empty height sample frame stays visible without placeholder copy", () => {
  assert.equal(heightSteps[0].action.observations, false);
  assert.equal(heightSteps[0].action["show-sample-axis"], true);
  assert.match(pathwaySource, /state\.showSampleAxis \|\| \(state\.showObservations/);
  assert.match(visualsSource, /state\.showEmptyNote !== false/);
  assert.match(visualsSource, /`X\$\{subscriptNumber\(index \+ 1\)\} = /);
  assert.match(visualsSource, /`\$\{observationText\}; M = /);
});

test("the height palette reuses the shared semantic series colors", () => {
  assert.match(visualsSource, /function resolveIndividualPalette\(name\)/);
  assert.match(visualsSource, /`var\(--graph-series-\$\{index\}\)`/);
  assert.match(pathwaySource, /individualPalette: opts\.individualPalette/g);
});

test("pathway axes use one centered population label and aligned mean geometry", () => {
  assert.equal(heightOptions.showPopulationAxisLabel, true);
  assert.equal(heightOptions.showSampleAxisLabel, false);
  assert.equal(heightOptions.showDistributionAxisLabel, false);
  assert.match(pathwaySource, /sampleBaseY - boxUnitHeight \/ 2/);
  assert.match(pathwaySource, /meanConvergenceDelay: convergenceDelay/);
  assert.match(visualsSource, /\.attr\("x", \(plotLeft \+ plotRight\) \/ 2\)/);
});
