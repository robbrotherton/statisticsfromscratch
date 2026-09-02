heightVariabilityStats = window.bcStats || {}
heightVariabilityErf = heightVariabilityStats.erf || ((x) => {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
})
heightVariabilityNormalCdf = heightVariabilityStats.normalCdf || ((x, mean = 0, sd = 1) =>
  0.5 * (1 + heightVariabilityErf((x - mean) / (sd * Math.SQRT2))))
heightVariabilityFiniteNumber = heightVariabilityStats.finiteNumber || ((value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
})

heightVariabilityReducedMotion = () =>
  Boolean(window.bcReducedMotion) ||
  Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)

bcInlineMath = function() {
  return window.interactiveFigure.inlineMath.apply(window.interactiveFigure, arguments);
}

heightVariabilityEnsureStyles = () => {
  if (document.getElementById("height-variability-demo-styles")) return;

  if (window.interactiveFigure) window.interactiveFigure.ensureStyles();

  const style = document.createElement("style");
  style.id = "height-variability-demo-styles";
  style.textContent = `
    .height-variability-demo {
      --hv-population-color: var(--bc-text, var(--bs-body-color, #212529));
      --hv-sample-color: var(--graph-series-2, #e69f00);
      --hv-fixed-center-color: var(--bc-comparison-color, #2f6f9f);
      --hv-selected-color: var(--bc-muted, var(--bs-secondary-color, #6c757d));
      --hv-biased-color: var(--bc-danger-color, #c63f3f);
      --hv-muted-color: var(--bc-muted, var(--bs-secondary-color, #6c757d));
      --hv-title-size: var(--bc-figure-title-size, 1rem);
      --hv-label-size: var(--bc-figure-label-size, 0.875rem);
      --hv-note-size: var(--bc-figure-note-size, 0.8125rem);
      --hv-tick-size: var(--bc-figure-tick-size, 0.8125rem);
      --hv-small-size: var(--bc-figure-small-size, 0.75rem);
      --bc-figure-max-width: 48rem;
      --bc-figure-margin: 1.25rem 0;
    }

    .height-variability-demo .hv-group-title {
      margin: 0 0 0.45rem;
      font-size: 0.95rem;
      font-weight: 700;
      line-height: 1.25;
    }

    .height-variability-demo .hv-row {
      display: grid;
      grid-template-columns: minmax(5.2rem, auto) minmax(2.7rem, auto) 1fr;
      gap: 0.45rem;
      align-items: center;
      min-height: 1.8rem;
      margin: 0.22rem 0;
      font-size: 0.95rem;
    }

    .height-variability-demo .hv-row-compact {
      grid-template-columns: minmax(5.2rem, auto) minmax(4.5rem, 1fr);
    }

    .height-variability-demo .hv-check-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      min-height: 1.65rem;
      margin: 0.18rem 0;
      font-size: 0.95rem;
    }

    .height-variability-demo .hv-value {
      justify-self: end;
      min-width: 2.7rem;
      color: var(--hv-muted-color);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    .height-variability-demo input[type="text"],
    .height-variability-demo input[type="number"] {
      width: 100%;
      min-width: 5rem;
    }

    .height-variability-demo input[type="range"] {
      width: 100%;
      min-width: 6rem;
    }

    .height-variability-demo input[type="checkbox"] {
      width: 1rem;
      height: 1rem;
      flex: 0 0 auto;
    }

    .height-variability-demo .hv-button-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-top: 0.45rem;
    }

    .height-variability-demo .hv-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      min-height: 2rem;
      padding: 0.25rem 0.55rem;
      border: 1px solid var(--bs-border-color, #dee2e6);
      border-radius: 4px;
      background: var(--bs-body-bg, #fff);
      color: var(--bs-body-color, #212529);
      font: inherit;
      line-height: 1.2;
      cursor: pointer;
    }

    .height-variability-demo .hv-button:hover,
    .height-variability-demo .hv-button:focus-visible {
      border-color: var(--bs-primary, #0d6efd);
      color: var(--bs-primary, #0d6efd);
    }

    .height-variability-demo .hv-button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    .height-variability-demo .hv-biased {
      color: var(--hv-biased-color);
    }

    .height-variability-demo .hv-chart-wrap {
      overflow: visible;
    }

    .height-variability-demo svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .height-variability-demo .hv-axis text,
    .height-variability-demo .hv-label {
      fill: var(--hv-muted-color);
      font-size: var(--hv-tick-size);
    }

    .height-variability-demo .hv-axis-label {
      font-size: var(--hv-label-size);
      font-weight: 700;
    }

    .height-variability-demo .hv-population-dot,
    .height-variability-demo .hv-sample-dot {
      stroke: var(--graph-point-stroke, var(--bc-bg, var(--bs-body-bg, #fff)));
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    .height-variability-demo .hv-population-dot.is-sampled {
      stroke: var(--hv-selected-color);
      stroke-width: 2;
    }

    .height-variability-demo .hv-pop-line,
    .height-variability-demo .hv-sample-line,
    .height-variability-demo .hv-fixed-center-line {
      fill: none;
      stroke-width: 2.2;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }

    .height-variability-demo .hv-pop-line {
      stroke: var(--hv-population-color);
    }

    .height-variability-demo .hv-sample-line {
      stroke: var(--hv-biased-color);
    }

    .height-variability-demo .hv-fixed-center-line {
      stroke: var(--hv-fixed-center-color);
      stroke-dasharray: 6 4;
    }

    .height-variability-demo .hv-fixed-center-label {
      fill: var(--hv-fixed-center-color);
    }

    .height-variability-demo .hv-corrected-line {
      fill: none;
      stroke: var(--bt-corrected, var(--hv-sample-color));
      stroke-width: 2.2;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }

    .height-variability-demo .hv-comparison-label {
      font-size: var(--hv-note-size);
      font-weight: 600;
    }

    .height-variability-demo .hv-corrected-label {
      fill: var(--bt-corrected, var(--hv-sample-color));
    }

    .height-variability-demo .hv-mean-line {
      fill: none;
      stroke-width: 2;
      stroke-dasharray: 4 3;
      vector-effect: non-scaling-stroke;
    }

    .height-variability-demo .hv-population-mean-line {
      stroke: var(--hv-population-color);
    }

    .bias-tracking-demo .hv-population-mean-line {
      stroke: var(--bc-text, var(--bs-body-color, currentColor));
      opacity: 0.72;
    }

    .bias-tracking-demo .hv-population-mean-label {
      fill: var(--bc-text, var(--bs-body-color, currentColor));
    }

    .height-variability-demo .hv-sample-mean-line {
      stroke: var(--bt-corrected, var(--hv-sample-color));
    }

    .height-variability-demo .hv-sample-mean-label {
      fill: var(--bt-corrected, var(--hv-sample-color));
    }

    .height-variability-demo .hv-sample-mean-axis-mark {
      fill: var(--bt-corrected, var(--hv-sample-color));
      stroke: var(--graph-point-stroke, var(--bc-bg, var(--bs-body-bg, #fff)));
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    .height-variability-demo .hv-bracket-cap {
      stroke: inherit;
      stroke-width: inherit;
      vector-effect: non-scaling-stroke;
    }

    .height-variability-demo .hv-sample-center-mark {
      fill: var(--hv-biased-color);
      stroke: var(--graph-point-stroke, var(--bc-bg, var(--bs-body-bg, #fff)));
      stroke-width: 1.4;
      vector-effect: non-scaling-stroke;
    }

    .height-variability-demo .hv-center-mark {
      stroke: var(--graph-point-stroke, var(--bc-bg, var(--bs-body-bg, #fff)));
      stroke-width: 1.2;
      vector-effect: non-scaling-stroke;
    }

    .height-variability-demo .hv-population-center-mark {
      fill: var(--hv-population-color);
    }

    .height-variability-demo .hv-fixed-center-mark {
      fill: var(--hv-fixed-center-color);
    }

    .bias-tracking-demo {
      --bt-biased: var(--bc-danger-color, #c63f3f);
      --bt-corrected: var(--bc-comparison-color, #2f6f9f);
      --bt-muted: var(--bc-muted, var(--bs-secondary-color, #6c757d));
      --bt-grid: var(--graph-grid-color, color-mix(in srgb, currentColor 12%, transparent));
      --bc-figure-max-width: 48rem;
      --bc-figure-margin: 1.25rem 0;
    }

    .bias-tracking-demo .bt-control-row {
      display: grid;
      grid-template-columns: auto minmax(2.7rem, auto) 1fr;
      gap: 0.45rem;
      align-items: center;
      margin: 0.22rem 0;
      font-size: 0.95rem;
    }

    .bias-tracking-demo .bt-control-value {
      min-width: 2.7rem;
      color: var(--bt-muted);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    .bias-tracking-demo input[type="range"] {
      width: 100%;
      min-width: 7rem;
    }

    .bias-tracking-demo .bt-mode-row {
      display: flex;
      gap: 0.4rem;
    }

    .bias-tracking-demo .bt-mode-button[aria-pressed="true"] {
      border-color: var(--bc-accent, var(--bs-primary, #0d6efd));
      background: var(--bc-highlight-bg, color-mix(in srgb, currentColor 10%, transparent));
      color: var(--bc-accent, var(--bs-primary, #0d6efd));
      font-weight: 700;
    }

    .bias-tracking-demo .bt-population-wrap {
      margin-bottom: 0.8rem;
      padding: 0.45rem 0.55rem 0.28rem;
      border-radius: 7px;
      background: color-mix(in srgb, var(--bc-text, #212529) 3%, transparent);
    }

    .bias-tracking-demo .hv-overview-wrap {
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      overflow: hidden;
      margin-inline: auto;
    }

    .bias-tracking-demo .hv-overview-wrap > svg {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .bias-tracking-demo .hv-chart-wrap {
      overflow: hidden;
    }

    .bias-tracking-demo .bt-panels {
      position: absolute;
      right: 0;
      left: 0;
      width: 100%;
    }

    .bias-tracking-demo .bt-population-wrap svg,
    .bias-tracking-demo .bt-panels svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .bias-tracking-demo .bt-panel-title {
      fill: var(--bc-text, currentColor);
      font-size: var(--hv-title-size);
      font-weight: 700;
    }

    .bias-tracking-demo .bt-panel-subtitle {
      fill: var(--bt-muted);
      font-size: var(--hv-note-size);
    }

    .bias-tracking-demo .bt-axis text {
      fill: var(--bt-muted);
      font-size: var(--hv-tick-size);
    }

    .bias-tracking-demo .bt-axis-label {
      fill: var(--bt-muted);
      font-size: var(--hv-label-size);
    }

    .bias-tracking-demo .bt-axis path,
    .bias-tracking-demo .bt-axis line {
      stroke: var(--bt-grid);
    }

    .bias-tracking-demo .bt-zero-line {
      stroke: var(--bc-text, currentColor);
      stroke-width: 1.3;
      vector-effect: non-scaling-stroke;
    }

    .bias-tracking-demo .bt-divider {
      stroke: var(--bt-grid);
      vector-effect: non-scaling-stroke;
    }

    .bias-tracking-demo .bt-biased-mark {
      fill: var(--bt-biased);
      stroke: var(--bt-biased);
    }

    .bias-tracking-demo .bt-corrected-mark {
      fill: var(--bt-corrected);
      stroke: var(--bt-corrected);
    }

    .bias-tracking-demo .bt-error-link {
      fill: none;
      stroke: var(--bt-muted);
      stroke-opacity: 0.28;
      stroke-width: 4.2;
      stroke-linecap: round;
    }

    .bias-tracking-demo .bt-history-line {
      fill: none;
      stroke-width: 2.7;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }

    .bias-tracking-demo .bt-raw-mark {
      opacity: 0.82;
    }

    .bias-tracking-demo .bt-raw-point-path {
      stroke-width: 0.7;
      vector-effect: non-scaling-stroke;
    }

    .bias-tracking-demo .bt-sample-dot {
      stroke: var(--graph-point-stroke, var(--bc-bg, white));
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    .bias-tracking-demo .bt-pop-dot {
      opacity: 0.72;
    }

    .bias-tracking-demo .bt-pop-dot.is-sampled {
      opacity: 1;
      stroke: var(--bc-text, currentColor);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
    }

    .bias-tracking-demo .bt-legend {
      position: absolute;
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      justify-content: flex-end;
      gap: 0.35rem;
      margin: 0;
      color: var(--bt-muted);
      font-size: var(--hv-note-size);
      line-height: 1;
      white-space: nowrap;
    }

    .bias-tracking-demo .bt-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 0.16rem;
    }

    .bias-tracking-demo[data-bc-layout="compact"] .bt-legend {
      font-size: calc(var(--hv-note-size) * 0.94);
    }

    .bias-tracking-demo .bt-swatch {
      width: 0.72rem;
      height: 0.72rem;
      background: currentColor;
    }

    .bias-tracking-demo .bt-swatch.is-triangle {
      width: 0.34rem;
      height: 0.34rem;
      flex: 0 0 0.34rem;
      clip-path: polygon(50% 0, 100% 100%, 0 100%);
    }

    .bias-tracking-demo .bt-swatch.is-biased { color: var(--bt-biased); }
    .bias-tracking-demo .bt-swatch.is-corrected { color: var(--bt-corrected); }

  `;
  document.head.appendChild(style);
}

