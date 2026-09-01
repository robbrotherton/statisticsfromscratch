(function() {
  "use strict";

  const STAGES = ["populations", "total", "within", "between", "compare"];
  const PHASES = ["observe", "deviations", "squares", "sum"];
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
    if (stage === "compare") return "compare";
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
      summed: "sum"
    };
    const normalized = aliases[key] || key;
    if (normalized === "compare") return "compare";
    return PHASES.includes(normalized) ? normalized : fallback;
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
        --ave-total: var(--bc-muted, #68727d);
        --ave-within: var(--bc-current-color, #d1495b);
        --ave-between: var(--bc-comparison-color, #2f6f9f);
        width: 100%;
        max-width: var(--ave-max-width, 58rem);
        margin: 0 auto 0.75rem;
        color: var(--bc-text, currentColor);
      }
      .anova-variability-explorer .ave-svg {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
      }
      .anova-variability-explorer .ave-axis path,
      .anova-variability-explorer .ave-axis line {
        stroke: var(--bc-border, #c8cdd2);
      }
      .anova-variability-explorer .ave-axis text,
      .anova-variability-explorer .ave-muted {
        fill: var(--bc-muted, #68727d);
      }
      .anova-variability-explorer .ave-axis text { font-size: 13px; }
      .anova-variability-explorer .ave-lane {
        stroke: color-mix(in srgb, var(--bc-border, #c8cdd2) 70%, transparent);
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
      .anova-variability-explorer .ave-deviation-weight {
        font-size: 12px;
        font-weight: 650;
        fill: var(--ave-between);
      }
      .anova-variability-explorer .ave-transfer-layer {
        pointer-events: none;
      }
      .anova-variability-explorer .ave-transfer-square {
        stroke-width: 1.25;
      }
      .anova-variability-explorer .ave-panel {
        fill: color-mix(in srgb, var(--bc-control-bg, #f1f3f5) 62%, transparent);
        stroke: var(--bc-border, #c8cdd2);
      }
      .anova-variability-explorer .ave-panel-title { font-size: 15px; font-weight: 750; }
      .anova-variability-explorer .ave-panel-subtitle { font-size: 12px; fill: var(--bc-muted, #68727d); }
      .anova-variability-explorer .ave-square { stroke-width: 1.25; }
      .anova-variability-explorer .ave-ss-label { font-size: 14px; font-weight: 720; }
      .anova-variability-explorer .ave-ss-value { font-size: 12px; fill: var(--bc-muted, #68727d); }
      .anova-variability-explorer .ave-summary-label { font-size: 15px; font-weight: 720; }
      .anova-variability-explorer .ave-summary-note { font-size: 13px; fill: var(--bc-muted, #68727d); }
      .anova-variability-explorer .ave-summary-bar { rx: 5; ry: 5; }
      .anova-variability-explorer .ave-equation { font-size: 17px; font-weight: 700; }
      .anova-variability-explorer .ave-calculation-box {
        margin-top: 0.45rem;
        padding: 0.65rem 0.8rem;
        border: 1px solid var(--bc-border, #c8cdd2);
        border-radius: 0.45rem;
        background: color-mix(in srgb, var(--bc-control-bg, #f1f3f5) 55%, transparent);
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

    const groups = (Array.isArray(opts.groups) && opts.groups.length >= 2 ? opts.groups : DEFAULT_GROUPS)
      .map((group, index) => ({
        name: String(group.name || group.label || `Group ${index + 1}`),
        values: (Array.isArray(group.values) ? group.values : []).map(Number).filter(Number.isFinite)
      }))
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
    const aggregateSquareScale = d3.scaleSqrt()
      .domain([0, stats.ssTotal])
      .range([0, 128]);

    const initialStage = normalizeStage(opts.stage);
    const state = {
      stage: initialStage,
      phase: normalizePhase(opts.phase, defaultPhaseForStage(initialStage)),
      calculations: bool(opts.calculations, false)
    };

    const root = d3.create("div")
      .attr("class", "anova-variability-explorer bc-figure")
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

    const axis = svg.append("g")
      .attr("class", "ave-axis")
      .attr("transform", `translate(0,${plot.bottom})`)
      .call(d3.axisBottom(x).ticks(9).tickSizeOuter(0));
    axis.append("text")
      .attr("x", (plot.left + plot.right) / 2)
      .attr("y", 42)
      .attr("fill", "currentColor")
      .attr("text-anchor", "middle")
      .text(opts.axisLabel || "Score");

    const populationsLayer = svg.append("g").attr("class", "ave-populations");
    const lanesLayer = svg.append("g").attr("class", "ave-lanes");
    const deviationLayer = svg.append("g").attr("class", "ave-deviations");
    const meansLayer = svg.append("g").attr("class", "ave-means");
    const dotsLayer = svg.append("g").attr("class", "ave-dots");
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
      return groupY(d.groupIndex) + (d.index - 2) * 5;
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
        .attr("cx", (d) => x(d.value))
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
      entered.append("text").attr("class", "ave-deviation-weight").attr("text-anchor", "middle");
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
      merged.select(".ave-deviation-weight")
        .attr("x", (d) => (x(d.from) + x(d.to)) / 2)
        .attr("y", (d) => d.y - 9)
        .text((d) => showSquares && d.weight ? `× ${d.weight}` : "")
        .style("opacity", showSquares ? 1 : 0);
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

    function aggregateSquares() {
      return [
        { key: "total", label: "Total", value: stats.ssTotal, color: "var(--ave-total)", reveal: 1, x: panel.x + 22, y: panel.y + 91 },
        { key: "within", label: "Within", value: stats.ssWithin, color: "var(--ave-within)", reveal: 2, x: panel.x + 22, y: panel.y + 380 },
        { key: "between", label: "Between", value: stats.ssBetween, color: "var(--ave-between)", reveal: 3, x: panel.x + 126, y: panel.y + 342 }
      ];
    }

    function aggregateRevealLevel() {
      const stageIndex = STAGES.indexOf(state.stage);
      if (stageIndex <= 0) return 0;
      if (stageIndex >= 4) return 3;
      const priorStages = stageIndex - 1;
      return priorStages + (state.phase === "sum" ? 1 : 0);
    }

    function renderSquares(animate, revealKey) {
      const title = panelGroup.select(".ave-panel-title");
      const subtitle = panelGroup.select(".ave-panel-subtitle");
      const stageIndex = STAGES.indexOf(state.stage);
      title.text("Sums of squares");
      subtitle.text(stageIndex === 0
        ? "The squared deviations will collect here"
        : stageIndex < 4
          ? (state.phase === "sum" ? "Adding the squared deviations" : "Build each squared deviation first")
          : "Total = between + within");

      squaresLayer.selectAll("*").interrupt();
      const data = aggregateSquares().filter((d) => aggregateRevealLevel() >= d.reveal);
      const items = squaresLayer.selectAll("g.ave-ss-item").data(data, (d) => d.key);
      const entered = items.enter().append("g").attr("class", "ave-ss-item");
      entered.append("text").attr("class", "ave-ss-label").style("opacity", 0);
      entered.append("rect")
        .attr("class", "ave-square")
        .attr("width", 0).attr("height", 0)
        .attr("fill-opacity", 0.18).attr("stroke-width", 1.5);
      entered.append("text").attr("class", "ave-ss-value").style("opacity", 0);
      const merged = entered.merge(items);
      merged.select(".ave-ss-label")
        .attr("x", (d) => d.x).attr("y", (d) => d.y - 10)
        .attr("fill", (d) => d.color)
        .text((d) => d.label)
        .transition().duration(animate ? 300 : 0).style("opacity", 1);
      merged.select("rect")
        .attr("x", (d) => d.x).attr("y", (d) => d.y)
        .attr("fill", (d) => d.color).attr("stroke", (d) => d.color)
        .transition()
        .delay((d) => animate && d.key === revealKey ? 360 : 0)
        .duration(animate ? 760 : 0).ease(d3.easeCubicOut)
        .attr("width", (d) => aggregateSquareScale(d.value))
        .attr("height", (d) => aggregateSquareScale(d.value));
      merged.select(".ave-ss-value")
        .attr("x", (d) => d.x)
        .attr("y", (d) => d.y + aggregateSquareScale(d.value) + 17)
        .text((d) => state.calculations ? `SS = ${fmt(d.value)}` : "")
        .transition().duration(animate ? 300 : 0).style("opacity", state.calculations ? 1 : 0);
      items.exit()
        .transition().duration(animate ? 220 : 0)
        .style("opacity", 0)
        .remove();
    }

    function animateContributions(revealKey, animate) {
      transferLayer.selectAll("*").interrupt().remove();
      if (!animate || !revealKey) return;

      const target = aggregateSquares().find((d) => d.key === revealKey);
      const baseContributions = deviationData();
      const contributions = revealKey === "between"
        ? baseContributions.flatMap((d) => d3.range(d.weight || 1).map((copyIndex) => ({ ...d, copyIndex })))
        : baseContributions.map((d) => ({ ...d, copyIndex: 0 }));
      if (!target || !contributions.length) return;

      const targetSide = aggregateSquareScale(target.value);
      const columns = Math.ceil(Math.sqrt(contributions.length));
      const rows = Math.ceil(contributions.length / columns);
      const cellWidth = targetSide / columns;
      const cellHeight = targetSide / rows;
      const pieceSide = Math.max(3, Math.min(cellWidth, cellHeight) * 0.72);

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
        .delay((d, i) => 70 + i * 34)
        .duration(720)
        .ease(d3.easeCubicInOut)
        .attr("x", (d, i) => target.x + (i % columns) * cellWidth + (cellWidth - pieceSide) / 2)
        .attr("y", (d, i) => target.y + Math.floor(i / columns) * cellHeight + (cellHeight - pieceSide) / 2)
        .attr("width", pieceSide)
        .attr("height", pieceSide)
        .attr("fill", target.color)
        .attr("stroke", target.color)
        .attr("fill-opacity", 0.34)
        .attr("stroke-opacity", 0.85)
        .transition()
        .duration(260)
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0)
        .remove();
    }

    function renderComparison(animate) {
      const visible = state.stage === "compare";
      summaryLayer.selectAll("*").remove();
      if (!visible) return;

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
        return "Between-groups variability is larger than within-groups variability; total variability equals their sum, motivating the F ratio.";
      }
      const subjects = {
        total: "every score and the grand mean",
        within: "every score and its group mean",
        between: "each group mean and the grand mean"
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
      svg.select(".ave-title").text(stageDescription());
      renderPopulations(state.stage === "populations", animate);
      renderLanes(animate);
      renderDeviations(animate, transitions);
      renderMeans(animate);
      renderDots(animate);
      renderSquares(animate, revealKey);
      animateContributions(revealKey, animate);
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
          : normalizePhase(action.phase, defaultPhaseForStage(state.stage));
      } else if (action.phase !== undefined) {
        state.phase = normalizePhase(action.phase, state.phase);
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
        state.phase = normalizePhase(phase, state.phase);
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
