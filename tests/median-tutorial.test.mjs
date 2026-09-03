import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { siteStyles } from "./site-styles.mjs";

const chapter = readFileSync(new URL("../03-central-tendency.qmd", import.meta.url), "utf8");
const source = readFileSync(
  new URL("../resources/js/median-tutorial.js", import.meta.url),
  "utf8"
);
const openingQuiz = readFileSync(
  new URL("../quizzes/03-central-tendency-center-1.qmd", import.meta.url),
  "utf8"
);
const styles = siteStyles;

const sectionStart = chapter.indexOf("## The median");
const sectionEnd = chapter.indexOf("## The mean", sectionStart);
const section = chapter.slice(sectionStart, sectionEnd);
const steps = Array.from(section.matchAll(
  /::: \{\.tutorial-step\b[^\n]*?data-title="([^"]+)"[^\n]*?data-action='([^']+)'[^\n]*?\}/g
)).map((match) => ({ title: match[1], action: JSON.parse(match[2]) }));

test("the median tutorial reveals one operation at a time", () => {
  assert.deepEqual(steps.map((step) => step.title), [
    "Raw data", "Order", "Middle", "Halves", "Even number", "Same category", "Between"
  ]);
  assert.equal(steps.length, 7);

  for (const step of steps) {
    assert.ok(Object.hasOwn(step.action, "example"));
    assert.ok(Object.hasOwn(step.action, "order"));
    assert.ok(Object.hasOwn(step.action, "emphasize"));
    assert.ok(Object.hasOwn(step.action, "annotation"));
    assert.ok(Object.hasOwn(step.action, "animate"));
  }

  assert.deepEqual(steps[0].action, {
    example: "odd", order: "raw", emphasize: "none", annotation: "none", animate: false
  });
  assert.deepEqual(steps[1].action, {
    example: "odd", order: "ascending", emphasize: "none", annotation: "none", animate: true
  });
  assert.deepEqual(steps[2].action, {
    example: "odd", order: "ascending", emphasize: "middle", annotation: "median", animate: true
  });
  assert.deepEqual(steps[3].action, {
    example: "odd", order: "ascending", emphasize: "halves", annotation: "median", animate: true
  });
  assert.deepEqual(steps[4].action, {
    example: "even", order: "ascending", emphasize: "none", annotation: "none", animate: true
  });
  assert.deepEqual(steps[5].action, {
    example: "even", order: "ascending", emphasize: "positional-halves", annotation: "median", animate: true
  });
  assert.deepEqual(steps[6].action, {
    example: "evenBoundary", order: "ascending", emphasize: "positional-halves", annotation: "middle", animate: true
  });
  assert.match(section, /data-title="Even number"[\s\S]*?data-major="even" data-major-title="Even number"/);
  assert.match(section, /data-title="Same category"[\s\S]*?data-major="even" data-major-title="Even number"/);
});

test("the tutorial reuses the opening letter-grade data", () => {
  const optionsMatch = section.match(
    /medianTutorial makeMedianTutorial options='([^']+)'/
  );
  assert.ok(optionsMatch);
  const tutorialExamples = JSON.parse(optionsMatch[1]).examples;
  const tutorialExample = tutorialExamples.odd;
  assert.equal(tutorialExample.kind, "ordinal");
  assert.deepEqual(
    tutorialExample.values.slice().sort((a, b) => a - b),
    [1, 2, 3, 4, 4, 5, 5, 5, 5]
  );
  assert.notDeepEqual(
    tutorialExample.values,
    tutorialExample.values.slice().sort((a, b) => a - b)
  );
  assert.deepEqual(tutorialExample.labels, { 1: "F", 2: "D", 3: "C", 4: "B", 5: "A" });
  assert.deepEqual(tutorialExamples.even.values, [5, 2, 5, 1, 4, 5, 3, 4]);
  assert.deepEqual(tutorialExamples.evenBoundary.values, [5, 2, 5, 1, 4, 5, 3, 3]);
  assert.deepEqual(tutorialExamples.even.values.slice().sort((a, b) => a - b),
    [1, 2, 3, 4, 4, 5, 5, 5]);
  assert.deepEqual(tutorialExamples.evenBoundary.values.slice().sort((a, b) => a - b),
    [1, 2, 3, 3, 4, 5, 5, 5]);
  assert.deepEqual(tutorialExample.values.slice(0, -1), tutorialExamples.even.values);
  assert.equal(tutorialExample.values.at(-1), 5);
  assert.deepEqual(tutorialExamples.even.values.flatMap((value, index) =>
    value === tutorialExamples.evenBoundary.values[index] ? [] : [index]
  ), [7]);

  const graphOptions = Array.from(openingQuiz.matchAll(/options='([^']+)'/g))
    .map((match) => JSON.parse(match[1]));
  const gradeGraph = graphOptions.find((options) => options.labels?.x === "Letter grade");
  assert.deepEqual(gradeGraph.data.map((entry) => entry.x), ["F", "D", "C", "B", "A"]);
  const rank = { F: 1, D: 2, C: 3, B: 4, A: 5 };
  const quizGrades = gradeGraph.data.flatMap((entry) =>
    Array(entry.frequency).fill(rank[entry.x])
  );
  assert.deepEqual(
    quizGrades.slice().sort((a, b) => a - b),
    tutorialExample.values.slice().sort((a, b) => a - b)
  );
  assert.match(chapter, /mode was an A grade/);
  assert.match(section, /The striped B cards belong to both/);
  assert.match(section, /The important thing is to be clear and intentional/);
});

