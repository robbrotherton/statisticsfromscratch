import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

for (const width of [1280, 390]) {
  test(`Tukey table selection, keyboard input, tutorial actions and fixed highlights at ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    for (const name of ['stat-helpers', 'tukey-critical-values', 'critical-table-generator']) {
      await page.addScriptTag({ path: fileURLToPath(new URL(`../../resources/js/${name}.js`, import.meta.url)) });
    }
    await page.evaluate(() => {
      const opts = { k: { from: 2, to: 6 }, df: { from: 4, to: 10 }, selected: { k: 3, df: 8 }, tableMinWidth: '0', cellMinWidth: '0' };
      window.table = makeTukeyTable(opts);
      window.inputCount = 0;
      table.addEventListener('input', () => inputCount++);
      document.body.append(table, makeTukeyTable({ ...opts, interactive: false }));
    });
    assert.equal(await page.locator('button[aria-pressed="true"]').textContent(), '4.04');
    assert.equal(await page.locator('.critical-value-table-tukey').last().locator('td.cvt-selected').textContent(), '4.04');
    assert.equal(await page.locator('.critical-value-table-tukey').last().locator('button').count(), 0);
    const target = page.locator('button[data-cvt-key="tukey-3-9-0.05"]');
    await target.focus();
    await page.keyboard.press('Enter');
    assert.equal(await target.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => table.value.df), 9);
    assert.equal(await page.evaluate(() => inputCount), 1);
    const state = await page.evaluate(() => {
      table.criticalValueTable.applyTutorialAction({ k: 4, df: 10, animate: false });
      return { df: table.value.df, k: table.value.k, critical: table.value.critical, events: inputCount };
    });
    assert.equal(state.k, 4);
    assert.equal(state.df, 10);
    assert.equal(state.critical.toFixed(2), '4.33');
    assert.equal(state.events, 2);
    assert.equal(await page.evaluate(() => table.criticalValueTable.select({ k: 99 })), false);
    assert.equal(await page.evaluate(() => table.value.k), 4);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    await page.close();
  });
}
