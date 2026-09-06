sfsDistributionStats = window.sfsStats || {}

sfsDistributionDefaultColors = [
  "var(--graph-series-1, var(--graph-line-color, #0072b2))",
  "var(--graph-series-2, #e69f00)",
  "var(--graph-series-3, #009e73)",
  "var(--graph-series-4, #d55e00)",
  "var(--graph-series-5, #cc79a7)",
  "var(--graph-series-6, #56b4e9)",
  "var(--graph-series-7, #f0e442)"
]

sfsDistributionValueOr = (value, fallback) =>
  value === undefined || value === null ? fallback : value

sfsDistributionFiniteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

sfsDistributionPositiveNumber = (value, fallback) => {
  const number = sfsDistributionFiniteNumber(value);
  return number > 0 ? number : fallback;
}

sfsDistributionBound = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) || number === Infinity || number === -Infinity ? number : undefined;
}

sfsDistributionBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "no", "off", "hide", "hidden"].includes(normalized)) return false;
    if (["true", "1", "yes", "on", "show", "visible"].includes(normalized)) return true;
  }
  return Boolean(value);
}

sfsDistributionAsArray = (value, fallback = []) => {
  const source = sfsDistributionValueOr(value, fallback);
  return Array.isArray(source) ? source.slice() : [source].filter((item) => item !== undefined && item !== null);
}

sfsDistributionNormalizeKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-")

sfsDistributionNormalizeType = (value) => {
  const key = sfsDistributionNormalizeKey(value || "normal");
  if (["normal", "norm", "gaussian", "z", "z-score", "z-distribution"].includes(key)) return "normal";
  if (["t", "student", "student-t", "student-t-distribution", "tdistribution", "t-distribution"].includes(key)) return "t";
  if (["f", "f-distribution", "fdistribution", "variance-ratio"].includes(key)) return "f";
  if (["skew-normal", "skewnormal", "skew", "skewed", "skew-norm"].includes(key)) return "skew-normal";
  if (["mixture", "bimodal", "mix"].includes(key)) return "mixture";
  return key;
}

sfsDistributionDistributionLabel = (dist) => {
  if (dist.name) return dist.name;
  if (dist.type === "t") return `t(df = ${dist.df})`;
  if (dist.type === "f") return `F(${dist.df1}, ${dist.df2})`;
  if (dist.type === "skew-normal") return "Skewed";
  if (dist.type === "mixture") return dist.components && dist.components.length === 2 ? "Bimodal" : "Mixture";
  return "Normal";
}

sfsDistributionSpec = (source = {}, parent = {}, index = 0) => {
  const type = sfsDistributionNormalizeType(
    sfsDistributionValueOr(source.distribution, sfsDistributionValueOr(source.type, sfsDistributionValueOr(parent.distribution, parent.type)))
  );
  const mean = sfsDistributionFiniteNumber(
    sfsDistributionValueOr(source.mean, sfsDistributionValueOr(source.mu, sfsDistributionValueOr(source.center, sfsDistributionValueOr(parent.mean, sfsDistributionValueOr(parent.mu, parent.center))))),
    0
  );
  // Hypothesis's Via/pywb replay layer treats `location` as a special browser
  // global. Avoid a local binding with that name so its script rewriting cannot
  // create a temporal-dead-zone collision while this value is initialized.
  const locationValue = sfsDistributionFiniteNumber(
    sfsDistributionValueOr(source.location, sfsDistributionValueOr(source.shift, sfsDistributionValueOr(source.center, sfsDistributionValueOr(source.mean, sfsDistributionValueOr(parent.location, parent.shift))))),
    0
  );
  const scale = sfsDistributionPositiveNumber(
    sfsDistributionValueOr(source.scale, sfsDistributionValueOr(source.sd, sfsDistributionValueOr(source.sigma, sfsDistributionValueOr(parent.scale, sfsDistributionValueOr(parent.sd, parent.sigma))))),
    1
  );
  const df = Math.max(1e-9, sfsDistributionPositiveNumber(sfsDistributionValueOr(source.df, parent.df), 10));
  const df1 = Math.max(1e-9, sfsDistributionPositiveNumber(sfsDistributionValueOr(source.df1, sfsDistributionValueOr(source.numeratorDf, parent.df1)), 5));
  const df2 = Math.max(1e-9, sfsDistributionPositiveNumber(sfsDistributionValueOr(source.df2, sfsDistributionValueOr(source.denominatorDf, parent.df2)), 20));
  const shape = sfsDistributionFiniteNumber(
    sfsDistributionValueOr(source.shape, sfsDistributionValueOr(source.skew, sfsDistributionValueOr(source.alpha, sfsDistributionValueOr(parent.shape, parent.skew)))),
    0
  );

  const dist = {
    type,
    index,
    key: source.key || source.id || source.name || source.label || `distribution-${index + 1}`,
    name: source.name || source.label || "",
    mean,
    mu: mean,
    sd: scale,
    sigma: scale,
    scale,
    location: locationValue,
    df,
    df1,
    df2,
    shape,
    color: source.color || source.stroke || sfsDistributionDefaultColors[index % sfsDistributionDefaultColors.length],
    stroke: source.stroke || source.color || sfsDistributionDefaultColors[index % sfsDistributionDefaultColors.length],
    strokeWidth: sfsDistributionPositiveNumber(source.strokeWidth, sfsDistributionPositiveNumber(parent.strokeWidth, 2.4)),
    strokeDasharray: sfsDistributionValueOr(source.strokeDasharray, sfsDistributionValueOr(source.dash, source.dashed ? "6 4" : null)),
    opacity: sfsDistributionFiniteNumber(source.opacity, sfsDistributionFiniteNumber(parent.opacity, 1)),
    source
  };

  if (type === "mixture") {
    // Components inherit the mixture's parameters but never its type, so a
    // component with no explicit type is a plain normal.
    const componentParent = Object.assign({}, parent, source);
    delete componentParent.distribution;
    delete componentParent.type;
    delete componentParent.components;
    delete componentParent.parts;

    const rawComponents = sfsDistributionAsArray(sfsDistributionValueOr(source.components, source.parts), [{}]);
    const components = rawComponents.map((component, componentIndex) =>
      sfsDistributionSpec(component || {}, componentParent, componentIndex)
    );
    const rawWeights = components.map((component) =>
      sfsDistributionPositiveNumber(component.source.weight, 1)
    );
    const totalWeight = rawWeights.reduce((sum, weight) => sum + weight, 0) || 1;
    components.forEach((component, componentIndex) => {
      component.weight = rawWeights[componentIndex] / totalWeight;
    });
    dist.components = components;
  }

  dist.label = sfsDistributionDistributionLabel(dist);
  return dist;
}

sfsDistributionSpecs = (opts = {}) => {
  const source = opts.distributions || opts.series;
  if (source) {
    return sfsDistributionAsArray(source).map((dist, index) => sfsDistributionSpec(dist, opts, index));
  }
  return [sfsDistributionSpec(opts, {}, 0)];
}

sfsDistributionPdf = (dist, x) => {
  if (dist.type === "t") return sfsDistributionStats.tPdf(x, dist.df, dist.mean, dist.scale);
  if (dist.type === "f") return sfsDistributionStats.fPdf(x, dist.df1, dist.df2, dist.location, dist.scale);
  if (dist.type === "skew-normal") return sfsDistributionStats.skewNormalPdf(x, dist.location, dist.scale, dist.shape);
  if (dist.type === "mixture") {
    return (dist.components || []).reduce((sum, component) =>
      sum + component.weight * sfsDistributionPdf(component, x), 0);
  }
  return sfsDistributionStats.normalPdf(x, dist.mean, dist.sd);
}

sfsDistributionCdf = (dist, x) => {
  if (dist.type === "t") return sfsDistributionStats.tCdf(x, dist.df, dist.mean, dist.scale);
  if (dist.type === "f") return sfsDistributionStats.fCdf(x, dist.df1, dist.df2, dist.location, dist.scale);
  if (dist.type === "skew-normal") return sfsDistributionStats.skewNormalCdf(x, dist.location, dist.scale, dist.shape);
  if (dist.type === "mixture") {
    return (dist.components || []).reduce((sum, component) =>
      sum + component.weight * sfsDistributionCdf(component, x), 0);
  }
  return sfsDistributionStats.normalCdf(x, dist.mean, dist.sd);
}

sfsDistributionMixtureQuantile = (dist, p) => {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const componentQuantiles = (dist.components || [])
    .map((component) => sfsDistributionQuantile(component, p))
    .filter(Number.isFinite);
  if (!componentQuantiles.length) return NaN;

  // Component quantiles bracket the mixture quantile: at the smallest one every
  // component CDF is <= p, at the largest every component CDF is >= p.
  let lower = Math.min(...componentQuantiles);
  let upper = Math.max(...componentQuantiles);
  if (upper <= lower) return lower;

  for (let i = 0; i < 90; i += 1) {
    const midpoint = (lower + upper) / 2;
    if (sfsDistributionCdf(dist, midpoint) < p) {
      lower = midpoint;
    } else {
      upper = midpoint;
    }
  }

  return (lower + upper) / 2;
}

sfsDistributionQuantile = (dist, p) => {
  if (dist.type === "t") return sfsDistributionStats.tInv(p, dist.df, dist.mean, dist.scale);
  if (dist.type === "f") return sfsDistributionStats.fInv(p, dist.df1, dist.df2, dist.location, dist.scale);
  if (dist.type === "skew-normal") return sfsDistributionStats.skewNormalInv(p, dist.location, dist.scale, dist.shape);
  if (dist.type === "mixture") return sfsDistributionMixtureQuantile(dist, p);
  return sfsDistributionStats.normalInv(p, dist.mean, dist.sd);
}

sfsDistributionFinitePdf = (dist, x) => {
  const y = sfsDistributionPdf(dist, x);
  return Number.isFinite(y) && y >= 0 ? y : 0;
}

sfsDistributionDefaultDomain = (dist) => {
  const lowerP = dist.type === "f" ? 0.001 : 0.0008;
  const upperP = dist.type === "f" ? 0.995 : 0.9992;
  let lower = sfsDistributionQuantile(dist, lowerP);
  let upper = sfsDistributionQuantile(dist, upperP);

  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) {
    if (dist.type === "f") {
      lower = dist.location;
      upper = dist.location + 8 * dist.scale;
    } else {
      const spread = dist.type === "t" ? 6 : 4;
      lower = dist.mean - spread * dist.scale;
      upper = dist.mean + spread * dist.scale;
    }
  }

  if (dist.type === "f") lower = Math.max(dist.location, lower);
  const span = upper - lower || 1;
  const pad = dist.type === "f" ? span * 0.03 : span * 0.04;
  return [dist.type === "f" ? Math.max(dist.location, lower - pad) : lower - pad, upper + pad];
}

sfsDistributionResolveDomain = (distributions, opts = {}) => {
  const explicit = opts.xDomain || opts.domain;
  if (explicit && explicit.length >= 2) return explicit.map(Number);

  const domains = distributions.map(sfsDistributionDefaultDomain);
  return [
    d3.min(domains, (domain) => domain[0]),
    d3.max(domains, (domain) => domain[1])
  ];
}

sfsDistributionCurveData = (dist, domain, points = 360) => {
  const count = Math.max(2, Math.round(points));
  const step = (domain[1] - domain[0]) / (count - 1);
  return d3.range(count).map((index) => {
    const x = domain[0] + index * step;
    return { x, y: sfsDistributionFinitePdf(dist, x), distribution: dist };
  });
}

sfsDistributionSegmentData = (dist, from, to, domain, points = 240) => {
  const lower = Math.max(Number.isFinite(from) ? from : domain[0], domain[0]);
  const upper = Math.min(Number.isFinite(to) ? to : domain[1], domain[1]);
  if (!(upper > lower)) return [];

  const relativeWidth = (upper - lower) / (domain[1] - domain[0]);
  const count = Math.max(12, Math.ceil(points * relativeWidth));
  const step = (upper - lower) / count;
  return d3.range(count + 1).map((index) => {
    const x = lower + index * step;
    return { x, y: sfsDistributionFinitePdf(dist, x), distribution: dist };
  });
}

sfsDistributionOverlapData = (distA, distB, domain, points = 360) => {
  const count = Math.max(2, Math.round(points));
  const step = (domain[1] - domain[0]) / (count - 1);
  return d3.range(count).map((index) => {
    const x = domain[0] + index * step;
    return {
      x,
      y: Math.min(sfsDistributionFinitePdf(distA, x), sfsDistributionFinitePdf(distB, x)),
      distributions: [distA, distB]
    };
  });
}

sfsDistributionDistributionBySelector = (selector, distributions) => {
  if (selector === undefined || selector === null || selector === "") return distributions[0];
  if (typeof selector === "number") return distributions[selector] || distributions[selector - 1] || distributions[0];

  const key = sfsDistributionNormalizeKey(selector);
  if (key === "first") return distributions[0];
  if (key === "last") return distributions[distributions.length - 1];

  return distributions.find((dist) =>
    sfsDistributionNormalizeKey(dist.key) === key ||
    sfsDistributionNormalizeKey(dist.name) === key ||
    sfsDistributionNormalizeKey(dist.label) === key ||
    sfsDistributionNormalizeKey(dist.type) === key
  ) || distributions[0];
}

sfsDistributionShadedDistributions = (selector, distributions) => {
  if (sfsDistributionNormalizeKey(selector) === "all") return distributions;
  return [sfsDistributionDistributionBySelector(selector, distributions)];
}

sfsDistributionProbability = (spec, fallback) => {
  const value = sfsDistributionFiniteNumber(
    sfsDistributionValueOr(spec.alpha, sfsDistributionValueOr(spec.probability, sfsDistributionValueOr(spec.prob, sfsDistributionValueOr(spec.p, spec.area))))
  );
  return Number.isFinite(value) && value > 0 && value < 1 ? value : fallback;
}

sfsDistributionShadeBounds = (spec, dist) => {
  if (Array.isArray(spec.between) && spec.between.length >= 2 && !["overlap", "intersection"].includes(sfsDistributionNormalizeKey(spec.kind || spec.type))) {
    return [{ from: sfsDistributionBound(spec.between[0]), to: sfsDistributionBound(spec.between[1]) }];
  }

  const explicitFrom = sfsDistributionBound(sfsDistributionValueOr(spec.from, sfsDistributionValueOr(spec.lower, sfsDistributionValueOr(spec.x1, spec.start))));
  const explicitTo = sfsDistributionBound(sfsDistributionValueOr(spec.to, sfsDistributionValueOr(spec.upper, sfsDistributionValueOr(spec.x2, spec.end))));
  if (explicitFrom !== undefined || explicitTo !== undefined) {
    return [{ from: sfsDistributionValueOr(explicitFrom, -Infinity), to: sfsDistributionValueOr(explicitTo, Infinity) }];
  }

  const tail = sfsDistributionNormalizeKey(spec.tail || spec.region || spec.areaType || spec.side);
  if (["left", "lower", "low"].includes(tail)) {
    const p = sfsDistributionProbability(spec, 0.05);
    return [{ from: -Infinity, to: sfsDistributionQuantile(dist, p) }];
  }

  if (["right", "upper", "high"].includes(tail)) {
    const p = sfsDistributionProbability(spec, 0.05);
    return [{ from: sfsDistributionQuantile(dist, 1 - p), to: Infinity }];
  }

  if (["two", "both", "two-tailed", "two-tail", "tails"].includes(tail)) {
    const p = sfsDistributionProbability(spec, 0.05);
    return [
      { from: -Infinity, to: sfsDistributionQuantile(dist, p / 2) },
      { from: sfsDistributionQuantile(dist, 1 - p / 2), to: Infinity }
    ];
  }

  if (["center", "central", "middle", "confidence", "ci", "interval"].includes(tail)) {
    const central = spec.alpha !== undefined ? 1 - sfsDistributionProbability(spec, 0.05) : sfsDistributionProbability(spec, 0.95);
    const side = (1 - central) / 2;
    return [
      { from: sfsDistributionQuantile(dist, side), to: sfsDistributionQuantile(dist, 1 - side) }
    ];
  }

  return [];
}

sfsDistributionShadeLabel = (spec, dist, bounds) => {
  const raw = spec.label;
  if (raw === undefined || raw === null || raw === false) return { label: undefined, labelValue: undefined };

  const area = sfsDistributionCdf(dist, sfsDistributionValueOr(bounds.to, Infinity)) -
    sfsDistributionCdf(dist, sfsDistributionValueOr(bounds.from, -Infinity));
  if (typeof raw === "string" && !["percent", "percentage", "proportion", "area", "auto"].includes(sfsDistributionNormalizeKey(raw))) {
    return { label: raw, labelValue: area };
  }

  const key = typeof raw === "string" ? sfsDistributionNormalizeKey(raw) : "percent";
  const format = spec.labelFormat || (["proportion", "area"].includes(key) ? ".4f" : ".2%");
  return { label: d3.format(format)(area), labelValue: area };
}

sfsDistributionShadeItems = (opts = {}, distributions = [], domain = [0, 1]) => {
  const shadeSpecs = sfsDistributionAsArray(opts.shade || opts.shading || opts.shades);
  return shadeSpecs.flatMap((rawSpec, index) => {
    const spec = typeof rawSpec === "string" ? { tail: rawSpec } : rawSpec || {};
    const kind = sfsDistributionNormalizeKey(spec.kind || spec.type);
    const color = spec.color || spec.fill || (kind === "overlap" ? "var(--sfs-neutral-color, #7b818a)" : "var(--sfs-critical-color, #c63f3f)");
    const opacity = sfsDistributionFiniteNumber(spec.opacity, kind === "overlap" ? 0.32 : 0.28);

    if (["overlap", "intersection"].includes(kind)) {
      const pair = Array.isArray(spec.between) ? spec.between : [0, 1];
      const distA = sfsDistributionDistributionBySelector(pair[0], distributions);
      const distB = sfsDistributionDistributionBySelector(pair[1], distributions);
      return [{
        kind: "overlap",
        color,
        opacity,
        label: typeof spec.label === "string" ? spec.label : undefined,
        labelPosition: sfsDistributionNormalizeKey(spec.labelPosition || "auto"),
        labelOffset: sfsDistributionFiniteNumber(spec.labelOffset, 0),
        data: sfsDistributionOverlapData(distA, distB, domain, spec.points || opts.points || 360),
        spec,
        index
      }];
    }

    return sfsDistributionShadedDistributions(spec.distribution || spec.dist || spec.series, distributions)
      .flatMap((dist) => sfsDistributionShadeBounds(spec, dist).map((bounds) => Object.assign({
        kind: "area",
        distribution: dist,
        from: bounds.from,
        to: bounds.to,
        color,
        opacity,
        labelPosition: sfsDistributionNormalizeKey(spec.labelPosition || "auto"),
        labelOffset: sfsDistributionFiniteNumber(spec.labelOffset, 0),
        data: sfsDistributionSegmentData(dist, bounds.from, bounds.to, domain, spec.points || opts.shadePoints || 240),
        spec,
        index
      }, sfsDistributionShadeLabel(spec, dist, bounds))))
      .filter((item) => item.data.length > 1);
  });
}

// Converts a small label markup — *italic* and _subscript_ — into SVG tspan
// HTML, so shortcode options can express math-ish labels without quote
// escaping. Subscripts run first, so nested italics like _*M*_ work.
sfsDistributionLabelMarkup = (value) => {
  const escaped = String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/_([^_]+)_/g, "<tspan baseline-shift=\"sub\" font-size=\"70%\">$1</tspan>")
    .replace(/\*([^*]+)\*/g, "<tspan font-style=\"italic\">$1</tspan>");
}

sfsDistributionLabelHtml = (spec) => {
  if (typeof spec.labelHtml === "string") return spec.labelHtml;
  if (typeof spec.labelMarkup === "string") return sfsDistributionLabelMarkup(spec.labelMarkup);
  return undefined;
}

sfsDistributionMarkerDefaults = {
  mode: { color: "var(--graph-series-3, #009e73)", dash: "10 5" },
  median: { color: "var(--graph-series-2, #e69f00)", dash: "6 6" },
  mean: { color: "var(--graph-series-5, #cc79a7)", dash: "2 5" }
}

// A central-tendency presentation gives each statistic a mark that reflects
// its definition: a cap at the peak for the mode, two equal-area halves for
// the median, and a fulcrum beneath the baseline for the mean. It is opt-in so
// ordinary score and critical-value markers elsewhere in the book remain
// conventional reference lines.
sfsDistributionConceptualMarkerDefaults = {
  mode: { color: "var(--graph-series-2, #e69f00)" },
  median: { color: "var(--graph-series-3, #009e73)" },
  mean: { color: "var(--sfs-danger-color, #c63f3f)" }
}

