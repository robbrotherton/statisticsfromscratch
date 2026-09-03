import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { siteStyles } from "./site-styles.mjs";

const chapter = readFileSync(new URL("../05-z-scores.qmd", import.meta.url), "utf8");
const source = readFileSync(
  new URL("../resources/js/standardization-ruler.js", import.meta.url),
  "utf8"
);
const styles = siteStyles;
const graphSource = readFileSync(
  new URL("../resources/js/graph-generator.js", import.meta.url),
  "utf8"
);
const reactionSource = readFileSync(
  new URL("../resources/js/reaction-time-zscore.js", import.meta.url),
  "utf8"
);
const manifest = readFileSync(
  new URL("../filters/interactive-scripts.lua", import.meta.url),
  "utf8"
);

const standardizedStart = chapter.indexOf("## Standardized distributions");
const standardizedEnd = chapter.indexOf("## Using $z$-scores", standardizedStart);
const standardizedSection = chapter.slice(standardizedStart, standardizedEnd);
const otherScalesStart = standardizedSection.indexOf("### Other standard-score scales");
const tutorialStart = standardizedSection.indexOf("{#act-standardizing-distributions");
const tutorialSection = standardizedSection.slice(tutorialStart);
const steps = Array.from(tutorialSection.matchAll(
  /::: \{\.tutorial-step\b[^\n]*?data-title="([^"]+)"[^\n]*?data-action='([^']+)'[^\n]*?\}/g
)).map((match) => ({ title: match[1], action: JSON.parse(match[2]) }));
const coverStart = source.indexOf("global.makeZScoreCover = function");
const coverEnd = source.indexOf("global.makeStandardizedScoreGraph = function", coverStart);
const coverSource = source.slice(coverStart, coverEnd);

function numericSourceArray(name) {
  const match = source.match(new RegExp(
    `const ${name} = Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\);`
  ));
  assert.ok(match, `${name} should be a literal frozen array`);
  return JSON.parse(`[${match[1]}]`);
}

function populationStats(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return { mean, sd: Math.sqrt(variance) };
}

function sampleStats(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (values.length - 1);
  return { mean, sd: Math.sqrt(variance) };
}

function sevenBinCounts(values) {
  const cuts = Array.from({ length: 8 }, (_, index) => -3.5 + index);
  return cuts.slice(0, -1).map((lower, index) => {
    const upper = cuts[index + 1];
    return values.filter((value) =>
      value >= lower && (value < upper || (index === 6 && value <= upper))
    ).length;
  });
}

