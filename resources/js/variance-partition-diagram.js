vpdFiniteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

vpdPositiveNumber = (value, fallback) => {
  const number = vpdFiniteNumber(value);
  return number > 0 ? number : fallback;
}

vpdBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
    if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
  }
  return Boolean(value);
}

vpdKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-")

vpdPrefersReducedMotion = () => {
  if (window.interactiveRuntime && window.interactiveRuntime.motion) {
    return window.interactiveRuntime.motion.isReduced();
  }
  return Boolean(window.sfsReducedMotion) || Boolean(window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// The variance sources keep one fixed identity color each across every ANOVA
// variant, so "individual differences" looks the same in chapter 14, 15, and
// 16. Colors are paired with the word labels, never used alone, and they match
// the ANOVA explorer: purple for the effect, red for chance, brown for people.
vpdSourceCatalog = {
  "treatment": { label: "Treatment effect", color: "var(--sfs-effect-color, #7654b5)" },
  "chance": { label: "Chance", color: "var(--sfs-current-color, #d1495b)" },
  "error": { label: "Sampling error", color: "var(--sfs-current-color, #d1495b)" },
  "remaining": { label: "Remaining chance", color: "var(--sfs-current-color, #d1495b)" },
  "ind-diff": { label: "Individual differences", color: "var(--sfs-people-color, #8a5a2b)" }
}

vpdNormalizeSource = (value) => {
  const key = vpdKey(value);
  if (vpdSourceCatalog[key]) return key;
  if (["individual-differences", "individual-difference", "ind-diffs", "inddiff"].includes(key)) {
    return "ind-diff";
  }
  if (["sampling-error", "sampling"].includes(key)) return "error";
  if (["treatment-effect"].includes(key)) return "treatment";
  return null;
}

// Reveal stages, in build-up order. An element tagged with a stage is visible
// once the current stage reaches it; presets without a "subdivide" level just
// have nothing tagged at that stage.
vpdStageOrder = ["total", "split", "sources", "subdivide", "formula"]

vpdNormalizeStage = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(Math.round(value), vpdStageOrder.length));
  }
  const key = vpdKey(value);
  if (["all", "full", "complete", "end"].includes(key)) return vpdStageOrder.length;
  const index = vpdStageOrder.indexOf(key);
  return index >= 0 ? index : fallback;
}

// --- Minimal math labels ------------------------------------------------
// Node labels need statistical symbols like MS_{between treatments}. Rather
// than unicode subscripts (no letters like b/w available), parse a tiny
// TeX-like syntax into tspans: base text italic in the math font, _{...}
// subscripts smaller and lowered in roman.

vpdParseMath = (expr) => {
  const source = String(expr || "").replace(/^\$|\$$/g, "");
  const segments = [];
  const pattern = /_\{([^}]*)\}|\^\{([^}]*)\}|_([A-Za-z0-9×])|\^([A-Za-z0-9×])/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > cursor) {
      segments.push({ text: source.slice(cursor, match.index), script: null });
    }
    if (match[1] !== undefined || match[3] !== undefined) {
      segments.push({ text: match[1] !== undefined ? match[1] : match[3], script: "sub" });
    } else {
      segments.push({ text: match[2] !== undefined ? match[2] : match[4], script: "sup" });
    }
    cursor = pattern.lastIndex;
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), script: null });
  }
  return segments;
}

vpdIsMathLine = (line) => /^\$[^$]*\$$/.test(String(line || "").trim())

vpdMathWidth = (expr, size) =>
  vpdParseMath(expr).reduce((total, segment) =>
    total + segment.text.length * size * (segment.script ? 0.42 : 0.58), 0)

vpdTextWidth = (text, size) => String(text).length * size * 0.55

// Renders parsed math into an existing <text> selection. Subscript tspans
// shift the baseline down and the following base tspan shifts it back.
vpdRenderMath = (text, expr) => {
  let shifted = false;
  vpdParseMath(expr).forEach((segment) => {
    const tspan = text.append("tspan").text(segment.text);
    if (segment.script) {
      tspan
        .attr("class", "vpd-math-script")
        .attr("dy", segment.script === "sub" ? (shifted ? 0 : "0.28em") : (shifted ? 0 : "-0.35em"));
      shifted = true;
    } else {
      tspan.attr("class", "vpd-math-base");
      if (shifted) tspan.attr("dy", "-0.28em");
      shifted = false;
    }
  });
}

// --- Presets --------------------------------------------------------------
// Geometry lives on a 960-wide canvas. Rows are shared across the ANOVA
// presets so that switching preset morphs nodes instead of rebuilding the
// scene: total on top, between/within below it, subdivisions on a third row.

vpdRow = { r0: { y: 64, h: 80 }, r1: { y: 254, h: 116 }, r2: { y: 478, h: 96 } }

vpdAnovaCommonNodes = (variant) => {
  const related = ["related-problem", "related"].includes(variant);
  return [
    {
      id: "total",
      x: 480, y: vpdRow.r0.y, width: 300, height: vpdRow.r0.h,
      lines: ["Total variability", "in the data"],
      stage: "total", tone: "total", sources: []
    },
    {
      id: "between",
      x: related ? 205 : 245, y: vpdRow.r1.y, width: 310, height: vpdRow.r1.h,
      lines: ["Variance between", "groups", "$MS_{between}$"],
      parent: "total", stage: "split", tone: "between"
    },
    {
      id: "within",
      x: related ? 665 : 715, y: vpdRow.r1.y, width: 310, height: vpdRow.r1.h,
      lines: ["Variance within", "groups", "$MS_{within}$"],
      parent: "total", stage: "split", tone: "within"
    }
  ];
}

