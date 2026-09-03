bcCriticalTableStats = window.bcStats || {}

bcCriticalTableValueOr = (value, fallback) =>
  value === undefined || value === null ? fallback : value

bcCriticalTableFiniteNumber = (value, fallback = undefined) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

bcCriticalTablePositiveNumber = (value, fallback = undefined) => {
  const number = bcCriticalTableFiniteNumber(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

bcCriticalTableBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
  return fallback;
}

bcCriticalTableAsArray = (value, fallback = []) => {
  const source = bcCriticalTableValueOr(value, fallback);
  return Array.isArray(source) ? source.slice() : [source].filter((item) => item !== undefined && item !== null);
}

bcCriticalTableNormalizeKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-")

bcCriticalTableRound = (value, digits = 12) => {
  if (!Number.isFinite(value)) return value;
  const factor = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

bcCriticalTableHtmlId = (() => {
  let next = 1;
  return (prefix = "critical-value-table") => `${prefix}-${next++}`;
})()

bcCriticalTableNormalizeDistribution = (value) => {
  const key = bcCriticalTableNormalizeKey(value || "normal");
  if (["normal", "norm", "gaussian", "z", "z-score", "unit-normal"].includes(key)) return "normal";
  if (["t", "student", "student-t", "student-t-distribution"].includes(key)) return "t";
  if (["f", "f-distribution", "variance-ratio"].includes(key)) return "f";
  return key;
}

bcCriticalTableNormalizeLayout = (value, distribution) => {
  const key = bcCriticalTableNormalizeKey(value || "");
  if (distribution === "normal") {
    if (["lookup", "traditional", "unit-normal", "matrix"].includes(key)) return "lookup";
    return "areas";
  }
  return key || "critical-values";
}

bcCriticalTableNormalizeArea = (value) => {
  const key = bcCriticalTableNormalizeKey(value || "left");
  if (["left", "lower", "below", "less-than", "less"].includes(key)) return "left";
  if (["right", "upper", "above", "greater-than", "greater"].includes(key)) return "right";
  if (["mean-to-z", "mean-to-score", "between-mean-and-z", "mean", "between"].includes(key)) return "mean-to-z";
  if (["two-tail", "two-tailed", "two-tails", "both-tails", "extreme"].includes(key)) return "two-tail";
  if (["central", "center", "middle", "between-negative-and-positive"].includes(key)) return "central";
  return key;
}

bcCriticalTableNormalizeTail = (value) => {
  const key = bcCriticalTableNormalizeKey(value || "right");
  if (["one", "one-tail", "one-tailed", "right", "upper", "greater", "greater-than"].includes(key)) return "right";
  if (["left", "lower", "less", "less-than"].includes(key)) return "left";
  if (["two", "two-tail", "two-tailed", "both", "both-tails"].includes(key)) return "two";
  return key;
}

bcCriticalTableNumberFrom = (value) => {
  if (value === Infinity || value === -Infinity) return value;
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (["infinity", "+infinity", "inf", "+inf"].includes(key)) return Infinity;
    if (["-infinity", "-inf"].includes(key)) return -Infinity;
  }
  return bcCriticalTableFiniteNumber(value);
}

bcCriticalTableSequence = (source, fallback = []) => {
  if (Array.isArray(source)) {
    return source
      .map(bcCriticalTableNumberFrom)
      .filter((value) => Number.isFinite(value) || value === Infinity || value === -Infinity);
  }

  if (typeof source === "number" && Number.isFinite(source)) {
    return bcCriticalTableSequence({ from: 1, to: source, step: 1 }, fallback);
  }

  if (typeof source === "string") {
    const rangeMatch = source.trim().match(/^(-?\d+(?:\.\d+)?)\s*:\s*(-?\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
      return bcCriticalTableSequence({ from: Number(rangeMatch[1]), to: Number(rangeMatch[2]), step: 1 }, fallback);
    }
  }

  if (source && typeof source === "object") {
    const from = bcCriticalTableFiniteNumber(
      bcCriticalTableValueOr(source.from, bcCriticalTableValueOr(source.start, source.min)),
      1
    );
    const to = bcCriticalTableFiniteNumber(
      bcCriticalTableValueOr(source.to, bcCriticalTableValueOr(source.end, source.max)),
      from
    );
    const rawStep = bcCriticalTablePositiveNumber(
      bcCriticalTableValueOr(source.step, bcCriticalTableValueOr(source.by, source.increment)),
      1
    );
    const direction = to >= from ? 1 : -1;
    const step = rawStep * direction;
    const values = [];
    const epsilon = Math.abs(step) / 1e6;

    if (direction > 0) {
      for (let value = from; value <= to + epsilon; value += step) {
        values.push(bcCriticalTableRound(value));
      }
    } else {
      for (let value = from; value >= to - epsilon; value += step) {
        values.push(bcCriticalTableRound(value));
      }
    }

    if (bcCriticalTableBoolean(source.includeInfinity || source.infinity || source.includeInf, false)) {
      values.push(Infinity);
    }

    return values;
  }

  return fallback.slice();
}

bcCriticalTableFormatNumber = (value, digits = 3, opts = {}) => {
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (!Number.isFinite(value)) return "";

  const places = Math.max(0, Math.round(Number(digits) || 0));
  let text = value.toFixed(places);
  if (opts.trim) {
    text = text.replace(/(\.\d*?)0+$/g, "$1").replace(/\.$/g, "");
  }
  if (opts.omitLeadingZero) {
    text = text.replace(/^(-?)0\./, "$1.");
  }
  return text;
}

bcCriticalTableDfLabel = (value) =>
  value === Infinity ? "Infinity" : bcCriticalTableFormatNumber(value, 0, { trim: true })

bcCriticalTableAlphaLabel = (alpha) =>
  bcCriticalTableFormatNumber(
    alpha,
    alpha < 0.01 || Math.abs(alpha * 100 - Math.round(alpha * 100)) > 1e-9 ? 3 : 2,
    { trim: true, omitLeadingZero: true }
  )

bcCriticalTablePercentLabel = (value) => {
  if (!Number.isFinite(value)) return "";
  const percent = value * 100;
  const digits = Math.abs(percent - Math.round(percent)) < 1e-9 ? 0 : 1;
  return `${bcCriticalTableFormatNumber(percent, digits, { trim: true })}%`;
}

bcCriticalTableAreaLabel = (area) => {
  const key = bcCriticalTableNormalizeArea(area);
  if (key === "left") return "Area left of z";
  if (key === "right") return "Area right of z";
  if (key === "mean-to-z") return "Area between mean and z";
  if (key === "two-tail") return "Area in both tails";
  if (key === "central") return "Central area";
  return String(area);
}

bcCriticalTableTailLabel = (tail, alpha) => {
  const key = bcCriticalTableNormalizeTail(tail);
  const alphaText = bcCriticalTableAlphaLabel(alpha);
  if (key === "two") return `two-tailed ${alphaText}`;
  if (key === "left") return `left-tailed ${alphaText}`;
  return `one-tailed ${alphaText}`;
}

bcCriticalTableNormalArea = (area, z) => {
  const key = bcCriticalTableNormalizeArea(area);
  const left = bcCriticalTableStats.normalCdf(z, 0, 1);
  if (key === "right") return 1 - left;
  if (key === "mean-to-z") return Math.abs(left - 0.5);
  if (key === "two-tail") return 2 * Math.min(left, 1 - left);
  if (key === "central") return bcCriticalTableStats.normalCdf(Math.abs(z), 0, 1) - bcCriticalTableStats.normalCdf(-Math.abs(z), 0, 1);
  return left;
}

bcCriticalTableNormalShade = (area, z) => {
  const key = bcCriticalTableNormalizeArea(area);
  if (key === "right") return [{ from: z, to: Infinity }];
  if (key === "mean-to-z") return [{ from: Math.min(0, z), to: Math.max(0, z) }];
  if (key === "two-tail") {
    const cutoff = Math.abs(z);
    return [
      { from: -Infinity, to: -cutoff },
      { from: cutoff, to: Infinity }
    ];
  }
  if (key === "central") {
    const cutoff = Math.abs(z);
    return [{ from: -cutoff, to: cutoff }];
  }
  return [{ from: -Infinity, to: z }];
}

bcCriticalTableTQuantile = (tail, alpha, df) => {
  const key = bcCriticalTableNormalizeTail(tail);
  if (df === Infinity) {
    if (key === "left") return bcCriticalTableStats.normalInv(alpha, 0, 1);
    if (key === "two") return bcCriticalTableStats.normalInv(1 - alpha / 2, 0, 1);
    return bcCriticalTableStats.normalInv(1 - alpha, 0, 1);
  }
  if (key === "left") return bcCriticalTableStats.tInv(alpha, df);
  if (key === "two") return bcCriticalTableStats.tInv(1 - alpha / 2, df);
  return bcCriticalTableStats.tInv(1 - alpha, df);
}

bcCriticalTableFQuantile = (tail, alpha, df1, df2) => {
  const key = bcCriticalTableNormalizeTail(tail);
  if (key === "left") return bcCriticalTableStats.fInv(alpha, df1, df2);
  return bcCriticalTableStats.fInv(1 - alpha, df1, df2);
}

bcCriticalTableCriticalShade = (tail, alpha) => {
  const key = bcCriticalTableNormalizeTail(tail);
  if (key === "left") return { tail: "left", alpha };
  if (key === "two") return { tail: "two", alpha };
  return { tail: "right", alpha };
}

bcCriticalTableSelectionMatches = (meta, selection) => {
  if (!selection || typeof selection !== "object") return false;

  return Object.entries(selection).every(([key, value]) => {
    if (["animate", "duration", "controls", "controls-open", "show-controls"].includes(bcCriticalTableNormalizeKey(key))) return true;
    if (key === "area") return bcCriticalTableNormalizeArea(meta.area) === bcCriticalTableNormalizeArea(value);
    if (key === "tail") return bcCriticalTableNormalizeTail(meta.tail) === bcCriticalTableNormalizeTail(value);
    if (key === "distribution") return bcCriticalTableNormalizeDistribution(meta.distribution) === bcCriticalTableNormalizeDistribution(value);
    if (key === "layout") return bcCriticalTableNormalizeLayout(meta.layout, meta.distribution) === bcCriticalTableNormalizeLayout(value, meta.distribution);

    const metaValue = meta[key];
    const targetValue = bcCriticalTableNumberFrom(value);
    if (Number.isFinite(metaValue) && Number.isFinite(targetValue)) return Math.abs(metaValue - targetValue) < 1e-9;
    return String(metaValue) === String(value);
  });
}

bcCriticalTableNotify = (rootNode) => {
  const event = typeof InputEvent === "function"
    ? new InputEvent("input", { bubbles: true })
    : new Event("input", { bubbles: true });
  rootNode.dispatchEvent(event);
}

bcCriticalTableEnsureStyles = () => {
  if (document.getElementById("sfs-critical-table-styles")) return;
  if (window.interactiveFigure) window.interactiveFigure.ensureStyles();

  const style = document.createElement("style");
  style.id = "sfs-critical-table-styles";
  style.textContent = `
    .critical-value-table {
      --cvt-muted-color: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
      --cvt-accent-color: var(--sfs-accent, var(--bs-primary, #2c3e50));
      --cvt-highlight-bg: var(--sfs-highlight-bg, color-mix(in srgb, var(--cvt-accent-color) 12%, transparent));
      --sfs-figure-max-width: var(--cvt-max-width, 54rem);
    }

    .critical-value-table .cvt-heading {
      margin: 0 0 0.45rem;
      font-size: 1rem;
      font-weight: 700;
      line-height: 1.25;
      text-align: center;
    }

    .critical-value-table .cvt-table-wrap {
      overflow-x: auto;
    }

    .critical-value-table .cvt-table-wrap.cvt-scrollable {
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
    }

    .critical-value-table .cvt-table-wrap.cvt-scrollable.cvt-scroll-at-top:not(.cvt-scroll-at-bottom) {
      box-shadow: inset 0 -1rem 0.8rem -0.85rem color-mix(in srgb, var(--sfs-text, var(--bs-body-color, #212529)) 45%, transparent);
    }

    .critical-value-table .cvt-table-wrap.cvt-scrollable.cvt-scroll-at-bottom:not(.cvt-scroll-at-top) {
      box-shadow: inset 0 1rem 0.8rem -0.85rem color-mix(in srgb, var(--sfs-text, var(--bs-body-color, #212529)) 45%, transparent);
    }

    .critical-value-table .cvt-table-wrap.cvt-scrollable:not(.cvt-scroll-at-top):not(.cvt-scroll-at-bottom) {
      box-shadow:
        inset 0 1rem 0.8rem -0.85rem color-mix(in srgb, var(--sfs-text, var(--bs-body-color, #212529)) 45%, transparent),
        inset 0 -1rem 0.8rem -0.85rem color-mix(in srgb, var(--sfs-text, var(--bs-body-color, #212529)) 45%, transparent);
    }

    .critical-value-table table {
      width: 100%;
      min-width: var(--cvt-table-min-width, 30rem);
      margin: 0 auto;
      font-variant-numeric: tabular-nums;
      table-layout: auto;
    }

    .critical-value-table caption {
      caption-side: top;
      padding-bottom: 0.35rem;
      color: var(--sfs-text, var(--bs-body-color, #212529));
      font-weight: 700;
      text-align: center;
    }

    .critical-value-table th,
    .critical-value-table td {
      padding: 0.22rem 0.42rem;
      text-align: right;
      white-space: nowrap;
      vertical-align: middle;
    }

    .critical-value-table th {
      color: var(--sfs-text, var(--bs-body-color, #212529));
      font-weight: 700;
    }

    .critical-value-table .cvt-header-group {
      text-align: center;
    }

    .critical-value-table .cvt-header-label,
    .critical-value-table .cvt-body-label {
      text-align: left;
    }

    .critical-value-table .cvt-body-label {
      vertical-align: top;
    }

    .critical-value-table .cvt-body-header th:not(:first-child) {
      text-align: center;
    }

    .critical-value-table .cvt-row-selected th,
    .critical-value-table .cvt-selected {
      background: var(--cvt-highlight-bg);
    }

    .critical-value-table .cvt-cell-button {
      display: block;
      width: 100%;
      min-width: var(--cvt-cell-min-width, 2.8rem);
      padding: 0.08rem 0.2rem;
      border: 1px solid transparent;
      border-radius: var(--sfs-radius-sm, 4px);
      background: transparent;
      color: inherit;
      font: inherit;
      line-height: 1.25;
      text-align: right;
      cursor: pointer;
    }

    .critical-value-table .cvt-cell-button:hover,
    .critical-value-table .cvt-cell-button:focus-visible {
      border-color: var(--cvt-accent-color);
      color: var(--cvt-accent-color);
      outline: none;
    }

    .critical-value-table .cvt-cell-button[aria-pressed="true"] {
      border-color: var(--cvt-accent-color);
      background: var(--cvt-highlight-bg);
      color: var(--sfs-text, var(--bs-body-color, #212529));
      font-weight: 700;
    }

    .critical-value-table .cvt-note {
      margin: 0.45rem 0 0;
      color: var(--cvt-muted-color);
      font-size: 0.9rem;
      line-height: 1.35;
    }
  `;
  document.head.appendChild(style);
}

bcCriticalTableWrapNode = (node) => {
  const api = {
    node() {
      return node;
    },
    append(tagName) {
      const child = document.createElement(tagName);
      node.appendChild(child);
      return bcCriticalTableWrapNode(child);
    },
    attr(name, value) {
      if (value === undefined || value === null) node.removeAttribute(name);
      else node.setAttribute(name, String(value));
      return api;
    },
    style(name, value) {
      if (value === undefined || value === null || value === "") node.style.removeProperty(name);
      else node.style.setProperty(name, String(value));
      return api;
    },
    text(value) {
      node.textContent = value === undefined || value === null ? "" : String(value);
      return api;
    },
    html(value) {
      node.innerHTML = value === undefined || value === null ? "" : String(value);
      return api;
    },
    on(type, handler) {
      node.addEventListener(type, handler);
      return api;
    }
  };

  return api;
}

bcCriticalTableCreate = (tagName) =>
  bcCriticalTableWrapNode(document.createElement(tagName))

bcCriticalTableRange = (count) =>
  Array.from({ length: Math.max(0, Math.round(count)) }, (value, index) => index)

bcCriticalTableBuildRoot = (opts = {}, className = "") => {
  bcCriticalTableEnsureStyles();
  const root = bcCriticalTableCreate("div")
    .attr("class", `critical-value-table sfs-figure ${className}`.trim())
    .attr("id", opts.id || null)
    .style("--cvt-max-width", opts.maxWidth || null)
    .style("--cvt-table-min-width", opts.tableMinWidth || null)
    .style("--cvt-cell-min-width", opts.cellMinWidth || opts.tableCellMinWidth || null)
    .style("--sfs-figure-margin", opts.cssMargin || opts.marginCss || null);

  if (opts.title) {
    root.append("div")
      .attr("class", "cvt-heading sfs-control-title")
      .text(opts.title);
  }

  return root;
}

bcCriticalTableCssLength = (value) => {
  if (value === undefined || value === null || value === false || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  return String(value);
}

bcCriticalTableSetupScrollAffordance = (wrap) => {
  const node = wrap.node();

  const update = () => {
    const scrollable = node.scrollHeight > node.clientHeight + 1;
    node.classList.toggle("cvt-scrollable", scrollable);

    if (!scrollable) {
      node.classList.remove("cvt-scroll-at-top", "cvt-scroll-at-bottom");
      return;
    }

    node.classList.toggle("cvt-scroll-at-top", node.scrollTop <= 1);
    node.classList.toggle(
      "cvt-scroll-at-bottom",
      node.scrollTop + node.clientHeight >= node.scrollHeight - 1
    );
  };

  node.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node._bcCriticalTableScrollObserver = observer;
  }

  requestAnimationFrame(() => {
    if (node.firstElementChild && node._bcCriticalTableScrollObserver) {
      node._bcCriticalTableScrollObserver.observe(node.firstElementChild);
    }
    update();
  });
}

bcCriticalTableApplyTableWrapOptions = (wrap, opts = {}) => {
  const maxHeight = bcCriticalTableCssLength(
    bcCriticalTableValueOr(opts.tableMaxHeight, bcCriticalTableValueOr(opts.maxTableHeight, opts.scrollHeight))
  );

  if (maxHeight) {
    wrap
      .style("max-height", maxHeight)
      .style("overflow-y", "auto");
    bcCriticalTableSetupScrollAffordance(wrap);
  }

  return wrap;
}

bcCriticalTableAppendNote = (root, opts = {}) => {
  if (!opts.note) return;
  root.append("p")
    .attr("class", "cvt-note")
    .text(opts.note);
}

bcCriticalTableIsInteractive = (opts = {}) =>
  bcCriticalTableBoolean(
    bcCriticalTableValueOr(opts.interactive, bcCriticalTableValueOr(opts.selectable, opts.clickable)),
    true
  )

bcCriticalTableFinish = (rootNode, cellMetas, opts = {}) => {
  if (!bcCriticalTableIsInteractive(opts)) {
    rootNode.value = {};
    return rootNode;
  }

  bcCriticalTableInteractiveController(rootNode, cellMetas, opts);
  bcCriticalTableSetupTutorial(rootNode, opts);
  return rootNode;
}

bcCriticalTableInteractiveController = (rootNode, cellMetas, opts = {}) => {
  let selected = null;

  const setSelected = (meta, options = {}) => {
    if (!meta) return false;
    const changed = !selected ||
      selected.key !== meta.key ||
      selected.tail !== meta.tail ||
      selected.alpha !== meta.alpha;
    selected = meta;
    rootNode.value = Object.assign({}, meta);

    rootNode.querySelectorAll("[data-cvt-key]").forEach((element) => {
      const active = element.dataset.cvtKey === meta.key;
      element.classList.toggle("cvt-selected", active);
      if (element.tagName === "BUTTON") element.setAttribute("aria-pressed", String(active));
    });

    rootNode.querySelectorAll("[data-cvt-row-key]").forEach((element) => {
      element.classList.toggle("cvt-row-selected", element.dataset.cvtRowKey === meta.rowKey);
    });

    if (changed && options.notify !== false) bcCriticalTableNotify(rootNode);
    return true;
  };

  const select = (selection, options = {}) => {
    const target = cellMetas.find((meta) => bcCriticalTableSelectionMatches(meta, selection));
    return setSelected(target, options);
  };

  const applyTutorialAction = (action, context) => {
    if (!action || typeof action !== "object") return false;
    if ((action.controls !== undefined || action["controls-open"] !== undefined) &&
        context && typeof context.setControlsOpen === "function") {
      context.setControlsOpen(bcCriticalTableBoolean(action.controls ?? action["controls-open"], true));
    }
    return select(action, { animate: action.animate !== false });
  };

  rootNode.criticalValueTable = {
    cells: cellMetas,
    select,
    setSelected,
    applyTutorialAction,
    getSelected() {
      return selected;
    }
  };

  const initialSelection = opts.selected === undefined ? opts.selection : opts.selected;
  if (initialSelection !== false && initialSelection !== null) {
    const initial = initialSelection
      ? cellMetas.find((meta) => bcCriticalTableSelectionMatches(meta, initialSelection))
      : null;
    setSelected(initial || cellMetas[0], { notify: false });
  } else {
    rootNode.value = {};
  }

  return rootNode.criticalValueTable;
}

bcCriticalTableSetupTutorial = (rootNode, opts = {}) => {
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
      applyAction: rootNode.criticalValueTable && rootNode.criticalValueTable.applyTutorialAction
    });
  };

  requestAnimationFrame(setup);
}

