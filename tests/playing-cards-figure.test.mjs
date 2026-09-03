import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const svg = readFileSync(new URL("../resources/figures/playing-cards.svg", import.meta.url), "utf8");
const defs = svg.slice(svg.indexOf("<defs>"), svg.indexOf("</defs>"));
const drawing = svg.slice(svg.indexOf("</defs>"));

// The figure is inlined into the chapter, where two quirks of SVG-inside-HTML
// apply: a style element's rules are built from its direct child text, so any
// tag named in it truncates the stylesheet, and page rules never reach the
// copies that <use> makes. Both once emptied these cards onto the page as
// three black rectangles.
test("the cards carry their own paint rather than relying on page rules", () => {
  assert.ok(!svg.includes("<style"), "an inline SVG must not carry a style element");
  assert.ok(!/<[^>]+\sclass=/.test(defs), "shapes in <defs> must not be styled by class");

  for (const paint of ['fill="#1e1e1e"', 'fill="#d1495b"', 'fill="currentColor"']) {
    assert.ok(svg.includes(paint), `${paint} should be set on the drawing itself`);
  }
});

test("the cards rest face up, so the prose holds when the turn never plays", () => {
  const backs = drawing.match(/<g class="sfs-card-back"[^>]*>/g) ?? [];
  assert.equal(backs.length, 2, "the two turning cards each have a back");
  for (const back of backs) {
    assert.match(back, /opacity="0"/, "a hidden back must not depend on the stylesheet");
  }
});
