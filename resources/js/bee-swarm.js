// Bee-swarm figure: a flocking swarm around a hive as a living model of
// sampling, the null distribution, alpha, and statistical power.
//
// Physics live in bee-swarm-core.js and are numerically frozen (see the
// header there). This module renders the swarm on a transparent canvas that
// deliberately extends 200 sim px above and below the 400 px chart band —
// the prototype's oversized-canvas trick — so bees can wander out of the
// callout, over the surrounding page. The stats overlay (null curve, tails,
// markers, mean line) is SVG so it stays crisp and theme-aware.
//
// Statistics are z-based throughout: the standard error is known a priori
// (calibrated in core SE_VALUES), not estimated per sample, so critical
// bounds come from the normal distribution. The prototype drew its right
// rejection tail with jStat.studentt.pdf (wrong distribution and wrong
// argument signature); both tails here use the normal pdf.
(function() {
  "use strict";

  var STYLE_ID = "bee-swarm-styles";

  var W = 840;                 // sim/band width
  var H = 400;                 // chart band height
  var OVERHANG = 200;          // sim px the swarm canvas extends beyond the band
  var MU0 = W * 0.5;           // null center in band coordinates
  var TICK_MS = 1000 / 60;     // one physics tick = one observation
  var MAX_FRAME_MS = 50;       // dt clamp: no catch-up bursts after suspension
  var FAST_FORWARD_TICKS = 3600; // one simulated minute
  var GHOST_FRAMES = 30;
  var GHOST_FPS = 10;
  var GHOST_TRAIL = 10;        // prototype fade window (frames)
  var CHUNK_TICKS = 60;
  var READOUT_MS = 250;        // donut/value throttle while playing

  // The prototype's ghost replay redraws frames 0..i with a 10-frame alpha
  // fade — cheap on canvas even at 30 frames x 100 bees. Kept as the default
  // for visual fidelity; "fade" uses a destination-out decay instead.
  var GHOST_MODE = "cumulative";

  // When two instances share a page and both are visible, stepping both is
  // still cheap (physics is the minor cost); set true to step only the
  // most-recently-touched instance instead.
  var ARBITRATE_WHEN_ALL_VISIBLE = false;

  var BEE_COLOR = "#f9c901";   // semantic, fixed in both themes
  var HIVE_COLOR = "#926900";

  var instances = [];

  function pokeInstances() {
    for (var index = 0; index < instances.length; index += 1) {
      instances[index].evaluate();
    }
  }

  // Only an actively running fast-forward suspends sibling instances; one
  // paused offscreen (zero-CPU rule) must not deadlock the visible swarm.
  function anyOtherFastForwarding(self) {
    for (var index = 0; index < instances.length; index += 1) {
      if (instances[index] !== self && instances[index].isActivelyFastForwarding()) return true;
    }
    return false;
  }

  function prefersReducedMotion() {
    return window.interactiveRuntime && window.interactiveRuntime.motion
      ? window.interactiveRuntime.motion.isReduced()
      : Boolean(window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".bee-swarm { --sfs-figure-max-width: var(--bs-max-width, 52rem); }",
      ".bee-swarm .bs-chart-wrap { position: relative; overflow: visible; }",
      ".bee-swarm .bs-swarm-canvas {",
      "  position: absolute; left: 0; top: -50%; width: 100%; height: 200%;",
      "  pointer-events: none; z-index: 2;",
      "}",
      ".bee-swarm .sfs-svg { position: relative; z-index: 1; }",
      ".bee-swarm .bs-null-curve { fill: none; stroke: var(--sfs-null-color, currentColor); stroke-width: 1.5; }",
      ".bee-swarm .bs-critical-region { fill: var(--sfs-critical-color, #c63f3f); opacity: 0.35; stroke: none; }",
      ".bee-swarm .bs-hive-marker { fill: " + HIVE_COLOR + "; }",
      ".bee-swarm .bs-null-hive-marker {",
      "  fill: none; stroke: " + HIVE_COLOR + "; stroke-width: 1.5; stroke-dasharray: 3 2;",
      "}",
      ".bee-swarm .bs-mean-line { stroke: " + HIVE_COLOR + "; stroke-width: 1.5; stroke-dasharray: 4 4; }",
      ".bee-swarm .bs-mean-line.is-significant { stroke: var(--sfs-critical-color, #c63f3f); }",
      ".bee-swarm .bs-readouts {",
      "  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;",
      "  gap: 1rem 1.75rem; margin-top: 0.5rem; font-variant-numeric: tabular-nums;",
      "}",
      ".bee-swarm .bs-tracker { display: flex; align-items: center; gap: 0.6rem; }",
      ".bee-swarm .bs-tracker-arc { fill: var(--sfs-critical-color, #c63f3f); }",
      ".bee-swarm .bs-tracker-rest { fill: var(--sfs-border, #ccc); }",
      ".bee-swarm .bs-tracker-value { font-size: 0.95rem; font-weight: 600; fill: currentColor; }",
      ".bee-swarm .bs-readout-stack { display: flex; flex-direction: column; gap: 0.1rem; }",
      ".bee-swarm .bs-readout-label { font-size: 0.72rem; color: var(--sfs-muted, #6c757d); }",
      ".bee-swarm .bs-readout-value { font-size: 0.9rem; }",
      ".bee-swarm .bs-seg { display: flex; gap: 0.25rem; flex-wrap: wrap; }",
      ".bee-swarm .bs-seg .sfs-button[aria-pressed=\"true\"] {",
      "  background: var(--sfs-accent, #2c7fb8); color: var(--sfs-bg, #fff);",
      "  border-color: var(--sfs-accent, #2c7fb8);",
      "}",
      ".bee-swarm .bs-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }",
      ".bee-swarm .bs-row-label { font-size: 0.8rem; min-width: 5.2rem; }",
      ".bee-swarm .bs-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }",
      ".bee-swarm .bs-layer-grid {",
      "  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.25rem 0.9rem;",
      "}",
      ".bee-swarm .bs-layer-grid label {",
      "  display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; margin: 0;",
      "}",
      ".bee-swarm input[type=\"range\"] { flex: 1 1 8rem; min-width: 6rem; }",
      ".bee-swarm[aria-busy=\"true\"] .bs-actions .sfs-button:not(.bs-reset),",
      ".bee-swarm[aria-busy=\"true\"] .bs-seg .sfs-button,",
      ".bee-swarm[aria-busy=\"true\"] input { pointer-events: none; opacity: 0.55; }"
    ].join("\n");
    document.head.appendChild(style);
  }

  window.makeBeeSwarm = function(opts) {
    opts = opts || {};
    ensureStyles();

    var core = window.beeSwarmCore;
    var stats = window.sfsStats;
    var sampling = window.sfsSampling;

    // ---- state -------------------------------------------------------------

    function variabilityIndexFrom(value) {
      var labelIndex = core.VARIABILITY_LABELS.indexOf(String(value).toLowerCase());
      if (labelIndex >= 0) return labelIndex;
      var number = Number(value);
      if (number === 0 || number === 1 || number === 2) return number;
      return 1;
    }

    function nIndexFrom(value) {
      var valueIndex = core.N_BEES_VALUES.indexOf(Number(value));
      if (valueIndex >= 0) return valueIndex;
      var number = Number(value);
      if (number === 0 || number === 1 || number === 2) return number;
      return 1;
    }

    var seed = opts.seed != null ? String(opts.seed) : "bee-swarm-v1";

    var state = {
      variabilityIndex: variabilityIndexFrom(opts.variability),
      nIndex: nIndexFrom(opts.n),
      hiveOffset: Math.max(0, Math.min(100, Number(opts.hiveOffset) || 0)),
      alpha: Number(opts.alpha) > 0 && Number(opts.alpha) < 1 ? Number(opts.alpha) : 0.05,
      playing: Boolean(opts.playing) && !prefersReducedMotion(),
      show: {
        swarm: opts.showSwarm !== false,
        hive: opts.showHive !== false,
        nullHive: Boolean(opts.showNullHive),
        meanLine: Boolean(opts.showMeanLine),
        nullCurve: Boolean(opts.showNullCurve),
        criticalRegions: Boolean(opts.showCriticalRegions),
        histogram: Boolean(opts.showHistogram),
        sigTracker: Boolean(opts.showSignificanceTracker)
      },
      advanceSignature: null
    };

    var derived = { se: 0, sd: 0, d: 0, lowerCrit: 0, upperCrit: 0 };

    var sim = core.createSim({
      seed: seed,
      variabilityIndex: state.variabilityIndex,
      nIndex: state.nIndex,
      hiveOffset: state.hiveOffset
    });
    var hist = new core.Histogram(0, W);
    var sigs = 0;
    var obs = 0;
    var lastMean = MU0;
    var lastSignificant = false;

    function recomputeDerived() {
      derived.se = core.SE_VALUES[state.variabilityIndex][state.nIndex];
      derived.sd = derived.se * Math.sqrt(core.N_BEES_VALUES[state.nIndex]);
      derived.d = state.hiveOffset / derived.sd;
      derived.lowerCrit = stats.normalInv(state.alpha / 2, MU0, derived.se);
      derived.upperCrit = stats.normalInv(1 - state.alpha / 2, MU0, derived.se);
    }
    recomputeDerived();

    function resetStats() {
      hist.reset();
      sigs = 0;
      obs = 0;
      state.advanceSignature = null;
    }

    function stepOnce() {
      var observation = sim.tick();
      hist.add(observation);
      lastMean = observation;
      lastSignificant = observation < derived.lowerCrit || observation > derived.upperCrit;
      obs += 1;
      if (lastSignificant) sigs += 1;
    }

    // ---- DOM ---------------------------------------------------------------

    var root = d3.create("div")
      .attr("class", "bee-swarm sfs-figure")
      .style("--bs-max-width", opts.maxWidth || null);
    var rootNode = root.node();

    var controls = root.append("div").attr("class", "bs-controls");
    var controlsNode = controls.node();

    var chartWrap = root.append("div").attr("class", "bs-chart-wrap sfs-chart-wrap");

    var svg = chartWrap.append("svg")
      .attr("class", "sfs-svg sfs-graph")
      .attr("viewBox", [0, 0, W, H])
      .attr("role", "img")
      .attr("aria-label",
        "Bee swarm simulation: yellow bees flock around a hive; a null " +
        "distribution, critical regions, and a histogram of the swarm's " +
        "mean positions build up below.");

    var yDensity = d3.scaleLinear().domain([0, 0.12]).range([H - 30, H * 0.5]);
    var curveLine = d3.line()
      .x(function(point) { return point.x; })
      .y(function(point) { return yDensity(point.y); });

    var nullCurveLayer = svg.append("g").attr("class", "sfs-if-reveal");
    var nullCurvePath = nullCurveLayer.append("path").attr("class", "bs-null-curve");

    var criticalLayer = svg.append("g").attr("class", "sfs-if-reveal");
    var leftTailPath = criticalLayer.append("path").attr("class", "bs-critical-region");
    var rightTailPath = criticalLayer.append("path").attr("class", "bs-critical-region");

    var nullHiveLayer = svg.append("g").attr("class", "sfs-if-reveal");
    nullHiveLayer.append("rect")
      .attr("class", "bs-null-hive-marker")
      .attr("x", -8).attr("y", -8).attr("width", 16).attr("height", 16)
      .attr("transform", "translate(" + MU0 + "," + (H * 0.5) + ") rotate(45)");

    var hiveLayer = svg.append("g").attr("class", "sfs-if-reveal");
    var hiveMarker = hiveLayer.append("rect")
      .attr("class", "bs-hive-marker")
      .attr("x", -8).attr("y", -8).attr("width", 16).attr("height", 16);

    var meanLayer = svg.append("g").attr("class", "sfs-if-reveal");
    var meanLine = meanLayer.append("line")
      .attr("class", "bs-mean-line")
      .attr("y1", 16).attr("y2", H - 16);

    var canvas = chartWrap.append("canvas")
      .attr("class", "bs-swarm-canvas")
      .attr("aria-hidden", "true")
      .node();
    var ctx = canvas.getContext("2d");

    // Readout row: the significance tracker (donut + elapsed time) is a
    // toggleable reveal layer; d and SE stay visible whenever it is shown.
    var readouts = root.append("div").attr("class", "bs-readouts sfs-readout sfs-if-reveal");
    var tracker = readouts.append("div").attr("class", "bs-tracker");
    var trackerSvg = tracker.append("svg")
      .attr("width", 76).attr("height", 76).attr("viewBox", [-38, -38, 76, 76])
      .attr("aria-hidden", "true");
    var trackerRest = trackerSvg.append("path").attr("class", "bs-tracker-rest");
    var trackerArc = trackerSvg.append("path").attr("class", "bs-tracker-arc");
    var trackerValue = trackerSvg.append("text")
      .attr("class", "bs-tracker-value")
      .attr("text-anchor", "middle").attr("dy", "0.34em");
    var trackerStack = tracker.append("div").attr("class", "bs-readout-stack");
    trackerStack.append("span").attr("class", "bs-readout-label").text("Proportion significant");
    var timeValue = trackerStack.append("span").attr("class", "bs-readout-value");

    var dStack = readouts.append("div").attr("class", "bs-readout-stack");
    dStack.append("span").attr("class", "bs-readout-label").text("Effect size");
    var dValue = dStack.append("span").attr("class", "bs-readout-value");

    var seStack = readouts.append("div").attr("class", "bs-readout-stack");
    seStack.append("span").attr("class", "bs-readout-label").text("Standard error");
    var seValue = seStack.append("span").attr("class", "bs-readout-value");

    var donutArc = d3.arc().innerRadius(24).outerRadius(36);

    // ---- canvas sizing -----------------------------------------------------

    var cssWidth = 0;
    var renderScale = 1;

    function resizeCanvas() {
      var width = chartWrap.node().getBoundingClientRect().width || 560;
      if (Math.abs(width - cssWidth) < 0.5) return false;
      cssWidth = width;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(width * ((H + 2 * OVERHANG) / W) * dpr);
      renderScale = canvas.width / W;
      return true;
    }

    // Band coordinates (x 0..W, y 0..H) with the canvas extending OVERHANG
    // above and below the band.
    function setBandTransform() {
      ctx.setTransform(renderScale, 0, 0, renderScale, 0, OVERHANG * renderScale);
    }

    function clearCanvas() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function drawHistogram() {
      if (!state.show.histogram || !hist.total) return;
      var baseline = H - 30;
      var span = baseline - yDensity(0.12);
      setBandTransform();
      ctx.beginPath();
      var keys = Object.keys(hist.counts);
      for (var index = 0; index < keys.length; index += 1) {
        var x = Number(keys[index]);
        var height = (hist.counts[keys[index]] / hist.total) / 0.12 * span;
        ctx.rect(x, baseline - height, 1, height);
      }
      ctx.fillStyle = BEE_COLOR;
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawBees() {
      if (!state.show.swarm) return;
      // Bees are attractor-relative around (0,0); origin sits at band
      // center (MU0, H/2), like the prototype's translate(420, 400) on its
      // double-height canvas.
      ctx.setTransform(renderScale, 0, 0, renderScale,
        MU0 * renderScale, (H * 0.5 + OVERHANG) * renderScale);
      var bees = sim.swarm.bees;
      ctx.fillStyle = BEE_COLOR;
      ctx.beginPath();
      for (var index = 0; index < bees.length; index += 1) {
        var bee = bees[index];
        ctx.moveTo(bee.position.x + bee.size, bee.position.y);
        ctx.arc(bee.position.x, bee.position.y, bee.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    function drawGhostFrames(frames, playbackIndex) {
      clearCanvas();
      drawHistogram();
      ctx.setTransform(renderScale, 0, 0, renderScale,
        MU0 * renderScale, (H * 0.5 + OVERHANG) * renderScale);
      if (GHOST_MODE === "cumulative") {
        // Prototype effect: draw every captured frame up to the playback
        // index, alpha fading from ~0.4 (newest) to 0 across a 10-frame tail.
        for (var frameIndex = 0; frameIndex <= playbackIndex && frameIndex < frames.length; frameIndex += 1) {
          var alpha = (100 - (playbackIndex - frameIndex) * (100 / GHOST_TRAIL)) / 255;
          if (alpha <= 0) continue;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = BEE_COLOR;
          ctx.beginPath();
          var frame = frames[frameIndex];
          for (var beeIndex = 0; beeIndex < frame.length; beeIndex += 1) {
            ctx.moveTo(frame[beeIndex].x + 10, frame[beeIndex].y);
            ctx.arc(frame[beeIndex].x, frame[beeIndex].y, 10, 0, Math.PI * 2);
          }
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        var current = frames[Math.min(playbackIndex, frames.length - 1)];
        ctx.globalAlpha = 100 / 255;
        ctx.fillStyle = BEE_COLOR;
        ctx.beginPath();
        for (var index = 0; index < current.length; index += 1) {
          ctx.moveTo(current[index].x + 10, current[index].y);
          ctx.arc(current[index].x, current[index].y, 10, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    function render() {
      clearCanvas();
      drawHistogram();
      drawBees();
      meanLine
        .attr("x1", lastMean).attr("x2", lastMean)
        .classed("is-significant", lastSignificant);
    }

    // ---- static overlay (parameter-dependent, not per-frame) ---------------

    function redrawDistribution() {
      var points = [];
      for (var x = W * 0.25; x <= W * 0.75; x += 1) {
        points.push({ x: x, y: Math.min(0.5, stats.normalPdf(x, MU0, derived.se)) });
      }
      nullCurvePath.attr("d", curveLine(points));

      var baselineY = yDensity(0) + 0.5;
      function tailPath(tailPoints, edgeX) {
        if (!tailPoints.length) return "";
        return curveLine(tailPoints) +
          "L" + edgeX + "," + baselineY +
          "L" + tailPoints[0].x + "," + baselineY + "Z";
      }
      var leftPoints = points.filter(function(point) { return point.x <= derived.lowerCrit; });
      var rightPoints = points.filter(function(point) { return point.x >= derived.upperCrit; });
      leftTailPath.attr("d", tailPath(leftPoints,
        leftPoints.length ? leftPoints[leftPoints.length - 1].x : 0));
      rightTailPath.attr("d", tailPath(rightPoints,
        rightPoints.length ? rightPoints[rightPoints.length - 1].x : 0));

      hiveMarker.attr("transform",
        "translate(" + (MU0 + state.hiveOffset) + "," + (H * 0.5) + ") rotate(45)");
    }

    // ---- readouts / value -------------------------------------------------

    function formatElapsed() {
      var seconds = Math.floor(obs / core.TICKS_PER_SECOND);
      var minutes = Math.floor(seconds / 60);
      return minutes > 0 ? minutes + "m " + (seconds % 60) + "s" : seconds + "s";
    }

    function updateTracker() {
      var proportion = obs > 0 ? sigs / obs : 0;
      var angle = proportion * Math.PI * 2;
      trackerArc.attr("d", donutArc({ startAngle: 0, endAngle: angle }));
      trackerRest.attr("d", donutArc({ startAngle: angle, endAngle: Math.PI * 2 }));
      trackerValue.text(proportion.toFixed(3));
      timeValue.text(formatElapsed());
      dValue.text("d = " + derived.d.toFixed(2));
      seValue.text("σM = " + derived.se.toFixed(2));
    }

    function setValue() {
      rootNode.value = {
        seed: seed,
        variability: core.VARIABILITY_LABELS[state.variabilityIndex],
        n: core.N_BEES_VALUES[state.nIndex],
        se: derived.se,
        sd: derived.sd,
        alpha: state.alpha,
        hiveOffset: state.hiveOffset,
        d: derived.d,
        currentMean: lastMean,
        meanOffset: lastMean - MU0,
        isSignificant: lastSignificant,
        sigs: sigs,
        obs: obs,
        proportionSignificant: obs > 0 ? sigs / obs : 0,
        elapsed: obs / core.TICKS_PER_SECOND
      };
    }

    function notify() {
      setValue();
      rootNode.dispatchEvent(new Event("input", { bubbles: true }));
    }

    var lastReadoutAt = 0;
    function throttledReadouts(now) {
      if (now - lastReadoutAt < READOUT_MS) return;
      lastReadoutAt = now;
      updateTracker();
      notify();
    }

    // ---- animation loop ----------------------------------------------------

    var anim = { rafId: null, lastTs: null, acc: 0, onscreen: true };
    var lastInteraction = 0;

    function shouldStep() {
      if (!state.playing || fastForward || prefersReducedMotion() ||
          !anim.onscreen || document.hidden) return false;
      if (anyOtherFastForwarding(instanceHandle)) return false;
      if (ARBITRATE_WHEN_ALL_VISIBLE) {
        for (var index = 0; index < instances.length; index += 1) {
          var other = instances[index];
          if (other !== instanceHandle && other.isVisiblyPlaying() &&
              other.lastInteraction() > lastInteraction) {
            return false;
          }
        }
      }
      return true;
    }

    function frame(ts) {
      anim.rafId = null;
      if (!shouldStep()) { anim.lastTs = null; return; }
      if (anim.lastTs == null) anim.lastTs = ts;
      anim.acc += Math.min(MAX_FRAME_MS, ts - anim.lastTs);
      anim.lastTs = ts;
      while (anim.acc >= TICK_MS) {
        stepOnce();
        anim.acc -= TICK_MS;
      }
      render();
      throttledReadouts(ts);
      anim.rafId = window.requestAnimationFrame(frame);
    }

    function startLoop() {
      if (anim.rafId !== null || !shouldStep()) return;
      anim.lastTs = null;
      anim.rafId = window.requestAnimationFrame(frame);
    }

    function stopLoop() {
      if (anim.rafId !== null) {
        window.cancelAnimationFrame(anim.rafId);
        anim.rafId = null;
      }
      anim.lastTs = null;
    }

    function evaluate() {
      if (shouldStep()) startLoop();
      else stopLoop();
    }

    document.addEventListener("sfs-motion:change", evaluate);

    // ---- fast-forward ------------------------------------------------------

    var fastForward = null;

    function beginFastForward(totalTicks, options) {
      if (fastForward) return;
      options = options || {};
      var ghost = options.ghost !== false && !prefersReducedMotion();
      stopLoop();
      fastForward = {
        remaining: totalTicks,
        frames: [],
        playbackIndex: 0,
        chunkTimer: null,
        replayTimer: null,
        chunksDone: false,
        replayDone: !ghost,
        paused: false,
        signature: options.signature || null,
        onDone: options.onDone || null
      };
      rootNode.setAttribute("aria-busy", "true");
      pokeInstances();

      if (ghost) {
        var captureCount = Math.min(GHOST_FRAMES, fastForward.remaining);
        for (var index = 0; index < captureCount; index += 1) {
          stepOnce();
          fastForward.frames.push(sim.swarm.getFrame());
          fastForward.remaining -= 1;
        }
        fastForward.replayTimer = window.setInterval(ghostTick, 1000 / GHOST_FPS);
      }
      scheduleChunk();
      updateTracker();
    }

    function ghostTick() {
      var ff = fastForward;
      if (!ff || ff.paused) return;
      if (ff.playbackIndex < ff.frames.length) {
        drawGhostFrames(ff.frames, ff.playbackIndex);
        ff.playbackIndex += 1;
      } else {
        window.clearInterval(ff.replayTimer);
        ff.replayTimer = null;
        ff.replayDone = true;
        maybeFinishFastForward();
      }
    }

    function scheduleChunk() {
      var ff = fastForward;
      if (!ff || ff.paused || ff.chunkTimer) return;
      ff.chunkTimer = window.setTimeout(function() {
        ff.chunkTimer = null;
        if (!fastForward || ff.paused) return;
        for (var index = 0; index < CHUNK_TICKS && ff.remaining > 0; index += 1) {
          stepOnce();
          ff.remaining -= 1;
        }
        updateTracker();
        if (ff.remaining > 0) {
          scheduleChunk();
        } else {
          ff.chunksDone = true;
          maybeFinishFastForward();
        }
      }, 0);
    }

    function pauseFastForward() {
      var ff = fastForward;
      if (!ff || ff.paused) return;
      ff.paused = true;
      if (ff.chunkTimer) { window.clearTimeout(ff.chunkTimer); ff.chunkTimer = null; }
      if (ff.replayTimer) { window.clearInterval(ff.replayTimer); ff.replayTimer = null; }
      pokeInstances();
    }

    function resumeFastForward() {
      var ff = fastForward;
      if (!ff || !ff.paused) return;
      ff.paused = false;
      if (!ff.chunksDone) scheduleChunk();
      if (!ff.replayDone && !ff.replayTimer) {
        ff.replayTimer = window.setInterval(ghostTick, 1000 / GHOST_FPS);
      }
      pokeInstances();
    }

    // Abandon an in-flight fast-forward (e.g. the reader jumps tutorial
    // steps mid-replay) so a fresh deterministic rebuild can start cleanly.
    function cancelFastForward() {
      var ff = fastForward;
      if (!ff) return;
      if (ff.chunkTimer) { window.clearTimeout(ff.chunkTimer); ff.chunkTimer = null; }
      if (ff.replayTimer) { window.clearInterval(ff.replayTimer); ff.replayTimer = null; }
      fastForward = null;
      rootNode.removeAttribute("aria-busy");
      pokeInstances();
    }

    function maybeFinishFastForward() {
      var ff = fastForward;
      if (!ff || !ff.chunksDone || !ff.replayDone) return;
      if (ff.replayTimer) { window.clearInterval(ff.replayTimer); ff.replayTimer = null; }
      state.advanceSignature = ff.signature;
      var onDone = ff.onDone;
      fastForward = null;
      rootNode.removeAttribute("aria-busy");
      render();
      updateTracker();
      notify();
      syncControls();
      pokeInstances();
      evaluate();
      if (onDone) onDone();
    }

    // ---- state changes (shared by controls and tutorial actions) -----------

    function advanceSignatureFor(ticks) {
      return [seed, state.variabilityIndex, state.nIndex, state.hiveOffset,
        state.alpha, ticks].join("|");
    }

    function setVariabilityIndex(index, options) {
      if (index === state.variabilityIndex) return false;
      state.variabilityIndex = index;
      sim.setVariabilityIndex(index); // live: the swarm loosens/tightens in flight
      resetStats();
      recomputeDerived();
      redrawDistribution();
      if (!options || options.silent !== true) afterDiscreteChange();
      return true;
    }

    function setNIndex(index, options) {
      if (index === state.nIndex) return false;
      state.nIndex = index;
      sim.setNIndex(index); // live: new bees launch from the hive, extras leave
      resetStats();
      recomputeDerived();
      redrawDistribution();
      if (!options || options.silent !== true) afterDiscreteChange();
      return true;
    }

    function setHiveOffset(offset, options) {
      offset = Math.max(0, Math.min(100, Number(offset) || 0));
      if (offset === state.hiveOffset) return false;
      state.hiveOffset = offset;
      sim.setHiveOffset(offset); // live: the swarm drifts to the new home
      resetStats();
      recomputeDerived();
      redrawDistribution();
      if (!options || options.silent !== true) afterDiscreteChange();
      return true;
    }

    function setAlpha(alpha, options) {
      alpha = Number(alpha);
      if (!(alpha > 0 && alpha < 1) || alpha === state.alpha) return false;
      state.alpha = alpha;
      resetStats();
      recomputeDerived();
      redrawDistribution();
      if (!options || options.silent !== true) afterDiscreteChange();
      return true;
    }

    function setPlaying(playing, options) {
      playing = Boolean(playing);
      if (playing === state.playing) return false;
      state.playing = playing;
      if (!options || options.silent !== true) afterDiscreteChange();
      evaluate();
      return true;
    }

    function afterDiscreteChange() {
      render();
      updateTracker();
      notify();
      syncControls();
    }

    // Ensures the accumulated statistics equal a fresh deterministic run of
    // `ticks` observations under the current parameters and seed. Skipped
    // when that exact state (or live-play drift beyond it) is already
    // present, so revisiting a tutorial step never flashes a rebuild.
    function ensureAdvanced(ticks, options) {
      options = options || {};
      if (ticks <= 0) {
        cancelFastForward();
        if (obs > 0) resetStats();
        afterDiscreteChange();
        return;
      }
      var signature = advanceSignatureFor(ticks);
      if (signature === state.advanceSignature && !fastForward) return;
      cancelFastForward();
      sim = core.createSim({
        seed: seed,
        variabilityIndex: state.variabilityIndex,
        nIndex: state.nIndex,
        hiveOffset: state.hiveOffset
      });
      resetStats();
      beginFastForward(ticks, {
        ghost: options.animate !== false,
        signature: signature
      });
    }

    // ---- controls ----------------------------------------------------------

    function makeButton(parent, icon, label, extraClass) {
      var button = parent.append("button")
        .attr("type", "button")
        .attr("class", "sfs-button" + (extraClass ? " " + extraClass : ""))
        .node();
      var iconNode = document.createElement("i");
      iconNode.className = "bi bi-" + icon;
      iconNode.setAttribute("aria-hidden", "true");
      var text = document.createElement("span");
      text.textContent = label;
      button.append(iconNode, text);
      return { button: button, icon: iconNode, text: text };
    }

    function makeSegButton(parent, label, onSelect) {
      var button = parent.append("button")
        .attr("type", "button")
        .attr("class", "sfs-button")
        .text(label)
        .node();
      button.addEventListener("click", function() {
        markInteraction();
        onSelect();
      });
      return button;
    }

    var swarmPanel = controls.append("div").attr("class", "sfs-control-panel sfs-if-control-panel");

    var variabilityRow = swarmPanel.append("div").attr("class", "bs-row sfs-control-row");
    variabilityRow.append("span").attr("class", "bs-row-label").text("Variability");
    var variabilitySeg = variabilityRow.append("div").attr("class", "bs-seg");
    var variabilityButtons = ["Low", "Medium", "High"].map(function(label, index) {
      return makeSegButton(variabilitySeg, label, function() {
        setVariabilityIndex(index);
      });
    });

    var nRow = swarmPanel.append("div").attr("class", "bs-row sfs-control-row");
    nRow.append("span").attr("class", "bs-row-label").text("Bees");
    var nSeg = nRow.append("div").attr("class", "bs-seg");
    var nButtons = core.N_BEES_VALUES.map(function(value, index) {
      return makeSegButton(nSeg, String(value), function() {
        setNIndex(index);
      });
    });

    var hiveRow = swarmPanel.append("div").attr("class", "bs-row sfs-control-row");
    var hiveLabel = hiveRow.append("label").attr("class", "bs-row-label").text("Hive offset");
    var hiveSlider = hiveRow.append("input")
      .attr("type", "range").attr("min", 0).attr("max", 100).attr("step", 1)
      .node();
    var hiveValue = hiveRow.append("span").attr("class", "bs-readout-value");
    hiveSlider.addEventListener("input", function() {
      markInteraction();
      setHiveOffset(Number(hiveSlider.value));
    });
    hiveLabel.attr("for", null);

    var playbackPanel = controls.append("div").attr("class", "sfs-control-panel sfs-if-control-panel");
    var actions = playbackPanel.append("div").attr("class", "bs-actions sfs-action-row");
    var playButton = makeButton(actions, "play-fill", "Play");
    var ffButton = makeButton(actions, "fast-forward-fill", "+60s");
    var resetButton = makeButton(actions, "arrow-counterclockwise", "Reset", "bs-reset");

    playButton.button.addEventListener("click", function() {
      markInteraction();
      setPlaying(!state.playing);
    });
    ffButton.button.addEventListener("click", function() {
      if (fastForward) return;
      markInteraction();
      // User mode appends a minute to the current accumulation, so the
      // deterministic-signature shortcut no longer applies afterwards.
      state.advanceSignature = null;
      beginFastForward(FAST_FORWARD_TICKS, { ghost: true });
    });
    resetButton.button.addEventListener("click", function() {
      markInteraction();
      resetStats();
      afterDiscreteChange();
    });

    var layersPanel = controls.append("div").attr("class", "sfs-control-panel sfs-if-control-panel");
    var layerGrid = layersPanel.append("div").attr("class", "bs-layer-grid");

    var layerDefs = [
      { key: "swarm", label: "Swarm" },
      { key: "hive", label: "Hive" },
      { key: "nullHive", label: "Null marker" },
      { key: "meanLine", label: "Mean line" },
      { key: "nullCurve", label: "Null curve" },
      { key: "criticalRegions", label: "Critical regions" },
      { key: "histogram", label: "Histogram" },
      { key: "sigTracker", label: "Tracker" }
    ];

    var layerInputs = {};
    layerDefs.forEach(function(def) {
      var label = layerGrid.append("label");
      var input = label.append("input").attr("type", "checkbox").node();
      label.append("span").text(def.label);
      input.addEventListener("change", function() {
        markInteraction();
        state.show[def.key] = input.checked;
        applyReveals({ animate: true });
        render();
        notify();
      });
      layerInputs[def.key] = input;
    });

    function markInteraction() {
      lastInteraction = performance.now();
      pokeInstances();
    }

    function syncControls() {
      variabilityButtons.forEach(function(button, index) {
        button.setAttribute("aria-pressed", String(index === state.variabilityIndex));
      });
      nButtons.forEach(function(button, index) {
        button.setAttribute("aria-pressed", String(index === state.nIndex));
      });
      hiveSlider.value = String(state.hiveOffset);
      hiveValue.text(state.hiveOffset + " px (d = " + derived.d.toFixed(2) + ")");
      playButton.icon.className = "bi bi-" + (state.playing ? "pause-fill" : "play-fill");
      playButton.text.textContent = state.playing ? "Pause" : "Play";
      layerDefs.forEach(function(def) {
        layerInputs[def.key].checked = state.show[def.key];
      });
    }

    // ---- reveals -----------------------------------------------------------

    function applyReveals(options) {
      var animate = !options || options.animate !== false;
      var reveal = window.interactiveFigure.setRevealVisible;
      reveal(hiveLayer.node(), state.show.hive, { root: rootNode, animate: animate });
      reveal(nullHiveLayer.node(), state.show.nullHive, { root: rootNode, animate: animate });
      reveal(meanLayer.node(), state.show.meanLine, { root: rootNode, animate: animate });
      reveal(nullCurveLayer.node(), state.show.nullCurve, { root: rootNode, animate: animate });
      reveal(criticalLayer.node(), state.show.criticalRegions, { root: rootNode, animate: animate });
      reveal(readouts.node(), state.show.sigTracker, { root: rootNode, animate: animate });
      // Swarm and histogram are canvas layers: plain draw flags, same state
      // path, applied on the next render().
    }

    // ---- tutorial actions --------------------------------------------------

    var SHOW_KEYS = {
      "show-swarm": "swarm",
      "show-hive": "hive",
      "show-null-hive": "nullHive",
      "show-mean-line": "meanLine",
      "show-null-curve": "nullCurve",
      "show-critical-regions": "criticalRegions",
      "show-histogram": "histogram",
      "show-significance-tracker": "sigTracker"
    };

    function applyTutorialAction(action, context) {
      markInteraction();
      var normalized = {};
      Object.keys(action).forEach(function(key) {
        normalized[sampling.actionKey(key)] = action[key];
      });
      var animate = normalized.animate !== false;

      if (normalized.variability !== undefined) {
        setVariabilityIndex(variabilityIndexFrom(normalized.variability), { silent: true });
      }
      if (normalized["sample-size"] !== undefined) {
        setNIndex(nIndexFrom(normalized["sample-size"]), { silent: true });
      }
      if (normalized["hive-offset"] !== undefined) {
        setHiveOffset(normalized["hive-offset"], { silent: true });
      }
      if (normalized.alpha !== undefined) {
        setAlpha(normalized.alpha, { silent: true });
      }

      Object.keys(SHOW_KEYS).forEach(function(key) {
        if (normalized[key] !== undefined) {
          state.show[SHOW_KEYS[key]] = Boolean(normalized[key]);
        }
      });
      applyReveals({ animate: animate });

      if (normalized["controls-open"] !== undefined && context && context.setControlsOpen) {
        context.setControlsOpen(Boolean(normalized["controls-open"]), animate);
      }

      if (normalized.playing !== undefined) {
        // Tutorial steps never autoplay for reduced-motion readers; the
        // explicit play button remains available.
        var playing = Boolean(normalized.playing) && !prefersReducedMotion();
        setPlaying(playing, { silent: true });
      }

      if (normalized.advance !== undefined) {
        ensureAdvanced(Math.max(0, Math.round(Number(normalized.advance) || 0)),
          { animate: animate });
      }

      afterDiscreteChange();
      evaluate();
    }

    // ---- lifecycle ---------------------------------------------------------

    var instanceHandle = {
      evaluate: evaluate,
      isFastForwarding: function() { return Boolean(fastForward); },
      isActivelyFastForwarding: function() {
        return Boolean(fastForward) && !fastForward.paused;
      },
      isVisiblyPlaying: function() {
        return state.playing && anim.onscreen && !document.hidden;
      },
      lastInteraction: function() { return lastInteraction; }
    };
    instances.push(instanceHandle);

    if ("IntersectionObserver" in window) {
      var intersection = new IntersectionObserver(function(entries) {
        anim.onscreen = entries[0].isIntersecting;
        if (anim.onscreen) {
          resumeFastForward();
          evaluate();
        } else {
          stopLoop();
          pauseFastForward();
        }
      }, { threshold: 0 });
      intersection.observe(rootNode);
    }

    document.addEventListener("visibilitychange", function() {
      if (document.hidden) {
        stopLoop();
        pauseFastForward();
      } else {
        resumeFastForward();
        evaluate();
      }
    });

    if ("ResizeObserver" in window) {
      var resizeObserver = new ResizeObserver(function() {
        if (resizeCanvas()) render();
      });
      resizeObserver.observe(chartWrap.node());
    }

    rootNode.beeSwarm = {
      play: function() { setPlaying(true); },
      pause: function() { setPlaying(false); },
      reset: function() { resetStats(); afterDiscreteChange(); },
      fastForward: function() { ffButton.button.click(); },
      applyTutorialAction: applyTutorialAction,
      debug: function() {
        return {
          playing: state.playing,
          onscreen: anim.onscreen,
          rafId: anim.rafId,
          hidden: document.hidden,
          fastForwarding: Boolean(fastForward),
          shouldStep: shouldStep()
        };
      }
    };

    window.interactiveFigure.wrap({
      root: rootNode,
      controls: controlsNode,
      label: "bee swarm controls",
      placement: opts.controlsPlacement || "callout",
      layout: opts.controlsLayout || "equal",
      applyAction: applyTutorialAction,
      startOpen: opts.controlsOpen === true
    });

    redrawDistribution();
    applyReveals({ animate: false });
    syncControls();
    setValue();

    window.requestAnimationFrame(function() {
      resizeCanvas();
      render();
      updateTracker();
      evaluate();
    });

    return rootNode;
  };
}());
