import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chapter = readFileSync(new URL("../04-variability.qmd", import.meta.url), "utf8");
const quiz = readFileSync(
  new URL("../quizzes/04-variability-calculation.qmd", import.meta.url),
  "utf8"
);
const source = readFileSync(
  new URL("../resources/js/variability-table-generator.js", import.meta.url),
  "utf8"
);

function calculationTutorial() {
  const start = chapter.indexOf("## Calculate variability");
  const end = chapter.indexOf("{{< include quizzes/04-variability-calculation.qmd >}}", start);
  assert.ok(start >= 0 && end > start, "the population calculation tutorial should be present");
  return chapter.slice(start, end);
}

test("the variability tutorial works through The Good, the Bad and the Okay alone without direct table controls", () => {
  const tutorial = calculationTutorial();

  assert.match(tutorial, /variabilityTable makeVariabilityTable/);
  assert.doesNotMatch(tutorial, /makeVariabilityTables/);
  assert.match(tutorial, /"title":"The Good, the Bad and the Okay"/);
  assert.doesNotMatch(tutorial, /"title":"The Polarizing Express"/);
  assert.match(tutorial, /"controls":false/);

  const titles = Array.from(tutorial.matchAll(/data-title="([^"]+)"/g), (match) => match[1]);
  assert.deepEqual(titles, ["Scores", "Mean", "Deviations", "Squared", "SS", "Variance", "SD"]);
});

test("the tutorial prose carries the former post-table explanation", () => {
  const tutorial = calculationTutorial();

  assert.match(tutorial, /easiest to put the scores in the first column/);
  assert.match(tutorial, /variance is measured in squared rating points/);
  assert.match(tutorial, /typical deviation from the mean rating for \*The Good, the Bad and the Okay\* is around three points/);
  assert.doesNotMatch(
    chapter,
    /When doing it by hand like this, I find it easiest to create a table for the scores/
  );
});

test("the Polarizing Express quiz asks for the numeric SD and reuses the fully revealed table generator", () => {
  assert.match(quiz, /id: polarizing_express_population_sd/);
  assert.match(quiz, /Follow the whole procedure for the ratings of The Polarizing Express/);
  assert.match(quiz, /answer: 4\.69/);
  assert.match(quiz, /polarizingExpressPopulationVariabilityTable/);
  assert.match(quiz, /makeVariabilityTable/);
  assert.match(quiz, /"data":\[0,0,1,9,10,10\]/);
  assert.match(quiz, /"initialStage":"sd"/);
  assert.match(quiz, /"controls":false/);
  assert.match(quiz, /"tutorial":false/);
  assert.doesNotMatch(quiz, /^\s*\| \$X\$/m);
  assert.match(quiz, /Taking the square root of 22/);
});

test("the legacy direct controls are explicitly marked for later removal", () => {
  assert.match(source, /These direct reveal controls are retained for standalone tables/);
  assert.match(source, /this control layer and its action handlers can be removed/);
});

test("the table generator defaults to population or sample mean notation consistently", () => {
  assert.match(
    source,
    /const meanSymbol = opts\.meanSymbol \|\| \(stats\.sample \? "M" : "\\\\mu"\)/
  );
  assert.match(source, /const deviationSymbol = opts\.deviationSymbol \|\|/);
});
