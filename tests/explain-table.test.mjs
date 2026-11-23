// The working shown in explain-table popups: placeholders filled from a row,
// negatives bracketed where they follow an operator, TeX groups left alone,
// and sums signed term by term. Also checks that each explain-table spec in
// the chapters names its columns and only uses those names.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

function loadHelpers() {
  const window = {};
  const document = { readyState: "complete", querySelectorAll: () => [] };
  vm.runInNewContext(readFileSync(join(ROOT, "resources/js/explain-table.js"), "utf8"), { window, document });
  return window.sfsExplainTable;
}

test("fill brackets negatives after an operator and leaves TeX groups alone", () => {
  const { fill } = loadHelpers();
  const keys = ["Z", "e", "dY"];
  const row = { Z: "9", e: "-\\frac{1}{3}", dY: "-20" };
  assert.equal(fill("-\\frac{1}{3}({Z}) + \\frac{10}{3}", k => row[k], keys), "-\\frac{1}{3}(9) + \\frac{10}{3}");
  assert.equal(fill("{e} \\times {dY}", k => row[k], keys), "-\\frac{1}{3} \\times (-20)");
  assert.equal(fill("({e})^2", k => row[k], keys), "(-\\frac{1}{3})^2");
});

test("sums read as plus or minus each term, across lines", () => {
  const { joinTerms, chunk } = loadHelpers();
  assert.equal(joinTerms(["-6.67", "1.67", "-2.5"], false), "-6.67 + 1.67 - 2.5");
  assert.deepEqual([...chunk(["1", "-2", "3", "4", "-5"])], ["1 - 2 + 3 + 4", "- 5"]);
});

test("a sum of rounded terms that misses the shown total is marked approximate", () => {
  const { roundedSumDiffers } = loadHelpers();
  assert.equal(roundedSumDiffers(["0.44", "0.11", "0.11", "4", "0.11", "0.11", "1.78"], "6.67"), true);
  assert.equal(roundedSumDiffers(["0.11", "0.03", "0.03", "0.44", "0.03", "0.03", "1"], "1.67"), false);
  assert.equal(roundedSumDiffers(["(9 - 7)^2", "1"], "12"), false);
  assert.equal(roundedSumDiffers(["13.33", "-3.33", "5", "10", "6.67", "1.67", "6.67"], "40"), true);
  assert.equal(roundedSumDiffers(["36", "289", "64", "49", "169", "4", "49"], "660"), false);
});

test("every explain-table spec only refers to its own columns", () => {
  for (const name of readdirSync(ROOT).filter(n => n.endsWith(".qmd"))) {
    const text = readFileSync(join(ROOT, name), "utf8");
    for (const match of text.matchAll(/\{\.sfs-explain-table data-explain='([^']+)'\}/g)) {
      // Pandoc halves the backslashes in attribute values.
      const spec = JSON.parse(match[1].replace(/\\\\/g, "\\"));
      const known = new Set(spec.keys);
      for (const [name, [row, key]] of Object.entries(spec.refs || {})) {
        assert.ok(known.has(key), `${name}: ref to unknown column ${key}`);
        assert.ok(row < (spec.summary || []).length, `${name}: ref to missing summary row ${row}`);
      }
      const usable = new Set([...known, ...Object.keys(spec.refs || {})]);
      const rules = [
        ...Object.entries(spec.cells || {}).map(([key, rule]) => [key, rule.calc]),
        ...(spec.summary || []).flatMap(row => Object.entries(row).map(([key, rule]) => [key, rule.sum || rule.mean]))
      ];
      for (const [key, template] of rules) {
        assert.ok(known.has(key), `${name}: unknown column ${key}`);
        assert.ok(template, `${name}: ${key} has no formula`);
        for (const [, used] of template.matchAll(/\{(\w+)\}/g)) {
          if (!/^\d+$/.test(used)) assert.ok(usable.has(used), `${name}: ${key} uses unknown name ${used}`);
        }
      }
      for (const key of Object.keys(spec.exact || {})) {
        assert.ok(known.has(key), `${name}: exact values for unknown column ${key}`);
      }
    }
  }
});