heightVariabilityHashSeed = (seed) => {
  const text = String(seed ?? "height-variability");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

heightVariabilityMulberry32 = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

heightVariabilitySeededRng = (seed, drawIndex = 1) =>
  heightVariabilityMulberry32(heightVariabilityHashSeed(`${seed}:${drawIndex}`))

heightVariabilityMean = (values) =>
  values.length ? d3.sum(values) / values.length : NaN

heightVariabilityMeanSquaredDeviation = (values, center, denominator = values.length) => {
  const ss = d3.sum(values, (value) => (value - center) * (value - center));
  return denominator > 0 ? ss / denominator : NaN;
}

heightVariabilityVariance = (values, denominator) => {
  const mean = heightVariabilityMean(values);
  return heightVariabilityMeanSquaredDeviation(values, mean, denominator);
}

heightVariabilityPalette = () =>
  d3.schemeTableau10 || d3.schemeCategory10 || [
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
    "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ab"
  ]

heightVariabilityBuildPopulation = (opts = {}) => {
  const targetMean = heightVariabilityFiniteNumber(opts.populationMean ?? opts.mean ?? opts.mu, 65);
  const targetSd = Math.max(0.01, heightVariabilityFiniteNumber(opts.populationSd ?? opts.sd ?? opts.sigma, 3));
  const requestedSize = Math.max(1, Math.round(heightVariabilityFiniteNumber(opts.populationSize, 200)));
  const binWidth = Math.max(0.01, heightVariabilityFiniteNumber(opts.binWidth, 1));
  const start = Math.round(targetMean - 4 * targetSd);
  const end = Math.round(targetMean + 4 * targetSd);
  const palette = heightVariabilityPalette();
  const color = d3.scaleOrdinal(palette);
  const rawBins = d3.range(start, end + binWidth / 2, binWidth).map((center) => {
    const lower = center - binWidth / 2;
    const upper = center + binWidth / 2;
    const probability = heightVariabilityNormalCdf(upper, targetMean, targetSd) -
      heightVariabilityNormalCdf(lower, targetMean, targetSd);
    return {
      center,
      lower,
      upper,
      rawProbability: probability
    };
  });
  const probabilityTotal = d3.sum(rawBins, (bin) => bin.rawProbability) || 1;
  const allBins = rawBins.map((bin) => {
    const probability = bin.rawProbability / probabilityTotal;
    const expected = requestedSize * probability;
    return {
      center: bin.center,
      lower: bin.lower,
      upper: bin.upper,
      rawProbability: bin.rawProbability,
      probability,
      expected,
      count: Math.max(0, Math.floor(expected))
    };
  });

  let allocated = d3.sum(allBins, (bin) => bin.count);
  const remainders = allBins
    .map((bin, index) => ({ index, remainder: bin.expected - bin.count }))
    .sort((a, b) => d3.descending(a.remainder, b.remainder) || d3.ascending(a.index, b.index));

  for (let i = 0; allocated < requestedSize && remainders.length; i += 1) {
    allBins[remainders[i % remainders.length].index].count += 1;
    allocated += 1;
  }

  const nonempty = allBins.filter((bin) => bin.count > 0);
  const bins = nonempty.map((bin, index) => Object.assign({}, bin, { index }));
  let id = 0;
  const dots = [];

  bins.forEach((bin) => {
    for (let row = 0; row < bin.count; row += 1) {
      dots.push({
        id,
        value: bin.center,
        binCenter: bin.center,
        binIndex: bin.index,
        row,
        color: color(id)
      });
      id += 1;
    }
  });

  const values = dots.map((dot) => dot.value);
  const mean = heightVariabilityMean(values);
  const varianceN = heightVariabilityVariance(values, values.length);

  return {
    targetMean,
    targetSd,
    requestedSize,
    binWidth,
    bins,
    dots,
    dotsByValue: d3.group(dots, (dot) => dot.value),
    values,
    mean,
    varianceN,
    sdN: Math.sqrt(varianceN),
    size: dots.length,
    min: bins.length ? bins[0].center : targetMean,
    max: bins.length ? bins[bins.length - 1].center : targetMean,
    maxCount: d3.max(bins, (bin) => bin.count) || 0
  };
}

heightVariabilitySampleFromPopulation = (population, seed, drawIndex, n) => {
  const rng = heightVariabilitySeededRng(seed, drawIndex);
  const count = Math.max(0, Math.round(n));
  const dotsByValue = population.dotsByValue || d3.group(population.dots, (dot) => dot.value);
  const usedIds = new Set();
  const stack = new Map();
  return d3.range(count).map((sampleIndex) => {
    // Independent draws use replacement, as repeated-sampling theory assumes.
    // When a value repeats, use another dot from the same bin when possible so
    // each falling mark still has a distinct visible source in the population.
    const selected = population.dots[Math.floor(rng() * population.dots.length)];
    const sameValue = dotsByValue.get(selected.value) || [selected];
    const dot = !usedIds.has(selected.id)
      ? selected
      : (sameValue.find((candidate) => !usedIds.has(candidate.id)) || selected);
    usedIds.add(dot.id);
    const row = stack.get(selected.value) || 0;
    stack.set(selected.value, row + 1);
    return Object.assign({}, dot, {
      value: selected.value,
      sampleIndex,
      sampleRow: row
    });
  });
}

heightVariabilitySummary = (population, seed, n, reps) => {
  const count = Math.max(1, Math.round(reps));
  const rows = d3.range(count).map((index) => {
    const sample = heightVariabilitySampleFromPopulation(population, seed, index + 1, n);
    const values = sample.map((dot) => dot.value);
    return Math.sqrt(heightVariabilityVariance(values, values.length));
  });

  return {
    reps: count,
    sampleSd: d3.mean(rows)
  };
}

heightVariabilityBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
  return fallback;
}

heightVariabilityActionKey = (key) =>
  String(key).trim().toLowerCase().replace(/[\s_]+/g, "-")

