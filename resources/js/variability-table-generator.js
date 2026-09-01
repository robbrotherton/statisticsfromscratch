bcVariabilityStages = [
  { key: "data", label: "Data" },
  { key: "mean", label: "Mean" },
  { key: "deviations", label: "Deviations" },
  { key: "squared-deviations", label: "Squared deviations" },
  { key: "ss", label: "SS" },
  { key: "variance", label: "Variance" },
  { key: "sd", label: "SD" }
]

bcVariabilityStageAliases = ({
  x: "data",
  scores: "data",
  values: "data",
  raw: "data",
  rawscores: "data",
  "raw-scores": "data",
  m: "mean",
  average: "mean",
  deviation: "deviations",
  dev: "deviations",
  devs: "deviations",
  "x-m": "deviations",
  squared: "squared-deviations",
  squares: "squared-deviations",
  "squared-deviation": "squared-deviations",
  "squared-deviations": "squared-deviations",
  "x-m-squared": "squared-deviations",
  "sum-of-squares": "ss",
  "sum-of-squared-deviations": "ss",
  var: "variance",
  sigma2: "variance",
  "sigma-squared": "variance",
  s2: "variance",
  standarddeviation: "sd",
  "standard-deviation": "sd",
  sigma: "sd",
  all: "sd",
  full: "sd",
  complete: "sd"
})

