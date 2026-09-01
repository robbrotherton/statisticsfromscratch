bcFrequencyTableTutorialBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
  }
  return Boolean(value);
}

bcFrequencyTableTutorialRawValue = (entry) => {
  if (!entry || typeof entry !== "object") return entry;
  const keys = ["x", "value", "score", "category", "label"];
  const key = keys.find((candidate) => entry[candidate] !== undefined);
  return key ? entry[key] : entry;
}

bcFrequencyTableTutorialKey = (value) => String(bcFrequencyTableTutorialRawValue(value));

bcFrequencyTableTutorialKeys = (value, rows, fallback) => {
  if (value === undefined) return new Set(fallback || []);
  if (value === "all" || value === true) return new Set(rows.map((row) => row.key));
  if (value === false || value === null) return new Set();
  const values = Array.isArray(value) ? value : [value];
  return new Set(values.map(bcFrequencyTableTutorialKey));
}

bcFrequencyTableTutorialOrder = (value) => {
  const normalized = String(value || "ascending").trim().toLowerCase();
  return ["descending", "desc", "high-to-low"].includes(normalized)
    ? "descending"
    : "ascending";
}

bcFrequencyTableTutorialOrderedRows = (rows, order) => {
  const ordered = bcFrequencyTableTutorialOrder(order) === "descending"
    ? rows.slice().reverse()
    : rows.slice();
  const total = ordered.reduce((sum, row) => sum + row.frequency, 0);
  let cumulativeFrequency = 0;

  return ordered.map((row) => {
    cumulativeFrequency += row.frequency;
    const cumulativeProportion = total > 0 ? cumulativeFrequency / total : 0;
    return Object.assign({}, row, {
      cumulativeFrequency,
      cumulativeProportion,
      cumulativePercent: cumulativeProportion * 100
    });
  });
}

bcFrequencyTableTutorialSetup = (rootNode, applyTutorialAction, opts = {}) => {
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
      actionDefaults: { order: "ascending" },
      applyAction: applyTutorialAction
    });
  };

  requestAnimationFrame(setup);
}

