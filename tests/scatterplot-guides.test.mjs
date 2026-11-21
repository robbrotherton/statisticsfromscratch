import assert from "node:assert/strict";
import test from "node:test";
import { divById, readChapter, tutorialSteps } from "./helpers/qmd.mjs";

const chapter = readChapter("18-regression.qmd");
const fahrenheit = (c) => 1.8 * c + 32;

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

test("the slope figure's line is the conversion, and its intercept guide and rise-run stay on the plot", () => {
  const figure = divById(chapter, "fig-temperature-slope-intercept");
  const opts = JSON.parse(/makeScatterplot options='([^']+)'/.exec(figure)[1]);
  assert.ok(opts.points.length >= 2);
  for (const [c, f] of opts.points) assert.ok(Math.abs(f - fahrenheit(c)) < 1e-9, `${c} °C is not ${f} °F`);
  assert.equal(opts.guide, 0);
  const [xLo, xHi] = opts.xDomain;
  const [yLo, yHi] = opts.yDomain;
  for (const c of [opts.guide, opts.riseRun.from, opts.riseRun.to]) {
    assert.ok(c >= xLo && c <= xHi && fahrenheit(c) >= yLo && fahrenheit(c) <= yHi, `${c} °C is off the plot`);
  }
  // The figure shows the line alone.
  assert.equal(opts.showPoints, false);
});

test("the best-fit slider covers the plotted range and starts visible", () => {
  const figure = /\{\{< interactive-figure bestFitLineScatter makeScatterplot options='([^']+)'/.exec(chapter);
  const opts = JSON.parse(figure[1]);
  const guide = opts.sliders.find((slider) => slider.key === "guide");
  assert.deepEqual(guide.range.slice(0, 2), opts.xDomain);
  assert.ok(opts.showSliders.includes("guide"));
});
