// Chapter 14's "two estimates of the same variance" figure. Groups are sampled
// from populations the reader can see (the ANOVA explorer's lanes: a
// population curve behind each group's dots), and the two mean squares are
// drawn as squares around a dashed outline of the population variance σ².
// Each sample's F drops into a tracker below, as Chapter 7's sample means do.
//
// The scores are μ + effect·c_g + σ·z, with the z's fixed per sample index.
// So changing σ or the effect reshapes the same sample rather than drawing a
// new one: more spread scales both mean squares together (F unchanged), and a
// bigger effect grows only MS between.

// The arithmetic, kept free of the DOM so the tests can check it.
window.sfsAnovaTwoEstimates = (function() {
  const sampling = window.sfsSampling;

  // Population centers, evenly spaced and balanced around μ, so that the
  // most extreme two are `effect` apart.
  function contrasts(k) {
    return d3Range(k).map((g) => k === 1 ? 0 : g / (k - 1) - 0.5);
  }

  function d3Range(n) {
    return Array.from({ length: n }, (_, i) => i);
  }

  function standardScores(seed, sampleIndex, k, n) {
    const rng = sampling.seededRng(`${seed}:${sampleIndex}`);
    return d3Range(k).map(() => d3Range(n).map(() => sampling.fastNormalDraw(rng)));
  }

  function scores(z, params) {
    const c = contrasts(z.length);
    return z.map((group, g) => group.map((value) => params.mu + params.effect * c[g] + params.sd * value));
  }

  function summarize(groups) {
    const k = groups.length;
    const n = groups.map((group) => group.length);
    const N = n.reduce((a, b) => a + b, 0);
    const means = groups.map((group) => group.reduce((a, b) => a + b, 0) / group.length);
    const grandMean = groups.flat().reduce((a, b) => a + b, 0) / N;
    const ssBetween = means.reduce((sum, m, g) => sum + n[g] * (m - grandMean) ** 2, 0);
    const ssWithin = groups.reduce((sum, group, g) => sum + group.reduce((s, x) => s + (x - means[g]) ** 2, 0), 0);
    const dfBetween = k - 1;
    const dfWithin = N - k;
    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;
    return { means, grandMean, ssBetween, ssWithin, dfBetween, dfWithin, msBetween, msWithin, f: msBetween / msWithin };
  }

  return { contrasts, standardScores, scores, summarize };
})();

