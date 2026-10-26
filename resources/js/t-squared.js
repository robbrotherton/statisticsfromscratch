// Chapter 14's t² → F figure: the null t distribution folds onto |t|, then
// its axis is squared, and the curve that results is F(1, df). The critical
// region keeps its 5% at every frame, and the observed t rides along to its F.
//
// The whole transformation is one number, the timeline position T:
//   0 → 1  flip   the negative half turns over like a page
//   1 → 2  stack  it settles on top of the positive half (density 2f)
//   2 → 3  zoom   the axis drops its now-empty negative side
//   3 → 4  extend the axis grows to uMax², making room for the squares
//   4 → 5  square every value u moves to u^p, p going from 1 to 2
// Each tutorial stage is a point on it, so any state draws from T alone.
// The axis only changes in zoom and extend; while values are squared it
// holds still, so squaring reads as values moving out, not as a squeeze.

// The arithmetic, kept free of the DOM so the tests can check it.
window.sfsTSquared = (function() {
  const stats = window.sfsStats;
  const STAGES = { t: 0, fold: 3, extend: 4, square: 5 };
  const clamp01 = (value) => Math.max(0, Math.min(1, value));

  function phases(T) {
    return {
      flip: clamp01(T),
      stack: clamp01(T - 1),
      zoom: clamp01(T - 2),
      extend: clamp01(T - 3),
      square: clamp01(T - 4)
    };
  }

  // A point at |t| = u lands at u^p, and its density is divided by the
  // stretch there, d(u^p)/du. At p = 2 one half gives f(√y) / (2√y), so the
  // two halves together give f(√y) / √y, which is the F(1, df) density.
  function jacobian(u, p) {
    if (p === 1) return 1;
    return u > 0 ? 1 / (p * Math.pow(u, p - 1)) : Infinity;
  }

  function halfDensity(u, p, df) {
    return stats.tPdf(u, df) * jacobian(u, p);
  }

  function critical(df, alpha) {
    const t = stats.tInv(1 - alpha / 2, df);
    return { t, f: t * t };
  }

  function pTwoTailed(t, df) {
    return 2 * (1 - stats.tCdf(Math.abs(t), df));
  }

  function pF(f, df) {
    return 1 - stats.f.cdf(f, 1, df);
  }

  return { STAGES, phases, jacobian, halfDensity, critical, pTwoTailed, pF };
})();

