import assert from "node:assert/strict";
import test from "node:test";
import { divById, readChapter, tutorialSteps } from "./helpers/qmd.mjs";

const chapter = readChapter("18-regression.qmd");
const temperature = divById(chapter, "act-celsius-fahrenheit");
const options = JSON.parse(/makeScatterplot options='([^']+)'/.exec(temperature)[1]);
const steps = tutorialSteps(temperature).map((step) => step.action);
const fahrenheit = (c) => 1.8 * c + 32;

test("the temperature points are exact conversions, so the fitted line is the conversion", () => {
  assert.ok(options.points.length >= 3);
  for (const [c, f] of options.points) assert.ok(Math.abs(f - fahrenheit(c)) < 1e-9, `${c} °C is not ${f} °F`);
});

test("every temperature step sets its domains, and its guide and rise-run stay on the plot", () => {
  const [xLo, xHi] = options.xDomain;
  const [yLo, yHi] = options.yDomain;
  for (const action of steps) {
    const [stepXLo, stepXHi] = action["x-domain"] || [xLo, xHi];
    const [stepYLo, stepYHi] = action["y-domain"] || [yLo, yHi];
    assert.ok(action["x-domain"] && action["y-domain"], "a step after the zoom would inherit it");
    const xs = [];
    if (action.guide !== undefined) xs.push(action.guide);
    if (action["rise-run"]) xs.push(action["rise-run"].from, action["rise-run"].to);
    for (const c of xs) {
      assert.ok(c >= stepXLo && c <= stepXHi, `${c} °C is off the plot`);
      assert.ok(fahrenheit(c) >= stepYLo && fahrenheit(c) <= stepYHi, `${fahrenheit(c)} °F is off the plot`);
    }
  }
});

test("the temperature slider covers the plotted range and is revealed by a step", () => {
  const guide = options.sliders.find((slider) => slider.key === "guide");
  assert.deepEqual(guide.range.slice(0, 2), options.xDomain);
  assert.ok(steps.some((action) => (action["show-sliders"] || []).includes("guide")));
});

test("the least-squares sliders can reach the line the text asks readers to try", () => {
  const leastSquares = divById(chapter, "act-least-squares");
  const sliders = JSON.parse(/makeScatterplot options='([^']+)'/.exec(leastSquares)[1]).sliders;
  const within = (key, value) => {
    const [min, max, step] = sliders.find((slider) => slider.key === key).range;
    return value >= min && value <= max && Number.isInteger((value - min) / step);
  };
  // The fitted line, and the same slope with the intercept moved down five points.
  for (const [slope, intercept] of [[-10, 80], [-10, 75]]) {
    assert.ok(within("slope", slope) && within("intercept", intercept));
  }
  const last = tutorialSteps(leastSquares).at(-1).action;
  assert.deepEqual(last["show-sliders"].slice().sort(), ["intercept", "slope"]);
});

test("the slope figure starts at the intercept and steps one degree, inside its zoomed axes", () => {
  const figure = divById(chapter, "fig-temperature-slope-intercept");
  const opts = JSON.parse(/makeScatterplot options='([^']+)'/.exec(figure)[1]);
  assert.equal(opts.guide, 0);
  assert.deepEqual(opts.riseRun, { from: 0, to: 1 });
  const [xLo, xHi] = opts.xDomain;
  const [yLo, yHi] = opts.yDomain;
  for (const c of [0, 1]) {
    assert.ok(c >= xLo && c <= xHi && fahrenheit(c) >= yLo && fahrenheit(c) <= yHi);
  }
  // Points outside the zoomed axes would be drawn off the plot.
  assert.equal(opts.showPoints, false);
});
