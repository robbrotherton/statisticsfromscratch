import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
for (const file of ['stat-helpers', 'tukey-critical-values', 'critical-table-generator']) {
  vm.runInContext(readFileSync(new URL(`../resources/js/${file}.js`, import.meta.url), 'utf8'), context);
}
const q = context.sfsCriticalTableTukeyQuantile;

test('Tukey quantiles reproduce the worked examples and the two-mean t identity', () => {
  assert.equal(q(.05, 3, 8).toFixed(2), '4.04');
  assert.equal(q(.05, 3, 9).toFixed(2), '3.95');
  assert.equal(q(.05, 3, 4).toFixed(2), '5.04');
  for (const alpha of [.05, .01]) {
    for (const df of [2, 4, 8, 30, 60, 120, Infinity]) {
      const t = df === Infinity ? context.window.sfsStats.normalInv(1 - alpha / 2)
        : context.window.sfsStats.tInv(1 - alpha / 2, df);
      assert.ok(Math.abs(q(alpha, 2, df) - Math.SQRT2 * t) < .0002, `${alpha}, ${df}`);
    }
  }
});

test('Tukey critical values grow with family size and stricter alpha, and decrease with df', () => {
  const dfs = [...Array.from({ length: 29 }, (_, i) => i + 2), 40, 60, 120, Infinity];
  for (const alpha of [.05, .01]) {
    for (const df of dfs) {
      for (let k = 2; k < 10; k++) assert.ok(q(alpha, k + 1, df) > q(alpha, k, df));
    }
    for (let k = 2; k <= 10; k++) {
      dfs.slice(1).forEach((df, i) => assert.ok(q(alpha, k, df) < q(alpha, k, dfs[i])));
    }
  }
  for (const df of dfs) for (let k = 2; k <= 10; k++) assert.ok(q(.01, k, df) > q(.05, k, df));
});

test('unsupported Tukey coordinates fail explicitly instead of interpolating or showing blanks', () => {
  for (const args of [[.1,3,8], [.05,1,8], [.05,11,8], [.05,3,1], [.05,3,35], [.05,2.5,8]]) {
    assert.throws(() => q(...args), /No Tukey critical value/);
  }
});

test('Tukey aliases dispatch to the table and preserve selections for common table controls', () => {
  vm.runInContext('sfsCriticalTableTukey = (opts) => opts', context);
  for (const distribution of ['tukey', 'q', 'studentized-range']) {
    assert.equal(context.makeCriticalValueTable({ distribution, selected: { k: 3, df: 8 } }).selected.df, 8);
  }
  assert.equal(context.makeTukeyTable({ alpha: .01 }).distribution, 'tukey');
  assert.ok(context.sfsCriticalTableSelectionMatches({ k: 3, df: 8, alpha: .05 }, { k: 3, df: 8, alpha: .05 }));
});
