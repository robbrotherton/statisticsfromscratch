import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const css = readFileSync(new URL("../resources/css/quiz.css", import.meta.url), "utf8");
const runtime = readFileSync(
  new URL("../resources/js/quiz.js", import.meta.url),
  "utf8"
);
const filter = readFileSync(new URL("../filters/quiz-yaml.lua", import.meta.url), "utf8");
const quizDirectory = new URL("../quizzes/", import.meta.url);

test("every quiz type uses the same descriptive primary action by default", () => {
  assert.match(
    runtime,
    /const checkLabel = normalizeText\(question\.checkLabel\) \|\| "Check answer";/
  );
  assert.doesNotMatch(runtime, /Compare with answer/);
});

test("a numeric question can be graded against a figure's live value", () => {
  assert.match(runtime, /function expectedAnswer\(question\)/);
  assert.match(runtime, /normalizeText\(question\.answerFrom\)/);
  assert.match(runtime, /runtime\.getValue\(path\)/);
  assert.match(filter, /"is only available on numeric questions"/);
  assert.match(filter, /"cannot be combined with answer"/);
});

test("a numeric question without an answer collects a number instead of grading one", () => {
  assert.match(runtime, /if \(!Number\.isFinite\(expected\)\) return null;/);
  assert.match(filter, /validate_range\(question, path\)/);
  assert.match(runtime, /function outOfRangeMessage\(question, response\)/);
});

test("rich quiz fields preserve TeX for the page-level MathJax pass", () => {
  assert.match(filter, /html_math_method = "mathjax"/);
  assert.match(
    filter,
    /local function write_html\(document\)[\s\S]*?pandoc\.write\(document, "html", HTML_WRITER_OPTIONS\)/
  );
  assert.match(filter, /return write_html\(pandoc\.read\(markdown, "markdown"\)\)/);
  assert.match(filter, /return write_html\(pandoc\.Pandoc\(\{ pandoc\.Para\(value\) \}\)\)/);
  assert.match(filter, /return write_html\(pandoc\.Pandoc\(value\)\)/);
});

test("secondary action labels describe what they reveal or hide", () => {
  for (const label of [
    "Show hint",
    "Hide hint",
    "Show answer",
    "Hide answer",
    "Show explanation",
    "Hide explanation",
  ]) {
    assert.match(runtime, new RegExp(`"${label}`));
  }

  assert.doesNotMatch(runtime, /"Why\?"/);
  assert.match(filter, />Show hint<\/button>/);
  assert.match(runtime, /const hasModelAnswer = Boolean/);
  assert.match(runtime, /state === "correct" \|\| !hasModelAnswer/);
  assert.match(runtime, /hasModelAnswer \? "Show answer" : "Show explanation"/);
});

