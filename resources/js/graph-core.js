// See resources/js/GRAPHS.md for module boundaries and compatibility.
sfsGraphNormalPdf = (x, mean = 0, sd = 1) => {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

sfsGraphDefaultColors = [
  "var(--graph-series-1, var(--graph-line-color, #0072b2))",
  "var(--graph-series-2, #e69f00)",
  "var(--graph-series-3, #009e73)",
  "var(--graph-series-4, #d55e00)",
  "var(--graph-series-5, #cc79a7)",
  "var(--graph-series-6, #56b4e9)",
  "var(--graph-series-7, #f0e442)"
]

sfsGraphMedalFills = ({
  Gold: "var(--graph-medal-gold, #d4af37)",
  Silver: "var(--graph-medal-silver, #b8bcc2)",
  Bronze: "var(--graph-medal-bronze, #b08d57)"
})

sfsGraphValueOr = (value, fallback) =>
  value === undefined || value === null ? fallback : value

sfsGraphFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

sfsGraphPositiveNumber = (value) => {
  const number = sfsGraphFiniteNumber(value);
  return number > 0 ? number : undefined;
}

sfsGraphParseAspectRatio = (raw) => {
  if (raw === false || raw === "auto") return undefined;

  if (Array.isArray(raw) && raw.length >= 2) {
    const width = sfsGraphPositiveNumber(raw[0]);
    const height = sfsGraphPositiveNumber(raw[1]);
    return width && height ? width / height : undefined;
  }

  if (typeof raw === "string") {
    const parts = raw.trim().split(/[:/]/).map((part) => sfsGraphPositiveNumber(part));
    if (parts.length >= 2 && parts[0] && parts[1]) return parts[0] / parts[1];
  }

  return sfsGraphPositiveNumber(raw);
}

sfsGraphResolveScaleAspectRatio = (opts = {}, type = "histogram") => {
  const hasAspectRatio = opts.scaleRatio !== undefined ||
    opts.scaleAspectRatio !== undefined ||
    opts.coordinateAspectRatio !== undefined ||
    opts.coordRatio !== undefined ||
    opts.equalScales !== undefined;

  if (opts.equalScales === true) return 1;
  if (opts.equalScales === false) return undefined;
  if (!hasAspectRatio) return type === "block" ? 1 : undefined;

  const raw = sfsGraphValueOr(
    opts.scaleRatio,
    sfsGraphValueOr(opts.scaleAspectRatio, sfsGraphValueOr(opts.coordinateAspectRatio, opts.coordRatio))
  );
  return sfsGraphParseAspectRatio(raw);
}

sfsGraphResolveSvgAspectRatio = (opts = {}) => {
  const raw = sfsGraphValueOr(
    opts.aspectRatio,
    sfsGraphValueOr(opts.svgAspectRatio, sfsGraphValueOr(opts.imageAspectRatio, opts.figureAspectRatio))
  );
  return sfsGraphParseAspectRatio(raw);
}

sfsGraphDimensions = (opts = {}, type = "histogram") => {
  const widthValue = sfsGraphPositiveNumber(opts.width);
  const heightValue = sfsGraphPositiveNumber(opts.height);
  const aspectRatio = sfsGraphResolveSvgAspectRatio(opts);
  const hasWidth = widthValue !== undefined;
  const hasHeight = heightValue !== undefined;
  const width = widthValue || 640;
  const height = heightValue || 420;

  if (!aspectRatio || (hasWidth && hasHeight)) return { width, height, aspectRatio };
  if (hasHeight && !hasWidth) return { width: height * aspectRatio, height, aspectRatio };
  return { width, height: width / aspectRatio, aspectRatio };
}

sfsGraphDomainSpan = (domain) => {
  const start = domain ? Number(domain[0]) : NaN;
  const end = domain ? Number(domain[1]) : NaN;
  const span = Math.abs(end - start);
  return Number.isFinite(span) && span > 0 ? span : undefined;
}

sfsGraphDimensionsForLinearScales = (opts = {}, type = "histogram", xDomain, yDomain, margin) => {
  const dimensions = sfsGraphDimensions(opts, type);
  const aspectRatio = sfsGraphResolveScaleAspectRatio(opts, type);
  const xSpan = sfsGraphDomainSpan(xDomain);
  const ySpan = sfsGraphDomainSpan(yDomain);
  const widthValue = sfsGraphPositiveNumber(opts.width);
  const heightValue = sfsGraphPositiveNumber(opts.height);
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

sfsGraphAsArray = (data, fallback = []) => {
  const source = sfsGraphValueOr(data, fallback);
  if (Array.isArray(source)) return source.slice();
  if (source instanceof Map) {
    return Array.from(source, ([x, frequency]) => ({ x, frequency }));
  }
  if (source && typeof source === "object") {
    return Object.entries(source).map(([x, frequency]) => ({ x, frequency }));
  }
  return [];
}

sfsGraphAccessor = (accessor, fallbackKeys = []) => {
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

sfsGraphFirstDefined = (row, keys) => {
  if (row == null || typeof row !== "object") return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return undefined;
}

sfsGraphNormalizeType = (type) => {
  const value = String(type || "histogram").toLowerCase().replace(/[_ ]+/g, "-");
  if (["hist", "histogram"].includes(value)) return "histogram";
  if (["block", "blocks", "block-hist", "block-histogram", "block-histograph"].includes(value)) return "block";
  if (["bar", "bar-chart", "bar-graph"].includes(value)) return "bar";
  if (["poly", "polygon", "freq-poly", "frequency-poly", "frequency-polygon"].includes(value)) return "polygon";
  if (["curve", "smooth", "smooth-curve", "frequency-curve", "density"].includes(value)) return "curve";
  return value;
}

sfsGraphCurveFactory = (opts = {}) => {
  const curve = sfsGraphValueOr(opts.interpolation, sfsGraphValueOr(opts.curveFactory, opts.curve));
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

sfsGraphDefaultYLabel = (type, scale) => {
  if (scale === "percent") return "Percent";
  if (scale === "proportion") return "Proportion";
  return type === "curve" ? "Proportion" : "Frequency";
}

sfsGraphFormatInterval = (lower, upper, formatter) =>
  `${formatter(lower)}-${formatter(upper)}`

sfsGraphIntervalLabel = (row, formatter = (d) => d) => {
  if (row.label !== undefined && row.label !== null) return String(row.label);
  if (row.lower !== undefined && row.upper !== undefined) {
    return sfsGraphFormatInterval(row.lower, row.upper, formatter);
  }
  return String(row.x);
}

sfsGraphCreateSvg = (opts = {}, type = "histogram", dimensions = sfsGraphDimensions(opts, type)) => {
  const { width, height } = dimensions;
  const labels = opts.labels || {};
  const title = sfsGraphValueOr(opts.title, labels.title);
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
    .classed("sfs-graph", true)
    .classed(`sfs-graph-${type}`, true)
    .style("width", sfsGraphValueOr(opts.cssWidth, "100%"))
    .style("max-width", sfsGraphValueOr(opts.maxWidth, "100%"))
    .style("height", "auto")
    .style("display", "block");

  if (opts.className) svg.classed(opts.className, true);
  if (opts.cssMargin !== undefined) svg.style("margin", opts.cssMargin);
  svg.append("title").text(ariaLabel);
  return svg;
}

// Axis furniture keeps a fixed CSS font size while responsive graphs redraw at
// their actual width. Give compact charts correspondingly tighter default
// reserves, then ease back to the established roomy defaults as space returns.
// Explicit margins remain exact, so unusually wide tick labels can still claim
// whatever room they need.
sfsGraphFluidDefault = (width, compact, roomy) => {
  const compactWidth = 240;
  const roomyWidth = 480;
  const progress = Math.max(0, Math.min(1,
    (Number(width) - compactWidth) / (roomyWidth - compactWidth)
  ));
  return Math.round(compact + (roomy - compact) * progress);
}

sfsGraphDefaultLeftMargin = (opts, width) => {
  const values = opts.yTickValues !== undefined
    ? opts.yTickValues
    : Array.isArray(opts.yTicks) ? opts.yTicks : null;
  if (!Array.isArray(values) || !values.length) return 64;

  const formatter = typeof (opts.yTickFormat || opts.yFormat) === "function"
    ? opts.yTickFormat || opts.yFormat
    : String;
  const widest = values.reduce((length, value) =>
    Math.max(length, String(formatter(value)).length), 1);
  // A one-character tick fits comfortably beside the y title in 48 px. Each
  // extra character claims roughly one tick-font character of additional room;
  // longer labels retain the established 64 px reserve even on a narrow chart.
  const compact = Math.min(64, 48 + (widest - 1) * 7);
  return sfsGraphFluidDefault(width, compact, 64);
}

sfsGraphResolveMargin = (opts = {}) => {
  const margin = opts.margin || {};
  const width = sfsGraphDimensions(opts).width;
  return {
    top: sfsGraphValueOr(margin.top, opts.title || (opts.labels && opts.labels.title) ? 42 : 22),
    right: sfsGraphValueOr(margin.right, 22),
    bottom: sfsGraphValueOr(margin.bottom, sfsGraphFluidDefault(width, 48, 58)),
    left: sfsGraphValueOr(margin.left, sfsGraphDefaultLeftMargin(opts, width))
  };
}

sfsGraphStyleAxis = (axis) => {
  axis.attr("class", function() {
      return `${this.getAttribute("class") || ""} sfs-graph-axis`;
    })
    .call((g) => g.selectAll("text").attr("class", "sfs-graph-tick-label"))
    .call((g) => g.selectAll("line").attr("class", "sfs-graph-tick-line"))
    .call((g) => g.selectAll("path").attr("class", "sfs-graph-domain"));
}

sfsGraphAllIntegers = (values) =>
  Array.isArray(values) &&
  values.length > 0 &&
  values.every((value) => Number.isInteger(Number(value)));

// Every x value the figure was built from, so the axis can tell a discrete
// score scale from a continuous measurement. Bin objects contribute their own
// boundaries; anything non-numeric (a nominal category) disqualifies the set.
sfsGraphXValueSample = (opts = {}) => {
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
        values.push(sfsGraphValueOr(entry.x, entry.value));
      }
    } else {
      values.push(entry);
    }
  }));

  return values.filter((value) => value !== undefined && value !== null);
}

