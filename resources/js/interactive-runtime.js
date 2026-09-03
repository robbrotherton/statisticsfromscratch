(function(global) {
  "use strict";

  const MOTION_STORAGE_KEY = "sfs-reduce-motion";
  // A reader who set this under the old prefix keeps their choice; reduced
  // motion is an accessibility preference, not worth resetting on a rename.
  const LEGACY_MOTION_STORAGE_KEY = "bc-reduce-motion";
  const QUARTO_THEME_STORAGE_KEY = "quarto-color-scheme";
  const CAPTURE_SEED = 1101;
  const rootElement = document.documentElement;
  const query = new URLSearchParams(global.location.search);
  const captureMode = query.get("capture") === "1";
  const captureWidth = Math.max(
    320,
    Math.min(1600, Number(query.get("captureWidth")) || 760)
  );
  const authoredReducedMotion = rootElement.dataset.motion === "reduced";
  let attributeReducedMotion = authoredReducedMotion;
  let lastAppliedMotionAttribute = null;
  const systemMotionQuery = typeof global.matchMedia === "function"
    ? global.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

  const state = {
    initialized: false,
    values: {},
    figures: [],
    records: new WeakMap(),
    recordsById: new Map(),
    renderingDynamic: false,
    userReducedMotion: readStoredMotion(),
    reducedMotion: false,
    motionListeners: new Set()
  };

  function safeStorage() {
    try {
      return global.localStorage;
    } catch (error) {
      return null;
    }
  }

  function readStoredMotion() {
    const storage = safeStorage();
    if (!storage) return false;
    try {
      const stored = storage.getItem(MOTION_STORAGE_KEY);
      if (stored !== null) return stored === "true";
      return storage.getItem(LEGACY_MOTION_STORAGE_KEY) === "true";
    } catch (error) {
      return false;
    }
  }

  function writeStoredMotion(value) {
    const storage = safeStorage();
    if (!storage) return;
    try {
      storage.setItem(MOTION_STORAGE_KEY, String(Boolean(value)));
    } catch (error) {
      // Origin-local preferences are optional; the setting still works for
      // the current page when storage is unavailable.
    }
  }

  function createSeededRandom(seed) {
    let value = Number(seed) >>> 0;
    return function() {
      value += 0x6D2B79F5;
      let next = value;
      next = Math.imul(next ^ next >>> 15, next | 1);
      next ^= next + Math.imul(next ^ next >>> 7, next | 61);
      return ((next ^ next >>> 14) >>> 0) / 4294967296;
    };
  }

  function hashSeed(value) {
    const text = String(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  if (captureMode && !global.__bcOriginalRandom) {
    global.__bcOriginalRandom = Math.random;
    const seed = query.has("captureSeed")
      ? hashSeed(query.get("captureSeed"))
      : CAPTURE_SEED;
    Math.random = createSeededRandom(seed);
  }

  function calculateReducedMotion() {
    return captureMode ||
      attributeReducedMotion ||
      state.userReducedMotion ||
      Boolean(systemMotionQuery && systemMotionQuery.matches);
  }

  function applyMotionPolicy(notify) {
    const previous = state.reducedMotion;
    state.reducedMotion = calculateReducedMotion();
    lastAppliedMotionAttribute = state.reducedMotion ? "reduced" : "full";
    rootElement.dataset.motion = lastAppliedMotionAttribute;
    rootElement.dataset.capture = captureMode ? "true" : "false";
    if (captureMode) {
      rootElement.style.setProperty("--sfs-capture-width", captureWidth + "px");
    }

    // Backward compatibility for figures already checking this project-level
    // flag. It always reflects the effective policy, never only one source.
    global.sfsReducedMotion = state.reducedMotion;

    if (notify && previous !== state.reducedMotion) {
      const detail = motion.details();
      if (state.reducedMotion) {
        state.figures.forEach(function(figure) {
          const contract = figure.node && figure.node.sfsInteractive;
          const cancelMotion = contract &&
            (contract.cancelMotion || contract.cancel);
          if (typeof cancelMotion === "function") {
            try {
              cancelMotion.call(contract);
            } catch (error) {
              console.error("Could not cancel interactive motion:", error);
            }
          }
        });
      }
      state.motionListeners.forEach(function(listener) {
        try {
          listener(detail);
        } catch (error) {
          console.error("Reduced-motion listener failed:", error);
        }
      });
      document.dispatchEvent(new CustomEvent("sfs-motion:change", { detail }));
    }
  }

  const motion = {
    isReduced() {
      return state.reducedMotion;
    },
    shouldAnimate(requested) {
      return requested !== false && !state.reducedMotion;
    },
    duration(milliseconds, requested) {
      return motion.shouldAnimate(requested) ? Math.max(0, Number(milliseconds) || 0) : 0;
    },
    setUserReduced(value) {
      state.userReducedMotion = Boolean(value);
      writeStoredMotion(state.userReducedMotion);
      applyMotionPolicy(true);
    },
    getUserReduced() {
      return state.userReducedMotion;
    },
    details() {
      return {
        reduced: state.reducedMotion,
        capture: captureMode,
        authored: attributeReducedMotion,
        user: state.userReducedMotion,
        system: Boolean(systemMotionQuery && systemMotionQuery.matches)
      };
    },
    onChange(listener) {
      if (typeof listener !== "function") return function() {};
      state.motionListeners.add(listener);
      return function() {
        state.motionListeners.delete(listener);
      };
    }
  };

  applyMotionPolicy(false);
  if (typeof MutationObserver === "function") {
    const motionAttributeObserver = new MutationObserver(function() {
      const current = rootElement.dataset.motion;
      if (current === lastAppliedMotionAttribute) return;
      attributeReducedMotion = current === "reduced";
      applyMotionPolicy(true);
    });
    motionAttributeObserver.observe(rootElement, {
      attributes: true,
      attributeFilter: ["data-motion"]
    });
  }
  if (systemMotionQuery) {
    const handleSystemMotionChange = function() {
      applyMotionPolicy(true);
    };
    if (typeof systemMotionQuery.addEventListener === "function") {
      systemMotionQuery.addEventListener("change", handleSystemMotionChange);
    } else if (typeof systemMotionQuery.addListener === "function") {
      systemMotionQuery.addListener(handleSystemMotionChange);
    }
  }

  function ensureStyles() {
    if (document.getElementById("interactive-runtime-styles")) return;

    const style = document.createElement("style");
    style.id = "interactive-runtime-styles";
    style.textContent = `
      .interactive-figure-mount {
        margin: 1rem 0;
      }

      .interactive-figure-live:empty {
        display: none;
      }

      .interactive-figure-fallback {
        padding: 0.85rem 1rem;
        border: 1px solid var(--bs-border-color, #dee2e6);
        border-radius: 8px;
        background: var(--bs-tertiary-bg, #f8f9fa);
        color: var(--bs-secondary-color, #6c757d);
      }

      .interactive-figure-mount.is-mounted .interactive-figure-fallback {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function parseOptions(raw, id) {
    if (!raw || raw === "{}") return {};
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn("Could not parse interactive figure options for " + id + ":", error);
      return {};
    }
  }

  function resolveFactory(name) {
    if (!name) return null;
    return typeof global[name] === "function" ? global[name] : null;
  }

  function getPath(path) {
    if (!path) return undefined;
    const parts = String(path).split(".");
    if (!parts.length) return undefined;

    let value;
    if (Object.prototype.hasOwnProperty.call(state.values, parts[0])) {
      value = state.values[parts.shift()];
    } else {
      value = global[parts.shift()];
    }

    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }
    return value;
  }

  function formatValue(value, format, empty) {
    if (value === undefined || value === null || value === "") return empty;
    if (!format) return String(value);

    if (global.d3 && typeof global.d3.format === "function") {
      try {
        return global.d3.format(format)(value);
      } catch (error) {
        console.warn("Could not apply D3 format " + format + ":", error);
      }
    }

    const fixedMatch = String(format).match(/^\.(\d+)f$/);
    if (fixedMatch) {
      const number = Number(value);
      if (Number.isFinite(number)) return number.toFixed(Number(fixedMatch[1]));
    }

    return String(value);
  }

  function resolveTemplate(template) {
    return String(template).replace(/\$\{([^}]+)\}/g, function(match, path) {
      const value = getPath(path.trim());
      return value === undefined || value === null ? "" : String(value);
    });
  }

  function resolveRefs(value) {
    if (Array.isArray(value)) return value.map(resolveRefs);
    if (!value || typeof value !== "object") return value;

    if (Object.prototype.hasOwnProperty.call(value, "$value")) {
      return getPath(value.$value);
    }
    if (Object.prototype.hasOwnProperty.call(value, "$template")) {
      return resolveTemplate(value.$template);
    }

    const resolved = {};
    for (const key of Object.keys(value)) {
      resolved[key] = resolveRefs(value[key]);
    }
    return resolved;
  }

  function hasRefs(value) {
    if (Array.isArray(value)) return value.some(hasRefs);
    if (!value || typeof value !== "object") return false;
    if (Object.prototype.hasOwnProperty.call(value, "$value")) return true;
    if (Object.prototype.hasOwnProperty.call(value, "$template")) return true;
    return Object.keys(value).some(function(key) {
      return hasRefs(value[key]);
    });
  }

  function readValue(node) {
    if (node && Object.prototype.hasOwnProperty.call(node, "value")) {
      return node.value;
    }
    return undefined;
  }

  function updateFigureValue(figure) {
    const value = readValue(figure.node);
    if (value !== undefined) {
      state.values[figure.id] = value;
    }
  }

  function liveLayer(figure) {
    let live = figure.mount.querySelector(":scope > .interactive-figure-live");
    if (!live) {
      live = document.createElement("div");
      live.className = "interactive-figure-live";
      figure.mount.prepend(live);
    }
    return live;
  }

  function nextFrame() {
    return new Promise(function(resolve) {
      global.requestAnimationFrame(function() {
        resolve();
      });
    });
  }

  async function fontsReady() {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  }

  async function waitForSettled(element, options) {
    options = options || {};
    const timeout = Math.max(250, Number(options.timeout) || 5000);
    const quietFor = state.reducedMotion ? 32 : Math.max(50, Number(options.quietFor) || 120);
    const started = performance.now();
    let lastChange = started;
    let observer = null;

    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(function() {
        lastChange = performance.now();
      });
      observer.observe(element, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    try {
      await fontsReady();
      await nextFrame();
      await nextFrame();

      while (performance.now() - started < timeout) {
        const animations = typeof element.getAnimations === "function"
          ? element.getAnimations({ subtree: true }).filter(function(animation) {
              return animation.playState === "running" || animation.playState === "pending";
            })
          : [];
        if (!animations.length && performance.now() - lastChange >= quietFor) return;
        await new Promise(function(resolve) {
          global.setTimeout(resolve, state.reducedMotion ? 16 : 32);
        });
      }
    } finally {
      if (observer) observer.disconnect();
    }

    throw new Error("Interactive did not settle within " + timeout + "ms");
  }

  function makeReadinessError(figure, reason) {
    const error = new Error(
      "Interactive readiness unavailable for " + figure.id + ": " + reason
    );
    error.name = "InteractiveReadinessError";
    error.figureId = figure.id;
    return error;
  }

  function setReadiness(figure, status, error) {
    figure.readiness = status;
    figure.readinessError = error || null;
    figure.mount.dataset.interactiveReadiness = status;
  }

  async function settleFigure(figure, renderGeneration) {
    const expectedGeneration = renderGeneration === undefined
      ? figure.renderGeneration
      : renderGeneration;
    const contract = figure.node && figure.node.sfsInteractive;
    if (!contract || Number(contract.version) < 1) {
      if (figure.renderGeneration !== expectedGeneration) return;
      setReadiness(
        figure,
        "unsupported",
        makeReadinessError(figure, "the figure has not adopted contract version 1")
      );
      return;
    }

    setReadiness(figure, "pending");
    try {
      await fontsReady();
      if (typeof contract.whenReady === "function") {
        await contract.whenReady({
          capture: captureMode,
          motion: motion.details(),
          root: figure.node
        });
      }
      await waitForSettled(figure.node);
      if (figure.renderGeneration !== expectedGeneration) return;
      setReadiness(figure, "ready");
      figure.readyGeneration += 1;
      figure.mount.dispatchEvent(new CustomEvent("sfs-interactive:ready", {
        bubbles: true,
        detail: {
          id: figure.id,
          generation: figure.readyGeneration,
          capture: captureMode
        }
      }));
    } catch (error) {
      if (figure.renderGeneration !== expectedGeneration) return;
      setReadiness(figure, "error", error);
    }
  }

  function renderFigure(figure) {
    const factory = resolveFactory(figure.factoryName);
    if (!factory) {
      figure.error = new Error("Interactive figure factory not found: " + figure.factoryName);
      figure.mount.classList.add("has-interactive-error");
      setReadiness(figure, "error", figure.error);
      console.warn(figure.error.message);
      return;
    }

    try {
      const options = resolveRefs(figure.rawOptions);
      const node = factory(options);
      if (!node) return;

      const live = liveLayer(figure);
      const previousContract = figure.node && figure.node.sfsInteractive;
      const dispose = previousContract &&
        (previousContract.dispose || previousContract.cancel);
      if (typeof dispose === "function") {
        dispose.call(previousContract);
      }
      figure.renderGeneration += 1;
      const renderGeneration = figure.renderGeneration;
      live.replaceChildren(node);
      figure.mount.classList.add("is-mounted");
      figure.mount.classList.remove("has-interactive-error");
      figure.node = node;
      figure.error = null;
      updateFigureValue(figure);

      node.addEventListener("input", function() {
        updateFigureValue(figure);
        updateDynamicContent(figure);
      });
      settleFigure(figure, renderGeneration);
    } catch (error) {
      figure.error = error;
      figure.mount.classList.add("has-interactive-error");
      setReadiness(figure, "error", error);
      console.error(
        "Interactive figure failed: " + figure.id + " (" + figure.factoryName + ")",
        error
      );
    }
  }

  function updateInlineValues(root) {
    const scope = root && typeof root.querySelectorAll === "function" ? root : document;
    const elements = [];
    if (scope.matches && scope.matches("[data-interactive-value]")) {
      elements.push(scope);
    }
    scope.querySelectorAll("[data-interactive-value]").forEach(function(element) {
      elements.push(element);
    });

    elements.forEach(function(element) {
      const value = getPath(element.dataset.interactiveValue);
      const empty = element.dataset.interactiveEmpty || "";
      const formatted = formatValue(value, element.dataset.interactiveFormat || "", empty);

      if (element.dataset.interactiveMath === "true") {
        const prefix = element.dataset.interactivePrefix || "";
        const expression = [prefix, formatted].filter(Boolean).join(" ");
        const math = global.interactiveFigure &&
          typeof global.interactiveFigure.inlineMath === "function"
          ? global.interactiveFigure.inlineMath(expression)
          : document.createTextNode(expression);
        element.replaceChildren(math);
      } else {
        element.textContent = formatted;
      }
    });
  }

  function rerenderDynamicFigures(sourceFigure) {
    if (state.renderingDynamic) return;
    state.renderingDynamic = true;
    try {
      state.figures.forEach(function(figure) {
        if (!figure.dynamic || figure === sourceFigure) return;
        renderFigure(figure);
      });
    } finally {
      state.renderingDynamic = false;
    }
  }

  function updateDynamicContent(sourceFigure) {
    updateInlineValues(document);
    rerenderDynamicFigures(sourceFigure);
  }

  function figureMountsWithin(root) {
    const scope = root && typeof root.querySelectorAll === "function" ? root : document;
    const mounts = [];
    if (scope.matches && scope.matches("[data-interactive-figure]")) {
      mounts.push(scope);
    }
    scope.querySelectorAll("[data-interactive-figure]").forEach(function(mount) {
      mounts.push(mount);
    });
    return mounts;
  }

  function mountWithin(root) {
    ensureStyles();
    const mounted = [];

    figureMountsWithin(root).forEach(function(mount) {
      if (state.records.has(mount)) return;
      if (mount.closest("[hidden]")) return;

      const figure = {
        mount,
        id: mount.dataset.interactiveFigure,
        factoryName: mount.dataset.interactiveFactory,
        rawOptions: parseOptions(
          mount.dataset.interactiveOptions,
          mount.dataset.interactiveFigure
        ),
        dynamic: false,
        node: null,
        error: null,
        readiness: "pending",
        readinessError: null,
        readyGeneration: 0,
        renderGeneration: 0
      };
      figure.dynamic = hasRefs(figure.rawOptions);
      state.records.set(mount, figure);
      state.recordsById.set(figure.id, figure);
      state.figures.push(figure);
      renderFigure(figure);
      mounted.push(mount);
    });

    updateInlineValues(root || document);
    return mounted;
  }

  function recordForId(id) {
    return state.recordsById.get(String(id)) || null;
  }

  async function whenReady(id) {
    const figure = recordForId(id);
    if (!figure) {
      throw makeReadinessError({ id: String(id) }, "unknown figure id");
    }

    const started = performance.now();
    while (figure.readiness === "pending" && performance.now() - started < 6000) {
      await new Promise(function(resolve) {
        global.setTimeout(resolve, 16);
      });
    }

    if (figure.readiness !== "ready") {
      throw figure.readinessError ||
        makeReadinessError(figure, "readiness ended in state " + figure.readiness);
    }
    return figure.mount;
  }

  async function setTutorialStep(id, index) {
    const figure = recordForId(id);
    if (!figure || !figure.node) {
      throw makeReadinessError({ id: String(id) }, "unknown or unmounted figure id");
    }
    const contract = figure.node.sfsInteractive;
    if (!contract || typeof contract.setTutorialStep !== "function") {
      throw makeReadinessError(figure, "tutorial step control is unsupported");
    }

    setReadiness(figure, "pending");
    try {
      await contract.setTutorialStep(Number(index));
      await settleFigure(figure, figure.renderGeneration);
    } catch (error) {
      setReadiness(figure, "error", error);
    }
    return whenReady(id);
  }

  function alternateThemeIsDark() {
    const alternate = document.querySelector(
      'link#quarto-bootstrap.quarto-color-alternate'
    );
    return !alternate || alternate.dataset.mode !== "light";
  }

  function readThemePreference() {
    const storage = safeStorage();
    if (!storage) return "system";
    try {
      const sentinel = storage.getItem(QUARTO_THEME_STORAGE_KEY);
      if (sentinel === null) return "system";
      const alternate = sentinel === "alternate";
      return alternate === alternateThemeIsDark() ? "dark" : "light";
    } catch (error) {
      return "system";
    }
  }

  function systemPrefersDark() {
    if (typeof global.matchMedia !== "function") return false;
    return global.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function documentIsDark() {
    return document.body.classList.contains("quarto-dark");
  }

  function storeThemePreference(preference, wantsDark) {
    const storage = safeStorage();
    if (!storage) return;
    try {
      if (preference === "system") {
        // With no sentinel, Quarto follows the device setting from here on.
        storage.removeItem(QUARTO_THEME_STORAGE_KEY);
      } else {
        const useAlternate = wantsDark === alternateThemeIsDark();
        storage.setItem(
          QUARTO_THEME_STORAGE_KEY,
          useAlternate ? "alternate" : "default"
        );
      }
    } catch (error) {
      console.warn("Could not save the theme preference:", error);
    }
  }

  function writeThemePreference(preference) {
    const wantsDark = preference === "system"
      ? systemPrefersDark()
      : preference === "dark";
    // Quarto's own toggle swaps its stylesheets and flips the body class in
    // place, so the page repaints without a reload. It writes the sentinel
    // itself, which is why the preference is stored after the toggle runs.
    const switchesLive = typeof global.quartoToggleColorScheme === "function";
    if (switchesLive && documentIsDark() !== wantsDark) {
      global.quartoToggleColorScheme();
    }

    storeThemePreference(preference, wantsDark);

    if (!switchesLive) {
      global.location.reload();
    }
  }

  function makeCheckRow(input, labelText) {
    const row = document.createElement("div");
    row.className = "sfs-settings-check";

    const label = document.createElement("label");
    label.className = "sfs-settings-check-label";
    label.htmlFor = input.id;
    label.textContent = labelText;

    row.append(input, label);
    return row;
  }

  function makeThemeSetting() {
    const field = document.createElement("fieldset");
    field.className = "sfs-settings-field";

    const legend = document.createElement("legend");
    legend.className = "sfs-settings-field-label";
    legend.textContent = "Theme";
    field.appendChild(legend);

    const options = document.createElement("div");
    options.className = "sfs-settings-options";

    const help = document.createElement("div");
    help.className = "sfs-settings-help";
    help.id = "sfs-settings-theme-help";
    help.textContent = "Follows your device's light or dark mode.";

    const current = readThemePreference();
    [
      ["system", "System"],
      ["light", "Light"],
      ["dark", "Dark"]
    ].forEach(function(entry) {
      const input = document.createElement("input");
      input.className = "sfs-settings-input";
      input.type = "radio";
      input.name = "sfs-settings-theme";
      input.id = "sfs-settings-theme-" + entry[0];
      input.value = entry[0];
      input.checked = entry[0] === current;
      if (entry[0] === "system") {
        input.setAttribute("aria-describedby", help.id);
      }
      input.addEventListener("change", function() {
        if (input.checked) {
          // The note only describes the system option, and choosing another
          // reloads the page, so hide it before the reload rather than after.
          help.hidden = input.value !== "system";
          writeThemePreference(input.value);
        }
      });
      options.appendChild(makeCheckRow(input, entry[1]));
    });

    help.hidden = current !== "system";
    field.append(options, help);
    return field;
  }

  function makeCheckboxSetting(id, labelText, checked) {
    const field = document.createElement("div");
    field.className = "sfs-settings-field";

    const input = document.createElement("input");
    input.className = "sfs-settings-input";
    input.type = "checkbox";
    input.id = id;
    input.checked = Boolean(checked);

    const help = document.createElement("div");
    help.className = "sfs-settings-help";
    help.id = id + "-help";
    input.setAttribute("aria-describedby", help.id);

    field.append(makeCheckRow(input, labelText), help);
    return { field, input, help };
  }

  function initSettings() {
    if (document.querySelector(".sfs-settings")) {
      rootElement.classList.add("sfs-settings-ready");
      return;
    }
    const tools = document.querySelector(".quarto-navbar-tools");
    if (!tools) return;

    const settings = document.createElement("div");
    settings.className = "sfs-settings dropdown";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sfs-settings-button quarto-navigation-tool";
    button.setAttribute("data-bs-toggle", "dropdown");
    button.setAttribute("data-bs-auto-close", "outside");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "sfs-settings-menu");
    button.setAttribute("aria-label", "Reader settings");
    button.title = "Reader settings";
    button.innerHTML = '<i class="bi bi-gear" aria-hidden="true"></i>';

    const menu = document.createElement("div");
    menu.className = "dropdown-menu dropdown-menu-end sfs-settings-menu";
    menu.id = "sfs-settings-menu";
    menu.setAttribute("aria-label", "Reader settings");

    const heading = document.createElement("div");
    heading.className = "sfs-settings-heading";
    heading.textContent = "Settings";

    const themeSetting = makeThemeSetting();
    const motionCheckbox = makeCheckboxSetting(
      "sfs-settings-reduce-motion",
      "Reduce motion",
      state.userReducedMotion
    );
    menu.append(heading, themeSetting, motionCheckbox.field);
    settings.append(button, menu);
    tools.appendChild(settings);
    rootElement.classList.add("sfs-settings-ready");

    function updateMotionSetting() {
      const details = motion.details();
      motionCheckbox.input.checked = details.user;
      motionCheckbox.input.disabled = details.capture || details.authored;
      if (details.capture) {
        motionCheckbox.help.textContent = "Motion is locked off in capture mode.";
      } else if (details.authored) {
        motionCheckbox.help.textContent = "Motion is reduced for this page.";
      } else if (details.system) {
        motionCheckbox.help.textContent = details.user
          ? "Also reduced by your device setting."
          : "Your device setting is already reducing motion.";
      } else {
        motionCheckbox.help.textContent = details.user
          ? "Animations jump directly to the final state."
          : "Animations may play when they help explain a change.";
      }
    }

    motionCheckbox.input.addEventListener("change", function() {
      motion.setUserReduced(motionCheckbox.input.checked);
      updateMotionSetting();
    });

    motion.onChange(updateMotionSetting);
    updateMotionSetting();

  }

  function init() {
    if (state.initialized) {
      mountWithin(document);
      initSettings();
      return;
    }
    state.initialized = true;
    applyMotionPolicy(false);
    initSettings();
    mountWithin(document);
    updateDynamicContent(null);
  }

  const api = {
    init,
    mountWithin,
    values: state.values,
    getValue: getPath,
    update: updateDynamicContent,
    motion,
    capture: {
      enabled: captureMode,
      seed: query.get("captureSeed") || String(CAPTURE_SEED),
      width: captureWidth
    },
    createSeededRandom,
    seedFor(id) {
      return hashSeed(String(query.get("captureSeed") || CAPTURE_SEED) + ":" + String(id));
    },
    waitForSettled,
    whenReady,
    setTutorialStep
  };
  global.interactiveRuntime = api;
}(window));
