// See resources/js/GRAPHS.md for module boundaries and compatibility.
sfsToneIdentificationData = [
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

sfsToneIdentificationGroupedCenters = (data = sfsToneIdentificationData) => {
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
  const data = Array.isArray(opts.data) ? opts.data : sfsToneIdentificationData;
  const centers = sfsToneIdentificationGroupedCenters(data);
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
        color: "var(--sfs-danger-color, #c63f3f)",
        anchor: "start",
        dx: 6
      }
    ];
  }

  return makeGraph(config);
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
    blockStroke: "var(--sfs-control-bg)",
    blockFill: "var(--sfs-text)",
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

// Two samples accumulating as blocks, using the histogram's existing geometry.
makeSampleComparisonCover = (opts = {}) => {
  const related = opts.related === true;
  const colors = ["var(--graph-series-1, #0072b2)",
    related ? "var(--graph-series-6, #56b4e9)" : "var(--graph-series-4, #d55e00)"];
  const binWidth = 0.12;
  const series = [-0.48, 0.48].map((mean, index) => {
    const random = sfsGraphSeededRandom(related ? 137 : 81 + index);
    const normal = d3.randomNormal.source(random)(0, 1);
    const bins = d3.bin().domain([-3.6, 3.6]).thresholds(d3.range(-3.6, 3.61, binWidth))(
      d3.range(350).map(normal));
    return { color: colors[index], data: bins.map((bin) => ({
      lower: bin.x0 + mean, upper: bin.x1 + mean, frequency: bin.length
    })) };
  });
  const root = d3.create("div").attr("class", "sfs-figure sfs-figure-cover sample-comparison-cover");
  const svg = d3.select(makeGraph({
    type: "block", series, width: 900, responsive: false,
    // One bin across equals one observation up: square, edge-to-edge blocks.
    scaleAspectRatio: binWidth, overlayWidth: 1, seriesOffset: 0,
    xDomain: [-4.2, 4.2], margin: { top: 14, right: 14, bottom: 14, left: 14 },
    xTickValues: [], yTickValues: [], legend: false, xLabel: false, yLabel: false, blockGap: 0,
    blockStroke: "var(--sfs-bg, white)", animate: false,
    ariaLabel: opts.ariaLabel || (related
      ? "Two overlapping block distributions in distinct shades of blue representing paired samples."
      : "Two overlapping block distributions in blue and vermilion representing independent samples.")
  }));
  svg.selectAll(".sfs-graph-axis, .sfs-graph-grid").remove();
  root.node().appendChild(svg.node());
  const blocks = svg.selectAll("rect.sfs-graph-block").style("stroke-width", 0.6);
  const ranks = sfsGraphBlockFallRanks(blocks.data(), { blockFallOrder: "random", seed: 92 });
  const orderedBlocks = blocks.nodes().sort((a, b) => ranks.get(a.__data__) - ranks.get(b.__data__));
  const count = orderedBlocks.length;
  let visibleCount = count;
  const timeline = interactiveFigure.coverTimeline(root.node(), {
    duration: 1900, animate: opts.animate !== false,
    draw(elapsed) {
      const shown = Math.floor(count * Math.min(1, elapsed / 1900));
      // Touch only blocks whose visibility changes, including on replay.
      for (let i = Math.min(shown, visibleCount); i < Math.max(shown, visibleCount); i += 1) {
        orderedBlocks[i].setAttribute("opacity", i < shown ? "1" : "0");
      }
      visibleCount = shown;
    }
  });
  root.node().value = { related, ...timeline };
  return root.node();
}
