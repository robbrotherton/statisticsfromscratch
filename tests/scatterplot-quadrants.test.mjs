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
const { scStats, scQuadrant, scQuadrantCounts, scGenerateCloud, scNormalizePoints } = context;

const activity = divById(readChapter("17-correlation.qmd"), "act-same-side");
const bodies = Array.from(
  activity.matchAll(/^:::+ \{\.tutorial-step\b[^\n]*\}\s*\n([\s\S]*?)\n:::/gm),
  (match) => match[1]
);
const steps = tutorialSteps(activity).map((step, i) => ({ ...step, text: bodies[i] }));
const pointsFor = (action) => scNormalizePoints(action.points || scGenerateCloud(action.generate));

test("a point is on the same side when both deviations share a sign", () => {
  const points = scNormalizePoints([[0, 0], [2, 2], [0, 2], [2, 0], [1, 1]]);
  const stats = scStats(points);
  assert.deepEqual(points.map((p) => scQuadrant(p, stats)), [1, 1, -1, -1, 0]);
  assert.deepEqual({ ...scQuadrantCounts(points) }, { same: 2, opposite: 2, onMean: 1 });
});

test("a hollow point keeps a ring inside the dot's visible edge", () => {
  const { scHoleRadius, SC_DOT_OUTLINE, SC_RING_WIDTH } = context;
  for (const r of [4, 5.5]) {
    const visibleEdge = r - SC_DOT_OUTLINE / 2;
    assert.ok(Math.abs(visibleEdge - scHoleRadius(r) - SC_RING_WIDTH) < 1e-12);
    assert.ok(scHoleRadius(r) > 0, "the hole is visible");
  }
});

test("on screen, y grows downward, so above-and-right is the same side", () => {
  const { scOppositeOnScreen } = context;
  assert.equal(scOppositeOnScreen(10, 0, 5, 5), false);
  assert.equal(scOppositeOnScreen(0, 10, 5, 5), false);
  assert.equal(scOppositeOnScreen(10, 10, 5, 5), true);
  assert.equal(scOppositeOnScreen(5, 0, 5, 5), false);
});

test("every step of the same-side tutorial sets its points and both domains", () => {
  assert.ok(steps.length > 0);
  for (const { action } of steps) {
    assert.ok(action.points || action.generate, "step has no data");
    assert.equal(action["x-domain"].length, 2);
    assert.equal(action["y-domain"].length, 2);
  }
});

test("the same-side tutorial's people stay on the plot, with no negative spending", () => {
  for (const { action } of steps) {
    const [xLo, xHi] = action["x-domain"];
    const [yLo, yHi] = action["y-domain"];
    for (const p of pointsFor(action)) {
      assert.ok(p.x >= Math.max(0, xLo) && p.x <= xHi && p.y >= yLo && p.y <= yHi, `point ${p.x}, ${p.y} is off the plot`);
    }
  }
});

// Happiness is a whole number, so dots can only collide within a row. At
// phone width $16 is about a dot's width, so no two people in a row are
// closer than that, and nobody sits so near a mean that it is hard to tell
// which side they're on.
test("no two of the same-side tutorial's dots overlap or straddle a mean", () => {
  for (const { title, action } of steps) {
    const points = pointsFor(action);
    const stats = scStats(points);
    for (let i = 0; i < points.length; i++) {
      assert.ok(Math.abs(points[i].x - stats.meanX) >= 8 && Math.abs(points[i].y - stats.meanY) >= 0.3,
        `${title}: point ${points[i].x}, ${points[i].y} is too close to a mean`);
      for (let j = i + 1; j < points.length; j++) {
        if (points[i].y !== points[j].y) continue;
        assert.ok(Math.abs(points[i].x - points[j].x) >= 16,
          `${title}: points at ${points[i].x} and ${points[j].x} overlap`);
      }
    }
  }
});

test("the counts quoted in the same-side tutorial match its data", () => {
  for (const { text, action } of steps.filter((step) => step.action["show-quadrants"])) {
    const { same, opposite, onMean } = scQuadrantCounts(pointsFor(action));
    assert.equal(onMean, 0, "a point sits exactly on a mean");
    assert.match(text, new RegExp(`\\b${same}\\b[^.]*same side`), `expected ${same} on the same side`);
    assert.match(text, new RegExp(`\\b${opposite}\\b[^.]*opposite`), `expected ${opposite} on opposite sides`);
  }
});
