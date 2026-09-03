idgValueOr = (value, fallback) =>
  value === undefined || value === null ? fallback : value

idgFiniteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

idgPositiveNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

idgCssLength = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? `${number}px` : String(value);
}

idgCssNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : String(value);
}

idgNormalizeKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-")

idgCamelCase = (value) =>
  String(value || "").replace(/[-_\s]+([a-zA-Z0-9])/g, (match, letter) => letter.toUpperCase())

idgClassNames = (...values) =>
  values.filter(Boolean).join(" ")

idgTreatedFill = "var(--idg-treated-fill, #d9edf8)"

idgSubscriptMap = ({
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  "A": "ₐ", "E": "ₑ", "H": "ₕ", "I": "ᵢ", "J": "ⱼ",
  "K": "ₖ", "L": "ₗ", "M": "ₘ", "N": "ₙ", "O": "ₒ",
  "P": "ₚ", "R": "ᵣ", "S": "ₛ", "T": "ₜ", "U": "ᵤ",
  "V": "ᵥ", "X": "ₓ",
  "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ",
  "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ",
  "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ",
  "v": "ᵥ", "x": "ₓ"
})

idgSuperscriptMap = ({
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  "i": "ⁱ", "n": "ⁿ"
})

idgTexReplacements = [
  ["\\alpha", "α"], ["\\beta", "β"], ["\\gamma", "γ"],
  ["\\delta", "δ"], ["\\epsilon", "ε"], ["\\eta", "η"],
  ["\\theta", "θ"], ["\\lambda", "λ"], ["\\mu", "μ"],
  ["\\pi", "π"], ["\\rho", "ρ"], ["\\sigma", "σ"],
  ["\\tau", "τ"], ["\\omega", "ω"], ["\\Delta", "Δ"],
  ["\\Sigma", "Σ"], ["\\bar", ""], ["\\overline", ""],
  ["\\hat", ""], ["\\text", ""], ["\\mathrm", ""],
  ["\\ne", "≠"], ["\\neq", "≠"], ["\\pm", "±"],
  ["\\leq", "≤"], ["\\le", "≤"], ["\\geq", "≥"],
  ["\\ge", "≥"], ["\\times", "×"], ["\\cdot", "·"]
]

idgMapScript = (value, map) =>
  String(value).split("").map((char) => map[char] || char).join("")

idgHasTexNotation = (line) =>
  /(\$[^$]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\\[A-Za-z]+|[_^]\{?[A-Za-z0-9+\-=()]\}?)/.test(String(line || ""))

idgLabelText = (line) => {
  let text = String(line || "")
    .replace(/\\\(([\s\S]*?)\\\)/g, "$1")
    .replace(/\\\[([\s\S]*?)\\\]/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1");

  text = text
    .replace(/\\(?:bar|overline)\{([^{}]+)\}/g, (match, content) => `${content}\u0304`)
    .replace(/\\hat\{([^{}]+)\}/g, (match, content) => `${content}\u0302`)
    .replace(/\\(?:text|mathrm)\{([^{}]+)\}/g, "$1");

  idgTexReplacements.forEach(([tex, replacement]) => {
    text = text.split(tex).join(replacement);
  });

  return text
    .replace(/_\{([^{}]+)\}/g, (match, content) => idgMapScript(content, idgSubscriptMap))
    .replace(/\^\{([^{}]+)\}/g, (match, content) => idgMapScript(content, idgSuperscriptMap))
    .replace(/_([A-Za-z0-9+\-=()])/g, (match, content) => idgMapScript(content, idgSubscriptMap))
    .replace(/\^([A-Za-z0-9+\-=()])/g, (match, content) => idgMapScript(content, idgSuperscriptMap))
    .replace(/\{([^{}]+)\}/g, "$1");
}

idgLineString = (line) => {
  if (line && typeof line === "object") {
    if (line.tex !== undefined) {
      const tex = String(line.tex);
      return idgHasTexNotation(tex) ? tex : `$${tex}$`;
    }
    if (line.text !== undefined) return String(line.text);
    if (line.label !== undefined) return String(line.label);
  }
  return String(line);
}

idgTextLines = (value, fallback = []) => {
  let source = idgValueOr(value, fallback);

  for (let depth = 0; depth < 4; depth += 1) {
    if (!source || typeof source !== "object" || Array.isArray(source)) break;
    if (Array.isArray(source.lines)) {
      source = source.lines;
      break;
    }
    if (source.tex !== undefined) {
      const tex = String(source.tex);
      source = idgHasTexNotation(tex) ? tex : `$${tex}$`;
      break;
    }
    if (source.text !== undefined) {
      source = source.text;
      continue;
    }
    if (source.label !== undefined) {
      source = source.label;
      continue;
    }
    break;
  }

  if (Array.isArray(source)) return source.map(idgLineString);
  if (source === undefined || source === null) return [];
  return String(source)
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length);
}

