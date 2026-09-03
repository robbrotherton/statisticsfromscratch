sdbStats = window.bcStats
sdbNormalInv = sdbStats.normalInv
sdbFiniteNumber = sdbStats.finiteNumber

sdbEnsureStyles = () => {
  if (document.getElementById("sampling-distribution-builder-styles")) return;

  const style = document.createElement("style");
  style.id = "sampling-distribution-builder-styles";
  style.textContent = `
    .sampling-distribution-builder {
      --sdb-block: var(--graph-block-fill, currentColor);
      --sdb-block-stroke: var(--graph-block-stroke, var(--bs-body-bg, #fff));
      --sdb-current: var(--sfs-current-color, #d1495b);
      --sfs-figure-max-width: var(--sdb-max-width, 48rem);
    }

    .sampling-distribution-builder.sdb-cover {
      --sdb-max-width: 46rem;
      --sfs-figure-max-width: var(--sdb-max-width);
    }

    .sampling-distribution-builder .sdb-button .bi {
      line-height: 1;
    }

    .sampling-distribution-builder .sdb-count {
      min-width: 6.8rem;
      color: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
      font-variant-numeric: tabular-nums;
      font-size: 0.9rem;
      line-height: 1.2;
    }

    .sampling-distribution-builder .sdb-axis text,
    .sampling-distribution-builder .sdb-axis-label {
      font-size: 15px;
    }

    .sampling-distribution-builder .sdb-axis-label {
      font-weight: 700;
    }

    .sampling-distribution-builder .sdb-block {
      fill: var(--sdb-block);
      stroke: var(--sdb-block-stroke);
      stroke-width: 0.55;
      vector-effect: non-scaling-stroke;
      opacity: 0;
      shape-rendering: crispEdges;
      transition:
        opacity 120ms ease,
        fill 120ms ease;
    }

    .sampling-distribution-builder .sdb-block.is-visible {
      opacity: 0.94;
    }

    .sampling-distribution-builder .sdb-block.is-current {
      fill: var(--sdb-current);
      opacity: 1;
    }

    .sampling-distribution-builder.sdb-cover .sdb-block {
      fill: var(--sdb-block);
      stroke: var(--sdb-block-stroke);
    }

    .sampling-distribution-builder.sdb-cover .sdb-block.is-visible {
      opacity: 0.96;
    }

    .sampling-distribution-builder.sdb-no-animation .sdb-block {
      transition: none !important;
    }

    @media (max-width: 560px) {
      .sampling-distribution-builder {
        margin-left: 0;
        margin-right: 0;
      }

      .sampling-distribution-builder .sdb-readout {
        font-size: 0.88rem;
      }

      .sampling-distribution-builder .sdb-axis text,
      .sampling-distribution-builder .sdb-axis-label {
        font-size: 18px;
      }

      .sampling-distribution-builder .sdb-button {
        flex: 1 1 8rem;
      }

      .sampling-distribution-builder .sdb-count {
        flex: 1 1 100%;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .sampling-distribution-builder .sdb-block {
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

sdbBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
  return fallback;
}

sdbActionKey = (key) =>
  String(key).trim().toLowerCase().replace(/[\s_]+/g, "-")

sdbHashSeed = (seed) => {
  const text = String(seed ?? "sampling-distribution-v1");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

sdbMulberry32 = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

sdbSeededRng = (seed) => sdbMulberry32(sdbHashSeed(seed))

sdbMean = (values) =>
  values.length ? d3.sum(values) / values.length : NaN

sdbClamp = (value, min, max) =>
  Math.max(min, Math.min(max, value))

sdbNormalDraw = (rng, mean, sd) => {
  const p = sdbClamp(rng(), 1e-10, 1 - 1e-10);
  return sdbNormalInv(p, mean, sd);
}

sdbNumericArray = (values) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

sdbStandardDeviationN = (values) => {
  const numeric = sdbNumericArray(values);
  if (!numeric.length) return NaN;
  const mean = sdbMean(numeric);
  return Math.sqrt(d3.sum(numeric, (value) => (value - mean) * (value - mean)) / numeric.length);
}

sdbSampleFromEntry = (entry) => {
  if (Array.isArray(entry)) return sdbNumericArray(entry);
  if (!entry || typeof entry !== "object") return [];
  return sdbNumericArray(entry.sample || entry.observations || entry.values || entry.scores);
}

sdbFirstFinite = function() {
  for (let i = 0; i < arguments.length; i += 1) {
    const number = Number(arguments[i]);
    if (Number.isFinite(number)) return number;
  }
  return NaN;
}

sdbFinalizeRecords = (records, opts = {}) => {
  const binWidth = Math.max(0.05, sdbFiniteNumber(opts.binWidth, 1));
  const stackCounts = new Map();
  const finalized = records
    .map((record) => {
      const sample = sdbNumericArray(record.sample);
      const mean = sdbFirstFinite(record.mean, record.M, record.value, record.x, sample.length ? sdbMean(sample) : NaN);
      const bin = Number.isFinite(Number(record.bin))
        ? Number(record.bin)
        : Math.round(mean / binWidth) * binWidth;
      return {
        sample,
        mean,
        bin
      };
    })
    .filter((record) => Number.isFinite(record.mean) && Number.isFinite(record.bin))
    .map((record, index) => {
      const binKey = record.bin.toFixed(6);
      const stackIndex = stackCounts.get(binKey) || 0;
      stackCounts.set(binKey, stackIndex + 1);
      return Object.assign({}, record, {
        index,
        stackIndex
      });
    });

  return {
    records: finalized,
    binWidth,
    maxStack: d3.max(finalized, (d) => d.stackIndex + 1) || 1
  };
}

sdbNormalizeExplicitSamples = (opts = {}) => {
  const source = Array.isArray(opts.sampleRows) ? opts.sampleRows :
    Array.isArray(opts.records) ? opts.records :
    Array.isArray(opts.samples) ? opts.samples :
    Array.isArray(opts.sampleMeans) ? opts.sampleMeans :
    Array.isArray(opts.means) ? opts.means :
    [];

  if (!source.length) return null;

  return source.map((entry) => {
    if (typeof entry === "number") return { sample: [], mean: entry };
    const sample = sdbSampleFromEntry(entry);
    if (Array.isArray(entry)) return { sample };
    return Object.assign({}, entry, { sample });
  });
}

sdbExhaustiveSamples = (population, sampleSize, opts = {}) => {
  const values = sdbNumericArray(population);
  const n = Math.max(1, Math.round(sdbFiniteNumber(sampleSize, 2)));
  const replacement = sdbBoolean(opts.replacement, true);
  const ordered = sdbBoolean(opts.ordered, true);
  const maxSamples = Math.max(1, Math.round(sdbFiniteNumber(opts.maxExhaustiveSamples, 50000)));
  const firstVariesFastest = String(opts.sampleOrder || opts.order || "first-varies-fastest")
    .toLowerCase()
    .replace(/[\s_]+/g, "-") !== "last-varies-fastest";
  const samples = [];

  if (!values.length) return samples;

  if (replacement && ordered) {
    const count = Math.pow(values.length, n);
    if (count > maxSamples) {
      console.warn("Exhaustive sampling distribution capped at", maxSamples, "samples.");
    }
    const usableCount = Math.min(count, maxSamples);
    for (let index = 0; index < usableCount; index += 1) {
      const sample = [];
      for (let position = 0; position < n; position += 1) {
        const exponent = firstVariesFastest ? position : n - position - 1;
        const valueIndex = Math.floor(index / Math.pow(values.length, exponent)) % values.length;
        sample.push(values[valueIndex]);
      }
      samples.push({ sample });
    }
    return samples;
  }

  function visit(sample, used, start) {
    if (samples.length >= maxSamples) return;
    if (sample.length === n) {
      samples.push({ sample: sample.slice() });
      return;
    }

    const begin = ordered ? 0 : start;
    for (let index = begin; index < values.length; index += 1) {
      if (!replacement && used.has(index)) continue;
      sample.push(values[index]);
      used.add(index);
      visit(sample, used, replacement && !ordered ? index : index + 1);
      used.delete(index);
      sample.pop();
    }
  }

  visit([], new Set(), 0);
  return samples;
}

sdbBuildSamples = (opts = {}) => {
  const population = sdbNumericArray(opts.population);
  const explicitSamples = sdbNormalizeExplicitSamples(opts);
  const sampleSize = Math.max(1, Math.round(sdbFiniteNumber(opts.sampleSize ?? opts.n, 10)));
  const binWidth = Math.max(0.05, sdbFiniteNumber(opts.binWidth, 1));
  const mean = sdbFiniteNumber(opts.mean ?? opts.mu, population.length ? sdbMean(population) : 100);
  const sd = Math.max(0.01, sdbFiniteNumber(opts.sd ?? opts.sigma, population.length ? sdbStandardDeviationN(population) : 15));
  const shouldUseExhaustive = population.length && sdbBoolean(opts.exhaustive, false);

  if (explicitSamples || shouldUseExhaustive) {
    const rows = explicitSamples || sdbExhaustiveSamples(population, sampleSize, opts);
    const finalized = sdbFinalizeRecords(rows, { binWidth });
    const firstSample = finalized.records.find((record) => record.sample.length);
    return Object.assign(finalized, {
      mean,
      sd,
      population,
      source: explicitSamples ? "explicit" : "exhaustive",
      sampleSize: firstSample ? firstSample.sample.length : sampleSize,
      sampleCount: finalized.records.length
    });
  }

  const sampleCount = Math.max(1, Math.round(sdbFiniteNumber(opts.sampleCount ?? opts.samples, 200)));
  const roundObservations = sdbBoolean(opts.roundObservations, true);
  const rng = sdbSeededRng(opts.seed ?? "sampling-distribution-v1");
  const stackCounts = new Map();
  const records = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = [];
    for (let j = 0; j < sampleSize; j += 1) {
      const value = sdbNormalDraw(rng, mean, sd);
      sample.push(roundObservations ? Math.round(value) : value);
    }

    const sampleMean = sdbMean(sample);
    const bin = Math.round(sampleMean / binWidth) * binWidth;
    const binKey = bin.toFixed(6);
    const stackIndex = stackCounts.get(binKey) || 0;
    stackCounts.set(binKey, stackIndex + 1);
    records.push({
      index,
      sample,
      mean: sampleMean,
      bin,
      stackIndex
    });
  }

  return {
    records,
    mean,
    sd,
    population,
    source: "simulated",
    sampleSize,
    sampleCount,
    binWidth,
    maxStack: d3.max(records, (d) => d.stackIndex + 1) || 1
  };
}

makeSamplingDistributionBuilder = function(opts) {
  opts = opts || {};
  sdbEnsureStyles();

  const variant = opts.variant || (opts.cover ? "cover" : "interactive");
  const isCover = variant === "cover";
  const isStatic = variant === "static" || variant === "final";
  const width = sdbFiniteNumber(opts.width, isCover ? 760 : 760);
  const requestedHeight = sdbFiniteNumber(opts.height, isCover ? 280 : isStatic ? 300 : 420);
  const margin = isCover
    ? { top: 10, right: 10, bottom: 10, left: 10 }
    : { top: 18, right: 24, bottom: 70, left: 30 };
  const axisSquareBlocks = sdbBoolean(opts.axisSquareBlocks ?? opts.axisSquare, true);
  const fMean = d3.format(".1~f");
  const fAxis = d3.format(".0f");
  const initialPopulation = sdbNumericArray(opts.population);

  const state = {
    seed: String(opts.seed ?? "sampling-distribution-v1"),
    mean: sdbFiniteNumber(opts.mean ?? opts.mu, initialPopulation.length ? sdbMean(initialPopulation) : 100),
    sd: Math.max(0.01, sdbFiniteNumber(opts.sd ?? opts.sigma, initialPopulation.length ? sdbStandardDeviationN(initialPopulation) : 15)),
    sampleSize: Math.max(1, Math.round(sdbFiniteNumber(opts.sampleSize ?? opts.n, 10))),
    sampleCount: Math.max(1, Math.round(sdbFiniteNumber(opts.sampleCount ?? opts.samples, 200))),
    binWidth: Math.max(0.05, sdbFiniteNumber(opts.binWidth, 1)),
    population: initialPopulation,
    sampleRows: Array.isArray(opts.sampleRows) ? opts.sampleRows : undefined,
    records: Array.isArray(opts.records) ? opts.records : undefined,
    samples: Array.isArray(opts.samples) ? opts.samples : undefined,
    sampleMeans: Array.isArray(opts.sampleMeans) ? opts.sampleMeans : undefined,
    means: Array.isArray(opts.means) ? opts.means : undefined,
    exhaustive: sdbBoolean(opts.exhaustive, false),
    replacement: sdbBoolean(opts.replacement, true),
    ordered: sdbBoolean(opts.ordered, true),
    sampleOrder: opts.sampleOrder || opts.order || "first-varies-fastest",
    maxExhaustiveSamples: Math.max(1, Math.round(sdbFiniteNumber(opts.maxExhaustiveSamples, 50000))),
    xlim: Array.isArray(opts.xlim) && opts.xlim.length >= 2 ? opts.xlim.slice(0, 2) : [75, 125],
    roundObservations: sdbBoolean(opts.roundObservations, true),
    drawCount: Math.max(0, Math.round(sdbFiniteNumber(opts.initialCount ?? opts.draw, 0))),
    showObservations: sdbBoolean(opts.showObservations ?? opts.observations, !isCover && !isStatic),
    showMean: sdbBoolean(opts.showMean ?? opts.meanLabel, !isCover && !isStatic),
    showAxis: sdbBoolean(opts.showAxis ?? opts.axis, !isCover),
    showActions: sdbBoolean(opts.showActions ?? opts.actionControls ?? opts.actionButtons, !isCover && !isStatic),
    controls: sdbBoolean(opts.controls, !isCover && !isStatic),
    highlightCurrent: sdbBoolean(opts.highlightCurrent, !isCover && !isStatic),
    playing: false
  };

  let computed = sdbBuildSamples(state);
  if (isStatic && opts.draw === undefined && opts.initialCount === undefined) {
    state.drawCount = computed.records.length;
  }
  state.drawCount = sdbClamp(state.drawCount, 0, computed.records.length);
  let currentHeight = requestedHeight;
  let chartBottom = currentHeight - margin.bottom;

  const root = d3.create("div")
    .attr("class", "sfs-figure sampling-distribution-builder " + (isCover ? "sfs-figure-cover sdb-cover" : isStatic ? "sdb-static" : "sdb-interactive"))
    .style("--sfs-figure-max-width", opts.maxWidth || (isCover ? "46rem" : "48rem"))
    .style("--sdb-max-width", opts.maxWidth || (isCover ? "46rem" : "48rem"));
  const rootNode = root.node();

  let controls = null;
  let observationsInput = null;
  let meanInput = null;
  let axisInput = null;
  let actionsInput = null;
  let actionsPanel = null;
  let countNode = null;
  let playButton = null;
  let playIcon = null;
  let playText = null;
  let nextButton = null;
  let resetButton = null;
  let playTimer = null;
  let playTarget = null;
  let blockSelection = null;

  if (state.controls) {
    controls = root.append("div")
      .attr("class", "sdb-controls sfs-control-grid");

    const displayPanel = controls.append("section")
      .attr("class", "sdb-group sfs-control-panel sfs-if-control-panel");
    displayPanel.append("p")
      .attr("class", "sdb-group-title sfs-control-title")
      .text("Show");
    observationsInput = addCheckbox(displayPanel, "Observations", state.showObservations);
    meanInput = addCheckbox(displayPanel, "Mean", state.showMean);
    axisInput = addCheckbox(displayPanel, "Axis labels", state.showAxis);
    actionsInput = addCheckbox(displayPanel, "Action buttons", state.showActions);

    actionsPanel = controls.append("section")
      .attr("class", "sdb-group sfs-control-panel sfs-if-control-panel");
    actionsPanel.append("p")
      .attr("class", "sdb-group-title sfs-control-title")
      .text("Actions");
    const actionRow = actionsPanel.append("div")
      .attr("class", "sdb-action-row sfs-action-row");
    const reset = addButton(actionRow, "arrow-counterclockwise", "Reset");
    const next = addButton(actionRow, "skip-forward-fill", "Next sample");
    const play = addButton(actionRow, "play-fill", "Run");
    resetButton = reset.button;
    nextButton = next.button;
    playButton = play.button;
    playIcon = play.icon;
    playText = play.text;
    countNode = actionRow.append("span")
      .attr("class", "sdb-count")
      .attr("aria-live", "polite")
      .node();
  }

  const readout = root.append("div")
    .attr("class", "sdb-readout sfs-readout");
  const observationsRow = readout.append("div")
    .attr("class", "sdb-readout-row sfs-readout-row sdb-observations-row");
  observationsRow.append("span")
    .attr("class", "sdb-readout-label sfs-readout-label")
    .text("Observations");
  const observationsValue = observationsRow.append("span")
    .attr("class", "sdb-readout-value sfs-readout-value")
    .node();
  const meanRow = readout.append("div")
    .attr("class", "sdb-readout-row sfs-readout-row sdb-mean-row");
  meanRow.append("span")
    .attr("class", "sdb-readout-label sfs-readout-label")
    .text("Mean");
  const meanValue = meanRow.append("span")
    .attr("class", "sdb-readout-value sfs-readout-value")
    .node();

  const chartWrap = root.append("div")
    .attr("class", "sdb-chart-wrap sfs-chart-wrap");
  const svg = chartWrap.append("svg")
    .attr("viewBox", [0, 0, width, currentHeight])
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("class", "sfs-svg sfs-graph sfs-graph-block-histogram")
    .attr("role", "img")
    .attr("aria-label", opts.ariaLabel || "Block histogram showing repeated sample means forming a sampling distribution");

  const x = d3.scaleLinear()
    .domain(state.xlim)
    .range([margin.left, width - margin.right]);
  const maxBlockSize = Math.max(2, sdbFiniteNumber(opts.maxBlockSize ?? opts.blockMaxSize, isCover ? 18 : isStatic ? 28 : 18));

  const blocksLayer = svg.append("g")
    .attr("class", "sdb-blocks sfs-graph-blocks");

  const axisLayer = svg.append("g")
    .attr("class", "sdb-axis sfs-axis sfs-graph-axis")
    .attr("transform", "translate(0," + chartBottom + ")");

  const axisLabel = svg.append("text")
    .attr("class", "sdb-axis-label sfs-axis-label sfs-graph-label sfs-graph-x-label")
    .attr("x", (margin.left + width - margin.right) / 2)
    .attr("y", currentHeight - 24)
    .attr("text-anchor", "middle")
    .text(opts.axisLabel || "Sample mean");

  function addCheckbox(parent, label, checked) {
    const row = parent.append("label")
      .attr("class", "sdb-check-row sfs-check-row");
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
      .attr("class", "sdb-button sfs-button")
      .attr("aria-label", label)
      .attr("title", label)
      .attr("data-prevent-swipe", "")
      .node();
    const iconNode = document.createElement("i");
    iconNode.className = "bi bi-" + icon;
    iconNode.setAttribute("aria-hidden", "true");
    const textNode = document.createElement("span");
    textNode.textContent = label;
    button.append(iconNode, textNode);
    return { button, icon: iconNode, text: textNode };
  }

  function prefersReducedMotion() {
    return window.interactiveRuntime && window.interactiveRuntime.motion
      ? window.interactiveRuntime.motion.isReduced()
      : Boolean(window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function documentIsVisible() {
    return typeof document === "undefined" || !document.hidden;
  }

  function elementIsVisibleNow() {
    if (!rootNode.isConnected) return false;
    const rect = rootNode.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    return rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < viewportHeight &&
      rect.left < viewportWidth;
  }

  function whenVisible(callback, threshold) {
    let fired = false;
    const fire = (observer) => {
      if (fired) return;
      fired = true;
      callback();
      if (observer) observer.disconnect();
    };

    if (!("IntersectionObserver" in window)) {
      requestAnimationFrame(() => fire(null));
      return;
    }

    const observer = new IntersectionObserver(([entry], obs) => {
      if (entry.isIntersecting) fire(obs);
    }, { threshold: threshold || 0.25 });
    observer.observe(rootNode);

    requestAnimationFrame(() => {
      if (elementIsVisibleNow()) fire(observer);
    });
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  function setValue() {
    const current = state.drawCount > 0 ? computed.records[state.drawCount - 1] : null;
    rootNode.value = {
      seed: state.seed,
      sampleSize: computed.sampleSize,
      n: computed.sampleSize,
      sampleCount: computed.sampleCount,
      samplesDrawn: state.drawCount,
      drawCount: state.drawCount,
      mean: computed.mean,
      sd: computed.sd,
      population: computed.population ? computed.population.slice() : [],
      source: computed.source,
      binWidth: computed.binWidth,
      axisSquareBlocks,
      currentSample: current ? current.sample.slice() : [],
      currentMean: current ? current.mean : null,
      currentBin: current ? current.bin : null,
      samples: computed.records.map((record) => record.sample.slice()),
      sampleMeans: computed.records.map((record) => record.mean),
      showObservations: state.showObservations,
      showMean: state.showMean,
      showAxis: state.showAxis,
      showActions: state.showActions
    };
  }

  function syncControls() {
    if (observationsInput) observationsInput.checked = state.showObservations;
    if (meanInput) meanInput.checked = state.showMean;
    if (axisInput) axisInput.checked = state.showAxis;
    if (actionsInput) actionsInput.checked = state.showActions;
    if (actionsPanel) actionsPanel.style.display = state.showActions ? null : "none";
    if (countNode) {
      countNode.textContent = state.drawCount + " / " + computed.records.length;
    }
    if (nextButton) nextButton.disabled = state.drawCount >= computed.records.length;
    if (resetButton) resetButton.disabled = state.drawCount <= 0 && !state.playing;
    updatePlayButton();
  }

  function updatePlayButton() {
    if (!playButton) return;
    playButton.disabled = state.drawCount >= computed.records.length && !state.playing;
    playButton.setAttribute("aria-label", state.playing ? "Pause" : "Run continuously");
    playButton.title = state.playing ? "Pause" : "Run continuously";
    if (playIcon) playIcon.className = "bi bi-" + (state.playing ? "pause-fill" : "play-fill");
    if (playText) playText.textContent = state.playing ? "Pause" : "Run";
  }

  function updateReadout() {
    const current = state.drawCount > 0 ? computed.records[state.drawCount - 1] : null;
    const showAny = state.showObservations || state.showMean;
    readout.attr("hidden", showAny ? null : true);
    observationsRow.style("display", state.showObservations ? null : "none");
    meanRow.style("display", state.showMean ? null : "none");

    if (!current) {
      observationsValue.textContent = "No sample drawn";
      meanValue.textContent = "No sample drawn";
      return;
    }

    observationsValue.textContent = current.sample.map((value) => d3.format(".0f")(value)).join(", ");
    meanValue.textContent = "M = " + fMean(current.mean);
  }

  function updateAxis() {
    const renderedWidth = rootNode.getBoundingClientRect().width || width;
    const axis = d3.axisBottom(x)
      .ticks(renderedWidth < 430 ? 5 : Math.min(8, Math.max(2, Math.round((state.xlim[1] - state.xlim[0]) / 5))))
      .tickFormat(fAxis)
      .tickSizeOuter(0);
    axisLayer.call(axis);
    axisLayer.style("display", state.showAxis ? null : "none");
    axisLabel.style("display", state.showAxis ? null : "none");
  }

  function blockLayout() {
    const binPx = Math.abs(x(state.xlim[0] + computed.binWidth) - x(state.xlim[0]));
    const yStep = axisSquareBlocks
      ? Math.max(1, binPx)
      : Math.max(2.5, Math.min(binPx, (requestedHeight - margin.bottom - margin.top) / computed.maxStack, maxBlockSize));
    currentHeight = axisSquareBlocks
      ? Math.max(requestedHeight, margin.top + computed.maxStack * yStep + margin.bottom)
      : requestedHeight;
    chartBottom = currentHeight - margin.bottom;
    svg.attr("viewBox", [0, 0, width, currentHeight]);
    axisLayer.attr("transform", "translate(0," + chartBottom + ")");
    axisLabel
      .attr("x", (margin.left + width - margin.right) / 2)
      .attr("y", currentHeight - 24);

    const blockSize = axisSquareBlocks ? yStep : Math.max(2, yStep * 0.9);
    return {
      axisSquareBlocks,
      yStep,
      blockSize,
      blockWidth: Math.max(1, binPx),
      xOffset: blockSize / 2,
      yOffset: axisSquareBlocks ? 0 : (yStep - blockSize) / 2
    };
  }

  function renderBlocks() {
    const layout = blockLayout();
    blockSelection = blocksLayer.selectAll("rect")
      .data(computed.records, (d) => d.index);

    blockSelection.exit().remove();

    blockSelection = blockSelection.enter()
      .append("rect")
      .attr("class", "sdb-block sfs-graph-block")
      .merge(blockSelection)
      .attr("x", (d) => {
        if (!layout.axisSquareBlocks) return x(d.bin) - layout.xOffset;
        const left = x(d.bin - computed.binWidth / 2);
        const right = x(d.bin + computed.binWidth / 2);
        return Math.min(left, right);
      })
      .attr("y", (d) => chartBottom - (d.stackIndex + 1) * layout.yStep + layout.yOffset)
      .attr("width", (d) => {
        if (!layout.axisSquareBlocks) return layout.blockSize;
        const left = x(d.bin - computed.binWidth / 2);
        const right = x(d.bin + computed.binWidth / 2);
        return Math.max(1, Math.abs(right - left));
      })
      .attr("height", layout.blockSize);
  }

  function renderVisibility(animate) {
    if (!blockSelection) return;
    if (!animate) rootNode.classList.add("sdb-no-animation");
    blockSelection
      .classed("is-visible", (d) => d.index < state.drawCount)
      .classed("is-current", (d) => state.highlightCurrent && d.index === state.drawCount - 1);
    if (!animate) {
      rootNode.getBoundingClientRect();
      requestAnimationFrame(() => rootNode.classList.remove("sdb-no-animation"));
    }
  }

  function update(notify, options) {
    options = options || {};
    syncControls();
    updateReadout();
    updateAxis();
    renderVisibility(options.animate !== false);
    setValue();
    if (notify) notifyValueChange();
  }

  function rebuildSamples() {
    computed = sdbBuildSamples(state);
    state.drawCount = sdbClamp(state.drawCount, 0, computed.records.length);
    x.domain(state.xlim);
    renderBlocks();
  }

  function stopPlaying() {
    if (playTimer) {
      window.clearTimeout(playTimer);
      playTimer = null;
    }
    state.playing = false;
    playTarget = null;
    updatePlayButton();
    syncControls();
  }

  function advanceOne(notify, animate) {
    if (state.drawCount >= computed.records.length) {
      stopPlaying();
      return false;
    }
    state.drawCount += 1;
    update(notify, { animate });
    return true;
  }

  function playTo(target, notify, delay) {
    playTarget = sdbClamp(Math.round(target), 0, computed.records.length);
    if (state.drawCount >= playTarget) {
      stopPlaying();
      return;
    }

    state.playing = true;
    updatePlayButton();

    const tick = () => {
      playTimer = null;
      if (!state.playing) return;
      if (state.drawCount >= playTarget) {
        stopPlaying();
        return;
      }
      if (!documentIsVisible() || !elementIsVisibleNow()) {
        playTimer = window.setTimeout(tick, Math.max(80, delay));
        return;
      }
      advanceOne(notify, true);
      if (state.drawCount >= playTarget) {
        stopPlaying();
        return;
      }
      playTimer = window.setTimeout(tick, delay);
    };

    playTimer = window.setTimeout(tick, delay);
  }

  function setDrawCount(count, options) {
    options = options || {};
    const nextCount = sdbClamp(Math.round(sdbFiniteNumber(count, state.drawCount)), 0, computed.records.length);
    const animate = options.animate !== false;
    stopPlaying();

    if (animate && nextCount > state.drawCount + 1 && !prefersReducedMotion()) {
      playTo(nextCount, options.notify !== false, sdbFiniteNumber(options.delay, isCover ? 18 : 65));
      return;
    }

    state.drawCount = nextCount;
    update(options.notify !== false, { animate });
  }

  function reset(notify) {
    stopPlaying();
    state.drawCount = 0;
    update(notify, { animate: false });
  }

  function togglePlay() {
    if (state.playing) {
      stopPlaying();
      return;
    }
    playTo(computed.records.length, true, sdbFiniteNumber(opts.playDelay, 85));
  }

  function readDisplayControls() {
    if (observationsInput) state.showObservations = observationsInput.checked;
    if (meanInput) state.showMean = meanInput.checked;
    if (axisInput) state.showAxis = axisInput.checked;
    if (actionsInput) state.showActions = actionsInput.checked;
  }

  function setNumeric(value, setter) {
    const number = Number(value);
    if (!Number.isFinite(number)) return false;
    setter(number);
    return true;
  }

  function setXlim(value) {
    if (!Array.isArray(value) || value.length < 2) return false;
    const lo = Number(value[0]);
    const hi = Number(value[1]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) return false;
    state.xlim = lo < hi ? [lo, hi] : [hi, lo];
    return true;
  }

  function applyTutorialAction(action, context) {
    action = action || {};
    const animate = action.animate !== false;
    let changed = false;
    let rebuild = false;
    let targetDraw = null;
    let playRequested = null;

    Object.entries(action).forEach(([rawKey, value]) => {
      const key = sdbActionKey(rawKey);
      switch (key) {
        case "animate":
          break;
        case "seed":
          state.seed = String(value);
          rebuild = true;
          changed = true;
          break;
        case "mean":
          if (typeof value === "boolean") {
            state.showMean = value;
            changed = true;
            break;
          }
          if (typeof value === "string" && ["true", "false", "show", "hide", "on", "off", "yes", "no"].includes(value.trim().toLowerCase())) {
            state.showMean = sdbBoolean(value, state.showMean);
            changed = true;
            break;
          }
          rebuild = setNumeric(value, (number) => { state.mean = number; }) || rebuild;
          changed = true;
          break;
        case "mu":
        case "population-mean":
          rebuild = setNumeric(value, (number) => { state.mean = number; }) || rebuild;
          changed = true;
          break;
        case "sd":
        case "sigma":
        case "population-sd":
          rebuild = setNumeric(value, (number) => { state.sd = Math.max(0.01, number); }) || rebuild;
          changed = true;
          break;
        case "n":
        case "sample-size":
          rebuild = setNumeric(value, (number) => { state.sampleSize = Math.max(1, Math.round(number)); }) || rebuild;
          changed = true;
          break;
        case "samples":
        case "sample-count":
          rebuild = setNumeric(value, (number) => { state.sampleCount = Math.max(1, Math.round(number)); }) || rebuild;
          changed = true;
          break;
        case "bin-width":
          rebuild = setNumeric(value, (number) => { state.binWidth = Math.max(0.05, number); }) || rebuild;
          changed = true;
          break;
        case "xlim":
        case "x-limits":
          rebuild = setXlim(value) || rebuild;
          changed = true;
          break;
        case "draw":
        case "count":
        case "samples-drawn":
          targetDraw = Math.round(sdbFiniteNumber(value, state.drawCount));
          break;
        case "next":
        case "next-sample":
        case "add":
        case "add-sample":
          if (sdbBoolean(value, true)) targetDraw = state.drawCount + 1;
          break;
        case "reset":
          if (sdbBoolean(value, true)) targetDraw = 0;
          break;
        case "play":
        case "run":
        case "run-continuously":
          playRequested = sdbBoolean(value, true);
          break;
        case "observations":
        case "show-observations":
        case "sample-observations":
        case "sample-list":
          state.showObservations = sdbBoolean(value, state.showObservations);
          changed = true;
          break;
        case "show-mean":
        case "sample-mean":
        case "mean-label":
          state.showMean = sdbBoolean(value, state.showMean);
          changed = true;
          break;
        case "axis":
        case "labels":
        case "axis-labels":
        case "show-axis":
          state.showAxis = sdbBoolean(value, state.showAxis);
          changed = true;
          break;
        case "show-controls":
        case "show-actions":
        case "actions":
        case "buttons":
        case "action-buttons":
        case "action-controls":
          state.showActions = sdbBoolean(value, state.showActions);
          changed = true;
          break;
        case "highlight":
        case "highlight-current":
        case "current-highlight":
          state.highlightCurrent = sdbBoolean(value, state.highlightCurrent);
          changed = true;
          break;
        case "controls":
        case "controls-open":
          if (context && typeof context.setControlsOpen === "function") {
            context.setControlsOpen(sdbBoolean(value, true), animate);
          }
          break;
        default:
          break;
      }
    });

    if (rebuild) {
      stopPlaying();
      rebuildSamples();
      changed = true;
    }

    if (targetDraw !== null) {
      setDrawCount(targetDraw, { animate, notify: true, delay: sdbFiniteNumber(action.delay, isCover ? 18 : 65) });
      return;
    }

    if (playRequested !== null) {
      if (playRequested) {
        playTo(computed.records.length, true, sdbFiniteNumber(action.delay, opts.playDelay ?? 85));
      } else {
        stopPlaying();
      }
      return;
    }

    if (changed) {
      update(true, { animate });
    }
  }

  if (observationsInput) {
    [observationsInput, meanInput, axisInput, actionsInput].forEach((input) => {
      input.addEventListener("input", (event) => {
        event.stopPropagation();
        readDisplayControls();
        update(true, { animate: true });
      });
    });
  }

  if (nextButton) {
    nextButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      stopPlaying();
      advanceOne(true, true);
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      reset(true);
    });
  }

  if (playButton) {
    playButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePlay();
    });
  }

  rootNode.samplingDistributionBuilder = {
    next() { advanceOne(true, true); },
    reset() { reset(true); },
    play() { playTo(computed.records.length, true, sdbFiniteNumber(opts.playDelay, 85)); },
    pause() { stopPlaying(); },
    setDrawCount(count) { setDrawCount(count, { animate: true, notify: true }); },
    applyTutorialAction
  };

  renderBlocks();
  update(false, { animate: false });

  if (state.controls && window.interactiveFigure) {
    window.interactiveFigure.wrap({
      root: rootNode,
      controls: controls.node(),
      label: "sampling distribution controls",
      placement: opts.controlsPlacement || "callout",
      layout: opts.controlsLayout || "equal",
      applyAction: applyTutorialAction,
      startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
    });
  }

  if (isCover && sdbBoolean(opts.animate, true)) {
    if (prefersReducedMotion()) {
      setDrawCount(computed.records.length, { animate: false, notify: false });
    } else {
      whenVisible(() => {
        setDrawCount(computed.records.length, {
          animate: true,
          notify: false,
          delay: sdbFiniteNumber(opts.coverDelay, 18)
        });
      }, 0.2);
    }
  }

  return rootNode;
}