heightVariabilityAttachBiasTracker = function(config) {
  const {
    opts, root, rootNode, chartWrap, buttonRow, addButton, group,
    population, state, syncControls, requestUpdate, applyOverviewResponsiveLayout
  } = config;
  const preferredWidth = heightVariabilityFiniteNumber(opts.width, 760);
  const compactBelow = Math.max(320, heightVariabilityFiniteNumber(opts.compactBelow, 560));
  let compact = preferredWidth < compactBelow;
  let width = preferredWidth;
  const maxSamples = Math.max(100, Math.round(heightVariabilityFiniteNumber(opts.maxSamples, 1000)));
  const animationFps = Math.max(15, Math.min(60,
    heightVariabilityFiniteNumber(opts.sampleAnimationFps, 30)));
  const animationFrameInterval = 1000 / animationFps;
  let mode = String(opts.estimator || "mean").toLowerCase() === "variance" ? "variance" : "mean";
  let animationFrame = null;
  let animationToken = 0;
  let historyCacheKey = null;
  let historyCache = [];
  let chartDomainMax = Math.max(25, state.drawIndex);
  let renderedLegendMode = null;
  let renderedScaleKey = null;
  let renderedX = null;
  let renderedRawY = null;
  let renderedAverageY = null;
  let errorLinkScaleKey = null;
  let errorLinkCount = 0;
  let errorLinkD = "";
  let renderedErrorTracker = null;
  let renderedAverageTracker = null;
  let renderedLegendVisible = null;
  const rawPointCache = new Map();

  root.classed("bias-tracking-demo", true);
  const twentyFiveButton = addButton(buttonRow, "fast-forward", "Take 25");
  const hundredButton = addButton(buttonRow, "chevron-double-right", "Take 100");
  const modeControls = group("Track");
  const modeRow = modeControls.append("div").attr("class", "bt-mode-row bc-action-row");
  const meanButton = addButton(modeRow, "bar-chart-line", "Mean");
  const varianceButton = addButton(modeRow, "bounding-box", "Variance");
  d3.select(meanButton).classed("bt-mode-button", true);
  d3.select(varianceButton).classed("bt-mode-button", true);

  const height = 326;
  const margin = { top: 44, right: 50, bottom: 30, left: 54 };
  const sampleAxisPadding = 4;
  let innerWidth = width - margin.left - margin.right;
  const topY0 = margin.top;
  const topY1 = 137;
  const bottomY0 = 198;
  const bottomY1 = height - margin.bottom;
  const panels = chartWrap.append("div").attr("class", "bt-panels");
  const svg = panels.append("svg")
    .attr("class", "bc-svg bc-graph")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", "Sample-by-sample variance errors and their cumulative average");
  const svgTitle = svg.append("title").text("Variance estimation error across repeated samples");

  // Include an instance serial so two trackers with the same seed cannot point
  // at one another's SVG clip paths when they appear on the same page.
  const clipSerial = (heightVariabilityAttachBiasTracker.clipSerial || 0) + 1;
  heightVariabilityAttachBiasTracker.clipSerial = clipSerial;
  const clipBase = `bt-${heightVariabilityHashSeed(`${state.seed}:${population.size}`)}-${clipSerial}`;
  const defs = svg.append("defs");
  const topClip = defs.append("clipPath").attr("id", `${clipBase}-top`).append("rect")
    .attr("x", margin.left).attr("y", topY0).attr("width", innerWidth).attr("height", topY1 - topY0);
  const bottomClip = defs.append("clipPath").attr("id", `${clipBase}-bottom`).append("rect")
    .attr("x", margin.left).attr("y", bottomY0).attr("width", innerWidth).attr("height", bottomY1 - bottomY0);

  const topPanel = svg.append("g")
    .attr("class", "bt-panel bt-error-panel bc-if-reveal");
  const bottomPanel = svg.append("g")
    .attr("class", "bt-panel bt-average-panel bc-if-reveal");

  const topTitle = topPanel.append("text").attr("class", "bt-panel-title")
    .attr("x", margin.left).attr("y", 15);
  const topSubtitle = topPanel.append("text").attr("class", "bt-panel-subtitle")
    .attr("x", margin.left).attr("y", 32);
  const bottomTitle = bottomPanel.append("text").attr("class", "bt-panel-title")
    .attr("x", margin.left).attr("y", bottomY0 - 9);
  const bottomSubtitle = bottomPanel.append("text").attr("class", "bt-panel-subtitle")
    .attr("x", margin.left).attr("y", bottomY0 - 8);
  const divider = bottomPanel.append("line").attr("class", "bt-divider")
    .attr("x1", margin.left).attr("x2", width - margin.right).attr("y1", 157).attr("y2", 157);

  const topGrid = topPanel.append("g").attr("class", "bt-axis");
  const topXAxis = topPanel.append("g").attr("class", "bt-axis");
  const bottomGrid = bottomPanel.append("g").attr("class", "bt-axis");
  const bottomXAxis = bottomPanel.append("g").attr("class", "bt-axis");
  const topZero = topPanel.append("line").attr("class", "bt-zero-line");
  const bottomZero = bottomPanel.append("line").attr("class", "bt-zero-line");
  const rawLayer = topPanel.append("g").attr("clip-path", `url(#${clipBase}-top)`);
  const errorLinksPath = rawLayer.append("path").attr("class", "bt-error-link");
  const rawPointPaths = {
    biased: rawLayer.append("path")
      .attr("class", "bt-biased-mark bt-raw-mark bt-raw-point-path")
      .attr("data-radius", 2.1),
    corrected: rawLayer.append("path")
      .attr("class", "bt-corrected-mark bt-raw-mark bt-raw-point-path")
      .attr("data-radius", 2.1)
  };
  const historyLayer = bottomPanel.append("g").attr("clip-path", `url(#${clipBase}-bottom)`);
  const sampleAxisLabel = bottomPanel.append("text").attr("class", "bt-axis-label")
    .attr("x", margin.left + innerWidth / 2).attr("y", height - 2)
    .attr("text-anchor", "middle").text("Number of samples");

  const legend = panels.append("div")
    .attr("class", "bt-legend bc-if-reveal")
    .attr("aria-label", "Variance estimator legend")
    .style("top", "20.5px");

  function fadeTrackerIn(targets) {
    if (heightVariabilityReducedMotion()) return;
    targets.map((target) => target && typeof target.node === "function" ? target.node() : target)
      .filter(Boolean)
      .forEach((element) => {
        if (!element.classList.contains("is-visible") || typeof element.animate !== "function") return;
        const animation = element.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
        );
        animation.id = "bt-tracker-reveal";
      });
  }

  function allHistory() {
    const key = `${state.seed}:${state.n}:${maxSamples}`;
    if (historyCacheKey === key) return historyCache;

    let meanSum = 0;
    let biasedSum = 0;
    let correctedSum = 0;
    let biasedRelativeSum = 0;
    let correctedRelativeSum = 0;
    historyCacheKey = key;
    historyCache = d3.range(1, maxSamples + 1).map((index) => {
      const sample = heightVariabilitySampleFromPopulation(population, state.seed, index, state.n);
      const values = sample.map((dot) => dot.value);
      const biasedEstimate = heightVariabilityVariance(values, state.n);
      const correctedEstimate = heightVariabilityVariance(values, state.n - 1);
      const meanError = heightVariabilityMean(values) - population.mean;
      const biasedError = biasedEstimate - population.varianceN;
      const correctedError = correctedEstimate - population.varianceN;
      const biasedRelativeError = biasedError / population.varianceN;
      const correctedRelativeError = correctedError / population.varianceN;
      meanSum += meanError;
      biasedSum += biasedError;
      correctedSum += correctedError;
      biasedRelativeSum += biasedRelativeError;
      correctedRelativeSum += correctedRelativeError;
      return {
        index,
        meanError,
        biasedError,
        correctedError,
        biasedRelativeError,
        correctedRelativeError,
        meanAverage: meanSum / index,
        biasedAverage: biasedSum / index,
        correctedAverage: correctedSum / index,
        biasedRelativeAverage: biasedRelativeSum / index,
        correctedRelativeAverage: correctedRelativeSum / index
      };
    });
    return historyCache;
  }

  function update(animate = true) {
    const completeHistory = allHistory();
    const history = completeHistory.slice(0, state.drawIndex);
    const current = history[history.length - 1];
    const isMean = mode === "mean";
    const expectedBias = isMean ? 0 : -1 / state.n;
    const renderSeries = [
      {
        key: "biased",
        active: !isMean,
        error: "biasedRelativeError",
        average: "biasedRelativeAverage",
        className: "bt-biased-mark",
        offset: 0
      },
      {
        key: "corrected",
        active: true,
        error: isMean ? "meanError" : "correctedRelativeError",
        average: isMean ? "meanAverage" : "correctedRelativeAverage",
        className: "bt-corrected-mark",
        offset: 0
      }
    ];
    const series = renderSeries.filter((item) => item.active);

    meanButton.setAttribute("aria-pressed", String(isMean));
    varianceButton.setAttribute("aria-pressed", String(!isMean));

    topTitle.text(isMean ? "Individual sample means" : "Individual variance estimates");
    topSubtitle.text(isMean ? "Error = M − μ (inches)" : "Relative error");
    bottomTitle.text("Cumulative average error");
    bottomSubtitle.text("");
    svg.attr("aria-label", isMean
      ? "Sample-by-sample mean errors and their cumulative average"
      : "Sample-by-sample variance errors and their cumulative average");
    svgTitle.text(isMean
      ? "Mean estimation error across repeated samples"
      : "Variance estimation error across repeated samples");

    if (renderedLegendMode !== mode) {
      renderedLegendMode = mode;
      legend.selectAll("*").remove();
      const legendRows = isMean
        ? []
        : [
            ["is-biased", "is-triangle", "Biased (n)", "Biased variance, dividing by n"],
            ["is-corrected", "is-triangle", "Unbiased (n − 1)", "Unbiased variance, dividing by n minus 1"]
          ];
      legendRows.forEach(([colorClass, shapeClass, label, accessibleLabel]) => {
        const item = legend.append("span")
          .attr("class", "bt-legend-item")
          .attr("aria-label", accessibleLabel);
        item.append("span")
          .attr("class", `bt-swatch ${colorClass} ${shapeClass}`)
          .attr("data-marker-shape", isMean ? "square" : "triangle");
        item.append("span").text(label);
      });
    }

    const showErrorTracker = Boolean(state.showErrorTracker);
    const showAverageTracker = showErrorTracker && Boolean(state.showAverageTracker);
    const showLegend = showErrorTracker && !isMean;
    const errorTrackerChanged = renderedErrorTracker !== showErrorTracker;
    const averageTrackerChanged = renderedAverageTracker !== showAverageTracker;
    const legendChanged = renderedLegendVisible !== showLegend;
    const slideErrorTracker = errorTrackerChanged && showErrorTracker &&
      state.sourceView === "sample" && state.drawIndex === 1 && !showAverageTracker;
    if ((errorTrackerChanged || averageTrackerChanged || legendChanged) &&
        window.interactiveFigure && window.interactiveFigure.setRevealVisible) {
      renderedErrorTracker = showErrorTracker;
      renderedAverageTracker = showAverageTracker;
      renderedLegendVisible = showLegend;
      window.interactiveFigure.setRevealVisible(topPanel, showErrorTracker, {
        root: rootNode,
        animate: animate && !slideErrorTracker
      });
      window.interactiveFigure.setRevealVisible(bottomPanel, showAverageTracker, {
        root: rootNode,
        animate
      });
      window.interactiveFigure.setRevealVisible(legend, showLegend, {
        root: rootNode,
        animate: animate && !slideErrorTracker
      });
      if (animate) {
        if (errorTrackerChanged && showErrorTracker && !slideErrorTracker) {
          fadeTrackerIn([topPanel, legend]);
        }
        if (averageTrackerChanged && showAverageTracker) fadeTrackerIn([bottomPanel]);
        if (legendChanged && showLegend) fadeTrackerIn([legend]);
      }
    }
    legend.interrupt()
      .style("top", `${compact ? 21 : 20.5}px`)
      .style("left", `${margin.left + 78}px`)
      .style("right", `${margin.right}px`);
    panels.classed("is-active", showErrorTracker);
    svg.attr("aria-hidden", String(!showErrorTracker));

    Object.assign(rootNode.value, {
      estimator: mode,
      samples: state.drawIndex,
      sampleAxisMaximum: chartDomainMax,
      isAnimatingSamples: animationFrame !== null,
      showErrorTracker,
      showAverageTracker,
      showExpectedBias: false,
      expectedEstimatorError: isMean ? 0 : -population.varianceN / state.n,
      expectedRelativeEstimatorError: expectedBias,
      expectedBiasedError: -population.varianceN / state.n,
      averageMeanError: current ? current.meanAverage : null,
      averageBiasedError: current ? current.biasedAverage : null,
      averageCorrectedError: current ? current.correctedAverage : null,
      averageRelativeBiasedError: current ? current.biasedRelativeAverage : null,
      averageRelativeCorrectedError: current ? current.correctedRelativeAverage : null
    });

    if (animationFrame === null && state.drawIndex > chartDomainMax) {
      chartDomainMax = state.drawIndex;
    }
    const scaleKey = `${mode}:${state.seed}:${state.n}:${chartDomainMax}:${width}`;
    const scaleChanged = renderedScaleKey !== scaleKey;
    if (scaleChanged) {
      renderedScaleKey = scaleKey;
      renderedX = d3.scaleLinear()
        .domain([1, chartDomainMax])
        .range([margin.left + sampleAxisPadding, width - margin.right - sampleAxisPadding]);
      const rawObserved = d3.max(completeHistory, (row) =>
        d3.max(series, (item) => Math.abs(row[item.error]))) || 0;
      const rawAbs = Math.max(
        isMean ? population.sdN * 1.35 : 1.25,
        rawObserved
      );
      renderedRawY = d3.scaleLinear().domain([-rawAbs, rawAbs]).nice(5).range([topY1, topY0]);
      const averageObserved = d3.max(completeHistory, (row) =>
        d3.max(series, (item) => Math.abs(row[item.average]))) || 0;
      const averageAbs = Math.max(
        isMean ? population.sdN * 0.45 : 0.34,
        averageObserved
      );
      renderedAverageY = d3.scaleSymlog().constant(isMean ? 0.15 : 0.04)
        .domain([-averageAbs, averageAbs]).range([bottomY1, bottomY0]);

      const semanticTickFormat = (value) => value < 0 ? "under" : value > 0 ? "over" : "0";
      const rawAxis = d3.axisLeft(renderedRawY).tickSize(-innerWidth).tickSizeOuter(0);
      const averageAxis = d3.axisLeft(renderedAverageY).tickSize(-innerWidth).tickSizeOuter(0);
      if (isMean) {
        rawAxis.ticks(5);
        averageAxis.ticks(5).tickFormat(d3.format("~g"));
      } else {
        rawAxis
          .tickValues([renderedRawY.domain()[0], 0, renderedRawY.domain()[1]])
          .tickFormat(semanticTickFormat);
        averageAxis
          .tickValues([renderedAverageY.domain()[0], 0, renderedAverageY.domain()[1]])
          .tickFormat(semanticTickFormat);
      }
      topGrid.attr("transform", `translate(${margin.left}, 0)`)
        .call(rawAxis);
      topXAxis.attr("transform", `translate(0, ${topY1})`)
        .call(d3.axisBottom(renderedX).ticks(Math.min(7, chartDomainMax)).tickSizeOuter(0));
      bottomGrid.attr("transform", `translate(${margin.left}, 0)`)
        .call(averageAxis);
      bottomXAxis.attr("transform", `translate(0, ${bottomY1})`)
        .call(d3.axisBottom(renderedX).ticks(Math.min(7, chartDomainMax)).tickSizeOuter(0));
      [topGrid, bottomGrid].forEach((axis) => axis.select(".domain").remove());

      topZero.attr("x1", margin.left).attr("x2", width - margin.right)
        .attr("y1", renderedRawY(0)).attr("y2", renderedRawY(0));
      bottomZero.attr("x1", margin.left).attr("x2", width - margin.right)
        .attr("y1", renderedAverageY(0)).attr("y2", renderedAverageY(0));
    }
    const x = renderedX;
    const rawY = renderedRawY;
    const averageY = renderedAverageY;

    if (isMean) {
      errorLinksPath.attr("display", "none");
      errorLinkScaleKey = null;
      errorLinkCount = 0;
      errorLinkD = "";
    } else {
      errorLinksPath.attr("display", null);
      if (scaleChanged || errorLinkScaleKey !== scaleKey || history.length < errorLinkCount) {
        errorLinkD = "";
        errorLinkCount = 0;
        errorLinkScaleKey = scaleKey;
      }
      if (history.length > errorLinkCount) {
        for (let index = errorLinkCount; index < history.length; index += 1) {
          const row = history[index];
          const linkX = x(row.index);
          errorLinkD += `M${linkX},${rawY(row.biasedRelativeError)}V${rawY(row.correctedRelativeError)}`;
        }
        errorLinkCount = history.length;
        errorLinksPath.attr("d", errorLinkD);
      }
    }

    const rounded = (value) => Math.round(value * 100) / 100;
    const markerShape = isMean ? "square" : "triangle";
    renderSeries.forEach((item) => {
      const pointPath = rawPointPaths[item.key];
      if (!item.active) {
        pointPath.attr("display", "none");
        return;
      }
      pointPath.attr("display", null).attr("data-marker-shape", markerShape);
      let cache = rawPointCache.get(item.key);
      if (!cache || scaleChanged || cache.scaleKey !== scaleKey || history.length < cache.count) {
        cache = { scaleKey, count: 0, d: "" };
      }
      if (history.length > cache.count) {
        for (let index = cache.count; index < history.length; index += 1) {
          const row = history[index];
          const pointX = rounded(x(row.index) + item.offset);
          const pointY = rounded(rawY(row[item.error]));
          if (isMean) {
            const half = 2.15;
            cache.d += `M${rounded(pointX - half)},${rounded(pointY - half)}h4.3v4.3h-4.3Z`;
          } else {
            const radius = 2.65;
            cache.d += `M${pointX},${rounded(pointY - radius)}L${rounded(pointX + radius)},${rounded(pointY + radius * 0.72)}L${rounded(pointX - radius)},${rounded(pointY + radius * 0.72)}Z`;
          }
        }
        cache.count = history.length;
        pointPath.attr("d", cache.d);
      }
      rawPointCache.set(item.key, cache);
    });
    const line = (key) => d3.line().x((row) => x(row.index)).y((row) => averageY(row[key]));
    renderSeries.forEach((item) => {
      const activeHistory = item.active && history.length ? [history] : [];
      historyLayer.selectAll(`path.bt-history-line.${item.className}`)
        .data(activeHistory)
        .join("path")
        .attr("class", `bt-history-line ${item.className}`)
        .attr("d", line(item.average));
    });
  }

  function setMode(value) {
    mode = String(value).toLowerCase() === "variance" ? "variance" : "mean";
    chartDomainMax = Math.max(25, state.drawIndex);
    state.showMeans = mode === "mean";
    state.showPopulationSd = mode === "variance";
    state.showSampleSd = mode === "variance";
    syncControls();
  }

  function cancelAnimation() {
    animationToken += 1;
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
    root.classed("is-sampling", false);
  }

  function resetChartDomain() {
    chartDomainMax = Math.max(25, state.drawIndex);
    renderedScaleKey = null;
  }

  function animateTo(target, animationOptions = {}) {
    const finalCount = Math.max(1, Math.min(maxSamples, Math.round(target)));
    cancelAnimation();
    const startDomain = Math.max(25, chartDomainMax);
    const finalDomain = Math.max(25, finalCount);

    if (finalCount <= state.drawIndex || heightVariabilityReducedMotion()) {
      chartDomainMax = finalDomain;
      renderedScaleKey = null;
      state.drawIndex = finalCount;
      requestUpdate(false);
      return;
    }

    const startCount = state.drawIndex;
    const total = finalCount - startCount;
    const requestedInterval = heightVariabilityFiniteNumber(animationOptions.intervalMs, 0);
    const intervalMs = requestedInterval > 0
      ? Math.max(80, Math.min(2000, requestedInterval))
      : null;
    const duration = intervalMs === null
      ? Math.min(3200, 550 + total * 18)
      : total * intervalMs;
    const startedAt = performance.now();
    let lastRenderedAt = startedAt - animationFrameInterval;
    const token = animationToken;
    root.classed("is-sampling", true);

    function frame(timestamp) {
      if (token !== animationToken) return;
      if (heightVariabilityReducedMotion() || document.hidden) {
        animationFrame = null;
        root.classed("is-sampling", false);
        chartDomainMax = finalDomain;
        renderedScaleKey = null;
        state.drawIndex = finalCount;
        requestUpdate(false, true);
        return;
      }

      const progress = Math.min(1, Math.max(0, (timestamp - startedAt) / duration));
      const easedProgress = d3.easeCubicInOut(progress);
      const nextCount = intervalMs === null
        ? Math.min(finalCount, startCount + Math.max(1, Math.floor(total * easedProgress)))
        : Math.min(finalCount, startCount + Math.floor((timestamp - startedAt) / intervalMs));
      const done = progress >= 1;
      if (!done && timestamp - lastRenderedAt < animationFrameInterval) {
        animationFrame = window.requestAnimationFrame(frame);
        return;
      }
      lastRenderedAt = timestamp;
      chartDomainMax = done
        ? finalDomain
        : startDomain + (finalDomain - startDomain) * easedProgress;
      if (done) {
        animationFrame = null;
        root.classed("is-sampling", false);
      }
      if (nextCount !== state.drawIndex || finalDomain !== startDomain) {
        state.drawIndex = nextCount;
        // Intermediate frames are an internal visual state. Emitting a bubbling
        // input event for each one needlessly wakes the reactive page runtime;
        // the completed state is still announced and dispatched normally.
        requestUpdate(false, done);
      }
      if (!done) animationFrame = window.requestAnimationFrame(frame);
    }

    animationFrame = window.requestAnimationFrame(frame);
  }

  function addSamples(amount) {
    animateTo(state.drawIndex + amount);
  }

  function setTop(value, animate = true) {
    let target = panels.interrupt();
    if (animate && !heightVariabilityReducedMotion()) {
      target = target.transition().duration(680).ease(d3.easeCubicInOut);
    }
    target.style("top", `${Math.max(0, heightVariabilityFiniteNumber(value, 0))}px`);
  }

  function getFootprint() {
    // The SVG deliberately keeps fixed vertical geometry on narrow screens so
    // its typography does not shrink. The variance legend shares the top
    // tracker's subtitle line, so neither estimator needs extra room below.
    if (!state.showErrorTracker) return 0;
    if (!state.showAverageTracker) return topY1 + 34;
    return height + 8;
  }

  twentyFiveButton.addEventListener("click", () => addSamples(25));
  hundredButton.addEventListener("click", () => addSamples(100));
  meanButton.addEventListener("click", () => {
    cancelAnimation();
    setMode("mean");
    requestUpdate(false);
  });
  varianceButton.addEventListener("click", () => {
    cancelAnimation();
    setMode("variance");
    requestUpdate(false);
  });

  function applyResponsiveLayout(layout) {
    cancelAnimation();
    compact = Boolean(layout.compact);
    margin.right = compact ? 22 : 50;
    width = Math.max(280, Math.min(
      preferredWidth,
      heightVariabilityFiniteNumber(layout.width, preferredWidth)
    ));
    innerWidth = width - margin.left - margin.right;
    svg.attr("viewBox", [0, 0, width, height]);
    topClip.attr("width", innerWidth);
    bottomClip.attr("width", innerWidth);
    divider.attr("x2", width - margin.right);
    sampleAxisLabel.attr("x", margin.left + innerWidth / 2);
    renderedScaleKey = null;
    renderedX = null;
    renderedRawY = null;
    renderedAverageY = null;
    errorLinkScaleKey = null;
    errorLinkCount = 0;
    errorLinkD = "";
    rawPointCache.clear();
    if (typeof applyOverviewResponsiveLayout === "function") {
      applyOverviewResponsiveLayout({ width, compact });
    }
    update();
  }

  setMode(mode);
  rootNode.dataset.bcLayout = compact ? "compact" : "wide";
  if (window.interactiveFigure &&
      typeof window.interactiveFigure.observeResponsiveLayout === "function") {
    window.interactiveFigure.observeResponsiveLayout({
      root: rootNode,
      container: panels.node(),
      compactBelow,
      minimumWidth: 280,
      maximumWidth: preferredWidth,
      widthStep: 4,
      onLayout: applyResponsiveLayout
    });
  }
  return {
    update,
    maxSamples,
    setMode,
    getMode: () => mode,
    animateTo,
    cancelAnimation,
    resetChartDomain,
    setTop,
    getFootprint,
    isAnimating: () => animationFrame !== null
  };
}