bcCriticalTableCellButton = (td, meta, text, opts = {}) => {
  if (!bcCriticalTableIsInteractive(opts)) {
    td.text(text);
    return;
  }

  const button = td.append("button")
    .attr("type", "button")
    .attr("class", "cvt-cell-button")
    .attr("data-cvt-key", meta.key)
    .attr("aria-pressed", "false")
    .text(text);

  button.on("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const rootNode = button.node().closest(".critical-value-table");
    if (rootNode && rootNode.criticalValueTable) {
      rootNode.criticalValueTable.setSelected(meta, { animate: true });
    }
  });
}

bcCriticalTableNormalAreaColumns = (opts = {}) =>
  bcCriticalTableAsArray(opts.areas || opts.columns || ["left", "right", "mean-to-z"])
    .map((source) => {
      const spec = typeof source === "string" ? { area: source } : source || {};
      const area = bcCriticalTableNormalizeArea(spec.area || spec.type || spec.key);
      return {
        area,
        label: spec.label || bcCriticalTableAreaLabel(area)
      };
    })

bcCriticalTableNormalAreas = (opts = {}) => {
  const distribution = "normal";
  const layout = "areas";
  const zValues = bcCriticalTableSequence(opts.z || opts.values || { from: -3, to: 3, step: 0.1 });
  const columns = bcCriticalTableNormalAreaColumns(opts);
  const digits = opts.digits === undefined ? 4 : opts.digits;
  const zDigits = opts.zDigits === undefined ? 1 : opts.zDigits;
  const root = bcCriticalTableBuildRoot(opts, "critical-value-table-normal cvt-normal-areas");
  const rootNode = root.node();
  const cellMetas = [];

  const wrap = bcCriticalTableApplyTableWrapOptions(root.append("div").attr("class", "cvt-table-wrap"), opts);
  const table = wrap.append("table")
    .attr("class", "sfs-data-table")
    .attr("aria-label", opts.ariaLabel || opts.caption || "Unit normal area table");
  if (opts.caption) table.append("caption").text(opts.caption);

  const header = table.append("thead").append("tr");
  header.append("th").text("z");
  columns.forEach((column) => header.append("th").text(column.label));

  const tbody = table.append("tbody");
  zValues.forEach((z) => {
    const rowKey = `z-${z}`;
    const tr = tbody.append("tr").attr("data-cvt-row-key", rowKey);
    tr.append("th").attr("scope", "row").text(bcCriticalTableFormatNumber(z, zDigits));

    columns.forEach((column) => {
      const probability = bcCriticalTableNormalArea(column.area, z);
      const meta = {
        key: `normal-${layout}-${column.area}-${z}`,
        rowKey,
        distribution,
        layout,
        z,
        area: column.area,
        probability,
        value: probability,
        shade: bcCriticalTableNormalShade(column.area, z)
      };
      cellMetas.push(meta);
      bcCriticalTableCellButton(tr.append("td"), meta, bcCriticalTableFormatNumber(probability, digits), opts);
    });
  });

  bcCriticalTableAppendNote(root, opts);
  return bcCriticalTableFinish(rootNode, cellMetas, opts);
}

