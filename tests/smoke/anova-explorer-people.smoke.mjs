// The ANOVA explorer's people mode (Chapter 15). Mounts the figure from resources/
// with the options and steps in 15-related-samples-anova.qmd, so it needs no render
// and ignores prose. Not part of `npm test`, which runs without a browser.

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

const div = divById(readChapter("15-related-samples-anova.qmd"), "act-related-partition");
const options = JSON.parse(/makeAnovaVariabilityExplorer options='([^']+)'/.exec(div)[1]);
const steps = tutorialSteps(div);

// Chapter 13's five children, a two-condition mount needing options only.
const fiveChildren = {
  people: ["Violet", "Anna", "Willie", "Bessie", "Howard"],
  groups: [
    { name: "Alone", values: [54, 67, 38, 46, 42] },
    { name: "Competition", values: [43, 57, 39, 41, 36] }
  ],
  xMin: 30,
  xMax: 72
};

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
  const { observations, ...rest } = window.__figure.anovaVariabilityExplorer.getStatistics();
  return rest;
});

test("the partition matches the worked example", async () => {
  const { page } = await mount(options, 620);
  const s = await statistics(page);
  near(s.ssPeople, 636.44);
  near(s.ssError, 47.22);
  near(s.ssPeople + s.ssError, s.ssWithin, 1e-9);
  assert.equal(s.dfError, 10);
  near(s.msError, 4.72);
  near(s.fRelated, 18.72);
  near(s.f, 1.94);
  await page.close();
});

test("two conditions recover Chapter 13's t, with options alone", async () => {
  const { page, errors } = await mount(fiveChildren, 620);
  const s = await statistics(page);
  near(s.ssPeople, 746.6);
  near(s.ssError, 45.4);
  assert.equal(s.dfError, 4);
  near(s.fRelated, 8.47);
  for (const { action } of steps) await go(page, action);
  assert.deepEqual(errors, []);
  await page.close();
});

test("scores keep their owners, whatever order they arrive in", async () => {
  const { page } = await mount(options, 620);
  await go(page, { stage: "people", phase: "rows" });
  const rows = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll("circle.ave-dot").forEach((dot) => {
      const d = dot.__data__;
      (out[d.index] ||= []).push({ condition: d.groupIndex, value: d.value, cy: Number(dot.getAttribute("cy")) });
    });
    return out;
  });
  options.people.forEach((name, i) => {
    assert.deepEqual(rows[i].map((d) => d.value), options.groups.map((group) => group.values[i]), name);
    assert.ok(Math.max(...rows[i].map((d) => d.cy)) - Math.min(...rows[i].map((d) => d.cy)) < 20, `${name} shares a row`);
  });
  await page.close();
});

