import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { divById, readChapter, tutorialSteps } from "../helpers/qmd.mjs";

const tutorial = divById(readChapter("03-central-tendency.qmd"), "act-mean-balance");
const options = JSON.parse(/makeMeanBalanceBeam options='([^']+)'/.exec(tutorial)[1]);
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

for (const touch of [false, true]) {
  test(`the final balance step supports ${touch ? "touch" : "mouse"} pivot and block dragging`, async () => {
    const page = await browser.newPage({
      viewport: { width: touch ? 390 : 1000, height: 900 },
      hasTouch: touch,
      reducedMotion: "reduce"
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="host"></div>');
      for (const script of ["d3.min", "interactive-figure", "mean-balance-beam"]) {
        await page.addScriptTag({ path: fileURLToPath(new URL(`../../resources/js/${script}.js`, import.meta.url)) });
      }
      await page.evaluate(({ options, steps }) => {
        window.figure = makeMeanBalanceBeam(options);
        document.getElementById("host").appendChild(window.figure);
        for (const { action } of steps) {
          window.figure.meanBalanceBeam.applyTutorialAction({ ...action, animate: false });
        }
      }, { options, steps: tutorialSteps(tutorial) });

      const client = touch ? await page.context().newCDPSession(page) : null;
      async function drag(selector, dx) {
        const bounds = await page.locator(selector).first().boundingBox();
        const x = bounds.x + bounds.width / 2;
        const y = bounds.y + bounds.height * 0.65;
        if (touch) {
          await client.send("Input.dispatchTouchEvent", {
            type: "touchStart", touchPoints: [{ x, y, id: 1 }]
          });
          for (let i = 1; i <= 5; i++) {
            await client.send("Input.dispatchTouchEvent", {
              type: "touchMove", touchPoints: [{ x: x + dx * i / 5, y, id: 1 }]
            });
          }
          await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } else {
          await page.mouse.move(x, y);
          await page.mouse.down();
          await page.mouse.move(x + dx, y, { steps: 5 });
          await page.mouse.up();
        }
      }

      const initialPivot = await page.evaluate(() => window.figure.value.pivot);
      await drag(".mbb-pivot polygon", 60);
      const movedPivot = await page.evaluate(() => window.figure.value.pivot);
      assert.ok(movedPivot > initialPivot + 0.5, `pivot moved from ${initialPivot} to ${movedPivot}`);
      assert.equal(await page.locator(".mbb-pivot").evaluate((el) => el.classList.contains("is-dragging")), false);

      // Start level so the block's horizontal coordinates are easy to verify.
      await page.evaluate(() => window.figure.meanBalanceBeam.setPivot("mean"));
      const before = await page.evaluate(() => window.figure.value.positions);
      await drag(".mbb-box-shape", 60);
      const after = await page.evaluate(() => window.figure.value.positions);
      assert.equal(after.length, before.length, "dragging must not remove a block");
      assert.ok(after[0] > before[0], `block moved from ${before[0]} to ${after[0]}`);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  });
}
