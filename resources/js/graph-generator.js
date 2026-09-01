bcGraphNormalPdf = (x, mean = 0, sd = 1) => {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

bcGraphDefaultColors = [
  "var(--graph-series-1, var(--graph-line-color, #0072b2))",
  "var(--graph-series-2, #e69f00)",
  "var(--graph-series-3, #009e73)",
  "var(--graph-series-4, #d55e00)",
  "var(--graph-series-5, #cc79a7)",
  "var(--graph-series-6, #56b4e9)",
  "var(--graph-series-7, #f0e442)"
]

bcGraphMedalFills = ({
  Gold: "var(--graph-medal-gold, #d4af37)",
  Silver: "var(--graph-medal-silver, #b8bcc2)",
  Bronze: "var(--graph-medal-bronze, #b08d57)"
})

bcGraphValueOr = (value, fallback) =>
  value === undefined || value === null ? fallback : value

bcGraphFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

bcGraphPositiveNumber = (value) => {
  const number = bcGraphFiniteNumber(value);
  return number > 0 ? number : undefined;
}

bcGraphParseAspectRatio = (raw) => {
  if (raw === false || raw === "auto") return undefined;

  if (Array.isArray(raw) && raw.length >= 2) {
    const width = bcGraphPositiveNumber(raw[0]);
    const height = bcGraphPositiveNumber(raw[1]);
    return width && height ? width / height : undefined;
  }

  if (typeof raw === "string") {
    const parts = raw.trim().split(/[:/]/).map((part) => bcGraphPositiveNumber(part));
    if (parts.length >= 2 && parts[0] && parts[1]) return parts[0] / parts[1];
  }

  return bcGraphPositiveNumber(raw);
}

bcGraphResolveScaleAspectRatio = (opts = {}, type = "histogram") => {
  const hasAspectRatio = opts.scaleRatio !== undefined ||
    opts.scaleAspectRatio !== undefined ||
    opts.coordinateAspectRatio !== undefined ||
    opts.coordRatio !== undefined ||
    opts.equalScales !== undefined;

  if (opts.equalScales === true) return 1;
  if (opts.equalScales === false) return undefined;
  if (!hasAspectRatio) return type === "block" ? 1 : undefined;

  const raw = bcGraphValueOr(
    opts.scaleRatio,
    bcGraphValueOr(opts.scaleAspectRatio, bcGraphValueOr(opts.coordinateAspectRatio, opts.coordRatio))
  );
  return bcGraphParseAspectRatio(raw);
}

bcGraphResolveSvgAspectRatio = (opts = {}) => {
  const raw = bcGraphValueOr(
    opts.aspectRatio,
    bcGraphValueOr(opts.svgAspectRatio, bcGraphValueOr(opts.imageAspectRatio, opts.figureAspectRatio))
  );
  return bcGraphParseAspectRatio(raw);
}

bcGraphDimensions = (opts = {}, type = "histogram") => {
  const widthValue = bcGraphPositiveNumber(opts.width);
  const heightValue = bcGraphPositiveNumber(opts.height);
  const aspectRatio = bcGraphResolveSvgAspectRatio(opts);
  const hasWidth = widthValue !== undefined;
  const hasHeight = heightValue !== undefined;
  const width = widthValue || 640;
  const height = heightValue || 420;

  if (!aspectRatio || (hasWidth && hasHeight)) return { width, height, aspectRatio };
  if (hasHeight && !hasWidth) return { width: height * aspectRatio, height, aspectRatio };
  return { width, height: width / aspectRatio, aspectRatio };
}

bcGraphDomainSpan = (domain) => {
  const start = domain ? Number(domain[0]) : NaN;
  const end = domain ? Number(domain[1]) : NaN;
  const span = Math.abs(end - start);
  return Number.isFinite(span) && span > 0 ? span : undefined;
}

bcGraphDimensionsForLinearScales = (opts = {}, type = "histogram", xDomain, yDomain, margin) => {
  const dimensions = bcGraphDimensions(opts, type);
  const aspectRatio = bcGraphResolveScaleAspectRatio(opts, type);
  const xSpan = bcGraphDomainSpan(xDomain);
  const ySpan = bcGraphDomainSpan(yDomain);
  const widthValue = bcGraphPositiveNumber(opts.width);
  const heightValue = bcGraphPositiveNumber(opts.height);
  const hasWidth = widthValue !== undefined;
  const hasHeight = heightValue !== undefined;

  if (!aspectRatio || !xSpan || !ySpan || (hasWidth && hasHeight)) {
    return Object.assign({}, dimensions, { scaleAspectRatio: aspectRatio });
  }

  const innerWidth = Math.max(1, dimensions.width - margin.left - margin.right);
  const innerHeight = Math.max(1, dimensions.height - margin.top - margin.bottom);

  if (hasHeight && !hasWidth) {
    return Object.assign({}, dimensions, {
      width: innerHeight * xSpan / (aspectRatio * ySpan) + margin.left + margin.right,
      scaleAspectRatio: aspectRatio
    });
  }

  return Object.assign({}, dimensions, {
    height: aspectRatio * innerWidth * ySpan / xSpan + margin.top + margin.bottom,
    scaleAspectRatio: aspectRatio
  });
}

bcGraphAsArray = (data, fallback = []) => {
  const source = bcGraphValueOr(data, fallback);
  if (Array.isArray(source)) return source.slice();
  if (source instanceof Map) {
    return Array.from(source, ([x, frequency]) => ({ x, frequency }));
  }
  if (source && typeof source === "object") {
    return Object.entries(source).map(([x, frequency]) => ({ x, frequency }));
  }
  return [];
}

bcGraphAccessor = (accessor, fallbackKeys = []) => {
  if (typeof accessor === "function") return accessor;
  if (typeof accessor === "string") return (d) => d == null ? undefined : d[accessor];
  return (d) => {
    if (d != null && typeof d === "object") {
      for (const key of fallbackKeys) {
        if (Object.prototype.hasOwnProperty.call(d, key)) return d[key];
      }
    }
    return d;
  };
}

bcGraphFirstDefined = (row, keys) => {
  if (row == null || typeof row !== "object") return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return undefined;
}

bcGraphNormalizeType = (type) => {
  const value = String(type || "histogram").toLowerCase().replace(/[_ ]+/g, "-");
  if (["hist", "histogram"].includes(value)) return "histogram";
  if (["block", "blocks", "block-hist", "block-histogram", "block-histograph"].includes(value)) return "block";
  if (["bar", "bar-chart", "bar-graph"].includes(value)) return "bar";
  if (["poly", "polygon", "freq-poly", "frequency-poly", "frequency-polygon"].includes(value)) return "polygon";
  if (["curve", "smooth", "smooth-curve", "frequency-curve", "density"].includes(value)) return "curve";
  return value;
}

bcGraphCurveFactory = (opts = {}) => {
  const curve = bcGraphValueOr(opts.interpolation, bcGraphValueOr(opts.curveFactory, opts.curve));
  if (typeof curve === "function") return curve;
  if (curve === undefined || curve === null) return d3.curveBasis;

  const name = String(curve).toLowerCase().replace(/[_ ]+/g, "-");
  const curves = {
    basis: d3.curveBasis,
    cardinal: d3.curveCardinal,
    linear: d3.curveLinear,
    monotone: d3.curveMonotoneX,
    "monotone-x": d3.curveMonotoneX,
    natural: d3.curveNatural,
    step: d3.curveStep,
    "step-after": d3.curveStepAfter,
    "step-before": d3.curveStepBefore
  };
  return curves[name] || d3.curveBasis;
}

bcGraphDefaultYLabel = (type, scale) => {
  if (scale === "percent") return "Percent";
  if (scale === "proportion") return "Proportion";
  return type === "curve" ? "Proportion" : "Frequency";
}

bcGraphFormatInterval = (lower, upper, formatter) =>
  `${formatter(lower)}-${formatter(upper)}`

bcGraphIntervalLabel = (row, formatter = (d) => d) => {
  if (row.label !== undefined && row.label !== null) return String(row.label);
  if (row.lower !== undefined && row.upper !== undefined) {
    return bcGraphFormatInterval(row.lower, row.upper, formatter);
  }
  return String(row.x);
}

bcGraphLooksSummarized = (rows, opts = {}) => {
  if (opts.summarized === true) return true;
  if (opts.frequency !== undefined || opts.count !== undefined) return true;
  const first = rows.find((row) => row != null && typeof row === "object");
  return !!first && ["frequency", "freq", "count", "n", "f"].some((key) =>
    Object.prototype.hasOwnProperty.call(first, key)
  );
}

bcGraphFinalizeRows = (rows) => {
  const total = d3.sum(rows, (row) => row.frequency);
  let cumulativeFrequency = 0;
  return rows.map((row) => {
    cumulativeFrequency += row.frequency;
    const proportion = total > 0 ? row.frequency / total : 0;
    const cumulativeProportion = total > 0 ? cumulativeFrequency / total : 0;
    return Object.assign({}, row, {
      total,
      proportion,
      percent: proportion * 100,
      cumulativeFrequency,
      cumulativeProportion,
      cumulativePercent: cumulativeProportion * 100
    });
  });
}

bcGraphNormalizeSummaryRows = (rows, opts = {}) => {
  const getX = bcGraphAccessor(opts.x || opts.value, ["x", "value", "score", "category"]);
  const getFrequency = bcGraphAccessor(opts.frequency || opts.count, ["frequency", "freq", "count", "n", "f"]);
  const getLabel = bcGraphAccessor(opts.label, ["label", "category", "x", "value", "score"]);

  const normalized = rows.map((row, index) => {
    const lower = bcGraphFirstDefined(row, ["lower", "x0", "min", "start"]);
    const upper = bcGraphFirstDefined(row, ["upper", "x1", "max", "end"]);
    const label = getLabel(row);
    const x = bcGraphValueOr(getX(row), lower !== undefined && upper !== undefined ? (Number(lower) + Number(upper)) / 2 : bcGraphValueOr(label, index));
    const frequency = bcGraphFiniteNumber(getFrequency(row)) || 0;
    return {
      x,
      key: String(x),
      label,
      lower: lower === undefined ? undefined : Number(lower),
      upper: upper === undefined ? undefined : Number(upper),
      frequency,
      source: row
    };
  });

  return bcGraphFinalizeRows(normalized);
}

bcGraphAllNumeric = (values) =>
  values.length > 0 && values.every((value) => Number.isFinite(Number(value)))

bcGraphInferStep = (values) => {
  const numbers = Array.from(new Set(values.map(Number))).sort(d3.ascending);
  const diffs = numbers.slice(1).map((value, index) => value - numbers[index]).filter((value) => value > 0);
  return diffs.length ? d3.min(diffs) : 1;
}

bcGraphScoreWidth = (values, opts = {}) => {
  const explicit = bcGraphPositiveNumber(bcGraphValueOr(opts.scoreWidth, opts.scorewidth));
  if (explicit) return explicit;

  const type = bcGraphNormalizeType(opts.type || opts.graphType);
  const numbers = values.map(Number).filter(Number.isFinite);
  if (type !== "bar" && numbers.length && numbers.every(Number.isInteger)) return 1;

  return bcGraphInferStep(values);
}

bcGraphCountValues = (rows, opts = {}) => {
  const getX = bcGraphAccessor(opts.x || opts.value, ["x", "value", "score", "category", "label"]);
  const values = rows.map(getX).filter((value) => value !== undefined && value !== null && value !== "");
  const categories = opts.categories ? opts.categories.slice() : Array.from(new Set(values));
  const numeric = bcGraphAllNumeric(categories);
  const orderedCategories = opts.categories ? categories : categories.slice().sort(numeric ? (a, b) => Number(a) - Number(b) : d3.ascending);
  const counts = new Map(orderedCategories.map((value) => [value, 0]));
  const firstSourceByValue = new Map();

  rows.forEach((row) => {
    const value = getX(row);
    if (value === undefined || value === null || value === "") return;
    if (!counts.has(value)) counts.set(value, 0);
    if (!firstSourceByValue.has(value)) firstSourceByValue.set(value, row);
    counts.set(value, counts.get(value) + 1);
  });

  const step = numeric ? bcGraphScoreWidth(orderedCategories, opts) : undefined;
  const counted = Array.from(counts, ([value, frequency]) => {
    const x = numeric ? Number(value) : value;
    const row = {
      x,
      key: String(value),
      label: String(value),
      frequency,
      source: value
    };
    if (numeric) {
      row.lower = x - step / 2;
      row.upper = x + step / 2;
      row.step = step;
      row.exactScore = true;
      row.polygonStart = x - step;
      row.polygonEnd = x + step;
    }
    row.source = firstSourceByValue.get(value);
    return row;
  });

  return bcGraphFinalizeRows(counted);
}

bcGraphResolveCuts = (values, opts = {}) => {
  if (opts.cuts) return opts.cuts.map(Number).sort(d3.ascending);

  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return [];

  const extent = d3.extent(numbers);
  const min = extent[0];
  const max = extent[1];
  const binWidth = bcGraphFiniteNumber(opts.binWidth || opts.binwidth || opts.intervalWidth);

  if (binWidth) {
    const allIntegers = numbers.every(Number.isInteger);
    const explicitStart = bcGraphFiniteNumber(opts.binStart || opts.start);
    const explicitStop = bcGraphFiniteNumber(opts.binStop || opts.stop);
    const start = explicitStart !== undefined
      ? explicitStart
      : allIntegers && binWidth === 1
        ? Math.floor(min) - 0.5
        : Math.floor(min / binWidth) * binWidth;
    let stop = explicitStop !== undefined
      ? explicitStop
      : allIntegers && binWidth === 1
        ? Math.ceil(max) + 0.5
        : Math.ceil(max / binWidth) * binWidth;
    if (stop <= max) stop += binWidth;
    return d3.range(start, stop + binWidth * 0.5, binWidth);
  }

  const bins = bcGraphFiniteNumber(opts.bins);
  if (bins) {
    const nice = d3.scaleLinear().domain([min, max]).nice(bins).domain();
    const thresholds = d3.ticks(nice[0], nice[1], bins);
    const cuts = [nice[0]].concat(thresholds.filter((value) => value > nice[0] && value < nice[1]), [nice[1]]);
    return Array.from(new Set(cuts)).sort(d3.ascending);
  }

  return [];
}

bcGraphBinValues = (rows, opts = {}) => {
  const getX = bcGraphAccessor(opts.x || opts.value, ["x", "value", "score"]);
  const values = rows.map(getX).map(Number).filter(Number.isFinite);
  const cuts = bcGraphResolveCuts(values, opts);
  if (cuts.length < 2) return bcGraphCountValues(rows, opts);

  const bins = d3.pairs(cuts).map(([lower, upper], index) => ({
    x: (lower + upper) / 2,
    key: `${lower}:${upper}`,
    lower,
    upper,
    label: opts.intervalLabels ? opts.intervalLabels[index] : undefined,
    frequency: 0
  }));

  values.forEach((value) => {
    const index = bins.findIndex((bin, i) =>
      value >= bin.lower && (value < bin.upper || (i === bins.length - 1 && value <= bin.upper))
    );
    if (index >= 0) bins[index].frequency += 1;
  });

  return bcGraphFinalizeRows(bins);
}

bcGraphFrequencyRows = (data, opts = {}) => {
  const type = bcGraphNormalizeType(opts.type || opts.graphType);
  const rows = bcGraphAsArray(data);
  if (bcGraphLooksSummarized(rows, opts)) return bcGraphNormalizeSummaryRows(rows, opts);

  const getX = bcGraphAccessor(opts.x || opts.value, ["x", "value", "score", "category", "label"]);
  const values = rows.map(getX).filter((value) => value !== undefined && value !== null && value !== "");
  const allNumeric = bcGraphAllNumeric(values);
  const forceBins = opts.cuts || opts.binWidth || opts.binwidth || opts.intervalWidth || opts.bins;

  if (allNumeric && (forceBins || (type !== "bar" && !values.every((value) => Number.isInteger(Number(value)))))) {
    return bcGraphBinValues(rows, opts);
  }

  return bcGraphCountValues(rows, opts);
}

frequencyTable = (opts = {}) =>
  bcGraphFrequencyRows(opts.data, opts)

bcGraphMeasure = (row, scale = "frequency") => {
  if (scale === "percent") return row.percent;
  if (scale === "proportion") return row.proportion;
  return row.frequency;
}

bcGraphSeriesData = (opts = {}, type = "histogram") => {
  const source = opts.series || opts.data;
  const data = bcGraphAsArray(source);

  if (opts.series || (data.length > 0 && data.every((row) => row && typeof row === "object" && Array.isArray(row.data)))) {
    return data.map((series, index) => ({
      name: series.name || series.label || `Group ${index + 1}`,
      color: series.color,
      rows: bcGraphFrequencyRows(series.data, Object.assign({}, opts, series, { type }))
    }));
  }

  if (opts.group) {
    const getGroup = bcGraphAccessor(opts.group, ["group", "series", "condition"]);
    const groups = d3.group(data, getGroup);
    return Array.from(groups, ([name, rows], index) => ({
      name: name === undefined ? `Group ${index + 1}` : String(name),
      rows: bcGraphFrequencyRows(rows, Object.assign({}, opts, { type }))
    }));
  }

  return [{
    name: opts.name || opts.label || "",
    color: opts.color,
    rows: bcGraphFrequencyRows(opts.data, Object.assign({}, opts, { type }))
  }];
}

bcGraphCurveRows = (data, opts = {}) => {
  const rows = bcGraphAsArray(data);
  const firstObject = rows.find((row) => row && typeof row === "object");
  const yKeys = ["y", "density", "proportion", "frequency", "freq"];

  if (firstObject && yKeys.some((key) => Object.prototype.hasOwnProperty.call(firstObject, key))) {
    const getX = bcGraphAccessor(opts.x || opts.value, ["x", "value", "score"]);
    const getY = bcGraphAccessor(opts.y || opts.density, yKeys);
    return rows
      .map((row) => ({ x: Number(getX(row)), y: Number(getY(row)), source: row }))
      .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y))
      .sort((a, b) => a.x - b.x);
  }

  const getX = bcGraphAccessor(opts.x || opts.value, ["x", "value", "score"]);
  const values = rows.map(getX).map(Number).filter(Number.isFinite);
  if (!values.length) return [];

  const extent = opts.xDomain || opts.domain || d3.extent(values);
  const sd = d3.deviation(values) || 1;
  const bandwidth = bcGraphPositiveNumber(bcGraphValueOr(opts.bandwidth, opts.smoothing)) ||
    1.06 * sd * Math.pow(values.length, -0.2) ||
    1;
  const points = bcGraphFiniteNumber(opts.points) || 160;
  const step = (extent[1] - extent[0]) / Math.max(1, points - 1);

  return d3.range(points).map((index) => {
    const x = extent[0] + index * step;
    const y = d3.mean(values, (value) => bcGraphNormalPdf(x, value, bandwidth));
    return { x, y };
  });
}

