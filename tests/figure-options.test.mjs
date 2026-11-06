// A figure's options sit in a single-quoted shortcode argument, so an apostrophe in
// them ends the argument early. The figure still mounts, on default options, so the
// smoke test can't see it.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const chapters = readdirSync(ROOT).filter((name) => name.endsWith(".qmd"));

test("every figure's options are complete, valid JSON", () => {
  for (const name of chapters) {
    const source = readFileSync(join(ROOT, name), "utf8").replace(/<!--[\s\S]*?-->/g, "");
    for (const match of source.matchAll(/interactive-figure\s+(\w+)[^>]*?options='([^']*)'/g)) {
      assert.doesNotThrow(() => JSON.parse(match[2]), `${name}: ${match[1]}`);
    }
  }
});
