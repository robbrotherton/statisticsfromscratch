import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(
  new URL("../resources/js/interactive-figure.js", import.meta.url),
  "utf8"
);

function loadInteractiveFigure(initialWidth = 720) {
  const frames = new Map();
  const observers = [];
  let nextFrame = 1;

  class FakeElement {
    constructor(width = 0) {
      this.width = width;
      this.dataset = {};
      this.events = [];
      this.styleValues = new Map();
      this.style = {
        setProperty: (name, value) => this.styleValues.set(name, value)
      };
    }
    getBoundingClientRect() {
      return { width: this.width };
    }
    dispatchEvent(event) {
      this.events.push(event);
    }
  }

  class FakeResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.target = null;
      this.disconnected = false;
      observers.push(this);
    }
    observe(target) {
      this.target = target;
    }
    disconnect() {
      this.disconnected = true;
    }
    resize(width) {
      this.target.width = width;
      this.callback([{
        target: this.target,
        contentRect: { width }
      }]);
    }
  }

  const root = new FakeElement(initialWidth);
  const container = new FakeElement(initialWidth);
  const context = {
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    Element: FakeElement,
    ResizeObserver: FakeResizeObserver,
    console,
    document: {
      getElementById() {
        return null;
      },
      createElement() {
        return new FakeElement();
      },
      head: {
        appendChild() {}
      }
    },
    matchMedia() {
      return { matches: false };
    },
    addEventListener() {},
    removeEventListener() {},
    requestAnimationFrame(callback) {
      const id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    }
  };
  context.window = context;
  vm.runInNewContext(source, context);

  return {
    api: context.interactiveFigure,
    root,
    container,
    observer: () => observers[0],
    flushFrames() {
      while (frames.size) {
        const pending = Array.from(frames.entries());
        frames.clear();
        pending.forEach(([, callback]) => callback());
      }
    }
  };
}

test("responsive layouts follow container width and dispose cleanly", () => {
  const loaded = loadInteractiveFigure(720);
  const layouts = [];
  const controller = loaded.api.observeResponsiveLayout({
    root: loaded.root,
    container: loaded.container,
    compactBelow: 560,
    minimumWidth: 280,
    maximumWidth: 760,
    widthStep: 4,
    onLayout(layout) {
      layouts.push({ ...layout });
    }
  });

  loaded.flushFrames();
  assert.equal(layouts.length, 1);
  assert.equal(layouts[0].mode, "wide");
  assert.equal(layouts[0].width, 720);
  assert.equal(loaded.root.dataset.bcLayout, "wide");

  loaded.observer().resize(390);
  loaded.flushFrames();
  assert.equal(layouts.length, 2);
  assert.equal(layouts[1].mode, "compact");
  assert.equal(layouts[1].width, 392);
  assert.equal(loaded.root.styleValues.get("--sfs-layout-width"), "392px");

  loaded.observer().resize(390);
  loaded.flushFrames();
  assert.equal(layouts.length, 2);

  controller.dispose();
  assert.equal(loaded.observer().disconnected, true);
});
