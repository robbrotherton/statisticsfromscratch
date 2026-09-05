import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ window: {} });
for (const name of ['d3.min.js', 'scatterplot.js']) {
  vm.runInContext(readFileSync(new URL('../resources/js/' + name, import.meta.url), 'utf8'), context);
}

test('cover dots occupy distinct grid cells and cannot overlap at the placement keyframes', () => {
  const grid = context.scAssociationCoverGrid();
  for (const r of [0, 0.6, 1]) {
    const points = grid.pointsAt(r);
    assert.equal(points.length, 48);
    assert.equal(new Set(points.map(p => `${p.x},${p.y}`)).size, 48);
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      assert.equal(Math.abs(p.x % 8), 0);
      assert.equal(Math.abs(p.y % 8), 0);
      assert.ok(p.x >= 8 && p.x <= 892);
      assert.ok(grid.centerY - p.y >= 8 && grid.centerY - p.y <= 412);
      if (i) assert.ok(p.x - points[i - 1].x >= 16);
      for (let j = 0; j < i; j++) {
        assert.ok(Math.hypot(p.x - points[j].x, p.y - points[j].y) >= 16);
      }
    }
  }
});

test('grid retains an uncorrelated start, exact straight line, and approximately 0.6 end', () => {
  const grid = context.scAssociationCoverGrid();
  assert.ok(Math.abs(context.scStats(grid.pointsAt(0)).r) < 0.015);
  assert.ok(Math.abs(context.scStats(grid.pointsAt(1)).r - 1) < 1e-12);
  assert.ok(Math.abs(context.scStats(grid.pointsAt(0.6)).r - 0.6) < 0.015);
});

test('regression fit minimizes squared residuals of the displayed snapped positions', () => {
  const points = context.scAssociationCoverGrid().pointsAt(0.6);
  const fit = context.scStats(points);
  const sse = context.scSumSquaredResiduals(points, fit.fitSlope, fit.fitIntercept);
  assert.ok(Math.abs(context.d3.sum(points, p => p.y - fit.fitSlope * p.x - fit.fitIntercept)) < 1e-8);
  for (const change of [-0.01, 0.01]) {
    assert.ok(context.scSumSquaredResiduals(points, fit.fitSlope + change, fit.fitIntercept) > sse);
  }
});


test('interpolated motion is continuous and collision-free between snapped keyframes', () => {
  const grid = context.scAssociationCoverGrid();
  for (const [a, b] of [[0, 1], [1, 0.6]]) {
    const from = grid.pointsAt(a), to = grid.pointsAt(b);
    const t = 0.371;
    const points = context.scAssociationCoverInterpolate(from, to, t);
    const next = context.scAssociationCoverInterpolate(from, to, t + 0.0001);
    assert.ok(points.some(p => p.y % 8 !== 0));
    for (let i = 0; i < points.length; i++) {
      assert.equal(points[i].y, from[i].y + (to[i].y - from[i].y) * t);
      assert.ok(Math.abs(next[i].y - points[i].y) < 0.05);
      for (let j = 0; j < i; j++) {
        assert.ok(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) >= 16);
      }
    }
  }
});
