// See resources/js/GRAPHS.md for module boundaries and compatibility.
sfsGraphLooksSummarized = (rows, opts = {}) => {
  if (opts.summarized === true) return true;
  if (opts.frequency !== undefined || opts.count !== undefined) return true;
  const first = rows.find((row) => row != null && typeof row === "object");
  return !!first && ["frequency", "freq", "count", "n", "f"].some((key) =>
    Object.prototype.hasOwnProperty.call(first, key)
  );
}

sfsGraphFinalizeRows = (rows) => {
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

sfsGraphNormalizeSummaryRows = (rows, opts = {}) => {
  const getX = sfsGraphAccessor(opts.x || opts.value, ["x", "value", "score", "category"]);
  const getFrequency = sfsGraphAccessor(opts.frequency || opts.count, ["frequency", "freq", "count", "n", "f"]);
  const getLabel = sfsGraphAccessor(opts.label, ["label", "category", "x", "value", "score"]);

  const normalized = rows.map((row, index) => {
    const lower = sfsGraphFirstDefined(row, ["lower", "x0", "min", "start"]);
    const upper = sfsGraphFirstDefined(row, ["upper", "x1", "max", "end"]);
    const label = getLabel(row);
    const x = sfsGraphValueOr(getX(row), lower !== undefined && upper !== undefined ? (Number(lower) + Number(upper)) / 2 : sfsGraphValueOr(label, index));
    const frequency = sfsGraphFiniteNumber(getFrequency(row)) || 0;
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

  return sfsGraphFinalizeRows(normalized);
}

sfsGraphAllNumeric = (values) =>
  values.length > 0 && values.every((value) => Number.isFinite(Number(value)))

sfsGraphInferStep = (values) => {
  const numbers = Array.from(new Set(values.map(Number))).sort(d3.ascending);
  const diffs = numbers.slice(1).map((value, index) => value - numbers[index]).filter((value) => value > 0);
  return diffs.length ? d3.min(diffs) : 1;
}

sfsGraphScoreWidth = (values, opts = {}) => {
  const explicit = sfsGraphPositiveNumber(sfsGraphValueOr(opts.scoreWidth, opts.scorewidth));
  if (explicit) return explicit;

  const type = sfsGraphNormalizeType(opts.type || opts.graphType);
  const numbers = values.map(Number).filter(Number.isFinite);
  if (type !== "bar" && numbers.length && numbers.every(Number.isInteger)) return 1;

  return sfsGraphInferStep(values);
}

sfsGraphCountValues = (rows, opts = {}) => {
  const getX = sfsGraphAccessor(opts.x || opts.value, ["x", "value", "score", "category", "label"]);
  const values = rows.map(getX).filter((value) => value !== undefined && value !== null && value !== "");
  const categories = opts.categories ? opts.categories.slice() : Array.from(new Set(values));
  const numeric = sfsGraphAllNumeric(categories);
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

  const step = numeric ? sfsGraphScoreWidth(orderedCategories, opts) : undefined;
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

  return sfsGraphFinalizeRows(counted);
}

sfsGraphResolveCuts = (values, opts = {}) => {
  if (opts.cuts) return opts.cuts.map(Number).sort(d3.ascending);

  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return [];

  const extent = d3.extent(numbers);
  const min = extent[0];
  const max = extent[1];
  const binWidth = sfsGraphFiniteNumber(opts.binWidth || opts.binwidth || opts.intervalWidth);

  if (binWidth) {
    const allIntegers = numbers.every(Number.isInteger);
    const explicitStart = sfsGraphFiniteNumber(opts.binStart || opts.start);
    const explicitStop = sfsGraphFiniteNumber(opts.binStop || opts.stop);
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

  const bins = sfsGraphFiniteNumber(opts.bins);
  if (bins) {
    const nice = d3.scaleLinear().domain([min, max]).nice(bins).domain();
    const thresholds = d3.ticks(nice[0], nice[1], bins);
    const cuts = [nice[0]].concat(thresholds.filter((value) => value > nice[0] && value < nice[1]), [nice[1]]);
    return Array.from(new Set(cuts)).sort(d3.ascending);
  }

  return [];
}

sfsGraphBinValues = (rows, opts = {}) => {
  const getX = sfsGraphAccessor(opts.x || opts.value, ["x", "value", "score"]);
  const values = rows.map(getX).map(Number).filter(Number.isFinite);
  const cuts = sfsGraphResolveCuts(values, opts);
  if (cuts.length < 2) return sfsGraphCountValues(rows, opts);

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

  return sfsGraphFinalizeRows(bins);
}

sfsGraphFrequencyRows = (data, opts = {}) => {
  const type = sfsGraphNormalizeType(opts.type || opts.graphType);
  const rows = sfsGraphAsArray(data);
  if (sfsGraphLooksSummarized(rows, opts)) return sfsGraphNormalizeSummaryRows(rows, opts);

  const getX = sfsGraphAccessor(opts.x || opts.value, ["x", "value", "score", "category", "label"]);
  const values = rows.map(getX).filter((value) => value !== undefined && value !== null && value !== "");
  const allNumeric = sfsGraphAllNumeric(values);
  const forceBins = opts.cuts || opts.binWidth || opts.binwidth || opts.intervalWidth || opts.bins;

  if (allNumeric && (forceBins || (type !== "bar" && !values.every((value) => Number.isInteger(Number(value)))))) {
    return sfsGraphBinValues(rows, opts);
  }

  return sfsGraphCountValues(rows, opts);
}

frequencyTable = (opts = {}) =>
  sfsGraphFrequencyRows(opts.data, opts)

sfsGraphMeasure = (row, scale = "frequency") => {
  if (scale === "percent") return row.percent;
  if (scale === "proportion") return row.proportion;
  return row.frequency;
}

sfsGraphSeriesData = (opts = {}, type = "histogram") => {
  const source = opts.series || opts.data;
  const data = sfsGraphAsArray(source);

  if (opts.series || (data.length > 0 && data.every((row) => row && typeof row === "object" && Array.isArray(row.data)))) {
    return data.map((series, index) => ({
      name: series.name || series.label || `Group ${index + 1}`,
      color: series.color,
      rows: sfsGraphFrequencyRows(series.data, Object.assign({}, opts, series, { type }))
    }));
  }

  if (opts.group) {
    const getGroup = sfsGraphAccessor(opts.group, ["group", "series", "condition"]);
    const groups = d3.group(data, getGroup);
    return Array.from(groups, ([name, rows], index) => ({
      name: name === undefined ? `Group ${index + 1}` : String(name),
      rows: sfsGraphFrequencyRows(rows, Object.assign({}, opts, { type }))
    }));
  }

  return [{
    name: opts.name || opts.label || "",
    color: opts.color,
    rows: sfsGraphFrequencyRows(opts.data, Object.assign({}, opts, { type }))
  }];
}

sfsGraphCurveRows = (data, opts = {}) => {
  const rows = sfsGraphAsArray(data);
  const firstObject = rows.find((row) => row && typeof row === "object");
  const yKeys = ["y", "density", "proportion", "frequency", "freq"];

  if (firstObject && yKeys.some((key) => Object.prototype.hasOwnProperty.call(firstObject, key))) {
    const getX = sfsGraphAccessor(opts.x || opts.value, ["x", "value", "score"]);
    const getY = sfsGraphAccessor(opts.y || opts.density, yKeys);
    return rows
      .map((row) => ({ x: Number(getX(row)), y: Number(getY(row)), source: row }))
      .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y))
      .sort((a, b) => a.x - b.x);
  }

  const getX = sfsGraphAccessor(opts.x || opts.value, ["x", "value", "score"]);
  const values = rows.map(getX).map(Number).filter(Number.isFinite);
  if (!values.length) return [];

  const extent = opts.xDomain || opts.domain || d3.extent(values);
  const sd = d3.deviation(values) || 1;
  const bandwidth = sfsGraphPositiveNumber(sfsGraphValueOr(opts.bandwidth, opts.smoothing)) ||
    1.06 * sd * Math.pow(values.length, -0.2) ||
    1;
  const points = sfsGraphFiniteNumber(opts.points) || 160;
  const step = (extent[1] - extent[0]) / Math.max(1, points - 1);

  return d3.range(points).map((index) => {
    const x = extent[0] + index * step;
    const y = d3.mean(values, (value) => sfsGraphNormalPdf(x, value, bandwidth));
    return { x, y };
  });
}

sfsGraphCurveSeriesData = (opts = {}) => {
  const source = opts.series || opts.data;
  const data = sfsGraphAsArray(source);

  if (opts.series || (data.length > 0 && data.every((row) => row && typeof row === "object" && Array.isArray(row.data)))) {
    return data.map((series, index) => ({
      name: series.name || series.label || `Group ${index + 1}`,
      color: series.color,
      rows: sfsGraphCurveRows(series.data, Object.assign({}, opts, series))
    }));
  }

  if (opts.group) {
    const getGroup = sfsGraphAccessor(opts.group, ["group", "series", "condition"]);
    const groups = d3.group(data, getGroup);
    return Array.from(groups, ([name, rows], index) => ({
      name: name === undefined ? `Group ${index + 1}` : String(name),
      rows: sfsGraphCurveRows(rows, opts)
    }));
  }

  return [{
    name: opts.name || opts.label || "",
    color: opts.color,
    rows: sfsGraphCurveRows(opts.data, opts)
  }];
}