sfsDistributionIsCentralTendencyPresentation = (value) => [
  "central-tendency",
  "conceptual",
  "definitions",
  "definition"
].includes(sfsDistributionNormalizeKey(value))

sfsDistributionMarkerStatKey = (value) => {
  if (typeof value !== "string") return null;
  const key = sfsDistributionNormalizeKey(value);
  if (["mean", "average", "mu", "m"].includes(key)) return "mean";
  if (["median", "mdn"].includes(key)) return "median";
  if (["mode", "modes", "peak", "peaks"].includes(key)) return "mode";
  return null;
}

sfsDistributionMeanValue = (dist) => {
  if (dist.type === "f") return dist.df2 > 2 ? dist.location + dist.scale * dist.df2 / (dist.df2 - 2) : NaN;
  if (dist.type === "skew-normal") return sfsDistributionStats.skewNormalMean(dist.location, dist.scale, dist.shape);
  if (dist.type === "mixture") {
    return (dist.components || []).reduce((sum, component) =>
      sum + component.weight * sfsDistributionMeanValue(component), 0);
  }
  return dist.mean;
}

sfsDistributionModes = (dist, domain) => {
  const count = 512;
  const step = (domain[1] - domain[0]) / count;
  if (!(step > 0)) return [];

  const ys = d3.range(count + 1).map((i) => sfsDistributionFinitePdf(dist, domain[0] + i * step));
  const yMax = d3.max(ys) || 0;
  if (!(yMax > 0)) return [];

  const modes = [];
  for (let i = 1; i < count; i += 1) {
    if (!(ys[i] > ys[i - 1] && ys[i] >= ys[i + 1] && ys[i] > yMax * 0.05)) continue;

    let lower = domain[0] + (i - 1) * step;
    let upper = domain[0] + (i + 1) * step;
    for (let iteration = 0; iteration < 60; iteration += 1) {
      const m1 = lower + (upper - lower) / 3;
      const m2 = upper - (upper - lower) / 3;
      if (sfsDistributionFinitePdf(dist, m1) < sfsDistributionFinitePdf(dist, m2)) {
        lower = m1;
      } else {
        upper = m2;
      }
    }
    modes.push((lower + upper) / 2);
  }

  return modes;
}

sfsDistributionMarkerItems = (opts = {}, distributions = [], domain = [0, 1]) => {
  const markerSpecs = sfsDistributionAsArray(opts.markers || opts.marker);
  return markerSpecs.flatMap((rawSpec, index) => {
    const spec = typeof rawSpec === "object" && rawSpec !== null ? rawSpec : { at: rawSpec };
    const dist = sfsDistributionDistributionBySelector(spec.distribution || spec.dist || spec.series, distributions);
    const at = sfsDistributionValueOr(spec.at, sfsDistributionValueOr(spec.x, spec.value));
    const statKey = sfsDistributionMarkerStatKey(at);

    let positions;
    if (statKey === "mean") positions = [sfsDistributionMeanValue(dist)];
    else if (statKey === "median") positions = [sfsDistributionQuantile(dist, 0.5)];
    else if (statKey === "mode") positions = sfsDistributionModes(dist, domain);
    else positions = [sfsDistributionFiniteNumber(at)];

    const presentationValue = sfsDistributionValueOr(
      spec.presentation,
      sfsDistributionValueOr(spec.markerPresentation, opts.markerPresentation)
    );
    const presentation = statKey && sfsDistributionIsCentralTendencyPresentation(presentationValue)
      ? statKey
      : "line";
    const defaults = statKey
      ? (presentation === "line"
          ? sfsDistributionMarkerDefaults[statKey]
          : sfsDistributionConceptualMarkerDefaults[statKey])
      : {};
    const rawHeight = sfsDistributionValueOr(spec.height, spec.extent);
    const heightFraction = sfsDistributionFiniteNumber(rawHeight);
    // "curve" (default): baseline to the pdf; "full": to the top of the plot;
    // a number in (0, 1]: that fraction of the plot height, for marking scores
    // so far into a tail that the curve height would be an invisible stub.
    const height = Number.isFinite(heightFraction) && heightFraction > 0 && heightFraction <= 1
      ? heightFraction
      : ["full", "plot", "top", "divider"].includes(sfsDistributionNormalizeKey(rawHeight)) ? "full" : "curve";

    return positions
      .filter((position) => Number.isFinite(position) && position >= domain[0] && position <= domain[1])
      .map((position) => {
        let label = spec.label;
        if (label === undefined || label === true) {
          label = spec.labelFormat ? d3.format(spec.labelFormat)(position) : statKey || undefined;
        } else if (label === false || label === null) {
          label = undefined;
        }

        return {
          x: position,
          y: sfsDistributionFinitePdf(dist, position),
          distribution: dist,
          stat: statKey,
          presentation,
          height,
          color: spec.color || spec.stroke || defaults.color || "var(--sfs-neutral-color, #7b818a)",
          dash: sfsDistributionValueOr(spec.dash, sfsDistributionValueOr(spec.strokeDasharray, defaults.dash || "6 4")),
          strokeWidth: sfsDistributionPositiveNumber(spec.strokeWidth, 2),
          opacity: sfsDistributionFiniteNumber(spec.opacity, 0.95),
          label,
          labelHtml: sfsDistributionLabelHtml(spec),
          labelAnchor: ["start", "middle", "end"].includes(spec.labelAnchor) ? spec.labelAnchor : "middle",
          labelDx: sfsDistributionFiniteNumber(spec.labelDx, 0),
          labelDy: sfsDistributionFiniteNumber(spec.labelDy, 0),
          spec,
          index
        };
      });
  });
}

sfsDistributionIntervalItems = (opts = {}, distributions = [], domain = [0, 1]) => {
  const intervalSpecs = sfsDistributionAsArray(opts.intervals || opts.interval);
  return intervalSpecs.map((rawSpec, index) => {
    const spec = rawSpec || {};
    const dist = sfsDistributionDistributionBySelector(spec.distribution || spec.dist || spec.series, distributions);
    const from = sfsDistributionFiniteNumber(sfsDistributionValueOr(spec.from, spec.x1), domain[0]);
    const to = sfsDistributionFiniteNumber(sfsDistributionValueOr(spec.to, spec.x2), domain[1]);
    // "curve" centers the bar between the baseline and the curve's height at
    // the interval's outer limit; a number is a fraction of the plot height.
    const heightKey = sfsDistributionNormalizeKey(spec.height);
    return {
      from: Math.max(domain[0], Math.min(from, to)),
      to: Math.min(domain[1], Math.max(from, to)),
      distribution: dist,
      height: ["curve", "curve-mid", "curve-midpoint", "auto"].includes(heightKey)
        ? "curve"
        : sfsDistributionClamp(sfsDistributionFiniteNumber(spec.height, 0.42), 0, 1),
      color: spec.color || spec.stroke || "var(--sfs-neutral-color, #7b818a)",
      strokeWidth: sfsDistributionPositiveNumber(spec.strokeWidth, 2),
      opacity: sfsDistributionFiniteNumber(spec.opacity, 0.95),
      arrows: spec.arrows !== false,
      label: typeof spec.label === "string" ? spec.label : undefined,
      labelHtml: sfsDistributionLabelHtml(spec),
      labelDx: sfsDistributionFiniteNumber(spec.labelDx, 0),
      labelDy: sfsDistributionFiniteNumber(spec.labelDy, 0),
      spec,
      index
    };
  }).filter((item) => item.to > item.from);
}

sfsDistributionCurveFactory = (opts = {}) => {
  const value = sfsDistributionValueOr(opts.interpolation, sfsDistributionValueOr(opts.curveFactory, opts.curve));
  if (typeof value === "function") return value;
  if (value === undefined || value === null) return d3.curveMonotoneX;

  const key = sfsDistributionNormalizeKey(value);
  const curves = {
    basis: d3.curveBasis,
    cardinal: d3.curveCardinal,
    linear: d3.curveLinear,
    monotone: d3.curveMonotoneX,
    "monotone-x": d3.curveMonotoneX,
    natural: d3.curveNatural,
    step: d3.curveStep
  };
  return curves[key] || d3.curveMonotoneX;
}

sfsDistributionDisplay = (opts = {}) => {
  const style = sfsDistributionNormalizeKey(opts.style || opts.display || opts.variant);
  const minimal = ["minimal", "bare", "plain", "curve-only", "curve"].includes(style);
  const showAxes = sfsDistributionBoolean(
    sfsDistributionValueOr(opts.axes, sfsDistributionValueOr(opts.axis, sfsDistributionValueOr(opts.showAxes, opts.showAxis))),
    !minimal
  );
  const showXAxis = sfsDistributionBoolean(sfsDistributionValueOr(opts.xAxis, opts.showXAxis), showAxes);
  const showYAxis = sfsDistributionBoolean(sfsDistributionValueOr(opts.yAxis, opts.showYAxis), showAxes);
  const showAxisLabels = sfsDistributionBoolean(
    sfsDistributionValueOr(opts.axisLabels, sfsDistributionValueOr(opts.showAxisLabels, opts.labels)),
    minimal ? false : opts.labels === false ? false : true
  );
  const showAxisLines = sfsDistributionBoolean(sfsDistributionValueOr(opts.axisLines, opts.showAxisLines), true);
  const showTickLabels = sfsDistributionBoolean(sfsDistributionValueOr(opts.tickLabels, opts.showTickLabels), true);

  return {
    showAxes,
    showXAxis,
    showYAxis,
    showAxisLabels,
    showAxisLines,
    showTickLabels,
    showXLabel: opts.xLabel !== false && showAxisLabels,
    showYLabel: opts.yLabel !== false && showAxisLabels
  };
}

sfsDistributionDimensions = (opts = {}) => {
  const width = sfsDistributionPositiveNumber(opts.width, 640);
  const conceptualMarkers = sfsDistributionIsCentralTendencyPresentation(opts.markerPresentation);
  const aspectRatio = sfsDistributionPositiveNumber(opts.aspectRatio, conceptualMarkers ? 1.65 : 2.2);
  const height = sfsDistributionPositiveNumber(opts.height, width / aspectRatio);
  return { width, height, aspectRatio };
}

sfsDistributionMargin = (opts = {}, display = sfsDistributionDisplay(opts)) => {
  const raw = opts.margin || {};
  const title = sfsDistributionValueOr(opts.title, opts.labels && opts.labels.title);
  const conceptualMarkers = sfsDistributionIsCentralTendencyPresentation(opts.markerPresentation);
  return {
    top: sfsDistributionValueOr(raw.top, title ? 42 : conceptualMarkers ? 32 : 22),
    right: sfsDistributionValueOr(raw.right, 24),
    bottom: sfsDistributionValueOr(
      raw.bottom,
      conceptualMarkers ? 62 : display.showXAxis || display.showXLabel ? 54 : 16
    ),
    left: sfsDistributionValueOr(raw.left, display.showYAxis || display.showYLabel ? 60 : 18)
  };
}

sfsDistributionStyleAxis = (axis, display) => {
  axis.classed("sfs-axis sfs-graph-axis", true)
    .call((g) => g.selectAll("text").attr("class", "sfs-tick-label sfs-graph-tick-label"))
    .call((g) => g.selectAll("line").attr("class", "sfs-graph-tick-line"))
    .call((g) => g.selectAll("path").classed("sfs-graph-domain", true));

  if (!display.showAxisLines) axis.selectAll("path,line").style("display", "none");
  if (!display.showTickLabels) axis.selectAll("text").style("display", "none");
}

sfsDistributionAddLabels = (svg, opts, display, margin, width, height) => {
  const labels = opts.labels || {};
  const title = sfsDistributionValueOr(opts.title, labels.title);
  const xLabel = sfsDistributionValueOr(opts.xLabel, labels.x || labels.xLabel || "Score");
  const yLabel = sfsDistributionValueOr(opts.yLabel, labels.y || labels.yLabel || "Density");

  if (title) {
    svg.append("text")
      .attr("class", "dg-title sfs-graph-title")
      .attr("x", margin.left)
      .attr("y", 18)
      .text(title);
  }

  if (display.showXLabel && xLabel !== false) {
    svg.append("text")
      .attr("class", "dg-x-label sfs-graph-label sfs-axis-label")
      .attr("x", (margin.left + width - margin.right) / 2)
      .attr("y", height - 12)
      .attr("text-anchor", "middle")
      .text(xLabel);
  }

  if (display.showYLabel && yLabel !== false) {
    svg.append("text")
      .attr("class", "dg-y-label sfs-graph-label sfs-axis-label")
      .attr("x", -(margin.top + height - margin.bottom) / 2)
      .attr("y", 17)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .text(yLabel);
  }
}

sfsDistributionAddMarkerLegend = (svg, markerItems, opts, width, margin) => {
  const raw = opts.markerLegend;
  if (raw === undefined || raw === null || raw === false) return null;

  const seen = new Set();
  const rows = markerItems.filter((item) => {
    if (item.label === undefined || seen.has(item.label)) return false;
    seen.add(item.label);
    return true;
  });
  if (!rows.length) return null;

  const side = sfsDistributionNormalizeKey(raw) === "left" ? "left" : "right";
  const legendWidth = d3.max(rows, (row) => String(row.label).length) * 6.5 + 26;
  const legendX = side === "left" ? margin.left + 12 : width - margin.right - legendWidth;

  const legend = svg.append("g")
    .attr("class", "dg-marker-legend sfs-graph-legend")
    .attr("data-fade-opacity", 1)
    .attr("transform", `translate(${legendX},${margin.top + 6})`);

  const items = legend.selectAll("g")
    .data(rows)
    .join("g")
      .attr("transform", (d, i) => `translate(0,${i * 17})`);

  items.append("line")
    .attr("x1", 0)
    .attr("x2", 18)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", (d) => d.color)
    .attr("stroke-width", (d) => d.strokeWidth)
    .attr("stroke-dasharray", (d) => d.dash);

  items.append("text")
    .attr("x", 24)
    .attr("y", 4)
    .text((d) => d.label);

  return legend;
}

sfsDistributionAddLegend = (svg, distributions, opts, width, margin) => {
  if (distributions.length < 2 || opts.legend === false) return;

  const legend = svg.append("g")
    .attr("class", "dg-legend sfs-graph-legend")
    .attr("transform", `translate(${width - margin.right - 130},${margin.top})`);

  const items = legend.selectAll("g")
    .data(distributions)
    .join("g")
      .attr("transform", (d, i) => `translate(0,${i * 20})`);

  items.append("line")
    .attr("x1", 0)
    .attr("x2", 18)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", (d) => d.stroke)
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", (d) => d.strokeDasharray);

  items.append("text")
    .attr("x", 24)
    .attr("y", 4)
    .text((d) => d.name || d.label);
}

sfsDistributionEnsureStyles = () => {
  if (document.getElementById("sfs-distribution-generator-styles")) return;

  const style = document.createElement("style");
  style.id = "sfs-distribution-generator-styles";
  style.textContent = `
    .distribution-graph {
      --sfs-figure-max-width: var(--dg-max-width, 48rem);
    }

    .distribution-graph .dg-shade {
      stroke: none;
    }

    .distribution-graph .dg-curve {
      fill: none;
    }

    .distribution-graph .dg-zero-line {
      stroke: var(--graph-axis-color);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    .distribution-graph .dg-marker-line {
      vector-effect: non-scaling-stroke;
      stroke-linecap: round;
    }

    .distribution-graph .dg-conceptual-baseline,
    .distribution-graph .dg-mode-cap,
    .distribution-graph .dg-median-divider {
      vector-effect: non-scaling-stroke;
      stroke-linecap: round;
    }

    .distribution-graph .dg-conceptual-baseline {
      stroke: var(--graph-axis-color);
      stroke-width: 2;
    }

    .distribution-graph .dg-mode-cap {
      stroke-width: 3;
    }

    .distribution-graph .dg-median-divider {
      stroke-width: 2.5;
    }

    .distribution-graph .dg-mean-fulcrum {
      stroke: none;
    }

    .distribution-graph .dg-conceptual-label,
    .distribution-graph .dg-median-half-label {
      fill: var(--sfs-text);
      font-size: 0.78rem;
      font-weight: 600;
      paint-order: stroke;
      stroke: var(--sfs-bg);
      stroke-linejoin: round;
      stroke-width: 3px;
    }

    .distribution-graph .dg-median-half-label {
      fill: var(--sfs-muted);
      font-size: 0.72rem;
      font-weight: 500;
    }

    .distribution-graph .dg-marker-label,
    .distribution-graph .dg-shade-label,
    .distribution-graph .dg-interval-label {
      font-size: 0.82rem;
    }

    .distribution-graph .dg-interval-line,
    .distribution-graph .dg-interval-arrow {
      vector-effect: non-scaling-stroke;
      stroke-linecap: round;
    }

    .distribution-explorer {
      --sfs-figure-max-width: var(--dpe-max-width, 48rem);
    }

    .distribution-explorer .dpe-chart-wrap {
      margin-top: 0.35rem;
    }

    .distribution-explorer .dpe-control-row {
      grid-template-columns: minmax(4.5rem, auto) minmax(3.25rem, auto) minmax(7rem, 1fr);
    }

    .distribution-explorer .dpe-control-row input[type="range"] {
      width: 100%;
      min-width: 7rem;
    }

    .distribution-explorer .dpe-value {
      justify-self: end;
      min-width: 3.25rem;
      color: var(--sfs-muted);
      font-variant-numeric: tabular-nums;
    }

    .distribution-explorer .dpe-reference-curve {
      stroke: var(--sfs-neutral-color, #7b818a);
      stroke-dasharray: 7 5;
    }

    .distribution-explorer .dpe-controlled-curve {
      stroke: var(--graph-series-1, var(--graph-line-color, #0072b2));
    }

    .central-tendency-morph {
      --sfs-figure-max-width: var(--ctm-max-width, 48rem);
    }

    .central-tendency-morph .ctm-state-label {
      fill: var(--sfs-muted);
      font-size: 0.78rem;
      font-weight: 600;
    }

    .central-tendency-morph .ctm-control-row {
      grid-template-columns: minmax(4.5rem, auto) minmax(9rem, 1fr);
    }

    .central-tendency-morph .ctm-control-row input[type="range"] {
      width: 100%;
      min-width: 9rem;
    }

    .central-tendency-morph .ctm-shape-readout {
      grid-column: 2;
      color: var(--sfs-muted);
      font-size: 0.85rem;
    }

    .central-tendency-morph .ctm-mode-marker {
      transition: opacity 180ms ease;
    }

    @media (max-width: 32rem) {
      .central-tendency-morph .ctm-control-row {
        grid-template-columns: 1fr;
      }

      .central-tendency-morph .ctm-shape-readout {
        grid-column: 1;
      }
    }

    .distribution-family-cover {
      --sfs-figure-max-width: var(--dfc-max-width, var(--sfs-cover-max-width, 46rem));
    }

    .distribution-family-cover .dfc-chart-wrap {
      overflow: hidden;
    }

    .distribution-family-cover .dfc-curve {
      fill: none;
      vector-effect: non-scaling-stroke;
    }

    .distribution-family-cover .dfc-canvas {
      display: block;
      width: 100%;
      height: auto;
    }
  `;
  document.head.appendChild(style);
}

sfsDistributionPrefersReducedMotion = () =>
  window.interactiveRuntime && window.interactiveRuntime.motion
    ? window.interactiveRuntime.motion.isReduced()
    : Boolean(window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches)

sfsDistributionShouldAnimate = (opts = {}) =>
  sfsDistributionBoolean(sfsDistributionValueOr(opts.animate, opts.animation), false) &&
  !sfsDistributionPrefersReducedMotion()

sfsDistributionAnimationTrigger = (opts = {}) => {
  const raw = sfsDistributionValueOr(opts.animationTrigger, sfsDistributionValueOr(opts.trigger, opts.animateOn));
  const key = sfsDistributionNormalizeKey(raw || "visible");
  if (["immediate", "now", "load"].includes(key)) return "immediate";
  if (["manual", "click"].includes(key)) return "manual";
  return "visible";
}

sfsDistributionOnVisible = (element, callback, threshold = 0.3) => {
  if (!element) {
    requestAnimationFrame(callback);
    return;
  }

  if (typeof window.onVisible === "function") {
    window.onVisible(element, callback, threshold);
    return;
  }

  let fired = false;
  const fireOnce = (observer) => {
    if (fired) return;
    fired = true;
    callback();
    if (observer) observer.disconnect();
  };

  if (!("IntersectionObserver" in window)) {
    requestAnimationFrame(() => fireOnce(null));
    return;
  }

  const observer = new IntersectionObserver(([entry], obs) => {
    if (entry.isIntersecting) fireOnce(obs);
  }, { threshold });

  observer.observe(element);

  requestAnimationFrame(() => {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const isVisibleNow =
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < viewportHeight &&
      rect.left < viewportWidth;
    if (isVisibleNow) fireOnce(observer);
  });
}