vpdPresetSpecs = {
  "independent": () => {
    const nodes = vpdAnovaCommonNodes("independent");
    nodes[1].sources = ["treatment", "chance"];
    nodes[2].sources = ["chance"];
    return {
      nodes,
      formula: {
        ratios: [{ f: "F", num: "MS_{between}", den: "MS_{within}" }],
        concept: { num: ["treatment", "chance"], den: ["chance"] }
      },
      alt: "Partitioning diagram: total variability splits into variance " +
        "between groups (treatment effect plus chance) and variance within " +
        "groups (chance alone); their ratio is the F statistic."
    };
  },

  "independent-detailed": () => {
    const nodes = vpdAnovaCommonNodes("independent-detailed");
    nodes[1].sources = ["treatment", "error", "ind-diff"];
    nodes[2].sources = ["error", "ind-diff"];
    return {
      nodes,
      formula: {
        ratios: [{ f: "F", num: "MS_{between}", den: "MS_{within}" }],
        concept: { num: ["treatment", "error", "ind-diff"], den: ["error", "ind-diff"] }
      },
      alt: "Partitioning diagram for an independent-samples ANOVA: variance " +
        "between groups contains treatment effect, sampling error, and " +
        "individual differences; variance within groups contains sampling " +
        "error and individual differences. The chance sources balance out " +
        "in the F ratio."
    };
  },

  "related-problem": () => {
    const nodes = vpdAnovaCommonNodes("related-problem");
    nodes[1].sources = ["treatment", "error"];
    nodes[2].sources = ["error", "ind-diff"];
    return {
      nodes,
      formula: {
        ratios: [{ f: "F", num: "MS_{between}", den: "MS_{within}" }],
        concept: { num: ["treatment", "error"], den: ["error", "ind-diff"] }
      },
      alt: "Partitioning diagram showing the related-samples problem: the " +
        "design removes individual differences from variance between " +
        "groups, but they remain in variance within groups, so the " +
        "usual F ratio is unbalanced."
    };
  },

  "related": () => {
    const nodes = vpdAnovaCommonNodes("related");
    nodes[1].sources = ["treatment", "remaining"];
    nodes[2].sources = ["remaining", "ind-diff"];
    nodes.push(
      {
        id: "error",
        x: 545, y: vpdRow.r2.y, width: 220, height: vpdRow.r2.h,
        lines: ["Error", "$MS_{error}$"],
        parent: "within", stage: "subdivide", tone: "within",
        sources: ["remaining"]
      },
      {
        id: "between-people",
        x: 805, y: vpdRow.r2.y, width: 260, height: vpdRow.r2.h,
        lines: ["Between people", "$MS_{people}$"],
        parent: "within", stage: "subdivide", tone: "people",
        sources: ["ind-diff"]
      }
    );
    return {
      nodes,
      formula: {
        ratios: [{ f: "F", num: "MS_{between}", den: "MS_{error}" }],
        concept: { num: ["treatment", "remaining"], den: ["remaining"] }
      },
      alt: "Partitioning diagram for a related-samples ANOVA: variance " +
        "within groups contains remaining chance and individual differences, " +
        "and is further partitioned into variance between people " +
        "(individual differences) and error variance (remaining chance). " +
        "The F ratio uses mean square error as its denominator."
    };
  },

  "factorial": () => {
    const nodes = vpdAnovaCommonNodes("factorial");
    nodes[1].x = 350;
    nodes[1].sources = [];
    nodes[2].x = 780;
    nodes[2].sources = [];
    nodes.push(
      {
        id: "factor-a",
        x: 145, y: vpdRow.r2.y, width: 200, height: vpdRow.r2.h,
        lines: ["Factor A", "$MS_A$"],
        parent: "between", stage: "subdivide", tone: "between", sources: []
      },
      {
        id: "factor-b",
        x: 400, y: vpdRow.r2.y, width: 200, height: vpdRow.r2.h,
        lines: ["Factor B", "$MS_B$"],
        parent: "between", stage: "subdivide", tone: "between", sources: []
      },
      {
        id: "interaction",
        x: 655, y: vpdRow.r2.y, width: 240, height: vpdRow.r2.h,
        lines: ["A × B interaction", "$MS_{A×B}$"],
        parent: "between", stage: "subdivide", tone: "between", sources: []
      }
    );
    return {
      nodes,
      formula: {
        ratios: [
          { f: "F_A", num: "MS_A", den: "MS_{within}" },
          { f: "F_B", num: "MS_B", den: "MS_{within}" },
          { f: "F_{A×B}", num: "MS_{A×B}", den: "MS_{within}" }
        ]
      },
      alt: "Partitioning diagram for a factorial ANOVA: variance between " +
        "treatments is further partitioned into Factor A, Factor B, and the " +
        "A by B interaction, each of which is compared against variance " +
        "within groups in its own F ratio."
    };
  },

  "regression": () => ({
    nodes: [
      {
        id: "total",
        x: 480, y: vpdRow.r0.y, width: 330, height: 88,
        lines: ["Total variability in Y", "$SS_Y$"],
        stage: "total", sources: []
      },
      {
        id: "regression",
        x: 245, y: 250, width: 330, height: 92,
        lines: ["Predictable variability", "$SS_{regression}$"],
        parent: "total", stage: "split", tone: "between", sources: []
      },
      {
        id: "residual",
        x: 715, y: 250, width: 340, height: 92,
        lines: ["Unpredictable variability", "$SS_{residual}$"],
        parent: "total", stage: "split", tone: "neutral", sources: []
      }
    ],
    formula: {
      ratios: [{ f: "F", num: "MS_{regression}", den: "MS_{residual}" }]
    },
    alt: "Partitioning diagram for regression: the total variability in Y " +
      "splits into predictable variability (sum of squares regression) and " +
      "unpredictable variability (sum of squares residual); their mean " +
      "squares form the F ratio."
  })
}

