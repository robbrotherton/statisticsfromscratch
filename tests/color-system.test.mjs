import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { siteStyles } from "./site-styles.mjs";

const theme = siteStyles;
const expected = [
  "#0072b2",
  "#e69f00",
  "#009e73",
  "#d55e00",
  "#cc79a7",
  "#56b4e9",
  "#f0e442"
];
const source = (name) => readFileSync(new URL(`../resources/js/${name}`, import.meta.url), "utf8");

function rgb(hex) {
  return hex.slice(1).match(/../g).map((pair) => Number.parseInt(pair, 16) / 255);
}

function luminance(hex) {
  const linear = rgb(hex).map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("the semantic graph series use the seven chromatic Okabe-Ito colors", () => {
  assert.equal(expected.length, 7);
  assert.ok(!expected.includes("#000000"));
  assert.match(theme, /--graph-data-color: #0072b2/);
  assert.match(theme, /--graph-series-1: var\(--graph-data-color\)/);
  expected.slice(1).forEach((color, index) => {
    assert.match(theme, new RegExp(`--graph-series-${index + 2}: ${color}`));
  });
});

test("palette contrast limits are measured explicitly", () => {
  const lowContrastOnWhite = expected.filter((color) => contrast(color, "#ffffff") < 3);
  assert.deepEqual(lowContrastOnWhite, ["#e69f00", "#56b4e9", "#f0e442"]);

  for (const color of expected) {
    assert.ok(contrast(color, "#222222") >= 3, `${color} on the dark background`);
  }
});

test("standalone figure fallbacks agree with the central series tokens", () => {
  for (const name of ["graph-generator.js", "distribution-generator.js"]) {
    const contents = source(name);
    expected.forEach((color, index) => {
      assert.match(contents, new RegExp(`--graph-series-${index + 1}, [^\\n]*${color}`));
    });
  }

  const anova = source("anova-variability-explorer.js");
  expected.slice(0, 4).forEach((color, index) => {
    assert.match(anova, new RegExp(`--graph-series-${index + 1}, ${color}`));
  });

  for (const name of [
    "height-variability-interactive.js",
    "interaction-plot.js",
    "sampling-visuals.js"
  ]) {
    assert.match(source(name), /--graph-series-2, #e69f00/);
  }

  for (const name of [
    "bee-swarm.js",
    "standard-error-curve-demo.js"
  ]) {
    assert.match(source(name), /--graph-series-1, [^\n]*#0072b2/);
  }

  assert.match(source("scatterplot.js"), /--graph-point-fill, #0072b2/);
});

test("the chapter 1 cover uses shared semantic series instead of a local D3 palette", () => {
  const cover = source("hidden-message.js");
  expected.slice(0, 5).forEach((color, index) => {
    assert.match(cover, new RegExp(`--graph-series-${index + 1}, [^\\n]*${color}`));
  });
  assert.doesNotMatch(cover, /schemeCategory10|schemeTableau10/);
  assert.match(cover, /--sfs-text, currentColor/);
});

test("the homepage dots inherit the shared semantic series palette", () => {
  expected.forEach((_, index) => {
    const cycle = index === 6 ? "7n" : `7n \\+ ${index + 1}`;
    assert.match(theme, new RegExp(`\\.home-dots__marks circle:nth-child\\(${cycle}\\) \\{ fill: var\\(--graph-series-${index + 1}\\); \\}`));
  });

  const heroPalette = theme.match(/\.home-dots__marks circle:nth-child[\s\S]*?@keyframes/)[0];
  assert.doesNotMatch(heroPalette, /fill:\s*#/);
});
