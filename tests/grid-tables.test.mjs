// Pandoc reads a grid table by its column positions, so one row of the wrong length
// silently breaks the table. It still renders, so the smoke test can't see it.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const chapters = readdirSync(ROOT).filter((name) => name.endsWith(".qmd"));

test("every line of a grid table has the same length", () => {
  for (const name of chapters) {
    const lines = readFileSync(join(ROOT, name), "utf8").split("\n");
    let width = null;
    lines.forEach((line, index) => {
      const inTable = /^(\+[-=+:]+\+|\|.*\|)\s*$/.test(line);
      if (/^\+[-=+:]+\+\s*$/.test(line) && width === null) width = line.trimEnd().length;
      else if (width !== null && inTable) {
        assert.equal([...line.trimEnd()].length, width, `${name}:${index + 1}`);
      } else if (!inTable) width = null;
    });
  }
});