vpdNormalizePreset = (value) => {
  const key = vpdKey(value);
  if (vpdPresetSpecs[key]) return key;
  if (["anova", "between-groups", "independent-samples", "basic"].includes(key)) return "independent";
  if (["independent-full", "detailed", "three-sources"].includes(key)) return "independent-detailed";
  if (["problem", "related-samples-problem"].includes(key)) return "related-problem";
  if (["related-samples", "repeated-measures", "solution", "related-solution"].includes(key)) return "related";
  if (["two-factor", "two-way", "factorial-anova"].includes(key)) return "factorial";
  if (["analysis-of-regression", "regression-anova"].includes(key)) return "regression";
  return "independent";
}

// --- Narrow layout ---------------------------------------------------------
// Scaling the 960-wide canvas down to a phone leaves 6-8px text. Below
// vpdCompactBelow the canvas instead matches the space available at a fixed
// scale, so font sizes stop tracking the width, and the nodes are placed in
// rows to fit it.

vpdCanvasWidth = 960
vpdCompactBelow = 600
vpdCompactScale = 0.66
vpdFormulaRowStep = 104
vpdSourceLineStep = 24

vpdCompactLines = {
  "between": ["Variance", "between groups", "$MS_{between}$"],
  "within": ["Variance", "within groups", "$MS_{within}$"],
  "interaction": ["A × B", "interaction", "$MS_{A×B}$"],
  "regression": ["Predictable", "variability", "$SS_{regression}$"],
  "residual": ["Unpredictable", "variability", "$SS_{residual}$"]
}

vpdLineHeights = (lines) => lines.map((line) => vpdIsMathLine(line) ? 33 : 28)

// Splits at the last space when a source label won't fit beside its dot.
vpdWrapSourceLabel = (label, limit) => {
  const space = label.lastIndexOf(" ");
  if (vpdTextWidth(label, 19) + 17 <= limit || space < 0) return [label];
  return [label.slice(0, space), label.slice(space + 1)];
}

// Sources block layout for a node: entry rows below the node box. Passing a
// compact canvas width wraps labels to the node's column and keeps each block
// on the canvas.
vpdSourceBlocks = (nodes, compactWidth) => nodes
  .map((node) => {
    if (!(node.sources || []).length) return null;
    let y = node.y + node.height / 2 + 40;
    const entries = node.sources.map((key) => {
      const source = vpdSourceCatalog[key];
      const lines = compactWidth
        ? vpdWrapSourceLabel(source.label, node.width)
        : [source.label];
      const entry = {
        key,
        nodeId: node.id,
        lines,
        color: source.color,
        y,
        width: 17 + Math.max(...lines.map((line) => vpdTextWidth(line, 19)))
      };
      y += 28 + (lines.length - 1) * vpdSourceLineStep;
      return entry;
    });
    const blockWidth = Math.max(...entries.map((entry) => entry.width));
    let blockX = node.x - blockWidth / 2;
    if (compactWidth) {
      blockX = Math.max(10, Math.min(compactWidth - blockWidth - 10, blockX));
    }
    entries.forEach((entry) => { entry.x = blockX; });
    const last = entries[entries.length - 1];
    return {
      nodeId: node.id,
      entries,
      stageIndex: Math.max(vpdStageOrder.indexOf(node.stage), vpdStageOrder.indexOf("sources")),
      bottom: last.y + (last.lines.length - 1) * vpdSourceLineStep + 10
    };
  })
  .filter(Boolean)

vpdSlimNodeWidth = (node) => 28 + Math.max(...node.lines.map((line) =>
  vpdIsMathLine(line) ? vpdMathWidth(line, 25) : vpdTextWidth(line, 23)))

// How far the row below must drop for the sources under a row to clear it:
// past the sources themselves, and far enough that a link slanting across
// them has passed below them by the time it reaches their edge.
vpdSourceClearance = (row, nextRow, canvasWidth, bottom) => {
  let clearance = 0;
  vpdSourceBlocks(row, canvasWidth).forEach((block) => {
    const left = block.entries[0].x - 10;
    const right = left + 20 + Math.max(...block.entries.map((entry) => entry.width));
    const depth = block.bottom - bottom + 6;
    clearance = Math.max(clearance, depth + 48);
    nextRow.forEach((child) => {
      const parent = row.find((node) => node.id === child.parent);
      if (!parent || parent.id === block.nodeId) return;
      const edge = parent.x > child.x ? right : left;
      const reach = Math.abs(child.x - parent.x);
      const toEdge = (edge - parent.x) * Math.sign(child.x - parent.x);
      if (toEdge >= 0 && toEdge < reach) {
        clearance = Math.max(clearance, depth * reach / Math.max(toEdge, 1));
      }
    });
  });
  return clearance;
}

