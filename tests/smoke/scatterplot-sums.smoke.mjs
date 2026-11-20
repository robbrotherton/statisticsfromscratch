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
    for (const script of ['d3.min', 'interactive-figure', 'read-guides', 'scatterplot']) {
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
    for (const script of ['d3.min', 'interactive-figure', 'anova-squares', 'read-guides', 'scatterplot']) {
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
    assert.equal(await page.locator('.sc-prediction').count(), 0);
    // The best fit's total stays outlined while the reader tries other lines.
    assert.equal(await bin.locator('[data-sum=best]').textContent(), 'Best fit = 900');
    assert.equal(await bin.locator('[data-sum=residual]').textContent(), 'Residual = 900');
    await page.getByLabel('Intercept (a)').evaluate(input => {
      input.value = '75';
      input.dispatchEvent(new Event('input'));
    });
    assert.equal(await page.locator('.scatterplot').evaluate(el => el.value.ssResidual), 1075);
    assert.equal(await bin.locator('[data-sum=residual]').textContent(), 'Residual = 1075');
    assert.equal(await bin.locator('[data-sum=best]').textContent(), 'Best fit = 900');
    const best = await bin.locator('.sc-ss-best').evaluate(geometry);
    const current = await bin.locator('.sc-ss-residual').evaluate(geometry);
    const outline = await bin.locator('.sc-ss-outline').evaluate(geometry);
    assert.ok(Math.abs(best.height / outline.height - 900 / 1200) < 0.001);
    assert.ok(Math.abs(current.height / outline.height - 1075 / 1200) < 0.001);
  } finally {
    await browser.close();
  }
});