// A left-to-right reveal, drawn by growing a clip rect rather than by animating
// stroke-dashoffset. The dash technique hides a path behind a dash as long as
// the path itself, which only works if that length is exact: getTotalLength()
// under-measures a density curve built from hundreds of cubic segments, so its
// far end lands inside the *next* dash cycle and hangs in the plot as a stray
// fragment while the rest is still hidden — the "random section that moves
// around" instead of a line drawing itself. A clip rect never asks how long the
// path is; it only needs the plot's own pixel bounds, which are exact by
// construction. Every curve here is monotonic in x, so wiping left to right is
// visually identical to tracing it with a pen. Same fix, same reasoning, as
// sfsGraphRevealClips in graph-generator.js.
sfsDistributionRevealClips = (svg, selection, bounds = {}) => {
  const nodes = typeof selection.nodes === "function" ? selection.nodes() : [];
  if (!nodes.length) return null;

  const pad = sfsDistributionFiniteNumber(bounds.pad, 6);
  const left = sfsDistributionFiniteNumber(bounds.left, 0) - pad;
  const width = Math.max(0, sfsDistributionFiniteNumber(bounds.width, 0) + pad * 2);
  // Generous vertical bounds: the reveal only cares about x, and a curve group
  // may carry its own vertical transform (the family cover scales in y).
  const height = Math.max(1, sfsDistributionFiniteNumber(bounds.height, 0));
  const defs = svg.append("defs");
  const base = `dg-reveal-${Math.round(performance.now() * 1000)}-${Math.round(Math.random() * 1e6)}`;

  return nodes.map((node, index) => {
    const clipId = `${base}-${index}`;
    const rect = defs.append("clipPath")
      .attr("id", clipId)
      .append("rect")
        .attr("x", left)
        .attr("y", -height)
        .attr("width", 0)
        .attr("height", height * 3);
    d3.select(node).attr("clip-path", `url(#${clipId})`);
    return { rect, left, width };
  });
}

sfsDistributionAnimate = (lineSelection, shadeSelection, opts = {}, rootNode = null, fadeSelection = null, growClips = null, revealBounds = null) => {
  if (!sfsDistributionBoolean(sfsDistributionValueOr(opts.animate, opts.animation), false) || sfsDistributionPrefersReducedMotion()) return;

  const revealClips = revealBounds && revealBounds.svg
    ? sfsDistributionRevealClips(revealBounds.svg, lineSelection, revealBounds)
    : null;

  const lineDuration = sfsDistributionPositiveNumber(opts.lineDuration || opts.animationDuration, 1150);
  const lineDelay = sfsDistributionPositiveNumber(opts.lineDelay, 90);
  const lineCount = typeof lineSelection.size === "function" ? lineSelection.size() : 1;
  const defaultShadeDelay = lineDuration + Math.max(0, lineCount - 1) * lineDelay + 120;
  const shadeDelay = opts.shadeDelay === undefined || opts.shadeDelay === null
    ? defaultShadeDelay
    : sfsDistributionPositiveNumber(opts.shadeDelay, defaultShadeDelay);
  const shadeDuration = sfsDistributionPositiveNumber(opts.shadeDuration, 650);

  const reset = () => {
    lineSelection.interrupt();
    if (revealClips) {
      revealClips.forEach((clip) => {
        clip.rect.interrupt().attr("width", 0);
      });
    }

    if (growClips) {
      // Grow mode: the shade keeps its full opacity and its clip rect opens
      // outward from the center instead of the fill fading in.
      shadeSelection
        .interrupt()
        .style("fill-opacity", (d) => d.opacity);
      growClips.forEach((clip) => {
        clip.rect.interrupt()
          .attr("x", clip.xCenter)
          .attr("width", 0);
      });
    } else {
      shadeSelection
        .interrupt()
        .style("fill-opacity", 0);
    }

    if (fadeSelection) {
      fadeSelection
        .interrupt()
        .style("opacity", 0);
    }
  };

  const run = () => {
    reset();

    // Each curve gets its own clip, so several can still be staggered. A dashed
    // curve now keeps its dash pattern while it draws, instead of appearing
    // solid until the reveal ends and the authored pattern snaps back.
    if (revealClips) {
      revealClips.forEach((clip, index) => {
        clip.rect
          .transition()
          .delay(index * lineDelay)
          .duration(lineDuration)
          .ease(d3.easeLinear)
          .attr("width", clip.width);
      });
    }

    if (growClips) {
      growClips.forEach((clip) => {
        clip.rect
          .transition()
          .delay(shadeDelay)
          .duration(shadeDuration)
          .ease(d3.easeCubicOut)
          .attr("x", clip.xLo)
          .attr("width", Math.max(0, clip.xHi - clip.xLo));
      });
    } else {
      shadeSelection
        .transition()
        .delay(shadeDelay)
        .duration(shadeDuration)
        .ease(d3.easeCubicOut)
        .style("fill-opacity", (d) => d.opacity);
    }

    if (fadeSelection) {
      fadeSelection
        .transition()
        .delay(shadeDelay)
        .duration(shadeDuration)
        .ease(d3.easeCubicOut)
        .style("opacity", function() {
          const target = Number(this.dataset && this.dataset.fadeOpacity);
          return Number.isFinite(target) ? target : 1;
        });
    }
  };

  reset();

  const trigger = sfsDistributionAnimationTrigger(opts);
  const threshold = sfsDistributionFiniteNumber(opts.visibilityThreshold, 0.3);
  if (trigger === "visible") {
    sfsDistributionOnVisible(rootNode || lineSelection.node() && lineSelection.node().ownerSVGElement, run, threshold);
  } else if (trigger !== "manual") {
    requestAnimationFrame(run);
  }

  return run;
}

sfsDistributionSequence = (source, fallback = []) => {
  const value = sfsDistributionValueOr(source, fallback);
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }

  if (typeof value === "number") return Number.isFinite(value) ? [value] : [];

  if (value && typeof value === "object") {
    const from = sfsDistributionFiniteNumber(
      sfsDistributionValueOr(value.from, sfsDistributionValueOr(value.start, sfsDistributionValueOr(value.min, value.lower))),
      1
    );
    const to = sfsDistributionFiniteNumber(
      sfsDistributionValueOr(value.to, sfsDistributionValueOr(value.end, sfsDistributionValueOr(value.max, value.upper))),
      from
    );
    const rawStep = sfsDistributionPositiveNumber(value.step, 1);
    const step = to >= from ? rawStep : -rawStep;
    const values = [];
    const epsilon = Math.abs(step) / 1e6;

    for (let current = from, guard = 0; guard < 10000 && (step > 0 ? current <= to + epsilon : current >= to - epsilon); current += step, guard += 1) {
      values.push(Number(current.toFixed(12)));
    }

    return values;
  }

  return [];
}

sfsDistributionFamilyColors = (count, opts = {}) => {
  const explicit = opts.colors || opts.paletteColors;
  if (Array.isArray(explicit) && explicit.length) {
    return d3.range(count).map((index) => explicit[index % explicit.length]);
  }

  const palette = opts.palette;
  if (typeof palette === "function") {
    return d3.range(count).map((index) => palette(index, count));
  }

  const key = sfsDistributionNormalizeKey(palette || "hue");
  if (["default", "series", "tokens"].includes(key)) {
    return d3.range(count).map((index) => sfsDistributionDefaultColors[index % sfsDistributionDefaultColors.length]);
  }

  if (["rainbow", "spectrum"].includes(key) && typeof d3.interpolateRainbow === "function") {
    return d3.range(count).map((index) => d3.interpolateRainbow(index / Math.max(1, count)));
  }

  const cycle = Math.max(1, Math.round(sfsDistributionPositiveNumber(opts.colorCycle, Math.min(count, 10))));
  const hueStart = sfsDistributionFiniteNumber(opts.hueStart, 15);
  const chroma = sfsDistributionFiniteNumber(opts.chroma, 85);
  const luminance = sfsDistributionFiniteNumber(opts.luminance, 62);

  return d3.range(count).map((index) =>
    String(d3.hcl((hueStart + 360 * (index % cycle) / cycle) % 360, chroma, luminance))
  );
}

sfsDistributionFamilySources = (opts = {}) => {
  const explicit = opts.distributions || opts.series;
  if (explicit) return sfsDistributionAsArray(explicit);

  const type = sfsDistributionNormalizeType(opts.distribution || opts.type || "t");

  if (type === "t") {
    return sfsDistributionSequence(opts.df || opts.degreesOfFreedom, { from: 1, to: 100, step: 1 })
      .map((df) => ({
        type,
        distribution: type,
        df,
        key: `t-df-${df}`,
        name: `df = ${df}`
      }));
  }

  if (type === "f") {
    const explicitPairs = opts.pairs || opts.dfPairs || opts.degreesOfFreedomPairs;
    if (explicitPairs) {
      return sfsDistributionAsArray(explicitPairs)
        .map((pair, index) => Array.isArray(pair)
          ? { df1: pair[0], df2: pair[1], index }
          : Object.assign({ index }, pair)
        )
        .map((pair) => ({
          type,
          distribution: type,
          df1: sfsDistributionFiniteNumber(pair.df1 || pair.numeratorDf, 2),
          df2: sfsDistributionFiniteNumber(pair.df2 || pair.denominatorDf, 20),
          key: pair.key || `f-${pair.df1 || pair.numeratorDf}-${pair.df2 || pair.denominatorDf}`,
          name: pair.name || pair.label || `F(${pair.df1 || pair.numeratorDf}, ${pair.df2 || pair.denominatorDf})`
        }));
    }

    const df1Values = sfsDistributionSequence(sfsDistributionValueOr(opts.df1, opts.numeratorDf), [2]);
    const df2Values = sfsDistributionSequence(sfsDistributionValueOr(opts.df2, opts.denominatorDf), { from: 2, to: 60, step: 2 });
    const pairing = sfsDistributionNormalizeKey(
      opts.pairing || opts.pairMode || opts.pairsMode || (opts.grid || opts.cartesian ? "grid" : "zip")
    );

    if (["grid", "cartesian", "cross", "product", "all"].includes(pairing)) {
      return df1Values.flatMap((df1) =>
        df2Values.map((df2) => ({
          type,
          distribution: type,
          df1,
          df2,
          key: `f-${df1}-${df2}`,
          name: `F(${df1}, ${df2})`
        }))
      );
    }

    const count = Math.max(df1Values.length, df2Values.length);

    return d3.range(count).map((index) => {
      const df1 = df1Values[df1Values.length === 1 ? 0 : index % df1Values.length];
      const df2 = df2Values[df2Values.length === 1 ? 0 : index % df2Values.length];
      return {
        type,
        distribution: type,
        df1,
        df2,
        key: `f-${df1}-${df2}`,
        name: `F(${df1}, ${df2})`
      };
    });
  }

  return sfsDistributionSequence(opts.sd || opts.sigma || opts.scale, { from: 0.5, to: 2.5, step: 0.1 })
    .map((scale) => ({
      type,
      distribution: type,
      sd: scale,
      scale,
      key: `${type}-${scale}`,
      name: `${type} ${scale}`
    }));
}

sfsDistributionFamilySpecs = (opts = {}) => {
  const sources = sfsDistributionFamilySources(opts);
  const colors = sfsDistributionFamilyColors(sources.length, opts);
  const defaultStrokeWidth = sfsDistributionPositiveNumber(opts.strokeWidth, 1.35);
  const defaultOpacity = sfsDistributionFiniteNumber(opts.opacity, 0.92);

  return sources.map((source, index) => {
    const colored = Object.assign({}, source);
    if (!colored.color && !colored.stroke) colored.color = colors[index];
    if (colored.opacity === undefined) colored.opacity = defaultOpacity;
    if (colored.strokeWidth === undefined) colored.strokeWidth = defaultStrokeWidth;
    return sfsDistributionSpec(colored, opts, index);
  });
}

sfsDistributionFamilyDomain = (type, opts = {}) => {
  const explicit = opts.xDomain || opts.domain;
  if (explicit && explicit.length >= 2) return explicit.map(Number);
  if (type === "f") return [0, 8];
  return [-3, 3];
}

sfsDistributionFamilyEase = (progress, opts = {}) => {
  const t = sfsDistributionClamp(progress, 0, 1);
  const key = sfsDistributionNormalizeKey(opts.ease || opts.easing || (opts.spring === true ? "spring" : "cubic"));

  if (["linear", "none"].includes(key)) return t;
  if (["sine", "sine-out"].includes(key)) return d3.easeSinOut(t);
  if (["cubic-in", "ease-in", "reverse-cubic", "slow-start"].includes(key)) return d3.easeCubicIn(t);
  if (["cubic-in-out", "ease-in-out"].includes(key)) return d3.easeCubicInOut(t);
  if (["cubic", "cubic-out", "ease-out", "rise"].includes(key)) return d3.easeCubicOut(t);
  if (["back", "back-out"].includes(key)) return d3.easeBackOut.overshoot(1.15)(t);

  return 1 - Math.exp(-6 * t) * Math.cos(10 * t);
}

sfsDistributionFamilyAnimationMode = (opts = {}) => {
  const raw = sfsDistributionValueOr(
    opts.animationMode,
    sfsDistributionValueOr(opts.effect, sfsDistributionValueOr(opts.reveal, opts.animation))
  );
  const key = sfsDistributionNormalizeKey(raw || "rise");

  if (["draw", "draw-on", "drawon", "reveal", "left-to-right", "lefttoright", "wipe"].includes(key)) return "draw";
  if (["both", "draw-rise", "rise-draw", "draw-and-rise", "rise-and-draw"].includes(key)) return "both";
  return "rise";
}

sfsDistributionFamilyDelay = (index, count, opts = {}) => {
  const stagger = sfsDistributionValueOr(opts.stagger, "sqrt");
  if (stagger === false || stagger === 0 || sfsDistributionNormalizeKey(stagger) === "none") return 0;
  if (typeof stagger === "number") return index * Math.max(0, stagger);

  const key = sfsDistributionNormalizeKey(stagger);
  if (["sqrt", "root"].includes(key)) {
    const scale = sfsDistributionPositiveNumber(opts.delayScale || opts.staggerScale, 18000);
    return Math.sqrt(index * scale);
  }

  if (["spread", "even"].includes(key)) {
    const spread = sfsDistributionPositiveNumber(opts.delaySpread || opts.staggerSpread, 1350);
    return count > 1 ? (index / (count - 1)) * spread : 0;
  }

  const delay = sfsDistributionPositiveNumber(opts.delay || opts.lineDelay, 22);
  return index * delay;
}

sfsDistributionFamilyFrameStats = (frameGaps) => {
  if (!frameGaps.length) {
    return {
      frameCount: 1,
      averageFrameGapMs: 0,
      maxFrameGapMs: 0,
      p95FrameGapMs: 0,
      slowFrames: 0
    };
  }

  const sorted = frameGaps.slice().sort((a, b) => a - b);
  const average = d3.mean(frameGaps);
  const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)];

  return {
    frameCount: frameGaps.length + 1,
    averageFrameGapMs: Number(average.toFixed(2)),
    maxFrameGapMs: Number(d3.max(frameGaps).toFixed(2)),
    p95FrameGapMs: Number(p95.toFixed(2)),
    slowFrames: frameGaps.filter((gap) => gap > 34).length
  };
}

sfsDistributionRgba = (color, opacity = 1) => {
  const parsed = d3.color(color);
  if (!parsed) return [0, 0, 0, opacity];
  const parsedOpacity = parsed.opacity === undefined || parsed.opacity === null ? 1 : parsed.opacity;
  return [
    parsed.r / 255,
    parsed.g / 255,
    parsed.b / 255,
    Math.max(0, Math.min(1, parsedOpacity * opacity))
  ];
}

