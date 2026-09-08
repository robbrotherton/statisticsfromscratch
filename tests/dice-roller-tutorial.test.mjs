import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// The build ships the bundle, not the source, so the tests drive the artifact
// the chapter actually loads.
const bundle = readFileSync(new URL("../resources/js/dice.bundle.js", import.meta.url), "utf8");
const figureSource = readFileSync(
  new URL("../resources/js/interactive-figure.js", import.meta.url),
  "utf8"
);
const manifest = readFileSync(new URL("../filters/interactive-scripts.lua", import.meta.url), "utf8");

// Keep the classroom demo’s deterministic simulation as a regression fixture.
const CHAPTER_SEED = "probability-dice-v1559";

// --------------------------------------------------------------- a tiny DOM
//
// Enough of a document for the roller to build itself. WebGL is absent, so
// the renderer throws on the first initialize() and the module falls back to
// simulated rolls -- which is the path these tests are about.

function createDom() {
  const styleSheets = [];

  class FakeClassList {
    constructor(owner) {
      this.owner = owner;
      this.tokens = new Set();
    }
    add(...names) {
      names.forEach((name) => this.tokens.add(name));
      this.owner.className = Array.from(this.tokens).join(" ");
    }
    remove(...names) {
      names.forEach((name) => this.tokens.delete(name));
      this.owner.className = Array.from(this.tokens).join(" ");
    }
    contains(name) {
      return this.tokens.has(name);
    }
    toggle(name, force) {
      const next = force === undefined ? !this.tokens.has(name) : Boolean(force);
      if (next) this.add(name);
      else this.remove(name);
      return next;
    }
  }

  class FakeElement {
    constructor(tag) {
      this.tagName = String(tag || "div").toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.attributes = new Map();
      this.dataset = {};
      this.style = { setProperty() {}, removeProperty() {} };
      this.listeners = new Map();
      this.textContent = "";
      this.hidden = false;
      this.classList = new FakeClassList(this);
      this.isConnected = false;
      this._className = "";
    }
    get className() {
      return this._className;
    }
    set className(value) {
      this._className = String(value || "");
      this.classList.tokens = new Set(this._className.split(/\s+/).filter(Boolean));
    }
    setAttribute(name, value) {
      if (name === "class") {
        this.className = value;
        return;
      }
      this.attributes.set(name, String(value));
    }
    getAttribute(name) {
      if (name === "class") return this.className;
      return this.attributes.has(name) ? this.attributes.get(name) : null;
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    append(...nodes) {
      nodes.forEach((node) => {
        if (typeof node !== "object") return;
        node.parentNode = this;
        this.children.push(node);
      });
    }
    appendChild(node) {
      this.append(node);
      return node;
    }
    insertBefore(node, reference) {
      const index = this.children.indexOf(reference);
      node.parentNode = this;
      this.children.splice(index < 0 ? 0 : index, 0, node);
      return node;
    }
    replaceChildren(...nodes) {
      this.children = [];
      this.append(...nodes);
    }
    remove() {
      if (!this.parentNode) return;
      const index = this.parentNode.children.indexOf(this);
      if (index >= 0) this.parentNode.children.splice(index, 1);
      this.parentNode = null;
    }
    contains(node) {
      if (node === this) return true;
      return this.children.some((child) => child.contains && child.contains(node));
    }
    closest() {
      return null;
    }
    matches(selector) {
      const wanted = selector.replace(/^\./, "");
      return this.classList.contains(wanted);
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
    querySelectorAll(selector) {
      const found = [];
      const walk = (node) => {
        node.children.forEach((child) => {
          if (child.matches && child.matches(selector)) found.push(child);
          walk(child);
        });
      };
      walk(this);
      return found;
    }
    getContext() {
      return null;
    }
    getBoundingClientRect() {
      return { width: 640, height: 260, top: 0, left: 0, right: 640, bottom: 260 };
    }
    getAnimations() {
      return [];
    }
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(handler);
    }
    removeEventListener(type, handler) {
      if (this.listeners.has(type)) this.listeners.get(type).delete(handler);
    }
    dispatchEvent(event) {
      event.target = event.target || this;
      let node = this;
      while (node) {
        const handlers = node.listeners.get(event.type);
        if (handlers) Array.from(handlers).forEach((handler) => handler.call(node, event));
        node = event.bubbles ? node.parentNode : null;
      }
      return true;
    }
  }

  // The roller labels its dice-count control with a text node, so the fake
  // document needs one. It only ever has to be appendable.
  class FakeText {
    constructor(data) {
      this.nodeType = 3;
      this.textContent = String(data);
      this.parentNode = null;
      this.children = [];
    }
    matches() {
      return false;
    }
    contains(node) {
      return node === this;
    }
  }

  class FakeEvent {
    constructor(type, options) {
      this.type = type;
      this.bubbles = Boolean(options && options.bubbles);
      this.target = null;
    }
  }

  class FakeCustomEvent extends FakeEvent {
    constructor(type, options) {
      super(type, options);
      this.detail = options ? options.detail : null;
    }
  }

  const head = new FakeElement("head");
  const document = {
    head,
    hidden: false,
    listeners: new Map(),
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (_ns, tag) => new FakeElement(tag),
    createTextNode: (data) => new FakeText(data),
    getElementById: (id) => styleSheets.find((sheet) => sheet.getAttribute("id") === id) || null,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    }
  };
  head.appendChild = function(node) {
    styleSheets.push(node);
    node.setAttribute("id", node.id || node.getAttribute("id") || "");
    return node;
  };

  const frames = [];
  const window = {
    document,
    Element: FakeElement,
    Event: FakeEvent,
    CustomEvent: FakeCustomEvent,
    innerWidth: 1000,
    innerHeight: 900,
    performance: { now: () => Date.now() },
    // Reduced motion, so every bulk fill takes the synchronous path and the
    // tests never depend on animation frames landing.
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    cancelAnimationFrame() {},
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: () => ({ marginTop: "0px", marginBottom: "0px" })
  };
  window.window = window;

  return { window, document, FakeElement, FakeText, FakeEvent, FakeCustomEvent, frames };
}