test('adding sleep splits the coffee line into parallel lines and partitions what both predict', async () => {
  const activity = divById(readChapter('18-regression.qmd'), 'act-adding-sleep');
  const options = JSON.parse(/makeScatterplot options='([^']+)'/.exec(activity)[1]);
  const actions = new Map(tutorialSteps(activity).map(step => [step.title, step.action]));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // The figure has no controls drawer, so it claims its callout's tutorial itself.
    await page.setContent('<div class="callout"><div id="host"></div><div class="callout-footer"><div class="tutorial-step"></div></div></div>');
    for (const script of ['d3.min', 'interactive-figure', 'anova-squares', 'read-guides', 'scatterplot']) {
      await page.addScriptTag({ path: new URL('../../resources/js/' + script + '.js', import.meta.url).pathname });
    }
    await page.evaluate(opts => {
      window.interactiveFigure.createTutorial = args => { window.stepSleep = args.applyAction; };
      document.querySelector('#host').appendChild(makeScatterplot({ ...opts, responsive: false }));
    }, options);
    await page.waitForFunction(() => typeof window.stepSleep === 'function');
    const step = title => page.evaluate(action => window.stepSleep({ ...action, animate: false }), actions.get(title));
    const bin = page.locator('.sc-ss-collection');
    const value = () => page.locator('.scatterplot').evaluate(el => el.value);
    const height = name => bin.locator('.sc-ss-' + name).evaluate(r => r.height.baseVal.value);

    await step('Coffee alone');
    assert.equal(await bin.locator('[data-sum=residual]').textContent(), 'Residual = 900');
    await step('Sleep');
    assert.equal(await page.locator('.sc-family-level').count(), 5);
    assert.equal(await page.locator('.sc-family-line').count(), 0);
    // Coffee adjusted to average sleep, as dashed outlines; the line through
    // them, and through the means, has the two-predictor slope.
    await step('Coffee at average sleep');
    const ghostXs = await page.locator('.anova-ghost').evaluateAll(cs => cs.map(c => +c.getAttribute('cx')));
    const toPx = await page.locator('.sc-point').evaluateAll(gs => gs.map(g => +/translate\(([-\d.]+)/.exec(g.getAttribute('transform'))[1]));
    const pxPerCup = (toPx[6] - toPx[0]) / 2;
    assert.deepEqual(ghostXs.map(cx => Math.round((cx - toPx[0]) / pxPerCup * 6) / 6),
      [2 / 3, 5 / 6, 5 / 6, 1 / 3, 7 / 6, 7 / 6, 2].map(v => Math.round(v * 6) / 6));
    assert.deepEqual([(await value()).slope, (await value()).intercept].map(v => Math.round(v * 1e9) / 1e9), [-2, 72]);
    assert.equal(await page.locator('.sc-rise-label').first().textContent(), '\u22122');
    await step('A line for each amount of sleep');
    assert.equal(await page.locator('.sc-family-line').count(), 5);
    const fit = (await value()).multiple;
    assert.deepEqual([fit.slopeX, fit.slopeZ, fit.intercept].map(v => Math.round(v * 1e9) / 1e9), [-2, 6, 30]);
    // Parallel, and 6 points apart per hour of sleep.
    const slopes = await page.locator('.sc-family-line').evaluateAll(lines => lines.map(l =>
      (l.y2.baseVal.value - l.y1.baseVal.value) / (l.x2.baseVal.value - l.x1.baseVal.value)));
    slopes.forEach(slope => assert.ok(Math.abs(slope - slopes[0]) < 1e-5, JSON.stringify(slopes)));
    await page.waitForFunction(() => !document.querySelector('.anova-ghost'));
    assert.equal(await page.locator('.sc-spacing-layer .sc-rise-label').textContent(), '+6');

    // One student, then two, then everyone, each from their own line.
    const visible = selector => page.locator(selector).evaluateAll(nodes =>
      nodes.filter(n => n.style.display !== 'none').map(n => n.textContent));
    await step('One student');
    assert.equal((await visible('.sc-residual')).length, 1);
    await step('Another student');
    assert.deepEqual(await visible('.sc-square-label'), ['36', '49']);
    await step('Everyone');
    assert.deepEqual(await visible('.sc-square-label'), ['36', '289', '64', '49', '169', '4', '49']);
    await step('Sum of squares');
    const outline = await height('outline');
    assert.equal(await bin.locator('[data-sum=residual]').textContent(), 'Residual = 660');
    assert.equal(await bin.locator('[data-sum=alone]').textContent(), 'Coffee alone = 900');
    assert.ok(Math.abs(await height('residual') / outline - 660 / 1200) < 1e-3);
    assert.ok(Math.abs(await height('alone') / outline - 900 / 1200) < 1e-3);
    assert.equal(await bin.locator('[data-sum=aloneZ]').textContent(), 'Sleep alone = 666.67');
    assert.ok(Math.abs(await height('aloneZ') / outline - 2000 / 3 / 1200) < 1e-3);
    assert.equal((await value()).ssResidual, 660);

    await step('What did both explain?');
    assert.equal(await bin.locator('[data-sum=regression]').textContent(), 'Regression = 540');
    assert.ok(Math.abs(await height('regression') / outline - 540 / 1200) < 1e-3);

    await step('Who explained what?');
    const parts = { onlyZ: ['Sleep only = 240', 240], onlyX: ['Coffee only = 6.67', 20 / 3], shared: ['Shared = 293.33', 880 / 3] };
    let top = await bin.locator('.sc-ss-residual').evaluate(r => r.y.baseVal.value);
    for (const [key, [text, sum]] of Object.entries(parts)) {
      assert.equal(await bin.locator('[data-sum=' + key + ']').textContent(), text);
      const rect = await bin.locator('.sc-ss-' + key).evaluate(r => ({ y: r.y.baseVal.value, height: r.height.baseVal.value }));
      assert.ok(Math.abs(rect.height / outline - sum / 1200) < 1e-3, key);
      // Stacked in order on top of the residual, filling the square.
      assert.ok(Math.abs(rect.y + rect.height - top) < 0.01, key);
      top = rect.y;
    }

    await step('Coffee alone');
    assert.equal(await page.locator('.sc-family-line').count(), 0);
    assert.equal((await value()).ssResidual, 900);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('the coffee residuals table builds a column per step, and its own cells give the slope', async () => {
  const activity = divById(readChapter('18-regression.qmd'), 'act-coffee-residuals');
  const options = JSON.parse(/makeStepTable options='([^']+)'/.exec(activity)[1]);
  const actions = tutorialSteps(activity).map(step => step.action);
  // The cells are rounded for readers. Each should be its unrounded value to two
  // decimals, and the unrounded sums should give the two-predictor slope.
  // Headers keep the shortcode's doubled backslashes.
  const value = text => Number(text.replace('\u2212', '-'));
  const cells = key => options.columns.find(c => c.tex === key).cells.map(value);
  const [z, x] = [cells('Z'), cells('X')];
  const residuals = x.map((xi, i) => xi - (1 - (z[i] - 7) / 3));
  const scoreDeviations = cells('Y - M_Y');
  const close = (shown, exact) => assert.ok(Math.abs(shown - exact) <= 0.005 + 1e-9, shown + ' vs ' + exact);
  cells('X - \\\\hat{X}').forEach((v, i) => close(v, residuals[i]));
  cells('(X - \\\\hat{X})^2').forEach((v, i) => close(v, residuals[i] ** 2));
  cells('(X - \\\\hat{X})(Y - M_Y)').forEach((v, i) => close(v, residuals[i] * scoreDeviations[i]));
  const ss = residuals.reduce((a, e) => a + e * e, 0);
  const sp = residuals.reduce((a, e, i) => a + e * scoreDeviations[i], 0);
  assert.ok(Math.abs(sp / ss + 2) < 1e-9);

  // The other way round: sleep's residuals from coffee, against the same score deviations.
  const altCells = key => options.columns.find(c => c.alt && c.alt.tex === key).alt;
  const sleepResiduals = z.map((zi, i) => zi - (7 - (4 / 3) * (x[i] - 1)));
  altCells('Z - \\\\hat{Z}').cells.map(value).forEach((v, i) => close(v, sleepResiduals[i]));
  altCells('(Z - \\\\hat{Z})^2').cells.map(value).forEach((v, i) => close(v, sleepResiduals[i] ** 2));
  altCells('(Z - \\\\hat{Z})(Y - M_Y)').cells.map(value).forEach((v, i) => close(v, sleepResiduals[i] * scoreDeviations[i]));
  const ssSleep = sleepResiduals.reduce((a, e) => a + e * e, 0);
  const spSleep = sleepResiduals.reduce((a, e, i) => a + e * scoreDeviations[i], 0);
  assert.ok(Math.abs(spSleep / ssSleep - 6) < 1e-9);
  close(value(altCells('(Z - \\\\hat{Z})^2').summary), ssSleep);
  close(value(altCells('(Z - \\\\hat{Z})(Y - M_Y)').summary), spSleep);
  close(value(options.columns.find(c => c.tex === '(X - \\\\hat{X})^2').summary), ss);
  close(value(options.columns.find(c => c.tex === '(X - \\\\hat{X})(Y - M_Y)').summary), sp);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<div class="callout"><div id="host"></div><div class="callout-footer"><div class="tutorial-step"></div></div></div>');
    for (const script of ['d3.min', 'interactive-figure', 'variability-table-generator']) {
      await page.addScriptTag({ path: new URL('../../resources/js/' + script + '.js', import.meta.url).pathname });
    }
    await page.evaluate(opts => {
      window.interactiveFigure.createTutorial = args => { window.stepTable = args.applyAction; };
      document.querySelector('#host').appendChild(makeStepTable(opts));
    }, options);
    await page.waitForFunction(() => typeof window.stepTable === 'function');
    const shownColumns = () => page.locator('thead th').evaluateAll(ths => ths.filter(th => {
      const target = th.querySelector('.vt-reveal-target');
      return !target || target.classList.contains('is-visible');
    }).length);
    const expected = [2, 3, 4, 5, 7, 7];
    const firstHeader = () => page.locator('thead th').first().textContent();
    for (const [i, action] of actions.entries()) {
      await page.evaluate(a => window.stepTable(a), action);
      assert.equal(await shownColumns(), expected[i], 'columns after step ' + (i + 1));
    }
    // The last step swaps the predictors' columns and refills the calculation.
    assert.match(await firstHeader(), /^Coffee/);
    assert.equal(await page.locator('tbody tr').first().locator('td').nth(3).textContent(), '+0.67');
    await page.evaluate(a => window.stepTable(a), actions[4]);
    assert.match(await firstHeader(), /^Sleep/);
    assert.equal(await page.locator('tbody tr').first().locator('td').nth(3).textContent(), '\u22120.33');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('temperature tutorial traces guides and a rise over run, and its slider moves the reading', async () => {
  const activity = divById(readChapter('18-regression.qmd'), 'act-celsius-fahrenheit');
  const options = JSON.parse(/makeScatterplot options='([^']+)'/.exec(activity)[1]);
  const actions = tutorialSteps(activity).map(step => step.action);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<div id="host"></div>');
    for (const script of ['d3.min', 'interactive-figure', 'anova-squares', 'read-guides', 'scatterplot']) {
      await page.addScriptTag({ path: new URL('../../resources/js/' + script + '.js', import.meta.url).pathname });
    }
    await page.evaluate(opts => {
      const wrap = window.interactiveFigure.wrap;
      window.interactiveFigure.wrap = args => {
        window.stepTemperature = args.applyAction;
        return wrap(args);
      };
      document.querySelector('#host').appendChild(makeScatterplot({ ...opts, responsive: false }));
    }, options);
    const value = () => page.locator('.scatterplot').evaluate(el => el.value);
    const visibleSliders = () => page.locator('.sp-factor:not([hidden])').count();
    for (const action of actions) {
      await page.evaluate(a => window.stepTemperature(a), action);
      const v = await value();
      if (action.guide !== undefined) {
        assert.deepEqual(v.guide, { x: action.guide, y: 1.8 * action.guide + 32 });
        assert.equal(await page.locator('.sfs-read-guide').count(), 1);
      } else {
        assert.equal(v.guide, null, 'a guide carried over from another step');
        assert.equal(await page.locator('.sfs-read-guide').count(), 0);
      }
      assert.deepEqual(v.riseRun, action['rise-run'] || null);
      assert.equal(await visibleSliders(), (action['show-sliders'] || []).length);
    }
    // The last step shows the slider; moving it moves the reading.
    await page.locator('.sp-factor input[type=range]').evaluate(input => {
      input.value = '20';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.deepEqual((await value()).guide, { x: 20, y: 68 });
    assert.deepEqual(await page.locator('.sfs-read-guide-value').allTextContents(), ['20', '68']);
    // Stepping back hides the slider and clears the reading.
    await page.evaluate(a => window.stepTemperature(a), actions[1]);
    assert.equal(await visibleSliders(), 0);
    assert.equal((await value()).guide, null);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
