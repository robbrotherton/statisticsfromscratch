import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

import { divById, readChapter, tutorialSteps } from "./helpers/qmd.mjs";

const source = readFileSync(
  new URL("../resources/js/interaction-plot.js", import.meta.url),
  "utf8"
);
const context = { window: {}, document: {} };
runInNewContext(source, context);
const { ipEffects } = context;

const chapter = readChapter("16-factorial-anova.qmd");
const designQuiz = readFileSync(
  new URL("../quizzes/16-factorial-anova-design.qmd", import.meta.url),
  "utf8"
);

const cells = (means) => [[means.a1b1, means.a2b1], [means.a1b2, means.a2b2]];
const shown = (means) => {
  const effects = ipEffects(cells(means));
  return [effects.showsMainEffectA, effects.showsMainEffectB, effects.showsInteraction];
};

test("the maze means give the chapter's marginal means and predictions", () => {
  const effects = ipEffects([[36, 40], [28, 56]]);
  assert.equal(effects.marginalA1, 32);
  assert.equal(effects.marginalA2, 48);
  assert.equal(effects.marginalB1, 38);
  assert.equal(effects.marginalB2, 42);
  assert.equal(effects.grandMean, 40);
  assert.deepEqual(JSON.parse(JSON.stringify(effects.predictions)), [[30, 46], [34, 50]]);
  // Every cell of a 2x2 sits the same distance from its prediction.
  assert.equal(Math.abs(effects.interaction) / 4, 6);
  assert.equal(effects.showsNoEffects, false);
});

test("effect flags describe the pattern in the means", () => {
  assert.deepEqual(shown({ a1b1: 5, a2b1: 5, a1b2: 5, a2b2: 5 }), [false, false, false]);
  assert.equal(ipEffects([[5, 5], [5, 5]]).showsNoEffects, true);
  assert.deepEqual(shown({ a1b1: 3, a2b1: 6, a1b2: 3, a2b2: 6 }), [true, false, false]);
  assert.deepEqual(shown({ a1b1: 3, a2b1: 3, a1b2: 7, a2b2: 7 }), [false, true, false]);
  assert.deepEqual(shown({ a1b1: 2, a2b1: 5, a1b2: 5, a2b2: 8 }), [true, true, false]);
  assert.deepEqual(shown({ a1b1: 2, a2b1: 8, a1b2: 8, a2b2: 2 }), [false, false, true]);
  // One line flat, one sloped: everything at once, and the lines never cross.
  assert.deepEqual(shown({ a1b1: 3, a2b1: 3, a1b2: 4, a2b2: 9 }), [true, true, true]);
});

test("the graph tutorial starts from the real result, then shows every kind of pattern", () => {
  const steps = tutorialSteps(divById(chapter, "act-maze-interaction"));
  const real = { a1b1: 36, a2b1: 40, a1b2: 28, a2b2: 56 };

  // Steps can be opened in any order, so each one sets the whole picture.
  for (const { action } of steps) {
    for (const key of ["means", "show-lines", "highlight", "marginals", "prediction"]) {
      assert.ok(key in action, `step is missing ${key}`);
    }
  }

  assert.deepEqual(steps[0].action.means, real);
  assert.ok(steps.some(({ action }) => action.prediction === true));

  const patterns = new Set(steps.map(({ action }) => shown(action.means).join()));
  for (const pattern of [
    [false, false, false],
    [true, false, false],
    [false, true, false],
    [true, true, false],
    [false, false, true],
    [true, true, true],
  ]) {
    assert.ok(patterns.has(pattern.join()), `no step shows ${pattern}`);
  }
});

test("the results are graphed twice, once with each factor on the x-axis", () => {
  const figure = divById(chapter, "fig-maze-results");
  const options = Array.from(
    figure.matchAll(/makeInteractionPlot options='([^']+)'/g),
    (match) => JSON.parse(match[1])
  );
  assert.equal(options.length, 2);
  assert.deepEqual(options.map((option) => option.swapAxes), [false, true]);
  for (const option of options) {
    assert.deepEqual(option.means, { a1b1: 36, a2b1: 40, a1b2: 28, a2b2: 56 });
  }
});

test("the sketch quiz is graded against values the plot publishes", () => {
  const paths = Array.from(
    designQuiz.matchAll(/(?:correctFrom|contextFrom|responseFrom): designInteraction\.(\w+)/g),
    (match) => match[1]
  );
  assert.ok(paths.includes("sketch"));
  for (const flag of ["showsMainEffectA", "showsMainEffectB", "showsInteraction", "showsNoEffects"]) {
    assert.ok(paths.includes(flag), `no option is graded by ${flag}`);
  }
  for (const path of paths) {
    assert.match(source, new RegExp(`\\b${path}: `), `plot does not publish ${path}`);
  }
  assert.match(source, /rootNode\.quizResponse = \{/);
  assert.match(designQuiz, /makeInteractionPlot[^\n]*"draggable":true/);
});
