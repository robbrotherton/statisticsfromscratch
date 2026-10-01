import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
const context = vm.createContext({window:{}});
context.window = context;
for (const name of ['d3.min','stat-helpers','distribution-generator','effect-size-examples','normal-comparison-tutorials']) {
  vm.runInContext(await readFile(new URL(`../resources/js/${name}.js`,import.meta.url),'utf8'),context);
}
const {sfsDistributionSpec: spec, sfsDistributionPdf: pdf, sfsDistributionCdf: cdf,
  sfsDistributionQuantile: quantile, sfsDistributionMeanValue: meanValue} = context;
const examples = context.sfsEffectSizeExamples;
const {exampleSummary} = context.sfsNormalComparisons;

test('a bounded smoothed curve keeps all of its area inside the scale limits',()=>{
  const ratings = [1,1,1,2,2,3,4,7,7];
  const dist = spec({distribution:'kde',data:ratings,bandwidth:.6,bounds:[1,7]});
  assert.equal(pdf(dist,.99),0);
  assert.equal(pdf(dist,7.01),0);
  let area = 0; const dx = .0005;
  for (let x = 1; x < 7; x += dx) area += pdf(dist,x+dx/2)*dx;
  assert.ok(Math.abs(area-1) < 1e-4);
  assert.equal(cdf(dist,7),1);
  for (const p of [.1,.5,.9]) assert.ok(Math.abs(cdf(dist,quantile(dist,p))-p) < 1e-6);
  assert.ok(Math.abs(meanValue(dist)-ratings.reduce((a,b)=>a+b)/ratings.length) < 1e-12);
});

test('an unbounded smoothed curve integrates to one',()=>{
  const dist = spec({distribution:'kde',data:[61,64,64,65,70,74]});
  let area = 0; const dx = .001;
  for (let x = 40; x < 95; x += dx) area += pdf(dist,x+dx/2)*dx;
  assert.ok(Math.abs(area-1) < 1e-6);
});

test('survey examples reproduce the authors\' effect sizes, lower group first',()=>{
  // Item Summary sheet, MTurk sample, in the Data Colada [18] data file.
  const reported = {height:1.826907, socialeq:.692776, eggsalad:.581493, smoking:.325854, planets:.051035};
  assert.deepEqual(Object.keys(examples).sort(),Object.keys(reported).sort());
  for (const [key,d] of Object.entries(reported)) {
    const summary = exampleSummary(examples[key]);
    assert.ok(summary.high.mean > summary.low.mean, key);
    assert.ok(Math.abs(summary.d-d) < .0005, `${key}: ${summary.d}`);
    const bounds = examples[key].bounds;
    if (bounds) for (const value of [...summary.low.values,...summary.high.values]) {
      assert.ok(value >= bounds[0] && value <= bounds[1], key);
    }
  }
});