makeDistributionFamilySvgCover = (opts = {}) => {
  const setupStart = performance.now();
  sfsDistributionEnsureStyles();

  const localOpts = Object.assign({
    style: "minimal",
    width: 900,
    aspectRatio: 2.1,
    points: 240,
    animate: true
  }, opts);
  const type = sfsDistributionNormalizeType(localOpts.distribution || localOpts.type || "t");
  const display = sfsDistributionDisplay(localOpts);
  const dimensions = sfsDistributionDimensions(localOpts);
  const { width, height } = dimensions;
  const margin = sfsDistributionMargin(Object.assign({
    margin: { top: 8, right: 8, bottom: 8, left: 8 }
  }, localOpts), display);
  const distributions = sfsDistributionFamilySpecs(localOpts);
  const domain = sfsDistributionFamilyDomain(type, localOpts);
  const points = Math.max(12, Math.round(sfsDistributionPositiveNumber(localOpts.points, 240)));
  const densityCap = sfsDistributionPositiveNumber(localOpts.densityCap || localOpts.yCap || localOpts.maxDensity);
  const rawCurveData = distributions.map((dist) => ({
    distribution: dist,
    data: sfsDistributionCurveData(dist, domain, points).map((point) => Object.assign({}, point, {
      y: densityCap ? Math.min(point.y, densityCap) : point.y
    }))
  }));
  const yMax = d3.max(rawCurveData, (series) => d3.max(series.data, (d) => d.y)) || 1;
  const yDomain = localOpts.yDomain || localOpts.rangeY || (type === "t" ? [0, 0.42] : [0, yMax * 1.08]);
  const x = d3.scaleLinear()
    .domain(domain)
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain(yDomain)
    .range([height - margin.bottom, margin.top]);
  const curve = sfsDistributionCurveFactory(localOpts);
  const line = d3.line()
    .defined((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .curve(curve)
    .x((d) => x(d.x))
    .y((d) => y(d.y));
  const baselineY = y(0);
  const animationMode = sfsDistributionFamilyAnimationMode(localOpts);
  const clipId = `dfc-clip-${Math.round(setupStart * 1000)}-${Math.round(Math.random() * 1e6)}`;
  const performanceEnabled = sfsDistributionBoolean(
    sfsDistributionValueOr(localOpts.performance, sfsDistributionValueOr(localOpts.performanceLog, localOpts.debug)),
    false
  );

  const root = d3.create("div")
    .attr("class", "distribution-family-cover sfs-figure sfs-figure-cover")
    .style("--dfc-max-width", localOpts.maxWidth || null)
    .style("--sfs-figure-margin", localOpts.cssMargin || localOpts.marginCss || null);
  const rootNode = root.node();
  const wrap = root.append("div")
    .attr("class", "dfc-chart-wrap sfs-chart-wrap");
  const svg = wrap.append("svg")
    .attr("class", "dfc-svg sfs-svg sfs-graph sfs-graph-distribution")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", localOpts.ariaLabel || "Animated family of distribution curves");
  svg.append("title").text(localOpts.ariaLabel || "Animated family of distribution curves");
  svg.append("defs")
    .append("clipPath")
      .attr("id", clipId)
    .append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top)
      .attr("width", Math.max(0, width - margin.left - margin.right))
      .attr("height", Math.max(0, height - margin.top - margin.bottom));

  const curveGroups = svg.append("g")
    .attr("class", "dfc-curves")
    .attr("clip-path", `url(#${clipId})`)
    .selectAll("g")
    .data(rawCurveData)
    .join("g")
      .attr("class", "dfc-curve-group");

  const linePaths = curveGroups.append("path")
    .attr("class", "dfc-curve")
    .style("stroke", (d) => d.distribution.stroke)
    .attr("stroke-width", (d) => d.distribution.strokeWidth)
    .attr("stroke-opacity", (d) => d.distribution.opacity)
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
    .attr("d", (d) => line(d.data));
  // Filled comparison covers grow in height at a common center, then separate.
  // Keep the sampled paths fixed: only the baseline scale and x offset change.
  if (localOpts.separateFromCenter) {
    const area = d3.area().curve(curve).x((d) => x(d.x))
      .y0(baselineY).y1((d) => y(d.y));
    curveGroups.insert("path", ".dfc-curve")
      .attr("class", "dfc-area")
      .attr("fill", (d) => d.distribution.color)
      .attr("fill-opacity", localOpts.fillOpacity ?? 0.48)
      .attr("d", (d) => area(d.data));
    linePaths.attr("stroke-opacity", 0);
    const growDuration = localOpts.growDuration || 1100;
    const separateStart = growDuration + 250;
    const separateDuration = localOpts.separateDuration || 1200;
    const timeline = interactiveFigure.coverTimeline(rootNode, {
      duration: separateStart + separateDuration,
      animate: localOpts.animate !== false,
      draw(elapsed) {
        const growth = d3.easeCubicInOut(Math.min(1, elapsed / growDuration));
        const separation = d3.easeCubicInOut(Math.max(0, Math.min(1,
          (elapsed - separateStart) / separateDuration)));
        curveGroups.attr("transform", (d) => {
          const offset = (x(0) - x(d.distribution.mean)) * (1 - separation);
          return `translate(${offset},${baselineY}) scale(1,${growth}) translate(0,${-baselineY})`;
        });
      }
    });
    rootNode.value = { distributions, domain, yDomain, ...timeline };
    return rootNode;
  }
  // Same clip-rect wipe as the single-curve figures — see
  // sfsDistributionRevealClips for why a dashoffset reveal misbehaves here. The
  // group already carries a plot-area clip; a second clip on the path itself is
  // applied independently, and only its x edges matter, so the group's vertical
  // scale transform doesn't disturb it.
  const revealClips = (animationMode === "draw" || animationMode === "both")
    ? sfsDistributionRevealClips(svg, linePaths, {
      left: margin.left,
      width: Math.max(0, width - margin.left - margin.right),
      height
    })
    : null;

  const setRevealProgress = (index, progress) => {
    if (!revealClips || !revealClips[index]) return;
    const clip = revealClips[index];
    clip.rect.attr("width", clip.width * sfsDistributionClamp(progress, 0, 1));
  };

  const timings = rawCurveData.map((d, index) => ({
    delay: sfsDistributionFamilyDelay(index, rawCurveData.length, localOpts),
    duration: sfsDistributionPositiveNumber(localOpts.duration || localOpts.lineDuration || localOpts.animationDuration, 1300)
  }));
  const totalDuration = d3.max(timings, (timing) => timing.delay + timing.duration) || 0;
  const setupMs = performance.now() - setupStart;
  let animationFrame = null;
  let runCounter = 0;

  function transformFor(progress) {
    const p = sfsDistributionClamp(Number.isFinite(progress) ? progress : 1, 0, 1);
    return `translate(0,${baselineY}) scale(1,${p}) translate(0,${-baselineY})`;
  }

  function riseProgress(progress) {
    return animationMode === "draw" ? 1 : progress;
  }

  function revealProgress(progress) {
    return animationMode === "rise" ? 1 : progress;
  }

  function setProgress(progress) {
    curveGroups.attr("transform", transformFor(riseProgress(progress)));
    rawCurveData.forEach((d, index) => {
      setRevealProgress(index, revealProgress(progress));
    });
  }

  function finishPerformanceStats(stats, frameGaps, elapsed) {
    const frameStats = sfsDistributionFamilyFrameStats(frameGaps);
    const next = Object.assign(stats, frameStats, {
      elapsedMs: Number(elapsed.toFixed(2))
    });
    rootNode.value.performance = next;
    if (typeof localOpts.onPerformance === "function") localOpts.onPerformance(next, rootNode);
    if (performanceEnabled && typeof console !== "undefined" && typeof console.info === "function") {
      console.info("[sfsDistributionFamilyCover]", next);
    }
  }

  function run() {
    runCounter += 1;
    const runId = runCounter;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);

    const stats = {
      renderer: "svg-transform",
      distribution: type,
      curves: rawCurveData.length,
      pointsPerCurve: points,
      totalPoints: rawCurveData.length * points,
      setupMs: Number(setupMs.toFixed(2)),
      totalDurationMs: Number(totalDuration.toFixed(2)),
      animationMode
    };
    const frameGaps = [];
    let startTime = null;
    let lastFrame = null;

    function step(timestamp) {
      if (runId !== runCounter) return;
      if (startTime === null) startTime = timestamp;
      if (lastFrame !== null) frameGaps.push(timestamp - lastFrame);
      lastFrame = timestamp;

      const elapsed = timestamp - startTime;
      curveGroups.attr("transform", (d, index) => {
        const timing = timings[index];
        const raw = (elapsed - timing.delay) / timing.duration;
        return transformFor(riseProgress(sfsDistributionFamilyEase(raw, localOpts)));
      });
      rawCurveData.forEach((d, index) => {
        const timing = timings[index];
        const raw = (elapsed - timing.delay) / timing.duration;
        setRevealProgress(index, revealProgress(sfsDistributionFamilyEase(raw, localOpts)));
      });

      if (elapsed < totalDuration) {
        animationFrame = requestAnimationFrame(step);
        return;
      }

      animationFrame = null;
      setProgress(1);
      finishPerformanceStats(stats, frameGaps, elapsed);
    }

    setProgress(0);
    animationFrame = requestAnimationFrame(step);
  }

  const shouldAnimate = sfsDistributionBoolean(
    sfsDistributionValueOr(localOpts.animate, localOpts.animation),
    true
  ) && !sfsDistributionPrefersReducedMotion();

  rootNode.value = {
    distribution: type,
    distributions,
    domain: domain.slice(),
    yDomain: yDomain.slice(),
    curves: rawCurveData.length,
    points,
    renderer: "svg-transform",
    replay: run,
    performance: {
      renderer: "svg-transform",
      animationMode,
      distribution: type,
      curves: rawCurveData.length,
      pointsPerCurve: points,
      totalPoints: rawCurveData.length * points,
      setupMs: Number(setupMs.toFixed(2)),
      skippedAnimation: !shouldAnimate
    }
  };

  if (shouldAnimate) {
    setProgress(0);
    const trigger = sfsDistributionAnimationTrigger(localOpts);
    const threshold = sfsDistributionFiniteNumber(localOpts.visibilityThreshold, 0.2);
    if (trigger === "visible") {
      sfsDistributionOnVisible(rootNode, run, threshold);
    } else if (trigger !== "manual") {
      requestAnimationFrame(run);
    }
    if (localOpts.replayOnClick !== false) svg.on("click", run);
  } else {
    setProgress(1);
  }

  return rootNode;
}

