// Browser smoke test for the rendered book in docs/.
//
// Loads every page at a desktop and a phone width and checks that nothing
// threw, that every interactive figure a reader can see has mounted without
// error, and that the page does not scroll sideways. It tests whatever was
// last rendered, so render first:
//
//   quarto render --profile public && npm run test:smoke
//
// Not part of `npm test`, which runs without a render or a browser.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const DOCS = fileURLToPath(new URL("../../docs/", import.meta.url));
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "phone", width: 390, height: 844 }
];
const MOUNT_TIMEOUT_MS = 15000;

// Noise from the local server rather than the book.
const IGNORED_CONSOLE = [
  /cloudflareinsights/i,
  /GPU stall/i,
  /favicon\.ico/i
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".xml": "application/xml",
  ".txt": "text/plain"
};

if (!existsSync(join(DOCS, "index.html"))) {
  throw new Error("docs/ has no rendered book. Run `quarto render --profile public` first.");
}

const pages = readdirSync(DOCS).filter((name) => name.endsWith(".html")).sort();

let server;
let origin;
let browser;

before(async () => {
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let file = normalize(join(DOCS, path));
    if (!file.startsWith(DOCS)) {
      response.writeHead(403).end();
      return;
    }
    if (path.endsWith("/")) file = join(file, "index.html");
    if (!existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    response.end(readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

for (const viewport of VIEWPORTS) {
  for (const pageName of pages) {
    test(`${pageName} at ${viewport.name} width`, async () => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce"
      });
      const page = await context.newPage();
      const problems = [];

      page.on("pageerror", (error) => problems.push(`uncaught: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (IGNORED_CONSOLE.some((pattern) => pattern.test(text))) return;
        problems.push(`console: ${text}`);
      });
      page.on("response", (response) => {
        const url = response.url();
        if (response.status() >= 400 && url.startsWith(origin) && !/favicon\.ico/.test(url)) {
          problems.push(`HTTP ${response.status()}: ${url.slice(origin.length)}`);
        }
      });

      try {
        await page.goto(`${origin}/${pageName}`, { waitUntil: "load" });

        // Figures inside [hidden] (quiz answers, collapsed content) are not
        // mounted until revealed, so only visible-tree mounts must be ready.
        const pending = () => page.evaluate(() =>
          Array.from(document.querySelectorAll(".interactive-figure-mount"))
            .filter((mount) => !mount.closest("[hidden]"))
            .filter((mount) => !mount.classList.contains("is-mounted") ||
              mount.classList.contains("has-interactive-error") ||
              mount.dataset.interactiveReadiness === "error")
            .map((mount) => `${mount.dataset.interactiveFigure} (${mount.dataset.interactiveFactory})`)
        );
        let stuck = await pending();
        const deadline = Date.now() + MOUNT_TIMEOUT_MS;
        while (stuck.length && Date.now() < deadline) {
          await page.waitForTimeout(250);
          stuck = await pending();
        }
        for (const id of stuck) problems.push(`figure not mounted or failed: ${id}`);

        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        if (overflow > 1) problems.push(`page scrolls sideways by ${overflow}px`);
      } finally {
        await context.close();
      }

      assert.deepEqual(problems, []);
    });
  }
}

// Verify the shared t-statistic grammar, including interrupted SD-to-SE
// transitions. A static page load cannot detect stale animation callbacks.
for (const viewport of VIEWPORTS) {
  for (const [chapter, id] of [
    ["11-t-test", "act-class-rt-rows"],
    ["12-independent-samples-t-test", "act-spending-rows"],
    ["13-related-samples-t-test", "act-triplett-pairs"]
  ]) {
    test(`${id} restores its geometry after interruption at ${viewport.name} width`, async () => {
      const page = await browser.newPage({ viewport });
      try {
        await page.goto(`${origin}/${chapter}.html`);
        const figure = page.locator(`#${id} .sfs-score-rows`);
        // Public builds omit draft tutorials.
        if (!await page.locator(`#${id}`).count()) return;
        await figure.waitFor();
        const actions = await page.locator(`#${id} .tutorial-step`).evaluateAll(
          (steps) => steps.map((step) => JSON.parse(step.dataset.action))
        );
        const apply = (action) => figure.evaluate((root, next) => root.scoreRows.applyTutorialAction(next), action);
        const geometry = () => figure.evaluate((root) => {
          const line = root.querySelector(".sr-den .sfs-span-line");
          return {
            coordinates: ["x1", "x2", "y1"].map((attr) => +line.getAttribute(attr)),
            opacity: +getComputedStyle(line.parentNode).opacity,
            count: root.querySelectorAll(".sr-den").length,
            height: root.getBoundingClientRect().height
          };
        });
        // Color changes preserve observations and positions. Revisiting the
        // opening step restores identity colors; paired rows retain identity.
        const dots = () => figure.locator(".sr-dots circle").evaluateAll((nodes) =>
          nodes.map((node) => ({
            key: node.__data__.key,
            group: node.__data__.groupIndex,
            person: node.__data__.index,
            color: getComputedStyle(node).fill,
            x: +node.getAttribute("cx"),
            y: +node.getAttribute("cy")
          })).sort((a, b) => a.key.localeCompare(b.key))
        );
        await apply({ ...actions[0], animate: false });
        await page.waitForTimeout(30);
        const individuals = await dots();
        assert.ok(new Set(individuals.map((dot) => dot.color)).size > 1);
        await apply(actions[1]);
        // Inspect animation frames as well as the final state: interpolating
        // a CSS variable as a D3 color can introduce a black intermediate fill.
        const unexpectedColors = await figure.evaluate(async (root, initial) => {
          const original = new Map(initial.map((dot) => [dot.key, dot.color]));
          const groupColors = [...root.querySelectorAll(".sr-lanes .sr-row-label")]
            .map((label) => getComputedStyle(label).fill);
          const unexpected = new Set();
          const deadline = performance.now() + 500;
          do {
            await new Promise(requestAnimationFrame);
            for (const node of root.querySelectorAll(".sr-dots circle")) {
              const color = getComputedStyle(node).fill;
              const datum = node.__data__;
              if (color !== original.get(datum.key) && color !== groupColors[datum.groupIndex]) {
                unexpected.add(color);
              }
            }
          } while (performance.now() < deadline);
          return [...unexpected];
        }, individuals);
        assert.deepEqual(unexpectedColors, []);
        const summarized = await dots();
        assert.deepEqual(summarized.map(({ key, x, y }) => ({ key, x, y })),
          individuals.map(({ key, x, y }) => ({ key, x, y })));
        if (chapter === "13-related-samples-t-test") {
          assert.deepEqual(summarized, individuals);
          for (const dot of individuals.filter((dot) => dot.group === 0)) {
            assert.equal(dot.color, individuals.find((other) => other.group === 1 && other.person === dot.person).color);
          }
        } else {
          for (const group of new Set(summarized.map((dot) => dot.group))) {
            assert.equal(new Set(summarized.filter((dot) => dot.group === group).map((dot) => dot.color)).size, 1);
          }
          if (chapter === "12-independent-samples-t-test") {
            assert.equal(new Set(individuals.map((dot) => dot.color)).size, individuals.length);
          }
        }
        await apply(actions[0]);
        await page.waitForTimeout(500);
        assert.deepEqual(await dots(), individuals);
        const final = actions.at(-1);
        const se = actions.find((action) => action.spread === "se");
        await apply({ ...actions[0], animate: false });
        await page.waitForTimeout(30);
        await apply(se);
        await page.waitForTimeout(250);
        await apply(final);
        await page.waitForTimeout(2100);
        const interrupted = await geometry();
        await apply({ ...final, animate: false });
        await page.waitForTimeout(30);
        const snapped = await geometry();
        for (let i = 0; i < snapped.coordinates.length; i++) {
          assert.ok(Math.abs(interrupted.coordinates[i] - snapped.coordinates[i]) < 0.1);
        }
        assert.equal(interrupted.opacity, 1);
        assert.equal(interrupted.count, 1);
        const gap = await figure.locator(".sr-gap .sfs-span-line").evaluate((line) =>
          Math.abs(+line.getAttribute("x2") - +line.getAttribute("x1"))
        );
        const expectedT = await figure.evaluate((root) => {
          const stats = root.scoreRows.getStatistics();
          if (stats.paired) return stats.meanDifference / (stats.sdDifference / Math.sqrt(stats.differences.length));
          if (stats.seMean !== null) return (stats.means[0] - 284) / stats.seMean;
          return (stats.means[1] - stats.means[0]) / stats.seDifference;
        });
        const denominator = Math.abs(snapped.coordinates[1] - snapped.coordinates[0]);
        assert.ok(Math.abs(gap / denominator - Math.abs(expectedT)) < 1e-8);
        if (expectedT < 0) assert.match(await figure.locator(".sr-gap text").textContent(), /−/);
        assert.match(await figure.locator("svg > title").textContent(), /t units/);
        await page.emulateMedia({ reducedMotion: "reduce" });
        for (const action of [...actions].reverse()) {
          await apply(action);
          await page.waitForTimeout(30);
          assert.equal(await figure.evaluate((root) => root.getBoundingClientRect().height), snapped.height);
          if (action === actions[0]) assert.deepEqual(await dots(), individuals);
          if (action === actions[1]) assert.deepEqual(await dots(), summarized);
          const clippedLabels = await figure.evaluate((root) => {
            const bounds = root.querySelector("svg").getBoundingClientRect();
            return [...root.querySelectorAll(".sr-axis-label, .sr-gap text")]
              .filter((label) => {
                const box = label.getBoundingClientRect();
                return box.left < bounds.left - 1 || box.right > bounds.right + 1;
              }).map((label) => label.textContent);
          });
          assert.deepEqual(clippedLabels, []);
          const capDimensions = await figure.evaluate((root) => {
            return [...root.querySelectorAll(".sfs-span-cap")].map((cap) => ({
              height: Math.abs(+cap.getAttribute("y2") - +cap.getAttribute("y1")),
              width: parseFloat(getComputedStyle(cap).strokeWidth),
              linecap: getComputedStyle(cap).strokeLinecap,
              expectedHeight: window.sfsSpanMarks.CAP_HEIGHT,
              expectedWidth: window.sfsSpanMarks.STROKE_WIDTH
            }));
          });
          for (const cap of capDimensions) {
            assert.equal(cap.height, cap.expectedHeight);
            assert.equal(cap.width, cap.expectedWidth);
            assert.equal(cap.linecap, "round");
          }
        }
      } finally {
        await page.close();
      }
    });
  }
}

// A page load cannot check that the two df controls are independent, that
// changing a slider cancels a tutorial tween, or that fixed F axes stay fixed.
for (const viewport of VIEWPORTS) {
  test(`F degrees-of-freedom tutorial at ${viewport.name} width`, async () => {
    const context = await browser.newContext({
      viewport, reducedMotion: viewport.name === "phone" ? "reduce" : "no-preference",
      colorScheme: viewport.name === "phone" ? "dark" : "light"
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.goto(`${origin}/14-anova.html#act-f-distribution-df`, { waitUntil: "load" });
      const activity = page.locator("#act-f-distribution-df");
      const root = activity.locator(".distribution-explorer");
      await root.waitFor();
      await activity.scrollIntoViewIfNeeded();
      const numerator = activity.getByRole("slider", { name: "Numerator degrees of freedom" });
      const denominator = activity.getByRole("slider", { name: "Denominator degrees of freedom" });
      await numerator.waitFor({ state: "visible" });
      const initial = await root.evaluate((node) => ({ ...node.value }));
      assert.equal(initial.df1, 1);
      assert.equal(initial.df2, 6);
      assert.ok(Math.abs(initial.critical - 5.9874) < 0.001);
      const initialHeight = await root.evaluate((node) => node.getBoundingClientRect().height);
      const referenceX = await activity.locator(".dpe-markers line").first().getAttribute("x1");

      // Start a tween, then immediately override it with a keyboard slider
      // action. The canceled tween must never overwrite the reader's input.
      await activity.locator(".sfs-if-tutorial-next").click();
      await denominator.focus();
      await denominator.press("Home");
      await numerator.focus();
      await numerator.press("End");
      await page.waitForTimeout(850);
      let state = await root.evaluate((node) => ({ ...node.value }));
      assert.equal(state.df1, 60);
      assert.equal(state.df2, 1);
      assert.ok(state.critical > state.domain[1]);
      assert.match(await activity.locator(".dpe-critical-readout").innerText(), /beyond view/);
      assert.deepEqual(state.domain, initial.domain);
      assert.deepEqual(state.yDomain, initial.yDomain);
      assert.equal(await activity.locator(".dpe-markers line").first().getAttribute("x1"), referenceX);
      assert.ok(Math.abs(await root.evaluate((node) => node.getBoundingClientRect().height) - initialHeight) < 1);

      // More df in both estimates gives the narrow hump; use the analytical
      // CDF to check the changing cutoff always retains its 5% upper tail.
      await denominator.focus();
      await denominator.press("End");
      const math = await root.evaluate((node) => ({
        ...node.value,
        upperTail: 1 - window.sfsStats.fCdf(node.value.critical, node.value.df1, node.value.df2),
        densityAtOne: window.sfsStats.fPdf(1, node.value.df1, node.value.df2)
      }));
      assert.equal(math.df1, 60);
      assert.equal(math.df2, 60);
      assert.ok(Math.abs(math.upperTail - 0.05) < 1e-6);
      assert.ok(math.densityAtOne > 1);
      assert.ok(await activity.locator(".dpe-curves").getAttribute("clip-path"));
      assert.ok(!/NaN|Infinity/.test(await activity.locator(".dpe-controlled-curve").getAttribute("d")));

      // Back restores the first tutorial's complete state after exploration.
      await activity.locator(".sfs-if-tutorial-prev").click();
      await page.waitForTimeout(850);
      state = await root.evaluate((node) => ({ ...node.value }));
      assert.equal(state.df1, 1);
      assert.equal(state.df2, 6);
      assert.match(await activity.locator("svg").getAttribute("aria-label"), /F\(1, 6\)/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  });
}