bcCriticalTableNormalLookup = (opts = {}) => {
  const distribution = "normal";
  const layout = "lookup";
  const zSpec = opts.z || {};
  const rowStep = bcCriticalTablePositiveNumber(zSpec.rowStep || opts.rowStep, 0.1);
  const columnStep = bcCriticalTablePositiveNumber(zSpec.columnStep || opts.columnStep, 0.01);
  const rowFrom = bcCriticalTableFiniteNumber(bcCriticalTableValueOr(zSpec.from, opts.from), 0);
  const rowTo = bcCriticalTableFiniteNumber(bcCriticalTableValueOr(zSpec.to, opts.to), 3.9);
  const rows = bcCriticalTableSequence({ from: rowFrom, to: rowTo, step: rowStep });
  const columnCount = Math.max(1, Math.round(rowStep / columnStep));
  const columns = bcCriticalTableRange(columnCount).map((index) => bcCriticalTableRound(index * columnStep));
  const area = bcCriticalTableNormalizeArea(opts.area || "left");
  const digits = opts.digits === undefined ? 4 : opts.digits;
  const root = bcCriticalTableBuildRoot(opts, "critical-value-table-normal cvt-normal-lookup");
  const rootNode = root.node();
  const cellMetas = [];

  const wrap = bcCriticalTableApplyTableWrapOptions(root.append("div").attr("class", "cvt-table-wrap"), opts);
  const table = wrap.append("table")
    .attr("class", "sfs-data-table")
    .attr("aria-label", opts.ariaLabel || opts.caption || "Unit normal lookup table");
  if (opts.caption) table.append("caption").text(opts.caption);

  const header = table.append("thead").append("tr");
  header.append("th").text("z");
  columns.forEach((column) => {
    header.append("th").text(bcCriticalTableFormatNumber(column, 2).replace(/^0/, ""));
  });

  const tbody = table.append("tbody");
  rows.forEach((rowValue) => {
    const rowKey = `z-base-${rowValue}`;
    const tr = tbody.append("tr").attr("data-cvt-row-key", rowKey);
    tr.append("th").attr("scope", "row").text(bcCriticalTableFormatNumber(rowValue, 1));

    columns.forEach((column) => {
      const z = bcCriticalTableRound(rowValue + column);
      const probability = bcCriticalTableNormalArea(area, z);
      const meta = {
        key: `normal-${layout}-${area}-${z}`,
        rowKey,
        distribution,
        layout,
        z,
        area,
        probability,
        value: probability,
        shade: bcCriticalTableNormalShade(area, z)
      };
      cellMetas.push(meta);
      bcCriticalTableCellButton(tr.append("td"), meta, bcCriticalTableFormatNumber(probability, digits), opts);
    });
  });

  bcCriticalTableAppendNote(root, opts);
  return bcCriticalTableFinish(rootNode, cellMetas, opts);
}