test("the completed card figures use the requested display order and cover each later case", () => {
  const staticOptions = Array.from(section.matchAll(
    /makeMedianCards options='([^']+)'/g
  )).map((match) => JSON.parse(match[1]));

  assert.equal(staticOptions.length, 2);
  assert.deepEqual(staticOptions.map((options) => options.values), [
    [2, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 7, 7, 8],
    [65, 70, 80, 90]
  ]);
  assert.ok(staticOptions.every((options) =>
    options.values.every((value, index, values) => index === 0 || values[index - 1] <= value)
  ));
  assert.ok(staticOptions.every((options) => options.revealOnVisible === true));
  assert.ok(staticOptions.every((options) => options.order === undefined));

  const graphOptions = Array.from(openingQuiz.matchAll(/options='([^']+)'/g))
    .map((match) => JSON.parse(match[1]));
  const scoreGraph = graphOptions.find((options) => options.labels?.x === "Test score (out of 10)");
  assert.deepEqual(staticOptions[0].values, scoreGraph.data);
  assert.deepEqual(
    Array.from({ length: 7 }, (_, index) =>
      scoreGraph.data.filter((value) => value === index + 2).length
    ),
    [1, 2, 3, 4, 3, 2, 1]
  );
  assert.match(section, /The sixteen test scores from the opening quiz/);
  assert.match(section, /the eighth and ninth/);
  assert.match(chapter, /\| 2 \| 1 \|[\s\S]*?\| 3 \| 2 \|[\s\S]*?\| 4 \| 3 \|[\s\S]*?\| \[5\]\{\.bc-mode-marker\} \| 4 \|[\s\S]*?\| 6 \| 3 \|[\s\S]*?\| 7 \| 2 \|[\s\S]*?\| 8 \| 1 \|/);
  assert.doesNotMatch(section, /#fig-even-median-[12]/);
  assert.match(section, /#fig-median-test-scores/);
  assert.match(section, /#fig-even-median-quant/);
});

test("sorting and visibility reveals are accessible, interruptible, and motion-aware", () => {
  assert.match(source, /interactiveRuntime/);
  assert.match(source, /motion\.shouldAnimate/);
  assert.match(source, /bc-if:cancel-transitions/);
  assert.match(source, /getAnimations\(\{ subtree: true \}\)/);
  assert.match(source, /ordered from low to high/);
  assert.match(source, /The single middle observation, and the median/);
  assert.match(source, /Their average, and the median/);
  assert.match(source, /is-below/);
  assert.match(source, /is-equal/);
  assert.match(source, /is-above/);
  assert.match(source, /all observations shown in one row/);
  assert.match(source, /makeMedianCards/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /motion\.onChange/);
  assert.match(source, /detail && detail\.reduced/);
  assert.match(source, /is-reveal-pending/);
  assert.match(source, /median-remove/);
  assert.match(source, /median-replace-old/);
  assert.match(source, /median-replace-new/);
  assert.match(source, /animate && preserveObservations/);
  assert.match(source, /singleSlotReplacement/);
  assert.match(source, /fill: hasRemoval \? "backwards" : "none"/);
  assert.match(source, /markerDetail\.textContent = summary\.example\.kind === "ordinal" && summary\.median === null/);
  assert.match(source, /The median falls between them/);
  assert.match(source, /nextState\.emphasize === "positional-halves"/);
  assert.match(source, /index < summary\.count \/ 2/);
  assert.match(source, /index >= summary\.count \/ 2/);
  assert.match(source, /const positionalMedianActive = positionalHalvesActive/);
  assert.match(source, /\(partitionActive && isMedianValue\) \|\| positionalMedianActive/);
  assert.match(source, /positionalHalvesActive && !showPositionalMedian/);
  assert.match(source, /"Lower half"/);
  assert.match(source, /"Upper half"/);
});

test("dense card rows remain compact and do not rely on color alone", () => {
  assert.match(styles, /\.median-tutorial \.mt-chart-wrap \{[\s\S]*?overflow-x: auto;/);
  assert.match(styles, /\.median-tutorial \.mt-stage \{[\s\S]*?min-width: 0;/);
  assert.match(styles, /grid-template-columns: repeat\(var\(--mt-count\), minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 480px\) \{[\s\S]*?\.median-tutorial \.mt-stage \{[\s\S]*?padding-right: 0\.125rem;[\s\S]*?padding-left: 0\.125rem;/);
  assert.match(styles, /@media \(max-width: 480px\) \{[\s\S]*?\.median-tutorial \.mt-values,[\s\S]*?\.median-tutorial \.mt-marker-grid \{[\s\S]*?gap: 0\.125rem;[\s\S]*?width: 100%;/);
  assert.doesNotMatch(source, /--mt-stage-min-width/);
  assert.match(source, /classList\.toggle\("is-dense", nextOrder\.length > 10\)/);
  assert.match(styles, /\.median-tutorial\.is-dense \.mt-values/);
  assert.match(styles, /\.median-tutorial\.is-dense \.mt-score/);
  assert.match(styles, /\.median-tutorial \.mt-score\.is-below/);
  assert.match(styles, /\.median-tutorial \.mt-score\.is-above/);
  assert.match(styles, /\.median-tutorial \.mt-score\.is-equal::before \{[\s\S]*?repeating-linear-gradient/);
  assert.match(styles, /median-cards-static\.is-reveal-pending \.mt-score::before/);
  assert.match(styles, /\.median-tutorial \.mt-score\.mt-score-ghost/);
  assert.match(styles, /\.median-tutorial \.mt-legend-item\[hidden\]/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(source, /Below median/);
  assert.match(source, /Equal to median \(in both halves\)/);
  assert.match(source, /Above median/);
});
