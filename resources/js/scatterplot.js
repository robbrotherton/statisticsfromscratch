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
  return Boolean(window.sfsReducedMotion) || Boolean(window.matchMedia &&
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

// Which side of the two means a point falls on: 1 when it is above both or
// below both (its deviations agree in sign), −1 when it is above one and below
// the other, 0 when it sits exactly on either mean.
scQuadrant = (p, stats) =>
  Math.sign((p.x - stats.meanX) * (p.y - stats.meanY))

// A point is hollowed by fading in a background-colored "hole" on top of
// its dot, so the dot itself never changes size. The dot's 1.4 px outline
// covers its outer 0.7 px, so its visible edge is at r − 0.7; the hole
// leaves a ring SC_RING_WIDTH wide inside that edge.
SC_DOT_OUTLINE = 1.4;
SC_RING_WIDTH = 2;

// The sums-of-squares panel, laid out like the ANOVA explorer's: beside the
// plot when the figure is at least SC_PANEL_BESIDE wide, otherwise under it.
SC_PANEL_BESIDE = 500;
SC_PANEL_GAP = 14;
SC_PANEL_INSET = 18;
SC_PANEL_MIN_WIDTH = 176;
// Room above the square for the panel's title and the total's label, and
// below it for the two parts' labels.
SC_PANEL_HEAD = 58;
SC_PANEL_ROW = 20;
// Under the plot, on a phone, the sums go without the panel's box and title,
// with the parts named beside the square. The plot is shorter there, and the
// square, on the plot's area scale, shrinks with it, so the whole tutorial
// fits on the screen.
SC_COMPACT_ASPECT = 1.35;
scHoleRadius = (r) => r - SC_DOT_OUTLINE / 2 - SC_RING_WIDTH

// Whether a point drawn at (px, py) is on opposite sides of mean lines drawn
// at (mx, my), in screen coordinates (where y grows downward).
scOppositeOnScreen = (px, py, mx, my) => (px - mx) * (my - py) < 0

scParseTranslate = (transform) => {
  const match = /translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)\s*\)/.exec(transform || "");
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

scQuadrantCounts = (points) => {
  const stats = scStats(points);
  const signs = points.map((p) => scQuadrant(p, stats));
  return {
    same: signs.filter((s) => s > 0).length,
    opposite: signs.filter((s) => s < 0).length,
    onMean: signs.filter((s) => s === 0).length
  };
}

scSumSquaredResiduals = (points, slope, intercept) =>
  d3.sum(points, (p) => {
    const residual = p.y - (slope * p.x + intercept);
    return residual * residual;
  })

// Least squares with a second predictor, z, solved from the sums of squares
// and products of the deviations (the normal equations). Also returns what
// each predictor accounts for on its own, which the partition of the joint
// regression sum of squares is built from. Null without a z for every point.
scMultipleFit = (points) => {
  if (!points.length || !points.every((p) => Number.isFinite(p.z))) return null;
  const mean = (key) => d3.mean(points, (p) => p[key]);
  const m = { x: mean("x"), y: mean("y"), z: mean("z") };
  const s = (a, b) => d3.sum(points, (p) => (p[a] - m[a]) * (p[b] - m[b]));
  const sxx = s("x", "x"), szz = s("z", "z"), sxz = s("x", "z");
  const sxy = s("x", "y"), szy = s("z", "y");
  const det = sxx * szz - sxz * sxz;
  if (!(det > 0)) return null;
  const slopeX = (szz * sxy - sxz * szy) / det;
  const slopeZ = (sxx * szy - sxz * sxy) / det;
  return {
    slopeX,
    slopeZ,
    intercept: m.y - slopeX * m.x - slopeZ * m.z,
    means: m,
    // How much x changes per unit of z, for adjusting each x to the mean z.
    slopeXOnZ: sxz / szz,
    ssRegression: slopeX * sxy + slopeZ * szy,
    ssRegressionX: sxy * sxy / sxx,
    ssRegressionZ: szy * szy / szz
  };
}

// --- Responsive geometry ------------------------------------------------------
//
// The plot is redrawn at the width it actually occupies, so one SVG unit is
// one CSS pixel on every screen. Scaling a fixed viewBox instead (as this file
// used to) shrinks the dots, the text and the drag targets along with the box:
// a 640-unit plot in a 340 px phone column drew its 11-unit dots under 6 px
// across. graph-core redraws for the same reason (see sfsGraphObserveWidth).
//
// Margins that hold tick or axis text keep their authored size, because the
// text does. Margins that hold nothing shrink with the figure, down to a small
// gutter, so a narrow plot isn't mostly margin.
scPlotGeometry = ({ width, authoredWidth, authoredHeight, margin, textLeft, textBottom, textRight, aspect }) => {
  const k = Math.min(1, width / authoredWidth);
  const gutter = (value) => Math.max(Math.min(value, 12), Math.round(value * k));
  const fitted = {
    top: gutter(margin.top),
    right: textRight ? margin.right : gutter(margin.right),
    bottom: textBottom ? margin.bottom : gutter(margin.bottom),
    left: textLeft ? margin.left : gutter(margin.left)
  };
  const innerWidth = Math.max(1, width - fitted.left - fitted.right);
  const height = authoredHeight
    ? Math.round(authoredHeight * (width / authoredWidth))
    : Math.round(fitted.top + fitted.bottom + innerWidth / aspect);
  const innerHeight = Math.max(1, height - fitted.top - fitted.bottom);
  return {
    width, height, margin: fitted, innerWidth, innerHeight,
    plotRight: width - fitted.right,
    plotBottom: height - fitted.bottom
  };
}

// Dots are the full size wherever the plot has room for them, and ease down
// only in small-multiple panels, where full-size dots would smother a cloud of
// 60 or 100 points. The floor keeps them visible in the smallest panel.
scPointRadius = (plotSide, base = 5.5) =>
  Math.max(Math.min(4, base), Math.min(base, plotSide / 31))