sfsGraphUseIntegerXTicks = (opts = {}) => {
  if (opts.xTickValues !== undefined || opts.tickValues !== undefined) return false;
  return Boolean(sfsGraphValueOr(
    opts.integerXTicks,
    sfsGraphValueOr(opts.xIntegerTicks, sfsGraphAllIntegers(sfsGraphXValueSample(opts)))
  ));
}

sfsGraphScaleSpan = (scale) => {
  const range = typeof scale.range === "function" ? scale.range() : null;
  if (!range || range.length < 2) return 0;
  return Math.abs(Number(range[range.length - 1]) - Number(range[0]));
}

// Tick labels hold their size at every screen width, so a short or narrow plot
// has room for fewer of them, not smaller ones. Both axes therefore ask for as
// many ticks as fit and no more: crowding is resolved by thinning the axis, the
// way the presidential chart drops to 20-year ticks on a phone. An explicit
// tickValues list is the author's own decision and is left alone.
sfsGraphFitTickCount = (scale, requested, spacing) => {
  const span = sfsGraphScaleSpan(scale);
  if (!span || !Number.isFinite(spacing) || spacing <= 0) return requested;
  const budget = Math.max(2, Math.floor(span / spacing));
  return Math.max(2, Math.min(requested, budget));
}

// Roughly how wide a tick label is, in the shared 13 px tick size: enough for
// "1" to sit closer to its neighbour than "440" does.
sfsGraphTickLabelSpacing = (scale, count, formatter) => {
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
sfsGraphBottomAxis = (scale, opts = {}, fallbackTicks) => {
  const axis = d3.axisBottom(scale);
  const tickFormat = opts.xTickFormat || opts.tickFormat;
  const continuousScale = typeof scale.ticks === "function";
  const requestedCount = sfsGraphValueOr(opts.xTicks, fallbackTicks);
  const tickCount = continuousScale
    ? sfsGraphFitTickCount(
      scale,
      sfsGraphValueOr(requestedCount, 10),
      sfsGraphTickLabelSpacing(scale, sfsGraphValueOr(requestedCount, 10), tickFormat)
    )
    : requestedCount;
  let tickValues = opts.xTickValues || opts.tickValues;

  if (!tickValues && continuousScale && sfsGraphUseIntegerXTicks(opts)) {
    tickValues = sfsGraphIntegerTicks(scale.domain(), tickCount);
  }

  if (tickValues) {
    axis.tickValues(tickValues);
  } else if (tickCount !== undefined) {
    axis.ticks(tickCount);
  }

  if (tickFormat) {
    axis.tickFormat(tickFormat);
  } else if (sfsGraphAllIntegers(tickValues)) {
    axis.tickFormat(d3.format("d"));
  } else if (!tickValues && continuousScale &&
    sfsGraphAllIntegers(scale.ticks(sfsGraphValueOr(tickCount, 10)))) {
    axis.tickFormat(d3.format("d"));
  }

  return axis;
}

sfsGraphIntegerTicks = (domain, tickCount = 5) => {
  const lower = Math.ceil(Math.min(Number(domain[0]), Number(domain[1])));
  const upper = Math.floor(Math.max(Number(domain[0]), Number(domain[1])));
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || upper < lower) return undefined;
  if (upper === lower) return [lower];

  const count = Math.max(1, Math.round(sfsGraphPositiveNumber(tickCount) || 5));
  const step = Math.max(1, Math.ceil(Math.abs(d3.tickStep(lower, upper, count)) || 1));
  const start = Math.ceil(lower / step) * step;
  const values = d3.range(start, upper + step / 2, step)
    .filter((value) => value >= lower && value <= upper);

  return values.length ? values : [lower, upper];
}