bcGraphCurveSeriesData = (opts = {}) => {
  const source = opts.series || opts.data;
  const data = bcGraphAsArray(source);

  if (opts.series || (data.length > 0 && data.every((row) => row && typeof row === "object" && Array.isArray(row.data)))) {
    return data.map((series, index) => ({
      name: series.name || series.label || `Group ${index + 1}`,
      color: series.color,
      rows: bcGraphCurveRows(series.data, Object.assign({}, opts, series))
    }));
  }

  if (opts.group) {
    const getGroup = bcGraphAccessor(opts.group, ["group", "series", "condition"]);
    const groups = d3.group(data, getGroup);
    return Array.from(groups, ([name, rows], index) => ({
      name: name === undefined ? `Group ${index + 1}` : String(name),
      rows: bcGraphCurveRows(rows, opts)
    }));
  }

  return [{
    name: opts.name || opts.label || "",
    color: opts.color,
    rows: bcGraphCurveRows(opts.data, opts)
  }];
}

bcGraphCreateSvg = (opts = {}, type = "histogram", dimensions = bcGraphDimensions(opts, type)) => {
  const { width, height } = dimensions;
  const labels = opts.labels || {};
  const title = bcGraphValueOr(opts.title, labels.title);
  const ariaLabel = opts.ariaLabel || title || `${type} frequency graph`;

  // A responsive redraw re-renders into the node that is already mounted
  // (opts.svgNode) instead of building a replacement, so anything holding a
  // reference to it — the mount point, an added class, a resize observer —
  // keeps working. Classes are set with classed() for the same reason.
  const reused = opts.svgNode || null;
  const svg = reused ? d3.select(reused) : d3.create("svg");
  if (reused) {
    svg.selectAll("*").remove();
    svg.on("click", null).style("cursor", null);
  }

  svg
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", ariaLabel)
    .classed("bc-graph", true)
    .classed(`bc-graph-${type}`, true)
    .style("width", bcGraphValueOr(opts.cssWidth, "100%"))
    .style("max-width", bcGraphValueOr(opts.maxWidth, "100%"))
    .style("height", "auto")
    .style("display", "block");

  if (opts.className) svg.classed(opts.className, true);
  if (opts.cssMargin !== undefined) svg.style("margin", opts.cssMargin);
  svg.append("title").text(ariaLabel);
  return svg;
}

bcGraphResolveMargin = (opts = {}) => {
  const margin = opts.margin || {};
  return {
    top: bcGraphValueOr(margin.top, opts.title || (opts.labels && opts.labels.title) ? 42 : 22),
    right: bcGraphValueOr(margin.right, 22),
    bottom: bcGraphValueOr(margin.bottom, 58),
    left: bcGraphValueOr(margin.left, 64)
  };
}

bcGraphStyleAxis = (axis) => {
  axis.attr("class", function() {
      return `${this.getAttribute("class") || ""} bc-graph-axis`;
    })
    .call((g) => g.selectAll("text").attr("class", "bc-graph-tick-label"))
    .call((g) => g.selectAll("line").attr("class", "bc-graph-tick-line"))
    .call((g) => g.selectAll("path").attr("class", "bc-graph-domain"));
}

bcGraphAllIntegers = (values) =>
  Array.isArray(values) &&
  values.length > 0 &&
  values.every((value) => Number.isInteger(Number(value)));

