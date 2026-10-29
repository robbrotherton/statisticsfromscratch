(function() {
  "use strict";

  const STAGES = ["populations", "total", "within", "between", "compare"];
  const PHASES = ["observe", "deviations", "squares", "sum"];
  const COMPARE_PHASES = ["partition", "split", "ms-between", "ms-within", "f"];
  const DEFAULT_GROUPS = [
    { name: "Group A", values: [3, 5, 6, 7, 9] },
    { name: "Group B", values: [7, 9, 10, 11, 13] },
    { name: "Group C", values: [10, 12, 13, 14, 16] }
  ];

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function bool(value, fallback) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "string") {
      const key = value.trim().toLowerCase();
      if (["false", "0", "no", "off", "hide"].includes(key)) return false;
      if (["true", "1", "yes", "on", "show"].includes(key)) return true;
    }
    return Boolean(value);
  }

  function normalizeStage(value) {
    const key = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
    const aliases = { scores: "populations", population: "populations", groups: "populations", f: "compare", ratio: "compare" };
    const normalized = aliases[key] || key;
    return STAGES.includes(normalized) ? normalized : "populations";
  }

  function defaultPhaseForStage(stage) {
    if (stage === "populations") return "observe";
    if (stage === "compare") return "partition";
    return "sum";
  }

  function normalizePhase(value, fallback) {
    const key = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
    const aliases = {
      data: "observe",
      points: "observe",
      means: "observe",
      lines: "deviations",
      deviation: "deviations",
      square: "squares",
      squared: "squares",
      aggregate: "sum",
      summed: "sum",
      compare: "partition",
      separate: "split",
      "ms-b": "ms-between",
      "ms-w": "ms-within",
      ratio: "f",
      "f-ratio": "f"
    };
    const normalized = aliases[key] || key;
    return PHASES.includes(normalized) || COMPARE_PHASES.includes(normalized) ? normalized : fallback;
  }

  // The compare stage has its own phases; the other stages use PHASES.
  function phaseForStage(stage, phase) {
    const valid = stage === "compare" ? COMPARE_PHASES : PHASES;
    return valid.includes(phase) ? phase : defaultPhaseForStage(stage);
  }

  function prefersReducedMotion() {
    return window.interactiveRuntime && window.interactiveRuntime.motion
      ? window.interactiveRuntime.motion.isReduced()
      : Boolean(window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function ensureStyles() {
    if (document.getElementById("anova-variability-explorer-styles")) return;
    const style = document.createElement("style");
    style.id = "anova-variability-explorer-styles";
    style.textContent = `
      .anova-variability-explorer {
        --ave-total: var(--sfs-muted, #68727d);
        --ave-within: var(--sfs-current-color, #d1495b);
        --ave-between: var(--sfs-effect-color, #7654b5);
        width: 100%;
        max-width: var(--ave-max-width, 58rem);
        margin: 0 auto 0.75rem;
        color: var(--sfs-text, currentColor);
      }
      .anova-variability-explorer .ave-svg {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
      }
      .anova-variability-explorer .ave-axis path,
      .anova-variability-explorer .ave-axis line {
        stroke: var(--sfs-border, #c8cdd2);
      }
      .anova-variability-explorer .ave-axis text,
      .anova-variability-explorer .ave-muted {
        fill: var(--sfs-muted, #68727d);
      }
      .anova-variability-explorer .ave-axis text { font-size: var(--sfs-figure-tick-size, 0.8125rem); }
      .anova-variability-explorer .ave-axis .ave-axis-label { fill: currentColor; font-size: var(--sfs-figure-label-size, 0.875rem); }
      .anova-variability-explorer .ave-lane {
        stroke: color-mix(in srgb, var(--sfs-border, #c8cdd2) 70%, transparent);
        stroke-width: 1;
      }
      .anova-variability-explorer .ave-pop-area { opacity: 0.1; }
      .anova-variability-explorer .ave-pop-line { fill: none; stroke-width: 2.2; opacity: 0.75; }
      .anova-variability-explorer .ave-group-label { font-size: var(--sfs-figure-label-size, 0.875rem); font-weight: 700; }
      .anova-variability-explorer .ave-dot {
        stroke: var(--bs-body-bg, #fff);
        stroke-width: 2;
      }
      .anova-variability-explorer .ave-mean-line { stroke-width: 2.5; stroke-dasharray: 5 4; }
      .anova-variability-explorer .ave-grand-line { stroke: var(--ave-total); stroke-width: 2.5; stroke-dasharray: 8 5; }
      .anova-variability-explorer .ave-mean-label { font-size: var(--sfs-figure-small-size, 0.75rem); font-weight: 650; }
      .anova-variability-explorer .ave-transfer-layer {
        pointer-events: none;
      }
      .anova-variability-explorer .ave-panel {
        fill: color-mix(in srgb, var(--sfs-control-bg, #f1f3f5) 62%, transparent);
        stroke: var(--sfs-border, #c8cdd2);
      }
      .anova-variability-explorer .ave-panel-title { fill: currentColor; font-size: var(--sfs-figure-title-size, 1rem); font-weight: 750; }
      .anova-variability-explorer .ave-panel-subtitle { font-size: var(--sfs-figure-small-size, 0.75rem); fill: var(--sfs-muted, #68727d); }
      .anova-variability-explorer .ave-square { stroke-width: 1.25; }
      .anova-variability-explorer .ave-ss-label { font-size: var(--sfs-figure-label-size, 0.875rem); font-weight: 720; }
      .anova-variability-explorer .ave-ss-value { font-size: var(--sfs-figure-small-size, 0.75rem); fill: var(--sfs-muted, #68727d); }
      .anova-variability-explorer .ave-equation { fill: currentColor; font-size: var(--sfs-figure-title-size, 1rem); font-weight: 700; }
      .anova-variability-explorer .ave-calculation-box {
        margin-top: 0.45rem;
        padding: 0.65rem 0.8rem;
        border: 1px solid var(--sfs-border, #c8cdd2);
        border-radius: 0.45rem;
        background: color-mix(in srgb, var(--sfs-control-bg, #f1f3f5) 55%, transparent);
        font-variant-numeric: tabular-nums;
        font-size: 0.9rem;
      }
      .anova-variability-explorer .ave-calculation-box[hidden] { display: none !important; }
      .anova-variability-explorer .ave-calc-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.35rem 1rem;
      }
      .anova-variability-explorer .ave-calc-grid span { white-space: nowrap; }
      .anova-variability-explorer .ave-controls { align-items: center; }
      .anova-variability-explorer .ave-control-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
        cursor: pointer;
      }
      @media (max-width: 680px) {
        .anova-variability-explorer .ave-calc-grid { grid-template-columns: 1fr; }
      }
      @media (prefers-reduced-motion: reduce) {
        .anova-variability-explorer * { transition: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function compute(groups) {
    const observations = [];
    groups.forEach((group, groupIndex) => {
      group.values.forEach((value, index) => observations.push({ groupIndex, index, value }));
    });
    const N = observations.length;
    const means = groups.map((group) => d3.mean(group.values));
    const grandMean = d3.mean(observations, (d) => d.value);
    const ssTotal = d3.sum(observations, (d) => Math.pow(d.value - grandMean, 2));
    const ssWithin = d3.sum(observations, (d) => Math.pow(d.value - means[d.groupIndex], 2));
    const ssBetween = d3.sum(groups, (group, i) => group.values.length * Math.pow(means[i] - grandMean, 2));
    const dfBetween = groups.length - 1;
    const dfWithin = N - groups.length;
    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;
    return { observations, N, means, grandMean, ssTotal, ssWithin, ssBetween, dfBetween, dfWithin, msBetween, msWithin, f: msBetween / msWithin };
  }

  window.makeAnovaVariabilityExplorer = function(opts) {
    opts = opts || {};
    ensureStyles();
    const squares = window.sfsAnovaSquares;
    squares.ensureStyles();
    if (window.interactiveFigure) window.interactiveFigure.ensureStyles();

    const sortValues = bool(opts.sort, true);
    // Without the scores the figure is only the comparison, sized for that alone, so it
    // never leaves the compare stage.
    const showScores = bool(opts.scores, true);
    const groups = (Array.isArray(opts.groups) && opts.groups.length >= 2 ? opts.groups : DEFAULT_GROUPS)
      .map((group, index) => {
        const values = (Array.isArray(group.values) ? group.values : []).map(Number).filter(Number.isFinite);
        // Sorted values stack each lane's dots top to bottom in x order.
        return {
          name: String(group.name || group.label || `Group ${index + 1}`),
          values: sortValues ? values.sort((a, b) => a - b) : values
        };
      })
      .filter((group) => group.values.length);
    const stats = compute(groups);
    const colors = [
      "var(--graph-series-1, #0072b2)",
      "var(--graph-series-2, #e69f00)",
      "var(--graph-series-3, #009e73)",
      "var(--graph-series-4, #d55e00)"
    ];
    const rawMin = d3.min(stats.observations, (d) => d.value);
    const rawMax = d3.max(stats.observations, (d) => d.value);
    const xMin = finite(opts.xMin, Math.floor(rawMin - 2));
    const xMax = finite(opts.xMax, Math.ceil(rawMax + 2));
    const x = d3.scaleLinear().domain([xMin, xMax]);
    const groupY = d3.scalePoint().domain(d3.range(groups.length));

    // Geometry is computed from the width the figure is drawn at, so text keeps its
    // real size on phones instead of shrinking with a fixed viewBox. Below
    // COMPACT_BELOW the sums panel moves under the dot plot.
    const COMPACT_BELOW = 700;
    const longestName = d3.max(groups, (group) => group.name.length) || 6;
    let width;
    let height;
    let compact;
    let plot;
    let panel;
    // Lane furniture: population curve height and baseline, mean-line half-length,
    // and offsets for the mean label, the group name and the axis label.
    let lane;
    // Where the total sum of squares sits: in the sums panel, or in the middle of the
    // figure once the dot plot gives way to the comparison.
    let panelSquare;
    let wideSquare;
    // The compare stage hangs from one line: the boundary between the two layers of the
    // total. Between stands above it and within hangs below, across a small gap, from the
    // partition through to F, where the gap becomes the fraction bar.
    let midline;
    let midGap;

    function computeLayout(availableWidth) {
      width = Math.round(availableWidth);
      compact = width < COMPACT_BELOW;
      if (compact) {
        // The whole tutorial callout has to fit on a phone screen, so everything is
        // packed tighter: group names sit above their lanes, two lanes sit closer
        // than three, and the sums panel's heading runs above a centred bucket.
        const laneTop = 68;
        const laneBottom = laneTop + (groups.length === 2 ? 128 : 150);
        plot = { left: 16, right: width - 16, top: 34, bottom: laneBottom + 40 };
        groupY.range([laneTop, laneBottom]);
        lane = { curve: 34, base: 28, meanHalf: 27, meanLabel: 33, name: -34, axisLabel: 36 };
        const panelSide = Math.min(136, width - 64);
        panel = { x: 8, y: plot.bottom + 48, width: width - 16, height: 74 + panelSide + 14 };
        panelSquare = { x: (width - panelSide) / 2, y: panel.y + 74, side: panelSide };
        height = panel.y + panel.height + 8;
      } else {
        plot = { left: 16 + longestName * 8.6 + 12, right: width - 320, top: 76, bottom: 610 };
        groupY.range([150, 540]);
        lane = { curve: 49, base: 38, meanHalf: 35, meanLabel: 43, name: 5, axisLabel: 42 };
        panel = { x: width - 285, y: 66, width: 255, height: 540 };
        panelSquare = { x: panel.x + 22, y: panel.y + 150, side: 210 };
        height = 720;
      }
      // Compare stage: everything centred on one column. The total is sized so that, once
      // split and cut, between above the line and within below it fit with their labels,
      // leaving room either side for the "÷ df" label and F's "= 9.91", and to the left of
      // the total for its label. Without the scores, the figure is only as tall as this.
      const margin = compact ? 16 : 40;
      const cutLabelRoom = compact ? 54 : 64;
      const totalLabelRoom = 26;
      const labelRoom = 46;
      midGap = compact ? 10 : 14;
      const parts = aggregateSquares().filter((d) => d.df);
      const relative = (d) => Math.sqrt(d.value / stats.ssTotal);
      const reach = (d, side) => Math.max(relative(d) * side, cutPieces(d, relative(d) * side).height);
      const widest = (side) => d3.max(parts, (d) => cutPieces(d, relative(d) * side).width);
      const extent = (side) => d3.sum(parts, (d) => reach(d, side)) + 2 * midGap + 2 * labelRoom;
      const fits = (side) => widest(side) <= width - 2 * (margin + cutLabelRoom) &&
        side <= width - 2 * (margin + totalLabelRoom) &&
        (!showScores || extent(side) <= height - 2 * margin);
      let side = compact ? 240 : 320;
      while (side > 60 && !fits(side)) side -= 2;
      if (!showScores) height = Math.ceil(extent(side) + (compact ? 16 : 24));
      const between = parts.find((d) => d.key === "between");
      midline = (height - extent(side)) / 2 + labelRoom + reach(between, side) + midGap;
      // The total's between layer sits directly on the line, its within layer directly under it.
      wideSquare = { x: (width - side) / 2, y: midline - side * between.value / stats.ssTotal, side };
      x.range([plot.left, plot.right]);
    }

    function stageFor(value) {
      return showScores ? normalizeStage(value) : "compare";
    }

    const initialStage = stageFor(opts.stage);
    const state = {
      stage: initialStage,
      phase: phaseForStage(initialStage, normalizePhase(opts.phase, defaultPhaseForStage(initialStage))),
      calculations: bool(opts.calculations, false)
    };

    const root = d3.create("div")
      .attr("class", "anova-variability-explorer sfs-figure")
      .style("--ave-max-width", opts.maxWidth || null);
    const rootNode = root.node();
    const controls = root.append("div").attr("class", "ave-controls");
    const controlLabel = controls.append("label").attr("class", "ave-control-label");
    const calculationsToggle = controlLabel.append("input")
      .attr("type", "checkbox")
      .property("checked", state.calculations);
    controlLabel.append("span").text("Show calculations");

    const svg = root.append("svg")
      .attr("class", "ave-svg")
      .attr("role", "img");
    svg.append("title").attr("class", "ave-title");

    // Everything about the scores themselves, faded out for the mean-square steps.
    const plotGroup = svg.append("g").attr("class", "ave-plot");
    const axis = plotGroup.append("g").attr("class", "ave-axis");
    const axisLabel = axis.append("text")
      .attr("class", "ave-axis-label")
      .attr("text-anchor", "middle")
      .text(opts.axisLabel || "Score");

    const populationsLayer = plotGroup.append("g").attr("class", "ave-populations");
    const lanesLayer = plotGroup.append("g").attr("class", "ave-lanes");
    const deviationLayer = plotGroup.append("g").attr("class", "ave-deviations");
    const meansLayer = plotGroup.append("g").attr("class", "ave-means");
    const ghostsLayer = plotGroup.append("g").attr("class", "ave-ghosts");
    const dotsLayer = plotGroup.append("g").attr("class", "ave-dots");

    const panelGroup = svg.append("g").attr("class", "ave-squares-panel");
    const panelRect = panelGroup.append("rect")
      .attr("class", "ave-panel")
      .attr("rx", 10).attr("ry", 10);
    const heading = panelGroup.append("g").attr("class", "ave-panel-heading");
    const headingTitle = heading.append("text").attr("class", "ave-panel-title");
    const headingSubtitle = heading.append("text").attr("class", "ave-panel-subtitle");
    const squaresLayer = panelGroup.append("g").attr("class", "ave-squares");
    const msLayer = svg.append("g").attr("class", "ave-mean-squares");
    const labelsLayer = svg.append("g").attr("class", "ave-labels");
    const fractionLayer = svg.append("g").attr("class", "ave-fraction");
    const fractionBar = fractionLayer.append("line")
      .attr("stroke", "currentColor").attr("stroke-width", 2.5).attr("stroke-linecap", "round")
      .style("opacity", 0);
    const fractionLeft = fractionLayer.append("text").attr("class", "ave-equation").attr("text-anchor", "end").style("opacity", 0);
    const fractionRight = fractionLayer.append("text").attr("class", "ave-equation").attr("text-anchor", "start").style("opacity", 0);
    const transferLayer = svg.append("g").attr("class", "ave-transfer-layer");

    const calculationBox = root.append("div")
      .attr("class", "ave-calculation-box")
      .attr("aria-live", "polite")
      .attr("hidden", state.calculations ? null : true);

    // Greedy word wrap to a character budget; the heading is short enough not to need measuring.
    function wrapWords(text, maxChars) {
      const lines = [];
      String(text).split(/\s+/).forEach((word) => {
        const last = lines[lines.length - 1];
        if (last && (last + " " + word).length <= maxChars) lines[lines.length - 1] = last + " " + word;
        else lines.push(word);
      });
      return lines;
    }

    function setLines(textSelection, lines, lineHeight) {
      textSelection.selectAll("tspan")
        .data(lines)
        .join("tspan")
        .attr("x", 0)
        .attr("dy", (d, i) => i ? lineHeight : 0)
        .text((d) => d);
      return lines.length;
    }

    // The parts of the figure that only change with its width.
    function applyLayout() {
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      const tickCount = Math.max(3, Math.floor((plot.right - plot.left) / 60));
      axis.attr("transform", `translate(0,${plot.bottom})`)
        .call(d3.axisBottom(x).ticks(tickCount).tickSizeOuter(0));
      axisLabel.attr("x", (plot.left + plot.right) / 2).attr("y", lane.axisLabel);
      panelRect
        .attr("x", panel.x).attr("y", panel.y)
        .attr("width", panel.width).attr("height", panel.height);
    }

    // Thousands separators, and no trailing zeros: 14,450, 1,458.3, 9.91.
    function fmt(value, decimals) {
      const text = d3.format(`,.${decimals === undefined ? 2 : decimals}f`)(value);
      return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
    }

    // In the compare stage the figure labels its own shapes, and the box would give away
    // the mean squares and F before the steps reach them.
    function updateCalculationBox() {
      const show = state.calculations && state.stage !== "compare";
      calculationBox.attr("hidden", show ? null : true);
      if (!show) return;
      calculationBox.html(`
        <div class="ave-calc-grid">
          <span><strong>SS<sub>total</sub></strong> = ${fmt(stats.ssTotal)}</span>
          <span><strong>SS<sub>within</sub></strong> = ${fmt(stats.ssWithin)}</span>
          <span><strong>SS<sub>between</sub></strong> = ${fmt(stats.ssBetween)}</span>
          <span><strong>MS<sub>between</sub></strong> = ${fmt(stats.ssBetween)} / ${stats.dfBetween} = ${fmt(stats.msBetween, 1)}</span>
          <span><strong>MS<sub>within</sub></strong> = ${fmt(stats.ssWithin)} / ${stats.dfWithin} = ${fmt(stats.msWithin, 1)}</span>
          <span><strong>F</strong> = ${fmt(stats.msBetween, 1)} / ${fmt(stats.msWithin, 1)} = ${fmt(stats.f)}</span>
        </div>
      `);
    }

    function densityPoints(mean, sd, yBase) {
      const points = d3.range(xMin, xMax + 0.05, 0.1).map((value) => {
        const density = Math.exp(-0.5 * Math.pow((value - mean) / sd, 2));
        return { x: x(value), y: yBase - density * lane.curve };
      });
      return points;
    }

    function renderPopulations(visible, animate) {
      const sd = finite(opts.populationSd, 2.15);
      const curves = populationsLayer.selectAll("g.ave-population")
        .data(groups, (d, i) => i)
        .join((enter) => {
          const group = enter.append("g").attr("class", "ave-population");
          group.append("path").attr("class", "ave-pop-area");
          group.append("path").attr("class", "ave-pop-line");
          return group;
        });
      const line = d3.line().x((d) => d.x).y((d) => d.y).curve(d3.curveBasis);
      const area = d3.area().x((d) => d.x).y0((d, i, data) => data[0].base).y1((d) => d.y).curve(d3.curveBasis);
      curves.each(function(group, i) {
        const data = densityPoints(stats.means[i], sd, groupY(i) + lane.base);
        data.forEach((d) => { d.base = groupY(i) + lane.base; });
        const selection = d3.select(this);
        const curveColor = state.stage === "total" ? "var(--ave-total)" : colors[i % colors.length];
        selection.select(".ave-pop-area").attr("d", area(data)).attr("fill", curveColor);
        selection.select(".ave-pop-line").attr("d", line(data)).attr("stroke", curveColor);
      });
      curves.interrupt().transition().duration(animate ? 420 : 0)
        .style("opacity", visible ? 1 : state.stage === "total" ? 0.1 : 0.07);
    }

    function targetY(d) {
      return groupY(d.groupIndex) + squares.laneOffset(d.index, groups[d.groupIndex].values.length);
    }

    function renderLanes(animate) {
      const deemphasizeGroups = state.stage === "total";
      const laneData = d3.range(groups.length);
      const lanes = lanesLayer.selectAll("line.ave-lane").data(laneData, String);
      lanes.join("line")
        .attr("class", "ave-lane")
        .attr("x1", plot.left).attr("x2", plot.right)
        .transition().duration(animate ? 520 : 0)
        .attr("y1", (d) => groupY(d))
        .attr("y2", (d) => groupY(d))
        .style("opacity", deemphasizeGroups ? 0.42 : 1);
      lanes.exit().remove();

      const labels = lanesLayer.selectAll("text.ave-group-label")
        .data(deemphasizeGroups ? [] : groups, (d) => d.name);
      labels.join("text")
        .attr("class", "ave-group-label")
        // On a phone the names sit above the lanes' left ends, clear of the squares that
        // grow up from the lane below.
        .attr("x", compact ? plot.left : plot.left - 12)
        .attr("text-anchor", compact ? "start" : "end")
        .attr("fill", (d, i) => colors[i % colors.length])
        .text((d) => d.name)
        // Lanes never move between steps, so a returning label is placed, not slid in.
        .attr("y", (d, i) => groupY(i) + lane.name);
      labels.exit().remove();
    }

    // For between-groups variability, every score is replaced by its group mean.
    function dotX(d) {
      return state.stage === "between" ? x(stats.means[d.groupIndex]) : x(d.value);
    }

    function renderGhosts(animate) {
      const items = state.stage !== "between" ? [] : stats.observations.map((d) => ({
        key: `${d.groupIndex}-${d.index}`,
        x: x(d.value),
        y: targetY(d),
        color: colors[d.groupIndex % colors.length]
      }));
      squares.renderGhosts(ghostsLayer, items, { animate });
    }

    function renderDots(animate) {
      dotsLayer.selectAll("circle.ave-dot")
        .data(stats.observations, (d) => `${d.groupIndex}-${d.index}`)
        .join("circle")
        .attr("class", "ave-dot")
        .attr("r", 6)
        .attr("fill", (d) => state.stage === "total"
          ? "var(--ave-total)"
          : colors[d.groupIndex % colors.length])
        .transition().duration(animate ? 560 : 0).ease(d3.easeCubicInOut)
        .attr("cx", dotX)
        .attr("cy", targetY);
    }

    function deviationData() {
      if (state.stage === "total") {
        return stats.observations.map((d) => ({ ...d, from: d.value, to: stats.grandMean, y: targetY(d), color: "var(--ave-total)" }));
      }
      if (state.stage === "within") {
        return stats.observations.map((d) => ({
          ...d,
          from: d.value,
          to: stats.means[d.groupIndex],
          y: targetY(d),
          color: colors[d.groupIndex % colors.length]
        }));
      }
      if (state.stage === "between") {
        // One deviation per group: every score now sits on its group mean and shares it.
        return groups.map((group, i) => ({ groupIndex: i, index: 0, from: stats.means[i], to: stats.grandMean, y: groupY(i), color: "var(--ave-between)", weight: group.values.length }));
      }
      return [];
    }

    function deviationSquareGeometry(d) {
      return squares.deviationSquare(x(d.from), x(d.to), d.y, d.groupIndex, groups.length, d.index);
    }

    function phaseIndex() {
      if (state.phase === "compare") return PHASES.length;
      return Math.max(0, PHASES.indexOf(state.phase));
    }

    function renderDeviations(animate, transitions) {
      transitions = transitions || {};
      const showLines = ["total", "within", "between"].includes(state.stage) && phaseIndex() >= 1;
      const items = (showLines ? deviationData() : []).map((d) => ({
        key: `${d.groupIndex}-${d.index}`,
        x1: x(d.from),
        x2: x(d.to),
        y: d.y,
        color: d.color,
        square: deviationSquareGeometry(d)
      }));
      squares.renderDeviations(deviationLayer, items, {
        animate,
        squares: showLines && phaseIndex() >= 2,
        drawLines: transitions.drawLines,
        growSquares: transitions.growSquares
      });
    }

    function renderMeans(animate) {
      const showGroupMeans = ["within", "between", "compare", "populations"].includes(state.stage);
      const showGrand = ["total", "between", "compare"].includes(state.stage);
      const meanData = showGroupMeans ? stats.means.map((mean, i) => ({ mean, i })) : [];
      const means = meansLayer.selectAll("g.ave-group-mean").data(meanData, (d) => d.i);
      const meanEnter = means.enter().append("g").attr("class", "ave-group-mean").style("opacity", 0);
      meanEnter.append("line").attr("class", "ave-mean-line");
      meanEnter.append("text").attr("class", "ave-mean-label").attr("text-anchor", "middle");
      const meanMerged = meanEnter.merge(means);
      meanMerged.select("line")
        .attr("stroke", (d) => colors[d.i % colors.length])
        .attr("x1", (d) => x(d.mean)).attr("x2", (d) => x(d.mean))
        .attr("y1", (d) => groupY(d.i) - lane.meanHalf).attr("y2", (d) => groupY(d.i) + lane.meanHalf);
      meanMerged.select("text")
        .attr("fill", (d) => colors[d.i % colors.length])
        .attr("x", (d) => x(d.mean)).attr("y", (d) => groupY(d.i) - lane.meanLabel)
        // On a phone the group names sit above the lanes, where these labels would collide with them.
        .text(compact ? "" : "group mean");
      meanMerged.transition().duration(animate ? 320 : 0).style("opacity", state.stage === "populations" ? 0.7 : 1);
      means.exit().transition().duration(animate ? 160 : 0).style("opacity", 0).remove();

      const grand = meansLayer.selectAll("g.ave-grand-mean").data(showGrand ? [stats.grandMean] : []);
      const grandEnter = grand.enter().append("g").attr("class", "ave-grand-mean").style("opacity", 0);
      grandEnter.append("line").attr("class", "ave-grand-line");
      grandEnter.append("text").attr("class", "ave-mean-label ave-muted").attr("text-anchor", "middle");
      const grandMerged = grandEnter.merge(grand);
      grandMerged.select("line")
        .attr("x1", x(stats.grandMean)).attr("x2", x(stats.grandMean))
        .attr("y1", plot.top)
        .attr("y2", plot.bottom);
      grandMerged.select("text")
        .attr("x", x(stats.grandMean)).attr("y", plot.top - 10)
        .text("grand mean");
      grandMerged.transition().duration(animate ? 320 : 0).style("opacity", 1);
      grand.exit().transition().duration(animate ? 160 : 0).style("opacity", 0).remove();
    }

    // Within pours in first and settles at the bottom; between fills the rest of the total.
    function aggregateSquares() {
      return [
        { key: "total", label: "Total", value: stats.ssTotal, base: 0, color: "var(--ave-total)", reveal: 1 },
        { key: "between", label: "Between", value: stats.ssBetween, base: stats.ssWithin, color: "var(--ave-between)", reveal: 3, df: stats.dfBetween, ms: stats.msBetween, msPhase: 2 },
        { key: "within", label: "Within", value: stats.ssWithin, base: 0, color: "var(--ave-within)", reveal: 2, df: stats.dfWithin, ms: stats.msWithin, msPhase: 3 }
      ];
    }

    function aggregateRevealLevel() {
      const stageIndex = STAGES.indexOf(state.stage);
      if (stageIndex <= 0) return 0;
      if (stageIndex >= 4) return 3;
      const priorStages = stageIndex - 1;
      return priorStages + (state.phase === "sum" ? 1 : 0);
    }

    function comparePhaseIndex() {
      return state.stage === "compare" ? COMPARE_PHASES.indexOf(state.phase) : -1;
    }

    function wideLayout() {
      return state.stage === "compare";
    }

    function isSplit() {
      return comparePhaseIndex() >= 1;
    }

    // Between's cut pieces keep standing on the line and within's keep hanging from it.
    function cutPieces(d, side) {
      return squares.cutPieces(d.df, side, d.key === "within" ? "top" : "bottom");
    }

    function squareLayout() {
      return wideLayout() ? wideSquare : panelSquare;
    }

    // Area is the quantity throughout: a value fills value / SS total of the total square.
    function areaSide(value, layout) {
      return layout.side * Math.sqrt(Math.max(0, value) / stats.ssTotal);
    }

    // The total square is a container that each sum fills from the bottom up, like a level rising.
    function ssGeometry(d, value, layout) {
      const top = layout.y + layout.side * (1 - (d.base + value) / stats.ssTotal);
      return { x: layout.x, y: top, width: layout.side, height: layout.side * value / stats.ssTotal };
    }

    // Squares either side of the line: between stands on it, within hangs from it.
    function besideLine(d, side) {
      return {
        x: width / 2 - side / 2,
        y: d.key === "between" ? midline - midGap - side : midline + midGap,
        width: side,
        height: side
      };
    }

    // Once split, each sum of squares is drawn as a square of the same area.
    function ssSquareGeometry(d) {
      return besideLine(d, areaSide(d.value, wideSquare));
    }

    // Every sum has one label for the figure's whole life, so it can travel with its shape.
    // In the sums panel the layers are labelled inside their top-left corners and the total
    // above the container. In the comparison, between is labelled above its shape and within
    // below, like a fraction's two halves, and the total runs up its left side.
    function labelLines(d) {
      if (!wideLayout()) return { name: d.label, value: state.calculations ? `SS = ${fmt(d.value)}` : "" };
      if (d.key === "total") return { name: state.calculations ? `SS total = ${fmt(d.value)}` : "SS total", value: "" };
      if (isLifted(d)) return { name: `MS ${d.key}`, value: msDetail(d) };
      return { name: `SS ${d.key}`, value: state.calculations ? fmt(d.value) : "" };
    }

    // The edge a comparison label keeps to: the total's, then the sum's, then the mean
    // square's. While the sum is cut, `spread` gives the outer edge of its spread pieces.
    function labelEdge(d, spread) {
      const above = d.key === "between";
      if (!isSplit()) return above ? wideSquare.y : wideSquare.y + wideSquare.side;
      const sumSide = areaSide(d.value, wideSquare);
      const reach = spread ? cutPieces(d, sumSide).height : isLifted(d) ? msGeometry(d).height : sumSide;
      return above ? midline - midGap - reach : midline + midGap + reach;
    }

    function labelPlacement(d, spread) {
      const none = "translate(0,0)";
      if (!wideLayout()) {
        const layout = panelSquare;
        if (d.key === "total") {
          return {
            transform: none,
            name: { x: layout.x, y: layout.y - 10, anchor: "start" },
            value: { x: layout.x + layout.side, y: layout.y - 10, anchor: "end" }
          };
        }
        const top = ssGeometry(d, d.value, layout).y;
        return {
          transform: none,
          name: { x: layout.x + 8, y: top + 18, anchor: "start" },
          value: { x: layout.x + 8, y: top + 34, anchor: "start" }
        };
      }
      if (d.key === "total") {
        const x = wideSquare.x - 10;
        const y = wideSquare.y + wideSquare.side / 2;
        return {
          transform: `rotate(-90 ${x} ${y})`,
          name: { x, y, anchor: "middle" },
          value: { x, y, anchor: "middle" }
        };
      }
      const edge = labelEdge(d, spread);
      const cx = width / 2;
      // Lines read name then value either way; between's stack up away from its shape.
      if (d.key === "between") {
        const hasValue = Boolean(labelLines(d).value);
        return {
          transform: none,
          name: { x: cx, y: edge - (hasValue ? 28 : 10), anchor: "middle" },
          value: { x: cx, y: edge - 10, anchor: "middle" }
        };
      }
      return {
        transform: none,
        name: { x: cx, y: edge + 22, anchor: "middle" },
        value: { x: cx, y: edge + 40, anchor: "middle" }
      };
    }

    // Works on a selection or a transition; `withText` false moves a label without rewording
    // it, and `spread` places it clear of a sum's spread pieces.
    function placeLabel(target, d, withText, spread) {
      const p = labelPlacement(d, spread);
      const lines = labelLines(d);
      target.attr("transform", p.transform);
      const name = target.select(".ave-ss-label")
        .attr("x", p.name.x).attr("y", p.name.y).attr("text-anchor", p.name.anchor);
      const value = target.select(".ave-ss-value")
        .attr("x", p.value.x).attr("y", p.value.y).attr("text-anchor", p.value.anchor);
      if (withText !== false) {
        name.text(lines.name);
        value.text(lines.value);
      }
    }

    // Every sum receives one piece per score (between sends each group's square once per score).
    const pourDuration = squares.pourDuration(stats.N);

    function isLifted(d) {
      return Boolean(d.msPhase) && comparePhaseIndex() >= d.msPhase;
    }

    function setRect(selection, geometry) {
      return selection
        .attr("x", geometry.x).attr("y", geometry.y)
        .attr("width", geometry.width).attr("height", geometry.height);
    }

    function renderSquares(animate, revealKey, liftDelay, splitting) {
      const wide = wideLayout();
      const split = isSplit();
      const layout = squareLayout();
      const duration = animate ? 760 : 0;
      const stageIndex = STAGES.indexOf(state.stage);
      const subtitleText = stageIndex === 0
        ? "The squared deviations will collect here"
        : stageIndex < 4
          ? (state.phase === "sum" ? "Adding the squared deviations" : "Build each squared deviation first")
          : "Total = between + within";
      const inset = compact ? 14 : 18;
      const headingWidth = wide ? Infinity : panel.width - 2 * inset;
      const titleLines = setLines(headingTitle, wrapWords("Sums of squares", headingWidth / 9.2), 19);
      setLines(headingSubtitle, wrapWords(subtitleText, headingWidth / 6.3), 15);
      headingSubtitle.attr("y", titleLines * 19 + 1);
      // The heading belongs to the panel; in the comparison the shapes' own labels say it.
      heading.attr("transform", `translate(${panel.x + inset},${panel.y + (compact ? 24 : 27)})`)
        .interrupt().transition().duration(animate ? 300 : 0)
        .style("opacity", wide ? 0 : 1);
      panelGroup.select(".ave-panel").interrupt().transition().duration(animate ? 480 : 0)
        .style("opacity", wide ? 0 : 1);

      // Splitting is one move: the layers part at the line and square up as they go.
      const partDuration = splitting ? 420 : 0;
      const squareDuration = splitting ? 900 : duration;
      squaresLayer.selectAll("*").interrupt().interrupt("lift").interrupt("tint");
      const container = squaresLayer.selectAll("rect.ave-ss-container")
        .data(aggregateRevealLevel() >= 1 ? [layout] : []);
      container.enter().insert("rect", ":first-child")
        .attr("class", "ave-ss-container ave-square")
        .attr("fill", "none").attr("stroke", "var(--ave-total)").attr("stroke-width", 1.5)
        .attr("x", layout.x).attr("y", layout.y).attr("width", layout.side).attr("height", layout.side)
        .style("opacity", 0)
        .merge(container)
        .transition().duration(splitting ? partDuration : duration).ease(d3.easeCubicInOut)
        .attr("x", layout.x).attr("y", layout.y).attr("width", layout.side).attr("height", layout.side)
        .style("opacity", split ? 0 : 1);
      container.exit().transition().duration(animate ? 220 : 0).style("opacity", 0).remove();

      const data = aggregateSquares().filter((d) => aggregateRevealLevel() >= d.reveal);
      const items = squaresLayer.selectAll("g.ave-ss-item").data(data, (d) => d.key);
      const entered = items.enter().append("g").attr("class", "ave-ss-item");
      entered.append("rect")
        .attr("class", "ave-square")
        .attr("fill-opacity", 0.18).attr("stroke-width", 1.5)
        .each(function(d) { setRect(d3.select(this), ssGeometry(d, 0, layout)); });
      const merged = entered.merge(items);
      // The total has no square of its own once its layers have split away.
      merged.filter((d) => d.key === "total")
        .transition().duration(splitting ? partDuration : duration)
        .style("opacity", split ? 0 : 1);

      const geometry = (d) => split && d.key !== "total" ? ssSquareGeometry(d) : ssGeometry(d, d.value, layout);
      // The total is the fill itself; the container draws its outline.
      const sumRects = merged.select("rect")
        .attr("fill", (d) => d.color)
        .attr("stroke", (d) => d.key === "total" ? "none" : d.color);
      // The sum being revealed starts empty; animateContributions raises it as each piece lands.
      const driven = (d) => animate && d.key === revealKey;
      sumRects.filter(driven).each(function(d) { setRect(d3.select(this), ssGeometry(d, 0, layout)); });
      sumRects.filter((d) => !driven(d))
        .transition()
        .duration(squareDuration).ease(d3.easeCubicInOut)
        .attr("x", (d) => geometry(d).x)
        .attr("y", (d) => geometry(d).y)
        .attr("width", (d) => geometry(d).width)
        .attr("height", (d) => geometry(d).height);
      // A sum broken into its mean square fades as its pieces appear.
      sumRects.transition("lift")
        .delay(animate ? liftDelay : 0)
        .duration(animate ? 420 : 0)
        .style("opacity", (d) => isLifted(d) ? 0 : 1);
      // Once both layers fill the total, its own grey underneath would only tint them.
      sumRects.filter((d) => d.key === "total").transition("tint")
        .delay(animate && revealKey === "between" ? pourDuration : 0)
        .duration(animate ? 400 : 0)
        .attr("fill-opacity", aggregateRevealLevel() >= 3 ? 0 : 0.18);

      items.exit()
        .transition().duration(animate ? 220 : 0)
        .style("opacity", 0)
        .remove();
    }

    // Pour each squared deviation into the container: it flies to the mouth, drops to the
    // surface, and spreads flat across it as the level rises by exactly its area.
    function animateContributions(revealKey, animate) {
      transferLayer.selectAll("*").interrupt().remove();
      if (!animate || !revealKey) return;

      const target = aggregateSquares().find((d) => d.key === revealKey);
      // Each group's single between-groups square is counted once per score in the group.
      const contributions = deviationData()
        .flatMap((d) => d3.range(d.weight || 1).map((copyIndex) => ({ ...d, copyIndex })));
      const sumRect = squaresLayer.selectAll("g.ave-ss-item")
        .filter((d) => d.key === revealKey)
        .select("rect");
      if (!target || !contributions.length) return;

      const layout = panelSquare;
      squares.pour(transferLayer, {
        pieces: contributions.map((d) => {
          const value = Math.pow(d.from - d.to, 2);
          return { from: deviationSquareGeometry(d), side: areaSide(value, layout), value, color: d.color };
        }),
        color: target.color,
        level: (value) => ssGeometry(target, value, layout),
        mouth: { x: layout.x + layout.side / 2, y: layout.y },
        sumRect
      });
    }

    // Each mean square takes its sum's place by the line, so F needs no further move.
    function msGeometry(d) {
      const geometry = besideLine(d, areaSide(d.ms, wideSquare));
      return { ...geometry, side: geometry.width };
    }

    function msDetail(d) {
      return state.calculations
        ? `${fmt(d.value)} ÷ ${d.df} = ${fmt(d.ms, 1)}`
        : `SS ${d.key} ÷ ${d.df}`;
    }

    function renderMeanSquares(animate, revealKey) {
      msLayer.selectAll("*").interrupt();
      const phase = comparePhaseIndex();
      const data = aggregateSquares().filter((d) => d.msPhase && phase >= d.msPhase);
      const items = msLayer.selectAll("g.ave-ms-item").data(data, (d) => d.key);
      const entered = items.enter().append("g").attr("class", "ave-ms-item").style("opacity", 0);
      entered.append("rect").attr("class", "ave-square").attr("fill-opacity", 0.18).attr("stroke-width", 1.5);
      const merged = entered.merge(items);
      merged.select("rect")
        .attr("fill", (d) => d.color).attr("stroke", (d) => d.color)
        .each(function(d) { setRect(d3.select(this), msGeometry(d)); });
      // The square being built stays hidden until animateMeanSquare hands it over.
      merged.filter((d) => !(animate && d.key === revealKey))
        .transition().duration(animate ? 300 : 0)
        .style("opacity", 1);
      merged.filter((d) => animate && d.key === revealKey).style("opacity", 0);
      items.exit().transition().duration(animate ? 220 : 0).style("opacity", 0).remove();
    }

    // Cutting a sum of squares into its mean square, planned once so the pieces and the label
    // keep the same time. Times are absolute, from the start of the step.
    function planCut(key, delay) {
      const d = aggregateSquares().find((item) => item.key === key);
      const ss = ssSquareGeometry(d);
      const plan = squares.planCut({
        df: d.df,
        side: ss.width,
        cx: width / 2,
        cy: ss.y + ss.height / 2,
        align: d.key === "within" ? "top" : "bottom",
        target: msGeometry(d),
        delay
      });
      return { ...plan, d };
    }

    // Cut a sum of squares into df equal pieces, which part and square up in one move, then
    // stack back by the line. The pieces are all the same size, so the stack is one share:
    // the mean square.
    function animateMeanSquare(plan) {
      squares.animateCut(transferLayer, plan, {
        color: plan.d.color,
        onLanded() {
          msLayer.selectAll("g.ave-ms-item").filter((item) => item.key === plan.d.key).style("opacity", 1);
        }
      });
    }

    // Labels move with their shapes. When the layout itself changes (panel to comparison)
    // they fade out and back rather than fly across the figure, and a label whose sum is
    // being cut into its mean square rides down with the stack and rewords as it lands.
    function renderLabels(animate, moves) {
      labelsLayer.selectAll("*").interrupt().interrupt("reword");
      const data = aggregateSquares().filter((d) => aggregateRevealLevel() >= d.reveal);
      const labels = labelsLayer.selectAll("g.ave-label").data(data, (d) => d.key);
      const entered = labels.enter().append("g").attr("class", "ave-label").style("opacity", 0);
      entered.append("text").attr("class", "ave-ss-label").attr("fill", (d) => d.color);
      entered.append("text").attr("class", "ave-ss-value");
      entered.each(function(d) { placeLabel(d3.select(this), d); });
      labels.exit().transition().duration(animate ? 220 : 0).style("opacity", 0).remove();
      const merged = entered.merge(labels);
      // The total's label goes with the total once it has split.
      const opacity = (d) => isSplit() && d.key === "total" ? 0 : 1;

      merged.each(function(d) {
        const label = d3.select(this);
        if (!animate) {
          placeLabel(label, d);
          label.style("opacity", opacity(d));
          return;
        }
        if (moves.layoutChanged) {
          label.transition().duration(200).style("opacity", 0)
            .transition().duration(0).call(placeLabel, d)
            .transition().delay(moves.layoutDelay).duration(300).style("opacity", opacity(d));
          return;
        }
        if (moves.cut && moves.cut.d.key === d.key) {
          // Out with the pieces as they spread, then in with the stack.
          const { spreadAt, spreadDuration, stackStart, landAt } = moves.cut;
          label.style("opacity", 1)
            .transition().delay(spreadAt).duration(spreadDuration).ease(d3.easeCubicInOut)
            .call(placeLabel, d, false, true)
            .transition().delay(stackStart - spreadAt - spreadDuration).duration(landAt - stackStart)
            .ease(d3.easeCubicInOut)
            .call(placeLabel, d, false);
          const lines = labelLines(d);
          label.selectAll("text").transition("reword").delay(landAt - 150).duration(150).style("opacity", 0)
            .transition().duration(220).style("opacity", 1)
            .text(function() { return this.classList.contains("ave-ss-label") ? lines.name : lines.value; });
          return;
        }
        // A layer still being poured is labelled once its pour has finished.
        const delay = d.key === moves.revealKey && d.key !== "total" ? pourDuration : 0;
        label.transition().delay(delay).duration(moves.splitting ? 900 : 760).ease(d3.easeCubicInOut)
          .call(placeLabel, d)
          .style("opacity", opacity(d));
      });
    }

    // F is the fraction itself: the gap the two have kept since the partition gets its bar.
    function renderFraction(animate) {
      const show = state.phase === "f";
      const cx = width / 2;
      const half = d3.max(aggregateSquares().filter((d) => d.df), (d) => msGeometry(d).side) / 2 + (compact ? 8 : 22);
      const textGap = compact ? 8 : 14;
      fractionLayer.selectAll("*").interrupt();
      fractionLeft
        .attr("x", cx - half - textGap).attr("y", midline + 7)
        .text("F =");
      fractionRight
        .attr("x", cx + half + textGap).attr("y", midline + 7)
        .text(state.calculations ? `= ${fmt(stats.f)}` : "");
      fractionBar
        .attr("y1", midline).attr("y2", midline)
        .attr("x1", cx - (show && animate ? 0 : half))
        .attr("x2", cx + (show && animate ? 0 : half));
      const delay = show && animate ? 150 : 0;
      fractionBar.transition().delay(delay).duration(animate ? 480 : 0).ease(d3.easeCubicOut)
        .attr("x1", cx - half).attr("x2", cx + half)
        .style("opacity", show ? 1 : 0);
      fractionLayer.selectAll("text").transition().delay(show ? delay + 300 : 0).duration(animate ? 300 : 0)
        .style("opacity", show ? 1 : 0);
    }

    function stageDescription() {
      if (state.stage === "populations") {
        const count = ["Two", "Three", "Four", "Five", "Six"][groups.length - 2] || String(groups.length);
        return `${count} groups of sampled scores with different centers and variation among people within each group.`;
      }
      if (state.stage === "compare") {
        return {
          partition: "The total sum of squares, filled exactly by a within-groups layer with a between-groups layer on top.",
          split: "The between-groups and within-groups layers parted at their boundary, between above and within below, each redrawn as a square of the same area.",
          "ms-between": `The between-groups sum of squares broken into ${stats.dfBetween} equal ${stats.dfBetween === 1 ? "square" : "squares"}; one of them is the between-groups mean square.`,
          "ms-within": `The within-groups sum of squares broken into ${stats.dfWithin} equal squares; one of them is the within-groups mean square.`,
          f: "The F ratio drawn as a fraction: a bar along the old boundary, the between-groups mean square above it and the within-groups mean square below."
        }[state.phase];
      }
      const subjects = {
        total: "every score and the grand mean",
        within: "every score and its group mean",
        between: "each group mean, standing in for every score in its group, and the grand mean"
      };
      const phases = {
        observe: "showing the relevant scores and means",
        deviations: "showing deviation lines",
        squares: "showing each deviation as the edge of a square",
        sum: "collecting the squared deviations into their sum of squares"
      };
      return `${state.stage} variability: ${phases[state.phase]} for ${subjects[state.stage]}.`;
    }

    let lastRenderedStage = null;
    let lastRenderedPhase = null;

    function render(options) {
      options = options || {};
      const animate = bool(options.animate, true) && !prefersReducedMotion();
      const sameStage = lastRenderedStage === state.stage;
      const previousPhaseIndex = sameStage && PHASES.includes(lastRenderedPhase)
        ? PHASES.indexOf(lastRenderedPhase)
        : -1;
      const currentPhaseIndex = phaseIndex();
      const transitions = {
        drawLines: animate && currentPhaseIndex >= 1 && previousPhaseIndex < 1,
        growSquares: animate && currentPhaseIndex >= 2 && previousPhaseIndex < 2
      };
      const revealKey = animate && state.phase === "sum" && (!sameStage || lastRenderedPhase !== "sum")
        ? state.stage
        : null;
      // Mean squares build only when stepping forward into their phase.
      const previousCompareIndex = sameStage ? COMPARE_PHASES.indexOf(lastRenderedPhase) : -1;
      const msKey = animate && comparePhaseIndex() > previousCompareIndex
        ? { "ms-between": "between", "ms-within": "within" }[state.phase] || null
        : null;
      const splitting = animate && state.phase === "split" &&
        lastRenderedStage === "compare" && lastRenderedPhase === "partition";
      // Moving the total out of the panel comes first; anything after waits for it.
      const layoutChanged = lastRenderedStage !== null && wideLayout() !== (lastRenderedStage === "compare");
      const layoutDelay = animate && layoutChanged ? 800 : 0;
      const cut = msKey ? planCut(msKey, layoutDelay) : null;
      svg.select(".ave-title").text(stageDescription());
      plotGroup.interrupt().transition().duration(animate ? 500 : 0)
        .style("opacity", wideLayout() ? 0 : 1);
      renderPopulations(state.stage === "populations", animate);
      renderLanes(animate);
      renderDeviations(animate, transitions);
      renderMeans(animate);
      renderGhosts(animate);
      renderDots(animate);
      renderSquares(animate, revealKey, layoutDelay, splitting);
      renderMeanSquares(animate, msKey);
      renderLabels(animate, { layoutChanged, layoutDelay, cut, splitting, revealKey });
      animateContributions(revealKey, animate);
      if (cut) animateMeanSquare(cut);
      renderFraction(animate);
      updateCalculationBox();
      lastRenderedStage = state.stage;
      lastRenderedPhase = state.phase;
    }

    function applyTutorialAction(action) {
      if (!action || typeof action !== "object") return;
      if (action.stage !== undefined) {
        state.stage = stageFor(action.stage);
        state.phase = action.phase === undefined
          ? defaultPhaseForStage(state.stage)
          : phaseForStage(state.stage, normalizePhase(action.phase, defaultPhaseForStage(state.stage)));
      } else if (action.phase !== undefined) {
        state.phase = phaseForStage(state.stage, normalizePhase(action.phase, state.phase));
      }
      if (action.calculations !== undefined) {
        state.calculations = bool(action.calculations, state.calculations);
        calculationsToggle.property("checked", state.calculations);
      }
      render({ animate: action.animate !== false });
    }

    calculationsToggle.on("change", function() {
      state.calculations = this.checked;
      render({ animate: false });
    });

    rootNode.anovaVariabilityExplorer = {
      setStage(stage, animate) {
        state.stage = stageFor(stage);
        state.phase = defaultPhaseForStage(state.stage);
        render({ animate: animate !== false });
      },
      setPhase(phase, animate) {
        state.phase = phaseForStage(state.stage, normalizePhase(phase, state.phase));
        render({ animate: animate !== false });
      },
      showCalculations(value) {
        state.calculations = bool(value, true);
        calculationsToggle.property("checked", state.calculations);
        render({ animate: false });
      },
      getStatistics() { return { ...stats }; },
      applyTutorialAction
    };

    computeLayout(920);
    applyLayout();
    render({ animate: false });

    if (window.interactiveFigure) {
      window.interactiveFigure.wrap({
        root: rootNode,
        controls: controls.node(),
        label: "ANOVA calculations",
        placement: opts.controlsPlacement || "callout",
        layout: "equal",
        dividers: false,
        applyAction: applyTutorialAction,
        startOpen: bool(opts.controlsOpen, false)
      });
      if (typeof window.interactiveFigure.observeResponsiveLayout === "function") {
        window.interactiveFigure.observeResponsiveLayout({
          root: rootNode,
          container: rootNode,
          minimumWidth: 300,
          maximumWidth: 928,
          widthStep: 4,
          onLayout(layout) {
            if (Math.round(layout.width) === width) return;
            if (typeof window.interactiveFigure.cancelTransitions === "function") {
              window.interactiveFigure.cancelTransitions(rootNode);
            }
            computeLayout(layout.width);
            applyLayout();
            render({ animate: false });
          }
        });
      }
    }

    return rootNode;
  };
})();
