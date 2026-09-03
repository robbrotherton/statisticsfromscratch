(function(global) {
  "use strict";

  const sampling = global.sfsSampling;
  const visuals = global.sfsSamplingVisuals;
  const RAW_DOMAIN = [-3, 3];
  const SE_DOMAIN = [-3, 3];
  const MAX_SIMULATIONS = 2000000;
  const DEFAULT_SAMPLING_ANIMATION_MS = 2000;
  const POPULATION_SWAP_MS = 1500;

  // These formations are deliberately fixed rather than regenerated from
  // random draws on every page load. Each entry is the number of dots in one
  // 0.1-wide column from -3 through +3 (340 dots per population).
  const FIXED_POPULATION_COUNTS = Object.freeze({
    normal: Object.freeze([
      1, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 6, 7, 7,
      8, 9, 10, 11, 11, 12, 13, 13, 13, 13, 14, 13, 13, 13, 13, 12, 11,
      11, 10, 9, 8, 7, 7, 6, 5, 4, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1, 0,
      0, 0, 0, 1
    ]),
    skewed: sampling.rightSkewedFormationCounts
  });

  function fixedPopulationMarkers(shape, model) {
    const counts = FIXED_POPULATION_COUNTS[shape];
    if (!counts) return null;
    const markers = [];
    counts.forEach((count, column) => {
      const value = RAW_DOMAIN[0] + column * 0.1;
      for (let row = 0; row < count; row += 1) {
        markers.push({
          id: markers.length,
          probability: sampling.clamp(model.cdf(value), 0, 1),
          value,
          row: 0,
          discrete: false
        });
      }
    });
    return markers;
  }

  function ensureStyles() {
    if (document.getElementById("sampling-shape-explorer-styles")) return;
    const style = document.createElement("style");
    style.id = "sampling-shape-explorer-styles";
    style.textContent = `
      .sse-controls .sse-control-row {
        display: grid;
        grid-template-columns: auto minmax(3rem, auto) minmax(8rem, 1fr);
        align-items: center;
        gap: 0.45rem;
        margin: 0.25rem 0;
      }

      .sse-controls .sse-control-row select,
      .sse-controls .sse-control-row input[type="range"] {
        grid-column: 2 / 4;
        width: 100%;
      }

      .sse-controls .sse-value,
      .sse-controls .sse-status {
        color: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
        font-variant-numeric: tabular-nums;
      }

      .sse-controls .sse-button-row,
      .sse-controls .sse-scale-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .sse-controls .sse-scale-buttons .sfs-button[aria-pressed="true"] {
        color: var(--bs-btn-active-color, var(--sfs-bg, white));
        background: var(--sfs-accent, var(--bs-primary, #2c6e9b));
        border-color: var(--sfs-accent, var(--bs-primary, #2c6e9b));
      }

      .sse-controls .sse-status {
        align-self: center;
        min-width: 8.5rem;
        font-size: 0.9rem;
      }

      .sampling-shape-explorer[data-sfs-layout="compact"] .sse-controls .sse-button-row .sfs-button,
      .sampling-shape-explorer[data-sfs-layout="compact"] .sse-controls .sse-scale-buttons .sfs-button {
          flex: 1 1 8rem;
          min-height: 44px;
      }
      .sampling-shape-explorer[data-sfs-layout="compact"] .sse-controls .sse-status {
        flex: 1 1 100%;
      }
    `;
    document.head.appendChild(style);
  }

  function makeButton(parent, icon, label) {
    const button = parent.append("button")
      .attr("type", "button")
      .attr("class", "sfs-button")
      .attr("aria-label", label)
      .attr("title", label)
      .attr("data-prevent-swipe", "")
      .node();
    const iconNode = document.createElement("i");
    iconNode.className = `bi bi-${icon}`;
    iconNode.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.textContent = label;
    button.append(iconNode, text);
    return { button, icon: iconNode, text };
  }

  function checkbox(parent, label, checked) {
    const row = parent.append("label").attr("class", "sfs-check-row");
    const input = row.append("input")
      .attr("type", "checkbox")
      .property("checked", checked)
      .node();
    row.append("span").text(label);
    return input;
  }

  function reveal(selection, visible, root, animate) {
    if (global.interactiveFigure && global.interactiveFigure.setRevealVisible) {
      global.interactiveFigure.setRevealVisible(selection, visible, {
        root,
        animate: animate && !visuals.reducedMotion()
      });
    } else {
      selection.attr("display", visible ? null : "none");
    }
  }

  global.makeSamplingShapeExplorer = function(options) {
    const opts = options || {};
    ensureStyles();
    visuals.ensureStyles();

    const preferredWidth = Math.max(240, sampling.finite(opts.width, 760));
    const compactBelow = Math.max(320, sampling.finite(opts.compactBelow, 560));
    let compact = preferredWidth < compactBelow;
    let width = preferredWidth;
    let height = sampling.finite(opts.height, 500);
    let xRaw = null;
    let xSE = null;
    const formatCount = d3.format(",");
    const f2 = d3.format(".2f");
    const formatEstimate = (value) => f2(Math.abs(value) < 0.005 ? 0 : value);
    const defaultSeed = String(opts.seed ?? "sampling-shape-v2");
    const initialSamples = sampling.clamp(Math.round(sampling.finite(opts.samples, 0)), 0, MAX_SIMULATIONS);
    const populationMarkerCount = Math.max(
      80,
      Math.round(sampling.finite(opts.populationMarkers, 340))
    );
    const populationGridColumns = Math.max(
      20,
      Math.round(sampling.finite(opts.populationGridColumns, 60))
    );
    const state = {
      seed: defaultSeed,
      shape: ["skewed", "normal", "uniform", "bimodal"].includes(opts.distribution)
        ? opts.distribution : "normal",
      n: sampling.clamp(Math.round(sampling.finite(opts.sampleSize ?? opts.n, 5)), 1, 100),
      samples: 0,
      scaleMode: ["se", "standard-error", "standardized"].includes(String(opts.scaleMode || opts.scale))
        ? "se" : "raw",
      showPopulation: sampling.boolean(opts.showPopulation, true),
      showDistribution: sampling.boolean(opts.showDistribution, true),
      showNormal: sampling.boolean(opts.showNormal ?? opts.normalReference, false)
    };

    let model = null;
    let populationMarkers = [];
    let histogram = sampling.createHistogram({ bins: 180, domain: SE_DOMAIN });
    let rng = null;
    let simulationToken = 0;
    let simulationTimer = null;
    let simulationResolver = null;
    let isSimulating = false;
    let displayedSamples = 0;

    function modelForState() {
      if (state.shape === "normal") return sampling.normalModel({ mean: 0, sd: 1 });
      if (state.shape === "uniform") return sampling.uniformModel({ mean: 0, sd: 1 });
      if (state.shape === "bimodal") return sampling.bimodalModel({ mean: 0, sd: 1 });
      return sampling.rightSkewedModel();
    }

    function resetSimulation() {
      state.samples = 0;
      displayedSamples = 0;
      histogram = sampling.createHistogram({ bins: 180, domain: SE_DOMAIN });
      rng = sampling.seededRng(
        `${state.seed}:${state.shape}:${state.n}:dense`
      );
    }

    function rebuildModel(reset) {
      model = modelForState();
      populationMarkers = fixedPopulationMarkers(state.shape, model) ||
        sampling.markers(model, populationMarkerCount, RAW_DOMAIN);
      if (reset) resetSimulation();
    }

    rebuildModel(true);

    const root = d3.create("div")
      .attr("class", "sampling-shape-explorer sfs-sampling-figure sfs-figure")
      .style("--sfs-figure-max-width", opts.maxWidth || "48rem");
    const rootNode = root.node();
    const controls = root.append("div").attr("class", "sse-controls sfs-control-grid");

    function controlGroup(title) {
      const group = controls.append("section")
        .attr("class", "sfs-control-panel sfs-if-control-panel");
      group.append("p").attr("class", "sfs-control-title").text(title);
      return group;
    }

    const modelControls = controlGroup("Model");
    const shapeRow = modelControls.append("label").attr("class", "sse-control-row sfs-control-row");
    shapeRow.append("span").text("Population");
    const shapeInput = shapeRow.append("select")
      .attr("aria-label", "Population shape")
      .node();
    [
      ["normal", "Normal"],
      ["skewed", "Right-skewed"],
      ["uniform", "Uniform"],
      ["bimodal", "Two peaks"]
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      shapeInput.appendChild(option);
    });

    const nRow = modelControls.append("label").attr("class", "sse-control-row sfs-control-row");
    nRow.append("span").text("Sample size n");
    const nValue = nRow.append("span").attr("class", "sse-value").node();
    const nInput = nRow.append("input")
      .attr("type", "range")
      .attr("min", 1).attr("max", 100).attr("step", 1)
      .attr("data-prevent-swipe", "")
      .attr("aria-label", "Sample size")
      .node();

    const scaleControls = controlGroup("Horizontal scale");
    const scaleButtons = scaleControls.append("div").attr("class", "sse-scale-buttons");
    const rawScaleButton = makeButton(scaleButtons, "arrows-collapse", "Same score scale");
    const seScaleButton = makeButton(scaleButtons, "arrows-expand", "Standard-error scale");

    const samplingControls = controlGroup("Simulation");
    const buttonRow = samplingControls.append("div").attr("class", "sse-button-row sfs-action-row");
    const hundredThousand = makeButton(buttonRow, "bar-chart-steps", "Add 100,000");
    const million = makeButton(buttonRow, "bar-chart-fill", "Add 1,000,000");
    const reset = makeButton(buttonRow, "arrow-counterclockwise", "Reset");
    const status = buttonRow.append("span")
      .attr("class", "sse-status")
      .attr("aria-live", "polite")
      .node();

    const inspectControls = controlGroup("Inspect");
    const normalInput = checkbox(inspectControls, "Compare with normal", state.showNormal);

    const chartWrap = root.append("div").attr("class", "sfs-chart-wrap");
    let svg = null;
    let title = null;
    let populationPlot = null;
    let densePlot = null;
    let chartGeometry = null;

    function measureChartGeometry() {
      const populationBinWidth =
        (RAW_DOMAIN[1] - RAW_DOMAIN[0]) / populationGridColumns;
      const populationDiameter = Math.abs(
        xRaw(RAW_DOMAIN[0] + populationBinWidth) - xRaw(RAW_DOMAIN[0])
      );
      const populationRadius = populationDiameter / 2;
      const populationLayout = visuals.packedMarkerLayout(
        model,
        populationMarkers,
        xRaw,
        populationRadius,
        RAW_DOMAIN,
        populationBinWidth
      );
      const populationRows = Math.max(
        16,
        (d3.max(populationLayout, (item) => item.row) ?? 0) + 1
      );
      const populationAxisY = 56 + populationRows * populationDiameter;
      const denseLabelY = populationAxisY + 50;
      const denseNoteY = populationAxisY + 67;
      const denseTopY = populationAxisY + 119;
      const denseBaseY = denseTopY + 165;
      const fullHeight = denseBaseY + 44;
      return {
        populationBinWidth,
        populationRadius,
        populationAxisY,
        denseLabelY,
        denseNoteY,
        denseTopY,
        denseBaseY,
        height: Math.max(fullHeight, sampling.finite(opts.height, fullHeight))
      };
    }

    function relayoutChart(animate) {
      if (!svg || !populationPlot || !densePlot) return;
      chartGeometry = measureChartGeometry();
      height = chartGeometry.height;
      svg.attr("viewBox", [0, 0, width, height]);
      populationPlot.relayout({
        axisY: chartGeometry.populationAxisY,
        animate
      });
      densePlot.relayout({
        labelY: chartGeometry.denseLabelY,
        noteY: chartGeometry.denseNoteY,
        topY: chartGeometry.denseTopY,
        baseY: chartGeometry.denseBaseY
      });
    }

    function buildChart(layout) {
      if (svg) {
        cancelSimulation(false);
        if (global.interactiveFigure) {
          global.interactiveFigure.cancelTransitions(rootNode);
        }
      }

      compact = Boolean(layout.compact);
      width = Math.max(240, Math.min(preferredWidth, sampling.finite(layout.width, preferredWidth)));
      const plotInset = Math.max(12, sampling.finite(opts.plotInset, 16));
      const plotLeft = plotInset;
      const plotRight = width - plotInset;
      xRaw = d3.scaleLinear().domain(RAW_DOMAIN).range([plotLeft, plotRight]);
      xSE = d3.scaleLinear().domain(SE_DOMAIN).range([plotLeft, plotRight]);
      populationMarkers = fixedPopulationMarkers(state.shape, model) ||
        sampling.markers(model, populationMarkerCount, RAW_DOMAIN);
      chartGeometry = measureChartGeometry();
      height = chartGeometry.height;

      chartWrap.selectAll("*").remove();
      svg = chartWrap.append("svg")
        .attr("class", "sfs-svg sfs-graph")
        .attr("viewBox", [0, 0, width, height])
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("role", "img");
      title = svg.append("title");

      populationPlot = visuals.createPopulationPlot(svg, {
        x: xRaw,
        domain: RAW_DOMAIN,
        radius: chartGeometry.populationRadius,
        plotLeft,
        plotRight,
        labelY: 25,
        noteY: 42,
        axisY: chartGeometry.populationAxisY,
        muLinePeek: 6,
        axisLabel: "Population score",
        binWidth: chartGeometry.populationBinWidth,
        tickValues: compact
          ? d3.range(-3, 3.01, 1)
          : d3.range(-3, 3.01, 0.5),
        tickFormat: (value) => Number.isInteger(value) ? value : ""
      });
      densePlot = visuals.createDenseHistogram(svg, {
        plotLeft,
        plotRight,
        labelY: chartGeometry.denseLabelY,
        noteY: chartGeometry.denseNoteY,
        topY: chartGeometry.denseTopY,
        baseY: chartGeometry.denseBaseY
      });
      render({ animate: false });
    }

    function setValue() {
      rootNode.value = {
        seed: state.seed,
        distribution: state.shape,
        distributionLabel: model.label,
        skewAmount: state.shape === "skewed" ? 1 : null,
        sampleSize: state.n,
        n: state.n,
        samplesDrawn: state.samples,
        populationMean: model.mean,
        populationSd: model.sd,
        standardError: sampling.standardError(model, state.n),
        scaleMode: state.scaleMode,
        exactNormal: model.exactNormal,
        normalReference: state.showNormal,
        histogram: histogram.data().map((item) => ({
          z: item.z,
          count: item.count,
          density: item.density
        }))
      };
    }

    function notify() {
      rootNode.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function syncControls() {
      shapeInput.value = state.shape;
      nInput.value = String(state.n);
      nValue.textContent = String(state.n);
      shapeInput.disabled = isSimulating;
      nInput.disabled = isSimulating;
      rawScaleButton.button.disabled = isSimulating;
      seScaleButton.button.disabled = isSimulating;
      rawScaleButton.button.setAttribute("aria-pressed", String(state.scaleMode === "raw"));
      seScaleButton.button.setAttribute("aria-pressed", String(state.scaleMode === "se"));
      normalInput.checked = state.showNormal;
      normalInput.disabled = state.samples === 0;
      reset.button.disabled = state.samples === 0 || isSimulating;
      hundredThousand.button.disabled = isSimulating || state.samples >= MAX_SIMULATIONS;
      million.button.disabled = isSimulating || state.samples >= MAX_SIMULATIONS;
      status.textContent = isSimulating
        ? `Building… ${formatCount(displayedSamples)} means`
        : `${formatCount(state.samples)} means`;
      rootNode.setAttribute("aria-busy", isSimulating ? "true" : "false");
    }

    function render(settings) {
      const options = settings || {};
      const visibleCount = Number.isFinite(options.displayedSamples)
        ? options.displayedSamples
        : state.samples;
      const histogramData = options.histogramData || histogram.data();
      const predictedSe = sampling.standardError(model, state.n);
      const observedSummary = options.observedSummary || null;
      const observedMeanZ = observedSummary ? observedSummary.meanZ : histogram.mean;
      const observedSdZ = observedSummary ? observedSummary.sdZ : histogram.sd;
      const hasObserved = visibleCount > 0 &&
        Number.isFinite(observedMeanZ) && Number.isFinite(observedSdZ);
      const observedMean = hasObserved
        ? model.mean + observedMeanZ * predictedSe
        : NaN;
      const observedSe = hasObserved ? observedSdZ * predictedSe : NaN;
      populationPlot.update(model, populationMarkers, {
        note: `${model.label}; μ = ${f2(model.mean)}, σ = ${f2(model.sd)}`,
        showAxis: true,
        animate: options.animate,
        replaceModel: options.populationSwap
      });
      const noteLines = [
        `${formatCount(visibleCount)} sample means; n = ${state.n}`,
        `Predicted: mean = ${formatEstimate(model.mean)}; SE = ${formatEstimate(predictedSe)}`,
        hasObserved
          ? `Observed: mean = ${formatEstimate(observedMean)}; SE = ${formatEstimate(observedSe)}`
          : "Observed: mean = —; SE = —"
      ];
      densePlot.update(histogramData, {
        total: visibleCount,
        mean: model.mean,
        standardError: predictedSe,
        scaleMode: state.scaleMode,
        xRaw,
        xSE,
        compact,
        showNormal: (options.showNormalOverride ?? state.showNormal) && state.samples > 0,
        noteLines,
        animate: options.animate,
        animateNormal: options.animateNormal ?? options.animate,
        maxDensity: options.maxDensity,
        scaleChanged: options.scaleChanged
      });
      reveal(populationPlot.layer, state.showPopulation, rootNode, options.animate);
      reveal(densePlot.layer, state.showDistribution, rootNode, options.animate);
      syncControls();
      const normalPhrase = model.exactNormal
        ? "exactly normal at every sample size"
        : "approaches normality gradually as sample size increases";
      const scalePhrase = state.scaleMode === "se"
        ? "The lower axis measures standard errors from the population mean."
        : "Both panels use the same score scale.";
      const aria = `${model.label} population with mean ${f2(model.mean)} and standard deviation ${f2(model.sd)}. ` +
        `${formatCount(visibleCount)} simulated sample means for samples of ${state.n}. ` +
        `The predicted mean is ${f2(model.mean)} and predicted standard error is ${f2(predictedSe)}. ` +
        (hasObserved
          ? `The observed mean is ${f2(observedMean)} and observed standard error is ${f2(observedSe)}. `
          : "There are no observed sample means yet. ") +
        `The sampling distribution ${normalPhrase}. ${scalePhrase}`;
      svg.attr("aria-label", aria);
      title.text(aria);
      setValue();
    }

    function cancelSimulation(settle) {
      simulationToken += 1;
      if (simulationTimer !== null) {
        global.clearTimeout(simulationTimer);
        simulationTimer = null;
      }
      if (simulationResolver) {
        const resolve = simulationResolver;
        simulationResolver = null;
        resolve(false);
      }
      const wasSimulating = isSimulating;
      isSimulating = false;
      displayedSamples = state.samples;
      if (settle && wasSimulating) render({ animate: false });
      else syncControls();
      return wasSimulating;
    }

    function waitFrame(token, delay) {
      return new Promise((resolve) => {
        simulationResolver = resolve;
        simulationTimer = global.setTimeout(() => {
          simulationTimer = null;
          simulationResolver = null;
          resolve(token === simulationToken);
        }, Math.max(0, sampling.finite(delay, 32)));
      });
    }

    function interpolateHistogram(fromData, toData, progress) {
      return toData.map((item, index) => {
        const from = fromData[index] || { count: 0, density: 0 };
        return Object.assign({}, item, {
          count: Math.round(from.count + (item.count - from.count) * progress),
          density: from.density + (item.density - from.density) * progress
        });
      });
    }

    function generateMomentCheckpoints(startSamples, target, duration) {
      const remaining = target - startSamples;
      const stepCount = Math.min(
        remaining,
        Math.max(2, Math.ceil(duration / 32))
      );
      const checkpoints = [{
        samples: startSamples,
        meanZ: histogram.mean,
        sdZ: histogram.sd
      }];
      let generatedSamples = startSamples;
      for (let step = 1; step <= stepCount; step += 1) {
        const nextSamples = startSamples + Math.round(remaining * step / stepCount);
        sampling.addSimulatedMeans(
          histogram,
          model,
          state.n,
          rng,
          nextSamples - generatedSamples
        );
        generatedSamples = nextSamples;
        checkpoints.push({
          samples: generatedSamples,
          meanZ: histogram.mean,
          sdZ: histogram.sd
        });
      }
      return checkpoints;
    }

    async function simulateToTotal(count, settings) {
      const options = settings || {};
      const target = sampling.clamp(Math.round(sampling.finite(count, state.samples)), 0, MAX_SIMULATIONS);
      cancelSimulation(false);
      if (target < state.samples) resetSimulation();
      const token = simulationToken;
      const animateProgress = options.animate !== false && !visuals.reducedMotion();
      const startSamples = state.samples;
      const startData = histogram.data();
      const remaining = target - state.samples;
      if (!animateProgress) {
        sampling.addSimulatedMeans(histogram, model, state.n, rng, remaining);
        state.samples = target;
        displayedSamples = target;
        render({ animate: false });
        notify();
        return;
      }
      if (remaining <= 0) {
        displayedSamples = target;
        render({ animate: options.animate !== false, animateNormal: true });
        notify();
        return;
      }
      isSimulating = true;
      displayedSamples = startSamples;
      syncControls();
      if (!(await waitFrame(token, 16))) return;
      if (options.startDelay > 0 && !(await waitFrame(token, options.startDelay))) return;

      const duration = Math.max(
        200,
        sampling.finite(options.duration, DEFAULT_SAMPLING_ANIMATION_MS)
      );
      const momentCheckpoints = generateMomentCheckpoints(startSamples, target, duration);
      state.samples = target;
      const finalData = histogram.data();
      const maxDensity = d3.max(finalData, (item) => item.density) || 0.45;
      const startedAt = global.performance.now();
      let progress = 0;
      while (progress < 1 && token === simulationToken) {
        const linearProgress = sampling.clamp(
          (global.performance.now() - startedAt) / duration, 0, 1
        );
        progress = d3.easeCubicInOut(linearProgress);
        const checkpoint = momentCheckpoints[Math.min(
          momentCheckpoints.length - 1,
          Math.floor(linearProgress * (momentCheckpoints.length - 1))
        )];
        displayedSamples = checkpoint.samples;
        render({
          animate: false,
          displayedSamples,
          observedSummary: checkpoint,
          histogramData: interpolateHistogram(startData, finalData, progress),
          maxDensity,
          showNormalOverride: options.deferNormal ? false : undefined
        });
        if (linearProgress >= 1) break;
        if (!(await waitFrame(token, 32))) return;
      }
      if (token !== simulationToken) return;
      isSimulating = false;
      displayedSamples = target;
      render({
        animate: false,
        animateNormal: Boolean(options.deferNormal),
        maxDensity
      });
      notify();
    }

    function changeModel(change, animate) {
      cancelSimulation(false);
      change();
      rebuildModel(true);
      relayoutChart(animate);
      render({ animate, populationSwap: animate });
      notify();
    }

    function setScale(mode, animate) {
      const next = ["se", "standard-error", "standardized"].includes(String(mode)) ? "se" : "raw";
      if (state.scaleMode === next) return;
      state.scaleMode = next;
      render({ animate, scaleChanged: true });
      notify();
    }

    function applyTutorialAction(action, context) {
      const requested = action || {};
      const animate = requested.animate !== false;
      cancelSimulation(false);
      const previousShape = state.shape;
      const previousN = state.n;
      const previousScale = state.scaleMode;
      const previousShowNormal = state.showNormal;
      const previousDistributionVisibility = state.showDistribution;
      let requestedSamples = null;
      let samplingDuration = DEFAULT_SAMPLING_ANIMATION_MS;
      let changed = false;
      Object.entries(requested).forEach(([rawKey, value]) => {
        switch (sampling.actionKey(rawKey)) {
          case "animate":
            break;
          case "distribution":
          case "population-shape":
          case "shape":
            if (["skewed", "normal", "uniform", "bimodal"].includes(value)) {
              state.shape = value;
              changed = true;
            }
            break;
          case "n":
          case "sample-size":
            state.n = sampling.clamp(Math.round(sampling.finite(value, state.n)), 1, 100);
            changed = true;
            break;
          case "samples":
          case "sample-means":
          case "draw":
            requestedSamples = sampling.clamp(Math.round(sampling.finite(value, state.samples)), 0, MAX_SIMULATIONS);
            changed = true;
            break;
          case "duration":
          case "sampling-duration":
            samplingDuration = Math.max(200, sampling.finite(value, samplingDuration));
            break;
          case "scale":
          case "scale-mode":
          case "horizontal-scale":
            state.scaleMode = ["se", "standard-error", "standardized"].includes(String(value)) ? "se" : "raw";
            changed = true;
            break;
          case "show-normal":
          case "normal-reference":
            state.showNormal = sampling.boolean(value, state.showNormal);
            changed = true;
            break;
          case "show-population":
          case "population":
            state.showPopulation = sampling.boolean(value, state.showPopulation);
            changed = true;
            break;
          case "show-distribution":
          case "sampling-distribution":
            state.showDistribution = sampling.boolean(value, state.showDistribution);
            changed = true;
            break;
          case "seed":
            state.seed = String(value);
            changed = true;
            break;
          case "controls":
          case "controls-open":
            if (context && typeof context.setControlsOpen === "function") {
              context.setControlsOpen(sampling.boolean(value, true), animate);
            }
            break;
          default:
            break;
        }
      });
      const populationChanged = state.shape !== previousShape;
      const nChanged = state.n !== previousN;
      if (populationChanged) {
        rebuildModel(true);
        relayoutChart(animate);
      } else if (nChanged) {
        resetSimulation();
      }
      if (!populationChanged && state.showDistribution !== previousDistributionVisibility) {
        relayoutChart(animate);
      }
      const scaleChanged = state.scaleMode !== previousScale;
      if (requestedSamples !== null) {
        render({
          animate: populationChanged || scaleChanged ? animate : false,
          populationSwap: populationChanged && animate,
          scaleChanged
        });
        if (requestedSamples === state.samples) {
          notify();
          return;
        }
        simulateToTotal(requestedSamples, {
          animate,
          duration: samplingDuration,
          deferNormal: state.showNormal && !previousShowNormal,
          startDelay: populationChanged && animate ? POPULATION_SWAP_MS : 0
        });
        return;
      }
      if (changed) {
        render({
          animate,
          populationSwap: populationChanged && animate,
          scaleChanged
        });
        notify();
      }
    }

    shapeInput.addEventListener("change", (event) => {
      event.stopPropagation();
      changeModel(() => { state.shape = shapeInput.value; }, true);
    });
    nInput.addEventListener("input", (event) => {
      event.stopPropagation();
      cancelSimulation(false);
      state.n = sampling.clamp(Math.round(sampling.finite(nInput.value, state.n)), 1, 100);
      resetSimulation();
      render({ animate: false });
      notify();
    });
    rawScaleButton.button.addEventListener("click", (event) => {
      event.preventDefault();
      setScale("raw", true);
    });
    seScaleButton.button.addEventListener("click", (event) => {
      event.preventDefault();
      setScale("se", true);
    });
    hundredThousand.button.addEventListener("click", (event) => {
      event.preventDefault();
      simulateToTotal(state.samples + 100000, { animate: true });
    });
    million.button.addEventListener("click", (event) => {
      event.preventDefault();
      simulateToTotal(state.samples + 1000000, { animate: true });
    });
    reset.button.addEventListener("click", (event) => {
      event.preventDefault();
      cancelSimulation(false);
      resetSimulation();
      render({ animate: false });
      notify();
    });
    normalInput.addEventListener("input", (event) => {
      event.stopPropagation();
      state.showNormal = normalInput.checked;
      render({ animate: true });
      notify();
    });

    rootNode.samplingShapeExplorer = {
      applyTutorialAction,
      simulateSamples(count) { return simulateToTotal(count, { animate: true }); },
      setScale(mode) { setScale(mode, true); },
      setSkew(amount) {
        changeModel(() => {
          state.shape = sampling.finite(amount, 1) > 0 ? "skewed" : "normal";
        }, true);
      },
      reset() {
        cancelSimulation(false);
        resetSimulation();
        render({ animate: false });
        notify();
      },
      stopSampling() { cancelSimulation(true); }
    };

    rootNode.dataset.sfsLayout = compact ? "compact" : "wide";
    buildChart({ width: preferredWidth, compact });
    if (global.interactiveFigure) {
      global.interactiveFigure.observeResponsiveLayout({
        root: rootNode,
        container: chartWrap.node(),
        compactBelow,
        minimumWidth: 240,
        maximumWidth: preferredWidth,
        widthStep: 4,
        onLayout(layout) {
          buildChart(layout);
        }
      });
      global.interactiveFigure.wrap({
        root: rootNode,
        controls: controls.node(),
        label: "sampling shape controls",
        placement: opts.controlsPlacement || "callout",
        layout: opts.controlsLayout || "equal",
        applyAction: applyTutorialAction,
        startOpen: opts.controlsOpen === true
      });
    }
    if (initialSamples > 0) {
      simulateToTotal(initialSamples, { animate: false });
    }
    return rootNode;
  };
}(window));
