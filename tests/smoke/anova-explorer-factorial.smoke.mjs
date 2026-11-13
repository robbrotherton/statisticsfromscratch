// The ANOVA explorer's factorial mode (Chapter 16). Mounts the figure from resources/
// with the options and steps in 16-factorial-anova.qmd, so it needs no render and
// ignores prose. Not part of `npm test`, which runs without a browser.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { divById, readChapter, tutorialSteps } from "../helpers/qmd.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SCRIPTS = ["d3.min", "interactive-figure", "anova-squares", "anova-variability-explorer"];
const WIDTHS = [620, 340];
const near = (a, b, tolerance = 0.01) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);

const div = divById(readChapter("16-factorial-anova.qmd"), "act-factorial-anova-viz");
const options = JSON.parse(/makeAnovaVariabilityExplorer options='([^']+)'/.exec(div)[1]);
const steps = tutorialSteps(div);

// The same analysis worked from the raw scores, independently of the figure.
function expected(figureOptions) {
  const cells = figureOptions.groups;
  const all = cells.flatMap((cell) => cell.values);
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  const grand = mean(all);
  const sq = (v) => v * v;
  const level = (f, l) => cells.filter((cell) => cell.levels[f] === l).flatMap((cell) => cell.values);
  const ssFactor = (f) => [0, 1].reduce((sum, l) => sum + level(f, l).length * sq(mean(level(f, l)) - grand), 0);
  const ssBetween = cells.reduce((sum, cell) => sum + cell.values.length * sq(mean(cell.values) - grand), 0);
  const ssWithin = cells.reduce((sum, cell) => sum + cell.values.reduce((s, v) => s + sq(v - mean(cell.values)), 0), 0);
  const dfWithin = all.length - cells.length;
  const ssA = ssFactor(0);
  const ssB = ssFactor(1);
  const ssAB = ssBetween - ssA - ssB;
  const msWithin = ssWithin / dfWithin;
  return { ssA, ssB, ssAB, ssWithin, fA: ssA / msWithin, fB: ssB / msWithin, fAB: ssAB / msWithin };
}

let server;
let origin;
let browser;

