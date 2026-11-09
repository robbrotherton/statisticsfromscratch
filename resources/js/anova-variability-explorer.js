(function() {
  "use strict";

  const STAGES = ["populations", "total", "within", "between", "compare"];
  // With people (repeated measures), two more stages come before the comparison.
  const PEOPLE_STAGES = ["populations", "total", "within", "between", "people", "centre", "compare"];
  // With two crossed factors (Chapter 16), between groups splits into each factor and the
  // interaction. Each factor is a regrouping, like people; the interaction is what's left.
  const FACTOR_STAGES = ["populations", "total", "within", "between", "factor-a", "factor-b", "interaction", "compare"];
  const FACTOR_KEYS = ["factor-a", "factor-b"];
  // Okabe-Ito colours the cells don't use, for the first factor's levels; the second
  // factor's match the interaction plot's lines.
  const LEVEL_COLORS = [
    ["var(--graph-series-6, #56b4e9)", "var(--graph-series-5, #cc79a7)"],
    ["var(--graph-series-1, #0072b2)", "var(--graph-series-2, #e69f00)"]
  ];
  const PHASES = ["observe", "deviations", "squares", "sum"];
  const PEOPLE_PHASES = ["recolour", "rows", ...PHASES];
  // Tableau 10, the people palette of Chapter 13's paired figures, without the colours
  // that mean something else here: red, purple, brown and grey.
  const PERSON_COLORS = [0, 1, 3, 4, 5, 7];
  const CENTRE_PHASES = ["shift", "lanes", "deviations", "squares", "sum"];
  // Real scores stay where they are, this faded, while a stand-in does the work.
  const DOT_FADED = 0.45;
  // Stand-ins at a mean stack this much further apart than scores do, so they can be counted.
  const GHOST_SPREAD = 2.4;
  // Centring: each person's row sets off this long after the one above, and takes this long.
  const SHIFT_STAGGER = 140;
  const SHIFT_DURATION = 1100;
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

  function normalizeStage(value, stages) {
    const key = String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
    const aliases = { scores: "populations", population: "populations", groups: "populations", f: "compare", ratio: "compare", center: "centre", a: "factor-a", b: "factor-b" };
    const normalized = aliases[key] || key;
    return (stages || STAGES).includes(normalized) ? normalized : "populations";
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
      recolor: "recolour",
      "ms-e": "ms-within",
      "ms-error": "ms-within",
      ratio: "f",
      "f-ratio": "f"
    };
    const normalized = aliases[key] || key;
    return [...COMPARE_PHASES, ...PEOPLE_PHASES, ...CENTRE_PHASES].includes(normalized)
      ? normalized
      : fallback;
  }

  // The compare stage has its own phases; the other stages use PHASES.
  function phaseForStage(stage, phase) {
    const valid = { compare: COMPARE_PHASES, people: PEOPLE_PHASES, "factor-a": PEOPLE_PHASES, "factor-b": PEOPLE_PHASES, centre: CENTRE_PHASES }[stage] || PHASES;
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
        --ave-people: var(--sfs-people-color, #8a5a2b);
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
      .anova-variability-explorer .ave-leader { stroke: currentColor; stroke-width: 1; opacity: 0.6; }
      .anova-variability-explorer .ave-legend-label { font-size: var(--sfs-figure-small-size, 0.75rem); }
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

  // `rank` is where a score falls in its group's x order, which stacks a lane's dots top
  // to bottom. Without people the values are already sorted, so it's the index; with them,
  // the index is who the score belongs to and has to stay put.
  function compute(groups, people, design) {
    const result = computeOneWay(groups, people);
    return design ? { ...result, ...computeFactorial(groups, design, result) } : result;
  }

  // Each factor's level means (marginal means), and the cell means the two factors predict
  // with no interaction: level of A + level of B - grand mean. SS for a factor has the same
  // form as SS between, with its levels as the groups; the interaction is what's left of
  // SS between, which is also the squared departures of the cell means from that prediction.
  // That holds for equal cell sizes, which `factorDesign` insists on.
  function computeFactorial(groups, design, oneWay) {
    const { observations, grandMean, ssBetween, means, msWithin, dfWithin } = oneWay;
    const levelStats = design.factors.map((factor, f) => {
      const levelMeans = factor.levels.map((level, l) =>
        d3.mean(observations.filter((d) => groups[d.groupIndex].levels[f] === l), (d) => d.value));
      const counts = factor.levels.map((level, l) =>
        observations.filter((d) => groups[d.groupIndex].levels[f] === l).length);
      const ss = d3.sum(levelMeans, (mean, l) => counts[l] * Math.pow(mean - grandMean, 2));
      const df = factor.levels.length - 1;
      return { levelMeans, counts, ss, df, ms: ss / df, f: ss / df / msWithin };
    });
    const predicted = groups.map((group) =>
      levelStats[0].levelMeans[group.levels[0]] + levelStats[1].levelMeans[group.levels[1]] - grandMean);
    const ssInteraction = ssBetween - levelStats[0].ss - levelStats[1].ss;
    const dfInteraction = levelStats[0].df * levelStats[1].df;
    const msInteraction = ssInteraction / dfInteraction;
    // Each observation's place among the scores of its level, for each factor, so a level's
    // row stacks its dots in x order as a lane does.
    const levelRanks = design.factors.map((factor, f) => {
      const ranks = new Map();
      factor.levels.forEach((level, l) => {
        observations.filter((d) => groups[d.groupIndex].levels[f] === l)
          .sort((a, b) => a.value - b.value || a.groupIndex - b.groupIndex || a.index - b.index)
          .forEach((d, rank) => ranks.set(d, rank));
      });
      return ranks;
    });
    return {
      levelStats, predicted, levelRanks, ssInteraction, dfInteraction, msInteraction,
      fInteraction: msInteraction / msWithin,
      interactionCheck: d3.sum(groups, (group, i) => group.values.length * Math.pow(means[i] - predicted[i], 2)),
      dfWithin
    };
  }

  // Two crossed factors: `factors` names them and their levels, and each group (a cell)
  // says which level of each it belongs to. Returns null without the option.
  function factorDesign(option, rawGroups) {
    if (!option) return null;
    if (!Array.isArray(option) || option.length !== 2) {
      throw new Error("makeAnovaVariabilityExplorer: `factors` needs exactly two factors");
    }
    const factors = option.map((factor, f) => {
      const levels = (Array.isArray(factor.levels) ? factor.levels : []).map(String);
      if (levels.length < 2) throw new Error(`makeAnovaVariabilityExplorer: factor ${f + 1} needs at least two levels`);
      const name = String(factor.name || `Factor ${"AB"[f]}`);
      return {
        key: FACTOR_KEYS[f],
        label: name,
        name: String(factor.shortName || name.toLowerCase()),
        levels,
        colors: Array.isArray(factor.colors) ? factor.colors : LEVEL_COLORS[f]
      };
    });
    const cells = new Set();
    const sizes = new Set();
    rawGroups.forEach((group, i) => {
      const levels = Array.isArray(group.levels) ? group.levels.map(Number) : [];
      if (levels.length !== 2 || levels.some((l, f) => !(l >= 0 && l < factors[f].levels.length))) {
        throw new Error(`makeAnovaVariabilityExplorer: group ${i + 1} needs \`levels\`, one per factor`);
      }
      cells.add(levels.join("-"));
      sizes.add((Array.isArray(group.values) ? group.values : []).length);
    });
    if (cells.size !== rawGroups.length || cells.size !== factors[0].levels.length * factors[1].levels.length) {
      throw new Error("makeAnovaVariabilityExplorer: `factors` needs exactly one group per cell");
    }
    if (sizes.size !== 1) throw new Error("makeAnovaVariabilityExplorer: every cell needs the same number of scores");
    return {
      factors,
      interaction: {
        key: "between",
        label: `${factors[0].label} × ${factors[1].name}`,
        name: `${factors[0].name} × ${factors[1].name}`
      }
    };
  }

  function computeOneWay(groups, people) {
    const observations = [];
    groups.forEach((group, groupIndex) => {
      const order = d3.range(group.values.length).sort((a, b) => group.values[a] - group.values[b] || a - b);
      group.values.forEach((value, index) => observations.push({
        groupIndex, index, value, rank: people ? order.indexOf(index) : index
      }));
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
    const result = { observations, N, means, grandMean, ssTotal, ssWithin, ssBetween, dfBetween, dfWithin, msBetween, msWithin, f: msBetween / msWithin };
    if (!people) return result;
    // Same form as SS between, with people in place of groups: each person's mean counts
    // once per condition. What it leaves of SS within is error.
    const k = groups.length;
    const personMeans = people.map((name, i) => d3.mean(groups, (group) => group.values[i]));
    const ssPeople = k * d3.sum(personMeans, (mean) => Math.pow(mean - grandMean, 2));
    const ssError = ssWithin - ssPeople;
    const dfPeople = people.length - 1;
    const dfError = (k - 1) * dfPeople;
    const msError = ssError / dfError;
    return { ...result, personMeans, ssPeople, ssError, dfPeople, dfError, msError, fRelated: msBetween / msError };
  }

  // Names, one per person, from an option that is either a list of names or `true`.
  function personNames(option, rawGroups) {
    if (!option) return null;
    const counts = rawGroups.map((group) => (Array.isArray(group.values) ? group.values : []).length);
    if (new Set(counts).size !== 1) throw new Error("makeAnovaVariabilityExplorer: `people` needs one score per person in every group");
    if (Array.isArray(option) && option.length !== counts[0]) {
      throw new Error(`makeAnovaVariabilityExplorer: ${option.length} names for ${counts[0]} people`);
    }
    return d3.range(counts[0]).map((i) => String(Array.isArray(option) ? option[i] : `Person ${i + 1}`));
  }

  window.makeAnovaVariabilityExplorer = function(opts) {
    opts = opts || {};
    ensureStyles();
    const squares = window.sfsAnovaSquares;
    squares.ensureStyles();
    if (window.interactiveFigure) window.interactiveFigure.ensureStyles();

    // People make this a repeated-measures figure: the same people, in the same order, in
    // every group. They need the scores' order, so sorting is off. Without this option,
    // nothing below changes.
    const people = personNames(opts.people, Array.isArray(opts.groups) ? opts.groups : DEFAULT_GROUPS);
    // Two crossed factors make this a factorial figure. Without the option, nothing below changes.
    const design = people ? null : factorDesign(opts.factors, Array.isArray(opts.groups) ? opts.groups : []);
    const factors = design ? design.factors : [];
    // People and factors both regroup the scores: recolour, then move to new rows.
    const regroups = Boolean(people || design);
    const stageList = people ? PEOPLE_STAGES : design ? FACTOR_STAGES : STAGES;
    const buildStages = stageList.filter((stage) => !["populations", "centre", "compare"].includes(stage));
    const sortValues = !people && bool(opts.sort, true);
    // Without the scores the figure is only the comparison, sized for that alone, so it
    // never leaves the compare stage.
    const showScores = bool(opts.scores, true);
    const groups = (Array.isArray(opts.groups) && opts.groups.length >= 2 ? opts.groups : DEFAULT_GROUPS)
      .map((group, index) => {
        const values = (Array.isArray(group.values) ? group.values : []).map(Number).filter(Number.isFinite);
        // Sorted values stack each lane's dots top to bottom in x order.
        const cell = {
          name: String(group.name || group.label || `Group ${index + 1}`),
          values: sortValues ? values.sort((a, b) => a - b) : values
        };
        if (design) {
          cell.levels = group.levels.map(Number);
          // A cell is named by its two levels, one to a line, unless it has a name of its own.
          if (!group.name && !group.label) {
            cell.name = cell.levels.map((l, f) => factors[f].levels[l]).join("\n");
          }
        }
        return cell;
      })
      .filter((group) => group.values.length);
    const stats = compute(groups, people, design);
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
    const personY = d3.scalePoint().domain(d3.range(people ? people.length : 0));
    // A factor's levels each get a row, spread over the lanes' height.
    const levelY = d3.scalePoint().domain(d3.range(design ? d3.max(factors, (factor) => factor.levels.length) : 0));

    // Geometry is computed from the width the figure is drawn at, so text keeps its
    // real size on phones instead of shrinking with a fixed viewBox. Below
    // COMPACT_BELOW the sums panel moves under the dot plot; desktop tutorials, about
    // 600-620px wide inside their callouts, stay side by side.
    const COMPACT_BELOW = 600;
    // A name can run to two lines; its longest line sets the room for it.
    const longestName = d3.max([...groups.map((group) => group.name), ...(people || []), ...factors.flatMap((factor) => factor.levels)],
      (name) => d3.max(name.split("\n"), (line) => line.length)) || 6;
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
    // The column between and within stand in. People leave the total behind, so with them
    // it sits to the right of the total; otherwise it's the middle of the figure.
    let compareCx;

    function computeLayout(availableWidth) {
      width = Math.round(availableWidth);
      compact = width < COMPACT_BELOW;
      if (compact) {
        // The whole tutorial callout has to fit on a phone screen, so everything is
        // packed tighter: group names sit above their lanes, two lanes sit closer
        // than three, and the sums panel's heading runs above a centred bucket.
        // The people legend can run to two lines above the grand mean's label.
        const peopleRoom = regroups ? 18 : 0;
        const laneTop = 68 + peopleRoom;
        const laneSpan = groups.length === 2 ? 128 : groups.length === 3 ? 150 : 250;
        const laneBottom = laneTop + (people ? Math.max(laneSpan, 40 * (people.length - 1)) : laneSpan);
        plot = { left: 16, right: width - 16, top: 34 + peopleRoom, bottom: laneBottom + 40 };
        groupY.range([laneTop, laneBottom]);
        lane = { curve: 34, base: 28, meanHalf: 27, meanLabel: 33, name: -34, axisLabel: 36 };
        const panelSide = Math.min(136, width - 64);
        panel = { x: 8, y: plot.bottom + 48, width: width - 16, height: 74 + panelSide + 14 };
        panelSquare = { x: (width - panelSide) / 2, y: panel.y + 74, side: panelSide };
        height = panel.y + panel.height + 8;
      } else {
        // Lanes sit as close as their own furniture and their largest deviation squares
        // allow, so two groups don't spread over the height that three would need.
        // The sums panel gives up some width on a narrow page so the dot plot keeps enough.
        const panelWidth = Math.round(Math.max(200, Math.min(255, width * 0.33)));
        plot = { left: 16 + longestName * 8.6 + 12, right: width - panelWidth - 65, top: 44 };
        lane = { curve: 49, base: 38, meanHalf: 35, meanLabel: 43, name: 5, axisLabel: 42 };
        x.range([plot.left, plot.right]);
        const reach = laneReach();
        const above = (i) => Math.max(lane.meanLabel + 14, reach[i].up + 10);
        const below = (i) => Math.max(lane.base + 6, reach[i].down + 10);
        // A person's row needs room for its dots and its mean; the lanes make way for the rows.
        const step = Math.max(laneStep(lane.base + 6 + lane.meanLabel + 14),
          people ? 44 * (people.length - 1) / (groups.length - 1) : 0);
        const laneTop = plot.top + above(0);
        const laneBottom = laneTop + step * (groups.length - 1);
        groupY.range([laneTop, laneBottom]);
        plot.bottom = laneBottom + below(groups.length - 1);
        panel = { x: width - panelWidth - 30, y: plot.top - 10, width: panelWidth };
        panelSquare = { x: panel.x + 22, y: panel.y + 100, side: panelWidth - 44 };
        panel.height = panelSquare.y + panelSquare.side + 22 - panel.y;
        height = Math.ceil(Math.max(plot.bottom + lane.axisLabel + 14, panel.y + panel.height + 8));
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
      const parts = aggregateSquares(true).filter((d) => d.df);
      const relative = (d) => Math.sqrt(d.value / stats.ssTotal);
      const reach = (d, side) => Math.max(relative(d) * side, cutPieces(d, relative(d) * side).height);
      const widest = (side) => d3.max(parts, (d) => cutPieces(d, relative(d) * side).width);
      const extent = (side) => d3.sum(parts, (d) => reach(d, side)) + 2 * midGap + 2 * labelRoom;
      const fits = (side) => widest(side) <= width - 2 * (margin + cutLabelRoom) &&
        side <= width - 2 * (margin + totalLabelRoom) &&
        (!showScores || extent(side) <= height - 2 * margin);
      const between = parts.find((d) => d.key === "between");
      const residual = parts.find((d) => d.key === "within");
      const share = between.value / stats.ssTotal;
      const leftEdge = margin + totalLabelRoom;
      const columnLeft = (side) => leftEdge + side + (compact ? 18 : 30);
      // Room for the column's widest shape and for the name above it.
      const columnWidth = (side) => Math.max(widest(side), 84);
      const above = (side) => Math.max(side * share, reach(between, side) + midGap + labelRoom);
      const below = (side) => Math.max(side * (1 - share), reach(residual, side) + midGap + labelRoom);
      const fitsBeside = (side) => columnLeft(side) + columnWidth(side) + cutLabelRoom <= width - margin &&
        (!showScores || above(side) + below(side) <= height - 2 * margin);
      if (design) {
        layoutFactorial({ margin, leftEdge, labelRoom, cutLabelRoom });
        x.range([plot.left, plot.right]);
        personY.range(groupY.range());
        levelY.range(groupY.range());
        return;
      }
      let side = compact ? 240 : 270;
      while (side > 60 && !(people ? fitsBeside(side) : fits(side))) side -= 2;
      if (people) {
        if (!showScores) height = Math.ceil(above(side) + below(side) + (compact ? 16 : 24));
        midline = (height - above(side) - below(side)) / 2 + above(side);
        compareCx = columnLeft(side) + columnWidth(side) / 2;
        wideSquare = { x: leftEdge, y: midline - side * share, side };
      } else {
        if (!showScores) height = Math.ceil(extent(side) + (compact ? 16 : 24));
        midline = (height - extent(side)) / 2 + labelRoom + reach(between, side) + midGap;
        compareCx = width / 2;
        // The total's between layer sits directly on the line, its within layer directly under it.
        wideSquare = { x: (width - side) / 2, y: midline - side * share, side };
      }
      x.range([plot.left, plot.right]);
      personY.range(groupY.range());
    }

    // Factorial comparison. The total stands at the left, its layers labelled beside it,
    // until they split: the two factors and the interaction stand in a row on the line, and
    // within hangs under the middle one. Each of the three is a numerator over the same
    // denominator, so at F the within mean square is copied under the other two.
    // `numeratorX` maps each numerator's key to its centre.
    let numeratorX = {};
    let numeratorGap;
    const NUMERATOR_KEYS = ["factor-a", "factor-b", "between"];

    function layoutFactorial({ margin, leftEdge, labelRoom, cutLabelRoom }) {
      const parts = aggregateSquares(true).filter((d) => d.df);
      const byKey = (key) => parts.find((d) => d.key === key);
      const relative = (d) => Math.sqrt(d.value / stats.ssTotal);
      const share = stats.ssBetween / stats.ssTotal;
      const within = byKey("within");
      // Room for "÷ 1" between the numerators as they're cut.
      numeratorGap = compact ? 36 : 44;
      const fRow = 24;
      const rowWidth = (side) => d3.sum(NUMERATOR_KEYS, (key) => relative(byKey(key)) * side) + 2 * numeratorGap;
      const tallest = (side) => d3.max(NUMERATOR_KEYS, (key) => relative(byKey(key)) * side);
      const withinReach = (side) => Math.max(relative(within) * side, cutPieces(within, relative(within) * side).height);
      const above = (side) => Math.max(side * share, tallest(side) + midGap + labelRoom);
      const below = (side) => Math.max(side * (1 - share), withinReach(side) + midGap + labelRoom + fRow);
      // The layers' names stand beside the total, so it leaves them room on the right.
      const besideRoom = (compact ? 7.2 : 7.8) * (3 + d3.max(parts, (d) => d.name.length)) + 18;
      const fitsFactorial = (side) => leftEdge + side + besideRoom <= width - 8 &&
        rowWidth(side) + cutLabelRoom <= width - 2 * margin &&
        cutPieces(within, relative(within) * side).width <= width - 2 * (margin + cutLabelRoom) &&
        (!showScores || above(side) + below(side) <= height - 2 * margin);
      let side = compact ? 240 : 270;
      while (side > 60 && !fitsFactorial(side)) side -= 2;
      if (!showScores) height = Math.ceil(above(side) + below(side) + (compact ? 16 : 24));
      midline = (height - above(side) - below(side)) / 2 + above(side);
      wideSquare = { x: leftEdge, y: midline - side * share, side };
      // The row is centred, leaving the last numerator's "÷ 1" room on the right.
      let left = (width - rowWidth(side) - cutLabelRoom) / 2 + cutLabelRoom / 2;
      numeratorX = {};
      NUMERATOR_KEYS.forEach((key) => {
        const w = relative(byKey(key)) * side;
        numeratorX[key] = left + w / 2;
        left += w + numeratorGap;
      });
      compareCx = numeratorX["factor-b"];
    }

    // Where a part of the comparison stands: numerators by their own centre, within under
    // the middle one. Without factors, everything shares one column.
    function partCx(d) {
      return design && numeratorX[d.key] !== undefined ? numeratorX[d.key] : compareCx;
    }

    function stageFor(value) {
      return showScores ? normalizeStage(value, stageList) : "compare";
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
    const dotsLayer = plotGroup.append("g").attr("class", "ave-dots");
    // Above the scores: while they're in play, the stand-ins are what's being counted.
    const ghostsLayer = plotGroup.append("g").attr("class", "ave-ghosts");
    // Says who's who wherever dots wear people's colours outside their rows.
    const legendLayer = regroups ? plotGroup.append("g").attr("class", "ave-legend").style("opacity", 0) : null;

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
      if (design) {
        // Each sum appears once it has been counted, and the mean squares and Fs with the last.
        const ss = (label, value) => `<span><strong>SS<sub>${label}</sub></strong> = ${fmt(value)}</span>`;
        const parts = [ss("total", stats.ssTotal), ss("within", stats.ssWithin), ss("between", stats.ssBetween)];
        factors.forEach((factor, f) => {
          if (factorPoured(factor.key)) parts.push(ss(factor.name, stats.levelStats[f].ss));
        });
        if (interactionCounted()) {
          parts.push(ss(design.interaction.name, stats.ssInteraction));
          const msWithin = `${fmt(stats.msWithin, 2)}`;
          factors.forEach((factor, f) => {
            parts.push(`<span><strong>F<sub>${factor.name}</sub></strong> = ${fmt(stats.levelStats[f].ms, 2)} / ${msWithin} = ${fmt(stats.levelStats[f].f)}</span>`);
          });
          parts.push(`<span><strong>F<sub>${design.interaction.name}</sub></strong> = ${fmt(stats.msInteraction, 2)} / ${msWithin} = ${fmt(stats.fInteraction)}</span>`);
        }
        calculationBox.html(`<div class="ave-calc-grid">${parts.join("")}</div>`);
        return;
      }
      if (people && aggregateRevealLevel() >= buildStages.length) {
        // Error and everything that depends on it wait until it has been counted.
        const counted = errorCounted() ? `
            <span><strong>SS<sub>error</sub></strong> = ${fmt(stats.ssError)}</span>
            <span><strong>MS<sub>between</sub></strong> = ${fmt(stats.ssBetween)} / ${stats.dfBetween} = ${fmt(stats.msBetween, 1)}</span>
            <span><strong>MS<sub>error</sub></strong> = ${fmt(stats.ssError)} / ${stats.dfError} = ${fmt(stats.msError, 1)}</span>
            <span><strong>F</strong> = ${fmt(stats.msBetween, 1)} / ${fmt(stats.msError, 1)} = ${fmt(stats.fRelated)}</span>` : "";
        calculationBox.html(`
          <div class="ave-calc-grid">
            <span><strong>SS<sub>total</sub></strong> = ${fmt(stats.ssTotal)}</span>
            <span><strong>SS<sub>between</sub></strong> = ${fmt(stats.ssBetween)}</span>
            <span><strong>SS<sub>people</sub></strong> = ${fmt(stats.ssPeople)}</span>${counted}
          </div>
        `);
        return;
      }
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
        .style("opacity", regrouped() ? 0 : visible ? 1 : state.stage === "total" ? 0.1 : 0.07);
    }

    // Colour marks the grouping currently in use: none for the total, conditions for the
    // Chapter 14 stages, and people from the moment they're the question. So people's
    // rows end up one colour each, as the condition lanes were.
    function grouping() {
      if (state.stage === "total") return "none";
      if (FACTOR_KEYS.includes(state.stage)) return state.stage;
      return state.stage === "people" || state.stage === "centre" ? "person" : "condition";
    }

    function personColoured() {
      return grouping() === "person";
    }

    // The factor the scores are grouped by in this stage, if any.
    function activeFactor() {
      return design ? FACTOR_KEYS.indexOf(state.stage) : -1;
    }

    function levelOf(d, f) {
      return groups[d.groupIndex].levels[f];
    }

    // Grouped by something other than the cells: people, or one factor's levels.
    function regrouped() {
      return !["none", "condition"].includes(grouping());
    }

    function levelFill(f, level) {
      const palette = factors[f].colors;
      return palette[level % palette.length];
    }

    function personFill(i) {
      const palette = Array.isArray(opts.personColors) ? opts.personColors : PERSON_COLORS;
      return d3.schemeTableau10[palette[i % palette.length]];
    }

    function dotFill(d) {
      const f = activeFactor();
      if (f >= 0) return levelFill(f, levelOf(d, f));
      return {
        none: "var(--ave-total)",
        condition: colors[d.groupIndex % colors.length],
        person: personFill(d.index)
      }[grouping()];
    }

    // After the recolour, the condition lanes give way to one row per person. People are
    // centred in their rows, and the scores go back to the lanes after that. A factor's
    // levels get a row each in the same way.
    function rowsView() {
      if (state.stage === "centre") return state.phase === "shift";
      return (state.stage === "people" || activeFactor() >= 0) && state.phase !== "recolour";
    }

    // Which rows the scores are in, so a move from one factor's rows to the other's counts
    // as a regrouping too.
    function rowsKey() {
      return rowsView() ? grouping() : "lanes";
    }

    // A level's row holds every score at that level, stacked in x order.
    function levelRowY(d, f, spread) {
      const count = stats.levelStats[f].counts[levelOf(d, f)];
      return levelY(levelOf(d, f)) + squares.laneOffset(stats.levelRanks[f].get(d), count) * (spread || 1);
    }

    function targetY(d) {
      return groupY(d.groupIndex) + squares.laneOffset(d.rank, groups[d.groupIndex].values.length);
    }

    // A person's scores stack in condition order within their row.
    function dotY(d) {
      if (rowsView() && activeFactor() >= 0) return levelRowY(d, activeFactor());
      return rowsView()
        ? personY(d.index) + squares.laneOffset(d.groupIndex, groups.length)
        : targetY(d);
    }

    // Centring shifts all of a person's scores by the same amount, until their own mean
    // sits on the grand mean. Differences between their scores don't change.
    function centredValue(d) {
      return d.value - stats.personMeans[d.index] + stats.grandMean;
    }

    function renderLanes(animate, moves) {
      const deemphasizeGroups = state.stage === "total";
      const rows = rowsView();
      const f = activeFactor();
      const levelRows = rows && f >= 0;
      const laneData = levelRows ? factors[f].levels.map((level, i) => `${factors[f].key}-${i}`)
        : rows ? people.map((name, i) => `person-${i}`) : d3.range(groups.length);
      const laneY = (d) => {
        if (!rows) return groupY(d);
        const i = Number(String(d).replace(/^.*-/, ""));
        return levelRows ? levelY(i) : personY(i);
      };
      const lanes = lanesLayer.selectAll("line.ave-lane").data(laneData, String);
      const swap = moves.crossing ? 420 : 0;
      lanes.join((enter) => {
        const line = enter.append("line").attr("y1", laneY).attr("y2", laneY);
        return regroups ? line.style("opacity", 0) : line;
      }, undefined, (exit) => exit.transition().delay(moves.labelsOut).duration(swap).style("opacity", 0).remove())
        .attr("class", "ave-lane")
        .attr("x1", plot.left).attr("x2", plot.right)
        .transition().delay(moves.labelsIn).duration(animate ? 520 : 0)
        .attr("y1", laneY)
        .attr("y2", laneY)
        .style("opacity", deemphasizeGroups ? 0.42 : 1);
      lanes.exit().remove();

      const labelData = deemphasizeGroups ? []
        : levelRows ? factors[f].levels.map((name, level) => ({ name, level, key: `${factors[f].key}-${level}` }))
        : rows ? people.map((name) => ({ name })) : groups;
      const labels = lanesLayer.selectAll("text.ave-group-label")
        .data(labelData, (d) => d.key || d.name);
      // With people or factors, names swap one set at a time: the old ones go, then the new ones come.
      const named = labels.join((enter) => {
        const text = enter.append("text");
        return regroups ? text.style("opacity", 0) : text;
      }, undefined, (exit) => regroups
        ? exit.transition("swap").delay(moves.labelsOut).duration(swap).style("opacity", 0).remove()
        : exit.remove());
      named
        .attr("class", "ave-group-label")
        // On a phone the names sit above the lanes' left ends, clear of the squares that
        // grow up from the lane below.
        .attr("x", compact ? plot.left : plot.left - 12)
        .attr("text-anchor", compact ? "start" : "end")
        .attr("fill", (d, i) => {
          // The palette's yellow and pink are too pale for text as they are.
          if (levelRows) return `color-mix(in srgb, ${levelFill(f, d.level)} 62%, var(--sfs-text, #222))`;
          if (rows) return `color-mix(in srgb, ${personFill(i)} 62%, var(--sfs-text, #222))`;
          if (f >= 0) return "currentColor";
          return personColoured() ? "currentColor" : colors[i % colors.length];
        })
        // Lanes never move between steps, so a returning label is placed, not slid in.
        .attr("y", (d, i) => {
          if (levelRows) return levelY(d.level) + (compact ? -9 : 5);
          return rows ? personY(i) + (compact ? -9 : 5) : groupY(i) + lane.name;
        });
      if (design) {
        // Names can sit over a neighbouring lane's squares on a phone, so they keep a halo.
        named.style("paint-order", "stroke").style("stroke", "var(--bs-body-bg, #fff)")
          .style("stroke-width", "3px").style("stroke-linejoin", "round");
        // A cell's name is its two levels: one to a line beside the lane, one line above it on a phone.
        named.each(function(d) {
          const lines = String(d.name).split("\n");
          const text = d3.select(this).text(null);
          if (compact || lines.length === 1) {
            text.text(lines.join(", "));
            return;
          }
          text.selectAll("tspan").data(lines).join("tspan")
            .attr("x", compact ? plot.left : plot.left - 12)
            .attr("dy", (line, i) => i ? "1.15em" : `${-0.575 * (lines.length - 1)}em`)
            .text((line) => line);
        });
      } else {
        named.text((d) => d.name);
      }
      if (regroups) {
        named.style("transition", animate ? `fill 600ms ease ${moves.fillDelay}ms` : "none")
          .transition("swap").delay(moves.labelsIn).duration(swap).style("opacity", 1);
      }
      renderLegend(animate, moves);
    }

    let legendFactor = 0;

    function renderLegend(animate, moves) {
      if (!legendLayer) return;
      const entryWidth = (name) => 20 + name.length * 7;
      const room = width - plot.left - 8;
      const lines = [[]];
      let used = 0;
      // With factors, the legend names the levels of the factor in use, and keeps the last
      // one's while it fades.
      const f = activeFactor();
      if (design && f >= 0) legendFactor = f;
      const names = design ? factors[legendFactor].levels : people;
      const fill = (i) => design ? levelFill(legendFactor, i) : personFill(i);
      names.forEach((name, i) => {
        if (used + entryWidth(name) > room && used > 0) {
          lines.push([]);
          used = 0;
        }
        lines[lines.length - 1].push({ name, i, left: used });
        used += entryWidth(name);
      });
      const items = lines.flatMap((line, row) => line.map((d) => ({
        ...d,
        y: plot.top - 28 - (lines.length - 1 - row) * 16
      })));
      const entries = legendLayer.selectAll("g.ave-legend-entry").data(items, (d) => d.i)
        .join((enter) => {
          const entry = enter.append("g").attr("class", "ave-legend-entry");
          entry.append("circle").attr("r", 5);
          entry.append("text").attr("class", "ave-legend-label").attr("x", 9).attr("y", 4);
          return entry;
        })
        .attr("transform", (d) => `translate(${plot.left + d.left + 5},${d.y})`);
      entries.select("circle").attr("fill", (d) => fill(d.i));
      entries.select("text").attr("fill", "currentColor").text((d) => d.name);
      const showing = (design ? f >= 0 : personColoured()) && !rowsView();
      legendLayer.interrupt()
        .transition().delay(showing ? Math.max(moves.fillDelay, moves.labelsIn) : moves.labelsOut)
        .duration(animate ? 420 : 0)
        .style("opacity", showing ? 1 : 0);
    }

    // While a stand-in is in play: for between-groups variability every score is treated
    // as its group mean, for between-people variability as its person's mean, and centring
    // treats it as shifted with the person's other scores. Those are fictions, so they're
    // drawn as ghosts. The scores themselves stay put.
    function standIn(d) {
      if (state.stage === "between" || state.stage === "interaction") return stats.means[d.groupIndex];
      const f = activeFactor();
      if (f >= 0) return ["recolour", "rows"].includes(state.phase) ? null : stats.levelStats[f].levelMeans[levelOf(d, f)];
      if (state.stage === "centre") return centredValue(d);
      if (state.stage === "people" && !["recolour", "rows"].includes(state.phase)) return stats.personMeans[d.index];
      return null;
    }

    function hasStandIns() {
      return standIn(stats.observations[0]) !== null;
    }

    // Stand-ins at a mean spread out to be counted: each one is somebody, pretending to be
    // exactly average. Centred scores keep the place their scores have.
    function ghostY(d) {
      if (state.stage === "centre") return dotY(d);
      // A level's eight or more stand-ins spread less than a lane's few, to stay in their row.
      if (activeFactor() >= 0) return levelRowY(d, activeFactor(), 1.6);
      return state.stage === "people"
        ? personY(d.index) + squares.laneOffset(d.groupIndex, groups.length) * GHOST_SPREAD
        : groupY(d.groupIndex) + squares.laneOffset(d.rank, groups[d.groupIndex].values.length) * GHOST_SPREAD;
    }

    function renderGhosts(animate, moves) {
      // Centred outlines are new ones, not the mean's: each person's scores, at their real
      // spacing, set off together.
      const prefix = state.stage === "centre" ? "centred-" : "";
      const items = !hasStandIns() ? [] : stats.observations.map((d) => ({
        key: `${prefix}${d.groupIndex}-${d.index}`,
        from: { x: x(d.value), y: dotY(d) },
        x: x(standIn(d)),
        y: ghostY(d),
        color: dotFill(d),
        delay: moves.shifting ? d.index * SHIFT_STAGGER : 0
      }));
      squares.renderGhosts(ghostsLayer, items, {
        animate,
        riseDelay: moves.shifting ? squares.GHOST_FADE : 0,
        slide: moves.shifting ? SHIFT_DURATION : undefined,
        moveDelay: moves.moveAt,
        moveDuration: moves.crossing ? 1000 : 0
      });
    }

    function renderDots(animate, moves) {
      const faded = hasStandIns();
      const dots = dotsLayer.selectAll("circle.ave-dot")
        .data(stats.observations, (d) => `${d.groupIndex}-${d.index}`)
        .join("circle")
        .attr("class", "ave-dot")
        .attr("r", 6)
        .attr("fill", dotFill);
      // With people the fill eases between groupings, through CSS because these colours
      // can be var()s, which d3 can't interpolate.
      if (regroups) dots.style("transition", animate ? `fill 600ms ease ${moves.fillDelay}ms` : "none");
      // Everywhere else the real scores stay in view. Centred scores aren't real times, though,
      // and the two side by side compete for attention and invite comparisons that mean
      // nothing, so here the scores hand over to the outlines and stay out of the way.
      const hidden = state.stage === "centre";
      dots.transition("fade").delay(moves.shifting ? squares.GHOST_FADE : 0)
        .duration(animate ? squares.GHOST_FADE : 0)
        .style("opacity", hidden ? 0 : faded ? DOT_FADED : 1)
        .on("end", function() {
          if (faded) return;
          // Nothing left behind: back to exactly what it was.
          this.style.removeProperty("opacity");
          if (!this.getAttribute("style")) this.removeAttribute("style");
        });
      dots.transition().delay(moves.crossing ? moves.moveAt : 0).duration(animate ? (moves.crossing ? 1000 : 560) : 0).ease(d3.easeCubicInOut)
        .attr("cx", (d) => x(d.value))
        .attr("cy", dotY);
    }

    function deviationData(stage) {
      stage = stage || state.stage;
      if (stage === "total") {
        return stats.observations.map((d) => ({ ...d, from: d.value, to: stats.grandMean, y: targetY(d), color: "var(--ave-total)" }));
      }
      if (stage === "within") {
        return stats.observations.map((d) => ({
          ...d,
          from: d.value,
          to: stats.means[d.groupIndex],
          y: targetY(d),
          color: colors[d.groupIndex % colors.length]
        }));
      }
      if (stage === "between") {
        // One deviation per group: every score now sits on its group mean and shares it.
        return groups.map((group, i) => ({ groupIndex: i, index: 0, from: stats.means[i], to: stats.grandMean, y: groupY(i), color: "var(--ave-between)", weight: group.values.length }));
      }
      if (stage === "people") {
        // The same move with people as the groups: one square each, counted once per condition.
        return people.map((name, i) => ({
          groupIndex: i,
          index: 0,
          // Neighbouring rows' squares reach away from each other, the first row's down.
          rank: i + 1,
          lanes: people.length,
          from: stats.personMeans[i],
          to: stats.grandMean,
          y: personY(i),
          color: "var(--ave-people)",
          weight: groups.length
        }));
      }
      const f = FACTOR_KEYS.indexOf(stage);
      if (design && f >= 0) {
        // The same move again, with a factor's levels as the groups: one square per level,
        // counted once for every score at that level.
        const level = stats.levelStats[f];
        return factors[f].levels.map((name, i) => ({
          groupIndex: i,
          index: 0,
          rank: i,
          lanes: factors[f].levels.length,
          from: level.levelMeans[i],
          to: stats.grandMean,
          y: levelY(i),
          color: "var(--ave-between)",
          weight: level.counts[i]
        }));
      }
      if (stage === "interaction") {
        // Each cell mean against the mean the two factors alone predict for it, counted once
        // per score in the cell.
        return groups.map((group, i) => ({
          groupIndex: i,
          index: 0,
          from: stats.means[i],
          to: stats.predicted[i],
          y: groupY(i),
          color: "var(--ave-between)",
          weight: group.values.length
        }));
      }
      if (stage === "centre") {
        return stats.observations.map((d) => ({
          ...d,
          from: centredValue(d),
          to: stats.means[d.groupIndex],
          y: targetY(d),
          color: "var(--ave-within)"
        }));
      }
      return [];
    }

    function deviationSquareGeometry(d) {
      return squares.deviationSquare(x(d.from), x(d.to), d.y, d.groupIndex, d.lanes || groups.length, d.rank === undefined ? d.index : d.rank);
    }

    // How far each lane's deviation squares (and dots) reach above and below its line, over
    // every stage, at the current x scale.
    function laneReach() {
      groupY.range([0, 0]);
      const reach = groups.map(() => ({ up: 6, down: 6 }));
      ["total", "within", "between"].forEach((stage) => deviationData(stage).forEach((d) => {
        const square = deviationSquareGeometry(d);
        const r = reach[d.groupIndex];
        r.up = Math.max(r.up, -square.y, 6 - d.y);
        r.down = Math.max(r.down, square.y + square.side, d.y + 6);
      }));
      return reach;
    }

    // The smallest distance between lanes at which, in every stage, no square reaches past
    // the next lane's dots, and, once groups matter, no two squares from neighbouring lanes
    // overlap. (In the total stage every score is one grey pool, so overlap there is
    // harmless, and allowing it keeps three lanes from spreading far apart.) Squares from
    // neighbouring lanes may share height where they don't share x. Call after laneReach.
    function laneStep(minimum) {
      let step = minimum;
      ["total", "within", "between"].forEach((stage) => {
        const placed = deviationData(stage).map((d) => ({ lane: d.groupIndex, ...deviationSquareGeometry(d) }));
        placed.forEach((a) => {
          if (a.lane < groups.length - 1) step = Math.max(step, a.y + a.side + 14);
          if (a.lane > 0) step = Math.max(step, 14 - a.y);
          if (stage === "total") return;
          placed.forEach((b) => {
            if (b.lane !== a.lane + 1 || a.x >= b.x + b.side || b.x >= a.x + a.side) return;
            step = Math.max(step, a.y + a.side - b.y + 6);
          });
        });
      });
      return step;
    }

    function phaseIndex() {
      if (state.phase === "compare") return PHASES.length;
      return Math.max(0, PHASES.indexOf(state.phase));
    }

    function renderDeviations(animate, transitions) {
      transitions = transitions || {};
      const showLines = ["total", "within", "between", "people", "centre", "factor-a", "factor-b", "interaction"].includes(state.stage) && phaseIndex() >= 1;
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
        growSquares: transitions.growSquares,
        lineDelay: transitions.lineDelay,
        squareDelay: transitions.squareDelay
      });
    }

    function renderMeans(animate, moves) {
      const f = activeFactor();
      const showGroupMeans = ["within", "between", "compare", "populations", "centre", "interaction"].includes(state.stage);
      const showPersonMeans = rowsView() && state.phase !== "rows" && f < 0;
      const showLevelMeans = rowsView() && state.phase !== "rows" && f >= 0;
      const showGrand = ["total", "between", "compare", "centre"].includes(state.stage) || showPersonMeans || showLevelMeans;
      // Centring carries each person's mean to the grand mean, and their scores with it.
      const meanX = (d) => x(d.person && state.stage === "centre" ? stats.grandMean : d.mean);
      const meanData = showLevelMeans
        ? stats.levelStats[f].levelMeans.map((mean, i) => ({ mean, i, level: f }))
        : showPersonMeans
          ? stats.personMeans.map((mean, i) => ({ mean, i, person: true }))
          : showGroupMeans ? stats.means.map((mean, i) => ({ mean, i })) : [];
      // In the interaction stage, each cell also shows the mean the two factors predict for it.
      if (state.stage === "interaction") {
        stats.predicted.forEach((mean, i) => meanData.push({ mean, i, prediction: true }));
      }
      const meanColor = (d) => {
        if (d.prediction) return "var(--ave-between)";
        if (d.level !== undefined) return levelFill(d.level, d.i);
        if (d.person) return personFill(d.i);
        return regrouped() ? "var(--ave-total)" : colors[d.i % colors.length];
      };
      const meanRowY = (d) => d.level !== undefined ? levelY(d.i) : d.person ? personY(d.i) : groupY(d.i);
      const meanHalf = (d) => {
        if (d.level !== undefined) return lane.meanHalf;
        return d.person ? Math.min(16, personY.step() / 2 - 3) : lane.meanHalf;
      };
      const meanName = (d) => {
        if (d.prediction) return d.i === 0 && !compact ? "prediction" : "";
        if (d.level !== undefined) return d.i === 0 && !compact ? `${factors[d.level].name} mean` : "";
        if (state.stage === "interaction") return d.i === 0 && !compact ? "cell mean" : "";
        if (!d.person) return compact ? "" : "group mean";
        return d.i === 0 && state.stage === "people" ? "person mean" : "";
      };
      const meanKey = (d) => {
        if (d.prediction) return `prediction-${d.i}`;
        if (d.level !== undefined) return `level-${d.level}-${d.i}`;
        return d.person ? `person-${d.i}` : d.i;
      };
      const means = meansLayer.selectAll("g.ave-group-mean").data(meanData, meanKey);
      const meanEnter = means.enter().append("g").attr("class", "ave-group-mean").style("opacity", 0);
      meanEnter.append("line").attr("class", "ave-mean-line");
      meanEnter.append("text").attr("class", "ave-mean-label").attr("text-anchor", "middle");
      const meanMerged = meanEnter.merge(means);
      const meanLines = meanMerged.select("line").interrupt()
        .attr("stroke", meanColor)
        .attr("y1", (d) => meanRowY(d) - meanHalf(d)).attr("y2", (d) => meanRowY(d) + meanHalf(d));
      if (moves.shifting) {
        meanLines.transition().delay((d) => moves.shiftAt(d.i)).duration(SHIFT_DURATION).ease(d3.easeCubicInOut)
          .attr("x1", meanX).attr("x2", meanX);
      } else {
        meanLines.attr("x1", meanX).attr("x2", meanX);
      }
      // A prediction is drawn finer than a mean, so the two read apart.
      if (design) meanLines.style("stroke-dasharray", (d) => d.prediction ? "2 3" : null);
      // A cell's mean and its prediction sit close together, so their labels read away
      // from each other: which way depends on which is higher.
      const apart = (d) => {
        if (state.stage !== "interaction") return 0;
        const lower = stats.predicted[d.i] < stats.means[d.i];
        return (d.prediction === lower) ? -1 : 1;
      };
      meanMerged.select("text")
        .attr("fill", meanColor)
        // A person's mean can sit close to the grand mean, so its label reads away from that line.
        .attr("text-anchor", (d) => {
          if (apart(d)) return apart(d) < 0 ? "end" : "start";
          return d.person ? "start" : "middle";
        })
        .attr("x", (d) => x(d.mean) - (d.person ? 6 : 0) + apart(d) * 4)
        .attr("y", (d) => meanRowY(d) - (d.person ? meanHalf(d) + 5 : lane.meanLabel))
        // On a phone the group names sit above the lanes, where these labels would collide with them.
        .text(meanName);
      // Means belonging to where the scores are going wait for them to arrive.
      meanMerged.transition().delay(moves.crossing ? moves.moveAt + 1000 : 0).duration(animate ? 320 : 0)
        .style("opacity", state.stage === "populations" ? 0.7 : 1);
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
    // With people, the within layer splits in place: people pour in at the bottom of it, and
    // what's left above them is error. Error then does everything within did, so it keeps
    // within's key and place in the code. People have no df, so they're never lifted or cut.
    // `settled` asks for the layers as they end up, whatever the current step.
    function aggregateSquares(settled) {
      const layers = [
        { key: "total", label: "Total", value: stats.ssTotal, base: 0, color: "var(--ave-total)", reveal: 1 },
        { key: "between", name: "between", label: "Between", value: stats.ssBetween, base: stats.ssWithin, color: "var(--ave-between)", reveal: 3, df: stats.dfBetween, ms: stats.msBetween, msPhase: 2 },
        { key: "within", name: "within", label: "Within", value: stats.ssWithin, base: 0, color: "var(--ave-within)", reveal: 2, df: stats.dfWithin, ms: stats.msWithin, msPhase: 3 }
      ];
      if (design) return factorialLayers(layers, settled);
      if (!people) return layers;
      if (settled || peoplePoured()) {
        Object.assign(layers[2], { name: "error", label: "Error", value: stats.ssError, base: stats.ssPeople, df: stats.dfError, ms: stats.msError });
      }
      layers.push({ key: "people", name: "people", label: "People", value: stats.ssPeople, base: 0, color: "var(--ave-people)", reveal: buildStages.length });
      return layers;
    }

    // With factors, between splits in place, as within does for people: each factor pours
    // in at the bottom of it, on top of within, and what's left above them is the
    // interaction. That remainder does everything between did, so it keeps between's key.
    // Both factors and the interaction are numerators, so they all have df.
    function factorialLayers(layers, settled) {
      const between = layers[1];
      let base = stats.ssWithin;
      factors.forEach((factor, f) => {
        const level = stats.levelStats[f];
        layers.push({
          key: factor.key, name: factor.name, label: factor.label, value: level.ss, base,
          color: "var(--ave-between)", fillOpacity: f ? 0.12 : 0.26,
          reveal: buildStages.indexOf(factor.key) + 1, df: level.df, ms: level.ms, msPhase: 2
        });
        if (settled || factorPoured(factor.key)) {
          base += level.ss;
          Object.assign(between, { base, value: stats.ssBetween - (base - stats.ssWithin) });
        }
      });
      if (settled || factorPoured("factor-b")) {
        Object.assign(between, { name: design.interaction.name, label: design.interaction.label, ms: stats.msInteraction, df: stats.dfInteraction });
      }
      return layers;
    }

    function factorPoured(key) {
      return aggregateRevealLevel() > buildStages.indexOf(key);
    }

    // Between as it stood before a factor poured into it, which then gives way as it lands.
    function betweenBefore(key) {
      const before = factors.slice(0, FACTOR_KEYS.indexOf(key)).reduce((sum, factor, f) => sum + stats.levelStats[f].ss, 0);
      return { base: stats.ssWithin + before, value: stats.ssBetween - before };
    }

    // After both factors pour in, what's left of between is an empty slot with no name. It
    // becomes the interaction when the cells' departures from the prediction fill it.
    function interactionCounted() {
      return state.stage === "compare" || (state.stage === "interaction" && state.phase === "sum");
    }

    function peoplePoured() {
      return aggregateRevealLevel() >= buildStages.length;
    }

    // After people pour in, what's left of within is an empty slot with no name. It becomes
    // error when the centred scores' squares fill it, or by the comparison if they never do.
    function errorCounted() {
      return state.stage === "compare" || (state.stage === "centre" && state.phase === "sum");
    }

    function layerLabelled(d) {
      if (aggregateRevealLevel() < d.reveal) return false;
      if (design && d.key === "between") return !factorPoured("factor-a") || interactionCounted();
      return !(people && d.key === "within" && peoplePoured() && !errorCounted());
    }

    function aggregateRevealLevel() {
      if (state.stage === "populations") return 0;
      const buildIndex = buildStages.indexOf(state.stage);
      if (buildIndex < 0) return buildStages.length;
      return buildIndex + (state.phase === "sum" ? 1 : 0);
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
        x: partCx(d) - side / 2,
        y: d.key !== "within" ? midline - midGap - side : midline + midGap,
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
      if (isLifted(d)) return { name: `MS ${d.name}`, value: msDetail(d) };
      // Beside the total, or inside it, a label is a single line.
      if (d.key === "people" || (regroups && !isSplit())) {
        const withValue = `SS ${d.name} = ${fmt(d.value)}`;
        // A name beside the total keeps its value only if both fit before the edge.
        const narrowBucket = design
          ? wideSquare.x + wideSquare.side + 18 + withValue.length * (compact ? 7.2 : 7.8) > width - 8
          : regroups && wideSquare.side < 150;
        return { name: state.calculations && !narrowBucket ? withValue : `SS ${d.name}`, value: "" };
      }
      return { name: `SS ${d.name}`, value: state.calculations ? fmt(d.value) : "" };
    }

    // The edge a comparison label keeps to: the total's, then the sum's, then the mean
    // square's. While the sum is cut, `spread` gives the outer edge of its spread pieces.
    function labelEdge(d, spread) {
      const above = d.key === "between" || FACTOR_KEYS.includes(d.key);
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
        // Error is too thin to hold its name, which sits in the top right of the people
        // layer instead, with a leader up into the layer it names.
        // So is the second factor, often, which sits in the top right of the first's layer.
        if ((people && d.key === "within" && peoplePoured()) || (design && d.key === "factor-b")) {
          const sheet = ssGeometry(d, d.value, layout);
          const under = sheet.y + sheet.height;
          const right = layout.x + layout.side - 8;
          return {
            transform: none,
            name: { x: right, y: under + 20, anchor: "end" },
            value: { x: right, y: under + 36, anchor: "end" },
            leader: { x1: right - 8, y1: under + 7, x2: right - 8, y2: sheet.y + sheet.height / 2 }
          };
        }
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
      // People stay in the total, labelled in the corner of their layer.
      if (d.key === "people") {
        const top = ssGeometry(d, d.value, wideSquare).y;
        const left = { x: wideSquare.x + 10, y: top + 22, anchor: "start" };
        return { transform: none, name: left, value: left };
      }
      // Between and error are labelled beside the total until they leave it, as are the
      // factors, the interaction and within.
      if (regroups && !isSplit()) {
        const layer = ssGeometry(d, d.value, wideSquare);
        const mid = layer.y + layer.height / 2;
        const right = wideSquare.x + wideSquare.side;
        const beside = { x: right + 18, y: mid + 5, anchor: "start" };
        return { transform: none, name: beside, value: beside, leader: { x1: right + 2, y1: mid, x2: right + 14, y2: mid } };
      }
      const edge = labelEdge(d, spread);
      const cx = partCx(d);
      // Lines read name then value either way; between's stack up away from its shape.
      if (d.key === "between" || FACTOR_KEYS.includes(d.key)) {
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
      if (regroups) {
        const end = p.leader || { x1: 0, y1: 0, x2: 0, y2: 0 };
        target.select(".ave-leader")
          .attr("x1", end.x1).attr("y1", end.y1).attr("x2", end.x2).attr("y2", end.y2)
          .style("opacity", p.leader ? 0.6 : 0);
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

    function renderSquares(animate, revealKey, liftDelay, splitting, pourDelay) {
      const wide = wideLayout();
      const split = isSplit();
      const layout = squareLayout();
      const duration = animate ? 760 : 0;
      const subtitleText = state.stage === "populations"
        ? "The squared deviations will collect here"
        : buildStages.includes(state.stage) || state.stage === "centre"
          ? (state.phase === "sum" ? "Adding the squared deviations" : "Build each squared deviation first")
          : people ? "Total = between + people + error" : "Total = between + within";
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
        .style("opacity", split && !people ? 0 : 1);
      container.exit().transition().duration(animate ? 220 : 0).style("opacity", 0).remove();

      const data = aggregateSquares().filter((d) => aggregateRevealLevel() >= d.reveal);
      const items = squaresLayer.selectAll("g.ave-ss-item").data(data, (d) => d.key);
      const entered = items.enter().append("g").attr("class", "ave-ss-item");
      entered.append("rect")
        .attr("class", "ave-square")
        .attr("fill-opacity", (d) => d.fillOpacity || 0.18).attr("stroke-width", 1.5)
        .each(function(d) { setRect(d3.select(this), ssGeometry(d, 0, layout)); });
      const merged = entered.merge(items);
      // The total has no square of its own once its layers have split away.
      merged.filter((d) => d.key === "total")
        .transition().duration(splitting ? partDuration : duration)
        .style("opacity", split && !people ? 0 : 1);

      const geometry = (d) => split && d.df ? ssSquareGeometry(d) : ssGeometry(d, d.value, layout);
      // The total is the fill itself; the container draws its outline.
      const sumRects = merged.select("rect")
        .attr("fill", (d) => d.color)
        .attr("stroke", (d) => d.key === "total" ? "none" : d.color);
      // The sum being revealed starts empty; animateContributions raises it as each piece lands.
      const driven = (d) => animate && d.key === revealKey;
      sumRects.filter(driven).each(function(d) { setRect(d3.select(this), ssGeometry(d, 0, layout)); });
      // As people pour in, within stays whole; it gives way as each piece lands.
      const yielding = (d) => animate && ((revealKey === "people" && d.key === "within") ||
        (design && FACTOR_KEYS.includes(revealKey) && d.key === "between"));
      sumRects.filter(yielding).each(function() {
        setRect(d3.select(this), design ? betweenBeforeGeometry(revealKey, layout) : wholeWithin(layout));
      });
      sumRects.filter((d) => !driven(d) && !yielding(d))
        .transition()
        .duration(squareDuration).ease(d3.easeCubicInOut)
        .attr("x", (d) => geometry(d).x)
        .attr("y", (d) => geometry(d).y)
        .attr("width", (d) => geometry(d).width)
        .attr("height", (d) => geometry(d).height);
      // The slot people leave stands empty until the centred scores' squares fill it.
      if (people) {
        const emptied = peoplePoured() && !errorCounted();
        sumRects.filter((d) => d.key === "within").transition("tint")
          .delay(animate && revealKey === "people" ? (pourDelay || 0) + pourDuration : 0)
          .duration(animate && emptied ? 500 : 0)
          .attr("fill-opacity", emptied ? 0.05 : 0.18);
      }
      // Likewise the slot the factors leave in between, until the interaction fills it.
      if (design) {
        const emptied = factorPoured("factor-a") && !interactionCounted();
        sumRects.filter((d) => d.key === "between").transition("tint")
          .delay(animate && FACTOR_KEYS.includes(revealKey) ? (pourDelay || 0) + pourDuration : 0)
          .duration(animate && emptied ? 500 : 0)
          .attr("fill-opacity", emptied ? 0.05 : 0.18);
      }
      // A sum broken into its mean square fades as its pieces appear.
      sumRects.transition("lift")
        .delay(animate ? liftDelay : 0)
        .duration(animate ? 420 : 0)
        .style("opacity", (d) => isLifted(d) ? 0 : 1);
      // Once both layers fill the total, its own grey underneath would only tint them.
      sumRects.filter((d) => d.key === "total").transition("tint")
        .delay(animate && revealKey === "between" ? (pourDelay || 0) + pourDuration : 0)
        .duration(animate ? 400 : 0)
        .attr("fill-opacity", aggregateRevealLevel() >= 3 ? 0 : 0.18);

      items.exit()
        .transition().duration(animate ? 220 : 0)
        .style("opacity", 0)
        .remove();
    }

    function wholeWithin(layout) {
      return ssGeometry({ base: 0 }, stats.ssWithin, layout);
    }

    function betweenBeforeGeometry(key, layout) {
      const before = betweenBefore(key);
      return ssGeometry({ base: before.base }, before.value, layout);
    }

    // Pour each squared deviation into the container: it flies to the mouth, drops to the
    // surface, and spreads flat across it as the level rises by exactly its area.
    function animateContributions(revealKey, animate, delay) {
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
        sumRect,
        delay,
        onLand: revealKey === "people" ? (total, duration) => {
          squaresLayer.selectAll("g.ave-ss-item").filter((d) => d.key === "within").select("rect")
            .transition().duration(duration).ease(d3.easeCubicOut)
            .attr("height", wholeWithin(layout).height * (1 - total / stats.ssWithin));
        } : design && FACTOR_KEYS.includes(revealKey) ? (total, duration) => {
          // Between gives way from the bottom as the factor rises into it.
          const before = betweenBefore(revealKey);
          squaresLayer.selectAll("g.ave-ss-item").filter((d) => d.key === "between").select("rect")
            .transition().duration(duration).ease(d3.easeCubicOut)
            .attr("height", betweenBeforeGeometry(revealKey, layout).height * (1 - total / before.value));
        } : undefined
      });
    }

    // Each mean square takes its sum's place by the line, so F needs no further move.
    function msGeometry(d) {
      const geometry = besideLine(d, areaSide(d.ms, wideSquare));
      return { ...geometry, side: geometry.width };
    }

    function msDetail(d) {
      return state.calculations
        ? `${fmt(d.value)} ÷ ${d.df} = ${fmt(d.ms, regroups ? 2 : 1)}`
        : `SS ${d.name} ÷ ${d.df}`;
    }

    function renderMeanSquares(animate, revealKeys) {
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
      merged.filter((d) => !(animate && revealKeys.includes(d.key)))
        .transition().duration(animate ? 300 : 0)
        .style("opacity", 1);
      merged.filter((d) => animate && revealKeys.includes(d.key)).style("opacity", 0);
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
        cx: partCx(d),
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
      const data = aggregateSquares().filter(layerLabelled);
      const labels = labelsLayer.selectAll("g.ave-label").data(data, (d) => d.key);
      const entered = labels.enter().append("g").attr("class", "ave-label").style("opacity", 0);
      entered.append("text").attr("class", "ave-ss-label").attr("fill", (d) => d.color);
      entered.append("text").attr("class", "ave-ss-value");
      if (regroups) entered.append("line").attr("class", "ave-leader").style("opacity", 0);
      entered.each(function(d) { placeLabel(d3.select(this), d); });
      // Within's name stays until people have finished pouring into it.
      labels.exit().transition()
        .delay(animate && (moves.revealKey === "people" || (design && FACTOR_KEYS.includes(moves.revealKey))) ? (moves.pourDelay || 0) + pourDuration : 0)
        .duration(animate ? 220 : 0).style("opacity", 0).remove();
      const merged = entered.merge(labels);
      // The total's label goes with the total once it has split.
      const opacity = (d) => isSplit() && !people && d.key === "total" ? 0 : 1;

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
        const cut = moves.cuts.find((plan) => plan.d.key === d.key);
        if (cut) {
          // Out with the pieces as they spread, then in with the stack.
          const { spreadAt, spreadDuration, stackStart, landAt } = cut;
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
        // Within becomes error as people finish pouring.
        const poured = d.key === moves.revealKey || (moves.revealKey === "people" && d.key === "within") ||
          (design && FACTOR_KEYS.includes(moves.revealKey) && d.key === "between");
        const delay = poured && d.key !== "total" ? (moves.pourDelay || 0) + pourDuration : 0;
        label.transition().delay(delay).duration(moves.splitting ? 900 : 760).ease(d3.easeCubicInOut)
          .call(placeLabel, d)
          .style("opacity", opacity(d));
      });
    }

    // F is the fraction itself: the gap the two have kept since the partition gets its bar.
    // With factors there are three fractions over one denominator. The within mean square
    // stands under the middle numerator; dashed copies of it slide out under the other two,
    // since it's the same quantity used three times. Each F's value goes under its fraction.
    function renderFactorialFraction(animate, after) {
      const show = state.phase === "f";
      const within = aggregateSquares().find((d) => d.key === "within");
      const denominator = msGeometry(within);
      const fValue = { "factor-a": stats.levelStats[0].f, "factor-b": stats.levelStats[1].f, between: stats.fInteraction };
      const items = NUMERATOR_KEYS.map((key) => {
        const d = aggregateSquares().find((item) => item.key === key);
        const half = Math.max(msGeometry(d).side, denominator.side) / 2 + (compact ? 6 : 10);
        return { key, cx: numeratorX[key], half };
      });
      const delay = show && animate ? 150 + after : 0;
      fractionLayer.selectAll("*").interrupt();
      const bars = fractionLayer.selectAll("line.ave-factor-bar").data(show ? items : [], (d) => d.key);
      bars.enter().append("line").attr("class", "ave-factor-bar")
        .attr("stroke", "currentColor").attr("stroke-width", 2.5).attr("stroke-linecap", "round")
        .attr("y1", midline).attr("y2", midline)
        .attr("x1", (d) => d.cx).attr("x2", (d) => d.cx)
        .merge(bars)
        .transition().delay(delay).duration(animate ? 480 : 0).ease(d3.easeCubicOut)
        .attr("x1", (d) => d.cx - d.half).attr("x2", (d) => d.cx + d.half)
        .attr("y1", midline).attr("y2", midline);
      bars.exit().transition().duration(animate ? 200 : 0).style("opacity", 0).remove();

      const copies = fractionLayer.selectAll("rect.ave-denominator-copy")
        .data(show ? items.filter((d) => d.key !== "factor-b") : [], (d) => d.key);
      copies.enter().append("rect").attr("class", "ave-denominator-copy ave-square")
        .attr("fill", "none").attr("stroke", "var(--ave-within)").attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "4 3")
        .attr("x", denominator.x).attr("y", denominator.y)
        .attr("width", denominator.side).attr("height", denominator.side)
        .style("opacity", 0)
        .merge(copies)
        .transition().delay(delay + (animate ? 300 : 0)).duration(animate ? 700 : 0).ease(d3.easeCubicInOut)
        .attr("x", (d) => d.cx - denominator.side / 2).attr("y", denominator.y)
        .attr("width", denominator.side).attr("height", denominator.side)
        .style("opacity", 1);
      copies.exit().transition().duration(animate ? 200 : 0).style("opacity", 0).remove();

      // Under the within label in the middle, and level with it either side.
      const labelY = denominator.y + denominator.side + (compact ? 58 : 64);
      const values = fractionLayer.selectAll("text.ave-factor-f").data(show ? items : [], (d) => d.key);
      values.enter().append("text").attr("class", "ave-equation ave-factor-f").attr("text-anchor", "middle")
        .style("opacity", 0)
        .merge(values)
        .attr("x", (d) => d.cx).attr("y", labelY)
        .text((d) => state.calculations ? `F = ${fmt(fValue[d.key])}` : "F")
        .transition().delay(delay + (animate ? 700 : 0)).duration(animate ? 300 : 0)
        .style("opacity", 1);
      values.exit().transition().duration(animate ? 200 : 0).style("opacity", 0).remove();
    }

    function renderFraction(animate, after) {
      if (design) {
        renderFactorialFraction(animate, after);
        return;
      }
      const show = state.phase === "f";
      const cx = compareCx;
      const half = d3.max(aggregateSquares().filter((d) => d.df), (d) => msGeometry(d).side) / 2 + (compact ? 8 : 22);
      const textGap = compact ? 8 : 14;
      fractionLayer.selectAll("*").interrupt();
      fractionLeft
        .attr("x", cx - half - textGap).attr("y", midline + 7)
        .text("F =");
      fractionRight
        .attr("x", cx + half + textGap).attr("y", midline + 7)
        .text(state.calculations ? `= ${fmt(people ? stats.fRelated : stats.f)}` : "");
      fractionBar
        .attr("y1", midline).attr("y2", midline)
        .attr("x1", cx - (show && animate ? 0 : half))
        .attr("x2", cx + (show && animate ? 0 : half));
      const delay = show && animate ? 150 + after : 0;
      fractionBar.transition().delay(delay).duration(animate ? 480 : 0).ease(d3.easeCubicOut)
        .attr("x1", cx - half).attr("x2", cx + half)
        .style("opacity", show ? 1 : 0);
      fractionLayer.selectAll("text").transition().delay(show ? delay + 300 : 0).duration(animate ? 300 : 0)
        .style("opacity", show ? 1 : 0);
    }

    // What the factorial stages show, for the figure's title. Stages shared with Chapter 14
    // fall through to the usual descriptions.
    function factorialDescription() {
      const [a, b] = factors;
      const f = activeFactor();
      if (state.stage === "populations") {
        return `Four groups of sampled scores, one for each combination of ${a.name} and ${b.name}.`;
      }
      if (f >= 0) {
        const factor = factors[f];
        return {
          recolour: `The same scores in the same places, recoloured by ${factor.name}: ${factor.levels.join(" or ")}.`,
          rows: `One row for each level of ${factor.name}, holding every score at that level.`,
          observe: `Each ${factor.name} mean, standing in for every score at its level, and the grand mean.`,
          deviations: `Each ${factor.name} mean's deviation from the grand mean.`,
          squares: `Each ${factor.name} mean's deviation from the grand mean drawn as a square.`,
          sum: `The squared deviations for ${factor.name}, one per score, collected at the bottom of the between-groups layer.`
        }[state.phase];
      }
      if (state.stage === "interaction") {
        return {
          observe: `Each group's mean, and the mean that ${a.name} and ${b.name} alone would predict for it.`,
          deviations: "Each group mean's distance from its prediction.",
          squares: "Each group mean's distance from its prediction drawn as a square.",
          sum: "The squared distances from the predictions, one per score, filling what's left of the between-groups layer: the interaction."
        }[state.phase];
      }
      if (state.stage === "compare") {
        return {
          partition: `The total sum of squares, filled by a within-groups layer, then ${a.name}, ${b.name} and their interaction.`,
          split: `The ${a.name}, ${b.name} and interaction layers in a row above a line, and within groups below it, each redrawn as a square of the same area.`,
          "ms-between": `The ${a.name}, ${b.name} and interaction sums of squares, each divided by its degrees of freedom to give its mean square.`,
          "ms-within": `The within-groups sum of squares broken into ${stats.dfWithin} equal squares; one of them is the within-groups mean square.`,
          f: "Three F ratios, each with the within-groups mean square as its denominator."
        }[state.phase];
      }
      return null;
    }

    function stageDescription() {
      if (state.stage === "populations") {
        const count = ["Two", "Three", "Four", "Five", "Six"][groups.length - 2] || String(groups.length);
        return `${count} groups of sampled scores with different centers and variation among people within each group.`;
      }
      if (design) {
        const description = factorialDescription();
        if (description) return description;
      }
      if (state.stage === "compare" && people) {
        return {
          partition: "The total sum of squares, filled by a people layer at the bottom, an error layer above it and a between-groups layer on top.",
          split: "The between-groups and error layers leave the total, each redrawn as a square of the same area. The people layer stays behind.",
          "ms-between": `The between-groups sum of squares broken into ${stats.dfBetween} equal ${stats.dfBetween === 1 ? "square" : "squares"}; one of them is the between-groups mean square.`,
          "ms-within": `The error sum of squares broken into ${stats.dfError} equal squares; one of them is the error mean square.`,
          f: "The F ratio drawn as a fraction: the between-groups mean square above a bar and the error mean square below it."
        }[state.phase];
      }
      if (state.stage === "people" && state.phase === "recolour") {
        return "The same scores in the same places, recoloured so that each person's scores share a colour.";
      }
      if (state.stage === "people" && state.phase === "rows") {
        return "One row per person, each in its own colour.";
      }
      if (state.stage === "centre" && state.phase === "shift") {
        return "Each person's row shifted so that their mean sits on the grand mean, carrying outlines of their three scores with it. Their squared deviations have shrunk to nothing.";
      }
      if (state.stage === "centre") {
        return "Outlines of each person's centred scores, back in the condition lanes, with what's left of each score around its condition mean.";
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
        between: "each group mean, standing in for every score in its group, and the grand mean",
        people: "each person's mean, standing in for all of their scores, and the grand mean"
      };
      const phases = {
        observe: "showing the relevant scores and means",
        deviations: "showing deviation lines",
        squares: "showing each deviation as the edge of a square",
        sum: "collecting the squared deviations into their sum of squares"
      };
      return `${state.stage === "people" ? "between-people" : state.stage} variability: ${phases[state.phase]} for ${subjects[state.stage]}.`;
    }

    let lastRenderedStage = null;
    let lastRenderedPhase = null;
    let lastRowsKey = "lanes";
    let lastGrouping = null;
    let lastStandIns = false;
    let lastPersonColoured = false;

    // The order of a change of grouping, one thing at a time: stand-ins fade as the real
    // scores come back, then the colours change, then the old names go and the new ones
    // come, and only then do the scores move. Only people change grouping like this.
    // Each person's squared deviation shrinks to nothing as their mean reaches the grand mean:
    // centring is what removes it. These stand in for the real squares, which have left.
    function shrinkPersonSquares(moves) {
      deviationLayer.selectAll(".ave-shrinking, .ave-shrinking *").interrupt();
      deviationLayer.selectAll(".ave-shrinking").remove();
      if (!moves.shifting || !["squares", "sum"].includes(lastRenderedPhase)) return;
      const rows = deviationLayer.selectAll("g.ave-shrinking").data(deviationData("people"))
        .enter().append("g").attr("class", "ave-shrinking");
      const shrink = (selection) => selection.transition()
        .delay((d) => moves.shiftAt(d.groupIndex)).duration(SHIFT_DURATION).ease(d3.easeCubicInOut);
      const squaresShown = rows.append("rect").attr("class", "anova-dev-square")
        .attr("fill", (d) => d.color).attr("stroke", (d) => d.color)
        .each(function(d) {
          const square = deviationSquareGeometry(d);
          d3.select(this).attr("x", square.x).attr("y", square.y)
            .attr("width", square.side).attr("height", square.side);
        });
      shrink(squaresShown)
        .attr("x", (d) => x(d.to)).attr("y", (d) => d.y).attr("width", 0).attr("height", 0);
      const lines = rows.append("line").attr("class", "anova-dev").attr("stroke", (d) => d.color)
        .attr("x1", (d) => x(d.from)).attr("x2", (d) => x(d.to))
        .attr("y1", (d) => d.y).attr("y2", (d) => d.y);
      shrink(lines).attr("x1", (d) => x(d.to));
    }

    function planRegrouping(animate) {
      const clearing = animate && regroups && lastStandIns && !hasStandIns() ? squares.GHOST_FADE + 100 : 0;
      // From one set of rows to another (lanes, people, or either factor's levels) is a move.
      const crossing = animate && regroups && lastRowsKey !== rowsKey();
      // With factors, any change into a new grouping recolours first.
      const recolouring = animate && (design
        ? lastGrouping !== grouping() && regrouped()
        : Boolean(people) && !lastPersonColoured && personColoured());
      const shifting = animate && Boolean(people) && state.stage === "centre" && state.phase === "shift" &&
        lastRenderedStage === "people";
      return {
        crossing,
        shifting,
        shiftAt: (i) => squares.GHOST_FADE + squares.GHOST_RISE + i * SHIFT_STAGGER,
        fillDelay: recolouring ? clearing + 150 : 0,
        labelsOut: crossing ? clearing : 0,
        labelsIn: crossing ? clearing + 500 : 0,
        moveAt: crossing ? clearing + 1000 : 0
      };
    }

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
      // The centred scores' squares fill what's left of within.
      const revealKey = animate && state.phase === "sum" && (!sameStage || lastRenderedPhase !== "sum")
        ? ({ centre: "within", interaction: "between" }[state.stage] || state.stage)
        : null;
      // A step that skips phases plays them in turn: after a new stage's dots and means
      // settle, the deviations draw, then their squares grow, then they pour into the sum.
      // (A ghost has to reach its mean first.)
      const settled = hasStandIns() ? squares.GHOST_RISE + squares.GHOST_SLIDE + 60 : 800;
      transitions.lineDelay = transitions.drawLines && !sameStage ? settled : 0;
      transitions.squareDelay = transitions.drawLines && transitions.growSquares
        ? transitions.lineDelay + squares.LINE_DURATION + 250
        : 0;
      const pourDelay = revealKey && transitions.growSquares
        ? transitions.squareDelay + squares.SQUARE_DURATION + 350
        : 0;
      // Mean squares build only when stepping forward into their phase.
      const previousCompareIndex = sameStage ? COMPARE_PHASES.indexOf(lastRenderedPhase) : -1;
      const msKey = animate && comparePhaseIndex() > previousCompareIndex
        ? { "ms-between": "between", "ms-within": "within" }[state.phase] || null
        : null;
      // With factors, the three numerators are cut together.
      const keysFor = (key) => design && key === "between" ? NUMERATOR_KEYS : [key];
      // With people, Chapter 14 has already taught the cut, so going straight from the split
      // to F makes both cuts at once. F's bar waits for them to land.
      const cutsTogether = animate && regroups && state.phase === "f" &&
        lastRenderedStage === "compare" && lastRenderedPhase === "split";
      const msKeys = cutsTogether ? [...keysFor("between"), "within"] : msKey ? keysFor(msKey) : [];
      const splitting = animate && state.phase === "split" &&
        lastRenderedStage === "compare" && lastRenderedPhase === "partition";
      // Moving the total out of the panel comes first; anything after waits for it.
      const layoutChanged = lastRenderedStage !== null && wideLayout() !== (lastRenderedStage === "compare");
      const layoutDelay = animate && layoutChanged ? 800 : 0;
      const cuts = msKeys.map((key) => planCut(key, layoutDelay));
      svg.select(".ave-title").text(stageDescription());
      plotGroup.interrupt().transition().duration(animate ? 500 : 0)
        .style("opacity", wideLayout() ? 0 : 1);
      renderPopulations(state.stage === "populations", animate);
      const regrouping = planRegrouping(animate);
      renderLanes(animate, regrouping);
      renderDeviations(animate, transitions);
      shrinkPersonSquares(regrouping);
      renderMeans(animate, regrouping);
      renderGhosts(animate, regrouping);
      renderDots(animate, regrouping);
      renderSquares(animate, revealKey, layoutDelay, splitting, pourDelay);
      renderMeanSquares(animate, msKeys);
      renderLabels(animate, { layoutChanged, layoutDelay, cuts, splitting, revealKey, pourDelay });
      animateContributions(revealKey, animate, pourDelay);
      cuts.forEach(animateMeanSquare);
      renderFraction(animate, cutsTogether ? d3.max(cuts, (cut) => cut.landAt) + 300 : 0);
      updateCalculationBox();
      lastRenderedStage = state.stage;
      lastRenderedPhase = state.phase;
      lastRowsKey = rowsKey();
      lastGrouping = grouping();
      lastStandIns = hasStandIns();
      lastPersonColoured = personColoured();
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
          // The SVG's own content box: beside side arrows the tutorial pads it, and drawing
          // to the root's width would shrink everything, text included, to fit.
          container: svg.node(),
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
