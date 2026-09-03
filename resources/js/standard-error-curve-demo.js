seCurveFiniteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

seCurvePositiveNumber = (value, fallback) => {
  const number = seCurveFiniteNumber(value);
  return number > 0 ? number : fallback;
}

seCurveBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
    if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
  }
  return Boolean(value);
}

seCurveKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-")

seCurveEnsureStyles = () => {
  if (document.getElementById("standard-error-curve-demo-styles")) return;

  const style = document.createElement("style");
  style.id = "standard-error-curve-demo-styles";
  style.textContent = `
    .standard-error-curve-demo {
      --sfs-figure-max-width: var(--se-curve-max-width, 48rem);
      --se-population-color: var(--sfs-neutral-color, #7b818a);
      --se-sampling-color: var(--graph-series-1, var(--graph-line-color, #0072b2));
    }

    .standard-error-curve-demo .se-chart-wrap {
      margin-top: 0.35rem;
    }

    .standard-error-curve-demo .se-control-row {
      grid-template-columns: minmax(4.5rem, auto) minmax(3.2rem, auto) minmax(7rem, 1fr);
    }

    .standard-error-curve-demo .se-number-row {
      grid-template-columns: minmax(4.5rem, auto) minmax(5.5rem, auto);
      justify-content: start;
    }

    .standard-error-curve-demo .se-control-row input[type="number"] {
      width: 5.5rem;
    }

    .standard-error-curve-demo .se-control-row input[type="range"] {
      width: 100%;
      min-width: 7rem;
    }

    .standard-error-curve-demo .se-value {
      justify-self: end;
      min-width: 3.2rem;
      color: var(--sfs-muted);
      font-variant-numeric: tabular-nums;
    }

    .standard-error-curve-demo .se-readout {
      grid-template-columns: auto auto;
      width: fit-content;
      margin: 0 0 0.25rem;
      column-gap: 0.45rem;
    }

    .standard-error-curve-demo .se-population-curve {
      stroke: var(--se-population-color);
      stroke-dasharray: 7 5;
    }

    .standard-error-curve-demo .se-sampling-curve {
      stroke: var(--se-sampling-color);
    }

    .standard-error-curve-demo .se-axis text {
      font-size: 0.82rem;
    }
  `;
  document.head.appendChild(style);
}

