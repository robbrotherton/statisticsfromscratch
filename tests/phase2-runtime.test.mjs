import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const runtimeSource = await readFile(
  new URL("../resources/js/interactive-runtime.js", import.meta.url),
  "utf8"
);

function loadRuntime({
  authored = false,
  capture = false,
  stored = false,
  system = false,
  prefersDark = false,
  liveTheme = true,
  seed = "",
  withNavbar = false,
  themeSentinel = null
} = {}) {
  const storedValues = new Map([
    ["sfs-reduce-motion", String(stored)]
  ]);
  if (themeSentinel !== null) {
    storedValues.set("quarto-color-scheme", themeSentinel);
  }
  const dispatched = [];
  let attributeObserver = null;
  let reloadCount = 0;
  let themeToggleCount = 0;
  const math = Object.create(Math);
  math.random = Math.random;

  class FakeClassList {
    constructor() {
      this.values = new Set();
    }
    add(...values) {
      values.forEach((value) => this.values.add(value));
    }
    remove(...values) {
      values.forEach((value) => this.values.delete(value));
    }
    contains(value) {
      return this.values.has(value);
    }
  }
  class FakeElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.children = [];
      this.classList = new FakeClassList();
      this.dataset = {};
      this.listeners = new Map();
      this.style = {
        setProperty() {}
      };
    }
    append(...children) {
      this.children.push(...children);
    }
    appendChild(child) {
      this.children.push(child);
      return child;
    }
    setAttribute(name, value) {
      this[name] = String(value);
    }
    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }
    dispatchEvent(event) {
      this.listeners.get(event.type)?.(event);
    }
    querySelectorAll() {
      return [];
    }
    matches() {
      return false;
    }
  }

  const documentElement = new FakeElement("html");
  documentElement.dataset = authored ? { motion: "reduced" } : {};
  const body = new FakeElement("body");
  body.classList.add(prefersDark ? "quarto-dark" : "quarto-light");
  const head = new FakeElement("head");
  const navbarTools = withNavbar ? new FakeElement("div") : null;
  const document = {
    documentElement,
    body,
    head,
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    createTextNode(text) {
      return { textContent: text };
    },
    getElementById() {
      return null;
    },
    querySelector(selector) {
      if (selector === ".quarto-navbar-tools") return navbarTools;
      return null;
    },
    querySelectorAll() {
      return [];
    },
    dispatchEvent(event) {
      dispatched.push(event);
    },
    fonts: {
      ready: Promise.resolve()
    }
  };
  const media = {
    matches: system,
    addEventListener() {}
  };
  const colorMedia = {
    matches: prefersDark,
    addEventListener() {}
  };
  const context = {
    AbortController,
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    Math: math,
    MutationObserver: class MutationObserver {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        attributeObserver = this;
      }
      disconnect() {}
    },
    URLSearchParams,
    console,
    document,
    location: {
      search: capture
        ? `?capture=1${seed ? `&captureSeed=${encodeURIComponent(seed)}` : ""}`
        : "",
      reload() {
        reloadCount += 1;
      }
    },
    localStorage: {
      getItem(key) {
        return storedValues.has(key) ? storedValues.get(key) : null;
      },
      setItem(key, value) {
        storedValues.set(key, value);
      },
      removeItem(key) {
        storedValues.delete(key);
      }
    },
    matchMedia(query) {
      return String(query).includes("prefers-color-scheme") ? colorMedia : media;
    },
    performance,
    requestAnimationFrame(callback) {
      return setTimeout(() => callback(performance.now()), 0);
    },
    setTimeout,
    clearTimeout
  };
  if (liveTheme) {
    // Stand-in for Quarto's own toggle: flips the body class and writes the
    // sentinel, exactly as the real one does.
    context.quartoToggleColorScheme = () => {
      themeToggleCount += 1;
      const toDark = !body.classList.contains("quarto-dark");
      body.classList.remove(toDark ? "quarto-light" : "quarto-dark");
      body.classList.add(toDark ? "quarto-dark" : "quarto-light");
      storedValues.set("quarto-color-scheme", toDark ? "alternate" : "default");
    };
  }
  context.window = context;
  vm.runInNewContext(runtimeSource, context);
  return {
    runtime: context.interactiveRuntime,
    context,
    documentElement,
    body,
    navbarTools,
    dispatched,
    storedValues,
    notifyAttributeChange() {
      attributeObserver?.callback([]);
    },
    getReloadCount() {
      return reloadCount;
    },
    getThemeToggleCount() {
      return themeToggleCount;
    }
  };
}

test("the OS preference remains a veto when the site preference is off", () => {
  const loaded = loadRuntime({ system: true, stored: false });
  assert.equal(loaded.runtime.motion.isReduced(), true);
  assert.equal(loaded.documentElement.dataset.motion, "reduced");

  loaded.runtime.motion.setUserReduced(false);
  assert.equal(loaded.runtime.motion.isReduced(), true);
});

test("the persisted reader setting forces reduced motion", () => {
  const loaded = loadRuntime({ stored: true });
  assert.equal(loaded.runtime.motion.isReduced(), true);

  loaded.runtime.motion.setUserReduced(false);
  assert.equal(loaded.runtime.motion.isReduced(), false);
  assert.equal(loaded.storedValues.get("sfs-reduce-motion"), "false");
  assert.equal(loaded.documentElement.dataset.motion, "full");
});

test("an authored data-motion attribute forces reduced motion", () => {
  const loaded = loadRuntime({ authored: true });
  loaded.runtime.motion.setUserReduced(false);
  assert.equal(loaded.runtime.motion.isReduced(), true);
});

