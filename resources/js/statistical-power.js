spStats = window.sfsStats
spNormalPdf = spStats.normalPdf
spNormalCdf = spStats.normalCdf
spNormalInv = spStats.normalInv
spFiniteNumber = spStats.finiteNumber

sfsInlineMath = function() {
  return window.interactiveFigure.inlineMath.apply(window.interactiveFigure, arguments);
}

makeStatisticalPowerDiagram = function(opts) {
  opts = opts || {};

  const width = opts.width || 640;
  const height = opts.height || 440;
  const margin = { top: 26, right: 24, bottom: 116, left: 58 };
  const plotBottom = height - margin.bottom;
  const f2 = d3.format(".2f");
  const f0 = d3.format(".0f");
  const fx = d3.format(".1f");

  const state = {
    mu: spFiniteNumber(opts.mu, 50),
    sigma: spFiniteNumber(opts.sigma, 10),
    d: spFiniteNumber(opts.d, 0.60),
    n: spFiniteNumber(opts.n, 20),
    alpha: spFiniteNumber(opts.alpha, 0.05),
    twoTailed: opts.twoTailed === undefined ? true : Boolean(opts.twoTailed),
    showAlt: opts.showAlt === undefined ? true : Boolean(opts.showAlt),
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
      --sp-null-color: var(--sfs-danger-color, #c63f3f);
      --sp-alt-color: var(--sfs-comparison-color, #2f6f9f);
      --sp-beta-color: var(--sfs-neutral-color, #7b818a);
      --sp-power-color: var(--sp-alt-color);
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

    .statistical-power-diagram .sp-chart-wrap {
      position: relative;
      overflow: visible;
    }

    .statistical-power-diagram svg {
      display: block;
      width: 100%;
      height: auto;
    }

    .statistical-power-diagram .sp-readout {
      position: absolute;
      top: 0.8rem;
      left: 0.9rem;
      display: grid;
      grid-template-columns: auto auto;
      column-gap: 0.45rem;
      row-gap: 0.1rem;
      padding: 0.35rem 0.45rem;
      border-radius: 6px;
      background: color-mix(in srgb, var(--sfs-bg, var(--bs-body-bg)) 88%, transparent);
      font-size: 1rem;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
    }

    .statistical-power-diagram .sp-readout[aria-hidden="true"] {
      visibility: hidden;
    }

    .statistical-power-diagram .sp-beta-value {
      color: var(--sp-beta-color);
    }

    .statistical-power-diagram .sp-power-value {
      color: var(--sp-power-color);
    }

    .statistical-power-diagram .sp-axis {
      color: var(--sfs-text, var(--bs-body-color));
    }

    .statistical-power-diagram .sp-axis text {
      fill: currentColor;
      font-size: 20px;
      font-weight: 500;
    }

    .statistical-power-diagram .sp-axis path,
    .statistical-power-diagram .sp-axis line {
      stroke: currentColor;
      vector-effect: non-scaling-stroke;
    }

    .statistical-power-diagram svg path {
      vector-effect: non-scaling-stroke;
    }

    .statistical-power-diagram .sp-null-axis {
      color: var(--sp-null-color);
    }

    .statistical-power-diagram .sp-alt-axis {
      color: var(--sp-alt-color);
    }

    .statistical-power-diagram .sp-axis-label {
      font-size: 20px;
      font-weight: 700;
      fill: currentColor;
    }

    @media (max-width: 760px) {
      .statistical-power-diagram .sp-readout {
        position: static;
        margin: 0 0 0.5rem 0;
        width: fit-content;
      }
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
  diagramControls.append("p")
    .attr("class", "sp-group-title sfs-control-title")
    .style("margin-top", "0.65rem")
    .text("X-axis");
  const axisRawInput = addCheckbox(diagramControls, "Raw scores", state.axisRaw);
  const axisZNullInput = addCheckbox(diagramControls, "H<sub>0</sub> z-scores", state.axisZNull);
  const axisZAltInput = addCheckbox(diagramControls, "H<sub>1</sub> z-scores", state.axisZAlt);

  const chartWrap = root.append("div")
    .attr("class", "sp-chart-wrap sfs-chart-wrap");

  const readout = chartWrap.append("div")
    .attr("class", "sp-readout sfs-readout");
  readout.append("span").html("&beta; =");
  const betaValue = readout.append("span")
    .attr("class", "sp-beta-value");
  readout.append("span").text("Power:");
  const powerValue = readout.append("span")
    .attr("class", "sp-power-value");

  const svg = chartWrap.append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("class", "sfs-svg sfs-graph")
    .attr("role", "img");

  const x = d3.scaleLinear().range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().range([plotBottom, margin.top]);
  const line = d3.line()
    .x((d) => x(d.value))
    .y((d) => y(d.density));
  const area = d3.area()
    .x((d) => x(d.value))
    .y0(y(0))
    .y1((d) => y(d.density));

  const fillLayer = svg.append("g");
  const nullLayer = svg.append("g");
  const altLayer = svg.append("g")
    .attr("class", "sfs-if-reveal")
    .style("--sfs-if-reveal-opacity", 1);
  const axisLayer = svg.append("g");

  const nullRejectLeft = fillLayer.append("path")
    .style("fill", "var(--sp-null-color)")
    .attr("opacity", 0.32);
  const nullRejectRight = fillLayer.append("path")
    .style("fill", "var(--sp-null-color)")
    .attr("opacity", 0.32);
  const altPowerLeft = fillLayer.append("path")
    .attr("class", "sfs-if-reveal")
    .style("fill", "var(--sp-power-color)")
    .style("--sfs-if-reveal-opacity", 0.46);
  const altPowerRight = fillLayer.append("path")
    .attr("class", "sfs-if-reveal")
    .style("fill", "var(--sp-power-color)")
    .style("--sfs-if-reveal-opacity", 0.46);
  const altBetaFill = fillLayer.append("path")
    .attr("class", "sfs-if-reveal")
    .style("fill", "var(--sp-beta-color)")
    .style("--sfs-if-reveal-opacity", 0.28);

  const nullCurve = nullLayer.append("path")
    .attr("fill", "none")
    .attr("stroke", "currentColor")
    .attr("stroke-width", 2.25);
  const altCurve = altLayer.append("path")
    .attr("fill", "none")
    .style("stroke", "var(--sp-alt-color)")
    .attr("stroke-width", 2.25);

  const nullLabel = nullLayer.append("text")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 24)
    .attr("fill", "currentColor")
    .html("H<tspan baseline-shift='sub' font-size='14'>0</tspan>");

  const altLabel = altLayer.append("text")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 24)
    .style("fill", "var(--sp-alt-color)")
    .html("H<tspan baseline-shift='sub' font-size='14'>1</tspan>");

  const rawAxis = axisLayer.append("g")
    .attr("class", "sp-axis sfs-axis sfs-graph-axis")
    .attr("transform", `translate(0, ${plotBottom})`);
  const h0Axis = axisLayer.append("g")
    .attr("class", "sp-axis sfs-axis sfs-graph-axis sp-null-axis")
    .attr("transform", `translate(0, ${plotBottom + 38})`);
  const h1Axis = axisLayer.append("g")
    .attr("class", "sp-axis sfs-axis sfs-graph-axis sp-alt-axis")
    .attr("transform", `translate(0, ${plotBottom + 76})`);

  rawAxis.append("text")
    .attr("class", "sp-axis-label sfs-axis-label")
    .attr("x", margin.left - 8)
    .attr("y", 24)
    .attr("text-anchor", "end")
    .text("Raw");
  h0Axis.append("text")
    .attr("class", "sp-axis-label sfs-axis-label")
    .attr("x", margin.left - 8)
    .attr("y", 24)
    .attr("text-anchor", "end")
    .text("H0 z");
  h1Axis.append("text")
    .attr("class", "sp-axis-label sfs-axis-label")
    .attr("x", margin.left - 8)
    .attr("y", 24)
    .attr("text-anchor", "end")
    .text("H1 z");

  function readState() {
    state.mu = spFiniteNumber(muInput.value, state.mu);
    state.sigma = Math.max(0.01, spFiniteNumber(sigmaInput.value, state.sigma));
    state.d = spFiniteNumber(dControl.input.value, state.d);
    state.n = Math.max(1, Math.round(spFiniteNumber(nControl.input.value, state.n)));
    state.alpha = Math.max(0.001, Math.min(0.999, spFiniteNumber(alphaControl.input.value, state.alpha)));
    state.twoTailed = twoTailedInput.checked;
    state.showAlt = showAltInput.checked;
    state.axisRaw = axisRawInput.checked;
    state.axisZNull = axisZNullInput.checked;
    state.axisZAlt = axisZAltInput.checked;
  }

  function params() {
    const se = state.sigma / Math.sqrt(state.n);
    const altMean = state.mu + state.d * state.sigma;
    const zCritical = spNormalInv(1 - (state.twoTailed ? state.alpha / 2 : state.alpha));
    const highCritical = state.mu + zCritical * se;
    const lowCritical = state.twoTailed ? state.mu - zCritical * se : -Infinity;
    const beta = spNormalCdf(highCritical, altMean, se) - spNormalCdf(lowCritical, altMean, se);
    const power = 1 - beta;
    return { se, altMean, zCritical, highCritical, lowCritical, beta, power };
  }

  function domainFor(p) {
    const candidates = [state.mu, p.altMean, p.highCritical];
    if (Number.isFinite(p.lowCritical)) candidates.push(p.lowCritical);
    const minCenter = d3.min(candidates);
    const maxCenter = d3.max(candidates);
    const pad = Math.max(4 * p.se, 0.12 * (maxCenter - minCenter || p.se));
    return [minCenter - pad, maxCenter + pad];
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

  let suppressAltAnimation = false;

  function applyTutorialAction(action, context) {
    let changed = false;

    Object.entries(action || {}).forEach(([key, value]) => {
      switch (actionKey(key)) {
        case "animate":
          suppressAltAnimation = !actionBoolean(value);
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

  function update(notify) {
    const noAltAnimation = suppressAltAnimation;
    suppressAltAnimation = false;

    readState();
    const p = params();
    const domain = domainFor(p);
    setValue(p, domain);

    x.domain(domain);
    y.domain([0, spNormalPdf(state.mu, state.mu, p.se) * 1.12]);

    dControl.value.text(f2(state.d));
    nControl.value.text(f0(state.n));
    alphaControl.value.text(f2(state.alpha));
    seValue.text(f2(p.se));
    betaValue.text(f2(p.beta));
    powerValue.text(f2(p.power));
    readout.attr("aria-hidden", String(!state.showAlt));

    const nullData = curveData(state.mu, p.se, domain, 320);
    const altData = curveData(p.altMean, p.se, domain, 320);
    nullCurve.attr("d", line(nullData));
    altCurve.attr("d", line(altData));
    nullLabel.attr("x", x(state.mu)).attr("y", height * 0.44);
    altLabel.attr("x", x(p.altMean)).attr("y", height * 0.44);

    drawArea(nullRejectLeft, state.twoTailed ? segmentData(state.mu, p.se, domain[0], p.lowCritical, domain) : []);
    drawArea(nullRejectRight, segmentData(state.mu, p.se, p.highCritical, domain[1], domain));
    drawArea(altPowerLeft, state.twoTailed ? segmentData(p.altMean, p.se, domain[0], p.lowCritical, domain) : []);
    drawArea(altPowerRight, segmentData(p.altMean, p.se, p.highCritical, domain[1], domain));
    drawArea(altBetaFill, segmentData(p.altMean, p.se, p.lowCritical, p.highCritical, domain));

    const revealTargets = [altLayer, altPowerLeft, altPowerRight, altBetaFill];
    if (window.interactiveFigure && window.interactiveFigure.setRevealVisible) {
      window.interactiveFigure.setRevealVisible(revealTargets, state.showAlt, {
        root: rootNode,
        animate: !noAltAnimation
      });
    } else {
      revealTargets.forEach((selection) => {
        selection
          .classed("is-visible", state.showAlt)
          .attr("aria-hidden", String(!state.showAlt));
      });
    }

    rawAxis.style("display", state.axisRaw ? null : "none")
      .call(d3.axisBottom(x).ticks(8).tickFormat(fx));

    const zTicks = [-3, -2, -1, 0, 1, 2, 3];
    h0Axis.style("display", state.axisZNull ? null : "none")
      .call(d3.axisBottom(x)
        .tickValues(zTicks.map((z) => state.mu + z * p.se).filter((value) => value >= domain[0] && value <= domain[1]))
        .tickFormat((value) => f0((value - state.mu) / p.se)));

    h1Axis.style("display", state.axisZAlt ? null : "none")
      .call(d3.axisBottom(x)
        .tickValues(zTicks.map((z) => p.altMean + z * p.se).filter((value) => value >= domain[0] && value <= domain[1]))
        .tickFormat((value) => f0((value - p.altMean) / p.se)));

    rawAxis.select(".sp-axis-label").raise();
    h0Axis.select(".sp-axis-label").raise();
    h1Axis.select(".sp-axis-label").raise();

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
    axisRawInput,
    axisZNullInput,
    axisZAltInput
  ].forEach((input) => input.addEventListener("input", (event) => {
    event.stopPropagation();
    update(true);
  }));

  update(false);
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