sfsGraphUseIntegerYTicks = (opts = {}, scale = "frequency") => {
  if (opts.yTickValues !== undefined || Array.isArray(opts.yTicks)) return false;
  return sfsGraphValueOr(
    opts.integerYTicks,
    sfsGraphValueOr(opts.yIntegerTicks, scale === "frequency")
  );
}

// Two lines of tick text need about twice the shared tick size between them.
sfsGraphYTickSpacing = 28;

sfsGraphYTickCount = (y, opts = {}) =>
  sfsGraphFitTickCount(y, sfsGraphValueOr(opts.yTicks, 5), sfsGraphYTickSpacing);

sfsGraphYTickValues = (y, opts = {}, scale = "frequency") => {
  if (opts.yTickValues !== undefined) return opts.yTickValues;
  if (Array.isArray(opts.yTicks)) return opts.yTicks;
  return sfsGraphUseIntegerYTicks(opts, scale)
    ? sfsGraphIntegerTicks(y.domain(), sfsGraphYTickCount(y, opts))
    : undefined;
}

sfsGraphLeftAxis = (y, opts = {}, scale = "frequency") => {
  const axis = d3.axisLeft(y);
  const tickValues = sfsGraphYTickValues(y, opts, scale);
  const useIntegerTicks = sfsGraphUseIntegerYTicks(opts, scale);
  const tickFormat = opts.yTickFormat || opts.yFormat;

  if (tickValues !== undefined) {
    axis.tickValues(tickValues);
  } else {
    axis.ticks(sfsGraphYTickCount(y, opts));
  }

  if (tickFormat) {
    axis.tickFormat(tickFormat);
  } else if (useIntegerTicks || sfsGraphAllIntegers(tickValues)) {
    axis.tickFormat(d3.format("d"));
  }

  return axis;
}

