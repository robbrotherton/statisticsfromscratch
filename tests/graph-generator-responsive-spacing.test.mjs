import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(
  new URL("../resources/js/graph-generator.js", import.meta.url),
  "utf8"
);

const context = vm.createContext({ console, window: {} });
vm.runInContext(source, context);

function marginAt(width, margin, yTickValues = [0, 2, 4, 6]) {
  return JSON.parse(JSON.stringify(context.sfsGraphResolveMargin({
    width,
    labels: { title: "Movie" },
    margin,
    yTickValues
  })));
}

test("default axis-title reserves tighten smoothly for miniature graphs", () => {
  assert.deepEqual(marginAt(240), {
    top: 42,
    right: 22,
    bottom: 48,
    left: 48
  });
  assert.deepEqual(marginAt(352), {
    top: 42,
    right: 22,
    bottom: 53,
    left: 55
  });
  assert.deepEqual(marginAt(480), {
    top: 42,
    right: 22,
    bottom: 58,
    left: 64
  });
});

test("responsive default margins clamp at both ends", () => {
  assert.deepEqual(marginAt(180), marginAt(240));
  assert.deepEqual(marginAt(760), marginAt(480));
});

test("wider or unknown y ticks retain the room their labels need", () => {
  assert.equal(marginAt(240, undefined, [0, 10]).left, 55);
  assert.equal(marginAt(240, undefined, [0, 100]).left, 62);
  assert.equal(marginAt(240, undefined, null).left, 64);
});

test("authored margins override responsive defaults exactly", () => {
  assert.deepEqual(marginAt(240, { left: 70, bottom: 66, right: 0 }), {
    top: 42,
    right: 0,
    bottom: 66,
    left: 70
  });
});

test("full-width histogram bins share edges without shifting overlaid series", () => {
  const x = value => value * 100;
  const first = { lower: 0, upper: 0.12 };
  const next = { lower: 0.12, upper: 0.24 };
  const width = context.sfsGraphHistogramWidth(first, x, 1, 0);
  assert.equal(width, 12);
  for (const series of [0, 1]) {
    assert.equal(context.sfsGraphHistogramX(first, x, 0, series, 0) + width,
      context.sfsGraphHistogramX(next, x, 0, series, 0));
  }
  // Existing overlay defaults remain available to other figures.
  assert.equal(context.sfsGraphHistogramX(first, x, 0.14, 1), 2.18);
});

test("matching scale ratio to bin width makes unit blocks square", () => {
  const margin = { top: 14, bottom: 14, left: 14, right: 14 };
  const dimensions = context.sfsGraphDimensionsForLinearScales(
    { width: 900, scaleAspectRatio: 0.12 }, "block", [-4.2, 4.2], [0, 30], margin);
  const binPixels = (dimensions.width - 28) / 8.4 * 0.12;
  const unitPixels = (dimensions.height - 28) / 30;
  assert.ok(Math.abs(binPixels - unitPixels) < 1e-10);
});
