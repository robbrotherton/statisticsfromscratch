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
