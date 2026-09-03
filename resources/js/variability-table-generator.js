sfsVariabilityStages = [
  { key: "data", label: "Data" },
  { key: "mean", label: "Mean" },
  { key: "deviations", label: "Deviations" },
  { key: "squared-deviations", label: "Squared deviations" },
  { key: "ss", label: "SS" },
  { key: "variance", label: "Variance" },
  { key: "sd", label: "SD" }
]

sfsVariabilityStageAliases = ({
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

sfsVariabilityEnsureStyles = () => {
  if (document.getElementById("sfs-variability-table-styles")) return;

  if (window.interactiveFigure) window.interactiveFigure.ensureStyles();

  const style = document.createElement("style");
  style.id = "sfs-variability-table-styles";
  style.textContent = `
    .variability-table,
    .variability-table-set {
      --vt-border-color: var(--sfs-border, var(--bs-border-color, #dee2e6));
      --vt-muted-color: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
      --vt-accent-color: var(--sfs-accent, var(--bs-primary, #2c3e50));
      --vt-highlight-bg: var(--sfs-highlight-bg, color-mix(in srgb, var(--vt-accent-color) 12%, transparent));
      --vt-table-min-width: 18rem;
    }

    .variability-table {
      --sfs-figure-max-width: var(--vt-max-width, 30rem);
    }

    .variability-table-set {
      --sfs-figure-max-width: var(--vt-set-max-width, 58rem);
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
      --sfs-focus: var(--vt-accent-color);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--sfs-button-min-height, 2rem);
      height: var(--sfs-button-min-height, 2rem);
      min-height: var(--sfs-button-min-height, 2rem);
      padding: 0;
      border: 1px solid var(--sfs-border, var(--vt-border-color));
      border-radius: var(--sfs-radius-sm, 4px);
      background: var(--sfs-bg, var(--bs-body-bg, #fff));
      color: var(--sfs-text, var(--bs-body-color, #212529));
      line-height: 1;
      cursor: pointer;
    }

    .variability-table .vt-reveal-button:hover:not(:disabled),
    .variability-table .vt-reveal-button:focus-visible:not(:disabled),
    .variability-table-set .vt-reveal-button:hover:not(:disabled),
    .variability-table-set .vt-reveal-button:focus-visible:not(:disabled) {
      border-color: var(--sfs-focus);
      color: var(--sfs-focus);
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
      table-layout: fixed;
    }

    .variability-table caption {
      caption-side: top;
      padding-bottom: 0.35rem;
      color: var(--sfs-text, var(--bs-body-color, #212529));
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
      padding-bottom: 0.22rem;
      border-bottom-color: var(--vt-border-color);
      line-height: 1;
    }

    .variability-table .vt-data-last td {
      border-bottom: 2px solid var(--sfs-text, var(--bs-body-color, #212529));
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
      --sfs-highlight-bg: var(--vt-highlight-bg);
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

sfsVariabilityFiniteNumber = (value, fallback = undefined) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

sfsVariabilityBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
  return fallback;
}

sfsVariabilityHtmlId = (() => {
  let next = 1;
  return (prefix = "variability-table") => `${prefix}-${next++}`;
})()

sfsVariabilityNormalizeStageKey = (stage) => {
  if (stage === undefined || stage === null) return null;
  if (typeof stage === "number" && Number.isFinite(stage)) {
    const index = Math.max(0, Math.min(Math.round(stage), sfsVariabilityStages.length - 1));
    return sfsVariabilityStages[index].key;
  }

  const normalized = String(stage).trim().toLowerCase().replace(/[_ ]+/g, "-");
  return sfsVariabilityStageAliases[normalized] || normalized;
}

sfsVariabilityStageIndex = (stage, fallback = 0) => {
  const key = sfsVariabilityNormalizeStageKey(stage);
  const index = sfsVariabilityStages.findIndex((candidate) => candidate.key === key);
  return index >= 0 ? index : fallback;
}

sfsVariabilityClampStage = (stage) =>
  Math.max(0, Math.min(sfsVariabilityStageIndex(stage, Number(stage) || 0), sfsVariabilityStages.length - 1))

sfsVariabilityStageLabel = (index) =>
  sfsVariabilityStages[Math.max(0, Math.min(index, sfsVariabilityStages.length - 1))].label

sfsVariabilityAccessor = (accessor, fallbackKeys = []) => {
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

sfsVariabilityData = (opts = {}) => {
  const source = Array.isArray(opts.data) ? opts.data : [];
  const value = sfsVariabilityAccessor(opts.value || opts.x || opts.score, ["value", "x", "score", "X"]);
  return source
    .map((row, index) => ({
      index,
      source: row,
      value: sfsVariabilityFiniteNumber(value(row))
    }))
    .filter((row) => Number.isFinite(row.value));
}

sfsVariabilityStats = (opts = {}) => {
  const rows = sfsVariabilityData(opts);
  const values = rows.map((row) => row.value);
  const n = values.length;
  const mean = sfsVariabilityFiniteNumber(opts.mean, n ? values.reduce((sum, value) => sum + value, 0) / n : NaN);
  const deviations = values.map((value) => value - mean);
  const squaredDeviations = deviations.map((value) => value * value);
  const ss = squaredDeviations.reduce((sum, value) => sum + value, 0);
  const sample = sfsVariabilityBoolean(opts.sample, String(opts.type || "").toLowerCase() === "sample");
  const denominator = sfsVariabilityFiniteNumber(opts.denominator, sample ? n - 1 : n);
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

sfsVariabilityNumberFormatter = (digits) => {
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

sfsVariabilityFormatters = (opts = {}) => {
  const auto = sfsVariabilityNumberFormatter("auto");
  return {
    value: opts.formatValue || sfsVariabilityNumberFormatter(opts.valueDigits || opts.digitsValue || "auto"),
    deviation: opts.formatDeviation || sfsVariabilityNumberFormatter(opts.deviationDigits || opts.digitsDeviation || "auto"),
    squaredDeviation: opts.formatSquaredDeviation || sfsVariabilityNumberFormatter(opts.squaredDeviationDigits || opts.digitsSquaredDeviation || "auto"),
    summary: opts.formatSummary || sfsVariabilityNumberFormatter(opts.summaryDigits === undefined ? 2 : opts.summaryDigits),
    auto
  };
}

sfsVariabilityInlineMath = function() {
  if (window.interactiveFigure && window.interactiveFigure.inlineMath) {
    return window.interactiveFigure.inlineMath.apply(window.interactiveFigure, arguments);
  }

  const span = document.createElement("span");
  span.className = "math inline";
  span.textContent = Array.prototype.slice.call(arguments).filter((part) => part !== null && part !== undefined).join(" ");
  return span;
}

sfsVariabilitySummaryNode = (symbol, value) => {
  const span = document.createElement("span");
  span.className = "vt-summary-value";
  span.appendChild(sfsVariabilityInlineMath(`${symbol} = ${value}`));
  return span;
}

sfsVariabilityAppendContent = (selection, content) => {
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

sfsVariabilityAppendReveal = (selection, stage, content, opts = {}) => {
  const span = selection.append("span")
    .attr("class", "vt-reveal-target")
    .attr("data-vt-reveal", sfsVariabilityNormalizeStageKey(stage));

  if (opts.highlight) span.classed("vt-highlight sfs-highlight", true);
  sfsVariabilityAppendContent(span, content);
  return span;
}

sfsVariabilitySetRevealVisible = (rootNode, targets, visible, animate) => {
  if (window.interactiveFigure && window.interactiveFigure.setRevealVisible) {
    window.interactiveFigure.setRevealVisible(targets, visible, {
      root: rootNode,
      animate
    });
    return;
  }

  targets.forEach((element) => {
    element.classList.add("sfs-if-reveal");
    element.classList.toggle("is-visible", Boolean(visible));
    element.setAttribute("aria-hidden", String(!visible));
  });
}

sfsVariabilityButton = (icon, label, className) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `vt-reveal-button sfs-icon-button ${className || ""}`.trim();
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = `<i class="bi bi-${icon}" aria-hidden="true"></i><span class="visually-hidden">${label}</span>`;
  return button;
}

// These direct reveal controls are retained for standalone tables in older
// chapters. Tutorial callouts should set controls: false and let the shared
// tutorial wrapper handle navigation. Once the remaining standalone consumers
// have migrated, this control layer and its action handlers can be removed.
sfsVariabilityMakeControls = (handlers) => {
  const controls = document.createElement("div");
  controls.className = "vt-reveal-controls sfs-action-row";

  const reset = sfsVariabilityButton("arrow-counterclockwise", "Reset table", "vt-reset");
  const previous = sfsVariabilityButton("chevron-left", "Reveal previous value", "vt-previous");
  const next = sfsVariabilityButton("chevron-right", "Reveal next value", "vt-next");
  const all = sfsVariabilityButton("eye", "Reveal all values", "vt-all");

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
      next.disabled = stage >= sfsVariabilityStages.length - 1;
      all.disabled = stage >= sfsVariabilityStages.length - 1;
    }
  };
}

sfsVariabilityNotify = (rootNode) => {
  const event = typeof InputEvent === "function"
    ? new InputEvent("input", { bubbles: true })
    : new Event("input", { bubbles: true });
  rootNode.dispatchEvent(event);
}

sfsVariabilitySyncMath = (rootNode) => {
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise([rootNode]).catch(() => {});
  }
}

sfsVariabilityApplyStageAction = (action, setStage, context) => {
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

  if (sfsVariabilityBoolean(action.all || action["show-all"], false)) {
    setStage("sd", { animate: action.animate !== false });
    return true;
  }

  if (sfsVariabilityBoolean(action.reset, false)) {
    setStage("data", { animate: action.animate !== false });
    return true;
  }

  if ((action.controls !== undefined || action["controls-open"] !== undefined) &&
      context && typeof context.setControlsOpen === "function") {
    context.setControlsOpen(sfsVariabilityBoolean(action.controls ?? action["controls-open"], true));
  }

  let furthest = null;
  Object.entries(action).forEach(([key, value]) => {
    if (!sfsVariabilityBoolean(value, false)) return;
    const normalized = sfsVariabilityNormalizeStageKey(key);
    const index = sfsVariabilityStageIndex(normalized, -1);
    if (index >= 0) furthest = Math.max(furthest === null ? 0 : furthest, index);
  });

  if (furthest !== null) {
    setStage(furthest, { animate: action.animate !== false });
    return true;
  }

  return false;
}

sfsVariabilitySetupTutorial = (rootNode, applyTutorialAction, opts = {}) => {
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
    if (!footer || footer.dataset.sfsIfTutorial === "true") return;

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

sfsVariabilitySetupFragments = (rootNode, setStage, opts = {}) => {
  if (!sfsVariabilityBoolean(opts.fragments, false)) return [];

  const anchors = sfsVariabilityStages.slice(1).map((stage, index) => {
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

sfsVariabilityTableNode = (opts = {}) => {
  sfsVariabilityEnsureStyles();

  const stats = sfsVariabilityStats(opts);
  const format = sfsVariabilityFormatters(opts);
  const meanSymbol = opts.meanSymbol || (stats.sample ? "M" : "\\mu");
  const deviationSymbol = opts.deviationSymbol || `X-${meanSymbol}`;
  const squaredDeviationSymbol = opts.squaredDeviationSymbol || `(${deviationSymbol})^2`;
  const varianceSymbol = opts.varianceSymbol || (stats.sample ? "s^2" : "\\sigma^2");
  const sdSymbol = opts.sdSymbol || (stats.sample ? "SD" : "\\sigma");
  const ssSymbol = opts.ssSymbol || "SS";
  const tableId = opts.id || sfsVariabilityHtmlId("variability-table");
  const initialStage = sfsVariabilityClampStage(opts.initialStage === undefined ? opts.stage : opts.initialStage);
  const root = d3.create("div")
    .attr("class", "variability-table sfs-figure")
    .attr("id", tableId)
    .style("--sfs-figure-max-width", opts.maxWidth || null)
    .style("--vt-max-width", opts.maxWidth || null);
  const rootNode = root.node();

  rootNode.value = {};

  let stage = initialStage;
  let controls = null;
  let fragmentAnchors = [];

  const setValue = () => {
    rootNode.value = {
      stage,
      stageKey: sfsVariabilityStages[stage].key,
      stats
    };
  };

  const setStage = (nextStage, options = {}) => {
    const next = sfsVariabilityClampStage(nextStage);
    const changed = next !== stage;
    stage = next;
    root.attr("data-vt-stage", sfsVariabilityStages[stage].key);

    const targets = Array.from(rootNode.querySelectorAll("[data-vt-reveal]"));
    targets.forEach((target) => {
      const targetStage = sfsVariabilityStageIndex(target.dataset.vtReveal, 0);
      sfsVariabilitySetRevealVisible(rootNode, [target], stage >= targetStage, options.animate !== false);
    });

    if (controls) controls.update(stage);
    setValue();

    if (options.notify !== false && changed) sfsVariabilityNotify(rootNode);
  };

  const actionHandlers = {
    reset: () => setStage(0, { animate: true }),
    previous: () => setStage(stage - 1, { animate: true }),
    next: () => setStage(stage + 1, { animate: true }),
    all: () => setStage(sfsVariabilityStages.length - 1, { animate: true })
  };

  if (opts.title) {
    root.append("div")
      .attr("class", "vt-heading sfs-control-title")
      .text(opts.title);
  }

  if (sfsVariabilityBoolean(opts.controls, false)) {
    controls = sfsVariabilityMakeControls(actionHandlers);
    rootNode.appendChild(controls.node);
  }

  const wrap = root.append("div")
    .attr("class", "vt-table-wrap");
  const table = wrap.append("table")
    .attr("class", "sfs-data-table")
    .attr("aria-label", opts.ariaLabel || opts.title || "Variability calculation table");

  if (opts.caption) {
    table.append("caption").text(opts.caption);
  }

  const thead = table.append("thead");
  const header = thead.append("tr");
  header.append("th").append(() => sfsVariabilityInlineMath("X"));
  sfsVariabilityAppendReveal(header.append("th"), "deviations", sfsVariabilityInlineMath(deviationSymbol));
  sfsVariabilityAppendReveal(header.append("th"), "squared-deviations", sfsVariabilityInlineMath(squaredDeviationSymbol));

  const tbody = table.append("tbody");
  stats.rows.forEach((row, index) => {
    const tr = tbody.append("tr")
      .attr("class", index === stats.rows.length - 1 ? "vt-data-last" : null);
    tr.append("td").text(format.value(row.value));
    sfsVariabilityAppendReveal(tr.append("td"), "deviations", format.deviation(stats.deviations[index]));
    sfsVariabilityAppendReveal(tr.append("td"), "squared-deviations", format.squaredDeviation(stats.squaredDeviations[index]));
  });

  const summary1 = tbody.append("tr").attr("class", "vt-summary-row sfs-table-summary-row");
  sfsVariabilityAppendReveal(summary1.append("td"), "mean",
    sfsVariabilitySummaryNode(meanSymbol, format.summary(stats.mean)));
  summary1.append("td");
  sfsVariabilityAppendReveal(summary1.append("td"), "ss",
    sfsVariabilitySummaryNode(ssSymbol, format.summary(stats.ss)));

  const summary2 = tbody.append("tr").attr("class", "vt-summary-row sfs-table-summary-row");
  summary2.append("td");
  summary2.append("td");
  sfsVariabilityAppendReveal(summary2.append("td"), "variance",
    sfsVariabilitySummaryNode(varianceSymbol, format.summary(stats.variance)));

  const summary3 = tbody.append("tr").attr("class", "vt-summary-row sfs-table-summary-row");
  summary3.append("td");
  summary3.append("td");
  sfsVariabilityAppendReveal(summary3.append("td"), "sd",
    sfsVariabilitySummaryNode(sdSymbol, format.summary(stats.sd)));

  const applyTutorialAction = (action, context) =>
    sfsVariabilityApplyStageAction(action, setStage, context);

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
  sfsVariabilitySyncMath(rootNode);

  fragmentAnchors = sfsVariabilitySetupFragments(rootNode, setStage, opts);
  sfsVariabilitySetupTutorial(rootNode, applyTutorialAction, opts);

  return rootNode;
}

makeVariabilityTable = (opts = {}) => sfsVariabilityTableNode(opts)

makeVariabilityTables = (opts = {}) => {
  sfsVariabilityEnsureStyles();

  const tableSpecs = Array.isArray(opts.tables) ? opts.tables : [];
  const initialStage = sfsVariabilityClampStage(opts.initialStage === undefined ? opts.stage : opts.initialStage);
  const root = d3.create("div")
    .attr("class", "variability-table-set sfs-figure")
    .style("--sfs-figure-max-width", opts.maxWidth || null)
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
      stageKey: sfsVariabilityStages[stage].key,
      tables: tableNodes.map((node) => node.value)
    };
  };

  const setStage = (nextStage, options = {}) => {
    const next = sfsVariabilityClampStage(nextStage);
    const changed = next !== stage;
    stage = next;
    root.attr("data-vt-stage", sfsVariabilityStages[stage].key);
    tableNodes.forEach((node) => node.variabilityTable.setStage(stage, {
      animate: options.animate !== false,
      notify: false
    }));
    if (controls) controls.update(stage);
    setValue();
    if (options.notify !== false && changed) sfsVariabilityNotify(rootNode);
  };

  const actionHandlers = {
    reset: () => setStage(0, { animate: true }),
    previous: () => setStage(stage - 1, { animate: true }),
    next: () => setStage(stage + 1, { animate: true }),
    all: () => setStage(sfsVariabilityStages.length - 1, { animate: true })
  };

  if (opts.title) {
    root.append("div")
      .attr("class", "vt-heading sfs-control-title")
      .text(opts.title);
  }

  if (sfsVariabilityBoolean(opts.controls, true)) {
    controls = sfsVariabilityMakeControls(actionHandlers);
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
    sfsVariabilityApplyStageAction(action, setStage, context);

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
  sfsVariabilitySetupFragments(rootNode, setStage, opts);
  sfsVariabilitySetupTutorial(rootNode, applyTutorialAction, opts);

  return rootNode;
}
