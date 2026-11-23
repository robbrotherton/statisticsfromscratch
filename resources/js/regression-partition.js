// A two-predictor regression's sums of squares, from the regression square to
// an F for each predictor, in the style of Chapters 14 and 16's partition
// figures. A tutorial moves it through these phases:
//   whole   the regression sum of squares as one square.
//   big     the larger predictor's own part grows up from the bottom of the
//           square: what the model gains by adding it to the other alone.
//   small   the smaller predictor's own part grows up on top of it.
//   shared  what's left of the square fades in: either predictor accounts for it.
//   pull    the rest of the square fades away, then the two predictors' parts
//           move out into squares of the same area, side by side.
//   ms      each is cut by its 1 degree of freedom (Chapter 14's cut, one
//           piece), so its mean square is the sum itself.
//   f       a fraction line under each, then the residual mean square under
//           that, as in Chapter 16. The residual mean square comes from the
//           text, so it's only shown, not built here.
//
// Options:
//   parts       two { name, ss } predictors, each alone in the model.
//   regression  the regression sum of squares with both.
//   msResidual  the residual mean square with both.
//   phase       where to start without a tutorial (default "whole").
//
// Every area is to scale: a square's side is the square root of its sum.
// Only the cut comes from Chapter 14's code (sfsAnovaSquares); the layout
// follows the ANOVA explorer's comparison stage by eye.

sfsRegressionPartitionGeometry = (opts) => {
  const parts = (opts.parts || []).slice().sort((a, b) => b.ss - a.ss);
  const [big, small] = parts;
  // Each predictor's own part is what the model gains by adding it to the other alone.
  const onlyBig = opts.regression - small.ss;
  const onlySmall = opts.regression - big.ss;
  const shared = opts.regression - onlyBig - onlySmall;
  const ms = opts.msResidual;
  const R = Math.sqrt(opts.regression);
  const a = Math.sqrt(onlyBig);
  const c = Math.sqrt(onlySmall);
  const m = Math.sqrt(ms);
  const gap = R * 0.11;
  // Numerators stand on a common bottom; the fraction line sits midway in the
  // gap below them, and the mean squares hang below that.
  const numeratorBottom = Math.max(a, c);
  const line = numeratorBottom + gap * 0.6;
  const lower = numeratorBottom + gap * 1.2;
  const columns = [Math.max(a, m), Math.max(c, m)];
  const columnGap = gap * 2;
  const centers = [columns[0] / 2, columns[0] + columnGap + columns[1] / 2];
  const fWidth = columns[0] + columnGap + columns[1];
  const labelRoom = R * 0.62;            // right of the regression square, for its bands' names
  const width = Math.max(fWidth, R + labelRoom);
  const height = Math.max(lower + m, R);
  const x0 = 0;
  const top0 = (height - R) / 2;          // the regression square, centred top to bottom
  const bottom = top0 + R;
  const hBig = onlyBig / R;
  const hSmall = onlySmall / R;
  const hShared = shared / R;
  const box = (x, y, w, h) => ({ x, y, w, h });
  const sq = (x, y, side) => box(x, y, side, side);
  const PHASES = ["whole", "big", "small", "shared", "pull", "ms", "f"];
  const each = (fn) => Object.fromEntries(PHASES.map((p) => [p, fn(p)]));
  const before = (p, phase) => PHASES.indexOf(p) < PHASES.indexOf(phase);
  const numerator = (i, side) => sq(centers[i] - side / 2, numeratorBottom - side, side);
  return {
    big, small, onlyBig, onlySmall, shared, ms, R, a, c, m, gap, width, height,
    line, lower, centers, columns, x0, top0,
    fBig: onlyBig / ms,
    fSmall: onlySmall / ms,
    rects: {
      whole: each(() => sq(x0, top0, R)),
      // The bands start flat, then grow up from where they stand.
      bigPart: each((p) => p === "whole" ? box(x0, bottom, R, 0)
        : before(p, "pull") ? box(x0, bottom - hBig, R, hBig) : numerator(0, a)),
      smallPart: each((p) => before(p, "small") ? box(x0, bottom - hBig, R, 0)
        : before(p, "pull") ? box(x0, bottom - hBig - hSmall, R, hSmall) : numerator(1, c)),
      sharedPart: each(() => box(x0, top0, R, hShared)),
      msLeft: each(() => sq(centers[0] - m / 2, lower, m)),
      msRight: each(() => sq(centers[1] - m / 2, lower, m))
    }
  };
};