// Each depth of the tree gets its own row. The first split shares the canvas
// in proportion to the widths the wide layout gives those nodes; rows below
// it take only the width their labels need, gathered under their parent.
vpdPlaceCompact = (nodes, canvasWidth) => {
  const margin = 4;
  const gap = 24;
  const rowGap = 48;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depth = (node) => node.parent ? depth(byId.get(node.parent)) + 1 : 0;
  const rows = [];
  nodes.forEach((node) => { (rows[depth(node)] = rows[depth(node)] || []).push(node); });

  rows.forEach((row, index) => {
    const space = canvasWidth - 2 * margin - gap * (row.length - 1);
    const height = Math.max(...row.map((node) =>
      vpdLineHeights(node.lines).reduce((total, h) => total + h, 0) + 24));
    row.forEach((node) => { node.height = height; });

    if (row.length === 1) {
      row[0].width = Math.min(row[0].width, space);
      row[0].x = canvasWidth / 2;
      return;
    }

    const slim = index > 1;
    const weights = row.map((node) => slim ? vpdSlimNodeWidth(node) : node.width);
    const weight = weights.reduce((total, value) => total + value, 0);
    const scale = slim ? Math.min(1, space / weight) : space / weight;
    const rowWidth = weight * scale + gap * (row.length - 1);
    const center = slim ? byId.get(row[0].parent).x : canvasWidth / 2;
    let cursor = Math.max(margin,
      Math.min(canvasWidth - margin - rowWidth, center - rowWidth / 2));
    row.forEach((node, nodeIndex) => {
      node.width = weights[nodeIndex] * scale;
      node.x = cursor + node.width / 2;
      cursor += node.width + gap;
    });
  });

  let top = 6;
  rows.forEach((row, index) => {
    row.forEach((node) => { node.y = top + node.height / 2; });
    const bottom = top + row[0].height;
    if (index < rows.length - 1) {
      top = bottom + Math.max(rowGap,
        vpdSourceClearance(row, rows[index + 1], canvasWidth, bottom));
    }
  });
  return nodes;
}

