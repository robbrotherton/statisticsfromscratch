(function() {
  const api = window.interactiveFigure || {};
  let nextId = api.nextId || 1;

  // The round Next arrow hints at itself until the reader drives a tutorial;
  // see the .is-hinting rules in site-theme.css for the effect itself. Being
  // found is recorded once for the whole site rather than per figure: a
  // chapter can carry five tutorials, and pinging on each one after the reader
  // has already stepped through the first is nagging, not teaching.
  // sessionStorage carries that across chapters but re-arms on a fresh visit,
  // which is about the right half-life for "you know how these work".
  const HINT_SPENT_KEY = "sfs-if-tutorial-hint-spent";
  const HINT_SPENT_EVENT = "sfs-if:tutorial-hint-spent";

  let hintSpent = false;
  try {
    hintSpent = window.sessionStorage.getItem(HINT_SPENT_KEY) === "1";
  } catch (error) {
    // Storage can be denied outright (private mode, blocked cookies). The
    // hint just re-arms on each page load then, which is no worse than before.
  }

  function spendTutorialHint() {
    if (hintSpent) return;
    hintSpent = true;
    try {
      window.sessionStorage.setItem(HINT_SPENT_KEY, "1");
    } catch (error) {
      // See above.
    }
    // Tutorials further down the page are already mounted and watching.
    document.dispatchEvent(new CustomEvent(HINT_SPENT_EVENT));
  }

  api.ensureStyles = function() {
    if (document.getElementById("sfs-interactive-figure-styles")) return;

    const style = document.createElement("style");
    style.id = "sfs-interactive-figure-styles";
    style.textContent = `
      .sfs-if-root {
        position: relative;
      }

      .sfs-if-toolbar {
        display: flex;
        justify-content: flex-end;
        min-height: 2rem;
        margin-bottom: 0.35rem;
      }

      .sfs-if-toolbar:empty {
        display: none;
      }

      .sfs-if-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: auto;
        height: auto;
        padding: 0 0.1rem;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        line-height: 1;
      }

      .sfs-if-toggle:hover,
      .sfs-if-toggle:focus-visible {
        color: var(--bs-primary, currentColor);
        background: transparent;
      }

      .sfs-if-toggle:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }

      .sfs-if-toggle .bi {
        display: block;
        font-size: 1em;
        line-height: 1;
      }

      .sfs-if-toggle .bi::before {
        vertical-align: 0;
      }

      .callout-header .sfs-if-toggle {
        flex: 0 0 auto;
        align-self: center;
        margin-left: 0.5rem;
      }

      .sfs-if-controls {
        --sfs-if-controls-bg: var(--sfs-control-bg, var(--bs-tertiary-bg, #f1f3f5));
        --sfs-if-controls-padding-block: 0.8rem;
        --sfs-if-controls-padding-inline: 0.85rem;
        margin-bottom: 0.75rem;
        padding: 0 var(--sfs-if-controls-padding-inline);
        border-radius: 8px;
        background: var(--sfs-if-controls-bg);
        box-sizing: border-box;
        overflow: hidden;
        transition:
          max-height 240ms ease,
          margin-bottom 240ms ease;
      }

      /* Vertical padding lives on spacer pseudo-rows, not the box itself:
         a border-box height floors at its own padding, so real padding
         would leave a visible stub when max-height collapses the drawer. */
      .sfs-if-controls::before,
      .sfs-if-controls::after {
        content: "";
        display: block;
        height: var(--sfs-if-controls-padding-block);
      }

      .sfs-if-controls.sfs-if-control-grid::before,
      .sfs-if-controls.sfs-if-control-grid::after {
        grid-column: 1 / -1;
        height: max(0px, calc(var(--sfs-if-controls-padding-block) - var(--sfs-if-control-gap)));
      }

      .sfs-if-controls[hidden] {
        display: none !important;
      }

      .sfs-if-control-grid {
        --sfs-if-control-gap: 0.8rem;
        --sfs-if-divider-color: var(--sfs-border, var(--bs-border-color, #dee2e6));
        display: grid;
        gap: var(--sfs-if-control-gap);
        align-items: start;
      }

      .sfs-if-control-grid[data-layout="quarter-half-quarter"] {
        grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr);
      }

      .sfs-if-control-grid[data-layout="equal"] {
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
      }

      .sfs-if-control-panel {
        position: relative;
        min-width: 0;
      }

      .sfs-if-control-grid[data-dividers="true"] > .sfs-if-control-panel + .sfs-if-control-panel::before {
        content: "";
        position: absolute;
        top: 0.15rem;
        bottom: 0.15rem;
        left: calc(var(--sfs-if-control-gap) / -2);
        width: 1px;
        background: var(--sfs-if-divider-color);
        pointer-events: none;
        transform: translateX(-0.5px);
      }

      @media (max-width: 760px) {
        .sfs-if-control-grid[data-layout] {
          grid-template-columns: 1fr;
        }

        .sfs-if-control-grid[data-dividers="true"] > .sfs-if-control-panel + .sfs-if-control-panel::before {
          top: calc(var(--sfs-if-control-gap) / -2);
          right: 0;
          bottom: auto;
          left: 0;
          width: auto;
          height: 1px;
          transform: translateY(-0.5px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .sfs-if-controls {
          transition: none !important;
        }
      }

      html[data-motion="reduced"] .sfs-if-controls {
        transition: none !important;
      }

      .sfs-if-reveal {
        opacity: 0;
        pointer-events: none;
        transition:
          opacity var(--sfs-if-reveal-duration, 280ms) ease,
          visibility 0s linear var(--sfs-if-reveal-duration, 280ms);
        visibility: hidden;
      }

      .sfs-if-reveal.is-visible {
        opacity: var(--sfs-if-reveal-opacity, 1);
        transition-delay: 0s;
        visibility: visible;
      }

      .sfs-if-no-reveal-animation .sfs-if-reveal,
      .sfs-if-reveal.sfs-if-no-reveal-animation {
        transition: none !important;
      }

      .sfs-if-inline-math {
        white-space: nowrap;
      }

      @media (prefers-reduced-motion: reduce) {
        .sfs-if-reveal {
          transition: none !important;
        }
      }

      html[data-motion="reduced"] .sfs-if-reveal {
        transition: none !important;
      }

    `;
    document.head.appendChild(style);
  };

  function targetElements(targets) {
    if (!targets) return [];

    if (Array.isArray(targets)) {
      return targets.flatMap(targetElements);
    }

    if (typeof Element !== "undefined" && targets instanceof Element) {
      return [targets];
    }

    if (typeof targets.nodes === "function") {
      return targets.nodes().filter(Boolean);
    }

    if (typeof targets.node === "function") {
      const node = targets.node();
      return node ? [node] : [];
    }

    if (typeof NodeList !== "undefined" && targets instanceof NodeList) {
      return Array.from(targets);
    }

    if (typeof HTMLCollection !== "undefined" && targets instanceof HTMLCollection) {
      return Array.from(targets);
    }

    return [];
  }

  function targetElement(target) {
    return targetElements(target)[0] || null;
  }

  function motionAllows(requested) {
    const runtime = window.interactiveRuntime;
    if (runtime && runtime.motion && typeof runtime.motion.shouldAnimate === "function") {
      return runtime.motion.shouldAnimate(requested);
    }
    return requested !== false && !(window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  api.cancelTransitions = function(root) {
    if (!root) return;

    root.dispatchEvent(new CustomEvent("sfs-if:cancel-transitions", {
      bubbles: true
    }));

    if (typeof root.getAnimations === "function") {
      root.getAnimations({ subtree: true }).forEach(function(animation) {
        animation.cancel();
      });
    }

    if (window.d3 && typeof window.d3.select === "function") {
      try {
        window.d3.select(root).interrupt();
        window.d3.select(root).selectAll("*").interrupt();
      } catch (error) {
        // A figure may load a partial D3 build without transition support.
      }
    }
  };

  api.adopt = function(root, contract) {
    if (!root) return null;
    const previous = root.bcInteractive || {};
    const next = Object.assign({}, contract || {});
    ["cancelMotion", "dispose"].forEach(function(method) {
      if (typeof previous[method] !== "function" || typeof next[method] !== "function") return;
      const previousMethod = previous[method];
      const nextMethod = next[method];
      next[method] = function() {
        previousMethod();
        nextMethod();
      };
    });
    root.bcInteractive = Object.assign({}, previous, next, {
      version: 1
    });
    return root.bcInteractive;
  };

  api.observeResponsiveLayout = function(opts) {
    opts = opts || {};
    const root = targetElement(opts.root);
    const container = targetElement(opts.container) || root;
    const onLayout = opts.onLayout;
    if (!root || !container || typeof onLayout !== "function") return null;

    const compactBelow = Math.max(1, Number(opts.compactBelow) || 560);
    const minimumWidth = Math.max(1, Number(opts.minimumWidth) || 280);
    const maximumWidth = Math.max(minimumWidth, Number(opts.maximumWidth) || 1600);
    const widthStep = Math.max(1, Number(opts.widthStep) || 1);
    const retryLimit = Math.max(1, Number(opts.retryLimit) || 120);
    let frame = null;
    let retryFrame = null;
    let retries = 0;
    let pendingWidth = null;
    let forceNext = true;
    let currentLayout = null;
    let currentKey = null;
    let disposed = false;
    let observer = null;

    function measuredWidth() {
      const rect = container.getBoundingClientRect();
      return Number(rect && rect.width) || 0;
    }

    function normalizedWidth(availableWidth) {
      const constrained = Math.max(
        minimumWidth,
        Math.min(maximumWidth, availableWidth)
      );
      return Math.max(
        minimumWidth,
        Math.min(maximumWidth, Math.round(constrained / widthStep) * widthStep)
      );
    }

    function defaultMode(availableWidth) {
      return availableWidth < compactBelow ? "compact" : "wide";
    }

    function layoutFor(availableWidth) {
      const width = normalizedWidth(availableWidth);
      const defaultLayout = {
        availableWidth,
        width,
        compact: availableWidth < compactBelow,
        mode: defaultMode(availableWidth)
      };
      const requested = typeof opts.layout === "function"
        ? opts.layout(Object.assign({}, defaultLayout), currentLayout)
        : null;
      const layout = Object.assign({}, defaultLayout, requested || {});
      layout.availableWidth = availableWidth;
      layout.width = Math.max(1, Number(layout.width) || width);
      layout.mode = String(layout.mode || (layout.compact ? "compact" : "wide"));
      layout.compact = layout.mode === "compact";
      return layout;
    }

    function keyFor(layout) {
      if (typeof opts.key === "function") return String(opts.key(layout));
      return [
        Math.round(layout.availableWidth * 10) / 10,
        Math.round(layout.width * 10) / 10,
        Number.isFinite(Number(layout.height))
          ? Math.round(Number(layout.height) * 10) / 10
          : "",
        layout.mode
      ].join(":");
    }

    function retryWhenConnected() {
      if (disposed || retryFrame !== null || retries >= retryLimit) return;
      retries += 1;
      retryFrame = window.requestAnimationFrame(function() {
        retryFrame = null;
        schedule(null, true);
      });
    }

    function applyPending() {
      frame = null;
      if (disposed) return;
      const availableWidth = Number(pendingWidth) > 0
        ? Number(pendingWidth)
        : measuredWidth();
      pendingWidth = null;
      if (!(availableWidth > 0)) {
        retryWhenConnected();
        return;
      }

      retries = 0;
      const layout = layoutFor(availableWidth);
      const nextKey = keyFor(layout);
      const force = forceNext;
      forceNext = false;
      if (!force && nextKey === currentKey) return;

      const previous = currentLayout;
      currentLayout = layout;
      currentKey = nextKey;
      root.dataset.bcLayout = layout.mode;
      root.style.setProperty("--sfs-layout-width", layout.width + "px");
      root.style.setProperty("--sfs-layout-available-width", availableWidth + "px");
      onLayout(layout, previous);
      root.dispatchEvent(new CustomEvent("sfs-if:responsive-layout", {
        bubbles: true,
        detail: { layout, previous }
      }));
    }

    function schedule(width, force) {
      if (disposed) return;
      if (Number(width) > 0) pendingWidth = Number(width);
      forceNext = forceNext || Boolean(force);
      if (frame !== null) return;
      frame = window.requestAnimationFrame(applyPending);
    }

    function handleWindowResize() {
      schedule(null, false);
    }

    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(function(entries) {
        const entry = entries.find(function(candidate) {
          return candidate.target === container;
        }) || entries[0];
        const width = entry && entry.contentRect
          ? Number(entry.contentRect.width)
          : 0;
        schedule(width, false);
      });
      observer.observe(container);
    } else {
      window.addEventListener("resize", handleWindowResize);
    }

    const controller = {
      refresh(force) {
        schedule(null, force !== false);
      },
      getLayout() {
        return currentLayout ? Object.assign({}, currentLayout) : null;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        if (frame !== null) window.cancelAnimationFrame(frame);
        if (retryFrame !== null) window.cancelAnimationFrame(retryFrame);
        frame = null;
        retryFrame = null;
        if (observer) observer.disconnect();
        window.removeEventListener("resize", handleWindowResize);
      }
    };

    api.adopt(root, {
      dispose() {
        controller.dispose();
      }
    });
    controller.refresh(true);
    return controller;
  };

  function refreshMathStylesheet() {
    // tex2chtml output for characters the page's static math never used has
    // no glyph CSS until the CHTML stylesheet is re-injected (MathJax v3's
    // documented recipe for dynamic conversion).
    const mathJax = window.MathJax;
    if (!mathJax || !mathJax.startup || !mathJax.startup.document) return;
    try {
      mathJax.startup.document.clear();
      mathJax.startup.document.updateDocument();
    } catch (error) {
      // Stylesheet refresh is best-effort; stale glyph CSS only affects
      // characters not yet seen on the page.
    }
  }

  function replaceInlineMath(element, expression, rendered) {
    if (!element.isConnected || element.dataset.tex !== expression) return;

    element.replaceChildren(rendered);
    refreshMathStylesheet();
  }

  function queueMathTypeset(element, expression, attempt) {
    attempt = attempt || 0;

    if (!element.isConnected) {
      if (attempt < 30) {
        window.requestAnimationFrame(function() {
          queueMathTypeset(element, expression, attempt + 1);
        });
      }
      return;
    }

    const mathJax = window.MathJax;

    if (mathJax && typeof mathJax.tex2chtmlPromise === "function") {
      mathJax.tex2chtmlPromise(expression, { display: false }).then(function(rendered) {
        replaceInlineMath(element, expression, rendered);
      }).catch(function(error) {
        console.warn("Could not typeset dynamic math:", error);
      });
      return;
    }

    if (mathJax && typeof mathJax.tex2chtml === "function") {
      replaceInlineMath(element, expression, mathJax.tex2chtml(expression, { display: false }));
      return;
    }

    if (attempt < 30) {
      window.setTimeout(function() {
        queueMathTypeset(element, expression, attempt + 1);
      }, 100);
    }
  }

  api.inlineMath = function() {
    api.ensureStyles();

    const expression = Array.prototype.slice.call(arguments)
      .filter(function(part) {
        return part !== null && part !== undefined;
      })
      .map(String)
      .join(" ");

    const span = document.createElement("span");
    span.className = "math inline sfs-if-inline-math";
    span.dataset.tex = expression;
    span.textContent = expression;
    queueMathTypeset(span, expression);
    return span;
  };

  api.setRevealVisible = function(targets, visible, opts) {
    opts = opts || {};
    api.ensureStyles();

    const elements = targetElements(targets);
    const root = targetElement(opts.root);
    const animate = motionAllows(opts.animate);

    if (root && !animate) {
      root.classList.add("sfs-if-no-reveal-animation");
    }

    elements.forEach(function(element) {
      element.classList.add("sfs-if-reveal");
      element.classList.toggle("is-visible", Boolean(visible));
      element.setAttribute("aria-hidden", String(!visible));
    });

    if (root && !animate) {
      root.getBoundingClientRect();
      window.requestAnimationFrame(function() {
        root.classList.remove("sfs-if-no-reveal-animation");
      });
    }

    return elements;
  };

  api.parseTutorialAction = function(step) {
    const raw = step.getAttribute("data-action");
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn("Could not parse tutorial step data-action:", raw, error);
      return null;
    }
  };

  // A callout has exactly one claiming figure: the first figure whose wrap()
  // reaches the footer sets footer.dataset.bcIfTutorial and receives every
  // step through applyAction. Any other figure in the same callout hears the
  // steps here instead. createTutorial dispatches a bubbling
  // sfs-if:tutorial-step-action from the claiming figure's root, so the callout
  // is the nearest node both figures share.
  api.observeTutorialActions = function(target, handler, opts) {
    if (typeof handler !== "function") return function() {};
    opts = opts || {};

    const root = targetElement(target);
    if (!root) return function() {};

    const includeSelf = opts.includeSelf === true;
    const retryLimit = Math.max(1, Number(opts.retryLimit) || 60);
    let listenTarget = null;
    let disposed = false;
    let attempts = 0;

    function listener(event) {
      if (disposed) return;
      const detail = event.detail || {};
      if (!includeSelf && (event.target === root || root.contains(event.target))) return;
      handler(detail.action || {}, detail);
    }

    function attach() {
      if (disposed || listenTarget) return true;
      // The figure is built before the runtime inserts it, so closest() only
      // finds the callout once the node is in the document.
      if (!root.isConnected) return false;
      listenTarget = root.closest(".callout") || root;
      listenTarget.addEventListener("sfs-if:tutorial-step-action", listener);
      return true;
    }

    if (!attach()) {
      const retry = function() {
        attempts += 1;
        if (disposed || attach() || attempts >= retryLimit) return;
        window.requestAnimationFrame(retry);
      };
      window.requestAnimationFrame(retry);
    }

    return function unsubscribe() {
      if (disposed) return;
      disposed = true;
      if (listenTarget) {
        listenTarget.removeEventListener("sfs-if:tutorial-step-action", listener);
        listenTarget = null;
      }
    };
  };

  api.createTutorial = function(opts) {
    opts = opts || {};
    const root = opts.root;
    const footer = opts.footer;
    const steps = opts.steps || [];
    if (!root || !footer || !steps.length) return null;

    const callout = root.closest(".callout");
    const authoredTutorialId = opts.tutorialId || (callout && callout.id) || "";
    const tutorialId = String(authoredTutorialId).replace(/^#/, "");
    let tutorialStepIds = tutorialId
      ? steps.map(function(_step, stepIndex) {
          return tutorialId + "-step-" + (stepIndex + 1);
        })
      : [];

    // The Quarto activity ID is the stable public address. Derived step IDs
    // are added only after Quarto has built its custom-float cross-references,
    // so they are ordinary fragments rather than separately numbered
    // Activities. If an author has already claimed one of those IDs, leave the
    // tutorial working but disable URL synchronization instead of producing an
    // ambiguous document.
    if (tutorialStepIds.length) {
      const collision = steps.find(function(step, stepIndex) {
        const stepId = tutorialStepIds[stepIndex];
        const existing = document.getElementById(stepId);
        return (step.id && step.id !== stepId) || (existing && existing !== step);
      });
      if (collision) {
        console.warn(
          "Tutorial step URLs are disabled because a derived step ID is already in use:",
          tutorialId
        );
        tutorialStepIds = [];
      } else {
        steps.forEach(function(step, stepIndex) {
          step.id = tutorialStepIds[stepIndex];
        });
      }
    }

    let lastInvalidTutorialHash = null;
    function tutorialHashMatch(hash, warn) {
      if (!tutorialStepIds.length || !hash || hash === "#") return null;

      let fragment;
      try {
        fragment = decodeURIComponent(String(hash).replace(/^#/, ""));
      } catch (error) {
        return null;
      }

      if (fragment === tutorialId) {
        return { index: 0, step: false, invalid: false };
      }

      const prefix = tutorialId + "-step-";
      if (!fragment.startsWith(prefix)) return null;

      const numberText = fragment.slice(prefix.length);
      const stepNumber = /^[1-9]\d*$/.test(numberText) ? Number(numberText) : NaN;
      if (!Number.isSafeInteger(stepNumber) || stepNumber > steps.length) {
        if (warn && lastInvalidTutorialHash !== hash) {
          lastInvalidTutorialHash = hash;
          console.warn(
            "Ignoring invalid tutorial step URL; expected a step from 1 through " +
              steps.length + ":",
            hash
          );
        }
        return { index: null, step: true, invalid: true };
      }

      return { index: stepNumber - 1, step: true, invalid: false };
    }

    const actionDefaults = Object.assign({}, opts.actionDefaults || {});
    const absoluteActions = steps.map(function(step) {
      const action = api.parseTutorialAction(step) || {};
      const absolute = Object.assign({}, actionDefaults, action);
      step.dataset.action = JSON.stringify(absolute);
      return absolute;
    });
    const repeatActions = steps.map(function(step) {
      const raw = step.getAttribute("data-repeat-action");
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (error) {
        console.warn("Could not parse tutorial step data-repeat-action:", raw, error);
        return null;
      }
    });

    footer.classList.add("sfs-if-tutorial");
    footer.dataset.bcIfTutorial = "true";
    footer.dataset.tutorialStep = "0";
    if (tutorialStepIds.length) footer.dataset.tutorialId = tutorialId;
    footer.setAttribute("aria-live", "polite");

    const nav = document.createElement("div");
    nav.className = "sfs-if-tutorial-nav";

    function makeNavButton(className, label, ariaLabel, iconBefore, iconAfter) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sfs-if-tutorial-button sfs-button " + className;
      button.setAttribute("aria-label", ariaLabel);

      const text = document.createElement("span");
      text.className = "sfs-if-tutorial-button-text";
      text.textContent = label;

      if (iconBefore) button.insertAdjacentHTML("beforeend", iconBefore);
      button.appendChild(text);
      if (iconAfter) button.insertAdjacentHTML("beforeend", iconAfter);
      return button;
    }

    const prevButton = makeNavButton(
      "sfs-if-tutorial-prev",
      opts.prevLabel || "Back",
      "Previous step",
      '<i class="bi bi-chevron-left" aria-hidden="true"></i>',
      null
    );

    const nextButton = makeNavButton(
      "sfs-if-tutorial-next",
      opts.nextLabel || "Next",
      "Next step",
      null,
      '<i class="bi bi-chevron-right" aria-hidden="true"></i>'
    );

    const stepper = document.createElement("ol");
    stepper.className = "sfs-if-stepper";
    const grouped = steps.some(function(step) { return Boolean(step.dataset.major); });
    stepper.dataset.grouped = String(grouped);
    stepper.setAttribute("aria-label", grouped ? "Tutorial sections" : "Tutorial steps");

    const groups = [];
    steps.forEach(function(step, stepIndex) {
      const key = grouped ? (step.dataset.major || "step-" + stepIndex) : "step-" + stepIndex;
      const previous = groups[groups.length - 1];
      if (previous && previous.key === key) {
        previous.end = stepIndex;
        previous.steps.push(stepIndex);
        if (!previous.title && step.dataset.majorTitle) previous.title = step.dataset.majorTitle;
        return;
      }
      groups.push({
        key,
        title: grouped
          ? (step.dataset.majorTitle || step.dataset.major || step.dataset.title || String(groups.length + 1))
          : (step.dataset.title || String(stepIndex + 1)),
        start: stepIndex,
        end: stepIndex,
        steps: [stepIndex]
      });
    });

    const initialHashMatch = tutorialHashMatch(window.location && window.location.hash, true);
    const authoredStartIndex = Math.max(
      0,
      Math.min(Number(opts.startIndex) || 0, steps.length - 1)
    );
    let index = initialHashMatch && Number.isInteger(initialHashMatch.index)
      ? initialHashMatch.index
      : authoredStartIndex;
    let maxVisited = index;
    let actionController = null;
    let actionGeneration = 0;
    let tutorialScrollFrame = null;
    let tutorialLoadScrollHandler = null;

    const controlsByStep = new Map();
    const progressEntries = grouped
      ? steps.map(function(step, stepIndex) {
          const groupIndex = groups.findIndex(function(group) {
            return stepIndex >= group.start && stepIndex <= group.end;
          });
          const group = groups[groupIndex];
          return {
            stepIndex,
            groupIndex,
            group,
            minorIndex: stepIndex - group.start,
            isMajor: stepIndex === group.start
          };
        })
      : groups.map(function(group, groupIndex) {
          return { stepIndex: group.start, groupIndex, group, minorIndex: 0, isMajor: true };
        });

    const items = progressEntries.map(function(entry) {
      const item = document.createElement("li");
      item.className = "sfs-if-stepper-step " +
        (entry.isMajor ? "sfs-if-stepper-step--major" : "sfs-if-stepper-step--minor");

      const node = document.createElement("button");
      node.type = "button";
      if (entry.isMajor) {
        node.className = "sfs-if-stepper-node";
        node.setAttribute("aria-label",
          (grouped ? "Section " : "Step ") + (entry.groupIndex + 1) + " of " + groups.length +
          (entry.group.title ? ": " + entry.group.title : ""));

        const dot = document.createElement("span");
        dot.className = "sfs-if-stepper-dot";
        dot.setAttribute("aria-hidden", "true");
        dot.innerHTML = '<i class="bi bi-check"></i>';

        const label = document.createElement("span");
        label.className = "sfs-if-stepper-label";
        label.setAttribute("aria-hidden", "true");
        label.textContent = entry.group.title || String(entry.groupIndex + 1);
        node.append(dot, label);
      } else {
        const title = steps[entry.stepIndex].dataset.title || "Step " + (entry.minorIndex + 1);
        node.className = "sfs-if-substep";
        node.setAttribute("aria-label",
          entry.group.title + ", step " + (entry.minorIndex + 1) + " of " +
          entry.group.steps.length + ": " + title);
      }

      node.addEventListener("click", function(event) {
        event.preventDefault();
        spendTutorialHint();
        if (entry.stepIndex !== index) {
          render(entry.stepIndex, { applyAction: true, updateHash: true });
        }
      });
      controlsByStep.set(entry.stepIndex, node);

      item.appendChild(node);
      stepper.appendChild(item);
      return { ...entry, item, node };
    });

    stepper.addEventListener("keydown", function(event) {
      let delta = 0;
      if (event.key === "ArrowLeft") delta = -1;
      else if (event.key === "ArrowRight") delta = 1;
      else return;

      event.preventDefault();
      const orderedControls = Array.from(controlsByStep.entries()).sort(function(a, b) {
        return a[0] - b[0];
      });
      const focused = orderedControls.findIndex(function(entry) {
        return entry[1] === document.activeElement;
      });
      const current = orderedControls.findIndex(function(entry) { return entry[0] === index; });
      const from = focused >= 0 ? focused : current;
      const to = Math.max(0, Math.min(from + delta, orderedControls.length - 1));
      orderedControls[to][1].focus();
    });

    // ---- Navigation placement -------------------------------------------
    //
    // Two arrangements, chosen by how much room the callout has:
    //
    //   "side"   Back/Next become round arrows pinned to the left and right of
    //            the viz, vertically centred on it. The step text then sits
    //            directly under the viz (short eye path), and the progress rail
    //            drops below the text. Because the arrows are anchored to the
    //            viz rather than to the prose, they never move as step text
    //            changes length.
    //
    //   "inline" Back, rail and Next in one row *above* the step text. Used
    //            when the callout is too narrow to give up side gutters. Still
    //            keeps the buttons above the variable-height prose, so they
    //            stay put there too.
    //
    // Side mode reserves its gutters by insetting the viz (see the CSS), rather
    // than overlaying the arrows on top of it: the callout is a fixed ~749px and
    // most chart wraps fill it, so an overlay would cover live content.
    const sideNav = document.createElement("div");
    sideNav.className = "sfs-if-side-nav";

    // Not every module's figure root carries .sfs-if-root (the table and
    // variance-partition builders use their own), so the gutter-reserving CSS
    // is hung off a marker this function applies to whatever root it was given.
    root.classList.add("sfs-if-tutorial-viz");

    // Authors can force the inline arrangement for a viz that needs every pixel.
    const sideOptOut = opts.sideNav === false ||
      root.dataset.tutorialNav === "inline" ||
      (callout && callout.dataset.tutorialNav === "inline");

    // Below this the gutters cost more than they are worth, and the labelled
    // rail no longer fits on one line either.
    const SIDE_NAV_MIN_CALLOUT_WIDTH = 640;

    // Narrow screens get a one-line readout ("3 of 11 - Count") in place of the
    // rail: same information, a fraction of the height, so the step text stays
    // close to the viz. Section jumping is the cost, which is the right trade
    // on a phone where the rail's tap targets were tiny anyway.
    const readout = document.createElement("p");
    readout.className = "sfs-if-step-readout";

    const readoutPosition = document.createElement("span");
    readoutPosition.className = "sfs-if-step-readout-position";

    const readoutTitle = document.createElement("span");
    readoutTitle.className = "sfs-if-step-readout-title";

    readout.append(readoutPosition, readoutTitle);

    let navMode = null;
    let sideFitFailed = false;

    // Only side mode hints. The compact and inline arrangements put a labelled
    // "Next" button in a nav row, which needs no introduction -- and on a phone
    // a pulsing control at the foot of the callout would be squarely in the
    // reader's field of view rather than at the edge of it.
    //
    // Two signals, answering two different questions:
    //
    //   .is-hinting   "this chevron is a control"  -- the three-beat pulse.
    //                 A one-time introduction, spent site-wide, because the
    //                 question is about the interface and is asked once.
    //
    //   .is-inviting  "this tutorial is worth starting" -- the chevron nudge
    //                 alone, slow and sparse. Per figure, and only on the
    //                 opening step, because that is the one moment a reader
    //                 decides between stepping through and scrolling past.
    //
    // The pulse hands off to the invitation when its beats run out, so a first
    // encounter reads as an introduction followed by a standing offer.
    let hintInView = false;
    let hintFound = false;
    let hintPulseDone = false;
    let hintObserver = null;

    function syncHint() {
      const visible = !nextButton.disabled && navMode === "side" && hintInView;
      const pulse = visible && !hintSpent && !hintFound && !hintPulseDone;
      // maxVisited is already exactly "has this reader ever left step 0", so
      // returning to the opening step after stepping forward stays quiet: they
      // have engaged, and the invitation has nothing left to ask for.
      const invite = visible && !pulse && index === 0 && maxVisited === 0;
      // Toggling a class off and on restarts its animation from the top, which
      // is what should happen when a reader who never engaged scrolls away and
      // comes back to the figure.
      nextButton.classList.toggle("is-hinting", pulse);
      nextButton.classList.toggle("is-inviting", invite);
    }

    // Hovering or tabbing onto the arrow means the reader has located this one,
    // so stop pulsing at it -- but do not count that as having learned the
    // pattern site-wide the way an actual press does. A mouse can wander. The
    // invitation is unaffected: it is asking for engagement, not for notice.
    function markHintFound() {
      if (hintFound) return;
      hintFound = true;
      syncHint();
    }

    nextButton.addEventListener("animationend", function(event) {
      if (event.animationName !== "sfs-if-next-beat") return;
      hintPulseDone = true;
      syncHint();
    });

    if (typeof IntersectionObserver === "function") {
      // Arm only once the whole arrow is on screen, so a reader scrolling
      // briskly past cannot burn the hint on a glimpse of it -- but disarm
      // only once it has left the viewport entirely. The gap between the two
      // is not fussiness: the beat scales the button up, and an arrow resting
      // near the top or bottom edge would scale itself back under a plain
      // "fully visible" test, which disarms it, which shrinks it into view
      // again -- a strobe loop rather than a hint.
      hintObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.intersectionRatio >= 1) hintInView = true;
          else if (entry.intersectionRatio === 0) hintInView = false;
        });
        syncHint();
      }, { threshold: [0, 1] });
      hintObserver.observe(nextButton);
    }

    nextButton.addEventListener("pointerenter", markHintFound);
    nextButton.addEventListener("focus", markHintFound);
    document.addEventListener(HINT_SPENT_EVENT, syncHint);

    function preferredNavMode() {
      if (!callout) return "inline";
      if (callout.getBoundingClientRect().width < SIDE_NAV_MIN_CALLOUT_WIDTH) return "compact";
      // A wide callout that cannot take the gutters keeps the full rail: there
      // is room for it, and it is more useful than a bare readout.
      return sideOptOut || sideFitFailed ? "inline" : "side";
    }

    function setNavMode(mode) {
      if (mode === navMode) return;
      navMode = mode;

      if (mode === "side") {
        nav.dataset.mode = "rail";
        nav.replaceChildren(stepper);
        footer.appendChild(nav);
        sideNav.replaceChildren(prevButton, nextButton);
        // Before the body container, so the arrows land early in the tab order
        // (right after the header's controls toggle) rather than after the prose.
        callout.insertBefore(sideNav, callout.querySelector(".callout-body-container"));
        callout.dataset.tutorialNavMode = "side";
      } else {
        nav.dataset.mode = mode;
        nav.replaceChildren(prevButton, mode === "compact" ? readout : stepper, nextButton);
        // Compact sits below the prose, in thumb reach at the foot of the
        // callout; inline sits above it, where the taller rail would otherwise
        // push the step text away from the viz.
        if (mode === "compact") footer.appendChild(nav);
        else footer.insertBefore(nav, footer.firstChild);
        sideNav.remove();
        if (callout) callout.dataset.tutorialNavMode = mode;
      }

      updateReadout();
      updateArrowCentre();
      syncHint();
    }

    // Every step counts, substeps included, so the number advances by exactly
    // one per Next press and "how many clicks left" stays true. Numbering the
    // major sections instead would undercount wherever a section has substeps
    // (ch2's "Count" alone holds five). The name shown is the section, which is
    // stable across a run of substeps and short enough to fit on one line.
    function updateReadout() {
      if (navMode !== "compact") return;
      const position = positionFor(index);
      const title = (grouped && position.majorTitle) ||
        steps[index].dataset.title ||
        position.majorTitle ||
        "";
      readoutPosition.textContent = (index + 1) + " of " + steps.length;
      readoutTitle.textContent = title ? " · " + title : "";
    }

    // Centre the arrows on the viz itself, excluding the controls drawer --
    // otherwise opening the drawer would slide them down.
    function updateArrowCentre() {
      if (navMode !== "side" || !callout) return;
      const rootRect = root.getBoundingClientRect();
      let vizTop = rootRect.top;

      // Only discount the drawer when it is genuinely open and sitting inside
      // the figure. A collapsed drawer still has a rect, but modules park it
      // far off-box, so trusting it blindly throws the arrows off-screen.
      const controls = root.querySelector(".sfs-if-controls");
      if (controls) {
        const controlsRect = controls.getBoundingClientRect();
        if (controlsRect.height > 0 &&
            controlsRect.bottom > rootRect.top &&
            controlsRect.bottom < rootRect.bottom) {
          vizTop = controlsRect.bottom;
        }
      }

      const centre = (vizTop + rootRect.bottom) / 2 - callout.getBoundingClientRect().top;
      callout.style.setProperty("--sfs-if-arrow-top", Math.round(centre) + "px");
    }

    // If reserving the gutters pushes any part of the viz into horizontal
    // overflow, side mode is not affordable here. The switch is one-way so a
    // borderline figure cannot oscillate between arrangements mid-tutorial.
    let fitCheckTimer = null;
    function checkSideFit() {
      if (navMode !== "side" || sideFitFailed) return;
      // Measure the viz children only. The controls drawer is styled with
      // negative side margins so it can sit flush to the callout edges, which
      // makes it wider than the figure's content box by design -- reading
      // root.scrollWidth would therefore report overflow the moment the drawer
      // is opened, and wrongly drop a perfectly good figure out of side mode.
      // Explicit fit-ignore nodes are nonvisual infrastructure such as live
      // announcements: their one-pixel, nonwrapping accessibility geometry is
      // intentionally unrelated to whether the visible chart fits.
      const overflows = Array.from(root.children).some(function(child) {
        if (child.classList && (
          child.classList.contains("sfs-if-controls") ||
          child.classList.contains("sfs-if-fit-ignore")
        )) return false;
        return child.scrollWidth > child.clientWidth + 2;
      });
      if (!overflows) return;
      sideFitFailed = true;
      setNavMode(preferredNavMode());
    }

    function scheduleFitCheck() {
      if (fitCheckTimer) clearTimeout(fitCheckTimer);
      // Let step transitions settle first, so a mid-animation width cannot
      // trigger a false negative and latch side mode off for good.
      fitCheckTimer = setTimeout(checkSideFit, 450);
    }

    function syncNavLayout() {
      setNavMode(preferredNavMode());
      updateArrowCentre();
      scheduleFitCheck();
    }

    syncNavLayout();

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(function() {
        syncNavLayout();
      });
      observer.observe(root);
      if (callout) observer.observe(callout);
    } else {
      window.addEventListener("resize", syncNavLayout);
    }

    function positionFor(stepIndex) {
      const majorIndex = groups.findIndex(function(group) {
        return stepIndex >= group.start && stepIndex <= group.end;
      });
      const group = groups[Math.max(0, majorIndex)];
      return {
        majorIndex: Math.max(0, majorIndex),
        minorIndex: group ? stepIndex - group.start : 0,
        major: group ? group.key : null,
        majorTitle: group ? group.title : null,
        minorCount: group ? group.steps.length : 1
      };
    }

    function replaceTutorialHash(stepIndex) {
      if (!tutorialStepIds.length || !window.location || !window.history) return;

      const url = new URL(window.location.href);
      url.hash = tutorialStepIds[stepIndex];
      if (window.location.hash === url.hash) return;

      // Preserve any state owned by Quarto or another page component. Replacing
      // this entry keeps the current step shareable without making readers
      // press Back once for every tutorial click.
      window.history.replaceState(window.history.state, "", url.href);
    }

    function scrollTutorialIntoView() {
      tutorialScrollFrame = null;
      const target = callout || root;
      if (!target || !target.isConnected || typeof window.scrollTo !== "function") return;

      const anchorNavigation = window.bcAnchorNavigation;
      if (anchorNavigation && typeof anchorNavigation.scrollTarget === "function") {
        anchorNavigation.scrollTarget(target, { gap: 0 });
        return;
      }

      const header = document.querySelector("header.fixed-top");
      const headerHeight = header ? header.clientHeight : 0;
      const top = (Number(window.scrollY) || 0) +
        target.getBoundingClientRect().top - headerHeight;

      window.scrollTo({ top: Math.max(0, top), left: 0, behavior: "auto" });
    }

    function scheduleTutorialScroll() {
      if (tutorialScrollFrame !== null) {
        window.cancelAnimationFrame(tutorialScrollFrame);
      }
      tutorialScrollFrame = window.requestAnimationFrame(scrollTutorialIntoView);

      // The derived step ID is added after the document was parsed. Some
      // browsers perform their native initial-fragment scroll at load, after
      // our first frame, so repeat the host-aligned scroll once loading ends.
      if (document.readyState !== "complete" && !tutorialLoadScrollHandler) {
        tutorialLoadScrollHandler = function() {
          tutorialLoadScrollHandler = null;
          const match = tutorialHashMatch(window.location.hash, false);
          if (match && Number.isInteger(match.index)) scheduleTutorialScroll();
        };
        window.addEventListener("load", tutorialLoadScrollHandler, { once: true });
      }
    }

    function actionWithoutMotion(stepIndex) {
      return Object.assign({}, absoluteActions[stepIndex], { animate: false });
    }

    function applyStepAction(step, nextIndex, requestedAction, repeat) {
      const rawAction = requestedAction || absoluteActions[nextIndex];
      const action = Object.assign({}, rawAction, {
        animate: motionAllows(rawAction.animate)
      });
      if (!action) return;

      if (actionController) actionController.abort();
      actionController = typeof AbortController === "function"
        ? new AbortController()
        : null;
      actionGeneration += 1;
      api.cancelTransitions(root);

      const position = positionFor(nextIndex);

      if (typeof opts.applyAction === "function") {
        opts.applyAction(action, {
          root,
          footer,
          step,
          index: nextIndex,
          majorIndex: position.majorIndex,
          minorIndex: position.minorIndex,
          major: position.major,
          setControlsOpen: opts.setControlsOpen,
          generation: actionGeneration,
          signal: actionController ? actionController.signal : null,
          repeat: Boolean(repeat)
        });
      }

      root.dispatchEvent(new CustomEvent("sfs-if:tutorial-step-action", {
        bubbles: true,
        detail: {
          action,
          index: nextIndex,
          step,
          generation: actionGeneration,
          signal: actionController ? actionController.signal : null,
          repeat: Boolean(repeat),
          ...position
        }
      }));
    }

    function render(nextIndex, renderOptions) {
      renderOptions = renderOptions || {};
      index = Math.max(0, Math.min(nextIndex, steps.length - 1));
      maxVisited = Math.max(maxVisited, index);
      const position = positionFor(index);
      footer.dataset.tutorialStep = String(index);
      footer.dataset.tutorialMajor = String(position.majorIndex);
      footer.dataset.tutorialMinor = String(position.minorIndex);

      steps.forEach(function(step, stepIndex) {
        const active = stepIndex === index;
        step.hidden = !active;
        step.setAttribute("aria-hidden", String(!active));
      });

      items.forEach(function(entry) {
        const current = entry.stepIndex === index;
        const state = current ? "current"
          : entry.stepIndex <= maxVisited ? "complete"
          : "upcoming";
        entry.item.dataset.state = state;
        entry.item.dataset.filled = String(entry.stepIndex <= index);
        entry.item.dataset.sectionCurrent = String(entry.isMajor && entry.groupIndex === position.majorIndex);
        entry.node.tabIndex = current ? 0 : -1;
        if (current) {
          entry.node.setAttribute("aria-current", "step");
          if (entry.isMajor) {
            entry.node.setAttribute("aria-label", grouped
              ? "Section " + (entry.groupIndex + 1) + " of " + groups.length + ": " + entry.group.title +
                ", step 1 of " + entry.group.steps.length
              : "Step " + (entry.stepIndex + 1) + " of " + steps.length +
                (entry.group.title ? ": " + entry.group.title : ""));
          }
        } else {
          entry.node.removeAttribute("aria-current");
        }
      });

      prevButton.disabled = index === 0;
      const repeatAction = repeatActions[index];
      const atEnd = index === steps.length - 1;
      nextButton.disabled = atEnd && !repeatAction;
      const nextText = nextButton.querySelector(".sfs-if-tutorial-button-text");
      const repeatLabel = steps[index].dataset.repeatLabel || opts.repeatLabel || "Next";
      const repeatsAtEnd = Boolean(atEnd && repeatAction);
      if (nextText) nextText.textContent = repeatsAtEnd ? repeatLabel : (opts.nextLabel || "Next");
      const nextIcon = nextButton.querySelector(".bi");
      if (nextIcon) nextIcon.className = `bi bi-${repeatsAtEnd ? "arrow-repeat" : "chevron-right"}`;
      nextButton.classList.toggle("is-repeat-action", repeatsAtEnd);
      nextButton.setAttribute("aria-label", repeatsAtEnd ? repeatLabel : "Next step");
      nextButton.title = repeatsAtEnd ? repeatLabel : "Next step";

      if (renderOptions.applyAction) {
        applyStepAction(steps[index], index, renderOptions.requestedAction);
      }

      // A step can change the viz's height (and, in side mode, its width), so
      // re-centre the arrows and re-test the gutter fit once it has drawn.
      updateReadout();
      updateArrowCentre();
      syncHint();
      scheduleFitCheck();
      if (renderOptions.updateHash) replaceTutorialHash(index);

      root.dispatchEvent(new CustomEvent("sfs-if:tutorial-step", {
        bubbles: true,
        detail: { index, step: steps[index], ...position }
      }));
    }

    prevButton.addEventListener("click", function(event) {
      event.preventDefault();
      spendTutorialHint();
      render(index - 1, { applyAction: true, updateHash: true });
    });

    nextButton.addEventListener("click", function(event) {
      event.preventDefault();
      spendTutorialHint();
      if (index === steps.length - 1 && repeatActions[index]) {
        applyStepAction(steps[index], index, repeatActions[index], true);
        return;
      }
      render(index + 1, { applyAction: true, updateHash: true });
    });

    render(index, {
      applyAction: opts.applyInitialAction !== false,
      requestedAction: initialHashMatch && Number.isInteger(initialHashMatch.index)
        ? actionWithoutMotion(index)
        : null
    });
    if (initialHashMatch) scheduleTutorialScroll();

    function handleTutorialHashChange() {
      const match = tutorialHashMatch(window.location.hash, true);
      if (!match) return;
      if (Number.isInteger(match.index) && match.index !== index) {
        render(match.index, {
          applyAction: true,
          requestedAction: actionWithoutMotion(match.index)
        });
      }
      scheduleTutorialScroll();
    }
    if (tutorialStepIds.length) {
      window.addEventListener("hashchange", handleTutorialHashChange);
    }

    const controller = {
      footer,
      steps,
      next() {
        render(index + 1, { applyAction: true });
      },
      previous() {
        render(index - 1, { applyAction: true });
      },
      setStep(nextIndex) {
        render(nextIndex, { applyAction: true });
      },
      getStep() {
        return index;
      },
      getPosition() {
        return positionFor(index);
      }
    };

    function handleTutorialMotionChange(event) {
      if (!event.detail || !event.detail.reduced) return;
      render(index, { applyAction: true });
    }
    document.addEventListener("sfs-motion:change", handleTutorialMotionChange);

    api.adopt(root, {
      setTutorialStep(nextIndex) {
        controller.setStep(nextIndex);
      },
      cancelMotion() {
        if (actionController) actionController.abort();
        api.cancelTransitions(root);
      },
      dispose() {
        if (actionController) actionController.abort();
        if (hintObserver) hintObserver.disconnect();
        if (tutorialScrollFrame !== null) {
          window.cancelAnimationFrame(tutorialScrollFrame);
          tutorialScrollFrame = null;
        }
        if (tutorialLoadScrollHandler) {
          window.removeEventListener("load", tutorialLoadScrollHandler);
          tutorialLoadScrollHandler = null;
        }
        window.removeEventListener("hashchange", handleTutorialHashChange);
        document.removeEventListener("sfs-motion:change", handleTutorialMotionChange);
        document.removeEventListener(HINT_SPENT_EVENT, syncHint);
        api.cancelTransitions(root);
      }
    });

    return controller;
  };

  api.wrap = function(opts) {
    opts = opts || {};
    const root = opts.root;
    const controls = opts.controls;
    if (!root || !controls) return null;

    api.ensureStyles();

    const id = controls.id || "sfs-if-controls-" + nextId++;
    api.nextId = nextId;
    controls.id = id;

    root.classList.add("sfs-if-root");
    controls.classList.add("sfs-if-controls");
    if (opts.layout) {
      controls.classList.add("sfs-if-control-grid");
      controls.dataset.layout = opts.layout;
      controls.dataset.dividers = String(opts.dividers === undefined ? true : Boolean(opts.dividers));
    }

    const toolbar = document.createElement("div");
    toolbar.className = "sfs-if-toolbar";
    root.insertBefore(toolbar, root.firstChild);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sfs-if-toggle";
    button.setAttribute("aria-controls", id);
    button.innerHTML = '<i class="bi bi-sliders" aria-hidden="true"></i><span class="visually-hidden">Toggle controls</span>';

    const label = opts.label || "diagram controls";
    let open = Boolean(opts.startOpen);
    let transitionTimer = null;
    let transitionEndHandler = null;

    function updateButton() {
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", (open ? "Hide " : "Show ") + label);
      button.title = (open ? "Hide " : "Show ") + label;
      root.classList.toggle("sfs-if-controls-open", open);
    }

    function setControlsInteractive(value) {
      controls.setAttribute("aria-hidden", String(!value));
      if ("inert" in controls) {
        controls.inert = !value;
      }
    }

    function clearTransitionCallback() {
      if (transitionTimer) {
        window.clearTimeout(transitionTimer);
        transitionTimer = null;
      }
      if (transitionEndHandler) {
        controls.removeEventListener("transitionend", transitionEndHandler);
        transitionEndHandler = null;
      }
    }

    function afterSlide(callback) {
      clearTransitionCallback();
      transitionEndHandler = function(event) {
        if (event.target !== controls || event.propertyName !== "max-height") return;
        clearTransitionCallback();
        callback();
      };
      controls.addEventListener("transitionend", transitionEndHandler);
      transitionTimer = window.setTimeout(function() {
        clearTransitionCallback();
        callback();
      }, 300);
    }

    // Tutorial callouts are authored as fixed, stepped explanations, so they
    // get no toggle in the header, no drawer, and step actions asking for the
    // panel are ignored rather than having to be stripped out of every
    // data-action. That is the default; a callout can opt back in with
    // .with-controls. Figures that are not tutorials (the freeform explorers)
    // keep their drawer, and .no-controls can silence one of those too.
    //
    // Resolved lazily because the figure is not in the DOM yet when wrap()
    // runs -- the same reason placeButton retries. The tutorial footer is
    // static markup, so it is detectable as soon as the callout is.
    let controlsSuppressed = null;
    function suppressControls() {
      if (controlsSuppressed !== null) return controlsSuppressed;
      if (!root.isConnected) return false;
      const calloutNode = root.closest(".callout");
      if (!calloutNode) return false;

      const isTutorial = Boolean(calloutNode.querySelector(".callout-footer .tutorial-step"));
      controlsSuppressed = calloutNode.classList.contains("no-controls") ||
        (isTutorial && !calloutNode.classList.contains("with-controls"));

      if (controlsSuppressed) root.classList.add("sfs-if-controls-suppressed");
      return controlsSuppressed;
    }

    function setOpen(value, animate) {
      const nextOpen = suppressControls() ? false : Boolean(value);
      const shouldAnimate = motionAllows(animate);
      open = nextOpen;
      updateButton();

      if (open) {
        controls.hidden = false;
        setControlsInteractive(true);

        if (!shouldAnimate) {
          clearTransitionCallback();
          controls.style.maxHeight = "";
          controls.style.marginBottom = "";
          controls.style.visibility = "";
          return;
        }

        controls.style.transition = "none";
        controls.style.visibility = "hidden";
        controls.style.maxHeight = "";
        controls.style.marginBottom = "0.75rem";
        controls.getBoundingClientRect();
        const targetHeight = controls.scrollHeight;
        // A static negative top margin (the flush drawer inside callouts)
        // must be offset by margin-bottom while collapsed: the drawer's top
        // edge stays locked and the content below never jumps. Paddings are
        // never animated, so the panel contents hold their final position
        // and the drawer is a pure reveal.
        const collapsedMarginBottom =
          -(parseFloat(window.getComputedStyle(controls).marginTop) || 0);
        controls.style.maxHeight = "0px";
        controls.style.marginBottom = collapsedMarginBottom + "px";
        controls.getBoundingClientRect();
        controls.style.transition = "";
        controls.style.visibility = "";
        window.requestAnimationFrame(function() {
          if (!open) return;
          controls.style.maxHeight = targetHeight + "px";
          controls.style.marginBottom = "0.75rem";

          afterSlide(function() {
            if (!open) return;
            controls.style.maxHeight = "";
            controls.style.marginBottom = "";
            controls.style.visibility = "";
          });
        });
        return;
      }

      setControlsInteractive(false);

      if (!shouldAnimate || controls.hidden) {
        clearTransitionCallback();
        controls.hidden = true;
        controls.style.maxHeight = "0px";
        controls.style.marginBottom = "0px";
        return;
      }

      controls.style.maxHeight = controls.scrollHeight + "px";
      controls.style.marginBottom = window.getComputedStyle(controls).marginBottom;
      controls.getBoundingClientRect();
      controls.style.maxHeight = "0px";
      controls.style.marginBottom =
        -(parseFloat(window.getComputedStyle(controls).marginTop) || 0) + "px";

      afterSlide(function() {
        if (open) return;
        controls.hidden = true;
      });
    }

    function renderInitial() {
      updateButton();
      setControlsInteractive(open);
      controls.hidden = !open;
      controls.style.maxHeight = open ? "" : "0px";
      controls.style.marginBottom = open ? "" : "0px";
    }

    button.addEventListener("click", function() {
      setOpen(!open);
    });

    function handleDrawerMotionChange(event) {
      if (event.detail && event.detail.reduced) setOpen(open, false);
    }
    document.addEventListener("sfs-motion:change", handleDrawerMotionChange);

    toolbar.appendChild(button);
    renderInitial();

    let tutorialController = null;

    function setupTutorial() {
      if (tutorialController) return true;
      if (!root.isConnected) return false;

      const callout = root.closest(".callout");
      const footer = callout ? callout.querySelector(".callout-footer") : null;
      if (!footer) return false;
      if (footer.dataset.bcIfTutorial === "true") return true;

      const steps = Array.from(footer.children)
        .filter((child) => child.classList && child.classList.contains("tutorial-step"));
      if (!steps.length) return false;

      tutorialController = api.createTutorial({
        root,
        footer,
        steps,
        startIndex: opts.tutorialStartIndex,
        applyInitialAction: opts.tutorialApplyInitialAction,
        applyAction: opts.applyAction,
        setControlsOpen: setOpen
      });

      return Boolean(tutorialController);
    }

    function placeButton() {
      const preferCallout = opts.placement !== "local";
      if (!preferCallout) return true;
      if (!root.isConnected) return false;

      const callout = root.closest(".callout");
      const header = callout ? callout.querySelector(".callout-header") : null;
      if (!header) return false;

      if (suppressControls()) {
        button.remove();
        setOpen(false, false);
        return true;
      }

      if (header.contains(button)) return true;

      header.appendChild(button);
      root.classList.add("sfs-if-toggle-in-callout-header");
      return true;
    }

    if (!placeButton()) {
      let placementAttempts = 0;
      function retryPlacement() {
        placementAttempts += 1;
        if (placeButton() || placementAttempts >= 60) return;
        requestAnimationFrame(retryPlacement);
      }
      requestAnimationFrame(retryPlacement);
    }

    let tutorialAttempts = 0;
    function retryTutorialSetup() {
      tutorialAttempts += 1;
      if (setupTutorial() || tutorialAttempts >= 60) return;
      requestAnimationFrame(retryTutorialSetup);
    }
    requestAnimationFrame(retryTutorialSetup);

    api.adopt(root, {
      whenReady: typeof opts.whenReady === "function" ? opts.whenReady : undefined,
      async setTutorialStep(nextIndex) {
        for (let attempt = 0; attempt < 60; attempt += 1) {
          if (tutorialController || setupTutorial()) {
            tutorialController.setStep(nextIndex);
            return;
          }
          await new Promise(function(resolve) {
            requestAnimationFrame(resolve);
          });
        }
        throw new Error("Tutorial controls did not become available");
      },
      cancelMotion() {
        clearTransitionCallback();
        api.cancelTransitions(root);
      },
      dispose() {
        clearTransitionCallback();
        document.removeEventListener("sfs-motion:change", handleDrawerMotionChange);
        api.cancelTransitions(root);
      }
    });

    return {
      button,
      controls,
      setOpen(value) {
        setOpen(value);
      },
      isOpen() {
        return open;
      },
      getTutorial() {
        return tutorialController;
      }
    };
  };

  window.interactiveFigure = api;
})();