makeStandardErrorCurveDemo = function(opts) {
  opts = opts || {};
  seCurveEnsureStyles();

  const width = seCurvePositiveNumber(opts.width, 640);
  const aspectRatio = seCurvePositiveNumber(opts.aspectRatio, 2.25);
  const height = seCurvePositiveNumber(opts.height, width / aspectRatio);
  const margin = Object.assign({ top: 24, right: 24, bottom: 52, left: 56 }, opts.margin || {});
  const plotBottom = height - margin.bottom;
  const points = Math.max(80, Math.round(seCurvePositiveNumber(opts.points, 320)));
  const transitionDuration = seCurvePositiveNumber(opts.transitionDuration || opts.duration, 650);
  const formatter = opts.format || d3.format("~g");
  const seFormatter = opts.seFormat || d3.format(".2f");

  const state = {
    mean: seCurveFiniteNumber(opts.mean ?? opts.mu, 100),
    sd: seCurvePositiveNumber(opts.sd ?? opts.sigma, 15),
    n: Math.max(1, Math.round(seCurvePositiveNumber(opts.n ?? opts.sampleSize, 1))),
    showAxis: seCurveBoolean(opts.axis ?? opts.showAxis, opts.style === "minimal" ? false : true)
  };
  let renderedState = {
    mean: state.mean,
    sd: state.sd,
    n: state.n
  };
  let activeTween = null;
  let curveCache = {
    populationKey: null,
    population: null,
    samplingKey: null,
    sampling: null
  };
  let lastRender = null;

  const nMin = Math.max(1, Math.round(seCurvePositiveNumber(opts.nMin, 1)));
  const nMax = Math.max(nMin, Math.round(seCurvePositiveNumber(opts.nMax, 100)));
  const meanStep = seCurvePositiveNumber(opts.meanStep, 1);
  const sdStep = seCurvePositiveNumber(opts.sdStep, 1);
  const nStep = Math.max(1, Math.round(seCurvePositiveNumber(opts.nStep, 1)));
  const xLabel = opts.xLabel || "Score";
  const nTweenFormat = opts.nTweenFormat || d3.format(".1f");

  const root = d3.create("div")
    .attr("class", "standard-error-curve-demo sfs-figure")
    .style("--se-curve-max-width", opts.maxWidth || null);
  const rootNode = root.node();

  const controls = root.append("div")
    .attr("class", "se-controls sfs-control-grid");

  const controlsPanel = controls.append("section")
    .attr("class", "se-panel sfs-control-panel sfs-if-control-panel");
  controlsPanel.append("p")
    .attr("class", "sfs-control-title")
    .text("Sampling distribution");

  function addNumber(labelHtml, value, min, step) {
    const row = controlsPanel.append("label")
      .attr("class", "se-control-row se-number-row sfs-control-row");
    row.append("span").html(labelHtml);
    const input = row.append("input")
      .attr("type", "number")
      .attr("value", value)
      .attr("step", step);
    if (min !== null && min !== undefined) input.attr("min", min);
    return { input: input.node(), value: null };
  }

  function addSlider(labelHtml, value, min, max, step) {
    const row = controlsPanel.append("label")
      .attr("class", "se-control-row se-slider-row sfs-control-row");
    row.append("span").html(labelHtml);
    const valueNode = row.append("span")
      .attr("class", "se-value sfs-readout-value")
      .text(formatter(value));
    const input = row.append("input")
      .attr("type", "range")
      .attr("min", min)
      .attr("max", max)
      .attr("step", step)
      .attr("value", value)
      .attr("data-prevent-swipe", "");
    return { input: input.node(), value: valueNode };
  }

  const meanControl = addNumber("<i>&mu;</i> =", state.mean, null, meanStep);
  const sdControl = addNumber("<i>&sigma;</i> =", state.sd, 0.01, sdStep);
  const nControl = addSlider("<i>n</i> =", state.n, nMin, nMax, nStep);

  const chartWrap = root.append("div")
    .attr("class", "se-chart-wrap sfs-chart-wrap");

  const readout = chartWrap.append("div")
    .attr("class", "se-readout sfs-readout");
  readout.append("span")
    .attr("class", "sfs-readout-label")
    .html("<i>&sigma;<sub>M</sub></i> = ");
  const seValue = readout.append("span")
    .attr("class", "sfs-readout-value");

  const svg = chartWrap.append("svg")
    .attr("class", "sfs-svg sfs-graph")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", opts.ariaLabel || "Sampling distribution standard error curve");

  const x = d3.scaleLinear().range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().range([plotBottom, margin.top]);
  const line = d3.line()
    .curve(bcDistributionCurveFactory(opts))
    .x((d) => x(d.x))
    .y((d) => y(d.y));

  const curveLayer = svg.append("g")
    .attr("class", "se-curve-layer");
  const populationCurve = curveLayer.append("path")
    .attr("class", "se-population-curve sfs-graph-line")
    .attr("fill", "none")
    .attr("stroke-width", seCurvePositiveNumber(opts.populationStrokeWidth, 2));
  const samplingCurve = curveLayer.append("path")
    .attr("class", "se-sampling-curve sfs-graph-line")
    .attr("fill", "none")
    .attr("stroke-width", seCurvePositiveNumber(opts.strokeWidth, 2.6));

  const axisLayer = svg.append("g")
    .attr("class", "se-axis sfs-axis sfs-graph-axis")
    .attr("transform", `translate(0,${plotBottom})`);
  const axisLabel = svg.append("text")
    .attr("class", "sfs-graph-label sfs-axis-label")
    .attr("x", (margin.left + width - margin.right) / 2)
    .attr("y", height - 12)
    .attr("text-anchor", "middle")
    .text(xLabel);

  function parameterState(source = state) {
    return {
      mean: source.mean,
      sd: source.sd,
      n: source.n
    };
  }

  function standardError(source = state) {
    return source.sd / Math.sqrt(source.n);
  }

  function standardErrorForN(n, source = state) {
    return source.sd / Math.sqrt(Math.max(1, n));
  }

  function domainForCurrentState(source = state) {
    if (opts.domain || opts.xDomain) return (opts.domain || opts.xDomain).map(Number);
    const maxN = seCurveBoolean(opts.fixedXDomain, true) ? nMax : source.n;
    const spread = Math.max(source.sd, standardErrorForN(maxN, source)) * seCurvePositiveNumber(opts.domainSd, 4.1);
    return [source.mean - spread, source.mean + spread];
  }

  function yDomainForCurrentState(currentCurves, source = state) {
    if (opts.yDomain) return opts.yDomain.slice();

    const fixed = seCurveBoolean(opts.fixedYDomain, true);
    if (fixed) {
      const maxN = Math.max(source.n, nMax);
      const smallestSd = Math.min(source.sd, standardErrorForN(maxN, source));
      return [0, bcDistributionStats.normalPdf(source.mean, source.mean, smallestSd) * 1.12];
    }

    const yMax = d3.max(currentCurves, (d) => d.y) || 1;
    return [0, yMax * 1.12];
  }

  function curveKey(label, source, sd, domain) {
    return [
      label,
      source.mean,
      sd,
      domain[0],
      domain[1],
      points
    ].join("|");
  }

  function curveData(sd, domain, source = state) {
    const step = (domain[1] - domain[0]) / (points - 1);
    return d3.range(points).map((index) => {
      const value = domain[0] + index * step;
      return { x: value, y: bcDistributionStats.normalPdf(value, source.mean, sd) };
    });
  }

  function plotData(source = state) {
    const se = standardError(source);
    const domain = domainForCurrentState(source);
    const populationKey = curveKey("population", source, source.sd, domain);
    const samplingKey = curveKey("sampling", source, se, domain);
    const populationChanged = populationKey !== curveCache.populationKey;
    const samplingChanged = samplingKey !== curveCache.samplingKey;
    const population = populationChanged
      ? curveData(source.sd, domain, source)
      : curveCache.population;
    const sampling = samplingChanged
      ? curveData(se, domain, source)
      : curveCache.sampling;
    const curves = seCurveBoolean(opts.fixedYDomain, true) ? null : sampling.concat(population);

    if (populationChanged) {
      curveCache.populationKey = populationKey;
      curveCache.population = population;
    }
    if (samplingChanged) {
      curveCache.samplingKey = samplingKey;
      curveCache.sampling = sampling;
    }

    return {
      se,
      domain,
      yDomain: yDomainForCurrentState(curves, source),
      population,
      sampling,
      populationChanged,
      samplingChanged,
      populationKey,
      samplingKey
    };
  }

  function setValue(plot, source = state) {
    rootNode.value = {
      mean: source.mean,
      mu: source.mean,
      sd: source.sd,
      sigma: source.sd,
      n: source.n,
      sampleSize: source.n,
      se: plot.se,
      standardError: plot.se,
      domain: plot.domain.slice(),
      yDomain: plot.yDomain.slice()
    };
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  function readState() {
    state.mean = seCurveFiniteNumber(meanControl.input.value, state.mean);
    state.sd = Math.max(0.01, seCurveFiniteNumber(sdControl.input.value, state.sd));
    state.n = Math.max(nMin, Math.min(nMax, Math.round(seCurveFiniteNumber(nControl.input.value, state.n))));
  }

  function displayN(value) {
    return Math.abs(value - Math.round(value)) < 0.000001 ? formatter(Math.round(value)) : nTweenFormat(value);
  }

  function syncInputValues() {
    meanControl.input.value = String(state.mean);
    sdControl.input.value = String(state.sd);
    nControl.input.value = String(state.n);
  }

  function syncControls(plot, source = state, options = {}) {
    if (options.syncInputs !== false) syncInputValues();
    if (meanControl.value) meanControl.value.text(formatter(state.mean));
    if (sdControl.value) sdControl.value.text(formatter(state.sd));
    nControl.value.text(displayN(source.n));
    seValue.text(seFormatter(plot.se));
  }

  function drawAxis() {
    axisLayer.style("display", state.showAxis ? null : "none");
    axisLabel.style("display", state.showAxis ? null : "none");
    if (!state.showAxis) return;
    axisLayer
      .call(d3.axisBottom(x).ticks(opts.xTicks || 7).tickFormat(opts.xTickFormat || formatter));
  }

  function sameDomain(a, b) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
      a.every((value, index) => value === b[index]);
  }

  function renderPlot(source = renderedState, options = {}) {
    const plot = plotData(source);
    const xDomainChanged = !lastRender || !sameDomain(lastRender.domain, plot.domain);
    const yDomainChanged = !lastRender || !sameDomain(lastRender.yDomain, plot.yDomain);
    const scaleChanged = xDomainChanged || yDomainChanged;
    const axisChanged = !lastRender || xDomainChanged || lastRender.showAxis !== state.showAxis;

    x.domain(plot.domain);
    y.domain(plot.yDomain);

    if (!lastRender || plot.populationChanged || scaleChanged) {
      populationCurve
        .datum(plot.population)
        .attr("d", line);
    }
    if (!lastRender || plot.samplingChanged || scaleChanged) {
      samplingCurve
        .datum(plot.sampling)
        .attr("d", line);
    }

    if (axisChanged) drawAxis();
    setValue(plot, source);
    syncControls(plot, source, { syncInputs: options.syncInputs !== false });
    lastRender = {
      domain: plot.domain.slice(),
      yDomain: plot.yDomain.slice(),
      showAxis: state.showAxis
    };
    return plot;
  }

  function stopTween() {
    if (!activeTween) return;
    activeTween.stop();
    activeTween = null;
  }

  function interpolatedParameter(start, end, t) {
    return start === end ? end : start + (end - start) * t;
  }

  function tweenToTarget(target, notify, options = {}) {
    stopTween();
    const duration = seCurvePositiveNumber(options.duration, transitionDuration);
    const start = parameterState(renderedState);
    const end = parameterState(target);

    if (duration <= 0 || bcDistributionPrefersReducedMotion()) {
      renderedState = end;
      renderPlot(renderedState);
      if (notify) notifyValueChange();
      return;
    }

    activeTween = d3.timer((elapsed) => {
      const rawT = Math.min(1, elapsed / duration);
      const t = d3.easeCubicOut(rawT);
      renderedState = {
        mean: interpolatedParameter(start.mean, end.mean, t),
        sd: interpolatedParameter(start.sd, end.sd, t),
        n: interpolatedParameter(start.n, end.n, t)
      };
      renderPlot(renderedState, { syncInputs: false });

      if (rawT >= 1) {
        stopTween();
        renderedState = end;
        renderPlot(renderedState);
        if (notify) notifyValueChange();
      }
    });
  }

  function update(notify, options) {
    options = options || {};
    stopTween();
    readState();
    const animate = options.animate !== false && !bcDistributionPrefersReducedMotion();
    const target = parameterState(state);
    if (animate) {
      syncInputValues();
      tweenToTarget(target, notify, options);
      return;
    }

    renderedState = target;
    renderPlot(renderedState);
    if (notify) notifyValueChange();
  }

  function actionKey(key) {
    return String(key).trim().toLowerCase().replace(/[\s_]+/g, "-");
  }

  function actionNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function actionBoolean(value) {
    return seCurveBoolean(value, true);
  }

  function setNumericAction(input, value) {
    const number = actionNumber(value);
    if (number === null) return false;
    input.value = String(number);
    return true;
  }

  function applyTutorialAction(action, context) {
    let changed = false;
    let animate = action ? action.animate !== false : true;
    let duration = action && action.duration;

    Object.entries(action || {}).forEach(([key, value]) => {
      switch (actionKey(key)) {
        case "animate":
          animate = actionBoolean(value);
          break;
        case "mean":
        case "mu":
        case "population-mean":
          changed = setNumericAction(meanControl.input, value) || changed;
          break;
        case "sd":
        case "sigma":
        case "standard-deviation":
        case "population-sd":
          changed = setNumericAction(sdControl.input, value) || changed;
          break;
        case "n":
        case "sample-size":
        case "samplesize":
          changed = setNumericAction(nControl.input, value) || changed;
          break;
        case "axis":
        case "show-axis":
          state.showAxis = actionBoolean(value);
          changed = true;
          break;
        case "controls-open":
        case "controls":
        case "show-controls":
          if (context && typeof context.setControlsOpen === "function") {
            context.setControlsOpen(actionBoolean(value), animate);
          }
          break;
        default:
          break;
      }
    });

    if (changed) update(true, { animate, duration });
  }

  [meanControl.input, sdControl.input, nControl.input].forEach((input) => {
    input.addEventListener("input", (event) => {
      event.stopPropagation();
      update(true, { animate: false });
    });
  });

  renderPlot(renderedState);

  if (window.interactiveFigure) {
    window.interactiveFigure.wrap({
      root: rootNode,
      controls: controls.node(),
      label: opts.controlsLabel || "standard error controls",
      placement: opts.controlsPlacement || "callout",
      layout: opts.controlsLayout || "equal",
      applyAction: applyTutorialAction,
      startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
    });
  }

  return rootNode;
}

makeStandardErrorDemo = makeStandardErrorCurveDemo