bcCriticalTableTColumns = (opts = {}) =>
  bcCriticalTableAsArray(opts.columns || [
    { tail: "right", alpha: 0.10 },
    { tail: "right", alpha: 0.05 },
    { tail: "right", alpha: 0.01 },
    { tail: "two", alpha: 0.10 },
    { tail: "two", alpha: 0.05 },
    { tail: "two", alpha: 0.01 }
  ]).map((source) => {
    const spec = typeof source === "number" ? { alpha: source, tail: opts.tail || "right" } :
      typeof source === "string" ? { alpha: Number(source), tail: opts.tail || "right" } :
      source || {};
    const alpha = bcCriticalTablePositiveNumber(spec.alpha, 0.05);
    const tail = bcCriticalTableNormalizeTail(spec.tail || spec.side || opts.tail || "right");
    return {
      alpha,
      tail,
      label: spec.label || bcCriticalTableTailLabel(tail, alpha)
    };
  })

bcCriticalTableTPairedColumns = (opts = {}) =>
  bcCriticalTableAsArray(opts.alphas || opts.oneTailAlphas || opts.oneTailedAlphas || [0.10, 0.05, 0.025, 0.01, 0.005])
    .map((source) => {
      const spec = typeof source === "number" ? { alpha: source } :
        typeof source === "string" ? { alpha: Number(source) } :
        source || {};
      const oneTailAlpha = bcCriticalTablePositiveNumber(
        bcCriticalTableValueOr(spec.oneTailAlpha, bcCriticalTableValueOr(spec.oneTailedAlpha, spec.alpha)),
        0.05
      );
      const twoTailAlpha = bcCriticalTablePositiveNumber(
        bcCriticalTableValueOr(spec.twoTailAlpha, bcCriticalTableValueOr(spec.twoTailedAlpha, spec.alpha2)),
        oneTailAlpha * 2
      );
      return {
        oneTailAlpha,
        twoTailAlpha,
        oneTailLabel: spec.oneTailLabel || bcCriticalTableAlphaLabel(oneTailAlpha),
        twoTailLabel: spec.twoTailLabel || bcCriticalTableAlphaLabel(twoTailAlpha)
      };
    })

