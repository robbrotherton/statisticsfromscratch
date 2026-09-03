(function(global) {
  "use strict";

  const sampling = global.bcSampling;
  const visuals = global.bcSamplingVisuals;

  function ensureStyles() {
    if (document.getElementById("sampling-pathway-styles")) return;
    const style = document.createElement("style");
    style.id = "sampling-pathway-styles";
    style.textContent = `
      .spp-controls .spp-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.45rem;
      }

      .spp-controls .spp-status {
        min-width: 6.8rem;
        color: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
        font-size: 0.9rem;
        font-variant-numeric: tabular-nums;
      }

      .sampling-pathway[data-sfs-layout="compact"] .spp-controls .spp-actions .sfs-button {
          flex: 1 1 8rem;
          min-height: 44px;
      }
      .sampling-pathway[data-sfs-layout="compact"] .spp-controls .spp-status {
        flex: 1 1 100%;
      }

      .sampling-pathway[data-mode="categorical"] .spp-category-proportion {
        fill: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
        font-size: var(--sfs-viz-small-size, 0.75rem);
        font-weight: 650;
        font-variant-numeric: tabular-nums;
      }

      .sampling-pathway[data-mode="categorical"] .spp-category-proportion.is-empty {
        opacity: 0.72;
      }

      .sampling-pathway[data-mode="categorical"][data-sfs-layout="compact"]
        .spp-category-proportion {
        font-size: 0.625rem;
      }

      .sampling-pathway[data-mode="categorical"][data-focus="sample"]
        .bcs-pop-dot:not(.is-source),
      .sampling-pathway[data-mode="categorical"][data-focus="comparison"]
        .bcs-pop-dot:not(.is-source) {
        opacity: 0.48;
      }

      .sampling-pathway[data-mode="categorical"] .bcs-pop-dot.is-source {
        opacity: 1;
        stroke: var(--bcs-current);
        stroke-width: 1.6;
      }

      .sampling-pathway[data-mode="categorical"] .bcs-sample-dot {
        opacity: 1;
      }

      .sampling-pathway[data-mode="categorical"] {
        --spp-unknown-population: #8d959d;
      }

      @supports (color: color-mix(in srgb, black, white)) {
        .sampling-pathway[data-mode="categorical"] {
          --spp-unknown-population: color-mix(
            in srgb,
            var(--sfs-muted, #6c757d) 72%,
            var(--sfs-bg, white)
          );
        }
      }

      .sampling-pathway[data-mode="categorical"] .bcs-pop-dot {
        transition:
          fill 360ms ease,
          opacity 280ms ease,
          stroke 280ms ease,
          stroke-width 280ms ease;
      }

      .sampling-pathway[data-mode="categorical"][data-population-known="false"]
        .bcs-pop-dot:not(.is-source) {
        opacity: 0.78;
      }

      .sampling-pathway[data-mode="categorical"][data-population-known="false"]
        .bcs-pop-dot.is-source {
        opacity: 0.78;
        stroke: var(--graph-point-stroke, var(--sfs-bg, white));
        stroke-width: 0.7;
      }

      .sampling-pathway[data-mode="categorical"] .spp-inference-layer {
        pointer-events: none;
      }

      .sampling-pathway[data-mode="categorical"] .spp-inference-frame {
        fill: none;
        stroke: none;
      }

      .sampling-pathway[data-mode="categorical"] .spp-inference-segment {
        stroke: none;
      }

      @media (prefers-reduced-motion: reduce) {
        .sampling-pathway[data-mode="categorical"] .bcs-pop-dot,
        .sampling-pathway[data-mode="categorical"] .spp-category-proportion {
          transition: none !important;
        }
      }

      html[data-motion="reduced"] .sampling-pathway[data-mode="categorical"] .bcs-pop-dot,
      html[data-motion="reduced"] .sampling-pathway[data-mode="categorical"] .spp-category-proportion {
        transition: none !important;
      }
    `;
    document.head.appendChild(style);
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

  function normalizeFocus(value, fallback) {
    const normalized = String(value ?? "").trim().toLowerCase();
    return ["none", "population", "sample", "sample-mean", "mean", "distribution"].includes(normalized)
      ? normalized
      : fallback;
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

  function categoricalFocus(value, fallback) {
    const normalized = String(value ?? "").trim().toLowerCase();
    return ["none", "population", "sample", "comparison"].includes(normalized)
      ? normalized
      : fallback;
  }

  function makeCategoricalSamplingPathway(options) {
    const opts = options || {};
    const preferredWidth = Math.max(240, sampling.finite(opts.width, 760));
    const compactBelow = Math.max(320, sampling.finite(opts.compactBelow, 560));
    const seed = String(opts.seed ?? "categorical-sampling-pathway-v1");
    const defaultCategories = ["Blue", "Orange", "Green", "Red", "Purple"];
    const categories = (Array.isArray(opts.categories) && opts.categories.length
      ? opts.categories
      : defaultCategories)
      .map((label) => String(label));
    const categoryCount = categories.length;
    const rows = Math.max(1, Math.round(sampling.finite(opts.populationRows, 4)));
    const requestedColumns = Math.max(
      categoryCount,
      Math.round(sampling.finite(opts.populationColumns, 25))
    );
    const blockColumns = Math.max(1, Math.round(requestedColumns / categoryCount));
    const columns = blockColumns * categoryCount;
    const populationSize = rows * columns;
    const populationPerCategory = rows * blockColumns;
    const sampleSize = sampling.clamp(
      Math.round(sampling.finite(opts.sampleSize ?? opts.n, 10)),
      1,
      populationSize
    );
    const expectedPerCategory = sampleSize / categoryCount;
    const inferenceEnabled = sampling.boolean(opts.inferenceStrip, false);
    const requestedColors = Array.isArray(opts.categoryColors) ? opts.categoryColors : [];
    const fallbackColors = [
      "var(--graph-series-1, var(--graph-data-color, #0072b2))",
      "var(--graph-series-2, #e69f00)",
      "var(--graph-series-3, #009e73)",
      "var(--graph-series-4, #d55e00)",
      "var(--graph-series-5, #cc79a7)"
    ];
    const colors = categories.map((label, index) =>
      requestedColors[index] || fallbackColors[index] || visuals.colorForIndex(index)
    );
    const categoryKeys = categories.map((label, index) => {
      const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return key || `category-${index + 1}`;
    });
    const population = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const category = Math.min(categoryCount - 1, Math.floor(column / blockColumns));
        population.push({
          id: row * columns + column,
          row,
          column,
          category
        });
      }
    }

    function sampleForDraw(drawIndex) {
      if (drawIndex < 1) return [];
      const rng = sampling.seededRng(`${seed}:${drawIndex}`);
      const pool = population.map((item) => item.id);
      for (let index = 0; index < sampleSize; index += 1) {
        const swapIndex = index + Math.floor(rng() * (pool.length - index));
        const held = pool[index];
        pool[index] = pool[swapIndex];
        pool[swapIndex] = held;
      }
      const withinCategory = new Array(categoryCount).fill(0);
      return pool.slice(0, sampleSize)
        .map((id) => population[id])
        .sort((left, right) => left.category - right.category || left.id - right.id)
        .map((item) => Object.assign({}, item, {
          samplePosition: withinCategory[item.category]++
        }));
    }

    const initialPopulationKnown = sampling.boolean(opts.populationKnown, true);
    const initialShowInference = inferenceEnabled && sampling.boolean(opts.showInference, false);
    const state = {
      drawIndex: Math.max(0, Math.round(sampling.finite(opts.initialDraw ?? opts.draw, 0))),
      showSample: sampling.boolean(opts.showSample ?? opts.observations, true),
      focus: categoricalFocus(opts.focus, "population"),
      populationKnown: initialPopulationKnown,
      showInference: initialShowInference
    };
    let currentSample = sampleForDraw(state.drawIndex);

    const root = d3.create("div")
      .attr("class", "sampling-pathway sfs-sampling-figure sfs-figure")
      .attr("data-mode", "categorical")
      .style("--sfs-figure-max-width", opts.maxWidth || "48rem");
    const rootNode = root.node();
    const controls = root.append("div").attr("class", "spp-controls sfs-control-grid");
    const actionsPanel = controls.append("section")
      .attr("class", "sfs-control-panel sfs-if-control-panel");
    actionsPanel.append("p").attr("class", "sfs-control-title").text("Sampling");
    const actions = actionsPanel.append("div").attr("class", "spp-actions sfs-action-row");
    const reset = makeButton(actions, "arrow-counterclockwise", "Reset");
    const next = makeButton(actions, "arrow-down-circle", "Next sample");
    const status = actions.append("span")
      .attr("class", "spp-status")
      .attr("aria-live", "polite")
      .node();
    const announcement = root.append("p")
      .attr("class", "visually-hidden sfs-if-fit-ignore")
      .attr("aria-live", "polite")
      .node();
    const chartWrap = root.append("div").attr("class", "sfs-chart-wrap");

    let svg = null;
    let title = null;
    let populationDots = null;
    let inferenceLayer = null;
    let inferenceSegments = null;
    let sampleDotsLayer = null;
    let proportionLabels = null;
    let sourcePosition = new Map();
    let targetPosition = () => ({ x: 0, y: 0 });

    function countsFor(sample) {
      const counts = new Array(categoryCount).fill(0);
      sample.forEach((item) => { counts[item.category] += 1; });
      return counts;
    }

    function setValue() {
      const counts = countsFor(currentSample);
      const populationCounts = {};
      const currentCounts = {};
      categoryKeys.forEach((key, index) => {
        populationCounts[key] = populationPerCategory;
        currentCounts[key] = counts[index];
      });
      rootNode.value = {
        seed,
        populationKind: "categorical",
        populationSize,
        populationRows: rows,
        populationColumns: columns,
        populationPerCategory,
        populationCounts,
        categories: categories.slice(),
        sampleSize,
        n: sampleSize,
        expectedPerCategory,
        drawIndex: state.drawIndex,
        samplesDrawn: state.drawIndex,
        currentSample: currentSample.map((item) => item.id),
        currentCounts,
        populationKnown: state.populationKnown,
        inferenceVisible: state.showInference && state.showSample && state.drawIndex > 0,
        focus: state.focus
      };
    }

    function notify() {
      rootNode.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function syncControls(counts) {
      reset.button.disabled = state.drawIndex === 0;
      status.textContent = state.drawIndex ? `Sample ${state.drawIndex.toLocaleString()}` : "No sample yet";
      const sampleAnnouncement = state.drawIndex
        ? `Sample ${state.drawIndex}: ` +
          categories.map((label, index) =>
            `${label} ${d3.format(".0%")(counts[index] / sampleSize)}`
          ).join(", ") + "."
        : "No sample yet.";
      const knowledgeAnnouncement = state.populationKnown
        ? "Population proportions visible."
        : "Population proportions hidden.";
      const inferenceAnnouncement = state.showInference && state.showSample && state.drawIndex
        ? " Estimated population proportions: " + categories.map((label, index) =>
          `${label} ${d3.format(".0%")(counts[index] / sampleSize)}`
        ).join(", ") + "."
        : "";
      announcement.textContent = `${knowledgeAnnouncement} ${sampleAnnouncement}${inferenceAnnouncement}`;
    }

    function updateAria(counts) {
      const populationPhrase = state.populationKnown
        ? `Balanced population of ${populationSize} dots: ` +
          categories.map((label) => `${populationPerCategory} ${label}`).join(", ") + "."
        : `Population of ${populationSize} dots; its category proportions are hidden.`;
      const samplePhrase = state.drawIndex
        ? `Sample ${state.drawIndex} of ${sampleSize} dots has proportions ` +
          categories.map((label, index) =>
            `${label} ${d3.format(".0%")(counts[index] / sampleSize)}`
          ).join(", ") + "."
        : "No sample has been drawn.";
      const inferencePhrase = state.showInference && state.showSample && state.drawIndex
        ? " The population estimate based on this sample is " + categories.map((label, index) =>
          `${label} ${d3.format(".0%")(counts[index] / sampleSize)}`
        ).join(", ") + "."
        : "";
      const aria = `${populationPhrase} ${samplePhrase}${inferencePhrase}`;
      svg.attr("aria-label", aria);
      title.text(aria);
    }

    function renderInference(counts, animate) {
      if (!inferenceEnabled || !inferenceLayer || !inferenceSegments) return;
      const visible = Boolean(state.showInference && state.showSample && state.drawIndex);
      const wasVisible = inferenceLayer.attr("data-visible") === "true";
      let cumulative = 0;
      const geometry = counts.map((count, index) => {
        const start = cumulative;
        cumulative += count / sampleSize;
        return { index, count, start, end: cumulative };
      });
      inferenceLayer.interrupt("inference");
      inferenceSegments.interrupt("inference").data(geometry);

      if (!visible) {
        if (animate && wasVisible) {
          inferenceLayer.transition("inference")
            .duration(220)
            .style("opacity", 0);
        } else {
          inferenceLayer.style("opacity", 0);
        }
        inferenceLayer.attr("data-visible", "false");
        return;
      }

      const plotLeft = Number(inferenceLayer.attr("data-plot-left"));
      const plotWidth = Number(inferenceLayer.attr("data-plot-width"));
      const x = (item) => plotLeft + item.start * plotWidth;
      const width = (item) => Math.max(0, (item.end - item.start) * plotWidth);
      const delay = animate ? (wasVisible ? 720 : 330) : 0;
      const updateProportionLabels = () => {
        proportionLabels
          .classed("is-empty", (category, index) => counts[index] === 0)
          .text((category, index) =>
            `${category} ${d3.format(".0%")(counts[index] / sampleSize)}`
          );
      };
      if (!wasVisible) {
        inferenceSegments
          .attr("x", x)
          .attr("width", 0);
      }
      if (animate) {
        const layerTransition = inferenceLayer
          .style("opacity", wasVisible ? 1 : 0)
          .transition("inference")
          .delay(delay)
          .duration(220)
          .style("opacity", 1);
        if (wasVisible) {
          layerTransition.on("start.proportions", updateProportionLabels);
        } else {
          updateProportionLabels();
        }
        inferenceSegments.transition("inference")
          .delay(delay)
          .duration(560)
          .ease(d3.easeCubicInOut)
          .attr("x", x)
          .attr("width", width);
      } else {
        inferenceLayer.style("opacity", 1);
        inferenceSegments
          .attr("x", x)
          .attr("width", width);
        updateProportionLabels();
      }
      inferenceLayer.attr("data-visible", "true");
    }

    function render(settings) {
      const renderOptions = settings || {};
      const animate = Boolean(renderOptions.animate) && !visuals.reducedMotion();
      const animateSample = animate && renderOptions.animateSample !== false;
      currentSample = sampleForDraw(state.drawIndex);
      const visibleSample = state.showSample ? currentSample : [];
      const counts = countsFor(currentSample);
      const selectedIds = new Set(visibleSample.map((item) => item.id));
      root
        .attr("data-focus", state.focus)
        .attr("data-population-known", state.populationKnown ? "true" : "false");
      populationDots
        .interrupt()
        .classed("is-source", (item) => selectedIds.has(item.id))
        .style("fill", (item) => state.populationKnown
          ? colors[item.category]
          : "var(--spp-unknown-population, #8d959d)"
        );
      const previous = sampleDotsLayer.selectAll("circle").interrupt();
      previous.remove();

      const dots = sampleDotsLayer.selectAll("circle")
        .data(visibleSample, (item) => `${state.drawIndex}-${item.id}`)
        .join("circle")
        .attr("class", "bcs-sample-dot sfs-graph-point")
        .attr("r", (item) => sourcePosition.get(item.id).radius)
        .style("fill", (item) => colors[item.category]);
      if (animateSample) {
        dots
          .attr("cx", (item) => sourcePosition.get(item.id).x)
          .attr("cy", (item) => sourcePosition.get(item.id).y)
          .style("opacity", 0.9)
          .transition()
          .delay((item, index) => 90 + index * Math.max(12, 150 / sampleSize))
          .duration(560)
          .ease(d3.easeCubicInOut)
          .attr("cx", (item) => targetPosition(item).x)
          .attr("cy", (item) => targetPosition(item).y)
          .style("opacity", 1);
      } else {
        dots
          .attr("cx", (item) => targetPosition(item).x)
          .attr("cy", (item) => targetPosition(item).y)
          .style("opacity", 1);
      }

      proportionLabels
        .interrupt()
        .attr("display", state.drawIndex && state.showSample &&
          (!inferenceEnabled || state.showInference) ? null : "none");
      if (!inferenceEnabled) {
        proportionLabels
          .classed("is-empty", (category, index) => counts[index] === 0)
          .text((category, index) =>
            `${category} ${d3.format(".0%")(counts[index] / sampleSize)}`
          );
      }
      renderInference(counts, animate);
      updateAria(counts);
      syncControls(counts);
      setValue();
    }

    function buildChart(layout) {
      if (svg) {
        sampleDotsLayer.selectAll("*").interrupt();
        populationDots.interrupt();
      }
      const compact = Boolean(layout.compact);
      const width = Math.max(240, Math.min(preferredWidth, sampling.finite(layout.width, preferredWidth)));
      const plotInset = Math.max(12, sampling.finite(opts.plotInset, compact ? 12 : 18));
      const plotLeft = plotInset;
      const plotRight = width - plotInset;
      // Match the canonical sampling-pathway geometry: one responsive grid
      // cell is one dot diameter, so adjacent rows and columns touch exactly.
      const cellSize = (plotRight - plotLeft) / columns;
      const dotRadius = cellSize / 2;
      const labelY = 25;
      const populationTop = 39;
      const populationBottom = populationTop + rows * cellSize;
      const inferenceLabelY = populationBottom + 22;
      const inferenceTop = populationBottom + 27;
      const inferenceHeight = Math.max(12, Math.min(16, cellSize * 0.55));
      const inferenceSummaryY = inferenceTop + inferenceHeight + 17;
      const sampleLabelY = inferenceEnabled ? inferenceSummaryY + 25 : populationBottom + 48;
      const sampleTop = sampleLabelY + 16;
      const sampleRows = Math.max(1, Math.ceil(sampleSize / blockColumns));
      const sampleBottom = sampleTop + sampleRows * cellSize;
      const sampleSummaryY = sampleBottom + 18;
      const naturalHeight = inferenceEnabled ? sampleBottom + 18 : sampleSummaryY + 20;
      const height = Math.max(naturalHeight, sampling.finite(opts.height, naturalHeight));

      chartWrap.selectAll("*").remove();
      svg = chartWrap.append("svg")
        .attr("class", "sfs-svg sfs-graph")
        .attr("viewBox", [0, 0, width, height])
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("role", "img");
      title = svg.append("title");

      const populationLayer = svg.append("g").attr("class", "bcs-population-layer");
      populationLayer.append("text")
        .attr("class", "bcs-panel-label")
        .attr("x", plotLeft)
        .attr("y", labelY)
        .text(opts.populationLabel || "Population");
      populationDots = populationLayer.append("g")
        .selectAll("circle")
        .data(population, (item) => item.id)
        .join("circle")
        .attr("class", "bcs-pop-dot sfs-graph-point")
        .attr("r", dotRadius)
        .attr("cx", (item) => plotLeft + (item.column + 0.5) * cellSize)
        .attr("cy", (item) => populationTop + (item.row + 0.5) * cellSize)
        .style("fill", (item) => colors[item.category]);
      sourcePosition = new Map(population.map((item) => [item.id, {
        x: plotLeft + (item.column + 0.5) * cellSize,
        y: populationTop + (item.row + 0.5) * cellSize,
        radius: dotRadius
      }]));

      if (inferenceEnabled) {
        inferenceLayer = svg.append("g")
          .attr("class", "spp-inference-layer")
          .attr("data-visible", "false")
          .attr("data-plot-left", plotLeft)
          .attr("data-plot-width", plotRight - plotLeft)
          .style("opacity", 0);
        inferenceLayer.append("text")
          .attr("class", "bcs-panel-label")
          .attr("x", plotLeft)
          .attr("y", inferenceLabelY)
          .text(opts.inferenceLabel || "Estimate from this sample");
        inferenceLayer.append("rect")
          .attr("class", "spp-inference-frame")
          .attr("x", plotLeft)
          .attr("y", inferenceTop)
          .attr("width", plotRight - plotLeft)
          .attr("height", inferenceHeight);
        inferenceSegments = inferenceLayer.append("g")
          .selectAll("rect")
          .data(categories.map((label, index) => ({ index, count: 0, start: 0, end: 0 })))
          .join("rect")
          .attr("class", "spp-inference-segment")
          .attr("x", plotLeft)
          .attr("y", inferenceTop)
          .attr("width", 0)
          .attr("height", inferenceHeight)
          .style("fill", (item) => colors[item.index]);
        proportionLabels = inferenceLayer.append("g")
          .selectAll("text")
          .data(categories)
          .join("text")
          .attr("class", "spp-category-proportion")
          .attr("x", (category, index) =>
            plotLeft + (index * blockColumns + blockColumns / 2) * cellSize
          )
          .attr("y", inferenceSummaryY)
          .attr("text-anchor", "middle");
      } else {
        inferenceLayer = null;
        inferenceSegments = null;
      }

      const sampleLayer = svg.append("g").attr("class", "bcs-sample-layer");
      sampleLayer.append("text")
        .attr("class", "bcs-panel-label")
        .attr("x", plotLeft)
        .attr("y", sampleLabelY)
        .text(opts.sampleLabel || "Sample");
      sampleDotsLayer = sampleLayer.append("g").attr("class", "spp-sample-dots");
      if (!inferenceEnabled) {
        proportionLabels = sampleLayer.append("g")
          .selectAll("text")
          .data(categories)
          .join("text")
          .attr("class", "spp-category-proportion")
          .attr("x", (category, index) =>
            plotLeft + (index * blockColumns + blockColumns / 2) * cellSize
          )
          .attr("y", sampleSummaryY)
          .attr("text-anchor", "middle");
      }
      targetPosition = (item) => ({
        x: plotLeft +
          (item.category * blockColumns + (item.samplePosition % blockColumns) + 0.5) * cellSize,
        y: sampleTop +
          (sampleRows - Math.floor(item.samplePosition / blockColumns) - 0.5) * cellSize
      });
      render({ animate: false });
    }

    function setDrawIndex(value, settings) {
      const numeric = Number(value);
      const target = Number.isFinite(numeric)
        ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.round(numeric)))
        : state.drawIndex;
      const changed = target !== state.drawIndex;
      state.drawIndex = target;
      const animateState = Boolean(settings && settings.animateState);
      render({
        animate: (changed || animateState) && (!settings || settings.animate !== false),
        animateSample: changed
      });
      if (!settings || settings.notify !== false) notify();
    }

    function applyTutorialAction(action) {
      const requested = action || {};
      let target = null;
      let changed = false;
      Object.entries(requested).forEach(([rawKey, value]) => {
        switch (sampling.actionKey(rawKey)) {
          case "animate":
            break;
          case "draw":
          case "count":
          case "samples-drawn":
            target = String(value).trim().toLowerCase() === "next"
              ? state.drawIndex + 1
              : value;
            break;
          case "observations":
          case "show-observations":
          case "show-sample":
            state.showSample = sampling.boolean(value, state.showSample);
            changed = true;
            break;
          case "focus":
          case "emphasize":
            state.focus = categoricalFocus(value, state.focus);
            changed = true;
            break;
          case "population-known":
          case "show-population-colors":
            state.populationKnown = sampling.boolean(value, state.populationKnown);
            changed = true;
            break;
          case "inference":
          case "show-inference":
          case "show-estimate":
            state.showInference = inferenceEnabled && sampling.boolean(value, state.showInference);
            changed = true;
            break;
          case "controls":
          case "controls-open":
            break;
          default:
            break;
        }
      });
      if (target !== null) {
        setDrawIndex(target, {
          animate: requested.animate !== false,
          animateState: changed,
          notify: true
        });
      } else if (changed) {
        render({ animate: requested.animate !== false, animateSample: false });
        notify();
      }
    }

    reset.button.addEventListener("click", (event) => {
      event.preventDefault();
      state.populationKnown = initialPopulationKnown;
      state.showInference = initialShowInference;
      setDrawIndex(0, { animate: false, animateState: true, notify: true });
    });
    next.button.addEventListener("click", (event) => {
      event.preventDefault();
      setDrawIndex(state.drawIndex + 1, { animate: true, notify: true });
    });

    rootNode.samplingPathway = {
      applyTutorialAction,
      next() { setDrawIndex(state.drawIndex + 1, { animate: true, notify: true }); },
      reset() {
        state.populationKnown = initialPopulationKnown;
        state.showInference = initialShowInference;
        setDrawIndex(0, { animate: false, animateState: true, notify: true });
      },
      setDrawCount(count) { setDrawIndex(count, { animate: true, notify: true }); }
    };

    const initialCompact = preferredWidth < compactBelow;
    rootNode.dataset.bcLayout = initialCompact ? "compact" : "wide";
    buildChart({ width: preferredWidth, compact: initialCompact });
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
        label: "categorical sampling controls",
        placement: opts.controlsPlacement || "callout",
        layout: opts.controlsLayout || "equal",
        applyAction: applyTutorialAction,
        startOpen: opts.controlsOpen === true
      });
    }
    return rootNode;
  }

  function makeSamplingPathway(options) {
    const opts = options || {};
    ensureStyles();
    visuals.ensureStyles();

    if (String(opts.mode || opts.variant || "").trim().toLowerCase() === "categorical") {
      return makeCategoricalSamplingPathway(opts);
    }

    const preferredWidth = Math.max(240, sampling.finite(opts.width, 760));
    const compactBelow = Math.max(320, sampling.finite(opts.compactBelow, 560));
    const xDomain = Array.isArray(opts.xlim) && opts.xlim.length >= 2
      ? [Number(opts.xlim[0]), Number(opts.xlim[1])]
      : [75, 125];
    const fMean = d3.format(".2~f");
    const seed = String(opts.seed ?? "sampling-pathway-v1");
    const exhaustive = sampling.boolean(opts.exhaustive, false);
    const fallObservationsOnRepeat = sampling.boolean(opts.fallObservationsOnRepeat, false);
    const repeatInterval = sampling.clamp(
      sampling.finite(opts.repeatInterval ?? opts.playDelay, fallObservationsOnRepeat ? 1200 : 240),
      50,
      5000
    );
    const binWidth = Math.max(0.0001, sampling.finite(opts.binWidth, 1));
    const model = sampling.modelFromOptions(opts);
    const sampleSize = Math.max(1, Math.round(sampling.finite(opts.sampleSize ?? opts.n, 10)));
    const markerCount = model.kind === "discrete" ? model.values.length :
      Math.max(80, Math.round(sampling.finite(opts.populationMarkers, 240)));
    const populationMarkers = sampling.markers(model, markerCount, xDomain);
    const sampleAxisEnabled = sampling.boolean(opts.sampleAxis, false);
    const sampleMeanStyle = String(opts.sampleMeanStyle || "line").toLowerCase() === "block"
      ? "block"
      : "line";
    const highlightSelected = sampling.boolean(opts.highlightSelected, true);
    const convergeMeanOnDraw = sampling.boolean(opts.convergeMeanOnDraw, false);

    function makeRecords() {
      const common = {
        n: sampleSize,
        sampleSize,
        binWidth,
        seed,
        roundObservations: sampling.boolean(opts.roundObservations, model.kind !== "discrete"),
        replacement: sampling.boolean(opts.replacement, true),
        ordered: sampling.boolean(opts.ordered, true),
        sampleOrder: opts.sampleOrder || "first-varies-fastest"
      };
      const output = exhaustive
        ? sampling.exhaustiveRecords(model, common)
        : sampling.randomRecords(model, Object.assign(common, {
          count: Math.max(1, Math.round(sampling.finite(opts.sampleCount ?? opts.samples, 200)))
        }));
      output.forEach((record) => {
        record.observations.forEach((observation) => {
          observation.sourceId = sampling.sourceIdFor(model, populationMarkers, observation, xDomain);
        });
      });
      return output;
    }

    const records = makeRecords();

    const domainSpan = Math.max(1e-6, xDomain[1] - xDomain[0]);
    const maxStack = Math.max(1, (d3.max(records, (record) => record.stackIndex) ?? 0) + 1);

    // Values that never change once the records exist. Precomputed so the
    // per-frame render/setValue don't rebuild them on every cascade step.
    const sampleMeans = records.map((record) => record.mean);
    const populationValues = model.kind === "discrete" ? model.values.slice() : [];
    const populationNote = model.kind === "discrete"
      ? `${model.values.length} population values; μ = ${fMean(model.mean)}`
      : `${model.label}; μ = ${fMean(model.mean)}, σ = ${fMean(model.sd)}`;

    const state = {
      drawCount: sampling.clamp(Math.round(sampling.finite(opts.initialCount ?? opts.draw, 0)), 0, records.length),
      showPopulation: sampling.boolean(opts.showPopulation, true),
      showObservations: sampling.boolean(opts.showObservations ?? opts.observations, true),
      showMean: sampling.boolean(opts.showMean, true),
      showAxis: sampling.boolean(opts.showAxis ?? opts.axis, true),
      showSampleAxis: sampleAxisEnabled && sampling.boolean(opts.showSampleAxis, false),
      showDistribution: sampling.boolean(opts.showDistribution, true),
      showActions: sampling.boolean(opts.showActions, true),
      highlightCurrent: sampling.boolean(opts.highlightCurrent, true),
      focus: normalizeFocus(opts.focus, "none"),
      playing: false
    };
    let playTimer = null;
    let playToken = 0;
    let lastTutorialIndex = null;

    const root = d3.create("div")
      .attr("class", "sampling-pathway sfs-sampling-figure sfs-figure")
      .style("--sfs-figure-max-width", opts.maxWidth || "48rem");
    const rootNode = root.node();
    const controls = root.append("div").attr("class", "spp-controls sfs-control-grid");
    const actionsPanel = controls.append("section")
      .attr("class", "sfs-control-panel sfs-if-control-panel");
    actionsPanel.append("p").attr("class", "sfs-control-title").text("Sampling");
    const actions = actionsPanel.append("div").attr("class", "spp-actions sfs-action-row");
    const reset = makeButton(actions, "arrow-counterclockwise", "Reset");
    const next = makeButton(actions, "arrow-down-circle", "Next sample");
    const run = makeButton(actions, "play-fill", "Run");
    const status = actions.append("span")
      .attr("class", "spp-status")
      .attr("aria-live", "polite")
      .node();

    const chartWrap = root.append("div").attr("class", "sfs-chart-wrap");
    let compact = false;
    let width = preferredWidth;
    let height = sampling.finite(opts.height, 500);
    let boxUnitHeight = 1;
    let meanFallFromY = 1;
    let meanFullDropMs = 0;
    let compactContinuousTicks = null;
    let svg = null;
    let title = null;
    let populationPlot = null;
    let samplePlot = null;
    let blockPlot = null;

    function buildChart(layout) {
      if (svg) {
        stop(false);
        if (global.interactiveFigure) {
          global.interactiveFigure.cancelTransitions(rootNode);
        }
      }

      compact = Boolean(layout.compact);
      width = Math.max(240, Math.min(preferredWidth, sampling.finite(layout.width, preferredWidth)));
      const plotInset = Math.max(12, sampling.finite(opts.plotInset, 16));
      const plotLeft = plotInset;
      const plotRight = width - plotInset;
      const x = d3.scaleLinear().domain(xDomain).range([plotLeft, plotRight]);

      // A grid cell sizes the dots (diameter = one score unit) and mean boxes.
      // The horizontal calculation follows the live container width.
      const histogramBandHeight = 130;
      const widthCell = (plotRight - plotLeft) / domainSpan;
      const bandCell = histogramBandHeight / maxStack;
      const stableDiscreteCellSize = Math.max(
        8,
        sampling.finite(opts.discreteCellSize, 31)
      );
      const cellSize = model.kind === "discrete"
        ? Math.min(widthCell, stableDiscreteCellSize)
        : Math.min(widthCell, Math.max(bandCell, 14));
      boxUnitHeight = model.kind === "discrete"
        ? Math.min(cellSize, bandCell)
        : Math.min(Math.max(2, sampling.finite(opts.blockUnitHeight, 6)), bandCell);
      const xInset = ((plotRight - plotLeft) - domainSpan * cellSize) / 2;
      x.range([plotLeft + xInset, plotRight - xInset]);
      // One dot diameter is exactly one score unit. Because x and y use the
      // same cell size, neighbouring dots tile without gaps and a vertical
      // stack preserves the same 1:1 data-unit geometry.
      const dotRadius = cellSize / 2;
      const populationBinWidth = model.kind === "discrete"
        ? null
        : Math.max(1e-6, sampling.finite(opts.populationBinWidth, binWidth));
      const populationLayout = visuals.packedMarkerLayout(
        model,
        populationMarkers,
        x,
        dotRadius,
        xDomain,
        populationBinWidth
      );
      const populationRows = Math.max(
        1,
        (d3.max(populationLayout, (item) => item.row) ?? 0) + 1
      );

      // Keep typography at a fixed CSS size while fitting the population panel
      // to the marks themselves. The dot cloud always begins at the same calm
      // top edge; narrower cells therefore make the whole figure shorter.
      const labelY = 25;
      const noteY = 42;
      const populationTopY = 56;
      const populationAxisY = populationTopY + populationRows * dotRadius * 2;
      const sampleLabelY = populationAxisY + 49;
      const sampleNoteY = populationAxisY + 66;
      const sampleBaseY = populationAxisY + 108;
      const sampleAxisY = sampleBaseY + dotRadius;
      const distributionLabelY = sampleAxisEnabled ? sampleAxisY + 52 : populationAxisY + 152;
      const distributionNoteY = sampleAxisEnabled ? sampleAxisY + 69 : populationAxisY + 169;
      const histTopY = sampleAxisEnabled ? sampleAxisY + 82 : populationAxisY + 182;
      const histBaseY = histTopY + histogramBandHeight;
      const naturalHeight = histBaseY + 44;
      height = Math.max(naturalHeight, sampling.finite(opts.height, naturalHeight));
      // The mean block materializes with its center exactly on the bottom
      // sample-dot baseline, then falls from that same geometry into the stack.
      meanFallFromY = sampleMeanStyle === "block"
        ? sampleBaseY - boxUnitHeight / 2
        : sampleBaseY + 10;
      meanFullDropMs = visuals.fallDurationForDistance(histBaseY - meanFallFromY);

      const requestedTickStep = sampling.finite(opts.populationTickStep, null);
      const continuousTickCount = compact ? 6 : 10;
      const continuousTickStep = requestedTickStep ||
        d3.tickStep(xDomain[0], xDomain[1], continuousTickCount);
      compactContinuousTicks = model.kind === "discrete"
        ? null
        : d3.range(
            Math.ceil(xDomain[0] / continuousTickStep) * continuousTickStep,
            xDomain[1] + continuousTickStep / 2,
            continuousTickStep
          );

      chartWrap.selectAll("*").remove();
      svg = chartWrap.append("svg")
        .attr("class", "sfs-svg sfs-graph")
        .attr("viewBox", [0, 0, width, height])
        .attr("preserveAspectRatio", "xMidYMid meet")
        .attr("role", "img");
      title = svg.append("title");

      populationPlot = visuals.createPopulationPlot(svg, {
        x,
        domain: xDomain,
        radius: dotRadius,
        plotLeft,
        plotRight,
        labelY,
        noteY,
        axisY: populationAxisY,
        muLinePeek: 6,
        axisLabel: opts.populationAxisLabel || "Population score",
        showAxisLabel: sampling.boolean(opts.showPopulationAxisLabel, true),
        individualPalette: opts.individualPalette,
        binWidth: populationBinWidth,
        tickStep: model.kind === "discrete" ? binWidth : continuousTickStep,
        tickValues: model.kind === "discrete" ? model.values : compactContinuousTicks,
        tickFormat: model.kind === "discrete" ? d3.format(".0f") : null
      });
      samplePlot = visuals.createSamplePlot(svg, {
        root: rootNode,
        x,
        plotLeft,
        plotRight,
        labelY: sampleLabelY,
        noteY: sampleNoteY,
        baseY: sampleBaseY,
        axisY: sampleAxisY,
        axisLabel: opts.sampleAxisLabel || opts.populationAxisLabel || "Sample score",
        showAxisLabel: sampling.boolean(opts.showSampleAxisLabel, false),
        individualPalette: opts.individualPalette,
        describeValues: sampling.boolean(opts.describeSampleValues, false),
        sampleValueFormat: opts.sampleValueFormat,
        meanStyle: sampleMeanStyle,
        radius: dotRadius,
        meanBoxY: meanFallFromY,
        meanBoxWidth: Math.abs(x(model.mean + binWidth) - x(model.mean)),
        meanBoxHeight: boxUnitHeight,
        tickValues: model.kind === "discrete" ? model.values : compactContinuousTicks,
        tickFormat: model.kind === "discrete" ? d3.format(".0f") : null
      });
      blockPlot = visuals.createBlockHistogram(svg, {
        x,
        plotLeft,
        plotRight,
        labelY: distributionLabelY,
        noteY: distributionNoteY,
        baseY: histBaseY,
        axisLabel: opts.axisLabel || "Sample mean",
        showAxisLabel: sampling.boolean(opts.showDistributionAxisLabel, false)
      });

      render({ animate: false, fall: false });
    }

    function currentRecord() {
      return state.drawCount > 0 ? records[state.drawCount - 1] : null;
    }

    function syncControls() {
      actionsPanel.style("display", state.showActions ? null : "none");
      reset.button.disabled = state.drawCount === 0 && !state.playing;
      next.button.disabled = state.playing || state.drawCount >= records.length;
      run.button.disabled = state.drawCount >= records.length && !state.playing;
      run.icon.className = `bi bi-${state.playing ? "pause-fill" : "play-fill"}`;
      run.text.textContent = state.playing ? "Pause" : "Run";
      run.button.setAttribute("aria-label", state.playing ? "Pause" : "Run continuously");
      run.button.title = state.playing ? "Pause" : "Run continuously";
      status.textContent = `${state.drawCount} / ${records.length} means`;
      rootNode.setAttribute("aria-busy", state.playing ? "true" : "false");
    }

    function setValue() {
      const current = currentRecord();
      rootNode.value = {
        seed,
        source: exhaustive ? "exhaustive" : "simulated",
        populationKind: model.kind,
        population: populationValues,
        populationMean: model.mean,
        populationSd: model.sd,
        sampleSize,
        n: sampleSize,
        samplesDrawn: state.drawCount,
        sampleCount: records.length,
        currentSample: current ? current.sample.slice() : [],
        currentMean: current ? current.mean : null,
        sampleMeans,
        fallObservationsOnRepeat,
        repeatInterval,
        showPopulation: state.showPopulation,
        showObservations: state.showObservations,
        showMean: state.showMean,
        showSampleAxis: state.showSampleAxis,
        showDistribution: state.showDistribution,
        focus: state.focus
      };
    }

    function notify() {
      rootNode.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function repeatMotionTiming(cadence) {
      const interval = sampling.clamp(sampling.finite(cadence, repeatInterval), 50, 5000);
      const fallDelay = fallObservationsOnRepeat
        ? Math.min(760, Math.max(360, interval * 0.64))
        : Math.min(70, interval * 0.18);
      return {
        interval,
        fallDelay,
        // Only used to size the play-loop's settle wait. The actual box fall is
        // cadence-independent (constant gravity), so this is a fixed value: the
        // time the longest possible drop takes.
        fallDuration: meanFullDropMs,
        observationDuration: Math.min(560, interval * 0.5),
        observationMaxDelay: Math.min(180, interval * 0.15)
      };
    }

    function meanConvergenceTiming(repeated, cadence) {
      if (!repeated) {
        return {
          duration: 560,
          revealDuration: 120,
          holdDuration: 120,
          fadeDuration: 80,
          total: 800
        };
      }
      const interval = sampling.clamp(sampling.finite(cadence, repeatInterval), 50, 5000);
      const duration = sampling.clamp(interval * 0.54, 160, 260);
      const revealDuration = sampling.clamp(interval * 0.2, 60, 100);
      const fadeDuration = 80;
      const holdDuration = sampling.clamp(
        interval - duration - revealDuration - fadeDuration - 10,
        20,
        100
      );
      return {
        duration,
        revealDuration,
        holdDuration,
        fadeDuration,
        total: duration + revealDuration + holdDuration
      };
    }

    function render(settings) {
      const options = settings || {};
      const fallMean = Boolean(options.fallMean ?? options.fall);
      const fallObservations = Boolean(options.fallObservations ?? options.fall);
      const convergeMean = Boolean(options.convergeMean);
      const repeated = Boolean(options.repeated);
      const cadence = sampling.clamp(sampling.finite(options.cadence, repeatInterval), 50, 5000);
      const repeatTiming = repeatMotionTiming(cadence);
      const convergenceTiming = meanConvergenceTiming(repeated, cadence);
      const current = currentRecord();
      const observationDuration = repeated ? repeatTiming.observationDuration : 560;
      const observationMaxDelay = repeated ? repeatTiming.observationMaxDelay : 240;
      const observationStagger = current
        ? Math.min(
            observationMaxDelay,
            Math.max(0, current.observations.length - 1) *
              Math.max(4, 90 / Math.max(1, current.observations.length))
          )
        : 0;
      const convergenceDelay = convergeMean && fallObservations
        ? observationDuration + observationStagger
        : 0;
      const baseFallDelay = repeated
        ? repeatTiming.fallDelay
        : sampling.clamp(sampling.finite(options.delay, 840), 0, 5000);
      const fallDelay = convergeMean
        ? Math.max(baseFallDelay, convergenceDelay + convergenceTiming.total)
        : baseFallDelay;
      const selectedIds = highlightSelected && current
        ? current.observations.map((item) => item.sourceId)
        : [];
      root.attr("data-focus", state.focus);
      populationPlot.update(model, populationMarkers, {
        selectedIds,
        note: populationNote,
        showAxis: state.showAxis,
        animate: options.animate
      });
      samplePlot.update(state.showObservations ? current : null, populationPlot, {
        animate: options.animate,
        fall: fallObservations,
        observationDuration,
        observationMaxDelay,
        meanRevealDelay: fallObservations ? Math.max(200, fallDelay - 80) : 0,
        convergeMean,
        meanConvergenceDelay: convergenceDelay,
        meanConvergenceDuration: convergenceTiming.duration,
        meanRevealDuration: convergenceTiming.revealDuration,
        meanHoldDuration: convergenceTiming.holdDuration,
        meanFadeDuration: convergenceTiming.fadeDuration,
        showMean: state.showMean,
        meanComputed: state.showMean || state.showDistribution,
        showAxis: state.showSampleAxis,
        showEmptyNote: sampling.boolean(opts.showEmptySampleNote, true),
        emptyNote: `n = ${sampleSize}; draw a sample`
      });
      blockPlot.update(records, state.showDistribution ? state.drawCount : 0, model, {
        binWidth,
        unitHeight: boxUnitHeight,
        showAxis: state.showAxis,
        highlightCurrent: state.highlightCurrent,
        animate: options.animate,
        fall: fallMean,
        fallFromY: meanFallFromY,
        fallDelay,
        cascade: repeated,
        tickValues: model.kind === "discrete"
          ? d3.range(xDomain[0] + 1, xDomain[1], 1)
          : compactContinuousTicks,
        tickFormat: model.kind === "discrete" ? d3.format(".0f") : null,
        note: exhaustive
          ? `${state.drawCount} of all ${records.length} possible means`
          : `${state.drawCount} repeated-sample means`
      });
      reveal(populationPlot.layer, state.showPopulation, rootNode, options.animate);
      reveal(
        samplePlot.layer,
        state.showSampleAxis || (state.showObservations && Boolean(current)),
        rootNode,
        options.animate
      );
      reveal(blockPlot.layer, state.showDistribution, rootNode, options.animate);
      syncControls();
      const pathPhrase = !current
        ? "No sample has been drawn."
        : !state.showObservations
          ? "A sample has been drawn but is not displayed."
          : state.showMean || state.showDistribution
            ? `The current sample mean is ${fMean(current.mean)}.`
            : `${sampleSize} selected observations are shown before their mean is computed.`;
      const aria = `${model.label} population with mean ${fMean(model.mean)}. ` +
        `${state.drawCount} of ${records.length} sample means are shown. ${pathPhrase}`;
      svg.attr("aria-label", aria);
      title.text(aria);
      setValue();
    }

    function stop(settle) {
      playToken += 1;
      if (playTimer !== null) {
        global.clearTimeout(playTimer);
        playTimer = null;
      }
      const wasPlaying = state.playing;
      state.playing = false;
      if (settle && wasPlaying) render({ animate: false, fall: false });
      else syncControls();
      return wasPlaying;
    }

    function setDrawCount(count, settings) {
      const options = settings || {};
      const target = sampling.clamp(Math.round(sampling.finite(count, state.drawCount)), 0, records.length);
      stop(false);
      const advancing = target > state.drawCount;
      const convergeMean = options.convergeMean == null
        ? convergeMeanOnDraw && advancing
        : options.convergeMean === true;
      if (options.animate !== false && target > state.drawCount + 1 && !visuals.reducedMotion()) {
        playTo(target, options.delay, { convergeMean });
        return;
      }
      // Ordinary draws fall both observations and means only when advancing to
      // a fresh sample. Tutorial actions may request either fall explicitly so
      // selecting, computing, and placing one mean can occupy separate steps;
      // applyTutorialAction suppresses those requests during backward travel.
      const fallObservations = options.fallObservations == null
        ? options.fall === true && advancing
        : options.fallObservations === true;
      const fallMean = options.fallMean == null
        ? options.fall === true && advancing
        : options.fallMean === true;
      state.drawCount = target;
      render({
        animate: options.animate !== false,
        fallObservations,
        fallMean,
        convergeMean,
        delay: options.delay
      });
      if (options.notify !== false) notify();
    }

    function playTo(targetCount, requestedDelay, settings) {
      const options = settings || {};
      stop(false);
      const target = sampling.clamp(Math.round(targetCount), 0, records.length);
      const delay = sampling.clamp(sampling.finite(requestedDelay, repeatInterval), 50, 5000);
      const timing = repeatMotionTiming(delay);
      const convergenceTiming = meanConvergenceTiming(true, timing.interval);
      const observationStagger = Math.min(
        timing.observationMaxDelay,
        Math.max(0, sampleSize - 1) * Math.max(4, 90 / sampleSize)
      );
      const convergenceDelay = options.convergeMean && fallObservationsOnRepeat
        ? timing.observationDuration + observationStagger
        : 0;
      const fallDelay = options.convergeMean
        ? Math.max(timing.fallDelay, convergenceDelay + convergenceTiming.total)
        : timing.fallDelay;
      const token = playToken;
      state.playing = true;
      syncControls();
      function step() {
        playTimer = null;
        if (token !== playToken || !state.playing) return;
        if (state.drawCount >= target) {
          const drainTime = Math.max(0,
            fallDelay + timing.fallDuration - timing.interval + 40
          );
          const finish = () => {
            playTimer = null;
            if (token !== playToken || !state.playing) return;
            state.playing = false;
            // Settle any boxes still mid-fall onto their final stacks so the
            // cascade never ends with stragglers frozen in mid-air.
            render({ animate: false, fall: false });
            syncControls();
            setValue();
            notify();
          };
          if (drainTime > 0) playTimer = global.setTimeout(finish, drainTime);
          else finish();
          return;
        }
        state.drawCount += 1;
        render({
          animate: true,
          fallMean: true,
          fallObservations: fallObservationsOnRepeat,
          convergeMean: options.convergeMean === true,
          repeated: true,
          cadence: timing.interval
        });
        playTimer = global.setTimeout(step, timing.interval);
      }
      step();
    }

    function applyTutorialAction(action, context) {
      const requested = action || {};
      const animate = requested.animate !== false;
      let target = null;
      let delay = requested.delay;
      let fallObservations = null;
      let fallMean = null;
      let convergeMean = false;
      let changed = false;
      const tutorialIndex = context && Number.isFinite(Number(context.index))
        ? Number(context.index)
        : null;
      const movingForward = tutorialIndex === null || lastTutorialIndex === null ||
        tutorialIndex > lastTutorialIndex;
      stop(true);
      Object.entries(requested).forEach(([rawKey, value]) => {
        switch (sampling.actionKey(rawKey)) {
          case "animate":
          case "delay":
            break;
          case "draw":
          case "count":
          case "samples-drawn":
            target = value;
            break;
          case "observations":
          case "show-observations":
          case "show-sample":
            state.showObservations = sampling.boolean(value, state.showObservations);
            changed = true;
            break;
          case "show-population":
          case "population":
            state.showPopulation = sampling.boolean(value, state.showPopulation);
            changed = true;
            break;
          case "show-mean":
          case "mean-label":
            state.showMean = sampling.boolean(value, state.showMean);
            changed = true;
            break;
          case "show-sample-axis":
          case "sample-axis":
            state.showSampleAxis = sampleAxisEnabled && sampling.boolean(value, state.showSampleAxis);
            changed = true;
            break;
          case "show-distribution":
          case "distribution":
            state.showDistribution = sampling.boolean(value, state.showDistribution);
            changed = true;
            break;
          case "focus":
          case "emphasize":
            state.focus = normalizeFocus(value, state.focus);
            changed = true;
            break;
          case "fall-observations":
            fallObservations = sampling.boolean(value, false);
            break;
          case "fall-mean":
          case "drop-mean":
            fallMean = sampling.boolean(value, false);
            break;
          case "converge-mean":
          case "animate-mean":
            convergeMean = sampling.boolean(value, false);
            break;
          case "axis":
          case "show-axis":
            state.showAxis = sampling.boolean(value, state.showAxis);
            changed = true;
            break;
          case "show-controls":
          case "show-actions":
            state.showActions = sampling.boolean(value, state.showActions);
            changed = true;
            break;
          case "highlight-current":
            state.highlightCurrent = sampling.boolean(value, state.highlightCurrent);
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
      if (target !== null) {
        setDrawCount(target, {
          animate,
          delay,
          notify: true,
          fall: true,
          fallObservations: fallObservations === null ? null : fallObservations && movingForward,
          fallMean: fallMean === null ? null : fallMean && movingForward,
          convergeMean: convergeMean && movingForward
        });
      } else if (changed) {
        render({ animate, fall: false });
        notify();
      }
      if (tutorialIndex !== null) lastTutorialIndex = tutorialIndex;
    }

    reset.button.addEventListener("click", (event) => {
      event.preventDefault();
      setDrawCount(0, { animate: false, notify: true });
    });
    next.button.addEventListener("click", (event) => {
      event.preventDefault();
      setDrawCount(state.drawCount + 1, { animate: true, fall: true, notify: true });
    });
    run.button.addEventListener("click", (event) => {
      event.preventDefault();
      if (state.playing) {
        stop(true);
        notify();
      } else {
        playTo(records.length, repeatInterval, { convergeMean: convergeMeanOnDraw });
      }
    });

    rootNode.samplingPathway = {
      applyTutorialAction,
      next() { setDrawCount(state.drawCount + 1, { animate: true, fall: true, notify: true }); },
      reset() { setDrawCount(0, { animate: false, notify: true }); },
      setDrawCount(count) { setDrawCount(count, { animate: true, notify: true }); },
      play() { playTo(records.length, repeatInterval, { convergeMean: convergeMeanOnDraw }); },
      pause() { stop(true); }
    };

    const initialCompact = preferredWidth < compactBelow;
    rootNode.dataset.bcLayout = initialCompact ? "compact" : "wide";
    buildChart({ width: preferredWidth, compact: initialCompact });
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
        label: "sampling pathway controls",
        placement: opts.controlsPlacement || "callout",
        layout: opts.controlsLayout || "equal",
        applyAction: applyTutorialAction,
        startOpen: opts.controlsOpen === true
      });
    }
    return rootNode;
  }

  global.makeSamplingPathway = makeSamplingPathway;
  global.bcSamplingPathway = makeSamplingPathway;
}(window));
