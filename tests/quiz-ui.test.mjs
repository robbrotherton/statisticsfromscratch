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

test("a figure question is validated and rendered without grading", () => {
  assert.match(filter, /\["figure"\] = true/);
  assert.match(
    filter,
    /if is_blank\(question\.responseFrom\) or not tostring\(question\.responseFrom\):match\("\^\[A-Za-z0-9_-\]\+%\.\[A-Za-z0-9_\.-\]\+\$"\) then/
  );
  assert.match(filter, /"must name a figure value, such as board\.selection"/);
  assert.match(filter, /"must contain an interactive figure"/);
  assert.match(filter, /"figure responses are saved without grading"/);
  assert.match(filter, /"responseFrom and figure are only available on figure questions"/);
  assert.match(runtime, /if \(type === QUESTION_TYPES\.figure\) return figureControl\(wrapper, question\);/);
  assert.match(runtime, /check\.hidden = isFigure;/);
});

test("promptFrom swaps in a live figure value and only works on free-response questions", () => {
  assert.match(filter, /"requires a value path, promptTemplate, and fallback prompt"/);
  assert.match(filter, /if not tostring\(question\.promptTemplate\):find\("\{value\}", 1, true\) then/);
  assert.match(filter, /"must contain \{value\}"/);
  assert.match(filter, /"is only available on free-response questions"/);
  assert.match(runtime, /const text = question\.promptTemplate\.split\("\{value\}"\)\.join\(label\);/);
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
    ["figure", "free-response", "multiple-choice", "numeric", "true-false"]
  );
});

// --------------------------------------------------- figure question wiring
//
// The two tests below actually run quiz.js (via runInNewContext, as in "the
// quiz initializer..." test above) against a hand-built stand-in for the
// rendered Catan quiz: a figure question (choose a corner) and a
// free-response question whose prompt reads the figure's live selection.
// querySelector/querySelectorAll are exact-string lookups rather than a real
// CSS engine, matching the fixed markup the Lua filter renders.

function createNode({ dataset = {}, classes = [], select = {}, closestMap = {}, children = [] } = {}) {
  const classSet = new Set(classes);
  const listeners = new Map();
  const node = {
    dataset,
    hidden: false,
    textContent: "",
    innerHTML: "",
    value: "",
    parentNode: null,
    children,
    classList: {
      contains: (name) => classSet.has(name),
      add: (...names) => names.forEach((name) => classSet.add(name)),
      remove: (...names) => names.forEach((name) => classSet.delete(name)),
      toggle: (name, force) => {
        const next = force === undefined ? !classSet.has(name) : Boolean(force);
        if (next) classSet.add(name); else classSet.delete(name);
        return next;
      },
    },
    setAttribute() {},
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    dispatchEvent(event) {
      listeners.get(event.type)?.forEach((fn) => fn.call(node, event));
      if (event.bubbles && node.parentNode) node.parentNode.dispatchEvent(event);
      return true;
    },
    querySelector(selector) {
      const found = select[selector];
      return Array.isArray(found) ? found[0] || null : found || null;
    },
    querySelectorAll(selector) {
      const found = select[selector];
      return Array.isArray(found) ? found : found ? [found] : [];
    },
    closest(selector) {
      return selector in closestMap ? closestMap[selector] : null;
    },
  };
  return node;
}