sfsGraphAddLabels = (svg, opts, type, margin, width, height, scale) => {
  const labels = opts.labels || {};
  const title = sfsGraphValueOr(opts.title, labels.title);
  const xLabel = sfsGraphValueOr(opts.xLabel, labels.x || labels.xLabel || "Scores");
  const yLabel = sfsGraphValueOr(opts.yLabel, labels.y || labels.yLabel || sfsGraphDefaultYLabel(type, scale));

  if (title) {
    svg.append("text")
      .attr("class", "sfs-graph-title")
      .attr("x", margin.left)
      .attr("y", 18)
      .text(title);
  }

  if (xLabel !== false) {
    svg.append("text")
      .attr("class", "sfs-graph-label sfs-graph-x-label")
      .attr("x", (margin.left + width - margin.right) / 2)
      .attr("y", height - 12)
      .attr("text-anchor", "middle")
      .text(xLabel);
  }

  if (yLabel !== false) {
    svg.append("text")
      .attr("class", "sfs-graph-label sfs-graph-y-label")
      .attr("x", -(margin.top + height - margin.bottom) / 2)
      .attr("y", 17)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .text(yLabel);
  }
}

sfsGraphAddLegend = (svg, series, opts, width, margin) => {
  if (series.length < 2 || opts.legend === false) return;
  const legend = svg.append("g")
    .attr("class", "sfs-graph-legend")
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
    .attr("stroke", (d, i) => d.color || sfsGraphDefaultColors[i % sfsGraphDefaultColors.length])
    .attr("stroke-width", 2);

  items.append("text")
    .attr("x", 24)
    .attr("y", 4)
    .text((d) => d.name);
}