makeDistributionFamilyCanvasCover = (opts = {}) => {
  const setupStart = performance.now();
  sfsDistributionEnsureStyles();

  const localOpts = Object.assign({
    style: "minimal",
    width: 900,
    aspectRatio: 2.1,
    points: 240,
    animate: true
  }, opts);
  const type = sfsDistributionNormalizeType(localOpts.distribution || localOpts.type || "t");
  const display = sfsDistributionDisplay(localOpts);
  const dimensions = sfsDistributionDimensions(localOpts);
  const { width, height } = dimensions;
  const margin = sfsDistributionMargin(Object.assign({
    margin: { top: 8, right: 8, bottom: 8, left: 8 }
  }, localOpts), display);
  const distributions = sfsDistributionFamilySpecs(localOpts);
  const domain = sfsDistributionFamilyDomain(type, localOpts);
  const points = Math.max(12, Math.round(sfsDistributionPositiveNumber(localOpts.points, 240)));
  const densityCap = sfsDistributionPositiveNumber(localOpts.densityCap || localOpts.yCap || localOpts.maxDensity);
  const rawCurveData = distributions.map((dist) => ({
    distribution: dist,
    data: sfsDistributionCurveData(dist, domain, points).map((point) => Object.assign({}, point, {
      y: densityCap ? Math.min(point.y, densityCap) : point.y
    }))
  }));
  const yMax = d3.max(rawCurveData, (series) => d3.max(series.data, (d) => d.y)) || 1;
  const yDomain = localOpts.yDomain || localOpts.rangeY || (type === "t" ? [0, 0.42] : [0, yMax * 1.08]);
  const x = d3.scaleLinear()
    .domain(domain)
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain(yDomain)
    .range([height - margin.bottom, margin.top]);
  const baselineY = y(0);
  const deviceScale = Math.max(1, window.devicePixelRatio || 1);
  const canvasMode = sfsDistributionNormalizeKey(localOpts.canvasMode || localOpts.animationMode || "transform");
  const animationMode = sfsDistributionFamilyAnimationMode(localOpts);
  const performanceEnabled = sfsDistributionBoolean(
    sfsDistributionValueOr(localOpts.performance, sfsDistributionValueOr(localOpts.performanceLog, localOpts.debug)),
    false
  );

  const root = d3.create("div")
    .attr("class", "distribution-family-cover sfs-figure sfs-figure-cover")
    .style("--dfc-max-width", localOpts.maxWidth || null)
    .style("--sfs-figure-margin", localOpts.cssMargin || localOpts.marginCss || null);
  const rootNode = root.node();
  const wrap = root.append("div")
    .attr("class", "dfc-chart-wrap sfs-chart-wrap");
  const canvas = wrap.append("canvas")
    .attr("class", "dfc-canvas")
    .attr("width", Math.round(width * deviceScale))
    .attr("height", Math.round(height * deviceScale))
    .attr("role", "img")
    .attr("aria-label", localOpts.ariaLabel || "Animated family of distribution curves")
    .style("width", "100%")
    .style("height", "auto")
    .node();
  const ctx = canvas.getContext("2d");
  const screenCurves = rawCurveData.map((series) => {
    const finitePoints = series.data
      .map((point) => ({ x: x(point.x), y: y(point.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    const xs = new Float32Array(finitePoints.length);
    const dys = new Float32Array(finitePoints.length);
    const path = new Path2D();
    finitePoints.forEach((point, index) => {
      xs[index] = point.x;
      dys[index] = point.y - baselineY;
      if (index === 0) path.moveTo(point.x, point.y);
      else path.lineTo(point.x, point.y);
    });

    return {
      distribution: series.distribution,
      xs,
      dys,
      path,
      length: finitePoints.length
    };
  });
  const timings = screenCurves.map((d, index) => ({
    delay: sfsDistributionFamilyDelay(index, screenCurves.length, localOpts),
    duration: sfsDistributionPositiveNumber(localOpts.duration || localOpts.lineDuration || localOpts.animationDuration, 1300)
  }));
  const totalDuration = d3.max(timings, (timing) => timing.delay + timing.duration) || 0;
  const setupMs = performance.now() - setupStart;
  let animationFrame = null;
  let runCounter = 0;

  function draw(progressForCurve) {
    ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    for (let index = 0; index < screenCurves.length; index += 1) {
      const series = screenCurves[index];
      const progress = sfsDistributionClamp(progressForCurve(index), 0, 1);
      const drawProgress = animationMode === "rise" ? 1 : progress;
      const riseProgress = animationMode === "draw" ? 1 : progress;
      if (drawProgress <= 0 || !series.length) continue;

      ctx.globalAlpha = series.distribution.opacity;
      ctx.strokeStyle = series.distribution.stroke;
      ctx.lineWidth = series.distribution.strokeWidth;

      if (animationMode === "rise" && canvasMode !== "lerp" && canvasMode !== "manual") {
        ctx.setTransform(
          deviceScale,
          0,
          0,
          deviceScale * riseProgress,
          0,
          deviceScale * baselineY * (1 - riseProgress)
        );
        ctx.stroke(series.path);
        continue;
      }

      ctx.beginPath();
      const visibleCount = animationMode === "rise"
        ? series.length
        : Math.max(2, Math.min(series.length, Math.ceil(drawProgress * series.length)));

      ctx.moveTo(series.xs[0], baselineY + riseProgress * series.dys[0]);
      for (let pointIndex = 1; pointIndex < visibleCount; pointIndex += 1) {
        ctx.lineTo(series.xs[pointIndex], baselineY + riseProgress * series.dys[pointIndex]);
      }

      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  }

  function finishPerformanceStats(stats, frameGaps, elapsed) {
    const frameStats = sfsDistributionFamilyFrameStats(frameGaps);
    const next = Object.assign(stats, frameStats, {
      elapsedMs: Number(elapsed.toFixed(2))
    });
    rootNode.value.performance = next;
    if (typeof localOpts.onPerformance === "function") localOpts.onPerformance(next, rootNode);
    if (performanceEnabled && typeof console !== "undefined" && typeof console.info === "function") {
      console.info("[sfsDistributionFamilyCover]", next);
    }
  }

  function run() {
    runCounter += 1;
    const runId = runCounter;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);

    const stats = {
      renderer: "canvas",
      distribution: type,
      curves: screenCurves.length,
      pointsPerCurve: points,
      totalPoints: screenCurves.length * points,
      setupMs: Number(setupMs.toFixed(2)),
      totalDurationMs: Number(totalDuration.toFixed(2)),
      deviceScale: Number(deviceScale.toFixed(2)),
      canvasMode,
      animationMode
    };
    const frameGaps = [];
    let startTime = null;
    let lastFrame = null;

    function step(timestamp) {
      if (runId !== runCounter) return;
      if (startTime === null) startTime = timestamp;
      if (lastFrame !== null) frameGaps.push(timestamp - lastFrame);
      lastFrame = timestamp;

      const elapsed = timestamp - startTime;
      draw((index) => {
        const timing = timings[index];
        const raw = (elapsed - timing.delay) / timing.duration;
        return sfsDistributionFamilyEase(raw, localOpts);
      });

      if (elapsed < totalDuration) {
        animationFrame = requestAnimationFrame(step);
        return;
      }

      animationFrame = null;
      draw(() => 1);
      finishPerformanceStats(stats, frameGaps, elapsed);
    }

    draw(() => 0);
    animationFrame = requestAnimationFrame(step);
  }

  const shouldAnimate = sfsDistributionBoolean(
    sfsDistributionValueOr(localOpts.animate, localOpts.animation),
    true
  ) && !sfsDistributionPrefersReducedMotion();

  rootNode.value = {
    distribution: type,
    distributions,
    domain: domain.slice(),
    yDomain: yDomain.slice(),
    curves: screenCurves.length,
    points,
    renderer: "canvas",
    replay: run,
    performance: {
      renderer: "canvas",
      animationMode,
      distribution: type,
      curves: screenCurves.length,
      pointsPerCurve: points,
      totalPoints: screenCurves.length * points,
      setupMs: Number(setupMs.toFixed(2)),
      deviceScale: Number(deviceScale.toFixed(2)),
      canvasMode,
      skippedAnimation: !shouldAnimate
    }
  };

  if (shouldAnimate) {
    draw(() => 0);
    const trigger = sfsDistributionAnimationTrigger(localOpts);
    const threshold = sfsDistributionFiniteNumber(localOpts.visibilityThreshold, 0.2);
    if (trigger === "visible") {
      sfsDistributionOnVisible(rootNode, run, threshold);
    } else if (trigger !== "manual") {
      requestAnimationFrame(run);
    }
    if (localOpts.replayOnClick !== false) d3.select(canvas).on("click", run);
  } else {
    draw(() => 1);
  }

  return rootNode;
}

makeDistributionFamilyWebglCover = (opts = {}) => {
  const setupStart = performance.now();
  sfsDistributionEnsureStyles();

  const localOpts = Object.assign({
    style: "minimal",
    width: 900,
    aspectRatio: 2.1,
    points: 240,
    animate: true
  }, opts);
  const type = sfsDistributionNormalizeType(localOpts.distribution || localOpts.type || "t");
  const display = sfsDistributionDisplay(localOpts);
  const dimensions = sfsDistributionDimensions(localOpts);
  const { width, height } = dimensions;
  const margin = sfsDistributionMargin(Object.assign({
    margin: { top: 8, right: 8, bottom: 8, left: 8 }
  }, localOpts), display);
  const distributions = sfsDistributionFamilySpecs(localOpts);
  const domain = sfsDistributionFamilyDomain(type, localOpts);
  const points = Math.max(12, Math.round(sfsDistributionPositiveNumber(localOpts.points, 240)));
  const densityCap = sfsDistributionPositiveNumber(localOpts.densityCap || localOpts.yCap || localOpts.maxDensity);
  const rawCurveData = distributions.map((dist) => ({
    distribution: dist,
    data: sfsDistributionCurveData(dist, domain, points).map((point) => Object.assign({}, point, {
      y: densityCap ? Math.min(point.y, densityCap) : point.y
    }))
  }));
  const yMax = d3.max(rawCurveData, (series) => d3.max(series.data, (d) => d.y)) || 1;
  const yDomain = localOpts.yDomain || localOpts.rangeY || (type === "t" ? [0, 0.42] : [0, yMax * 1.08]);
  const x = d3.scaleLinear()
    .domain(domain)
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain(yDomain)
    .range([height - margin.bottom, margin.top]);
  const baselineY = y(0);
  const deviceScale = Math.max(1, window.devicePixelRatio || 1);
  const animationMode = sfsDistributionFamilyAnimationMode(localOpts);
  const performanceEnabled = sfsDistributionBoolean(
    sfsDistributionValueOr(localOpts.performance, sfsDistributionValueOr(localOpts.performanceLog, localOpts.debug)),
    false
  );

  const root = d3.create("div")
    .attr("class", "distribution-family-cover sfs-figure sfs-figure-cover")
    .style("--dfc-max-width", localOpts.maxWidth || null)
    .style("--sfs-figure-margin", localOpts.cssMargin || localOpts.marginCss || null);
  const rootNode = root.node();
  const wrap = root.append("div")
    .attr("class", "dfc-chart-wrap sfs-chart-wrap");
  const canvas = wrap.append("canvas")
    .attr("class", "dfc-canvas")
    .attr("width", Math.round(width * deviceScale))
    .attr("height", Math.round(height * deviceScale))
    .attr("role", "img")
    .attr("aria-label", localOpts.ariaLabel || "Animated family of distribution curves")
    .style("width", "100%")
    .style("height", "auto")
    .node();
  let gl = null;
  try {
    gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      preserveDrawingBuffer: true,
      stencil: false
    });
  } catch (error) {
    gl = null;
  }

  if (!gl) {
    return makeDistributionFamilyCanvasCover(Object.assign({}, opts, opts.fallback || opts.canvasFallback || {}, { renderer: "canvas" }));
  }

  const vertexSource = `
    attribute vec2 a_position;
    attribute vec2 a_previous;
    attribute vec2 a_next;
    attribute float a_side;
    uniform vec2 u_resolution;
    uniform float u_progress;
    uniform float u_baseline;
    uniform float u_half_width;

    vec2 rise(vec2 point) {
      return vec2(
        point.x,
        u_baseline + u_progress * (point.y - u_baseline)
      );
    }

    void main() {
      vec2 previous = rise(a_previous);
      vec2 current = rise(a_position);
      vec2 next = rise(a_next);
      vec2 tangent = next - previous;
      if (length(tangent) < 0.0001) {
        tangent = vec2(1.0, 0.0);
      } else {
        tangent = normalize(tangent);
      }
      vec2 normal = vec2(-tangent.y, tangent.x);
      vec2 position = current + normal * a_side * u_half_width;
      vec2 zeroToOne = position / u_resolution;
      vec2 clipSpace = zeroToOne * 2.0 - 1.0;
      gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision mediump float;
    uniform vec4 u_color;

    void main() {
      gl_FragColor = u_color;
    }
  `;

  function shader(kind, source) {
    const compiled = gl.createShader(kind);
    gl.shaderSource(compiled, source);
    gl.compileShader(compiled);
    if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(compiled);
      gl.deleteShader(compiled);
      throw new Error(message);
    }
    return compiled;
  }

  let program = null;
  try {
    program = gl.createProgram();
    const vertexShader = shader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = shader(gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
  } catch (error) {
    return makeDistributionFamilyCanvasCover(Object.assign({}, opts, opts.fallback || opts.canvasFallback || {}, {
      renderer: "canvas",
      webglError: String(error && error.message ? error.message : error)
    }));
  }

  const curveMeta = [];
  const vertices = [];
  rawCurveData.forEach((series) => {
    const finitePoints = series.data
      .map((point) => ({ x: x(point.x), y: y(point.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    const offset = vertices.length / 7;
    finitePoints.forEach((point, pointIndex) => {
      const previous = finitePoints[Math.max(0, pointIndex - 1)] || point;
      const next = finitePoints[Math.min(finitePoints.length - 1, pointIndex + 1)] || point;
      vertices.push(point.x, point.y, previous.x, previous.y, next.x, next.y, -1);
      vertices.push(point.x, point.y, previous.x, previous.y, next.x, next.y, 1);
    });
    curveMeta.push({
      distribution: series.distribution,
      rgba: sfsDistributionRgba(series.distribution.stroke, series.distribution.opacity),
      offset,
      length: finitePoints.length
    });
  });

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  const aPosition = gl.getAttribLocation(program, "a_position");
  const aPrevious = gl.getAttribLocation(program, "a_previous");
  const aNext = gl.getAttribLocation(program, "a_next");
  const aSide = gl.getAttribLocation(program, "a_side");
  const uResolution = gl.getUniformLocation(program, "u_resolution");
  const uProgress = gl.getUniformLocation(program, "u_progress");
  const uBaseline = gl.getUniformLocation(program, "u_baseline");
  const uHalfWidth = gl.getUniformLocation(program, "u_half_width");
  const uColor = gl.getUniformLocation(program, "u_color");
  const lineWidthRange = gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE) || [1, 1];
  const timings = curveMeta.map((d, index) => ({
    delay: sfsDistributionFamilyDelay(index, curveMeta.length, localOpts),
    duration: sfsDistributionPositiveNumber(localOpts.duration || localOpts.lineDuration || localOpts.animationDuration, 1300)
  }));
  const totalDuration = d3.max(timings, (timing) => timing.delay + timing.duration) || 0;
  const setupMs = performance.now() - setupStart;
  let animationFrame = null;
  let runCounter = 0;

  gl.useProgram(program);
  const vertexStride = 7 * Float32Array.BYTES_PER_ELEMENT;
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, vertexStride, 0);
  gl.enableVertexAttribArray(aPrevious);
  gl.vertexAttribPointer(aPrevious, 2, gl.FLOAT, false, vertexStride, 2 * Float32Array.BYTES_PER_ELEMENT);
  gl.enableVertexAttribArray(aNext);
  gl.vertexAttribPointer(aNext, 2, gl.FLOAT, false, vertexStride, 4 * Float32Array.BYTES_PER_ELEMENT);
  gl.enableVertexAttribArray(aSide);
  gl.vertexAttribPointer(aSide, 1, gl.FLOAT, false, vertexStride, 6 * Float32Array.BYTES_PER_ELEMENT);
  gl.uniform2f(uResolution, width, height);
  gl.uniform1f(uBaseline, baselineY);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function draw(progressForCurve) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    curveMeta.forEach((series, index) => {
      const progress = sfsDistributionClamp(progressForCurve(index), 0, 1);
      const drawProgress = animationMode === "rise" ? 1 : progress;
      const riseProgress = animationMode === "draw" ? 1 : progress;
      if (drawProgress <= 0 || !series.length) return;
      const visibleCount = animationMode === "rise"
        ? series.length
        : Math.max(2, Math.min(series.length, Math.ceil(drawProgress * series.length)));
      if (visibleCount < 2) return;
      gl.uniform1f(uProgress, riseProgress);
      gl.uniform1f(uHalfWidth, Math.max(0.5, series.distribution.strokeWidth / 2));
      gl.uniform4fv(uColor, series.rgba);
      gl.drawArrays(gl.TRIANGLE_STRIP, series.offset, visibleCount * 2);
    });
  }

  function finishPerformanceStats(stats, frameGaps, elapsed) {
    const frameStats = sfsDistributionFamilyFrameStats(frameGaps);
    const next = Object.assign(stats, frameStats, {
      elapsedMs: Number(elapsed.toFixed(2))
    });
    rootNode.value.performance = next;
    if (typeof localOpts.onPerformance === "function") localOpts.onPerformance(next, rootNode);
    if (performanceEnabled && typeof console !== "undefined" && typeof console.info === "function") {
      console.info("[sfsDistributionFamilyCover]", next);
    }
  }

  function run() {
    runCounter += 1;
    const runId = runCounter;
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);

    const stats = {
      renderer: "webgl-triangle-strip",
      distribution: type,
      curves: curveMeta.length,
      pointsPerCurve: points,
      totalPoints: curveMeta.length * points,
      setupMs: Number(setupMs.toFixed(2)),
      totalDurationMs: Number(totalDuration.toFixed(2)),
      deviceScale: Number(deviceScale.toFixed(2)),
      animationMode,
      nativeLineWidthRange: Array.from(lineWidthRange)
    };
    const frameGaps = [];
    let startTime = null;
    let lastFrame = null;

    function step(timestamp) {
      if (runId !== runCounter) return;
      if (startTime === null) startTime = timestamp;
      if (lastFrame !== null) frameGaps.push(timestamp - lastFrame);
      lastFrame = timestamp;

      const elapsed = timestamp - startTime;
      draw((index) => {
        const timing = timings[index];
        const raw = (elapsed - timing.delay) / timing.duration;
        return sfsDistributionFamilyEase(raw, localOpts);
      });

      if (elapsed < totalDuration) {
        animationFrame = requestAnimationFrame(step);
        return;
      }

      animationFrame = null;
      draw(() => 1);
      finishPerformanceStats(stats, frameGaps, elapsed);
    }

    draw(() => 0);
    animationFrame = requestAnimationFrame(step);
  }

  const shouldAnimate = sfsDistributionBoolean(
    sfsDistributionValueOr(localOpts.animate, localOpts.animation),
    true
  ) && !sfsDistributionPrefersReducedMotion();

  rootNode.value = {
    distribution: type,
    distributions,
    domain: domain.slice(),
    yDomain: yDomain.slice(),
    curves: curveMeta.length,
    points,
    renderer: "webgl-triangle-strip",
    replay: run,
    performance: {
      renderer: "webgl-triangle-strip",
      animationMode,
      distribution: type,
      curves: curveMeta.length,
      pointsPerCurve: points,
      totalPoints: curveMeta.length * points,
      setupMs: Number(setupMs.toFixed(2)),
      deviceScale: Number(deviceScale.toFixed(2)),
      nativeLineWidthRange: Array.from(lineWidthRange),
      skippedAnimation: !shouldAnimate
    }
  };

  if (shouldAnimate) {
    draw(() => 0);
    const trigger = sfsDistributionAnimationTrigger(localOpts);
    const threshold = sfsDistributionFiniteNumber(localOpts.visibilityThreshold, 0.2);
    if (trigger === "visible") {
      sfsDistributionOnVisible(rootNode, run, threshold);
    } else if (trigger !== "manual") {
      requestAnimationFrame(run);
    }
    if (localOpts.replayOnClick !== false) d3.select(canvas).on("click", run);
  } else {
    draw(() => 1);
  }

  return rootNode;
}

makeDistributionFamilyCover = (opts = {}) => {
  const renderer = sfsDistributionNormalizeKey(opts.renderer || opts.render || "svg-transform");
  if (["webgl", "gl", "gpu", "line-strip"].includes(renderer)) return makeDistributionFamilyWebglCover(opts);
  if (["canvas", "2d", "context2d"].includes(renderer)) return makeDistributionFamilyCanvasCover(opts);
  return makeDistributionFamilySvgCover(opts);
}

sfsDistributionRenderGraph = (opts = {}) => {
  sfsDistributionEnsureStyles();

  const distributions = sfsDistributionSpecs(opts);
  const display = sfsDistributionDisplay(opts);
  const dimensions = sfsDistributionDimensions(opts);
  const { width, height } = dimensions;
  const margin = sfsDistributionMargin(opts, display);
  const domain = sfsDistributionResolveDomain(distributions, opts);
  const points = sfsDistributionPositiveNumber(opts.points, 360);
  const curveData = distributions.map((dist) => ({
    distribution: dist,
    data: sfsDistributionCurveData(dist, domain, points)
  }));
  const shadeItems = sfsDistributionShadeItems(opts, distributions, domain);
  const markerItems = sfsDistributionMarkerItems(opts, distributions, domain);
  const intervalItems = sfsDistributionIntervalItems(opts, distributions, domain);
  const shadeGrow = ["grow", "grow-center", "center-out", "outward"].includes(
    sfsDistributionNormalizeKey(opts.shadeAnimation || opts.shadeEffect)
  );
  const yMax = d3.max(curveData, (series) => d3.max(series.data, (d) => d.y)) || 1;
  const yDomain = opts.yDomain || [0, yMax * 1.12];
  const ariaLabel = opts.ariaLabel || opts.title || "Distribution curve graph";

  const rootNode = opts.rootNode || document.createElement("div");
  const root = d3.select(rootNode)
    .attr("class", "distribution-graph sfs-figure")
    .style("--dg-max-width", opts.maxWidth || null)
    .style("--graph-line-color", opts.stroke || opts.color || null)
    .style("--sfs-figure-margin", opts.cssMargin || opts.marginCss || null);
  root.selectAll("*").remove();

  const wrap = root.append("div")
    .attr("class", "dg-chart-wrap sfs-chart-wrap");

  const svg = wrap.append("svg")
    .attr("class", "dg-svg sfs-svg sfs-graph sfs-graph-distribution")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", ariaLabel);
  svg.append("title").text(ariaLabel);

  const x = d3.scaleLinear()
    .domain(domain)
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain(yDomain)
    .nice()
    .range([height - margin.bottom, margin.top]);
  const curve = sfsDistributionCurveFactory(opts);
  const line = d3.line()
    .defined((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .curve(curve)
    .x((d) => x(d.x))
    .y((d) => y(d.y));
  const area = d3.area()
    .defined((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .curve(curve)
    .x((d) => x(d.x))
    .y0(y(0))
    .y1((d) => y(d.y));

  const conceptualMarkerItems = markerItems.filter((item) => item.presentation !== "line");
  const conceptualMedianItems = conceptualMarkerItems.filter((item) => item.presentation === "median");
  const conceptualDistributions = Array.from(new Set(
    conceptualMarkerItems.map((item) => item.distribution)
  ));
  let conceptualMedianLabels = null;

  if (conceptualMarkerItems.length) {
    const conceptualLayer = svg.append("g")
      .attr("class", "dg-conceptual-areas");

    conceptualLayer.selectAll("path.dg-conceptual-fill")
      .data(curveData.filter((series) => conceptualDistributions.includes(series.distribution)))
      .join("path")
        .attr("class", "dg-conceptual-fill")
        .attr("fill", opts.conceptualFill || "var(--sfs-neutral-color, #7b818a)")
        .style("fill-opacity", sfsDistributionFiniteNumber(opts.conceptualFillOpacity, 0.16))
        .attr("d", (d) => area(d.data));

    const hatchDefs = svg.append("defs");
    const hatchIdBase = `dg-median-hatch-${Math.round(performance.now() * 1000)}-${Math.round(Math.random() * 1e6)}`;
    const medianAreaItems = conceptualMedianItems.flatMap((item, itemIndex) => {
      const lowerColor = item.spec.lowerColor || opts.medianLowerColor || "var(--graph-series-7, #f0e442)";
      const upperColor = item.spec.upperColor || opts.medianUpperColor || "var(--graph-series-6, #56b4e9)";
      return [
        {
          marker: item,
          side: "lower",
          color: lowerColor,
          patternId: `${hatchIdBase}-${itemIndex}-lower`,
          data: sfsDistributionSegmentData(item.distribution, domain[0], item.x, domain, points)
        },
        {
          marker: item,
          side: "upper",
          color: upperColor,
          patternId: `${hatchIdBase}-${itemIndex}-upper`,
          data: sfsDistributionSegmentData(item.distribution, item.x, domain[1], domain, points)
        }
      ];
    }).filter((item) => item.data.length > 1);

    medianAreaItems.forEach((item) => {
      const pattern = hatchDefs.append("pattern")
        .attr("id", item.patternId)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 9)
        .attr("height", 9)
        .attr("patternTransform", item.side === "lower" ? "rotate(45)" : "rotate(-45)");
      pattern.append("line")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", -2)
        .attr("y2", 11)
        .attr("stroke", item.color)
        .attr("stroke-width", 2.4)
        .attr("stroke-opacity", 0.78);
    });

    conceptualLayer.selectAll("path.dg-median-half")
      .data(medianAreaItems)
      .join("path")
        .attr("class", (d) => `dg-median-half dg-median-${d.side}`)
        .attr("fill", (d) => `url(#${d.patternId})`)
        .attr("d", (d) => area(d.data));

    const labeledMedianAreas = medianAreaItems.map((item) => {
      const weightTotal = d3.sum(item.data, (d) => d.y);
      const centroidX = weightTotal > 0
        ? d3.sum(item.data, (d) => d.x * d.y) / weightTotal
        : (item.data[0].x + item.data[item.data.length - 1].x) / 2;
      const nearest = item.data.reduce((best, point) =>
        Math.abs(point.x - centroidX) < Math.abs(best.x - centroidX) ? point : best,
      item.data[0]);
      return Object.assign({}, item, {
        labelX: x(centroidX),
        labelY: (y(0) + y(nearest.y)) / 2 + 4
      });
    });

    conceptualMedianLabels = conceptualLayer.selectAll("text.dg-median-half-label")
      .data(labeledMedianAreas)
      .join("text")
        .attr("class", "dg-median-half-label sfs-graph-label")
        .attr("x", (d) => d.labelX)
        .attr("y", (d) => d.labelY)
        .attr("text-anchor", "middle")
        .text("50%");

    conceptualLayer.append("line")
      .attr("class", "dg-conceptual-baseline")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", y(0))
      .attr("y2", y(0));
  }

  if (opts.grid) {
    svg.append("g")
      .attr("class", "dg-grid sfs-graph-grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y)
        .ticks(sfsDistributionValueOr(opts.yTicks, 5))
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat(""))
      .call((g) => g.select(".domain").remove());
  }

  const shadePaths = svg.append("g")
    .attr("class", "dg-shades")
    .selectAll("path")
    .data(shadeItems)
    .join("path")
      .attr("class", (d) => `dg-shade sfs-graph-area ${d.kind === "overlap" ? "dg-overlap" : "dg-area"}`)
      .attr("fill", (d) => d.color)
      .style("fill-opacity", (d) => d.opacity)
      .attr("d", (d) => area(d.data));

  let growClips = null;
  if (shadeGrow && shadeItems.length) {
    const growIdBase = `dg-grow-${Math.round(performance.now() * 1000)}-${Math.round(Math.random() * 1e6)}`;
    const defs = svg.append("defs");
    growClips = [];
    shadePaths.each(function(d, i) {
      const xLo = x(d.data[0].x);
      const xHi = x(d.data[d.data.length - 1].x);
      const growFrom = sfsDistributionFiniteNumber(d.spec && d.spec.growFrom);
      const xCenter = Number.isFinite(growFrom)
        ? sfsDistributionClamp(x(growFrom), xLo, xHi)
        : (xLo + xHi) / 2;
      const clipId = `${growIdBase}-${i}`;
      const rect = defs.append("clipPath")
        .attr("id", clipId)
        .append("rect")
          .attr("x", xLo)
          .attr("y", 0)
          .attr("width", Math.max(0, xHi - xLo))
          .attr("height", height);
      d3.select(this).attr("clip-path", `url(#${clipId})`);
      growClips.push({ rect, xLo, xHi, xCenter });
    });
  }

  const markerGroups = svg.append("g")
    .attr("class", "dg-markers")
    .selectAll("g")
    .data(markerItems)
    .join("g")
      .attr("class", "dg-marker")
      .attr("data-fade-opacity", (d) => d.opacity)
      .style("opacity", (d) => d.opacity);

  const markerTopY = (d) => {
    if (d.height === "full") return margin.top;
    if (typeof d.height === "number") return y(0) - d.height * (y(0) - margin.top);
    return y(d.y);
  };

  markerGroups.filter((d) => d.presentation === "line").append("line")
    .attr("class", "dg-marker-line")
    .attr("x1", (d) => x(d.x))
    .attr("x2", (d) => x(d.x))
    .attr("y1", y(0))
    .attr("y2", markerTopY)
    .attr("stroke", (d) => d.color)
    .attr("stroke-width", (d) => d.strokeWidth)
    .attr("stroke-dasharray", (d) => d.dash);

  const conceptualModeGroups = markerGroups.filter((d) => d.presentation === "mode");
  conceptualModeGroups.append("line")
    .attr("class", "dg-mode-cap")
    .attr("x1", (d) => Math.max(margin.left, x(d.x) - sfsDistributionPositiveNumber(d.spec.capWidth, 17)))
    .attr("x2", (d) => Math.min(width - margin.right, x(d.x) + sfsDistributionPositiveNumber(d.spec.capWidth, 17)))
    .attr("y1", (d) => y(d.y) - 3)
    .attr("y2", (d) => y(d.y) - 3)
    .attr("stroke", (d) => d.color)
    .attr("stroke-width", (d) => sfsDistributionPositiveNumber(d.spec.strokeWidth, 3));

  conceptualModeGroups.filter((d) => d.label !== undefined || d.labelHtml !== undefined)
    .append("text")
      .attr("class", "dg-conceptual-label dg-mode-label sfs-graph-label")
      .attr("x", (d) => x(d.x) + d.labelDx)
      .attr("y", (d) => y(d.y) - 11 + d.labelDy)
      .attr("text-anchor", "middle")
      .each(function(d) {
        if (d.labelHtml !== undefined) d3.select(this).html(d.labelHtml);
        else d3.select(this).text(d.label);
      });

  const medianTopY = (d) => Math.min(y(d.y), y(0) - sfsDistributionPositiveNumber(d.spec.minHeight, 42));
  const conceptualMedianGroups = markerGroups.filter((d) => d.presentation === "median");
  conceptualMedianGroups.append("line")
    .attr("class", "dg-median-divider")
    .attr("x1", (d) => x(d.x))
    .attr("x2", (d) => x(d.x))
    .attr("y1", y(0))
    .attr("y2", medianTopY)
    .attr("stroke", (d) => d.color)
    .attr("stroke-width", (d) => sfsDistributionPositiveNumber(d.spec.strokeWidth, 2.5));

  conceptualMedianGroups.filter((d) => d.label !== undefined || d.labelHtml !== undefined)
    .append("text")
      .attr("class", "dg-conceptual-label dg-median-label sfs-graph-label")
      .attr("x", (d) => x(d.x) + (x(d.x) > (margin.left + width - margin.right) / 2 ? -6 : 6) + d.labelDx)
      .attr("y", (d) => (y(0) + medianTopY(d)) / 2 + 4 + d.labelDy)
      .attr("text-anchor", (d) => x(d.x) > (margin.left + width - margin.right) / 2 ? "end" : "start")
      .each(function(d) {
        if (d.labelHtml !== undefined) d3.select(this).html(d.labelHtml);
        else d3.select(this).text(d.label);
      });

  const conceptualMeanGroups = markerGroups.filter((d) => d.presentation === "mean");
  conceptualMeanGroups.append("polygon")
    .attr("class", "dg-mean-fulcrum")
    .attr("points", (d) => {
      const center = x(d.x);
      const halfWidth = sfsDistributionPositiveNumber(d.spec.fulcrumWidth, 10);
      const fulcrumHeight = sfsDistributionPositiveNumber(d.spec.fulcrumHeight, 11);
      return `${center},${y(0) + 1} ${center + halfWidth},${y(0) + fulcrumHeight} ${center - halfWidth},${y(0) + fulcrumHeight}`;
    })
    .attr("fill", (d) => d.color);

  conceptualMeanGroups.filter((d) => d.label !== undefined || d.labelHtml !== undefined)
    .append("text")
      .attr("class", "dg-conceptual-label dg-mean-label sfs-graph-label")
      .attr("x", (d) => x(d.x) + d.labelDx)
      .attr("y", (d) => y(0) + sfsDistributionPositiveNumber(d.spec.fulcrumHeight, 11) + 15 + d.labelDy)
      .attr("text-anchor", "middle")
      .each(function(d) {
        if (d.labelHtml !== undefined) d3.select(this).html(d.labelHtml);
        else d3.select(this).text(d.label);
      });

  const lineMarkerItems = markerItems.filter((item) => item.presentation === "line");
  const markerLegend = sfsDistributionAddMarkerLegend(svg, lineMarkerItems, opts, width, margin);

  markerGroups.filter((d) => d.presentation === "line" && (d.label !== undefined || d.labelHtml !== undefined) && !markerLegend)
    .append("text")
      .attr("class", "dg-marker-label sfs-graph-label")
      .attr("x", (d) => x(d.x) + d.labelDx)
      .attr("y", (d) => markerTopY(d) - 7 + d.labelDy)
      .attr("text-anchor", (d) => d.labelAnchor)
      .style("fill", (d) => d.spec.labelColor || d.color)
      .each(function(d) {
        if (d.labelHtml !== undefined) d3.select(this).html(d.labelHtml);
        else d3.select(this).text(d.label);
      });

  const intervalGroups = svg.append("g")
    .attr("class", "dg-intervals")
    .selectAll("g")
    .data(intervalItems)
    .join("g")
      .attr("class", "dg-interval")
      .attr("data-fade-opacity", (d) => d.opacity)
      .style("opacity", (d) => d.opacity);

  const intervalY = (d) => {
    if (d.height === "curve") {
      const limitPdf = Math.min(
        sfsDistributionFinitePdf(d.distribution, d.from),
        sfsDistributionFinitePdf(d.distribution, d.to)
      );
      return (y(0) + y(limitPdf)) / 2;
    }
    return y(0) - d.height * (y(0) - margin.top);
  };
  const intervalArrowSize = 7;

  intervalGroups.append("line")
    .attr("class", "dg-interval-line")
    .attr("x1", (d) => x(d.from) + (d.arrows ? 1.5 : 0))
    .attr("x2", (d) => x(d.to) - (d.arrows ? 1.5 : 0))
    .attr("y1", intervalY)
    .attr("y2", intervalY)
    .attr("stroke", (d) => d.color)
    .attr("stroke-width", (d) => d.strokeWidth);

  intervalGroups.filter((d) => d.arrows).each(function(d) {
    const group = d3.select(this);
    const midY = intervalY(d);
    const arrow = (tipX, direction) =>
      `M${tipX + direction * intervalArrowSize},${midY - intervalArrowSize * 0.62}` +
      `L${tipX},${midY}` +
      `L${tipX + direction * intervalArrowSize},${midY + intervalArrowSize * 0.62}`;
    group.append("path")
      .attr("class", "dg-interval-arrow")
      .attr("d", `${arrow(x(d.from), 1)}${arrow(x(d.to), -1)}`)
      .attr("fill", "none")
      .attr("stroke", d.color)
      .attr("stroke-width", d.strokeWidth)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");
  });

  intervalGroups.filter((d) => d.label !== undefined || d.labelHtml !== undefined)
    .append("text")
      .attr("class", "dg-interval-label sfs-graph-label")
      .attr("x", (d) => (x(d.from) + x(d.to)) / 2 + d.labelDx)
      .attr("y", (d) => intervalY(d) - 8 + d.labelDy)
      .attr("text-anchor", "middle")
      .style("fill", (d) => d.spec.labelColor || d.color)
      .each(function(d) {
        if (d.labelHtml !== undefined) d3.select(this).html(d.labelHtml);
        else d3.select(this).text(d.label);
      });

  const linePaths = svg.append("g")
    .attr("class", "dg-curves")
    .selectAll("path")
    .data(curveData)
    .join("path")
      .attr("class", "dg-curve sfs-graph-line")
      .style("stroke", (d) => d.distribution.stroke)
      .attr("stroke-width", (d) => d.distribution.strokeWidth)
      .attr("stroke-opacity", (d) => d.distribution.opacity)
      .attr("stroke-dasharray", (d) => d.distribution.strokeDasharray)
      .attr("d", (d) => line(d.data));

  const labeledShadeItems = shadeItems.filter((item) => item.label !== undefined).map((item) => {
    const weightTotal = d3.sum(item.data, (d) => d.y);
    const centroidX = weightTotal > 0
      ? d3.sum(item.data, (d) => d.x * d.y) / weightTotal
      : (item.data[0].x + item.data[item.data.length - 1].x) / 2;
    const curveYAtCentroid = item.data.reduce((best, d) =>
      Math.abs(d.x - centroidX) < Math.abs(best.x - centroidX) ? d : best, item.data[0]).y;
    const regionWidth = Math.abs(x(item.data[item.data.length - 1].x) - x(item.data[0].x));
    const regionHeight = y(0) - y(curveYAtCentroid);
    const textWidth = String(item.label).length * 7.2;
    const inside = item.labelPosition === "inside" ||
      (item.labelPosition !== "above" && regionWidth >= textWidth + 10 && regionHeight >= 28);
    const maxRegionY = d3.max(item.data, (d) => d.y) || 0;
    const labelY = inside
      ? (y(0) + y(curveYAtCentroid)) / 2 + 4
      : y(maxRegionY) - 9;
    return Object.assign({}, item, {
      labelX: x(centroidX),
      labelYPx: labelY - item.labelOffset
    });
  });

  const shadeLabelTexts = svg.append("g")
    .attr("class", "dg-shade-labels")
    .selectAll("text")
    .data(labeledShadeItems)
    .join("text")
      .attr("class", "dg-shade-label sfs-graph-label")
      .attr("data-fade-opacity", 1)
      .attr("x", (d) => d.labelX)
      .attr("y", (d) => d.labelYPx)
      .attr("text-anchor", "middle")
      .text((d) => d.label);

  const fadeNodes = markerGroups.nodes()
    .concat(intervalGroups.nodes())
    .concat(shadeLabelTexts.nodes())
    .concat(conceptualMedianLabels ? conceptualMedianLabels.nodes() : [])
    .concat(markerLegend ? markerLegend.nodes() : []);
  const fadeSelection = fadeNodes.length ? d3.selectAll(fadeNodes) : null;

  if (display.showXAxis) {
    const xAxis = svg.append("g")
      .attr("class", "dg-x-axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x)
        .ticks(sfsDistributionValueOr(opts.xTicks, 7))
        .tickFormat(opts.xTickFormat || opts.tickFormat || d3.format("~g")));
    sfsDistributionStyleAxis(xAxis, display);
  }

  if (display.showYAxis) {
    const yAxis = svg.append("g")
      .attr("class", "dg-y-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y)
        .ticks(sfsDistributionValueOr(opts.yTicks, 5))
        .tickFormat(opts.yTickFormat || opts.yFormat || d3.format("~g")));
    sfsDistributionStyleAxis(yAxis, display);
  }

  sfsDistributionAddLabels(svg, opts, display, margin, width, height);
  sfsDistributionAddLegend(svg, distributions, opts, width, margin);
  // Geometry, not clips: a clip rect starts at zero width, so it must only be
  // attached when the reveal is actually going to run. Hand the bounds over and
  // let the animator build them after its own opt-out checks.
  const animationRunner = sfsDistributionAnimate(
    linePaths,
    shadePaths,
    opts,
    rootNode,
    fadeSelection,
    growClips,
    {
      svg,
      left: margin.left,
      width: Math.max(0, width - margin.left - margin.right),
      height
    }
  );
  if (animationRunner && opts.replayOnClick !== false) svg.on("click", animationRunner);

  rootNode.value = {
    distributions,
    domain: domain.slice(),
    yDomain: y.domain().slice(),
    shade: shadeItems.map((item) => ({
      kind: item.kind,
      distribution: item.distribution ? item.distribution.key : undefined,
      from: item.from,
      to: item.to,
      color: item.color,
      opacity: item.opacity,
      label: item.label,
      area: item.labelValue
    })),
    markers: markerItems.map((item) => ({
      x: item.x,
      stat: item.stat,
      presentation: item.presentation,
      label: item.label,
      distribution: item.distribution ? item.distribution.key : undefined
    })),
    intervals: intervalItems.map((item) => ({
      from: item.from,
      to: item.to,
      label: item.label
    })),
    stats: distributions.map((dist) => ({
      distribution: dist.key,
      mean: sfsDistributionMeanValue(dist),
      median: sfsDistributionQuantile(dist, 0.5),
      modes: sfsDistributionModes(dist, domain)
    }))
  };

  return rootNode;
}

sfsDistributionParsePixels = (value) => {
  if (typeof value === "number") return sfsDistributionPositiveNumber(value);
  const match = /^\s*([\d.]+)px\s*$/.exec(String(value === undefined ? "" : value));
  return match ? sfsDistributionPositiveNumber(Number(match[1])) : undefined;
}

// Match the responsive contract used by graph-generator.js: draw once at the
// authored size so the figure can mount immediately, then redraw to the width
// it actually occupies. Keeping the viewBox in step with the rendered width is
// what lets the shared rem-based tick, label, and annotation sizes remain real
// screen sizes instead of shrinking along with a fixed 640-unit chart.
sfsDistributionObserveWidth = (rootNode, opts, redraw) => {
  const api = window.interactiveFigure;
  if (!api || typeof api.observeResponsiveLayout !== "function") return;

  const svgNode = rootNode.querySelector("svg");
  if (!svgNode) return;
  const viewBox = svgNode.viewBox && svgNode.viewBox.baseVal;
  const drawn = {
    width: (viewBox && viewBox.width) || sfsDistributionPositiveNumber(opts.width, 640),
    height: (viewBox && viewBox.height) || sfsDistributionPositiveNumber(opts.height, 640 / 2.2)
  };
  const cssCap = sfsDistributionParsePixels(opts.maxWidth);
  const maximumWidth = Math.max(
    240,
    cssCap || sfsDistributionPositiveNumber(opts.maximumWidth, 1600)
  );
  let drawnWidth = drawn.width;
  let firstLayout = true;

  api.observeResponsiveLayout({
    root: rootNode,
    container: rootNode,
    minimumWidth: 240,
    maximumWidth,
    widthStep: 4,
    onLayout(layout) {
      const width = Math.round(layout.width);
      const wasFirst = firstLayout;
      firstLayout = false;
      if (width === Math.round(drawnWidth)) return;
      drawnWidth = width;

      if (typeof api.cancelTransitions === "function") {
        api.cancelTransitions(rootNode);
      }
      const next = Object.assign({}, opts, {
        rootNode,
        width,
        height: Math.round(drawn.height * (width / drawn.width)),
        responsive: false,
        animate: wasFirst ? opts.animate : false
      });
      redraw(next);
    }
  });
}

makeDistributionGraph = (opts = {}) => {
  const rootNode = sfsDistributionRenderGraph(opts);
  if (opts.responsive === false || !rootNode) return rootNode;
  sfsDistributionObserveWidth(rootNode, opts, sfsDistributionRenderGraph);
  return rootNode;
}

// Abstract inference covers use the figure renderer's curves, quantiles and
// area paths; the shared cover timeline only sequences their entrance.
makeInferenceCover = (opts = {}) => {
  const root = makeDistributionGraph(Object.assign({
    style: "minimal", width: 900, aspectRatio: 2.4, legend: false,
    maxWidth: "var(--sfs-cover-max-width, 46rem)"
  }, opts, { animate: false, responsive: false }));
  root.classList.add("sfs-figure-cover");
  const svg = d3.select(root).select("svg");
  const lines = svg.selectAll(".dg-curve");
  const shades = svg.selectAll(".dg-shade");
  const [, , width, height] = svg.attr("viewBox").split(/[ ,]+/).map(Number);
  const clips = sfsDistributionRevealClips(svg, lines, { left: 0, width, height });
  const lineDuration = 1150, shadeDuration = 650, shadeDelay = 120;
  const stageDuration = lineDuration + shadeDelay + shadeDuration + 250;
  const progress = (elapsed, start, duration) =>
    d3.easeCubicInOut(Math.max(0, Math.min(1, (elapsed - start) / duration)));
  const timeline = interactiveFigure.coverTimeline(root, {
    duration: stageDuration * lines.size() - 250,
    animate: opts.animate !== false,
    draw(elapsed) {
      clips.forEach((clip, index) => clip.rect.attr("width",
        clip.width * progress(elapsed, index * stageDuration, lineDuration)));
      shades.style("fill-opacity", (d) => d.opacity * progress(elapsed,
        (d.distribution?.index || 0) * stageDuration + lineDuration + shadeDelay,
        shadeDuration));
    }
  });
  Object.assign(root.value, timeline);
  return root;
}

sfsDistributionClamp = (value, min, max) =>
  Math.max(min, Math.min(max, value))

sfsDistributionLerp = (from, to, amount) =>
  from + (to - from) * amount

// Two independent parameters: skew (-1..1) controls asymmetry, and bimodal
// (0..1) controls how far a second, mirrored peak has separated from the
// first. Both components share the same skew, so a skewed bimodal
// distribution has two identically-skewed peaks. At bimodal = 0 the second
// component's weight is zero, so skew alone produces one skew-normal peak;
// at bimodal = 1 the two components have equal weight at symmetric offsets.
sfsCentralTendencyMorphSpec = (skew = 0, bimodal = 0) => {
  const skewValue = sfsDistributionClamp(sfsDistributionFiniteNumber(skew, 0), -1, 1);
  const bimodalValue = sfsDistributionClamp(sfsDistributionFiniteNumber(bimodal, 0), 0, 1);
  const maxAlpha = 6.5;
  const alpha = skewValue * maxAlpha;
  const separation = 2.6 * bimodalValue;
  const weight2 = 0.5 * bimodalValue;
  const scale = sfsDistributionLerp(1, 0.8, bimodalValue);

  const first = {
    type: "skew-normal",
    location: -separation / 2,
    scale,
    shape: alpha,
    weight: 1 - weight2
  };
  const second = {
    type: "skew-normal",
    location: separation / 2,
    scale,
    shape: alpha,
    weight: weight2
  };

  return sfsDistributionSpec({
    distribution: "mixture",
    key: "central-tendency-morph",
    components: [first, second],
    color: "var(--graph-series-1, var(--graph-line-color, #0072b2))",
    strokeWidth: 2.8
  });
}

// Orders the actual computed marker positions (not the skew/bimodal inputs)
// so the on-screen readout reflects whatever relationship currently holds,
// including transient states mid-animation where skew and bimodal both
// have partial values and the analytic textbook cases don't cleanly apply.
sfsCentralTendencyMorphComparisonLabel = (modes, median, mean, domain) => {
  const span = Math.abs((domain && domain[1] - domain[0]) || 0) || 1;
  const epsilon = span * 0.010;

  const items = (modes || []).map((value) => ({ label: "mode", value }));
  items.push({ label: "median", value: median });
  items.push({ label: "mean", value: mean });
  items.sort((a, b) => a.value - b.value);

  const groups = [];
  items.forEach((item) => {
    const last = groups[groups.length - 1];
    if (last && item.value - last.value <= epsilon) {
      if (!last.labels.includes(item.label)) last.labels.push(item.label);
    } else {
      groups.push({ value: item.value, labels: [item.label] });
    }
  });

  return groups.map((group) => group.labels.join(" = ")).join(" < ");
}

sfsCentralTendencyMorphLabel = (skew = 0, bimodal = 0) => {
  const skewValue = sfsDistributionClamp(sfsDistributionFiniteNumber(skew, 0), -1, 1);
  const bimodalValue = sfsDistributionClamp(sfsDistributionFiniteNumber(bimodal, 0), 0, 1);
  const skewMagnitude = Math.abs(skewValue);

  if (bimodalValue >= 0.94) return "Symmetrical, two peaks";
  if (bimodalValue >= 0.08) return "A second peak emerges";
  if (skewMagnitude < 0.08) return "Symmetrical, one peak";
  if (skewMagnitude < 0.4) return `A ${skewValue < 0 ? "left" : "right"} tail grows`;
  return skewValue < 0 ? "Negatively skewed" : "Positively skewed";
}

makeCentralTendencyMorph = (opts = {}) => {
  sfsDistributionEnsureStyles();

  const preferredWidth = sfsDistributionPositiveNumber(opts.width, 720);
  let width = preferredWidth;
  const height = sfsDistributionPositiveNumber(opts.height, 338);
  const margin = Object.assign({ top: 34, right: 24, bottom: 52, left: 24 }, opts.margin || {});
  const explicitDomain = Array.isArray(opts.xDomain) && opts.xDomain.length >= 2
    ? opts.xDomain.map(Number)
    : null;
  const explicitYDomain = Array.isArray(opts.yDomain) && opts.yDomain.length >= 2
    ? opts.yDomain.map(Number)
    : null;
  const domainPadding = sfsDistributionPositiveNumber(opts.domainPadding, 0.15);
  const yHeadroom = sfsDistributionPositiveNumber(opts.yHeadroom, 1.12);
  const points = Math.max(160, Math.round(sfsDistributionPositiveNumber(opts.points, 420)));
  const transitionDuration = sfsDistributionPositiveNumber(
    sfsDistributionValueOr(opts.transitionDuration, opts.duration),
    1100
  );
  const modeColor = opts.modeColor || sfsDistributionConceptualMarkerDefaults.mode.color;
  const medianColor = opts.medianColor || sfsDistributionConceptualMarkerDefaults.median.color;
  const meanColor = opts.meanColor || sfsDistributionConceptualMarkerDefaults.mean.color;
  const lowerColor = opts.medianLowerColor || "var(--graph-series-7, #f0e442)";
  const upperColor = opts.medianUpperColor || "var(--graph-series-6, #56b4e9)";
  const initialSkew = sfsDistributionClamp(sfsDistributionFiniteNumber(opts.skew, 0), -1, 1);
  const initialBimodal = sfsDistributionClamp(sfsDistributionFiniteNumber(opts.bimodal, 0), 0, 1);
  let targetSkew = initialSkew;
  let targetBimodal = initialBimodal;
  let renderedSkew = initialSkew;
  let renderedBimodal = initialBimodal;
  let activeTween = null;

  const root = d3.create("div")
    .attr("class", "central-tendency-morph distribution-graph sfs-figure")
    .style("--ctm-max-width", opts.maxWidth || null)
    .style("--sfs-figure-margin", opts.cssMargin || opts.marginCss || null);
  const rootNode = root.node();

  const controls = root.append("div")
    .attr("class", "ctm-controls sfs-control-grid");
  const controlsPanel = controls.append("section")
    .attr("class", "ctm-panel sfs-control-panel sfs-if-control-panel");
  controlsPanel.append("p")
    .attr("class", "sfs-control-title")
    .text(opts.controlsTitle || "Change the distribution");

  function addControlRow(labelText, ariaLabelText, min, max, initialValue) {
    const row = controlsPanel.append("label")
      .attr("class", "ctm-control-row sfs-control-row");
    row.append("span").text(labelText);
    return row.append("input")
      .attr("type", "range")
      .attr("min", min)
      .attr("max", max)
      .attr("step", 0.005)
      .attr("value", initialValue)
      .attr("aria-label", ariaLabelText)
      .attr("data-prevent-swipe", "");
  }

  const skewSlider = addControlRow(
    "Skew",
    "Distribution skew, from negatively skewed through symmetrical to positively skewed",
    -1, 1, initialSkew
  );
  const bimodalSlider = addControlRow(
    "Bimodality",
    "How far a second peak has separated from the main peak, from none to fully separate",
    0, 1, initialBimodal
  );
  const shapeReadout = controlsPanel.append("p")
    .attr("class", "ctm-shape-readout")
    .attr("aria-live", "polite");

  const chartWrap = root.append("div")
    .attr("class", "ctm-chart-wrap sfs-chart-wrap");
  const svg = chartWrap.append("svg")
    .attr("class", "ctm-svg sfs-svg sfs-graph sfs-graph-distribution")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img");
  const title = svg.append("title");

  const x = d3.scaleLinear()
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .range([height - margin.bottom, margin.top]);
  // Reassigned every render as the domain rescales to fit the current peak.
  let baselineY = height - margin.bottom;
  const curve = sfsDistributionCurveFactory(opts);
  const line = d3.line()
    .defined((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .curve(curve)
    .x((d) => x(d.x))
    .y((d) => y(d.y));
  const area = d3.area()
    .defined((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .curve(curve)
    .x((d) => x(d.x))
    .y0(() => y(0))
    .y1((d) => y(d.y));

  const hatchIdBase = `ctm-hatch-${Math.round(performance.now() * 1000)}-${Math.round(Math.random() * 1e6)}`;
  const defs = svg.append("defs");
  [
    { id: `${hatchIdBase}-lower`, color: lowerColor, rotation: 45 },
    { id: `${hatchIdBase}-upper`, color: upperColor, rotation: -45 }
  ].forEach((patternSpec) => {
    const pattern = defs.append("pattern")
      .attr("id", patternSpec.id)
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", 9)
      .attr("height", 9)
      .attr("patternTransform", `rotate(${patternSpec.rotation})`);
    pattern.append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", -2)
      .attr("y2", 11)
      .attr("stroke", patternSpec.color)
      .attr("stroke-width", 2.4)
      .attr("stroke-opacity", 0.78);
  });

  const areaLayer = svg.append("g").attr("class", "ctm-areas dg-conceptual-areas");
  const baseArea = areaLayer.append("path")
    .attr("class", "ctm-base-area dg-conceptual-fill")
    .attr("fill", opts.conceptualFill || "var(--sfs-neutral-color, #7b818a)")
    .style("fill-opacity", sfsDistributionFiniteNumber(opts.conceptualFillOpacity, 0.16));
  const lowerArea = areaLayer.append("path")
    .attr("class", "ctm-median-half dg-median-half dg-median-lower")
    .attr("fill", `url(#${hatchIdBase}-lower)`);
  const upperArea = areaLayer.append("path")
    .attr("class", "ctm-median-half dg-median-half dg-median-upper")
    .attr("fill", `url(#${hatchIdBase}-upper)`);
  const lowerHalfLabel = areaLayer.append("text")
    .attr("class", "dg-median-half-label sfs-graph-label")
    .attr("text-anchor", "middle")
    .text("50%");
  const upperHalfLabel = areaLayer.append("text")
    .attr("class", "dg-median-half-label sfs-graph-label")
    .attr("text-anchor", "middle")
    .text("50%");

  const curvePath = svg.append("path")
    .attr("class", "ctm-curve dg-curve sfs-graph-line")
    .attr("fill", "none")
    .attr("stroke", opts.color || "var(--graph-series-1, var(--graph-line-color, #0072b2))")
    .attr("stroke-width", sfsDistributionPositiveNumber(opts.strokeWidth, 2.8));
  const baselineLine = svg.append("line")
    .attr("class", "dg-conceptual-baseline")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", baselineY)
    .attr("y2", baselineY);

  const modeLayer = svg.append("g").attr("class", "ctm-modes");
  const medianLayer = svg.append("g").attr("class", "ctm-median");
  const medianLine = medianLayer.append("line")
    .attr("class", "dg-median-divider")
    .attr("stroke", medianColor)
    .attr("stroke-width", 2.5);
  const medianLabel = medianLayer.append("text")
    .attr("class", "dg-conceptual-label dg-median-label sfs-graph-label")
    .text("median");
  const meanLayer = svg.append("g").attr("class", "ctm-mean");
  const meanFulcrum = meanLayer.append("polygon")
    .attr("class", "dg-mean-fulcrum")
    .attr("fill", meanColor);
  const meanLabel = meanLayer.append("text")
    .attr("class", "dg-conceptual-label dg-mean-label sfs-graph-label")
    .attr("text-anchor", "middle")
    .text("mean");
  const stateLabel = svg.append("text")
    .attr("class", "ctm-state-label sfs-graph-label")
    .attr("x", width - margin.right)
    .attr("y", 20)
    .attr("text-anchor", "end");

  function halfLabelPosition(data) {
    const weightTotal = d3.sum(data, (point) => point.y);
    const centroidX = weightTotal > 0
      ? d3.sum(data, (point) => point.x * point.y) / weightTotal
      : (data[0].x + data[data.length - 1].x) / 2;
    const nearest = data.reduce((best, point) =>
      Math.abs(point.x - centroidX) < Math.abs(best.x - centroidX) ? point : best,
    data[0]);
    return {
      x: x(centroidX),
      y: (baselineY + y(nearest.y)) / 2 + 4
    };
  }

  // Quantile-based bounds so the plot stretches to fit the current spread
  // instead of wasting space around a narrow peak or clipping a wide one.
  function computeDomain(distribution) {
    if (explicitDomain) return explicitDomain;
    let lower = sfsDistributionQuantile(distribution, 0.002);
    let upper = sfsDistributionQuantile(distribution, 0.998);
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper <= lower) {
      lower = -4;
      upper = 4;
    }
    const span = upper - lower || 1;
    const pad = span * domainPadding;
    return [lower - pad, upper + pad];
  }

  function ariaDescription(skewValue, bimodalValue, modes, median, mean) {
    const label = sfsCentralTendencyMorphLabel(skewValue, bimodalValue);
    if (modes.length > 1) {
      return `${label}. A mode marks each peak; the median is at ${median.toFixed(2)} and the mean at ${mean.toFixed(2)}.`;
    }
    if (Math.abs(skewValue) < 0.08) {
      return `${label}. The mode, median, and mean coincide at the center.`;
    }
    return `${label}. From left to right, the mode is at ${modes[0].toFixed(2)}, the median at ${median.toFixed(2)}, and the mean at ${mean.toFixed(2)}.`;
  }

  function render(skewValue, bimodalValue, options = {}) {
    const skew = sfsDistributionClamp(sfsDistributionFiniteNumber(skewValue, 0), -1, 1);
    const bimodal = sfsDistributionClamp(sfsDistributionFiniteNumber(bimodalValue, 0), 0, 1);
    const distribution = sfsCentralTendencyMorphSpec(skew, bimodal);
    const domain = computeDomain(distribution);
    x.domain(domain);
    const curveData = sfsDistributionCurveData(distribution, domain, points);
    const yMax = d3.max(curveData, (d) => d.y) || 0.1;
    const yDomain = explicitYDomain || [0, yMax * yHeadroom];
    y.domain(yDomain);
    baselineY = y(0);
    baselineLine.attr("y1", baselineY).attr("y2", baselineY);
    const median = sfsDistributionQuantile(distribution, 0.5);
    const mean = sfsDistributionMeanValue(distribution);
    const modes = sfsDistributionModes(distribution, domain);
    const lowerData = sfsDistributionSegmentData(distribution, domain[0], median, domain, points);
    const upperData = sfsDistributionSegmentData(distribution, median, domain[1], domain, points);
    const lowerPosition = halfLabelPosition(lowerData);
    const upperPosition = halfLabelPosition(upperData);
    const shapeLabel = sfsCentralTendencyMorphLabel(skew, bimodal);
    const comparisonLabel = sfsCentralTendencyMorphComparisonLabel(modes, median, mean, domain);

    baseArea.attr("d", area(curveData));
    lowerArea.attr("d", area(lowerData));
    upperArea.attr("d", area(upperData));
    lowerHalfLabel.attr("x", lowerPosition.x).attr("y", lowerPosition.y);
    upperHalfLabel.attr("x", upperPosition.x).attr("y", upperPosition.y);
    curvePath.attr("d", line(curveData));

    const modeData = modes.map((position, index) => ({
      key: `mode-${index}`,
      x: position,
      y: sfsDistributionFinitePdf(distribution, position)
    }));
    const modeGroups = modeLayer.selectAll("g.ctm-mode-marker")
      .data(modeData, (item) => item.key);
    const modeEnter = modeGroups.enter()
      .append("g")
      .attr("class", "ctm-mode-marker")
      .style("opacity", 0);
    modeEnter.append("line")
      .attr("class", "dg-mode-cap")
      .attr("stroke", modeColor)
      .attr("stroke-width", 3);
    modeEnter.append("text")
      .attr("class", "dg-conceptual-label dg-mode-label sfs-graph-label")
      .attr("text-anchor", "middle")
      .text("mode");
    const modeMerged = modeGroups.merge(modeEnter).style("opacity", 1);
    modeMerged.select("line")
      .attr("x1", (item) => Math.max(margin.left, x(item.x) - 17))
      .attr("x2", (item) => Math.min(width - margin.right, x(item.x) + 17))
      .attr("y1", (item) => y(item.y) - 3)
      .attr("y2", (item) => y(item.y) - 3);
    modeMerged.select("text")
      .attr("x", (item) => x(item.x))
      .attr("y", (item) => y(item.y) - 11);
    modeGroups.exit().remove();

    const medianTopY = Math.min(y(sfsDistributionFinitePdf(distribution, median)), baselineY - 42);
    const medianOnRightHalf = x(median) > (margin.left + width - margin.right) / 2;
    medianLine
      .attr("x1", x(median))
      .attr("x2", x(median))
      .attr("y1", baselineY)
      .attr("y2", medianTopY);
    medianLabel
      .attr("x", x(median) + (medianOnRightHalf ? -6 : 6))
      .attr("y", (baselineY + medianTopY) / 2 + 4)
      .attr("text-anchor", medianOnRightHalf ? "end" : "start");

    const meanX = x(mean);
    const fulcrumWidth = sfsDistributionPositiveNumber(opts.meanFulcrumWidth, 15);
    const fulcrumHeight = sfsDistributionPositiveNumber(opts.meanFulcrumHeight, 14);
    meanFulcrum.attr(
      "points",
      `${meanX},${baselineY + 1} ${meanX + fulcrumWidth},${baselineY + fulcrumHeight} ${meanX - fulcrumWidth},${baselineY + fulcrumHeight}`
    );
    meanLabel
      .attr("x", meanX)
      .attr("y", baselineY + fulcrumHeight + 15);

    stateLabel.text(comparisonLabel);
    shapeReadout.text(comparisonLabel);
    if (options.syncInput !== false) {
      skewSlider.property("value", skew);
      bimodalSlider.property("value", bimodal);
    }

    const description = opts.ariaLabel
      ? `${opts.ariaLabel} ${ariaDescription(skew, bimodal, modes, median, mean)}`
      : ariaDescription(skew, bimodal, modes, median, mean);
    svg.attr("aria-label", description);
    title.text(description);
    rootNode.value = {
      skew,
      bimodal,
      distribution,
      domain: domain.slice(),
      mean,
      median,
      modes: modes.slice(),
      label: shapeLabel,
      comparison: comparisonLabel
    };
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  function stopTween() {
    if (!activeTween) return;
    activeTween.stop();
    activeTween = null;
  }

  function setValues(nextSkew, nextBimodal, options = {}) {
    targetSkew = sfsDistributionClamp(sfsDistributionFiniteNumber(nextSkew, targetSkew), -1, 1);
    targetBimodal = sfsDistributionClamp(sfsDistributionFiniteNumber(nextBimodal, targetBimodal), 0, 1);
    stopTween();
    const animate = options.animate === true && !sfsDistributionPrefersReducedMotion();
    const duration = sfsDistributionPositiveNumber(options.duration, transitionDuration);

    if (!animate || duration <= 0) {
      renderedSkew = targetSkew;
      renderedBimodal = targetBimodal;
      render(renderedSkew, renderedBimodal);
      if (options.notify) notifyValueChange();
      return;
    }

    const startSkew = renderedSkew;
    const startBimodal = renderedBimodal;
    skewSlider.property("value", targetSkew);
    bimodalSlider.property("value", targetBimodal);
    activeTween = d3.timer((elapsed) => {
      const rawProgress = Math.min(1, elapsed / duration);
      const eased = d3.easeCubicInOut(rawProgress);
      renderedSkew = sfsDistributionLerp(startSkew, targetSkew, eased);
      renderedBimodal = sfsDistributionLerp(startBimodal, targetBimodal, eased);
      render(renderedSkew, renderedBimodal, { syncInput: false });

      if (rawProgress >= 1) {
        stopTween();
        renderedSkew = targetSkew;
        renderedBimodal = targetBimodal;
        render(renderedSkew, renderedBimodal);
        if (options.notify) notifyValueChange();
      }
    });
  }

  skewSlider.on("input", (event) => {
    event.stopPropagation();
    setValues(event.currentTarget.value, targetBimodal, { animate: false, notify: true });
  });

  bimodalSlider.on("input", (event) => {
    event.stopPropagation();
    setValues(targetSkew, event.currentTarget.value, { animate: false, notify: true });
  });

  function applyTutorialAction(action, context) {
    if (!action) return;
    const animate = action.animate === undefined ? true : sfsDistributionBoolean(action.animate, true);
    const controlsOpen = sfsDistributionValueOr(
      action["controls-open"],
      sfsDistributionValueOr(action.controls, action["show-controls"])
    );
    if (controlsOpen !== undefined && context && typeof context.setControlsOpen === "function") {
      context.setControlsOpen(sfsDistributionBoolean(controlsOpen, true), animate);
    }
    const hasSkew = action.skew !== undefined;
    const hasBimodal = action.bimodal !== undefined;
    if (hasSkew || hasBimodal) {
      setValues(
        hasSkew ? action.skew : targetSkew,
        hasBimodal ? action.bimodal : targetBimodal,
        { animate, duration: action.duration, notify: true }
      );
    }
  }

  // The SVG's viewBox tracks the chart wrap's actual rendered width (instead
  // of staying fixed at preferredWidth while CSS scales the box down), so
  // text set in CSS px/rem keeps rendering at its real size as the figure
  // narrows on small screens rather than shrinking with the geometry.
  function applyResponsiveLayout(layout) {
    width = Math.max(240, Math.min(
      preferredWidth,
      sfsDistributionPositiveNumber(layout && layout.width, preferredWidth)
    ));
    x.range([margin.left, width - margin.right]);
    svg.attr("viewBox", [0, 0, width, height]);
    baselineLine.attr("x1", margin.left).attr("x2", width - margin.right);
    stateLabel.attr("x", width - margin.right);
    render(renderedSkew, renderedBimodal, { syncInput: false });
  }

  render(renderedSkew, renderedBimodal);

  if (window.interactiveFigure) {
    window.interactiveFigure.wrap({
      root: rootNode,
      controls: controls.node(),
      label: opts.controlsLabel || "distribution shape controls",
      placement: opts.controlsPlacement || "callout",
      layout: opts.controlsLayout || "equal",
      applyAction: applyTutorialAction,
      startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
    });
    if (typeof window.interactiveFigure.observeResponsiveLayout === "function") {
      window.interactiveFigure.observeResponsiveLayout({
        root: rootNode,
        container: chartWrap.node(),
        minimumWidth: 240,
        maximumWidth: preferredWidth,
        widthStep: 4,
        onLayout: applyResponsiveLayout
      });
    }
  }

  return rootNode;
}


sfsDistributionParameterKey = (value) => {
  const key = sfsDistributionNormalizeKey(value);
  if (["df", "degrees-of-freedom", "degreesoffreedom", "nu"].includes(key)) return "df";
  if (["df1", "df-1", "numerator-df", "numeratordf", "between-df", "between-groups-df"].includes(key)) return "df1";
  if (["df2", "df-2", "denominator-df", "denominatordf", "within-df", "within-groups-df", "error-df"].includes(key)) return "df2";
  if (["mean", "mu", "center"].includes(key)) return "mean";
  if (["sd", "sigma", "standard-deviation", "standarddeviation"].includes(key)) return "sd";
  if (["scale"].includes(key)) return "scale";
  if (["location", "shift"].includes(key)) return "location";
  return key;
}

sfsDistributionDefaultParameterValue = (key, type) => {
  if (key === "df") return 1;
  if (key === "df1") return 3;
  if (key === "df2") return 20;
  if (key === "sd" || key === "scale") return 1;
  if (key === "mean" || key === "location") return 0;
  return type === "f" ? 5 : 1;
}

sfsDistributionDefaultParameterBounds = (key, type) => {
  if (key === "df") return { min: 1, max: 30, step: 1 };
  if (key === "df1" || key === "df2") return { min: 1, max: 30, step: 1 };
  if (key === "sd" || key === "scale") return { min: 0.1, max: 5, step: 0.1 };
  if (key === "mean" || key === "location") return { min: -5, max: 5, step: 0.1 };
  return { min: type === "f" ? 1 : 0, max: 30, step: 1 };
}

sfsDistributionParameterLabel = (key) => {
  if (key === "df") return "<i>df</i> =";
  if (key === "df1") return "<i>df</i><sub>1</sub> =";
  if (key === "df2") return "<i>df</i><sub>2</sub> =";
  if (key === "mean") return "<i>&mu;</i> =";
  if (key === "sd") return "<i>&sigma;</i> =";
  if (key === "scale") return "Scale =";
  if (key === "location") return "Location =";
  return `${key} =`;
}

sfsDistributionParameterSpec = (source = {}, opts = {}, dist = {}) => {
  const key = sfsDistributionParameterKey(source.key || source.parameter || source.name || source.id);
  const type = dist.type || sfsDistributionNormalizeType(opts.distribution || opts.type);
  const bounds = sfsDistributionDefaultParameterBounds(key, type);
  const min = sfsDistributionFiniteNumber(source.min, bounds.min);
  const max = Math.max(min, sfsDistributionFiniteNumber(source.max, bounds.max));
  const step = sfsDistributionPositiveNumber(source.step, bounds.step);
  const rawValue = sfsDistributionValueOr(
    source.value,
    sfsDistributionValueOr(opts[key], sfsDistributionValueOr(dist[key], sfsDistributionDefaultParameterValue(key, type)))
  );
  const value = sfsDistributionClamp(sfsDistributionFiniteNumber(rawValue, sfsDistributionDefaultParameterValue(key, type)), min, max);

  return {
    key,
    label: source.label || source.labelHtml || sfsDistributionParameterLabel(key),
    min,
    max,
    step,
    value,
    format: source.format || opts.parameterFormat,
    source
  };
}

sfsDistributionParameterSpecs = (opts = {}, dist = {}) => {
  const raw = opts.parameters || opts.parameterControls || opts.sliders;
  const type = dist.type || sfsDistributionNormalizeType(opts.distribution || opts.type || "t");
  const defaults = type === "f"
    ? [{ key: "df1" }, { key: "df2" }]
    : type === "t"
      ? [{ key: "df" }]
      : [];

  return sfsDistributionAsArray(raw || defaults)
    .map((source) => typeof source === "string" ? { key: source } : source)
    .map((source) => sfsDistributionParameterSpec(source, opts, dist))
    .filter((spec) => spec.key);
}

sfsDistributionExplorerParameterFormat = (parameter, opts = {}) => {
  if (typeof parameter.format === "function") return parameter.format;
  if (typeof opts.formatParameter === "function") return (value) => opts.formatParameter(value, parameter);
  if (typeof opts.parameterFormat === "function") return opts.parameterFormat;
  if (typeof parameter.format === "string") return d3.format(parameter.format);
  if (typeof opts.parameterFormat === "string") return d3.format(opts.parameterFormat);
  if (parameter.step >= 1) return d3.format("~g");
  return d3.format(".2~f");
}

sfsDistributionExplorerLabel = (dist, opts = {}) => {
  if (typeof opts.distributionLabel === "function") return opts.distributionLabel(dist);
  if (dist.type === "t") return `t(df = ${d3.format(".2~f")(dist.df)})`;
  if (dist.type === "f") return `F(${d3.format(".2~f")(dist.df1)}, ${d3.format(".2~f")(dist.df2)})`;
  return sfsDistributionDistributionLabel(dist);
}

sfsDistributionExplorerReferenceSpecs = (opts = {}, type = "t") => {
  const explicit = opts.references || opts.referenceDistributions;
  if (explicit) return sfsDistributionAsArray(explicit);
  if (opts.reference === false || opts.showReference === false) return [];

  if (type === "t" || opts.reference === true || opts.showNormalReference) {
    const reference = typeof opts.reference === "object" ? opts.reference : {};
    return [Object.assign({
      type: "normal",
      key: "normal-reference",
      name: "Normal",
      color: "var(--sfs-neutral-color, #7b818a)",
      stroke: "var(--sfs-neutral-color, #7b818a)",
      strokeWidth: 2,
      strokeDasharray: "7 5",
      opacity: 0.95
    }, reference)];
  }

  return [];
}

sfsDistributionExplorerDomain = (type, opts = {}) => {
  const explicit = opts.xDomain || opts.domain;
  if (explicit && explicit.length >= 2) return explicit.map(Number);
  if (type === "t" || type === "normal") return [-5, 5];
  if (type === "f") return [0, 6];
  return null;
}

sfsDistributionExplorerYDomain = (type, opts = {}) => {
  if (opts.yDomain) return opts.yDomain.slice();
  if (type === "t" || type === "normal") return [0, 0.45];
  return null;
}

makeDistributionParameterExplorer = function(opts = {}) {
  sfsDistributionEnsureStyles();

  const controlledSource = Object.assign({}, opts.distributionSpec || opts.controlledDistribution || {});
  const type = sfsDistributionNormalizeType(
    controlledSource.distribution || controlledSource.type || opts.distribution || opts.type || "t"
  );
  const controlledKey = controlledSource.key || controlledSource.id || "controlled-distribution";
  const controlledName = controlledSource.name || controlledSource.label || "";
  const controlledBase = Object.assign({}, controlledSource, {
    type,
    distribution: type,
    key: controlledKey,
    name: controlledName,
    color: controlledSource.color || controlledSource.stroke || opts.color || "var(--graph-series-1, var(--graph-line-color, #0072b2))",
    stroke: controlledSource.stroke || controlledSource.color || opts.stroke || opts.color || "var(--graph-series-1, var(--graph-line-color, #0072b2))",
    strokeWidth: sfsDistributionPositiveNumber(controlledSource.strokeWidth, sfsDistributionPositiveNumber(opts.strokeWidth, 2.8))
  });
  const baseDist = sfsDistributionSpec(controlledBase, opts, 0);
  const parameters = sfsDistributionParameterSpecs(opts, baseDist);
  const parameterByKey = new Map(parameters.map((parameter) => [parameter.key, parameter]));
  const state = {};
  const renderedState = {};
  parameters.forEach((parameter) => {
    state[parameter.key] = parameter.value;
    renderedState[parameter.key] = parameter.value;
  });

  let width = sfsDistributionPositiveNumber(opts.width, 640);
  const aspectRatio = sfsDistributionPositiveNumber(opts.aspectRatio, 2.2);
  let height = sfsDistributionPositiveNumber(opts.height, width / aspectRatio);
  const display = sfsDistributionDisplay(opts);
  const margin = sfsDistributionMargin(opts, display);
  const points = Math.max(80, Math.round(sfsDistributionPositiveNumber(opts.points, 360)));
  const transitionDuration = sfsDistributionPositiveNumber(sfsDistributionValueOr(opts.transitionDuration, opts.duration), 650);
  const curve = sfsDistributionCurveFactory(opts);
  const valueFormats = new Map(parameters.map((parameter) => [parameter.key, sfsDistributionExplorerParameterFormat(parameter, opts)]));
  let activeTween = null;
  let lastRender = null;

  const root = d3.create("div")
    .attr("class", "distribution-explorer sfs-figure")
    .style("--dpe-max-width", opts.maxWidth || null)
    .style("--sfs-figure-margin", opts.cssMargin || opts.marginCss || null);
  const rootNode = root.node();

  const controls = root.append("div")
    .attr("class", "dpe-controls sfs-control-grid");

  const controlsPanel = controls.append("section")
    .attr("class", "dpe-panel sfs-control-panel sfs-if-control-panel");
  controlsPanel.append("p")
    .attr("class", "sfs-control-title")
    .text(opts.controlsTitle || "Distribution");

  const controlsByKey = new Map();

  function addSlider(parameter) {
    const row = controlsPanel.append("label")
      .attr("class", "dpe-control-row sfs-control-row");
    row.append("span").html(parameter.label);
    const valueNode = row.append("span")
      .attr("class", "dpe-value sfs-readout-value");
    const input = row.append("input")
      .attr("type", "range")
      .attr("min", parameter.min)
      .attr("max", parameter.max)
      .attr("step", parameter.step)
      .attr("value", parameter.value)
      .attr("data-prevent-swipe", "");
    controlsByKey.set(parameter.key, { input: input.node(), value: valueNode, parameter });
  }

  parameters.forEach(addSlider);

  const intervalReadout = opts.confidenceInterval
    ? root.append("p").attr("class", "dpe-interval-readout sfs-readout-value") : null;
  const chartWrap = root.append("div")
    .attr("class", "dpe-chart-wrap sfs-chart-wrap");

  const svg = chartWrap.append("svg")
    .attr("class", "dpe-svg sfs-svg sfs-graph sfs-graph-distribution")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", opts.ariaLabel || "Interactive distribution comparison");
  svg.append("title").text(opts.ariaLabel || "Interactive distribution comparison");

  const x = d3.scaleLinear().range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().range([height - margin.bottom, margin.top]);
  const line = d3.line()
    .defined((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .curve(curve)
    .x((d) => x(d.x))
    .y((d) => y(d.y));
  const area = d3.area()
    .defined((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
    .curve(curve)
    .x((d) => x(d.x))
    .y0(y(0))
    .y1((d) => y(d.y));

  const gridLayer = svg.append("g")
    .attr("class", "dpe-grid sfs-graph-grid");
  const shadeLayer = svg.append("g")
    .attr("class", "dpe-shades");
  const curveLayer = svg.append("g")
    .attr("class", "dpe-curves");
  const xAxisLayer = svg.append("g")
    .attr("class", "dpe-x-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`);
  const yAxisLayer = svg.append("g")
    .attr("class", "dpe-y-axis")
    .attr("transform", `translate(${margin.left},0)`);
  const labelLayer = svg.append("g")
    .attr("class", "dpe-label-layer");
  const legendLayer = svg.append("g")
    .attr("class", "dpe-legend sfs-graph-legend")
    .attr("transform", `translate(${width - margin.right - 130},${margin.top})`);

  sfsDistributionAddLabels(labelLayer, opts, display, margin, width, height);
  const intervalLayer = opts.confidenceInterval
    ? svg.append("g").attr("class", "dpe-confidence-interval") : null;
  if (intervalLayer) {
    intervalLayer.append("path").attr("class", "dpe-interval-bracket")
      .attr("fill", "none").style("stroke", "var(--sfs-confidence-color)")
      .attr("stroke-width", 2).attr("vector-effect", "non-scaling-stroke");
    intervalLayer.append("line").attr("class", "dpe-estimate")
      .style("stroke", "var(--sfs-confidence-color)").attr("stroke-dasharray", "4 4");
    intervalLayer.selectAll("text").data(["lower", "upper"]).join("text")
      .attr("class", "sfs-graph-label").attr("text-anchor", "middle");
  }

  function parameterState(source = state) {
    const next = {};
    parameters.forEach((parameter) => {
      next[parameter.key] = source[parameter.key];
    });
    return next;
  }

  function sameDomain(a, b) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
      a.every((value, index) => value === b[index]);
  }

  function distributionSourceFor(source = state) {
    const next = Object.assign({}, controlledBase);
    parameters.forEach((parameter) => {
      next[parameter.key] = source[parameter.key];
    });
    if (opts.confidenceInterval) next.sd = source["population-sd"] / Math.sqrt(source.n);
    return next;
  }

  function buildDistributions(source = state) {
    const references = sfsDistributionExplorerReferenceSpecs(opts, type)
      .map((reference, index) => {
        const dist = sfsDistributionSpec(reference, opts, index);
        dist.role = "reference";
        dist.label = dist.name || sfsDistributionDistributionLabel(dist);
        return dist;
      });

    const controlled = sfsDistributionSpec(distributionSourceFor(source), opts, references.length);
    controlled.role = "controlled";
    controlled.name = controlledBase.name || sfsDistributionExplorerLabel(controlled, opts);
    controlled.label = controlled.name;

    return references.concat(controlled);
  }

  function plotData(source = state) {
    const distributions = buildDistributions(source);
    const explicitDomain = sfsDistributionExplorerDomain(type, opts);
    const domain = explicitDomain || sfsDistributionResolveDomain(distributions, opts);
    const curveData = distributions.map((dist) => ({
      distribution: dist,
      data: sfsDistributionCurveData(dist, domain, points)
    }));
    const shadeOptions = opts.confidenceInterval ? Object.assign({}, opts, {
      shade: { tail: "center", p: source.confidence / 100,
        color: "var(--sfs-confidence-color, #2f6f9f)", opacity: 0.3 }
    }) : opts;
    const shadeItems = sfsDistributionShadeItems(shadeOptions, distributions, domain);
    const explicitY = sfsDistributionExplorerYDomain(type, opts);
    const yMax = d3.max(curveData, (series) => d3.max(series.data, (d) => d.y)) || 1;
    const yDomain = explicitY || [0, yMax * 1.12];

    return {
      distributions,
      domain,
      curveData,
      shadeItems,
      yDomain
    };
  }

  function setValue(plot, source = state) {
    const controlled = plot.distributions.find((dist) => dist.role === "controlled") || plot.distributions[plot.distributions.length - 1];
    const interval = opts.confidenceInterval ? plot.shadeItems[0] : null;
    rootNode.value = Object.assign({}, source, interval ? {
      lower: interval.from, upper: interval.to,
      intervalWidth: interval.to - interval.from, standardError: controlled.sd
    } : {}, {
      distribution: controlled.type,
      distributions: plot.distributions,
      controlledDistribution: controlled,
      domain: plot.domain.slice(),
      yDomain: plot.yDomain.slice()
    });
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  function readState() {
    parameters.forEach((parameter) => {
      const control = controlsByKey.get(parameter.key);
      if (!control) return;
      state[parameter.key] = sfsDistributionClamp(
        sfsDistributionFiniteNumber(control.input.value, state[parameter.key]),
        parameter.min,
        parameter.max
      );
    });
  }

  function syncInputValues() {
    parameters.forEach((parameter) => {
      const control = controlsByKey.get(parameter.key);
      if (!control) return;
      control.input.value = String(state[parameter.key]);
    });
  }

  function syncControls(source = state, options = {}) {
    if (options.syncInputs !== false) syncInputValues();
    parameters.forEach((parameter) => {
      const control = controlsByKey.get(parameter.key);
      if (!control) return;
      const format = valueFormats.get(parameter.key);
      control.value.text(format(source[parameter.key]));
    });
  }

  function drawAxes(plot) {
    if (opts.grid) {
      gridLayer
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y)
          .ticks(sfsDistributionValueOr(opts.yTicks, 5))
          .tickSize(-(width - margin.left - margin.right))
          .tickFormat(""))
        .call((g) => g.select(".domain").remove());
    } else {
      gridLayer.selectAll("*").remove();
    }

    xAxisLayer.style("display", display.showXAxis ? null : "none");
    if (display.showXAxis) {
      xAxisLayer
        .call(d3.axisBottom(x)
          .ticks(sfsDistributionValueOr(opts.xTicks, 7))
          .tickFormat(opts.xTickFormat || opts.tickFormat || d3.format("~g")));
      sfsDistributionStyleAxis(xAxisLayer, display);
    }

    yAxisLayer.style("display", display.showYAxis ? null : "none");
    if (display.showYAxis) {
      yAxisLayer
        .call(d3.axisLeft(y)
          .ticks(sfsDistributionValueOr(opts.yTicks, 5))
          .tickFormat(opts.yTickFormat || opts.yFormat || d3.format("~g")));
      sfsDistributionStyleAxis(yAxisLayer, display);
    }
  }

  function drawLegend(distributions) {
    if (distributions.length < 2 || opts.legend === false) {
      legendLayer.selectAll("*").remove();
      return;
    }

    const items = legendLayer.selectAll("g")
      .data(distributions, (d) => d.key);

    const itemsEnter = items.enter()
      .append("g");

    itemsEnter.append("line")
      .attr("x1", 0)
      .attr("x2", 18)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke-width", 2);

    itemsEnter.append("text")
      .attr("x", 24)
      .attr("y", 4);

    items.merge(itemsEnter)
      .attr("transform", (d, i) => `translate(0,${i * 20})`)
      .call((item) => {
        item.select("line")
          .attr("stroke", (d) => d.stroke)
          .attr("stroke-dasharray", (d) => d.strokeDasharray);
        item.select("text")
          .text((d) => d.name || d.label);
      });

    items.exit().remove();
  }

  function renderPlot(source = renderedState, options = {}) {
    const plot = plotData(source);
    const xDomainChanged = !lastRender || !sameDomain(lastRender.domain, plot.domain);
    const yDomainChanged = !lastRender || !sameDomain(lastRender.yDomain, plot.yDomain);
    const axisChanged = xDomainChanged || yDomainChanged || !lastRender;
    const animate = options.animate === true && !sfsDistributionPrefersReducedMotion();
    const duration = sfsDistributionPositiveNumber(options.duration, transitionDuration);

    x.domain(plot.domain);
    y.domain(plot.yDomain).nice();

    if (axisChanged || !lastRender) drawAxes(plot);

    const shadePaths = shadeLayer.selectAll("path")
      .data(plot.shadeItems, (d, index) => `${d.kind}-${d.distribution ? d.distribution.key : "overlap"}-${index}`);

    shadePaths.enter()
      .append("path")
      .attr("class", (d) => `dg-shade sfs-graph-area ${d.kind === "overlap" ? "dg-overlap" : "dg-area"}`)
      .attr("fill", (d) => d.color)
      .style("fill-opacity", (d) => d.opacity)
      .merge(shadePaths)
      .attr("d", (d) => area(d.data));
    shadePaths.exit().remove();

    const paths = curveLayer.selectAll("path")
      .data(plot.curveData, (d) => d.distribution.key);

    const pathsEnter = paths.enter()
      .append("path")
      .attr("class", (d) => `dpe-curve dg-curve sfs-graph-line ${d.distribution.role === "reference" ? "dpe-reference-curve" : "dpe-controlled-curve"}`)
      .attr("fill", "none")
      .style("stroke", (d) => d.distribution.stroke)
      .attr("stroke-width", (d) => d.distribution.strokeWidth)
      .attr("stroke-opacity", (d) => d.distribution.opacity)
      .attr("stroke-dasharray", (d) => d.distribution.strokeDasharray)
      .attr("d", (d) => line(d.data));

    const pathsMerged = paths.merge(pathsEnter)
      .attr("class", (d) => `dpe-curve dg-curve sfs-graph-line ${d.distribution.role === "reference" ? "dpe-reference-curve" : "dpe-controlled-curve"}`)
      .style("stroke", (d) => d.distribution.stroke)
      .attr("stroke-width", (d) => d.distribution.strokeWidth)
      .attr("stroke-opacity", (d) => d.distribution.opacity)
      .attr("stroke-dasharray", (d) => d.distribution.strokeDasharray);

    if (animate) {
      pathsMerged
        .transition()
        .duration(duration)
        .ease(d3.easeCubicOut)
        .attr("d", (d) => line(d.data));
    } else {
      pathsMerged.attr("d", (d) => line(d.data));
    }

    paths.exit().remove();

    if (intervalLayer) {
      const { from, to } = plot.shadeItems[0];
      const dist = plot.distributions[0];
      const baseline = y(0), bracketY = baseline + 34;
      intervalLayer.select(".dpe-interval-bracket").attr("d",
        `M${x(from)},${bracketY - 5}V${bracketY + 5}M${x(from)},${bracketY}H${x(to)}M${x(to)},${bracketY - 5}V${bracketY + 5}`);
      intervalLayer.select(".dpe-estimate")
        .attr("x1", x(dist.mean)).attr("x2", x(dist.mean))
        .attr("y1", baseline).attr("y2", y(sfsDistributionPdf(dist, dist.mean)));
      intervalLayer.selectAll("text")
        .attr("x", (d, i) => x(i ? to : from)).attr("y", bracketY + 24)
        .text((d, i) => d3.format(".1f")(i ? to : from));
      const summary = `${d3.format(".0f")(source.confidence)}% confidence · n = ${d3.format(".0f")(source.n)} · σ = ${d3.format(".0f")(source["population-sd"])} ms`;
      intervalReadout.text(summary);
      const description = `${summary}. Mean ${dist.mean.toFixed(2)} ms; standard error ${dist.sd.toFixed(2)} ms. Confidence interval ${from.toFixed(1)} to ${to.toFixed(1)} ms, width ${(to - from).toFixed(1)} ms.`;
      svg.attr("aria-label", description).select("title").text(description);
    }
    drawLegend(plot.distributions);
    setValue(plot, source);
    syncControls(source, { syncInputs: options.syncInputs !== false });
    lastRender = {
      domain: plot.domain.slice(),
      yDomain: plot.yDomain.slice()
    };
    return plot;
  }

  function stopTween() {
    if (!activeTween) return;
    activeTween.stop();
    activeTween = null;
  }

  function tweenToTarget(target, notify, options = {}) {
    stopTween();
    const duration = sfsDistributionPositiveNumber(options.duration, transitionDuration);
    const start = parameterState(renderedState);
    const end = parameterState(target);

    if (duration <= 0 || sfsDistributionPrefersReducedMotion()) {
      parameters.forEach((parameter) => {
        renderedState[parameter.key] = end[parameter.key];
      });
      renderPlot(renderedState);
      if (notify) notifyValueChange();
      return;
    }

    activeTween = d3.timer((elapsed) => {
      const rawT = sfsDistributionPrefersReducedMotion() ? 1 : Math.min(1, elapsed / duration);
      const eased = d3.easeCubicOut(rawT);
      parameters.forEach((parameter) => {
        const key = parameter.key;
        renderedState[key] = start[key] + (end[key] - start[key]) * eased;
      });
      renderPlot(renderedState, { syncInputs: false });

      if (rawT >= 1) {
        stopTween();
        parameters.forEach((parameter) => {
          renderedState[parameter.key] = end[parameter.key];
        });
        renderPlot(renderedState);
        if (notify) notifyValueChange();
      }
    });
  }

  function update(notify, options = {}) {
    stopTween();
    readState();
    const target = parameterState(state);
    const animate = options.animate === true && !sfsDistributionPrefersReducedMotion();

    if (animate) {
      syncInputValues();
      tweenToTarget(target, notify, options);
      return;
    }

    parameters.forEach((parameter) => {
      renderedState[parameter.key] = target[parameter.key];
    });
    renderPlot(renderedState);
    if (notify) notifyValueChange();
  }

  function setParameterValue(key, value) {
    const parameterKey = sfsDistributionParameterKey(key);
    const control = controlsByKey.get(parameterKey);
    const parameter = parameterByKey.get(parameterKey);
    if (!control || !parameter) return false;
    const number = sfsDistributionFiniteNumber(value, NaN);
    if (!Number.isFinite(number)) return false;
    const next = sfsDistributionClamp(number, parameter.min, parameter.max);
    control.input.value = String(next);
    return true;
  }

  function applyActionEntries(action) {
    let changed = false;
    Object.entries(action || {}).forEach(([key, value]) => {
      const actionKey = sfsDistributionNormalizeKey(key);
      if (["animate", "duration", "controls", "controls-open", "show-controls"].includes(actionKey)) return;
      if (actionKey === "parameters" && value && typeof value === "object") {
        changed = applyActionEntries(value) || changed;
        return;
      }
      if (actionKey === "n" && controlsByKey.has("df") && !controlsByKey.has("n")) {
        changed = setParameterValue("df", sfsDistributionFiniteNumber(value, NaN) - 1) || changed;
        return;
      }
      changed = setParameterValue(key, value) || changed;
    });
    return changed;
  }

  function applyTutorialAction(action, context) {
    if (!action) return;
    const animate = action.animate === undefined ? true : sfsDistributionBoolean(action.animate, true);
    const duration = action.duration;

    if (context && typeof context.setControlsOpen === "function") {
      const controlsOpen = sfsDistributionValueOr(action["controls-open"], sfsDistributionValueOr(action.controls, action["show-controls"]));
      if (controlsOpen !== undefined) context.setControlsOpen(sfsDistributionBoolean(controlsOpen, true), animate);
    }

    if (applyActionEntries(action)) update(true, { animate, duration });
  }

  controlsByKey.forEach((control) => {
    control.input.addEventListener("input", (event) => {
      event.stopPropagation();
      update(true, { animate: false });
    });
  });

  renderPlot(renderedState);

  if (window.interactiveFigure) {
    window.interactiveFigure.wrap({
      root: rootNode,
      controls: controls.node(),
      label: opts.controlsLabel || "distribution controls",
      placement: opts.controlsPlacement || "callout",
      layout: opts.controlsLayout || "equal",
      applyAction: applyTutorialAction,
      startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
    });
  }

  if (window.interactiveFigure) {
    window.interactiveFigure.adopt(rootNode, {
      cancelMotion() {
        stopTween(); Object.assign(renderedState, state); renderPlot(renderedState);
      },
      dispose: stopTween
    });
    if (opts.confidenceInterval) window.interactiveFigure.observeResponsiveLayout({
      root: rootNode, container: chartWrap.node(), minimumWidth: 280, maximumWidth: 1000,
      onLayout(layout) {
        width = layout.width;
        height = Math.max(300, Math.min(360, width * 0.55));
        svg.attr("viewBox", [0, 0, width, height]);
        x.range([margin.left, width - margin.right]);
        y.range([height - margin.bottom, margin.top]);
        area.y0(y(0));
        xAxisLayer.attr("transform", `translate(0,${height - margin.bottom})`);
        labelLayer.selectAll("*").remove();
        sfsDistributionAddLabels(labelLayer, opts, display, margin, width, height);
        lastRender = null;
        renderPlot(renderedState);
      }
    });
  }
  return rootNode;
}

// A preset of the parameter explorer: the same density/shading geometry,
// parameter interpolation, controls, and tutorial navigation as the t explorer.
makeConfidenceWidthExplorer = (opts = {}) => makeDistributionParameterExplorer(Object.assign({
  confidenceInterval: true, distribution: "normal", mean: 322.59,
  reference: false, legend: false, style: "minimal", xAxis: true, axisLabels: true, yLabel: false,
  xDomain: [280, 365], yDomain: [0, 0.09], xTicks: 5,
  xLabel: "Reaction time (ms)", color: "var(--sfs-confidence-color, #2f6f9f)",
  width: 680, height: 360, margin: { top: 16, right: 18, bottom: 104, left: 18 },
  transitionDuration: 1000, controlsTitle: "Confidence interval",
  controlsLabel: "confidence interval controls",
  parameters: [
    { key: "confidence", label: "Confidence (%)", min: 80, max: 99, step: 1, value: 95 },
    { key: "n", label: "Sample size", min: 23, max: 100, step: 1, value: 23 },
    { key: "population-sd", label: "Population SD (ms)", min: 25, max: 50, step: 1, value: 50 }
  ]
}, opts));

makeDistributionExplorer = makeDistributionParameterExplorer

makeTDistributionDfExplorer = (opts = {}) => {
  const initialDf = sfsDistributionValueOr(opts.df, 1);
  return makeDistributionParameterExplorer(Object.assign({
    distribution: "t",
    reference: true,
    xLabel: "z or t score",
    yLabel: "Density",
    xDomain: [-5, 5],
    yDomain: [0, 0.45],
    xTicks: 5,
    yTicks: 4,
    parameters: [{ key: "df", min: 1, max: 30, step: 1, value: initialDf }],
    controlsTitle: "t distribution",
    controlsLabel: "t distribution controls",
    ariaLabel: "Interactive graph comparing the normal distribution with a t distribution controlled by degrees of freedom"
  }, opts));
}

makeTDistributionExplorer = makeTDistributionDfExplorer

makeFDistributionDfExplorer = (opts = {}) => {
  const initialDf1 = sfsDistributionValueOr(opts.df1, 3);
  const initialDf2 = sfsDistributionValueOr(opts.df2, 20);
  return makeDistributionParameterExplorer(Object.assign({
    distribution: "f",
    title: "How F changes with degrees of freedom",
    xLabel: "F value",
    yLabel: "Density",
    xDomain: [0, 6],
    xTicks: 7,
    yTicks: 4,
    parameters: [
      { key: "df1", min: 1, max: 30, step: 1, value: initialDf1 },
      { key: "df2", min: 1, max: 60, step: 1, value: initialDf2 }
    ],
    controlsTitle: "F distribution",
    controlsLabel: "F distribution controls",
    ariaLabel: "Interactive graph of an F distribution controlled by numerator and denominator degrees of freedom"
  }, opts));
}

makeFDistributionExplorer = makeFDistributionDfExplorer

makeDistributionCurve = makeDistributionGraph
