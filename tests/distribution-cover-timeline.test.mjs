import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

function setup(animate = true) {
  let config;
  const replay = () => config.draw(0);
  const finish = () => config.draw(config.duration);
  const context = vm.createContext({ window: { interactiveFigure: {
    coverTimeline(root, options) {
      config = options;
      options.draw(options.animate ? 0 : options.duration);
      return { replay, finish };
    }
  } } });
  for (const file of ['d3.min.js', 'distribution-generator.js']) {
    vm.runInContext(readFileSync(new URL(`../resources/js/${file}`, import.meta.url), 'utf8'), context);
  }
  const root = { value: { performance: { renderer: 'test' } } };
  const frames = [], reports = [];
  context.sfsDistributionFamilyCoverTimeline(root, {
    animate, ease: 'linear', onPerformance: stats => reports.push({ ...stats })
  }, [{ delay: 0, duration: 100 }, { delay: 100, duration: 100 }], 200,
  progress => frames.push([progress(0), progress(1)]));
  return { root, frames, reports, draw: elapsed => config.draw(elapsed) };
}

test('family cover preserves staggered curve timing and replay resets frame statistics', () => {
  const s = setup();
  assert.deepEqual(s.frames.at(-1), [0, 0]);
  s.draw(50); assert.deepEqual(s.frames.at(-1), [0.5, 0]);
  s.draw(150); assert.deepEqual(s.frames.at(-1), [1, 0.5]);
  s.root.value.finish(); assert.deepEqual(s.frames.at(-1), [1, 1]);
  assert.equal(s.reports.length, 1);
  s.root.value.replay(); assert.deepEqual(s.frames.at(-1), [0, 0]);
  s.root.value.finish();
  assert.equal(s.reports.length, 2);
  assert.equal(s.reports[1].frameCount, 2);
  assert.equal(s.reports[1].renderer, 'test');
});

test('static family fallback draws complete curves immediately and reports once', () => {
  const s = setup(false);
  assert.deepEqual(s.frames, [[1, 1]]);
  assert.equal(s.reports.length, 1);
  s.root.value.finish();
  assert.equal(s.reports.length, 1);
});
