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

test("a raw mean difference, unlike d, lets the population SD change power", () => {
  const base = { mu: 50, n: 25, alpha: 0.05, twoTailed: true };
  const byD = [5, 20].map((sigma) => power.params({ ...base, sigma, d: 0.5 }).power);
  assert.ok(Math.abs(byD[0] - byD[1]) < 1e-12);
  const byDiff = [5, 20].map((sigma) => power.params({ ...base, sigma, diff: 5 }).power);
  assert.ok(byDiff[0] > byDiff[1] + 0.3);
  assert.ok(Math.abs(power.params({ ...base, sigma: 10, diff: 5 }).power - 0.705) < 0.001);
});

test("the minimal figure's axes hold every curve a shown slider can reach", () => {
  const state = { mu: 50, sigma: 10, n: 25, diff: 5, alpha: 0.05, twoTailed: true };
  const ranges = { n: [4, 100], sigma: [4, 25], diff: [0, 15] };
  const { domain, peak } = power.fixedExtent(state, ranges);
  for (const n of [4, 25, 100]) {
    for (const sigma of [4, 10, 25]) {
      for (const diff of [0, 5, 15]) {
        const s = { ...state, n, sigma, diff };
        const p = power.params(s);
        assert.ok(peak >= sfsStats.normalPdf(0, 0, p.se) - 1e-12);
        for (const center of [s.mu, p.altMean]) {
          assert.ok(center - 3.5 * p.se >= domain[0] - 1e-9 && center + 3.5 * p.se <= domain[1] + 1e-9);
        }
      }
    }
  }
  // With nothing to drag, the axes fit the curves as they stand.
  const still = power.fixedExtent(state, {});
  assert.ok(still.domain[1] - still.domain[0] < domain[1] - domain[0]);
});

test("each factor step reveals its own control, and every step that sets the design starts from the same one", () => {
  const steps = tutorialSteps(divById(readChapter("09-statistical-power.qmd"), "act-power-factors"));
  assert.ok(steps.length > 0);
  const starts = [];
  for (const { action, major } of steps) {
    if (action.solve === "n") {
      // Solving for n shows the effect and the answer.
      assert.deepEqual([...action["show-controls"]].sort(), ["diff", "n"]);
    } else if (action["show-controls"].length > 1) {
      // Solving for power shows the answer, and never sigma: n and sigma
      // together span too many curve widths for one fixed frame.
      assert.ok(action["show-controls"].includes("power"));
      assert.ok(!action["show-controls"].includes("sigma"));
    } else {
      assert.deepEqual(action["show-controls"], [major]);
    }
    if ("n" in action) {
      const { "show-controls": shown, solve, ranges, "target-power": target, ...design } = action;
      starts.push(JSON.stringify(design));
    }
  }
  assert.equal(new Set(starts).size, 1);
  assert.ok(steps.some(({ action }) => action.solve === "n"));
});

test("solving for n finds the smallest sample that reaches the target power", () => {
  const state = { mu: 50, sigma: 10, diff: 5, alpha: 0.05, twoTailed: true };
  const solved = power.requiredN(state, 0.8, 5000);
  assert.deepEqual({ ...solved }, { n: 32, reached: true });
  assert.ok(power.params({ ...state, n: 32 }).power >= 0.8);
  assert.ok(power.params({ ...state, n: 31 }).power < 0.8);
  // One tail, lower alpha and a bigger difference move the answer the right way.
  assert.ok(power.requiredN({ ...state, twoTailed: false }, 0.8, 5000).n < 32);
  assert.ok(power.requiredN({ ...state, alpha: 0.01 }, 0.8, 5000).n > 32);
  assert.ok(power.requiredN({ ...state, diff: 10 }, 0.8, 5000).n < 32);
  // No difference, no sample size is enough.
  assert.equal(power.requiredN({ ...state, diff: 0 }, 0.8, 5000).reached, false);
  // The exact n the figure draws with gives the target power and rounds up
  // to the whole-number answer.
  const exact = power.exactN(state, 0.8, 5000);
  assert.ok(Math.abs(power.params({ ...state, n: exact.n }).power - 0.8) < 1e-6);
  assert.equal(Math.ceil(exact.n), 32);
});

test("solving for n, the fixed axes hold every curve the effect slider can reach", () => {
  const steps = tutorialSteps(divById(readChapter("09-statistical-power.qmd"), "act-power-factors"));
  const { action } = steps.find((step) => step.action.solve === "n");
  const state = { mu: action.mu, sigma: action.sigma, diff: action.diff, alpha: action.alpha, twoTailed: action["two-tailed"] };
  const target = action["target-power"];
  const [low, high] = action.ranges.diff;
  const { domain, peak } = power.fixedExtent(state, { diff: [low, high] }, { target, max: 5000 });
  assert.ok(Number.isFinite(peak) && domain.every(Number.isFinite));
  for (let diff = low; diff <= high; diff += 0.5) {
    const s = { ...state, diff };
    const p = power.params({ ...s, n: power.exactN(s, target, 5000).n });
    assert.ok(Math.abs(p.power - target) < 1e-6);
    assert.ok(spNormalPeak(p.se) <= peak + 1e-12);
    assert.ok(p.altMean + 3.5 * p.se <= domain[1] + 1e-9 && s.mu - 3.5 * p.se >= domain[0] - 1e-9);
  }
  // The smallest effect needs the tallest curves; the running example sits
  // well up the axis rather than as a sliver along the bottom.
  const start = power.params({ ...state, n: power.exactN(state, target, 5000).n });
  assert.ok(spNormalPeak(start.se) / peak > 0.4);
});

function spNormalPeak(se) {
  return sfsStats.normalPdf(0, 0, se);
}

test("every multi-slider step's fixed axes keep the opening curves well up the plot", () => {
  const steps = tutorialSteps(divById(readChapter("09-statistical-power.qmd"), "act-power-factors"));
  const defaults = { alpha: [0.01, 0.2], n: [4, 100], sigma: [5, 20], diff: [0, 15] };
  for (const { action } of steps.filter((step) => "n" in step.action && step.action["show-controls"].length > 1)) {
    const state = { mu: action.mu, sigma: action.sigma, n: action.n, diff: action.diff, alpha: action.alpha, twoTailed: action["two-tailed"] };
    const solveFor = action.solve || "power";
    const target = action["target-power"] || 0.8;
    const ranges = {};
    for (const key of action["show-controls"]) {
      if (key !== solveFor && defaults[key]) ranges[key] = (action.ranges && action.ranges[key]) || defaults[key];
    }
    const solve = solveFor === "n" ? { target, max: 5000 } : null;
    const { domain, peak } = power.fixedExtent(state, ranges, solve);
    const start = solve ? { ...state, n: power.exactN(state, target, 5000).n } : state;
    const p = power.params(start);
    assert.ok(spNormalPeak(p.se) / peak > 0.3, `${solveFor}: curves start too low`);
    assert.ok((p.altMean - state.mu + 7 * p.se) / (domain[1] - domain[0]) > 0.3, `${solveFor}: curves start too narrow`);
  }
});
