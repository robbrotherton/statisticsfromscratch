import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { graphSource, graphModules } from './helpers/graph-source.mjs';
const context = vm.createContext({window:{}});
vm.runInContext(graphSource,context);
const rows = [{label:'A', estimate:47, lower:45, upper:48}, {label:'B', estimate:47, lower:46, upper:49}];
test('interval rows preserve estimates and asymmetric limits without normalizing percentages',()=>{
  const result=context.sfsGraphIntervalRows(rows);
  assert.equal(result[0].estimate,47);
  assert.equal(result[0].lower,45);
  assert.equal(result[0].upper,48);
  assert.notEqual(result[0],rows[0]);
  assert.equal(context.sfsGraphIntervalRows([{label:'Zero',estimate:0,lower:0,upper:0}])[0].estimate,0);
});
test('interval input rejects missing, inverted, nonfinite and duplicate data',()=>{
  for(const data of [[],[{label:'A',estimate:1,lower:2,upper:3}], [{label:'A',estimate:1,lower:null,upper:2}],
    [{label:'A',estimate:NaN,lower:0,upper:2}], [rows[0],rows[0]], [{...rows[0],label:''}]]) {
    assert.throws(()=>context.sfsGraphIntervalRows(data));
  }
});
test('interval domains preserve a cropped scale while preventing truncated error bars',()=>{
  const domain=context.sfsGraphIntervalDomain(rows);
  assert.ok(domain[0]>0 && domain[0]<45 && domain[1]>49);
  assert.deepEqual(Array.from(context.sfsGraphIntervalDomain(rows,[42,52])),[42,52]);
  for(const domain of [[46,52],[42,48],[52,42],[42,Infinity]])assert.throws(()=>context.sfsGraphIntervalDomain(rows,domain));
  const zero=context.sfsGraphIntervalDomain([{lower:0,upper:0}]);
  assert.ok(zero[0]<0 && zero[1]>0);
});
test('the Quarto facade declares every module used by the test loader',()=>{
  const manifest=readFileSync(new URL('../filters/interactive-scripts.lua',import.meta.url),'utf8');
  const entry=manifest.match(/\["graph-generator"\] = \{[\s\S]*?deps = \{([^}]+)\}/)[1];
  for(const module of graphModules.slice(0,-1)) assert.ok(entry.includes(`"${module}"`));
  assert.equal(typeof context.makeGraph,'function');
  assert.equal(typeof context.makeApprovalBlockHistogram,'function');
  assert.equal(typeof context.makeSampleComparisonCover,'function');
});
