spStats = window.sfsStats
spNormalPdf = spStats.normalPdf
spNormalCdf = spStats.normalCdf
spNormalInv = spStats.normalInv
spFiniteNumber = spStats.finiteNumber

sfsInlineMath = function() {
  return window.interactiveFigure.inlineMath.apply(window.interactiveFigure, arguments);
}

// The arithmetic and placement rules behind the power diagram, kept free of
// the DOM so the tests can check them directly. Positions are in pixels.
window.sfsStatisticalPower = (function() {
  function params(state) {
    const se = state.sigma / Math.sqrt(state.n);
    const altMean = state.mu + state.d * state.sigma;
    const zCritical = spNormalInv(1 - (state.twoTailed ? state.alpha / 2 : state.alpha));
    const highCritical = state.mu + zCritical * se;
    const lowCritical = state.twoTailed ? state.mu - zCritical * se : -Infinity;
    const powerLow = spNormalCdf(lowCritical, altMean, se);
    const powerHigh = 1 - spNormalCdf(highCritical, altMean, se);
    const beta = 1 - powerLow - powerHigh;
    return { se, altMean, zCritical, highCritical, lowCritical, beta, power: 1 - beta, powerLow, powerHigh };
  }

  // Both curves and every boundary stay in view whether or not H1 is shown,
  // so revealing the alternative never rescales what the reader has just seen.
  function domain(state, p) {
    const candidates = [state.mu, p.altMean, p.highCritical];
    if (Number.isFinite(p.lowCritical)) candidates.push(p.lowCritical);
    const minCenter = Math.min.apply(null, candidates);
    const maxCenter = Math.max.apply(null, candidates);
    const pad = Math.max(4 * p.se, 0.12 * (maxCenter - minCenter || p.se));
    return [minCenter - pad, maxCenter + pad];
  }

  // Roughly how wide a label is at the shared 13 px tick size, following
  // sfsGraphTickLabelSpacing: about 7 px a character.
  function textWidth(text, charWidth) {
    return String(text).length * (charWidth || 7);
  }

  // As many of a linear scale's round-number ticks as fit side by side.
  // d3 treats the count as a hint and may return half as many again, so the
  // spacing is checked on the ticks it actually returns.
  function readableTicks(scale, format, maxCount, gap) {
    for (let count = maxCount; count > 2; count -= 1) {
      const values = scale.ticks(count);
      const widest = Math.max.apply(null, values.map((value) => textWidth(format(value))));
      const spacing = values.length > 1 ? Math.abs(scale(values[1]) - scale(values[0])) : Infinity;
      if (spacing >= widest + gap) return values;
    }
    return scale.ticks(2);
  }

  // The smallest 1-2-5 step whose neighbouring tick labels are `minPx` apart.
  function niceStep(pxPerUnit, minPx) {
    for (let magnitude = 1; magnitude < 1e6; magnitude *= 10) {
      for (const factor of [1, 2, 5]) {
        if (factor * magnitude * pxPerUnit >= minPx) return factor * magnitude;
      }
    }
    return 1e6;
  }

  // Whole-number z scores (in steps of `step`) about `center`, as raw values.
  function zTickValues(center, se, extent, step) {
    const low = Math.ceil((extent[0] - center) / se / step) * step;
    const high = Math.floor((extent[1] - center) / se / step) * step;
    const values = [];
    for (let z = low; z <= high + 1e-9; z += step) values.push(center + z * se);
    return values;
  }

  // A regular tick label gives way to a boundary label it would touch.
  function clearOf(x, width, blockers, gap) {
    return blockers.every((blocker) =>
      Math.abs(x - blocker.x) >= (width + blocker.width) / 2 + gap);
  }

  // Two labels that would overlap move apart about their midpoint, then shift
  // together to stay within [min, max]. Returns new x positions in input order.
  function separatePair(a, b, gap, min, max) {
    const flip = b.x < a.x;
    const left = Object.assign({}, flip ? b : a);
    const right = Object.assign({}, flip ? a : b);
    const need = (left.width + right.width) / 2 + gap;
    if (right.x - left.x < need) {
      const mid = (left.x + right.x) / 2;
      left.x = mid - need / 2;
      right.x = mid + need / 2;
    }
    const under = min - (left.x - left.width / 2);
    if (under > 0) { left.x += under; right.x += under; }
    const over = right.x + right.width / 2 - max;
    if (over > 0) { left.x -= over; right.x -= over; }
    return flip ? [right.x, left.x] : [left.x, right.x];
  }

  // Where a label box fits inside the area under a curve between `from` and
  // `to`. `top(x)` gives the curve's pixel y and `baseline` the axis; the
  // optional `avoid(x)` is another curve the label must not sit astride.
  // Of the columns where the box fits, the one nearest the region's center of
  // area wins, so the label reads as belonging to the whole region. Returns
  // null when nothing fits: a sliver is left unlabelled, not overprinted.
  function fitRegionLabel(region) {
    const pad = region.pad === undefined ? 3 : region.pad;
    const halfWidth = region.width / 2 + pad;
    const halfHeight = region.height / 2 + pad;
    const step = region.step || 2;
    const lowest = (curve, x) => {
      let y = -Infinity;
      for (let sx = x - halfWidth; sx <= x + halfWidth; sx += 2) y = Math.max(y, curve(sx));
      return y;
    };
    const straddles = (x, y) => {
      for (let sx = x - halfWidth; sx <= x + halfWidth; sx += 2) {
        const curveY = region.avoid(sx);
        if (curveY > y - halfHeight && curveY < y + halfHeight) return true;
      }
      return false;
    };

    let weight = 0;
    let moment = 0;
    for (let sx = region.from; sx <= region.to; sx += step) {
      const h = Math.max(0, region.baseline - region.top(sx));
      weight += h;
      moment += h * sx;
    }
    if (!weight) return null;
    const centroid = moment / weight;

    let best = null;
    for (let x = region.from + halfWidth; x <= region.to - halfWidth; x += step) {
      const room = region.baseline - lowest(region.top, x);
      if (room < 2 * halfHeight) continue;
      let y = region.baseline - Math.max(room * 0.4, halfHeight);
      if (region.avoid && straddles(x, y)) {
        // Try the band beneath both curves, or the band between the other
        // curve and this region's top, whichever is roomier.
        const regionFloor = lowest(region.top, x);
        const avoidCeiling = -lowest((sx) => -region.avoid(sx), x);
        const under = region.baseline - Math.max(regionFloor, lowest(region.avoid, x));
        const between = avoidCeiling - regionFloor;
        if (Math.max(under, between) < 2 * halfHeight) continue;
        y = under >= between
          ? region.baseline - Math.max(under * 0.5, halfHeight)
          : (avoidCeiling + regionFloor) / 2;
      }
      const distance = Math.abs(x - centroid);
      if (!best || distance < best.distance) best = { x, y, distance };
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  return { params, domain, textWidth, readableTicks, niceStep, zTickValues, clearOf, separatePair, fitRegionLabel };
})();

makeStatisticalPowerDiagram = function(opts) {
  opts = opts || {};

  const geometry = window.sfsStatisticalPower;
  // Timings follow the standardization ruler: a new scale rises from just
  // below its slot, an old one fades where it stands, and the rest close up.
  const AXIS_ENTER_MS = 900;
  const AXIS_EXIT_MS = 450;
  const AXIS_MOVE_MS = 700;
  const AXIS_ENTER_OFFSET = 24;
  const NULL_DIM_OPACITY = 0.3;
  const NULL_DIM_MS = 700;
  const AXIS_ROW = 30;
  const AXIS_ORDER = ["raw", "h0", "h1"];
  const SIDE_LABEL_WIDTH = 50;
  const margin = { top: 26, right: SIDE_LABEL_WIDTH + 12, left: 12 };
  const fTick = d3.format("~g");
  const fBoundary = d3.format(".2f");
  const f2 = d3.format(".2f");
  const f0 = d3.format(".0f");
  // APA style: no leading zero on a quantity that cannot exceed 1.
  const fProbability = (value) => d3.format(".3f")(value).replace(/^0\./, ".");
  const fAlpha = (value) => d3.format(".3~f")(value).replace(/^0\./, ".");

  let width = spFiniteNumber(opts.width, 640);

  const state = {
    mu: spFiniteNumber(opts.mu, 50),
    sigma: spFiniteNumber(opts.sigma, 10),
    d: spFiniteNumber(opts.d, 0.60),
    n: spFiniteNumber(opts.n, 20),
    alpha: spFiniteNumber(opts.alpha, 0.05),
    twoTailed: opts.twoTailed === undefined ? true : Boolean(opts.twoTailed),
    showAlt: opts.showAlt === undefined ? true : Boolean(opts.showAlt),
    shadeBeta: opts.shadeBeta === undefined ? true : Boolean(opts.shadeBeta),
    shadePower: opts.shadePower === undefined ? true : Boolean(opts.shadePower),
    dimNull: Boolean(opts.dimNull),
    axisRaw: opts.axisRaw === undefined ? true : Boolean(opts.axisRaw),
    axisZNull: Boolean(opts.axisZNull),
    axisZAlt: Boolean(opts.axisZAlt)
  };

  const root = d3.create("div")
    .attr("class", "statistical-power-diagram sfs-figure")
    .style("--sfs-if-reveal-duration", opts.revealDuration || "980ms");
  const rootNode = root.node();

  root.append("style").text(`
    .statistical-power-diagram {
      --sp-critical-color: var(--sfs-critical-color, #c63f3f);
      --sp-null-color: var(--sfs-null-color, currentColor);
      --sp-alt-color: var(--sfs-power-color, #7654b5);
      --sp-beta-color: var(--sfs-neutral-color, #7b818a);
      --sfs-figure-margin: 1.5rem 0;
    }

    .statistical-power-diagram .sp-group {
      min-width: 0;
    }

    .statistical-power-diagram .sp-group-title {
      margin: 0 0 0.45rem 0;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .statistical-power-diagram .sp-row {
      display: grid;
      grid-template-columns: minmax(4.2rem, auto) minmax(2.8rem, auto) 1fr;
      gap: 0.45rem;
      align-items: center;
      min-height: 1.8rem;
      margin: 0.22rem 0;
      font-size: 0.95rem;
    }

    .statistical-power-diagram .sp-row.sp-row-compact {
      grid-template-columns: minmax(4.2rem, auto) minmax(4rem, 1fr);
    }

    .statistical-power-diagram .sp-check-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      min-height: 1.65rem;
      margin: 0.18rem 0;
      font-size: 0.95rem;
    }

    .statistical-power-diagram .sp-value {
      justify-self: end;
      min-width: 2.7rem;
      font-variant-numeric: tabular-nums;
      color: var(--sfs-muted, var(--bs-secondary-color));
    }

    .statistical-power-diagram input[type="number"] {
      width: 5rem;
    }

    .statistical-power-diagram input[type="range"] {
      width: 100%;
      min-width: 6rem;
    }

    .statistical-power-diagram input[type="checkbox"] {
      width: 1rem;
      height: 1rem;
      flex: 0 0 auto;
    }

    .statistical-power-diagram svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .statistical-power-diagram .sp-key {
      display: flex;
      flex-wrap: wrap;
      gap: 0.2rem 0.9rem;
      margin: 0 0 0.35rem;
      font-size: 0.9rem;
      font-variant-numeric: tabular-nums;
    }

    .statistical-power-diagram .sp-key-item {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      white-space: nowrap;
      transition: opacity var(--sfs-if-reveal-duration, 280ms) ease;
    }

    .statistical-power-diagram .sp-key-item.is-concealed {
      opacity: 0;
      visibility: hidden;
    }

    .statistical-power-diagram .sp-swatch {
      width: 0.85rem;
      height: 0.85rem;
      border: 1.5px solid var(--sp-swatch);
      border-radius: 2px;
      background: color-mix(in srgb, var(--sp-swatch) var(--sp-swatch-mix), transparent);
    }

    .statistical-power-diagram .sp-key-alpha .sp-swatch { --sp-swatch: var(--sp-critical-color); --sp-swatch-mix: 32%; }
    .statistical-power-diagram .sp-key-beta .sp-swatch { --sp-swatch: var(--sp-beta-color); --sp-swatch-mix: 28%; }
    .statistical-power-diagram .sp-key-power .sp-swatch { --sp-swatch: var(--sp-alt-color); --sp-swatch-mix: 46%; }
    .statistical-power-diagram .sp-key-alpha .sp-key-value { color: var(--sp-critical-color); }
    .statistical-power-diagram .sp-key-power .sp-key-value { color: var(--sp-alt-color); }
    .statistical-power-diagram .sp-key-value { font-weight: 700; }

    .statistical-power-diagram .sp-hypothesis-label {
      font-size: 1rem;
      font-weight: 600;
    }

    .statistical-power-diagram .sp-null-label { fill: var(--sp-null-color); }
    .statistical-power-diagram .sp-alt-label { fill: var(--sp-alt-color); }

    .statistical-power-diagram .sp-boundary-chip {
      fill: var(--sfs-bg);
    }

    .statistical-power-diagram .sp-region-label {
      paint-order: stroke;
      stroke: var(--sfs-bg);
      stroke-linejoin: round;
      stroke-width: 3px;
    }

    .statistical-power-diagram .sp-region-label {
      fill: var(--sfs-text);
      font-size: var(--sfs-figure-label-size);
      font-weight: 700;
    }

    .statistical-power-diagram .sp-boundary-line {
      stroke: var(--sp-critical-color);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }

    .statistical-power-diagram .sfs-graph .sp-boundary-label {
      fill: var(--sp-critical-color);
      font-size: var(--sfs-figure-tick-size);
      font-weight: 700;
    }

    .statistical-power-diagram .sp-side-label {
      font-size: var(--sfs-figure-tick-size);
      font-weight: 600;
    }

    .statistical-power-diagram .sfs-graph .sp-axis-raw .sp-side-label { fill: var(--sfs-muted); }

    .statistical-power-diagram .sfs-graph .sp-axis-h0 .sfs-graph-tick-label,
    .statistical-power-diagram .sfs-graph .sp-axis-h0 .sp-side-label {
      fill: var(--sp-null-color);
      font-weight: 600;
    }

    .statistical-power-diagram .sfs-graph .sp-axis-h1 .sfs-graph-tick-label,
    .statistical-power-diagram .sfs-graph .sp-axis-h1 .sp-side-label {
      fill: var(--sp-alt-color);
      font-weight: 600;
    }

    .statistical-power-diagram .sfs-graph .sp-axis-h1 .sfs-graph-domain,
    .statistical-power-diagram .sfs-graph .sp-axis-h1 .sfs-graph-tick-line {
      stroke: var(--sp-alt-color);
    }
  `);

  const controls = root.append("div")
    .attr("class", "sp-controls sfs-control-grid");

  function group(title) {
    const section = controls.append("section")
      .attr("class", "sp-group sfs-control-panel sfs-if-control-panel");
    section.append("p")
      .attr("class", "sp-group-title sfs-control-title")
      .text(title);
    return section;
  }

  function addNumber(parent, labelHtml, value, min, step) {
    const row = parent.append("label")
      .attr("class", "sp-row sp-row-compact sfs-control-row");
    row.append("span").html(labelHtml);
    const input = row.append("input")
      .attr("type", "number")
      .attr("value", value)
      .attr("step", step);
    if (min !== null && min !== undefined) input.attr("min", min);
    return input.node();
  }

  function addSlider(parent, labelHtml, value, min, max, step) {
    const row = parent.append("label")
      .attr("class", "sp-row sfs-control-row");
    row.append("span").html(labelHtml);
    const valueNode = row.append("span")
      .attr("class", "sp-value sfs-readout-value");
    const input = row.append("input")
      .attr("type", "range")
      .attr("min", min)
      .attr("max", max)
      .attr("step", step)
      .attr("value", value)
      .attr("data-prevent-swipe", "");
    return { input: input.node(), value: valueNode };
  }

  function addCheckbox(parent, labelHtml, checked) {
    const row = parent.append("label")
      .attr("class", "sp-check-row sfs-check-row");
    const input = row.append("input")
      .attr("type", "checkbox")
      .property("checked", checked);
    row.append("span").html(labelHtml);
    return input.node();
  }

  const popControls = group("Population characteristics");
  const muInput = addNumber(popControls, "<i>&mu;</i>", state.mu, null, 1);
  const sigmaInput = addNumber(popControls, "<i>&sigma;</i>", state.sigma, 0.01, 1);

  const dataControls = group("Experiment parameters");
  const dControl = addSlider(dataControls, "<i>d</i>", state.d, -2, 2, 0.01);
  const nControl = addSlider(dataControls, "<i>n</i>", state.n, 1, 100, 1);
  const alphaControl = addSlider(dataControls, "<i>&alpha;</i>", state.alpha, 0.01, 0.5, 0.01);
  const twoTailedInput = addCheckbox(dataControls, "Two-tailed", state.twoTailed);
  const seRow = dataControls.append("div")
    .attr("class", "sp-row sp-row-compact sfs-control-row");
  seRow.append("span").html("<i>&sigma;<sub>M</sub></i>");
  const seValue = seRow.append("span")
    .attr("class", "sp-value sfs-readout-value");

  const diagramControls = group("Diagram options");
  const showAltInput = addCheckbox(diagramControls, "Show H<sub>1</sub>", state.showAlt);
  const shadeBetaInput = addCheckbox(diagramControls, "Shade <i>&beta;</i>", state.shadeBeta);
  const shadePowerInput = addCheckbox(diagramControls, "Shade power", state.shadePower);
  const dimNullInput = addCheckbox(diagramControls, "Dim H<sub>0</sub>", state.dimNull);
  diagramControls.append("p")
    .attr("class", "sp-group-title sfs-control-title")
    .style("margin-top", "0.65rem")
    .text("X-axis");
  const axisRawInput = addCheckbox(diagramControls, "Raw scores", state.axisRaw);
  const axisZNullInput = addCheckbox(diagramControls, "H<sub>0</sub> z-scores", state.axisZNull);
  const axisZAltInput = addCheckbox(diagramControls, "H<sub>1</sub> z-scores", state.axisZAlt);

  const chartWrap = root.append("div")
    .attr("class", "sp-chart-wrap sfs-chart-wrap");

  // The key names every shaded color and carries the numbers, so the plot
  // needs no headroom for them and a region too thin to label loses nothing.
  const key = chartWrap.append("div")
    .attr("class", "sp-key")
    .attr("aria-live", "polite")
    .attr("aria-atomic", "true");
  function keyItem(className, labelHtml) {
    const item = key.append("span").attr("class", `sp-key-item ${className}`);
    item.append("span").attr("class", "sp-swatch").attr("aria-hidden", "true");
    item.append("span").html(labelHtml);
    const value = item.append("span").attr("class", "sp-key-value");
    return { item, value };
  }
  const alphaKey = keyItem("sp-key-alpha", "<i>&alpha;</i> =");
  const betaKey = keyItem("sp-key-beta", "<i>&beta;</i> =");
  const powerKey = keyItem("sp-key-power", "Power (1 &minus; <i>&beta;</i>) =");

  const svg = chartWrap.append("svg")
    .attr("class", "sfs-svg sfs-graph")
    .attr("role", "img");
  const svgTitle = svg.append("title");

  const x = d3.scaleLinear();
  const y = d3.scaleLinear();
  const line = d3.line()
    .x((d) => x(d.value))
    .y((d) => y(d.density));
  const area = d3.area()
    .x((d) => x(d.value))
    .y0(() => y(0))
    .y1((d) => y(d.density));

  const fillLayer = svg.append("g");
  const nullLayer = svg.append("g");
  const altLayer = svg.append("g")
    .attr("class", "sfs-if-reveal")
    .style("--sfs-if-reveal-opacity", 1);
  const boundaryLayer = svg.append("g").attr("aria-hidden", "true");
  const axisLayer = svg.append("g");
  const labelLayer = svg.append("g").attr("aria-hidden", "true");

  const nullRejectLeft = fillLayer.append("path")
    .style("fill", "var(--sp-critical-color)")
    .attr("opacity", 0.32);
  const nullRejectRight = fillLayer.append("path")
    .style("fill", "var(--sp-critical-color)")
    .attr("opacity", 0.32);
  const altPowerLeft = fillLayer.append("path")
    .attr("class", "sfs-if-reveal")
    .style("fill", "var(--sp-alt-color)")
    .style("--sfs-if-reveal-opacity", 0.46);
  const altPowerRight = fillLayer.append("path")
    .attr("class", "sfs-if-reveal")
    .style("fill", "var(--sp-alt-color)")
    .style("--sfs-if-reveal-opacity", 0.46);
  const altBetaFill = fillLayer.append("path")
    .attr("class", "sfs-if-reveal")
    .style("fill", "var(--sp-beta-color)")
    .style("--sfs-if-reveal-opacity", 0.28);

  const nullCurve = nullLayer.append("path")
    .attr("fill", "none")
    .style("stroke", "var(--sp-null-color)")
    .attr("stroke-width", 2.25);
  const altCurve = altLayer.append("path")
    .attr("fill", "none")
    .style("stroke", "var(--sp-alt-color)")
    .attr("stroke-width", 2.25);

  const baseline = axisLayer.append("line")
    .attr("class", "sfs-graph-domain");

  function hypothesisLabel(parent, className, digit) {
    return parent.append("text")
      .attr("class", `sp-hypothesis-label ${className}`)
      .attr("text-anchor", "middle")
      .html(`H<tspan baseline-shift="sub" font-size="70%">${digit}</tspan>`);
  }
  const nullLabel = hypothesisLabel(labelLayer, "sp-null-label", 0);
  const altLabelLayer = labelLayer.append("g")
    .attr("class", "sfs-if-reveal")
    .style("--sfs-if-reveal-opacity", 1);
  const altLabel = hypothesisLabel(altLabelLayer, "sp-alt-label", 1);
  // Each region's label is revealed with its shading.
  const regionLabelLayer = () => labelLayer.append("g")
    .attr("class", "sfs-if-reveal")
    .style("--sfs-if-reveal-opacity", 1);
  const betaLabelLayer = regionLabelLayer();
  const powerLabelLayer = regionLabelLayer();
  const betaLabel = betaLabelLayer.append("text")
    .attr("class", "sp-region-label")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .html("<tspan font-style=\"italic\">&beta;</tspan>");
  const powerLabel = powerLabelLayer.append("text")
    .attr("class", "sp-region-label")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .html("1 &minus; <tspan font-style=\"italic\">&beta;</tspan>");

  // Each ruler: the raw sample-mean scale, and z scales centered on each
  // hypothesis. Visible rulers pack upward from the baseline in this order.
  const axes = {};
  [
    { name: "raw", side: "(<tspan font-style=\"italic\">M</tspan>)" },
    { name: "h0", side: "(<tspan font-style=\"italic\">z</tspan>, H<tspan baseline-shift=\"sub\" font-size=\"70%\">0</tspan>)" },
    { name: "h1", side: "(<tspan font-style=\"italic\">z</tspan>, H<tspan baseline-shift=\"sub\" font-size=\"70%\">1</tspan>)" }
  ].forEach((spec) => {
    const g = axisLayer.append("g")
      .attr("class", `sp-axis sp-axis-${spec.name} sfs-graph-axis`)
      .style("opacity", 0)
      .attr("aria-hidden", "true");
    const ticks = g.append("g");
    const boundaries = g.append("g");
    const side = g.append("text")
      .attr("class", "sp-side-label")
      .attr("y", 4)
      .attr("text-anchor", "start")
      .html(spec.side);
    axes[spec.name] = { g, ticks, boundaries, side, row: null, visible: false };
  });

  const boundaryLines = boundaryLayer.selectAll("line")
    .data([0, 1])
    .join("line")
      .attr("class", "sp-boundary-line");

  let boundaryBottom = null;

  function readState() {
    state.mu = spFiniteNumber(muInput.value, state.mu);
    state.sigma = Math.max(0.01, spFiniteNumber(sigmaInput.value, state.sigma));
    state.d = spFiniteNumber(dControl.input.value, state.d);
    state.n = Math.max(1, Math.round(spFiniteNumber(nControl.input.value, state.n)));
    state.alpha = Math.max(0.001, Math.min(0.999, spFiniteNumber(alphaControl.input.value, state.alpha)));
    state.twoTailed = twoTailedInput.checked;
    state.showAlt = showAltInput.checked;
    state.shadeBeta = shadeBetaInput.checked;
    state.shadePower = shadePowerInput.checked;
    state.dimNull = dimNullInput.checked;
    state.axisRaw = axisRawInput.checked;
    state.axisZNull = axisZNullInput.checked;
    state.axisZAlt = axisZAltInput.checked;
  }

  function curveData(mean, se, domain, steps) {
    const dx = (domain[1] - domain[0]) / steps;
    return d3.range(steps + 1).map((i) => {
      const value = domain[0] + i * dx;
      return { value, density: spNormalPdf(value, mean, se) };
    });
  }

  function segmentData(mean, se, from, to, domain) {
    const lo = Math.max(Number.isFinite(from) ? from : domain[0], domain[0]);
    const hi = Math.min(Number.isFinite(to) ? to : domain[1], domain[1]);
    if (hi <= lo) return [];
    const steps = Math.max(8, Math.ceil((hi - lo) / (domain[1] - domain[0]) * 240));
    const dx = (hi - lo) / steps;
    return d3.range(steps + 1).map((i) => {
      const value = lo + i * dx;
      return { value, density: spNormalPdf(value, mean, se) };
    });
  }

  function drawArea(path, data) {
    path.attr("d", data.length > 1 ? area(data) : null);
  }

  function setValue(p, domain) {
    rootNode.value = {
      mu: state.mu,
      sigma: state.sigma,
      d: state.d,
      effectSize: state.d,
      n: state.n,
      alpha: state.alpha,
      twoTailed: state.twoTailed,
      showAlt: state.showAlt,
      shadeBeta: state.shadeBeta,
      shadePower: state.shadePower,
      dimNull: state.dimNull,
      axisRaw: state.axisRaw,
      axisZNull: state.axisZNull,
      axisZAlt: state.axisZAlt,
      se: p.se,
      standardError: p.se,
      altMean: p.altMean,
      zCritical: p.zCritical,
      criticalZ: p.zCritical,
      criticalZHigh: p.zCritical,
      criticalZLow: state.twoTailed ? -p.zCritical : null,
      highCritical: p.highCritical,
      lowCritical: p.lowCritical,
      criticalMeanHigh: p.highCritical,
      criticalMeanLow: state.twoTailed ? p.lowCritical : null,
      beta: p.beta,
      power: p.power,
      domain: domain.slice()
    };
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  function motionAllows(requested) {
    const runtime = window.interactiveRuntime;
    if (runtime && runtime.motion && typeof runtime.motion.shouldAnimate === "function") {
      return runtime.motion.shouldAnimate(requested);
    }
    return requested !== false && !(window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function styleAxis(g) {
    g.selectAll(".tick text").attr("class", "sfs-graph-tick-label");
    g.selectAll(".tick line").attr("class", "sfs-graph-tick-line");
    g.selectAll(".domain").attr("class", "domain sfs-graph-domain");
  }

  // Draws one ruler's ticks. Each critical boundary is labelled in this
  // ruler's own units, and regular tick labels that would touch one give way.
  function drawAxis(axis, spec, boundaryValues, plotLeft, plotRight) {
    const tickWidth = d3.max(spec.values, (value) => geometry.textWidth(spec.format(value))) || 0;
    const blockers = boundaryValues.map((value) => ({
      x: x(value),
      width: geometry.textWidth(fBoundary(spec.toUnits(value)))
    }));
    if (blockers.length === 2) {
      const placed = geometry.separatePair(blockers[0], blockers[1], 4, plotLeft, plotRight);
      blockers[0].x = placed[0];
      blockers[1].x = placed[1];
    }

    axis.ticks.call(d3.axisBottom(x)
      .tickValues(spec.values)
      .tickFormat(spec.format)
      .tickSizeOuter(0));
    styleAxis(axis.ticks);
    axis.ticks.selectAll(".tick text")
      .style("display", (value) => geometry.clearOf(x(value), tickWidth, blockers, 6) ? null : "none");

    // Each label sits on a chip of page color, so the boundary line reads as
    // passing behind it on the way down to the next ruler.
    const labels = axis.boundaries.selectAll("g")
      .data(boundaryValues.map((value, i) => ({
        x: blockers[i].x,
        width: blockers[i].width,
        text: fBoundary(spec.toUnits(value))
      })))
      .join((enter) => {
        const g = enter.append("g");
        g.append("rect").attr("class", "sp-boundary-chip");
        g.append("text").attr("class", "sp-boundary-label");
        return g;
      });
    labels.select("rect")
      .attr("x", (d) => d.x - d.width / 2 - 4)
      .attr("y", 7)
      .attr("width", (d) => d.width + 8)
      .attr("height", 17)
      .attr("rx", 3);
    labels.select("text")
      .attr("x", (d) => d.x)
      .attr("y", 9)
      .attr("dy", "0.71em")
      .attr("text-anchor", "middle")
      .text((d) => d.text);
  }

  function axisSpecs(p, domain) {
    const unitPx = Math.abs(x(state.mu + p.se) - x(state.mu));
    const zSpec = (center) => {
      const step = geometry.niceStep(unitPx, geometry.textWidth("−88") + 12);
      return {
        values: geometry.zTickValues(center, p.se, domain, step),
        format: (value) => f0((value - center) / p.se),
        toUnits: (value) => (value - center) / p.se
      };
    };
    return {
      raw: { values: geometry.readableTicks(x, fTick, 10, 14), format: fTick, toUnits: (value) => value },
      h0: zSpec(state.mu),
      h1: zSpec(p.altMean)
    };
  }

  // Moves the rulers to their slots. Leaving rulers fade first and those
  // staying close up next. A newcomer rises from just below when it joins
  // the bottom of the stack; when others are moving out of its way, it fades
  // in where it lands as they clear it.
  function placeAxes(rowY, baselineY, animate) {
    const shown = { raw: state.axisRaw, h0: state.axisZNull, h1: state.axisZAlt };
    let nextRow = 0;
    const plan = AXIS_ORDER.map((name) => {
      const axis = axes[name];
      const row = shown[name] ? nextRow++ : null;
      const kind = row === null
        ? (axis.visible ? "exit" : "hidden")
        : (!axis.visible ? "enter" : axis.row !== row ? "move" : "stay");
      return { name, axis, row, kind };
    });
    const has = (kind) => plan.some((item) => item.kind === kind);
    const moveDelay = has("exit") ? AXIS_EXIT_MS * 0.6 : 0;
    const rise = !has("move");
    const enterDelay = moveDelay + (rise ? 0 : AXIS_MOVE_MS * 0.35);

    plan.forEach(({ axis, row, kind }) => {
      const g = axis.g.interrupt();
      const targetY = row === null ? (axis.row === null ? rowY(0) : rowY(axis.row)) : rowY(row);
      g.attr("aria-hidden", String(row === null));
      if (!animate || kind === "hidden" || kind === "stay") {
        g.attr("transform", `translate(0, ${targetY})`)
          .style("opacity", row === null ? 0 : 1);
      } else if (kind === "exit") {
        g.transition().duration(AXIS_EXIT_MS).ease(d3.easeCubicOut)
          .style("opacity", 0);
      } else if (kind === "move") {
        g.transition().delay(moveDelay).duration(AXIS_MOVE_MS).ease(d3.easeCubicInOut)
          .attr("transform", `translate(0, ${targetY})`)
          .style("opacity", 1);
      } else {
        g.attr("transform", `translate(0, ${targetY + (rise ? AXIS_ENTER_OFFSET : 0)})`)
          .transition().delay(enterDelay).duration(AXIS_ENTER_MS).ease(d3.easeCubicOut)
          .attr("transform", `translate(0, ${targetY})`)
          .style("opacity", 1);
      }
      if (row !== null) axis.row = row;
      axis.visible = row !== null;
    });

    // The boundary lines run down through every ruler on show, so each
    // boundary can be read off all of them at once.
    const bottom = nextRow ? rowY(nextRow - 1) : baselineY;
    const lines = boundaryLines.interrupt();
    if (!animate || boundaryBottom === null || bottom === boundaryBottom) {
      lines.attr("y2", bottom);
    } else if (bottom > boundaryBottom) {
      lines.transition()
        .delay(has("enter") && rise ? enterDelay : moveDelay)
        .duration(has("enter") && rise ? AXIS_ENTER_MS : AXIS_MOVE_MS)
        .ease(d3.easeCubicOut)
        .attr("y2", bottom);
    } else {
      lines.transition().delay(moveDelay).duration(AXIS_MOVE_MS).ease(d3.easeCubicInOut)
        .attr("y2", bottom);
    }
    boundaryBottom = bottom;
  }

  function placeLabels(p, domain, plotLeft, plotRight, baselineY) {
    const peakY = y(spNormalPdf(state.mu, state.mu, p.se));
    const labelWidth = 22;
    const nullX = x(state.mu);
    const altX = x(p.altMean);
    // Close means would stack H0 and H1 on one another; they part just
    // enough to read. H0 only makes room once H1 is on show.
    const placed = state.showAlt
      ? geometry.separatePair({ x: nullX, width: labelWidth }, { x: altX, width: labelWidth }, 6, plotLeft, plotRight)
      : [nullX, altX];
    nullLabel.attr("x", placed[0]).attr("y", peakY - 8);
    altLabel.attr("x", placed[1]).attr("y", peakY - 8);

    const altTop = (px) => y(spNormalPdf(x.invert(px), p.altMean, p.se));
    const nullTop = (px) => y(spNormalPdf(x.invert(px), state.mu, p.se));
    // Measured when the browser can lay the text out; estimated otherwise.
    const widthOf = (label) => {
      label.style("display", null);
      const node = label.node();
      const measured = typeof node.getComputedTextLength === "function" ? node.getComputedTextLength() : 0;
      return measured > 0 ? measured : geometry.textWidth(node.textContent, 8);
    };
    const place = (label, from, to) => {
      const spot = geometry.fitRegionLabel({
        from: x(Math.max(from, domain[0])),
        to: x(Math.min(to, domain[1])),
        top: altTop,
        avoid: nullTop,
        baseline: baselineY,
        width: widthOf(label),
        height: 15
      });
      label
        .style("display", spot ? null : "none")
        .attr("x", spot ? spot.x : 0)
        .attr("y", spot ? spot.y : 0);
    };

    place(betaLabel, p.lowCritical, p.highCritical);
    // Power is labelled in whichever rejection tail holds more of it.
    if (p.powerLow > p.powerHigh) place(powerLabel, -Infinity, p.lowCritical);
    else place(powerLabel, p.highCritical, Infinity);
  }

  function describe(p) {
    const boundaries = [p.lowCritical, p.highCritical].filter(Number.isFinite).map(f2);
    const parts = [
      `Sampling distribution of the mean under H0, centered on ${fTick(state.mu)} with standard error ${f2(p.se)}.`,
      `Critical ${boundaries.length > 1 ? "boundaries" : "boundary"} at ${boundaries.join(" and ")}.`
    ];
    if (state.showAlt) {
      const areas = [
        state.shadeBeta ? `beta ${fProbability(p.beta)}` : null,
        state.shadePower ? `power ${fProbability(p.power)}` : null
      ].filter(Boolean);
      parts.push(`Under H1, centered on ${f2(p.altMean)}${areas.length ? `: ${areas.join(", ")}` : ""}.`);
    }
    return parts.join(" ");
  }

  let renders = 0;

  function render(animate) {
    renders += 1;
    const p = geometry.params(state);
    const domain = geometry.domain(state, p);
    setValue(p, domain);

    const plotHeight = Math.round(Math.max(140, Math.min(240, width * 0.34)));
    const baselineY = margin.top + plotHeight;
    const rowY = (row) => baselineY + row * AXIS_ROW;
    // Room for two rulers, which is all the tutorial ever shows; a third
    // switched on from the controls adds its own row.
    const rulers = [state.axisRaw, state.axisZNull, state.axisZAlt].filter(Boolean).length;
    const height = rowY(Math.max(2, rulers) - 1) + 26;
    const plotLeft = margin.left;
    const plotRight = width - margin.right;

    svg.attr("viewBox", [0, 0, width, height]);
    x.domain(domain).range([plotLeft, plotRight]);
    y.domain([0, spNormalPdf(state.mu, state.mu, p.se)]).range([baselineY, margin.top]);

    dControl.value.text(f2(state.d));
    nControl.value.text(f0(state.n));
    alphaControl.value.text(f2(state.alpha));
    seValue.text(f2(p.se));
    alphaKey.value.text(fAlpha(state.alpha));
    betaKey.value.text(fProbability(p.beta));
    powerKey.value.text(fProbability(p.power));
    const showBeta = state.showAlt && state.shadeBeta;
    const showPower = state.showAlt && state.shadePower;
    [[betaKey, showBeta], [powerKey, showPower]].forEach(([entry, shown]) => entry.item
      .classed("is-concealed", !shown)
      .attr("aria-hidden", String(!shown)));

    const description = describe(p);
    svg.attr("aria-label", description);
    svgTitle.text(description);

    nullCurve.attr("d", line(curveData(state.mu, p.se, domain, 320)));
    altCurve.attr("d", line(curveData(p.altMean, p.se, domain, 320)));
    drawArea(nullRejectLeft, state.twoTailed ? segmentData(state.mu, p.se, domain[0], p.lowCritical, domain) : []);
    drawArea(nullRejectRight, segmentData(state.mu, p.se, p.highCritical, domain[1], domain));
    drawArea(altPowerLeft, state.twoTailed ? segmentData(p.altMean, p.se, domain[0], p.lowCritical, domain) : []);
    drawArea(altPowerRight, segmentData(p.altMean, p.se, p.highCritical, domain[1], domain));
    drawArea(altBetaFill, segmentData(p.altMean, p.se, p.lowCritical, p.highCritical, domain));

    baseline.attr("x1", plotLeft).attr("x2", plotRight).attr("y1", baselineY).attr("y2", baselineY);

    const boundaryValues = [p.lowCritical, p.highCritical].filter(Number.isFinite);
    const boundaryX = (d, i) => x(i < boundaryValues.length ? boundaryValues[i] : domain[0]);
    boundaryLines
      .style("display", (d, i) => i < boundaryValues.length ? null : "none")
      .attr("x1", boundaryX)
      .attr("x2", boundaryX)
      .attr("y1", baselineY - plotHeight * 0.85);

    const specs = axisSpecs(p, domain);
    AXIS_ORDER.forEach((name) => {
      drawAxis(axes[name], specs[name], boundaryValues, plotLeft, plotRight);
      axes[name].side.attr("x", plotRight + 10);
    });
    placeAxes(rowY, baselineY, animate);
    placeLabels(p, domain, plotLeft, plotRight, baselineY);

    // Dimming H0 hands the reader's attention to H1; the critical regions
    // and boundaries keep full strength because the decision rule still holds.
    const nullOpacity = state.dimNull ? NULL_DIM_OPACITY : 1;
    [nullLayer, nullLabel].forEach((selection) => {
      selection.interrupt();
      if (animate) {
        selection.transition().duration(NULL_DIM_MS).ease(d3.easeCubicInOut).style("opacity", nullOpacity);
      } else {
        selection.style("opacity", nullOpacity);
      }
    });

    [
      [[altLayer, altLabelLayer], state.showAlt],
      [[altBetaFill, betaLabelLayer], showBeta],
      [[altPowerLeft, altPowerRight, powerLabelLayer], showPower]
    ].forEach(([targets, visible]) => {
      if (window.interactiveFigure && window.interactiveFigure.setRevealVisible) {
        window.interactiveFigure.setRevealVisible(targets, visible, { root: rootNode, animate });
      } else {
        targets.forEach((selection) => selection
          .classed("is-visible", visible)
          .attr("aria-hidden", String(!visible)));
      }
    });
  }

  function actionKey(key) {
    return String(key).trim().toLowerCase().replace(/[\s_]+/g, "-");
  }

  function actionNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function actionBoolean(value) {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
      if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
    }

    return Boolean(value);
  }

  function setNumericAction(input, value) {
    const n = actionNumber(value);
    if (n === null) return false;
    input.value = String(n);
    return true;
  }

  function setBooleanAction(input, value) {
    input.checked = actionBoolean(value);
    return true;
  }

  let suppressAnimation = false;

  function applyTutorialAction(action, context) {
    let changed = false;

    Object.entries(action || {}).forEach(([key, value]) => {
      switch (actionKey(key)) {
        case "animate":
          suppressAnimation = !actionBoolean(value);
          break;
        case "mu":
        case "mean":
        case "population-mean":
          changed = setNumericAction(muInput, value) || changed;
          break;
        case "sigma":
        case "sd":
        case "standard-deviation":
        case "population-sd":
          changed = setNumericAction(sigmaInput, value) || changed;
          break;
        case "d":
        case "effect-size":
        case "effectsize":
          changed = setNumericAction(dControl.input, value) || changed;
          break;
        case "n":
        case "sample-size":
        case "samplesize":
          changed = setNumericAction(nControl.input, value) || changed;
          break;
        case "alpha":
          changed = setNumericAction(alphaControl.input, value) || changed;
          break;
        case "two-tailed":
        case "twotailed":
          changed = setBooleanAction(twoTailedInput, value) || changed;
          break;
        case "show-h1":
        case "show-alt":
        case "show-alternative":
          changed = setBooleanAction(showAltInput, value) || changed;
          break;
        case "shade-beta":
        case "beta":
          changed = setBooleanAction(shadeBetaInput, value) || changed;
          break;
        case "shade-power":
        case "power":
          changed = setBooleanAction(shadePowerInput, value) || changed;
          break;
        case "dim-h0":
        case "dim-null":
          changed = setBooleanAction(dimNullInput, value) || changed;
          break;
        case "raw-scores":
        case "rawscores":
        case "axis-raw":
          changed = setBooleanAction(axisRawInput, value) || changed;
          break;
        case "h0-z":
        case "h0-z-scores":
        case "null-z":
        case "axis-z-null":
          changed = setBooleanAction(axisZNullInput, value) || changed;
          break;
        case "h1-z":
        case "h1-z-scores":
        case "alternative-z":
        case "axis-z-alt":
          changed = setBooleanAction(axisZAltInput, value) || changed;
          break;
        case "controls-open":
        case "controls":
          if (context && typeof context.setControlsOpen === "function") {
            context.setControlsOpen(actionBoolean(value));
          }
          break;
        default:
          break;
      }
    });

    if (changed) update(true);
  }

  let mounted = false;

  function update(notify) {
    // Nothing animates before the figure is on the page, nor when a step
    // or the reader's motion setting says not to.
    const animate = mounted && !suppressAnimation && motionAllows(true);
    suppressAnimation = false;
    readState();
    render(animate);
    if (notify) notifyValueChange();
  }

  [
    muInput,
    sigmaInput,
    dControl.input,
    nControl.input,
    alphaControl.input,
    twoTailedInput,
    showAltInput,
    shadeBetaInput,
    shadePowerInput,
    dimNullInput,
    axisRawInput,
    axisZNullInput,
    axisZAltInput
  ].forEach((input) => input.addEventListener("input", (event) => {
    event.stopPropagation();
    update(true);
  }));

  // Cancelling motion interrupts the rulers wherever they are, so settle
  // them, unless a tutorial step has already started a fresh render: the
  // runtime cancels just before applying each step.
  rootNode.addEventListener("sfs-if:cancel-transitions", () => {
    const seen = renders;
    window.requestAnimationFrame(() => {
      if (renders === seen) render(false);
    });
  });

  update(false);

  // Redraw at the width the figure actually gets, so tick labels keep the
  // stylesheet's size on a phone instead of shrinking with a scaled viewBox.
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
        render(false);
      }
    });
  } else {
    mounted = true;
  }

  if (window.interactiveFigure) {
    window.interactiveFigure.wrap({
      root: rootNode,
      controls: controls.node(),
      label: "statistical power controls",
      placement: opts.controlsPlacement || "callout",
      layout: opts.controlsLayout || "quarter-half-quarter",
      applyAction: applyTutorialAction,
      startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
    });
  }

  return rootNode;
}
