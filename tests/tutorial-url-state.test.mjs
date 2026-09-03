import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(
  new URL("../resources/js/interactive-figure.js", import.meta.url),
  "utf8"
);

function createTutorialDom(initialHash = "") {
  class FakeClassList {
    constructor(owner) {
      this.owner = owner;
      this.tokens = new Set();
    }
    add(...names) {
      names.forEach((name) => this.tokens.add(name));
      this.owner._className = Array.from(this.tokens).join(" ");
    }
    remove(...names) {
      names.forEach((name) => this.tokens.delete(name));
      this.owner._className = Array.from(this.tokens).join(" ");
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
    constructor(tagName) {
      this.tagName = String(tagName || "div").toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.dataset = {};
      this.attributes = new Map();
      this.listeners = new Map();
      this.styleValues = new Map();
      this.style = {
        setProperty: (name, value) => this.styleValues.set(name, value),
        removeProperty: (name) => this.styleValues.delete(name)
      };
      this.classList = new FakeClassList(this);
      this._className = "";
      this.id = "";
      this.hidden = false;
      this.disabled = false;
      this.isConnected = false;
      this.clientHeight = 0;
      this.clientWidth = 500;
      this.scrollWidth = 500;
      this.rect = { width: 500, height: 200, top: 0, left: 0, right: 500, bottom: 200 };
      this.textContent = "";
      this.innerHTML = "";
      this.tabIndex = 0;
    }
    get className() {
      return this._className;
    }
    set className(value) {
      this._className = String(value || "");
      this.classList.tokens = new Set(this._className.split(/\s+/).filter(Boolean));
    }
    get firstChild() {
      return this.children[0] || null;
    }
    setAttribute(name, value) {
      const text = String(value);
      if (name === "class") {
        this.className = text;
        return;
      }
      if (name === "id") this.id = text;
      this.attributes.set(name, text);
    }
    getAttribute(name) {
      if (name === "class") return this.className;
      if (name === "id") return this.id || null;
      return this.attributes.has(name) ? this.attributes.get(name) : null;
    }
    removeAttribute(name) {
      if (name === "id") this.id = "";
      this.attributes.delete(name);
    }
    append(...nodes) {
      nodes.forEach((node) => {
        if (!node || typeof node !== "object") return;
        if (node.parentNode) node.remove();
        node.parentNode = this;
        node.isConnected = this.isConnected;
        this.children.push(node);
      });
    }
    appendChild(node) {
      this.append(node);
      return node;
    }
    prepend(...nodes) {
      nodes.slice().reverse().forEach((node) => this.insertBefore(node, this.firstChild));
    }
    insertBefore(node, reference) {
      if (node.parentNode) node.remove();
      const index = this.children.indexOf(reference);
      node.parentNode = this;
      node.isConnected = this.isConnected;
      this.children.splice(index < 0 ? this.children.length : index, 0, node);
      return node;
    }
    replaceChildren(...nodes) {
      this.children.forEach((node) => {
        node.parentNode = null;
        node.isConnected = false;
      });
      this.children = [];
      this.append(...nodes);
    }
    insertAdjacentHTML() {
      // Icon markup is immaterial to URL-state behavior.
    }
    remove() {
      if (!this.parentNode) return;
      const index = this.parentNode.children.indexOf(this);
      if (index >= 0) this.parentNode.children.splice(index, 1);
      this.parentNode = null;
      this.isConnected = false;
    }
    contains(node) {
      return node === this || this.children.some((child) => child.contains && child.contains(node));
    }
    matches(selector) {
      if (!selector) return false;
      if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
      const parts = selector.split(".");
      if (parts.length === 2) {
        return this.tagName === parts[0].toUpperCase() && this.classList.contains(parts[1]);
      }
      return this.tagName === selector.toUpperCase();
    }
    closest(selector) {
      let node = this;
      while (node) {
        if (node.matches && node.matches(selector)) return node;
        node = node.parentNode;
      }
      return null;
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
    getBoundingClientRect() {
      return { ...this.rect };
    }
    getAnimations() {
      return [];
    }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) {
      this.listeners.get(type)?.delete(listener);
    }
    dispatchEvent(event) {
      if (!event.target) event.target = this;
      event.currentTarget = this;
      this.listeners.get(event.type)?.forEach((listener) => listener.call(this, event));
      if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
      return true;
    }
    focus() {
      document.activeElement = this;
    }
  }

  class FakeEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.bubbles = Boolean(options.bubbles);
      this.defaultPrevented = false;
      this.target = null;
      this.currentTarget = null;
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
  }

  class FakeCustomEvent extends FakeEvent {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail;
    }
  }

  const documentListeners = new Map();
  const windowListeners = new Map();
  const frames = new Map();
  let nextFrame = 1;
  let currentUrl = new URL("https://book.test/03_central-tendency.html" + initialHash);
  const replacements = [];
  const scrolls = [];
  const warnings = [];

  const documentElement = new FakeElement("html");
  documentElement.isConnected = true;
  const head = new FakeElement("head");
  const body = new FakeElement("body");
  head.isConnected = true;
  body.isConnected = true;
  documentElement.append(head, body);

  const fixedHeader = new FakeElement("header");
  fixedHeader.className = "fixed-top";
  fixedHeader.clientHeight = 60;
  body.append(fixedHeader);

  const document = {
    documentElement,
    head,
    body,
    readyState: "complete",
    activeElement: null,
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementById(id) {
      const roots = [documentElement];
      while (roots.length) {
        const node = roots.shift();
        if (node.id === id) return node;
        roots.push(...node.children);
      }
      return null;
    },
    querySelector(selector) {
      if (fixedHeader.matches(selector)) return fixedHeader;
      return documentElement.querySelector(selector);
    },
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, new Set());
      documentListeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      documentListeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      documentListeners.get(event.type)?.forEach((listener) => listener.call(document, event));
      return true;
    }
  };

  const location = {
    get href() {
      return currentUrl.href;
    },
    get hash() {
      return currentUrl.hash;
    },
    get search() {
      return currentUrl.search;
    }
  };
  const history = {
    state: { preserved: true },
    length: 2,
    replaceState(state, _title, url) {
      this.state = state;
      currentUrl = new URL(url, currentUrl);
      replacements.push({ state, href: currentUrl.href });
    },
    pushState() {
      throw new Error("tutorial navigation must not push history entries");
    }
  };

  const window = {
    document,
    Element: FakeElement,
    Event: FakeEvent,
    CustomEvent: FakeCustomEvent,
    URL,
    AbortController,
    location,
    history,
    sessionStorage: {
      getItem() {
        return null;
      },
      setItem() {}
    },
    matchMedia() {
      return { matches: false };
    },
    getComputedStyle() {
      return { fontSize: "16px", marginTop: "0px", marginBottom: "0px" };
    },
    requestAnimationFrame(callback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set());
      windowListeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      windowListeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      windowListeners.get(event.type)?.forEach((listener) => listener.call(window, event));
      return true;
    },
    scrollY: 0,
    scrollTo(options) {
      scrolls.push(options);
      this.scrollY = options.top;
    }
  };
  window.window = window;

  const context = vm.createContext(Object.assign(window, {
    console: {
      log: console.log,
      error: console.error,
      warn(...args) {
        warnings.push(args);
      }
    },
    globalThis: window
  }));
  vm.runInContext(source, context);

  function connect(node) {
    node.isConnected = true;
    node.children.forEach(connect);
  }

  function makeTutorial(id = "act-median", { grouped = false } = {}) {
    const callout = new FakeElement("div");
    callout.className = "callout interactive";
    callout.id = id;
    callout.rect = { width: 500, height: 600, top: 500, left: 0, right: 500, bottom: 1100 };

    const calloutHeader = new FakeElement("div");
    calloutHeader.className = "callout-header";
    const bodyContainer = new FakeElement("div");
    bodyContainer.className = "callout-body-container";
    const root = new FakeElement("div");
    root.rect = { width: 500, height: 240, top: 560, left: 0, right: 500, bottom: 800 };
    const footer = new FakeElement("div");
    footer.className = "callout-footer";
    const steps = Array.from({ length: 5 }, (_value, index) => {
      const step = new FakeElement("div");
      step.className = "tutorial-step";
      step.dataset.title = "Step " + (index + 1);
      if (grouped) {
        step.dataset.major = index < 2 ? "opening" : "details";
        step.dataset.majorTitle = index < 2 ? "Opening" : "Details";
      }
      step.setAttribute("data-action", JSON.stringify({ value: index + 1, animate: true }));
      return step;
    });

    bodyContainer.append(root);
    footer.append(...steps);
    callout.append(calloutHeader, bodyContainer, footer);
    body.append(callout);
    connect(callout);
    return { callout, root, footer, steps };
  }

  function mountTutorial(id, options = {}) {
    const nodes = makeTutorial(id, options);
    const actions = [];
    const controller = context.interactiveFigure.createTutorial({
      root: nodes.root,
      footer: nodes.footer,
      steps: nodes.steps,
      applyAction(action, detail) {
        actions.push({ action: { ...action }, index: detail.index });
      }
    });
    return { ...nodes, controller, actions };
  }

  return {
    context,
    document,
    window,
    FakeEvent,
    replacements,
    scrolls,
    warnings,
    mountTutorial,
    flushFrames() {
      while (frames.size) {
        const pending = Array.from(frames.entries());
        frames.clear();
        pending.forEach(([, callback]) => callback());
      }
    },
    navigateHash(hash) {
      currentUrl.hash = hash;
      window.dispatchEvent(new FakeEvent("hashchange"));
    }
  };
}

