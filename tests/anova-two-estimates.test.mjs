import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { divById, readChapter, tutorialSteps } from "./helpers/qmd.mjs";

const context = vm.createContext({ window: {} });
context.window.window = context.window;
for (const file of ["d3.min", "stat-helpers", "sampling-core", "anova-two-estimates"]) {
  vm.runInContext(await readFile(new URL(`../resources/js/${file}.js`, import.meta.url), "utf8"), context);
}
const core = context.window.sfsAnovaTwoEstimates;
const close = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b));

test("the mean squares match the chapter's two-group example", () => {
  const s = core.summarize([[189, 161, 237, 169], [310, 219, 303, 264]]);
  assert.ok(close(s.msBetween, 14450));
  assert.ok(close(s.msWithin, 8750 / 6));
  assert.ok(Math.abs(s.f - 9.909) < 1e-3);
});

test("more spread scales both estimates together, so F does not change", () => {
  for (let sample = 1; sample <= 20; sample += 1) {
    const z = core.standardScores("test-seed", sample, 2, 4);
    const a = core.summarize(core.scores(z, { mu: 230, effect: 0, sd: 36 }));
    const b = core.summarize(core.scores(z, { mu: 230, effect: 0, sd: 54 }));
    assert.ok(close(b.msBetween, a.msBetween * 1.5 ** 2));
    assert.ok(close(b.msWithin, a.msWithin * 1.5 ** 2));
    assert.ok(close(b.f, a.f));
  }
});

test("a real effect leaves MS within untouched", () => {
  for (const k of [2, 3]) {
    const z = core.standardScores("test-seed", 1, k, 4);
    const none = core.summarize(core.scores(z, { mu: 230, effect: 0, sd: 36 }));
    const some = core.summarize(core.scores(z, { mu: 230, effect: 40, sd: 36 }));
    assert.ok(close(some.msWithin, none.msWithin));
    assert.notEqual(some.msBetween, none.msBetween);
  }
});

test("population centers are balanced and the extremes are one effect apart", () => {
  for (const k of [2, 3, 4]) {
    const c = core.contrasts(k);
    assert.ok(Math.abs(c.reduce((a, b) => a + b, 0)) < 1e-12);
    assert.ok(close(c[k - 1] - c[0], 1));
  }
});

test("a seed always gives the same samples", () => {
  assert.deepEqual(core.standardScores("same", 7, 2, 4), core.standardScores("same", 7, 2, 4));
  assert.notDeepEqual(core.standardScores("same", 7, 2, 4), core.standardScores("same", 8, 2, 4));
});

test("every tutorial step sets its state absolutely", () => {
  const steps = tutorialSteps(divById(readChapter("14-anova.qmd"), "act-two-estimates"));
  assert.ok(steps.length > 0);
  for (const { action } of steps) {
    for (const key of ["effect", "sd", "samples", "show-sigma", "show-estimates", "show-tracker", "show-curve"]) {
      assert.ok(Object.hasOwn(action, key), `a step leaves ${key} unset`);
    }
    assert.equal(typeof action.samples, "number");
  }
});