bcVariabilityEnsureStyles = () => {
  if (document.getElementById("bc-variability-table-styles")) return;

  if (window.interactiveFigure) window.interactiveFigure.ensureStyles();

  const style = document.createElement("style");
  style.id = "bc-variability-table-styles";
  style.textContent = `
    .variability-table,
    .variability-table-set {
      --vt-border-color: var(--bc-border, var(--bs-border-color, #dee2e6));
      --vt-muted-color: var(--bc-muted, var(--bs-secondary-color, #6c757d));
      --vt-accent-color: var(--bc-accent, var(--bs-primary, #2c3e50));
      --vt-highlight-bg: var(--bc-highlight-bg, color-mix(in srgb, var(--vt-accent-color) 12%, transparent));
      --vt-table-min-width: 18rem;
    }

    .variability-table {
      --bc-figure-max-width: var(--vt-max-width, 30rem);
    }

    .variability-table-set {
      --bc-figure-max-width: var(--vt-set-max-width, 58rem);
    }

    .variability-table-set .vt-table-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--vt-table-min-width)), 1fr));
      gap: var(--vt-grid-gap, 1rem);
      align-items: start;
    }

    .vt-heading {
      margin: 0 0 0.45rem;
      font-size: 1rem;
      font-weight: 700;
      line-height: 1.25;
      text-align: center;
    }

    .vt-reveal-controls {
      justify-content: center;
      margin: 0 0 0.65rem;
    }

    .variability-table .vt-reveal-button,
    .variability-table-set .vt-reveal-button {
      --bc-focus: var(--vt-accent-color);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--bc-button-min-height, 2rem);
      height: var(--bc-button-min-height, 2rem);
      min-height: var(--bc-button-min-height, 2rem);
      padding: 0;
      border: 1px solid var(--bc-border, var(--vt-border-color));
      border-radius: var(--bc-radius-sm, 4px);
      background: var(--bc-bg, var(--bs-body-bg, #fff));
      color: var(--bc-text, var(--bs-body-color, #212529));
      line-height: 1;
      cursor: pointer;
    }

    .variability-table .vt-reveal-button:hover:not(:disabled),
    .variability-table .vt-reveal-button:focus-visible:not(:disabled),
    .variability-table-set .vt-reveal-button:hover:not(:disabled),
    .variability-table-set .vt-reveal-button:focus-visible:not(:disabled) {
      border-color: var(--bc-focus);
      color: var(--bc-focus);
    }

    .variability-table .vt-reveal-button:focus-visible,
    .variability-table-set .vt-reveal-button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    .variability-table .vt-reveal-button:disabled,
    .variability-table-set .vt-reveal-button:disabled {
      cursor: default;
      opacity: 0.45;
    }

    .variability-table .vt-reveal-button .bi,
    .variability-table-set .vt-reveal-button .bi {
      display: block;
      font-size: 1rem;
      line-height: 1;
    }

    .vt-table-wrap {
      overflow-x: auto;
    }

    .variability-table table {
      width: 100%;
      min-width: var(--vt-table-min-width);
      margin: 0 auto;
      font-family: var(--vt-math-font-family, var(--bc-math-font-family, MJXZERO, MJXTEX, "MathJax_Main", "STIX Two Math", "Cambria Math", "Times New Roman", serif));
      table-layout: fixed;
    }

    .variability-table caption {
      caption-side: top;
      padding-bottom: 0.35rem;
      color: var(--bc-text, var(--bs-body-color, #212529));
      font-weight: 700;
      text-align: center;
    }

    .variability-table th,
    .variability-table td {
      width: 33.333%;
      padding: 0.22rem 0.45rem;
      text-align: right;
      white-space: nowrap;
    }

    .variability-table th {
      padding-bottom: 0.4rem;
      border-bottom-color: var(--vt-border-color);
    }

    .variability-table .vt-data-last td {
      border-bottom: 2px solid var(--bc-text, var(--bs-body-color, #212529));
    }

    .variability-table .vt-summary-row td {
      padding-top: 0.32rem;
      color: var(--vt-muted-color);
      font-size: 0.9em;
    }

    .variability-table .vt-summary-row + .vt-summary-row td {
      padding-top: 0.1rem;
    }

    .variability-table .vt-highlight {
      --bc-highlight-bg: var(--vt-highlight-bg);
    }

    .variability-table .vt-summary-value {
      display: inline-flex;
      align-items: baseline;
      gap: 0.18em;
      white-space: nowrap;
    }

    .variability-table .vt-stage-anchor {
      display: inline-block;
      width: 0;
      height: 0;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

bcVariabilityFiniteNumber = (value, fallback = undefined) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

bcVariabilityBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
  return fallback;
}

bcVariabilityHtmlId = (() => {
  let next = 1;
  return (prefix = "variability-table") => `${prefix}-${next++}`;
})()

bcVariabilityNormalizeStageKey = (stage) => {
  if (stage === undefined || stage === null) return null;
  if (typeof stage === "number" && Number.isFinite(stage)) {
    const index = Math.max(0, Math.min(Math.round(stage), bcVariabilityStages.length - 1));
    return bcVariabilityStages[index].key;
  }

  const normalized = String(stage).trim().toLowerCase().replace(/[_ ]+/g, "-");
  return bcVariabilityStageAliases[normalized] || normalized;
}

bcVariabilityStageIndex = (stage, fallback = 0) => {
  const key = bcVariabilityNormalizeStageKey(stage);
  const index = bcVariabilityStages.findIndex((candidate) => candidate.key === key);
  return index >= 0 ? index : fallback;
}

bcVariabilityClampStage = (stage) =>
  Math.max(0, Math.min(bcVariabilityStageIndex(stage, Number(stage) || 0), bcVariabilityStages.length - 1))

bcVariabilityStageLabel = (index) =>
  bcVariabilityStages[Math.max(0, Math.min(index, bcVariabilityStages.length - 1))].label

bcVariabilityAccessor = (accessor, fallbackKeys = []) => {
  if (typeof accessor === "function") return accessor;
  if (typeof accessor === "string") return (row) => row == null ? undefined : row[accessor];
  return (row) => {
    if (row != null && typeof row === "object") {
      for (const key of fallbackKeys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
      }
    }
    return row;
  };
}

bcVariabilityData = (opts = {}) => {
  const source = Array.isArray(opts.data) ? opts.data : [];
  const value = bcVariabilityAccessor(opts.value || opts.x || opts.score, ["value", "x", "score", "X"]);
  return source
    .map((row, index) => ({
      index,
      source: row,
      value: bcVariabilityFiniteNumber(value(row))
    }))
    .filter((row) => Number.isFinite(row.value));
}

bcVariabilityStats = (opts = {}) => {
  const rows = bcVariabilityData(opts);
  const values = rows.map((row) => row.value);
  const n = values.length;
  const mean = bcVariabilityFiniteNumber(opts.mean, n ? values.reduce((sum, value) => sum + value, 0) / n : NaN);
  const deviations = values.map((value) => value - mean);
  const squaredDeviations = deviations.map((value) => value * value);
  const ss = squaredDeviations.reduce((sum, value) => sum + value, 0);
  const sample = bcVariabilityBoolean(opts.sample, String(opts.type || "").toLowerCase() === "sample");
  const denominator = bcVariabilityFiniteNumber(opts.denominator, sample ? n - 1 : n);
  const variance = denominator > 0 ? ss / denominator : NaN;
  const sd = variance >= 0 ? Math.sqrt(variance) : NaN;

  return {
    rows,
    values,
    n,
    mean,
    deviations,
    squaredDeviations,
    ss,
    sample,
    denominator,
    variance,
    sd
  };
}

bcVariabilityNumberFormatter = (digits) => {
  if (typeof digits === "function") return digits;
  if (digits === undefined || digits === null || digits === "auto") {
    return (value) => {
      if (!Number.isFinite(value)) return "";
      if (Math.abs(value - Math.round(value)) < 1e-10) return String(Math.round(value));
      return d3.format(".2~f")(value);
    };
  }

  const places = Math.max(0, Math.round(Number(digits) || 0));
  return (value) => Number.isFinite(value) ? d3.format(`.${places}f`)(value) : "";
}

bcVariabilityFormatters = (opts = {}) => {
  const auto = bcVariabilityNumberFormatter("auto");
  return {
    value: opts.formatValue || bcVariabilityNumberFormatter(opts.valueDigits || opts.digitsValue || "auto"),
    deviation: opts.formatDeviation || bcVariabilityNumberFormatter(opts.deviationDigits || opts.digitsDeviation || "auto"),
    squaredDeviation: opts.formatSquaredDeviation || bcVariabilityNumberFormatter(opts.squaredDeviationDigits || opts.digitsSquaredDeviation || "auto"),
    summary: opts.formatSummary || bcVariabilityNumberFormatter(opts.summaryDigits === undefined ? 2 : opts.summaryDigits),
    auto
  };
}

bcVariabilityInlineMath = function() {
  if (window.interactiveFigure && window.interactiveFigure.inlineMath) {
    return window.interactiveFigure.inlineMath.apply(window.interactiveFigure, arguments);
  }

  const span = document.createElement("span");
  span.className = "math inline";
  span.textContent = Array.prototype.slice.call(arguments).filter((part) => part !== null && part !== undefined).join(" ");
  return span;
}

bcVariabilitySummaryNode = (symbol, value) => {
  const span = document.createElement("span");
  span.className = "vt-summary-value";
  span.appendChild(bcVariabilityInlineMath(`${symbol} =`));
  span.appendChild(document.createTextNode(` ${value}`));
  return span;
}

bcVariabilityAppendContent = (selection, content) => {
  if (content === null || content === undefined) return;
  const node = selection.node();

  if (typeof Element !== "undefined" && content instanceof Element) {
    node.appendChild(content);
    return;
  }

  if (content && typeof content.node === "function") {
    const child = content.node();
    if (child) node.appendChild(child);
    return;
  }

  selection.text(String(content));
}

bcVariabilityAppendReveal = (selection, stage, content, opts = {}) => {
  const span = selection.append("span")
    .attr("class", "vt-reveal-target")
    .attr("data-vt-reveal", bcVariabilityNormalizeStageKey(stage));

  if (opts.highlight) span.classed("vt-highlight bc-highlight", true);
  bcVariabilityAppendContent(span, content);
  return span;
}

bcVariabilitySetRevealVisible = (rootNode, targets, visible, animate) => {
  if (window.interactiveFigure && window.interactiveFigure.setRevealVisible) {
    window.interactiveFigure.setRevealVisible(targets, visible, {
      root: rootNode,
      animate
    });
    return;
  }

  targets.forEach((element) => {
    element.classList.add("bc-if-reveal");
    element.classList.toggle("is-visible", Boolean(visible));
    element.setAttribute("aria-hidden", String(!visible));
  });
}

bcVariabilityButton = (icon, label, className) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `vt-reveal-button bc-icon-button ${className || ""}`.trim();
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = `<i class="bi bi-${icon}" aria-hidden="true"></i><span class="visually-hidden">${label}</span>`;
  return button;
}

// These direct reveal controls are retained for standalone tables in older
// chapters. Tutorial callouts should set controls: false and let the shared
// tutorial wrapper handle navigation. Once the remaining standalone consumers
// have migrated, this control layer and its action handlers can be removed.
bcVariabilityMakeControls = (handlers) => {
  const controls = document.createElement("div");
  controls.className = "vt-reveal-controls bc-action-row";

  const reset = bcVariabilityButton("arrow-counterclockwise", "Reset table", "vt-reset");
  const previous = bcVariabilityButton("chevron-left", "Reveal previous value", "vt-previous");
  const next = bcVariabilityButton("chevron-right", "Reveal next value", "vt-next");
  const all = bcVariabilityButton("eye", "Reveal all values", "vt-all");

  [
    [reset, handlers.reset],
    [previous, handlers.previous],
    [next, handlers.next],
    [all, handlers.all]
  ].forEach(([button, handler]) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler();
    });
  });

  controls.append(reset, previous, next, all);

  return {
    node: controls,
    buttons: { reset, previous, next, all },
    update(stage) {
      reset.disabled = stage <= 0;
      previous.disabled = stage <= 0;
      next.disabled = stage >= bcVariabilityStages.length - 1;
      all.disabled = stage >= bcVariabilityStages.length - 1;
    }
  };
}

bcVariabilityNotify = (rootNode) => {
  const event = typeof InputEvent === "function"
    ? new InputEvent("input", { bubbles: true })
    : new Event("input", { bubbles: true });
  rootNode.dispatchEvent(event);
}

bcVariabilitySyncMath = (rootNode) => {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([rootNode]).catch(() => {});
  }
}

bcVariabilityApplyStageAction = (action, setStage, context) => {
  if (!action || typeof action !== "object") return false;

  const directStage = action.stage === undefined ? action.step : action.stage;
  if (directStage !== undefined) {
    setStage(directStage, { animate: action.animate !== false });
    return true;
  }

  const reveal = action.reveal === undefined ? action.show : action.reveal;
  if (reveal !== undefined) {
    setStage(reveal === true ? "sd" : reveal, { animate: action.animate !== false });
    return true;
  }

  if (bcVariabilityBoolean(action.all || action["show-all"], false)) {
    setStage("sd", { animate: action.animate !== false });
    return true;
  }

  if (bcVariabilityBoolean(action.reset, false)) {
    setStage("data", { animate: action.animate !== false });
    return true;
  }

  if ((action.controls !== undefined || action["controls-open"] !== undefined) &&
      context && typeof context.setControlsOpen === "function") {
    context.setControlsOpen(bcVariabilityBoolean(action.controls ?? action["controls-open"], true));
  }

  let furthest = null;
  Object.entries(action).forEach(([key, value]) => {
    if (!bcVariabilityBoolean(value, false)) return;
    const normalized = bcVariabilityNormalizeStageKey(key);
    const index = bcVariabilityStageIndex(normalized, -1);
    if (index >= 0) furthest = Math.max(furthest === null ? 0 : furthest, index);
  });

  if (furthest !== null) {
    setStage(furthest, { animate: action.animate !== false });
    return true;
  }

  return false;
}

bcVariabilitySetupTutorial = (rootNode, applyTutorialAction, opts = {}) => {
  if (!window.interactiveFigure || !window.interactiveFigure.createTutorial) return;
  if (opts.tutorial === false) return;

  let attempts = 0;
  const setup = () => {
    attempts += 1;
    if (!rootNode.isConnected) {
      if (attempts < 60) requestAnimationFrame(setup);
      return;
    }

    const callout = rootNode.closest(".callout");
    const footer = callout ? callout.querySelector(".callout-footer") : null;
    if (!footer || footer.dataset.bcIfTutorial === "true") return;

    const steps = Array.from(footer.children)
      .filter((child) => child.classList && child.classList.contains("tutorial-step"));
    if (!steps.length) return;

    window.interactiveFigure.createTutorial({
      root: rootNode,
      footer,
      steps,
      startIndex: opts.tutorialStartIndex,
      applyInitialAction: opts.tutorialApplyInitialAction,
      applyAction: applyTutorialAction
    });
  };

  requestAnimationFrame(setup);
}

bcVariabilitySetupFragments = (rootNode, setStage, opts = {}) => {
  if (!bcVariabilityBoolean(opts.fragments, false)) return [];

  const anchors = bcVariabilityStages.slice(1).map((stage, index) => {
    const anchor = document.createElement("span");
    anchor.className = "fragment vt-stage-anchor";
    anchor.dataset.vtFragmentStage = stage.key;
    anchor.dataset.fragmentIndex = String(index);
    rootNode.appendChild(anchor);
    return anchor;
  });

  const updateFromVisibleFragments = () => {
    const visibleCount = anchors.filter((anchor) => anchor.classList.contains("visible")).length;
    setStage(visibleCount, { animate: opts.fragmentAnimation !== false, notify: true });
  };

  const onFragment = (event) => {
    if (!event.fragment || !rootNode.contains(event.fragment)) return;
    requestAnimationFrame(updateFromVisibleFragments);
  };

  document.addEventListener("fragmentshown", onFragment);
  document.addEventListener("fragmenthidden", onFragment);

  const syncReveal = () => {
    if (window.Reveal && typeof window.Reveal.sync === "function") {
      window.Reveal.sync();
    }
  };

  if (rootNode.isConnected) syncReveal();
  else requestAnimationFrame(syncReveal);

  return anchors;
}

bcVariabilityTableNode = (opts = {}) => {
  bcVariabilityEnsureStyles();

  const stats = bcVariabilityStats(opts);
  const format = bcVariabilityFormatters(opts);
  const meanSymbol = opts.meanSymbol || (stats.sample ? "M" : "\\mu");
  const deviationSymbol = opts.deviationSymbol || `X-${meanSymbol}`;
  const squaredDeviationSymbol = opts.squaredDeviationSymbol || `(${deviationSymbol})^2`;
  const varianceSymbol = opts.varianceSymbol || (stats.sample ? "s^2" : "\\sigma^2");
  const sdSymbol = opts.sdSymbol || (stats.sample ? "SD" : "\\sigma");
  const ssSymbol = opts.ssSymbol || "SS";
  const tableId = opts.id || bcVariabilityHtmlId("variability-table");
  const initialStage = bcVariabilityClampStage(opts.initialStage === undefined ? opts.stage : opts.initialStage);
  const root = d3.create("div")
    .attr("class", "variability-table bc-figure")
    .attr("id", tableId)
    .style("--bc-figure-max-width", opts.maxWidth || null)
    .style("--vt-max-width", opts.maxWidth || null);
  const rootNode = root.node();

  rootNode.value = {};

  let stage = initialStage;
  let controls = null;
  let fragmentAnchors = [];

  const setValue = () => {
    rootNode.value = {
      stage,
      stageKey: bcVariabilityStages[stage].key,
      stats
    };
  };

  const setStage = (nextStage, options = {}) => {
    const next = bcVariabilityClampStage(nextStage);
    const changed = next !== stage;
    stage = next;
    root.attr("data-vt-stage", bcVariabilityStages[stage].key);

    const targets = Array.from(rootNode.querySelectorAll("[data-vt-reveal]"));
    targets.forEach((target) => {
      const targetStage = bcVariabilityStageIndex(target.dataset.vtReveal, 0);
      bcVariabilitySetRevealVisible(rootNode, [target], stage >= targetStage, options.animate !== false);
    });

    if (controls) controls.update(stage);
    setValue();

    if (options.notify !== false && changed) bcVariabilityNotify(rootNode);
  };

  const actionHandlers = {
    reset: () => setStage(0, { animate: true }),
    previous: () => setStage(stage - 1, { animate: true }),
    next: () => setStage(stage + 1, { animate: true }),
    all: () => setStage(bcVariabilityStages.length - 1, { animate: true })
  };

  if (opts.title) {
    root.append("div")
      .attr("class", "vt-heading bc-control-title")
      .text(opts.title);
  }

  if (bcVariabilityBoolean(opts.controls, false)) {
    controls = bcVariabilityMakeControls(actionHandlers);
    rootNode.appendChild(controls.node);
  }

  const wrap = root.append("div")
    .attr("class", "vt-table-wrap");
  const table = wrap.append("table")
    .attr("class", "bc-data-table")
    .attr("aria-label", opts.ariaLabel || opts.title || "Variability calculation table");

  if (opts.caption) {
    table.append("caption").text(opts.caption);
  }

  const thead = table.append("thead");
  const header = thead.append("tr");
  header.append("th").append(() => bcVariabilityInlineMath("X"));
  bcVariabilityAppendReveal(header.append("th"), "deviations", bcVariabilityInlineMath(deviationSymbol));
  bcVariabilityAppendReveal(header.append("th"), "squared-deviations", bcVariabilityInlineMath(squaredDeviationSymbol));

  const tbody = table.append("tbody");
  stats.rows.forEach((row, index) => {
    const tr = tbody.append("tr")
      .attr("class", index === stats.rows.length - 1 ? "vt-data-last" : null);
    tr.append("td").text(format.value(row.value));
    bcVariabilityAppendReveal(tr.append("td"), "deviations", format.deviation(stats.deviations[index]));
    bcVariabilityAppendReveal(tr.append("td"), "squared-deviations", format.squaredDeviation(stats.squaredDeviations[index]));
  });

  const summary1 = tbody.append("tr").attr("class", "vt-summary-row bc-table-summary-row");
  bcVariabilityAppendReveal(summary1.append("td"), "mean",
    bcVariabilitySummaryNode(meanSymbol, format.summary(stats.mean)));
  summary1.append("td");
  bcVariabilityAppendReveal(summary1.append("td"), "ss",
    bcVariabilitySummaryNode(ssSymbol, format.summary(stats.ss)));

  const summary2 = tbody.append("tr").attr("class", "vt-summary-row bc-table-summary-row");
  summary2.append("td");
  summary2.append("td");
  bcVariabilityAppendReveal(summary2.append("td"), "variance",
    bcVariabilitySummaryNode(varianceSymbol, format.summary(stats.variance)));

  const summary3 = tbody.append("tr").attr("class", "vt-summary-row bc-table-summary-row");
  summary3.append("td");
  summary3.append("td");
  bcVariabilityAppendReveal(summary3.append("td"), "sd",
    bcVariabilitySummaryNode(sdSymbol, format.summary(stats.sd)));

  const applyTutorialAction = (action, context) =>
    bcVariabilityApplyStageAction(action, setStage, context);

  rootNode.variabilityTable = {
    stats,
    setStage,
    next: actionHandlers.next,
    previous: actionHandlers.previous,
    reset: actionHandlers.reset,
    revealAll: actionHandlers.all,
    applyTutorialAction
  };

  setStage(stage, { animate: false, notify: false });
  bcVariabilitySyncMath(rootNode);

  fragmentAnchors = bcVariabilitySetupFragments(rootNode, setStage, opts);
  bcVariabilitySetupTutorial(rootNode, applyTutorialAction, opts);

  return rootNode;
}

makeVariabilityTable = (opts = {}) => bcVariabilityTableNode(opts)

makeVariabilityTables = (opts = {}) => {
  bcVariabilityEnsureStyles();

  const tableSpecs = Array.isArray(opts.tables) ? opts.tables : [];
  const initialStage = bcVariabilityClampStage(opts.initialStage === undefined ? opts.stage : opts.initialStage);
  const root = d3.create("div")
    .attr("class", "variability-table-set bc-figure")
    .style("--bc-figure-max-width", opts.maxWidth || null)
    .style("--vt-set-max-width", opts.maxWidth || null)
    .style("--vt-grid-gap", opts.gap || null)
    .style("--vt-table-min-width", opts.tableMinWidth || null);
  const rootNode = root.node();

  rootNode.value = {};

  let stage = initialStage;
  let controls = null;
  let tableNodes = [];

  const setValue = () => {
    rootNode.value = {
      stage,
      stageKey: bcVariabilityStages[stage].key,
      tables: tableNodes.map((node) => node.value)
    };
  };

  const setStage = (nextStage, options = {}) => {
    const next = bcVariabilityClampStage(nextStage);
    const changed = next !== stage;
    stage = next;
    root.attr("data-vt-stage", bcVariabilityStages[stage].key);
    tableNodes.forEach((node) => node.variabilityTable.setStage(stage, {
      animate: options.animate !== false,
      notify: false
    }));
    if (controls) controls.update(stage);
    setValue();
    if (options.notify !== false && changed) bcVariabilityNotify(rootNode);
  };

  const actionHandlers = {
    reset: () => setStage(0, { animate: true }),
    previous: () => setStage(stage - 1, { animate: true }),
    next: () => setStage(stage + 1, { animate: true }),
    all: () => setStage(bcVariabilityStages.length - 1, { animate: true })
  };

  if (opts.title) {
    root.append("div")
      .attr("class", "vt-heading bc-control-title")
      .text(opts.title);
  }

  if (bcVariabilityBoolean(opts.controls, true)) {
    controls = bcVariabilityMakeControls(actionHandlers);
    rootNode.appendChild(controls.node);
  }

  const grid = root.append("div")
    .attr("class", "vt-table-grid");

  tableNodes = tableSpecs.map((spec) => {
    const tableNode = makeVariabilityTable(Object.assign({}, opts, spec, {
      controls: false,
      fragments: false,
      tutorial: false,
      initialStage: stage,
      maxWidth: spec.maxWidth || opts.tableMaxWidth || null
    }));
    grid.node().appendChild(tableNode);
    return tableNode;
  });

  const applyTutorialAction = (action, context) =>
    bcVariabilityApplyStageAction(action, setStage, context);

  rootNode.variabilityTables = {
    tables: tableNodes,
    setStage,
    next: actionHandlers.next,
    previous: actionHandlers.previous,
    reset: actionHandlers.reset,
    revealAll: actionHandlers.all,
    applyTutorialAction
  };

  setStage(stage, { animate: false, notify: false });
  bcVariabilitySetupFragments(rootNode, setStage, opts);
  bcVariabilitySetupTutorial(rootNode, applyTutorialAction, opts);

  return rootNode;
}