sfsGraphAddReferenceMarkers = (svg, opts, x, margin, height) => {
  const rawMarkers = sfsGraphValueOr(opts.referenceMarkers, opts.referenceLines);
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
    .attr("class", "sfs-graph-reference-markers")
    .attr("aria-hidden", "true")
    .selectAll("g")
    .data(markerData)
    .join("g")
      .attr("class", "sfs-graph-reference-marker")
      .attr("transform", (d) => `translate(${x(d.value)},0)`);

  markers.append("line")
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom)
    .attr("stroke-dasharray", (d) => sfsGraphValueOr(d.dash, "5 4"))
    .attr("stroke-width", (d) => sfsGraphValueOr(d.strokeWidth, 2))
    .style("stroke", (d) => d.color || "var(--sfs-danger-color, #c63f3f)");

  markers.filter((d) => d.label !== undefined && d.label !== null && d.label !== false)
    .append("text")
      .attr("x", (d) => sfsGraphValueOr(d.dx, 6))
      .attr("y", (d) => margin.top + sfsGraphValueOr(d.dy, 16))
      .attr("text-anchor", (d) => sfsGraphValueOr(d.anchor, "start"))
      .style("fill", (d) => d.color || "var(--sfs-danger-color, #c63f3f)")
      .text((d) => d.label);
}