makeHeightVariabilityDemo = function(opts) {
  opts = opts || {};
  heightVariabilityEnsureStyles();

  const trackingEnabled = Boolean(opts.tracking || opts.trackBias);
  const width = heightVariabilityFiniteNumber(opts.width, 760);
  const compactBelow = Math.max(320, heightVariabilityFiniteNumber(opts.compactBelow, 560));
  const centerOnlyAxis = !trackingEnabled && ["center", "mean", "mu"].includes(
    String(opts.axisMode || "values").trim().toLowerCase()
  );
  const overviewAxisLabel = opts.axisLabel === false
    ? ""
    : (opts.axisLabel === undefined ? "Height (inches)" : String(opts.axisLabel));
  const unitLabel = opts.unitLabel === undefined ? "in" : String(opts.unitLabel).trim();
  const margin = { top: 28, right: 28, bottom: 22, left: 58 };
  const population = heightVariabilityBuildPopulation(opts);
  const usePopulationSdScale = !trackingEnabled &&
    String(opts.sdScale || "raw").trim().toLowerCase() === "population";
  const displaySd = (value) => usePopulationSdScale ? value / population.sdN : value;
  const xDomain = [population.min - population.binWidth / 2, population.max + population.binWidth / 2];
  const x = d3.scaleLinear()
    .domain(xDomain);
  // The sample is a compact strip plot. A fixed number of stacking lanes keeps
  // the chart's geometry stable across repeated samples; exceptionally large
  // ties wrap into subtly offset columns rather than resizing the SVG.
  const configuredSampleStackLanes = Math.max(3, Math.min(8,
    Math.round(heightVariabilityFiniteNumber(opts.sampleStackLanes, 5))));
  const axisGap = Math.max(0, heightVariabilityFiniteNumber(opts.axisGap, 2));
  const overviewSpacing = { stack: 36, axisLabel: 50, comparison: 38, row: 30, sample: 38 };

  function overviewGeometry(diameter, compact, layoutWidth, reserveMeanHeader) {
    // Type stays at the shared CSS size. Only the surrounding whitespace gets
    // denser as the measured chart width narrows, with floors that still leave
    // room for tick labels and the comparison annotations.
    const compactProgress = Math.max(0, Math.min(1,
      (layoutWidth - 240) / Math.max(1, compactBelow - 240)));
    const spacingScale = compact ? 0.74 + compactProgress * 0.16 : 1;
    const spacing = {
      stack: Math.max(26, overviewSpacing.stack * spacingScale),
      axisLabel: Math.max(42, overviewSpacing.axisLabel * spacingScale),
      comparison: Math.max(30, overviewSpacing.comparison * spacingScale),
      row: Math.max(24, overviewSpacing.row * spacingScale),
      sample: Math.max(28, overviewSpacing.sample * spacingScale)
    };
    const topInset = reserveMeanHeader
      ? (compact ? 18 : margin.top)
      : (compact ? 6 : 10);
    const bottomInset = compact ? 12 : margin.bottom;
    const stackLanes = compact
      ? Math.min(3, configuredSampleStackLanes)
      : configuredSampleStackLanes;
    const radius = diameter / 2;
    const sampleStep = diameter * 0.74;
    const populationHeadroom = reserveMeanHeader
      ? Math.max(spacing.stack, diameter * 1.55)
      : Math.max(6, diameter * 0.55);
    const stack = topInset + populationHeadroom;
    const populationBase = stack + Math.max(0, population.maxCount - 1) * diameter;
    const axis = populationBase + radius + axisGap;
    const hasAxisTitle = Boolean(overviewAxisLabel);
    const axisLabel = axis + (hasAxisTitle
      ? Math.max(spacing.axisLabel, diameter * 1.7)
      : Math.max(20, diameter * 0.9));
    const comparisonGap = hasAxisTitle
      ? spacing.comparison
      : Math.max(24, spacing.comparison * 0.7);
    let comparisonFirst;
    let comparisonLast;
    let simpleComparisonLast;
    let sample;
    let sampleBottom;
    let sampleAxis;
    let sampleAxisLabel;

    if (trackingEnabled) {
      // In the bias tutorial the sample becomes the persistent source strip.
      // Keep it above the estimator comparisons so cropping the population out
      // of the view leaves the changing sample docked at the top.
      sample = axisLabel + Math.max(spacing.sample, diameter * 1.65);
      sampleBottom = sample + (stackLanes - 1) * sampleStep + radius;
      sampleAxis = sampleBottom + Math.max(3, diameter * 0.18);
      sampleAxisLabel = sampleAxis + Math.max(36, diameter * 1.5);
      comparisonFirst = sampleAxisLabel + comparisonGap;
      comparisonLast = comparisonFirst + spacing.row * 2;
      simpleComparisonLast = comparisonFirst + spacing.row;
    } else {
      comparisonFirst = axisLabel + comparisonGap;
      comparisonLast = comparisonFirst + spacing.row * 2;
      simpleComparisonLast = comparisonFirst + spacing.row;
      sample = comparisonLast + Math.max(spacing.sample, diameter * 1.65);
      sampleBottom = sample + (stackLanes - 1) * sampleStep + radius;
      sampleAxis = sampleBottom;
      sampleAxisLabel = sampleBottom;
    }
    const contentBottom = trackingEnabled ? comparisonLast : sampleBottom;
    return {
      sampleStackLanes: stackLanes,
      dotRadius: radius,
      dotStep: diameter,
      sampleDotStep: sampleStep,
      stackTop: stack,
      populationBaseY: populationBase,
      axisY: axis,
      axisLabelY: axisLabel,
      comparisonFirstY: comparisonFirst,
      comparisonRowGap: overviewSpacing.row,
      simpleComparisonLastY: simpleComparisonLast,
      comparisonLastY: comparisonLast,
      sampleY: sample,
      sampleAreaBottom: sampleBottom,
      sampleAxisY: sampleAxis,
      sampleAxisLabelY: sampleAxisLabel,
      dynamicHeight: contentBottom + bottomInset
    };
  }

  const requestedHeight = opts.height === undefined || opts.height === null
    ? null
    : Math.max(1, heightVariabilityFiniteNumber(opts.height, 1));
  let renderWidth = width;
  let overviewCompact = width < compactBelow;
  let xUnitWidth;
  let dotDiameter;
  let sampleStackLanes;
  let dotRadius;
  let dotStep;
  let sampleDotStep;
  let stackTop;
  let populationBaseY;
  let axisY;
  let axisLabelY;
  let comparisonFirstY;
  let comparisonRowGap;
  let simpleComparisonLastY;
  let comparisonLastY;
  let sampleY;
  let sampleAreaBottom;
  let sampleAxisY;
  let sampleAxisLabelY;
  let dynamicHeight;
  let height;
  let geometryShowsMeanHeader = false;

  function setOverviewGeometry(nextWidth, compact = overviewCompact) {
    renderWidth = Math.max(240, Math.min(width,
      heightVariabilityFiniteNumber(nextWidth, width)));
    overviewCompact = Boolean(compact);
    x.range([margin.left, renderWidth - margin.right]);
    xUnitWidth = Math.abs(x(population.min + population.binWidth) - x(population.min));
    dotDiameter = Math.max(4,
      xUnitWidth * heightVariabilityFiniteNumber(opts.dotScale, 0.96));
    // Keep tracking geometry fixed when the estimator switches. The population
    // mean label needs this headroom in the opening state, and retaining it
    // prevents the docked sample and tracker stack from jumping later.
    geometryShowsMeanHeader = trackingEnabled;
    const geometry = overviewGeometry(
      dotDiameter,
      overviewCompact,
      renderWidth,
      geometryShowsMeanHeader
    );
    ({
      sampleStackLanes, dotRadius, dotStep, sampleDotStep, stackTop, populationBaseY, axisY, axisLabelY,
      comparisonFirstY, comparisonRowGap, simpleComparisonLastY, comparisonLastY,
      sampleY, sampleAreaBottom, sampleAxisY, sampleAxisLabelY, dynamicHeight
    } = geometry);
    height = requestedHeight === null
      ? dynamicHeight
      : Math.max(requestedHeight, dynamicHeight);
  }

  const defaultSeed = String(opts.seed ?? "height-variability-v1");
  const repetitions = Math.max(10, Math.round(heightVariabilityFiniteNumber(opts.repeatedSamples ?? opts.reps, 1000)));
  const maxSampleSize = Math.max(2, Math.min(50, population.size));
  const f0 = d3.format(".0f");
  const f2 = d3.format(".2f");
  const formatMeasure = (value) => {
    const displayedValue = displaySd(value);
    return unitLabel ? `${f2(displayedValue)} ${unitLabel}` : f2(displayedValue);
  };
  const speakMeasure = (value) => {
    const displayedValue = displaySd(value);
    if (!unitLabel) return f2(displayedValue);
    if (unitLabel === "in") return `${f2(displayedValue)} inches`;
    return `${f2(displayedValue)} ${unitLabel}`;
  };
  // Variance is not a length, even though these spans are drawn on the data
  // axis. Treat the population as a fixed visual reference and scale sample
  // spans by estimate / parameter so width encodes variance directly.
  const varianceReferenceWidth = Math.max(1,
    heightVariabilityFiniteNumber(opts.varianceReferenceWidth, 7));

  const state = {
    seed: defaultSeed,
    drawIndex: Math.max(1, Math.round(heightVariabilityFiniteNumber(
      trackingEnabled ? opts.initialSamples : (opts.draw ?? opts.drawIndex), 1
    ))),
    n: Math.max(2, Math.min(maxSampleSize, Math.round(heightVariabilityFiniteNumber(opts.sampleSize ?? opts.n, 10)))),
    showSample: opts.showSample === undefined ? true : Boolean(opts.showSample),
    showPopulationSd: opts.showPopulationSd === undefined ? true : Boolean(opts.showPopulationSd),
    showSampleSd: opts.showSampleSd === undefined ? true : Boolean(opts.showSampleSd),
    showFixedCenterRms: opts.showFixedCenterRms === undefined
      ? true
      : Boolean(opts.showFixedCenterRms),
    focusSample: Boolean(opts.focusSample),
    sampleSpanCenter: String(opts.sampleSpanCenter || "sample").toLowerCase() === "population"
      ? "population"
      : "sample",
    showMeans: Boolean(opts.showMeans),
    sourceView: String(opts.sourceView || "full").toLowerCase() === "sample"
      ? "sample"
      : "full",
    showErrorTracker: Boolean(opts.showErrorTracker),
    showAverageTracker: Boolean(opts.showAverageTracker),
    showExpectedBias: Boolean(opts.showExpectedBias),
    showSummary: Boolean(opts.showSummary)
  };
  setOverviewGeometry(width, overviewCompact);
  let summaryCacheKey = null;
  let summaryCache = null;

  const root = d3.create("div")
    .attr("class", "height-variability-demo bc-figure")
    .style("--bc-if-reveal-duration", opts.revealDuration || "420ms");
  const rootNode = root.node();

  const controls = root.append("div")
    .attr("class", "hv-controls bc-control-grid");

  function group(title) {
    const section = controls.append("section")
      .attr("class", "hv-group bc-control-panel bc-if-control-panel");
    section.append("p")
      .attr("class", "hv-group-title bc-control-title")
      .text(title);
    return section;
  }

  function addText(parent, label, value) {
    const row = parent.append("label")
      .attr("class", "hv-row hv-row-compact bc-control-row");
    row.append("span").text(label);
    return row.append("input")
      .attr("type", "text")
      .attr("value", value)
      .node();
  }

  function addSlider(parent, label, value, min, max, step) {
    const row = parent.append("label")
      .attr("class", "hv-row bc-control-row");
    row.append("span").text(label);
    const valueNode = row.append("span")
      .attr("class", "hv-value bc-readout-value");
    const input = row.append("input")
      .attr("type", "range")
      .attr("min", min)
      .attr("max", max)
      .attr("step", step)
      .attr("value", value)
      .attr("data-prevent-swipe", "")
      .node();
    return { input, value: valueNode };
  }

  function addCheckbox(parent, label, checked) {
    const row = parent.append("label")
      .attr("class", "hv-check-row bc-check-row");
    const input = row.append("input")
      .attr("type", "checkbox")
      .property("checked", checked)
      .node();
    row.append("span").text(label);
    return input;
  }

  function addButton(parent, icon, label) {
    const button = parent.append("button")
      .attr("type", "button")
      .attr("class", "hv-button bc-button")
      .attr("aria-label", label)
      .attr("title", label);
    button.append("i")
      .attr("class", `bi bi-${icon}`)
      .attr("aria-hidden", "true");
    button.append("span").text(label);
    return button.node();
  }

  const sampleControls = group("Sample");
  const seedInput = addText(sampleControls, "Seed", state.seed);
  const nControl = addSlider(sampleControls, "n", state.n, 2, maxSampleSize, 1);
  const buttonRow = sampleControls.append("div")
    .attr("class", "hv-button-row bc-action-row");
  const newSampleButton = addButton(buttonRow, "arrow-repeat", "New sample");
  const replayButton = addButton(buttonRow, "skip-backward", "Replay seed");

  const displayControls = group("Show");
  const showSampleInput = addCheckbox(displayControls, "Selected sample", state.showSample);
  const showPopulationSdInput = addCheckbox(displayControls, "Population SD", state.showPopulationSd);
  const showFixedCenterRmsInput = addCheckbox(
    displayControls,
    "Sample SD around μ",
    state.showFixedCenterRms
  );
  const showSampleSdInput = addCheckbox(displayControls, "Sample SD around M", state.showSampleSd);
  if (trackingEnabled) displayControls.style("display", "none");

  const chartWrap = root.append("div")
    .attr("class", "hv-chart-wrap bc-chart-wrap");

  const overviewWrap = trackingEnabled
    ? chartWrap.append("div").attr("class", "hv-overview-wrap")
    : chartWrap;
  let overviewScale = 1;
  let overviewMaxWidth = Number.POSITIVE_INFINITY;
  if (trackingEnabled) {
    overviewScale = Math.max(0.25, Math.min(1,
      heightVariabilityFiniteNumber(opts.populationSampleScale, 1)));
    const maxHeight = heightVariabilityFiniteNumber(
      opts.populationSampleMaxHeight,
      Number.POSITIVE_INFINITY
    );
    overviewWrap.style("width", `${overviewScale * 100}%`);
    if (Number.isFinite(maxHeight) && maxHeight > 0) {
      // Preserve the older height-cap option as an initial aspect-ratio-based
      // width cap. The chart itself is still redrawn so its type stays legible.
      overviewMaxWidth = maxHeight * width / height;
      overviewWrap.style("max-width", `${overviewMaxWidth}px`);
    }
  }

  const svg = overviewWrap.append("svg")
    .attr("viewBox", [0, 0, renderWidth, height])
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("class", "bc-svg bc-graph")
    .attr("role", "img")
    .attr("aria-label", centerOnlyAxis
      ? "Dot histogram of a fixed population and selected sample observations"
      : "Dot histogram of a fixed height population and selected sample observations");

  const xAxis = svg.append("g")
    .attr("class", "hv-axis bc-axis bc-graph-axis")
    .attr("transform", `translate(0, ${axisY})`);

  const sampleXAxis = trackingEnabled
    ? svg.append("g")
      .attr("class", "hv-axis hv-sample-axis bc-axis bc-graph-axis")
      .attr("transform", `translate(0, ${sampleAxisY})`)
    : null;
  const sampleXAxisLabel = trackingEnabled
    ? svg.append("text")
      .attr("class", "hv-axis-label hv-sample-axis-label bc-axis-label bc-graph-label")
      .attr("x", (margin.left + renderWidth - margin.right) / 2)
      .attr("y", sampleAxisLabelY)
      .attr("text-anchor", "middle")
      .text(overviewAxisLabel)
    : null;

  const populationLayer = svg.append("g")
    .attr("class", "hv-population-layer");
  const popSdLayer = svg.append("g")
    .attr("class", "hv-pop-layer bc-if-reveal")
    .style("--bc-if-reveal-opacity", 1);
  const sampleLayer = svg.append("g")
    .attr("class", "hv-sample-layer bc-if-reveal")
    .style("--bc-if-reveal-opacity", 1);
  const fixedCenterLayer = svg.append("g")
    .attr("class", "hv-fixed-center-layer bc-if-reveal")
    .style("--bc-if-reveal-opacity", 1);
  const biasedLayer = svg.append("g")
    .attr("class", "hv-biased-layer bc-if-reveal")
    .style("--bc-if-reveal-opacity", 1);
  const varianceComparisonLayer = svg.append("g")
    .attr("class", "hv-variance-comparison-layer bc-if-reveal")
    .style("--bc-if-reveal-opacity", 1);
  const meanLayer = svg.append("g")
    .attr("class", "hv-mean-layer bc-if-reveal")
    .style("--bc-if-reveal-opacity", 1);

  const populationMeanLine = meanLayer.append("line")
    .attr("class", "hv-mean-line hv-population-mean-line");
  const populationMeanLabel = meanLayer.append("text")
    .attr("class", "hv-label bc-tick-label hv-population-mean-label")
    .attr("text-anchor", "middle");
  const sampleMeanLine = meanLayer.append("line")
    .attr("class", "hv-mean-line hv-sample-mean-line");
  const sampleMeanLabel = meanLayer.append("text")
    .attr("class", "hv-label bc-tick-label hv-sample-mean-label")
    .attr("text-anchor", "middle");
  const sampleMeanAxisSize = 10;
  const sampleMeanAxisMark = trackingEnabled
    ? meanLayer.append("rect")
      .attr("class", "hv-sample-mean-axis-mark bc-if-reveal")
      .attr("width", sampleMeanAxisSize)
      .attr("height", sampleMeanAxisSize)
    : null;

  const popLine = popSdLayer.append("g")
    .attr("class", "hv-pop-line");
  popLine.append("line");
  popLine.append("line").attr("class", "hv-bracket-cap");
  popLine.append("line").attr("class", "hv-bracket-cap");
  const centerTrianglePath = d3.symbol().type(d3.symbolTriangle).size(42)();
  const populationCenterMark = popSdLayer.append("path")
    .attr("class", "hv-center-mark hv-population-center-mark")
    .attr("d", centerTrianglePath)
    .attr("aria-hidden", "true");
  const popLabel = popSdLayer.append("text")
    .attr("class", "hv-label bc-tick-label")
    .attr("text-anchor", "middle");

  const samplePoints = sampleLayer.append("g");

  const fixedCenterComparisonLine = fixedCenterLayer.append("g")
    .attr("class", "hv-fixed-center-line");
  fixedCenterComparisonLine.append("line");
  fixedCenterComparisonLine.append("line").attr("class", "hv-bracket-cap");
  fixedCenterComparisonLine.append("line").attr("class", "hv-bracket-cap");
  const fixedCenterMark = fixedCenterLayer.append("path")
    .attr("class", "hv-center-mark hv-fixed-center-mark")
    .attr("d", centerTrianglePath)
    .attr("aria-hidden", "true");
  const fixedCenterComparisonLabel = fixedCenterLayer.append("text")
    .attr("class", "hv-label bc-tick-label hv-fixed-center-label")
    .attr("text-anchor", "middle");

  const sampleComparisonLine = biasedLayer.append("g")
    .attr("class", "hv-sample-line");
  sampleComparisonLine.append("line");
  sampleComparisonLine.append("line").attr("class", "hv-bracket-cap");
  sampleComparisonLine.append("line").attr("class", "hv-bracket-cap");
  const sampleCenterSize = 8.4;
  const sampleCenterMark = sampleComparisonLine.append("rect")
    .attr("class", "hv-sample-center-mark")
    .attr("width", sampleCenterSize)
    .attr("height", sampleCenterSize);
  const sampleComparisonLabel = biasedLayer.append("text")
    .attr("class", "hv-label bc-tick-label hv-biased")
    .attr("text-anchor", "middle");

  function addVarianceComparison(className, labelClassName) {
    const line = varianceComparisonLayer.append("g")
      .attr("class", `${className} hv-comparison-line`);
    line.append("line");
    line.append("line").attr("class", "hv-bracket-cap");
    line.append("line").attr("class", "hv-bracket-cap");
    const label = varianceComparisonLayer.append("text")
      .attr("class", `hv-label hv-comparison-label bc-tick-label ${labelClassName || ""}`.trim())
      .attr("text-anchor", "middle");
    return { line, label };
  }

  const populationVarianceComparison = addVarianceComparison("hv-pop-line", "");
  const biasedVarianceComparison = addVarianceComparison("hv-sample-line", "hv-biased");
  const correctedVarianceComparison = addVarianceComparison("hv-corrected-line", "hv-corrected-label");

  const axisLabel = svg.append("text")
    .attr("class", "hv-axis-label bc-axis-label bc-graph-label")
    .attr("x", (margin.left + renderWidth - margin.right) / 2)
    .attr("y", axisLabelY)
    .attr("text-anchor", "middle")
    .text(overviewAxisLabel)
    .style("display", overviewAxisLabel ? null : "none");

  function readState() {
    state.seed = String(seedInput.value || defaultSeed);
    state.n = Math.max(2, Math.min(maxSampleSize, Math.round(heightVariabilityFiniteNumber(nControl.input.value, state.n))));
    state.showSample = showSampleInput.checked;
    state.showPopulationSd = showPopulationSdInput.checked;
    state.showSampleSd = showSampleSdInput.checked;
    state.showFixedCenterRms = showFixedCenterRmsInput.checked;
  }

  function syncControls() {
    seedInput.value = state.seed;
    nControl.input.value = String(state.n);
    showSampleInput.checked = state.showSample;
    showPopulationSdInput.checked = state.showPopulationSd;
    showSampleSdInput.checked = state.showSampleSd;
    showFixedCenterRmsInput.checked = state.showFixedCenterRms;
  }

  function compute() {
    const sampleDots = heightVariabilitySampleFromPopulation(population, state.seed, state.drawIndex, state.n);
    const sampleValues = sampleDots.map((dot) => dot.value);
    const varianceN = heightVariabilityVariance(sampleValues, sampleValues.length);
    const meanSquaredDeviationFromPopulationMean = heightVariabilityMeanSquaredDeviation(
      sampleValues,
      population.mean,
      sampleValues.length
    );
    let summary = null;
    if (!trackingEnabled) {
      const key = `${state.seed}:${state.n}:${repetitions}`;
      if (summaryCacheKey !== key) {
        summaryCacheKey = key;
        summaryCache = heightVariabilitySummary(population, state.seed, state.n, repetitions);
      }
      summary = summaryCache;
    }
    return {
      population,
      sampleDots,
      sampleValues,
      sampleMean: heightVariabilityMean(sampleValues),
      sampleVarianceN: varianceN,
      sampleSdN: Math.sqrt(varianceN),
      sampleMeanSquaredDeviationFromPopulationMean: meanSquaredDeviationFromPopulationMean,
      sampleRmsDeviationFromPopulationMean: Math.sqrt(meanSquaredDeviationFromPopulationMean),
      sampleMin: d3.min(sampleValues),
      sampleMax: d3.max(sampleValues),
      summary
    };
  }

  function setValue(values) {
    rootNode.value = {
      seed: state.seed,
      drawIndex: state.drawIndex,
      sampleSize: state.n,
      n: state.n,
      targetPopulationMean: population.targetMean,
      targetPopulationSd: population.targetSd,
      populationSize: population.size,
      populationMean: population.mean,
      populationSd: population.sdN,
      displayPopulationSd: displaySd(population.sdN),
      populationVariance: population.varianceN,
      populationBins: population.bins.map((bin) => ({
        center: bin.center,
        count: bin.count
      })),
      sample: values.sampleValues.slice(),
      sampleDots: values.sampleDots.map((dot) => ({
        id: dot.id,
        value: dot.value,
        color: dot.color
      })),
      sampleMean: values.sampleMean,
      sampleMin: values.sampleMin,
      sampleMax: values.sampleMax,
      sampleVarianceN: values.sampleVarianceN,
      sampleVarianceCorrected: values.sampleVarianceN * state.n / (state.n - 1),
      sampleSdN: values.sampleSdN,
      displaySampleSdFromM: displaySd(values.sampleSdN),
      sampleMeanSquaredDeviationFromPopulationMean:
        values.sampleMeanSquaredDeviationFromPopulationMean,
      sampleRmsDeviationFromPopulationMean: values.sampleRmsDeviationFromPopulationMean,
      displaySampleSdFromMu: displaySd(values.sampleRmsDeviationFromPopulationMean),
      repeatedSamples: values.summary ? values.summary.reps : state.drawIndex,
      meanSampleSd: values.summary ? values.summary.sampleSd : null,
      showSample: state.showSample,
      showPopulationSd: state.showPopulationSd,
      showSampleSd: state.showSampleSd,
      showFixedCenterRms: state.showFixedCenterRms,
      focusSample: state.focusSample,
      sampleSpanCenter: state.sampleSpanCenter,
      showMeans: state.showMeans,
      sourceView: state.sourceView,
      showErrorTracker: state.showErrorTracker,
      showAverageTracker: state.showAverageTracker,
      showExpectedBias: state.showExpectedBias,
      showSummary: state.showSummary
    };
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  function setLineWithCaps(group, x1, x2, lineY, capHeight, shouldAnimate = false, delay = 0) {
    let main = group.select("line:not(.hv-bracket-cap)").interrupt();
    let caps = group.selectAll(".hv-bracket-cap").data([x1, x2]).interrupt();
    if (shouldAnimate && !heightVariabilityReducedMotion()) {
      main = main.transition().delay(delay).duration(620).ease(d3.easeCubicInOut);
      caps = caps.transition().delay(delay).duration(620).ease(d3.easeCubicInOut);
    }
    main
      .attr("x1", x1)
      .attr("x2", x2)
      .attr("y1", lineY)
      .attr("y2", lineY);
    caps
      .attr("x1", (d) => d)
      .attr("x2", (d) => d)
      .attr("y1", lineY - capHeight / 2)
      .attr("y2", lineY + capHeight / 2);
  }

  const spanGrowDuration = 460;
  const spanShiftDuration = 560;
  const spanShiftPause = 100;

  function growLineWithCaps(group, centerX, x1, x2, lineY, capHeight, delay = 0) {
    const main = group.select("line:not(.hv-bracket-cap)")
      .interrupt()
      .attr("x1", centerX)
      .attr("x2", centerX)
      .attr("y1", lineY)
      .attr("y2", lineY);
    const caps = group.selectAll(".hv-bracket-cap")
      .interrupt()
      .attr("x1", centerX)
      .attr("x2", centerX)
      .attr("y1", lineY - capHeight / 2)
      .attr("y2", lineY + capHeight / 2);

    const mainGrowth = main.transition()
      .delay(delay)
      .duration(spanGrowDuration)
      .ease(d3.easeCubicOut)
      .attr("x1", x1)
      .attr("x2", x2);
    caps.transition()
      .delay(delay)
      .duration(spanGrowDuration)
      .ease(d3.easeCubicOut)
      .attr("x1", (_, index) => index === 0 ? x1 : x2)
      .attr("x2", (_, index) => index === 0 ? x1 : x2);
    return mainGrowth;
  }

  function positionSampleSpan(
    center,
    values,
    label,
    shouldAnimate = false,
    delay = 0,
    growFromCenter = false
  ) {
    const transition = shouldAnimate && !trackingEnabled && !heightVariabilityReducedMotion();
    const centerX = x(center);
    const x1 = x(center - values.sampleSdN);
    const x2 = x(center + values.sampleSdN);
    let lineTransition = null;
    if (transition && growFromCenter) {
      lineTransition = growLineWithCaps(
        sampleComparisonLine,
        centerX,
        x1,
        x2,
        comparisonLastY,
        14,
        delay
      );
    } else {
      setLineWithCaps(
        sampleComparisonLine,
        x1,
        x2,
        comparisonLastY,
        14,
        transition,
        delay
      );
    }

    let movingCenterMark = sampleCenterMark.interrupt();
    let movingSampleLabel = sampleComparisonLabel.interrupt();
    if (transition && !growFromCenter) {
      movingCenterMark = movingCenterMark.transition()
        .delay(delay)
        .duration(620)
        .ease(d3.easeCubicInOut);
      movingSampleLabel = movingSampleLabel.transition()
        .delay(delay)
        .duration(620)
        .ease(d3.easeCubicInOut);
    }
    movingCenterMark
      .attr("x", centerX - sampleCenterSize / 2)
      .attr("y", comparisonLastY - sampleCenterSize / 2);
    movingSampleLabel
      .attr("x", centerX)
      .attr("y", comparisonLastY - 8)
      .text(label);
    return transition ? (lineTransition || movingCenterMark) : null;
  }

  function growThenShiftSampleSpan(values, label, growDelay = 0) {
    const fittedCenterX = x(values.sampleMean);
    const populationCenterX = x(population.mean);
    const fittedEndpoints = [
      x(values.sampleMean - values.sampleSdN),
      x(values.sampleMean + values.sampleSdN)
    ];
    const alignedEndpoints = [
      x(population.mean - values.sampleSdN),
      x(population.mean + values.sampleSdN)
    ];
    const lineY = comparisonLastY;
    const capHeight = 14;

    const main = sampleComparisonLine.select("line:not(.hv-bracket-cap)")
      .interrupt()
      .attr("x1", fittedCenterX)
      .attr("x2", fittedCenterX)
      .attr("y1", lineY)
      .attr("y2", lineY);
    const caps = sampleComparisonLine.selectAll(".hv-bracket-cap")
      .interrupt()
      .attr("x1", fittedCenterX)
      .attr("x2", fittedCenterX)
      .attr("y1", lineY - capHeight / 2)
      .attr("y2", lineY + capHeight / 2);

    const growingMain = main.transition()
      .delay(growDelay)
      .duration(spanGrowDuration)
      .ease(d3.easeCubicOut)
      .attr("x1", fittedEndpoints[0])
      .attr("x2", fittedEndpoints[1]);
    growingMain.transition()
      .delay(spanShiftPause)
      .duration(spanShiftDuration)
      .ease(d3.easeCubicInOut)
      .attr("x1", alignedEndpoints[0])
      .attr("x2", alignedEndpoints[1]);

    const growingCaps = caps.transition()
      .delay(growDelay)
      .duration(spanGrowDuration)
      .ease(d3.easeCubicOut)
      .attr("x1", (_, index) => fittedEndpoints[index])
      .attr("x2", (_, index) => fittedEndpoints[index]);
    growingCaps.transition()
      .delay(spanShiftPause)
      .duration(spanShiftDuration)
      .ease(d3.easeCubicInOut)
      .attr("x1", (_, index) => alignedEndpoints[index])
      .attr("x2", (_, index) => alignedEndpoints[index]);

    sampleCenterMark.interrupt()
      .attr("x", fittedCenterX - sampleCenterSize / 2)
      .attr("y", lineY - sampleCenterSize / 2);
    sampleComparisonLabel.interrupt()
      .attr("x", fittedCenterX)
      .attr("y", lineY - 8)
      .text(label);

    const shiftDelay = growDelay + spanGrowDuration + spanShiftPause;
    const movingCenterMark = sampleCenterMark.transition()
      .delay(shiftDelay)
      .duration(spanShiftDuration)
      .ease(d3.easeCubicInOut)
      .attr("x", populationCenterX - sampleCenterSize / 2);
    sampleComparisonLabel.transition()
      .delay(shiftDelay)
      .duration(spanShiftDuration)
      .ease(d3.easeCubicInOut)
      .attr("x", populationCenterX);
    return movingCenterMark;
  }

  function populationSpanLabel() {
    return `population: SD = ${usePopulationSdScale
      ? "1"
      : formatMeasure(population.sdN)}`;
  }

  function fixedCenterSpanLabel(values) {
    return `deviations from μ: SD = ${formatMeasure(
      values.sampleRmsDeviationFromPopulationMean
    )}`;
  }

  function fittedCenterSpanLabel(values) {
    return `deviations from M: SD = ${formatMeasure(values.sampleSdN)}`;
  }

  function simpleAriaLabel(values, centerSampleSpanOnPopulation) {
    const parts = [centerOnlyAxis ? "Fixed population." : "Height population."];
    if (state.showPopulationSd) {
      parts.push(`Its standard deviation is ${speakMeasure(population.sdN)}.`);
    }
    if (state.showSample) {
      parts.push(`A sample of ${state.n} observations is shown.`);
    }
    if (state.focusSample) {
      parts.push("Unselected population observations are dimmed.");
    }
    if (state.showSampleSd) {
      parts.push(
        `The sample SD around fitted M is ${speakMeasure(values.sampleSdN)}; its span is ${
          centerSampleSpanOnPopulation ? "aligned at mu for comparison" : "centered on M"
        }.`
      );
    }
    if (state.showFixedCenterRms) {
      parts.push(
        `The same sample's SD calculated around fixed mu is ${speakMeasure(
          values.sampleRmsDeviationFromPopulationMean
        )}.`
      );
    }
    if (state.showSampleSd && state.showFixedCenterRms && centerSampleSpanOnPopulation) {
      parts.push("The M-based span is no wider than the mu-based span.");
    }
    return parts.join(" ");
  }

  function updateTrackingLayout(animate) {
    if (!trackingEnabled) return;

    const sampleViewTop = Math.max(0, sampleY - Math.max(26, dotDiameter * 1.28));
    const sampleViewBottom = sampleAxisLabelY + 6;
    const meanViewBottom = sampleViewBottom;
    const fullViewBottom = state.showMeans ? meanViewBottom : dynamicHeight;
    const focused = state.sourceView === "sample";
    const viewTop = focused ? sampleViewTop : 0;
    const viewBottom = focused ? sampleViewBottom : fullViewBottom;
    const viewHeight = Math.max(1, viewBottom - viewTop);
    const trackerGap = 12;
    const trackerFootprint = biasTracker ? biasTracker.getFootprint() : 362;
    const maximumFocusedHeight = sampleViewBottom - sampleViewTop;
    const fullRequirement = focused ? maximumFocusedHeight : fullViewBottom;
    const stageHeight = Math.ceil(Math.max(
      fullRequirement,
      maximumFocusedHeight + trackerGap + trackerFootprint
    ));

    let movingWrap = overviewWrap.interrupt();
    let movingSvg = svg.interrupt();
    if (animate && !heightVariabilityReducedMotion()) {
      movingWrap = movingWrap.transition().duration(680).ease(d3.easeCubicInOut);
      movingSvg = movingSvg.transition().duration(680).ease(d3.easeCubicInOut);
    }
    movingWrap.style("height", `${viewHeight}px`);
    movingSvg.attr("viewBox", [0, viewTop, renderWidth, viewHeight]);

    let movingChartWrap = chartWrap.interrupt();
    if (animate && !heightVariabilityReducedMotion()) {
      movingChartWrap = movingChartWrap.transition().duration(680).ease(d3.easeCubicInOut);
    }
    movingChartWrap
      .style("height", `${stageHeight}px`)
      .attr("data-source-view", state.sourceView);
    if (biasTracker) biasTracker.setTop(viewHeight + trackerGap, animate);
  }

  let previousOverviewSampleKey = null;
  let previousShowFixedCenterRms = false;
  let previousShowSampleSd = false;

  function updateChart(values, animate, animateSample = animate, recenterSampleSpan = false) {
    const overviewSampleKey = `${state.seed}:${state.drawIndex}:${state.n}`;
    const sampleChanged = previousOverviewSampleKey !== null &&
      previousOverviewSampleKey !== overviewSampleKey;
    const spanMotionEnabled = animate && !trackingEnabled && !heightVariabilityReducedMotion();
    const growFixedCenterSpan = spanMotionEnabled && state.showFixedCenterRms &&
      (sampleChanged || !previousShowFixedCenterRms);
    const growSampleSpan = spanMotionEnabled && state.showSampleSd &&
      (sampleChanged || !previousShowSampleSd);
    const spanGrowthDelay = sampleChanged && animateSample ? 680 : 0;
    const desiredTickCount = overviewCompact ? 5 : 10;
    const tickStep = Math.max(
      population.binWidth,
      d3.tickStep(xDomain[0], xDomain[1], desiredTickCount)
    );
    const tickStart = Math.ceil(population.min / tickStep) * tickStep;
    const tickValues = d3.range(tickStart, population.max + tickStep / 2, tickStep);

    xAxis.attr("transform", `translate(0, ${axisY})`);
    xAxis.call(d3.axisBottom(x)
      .tickValues(centerOnlyAxis ? [population.mean] : tickValues)
      .tickFormat(centerOnlyAxis ? (() => "μ") : ((value) => f0(value))));
    xAxis.selectAll("text").attr("dy", "1em");
    axisLabel
      .attr("x", (margin.left + renderWidth - margin.right) / 2)
      .attr("y", axisLabelY);

    if (sampleXAxis && sampleXAxisLabel) {
      sampleXAxis.attr("transform", `translate(0, ${sampleAxisY})`);
      sampleXAxis.call(d3.axisBottom(x)
        .tickValues(tickValues)
        .tickFormat((value) => f0(value)));
      sampleXAxis.selectAll("text").attr("dy", "1em");
      sampleXAxisLabel
        .attr("x", (margin.left + renderWidth - margin.right) / 2)
        .attr("y", sampleAxisLabelY);
    }

    function sampleDotX(dot) {
      const overflowColumn = Math.floor(dot.sampleRow / sampleStackLanes);
      if (!overflowColumn) return x(dot.value);
      const direction = overflowColumn % 2 ? -1 : 1;
      const magnitude = Math.ceil(overflowColumn / 2);
      const jitterStep = Math.min(dotRadius * 0.55, xUnitWidth * 0.18);
      return x(dot.value) + direction * magnitude * jitterStep;
    }

    const sampleDotY = (dot) => sampleY + (dot.sampleRow % sampleStackLanes) * sampleDotStep;

    const selectedIds = new Set(state.showSample ? values.sampleDots.map((dot) => dot.id) : []);
    populationLayer.selectAll("circle")
      .data(population.dots, (dot) => dot.id)
      .join("circle")
        .attr("class", "hv-population-dot bc-graph-point")
        .classed("is-sampled", (dot) => selectedIds.has(dot.id))
        .attr("r", dotRadius)
        .style("fill", (dot) => state.focusSample && !selectedIds.has(dot.id)
          ? "var(--hv-muted-color)"
          : dot.color)
        .attr("opacity", (dot) => state.focusSample && !selectedIds.has(dot.id) ? 0.24 : 1)
        .attr("cx", (dot) => x(dot.binCenter))
        .attr("cy", (dot) => populationBaseY - dot.row * dotStep);
    populationLayer.selectAll(".hv-population-dot.is-sampled").raise();

    setLineWithCaps(
      popLine,
      x(population.mean - population.sdN),
      x(population.mean + population.sdN),
      comparisonFirstY,
      16
    );
    popLabel
      .attr("x", x(population.mean))
      .attr("y", comparisonFirstY - 8)
      .text(populationSpanLabel());
    populationCenterMark
      .attr("transform", `translate(${x(population.mean)}, ${comparisonFirstY})`);

    const fixedCenterX1 = x(population.mean - values.sampleRmsDeviationFromPopulationMean);
    const fixedCenterX2 = x(population.mean + values.sampleRmsDeviationFromPopulationMean);
    if (growFixedCenterSpan) {
      growLineWithCaps(
        fixedCenterComparisonLine,
        x(population.mean),
        fixedCenterX1,
        fixedCenterX2,
        simpleComparisonLastY,
        14,
        spanGrowthDelay
      );
    } else {
      setLineWithCaps(
        fixedCenterComparisonLine,
        fixedCenterX1,
        fixedCenterX2,
        simpleComparisonLastY,
        14,
        animate
      );
    }
    fixedCenterComparisonLabel
      .attr("x", x(population.mean))
      .attr("y", simpleComparisonLastY - 8)
      .text(fixedCenterSpanLabel(values));
    fixedCenterMark
      .attr("transform", `translate(${x(population.mean)}, ${simpleComparisonLastY})`);

    const animateFall = animateSample && !heightVariabilityReducedMotion();
    samplePoints.selectAll("circle").interrupt().remove();
    samplePoints.selectAll("circle")
      .data(values.sampleDots, (dot) => dot.sampleIndex)
      .enter()
      .append("circle")
        .attr("class", "hv-sample-dot bc-graph-point")
        .attr("r", dotRadius + 0.6)
        .style("fill", (dot) => dot.color)
        .attr("cx", (dot) => sampleDotX(dot))
        .attr("cy", (dot) => animateFall
          ? populationBaseY - dot.row * dotStep
          : sampleDotY(dot))
        .attr("opacity", 1)
        .call((selection) => {
          if (!animateFall) return;
          selection.transition()
            .duration(620)
            .delay((dot) => 35 + dot.sampleIndex * 24)
            .ease(d3.easeBounceOut)
            .attr("cx", (dot) => sampleDotX(dot))
            .attr("cy", (dot) => sampleDotY(dot));
        });

    const centerSampleSpanOnPopulation = state.sampleSpanCenter === "population";
    const sequenceSampleCenter = Boolean(
      recenterSampleSpan &&
      animate &&
      !trackingEnabled &&
      !heightVariabilityReducedMotion() &&
      centerSampleSpanOnPopulation
    );
    let sampleCenterTransition = null;
    if (sequenceSampleCenter) {
      // Each fresh sample gets a fresh fitted center. Establish that state first,
      // grow the newly calculated span there, then move that unchanged width to
      // the fixed population mean. The delay lets the new sample arrive first.
      if (growSampleSpan) {
        sampleCenterTransition = growThenShiftSampleSpan(
          values,
          fittedCenterSpanLabel(values),
          spanGrowthDelay
        );
      } else {
        positionSampleSpan(
          values.sampleMean,
          values,
          fittedCenterSpanLabel(values),
          false
        );
        sampleCenterTransition = positionSampleSpan(
          population.mean,
          values,
          fittedCenterSpanLabel(values),
          true,
          animateSample ? 920 : 260
        );
      }
    } else {
      const sampleSpanCenter = centerSampleSpanOnPopulation ? population.mean : values.sampleMean;
      positionSampleSpan(
        sampleSpanCenter,
        values,
        fittedCenterSpanLabel(values),
        animate,
        growSampleSpan ? spanGrowthDelay : 0,
        growSampleSpan
      );
    }

    const correctedVariance = values.sampleVarianceN * state.n / (state.n - 1);
    const varianceComparisons = [
      {
        target: populationVarianceComparison,
        ratio: 1,
        y: comparisonFirstY,
        label: "population variance (reference)"
      },
      {
        target: biasedVarianceComparison,
        ratio: values.sampleVarianceN / population.varianceN,
        y: comparisonFirstY + comparisonRowGap,
        label: "sample variance (divide by n)"
      },
      {
        target: correctedVarianceComparison,
        ratio: correctedVariance / population.varianceN,
        y: comparisonLastY,
        label: "corrected variance (divide by n − 1)"
      }
    ];
    varianceComparisons.forEach((item) => {
      const spread = varianceReferenceWidth * Math.max(0, item.ratio) / 2;
      setLineWithCaps(
        item.target.line,
        x(population.mean - spread),
        x(population.mean + spread),
        item.y,
        13
      );
      item.target.label
        .attr("x", x(population.mean))
        .attr("y", item.y - 8)
        .text(item.label);
    });

    populationMeanLine
      .attr("x1", x(population.mean))
      .attr("x2", x(population.mean))
      .attr("y1", stackTop - 10)
      .attr("y2", trackingEnabled ? sampleAreaBottom : populationBaseY + dotRadius);
    populationMeanLabel
      .attr("x", x(population.mean))
      .attr("y", stackTop - 16)
      .text(`population μ = ${d3.format(".2f")(population.mean)}`);
    sampleMeanLine
      .attr("x1", x(values.sampleMean))
      .attr("x2", x(values.sampleMean))
      .attr("y1", sampleY - 8)
      .attr("y2", sampleAreaBottom);
    sampleMeanLabel
      .attr("x", x(values.sampleMean))
      .attr("y", sampleY - 14)
      .text(`sample M = ${d3.format(".2f")(values.sampleMean)}`);
    if (sampleMeanAxisMark) {
      sampleMeanAxisMark
        .attr("x", x(values.sampleMean) - sampleMeanAxisSize / 2)
        .attr("y", sampleAxisY - sampleMeanAxisSize);
    }

    if (window.interactiveFigure && window.interactiveFigure.setRevealVisible) {
      window.interactiveFigure.setRevealVisible(popSdLayer, !trackingEnabled && state.showPopulationSd, { root: rootNode, animate });
      window.interactiveFigure.setRevealVisible(sampleLayer, state.showSample, { root: rootNode, animate });
      window.interactiveFigure.setRevealVisible(
        fixedCenterLayer,
        !trackingEnabled && state.showFixedCenterRms,
        { root: rootNode, animate: animate && !growFixedCenterSpan }
      );
      window.interactiveFigure.setRevealVisible(
        biasedLayer,
        !trackingEnabled && state.showSampleSd,
        { root: rootNode, animate: animate && !growSampleSpan }
      );
      window.interactiveFigure.setRevealVisible(
        varianceComparisonLayer,
        trackingEnabled && !state.showMeans,
        { root: rootNode, animate }
      );
      window.interactiveFigure.setRevealVisible(meanLayer, state.showMeans, { root: rootNode, animate });
      if (sampleMeanAxisMark) {
        window.interactiveFigure.setRevealVisible(
          sampleMeanAxisMark,
          state.showMeans,
          { root: rootNode, animate }
        );
      }
      if (sampleXAxis && sampleXAxisLabel) {
        window.interactiveFigure.setRevealVisible(
          [sampleXAxis.node(), sampleXAxisLabel.node()],
          true,
          { root: rootNode, animate }
        );
      }
    }

    if (trackingEnabled) {
      updateTrackingLayout(animate);
      if (state.sourceView === "sample") {
        svg.attr("aria-label", state.showMeans
          ? "Current sample of heights with markers comparing its mean to the fixed population mean"
          : "Current sample of heights used to calculate the two variance estimates shown in the trackers");
      } else {
        svg.attr("aria-label", state.showMeans
          ? "Fixed population and selected sample of heights with markers comparing their means"
          : "Fixed population and selected sample of heights with variance estimates compared with the population variance");
      }
    } else if (sequenceSampleCenter && sampleCenterTransition) {
      svg.attr(
        "aria-label",
        `${simpleAriaLabel(values, false)} The fitted span begins centered on M.`
      );
      sampleCenterTransition
        .on("start.aria", () => svg.attr(
          "aria-label",
          "The unchanged span calculated around M is shifting to the fixed population mean so it can be compared directly with the wider span calculated around mu"
        ))
        .on("end.aria", () => svg.attr(
          "aria-label",
          simpleAriaLabel(values, true)
        ));
    } else {
      svg.attr("aria-label", simpleAriaLabel(values, centerSampleSpanOnPopulation));
    }

    previousOverviewSampleKey = overviewSampleKey;
    previousShowFixedCenterRms = state.showFixedCenterRms;
    previousShowSampleSd = state.showSampleSd;
  }

  function applyOverviewResponsiveLayout(layout) {
    const compact = Boolean(layout.compact);
    const availableWidth = Math.max(240, Math.min(
      width,
      heightVariabilityFiniteNumber(layout.width, width)
    ));
    const nextWidth = trackingEnabled && !compact
      ? Math.min(availableWidth * overviewScale, overviewMaxWidth)
      : availableWidth;

    if (trackingEnabled) {
      overviewWrap
        .style("width", compact ? "100%" : `${overviewScale * 100}%`)
        .style("max-width", compact || !Number.isFinite(overviewMaxWidth)
          ? null
          : `${overviewMaxWidth}px`);
    }

    setOverviewGeometry(nextWidth, compact);
    svg.attr("viewBox", [0, 0, renderWidth, height]);
    update(false, { animate: false, fall: false });
  }

  function update(notify, options = {}) {
    readState();
    syncControls();
    nControl.value.text(String(state.n));

    const shouldShowMeanHeader = trackingEnabled;
    if (geometryShowsMeanHeader !== shouldShowMeanHeader) {
      setOverviewGeometry(renderWidth, overviewCompact);
      svg.attr("viewBox", [0, 0, renderWidth, height]);
    }

    const values = compute();
    setValue(values);
    updateChart(
      values,
      options.animate !== false,
      options.animate !== false && options.fall !== false,
      options.recenterSampleSpan === true
    );
    if (biasTracker) biasTracker.update(options.animate !== false);

    if (notify) notifyValueChange();
  }

  function setNumeric(value, callback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return false;
    callback(number);
    return true;
  }

  function applyTutorialAction(action, context) {
    let changed = false;
    let sampleTarget = null;
    let sampleInterval = null;
    let recenterSampleSpanOverride = null;
    const animate = !action || action.animate !== false;
    let fall = trackingEnabled ? false : animate;
    const previousSampleKey = `${state.seed}:${state.drawIndex}:${state.n}`;

    Object.entries(action || {}).forEach(([rawKey, value]) => {
      const key = heightVariabilityActionKey(rawKey);
      switch (key) {
        case "animate":
          break;
        case "fall":
        case "animate-fall":
          fall = heightVariabilityBoolean(value, fall);
          break;
        case "recenter-sample-span":
        case "recenter-span":
          recenterSampleSpanOverride = heightVariabilityBoolean(value, true);
          break;
        case "seed":
          state.seed = String(value);
          changed = true;
          break;
        case "draw":
        case "draw-index":
        case "sample":
        case "sample-number":
          changed = setNumeric(value, (number) => {
            state.drawIndex = Math.max(1, Math.round(number));
          }) || changed;
          break;
        case "samples":
        case "sample-count":
          changed = setNumeric(value, (number) => {
            const limit = biasTracker ? biasTracker.maxSamples : Number.MAX_SAFE_INTEGER;
            const target = Math.max(1, Math.min(limit, Math.round(number)));
            if (biasTracker && animate && !heightVariabilityReducedMotion()) {
              sampleTarget = target;
            } else {
              if (biasTracker) biasTracker.cancelAnimation();
              state.drawIndex = target;
              if (biasTracker) biasTracker.resetChartDomain();
            }
          }) || changed;
          break;
        case "add-samples":
          changed = setNumeric(value, (number) => {
            const limit = biasTracker ? biasTracker.maxSamples : Number.MAX_SAFE_INTEGER;
            const target = Math.max(1, Math.min(limit, state.drawIndex + Math.round(number)));
            if (biasTracker && animate && !heightVariabilityReducedMotion()) {
              sampleTarget = target;
            } else {
              if (biasTracker) biasTracker.cancelAnimation();
              state.drawIndex = target;
              if (biasTracker) biasTracker.resetChartDomain();
            }
          }) || changed;
          break;
        case "sample-interval":
        case "sample-interval-ms":
          setNumeric(value, (number) => {
            sampleInterval = Math.max(80, Math.min(2000, number));
          });
          break;
        case "new-sample":
          if (heightVariabilityBoolean(value, true)) {
            state.drawIndex += 1;
            changed = true;
          }
          break;
        case "reset":
        case "replay":
          if (heightVariabilityBoolean(value, true)) {
            state.drawIndex = 1;
            changed = true;
          }
          break;
        case "n":
        case "sample-size":
          changed = setNumeric(value, (number) => {
            state.n = Math.max(2, Math.min(maxSampleSize, Math.round(number)));
          }) || changed;
          break;
        case "estimator":
        case "track":
        case "statistic":
          if (biasTracker) {
            biasTracker.setMode(value);
            changed = true;
          }
          break;
        case "show-sample":
        case "sample-observations":
        case "points":
          state.showSample = heightVariabilityBoolean(value, state.showSample);
          changed = true;
          break;
        case "focus-sample":
        case "sample-focus":
        case "dim-population":
          state.focusSample = heightVariabilityBoolean(value, state.focusSample);
          changed = true;
          break;
        case "show-population-sd":
        case "population-sd":
          state.showPopulationSd = heightVariabilityBoolean(value, state.showPopulationSd);
          changed = true;
          break;
        case "show-sample-sd":
        case "sample-sd":
        case "show-biased-sd":
        case "biased-sd":
          state.showSampleSd = heightVariabilityBoolean(value, state.showSampleSd);
          changed = true;
          break;
        case "show-fixed-center-rms":
        case "fixed-center-rms":
        case "show-mu-rms":
        case "mu-rms":
          state.showFixedCenterRms = heightVariabilityBoolean(value, state.showFixedCenterRms);
          changed = true;
          break;
        case "sample-span-center":
        case "span-center":
          state.sampleSpanCenter = String(value).trim().toLowerCase() === "population"
            ? "population"
            : "sample";
          changed = true;
          break;
        case "show-summary":
        case "summary":
        case "repeated-samples":
          state.showSummary = heightVariabilityBoolean(value, state.showSummary);
          changed = true;
          break;
        case "show-overview":
        case "overview":
          state.sourceView = heightVariabilityBoolean(value, state.sourceView === "full")
            ? "full"
            : "sample";
          changed = true;
          break;
        case "source-view":
        case "source-focus":
        case "focus":
          state.sourceView = ["sample", "samples", "compact"].includes(
            String(value).trim().toLowerCase()
          ) ? "sample" : "full";
          changed = true;
          break;
        case "show-error-tracker":
        case "error-tracker":
        case "individual-tracker":
          state.showErrorTracker = heightVariabilityBoolean(value, state.showErrorTracker);
          changed = true;
          break;
        case "show-average-tracker":
        case "average-tracker":
        case "cumulative-tracker":
          state.showAverageTracker = heightVariabilityBoolean(value, state.showAverageTracker);
          changed = true;
          break;
        case "show-expected-bias":
        case "expected-bias":
          state.showExpectedBias = heightVariabilityBoolean(value, state.showExpectedBias);
          changed = true;
          break;
        case "controls":
        case "controls-open":
          if (context && typeof context.setControlsOpen === "function") {
            context.setControlsOpen(heightVariabilityBoolean(value, true), animate);
          }
          break;
        default:
          break;
      }
    });

    if (sampleTarget !== null && biasTracker) {
      syncControls();
      if (sampleTarget <= state.drawIndex) {
        biasTracker.cancelAnimation();
        state.drawIndex = sampleTarget;
        biasTracker.resetChartDomain();
        update(true, { animate, fall: false });
      } else {
        if (changed) update(true, { animate, fall: false });
        biasTracker.animateTo(sampleTarget, { intervalMs: sampleInterval });
      }
    } else if (changed) {
      syncControls();
      const nextSampleKey = `${state.seed}:${state.drawIndex}:${state.n}`;
      update(true, {
        animate,
        fall,
        recenterSampleSpan: state.sampleSpanCenter === "population" &&
          (recenterSampleSpanOverride === null
            ? previousSampleKey !== nextSampleKey
            : recenterSampleSpanOverride)
      });
    }
  }

  let biasTracker = null;
  if (trackingEnabled) {
    biasTracker = heightVariabilityAttachBiasTracker({
      opts,
      root,
      rootNode,
      chartWrap,
      buttonRow,
      addButton,
      group,
      population,
      state,
      syncControls,
      applyOverviewResponsiveLayout,
      requestUpdate(animate, notify = true) {
        update(notify, { animate });
      }
    });
  }

  [
    seedInput,
    nControl.input,
    showSampleInput,
    showPopulationSdInput,
    showSampleSdInput,
    showFixedCenterRmsInput
  ].forEach((input) => input.addEventListener("input", (event) => {
    event.stopPropagation();
    if (biasTracker) biasTracker.cancelAnimation();
    if (input === seedInput || (trackingEnabled && input === nControl.input)) {
      state.drawIndex = 1;
      if (biasTracker) biasTracker.resetChartDomain();
    }
    update(true, {
      animate: true,
      recenterSampleSpan: !trackingEnabled &&
        state.sampleSpanCenter === "population" &&
        (input === seedInput || input === nControl.input)
    });
  }));

  newSampleButton.addEventListener("click", (event) => {
    event.preventDefault();
    if (biasTracker) biasTracker.cancelAnimation();
    state.drawIndex = biasTracker
      ? Math.min(biasTracker.maxSamples, state.drawIndex + 1)
      : state.drawIndex + 1;
    update(true, {
      animate: true,
      recenterSampleSpan: !trackingEnabled && state.sampleSpanCenter === "population"
    });
  });

  replayButton.addEventListener("click", (event) => {
    event.preventDefault();
    if (biasTracker) biasTracker.cancelAnimation();
    state.drawIndex = 1;
    if (biasTracker) biasTracker.resetChartDomain();
    update(true, {
      animate: true,
      recenterSampleSpan: !trackingEnabled && state.sampleSpanCenter === "population"
    });
  });

  syncControls();
  update(false, { animate: false });

  if (window.interactiveFigure) {
    if (!trackingEnabled &&
        typeof window.interactiveFigure.observeResponsiveLayout === "function") {
      rootNode.dataset.bcLayout = overviewCompact ? "compact" : "wide";
      window.interactiveFigure.observeResponsiveLayout({
        root: rootNode,
        container: chartWrap.node(),
        compactBelow,
        minimumWidth: 240,
        maximumWidth: width,
        widthStep: 4,
        onLayout: applyOverviewResponsiveLayout
      });
    }
    window.interactiveFigure.wrap({
      root: rootNode,
      controls: controls.node(),
      label: "height variability controls",
      placement: opts.controlsPlacement || "callout",
      layout: opts.controlsLayout || "equal",
      applyAction: applyTutorialAction,
      startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
    });
  }

  return rootNode;
}

// Backward-compatible name: bias tracking is now a feature of the shared
// height-variability system, not a separate visualization implementation.
makeBiasTrackingDemo = function(opts) {
  return makeHeightVariabilityDemo(Object.assign({}, opts || {}, { tracking: true }));
}