// Roughly one tick label per 56 px across and per 40 px up, never more than
// the six a full-width plot shows.
scTickCount = (length, spacing) =>
  Math.max(2, Math.min(6, Math.floor(length / spacing)))

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
      --sc-positive-color: var(--graph-series-3, #009e73);
      --sc-negative-color: var(--graph-series-4, #d55e00);
      /* A second predictor's levels: a ramp of the points' blue, from a pale
         tint of it for the lowest value to a deep shade for the highest. */
      --sc-z-low: color-mix(in oklab, var(--sc-point-color) 60%, var(--sfs-bg, #fff));
      --sc-z-high: color-mix(in oklab, var(--sc-point-color) 70%, var(--sfs-text, #222));
    }

    .scatterplot .sc-dot {
      fill: var(--sc-point-color);
      stroke: var(--sfs-bg, #fff);
      stroke-width: ${SC_DOT_OUTLINE};
    }

    /* Quadrant mode: a point on opposite sides of the two means turns
       hollow as its hole fades in (see scHoleRadius). */
    .scatterplot .sc-hole {
      fill: var(--sfs-bg, #fff);
      opacity: 0;
      pointer-events: none;
      transition: opacity 240ms ease;
    }

    .scatterplot .sc-point.is-opposite .sc-hole {
      opacity: 1;
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

    .scatterplot .sc-family-line {
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }

    .scatterplot .sc-family-label {
      font-family: var(--bs-body-font-family, system-ui, sans-serif);
      font-size: var(--sfs-figure-small-size, 0.75rem);
      font-weight: 650;
      paint-order: stroke;
      stroke: var(--sfs-bg, #fff);
      stroke-width: 3px;
      stroke-linejoin: round;
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

    /* A product of deviations is a rectangle from the point to the crosshair.
       Sign is carried by hue and by the dashed outline of negative products. */
    .scatterplot .sc-product {
      fill: var(--sc-positive-color);
      fill-opacity: 0.2;
      stroke: var(--sc-positive-color);
      stroke-width: 1.4;
      vector-effect: non-scaling-stroke;
    }

    .scatterplot .sc-product.is-negative {
      fill: var(--sc-negative-color);
      stroke: var(--sc-negative-color);
      stroke-dasharray: 5 3;
    }

    .scatterplot .sc-square-label,
    .scatterplot .sc-product-label {
      fill: var(--sc-positive-color);
      font-family: var(--bs-body-font-family, system-ui, sans-serif);
      font-size: 0.85rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      paint-order: stroke;
      stroke: var(--sfs-bg, #fff);
      stroke-width: 3px;
      user-select: none;
    }

    .scatterplot .sc-square-label { fill: var(--sc-residual-color); }

    .scatterplot .sc-product-label.is-negative {
      fill: var(--sc-negative-color);
    }

    .scatterplot .sc-deviation {
      stroke: var(--graph-text-color, currentColor);
      stroke-width: 1.8;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
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

    .scatterplot .sc-mean-label {
      paint-order: stroke;
      stroke: var(--sfs-bg, #fff);
      stroke-width: 3px;
      stroke-linejoin: round;
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
    .scatterplot.sc-no-anim .sc-ring,
    .scatterplot.sc-no-anim .sc-hole {
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

    .scatterplot .sc-guide-label,
    .scatterplot .sc-rise-run-label {
      font-family: var(--bs-body-font-family, system-ui, sans-serif);
      font-size: 0.85rem;
      font-variant-numeric: tabular-nums;
    }

    .scatterplot .sc-best-line {
      stroke: var(--sfs-text, currentColor);
      stroke-width: 1.5;
      stroke-dasharray: 5 4;
      opacity: 0.55;
    }

    .scatterplot .sc-rise-run-line {
      stroke: var(--sfs-text, currentColor);
      stroke-width: 2;
      stroke-linecap: round;
    }

    .scatterplot .sc-rise-run-label {
      fill: var(--sfs-text, currentColor);
      font-weight: 700;
      paint-order: stroke;
      stroke: var(--sfs-bg, #fff);
      stroke-width: 4px;
      stroke-linejoin: round;
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

    .scatterplot .sc-ss-panel {
      fill: color-mix(in srgb, var(--sfs-control-bg, #f1f3f5) 62%, transparent);
      stroke: var(--sfs-border, #c8cdd2);
    }

    .scatterplot .sc-ss-panel-title {
      fill: currentColor;
      font-family: var(--bs-body-font-family, system-ui, sans-serif);
      font-size: var(--sfs-figure-title-size, 1rem);
      font-weight: 750;
    }

    @media (prefers-reduced-motion: reduce) {
      .scatterplot .sc-layer,
      .scatterplot .sc-ring,
      .scatterplot .sc-hole {
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
  const authoredWidth = scPositiveNumber(opts.width, 640);
  const basePointRadius = scPositiveNumber(opts.pointRadius, 5.5);
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
  // A second predictor for multiple regression: `z` gives one value per point,
  // `zName` names it in the figure and `zUnit` follows each level's value.
  // `xName` names the first predictor where its axis label is too long.
  const hasZ = Array.isArray(opts.z) && opts.z.length === initialPoints.length &&
    opts.z.every((value) => Number.isFinite(Number(value)));
  if (hasZ) initialPoints.forEach((point, i) => { point.z = Number(opts.z[i]); });
  const xName = opts.xName || xLabel;
  const zName = opts.zName || "Z";
  const zUnit = opts.zUnit ? "\u2009" + opts.zUnit : "";

  // Line mode: "fit" recomputes least squares from the current points,
  // "mean" is the null model (slope 0, intercept M_Y, so SS_residual = SS_Y),
  // "custom" holds whatever slope/intercept were supplied, "multiple" adds the
  // second predictor, z, and "adjusted" is its slope for x through the means.
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
    // Both predictors: one line for each value of z, all with the same slope.
    // "adjusted" is that slope alone, through the means: the line at the mean
    // of z, fitted to x adjusted to the mean of z.
    if (["multiple", "both"].includes(key) && hasZ) {
      return { mode: "multiple" };
    }
    if (["adjusted", "partial"].includes(key) && hasZ) {
      return { mode: "adjusted" };
    }
    return null;
  }

  // A read-off guide (up from a value of X to the line, then across to Y),
  // given as an X value or { x }.
  function normalizeGuide(value) {
    const raw = value !== null && typeof value === "object" ? value.x : value;
    if (raw === undefined || raw === null || raw === false || raw === "") return null;
    const guideX = Number(raw);
    return Number.isFinite(guideX) ? { x: guideX } : null;
  }

  // Rise over run: a step along the line from one value of X to another.
  function normalizeRiseRun(value) {
    if (!value || typeof value !== "object") return null;
    const from = Number(value.from);
    const to = Number(value.to);
    return Number.isFinite(from) && Number.isFinite(to) && from !== to ? { from, to } : null;
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
  const layerNames = ["points", "line", "residuals", "squares", "ellipse", "means", "deviations", "products", "guide", "rise-run"];

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
        if (["mean-deviations", "deviation-lines"].includes(key)) return "deviations";
        if (["product", "products", "rectangles", "sp"].includes(key)) return "products";
        if (["guide", "guides", "read-off"].includes(key)) return "guide";
        if (["rise-run", "rise", "run", "slope-step"].includes(key)) return "rise-run";
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
    squareMode: ["x", "y"].includes(opts.squareMode) ? opts.squareMode : "residual",
    squareLabels: scBoolean(opts.squareLabels, false),
    showEllipse: scBoolean(opts.showEllipse ?? opts.ellipse, false),
    showMeans: scBoolean(opts.showMeans ?? opts.means, false),
    showQuadrants: scBoolean(opts.showQuadrants ?? opts.quadrants, false),
    showDeviations: scBoolean(opts.showDeviations ?? opts.deviations, false),
    showProducts: scBoolean(opts.showProducts ?? opts.products, false),
    productLabels: scBoolean(opts.productLabels, false),
    showSP: scBoolean(opts.showSP ?? opts.spLabel, false),
    showR: scBoolean(opts.showR ?? opts.rLabel, false),
    collectSS: null,
    colorByZ: scBoolean(opts.colorByZ, false),
    // Indices of the students whose residuals and squares are showing, or
    // null for everyone's.
    focus: null,
    // Draw each point's x adjusted to the mean of z, as dashed outlines.
    adjustX: false,
    // Mark the step between two neighbouring lines of the family.
    showSpacing: false,
    showSS: scBoolean(opts.showSS ?? opts.ssLabel, false),
    pointLabels: scBoolean(opts.pointLabels, false),
    emphasize: normalizeEmphasis(opts.emphasize),
    draggable: scBoolean(opts.draggable, false),
    guide: normalizeGuide(opts.guide),
    riseRun: normalizeRiseRun(opts.riseRun),
    shownSliders: Array.isArray(opts.showSliders) ? opts.showSliders.map(scKey) : [],
    axisLabels: scBoolean(opts.axisLabels, !minimal),
    ticks: normalizeTicks(opts.ticks ?? opts.tickLabels, minimal ? "none" : "numeric")
  };
  // A tutorial that collects sums of squares keeps their panel throughout, so
  // the plot doesn't move when the first square arrives.
  const ssPanel = scBoolean(opts.ssPanel, false);

  const explicitXDomain = Array.isArray(opts.xDomain) && opts.xDomain.length === 2;
  const explicitYDomain = Array.isArray(opts.yDomain) && opts.yDomain.length === 2;

  const authoredMargin = Object.assign({
    top: 24,
    // A second predictor's levels are named in the right-hand margin.
    right: hasZ ? 42 : 24,
    bottom: state.axisLabels ? 58 : (state.ticks === "none" ? 26 : 40),
    left: state.axisLabels ? 64 : (state.ticks === "none" ? 26 : 46)
  }, opts.margin || {});

  // Square plot area by default so point clouds and ellipses aren't visually
  // stretched; aspect = plot width / plot height.
  const aspect = scPositiveNumber(opts.aspect ?? opts.aspectRatio, 1);
  // The authored margins were sized for the ticks and labels the figure
  // starts with, so that is also what decides whether they may shrink.
  const marginsHoldText = state.axisLabels || state.ticks !== "none";
  // Geometry is recomputed whenever the figure is redrawn at a new width.
  // `width` and `height` are the plot's; the figure is wider when the sums
  // panel stands beside the plot, and taller when it sits underneath.
  let width, height, margin, innerWidth, plotBottom, plotRight, pointRadius;
  let figureWidth, panelBeside = false;
  const plotGeometry = (plotWidth, plotAspect = aspect) => scPlotGeometry({
    width: plotWidth,
    authoredWidth,
    authoredHeight: scPositiveNumber(opts.height, 0) || null,
    margin: authoredMargin,
    textLeft: marginsHoldText,
    textBottom: marginsHoldText,
    textRight: hasZ,
    aspect: plotAspect
  });
  // ySpan is the height of the y domain, which sets the collected square's size.
  function setGeometry(nextWidth, ySpan) {
    figureWidth = nextWidth;
    panelBeside = ssPanel && nextWidth >= SC_PANEL_BESIDE;
    let geometry = plotGeometry(nextWidth, ssPanel ? SC_COMPACT_ASPECT : aspect);
    if (panelBeside) {
      // The square shares the plot's area scale, so the panel's width depends
      // on the plot's, and the plot takes whatever the panel leaves.
      const meanY = d3.mean(state.points, p => p.y);
      const share = Math.sqrt(d3.sum(state.points, p => (p.y - meanY) ** 2)) / ySpan;
      let plotWidth = nextWidth * 0.6;
      for (let i = 0; i < 6; i++) {
        geometry = plotGeometry(plotWidth);
        const panelWidth = Math.max(SC_PANEL_MIN_WIDTH,
          Math.ceil(share * geometry.innerHeight + 2 * SC_PANEL_INSET));
        plotWidth = Math.round(nextWidth - SC_PANEL_GAP - panelWidth);
      }
      geometry = plotGeometry(plotWidth);
    }
    ({ width, height, margin, innerWidth, plotBottom, plotRight } = geometry);
    pointRadius = scPointRadius(
      Math.min(geometry.innerWidth, geometry.innerHeight), basePointRadius);
  }
  {
    const span = d3.scaleLinear()
      .domain(autoDomain((p) => p.y, explicitYDomain, opts.yDomain)).nice().domain();
    setGeometry(authoredWidth, Math.abs(span[1] - span[0]));
  }

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

  // Sliders beneath the plot, in the same strip as the power and confidence
  // interval figures, which tutorial steps reveal with `show-sliders`.
  // Each is { key: "guide" | "slope" | "intercept", range: [min, max, step] },
  // optionally with its own `tex` readout, in which {x}, {y}, {slope} and
  // {intercept} stand for the current values, and `label` and `color`.
  const sliderDefaults = {
    guide: { label: xLabel, color: sfsReadGuides.COLOR, tex: "X = {x}" },
    slope: { label: "Slope (b)", color: "var(--sc-line-color)", tex: "b = {slope}", readoutWidth: "4.6rem" },
    intercept: { label: "Intercept (a)", color: "var(--graph-series-2, #e69f00)", tex: "a = {intercept}", readoutWidth: "4.6rem" }
  };
  const sliderSpecs = (Array.isArray(opts.sliders) ? opts.sliders : [])
    .map((spec) => {
      const key = scKey(spec && spec.key);
      if (!sliderDefaults[key] || !Array.isArray(spec.range) || spec.range.length !== 3) return null;
      return Object.assign({}, sliderDefaults[key], spec, { key, range: spec.range.map(Number) });
    })
    .filter(Boolean);

  const showControls = scBoolean(opts.controls, !minimal);
  const correlationControls = scKey(opts.controlSet) === "correlation";
  let controls = null;
  let lineInputs = null;
  let showChecks = null;
  let readouts = null;

  if (showControls) {
    controls = root.append("div")
      .attr("class", "sc-controls sfs-control-grid");

    // Sliders for the line replace the drawer's own line inputs.
    const lineSliders = sliderSpecs.some((spec) => spec.key === "slope" || spec.key === "intercept");
    if (!correlationControls && !lineSliders) {
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
    }

    const showPanel = controls.append("section")
      .attr("class", "sfs-control-panel sfs-if-control-panel");
    showPanel.append("p")
      .attr("class", "sfs-control-title")
      .text("Show");
    showChecks = {};
    (correlationControls ? [
      ["showMeans", "Means"],
      ["showDeviations", "Deviations"],
      ["showProducts", "Products"],
      ["showEllipse", "Ellipse"]
    ] : [
      ["showLine", "Fit line"],
      ["showResiduals", "Residuals"],
      ["showSquares", "Squared residuals"],
      ["showEllipse", "Ellipse"],
      ["showMeans", "Means"]
    ]).forEach(([key, label]) => {
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
    readouts = correlationControls ? {
      ssX: addReadout("SS for X"),
      ssY: addReadout("SS for Y"),
      sp: addReadout("SP"),
      r: addReadout("r")
    } : {
      r: addReadout("r"),
      slope: addReadout("Slope (b)"),
      intercept: addReadout("Intercept (a)"),
      ssResidual: addReadout("SS residual")
    };
  }

  // --- Chart ----------------------------------------------------------------

  const chartWrap = root.append("div")
    .attr("class", "sc-chart-wrap sfs-chart-wrap");

  const sliders = sliderSpecs.length && window.interactiveFigure
    ? window.interactiveFigure.factorSliders(rootNode, sliderSpecs, handleSlider)
    : null;

  function handleSlider(key, value) {
    if (key === "guide") {
      state.guide = { x: value };
    } else {
      const line = effectiveLine();
      state.slope = key === "slope" ? value : line.slope;
      state.intercept = key === "intercept" ? value : line.intercept;
      state.lineMode = "custom";
      state.showLine = true;
    }
    render({ animate: false });
    notifyValueChange();
  }

  // KaTeX gets ASCII minus signs; d3's formatter writes U+2212.
  function sliderTex(template, values) {
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Number.isFinite(values[name]) ? format(values[name]).replace("−", "-") : match);
  }

  function syncSliders(line) {
    if (!sliders) return;
    const guideX = state.guide ? state.guide.x : NaN;
    const values = {
      x: guideX,
      y: line.slope * guideX + line.intercept,
      slope: line.slope,
      intercept: line.intercept
    };
    const tex = {};
    sliderSpecs.forEach((spec) => { tex[spec.key] = sliderTex(spec.tex, values); });
    sliders.sync({
      shown: state.shownSliders,
      values: { guide: state.guide ? guideX : undefined, slope: line.slope, intercept: line.intercept },
      tex
    });
  }

  const svg = chartWrap.append("svg")
    .attr("class", "sfs-svg sfs-graph")
    .attr("role", "img")
    .attr("aria-label", opts.ariaLabel ||
      "Scatterplot of " + yLabel + " against " + xLabel);

  const clipId = "sc-clip-" + Math.random().toString(36).slice(2, 9);
  const clipRect = svg.append("clipPath")
    .attr("id", clipId)
    .append("rect");

  const xAxisLayer = svg.append("g")
    .attr("class", "sc-axis sc-axis-x sfs-axis");
  const yAxisLayer = svg.append("g")
    .attr("class", "sc-axis sc-axis-y sfs-axis");

  const xAxisLabel = svg.append("text")
    .attr("class", "sc-axis-label sfs-axis-label")
    .attr("text-anchor", "middle")
    .text(xLabel);
  const yAxisLabel = svg.append("text")
    .attr("class", "sc-axis-label sfs-axis-label")
    .attr("text-anchor", "middle")
    .text(yLabel);

  // Layer order is meaning: ellipse and mean lines behind, squares behind
  // their residual segments, the fit line above those, points on top.
  const ellipseLayer = svg.append("g")
    .attr("class", "sc-layer sc-ellipse-layer")
    .attr("clip-path", `url(#${clipId})`);
  const ellipsePath = ellipseLayer.append("path")
    .attr("class", "sc-ellipse");

  const productsLayer = svg.append("g")
    .attr("class", "sc-layer sc-products-layer")
    .attr("clip-path", `url(#${clipId})`);

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

  const deviationsLayer = svg.append("g")
    .attr("class", "sc-layer sc-deviations-layer")
    .attr("clip-path", `url(#${clipId})`);
  const productLabelsLayer = svg.append("g")
    .attr("class", "sc-layer sc-product-labels-layer");

  const squaresLayer = svg.append("g")
    .attr("class", "sc-layer sc-squares-layer")
    .attr("clip-path", `url(#${clipId})`);
  const squareLabelsLayer = svg.append("g")
    .attr("class", "sc-layer sc-square-labels-layer");
  const residualsLayer = svg.append("g")
    .attr("class", "sc-layer sc-residuals-layer")
    .attr("clip-path", `url(#${clipId})`);

  const lineLayer = svg.append("g")
    .attr("class", "sc-layer sc-line-layer")
    .attr("clip-path", `url(#${clipId})`);
  // Where the least-squares line is, while the reader tries others.
  const bestLine = lineLayer.append("line")
    .attr("class", "sc-best-line");
  const fitLine = lineLayer.append("line")
    .attr("class", "sc-fit-line sfs-graph-line");
  // With a second predictor, the one line becomes a family: one line for each
  // value of z, labelled at its right-hand end.
  const familyLayer = lineLayer.append("g").attr("class", "sc-family-layer");
  const familyLabelsLayer = svg.append("g")
    .attr("class", "sc-layer sc-family-labels-layer")
    .attr("aria-hidden", "true");

  // Rise over run: the run along X, then the rise up (or down) to the line.
  const riseRunLayer = svg.append("g")
    .attr("class", "sc-layer sc-rise-run-layer");
  const runLine = riseRunLayer.append("line").attr("class", "sc-rise-run-line sc-run");
  const riseLine = riseRunLayer.append("line").attr("class", "sc-rise-run-line sc-rise");
  const runText = riseRunLayer.append("text").attr("class", "sc-rise-run-label sc-run-label")
    .attr("text-anchor", "middle");
  const riseText = riseRunLayer.append("text").attr("class", "sc-rise-run-label sc-rise-label")
    .attr("text-anchor", "start")
    .attr("dy", "0.32em");
  // The family's spacing: a rise from one line to the next, one unit of z up.
  const spacingLayer = svg.append("g")
    .attr("class", "sc-layer sc-spacing-layer")
    .attr("aria-hidden", "true");
  const spacingLine = spacingLayer.append("line").attr("class", "sc-rise-run-line sc-rise");
  const spacingText = spacingLayer.append("text").attr("class", "sc-rise-run-label sc-rise-label")
    .attr("text-anchor", "start")
    .attr("dy", "0.32em");

  const pointsLayer = svg.append("g")
    .attr("class", "sc-layer sc-points-layer");
  const labelsLayer = svg.append("g")
    .attr("class", "sc-layer sc-labels-layer");
  // Dashed outlines of adjusted scores, as the ANOVA figures draw stand-ins.
  const ghostLayer = svg.append("g")
    .attr("class", "sc-layer sc-ghost-layer")
    .attr("aria-hidden", "true");

  // Above the points, so the marker on the line is never hidden by a dot.
  const guideLayer = svg.append("g")
    .attr("class", "sc-layer sc-guide-layer")
    .attr("aria-hidden", "true");

  const annotationLayer = svg.append("g")
    .attr("class", "sc-layer sc-annotation");

  const ssColors = {
    total: "var(--sfs-muted, #68727d)",
    residual: "var(--sc-residual-color)",
    regression: "var(--sfs-effect-color, #7654b5)"
  };
  // Every name the sums of squares are given in the figure.
  const ssNames = {
    total: "Total",
    residual: "Residual",
    regression: "Regression",
    best: "Best fit",
    alone: xName + " alone",
    aloneZ: zName + " alone",
    onlyX: xName + " only",
    onlyZ: zName + " only",
    shared: "Shared"
  };
  // With two predictors the regression share splits as Chapter 16's between
  // groups share split into its factors: each predictor's own part on top of
  // the residual, in the same colour at different strengths, and what they
  // share above them.
  const partitionOpacity = { onlyZ: 0.36, onlyX: 0.12, shared: 0.24 };
  // Room under the square (or beside it, under the plot) for the parts' names.
  const legendRows = hasZ ? 4 : 2;
  const compactLabelWidth = hasZ ? 150 : 130;

  // Shades of blue for the levels of z: palest for the lowest.
  const zLevels = hasZ ? Array.from(new Set(initialPoints.map((p) => p.z))).sort(d3.ascending) : [];
  function zColor(z) {
    const [lo, hi] = d3.extent(zLevels);
    const share = hi > lo ? (z - lo) / (hi - lo) : 1;
    return `color-mix(in oklab, var(--sc-z-high) ${Math.round(100 * share)}%, var(--sc-z-low))`;
  }

  // One square, on the same area scale as the plot, throughout the comparison.
  // The regression pieces land on the residual area already collected. It
  // sits in a panel like the ANOVA explorer's, with the total named above the
  // square and its parts listed underneath.
  let collection;
  function renderSSCollection(mode, stats, ssResidual, deviation, squareGeometry, animate, delay) {
    if (collection) {
      collection.selectAll("*").interrupt();
      collection.remove();
      collection = null;
    }
    const showPanel = (ssPanel || mode) && stats.ssY > 0;
    if (!showPanel) {
      svg.attr("viewBox", [0, 0, width, height]);
      return;
    }

    const side = Math.sqrt(stats.ssY) * Math.abs(y(1) - y(0));
    let left, top;
    collection = svg.append("g").attr("class", "sc-ss-collection").attr("pointer-events", "none");
    if (panelBeside) {
      const panel = { x: width + SC_PANEL_GAP, y: Math.max(2, margin.top - 10),
        width: figureWidth - width - SC_PANEL_GAP - 2,
        height: SC_PANEL_HEAD + side + 18 + legendRows * SC_PANEL_ROW };
      left = panel.x + SC_PANEL_INSET;
      top = panel.y + SC_PANEL_HEAD;
      svg.attr("viewBox", [0, 0, figureWidth, Math.max(height, panel.y + panel.height + 2)]);
      collection.append("rect").attr("class", "sc-ss-panel")
        .attr("x", panel.x).attr("y", panel.y).attr("width", panel.width).attr("height", panel.height)
        .attr("rx", 10).attr("ry", 10);
      collection.append("text").attr("class", "sc-ss-panel-title")
        .attr("x", panel.x + SC_PANEL_INSET).attr("y", panel.y + 27)
        .text("Sums of squares");
    } else {
      left = Math.max(4, Math.round((width - side - compactLabelWidth) / 2));
      top = height + 26;
      svg.attr("viewBox", [0, 0, width, top + side + 6]);
    }
    const bottom = top + side;
    const depth = value => side * value / stats.ssY;
    if (!mode) return;

    const label = (x, y, name) => collection.append("text")
      .attr("class", "sc-axis-label").attr("x", x).attr("y", y).attr("data-sum", name);
    // The parts' labels, one row each under the square (beside it, under
    // the plot), with a swatch in the shape's own fill and outline.
    let rows = 0;
    const partLabel = (name, color, dashed, opacity = 0.24) => {
      const rowX = panelBeside ? left : left + side + 12;
      const rowY = (panelBeside ? bottom + 24 : top + 14) + SC_PANEL_ROW * rows++;
      collection.append("rect").attr("class", "sc-ss-swatch")
        .attr("x", rowX).attr("y", rowY - 10).attr("width", 12).attr("height", 12)
        .attr("fill", dashed ? "none" : color).attr("fill-opacity", opacity)
        .attr("stroke", color).attr("stroke-width", dashed ? 1.5 : 1)
        .attr("stroke-dasharray", typeof dashed === "string" ? dashed : dashed ? "3 2" : null);
      return label(rowX + 18, rowY, name);
    };
    const totalLabel = label(left, top - 9, "total");
    const setTotal = value => totalLabel.text(ssNames.total + " = " + format(value));
    setTotal(stats.ssY);
    collection.append("rect").attr("class", "sc-ss-outline")
      .attr("x", left).attr("y", top).attr("width", side).attr("height", side)
      .attr("fill", ssColors.total).attr("fill-opacity", 0.06)
      .attr("stroke", ssColors.total);
    if (mode === "reference") return;

    // Any line the reader tries: its squared residuals as one band, against
    // a dashed outline of the least-squares total, which no line can beat.
    if (mode === "compare") {
      const ssBest = scSumSquaredResiduals(state.points, stats.fitSlope, stats.fitIntercept);
      const shown = Math.min(ssResidual, stats.ssY);
      collection.append("rect").attr("class", "sc-ss-residual")
        .attr("x", left).attr("y", bottom - depth(shown)).attr("width", side).attr("height", depth(shown))
        .attr("fill", ssColors.residual).attr("fill-opacity", 0.24)
        .attr("stroke", ssColors.residual);
      collection.append("rect").attr("class", "sc-ss-best")
        .attr("x", left).attr("y", bottom - depth(ssBest)).attr("width", side).attr("height", depth(ssBest))
        .attr("fill", "none").attr("stroke", "var(--sfs-text, currentColor)")
        .attr("stroke-width", 1.5).attr("stroke-dasharray", "5 4");
      partLabel("residual", ssColors.residual).text(ssNames.residual + " = " + format(ssResidual));
      partLabel("best", "var(--sfs-text, currentColor)", true).text(ssNames.best + " = " + format(ssBest));
      return;
    }

    // Both predictors' share, split into what each accounts for that the
    // other doesn't, and what either could account for alone.
    const fit = state.lineMode === "multiple" ? scMultipleFit(state.points) : null;
    if (mode === "partition") {
      if (!fit) return;
      const parts = [
        { key: "onlyZ", value: fit.ssRegression - fit.ssRegressionX },
        { key: "onlyX", value: fit.ssRegression - fit.ssRegressionZ }
      ];
      parts.push({ key: "shared", value: fit.ssRegression - parts[0].value - parts[1].value });
      collection.append("rect").attr("class", "sc-ss-residual")
        .attr("x", left).attr("y", bottom - depth(ssResidual)).attr("width", side).attr("height", depth(ssResidual))
        .attr("fill", ssColors.residual).attr("fill-opacity", 0.24)
        .attr("stroke", ssColors.residual);
      partLabel("residual", ssColors.residual).text(ssNames.residual + " = " + format(ssResidual));
      // The parts divide the regression band they were collected as.
      const whole = { y: bottom - depth(ssResidual + fit.ssRegression), height: depth(fit.ssRegression) };
      let base = ssResidual;
      parts.forEach((part) => {
        const box = { y: bottom - depth(base + part.value), height: depth(part.value) };
        base += part.value;
        const rect = collection.append("rect").attr("class", "sc-ss-" + part.key)
          .attr("x", left).attr("width", side)
          .attr("fill", ssColors.regression).attr("stroke", ssColors.regression);
        (animate ? rect.attr("y", whole.y).attr("height", whole.height).attr("fill-opacity", 0.24)
          .transition().delay(200).duration(700).ease(d3.easeCubicInOut) : rect)
          .attr("y", box.y).attr("height", box.height).attr("fill-opacity", partitionOpacity[part.key]);
        partLabel(part.key, ssColors.regression, false, partitionOpacity[part.key])
          .text(ssNames[part.key] + " = " + format(part.value));
      });
      return;
    }

    const base = mode === "regression" ? ssResidual : 0;
    function band(value, offset) {
      return { x: left, y: bottom - depth(offset + value), width: side, height: depth(value) };
    }
    function addBand(name, value, offset) {
      const box = band(value, offset);
      return collection.append("rect").attr("class", "sc-ss-" + name)
        .attr("x", box.x).attr("y", box.y).attr("width", box.width).attr("height", box.height)
        .attr("fill", ssColors[name]).attr("fill-opacity", 0.24)
        .attr("stroke", ssColors[name]);
    }
    if (mode === "regression") {
      addBand("residual", base, 0);
      partLabel("residual", ssColors.residual).text(ssNames.residual + " = " + format(base));
    }

    const color = ssColors[mode];
    const pieces = state.points.map(p => {
      const from = squareGeometry(p);
      return { from, side: from.side, value: deviation(p) ** 2, color };
    }).filter(piece => piece.value > 0);
    const sum = d3.sum(pieces, piece => piece.value);
    const sumRect = addBand(mode, animate ? 0 : sum, base);
    let setSum = setTotal;
    if (mode !== "total") {
      const text = partLabel(mode, color);
      setSum = value => text.text(ssNames[mode] + " = " + format(value));
    }
    setSum(animate ? 0 : sum);
    // With both predictors, each predictor's residual total on its own is
    // outlined, as the best fit was while the reader tried other lines. The
    // gap down to the residual is what adding the other predictor gains.
    if (fit && mode === "residual") {
      [
        { key: "alone", value: stats.ssY - fit.ssRegressionX, dash: "5 4" },
        { key: "aloneZ", value: stats.ssY - fit.ssRegressionZ, dash: "2 3" }
      ].forEach(({ key, value, dash }) => {
        collection.append("rect").attr("class", "sc-ss-" + key)
          .attr("x", left).attr("y", bottom - depth(value)).attr("width", side).attr("height", depth(value))
          .attr("fill", "none").attr("stroke", "var(--sfs-text, currentColor)")
          .attr("stroke-width", 1.5).attr("stroke-dasharray", dash);
        partLabel(key, "var(--sfs-text, currentColor)", dash).text(ssNames[key] + " = " + format(value));
      });
    }
    if (animate) {
      window.sfsAnovaSquares.pour(collection, {
        pieces, color, level: value => band(value, base), sumRect, delay,
        mouth: { x: left + side / 2, y: top }, onLand: setSum
      });
    }
  }

  // Everything whose position depends on the plot's size rather than its
  // data. Called once at the authored width, and again after each resize.
  function applyGeometry() {
    x.range([margin.left, plotRight]);
    y.range([plotBottom, margin.top]);
    svg.attr("viewBox", [0, 0, width, height]);
    clipRect
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", innerWidth)
      .attr("height", plotBottom - margin.top);
    xAxisLayer.attr("transform", `translate(0,${plotBottom})`);
    yAxisLayer.attr("transform", `translate(${margin.left},0)`);
    xAxisLabel
      .attr("x", (margin.left + plotRight) / 2)
      .attr("y", height - 12);
    yAxisLabel
      .attr("transform", `translate(16,${(margin.top + plotBottom) / 2}) rotate(-90)`);
    annotationLayer
      .attr("transform", `translate(${margin.left + 14},${margin.top + 8})`);
  }
  applyGeometry();

  function resize(nextWidth) {
    const rounded = Math.round(nextWidth);
    if (!(rounded > 0) || rounded === figureWidth) return;
    // A move still in flight would finish at positions from the old scales.
    svg.selectAll("*").interrupt("sc-move").interrupt("sc-square-label");
    const [yLo, yHi] = y.domain();
    setGeometry(rounded, Math.abs(yHi - yLo));
    applyGeometry();
    render({ animate: false });
  }
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
  const ssSubscript = ssText.append("tspan")
    .attr("class", "sc-annotation-sub")
    .attr("dy", "0.35em")
    .text("residual");
  const ssValueSpan = ssText.append("tspan")
    .attr("dy", "-0.35em")
    .text(" = —");
  const spText = annotationLayer.append("text")
    .attr("dominant-baseline", "hanging");
  spText.append("tspan")
    .attr("font-style", "italic")
    .text("SP");
  const spValueSpan = spText.append("tspan").text(" = —");

  // A real minus sign, and an explicit plus only where the sign is the point.
  function signed(value, plus) {
    const text = format(Math.abs(value));
    if (value < 0 && Number(text) !== 0) return "\u2212" + text;
    return (plus && value > 0 ? "+" : "") + text;
  }

  // --- Derived quantities -----------------------------------------------------

  function effectiveLine() {
    const stats = scStats(state.points);
    if (state.lineMode === "fit") {
      return { slope: stats.fitSlope, intercept: stats.fitIntercept };
    }
    // With both predictors, the one line is x's slope through the means. It
    // is also the family's line at the mean of z, which the others part from.
    if (state.lineMode === "adjusted" || state.lineMode === "multiple") {
      const fit = scMultipleFit(state.points);
      if (fit) return { slope: fit.slopeX, intercept: fit.means.y - fit.slopeX * fit.means.x };
      return { slope: stats.fitSlope, intercept: stats.fitIntercept };
    }
    if (state.lineMode === "mean") {
      return { slope: 0, intercept: stats.meanY };
    }
    return { slope: state.slope, intercept: state.intercept };
  }

  // Each point's prediction: from the line, or with both predictors, from
  // the line for that point's value of z.
  function predictor(line) {
    const fit = state.lineMode === "multiple" ? scMultipleFit(state.points) : null;
    return fit
      ? (p) => fit.slopeX * p.x + fit.slopeZ * p.z + fit.intercept
      : (p) => line.slope * p.x + line.intercept;
  }

  function sumSquaredResiduals(predict) {
    return d3.sum(state.points, (p) => (p.y - predict(p)) ** 2);
  }

  function setValue() {
    const stats = scStats(state.points);
    const line = effectiveLine();
    const ssResidual = sumSquaredResiduals(predictor(line));
    const ssResidualFit = scSumSquaredResiduals(state.points, stats.fitSlope, stats.fitIntercept);
    const multiple = state.lineMode === "multiple" ? scMultipleFit(state.points) : null;
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
      multiple,
      seEstimate: stats.n > 2 ? Math.sqrt(ssResidual / (stats.n - 2)) : null,
      points: state.points.map((p) => ({ ...p })),
      guide: state.guide ? { x: state.guide.x, y: line.slope * state.guide.x + line.intercept } : null,
      riseRun: state.riseRun ? { ...state.riseRun } : null,
      shownSliders: state.shownSliders.slice(),
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
      ? d3.axisBottom(x).ticks(opts.xTickCount || scTickCount(innerWidth, 56)).tickPadding(8)
      : d3.axisBottom(x).tickValues([]);
    const yAxis = state.ticks === "numeric"
      ? d3.axisLeft(y).ticks(opts.yTickCount || scTickCount(plotBottom - margin.top, 40)).tickPadding(6)
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

  function inDomain(scale, value) {
    const [lo, hi] = scale.domain();
    return value >= Math.min(lo, hi) && value <= Math.max(lo, hi);
  }

  // The read-off guide is drawn by read-guides.js, like the guides on the
  // frequency polygon in Chapter 2. A step that sets a new guide traces it
  // from the axis; the slider moves it directly.
  function drawGuide(line, animate, duration, trace) {
    const guideY = state.guide ? line.slope * state.guide.x + line.intercept : NaN;
    const shown = Boolean(state.guide) && inDomain(x, state.guide.x) && inDomain(y, guideY);
    const guides = shown ? [{
      key: "guide",
      x: x(state.guide.x),
      y: y(guideY),
      xLabel: format(state.guide.x),
      yLabel: format(guideY)
    }] : [];
    const frame = { left: margin.left, bottom: plotBottom };
    const tracing = shown && animate && trace;
    sfsReadGuides.draw(guideLayer, guides, frame, {
      collapsed: tracing,
      labelClass: "sc-guide-label",
      xLabelOffset: 24,
      yLabelOffset: 12
    });
    if (tracing) sfsReadGuides.trace(guideLayer, frame, { duration: Math.max(400, duration) });

    // The guide's values stand in for any tick labels they would collide with.
    xAxisLayer.selectAll(".tick text")
      .style("opacity", (d) => shown && Math.abs(x(d) - x(state.guide.x)) < 28 ? 0 : null);
    yAxisLayer.selectAll(".tick text")
      .style("opacity", (d) => shown && Math.abs(y(d) - y(guideY)) < 14 ? 0 : null);
  }

  // The run sits on the side of the step away from the line, so its label
  // never crosses it: under a rising line, over a falling one.
  // A traced step can wait `delay` ms for the line to reach its place.
  function drawRiseRun(line, animate, duration, trace, delay = 0) {
    const step = state.riseRun;
    if (!step) {
      setReveal(riseRunLayer, false, animate);
      return;
    }
    const startY = line.slope * step.from + line.intercept;
    const endY = line.slope * step.to + line.intercept;
    const x0 = x(step.from);
    const x1 = x(step.to);
    const y0 = y(startY);
    const y1 = y(endY);
    const runBelow = (endY - startY) * (step.to - step.from) >= 0;
    const runLabelY = y0 + (runBelow ? 18 : -8);
    runText.text(signed(step.to - step.from, true));
    riseText.text(signed(endY - startY, true));

    riseRunLayer.selectAll("*").interrupt("sc-rise-run");
    if (trace && animate) {
      const half = Math.max(350, duration * 0.8);
      // Zero-length lines still draw their round caps, so each stays hidden
      // until it starts to grow.
      runLine.attr("x1", x0).attr("y1", y0).attr("x2", x0).attr("y2", y0).style("opacity", 0)
        .transition("sc-rise-run").delay(delay).duration(half).ease(d3.easeCubicInOut)
        .style("opacity", 1).attr("x2", x1);
      riseLine.attr("x1", x1).attr("y1", y0).attr("x2", x1).attr("y2", y0).style("opacity", 0)
        .transition("sc-rise-run").delay(delay + half + 80).duration(half).ease(d3.easeCubicInOut)
        .style("opacity", 1).attr("y2", y1);
      runText.attr("x", (x0 + x1) / 2).attr("y", runLabelY).style("opacity", 0)
        .transition("sc-rise-run").delay(delay + half - 120).duration(200).style("opacity", 1);
      riseText.attr("x", x1 + 8).attr("y", (y0 + y1) / 2).style("opacity", 0)
        .transition("sc-rise-run").delay(delay + 2 * half - 40).duration(200).style("opacity", 1);
    } else {
      runText.style("opacity", 1);
      riseText.style("opacity", 1);
      runLine.style("opacity", 1);
      riseLine.style("opacity", 1);
      maybeTransition(runLine, animate, duration)
        .attr("x1", x0).attr("y1", y0).attr("x2", x1).attr("y2", y0);
      maybeTransition(riseLine, animate, duration)
        .attr("x1", x1).attr("y1", y0).attr("x2", x1).attr("y2", y1);
      maybeTransition(runText, animate, duration)
        .attr("x", (x0 + x1) / 2).attr("y", runLabelY);
      maybeTransition(riseText, animate, duration)
        .attr("x", x1 + 8).attr("y", (y0 + y1) / 2);
    }
    setReveal(riseRunLayer, true, animate);
  }

  function setReveal(target, visible, animate) {
    window.interactiveFigure.setRevealVisible(target, visible, {
      root: rootNode,
      animate
    });
  }

  // The family of lines for two predictors. They part from the one-predictor
  // line, and fold back into it when a step returns to one predictor. Each
  // level of z is labelled at the right-hand end of its line.
  function drawFamily(fit, line, animate, duration) {
    const [xLo, xHi] = x.domain();
    const single = { y1: y(line.slope * xLo + line.intercept), y2: y(line.slope * xHi + line.intercept) };
    const ends = (z) => fit
      ? { y1: y(fit.slopeX * xLo + fit.slopeZ * z + fit.intercept), y2: y(fit.slopeX * xHi + fit.slopeZ * z + fit.intercept) }
      : single;
    const lines = familyLayer.selectAll("line.sc-family-line")
      .data(fit ? zLevels : [], (z) => z)
      .join(
        (enter) => enter.append("line").attr("class", "sc-family-line")
          .attr("x1", x(xLo)).attr("x2", x(xHi))
          .attr("y1", single.y1).attr("y2", single.y2),
        (update) => update,
        (exit) => maybeTransition(exit, animate, duration)
          .attr("y1", single.y1).attr("y2", single.y2).style("opacity", 0).remove()
      )
      .attr("stroke", zColor);
    // While only some students are measured, so are only their lines.
    const focusZ = state.focus ? new Set(state.focus.map((i) => state.points[i] && state.points[i].z)) : null;
    const lineOpacity = (z) => !focusZ || focusZ.has(z) ? 1 : 0.25;
    maybeTransition(lines, animate, duration)
      .attr("x1", x(xLo)).attr("x2", x(xHi))
      .attr("y1", (z) => ends(z).y1).attr("y2", (z) => ends(z).y2)
      .style("opacity", lineOpacity);

    // The key lists the levels top down from the highest, under the
    // predictor's name, in the right-hand margin. Once the lines are drawn,
    // each label moves level with its line's right-hand end.
    const keyed = fit || state.colorByZ ? zLevels : [];
    const rank = (z) => zLevels.length - 1 - zLevels.indexOf(z);
    const labelX = plotRight + margin.right - 2;
    const labelY = (z) => (fit ? ends(z).y2 : margin.top + 22 + 16 * rank(z)) + 4;
    const labels = familyLabelsLayer.selectAll("text.sc-family-level")
      .data(keyed, (z) => z)
      .join((enter) => enter.append("text").attr("x", labelX).attr("y", labelY))
      .attr("class", "sc-family-label sc-family-level")
      .attr("text-anchor", "end")
      .attr("fill", zColor)
      .text((z) => format(z) + zUnit);
    labels.interrupt("sc-move");
    maybeTransition(labels, animate, duration)
      .attr("x", labelX).attr("y", labelY)
      .style("opacity", (z) => fit ? lineOpacity(z) : 1);
    const name = familyLabelsLayer.selectAll("text.sc-family-name")
      .data(keyed.length ? [d3.max(zLevels)] : [])
      .join((enter) => enter.append("text").attr("x", labelX).attr("y", (z) => labelY(z) - 17))
      .attr("class", "sc-family-label sc-family-name")
      .attr("text-anchor", "end")
      .attr("fill", "var(--graph-text-color, currentColor)")
      .text(zName);
    name.interrupt("sc-move");
    maybeTransition(name, animate, duration)
      .attr("x", labelX).attr("y", (z) => labelY(z) - 17);
  }

  // Each point's x as it would be at the mean of z, slid there as a dashed
  // outline while the point itself stays put.
  function drawAdjusted(fit, animate) {
    const items = state.adjustX && fit ? state.points.map((p, i) => ({
      key: i,
      from: { x: x(p.x), y: y(p.y) },
      x: x(p.x - fit.slopeXOnZ * (p.z - fit.means.z)),
      y: y(p.y),
      color: state.colorByZ ? zColor(p.z) : "var(--sc-point-color)"
    })) : [];
    // The outlines are anova-squares.js's, which only pages with them load.
    const squares = window.sfsAnovaSquares;
    if (!squares || (!items.length && ghostLayer.select("circle").empty())) return;
    squares.ensureStyles();
    squares.renderGhosts(ghostLayer, items, { animate });
    ghostLayer.selectAll("circle.anova-ghost").attr("r", pointRadius);
  }

  // One unit of z up, from the line at the mean of z to the next, between
  // the last point and the plot's right-hand edge.
  let spacingShown = false;
  function drawSpacing(fit, animate, duration) {
    const below = fit ? zLevels.filter((z) => z <= fit.means.z) : [];
    const z0 = below.length ? below[below.length - 1] : zLevels[0];
    const z1 = zLevels.find((z) => z > z0);
    const shown = state.showSpacing && Boolean(fit) && state.lineMode === "multiple" && z1 !== undefined;
    if (shown) {
      const at = (d3.max(state.points, (p) => p.x) + x.domain()[1]) / 2;
      const level = (z) => y(fit.slopeX * at + fit.slopeZ * z + fit.intercept);
      spacingText.text(signed(fit.slopeZ * (z1 - z0), true));
      spacingLine.interrupt("sc-rise-run");
      spacingLine.attr("x1", x(at)).attr("x2", x(at)).attr("y1", level(z0));
      // Newly shown, it rises from one line to the next once the lines have parted.
      if (animate && !spacingShown) {
        spacingLine.attr("y2", level(z0))
          .transition("sc-rise-run").delay(duration).duration(Math.max(350, duration * 0.8))
          .ease(d3.easeCubicInOut).attr("y2", level(z1));
      } else {
        spacingLine.attr("y2", level(z1));
      }
      spacingText.attr("x", x(at) + 8).attr("y", (level(z0) + level(z1)) / 2);
    }
    spacingShown = shown;
    setReveal(spacingLayer, shown, animate);
  }

  // Whether the last render showed the adjusted outlines, and its line mode,
  // so the line is tethered to the outlines only as they first slide out.
  let wasAdjusted = false;
  let previousLineMode = state.lineMode;

  // Which residuals and squares the last render showed, and what they
  // measured, so a step that adds students draws only the newcomers.
  let drawn = { key: null, residuals: new Set(), squares: new Set() };

  function render(options) {
    options = options || {};
    const animate = options.animate !== false && !scPrefersReducedMotion();
    const duration = scPositiveNumber(options.duration, transitionDuration);
    const drawMeanSquares = animate && options.drawMeanSquares && state.showSquares && state.squareMode !== "residual";

    if (!animate) {
      rootNode.classList.add("sc-no-anim");
    }

    const stats = scStats(state.points);
    const line = effectiveLine();
    // Where the mean lines are drawn right now (mid-move, if a step is still
    // animating), so a point's hollow state can follow the lines as they move.
    const meanStart = {
      x: meanXLine.attr("x1") === null ? null : Number(meanXLine.attr("x1")),
      y: meanYLine.attr("y1") === null ? null : Number(meanYLine.attr("y1"))
    };
    const predicted = predictor(line);
    const ssResidual = sumSquaredResiduals(predicted);
    const fit = state.lineMode === "multiple" ? scMultipleFit(state.points) : null;

    drawAxes(animate, duration);
    rootNode.classList.toggle("is-draggable", state.draggable);

    // Fit line spans the x domain; the clip path trims any vertical overflow.
    const [xLo, xHi] = x.domain();
    // When the adjusted outlines slide out from the one-predictor line, the
    // line moves with them: at every frame it is the least-squares line
    // through the outlines where they are, so its slope eases from x's slope
    // alone to x's slope with z, in step with the slide.
    const tether = animate && state.adjustX && !wasAdjusted && previousLineMode === "fit" &&
      window.sfsAnovaSquares ? scMultipleFit(state.points) : null;
    const settle = tether ? window.sfsAnovaSquares.GHOST_RISE + window.sfsAnovaSquares.GHOST_SLIDE : 0;
    if (tether) {
      const adjust = (p) => -tether.slopeXOnZ * (p.z - tether.means.z);
      fitLine.interrupt("sc-move").style("opacity", 1)
        .transition("sc-move")
        .delay(window.sfsAnovaSquares.GHOST_RISE)
        .duration(window.sfsAnovaSquares.GHOST_SLIDE)
        .ease(d3.easeCubicInOut)
        .tween("sc-tether", function() {
          const node = d3.select(this);
          return (t) => {
            const at = scStats(state.points.map((p) => ({ x: p.x + t * adjust(p), y: p.y })));
            node.attr("x1", x(xLo)).attr("y1", y(at.fitSlope * xLo + at.fitIntercept))
              .attr("x2", x(xHi)).attr("y2", y(at.fitSlope * xHi + at.fitIntercept));
          };
        });
    } else {
      maybeTransition(fitLine, animate, duration)
        .attr("x1", x(xLo))
        .attr("y1", y(line.slope * xLo + line.intercept))
        .attr("x2", x(xHi))
        .attr("y2", y(line.slope * xHi + line.intercept))
        .style("opacity", fit ? 0 : 1);
    }
    wasAdjusted = state.adjustX;
    previousLineMode = state.lineMode;
    drawFamily(fit, line, animate, duration);
    drawAdjusted(state.lineMode === "adjusted" || state.lineMode === "multiple" ? scMultipleFit(state.points) : null, animate);
    drawSpacing(fit, animate, duration);

    bestLine
      .style("display", state.collectSS === "compare" ? null : "none")
      .attr("x1", x(xLo))
      .attr("y1", y(stats.fitSlope * xLo + stats.fitIntercept))
      .attr("x2", x(xHi))
      .attr("y2", y(stats.fitSlope * xHi + stats.fitIntercept));

    drawRiseRun(line, animate, duration, options.traceRiseRun, settle);
    drawGuide(line, animate, duration, options.traceGuide);

    // A mean-only line measures total deviations. For the regression share the
    // fitted scores themselves are the observations we measure from the mean.
    // The partition step keeps the regression squares on the plot.
    const fitted = state.lineMode === "fit" || state.lineMode === "adjusted" || Boolean(fit);
    const mode = state.collectSS === "compare" ? "compare"
      : state.collectSS === "partition" ? (fit ? "partition" : null)
      : (state.collectSS === "total" ? state.lineMode === "mean" : fitted)
        ? state.collectSS : null;
    const measure = mode === "partition" ? "regression" : mode;
    const startScore = measure === "regression" ? predicted : p => p.y;
    const endScore = measure === "regression" ? () => stats.meanY : predicted;
    const deviation = p => startScore(p) - endScore(p);
    lineLayer.selectAll("circle.sc-prediction")
      .data(measure === "regression" ? state.points : [])
      .join("circle").attr("class", "sc-prediction")
      .attr("cx", p => x(p.x)).attr("cy", p => y(predicted(p)))
      .attr("r", pointRadius * 0.75).attr("fill", "var(--sfs-bg, white)")
      .attr("stroke", ssColors.regression).attr("stroke-width", 1.5);
    const drawLines = animate && (options.draw === "lines" || options.draw === "both");
    const growSquares = drawMeanSquares || (animate && (options.draw === "squares" || options.draw === "both"));
    const squareDelay = drawLines || drawMeanSquares ? duration + 100 : 0;
    const measureColor = measure === "regression" || measure === "total" ? ssColors[measure] : null;
    for (const layer of [squaresLayer, squareLabelsLayer, residualsLayer]) {
      layer.style("--sc-residual-color", measureColor);
    }
    // A horizontal mean is the only reference needed for these comparisons.
    meanXLine.style("display", mode ? "none" : null);
    meanXText.style("display", mode ? "none" : null);
    // A step can show some students' residuals and squares before everyone's.
    // Those already showing stay as they are; only newcomers are drawn.
    const shown = (p, i) => !state.focus || state.focus.includes(i);
    const drawKey = [measure, state.squareMode, state.lineMode].join("|");
    const drawnBefore = drawn.key === drawKey ? drawn : { residuals: new Set(), squares: new Set() };
    const residuals = residualsLayer.selectAll("line.sc-residual")
      .data(state.points)
      .join((enter) => enter.append("line")
        .attr("class", "sc-residual")
        .attr("x1", (p) => x(p.x))
        .attr("x2", (p) => x(p.x))
        .attr("y1", (p) => y(p.y))
        .attr("y2", (p) => y(p.y)))
      .style("display", (p, i) => shown(p, i) ? null : "none");
    residuals.interrupt("sc-move");
    if (drawLines) {
      residuals.filter((p, i) => !drawnBefore.residuals.has(i))
        .attr("y1", p => y(startScore(p))).attr("y2", p => y(startScore(p)));
    }
    maybeTransition(residuals, animate, duration)
      .attr("x1", p => x(p.x)).attr("x2", p => x(p.x))
      .attr("y1", p => y(startScore(p))).attr("y2", p => y(endScore(p)));

    // Equal Xs have equal predictions. Put their squares on opposite sides
    // of the segment so both students' contributions can be seen.
    const flipped = new Set();
    if (measure === "regression") {
      for (const students of d3.group(state.points, p => p.x).values()) {
        students.forEach((p, i) => { if (i % 2) flipped.add(p); });
      }
    }
    const plotMiddle = (margin.left + plotRight) / 2;
    const squareGeometry = p => {
      if (state.squareMode === "x") {
        const side = Math.abs(x(p.x) - x(stats.meanX));
        return {
          x: Math.min(x(p.x), x(stats.meanX)),
          y: y(p.y) <= (margin.top + plotBottom) / 2 ? y(p.y) : y(p.y) - side,
          side
        };
      }
      const reference = state.squareMode === "y" ? stats.meanY : endScore(p);
      const start = y(startScore(p));
      const side = Math.abs(start - y(reference));
      const extendRight = (x(p.x) <= plotMiddle) !== flipped.has(p);
      return {
        x: extendRight ? x(p.x) : x(p.x) - side,
        y: Math.min(start, y(reference)),
        side
      };
    };
    renderSSCollection(mode, stats, ssResidual, deviation, squareGeometry, animate, squareDelay + duration);
    const squares = squaresLayer.selectAll("rect.sc-square")
      .data(state.points)
      .join((enter) => enter.append("rect")
        .attr("class", "sc-square")
        .attr("x", (p) => x(p.x))
        .attr("y", (p) => y(p.y))
        .attr("width", 0)
        .attr("height", 0))
      .style("display", (p, i) => shown(p, i) ? null : "none");
    squares.interrupt("sc-move");
    const growing = (p, i) => !drawnBefore.squares.has(i);
    if (growSquares) {
      // Begin as the deviation segment itself, then grow perpendicular to it.
      // X deviations are horizontal; Y deviations are vertical.
      squares.filter(growing)
        .attr("x", (p) => state.squareMode === "x" ? squareGeometry(p).x : x(p.x))
        .attr("y", (p) => state.squareMode === "x" ? y(p.y) : squareGeometry(p).y)
        .attr("width", (p) => state.squareMode === "x" ? squareGeometry(p).side : 0)
        .attr("height", (p) => state.squareMode === "x" ? 0 : squareGeometry(p).side);
    }
    const squareMove = maybeTransition(squares, animate, duration);
    if (growSquares) squareMove.delay(squareDelay).ease(d3.easeCubicOut);
    squareMove
      .attr("x", (p) => squareGeometry(p).x)
      .attr("y", (p) => squareGeometry(p).y)
      .attr("width", (p) => squareGeometry(p).side)
      .attr("height", (p) => squareGeometry(p).side);


    const squareLabels = squareLabelsLayer.selectAll("text.sc-square-label")
      .data(state.points)
      .join("text")
      .attr("class", "sc-square-label")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .text((p) => {
        const distance = state.squareMode === "x" ? p.x - stats.meanX
          : state.squareMode === "y" ? p.y - stats.meanY
          : deviation(p);
        return format(distance * distance);
      });
    squareLabels.interrupt("sc-square-label");
    squareLabels
      .attr("x", (p) => squareGeometry(p).side === 0 ? x(p.x) - 12 : squareGeometry(p).x + squareGeometry(p).side / 2)
      .attr("y", (p) => squareGeometry(p).side === 0 ? y(p.y) + 12 : squareGeometry(p).y + squareGeometry(p).side / 2)
      .style("display", (p, i) => shown(p, i) ? null : "none")
      .style("opacity", (p, i) => growSquares && growing(p, i) ? 0 : 1);
    if (growSquares) {
      squareLabels.filter(growing).transition("sc-square-label")
        .delay(squareDelay + duration).duration(180).style("opacity", 1);
    }
    const showing = (on) => new Set(on ? state.points.map((p, i) => i).filter((i) => shown(null, i)) : []);
    drawn = { key: drawKey, residuals: showing(state.showResiduals), squares: showing(state.showSquares) };

    // Ellipse.
    const ellipseD = ellipsePathData(stats);
    if (ellipseD) {
      maybeTransition(ellipsePath, animate, duration).attr("d", ellipseD);
    }

    // Deviations from the means: one segment across to M_X, one up or down to
    // M_Y. Together they are two sides of that point's product rectangle.
    const meanPX = x(stats.meanX);
    const meanPY = y(stats.meanY);
    const deviationData = state.points.flatMap((p, i) => [
      { key: i + "x", p, axis: "x" },
      { key: i + "y", p, axis: "y" }
    ]).filter((d) => !state.showSquares || state.squareMode === "residual" || d.axis === state.squareMode);
    const deviations = deviationsLayer.selectAll("line.sc-deviation")
      .data(deviationData, (d) => d.key)
      .join((enter) => enter.append("line")
        .attr("class", "sc-deviation")
        .attr("x1", (d) => x(d.p.x))
        .attr("x2", (d) => x(d.p.x))
        .attr("y1", (d) => y(d.p.y))
        .attr("y2", (d) => y(d.p.y)));
    deviations.interrupt("sc-move");
    if (drawMeanSquares) {
      deviations
        .attr("x1", (d) => x(d.p.x))
        .attr("y1", (d) => y(d.p.y))
        .attr("x2", (d) => x(d.p.x))
        .attr("y2", (d) => y(d.p.y));
    }
    maybeTransition(deviations, animate, duration)
      .attr("x1", (d) => d.axis === "x" ? meanPX : x(d.p.x))
      .attr("y1", (d) => d.axis === "x" ? y(d.p.y) : meanPY)
      .attr("x2", (d) => x(d.p.x))
      .attr("y2", (d) => y(d.p.y));

    // Each product of deviations is a literal rectangle between the point
    // and the crosshair, so its area is proportional to the size of the
    // product and SP is the positive area minus the negative area.
    const productOf = (p) => (p.x - stats.meanX) * (p.y - stats.meanY);
    const products = productsLayer.selectAll("rect.sc-product")
      .data(state.points)
      .join((enter) => enter.append("rect")
        .attr("class", "sc-product")
        .attr("x", meanPX)
        .attr("y", meanPY)
        .attr("width", 0)
        .attr("height", 0))
      .classed("is-negative", (p) => productOf(p) < 0);
    maybeTransition(products, animate, duration)
      .attr("x", (p) => Math.min(x(p.x), meanPX))
      .attr("y", (p) => Math.min(y(p.y), meanPY))
      .attr("width", (p) => Math.abs(x(p.x) - meanPX))
      .attr("height", (p) => Math.abs(y(p.y) - meanPY));

    const productLabels = productLabelsLayer.selectAll("text.sc-product-label")
      .data(state.points)
      .join("text")
      .attr("class", "sc-product-label")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .classed("is-negative", (p) => productOf(p) < 0)
      .text((p) => productOf(p) === 0 ? "0" : signed(productOf(p), true));
    maybeTransition(productLabels, animate, duration)
      .attr("x", (p) => productOf(p) === 0 ? x(p.x) - 12 : (x(p.x) + meanPX) / 2)
      .attr("y", (p) => productOf(p) === 0 ? y(p.y) + 12 : (y(p.y) + meanPY) / 2);

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
      .attr("x", plotRight - (mode ? 25 : 64))
      .attr("y", y(stats.meanY) - 7);

    // Points.
    const pointGroups = pointsLayer.selectAll("g.sc-point")
      .data(state.points)
      .join((enter) => {
        const group = enter.append("g")
          .attr("class", "sc-point");
        group.append("circle").attr("class", "sc-hit").attr("r", 16);
        group.append("circle").attr("class", "sc-ring").attr("r", 10);
        group.append("circle").attr("class", "sc-dot sfs-graph-point").attr("r", pointRadius);
        group.append("circle").attr("class", "sc-hole").attr("r", scHoleRadius(pointRadius));
        group.attr("transform", (p) => `translate(${x(p.x)},${y(p.y)})`);
        return group;
      })
      .attr("data-index", (p, i) => i)
      .call(drag)
      .on("keydown", (event) => {
        const index = Number(event.currentTarget.dataset.index);
        handlePointKeydown(event, index);
      });
    // A point turns hollow (its hole fades in) when it is on opposite sides
    // of the two means. While points and mean lines move between steps, that
    // is checked frame by frame from where both are drawn, so a hole fades
    // only as its point actually crosses a line.
    const meanEnd = { x: x(stats.meanX), y: y(stats.meanY) };
    if (animate) {
      maybeTransition(pointGroups, animate, duration)
        .attr("transform", (p) => `translate(${x(p.x)},${y(p.y)})`)
        .tween("sc-quadrant", function(p) {
          const node = this;
          const end = { x: x(p.x), y: y(p.y) };
          const start = scParseTranslate(node.getAttribute("transform")) || end;
          const from = {
            x: meanStart.x === null ? meanEnd.x : meanStart.x,
            y: meanStart.y === null ? meanEnd.y : meanStart.y
          };
          const at = (a, b, t) => a + (b - a) * t;
          return (t) => {
            node.classList.toggle("is-opposite", state.showQuadrants && scOppositeOnScreen(
              at(start.x, end.x, t), at(start.y, end.y, t),
              at(from.x, meanEnd.x, t), at(from.y, meanEnd.y, t)));
          };
        });
    } else {
      pointGroups
        .attr("transform", (p) => `translate(${x(p.x)},${y(p.y)})`)
        .classed("is-opposite", (p) => state.showQuadrants && scQuadrant(p, stats) < 0);
    }
    // While only some students are measured, the others step back.
    pointGroups.style("opacity", (p, i) => shown(p, i) && !state.adjustX ? null : 0.35);
    pointGroups.select(".sc-dot").attr("r", pointRadius)
      .style("fill", (p) => state.colorByZ && Number.isFinite(p.z) ? zColor(p.z) : null);
    pointGroups.select(".sc-hole").attr("r", scHoleRadius(pointRadius));
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
    ssSubscript.text(state.squareMode === "residual" ? "residual" : state.squareMode.toUpperCase());
    ssValueSpan.text(" = " + format(state.squareMode === "x" ? stats.ssX : state.squareMode === "y" ? stats.ssY : ssResidual));
    spValueSpan.text(" = " + signed(stats.sp));
    // Stack only the readouts that are showing.
    let annotationRow = 0;
    [[rText, state.showR], [ssText, state.showSS], [spText, state.showSP]].forEach(([text, shown]) => {
      text.attr("y", annotationRow * 24);
      if (shown) annotationRow += 1;
    });

    // Reveals.
    setReveal(pointsLayer, state.showPoints, animate);
    setReveal(lineLayer, state.showLine, animate);
    setReveal(familyLabelsLayer, Boolean(fit) || state.colorByZ, animate);
    setReveal(residualsLayer, state.showResiduals, animate);
    setReveal(squaresLayer, state.showSquares, animate);
    setReveal(squareLabelsLayer, state.showSquares && state.squareLabels, animate);
    setReveal(ellipseLayer, state.showEllipse, animate);
    setReveal(meansLayer, state.showMeans, animate);
    setReveal(deviationsLayer, state.showDeviations, animate);
    setReveal(productsLayer, state.showProducts, animate);
    setReveal(productLabelsLayer, state.showProducts && state.productLabels, animate);
    setReveal(spText, state.showSP, animate);
    setReveal(labelsLayer, state.pointLabels, animate);
    setReveal(rText, state.showR, animate);
    setReveal(ssText, state.showSS, animate);

    // Emphasis dims every layer not in the emphasized set.
    const layerSelections = {
      points: [pointsLayer, labelsLayer],
      line: [lineLayer, familyLabelsLayer],
      residuals: [residualsLayer],
      squares: [squaresLayer, squareLabelsLayer],
      ellipse: [ellipseLayer],
      means: [meansLayer],
      deviations: [deviationsLayer],
      products: [productsLayer, productLabelsLayer],
      guide: [guideLayer],
      "rise-run": [riseRunLayer]
    };
    layerNames.forEach((name) => {
      const dimmed = Boolean(state.emphasize) && !state.emphasize.includes(name);
      layerSelections[name].forEach((layer) => layer.classed("is-dimmed", dimmed));
    });

    syncControls(stats, line, ssResidual);
    syncSliders(line);
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
      if (correlationControls) {
        readouts.ssX.text(format(stats.ssX));
        readouts.ssY.text(format(stats.ssY));
        readouts.sp.text(signed(stats.sp));
      } else {
        readouts.slope.text(format(line.slope));
        readouts.intercept.text(format(line.intercept));
        readouts.ssResidual.text(format(ssResidual));
      }
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
    const renderOptions = { animate, duration: action.duration, draw: action.draw };

    // A guide, a rise over run, the sliders, a focus on some students, the
    // adjusted outlines and the family's spacing belong to the step that asks
    // for them, so a step that doesn't clears them.
    const keys = Object.keys(action).map(scKey);
    const previousGuide = state.guide;
    const previousRiseRun = state.riseRun;
    if (!keys.includes("guide") && state.guide) {
      state.guide = null;
      changed = true;
    }
    if (!keys.includes("rise-run") && state.riseRun) {
      state.riseRun = null;
      changed = true;
    }
    if (!keys.includes("show-sliders") && state.shownSliders.length) {
      state.shownSliders = [];
      changed = true;
    }
    if (!keys.includes("focus") && state.focus) {
      state.focus = null;
      changed = true;
    }
    if (!keys.includes("adjust-x") && state.adjustX) {
      state.adjustX = false;
      changed = true;
    }
    if (!keys.includes("show-spacing") && state.showSpacing) {
      state.showSpacing = false;
      changed = true;
    }

    Object.entries(action).forEach(([rawKey, value]) => {
      switch (scKey(rawKey)) {
        case "animate":
        case "duration":
          break;
        case "guide":
          state.guide = normalizeGuide(value);
          // Trace a new reading from the axis; keep one the reader is already looking at.
          renderOptions.traceGuide = Boolean(state.guide) &&
            !(previousGuide && previousGuide.x === state.guide.x);
          changed = true;
          shouldNotify = true;
          break;
        case "rise-run":
          state.riseRun = normalizeRiseRun(value);
          renderOptions.traceRiseRun = Boolean(state.riseRun) && !previousRiseRun;
          changed = true;
          break;
        case "show-sliders":
          state.shownSliders = Array.isArray(value) ? value.map(scKey) : [];
          changed = true;
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
        case "square-mode":
          state.squareMode = ["x", "y"].includes(scKey(value)) ? scKey(value) : "residual";
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
        case "show-quadrants":
        case "quadrants":
          state.showQuadrants = scBoolean(value, state.showQuadrants);
          changed = true;
          break;
        case "show-deviations":
        case "deviations":
          state.showDeviations = scBoolean(value, state.showDeviations);
          changed = true;
          break;
        case "show-products":
        case "products":
          state.showProducts = scBoolean(value, state.showProducts);
          changed = true;
          break;
        case "product-labels":
          state.productLabels = scBoolean(value, state.productLabels);
          changed = true;
          break;
        case "show-sp":
        case "sp-label":
          state.showSP = scBoolean(value, state.showSP);
          changed = true;
          break;
        case "show-r":
        case "r-label":
          state.showR = scBoolean(value, state.showR);
          changed = true;
          break;
        case "collect-ss":
          state.collectSS = ["total", "reference", "residual", "regression", "compare", "partition"].includes(value) ? value : null;
          changed = true;
          break;
        case "adjust-x":
          state.adjustX = scBoolean(value, state.adjustX);
          changed = true;
          break;
        case "show-spacing":
          state.showSpacing = scBoolean(value, state.showSpacing);
          changed = true;
          break;
        case "focus":
          state.focus = Array.isArray(value)
            ? value.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < state.points.length)
            : null;
          changed = true;
          break;
        case "color-z":
          state.colorByZ = scBoolean(value, state.colorByZ);
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
      renderOptions.drawMeanSquares = state.showSquares && state.squareMode !== "residual";
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
      setupTutorial();
    }
  }

  // Without the controls drawer, whose wrap() would claim it, the figure
  // claims its callout's tutorial itself once it is in the page.
  function setupTutorial(attempt = 0) {
    const api = window.interactiveFigure;
    if (typeof api.createTutorial !== "function") return;
    if (!rootNode.isConnected) {
      if (attempt < 60) window.requestAnimationFrame(() => setupTutorial(attempt + 1));
      return;
    }
    const callout = rootNode.closest(".callout");
    const footer = callout ? callout.querySelector(".callout-footer") : null;
    if (!footer || footer.dataset.sfsIfTutorial === "true") return;
    const steps = Array.from(footer.children)
      .filter((child) => child.classList && child.classList.contains("tutorial-step"));
    if (steps.length) api.createTutorial({ root: rootNode, footer, steps, applyAction: applyTutorialAction });
  }

  // Redraw to the width the chart really has. The helper waits until the
  // figure is in the page (and, for a figure inside a closed quiz answer,
  // until it is shown) before it reports a width.
  if (opts.responsive !== false && window.interactiveFigure &&
      typeof window.interactiveFigure.observeResponsiveLayout === "function") {
    window.interactiveFigure.observeResponsiveLayout({
      root: rootNode,
      container: chartWrap.node(),
      minimumWidth: 96,
      maximumWidth: 1600,
      widthStep: 2,
      onLayout(layout) {
        resize(layout.width);
      }
    });
  }

  rootNode.setPoints = setPoints;
  return rootNode;
}

// Fixed grid columns reserve a diameter for each dot throughout the morph.
// Keyframes snap to the radius grid. Animation interpolates between them;
// distinct columns guarantee no collisions even between those keyframes.
scAssociationCoverGrid = ({ width = 900, height = 420, radius = 8, count = 48 } = {}) => {
  const centerX = Math.round(width / 2 / radius) * radius;
  const centerY = Math.round(height / 2 / radius) * radius;
  const diameter = 2 * radius;
  // An even column count puts the center between columns; a half-row offset
  // keeps the perfect-correlation diagonal on the same radius grid.
  const rowOffset = count % 2 === 0 ? radius / 2 : 0;
  const source = scGenerateCloud({ n: count, r: 0, seed: 63,
    meanX: 0, meanY: 0, sdX: 1, sdY: 1, round: 12 })
    .sort((a, b) => a[0] - b[0]);
  const xs = source.map((d, i) => (i - (count - 1) / 2) * diameter);
  const sdX = Math.sqrt(d3.mean(xs, x => x * x));
  const standardizedX = xs.map(x => x / sdX);
  // Re-orthogonalize after assigning columns, so rounding is the only source
  // of approximation in the requested correlations.
  const beta = d3.mean(source, (d, i) => d[1] * standardizedX[i]);
  const errors = source.map((d, i) => d[1] - beta * standardizedX[i]);
  const meanError = d3.mean(errors);
  const sdError = Math.sqrt(d3.mean(errors, e => (e - meanError) ** 2));
  const noise = errors.map(e => (e - meanError) / sdError);
  const limit = Math.min(centerY, height - centerY) - diameter;
  return {
    centerY,
    pointsAt(r) {
      const values = standardizedX.map((x, i) => r * x + Math.sqrt(1 - r * r) * noise[i]);
      // At r=1 the line rises one radius for each diameter across: its points
      // remain exactly collinear on the grid. Other states use more headroom.
      const desiredScale = height / 6 + (sdX / 2 - height / 6) * r ** 4;
      const scale = Math.min(desiredScale, limit / d3.max(values, Math.abs));
      return values.map((v, i) => ({
        x: centerX + xs[i],
        y: Math.round((scale * v + rowOffset) / radius) * radius
      }));
    }
  };
}

// Placement is discrete; movement between placements is continuous.
scAssociationCoverInterpolate = (from, to, progress) => from.map((p, i) => ({
  x: p.x,
  y: p.y + (to[i].y - p.y) * progress
}));

makeAssociationCover = (opts = {}) => {
  const regression = opts.regression === true;
  const width = 900, height = 420, radius = 8;
  const grid = scAssociationCoverGrid({ width, height, radius });
  const initialPoints = grid.pointsAt(0);
  const alignedPoints = grid.pointsAt(1);
  const finalPoints = grid.pointsAt(0.6);
  const fit = scStats(finalPoints);
  const fittedY = x => fit.fitIntercept + fit.fitSlope * x;
  const root = d3.create("div").attr("class", "sfs-figure sfs-figure-cover association-cover");
  const label = regression
    ? "Multicolored observations with a correlation of about 0.6 pop into view. Their least-squares line draws across the cloud as dot colors change from population colors to green at zero residual through vermilion at the largest absolute residual."
    : "Multicolored observations pop onto distinct grid positions, align at perfect positive correlation, then move smoothly to a correlation of about 0.6 without overlapping.";
  const svg = root.append("svg").attr("class", "sfs-svg")
    .attr("viewBox", [0, 0, width, height]).attr("role", "img").attr("aria-label", label);
  svg.append("title").text(label);
  const populationColors = d3.schemeTableau10;
  const residuals = finalPoints.map(p => Math.abs(p.y - fittedY(p.x)));
  const maxResidual = d3.max(residuals) || 1;
  const startingColors = finalPoints.map((p, i) => populationColors[i % populationColors.length]);
  const residualColors = residuals.map(residual =>
    `color-mix(in oklch, var(--graph-series-3) ${100 * (1 - residual / maxResidual)}%, var(--graph-series-4))`);
  const dots = svg.append("g").selectAll("circle").data(finalPoints).join("circle")
    .attr("cx", d => d.x).attr("r", radius)
    .attr("fill", (d, i) => startingColors[i])
    .attr("fill-opacity", 1);
  const ends = d3.extent(finalPoints, d => d.x);
  const line = regression ? svg.append("line")
    .attr("stroke", "var(--graph-series-1, #0072b2)").attr("stroke-width", 2.6)
    .attr("stroke-linecap", "round") : null;
  const rng = scMulberry32(42);
  const reveal = finalPoints.map(() => rng());
  const lineStart = 1350, lineDuration = 1200, colorDuration = 400;
  const duration = regression ? lineStart + lineDuration + colorDuration : 3800;
  const clamp = v => Math.max(0, Math.min(1, v));
  const timeline = interactiveFigure.coverTimeline(root.node(), {
    duration, animate: opts.animate !== false,
    draw(elapsed) {
      const points = regression ? finalPoints : elapsed < 2400
        ? scAssociationCoverInterpolate(initialPoints, alignedPoints,
          d3.easeCubicInOut(clamp((elapsed - 1350) / 850)))
        : scAssociationCoverInterpolate(alignedPoints, finalPoints,
          d3.easeCubicInOut(clamp((elapsed - 2650) / 1150)));
      dots.attr("cy", (d, i) => grid.centerY - points[i].y)
        .attr("opacity", (d, i) => elapsed > 0 && elapsed >= reveal[i] * 1000 ? 1 : 0);
      if (line) {
        const end = ends[0] + (ends[1] - ends[0]) * clamp((elapsed - lineStart) / lineDuration);
        // Each color transition follows the drawing line as it reaches that
        // observation. Fill stays fully opaque throughout the color change.
        dots.attr("fill", (d, i) => {
          const fraction = (d.x - ends[0]) / (ends[1] - ends[0]);
          const progress = d3.easeCubicInOut(clamp(
            (elapsed - lineStart - fraction * lineDuration) / colorDuration));
          if (progress === 0) return startingColors[i];
          if (progress === 1) return residualColors[i];
          return `color-mix(in oklab, ${startingColors[i]} ${100 * (1 - progress)}%, ${residualColors[i]})`;
        });
        line.attr("x1", ends[0]).attr("y1", grid.centerY - fittedY(ends[0]))
          .attr("x2", end).attr("y2", grid.centerY - fittedY(end))
          .attr("opacity", elapsed > lineStart ? 1 : 0);
      }
      root.node().value = Object.assign(root.node().value || {}, {
        correlation: scStats(points).r, regression, points: points.map(p => [p.x, p.y])
      });
    }
  });
  root.node().value.replay = timeline.replay;
  return root.node();
}
