import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { divById, readChapter, tutorialSteps } from "./helpers/qmd.mjs";

const context = vm.createContext({ window: {} });
context.window.window = context.window;
for (const file of ["d3.min", "stat-helpers", "t-squared"]) {
  vm.runInContext(await readFile(new URL(`../resources/js/${file}.js`, import.meta.url), "utf8"), context);
}
const { sfsStats } = context.window;
const tsq = context.window.sfsTSquared;

test("the two squared halves together are the F(1, df) density", () => {
  for (const df of [2, 6, 9, 30]) {
    for (const f of [0.05, 0.5, 1, 3.7, 9.91, 20]) {
      const folded = 2 * tsq.halfDensity(Math.sqrt(f), 2, df);
      const expected = sfsStats.f.pdf(f, 1, df);
      assert.ok(Math.abs(folded - expected) < 1e-6 * Math.max(1, expected), `df ${df}, F ${f}`);
    }
  }
});

test("before squaring, a half is just the t density", () => {
  for (const u of [0, 0.4, 2.447, 4]) {
    assert.equal(tsq.halfDensity(u, 1, 6), sfsStats.tPdf(u, 6));
  }
});

test("the critical value and the p value carry over from t to F", () => {
  const crit = tsq.critical(6, 0.05);
  assert.ok(Math.abs(crit.t - 2.447) < 1e-3);
  assert.ok(Math.abs(crit.f - sfsStats.f.inv(0.95, 1, 6)) < 1e-4);
  for (const t of [-3.14786, 0.82, 2.5]) {
    assert.ok(Math.abs(tsq.pTwoTailed(t, 6) - tsq.pF(t * t, 6)) < 1e-6);
  }
});

test("the timeline's phases run in order and each stage sits on it", () => {
  assert.deepEqual({ ...tsq.phases(tsq.STAGES.t) }, { flip: 0, stack: 0, zoom: 0, extend: 0, square: 0 });
  assert.deepEqual({ ...tsq.phases(tsq.STAGES.fold) }, { flip: 1, stack: 1, zoom: 1, extend: 0, square: 0 });
  // The axis is fully extended before any value is squared.
  assert.deepEqual({ ...tsq.phases(tsq.STAGES.extend) }, { flip: 1, stack: 1, zoom: 1, extend: 1, square: 0 });
  assert.deepEqual({ ...tsq.phases(tsq.STAGES.square) }, { flip: 1, stack: 1, zoom: 1, extend: 1, square: 1 });
  const mid = tsq.phases(1.5);
  assert.equal(mid.flip, 1);
  assert.equal(mid.zoom, 0);
});

test("every tutorial step names a stage the figure knows", () => {
  const steps = tutorialSteps(divById(readChapter("14-anova.qmd"), "act-t-squared"));
  assert.ok(steps.length > 0);
  for (const { action } of steps) {
    assert.ok(Object.hasOwn(tsq.STAGES, action.stage), `unknown stage ${action.stage}`);
  }
});