idgLabelFor = (labels, id, fallback) => {
  const labelMap = labels || {};
  const camel = idgCamelCase(id);
  return idgValueOr(
    idgValueOr(labelMap[id], idgValueOr(labelMap[camel], labelMap[idgNormalizeKey(id)])),
    fallback
  );
}

idgMergeLabels = (nodes, labels) =>
  nodes.map((node) => Object.assign({}, node, {
    label: idgLabelFor(labels, node.id, node.label)
  }))

idgLinkLabelKey = (link) =>
  link.labelId || link.id || (link.from && link.to ? `${link.from}-to-${link.to}` : "")

idgMergeLinkLabels = (links, labels) =>
  links.map((link) => Object.assign({}, link, {
    label: idgLabelFor(labels, idgLinkLabelKey(link), link.label)
  }))

idgSingleSamplePreset = (opts, variant) => {
  const labels = opts.labels || {};
  const zTest = variant === "z-test";
  const tTest = variant === "single-t" || variant === "single-sample-t";
  const originalLabel = zTest
    ? ["Known", "original", "population", "$\\mu, \\sigma$"]
    : tTest
      ? ["Partially known", "original population", "$\\mu$"]
      : ["Original", "population"];
  const treatedSampleLabel = zTest
    ? ["Treated sample", "$M, n$"]
    : tTest
      ? ["Treated sample", "$n, M, SD$"]
      : ["Treated sample"];

  const nodes = idgMergeLabels([
    {
      id: "original-population",
      shape: "population",
      x: 220,
      y: 125,
      width: 230,
      height: 145,
      label: originalLabel,
      dashed: !zTest,
      role: "population"
    },
    {
      id: "treated-population",
      shape: "population",
      x: 580,
      y: 125,
      width: 230,
      height: 145,
      label: ["Unknown", "treated", "population"],
      dashed: true,
      fill: idgTreatedFill,
      role: "population"
    },
    {
      id: "sample",
      shape: "sample",
      x: 220,
      y: 335,
      width: 235,
      height: 90,
      label: ["Sample"],
      role: "sample"
    },
    {
      id: "treated-sample",
      shape: "sample",
      x: 580,
      y: 335,
      width: 235,
      height: 90,
      label: treatedSampleLabel,
      fill: idgTreatedFill,
      role: "sample"
    }
  ], labels);

  const links = [
    {
      from: "original-population",
      to: "sample",
      curve: 0.18,
      arrow: "end",
      label: idgLabelFor(labels, "sampling-link", ""),
      className: "idg-link-sampling"
    },
    {
      from: "sample",
      to: "treated-sample",
      curve: 0,
      arrow: "end",
      label: idgLabelFor(labels, "treatment-link", "Treatment"),
      labelOffsetY: -20,
      className: "idg-link-treatment"
    },
    {
      from: "treated-sample",
      to: "treated-population",
      curve: 0.18,
      arrow: "end",
      dashed: true,
      label: idgLabelFor(labels, "inference-link", ""),
      className: "idg-link-inference"
    },
    {
      from: "original-population",
      to: "treated-population",
      curve: 0,
      dashed: true,
      label: idgLabelFor(labels, "comparison-link", ""),
      className: "idg-link-comparison"
    }
  ];

  return {
    width: idgFiniteNumber(opts.width, 800),
    height: idgFiniteNumber(opts.height, 430),
    nodes,
    links
  };
}