for (const width of WIDTHS) {
  test(`at ${width}px nothing fades out and reappears, and only between and error are cut`, async () => {
    const { page, errors } = await mount(options, width);
    await page.evaluate(() => {
      window.__dots = Array.from(document.querySelectorAll("circle.ave-dot"));
      window.__fills = window.__dots.map((dot) => dot.getAttribute("fill"));
    });
    for (const { action } of steps) {
      await go(page, action);
      const check = await page.evaluate(() => {
        const dots = Array.from(document.querySelectorAll("circle.ave-dot"));
        const box = document.querySelector("svg.ave-svg").viewBox.baseVal;
        const within = (element) => {
          const svg = document.querySelector("svg.ave-svg").getBoundingClientRect();
          const r = element.getBoundingClientRect();
          return r.left >= svg.left - 1 && r.right <= svg.right + 1 && r.top >= svg.top - 1 && r.bottom <= svg.bottom + 1;
        };
        return {
          sameNodes: dots.length === window.__dots.length && dots.every((dot, i) => dot === window.__dots[i]),
          visible: dots.every((dot) => dot.style.opacity === "" || Number(dot.style.opacity) >= 0.4),
          width: box.width,
          clipped: Array.from(document.querySelectorAll(".ave-label text, .ave-ms-item rect"))
            .filter((element) => element.textContent !== "" || element.tagName === "rect")
            .filter((element) => !within(element)).map((element) => element.textContent || element.tagName)
        };
      });
      assert.ok(check.sameNodes, `dots replaced at ${JSON.stringify(action)}`);
      assert.ok(check.visible || action.stage === "centre", `a dot hidden at ${JSON.stringify(action)}`);
      assert.deepEqual(check.clipped, [], `clipped at ${JSON.stringify(action)}`);
    }

    const last = await page.evaluate(() => ({
      ms: Array.from(document.querySelectorAll("g.ave-ms-item")).map((g) => g.__data__.key).sort(),
      layers: Array.from(document.querySelectorAll("g.ave-ss-item")).map((g) => ({
        key: g.__data__.key,
        fade: Number(g.querySelector("rect").style.opacity || 1)
      }))
    }));
    assert.deepEqual(last.ms, ["between", "within"]);
    assert.equal(last.layers.find((d) => d.key === "people").fade, 1);
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test("colour marks the grouping in use, and the recolour moves nothing", async () => {
  const { page } = await mount(options, 620);
  const dots = () => page.evaluate(() => Array.from(document.querySelectorAll("circle.ave-dot")).map((dot) => ({
    person: dot.__data__.index,
    condition: dot.__data__.groupIndex,
    fill: dot.getAttribute("fill"),
    cx: Number(dot.getAttribute("cx")),
    cy: Number(dot.getAttribute("cy"))
  })));
  const groupsOf = (list, key) => [...new Set(list.map((d) => d[key]))]
    .map((value) => new Set(list.filter((d) => d[key] === value).map((d) => d.fill)).size);

  await go(page, { stage: "within", phase: "observe" });
  const lanes = await dots();
  assert.ok(groupsOf(lanes, "condition").every((count) => count === 1), "one colour per condition");

  await go(page, { stage: "people", phase: "recolour" });
  const recoloured = await dots();
  recoloured.forEach((d, i) => assert.deepEqual([d.cx, d.cy], [lanes[i].cx, lanes[i].cy]));
  assert.ok(groupsOf(recoloured, "person").every((count) => count === 1), "one colour per person");
  assert.equal(new Set(recoloured.map((d) => d.fill)).size, options.people.length);

  await go(page, { stage: "people", phase: "rows" });
  assert.deepEqual((await dots()).map((d) => d.fill), recoloured.map((d) => d.fill));

  await go(page, { stage: "between", phase: "observe" });
  assert.deepEqual((await dots()).map((d) => d.fill), lanes.map((d) => d.fill));
  await page.close();
});

test("scores stay on their real values; only ghosts stand in for them", async () => {
  const { page } = await mount(options, 620);
  const read = () => page.evaluate(() => ({
    dots: Array.from(document.querySelectorAll("circle.ave-dot")).map((dot) => ({
      value: dot.__data__.value,
      cx: Number(dot.getAttribute("cx")),
      faded: dot.style.opacity !== "" && Number(dot.style.opacity) < 1,
      hidden: dot.style.opacity === "0"
    })),
    ghosts: document.querySelectorAll("circle.anova-ghost").length
  }));
  await go(page, { stage: "within", phase: "observe" });
  const home = new Map((await read()).dots.map((d) => [d.value, d.cx]));
  for (const { action } of steps) {
    await go(page, action);
    const { dots, ghosts } = await read();
    dots.forEach((d) => near(d.cx, home.get(d.value), 1e-6));
    const standing = action.stage === "between" || action.stage === "centre" ||
      (action.stage === "people" && !["recolour", "rows"].includes(action.phase));
    assert.equal(ghosts, standing ? dots.length : 0, JSON.stringify(action));
    assert.ok(dots.every((d) => d.faded === standing), JSON.stringify(action));
    assert.ok(dots.every((d) => d.hidden === (action.stage === "centre")), `real scores at ${JSON.stringify(action)}`);
  }
  await page.close();
});

test("centring happens in the rows, carrying each person's mean to the grand mean", async () => {
  const { page } = await mount(options, 620);
  await go(page, { stage: "centre", phase: "shift" });
  const state = await page.evaluate(() => {
    const figure = window.__figure.anovaVariabilityExplorer.getStatistics();
    const ghosts = Array.from(document.querySelectorAll("circle.anova-ghost")).map((ghost) => ({
      cx: Number(ghost.getAttribute("cx")),
      cy: Number(ghost.getAttribute("cy")),
      owner: ghost.__data__.key
    }));
    return {
      grand: figure.grandMean,
      ticks: Array.from(document.querySelectorAll("g.ave-group-mean line")).map((line) => Number(line.getAttribute("x1"))),
      ghosts,
      rows: Array.from(document.querySelectorAll("text.ave-group-label")).map((text) => text.textContent),
      squares: document.querySelectorAll("g.anova-dev-group").length
    };
  });
  assert.equal(state.ticks.length, options.people.length);
  assert.equal(new Set(state.ticks.map((t) => t.toFixed(3))).size, 1, "every mean on the grand mean");
  assert.equal(state.ghosts.length, 18);
  assert.equal(state.squares, 0, "no person's square survives");
  assert.deepEqual(state.rows, options.people);
  await page.close();
});

test("error stays unnamed until its squares have filled the slot", async () => {
  const { page } = await mount(options, 620);
  const names = () => page.evaluate(() =>
    Array.from(document.querySelectorAll("g.ave-label")).map((g) => g.__data__.key).sort());
  const unnamed = ["between", "people", "total"];
  for (const phase of ["sum"]) {
    await go(page, { stage: "people", phase });
    assert.deepEqual(await names(), unnamed);
  }
  for (const phase of ["shift", "lanes", "squares"]) {
    await go(page, { stage: "centre", phase });
    assert.deepEqual(await names(), unnamed, phase);
  }
  await go(page, { stage: "centre", phase: "sum" });
  assert.deepEqual(await names(), ["between", "people", "total", "within"]);
  await page.close();
});

test("both sums are cut at once, and F's bar waits for them", async () => {
  const { page } = await mount(options, 620);
  await go(page, { stage: "compare", phase: "split" });
  const view = () => page.evaluate(() => ({
    pieces: document.querySelectorAll(".ave-transfer-layer rect").length,
    bar: Number(document.querySelector(".ave-fraction line").style.opacity || 0),
    ms: document.querySelectorAll("g.ave-ms-item").length
  }));
  await page.evaluate(() => window.__figure.anovaVariabilityExplorer.applyTutorialAction({ stage: "compare", phase: "f", animate: true }));
  await page.waitForTimeout(900);
  const during = await view();
  assert.equal(during.pieces, 12, "two pieces of between and ten of error");
  assert.equal(during.bar, 0);
  await page.waitForTimeout(4000);
  const landed = await view();
  assert.equal(landed.pieces, 0);
  assert.equal(landed.ms, 2);
  assert.equal(landed.bar, 1);
  await page.close();
});

test("the people layer sits at the bottom of within, and areas add up", async () => {
  const { page } = await mount(options, 620);
  await go(page, { stage: "centre", phase: "sum" });
  const layer = await page.evaluate(() => Object.fromEntries(
    Array.from(document.querySelectorAll("g.ave-ss-item")).map((g) => {
      const rect = g.querySelector("rect");
      return [g.__data__.key, { y: Number(rect.getAttribute("y")), height: Number(rect.getAttribute("height")) }];
    })));
  const s = await statistics(page);
  near(layer.people.height / layer.total.height, s.ssPeople / s.ssTotal, 1e-6);
  near(layer.within.height / layer.total.height, s.ssError / s.ssTotal, 1e-6);
  near(layer.people.y, layer.within.y + layer.within.height, 1e-6);
  near(layer.within.y, layer.between.y + layer.between.height, 1e-6);
  await page.close();
});

test("people must be a complete set of matched scores", async () => {
  const page = await browser.newPage();
  await page.goto(origin);
  const message = await page.evaluate(() => {
    try {
      window.makeAnovaVariabilityExplorer({ people: true, groups: [{ values: [1, 2, 3] }, { values: [1, 2] }] });
      return "";
    } catch (error) {
      return error.message;
    }
  });
  assert.match(message, /one score per person/);
  await page.close();
});