test("the chapter opens with the aligned X-to-z ruler cover", () => {
  assert.match(chapter, /zScoreCover makeZScoreCover/);
  assert.match(chapter, /colorful mound of blocks[\s\S]*?shared center is labeled X[\s\S]*?z on the standardized ruler/);
  assert.match(source, /global\.makeZScoreCover = function/);
  assert.match(coverSource, /global\.makeGraph\(\{[\s\S]*?type: "block"/);
  assert.match(coverSource, /Z_SCORE_COVER_COUNTS\.flatMap/);
  assert.match(coverSource, /Z_SCORE_COVER_COLORS\[colorIndex\]/);
  assert.match(coverSource, /tickFormat\(function\(\) \{ return "X"; \}\)/);
  assert.match(coverSource, /tickFormat\(function\(\) \{ return "z"; \}\)/);
  assert.equal((coverSource.match(/\.attr\("d", "M" \+ margin\.left \+ ",0H"/g) || []).length, 2);
  assert.match(coverSource, /blockDuration \+ rulerPause/);
  assert.match(coverSource, /attr\("transform", "translate\(0," \+ zY \+ "\)"\)/);
  assert.match(coverSource, /cancelMotion: function\(\) \{ settleCurrent\(\); \}/);
  assert.match(coverSource, /blocks: blockData\.length/);
  assert.equal(
    numericSourceArray("Z_SCORE_COVER_COUNTS").reduce((sum, count) => sum + count, 0),
    22
  );
  assert.match(styles, /z-score-cover \.zsc-math-label/);
  assert.match(styles, /font-family: var\(--bc-math-font-family\)/);
  assert.match(styles,
    /z-score-cover \.zsc-raw-axis \.bc-graph-domain,[\s\S]*?stroke: var\(--graph-axis-color\)/
  );
  assert.match(styles,
    /z-score-cover \.zsc-z-axis \.bc-graph-domain,[\s\S]*?stroke: var\(--graph-data-color\)/
  );
  assert.match(styles,
    /z-score-cover \.zsc-raw-axis \.zsc-math-label[\s\S]*?fill: var\(--graph-axis-color\)/
  );
  assert.match(styles,
    /z-score-cover \.zsc-z-axis \.zsc-math-label[\s\S]*?fill: var\(--graph-data-color\)/
  );
});

test("the math examples use corresponding seven-bin histograms", () => {
  const computingSection = chapter.slice(
    chapter.indexOf("### Computing the $z$-scores"),
    chapter.indexOf("### Converting back to raw scores")
  );
  assert.match(computingSection, /easyMathTimeDistribution makeMathTestHistogram options='\{"test":"easy","animate":true\}'/);
  assert.match(computingSection, /hardMathTimeDistribution makeMathTestHistogram options='\{"test":"hard","animate":true\}'/);
  assert.doesNotMatch(computingSection, /makeDistributionGraph|normally distributed|normal models/);
  assert.match(computingSection, /sample of 30 earlier test takers/);
  assert.match(computingSection, /similarly mound-shaped but deliberately not identical/);
  assert.match(standardizedSection, /Here are the two math test distributions again/);
  assert.match(standardizedSection, /same seven bins[\s\S]*?haven't regrouped any observations/);
  assert.match(standardizedSection,
    /bc-standardization-comparison-row[\s\S]*?easyMathStandardized[\s\S]*?hardMathStandardized/
  );
  assert.match(standardizedSection, /easyMathStandardized makeMathTestHistogram options='\{"test":"easy","standardized":true/);
  assert.match(standardizedSection, /hardMathStandardized makeMathTestHistogram options='\{"test":"hard","standardized":true/);
  assert.match(source, /global\.makeMathTestHistogram = function/);
  assert.match(source, /chart: "histogram"/);
  assert.match(source, /MATH_HISTOGRAM_Z_CUTS\.map/);
  assert.match(source, /Array\.from\(\{ length: 8 \}, function\(_, index\) \{ return -3\.5 \+ index; \}\)/);
  assert.match(source, /xDomain: \[cuts\[0\], cuts\[cuts\.length - 1\]\]/);
  assert.match(source, /yDomain: \[0, 15\]/);
  assert.match(source, /rawAxisSideLabel: "\(s\)"/);
  assert.match(source, /statConvention: "sample"/);
  assert.match(source, /const SELECTED_VALUE_MARKER = Object\.freeze/);
  assert.match(source, /color: "var\(--bc-danger-color, #c63f3f\)"/);
  assert.match(source, /dash: "6 4"/);
  assert.match(source, /strokeWidth: 2\.6/);
  assert.equal((source.match(/selectedValueMarker\(\{/g) || []).length, 4);
  assert.match(graphSource, /stroke-width", \(d\) => bcGraphValueOr\(d\.strokeWidth, 2\)/);
  assert.doesNotMatch(styles,
    /\.bc-graph \.bc-graph-reference-marker line \{[^}]*stroke-width:/
  );
  assert.doesNotMatch(standardizedSection, /Completion time \(s\) · μ/);
});

test("selected-value markers use the same red dashed treatment throughout Chapter 5", () => {
  assert.doesNotMatch(source,
    /label: "X = (?:5|80)"[\s\S]{0,140}?(?:graph-data-color|dash: "none")/
  );
  assert.match(reactionSource,
    /label: `X = \$\{x\}`[\s\S]*?color: "var\(--bc-danger-color, #c63f3f\)"[\s\S]*?dash: "6 4"[\s\S]*?strokeWidth: 2\.6/
  );
  assert.match(chapter,
    /"at":159,"label":"X = 159","height":0\.5,"color":"var\(--bc-danger-color, #c63f3f\)","dash":"6 4","strokeWidth":2\.6/
  );
  assert.doesNotMatch(chapter, /"markers"[^\n]*?--bc-accent/);
});

test("the engineered math data have exact target sample statistics and distinct mounds", () => {
  const easy = numericSourceArray("EASY_MATH_SAMPLE_Z_SCORES");
  const hard = numericSourceArray("HARD_MATH_SAMPLE_Z_SCORES");
  assert.equal(easy.length, 30);
  assert.equal(hard.length, 30);

  for (const values of [easy, hard]) {
    const stats = sampleStats(values);
    assert.ok(Math.abs(stats.mean) < 1e-10);
    assert.ok(Math.abs(stats.sd - 1) < 1e-10);
    assert.ok(Math.abs(populationStats(values).sd - Math.sqrt(29 / 30)) < 1e-10);
  }

  const easyRaw = easy.map((z) => 10 + z);
  const hardRaw = hard.map((z) => 100 + 15 * z);
  const zCuts = Array.from({ length: 8 }, (_, index) => -3.5 + index);
  assert.deepEqual(zCuts.map((z) => 10 + z), [6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5]);
  assert.deepEqual(zCuts.map((z) => 100 + 15 * z), [47.5, 62.5, 77.5, 92.5, 107.5, 122.5, 137.5, 152.5]);
  const easyStats = sampleStats(easyRaw);
  const hardStats = sampleStats(hardRaw);
  assert.ok(Math.abs(easyStats.mean - 10) < 1e-10);
  assert.ok(Math.abs(easyStats.sd - 1) < 1e-10);
  assert.ok(Math.abs(hardStats.mean - 100) < 1e-10);
  assert.ok(Math.abs(hardStats.sd - 15) < 1e-10);
  assert.deepEqual(sevenBinCounts(easy), [1, 2, 6, 12, 6, 2, 1]);
  assert.deepEqual(sevenBinCounts(hard), [1, 2, 7, 11, 6, 2, 1]);
  assert.equal((8 - 10) / 1, -2);
  assert.equal((70 - 100) / 15, -2);
  assert.match(chapter, /sample of 30 earlier test takers/);
  assert.match(chapter, /sample mean, \$M\$,[\s\S]*?sample standard deviation, \$s\$/);
  assert.match(chapter, /For a sample, if \$z = \\frac\{X - M\}\{s\}\$, then \$X = M \+ z \\times s\$/);
  assert.doesNotMatch(chapter, /treat that complete group as the population/);
});

test("the two standardizable movie-review histograms reuse the Chapter 4 data", () => {
  assert.match(standardizedSection, /goodBadOkayStandardized makeStandardizedScoreGraph/);
  assert.match(standardizedSection, /polarizingExpressStandardized makeStandardizedScoreGraph/);
  assert.match(standardizedSection, /"data":\[0,4,5,5,6,10\]/);
  assert.match(standardizedSection, /"data":\[0,0,1,9,10,10\]/);
  assert.match(standardizedSection, /"chart":"block"/);
  assert.equal((standardizedSection.match(/"statConvention":"sample"/g) || []).length, 2);
  assert.match(standardizedSection, /"zTickValues":\[-1,0,1\]/);
  assert.equal((standardizedSection.match(/"yDomain":\[0,3\]/g) || []).length, 2);
  assert.equal((standardizedSection.match(/"yTickValues":\[0,1,2,3\]/g) || []).length, 2);
  assert.equal((standardizedSection.match(/"squareScale":true/g) || []).length, 2);
  assert.equal((standardizedSection.match(/"rawAxisSideLabel":"\(X\)"/g) || []).length, 2);
  assert.match(standardizedSection, /treat these six observed ratings as samples, using \$M\$ and \$s\$/);
  assert.ok(Math.abs(sampleStats([0, 4, 5, 5, 6, 10]).sd - 3.22490309931942) < 1e-12);
  assert.ok(Math.abs(sampleStats([0, 0, 1, 9, 10, 10]).sd - 5.138093031466052) < 1e-12);
  assert.match(standardizedSection,
    /left out \*Fine, Actually\*[\s\S]*?standard deviation is zero[\s\S]*?cannot be converted into \$z\$-scores/
  );
});

test("the tutorial now lives under other scales and owns the IQ and SAT process", () => {
  assert.ok(otherScalesStart >= 0);
  assert.ok(tutorialStart > otherScalesStart);
  assert.match(tutorialSection, /standardizationRuler[\s\S]*?makeStandardizationRuler/);
  assert.deepEqual(steps.map((step) => step.title), [
    "Original", "z-scores", "Set the SD", "Set the mean",
    "Start from z", "Set the SD", "Set the mean"
  ]);
  assert.deepEqual(steps.map((step) => step.action.rulerMode), [
    "z", "z", "iqScaled", "iq", "z", "satScaled", "sat"
  ]);
  assert.ok(steps.every((step) => step.action.scene === "curve"));
  assert.doesNotMatch(tutorialSection, /"scene":"blocks"|blockRaw|blockZ/);
  assert.match(tutorialSection, /multiply every number on the \$z\$ ruler by 15/);
  assert.match(tutorialSection, /add 100 to every number/);
  assert.match(tutorialSection, /multiply every \$z\$-score by 100/);
  assert.match(tutorialSection, /add 500 to every score/);
});

test("the aligned-axis component derives the requested SD convention and uses uncluttered guides", () => {
  assert.match(source, /global\.makeStandardizedScoreGraph = function/);
  assert.match(source, /sampleConvention = convention === "sample"/);
  assert.match(source, /denominator = sampleConvention \? data\.length - 1 : data\.length/);
  assert.match(source, /distributionSummary\(opts\.data, statConvention\)/);
  assert.match(source, /sd <= 0/);
  assert.match(source, /requires a finite mean and a standard deviation greater than zero/);
  assert.match(source, /function addDualScaleAxes/);
  assert.match(source, /rawY = height - margin\.bottom/);
  assert.match(source, /zY = rawY \+ 28/);
  assert.match(source, /rawValue = mean \+ value \* sd/);
  assert.match(source, /lineClass: "ss-mean-line"/);
  assert.match(source, /lineClass: "ss-sd-line"/);
  assert.match(source, /centerSymbol = sampleConvention \? "M" : "μ"/);
  assert.match(source, /spreadSymbol = sampleConvention \? "s" : "σ"/);
  assert.match(source, /label: centerSymbol \+ " − " \+ spreadSymbol/);
  assert.match(source, /label: centerSymbol \+ " \+ " \+ spreadSymbol/);
  assert.match(source, /class", "ss-stat-label ss-guide-label bc-graph-label"/);
  assert.doesNotMatch(source, /ss-sd-span|sdSpans|spanY/);
  assert.doesNotMatch(styles, /standardized-score-graph \.ss-sd-span/);
  assert.match(styles, /standardized-score-graph \.ss-stat-label[\s\S]*?font-family: var\(--bc-math-font-family\)/);
  assert.match(source, /selectAll\("\.dg-marker-line"\)[\s\S]*?\.attr\("y1", zY\)/);
  assert.match(source, /attr\("y2", zY\)/);
  assert.doesNotMatch(source, /ss-sd-bracket|ss-sd-cap|\.text\("μ = "|\.text\("σ = "/);
  assert.match(source, /class", "ss-axis-side-label ss-raw-axis-side-label/);
  assert.match(source, /class", "ss-axis-side-label ss-z-axis-side-label/);
  assert.doesNotMatch(source, /ss-z-ruler-board/);
});

test("static examples and the tutorial extend the shared graph and ruler systems", () => {
  assert.match(chapter, /- standardization-ruler/);
  assert.match(manifest,
    /\["standardization-ruler"\][\s\S]*?deps = \{ "graph-generator", "distribution-generator", "interactive-figure-tools" \}/
  );
  assert.match(source, /global\.makeGraph\(graphOpts\)/);
  assert.match(source, /global\.makeDistributionGraph\(graphOpts\)/);
  assert.match(source, /global\.makeGraph\(\{/);
  assert.match(source, /global\.makeDistributionGraph\(\{/);
  assert.match(source, /global\.bcGraphStyleAxis\(rawAxis\)/);
  assert.match(source, /global\.bcGraphStyleAxis\(zAxis\)/);
  assert.match(styles, /bc-standardization-comparison-row/);
  assert.match(styles, /standardized-score-graph \.ss-z-axis \.bc-graph-domain/);
  assert.match(styles, /standardized-score-graph \.ss-mean-line/);
  assert.match(styles, /standardized-score-graph \.ss-sd-line/);
  assert.doesNotMatch(styles, /standardized-score-graph \.ss-sd-span/);
  assert.doesNotMatch(styles, /standardized-score-graph \.ss-z-ruler-board/);
  assert.match(styles, /standardization-ruler \.sr-ruler\.is-focus/);
});

test("IQ and SAT modes stay aligned and motion remains responsive and interruptible", () => {
  assert.match(source, /iqScaled:[\s\S]*?ticks: \[-30, -15, 0, 15, 30\][\s\S]*?multiplier: 15/);
  assert.match(source, /iq:[\s\S]*?ticks: \[70, 85, 100, 115, 130\][\s\S]*?offset: 100/);
  assert.match(source, /satScaled:[\s\S]*?ticks: \[-200, -100, 0, 100, 200\][\s\S]*?multiplier: 100/);
  assert.match(source, /sat:[\s\S]*?ticks: \[300, 400, 500, 600, 700\][\s\S]*?offset: 500/);
  assert.match(source, /iqScore: nextState\.scene === "curve" \? 130 : null/);
  assert.match(source, /satScore: nextState\.scene === "curve" \? 700 : null/);
  assert.match(source, /interactiveRuntime/);
  assert.match(source, /motion\.shouldAnimate/);
  assert.match(source, /bc-if:cancel-transitions/);
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /context\.signal/);
  assert.match(source, /observeResponsiveLayout/);
  assert.match(source, /compactBelow: 470/);
  assert.match(source, /rulerSvg\.setAttribute\("aria-label", accessibleDescription/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.standardization-ruler/);
});