idgIndependentFullPreset = (opts) => {
  const labels = opts.labels || {};
  const nodes = idgMergeLabels([
    {
      id: "original-population-a",
      shape: "population",
      x: 130,
      y: 115,
      width: 185,
      height: 120,
      label: ["Original", "population"],
      dashed: true,
      role: "population"
    },
    {
      id: "treated-population-a",
      shape: "population",
      x: 380,
      y: 115,
      width: 185,
      height: 120,
      label: ["Unknown", "treated", "population A"],
      dashed: true,
      fill: idgTreatedFill,
      role: "population"
    },
    {
      id: "treated-population-b",
      shape: "population",
      x: 600,
      y: 115,
      width: 185,
      height: 120,
      label: ["Unknown", "treated", "population B"],
      dashed: true,
      fill: idgTreatedFill,
      role: "population"
    },
    {
      id: "original-population-b",
      shape: "population",
      x: 850,
      y: 115,
      width: 185,
      height: 120,
      label: ["Original", "population"],
      dashed: true,
      role: "population"
    },
    {
      id: "original-sample-a",
      shape: "sample",
      x: 130,
      y: 365,
      width: 185,
      height: 86,
      label: ["Sample A"],
      role: "sample"
    },
    {
      id: "treated-sample-a",
      shape: "sample",
      x: 380,
      y: 365,
      width: 185,
      height: 86,
      label: ["Treated", "sample A", "$n_1, M_1, SD_1$"],
      fill: idgTreatedFill,
      role: "sample"
    },
    {
      id: "treated-sample-b",
      shape: "sample",
      x: 600,
      y: 365,
      width: 185,
      height: 86,
      label: ["Treated", "sample B", "$n_2, M_2, SD_2$"],
      fill: idgTreatedFill,
      role: "sample"
    },
    {
      id: "original-sample-b",
      shape: "sample",
      x: 850,
      y: 365,
      width: 185,
      height: 86,
      label: ["Sample B"],
      role: "sample"
    }
  ], labels);

  const links = [
    {
      from: "original-population-a",
      to: "original-sample-a",
      curve: 0.13,
      arrow: "end",
      className: "idg-link-sampling"
    },
    {
      from: "original-sample-a",
      to: "treated-sample-a",
      curve: 0,
      arrow: "end",
      label: idgLabelFor(labels, "treatment-link-a", ""),
      className: "idg-link-treatment"
    },
    {
      from: "treated-sample-a",
      to: "treated-population-a",
      curve: -0.13,
      arrow: "end",
      dashed: true,
      className: "idg-link-inference"
    },
    {
      from: "original-population-b",
      to: "original-sample-b",
      curve: -0.13,
      arrow: "end",
      className: "idg-link-sampling"
    },
    {
      from: "original-sample-b",
      to: "treated-sample-b",
      curve: 0,
      arrow: "end",
      label: idgLabelFor(labels, "treatment-link-b", ""),
      className: "idg-link-treatment"
    },
    {
      from: "treated-sample-b",
      to: "treated-population-b",
      curve: 0.13,
      arrow: "end",
      dashed: true,
      className: "idg-link-inference"
    },
    {
      from: "treated-population-a",
      to: "treated-population-b",
      curve: 0,
      dashed: true,
      label: idgLabelFor(labels, "population-comparison-link", ""),
      labelOffsetY: -20,
      className: "idg-link-comparison"
    },
    {
      from: "treated-sample-a",
      to: "treated-sample-b",
      curve: 0,
      label: idgLabelFor(labels, "sample-comparison-link", ""),
      labelOffsetY: 24,
      className: "idg-link-comparison"
    }
  ];

  return {
    width: idgFiniteNumber(opts.width, 980),
    height: idgFiniteNumber(opts.height, 455),
    nodes,
    links
  };
}

