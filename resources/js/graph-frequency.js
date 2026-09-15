// See resources/js/GRAPHS.md for module boundaries and compatibility.
sfsGraphHistogramBounds = (row) => ({
  left: Number.isFinite(row.lower) ? row.lower : Number(row.x) - 0.5,
  right: Number.isFinite(row.upper) ? row.upper : Number(row.x) + 0.5
})

sfsGraphHistogramX = (row, x, overlayOffset, seriesIndex, seriesOffset = 0.5) => {
  const bounds = sfsGraphHistogramBounds(row);
  const width = x(bounds.right) - x(bounds.left);
  return x(bounds.left) + width * overlayOffset + seriesIndex * seriesOffset;
}

sfsGraphHistogramWidth = (row, x, overlayWidth, barGap = 0) => {
  const bounds = sfsGraphHistogramBounds(row);
  return Math.max(0, (x(bounds.right) - x(bounds.left)) * overlayWidth - barGap);
}

sfsGraphBlockRows = (rowData, scale, opts = {}) => {
  const unit = sfsGraphPositiveNumber(sfsGraphValueOr(opts.blockUnit, sfsGraphValueOr(opts.blockSize, opts.unit))) || 1;
  const epsilon = unit / 1000000;
  return rowData.flatMap((datum) => {
    const value = Math.max(0, sfsGraphMeasure(datum.row, scale));
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

sfsGraphMakeBarGraph = (opts = {}, type = "bar") => {
  const series = sfsGraphSeriesData(opts, type);
  const scale = sfsGraphValueOr(opts.scale, "frequency");
  const dimensions = sfsGraphDimensions(opts, type);
  const { width, height } = dimensions;
  const margin = sfsGraphResolveMargin(opts);
  const svg = sfsGraphCreateSvg(opts, type, dimensions);
  const allRows = series.flatMap((s) => s.rows);
  const categories = Array.from(new Set(allRows.map((row) => sfsGraphIntervalLabel(row))));
  const x = d3.scaleBand()
    .domain(categories)
    .range([margin.left, width - margin.right])
    .padding(sfsGraphValueOr(opts.padding, 0.22));
  const xSeries = d3.scaleBand()
    .domain(series.map((s) => s.name))
    .range([0, x.bandwidth()])
    .padding(series.length > 1 ? 0.08 : 0);
  const y = d3.scaleLinear()
    .domain(sfsGraphYDomain(series, opts, scale))
    .nice()
    .range([height - margin.bottom, margin.top]);

  sfsGraphDrawGrid(svg, y, opts, margin, width, scale);

  const rowData = series.flatMap((s, seriesIndex) =>
    s.rows.map((row, rowIndex) => ({ row, series: s, seriesIndex, rowIndex }))
  );
  const entrance = sfsGraphEntranceOptions(opts);

  const bars = svg.append("g")
    .attr("class", "sfs-graph-bars")
    .selectAll("rect")
    .data(rowData)
    .join("rect")
      .attr("class", "sfs-graph-bar")
      .attr("x", (d) => x(sfsGraphIntervalLabel(d.row)) + xSeries(d.series.name))
      .attr("y", (d) => entrance.enabled ? y(0) : y(sfsGraphMeasure(d.row, scale)))
      .attr("width", xSeries.bandwidth())
      .attr("height", (d) => entrance.enabled ? 0 : y(0) - y(sfsGraphMeasure(d.row, scale)))
      .style("fill", (d) => sfsGraphRowFill(
        d,
        opts,
        d.series.color || (series.length > 1 ? sfsGraphDefaultColors[d.seriesIndex % sfsGraphDefaultColors.length] : "var(--graph-bar-fill, #bdbdbd)")
      ))
      .style("stroke", (d) => sfsGraphRowStroke(d, opts, "var(--graph-bar-stroke, currentColor)"));

  bars.append("title")
    .text((d) => `${sfsGraphIntervalLabel(d.row)}: ${d.row.frequency}`);

  if (entrance.enabled) {
    // Each bar starts growing the instant the previous one finishes — a
    // relay, not a fixed per-bar delay — so the pacing stays consistent
    // regardless of how many bars there are.
    const growthRate = sfsGraphValueOr(opts.growthRate, 900); // px/sec
    const durations = rowData.map((d) => sfsGraphGrowthDuration(y(0) - y(sfsGraphMeasure(d.row, scale)), growthRate));
    const delays = sfsGraphRelayDelays(durations);
    const play = () => {
      bars.interrupt()
        .attr("y", y(0))
        .attr("height", 0)
        .transition()
        .delay((d, i) => delays[i])
        .duration((d, i) => durations[i])
        .ease(d3.easeLinear)
        .attr("y", (d) => y(sfsGraphMeasure(d.row, scale)))
        .attr("height", (d) => y(0) - y(sfsGraphMeasure(d.row, scale)));
    };
    sfsGraphPlayEntrance(svg, entrance.threshold, play);
  }

  const xAxis = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(sfsGraphBottomAxis(x, opts));
  const yAxis = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(sfsGraphLeftAxis(y, opts, scale));
  sfsGraphStyleAxis(xAxis);
  sfsGraphStyleAxis(yAxis);
  if (opts.yAxisLine === false) yAxis.select(".sfs-graph-domain").remove();

  sfsGraphAddLabels(svg, opts, type, margin, width, height, scale);
  sfsGraphAddLegend(svg, series, opts, width, margin);
  return svg.node();
}

sfsGraphMakeHistogram = (opts = {}, type = "histogram") => {
  const series = sfsGraphSeriesData(opts, type);
  const scale = sfsGraphValueOr(opts.scale, "frequency");
  const margin = sfsGraphResolveMargin(opts);
  const xDomain = sfsGraphLinearDomain(series, opts, type);
  const finalXDomain = opts.xNiceTicks ?
    d3.scaleLinear().domain(xDomain).nice(opts.xNiceTicks).domain() :
    xDomain;
  const yDomain = d3.scaleLinear()
    .domain(sfsGraphYDomain(series, opts, scale))
    .nice()
    .domain();
  const dimensions = sfsGraphDimensionsForLinearScales(opts, type, finalXDomain, yDomain, margin);
  const { width, height } = dimensions;
  const svg = sfsGraphCreateSvg(opts, type, dimensions);
  const x = d3.scaleLinear()
    .domain(finalXDomain)
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain(yDomain)
    .range([height - margin.bottom, margin.top]);

  sfsGraphDrawGrid(svg, y, opts, margin, width, scale);

  const rowData = series.flatMap((s, seriesIndex) =>
    s.rows.map((row, rowIndex) => ({ row, series: s, seriesIndex, rowIndex }))
  );
  const overlayWidth = sfsGraphValueOr(opts.overlayWidth, series.length > 1 ? 0.72 : 1);
  const overlayOffset = (1 - overlayWidth) / 2;
  const seriesOffset = sfsGraphValueOr(opts.seriesOffset, 0.5);
  const barGap = sfsGraphValueOr(opts.barGap, 0);
  const entrance = sfsGraphEntranceOptions(opts);

  if (type === "block") {
    const blockGap = sfsGraphValueOr(opts.blockGap, 0);
    // The default release order follows blockData: one column bottom-to-top,
    // then the next. An opt-in randomized order interleaves columns while
    // preserving bottom-to-top order within each stack, so blocks never land
    // in midair.
    const blockData = sfsGraphBlockRows(rowData, scale, opts);
    const blockFallRanks = sfsGraphBlockFallRanks(blockData, opts);
    // Same default resolution sfsGraphBlockRows uses internally for `unit` —
    // duplicated (not returned from that call) since it's a one-liner and
    // changing that function's return shape isn't worth it for this.
    const blockUnit = sfsGraphPositiveNumber(sfsGraphValueOr(opts.blockUnit, sfsGraphValueOr(opts.blockSize, opts.unit))) || 1;
    // The y-scale is linear and every block spans the same `unit`, so every
    // block has the same pixel height regardless of which row/stack it's in
    // (a partial last block is only ever shorter than this, never taller) —
    // one number describes "how tall a block is" for the whole chart.
    const blockPixelHeight = Math.abs(y(0) - y(blockUnit));
    // Blocks fall from a shared ceiling above the plot, like objects dropped
    // from a shelf — same constant-gravity model as sampling-visuals.js's
    // mean-boxes (see sfsGraphFallDurationForDistance). `.sfs-graph` sets
    // overflow:visible (so axis labels etc. aren't clipped), so a ceiling
    // above y=0 would otherwise just render as a visible block sitting above
    // the plot rather than staying out of sight — a clipPath scoped to this
    // layer keeps the "off canvas until it falls into frame" effect without
    // touching that page-wide overflow setting. The ceiling has to clear a
    // full block's *height*, not just its top edge — a block positioned by
    // its top-left corner still has its bottom edge sticking out below that
    // point, which is what was still visible before this accounted for it.
    const fallHeadroomRatio = sfsGraphValueOr(opts.fallHeadroomRatio, 0.5);
    const ceilingY = -blockPixelHeight * (1 + fallHeadroomRatio);
    const blockTargetX = (datum) =>
      sfsGraphHistogramX(datum.row, x, overlayOffset, datum.seriesIndex, seriesOffset);
    const blockWidth = (datum) =>
      sfsGraphHistogramWidth(datum.row, x, overlayWidth, barGap);
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

    const blocksGroup = svg.append("g").attr("class", "sfs-graph-bars sfs-graph-blocks");
    if (entrance.enabled) {
      const clipId = sfsGraphNextClipId("sfs-graph-block-clip");
      svg.append("clipPath").attr("id", clipId)
        .append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height);
      blocksGroup.attr("clip-path", `url(#${clipId})`);
    }

    const blocks = blocksGroup
      .selectAll("rect")
      .data(blockData)
      .join("rect")
        .attr("class", "sfs-graph-bar sfs-graph-block")
        .attr("x", (d) => entrance.enabled ? blockOriginX(d) : blockTargetX(d))
        .attr("y", (d) => entrance.enabled ? ceilingY : y(d.blockUpper))
        .attr("width", blockWidth)
        .attr("height", (d) => Math.max(0, y(d.blockLower) - y(d.blockUpper) - blockGap))
        .attr("data-block-index", (d) => d.blockIndex)
        .attr("data-fall-rank", (d) => blockFallRanks.get(d))
        .style("fill", (d) => sfsGraphRowBlockFill(
          d,
          opts,
          d.series.color || (series.length > 1 ? sfsGraphDefaultColors[d.seriesIndex % sfsGraphDefaultColors.length] : "var(--graph-block-fill, var(--graph-bar-fill, #bdbdbd))")
        ))
        .style("stroke", (d) => sfsGraphRowBlockStroke(d, opts, "var(--graph-block-stroke, var(--bs-body-bg, currentColor))"))
        .attr("fill-opacity", series.length > 1 ? 0.45 : null);

    blocks.append("title")
      .text((d) => `${sfsGraphIntervalLabel(d.row)} block ${d.blockIndex + 1}: ${d.row.frequency}`);

    if (entrance.enabled) {
      const ease = sfsGraphEaseFactory(entrance.ease, d3.easeQuadIn);
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
      const fallGapFraction = sfsGraphValueOr(opts.fallGapFraction, 0.25);
      const stagger = sfsGraphValueOr(opts.fallStagger, sfsGraphFallDurationForDistance(blockPixelHeight * fallGapFraction));
      const play = () => {
        blocks.interrupt()
          .attr("x", blockOriginX)
          .attr("y", ceilingY)
          .transition()
          .delay((d) => blockFallRanks.get(d) * stagger)
          .duration((d) => sfsGraphFallDurationForDistance(y(d.blockUpper) - ceilingY))
          .ease(ease)
          .attr("x", blockTargetX)
          .attr("y", (d) => y(d.blockUpper));
      };
      sfsGraphPlayEntrance(svg, entrance.threshold, play);
    }
  } else {
    const bars = svg.append("g")
      .attr("class", "sfs-graph-bars")
      .selectAll("rect")
      .data(rowData)
      .join("rect")
        .attr("class", "sfs-graph-bar")
        .attr("x", (d) => sfsGraphHistogramX(d.row, x, overlayOffset, d.seriesIndex, seriesOffset))
        .attr("y", (d) => entrance.enabled ? y(0) : y(sfsGraphMeasure(d.row, scale)))
        .attr("width", (d) => sfsGraphHistogramWidth(d.row, x, overlayWidth, barGap))
        .attr("height", (d) => entrance.enabled ? 0 : y(0) - y(sfsGraphMeasure(d.row, scale)))
        .style("fill", (d) => sfsGraphRowFill(
          d,
          opts,
          d.series.color || (series.length > 1 ? sfsGraphDefaultColors[d.seriesIndex % sfsGraphDefaultColors.length] : "var(--graph-bar-fill, #bdbdbd)")
        ))
        .style("stroke", (d) => sfsGraphRowStroke(d, opts, "var(--graph-bar-stroke, currentColor)"))
        .attr("fill-opacity", series.length > 1 ? 0.45 : null);

    bars.append("title")
      .text((d) => `${sfsGraphIntervalLabel(d.row)}: ${d.row.frequency}`);

    if (entrance.enabled) {
      const growthRate = sfsGraphValueOr(opts.growthRate, 900); // px/sec
      const durations = rowData.map((d) => sfsGraphGrowthDuration(y(0) - y(sfsGraphMeasure(d.row, scale)), growthRate));
      const delays = sfsGraphRelayDelays(durations);
      const play = () => {
        bars.interrupt()
          .attr("y", y(0))
          .attr("height", 0)
          .transition()
          .delay((d, i) => delays[i])
          .duration((d, i) => durations[i])
          .ease(d3.easeLinear)
          .attr("y", (d) => y(sfsGraphMeasure(d.row, scale)))
          .attr("height", (d) => y(0) - y(sfsGraphMeasure(d.row, scale)));
      };
      sfsGraphPlayEntrance(svg, entrance.threshold, play);
    }
  }

  sfsGraphAddReferenceMarkers(svg, opts, x, margin, height);

  const xAxis = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(sfsGraphBottomAxis(x, opts));
  const yAxis = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(sfsGraphLeftAxis(y, opts, scale));
  sfsGraphStyleAxis(xAxis);
  sfsGraphStyleAxis(yAxis);
  if (opts.yAxisLine === false) yAxis.select(".sfs-graph-domain").remove();

  sfsGraphAddLabels(svg, opts, type, margin, width, height, scale);
  sfsGraphAddLegend(svg, series, opts, width, margin);
  return svg.node();
}

sfsGraphPolygonPoints = (rows, scale) => {
  if (!rows.length) return [];
  const points = rows.map((row) => ({ x: Number(row.x), y: sfsGraphMeasure(row, scale), point: true, row }));
  const first = rows[0];
  const last = rows[rows.length - 1];
  const start = Number.isFinite(first.polygonStart) ? first.polygonStart : Number.isFinite(first.lower) ? first.lower : Number(first.x);
  const end = Number.isFinite(last.polygonEnd) ? last.polygonEnd : Number.isFinite(last.upper) ? last.upper : Number(last.x);
  return [{ x: start, y: 0, point: false }].concat(points, [{ x: end, y: 0, point: false }]);
}

sfsGraphPolygonInterpolatedY = (rows, scale, targetX) => {
  const points = sfsGraphPolygonPoints(rows, scale)
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

sfsGraphAddPolygonInterpolationGuides = (svg, opts, series, scale, x, y, margin, height) => {
  const rawGuides = opts.interpolationGuides;
  if (rawGuides === undefined || rawGuides === null) return;

  const guideSpecs = (Array.isArray(rawGuides) ? rawGuides : [rawGuides])
    .map((guide) => typeof guide === "number" ? { x: guide } : guide)
    .filter((guide) => guide && typeof guide === "object");
  const color = sfsGraphValueOr(
    opts.interpolationGuideColor,
    "color-mix(in srgb, var(--sfs-danger-color, #c63f3f) 78%, var(--sfs-text, #212529))"
  );
  const dash = sfsGraphValueOr(opts.interpolationGuideDash, "6 4");
  const strokeWidth = sfsGraphValueOr(opts.interpolationGuideStrokeWidth, 1.8);
  const animationRequested = opts.animateInterpolationGuides === true;
  const animationEnabled = animationRequested && !sfsGraphPrefersReducedMotion();
  const duration = sfsGraphValueOr(opts.interpolationGuideAnimationDuration, 650);
  const pause = sfsGraphValueOr(opts.interpolationGuideAnimationPause, 100);
  const ease = sfsGraphEaseFactory(opts.interpolationGuideAnimationEase, d3.easeCubicInOut);
  const plotBottom = height - margin.bottom;
  const resolvedGuides = guideSpecs.map((guide) => {
    const targetX = sfsGraphFiniteNumber(guide.x);
    if (!Number.isFinite(targetX)) return null;

    const seriesIndex = Math.max(0, Math.round(sfsGraphFiniteNumber(guide.seriesIndex) || 0));
    const targetSeries = series[seriesIndex];
    const explicitY = sfsGraphFiniteNumber(guide.y);
    const targetY = explicitY === undefined && targetSeries
      ? sfsGraphPolygonInterpolatedY(targetSeries.rows, scale, targetX)
      : explicitY;

    if (!Number.isFinite(targetY)) return null;
    if (targetX < Math.min(...x.domain()) || targetX > Math.max(...x.domain())) return null;
    if (targetY < Math.min(...y.domain()) || targetY > Math.max(...y.domain())) return null;

    return {
      targetX,
      targetY,
      xPixel: x(targetX),
      yPixel: y(targetY),
      xLabel: sfsGraphValueOr(guide.xLabel, targetX),
      label: guide.label
    };
  }).filter(Boolean);

  if (!resolvedGuides.length) return;

  const guideGroups = svg.append("g")
    .attr("class", "sfs-graph-interpolation-guides")
    .attr("aria-hidden", "true")
    .selectAll("g")
    .data(resolvedGuides)
    .join("g")
      .attr("class", "sfs-graph-interpolation-guide");

  const verticals = guideGroups.append("line")
    .attr("class", "sfs-graph-interpolation-guide-line sfs-graph-interpolation-guide-vertical")
    .attr("x1", (d) => d.xPixel)
    .attr("x2", (d) => d.xPixel)
    .attr("y1", plotBottom)
    .attr("y2", (d) => animationEnabled ? plotBottom : d.yPixel)
    .attr("stroke", color)
    .attr("stroke-width", strokeWidth)
    .attr("stroke-dasharray", dash)
    .attr("vector-effect", "non-scaling-stroke");

  const horizontals = guideGroups.append("line")
    .attr("class", "sfs-graph-interpolation-guide-line sfs-graph-interpolation-guide-horizontal")
    .attr("x1", (d) => d.xPixel)
    .attr("x2", (d) => animationEnabled ? d.xPixel : margin.left)
    .attr("y1", (d) => d.yPixel)
    .attr("y2", (d) => d.yPixel)
    .attr("stroke", color)
    .attr("stroke-width", strokeWidth)
    .attr("stroke-dasharray", dash)
    .attr("vector-effect", "non-scaling-stroke");

  const markers = guideGroups.append("circle")
    .attr("class", "sfs-graph-interpolation-guide-marker")
    .attr("cx", (d) => d.xPixel)
    .attr("cy", (d) => d.yPixel)
    .attr("r", sfsGraphValueOr(opts.interpolationGuidePointRadius, 4))
    .attr("fill", "var(--sfs-bg, #fff)")
    .attr("stroke", color)
    .attr("stroke-width", 2)
    .attr("vector-effect", "non-scaling-stroke")
    .style("opacity", animationEnabled ? 0 : 1);

  guideGroups.append("line")
    .attr("class", "sfs-graph-interpolation-guide-tick")
    .attr("x1", (d) => d.xPixel)
    .attr("x2", (d) => d.xPixel)
    .attr("y1", plotBottom)
    .attr("y2", plotBottom + 6)
    .attr("stroke", color)
    .attr("stroke-width", 1.8)
    .attr("vector-effect", "non-scaling-stroke");

  guideGroups.append("text")
    .attr("class", "sfs-graph-tick-label sfs-graph-interpolation-guide-label")
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

  sfsGraphPlayEntrance(
    svg,
    sfsGraphValueOr(opts.interpolationGuideAnimationThreshold, 0.95),
    play,
    "interpolation-guides"
  );
}

sfsGraphMakePolygon = (opts = {}) => {
  const type = "polygon";
  const series = sfsGraphSeriesData(opts, type);
  const scale = sfsGraphValueOr(opts.scale, "frequency");
  const margin = sfsGraphResolveMargin(opts);
  const xDomain = sfsGraphLinearDomain(series, opts, type);
  const yDomain = d3.scaleLinear()
    .domain(sfsGraphYDomain(series, opts, scale))
    .nice()
    .domain();
  const dimensions = sfsGraphDimensionsForLinearScales(opts, type, xDomain, yDomain, margin);
  const { width, height } = dimensions;
  const svg = sfsGraphCreateSvg(opts, type, dimensions);
  const x = d3.scaleLinear()
    .domain(xDomain)
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain(yDomain)
    .range([height - margin.bottom, margin.top]);
  const line = d3.line()
    .x((d) => x(d.x))
    .y((d) => y(d.y));

  sfsGraphDrawGrid(svg, y, opts, margin, width, scale);

  const entrance = sfsGraphEntranceOptions(opts);

  const groups = svg.append("g")
    .attr("class", "sfs-graph-polygons")
    .selectAll("g")
    .data(series)
    .join("g")
      .attr("class", "sfs-graph-polygon-series");

  const lines = groups.append("path")
    .attr("class", "sfs-graph-line")
    .attr("fill", "none")
    .style("stroke", (d, i) => sfsGraphSeriesStroke(d, opts, i, sfsGraphDefaultColors[i % sfsGraphDefaultColors.length]))
    .attr("stroke-width", sfsGraphValueOr(opts.strokeWidth, 2))
    .attr("stroke-dasharray", (d, i) => d.dash || (opts.dashed && i > 0 ? "6 4" : null))
    .attr("d", (d) => line(sfsGraphPolygonPoints(d.rows, scale)));

  // Reveals grow a clip rect left-to-right in plot pixel space rather than
  // drawing via stroke-dasharray/dashoffset — see sfsGraphRevealClips for why.
  const revealLeft = margin.left;
  const revealWidth = Math.max(0, width - margin.left - margin.right);
  const clipRects = entrance.enabled ? sfsGraphRevealClips(svg, lines, revealLeft, 0, revealWidth, height) : null;

  let points = null;
  if (sfsGraphValueOr(opts.points, true)) {
    points = groups.selectAll("circle")
      .data((d, i) => sfsGraphPolygonPoints(d.rows, scale)
        .filter((point) => point.point)
        .map((point) => Object.assign({}, point, {
          series: d,
          seriesIndex: i,
          fraction: revealWidth ? (x(point.x) - revealLeft) / revealWidth : 0
        })))
      .join("circle")
        .attr("class", "sfs-graph-point")
        .attr("cx", (d) => x(d.x))
        .attr("cy", (d) => y(d.y))
        .attr("r", sfsGraphValueOr(opts.pointRadius, 3))
        .style("fill", (d) => d.series.color || sfsGraphDefaultColors[d.seriesIndex % sfsGraphDefaultColors.length])
        .style("opacity", entrance.enabled ? 0 : null);

    points.append("title")
      .text((d) => `${sfsGraphIntervalLabel(d.row)}: ${d.row.frequency}`);
  }

  if (entrance.enabled) {
    const ease = sfsGraphEaseFactory(entrance.ease, d3.easeLinear);
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
    sfsGraphPlayEntrance(svg, entrance.threshold, play);
  }

  const xAxis = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(sfsGraphBottomAxis(x, opts));
  const yAxis = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(sfsGraphLeftAxis(y, opts, scale));
  sfsGraphStyleAxis(xAxis);
  sfsGraphStyleAxis(yAxis);

  sfsGraphAddPolygonInterpolationGuides(svg, opts, series, scale, x, y, margin, height);

  sfsGraphAddLabels(svg, opts, type, margin, width, height, scale);
  sfsGraphAddLegend(svg, series, opts, width, margin);
  return svg.node();
}

sfsGraphMakeCurve = (opts = {}) => {
  const type = "curve";
  const series = sfsGraphCurveSeriesData(opts);
  const margin = sfsGraphResolveMargin(opts);
  const allRows = series.flatMap((s) => s.rows);
  const xExtent = d3.extent(allRows, (row) => row.x);
  const xDomain = opts.xDomain || opts.domain || (allRows.length ? xExtent : [0, 1]);
  const yDomain = d3.scaleLinear()
    .domain(opts.yDomain || [0, d3.max(allRows, (row) => row.y) || 1])
    .nice()
    .domain();
  const dimensions = sfsGraphDimensionsForLinearScales(opts, type, xDomain, yDomain, margin);
  const { width, height } = dimensions;
  const svg = sfsGraphCreateSvg(opts, type, dimensions);
  const x = d3.scaleLinear()
    .domain(xDomain)
    .range([margin.left, width - margin.right]);
  const y = d3.scaleLinear()
    .domain(yDomain)
    .range([height - margin.bottom, margin.top]);
  const curveFactory = sfsGraphCurveFactory(opts);
  const line = d3.line()
    .curve(curveFactory)
    .x((d) => x(d.x))
    .y((d) => y(d.y));
  const area = d3.area()
    .curve(curveFactory)
    .x((d) => x(d.x))
    .y0(y(0))
    .y1((d) => y(d.y));

  sfsGraphDrawGrid(svg, y, opts, margin, width, sfsGraphValueOr(opts.scale, "proportion"));

  const entrance = sfsGraphEntranceOptions(opts);

  const groups = svg.append("g")
    .attr("class", "sfs-graph-curves")
    .selectAll("g")
    .data(series)
    .join("g")
      .attr("class", "sfs-graph-curve-series");

  // Clip the complete area path so the shaded edge follows the same
  // interpolation as the curve, including at the interval boundaries.
  const shadeBetween = opts.shade && opts.shade.between;
  const shadeBounds = Array.isArray(shadeBetween) && shadeBetween.length === 2 &&
    shadeBetween.every(Number.isFinite)
    ? [Math.max(xDomain[0], Math.min(...shadeBetween)), Math.min(xDomain[1], Math.max(...shadeBetween))]
    : null;
  const hasShade = shadeBounds && shadeBounds[1] > shadeBounds[0];
  let areas = null;
  if (sfsGraphValueOr(opts.area, false) || hasShade) {
    areas = groups.append("path")
      .attr("class", "sfs-graph-area")
      .attr("fill", (d, i) => d.color || sfsGraphDefaultColors[i % sfsGraphDefaultColors.length])
      .attr("d", (d) => area(d.rows))
      .style("opacity", entrance.enabled ? 0 : null);
    if (hasShade) {
      const clipId = sfsGraphNextClipId("sfs-graph-shade-clip");
      svg.append("clipPath").attr("id", clipId)
        .append("rect")
          .attr("x", x(shadeBounds[0]))
          .attr("y", margin.top)
          .attr("width", x(shadeBounds[1]) - x(shadeBounds[0]))
          .attr("height", height - margin.bottom - margin.top);
      areas.attr("clip-path", `url(#${clipId})`);
      if (opts.shade.label) {
        svg.append("text")
          .attr("class", "sfs-graph-label")
          .attr("text-anchor", "middle")
          .attr("x", x((shadeBounds[0] + shadeBounds[1]) / 2))
          .attr("y", y(0) - 20)
          .text(opts.shade.label);
      }
    }
  }

  const lines = groups.append("path")
    .attr("class", "sfs-graph-line")
    .attr("fill", "none")
    .style("stroke", (d, i) => sfsGraphSeriesStroke(d, opts, i, sfsGraphDefaultColors[i % sfsGraphDefaultColors.length]))
    .attr("stroke-width", sfsGraphValueOr(opts.strokeWidth, 2))
    .attr("d", (d) => line(d.rows));

  // Reveals grow a clip rect left-to-right in plot pixel space rather than
  // drawing via stroke-dasharray/dashoffset — see sfsGraphRevealClips for why.
  const revealLeft = margin.left;
  const revealWidth = Math.max(0, width - margin.left - margin.right);
  const clipRects = entrance.enabled ? sfsGraphRevealClips(svg, lines, revealLeft, 0, revealWidth, height) : null;

  if (entrance.enabled) {
    const ease = sfsGraphEaseFactory(entrance.ease, d3.easeLinear);
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
    sfsGraphPlayEntrance(svg, entrance.threshold, play);
  }

  const xAxis = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(sfsGraphBottomAxis(x, opts));
  const yAxis = svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(sfsGraphLeftAxis(y, opts, sfsGraphValueOr(opts.scale, "proportion")));
  sfsGraphStyleAxis(xAxis);
  sfsGraphStyleAxis(yAxis);

  sfsGraphAddLabels(svg, opts, type, margin, width, height, sfsGraphValueOr(opts.scale, "proportion"));
  sfsGraphAddLegend(svg, series, opts, width, margin);
  return svg.node();
}

