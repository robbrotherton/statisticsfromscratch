import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { divById, readChapter, tutorialSteps } from "./helpers/qmd.mjs";

const context = vm.createContext({ window: {} });
context.window.window = context.window;
for (const file of ["d3.min", "stat-helpers", "statistical-power"]) {
  vm.runInContext(await readFile(new URL(`../resources/js/${file}.js`, import.meta.url), "utf8"), context);
}
const d3 = context.d3;
const { sfsStats } = context.window;
const power = context.window.sfsStatisticalPower;

function stateFromAction(action) {
  return {
    mu: action.mu,
    sigma: action.sigma,
    n: action.n,
    d: action["effect-size"],
    alpha: action.alpha,
    twoTailed: action["two-tailed"]
  };
}

test("power is the alternative's area beyond the null's critical boundaries", () => {
  for (const d of [-1.2, -0.3, 0, 0.5, 1.5]) {
    for (const n of [4, 25, 90]) {
      for (const twoTailed of [true, false]) {
        const state = { mu: 50, sigma: 10, n, d, alpha: 0.05, twoTailed };
        const p = power.params(state);
        const se = 10 / Math.sqrt(n);
        const alt = 50 + d * 10;
        const upper = 50 + sfsStats.normalInv(twoTailed ? 0.975 : 0.95) * se;
        const lower = twoTailed ? 50 - (upper - 50) : -Infinity;
        const expected = 1 - sfsStats.normalCdf(upper, alt, se) + sfsStats.normalCdf(lower, alt, se);
        assert.ok(Math.abs(p.power - expected) < 1e-12);
        assert.ok(Math.abs(p.beta + p.power - 1) < 1e-12);
        assert.ok(Math.abs(p.powerLow + p.powerHigh - p.power) < 1e-12);
      }
    }
  }
  // With no effect, power is just the chance of a type I error (to the
  // precision of the book's normal approximations).
  const nullTrue = power.params({ mu: 0, sigma: 1, n: 10, d: 0, alpha: 0.05, twoTailed: true });
  assert.ok(Math.abs(nullTrue.power - 0.05) < 1e-6);
});

test("the tutorial never asks for more rulers than the figure reserves room for", () => {
  const steps = tutorialSteps(divById(readChapter("09-statistical-power.qmd"), "act-calculating-power"));
  assert.ok(steps.length > 0);
  for (const { action } of steps) {
    const rulers = [action["raw-scores"], action["h0-z"], action["h1-z"]].filter(Boolean).length;
    assert.ok(rulers <= 2, `a step shows ${rulers} rulers`);
  }
});

test("every tutorial step keeps both curves and all boundaries in view", () => {
  const steps = tutorialSteps(divById(readChapter("09-statistical-power.qmd"), "act-calculating-power"));
  for (const { action } of steps) {
    const state = stateFromAction(action);
    const p = power.params(state);
    const [low, high] = power.domain(state, p);
    for (const value of [state.mu, p.altMean, p.highCritical, p.lowCritical].filter(Number.isFinite)) {
      assert.ok(value - low >= 3.9 * p.se && high - value >= 0);
    }
  }
});

test("round-number ticks never crowd their neighbours", () => {
  const format = d3.format("~g");
  for (const [from, to] of [[38.08, 63], [165, 403], [0.2, 0.9], [-12, 12]]) {
    for (const width of [180, 280, 520, 900]) {
      const scale = d3.scaleLinear().domain([from, to]).range([0, width]);
      const ticks = power.readableTicks(scale, format, 10, 14);
      assert.ok(ticks.length >= 2);
      const widest = Math.max(...ticks.map((value) => power.textWidth(format(value))));
      if (ticks.length > 2) assert.ok(Math.abs(scale(ticks[1]) - scale(ticks[0])) >= widest + 14);
    }
  }
});

test("z rulers tick at whole multiples of the step inside the domain", () => {
  const values = power.zTickValues(55, 2, [38.08, 63], 2);
  const z = Array.from(values, (value) => (value - 55) / 2);
  assert.deepEqual(z, [-8, -6, -4, -2, 0, 2, 4]);
  assert.equal(power.niceStep(11, 33), 5);
  assert.equal(power.niceStep(40, 33), 1);
  assert.equal(power.niceStep(20, 33), 2);
});

test("close labels part without swapping order or leaving the plot", () => {
  const [a, b] = power.separatePair({ x: 100, width: 22 }, { x: 104, width: 22 }, 6, 0, 400);
  assert.ok(a < b && b - a >= 28 - 1e-9);
  const [c, d] = power.separatePair({ x: 104, width: 22 }, { x: 100, width: 22 }, 6, 0, 400);
  assert.ok(c > d && c - d >= 28 - 1e-9);
  const [e, f] = power.separatePair({ x: 5, width: 40 }, { x: 8, width: 40 }, 4, 0, 400);
  assert.ok(e - 20 >= -1e-9 && f - e >= 44 - 1e-9);
  const [g, h] = power.separatePair({ x: 10, width: 20 }, { x: 300, width: 20 }, 4, 0, 400);
  assert.deepEqual([g, h], [10, 300]);
  assert.ok(power.clearOf(100, 20, [{ x: 140, width: 30 }], 6));
  assert.ok(!power.clearOf(100, 20, [{ x: 120, width: 30 }], 6));
});

test("region labels sit wholly inside their region, clear of the other curve", () => {
  const baseline = 200;
  const bell = (center, spread, height) => (px) => baseline - height * Math.exp(-(((px - center) / spread) ** 2) / 2);
  const top = bell(300, 40, 180);
  const avoid = bell(220, 40, 180);
  const label = { width: 30, height: 15 };
  const spot = power.fitRegionLabel({ from: 150, to: 450, top, avoid, baseline, ...label });
  assert.ok(spot);
  const halfW = label.width / 2 + 3;
  const halfH = label.height / 2 + 3;
  for (let px = spot.x - halfW; px <= spot.x + halfW; px += 1) {
    assert.ok(spot.y - halfH >= top(px) - 1, "box pokes above its region");
    const other = avoid(px);
    assert.ok(!(other > spot.y - halfH && other < spot.y + halfH), "box sits astride the other curve");
  }
  // A sliver too thin for the label is left unlabelled.
  assert.equal(power.fitRegionLabel({ from: 440, to: 450, top, baseline, ...label }), null);
  assert.equal(power.fitRegionLabel({ from: 0, to: 60, top, baseline, ...label }), null);
});

test("the tutorial never shades a region under a hidden alternative", () => {
  const steps = tutorialSteps(divById(readChapter("09-statistical-power.qmd"), "act-calculating-power"));
  for (const { action } of steps) {
    if (action["shade-beta"] || action["shade-power"]) assert.equal(action["show-H1"], true);
  }
});