test("a direct numbered hash restores the exact absolute substep without motion", () => {
  const dom = createTutorialDom("#act-median-step-4");
  const tutorial = dom.mountTutorial("act-median", { grouped: true });
  dom.flushFrames();

  assert.equal(tutorial.controller.getStep(), 3);
  assert.equal(tutorial.footer.dataset.tutorialStep, "3");
  assert.equal(tutorial.footer.dataset.tutorialId, "act-median");
  assert.deepEqual(
    tutorial.steps.map((step) => step.id),
    [1, 2, 3, 4, 5].map((step) => `act-median-step-${step}`)
  );
  assert.equal(tutorial.steps[3].hidden, false);
  assert.equal(tutorial.steps[2].hidden, true);
  assert.deepEqual(tutorial.actions.at(-1), {
    action: { value: 4, animate: false },
    index: 3
  });
  assert.equal(dom.scrolls.at(-1).top, 440, "the activity top clears the fixed navbar");
});

test("reader navigation replaces the URL without creating history entries", () => {
  const dom = createTutorialDom("#act-median");
  const tutorial = dom.mountTutorial("act-median");
  const initialHistoryLength = dom.window.history.length;
  const preservedState = dom.window.history.state;

  tutorial.callout.querySelector(".sfs-if-tutorial-next")
    .dispatchEvent(new dom.FakeEvent("click"));
  tutorial.callout.querySelector(".sfs-if-tutorial-next")
    .dispatchEvent(new dom.FakeEvent("click"));

  assert.equal(tutorial.controller.getStep(), 2);
  assert.equal(dom.window.location.hash, "#act-median-step-3");
  assert.equal(dom.window.history.length, initialHistoryLength);
  assert.equal(dom.replacements.length, 2);
  assert.equal(dom.replacements.at(-1).state, preservedState);

  const replacementsBeforeProgrammaticStep = dom.replacements.length;
  tutorial.controller.setStep(4);
  assert.equal(tutorial.controller.getStep(), 4);
  assert.equal(dom.replacements.length, replacementsBeforeProgrammaticStep);
});