test("a dynamic data-motion attribute updates the JavaScript policy", () => {
  const loaded = loadRuntime();
  assert.equal(loaded.runtime.motion.isReduced(), false);

  loaded.documentElement.dataset.motion = "reduced";
  loaded.notifyAttributeChange();
  assert.equal(loaded.runtime.motion.isReduced(), true);

  loaded.documentElement.dataset.motion = "full";
  loaded.notifyAttributeChange();
  assert.equal(loaded.runtime.motion.isReduced(), false);
});

test("capture mode forces reduced motion and repeatable random values", () => {
  const first = loadRuntime({ capture: true, seed: "chapter-04" });
  const second = loadRuntime({ capture: true, seed: "chapter-04" });
  const firstValues = Array.from({ length: 5 }, () => first.context.Math.random());
  const secondValues = Array.from({ length: 5 }, () => second.context.Math.random());

  assert.equal(first.runtime.capture.enabled, true);
  assert.equal(first.runtime.capture.width, 760);
  assert.equal(first.runtime.motion.isReduced(), true);
  assert.equal(first.documentElement.dataset.capture, "true");
  assert.deepEqual(firstValues, secondValues);
});

test("unknown readiness targets fail with an explicit contract error", async () => {
  const loaded = loadRuntime();
  await assert.rejects(
    loaded.runtime.whenReady("missing-figure"),
    /unknown figure id/
  );
});

function settingsMenu(loaded) {
  return loaded.navbarTools.children[0].children[1];
}

function themeSetting(loaded) {
  const field = settingsMenu(loaded).children[1];
  return {
    radios: field.children[1].children.map((row) => row.children[0]),
    help: field.children[2]
  };
}

function themeRadios(loaded) {
  return themeSetting(loaded).radios;
}

function motionSetting(loaded) {
  const field = settingsMenu(loaded).children[2];
  return { input: field.children[0].children[0], help: field.children[1] };
}

test("settings initialization builds theme radios and a motion checkbox without blocking figure mounting", () => {
  const loaded = loadRuntime({ withNavbar: true });
  assert.doesNotThrow(() => loaded.runtime.init());
  assert.equal(loaded.documentElement.classList.contains("sfs-settings-ready"), true);

  const theme = themeSetting(loaded);
  assert.deepEqual(theme.radios.map((input) => input.type), ["radio", "radio", "radio"]);
  assert.deepEqual(theme.radios.map((input) => input.value), ["system", "light", "dark"]);
  assert.deepEqual(theme.radios.map((input) => input.checked), [true, false, false]);
  assert.equal(theme.help.hidden, false);
  assert.match(theme.help.textContent, /device's light or dark mode/);

  const motionField = motionSetting(loaded);
  assert.equal(motionField.input.type, "checkbox");
  assert.equal(motionField.input.checked, false);
  assert.equal(motionField.help.id, "sfs-settings-reduce-motion-help");
  assert.match(motionField.help.textContent, /Animations may play/);
});

test("the motion note always describes the setting the reader is looking at", () => {
  const loaded = loadRuntime({ withNavbar: true });
  loaded.runtime.init();
  const motionField = motionSetting(loaded);

  motionField.input.checked = true;
  motionField.input.dispatchEvent({ type: "change" });
  assert.match(motionField.help.textContent, /jump directly/);

  const systemReduced = loadRuntime({ withNavbar: true, system: true });
  systemReduced.runtime.init();
  assert.match(motionSetting(systemReduced).help.textContent, /device setting/);
});

function chooseTheme(loaded, value) {
  const input = themeRadios(loaded).find((radio) => radio.value === value);
  input.checked = true;
  input.dispatchEvent({ type: "change" });
}

test("theme choices use Quarto's native sentinel and restore system mode", () => {
  const loaded = loadRuntime({ withNavbar: true });
  loaded.runtime.init();

  chooseTheme(loaded, "dark");
  assert.equal(loaded.storedValues.get("quarto-color-scheme"), "alternate");
  assert.equal(themeSetting(loaded).help.hidden, true);

  chooseTheme(loaded, "system");
  assert.equal(loaded.storedValues.has("quarto-color-scheme"), false);
  assert.equal(themeSetting(loaded).help.hidden, false);
});

test("switching theme repaints in place rather than reloading the page", () => {
  const loaded = loadRuntime({ withNavbar: true });
  loaded.runtime.init();

  chooseTheme(loaded, "dark");
  assert.equal(loaded.body.classList.contains("quarto-dark"), true);
  assert.equal(loaded.getThemeToggleCount(), 1);

  chooseTheme(loaded, "light");
  assert.equal(loaded.body.classList.contains("quarto-dark"), false);
  assert.equal(loaded.getThemeToggleCount(), 2);

  // Back to the device setting, which is light here: nothing to repaint.
  chooseTheme(loaded, "system");
  assert.equal(loaded.body.classList.contains("quarto-dark"), false);
  assert.equal(loaded.getThemeToggleCount(), 2);
  assert.equal(loaded.getReloadCount(), 0);
});

test("choosing system repaints to match a device that prefers dark", () => {
  const loaded = loadRuntime({ withNavbar: true, prefersDark: true });
  loaded.runtime.init();

  chooseTheme(loaded, "light");
  assert.equal(loaded.body.classList.contains("quarto-dark"), false);

  chooseTheme(loaded, "system");
  assert.equal(loaded.body.classList.contains("quarto-dark"), true);
  assert.equal(loaded.storedValues.has("quarto-color-scheme"), false);
  assert.equal(loaded.getReloadCount(), 0);
});

test("without Quarto's live toggle the theme choice still lands, via a reload", () => {
  const loaded = loadRuntime({ withNavbar: true, liveTheme: false });
  loaded.runtime.init();

  chooseTheme(loaded, "dark");
  assert.equal(loaded.storedValues.get("quarto-color-scheme"), "alternate");
  assert.equal(loaded.getReloadCount(), 1);
});
