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
  return Boolean(window.sfsReducedMotion) || Boolean(window.matchMedia &&
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

// Everything the four cell means say about the design, from means given as
// [[a1b1, a2b1], [a1b2, a2b2]]. The marginal mean of a level is the mean of
// its two cells (equal cell sizes). The additive prediction for a cell is
// its two marginal means minus the grand mean. "Shows" flags describe the
// pattern in the means only; they say nothing about significance.
ipEffects = (means, epsilon = 1e-6) => {
  const m = means;
  const marginalA1 = (m[0][0] + m[1][0]) / 2;
  const marginalA2 = (m[0][1] + m[1][1]) / 2;
  const marginalB1 = (m[0][0] + m[0][1]) / 2;
  const marginalB2 = (m[1][0] + m[1][1]) / 2;
  const grandMean = (marginalA1 + marginalA2) / 2;
  const mainEffectA = marginalA2 - marginalA1;
  const mainEffectB = marginalB2 - marginalB1;
  const effectAatB1 = m[0][1] - m[0][0];
  const effectAatB2 = m[1][1] - m[1][0];
  const interaction = effectAatB1 - effectAatB2;
  const marginalA = [marginalA1, marginalA2];
  const marginalB = [marginalB1, marginalB2];
  const predictions = marginalB.map((b) => marginalA.map((a) => a + b - grandMean));
  const showsMainEffectA = Math.abs(mainEffectA) > epsilon;
  const showsMainEffectB = Math.abs(mainEffectB) > epsilon;
  const showsInteraction = Math.abs(interaction) > epsilon;
  return {
    marginalA1, marginalA2, marginalB1, marginalB2, grandMean,
    mainEffectA, mainEffectB, effectAatB1, effectAatB2, interaction, predictions,
    parallel: !showsInteraction,
    showsMainEffectA, showsMainEffectB, showsInteraction,
    showsNoEffects: !showsMainEffectA && !showsMainEffectB && !showsInteraction
  };
}

ipNormalizeMarginals = (value) => {
  const key = ipKey(value);
  if (["a", "factor-a", "x"].includes(key)) return "a";
  if (["b", "factor-b", "lines"].includes(key)) return "b";
  if (["both", "all", "true", "1", "on", "show"].includes(key)) return "both";
  return "none";
}

ipEnsureStyles = () => {
  if (document.getElementById("interaction-plot-styles")) return;

  const style = document.createElement("style");
  style.id = "interaction-plot-styles";
  style.textContent = `
    .interaction-plot {
      --sfs-figure-max-width: var(--ip-max-width, 42rem);
      --ip-drag-color: var(--sfs-focus, #2780e3);
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
      stroke: var(--sfs-bg, #fff);
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
      fill: var(--sfs-text, currentColor);
    }

    .interaction-plot .ip-legend-label {
      font-size: 0.85rem;
    }

    .interaction-plot .ip-series,
    .interaction-plot .ip-legend-item {
      transition: opacity 300ms ease;
    }

    /* Overlays never take the pointer from the draggable means below them. */
    .interaction-plot .ip-overlay {
      pointer-events: none;
    }

    /* Marginal means are stand-ins for two cells each, so they are hollow. */
    .interaction-plot .ip-marginal-mark {
      fill: var(--sfs-bg, #fff);
      stroke: var(--ip-marginal-color, var(--graph-text-color, currentColor));
      stroke-width: 2;
    }

    .interaction-plot .ip-marginal-mark[data-series="0"] {
      --ip-marginal-color: var(--graph-series-1, var(--graph-line-color, #0072b2));
    }

    .interaction-plot .ip-marginal-mark[data-series="1"] {
      --ip-marginal-color: var(--graph-series-2, #e69f00);
    }

    .interaction-plot .ip-marginal-link {
      stroke: var(--graph-text-color, currentColor);
      stroke-width: 1.4;
      stroke-dasharray: 2 4;
      stroke-linecap: round;
      fill: none;
      opacity: 0.8;
    }

    .interaction-plot .ip-marginal-label {
      fill: var(--graph-text-color, currentColor);
      font-family: var(--bs-body-font-family, system-ui, sans-serif);
      font-variant-numeric: tabular-nums;
      font-size: 0.8rem;
      font-style: italic;
      user-select: none;
      /* A halo in the page color keeps the number readable over a line. */
      paint-order: stroke;
      stroke: var(--sfs-bg, #fff);
      stroke-width: 4px;
      stroke-linejoin: round;
    }

    /* The additive prediction: where the two main effects alone would put
       each cell mean. Dashed, hollow ghosts in the series color. */
    .interaction-plot .ip-prediction-line,
    .interaction-plot .ip-prediction-dot,
    .interaction-plot .ip-prediction-gap {
      fill: none;
      stroke-width: 1.6;
      stroke-linecap: round;
    }

    .interaction-plot .ip-prediction-line,
    .interaction-plot .ip-prediction-dot {
      stroke: var(--ip-series-color, currentColor);
      stroke-dasharray: 2 4;
      opacity: 0.75;
    }

    .interaction-plot .ip-prediction-dot {
      fill: var(--sfs-bg, #fff);
    }

    .interaction-plot .ip-prediction-gap {
      stroke: var(--graph-text-color, currentColor);
      opacity: 0.7;
    }

    .interaction-plot [data-prediction-series="0"] {
      --ip-series-color: var(--graph-series-1, var(--graph-line-color, #0072b2));
    }

    .interaction-plot [data-prediction-series="1"] {
      --ip-series-color: var(--graph-series-2, #e69f00);
    }

    /* Redrawing with the other factor on the x-axis fades out and back in,
       so no mean appears to change value. */
    .interaction-plot .ip-swap-fade {
      transition: opacity 240ms ease;
    }

    .interaction-plot.is-swapping .ip-swap-fade {
      opacity: 0;
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
      gap: var(--sfs-action-gap, 0.4rem);
    }

    .interaction-plot .ip-readout {
      margin: 0.18rem 0;
    }

    .interaction-plot .ip-readout .sfs-readout-label {
      min-width: 5.6rem;
    }

    @media (prefers-reduced-motion: reduce) {
      .interaction-plot .ip-series,
      .interaction-plot .ip-legend-item,
      .interaction-plot .ip-ring,
      .interaction-plot .ip-swap-fade {
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

  // Presets are written on a 0-10 scale and placed on this plot's own scale.
  function presetMeans(pattern) {
    const lo = Math.min(yDomain[0], yDomain[1]);
    const span = Math.abs(yDomain[1] - yDomain[0]);
    return ipPatternPresets[pattern].map((series) =>
      series.map((value) => lo + (value / 10) * span));
  }

  const initialPattern = ipNormalizePattern(opts.pattern);
  const initialMeans = normalizeMeans(opts.means) ||
    presetMeans(initialPattern || "flat-parallel");

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
    yTicks: normalizeYTicks(opts.yTicks, minimal ? "none" : "low-high"),
    // Which factor's marginal means to draw: "none", "a", "b" or "both".
    marginals: ipNormalizeMarginals(opts.marginals),
    prediction: ipBoolean(opts.prediction, false),
    // Swapped: Factor B on the x-axis and one line per level of Factor A.
    swap: ipBoolean(opts.swapAxes ?? opts.swap, false),
    // The reader's own means, for quiz responses. Null until they move one.
    sketch: null
  };

  // The plot draws "slots": line s at x position i. Unswapped, that is cell
  // (B level s, A level i); swapped, it is cell (B level i, A level s).
  const slotValue = (s, i) => state.swap ? state.means[i][s] : state.means[s][i];
  const setSlotValue = (s, i, value) => {
    if (state.swap) state.means[i][s] = value;
    else state.means[s][i] = value;
  };
  const xFactorName = () => state.swap ? factorB : factorA;
  const lineFactorName = () => state.swap ? factorA : factorB;
  const xLevelLabels = () => state.swap ? state.seriesLabelText : xTickLabels;
  const lineLevelLabels = () => state.swap ? xTickLabels : state.seriesLabelText;
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
  // Either factor can be in the legend once the axes are swapped.
  const legendChars = Math.max(
    factorA.length,
    factorB.length,
    ...xTickLabels.map((label) => label.length),
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
    .attr("class", "interaction-plot sfs-figure")
    .style("--ip-max-width", opts.maxWidth || null);
  const rootNode = root.node();

  // --- Controls -------------------------------------------------------------

  const showControls = ipBoolean(opts.controls, !minimal);
  let controls = null;
  let meanInputs = [];
  let effectValues = null;

  if (showControls) {
    controls = root.append("div")
      .attr("class", "ip-controls sfs-control-grid");

    const meansPanel = controls.append("section")
      .attr("class", "sfs-control-panel sfs-if-control-panel");
    meansPanel.append("p")
      .attr("class", "sfs-control-title")
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
          scheduleSketchCommit();
        });
        return input;
      });
    });

    const patternPanel = controls.append("section")
      .attr("class", "sfs-control-panel sfs-if-control-panel");
    patternPanel.append("p")
      .attr("class", "sfs-control-title")
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
        .attr("class", "sfs-button")
        .text(label)
        .on("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          setMeans(presetMeans(pattern), { animate: true });
          commitSketch();
        });
    });

    const effectsPanel = controls.append("section")
      .attr("class", "sfs-control-panel sfs-if-control-panel");
    effectsPanel.append("p")
      .attr("class", "sfs-control-title")
      .text("Effects");
    function addReadout(label) {
      const row = effectsPanel.append("div")
        .attr("class", "ip-readout sfs-readout-row");
      row.append("span")
        .attr("class", "sfs-readout-label")
        .text(label);
      return row.append("span")
        .attr("class", "sfs-readout-value");
    }
    effectValues = {
      a: addReadout(factorA),
      b: addReadout(factorB),
      interaction: addReadout("Interaction")
    };
  }

  // --- Chart ----------------------------------------------------------------

  const chartWrap = root.append("div")
    .attr("class", "ip-chart-wrap sfs-chart-wrap");

  const svg = chartWrap.append("svg")
    .attr("class", "sfs-svg sfs-graph")
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
    .attr("class", "ip-axis ip-axis-x sfs-axis")
    .attr("transform", `translate(0,${plotBottom})`);
  const yAxisLayer = svg.append("g")
    .attr("class", "ip-axis ip-axis-y sfs-axis")
    .attr("transform", `translate(${margin.left},0)`);

  const xAxisLabel = svg.append("text")
    .attr("class", "ip-axis-label sfs-axis-label")
    .attr("x", (margin.left + width - margin.right) / 2)
    .attr("y", height - 12)
    .attr("text-anchor", "middle")
    .text(factorA);
  const yAxisLabel = svg.append("text")
    .attr("class", "ip-axis-label sfs-axis-label")
    .attr("transform", `translate(16,${(margin.top + plotBottom) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .text(yLabel);

  xAxisLabel.classed("ip-swap-fade", true);

  const predictionLayer = svg.append("g")
    .attr("class", "ip-prediction-layer ip-overlay ip-swap-fade");
  const seriesLayer = svg.append("g")
    .attr("class", "ip-series-layer ip-swap-fade");
  const marginalLayer = svg.append("g")
    .attr("class", "ip-marginal-layer ip-overlay ip-swap-fade");
  const xMid = (x(0) + x(1)) / 2;

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
      .attr("class", "ip-line sfs-graph-line")
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
        .attr("class", "ip-dot sfs-graph-point")
        .attr("d", symbolPath(seriesIndex, 130));
      const valueLabel = point.append("text")
        .attr("class", "ip-value-label")
        .attr("x", x(xIndex));
      return { point, ring, dot, valueLabel, seriesIndex, xIndex };
    });

    return { group, lineGroup, line, points };
  });

  // Additive prediction: per line, a dashed ghost line with hollow ghost
  // dots, and a short connector from each ghost to the real mean.
  const predictionGroups = [0, 1].map((seriesIndex) => {
    const group = predictionLayer.append("g")
      .attr("data-prediction-series", seriesIndex);
    const line = group.append("line").attr("class", "ip-prediction-line");
    const cells = [0, 1].map((xIndex) => ({
      gap: group.append("line")
        .attr("class", "ip-prediction-gap")
        .attr("x1", x(xIndex))
        .attr("x2", x(xIndex)),
      dot: group.append("path")
        .attr("class", "ip-prediction-dot")
        .attr("d", symbolPath(seriesIndex, 110))
    }));
    return { group, line, cells };
  });

  // Marginal means. For the x-axis factor: a hollow diamond midway between
  // the two dots at each x position, joined by a dotted line whose slope is
  // that factor's main effect. For the line factor: a hollow marker at the
  // middle of each line, joined by a dotted link whose length is its main
  // effect.
  const xMarginalGroup = marginalLayer.append("g").attr("class", "ip-marginal-x");
  const xMarginalLink = xMarginalGroup.append("line").attr("class", "ip-marginal-link");
  const xMarginalMarks = [0, 1].map((xIndex) => ({
    mark: xMarginalGroup.append("path")
      .attr("class", "ip-marginal-mark")
      .attr("d", d3.symbol().type(d3.symbolDiamond).size(150)()),
    label: xMarginalGroup.append("text")
      .attr("class", "ip-marginal-label")
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", xIndex === 0 ? "end" : "start")
      .attr("x", x(xIndex) + (xIndex === 0 ? -16 : 16))
  }));
  const lineMarginalGroup = marginalLayer.append("g").attr("class", "ip-marginal-lines");
  const lineMarginalLink = lineMarginalGroup.append("line")
    .attr("class", "ip-marginal-link")
    .attr("x1", xMid)
    .attr("x2", xMid);
  const lineMarginalMarks = [0, 1].map((seriesIndex) => ({
    mark: lineMarginalGroup.append("path")
      .attr("class", "ip-marginal-mark")
      .attr("data-series", seriesIndex)
      .attr("d", symbolPath(seriesIndex, 150)),
    label: lineMarginalGroup.append("text")
      .attr("class", "ip-marginal-label")
      .attr("dominant-baseline", "middle")
      .attr("x", xMid + 14)
  }));

  // APA-style legend: the non-x factor's name as title, one keyed line
  // sample per level, placed beside the plot.
  const legendLayer = svg.append("g")
    .attr("class", "ip-legend ip-swap-fade");
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

  let dragMoved = false;
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
      if (next === slotValue(seriesIndex, xIndex)) return;
      setSlotValue(seriesIndex, xIndex, next);
      dragMoved = true;
      render({ animate: false });
      notifyValueChange();
    })
    .on("end", function() {
      d3.select(this).classed("is-dragging", false);
      // The sketch is published once the reader lets go, not on every pixel.
      if (dragMoved) commitSketch();
      dragMoved = false;
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
        setSlotValue(seriesIndex, xIndex, snapMean(slotValue(seriesIndex, xIndex) + delta));
        render({ animate: false });
        notifyValueChange();
        scheduleSketchCommit();
      });
    });
  });

  // --- Derived quantities ---------------------------------------------------

  function effects() {
    return ipEffects(state.means, step / 4);
  }

  // --- The reader's sketch (quiz responses) -----------------------------------

  let sketchTimer = null;

  function commitSketch() {
    if (sketchTimer) window.clearTimeout(sketchTimer);
    sketchTimer = null;
    state.sketch = {
      a1b1: state.means[0][0],
      a2b1: state.means[0][1],
      a1b2: state.means[1][0],
      a2b2: state.means[1][1]
    };
    setValue();
    notifyValueChange();
  }

  // Keyboard nudges and typed values arrive in bursts; publish once they stop.
  function scheduleSketchCommit() {
    if (sketchTimer) window.clearTimeout(sketchTimer);
    sketchTimer = window.setTimeout(commitSketch, 500);
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
      grandMean: derived.grandMean,
      predictions: derived.predictions,
      mainEffectA: derived.mainEffectA,
      mainEffectB: derived.mainEffectB,
      effectAatB1: derived.effectAatB1,
      effectAatB2: derived.effectAatB2,
      interaction: derived.interaction,
      parallel: derived.parallel,
      showsMainEffectA: derived.showsMainEffectA,
      showsMainEffectB: derived.showsMainEffectB,
      showsInteraction: derived.showsInteraction,
      showsNoEffects: derived.showsNoEffects,
      sketch: state.sketch ? Object.assign({}, state.sketch) : null,
      showLines: state.showLines,
      marginals: state.marginals,
      prediction: state.prediction,
      swapAxes: state.swap,
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
    const tickLabel = (index) => state.tickLabels ? xLevelLabels()[index] : "";
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

    xAxisLabel.text(xFactorName()).style("display", state.axisLabels ? null : "none");
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
    legendTitle.text(lineFactorName());
    if (!opts.ariaLabel) {
      svg.attr("aria-label",
        "Interaction plot of four cell means: " + xLevelLabels().join(" and ") +
        " on the x axis, one line per level of " + lineFactorName());
    }
    legendItems.forEach(({ item, label }, seriesIndex) => {
      label.text(lineLevelLabels()[seriesIndex]);
      item.classed("is-dimmed",
        state.highlight !== null && state.highlight !== seriesIndex);
    });

    seriesGroups.forEach((series, seriesIndex) => {
      const values = [slotValue(seriesIndex, 0), slotValue(seriesIndex, 1)];

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
        const otherValue = slotValue(1 - seriesIndex, xIndex);
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
            ? "Mean for " + xLevelLabels()[xIndex] + ", " +
              lineLevelLabels()[seriesIndex] + ": " + format(value)
            : null);
      });
    });

    renderOverlays(animate, duration);
    syncControls();
    setValue();

    if (!animate) {
      rootNode.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        rootNode.classList.remove("ip-no-anim");
      });
    }
  }

  function renderOverlays(animate, duration) {
    const reveal = (target, visible) =>
      window.interactiveFigure.setRevealVisible(target, visible, { root: rootNode, animate });
    const slots = [0, 1].map((s) => [slotValue(s, 0), slotValue(s, 1)]);
    const xMarginals = [0, 1].map((i) => (slots[0][i] + slots[1][i]) / 2);
    const lineMarginals = slots.map((values) => (values[0] + values[1]) / 2);
    const grand = (xMarginals[0] + xMarginals[1]) / 2;
    const xFactorKey = state.swap ? "b" : "a";
    const showX = state.marginals === "both" || state.marginals === xFactorKey;
    const showLine = state.marginals === "both" ||
      (state.marginals !== "none" && state.marginals !== xFactorKey);

    maybeTransition(xMarginalLink, animate, duration)
      .attr("x1", x(0)).attr("x2", x(1))
      .attr("y1", y(xMarginals[0])).attr("y2", y(xMarginals[1]));
    xMarginalMarks.forEach(({ mark, label }, xIndex) => {
      maybeTransition(mark, animate, duration)
        .attr("transform", `translate(${x(xIndex)},${y(xMarginals[xIndex])})`);
      label.text(format(xMarginals[xIndex]));
      maybeTransition(label, animate, duration).attr("y", y(xMarginals[xIndex]));
    });
    reveal(xMarginalGroup, showX);

    // Keep the two labels at the middle of the plot from sitting on each other.
    const closeBy = Math.abs(y(lineMarginals[0]) - y(lineMarginals[1])) < 16;
    const upper = lineMarginals[0] >= lineMarginals[1] ? 0 : 1;
    maybeTransition(lineMarginalLink, animate, duration)
      .attr("y1", y(lineMarginals[0])).attr("y2", y(lineMarginals[1]));
    lineMarginalMarks.forEach(({ mark, label }, seriesIndex) => {
      const nudge = closeBy ? (seriesIndex === upper ? -9 : 9) : 0;
      maybeTransition(mark, animate, duration)
        .attr("transform", `translate(${xMid},${y(lineMarginals[seriesIndex])})`);
      label.text(format(lineMarginals[seriesIndex]));
      maybeTransition(label, animate, duration)
        .attr("y", y(lineMarginals[seriesIndex]) + nudge);
    });
    reveal(lineMarginalGroup, showLine);

    predictionGroups.forEach(({ line, cells }, seriesIndex) => {
      const predicted = [0, 1].map((i) => xMarginals[i] + lineMarginals[seriesIndex] - grand);
      maybeTransition(line, animate, duration)
        .attr("x1", x(0)).attr("x2", x(1))
        .attr("y1", y(predicted[0])).attr("y2", y(predicted[1]));
      cells.forEach(({ gap, dot }, xIndex) => {
        maybeTransition(dot, animate, duration)
          .attr("transform", `translate(${x(xIndex)},${y(predicted[xIndex])})`);
        maybeTransition(gap, animate, duration)
          .attr("y1", y(predicted[xIndex]))
          .attr("y2", y(slots[seriesIndex][xIndex]));
      });
    });
    reveal(predictionLayer, state.prediction);
  }

  // Redraw with the other factor on the x-axis. The plot fades out, is
  // redrawn in place, and fades back in.
  let swapToken = 0;
  function renderSwap(options) {
    const animate = options.animate !== false && !ipPrefersReducedMotion();
    const token = ++swapToken;
    if (!animate) {
      rootNode.classList.remove("is-swapping");
      render({ animate: false });
      return;
    }
    rootNode.classList.add("is-swapping");
    window.setTimeout(() => {
      if (token !== swapToken) return;
      render({ animate: false });
      rootNode.classList.remove("is-swapping");
    }, 250);
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
    let swapped = false;
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
            state.means = presetMeans(pattern);
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
        case "marginals":
        case "marginal-means":
          state.marginals = ipNormalizeMarginals(value);
          changed = true;
          break;
        case "prediction":
        case "show-prediction":
          state.prediction = ipBoolean(value, state.prediction);
          changed = true;
          break;
        case "swap-axes":
        case "swap": {
          const next = ipBoolean(value, state.swap);
          if (next !== state.swap) {
            state.swap = next;
            swapped = true;
            changed = true;
          }
          break;
        }
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
      if (swapped) renderSwap(renderOptions);
      else if (rootNode.classList.contains("is-swapping")) {
        // A step arrived mid-fade: finish the redraw at once.
        swapToken += 1;
        rootNode.classList.remove("is-swapping");
        render({ animate: false });
      } else render(renderOptions);
      if (shouldNotify) notifyValueChange();
    }
  }

  // A quiz "figure" question saves and restores the reader's sketch here.
  rootNode.quizResponse = {
    setValue: function(path, value) {
      if (path !== "sketch") throw new Error("Unsupported interaction plot response: " + path);
      if (sketchTimer) window.clearTimeout(sketchTimer);
      sketchTimer = null;
      const normalized = value === null || value === undefined ? null : normalizeMeans(value);
      state.means = (normalized || initialMeans).map((series) => series.slice());
      state.sketch = null;
      render({ animate: false });
      if (normalized) commitSketch();
      else notifyValueChange();
    }
  };

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