function setupCatanQuiz({ seedLatestResponses } = {}) {
  const figureStore = { catanBoardIntro: { selection: null, selectionNumbers: null } };
  function getFigureValue(path) {
    const [id, ...rest] = path.split(".");
    let value = figureStore[id];
    for (const key of rest) {
      if (value === null || value === undefined) return undefined;
      value = value[key];
    }
    return value;
  }

  // catan_corner: a figure question whose control is the board itself.
  const wrapper1 = createNode({ classes: ["quiz-control"] });
  function applySelection(id) {
    // Stands in for the board's own setSelection()+notify(): update the
    // published value, then dispatch the bubbling "input" event the real
    // board fires from its root node.
    figureStore.catanBoardIntro = { selection: id, selectionNumbers: id === null ? null : [id] };
    wrapper1.dispatchEvent({ type: "input", bubbles: true });
  }
  const boardCalls = [];
  const boardNode = {
    quizResponse: {
      setValue(path, value) {
        if (path !== "selection") throw new Error("Unsupported Catan response: " + path);
        boardCalls.push(value);
        applySelection(value === null || value === undefined ? null : Number(value));
      },
    },
  };
  const liveLayer1 = createNode({ classes: ["interactive-figure-live"] });
  liveLayer1.firstElementChild = boardNode;
  const mount1 = createNode({
    dataset: { interactiveFigure: "catanBoardIntro" },
    select: { ":scope > .interactive-figure-live": liveLayer1 },
  });
  wrapper1.querySelectorAll = (selector) => (selector === "[data-interactive-figure]" ? [mount1] : []);

  const check1 = createNode();
  const clear1 = createNode();
  const actions1 = createNode({
    select: {
      "[data-quiz-action='check']": check1,
      "[data-quiz-action='hint']": createNode(),
      "[data-quiz-action='reveal']": createNode(),
      "[data-quiz-action='clear']": clear1,
    },
  });
  const feedbackLabel1 = createNode();
  const feedback1 = createNode({ select: { "[data-quiz-feedback-label]": feedbackLabel1 } });
  const item1 = createNode({
    dataset: { questionId: "catan_corner" },
    classes: ["quiz-question"],
    select: {
      ":scope > .quiz-control": wrapper1,
      ":scope > .quiz-actions": actions1,
      ":scope > .quiz-feedback": feedback1,
      ":scope > .quiz-hints-panel": createNode(),
      ":scope > .quiz-explanation-panel": createNode(),
      ":scope > .quiz-diagnostics": createNode(),
    },
  });
  wrapper1.parentNode = item1;

  // catan_settlement: a free-response question whose prompt reads
  // catanBoardIntro.selectionNumbers via promptFrom/promptTemplate.
  const textarea2 = createNode();
  const wrapper2 = createNode({ classes: ["quiz-control"], select: { textarea: textarea2 } });
  const actions2 = createNode({
    select: {
      "[data-quiz-action='check']": createNode(),
      "[data-quiz-action='hint']": createNode(),
      "[data-quiz-action='reveal']": createNode(),
      "[data-quiz-action='clear']": createNode(),
    },
  });
  const feedback2 = createNode({ select: { "[data-quiz-feedback-label]": createNode() } });
  const prompt2 = createNode();
  prompt2.innerHTML = "<p>Place your settlement by clicking a spot on the board above.</p>";
  const item2 = createNode({
    dataset: { questionId: "catan_settlement" },
    classes: ["quiz-question"],
    select: {
      ":scope > .quiz-control": wrapper2,
      ":scope > .quiz-actions": actions2,
      ":scope > .quiz-feedback": feedback2,
      ":scope > .quiz-hints-panel": createNode(),
      ":scope > .quiz-explanation-panel": createNode(),
      ":scope > .quiz-diagnostics": createNode(),
      ".quiz-prompt": prompt2,
    },
  });
  wrapper2.parentNode = item2;

  const body = createNode({ children: [item1, item2] });
  item1.parentNode = body;
  item2.parentNode = body;
  const section = createNode({
    select: { ":scope > .callout-body": body },
    closestMap: { "figure.quarto-float-quiz": null },
  });
  body.parentNode = section;

  const quizData = {
    id: "06_probability_catan",
    questions: [
      { id: "catan_corner", type: "figure", responseFrom: "catanBoardIntro.selection" },
      {
        id: "catan_settlement",
        type: "free-response",
        checkLabel: "Save response",
        promptFrom: "catanBoardIntro.selectionNumbers",
        promptTemplate: "You chose the {value} intersection. What made you go for that?",
      },
    ],
  };
  const script = createNode({ closestMap: { ".quiz": section } });
  script.textContent = JSON.stringify(quizData);

  const store = new Map();
  if (seedLatestResponses) {
    store.set("statisticsfromscratch.quizResponses", JSON.stringify(seedLatestResponses));
  }
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  };

  let ready;
  const documentListeners = new Map();
  const document = {
    documentElement: { dataset: {} },
    addEventListener(type, fn) {
      if (type === "DOMContentLoaded") { ready = fn; return; }
      if (!documentListeners.has(type)) documentListeners.set(type, new Set());
      documentListeners.get(type).add(fn);
    },
    dispatchEvent(event) {
      documentListeners.get(event.type)?.forEach((fn) => fn.call(document, event));
      return true;
    },
    querySelectorAll: (selector) => (selector === "script.quiz-data[type='application/json']" ? [script] : []),
  };
  section.parentNode = document; // terminates the bubble chain, like the real DOM

  const window = {
    localStorage,
    location: { pathname: "/06-probability.html" },
    interactiveRuntime: { getValue: getFigureValue, mountWithin() {} },
  };

  const errors = [];
  runInNewContext(runtime, {
    document, window, console: { error: (...args) => errors.push(args), warn() {}, log() {} }, JSON, Set,
    CustomEvent: function (type, options = {}) {
      return { type, bubbles: Boolean(options.bubbles), detail: options.detail };
    },
  });
  ready();

  return {
    errors,
    item1, check1, clear1, feedback1, feedbackLabel1,
    item2, textarea2, prompt2,
    applySelection, boardCalls, store,
  };
}