test("quiz layout uses one shared edge and stack spacing token", () => {
  assert.match(css, /--quiz-edge-space:\s*[^;]+;/);
  assert.match(css, /--quiz-stack-space:\s*[^;]+;/);
  assert.match(
    css,
    /> \.callout-body-container\.callout-body \{[\s\S]*?padding: var\(--quiz-edge-space\);[\s\S]*?\}/
  );
  assert.match(css, /\.quiz-question \{[\s\S]*?gap: var\(--quiz-stack-space\);[\s\S]*?\}/);
  assert.match(css, /\.quiz-control \{[\s\S]*?gap: var\(--quiz-stack-space\);[\s\S]*?\}/);
  assert.match(
    css,
    /\.quiz-question \+ \.quiz-question \{[\s\S]*?margin-top: var\(--quiz-section-space\);[\s\S]*?padding-top: var\(--quiz-section-space\);/
  );
});

test("quiz headers cancel Quarto's generic body overlap locally", () => {
  assert.match(
    css,
    /\.quiz\.callout\.callout-style-default > \.callout-header \{[\s\S]*?margin-bottom: 0;[\s\S]*?\}/
  );
  assert.doesNotMatch(css, /(^|\n)\.callout\.callout-titled\s*>\s*\.callout-header/);
});

test("numbered quiz floats merge their generated label into the quiz header", () => {
  assert.match(runtime, /function mergeQuizCrossrefLabel\(section\)/);
  assert.match(runtime, /closest\("figure\.quarto-float-quiz"\)/);
  assert.match(runtime, /child\.matches\("figcaption\.quarto-float-caption"\)/);
  assert.match(runtime, /caption\.classList\.add\("visually-hidden"\)/);
  assert.match(runtime, /section\.setAttribute\("aria-label"/);
  assert.match(runtime, /mergeQuizCrossrefLabel\(section\);[\s\S]*?hydrateQuiz/);
  assert.match(css, /\.quiz-crossref-label \{[\s\S]*?white-space: nowrap;/);
  assert.match(css, /\.quarto-float-quiz \.quiz\.callout \{[\s\S]*?text-align: left;/);
});

test("the quiz initializer moves a rendered cross-reference label without duplicating its title", () => {
  let initialize;
  let ariaLabel = "";
  const titleNodes = [];
  const captionClasses = new Set();
  const sectionClasses = new Set();

  const title = {
    prepend(node) {
      titleNodes.unshift(node);
    },
  };
  const titleContainer = {
    textContent: "Finding the center",
    firstElementChild: title,
  };
  const caption = {
    textContent: "Quiz 3.1: Finding the center",
    matches: (selector) => selector === "figcaption.quarto-float-caption",
    classList: {
      add: (name) => captionClasses.add(name),
    },
  };
  const figure = { children: [caption] };
  const section = {
    dataset: {},
    closest: (selector) => selector === "figure.quarto-float-quiz" ? figure : null,
    querySelector: () => titleContainer,
    setAttribute(name, value) {
      if (name === "aria-label") ariaLabel = value;
    },
    classList: {
      add: (name) => sectionClasses.add(name),
    },
  };
  const script = {
    textContent: "not json",
    closest: (selector) => selector === ".quiz" ? section : null,
  };
  const document = {
    addEventListener(name, callback) {
      if (name === "DOMContentLoaded") initialize = callback;
    },
    querySelectorAll: () => [script],
    createElement: () => ({ className: "", textContent: "" }),
    createTextNode: (text) => ({ textContent: text }),
  };

  runInNewContext(runtime, {
    document,
    window: {},
    console: { error() {} },
    JSON,
    Set,
  });
  initialize();

  assert.equal(titleNodes[0].className, "quiz-crossref-label");
  assert.equal(titleNodes[0].textContent, "Quiz 3.1:");
  assert.equal(titleNodes[1].textContent, " ");
  assert.equal(ariaLabel, "Quiz 3.1: Finding the center");
  assert.equal(section.dataset.quizCrossrefMerged, "true");
  assert.ok(captionClasses.has("visually-hidden"));
  assert.ok(sectionClasses.has("quiz-error"));
});

test("inputs, choices, and buttons share the configured target minimum", () => {
  assert.match(css, /--quiz-control-min-height:\s*[^;]+;/);

  for (const selector of [
    '\\.quiz-control input\\[type="text"\\]',
    "\\.quiz-choice",
    "\\.quiz-actions button",
  ]) {
    assert.match(
      css,
      new RegExp(`${selector}[\\s\\S]*?\\{[\\s\\S]*?min-height: var\\(--quiz-control-min-height\\);`)
    );
  }
});

test("quiz controls can shrink and action rows can wrap at narrow widths", () => {
  assert.match(
    css,
    /\.quiz-control input\[type="text"\] \{[\s\S]*?box-sizing: border-box;[\s\S]*?width: 100%;/
  );
  assert.match(css, /\.quiz-choice-text \{[\s\S]*?min-width: 0;/);
  assert.match(css, /\.quiz-actions \{[\s\S]*?flex-wrap: wrap;/);
});

test("the shared renderer covers every authored question type", () => {
  const types = new Set();

  for (const name of readdirSync(quizDirectory).filter((entry) => entry.endsWith(".qmd"))) {
    const source = readFileSync(new URL(name, quizDirectory), "utf8");
    for (const match of source.matchAll(/^\s*type:\s*([^\s#]+)\s*$/gm)) {
      types.add(match[1]);
    }
  }

  assert.deepEqual(
    [...types].sort(),
    ["free-response", "multiple-choice", "numeric", "true-false"]
  );
});