window.makeAnovaTwoEstimates = function(opts) {
  opts = opts || {};
  const core = window.sfsAnovaTwoEstimates;
  const visuals = window.sfsSamplingVisuals;
  const stats = window.sfsStats;
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  visuals.ensureStyles();

  const names = Array.isArray(opts.groups) && opts.groups.length >= 2 ? opts.groups.map(String) : ["Group 1", "Group 2"];
  const k = names.length;
  const n = Math.max(2, Math.round(finite(opts.n, 4)));
  const seed = String(opts.seed || "anova-two-estimates-v1");
  const mu = finite(opts.mu, 250);
  const xMin = finite(opts.xMin, mu - 170);
  const xMax = finite(opts.xMax, mu + 170);
  // The squares share one area scale across every state, so a mean square
  // that doubles really is drawn twice as big. msMax fills the panel.
  const msMax = finite(opts.msMax, 12000);
  // The F tracker's axis; larger Fs stack in its last bin.
  const fMax = finite(opts.fMax, 15);
  const binWidth = finite(opts.binWidth, 0.5);
  const maxSamples = Math.max(1, Math.round(finite(opts.maxSamples, 400)));
  const dfBetween = k - 1;
  const dfWithin = k * (n - 1);

  // Reference spread: population curves are drawn at this σ's full height,
  // and a wider population is a lower one, as a density should be.
  const sdReference = finite(opts.sd, 36);
  const state = {
    effect: finite(opts.effect, 0),
    sd: sdReference,
    samples: Math.max(1, Math.min(maxSamples, Math.round(finite(opts.samples, 1)))),
    showSigma: opts.showSigma === true,
    showEstimates: opts.showEstimates !== false,
    showTracker: opts.showTracker === true,
    showCurve: opts.showCurve === true
  };

  const zCache = new Map();
  function zFor(s) {
    if (!zCache.has(s)) zCache.set(s, core.standardScores(seed, s, k, n));
    return zCache.get(s);
  }
  function summaryFor(s, effect = state.effect) {
    return core.summarize(core.scores(zFor(s), { mu, effect, sd: state.sd }));
  }

  const fFormat = d3.format(".2f");
  const msFormat = (value) => d3.format(",.0f")(value);
  const colors = [
    "var(--graph-series-1, #0072b2)",
    "var(--graph-series-2, #e69f00)",
    "var(--graph-series-3, #009e73)",
    "var(--graph-series-4, #d55e00)"
  ];

  const root = d3.create("div")
    .attr("class", "anova-two-estimates sfs-sampling-figure sfs-figure")
    .style("--ate-max-width", opts.maxWidth || null);
  const rootNode = root.node();

  // Colours and lane styling follow the ANOVA explorer: between is the effect
  // purple, within the current red, and the grand mean the muted total.
  root.append("style").text(`
    .anova-two-estimates {
      --sfs-figure-max-width: var(--ate-max-width, 52rem);
      --ate-total: var(--sfs-muted, #68727d);
      --ate-within: var(--sfs-current-color, #d1495b);
      --ate-between: var(--sfs-effect-color, #7654b5);
    }
    .anova-two-estimates svg { display: block; width: 100%; height: auto; overflow: visible; }
    .anova-two-estimates .ate-lane { stroke: color-mix(in srgb, var(--sfs-border, #c8cdd2) 70%, transparent); stroke-width: 1; }
    .anova-two-estimates .ate-pop-area { fill: var(--ate-pop); opacity: 0.1; transition: fill 700ms ease; }
    .anova-two-estimates .ate-pop-line { fill: none; stroke: var(--ate-pop); stroke-width: 2.2; opacity: 0.75; transition: stroke 700ms ease; }
    .anova-two-estimates .ate-population { --ate-pop: var(--ate-group); }
    /* One population: every lane's curve is the same grey. */
    .anova-two-estimates .ate-population.is-shared { --ate-pop: var(--ate-total); }
    .anova-two-estimates .ate-group-label { font-size: var(--sfs-figure-label-size, 0.875rem); font-weight: 700; }
    .anova-two-estimates .ate-dot { stroke: var(--bs-body-bg, #fff); stroke-width: 2; }
    .anova-two-estimates .ate-mean-line { stroke-width: 2.5; stroke-dasharray: 5 4; }
    .anova-two-estimates .ate-grand-line { stroke: var(--ate-total); stroke-width: 2.5; stroke-dasharray: 8 5; }
    .anova-two-estimates .ate-arm { stroke: var(--ate-between); stroke-width: 3; opacity: 0.85; }
    .anova-two-estimates .ate-within-line { stroke: var(--ate-within); stroke-width: 1.5; opacity: 0.6; }
    .anova-two-estimates .ate-axis path,
    .anova-two-estimates .ate-axis line { stroke: var(--sfs-border, #c8cdd2); }
    .anova-two-estimates .ate-axis text { fill: var(--sfs-muted, #68727d); font-size: var(--sfs-figure-tick-size, 0.8125rem); }
    .anova-two-estimates .ate-axis-label { fill: currentColor; font-size: var(--sfs-figure-label-size, 0.875rem); }
    .anova-two-estimates .ate-panel-title { fill: currentColor; font-size: var(--sfs-figure-title-size, 1rem); font-weight: 750; }
    .anova-two-estimates .ate-square { stroke-width: 1.25; }
    .anova-two-estimates .ate-square.is-between { fill: color-mix(in srgb, var(--ate-between) 18%, transparent); stroke: var(--ate-between); }
    .anova-two-estimates .ate-square.is-within { fill: color-mix(in srgb, var(--ate-within) 18%, transparent); stroke: var(--ate-within); }
    .anova-two-estimates .ate-sigma { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-dasharray: 5 4; opacity: 0.7; }
    .anova-two-estimates .ate-sigma-label { fill: var(--sfs-muted, #68727d); font-size: var(--sfs-figure-small-size, 0.75rem); }
    .anova-two-estimates .ate-ms-label { font-size: var(--sfs-figure-label-size, 0.875rem); font-weight: 720; }
    .anova-two-estimates .ate-ms-label.is-between { fill: var(--ate-between); }
    .anova-two-estimates .ate-ms-label.is-within { fill: var(--ate-within); }
    .anova-two-estimates .ate-ms-value { fill: var(--sfs-muted, #68727d); font-size: var(--sfs-figure-small-size, 0.75rem); font-variant-numeric: tabular-nums; }
    .anova-two-estimates .ate-f { font-size: var(--sfs-figure-title-size, 1rem); font-weight: 700; font-variant-numeric: tabular-nums; }
    .anova-two-estimates .ate-bar { fill: var(--graph-block-fill, var(--sfs-text, currentColor)); opacity: 0.86; shape-rendering: crispEdges; }
    /* The newest F and its slice share one accent, so the reader can see
       where this sample landed. Not Ch 7's red: red means within here. */
    .anova-two-estimates .ate-f,
    .anova-two-estimates .ate-bar.is-current { fill: var(--sfs-accent, #2c7fb8); opacity: 1; }
    .anova-two-estimates .ate-f-curve { fill: none; stroke: var(--sfs-null-color, currentColor); stroke-width: 2; }
  `);

  const chartWrap = root.append("div").attr("class", "ate-chart-wrap sfs-chart-wrap");
  const svg = chartWrap.append("svg").attr("class", "sfs-svg sfs-graph").attr("role", "img");
  const svgTitle = svg.append("title");

  // The estimates go first so that, on a phone, a square too big for its
  // strip grows up behind the axis label rather than over it.
  const estimatesLayer = svg.append("g").attr("class", "sfs-if-reveal").attr("aria-hidden", "true");
  const laneLayer = svg.append("g");
  const axisLayer = svg.append("g").attr("class", "ate-axis").attr("aria-hidden", "true");
  const axisLabel = svg.append("text").attr("class", "ate-axis-label").attr("text-anchor", "middle").text(opts.axisLabel || "Score");
  const trackerClipId = `ate-clip-${Math.round(Math.random() * 1e9)}`;
  const trackerClip = svg.append("defs").append("clipPath").attr("id", trackerClipId).append("rect");
  const trackerGroup = svg.append("g").attr("class", "sfs-if-reveal");

  const x = d3.scaleLinear().domain([xMin, xMax]);
  const fx = d3.scaleLinear().domain([0, fMax]);
  // The tracker is a plain histogram of F, styled like Chapter 7's tracker
  // panels, with its dashed line at F = 1. Each bar leaves off the newest
  // sample, which sits on top of its bar as a slice in the accent colour.
  const trackerLabel = trackerGroup.append("text").attr("class", "bcs-panel-label").text(opts.trackerLabel || "F from each sample");
  const trackerNote = trackerGroup.append("text").attr("class", "bcs-panel-note");
  const oneLine = trackerGroup.append("line").attr("class", "bcs-mu-line");
  const barsLayer = trackerGroup.append("g");
  const currentBar = trackerGroup.append("rect").attr("class", "ate-bar is-current");
  const trackerAxis = trackerGroup.append("g").attr("class", "bcs-axis sfs-axis");
  const trackerAxisLabel = trackerGroup.append("text").attr("class", "bcs-panel-note").attr("text-anchor", "middle").text("F");
  const curvePath = trackerGroup.append("path").attr("class", "ate-f-curve sfs-if-reveal").attr("clip-path", `url(#${trackerClipId})`);

  // Estimates panel: an outline of σ² around each mean square, both centred
  // on one point. The outline is drawn over the square so it shows through a
  // bigger one; the title and F come last so a large square never covers them.
  // Before the estimates arrive, σ² is shown alone: both outlines sit on one
  // spot, and they split apart when the mean squares join them.
  const estimateGroups = ["between", "within"].map((kind) => {
    const g = estimatesLayer.append("g");
    const square = g.append("rect").attr("class", `ate-square is-${kind}`);
    const sigma = g.append("rect").attr("class", "ate-sigma");
    const sigmaLabel = g.append("text").attr("class", "ate-sigma-label").attr("text-anchor", "end").text("σ²");
    const text = g.append("g");
    const label = text.append("text").attr("class", `ate-ms-label is-${kind}`).attr("text-anchor", "middle").text(kind === "between" ? "MS between" : "MS within");
    const value = text.append("text").attr("class", "ate-ms-value").attr("text-anchor", "middle");
    return { kind, g, sigma, sigmaLabel, square, text, label, value };
  });
  const sigmaTitle = estimatesLayer.append("text").attr("class", "ate-panel-title").text(opts.sigmaLabel || "Population variance");
  const sigmaValue = estimatesLayer.append("text").attr("class", "ate-ms-value").attr("text-anchor", "middle");
  const estimatesTitle = estimatesLayer.append("text").attr("class", "ate-panel-title").text(opts.estimatesLabel || "Two estimates of σ²");
  const fText = estimatesLayer.append("text").attr("class", "ate-f");

  let width = finite(opts.width, 760);
  let layout = null;

  function computeLayout() {
    const wide = width >= 620;
    const laneH = wide ? 76 : 64;
    const top = wide ? 16 : 6;
    const labelW = wide ? 96 : 0;
    const lanesLeft = wide ? labelW + 8 : 12;
    const lanesRight = wide ? Math.round(width * 0.6) : width - 12;
    const laneTop = top + (wide ? 18 : 30);
    const lanesBottom = laneTop + k * laneH;
    const axisY = lanesBottom + 4;
    const lanesEnd = axisY + 44;
    // Estimates sit to the right of the lanes, or below them on a phone.
    // There they get a short strip sized for the usual squares: σ² and the
    // estimates around it. A square bigger than the strip spills a little
    // past it, behind the title and labels (capped at sideCap), instead of
    // pushing everything below it down.
    const estLeft = wide ? lanesRight + 36 : 12;
    const estRight = width - 12;
    const estTop = wide ? top : lanesEnd + 16;
    const maxSide = wide ? Math.max(60, Math.min((estRight - estLeft - 24) / 2, 170)) : 100;
    const estBase = estTop + (wide ? 40 + maxSide : 92);
    const estMid = estBase - (wide ? maxSide / 2 : 42);
    const sideCap = wide ? maxSide + 24 : 104;
    const estEnd = estBase + (wide ? 64 : 44);
    const trackerTop = Math.max(lanesEnd, estEnd) + 18;
    // On a phone the sample count shares the tracker's label row.
    const trackerPlotTop = trackerTop + (wide ? 34 : 14);
    const trackerBase = trackerTop + (wide ? 190 : 140);
    const height = trackerBase + 50;
    return { wide, laneH, top, lanesLeft, lanesRight, laneTop, lanesBottom, axisY, estLeft, estRight, estTop, maxSide, sideCap, estBase, estMid, trackerTop, trackerPlotTop, trackerBase, height, plotLeft: 12, plotRight: width - 12 };
  }

  function laneY(g) {
    return layout.laneTop + (g + 0.5) * layout.laneH;
  }

  function sideFor(ms) {
    return layout.maxSide * Math.sqrt(Math.max(0, ms) / msMax);
  }

  function populationPoints(g) {
    const c = core.contrasts(k)[g];
    const center = mu + state.effect * c;
    const base = laneY(g) + layout.laneH * 0.32;
    const height = layout.laneH * 0.62 * (sdReference / state.sd);
    return d3.range(xMin, xMax + 0.01, (xMax - xMin) / 160).map((value) => ({
      x: x(value),
      y: base - height * Math.exp(-0.5 * ((value - center) / state.sd) ** 2),
      base
    }));
  }

  function stackDots(values, g) {
    const r = 6;
    const placed = [];
    return values.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value).map((d) => {
      let level = 0;
      while (placed.some((p) => p.level === level && Math.abs(x(p.value) - x(d.value)) < 2 * r + 1)) level += 1;
      placed.push({ value: d.value, level });
      return { g, i: d.i, value: d.value, y: laneY(g) - level * (2 * r + 1) };
    });
  }

  // Counts per bin of the first `count` samples' Fs, and the newest one's bin.
  // `effect` defaults to the current one.
  function trackerCounts(count, effect) {
    const bins = Math.round(fMax / binWidth);
    const counts = new Array(bins).fill(0);
    const fs = [];
    let newestBin = 0;
    for (let s = 1; s <= count; s += 1) {
      const f = summaryFor(s, effect).f;
      newestBin = Math.min(Math.floor(Math.max(0, f) / binWidth), bins - 1);
      counts[newestBin] += 1;
      fs.push(f);
    }
    return { counts, fs, newestBin, maxCount: Math.max(1, ...counts) };
  }

  function describe(summary) {
    const pops = state.effect === 0
      ? `All ${k} groups are sampled from one population`
      : `The ${k} groups are sampled from populations whose means differ by up to ${d3.format("~g")(state.effect)}`;
    return `${pops}, with σ = ${d3.format("~g")(state.sd)}, so σ² = ${msFormat(state.sd ** 2)}. ` +
      `In this sample MS between is ${msFormat(summary.msBetween)} and MS within is ${msFormat(summary.msWithin)}, so F = ${fFormat(summary.f)}. ` +
      (state.showTracker ? `${state.samples} samples so far.` : "");
  }

  function setValue(summary, fs) {
    rootNode.value = {
      effect: state.effect,
      sd: state.sd,
      sigma2: state.sd ** 2,
      samples: state.samples,
      msBetween: summary.msBetween,
      msWithin: summary.msWithin,
      f: summary.f,
      dfBetween,
      dfWithin,
      shareAboveCritical: fs.length ? fs.filter((f) => f > stats.f.inv(0.95, dfBetween, dfWithin)).length / fs.length : null
    };
  }

  function motionAllows(requested) {
    const runtime = window.interactiveRuntime;
    if (runtime && runtime.motion && typeof runtime.motion.shouldAnimate === "function") {
      return runtime.motion.shouldAnimate(requested);
    }
    return requested !== false && !(window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // A change of settings starts the sampling over, so it should not look
  // continuous. The old sample, its estimates and the tracker are left as
  // copies that fade out, while the populations and σ² reshape; the new
  // sample arrives once they have settled.
  const fadeOutMs = 300;
  const arriveMs = 900;
  function sampleParts() {
    return laneLayer.selectAll(".ate-sample").nodes()
      .concat(estimateGroups.flatMap((est) => [est.square.node(), est.text.node()]))
      .concat([fText.node(), trackerNote.node(), barsLayer.node(), currentBar.node(), curvePath.node()]);
  }
  function leaveGhosts() {
    sampleParts().forEach((node) => {
      const copy = node.cloneNode(true);
      // Not an .ate-sample any more, so draw() never selects into a copy.
      copy.classList.remove("ate-sample");
      copy.classList.add("ate-ghost");
      node.parentNode.insertBefore(copy, node);
      d3.select(copy).transition().duration(fadeOutMs).style("opacity", 0).remove();
    });
  }

  // mode: "none" (snap), "morph" (same sample, the σ² outline splitting or
  // rejoining), "swap" (new settings: the old sample fades out and a new one
  // drops in), "sample" (a new sample drops in), or "fast" (one frame of a
  // fast run).
  function draw(mode) {
    layout = computeLayout();
    const L = layout;
    const swap = mode === "swap";
    const duration = mode === "morph" || swap ? 900 : mode === "sample" ? 550 : 0;
    const t = (selection) => duration ? selection.transition().duration(duration).ease(d3.easeCubicInOut) : selection;
    // Parts of the old sample are hidden in a swap, so they move straight to
    // their new places.
    const ts = swap ? (selection) => selection : t;
    svg.selectAll(".ate-ghost").interrupt().remove();
    if (swap) leaveGhosts();
    svg.attr("viewBox", [0, 0, width, L.height]);
    x.range([L.lanesLeft, L.lanesRight]);

    const groups = core.scores(zFor(state.samples), { mu, effect: state.effect, sd: state.sd });
    const summary = core.summarize(groups);

    // Lanes: population behind, sample in front.
    const lanes = laneLayer.selectAll("g.ate-lane-group")
      .data(d3.range(k))
      .join((enter) => {
        const g = enter.append("g").attr("class", "ate-lane-group");
        const pop = g.append("g").attr("class", "ate-population");
        pop.append("path").attr("class", "ate-pop-area");
        pop.append("path").attr("class", "ate-pop-line");
        g.append("line").attr("class", "ate-lane");
        g.append("text").attr("class", "ate-group-label");
        const sample = g.append("g").attr("class", "ate-sample");
        sample.append("g").attr("class", "ate-within-layer");
        sample.append("line").attr("class", "ate-arm");
        sample.append("line").attr("class", "ate-mean-line");
        sample.append("g").attr("class", "ate-dot-layer");
        return g;
      });
    const area = d3.area().x((d) => d.x).y0((d) => d.base).y1((d) => d.y);
    const line = d3.line().x((d) => d.x).y((d) => d.y);
    lanes.each(function(g) {
      const lane = d3.select(this);
      const color = colors[g % colors.length];
      const y = laneY(g);
      const pop = lane.select(".ate-population")
        .classed("is-shared", state.effect === 0)
        .style("--ate-group", color);
      const points = populationPoints(g);
      t(pop.select(".ate-pop-area")).attr("d", area(points));
      t(pop.select(".ate-pop-line")).attr("d", line(points));
      lane.select(".ate-lane").attr("x1", L.lanesLeft).attr("x2", L.lanesRight).attr("y1", y).attr("y2", y);
      lane.select(".ate-group-label")
        .attr("x", L.wide ? L.lanesLeft - 12 : L.lanesLeft)
        .attr("y", L.wide ? y + 5 : y - L.laneH * 0.42)
        .attr("text-anchor", L.wide ? "end" : "start")
        .style("fill", color)
        .text(names[g]);

      const sample = lane.select(".ate-sample");
      const mean = summary.means[g];
      ts(sample.select(".ate-mean-line")).attr("x1", x(mean)).attr("x2", x(mean)).attr("y1", y - 24).attr("y2", y + 22).style("stroke", color);
      ts(sample.select(".ate-arm")).attr("x1", x(summary.grandMean)).attr("x2", x(mean)).attr("y1", y + 16).attr("y2", y + 16);

      const dots = stackDots(groups[g], g);
      const within = sample.select(".ate-within-layer").selectAll("line").data(dots, (d) => d.i)
        .join("line").attr("class", "ate-within-line");
      ts(within).attr("x1", (d) => x(d.value)).attr("x2", x(mean)).attr("y1", (d) => d.y).attr("y2", (d) => d.y);

      const circles = sample.select(".ate-dot-layer").selectAll("circle").data(dots, (d) => d.i)
        .join("circle").attr("class", "ate-dot").attr("r", 6).style("fill", color);
      if (mode === "sample" || swap) {
        // A new sample: each score drops into its lane from the population.
        const start = swap ? arriveMs : 0;
        circles.interrupt().attr("cx", (d) => x(d.value)).attr("cy", (d) => d.y - L.laneH * 0.5).style("opacity", 0)
          .transition().delay((d) => start + d.i * 60).duration(380).ease(d3.easeQuadIn)
          .attr("cy", (d) => d.y).style("opacity", 1);
      } else {
        ts(circles.interrupt().style("opacity", 1)).attr("cx", (d) => x(d.value)).attr("cy", (d) => d.y);
      }
    });

    const grandGroup = laneLayer.selectAll("g.ate-grand").data([0]).join("g").attr("class", "ate-grand ate-sample");
    const grand = grandGroup.selectAll("line").data([0]).join("line").attr("class", "ate-grand-line");
    ts(grand).attr("x1", x(summary.grandMean)).attr("x2", x(summary.grandMean)).attr("y1", L.laneTop - 6).attr("y2", L.lanesBottom);

    axisLayer.attr("transform", `translate(0,${L.axisY})`)
      .call(d3.axisBottom(x).ticks(Math.max(3, Math.floor((L.lanesRight - L.lanesLeft) / 70))).tickSizeOuter(0));
    axisLabel.attr("x", (L.lanesLeft + L.lanesRight) / 2).attr("y", L.axisY + 38);

    // Estimates: each square shares its σ² outline's centre.
    const sigmaSide = sideFor(state.sd ** 2);
    // On a wider phone layout the pair stays together in the middle.
    const colW = Math.min((L.estRight - L.estLeft) / 2, 160);
    const colsLeft = (L.estLeft + L.estRight) / 2 - colW;
    const estMidX = (L.estLeft + L.estRight) / 2;
    sigmaTitle.attr("x", L.estLeft).attr("y", L.estTop + 4);
    estimatesTitle.attr("x", L.estLeft).attr("y", L.estTop + 4);
    sigmaValue.attr("x", estMidX).attr("y", L.estMid + sigmaSide / 2 + 18).text(`σ² = ${msFormat(state.sd ** 2)}`);
    estimateGroups.forEach((est, i) => {
      const cx = state.showEstimates ? colsLeft + colW * (i + 0.5) : estMidX;
      const ms = est.kind === "between" ? summary.msBetween : summary.msWithin;
      const side = Math.min(sideFor(ms), L.sideCap);
      t(est.sigma).attr("x", cx - sigmaSide / 2).attr("y", L.estMid - sigmaSide / 2).attr("width", sigmaSide).attr("height", sigmaSide);
      t(est.sigmaLabel).attr("x", cx + sigmaSide / 2 - 3).attr("y", L.estMid - sigmaSide / 2 - 4);
      ts(est.square).attr("x", cx - side / 2).attr("y", L.estMid - side / 2).attr("width", side).attr("height", side);
      est.label.attr("x", cx).attr("y", L.estBase + (L.wide ? 20 : 24));
      est.value.attr("x", cx).attr("y", L.estBase + (L.wide ? 36 : 39)).text(msFormat(ms));
    });
    // F goes under the squares beside the lanes, and at the end of the title
    // row on a phone.
    fText
      .attr("x", L.wide ? (L.estLeft + L.estRight) / 2 : L.estRight)
      .attr("y", L.wide ? L.estBase + 58 : L.estTop + 4)
      .attr("text-anchor", L.wide ? "middle" : "end")
      .text(`F = ${fFormat(summary.f)}`);

    // Tracker: a histogram of the Fs so far.
    fx.range([L.plotLeft + 8, L.plotRight - 8]);
    const { counts, fs, newestBin } = trackerCounts(state.samples);
    // The height scale is set by the count a run will reach, so bars never
    // shrink as it goes, and by the no-difference histogram, so a real effect
    // or more spread leaves the scale and the F curve where they were: only
    // the bars move. The current counts are checked too, so no bar can
    // outgrow the panel.
    const scaleTo = Math.max(target, state.samples);
    const scaleCount = Math.max(trackerCounts(scaleTo, 0).maxCount, trackerCounts(scaleTo).maxCount);
    const band = L.trackerBase - L.trackerPlotTop - 16;
    const binPx = fx(binWidth) - fx(0);
    const unitHeight = Math.min(binPx, band / scaleCount);
    trackerLabel.attr("x", L.plotLeft).attr("y", L.trackerTop + 4);
    // On a phone the count shares the label row.
    trackerNote
      .attr("x", L.wide ? L.plotLeft : L.plotRight)
      .attr("y", L.trackerTop + (L.wide ? 24 : 4))
      .attr("text-anchor", L.wide ? null : "end")
      .text(`${fs.length} ${fs.length === 1 ? "sample" : "samples"}`);
    oneLine.attr("x1", fx(1)).attr("x2", fx(1)).attr("y1", L.trackerPlotTop).attr("y2", L.trackerBase + 5);
    trackerAxis.attr("transform", `translate(0,${L.trackerBase})`)
      .call(d3.axisBottom(fx).tickSizeOuter(0)
        .tickValues(d3.range(0, fMax + 0.01, fMax > 10 ? 5 : 1).concat([1]).sort((a, b) => a - b))
        .tickFormat((v) => v === fMax ? `${v}+` : d3.format("~g")(v)));
    trackerAxis.selectAll("text").attr("dy", "1em");
    trackerAxisLabel.attr("x", (L.plotLeft + L.plotRight) / 2).attr("y", L.trackerBase + 42);

    // Bars leave out the newest sample; its slice sits on top of its bar.
    const barW = Math.max(1, binPx - 1);
    const below = counts.map((c, bin) => c - (fs.length && bin === newestBin ? 1 : 0));
    const bars = barsLayer.selectAll("rect").data(below).join("rect").attr("class", "ate-bar");
    ts(bars)
      .attr("x", (c, bin) => fx(bin * binWidth) + 0.5)
      .attr("width", barW)
      .attr("y", (c) => L.trackerBase - c * unitHeight)
      .attr("height", (c) => c * unitHeight);
    // A slice under 2.5 px is hard to see, so a thin one is drawn taller,
    // reaching down into its bar rather than above it.
    const sliceTop = L.trackerBase - counts[newestBin] * unitHeight;
    const sliceH = Math.max(unitHeight, 2.5);
    currentBar.interrupt().attr("display", fs.length ? null : "none");
    if (mode === "sample" || mode === "record") {
      currentBar.attr("x", fx(newestBin * binWidth) + 0.5).attr("width", barW)
        .attr("y", sliceTop + sliceH).attr("height", 0)
        .transition().delay(mode === "sample" ? 450 : 150).duration(320).ease(d3.easeCubicOut)
        .attr("y", sliceTop).attr("height", sliceH);
    } else {
      currentBar.attr("x", fx(newestBin * binWidth) + 0.5).attr("width", barW)
        .attr("y", sliceTop).attr("height", sliceH);
    }

    // The null F distribution, scaled to the bars: count per bin = samples
    // × bin width × density.
    trackerClip.attr("x", L.plotLeft).attr("y", L.trackerPlotTop).attr("width", L.plotRight - L.plotLeft).attr("height", L.trackerBase - L.trackerPlotTop);
    const curveData = d3.range(0.02, fMax, 0.05).map((f) => ({
      x: fx(f),
      y: L.trackerBase - fs.length * binWidth * stats.f.pdf(f, dfBetween, dfWithin) * unitHeight
    }));
    curvePath.attr("d", d3.line().x((d) => d.x).y((d) => d.y)(curveData));

    // Named, so the runtime's cancel (which stops unnamed transitions) leaves
    // it alone; any draw that is not a swap clears it.
    const arriving = d3.selectAll(sampleParts()).interrupt("arrive");
    if (swap) {
      arriving.style("opacity", 0)
        .transition("arrive").delay(arriveMs).duration(250).style("opacity", 1)
        .on("end", function() { this.style.opacity = ""; });
    } else {
      arriving.style("opacity", null);
    }

    const reveal = window.interactiveFigure && window.interactiveFigure.setRevealVisible;
    const animate = mode !== "none" && mode !== "fast";
    if (reveal) {
      reveal(estimatesLayer, state.showSigma || state.showEstimates, { root: rootNode, animate });
      const estimateParts = estimateGroups.flatMap((est) => [est.square.node(), est.text.node()]).concat([estimatesTitle.node(), fText.node()]);
      reveal(estimateParts, state.showEstimates, { root: rootNode, animate });
      reveal([sigmaTitle.node(), sigmaValue.node()], !state.showEstimates, { root: rootNode, animate });
      reveal(trackerGroup, state.showTracker, { root: rootNode, animate });
      reveal(curvePath, state.showTracker && state.showCurve, { root: rootNode, animate });
    }

    const description = describe(summary);
    svg.attr("aria-label", description);
    svgTitle.text(description);
    setValue(summary, fs);
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  // Fast runs add one sample per tick until the target, as Chapter 7's
  // "speed things up" step does.
  let timer = null;
  let target = state.samples;
  let renders = 0;
  let mounted = false;
  function stopTimer() {
    if (timer) timer.stop();
    timer = null;
  }

  function startRun() {
    timer = d3.interval(() => {
      state.samples += 1;
      draw("fast");
      if (state.samples >= target) {
        stopTimer();
        notifyValueChange();
      }
    }, 45);
  }

  function render(mode) {
    renders += 1;
    stopTimer();
    if (mode === "restart") {
      // Start the samples over: the old ones fade, the first new sample
      // drops in once the populations have reshaped, then the run refills
      // the tracker.
      state.samples = 1;
      draw("swap");
      timer = d3.timeout(startRun, arriveMs + 600);
      return;
    }
    if (mode === "run" && target > state.samples + 1) {
      startRun();
      return;
    }
    state.samples = target;
    draw(mode === "run" ? "sample" : mode);
  }

  function applyTutorialAction(action) {
    action = action || {};
    const before = { effect: state.effect, sd: state.sd };
    const trackerWasShown = state.showTracker;
    const estimatesWereShown = state.showEstimates;
    if ("effect" in action) state.effect = finite(action.effect, state.effect);
    if ("sd" in action) state.sd = Math.max(1, finite(action.sd, state.sd));
    if ("show-sigma" in action) state.showSigma = Boolean(action["show-sigma"]);
    if ("show-estimates" in action) state.showEstimates = Boolean(action["show-estimates"]);
    if ("show-tracker" in action) state.showTracker = Boolean(action["show-tracker"]);
    if ("show-curve" in action) state.showCurve = Boolean(action["show-curve"]);
    const previous = state.samples;
    if ("samples" in action) {
      // "next" belongs to a data-repeat-action only; every step itself names
      // its sample count.
      target = action.samples === "next"
        ? Math.min(maxSamples, previous + 1)
        : Math.max(1, Math.min(maxSamples, Math.round(finite(action.samples, previous))));
    }
    const animate = mounted && action.animate !== false && motionAllows(true);
    const paramsChanged = before.effect !== state.effect || before.sd !== state.sd;
    let mode = "none";
    if (animate) {
      // "restart" retakes every sample from the first, under the new settings.
      if (action.restart === true && target > 1) mode = "restart";
      else if (target > previous) mode = "run";
      else if (paramsChanged) mode = "swap";
      // The σ² outline splitting in two (or rejoining) is a morph.
      else if (state.showEstimates !== estimatesWereShown) mode = "morph";
      else if (state.showTracker && !trackerWasShown) mode = "record";
    }
    render(mode);
    notifyValueChange();
  }

  // The runtime cancels motion just before each step: finish any fast run at
  // its target unless the next step has already started a fresh render.
  rootNode.addEventListener("sfs-if:cancel-transitions", () => {
    const seen = renders;
    stopTimer();
    window.requestAnimationFrame(() => {
      if (renders === seen) render("none");
    });
  });

  render("none");

  if (window.interactiveFigure && typeof window.interactiveFigure.observeResponsiveLayout === "function") {
    window.interactiveFigure.observeResponsiveLayout({
      root: rootNode,
      container: chartWrap.node(),
      minimumWidth: 280,
      widthStep: 4,
      onLayout(next) {
        mounted = true;
        const w = Math.round(next.width);
        if (w === width) return;
        width = w;
        draw("none");
      }
    });
  } else {
    mounted = true;
  }

  if (window.interactiveFigure) {
    // A stepped explanation with no reader controls; wrap() needs a controls
    // node only to claim the tutorial.
    const controls = root.insert("div", ":first-child").attr("class", "ate-controls").node();
    window.interactiveFigure.wrap({
      root: rootNode,
      controls,
      label: "two estimates controls",
      placement: "callout",
      applyAction: applyTutorialAction,
      startOpen: false
    });
  }

  return rootNode;
};
