// Rows of scores on a shared axis, one row per condition: the display
// Chapters 12 and 13 use to show who contributed which score.
//
// It deliberately shares the visual language of the Chapter 14 ANOVA
// variability explorer (anova-variability-explorer.js): one lane per group,
// group colors from the series tokens, white-stroked dots, dashed mean lines.
// That explorer shows deviations and sums of squares; this module is the
// lighter illustration of the t-test logic: means, their difference, and
// each row's spread.
//
// Stages:
//   scores       dots colored by group (or by person, with colorBy: "person")
//   pairs        dots colored by person, each person's scores joined by a line
//   differences  the pairs slide to zero and drop into a row of difference
//                scores, D = second group - first group, on an axis with the
//                same units-per-pixel scale so their spread can be compared
//
// Annotations, switched on and off independently by tutorial actions:
//   means        each row's dashed mean line
//   meanGap      a bracket between the first two rows' means (the numerator
//                of an independent-samples t)
//   spread       "sd": a capped span, mean +/- 1 SD, just under each row (the
//                book's shared SD mark, span-marks.js); "pooled": the pooled
//                SD; "se": the standard error of the difference; "none".
//                With `middle: true` the pooled and SE spans sit between the
//                rows under the difference bracket (see spanItems).
// In the differences stage the score rows fade and the spread span applies
// to the difference row as well.
//
// The pure helpers (statistics, stacking, person colors, difference domain)
// are exposed on window.sfsScoreRows so other figures and the tests can share
// them.
(function() {
  "use strict";

  const STAGES = ["scores", "pairs", "differences"];
  // Group rows skip series 1 (blue) so the samples never compete with the
  // comparison blue used for the difference between means, and skip series 4
  // (vermilion), too close to the red used for the SE. Bluish green first,
  // then orange.
  const GROUP_COLORS = [
    "var(--graph-series-3, #009e73)",
    "var(--graph-series-2, #e69f00)",
    "var(--graph-series-5, #cc79a7)"
  ];
  const TABLEAU10_FALLBACK = [
    "#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f",
    "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab"
  ];
  // Semantic colors shared with the Chapter 14 ANOVA explorer: the
  // difference between means is the between-groups signal (comparison blue);
  // the pooled SD and standard error are within-groups noise (current red).
  const SIGNAL_COLOR = "var(--sfs-comparison-color, #2f6f9f)";
  const NOISE_COLOR = "var(--sfs-current-color, #d1495b)";
  const DOT_RADIUS = 6.5;
  const STACK_STEP = 14;
  // The SD span sits just under the dots; the dashed mean line reaches down
  // to meet its center.
  const SPAN_OFFSET = 20;
  const MEAN_HALF_HEIGHT = 16;
  const MIN_WIDTH = 300;
  const MAX_WIDTH = 640;
  const NARROW_BELOW = 480;

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
    const aliases = { data: "scores", populations: "scores", paired: "pairs", difference: "differences", d: "differences" };
    const normalized = aliases[key] || key;
    return STAGES.includes(normalized) ? normalized : "scores";
  }

  function normalizeSpread(value) {
    if (value === true) return "sd";
    const key = String(value || "none").trim().toLowerCase();
    if (["sd", "pooled", "se"].includes(key)) return key;
    return "none";
  }

  function normalizeGroups(groups) {
    return (Array.isArray(groups) ? groups : [])
      .map((group, index) => ({
        name: String((group && (group.name || group.label)) || `Group ${index + 1}`),
        values: (group && Array.isArray(group.values) ? group.values : []).map(Number).filter(Number.isFinite)
      }))
      .filter((group) => group.values.length);
  }

  // Means, SDs and the pooled SD, and for paired data each person's
  // difference score (second group minus first) with its mean and SD.
  function computeStats(groups, paired) {
    const means = groups.map((group) => d3.mean(group.values));
    const sumsOfSquares = groups.map((group, i) => d3.sum(group.values, (value) => Math.pow(value - means[i], 2)));
    const sds = groups.map((group, i) => group.values.length > 1 ? Math.sqrt(sumsOfSquares[i] / (group.values.length - 1)) : 0);
    const pooledDf = d3.sum(groups, (group) => group.values.length - 1);
    const canPair = Boolean(paired) && groups.length === 2 && groups[0].values.length === groups[1].values.length;
    const differences = canPair
      ? groups[0].values.map((value, index) => groups[1].values[index] - value)
      : [];
    return {
      means,
      sds,
      sumsOfSquares,
      pooledSd: pooledDf > 0 ? Math.sqrt(d3.sum(sumsOfSquares) / pooledDf) : null,
      // Standard error of the difference between the first two means,
      // using the pooled variance: s_p * sqrt(1/n1 + 1/n2).
      seDifference: groups.length > 1 && pooledDf > 0
        ? Math.sqrt(d3.sum(sumsOfSquares) / pooledDf) * Math.sqrt(1 / groups[0].values.length + 1 / groups[1].values.length)
        : null,
      paired: canPair,
      differences,
      meanDifference: differences.length ? d3.mean(differences) : null,
      sdDifference: differences.length > 1 ? d3.deviation(differences) : null
    };
  }

  // Vertical offsets that keep dots from hiding one another. Dots closer
  // than minGap (in the units of position(), usually pixels) move to the
  // nearest free level, alternating below and above the row: 0, -1, +1, -2...
  // Ties stack the same way, so three tied scores make a column of three.
  function stackOffsets(values, options) {
    options = options || {};
    const step = finite(options.step, STACK_STEP);
    const minGap = finite(options.minGap, 1e-9);
    const position = typeof options.position === "function" ? options.position : (value) => value;
    const levels = [0, -1, 1, -2, 2, -3, 3, -4, 4];
    const lastAtLevel = new Map();
    const offsets = new Array(values.length).fill(0);
    values
      .map((value, index) => ({ index, at: position(value) }))
      .sort((a, b) => a.at - b.at || a.index - b.index)
      .forEach((item) => {
        const level = levels.find((candidate) => !lastAtLevel.has(candidate) ||
          item.at - lastAtLevel.get(candidate) >= minGap) ?? 0;
        lastAtLevel.set(level, item.at);
        offsets[item.index] = level * step;
      });
    return offsets;
  }

  function tableau10() {
    return (window.d3 && d3.schemeTableau10) || TABLEAU10_FALLBACK;
  }

  // Paired data: person i has the same color in every row. Unpaired data:
  // every observation is a different person, so colors run on across rows.
  function personColor(groups, groupIndex, index, paired) {
    const palette = tableau10();
    const offset = paired ? 0 : d3.sum(groups.slice(0, groupIndex), (group) => group.values.length);
    return palette[(offset + index) % palette.length];
  }

  // A domain for the difference axis with the same width as the score axis,
  // so a difference of 5 is the same length on both. Zero sits directly
  // under `anchor` (the first group's mean): each pair slides until its first
  // score is on that mean, so the second scores land at mean + D, average to
  // the second group's mean, and the mean difference lines up under it.
  // Without an anchor, or if a difference would fall off that axis, the
  // domain is centered on the differences instead. Zero is always included.
  function differenceDomain(differences, scoreDomain, anchor) {
    const span = scoreDomain[1] - scoreDomain[0];
    const low = Math.min(0, d3.min(differences));
    const high = Math.max(0, d3.max(differences));
    if (Number.isFinite(anchor)) {
      const anchored = [scoreDomain[0] - anchor, scoreDomain[1] - anchor];
      if (anchored[0] <= low && anchored[1] >= high) return anchored;
    }
    if (high - low > span) return [low, high];
    const center = (low + high) / 2;
    return [center - span / 2, center + span / 2];
  }

  window.sfsScoreRows = { computeStats, stackOffsets, personColor, differenceDomain, normalizeStage, normalizeSpread };

  function prefersReducedMotion() {
    return window.interactiveRuntime && window.interactiveRuntime.motion
      ? window.interactiveRuntime.motion.isReduced()
      : Boolean(window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function ensureStyles() {
    if (document.getElementById("score-rows-styles")) return;
    const style = document.createElement("style");
    style.id = "score-rows-styles";
    style.textContent = `
      .sfs-score-rows {
        width: 100%;
        max-width: var(--sr-max-width, 40rem);
        margin: 0 auto 0.75rem;
        color: var(--sfs-text, currentColor);
      }
      .sfs-score-rows .sr-svg { display: block; width: 100%; height: auto; overflow: visible; }
      .sfs-score-rows .sr-axis path,
      .sfs-score-rows .sr-axis line { stroke: var(--sfs-border, #c8cdd2); }
      .sfs-score-rows .sr-axis text { fill: var(--sfs-muted, #68727d); font-size: var(--sfs-figure-tick-size, 0.8125rem); }
      .sfs-score-rows .sr-axis-label { fill: currentColor; font-size: var(--sfs-figure-label-size, 0.875rem); }
      .sfs-score-rows .sr-lane {
        stroke: color-mix(in srgb, var(--sfs-border, #c8cdd2) 70%, transparent);
        stroke-width: 1;
      }
      .sfs-score-rows .sr-row-label { font-size: var(--sfs-figure-label-size, 0.875rem); font-weight: 700; }
      .sfs-score-rows .sr-dot { stroke: var(--bs-body-bg, #fff); stroke-width: 2; }
      .sfs-score-rows .sr-connector { fill: none; stroke-width: 2; stroke-linecap: round; }
      .sfs-score-rows .sr-mean-line { stroke-width: 2.5; stroke-dasharray: 5 4; }
      .sfs-score-rows .sr-mean-label { font-size: var(--sfs-figure-small-size, 0.75rem); font-weight: 650; }
      .sfs-score-rows .sr-zero-line { stroke: var(--sfs-muted, #68727d); stroke-width: 1.5; }
      .sfs-score-rows .sr-zero-guide { stroke: var(--sfs-muted, #68727d); stroke-width: 1.25; stroke-dasharray: 2 4; }
      .sfs-score-rows .sr-zero-label { fill: var(--sfs-muted, #68727d); font-size: var(--sfs-figure-small-size, 0.75rem); }
      .sfs-score-rows .sr-difference-color { fill: var(--sfs-text, currentColor); }
      .sfs-score-rows .sr-ghost-line { fill: none; stroke-width: 2; stroke-linecap: round; }
      .sfs-score-rows .sr-ghosts { pointer-events: none; }
      .sfs-score-rows .sr-span { stroke-width: 2.2; }
      .sfs-score-rows .sr-span-label { font-size: var(--sfs-figure-small-size, 0.75rem); font-weight: 650; }
      .sfs-score-rows .sr-gap line { stroke: ${SIGNAL_COLOR}; stroke-width: 2.2; }
      .sfs-score-rows .sr-gap text { fill: ${SIGNAL_COLOR}; font-size: var(--sfs-figure-small-size, 0.75rem); font-weight: 650; }
    `;
    document.head.appendChild(style);
  }

  window.makeScoreRows = function(opts) {
    opts = opts || {};
    ensureStyles();
    if (window.interactiveFigure) window.interactiveFigure.ensureStyles();

    const groups = normalizeGroups(opts.groups);
    const stats = computeStats(groups, bool(opts.paired, false));
    const showAxis = bool(opts.axis, true);
    const tutorial = bool(opts.tutorial, false);
    // Mean lines can be toggled, so reserve room for their labels whenever
    // they may appear.
    const meansAvailable = showAxis || bool(opts.means, false);
    const showConnectors = bool(opts.connectors, false);
    const differenceOpts = stats.paired && opts.differences
      ? Object.assign({ label: "Difference", axisLabel: "Difference", meanLabel: "mean difference", zeroLabel: "no difference" },
          opts.differences === true ? {} : opts.differences)
      : null;
    const personLabels = Array.isArray(opts.personLabels) ? opts.personLabels.map(String) : [];
    const allValues = groups.flatMap((group) => group.values);
    const xDomain = [
      finite(opts.xMin, Math.floor(d3.min(allValues) - 2)),
      finite(opts.xMax, Math.ceil(d3.max(allValues) + 2))
    ];

    const state = {
      stage: allowedStage(opts.stage),
      lastStage: null,
      means: meansAvailable && bool(opts.means, showAxis),
      meanGap: bool(opts.meanGap, false),
      spread: normalizeSpread(opts.spread)
    };
    // SD spans and their labels sit under each row, so tutorials (which may
    // show them) get more room between rows.
    const roomy = tutorial || state.spread !== "none";
    const middle = bool(opts.middle, false);
    let geometry = null;

    function allowedStage(value) {
      let stage = normalizeStage(value);
      if (!stats.paired) stage = "scores";
      if (!differenceOpts && stage === "differences") stage = "pairs";
      return stage;
    }

    const root = d3.create("div")
      .attr("class", "sfs-score-rows sfs-figure")
      .style("--sr-max-width", opts.maxWidth || null);
    const rootNode = root.node();
    const controls = root.append("div").attr("class", "sr-controls");
    const svg = root.append("svg")
      .attr("class", "sr-svg")
      .attr("role", "img");
    svg.append("title").attr("class", "sr-title");
    const canvas = svg.append("g").attr("class", "sr-canvas");

    // Everything positional depends on the width the figure is drawn at, so
    // text keeps its real size on phones instead of shrinking with a fixed
    // viewBox.
    function computeGeometry(width) {
      const narrow = width < NARROW_BELOW;
      const labelNames = groups.map((group) => group.name)
        .concat(differenceOpts ? [differenceOpts.label] : []);
      const longestLabel = d3.max(labelNames, (name) => name.length) || 6;
      const plot = { left: Math.max(56, 16 + longestLabel * (narrow ? 8.2 : 9)), right: width - 18 };
      // `middle` keeps the difference bracket and the pooled span between
      // the first two rows, so they need a wider gap.
      const rowGap = middle ? 152 : (narrow ? 64 : 72) + (roomy ? 12 : 0);
      const firstRow = meansAvailable ? 40 : 26;
      const rowY = (i) => firstRow + i * rowGap;
      const axisClearance = roomy ? 52 : 32;
      const axisY = rowY(groups.length - 1) + axisClearance;
      const differenceRowY = axisY + 100;
      const differenceAxisY = differenceRowY + axisClearance;
      const height = differenceOpts
        ? differenceAxisY + 52
        : showAxis ? axisY + 52 : rowY(groups.length - 1) + 30;
      const x = d3.scaleLinear().domain(xDomain).range([plot.left, plot.right]);
      const dx = differenceOpts
        ? d3.scaleLinear().domain(differenceDomain(stats.differences, xDomain, stats.means[0])).range([plot.left, plot.right])
        : null;
      const ticks = narrow ? 4 : 8;

      const observations = groups.flatMap((group, groupIndex) => {
        const offsets = stackOffsets(group.values, { position: x, minGap: DOT_RADIUS * 2 + 1 });
        return group.values.map((value, index) => ({
          key: `${groupIndex}-${index}`,
          groupIndex,
          index,
          value,
          y: rowY(groupIndex) + offsets[index],
          groupColor: GROUP_COLORS[groupIndex % GROUP_COLORS.length],
          personColor: personColor(groups, groupIndex, index, stats.paired),
          label: personLabels[index] || ""
        }));
      });
      const differenceOffsets = dx
        ? stackOffsets(stats.differences, { position: dx, minGap: DOT_RADIUS * 2 + 1 })
        : [];
      const differencePoints = stats.differences.map((value, index) => ({
        key: `d-${index}`,
        index,
        value,
        y: differenceRowY + differenceOffsets[index],
        personColor: personColor(groups, 0, index, true),
        label: personLabels[index] || ""
      }));
      const pairs = stats.paired
        ? groups[0].values.map((value, index) => ({
            index,
            first: observations[index],
            second: observations[groups[0].values.length + index],
            difference: differencePoints[index]
          }))
        : [];

      const gapY = middle ? rowY(0) + 62 : rowY(0) + rowGap / 2;
      const pooledY = rowY(0) + 92;
      return { width, height, plot, rowGap, rowY, gapY, pooledY, middle, axisY, differenceRowY, differenceAxisY, x, dx, ticks,
        observations, differencePoints, pairs };
    }

    function tickFormat(scale, count) {
      const format = scale.tickFormat(count);
      return (value) => (Number.isInteger(value) ? String(value) : format(value)).replace("-", "−");
    }

    function fmt(value) {
      return d3.format(".2~f")(value).replace("-", "−");
    }

    // Static scaffolding: axes, lanes, labels, means, the difference row.
    function build(width) {
      geometry = computeGeometry(width);
      const g = geometry;
      svg.attr("viewBox", `0 0 ${g.width} ${g.height}`);
      canvas.selectAll("*").interrupt().remove();


      if (showAxis) {
        const axis = canvas.append("g")
          .attr("class", "sr-axis")
          .attr("transform", `translate(0,${g.axisY})`)
          .call(d3.axisBottom(g.x)
            .tickValues(Array.isArray(opts.tickValues) ? opts.tickValues : null)
            .ticks(g.ticks).tickSizeOuter(0)
            .tickFormat(tickFormat(g.x, g.ticks)));
        axis.append("text")
          .attr("class", "sr-axis-label")
          .attr("x", (g.plot.left + g.plot.right) / 2).attr("y", 38)
          .attr("text-anchor", "middle")
          .text(opts.axisLabel || "Score");
      }

      const lanes = canvas.append("g").attr("class", "sr-lanes");
      lanes.selectAll("line").data(groups).join("line")
        .attr("class", "sr-lane")
        .attr("x1", g.plot.left).attr("x2", g.plot.right)
        .attr("y1", (d, i) => g.rowY(i)).attr("y2", (d, i) => g.rowY(i));
      lanes.selectAll("text").data(groups).join("text")
        .attr("class", "sr-row-label")
        .attr("x", g.plot.left - 12).attr("y", (d, i) => g.rowY(i) + 5)
        .attr("text-anchor", "end")
        .attr("fill", (d, i) => GROUP_COLORS[i % GROUP_COLORS.length])
        .text((d) => d.name);

      const means = canvas.append("g").attr("class", "sr-means");
      if (meansAvailable) {
        const mean = means.selectAll("g").data(stats.means).join("g");
        mean.append("line")
          .attr("class", "sr-mean-line")
          .attr("stroke", (d, i) => GROUP_COLORS[i % GROUP_COLORS.length])
          .attr("x1", (d) => g.x(d)).attr("x2", (d) => g.x(d))
          .attr("y1", (d, i) => g.rowY(i) - MEAN_HALF_HEIGHT).attr("y2", (d, i) => g.rowY(i) + MEAN_HALF_HEIGHT);
        mean.append("text")
          .attr("class", "sr-mean-label")
          .attr("fill", (d, i) => GROUP_COLORS[i % GROUP_COLORS.length])
          .attr("x", (d) => g.x(d)).attr("y", (d, i) => g.rowY(i) - MEAN_HALF_HEIGHT - 5)
          .attr("text-anchor", "middle")
          .text(opts.meanLabel || "mean");
      }

      if (differenceOpts) {
        // The row's outline shows from the start, faintly, so the space it
        // reserves reads as "something goes here" rather than a gap.
        const skeleton = canvas.append("g").attr("class", "sr-difference-skeleton");
        skeleton.append("line")
          .attr("class", "sr-lane")
          .attr("x1", g.plot.left).attr("x2", g.plot.right)
          .attr("y1", g.differenceRowY).attr("y2", g.differenceRowY);
        skeleton.append("text")
          .attr("class", "sr-row-label sr-difference-color")
          .attr("x", g.plot.left - 12).attr("y", g.differenceRowY + 5)
          .attr("text-anchor", "end")
          .text(differenceOpts.label);
        const differenceAxis = skeleton.append("g")
          .attr("class", "sr-axis")
          .attr("transform", `translate(0,${g.differenceAxisY})`)
          .call(d3.axisBottom(g.dx).ticks(g.ticks).tickSizeOuter(0).tickFormat(tickFormat(g.dx, g.ticks)));
        differenceAxis.append("text")
          .attr("class", "sr-axis-label")
          .attr("x", (g.plot.left + g.plot.right) / 2).attr("y", 38)
          .attr("text-anchor", "middle")
          .text(differenceOpts.axisLabel);

        // Shown only once the differences arrive: the zero line, a guide
        // running up through the score rows (where the pairs slide to, on
        // the first group's mean), and the mean difference.
        const reveal = canvas.append("g").attr("class", "sr-difference-reveal");
        reveal.append("line")
          .attr("class", "sr-zero-guide")
          .attr("x1", g.dx(0)).attr("x2", g.dx(0))
          .attr("y1", g.rowY(0) - 22).attr("y2", g.differenceRowY - 26);
        reveal.append("line")
          .attr("class", "sr-zero-line")
          .attr("x1", g.dx(0)).attr("x2", g.dx(0))
          .attr("y1", g.differenceRowY - 26).attr("y2", g.differenceRowY + 26);
        reveal.append("text")
          .attr("class", "sr-zero-label")
          // Below the row, right of zero, level with the SD label (which is
          // centered on the mean difference, left of zero): clear of the
          // mean-difference label above.
          .attr("x", g.dx(0) + 6).attr("y", g.differenceRowY + SPAN_OFFSET + 16)
          .text(differenceOpts.zeroLabel);
        reveal.append("line")
          .attr("class", "sr-mean-line")
          .attr("stroke", SIGNAL_COLOR)
          .attr("x1", g.dx(stats.meanDifference)).attr("x2", g.dx(stats.meanDifference))
          .attr("y1", g.differenceRowY - MEAN_HALF_HEIGHT).attr("y2", g.differenceRowY + MEAN_HALF_HEIGHT);
        reveal.append("text")
          .attr("class", "sr-mean-label")
          .attr("fill", SIGNAL_COLOR)
          .attr("x", g.dx(stats.meanDifference)).attr("y", g.differenceRowY - MEAN_HALF_HEIGHT - 5)
          .attr("text-anchor", "middle")
          .text(differenceOpts.meanLabel);
      }

      canvas.append("g").attr("class", "sr-spread");
      canvas.append("g").attr("class", "sr-gap");
      canvas.append("g").attr("class", "sr-connectors");
      canvas.append("g").attr("class", "sr-dots");
      canvas.append("g").attr("class", "sr-difference-dots");
      canvas.append("g").attr("class", "sr-ghosts");
      state.lastStage = null;
    }

    function colorFor(d) {
      const byPerson = state.stage !== "scores" || opts.colorBy === "person";
      return byPerson ? d.personColor : d.groupColor;
    }

    function stageDescription() {
      if (opts.ariaLabel) return opts.ariaLabel;
      const names = groups.map((group) => group.name).join(" and ");
      if (state.stage === "differences") {
        return `${state.spread !== "none" ? `The difference scores have SD ${fmt(stats.sdDifference)}. ` : ""}` +
          `Each person's two scores, joined by a line, become one difference score (${groups[1].name} minus ${groups[0].name}). ` +
          `The difference scores sit in their own row on an axis with the same scale, with mean ${fmt(stats.meanDifference)}.`;
      }
      if (state.stage === "pairs") {
        return `Rows of scores for ${names}. Each person has one score in each row, joined by a line and shown in the same color.`;
      }
      return `Rows of scores for ${names}, one dot per score${state.means ? ", with each row's mean marked" : ""}${annotationDescription()}.`;
    }

    function annotationDescription() {
      const parts = [];
      if (state.meanGap && groups.length > 1) parts.push(`the gap between the means (${fmt(Math.abs(stats.means[1] - stats.means[0]))})`);
      if (state.spread === "sd") parts.push(`a span one SD either side of each mean (${stats.sds.map(fmt).join(" and ")})`);
      if (state.spread === "pooled") parts.push(`the pooled SD (${fmt(stats.pooledSd)})`);
      if (state.spread === "se") parts.push(`the standard error of the difference (${fmt(stats.seDifference)}) next to the difference itself`);
      return parts.length ? `; showing ${parts.join(", ")}` : "";
    }

    function dotTitle(d, rowName) {
      return d.label ? `${d.label}, ${rowName}: ${d.value}` : `${rowName}: ${d.value}`;
    }

    // Snap an interrupted slide to its end state. The tutorial runtime
    // cancels transitions right before applying the next step's action.
    function finishGhosts() {
      canvas.select(".sr-ghosts").selectAll("*").interrupt().remove();
      canvas.select(".sr-difference-dots").selectAll("circle").interrupt()
        .style("opacity", state.stage === "differences" ? 1 : 0);
    }

    function render(options) {
      options = options || {};
      const g = geometry;
      if (!g) return;
      const animate = bool(options.animate, true) && !prefersReducedMotion();
      const differencesStage = state.stage === "differences";
      const slide = animate && differencesStage && state.lastStage && state.lastStage !== "differences";
      const duration = animate ? 450 : 0;

      svg.select(".sr-title").text(stageDescription());
      finishGhosts();

      canvas.select(".sr-dots").selectAll("circle")
        .data(g.observations, (d) => d.key)
        .join((enter) => enter.append("circle")
          .attr("class", "sr-dot")
          .attr("r", DOT_RADIUS)
          .attr("cx", (d) => g.x(d.value))
          .attr("cy", (d) => d.y)
          .call((circle) => circle.append("title").text((d) => dotTitle(d, groups[d.groupIndex].name))))
        .attr("fill", colorFor)
        .interrupt()
        .transition().duration(duration)
        .style("opacity", differencesStage ? 0.22 : 1);

      const connectorsVisible = stats.paired && (state.stage !== "scores" || showConnectors);
      const connectorOpacity = differencesStage ? 0.18 : state.stage === "scores" ? 0.4 : 0.6;
      canvas.select(".sr-connectors").selectAll("path")
        .data(connectorsVisible ? g.pairs : [], (d) => d.index)
        .join(
          (enter) => enter.append("path")
            .attr("class", "sr-connector")
            .attr("d", (d) => `M${g.x(d.first.value)},${d.first.y}L${g.x(d.second.value)},${d.second.y}`)
            .attr("stroke", (d) => d.first.personColor)
            .style("opacity", animate ? 0 : connectorOpacity),
          (update) => update,
          (exit) => exit.interrupt().transition().duration(duration).style("opacity", 0).remove()
        )
        .interrupt()
        .transition().duration(duration)
        .style("opacity", connectorOpacity);

      canvas.select(".sr-means").interrupt().transition().duration(duration)
        .style("opacity", !state.means ? 0 : differencesStage ? 0.22 : 1);

      renderGap(duration, differencesStage);
      renderSpread(duration, differencesStage, slide);

      if (differenceOpts) {
        canvas.select(".sr-difference-skeleton").interrupt().transition().duration(duration)
          .style("opacity", differencesStage ? 1 : 0.3);
        canvas.select(".sr-difference-reveal").interrupt().transition().duration(duration)
          .style("opacity", differencesStage ? 1 : 0);
        canvas.select(".sr-difference-dots").selectAll("circle")
          .data(g.differencePoints, (d) => d.key)
          .join((enter) => enter.append("circle")
            .attr("class", "sr-dot")
            .attr("r", DOT_RADIUS)
            .attr("cx", (d) => g.dx(d.value))
            .attr("cy", (d) => d.y)
            .attr("fill", (d) => d.personColor)
            .call((circle) => circle.append("title").text((d) => dotTitle(d, differenceOpts.label))))
          .style("opacity", differencesStage && !slide ? 1 : 0);
        if (slide) slideToDifferences();
      }
      state.lastStage = state.stage;
    }

    // A bracket from the first mean to the second, drawn out when it
    // appears, labeled with the size of the difference.
    function renderGap(duration, differencesStage) {
      const g = geometry;
      const visible = state.meanGap && state.means && groups.length > 1 && !differencesStage;
      const y = g.gapY;
      const from = g.x(stats.means[0]);
      const to = groups.length > 1 ? g.x(stats.means[1]) : from;
      const label = `${opts.gapLabel || "difference between means"} = ${fmt(Math.abs(stats.means[1] - stats.means[0]))}`;
      const marker = canvas.select(".sr-gap").selectAll("g.sr-gap-marker")
        .data(visible ? [0] : [])
        .join(
          (enter) => {
            const group = enter.append("g").attr("class", "sr-gap-marker");
            group.append("line").attr("class", "sr-gap-cap-from")
              .attr("x1", from).attr("x2", from).attr("y1", y - 5).attr("y2", y + 5);
            group.append("line").attr("class", "sr-gap-span")
              .attr("x1", from).attr("x2", from).attr("y1", y).attr("y2", y);
            group.append("line").attr("class", "sr-gap-cap-to")
              .attr("x1", to).attr("x2", to).attr("y1", y - 5).attr("y2", y + 5)
              .style("opacity", 0);
            group.append("text").attr("text-anchor", "middle")
              .attr("x", (from + to) / 2).attr("y", y - 8)
              .text(label)
              .style("opacity", 0);
            return group;
          },
          (update) => update,
          (exit) => exit.interrupt().transition().duration(duration).style("opacity", 0).remove()
        );
      marker.select(".sr-gap-span").interrupt().transition().duration(duration).attr("x2", to);
      marker.select(".sr-gap-cap-to").interrupt().transition().delay(duration).duration(duration / 2).style("opacity", 1);
      marker.select("text").interrupt().transition().delay(duration).duration(duration / 2).style("opacity", 1);
    }

    // The spans to draw for the current spread setting, each with its end
    // points in pixels:
    //   sd      one +/-SD span under each row (and the difference row)
    //   pooled  with `middle`, one +/-pooled-SD span between the rows, under
    //           the difference bracket; otherwise every row's span takes the
    //           pooled SD
    //   se      with `middle`, the pooled span becomes a single segment, one
    //           standard error of the difference long, centered under the
    //           bracket, so the two lengths can be compared: their ratio is t
    function spanItems(differencesStage) {
      const g = geometry;
      const text = "var(--sfs-text, currentColor)";
      const merged = g.middle && groups.length === 2 && ["pooled", "se"].includes(state.spread);
      if (merged) {
        const center = (stats.means[0] + stats.means[1]) / 2;
        if (state.spread === "pooled") {
          return [{
            key: "pooled", color: NOISE_COLOR, opacity: 1, y: g.pooledY,
            left: g.x(center - stats.pooledSd), right: g.x(center + stats.pooledSd), center: g.x(center),
            label: `sₚ = ${fmt(stats.pooledSd)}`
          }];
        }
        // Centered under the difference bracket, so the two lengths line up.
        return [{
          key: "pooled", color: NOISE_COLOR, opacity: 1, y: g.pooledY,
          left: g.x(center - stats.seDifference / 2), right: g.x(center + stats.seDifference / 2), center: g.x(center),
          label: `SE = ${fmt(stats.seDifference)}`
        }];
      }
      const pooled = state.spread !== "sd";
      const items = groups.map((group, i) => {
        const sd = pooled ? stats.pooledSd : stats.sds[i];
        return {
          key: `g${i}`,
          color: GROUP_COLORS[i % GROUP_COLORS.length],
          opacity: differencesStage ? 0.22 : 1,
          y: g.rowY(i) + SPAN_OFFSET,
          left: g.x(stats.means[i] - sd), right: g.x(stats.means[i] + sd), center: g.x(stats.means[i]),
          label: `${pooled ? "sₚ" : "s"} = ${fmt(sd)}`
        };
      });
      if (differenceOpts && differencesStage && Number.isFinite(stats.sdDifference)) {
        items.push({
          key: "d", color: NOISE_COLOR, opacity: 1, y: g.differenceRowY + SPAN_OFFSET,
          left: g.dx(stats.meanDifference - stats.sdDifference),
          right: g.dx(stats.meanDifference + stats.sdDifference),
          center: g.dx(stats.meanDifference),
          label: `s = ${fmt(stats.sdDifference)}`
        });
      }
      return items;
    }

    // Draws the spans (the book's shared SD mark, span-marks.js) with their
    // values written beneath. New spans grow out from their centers, as in
    // Chapter 4. When the row spans give way to the merged pooled span, they
    // travel to it and fade, and the merged span appears where they meet.
    function renderSpread(duration, differencesStage, slide) {
      const g = geometry;
      // The difference row's span waits for the slide to finish.
      const differenceDelay = slide ? 400 + g.pairs.length * 140 + 1450 : 0;
      const items = state.spread === "none" ? [] : spanItems(differencesStage);
      const mergeTarget = items.find((item) => item.key === "pooled");
      const easeMove = (delay) => (selection) => selection.transition().delay(delay).duration(duration).ease(d3.easeCubicInOut);
      const entering = new Set();
      let merging = false;

      const spans = canvas.select(".sr-spread").selectAll("g.sr-span-group")
        .data(items, (d) => d.key)
        .join(
          (enter) => enter.append("g")
            .attr("class", "sr-span-group")
            .each(function(item) {
              entering.add(item.key);
              sfsSpanMarks.append(d3.select(this).append("g").attr("class", "sr-span"));
              d3.select(this).append("text").attr("class", "sr-span-label").attr("text-anchor", "middle");
            }),
          (update) => update,
          (exit) => exit.each(function() {
            const node = d3.select(this);
            node.interrupt();
            if (mergeTarget && duration > 0) {
              // Travel to the merged span, then fade.
              merging = true;
              node.select(".sr-span-label").interrupt().transition().duration(duration / 3).style("opacity", 0);
              sfsSpanMarks.set(node.select(".sr-span"), mergeTarget.left, mergeTarget.right, mergeTarget.y, { transition: easeMove(0) });
              node.transition().delay(duration).duration(duration / 2).style("opacity", 0).remove();
            } else {
              node.transition().duration(duration).style("opacity", 0).remove();
            }
          })
        );

      spans.each(function(item) {
        const node = d3.select(this);
        const span = node.select(".sr-span").attr("stroke", item.color);
        const isNew = entering.has(item.key) && duration > 0;
        const delay = item.key === "d" ? differenceDelay : merging && isNew ? duration : 0;
        if (isNew && !merging) {
          sfsSpanMarks.grow(span, item.center, item.left, item.right, item.y, { delay, duration });
        } else {
          sfsSpanMarks.set(span, item.left, item.right, item.y, {
            transition: duration > 0 && !isNew ? easeMove(delay) : null
          });
        }
        // Centered under the span, kept inside the figure.
        const halfWidth = item.label.length * 3.5;
        node.select(".sr-span-label")
          .attr("fill", item.color)
          .text(item.label)
          .interrupt()
          .transition().delay(isNew ? 0 : delay).duration(isNew ? 0 : duration).ease(d3.easeCubicInOut)
          .attr("x", Math.max(halfWidth + 2, Math.min(item.center, g.width - halfWidth - 2)))
          .attr("y", item.y + 16);
        if (isNew) node.style("opacity", 0);
        node.interrupt()
          .transition().delay(delay).duration(isNew ? duration / 2 : duration)
          .style("opacity", item.opacity);
      });
    }

    // Each pair's line slides sideways until its first score sits on the
    // zero guide; its second score then marks the difference. The line drops
    // into the difference row and leaves that difference dot behind.
    function slideToDifferences() {
      const g = geometry;
      const stagger = 140;
      const ghosts = canvas.select(".sr-ghosts").selectAll("g.sr-ghost")
        .data(g.pairs, (d) => d.index)
        .join((enter) => {
          const ghost = enter.append("g").attr("class", "sr-ghost");
          ghost.append("line").attr("class", "sr-ghost-line");
          ghost.append("circle").attr("class", "sr-dot sr-ghost-first").attr("r", DOT_RADIUS);
          ghost.append("circle").attr("class", "sr-dot sr-ghost-second").attr("r", DOT_RADIUS);
          return ghost;
        });

      ghosts.each(function(pair, i) {
        const ghost = d3.select(this);
        const color = pair.first.personColor;
        const shift = g.dx(0) - g.x(pair.first.value);
        const firstX = g.dx(0);
        const secondX = g.x(pair.second.value) + shift;
        const end = { x: g.dx(pair.difference.value), y: pair.difference.y };
        const delay = 350 + i * stagger;

        ghost.select("line")
          .attr("stroke", color)
          .attr("x1", g.x(pair.first.value)).attr("y1", pair.first.y)
          .attr("x2", g.x(pair.second.value)).attr("y2", pair.second.y)
          .transition().delay(delay).duration(750).ease(d3.easeCubicInOut)
          .attr("x1", firstX).attr("x2", secondX)
          .transition().duration(700).ease(d3.easeCubicInOut)
          .attr("y1", end.y).attr("x2", end.x).attr("y2", end.y)
          .transition().duration(350)
          .style("opacity", 0);
        ghost.select(".sr-ghost-first")
          .attr("fill", color)
          .attr("cx", g.x(pair.first.value)).attr("cy", pair.first.y)
          .transition().delay(delay).duration(750).ease(d3.easeCubicInOut)
          .attr("cx", firstX)
          .transition().duration(700).ease(d3.easeCubicInOut)
          .attr("cy", end.y)
          .transition().duration(350)
          .style("opacity", 0);
        ghost.select(".sr-ghost-second")
          .attr("fill", color)
          .attr("cx", g.x(pair.second.value)).attr("cy", pair.second.y)
          .transition().delay(delay).duration(750).ease(d3.easeCubicInOut)
          .attr("cx", secondX)
          .transition().duration(700).ease(d3.easeCubicInOut)
          .attr("cx", end.x).attr("cy", end.y)
          .on("end", () => {
            canvas.select(".sr-difference-dots").selectAll("circle")
              .filter((d) => d.index === pair.index)
              .style("opacity", 1);
            ghost.remove();
          });
      });
    }

    function applyTutorialAction(action) {
      if (!action || typeof action !== "object") return;
      if (action.stage !== undefined) state.stage = allowedStage(action.stage);
      if (action.means !== undefined) state.means = meansAvailable && bool(action.means, state.means);
      const meanGap = action.meanGap !== undefined ? action.meanGap : action["mean-gap"];
      if (meanGap !== undefined) state.meanGap = bool(meanGap, state.meanGap);
      if (action.spread !== undefined) state.spread = normalizeSpread(action.spread);
      render({ animate: action.animate !== false });
    }

    rootNode.addEventListener("sfs-if:cancel-transitions", finishGhosts);

    rootNode.scoreRows = {
      setStage(stage, animate) { applyTutorialAction({ stage, animate }); },
      getStatistics() { return { ...stats, differences: stats.differences.slice() }; },
      applyTutorialAction
    };

    build(MAX_WIDTH);
    render({ animate: false });

    const api = window.interactiveFigure;
    if (api && typeof api.observeResponsiveLayout === "function") {
      api.observeResponsiveLayout({
        root: rootNode,
        minimumWidth: MIN_WIDTH,
        maximumWidth: MAX_WIDTH,
        widthStep: 10,
        onLayout(layout) {
          if (geometry && geometry.width === layout.width) return;
          build(layout.width);
          render({ animate: false });
        }
      });
    }

    // Only tutorials need the wrapper (it carries their step actions). The
    // figure has no controls of its own, and tutorials hide the drawer.
    if (api && tutorial) {
      api.wrap({
        root: rootNode,
        controls: controls.node(),
        label: "score rows",
        placement: "callout",
        applyAction: applyTutorialAction,
        startOpen: false
      });
    }

    return rootNode;
  };
})();