window.makeTSquaredExplorer = function(opts) {
  opts = opts || {};
  const geometry = window.sfsTSquared;
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  const df = Math.max(1, Math.round(finite(opts.df, 6)));
  const alpha = finite(opts.alpha, 0.05);
  const tObserved = finite(opts.tObserved, null);
  // The positive half runs from 0 to uMax, so the squared axis ends at uMax².
  const uMax = finite(opts.uMax, 4);
  const crit = geometry.critical(df, alpha);
  // The fold doubles the peak, so the vertical scale leaves room for it from
  // the start and never moves. F(1, df) runs off the top near 0 and is clipped.
  const yTop = 2 * window.sfsStats.tPdf(0, df) * 1.15;
  // Milliseconds spent in each unit of T: flip, stack, zoom, extend, square.
  const PHASE_MS = [1200, 650, 650, 1000, 2400];
  // Whole values of |t| that travel to their squares, so "2 moves out to 4"
  // can be watched rather than inferred.
  const LANDMARKS = (opts.landmarks || [1, 2, 3]).map(Number).filter((u) => u > 0 && u <= uMax);

  const state = {
    stage: geometry.STAGES[opts.stage] !== undefined ? opts.stage : "t",
    showObserved: opts.showObserved === true && tObserved !== null,
    T: 0
  };
  state.T = geometry.STAGES[state.stage];

  const fT = d3.format(".3f");
  const fF = d3.format(".2f");
  const fObs = d3.format(".2f");
  const fPercent = (value) => `${d3.format("~g")(value * 100)}%`;
  const fTick = d3.format("~g");
  // A travelling landmark counts up as it goes: whole numbers stay whole,
  // values passing between them show one decimal.
  const fLandmark = (value) => d3.format("~g")(Math.round(value * 10) / 10);
  const minus = (text) => `−${text}`;

  const root = d3.create("div")
    .attr("class", "t-squared-explorer sfs-figure")
    .style("--tsq-max-width", opts.maxWidth || null);
  const rootNode = root.node();

  root.append("style").text(`
    .t-squared-explorer {
      --sfs-figure-max-width: var(--tsq-max-width, 42rem);
      --tsq-null-color: var(--sfs-null-color, currentColor);
      --tsq-critical-color: var(--sfs-critical-color, #c63f3f);
      --tsq-observed-color: var(--sfs-accent, #2c7fb8);
    }
    .t-squared-explorer svg {
      display: block;
      width: 100%;
      height: auto;
    }
    .t-squared-explorer .tsq-half {
      fill: var(--tsq-null-color);
      fill-opacity: 0.07;
    }
    .t-squared-explorer .tsq-tail {
      fill: var(--tsq-critical-color);
      fill-opacity: 0.32;
    }
    .t-squared-explorer .tsq-curve {
      fill: none;
      stroke: var(--tsq-null-color);
      stroke-width: 2.25;
    }
    .t-squared-explorer .tsq-seam {
      stroke-width: 1.25;
      stroke-dasharray: 4 3;
    }
    .t-squared-explorer .tsq-marker-line {
      stroke-width: 1.5;
      stroke-dasharray: 5 4;
    }
    .t-squared-explorer .tsq-critical line { stroke: var(--tsq-critical-color); }
    .t-squared-explorer .tsq-critical text { fill: var(--tsq-critical-color); }
    .t-squared-explorer .tsq-observed line { stroke: var(--tsq-observed-color); }
    .t-squared-explorer .tsq-observed text { fill: var(--tsq-observed-color); }
    .t-squared-explorer .tsq-marker-label,
    .t-squared-explorer .tsq-tail-label {
      font-size: var(--sfs-figure-tick-size);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      paint-order: stroke;
      stroke: var(--sfs-bg);
      stroke-linejoin: round;
      stroke-width: 3px;
    }
    .t-squared-explorer .tsq-tail-label { fill: var(--tsq-critical-color); }
    .t-squared-explorer .tsq-landmark circle {
      fill: var(--sfs-bg);
      stroke: var(--tsq-null-color);
      stroke-width: 1.75;
    }
    .t-squared-explorer .tsq-landmark text {
      fill: var(--sfs-text);
      font-size: var(--sfs-figure-tick-size);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      paint-order: stroke;
      stroke: var(--sfs-bg);
      stroke-linejoin: round;
      stroke-width: 3px;
    }
    .t-squared-explorer .tsq-title {
      fill: var(--sfs-text);
      font-size: var(--sfs-figure-title-size);
      font-weight: 700;
    }
  `);

  const chartWrap = root.append("div")
    .attr("class", "tsq-chart-wrap sfs-chart-wrap");
  const svg = chartWrap.append("svg")
    .attr("class", "sfs-svg sfs-graph")
    .attr("role", "img");
  const svgTitle = svg.append("title");

  const clipId = `tsq-clip-${Math.round(Math.random() * 1e9)}`;
  const clipRect = svg.append("defs").append("clipPath")
    .attr("id", clipId)
    .append("rect");

  const plot = svg.append("g").attr("clip-path", `url(#${clipId})`);
  const rightHalf = plot.append("path").attr("class", "tsq-half");
  const leftHalf = plot.append("path").attr("class", "tsq-half");
  const rightTail = plot.append("path").attr("class", "tsq-tail");
  const leftTail = plot.append("path").attr("class", "tsq-tail");
  const rightCurve = plot.append("path").attr("class", "tsq-curve");
  const leftCurve = plot.append("path").attr("class", "tsq-curve");

  const axisLayer = svg.append("g").attr("aria-hidden", "true");
  const baseline = axisLayer.append("line").attr("class", "sfs-graph-domain");
  const tickLayer = axisLayer.append("g");
  const axisTitle = axisLayer.append("text")
    .attr("class", "sfs-axis-label sfs-graph-label")
    .attr("text-anchor", "middle");

  const markerLayer = svg.append("g").attr("aria-hidden", "true");
  function marker(className) {
    const g = markerLayer.append("g").attr("class", className);
    g.append("line").attr("class", "tsq-marker-line");
    g.append("text").attr("class", "tsq-marker-label").attr("text-anchor", "middle");
    return g;
  }
  const leftCritical = marker("tsq-critical");
  const rightCritical = marker("tsq-critical");
  const observed = marker("tsq-observed");
  const leftTailLabel = markerLayer.append("text").attr("class", "tsq-tail-label").attr("text-anchor", "end");
  const rightTailLabel = markerLayer.append("text").attr("class", "tsq-tail-label").attr("text-anchor", "start");
  const landmarkLayer = svg.append("g").attr("aria-hidden", "true");
  const title = svg.append("text").attr("class", "tsq-title");

  const margin = { top: 34, right: 18, bottom: 50, left: 18 };
  let width = finite(opts.width, 640);
  const x = d3.scaleLinear();
  const y = d3.scaleLinear();

  // Denser near 0, where the squared curve climbs steeply.
  const N = 260;
  const uGrid = d3.range(N + 1).map((i) => uMax * Math.pow(i / N, 1.6));
  const tailGrid = d3.range(81).map((i) => crit.t + (uMax - crit.t) * i / 80);

  // One half of the curve. side is +1 for the positive half; the negative half
  // turns over through side = -1 → 1. base lifts it onto the positive half.
  function halfPoints(grid, p, side, stackOn) {
    return grid.map((u) => {
      const h = geometry.halfDensity(u, p, df);
      const top = Number.isFinite(h) ? h : yTop * 10;
      const base = stackOn * top;
      return { x: side * Math.pow(u, p), y0: base, y1: base + top };
    });
  }

  const area = d3.area().x((d) => x(d.x)).y0((d) => y(d.y0)).y1((d) => y(d.y1));
  const line = d3.line().x((d) => x(d.x)).y((d) => y(d.y1));
  const baseLine = d3.line().x((d) => x(d.x)).y((d) => y(d.y0));

  // What the title and axis call the curve. Extending the axis changes
  // nothing about the values, so it is still |t| until they are squared.
  function stageAt(T) {
    const ph = geometry.phases(T);
    if (ph.flip < 0.5) return "t";
    return ph.square < 0.5 ? "fold" : "square";
  }

  function describe(stage) {
    const obs = state.showObserved
      ? (stage === "square"
        ? ` The observed F of ${fF(tObserved * tObserved)} lies beyond it.`
        : ` The observed t of ${fObs(tObserved)} lies beyond it.`)
      : "";
    if (stage === "t") {
      return `Null t distribution with ${df} degrees of freedom, with ${fPercent(alpha / 2)} shaded in each tail beyond ±${fT(crit.t)}.${obs}`;
    }
    if (stage === "fold") {
      const room = state.stage === "extend" ? ` The axis runs to ${fTick(uMax * uMax)}, leaving room for the squared values.` : "";
      return `The t distribution folded at zero, so its two tails lie together beyond ${fT(crit.t)}, ${fPercent(alpha)} in all.${room}${obs}`;
    }
    return `The folded t distribution with its axis squared: the F distribution with 1 and ${df} degrees of freedom, with ${fPercent(alpha)} shaded beyond ${fF(crit.f)}.${obs}`;
  }

  function setValue() {
    rootNode.value = {
      stage: state.stage,
      showObserved: state.showObserved,
      df,
      alpha,
      tCritical: crit.t,
      fCritical: crit.f,
      tObserved,
      fObserved: tObserved === null ? null : tObserved * tObserved,
      p: tObserved === null ? null : geometry.pTwoTailed(tObserved, df)
    };
  }

  function draw(T) {
    const ph = geometry.phases(T);
    const p = 1 + ph.square;
    // A page turning over: its far edge swings through zero.
    const side = -Math.cos(Math.PI * ph.flip);
    // Labels on the turning half fade as it rises edge-on, so its negative
    // numbers never pile up at 0 or land on the positive side.
    const leftFade = Math.max(0, Math.min(1, -side * 1.5));

    const plotHeight = Math.round(Math.max(160, Math.min(250, width * 0.4)));
    const baselineY = margin.top + plotHeight;
    const height = baselineY + margin.bottom;
    const plotLeft = margin.left;
    const plotRight = width - margin.right;
    svg.attr("viewBox", [0, 0, width, height]);
    clipRect.attr("x", plotLeft - 2).attr("y", margin.top).attr("width", plotRight - plotLeft + 4).attr("height", plotHeight + 1);

    x.domain([-uMax * (1 - ph.zoom), uMax + (uMax * uMax - uMax) * ph.extend]).range([plotLeft, plotRight]);
    y.domain([0, yTop]).range([baselineY, margin.top]);

    const right = halfPoints(uGrid, p, 1, 0);
    const left = halfPoints(uGrid, p, side, ph.stack);
    rightHalf.attr("d", area(right));
    leftHalf.attr("d", area(left));
    rightTail.attr("d", area(halfPoints(tailGrid, p, 1, 0)));
    leftTail.attr("d", area(halfPoints(tailGrid, p, side, ph.stack)));
    leftCurve.attr("d", line(left));
    // Once the halves stack, the positive half's own curve is the seam
    // between them: the dashed edge where one 2.5% sits on the other.
    rightCurve
      .attr("d", ph.stack > 0 ? baseLine(left) : line(right))
      .classed("tsq-seam", ph.stack > 0)
      .style("opacity", ph.stack > 0 ? 0.45 : 1);

    baseline.attr("x1", plotLeft).attr("x2", plotRight).attr("y1", baselineY).attr("y2", baselineY);

    // An ordinary ruler: it never moves with the curve. Ticks keep a
    // readable gap, so a wide axis on a phone counts in fives.
    const fitted = d3.ticks(x.domain()[0], x.domain()[1], Math.max(3, Math.floor((plotRight - plotLeft) / 56)));
    const step = fitted.length > 1 ? fitted[1] - fitted[0] : 1;
    const tickValues = d3.range(Math.ceil(x.domain()[0] / step) * step, x.domain()[1] + step / 2, step)
      .map((v) => Math.round(v * 1e6) / 1e6);
    const tickJoin = tickLayer.selectAll("g")
      .data(tickValues, (d) => d)
      .join((enter) => {
        const g = enter.append("g");
        g.append("line").attr("class", "sfs-graph-tick-line").attr("y2", 6);
        g.append("text").attr("class", "sfs-graph-tick-label").attr("y", 9).attr("dy", "0.71em").attr("text-anchor", "middle");
        return g;
      });
    tickJoin.attr("transform", (d) => `translate(${x(d)},${baselineY})`);
    tickJoin.select("text").text((d) => d < 0 ? minus(fTick(-d)) : fTick(d));

    // Landmarks appear once the axis has room and travel when squared:
    // 1 stays put, 2 moves out to 4, 3 to 9.
    const landmarkJoin = landmarkLayer.selectAll("g")
      .data(LANDMARKS, (d) => d)
      .join((enter) => {
        const g = enter.append("g").attr("class", "tsq-landmark");
        g.append("circle").attr("r", 4.5);
        g.append("text").attr("text-anchor", "middle").attr("y", -10);
        return g;
      });
    landmarkJoin
      .attr("transform", (u) => `translate(${x(Math.pow(u, p))},${baselineY})`)
      .style("opacity", ph.extend);
    landmarkJoin.select("text").text((u) => fLandmark(Math.pow(u, p)));

    const stage = stageAt(T);
    axisTitle
      .attr("x", (plotLeft + plotRight) / 2)
      .attr("y", baselineY + 42)
      .text(stage === "t" ? "t statistic" : stage === "fold" ? "|t|" : "F ratio (t²)");
    title
      .attr("x", plotLeft)
      .attr("y", 18)
      .text(stage === "t" ? `t(${df})` : stage === "fold" ? `|t|, df = ${df}` : `F(1, ${df})`);

    const markerTop = margin.top + plotHeight * 0.12;
    function placeMarker(g, value, label, opacity) {
      const px = x(value);
      g.style("opacity", opacity);
      g.select("line").attr("x1", px).attr("x2", px).attr("y1", baselineY).attr("y2", markerTop);
      g.select("text").attr("x", px).attr("y", markerTop - 6).text(label);
    }
    const critValue = Math.pow(crit.t, p);
    const critLabel = ph.square < 0.5 ? fT(critValue) : fF(critValue);
    placeMarker(rightCritical, critValue, ph.flip < 0.5 ? `+${critLabel}` : critLabel, 1);
    placeMarker(leftCritical, side * critValue, minus(critLabel), leftFade);

    if (tObserved !== null) {
      const u = Math.abs(tObserved);
      const v = Math.pow(u, p);
      const onLeft = tObserved < 0;
      const valueX = onLeft ? side * v : v;
      const label = ph.flip < 0.5
        ? `t = ${tObserved < 0 ? minus(fObs(u)) : fObs(u)}`
        : ph.square < 0.5 ? `|t| = ${fObs(v)}` : `F = ${fF(v)}`;
      placeMarker(observed, valueX, label, state.showObserved ? 1 : 0);
    }

    // Each tail's share sits just outside its critical line. After the
    // stack, one label carries both.
    const labelY = (value, stacked) => {
      const h = geometry.halfDensity(crit.t, p, df) * (stacked ? 2 : 1);
      return Math.max(margin.top + 14, y(h) - 10);
    };
    const merged = ph.stack >= 0.5;
    rightTailLabel
      .attr("x", x(critValue) + 6)
      .attr("y", labelY(critValue, merged))
      .text(fPercent(merged ? alpha : alpha / 2));
    leftTailLabel
      .attr("x", x(side * critValue) + (side < 0 ? -6 : 6))
      .attr("text-anchor", side < 0 ? "end" : "start")
      .attr("y", labelY(critValue, false))
      .style("opacity", merged ? 0 : leftFade)
      .text(fPercent(alpha / 2));

    const description = describe(stage);
    svg.attr("aria-label", description);
    svgTitle.text(description);
  }

  function motionAllows(requested) {
    const runtime = window.interactiveRuntime;
    if (runtime && runtime.motion && typeof runtime.motion.shouldAnimate === "function") {
      return runtime.motion.shouldAnimate(requested);
    }
    return requested !== false && !(window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // Time positions of T, so each phase gets its own share of the transition.
  const phaseStarts = PHASE_MS.reduce((acc, ms) => acc.concat(acc[acc.length - 1] + ms), [0]);
  const lastPhase = PHASE_MS.length - 1;
  function timeOf(T) {
    const i = Math.min(lastPhase, Math.floor(T));
    return phaseStarts[i] + (T - i) * PHASE_MS[i];
  }
  function tOfTime(time) {
    for (let i = 0; i <= lastPhase; i += 1) {
      if (time <= phaseStarts[i + 1]) return i + (time - phaseStarts[i]) / PHASE_MS[i];
    }
    return lastPhase + 1;
  }

  let renders = 0;
  let mounted = false;

  function render(animate, from) {
    renders += 1;
    const target = geometry.STAGES[state.stage];
    setValue();
    svg.interrupt();
    const start = from === undefined ? state.T : from;
    if (!animate || start === target) {
      state.T = target;
      draw(target);
      return;
    }
    const t0 = timeOf(start);
    const t1 = timeOf(target);
    svg.transition()
      .duration(Math.abs(t1 - t0))
      .ease(d3.easeCubicInOut)
      .tween("t-squared", () => (k) => {
        state.T = tOfTime(t0 + (t1 - t0) * k);
        draw(state.T);
      });
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  function applyTutorialAction(action) {
    action = action || {};
    if (Object.prototype.hasOwnProperty.call(action, "stage") && geometry.STAGES[action.stage] !== undefined) {
      state.stage = action.stage;
    }
    if (Object.prototype.hasOwnProperty.call(action, "show-observed")) {
      state.showObserved = Boolean(action["show-observed"]) && tObserved !== null;
    }
    const animate = mounted && action.animate !== false && motionAllows(true);
    // A replay runs the whole transformation again from t, so the observed
    // value can be followed from start to end.
    render(animate, animate && action.replay === true ? 0 : undefined);
    notifyValueChange();
  }

  // The runtime cancels motion just before applying each step. Settle at the
  // target unless that step has already started a fresh render.
  rootNode.addEventListener("sfs-if:cancel-transitions", () => {
    const seen = renders;
    window.requestAnimationFrame(() => {
      if (renders === seen) render(false);
    });
  });

  render(false);

  if (window.interactiveFigure && typeof window.interactiveFigure.observeResponsiveLayout === "function") {
    window.interactiveFigure.observeResponsiveLayout({
      root: rootNode,
      container: chartWrap.node(),
      minimumWidth: 240,
      widthStep: 4,
      onLayout(layout) {
        mounted = true;
        const next = Math.round(layout.width);
        if (next === width) return;
        width = next;
        draw(state.T);
      }
    });
  } else {
    mounted = true;
  }

  if (window.interactiveFigure) {
    // No reader controls: the figure is a stepped explanation, and wrap()
    // needs a controls node only to claim the tutorial.
    const controls = root.insert("div", ":first-child").attr("class", "tsq-controls").node();
    window.interactiveFigure.wrap({
      root: rootNode,
      controls,
      label: "t squared controls",
      placement: "callout",
      applyAction: applyTutorialAction,
      startOpen: false
    });
  }

  return rootNode;
};
