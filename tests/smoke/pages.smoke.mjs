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
