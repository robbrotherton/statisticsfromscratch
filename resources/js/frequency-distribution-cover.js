// Ch. 2 cover: the same underlying scores rendered first as a bar graph,
// then widened into a histogram, then overlaid with a frequency polygon,
// then morphed into a smooth frequency curve. Reuses graph-generator.js's
// data/geometry helpers (bcGraphFrequencyRows, bcGraphPolygonPoints,
// bcGraphNormalPdf) so the shapes match the chapter's own demo figures.

fdCoverDefaultData = [1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 5]

// Natural cubic spline through a set of (x,y) points: unlike a kernel
// density estimate (a smoothed approximation of the underlying raw values,
// which won't in general pass through the polygon's own vertices), this is
// an exact interpolant — the returned function reproduces every input
// point precisely, and is smooth in between. Standard tridiagonal
// (Thomas-algorithm) solve for the natural boundary condition (zero second
// derivative at both ends).
fdCoverNaturalSpline = (points) => {
  const n = points.length;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const h = [];
  for (let i = 0; i < n - 1; i++) h.push(xs[i + 1] - xs[i]);

  const a = new Array(n).fill(0);
  const b = new Array(n).fill(1);
  const c = new Array(n).fill(0);
  const d = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    a[i] = h[i - 1];
    b[i] = 2 * (h[i - 1] + h[i]);
    c[i] = h[i];
    d[i] = 6 * ((ys[i + 1] - ys[i]) / h[i] - (ys[i] - ys[i - 1]) / h[i - 1]);
  }
  const cPrime = new Array(n).fill(0);
  const dPrime = new Array(n).fill(0);
  cPrime[0] = c[0] / b[0];
  dPrime[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const m = b[i] - a[i] * cPrime[i - 1];
    cPrime[i] = c[i] / m;
    dPrime[i] = (d[i] - a[i] * dPrime[i - 1]) / m;
  }
  const secondDerivatives = new Array(n).fill(0);
  secondDerivatives[n - 1] = dPrime[n - 1];
  for (let i = n - 2; i >= 0; i--) secondDerivatives[i] = dPrime[i] - cPrime[i] * secondDerivatives[i + 1];

  const bisect = d3.bisector((v) => v).left;
  return (xValue) => {
    const i = Math.max(0, Math.min(n - 2, bisect(xs, xValue) - 1));
    const hi = h[i];
    const left = xs[i + 1] - xValue;
    const right = xValue - xs[i];
    const mLeft = secondDerivatives[i];
    const mRight = secondDerivatives[i + 1];
    return (mLeft * left * left * left) / (6 * hi)
      + (mRight * right * right * right) / (6 * hi)
      + (ys[i] / hi - (mLeft * hi) / 6) * left
      + (ys[i + 1] / hi - (mRight * hi) / 6) * right;
  };
}

fdCoverPiecewiseLinear = (points) => {
  const bisect = d3.bisector((p) => p.x).left;
  return (xValue) => {
    const i = bisect(points, xValue);
    const a = points[Math.max(0, Math.min(points.length - 1, i - 1))];
    const b = points[Math.max(0, Math.min(points.length - 1, i))];
    if (a.x === b.x) return a.y;
    const t = (xValue - a.x) / (b.x - a.x);
    return a.y + t * (b.y - a.y);
  };
}