makeRegressionPartition = function(opts) {
  opts = opts || {};
  const geo = sfsRegressionPartitionGeometry(opts);
  const PHASES = ["whole", "big", "small", "shared", "pull", "ms", "f"];
  const format = d3.format(opts.format || ",.2~f");
  const effect = "var(--sfs-effect-color, #7654b5)";
  const residualColor = "var(--sfs-current-color, #d1495b)";
  const sharedColor = "var(--sfs-neutral-color, #7b818a)";
  const ink = "var(--sfs-text, currentColor)";
  const preferredWidth = 440;
  const MOVE = 900;
  const FADE = 350;
  let phase = PHASES.includes(opts.phase) ? opts.phase : "whole";
  const at = (p, list) => list.includes(p);
  const index = (p) => PHASES.indexOf(p);
  const bigName = geo.big.name;
  const smallName = geo.small.name;

  if (window.sfsAnovaSquares) window.sfsAnovaSquares.ensureStyles();
  if (!document.getElementById("regression-partition-styles")) {
    const style = document.createElement("style");
    style.id = "regression-partition-styles";
    style.textContent = `
      .regression-partition { --sfs-figure-max-width: var(--rp-max-width, 28rem); }
      .regression-partition .rp-svg { display: block; width: 100%; height: auto; }
      .regression-partition .rp-name { font-weight: 700; font-size: 0.85rem; }
      .regression-partition .rp-value { font-size: 0.8rem; fill: var(--sfs-muted, currentColor); font-variant-numeric: tabular-nums; }
      .regression-partition .rp-f { font-weight: 700; font-size: 0.9rem; fill: var(--sfs-text, currentColor); }
    `;
    document.head.appendChild(style);
  }

  const root = d3.create("div")
    .attr("class", "regression-partition sfs-figure")
    .style("--rp-max-width", opts.maxWidth || null);
  const chartWrap = root.append("div").attr("class", "rp-chart-wrap sfs-chart-wrap");
  const svg = chartWrap.append("svg").attr("class", "rp-svg sfs-svg").attr("role", "img");

  const animateAllowed = () => {
    const runtime = window.interactiveRuntime;
    if (runtime && runtime.motion && typeof runtime.motion.shouldAnimate === "function") {
      return runtime.motion.shouldAnimate(true);
    }
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  const fmt = (v) => format(v);
  const descriptions = {
    whole: `The regression sum of squares with both predictors, ${fmt(opts.regression)}, as a square.`,
    big: `A band of ${fmt(geo.onlyBig)} grows up from the bottom of the square: what only ${bigName} accounts for.`,
    small: `A sliver of ${fmt(geo.onlySmall)} above it: what only ${smallName} accounts for.`,
    shared: `The rest of the square, ${fmt(geo.shared)}, is shared: either predictor accounts for it.`,
    pull: `The two predictors' parts as squares of their own: ${bigName} only ${fmt(geo.onlyBig)}, ${smallName} only ${fmt(geo.onlySmall)}. The shared part is gone.`,
    ms: `Each predictor's part divided by its 1 degree of freedom: its mean square is the same as its sum of squares.`,
    f: `${bigName}: ${fmt(geo.onlyBig)} over the residual mean square, ${fmt(geo.ms)}, F about ${fmt(geo.fBig)}. ` +
      `${smallName}: ${fmt(geo.onlySmall)} over ${fmt(geo.ms)}, F about ${fmt(geo.fSmall)}.`
  };

  const shown = {
    whole: (p) => at(p, ["whole", "big", "small", "shared"]),
    bigPart: (p) => p !== "whole",
    smallPart: (p) => !at(p, ["whole", "big"]),
    sharedPart: (p) => p === "shared",
    msLeft: (p) => p === "f",
    msRight: (p) => p === "f"
  };
  // Bands grow and shrink rather than fade: they're shown whenever they have height.
  const GROWS = ["bigPart", "smallPart"];
  const styleOf = {
    whole: [effect, 0.1],
    bigPart: [effect, 0.42],
    smallPart: [effect, 0.42],
    sharedPart: [sharedColor, 0.24],
    msLeft: [residualColor, 0.16],
    msRight: [residualColor, 0.16]
  };

  let layout = null;

  function build(width) {
    const margin = { top: 40, right: 6, bottom: 34, left: 6 };
    const scale = (width - margin.left - margin.right) / geo.width;
    const px = (v) => v * scale;
    const pxBox = (b) => ({ x: px(b.x), y: px(b.y), w: px(b.w), h: px(b.h) });
    const height = Math.round(margin.top + px(geo.height) + margin.bottom);
    ["move", "fade"].forEach((n) => svg.selectAll("*").interrupt(n));
    svg.selectAll("*").interrupt();
    svg.selectAll("*").remove();
    svg.attr("viewBox", [0, 0, width, height]);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const shapeLayer = g.append("g");
    const cutLayer = g.append("g");
    const lineLayer = g.append("g");
    const labelLayer = g.append("g");

    // The predictors' parts are drawn last, over what's left of the square.
    const shapes = {};
    ["whole", "sharedPart", "msLeft", "msRight", "bigPart", "smallPart"].forEach((key) => {
      const [color, opacity] = styleOf[key];
      const b = pxBox(geo.rects[key][phase]);
      shapes[key] = shapeLayer.append("rect").attr("class", "rp-shape rp-" + key)
        .attr("x", b.x).attr("y", b.y).attr("width", b.w).attr("height", b.h)
        .attr("fill", color).attr("fill-opacity", opacity)
        .attr("stroke", color).attr("stroke-width", 1.25)
        .style("opacity", shown[key](phase) ? 1 : 0);
    });

    // Fraction lines, centred in the gap between numerators and mean squares,
    // a little wider than the widest square in their column. Each draws out
    // from its middle.
    const lines = geo.centers.map((cx, i) => {
      const half = geo.columns[i] / 2 + geo.gap * 0.3;
      return { el: lineLayer.append("line").attr("class", "rp-fraction")
        .attr("y1", px(geo.line)).attr("y2", px(geo.line))
        .attr("stroke", ink).attr("stroke-width", 2.5),
      cx: px(cx), half: px(half) };
    });

    // Labels. Beside the regression square, each band's name sits level with
    // the band after a short tick; above a square, a name and its value;
    // inside a mean square, at its top-left.
    const right = px(geo.x0 + geo.R);
    const beside = (key, p) => {
      const b = geo.rects[key][p];
      return { x: right + 14, y: px(b.y + b.h / 2) - 2, anchor: "start", tick: true };
    };
    const above = (key, p) => {
      const b = geo.rects[key][p];
      return { x: px(b.x + b.w / 2), y: px(b.y) - 22, anchor: "middle" };
    };
    const inside = (key, p) => {
      const b = geo.rects[key][p];
      return { x: px(b.x) + 6, y: px(b.y) + 16, anchor: "start" };
    };
    const labels = [];
    const label = (color, place) => {
      const group = labelLayer.append("g").attr("class", "rp-label");
      const tick = group.append("line").attr("stroke", color).attr("stroke-width", 1.25);
      const name = group.append("text").attr("class", "rp-name").attr("fill", color);
      const value = group.append("text").attr("class", "rp-value");
      labels.push({ group, tick, name, value, place });
    };
    label(effect, (p) => shown.whole(p)
      ? { x: px(geo.x0 + geo.R / 2), y: px(geo.top0) - 10, anchor: "middle", lines: [`Regression = ${fmt(opts.regression)}`, ""] }
      : null);
    const part = (key, title, amount, short) => label(effect, (p) => {
      if (!shown[key](p)) return null;
      if (at(p, ["big", "small", "shared"])) return { ...beside(key, p), lines: [title, fmt(amount)] };
      if (at(p, ["ms", "f"])) return { ...above(key, p), lines: [`MS ${short}`, `${fmt(amount)} ÷ 1 = ${fmt(amount)}`], cut: p === "ms" };
      return { ...above(key, p), lines: [title, fmt(amount)] };
    });
    part("bigPart", `${bigName} only`, geo.onlyBig, bigName.toLowerCase());
    part("smallPart", `${smallName} only`, geo.onlySmall, smallName.toLowerCase());
    label(sharedColor, (p) => p === "shared" ? { ...beside("sharedPart", p), lines: ["Shared", fmt(geo.shared)] } : null);
    ["msLeft", "msRight"].forEach((key) => {
      label(residualColor, (p) => p === "f" ? { ...inside(key, p), lines: ["MS residual", fmt(geo.ms)], late: true } : null);
    });
    geo.centers.forEach((cx, i) => {
      label(ink, (p) => p === "f"
        ? { x: px(cx), y: px(geo.lower + geo.m) + 24, anchor: "middle", f: true, late: true,
          lines: [`F ≈ ${fmt(i === 0 ? geo.fBig : geo.fSmall)}`, ""] } : null);
    });

    layout = { px, pxBox, shapes, lines, labels, cutLayer };
    render(null, false);
  }

  function render(from, animate) {
    if (!layout) return;
    const { pxBox, shapes, lines, labels, cutLayer } = layout;
    const duration = animate ? MOVE : 0;
    ["move", "fade"].forEach((n) => svg.selectAll("*").interrupt(n));
    cutLayer.selectAll("*").interrupt().remove();
    // Pulling the parts out waits for the rest of the square to go; putting
    // them back brings the rest of the square back once they've arrived.
    const pullingOut = animate && from && index(from) < index("pull") && index(phase) >= index("pull");
    const puttingBack = animate && from && index(from) >= index("pull") && index(phase) < index("pull");
    const moveDelay = pullingOut ? FADE + 100 : 0;
    const settle = moveDelay + duration;
    const move = (sel) => (duration
      ? sel.transition("move").delay(moveDelay).duration(duration).ease(d3.easeCubicInOut) : sel);
    const fade = (sel, show, delay) => (duration
      ? sel.transition("fade").delay(show ? delay || 0 : 0).duration(show ? FADE : 200)
      : sel).style("opacity", show ? 1 : 0);

    Object.entries(shapes).forEach(([key, el]) => {
      const b = pxBox(geo.rects[key][phase]);
      const show = shown[key](phase);
      move(el).attr("x", b.x).attr("y", b.y).attr("width", b.w).attr("height", b.h);
      if (GROWS.includes(key)) {
        // Visible while it grows; hidden only once it has shrunk flat.
        if (show) el.style("opacity", 1);
        else if (duration) el.transition("fade").delay(settle).duration(0).style("opacity", 0);
        else el.style("opacity", 0);
      } else if (key === "whole" || key === "sharedPart") {
        if (pullingOut) el.transition("fade").duration(FADE).style("opacity", 0);
        else fade(el, show, puttingBack ? duration : 0);
      } else {
        // The mean squares come in once the lines are drawn.
        fade(el, show, duration * 0.5);
      }
    });

    // The lines draw out from their middles.
    lines.forEach(({ el, cx, half }) => {
      const show = phase === "f";
      if (show && duration && from !== "f") {
        el.attr("x1", cx).attr("x2", cx).style("opacity", 1)
          .transition("fade").duration(450).ease(d3.easeCubicOut).attr("x1", cx - half).attr("x2", cx + half);
      } else {
        el.attr("x1", cx - half).attr("x2", cx + half);
        fade(el, show);
      }
    });

    const cutting = phase === "ms" && duration && from === "pull" && window.sfsAnovaSquares;
    labels.forEach((l) => {
      const place = l.place(phase);
      if (!place) { fade(l.group, false); return; }
      const set = () => {
        l.name.text(place.lines[0]).attr("class", place.f ? "rp-f" : "rp-name");
        l.value.text(place.lines[1]);
      };
      const changed = l.name.text() !== place.lines[0] || l.value.text() !== place.lines[1];
      move(l.name).attr("x", place.x).attr("y", place.y).attr("text-anchor", place.anchor);
      move(l.value).attr("x", place.x).attr("y", place.y + 15).attr("text-anchor", place.anchor);
      const tickX = place.x - 12;
      move(l.tick).attr("x1", tickX).attr("x2", tickX + 8).attr("y1", place.y - 4).attr("y2", place.y - 4)
        .style("opacity", place.tick ? 1 : 0);
      const visible = +l.group.style("opacity") > 0;
      if (changed && duration && visible) {
        // New words: out, then back in once the move (or the cut) has landed.
        const back = place.cut && cutting ? 1500 : settle;
        l.group.transition("fade").duration(150).style("opacity", 0).on("end", set)
          .transition().delay(Math.max(0, back - 150)).duration(300).style("opacity", 1);
      } else {
        set();
        fade(l.group, true, place.late ? duration * 0.9 : settle * 0.85);
      }
    });

    svg.attr("aria-label", descriptions[phase]);
    if (cutting) cutNumerators();
  }

  // Chapter 14's cut, with one piece: each numerator divided by its 1 degree of
  // freedom is the whole square, so the piece lands back where it was.
  function cutNumerators() {
    const { px, cutLayer } = layout;
    const anova = window.sfsAnovaSquares;
    ["bigPart", "smallPart"].forEach((key) => {
      const b = geo.rects[key].ms;
      const side = px(b.w);
      const plan = anova.planCut({
        df: 1, side,
        cx: px(b.x) + side / 2, cy: px(b.y) + side / 2,
        target: { x: px(b.x), y: px(b.y) },
        delay: 150, align: "top"
      });
      anova.animateCut(cutLayer, plan, { color: "var(--sfs-effect-color, #7654b5)", labelSide: "right" });
    });
  }

  function applyAction(action) {
    const next = action && PHASES.includes(action.phase) ? action.phase : phase;
    const from = phase;
    phase = next;
    render(from, Boolean(action) && action.animate !== false && animateAllowed() && from !== next);
  }

  const node = root.node();
  node.regressionPartition = { applyAction, get phase() { return phase; }, geometry: geo };
  node.value = { geometry: geo, get phase() { return phase; } };
  build(preferredWidth);
  if (window.interactiveFigure && typeof window.interactiveFigure.observeResponsiveLayout === "function") {
    window.interactiveFigure.observeResponsiveLayout({
      root: node,
      container: chartWrap.node(),
      compactBelow: 400,
      minimumWidth: 260,
      maximumWidth: preferredWidth,
      widthStep: 4,
      onLayout(l) { build(l.width); }
    });
  }

  // Claim the callout's tutorial, once the figure is in the page.
  let attempts = 0;
  (function attach() {
    if (!node.isConnected) { if (++attempts < 60) requestAnimationFrame(attach); return; }
    const callout = node.closest(".callout");
    const footer = callout && callout.querySelector(".callout-footer");
    if (!footer || footer.dataset.sfsIfTutorial === "true" || !window.interactiveFigure) return;
    const steps = Array.from(footer.children).filter((n) => n.classList.contains("tutorial-step"));
    if (steps.length) window.interactiveFigure.createTutorial({ root: node, footer, steps, applyAction });
  })();
  return node;
};
