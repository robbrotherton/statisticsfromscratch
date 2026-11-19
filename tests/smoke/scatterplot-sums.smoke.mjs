import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { divById, readChapter, tutorialSteps } from '../helpers/qmd.mjs';

const tutorial = divById(readChapter('17-correlation.qmd'), 'act-sum-of-products');
const options = JSON.parse(/makeScatterplot options='([^']+)'/.exec(tutorial)[1]);
const steps = tutorialSteps(tutorial);

test('coffee tutorial draws both sums of squares and clears them when navigating to products', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<div id="host"></div>');
    for (const script of ['d3.min', 'interactive-figure', 'scatterplot']) {
      await page.addScriptTag({ path: new URL(`../../resources/js/${script}.js`, import.meta.url).pathname });
    }
    await page.evaluate(options => {
      const wrap = window.interactiveFigure.wrap;
      window.interactiveFigure.wrap = opts => {
        window.applyStep = opts.applyAction;
        return wrap(opts);
      };
      document.querySelector('#host').appendChild(makeScatterplot({ ...options, responsive: false }));
    }, options);
    for (const title of ['$SS_X$', '$SS_Y$', 'Products', '$SS_X$', 'Scores']) {
      const step = steps.find(s => s.title === title);
      await page.evaluate(action => window.applyStep({ ...action, animate: false }), step.action);
      if (title.startsWith('$SS_')) {
        const squares = await page.locator('.sc-square').evaluateAll(nodes => nodes.map(n => ({
          w: +n.getAttribute('width'), h: +n.getAttribute('height')
        })));
        assert.equal(squares.length, 7);
        assert.deepEqual(await page.locator('.sc-square-label').allTextContents(),
          title === '$SS_X$' ? ['1', '0.25', '0.25', '0', '0.25', '0.25', '1'] : ['400', '100', '225', '25', '400', '25', '25']);
        for (const square of squares) assert.equal(square.w, square.h);
        const expected = title === '$SS_X$' ? [1, .25, .25, 0, .25, .25, 1] : [400, 100, 225, 25, 400, 25, 25];
        const scale = squares[0].w ** 2 / expected[0];
        squares.forEach((square, i) => assert.ok(Math.abs(square.w ** 2 / scale - expected[i]) < 1e-8));
        assert.equal(await page.locator('.sc-deviation').count(), 7);
        assert.match(await page.locator('.sc-annotation').textContent(), title === '$SS_X$' ? /SSX = 3/ : /SSY = 1200/);
      } else {
        assert.equal(await page.locator('.sc-squares-layer').evaluate(el => getComputedStyle(el).opacity), '0');
      }
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const title of ['$SS_X$', '$SS_Y$']) {
      const action = steps.find(s => s.title === title).action;
      await page.evaluate(action => window.applyStep({ ...action, duration: 400 }), action);
      // While the deviation is being drawn, the perpendicular dimension is zero.
      await page.waitForTimeout(200);
      const dimension = title === '$SS_X$' ? 'height' : 'width';
      assert.equal(await page.locator('.sc-square').first().getAttribute(dimension), '0');
      const lineLength = await page.locator('.sc-deviation').first().evaluate(el => Math.hypot(
        +el.getAttribute('x2') - +el.getAttribute('x1'),
        +el.getAttribute('y2') - +el.getAttribute('y1')));
      assert.ok(lineLength > 0, 'deviation line draws before the square grows');
      await page.waitForFunction(() => {
        const r = document.querySelector('.sc-square');
        return +r.getAttribute('width') > 0 && Math.abs(+r.getAttribute('width') - +r.getAttribute('height')) < 0.01;
      });
    }
    // A fast step change must cancel the old square's delayed growth.
    await page.evaluate(action => window.applyStep({ ...action, duration: 400 }), steps.find(s => s.title === '$SS_Y$').action);
    await page.evaluate(action => window.applyStep({ ...action, animate: false }), steps.find(s => s.title === '$SS_X$').action);
    const width = await page.locator('.sc-square').first().getAttribute('width');
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('.sc-square').first().getAttribute('width'), width);
    assert.equal(await page.locator('.sc-square').first().getAttribute('height'), width);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('tutorial titles send inline TeX to MathJax in the step rail and compact readout', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    await page.setContent('<div class="callout" style="width:1000px"><div class="callout-body-container"><div id="root"></div></div><div class="callout-footer"></div></div>');
    await page.addScriptTag({ path: new URL('../../resources/js/interactive-figure.js', import.meta.url).pathname });
    await page.evaluate(titles => {
      window.MathJax = { tex2chtmlPromise: async expression => {
        const math = document.createElement('mjx-container');
        math.dataset.expression = expression;
        math.textContent = expression;
        return math;
      } };
      const footer = document.querySelector('.callout-footer');
      const steps = titles.map(title => {
        const step = document.createElement('div');
        step.className = 'tutorial-step';
        step.dataset.title = title;
        step.textContent = 'Example step';
        footer.appendChild(step);
        return step;
      });
      window.tutorial = window.interactiveFigure.createTutorial({ root: document.querySelector('#root'), footer, steps });
    }, ['Scores', '$SS_X$', '$SS_Y$', '$SP$']);
    await page.waitForSelector('.sfs-if-stepper-label mjx-container', { state: 'attached' });
    assert.deepEqual(await page.locator('.sfs-if-stepper-label mjx-container').evaluateAll(nodes => nodes.map(n => n.dataset.expression)), ['SS_X', 'SS_Y', 'SP']);
    await page.evaluate(() => { document.querySelector('.callout').style.width = '350px'; });
    await page.setViewportSize({ width: 390, height: 900 });
    await page.evaluate(() => window.tutorial.setStep(1));
    await page.waitForSelector('.sfs-if-step-readout-title mjx-container', { state: 'attached' });
    assert.equal(await page.locator('.sfs-if-step-readout-title mjx-container').getAttribute('data-expression'), 'SS_X');
  } finally {
    await browser.close();
  }
});

