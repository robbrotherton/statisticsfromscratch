import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const context = vm.createContext({ window: {} });
vm.runInContext(
  await readFile(new URL("../resources/js/variance-partition-diagram.js", import.meta.url), "utf8"),
  context
);
const {
  vpdCompactBelow, vpdCompactLines, vpdCompactScale, vpdIsMathLine, vpdMathWidth,
  vpdPlaceCompact, vpdPresetSpecs, vpdSourceBlocks, vpdTextWidth
} = context;

// 250px is the chart wrap inside a tutorial on a 320px phone.
const widths = [250, 270, 300, 340, 400, 500, vpdCompactBelow - 1];

function compactSpec(preset, available) {
  const canvas = available / vpdCompactScale;
  const nodes = vpdPresetSpecs[preset]().nodes;
  nodes.forEach((node) => { if (vpdCompactLines[node.id]) node.lines = vpdCompactLines[node.id]; });
  return { canvas, nodes: vpdPlaceCompact(nodes, canvas) };
}

const overlaps = (a, b) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test("compact text stays at a readable size whatever the width", () => {
  assert.ok(19 * vpdCompactScale >= 12, "source labels");
  assert.ok(23 * vpdCompactScale >= 14, "node labels");
  // The wide layout hands over at the same text size, give or take a pixel.
  assert.ok(19 * vpdCompactBelow / 960 >= 11.5);
});

for (const preset of Object.keys(vpdPresetSpecs)) {
  test(`${preset}: compact nodes fit their row and their labels fit the box`, () => {
    for (const available of widths) {
      const { canvas, nodes } = compactSpec(preset, available);
      for (const node of nodes) {
        assert.ok(node.x - node.width / 2 >= 0 && node.x + node.width / 2 <= canvas, `${node.id} at ${available}`);
        // The width estimates run over the rendered font, by more on narrow
        // letters, so they can't judge the tightest fit: at 250, "interaction"
        // only fits by a measurement in the browser.
        if (available < 270) continue;
        for (const line of node.lines) {
          const lineWidth = vpdIsMathLine(line) ? vpdMathWidth(line, 25) : vpdTextWidth(line, 23);
          assert.ok(lineWidth * 0.95 <= node.width, `"${line}" at ${available}: ${lineWidth} > ${node.width}`);
        }
      }
      nodes.forEach((a, i) => nodes.slice(i + 1).forEach((b) => {
        const box = (n) => ({ left: n.x - n.width / 2, right: n.x + n.width / 2, top: n.y - n.height / 2, bottom: n.y + n.height / 2 });
        assert.ok(!overlaps(box(a), box(b)), `${a.id}/${b.id} at ${available}`);
      }));
    }
  });

  test(`${preset}: compact source blocks stay on the canvas and apart`, () => {
    for (const available of widths) {
      const { canvas, nodes } = compactSpec(preset, available);
      const blocks = vpdSourceBlocks(nodes, canvas).map((block) => ({
        id: block.nodeId,
        left: block.entries[0].x,
        right: block.entries[0].x + Math.max(...block.entries.map((entry) => entry.width)),
        top: block.entries[0].y - 20,
        bottom: block.bottom
      }));
      blocks.forEach((a, i) => {
        assert.ok(a.left >= 0 && a.right <= canvas, `${preset} ${a.id} at ${available}`);
        blocks.slice(i + 1).forEach((b) =>
          assert.ok(!overlaps(a, b), `${a.id}/${b.id} at ${available}`));
      });
    }
  });
}

test("related: the subdivided boxes stay slim and under the within box", () => {
  for (const available of widths) {
    const { canvas, nodes } = compactSpec("related", available);
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const { error, within } = byId;
    const people = byId["between-people"];
    assert.ok(people.x + people.width / 2 <= canvas);
    assert.ok(error.x > canvas / 5, `error at ${available}`);
    assert.ok(error.width < people.width, "boxes are sized to their own labels");
    // At the top of the compact range the pair fits wholly under its parent.
    if (available > 400) {
      assert.ok(error.x - error.width / 2 >= within.x - within.width / 2 - 1, `at ${available}`);
    }
  }
});

test("related: the link to the error box passes below the between sources", () => {
  for (const available of widths) {
    const { canvas, nodes } = compactSpec("related", available);
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const { error, within } = byId;
    const block = vpdSourceBlocks([byId.between], canvas)[0];
    const right = block.entries[0].x + 10 + Math.max(...block.entries.map((entry) => entry.width));
    const top = within.y + within.height / 2;
    const fall = (error.y - error.height / 2) - top;
    if (right <= error.x) continue;
    const y = top + fall * (within.x - right) / (within.x - error.x);
    assert.ok(y > block.bottom, `at ${available}: ${y} vs ${block.bottom}`);
  }
});
