import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { divById, readChapter, tutorialSteps } from '../helpers/qmd.mjs';

const activity = divById(readChapter('17-correlation.qmd'), 'act-products-table');
const options = JSON.parse(/makeStepTable options='([^']+)'/.exec(activity)[1]);
const actions = tutorialSteps(activity).map(step => step.action);
const MINUS = '−';
const value = text => Number(String(text).replace(MINUS, '-'));
const productColumn = options.columns.findIndex(c => c.op === 'multiply');
const productsStep = actions.findIndex(a => a.stage === 'products');

// Loads the table outside a book page. The tutorial runtime is stubbed so the
// test can drive the steps itself.
const mount = async (reducedMotion, extra = {}) => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ reducedMotion });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setContent('<div class="callout"><div id="host"></div><div class="callout-footer"><div class="tutorial-step"></div></div></div>');
  for (const script of ['d3.min', 'interactive-figure', 'variability-table-generator']) {
    await page.addScriptTag({ path: new URL('../../resources/js/' + script + '.js', import.meta.url).pathname });
  }
  await page.evaluate(opts => {
    window.interactiveFigure.createTutorial = args => { window.stepTable = args.applyAction; };
    document.querySelector('#host').appendChild(makeStepTable(opts));
  }, { ...options, ...extra });
  await page.waitForFunction(() => typeof window.stepTable === 'function');
  const step = action => page.evaluate(a => window.stepTable(a), action);
  const readout = () => page.locator('.step-table-readout').textContent();
  // The visible text at the foot of a column (its running total, while one is shown).
  const foot = col => page.locator('.vt-summary-row td').nth(col).evaluate(td =>
    [...td.querySelectorAll('.vt-summary-value')].filter(v => v.offsetParent && getComputedStyle(v).visibility === 'visible')
      .map(v => v.textContent).join(' '));
  const visibleProducts = () => page.locator('tbody tr:not(.vt-summary-row)').evaluateAll((rows, col) => rows.filter(row => {
    const target = row.children[col].querySelector('.vt-reveal-target');
    return target && target.classList.contains('is-visible');
  }).length, productColumn);
  return { browser, page, errors, step, readout, foot, visibleProducts };
};

test('the sum of products table works from the scores and their means', () => {
  const cols = options.columns;
  const x = cols[1].cells.map(value);
  const y = cols.find(c => c.label === 'Score').cells.map(value);
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  // The means at the foot of the score columns are the scores' means.
  assert.equal(value(cols[1].total), mean(x));
  assert.equal(value(cols.find(c => c.label === 'Score').total), mean(y));
  // Every calculated cell follows from the numbers it names, and the sums add up.
  const cellsOf = i => cols[i].cells.map(value);
  for (const column of cols.filter(c => c.from)) {
    const [a, b] = column.from;
    const first = cellsOf(a);
    const expected = column.op === 'square' ? first.map(v => v * v)
      : column.op === 'multiply' ? first.map((v, i) => v * cellsOf(b)[i])
      : first.map(v => v - value(cols[b.summary].total));
    assert.deepEqual(column.cells.map(value), expected.map(v => v + 0)); // + 0 turns −0 into 0
    if (column.op !== 'subtract' && column.total !== undefined) {
      assert.equal(value(column.total), expected.reduce((s, v) => s + v, 0));
    }
  }
  assert.equal(value(cols[productColumn].total), -30);
});

test('without motion, each step shows its numbers and, where asked for, the working for its first row', async () => {
  // Chapter 17 leaves the line out; the option is checked here with it turned on.
  const t = await mount('reduce', { readout: true, rowLabelColumn: 0 });
  try {
    await t.step(actions[0]);
    assert.equal(await t.readout(), '');
    await t.step(actions[productsStep]);
    assert.equal(await t.readout(), `A: ${MINUS}1 × 20 = ${MINUS}20`);
    assert.equal(await t.visibleProducts(), 7);
    // Adding up is shown at the foot of the column, not in the line.
    await t.step(actions[productsStep + 1]);
    assert.equal(await t.readout(), '');
    assert.match(await t.foot(productColumn), new RegExp(`SP\\s*=\\s*[-${MINUS}]30`));
    assert.deepEqual(t.errors, []);
  } finally {
    await t.browser.close();
  }
});

test('the products fill in a row at a time, the deviations glowing, and their total grows at the foot', async () => {
  const t = await mount('no-preference');
  try {
    await t.step({ ...actions[productsStep - 1], animate: false });
    await t.step(actions[productsStep]);
    await t.page.waitForTimeout(150);
    // Row A is being worked: its two deviations and its product's cell glow; the product is not in yet.
    assert.equal(await t.page.locator('tbody tr').first().locator('td.step-table-glow').count(), 3);
    assert.equal(await t.visibleProducts(), 0);
    assert.equal(await t.page.locator('.step-table-readout').count(), 0);
    // Then row B.
    await t.page.waitForFunction(() => document.querySelectorAll('tbody tr')[1].querySelector('td.step-table-glow'));
    assert.ok(await t.visibleProducts() >= 1);
    assert.ok(await t.visibleProducts() < 7);
    await t.page.waitForFunction(() => !document.querySelector('.step-table-glow'), null, { timeout: 8000 });
    assert.equal(await t.visibleProducts(), 7);

    // Adding up: the total at the foot starts at the first product and grows to SP.
    await t.step(actions[productsStep + 1]);
    await t.page.waitForTimeout(150);
    assert.match(await t.foot(productColumn), new RegExp(`SP\\s*=\\s*[-${MINUS}]20`));
    await t.page.waitForFunction(() => !document.querySelector('.step-table-glow'), null, { timeout: 8000 });
    assert.match(await t.foot(productColumn), new RegExp(`SP\\s*=\\s*[-${MINUS}]30`));

    // Going back mid-sequence leaves nothing glowing and no products shown.
    await t.step(actions[productsStep]);
    await t.step(actions[productsStep - 1]);
    assert.equal(await t.page.locator('.step-table-glow').count(), 0);
    assert.equal(await t.visibleProducts(), 0);
    assert.deepEqual(t.errors, []);
  } finally {
    await t.browser.close();
  }
});
