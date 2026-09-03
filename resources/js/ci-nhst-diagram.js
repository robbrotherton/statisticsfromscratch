cnStats = window.sfsStats
cnNormalPdf = cnStats.normalPdf
cnNormalCdf = cnStats.normalCdf
cnNormalInv = cnStats.normalInv
cnFiniteNumber = cnStats.finiteNumber

makeCiNhstDiagram = function(opts) {
  opts = opts || {};

  const width = opts.width || 680;
  const height = opts.height || 400;
  const margin = { top: 30, right: 24, bottom: 64, left: 24 };
  const plotBottom = height - margin.bottom;
  const f0 = d3.format(".0f");
  const f2 = d3.format(".2f");

  const state = {
    mu0: cnFiniteNumber(opts.mu0, 284),
    sigma: Math.max(0.01, cnFiniteNumber(opts.sigma, 50)),
    n: Math.max(2, Math.round(cnFiniteNumber(opts.n, 23))),
    m: cnFiniteNumber(opts.m, 322.59),
    confidence: Math.min(99, Math.max(80, cnFiniteNumber(opts.confidence, 95))),
    showNull: opts.showNull === undefined ? true : Boolean(opts.showNull),
    showCi: opts.showCi === undefined ? true : Boolean(opts.showCi),
    showDistances: Boolean(opts.showDistances)
  };

  const root = d3.create("div")
    .attr("class", "ci-nhst-diagram sfs-figure")
    .style("--sfs-if-reveal-duration", opts.revealDuration || "980ms");
  const rootNode = root.node();

  root.append("style").text(`
    .ci-nhst-diagram {
      --cn-null-color: var(--sfs-danger-color, #c63f3f);
      --cn-ci-color: var(--sfs-comparison-color, #2f6f9f);
      --sfs-figure-margin: 1.5rem 0;
    }

    .ci-nhst-diagram .cn-group {
      min-width: 0;
    }

    .ci-nhst-diagram .cn-group-title {
      margin: 0 0 0.45rem 0;
      font-size: 0.95rem;
      font-weight: 700;
    }

    .ci-nhst-diagram .cn-row {
      display: grid;
      grid-template-columns: minmax(4.6rem, auto) minmax(3.2rem, auto) 1fr;
      gap: 0.45rem;
      align-items: center;
      min-height: 1.8rem;
      margin: 0.22rem 0;
      font-size: 0.95rem;
    }

    .ci-nhst-diagram .cn-check-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      min-height: 1.65rem;
      margin: 0.18rem 0;
      font-size: 0.95rem;
    }

    .ci-nhst-diagram .cn-value {
      justify-self: end;
      min-width: 3.2rem;
      font-variant-numeric: tabular-nums;
      color: var(--sfs-muted, var(--bs-secondary-color));
    }

    .ci-nhst-diagram input[type="range"] {
      width: 100%;
      min-width: 6rem;
    }

    .ci-nhst-diagram input[type="checkbox"] {
      width: 1rem;
      height: 1rem;
      flex: 0 0 auto;
    }

    .ci-nhst-diagram .cn-chart-wrap {
      position: relative;
      overflow: visible;
    }

    .ci-nhst-diagram svg {
      display: block;
      width: 100%;
      height: auto;
    }

    .ci-nhst-diagram svg path {
      vector-effect: non-scaling-stroke;
    }

    .ci-nhst-diagram .cn-readout {
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

    .ci-nhst-diagram .cn-p-value.cn-significant {
      color: var(--cn-null-color);
      font-weight: 700;
    }

    .ci-nhst-diagram .cn-axis {
      color: var(--sfs-text, var(--bs-body-color));
    }

    .ci-nhst-diagram .cn-axis text {
      fill: currentColor;
      font-size: 15px;
      font-weight: 500;
    }

    .ci-nhst-diagram .cn-axis path,
    .ci-nhst-diagram .cn-axis line {
      stroke: currentColor;
      vector-effect: non-scaling-stroke;
    }

    @media (max-width: 760px) {
      .ci-nhst-diagram .cn-readout {
        position: static;
        margin: 0 0 0.5rem 0;
        width: fit-content;
      }
    }
  `);

  const controls = root.append("div")
    .attr("class", "cn-controls sfs-control-grid");

  function group(title) {
    const section = controls.append("section")
      .attr("class", "cn-group sfs-control-panel sfs-if-control-panel");
    section.append("p")
      .attr("class", "cn-group-title sfs-control-title")
      .text(title);
    return section;
  }

  function addSlider(parent, labelHtml, value, min, max, step) {
    const row = parent.append("label")
      .attr("class", "cn-row sfs-control-row");
    row.append("span").html(labelHtml);
    const valueNode = row.append("span")
      .attr("class", "cn-value sfs-readout-value");
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
      .attr("class", "cn-check-row sfs-check-row");
    const input = row.append("input")
      .attr("type", "checkbox")
      .property("checked", checked);
    row.append("span").html(labelHtml);
    return input.node();
  }

  const sampleControls = group("Sample");
  const mControl = addSlider(sampleControls, "<i>M</i>", state.m, 250, 380, 0.01);
  const nControl = addSlider(sampleControls, "<i>n</i>", state.n, 2, 100, 1);
  const confidenceControl = addSlider(sampleControls, "Confidence", state.confidence, 80, 99, 1);

  const displayControls = group("Show");
  const showNullInput = addCheckbox(displayControls, "H<sub>0</sub> distribution &amp; critical region", state.showNull);
  const showCiInput = addCheckbox(displayControls, "CI distribution &amp; interval", state.showCi);
  const showDistancesInput = addCheckbox(displayControls, "Mean-to-limit distances", state.showDistances);

  const chartWrap = root.append("div")
    .attr("class", "cn-chart-wrap sfs-chart-wrap");

  const readout = chartWrap.append("div")
    .attr("class", "cn-readout sfs-readout");
  readout.append("span").html("<i>p</i> =");
  const pValueNode = readout.append("span")
    .attr("class", "cn-p-value");

  const svg = chartWrap.append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("class", "sfs-svg sfs-graph")
    .attr("role", "img")
    .attr("aria-label", "Correspondence between the null-hypothesis critical region and the confidence interval");

  const x = d3.scaleLinear().range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().range([plotBottom, margin.top]);
  const line = d3.line()
    .x((d) => x(d.value))
    .y((d) => y(d.density));
  const area = d3.area()
    .x((d) => x(d.value))
    .y0(y(0))
    .y1((d) => y(d.density));

  const nullLayer = svg.append("g")
    .attr("class", "cn-null-layer sfs-if-reveal")
    .style("--sfs-if-reveal-opacity", 1);
  const ciLayer = svg.append("g")
    .attr("class", "cn-ci-layer sfs-if-reveal")
    .style("--sfs-if-reveal-opacity", 1);
  const distanceLayer = svg.append("g")
    .attr("class", "cn-distance-layer");
  const axisLayer = svg.append("g");
  const dotLayer = svg.append("g");

  const nullRejectLeft = nullLayer.append("path")
    .style("fill", "var(--cn-null-color)")
    .attr("opacity", 0.30);
  const nullRejectRight = nullLayer.append("path")
    .style("fill", "var(--cn-null-color)")
    .attr("opacity", 0.30);
  const nullCurve = nullLayer.append("path")
    .attr("fill", "none")
    .style("stroke", "var(--cn-null-color)")
    .attr("stroke-width", 2.25);
  const nullMeanLine = nullLayer.append("line")
    .style("stroke", "var(--cn-null-color)")
    .attr("stroke-width", 1.6)
    .attr("stroke-dasharray", "5 4")
    .attr("opacity", 0.75);
  const nullLabel = nullLayer.append("text")
    .attr("text-anchor", "middle")
    .attr("font-size", 21)
    .attr("font-weight", 600)
    .style("fill", "var(--cn-null-color)")
    .html("H<tspan baseline-shift='sub' font-size='13'>0</tspan>");

  const ciFill = ciLayer.append("path")
    .style("fill", "var(--cn-ci-color)")
    .attr("opacity", 0.30);
  const ciCurve = ciLayer.append("path")
    .attr("fill", "none")
    .style("stroke", "var(--cn-ci-color)")
    .attr("stroke-width", 2.25);
  const ciMeanLine = ciLayer.append("line")
    .style("stroke", "var(--cn-ci-color)")
    .attr("stroke-width", 1.6)
    .attr("stroke-dasharray", "5 4")
    .attr("opacity", 0.75);
  const ciLabel = ciLayer.append("text")
    .attr("text-anchor", "middle")
    .attr("font-size", 18)
    .attr("font-weight", 600)
    .style("fill", "var(--cn-ci-color)");

  // Double-headed distance arrows: null mean to its critical limit, and sample
  // mean to its confidence limit, drawn at staggered heights for comparison.
  function makeDistanceArrow(color) {
    const arrowGroup = distanceLayer.append("g")
      .attr("class", "sfs-if-reveal")
      .style("--sfs-if-reveal-opacity", 1);
    const lineNode = arrowGroup.append("line")
      .style("stroke", color)
      .attr("stroke-width", 2.4)
      .attr("stroke-linecap", "round");
    const heads = arrowGroup.append("path")
      .attr("fill", "none")
      .style("stroke", color)
      .attr("stroke-width", 2.4)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");
    return { group: arrowGroup, line: lineNode, heads };
  }
  const nullDistance = makeDistanceArrow("var(--cn-null-color)");
  const ciDistance = makeDistanceArrow("var(--cn-ci-color)");

  const rawAxis = axisLayer.append("g")
    .attr("class", "cn-axis sfs-axis sfs-graph-axis")
    .attr("transform", `translate(0, ${plotBottom})`);
  axisLayer.append("text")
    .attr("class", "sfs-axis-label sfs-graph-label")
    .attr("x", (margin.left + width - margin.right) / 2)
    .attr("y", height - 14)
    .attr("text-anchor", "middle")
    .attr("font-size", 15)
    .style("fill", "var(--sfs-text, currentColor)")
    .text(opts.xLabel || "Sample mean reaction time (ms)");

  const nullDot = dotLayer.append("circle")
    .attr("r", 6.5)
    .style("fill", "var(--cn-null-color)")
    .style("stroke", "var(--sfs-bg, #fff)")
    .attr("stroke-width", 1.5);
  const sampleDot = dotLayer.append("circle")
    .attr("r", 6.5)
    .style("fill", "var(--cn-ci-color)")
    .style("stroke", "var(--sfs-bg, #fff)")
    .attr("stroke-width", 1.5);

  function readState() {
    state.m = cnFiniteNumber(mControl.input.value, state.m);
    state.n = Math.max(2, Math.round(cnFiniteNumber(nControl.input.value, state.n)));
    state.confidence = Math.min(99, Math.max(80, cnFiniteNumber(confidenceControl.input.value, state.confidence)));
    state.showNull = showNullInput.checked;
    state.showCi = showCiInput.checked;
    state.showDistances = showDistancesInput.checked;
  }

  function params() {
    const se = state.sigma / Math.sqrt(state.n);
    const alpha = 1 - state.confidence / 100;
    const zCritical = cnNormalInv(1 - alpha / 2);
    const distance = zCritical * se;
    const criticalLow = state.mu0 - distance;
    const criticalHigh = state.mu0 + distance;
    const ciLower = state.m - distance;
    const ciUpper = state.m + distance;
    const z = (state.m - state.mu0) / se;
    const p = 2 * (1 - cnNormalCdf(Math.abs(z)));
    return {
      se, alpha, zCritical, distance, criticalLow, criticalHigh,
      ciLower, ciUpper, z, p,
      significant: p < alpha,
      containsNull: state.mu0 >= ciLower && state.mu0 <= ciUpper
    };
  }

  function domainFor(p) {
    const candidates = [state.mu0, state.m, p.criticalLow, p.criticalHigh, p.ciLower, p.ciUpper];
    const pad = Math.max(3.4 * p.se, 0.1 * (d3.max(candidates) - d3.min(candidates) || p.se));
    return [d3.min(candidates) - pad, d3.max(candidates) + pad];
  }

  function curveData(mean, se, domain, steps) {
    const dx = (domain[1] - domain[0]) / steps;
    return d3.range(steps + 1).map((i) => {
      const value = domain[0] + i * dx;
      return { value, density: cnNormalPdf(value, mean, se) };
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
      return { value, density: cnNormalPdf(value, mean, se) };
    });
  }

  function drawArea(path, data) {
    path.attr("d", data.length > 1 ? area(data) : null);
  }

  function drawDistanceArrow(arrow, fromValue, toValue, arrowY) {
    const x1 = x(fromValue);
    const x2 = x(toValue);
    const direction = x2 >= x1 ? 1 : -1;
    const size = 7;
    arrow.line
      .attr("x1", x1 + direction * 1.5)
      .attr("x2", x2 - direction * 1.5)
      .attr("y1", arrowY)
      .attr("y2", arrowY);
    arrow.heads.attr("d",
      `M${x1 + direction * size},${arrowY - size * 0.62}L${x1},${arrowY}L${x1 + direction * size},${arrowY + size * 0.62}` +
      `M${x2 - direction * size},${arrowY - size * 0.62}L${x2},${arrowY}L${x2 - direction * size},${arrowY + size * 0.62}`);
  }

  function formatP(p) {
    if (p < 0.0001) return "< .0001";
    return d3.format(".4f")(p).replace(/^0/, "");
  }

  function setValue(p) {
    rootNode.value = {
      mu0: state.mu0,
      sigma: state.sigma,
      n: state.n,
      m: state.m,
      mean: state.m,
      confidence: state.confidence,
      alpha: p.alpha,
      se: p.se,
      standardError: p.se,
      z: p.z,
      p: p.p,
      zCritical: p.zCritical,
      distance: p.distance,
      marginOfError: p.distance,
      criticalLow: p.criticalLow,
      criticalHigh: p.criticalHigh,
      ciLower: p.ciLower,
      ciUpper: p.ciUpper,
      significant: p.significant ? 1 : 0,
      containsNull: p.containsNull ? 1 : 0,
      showNull: state.showNull,
      showCi: state.showCi,
      showDistances: state.showDistances
    };
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  let suppressRevealAnimation = false;

  function update(notify) {
    const animateReveals = !suppressRevealAnimation;
    suppressRevealAnimation = false;

    readState();
    const p = params();
    const domain = domainFor(p);
    setValue(p);

    x.domain(domain);
    y.domain([0, cnNormalPdf(state.mu0, state.mu0, p.se) * 1.16]);

    mControl.value.text(f2(state.m));
    nControl.value.text(f0(state.n));
    confidenceControl.value.text(`${f0(state.confidence)}%`);
    pValueNode.text(formatP(p.p))
      .classed("cn-significant", p.significant);

    const nullData = curveData(state.mu0, p.se, domain, 320);
    const ciData = curveData(state.m, p.se, domain, 320);
    nullCurve.attr("d", line(nullData));
    ciCurve.attr("d", line(ciData));

    drawArea(nullRejectLeft, segmentData(state.mu0, p.se, domain[0], p.criticalLow, domain));
    drawArea(nullRejectRight, segmentData(state.mu0, p.se, p.criticalHigh, domain[1], domain));
    drawArea(ciFill, segmentData(state.m, p.se, p.ciLower, p.ciUpper, domain));

    nullMeanLine
      .attr("x1", x(state.mu0)).attr("x2", x(state.mu0))
      .attr("y1", y(0)).attr("y2", y(cnNormalPdf(state.mu0, state.mu0, p.se)));
    ciMeanLine
      .attr("x1", x(state.m)).attr("x2", x(state.m))
      .attr("y1", y(0)).attr("y2", y(cnNormalPdf(state.m, state.m, p.se)));

    nullLabel
      .attr("x", x(state.mu0))
      .attr("y", y(cnNormalPdf(state.mu0, state.mu0, p.se)) - 12);
    ciLabel
      .attr("x", x(state.m))
      .attr("y", y(cnNormalPdf(state.m, state.m, p.se)) - 12)
      .text(`${f0(state.confidence)}% CI`);

    // Arrows point from each mean toward the limit that faces the other mean.
    // Both are centered between the baseline and the curve's height at its
    // limit (the same height for both curves, by symmetry), dodged apart so
    // they never overlap when shown together.
    const towardM = state.m >= state.mu0 ? 1 : -1;
    const limitPdf = cnNormalPdf(p.criticalHigh, state.mu0, p.se);
    const arrowMidY = (y(0) + y(limitPdf)) / 2;
    const ciArrowY = Math.min(arrowMidY + 7, y(0) - 9);
    drawDistanceArrow(nullDistance, state.mu0, towardM > 0 ? p.criticalHigh : p.criticalLow, ciArrowY - 14);
    drawDistanceArrow(ciDistance, state.m, towardM > 0 ? p.ciLower : p.ciUpper, ciArrowY);

    nullDot.attr("cx", x(state.mu0)).attr("cy", plotBottom);
    sampleDot.attr("cx", x(state.m)).attr("cy", plotBottom);

    rawAxis.call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("~g")));

    const setRevealVisible = window.interactiveFigure && window.interactiveFigure.setRevealVisible;
    const reveals = [
      [nullLayer, state.showNull],
      [ciLayer, state.showCi],
      [nullDistance.group, state.showDistances && state.showNull],
      [ciDistance.group, state.showDistances && state.showCi]
    ];
    reveals.forEach(([selection, visible]) => {
      if (setRevealVisible) {
        setRevealVisible(selection, visible, { root: rootNode, animate: animateReveals });
      } else {
        selection
          .classed("is-visible", visible)
          .attr("aria-hidden", String(!visible));
      }
    });

    if (notify) notifyValueChange();
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

  function applyTutorialAction(action, context) {
    let changed = false;

    Object.entries(action || {}).forEach(([key, value]) => {
      switch (actionKey(key)) {
        case "animate":
          suppressRevealAnimation = !actionBoolean(value);
          break;
        case "m":
        case "sample-mean":
        case "mean":
          changed = setNumericAction(mControl.input, value) || changed;
          break;
        case "n":
        case "sample-size":
          changed = setNumericAction(nControl.input, value) || changed;
          break;
        case "confidence":
          changed = setNumericAction(confidenceControl.input, value) || changed;
          break;
        case "show-null":
        case "show-h0":
          showNullInput.checked = actionBoolean(value);
          changed = true;
          break;
        case "show-ci":
        case "show-interval":
          showCiInput.checked = actionBoolean(value);
          changed = true;
          break;
        case "show-distances":
        case "show-distance":
          showDistancesInput.checked = actionBoolean(value);
          changed = true;
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

  [
    mControl.input,
    nControl.input,
    confidenceControl.input,
    showNullInput,
    showCiInput,
    showDistancesInput
  ].forEach((input) => input.addEventListener("input", (event) => {
    event.stopPropagation();
    update(true);
  }));

  suppressRevealAnimation = true;
  update(false);
  if (window.interactiveFigure) {
    window.interactiveFigure.wrap({
      root: rootNode,
      controls: controls.node(),
      label: "confidence interval and hypothesis testing controls",
      placement: opts.controlsPlacement || "callout",
      layout: opts.controlsLayout || "equal",
      applyAction: applyTutorialAction,
      startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
    });
  }

  return rootNode;
}