idgIndependentCompactPreset = (opts) => {
  const labels = opts.labels || {};
  const nodes = idgMergeLabels([
    {
      id: "treated-population-a",
      shape: "population",
      x: 260,
      y: 125,
      width: 230,
      height: 135,
      label: ["Unknown", "treated population", "A"],
      dashed: true,
      role: "population"
    },
    {
      id: "treated-population-b",
      shape: "population",
      x: 540,
      y: 125,
      width: 230,
      height: 135,
      label: ["Unknown", "treated population", "B"],
      dashed: true,
      role: "population"
    },
    {
      id: "treated-sample-a",
      shape: "sample",
      x: 260,
      y: 335,
      width: 225,
      height: 90,
      label: ["Sample A", "$n_1, M_1, SD_1$"],
      fill: idgTreatedFill,
      role: "sample"
    },
    {
      id: "treated-sample-b",
      shape: "sample",
      x: 540,
      y: 335,
      width: 225,
      height: 90,
      label: ["Sample B", "$n_2, M_2, SD_2$"],
      fill: idgTreatedFill,
      role: "sample"
    }
  ], labels);

  const links = [
    {
      from: "treated-sample-a",
      to: "treated-population-a",
      curve: -0.15,
      arrow: "end",
      dashed: true,
      className: "idg-link-inference"
    },
    {
      from: "treated-sample-b",
      to: "treated-population-b",
      curve: 0.15,
      arrow: "end",
      dashed: true,
      className: "idg-link-inference"
    },
    {
      from: "treated-population-a",
      to: "treated-population-b",
      curve: 0,
      dashed: true,
      label: idgLabelFor(labels, "population-comparison-link", ""),
      labelOffsetY: -20,
      className: "idg-link-comparison"
    },
    {
      from: "treated-sample-a",
      to: "treated-sample-b",
      curve: 0,
      label: idgLabelFor(labels, "sample-comparison-link", ""),
      labelOffsetY: 24,
      className: "idg-link-comparison"
    }
  ];

  return {
    width: idgFiniteNumber(opts.width, 760),
    height: idgFiniteNumber(opts.height, 430),
    nodes,
    links
  };
}

idgGroupsPreset = (opts) => {
  const labels = opts.labels || {};
  const groups = (Array.isArray(opts.groups) && opts.groups.length ? opts.groups : ["A", "B", "C"])
    .map((group, index) => {
      if (group && typeof group === "object") return Object.assign({ index }, group);
      return { index, id: String(group), label: String(group) };
    });
  const width = idgFiniteNumber(opts.width, Math.max(800, 180 + groups.length * 200));
  const height = idgFiniteNumber(opts.height, 430);
  const left = 105;
  const right = width - 105;
  const xScale = d3.scalePoint()
    .domain(groups.map((group) => group.id || group.label || String(group.index + 1)))
    .range([left, right])
    .padding(0.5);

  const nodes = groups.flatMap((group, index) => {
    const key = group.id || group.label || String(index + 1);
    const groupLabel = group.label || key;
    const populationId = `treated-population-${key}`;
    const sampleId = `treated-sample-${key}`;
    const x = xScale(key);
    return [
      {
        id: populationId,
        shape: "population",
        x,
        y: 125,
        width: 190,
        height: 125,
        label: [`Population ${groupLabel}`],
        dashed: true,
        role: "population"
      },
      {
        id: sampleId,
        shape: "sample",
        x,
        y: 335,
        width: 185,
        height: 86,
        label: [`Sample ${groupLabel}`],
        fill: idgTreatedFill,
        role: "sample"
      }
    ];
  });

  const populationIds = nodes.filter((node) => node.role === "population").map((node) => node.id);
  const sampleIds = nodes.filter((node) => node.role === "sample").map((node) => node.id);
  const inferenceLinks = groups.map((group, index) => {
    const key = group.id || group.label || String(index + 1);
    return {
      from: `treated-sample-${key}`,
      to: `treated-population-${key}`,
      curve: index % 2 === 0 ? -0.1 : 0.1,
      arrow: "end",
      dashed: true,
      className: "idg-link-inference"
    };
  });
  const comparisonLinks = [];
  for (let index = 0; index < populationIds.length - 1; index += 1) {
    comparisonLinks.push({
      from: populationIds[index],
      to: populationIds[index + 1],
      curve: 0,
      dashed: true,
      className: "idg-link-comparison",
      label: index === 0 ? idgLabelFor(labels, "population-comparison-link", "") : "",
      labelOffsetY: -20
    });
    comparisonLinks.push({
      from: sampleIds[index],
      to: sampleIds[index + 1],
      curve: 0,
      className: "idg-link-comparison",
      label: index === 0 ? idgLabelFor(labels, "sample-comparison-link", "") : "",
      labelOffsetY: 24
    });
  }

  return {
    width,
    height,
    nodes: idgMergeLabels(nodes, labels),
    links: inferenceLinks.concat(comparisonLinks)
  };
}

