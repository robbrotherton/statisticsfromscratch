(function() {
  "use strict";

  const STAGES = ["populations", "total", "within", "between", "compare"];
  const PHASES = ["observe", "deviations", "squares", "sum"];
  const COMPARE_PHASES = ["partition", "ms-between", "ms-within"];
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
      "ms-b": "ms-between",
      "ms-w": "ms-within"
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
      .anova-variability-explorer .ave-axis text { font-size: 13px; }
      .anova-variability-explorer .ave-lane {
        stroke: color-mix(in srgb, var(--sfs-border, #c8cdd2) 70%, transparent);
        stroke-width: 1;
      }
      .anova-variability-explorer .ave-pop-area { opacity: 0.1; }
      .anova-variability-explorer .ave-pop-line { fill: none; stroke-width: 2.2; opacity: 0.75; }
      .anova-variability-explorer .ave-group-label { font-size: 15px; font-weight: 700; }
      .anova-variability-explorer .ave-dot {
        stroke: var(--bs-body-bg, #fff);
        stroke-width: 2;
      }
      .anova-variability-explorer .ave-mean-line { stroke-width: 2.5; stroke-dasharray: 5 4; }
      .anova-variability-explorer .ave-grand-line { stroke: var(--ave-total); stroke-width: 2.5; stroke-dasharray: 8 5; }
      .anova-variability-explorer .ave-mean-label { font-size: 13px; font-weight: 650; }
      .anova-variability-explorer .ave-deviation { fill: none; stroke-width: 2; opacity: 0.72; }
      .anova-variability-explorer .ave-deviation-cap { stroke-width: 1.5; opacity: 0.72; }
      .anova-variability-explorer .ave-deviation-square {
        fill-opacity: 0.075;
        stroke-width: 1.15;
        stroke-opacity: 0.58;
      }
      .anova-variability-explorer .ave-ghost {
        fill-opacity: 0.22;
        stroke-width: 1.25;
        stroke-opacity: 0.5;
        stroke-dasharray: 2 2;
      }
      .anova-variability-explorer .ave-transfer-layer {
        pointer-events: none;
      }
      .anova-variability-explorer .ave-transfer-square {
        stroke-width: 1.25;
      }
      .anova-variability-explorer .ave-panel {
        fill: color-mix(in srgb, var(--sfs-control-bg, #f1f3f5) 62%, transparent);
        stroke: var(--sfs-border, #c8cdd2);
      }
      .anova-variability-explorer .ave-panel-title { font-size: 15px; font-weight: 750; }
      .anova-variability-explorer .ave-panel-subtitle { font-size: 12px; fill: var(--sfs-muted, #68727d); }
      .anova-variability-explorer .ave-square { stroke-width: 1.25; }
      .anova-variability-explorer .ave-ss-label { font-size: 14px; font-weight: 720; }
      .anova-variability-explorer .ave-ss-value { font-size: 12px; fill: var(--sfs-muted, #68727d); }
      .anova-variability-explorer .ave-ms-detail,
      .anova-variability-explorer .ave-cut-label { font-size: 13px; fill: var(--sfs-muted, #68727d); }
      .anova-variability-explorer .ave-cut-label { font-size: 16px; font-weight: 700; }
      .anova-variability-explorer .ave-summary-label { font-size: 15px; font-weight: 720; }
      .anova-variability-explorer .ave-summary-note { font-size: 13px; fill: var(--sfs-muted, #68727d); }
      .anova-variability-explorer .ave-summary-bar { rx: 5; ry: 5; }
      .anova-variability-explorer .ave-equation { font-size: 17px; font-weight: 700; }
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
    if (window.interactiveFigure) window.interactiveFigure.ensureStyles();

    const sortValues = bool(opts.sort, true);
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
    const width = 920;
    const height = 720;
    const plot = { left: 75, right: 600, top: 76, bottom: 610 };
    const panel = { x: 635, y: 66, width: 255, height: 540 };
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
    const x = d3.scaleLinear().domain([xMin, xMax]).range([plot.left, plot.right]);
    const groupY = d3.scalePoint().domain(d3.range(groups.length)).range([150, 540]);
    // Where the total sum of squares sits: in the side panel, or across the whole
    // figure once the dot plot gives way to the mean squares.
    const panelSquare = { x: panel.x + 22, y: panel.y + 150, side: 210 };
    const wideSquare = { x: 70, y: 190, side: 300 };
    // The mean squares stack either side of a midline: between above, within below.
    const msColumn = { cx: 680, bar: 340, gap: 10 };

    const initialStage = normalizeStage(opts.stage);
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
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img");
    svg.append("title").attr("class", "ave-title");

    // Everything about the scores themselves, faded out for the mean-square steps.
    const plotGroup = svg.append("g").attr("class", "ave-plot");
    const axis = plotGroup.append("g")
      .attr("class", "ave-axis")
      .attr("transform", `translate(0,${plot.bottom})`)
      .call(d3.axisBottom(x).ticks(9).tickSizeOuter(0));
    axis.append("text")
      .attr("x", (plot.left + plot.right) / 2)
      .attr("y", 42)
      .attr("fill", "currentColor")
      .attr("text-anchor", "middle")
      .text(opts.axisLabel || "Score");

    const populationsLayer = plotGroup.append("g").attr("class", "ave-populations");
    const lanesLayer = plotGroup.append("g").attr("class", "ave-lanes");
    const deviationLayer = plotGroup.append("g").attr("class", "ave-deviations");
    const meansLayer = plotGroup.append("g").attr("class", "ave-means");
    const ghostsLayer = plotGroup.append("g").attr("class", "ave-ghosts");
    const dotsLayer = plotGroup.append("g").attr("class", "ave-dots");
    const summaryLayer = svg.append("g").attr("class", "ave-summary");

    const panelGroup = svg.append("g").attr("class", "ave-squares-panel");
    panelGroup.append("rect")
      .attr("class", "ave-panel")
      .attr("x", panel.x).attr("y", panel.y)
      .attr("width", panel.width).attr("height", panel.height)
      .attr("rx", 10).attr("ry", 10);
    panelGroup.append("text")
      .attr("class", "ave-panel-title")
      .attr("x", panel.x + 18).attr("y", panel.y + 27);
    panelGroup.append("text")
      .attr("class", "ave-panel-subtitle")
      .attr("x", panel.x + 18).attr("y", panel.y + 47);
    const squaresLayer = panelGroup.append("g").attr("class", "ave-squares");
    const msLayer = svg.append("g").attr("class", "ave-mean-squares");
    const transferLayer = svg.append("g").attr("class", "ave-transfer-layer");

    const calculationBox = root.append("div")
      .attr("class", "ave-calculation-box")
      .attr("aria-live", "polite")
      .attr("hidden", state.calculations ? null : true);

    function fmt(value) {
      return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
    }

    function updateCalculationBox() {
      calculationBox.attr("hidden", state.calculations ? null : true);
      if (!state.calculations) return;
      calculationBox.html(`
        <div class="ave-calc-grid">
          <span><strong>SS<sub>total</sub></strong> = ${fmt(stats.ssTotal)}</span>
          <span><strong>SS<sub>within</sub></strong> = ${fmt(stats.ssWithin)}</span>
          <span><strong>SS<sub>between</sub></strong> = ${fmt(stats.ssBetween)}</span>
          <span><strong>MS<sub>between</sub></strong> = ${fmt(stats.ssBetween)} / ${stats.dfBetween} = ${fmt(stats.msBetween)}</span>
          <span><strong>MS<sub>within</sub></strong> = ${fmt(stats.ssWithin)} / ${stats.dfWithin} = ${fmt(stats.msWithin)}</span>
          <span><strong>F</strong> = ${fmt(stats.msBetween)} / ${fmt(stats.msWithin)} = ${fmt(stats.f)}</span>
        </div>
      `);
    }

    function densityPoints(mean, sd, yBase) {
      const points = d3.range(xMin, xMax + 0.05, 0.1).map((value) => {
        const density = Math.exp(-0.5 * Math.pow((value - mean) / sd, 2));
        return { x: x(value), y: yBase - density * 49 };
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
        const data = densityPoints(stats.means[i], sd, groupY(i) + 38);
        data.forEach((d) => { d.base = groupY(i) + 38; });
        const selection = d3.select(this);
        const curveColor = state.stage === "total" ? "var(--ave-total)" : colors[i % colors.length];
        selection.select(".ave-pop-area").attr("d", area(data)).attr("fill", curveColor);
        selection.select(".ave-pop-line").attr("d", line(data)).attr("stroke", curveColor);
      });
      curves.interrupt().transition().duration(animate ? 420 : 0)
        .style("opacity", visible ? 1 : state.stage === "total" ? 0.1 : 0.07);
    }

    function targetY(d) {
      return groupY(d.groupIndex) + (d.index - (groups[d.groupIndex].values.length - 1) / 2) * 5;
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
        .attr("x", plot.left - 12)
        .attr("text-anchor", "end")
        .attr("fill", (d, i) => colors[i % colors.length])
        .text((d) => d.name)
        .transition().duration(animate ? 520 : 0)
        .attr("y", (d, i) => groupY(i) + 5);
      labels.exit().remove();
    }

    // For between-groups variability, every score is replaced by its group mean.
    function dotX(d) {
      return state.stage === "between" ? x(stats.means[d.groupIndex]) : x(d.value);
    }

    function renderGhosts(animate) {
      const ghosts = ghostsLayer.selectAll("circle.ave-ghost")
        .data(state.stage === "between" ? stats.observations : [], (d) => `${d.groupIndex}-${d.index}`);
      ghosts.enter().append("circle")
        .attr("class", "ave-ghost")
        .attr("r", 6)
        .attr("cx", (d) => x(d.value))
        .attr("cy", targetY)
        .attr("fill", (d) => colors[d.groupIndex % colors.length])
        .attr("stroke", (d) => colors[d.groupIndex % colors.length])
        .style("opacity", 0)
        .transition().duration(animate ? 420 : 0)
        .style("opacity", 1);
      ghosts.exit().interrupt().transition().duration(animate ? 260 : 0).style("opacity", 0).remove();
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
      const side = Math.abs(x(d.from) - x(d.to));
      let y = d.y;
      if (d.groupIndex === groups.length - 1) y -= side;
      else if (d.groupIndex !== 0 && d.index % 2 === 0) y -= side;
      return {
        x: Math.min(x(d.from), x(d.to)),
        y,
        side
      };
    }

    function phaseIndex() {
      if (state.phase === "compare") return PHASES.length;
      return Math.max(0, PHASES.indexOf(state.phase));
    }

    function renderDeviations(animate, transitions) {
      transitions = transitions || {};
      const showLines = ["total", "within", "between"].includes(state.stage) && phaseIndex() >= 1;
      const showSquares = showLines && phaseIndex() >= 2;
      const data = showLines ? deviationData() : [];
      const deviations = deviationLayer.selectAll("g.ave-deviation-group")
        .data(data, (d) => `${d.groupIndex}-${d.index}`);
      const entered = deviations.enter().append("g").attr("class", "ave-deviation-group").style("opacity", 0);
      entered.append("rect").attr("class", "ave-deviation-square");
      entered.append("line").attr("class", "ave-deviation");
      entered.append("line").attr("class", "ave-deviation-cap");
      const merged = entered.merge(deviations);
      const square = merged.select(".ave-deviation-square")
        .interrupt()
        .attr("fill", (d) => d.color)
        .attr("stroke", (d) => d.color)
        .attr("x", (d) => deviationSquareGeometry(d).x)
        .attr("width", (d) => deviationSquareGeometry(d).side);
      if (showSquares && transitions.growSquares) {
        square
          .attr("y", (d) => d.y)
          .attr("height", 0)
          .style("opacity", 0)
          .transition().duration(animate ? 620 : 0).ease(d3.easeCubicOut)
          .attr("y", (d) => deviationSquareGeometry(d).y)
          .attr("height", (d) => deviationSquareGeometry(d).side)
          .style("opacity", 1);
      } else if (showSquares) {
        square
          .attr("y", (d) => deviationSquareGeometry(d).y)
          .attr("height", (d) => deviationSquareGeometry(d).side)
          .style("opacity", 1);
      } else {
        square
          .attr("y", (d) => d.y)
          .attr("height", 0)
          .style("opacity", 0);
      }

      const line = merged.select(".ave-deviation")
        .interrupt()
        .attr("stroke", (d) => d.color)
        .attr("x1", (d) => x(d.from))
        .attr("y1", (d) => d.y).attr("y2", (d) => d.y);
      const cap = merged.select(".ave-deviation-cap")
        .interrupt()
        .attr("stroke", (d) => d.color)
        .attr("x1", (d) => x(d.to)).attr("x2", (d) => x(d.to))
        .attr("y1", (d) => d.y - 5).attr("y2", (d) => d.y + 5);
      if (transitions.drawLines) {
        line
          .attr("x2", (d) => x(d.from))
          .transition().duration(animate ? 560 : 0).ease(d3.easeCubicInOut)
          .attr("x2", (d) => x(d.to));
        cap
          .style("opacity", 0)
          .transition().delay(animate ? 420 : 0).duration(animate ? 180 : 0)
          .style("opacity", 1);
      } else {
        line.attr("x2", (d) => x(d.to));
        cap.style("opacity", 1);
      }
      merged.interrupt().transition().duration(animate ? 380 : 0).style("opacity", 1);
      deviations.exit().transition().duration(animate ? 180 : 0).style("opacity", 0).remove();
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
        .attr("y1", (d) => groupY(d.i) - 35).attr("y2", (d) => groupY(d.i) + 35);
      meanMerged.select("text")
        .attr("fill", (d) => colors[d.i % colors.length])
        .attr("x", (d) => x(d.mean)).attr("y", (d) => groupY(d.i) - 43)
        .text("group mean");
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
        { key: "between", label: "Between", value: stats.ssBetween, base: stats.ssWithin, color: "var(--ave-between)", reveal: 3, df: stats.dfBetween, ms: stats.msBetween, msPhase: 1 },
        { key: "within", label: "Within", value: stats.ssWithin, base: 0, color: "var(--ave-within)", reveal: 2, df: stats.dfWithin, ms: stats.msWithin, msPhase: 2 }
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
      return comparePhaseIndex() >= 1;
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

    const pour = { stagger: 150, flyDuration: 560, dropDuration: 240, settleDuration: 260 };
    // Every sum receives one piece per score (between sends each group's square once per score).
    const pourDuration = 80 + (stats.N - 1) * pour.stagger + pour.flyDuration + pour.dropDuration + pour.settleDuration;

    function isLifted(d) {
      return Boolean(d.msPhase) && comparePhaseIndex() >= d.msPhase;
    }

    function setRect(selection, geometry) {
      return selection
        .attr("x", geometry.x).attr("y", geometry.y)
        .attr("width", geometry.width).attr("height", geometry.height);
    }

    function renderSquares(animate, revealKey, liftDelay) {
      const wide = wideLayout();
      const layout = squareLayout();
      const duration = animate ? 760 : 0;
      const stageIndex = STAGES.indexOf(state.stage);
      const title = panelGroup.select(".ave-panel-title");
      const subtitle = panelGroup.select(".ave-panel-subtitle");
      title.text("Sums of squares");
      subtitle.text(stageIndex === 0
        ? "The squared deviations will collect here"
        : stageIndex < 4
          ? (state.phase === "sum" ? "Adding the squared deviations" : "Build each squared deviation first")
          : "Total = between + within");
      title.interrupt().transition().duration(duration).ease(d3.easeCubicInOut)
        .attr("x", wide ? layout.x : panel.x + 18)
        .attr("y", wide ? layout.y - 52 : panel.y + 27);
      subtitle.interrupt().transition().duration(duration).ease(d3.easeCubicInOut)
        .attr("x", wide ? layout.x : panel.x + 18)
        .attr("y", wide ? layout.y - 32 : panel.y + 47);
      panelGroup.select(".ave-panel").interrupt().transition().duration(animate ? 480 : 0)
        .style("opacity", wide ? 0 : 1);

      squaresLayer.selectAll("*").interrupt().interrupt("ghost");
      const container = squaresLayer.selectAll("rect.ave-ss-container")
        .data(aggregateRevealLevel() >= 1 ? [layout] : []);
      container.enter().insert("rect", ":first-child")
        .attr("class", "ave-ss-container ave-square")
        .attr("fill", "none").attr("stroke", "var(--ave-total)").attr("stroke-width", 1.5)
        .attr("x", layout.x).attr("y", layout.y).attr("width", layout.side).attr("height", layout.side)
        .style("opacity", 0)
        .merge(container)
        .transition().duration(duration).ease(d3.easeCubicInOut)
        .attr("x", layout.x).attr("y", layout.y).attr("width", layout.side).attr("height", layout.side)
        .style("opacity", 1);
      container.exit().transition().duration(animate ? 220 : 0).style("opacity", 0).remove();

      const data = aggregateSquares().filter((d) => aggregateRevealLevel() >= d.reveal);
      const items = squaresLayer.selectAll("g.ave-ss-item").data(data, (d) => d.key);
      const entered = items.enter().append("g").attr("class", "ave-ss-item");
      entered.append("rect")
        .attr("class", "ave-square")
        .attr("fill-opacity", 0.18).attr("stroke-width", 1.5)
        .each(function(d) { setRect(d3.select(this), ssGeometry(d, 0, layout)); });
      entered.append("text").attr("class", "ave-ss-label").style("opacity", 0);
      entered.append("text").attr("class", "ave-ss-value").style("opacity", 0);
      const merged = entered.merge(items);

      // The total is the fill itself; the container draws its outline.
      const sumRects = merged.select("rect")
        .attr("fill", (d) => d.color)
        .attr("stroke", (d) => d.key === "total" ? "none" : d.color);
      // The sum being revealed starts empty; animateContributions raises it as each piece lands.
      const driven = (d) => animate && d.key === revealKey;
      sumRects.filter(driven).each(function(d) { setRect(d3.select(this), ssGeometry(d, 0, layout)); });
      sumRects.filter((d) => !driven(d))
        .transition()
        .duration(duration).ease(d3.easeCubicInOut)
        .attr("x", (d) => ssGeometry(d, d.value, layout).x)
        .attr("y", (d) => ssGeometry(d, d.value, layout).y)
        .attr("width", (d) => ssGeometry(d, d.value, layout).width)
        .attr("height", (d) => ssGeometry(d, d.value, layout).height);
      // A layer lifted out to become a mean square leaves its outline behind in the total.
      sumRects.transition("ghost")
        .delay(animate ? liftDelay : 0)
        .duration(animate ? 420 : 0)
        .attr("fill-opacity", (d) => isLifted(d) ? 0.04 : 0.18)
        .attr("stroke-opacity", (d) => isLifted(d) ? 0.55 : 1)
        .attr("stroke-dasharray", (d) => isLifted(d) ? "4 3" : null);

      // Total is labelled above the container; each layer inside its own top-left corner.
      // A layer's label waits for its pour to finish so it never floats above an empty space.
      const labelY = (d) => d.key === "total" ? layout.y - 10 : ssGeometry(d, d.value, layout).y + 18;
      const labelDelay = (d) => driven(d) && d.key !== "total" ? pourDuration : 0;
      const labelX = (d) => d.key === "total" ? layout.x : layout.x + 8;
      const valueX = (d) => d.key === "total" ? layout.x + layout.side : layout.x + 8;
      const valueY = (d) => d.key === "total" ? layout.y - 10 : labelY(d) + 16;
      entered.select(".ave-ss-label").attr("x", labelX).attr("y", labelY);
      entered.select(".ave-ss-value").attr("x", valueX).attr("y", valueY);
      merged.select(".ave-ss-label")
        .attr("fill", (d) => d.color)
        .text((d) => d.label)
        .transition().delay(labelDelay).duration(duration).ease(d3.easeCubicInOut)
        .attr("x", labelX)
        .attr("y", labelY)
        .style("opacity", 1);
      merged.select(".ave-ss-value")
        .attr("text-anchor", (d) => d.key === "total" ? "end" : "start")
        .text((d) => state.calculations ? `SS = ${fmt(d.value)}` : "")
        .transition().delay(labelDelay).duration(duration).ease(d3.easeCubicInOut)
        .attr("x", valueX)
        .attr("y", valueY)
        .style("opacity", state.calculations ? 1 : 0);
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
      let running = 0;
      contributions.forEach((d) => {
        const squared = Math.pow(d.from - d.to, 2);
        const surface = ssGeometry(target, running, layout).y;
        running += squared;
        d.side = areaSide(squared, layout);
        d.mouth = { x: layout.x + (layout.side - d.side) / 2, y: layout.y - d.side - 6 };
        d.landY = surface - d.side;
        d.sum = ssGeometry(target, running, layout);
        d.film = { y: d.sum.y, height: surface - d.sum.y };
      });
      const { stagger, flyDuration, dropDuration, settleDuration } = pour;

      transferLayer.selectAll("rect.ave-transfer-square")
        .data(contributions, (d) => `${d.groupIndex}-${d.index}-${d.copyIndex}`)
        .join("rect")
        .attr("class", "ave-transfer-square")
        .attr("fill", (d) => d.color)
        .attr("fill-opacity", 0.16)
        .attr("stroke", (d) => d.color)
        .attr("stroke-opacity", 0.75)
        .attr("x", (d) => deviationSquareGeometry(d).x)
        .attr("y", (d) => deviationSquareGeometry(d).y)
        .attr("width", (d) => deviationSquareGeometry(d).side)
        .attr("height", (d) => deviationSquareGeometry(d).side)
        .transition()
        .delay((d, i) => 80 + i * stagger)
        .duration(flyDuration)
        .ease(d3.easeCubicInOut)
        .attr("x", (d) => d.mouth.x)
        .attr("y", (d) => d.mouth.y)
        .attr("width", (d) => d.side)
        .attr("height", (d) => d.side)
        .attr("fill", target.color)
        .attr("stroke", target.color)
        .attr("fill-opacity", 0.3)
        .attr("stroke-opacity", 0.85)
        .transition()
        .duration(dropDuration)
        .ease(d3.easeQuadIn)
        .attr("y", (d) => d.landY)
        .transition()
        .duration(settleDuration)
        .ease(d3.easeCubicOut)
        .on("start", (d) => {
          sumRect.transition().duration(settleDuration).ease(d3.easeCubicOut)
            .attr("y", d.sum.y)
            .attr("height", d.sum.height);
        })
        .attr("x", layout.x)
        .attr("y", (d) => d.film.y)
        .attr("width", layout.side)
        .attr("height", (d) => d.film.height)
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0)
        .remove();
    }

    // Each mean square sits in a column: between above the midline, within below.
    function msGeometry(d) {
      const side = areaSide(d.ms, wideSquare);
      return {
        x: msColumn.cx - side / 2,
        y: d.key === "between" ? msColumn.bar - msColumn.gap - side : msColumn.bar + msColumn.gap,
        side
      };
    }

    function msDetail(d) {
      return state.calculations
        ? `${fmt(d.value)} ÷ ${d.df} = ${fmt(d.ms)}`
        : `SS ${d.key} ÷ ${d.df}`;
    }

    function renderMeanSquares(animate, revealKey) {
      msLayer.selectAll("*").interrupt();
      const phase = comparePhaseIndex();
      const data = aggregateSquares().filter((d) => d.msPhase && phase >= d.msPhase);
      const items = msLayer.selectAll("g.ave-ms-item").data(data, (d) => d.key);
      const entered = items.enter().append("g").attr("class", "ave-ms-item").style("opacity", 0);
      entered.append("rect").attr("class", "ave-square").attr("fill-opacity", 0.18).attr("stroke-width", 1.5);
      entered.append("text").attr("class", "ave-ss-label").attr("text-anchor", "middle");
      entered.append("text").attr("class", "ave-ms-detail").attr("text-anchor", "middle");
      const merged = entered.merge(items);
      merged.select("rect")
        .attr("fill", (d) => d.color).attr("stroke", (d) => d.color)
        .attr("x", (d) => msGeometry(d).x).attr("y", (d) => msGeometry(d).y)
        .attr("width", (d) => msGeometry(d).side).attr("height", (d) => msGeometry(d).side);
      const above = (d) => d.key === "between";
      merged.select(".ave-ss-label")
        .attr("fill", (d) => d.color)
        .attr("x", msColumn.cx)
        .attr("y", (d) => above(d) ? msGeometry(d).y - 30 : msGeometry(d).y + msGeometry(d).side + 22)
        .text((d) => `MS ${d.key}`);
      merged.select(".ave-ms-detail")
        .attr("x", msColumn.cx)
        .attr("y", (d) => above(d) ? msGeometry(d).y - 12 : msGeometry(d).y + msGeometry(d).side + 40)
        .text(msDetail);
      // The square being built stays hidden until animateMeanSquare hands it over.
      merged.filter((d) => !(animate && d.key === revealKey))
        .transition().duration(animate ? 300 : 0)
        .style("opacity", 1);
      merged.filter((d) => animate && d.key === revealKey).style("opacity", 0);
      items.exit().transition().duration(animate ? 220 : 0).style("opacity", 0).remove();
    }

    // Lift a layer out of the total, cut it into df equal slices, stack the slices
    // (they are all the same size, so the stack is one share), and square it up.
    function animateMeanSquare(revealKey, delay) {
      const d = aggregateSquares().find((item) => item.key === revealKey);
      if (!d) return;
      const band = ssGeometry(d, d.value, wideSquare);
      const target = msGeometry(d);
      const above = d.key === "between";
      const columnX = msColumn.cx - band.width / 2;
      const columnY = above ? msColumn.bar - msColumn.gap - band.height : msColumn.bar + msColumn.gap;
      const sliceWidth = band.width / d.df;
      const middle = (d.df - 1) / 2;
      // The slices stack onto the middle of the column, outermost slices travelling furthest.
      const slices = d3.range(d.df).map((k) => ({
        k,
        x: columnX + k * sliceWidth,
        order: Math.abs(k - middle)
      }));
      const stackX = msColumn.cx - sliceWidth / 2;
      const spread = Math.min(6, 48 / Math.max(1, d.df - 1));
      // Stacked translucent slices darken; while they square up they ease back to one square's shade.
      const sliceOpacity = 1 - Math.pow(1 - 0.18, 1 / d.df);
      // Planned as absolute times; chained transitions take their delay from the previous one's end.
      const liftDuration = 650;
      const cutAt = delay + liftDuration;
      const stackStart = cutAt + 520;
      const stackDuration = 620;
      const stagger = Math.min(45, 360 / d.df);
      const lastOrder = d3.max(slices, (s) => s.order);
      const morphStart = stackStart + stackDuration + lastOrder * stagger + 160;

      transferLayer.append("rect")
        .attr("class", "ave-transfer-square")
        .attr("fill", d.color).attr("stroke", d.color)
        .attr("fill-opacity", 0.18).attr("stroke-width", 1.5)
        .call(setRect, band)
        .style("opacity", 0)
        .transition().delay(delay).duration(0).style("opacity", 1)
        .transition().duration(liftDuration).ease(d3.easeCubicInOut)
        .attr("x", columnX).attr("y", columnY)
        .transition().duration(0)
        .remove();

      transferLayer.append("text")
        .attr("class", "ave-cut-label")
        .attr("x", columnX + band.width + spread * middle + 14)
        .attr("y", columnY + band.height / 2 + 5)
        .text(`÷ ${d.df}`)
        .style("opacity", 0)
        .transition().delay(cutAt).duration(260).style("opacity", 1)
        .transition().delay(morphStart - cutAt - 260).duration(300).style("opacity", 0)
        .remove();

      transferLayer.selectAll("rect.ave-slice")
        .data(slices)
        .join("rect")
        .attr("class", "ave-slice ave-transfer-square")
        .attr("fill", d.color).attr("stroke", d.color)
        .attr("fill-opacity", 0.18).attr("stroke-width", 1.5)
        .attr("x", (s) => s.x).attr("y", columnY)
        .attr("width", sliceWidth).attr("height", band.height)
        .style("opacity", 0)
        .transition().delay(cutAt).duration(0).style("opacity", 1)
        .transition().delay(100).duration(320).ease(d3.easeCubicOut)
        .attr("x", (s) => s.x + (s.k - middle) * spread)
        .transition().delay((s) => stackStart - (cutAt + 420) + (lastOrder - s.order) * stagger)
        .duration(stackDuration).ease(d3.easeCubicInOut)
        .attr("x", stackX)
        .transition().delay((s) => morphStart - (stackStart + (lastOrder - s.order) * stagger + stackDuration))
        .duration(620).ease(d3.easeCubicInOut)
        .attr("x", target.x).attr("y", target.y)
        .attr("width", target.side).attr("height", target.side)
        .attr("fill-opacity", sliceOpacity)
        .on("end", (s) => {
          if (s.k !== 0) return;
          msLayer.selectAll("g.ave-ms-item").filter((item) => item.key === revealKey).style("opacity", 1);
        })
        .remove();
    }

    function renderComparison(animate) {
      summaryLayer.selectAll("*").interrupt().remove();
      if (comparePhaseIndex() !== 0) return;

      summaryLayer.append("text")
        .attr("class", "ave-equation")
        .attr("x", (plot.left + plot.right) / 2).attr("y", 680)
        .attr("text-anchor", "middle")
        .text(state.calculations
          ? `${fmt(stats.ssTotal)} = ${fmt(stats.ssBetween)} + ${fmt(stats.ssWithin)}`
          : "Total variability = between groups + within groups");
    }

    function stageDescription() {
      if (state.stage === "populations") {
        return "Three groups of sampled scores with different centers and variation among people within each group.";
      }
      if (state.stage === "compare") {
        return {
          partition: "The total sum of squares, filled exactly by a within-groups layer with a between-groups layer on top.",
          "ms-between": `The between-groups layer cut into ${stats.dfBetween} equal slices, stacked into one square: the between-groups mean square.`,
          "ms-within": `The within-groups layer cut into ${stats.dfWithin} equal slices, stacked into one square: the within-groups mean square.`
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
      // Moving the total out of the panel comes first; the lift waits for it.
      const wasWide = lastRenderedStage === "compare" && COMPARE_PHASES.indexOf(lastRenderedPhase) >= 1;
      const layoutDelay = animate && wideLayout() !== wasWide ? 800 : 0;
      svg.select(".ave-title").text(stageDescription());
      plotGroup.interrupt().transition().duration(animate ? 500 : 0)
        .style("opacity", wideLayout() ? 0 : 1);
      renderPopulations(state.stage === "populations", animate);
      renderLanes(animate);
      renderDeviations(animate, transitions);
      renderMeans(animate);
      renderGhosts(animate);
      renderDots(animate);
      renderSquares(animate, revealKey, layoutDelay);
      renderMeanSquares(animate, msKey);
      animateContributions(revealKey, animate);
      if (msKey) animateMeanSquare(msKey, layoutDelay);
      renderComparison(animate);
      updateCalculationBox();
      lastRenderedStage = state.stage;
      lastRenderedPhase = state.phase;
    }

    function applyTutorialAction(action) {
      if (!action || typeof action !== "object") return;
      if (action.stage !== undefined) {
        state.stage = normalizeStage(action.stage);
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
        state.stage = normalizeStage(stage);
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
    }

    return rootNode;
  };
})();