// Arrays built inside the vm carry that context's Array.prototype, so
// deepStrictEqual rejects them against host literals even when every element
// matches. Copy them into host arrays before comparing.
function plain(list) {
  return Array.from(list, (value) => (Array.isArray(value) ? plain(value) : value));
}

function loadRoller(options) {
  const dom = createDom();
  const context = vm.createContext(Object.assign(dom.window, {
    console,
    globalThis: dom.window
  }));
  vm.runInContext(figureSource, context);
  vm.runInContext(bundle, context);
  assert.equal(typeof context.makeDiceRoller, "function");
  const root = context.makeDiceRoller(Object.assign({ seed: CHAPTER_SEED }, options || {}));
  return { context, root, dom };
}

function apply(root, action) {
  root.diceApi.applyAction(action);
}

function histogramPath(root) {
  return root.querySelector(".dice-histogram-expected-shape").getAttribute("d");
}

// ------------------------------------------------------- absolute roll math

test("rolls is absolute: the total lands on the number the step names", () => {
  const { root } = loadRoller();
  const authored = [1, 60, 60, 1000, 1000000, 1000000, 1000000];

  const forward = authored.map((rolls) => {
    apply(root, { rolls, dice: 2, "show-expected": rolls === 1000000, animate: false });
    return root.value.rolls;
  });
  assert.deepEqual(forward, authored);

  const backward = [...authored].reverse().map((rolls) => {
    apply(root, { rolls, dice: 2, animate: false });
    return root.value.rolls;
  });
  assert.deepEqual(backward, [...authored].reverse());

  // Jumping around the stepper, including the big drops that have to reset
  // and refill rather than add.
  for (const rolls of [1000000, 1, 1000, 60, 1000000, 60, 1]) {
    apply(root, { rolls, dice: 2, animate: false });
    assert.equal(root.value.rolls, rolls);
    assert.equal(
      root.value.counts.reduce((total, count) => total + count, 0),
      rolls,
      "counts must always total the roll count"
    );
  }
});

test("a step that repeats the current total does not re-roll", () => {
  const { root } = loadRoller();
  apply(root, { rolls: 1000, dice: 2, animate: false });
  const first = root.value.counts.slice();
  apply(root, { rolls: 1000, dice: 2, "show-expected": true, animate: false });
  apply(root, { rolls: 1000, dice: 2, "show-expected": true, animate: false });
  assert.deepEqual(root.value.counts, first);
  assert.equal(root.diceApi.getState().bulkDrawn, 1000);
});

test("the same step shows the same histogram however the reader reached it", () => {
  const { root } = loadRoller();
  apply(root, { rolls: 60, dice: 2, animate: false });
  const direct = root.value.counts.slice();

  apply(root, { rolls: 1000000, dice: 2, animate: false });
  apply(root, { rolls: 60, dice: 2, animate: false });
  assert.deepEqual(root.value.counts, direct, "reached by stepping back");

  root.diceApi.reset();
  apply(root, { rolls: 60, dice: 2, animate: false });
  assert.deepEqual(root.value.counts, direct, "reached after a manual reset");

  apply(root, { reset: true, rolls: 60, dice: 2, animate: false });
  assert.deepEqual(root.value.counts, direct, "reached through an explicit reset action");
});