test("incoming hashes restore matching tutorials, reject bad steps, and clean up", () => {
  const dom = createTutorialDom();
  const tutorial = dom.mountTutorial("act-median");

  dom.navigateHash("#act-median-step-5");
  dom.flushFrames();
  assert.equal(tutorial.controller.getStep(), 4);
  assert.equal(tutorial.actions.at(-1).action.animate, false);

  dom.navigateHash("#another-section");
  assert.equal(tutorial.controller.getStep(), 4, "unrelated hashes leave tutorial state alone");

  dom.navigateHash("#act-median-step-99");
  dom.flushFrames();
  assert.equal(tutorial.controller.getStep(), 4);
  assert.equal(dom.warnings.length, 1);

  dom.navigateHash("#act-median");
  dom.flushFrames();
  assert.equal(tutorial.controller.getStep(), 0);

  tutorial.root.sfsInteractive.dispose();
  dom.navigateHash("#act-median-step-3");
  assert.equal(tutorial.controller.getStep(), 0, "disposed tutorials stop observing URL changes");
});

test("an unlabelled tutorial remains fully interactive without claiming URL state", () => {
  const dom = createTutorialDom("#somewhere-else");
  const tutorial = dom.mountTutorial("");

  tutorial.callout.querySelector(".sfs-if-tutorial-next")
    .dispatchEvent(new dom.FakeEvent("click"));

  assert.equal(tutorial.controller.getStep(), 1);
  assert.equal(dom.window.location.hash, "#somewhere-else");
  assert.equal(dom.replacements.length, 0);
  assert.ok(tutorial.steps.every((step) => step.id === ""));
});
