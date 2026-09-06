cieStats = window.sfsStats
cieTInv = cieStats.tInv
cieFiniteNumber = cieStats.finiteNumber

cieEnsureStyles = () => {
  if (document.getElementById("confidence-interval-explorer-styles")) return;

  const style = document.createElement("style");
  style.id = "confidence-interval-explorer-styles";
  style.textContent = `
    .confidence-interval-explorer {
      --cie-hit: var(--sfs-confidence-color, #2f6f9f);
      --cie-miss: var(--sfs-critical-color, #c63f3f);
      --cie-neutral: var(--sfs-neutral-color, #7b818a);
      --sfs-figure-max-width: var(--cie-max-width, 46rem);
    }

    .confidence-interval-explorer .cie-value {
      justify-self: end;
      min-width: 2.6rem;
      font-variant-numeric: tabular-nums;
      color: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
    }

    .confidence-interval-explorer .cie-control-row {
      display: grid;
      grid-template-columns: auto minmax(2.6rem, auto) minmax(7rem, 1fr);
      align-items: center;
      gap: 0.45rem;
      margin: 0.28rem 0;
      font-size: 0.95rem;
    }

    .confidence-interval-explorer .cie-control-row select {
      grid-column: 2 / 4;
      width: 100%;
    }

    .confidence-interval-explorer .cie-control-row input[type="range"] {
      width: 100%;
      min-width: 5rem;
    }

    .confidence-interval-explorer .cie-count {
      min-width: 6.4rem;
      color: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
      font-variant-numeric: tabular-nums;
      font-size: 0.9rem;
      line-height: 1.2;
      align-self: center;
    }

    /* Playing cards are physical objects: they stay light-faced with red and
       black pips in both themes, like real cards on any table. */
    .confidence-interval-explorer .cie-cards {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.4rem;
      margin: 0.35rem auto 0.2rem;
      min-height: 3.1rem;
    }

    .confidence-interval-explorer .cie-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.08rem;
      width: 2.15rem;
      height: 3rem;
      border: 1px solid rgba(28, 28, 30, 0.35);
      border-radius: 0.34rem;
      background: #fdfdfa;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
      color: #1c1c1e;
      transition: opacity 200ms ease, transform 200ms ease;
    }

    .confidence-interval-explorer .cie-card-rank {
      font-weight: 700;
      font-size: 0.95rem;
      line-height: 1;
    }

    .confidence-interval-explorer .cie-card-suit {
      font-size: 1.05rem;
      line-height: 1;
    }

    .confidence-interval-explorer .cie-card.is-red {
      color: #bd3a3a;
    }

    .confidence-interval-explorer .cie-card.is-face-down {
      background-color: #eef1f5;
      background-image: repeating-linear-gradient(
        45deg,
        rgba(84, 110, 149, 0.5) 0,
        rgba(84, 110, 149, 0.5) 2px,
        transparent 2px,
        transparent 6px
      );
    }

    .confidence-interval-explorer .cie-card.is-face-down > * {
      visibility: hidden;
    }

    .confidence-interval-explorer .cie-cards.cie-cards-sm .cie-card {
      width: 1.85rem;
      height: 2.55rem;
    }

    .confidence-interval-explorer .cie-cards.cie-cards-xs .cie-card {
      width: 1.55rem;
      height: 2.15rem;
      border-radius: 0.28rem;
    }

    .confidence-interval-explorer .cie-cards.cie-cards-xs .cie-card-rank {
      font-size: 0.78rem;
    }

    .confidence-interval-explorer .cie-cards.cie-cards-xs .cie-card-suit {
      font-size: 0.85rem;
    }

    .confidence-interval-explorer .cie-sample-readout {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 0.3rem 0.65rem;
      margin: 0.1rem 0 0.25rem;
      min-height: 1.7rem;
      text-align: center;
      font-size: 0.95rem;
      font-variant-numeric: tabular-nums;
    }

    .confidence-interval-explorer .cie-verdict {
      padding: 0.1rem 0.55rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--cie-hit);
      background: color-mix(in srgb, var(--cie-hit) 14%, transparent);
      transition: color 300ms ease, background 300ms ease;
    }

    .confidence-interval-explorer .cie-verdict.is-miss {
      color: var(--cie-miss);
      background: color-mix(in srgb, var(--cie-miss) 14%, transparent);
    }

    .confidence-interval-explorer .cie-verdict.is-unknown {
      color: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
      background: color-mix(in srgb, currentColor 12%, transparent);
    }

    .confidence-interval-explorer .cie-interval line {
      stroke: var(--cie-hit);
      stroke-width: 2.4;
      stroke-linecap: round;
      transition: stroke 300ms ease;
    }

    .confidence-interval-explorer .cie-interval circle {
      fill: var(--cie-hit);
      stroke: var(--sfs-bg, var(--bs-body-bg, #fff));
      stroke-width: 1;
      transition: fill 300ms ease;
    }

    .confidence-interval-explorer .cie-interval.is-miss line {
      stroke: var(--cie-miss);
    }

    .confidence-interval-explorer .cie-interval.is-miss circle {
      fill: var(--cie-miss);
    }

    .confidence-interval-explorer.cie-neutral .cie-interval line {
      stroke: var(--cie-neutral);
    }

    .confidence-interval-explorer.cie-neutral .cie-interval circle {
      fill: var(--cie-neutral);
    }

    .confidence-interval-explorer .cie-mu-line {
      stroke: var(--graph-axis-color, currentColor);
      stroke-width: 1.6;
      stroke-dasharray: 6 5;
    }

    .confidence-interval-explorer .cie-mu-label {
      fill: var(--graph-text-color, currentColor);
      font-size: 15px;
      font-weight: 600;
      paint-order: stroke;
      stroke: var(--sfs-bg, var(--bs-body-bg, #fff));
      stroke-width: 5px;
      stroke-linejoin: round;
    }

    .confidence-interval-explorer .cie-axis text {
      font-size: 14px;
    }

    .confidence-interval-explorer .cie-axis-label {
      font-size: 14px;
      font-weight: 600;
    }

    .confidence-interval-explorer .cie-summary {
      margin: 0.35rem 0 0;
      text-align: center;
      font-size: 0.95rem;
      font-variant-numeric: tabular-nums;
      min-height: 1.4rem;
    }

    .confidence-interval-explorer .cie-summary .cie-hit-text {
      color: var(--cie-hit);
      font-weight: 600;
    }

    .confidence-interval-explorer .cie-summary .cie-miss-text {
      color: var(--cie-miss);
      font-weight: 600;
    }

    .confidence-interval-explorer .cie-decision-line {
      margin: 0.15rem 0 0;
      text-align: center;
      font-size: 0.9rem;
      font-variant-numeric: tabular-nums;
      color: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
    }

    .confidence-interval-explorer.cie-no-animation .cie-card,
    .confidence-interval-explorer.cie-no-animation .cie-interval line,
    .confidence-interval-explorer.cie-no-animation .cie-interval circle,
    .confidence-interval-explorer.cie-no-animation .cie-verdict {
      transition: none !important;
    }

    @media (max-width: 560px) {
      .confidence-interval-explorer .cie-button {
        flex: 1 1 7rem;
      }

      .confidence-interval-explorer .cie-count {
        flex: 1 1 100%;
      }

      .confidence-interval-explorer .cie-axis text {
        font-size: 17px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .confidence-interval-explorer .cie-card,
      .confidence-interval-explorer .cie-interval line,
      .confidence-interval-explorer .cie-interval circle,
      .confidence-interval-explorer .cie-verdict {
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

cieBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
  return fallback;
}

cieActionKey = (key) =>
  String(key).trim().toLowerCase().replace(/[\s_]+/g, "-")

cieHashSeed = (seed) => {
  const text = String(seed ?? "ci-deck-v1");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

cieMulberry32 = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

cieSeededRng = (seed) => cieMulberry32(cieHashSeed(seed))

cieClamp = (value, min, max) =>
  Math.max(min, Math.min(max, value))

makeConfidenceIntervalExplorer = function(opts) {
  opts = opts || {};
  cieEnsureStyles();

  const MU = 7;
  const SIGMA = Math.sqrt(14);
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const SUITS = ["♠", "♥", "♦", "♣"];
  const RED_SUITS = new Set([1, 2]);
  const WINDOW_SIZE = 30;

  const width = cieFiniteNumber(opts.width, 680);
  const height = cieFiniteNumber(opts.height, 380);
  const margin = { top: 26, right: 16, bottom: 46, left: 46 };
  const fMean = d3.format(".2f");
  const fPct = d3.format(".1f");
  const f0 = d3.format(".0f");

  const state = {
    seed: String(opts.seed ?? "ci-deck-v1"),
    sampleSize: cieClamp(Math.round(cieFiniteNumber(opts.sampleSize ?? opts.n, 5)), 2, 50),
    confidence: cieClamp(Math.round(cieFiniteNumber(opts.confidence ?? opts.ci, 95)), 50, 99),
    maxSamples: cieClamp(Math.round(cieFiniteNumber(opts.maxSamples, 500)), 1, 5000),
    drawCount: Math.max(0, Math.round(cieFiniteNumber(opts.draw ?? opts.initialCount, 0))),
    showMu: cieBoolean(opts.showMu ?? opts.muLine, true),
    showCards: cieBoolean(opts.showCards ?? opts.cards, true),
    showDecision: cieBoolean(opts.showDecision ?? opts.decision, false),
    playing: false
  };
  state.drawCount = cieClamp(state.drawCount, 0, state.maxSamples);

  // Per-sample-size record streams. Records are generated lazily from a seeded
  // stream, so any absolute draw count reproduces the same samples on back or
  // jump navigation, and switching sample sizes back and forth is stable.
  const streams = new Map();
  const tCritCache = new Map();

  function stream() {
    const key = state.sampleSize;
    if (!streams.has(key)) {
      streams.set(key, {
        rng: cieSeededRng(state.seed + "-n" + key),
        records: []
      });
    }
    return streams.get(key);
  }

  function ensureRecords(count) {
    const current = stream();
    const target = cieClamp(Math.round(count), 0, state.maxSamples);
    while (current.records.length < target) {
      const ranks = [];
      const suits = [];
      for (let j = 0; j < state.sampleSize; j += 1) {
        ranks.push(Math.floor(current.rng() * 13) + 1);
        suits.push(Math.floor(current.rng() * 4));
      }
      const mean = d3.mean(ranks);
      const sd = state.sampleSize > 1 ? Math.sqrt(d3.sum(ranks, (r) => (r - mean) * (r - mean)) / (state.sampleSize - 1)) : 0;
      current.records.push({
        index: current.records.length,
        ranks,
        suits,
        mean,
        sd,
        se: sd / Math.sqrt(state.sampleSize)
      });
    }
    return current.records;
  }

  function tCritical() {
    const df = state.sampleSize - 1;
    const key = state.confidence + "-" + df;
    if (!tCritCache.has(key)) {
      const alpha = 1 - state.confidence / 100;
      tCritCache.set(key, cieTInv(1 - alpha / 2, df));
    }
    return tCritCache.get(key);
  }

  function intervalFor(record, tCrit) {
    const marginOfError = tCrit * record.se;
    const lower = record.mean - marginOfError;
    const upper = record.mean + marginOfError;
    return {
      marginOfError,
      lower,
      upper,
      containsMu: lower <= MU && upper >= MU
    };
  }

  const root = d3.create("div")
    .attr("class", "confidence-interval-explorer sfs-figure")
    .style("--cie-max-width", opts.maxWidth || "46rem");
  const rootNode = root.node();

  const controls = root.append("div")
    .attr("class", "cie-controls sfs-control-grid");

  function controlGroup(title) {
    const group = controls.append("section")
      .attr("class", "cie-group sfs-control-panel sfs-if-control-panel");
    group.append("p")
      .attr("class", "cie-group-title sfs-control-title")
      .text(title);
    return group;
  }

  const sampleControls = controlGroup("Sample");
  const sizeRow = sampleControls.append("label")
    .attr("class", "cie-control-row sfs-control-row");
  sizeRow.append("span").text("Cards per sample");
  const sizeInput = sizeRow.append("select")
    .attr("aria-label", "Number of cards per sample")
    .node();
  [3, 5, 10, 30].forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    sizeInput.appendChild(option);
  });
  sizeInput.value = String(state.sampleSize);
  if (sizeInput.value !== String(state.sampleSize)) {
    const option = document.createElement("option");
    option.value = String(state.sampleSize);
    option.textContent = String(state.sampleSize);
    sizeInput.appendChild(option);
    sizeInput.value = String(state.sampleSize);
  }

  const confidenceRow = sampleControls.append("label")
    .attr("class", "cie-control-row sfs-control-row");
  confidenceRow.append("span").text("Confidence");
  const confidenceValue = confidenceRow.append("span")
    .attr("class", "cie-value sfs-readout-value");
  const confidenceInput = confidenceRow.append("input")
    .attr("type", "range")
    .attr("min", 50)
    .attr("max", 99)
    .attr("step", 1)
    .attr("value", state.confidence)
    .attr("aria-label", "Confidence level in percent")
    .attr("data-prevent-swipe", "")
    .node();

  const showControls = controlGroup("Show");
  const muInput = addCheckbox(showControls, "Population mean line", state.showMu);
  const cardsInput = addCheckbox(showControls, "Cards", state.showCards);
  const decisionInput = addCheckbox(showControls, "Hypothesis-test framing", state.showDecision);

  const actionControls = controlGroup("Draw samples");
  const actionRow = actionControls.append("div")
    .attr("class", "cie-action-row sfs-action-row");
  const reset = addButton(actionRow, "arrow-counterclockwise", "Reset");
  const draw = addButton(actionRow, "suit-spade-fill", "Draw");
  const play = addButton(actionRow, "play-fill", "Run");
  const resetButton = reset.button;
  const drawButton = draw.button;
  const playButton = play.button;
  const playIcon = play.icon;
  const playText = play.text;
  const countNode = actionRow.append("span")
    .attr("class", "cie-count")
    .attr("aria-live", "polite")
    .node();

  const cardsRow = root.append("div")
    .attr("class", "cie-cards")
    .attr("role", "img");

  const sampleReadout = root.append("div")
    .attr("class", "cie-sample-readout");
  const sampleStats = sampleReadout.append("span")
    .attr("class", "cie-sample-stats")
    .node();
  const verdictNode = sampleReadout.append("span")
    .attr("class", "cie-verdict")
    .node();

  const chartWrap = root.append("div")
    .attr("class", "cie-chart-wrap sfs-chart-wrap");
  const svg = chartWrap.append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("class", "sfs-svg sfs-graph")
    .attr("role", "img")
    .attr("aria-label", opts.ariaLabel ||
      "Confidence intervals from repeated samples of playing cards, plotted against the true population mean of 7");

  const x = d3.scaleLinear().range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain([0.5, 13.5])
    .range([height - margin.bottom, margin.top]);

  const clipId = "cie-plot-clip-" + Math.random().toString(36).slice(2, 9);
  svg.append("defs").append("clipPath")
    .attr("id", clipId)
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top - 6)
    .attr("width", width - margin.left - margin.right)
    .attr("height", height - margin.bottom - margin.top + 6);

  const intervalsLayer = svg.append("g")
    .attr("class", "cie-intervals")
    .attr("clip-path", "url(#" + clipId + ")");

  const muLayer = svg.append("g")
    .attr("class", "cie-mu sfs-if-reveal");
  const muLine = muLayer.append("line")
    .attr("class", "cie-mu-line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", y(MU))
    .attr("y2", y(MU));
  const muLabel = muLayer.append("text")
    .attr("class", "cie-mu-label")
    .attr("x", width - margin.right)
    .attr("y", y(MU) - 7)
    .attr("text-anchor", "end");

  const yAxisLayer = svg.append("g")
    .attr("class", "cie-axis sfs-axis sfs-graph-axis")
    .attr("transform", "translate(" + margin.left + ",0)");
  yAxisLayer.call(
    d3.axisLeft(y).tickValues([1, 3, 5, 7, 9, 11, 13]).tickFormat(f0).tickSizeOuter(0)
  );

  svg.append("text")
    .attr("class", "cie-axis-label sfs-axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -(margin.top + (height - margin.top - margin.bottom) / 2))
    .attr("y", 14)
    .attr("text-anchor", "middle")
    .text("Card value");

  const xAxisLayer = svg.append("g")
    .attr("class", "cie-axis sfs-axis sfs-graph-axis")
    .attr("transform", "translate(0," + (height - margin.bottom) + ")");

  svg.append("text")
    .attr("class", "cie-axis-label sfs-axis-label")
    .attr("x", margin.left + (width - margin.left - margin.right) / 2)
    .attr("y", height - 8)
    .attr("text-anchor", "middle")
    .text("Sample number");

  const summaryNode = root.append("p")
    .attr("class", "cie-summary")
    .node();
  const decisionNode = root.append("p")
    .attr("class", "cie-decision-line")
    .node();

  let playTimer = null;
  let playTarget = null;
  let cardTimers = [];
  let renderedCardIndex = null;
  let renderedCardSize = null;

  function addCheckbox(parent, label, checked) {
    const row = parent.append("label")
      .attr("class", "cie-check-row sfs-check-row");
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
      .attr("class", "cie-button sfs-button")
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

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  function withoutTransitions(callback) {
    rootNode.classList.add("cie-no-animation");
    callback();
    rootNode.getBoundingClientRect();
    requestAnimationFrame(() => rootNode.classList.remove("cie-no-animation"));
  }

  function clearCardTimers() {
    cardTimers.forEach((timer) => window.clearTimeout(timer));
    cardTimers = [];
  }

  function currentRecord() {
    if (state.drawCount <= 0) return null;
    return ensureRecords(state.drawCount)[state.drawCount - 1];
  }

  function coverage() {
    const records = ensureRecords(state.drawCount);
    const tCrit = tCritical();
    let hits = 0;
    for (let i = 0; i < state.drawCount; i += 1) {
      if (intervalFor(records[i], tCrit).containsMu) hits += 1;
    }
    return {
      hits,
      misses: state.drawCount - hits,
      percent: state.drawCount > 0 ? (hits / state.drawCount) * 100 : NaN
    };
  }

  function setValue() {
    const record = currentRecord();
    const tCrit = tCritical();
    const interval = record ? intervalFor(record, tCrit) : null;
    const cov = coverage();
    rootNode.value = {
      mu: MU,
      sigma: SIGMA,
      seed: state.seed,
      confidence: state.confidence,
      alpha: 1 - state.confidence / 100,
      sampleSize: state.sampleSize,
      n: state.sampleSize,
      df: state.sampleSize - 1,
      tCritical: tCrit,
      drawCount: state.drawCount,
      samplesDrawn: state.drawCount,
      maxSamples: state.maxSamples,
      mean: record ? record.mean : null,
      sd: record ? record.sd : null,
      se: record ? record.se : null,
      marginOfError: interval ? interval.marginOfError : null,
      ciLower: interval ? interval.lower : null,
      ciUpper: interval ? interval.upper : null,
      containsMu: interval ? interval.containsMu : null,
      rejectNull: interval ? !interval.containsMu : null,
      captureCount: cov.hits,
      missCount: cov.misses,
      capturePercent: cov.percent,
      showMu: state.showMu,
      showCards: state.showCards,
      showDecision: state.showDecision
    };
  }

  function syncControls() {
    sizeInput.value = String(state.sampleSize);
    confidenceInput.value = String(state.confidence);
    confidenceValue.text(state.confidence + "%");
    muInput.checked = state.showMu;
    cardsInput.checked = state.showCards;
    decisionInput.checked = state.showDecision;
    countNode.textContent = state.drawCount + " / " + state.maxSamples;
    drawButton.disabled = state.drawCount >= state.maxSamples;
    resetButton.disabled = state.drawCount <= 0 && !state.playing;
    updatePlayButton();
  }

  function updatePlayButton() {
    playButton.disabled = state.drawCount >= state.maxSamples && !state.playing;
    playButton.setAttribute("aria-label", state.playing ? "Pause" : "Draw continuously");
    playButton.title = state.playing ? "Pause" : "Draw continuously";
    playIcon.className = "bi bi-" + (state.playing ? "pause-fill" : "play-fill");
    playText.textContent = state.playing ? "Pause" : "Run";
  }

  function cardLabel(record) {
    if (!record) return "No cards drawn yet";
    const names = record.ranks.map((rank, i) => RANKS[rank - 1] + SUITS[record.suits[i]]);
    return "Sample of " + record.ranks.length + " cards: " + names.join(", ");
  }

  function renderCards(animate) {
    const record = currentRecord();
    cardsRow
      .style("display", state.showCards ? null : "none")
      .classed("cie-cards-sm", state.sampleSize >= 10 && state.sampleSize < 20)
      .classed("cie-cards-xs", state.sampleSize >= 20)
      .attr("aria-label", cardLabel(record));

    const rebuilt = renderedCardSize !== state.sampleSize;
    if (rebuilt) {
      cardsRow.selectAll("div").remove();
      for (let i = 0; i < state.sampleSize; i += 1) {
        const card = cardsRow.append("div")
          .attr("class", "cie-card is-face-down")
          .attr("aria-hidden", "true");
        card.append("span").attr("class", "cie-card-rank");
        card.append("span").attr("class", "cie-card-suit");
      }
      renderedCardSize = state.sampleSize;
      renderedCardIndex = null;
    }

    const sameRecord = record && renderedCardIndex === record.index;
    if (sameRecord && !rebuilt) return;
    renderedCardIndex = record ? record.index : null;
    clearCardTimers();

    const cards = cardsRow.selectAll(".cie-card").nodes();
    if (!record) {
      cards.forEach((card) => card.classList.add("is-face-down"));
      return;
    }

    // Stagger the reveal for a single deliberate draw; during continuous play
    // or non-animated jumps, flip everything at once.
    const stagger = animate && !state.playing && !prefersReducedMotion();
    const step = stagger ? Math.min(70, 620 / state.sampleSize) : 0;
    cards.forEach((card, i) => {
      const rank = record.ranks[i];
      const suit = record.suits[i];
      const show = () => {
        card.querySelector(".cie-card-rank").textContent = RANKS[rank - 1];
        card.querySelector(".cie-card-suit").textContent = SUITS[suit];
        card.classList.toggle("is-red", RED_SUITS.has(suit));
        card.classList.remove("is-face-down");
      };
      if (!stagger) {
        show();
        return;
      }
      card.classList.add("is-face-down");
      cardTimers.push(window.setTimeout(show, 90 + i * step));
    });
  }

  function renderSampleReadout() {
    const record = currentRecord();
    if (!record) {
      sampleStats.textContent = "No samples drawn yet";
      verdictNode.style.display = "none";
      return;
    }

    const interval = intervalFor(record, tCritical());
    sampleStats.innerHTML =
      "<i>M</i> = " + fMean(record.mean) +
      " &nbsp;·&nbsp; " + state.confidence + "% CI [" +
      fMean(interval.lower) + ", " + fMean(interval.upper) + "]";

    verdictNode.style.display = "";
    verdictNode.classList.toggle("is-miss", !interval.containsMu && (state.showMu || state.showDecision));
    verdictNode.classList.toggle("is-unknown", !state.showMu && !state.showDecision);
    if (state.showDecision) {
      verdictNode.innerHTML = interval.containsMu
        ? "don't reject H<sub>0</sub>"
        : "reject H<sub>0</sub>";
    } else if (state.showMu) {
      verdictNode.textContent = interval.containsMu ? "captures μ" : "misses μ";
    } else {
      verdictNode.textContent = "captures μ?";
    }
  }

  function renderSummary() {
    const cov = coverage();
    if (state.drawCount <= 0) {
      summaryNode.innerHTML = "Draw samples to build up the long-run picture.";
      decisionNode.textContent = "";
      return;
    }

    if (state.showMu) {
      summaryNode.innerHTML =
        "<span class='cie-hit-text'>" + cov.hits + " of " + state.drawCount +
        " intervals capture μ</span> (" + fPct(cov.percent) + "%)" +
        (cov.misses > 0
          ? " · <span class='cie-miss-text'>" + cov.misses + " miss</span>"
          : "") +
        " · target " + state.confidence + "%";
    } else {
      summaryNode.innerHTML =
        state.drawCount + " samples drawn · μ is hidden, so no interval can be checked";
    }

    if (state.showDecision) {
      const alphaText = fMean(1 - state.confidence / 100).replace(/^0/, "");
      decisionNode.innerHTML =
        "Testing H<sub>0</sub>: μ = 7 at α = " + alphaText + ": " +
        cov.misses + " of " + state.drawCount + " samples would reject" +
        (state.showMu ? " — every one a Type I error" : "") + ".";
    } else {
      decisionNode.textContent = "";
    }
  }

  function renderChart(options) {
    options = options || {};
    const animate = options.animate !== false && !prefersReducedMotion();
    const records = ensureRecords(state.drawCount);
    const tCrit = tCritical();
    const windowStart = Math.max(0, state.drawCount - WINDOW_SIZE);
    x.domain([windowStart + 0.5, Math.max(WINDOW_SIZE, state.drawCount) + 0.5]);

    const visible = records.slice(windowStart, state.drawCount).map((record) => {
      const interval = intervalFor(record, tCrit);
      return { record, interval };
    });

    const shiftDuration = animate && state.playing && options.shifted
      ? Math.min(80, cieFiniteNumber(opts.playDelay, 90) * 0.8)
      : 0;

    const groups = intervalsLayer.selectAll("g.cie-interval")
      .data(visible, (d) => d.record.index);

    groups.exit().remove();

    const entered = groups.enter()
      .append("g")
      .attr("class", "cie-interval")
      .attr("transform", (d) => "translate(" + x(d.record.index + 1) + ",0)");

    entered.append("line")
      .attr("y1", (d) => y(d.record.mean))
      .attr("y2", (d) => y(d.record.mean));
    entered.append("circle")
      .attr("r", 4)
      .attr("cy", (d) => y(d.record.mean));

    const merged = entered.merge(groups)
      .classed("is-miss", (d) => !d.interval.containsMu);

    const positioned = shiftDuration > 0
      ? merged.transition("shift").duration(shiftDuration).ease(d3.easeLinear)
      : merged.interrupt("shift");
    positioned.attr("transform", (d) => "translate(" + x(d.record.index + 1) + ",0)");

    const growDuration = animate && options.grow ? 170 : 0;
    // Lerp existing intervals to their new widths on confidence changes: the
    // means stay put and only the margins stretch, which reads as adjusting
    // one parameter rather than recomputing new CIs.
    const lerpDuration = animate && options.lerpWidths ? 400 : 0;
    merged.each(function(d) {
      const group = d3.select(this);
      const line = group.select("line");
      const isNew = growDuration > 0 && d.record.index === state.drawCount - 1;
      if (isNew) {
        line
          .attr("y1", y(d.record.mean))
          .attr("y2", y(d.record.mean))
          .transition("grow").duration(growDuration)
          .attr("y1", y(d.interval.upper))
          .attr("y2", y(d.interval.lower));
      } else if (lerpDuration > 0) {
        line.transition("grow").duration(lerpDuration).ease(d3.easeCubicOut)
          .attr("y1", y(d.interval.upper))
          .attr("y2", y(d.interval.lower));
      } else {
        line.interrupt("grow")
          .attr("y1", y(d.interval.upper))
          .attr("y2", y(d.interval.lower));
      }
    });

    const axis = d3.axisBottom(x)
      .ticks(6)
      .tickFormat(f0)
      .tickSizeOuter(0);
    if (shiftDuration > 0) {
      xAxisLayer.transition("shift").duration(shiftDuration).ease(d3.easeLinear).call(axis);
    } else {
      xAxisLayer.interrupt("shift").call(axis);
    }
  }

  function renderMuLine(animate) {
    muLabel.html(state.showDecision
      ? "H<tspan baseline-shift='sub' font-size='11'>0</tspan>: μ = 7"
      : "μ = 7");
    if (window.interactiveFigure && window.interactiveFigure.setRevealVisible) {
      window.interactiveFigure.setRevealVisible(muLayer, state.showMu, {
        root: rootNode,
        animate: animate !== false
      });
    } else {
      muLayer
        .classed("is-visible", state.showMu)
        .attr("aria-hidden", String(!state.showMu));
    }
  }

  function update(notify, options) {
    options = options || {};
    rootNode.classList.toggle("cie-neutral", !state.showMu && !state.showDecision);
    syncControls();
    const render = () => {
      renderCards(options.animate !== false);
      renderSampleReadout();
      renderSummary();
      renderChart(options);
      renderMuLine(options.animate);
    };
    if (options.animate === false) {
      withoutTransitions(render);
    } else {
      render();
    }
    setValue();
    if (notify) notifyValueChange();
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
    if (state.drawCount >= state.maxSamples) {
      stopPlaying();
      return false;
    }
    state.drawCount += 1;
    update(notify, { animate, grow: true, shifted: state.drawCount > WINDOW_SIZE });
    return true;
  }

  function playTo(target, notify, delay) {
    playTarget = cieClamp(Math.round(target), 0, state.maxSamples);
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
    const nextCount = cieClamp(Math.round(cieFiniteNumber(count, state.drawCount)), 0, state.maxSamples);
    const animate = options.animate !== false;
    stopPlaying();

    if (animate && nextCount > state.drawCount + 1 && !prefersReducedMotion()) {
      playTo(nextCount, options.notify !== false, cieFiniteNumber(options.delay, 40));
      return;
    }

    const advancedByOne = nextCount === state.drawCount + 1;
    state.drawCount = nextCount;
    update(options.notify !== false, { animate, grow: animate && advancedByOne });
  }

  function resetSamples(notify) {
    stopPlaying();
    state.drawCount = 0;
    update(notify, { animate: false });
  }

  function rebuildStream() {
    stopPlaying();
    streams.clear();
    state.drawCount = 0;
    renderedCardIndex = null;
    renderedCardSize = null;
  }

  function togglePlay() {
    if (state.playing) {
      stopPlaying();
      return;
    }
    playTo(state.maxSamples, true, cieFiniteNumber(opts.playDelay, 90));
  }

  function applyTutorialAction(action, context) {
    action = action || {};
    const animate = action.animate !== false;
    let changed = false;
    let rebuild = false;
    let targetDraw = null;
    let playRequested = null;

    Object.entries(action).forEach(([rawKey, value]) => {
      const key = cieActionKey(rawKey);
      switch (key) {
        case "animate":
        case "delay":
          break;
        case "seed":
          if (String(value) !== state.seed) {
            state.seed = String(value);
            rebuild = true;
          }
          changed = true;
          break;
        case "confidence":
        case "ci":
        case "confidence-level": {
          const n = Number(value);
          if (Number.isFinite(n)) {
            state.confidence = cieClamp(Math.round(n), 50, 99);
            changed = true;
          }
          break;
        }
        case "n":
        case "sample-size":
        case "cards-per-sample": {
          const n = Number(value);
          if (Number.isFinite(n)) {
            const next = cieClamp(Math.round(n), 2, 50);
            if (next !== state.sampleSize) {
              state.sampleSize = next;
              rebuild = true;
            }
            changed = true;
          }
          break;
        }
        case "draw":
        case "count":
        case "samples-drawn":
          targetDraw = Math.round(cieFiniteNumber(value, state.drawCount));
          break;
        case "next":
        case "next-sample":
          if (cieBoolean(value, true)) targetDraw = state.drawCount + 1;
          break;
        case "reset":
          if (cieBoolean(value, true)) targetDraw = 0;
          break;
        case "play":
        case "run":
        case "run-continuously":
          playRequested = cieBoolean(value, true);
          break;
        case "show-mu":
        case "mu-line":
        case "population-mean-line":
          state.showMu = cieBoolean(value, state.showMu);
          changed = true;
          break;
        case "show-cards":
          state.showCards = cieBoolean(value, state.showCards);
          changed = true;
          break;
        case "show-decision":
        case "decision":
        case "hypothesis-test":
        case "nhst":
          state.showDecision = cieBoolean(value, state.showDecision);
          changed = true;
          break;
        case "controls":
        case "controls-open":
          if (context && typeof context.setControlsOpen === "function") {
            context.setControlsOpen(cieBoolean(value, true), animate);
          }
          break;
        default:
          break;
      }
    });

    if (rebuild) {
      rebuildStream();
      changed = true;
    }

    if (targetDraw !== null && targetDraw !== state.drawCount) {
      // Apply display changes first so the draw animation lands on the final
      // framing, then move to the absolute draw count. After a rebuild the
      // previous count is gone, so snap: replaying hundreds of draws on a
      // back or jump navigation is never intended.
      if (changed) update(false, { animate: false });
      setDrawCount(targetDraw, {
        animate: animate && !rebuild,
        notify: true,
        delay: cieFiniteNumber(action.delay, 40)
      });
      return;
    }

    if (playRequested !== null) {
      if (changed) update(true, { animate, lerpWidths: true });
      if (playRequested) {
        playTo(state.maxSamples, true, cieFiniteNumber(action.delay, opts.playDelay ?? 90));
      } else {
        stopPlaying();
      }
      return;
    }

    // Draw count unchanged (or no draw requested): a single render, with
    // interval widths lerping so confidence-level steps read as adjusting a
    // parameter on the same samples.
    if (changed || targetDraw !== null) {
      stopPlaying();
      update(true, { animate, lerpWidths: true });
    }
  }

  sizeInput.addEventListener("input", (event) => {
    event.stopPropagation();
    const next = cieClamp(Math.round(Number(sizeInput.value) || state.sampleSize), 2, 50);
    if (next !== state.sampleSize) {
      state.sampleSize = next;
      rebuildStream();
    }
    update(true, { animate: false });
  });

  confidenceInput.addEventListener("input", (event) => {
    event.stopPropagation();
    state.confidence = cieClamp(Math.round(Number(confidenceInput.value) || state.confidence), 50, 99);
    update(true, { animate: true, lerpWidths: true });
  });

  [muInput, cardsInput, decisionInput].forEach((input) => {
    input.addEventListener("input", (event) => {
      event.stopPropagation();
      state.showMu = muInput.checked;
      state.showCards = cardsInput.checked;
      state.showDecision = decisionInput.checked;
      update(true, { animate: true });
    });
  });

  drawButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    stopPlaying();
    advanceOne(true, true);
  });

  resetButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetSamples(true);
  });

  playButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    togglePlay();
  });

  rootNode.confidenceIntervalExplorer = {
    draw() { advanceOne(true, true); },
    reset() { resetSamples(true); },
    play() { playTo(state.maxSamples, true, cieFiniteNumber(opts.playDelay, 90)); },
    pause() { stopPlaying(); },
    setDrawCount(count) { setDrawCount(count, { animate: true, notify: true }); },
    applyTutorialAction
  };

  update(false, { animate: false });

  if (window.interactiveFigure) {
    window.interactiveFigure.wrap({
      root: rootNode,
      controls: controls.node(),
      label: "confidence interval controls",
      placement: opts.controlsPlacement || "callout",
      layout: opts.controlsLayout || "equal",
      applyAction: applyTutorialAction,
      startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
    });
  }

  return rootNode;
}