test("the seeded 60-roll classroom example preserves its counts", () => {
  const { root } = loadRoller();
  apply(root, { rolls: 60, dice: 2, animate: false });
  const counts = plain(root.value.counts);
  assert.deepEqual(counts.slice(2, 13), [1, 10, 2, 3, 10, 4, 13, 7, 7, 2, 1]);

  // The step text quotes these two directly, because they are the whole
  // point of the picture: the likeliest total barely showed up and a scarce
  // one ran away with it.
  assert.equal(counts[7], 4, "seven, expected ten times");
  assert.equal(counts[3], 10, "three, expected about three times");
});

test("a million rolls is fast and allocation-free enough to be instant", () => {
  const { root } = loadRoller();
  const started = process.hrtime.bigint();
  apply(root, { rolls: 1000000, dice: 2, animate: false });
  const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
  assert.equal(root.value.rolls, 1000000);
  assert.ok(elapsed < 500, `a million rolls took ${elapsed.toFixed(1)}ms`);
});

// ------------------------------------------------------------- the overlay

test("the overlay is the theoretical distribution, for one to five dice", () => {
  const { root } = loadRoller();

  for (const dice of [1, 2, 3, 4, 5]) {
    apply(root, { dice, rolls: 7776, "show-expected": true, animate: false });
    const value = root.value;
    assert.equal(value.numberOfDice, dice);
    assert.equal(value.minimumSum, dice);
    assert.equal(value.maximumSum, dice * 6);

    const probabilities = value.probabilities.slice(dice, dice * 6 + 1);
    const total = probabilities.reduce((sum, p) => sum + p, 0);
    assert.ok(Math.abs(total - 1) < 1e-12, `${dice} dice probabilities sum to ${total}`);

    const expected = value.expected.slice(dice, dice * 6 + 1);
    const expectedTotal = expected.reduce((sum, count) => sum + count, 0);
    assert.ok(Math.abs(expectedTotal - 7776) < 1e-6);

    // The outline draws one flat run per sum, joined by risers.
    const path = histogramPath(root);
    const commands = (path.match(/[ML]/g) || []).length;
    assert.equal(commands, (dice * 5 + 1) * 2, `${dice} dice outline segments`);
  }

  // Two dice must still be exactly n * ways / 36.
  apply(root, { dice: 2, rolls: 3600, "show-expected": true, animate: false });
  const expected = root.value.expected;
  for (let sum = 2; sum <= 12; sum += 1) {
    assert.equal(expected[sum], 3600 * (6 - Math.abs(sum - 7)) / 36);
  }

  // Three dice come from the convolution, not the two-dice formula.
  apply(root, { dice: 3, rolls: 216, "show-expected": true, animate: false });
  assert.deepEqual(plain(root.value.expected.slice(3, 19)).map(Math.round),
    [1, 3, 6, 10, 15, 21, 25, 27, 27, 25, 21, 15, 10, 6, 3, 1]);
});

test("show-expected is absolute and reversible", () => {
  const { root } = loadRoller();
  const layer = root.querySelector(".dice-histogram-expected");
  const legend = root.querySelector(".dice-histogram-legend");

  apply(root, { rolls: 60, dice: 2, "show-expected": false, animate: false });
  assert.equal(root.value.showExpected, false);
  assert.equal(layer.classList.contains("is-visible"), false);
  assert.equal(legend.hidden, true);

  apply(root, { rolls: 60, dice: 2, "show-expected": true, animate: false });
  assert.equal(root.value.showExpected, true);
  assert.equal(layer.classList.contains("is-visible"), true);
  assert.equal(legend.hidden, false);
  assert.match(legend.children.map((child) => child.textContent).join(" "), /36 equally likely outcomes/);

  apply(root, { rolls: 60, dice: 2, "show-expected": false, animate: false });
  assert.equal(layer.classList.contains("is-visible"), false);
});

test("root.value keeps its original fields and adds the new ones", () => {
  const { root } = loadRoller();
  apply(root, { rolls: 60, dice: 2, "show-expected": true, animate: false });
  const value = root.value;
  for (const key of ["numberOfDice", "counts", "rolls", "outcomes", "sum", "rolling"]) {
    assert.ok(Object.hasOwn(value, key), `value.${key} must survive`);
  }
  for (const key of ["expected", "probabilities", "showExpected", "minimumSum", "maximumSum",
    "worstSum", "worstGap"]) {
    assert.ok(Object.hasOwn(value, key), `value.${key} must be exposed`);
  }
  assert.equal(value.counts.length, 13);
  assert.equal(value.expected.length, 13);
  assert.equal(typeof value.worstSum, "number");
});