vpdEnsureStyles = () => {
  if (document.getElementById("variance-partition-diagram-styles")) return;

  const style = document.createElement("style");
  style.id = "variance-partition-diagram-styles";
  style.textContent = `
    .variance-partition-diagram {
      --sfs-figure-max-width: var(--vpd-max-width, 46rem);
      --vpd-between-fill: color-mix(in srgb, var(--sfs-effect-color, #7654b5) 14%, var(--sfs-bg, #fff));
      --vpd-within-fill: color-mix(in srgb, var(--sfs-current-color, #d1495b) 14%, var(--sfs-bg, #fff));
      --vpd-people-fill: color-mix(in srgb, var(--sfs-people-color, #8a5a2b) 14%, var(--sfs-bg, #fff));
      --vpd-total-fill: color-mix(in srgb, var(--sfs-muted, #68727d) 14%, var(--sfs-bg, #fff));
      --vpd-neutral-fill: color-mix(in srgb, var(--sfs-neutral-color, #7b818a) 14%, var(--sfs-bg, #fff));
      --vpd-emphasis-bg: color-mix(in srgb, var(--sfs-current-color, #d1495b) 16%, transparent);
    }

    @supports not (color: color-mix(in srgb, white, black)) {
      .variance-partition-diagram {
        --vpd-between-fill: #e8e2f3;
        --vpd-within-fill: #f9e4e7;
        --vpd-people-fill: #eee6dd;
        --vpd-total-fill: #e7e9eb;
        --vpd-neutral-fill: #e8eaec;
        --vpd-emphasis-bg: rgba(209, 73, 91, 0.16);
      }
    }

    .variance-partition-diagram .vpd-svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
      color: var(--sfs-text, currentColor);
      font-family: var(--bs-body-font-family, system-ui, sans-serif);
    }

    .variance-partition-diagram .vpd-node-shape {
      fill: var(--sfs-bg, #fff);
      stroke: var(--sfs-text, currentColor);
      stroke-width: 1.6;
      transition: fill 450ms ease;
    }

    .variance-partition-diagram .vpd-node-shape.vpd-tone-between { fill: var(--vpd-between-fill); }
    .variance-partition-diagram .vpd-node-shape.vpd-tone-within { fill: var(--vpd-within-fill); }
    .variance-partition-diagram .vpd-node-shape.vpd-tone-people { fill: var(--vpd-people-fill); }
    .variance-partition-diagram .vpd-node-shape.vpd-tone-total { fill: var(--vpd-total-fill); }
    .variance-partition-diagram .vpd-node-shape.vpd-tone-neutral { fill: var(--vpd-neutral-fill); }

    .variance-partition-diagram .vpd-node-text {
      fill: var(--sfs-text, currentColor);
      font-size: 23px;
      font-weight: 600;
      text-anchor: middle;
    }

    .variance-partition-diagram .vpd-math {
      fill: var(--sfs-text, currentColor);
      font-family: var(--sfs-math-font-family, "STIX Two Math", "Cambria Math", serif);
      font-size: 25px;
      text-anchor: middle;
    }

    .variance-partition-diagram .vpd-math .vpd-math-base {
      font-style: italic;
    }

    .variance-partition-diagram .vpd-math .vpd-math-script {
      font-size: 70%;
      font-style: normal;
    }

    .variance-partition-diagram .vpd-link {
      stroke: var(--sfs-muted, currentColor);
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
    }

    .variance-partition-diagram .vpd-source-dot {
      stroke: none;
    }

    .variance-partition-diagram .vpd-source-text {
      fill: var(--sfs-muted, currentColor);
      font-size: 19px;
      font-weight: 550;
      transition: fill 300ms ease, font-weight 300ms ease;
    }

    .variance-partition-diagram .vpd-emphasis-pill {
      fill: var(--vpd-emphasis-bg);
      opacity: 0;
      transition: opacity 300ms ease;
    }

    .variance-partition-diagram .is-emphasized .vpd-emphasis-pill {
      opacity: 1;
    }

    .variance-partition-diagram .is-emphasized .vpd-source-text,
    .variance-partition-diagram .is-emphasized .vpd-concept-text {
      fill: var(--sfs-text, currentColor);
      font-weight: 700;
    }

    .variance-partition-diagram .vpd-concept-text {
      fill: var(--sfs-text, currentColor);
      font-size: 20px;
      font-weight: 600;
      transition: fill 300ms ease;
    }

    .variance-partition-diagram .vpd-frac-bar {
      stroke: var(--sfs-text, currentColor);
      stroke-width: 2;
      stroke-linecap: round;
    }

    .variance-partition-diagram.vpd-no-anim .vpd-node-shape,
    .variance-partition-diagram.vpd-no-anim .vpd-source-text,
    .variance-partition-diagram.vpd-no-anim .vpd-emphasis-pill,
    .variance-partition-diagram.vpd-no-anim .vpd-concept-text {
      transition: none !important;
    }

    @media (prefers-reduced-motion: reduce) {
      .variance-partition-diagram .vpd-node-shape,
      .variance-partition-diagram .vpd-source-text,
      .variance-partition-diagram .vpd-emphasis-pill,
      .variance-partition-diagram .vpd-concept-text {
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// Tutorial steps live in the surrounding callout footer, exactly as
// interactiveFigure.wrap sets up — but this diagram has no controls drawer,
// so wire the tutorial directly.
vpdSetupTutorial = (rootNode, applyAction) => {
  const api = window.interactiveFigure;
  if (!api || typeof api.createTutorial !== "function") return;

  let attempts = 0;
  function trySetup() {
    attempts += 1;
    if (attempts > 60) return;
    if (!rootNode.isConnected) {
      requestAnimationFrame(trySetup);
      return;
    }
    const callout = rootNode.closest(".callout");
    const footer = callout ? callout.querySelector(".callout-footer") : null;
    if (!footer) {
      requestAnimationFrame(trySetup);
      return;
    }
    if (footer.dataset.sfsIfTutorial === "true") return;
    const steps = Array.from(footer.children)
      .filter((child) => child.classList && child.classList.contains("tutorial-step"));
    if (!steps.length) return;
    api.createTutorial({ root: rootNode, footer, steps, applyAction });
  }
  requestAnimationFrame(trySetup);
}

makeVariancePartitionDiagram = function(opts) {
  opts = opts || {};
  vpdEnsureStyles();
  if (window.interactiveFigure) window.interactiveFigure.ensureStyles();

  // The canvas this render is laid out on: the wide presets, or a compact
  // canvas set by the space available (see vpdPlaceCompact).
  let compactWidth = null;
  const canvasWidth = () => compactWidth || vpdCanvasWidth;
  const transitionDuration = vpdPositiveNumber(opts.transitionDuration || opts.duration, 600);
  const labelOverrides = (opts.labels && typeof opts.labels === "object") ? opts.labels : {};
  const showFormulaOption = vpdBoolean(opts.formula ?? opts.showFormula, true);
  const showSourcesOption = vpdBoolean(opts.sources ?? opts.showSources, true);

  const state = {
    preset: vpdNormalizePreset(opts.preset || opts.type),
    stage: vpdNormalizeStage(opts.stage, vpdStageOrder.length),
    emphasize: [],
    spec: null
  };
  if (opts.emphasize !== undefined) state.emphasize = normalizeEmphasis(opts.emphasize);

  function normalizeEmphasis(value) {
    if (value === undefined || value === null) return [];
    const list = Array.isArray(value) ? value : [value];
    return list.map(vpdNormalizeSource).filter(Boolean);
  }

  function buildSpec() {
    const spec = vpdPresetSpecs[state.preset]();
    spec.nodes.forEach((node) => {
      if (!showSourcesOption) node.sources = [];
      if (compactWidth && vpdCompactLines[node.id]) node.lines = vpdCompactLines[node.id];
      const override = labelOverrides[node.id] ??
        labelOverrides[node.id.replace(/-([a-z])/g, (m, c) => c.toUpperCase())];
      if (override !== undefined) {
        node.lines = Array.isArray(override)
          ? override.map(String)
          : String(override).split(/\n|<br\s*\/?>/).map((line) => line.trim()).filter(Boolean);
      }
    });
    if (compactWidth) vpdPlaceCompact(spec.nodes, compactWidth);
    return spec;
  }

  function contentBottom(spec, blocks) {
    const nodeBottom = Math.max(...spec.nodes.map((node) => node.y + node.height / 2));
    const sourceBottom = blocks.length ? Math.max(...blocks.map((block) => block.bottom)) : 0;
    return Math.max(nodeBottom, sourceBottom);
  }

  function svgHeight(spec, blocks, formulaY) {
    if (showFormulaOption && spec.formula) {
      return formulaY + (formulaRows(spec).length - 1) * vpdFormulaRowStep + 64;
    }
    return contentBottom(spec, blocks) + 28;
  }

  const root = d3.create("div")
    .attr("class", "variance-partition-diagram sfs-figure")
    .style("--vpd-max-width", opts.maxWidth || null);
  const rootNode = root.node();

  const chartWrap = root.append("div")
    .attr("class", "vpd-chart-wrap sfs-chart-wrap");

  const svg = chartWrap.append("svg")
    .attr("class", "vpd-svg sfs-svg")
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("role", "img");

  const linkLayer = svg.append("g").attr("class", "vpd-links");
  const nodeLayer = svg.append("g").attr("class", "vpd-nodes");
  const sourceLayer = svg.append("g").attr("class", "vpd-source-blocks");
  const formulaLayer = svg.append("g").attr("class", "vpd-formula");

  let lastFormulaSignature = null;

  function maybeTransition(selection, animate, duration) {
    if (!animate) return selection;
    return selection.transition("vpd-move")
      .duration(duration)
      .ease(d3.easeCubicInOut);
  }

  function setReveal(target, visible, animate) {
    window.interactiveFigure.setRevealVisible(target, visible, {
      root: rootNode,
      animate
    });
  }

  function drawNodeLabel(group, node) {
    group.selectAll("text").remove();
    const lineHeights = vpdLineHeights(node.lines);
    const totalHeight = lineHeights.reduce((total, h) => total + h, 0);
    let cursor = -totalHeight / 2;
    node.lines.forEach((line, index) => {
      const baseline = cursor + lineHeights[index] * 0.78;
      cursor += lineHeights[index];
      if (vpdIsMathLine(line)) {
        const text = group.append("text")
          .attr("class", "vpd-math")
          .attr("x", 0)
          .attr("y", baseline);
        vpdRenderMath(text, line);
      } else {
        group.append("text")
          .attr("class", "vpd-node-text")
          .attr("x", 0)
          .attr("y", baseline)
          .text(line);
      }
    });
  }

  function renderNodes(spec, animate, duration, nodesById) {
    const nodes = nodeLayer.selectAll("g.vpd-node")
      .data(spec.nodes, (node) => node.id);

    const entering = nodes.enter()
      .append("g")
      .attr("class", "vpd-node")
      .attr("data-id", (node) => node.id)
      // New nodes emerge from their parent's position, so a partition step
      // visibly splits out of the component it came from.
      .attr("transform", (node) => {
        const parent = node.parent && nodesById.get(node.parent);
        return parent
          ? `translate(${parent.x},${parent.y})`
          : `translate(${node.x},${node.y})`;
      });
    entering.append("rect")
      .attr("class", "vpd-node-shape")
      .attr("rx", 10)
      .attr("ry", 10)
      .attr("x", (node) => -node.width / 2)
      .attr("y", (node) => -node.height / 2)
      .attr("width", (node) => node.width)
      .attr("height", (node) => node.height);

    nodes.exit().each(function() {
      setReveal(this, false, animate);
    }).transition("vpd-exit").delay(animate ? 300 : 0).remove();

    const merged = entering.merge(nodes);
    merged.each(function(node) {
      const group = d3.select(this);
      group.select("rect")
        .attr("class", node.tone ? `vpd-node-shape vpd-tone-${node.tone}` : "vpd-node-shape");
      drawNodeLabel(group, node);
    });
    maybeTransition(merged, animate, duration)
      .attr("transform", (node) => `translate(${node.x},${node.y})`);
    maybeTransition(merged.select("rect"), animate, duration)
      .attr("x", (node) => -node.width / 2)
      .attr("y", (node) => -node.height / 2)
      .attr("width", (node) => node.width)
      .attr("height", (node) => node.height);

    return merged;
  }

  function renderLinks(spec, animate, duration, nodesById) {
    const sourceBottoms = new Map(vpdSourceBlocks(spec.nodes, compactWidth)
      .map((block) => [block.nodeId, block.bottom]));
    const linkData = spec.nodes
      .filter((node) => node.parent && nodesById.has(node.parent))
      .map((node) => {
        const parent = nodesById.get(node.parent);
        return {
          id: node.id,
          stage: node.stage,
          x1: parent.x,
          y1: Math.max(parent.y + parent.height / 2 + 2,
            (sourceBottoms.get(parent.id) ?? 0) + 12),
          x2: node.x,
          y2: node.y - node.height / 2 - 2
        };
      });

    const links = linkLayer.selectAll("line.vpd-link")
      .data(linkData, (link) => link.id);

    const entering = links.enter()
      .append("line")
      .attr("class", "vpd-link")
      .attr("x1", (link) => link.x1)
      .attr("y1", (link) => link.y1)
      .attr("x2", (link) => link.x1)
      .attr("y2", (link) => link.y1);

    links.exit().each(function() {
      setReveal(this, false, animate);
    }).transition("vpd-exit").delay(animate ? 300 : 0).remove();

    const merged = entering.merge(links);
    maybeTransition(merged, animate, duration)
      .attr("x1", (link) => link.x1)
      .attr("y1", (link) => link.y1)
      .attr("x2", (link) => link.x2)
      .attr("y2", (link) => link.y2);

    return merged;
  }

  function drawSourceEntry(group, entry) {
    group.selectAll("*").remove();
    group.append("rect")
      .attr("class", "vpd-emphasis-pill")
      .attr("x", entry.x - 10)
      .attr("y", entry.y - 20)
      .attr("width", entry.width + 20)
      .attr("height", 28 + (entry.lines.length - 1) * vpdSourceLineStep)
      .attr("rx", 14)
      .attr("ry", 14);
    group.append("circle")
      .attr("class", "vpd-source-dot")
      .attr("cx", entry.x + 5.5)
      .attr("cy", entry.y - 6.5)
      .attr("r", 5.5)
      .style("fill", entry.color);
    const text = group.append("text")
      .attr("class", "vpd-source-text")
      .attr("y", entry.y);
    entry.lines.forEach((line, index) => {
      text.append("tspan")
        .attr("x", entry.x + 17)
        .attr("dy", index ? vpdSourceLineStep : 0)
        .text(line);
    });
  }

  function renderSources(blocks, animate, duration) {
    const blockSel = sourceLayer.selectAll("g.vpd-source-block")
      .data(blocks, (block) => block.nodeId);

    blockSel.exit().each(function() {
      setReveal(this, false, animate);
    }).transition("vpd-exit").delay(animate ? 300 : 0).remove();

    const blockMerged = blockSel.enter()
      .append("g")
      .attr("class", "vpd-source-block")
      .attr("data-node", (block) => block.nodeId)
      .merge(blockSel);

    blockMerged.each(function(block) {
      const entrySel = d3.select(this).selectAll("g.vpd-source-entry")
        .data(block.entries, (entry) => entry.key);

      entrySel.exit().each(function() {
        setReveal(this, false, animate);
      }).transition("vpd-exit").delay(animate ? 300 : 0).remove();

      const entryMerged = entrySel.enter()
        .append("g")
        .attr("class", "vpd-source-entry")
        .attr("data-source", (entry) => entry.key)
        .merge(entrySel);

      entryMerged.each(function(entry) {
        drawSourceEntry(d3.select(this), entry);
        d3.select(this).classed("is-emphasized", state.emphasize.includes(entry.key));
        setReveal(this, true, animate);
      });
    });

    return blockMerged;
  }

  // --- Formula row ----------------------------------------------------------

  function fractionWidth(ratio) {
    return Math.max(vpdMathWidth(ratio.num, 26), vpdMathWidth(ratio.den, 26)) + 16;
  }

  function conceptTermWidth(key) {
    return 17 + vpdTextWidth(vpdSourceCatalog[key].label, 20);
  }

  function conceptRowWidth(keys) {
    return keys.reduce((total, key) => total + conceptTermWidth(key), 0) +
      (keys.length - 1) * 34;
  }

  function drawFraction(group, ratio, centerX, centerY) {
    const barWidth = fractionWidth(ratio);
    const num = group.append("text")
      .attr("class", "vpd-math")
      .attr("x", centerX)
      .attr("y", centerY - 12);
    vpdRenderMath(num, ratio.num);
    const den = group.append("text")
      .attr("class", "vpd-math")
      .attr("x", centerX)
      .attr("y", centerY + 30);
    vpdRenderMath(den, ratio.den);
    group.append("line")
      .attr("class", "vpd-frac-bar")
      .attr("x1", centerX - barWidth / 2)
      .attr("x2", centerX + barWidth / 2)
      .attr("y1", centerY)
      .attr("y2", centerY);
  }

  // A conceptual fraction spells out which variance sources sit above and
  // below the line, reusing the same colored dots as the node annotations.
  function drawConceptRow(group, keys, centerX, baselineY) {
    const rowWidth = conceptRowWidth(keys);
    let cursor = centerX - rowWidth / 2;
    keys.forEach((key, index) => {
      if (index > 0) {
        group.append("text")
          .attr("class", "vpd-concept-text")
          .attr("x", cursor + 10)
          .attr("y", baselineY)
          .attr("text-anchor", "middle")
          .text("+");
        cursor += 34;
      }
      const source = vpdSourceCatalog[key];
      const termWidth = conceptTermWidth(key);
      const term = group.append("g")
        .attr("class", "vpd-concept-term")
        .attr("data-source", key)
        .classed("is-emphasized", state.emphasize.includes(key));
      term.append("rect")
        .attr("class", "vpd-emphasis-pill")
        .attr("x", cursor - 8)
        .attr("y", baselineY - 20)
        .attr("width", termWidth + 16)
        .attr("height", 28)
        .attr("rx", 14)
        .attr("ry", 14);
      term.append("circle")
        .attr("class", "vpd-source-dot")
        .attr("cx", cursor + 5.5)
        .attr("cy", baselineY - 7)
        .attr("r", 5.5)
        .style("fill", source.color);
      term.append("text")
        .attr("class", "vpd-concept-text")
        .attr("x", cursor + 17)
        .attr("y", baselineY)
        .text(source.label);
      cursor += termWidth;
    });
  }

  // The formula is one row on the wide canvas. A compact canvas gives each
  // ratio its own row, and the conceptual fraction a row below it.
  function formulaRows(spec) {
    const concept = Boolean(spec.formula.concept);
    if (!compactWidth) return [spec.formula.ratios.map((ratio) => ({ ratio, concept }))];
    return spec.formula.ratios.flatMap((ratio) =>
      concept ? [[{ ratio }], [{ concept }]] : [[{ ratio }]]);
  }

  function renderFormula(spec, formulaY, animate) {
    const signature = JSON.stringify([state.preset, spec.formula, state.emphasize, compactWidth]);
    if (signature === lastFormulaSignature) return;
    const changed = lastFormulaSignature !== null;
    lastFormulaSignature = signature;

    formulaLayer.selectAll("*").remove();
    if (!showFormulaOption || !spec.formula) return;

    // Crossfade an inner group: the outer layer's opacity belongs to the
    // stage reveal and must not be overridden inline.
    const inner = formulaLayer.append("g").attr("class", "vpd-formula-inner");

    const conceptW = spec.formula.concept
      ? Math.max(
          conceptRowWidth(spec.formula.concept.num),
          conceptRowWidth(spec.formula.concept.den)
        ) + 16
      : 0;

    formulaRows(spec).forEach((items, rowIndex) => {
      const rowY = formulaY + rowIndex * vpdFormulaRowStep;
      const row = inner.append("g").attr("class", "vpd-formula-row");
      const groups = items.map(({ ratio, concept }) => {
        const fWidth = ratio ? vpdMathWidth(ratio.f, 26) : 0;
        const fracW = ratio ? fractionWidth(ratio) : 0;
        let groupWidth = ratio ? fWidth + 16 + 22 + 16 + fracW : 0;
        if (concept) groupWidth += (ratio ? 16 : 0) + 22 + 16 + conceptW;
        return { ratio, concept, fWidth, fracW, groupWidth };
      });

      const gap = 64;
      const totalWidth = groups.reduce((total, group) => total + group.groupWidth, 0) +
        (groups.length - 1) * gap;
      // Long formulas (three sources on each side) can outgrow the canvas;
      // shrink the whole row around its center instead of clipping.
      const center = canvasWidth() / 2;
      const scale = Math.min(1, (canvasWidth() - 36) / totalWidth);
      if (scale < 1) {
        row.attr("transform",
          `translate(${center},${rowY}) scale(${scale}) translate(${-center},${-rowY})`);
      }
      let cursor = center - totalWidth / 2;

      groups.forEach((group) => {
        const g = row.append("g").attr("class", "vpd-formula-group");
        if (group.ratio) {
          const fText = g.append("text")
            .attr("class", "vpd-math")
            .attr("text-anchor", "start")
            .attr("x", cursor)
            .attr("y", rowY + 9);
          vpdRenderMath(fText, group.ratio.f);
          cursor += group.fWidth + 16;

          g.append("text")
            .attr("class", "vpd-math")
            .attr("x", cursor + 11)
            .attr("y", rowY + 9)
            .text("=");
          cursor += 22 + 16;

          drawFraction(g, group.ratio, cursor + group.fracW / 2, rowY);
          cursor += group.fracW;
        }

        if (group.concept) {
          if (group.ratio) cursor += 16;
          g.append("text")
            .attr("class", "vpd-math")
            .attr("x", cursor + 11)
            .attr("y", rowY + 9)
            .text("=");
          cursor += 22 + 16;

          const conceptCenter = cursor + conceptW / 2;
          drawConceptRow(g, spec.formula.concept.num, conceptCenter, rowY - 12);
          drawConceptRow(g, spec.formula.concept.den, conceptCenter, rowY + 32);
          g.append("line")
            .attr("class", "vpd-frac-bar")
            .attr("x1", conceptCenter - conceptW / 2)
            .attr("x2", conceptCenter + conceptW / 2)
            .attr("y1", rowY)
            .attr("y2", rowY);
          cursor += conceptW;
        }

        cursor += gap;
      });
    });

    if (changed && animate) {
      inner.style("opacity", 0)
        .transition("vpd-formula")
        .duration(360)
        .style("opacity", 1);
    }
  }

  // --- Main render ------------------------------------------------------

  function render(options) {
    options = options || {};
    const animate = options.animate !== false && !vpdPrefersReducedMotion();
    const duration = vpdPositiveNumber(options.duration, transitionDuration);

    if (!animate) rootNode.classList.add("vpd-no-anim");

    const spec = buildSpec();
    state.spec = spec;
    const nodesById = new Map(spec.nodes.map((node) => [node.id, node]));
    const blocks = vpdSourceBlocks(spec.nodes, compactWidth);
    const formulaY = contentBottom(spec, blocks) + 84;
    const height = svgHeight(spec, blocks, formulaY);

    maybeTransition(svg, animate, duration)
      .attr("viewBox", `0 0 ${canvasWidth()} ${height}`);
    svg.attr("aria-label", opts.ariaLabel || opts.alt || spec.alt);

    const nodeSel = renderNodes(spec, animate, duration, nodesById);
    const linkSel = renderLinks(spec, animate, duration, nodesById);
    renderSources(blocks, animate, duration);
    renderFormula(spec, formulaY, animate);

    // Stage-based reveal: an element shows once the current stage reaches
    // its own stage tag.
    const stageVisible = (stageName) =>
      vpdStageOrder.indexOf(stageName) <= state.stage;

    nodeSel.each(function(node) {
      setReveal(this, stageVisible(node.stage), animate);
    });
    linkSel.each(function(link) {
      setReveal(this, stageVisible(link.stage), animate);
    });
    sourceLayer.selectAll("g.vpd-source-block").each(function(block) {
      setReveal(this, state.stage >= block.stageIndex, animate);
    });
    if (showFormulaOption && spec.formula) {
      setReveal(formulaLayer.node(), stageVisible("formula"), animate);
    }

    if (!animate) {
      rootNode.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        rootNode.classList.remove("vpd-no-anim");
      });
    }
  }

  // --- Tutorial actions ---------------------------------------------------

  function applyTutorialAction(action) {
    action = action || {};
    let changed = false;
    const animate = action.animate !== false;
    const renderOptions = { animate, duration: action.duration };

    Object.entries(action).forEach(([rawKey, value]) => {
      switch (vpdKey(rawKey)) {
        case "animate":
        case "duration":
          break;
        case "preset":
        case "variant": {
          const preset = vpdNormalizePreset(value);
          if (preset !== state.preset) {
            state.preset = preset;
            changed = true;
          }
          break;
        }
        case "stage":
        case "step": {
          const stage = vpdNormalizeStage(value, state.stage);
          if (stage !== state.stage) {
            state.stage = stage;
            changed = true;
          }
          break;
        }
        case "emphasize":
        case "highlight":
          state.emphasize = vpdKey(value) === "none" ? [] : normalizeEmphasis(value);
          lastFormulaSignature = null;
          changed = true;
          break;
        default:
          break;
      }
    });

    if (changed) render(renderOptions);
  }

  render({ animate: false });
  vpdSetupTutorial(rootNode, applyTutorialAction);

  if (window.interactiveFigure &&
      typeof window.interactiveFigure.observeResponsiveLayout === "function") {
    // The wide canvas just scales, so it only needs one render; the compact
    // canvas follows the width. Measured on the chart wrap, which tutorial
    // side gutters can make narrower than the root.
    window.interactiveFigure.observeResponsiveLayout({
      root: rootNode,
      container: chartWrap.node(),
      compactBelow: vpdCompactBelow,
      minimumWidth: 200,
      key: (layout) => layout.compact ? Math.round(layout.availableWidth) : "wide",
      onLayout(layout) {
        const next = layout.compact
          ? Math.round(layout.availableWidth) / vpdCompactScale
          : null;
        if (next === compactWidth) return;
        compactWidth = next;
        svg.interrupt("vpd-move");
        svg.selectAll("*").interrupt("vpd-move");
        render({ animate: false });
      }
    });
  }

  return rootNode;
}
