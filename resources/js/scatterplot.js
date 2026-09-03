scFiniteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

scPositiveNumber = (value, fallback) => {
  const number = scFiniteNumber(value);
  return number > 0 ? number : fallback;
}

scBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
    if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
  }
  return Boolean(value);
}

scKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-")

scPrefersReducedMotion = () => {
  if (window.interactiveRuntime && window.interactiveRuntime.motion) {
    return window.interactiveRuntime.motion.isReduced();
  }
  return Boolean(window.bcReducedMotion) || Boolean(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

scMulberry32 = (seed) => {
  let a = scFiniteNumber(seed, 1) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A point cloud whose *sample* correlation is exactly the requested r:
// generate x and noise, regress the noise against x to make it orthogonal,
// standardize both, then mix as y = r·x + sqrt(1 − r²)·noise.
scGenerateCloud = (spec) => {
  spec = spec || {};
  const n = Math.max(3, Math.round(scFiniteNumber(spec.n, 30)));
  const r = Math.max(-1, Math.min(1, scFiniteNumber(spec.r, 0)));
  const rng = scMulberry32(scFiniteNumber(spec.seed, 1));
  const meanX = scFiniteNumber(spec.meanX, 50);
  const meanY = scFiniteNumber(spec.meanY, 50);
  const sdX = scPositiveNumber(spec.sdX, 15);
  const sdY = scPositiveNumber(spec.sdY, 15);
  const decimals = scFiniteNumber(spec.round, 2);

  const normal = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const standardize = (values) => {
    const mean = d3.mean(values);
    const sd = Math.sqrt(d3.mean(values, (v) => (v - mean) * (v - mean))) || 1;
    return values.map((v) => (v - mean) / sd);
  };

  let x = standardize(d3.range(n).map(normal));
  let e = d3.range(n).map(normal);
  const beta = d3.sum(e.map((v, i) => v * x[i])) / (d3.sum(x, (v) => v * v) || 1);
  e = standardize(e.map((v, i) => v - beta * x[i]));

  const round = (v) => Number(v.toFixed(decimals));
  return x.map((v, i) => [
    round(meanX + sdX * v),
    round(meanY + sdY * (r * v + Math.sqrt(1 - r * r) * e[i]))
  ]);
}

scNormalizePoints = (value) => {
  if (!Array.isArray(value)) return null;
  const points = value.map((entry) => {
    if (Array.isArray(entry) && entry.length >= 2) {
      return { x: scFiniteNumber(entry[0]), y: scFiniteNumber(entry[1]), label: entry[2] };
    }
    if (entry && typeof entry === "object") {
      return { x: scFiniteNumber(entry.x), y: scFiniteNumber(entry.y), label: entry.label };
    }
    return null;
  });
  if (points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  return points;
}

scStats = (points) => {
  const n = points.length;
  const meanX = n ? d3.mean(points, (p) => p.x) : 0;
  const meanY = n ? d3.mean(points, (p) => p.y) : 0;
  const ssX = d3.sum(points, (p) => (p.x - meanX) * (p.x - meanX));
  const ssY = d3.sum(points, (p) => (p.y - meanY) * (p.y - meanY));
  const sp = d3.sum(points, (p) => (p.x - meanX) * (p.y - meanY));
  const r = ssX > 0 && ssY > 0 ? sp / Math.sqrt(ssX * ssY) : null;
  const fitSlope = ssX > 0 ? sp / ssX : 0;
  const fitIntercept = meanY - fitSlope * meanX;
  return { n, meanX, meanY, ssX, ssY, sp, r, fitSlope, fitIntercept };
}

scSumSquaredResiduals = (points, slope, intercept) =>
  d3.sum(points, (p) => {
    const residual = p.y - (slope * p.x + intercept);
    return residual * residual;
  })

scEnsureStyles = () => {
  if (document.getElementById("scatterplot-styles")) return;

  const style = document.createElement("style");
  style.id = "scatterplot-styles";
  style.textContent = `
    .scatterplot {
      --sfs-figure-max-width: var(--sc-max-width, 42rem);
      --sc-point-color: var(--graph-point-fill, #0072b2);
      --sc-line-color: var(--sfs-accent, #2780e3);
      --sc-residual-color: var(--sfs-current-color, #d1495b);
      --sc-ellipse-color: var(--sfs-comparison-color, #2f6f9f);
      --sc-drag-color: var(--sfs-focus, #2780e3);
    }

    .scatterplot .sc-dot {
      fill: var(--sc-point-color);
      stroke: var(--sfs-bg, #fff);
      stroke-width: 1.4;
    }

    .scatterplot .sc-hit {
      fill: transparent;
      stroke: none;
    }

    .scatterplot .sc-ring {
      fill: none;
      stroke: var(--sc-drag-color);
      stroke-width: 2;
      opacity: 0;
      transition: opacity 160ms ease;
    }

    .scatterplot .sc-fit-line {
      stroke: var(--sc-line-color);
      fill: none;
      stroke-width: 2.4;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }

    .scatterplot .sc-residual {
      stroke: var(--sc-residual-color);
      stroke-width: 2;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }

    .scatterplot .sc-square {
      fill: var(--sc-residual-color);
      fill-opacity: 0.14;
      stroke: var(--sc-residual-color);
      stroke-width: 1.2;
    }

    .scatterplot .sc-ellipse {
      fill: var(--sc-ellipse-color);
      fill-opacity: 0.08;
      stroke: var(--sc-ellipse-color);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
    }

    .scatterplot .sc-mean-line {
      stroke: var(--graph-text-color, currentColor);
      stroke-width: 1.4;
      stroke-dasharray: 5 4;
      opacity: 0.7;
      vector-effect: non-scaling-stroke;
    }

    .scatterplot .sc-mean-label,
    .scatterplot .sc-point-label,
    .scatterplot .sc-annotation text {
      fill: var(--graph-text-color, currentColor);
      font-family: var(--bs-body-font-family, system-ui, sans-serif);
      font-variant-numeric: tabular-nums;
      user-select: none;
    }

    .scatterplot .sc-mean-label,
    .scatterplot .sc-point-label {
      font-size: 0.8rem;
    }

    .scatterplot .sc-annotation text {
      font-size: 0.95rem;
      font-weight: 600;
    }

    .scatterplot .sc-annotation .sc-annotation-sub {
      font-size: 0.72em;
      font-weight: 600;
    }

    /* Layers double as reveal targets, so this transition must mirror the
       shared .sfs-if-reveal one (it wins on specificity) or hides would snap. */
    .scatterplot .sc-layer {
      transition:
        opacity var(--sfs-if-reveal-duration, 280ms) ease,
        visibility 0s linear var(--sfs-if-reveal-duration, 280ms);
    }

    /* The shared reveal class disables pointer events and never restores
       them; the points layer needs them back for dragging. */
    .scatterplot .sc-layer.is-visible {
      transition-delay: 0s;
      pointer-events: auto;
    }

    .scatterplot .sc-layer.is-dimmed {
      --sfs-if-reveal-opacity: 0.18;
      opacity: 0.18;
    }

    .scatterplot.sc-no-anim .sc-layer,
    .scatterplot.sc-no-anim .sc-ring {
      transition: none !important;
    }

    .scatterplot .sc-point {
      outline: none;
    }

    .scatterplot.is-draggable .sc-point {
      cursor: grab;
    }

    .scatterplot.is-draggable .sc-point.is-dragging {
      cursor: grabbing;
    }

    .scatterplot.is-draggable .sc-point:hover .sc-ring,
    .scatterplot.is-draggable .sc-point:focus-visible .sc-ring,
    .scatterplot.is-draggable .sc-point.is-dragging .sc-ring {
      opacity: 1;
    }

    .scatterplot .sc-axis text,
    .scatterplot .sc-axis-label {
      fill: var(--graph-text-color, currentColor);
      font-family: var(--bs-body-font-family, system-ui, sans-serif);
      font-size: 0.85rem;
    }

    .scatterplot .sc-axis path,
    .scatterplot .sc-axis line {
      stroke: var(--graph-axis-color, currentColor);
    }

    .scatterplot .sc-line-inputs {
      display: grid;
      grid-template-columns: auto minmax(3.6rem, 1fr);
      gap: 0.35rem 0.5rem;
      align-items: center;
      font-size: 0.9rem;
    }

    .scatterplot .sc-line-inputs input[type="number"] {
      width: 100%;
      min-width: 3.4rem;
    }

    .scatterplot .sc-line-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sfs-action-gap, 0.4rem);
      margin-bottom: 0.45rem;
    }

    .scatterplot .sc-readout {
      margin: 0.18rem 0;
    }

    .scatterplot .sc-readout .sfs-readout-label {
      min-width: 6.4rem;
    }

    @media (prefers-reduced-motion: reduce) {
      .scatterplot .sc-layer,
      .scatterplot .sc-ring {
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

makeScatterplot = function(opts) {
  opts = opts || {};
  scEnsureStyles();

  const minimal = scKey(opts.style) === "minimal";
  const width = scPositiveNumber(opts.width, 640);
  const transitionDuration = scPositiveNumber(opts.transitionDuration || opts.duration, 650);
  const format = d3.format(opts.format || ".2~f");
  const rFormat = d3.format(opts.rFormat || ".2f");
  const xLabel = opts.xLabel || "X";
  const yLabel = opts.yLabel || "Y";
  const ellipseScale = scPositiveNumber(opts.ellipseScale, 2);
  const dragStep = scPositiveNumber(opts.dragStep ?? opts.step, 0.5);

  const initialPoints =
    scNormalizePoints(opts.points) ||
    (opts.generate ? scNormalizePoints(scGenerateCloud(opts.generate)) : null) ||
    scNormalizePoints(scGenerateCloud({ r: 0.6, n: 30, seed: 1 }));
  if (Array.isArray(opts.labels)) {
    initialPoints.forEach((point, i) => {
      if (opts.labels[i] !== undefined) point.label = String(opts.labels[i]);
    });
  }

  // Line mode: "fit" recomputes least squares from the current points,
  // "mean" is the null model (slope 0, intercept M_Y, so SS_residual = SS_Y),
  // "custom" holds whatever slope/intercept were supplied.
  function normalizeLine(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === "object") {
      return {
        mode: "custom",
        slope: scFiniteNumber(value.slope, 0),
        intercept: scFiniteNumber(value.intercept, 0)
      };
    }
    const key = scKey(value);
    if (["fit", "best-fit", "least-squares", "regression"].includes(key)) {
      return { mode: "fit" };
    }
    if (["mean", "mean-y", "flat", "null", "intercept-only"].includes(key)) {
      return { mode: "mean" };
    }
    return null;
  }

  const initialLine = normalizeLine(opts.line) ||
    (opts.slope !== undefined || opts.intercept !== undefined
      ? { mode: "custom", slope: scFiniteNumber(opts.slope, 0), intercept: scFiniteNumber(opts.intercept, 0) }
      : { mode: "fit" });

  function normalizeTicks(value, fallback) {
    const key = scKey(value);
    if (["numeric", "numbers", "values"].includes(key)) return "numeric";
    if (["none", "off", "hidden", "false", "0"].includes(key)) return "none";
    return fallback;
  }

  // The r/SS annotation is a readout, not a graph mark, so it never dims.
  const layerNames = ["points", "line", "residuals", "squares", "ellipse", "means"];

  function normalizeEmphasis(value) {
    if (value === undefined || value === null) return null;
    const keys = (Array.isArray(value) ? value : [value]).map(scKey);
    if (keys.some((key) => ["none", "all", "off", ""].includes(key))) return null;
    const matched = keys
      .map((key) => {
        if (["point", "points", "dots", "data"].includes(key)) return "points";
        if (["line", "fit-line", "fit", "best-fit", "regression-line"].includes(key)) return "line";
        if (["residual", "residuals", "errors", "deviations"].includes(key)) return "residuals";
        if (["square", "squares", "squared-residuals", "squared"].includes(key)) return "squares";
        if (["ellipse", "oval"].includes(key)) return "ellipse";
        if (["means", "mean", "crosshair"].includes(key)) return "means";
        return null;
      })
      .filter(Boolean);
    return matched.length ? matched : null;
  }

  const state = {
    points: initialPoints.map((p) => ({ ...p })),
    lineMode: initialLine.mode,
    slope: scFiniteNumber(initialLine.slope, 0),
    intercept: scFiniteNumber(initialLine.intercept, 0),
    showPoints: scBoolean(opts.showPoints, true),
    showLine: scBoolean(opts.showLine, opts.line !== undefined || opts.slope !== undefined),
    showResiduals: scBoolean(opts.showResiduals ?? opts.residuals, false),
    showSquares: scBoolean(opts.showSquares ?? opts.squares ?? opts.squaredResiduals, false),
    showEllipse: scBoolean(opts.showEllipse ?? opts.ellipse, false),
    showMeans: scBoolean(opts.showMeans ?? opts.means, false),
    showR: scBoolean(opts.showR ?? opts.rLabel, false),
    showSS: scBoolean(opts.showSS ?? opts.ssLabel, false),
    pointLabels: scBoolean(opts.pointLabels, false),
    emphasize: normalizeEmphasis(opts.emphasize),
    draggable: scBoolean(opts.draggable, false),
    axisLabels: scBoolean(opts.axisLabels, !minimal),
    ticks: normalizeTicks(opts.ticks ?? opts.tickLabels, minimal ? "none" : "numeric")
  };

  const explicitXDomain = Array.isArray(opts.xDomain) && opts.xDomain.length === 2;
  const explicitYDomain = Array.isArray(opts.yDomain) && opts.yDomain.length === 2;

  const margin = Object.assign({
    top: 24,
    right: 24,
    bottom: state.axisLabels ? 58 : (state.ticks === "none" ? 26 : 40),
    left: state.axisLabels ? 64 : (state.ticks === "none" ? 26 : 46)
  }, opts.margin || {});

  // Square plot area by default so point clouds and ellipses aren't visually
  // stretched; aspect = plot width / plot height.
  const aspect = scPositiveNumber(opts.aspect ?? opts.aspectRatio, 1);
  const innerWidth = width - margin.left - margin.right;
  const height = scPositiveNumber(opts.height,
    Math.round(margin.top + margin.bottom + innerWidth / aspect));
  const plotBottom = height - margin.bottom;
  const plotRight = width - margin.right;

  const root = d3.create("div")
    .attr("class", "scatterplot sfs-figure")
    .style("--sc-max-width", opts.maxWidth || null);
  const rootNode = root.node();

  function autoDomain(accessor, explicit, rawDomain) {
    if (explicit) return rawDomain.map(Number);
    const [lo, hi] = d3.extent(state.points, accessor);
    const pad = Math.max((hi - lo) * 0.12, 0.5);
    return [lo - pad, hi + pad];
  }

  const x = d3.scaleLinear()
    .domain(autoDomain((p) => p.x, explicitXDomain, opts.xDomain))
    .range([margin.left, plotRight])
    .nice();
  const y = d3.scaleLinear()
    .domain(autoDomain((p) => p.y, explicitYDomain, opts.yDomain))
    .range([plotBottom, margin.top])
    .nice();
  let domainsLocked = { x: explicitXDomain, y: explicitYDomain };

  // --- Controls -------------------------------------------------------------

  const showControls = scBoolean(opts.controls, !minimal);
  let controls = null;
  let lineInputs = null;
  let showChecks = null;
  let readouts = null;

  if (showControls) {
    controls = root.append("div")
      .attr("class", "sc-controls sfs-control-grid");

    const linePanel = controls.append("section")
      .attr("class", "sfs-control-panel sfs-if-control-panel");
    linePanel.append("p")
      .attr("class", "sfs-control-title")
      .text("Line");
    const buttonRow = linePanel.append("div")
      .attr("class", "sc-line-buttons");
    [
      ["fit", "Best fit"],
      ["mean", "Flat at mean of Y"]
    ].forEach(([mode, label]) => {
      buttonRow.append("button")
        .attr("type", "button")
        .attr("class", "sfs-button")
        .text(label)
        .on("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          state.lineMode = mode;
          state.showLine = true;
          render({ animate: true });
          notifyValueChange();
        });
    });
    const inputGrid = linePanel.append("div")
      .attr("class", "sc-line-inputs");
    lineInputs = {};
    [["slope", "Slope (b)"], ["intercept", "Intercept (a)"]].forEach(([key, label]) => {
      inputGrid.append("span").text(label);
      const input = inputGrid.append("input")
        .attr("type", "number")
        .attr("step", 0.1)
        .attr("aria-label", label)
        .node();
      input.addEventListener("input", (event) => {
        event.stopPropagation();
        const line = effectiveLine();
        state.slope = key === "slope" ? scFiniteNumber(input.value, line.slope) : line.slope;
        state.intercept = key === "intercept" ? scFiniteNumber(input.value, line.intercept) : line.intercept;
        state.lineMode = "custom";
        state.showLine = true;
        render({ animate: false });
        notifyValueChange();
      });
      lineInputs[key] = input;
    });

    const showPanel = controls.append("section")
      .attr("class", "sfs-control-panel sfs-if-control-panel");
    showPanel.append("p")
      .attr("class", "sfs-control-title")
      .text("Show");
    showChecks = {};
    [
      ["showLine", "Fit line"],
      ["showResiduals", "Residuals"],
      ["showSquares", "Squared residuals"],
      ["showEllipse", "Ellipse"],
      ["showMeans", "Means"]
    ].forEach(([key, label]) => {
      const row = showPanel.append("label")
        .attr("class", "sfs-check-row");
      const input = row.append("input")
        .attr("type", "checkbox")
        .node();
      row.append("span").text(label);
      input.addEventListener("input", (event) => {
        event.stopPropagation();
        state[key] = input.checked;
        render({ animate: true });
        notifyValueChange();
      });
      showChecks[key] = input;
    });

    const statsPanel = controls.append("section")
      .attr("class", "sfs-control-panel sfs-if-control-panel");
    statsPanel.append("p")
      .attr("class", "sfs-control-title")
      .text("Statistics");
    function addReadout(label) {
      const row = statsPanel.append("div")
        .attr("class", "sc-readout sfs-readout-row");
      row.append("span")
        .attr("class", "sfs-readout-label")
        .text(label);
      return row.append("span")
        .attr("class", "sfs-readout-value");
    }
    readouts = {
      r: addReadout("r"),
      slope: addReadout("Slope (b)"),
      intercept: addReadout("Intercept (a)"),
      ssResidual: addReadout("SS residual")
    };
  }

  // --- Chart ----------------------------------------------------------------

  const chartWrap = root.append("div")
    .attr("class", "sc-chart-wrap sfs-chart-wrap");

  const svg = chartWrap.append("svg")
    .attr("class", "sfs-svg sfs-graph")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", opts.ariaLabel ||
      "Scatterplot of " + yLabel + " against " + xLabel);

  const clipId = "sc-clip-" + Math.random().toString(36).slice(2, 9);
  svg.append("clipPath")
    .attr("id", clipId)
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", innerWidth)
    .attr("height", plotBottom - margin.top);

  const xAxisLayer = svg.append("g")
    .attr("class", "sc-axis sc-axis-x sfs-axis")
    .attr("transform", `translate(0,${plotBottom})`);
  const yAxisLayer = svg.append("g")
    .attr("class", "sc-axis sc-axis-y sfs-axis")
    .attr("transform", `translate(${margin.left},0)`);

  const xAxisLabel = svg.append("text")
    .attr("class", "sc-axis-label sfs-axis-label")
    .attr("x", (margin.left + plotRight) / 2)
    .attr("y", height - 12)
    .attr("text-anchor", "middle")
    .text(xLabel);
  const yAxisLabel = svg.append("text")
    .attr("class", "sc-axis-label sfs-axis-label")
    .attr("transform", `translate(16,${(margin.top + plotBottom) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .text(yLabel);

  // Layer order is meaning: ellipse and mean lines behind, squares behind
  // their residual segments, the fit line above those, points on top.
  const ellipseLayer = svg.append("g")
    .attr("class", "sc-layer sc-ellipse-layer")
    .attr("clip-path", `url(#${clipId})`);
  const ellipsePath = ellipseLayer.append("path")
    .attr("class", "sc-ellipse");

  const meansLayer = svg.append("g")
    .attr("class", "sc-layer sc-means-layer")
    .attr("clip-path", `url(#${clipId})`);
  const meanXLine = meansLayer.append("line").attr("class", "sc-mean-line");
  const meanYLine = meansLayer.append("line").attr("class", "sc-mean-line");
  function meanLabel(subscript) {
    const text = meansLayer.append("text").attr("class", "sc-mean-label");
    text.append("tspan").text("M");
    text.append("tspan")
      .attr("class", "sc-annotation-sub")
      .attr("dy", "0.3em")
      .text(subscript);
    return text;
  }
  const meanXText = meanLabel("X");
  const meanYText = meanLabel("Y");

  const squaresLayer = svg.append("g")
    .attr("class", "sc-layer sc-squares-layer")
    .attr("clip-path", `url(#${clipId})`);
  const residualsLayer = svg.append("g")
    .attr("class", "sc-layer sc-residuals-layer")
    .attr("clip-path", `url(#${clipId})`);

  const lineLayer = svg.append("g")
    .attr("class", "sc-layer sc-line-layer")
    .attr("clip-path", `url(#${clipId})`);
  const fitLine = lineLayer.append("line")
    .attr("class", "sc-fit-line sfs-graph-line");

  const pointsLayer = svg.append("g")
    .attr("class", "sc-layer sc-points-layer");
  const labelsLayer = svg.append("g")
    .attr("class", "sc-layer sc-labels-layer");

  const annotationLayer = svg.append("g")
    .attr("class", "sc-layer sc-annotation")
    .attr("transform", `translate(${margin.left + 14},${margin.top + 8})`);
  const rText = annotationLayer.append("text")
    .attr("dominant-baseline", "hanging");
  rText.append("tspan")
    .attr("font-style", "italic")
    .text("r");
  const rValueSpan = rText.append("tspan").text(" = —");
  const ssText = annotationLayer.append("text")
    .attr("y", 24)
    .attr("dominant-baseline", "hanging");
  ssText.append("tspan").text("SS");
  ssText.append("tspan")
    .attr("class", "sc-annotation-sub")
    .attr("dy", "0.35em")
    .text("residual");
  const ssValueSpan = ssText.append("tspan")
    .attr("dy", "-0.35em")
    .text(" = —");

  // --- Derived quantities -----------------------------------------------------

  function effectiveLine() {
    const stats = scStats(state.points);
    if (state.lineMode === "fit") {
      return { slope: stats.fitSlope, intercept: stats.fitIntercept };
    }
    if (state.lineMode === "mean") {
      return { slope: 0, intercept: stats.meanY };
    }
    return { slope: state.slope, intercept: state.intercept };
  }

  function setValue() {
    const stats = scStats(state.points);
    const line = effectiveLine();
    const ssResidual = scSumSquaredResiduals(state.points, line.slope, line.intercept);
    const ssResidualFit = scSumSquaredResiduals(state.points, stats.fitSlope, stats.fitIntercept);
    rootNode.value = {
      n: stats.n,
      meanX: stats.meanX,
      meanY: stats.meanY,
      ssX: stats.ssX,
      ssY: stats.ssY,
      sp: stats.sp,
      r: stats.r,
      rSquared: stats.r === null ? null : stats.r * stats.r,
      fitSlope: stats.fitSlope,
      fitIntercept: stats.fitIntercept,
      lineMode: state.lineMode,
      slope: line.slope,
      intercept: line.intercept,
      ssResidual,
      ssResidualFit,
      seEstimate: stats.n > 2 ? Math.sqrt(ssResidual / (stats.n - 2)) : null,
      points: state.points.map((p) => ({ ...p })),
      draggable: state.draggable
    };
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  // --- Dragging and keyboard --------------------------------------------------

  function clampX(value) {
    const [lo, hi] = x.domain();
    return Math.max(lo, Math.min(hi, value));
  }

  function clampY(value) {
    const [lo, hi] = y.domain();
    return Math.max(lo, Math.min(hi, value));
  }

  function snap(value) {
    return Math.round(value / dragStep) * dragStep;
  }

  const drag = d3.drag()
    .on("start", function() {
      if (!state.draggable) return;
      d3.select(this).classed("is-dragging", true);
    })
    .on("drag", function(event) {
      if (!state.draggable) return;
      const index = Number(this.dataset.index);
      const point = state.points[index];
      if (!point) return;
      const sourceEvent = event.sourceEvent || event;
      const pointer = d3.pointer(sourceEvent, svg.node());
      const nextX = clampX(snap(x.invert(pointer[0])));
      const nextY = clampY(snap(y.invert(pointer[1])));
      if (nextX === point.x && nextY === point.y) return;
      point.x = nextX;
      point.y = nextY;
      render({ animate: false });
      notifyValueChange();
    })
    .on("end", function() {
      d3.select(this).classed("is-dragging", false);
    });

  function handlePointKeydown(event, index) {
    if (!state.draggable) return;
    const point = state.points[index];
    if (!point) return;
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowUp") dy = dragStep;
    else if (event.key === "ArrowDown") dy = -dragStep;
    else if (event.key === "ArrowLeft") dx = -dragStep;
    else if (event.key === "ArrowRight") dx = dragStep;
    else return;
    event.preventDefault();
    point.x = clampX(snap(point.x + dx));
    point.y = clampY(snap(point.y + dy));
    render({ animate: false });
    notifyValueChange();
  }

  // --- Rendering ----------------------------------------------------------------

  function drawAxes(animate, duration) {
    const xAxis = state.ticks === "numeric"
      ? d3.axisBottom(x).ticks(opts.xTickCount || 6).tickPadding(8)
      : d3.axisBottom(x).tickValues([]);
    const yAxis = state.ticks === "numeric"
      ? d3.axisLeft(y).ticks(opts.yTickCount || 6).tickPadding(6)
      : d3.axisLeft(y).tickValues([]);

    maybeTransition(xAxisLayer, animate, duration).call(xAxis);
    maybeTransition(yAxisLayer, animate, duration).call(yAxis);

    xAxisLabel.style("display", state.axisLabels ? null : "none");
    yAxisLabel.style("display", state.axisLabels ? null : "none");
  }

  function maybeTransition(selection, animate, duration) {
    if (!animate) return selection;
    return selection.transition("sc-move")
      .duration(duration)
      .ease(d3.easeCubicInOut);
  }

  // Trace the covariance ellipse in data space and map each sample through
  // the scales, so it stays correct when the x and y units differ.
  function ellipsePathData(stats) {
    if (stats.n < 3 || stats.ssX <= 0 || stats.ssY <= 0) return null;
    const sxx = stats.ssX / (stats.n - 1);
    const syy = stats.ssY / (stats.n - 1);
    const sxy = stats.sp / (stats.n - 1);
    const trace = (sxx + syy) / 2;
    const detRoot = Math.sqrt(Math.max(0, ((sxx - syy) / 2) ** 2 + sxy * sxy));
    const lambda1 = Math.max(trace + detRoot, 1e-9);
    const lambda2 = Math.max(trace - detRoot, lambda1 * 1e-4);
    const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const a = ellipseScale * Math.sqrt(lambda1);
    const b = ellipseScale * Math.sqrt(lambda2);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const samples = d3.range(0, 96).map((i) => {
      const t = (i / 96) * 2 * Math.PI;
      const u = a * Math.cos(t);
      const v = b * Math.sin(t);
      return [
        x(stats.meanX + u * cos - v * sin),
        y(stats.meanY + u * sin + v * cos)
      ];
    });
    return d3.line().curve(d3.curveLinearClosed)(samples);
  }

  function setReveal(target, visible, animate) {
    window.interactiveFigure.setRevealVisible(target, visible, {
      root: rootNode,
      animate
    });
  }

  function render(options) {
    options = options || {};
    const animate = options.animate !== false && !scPrefersReducedMotion();
    const duration = scPositiveNumber(options.duration, transitionDuration);

    if (!animate) {
      rootNode.classList.add("sc-no-anim");
    }

    const stats = scStats(state.points);
    const line = effectiveLine();
    const ssResidual = scSumSquaredResiduals(state.points, line.slope, line.intercept);

    drawAxes(animate, duration);
    rootNode.classList.toggle("is-draggable", state.draggable);

    // Fit line spans the x domain; the clip path trims any vertical overflow.
    const [xLo, xHi] = x.domain();
    maybeTransition(fitLine, animate, duration)
      .attr("x1", x(xLo))
      .attr("y1", y(line.slope * xLo + line.intercept))
      .attr("x2", x(xHi))
      .attr("y2", y(line.slope * xHi + line.intercept));

    // Residual segments join each point to its predicted value.
    const residuals = residualsLayer.selectAll("line.sc-residual")
      .data(state.points)
      .join((enter) => enter.append("line")
        .attr("class", "sc-residual")
        .attr("x1", (p) => x(p.x))
        .attr("x2", (p) => x(p.x))
        .attr("y1", (p) => y(p.y))
        .attr("y2", (p) => y(p.y)));
    maybeTransition(residuals, animate, duration)
      .attr("x1", (p) => x(p.x))
      .attr("x2", (p) => x(p.x))
      .attr("y1", (p) => y(p.y))
      .attr("y2", (p) => y(line.slope * p.x + line.intercept));

    // Each squared residual is a literal square: its side is the on-screen
    // length of the residual segment, drawn toward the side with more room.
    const plotMiddle = (margin.left + plotRight) / 2;
    const squares = squaresLayer.selectAll("rect.sc-square")
      .data(state.points)
      .join((enter) => enter.append("rect")
        .attr("class", "sc-square")
        .attr("x", (p) => x(p.x))
        .attr("y", (p) => y(p.y))
        .attr("width", 0)
        .attr("height", 0));
    maybeTransition(squares, animate, duration)
      .attr("x", (p) => {
        const side = Math.abs(y(p.y) - y(line.slope * p.x + line.intercept));
        return x(p.x) <= plotMiddle ? x(p.x) : x(p.x) - side;
      })
      .attr("y", (p) => Math.min(y(p.y), y(line.slope * p.x + line.intercept)))
      .attr("width", (p) => Math.abs(y(p.y) - y(line.slope * p.x + line.intercept)))
      .attr("height", (p) => Math.abs(y(p.y) - y(line.slope * p.x + line.intercept)));

    // Ellipse.
    const ellipseD = ellipsePathData(stats);
    if (ellipseD) {
      maybeTransition(ellipsePath, animate, duration).attr("d", ellipseD);
    }

    // Mean crosshair.
    maybeTransition(meanXLine, animate, duration)
      .attr("x1", x(stats.meanX))
      .attr("x2", x(stats.meanX))
      .attr("y1", margin.top)
      .attr("y2", plotBottom);
    maybeTransition(meanYLine, animate, duration)
      .attr("x1", margin.left)
      .attr("x2", plotRight)
      .attr("y1", y(stats.meanY))
      .attr("y2", y(stats.meanY));
    meanXText.attr("text-anchor", "middle");
    meanYText.attr("text-anchor", "start");
    maybeTransition(meanXText, animate, duration)
      .attr("x", x(stats.meanX))
      .attr("y", plotBottom - 8);
    maybeTransition(meanYText, animate, duration)
      .attr("x", plotRight - 64)
      .attr("y", y(stats.meanY) - 7);

    // Points.
    const pointGroups = pointsLayer.selectAll("g.sc-point")
      .data(state.points)
      .join((enter) => {
        const group = enter.append("g")
          .attr("class", "sc-point");
        group.append("circle").attr("class", "sc-hit").attr("r", 16);
        group.append("circle").attr("class", "sc-ring").attr("r", 10);
        group.append("circle").attr("class", "sc-dot sfs-graph-point").attr("r", 5.5);
        group.attr("transform", (p) => `translate(${x(p.x)},${y(p.y)})`);
        return group;
      })
      .attr("data-index", (p, i) => i)
      .call(drag)
      .on("keydown", (event) => {
        const index = Number(event.currentTarget.dataset.index);
        handlePointKeydown(event, index);
      });
    maybeTransition(pointGroups, animate, duration)
      .attr("transform", (p) => `translate(${x(p.x)},${y(p.y)})`);
    pointGroups
      .attr("tabindex", state.draggable ? 0 : null)
      .attr("role", state.draggable ? "button" : null)
      .attr("aria-label", (p, i) => state.draggable
        ? "Point " + (p.label || i + 1) + ": " + xLabel + " " + format(p.x) +
          ", " + yLabel + " " + format(p.y)
        : null);

    // Point labels.
    const labels = labelsLayer.selectAll("text.sc-point-label")
      .data(state.points)
      .join("text")
      .attr("class", "sc-point-label")
      .attr("text-anchor", "start")
      .text((p, i) => p.label || String.fromCharCode(65 + (i % 26)));
    maybeTransition(labels, animate, duration)
      .attr("x", (p) => x(p.x) + 9)
      .attr("y", (p) => y(p.y) - 8);

    // Annotations.
    rValueSpan.text(" = " + (stats.r === null ? "—" : rFormat(stats.r)));
    ssValueSpan.text(" = " + format(ssResidual));

    // Reveals.
    setReveal(pointsLayer, state.showPoints, animate);
    setReveal(lineLayer, state.showLine, animate);
    setReveal(residualsLayer, state.showResiduals, animate);
    setReveal(squaresLayer, state.showSquares, animate);
    setReveal(ellipseLayer, state.showEllipse, animate);
    setReveal(meansLayer, state.showMeans, animate);
    setReveal(labelsLayer, state.pointLabels, animate);
    setReveal(rText, state.showR, animate);
    setReveal(ssText, state.showSS, animate);

    // Emphasis dims every layer not in the emphasized set.
    const layerSelections = {
      points: [pointsLayer, labelsLayer],
      line: [lineLayer],
      residuals: [residualsLayer],
      squares: [squaresLayer],
      ellipse: [ellipseLayer],
      means: [meansLayer]
    };
    layerNames.forEach((name) => {
      const dimmed = Boolean(state.emphasize) && !state.emphasize.includes(name);
      layerSelections[name].forEach((layer) => layer.classed("is-dimmed", dimmed));
    });

    syncControls(stats, line, ssResidual);
    setValue();

    if (!animate) {
      rootNode.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        rootNode.classList.remove("sc-no-anim");
      });
    }
  }

  function syncControls(stats, line, ssResidual) {
    if (lineInputs) {
      if (document.activeElement !== lineInputs.slope) {
        lineInputs.slope.value = format(line.slope);
      }
      if (document.activeElement !== lineInputs.intercept) {
        lineInputs.intercept.value = format(line.intercept);
      }
    }
    if (showChecks) {
      Object.entries(showChecks).forEach(([key, input]) => {
        input.checked = state[key];
      });
    }
    if (readouts) {
      readouts.r.text(stats.r === null ? "—" : rFormat(stats.r));
      readouts.slope.text(format(line.slope));
      readouts.intercept.text(format(line.intercept));
      readouts.ssResidual.text(format(ssResidual));
    }
  }

  function setPoints(value, renderOptions) {
    const normalized = scNormalizePoints(value);
    if (!normalized) return false;
    state.points = normalized;
    if (!domainsLocked.x) x.domain(autoDomain((p) => p.x, false)).nice();
    if (!domainsLocked.y) y.domain(autoDomain((p) => p.y, false)).nice();
    render(renderOptions);
    return true;
  }

  // --- Tutorial actions -------------------------------------------------------

  function applyTutorialAction(action, context) {
    action = action || {};
    let changed = false;
    let shouldNotify = false;
    const animate = action.animate !== false;
    const renderOptions = { animate, duration: action.duration };

    Object.entries(action).forEach(([rawKey, value]) => {
      switch (scKey(rawKey)) {
        case "animate":
        case "duration":
          break;
        case "points":
        case "data": {
          const normalized = scNormalizePoints(value);
          if (normalized) {
            state.points = normalized;
            if (!domainsLocked.x) x.domain(autoDomain((p) => p.x, false)).nice();
            if (!domainsLocked.y) y.domain(autoDomain((p) => p.y, false)).nice();
            changed = true;
            shouldNotify = true;
          }
          break;
        }
        case "generate": {
          const normalized = scNormalizePoints(scGenerateCloud(value));
          if (normalized) {
            state.points = normalized;
            if (!domainsLocked.x) x.domain(autoDomain((p) => p.x, false)).nice();
            if (!domainsLocked.y) y.domain(autoDomain((p) => p.y, false)).nice();
            changed = true;
            shouldNotify = true;
          }
          break;
        }
        case "x-domain":
          if (Array.isArray(value) && value.length === 2) {
            x.domain(value.map(Number));
            domainsLocked.x = true;
            changed = true;
          }
          break;
        case "y-domain":
          if (Array.isArray(value) && value.length === 2) {
            y.domain(value.map(Number));
            domainsLocked.y = true;
            changed = true;
          }
          break;
        case "line": {
          if (value === false || ["none", "hide", "off"].includes(scKey(value))) {
            state.showLine = false;
            changed = true;
            break;
          }
          if (value === true || ["show", "on"].includes(scKey(value))) {
            state.showLine = true;
            changed = true;
            break;
          }
          const line = normalizeLine(value);
          if (line) {
            state.lineMode = line.mode;
            if (line.mode === "custom") {
              state.slope = line.slope;
              state.intercept = line.intercept;
            }
            state.showLine = true;
            changed = true;
            shouldNotify = true;
          }
          break;
        }
        case "slope": {
          const current = effectiveLine();
          state.slope = scFiniteNumber(value, current.slope);
          state.intercept = current.intercept;
          state.lineMode = "custom";
          state.showLine = true;
          changed = true;
          shouldNotify = true;
          break;
        }
        case "intercept": {
          const current = effectiveLine();
          state.intercept = scFiniteNumber(value, current.intercept);
          state.slope = current.slope;
          state.lineMode = "custom";
          state.showLine = true;
          changed = true;
          shouldNotify = true;
          break;
        }
        case "show-points":
          state.showPoints = scBoolean(value, state.showPoints);
          changed = true;
          break;
        case "show-line":
          state.showLine = scBoolean(value, state.showLine);
          changed = true;
          break;
        case "show-residuals":
        case "residuals":
          state.showResiduals = scBoolean(value, state.showResiduals);
          changed = true;
          break;
        case "show-squares":
        case "squares":
        case "squared-residuals":
          state.showSquares = scBoolean(value, state.showSquares);
          changed = true;
          break;
        case "show-ellipse":
        case "ellipse":
          state.showEllipse = scBoolean(value, state.showEllipse);
          changed = true;
          break;
        case "show-means":
        case "means":
          state.showMeans = scBoolean(value, state.showMeans);
          changed = true;
          break;
        case "show-r":
        case "r-label":
          state.showR = scBoolean(value, state.showR);
          changed = true;
          break;
        case "show-ss":
        case "ss-label":
          state.showSS = scBoolean(value, state.showSS);
          changed = true;
          break;
        case "point-labels":
          state.pointLabels = scBoolean(value, state.pointLabels);
          changed = true;
          break;
        case "emphasize":
        case "highlight":
          state.emphasize = normalizeEmphasis(value);
          changed = true;
          break;
        case "draggable":
        case "drag":
          state.draggable = scBoolean(value, state.draggable);
          changed = true;
          shouldNotify = true;
          break;
        case "axis-labels":
          state.axisLabels = scBoolean(value, state.axisLabels);
          changed = true;
          break;
        case "ticks":
        case "tick-labels":
          state.ticks = normalizeTicks(value, state.ticks);
          changed = true;
          break;
        case "controls-open":
        case "controls":
          if (context && typeof context.setControlsOpen === "function") {
            context.setControlsOpen(scBoolean(value, true), animate);
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
        label: opts.controlsLabel || "scatterplot controls",
        placement: opts.controlsPlacement || "callout",
        layout: opts.controlsLayout || "equal",
        applyAction: applyTutorialAction,
        startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
      });
    } else {
      window.interactiveFigure.ensureStyles();
    }
  }

  rootNode.setPoints = setPoints;
  return rootNode;
}