makeFrequencyDistributionCover = (opts = {}) => {
  const type = "frequency-cover";
  const data = opts.data || fdCoverDefaultData;
  const dimensions = bcGraphDimensions(opts, type);
  const { width, height } = dimensions;
  const margin = Object.assign({ top: 20, right: 16, bottom: 20, left: 16 }, opts.margin);
  const svg = bcGraphCreateSvg(opts, type, dimensions);

  const rows = bcGraphFrequencyRows(data, { type: "histogram" });
  const xPadding = bcGraphValueOr(opts.xPadding, 0.5);
  const xDomain = opts.xDomain || [d3.min(rows, (r) => r.lower) - xPadding, d3.max(rows, (r) => r.upper) + xPadding];
  const maxFrequency = d3.max(rows, (r) => r.frequency);
  const yDomain = [0, maxFrequency * 1.18];

  const x = d3.scaleLinear().domain(xDomain).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain(yDomain).range([height - margin.bottom, margin.top]);

  const fullBarWidth = (row) => x(row.upper) - x(row.lower);
  const gappedBarWidth = (row) => fullBarWidth(row) * 0.58;

  svg.append("line")
    .attr("class", "fd-cover-baseline")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", y(0))
    .attr("y2", y(0))
    .style("stroke", "var(--graph-axis-color, var(--bs-border-color, #dee2e6))")
    .style("stroke-width", 1);

  // One fixed color per mark for the whole sequence — bars stay series-1 as
  // they widen into a histogram, the line/points stay series-3 as the
  // polygon deforms into the curve. Same data-series palette used for
  // multi-series comparisons elsewhere (bcGraphDefaultColors), so the cover
  // borrows its color language from the rest of the book rather than
  // inventing its own.
  const barColor = bcGraphValueOr(opts.barColor, bcGraphDefaultColors[0]);
  const lineColor = bcGraphValueOr(opts.lineColor, bcGraphDefaultColors[2]);

  const bars = svg.append("g")
    .attr("class", "fd-cover-bars")
    .selectAll("rect")
    .data(rows)
    .join("rect")
      .attr("class", "bc-graph-bar")
      .attr("x", (d) => x(d.x) - gappedBarWidth(d) / 2)
      .attr("width", (d) => gappedBarWidth(d))
      .attr("y", y(0))
      .attr("height", 0)
      .style("fill", barColor);
      // No explicit stroke: the shared `.bc-graph .bc-graph-bar` rule in
      // site-theme.css already applies `--graph-bar-stroke` here (this SVG
      // carries the `bc-graph` class), matching the real bar/histogram
      // demo figures rather than duplicating that value.

  const linear = d3.line().curve(d3.curveLinear).x((d) => x(d.x)).y((d) => y(d.y));
  const polygonPoints = bcGraphPolygonPoints(rows, "frequency");

  const line = svg.append("path")
    .attr("class", "bc-graph-line")
    .attr("fill", "none")
    .style("stroke", lineColor)
    .attr("stroke-width", bcGraphValueOr(opts.strokeWidth, 2.5))
    .attr("d", linear(polygonPoints))
    .style("opacity", 0);

  const points = svg.append("g")
    .attr("class", "fd-cover-points")
    .selectAll("circle")
    .data(polygonPoints.filter((p) => p.point))
    .join("circle")
      .attr("class", "bc-graph-point")
      .attr("cx", (d) => x(d.x))
      .attr("cy", (d) => y(d.y))
      .attr("r", bcGraphValueOr(opts.pointRadius, 3.5))
      .style("fill", lineColor)
      .style("opacity", 0);

  // A dense, evenly spaced sample of x-positions lets the polygon and the
  // smooth curve be expressed as two point arrays of equal length, so the
  // path between them can be tweened point-by-point. Rendered with a linear
  // curve, the dense polygon sample is pixel-identical to the coarse
  // polygon (the extra points fall exactly on its straight segments), so
  // swapping to it produces no visible pop before the morph begins.
  const sampleCount = bcGraphValueOr(opts.samplePoints, 121);
  const sampleXs = d3.range(sampleCount).map((i) => xDomain[0] + (i * (xDomain[1] - xDomain[0])) / (sampleCount - 1));
  const polygonYAt = fdCoverPiecewiseLinear(polygonPoints);
  // The curve end-shape is a spline through these exact same polygon
  // points, not a separate density estimate — no proportion/frequency
  // scale mismatch to reconcile, since it's built from the same
  // frequency-scale values the polygon already uses.
  const curveYAt = fdCoverNaturalSpline(polygonPoints);

  const startSamples = sampleXs.map((xv) => ({ x: xv, y: polygonYAt(xv) }));
  const endSamples = sampleXs.map((xv) => ({ x: xv, y: Math.max(0, curveYAt(xv)) }));
  const denseLine = d3.line().curve(d3.curveLinear).x((d) => x(d.x)).y((d) => y(d.y));

  const reduced = bcGraphPrefersReducedMotion();

  if (reduced) {
    points.remove();
    bars.attr("x", (d) => x(d.lower))
      .attr("width", (d) => fullBarWidth(d))
      .attr("y", (d) => y(d.frequency))
      .attr("height", (d) => y(0) - y(d.frequency));
    line.attr("d", denseLine(endSamples))
      .style("opacity", 1);
    return svg.node();
  }

  const barDuration = bcGraphValueOr(opts.barDuration, 750);
  const barStagger = bcGraphValueOr(opts.barStagger, 75);
  const growDuration = bcGraphValueOr(opts.growDuration, 650);
  const pause = bcGraphValueOr(opts.pauseDuration, 180);
  const polygonDuration = bcGraphValueOr(opts.polygonDuration, 650);
  const curveDuration = bcGraphValueOr(opts.curveDuration, 850);
  const fadeDuration = bcGraphValueOr(opts.fadeDuration, 550);
  const threshold = bcGraphValueOr(opts.animationThreshold, 0.5);

  const barsPhaseTotal = barDuration + (rows.length - 1) * barStagger + growDuration;
  const polygonPhaseStart = barsPhaseTotal + pause;
  const curvePhaseStart = polygonPhaseStart + polygonDuration + pause;

  // The line draws left-to-right via a clip rect that grows in width, not
  // stroke-dasharray/dashoffset (see bcGraphRevealClips in graph-generator.js
  // for why) — the rect is left fully open once the draw finishes, so it
  // doesn't need touching again once the line's `d` starts morphing into
  // the curve afterward.
  const revealLeft = margin.left;
  const revealWidth = Math.max(0, width - margin.left - margin.right);
  const [revealClip] = bcGraphRevealClips(svg, line, revealLeft, 0, revealWidth, height);

  const play = () => {
    bars.interrupt()
      .attr("x", (d) => x(d.x) - gappedBarWidth(d) / 2)
      .attr("width", (d) => gappedBarWidth(d))
      .attr("y", y(0))
      .attr("height", 0)
      .style("opacity", 1)
      .transition()
        .delay((d, i) => i * barStagger)
        .duration(barDuration)
        .ease(d3.easeBackOut.overshoot(1.4))
        .attr("y", (d) => y(d.frequency))
        .attr("height", (d) => y(0) - y(d.frequency))
      .transition()
        .duration(growDuration)
        .ease(d3.easeCubicInOut)
        .attr("x", (d) => x(d.lower))
        .attr("width", (d) => fullBarWidth(d));

    revealClip.interrupt()
      .attr("width", 0)
      .transition()
      .delay(polygonPhaseStart)
      .duration(polygonDuration)
      .ease(d3.easeCubicInOut)
      .attr("width", revealWidth);

    line.interrupt()
      .attr("d", linear(polygonPoints))
      .style("opacity", 1)
      .transition()
        .delay(polygonPhaseStart + polygonDuration + pause)
        .duration(curveDuration)
        .ease(d3.easeCubicInOut)
        .attrTween("d", () => {
          const interpolateY = d3.interpolateArray(startSamples.map((p) => p.y), endSamples.map((p) => p.y));
          return (t) => denseLine(sampleXs.map((xv, i) => ({ x: xv, y: interpolateY(t)[i] })));
        });

    points.interrupt()
      .style("opacity", 0)
      .attr("cy", (d) => y(d.y))
      .transition()
        .delay((d, i) => polygonPhaseStart + i * 30)
        .duration(220)
        .style("opacity", 1);

    points.transition()
      .delay(curvePhaseStart)
      .duration(fadeDuration)
      .style("opacity", 0);
  };

  bcGraphPlayEntrance(svg, threshold, play);
  return svg.node();
}
