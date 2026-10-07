import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../resources/js/playing-cards.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context);
const cards = context.window.SFSPlayingCards;

test('every numbered card has the correct count of central pips in all suits', () => {
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 10; rank++) {
      const svg = cards.face(rank, suit);
      const center = svg.split('<g class="sfs-card-pips">')[1];
      assert.equal((center.match(/<path /g) || []).length, rank);
      assert.equal((svg.match(/<text /g) || []).length, 2, 'both corner indices survive');
      assert.ok(!svg.includes('<use'), 'each standalone face is independent of SVG IDs');
    }
  }
});

test('face cards retain their rank and accessible full suit name', () => {
  for (const [rank, name, symbol] of [[11, 'Jack', 'J'], [12, 'Queen', 'Q'], [13, 'King', 'K']]) {
    assert.equal(cards.label(rank, 2), `${name} of diamonds`);
    assert.equal((cards.face(rank, 2).match(new RegExp(`>${symbol}</text>`, 'g')) || []).length, 3);
  }
  for (const [rank, suit] of [[0, 0], [14, 1], [2, 4], [2.5, 0]]) {
    assert.throws(() => cards.face(rank, suit), /rank 1–13/);
  }
});

test('coverage stream gives the run the tutorial narrates', () => {
  const chapter = readFileSync(new URL('../10-confidence-intervals.qmd', import.meta.url), 'utf8');
  const explorer = readFileSync(new URL('../resources/js/confidence-interval-explorer.js', import.meta.url), 'utf8');
  const rngContext = {};
  vm.runInNewContext(explorer.slice(explorer.indexOf('cieHashSeed ='), explorer.indexOf('cieClamp =')), rngContext);
  const seed = JSON.parse(chapter.match(/ciCoverage\s+makeConfidenceIntervalExplorer\s+options='([^']+)'/)[1]).seed;
  const means = (n) => {
    const rng = rngContext.cieSeededRng(`${seed}-n${n}`);
    return Array.from({ length: 100 }, () => {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += Math.floor(rng() * 13) + 1;
        rng();
      }
      return sum / n;
    });
  };
  const hits = (ms, n, z) => ms.map((m) => Math.abs(m - 7) <= z * Math.sqrt(14 / n));
  const count = (hs) => hs.filter(Boolean).length;
  const six = means(6);
  const thirty = hits(means(30), 30, 1.959964);
  assert.equal(count(hits(six, 6, 1.959964)), 94);
  assert.equal(count(hits(six, 6, 1.281552)), 79);
  assert.equal(count(thirty), 96);
  assert.ok(hits(six, 6, 1.959964)[0] && hits(six, 6, 1.959964)[1], 'the first two samples both include 7');
  assert.equal(thirty.indexOf(true), 0, 'focus "hit" is sample 1');
  assert.equal(thirty.indexOf(false), 24, 'focus "miss" is sample 25');
});
