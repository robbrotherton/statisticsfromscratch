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

test('opening hands reproduce the coverage stream, including suits and the selected miss', () => {
  const chapter = readFileSync(new URL('../10-confidence-intervals.qmd', import.meta.url), 'utf8');
  const explorer = readFileSync(new URL('../resources/js/confidence-interval-explorer.js', import.meta.url), 'utf8');
  const rngContext = {};
  vm.runInNewContext(explorer.slice(explorer.indexOf('cieHashSeed ='), explorer.indexOf('cieClamp =')), rngContext);
  const seed = JSON.parse(chapter.match(/ciCoverage\s+makeConfidenceIntervalExplorer\s+options='([^']+)'/)[1]).seed;
  for (const [id, n, draw] of [['ciSampleA', 3, 1], ['ciSampleB', 6, 1], ['ciSampleC', 6, 69]]) {
    const opts = JSON.parse(chapter.match(new RegExp(`${id} makePlayingCardHand options='([^']+)'`))[1]);
    const rng = rngContext.cieSeededRng(`${seed}-n${n}`);
    let ranks, suits;
    for (let i = 0; i < draw; i++) {
      ranks = []; suits = [];
      for (let j = 0; j < n; j++) {
        ranks.push(Math.floor(rng() * 13) + 1);
        suits.push(Math.floor(rng() * 4));
      }
    }
    assert.deepEqual(opts.ranks, ranks);
    assert.deepEqual(opts.suits, suits);
    const mean = ranks.reduce((a, b) => a + b, 0) / n;
    const contains = Math.abs(mean - 7) <= 1.96 * Math.sqrt(14 / n);
    assert.equal(contains, id !== 'ciSampleC');
  }
});
