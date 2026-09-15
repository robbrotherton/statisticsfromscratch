// Explicit estimates and limits, independent of frequency/bin normalization.
// Limits use the same units as estimates. No inference or renormalization here.
sfsGraphIntervalRows = (data) => {
  if (!Array.isArray(data) || !data.length) throw new Error('Interval graphs need at least one estimate.');
  const labels = new Set();
  return data.map(row => {
    if (!row || typeof row.label !== 'string' || !row.label.trim() || labels.has(row.label)) {
      throw new Error('Interval graph labels must be nonempty and unique.');
    }
    labels.add(row.label);
    const { estimate, lower, upper } = row;
    if (![estimate, lower, upper].every(value => typeof value === 'number' && Number.isFinite(value)) ||
        lower > estimate || estimate > upper) {
      throw new Error('Interval limits must be finite and bracket the estimate.');
    }
    return { ...row };
  });
};

sfsGraphIntervalDomain = (rows, domain) => {
  const lo = Math.min(...rows.map(row => row.lower));
  const hi = Math.max(...rows.map(row => row.upper));
  if (domain !== undefined) {
    if (!Array.isArray(domain) || domain.length !== 2 || !domain.every(Number.isFinite) ||
        domain[0] >= domain[1] || domain[0] > lo || domain[1] < hi) {
      throw new Error('The interval graph domain must include all error bars.');
    }
    return domain.slice();
  }
  const padding = (hi - lo || Math.abs(lo) || 1) * 0.15;
  return [lo - padding, hi + padding];
};

sfsGraphMakeInterval = (opts = {}) => {
  const rows = sfsGraphIntervalRows(opts.data);
  const orientation = opts.orientation || 'horizontal';
  if (!['horizontal', 'vertical'].includes(orientation)) throw new Error('Unknown interval orientation.');
  const vertical = orientation === 'vertical';
  const domain = sfsGraphIntervalDomain(rows, vertical ? opts.yDomain : opts.xDomain);
  const dimensions = sfsGraphDimensions(opts, 'interval');
  // Keep readable row spacing even when the shared responsive wrapper narrows.
  dimensions.height = Math.max(dimensions.height, vertical ? 280 : 92 + rows.length * 64);
  const { width, height } = dimensions;
  const longest = Math.max(...rows.map(row => row.label.length));
  const margin = Object.assign({ top: 30, right: 28, bottom: 55,
    left: vertical ? 65 : Math.min(width * .42, Math.max(85, longest * 7 + 16)) }, opts.margin || {});
  const format = opts.valueFormat || (value => opts.scale === 'percent' ? `${d3.format('.1f')(value)}%` : d3.format('.3~g')(value));
  const description = rows.map(row => `${row.label}: ${format(row.estimate)}, interval ${format(row.lower)} to ${format(row.upper)}`).join('; ');
  const svg = sfsGraphCreateSvg({ ...opts, ariaLabel: opts.ariaLabel || description }, 'interval', dimensions);
  const categories = rows.map(row => row.label);
  const x = vertical
    ? d3.scalePoint().domain(categories).range([margin.left, width - margin.right]).padding(.7)
    : d3.scaleLinear().domain(domain).range([margin.left, width - margin.right]);
  const y = vertical
    ? d3.scaleLinear().domain(domain).range([height - margin.bottom, margin.top])
    : d3.scalePoint().domain(categories).range([margin.top + 24, height - margin.bottom - 24]).padding(.4);
  const axisOptions = { ...opts, xTickFormat: opts.xTickFormat || (!vertical && opts.scale === 'percent' ? value => `${value}%` : undefined) };
  const axis = svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(sfsGraphBottomAxis(x, axisOptions));
  sfsGraphStyleAxis(axis);
  const leftAxis = vertical
    ? sfsGraphLeftAxis(y, { ...opts, yTickFormat: opts.yTickFormat || (opts.scale === 'percent' ? value => `${value}%` : undefined) }, opts.scale)
    : d3.axisLeft(y).tickSize(0).tickPadding(12);
  const labels = svg.append('g').attr('transform', `translate(${margin.left},0)`).call(leftAxis);
  sfsGraphStyleAxis(labels);
  if (!vertical) labels.select('.sfs-graph-domain').remove();
  // Marks use local coordinates: the group locates the categorical axis,
  // while the numeric scale supplies the point and both interval endpoints.
  const numeric = vertical ? y : x;
  const marks = svg.append('g').selectAll('g').data(rows).join('g').attr('class', 'sfs-graph-interval-row')
    .attr('transform', row => vertical ? `translate(${x(row.label)},0)` : `translate(0,${y(row.label)})`)
    .style('color', row => row.color || 'var(--graph-series-1, #0072b2)');
  marks.append('line').attr('class', 'sfs-graph-error-bar').attr(vertical ? 'y1' : 'x1', row => numeric(row.lower)).attr(vertical ? 'y2' : 'x2', row => numeric(row.upper))
    .attr('stroke', 'currentColor').attr('stroke-width', 2);
  for (const end of ['lower', 'upper']) {
    marks.append('line').attr(vertical ? 'y1' : 'x1', row => numeric(row[end])).attr(vertical ? 'y2' : 'x2', row => numeric(row[end]))
      .attr(vertical ? 'x1' : 'y1', -6).attr(vertical ? 'x2' : 'y2', 6).attr('stroke', 'currentColor').attr('stroke-width', 2);
  }
  marks.append('circle').attr('class', 'sfs-graph-estimate').attr(vertical ? 'cy' : 'cx', row => numeric(row.estimate)).attr('r', 5)
    .attr('fill', 'currentColor').attr('stroke', 'var(--sfs-bg, white)').attr('stroke-width', 1.5);
  if (opts.showValues !== false) marks.append('text').attr('class', 'sfs-graph-tick-label')
    .attr('x', row => vertical ? 0 : x(row.estimate)).attr('y', row => vertical ? y(row.upper) - 13 : -13).attr('text-anchor', 'middle').text(row => format(row.estimate));
  marks.append('title').text(row => `${row.label}: ${format(row.estimate)} (${format(row.lower)}–${format(row.upper)})`);
  sfsGraphAddLabels(svg, { ...opts, yLabel: vertical ? (opts.yLabel ?? (opts.labels || {}).y ?? 'Estimate') : false, xLabel: vertical ? (opts.xLabel ?? (opts.labels || {}).x ?? false) : (opts.xLabel ?? (opts.labels || {}).x ?? 'Estimate') }, 'interval', margin, width, height, opts.scale);
  return svg.node();
};
