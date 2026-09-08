import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../resources/js/catan-board.js", import.meta.url), "utf8");
const chapter = readFileSync(new URL("../06-probability.qmd", import.meta.url), "utf8");
const manifest = readFileSync(new URL("../filters/interactive-scripts.lua", import.meta.url), "utf8");

// The board maths are pure, so the module only needs enough of a global to
// finish evaluating; nothing here builds a figure.
function loadBoardMaths() {
  const context = vm.createContext({ console, document: undefined, window: undefined });
  context.window = context;
  vm.runInContext(source, context);
  assert.equal(typeof context.catanBoard, "object");
  return context.catanBoard;
}

const maths = loadBoardMaths();
const board = maths.buildBoard(maths.DEFAULT_NUMBERS, maths.DEFAULT_RESOURCES);
const ratings = maths.rateBoard(board, { rating: "theory" });
const bestChance = maths.bestBy(ratings, "chance");

// ---------------------------------------------------------------- geometry

test("the board is a standard nineteen-hex Catan silhouette", () => {
  assert.equal(board.hexes.length, 19);
  assert.equal(board.vertices.length, 54);
  // Every corner touches one, two or three tiles, and the interior ones
  // touch three.
  const degrees = board.vertices.map((v) => v.hexes.length);
  assert.ok(degrees.every((d) => d >= 1 && d <= 3));
  assert.equal(degrees.filter((d) => d === 3).length, 24);
});

test("the number tokens are the game's own distribution", () => {
  const numbers = maths.DEFAULT_NUMBERS.filter((n) => n !== null);
  assert.equal(numbers.length, 18);
  assert.equal(maths.DEFAULT_NUMBERS.filter((n) => n === null).length, 1, "one desert");
  assert.ok(!numbers.includes(7), "seven pays nothing, so it is never on a tile");
  const tally = new Map();
  numbers.forEach((n) => tally.set(n, (tally.get(n) || 0) + 1));
  assert.equal(tally.get(2), 1);
  assert.equal(tally.get(12), 1);
  [3, 4, 5, 6, 8, 9, 10, 11].forEach((n) => {
    assert.equal(tally.get(n), 2, `two tiles numbered ${n}`);
  });
});

test("three terrains, six tiles each, plus the desert", () => {
  const tally = new Map();
  maths.DEFAULT_RESOURCES.forEach((r) => tally.set(r, (tally.get(r) || 0) + 1));
  assert.deepEqual([...tally.keys()].sort(), ["brick", "desert", "grain", "wood"]);
  ["wood", "grain", "brick"].forEach((r) => assert.equal(tally.get(r), 6));
  assert.equal(tally.get("desert"), 1);
});

// ------------------------------------------------------------ the counting

test("the counting rule is ways-out-of-36 over the corner's distinct numbers", () => {
  assert.equal(maths.waysToRoll(7), 6);
  assert.equal(maths.waysToRoll(2), 1);
  assert.equal(maths.waysToRoll(6), 5);
  assert.equal(maths.waysToRoll(9), 4);

  const corner = board.byId.get(bestChance.id);
  const byHand = corner.distinctNumbers.reduce((total, n) => total + maths.waysToRoll(n), 0);
  assert.equal(Math.round(bestChance.chance * 36), byHand);
});

test("the board keeps Catan's rule that 6 and 8 are never adjacent", () => {
  const red = (n) => n === 6 || n === 8;
  const adjacent = new Set();
  board.vertices.forEach((v) => {
    for (let i = 0; i < v.hexes.length; i += 1) {
      for (let j = i + 1; j < v.hexes.length; j += 1) {
        adjacent.add(`${v.hexes[i]}-${v.hexes[j]}`);
      }
    }
  });
  const offenders = [...adjacent].filter((pair) => {
    const [a, b] = pair.split("-").map(Number);
    return red(maths.DEFAULT_NUMBERS[a]) && red(maths.DEFAULT_NUMBERS[b]);
  });
  assert.deepEqual(offenders, [], "no two red tiles share an edge");
});

// --------------------------------------------- the claims the chapter makes

