import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chapter = readFileSync(new URL("../03-central-tendency.qmd", import.meta.url), "utf8");
const source = readFileSync(new URL("../resources/js/mean-balance-beam.js", import.meta.url), "utf8");

function balanceTutorialSteps() {
  const start = chapter.indexOf("## The mean as a balance point");
  const end = chapter.indexOf("## Comparing the three measures", start);
  assert.ok(start >= 0 && end > start, "balance tutorial section should be present");

  const section = chapter.slice(start, end);
  return Array.from(section.matchAll(
    /data-title="([^"]+)" data-action='([^']+)'/g
  )).map((match) => ({
    title: match[1],
    action: JSON.parse(match[2])
  }));
}

test("the balance tutorial progressively reveals the calculation", () => {
  const steps = balanceTutorialSteps();
  assert.match(chapter, /"dropOnVisible":true/);
  assert.deepEqual(
    steps.map((step) => step.title),
    ["Balance", "Deviations", "Sums", "Wrong pivot", "Restored", "New score", "New mean", "Try it"]
  );

  assert.equal(steps[0].action["box-labels"], false);
  assert.equal(steps[0].action["deviation-sums"], false);
  assert.equal(steps[1].action["box-labels"], true);
  assert.equal(steps[1].action["deviation-sums"], false);
  assert.equal(steps[2].action["deviation-sums"], true);
});

test("the final steps distinguish an old pivot from the recomputed mean", () => {
  const steps = balanceTutorialSteps();
  const wrongPivot = steps[3].action;
  const restored = steps[4].action;
  const newScore = steps[5].action;
  const newMean = steps[6].action;
  const tryIt = steps[7].action;

  assert.equal(wrongPivot.pivot, 4);
  assert.deepEqual(restored.positions, [1, 2, 6, 6, 10]);
  assert.equal(restored.pivot, "mean");
  assert.deepEqual(newScore.positions, [1, 2, 2, 6, 6, 10]);
  assert.equal(newScore.pivot, 5);
  assert.equal(newScore.positions.reduce((total, value) => total + value, 0) / newScore.positions.length, 27 / 6);
  assert.notEqual(newScore.pivot, 27 / 6);
  assert.equal(newScore.positions.filter((value) => value < 5).reduce((total, value) => total + value - 5, 0), -10);
  assert.equal(newScore.positions.filter((value) => value > 5).reduce((total, value) => total + value - 5, 0), 7);
  assert.deepEqual(newMean.positions, newScore.positions);
  assert.equal(newMean.pivot, "mean");
  assert.equal(tryIt.interactive, true);
  assert.equal(tryIt["controls-open"], true);
});

test("the renderer supports staged labels, falling boxes, a moving pivot, a ghost pivot, and reduced motion", () => {
  assert.match(source, /boxLabels:/);
  assert.match(source, /case "box-labels":/);
  assert.match(source, /revealDeviationSums/);
  assert.match(source, /transition\("grow"\)/);
  assert.match(source, /ease\(d3\.easeLinear\)/);
  assert.match(source, /addedIds/);
  assert.match(source, /dropOnVisible/);
  assert.match(source, /fallDurationForDistance/);
  assert.match(source, /ease\(d3\.easeQuadIn\)/);
  assert.match(source, /balanceMotionDuration/);
  assert.match(source, /beamTipDuration/);
  assert.match(source, /isImpact \? beamTipDuration : balanceMotionDuration/);
  assert.match(source, /isImpact \? d3\.easeCubicOut : d3\.easeCubicInOut/);
  assert.match(source, /transition\("move-pivot"\)/);
  assert.match(source, /d3\.interpolateNumber\(startPivotPx, targetPivotPx\)/);
  assert.match(source, /mbb-mean-ghost/);
  assert.doesNotMatch(source, /mbb-mean-marker/);
  assert.match(source, /!prefersReducedMotion\(\)/);
  assert.match(source, /updateAriaLabel\(sums\)/);
});

test("declarative position changes preserve existing box identities", () => {
  assert.match(source, /function createBox\(position, level, landed\)/);
  assert.match(source, /remainingBoxes\.findIndex\(function\(box\) \{ return box\.x === x; \}\)/);
  assert.match(source, /box = createBox\(x, 0, !deferNewBoxes\)/);
  assert.match(source, /const box = createBox\(x, positionsArr\[x\], prefersReducedMotion\(\)\)/);
  assert.doesNotMatch(source, /id: index \+ 1/);
  assert.doesNotMatch(source, /nextBoxId = boxArr\.length/);
});

test("new boxes affect the balance only when their fall ends", () => {
  assert.match(source, /landed: landed !== false/);
  assert.match(source, /function getLandedBoxes\(\)/);
  assert.match(source, /d\.affectsBalanceOnLanding = d\.landed === false/);
  assert.match(source, /\.on\("end\.balance-impact", function\(\)/);
  assert.match(source, /box\.landed = true;\s+update\(notifyOnLanding, \{ animate: true, balanceImpact: true \}\)/);
  assert.match(source, /const landed = getLandedBoxes\(\);\s+const negative = landed\.filter/);
  assert.match(source, /if \(!shouldAnimate\)/);
});

test("direct manipulation is enabled only by the final tutorial step", () => {
  const steps = balanceTutorialSteps();
  assert.match(chapter, /"draggable":false,"addOnClick":false,"removeOnClick":false/);
  assert.equal(steps.at(-1).action.interactive, true);
  assert.ok(steps.slice(0, -1).every((step) => step.action.interactive === undefined));
  assert.match(source, /draggable: booleanOpt\(opts\.draggable, false\)/);
  assert.match(source, /case "interactive":/);
  assert.match(source, /state\.draggable = directManipulationDefaults\.draggable/);
  assert.match(source, /if \(!state\.addOnClick\) return/);
  assert.match(source, /addButtonControl\.disabled = !state\.addOnClick/);
  assert.match(source, /pivotButtonControl\.disabled = !state\.draggable/);
});
