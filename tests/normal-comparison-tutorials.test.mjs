import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
const context = vm.createContext({window:{}});
for (const name of ['stat-helpers','normal-comparison-tutorials']) {
  vm.runInContext(await readFile(new URL(`../resources/js/${name}.js`,import.meta.url),'utf8'),context);
}
const {decision,overlap} = context.window.sfsNormalComparisons;
test('alpha moves critical boundaries without changing evidence',()=>{
  const ordinary=decision(.05,'two',-1.8),strict=decision(.01,'two',-1.8);
  assert.ok(Math.abs(ordinary.high-1.959964)<.00001);
  assert.ok(strict.high>ordinary.high);
  assert.equal(ordinary.p,strict.p);
  assert.ok(Math.abs(ordinary.p-.0718606)<.00001);
});
test('tail direction changes the decision and matching p-value',()=>{
  assert.equal(decision(.05,'two',-1.8).reject,false);
  assert.equal(decision(.05,'left',-1.8).reject,true);
  assert.equal(decision(.05,'right',-1.8).reject,false);
  for(const tail of ['two','left','right']) for(const alpha of [.001,.01,.05,.1]) {
    for(const z of [-3,-1.8,0,1.8,3]) {
      const result=decision(alpha,tail,z);
      assert.equal(result.reject,result.p<alpha);
    }
  }
});
test('overlap agrees with the integrated common density and is symmetric',()=>{
  const pdf=x=>Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);
  for(const d of [0,.07,.2,.5,.8,1.85,2.5]) {
    let area=0; const dx=.001;
    for(let x=-9;x<12;x+=dx) area+=Math.min(pdf(x+dx/2),pdf(x+dx/2-d))*dx;
    assert.ok(Math.abs(area-overlap(d))<.000001);
    assert.equal(overlap(d),overlap(-d));
  }
  assert.ok(Math.abs(overlap(.8)-.6891565)<.000001);
});