test("the imperative API drives the same paths as the tutorial", () => {
  const { root } = loadRoller();
  assert.equal(typeof root.diceApi.roll, "function");
  assert.equal(typeof root.diceApi.add, "function");
  assert.equal(typeof root.diceApi.setRolls, "function");
  assert.equal(typeof root.diceApi.reset, "function");
  assert.equal(typeof root.diceApi.setDiceCount, "function");

  root.diceApi.setDiceCount(3);
  assert.equal(root.value.numberOfDice, 3);
  root.diceApi.setRolls(500, { animate: false, physical: false });
  assert.equal(root.value.rolls, 500);
  root.diceApi.add(250, { animate: false });
  assert.equal(root.value.rolls, 750);
  root.diceApi.reset();
  assert.equal(root.value.rolls, 0);
  assert.deepEqual(plain(root.diceApi.expectedCounts(36, 2).slice(2, 13)), [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]);
});

// ------------------------------------------------- observeTutorialActions

function tutorialDom() {
  const { window, FakeElement, FakeCustomEvent } = createDom();
  const context = vm.createContext(Object.assign(window, { console }));
  vm.runInContext(figureSource, context);

  const callout = new FakeElement("div");
  callout.className = "callout interactive";
  callout.isConnected = true;
  const claiming = new FakeElement("div");
  const listening = new FakeElement("div");
  callout.append(claiming, listening);
  [claiming, listening].forEach((node) => {
    node.isConnected = true;
    node.closest = (selector) => (selector === ".callout" ? callout : null);
  });

  return { context, callout, claiming, listening, FakeCustomEvent };
}

test("a second figure in the callout hears the claiming figure's steps", () => {
  const { context, claiming, listening, FakeCustomEvent } = tutorialDom();
  const heard = [];
  const stop = context.interactiveFigure.observeTutorialActions(listening, (action, detail) => {
    heard.push({ action, index: detail.index });
  });

  claiming.dispatchEvent(new FakeCustomEvent("sfs-if:tutorial-step-action", {
    bubbles: true,
    detail: { action: { rolls: 60, "show-board": true }, index: 2 }
  }));
  assert.equal(heard.length, 1);
  assert.deepEqual(heard[0], { action: { rolls: 60, "show-board": true }, index: 2 });

  stop();
  claiming.dispatchEvent(new FakeCustomEvent("sfs-if:tutorial-step-action", {
    bubbles: true,
    detail: { action: { rolls: 1000 }, index: 3 }
  }));
  assert.equal(heard.length, 1, "unsubscribing must stop delivery");
});

test("the observer ignores its own events unless it asks for them", () => {
  const { context, listening, FakeCustomEvent } = tutorialDom();
  const quiet = [];
  const loud = [];
  context.interactiveFigure.observeTutorialActions(listening, (action) => quiet.push(action));
  context.interactiveFigure.observeTutorialActions(listening, (action) => loud.push(action),
    { includeSelf: true });

  listening.dispatchEvent(new FakeCustomEvent("sfs-if:tutorial-step-action", {
    bubbles: true,
    detail: { action: { rolls: 1 }, index: 0 }
  }));
  assert.equal(quiet.length, 0);
  assert.equal(loud.length, 1);
});

test("observing survives a figure that is not in the document yet", () => {
  const { context, callout, claiming, FakeCustomEvent } = tutorialDom();
  const late = new context.Element("div");
  late.isConnected = false;
  late.closest = (selector) => (selector === ".callout" ? callout : null);
  callout.append(late);

  const heard = [];
  const stop = context.interactiveFigure.observeTutorialActions(late, (action) => heard.push(action));
  claiming.dispatchEvent(new FakeCustomEvent("sfs-if:tutorial-step-action", {
    bubbles: true, detail: { action: { rolls: 1 }, index: 0 }
  }));
  assert.equal(heard.length, 0, "nothing is delivered before the figure is connected");

  // The runtime inserts the figure; the retry frame then attaches.
  late.isConnected = true;
  context.frames = null;
  assert.equal(typeof stop, "function");
});

// --------------------------------------------------------------- wiring

test("the dice bundle carries the tutorial contract and loads the figure tools", () => {
  assert.match(manifest, /\["dice-cover"\][\s\S]*?deps = \{ "interactive-figure-tools" \}/);
  for (const marker of ["diceApi", "show-expected", "controls-open",
    "dice-histogram-expected-shape", "observeTutorialActions"]) {
    assert.ok(bundle.includes(marker) || figureSource.includes(marker),
      `built bundle should carry ${marker}`);
  }
  assert.ok(bundle.includes("diceApi"), "the built bundle must be rebuilt after editing dice-cover.js");
});