// Every x value the figure was built from, so the axis can tell a discrete
// score scale from a continuous measurement. Bin objects contribute their own
// boundaries; anything non-numeric (a nominal category) disqualifies the set.
bcGraphXValueSample = (opts = {}) => {
  const sources = [];
  if (Array.isArray(opts.series)) {
    opts.series.forEach((series) => {
      if (series && Array.isArray(series.data)) sources.push(series.data);
    });
  }
  if (Array.isArray(opts.data)) sources.push(opts.data);
  if (Array.isArray(opts.categories)) sources.push(opts.categories);

  const values = [];
  sources.forEach((source) => source.forEach((entry) => {
    if (entry !== null && typeof entry === "object") {
      if (entry.lower !== undefined || entry.upper !== undefined) {
        values.push(entry.lower, entry.upper);
      } else {
        values.push(bcGraphValueOr(entry.x, entry.value));
      }
    } else {
      values.push(entry);
    }
  }));

  return values.filter((value) => value !== undefined && value !== null);
}

bcGraphUseIntegerXTicks = (opts = {}) => {
  if (opts.xTickValues !== undefined || opts.tickValues !== undefined) return false;
  return Boolean(bcGraphValueOr(
    opts.integerXTicks,
    bcGraphValueOr(opts.xIntegerTicks, bcGraphAllIntegers(bcGraphXValueSample(opts)))
  ));
}

bcGraphScaleSpan = (scale) => {
  const range = typeof scale.range === "function" ? scale.range() : null;
  if (!range || range.length < 2) return 0;
  return Math.abs(Number(range[range.length - 1]) - Number(range[0]));
}

// Tick labels hold their size at every screen width, so a short or narrow plot
// has room for fewer of them, not smaller ones. Both axes therefore ask for as
// many ticks as fit and no more: crowding is resolved by thinning the axis, the
// way the presidential chart drops to 20-year ticks on a phone. An explicit
// tickValues list is the author's own decision and is left alone.
bcGraphFitTickCount = (scale, requested, spacing) => {
  const span = bcGraphScaleSpan(scale);
  if (!span || !Number.isFinite(spacing) || spacing <= 0) return requested;
  const budget = Math.max(2, Math.floor(span / spacing));
  return Math.max(2, Math.min(requested, budget));
}

// Roughly how wide a tick label is, in the shared 13 px tick size: enough for
// "1" to sit closer to its neighbour than "440" does.
bcGraphTickLabelSpacing = (scale, count, formatter) => {
  if (typeof scale.ticks !== "function") return 0;
  const values = scale.ticks(count);
  if (!values.length) return 0;
  const format = formatter ||
    (typeof scale.tickFormat === "function" ? scale.tickFormat(count) : String);
  const widest = values.reduce(
    (longest, value) => Math.max(longest, String(format(value)).length),
    1
  );
  return widest * 7 + 12;
}

// Whole-number scores get whole-number ticks: "1", not "1.0", and no half-step
// ticks on a scale where half a point was never a possible value. Continuous
// measurements keep d3's own ticks and format.
bcGraphBottomAxis = (scale, opts = {}, fallbackTicks) => {
  const axis = d3.axisBottom(scale);
  const tickFormat = opts.xTickFormat || opts.tickFormat;
  const continuousScale = typeof scale.ticks === "function";
  const requestedCount = bcGraphValueOr(opts.xTicks, fallbackTicks);
  const tickCount = continuousScale
    ? bcGraphFitTickCount(
      scale,
      bcGraphValueOr(requestedCount, 10),
      bcGraphTickLabelSpacing(scale, bcGraphValueOr(requestedCount, 10), tickFormat)
    )
    : requestedCount;
  let tickValues = opts.xTickValues || opts.tickValues;

  if (!tickValues && continuousScale && bcGraphUseIntegerXTicks(opts)) {
    tickValues = bcGraphIntegerTicks(scale.domain(), tickCount);
  }

  if (tickValues) {
    axis.tickValues(tickValues);
  } else if (tickCount !== undefined) {
    axis.ticks(tickCount);
  }

  if (tickFormat) {
    axis.tickFormat(tickFormat);
  } else if (bcGraphAllIntegers(tickValues)) {
    axis.tickFormat(d3.format("d"));
  } else if (!tickValues && continuousScale &&
    bcGraphAllIntegers(scale.ticks(bcGraphValueOr(tickCount, 10)))) {
    axis.tickFormat(d3.format("d"));
  }

  return axis;
}

bcGraphIntegerTicks = (domain, tickCount = 5) => {
  const lower = Math.ceil(Math.min(Number(domain[0]), Number(domain[1])));
  const upper = Math.floor(Math.max(Number(domain[0]), Number(domain[1])));
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper < lower) return undefined;
  if (upper === lower) return [lower];

  const count = Math.max(1, Math.round(bcGraphPositiveNumber(tickCount) || 5));
  const step = Math.max(1, Math.ceil(Math.abs(d3.tickStep(lower, upper, count)) || 1));
  const start = Math.ceil(lower / step) * step;
  const values = d3.range(start, upper + step / 2, step)
    .filter((value) => value >= lower && value <= upper);

  return values.length ? values : [lower, upper];
}

bcGraphUseIntegerYTicks = (opts = {}, scale = "frequency") => {
  if (opts.yTickValues !== undefined || Array.isArray(opts.yTicks)) return false;
  return bcGraphValueOr(
    opts.integerYTicks,
    bcGraphValueOr(opts.yIntegerTicks, scale === "frequency")
  );
}

// Two lines of tick text need about twice the shared tick size between them.
bcGraphYTickSpacing = 28;

bcGraphYTickCount = (y, opts = {}) =>
  bcGraphFitTickCount(y, bcGraphValueOr(opts.yTicks, 5), bcGraphYTickSpacing);

bcGraphYTickValues = (y, opts = {}, scale = "frequency") => {
  if (opts.yTickValues !== undefined) return opts.yTickValues;
  if (Array.isArray(opts.yTicks)) return opts.yTicks;
  return bcGraphUseIntegerYTicks(opts, scale)
    ? bcGraphIntegerTicks(y.domain(), bcGraphYTickCount(y, opts))
    : undefined;
}

bcGraphLeftAxis = (y, opts = {}, scale = "frequency") => {
  const axis = d3.axisLeft(y);
  const tickValues = bcGraphYTickValues(y, opts, scale);
  const useIntegerTicks = bcGraphUseIntegerYTicks(opts, scale);
  const tickFormat = opts.yTickFormat || opts.yFormat;

  if (tickValues !== undefined) {
    axis.tickValues(tickValues);
  } else {
    axis.ticks(bcGraphYTickCount(y, opts));
  }

  if (tickFormat) {
    axis.tickFormat(tickFormat);
  } else if (useIntegerTicks || bcGraphAllIntegers(tickValues)) {
    axis.tickFormat(d3.format("d"));
  }

  return axis;
}

bcGraphAddLabels = (svg, opts, type, margin, width, height, scale) => {
  const labels = opts.labels || {};
  const title = bcGraphValueOr(opts.title, labels.title);
  const xLabel = bcGraphValueOr(opts.xLabel, labels.x || labels.xLabel || "Scores");
  const yLabel = bcGraphValueOr(opts.yLabel, labels.y || labels.yLabel || bcGraphDefaultYLabel(type, scale));

  if (title) {
    svg.append("text")
      .attr("class", "bc-graph-title")
      .attr("x", margin.left)
      .attr("y", 18)
      .text(title);
  }

  if (xLabel !== false) {
    svg.append("text")
      .attr("class", "bc-graph-label bc-graph-x-label")
      .attr("x", (margin.left + width - margin.right) / 2)
      .attr("y", height - 12)
      .attr("text-anchor", "middle")
      .text(xLabel);
  }

  if (yLabel !== false) {
    svg.append("text")
      .attr("class", "bc-graph-label bc-graph-y-label")
      .attr("x", -(margin.top + height - margin.bottom) / 2)
      .attr("y", 17)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .text(yLabel);
  }
}

bcGraphAddLegend = (svg, series, opts, width, margin) => {
  if (series.length < 2 || opts.legend === false) return;
  const legend = svg.append("g")
    .attr("class", "bc-graph-legend")
    .attr("transform", `translate(${width - margin.right - 120},${margin.top})`);

  const items = legend.selectAll("g")
    .data(series)
    .join("g")
      .attr("transform", (d, i) => `translate(0,${i * 20})`);

  items.append("line")
    .attr("x1", 0)
    .attr("x2", 18)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", (d, i) => d.color || bcGraphDefaultColors[i % bcGraphDefaultColors.length])
    .attr("stroke-width", 2);

  items.append("text")
    .attr("x", 24)
    .attr("y", 4)
    .text((d) => d.name);
}

bcGraphAddReferenceMarkers = (svg, opts, x, margin, height) => {
  const rawMarkers = bcGraphValueOr(opts.referenceMarkers, opts.referenceLines);
  if (rawMarkers === undefined || rawMarkers === null || rawMarkers === false) return;

  const domain = x.domain();
  const domainMin = Math.min(Number(domain[0]), Number(domain[1]));
  const domainMax = Math.max(Number(domain[0]), Number(domain[1]));
  const markerData = (Array.isArray(rawMarkers) ? rawMarkers : [rawMarkers])
    .map((marker) => typeof marker === "number" ? { value: marker } : marker || {})
    .map((marker) => Object.assign({}, marker, { value: Number(marker.value) }))
    .filter((marker) => Number.isFinite(marker.value) && marker.value >= domainMin && marker.value <= domainMax);
  if (!markerData.length) return;

  const markers = svg.append("g")
    .attr("class", "bc-graph-reference-markers")
    .attr("aria-hidden", "true")
    .selectAll("g")
    .data(markerData)
    .join("g")
      .attr("class", "bc-graph-reference-marker")
      .attr("transform", (d) => `translate(${x(d.value)},0)`);

  markers.append("line")
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom)
    .attr("stroke-dasharray", (d) => bcGraphValueOr(d.dash, "5 4"))
    .attr("stroke-width", (d) => bcGraphValueOr(d.strokeWidth, 2))
    .style("stroke", (d) => d.color || "var(--bc-danger-color, #c63f3f)");

  markers.filter((d) => d.label !== undefined && d.label !== null && d.label !== false)
    .append("text")
      .attr("x", (d) => bcGraphValueOr(d.dx, 6))
      .attr("y", (d) => margin.top + bcGraphValueOr(d.dy, 16))
      .attr("text-anchor", (d) => bcGraphValueOr(d.anchor, "start"))
      .style("fill", (d) => d.color || "var(--bc-danger-color, #c63f3f)")
      .text((d) => d.label);
}

bcGraphLinearDomain = (series, opts = {}, type = "histogram") => {
  if (opts.xDomain) return opts.xDomain;
  if (opts.domain) return opts.domain;

  const values = [];
  series.forEach((s) => s.rows.forEach((row) => {
    if (Number.isFinite(row.lower)) values.push(row.lower);
    if (Number.isFinite(row.upper)) values.push(row.upper);
    if (!Number.isFinite(row.lower) && Number.isFinite(Number(row.x))) values.push(Number(row.x));
  }));

  const extent = d3.extent(values);
  if (!values.length) return [0, 1];
  return extent[0] === extent[1] ? [extent[0] - 1, extent[1] + 1] : extent;
}

