import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(
  new URL("../resources/js/anchor-navigation.js", import.meta.url),
  "utf8"
);

function createDom(initialHash = "") {
  const elements = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const frames = new Map();
  const scrolls = [];
  let nextFrame = 1;

  const location = new URL("https://example.test/chapter.html" + initialHash);
  const header = { clientHeight: 78 };
  const window = {
    location,
    scrollY: 0,
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, new Set());
      windowListeners.get(type).add(listener);
    },
    requestAnimationFrame(callback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    scrollTo(options) {
      scrolls.push(options);
      this.scrollY = options.top;
    }
  };
  window.window = window;

  const document = {
    readyState: "complete",
    baseURI: location.href,
    documentElement: {},
    addEventListener(type, listener) {
      if (!documentListeners.has(type)) documentListeners.set(type, new Set());
      documentListeners.get(type).add(listener);
    },
    querySelector(selector) {
      return selector === "header.fixed-top" ? header : null;
    },
    getElementById(id) {
      return elements.get(id) || null;
    }
  };
  window.document = document;

  function element(id, absoluteTop, kind = "plain") {
    const node = {
      id,
      kind,
      isConnected: true,
      heading: null,
      callout: null,
      matches(selector) {
        if (selector === ".tutorial-step") return this.kind === "step";
        if (selector === "section") return this.kind === "section";
        if (selector === "h1, h2, h3, h4, h5, h6") return this.kind === "heading";
        return false;
      },
      querySelector(selector) {
        return selector.startsWith(":scope > h1") ? this.heading : null;
      },
      closest(selector) {
        return selector === ".callout" ? this.callout : null;
      },
      getBoundingClientRect() {
        return { top: absoluteTop - window.scrollY };
      }
    };
    if (id) elements.set(id, node);
    return node;
  }

  const context = vm.createContext({
    URL,
    console,
    document,
    window,
    getComputedStyle() {
      return { fontSize: "16px" };
    }
  });
  context.globalThis = window;

  function link(hash) {
    const node = {
      href: new URL(hash, location.href).href,
      target: "",
      getAttribute(name) {
        return name === "href" ? hash : null;
      },
      hasAttribute() {
        return false;
      },
      closest(selector) {
        return selector === "a[href]" ? this : null;
      }
    };
    return node;
  }

  function flushFrames() {
    while (frames.size) {
      const pending = Array.from(frames.values());
      frames.clear();
      pending.forEach((callback) => callback());
    }
  }

  function clickHash(hash) {
    const target = link(hash);
    documentListeners.get("click")?.forEach((listener) => listener({
      target,
      button: 0,
      defaultPrevented: false,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false
    }));
  }

  return {
    context,
    document,
    element,
    flushFrames,
    clickHash,
    location,
    scrolls,
    window,
    run() {
      vm.runInContext(source, context);
    }
  };
}

test("same-hash clicks still realign callouts below the fixed header", () => {
  const dom = createDom("#act-median");
  const activity = dom.element("act-median", 900);
  dom.run();
  dom.flushFrames();

  assert.equal(dom.scrolls.at(-1).top, 822);

  // A repeated fragment does not emit hashchange. Emulate the browser's native
  // same-hash scroll, then let the click-scheduled correction run.
  dom.window.scrollY = 1400;
  dom.clickHash("#act-median");
  dom.window.scrollY = 900;
  dom.flushFrames();

  assert.equal(dom.scrolls.at(-1).top, 822);
  assert.equal(activity.getBoundingClientRect().top, 78);
});

test("tutorial step hashes align the complete activity, not hidden step text", () => {
  const dom = createDom();
  const callout = dom.element("act-median", 700);
  const step = dom.element("act-median-step-4", 1080, "step");
  step.callout = callout;
  dom.run();

  dom.clickHash("#act-median-step-4");
  dom.window.scrollY = 1080;
  dom.flushFrames();

  assert.equal(dom.scrolls.at(-1).top, 622);
  assert.equal(callout.getBoundingClientRect().top, 78);
});

test("heading navigation preserves its deliberate one-rem breathing room", () => {
  const dom = createDom();
  const section = dom.element("the-median", 500, "section");
  const heading = dom.element("", 500, "heading");
  section.heading = heading;
  dom.run();

  dom.context.window.bcAnchorNavigation.scrollTarget(section);

  assert.equal(dom.scrolls.at(-1).top, 406);
  assert.equal(heading.getBoundingClientRect().top, 94);
});
