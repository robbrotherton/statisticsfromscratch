// Chapter 18's regression partition draws each sum of squares to scale, from
// the regression square cut into bands to an F for each predictor. Check the
// pieces have their areas in every phase, fit in the figure, and agree with
// the chapter's numbers.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { divById, readChapter } from "./helpers/qmd.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-9, `${label}: ${a} vs ${b}`);

function geometryOf(opts) {
  const context = { window: {}, document: {} };
  vm.runInNewContext(readFileSync(join(ROOT, "resources/js/regression-partition.js"), "utf8"), context);
  return context.sfsRegressionPartitionGeometry(opts);
}

const chapterOptions = () => {
  const activity = divById(readChapter("18-regression.qmd"), "act-regression-partition");
  return JSON.parse(/makeRegressionPartition options='([^']+)'/.exec(activity)[1]);
};

test("the partition matches the coffee and sleep regression", () => {
  const geo = geometryOf(chapterOptions());
  close(geo.onlyBig, 240, "sleep only");
  close(geo.onlySmall, 20 / 3, "coffee only");
  close(geo.shared, 880 / 3, "shared");
  close(geo.ms, 165, "residual mean square");
  close(geo.fBig, 240 / 165, "F for sleep");
  close(geo.fSmall, 20 / 3 / 165, "F for coffee");
});

test("every piece has its area, the bands fill the regression square, and all of it fits", () => {
  const geo = geometryOf(chapterOptions());
  const area = (b) => b.w * b.h;
  const { rects } = geo;
  // The bands stack, bottom to top, into the regression square.
  const bands = ["bigPart", "smallPart", "sharedPart"].map((k) => rects[k].shared);
  close(bands.reduce((s, b) => s + area(b), 0), 540, "bands");
  close(bands[0].y + bands[0].h, rects.whole.shared.y + rects.whole.shared.h, "first band on the bottom");
  close(bands[1].y + bands[1].h, bands[0].y, "second band on the first");
  close(bands[2].y + bands[2].h, bands[1].y, "shared band on the second");
  close(bands[2].y, rects.whole.shared.y, "shared band reaches the top");
  // Each band starts flat where it will grow from.
  close(rects.bigPart.whole.h, 0, "sleep band starts flat");
  close(rects.smallPart.big.h, 0, "coffee band starts flat");
  close(rects.smallPart.big.y, bands[0].y, "coffee band grows from the top of sleep's");
  // Pulled out, each predictor's part keeps its area as a square, above the line.
  for (const [key, value] of [["bigPart", 240], ["smallPart", 20 / 3]]) {
    close(area(rects[key].pull), value, key);
    close(rects[key].pull.w, rects[key].pull.h, key + " is square");
    assert.ok(rects[key].pull.y + rects[key].pull.h < geo.line, key + " above the line");
  }
  close(area(rects.msLeft.f), 165, "mean square");
  // The line sits midway between the numerators and the mean squares.
  const numeratorBottom = rects.bigPart.f.y + rects.bigPart.f.h;
  close(rects.smallPart.f.y + rects.smallPart.f.h, numeratorBottom, "numerators level");
  close(geo.line - numeratorBottom, rects.msLeft.f.y - geo.line, "line centred");
  close(rects.msLeft.f.x + rects.msLeft.f.w / 2, geo.centers[0], "left denominator centred");
  close(rects.msRight.f.x + rects.msRight.f.w / 2, geo.centers[1], "right denominator centred");
  for (const phases of Object.values(rects)) {
    for (const b of Object.values(phases)) {
      assert.ok(b.x >= -1e-9 && b.y >= -1e-9 && b.x + b.w <= geo.width + 1e-9 && b.y + b.h <= geo.height + 1e-9,
        JSON.stringify(b));
    }
  }
});
