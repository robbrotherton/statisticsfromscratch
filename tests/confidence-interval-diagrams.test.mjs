import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { readChapter, divById, tutorialSteps } from './helpers/qmd.mjs';
const context = {window:{}, d3:{format:()=>v=>v.toFixed(2)}};
vm.runInNewContext(readFileSync(new URL('../resources/js/stat-helpers.js',import.meta.url),'utf8'),context);
vm.runInNewContext(readFileSync(new URL('../resources/js/confidence-interval-diagrams.js',import.meta.url),'utf8'),context);
const interval=context.window.sfsConfidenceInterval;

test('matching z tests and intervals agree across means, sizes and confidence levels',()=>{
  for(const n of [3,6,23,100]) for(const confidence of [80,95,99]) for(const m of [6,7,8,10.5]) {
    const p=interval(m,Math.sqrt(14),n,confidence);
    for(const mu0 of [0,4,7,9,12]) {
      const notRejected=Math.abs(m-mu0)<=p.margin;
      assert.equal(mu0>=p.lower&&mu0<=p.upper,notRejected);
    }
    assert.ok(Math.abs(p.upper+p.lower-2*m)<1e-12);
  }
});

test('the construction revisits every opening sample with the intended precision contrasts',()=>{
  const chapter=readChapter('10-confidence-intervals.qmd');
  const steps=tutorialSteps(divById(chapter,'act-ci-construction'));
  const options=JSON.parse(chapter.match(/ciConstruction makeCiConstruction options='([^']+)'/)[1]);
  const results=options.sampleFigures.map(id=>{
    const sample=JSON.parse(chapter.match(new RegExp(`${id} makePlayingCardHand options='([^']+)'`))[1]);
    return interval(sample.ranks.reduce((a,b)=>a+b,0)/sample.ranks.length,Math.sqrt(14),sample.ranks.length);
  });
  assert.equal(results[0].m,results[1].m);
  assert.ok(results[0].margin>results[1].margin);
  assert.equal(results[1].margin,results[2].margin);
  assert.ok(results[2].lower>options.mu0);
  for(const sample of [0,1,2]) assert.ok(steps.some(s=>s.action.sample===sample&&s.action.stage===2));
  assert.ok(steps.some(s=>s.action.sample===2&&s.action.stage===1));
  assert.equal(steps.at(-1).action.summary,true);
});