idgPreset = (opts = {}) => {
  const preset = idgNormalizeKey(opts.preset || opts.type || (opts.groups ? "groups" : "single-sample"));
  if (["z", "z-test", "ztest"].includes(preset)) return idgSingleSamplePreset(opts, "z-test");
  if (["single-t", "single-sample-t", "single-sample-t-test", "one-sample-t"].includes(preset)) {
    return idgSingleSamplePreset(opts, "single-t");
  }
  if (["single", "single-sample", "one-sample", "inferential"].includes(preset)) {
    return idgSingleSamplePreset(opts, "single-sample");
  }
  if (["independent", "independent-full", "independent-samples", "independent-samples-full"].includes(preset)) {
    return idgIndependentFullPreset(opts);
  }
  if (["independent-compact", "two-sample", "two-sample-compact", "comparison"].includes(preset)) {
    return idgIndependentCompactPreset(opts);
  }
  if (["anova", "groups", "multi-group", "between-groups"].includes(preset)) return idgGroupsPreset(opts);
  return idgSingleSamplePreset(opts, "single-sample");
}

idgNodeShape = (node) => {
  const shape = idgNormalizeKey(node.shape || node.type || node.role || "sample");
  if (["population", "pop", "bubble", "circle", "ellipse"].includes(shape)) return "population";
  if (["sample", "rect", "rectangle", "box"].includes(shape)) return "sample";
  return shape;
}

idgNodeDimensions = (node) => {
  const shape = idgNodeShape(node);
  const width = idgPositiveNumber(idgValueOr(node.width, node.w), shape === "population" ? 220 : 205);
  const height = idgPositiveNumber(idgValueOr(node.height, node.h), shape === "population" ? 135 : 88);
  return { width, height };
}

idgNodeBoundaryPoint = (node, target, pad = 10) => {
  const dims = idgNodeDimensions(node);
  const dx = target.x - node.x;
  const dy = target.y - node.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const shape = idgNodeShape(node);

  if (!Number.isFinite(distance) || distance === 0) {
    return { x: node.x, y: node.y };
  }

  if (shape === "population") {
    const rx = dims.width / 2 + pad;
    const ry = dims.height / 2 + pad;
    const scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
    return {
      x: node.x + dx * scale,
      y: node.y + dy * scale
    };
  }

  const halfW = dims.width / 2 + pad;
  const halfH = dims.height / 2 + pad;
  const tx = dx === 0 ? Infinity : Math.abs(halfW / dx);
  const ty = dy === 0 ? Infinity : Math.abs(halfH / dy);
  const scale = Math.min(tx, ty);
  return {
    x: node.x + dx * scale,
    y: node.y + dy * scale
  };
}

idgLinkGeometry = (link, nodesById) => {
  const from = nodesById.get(link.from);
  const to = nodesById.get(link.to);
  if (!from || !to) return null;

  const start = idgNodeBoundaryPoint(from, to, idgFiniteNumber(link.pad, 8));
  const end = idgNodeBoundaryPoint(to, from, idgFiniteNumber(link.pad, 8));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const curve = idgFiniteNumber(link.curve, 0);
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const control = {
    x: midX + normalX * curve * distance,
    y: midY + normalY * curve * distance
  };

  return { start, end, control, dx, dy, distance, curve };
}

idgLinkPath = (link, nodesById) => {
  const geometry = idgLinkGeometry(link, nodesById);
  if (!geometry) return "";

  const { start, end, control, curve } = geometry;

  if (!curve) return `M${start.x},${start.y} L${end.x},${end.y}`;

  return `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}`;
}