before(async () => {
  server = createServer((req, res) => {
    const name = /^\/js\/([\w.-]+\.js)$/.exec(req.url);
    if (name) {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(readFileSync(join(ROOT, "resources/js", name[1])));
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html><meta charset="utf-8"><div id="host"></div>
      ${SCRIPTS.map((s) => `<script src="/js/${s}.js"></script>`).join("")}`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

async function mount(figureOptions, width) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.evaluate(({ figureOptions, width }) => {
    const host = document.getElementById("host");
    host.style.width = `${width}px`;
    window.__figure = window.makeAnovaVariabilityExplorer({ ...figureOptions, controlsPlacement: "none" });
    host.appendChild(window.__figure);
  }, { figureOptions, width });
  await page.waitForFunction((width) =>
    Number(document.querySelector("svg.ave-svg").getAttribute("viewBox").split(" ")[2]) === width, width);
  return { page, errors };
}

const go = (page, action) => page.evaluate(async (a) => {
  window.__figure.anovaVariabilityExplorer.applyTutorialAction({ ...a, animate: false });
  await new Promise((resolve) => setTimeout(resolve, 40));
}, action);

const statistics = (page) => page.evaluate(() => {
  const { observations, levelRanks, ...rest } = window.__figure.anovaVariabilityExplorer.getStatistics();
  return rest;
});

test("the partition matches the scores", async () => {
  const { page } = await mount(options, 620);
  const s = await statistics(page);
  const e = expected(options);
  near(s.levelStats[0].ss, e.ssA, 1e-9);
  near(s.levelStats[1].ss, e.ssB, 1e-9);
  near(s.ssInteraction, e.ssAB, 1e-9);
  near(s.ssWithin, e.ssWithin, 1e-9);
  near(s.levelStats[0].f, e.fA, 1e-9);
  near(s.levelStats[1].f, e.fB, 1e-9);
  near(s.fInteraction, e.fAB, 1e-9);
  // The interaction left over from between is the cells' squared departures from the
  // additive prediction.
  near(s.interactionCheck, s.ssInteraction, 1e-9);
  near(s.levelStats[0].ss + s.levelStats[1].ss + s.ssInteraction, s.ssBetween, 1e-9);
  await page.close();
});

// Lanes as drawn: one per cell, or one per level of the factor in use.
const laneCount = (page) => page.evaluate(() => document.querySelectorAll("line.ave-lane").length);

// Which layers of the sums are labelled, by their colour-independent keys.
const labelledLayers = (page) => page.evaluate(() =>
  Array.from(document.querySelectorAll("g.ave-label")).map((g) => d3.select(g).datum().key).sort());

test("every step draws, regrouping and splitting as it goes", async () => {
  for (const width of WIDTHS) {
    const { page, errors } = await mount(options, width);
    for (const { action } of steps) {
      await go(page, action);
      const rows = ["factor-a", "factor-b"].includes(action.stage) && action.phase !== "recolour";
      assert.equal(await laneCount(page), rows ? 2 : 4, `${width}: lanes at ${JSON.stringify(action)}`);
      // The population curves are for the opening step only.
      const curves = await page.evaluate(() => Array.from(document.querySelectorAll("g.ave-population"))
        .filter((g) => getComputedStyle(g).opacity !== "0").length);
      assert.equal(curves, action.stage === "populations" ? 4 : 0, `${width}: curves at ${JSON.stringify(action)}`);
      const labelled = await labelledLayers(page);
      // Between loses its name once a factor pours into it, and gets the interaction's
      // once the cells' departures fill what's left.
      const slotEmpty = ["factor-a", "factor-b"].includes(action.stage) && action.phase === "sum" ||
        action.stage === "factor-b" || (action.stage === "interaction" && action.phase !== "sum");
      if (slotEmpty) assert.ok(!labelled.includes("between"), `${width}: between named at ${JSON.stringify(action)}`);
      if (action.stage === "interaction" && action.phase === "sum") {
        assert.ok(["factor-a", "factor-b", "between"].every((key) => labelled.includes(key)), `${width}: ${labelled}`);
      }
    }
    // Three fractions, two of them over copies of the one denominator, drawn as it is.
    await go(page, { stage: "compare", phase: "f" });
    const fraction = await page.evaluate(() => {
      const look = (rect) => {
        const style = getComputedStyle(rect);
        return [style.fill, style.fillOpacity, style.stroke, style.strokeWidth, style.strokeDasharray,
          rect.getAttribute("width"), rect.getAttribute("height")].join("|");
      };
      const within = Array.from(document.querySelectorAll("g.ave-ms-item"))
        .find((g) => d3.select(g).datum().key === "within").querySelector("rect");
      const copies = Array.from(document.querySelectorAll("rect.ave-denominator-copy"));
      return {
        bars: document.querySelectorAll("line.ave-factor-bar").length,
        copies: copies.length,
        alike: copies.every((copy) => look(copy) === look(within))
      };
    });
    assert.deepEqual(fraction, { bars: 3, copies: 2, alike: true });
    assert.deepEqual(errors, []);
    await page.close();
  }
});

// Where each lane's prediction marker stands, in the scores' units, read off the axis.
// d3 draws its ticks half a pixel along, so this is good to about a tenth of a second.
const AXIS_SLACK = 0.2;
const markers = (page) => page.evaluate(() => {
  const ticks = Array.from(document.querySelectorAll(".ave-axis .tick")).map((tick) => ({
    value: d3.select(tick).datum(),
    x: Number(/translate\(([-\d.]+)/.exec(tick.getAttribute("transform"))[1])
  }));
  const [a, b] = [ticks[0], ticks[ticks.length - 1]];
  const value = (x) => a.value + (x - a.x) * (b.value - a.value) / (b.x - a.x);
  return Array.from(document.querySelectorAll("g.ave-prediction"))
    .map((g) => value(Number(/translate\(([-\d.]+)/.exec(g.getAttribute("transform"))[1])));
});
const hopCount = (page) => page.evaluate(() => document.querySelectorAll("g.ave-hop").length);

test("each prediction is built from the grand mean, one factor at a time", async () => {
  for (const width of WIDTHS) {
    const { page, errors } = await mount(options, width);
    const s = await statistics(page);
    const levelMean = (f, cell) => s.levelStats[f].levelMeans[options.groups[cell].levels[f]];
    const cells = options.groups.map((group, i) => i);

    // Before the first hop: the scores in their lanes and the grand mean, nothing else.
    await go(page, { stage: "interaction", phase: "predict-start" });
    assert.equal((await markers(page)).length, 0);
    assert.equal(await hopCount(page), 0);
    assert.deepEqual(await page.evaluate(() => ({
      lanes: document.querySelectorAll("line.ave-lane").length,
      grand: document.querySelectorAll("g.ave-grand-mean").length,
      means: document.querySelectorAll("g.ave-group-mean").length,
      ghosts: document.querySelectorAll("circle.anova-ghost").length
    })), { lanes: 4, grand: 1, means: 0, ghosts: 0 });

    await go(page, { stage: "interaction", phase: "predict-a" });
    (await markers(page)).forEach((at, i) => near(at, levelMean(0, i), AXIS_SLACK));
    assert.equal(await hopCount(page), cells.length, `${width}: one hop per lane`);

    await go(page, { stage: "interaction", phase: "predict-b" });
    (await markers(page)).forEach((at, i) => {
      near(at, s.grandMean + (levelMean(0, i) - s.grandMean) + (levelMean(1, i) - s.grandMean), AXIS_SLACK);
      near(at, s.predicted[i], AXIS_SLACK);
    });
    assert.equal(await hopCount(page), cells.length * 2, `${width}: two hops per lane`);

    // The hops give way to the deviations, and the predictions stay where they landed.
    for (const phase of ["deviations", "sum"]) {
      await go(page, { stage: "interaction", phase });
      assert.equal(await hopCount(page), 0, `${width}: hops at ${phase}`);
      (await markers(page)).forEach((at, i) => near(at, s.predicted[i], AXIS_SLACK));
    }

    // Played with motion, a step taken mid-hop still ends in the right place.
    await page.evaluate(() => {
      const figure = window.__figure.anovaVariabilityExplorer;
      figure.applyTutorialAction({ stage: "factor-b", phase: "sum", animate: false });
      figure.applyTutorialAction({ stage: "interaction", phase: "predict-a" });
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__figure.anovaVariabilityExplorer.applyTutorialAction({ stage: "interaction", phase: "predict-b" }));
    await page.waitForTimeout(1600);
    (await markers(page)).forEach((at, i) => near(at, s.predicted[i], AXIS_SLACK));
    await page.evaluate(() => window.__figure.anovaVariabilityExplorer.applyTutorialAction({ stage: "interaction", phase: "predict-a" }));
    await page.waitForTimeout(700);
    (await markers(page)).forEach((at, i) => near(at, levelMean(0, i), AXIS_SLACK));
    assert.equal(await hopCount(page), cells.length);

    await go(page, { stage: "between", phase: "sum" });
    assert.equal((await markers(page)).length, 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
});

const phaseShown = (page) => page.evaluate(() => ({
  squares: Array.from(document.querySelectorAll("g.ave-ms-item")).filter((g) => getComputedStyle(g).opacity === "1").length,
  bars: Array.from(document.querySelectorAll("line.ave-factor-bar")).filter((bar) => getComputedStyle(bar).opacity === "1").length
}));

test("a step from the partition to F splits, then cuts, then draws the fractions", async () => {
  const { page, errors } = await mount(options, 620);
  const play = (action) => page.evaluate((a) => window.__figure.anovaVariabilityExplorer.applyTutorialAction(a), action);
  await go(page, { stage: "compare", phase: "partition" });
  await play({ stage: "compare", phase: "f" });
  // The split comes first: no mean squares and no bars yet.
  await page.waitForTimeout(900);
  assert.deepEqual(await phaseShown(page), { squares: 0, bars: 0 });
  await page.waitForTimeout(6000);
  assert.deepEqual(await phaseShown(page), { squares: 4, bars: 3 });

  // Interrupted during the split, the step still ends at F, or wherever the reader went.
  await go(page, { stage: "compare", phase: "partition" });
  await play({ stage: "compare", phase: "f" });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__figure.anovaVariabilityExplorer.showCalculations(false));
  await page.waitForTimeout(40);
  assert.deepEqual(await phaseShown(page), { squares: 4, bars: 3 });
  await go(page, { stage: "compare", phase: "partition" });
  await play({ stage: "compare", phase: "f" });
  await page.waitForTimeout(300);
  await go(page, { stage: "interaction", phase: "sum" });
  await page.waitForTimeout(1500);
  assert.equal(await laneCount(page), 4);
  assert.deepEqual(await phaseShown(page), { squares: 0, bars: 0 });
  assert.deepEqual(errors, []);
  await page.close();
});

test("nothing is drawn past the figure's sides", async () => {
  for (const width of WIDTHS) {
    const { page } = await mount(options, width);
    for (const { action } of steps) {
      await go(page, action);
      await page.waitForTimeout(30);
      const outside = await page.evaluate(() => {
        const svg = document.querySelector("svg.ave-svg");
        const box = svg.getBoundingClientRect();
        return Array.from(svg.querySelectorAll("text, rect, line, circle"))
          .filter((el) => getComputedStyle(el).opacity !== "0" && el.getBoundingClientRect().width > 0)
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.left < box.left - 1 || r.right > box.right + 1).length;
      });
      assert.equal(outside, 0, `${width}: ${outside} shapes outside at ${JSON.stringify(action)}`);
    }
    await page.close();
  }
});

test("a design that isn't two crossed factors with equal cells is refused", async () => {
  const { page } = await mount(options, 620);
  const attempt = (bad) => page.evaluate((bad) => {
    try {
      window.makeAnovaVariabilityExplorer(bad);
      return "built";
    } catch (error) {
      return "refused";
    }
  }, bad);
  const unequal = structuredClone(options);
  unequal.groups[0].values = unequal.groups[0].values.slice(1);
  assert.equal(await attempt(unequal), "refused");
  const missingCell = structuredClone(options);
  missingCell.groups[3].levels = [0, 0];
  assert.equal(await attempt(missingCell), "refused");
  const oneFactor = { ...structuredClone(options), factors: [options.factors[0]] };
  assert.equal(await attempt(oneFactor), "refused");
  await page.close();
});
