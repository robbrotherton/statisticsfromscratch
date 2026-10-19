// Rows of scores on a shared axis, one row per condition: the display
// Chapters 11–13 use to show who contributed which score.
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
//   meanGap      the bracket (effect color) from the null value to the
//                estimate: the numerator of t
//   spread       "sd": each row's mean +/- SD span (Chapter 4's mark, from
//                span-marks.js) with a center cap, its value on the wing
//                pointing toward the null value; "pooled" (two samples):
//                copies of the two inner wings peel off and merge into one
//                pooled-SD segment; "se": the standard error. The pooled SD
//                and SE (noise color) start at the null value, like the
//                bracket, so the two lengths compare directly and t reads
//                as "how many SEs from the null value". The SD spans stay in
//                place throughout.
// In the differences stage the score rows fade and the bracket, SD span and
// SE apply to the difference row (null value 0, estimate M_D).
//   tScale       the last step of the t grammar: the axis relabels in t units
//                (0 at the null value, one unit per SE; the SE already starts
//                there and becomes "1 SE"), and the null-value and estimate
//                lines are relabeled with their t values. The dots and SD spans
//                fade, since they aren't on the t scale.
//
// One-sample mode (Chapter 11): a single group plus `reference` (the null
// value). The bracket runs from the reference value to the mean, and "se"
// draws the standard error of the mean, s / sqrt(n), centered under it.
// `dotRadius` shrinks the dots for larger samples, and the `zoom` action
// animates the axis to `zoomDomain`, so a small difference and SE that are
// hard to see at the scale of individual scores can be compared.
//
// The pure helpers (statistics, stacking, person colors, difference domain)
// are exposed on window.sfsScoreRows so other figures and the tests can share
// them.
(function() {
  "use strict";

  const STAGES = ["scores", "pairs", "differences"];
  // Data rows use the ordinary series colors (blue is the book's data
  // color). Series 4 (vermilion) is skipped: too close to the red of the SE.
  const GROUP_COLORS = [
    "var(--graph-series-1, #0072b2)",
    "var(--graph-series-2, #e69f00)",
    "var(--graph-series-3, #009e73)"
  ];
  const TABLEAU10_FALLBACK = [
    "#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f",
    "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab"
  ];
  // Semantic colors shared with the Chapter 14 ANOVA explorer: the
  // difference (the numerator; between-groups signal) is the effect color,
  // the purple of power and the alternative distribution in Chapter 9; the
  // pooled SD and standard error are within-groups noise (current red).
  const SIGNAL_COLOR = "var(--sfs-effect-color, #7654b5)";
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
      sdDifference: differences.length > 1 ? d3.deviation(differences) : null,
      // Standard error of a single sample's mean, s / sqrt(n).
      seMean: groups.length === 1 && groups[0].values.length > 1
        ? sds[0] / Math.sqrt(groups[0].values.length)
        : null
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
    // `upward` stacks only above the row (0, -1, -2, ...) instead of
    // alternating below and above.
    const levels = [0];
    for (let k = 1; k <= 20; k += 1) {
      if (options.upward) levels.push(-k);
      else levels.push(-k, k);
    }
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

  let clipCount = 0;

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
      .sfs-score-rows .sr-dot { stroke: var(--bs-body-bg, #fff); stroke-width: var(--sr-dot-stroke, 2px); }
      .sfs-score-rows .sr-connector { fill: none; stroke-width: 2; stroke-linecap: round; }
      .sfs-score-rows .sr-mean-line { stroke-width: 2.5; stroke-dasharray: 5 4; }
      .sfs-score-rows .sr-mean-label { font-size: var(--sfs-figure-small-size, 0.75rem); font-weight: 650; }
      .sfs-score-rows .sr-zero-line { stroke: var(--sfs-muted, #68727d); stroke-width: 1.5; }
      .sfs-score-rows .sr-zero-guide { stroke: var(--sfs-muted, #68727d); stroke-width: 1.25; stroke-dasharray: 2 4; }
      .sfs-score-rows .sr-zero-label { fill: var(--sfs-muted, #68727d); font-size: var(--sfs-figure-small-size, 0.75rem); }
      .sfs-score-rows .sr-difference-color { fill: var(--sfs-text, currentColor); }
      .sfs-score-rows .sr-ghost-line { fill: none; stroke-width: 2; stroke-linecap: round; }
      .sfs-score-rows .sr-ghosts { pointer-events: none; }
      .sfs-score-rows .sr-span,
      .sfs-score-rows .sr-den-span { stroke-width: 2.2; }
      .sfs-score-rows .sr-reference-line { stroke: var(--sfs-null-color, currentColor); stroke-width: 2; stroke-dasharray: 3 3; }
      .sfs-score-rows .sr-halo { stroke: var(--bs-body-bg, #fff); stroke-width: 5; opacity: 0.85; }
      .sfs-score-rows .sr-reference-label { fill: var(--sfs-null-color, currentColor); font-size: var(--sfs-figure-small-size, 0.75rem); font-weight: 650; }
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
    const referenceValue = Number(opts.reference && typeof opts.reference === "object" ? opts.reference.value : opts.reference);
    const reference = groups.length === 1 && Number.isFinite(referenceValue)
      ? { value: referenceValue, label: (opts.reference && opts.reference.label) || `reference = ${referenceValue}` }
      : null;
    const dotRadius = finite(opts.dotRadius, DOT_RADIUS);
    // "ties": dots stay on the row line and stack only on exactly equal
    // values, overlapping otherwise (their outlines tell them apart). Tied
    // dots rise half a diameter each, upward only, so they read as a small
    // pile on one value rather than stray marks.
    // Default: nearby dots are dodged so none overlap.
    const stackTiesOnly = String(opts.stack || "").toLowerCase() === "ties";
    // Width of the background-colored outline that separates touching dots.
    const dotStroke = finite(opts.dotStroke, 2);
    const zoomDomain = Array.isArray(opts.zoomDomain) && opts.zoomDomain.length === 2 &&
      opts.zoomDomain.every((value) => Number.isFinite(Number(value)))
      ? opts.zoomDomain.map(Number)
      : null;
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
      spread: normalizeSpread(opts.spread),
      zoom: false,
      tScale: false,
      lastTScale: false
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
      .style("--sr-max-width", opts.maxWidth || null)
      .style("--sr-dot-stroke", `${dotStroke}px`);
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
      const x = d3.scaleLinear().domain(xDomain).range([plot.left, plot.right]);
      const xZoom = zoomDomain ? d3.scaleLinear().domain(zoomDomain).range([plot.left, plot.right]) : null;
      const stackStep = stackTiesOnly ? dotRadius : dotRadius * 2 + 1.5;
      const rowOffsets = groups.map((group) => stackOffsets(group.values, {
        position: x,
        minGap: stackTiesOnly ? 1e-6 : dotRadius * 2 + 1,
        step: stackStep,
        upward: stackTiesOnly
      }));
      // How far the stacked dots reach above and below their row.
      const above = d3.max(rowOffsets, (offsets) => -d3.min(offsets)) || 0;
      const below = d3.max(rowOffsets, (offsets) => d3.max(offsets)) || 0;
      const meanHalf = Math.max(MEAN_HALF_HEIGHT, Math.max(above, below) + dotRadius + 4);
      const spanOffset = reference ? below + dotRadius + 14 : SPAN_OFFSET;
      const rowGap = middle ? 152 : (narrow ? 64 : 72) + (roomy ? 12 : 0);
      const firstRow = meansAvailable
        ? 24 + Math.max(16, above + dotRadius)
        : Math.max(26, above + dotRadius + 10);
      const rowY = (i) => firstRow + i * rowGap;
      const axisClearance = roomy ? 52 : 32;
      // One-sample mode stacks the SD span, the bracket and the SE under the row.
      const oneSampleGapY = rowY(0) + spanOffset + 48;
      const oneSampleSeY = oneSampleGapY + 28;
      const axisY = reference ? oneSampleSeY + 34 : rowY(groups.length - 1) + axisClearance;
      const differenceRowY = axisY + 100;
      // Tutorials can draw the bracket and SE under the difference row.
      const dGapY = differenceRowY + 62;
      const dDenY = differenceRowY + 88;
      const differenceAxisY = differenceRowY + (roomy ? 124 : axisClearance);
      const height = differenceOpts
        ? differenceAxisY + 52
        : showAxis ? axisY + 52 : rowY(groups.length - 1) + 30;
      const dx = differenceOpts
        ? d3.scaleLinear().domain(differenceDomain(stats.differences, xDomain, stats.means[0])).range([plot.left, plot.right])
        : null;
      const ticks = narrow ? 4 : 8;

      const observations = groups.flatMap((group, groupIndex) => {
        const offsets = rowOffsets[groupIndex];
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

      const gapY = reference ? oneSampleGapY : middle ? rowY(0) + 62 : rowY(0) + rowGap / 2;
      const pooledY = reference ? oneSampleSeY : rowY(0) + 92;
      return { width, height, plot, rowGap, rowY, gapY, pooledY, middle, axisY, differenceRowY, differenceAxisY, dGapY, dDenY, x, xZoom, dx, ticks,
        narrow,
        meanHalf, spanOffset,
        observations, differencePoints, pairs };
    }

    // The score scale currently in use: zoomed or full.
    function xs() {
      return state.zoom && geometry.xZoom ? geometry.xZoom : geometry.x;
    }

    function scoreAxis(scale) {
      const zoomed = scale !== geometry.x;
      return d3.axisBottom(scale)
        .tickValues(!zoomed && Array.isArray(opts.tickValues) ? opts.tickValues : null)
        .ticks(geometry.ticks).tickSizeOuter(0)
        .tickFormat(tickFormat(scale, geometry.ticks));
    }

    // The same pixels, labeled in t units: (value - null value) / SE.
    function tAxis(scale, parts) {
      const [d0, d1] = scale.domain();
      const tScaleLinear = d3.scaleLinear()
        .domain([(d0 - parts.nullValue) / parts.se, (d1 - parts.nullValue) / parts.se])
        .range(scale.range());
      return d3.axisBottom(tScaleLinear)
        .ticks(geometry.ticks).tickSizeOuter(0)
        .tickFormat(tickFormat(tScaleLinear, geometry.ticks));
    }

    function tValue(parts) {
      return (parts.estimate - parts.nullValue) / parts.se;
    }

    // Swap an axis between score units and t units, fading so the tick
    // labels don't appear to slide between unrelated scales.
    function updateAxis(axis, generator, label, duration, swapped) {
      if (axis.empty()) return;
      if (swapped && duration > 0) {
        axis.interrupt().style("opacity", 0).call(generator)
          .transition().duration(duration).style("opacity", 1);
      } else if (duration > 0) {
        axis.interrupt().style("opacity", 1).transition().duration(duration).ease(d3.easeCubicInOut).call(generator);
      } else {
        axis.interrupt().style("opacity", 1).call(generator);
      }
      axis.select(".sr-axis-label").text(label);
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

      // Clip regions, so marks sliding off the axis during a zoom (dots, SD
      // spans, outgoing tick labels) stay inside the figure. Data marks stop
      // at the plot's edges; axes get a little extra room for end labels.
      clipCount += 1;
      const clips = { data: `sr-clip-data-${clipCount}`, axis: `sr-clip-axis-${clipCount}` };
      const defs = canvas.append("defs");
      defs.append("clipPath").attr("id", clips.data).append("rect")
        .attr("x", g.plot.left - 2).attr("y", 0)
        .attr("width", g.plot.right - g.plot.left + 4).attr("height", g.height);
      defs.append("clipPath").attr("id", clips.axis).append("rect")
        .attr("x", g.plot.left - 24).attr("y", 0)
        .attr("width", g.plot.right - g.plot.left + 48).attr("height", g.height);


      if (showAxis) {
        const axis = canvas.append("g").attr("clip-path", `url(#${clips.axis})`).append("g")
          .attr("class", "sr-axis sr-score-axis")
          .attr("transform", `translate(0,${g.axisY})`)
          .call(scoreAxis(xs()));
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

      if (reference) {
        const ref = canvas.append("g").attr("class", "sr-reference");
        // A background-colored halo keeps the dotted line visible where dots
        // pile up on it.
        ref.append("line")
          .attr("class", "sr-halo")
          .attr("y1", g.rowY(0) - g.meanHalf).attr("y2", g.rowY(0) + g.meanHalf);
        ref.append("line")
          .attr("class", "sr-reference-line")
          .attr("y1", g.rowY(0) - g.meanHalf).attr("y2", g.rowY(0) + g.meanHalf);
        ref.append("text")
          .attr("class", "sr-reference-label")
          .attr("y", g.rowY(0) - g.meanHalf - 5)
          .text(reference.label);
      }

      // Positioned in render, so they can follow a zoom.
      const means = canvas.append("g").attr("class", "sr-means");
      if (meansAvailable) {
        const mean = means.selectAll("g").data(stats.means).join("g");
        mean.append("line")
          .attr("class", "sr-mean-line")
          .attr("stroke", (d, i) => GROUP_COLORS[i % GROUP_COLORS.length])
          .attr("y1", (d, i) => g.rowY(i) - g.meanHalf).attr("y2", (d, i) => g.rowY(i) + g.meanHalf);
        mean.append("text")
          .attr("class", "sr-mean-label")
          .attr("fill", (d, i) => GROUP_COLORS[i % GROUP_COLORS.length])
          .attr("y", (d, i) => g.rowY(i) - g.meanHalf - 5)
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
        const differenceAxis = skeleton.append("g").attr("clip-path", `url(#${clips.axis})`).append("g")
          .attr("class", "sr-axis sr-difference-axis")
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
        // On narrow screens the zero line and the axis's 0 say it; the label
        // would collide with the SD label.
        if (!g.narrow) reveal.append("text")
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
          .attr("class", "sr-mean-label sr-d-mean-label")
          .attr("fill", SIGNAL_COLOR)
          .attr("x", g.dx(stats.meanDifference)).attr("y", g.differenceRowY - MEAN_HALF_HEIGHT - 5)
          .attr("text-anchor", "middle")
          .text(differenceOpts.meanLabel);
      }

      const clipped = (layer) => layer.attr("clip-path", `url(#${clips.data})`);
      clipped(canvas.append("g").attr("class", "sr-spread"));
      canvas.append("g").attr("class", "sr-denominator");
      canvas.append("g").attr("class", "sr-gap");
      clipped(canvas.append("g").attr("class", "sr-connectors"));
      clipped(canvas.append("g").attr("class", "sr-dots"));
      clipped(canvas.append("g").attr("class", "sr-difference-dots"));
      canvas.append("g").attr("class", "sr-ghosts");
      // Reference and mean lines sit on top of the dots, under the ghosts.
      state.lastTScale = false;
      canvas.select(".sr-reference").raise();
      canvas.select(".sr-means").raise();
      canvas.select(".sr-ghosts").raise();
      state.lastStage = null;
    }

    // Means, reference value and axis follow the current scale. With a
    // reference value, the two labels sit on either side of their lines so
    // they don't collide when the lines are close.
    function positionMarks(duration) {
      const scale = xs();
      const move = (selection) => selection.interrupt().transition().duration(duration).ease(d3.easeCubicInOut);
      const meanAboveReference = reference ? stats.means[0] >= reference.value : true;
      const differencesStage = state.stage === "differences";
      const parts = tParts(differencesStage);
      const tMode = state.tScale && Boolean(parts) && Number.isFinite(parts.se);
      const swapped = state.tScale !== state.lastTScale;
      const tLabel = (value) => `t = ${fmt((value - parts.nullValue) / parts.se)}`;
      canvas.select(".sr-means").selectAll("g").each(function(mean, i) {
        const node = d3.select(this);
        move(node.select("line")).attr("x1", scale(mean)).attr("x2", scale(mean));
        node.select("text").attr("text-anchor", reference ? (meanAboveReference ? "start" : "end") : "middle");
        move(node.select("text")).attr("x", scale(mean) + (reference ? (meanAboveReference ? 4 : -4) : 0));
        node.select("text").text(tMode && !differencesStage ? tLabel(mean) : opts.meanLabel || "mean");
      });
      if (reference) {
        const ref = canvas.select(".sr-reference");
        move(ref.selectAll("line")).attr("x1", scale(reference.value)).attr("x2", scale(reference.value));
        ref.select("text").attr("text-anchor", meanAboveReference ? "end" : "start");
        move(ref.select("text")).attr("x", scale(reference.value) + (meanAboveReference ? -4 : 4));
        ref.select("text").text(tMode ? "t = 0" : reference.label);
      }
      const scoreTMode = tMode && !differencesStage;
      updateAxis(canvas.select(".sr-score-axis"),
        scoreTMode ? tAxis(scale, parts) : scoreAxis(scale),
        scoreTMode ? (geometry.narrow ? "t (standard errors)" : opts.tAxisLabel || "t (standard errors from the null value)") : (opts.axisLabel || "Score"),
        duration, swapped);
      if (differenceOpts) {
        const dTMode = tMode && differencesStage;
        updateAxis(canvas.select(".sr-difference-axis"),
          dTMode ? tAxis(geometry.dx, parts) : d3.axisBottom(geometry.dx).ticks(geometry.ticks).tickSizeOuter(0).tickFormat(tickFormat(geometry.dx, geometry.ticks)),
          dTMode ? (differenceOpts.tAxisLabel || "t (standard errors from 0)") : differenceOpts.axisLabel,
          duration, swapped);
        canvas.select(".sr-d-mean-label").text(dTMode ? tLabel(stats.meanDifference) : differenceOpts.meanLabel);
        canvas.select(".sr-zero-label").text(dTMode ? "t = 0" : differenceOpts.zeroLabel);
      }
      state.lastTScale = state.tScale;
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
          `The difference scores have mean ${fmt(stats.meanDifference)}${annotationDescription()}.`;
      }
      if (state.stage === "pairs") {
        return `Rows of scores for ${names}. Each person has one score in each row, joined by a line and shown in the same color.`;
      }
      return `Rows of scores for ${names}, one dot per score${state.means ? ", with each row's mean marked" : ""}${annotationDescription()}.`;
    }

    function annotationDescription() {
      const parts = [];
      if (state.meanGap && reference) parts.push(`the gap between the mean and ${reference.label} (${fmt(Math.abs(stats.means[0] - reference.value))})`);
      if (state.meanGap && groups.length > 1 && state.stage !== "differences") parts.push(`the gap between the means (${fmt(Math.abs(stats.means[1] - stats.means[0]))})`);
      if (state.spread === "sd" && state.stage !== "differences") parts.push(`a span one SD either side of each mean (${stats.sds.map(fmt).join(" and ")})`);
      if (state.spread === "pooled") parts.push(`the pooled SD (${fmt(stats.pooledSd)})`);
      if (state.spread === "se" && reference) parts.push(`the standard error of the mean (${fmt(stats.seMean)}) under that gap`);
      if (state.zoom) parts.push("zoomed in on the gap");
      if (state.tScale) parts.push("the axis relabeled in t units, with the null value at 0 and one unit per standard error");
      if (state.spread === "se" && !reference) {
        const se = state.stage === "differences"
          ? stats.sdDifference / Math.sqrt(stats.differences.length) : stats.seDifference;
        parts.push(`the standard error of the difference (${fmt(se)}) next to the difference itself`);
      }
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
        .style("opacity", state.stage === "differences" && !state.tScale ? 1 : 0);
    }

    // Named peel tweens run on the span group, while ordinary transitions
    // run on its children. Cancel both before a new action can reposition
    // them; otherwise an old tween can overwrite the new step's geometry.
    function cancelTransitions() {
      canvas.selectAll("*").interrupt().interrupt("peel");
      finishGhosts();
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
      cancelTransitions();

      canvas.select(".sr-dots").selectAll("circle")
        .data(g.observations, (d) => d.key)
        .join((enter) => enter.append("circle")
          .attr("class", "sr-dot")
          .attr("r", dotRadius)
          .attr("cx", (d) => xs()(d.value))
          .attr("cy", (d) => d.y)
          .call((circle) => circle.append("title").text((d) => dotTitle(d, groups[d.groupIndex].name))))
        // Higher dots first, so a pile of tied scores sits behind the dot on
        // the line rather than in front of it.
        .sort((a, b) => a.y - b.y)
        .attr("fill", colorFor)
        .interrupt()
        .transition().duration(duration)
        .attr("cx", (d) => xs()(d.value))
        // Zoomed in, most scores fall off the axis: they have done their job.
        .style("opacity", state.zoom || state.tScale ? 0 : differencesStage ? 0.22 : 1);

      positionMarks(duration);

      const connectorsVisible = stats.paired && (state.stage !== "scores" || showConnectors);
      const connectorOpacity = state.tScale ? 0 : differencesStage ? 0.18 : state.stage === "scores" ? 0.4 : 0.6;
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
      renderSdSpans(duration, differencesStage, slide);
      renderDenominator(duration, differencesStage);

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
          .style("opacity", differencesStage && !slide && !state.tScale ? 1 : 0);
        if (slide) slideToDifferences();
      }
      state.lastStage = state.stage;
    }

    // The visual grammar of a t statistic, shared by Chapters 11-13:
    //   - the bracket (effect color) runs from the null value to the estimate:
    //     mu0 -> M (one sample), M1 -> M2 (two samples), 0 -> M_D (differences);
    //   - each row's spread is Chapter 4's mean +/- SD span, with a center cap
    //     at the mean and its value written on the wing that points toward the
    //     null value;
    //   - the denominator (noise color) is a single segment starting at the
    //     null value and pointing toward the estimate, so it shares its start
    //     with the bracket: their lengths compare directly, and the ratio is t.
    function tParts(differencesStage) {
      const g = geometry;
      if (differencesStage && differenceOpts) {
        return {
          scale: g.dx, nullValue: 0, estimate: stats.meanDifference,
          gapY: g.dGapY, denY: g.dDenY,
          se: stats.sdDifference / Math.sqrt(stats.differences.length),
          gapLabel: differenceOpts.gapLabel || "difference from 0"
        };
      }
      if (reference) {
        return {
          scale: xs(), nullValue: reference.value, estimate: stats.means[0],
          gapY: g.gapY, denY: g.pooledY, se: stats.seMean,
          gapLabel: opts.gapLabel || "difference from reference"
        };
      }
      if (groups.length > 1) {
        return {
          scale: xs(), nullValue: stats.means[0], estimate: stats.means[1],
          gapY: g.gapY, denY: g.pooledY, se: stats.seDifference,
          gapLabel: opts.gapLabel || (g.narrow ? "difference" : "difference between means")
        };
      }
      return null;
    }

    // The bracket, drawn out from the null value when it appears.
    function renderGap(duration, differencesStage) {
      const parts = tParts(differencesStage);
      const scoreRows = !differencesStage;
      const visible = Boolean(parts) && state.meanGap && (scoreRows ? state.means : true);
      const from = parts ? parts.scale(parts.nullValue) : 0;
      const to = parts ? parts.scale(parts.estimate) : 0;
      const y = parts ? parts.gapY : 0;
      const tMode = state.tScale && parts && Number.isFinite(parts.se);
      const label = !parts ? ""
        : tMode ? `${parts.gapLabel} = ${fmt(tValue(parts))} SE`
        : `${parts.gapLabel} = ${fmt(parts.estimate - parts.nullValue)}`;
      const marker = canvas.select(".sr-gap").selectAll("g.sr-gap-marker")
        .data(visible ? [differencesStage ? "d" : "rows"] : [], (d) => d)
        .join(
          (enter) => {
            const group = enter.append("g").attr("class", "sr-gap-marker");
            group.append("line").attr("class", "sr-gap-cap-from")
              .attr("x1", from).attr("x2", from).attr("y1", y - 5).attr("y2", y + 5);
            group.append("line").attr("class", "sr-gap-span")
              .attr("x1", from).attr("x2", from).attr("y1", y).attr("y2", y);
            group.append("line").attr("class", "sr-gap-cap-to")
              .attr("x1", from).attr("x2", from).attr("y1", y - 5).attr("y2", y + 5)
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
      marker.style("opacity", 1);
      const move = (selection) => selection.interrupt().transition().duration(duration).ease(d3.easeCubicInOut);
      move(marker.select(".sr-gap-span")).attr("x1", from).attr("x2", to);
      move(marker.select(".sr-gap-cap-from")).attr("x1", from).attr("x2", from);
      move(marker.select(".sr-gap-cap-to")).attr("x1", to).attr("x2", to).style("opacity", 1);
      move(marker.select("text")).attr("x", (from + to) / 2).style("opacity", 1);
      marker.select("text").text(label);
    }

    // Each row's mean +/- SD span. `wingTarget` is the value the labeled
    // wing points toward: the null value, or the other sample's mean.
    function sdSpans(differencesStage) {
      const g = geometry;
      const scale = xs();
      const rows = groups.map((group, i) => {
        const mean = stats.means[i];
        const target = reference ? reference.value
          : groups.length > 1 ? stats.means[i === 0 ? 1 : 0] : mean + 1;
        return {
          key: `g${i}`, scale, mean, sd: stats.sds[i], target,
          y: g.rowY(i) + g.spanOffset,
          color: GROUP_COLORS[i % GROUP_COLORS.length],
          opacity: state.zoom || state.tScale ? 0 : differencesStage ? 0.22 : 1
        };
      });
      if (differencesStage && differenceOpts && Number.isFinite(stats.sdDifference)) {
        rows.push({
          key: "d", scale: g.dx, mean: stats.meanDifference, sd: stats.sdDifference, target: 0,
          y: g.differenceRowY + SPAN_OFFSET,
          color: "var(--sfs-text, currentColor)", opacity: state.tScale ? 0 : 1
        });
      }
      return rows.map((row) => {
        const direction = row.target >= row.mean ? 1 : -1;
        return Object.assign(row, {
          left: row.scale(row.mean - row.sd),
          right: row.scale(row.mean + row.sd),
          center: row.scale(row.mean),
          wing: [row.scale(row.mean), row.scale(row.mean + direction * row.sd)],
          label: `s = ${fmt(row.sd)}`
        });
      });
    }

    function renderSdSpans(duration, differencesStage, slide) {
      const g = geometry;
      const differenceDelay = slide ? 400 + g.pairs.length * 140 + 1450 : 0;
      const items = state.spread === "none" ? [] : sdSpans(differencesStage);
      const entering = new Set();
      const spans = canvas.select(".sr-spread").selectAll("g.sr-span-group")
        .data(items, (d) => d.key)
        .join(
          (enter) => enter.append("g")
            .attr("class", "sr-span-group")
            .each(function(item) {
              entering.add(item.key);
              sfsSpanMarks.append(d3.select(this).append("g").attr("class", "sr-span"), { center: true });
              d3.select(this).append("text").attr("class", "sr-span-label").attr("text-anchor", "middle");
            }),
          (update) => update,
          (exit) => exit.interrupt().transition().duration(duration).style("opacity", 0).remove()
        );
      spans.each(function(item) {
        const node = d3.select(this);
        const span = node.select(".sr-span").attr("stroke", item.color);
        const isNew = entering.has(item.key) && duration > 0;
        const delay = item.key === "d" ? differenceDelay : 0;
        if (isNew) {
          sfsSpanMarks.grow(span, item.center, item.left, item.right, item.y, { delay, duration });
          span.select(".sfs-span-mid").attr("x1", item.center).attr("x2", item.center);
        } else {
          sfsSpanMarks.set(span, item.left, item.right, item.y, {
            center: item.center,
            transition: duration > 0
              ? (selection) => selection.transition().delay(delay).duration(duration).ease(d3.easeCubicInOut)
              : null
          });
        }
        // The value sits under the wing that points toward the null value.
        node.select(".sr-span-label")
          .attr("fill", item.color)
          .text(item.label)
          .interrupt()
          .transition().delay(isNew ? 0 : delay).duration(isNew ? 0 : duration).ease(d3.easeCubicInOut)
          .attr("x", (item.wing[0] + item.wing[1]) / 2)
          .attr("y", item.y + 16);
        if (isNew) node.style("opacity", 0);
        node.interrupt()
          .transition().delay(delay).duration(isNew ? duration / 2 : duration)
          .style("opacity", item.opacity);
      });
    }

    // The denominator segment: the pooled SD (two samples) or the standard
    // error, starting at the null value and pointing toward the estimate.
    function denominatorTarget(differencesStage) {
      const parts = tParts(differencesStage);
      if (!parts) return null;
      let length = null;
      let label = "";
      if (state.spread === "pooled" && groups.length > 1 && !differencesStage) {
        length = stats.pooledSd;
        label = `sₚ = ${fmt(stats.pooledSd)}`;
      } else if (state.spread === "se") {
        length = parts.se;
        label = `SE = ${fmt(parts.se)}`;
      }
      if (!Number.isFinite(length)) return null;
      // The denominator starts at the null value and points toward the
      // estimate, like the bracket: the SE is how far a mean typically lands
      // from the null value by chance. On the t scale nothing moves; it just
      // becomes one unit.
      const direction = parts.estimate >= parts.nullValue ? 1 : -1;
      const anchor = parts.scale(parts.nullValue);
      const end = parts.scale(parts.nullValue + direction * length);
      if (state.tScale && state.spread === "se") label = "1 SE";
      return { x1: Math.min(anchor, end), x2: Math.max(anchor, end), y: parts.denY, label };
    }

    // Where the denominator comes from: a copy of each relevant SD wing.
    function denominatorSources(differencesStage) {
      return sdSpans(differencesStage)
        .filter((item) => differencesStage ? item.key === "d" : item.key !== "d")
        .map((item) => ({
          x1: Math.min(item.wing[0], item.wing[1]),
          x2: Math.max(item.wing[0], item.wing[1]),
          y: item.y
        }));
    }

    // Moves a span group through three phases in one transition: fade in
    // where it starts, drop to the target height, then take the target's
    // length. One tween, so a later move can't cancel a pending phase.
    function peel(group, from, to, duration, onEnd) {
      const lines = {
        main: group.select(".sfs-span-line"),
        caps: group.selectAll(".sfs-span-cap")
      };
      const cap = sfsSpanMarks.CAP_HEIGHT / 2;
      const place = (x1, x2, y) => {
        lines.main.attr("x1", x1).attr("x2", x2).attr("y1", y).attr("y2", y);
        lines.caps.each(function(d, i) {
          const x = i === 0 ? x1 : x2;
          d3.select(this).attr("x1", x).attr("x2", x).attr("y1", y - cap).attr("y2", y + cap);
        });
      };
      place(from.x1, from.x2, from.y);
      const phase = (t, start, end) => d3.easeCubicInOut(Math.max(0, Math.min(1, (t - start) / (end - start))));
      group.style("opacity", 0)
        .transition("peel").duration(duration).ease(d3.easeLinear)
        .tween("peel", () => (t) => {
          group.style("opacity", Math.min(1, t / 0.15));
          const drop = phase(t, 0.2, 0.55);
          const shape = phase(t, 0.6, 1);
          place(
            from.x1 + (to.x1 - from.x1) * shape,
            from.x2 + (to.x2 - from.x2) * shape,
            from.y + (to.y - from.y) * drop
          );
        })
        .on("end", () => { if (onEnd) onEnd(); });
    }

    function renderDenominator(duration, differencesStage) {
      const layer = canvas.select(".sr-denominator");
      layer.selectAll(".sr-den-copy").remove();
      const target = denominatorTarget(differencesStage);
      const existing = layer.select("g.sr-den");
      if (!target) {
        if (!existing.empty()) existing.transition().duration(duration).style("opacity", 0).remove();
        return;
      }
      const label = (group) => group.select("text")
        .attr("x", (target.x1 + target.x2) / 2).attr("y", target.y + 16).text(target.label);

      if (!existing.empty()) {
        // Already on screen: just take the new length (pooled SD -> SE).
        sfsSpanMarks.set(existing.select(".sr-den-span").style("opacity", 1), target.x1, target.x2, target.y, {
          transition: duration > 0
            ? (selection) => selection.transition().duration(duration).ease(d3.easeCubicInOut)
            : null
        });
        existing.select("text").interrupt().style("opacity", 1);
        label(existing);
        existing.interrupt().style("opacity", 1);
        return;
      }

      const make = (className) => {
        const group = layer.append("g").attr("class", className);
        sfsSpanMarks.append(group.append("g").attr("class", "sr-den-span").attr("stroke", NOISE_COLOR));
        group.append("text").attr("class", "sr-span-label").attr("text-anchor", "middle")
          .attr("fill", NOISE_COLOR).style("opacity", 0);
        return group;
      };
      const den = make("sr-den");
      label(den);
      const sources = denominatorSources(differencesStage);
      if (!(duration > 0) || !sources.length) {
        sfsSpanMarks.set(den.select(".sr-den-span"), target.x1, target.x2, target.y);
        den.select("text").style("opacity", 1);
        return;
      }
      // Copies of the SD wings peel off, drop, and become the denominator;
      // with two samples, the two copies merge into one.
      const peelDuration = 1700;
      sources.forEach((source, i) => {
        const group = i === 0 ? den : make("sr-den-copy");
        peel(group.select(".sr-den-span"), source, target, peelDuration, () => {
          if (i > 0) group.remove();
        });
        if (i === 0) group.style("opacity", 1);
      });
      den.select("text").transition().delay(peelDuration).duration(250).style("opacity", 1);
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
      if (action.zoom !== undefined) state.zoom = Boolean(zoomDomain) && bool(action.zoom, state.zoom);
      const tScale = action.tScale !== undefined ? action.tScale : action["t-scale"];
      if (tScale !== undefined) state.tScale = bool(tScale, state.tScale);
      render({ animate: action.animate !== false });
    }

    rootNode.addEventListener("sfs-if:cancel-transitions", cancelTransitions);

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
