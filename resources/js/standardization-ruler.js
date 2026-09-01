(function(global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const BLOCK_VALUES = [0, 2, 2, 3, 5, 6];
  const PLOT_MARGIN = { top: 42, right: 24, bottom: 12, left: 24 };
  const RULER_EXIT_MS = 1450;
  const RULER_MOVE_MS = 1800;
  const RULER_ENTER_MS = 1550;
  const SCENE_SLIDE_MS = 1550;
  const RULER_REWRITE_MS = 1500;
  const SELECTED_VALUE_MARKER = Object.freeze({
    color: "var(--bc-danger-color, #c63f3f)",
    dash: "6 4",
    strokeWidth: 2.6
  });
  const MATH_HISTOGRAM_Z_CUTS = Object.freeze(
    Array.from({ length: 8 }, function(_, index) { return -3.5 + index; })
  );
  const EASY_MATH_SAMPLE_Z_SCORES = Object.freeze([
    -2.524934322578, -1.5731073284, -1.52, -0.884872872225, -0.7865536642,
    -0.70789829778, -0.639074852163, -0.570251406545, -0.501427960928,
    -0.442436436113, -0.35394914889, -0.27529378247, -0.19663841605,
    -0.11798304963, -0.049159604013, 0.049159604013, 0.11798304963,
    0.19663841605, 0.27529378247, 0.35394914889, 0.442436436113,
    0.501427960928, 0.570251406545, 0.639074852163, 0.70789829778,
    0.7865536642, 0.884872872225, 1.52, 1.5731073284, 2.524934322578
  ]);
  const HARD_MATH_SAMPLE_Z_SCORES = Object.freeze([
    -2.52, -1.558823298262, -1.52, -0.771931444055, -0.709498661851,
    -0.700305717322, -0.61446577104, -0.611742860648, -0.547605156613,
    -0.534786605964, -0.18573102862, -0.183779698753, -0.183159035758,
    -0.106508289186, 0.077747503019, 0.087960863631, 0.098861845586,
    0.108393831719, 0.171684786379, 0.213161857263, 0.313024055556,
    0.507319646026, 0.550816503714, 0.663853738861, 0.696989170682,
    0.706895184448, 0.756458792118, 1.538002145013, 1.547998833874,
    2.709168810183
  ]);
  const Z_SCORE_COVER_COUNTS = Object.freeze([1, 1, 2, 2, 3, 4, 3, 2, 2, 1, 1]);
  const Z_SCORE_COVER_COLORS = Object.freeze([
    "var(--graph-series-1, #0072b2)",
    "var(--graph-series-2, #e69f00)",
    "var(--graph-series-3, #009e73)",
    "var(--graph-series-4, #d55e00)",
    "var(--graph-series-5, #cc79a7)",
    "var(--graph-series-6, #56b4e9)",
    "var(--graph-series-7, #f0e442)"
  ]);

  const RULERS = {
    blockRaw: {
      label: "Original scores · μ = 3 · σ = 2",
      compactLabel: "Original · μ 3 · σ 2",
      ticks: [0, 1, 2, 3, 4, 5, 6],
      position: function(value) { return (value - 3) / 2; }
    },
    blockZ: {
      label: "z-scores · μ = 0 · σ = 1",
      compactLabel: "z-scores · μ 0 · σ 1",
      ticks: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5],
      position: function(value) { return value; }
    },
    testRaw: {
      label: "Hypothetical test scores · μ = 70 · σ = 5",
      compactLabel: "Test scores · μ 70 · σ 5",
      ticks: [60, 65, 70, 75, 80],
      position: function(value) { return (value - 70) / 5; }
    },
    testWorking: {
      label: "z-scores · μ = 0 · σ = 1",
      compactLabel: "z-scores · μ 0 · σ 1",
      ticks: [-2, -1, 0, 1, 2],
      position: function(value) { return value; }
    }
  };

  const WORKING_RULER_MODES = {
    z: Object.assign({}, RULERS.testWorking, {
      multiplier: 1,
      offset: 0
    }),
    iqScaled: {
      label: "After × 15 · μ = 0 · σ = 15",
      compactLabel: "× 15 · μ 0 · σ 15",
      ticks: [-30, -15, 0, 15, 30],
      position: function(value) { return value / 15; },
      multiplier: 15,
      offset: 0
    },
    iq: {
      label: "IQ scale · μ = 100 · σ = 15",
      compactLabel: "IQ scale · μ 100 · σ 15",
      ticks: [70, 85, 100, 115, 130],
      position: function(value) { return (value - 100) / 15; },
      multiplier: 15,
      offset: 100
    },
    satScaled: {
      label: "After × 100 · μ = 0 · σ = 100",
      compactLabel: "× 100 · μ 0 · σ 100",
      ticks: [-200, -100, 0, 100, 200],
      position: function(value) { return value / 100; },
      multiplier: 100,
      offset: 0
    },
    sat: {
      label: "SAT scale · μ = 500 · σ = 100",
      compactLabel: "SAT scale · μ 500 · σ 100",
      ticks: [300, 400, 500, 600, 700],
      position: function(value) { return (value - 500) / 100; },
      multiplier: 100,
      offset: 500
    }
  };

  function selectedValueMarker(spec) {
    return Object.assign({}, SELECTED_VALUE_MARKER, spec || {});
  }

  function rulerConfig(name, rulerMode) {
    if (name === "testWorking") {
      return WORKING_RULER_MODES[rulerMode] || WORKING_RULER_MODES.z;
    }
    return RULERS[name];
  }

  function rewriteOperation(previousMode, nextMode) {
    if (previousMode === "z" && nextMode === "iqScaled") return "× 15";
    if (previousMode === "iqScaled" && nextMode === "iq") return "+ 100";
    if (previousMode === "z" && nextMode === "satScaled") return "× 100";
    if (previousMode === "satScaled" && nextMode === "sat") return "+ 500";
    return "";
  }

  function rulerCounterFrames(previousMode, nextMode) {
    const zTicks = WORKING_RULER_MODES.z.ticks;
    const previous = rulerConfig("testWorking", previousMode);
    const next = rulerConfig("testWorking", nextMode);

    if (previous.offset === next.offset && previous.multiplier !== next.multiplier) {
      return Array.from({ length: 21 }, function(_, index) {
        const progress = index / 20;
        const factor = Math.round(
          previous.multiplier + (next.multiplier - previous.multiplier) * progress
        );
        return {
          ticks: zTicks.map(function(value) { return value * factor + next.offset; }),
          operation: "× " + factor
        };
      });
    }

    if (previous.multiplier === next.multiplier && previous.offset !== next.offset) {
      return Array.from({ length: 21 }, function(_, index) {
        const progress = index / 20;
        const addend = Math.round(previous.offset + (next.offset - previous.offset) * progress);
        return {
          ticks: zTicks.map(function(value) { return value * next.multiplier + addend; }),
          operation: (addend < 0 ? "− " : "+ ") + Math.abs(addend)
        };
      });
    }

    const fromTicks = previous.ticks;
    const toTicks = next.ticks;
    const operation = rewriteOperation(previousMode, nextMode);
    return Array.from({ length: 21 }, function(_, index) {
      const progress = index / 20;
      return {
        ticks: fromTicks.map(function(value, tickIndex) {
          return Math.round(value + (toTicks[tickIndex] - value) * progress);
        }),
        operation
      };
    });
  }

  function svgElement(name, attributes) {
    const node = document.createElementNS(SVG_NS, name);
    Object.entries(attributes || {}).forEach(function(entry) {
      node.setAttribute(entry[0], String(entry[1]));
    });
    return node;
  }

  function motionAllows(requested) {
    const runtime = global.interactiveRuntime;
    if (runtime && runtime.motion && typeof runtime.motion.shouldAnimate === "function") {
      return runtime.motion.shouldAnimate(requested);
    }
    return requested !== false && !(global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function setupTutorial(rootNode, applyAction, opts) {
    const api = global.interactiveFigure;
    if (!api || typeof api.createTutorial !== "function" || opts.tutorial === false) return;

    let attempts = 0;
    function setup() {
      attempts += 1;
      if (!rootNode.isConnected) {
        if (attempts < 60) global.requestAnimationFrame(setup);
        return;
      }

      const callout = rootNode.closest(".callout");
      const footer = callout ? callout.querySelector(".callout-footer") : null;
      if (!footer || footer.dataset.bcIfTutorial === "true") return;
      const steps = Array.from(footer.children).filter(function(child) {
        return child.classList && child.classList.contains("tutorial-step");
      });
      if (!steps.length) return;

      api.createTutorial({
        root: rootNode,
        footer,
        steps,
        startIndex: opts.tutorialStartIndex,
        applyInitialAction: opts.tutorialApplyInitialAction,
        applyAction
      });
    }

    global.requestAnimationFrame(setup);
  }

  function stripPlotAxis(svg, selector) {
    const axis = svg.querySelector(selector);
    if (!axis) return;
    axis.classList.add("sr-plot-baseline");
    axis.querySelectorAll(".tick").forEach(function(tick) { tick.remove(); });
  }

  function sharedBlockPlot(width) {
    if (typeof global.makeGraph !== "function") {
      throw new Error("The standardization tutorial requires makeGraph().");
    }
    const svg = global.makeGraph({
      type: "block",
      data: BLOCK_VALUES,
      xDomain: [-2, 8],
      yDomain: [0, 2],
      width,
      margin: PLOT_MARGIN,
      title: "The same six observations",
      xLabel: false,
      yLabel: false,
      responsive: false,
      animate: false,
      referenceMarkers: [
        {
          value: 3,
          label: "mean = 3",
          color: "var(--graph-text-color)",
          dash: "3 4"
        },
        selectedValueMarker({
          value: 5,
          label: "X = 5"
        })
      ],
      ariaLabel: "Block histogram of scores 0, 2, 2, 3, 5, and 6. The mean is 3 and score 5 is marked."
    });
    const axes = Array.from(svg.querySelectorAll(".bc-graph-axis"));
    if (axes[0]) stripPlotAxis(svg, ".bc-graph-axis");
    axes.slice(1).forEach(function(axis) { axis.remove(); });
    svg.classList.add("sr-shared-plot", "sr-block-plot");
    svg.setAttribute("aria-hidden", "true");
    svg.removeAttribute("role");
    return svg;
  }

  function sharedCurvePlot(width, height) {
    if (typeof global.makeDistributionGraph !== "function") {
      throw new Error("The standardization tutorial requires makeDistributionGraph().");
    }
    const figure = global.makeDistributionGraph({
      distribution: "normal",
      mean: 70,
      sd: 5,
      xDomain: [57.5, 82.5],
      width,
      height,
      margin: PLOT_MARGIN,
      title: "The same smooth distribution",
      style: "minimal",
      xAxis: true,
      yAxis: false,
      axisLabels: false,
      tickLabels: false,
      responsive: false,
      animate: false,
      markers: [
        {
          at: 70,
          label: "mean = 70",
          height: "full",
          color: "var(--graph-text-color)",
          dash: "3 4",
          strokeWidth: 1.4
        },
        selectedValueMarker({
          at: 80,
          label: "X = 80",
          height: 0.66
        })
      ],
      ariaLabel: "Normal curve centered at 70 with standard deviation 5. Score 80 is marked."
    });
    const svg = figure.querySelector("svg");
    stripPlotAxis(svg, ".dg-x-axis");
    svg.classList.add("sr-shared-plot", "sr-curve-plot");
    svg.setAttribute("aria-hidden", "true");
    svg.removeAttribute("role");
    return svg;
  }

  function finiteNumbers(values) {
    return (Array.isArray(values) ? values : [])
      .map(Number)
      .filter(Number.isFinite);
  }

  function distributionSummary(values, convention) {
    const data = finiteNumbers(values);
    const mean = data.length
      ? data.reduce(function(sum, value) { return sum + value; }, 0) / data.length
      : NaN;
    const sampleConvention = convention === "sample";
    const denominator = sampleConvention ? data.length - 1 : data.length;
    const variance = denominator > 0
      ? data.reduce(function(sum, value) {
        const deviation = value - mean;
        return sum + deviation * deviation;
      }, 0) / denominator
      : NaN;
    return {
      mean,
      sd: Number.isFinite(variance) ? Math.sqrt(variance) : NaN
    };
  }

  function mathTestReferenceConfig(testName) {
    const name = String(testName || "").toLowerCase();
    const hard = name === "hard";
    if (!hard && name !== "easy") {
      throw new Error("A math-test histogram requires test: 'easy' or test: 'hard'.");
    }

    const mean = hard ? 100 : 10;
    const sd = hard ? 15 : 1;
    const standardized = hard ? HARD_MATH_SAMPLE_Z_SCORES : EASY_MATH_SAMPLE_Z_SCORES;
    const data = standardized.map(function(z) { return mean + z * sd; });
    const cuts = MATH_HISTOGRAM_Z_CUTS.map(function(z) { return mean + z * sd; });
    const xTickValues = [-3, -2, -1, 0, 1, 2, 3]
      .map(function(z) { return mean + z * sd; });
    const observed = hard ? 70 : 8;
    const label = hard ? "Hard" : "Easy";

    return {
      key: hard ? "hard" : "easy",
      title: label + " math test",
      mean,
      sd,
      data,
      cuts,
      xDomain: [cuts[0], cuts[cuts.length - 1]],
      xTickValues,
      zTickValues: [-3, -2, -1, 0, 1, 2, 3],
      observed,
      observedLabel: "X = " + observed,
      xLabel: label + "-test completion time (seconds)",
      ariaLabel: "Histogram of completion times for a sample of 30 earlier test takers on the " +
        name + " math test. The sample mean is " + mean + " seconds and the " +
        "sample standard deviation is " + sd + " " + (sd === 1 ? "second" : "seconds") +
        ". A vertical line marks " +
        observed + " seconds, which is two standard deviations below the mean."
    };
  }

  function referenceMarkers(markers) {
    const values = Array.isArray(markers) ? markers : markers ? [markers] : [];
    return values.map(function(marker) {
      const normalized = Object.assign({}, marker);
      if (normalized.value === undefined) normalized.value = normalized.at;
      return normalized;
    });
  }

  function dualScaleNumber(value) {
    if (Math.abs(value) < 1e-10) return "0";
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 100) / 100);
  }

  function addDualScaleAxes(svg, opts, geometry, mean, sd) {
    const width = geometry.width;
    const height = geometry.height;
    const margin = geometry.margin;
    const rawY = height - margin.bottom;
    const zY = rawY + 28;
    const x = d3.scaleLinear()
      .domain(opts.xDomain)
      .range([margin.left, width - margin.right]);
    const rawAxisNode = svg.querySelector(".dg-x-axis, .bc-graph-axis");
    const rawAxis = rawAxisNode ? d3.select(rawAxisNode) : null;
    const rawTickValues = finiteNumbers(opts.xTickValues);

    if (rawAxis) {
      const axis = d3.axisBottom(x);
      if (rawTickValues.length) axis.tickValues(rawTickValues);
      else axis.ticks(Number(opts.xTicks) || 5);
      axis.tickFormat(d3.format("~g"));
      rawAxis
        .attr("class", "ss-raw-axis")
        .attr("transform", "translate(0," + rawY + ")")
        .call(axis);
      if (typeof global.bcGraphStyleAxis === "function") global.bcGraphStyleAxis(rawAxis);
    }

    const zTickValues = finiteNumbers(opts.zTickValues).filter(function(value) {
      const rawValue = mean + value * sd;
      return rawValue >= Math.min(opts.xDomain[0], opts.xDomain[1]) - 1e-9 &&
        rawValue <= Math.max(opts.xDomain[0], opts.xDomain[1]) + 1e-9;
    });
    const zRawValues = zTickValues.map(function(value) { return mean + value * sd; });
    const zByRawValue = new Map(zRawValues.map(function(value, index) {
      return [value, zTickValues[index]];
    }));

    const zAxis = d3.select(svg)
      .append("g")
      .attr("class", "ss-z-axis")
      .attr("transform", "translate(0," + zY + ")")
      .call(d3.axisBottom(x)
        .tickValues(zRawValues)
        .tickFormat(function(rawValue) {
          let zValue = zByRawValue.get(rawValue);
          if (zValue === undefined) zValue = (rawValue - mean) / sd;
          return dualScaleNumber(zValue);
        }));
    if (typeof global.bcGraphStyleAxis === "function") global.bcGraphStyleAxis(zAxis);

    const sideLabelX = width - margin.right + 16;
    d3.select(svg).append("text")
      .attr("class", "ss-axis-side-label ss-raw-axis-side-label bc-graph-label")
      .attr("x", sideLabelX)
      .attr("y", rawY + 4)
      .attr("text-anchor", "start")
      .text(opts.rawAxisSideLabel || "(X)");
    d3.select(svg).append("text")
      .attr("class", "ss-axis-side-label ss-z-axis-side-label bc-graph-label")
      .attr("x", sideLabelX)
      .attr("y", zY + 4)
      .attr("text-anchor", "start")
      .text(opts.zAxisSideLabel || "(z)");

    // A marked observation is a correspondence guide too: carry its existing
    // red dashed line past the raw axis to the same position on the z axis.
    d3.select(svg).selectAll(".dg-marker-line")
      .attr("y1", zY);
    d3.select(svg).selectAll(".bc-graph-reference-marker line")
      .attr("y2", zY);

    const annotationLayer = d3.select(svg)
      .append("g")
      .attr("class", "ss-stat-annotations")
      .attr("aria-hidden", "true");
    const sampleConvention = opts.statConvention === "sample";
    const centerSymbol = sampleConvention ? "M" : "μ";
    const spreadSymbol = sampleConvention ? "s" : "σ";
    const guideSpecs = [
      { value: mean - sd, lineClass: "ss-sd-line", label: centerSymbol + " − " + spreadSymbol },
      { value: mean, lineClass: "ss-mean-line", label: centerSymbol },
      { value: mean + sd, lineClass: "ss-sd-line", label: centerSymbol + " + " + spreadSymbol }
    ].filter(function(guide) {
      return guide.value >= Math.min(opts.xDomain[0], opts.xDomain[1]) - 1e-9 &&
        guide.value <= Math.max(opts.xDomain[0], opts.xDomain[1]) + 1e-9;
    });

    const guideGroups = annotationLayer.selectAll("g.ss-stat-guide")
      .data(guideSpecs)
      .join("g")
      .attr("class", "ss-stat-guide");
    guideGroups.append("line")
      .attr("class", function(guide) { return guide.lineClass; })
      .attr("x1", function(guide) { return x(guide.value); })
      .attr("x2", function(guide) { return x(guide.value); })
      .attr("y1", margin.top + 19)
      .attr("y2", zY);
    guideGroups.append("text")
      .attr("class", "ss-stat-label ss-guide-label bc-graph-label")
      .attr("x", function(guide) {
        const position = x(guide.value);
        if (position - margin.left < 44) return position + 4;
        if (width - margin.right - position < 44) return position - 4;
        return position;
      })
      .attr("y", margin.top + 12)
      .attr("text-anchor", function(guide) {
        const position = x(guide.value);
        if (position - margin.left < 44) return "start";
        if (width - margin.right - position < 44) return "end";
        return "middle";
      })
      .text(function(guide) { return guide.label; });

    annotationLayer.raise();
  }

  function standardizedGraphOptions(opts, width, height, margin, mean, sd, animate) {
    const conventionLabel = opts.statConvention === "sample" ? "sample" : "population";
    const ariaLabel = opts.ariaLabel || (opts.title || "Distribution") +
      " with " + conventionLabel + " mean " + dualScaleNumber(mean) +
      " and " + conventionLabel + " standard deviation " +
      dualScaleNumber(sd) + ". The original-score axis is aligned directly above a " +
      "z-score axis with mean 0 and standard deviation 1.";

    if (opts.chart === "block" || opts.chart === "histogram") {
      const graphOptions = {
        type: opts.chart,
        data: finiteNumbers(opts.data),
        xDomain: opts.xDomain,
        xTickValues: opts.xTickValues,
        yDomain: opts.yDomain,
        yTickValues: opts.yTickValues,
        width,
        height,
        margin,
        title: opts.title,
        xLabel: false,
        yLabel: opts.yAxisLabel === undefined ? "Frequency" : opts.yAxisLabel,
        yAxisLine: opts.yAxisLine,
        scaleAspectRatio: opts.chart === "block" && opts.squareScale !== false ? 1 : undefined,
        responsive: false,
        animate,
        ariaLabel
      };
      if (opts.chart === "histogram") {
        graphOptions.cuts = finiteNumbers(opts.cuts);
        graphOptions.bins = opts.bins;
        graphOptions.binWidth = opts.binWidth;
        graphOptions.binStart = opts.binStart;
        graphOptions.binStop = opts.binStop;
        graphOptions.intervalLabels = opts.intervalLabels;
        graphOptions.barGap = opts.barGap;
        graphOptions.referenceMarkers = referenceMarkers(opts.markers);
      }
      return graphOptions;
    }

    return {
      distribution: opts.distribution || "normal",
      mean,
      sd,
      xDomain: opts.xDomain,
      xTicks: opts.xTicks || (Array.isArray(opts.xTickValues) ? opts.xTickValues.length : 7),
      width,
      height,
      margin,
      title: opts.title,
      style: "minimal",
      xAxis: true,
      yAxis: false,
      axisLabels: false,
      responsive: false,
      animate,
      markers: opts.markers,
      ariaLabel
    };
  }

  global.makeMathTestHistogram = function(opts) {
    opts = opts || {};
    if (typeof global.makeGraph !== "function") {
      throw new Error("Math-test histograms require the shared graph generator.");
    }
    const config = mathTestReferenceConfig(opts.test);
    const dualAxis = opts.standardized === true || opts.dualAxis === true;

    if (dualAxis) {
      if (typeof global.makeStandardizedScoreGraph !== "function") {
        throw new Error("The standardized math-test histogram requires the aligned-axis component.");
      }
      return global.makeStandardizedScoreGraph({
        chart: "histogram",
        title: config.title,
        data: config.data,
        cuts: config.cuts,
        mean: config.mean,
        sd: config.sd,
        statConvention: "sample",
        xDomain: config.xDomain,
        xTickValues: config.xTickValues,
        zTickValues: config.zTickValues,
        yDomain: [0, 15],
        yTickValues: [0, 5, 10, 15],
        rawAxisSideLabel: "(s)",
        markers: [selectedValueMarker({
          at: config.observed,
          label: config.observedLabel,
          dx: -6,
          anchor: "end"
        })],
        animate: opts.animate === true,
        maxWidth: opts.maxWidth,
        ariaLabel: config.ariaLabel + " The raw-score ruler is aligned above a " +
          "z-score ruler, where the marked time corresponds to z equals negative 2."
      });
    }

    const graph = global.makeGraph({
      type: "histogram",
      data: config.data,
      cuts: config.cuts,
      xDomain: config.xDomain,
      xTickValues: config.xTickValues,
      yDomain: [0, 15],
      yTickValues: [0, 5, 10, 15],
      width: Number(opts.width) || 640,
      height: Number(opts.height) || 380,
      maxWidth: opts.maxWidth || "42rem",
      cssMargin: "0 auto",
      labels: { x: config.xLabel, y: "Frequency" },
      referenceMarkers: [selectedValueMarker({
        value: config.observed,
        label: config.observedLabel
      })],
      animate: opts.animate !== false,
      animationThreshold: Number.isFinite(Number(opts.visibilityThreshold))
        ? Number(opts.visibilityThreshold)
        : 0.8,
      ariaLabel: config.ariaLabel
    });
    graph.value = {
      test: config.key,
      n: config.data.length,
      data: config.data.slice(),
      cuts: config.cuts.slice(),
      mean: config.mean,
      sd: config.sd,
      statConvention: "sample",
      observed: config.observed,
      z: (config.observed - config.mean) / config.sd
    };
    return graph;
  };

  global.makeZScoreCover = function(opts) {
    opts = opts || {};
    const api = global.interactiveFigure;
    if (api && typeof api.ensureStyles === "function") api.ensureStyles();
    if (typeof global.makeGraph !== "function") {
      throw new Error("The z-score cover requires the shared graph generator.");
    }

    const rootNode = document.createElement("div");
    rootNode.className = "z-score-cover bc-figure bc-figure-cover bc-if-root";
    rootNode.style.setProperty("--bc-figure-max-width", opts.maxWidth || "46rem");

    let layoutController = null;
    let hasRendered = false;
    let settleCurrent = function() {};

    function positiveOption(value, fallback) {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : fallback;
    }

    function render(width) {
      if (hasRendered) settleCurrent();
      const drawWidth = Math.max(280, Math.round(width));
      const compact = drawWidth < 420;
      const margin = {
        top: compact ? 18 : 22,
        right: compact ? 18 : 26,
        bottom: compact ? 74 : 80,
        left: compact ? 18 : 26
      };
      const domain = [-7.5, 7.5];
      const yDomain = [0, 4.5];
      const plotWidth = drawWidth - margin.left - margin.right;
      const height = Math.ceil(
        margin.top + margin.bottom + plotWidth * (yDomain[1] - yDomain[0]) /
          (domain[1] - domain[0])
      );
      const rawY = height - margin.bottom;
      const rulerGap = compact ? 31 : 35;
      const zY = rawY + rulerGap;
      const x = d3.scaleLinear()
        .domain(domain)
        .range([margin.left, drawWidth - margin.right]);
      const y = d3.scaleLinear()
        .domain(yDomain)
        .range([rawY, margin.top]);
      const shouldAnimate = motionAllows(opts.animate !== false && !hasRendered);
      const blockDuration = positiveOption(opts.blockDuration, 1600);
      const rulerPauseValue = Number(opts.rulerPause);
      const rulerPause = Number.isFinite(rulerPauseValue)
        ? Math.max(0, rulerPauseValue)
        : 120;
      const rulerDuration = positiveOption(opts.rulerDuration, 720);
      const threshold = Number.isFinite(Number(opts.visibilityThreshold))
        ? Number(opts.visibilityThreshold)
        : 0.3;
      const ariaLabel = opts.ariaLabel ||
        "A colorful mound of 22 blocks above two aligned rulers. Their shared center " +
        "is labeled X on the original-score ruler and z on the standardized ruler, " +
        "showing that standardization relabels positions without moving the data.";
      const blockData = Z_SCORE_COVER_COUNTS.flatMap(function(count, index) {
        const value = index - (Z_SCORE_COVER_COUNTS.length - 1) / 2;
        return Array.from({ length: count }, function() { return value; });
      });

      const figure = global.makeGraph({
        type: "block",
        data: blockData,
        xDomain: domain,
        xTickValues: [0],
        yDomain,
        yTickValues: [],
        width: drawWidth,
        height,
        margin,
        xLabel: false,
        yLabel: false,
        yAxisLine: false,
        responsive: false,
        animate: shouldAnimate,
        animationThreshold: threshold,
        blockFallOrder: "random",
        blockFallSeed: "z-score-cover-blocks-v1",
        fallStagger: positiveOption(opts.fallStagger, 42),
        blockStroke: "var(--bc-bg)",
        ariaLabel
      });
      figure.classList.add("zsc-source-graph");

      const svg = figure;
      const graphAxes = Array.from(svg.querySelectorAll(".bc-graph-axis"));
      const rawAxis = d3.select(graphAxes[0]);
      graphAxes.slice(1).forEach(function(axis) { axis.remove(); });
      d3.select(svg).on("click", null).style("cursor", null);

      d3.select(svg).selectAll(".bc-graph-block")
        .style("fill", function(datum) {
          const colorIndex = (datum.rowIndex + datum.blockIndex * 2) %
            Z_SCORE_COVER_COLORS.length;
          return Z_SCORE_COVER_COLORS[colorIndex];
        });

      rawAxis
        .attr("class", "zsc-axis zsc-raw-axis")
        .attr("transform", "translate(0," + rawY + ")")
        .call(d3.axisBottom(x)
          .tickValues([0])
          .tickSize(7)
          .tickFormat(function() { return "X"; }));
      if (typeof global.bcGraphStyleAxis === "function") {
        global.bcGraphStyleAxis(rawAxis);
      }
      rawAxis.selectAll("text").classed("zsc-math-label", true);
      rawAxis.select(".bc-graph-domain")
        .attr("d", "M" + margin.left + ",0H" + (drawWidth - margin.right));

      const zAxis = d3.select(svg)
        .append("g")
        .attr("class", "zsc-axis zsc-z-axis")
        .call(d3.axisBottom(x)
          .tickValues([0])
          .tickSize(7)
          .tickFormat(function() { return "z"; }));
      if (typeof global.bcGraphStyleAxis === "function") {
        global.bcGraphStyleAxis(zAxis);
      }
      zAxis.selectAll("text").classed("zsc-math-label", true);
      zAxis.select(".bc-graph-domain")
        .attr("d", "M" + margin.left + ",0H" + (drawWidth - margin.right));

      function finish() {
        d3.select(figure).selectAll("*").interrupt();
        d3.select(svg).selectAll(".bc-graph-block")
          .attr("y", function(datum) { return y(datum.blockUpper); });
        zAxis
          .interrupt()
          .attr("transform", "translate(0," + zY + ")")
          .style("opacity", 1);
      }

      function playRuler() {
        zAxis
          .interrupt()
          .attr("transform", "translate(0," + rawY + ")")
          .style("opacity", 0)
          .transition()
          .delay(blockDuration + rulerPause)
          .duration(rulerDuration)
          .ease(d3.easeCubicOut)
          .attr("transform", "translate(0," + zY + ")")
          .style("opacity", 1);
      }

      if (shouldAnimate) {
        zAxis
          .attr("transform", "translate(0," + rawY + ")")
          .style("opacity", 0);
        if (typeof global.bcDistributionOnVisible === "function") {
          global.bcDistributionOnVisible(figure, playRuler, threshold);
        } else if (typeof global.onVisible === "function") {
          global.onVisible(figure, playRuler, threshold);
        } else {
          global.requestAnimationFrame(playRuler);
        }
      } else {
        finish();
      }

      settleCurrent = finish;
      rootNode.replaceChildren(figure);
      hasRendered = true;
      rootNode.value = {
        rawLabel: "X",
        standardizedLabel: "z",
        center: 0,
        blocks: blockData.length
      };
      rootNode.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (api && typeof api.observeResponsiveLayout === "function") {
      layoutController = api.observeResponsiveLayout({
        root: rootNode,
        container: rootNode,
        compactBelow: 420,
        minimumWidth: 280,
        maximumWidth: 736,
        widthStep: 2,
        onLayout: function(layout) { render(layout.width); }
      });
    } else {
      render(Number(opts.width) || 720);
    }

    if (api && typeof api.adopt === "function") {
      api.adopt(rootNode, {
        cancelMotion: function() { settleCurrent(); },
        dispose: function() {
          if (layoutController && typeof layoutController.dispose === "function") {
            layoutController.dispose();
          }
        }
      });
    }

    return rootNode;
  };

  global.makeStandardizedScoreGraph = function(opts) {
    opts = opts || {};
    const api = global.interactiveFigure;
    if (api && typeof api.ensureStyles === "function") api.ensureStyles();
    if (typeof global.makeGraph !== "function" || typeof global.makeDistributionGraph !== "function") {
      throw new Error("Standardized-score graphs require the shared graph generators.");
    }

    const statConvention = opts.statConvention === "sample" ? "sample" : "population";
    const summary = distributionSummary(opts.data, statConvention);
    const mean = Number.isFinite(Number(opts.mean)) ? Number(opts.mean) : summary.mean;
    const sd = Number.isFinite(Number(opts.sd)) ? Number(opts.sd) : summary.sd;
    if (!Number.isFinite(mean) || !Number.isFinite(sd) || sd <= 0) {
      throw new Error("A standardized-score graph requires a finite mean and a standard deviation greater than zero.");
    }

    const rootNode = document.createElement("div");
    rootNode.className = "standardized-score-graph bc-figure bc-if-root";
    rootNode.style.setProperty("--bc-figure-max-width", opts.maxWidth || "32rem");
    let firstDraw = true;
    let layoutController = null;

    function render(width) {
      const drawWidth = Math.max(260, Math.round(width));
      const margin = {
        top: opts.title ? 44 : 28,
        right: 58,
        bottom: 64,
        left: opts.chart === "block" || opts.chart === "histogram" ? 58 : 24
      };
      const explicitHeight = Number(opts.height);
      let height = Number.isFinite(explicitHeight) && explicitHeight > 0
        ? explicitHeight
        : 297;
      if (opts.chart === "block" && opts.squareScale !== false) {
        const xSpan = Math.abs(Number(opts.xDomain[1]) - Number(opts.xDomain[0]));
        const ySpan = Math.abs(Number(opts.yDomain[1]) - Number(opts.yDomain[0]));
        const plotWidth = Math.max(1, drawWidth - margin.left - margin.right);
        if (Number.isFinite(xSpan) && xSpan > 0 && Number.isFinite(ySpan) && ySpan > 0) {
          height = Math.ceil(margin.top + margin.bottom + plotWidth * ySpan / xSpan);
        }
      }
      height = Math.max(160, height);
      const graphOpts = standardizedGraphOptions(
        opts, drawWidth, height, margin, mean, sd, firstDraw && opts.animate !== false
      );
      const graph = opts.chart === "block" || opts.chart === "histogram"
        ? global.makeGraph(graphOpts)
        : global.makeDistributionGraph(graphOpts);
      const svg = graph.tagName && graph.tagName.toLowerCase() === "svg"
        ? graph
        : graph.querySelector("svg");
      addDualScaleAxes(svg, opts, { width: drawWidth, height, margin }, mean, sd);
      graph.classList.add("ss-source-graph");
      rootNode.replaceChildren(graph);
      firstDraw = false;

      rootNode.value = {
        chart: opts.chart === "block" || opts.chart === "histogram"
          ? opts.chart
          : "distribution",
        mean,
        sd,
        statConvention,
        zMean: 0,
        zSd: 1,
        domain: opts.xDomain.slice()
      };
      rootNode.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (api && typeof api.observeResponsiveLayout === "function") {
      layoutController = api.observeResponsiveLayout({
        root: rootNode,
        container: rootNode,
        compactBelow: 360,
        minimumWidth: 260,
        maximumWidth: 512,
        widthStep: 2,
        onLayout: function(layout) { render(layout.width); }
      });
    } else {
      render(Number(opts.width) || 480);
    }

    if (api && typeof api.adopt === "function") {
      api.adopt(rootNode, {
        dispose: function() {
          if (layoutController && typeof layoutController.dispose === "function") {
            layoutController.dispose();
          }
        }
      });
    }

    return rootNode;
  };

  global.makeStandardizationRuler = function(opts) {
    opts = opts || {};
    const api = global.interactiveFigure;
    if (api && typeof api.ensureStyles === "function") api.ensureStyles();

    const rootNode = document.createElement("div");
    rootNode.className = "standardization-ruler bc-figure bc-if-root";
    rootNode.style.setProperty("--bc-figure-max-width", opts.maxWidth || "46rem");

    const chartWrap = document.createElement("div");
    chartWrap.className = "sr-chart-wrap bc-chart-wrap";
    rootNode.appendChild(chartWrap);

    const plotStage = document.createElement("div");
    plotStage.className = "sr-plot-stage";
    const blockLayer = document.createElement("div");
    blockLayer.className = "sr-plot-layer sr-block-layer";
    const curveLayer = document.createElement("div");
    // Keep the shared distribution wrapper class around the extracted SVG so
    // the generator's canonical curve and marker styles continue to apply.
    curveLayer.className = "sr-plot-layer sr-curve-layer distribution-graph";
    plotStage.append(blockLayer, curveLayer);

    const rulerSvg = svgElement("svg", {
      class: "sr-ruler-svg bc-svg bc-graph",
      role: "img",
      "aria-label": "Six scores shown above a ruler labeled with their original values."
    });
    chartWrap.append(plotStage, rulerSvg);

    const rulerLayer = svgElement("g", { class: "sr-rulers" });
    rulerSvg.appendChild(rulerLayer);
    const rulerNodes = new Map();
    Object.keys(RULERS).forEach(function(name) {
      const group = svgElement("g", {
        class: "sr-ruler sr-ruler-" + name,
        "aria-hidden": "true"
      });
      group.dataset.ruler = name;
      rulerLayer.appendChild(group);
      rulerNodes.set(name, group);
    });

    let geometry = null;
    let state = null;
    let pendingMotion = Promise.resolve();
    let activeAnimations = [];
    const rulerPositions = new Map();
    let renderedWorkingMode = "z";

    function cancelMotion() {
      activeAnimations.forEach(function(animation) {
        try { animation.cancel(); } catch (error) { /* already finished */ }
      });
      activeAnimations = [];
      rootNode.querySelectorAll(".sr-ruler-operation").forEach(function(operation) {
        operation.textContent = "";
        operation.style.opacity = "0";
      });
      if (api && typeof api.cancelTransitions === "function") {
        api.cancelTransitions(rootNode);
      }
      pendingMotion = Promise.resolve();
    }

    rootNode.addEventListener("bc-if:cancel-transitions", function(event) {
      if (event.target !== rootNode) return;
      activeAnimations.forEach(function(animation) {
        try { animation.cancel(); } catch (error) { /* already finished */ }
      });
      activeAnimations = [];
      pendingMotion = Promise.resolve();
    });

    function animateStyles(node, from, to, timing) {
      Object.assign(node.style, to);
      const duration = timing && Number(timing.duration) || 0;
      if (!duration || typeof node.animate !== "function") return null;
      const animation = node.animate([from, to], {
        duration,
        delay: Math.max(0, Number(timing.delay) || 0),
        easing: timing.easing || "cubic-bezier(.42,0,.18,1)",
        fill: "backwards"
      });
      activeAnimations.push(animation);
      return animation;
    }

    function formatRulerValue(value) {
      return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
    }

    function drawRuler(name, group, requestedMode) {
      group.replaceChildren();
      const config = rulerConfig(name, requestedMode);
      const board = svgElement("rect", {
        class: "sr-ruler-board",
        x: geometry.left - 9,
        y: -10,
        width: geometry.plotWidth + 18,
        height: 38,
        rx: 4
      });
      const title = svgElement("text", {
        class: "sr-ruler-title bc-graph-label",
        x: geometry.left,
        y: -17
      });
      title.textContent = geometry.compact ? config.compactLabel : config.label;
      const operation = svgElement("text", {
        class: "sr-ruler-operation bc-graph-label",
        x: geometry.right,
        y: -17,
        "text-anchor": "end",
        "aria-hidden": "true"
      });
      group.append(board, title, operation);

      const scale = d3.scaleLinear()
        .domain([-2.5, 2.5])
        .range([geometry.left, geometry.right]);
      const normalizedTicks = config.ticks.map(config.position);
      const tickLabel = function(position) {
        const index = normalizedTicks.findIndex(function(candidate) {
          return Math.abs(candidate - position) < 1e-7;
        });
        const value = config.ticks[Math.max(0, index)];
        return formatRulerValue(value);
      };
      const axis = d3.select(group)
        .append("g")
        .attr("class", "sr-ruler-axis")
        .call(d3.axisBottom(scale)
          .tickValues(normalizedTicks)
          .tickFormat(tickLabel));
      if (typeof global.bcGraphStyleAxis === "function") {
        global.bcGraphStyleAxis(axis);
      }
    }

    function rewriteWorkingRuler(previousMode, nextMode, animate) {
      if (previousMode === nextMode) return [];
      const group = rulerNodes.get("testWorking");
      const config = rulerConfig("testWorking", nextMode);
      const title = group.querySelector(".sr-ruler-title");
      const labels = Array.from(group.querySelectorAll(".sr-ruler-axis .bc-graph-tick-label"));
      const operation = group.querySelector(".sr-ruler-operation");
      const finalTitle = geometry.compact ? config.compactLabel : config.label;
      renderedWorkingMode = nextMode;

      function applyValues(values) {
        labels.forEach(function(label, index) {
          label.textContent = formatRulerValue(values[index]);
        });
      }

      function applyFinalState() {
        title.textContent = finalTitle;
        applyValues(config.ticks);
        operation.textContent = "";
        operation.style.opacity = "0";
      }

      if (!animate || typeof global.requestAnimationFrame !== "function") {
        applyFinalState();
        return [];
      }

      const frames = rulerCounterFrames(previousMode, nextMode);
      let frameRequest = null;
      let startTime = null;
      let lastFrameIndex = -1;
      let complete = false;
      let resolveFinished = null;
      const finished = new Promise(function(resolve) { resolveFinished = resolve; });

      function finish() {
        if (complete) return;
        complete = true;
        if (frameRequest !== null && typeof global.cancelAnimationFrame === "function") {
          global.cancelAnimationFrame(frameRequest);
        }
        applyFinalState();
        resolveFinished();
      }

      function advance(time) {
        if (complete) return;
        if (startTime === null) startTime = time;
        const progress = Math.min(1, Math.max(0, (time - startTime) / RULER_REWRITE_MS));
        const frameIndex = Math.min(
          frames.length - 1,
          Math.floor(progress * frames.length)
        );
        if (frameIndex !== lastFrameIndex) {
          lastFrameIndex = frameIndex;
          const frame = frames[frameIndex];
          applyValues(frame.ticks);
          operation.textContent = frame.operation;
          operation.style.opacity = frame.operation ? "1" : "0";
        }
        if (progress >= 1) {
          finish();
          return;
        }
        frameRequest = global.requestAnimationFrame(advance);
      }

      const counterAnimation = {
        finished,
        cancel: finish
      };
      frameRequest = global.requestAnimationFrame(advance);
      activeAnimations.push(counterAnimation);
      return [counterAnimation];
    }

    function rebuildSharedPlots(width) {
      const blockPlot = sharedBlockPlot(width);
      const viewBox = blockPlot.viewBox && blockPlot.viewBox.baseVal;
      const height = Math.round(viewBox && viewBox.height || 160);
      const curvePlot = sharedCurvePlot(width, height);
      blockLayer.replaceChildren(blockPlot);
      curveLayer.replaceChildren(curvePlot);
      plotStage.style.height = height + "px";
      geometry.plotHeight = height;
    }

    function drawGeometry(layout) {
      cancelMotion();
      const width = Math.max(280, Math.round(layout.width));
      const rulerHeight = layout.compact ? 142 : 148;
      geometry = {
        compact: layout.compact,
        width,
        rulerHeight,
        left: PLOT_MARGIN.left,
        right: width - PLOT_MARGIN.right,
        primaryY: layout.compact ? 35 : 38,
        secondaryY: layout.compact ? 102 : 107
      };
      geometry.plotWidth = geometry.right - geometry.left;
      rebuildSharedPlots(width);

      rulerSvg.setAttribute("width", String(width));
      rulerSvg.setAttribute("height", String(rulerHeight));
      rulerSvg.setAttribute("viewBox", "0 0 " + width + " " + rulerHeight);
      rulerNodes.forEach(function(group, name) {
        drawRuler(name, group, state && state.rulerMode);
      });
      renderedWorkingMode = state && state.rulerMode || "z";
      if (state) renderState(state, false, true);
    }

    function slotFor(name, nextState) {
      if (name === nextState.primary) return "primary";
      if (name === nextState.secondary) return "secondary";
      return "hidden";
    }

    function targetY(slot, previous) {
      if (slot === "primary") return geometry.primaryY;
      if (slot === "secondary") return geometry.secondaryY;
      if (previous && previous.slot === "primary") return -46;
      if (previous && previous.slot === "hidden") return previous.y;
      return geometry.secondaryY + 52;
    }

    function accessibleDescription(nextState) {
      if (nextState.scene === "blocks" && nextState.secondary === null) {
        return "Block histogram of six scores above an original-score ruler. The mean is 3, the standard deviation is 2, and score 5 is marked.";
      }
      if (nextState.scene === "blocks") {
        return "The same block histogram above two aligned rulers. Original score 3 aligns with z equals 0, and original score 5 aligns with z equals 1.";
      }
      if (nextState.focus === "testRaw") {
        return "A normal test-score curve above its original ruler. The mean is 70, the standard deviation is 5, and score 80 is marked.";
      }
      if (nextState.focus === "testWorking" && nextState.rulerMode === "z") {
        return "The same curve above aligned raw-score and z-score rulers. Score 70 aligns with z equals 0, and score 80 aligns with z equals 2.";
      }
      if (nextState.rulerMode === "iqScaled") {
        return "The same curve above two aligned rulers. The grey raw-score ruler still labels the marked position 80, while the transformed lower ruler labels it 30 after multiplying every z-score by 15.";
      }
      if (nextState.rulerMode === "iq") {
        return "The same curve above two aligned rulers. The grey raw-score ruler still labels the marked position 80, while the IQ ruler labels it 130 after adding 100.";
      }
      if (nextState.rulerMode === "satScaled") {
        return "The same curve above two aligned rulers. The grey raw-score ruler still labels the marked position 80, while the transformed lower ruler labels it 200 after multiplying every z-score by 100.";
      }
      return "The same curve above two aligned rulers. The grey raw-score ruler still labels the marked position 80, while the SAT ruler labels it 700 after adding 500.";
    }

    function renderRulers(nextState, previousState, animate) {
      const sceneChanged = previousState && previousState.scene !== nextState.scene;
      const sceneDirection = nextState.scene === "curve" ? 1 : -1;
      const transitions = Array.from(rulerNodes.keys()).map(function(name) {
        const previous = rulerPositions.get(name) || {
          slot: "hidden",
          y: geometry.secondaryY + 52,
          opacity: 0
        };
        const slot = slotFor(name, nextState);
        return {
          name,
          previous,
          slot,
          y: targetY(slot, previous),
          opacity: slot === "hidden" ? 0 : 1
        };
      });
      const fullSwap = transitions.some(function(item) {
        return item.previous.slot !== "hidden" && item.slot === "hidden";
      }) && transitions.some(function(item) {
        return item.previous.slot === "secondary" && item.slot === "primary";
      }) && transitions.some(function(item) {
        return item.previous.slot === "hidden" && item.slot === "secondary";
      });
      const condensingPair = !sceneChanged && transitions.some(function(item) {
        return item.previous.slot !== "hidden" && item.slot === "hidden";
      }) && transitions.some(function(item) {
        return item.previous.slot === "secondary" && item.slot === "primary";
      }) && !transitions.some(function(item) {
        return item.previous.slot === "hidden" && item.slot !== "hidden";
      });

      const animations = [];
      transitions.forEach(function(item) {
        const group = rulerNodes.get(item.name);
        const entering = item.previous.slot === "hidden" && item.slot !== "hidden";
        const exiting = item.previous.slot !== "hidden" && item.slot === "hidden";
        const moving = item.previous.slot !== "hidden" && item.slot !== "hidden" &&
          item.previous.slot !== item.slot;
        const changed = item.previous.y !== item.y || item.previous.opacity !== item.opacity;
        let from = {
          transform: "translate(0px, " + item.previous.y + "px)",
          opacity: String(item.previous.opacity)
        };
        let to = {
          transform: "translate(0px, " + item.y + "px)",
          opacity: String(item.opacity)
        };
        let timing = { duration: 0, delay: 0 };
        if (animate && sceneChanged && exiting) {
          to = {
            transform: "translate(" + (-sceneDirection * geometry.width) + "px, " + item.previous.y + "px)",
            opacity: "0"
          };
          timing = { duration: SCENE_SLIDE_MS, delay: 0 };
        } else if (animate && sceneChanged && entering) {
          from = {
            transform: "translate(" + (sceneDirection * geometry.width) + "px, " + item.y + "px)",
            opacity: "0"
          };
          timing = { duration: SCENE_SLIDE_MS, delay: 180 };
        } else if (animate && changed) {
          if (entering) {
            timing = { duration: RULER_ENTER_MS, delay: fullSwap ? 400 : 120 };
          } else if (exiting) {
            timing = { duration: RULER_EXIT_MS, delay: 0 };
          } else if (moving) {
            timing = { duration: RULER_MOVE_MS, delay: fullSwap ? 150 : condensingPair ? 280 : 0 };
          } else {
            timing = { duration: RULER_MOVE_MS, delay: 0 };
          }
        }
        if (!(sceneChanged && exiting)) {
          group.classList.toggle("is-focus", item.name === nextState.focus);
          group.classList.toggle("is-reference", item.slot !== "hidden" && item.name !== nextState.focus);
        }
        group.setAttribute("aria-hidden", item.slot === "hidden" ? "true" : "false");
        const animation = animateStyles(group, from, to, timing);
        if (animation) animations.push(animation);
        rulerPositions.set(item.name, {
          slot: item.slot,
          y: item.y,
          opacity: item.opacity
        });
      });
      return animations;
    }

    function renderPlot(nextState, previousState, animate) {
      const showBlocks = nextState.scene === "blocks";
      const sceneChanged = previousState && previousState.scene !== nextState.scene;
      const animations = [];
      let blockFrom = { opacity: blockLayer.style.opacity || (showBlocks ? "1" : "0"), transform: "translateX(0px)" };
      let blockTo = { opacity: showBlocks ? "1" : "0", transform: "translateX(0px)" };
      let curveFrom = { opacity: curveLayer.style.opacity || (showBlocks ? "0" : "1"), transform: "translateX(0px)" };
      let curveTo = { opacity: showBlocks ? "0" : "1", transform: "translateX(0px)" };
      let blockTiming = { duration: 0, delay: 0 };
      let curveTiming = { duration: 0, delay: 0 };

      if (animate && sceneChanged) {
        const direction = nextState.scene === "curve" ? 1 : -1;
        const outgoing = showBlocks ? curveLayer : blockLayer;
        const incoming = showBlocks ? blockLayer : curveLayer;
        const outgoingFrom = { opacity: "1", transform: "translateX(0px)" };
        const outgoingTo = {
          opacity: "0",
          transform: "translateX(" + (-direction * geometry.width) + "px)"
        };
        const incomingFrom = {
          opacity: "0",
          transform: "translateX(" + (direction * geometry.width) + "px)"
        };
        const incomingTo = { opacity: "1", transform: "translateX(0px)" };
        if (outgoing === blockLayer) {
          blockFrom = outgoingFrom;
          blockTo = outgoingTo;
          blockTiming = { duration: SCENE_SLIDE_MS, delay: 0 };
          curveFrom = incomingFrom;
          curveTo = incomingTo;
          curveTiming = { duration: SCENE_SLIDE_MS, delay: 180 };
        } else {
          curveFrom = outgoingFrom;
          curveTo = outgoingTo;
          curveTiming = { duration: SCENE_SLIDE_MS, delay: 0 };
          blockFrom = incomingFrom;
          blockTo = incomingTo;
          blockTiming = { duration: SCENE_SLIDE_MS, delay: 180 };
        }
      }

      const blockAnimation = animateStyles(blockLayer, blockFrom, blockTo, blockTiming);
      const curveAnimation = animateStyles(curveLayer, curveFrom, curveTo, curveTiming);
      if (blockAnimation) animations.push(blockAnimation);
      if (curveAnimation) animations.push(curveAnimation);
      return animations;
    }

    function renderState(nextState, requestedAnimation, fromResize) {
      if (!geometry) {
        state = nextState;
        return;
      }
      const previousState = state;
      const animate = !fromResize && motionAllows(requestedAnimation);
      cancelMotion();
      state = nextState;
      const animations = renderPlot(nextState, previousState, animate)
        .concat(renderRulers(nextState, previousState, animate));
      const workingWasVisible = previousState &&
        (previousState.primary === "testWorking" || previousState.secondary === "testWorking");
      const workingWillBeVisible = nextState.primary === "testWorking" ||
        nextState.secondary === "testWorking";
      const sceneChanged = previousState && previousState.scene !== nextState.scene;
      if (renderedWorkingMode !== nextState.rulerMode && !(sceneChanged && workingWasVisible)) {
        animations.push.apply(animations, rewriteWorkingRuler(
          renderedWorkingMode,
          nextState.rulerMode,
          animate && workingWasVisible && workingWillBeVisible
        ));
      }
      activeAnimations = animations;
      pendingMotion = animations.length
        ? Promise.allSettled(animations.map(function(animation) { return animation.finished; }))
        : Promise.resolve();

      rootNode.dataset.scene = nextState.scene;
      rootNode.dataset.primaryRuler = nextState.primary;
      rootNode.dataset.secondaryRuler = nextState.secondary || "none";
      rootNode.dataset.focus = nextState.focus;
      rootNode.dataset.rulerMode = nextState.rulerMode;
      rulerSvg.setAttribute("aria-label", accessibleDescription(nextState));
      rootNode.value = {
        scene: nextState.scene,
        rulers: [nextState.primary, nextState.secondary].filter(Boolean),
        rulerMode: nextState.rulerMode,
        focus: nextState.focus,
        rawScore: nextState.scene === "blocks" ? 5 : 80,
        zScore: nextState.scene === "blocks" ? 1 : 2,
        iqScaledScore: nextState.scene === "curve" ? 30 : null,
        iqScore: nextState.scene === "curve" ? 130 : null,
        satScaledScore: nextState.scene === "curve" ? 200 : null,
        satScore: nextState.scene === "curve" ? 700 : null
      };
      rootNode.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function normalizeAction(action) {
      action = action || {};
      const scene = action.scene === "curve" ? "curve" : "blocks";
      const defaults = scene === "curve"
        ? { primary: "testRaw", secondary: null, focus: "testRaw" }
        : { primary: "blockRaw", secondary: null, focus: "blockRaw" };
      const primary = Object.hasOwn(RULERS, action.primary) ? action.primary : defaults.primary;
      const secondary = action.secondary === null
        ? null
        : (Object.hasOwn(RULERS, action.secondary) ? action.secondary : defaults.secondary);
      const focus = Object.hasOwn(RULERS, action.focus) ? action.focus : defaults.focus;
      const rulerMode = Object.hasOwn(WORKING_RULER_MODES, action.rulerMode)
        ? action.rulerMode
        : "z";
      return { scene, primary, secondary, focus, rulerMode };
    }

    function applyTutorialAction(action, context) {
      const nextState = normalizeAction(action);
      renderState(nextState, action && action.animate, false);
      if (context && context.signal) {
        context.signal.addEventListener("abort", cancelMotion, { once: true });
      }
    }

    const initialState = normalizeAction(opts.initialState || {
      scene: "curve",
      primary: "testRaw",
      secondary: null,
      focus: "testRaw",
      rulerMode: "z"
    });
    state = initialState;

    if (api && typeof api.observeResponsiveLayout === "function") {
      api.observeResponsiveLayout({
        root: rootNode,
        container: chartWrap,
        compactBelow: 470,
        minimumWidth: 280,
        maximumWidth: 736,
        widthStep: 1,
        onLayout: drawGeometry
      });
    } else {
      drawGeometry({ width: 700, compact: false });
    }

    rootNode.standardizationRuler = {
      applyTutorialAction,
      getState: function() { return Object.assign({}, state); }
    };

    if (api && typeof api.adopt === "function") {
      api.adopt(rootNode, {
        whenReady: function() { return pendingMotion; },
        cancelMotion,
        dispose: cancelMotion
      });
    }

    setupTutorial(rootNode, applyTutorialAction, opts);
    return rootNode;
  };
})(window);