bcGraphYDomain = (series, opts = {}, scale = "frequency") => {
  if (opts.yDomain) return opts.yDomain;
  const maxValue = d3.max(series, (s) => d3.max(s.rows, (row) => bcGraphMeasure(row, scale))) || 0;
  return [0, maxValue];
}

bcGraphLookupVisual = (visual, row, datum) => {
  if (visual === undefined || visual === null) return undefined;
  if (typeof visual === "function") return visual(row, datum);
  if (Array.isArray(visual)) return visual[datum.rowIndex % visual.length];
  if (typeof visual !== "object") return visual;
  if (typeof visual === "object") {
    const source = row.source && typeof row.source === "object" ? row.source : {};
    const keys = [
      row.label,
      row.key,
      row.x,
      source.label,
      source.category,
      source.x,
      source.value,
      source.score
    ].filter((value) => value !== undefined && value !== null).map(String);
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(visual, key)) return visual[key];
    }
  }
  return undefined;
}

bcGraphFirstVisual = (values) => {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

bcGraphRowFill = (datum, opts, fallback) => {
  const row = datum.row || datum;
  const source = row.source && typeof row.source === "object" ? row.source : {};
  return bcGraphFirstVisual([
    row.fill,
    row.color,
    source.fill,
    source.color,
    bcGraphLookupVisual(opts.fills || opts.fill || opts.colors, row, datum),
    fallback
  ]);
}

bcGraphRowBlockFill = (datum, opts, fallback) => {
  const row = datum.row || datum;
  const source = row.source && typeof row.source === "object" ? row.source : {};
  return bcGraphFirstVisual([
    row.blockFill,
    row.blockColor,
    row.fill,
    row.color,
    source.blockFill,
    source.blockColor,
    source.fill,
    source.color,
    bcGraphLookupVisual(opts.blockFills || opts.blockFill || opts.blockColors || opts.blockColor, row, datum),
    bcGraphLookupVisual(opts.fills || opts.fill || opts.colors || opts.color, row, datum),
    fallback
  ]);
}

bcGraphRowStroke = (datum, opts, fallback) => {
  const row = datum.row || datum;
  const source = row.source && typeof row.source === "object" ? row.source : {};
  return bcGraphFirstVisual([
    row.stroke,
    source.stroke,
    bcGraphLookupVisual(opts.barStrokes || opts.barStroke || opts.strokes || opts.stroke, row, datum),
    fallback
  ]);
}

bcGraphRowBlockStroke = (datum, opts, fallback) => {
  const row = datum.row || datum;
  const source = row.source && typeof row.source === "object" ? row.source : {};
  return bcGraphFirstVisual([
    row.stroke,
    source.stroke,
    bcGraphLookupVisual(opts.blockStrokes || opts.blockStroke, row, datum),
    bcGraphLookupVisual(opts.barStrokes || opts.barStroke || opts.strokes || opts.stroke, row, datum),
    fallback
  ]);
}

bcGraphSeriesStroke = (seriesDatum, opts, index, fallback) => {
  const row = {
    label: seriesDatum.name,
    key: seriesDatum.name,
    x: seriesDatum.name,
    source: seriesDatum
  };
  const datum = {
    row,
    series: seriesDatum,
    seriesIndex: index,
    rowIndex: index
  };
  return bcGraphFirstVisual([
    seriesDatum.stroke,
    seriesDatum.color,
    bcGraphLookupVisual(opts.strokes || opts.stroke || opts.colors || opts.color, row, datum),
    fallback
  ]);
}

bcGraphDrawGrid = (svg, y, opts, margin, width, scale = "frequency") => {
  if (!opts.grid) return;
  svg.append("g")
    .attr("class", "bc-graph-grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(bcGraphLeftAxis(y, opts, scale)
      .tickSize(-(width - margin.left - margin.right))
      .tickFormat(""))
    .call((g) => g.select(".domain").remove());
}

bcGraphHistogramBounds = (row) => ({
  left: Number.isFinite(row.lower) ? row.lower : Number(row.x) - 0.5,
  right: Number.isFinite(row.upper) ? row.upper : Number(row.x) + 0.5
})

bcGraphHistogramX = (row, x, overlayOffset, seriesIndex) => {
  const bounds = bcGraphHistogramBounds(row);
  const width = x(bounds.right) - x(bounds.left);
  return x(bounds.left) + width * overlayOffset + seriesIndex * 0.5;
}

bcGraphHistogramWidth = (row, x, overlayWidth, barGap = 0) => {
  const bounds = bcGraphHistogramBounds(row);
  return Math.max(0, (x(bounds.right) - x(bounds.left)) * overlayWidth - barGap);
}

bcGraphBlockRows = (rowData, scale, opts = {}) => {
  const unit = bcGraphPositiveNumber(bcGraphValueOr(opts.blockUnit, bcGraphValueOr(opts.blockSize, opts.unit))) || 1;
  const epsilon = unit / 1000000;
  return rowData.flatMap((datum) => {
    const value = Math.max(0, bcGraphMeasure(datum.row, scale));
    const blockCount = Math.ceil(Math.max(0, value - epsilon) / unit);
    return d3.range(blockCount)
      .map((blockIndex) => {
        const blockLower = blockIndex * unit;
        const blockUpper = Math.min(value, (blockIndex + 1) * unit);
        return Object.assign({}, datum, {
          blockIndex,
          blockLower,
          blockUpper,
          blockUnit: unit
        });
      })
      .filter((block) => block.blockUpper > block.blockLower);
  });
}

bcGraphPrefersReducedMotion = () =>
  typeof window !== "undefined" &&
  (window.interactiveRuntime && window.interactiveRuntime.motion
    ? window.interactiveRuntime.motion.isReduced()
    : typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)

bcGraphEaseFactory = (name, fallback) => {
  if (typeof name === "function") return name;
  const eases = {
    linear: d3.easeLinear,
    cubic: d3.easeCubic,
    "cubic-in": d3.easeCubicIn,
    "cubic-out": d3.easeCubicOut,
    "cubic-in-out": d3.easeCubicInOut,
    back: d3.easeBackOut,
    bounce: d3.easeBounceOut
  };
  return eases[String(name || "").toLowerCase()] || fallback;
}

bcGraphEntranceOptions = (opts = {}) => {
  const requested = opts.animate === true || opts.animate === "visible" || opts.animate === "auto";
  const duration = bcGraphValueOr(opts.animationDuration, 1000);
  return {
    enabled: requested && !bcGraphPrefersReducedMotion(),
    duration,
    delayStep: bcGraphValueOr(opts.animationDelay, 200),
    seriesDelay: bcGraphValueOr(opts.seriesAnimationDelay, duration * 0.25),
    threshold: bcGraphValueOr(opts.animationThreshold, 0.95),
    ease: opts.animationEase
  };
}

// Plays once when the SVG scrolls into view, and replays on click so a
// reader can re-trigger the entrance without reloading the page.
bcGraphPlayEntrance = (svg, threshold, play, namespace = "") => {
  const eventName = namespace ? `click.${namespace}` : "click";
  svg.style("cursor", "pointer").on(eventName, play);
  onVisible(svg.node(), play, threshold);
}

// A left-to-right "reveal" for a monotonic-in-x line, via a clipPath rect
// that grows in width — not stroke-dasharray/dashoffset sized to the path's
// own rendered length. That technique needs a dash length at least as long
// as the true rendered length or the tail wraps into the next dash cycle
// (visible while the rest is hidden, then invisible once the rest has
// drawn); SVGGeometryElement.getTotalLength() looked like the obvious
// source for that length, and computing it ourselves from the data points
// looked like a robust replacement when getTotalLength() turned out to
// vary with viewport width — but both approaches ultimately measure or
// compute a length in order to answer a question ("how far across has the
// reveal gotten?") that a clip rect never needs to ask: it only needs the
// plot's own pixel bounds, which are exact and viewport-independent by
// construction. Every line/curve in this module is monotonic in x (never
// loops back), so revealing left-to-right in x is visually the same as
// tracing the line with a pen, without any path-length math at all.
bcGraphRevealClips = (svg, lineSelection, left, top, width, height) => lineSelection.nodes().map((node) => {
  const clipId = bcGraphNextClipId("bc-graph-reveal-clip");
  const rect = svg.append("clipPath").attr("id", clipId)
    .append("rect")
      .attr("x", left)
      .attr("y", top)
      .attr("width", 0)
      .attr("height", height);
  d3.select(node).attr("clip-path", `url(#${clipId})`);
  return rect;
})

// Same constant-gravity model as sampling-visuals.js's mean-boxes (kept as a
// separate constant rather than a shared import since the two modules aren't
// always loaded together) — a block's fall duration is derived from its own
// fall distance (distance = ½·g·t²), not a fixed duration, so every block
// drops at the same physical rate regardless of how far it falls.
bcGraphFallGravity = 1700 // px per second^2
bcGraphFallDurationForDistance = (distance) =>
  Math.sqrt(2 * Math.max(0, distance) / bcGraphFallGravity) * 1000

bcGraphHashSeed = (seed) => {
  const text = String(seed ?? "bc-block-fall-v1");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

bcGraphSeededRandom = (seed) => {
  let state = bcGraphHashSeed(seed);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

bcGraphBlockFallRanks = (blockData, opts = {}) => {
  const order = String(bcGraphValueOr(opts.blockFallOrder, opts.fallOrder) || "sequential")
    .toLowerCase();
  const ranks = new Map();

  if (!["random", "randomized", "shuffle", "shuffled"].includes(order)) {
    blockData.forEach((datum, index) => ranks.set(datum, index));
    return ranks;
  }

  const seed = bcGraphValueOr(
    opts.blockFallSeed,
    bcGraphValueOr(opts.fallSeed, bcGraphValueOr(opts.seed, "bc-block-fall-v1"))
  );
  const random = bcGraphSeededRandom(seed);
  const stacks = Array.from(
    d3.group(blockData, (datum) => `${datum.seriesIndex}:${datum.rowIndex}`).values(),
    (items) => ({
      items: items.slice().sort((a, b) => d3.ascending(a.blockIndex, b.blockIndex)),
      next: 0
    })
  );
  let remaining = blockData.length;

  for (let rank = 0; rank < blockData.length; rank += 1) {
    let choice = Math.floor(random() * remaining);
    let selected = stacks[0];

    for (const stack of stacks) {
      const available = stack.items.length - stack.next;
      if (choice < available) {
        selected = stack;
        break;
      }
      choice -= available;
    }

    const datum = selected.items[selected.next];
    selected.next += 1;
    remaining -= 1;
    ranks.set(datum, rank);
  }

  return ranks;
}

bcGraphClipIdCounter = 0
bcGraphNextClipId = (prefix) => `${prefix}-${++bcGraphClipIdCounter}`

// Bars/histogram grow at a constant rate (pixels per second), so a tall bar
// takes proportionally longer than a short one instead of every bar
// finishing at the same moment regardless of height — no easing, since a
// constant rate *is* linear.
bcGraphGrowthDuration = (heightPx, rate) => (Math.max(0, heightPx) / rate) * 1000

// For a relay where item i doesn't start until item i-1 has finished:
// cumulative sum of each item's own duration.
bcGraphRelayDelays = (durations) => {
  const delays = [];
  let cumulative = 0;
  durations.forEach((duration) => {
    delays.push(cumulative);
    cumulative += duration;
  });
  return delays;
}

bcGraphMakeBarGraph = (opts = {}, type = "bar") => {
  const series = bcGraphSeriesData(opts, type);
  const scale = bcGraphValueOr(opts.scale, "frequency");
  const dimensions = bcGraphDimensions(opts, type);
  const { width, height } = dimensions;
  const margin = bcGraphResolveMargin(opts);
  const svg = bcGraphCreateSvg(opts, type, dimensions);
  const allRows = series.flatMap((s) => s.rows);
  const categories = Array.from(new Set(allRows.map((row) => bcGraphIntervalLabel(row))));
  const x = d3.scaleBand()
    .domain(categories)
    .range([margin.left, width - margin.right])
    .padding(bcGraphValueOr(opts.padding, 0.22));
  const xSeries = d3.scaleBand()
    .domain(series.map((s) => s.name))
    .range([0, x.bandwidth()])
    .padding(series.length > 1 ? 0.08 : 0);
  const y = d3.scaleLinear()
    .domain(bcGraphYDomain(series, opts, scale))
    .nice()
    .range([height - margin.bottom, margin.top]);

  bcGraphDrawGrid(svg, y, opts, margin, width, scale);

  const rowData = series.flatMap((s, seriesIndex) =>
    s.rows.map((row, rowIndex) => ({ row, series: s, seriesIndex, rowIndex }))
  );
  const entrance = bcGraphEntranceOptions(opts);

  const bars = svg.append("g")
    .attr("class", "bc-graph-bars")
    .selectAll("rect")
    .data(rowData)
    .join("rect")
      .attr("class", "bc-graph-bar")
      .attr("x", (d) => x(bcGraphIntervalLabel(d.row)) + xSeries(d.series.name))
      .attr("y", (d) => entrance.enabled ? y(0) : y(bcGraphMeasure(d.row, scale)))
      .attr("width", xSeries.bandwidth())
      .attr("height", (d) => entrance.enabled ? 0 : y(0) - y(bcGraphMeasure(d.row, scale)))
      .style("fill", (d) => bcGraphRowFill(
        d,
        opts,
        d.series.color || (series.length > 1 ? bcGraphDefaultColors[d.seriesIndex % bcGraphDefaultColors.length] : "var(--graph-bar-fill, #bdbdbd)")
      ))
      .style("stroke", (d) => bcGraphRowStroke(d, opts, "var(--graph-bar-stroke, currentColor)"));

  bars.append("title")
    .text((d) => `${bcGraphIntervalLabel(d.row)}: ${d.row.frequency}`);

  if (entrance.enabled) {
    // Each bar starts growing the instant the previous one finishes — a
    // relay, not a fixed per-bar delay — so the pacing stays consistent
    // regardless of how many bars there are.
    const growthRate = bcGraphValueOr(opts.growthRate, 900); // px/sec
    const durations = rowData.map((d) => bcGraphGrowthDuration(y(0) - y(bcGraphMeasure(d.row, scale)), growthRate));
    const delays = bcGraphRelayDelays(durations);
    const play = () => {
      bars.interrupt()
        .attr("y", y(0))
        .attr("height", 0)
        .transition()
        .delay((d, i) => delays[i])
        .duration((d, i) => durations[i])
        .ease(d3.easeLinear)
        .attr("y", (d) => y(bcGraphMeasure(d.row, scale)))
        .attr("height", (d) => y(0) - y(bcGraphMeasure(d.row, scale)));
    };
    bcGraphPlayEntrance(svg, entrance.threshold, play);
  }

  const xAxis = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(bcGraphBottomAxis(x, opts));
  const yAxis = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(bcGraphLeftAxis(y, opts, scale));
  bcGraphStyleAxis(xAxis);
  bcGraphStyleAxis(yAxis);
  if (opts.yAxisLine === false) yAxis.select(".bc-graph-domain").remove();

  bcGraphAddLabels(svg, opts, type, margin, width, height, scale);
  bcGraphAddLegend(svg, series, opts, width, margin);
  return svg.node();
}

bcGraphMakeHistogram = (opts = {}, type = "histogram") => {
  const series = bcGraphSeriesData(opts, type);
  const scale = bcGraphValueOr(opts.scale, "frequency");
  const margin = bcGraphResolveMargin(opts);
  const xDomain = bcGraphLinearDomain(series, opts, type);
  const finalXDomain = opts.xNiceTicks ?
    d3.scaleLinear().domain(xDomain).nice(opts.xNiceTicks).domain() :
    xDomain;
  const yDomain = d3.scaleLinear()
    .domain(bcGraphYDomain(series, opts, scale))
    .nice()
    .domain();
  const dimensions = bcGraphDimensionsForLinearScales(opts, type, finalXDomain, yDomain, margin);
  const { width, height } = dimensions;
  const svg = bcGraphCreateSvg(opts, type, dimensions);
  const x = d3.scaleLinear()
    .domain(finalXDomain)
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain(yDomain)
    .range([height - margin.bottom, margin.top]);

  bcGraphDrawGrid(svg, y, opts, margin, width, scale);

  const rowData = series.flatMap((s, seriesIndex) =>
    s.rows.map((row, rowIndex) => ({ row, series: s, seriesIndex, rowIndex }))
  );
  const overlayWidth = series.length > 1 ? 0.72 : 1;
  const overlayOffset = series.length > 1 ? (1 - overlayWidth) / 2 : 0;
  const barGap = bcGraphValueOr(opts.barGap, 0);
  const entrance = bcGraphEntranceOptions(opts);

  if (type === "block") {
    const blockGap = bcGraphValueOr(opts.blockGap, 0);
    // The default release order follows blockData: one column bottom-to-top,
    // then the next. An opt-in randomized order interleaves columns while
    // preserving bottom-to-top order within each stack, so blocks never land
    // in midair.
    const blockData = bcGraphBlockRows(rowData, scale, opts);
    const blockFallRanks = bcGraphBlockFallRanks(blockData, opts);
    // Same default resolution bcGraphBlockRows uses internally for `unit` —
    // duplicated (not returned from that call) since it's a one-liner and
    // changing that function's return shape isn't worth it for this.
    const blockUnit = bcGraphPositiveNumber(bcGraphValueOr(opts.blockUnit, bcGraphValueOr(opts.blockSize, opts.unit))) || 1;
    // The y-scale is linear and every block spans the same `unit`, so every
    // block has the same pixel height regardless of which row/stack it's in
    // (a partial last block is only ever shorter than this, never taller) —
    // one number describes "how tall a block is" for the whole chart.
    const blockPixelHeight = Math.abs(y(0) - y(blockUnit));
    // Blocks fall from a shared ceiling above the plot, like objects dropped
    // from a shelf — same constant-gravity model as sampling-visuals.js's
    // mean-boxes (see bcGraphFallDurationForDistance). `.bc-graph` sets
    // overflow:visible (so axis labels etc. aren't clipped), so a ceiling
    // above y=0 would otherwise just render as a visible block sitting above
    // the plot rather than staying out of sight — a clipPath scoped to this
    // layer keeps the "off canvas until it falls into frame" effect without
    // touching that page-wide overflow setting. The ceiling has to clear a
    // full block's *height*, not just its top edge — a block positioned by
    // its top-left corner still has its bottom edge sticking out below that
    // point, which is what was still visible before this accounted for it.
    const fallHeadroomRatio = bcGraphValueOr(opts.fallHeadroomRatio, 0.5);
    const ceilingY = -blockPixelHeight * (1 + fallHeadroomRatio);
    const blockTargetX = (datum) =>
      bcGraphHistogramX(datum.row, x, overlayOffset, datum.seriesIndex);
    const blockWidth = (datum) =>
      bcGraphHistogramWidth(datum.row, x, overlayWidth, barGap);
    const blockOriginX = (datum) => {
      const origin = opts.blockFallOriginX;
      if (origin === undefined || origin === null || origin === false) {
        return blockTargetX(datum);
      }

      const plotCenter = (margin.left + width - margin.right) / 2;
      const center = Number.isFinite(Number(origin))
        ? Number(origin)
        : ["center", "plot-center", "top-center"].includes(String(origin).toLowerCase())
          ? plotCenter
          : null;
      return center === null
        ? blockTargetX(datum)
        : center - blockWidth(datum) / 2;
    };

    const blocksGroup = svg.append("g").attr("class", "bc-graph-bars bc-graph-blocks");
    if (entrance.enabled) {
      const clipId = bcGraphNextClipId("bc-graph-block-clip");
      svg.append("clipPath").attr("id", clipId)
        .append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height);
      blocksGroup.attr("clip-path", `url(#${clipId})`);
    }

    const blocks = blocksGroup
      .selectAll("rect")
      .data(blockData)
      .join("rect")
        .attr("class", "bc-graph-bar bc-graph-block")
        .attr("x", (d) => entrance.enabled ? blockOriginX(d) : blockTargetX(d))
        .attr("y", (d) => entrance.enabled ? ceilingY : y(d.blockUpper))
        .attr("width", blockWidth)
        .attr("height", (d) => Math.max(0, y(d.blockLower) - y(d.blockUpper) - blockGap))
        .attr("data-block-index", (d) => d.blockIndex)
        .attr("data-fall-rank", (d) => blockFallRanks.get(d))
        .style("fill", (d) => bcGraphRowBlockFill(
          d,
          opts,
          d.series.color || (series.length > 1 ? bcGraphDefaultColors[d.seriesIndex % bcGraphDefaultColors.length] : "var(--graph-block-fill, var(--graph-bar-fill, #bdbdbd))")
        ))
        .style("stroke", (d) => bcGraphRowBlockStroke(d, opts, "var(--graph-block-stroke, var(--bs-body-bg, currentColor))"))
        .attr("fill-opacity", series.length > 1 ? 0.45 : null);

    blocks.append("title")
      .text((d) => `${bcGraphIntervalLabel(d.row)} block ${d.blockIndex + 1}: ${d.row.frequency}`);

    if (entrance.enabled) {
      const ease = bcGraphEaseFactory(entrance.ease, d3.easeQuadIn);
      // Every block releases one by one at a fixed cadence (not waiting for
      // the previous one to land) — a block released later is always at an
      // earlier point along the very same ceiling-to-target trajectory a
      // block below it in its column used, so it can never catch up to or
      // pass through an already-landed block above which it stacks, for
      // *any* positive stagger. But "never overlaps" and "looks like
      // distinct blocks" aren't the same thing: right when a block is
      // released, the gap between it and the block ahead of it (both still
      // falling under the same gravity) is only ½·g·(stagger/1000)² — that
      // gap then only grows, so this moment is the narrowest it'll ever be.
      // Sizing the stagger as "the time it takes to fall a fraction of one
      // block's height" keeps that narrowest gap a fixed, visible fraction
      // of a block regardless of how big or small the chart's blocks are,
      // rather than a fixed millisecond count tuned for one particular
      // chart size.
      const fallGapFraction = bcGraphValueOr(opts.fallGapFraction, 0.25);
      const stagger = bcGraphValueOr(opts.fallStagger, bcGraphFallDurationForDistance(blockPixelHeight * fallGapFraction));
      const play = () => {
        blocks.interrupt()
          .attr("x", blockOriginX)
          .attr("y", ceilingY)
          .transition()
          .delay((d) => blockFallRanks.get(d) * stagger)
          .duration((d) => bcGraphFallDurationForDistance(y(d.blockUpper) - ceilingY))
          .ease(ease)
          .attr("x", blockTargetX)
          .attr("y", (d) => y(d.blockUpper));
      };
      bcGraphPlayEntrance(svg, entrance.threshold, play);
    }
  } else {
    const bars = svg.append("g")
      .attr("class", "bc-graph-bars")
      .selectAll("rect")
      .data(rowData)
      .join("rect")
        .attr("class", "bc-graph-bar")
        .attr("x", (d) => bcGraphHistogramX(d.row, x, overlayOffset, d.seriesIndex))
        .attr("y", (d) => entrance.enabled ? y(0) : y(bcGraphMeasure(d.row, scale)))
        .attr("width", (d) => bcGraphHistogramWidth(d.row, x, overlayWidth, barGap))
        .attr("height", (d) => entrance.enabled ? 0 : y(0) - y(bcGraphMeasure(d.row, scale)))
        .style("fill", (d) => bcGraphRowFill(
          d,
          opts,
          d.series.color || (series.length > 1 ? bcGraphDefaultColors[d.seriesIndex % bcGraphDefaultColors.length] : "var(--graph-bar-fill, #bdbdbd)")
        ))
        .style("stroke", (d) => bcGraphRowStroke(d, opts, "var(--graph-bar-stroke, currentColor)"))
        .attr("fill-opacity", series.length > 1 ? 0.45 : null);

    bars.append("title")
      .text((d) => `${bcGraphIntervalLabel(d.row)}: ${d.row.frequency}`);

    if (entrance.enabled) {
      const growthRate = bcGraphValueOr(opts.growthRate, 900); // px/sec
      const durations = rowData.map((d) => bcGraphGrowthDuration(y(0) - y(bcGraphMeasure(d.row, scale)), growthRate));
      const delays = bcGraphRelayDelays(durations);
      const play = () => {
        bars.interrupt()
          .attr("y", y(0))
          .attr("height", 0)
          .transition()
          .delay((d, i) => delays[i])
          .duration((d, i) => durations[i])
          .ease(d3.easeLinear)
          .attr("y", (d) => y(bcGraphMeasure(d.row, scale)))
          .attr("height", (d) => y(0) - y(bcGraphMeasure(d.row, scale)));
      };
      bcGraphPlayEntrance(svg, entrance.threshold, play);
    }
  }

  bcGraphAddReferenceMarkers(svg, opts, x, margin, height);

  const xAxis = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(bcGraphBottomAxis(x, opts));
  const yAxis = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(bcGraphLeftAxis(y, opts, scale));
  bcGraphStyleAxis(xAxis);
  bcGraphStyleAxis(yAxis);
  if (opts.yAxisLine === false) yAxis.select(".bc-graph-domain").remove();

  bcGraphAddLabels(svg, opts, type, margin, width, height, scale);
  bcGraphAddLegend(svg, series, opts, width, margin);
  return svg.node();
}

bcGraphPolygonPoints = (rows, scale) => {
  if (!rows.length) return [];
  const points = rows.map((row) => ({ x: Number(row.x), y: bcGraphMeasure(row, scale), point: true, row }));
  const first = rows[0];
  const last = rows[rows.length - 1];
  const start = Number.isFinite(first.polygonStart) ? first.polygonStart : Number.isFinite(first.lower) ? first.lower : Number(first.x);
  const end = Number.isFinite(last.polygonEnd) ? last.polygonEnd : Number.isFinite(last.upper) ? last.upper : Number(last.x);
  return [{ x: start, y: 0, point: false }].concat(points, [{ x: end, y: 0, point: false }]);
}

bcGraphPolygonInterpolatedY = (rows, scale, targetX) => {
  const points = bcGraphPolygonPoints(rows, scale)
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((a, b) => a.x - b.x);

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (targetX === point.x) return point.y;

    const next = points[index + 1];
    if (!next || targetX < point.x || targetX > next.x) continue;
    if (next.x === point.x) return point.y;

    const fraction = (targetX - point.x) / (next.x - point.x);
    return point.y + fraction * (next.y - point.y);
  }

  return undefined;
}

bcGraphAddPolygonInterpolationGuides = (svg, opts, series, scale, x, y, margin, height) => {
  const rawGuides = opts.interpolationGuides;
  if (rawGuides === undefined || rawGuides === null) return;

  const guideSpecs = (Array.isArray(rawGuides) ? rawGuides : [rawGuides])
    .map((guide) => typeof guide === "number" ? { x: guide } : guide)
    .filter((guide) => guide && typeof guide === "object");
  const color = bcGraphValueOr(
    opts.interpolationGuideColor,
    "color-mix(in srgb, var(--bc-danger-color, #c63f3f) 78%, var(--bc-text, #212529))"
  );
  const dash = bcGraphValueOr(opts.interpolationGuideDash, "6 4");
  const strokeWidth = bcGraphValueOr(opts.interpolationGuideStrokeWidth, 1.8);
  const animationRequested = opts.animateInterpolationGuides === true;
  const animationEnabled = animationRequested && !bcGraphPrefersReducedMotion();
  const duration = bcGraphValueOr(opts.interpolationGuideAnimationDuration, 650);
  const pause = bcGraphValueOr(opts.interpolationGuideAnimationPause, 100);
  const ease = bcGraphEaseFactory(opts.interpolationGuideAnimationEase, d3.easeCubicInOut);
  const plotBottom = height - margin.bottom;
  const resolvedGuides = guideSpecs.map((guide) => {
    const targetX = bcGraphFiniteNumber(guide.x);
    if (!Number.isFinite(targetX)) return null;

    const seriesIndex = Math.max(0, Math.round(bcGraphFiniteNumber(guide.seriesIndex) || 0));
    const targetSeries = series[seriesIndex];
    const explicitY = bcGraphFiniteNumber(guide.y);
    const targetY = explicitY === undefined && targetSeries
      ? bcGraphPolygonInterpolatedY(targetSeries.rows, scale, targetX)
      : explicitY;

    if (!Number.isFinite(targetY)) return null;
    if (targetX < Math.min(...x.domain()) || targetX > Math.max(...x.domain())) return null;
    if (targetY < Math.min(...y.domain()) || targetY > Math.max(...y.domain())) return null;

    return {
      targetX,
      targetY,
      xPixel: x(targetX),
      yPixel: y(targetY),
      xLabel: bcGraphValueOr(guide.xLabel, targetX),
      label: guide.label
    };
  }).filter(Boolean);

  if (!resolvedGuides.length) return;

  const guideGroups = svg.append("g")
    .attr("class", "bc-graph-interpolation-guides")
    .attr("aria-hidden", "true")
    .selectAll("g")
    .data(resolvedGuides)
    .join("g")
      .attr("class", "bc-graph-interpolation-guide");

  const verticals = guideGroups.append("line")
    .attr("class", "bc-graph-interpolation-guide-line bc-graph-interpolation-guide-vertical")
    .attr("x1", (d) => d.xPixel)
    .attr("x2", (d) => d.xPixel)
    .attr("y1", plotBottom)
    .attr("y2", (d) => animationEnabled ? plotBottom : d.yPixel)
    .attr("stroke", color)
    .attr("stroke-width", strokeWidth)
    .attr("stroke-dasharray", dash)
    .attr("vector-effect", "non-scaling-stroke");

  const horizontals = guideGroups.append("line")
    .attr("class", "bc-graph-interpolation-guide-line bc-graph-interpolation-guide-horizontal")
    .attr("x1", (d) => d.xPixel)
    .attr("x2", (d) => animationEnabled ? d.xPixel : margin.left)
    .attr("y1", (d) => d.yPixel)
    .attr("y2", (d) => d.yPixel)
    .attr("stroke", color)
    .attr("stroke-width", strokeWidth)
    .attr("stroke-dasharray", dash)
    .attr("vector-effect", "non-scaling-stroke");

  const markers = guideGroups.append("circle")
    .attr("class", "bc-graph-interpolation-guide-marker")
    .attr("cx", (d) => d.xPixel)
    .attr("cy", (d) => d.yPixel)
    .attr("r", bcGraphValueOr(opts.interpolationGuidePointRadius, 4))
    .attr("fill", "var(--bc-bg, #fff)")
    .attr("stroke", color)
    .attr("stroke-width", 2)
    .attr("vector-effect", "non-scaling-stroke")
    .style("opacity", animationEnabled ? 0 : 1);

  guideGroups.append("line")
    .attr("class", "bc-graph-interpolation-guide-tick")
    .attr("x1", (d) => d.xPixel)
    .attr("x2", (d) => d.xPixel)
    .attr("y1", plotBottom)
    .attr("y2", plotBottom + 6)
    .attr("stroke", color)
    .attr("stroke-width", 1.8)
    .attr("vector-effect", "non-scaling-stroke");

  guideGroups.append("text")
    .attr("class", "bc-graph-tick-label bc-graph-interpolation-guide-label")
    .attr("x", (d) => d.xPixel)
    .attr("y", plotBottom + 21)
    .attr("text-anchor", "middle")
    .style("fill", color)
    .attr("font-weight", 700)
    .text((d) => d.xLabel);

  guideGroups.filter((d) => d.label).append("title").text((d) => d.label);

  if (!animationEnabled) return;

  const play = () => {
    verticals.interrupt()
      .attr("y2", plotBottom)
      .transition()
      .duration(duration)
      .ease(ease)
      .attr("y2", (d) => d.yPixel);

    markers.interrupt()
      .style("opacity", 0)
      .transition()
      .delay(Math.max(0, duration - 80))
      .duration(120)
      .style("opacity", 1);

    horizontals.interrupt()
      .attr("x2", (d) => d.xPixel)
      .transition()
      .delay(duration + pause)
      .duration(duration)
      .ease(ease)
      .attr("x2", margin.left);
  };

  bcGraphPlayEntrance(
    svg,
    bcGraphValueOr(opts.interpolationGuideAnimationThreshold, 0.95),
    play,
    "interpolation-guides"
  );
}

bcGraphMakePolygon = (opts = {}) => {
  const type = "polygon";
  const series = bcGraphSeriesData(opts, type);
  const scale = bcGraphValueOr(opts.scale, "frequency");
  const margin = bcGraphResolveMargin(opts);
  const xDomain = bcGraphLinearDomain(series, opts, type);
  const yDomain = d3.scaleLinear()
    .domain(bcGraphYDomain(series, opts, scale))
    .nice()
    .domain();
  const dimensions = bcGraphDimensionsForLinearScales(opts, type, xDomain, yDomain, margin);
  const { width, height } = dimensions;
  const svg = bcGraphCreateSvg(opts, type, dimensions);
  const x = d3.scaleLinear()
    .domain(xDomain)
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain(yDomain)
    .range([height - margin.bottom, margin.top]);
  const line = d3.line()
    .x((d) => x(d.x))
    .y((d) => y(d.y));

  bcGraphDrawGrid(svg, y, opts, margin, width, scale);

  const entrance = bcGraphEntranceOptions(opts);

  const groups = svg.append("g")
    .attr("class", "bc-graph-polygons")
    .selectAll("g")
    .data(series)
    .join("g")
      .attr("class", "bc-graph-polygon-series");

  const lines = groups.append("path")
    .attr("class", "bc-graph-line")
    .attr("fill", "none")
    .style("stroke", (d, i) => bcGraphSeriesStroke(d, opts, i, bcGraphDefaultColors[i % bcGraphDefaultColors.length]))
    .attr("stroke-width", bcGraphValueOr(opts.strokeWidth, 2))
    .attr("stroke-dasharray", (d, i) => d.dash || (opts.dashed && i > 0 ? "6 4" : null))
    .attr("d", (d) => line(bcGraphPolygonPoints(d.rows, scale)));

  // Reveals grow a clip rect left-to-right in plot pixel space rather than
  // drawing via stroke-dasharray/dashoffset — see bcGraphRevealClips for why.
  const revealLeft = margin.left;
  const revealWidth = Math.max(0, width - margin.left - margin.right);
  const clipRects = entrance.enabled ? bcGraphRevealClips(svg, lines, revealLeft, 0, revealWidth, height) : null;

  let points = null;
  if (bcGraphValueOr(opts.points, true)) {
    points = groups.selectAll("circle")
      .data((d, i) => bcGraphPolygonPoints(d.rows, scale)
        .filter((point) => point.point)
        .map((point) => Object.assign({}, point, {
          series: d,
          seriesIndex: i,
          fraction: revealWidth ? (x(point.x) - revealLeft) / revealWidth : 0
        })))
      .join("circle")
        .attr("class", "bc-graph-point")
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", bcGraphValueOr(opts.pointRadius, 3))
        .style("fill", (d) => d.series.color || bcGraphDefaultColors[d.seriesIndex % bcGraphDefaultColors.length])
        .style("opacity", entrance.enabled ? 0 : null);

    points.append("title")
      .text((d) => `${bcGraphIntervalLabel(d.row)}: ${d.row.frequency}`);
  }

  if (entrance.enabled) {
    const ease = bcGraphEaseFactory(entrance.ease, d3.easeLinear);
    const play = () => {
      clipRects.forEach((rect, seriesIndex) => {
        rect.interrupt()
          .attr("width", 0)
          .transition()
          .duration(entrance.duration)
          .delay(seriesIndex * entrance.seriesDelay)
          .ease(ease)
          .attr("width", revealWidth);
      });
      if (points) {
        // A linear reveal rate means elapsed-time-fraction and x-position-
        // fraction are the same thing, so a point's own x-fraction across
        // the plot is exactly when the reveal reaches it.
        points.interrupt()
          .style("opacity", 0)
          .transition()
          .duration(120)
          .delay((d) => d.seriesIndex * entrance.seriesDelay + d.fraction * entrance.duration)
          .style("opacity", 1);
      }
    };
    bcGraphPlayEntrance(svg, entrance.threshold, play);
  }

  const xAxis = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(bcGraphBottomAxis(x, opts));
  const yAxis = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(bcGraphLeftAxis(y, opts, scale));
  bcGraphStyleAxis(xAxis);
  bcGraphStyleAxis(yAxis);

  bcGraphAddPolygonInterpolationGuides(svg, opts, series, scale, x, y, margin, height);

  bcGraphAddLabels(svg, opts, type, margin, width, height, scale);
  bcGraphAddLegend(svg, series, opts, width, margin);
  return svg.node();
}

bcGraphMakeCurve = (opts = {}) => {
  const type = "curve";
  const series = bcGraphCurveSeriesData(opts);
  const margin = bcGraphResolveMargin(opts);
  const allRows = series.flatMap((s) => s.rows);
  const xExtent = d3.extent(allRows, (row) => row.x);
  const xDomain = opts.xDomain || opts.domain || (allRows.length ? xExtent : [0, 1]);
  const yDomain = d3.scaleLinear()
    .domain(opts.yDomain || [0, d3.max(allRows, (row) => row.y) || 1])
    .nice()
    .domain();
  const dimensions = bcGraphDimensionsForLinearScales(opts, type, xDomain, yDomain, margin);
  const { width, height } = dimensions;
  const svg = bcGraphCreateSvg(opts, type, dimensions);
  const x = d3.scaleLinear()
    .domain(xDomain)
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain(yDomain)
    .range([height - margin.bottom, margin.top]);
  const curveFactory = bcGraphCurveFactory(opts);
  const line = d3.line()
    .curve(curveFactory)
    .x((d) => x(d.x))
    .y((d) => y(d.y));
  const area = d3.area()
    .curve(curveFactory)
    .x((d) => x(d.x))
    .y0(y(0))
    .y1((d) => y(d.y));

  bcGraphDrawGrid(svg, y, opts, margin, width, bcGraphValueOr(opts.scale, "proportion"));

  const entrance = bcGraphEntranceOptions(opts);

  const groups = svg.append("g")
    .attr("class", "bc-graph-curves")
    .selectAll("g")
    .data(series)
    .join("g")
      .attr("class", "bc-graph-curve-series");

  let areas = null;
  if (bcGraphValueOr(opts.area, false)) {
    areas = groups.append("path")
      .attr("class", "bc-graph-area")
      .attr("fill", (d, i) => d.color || bcGraphDefaultColors[i % bcGraphDefaultColors.length])
      .attr("d", (d) => area(d.rows))
      .style("opacity", entrance.enabled ? 0 : null);
  }

  const lines = groups.append("path")
    .attr("class", "bc-graph-line")
    .attr("fill", "none")
    .style("stroke", (d, i) => bcGraphSeriesStroke(d, opts, i, bcGraphDefaultColors[i % bcGraphDefaultColors.length]))
    .attr("stroke-width", bcGraphValueOr(opts.strokeWidth, 2))
    .attr("d", (d) => line(d.rows));

  // Reveals grow a clip rect left-to-right in plot pixel space rather than
  // drawing via stroke-dasharray/dashoffset — see bcGraphRevealClips for why.
  const revealLeft = margin.left;
  const revealWidth = Math.max(0, width - margin.left - margin.right);
  const clipRects = entrance.enabled ? bcGraphRevealClips(svg, lines, revealLeft, 0, revealWidth, height) : null;

  if (entrance.enabled) {
    const ease = bcGraphEaseFactory(entrance.ease, d3.easeLinear);
    const play = () => {
      clipRects.forEach((rect, seriesIndex) => {
        rect.interrupt()
          .attr("width", 0)
          .transition()
          .duration(entrance.duration)
          .delay(seriesIndex * entrance.seriesDelay)
          .ease(ease)
          .attr("width", revealWidth);
      });
      if (areas) {
        areas.interrupt()
          .style("opacity", 0)
          .transition()
          .duration(entrance.duration * 0.6)
          .delay((d, i) => i * entrance.seriesDelay + entrance.duration * 0.4)
          .style("opacity", 1);
      }
    };
    bcGraphPlayEntrance(svg, entrance.threshold, play);
  }

  const xAxis = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(bcGraphBottomAxis(x, opts));
  const yAxis = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(bcGraphLeftAxis(y, opts, bcGraphValueOr(opts.scale, "proportion")));
  bcGraphStyleAxis(xAxis);
  bcGraphStyleAxis(yAxis);

  bcGraphAddLabels(svg, opts, type, margin, width, height, bcGraphValueOr(opts.scale, "proportion"));
  bcGraphAddLegend(svg, series, opts, width, margin);
  return svg.node();
}

bcGraphRender = (opts = {}) => {
  const type = bcGraphNormalizeType(opts.type || opts.graphType);
  if (type === "bar") return bcGraphMakeBarGraph(opts, type);
  if (type === "polygon") return bcGraphMakePolygon(opts);
  if (type === "curve") return bcGraphMakeCurve(opts);
  return bcGraphMakeHistogram(opts, type);
}

bcGraphParsePixels = (value) => {
  if (typeof value === "number") return bcGraphPositiveNumber(value);
  const match = /^\s*([\d.]+)px\s*$/.exec(String(value === undefined ? "" : value));
  return match ? bcGraphPositiveNumber(Number(match[1])) : undefined;
}

// The figure is drawn once at its authored size so it is complete the moment
// it mounts, then redrawn to the width it actually occupies. Redrawing (rather
// than letting CSS scale a fixed viewBox) is what keeps tick labels, axis
// labels, and titles at the size the stylesheet asked for on every screen:
// inside a scaled viewBox, 0.8125rem of tick text renders at 15 px in a wide
// column and 7 px on a phone. Pass responsive:false to opt a figure out.
bcGraphObserveWidth = (node, opts, redraw) => {
  const api = window.interactiveFigure;
  if (!api || typeof api.observeResponsiveLayout !== "function") return;

  const type = bcGraphNormalizeType(opts.type || opts.graphType);
  const viewBox = node.viewBox && node.viewBox.baseVal;
  const drawn = {
    width: (viewBox && viewBox.width) || bcGraphPositiveNumber(opts.width) || 640,
    height: (viewBox && viewBox.height) || bcGraphPositiveNumber(opts.height) || 420
  };
  const cssCap = bcGraphParsePixels(opts.maxWidth);
  const maximumWidth = Math.max(240, cssCap || bcGraphValueOr(opts.maximumWidth, 1600));
  // Height is only passed along when the figure isn't already deriving it: an
  // aspect ratio or an equal-scales rule recomputes height from the new width
  // on its own, and overriding it there would square up what should stay
  // proportional. Everything else keeps the aspect ratio it was drawn with, so
  // narrowing a figure reshapes it exactly as CSS scaling used to — only the
  // text now holds its size instead of shrinking with the box.
  const bothAuthored = bcGraphPositiveNumber(opts.width) !== undefined &&
    bcGraphPositiveNumber(opts.height) !== undefined;
  const derivesHeight = !bothAuthored && (
    bcGraphResolveSvgAspectRatio(opts) !== undefined ||
    bcGraphResolveScaleAspectRatio(opts, type) !== undefined
  );
  let drawnWidth = drawn.width;
  let firstLayout = true;
  let attempts = 0;

  const attach = () => {
    const container = node.parentElement;
    if (!container) {
      attempts += 1;
      if (attempts < 60) window.requestAnimationFrame(attach);
      return;
    }
    api.observeResponsiveLayout({
      root: node,
      container,
      minimumWidth: 240,
      maximumWidth,
      widthStep: 4,
      onLayout(layout) {
        const width = Math.round(layout.width);
        const wasFirst = firstLayout;
        firstLayout = false;
        if (width === Math.round(drawnWidth)) return;
        drawnWidth = width;
        // The first redraw usually happens before the reader has scrolled the
        // figure into view, so it keeps the authored entrance animation; later
        // ones are resizes of an animation that has already played.
        const next = Object.assign({}, opts, {
          width,
          svgNode: node,
          animate: wasFirst ? opts.animate : false
        });
        if (!derivesHeight) {
          next.height = Math.round(drawn.height * (width / drawn.width));
        }
        redraw(next);
      }
    });
  };

  window.requestAnimationFrame(attach);
}

makeGraph = (opts = {}) => {
  const node = bcGraphRender(opts);
  if (opts.responsive === false || !node || node.tagName !== "svg") return node;
  bcGraphObserveWidth(node, opts, bcGraphRender);
  return node;
}

bcToneIdentificationData = [
  { lower: 0.3, upper: 0.3467, frequency: 4 },
  { lower: 0.3467, upper: 0.3933, frequency: 3 },
  { lower: 0.3933, upper: 0.44, frequency: 12 },
  { lower: 0.44, upper: 0.4867, frequency: 22 },
  { lower: 0.4867, upper: 0.5333, frequency: 40 },
  { lower: 0.5333, upper: 0.58, frequency: 29 },
  { lower: 0.58, upper: 0.6267, frequency: 32 },
  { lower: 0.6267, upper: 0.6733, frequency: 20 },
  { lower: 0.6733, upper: 0.72, frequency: 13 },
  { lower: 0.72, upper: 0.7667, frequency: 11 },
  { lower: 0.7667, upper: 0.8133, frequency: 9 },
  { lower: 0.8133, upper: 0.86, frequency: 10 },
  { lower: 0.86, upper: 0.9067, frequency: 17 },
  { lower: 0.9067, upper: 0.9533, frequency: 20 },
  { lower: 0.9533, upper: 1, frequency: 33 }
]

bcToneIdentificationGroupedCenters = (data = bcToneIdentificationData) => {
  const total = data.reduce((sum, bin) => sum + bin.frequency, 0);
  const mean = data.reduce(
    (sum, bin) => sum + ((bin.lower + bin.upper) / 2) * bin.frequency,
    0
  ) / total;
  const middle = total / 2;
  let cumulative = 0;
  let median = NaN;

  for (const bin of data) {
    if (cumulative + bin.frequency >= middle) {
      const fractionThroughBin = (middle - cumulative) / bin.frequency;
      median = bin.lower + fractionThroughBin * (bin.upper - bin.lower);
      break;
    }
    cumulative += bin.frequency;
  }

  return { total, mean, median };
}

makeToneIdentificationGraph = (opts = {}) => {
  const showCenters = opts.showCenters === true;
  const data = Array.isArray(opts.data) ? opts.data : bcToneIdentificationData;
  const centers = bcToneIdentificationGroupedCenters(data);
  const defaults = {
    type: "histogram",
    width: 760,
    height: 500,
    maxWidth: "760px",
    cssMargin: "0 auto",
    margin: { top: 22, right: 22, bottom: 70, left: 72 },
    data,
    xDomain: [0.3, 1],
    xTickValues: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    yDomain: [0, 40],
    yTickValues: [0, 5, 10, 15, 20, 25, 30, 35, 40],
    labels: {
      x: "Proportion correct in test phase",
      y: "Number of participants"
    },
    ariaLabel: showCenters
      ? `Histogram of test performance for ${centers.total} listeners, with an estimated median of ${centers.median.toFixed(2)} and mean of ${centers.mean.toFixed(2)}. Scores form one peak near chance performance and another near perfect performance.`
      : `Histogram of test performance for ${centers.total} listeners. Scores form one peak near chance performance and another near perfect performance.`
  };
  const config = Object.assign({}, defaults, opts, {
    data,
    labels: Object.assign({}, defaults.labels, opts.labels || {})
  });

  if (showCenters && config.referenceMarkers === undefined) {
    config.referenceMarkers = [
      {
        label: `Median ≈ ${centers.median.toFixed(2)}`,
        value: centers.median,
        color: "var(--graph-series-3, #009e73)",
        anchor: "end",
        dx: -6
      },
      {
        label: `Mean ≈ ${centers.mean.toFixed(2)}`,
        value: centers.mean,
        color: "var(--bc-danger-color, #c63f3f)",
        anchor: "start",
        dx: 6
      }
    ];
  }

  return makeGraph(config);
}

bcGraphAppendTableHeader = (cell, value) => {
  if (value && typeof value.nodeType === "number") {
    cell.appendChild(value);
    return;
  }

  const source = String(value === undefined || value === null ? "" : value);
  const mathPattern = /\$([^$]+)\$/g;
  const api = window.interactiveFigure;
  if (!api || typeof api.inlineMath !== "function" || !mathPattern.test(source)) {
    cell.textContent = source.replace(mathPattern, "$1");
    return;
  }

  mathPattern.lastIndex = 0;
  let cursor = 0;
  let match = mathPattern.exec(source);
  while (match) {
    if (match.index > cursor) {
      cell.appendChild(document.createTextNode(source.slice(cursor, match.index)));
    }
    cell.appendChild(api.inlineMath(match[1]));
    cursor = match.index + match[0].length;
    match = mathPattern.exec(source);
  }
  if (cursor < source.length) {
    cell.appendChild(document.createTextNode(source.slice(cursor)));
  }
}

makeApprovalBlockHistogram = (opts = {}) => {
  const responseLabels = {
    1: "Approve",
    2: "Disapprove",
    3: "No opinion"
  };
  const defaults = {
    type: "block",
    data: [
      { x: 1, label: responseLabels[1], frequency: 81 },
      { x: 2, label: responseLabels[2], frequency: 8 },
      { x: 3, label: responseLabels[3], frequency: 11 }
    ],
    xDomain: [0.25, 3.5],
    yDomain: [0, 83],
    xTickValues: [1, 2, 3],
    yTickValues: [],
    yAxisLine: false,
    width: 640,
    height: 420,
    maxWidth: "640px",
    cssMargin: "0 auto",
    margin: { top: 28, right: 22, bottom: 68, left: 62 },
    barGap: 24,
    blockGap: 0.35,
    blockStroke: "var(--bc-control-bg)",
    blockFill: "var(--bc-text)",
    blockFallOrder: "random",
    blockFallSeed: "approval-paper-stacks-v8",
    // blockFallOriginX: "center",
    animate: true,
    ariaLabel: "Block histogram representing 100 survey responses: 81 approve, 8 disapprove, and 11 no opinion. Each thin box represents one paper survey."
  };
  const config = Object.assign({}, defaults, opts, {
    labels: Object.assign({
      x: "Opinion",
      y: "Paper surveys"
    }, opts.labels || {})
  });

  if (typeof config.xTickFormat !== "function") {
    config.xTickFormat = (value) => responseLabels[value] || value;
  }

  // The 18/19 px overrides this used to carry existed only to cancel out the
  // downscaling of a fixed viewBox; the axis text now renders at the shared
  // figure sizes, so the class is all that is left to apply.
  config.className = "approval-block-histogram";
  return makeGraph(config);
}

makeFrequencyTable = (opts = {}) => {
  const rows = frequencyTable(opts);
  const formatter = opts.format || d3.format("~g");
  const percentFormatter = opts.percentFormat || d3.format(".1f");
  const columns = opts.columns || [
    "label",
    "frequency"
  ].concat(opts.proportion ? ["proportion"] : [], opts.percent ? ["percent"] : [], opts.cumulative ? ["cumulativePercent"] : []);
  const headers = Object.assign({
    label: opts.variable || "X",
    frequency: "$f$",
    proportion: "$p$",
    percent: "%",
    cumulativeFrequency: "cumulative $f$",
    cumulativePercent: "cumulative %"
  }, opts.headers || {});

  const table = d3.create("table")
    .attr("class", "bc-frequency-table table table-sm");

  if (opts.ariaLabel) table.attr("aria-label", opts.ariaLabel);
  if (opts.caption) table.append("caption").text(opts.caption);

  table.append("thead")
    .append("tr")
    .selectAll("th")
    .data(columns)
    .join("th")
      .attr("scope", "col")
      .attr("data-frequency-column", (column) => column)
      .each(function(column) {
        bcGraphAppendTableHeader(this, headers[column] || column);
      });

  table.append("tbody")
    .selectAll("tr")
    .data(rows)
    .join("tr")
    .attr("data-frequency-key", (row) => row.key)
    .selectAll("td")
    .data((row) => columns.map((column) => ({ column, row })))
    .join("td")
      .attr("data-frequency-column", (d) => d.column)
      .text((d) => {
        if (d.column === "label") return bcGraphIntervalLabel(d.row, formatter);
        if (d.column === "percent" || d.column === "cumulativePercent") return percentFormatter(d.row[d.column]);
        if (d.column === "proportion" || d.column === "cumulativeProportion") return d3.format(".3f")(d.row[d.column]);
        return formatter(d.row[d.column]);
      });

  const tableNode = table.node();
  tableNode.frequencyRows = rows;
  tableNode.frequencyColumns = columns.slice();
  return tableNode;
}

bcGraphCloneWithComputedStyles = (svgNode) => {
  const clone = svgNode.cloneNode(true);
  const originalElements = [svgNode].concat(Array.from(svgNode.querySelectorAll("*")));
  const clonedElements = [clone].concat(Array.from(clone.querySelectorAll("*")));
  const properties = [
    "display",
    "fill",
    "fill-opacity",
    "font-family",
    "font-size",
    "font-weight",
    "opacity",
    "stroke",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-opacity",
    "stroke-width",
    "text-anchor",
    "vector-effect"
  ];

  originalElements.forEach((element, index) => {
    const computed = getComputedStyle(element);
    const computedStyle = properties
      .map((property) => `${property}:${computed.getPropertyValue(property)}`)
      .join(";");
    const existingStyle = clonedElements[index].getAttribute("style") || "";
    clonedElements[index].setAttribute("style", `${existingStyle};${computedStyle}`);
  });

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return clone;
}

graphSvgToDataUrl = async (svgNode, opts = {}) => {
  const serializer = new XMLSerializer();
  const exportNode = bcGraphCloneWithComputedStyles(svgNode);
  const svgText = serializer.serializeToString(exportNode);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  const scale = bcGraphValueOr(opts.scale, 2);
  const viewBox = svgNode.viewBox.baseVal;
  const width = bcGraphValueOr(opts.width, viewBox && viewBox.width ? viewBox.width : svgNode.clientWidth || 640);
  const height = bcGraphValueOr(opts.height, viewBox && viewBox.height ? viewBox.height : svgNode.clientHeight || 420);

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (opts.background) {
    context.fillStyle = opts.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(svgUrl);
  return canvas.toDataURL(opts.type || "image/png");
}

downloadGraph = async (svgNode, opts = {}) => {
  const format = opts.format || "svg";
  const fileName = opts.fileName || `frequency-graph.${format}`;
  const link = document.createElement("a");

  if (format === "png") {
    link.href = await graphSvgToDataUrl(svgNode, opts);
  } else {
    const serializer = new XMLSerializer();
    const exportNode = opts.inlineStyles === false ? svgNode : bcGraphCloneWithComputedStyles(svgNode);
    const svgText = serializer.serializeToString(exportNode);
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    link.href = URL.createObjectURL(blob);
  }

  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

bcGraphApi = (() => {
  const api = {
    makeGraph,
    makeToneIdentificationGraph,
    frequencyTable,
    makeFrequencyTable,
    graphSvgToDataUrl,
    downloadGraph
  };
  window.bcGraphs = api;
  return api;
})()