sfsGraphLinearDomain = (series, opts = {}, type = "histogram") => {
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

sfsGraphYDomain = (series, opts = {}, scale = "frequency") => {
  if (opts.yDomain) return opts.yDomain;
  const maxValue = d3.max(series, (s) => d3.max(s.rows, (row) => sfsGraphMeasure(row, scale))) || 0;
  return [0, maxValue];
}

sfsGraphLookupVisual = (visual, row, datum) => {
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

sfsGraphFirstVisual = (values) => {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

sfsGraphRowFill = (datum, opts, fallback) => {
  const row = datum.row || datum;
  const source = row.source && typeof row.source === "object" ? row.source : {};
  return sfsGraphFirstVisual([
    row.fill,
    row.color,
    source.fill,
    source.color,
    sfsGraphLookupVisual(opts.fills || opts.fill || opts.colors, row, datum),
    fallback
  ]);
}

sfsGraphRowBlockFill = (datum, opts, fallback) => {
  const row = datum.row || datum;
  const source = row.source && typeof row.source === "object" ? row.source : {};
  return sfsGraphFirstVisual([
    row.blockFill,
    row.blockColor,
    row.fill,
    row.color,
    source.blockFill,
    source.blockColor,
    source.fill,
    source.color,
    sfsGraphLookupVisual(opts.blockFills || opts.blockFill || opts.blockColors || opts.blockColor, row, datum),
    sfsGraphLookupVisual(opts.fills || opts.fill || opts.colors || opts.color, row, datum),
    fallback
  ]);
}

sfsGraphRowStroke = (datum, opts, fallback) => {
  const row = datum.row || datum;
  const source = row.source && typeof row.source === "object" ? row.source : {};
  return sfsGraphFirstVisual([
    row.stroke,
    source.stroke,
    sfsGraphLookupVisual(opts.barStrokes || opts.barStroke || opts.strokes || opts.stroke, row, datum),
    fallback
  ]);
}

sfsGraphRowBlockStroke = (datum, opts, fallback) => {
  const row = datum.row || datum;
  const source = row.source && typeof row.source === "object" ? row.source : {};
  return sfsGraphFirstVisual([
    row.stroke,
    source.stroke,
    sfsGraphLookupVisual(opts.blockStrokes || opts.blockStroke, row, datum),
    sfsGraphLookupVisual(opts.barStrokes || opts.barStroke || opts.strokes || opts.stroke, row, datum),
    fallback
  ]);
}

sfsGraphSeriesStroke = (seriesDatum, opts, index, fallback) => {
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
  return sfsGraphFirstVisual([
    seriesDatum.stroke,
    seriesDatum.color,
    sfsGraphLookupVisual(opts.strokes || opts.stroke || opts.colors || opts.color, row, datum),
    fallback
  ]);
}

sfsGraphDrawGrid = (svg, y, opts, margin, width, scale = "frequency") => {
  if (!opts.grid) return;
  svg.append("g")
    .attr("class", "sfs-graph-grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(sfsGraphLeftAxis(y, opts, scale)
      .tickSize(-(width - margin.left - margin.right))
      .tickFormat(""))
    .call((g) => g.select(".domain").remove());
}

sfsGraphPrefersReducedMotion = () =>
  typeof window !== "undefined" &&
  (window.interactiveRuntime && window.interactiveRuntime.motion
    ? window.interactiveRuntime.motion.isReduced()
    : typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches)

sfsGraphEaseFactory = (name, fallback) => {
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

sfsGraphEntranceOptions = (opts = {}) => {
  const requested = opts.animate === true || opts.animate === "visible" || opts.animate === "auto";
  const duration = sfsGraphValueOr(opts.animationDuration, 1000);
  return {
    enabled: requested && !sfsGraphPrefersReducedMotion(),
    duration,
    delayStep: sfsGraphValueOr(opts.animationDelay, 200),
    seriesDelay: sfsGraphValueOr(opts.seriesAnimationDelay, duration * 0.25),
    threshold: sfsGraphValueOr(opts.animationThreshold, 0.95),
    ease: opts.animationEase
  };
}

// Plays once when the SVG scrolls into view, and replays on click so a
// reader can re-trigger the entrance without reloading the page.
sfsGraphPlayEntrance = (svg, threshold, play, namespace = "") => {
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
sfsGraphRevealClips = (svg, lineSelection, left, top, width, height) => lineSelection.nodes().map((node) => {
  const clipId = sfsGraphNextClipId("sfs-graph-reveal-clip");
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
sfsGraphFallGravity = 1700 // px per second^2
sfsGraphFallDurationForDistance = (distance) =>
  Math.sqrt(2 * Math.max(0, distance) / sfsGraphFallGravity) * 1000

sfsGraphHashSeed = (seed) => {
  const text = String(seed ?? "sfs-block-fall-v1");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

sfsGraphSeededRandom = (seed) => {
  let state = sfsGraphHashSeed(seed);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

sfsGraphBlockFallRanks = (blockData, opts = {}) => {
  const order = String(sfsGraphValueOr(opts.blockFallOrder, opts.fallOrder) || "sequential")
    .toLowerCase();
  const ranks = new Map();

  if (!["random", "randomized", "shuffle", "shuffled"].includes(order)) {
    blockData.forEach((datum, index) => ranks.set(datum, index));
    return ranks;
  }

  const seed = sfsGraphValueOr(
    opts.blockFallSeed,
    sfsGraphValueOr(opts.fallSeed, sfsGraphValueOr(opts.seed, "sfs-block-fall-v1"))
  );
  const random = sfsGraphSeededRandom(seed);
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

sfsGraphClipIdCounter = 0
sfsGraphNextClipId = (prefix) => `${prefix}-${++sfsGraphClipIdCounter}`

// Bars/histogram grow at a constant rate (pixels per second), so a tall bar
// takes proportionally longer than a short one instead of every bar
// finishing at the same moment regardless of height — no easing, since a
// constant rate *is* linear.
sfsGraphGrowthDuration = (heightPx, rate) => (Math.max(0, heightPx) / rate) * 1000

// For a relay where item i doesn't start until item i-1 has finished:
// cumulative sum of each item's own duration.
sfsGraphRelayDelays = (durations) => {
  const delays = [];
  let cumulative = 0;
  durations.forEach((duration) => {
    delays.push(cumulative);
    cumulative += duration;
  });
  return delays;
}

sfsGraphParsePixels = (value) => {
  if (typeof value === "number") return sfsGraphPositiveNumber(value);
  const match = /^\s*([\d.]+)px\s*$/.exec(String(value === undefined ? "" : value));
  return match ? sfsGraphPositiveNumber(Number(match[1])) : undefined;
}

// The figure is drawn once at its authored size so it is complete the moment
// it mounts, then redrawn to the width it actually occupies. Redrawing (rather
// than letting CSS scale a fixed viewBox) is what keeps tick labels, axis
// labels, and titles at the size the stylesheet asked for on every screen:
// inside a scaled viewBox, 0.8125rem of tick text renders at 15 px in a wide
// column and 7 px on a phone. Pass responsive:false to opt a figure out.
sfsGraphObserveWidth = (node, opts, redraw) => {
  const api = window.interactiveFigure;
  if (!api || typeof api.observeResponsiveLayout !== "function") return;

  const type = sfsGraphNormalizeType(opts.type || opts.graphType);
  const viewBox = node.viewBox && node.viewBox.baseVal;
  const drawn = {
    width: (viewBox && viewBox.width) || sfsGraphPositiveNumber(opts.width) || 640,
    height: (viewBox && viewBox.height) || sfsGraphPositiveNumber(opts.height) || 420
  };
  const cssCap = sfsGraphParsePixels(opts.maxWidth);
  const maximumWidth = Math.max(240, cssCap || sfsGraphValueOr(opts.maximumWidth, 1600));
  // Height is only passed along when the figure isn't already deriving it: an
  // aspect ratio or an equal-scales rule recomputes height from the new width
  // on its own, and overriding it there would square up what should stay
  // proportional. Everything else keeps the aspect ratio it was drawn with, so
  // narrowing a figure reshapes it exactly as CSS scaling used to — only the
  // text now holds its size instead of shrinking with the box.
  const bothAuthored = sfsGraphPositiveNumber(opts.width) !== undefined &&
    sfsGraphPositiveNumber(opts.height) !== undefined;
  const derivesHeight = !bothAuthored && (
    sfsGraphResolveSvgAspectRatio(opts) !== undefined ||
    sfsGraphResolveScaleAspectRatio(opts, type) !== undefined
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

