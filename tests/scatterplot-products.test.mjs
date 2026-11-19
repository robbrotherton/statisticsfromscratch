import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { divById, readChapter, tutorialSteps } from "./helpers/qmd.mjs";

const context = vm.createContext({ window: {} });
context.window.window = context.window;
for (const file of ["d3.min", "scatterplot"]) {
  vm.runInContext(await readFile(new URL(`../resources/js/${file}.js`, import.meta.url), "utf8"), context);
}
const { scStats, scGenerateCloud, scNormalizePoints, scPlotGeometry, scPointRadius } = context;

const steps = tutorialSteps(divById(readChapter("17-correlation.qmd"), "act-sum-of-products"));
const pointsFor = (action) => scNormalizePoints(action.points || scGenerateCloud(action.generate));

test("the sum of products is the sum of each point's product of deviations", () => {
  const stats = scStats(scNormalizePoints([[0, 90], [0.5, 60], [0.5, 85], [1, 65], [1.5, 50], [1.5, 65], [2, 75]]));
  assert.equal(stats.meanX, 1);
  assert.equal(stats.meanY, 70);
  assert.equal(stats.ssX, 3);
  assert.equal(stats.ssY, 1200);
  assert.equal(stats.sp, -30);
  assert.ok(Math.abs(stats.r - -0.5) < 1e-12);
});

test("every step of the products tutorial sets its points and both domains", () => {
  assert.ok(steps.length > 0);
  for (const { action } of steps) {
    assert.ok(action.points || action.generate, "step has no data");
    assert.equal(action["x-domain"].length, 2);
    assert.equal(action["y-domain"].length, 2);
  }
});

test("every point in the products tutorial stays inside the plotted domain", () => {
  for (const { action } of steps) {
    const [xLo, xHi] = action["x-domain"];
    const [yLo, yHi] = action["y-domain"];
    for (const p of pointsFor(action)) {
      assert.ok(p.x >= xLo && p.x <= xHi && p.y >= yLo && p.y <= yHi, `point ${p.x}, ${p.y} is off the plot`);
    }
  }
});

test("a generated cloud's sum of products has the sign of the correlation it asks for", () => {
  for (const { action } of steps.filter((step) => step.action.generate)) {
    const { sp, ssX, ssY } = scStats(pointsFor(action));
    const r = action.generate.r;
    if (r === 0) assert.ok(Math.abs(sp) < 0.02 * Math.sqrt(ssX * ssY));
    else assert.equal(Math.sign(sp), Math.sign(r));
  }
});

const fullMargin = { top: 24, right: 24, bottom: 58, left: 64 };
const bareMargin = { top: 24, right: 24, bottom: 26, left: 26 };
const geometry = (width, authoredWidth, margin, text) => scPlotGeometry({
  width, authoredWidth, authoredHeight: null, margin, textLeft: text, textBottom: text, aspect: 1
});

test("at its authored width a plot keeps its authored margins and a square plot area", () => {
  const g = geometry(640, 640, fullMargin, true);
  assert.deepEqual({ ...g.margin }, fullMargin);
  assert.equal(g.innerWidth, 552);
  assert.equal(g.innerHeight, 552);
});

test("a narrower plot keeps the margins that hold text and shrinks the empty ones", () => {
  const g = geometry(340, 640, fullMargin, true);
  assert.equal(g.margin.left, 64);
  assert.equal(g.margin.bottom, 58);
  assert.ok(g.margin.top < 24 && g.margin.top >= 12);
  assert.ok(g.margin.right < 24 && g.margin.right >= 12);
  assert.equal(g.innerWidth, g.innerHeight);
  const bare = geometry(110, 220, bareMargin, false);
  for (const side of ["top", "right", "bottom", "left"]) assert.ok(bare.margin[side] >= 12 && bare.margin[side] <= 13);
});

test("dots are full size wherever there is room, and never below the floor", () => {
  assert.equal(scPointRadius(552), 5.5);
  assert.equal(scPointRadius(geometry(340, 640, fullMargin, true).innerWidth), 5.5);
  const panel = scPointRadius(geometry(178, 220, bareMargin, false).innerWidth);
  assert.ok(panel > 4 && panel < 5.5);
  assert.equal(scPointRadius(40), 4);
  assert.equal(scPointRadius(552, 3), 3);
});

test("effect-size panels change association while preserving observations, marginal spread and plot scales", () => {
  const figure = divById(readChapter("17-correlation.qmd"), "fig-correlation-effect-sizes");
  const examples = Array.from(figure.matchAll(/makeScatterplot options='([^']+)'/g), match => JSON.parse(match[1]));
  assert.equal(examples.length, 2);
  const baseline = pointsFor(examples[0]);
  const baselineStats = scStats(baseline);
  let previousR = -1;
  for (const options of examples) {
    const points = pointsFor(options);
    const stats = scStats(points);
    assert.equal(points.length, baseline.length);
    assert.deepEqual(Array.from(points, p => p.x), Array.from(baseline, p => p.x));
    assert.ok(Math.abs(stats.r - options.generate.r) < 1e-5);
    assert.ok(stats.r > previousR);
    assert.ok(Math.abs(stats.ssY - baselineStats.ssY) / baselineStats.ssY < 1e-5);
    for (const p of points) {
      assert.ok(p.x >= options.xDomain[0] && p.x <= options.xDomain[1]);
      assert.ok(p.y >= options.yDomain[0] && p.y <= options.yDomain[1]);
    }
    assert.deepEqual(options.xDomain, examples[0].xDomain, "panels share the X scale");
    assert.deepEqual(options.yDomain, examples[0].yDomain, "panels share the Y scale");
    previousR = stats.r;
  }
});