bcCriticalTableTUsesPairedColumns = (opts = {}) => {
  if (opts.pairedHeaders !== undefined) return bcCriticalTableBoolean(opts.pairedHeaders, true);
  if (opts.dualHeaders !== undefined) return bcCriticalTableBoolean(opts.dualHeaders, true);
  return opts.columns === undefined || opts.alphas !== undefined || opts.oneTailAlphas !== undefined || opts.oneTailedAlphas !== undefined;
}

bcCriticalTableTDefaultPairedTail = (opts = {}) => {
  const tail = bcCriticalTableNormalizeTail(opts.selectedTail || opts.defaultTail || opts.tail || "two");
  return tail === "left" ? "right" : tail;
}

bcCriticalTableTShowConfidence = (opts = {}) =>
  bcCriticalTableBoolean(
    bcCriticalTableValueOr(opts.confidence, bcCriticalTableValueOr(opts.confidenceLevel, opts.confidenceLevels)),
    false
  )

bcCriticalTableT = (opts = {}) => {
  const distribution = "t";
  const layout = "critical-values";
  const dfValues = bcCriticalTableSequence(opts.df || opts.degreesOfFreedom || { from: 1, to: 30, step: 1 });
  const pairedColumns = bcCriticalTableTUsesPairedColumns(opts);
  const columns = pairedColumns ? bcCriticalTableTPairedColumns(opts) : bcCriticalTableTColumns(opts);
  const defaultPairedTail = bcCriticalTableTDefaultPairedTail(opts);
  const showConfidence = bcCriticalTableTShowConfidence(opts);
  const digits = opts.digits === undefined ? 3 : opts.digits;
  const root = bcCriticalTableBuildRoot(opts, "critical-value-table-t");
  const rootNode = root.node();
  const cellMetas = [];

  const wrap = bcCriticalTableApplyTableWrapOptions(root.append("div").attr("class", "cvt-table-wrap"), opts);
  const table = wrap.append("table")
    .attr("class", "sfs-data-table")
    .attr("aria-label", opts.ariaLabel || opts.caption || "t critical value table");
  if (opts.caption) table.append("caption").text(opts.caption);

  const thead = table.append("thead");
  if (pairedColumns) {
    const oneTailHeader = thead.append("tr");
    oneTailHeader.append("th")
      .attr("class", "cvt-header-label")
      .attr("scope", "row")
      .html("one-tailed &alpha;");
    columns.forEach((column) => oneTailHeader.append("th").text(column.oneTailLabel));

    const twoTailHeader = thead.append("tr");
    twoTailHeader.append("th")
      .attr("class", "cvt-header-label")
      .attr("scope", "row")
      .html("two-tailed &alpha;");
    columns.forEach((column) => twoTailHeader.append("th").text(column.twoTailLabel));

    if (showConfidence) {
      const confidenceHeader = thead.append("tr");
      confidenceHeader.append("th")
        .attr("class", "cvt-header-label")
        .attr("scope", "row")
        .text(opts.confidenceLabel || "confidence level");
      columns.forEach((column) => confidenceHeader.append("th").text(bcCriticalTablePercentLabel(1 - column.twoTailAlpha)));
    }
  } else {
    const header = thead.append("tr");
    header.append("th")
      .attr("aria-hidden", "true")
      .text("");
    columns.forEach((column) => header.append("th").text(column.label));
  }

  const tbody = table.append("tbody");
  const bodyHeader = tbody.append("tr")
    .attr("class", "cvt-body-header");
  bodyHeader.append("th")
    .attr("class", "cvt-body-label")
    .attr("scope", "col")
    .html("<i>df</i>");
  bodyHeader.append("th")
    .attr("class", "cvt-header-group")
    .attr("scope", "colgroup")
    .attr("colspan", columns.length)
    .html(opts.valueHeader || "<i>t</i> critical value");

  dfValues.forEach((df) => {
    const rowKey = `df-${df}`;
    const tr = tbody.append("tr").attr("data-cvt-row-key", rowKey);
    tr.append("th").attr("scope", "row").text(bcCriticalTableDfLabel(df));

    columns.forEach((column) => {
      if (pairedColumns) {
        const critical = bcCriticalTableTQuantile("right", column.oneTailAlpha, df);
        const key = `t-${df}-paired-${column.oneTailAlpha}`;
        const baseMeta = {
          key,
          rowKey,
          distribution,
          layout,
          df,
          oneTailAlpha: column.oneTailAlpha,
          twoTailAlpha: column.twoTailAlpha,
          confidenceLevel: 1 - column.twoTailAlpha,
          critical,
          value: critical
        };
        const oneTailMeta = Object.assign({}, baseMeta, {
          alpha: column.oneTailAlpha,
          tail: "right",
          shade: bcCriticalTableCriticalShade("right", column.oneTailAlpha)
        });
        const twoTailMeta = Object.assign({}, baseMeta, {
          alpha: column.twoTailAlpha,
          tail: "two",
          shade: bcCriticalTableCriticalShade("two", column.twoTailAlpha)
        });
        const defaultMeta = defaultPairedTail === "right" ? oneTailMeta : twoTailMeta;
        const alternateMeta = defaultPairedTail === "right" ? twoTailMeta : oneTailMeta;
        cellMetas.push(defaultMeta, alternateMeta);
        bcCriticalTableCellButton(tr.append("td"), defaultMeta, bcCriticalTableFormatNumber(critical, digits), opts);
        return;
      }

      const critical = bcCriticalTableTQuantile(column.tail, column.alpha, df);
      const meta = {
        key: `t-${df}-${column.tail}-${column.alpha}`,
        rowKey,
        distribution,
        layout,
        df,
        alpha: column.alpha,
        tail: column.tail,
        critical,
        value: critical,
        shade: bcCriticalTableCriticalShade(column.tail, column.alpha)
      };
      cellMetas.push(meta);
      bcCriticalTableCellButton(tr.append("td"), meta, bcCriticalTableFormatNumber(critical, digits), opts);
    });
  });

  bcCriticalTableAppendNote(root, opts);
  return bcCriticalTableFinish(rootNode, cellMetas, opts);
}

