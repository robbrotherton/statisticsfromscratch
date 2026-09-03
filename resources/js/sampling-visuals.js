(function(global) {
  "use strict";

  const sampling = global.sfsSampling;

  // A single constant "gravity" governs every falling mean-box, so a box always
  // drops at the speed physics dictates for its height — the same acceleration
  // whether samples are being drawn one at a time or cycling rapidly. Each fall's
  // DURATION is derived from its distance (easeQuadIn traces constant-acceleration
  // motion: distance = ½·g·t²), never from the sampling cadence. Raise MEAN_FALL_G
  // for snappier drops, lower it for a lazier fall.
  const MEAN_FALL_G = 1700; // px per second^2
  function fallDurationForDistance(distance) {
    return Math.sqrt(2 * Math.max(0, distance) / MEAN_FALL_G) * 1000;
  }

  function ensureStyles() {
    if (document.getElementById("sfs-sampling-visuals-styles")) return;
    const style = document.createElement("style");
    style.id = "sfs-sampling-visuals-styles";
    style.textContent = `
      .sfs-sampling-figure {
        --bcs-sample: var(--graph-series-2, #e69f00);
        --bcs-current: var(--sfs-current-color, #d1495b);
        --bcs-density: var(--graph-block-fill, var(--graph-data-color, #0072b2));
        --bcs-reference: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
        --sfs-figure-max-width: 48rem;
        --sfs-viz-title-size: var(--sfs-figure-title-size, 1rem);
        --sfs-viz-label-size: var(--sfs-figure-label-size, 0.875rem);
        --sfs-viz-note-size: var(--sfs-figure-note-size, 0.8125rem);
        --sfs-viz-tick-size: var(--sfs-figure-tick-size, 0.8125rem);
        --sfs-viz-small-size: var(--sfs-figure-small-size, 0.75rem);
      }

      .sfs-sampling-figure .bcs-panel-label {
        fill: var(--sfs-text, currentColor);
        font-size: var(--sfs-viz-title-size);
        font-weight: 700;
      }

      .sfs-sampling-figure .bcs-panel-note,
      .sfs-sampling-figure .bcs-axis text {
        fill: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
        font-size: var(--sfs-viz-tick-size);
      }

      .sfs-sampling-figure .bcs-panel-note {
        font-size: var(--sfs-viz-note-size);
      }

      .sfs-sampling-figure .bcs-axis path,
      .sfs-sampling-figure .bcs-axis line {
        stroke: var(--graph-axis-color, currentColor);
      }

      .sfs-sampling-figure .bcs-pop-dot,
      .sfs-sampling-figure .bcs-sample-dot {
        stroke: var(--graph-point-stroke, var(--sfs-bg, white));
        stroke-width: 0.7;
        transition: opacity 280ms ease, stroke 280ms ease, stroke-width 280ms ease;
        vector-effect: non-scaling-stroke;
      }

      .sfs-sampling-figure .bcs-mean-ghost {
        opacity: 0.68;
        pointer-events: none;
        stroke: var(--graph-point-stroke, var(--sfs-bg, white));
        stroke-width: 0.9;
        vector-effect: non-scaling-stroke;
      }

      .sfs-sampling-figure .bcs-pop-dot { opacity: 0.92; }
      .sfs-sampling-figure .bcs-pop-dot.is-source {
        stroke: var(--bcs-current);
        stroke-width: 1.35;
      }

      .sampling-pathway[data-focus="sample"] .bcs-pop-dot:not(.is-source),
      .sampling-pathway[data-focus="sample-mean"] .bcs-pop-dot:not(.is-source) {
        opacity: 0.18;
      }

      .sampling-pathway[data-focus="mean"] .bcs-pop-dot:not(.is-source),
      .sampling-pathway[data-focus="distribution"] .bcs-pop-dot {
        opacity: 0.12;
      }

      .sampling-pathway[data-focus="mean"] .bcs-pop-dot.is-source,
      .sampling-pathway[data-focus="mean"] .bcs-sample-dot {
        opacity: 0.32;
      }

      .sampling-pathway[data-focus="distribution"] .bcs-sample-dot {
        opacity: 0.2;
      }

      .sampling-pathway[data-focus="distribution"] .bcs-sample-layer > .bcs-panel-label,
      .sampling-pathway[data-focus="distribution"] .bcs-sample-layer > .bcs-panel-note,
      .sampling-pathway[data-focus="distribution"] .bcs-sample-layer > .bcs-axis,
      .sampling-pathway[data-focus="distribution"] .bcs-sample-layer > .bcs-axis-label {
        opacity: 0.4;
      }

      .sampling-pathway .bcs-sample-layer > .bcs-panel-label,
      .sampling-pathway .bcs-sample-layer > .bcs-panel-note,
      .sampling-pathway .bcs-sample-layer > .bcs-axis,
      .sampling-pathway .bcs-sample-layer > .bcs-axis-label {
        transition: opacity 280ms ease;
      }

      .sfs-sampling-figure .bcs-mu-line {
        stroke: var(--sfs-text, currentColor);
        stroke-width: 1.25;
        stroke-dasharray: 4 4;
        opacity: 0.48;
        vector-effect: non-scaling-stroke;
      }

      .sfs-sampling-figure .bcs-mean-block {
        fill: var(--graph-data-color, var(--graph-block-fill, #0072b2));
        stroke: var(--graph-bar-stroke, var(--sfs-text, currentColor));
        stroke-width: 0.7;
        shape-rendering: crispEdges;
        vector-effect: non-scaling-stroke;
      }

      .sfs-sampling-figure .bcs-mean-line {
        stroke: var(--bcs-current);
        stroke-width: 2;
        vector-effect: non-scaling-stroke;
      }

      .sfs-sampling-figure .bcs-mean-label {
        fill: var(--bcs-current);
        font-size: var(--sfs-viz-label-size);
        font-weight: 700;
      }

      .sfs-sampling-figure .bcs-panel-note.is-mean {
        fill: var(--graph-data-color, var(--graph-block-fill, #0072b2));
        font-weight: 700;
      }

      .sfs-sampling-figure .bcs-block {
        fill: var(--graph-block-fill, var(--sfs-text, currentColor));
        stroke: var(--graph-block-stroke, var(--sfs-bg, white));
        stroke-width: 0.55;
        opacity: 0.86;
        shape-rendering: crispEdges;
        vector-effect: non-scaling-stroke;
      }

      .sfs-sampling-figure .bcs-block.is-current {
        fill: var(--bcs-current);
        opacity: 1;
      }

      .sfs-sampling-figure .bcs-block.is-in-flight {
        opacity: 1;
      }

      .sfs-sampling-figure .bcs-histogram-bar {
        fill: var(--bcs-density);
        stroke: color-mix(in srgb, var(--bcs-density) 72%, var(--sfs-bg, white));
        stroke-width: 0.35;
        vector-effect: non-scaling-stroke;
      }

      .sfs-sampling-figure .bcs-reference-line {
        fill: none;
        stroke: var(--bcs-reference);
        stroke-width: 1.8;
        stroke-dasharray: 6 5;
        vector-effect: non-scaling-stroke;
      }

      .sfs-sampling-figure .bcs-reference-label {
        fill: var(--bcs-reference);
        font-size: var(--sfs-viz-note-size);
        font-weight: 650;
      }

      .sfs-sampling-figure .bcs-scale-tag {
        fill: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
        font-size: var(--sfs-viz-small-size);
        font-weight: 650;
      }

      @media (prefers-reduced-motion: reduce) {
        .sfs-sampling-figure .bcs-pop-dot,
        .sfs-sampling-figure .bcs-sample-dot,
        .sampling-pathway .bcs-sample-layer > .bcs-panel-label,
        .sampling-pathway .bcs-sample-layer > .bcs-panel-note,
        .sampling-pathway .bcs-sample-layer > .bcs-axis,
        .sampling-pathway .bcs-sample-layer > .bcs-axis-label {
          transition: none !important;
        }
      }

      html[data-motion="reduced"] .sfs-sampling-figure .bcs-pop-dot,
      html[data-motion="reduced"] .sfs-sampling-figure .bcs-sample-dot,
      html[data-motion="reduced"] .sampling-pathway .bcs-sample-layer > .bcs-panel-label,
      html[data-motion="reduced"] .sampling-pathway .bcs-sample-layer > .bcs-panel-note,
      html[data-motion="reduced"] .sampling-pathway .bcs-sample-layer > .bcs-axis,
      html[data-motion="reduced"] .sampling-pathway .bcs-sample-layer > .bcs-axis-label {
        transition: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function reducedMotion() {
    return Boolean(global.sfsReducedMotion) || Boolean(global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  const tableau10Fallback = Object.freeze([
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
    "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ab"
  ]);

  function palette() {
    return d3.schemeTableau10 || d3.schemeCategory10 || tableau10Fallback;
  }

  // Small, fixed identity sets can reuse the book's semantic series palette;
  // larger populations keep the stable hashed Tableau10 colors below.
  function resolveIndividualPalette(name) {
    if (String(name || "").toLowerCase() !== "graph-series-2-5") return null;
    return [2, 3, 4, 5].map((index) => `var(--graph-series-${index})`);
  }

  function colorForProbability(probability) {
    const colors = palette();
    return colors[Math.min(colors.length - 1, Math.floor(sampling.clamp(probability, 0, 0.999999) * colors.length))];
  }

  // Scatter an integer index across the palette so neighbouring dots get
  // different colours (chaotic look) instead of an ordered rainbow. Keyed by a
  // stable per-dot index so a dot keeps its colour across re-renders and a
  // sampled dot matches the population dot it fell from. Swap `palette()` above
  // to change the colour set, or return a single colour here to disable it.
  function colorForIndex(index, requestedColors) {
    const colors = Array.isArray(requestedColors) && requestedColors.length
      ? requestedColors
      : palette();
    if (Array.isArray(requestedColors) && requestedColors.length) {
      const position = Math.abs(Math.floor(Number.isFinite(index) ? index : 0)) % colors.length;
      return colors[position];
    }
    let h = Math.floor(Number.isFinite(index) ? index : 0) | 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    return colors[h % colors.length];
  }

  function tickValues(domain, step) {
    if (!Number.isFinite(step) || step <= 0) return null;
    const start = Math.ceil(domain[0] / step) * step;
    return d3.range(start, domain[1] + step / 2, step);
  }

  function packedMarkerLayout(
    model,
    markerData,
    x,
    radius,
    domain,
    requestedBinWidth,
    requestedColors
  ) {
    if (model.kind === "discrete") {
      const stacks = new Map();
      return markerData.map((marker) => {
        const key = String(marker.value);
        const row = stacks.get(key) || 0;
        stacks.set(key, row + 1);
        return Object.assign({}, marker, {
          bin: marker.value,
          row,
          cx: x(marker.value),
          color: colorForIndex(marker.id, requestedColors)
        });
      });
    }

    const pitch = radius * 2;
    const binWidth = Number.isFinite(requestedBinWidth) && requestedBinWidth > 0
      ? requestedBinWidth
      : Math.abs(x.invert(x(0) + pitch) - x.invert(x(0)));
    // Snap the outermost columns to the grid points just inside the domain so
    // edge dots land exactly on their axis ticks — e.g. the last column sits on
    // 130, not half a column short of it. (The old half-column inset let the
    // extreme marker round up to 130 and then clamped it back to 129.5, leaving
    // that one dot visibly off its tick.)
    const loBin = Math.ceil(domain[0] / binWidth) * binWidth;
    const hiBin = Math.floor(domain[1] / binWidth) * binWidth;
    const stacks = new Map();
    return markerData.map((marker) => {
      const bin = sampling.clamp(Math.round(marker.value / binWidth) * binWidth, loBin, hiBin);
      const key = bin.toFixed(8);
      const row = stacks.get(key) || 0;
      stacks.set(key, row + 1);
      return Object.assign({}, marker, {
        bin,
        row,
        cx: x(bin),
        color: colorForIndex(marker.id, requestedColors)
      });
    });
  }

  function createPopulationPlot(svg, options) {
    const opts = options || {};
    const x = opts.x;
    const domain = opts.domain;
    const radius = opts.radius;
    let axisY = opts.axisY;
    // Where the bottom row of dots rests. Derived from the axis so the dots sit
    // directly on it (no gap) whatever the radius is. Set opts.axisGap to a
    // positive number of pixels if you ever want a small gap back.
    const axisGap = Number.isFinite(opts.axisGap) ? opts.axisGap : 0;
    let baseY = axisY - radius - axisGap;
    const plotLeft = opts.plotLeft;
    const plotRight = opts.plotRight;
    const individualColors = resolveIndividualPalette(opts.individualPalette);
    const layer = svg.append("g").attr("class", "bcs-population-layer sfs-if-reveal");
    layer.append("text")
      .attr("class", "bcs-panel-label")
      .attr("x", plotLeft).attr("y", opts.labelY)
      .text(opts.label || "Population");
    const note = layer.append("text")
      .attr("class", "bcs-panel-note")
      .attr("x", plotLeft).attr("y", opts.noteY);
    const muLine = layer.append("line")
      .attr("class", "bcs-mu-line")
      .attr("y1", opts.noteY + 8).attr("y2", axisY + 5);
    const dotsLayer = layer.append("g").attr("class", "bcs-population-dots");
    const axis = layer.append("g")
      .attr("class", "bcs-axis sfs-axis")
      .attr("transform", `translate(0,${axisY})`);
    const axisLabel = layer.append("text")
      .attr("class", "bcs-panel-note")
      .attr("x", (plotLeft + plotRight) / 2).attr("y", axisY + 34)
      .attr("text-anchor", "middle")
      .text(opts.axisLabel || "Score");
    let layout = [];
    let layoutById = new Map();
    let builtMarkers = null;
    let builtModel = null;
    let populationAnimationToken = 0;

    function topOfDots() {
      const highestRow = d3.max(layout, (item) => item.row);
      return Number.isFinite(highestRow)
        ? axisY - axisGap - (highestRow + 1) * radius * 2
        : axisY;
    }

    function positionMuLine(animate) {
      const selection = muLine.interrupt();
      const target = animate && !reducedMotion()
        ? selection.transition().duration(520).ease(d3.easeCubicOut)
        : selection;
      target
        .attr("y1", topOfDots() - (Number(opts.muLinePeek) || 6))
        .attr("y2", axisY + 5);
    }

    function drawAxis() {
      const values = opts.tickValues || tickValues(domain, opts.tickStep);
      const generator = d3.axisBottom(x).tickSizeOuter(0);
      if (values) generator.tickValues(values);
      if (opts.tickFormat) generator.tickFormat(opts.tickFormat);
      axis.call(generator);
      axis.selectAll("text").attr("dy", "1em");
    }

    function appendDots(markerLayout) {
      return dotsLayer.selectAll("circle")
        .data(markerLayout, (item) => item.id)
        .join(
          (enter) => enter.append("circle")
            .attr("class", "bcs-pop-dot sfs-graph-point")
            .attr("r", radius),
          (updateSelection) => updateSelection,
          (exit) => exit.remove()
        )
        .attr("cx", (item) => item.cx)
        .style("fill", (item) => item.color);
    }

    function horizontalFlightDelay(item) {
      const proportion = sampling.clamp(
        (item.cx - plotLeft) / Math.max(1, plotRight - plotLeft), 0, 1
      );
      return proportion * 220;
    }

    function individualFlightJitter(item, salt, spread) {
      // A small deterministic offset stops neighbouring columns moving like a
      // single flexible sheet, while preserving the clear left-to-right sweep.
      return Math.abs(Math.imul(item.id + salt, 47)) % Math.max(1, spread);
    }

    function populationFlightDuration(distance) {
      // Use the same distance-based fall model as the sample-mean blocks, just
      // slightly accelerated so a full population replacement stays brisk.
      return Math.max(140, fallDurationForDistance(distance) * 0.72);
    }

    function maximumRowsByColumn(items) {
      const maximums = new Map();
      items.forEach((item) => {
        const key = String(item.cx);
        maximums.set(key, Math.max(maximums.get(key) ?? 0, item.row));
      });
      return maximums;
    }

    // (Re)draw the whole dot layer. For an explicit population replacement,
    // send the old fixed formation upward before dropping the new one in. This
    // keeps the two populations visually distinct instead of implying that the
    // same observations continuously change their values.
    function rebuild(model, markerData, settings) {
      const state = settings || {};
      populationAnimationToken += 1;
      const animationToken = populationAnimationToken;
      const previousDots = dotsLayer.selectAll("circle").interrupt();
      layout = packedMarkerLayout(
        model,
        markerData,
        x,
        radius,
        domain,
        opts.binWidth,
        individualColors
      );
      layoutById = new Map(layout.map((item) => [item.id, item]));
      drawAxis();

      const replaceModel = Boolean(state.replaceModel) &&
        previousDots.size() > 0 && !reducedMotion();
      function updateAnnotations(animate) {
        note.text(state.note != null
          ? state.note
          : `${model.label}; μ = ${d3.format(".2~f")(model.mean)}, σ = ${d3.format(".2~f")(model.sd)}`);
        muLine.attr("x1", x(model.mean)).attr("x2", x(model.mean));
        positionMuLine(animate);
      }
      if (!replaceModel) {
        updateAnnotations(state.animate);
        const dots = appendDots(layout).interrupt();
        const target = state.animate && !reducedMotion()
          ? dots
            .attr("cy", opts.labelY + 30)
            .transition().duration(520).ease(d3.easeCubicOut)
          : dots;
        target
          .attr("cx", (item) => item.cx)
          .attr("cy", (item) => baseY - item.row * radius * 2)
          .style("opacity", null)
          .style("fill", (item) => item.color);
        return;
      }

      const beamY = -radius * 2;
      const previousLayout = previousDots.data();
      const previousMaximumRows = maximumRowsByColumn(previousLayout);
      const dotStagger = 14;
      const outgoingDelay = (item) => horizontalFlightDelay(item) +
        (previousMaximumRows.get(String(item.cx)) - item.row) * dotStagger +
        individualFlightJitter(item, 11, 7);
      const incomingDelay = (item) => horizontalFlightDelay(item) +
        item.row * dotStagger + individualFlightJitter(item, 29, 7);
      const targetY = (item) => baseY - item.row * radius * 2;
      previousDots
        .transition()
        .delay(outgoingDelay)
        .duration(function() {
          return populationFlightDuration(Number(this.getAttribute("cy")) - beamY);
        })
        .ease(d3.easeQuadOut)
        .attr("cy", beamY)
        .end()
        .then(() => {
          if (animationToken !== populationAnimationToken) return;
          previousDots.remove();
          updateAnnotations(false);
          appendDots(layout)
            .attr("cy", beamY)
            .transition()
            .delay(incomingDelay)
            .duration((item) => populationFlightDuration(targetY(item) - beamY))
            .ease(d3.easeQuadIn)
            .attr("cy", targetY);
        })
        .catch(() => {
          // An interrupted population swap is expected during rapid navigation.
        });
    }

    function relayout(settings) {
      const state = settings || {};
      const nextAxisY = Number(state.axisY);
      if (!Number.isFinite(nextAxisY) || Math.abs(nextAxisY - axisY) < 1e-8) return;
      axisY = nextAxisY;
      baseY = axisY - radius - axisGap;
      const animate = Boolean(state.animate) && !reducedMotion();
      const axisTarget = animate
        ? axis.interrupt().transition().duration(520).ease(d3.easeCubicOut)
        : axis.interrupt();
      const labelTarget = animate
        ? axisLabel.interrupt().transition().duration(520).ease(d3.easeCubicOut)
        : axisLabel.interrupt();
      axisTarget.attr("transform", `translate(0,${axisY})`);
      labelTarget.attr("y", axisY + 34);
      const dots = dotsLayer.selectAll("circle").interrupt();
      const dotTarget = animate
        ? dots.transition().duration(520).ease(d3.easeCubicOut)
        : dots;
      dotTarget.attr("cy", (item) => baseY - item.row * radius * 2);
      positionMuLine(animate);
    }

    function update(model, markerData, settings) {
      const state = settings || {};
      if (markerData !== builtMarkers || model !== builtModel) {
        builtMarkers = markerData;
        builtModel = model;
        rebuild(model, markerData, state);
      }
      if (state.note != null && !state.replaceModel) note.text(state.note);
      const selected = state.selectedIds && state.selectedIds.length
        ? new Set(state.selectedIds) : null;
      dotsLayer.selectAll("circle")
        .classed("is-source", (item) => Boolean(selected && selected.has(item.id)));
      axis.attr("display", state.showAxis === false ? "none" : null);
      axisLabel.attr("display", state.showAxis === false || opts.showAxisLabel === false ? "none" : null);
      return layout;
    }

    drawAxis();
    return {
      layer,
      relayout,
      update,
      getLayout: () => layout.slice(),
      positionForSource(sourceId) {
        const marker = layoutById.get(sourceId);
        return marker ? { x: marker.cx, y: baseY - marker.row * radius * 2 } :
          { x: x((domain[0] + domain[1]) / 2), y: baseY };
      }
    };
  }

  function createSamplePlot(svg, options) {
    const opts = options || {};
    const x = opts.x;
    const individualColors = resolveIndividualPalette(opts.individualPalette);
    const formatSampleValue = d3.format(opts.sampleValueFormat || ".2~f");
    const subscriptDigits = {
      "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
      "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉"
    };
    const subscriptNumber = (value) => String(value).replace(/\d/g, (digit) => subscriptDigits[digit]);
    const layer = svg.append("g").attr("class", "bcs-sample-layer sfs-if-reveal");
    layer.append("text")
      .attr("class", "bcs-panel-label")
      .attr("x", opts.plotLeft).attr("y", opts.labelY)
      .text(opts.label || "Sample");
    const note = layer.append("text")
      .attr("class", "bcs-panel-note")
      .attr("x", opts.plotLeft).attr("y", opts.noteY);
    const dotsLayer = layer.append("g");
    const meanGhostLayer = layer.append("g")
      .attr("class", "bcs-mean-ghost-layer")
      .attr("aria-hidden", "true");
    const axis = layer.append("g")
      .attr("class", "bcs-axis sfs-axis")
      .attr("transform", `translate(0,${opts.axisY})`);
    const axisLabel = layer.append("text")
      .attr("class", "bcs-panel-note bcs-axis-label")
      .attr("x", opts.plotRight)
      .attr("y", opts.axisY + 34)
      .attr("text-anchor", "end")
      .text(opts.axisLabel || "Sample score");
    const meanGroup = layer.append("g")
      .attr("class", "bcs-mean-group sfs-if-reveal")
      .attr("data-style", opts.meanStyle === "block" ? "block" : "line");
    const meanLine = meanGroup.append("line")
      .attr("class", "bcs-mean-line")
      .attr("display", opts.meanStyle === "block" ? "none" : null);
    const meanBlock = meanGroup.append("rect")
      .attr("class", "bcs-mean-block")
      .attr("display", opts.meanStyle === "block" ? null : "none");
    const meanLabel = meanGroup.append("text")
      .attr("class", "bcs-mean-label")
      .attr("text-anchor", "middle")
      .attr("display", opts.meanStyle === "block" ? "none" : null);

    const generator = d3.axisBottom(x).tickSizeOuter(0);
    if (opts.tickValues) generator.tickValues(opts.tickValues);
    if (opts.tickFormat) generator.tickFormat(opts.tickFormat);
    axis.call(generator);
    axis.selectAll("text").attr("dy", "1em");

    function update(record, populationPlot, settings) {
      const state = settings || {};
      const observations = record ? record.observations : [];
      const showMean = Boolean(record && state.showMean !== false);
      const meanComputed = Boolean(record && (state.meanComputed || showMean));
      const convergeMean = Boolean(
        record && meanComputed && state.animate && state.convergeMean && !reducedMotion()
      );
      const observationText = opts.describeValues
        ? observations.map((item, index) =>
            `X${subscriptNumber(index + 1)} = ${formatSampleValue(item.value)}`
          ).join("; ")
        : `n = ${observations.length}`;
      const meanText = record
        ? `${observationText}; M = ${d3.format(".2~f")(record.mean)}`
        : "";
      note
        .interrupt()
        .attr("display", record || state.showEmptyNote !== false ? null : "none")
        .classed("is-mean", meanComputed && !convergeMean)
        .text(record
          ? state.note || (convergeMean
            ? `${observationText}; averaging scores…`
            : meanComputed
              ? meanText
            : opts.describeValues
              ? observationText
              : `n = ${observations.length} selected scores`)
          : state.emptyNote || "No sample yet");
      const stacks = new Map();
      const pitch = opts.radius * 1.45;
      const data = observations.map((item) => {
        const source = populationPlot.positionForSource(item.sourceId);
        const key = source.x.toFixed(4);
        const row = stacks.get(key) || 0;
        stacks.set(key, row + 1);
        return Object.assign({}, item, { source, row });
      });
      const dots = dotsLayer.selectAll("circle")
        .data(data, (item) => item.sampleIndex)
        .join(
          (enter) => enter.append("circle")
            .attr("class", "bcs-sample-dot sfs-graph-point")
            .attr("r", opts.radius),
          (updateSelection) => updateSelection,
          (exit) => exit.remove()
        )
        .interrupt()
        .style("fill", (item) => colorForIndex(item.sourceId, individualColors));
      const shouldFall = Boolean(record && state.animate && state.fall && !reducedMotion());
      dots
        .attr("cx", (item) => item.source.x)
        .attr("cy", (item) => shouldFall ? item.source.y : opts.baseY - item.row * pitch);
      if (shouldFall) {
        dots.transition()
          .duration(state.observationDuration || 560)
          .delay((item) => Math.min(
            state.observationMaxDelay || 240,
            item.sampleIndex * Math.max(4, 90 / observations.length)
          ))
          .ease(d3.easeBounceOut)
          .attr("cy", (item) => opts.baseY - item.row * pitch);
      }
      const meanX = record ? x(record.mean) : x(0);
      meanLine
        .interrupt()
        .attr("x1", meanX).attr("x2", meanX)
        .attr("y1", opts.baseY + 8).attr("y2", opts.baseY - 24);
      meanBlock
        .interrupt()
        .attr("x", meanX - opts.meanBoxWidth / 2)
        .attr("y", opts.meanBoxY)
        .attr("width", opts.meanBoxWidth)
        .attr("height", opts.meanBoxHeight);
      meanLabel
        .interrupt()
        .attr("x", meanX).attr("y", opts.baseY - 31)
        .text(record ? `M = ${d3.format(".2~f")(record.mean)}` : "");

      axis.attr("display", state.showAxis === false ? "none" : null);
      axisLabel.attr("display", state.showAxis === false || opts.showAxisLabel === false ? "none" : null);
      meanGhostLayer.selectAll("*").interrupt().remove();
      meanGroup.interrupt().style("opacity", null);
      const revealMean = showMean || convergeMean;
      if (global.interactiveFigure && global.interactiveFigure.setRevealVisible) {
        global.interactiveFigure.setRevealVisible(meanGroup, revealMean, {
          root: opts.root,
          animate: convergeMean ? false : state.animate
        });
      } else {
        meanGroup.attr("display", revealMean ? null : "none");
      }

      if (convergeMean) {
        const convergenceDuration = Math.max(1, state.meanConvergenceDuration || 560);
        const convergenceDelay = Math.max(0, state.meanConvergenceDelay || 0);
        const revealDuration = Math.max(1, state.meanRevealDuration || 120);
        const holdDuration = Math.max(0, state.meanHoldDuration || 0);
        const fadeDuration = Math.max(1, state.meanFadeDuration || 80);
        const targetY = opts.meanBoxY + opts.meanBoxHeight / 2;
        const ghosts = meanGhostLayer.selectAll("circle")
          .data(data, (item) => item.sampleIndex)
          .join("circle")
          .attr("class", "bcs-mean-ghost sfs-graph-point")
          .attr("r", opts.radius)
          .attr("cx", (item) => item.source.x)
          .attr("cy", (item) => opts.baseY - item.row * pitch)
          .attr("visibility", "hidden")
          .style("fill", (item) => colorForIndex(item.sourceId, individualColors));

        meanGroup.style("opacity", 0);
        ghosts.transition()
          .delay(convergenceDelay)
          .duration(convergenceDuration)
          .ease(d3.easeCubicInOut)
          .on("start.bcs-mean-ghost", function() {
            d3.select(this).attr("visibility", null);
          })
          .attr("cx", meanX)
          .attr("cy", targetY)
          .transition()
          .duration(revealDuration)
          .style("opacity", 0)
          .remove();

        let meanTransition = meanGroup.transition()
          .delay(convergenceDelay + convergenceDuration)
          .duration(revealDuration)
          .style("opacity", 1)
          .on("start.bcs-mean-note", function() {
            note.classed("is-mean", true).text(state.note || meanText);
          });
        if (!showMean) {
          meanTransition = meanTransition.transition()
            .delay(holdDuration)
            .duration(fadeDuration)
            .style("opacity", 0)
            .on("end.bcs-mean-hide", function() {
              d3.select(this).style("opacity", null);
              if (global.interactiveFigure && global.interactiveFigure.setRevealVisible) {
                global.interactiveFigure.setRevealVisible(meanGroup, false, {
                  root: opts.root,
                  animate: false
                });
              } else {
                meanGroup.attr("display", "none");
              }
            });
        } else {
          meanTransition.on("end.bcs-mean-reveal", function() {
            d3.select(this).style("opacity", null);
          });
        }
      } else if (shouldFall && showMean) {
        const revealDelay = state.meanRevealDelay ?? 700;
        meanGroup
          .style("opacity", 0)
          .transition()
          .delay(revealDelay)
          .duration(160)
          .style("opacity", 1)
          .on("end.bcs-mean-reveal", function() {
            d3.select(this).style("opacity", null);
          });
      }
    }

    return { layer, meanGroup, update };
  }

  function createBlockHistogram(svg, options) {
    const opts = options || {};
    const x = opts.x;
    const layer = svg.append("g").attr("class", "bcs-block-histogram-layer sfs-if-reveal");
    layer.append("text")
      .attr("class", "bcs-panel-label")
      .attr("x", opts.plotLeft).attr("y", opts.labelY)
      .text(opts.label || "Distribution of sample means");
    const note = layer.append("text")
      .attr("class", "bcs-panel-note")
      .attr("x", opts.plotLeft).attr("y", opts.noteY);
    const muLine = layer.append("line")
      .attr("class", "bcs-mu-line")
      .attr("y1", opts.noteY + 10).attr("y2", opts.baseY + 5);
    const blocksLayer = layer.append("g");
    const axis = layer.append("g")
      .attr("class", "bcs-axis sfs-axis")
      .attr("transform", `translate(0,${opts.baseY})`);
    const axisLabel = layer.append("text")
      .attr("class", "bcs-panel-note")
      .attr("x", (opts.plotLeft + opts.plotRight) / 2)
      .attr("y", opts.baseY + 42)
      .attr("text-anchor", "middle")
      .text(opts.axisLabel || "Sample mean");

    function update(records, drawCount, model, settings) {
      const state = settings || {};
      const visible = records.slice(0, drawCount);
      const binPx = Math.abs(x(model.mean + state.binWidth) - x(model.mean));
      // Square cells on a 1:1 scale, matching graph-generator.js block
      // histograms: each block is one bin wide by one count tall, in equal
      // pixels, so they tile edge to edge with no gaps. The caller sizes the
      // shared x-scale so the tallest stack still fits this band (see
      // makeSamplingPathway), which is why no vertical clamp is needed here.
      // opts.blockGap adds a hairline gap between cells (0 = touching).
      const blockGap = Number.isFinite(opts.blockGap) ? opts.blockGap : 0;
      // Pixels per one count of height. Defaults to one x-unit (square cells);
      // the caller can pass a smaller unitHeight to keep tall stacks inside a
      // fixed band when the dots have been sized up to fill the width instead.
      const unitPx = Number.isFinite(state.unitHeight)
        ? state.unitHeight
        : binPx / Math.max(1e-6, state.binWidth);
      const pitch = unitPx;
      const cellW = Math.max(1, binPx - blockGap);
      const cellH = Math.max(1, unitPx - blockGap);
      note.text(state.note || `${drawCount} of ${records.length} sample means`);
      muLine.attr("x1", x(model.mean)).attr("x2", x(model.mean));
      let enteredBlocks = null;
      const blocks = blocksLayer.selectAll("rect")
        .data(visible, (item) => item.index)
        .join(
          (enter) => {
            enteredBlocks = enter.append("rect")
              .attr("class", "bcs-block sfs-graph-block")
              .attr("width", cellW).attr("height", cellH);
            return enteredBlocks;
          },
          (updateSelection) => updateSelection,
          (exit) => exit.remove()
        )
        .attr("width", cellW).attr("height", cellH)
        .classed("is-current", (item) => state.highlightCurrent !== false && item.index === drawCount - 1);
      const blockX = (item) => x(item.bin) - cellW / 2;
      const blockY = (item) => opts.baseY - item.stackIndex * pitch - cellH;
      const shouldFall = Boolean(
        state.animate && state.fall && !reducedMotion() && visible.length && enteredBlocks
      );
      const settle = (selection) => selection
        .each(function() { this.__bcsInFlight = false; })
        .interrupt()
        .classed("is-in-flight", false)
        .style("opacity", null)
        .attr("x", blockX)
        .attr("y", blockY);
      // A block is only ever non-in-flight once it has already landed and
      // settled itself (via its own transition-end handler), so during a
      // cascade the prior blocks are already in place — no need to re-settle
      // every one of them on every frame (nor even compute the set). Non-cascade
      // renders (jumps, step-backs and the play-loop's final settle) still
      // re-place all existing blocks.
      if (!state.cascade) {
        const enteredNodes = new Set(enteredBlocks ? enteredBlocks.nodes() : []);
        const existingBlocks = blocks.filter(function() { return !enteredNodes.has(this); });
        settle(existingBlocks);
      }
      if (enteredBlocks) {
        const newest = enteredBlocks.filter((item) => item.index === drawCount - 1);
        const otherEntered = enteredBlocks.filter((item) => item.index !== drawCount - 1);
        settle(otherEntered);
        if (shouldFall && !newest.empty()) {
          const revealTransition = newest
            .each(function() { this.__bcsInFlight = true; })
            .classed("is-in-flight", true)
            .style("opacity", 0)
            .attr("x", (item) => x(item.mean) - cellW / 2)
            .attr("y", state.fallFromY)
            .transition()
            .delay(state.fallDelay ?? 840)
            .duration(1)
            .style("opacity", 1);
          revealTransition.transition()
            // Duration comes from the fall distance so every box shares one
            // constant gravity (see fallDurationForDistance), independent of how
            // fast samples are cycling. easeQuadIn gives the accelerating drop
            // and a dead stop on landing (no bounce).
            .duration((item) => fallDurationForDistance(blockY(item) - state.fallFromY))
            .ease(d3.easeQuadIn)
            .attr("x", blockX)
            .attr("y", blockY)
            .on("end.bcs-flight", function() {
              this.__bcsInFlight = false;
              d3.select(this)
                .classed("is-in-flight", false)
                .style("opacity", null);
            });
        } else {
          settle(newest);
        }
      }
      const generator = d3.axisBottom(x).tickSizeOuter(0);
      if (state.tickValues) generator.tickValues(state.tickValues);
      if (state.tickFormat) generator.tickFormat(state.tickFormat);
      axis.call(generator);
      axis.selectAll("text").attr("dy", "1em");
      axis.attr("display", state.showAxis === false ? "none" : null);
      axisLabel.attr("display", state.showAxis === false || opts.showAxisLabel === false ? "none" : null);
    }

    return { layer, update };
  }

  function createDenseHistogram(svg, options) {
    const opts = options || {};
    const layer = svg.append("g").attr("class", "bcs-dense-histogram-layer sfs-if-reveal");
    layer.append("text")
      .attr("class", "bcs-panel-label")
      .attr("x", opts.plotLeft).attr("y", opts.labelY)
      .text(opts.label || "Distribution of sample means");
    const note = layer.append("text")
      .attr("class", "bcs-panel-note")
      .attr("x", opts.plotLeft).attr("y", opts.noteY);
    const scaleTag = layer.append("text")
      .attr("class", "bcs-scale-tag")
      .attr("x", opts.plotRight).attr("y", opts.noteY)
      .attr("text-anchor", "end");
    const barsLayer = layer.append("g");
    const muLine = layer.append("line")
      .attr("class", "bcs-mu-line")
      .attr("y1", opts.topY).attr("y2", opts.baseY + 5);
    const reference = layer.append("path").attr("class", "bcs-reference-line");
    const referenceLabel = layer.append("text")
      .attr("class", "bcs-reference-label")
      .text("Predicted normal");
    const axis = layer.append("g")
      .attr("class", "bcs-axis sfs-axis")
      .attr("transform", `translate(0,${opts.baseY})`);
    const y = d3.scaleLinear().range([opts.baseY, opts.topY]);
    const normalData = d3.range(241).map((index) => {
      const z = -3 + index * 6 / 240;
      return { z, density: global.sfsStats.normalPdf(z, 0, 1) };
    });
    let normalWasVisible = false;

    function updateNote(lines) {
      const values = Array.isArray(lines) && lines.length
        ? lines
        : [String(lines || "")];
      note.selectAll("tspan")
        .data(values)
        .join("tspan")
        .attr("x", opts.plotLeft)
        .attr("dy", (item, index) => index === 0 ? 0 : "1.2em")
        .text((item) => item);
      note.attr("aria-label", values.join(". "));
    }

    function relayout(settings) {
      const state = settings || {};
      ["labelY", "noteY", "topY", "baseY"].forEach((key) => {
        if (Number.isFinite(Number(state[key]))) opts[key] = Number(state[key]);
      });
      layer.select(".bcs-panel-label").attr("y", opts.labelY);
      note.attr("y", opts.noteY);
      scaleTag.attr("y", opts.noteY);
      muLine.attr("y1", opts.topY).attr("y2", opts.baseY + 5);
      axis.attr("transform", `translate(0,${opts.baseY})`);
      y.range([opts.baseY, opts.topY]);
    }

    function update(histogramData, settings) {
      const state = settings || {};
      const standardized = state.scaleMode === "se";
      const x = standardized ? state.xSE : state.xRaw;
      const mapX = standardized
        ? (z) => x(z)
        : (z) => x(state.mean + z * state.standardError);
      const highest = Number.isFinite(state.maxDensity)
        ? state.maxDensity
        : d3.max(histogramData, (item) => item.density) || 0.45;
      y.domain([0, Math.max(0.45, highest * 1.08)]);
      updateNote(state.noteLines || state.note ||
        `${d3.format(",")(state.total || 0)} simulated means`);
      scaleTag
        .attr("display", state.compact ? "none" : null)
        .text(standardized ? "Standard-error scale" : "Same score scale");
      muLine.attr("x1", standardized ? state.xSE(0) : state.xRaw(state.mean))
        .attr("x2", standardized ? state.xSE(0) : state.xRaw(state.mean));
      const bars = barsLayer.selectAll("rect")
        .data(histogramData, (item) => item.index)
        .join(
          (enter) => enter.append("rect")
            .attr("class", "bcs-histogram-bar sfs-graph-bar")
            .attr("y", opts.baseY).attr("height", 0),
          (updateSelection) => updateSelection,
          (exit) => exit.remove()
        )
        .interrupt();
      const target = state.animate && !reducedMotion()
        ? bars.transition().duration(state.scaleChanged ? 850 : 420).ease(d3.easeCubicInOut)
        : bars;
      target
        .attr("x", (item) => mapX(item.z0))
        .attr("width", (item) => Math.max(0.7, mapX(item.z1) - mapX(item.z0) - 0.25))
        .attr("y", (item) => y(item.density))
        .attr("height", (item) => opts.baseY - y(item.density));

      const line = d3.line()
        .x((item) => mapX(item.z))
        .y((item) => y(item.density))
        .curve(d3.curveMonotoneX);
      const showNormal = Boolean(state.showNormal);
      reference.interrupt().attr("d", line(normalData));
      referenceLabel.interrupt()
        .attr("text-anchor", state.compact ? "end" : "start")
        .attr("x", state.compact ? opts.plotRight - 2 : mapX(1.55))
        .attr("y", y(global.sfsStats.normalPdf(1.55, 0, 1)) - 8);
      if (showNormal && state.animateNormal && !normalWasVisible && !reducedMotion()) {
        reference.attr("display", null).style("opacity", 0)
          .transition().duration(520).ease(d3.easeCubicOut)
          .style("opacity", 1);
        referenceLabel.attr("display", null).style("opacity", 0)
          .transition().duration(520).ease(d3.easeCubicOut)
          .style("opacity", 1);
      } else {
        reference.attr("display", showNormal ? null : "none")
          .style("opacity", showNormal ? 1 : null);
        referenceLabel.attr("display", showNormal ? null : "none")
          .style("opacity", showNormal ? 1 : null);
      }
      normalWasVisible = showNormal;

      const generator = standardized
        ? d3.axisBottom(state.xSE)
          .tickValues([-3, -2, -1, 0, 1, 2, 3])
          .tickFormat((value) => value === 0 ? "μ" :
            `${value > 0 ? "+" : "−"}${Math.abs(value)}${state.compact ? "" : " SE"}`)
        : d3.axisBottom(state.xRaw).ticks(state.compact ? 5 : 7);
      generator.tickSizeOuter(0);
      if (state.animate && state.scaleChanged && !reducedMotion()) {
        axis.transition().duration(850).ease(d3.easeCubicInOut).call(generator);
      } else {
        axis.call(generator);
      }
      axis.selectAll("text").attr("dy", "1em");
    }

    return { layer, relayout, update };
  }

  ensureStyles();
  global.sfsSamplingVisuals = Object.freeze({
    colorForProbability,
    colorForIndex,
    createBlockHistogram,
    createDenseHistogram,
    createPopulationPlot,
    createSamplePlot,
    ensureStyles,
    fallDurationForDistance,
    packedMarkerLayout,
    palette,
    reducedMotion,
    resolveIndividualPalette
  });
}(window));