idgLinkLabelPoint = (link, nodesById) => {
  const geometry = idgLinkGeometry(link, nodesById);
  if (!geometry) return { x: 0, y: 0 };

  const { start, end, control, curve } = geometry;
  const t = Math.max(0, Math.min(1, idgFiniteNumber(link.labelPosition, 0.5)));

  let x = start.x + (end.x - start.x) * t;
  let y = start.y + (end.y - start.y) * t;

  if (curve) {
    const mt = 1 - t;
    x = mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x;
    y = mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y;
  }

  return {
    x: x + idgFiniteNumber(link.labelOffsetX, 0),
    y: y + idgFiniteNumber(link.labelOffsetY, 0)
  };
}

idgDrawLabel = (parent, lines, x, y, opts = {}) => {
  const cleanLines = idgTextLines(lines);
  if (!cleanLines.length) return null;

  const text = parent.append("text")
    .attr("class", opts.className || "idg-node-label")
    .attr("x", x)
    .attr("y", y)
    .style("font-size", idgCssLength(opts.fontSize))
    .style("font-weight", opts.fontWeight || null);
  const lineHeight = idgFiniteNumber(opts.lineHeight, idgFiniteNumber(opts.fontSize, 25) * 1.15);
  const startY = y - ((cleanLines.length - 1) * lineHeight) / 2;

  cleanLines.forEach((line, index) => {
    text.append("tspan")
      .attr("x", x)
      .attr("y", startY + index * lineHeight)
      .text(idgLabelText(line));
  });

  return text;
}

idgDiagramStyleText = `
  .inferential-diagram-svg {
    --idg-stroke: var(--sfs-text, var(--bs-body-color, #222));
    --idg-muted: var(--sfs-muted, #6c757d);
    --idg-fill: var(--sfs-bg, var(--bs-body-bg, #fff));
    --idg-treated-fill: color-mix(in srgb, var(--sfs-comparison-color, #2f6f9f) 18%, var(--sfs-bg, #fff));
    --idg-label-halo: var(--sfs-bg, var(--bs-body-bg, #fff));
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    color: var(--idg-stroke);
    font-family: var(--idg-font-family, var(--bs-body-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif));
  }

  .inferential-diagram-svg .idg-node-shape {
    fill: var(--idg-fill);
    stroke: var(--idg-stroke);
    stroke-width: var(--idg-node-stroke-width, var(--idg-stroke-width, 1.5));
  }

  .inferential-diagram-svg .idg-node-shape.is-dashed {
    stroke-dasharray: 9 7;
  }

  .inferential-diagram-svg .idg-node-label {
    fill: var(--idg-stroke);
    text-anchor: middle;
    dominant-baseline: middle;
    font-size: 25px;
    font-weight: 650;
    line-height: 1.1;
  }

  .inferential-diagram-svg .idg-link {
    fill: none;
    stroke: var(--idg-stroke);
    stroke-width: var(--idg-link-stroke-width, var(--idg-stroke-width, 2.4));
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .inferential-diagram-svg .idg-link.is-dashed {
    stroke-dasharray: 8 7;
  }

  .inferential-diagram-svg .idg-link-inference,
  .inferential-diagram-svg .idg-link-comparison {
    stroke: var(--idg-muted);
  }

  .inferential-diagram-svg .idg-link-label,
  .inferential-diagram-svg .idg-title,
  .inferential-diagram-svg .idg-caption {
    fill: var(--idg-stroke);
    text-anchor: middle;
    paint-order: stroke;
    stroke: var(--idg-label-halo);
    stroke-width: 5;
    stroke-linejoin: round;
  }

  .inferential-diagram-svg .idg-link-label {
    font-size: 20px;
    font-weight: 650;
  }

  .inferential-diagram-svg .idg-title {
    font-size: 28px;
    font-weight: 750;
  }

  .inferential-diagram-svg .idg-caption {
    fill: var(--idg-muted);
    font-size: 18px;
    font-weight: 550;
  }

  @supports not (color: color-mix(in srgb, white, black)) {
    .inferential-diagram-svg {
      --idg-treated-fill: #d9edf8;
    }
  }
`