bcCriticalTableF = (opts = {}) => {
  const distribution = "f";
  const layout = "critical-values";
  const alpha = bcCriticalTablePositiveNumber(opts.alpha, 0.05);
  const tail = bcCriticalTableNormalizeTail(opts.tail || "right");
  const df1Values = bcCriticalTableSequence(opts.df1 || opts.numeratorDf || { from: 1, to: 10, step: 1 });
  const df2Values = bcCriticalTableSequence(opts.df2 || opts.denominatorDf || { from: 1, to: 30, step: 1 });
  const digits = opts.digits === undefined ? 2 : opts.digits;
  const root = bcCriticalTableBuildRoot(opts, "critical-value-table-f");
  const rootNode = root.node();
  const cellMetas = [];

  const wrap = bcCriticalTableApplyTableWrapOptions(root.append("div").attr("class", "cvt-table-wrap"), opts);
  const table = wrap.append("table")
    .attr("class", "sfs-data-table")
    .attr("aria-label", opts.ariaLabel || opts.caption || "F critical value table");
  if (opts.caption) table.append("caption").text(opts.caption);

  const thead = table.append("thead");
  const superHeader = thead.append("tr");
  superHeader.append("th")
    .attr("class", "cvt-header-label")
    .attr("colspan", 2)
    .attr("rowspan", 2)
    .html(opts.alphaHeader || `&alpha; = ${bcCriticalTableAlphaLabel(alpha)}`);
  superHeader.append("th")
    .attr("class", "cvt-header-group")
    .attr("scope", "colgroup")
    .attr("colspan", df1Values.length)
    .html(opts.numeratorHeader || opts.df1Header || "<i>df</i><sub>1</sub>");
  const header = thead.append("tr");
  df1Values.forEach((df1) => header.append("th").text(bcCriticalTableDfLabel(df1)));

  const tbody = table.append("tbody");
  df2Values.forEach((df2, index) => {
    const rowKey = `df2-${df2}`;
    const tr = tbody.append("tr").attr("data-cvt-row-key", rowKey);
    if (index === 0) {
      tr.append("th")
        .attr("class", "cvt-body-label")
        .attr("scope", "rowgroup")
        .attr("rowspan", df2Values.length)
        .html(opts.denominatorHeader || opts.df2Header || "<i>df</i><sub>2</sub>");
    }
    tr.append("th").attr("scope", "row").text(bcCriticalTableDfLabel(df2));

    df1Values.forEach((df1) => {
      const critical = bcCriticalTableFQuantile(tail, alpha, df1, df2);
      const meta = {
        key: `f-${df1}-${df2}-${tail}-${alpha}`,
        rowKey,
        distribution,
        layout,
        df1,
        numeratorDf: df1,
        df2,
        denominatorDf: df2,
        alpha,
        tail,
        critical,
        value: critical,
        shade: bcCriticalTableCriticalShade(tail, alpha)
      };
      cellMetas.push(meta);
      bcCriticalTableCellButton(tr.append("td"), meta, bcCriticalTableFormatNumber(critical, digits), opts);
    });
  });

  bcCriticalTableAppendNote(root, opts);
  return bcCriticalTableFinish(rootNode, cellMetas, opts);
}

makeCriticalValueTable = (opts = {}) => {
  const distribution = bcCriticalTableNormalizeDistribution(opts.distribution || opts.type || opts.statistic);
  const layout = bcCriticalTableNormalizeLayout(opts.layout, distribution);

  if (distribution === "t") return bcCriticalTableT(opts);
  if (distribution === "f") return bcCriticalTableF(opts);
  if (layout === "lookup") return bcCriticalTableNormalLookup(opts);
  return bcCriticalTableNormalAreas(opts);
}

makeUnitNormalTable = (opts = {}) =>
  makeCriticalValueTable(Object.assign({ distribution: "normal" }, opts))

makeZTable = makeUnitNormalTable

makeTTable = (opts = {}) =>
  makeCriticalValueTable(Object.assign({ distribution: "t" }, opts))

makeFTable = (opts = {}) =>
  makeCriticalValueTable(Object.assign({ distribution: "f" }, opts))