makeFrequencyTableTutorial = (opts = {}) => {
  const api = window.interactiveFigure;
  if (api && api.ensureStyles) api.ensureStyles();

  const rawData = Array.isArray(opts.data) ? opts.data.slice() : [];
  const variableLabel = String(opts.variable || "the variable").trim() || "the variable";
  const dataLabel = opts.dataLabel || "Raw data";
  const tableOptions = Object.assign({}, opts, {
    columns: [
      "label",
      "frequency",
      "proportion",
      "percent",
      "cumulativeFrequency",
      "cumulativePercent"
    ],
    proportion: true,
    percent: true,
    cumulative: true,
    ariaLabel: opts.ariaLabel || "Frequency table under construction"
  });
  const rows = frequencyTable(tableOptions);
  const formatter = opts.format || d3.format("~g");
  const percentFormatter = opts.percentFormat || d3.format(".1f");
  const rowByKey = new Map(rows.map((row) => [row.key, row]));
  const allKeys = rows.map((row) => row.key);

  const root = d3.create("div")
    .attr("class", "frequency-table-tutorial bc-figure bc-if-root");
  const rootNode = root.node();
  if (api && api.adopt) api.adopt(rootNode, {});

  const chartWrap = root.append("div")
    .attr("class", "bc-chart-wrap");

  chartWrap.append("div")
    .attr("class", "bc-control-title center")
    .text(dataLabel);

  const scoreList = chartWrap.append("div")
    .attr("class", "d-flex flex-wrap justify-content-center gap-2 fs-5")
    .attr("role", "list")
    .attr("aria-label", `${dataLabel}: ${rawData.map(bcFrequencyTableTutorialRawValue).join(", ")}`);

  rawData.forEach((entry) => {
    const value = bcFrequencyTableTutorialRawValue(entry);
    scoreList.append("span")
      .attr("class", "px-1")
      .attr("role", "listitem")
      .attr("data-frequency-key", bcFrequencyTableTutorialKey(value))
      .text(value);
  });

  const tableWrap = chartWrap.append("div")
    .attr("class", "table-responsive");
  const tableStage = tableWrap.append("div")
    .attr("class", "frequency-table-tutorial-stage")
    .style("width", "fit-content")
    .style("margin-inline", "auto")
    .style("overflow", "hidden");
  const tableStageNode = tableStage.node();
  const tableNode = makeFrequencyTable(tableOptions);
  tableNode.style.width = "max-content";
  tableNode.style.maxWidth = "none";
  tableNode.style.marginInline = "0";
  tableStageNode.appendChild(tableNode);

  const headerCells = Array.from(tableNode.querySelectorAll("thead [data-frequency-column]"));
  const bodyRows = Array.from(tableNode.querySelectorAll("tbody tr[data-frequency-key]"));
  const bodyRowByKey = new Map(bodyRows.map((row) => [row.dataset.frequencyKey, row]));
  const tbody = tableNode.tBodies[0];
  const scoreNodes = Array.from(scoreList.node().querySelectorAll("[data-frequency-key]"));

  let state = {
    table: false,
    columns: [],
    rows: [],
    frequencies: [],
    highlight: null,
    order: "ascending"
  };
  let renderedOrder = "ascending";
  let stageWidth = null;
  let orderAnimationGeneration = 0;
  let resizeObserver = null;

  const applyDisplayRows = (displayRows, order) => {
    displayRows.forEach((displayRow) => {
      const rowNode = bodyRowByKey.get(displayRow.key);
      if (!rowNode) return;
      tbody.appendChild(rowNode);
      const cumulativeFrequencyCell = rowNode.querySelector(
        '[data-frequency-column="cumulativeFrequency"]'
      );
      const cumulativePercentCell = rowNode.querySelector(
        '[data-frequency-column="cumulativePercent"]'
      );
      if (cumulativeFrequencyCell) {
        cumulativeFrequencyCell.textContent = formatter(displayRow.cumulativeFrequency);
      }
      if (cumulativePercentCell) {
        cumulativePercentCell.textContent = percentFormatter(displayRow.cumulativePercent);
      }
    });
    tableNode.frequencyRows = displayRows;
    renderedOrder = order;
  };

  const visibleTableWidth = (columnSet) => {
    const tableRect = tableNode.getBoundingClientRect();
    if (!(tableRect.width > 0)) return null;

    const visibleHeaders = headerCells.filter((cell) =>
      columnSet.has(cell.dataset.frequencyColumn)
    );
    const boundary = visibleHeaders.length
      ? visibleHeaders[visibleHeaders.length - 1]
      : headerCells.find((cell) => cell.dataset.frequencyColumn === "frequency");
    if (!boundary) return Math.ceil(tableRect.width);

    const boundaryRect = boundary.getBoundingClientRect();
    return Math.max(1, Math.ceil(boundaryRect.right - tableRect.left + 1));
  };

  const cancelStageAnimations = (id) => {
    if (typeof tableStageNode.getAnimations !== "function") return;
    tableStageNode.getAnimations().forEach((animation) => {
      if (!id || animation.id === id) animation.cancel();
    });
  };

  const clearRowOrderMotion = () => {
    bodyRows.forEach((row) => {
      if (typeof row.getAnimations === "function") {
        row.getAnimations().forEach((animation) => {
          if (animation.id === "frequency-table-order") animation.cancel();
        });
      }
      row.style.removeProperty("opacity");
    });
  };

  const setStageWidth = (columnSet, animate) => {
    const targetWidth = visibleTableWidth(columnSet);
    if (!(targetWidth > 0)) return;

    const currentWidth = tableStageNode.getBoundingClientRect().width || stageWidth || targetWidth;
    cancelStageAnimations("frequency-table-columns");
    tableStageNode.style.width = `${targetWidth}px`;
    stageWidth = targetWidth;

    if (
      !animate ||
      !state.table ||
      Math.abs(currentWidth - targetWidth) < 1 ||
      typeof tableStageNode.animate !== "function"
    ) return;

    const animation = tableStageNode.animate(
      [
        { width: `${currentWidth}px` },
        { width: `${targetWidth}px` }
      ],
      {
        duration: Number(opts.columnAnimationDuration) || 420,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)"
      }
    );
    animation.id = "frequency-table-columns";
  };

  const fadeOrderChange = async (displayRows, order, signal) => {
    const generation = ++orderAnimationGeneration;
    clearRowOrderMotion();

    if (!bodyRows.length || bodyRows.some((row) => typeof row.animate !== "function")) {
      applyDisplayRows(displayRows, order);
      return;
    }

    const stillCurrent = () =>
      generation === orderAnimationGeneration && !(signal && signal.aborted);
    const duration = Number(opts.sortAnimationDuration) || 840;
    const phaseDuration = Math.round(duration / 2);
    const rowDuration = Math.max(120, Math.round(phaseDuration * 0.45));
    const staggerBudget = Math.max(0, phaseDuration - rowDuration);
    const stagger = bodyRows.length > 1
      ? staggerBudget / (bodyRows.length - 1)
      : 0;
    const animateRows = (orderedRows, from, to, easing) =>
      orderedRows.map((row, index) => {
        const animation = row.animate(
          [{ opacity: from }, { opacity: to }],
          {
            duration: rowDuration,
            delay: Math.round(index * stagger),
            easing,
            fill: "forwards"
          }
        );
        animation.id = "frequency-table-order";
        return animation;
      });

    const outgoingRows = Array.from(tbody.rows);
    const outgoingAnimations = animateRows(
      outgoingRows,
      1,
      0,
      "cubic-bezier(0.55, 0, 1, 0.45)"
    );

    try {
      await Promise.all(outgoingAnimations.map((animation) => animation.finished));
    } catch (error) {
      if (generation === orderAnimationGeneration) clearRowOrderMotion();
      return;
    }
    if (!stillCurrent()) {
      if (generation === orderAnimationGeneration) clearRowOrderMotion();
      return;
    }

    outgoingRows.forEach((row) => {
      row.style.opacity = "0";
    });
    outgoingAnimations.forEach((animation) => animation.cancel());
    applyDisplayRows(displayRows, order);

    const incomingRows = Array.from(tbody.rows);
    const incomingAnimations = animateRows(
      incomingRows,
      0,
      1,
      "cubic-bezier(0, 0.55, 0.45, 1)"
    );

    try {
      await Promise.all(incomingAnimations.map((animation) => animation.finished));
    } catch (error) {
      if (generation === orderAnimationGeneration) clearRowOrderMotion();
      return;
    }
    if (stillCurrent()) clearRowOrderMotion();
  };

  const cancelMotion = () => {
    orderAnimationGeneration += 1;
    cancelStageAnimations();
    clearRowOrderMotion();
  };

  rootNode.addEventListener("bc-if:cancel-transitions", cancelMotion);

  const setState = (action = {}, options = {}) => {
    const columnSet = new Set(action.columns === undefined ? state.columns : action.columns);
    const rowSet = bcFrequencyTableTutorialKeys(action.rows, rows, state.rows);
    const frequencySet = bcFrequencyTableTutorialKeys(
      action.frequencies,
      rows,
      state.frequencies
    );
    const order = action.order === undefined
      ? state.order
      : bcFrequencyTableTutorialOrder(action.order);
    const tableVisible = action.table === undefined
      ? state.table
      : bcFrequencyTableTutorialBoolean(action.table, true);
    const highlight = Object.prototype.hasOwnProperty.call(action, "highlight")
      ? action.highlight
      : state.highlight;
    const highlightKey = highlight === null || highlight === false || highlight === ""
      ? null
      : bcFrequencyTableTutorialKey(highlight);
    const animate = options.animate === undefined
      ? action.animate !== false
      : options.animate !== false;
    const displayRows = bcFrequencyTableTutorialOrderedRows(rows, order);
    const orderChanged = order !== renderedOrder;

    if (orderChanged && animate && state.table && tableVisible) {
      fadeOrderChange(displayRows, order, options.signal);
    } else {
      applyDisplayRows(displayRows, order);
    }

    const visibleCells = [];
    const hiddenCells = [];
    headerCells.forEach((cell) => {
      (columnSet.has(cell.dataset.frequencyColumn) ? visibleCells : hiddenCells).push(cell);
    });
    bodyRows.forEach((row) => {
      const key = row.dataset.frequencyKey;
      row.querySelectorAll("[data-frequency-column]").forEach((cell) => {
        const column = cell.dataset.frequencyColumn;
        const visible = column === "frequency"
          ? columnSet.has(column) && frequencySet.has(key)
          : columnSet.has(column) && rowSet.has(key);
        (visible ? visibleCells : hiddenCells).push(cell);
      });
    });

    setStageWidth(columnSet, animate && tableVisible);

    if (api && api.setRevealVisible) {
      api.setRevealVisible(tableNode, tableVisible, { root: rootNode, animate });
      api.setRevealVisible(visibleCells, true, { root: rootNode, animate });
      api.setRevealVisible(hiddenCells, false, { root: rootNode, animate });
    } else {
      tableNode.hidden = !tableVisible;
      visibleCells.forEach((cell) => { cell.hidden = false; });
      hiddenCells.forEach((cell) => { cell.hidden = true; });
    }

    scoreNodes.forEach((score) => {
      score.classList.toggle("bc-highlight", score.dataset.frequencyKey === highlightKey);
    });
    bodyRows.forEach((row) => {
      row.querySelectorAll("th, td").forEach((cell) => {
        cell.classList.toggle("bc-highlight", row.dataset.frequencyKey === highlightKey);
      });
    });

    let tableLabel = tableVisible
      ? `Frequency table for ${variableLabel} under construction.`
      : `The frequency table for ${variableLabel} has not been started.`;
    if (highlightKey && rowByKey.has(highlightKey)) {
      const row = rowByKey.get(highlightKey);
      tableLabel = `Value ${row.label} is highlighted in the raw data and has frequency ${row.frequency}.`;
    } else if (
      order === "descending" &&
      frequencySet.size === rows.length &&
      columnSet.size === tableOptions.columns.length
    ) {
      tableLabel = `Complete frequency table for ${variableLabel}, ordered from highest to lowest value. Cumulative columns count observations at or above each value.`;
    } else if (frequencySet.size === rows.length && columnSet.size === tableOptions.columns.length) {
      tableLabel = `Complete frequency table for ${variableLabel}, ordered from lowest to highest value. Cumulative columns count observations at or below each value.`;
    } else if (frequencySet.size === rows.length) {
      tableLabel = "Complete two-column frequency table.";
    }
    tableNode.setAttribute("aria-label", tableLabel);

    state = {
      table: tableVisible,
      columns: Array.from(columnSet),
      rows: Array.from(rowSet),
      frequencies: Array.from(frequencySet),
      highlight: highlightKey,
      order
    };
    rootNode.value = {
      state: Object.assign({}, state),
      rows: displayRows
    };
    rootNode.dataset.frequencyHighlight = highlightKey || "";
    rootNode.dataset.frequencyOrder = order;

    if (options.notify !== false) {
      rootNode.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return state;
  };

  const completeAction = {
    table: true,
    columns: tableOptions.columns,
    rows: allKeys,
    frequencies: allKeys,
    highlight: null,
    order: "ascending",
    animate: false
  };
  const initialAction = opts.initialAction || (
    opts.tutorial === false
      ? completeAction
      : {
          table: false,
          columns: [],
          rows: [],
          frequencies: [],
          highlight: null,
          order: "ascending",
          animate: false
        }
  );

  const applyTutorialAction = (action, context) =>
    setState(action, {
      animate: action.animate !== false,
      signal: context ? context.signal : null
    });

  rootNode.frequencyTableTutorial = {
    rows,
    setState,
    applyTutorialAction,
    revealAll() {
      return setState(completeAction);
    },
    getState() {
      return Object.assign({}, state);
    }
  };

  setState(initialAction, { animate: false, notify: false });

  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => {
      setStageWidth(new Set(state.columns), false);
    });
    resizeObserver.observe(tableNode);
  }
  requestAnimationFrame(() => {
    setStageWidth(new Set(state.columns), false);
  });

  if (api && api.adopt) {
    api.adopt(rootNode, {
      cancelMotion,
      dispose() {
        if (resizeObserver) resizeObserver.disconnect();
        rootNode.removeEventListener("bc-if:cancel-transitions", cancelMotion);
        cancelMotion();
      }
    });
  }

  bcFrequencyTableTutorialSetup(rootNode, applyTutorialAction, opts);

  return rootNode;
}

if (window.bcGraphs) {
  window.bcGraphs.makeFrequencyTableTutorial = makeFrequencyTableTutorial;
}
