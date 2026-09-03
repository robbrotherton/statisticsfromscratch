import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

import { STYLE_PARTS } from "./site-styles.mjs";

const config = readFileSync(new URL("../_quarto.yml", import.meta.url), "utf8");
const cssBlock = config.slice(config.indexOf("    css:")).split(/\n(?=    \S)/)[0];
const files = Array.from(cssBlock.matchAll(/^ +- resources\/css\/([\w-]+)\.css$/gm), (m) => m[1]);
const loaded = files.map((name) => name.replace(/^sfs-/, ""));

// The split is only safe while the pieces are all wired up, in the order they
// were cut from the original: CSS resolves ties by source order.
test("every stylesheet in the split is loaded, in order", () => {
  assert.deepEqual(loaded, [...STYLE_PARTS, "quiz"]);
});

test("no stylesheet in the split is empty or missing", () => {
  for (const name of STYLE_PARTS) {
    const path = new URL(`../resources/css/sfs-${name}.css`, import.meta.url);
    assert.ok(statSync(path).size > 0, `${name}.css should have content`);
  }
});

// Quarto matches a css: entry against Bootstrap's Sass layers by basename, so a
// file called navbar.css or tables.css silently replaces that whole Bootstrap
// component instead of adding to it. That broke the navbar once; the sfs- prefix
// is what keeps the book's sheets out of that namespace.
const BOOTSTRAP_LAYERS = new Set([
  "base", "navbar", "tables", "forms", "grid", "card", "nav", "buttons", "type",
  "images", "reboot", "containers", "modal", "alert", "badge", "toast", "popover"
]);

test("no stylesheet can be mistaken for a Bootstrap layer", () => {
  for (const name of files) {
    assert.ok(!BOOTSTRAP_LAYERS.has(name), `${name}.css collides with a Bootstrap layer`);
  }
});