test("a figure question autosaves the reader's board selection and the Clear button routes through the board's quiz bridge", () => {
  const quiz = setupCatanQuiz();
  assert.deepEqual(quiz.errors, [], "quiz hydration threw");

  assert.equal(quiz.item1.dataset.quizState, undefined, "no selection yet");
  assert.equal(quiz.check1.hidden, true, "figure questions never show a check button");
  assert.equal(quiz.clear1.hidden, true);

  quiz.applySelection(7);

  assert.equal(quiz.item1.dataset.quizState, "neutral");
  assert.equal(quiz.feedbackLabel1.textContent, "Response saved.");
  assert.equal(quiz.clear1.hidden, false);
  const saved = JSON.parse(quiz.store.get("statisticsfromscratch.quizResponses"));
  assert.equal(saved["06_probability_catan:catan_corner"].response, 7);
  assert.deepEqual(quiz.boardCalls, [], "a direct board pick does not go through quizResponse");

  quiz.clear1.dispatchEvent({ type: "click" });

  assert.equal(quiz.item1.dataset.quizState, undefined);
  assert.equal(quiz.feedback1.hidden, true);
  assert.equal(quiz.clear1.hidden, true);
  assert.deepEqual(quiz.boardCalls, [null], "Clear asks the board to clear its selection");
  const clearedSaved = JSON.parse(quiz.store.get("statisticsfromscratch.quizResponses"));
  assert.equal(clearedSaved["06_probability_catan:catan_corner"], undefined);
});

test("promptFrom mirrors the board's selection into the free-response prompt and discards a stale saved response", () => {
  const quiz = setupCatanQuiz({
    seedLatestResponses: {
      "06_probability_catan:catan_settlement": {
        response: "top-left corner", correct: null, context: [9, 9, 9],
      },
    },
  });
  assert.deepEqual(quiz.errors, [], "quiz hydration threw");

  // The draft is preserved for editing, but a response written against a
  // different choice cannot count as already answered.
  assert.equal(quiz.textarea2.value, "top-left corner");
  assert.equal(quiz.item2.dataset.quizState, undefined);
  const afterRestore = JSON.parse(quiz.store.get("statisticsfromscratch.quizResponses"));
  assert.equal(afterRestore["06_probability_catan:catan_settlement"], undefined);

  assert.equal(quiz.prompt2.textContent, "");
  assert.match(quiz.prompt2.innerHTML, /Place your settlement/);

  quiz.applySelection(7);

  assert.equal(quiz.prompt2.textContent, "You chose the 7 intersection. What made you go for that?");
});