test('regression draws, squares and collects all three deviations on one area scale', async () => {
  const activity = divById(readChapter('18-regression.qmd'), 'act-least-squares');
  const options = JSON.parse(/makeScatterplot options='([^']+)'/.exec(activity)[1]);
  const actions = new Map(tutorialSteps(activity).map(step => [step.title, step.action]));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="host"></div>');
    for (const script of ['d3.min', 'interactive-figure', 'anova-squares', 'scatterplot']) {
      await page.addScriptTag({ path: new URL('../../resources/js/' + script + '.js', import.meta.url).pathname });
    }
    await page.evaluate(opts => {
      const wrap = window.interactiveFigure.wrap;
      window.interactiveFigure.wrap = args => {
        window.stepRegression = args.applyAction;
        return wrap(args);
      };
      document.querySelector('#host').appendChild(makeScatterplot({ ...opts, responsive: false }));
    }, options);
    const step = title => page.evaluate(action => window.stepRegression(action), actions.get(title));
    const bin = page.locator('.sc-ss-collection');
    await step('Residuals');
    await page.waitForFunction(() => {
      const line = document.querySelector('.sc-residual');
      const square = document.querySelector('.sc-square');
      const length = Math.abs(line.y1.baseVal.value - line.y2.baseVal.value);
      return length > 0 && length < square.height.baseVal.value;
    });
    await step('Squares');
    await page.waitForFunction(() => {
      const r = document.querySelector('.sc-square');
      return r.width.baseVal.value > 0 && r.width.baseVal.value < r.height.baseVal.value;
    });
    await step('Sum of squares');
    await page.waitForFunction(() => document.querySelectorAll('.anova-transfer').length === 6);
    await page.waitForFunction(() => document.querySelector('[data-sum=residual]')?.textContent === 'Residual = 900');
    await step('What did the line explain?');
    await step('Best-fit line');
    assert.equal(await bin.locator('.anova-transfer').count(), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const geometry = rect => ({
      height: rect.height.baseVal.value, width: rect.width.baseVal.value, y: rect.y.baseVal.value
    });
    for (const [title, name, sum] of [
      ['A flat line?', 'total', 1200],
      ['Sum of squares', 'residual', 900],
      ['What did the line explain?', 'regression', 300]
    ]) {
      await step(title);
      assert.equal(await bin.locator('[data-sum=total]').textContent(), 'Total = 1200');
      assert.ok((await bin.locator('[data-sum=' + name + ']').textContent()).endsWith('= ' + sum));
      assert.equal(await bin.locator('.anova-transfer').count(), 0);
      const box = await bin.locator('.sc-ss-outline').evaluate(geometry);
      assert.ok(Math.abs(box.height - box.width) < 0.01);
      const band = await bin.locator('.sc-ss-' + name).evaluate(geometry);
      assert.ok(Math.abs(band.height / box.height - sum / 1200) < 0.001, name + " " + JSON.stringify({ box, band }));
      const area = await bin.locator('.sc-ss-' + name).evaluate(r => r.width.baseVal.value * r.height.baseVal.value);
      const sourceArea = await page.locator('.sc-squares-layer rect').evaluateAll(rs =>
        rs.reduce((sum, r) => sum + r.width.baseVal.value * r.height.baseVal.value, 0));
      assert.ok(Math.abs(area - sourceArea) < area * 1e-5);
    }
    assert.deepEqual(await page.locator('.sc-square-label').allTextContents(), ['100', '25', '25', '0', '25', '25', '100']);
    const regression = await bin.locator('.sc-ss-regression').evaluate(geometry);
    const residual = await bin.locator('.sc-ss-residual').evaluate(geometry);
    assert.ok(Math.abs(regression.y + regression.height - residual.y) < 0.01);
    assert.equal(await bin.locator('[data-sum=residual]').textContent(), 'Residual = 900');
    await step('Least error');
    assert.equal(await bin.count(), 0);
    assert.equal(await page.locator('.sc-prediction').count(), 0);
    await page.getByLabel('Intercept (a)').evaluate(input => {
      input.value = '75';
      input.dispatchEvent(new Event('input'));
    });
    assert.equal(await page.locator('.scatterplot').evaluate(el => el.value.ssResidual), 1075);
  } finally {
    await browser.close();
  }
});
