ipFiniteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

ipPositiveNumber = (value, fallback) => {
  const number = ipFiniteNumber(value);
  return number > 0 ? number : fallback;
}

ipBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
    if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
  }
  return Boolean(value);
}

ipKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-")

ipPrefersReducedMotion = () => {
  if (window.interactiveRuntime && window.interactiveRuntime.motion) {
    return window.interactiveRuntime.motion.isReduced();
  }
  return Boolean(window.bcReducedMotion) || Boolean(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// Cell means as [[a1b1, a2b1], [a1b2, a2b2]]: one array per line (B level),
// one value per x position (A level).
ipPatternPresets = {
  "flat-parallel": [[3, 3], [7, 7]],
  "sloped-parallel": [[2, 5], [5, 8]],
  "crossover": [[2, 8], [8, 2]],
  "one-flat-one-sloped": [[3, 3], [4, 9]]
}

ipNormalizePattern = (value) => {
  const key = ipKey(value);
  if (ipPatternPresets[key]) return key;
  if (["flat", "parallel", "flat-lines"].includes(key)) return "flat-parallel";
  if (["sloped", "slope", "sloped-lines"].includes(key)) return "sloped-parallel";
  if (["cross", "cross-over", "crossover-interaction"].includes(key)) return "crossover";
  if (["one-flat", "one-flat-sloped", "one-sloped"].includes(key)) return "one-flat-one-sloped";
  return null;
}

ipEnsureStyles = () => {
  if (document.getElementById("interaction-plot-styles")) return;

  const style = document.createElement("style");
  style.id = "interaction-plot-styles";
  style.textContent = `
    .interaction-plot {
      --bc-figure-max-width: var(--ip-max-width, 42rem);
      --ip-drag-color: var(--bc-focus, #2780e3);
    }

    /* Factor B is redundantly encoded: line style, color, and point shape. */
    .interaction-plot .ip-series[data-series="0"],
    .interaction-plot .ip-legend-item[data-series="0"] {
      --ip-series-color: var(--graph-series-1, var(--graph-line-color, #0072b2));
    }

    .interaction-plot .ip-series[data-series="1"],
    .interaction-plot .ip-legend-item[data-series="1"] {
      --ip-series-color: var(--graph-series-2, #e69f00);
    }

    .interaction-plot .ip-line {
      stroke: var(--ip-series-color, currentColor);
      fill: none;
      stroke-width: 2.4;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }

    .interaction-plot .ip-line[data-series="1"] {
      stroke-dasharray: 7 5;
    }

    .interaction-plot .ip-dot {
      fill: var(--ip-series-color, currentColor);
      stroke: var(--bc-bg, #fff);
      stroke-width: 1.4;
    }

    .interaction-plot .ip-hit {
      fill: transparent;
      stroke: none;
    }

    .interaction-plot .ip-ring {
      fill: none;
      stroke: var(--ip-drag-color);
      stroke-width: 2;
      opacity: 0;
      transition: opacity 160ms ease;
    }

    .interaction-plot .ip-value-label,
    .interaction-plot .ip-legend-title,
    .interaction-plot .ip-legend-label {
      fill: var(--graph-text-color, currentColor);
      font-family: var(--bs-body-font-family, system-ui, sans-serif);
      font-variant-numeric: tabular-nums;
      user-select: none;
    }

    .interaction-plot .ip-value-label {
      font-size: 0.8rem;
      text-anchor: middle;
    }

    .interaction-plot .ip-legend-title {
      font-size: 0.85rem;
      font-weight: 600;
      fill: var(--bc-text, currentColor);
    }

    .interaction-plot .ip-legend-label {
      font-size: 0.85rem;
    }

    .interaction-plot .ip-series,
    .interaction-plot .ip-legend-item {
      transition: opacity 300ms ease;
    }

    .interaction-plot .ip-series.is-dimmed,
    .interaction-plot .ip-legend-item.is-dimmed {
      opacity: 0.25;
    }

    .interaction-plot.ip-no-anim .ip-series,
    .interaction-plot.ip-no-anim .ip-legend-item,
    .interaction-plot.ip-no-anim .ip-ring {
      transition: none !important;
    }

    .interaction-plot .ip-point {
      outline: none;
    }

    .interaction-plot.is-draggable .ip-point {
      cursor: grab;
    }

    .interaction-plot.is-draggable .ip-point.is-dragging {
      cursor: grabbing;
    }

    .interaction-plot.is-draggable .ip-point:hover .ip-ring,
    .interaction-plot.is-draggable .ip-point:focus-visible .ip-ring,
    .interaction-plot.is-draggable .ip-point.is-dragging .ip-ring {
      opacity: 1;
    }

    .interaction-plot .ip-axis text,
    .interaction-plot .ip-axis-label {
      fill: var(--graph-text-color, currentColor);
      font-family: var(--bs-body-font-family, system-ui, sans-serif);
      font-size: 0.85rem;
    }

    .interaction-plot .ip-axis path,
    .interaction-plot .ip-axis line {
      stroke: var(--graph-axis-color, currentColor);
    }

    .interaction-plot .ip-means-grid {
      display: grid;
      grid-template-columns: auto minmax(3.6rem, 1fr) minmax(3.6rem, 1fr);
      gap: 0.35rem 0.5rem;
      align-items: center;
      font-size: 0.9rem;
    }

    .interaction-plot .ip-means-grid .ip-grid-head {
      font-weight: 600;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .interaction-plot .ip-means-grid .ip-grid-row-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 8rem;
    }

    .interaction-plot .ip-means-grid input[type="number"] {
      width: 100%;
      min-width: 3.4rem;
    }

    .interaction-plot .ip-pattern-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--bc-action-gap, 0.4rem);
    }

    .interaction-plot .ip-readout {
      margin: 0.18rem 0;
    }

    .interaction-plot .ip-readout .bc-readout-label {
      min-width: 5.6rem;
    }

    @media (prefers-reduced-motion: reduce) {
      .interaction-plot .ip-series,
      .interaction-plot .ip-legend-item,
      .interaction-plot .ip-ring {
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

makeInteractionPlot = function(opts) {
  opts = opts || {};
  ipEnsureStyles();

  const minimal = ipKey(opts.style) === "minimal";
  const width = ipPositiveNumber(opts.width, 640);
  const transitionDuration = ipPositiveNumber(opts.transitionDuration || opts.duration, 650);
  const yDomain = (Array.isArray(opts.yDomain) && opts.yDomain.length === 2)
    ? opts.yDomain.map(Number)
    : [0, 10];
  const step = ipPositiveNumber(opts.step, 0.25);
  const format = d3.format(opts.format || ".2~f");
  const signedFormat = d3.format(opts.signedFormat || "+.2~f");

  const factorA = opts.factorA || opts.xLabel || "Factor A";
  const factorB = opts.factorB || "Factor B";
  const yLabel = opts.yLabel || "DV";
  const xTickLabels = (Array.isArray(opts.xTickLabels) && opts.xTickLabels.length === 2)
    ? opts.xTickLabels.map(String)
    : ["A1", "A2"];
  const defaultSeriesLabels = (Array.isArray(opts.seriesLabels) && opts.seriesLabels.length === 2)
    ? opts.seriesLabels.map(String)
    : ["B1", "B2"];

  function normalizeYTicks(value, fallback) {
    const key = ipKey(value);
    if (["numeric", "numbers", "values"].includes(key)) return "numeric";
    if (["low-high", "lowhigh", "qualitative"].includes(key)) return "low-high";
    if (["none", "off", "hidden", "false", "0"].includes(key)) return "none";
    return fallback;
  }

  function normalizeMeans(value) {
    if (Array.isArray(value) && value.length === 2 &&
        Array.isArray(value[0]) && Array.isArray(value[1])) {
      return value.map((series) => series.slice(0, 2).map((v) => clampMean(v)));
    }
    if (value && typeof value === "object") {
      const flat = {};
      Object.keys(value).forEach((key) => { flat[ipKey(key)] = value[key]; });
      if (["a1b1", "a2b1", "a1b2", "a2b2"].every((key) => flat[key] !== undefined)) {
        return [
          [clampMean(flat.a1b1), clampMean(flat.a2b1)],
          [clampMean(flat.a1b2), clampMean(flat.a2b2)]
        ];
      }
    }
    return null;
  }

  function clampMean(value) {
    const number = ipFiniteNumber(value, yDomain[0]);
    const lo = Math.min(yDomain[0], yDomain[1]);
    const hi = Math.max(yDomain[0], yDomain[1]);
    return Math.max(lo, Math.min(hi, number));
  }

  function snapMean(value) {
    return clampMean(Math.round(value / step) * step);
  }

  const initialPattern = ipNormalizePattern(opts.pattern);
  const initialMeans = normalizeMeans(opts.means) ||
    (initialPattern ? ipPatternPresets[initialPattern].map((s) => s.slice()) : null) ||
    ipPatternPresets["flat-parallel"].map((s) => s.slice());

  const state = {
    means: initialMeans.map((series) => series.slice()),
    showLines: ipBoolean(opts.showLines ?? opts.lines, true),
    highlight: null,
    draggable: ipBoolean(opts.draggable, false),
    valueLabels: ipBoolean(opts.valueLabels, false),
    axisLabels: ipBoolean(opts.axisLabels ?? opts.labels, !minimal),
    tickLabels: ipBoolean(opts.tickLabels, !minimal),
    legend: ipBoolean(opts.legend, true),
    seriesLabelText: defaultSeriesLabels.slice(),
    yTicks: normalizeYTicks(opts.yTicks, minimal ? "none" : "low-high")
  };
  if (opts.highlight !== undefined) state.highlight = normalizeHighlight(opts.highlight);

  function normalizeHighlight(value) {
    const key = ipKey(value);
    if (["b1", "series-1", "1", "first", "solid"].includes(key)) return 0;
    if (["b2", "series-2", "2", "second", "dashed"].includes(key)) return 1;
    const labelMatch = state.seriesLabelText.findIndex((label) =>
      key && ipKey(label).startsWith(key));
    return labelMatch >= 0 ? labelMatch : null;
  }

  // Leave room on the right for the factor legend beside the plot.
  const legendChars = Math.max(
    factorB.length,
    ...defaultSeriesLabels.map((label) => label.length)
  );
  const margin = Object.assign({
    top: 26,
    right: state.legend ? Math.max(84, Math.min(180, legendChars * 6.8 + 56)) : 28,
    bottom: state.axisLabels ? 58 : 40,
    left: state.axisLabels ? 64 : 46
  }, opts.margin || {});

  // Square plot area by default so the slopes and gaps that encode the two
  // effects compare fairly across figures; aspect = plot width / plot height.
  const aspect = ipPositiveNumber(opts.aspect ?? opts.aspectRatio, 1);
  const innerWidth = width - margin.left - margin.right;
  const height = ipPositiveNumber(opts.height,
    Math.round(margin.top + margin.bottom + innerWidth / aspect));
  const plotBottom = height - margin.bottom;

  const root = d3.create("div")
    .attr("class", "interaction-plot bc-figure")
    .style("--ip-max-width", opts.maxWidth || null);
  const rootNode = root.node();

  // --- Controls -------------------------------------------------------------

  const showControls = ipBoolean(opts.controls, !minimal);
  let controls = null;
  let meanInputs = [];
  let effectValues = null;

  if (showControls) {
    controls = root.append("div")
      .attr("class", "ip-controls bc-control-grid");

    const meansPanel = controls.append("section")
      .attr("class", "bc-control-panel bc-if-control-panel");
    meansPanel.append("p")
      .attr("class", "bc-control-title")
      .text("Cell means");
    const grid = meansPanel.append("div")
      .attr("class", "ip-means-grid");
    grid.append("span");
    xTickLabels.forEach((label) => {
      grid.append("span").attr("class", "ip-grid-head").text(label);
    });
    meanInputs = state.means.map((series, seriesIndex) => {
      grid.append("span")
        .attr("class", "ip-grid-row-label")
        .text(state.seriesLabelText[seriesIndex]);
      return series.map((value, xIndex) => {
        const input = grid.append("input")
          .attr("type", "number")
          .attr("min", Math.min(yDomain[0], yDomain[1]))
          .attr("max", Math.max(yDomain[0], yDomain[1]))
          .attr("step", step)
          .attr("value", value)
          .attr("aria-label",
            "Mean for " + xTickLabels[xIndex] + ", " + state.seriesLabelText[seriesIndex])
          .node();
        input.addEventListener("input", (event) => {
          event.stopPropagation();
          state.means[seriesIndex][xIndex] = clampMean(input.value);
          render({ animate: false });
          notifyValueChange();
        });
        return input;
      });
    });

    const patternPanel = controls.append("section")
      .attr("class", "bc-control-panel bc-if-control-panel");
    patternPanel.append("p")
      .attr("class", "bc-control-title")
      .text("Patterns");
    const buttonRow = patternPanel.append("div")
      .attr("class", "ip-pattern-buttons");
    [
      ["flat-parallel", "Flat parallel"],
      ["sloped-parallel", "Sloped parallel"],
      ["crossover", "Crossover"],
      ["one-flat-one-sloped", "One flat, one sloped"]
    ].forEach(([pattern, label]) => {
      buttonRow.append("button")
        .attr("type", "button")
        .attr("class", "bc-button")
        .text(label)
        .on("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setMeans(ipPatternPresets[pattern], { animate: true });
          notifyValueChange();
        });
    });

    const effectsPanel = controls.append("section")
      .attr("class", "bc-control-panel bc-if-control-panel");
    effectsPanel.append("p")
      .attr("class", "bc-control-title")
      .text("Effects");
    function addReadout(label) {
      const row = effectsPanel.append("div")
        .attr("class", "ip-readout bc-readout-row");
      row.append("span")
        .attr("class", "bc-readout-label")
        .text(label);
      return row.append("span")
        .attr("class", "bc-readout-value");
    }
    effectValues = {
      a: addReadout(factorA),
      b: addReadout(factorB),
      interaction: addReadout("Interaction")
    };
  }

  // --- Chart ----------------------------------------------------------------

  const chartWrap = root.append("div")
    .attr("class", "ip-chart-wrap bc-chart-wrap");

  const svg = chartWrap.append("svg")
    .attr("class", "bc-svg bc-graph")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", opts.ariaLabel ||
      "Interaction plot of four cell means: " + xTickLabels.join(" and ") +
      " on the x axis, one line per level of " + factorB);

  const x = d3.scalePoint()
    .domain([0, 1])
    .range([margin.left, width - margin.right])
    .padding(0.35);
  const y = d3.scaleLinear()
    .domain(yDomain)
    .range([plotBottom, margin.top]);

  const xAxisLayer = svg.append("g")
    .attr("class", "ip-axis ip-axis-x bc-axis")
    .attr("transform", `translate(0,${plotBottom})`);
  const yAxisLayer = svg.append("g")
    .attr("class", "ip-axis ip-axis-y bc-axis")
    .attr("transform", `translate(${margin.left},0)`);

  const xAxisLabel = svg.append("text")
    .attr("class", "ip-axis-label bc-axis-label")
    .attr("x", (margin.left + width - margin.right) / 2)
    .attr("y", height - 12)
    .attr("text-anchor", "middle")
    .text(factorA);
  const yAxisLabel = svg.append("text")
    .attr("class", "ip-axis-label bc-axis-label")
    .attr("transform", `translate(16,${(margin.top + plotBottom) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .text(yLabel);

  const seriesLayer = svg.append("g")
    .attr("class", "ip-series-layer");

  // Point shape is the third redundant encoding of Factor B, after line
  // style and color.
  const symbolShapes = [d3.symbolCircle, d3.symbolTriangle];
  const symbolPath = (seriesIndex, size) =>
    d3.symbol().type(symbolShapes[seriesIndex]).size(size)();

  const seriesGroups = [0, 1].map((seriesIndex) => {
    const group = seriesLayer.append("g")
      .attr("class", "ip-series")
      .attr("data-series", seriesIndex);

    const lineGroup = group.append("g")
      .attr("class", "ip-line-group");
    const line = lineGroup.append("line")
      .attr("class", "ip-line bc-graph-line")
      .attr("data-series", seriesIndex);

    const points = [0, 1].map((xIndex) => {
      const point = group.append("g")
        .attr("class", "ip-point")
        .attr("data-series", seriesIndex)
        .attr("data-x", xIndex);
      point.append("circle")
        .attr("class", "ip-hit")
        .attr("cx", x(xIndex))
        .attr("r", 18);
      const ring = point.append("circle")
        .attr("class", "ip-ring")
        .attr("cx", x(xIndex))
        .attr("r", 11);
      const dot = point.append("path")
        .attr("class", "ip-dot bc-graph-point")
        .attr("d", symbolPath(seriesIndex, 130));
      const valueLabel = point.append("text")
        .attr("class", "ip-value-label")
        .attr("x", x(xIndex));
      return { point, ring, dot, valueLabel, seriesIndex, xIndex };
    });

    return { group, lineGroup, line, points };
  });

  // APA-style legend: the non-x factor's name as title, one keyed line
  // sample per level, placed beside the plot.
  const legendLayer = svg.append("g")
    .attr("class", "ip-legend");
  const legendTitle = legendLayer.append("text")
    .attr("class", "ip-legend-title")
    .attr("dominant-baseline", "hanging")
    .text(factorB);
  const legendItems = [0, 1].map((seriesIndex) => {
    const item = legendLayer.append("g")
      .attr("class", "ip-legend-item")
      .attr("data-series", seriesIndex)
      .attr("transform", `translate(0,${30 + seriesIndex * 24})`);
    item.append("line")
      .attr("class", "ip-line")
      .attr("data-series", seriesIndex)
      .attr("x1", 0)
      .attr("x2", 30);
    item.append("path")
      .attr("class", "ip-dot")
      .attr("transform", "translate(15,0)")
      .attr("d", symbolPath(seriesIndex, 110));
    const label = item.append("text")
      .attr("class", "ip-legend-label")
      .attr("x", 38)
      .attr("dominant-baseline", "middle");
    return { item, label };
  });
  const legendBlockHeight = 30 + 24 + 8;
  legendLayer.attr("transform",
    `translate(${width - margin.right + 18},` +
    `${Math.max(margin.top, (margin.top + plotBottom) / 2 - legendBlockHeight / 2)})`);

  // --- Dragging and keyboard ------------------------------------------------

  const drag = d3.drag()
    .on("start", function() {
      if (!state.draggable) return;
      d3.select(this).classed("is-dragging", true);
    })
    .on("drag", function(event) {
      if (!state.draggable) return;
      const seriesIndex = Number(this.dataset.series);
      const xIndex = Number(this.dataset.x);
      const sourceEvent = event.sourceEvent || event;
      const pointer = d3.pointer(sourceEvent, svg.node());
      const next = snapMean(y.invert(pointer[1]));
      if (next === state.means[seriesIndex][xIndex]) return;
      state.means[seriesIndex][xIndex] = next;
      render({ animate: false });
      notifyValueChange();
    })
    .on("end", function() {
      d3.select(this).classed("is-dragging", false);
    });

  seriesGroups.forEach((series) => {
    series.points.forEach(({ point, seriesIndex, xIndex }) => {
      point.call(drag);
      point.on("keydown", (event) => {
        if (!state.draggable) return;
        let delta = 0;
        if (event.key === "ArrowUp") delta = step;
        else if (event.key === "ArrowDown") delta = -step;
        else if (event.key === "PageUp") delta = step * 4;
        else if (event.key === "PageDown") delta = -step * 4;
        else return;
        event.preventDefault();
        state.means[seriesIndex][xIndex] = snapMean(state.means[seriesIndex][xIndex] + delta);
        render({ animate: false });
        notifyValueChange();
      });
    });
  });

  // --- Derived quantities ---------------------------------------------------

  function effects() {
    const m = state.means;
    const marginalA1 = (m[0][0] + m[1][0]) / 2;
    const marginalA2 = (m[0][1] + m[1][1]) / 2;
    const marginalB1 = (m[0][0] + m[0][1]) / 2;
    const marginalB2 = (m[1][0] + m[1][1]) / 2;
    const mainEffectA = marginalA2 - marginalA1;
    const mainEffectB = marginalB2 - marginalB1;
    const interaction = (m[0][1] - m[0][0]) - (m[1][1] - m[1][0]);
    return {
      marginalA1, marginalA2, marginalB1, marginalB2,
      mainEffectA, mainEffectB, interaction,
      parallel: Math.abs(interaction) < 0.001
    };
  }

  function setValue() {
    const derived = effects();
    rootNode.value = {
      a1b1: state.means[0][0],
      a2b1: state.means[0][1],
      a1b2: state.means[1][0],
      a2b2: state.means[1][1],
      means: state.means.map((series) => series.slice()),
      marginalA1: derived.marginalA1,
      marginalA2: derived.marginalA2,
      marginalB1: derived.marginalB1,
      marginalB2: derived.marginalB2,
      mainEffectA: derived.mainEffectA,
      mainEffectB: derived.mainEffectB,
      interaction: derived.interaction,
      parallel: derived.parallel,
      showLines: state.showLines,
      draggable: state.draggable
    };
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  // --- Rendering ------------------------------------------------------------

  function drawAxes() {
    const tickLabel = (index) => state.tickLabels ? xTickLabels[index] : "";
    xAxisLayer.call(
      d3.axisBottom(x)
        .tickSize(state.tickLabels ? 6 : 0)
        .tickPadding(8)
        .tickFormat(tickLabel)
    );

    if (state.yTicks === "numeric") {
      yAxisLayer.call(d3.axisLeft(y).ticks(opts.yTickCount || 5).tickPadding(6));
    } else if (state.yTicks === "low-high") {
      const [lo, hi] = [Math.min(...yDomain), Math.max(...yDomain)];
      const span = hi - lo;
      yAxisLayer.call(
        d3.axisLeft(y)
          .tickValues([lo + span * 0.25, lo + span * 0.75])
          .tickSize(4)
          .tickPadding(6)
          .tickFormat((value) => value < lo + span * 0.5 ? "Low" : "High")
      );
    } else {
      yAxisLayer.call(d3.axisLeft(y).tickValues([]));
    }

    xAxisLabel.style("display", state.axisLabels ? null : "none");
    yAxisLabel.style("display", state.axisLabels ? null : "none");
  }

  function maybeTransition(selection, animate, duration) {
    if (!animate) return selection;
    return selection.transition("ip-move")
      .duration(duration)
      .ease(d3.easeCubicInOut);
  }

  function render(options) {
    options = options || {};
    const animate = options.animate !== false && !ipPrefersReducedMotion();
    const duration = ipPositiveNumber(options.duration, transitionDuration);

    if (!animate) {
      rootNode.classList.add("ip-no-anim");
    }

    drawAxes();
    rootNode.classList.toggle("is-draggable", state.draggable);

    legendLayer.style("display", state.legend ? null : "none");
    legendTitle.text(factorB);
    legendItems.forEach(({ item, label }, seriesIndex) => {
      label.text(state.seriesLabelText[seriesIndex]);
      item.classed("is-dimmed",
        state.highlight !== null && state.highlight !== seriesIndex);
    });

    seriesGroups.forEach((series, seriesIndex) => {
      const values = state.means[seriesIndex];

      series.group.classed("is-dimmed",
        state.highlight !== null && state.highlight !== seriesIndex);

      maybeTransition(series.line, animate, duration)
        .attr("x1", x(0))
        .attr("x2", x(1))
        .attr("y1", y(values[0]))
        .attr("y2", y(values[1]));

      window.interactiveFigure.setRevealVisible(series.lineGroup, state.showLines, {
        root: rootNode,
        animate
      });

      series.points.forEach(({ point, ring, dot, valueLabel, xIndex }) => {
        const value = values[xIndex];
        const otherValue = state.means[1 - seriesIndex][xIndex];
        // Put each value label on the side of its dot facing away from the
        // other series' dot at the same x, so labels never collide.
        const above = value > otherValue || (value === otherValue && seriesIndex === 0);

        maybeTransition(dot, animate, duration)
          .attr("transform", `translate(${x(xIndex)},${y(value)})`);
        maybeTransition(ring, animate, duration).attr("cy", y(value));
        maybeTransition(point.select(".ip-hit"), animate, duration).attr("cy", y(value));

        valueLabel
          .text(format(value))
          .style("display", state.valueLabels ? null : "none");
        maybeTransition(valueLabel, animate, duration)
          .attr("y", y(value) + (above ? -14 : 24));

        point
          .attr("tabindex", state.draggable ? 0 : null)
          .attr("role", state.draggable ? "slider" : null)
          .attr("aria-orientation", state.draggable ? "vertical" : null)
          .attr("aria-valuemin", state.draggable ? Math.min(...yDomain) : null)
          .attr("aria-valuemax", state.draggable ? Math.max(...yDomain) : null)
          .attr("aria-valuenow", state.draggable ? value : null)
          .attr("aria-label", state.draggable
            ? "Mean for " + xTickLabels[xIndex] + ", " +
              state.seriesLabelText[seriesIndex] + ": " + format(value)
            : null);
      });
    });

    syncControls();
    setValue();

    if (!animate) {
      rootNode.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        rootNode.classList.remove("ip-no-anim");
      });
    }
  }

  function syncControls() {
    meanInputs.forEach((series, seriesIndex) => {
      series.forEach((input, xIndex) => {
        if (document.activeElement !== input) {
          input.value = String(state.means[seriesIndex][xIndex]);
        }
      });
    });
    if (effectValues) {
      const derived = effects();
      effectValues.a.text(signedFormat(derived.mainEffectA));
      effectValues.b.text(signedFormat(derived.mainEffectB));
      effectValues.interaction.text(signedFormat(derived.interaction));
    }
  }

  function setMeans(means, options) {
    const normalized = normalizeMeans(means);
    if (!normalized) return false;
    state.means = normalized;
    render(options);
    return true;
  }

  // --- Tutorial actions -----------------------------------------------------

  function applyTutorialAction(action, context) {
    action = action || {};
    let changed = false;
    let shouldNotify = false;
    const animate = action.animate !== false;
    const renderOptions = { animate, duration: action.duration };

    Object.entries(action).forEach(([rawKey, value]) => {
      switch (ipKey(rawKey)) {
        case "animate":
        case "duration":
          break;
        case "means":
        case "cell-means": {
          const normalized = normalizeMeans(value);
          if (normalized) {
            state.means = normalized;
            changed = true;
            shouldNotify = true;
          }
          break;
        }
        case "pattern": {
          const pattern = ipNormalizePattern(value);
          if (pattern) {
            state.means = ipPatternPresets[pattern].map((series) => series.slice());
            changed = true;
            shouldNotify = true;
          }
          break;
        }
        case "a1b1":
        case "a2b1":
        case "a1b2":
        case "a2b2": {
          const key = ipKey(rawKey);
          const seriesIndex = key.endsWith("b2") ? 1 : 0;
          const xIndex = key.startsWith("a2") ? 1 : 0;
          state.means[seriesIndex][xIndex] = clampMean(value);
          changed = true;
          shouldNotify = true;
          break;
        }
        case "show-lines":
        case "lines":
          state.showLines = ipBoolean(value, state.showLines);
          changed = true;
          break;
        case "highlight":
        case "highlight-series":
          state.highlight = normalizeHighlight(value);
          changed = true;
          break;
        case "value-labels":
        case "show-values":
          state.valueLabels = ipBoolean(value, state.valueLabels);
          changed = true;
          break;
        case "draggable":
        case "drag":
          state.draggable = ipBoolean(value, state.draggable);
          changed = true;
          shouldNotify = true;
          break;
        case "axis-labels":
          state.axisLabels = ipBoolean(value, state.axisLabels);
          changed = true;
          break;
        case "tick-labels":
          state.tickLabels = ipBoolean(value, state.tickLabels);
          changed = true;
          break;
        case "y-ticks":
          state.yTicks = normalizeYTicks(value, state.yTicks);
          changed = true;
          break;
        case "legend":
        case "show-legend":
          state.legend = ipBoolean(value, state.legend);
          changed = true;
          break;
        case "series-labels":
          if (Array.isArray(value) && value.length === 2) {
            state.seriesLabelText = value.map(String);
            state.legend = true;
          } else {
            state.legend = ipBoolean(value, state.legend);
          }
          changed = true;
          break;
        case "controls-open":
        case "controls":
          if (context && typeof context.setControlsOpen === "function") {
            context.setControlsOpen(ipBoolean(value, true), animate);
          }
          break;
        default:
          break;
      }
    });

    if (changed) {
      render(renderOptions);
      if (shouldNotify) notifyValueChange();
    }
  }

  render({ animate: false });

  if (window.interactiveFigure) {
    if (showControls) {
      window.interactiveFigure.wrap({
        root: rootNode,
        controls: controls.node(),
        label: opts.controlsLabel || "interaction plot controls",
        placement: opts.controlsPlacement || "callout",
        layout: opts.controlsLayout || "equal",
        applyAction: applyTutorialAction,
        startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
      });
    } else {
      window.interactiveFigure.ensureStyles();
    }
  }

  return rootNode;
}