idgAccessibleLabel = (opts, titleLines) =>
  opts.alt || opts.ariaLabel || (titleLines.length
    ? titleLines.map(idgLabelText).join(" ")
    : "Inferential statistics diagram")

makeInferentialDiagram = (opts = {}) => {
  const customNodes = opts.nodes || opts.regions;
  const customLinks = opts.links || opts.arrows;
  const base = customNodes
    ? {
      width: idgPositiveNumber(opts.width, 900),
      height: idgPositiveNumber(opts.height, 520),
      nodes: customNodes,
      links: customLinks || []
    }
    : idgPreset(opts);

  const width = idgPositiveNumber(opts.width, base.width || 900);
  const height = idgPositiveNumber(opts.height, base.height || 520);
  const nodes = idgMergeLabels((base.nodes || []).map((node) => Object.assign({}, node)), opts.labels || {});
  const links = idgMergeLinkLabels((customLinks || base.links || []), opts.labels || {});
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const titleLines = idgTextLines(opts.title || opts.heading);
  const captionLines = idgTextLines(opts.caption || opts.note);
  const titleSize = idgPositiveNumber(opts.titleSize, 28);
  const titleLineHeight = idgPositiveNumber(opts.titleLineHeight, titleSize * 1.12);
  const captionSize = idgPositiveNumber(opts.captionSize, 18);
  const captionLineHeight = idgPositiveNumber(opts.captionLineHeight, captionSize * 1.18);
  const topPad = titleLines.length ? Math.ceil(titleLineHeight * titleLines.length + 18) : 0;
  const bottomPad = captionLines.length ? Math.ceil(captionLineHeight * captionLines.length + 18) : 0;
  const svgHeight = height + topPad + bottomPad;
  const arrowSize = idgPositiveNumber(opts.arrowSize, 8);
  const svgId = `idg-${Math.random().toString(36).slice(2)}`;

  const root = d3.create("div")
    .attr("class", "inferential-diagram sfs-figure")
    .style("--sfs-figure-max-width", idgCssLength(idgValueOr(opts.maxWidth, opts.cssMaxWidth)))
    .style("--sfs-figure-margin", idgValueOr(opts.cssMargin, opts.marginCss) || null)
    .style("--idg-font-family", idgValueOr(opts.fontFamily, null))
    .style("--idg-stroke-width", idgCssNumber(opts.strokeWidth))
    .style("--idg-node-stroke-width", idgCssNumber(opts.nodeStrokeWidth))
    .style("--idg-link-stroke-width", idgCssNumber(opts.linkStrokeWidth));

  const chartWrap = root.append("div")
    .attr("class", "idg-chart-wrap sfs-chart-wrap");

  const svg = chartWrap.append("svg")
    .attr("class", "inferential-diagram-svg sfs-svg")
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("viewBox", [0, 0, width, svgHeight])
    .attr("role", "img")
    .attr("aria-label", idgAccessibleLabel(opts, titleLines));

  svg.append("style").text(idgDiagramStyleText);

  const defs = svg.append("defs");
  defs.append("marker")
    .attr("id", `${svgId}-arrow`)
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 9)
    .attr("refY", 5)
    .attr("markerWidth", arrowSize)
    .attr("markerHeight", arrowSize)
    .attr("orient", "auto-start-reverse")
    .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", "var(--idg-stroke, currentColor)");

  if (titleLines.length) {
    idgDrawLabel(svg, titleLines, width / 2, topPad / 2, {
      className: "idg-title",
      fontSize: titleSize,
      lineHeight: titleLineHeight
    });
  }

  const diagram = svg.append("g")
    .attr("class", "idg-diagram")
    .attr("transform", `translate(0, ${topPad})`);

  const linkLayer = diagram.append("g").attr("class", "idg-links");
  const nodeLayer = diagram.append("g").attr("class", "idg-nodes");

  const linkGroups = linkLayer.selectAll("g")
    .data(links.filter((link) => nodesById.has(link.from) && nodesById.has(link.to)))
    .enter()
    .append("g")
      .attr("class", (link) => idgClassNames("idg-link-group", link.className));

  linkGroups.append("path")
    .attr("class", (link) => idgClassNames("idg-link", link.dashed ? "is-dashed" : ""))
    .attr("d", (link) => idgLinkPath(link, nodesById))
    .attr("marker-start", (link) => link.arrow === "start" || link.arrow === "both" ? `url(#${svgId}-arrow)` : null)
    .attr("marker-end", (link) => link.arrow === "end" || link.arrow === "both" ? `url(#${svgId}-arrow)` : null)
    .style("stroke", (link) => idgValueOr(link.stroke, idgValueOr(link.color, null)))
    .style("stroke-width", (link) => idgValueOr(link.strokeWidth, null))
    .style("stroke-dasharray", (link) => idgValueOr(link.dash, link.strokeDasharray));

  linkGroups.each(function(link) {
    const lines = idgTextLines(link.label);
    if (!lines.length) return;
    const point = idgLinkLabelPoint(link, nodesById);
    const labelSize = idgFiniteNumber(idgValueOr(link.labelSize, opts.linkLabelSize), 20);
    idgDrawLabel(d3.select(this), lines, point.x, point.y, {
      className: "idg-link-label",
      fontSize: labelSize,
      lineHeight: idgFiniteNumber(idgValueOr(link.labelLineHeight, opts.linkLabelLineHeight), labelSize * 1.15)
    });
  });

  const nodeGroups = nodeLayer.selectAll("g")
    .data(nodes)
    .enter()
    .append("g")
      .attr("class", (node) => idgClassNames(
        "idg-node",
        `idg-node-${idgNodeShape(node)}`,
        node.className
      ));

  nodeGroups.each(function(node) {
    const group = d3.select(this);
    const shape = idgNodeShape(node);
    const dims = idgNodeDimensions(node);
    const fill = node.fill === false || node.fill === "none"
      ? "none"
      : idgValueOr(node.fill, "var(--idg-fill)");
    const stroke = idgValueOr(node.stroke, idgValueOr(node.color, null));
    const shapeClass = idgClassNames("idg-node-shape", node.dashed ? "is-dashed" : "");
    let shapeElement;

    if (shape === "population") {
      shapeElement = group.append("ellipse")
        .attr("cx", node.x)
        .attr("cy", node.y)
        .attr("rx", dims.width / 2)
        .attr("ry", dims.height / 2);
    } else {
      shapeElement = group.append("rect")
        .attr("x", node.x - dims.width / 2)
        .attr("y", node.y - dims.height / 2)
        .attr("width", dims.width)
        .attr("height", dims.height)
        .attr("rx", idgFiniteNumber(idgValueOr(node.radius, node.rx), 6))
        .attr("ry", idgFiniteNumber(idgValueOr(node.radius, node.ry), 6));
    }

    shapeElement
      .attr("class", shapeClass)
      .style("fill", fill)
      .style("stroke", stroke)
      .style("stroke-width", idgValueOr(node.strokeWidth, null))
      .style("stroke-dasharray", idgValueOr(node.dash, node.strokeDasharray));

    const nodeLabelSize = idgFiniteNumber(
      idgValueOr(node.labelSize, idgValueOr(opts.nodeLabelSize, opts.labelSize)),
      shape === "population" ? 24 : 23
    );
    const nodeLineHeight = idgFiniteNumber(
      idgValueOr(node.labelLineHeight, idgValueOr(opts.nodeLabelLineHeight, opts.labelLineHeight)),
      shape === "population" ? 27 : 26
    );

    idgDrawLabel(group, node.label, node.x, node.y, {
      className: "idg-node-label",
      fontSize: nodeLabelSize,
      lineHeight: nodeLineHeight,
      fontWeight: node.labelWeight || null
    });
  });

  if (captionLines.length) {
    idgDrawLabel(svg, captionLines, width / 2, topPad + height + bottomPad / 2, {
      className: "idg-caption",
      fontSize: captionSize,
      lineHeight: captionLineHeight
    });
  }

  return root.node();
}

makeInferentialProcessDiagram = makeInferentialDiagram