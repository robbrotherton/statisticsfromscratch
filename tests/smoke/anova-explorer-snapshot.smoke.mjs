// Pins what Chapter 14's ANOVA explorer draws, so work on its people mode
// (Chapter 15) can't change the three mounts already published.
//
// Mounts each figure from resources/ with the options and tutorial steps in
// 14-anova.qmd, so it needs no render and ignores prose. At two widths, each
// step is recorded settled, settled with the calculations on, and frame by
// frame while animating on a fake clock. Only hashes are stored.
//
// After a deliberate change to Chapter 14's figures:
//
//   UPDATE_ANOVA_SNAPSHOT=1 npm run test:smoke
//
// Not part of `npm test`, which runs without a browser.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import { divById, readChapter, tutorialSteps } from "../helpers/qmd.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const BASELINE = fileURLToPath(new URL("./anova-explorer-snapshot.json", import.meta.url));
const SCRIPTS = ["d3.min", "interactive-figure", "anova-squares", "anova-variability-explorer"];
const WIDTHS = [{ name: "desktop", width: 620 }, { name: "phone", width: 340 }];
const MOUNTS = ["act-anova-viz", "act-anova-ms", "act-anova-viz-three"];
const FRAME_MS = 250;
const LONGEST_STEP_MS = 9000;

function mountConfig(id) {
  const div = divById(readChapter("14-anova.qmd"), id);
  const options = /makeAnovaVariabilityExplorer options='([^']+)'/.exec(div);
  assert.ok(options, `${id} has no explorer mount`);
  const steps = tutorialSteps(div);
  assert.ok(steps.length > 0, `${id} has no tutorial steps`);
  return { id, options: JSON.parse(options[1]), steps };
}

const hash = (text) => createHash("sha256").update(text).digest("hex").slice(0, 16);

// Everything drawn; attribute order, floating-point noise and empty groups aside.
const serializeInPage = `window.__drawn = function(root) {
  const round = (text) => text.replace(/-?\\d+\\.\\d+/g, (n) => {
    const fixed = Number(n).toFixed(2);
    return fixed === "-0.00" ? "0.00" : fixed;
  });
  const walk = (node) => {
    if (node.nodeType === 3) return round(node.textContent);
    if (node.nodeType !== 1) return "";
    // An empty group draws nothing, wherever it sits.
    if (node.tagName === "g" && !node.hasChildNodes()) return "";
    const attrs = Array.from(node.attributes)
      .map((a) => a.name + "=" + round(a.value)).sort().join(" ");
    return "<" + node.tagName + " " + attrs + ">" + Array.from(node.childNodes).map(walk).join("") + "</>";
  };
  return walk(root);
};`;

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

async function mountFigure(options, width, useClock) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (useClock) await page.clock.install({ time: 1000000 });
  await page.goto(origin);
  // Installed, the clock still runs on its own; only a paused one is deterministic.
  if (useClock) await page.clock.pauseAt(1100000);
  await page.addScriptTag({ content: serializeInPage });
  await page.evaluate(({ options, width }) => {
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    const host = document.getElementById("host");
    host.style.width = `${width}px`;
    window.__figure = window.makeAnovaVariabilityExplorer({ ...options, controlsPlacement: "none" });
    host.appendChild(window.__figure);
  }, { options, width });
  // The responsive observer draws at the real width. It may wait on a frame, so a
  // paused clock has to be walked forward while we watch for it.
  const drawnAt = () => page.evaluate(() =>
    Number(document.querySelector("#host svg.ave-svg")?.getAttribute("viewBox")?.split(" ")[2]));
  for (let tries = 0; (await drawnAt()) !== Math.round(width); tries += 1) {
    assert.ok(tries < 200, `figure never drew at ${width}px`);
    if (useClock) await page.clock.runFor(50);
    else await page.waitForTimeout(25);
  }
  if (useClock) await page.clock.runFor(1000);
  return { page, errors };
}

const drawn = (page) => page.evaluate(() => window.__drawn(document.getElementById("host")));

// d3 transitions start on the next tick even at zero duration.
async function settle(page, useClock) {
  if (useClock) await page.clock.runFor(LONGEST_STEP_MS);
  else await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 40)));
}

async function record(config, width) {
  const result = {};

  for (const calculations of [false, true]) {
    const { page, errors } = await mountFigure(config.options, width, false);
    if (calculations) await page.evaluate(() => window.__figure.anovaVariabilityExplorer.showCalculations(true));
    const label = calculations ? "calculations" : "settled";
    result[label] = [];
    for (const { action } of config.steps) {
      await page.evaluate((a) => window.__figure.anovaVariabilityExplorer.applyTutorialAction({ ...a, animate: false }), action);
      await settle(page, false);
      result[label].push(hash(await drawn(page)));
    }
    assert.deepEqual(errors, []);
    await page.close();
  }

  const { page, errors } = await mountFigure(config.options, width, true);
  result.frames = [];
  for (const { action } of config.steps) {
    await page.evaluate((a) => window.__figure.anovaVariabilityExplorer.applyTutorialAction(a), action);
    const frames = [];
    for (let t = 0; t < LONGEST_STEP_MS; t += FRAME_MS) {
      frames.push(await drawn(page));
      await page.clock.runFor(FRAME_MS);
    }
    frames.push(await drawn(page));
    result.frames.push(hash(frames.join("\n")));
  }
  assert.deepEqual(errors, []);
  await page.close();
  return result;
}

const update = Boolean(process.env.UPDATE_ANOVA_SNAPSHOT);
const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : {};

for (const id of MOUNTS) {
  for (const { name, width } of WIDTHS) {
    test(`${id} at ${name} width draws what it did`, { timeout: 600000 }, async () => {
      const config = mountConfig(id);
      const got = await record(config, width);
      const key = `${id} ${name}`;
      if (update) {
        baseline[key] = got;
        writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 1)}\n`);
        return;
      }
      assert.ok(baseline[key], `no baseline for ${key}; run with UPDATE_ANOVA_SNAPSHOT=1`);
      for (const pass of Object.keys(got)) {
        got[pass].forEach((value, step) => {
          assert.equal(value, baseline[key][pass][step],
            `${key}: ${pass}, step ${step + 1} of ${got[pass].length} (${config.steps[step].title}) changed`);
        });
      }
    });
  }
}