test("the chapter names the corner the board maths actually favours", () => {
  // Array.from: the board is built inside a vm, so its arrays carry that
  // context's prototype and deepStrictEqual would reject them on identity.
  const numbers = Array.from(board.byId.get(bestChance.id).distinctNumbers).sort((a, b) => a - b);
  assert.deepEqual(numbers, [5, 6, 9]);
  assert.equal(Math.round(bestChance.chance * 36), 13);

  // Keep the compact worked example consistent with the board.
  assert.match(chapter, /P\(5 \\text\{ or \} 6 \\text\{ or \} 9\) = \\frac\{4 \+ 5 \+ 4\}\{36\} = \\frac\{13\}\{36\} \\approx \.36/);
  assert.match(chapter, /where the 5, the 6 and the 9 meet/);
});

test("eight runner-up corners tie at 10/36", () => {
  const tied = ratings.filter((entry) => Math.round(entry.chance * 36) === 10);
  assert.equal(tied.length, 8);
  const second = Math.max(...ratings
    .filter((entry) => entry.id !== bestChance.id)
    .map((entry) => Math.round(entry.chance * 36)));
  assert.equal(second, 10, "nothing else on the board gets past 10/36");
});

test("the board includes the 3–5–9 corner", () => {
  const corner = board.vertices.find(
    (v) => v.distinctNumbers.length === 3 &&
      [3, 5, 9].every((n) => v.distinctNumbers.includes(n))
  );
  assert.ok(corner, "there is a corner touching 3, 5 and 9");
});

// ------------------------------------ the seed's picture, as the chapter tells it

// Preserve the seeded comparisons used in the extended classroom demo.
// The roller is now a separate classroom activity.
function seededRandom(seed) {
  const text = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return function () {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function cornerShares(rolls) {
  const seed = "probability-dice-v1559";
  const random = seededRandom(seed + "-bulk");
  const counts = new Array(13).fill(0);
  for (let i = 0; i < rolls; i += 1) {
    counts[1 + (random() * 6 | 0) + 1 + (random() * 6 | 0)] += 1;
  }
  return new Map(board.vertices.map((v) => [
    v.id,
    v.distinctNumbers.reduce((total, n) => total + counts[n], 0) / rolls
  ]));
}

const tiedIds = ratings.filter((e) => Math.round(e.chance * 36) === 10).map((e) => e.id);

test("after a game's worth of rolls the tied corners are anything but tied", () => {
  const shares = cornerShares(60);
  const tied = tiedIds.map((id) => shares.get(id));
  assert.equal(Math.round(Math.min(...tied) * 100), 20);
  assert.equal(Math.round(Math.max(...tied) * 100), 50);
});

test("after sixty rolls the truly best corner is only fourth", () => {
  const shares = cornerShares(60);
  const order = [...shares.entries()].sort((a, b) => b[1] - a[1]);
  const place = order.findIndex(([id]) => id === bestChance.id) + 1;
  assert.equal(place, 4);
  assert.ok(order[0][1] > shares.get(bestChance.id), "a worse corner leads");
});

test("a thousand rolls pulls the tied corners back together", () => {
  const shares = cornerShares(1000);
  const tied = tiedIds.map((id) => shares.get(id));
  assert.equal(Math.round(Math.min(...tied) * 100), 27);
  assert.equal(Math.round(Math.max(...tied) * 100), 30);
  const order = [...shares.entries()].sort((a, b) => b[1] - a[1]);
  assert.equal(order[0][0], bestChance.id, "the right corner has climbed to the top");
});

// ------------------------------------------------------------------ wiring

test("the module is registered and the chapter asks for it", () => {
  assert.match(manifest, /\["catan-board"\]\s*=\s*\{\s*file\s*=\s*"resources\/js\/catan-board\.js"/);
  assert.match(chapter, /^ {2}- catan-board$/m);
  assert.match(chapter, /interactive-figure catanBoardIntro makeCatanBoard/);
  assert.match(chapter, /"mode":"rated","rating":"theory"/);
});

test("the opening board hides its houses until a reader reaches for one", () => {
  // The reader meets an empty board; a house appears on hover or keyboard
  // focus and stays once a corner is chosen.
  assert.match(source, /\[data-cb-mode="choose"\] \.cb-vertex \.cb-glyph \{[^}]*opacity: 0;/);
  assert.match(source, /\[data-cb-mode="choose"\] \.cb-vertex\[data-hover="true"\] \.cb-glyph,\s*\.catan-board\[data-cb-mode="choose"\] \.cb-vertex:focus-visible \.cb-glyph \{\s*opacity: 0\.75;/);
  assert.match(source, /\.cb-vertex\[data-selected="true"\] \.cb-glyph[\s\S]{0,200}?opacity: 1;/);
});
