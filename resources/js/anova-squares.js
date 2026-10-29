// Chapter 14's shared ANOVA drawing, used by the variability explorer and the
// two-estimates figure so the two read as one visual grammar: dots offset within
// a lane, each deviation drawn as a square, the squares poured into a sum of
// squares, and a sum cut into df equal pieces that stack into its mean square.
// Callers own their layouts; everything here takes pixel geometry. Anything that
// moves takes a `speed` (default 1) that scales all of its timings, for a quick replay.
window.sfsAnovaSquares = (function() {
  "use strict";

  const LANE_STEP = 5;
  const PIECE_GAP = 6;
  const POUR = { stagger: 150, flyDuration: 560, dropDuration: 240, settleDuration: 260 };
  const LINE_DURATION = 560;
  const SQUARE_DURATION = 620;

  function ensureStyles() {
    if (document.getElementById("anova-squares-styles")) return;
    const style = document.createElement("style");
    style.id = "anova-squares-styles";
    style.textContent = `
      .anova-dev { fill: none; stroke-width: 2; opacity: 0.72; }
      .anova-dev-cap { stroke-width: 1.5; opacity: 0.72; }
      .anova-dev-square { fill-opacity: 0.075; stroke-width: 1.15; stroke-opacity: 0.58; }
      .anova-ghost { fill-opacity: 0.22; stroke-width: 1.25; stroke-opacity: 0.5; stroke-dasharray: 2 2; }
      .anova-transfer { pointer-events: none; }
      .anova-cut-label { font-size: var(--sfs-figure-title-size, 1rem); font-weight: 700; fill: var(--sfs-muted, #68727d); }
    `;
    document.head.appendChild(style);
  }

  // The rank-th of a lane's n dots sits this far below the lane's line (above it if
  // negative), so sorted scores stack top to bottom in x order.
  function laneOffset(rank, n) {
    return (rank - (n - 1) / 2) * LANE_STEP;
  }

  // A deviation from x1 to x2 at height y, drawn as a square on it. The first lane's
  // squares hang below their line, the last lane's stand on it, and lanes between
  // alternate by rank.
  function deviationSquare(x1, x2, y, lane, lanes, rank) {
    const side = Math.abs(x2 - x1);
    let top = y;
    if (lane === lanes - 1) top -= side;
    else if (lane !== 0 && rank % 2 === 0) top -= side;
    return { x: Math.min(x1, x2), y: top, side };
  }

  // Deviation lines with a cap at the mean they're measured from, and their squares.
  // Items carry key, x1 (the score), x2 (the mean), y, color and square. `drawLines`
  // draws each line out from its score; `growSquares` grows each square up off its line.
  function renderDeviations(layer, items, opts) {
    opts = opts || {};
    const animate = Boolean(opts.animate);
    const speed = opts.speed || 1;
    const lineDelay = animate ? opts.lineDelay || 0 : 0;
    const squareDelay = animate ? opts.squareDelay || 0 : 0;
    const rows = layer.selectAll("g.anova-dev-group").data(items, (d) => d.key);
    const entered = rows.enter().append("g").attr("class", "anova-dev-group").style("opacity", 0);
    entered.append("rect").attr("class", "anova-dev-square");
    entered.append("line").attr("class", "anova-dev");
    entered.append("line").attr("class", "anova-dev-cap");
    const merged = entered.merge(rows);

    const square = merged.select(".anova-dev-square").interrupt()
      .attr("fill", (d) => d.color).attr("stroke", (d) => d.color)
      .attr("x", (d) => d.square.x).attr("width", (d) => d.square.side);
    if (opts.squares && opts.growSquares) {
      square.attr("y", (d) => d.y).attr("height", 0).style("opacity", 0)
        .transition().delay(squareDelay).duration(animate ? SQUARE_DURATION / speed : 0).ease(d3.easeCubicOut)
        .attr("y", (d) => d.square.y).attr("height", (d) => d.square.side).style("opacity", 1);
    } else if (opts.squares) {
      square.attr("y", (d) => d.square.y).attr("height", (d) => d.square.side).style("opacity", 1);
    } else {
      square.attr("y", (d) => d.y).attr("height", 0).style("opacity", 0);
    }

    const line = merged.select(".anova-dev").interrupt()
      .attr("stroke", (d) => d.color)
      .attr("x1", (d) => d.x1)
      .attr("y1", (d) => d.y).attr("y2", (d) => d.y);
    const cap = merged.select(".anova-dev-cap").interrupt()
      .attr("stroke", (d) => d.color)
      .attr("x1", (d) => d.x2).attr("x2", (d) => d.x2)
      .attr("y1", (d) => d.y - 5).attr("y2", (d) => d.y + 5);
    if (opts.drawLines) {
      line.attr("x2", (d) => d.x1)
        .transition().delay(lineDelay).duration(animate ? LINE_DURATION / speed : 0).ease(d3.easeCubicInOut)
        .attr("x2", (d) => d.x2);
      cap.style("opacity", 0)
        .transition().delay(lineDelay + (animate ? 420 / speed : 0)).duration(animate ? 180 / speed : 0)
        .style("opacity", 1);
    } else {
      line.attr("x2", (d) => d.x2);
      cap.style("opacity", 1);
    }
    merged.interrupt().transition().duration(animate ? 380 : 0).style("opacity", 1);
    rows.exit().interrupt().transition().duration(animate ? 180 : 0).style("opacity", 0).remove();
  }

  // Dashed rings left where scores were, once they've moved to their group mean.
  function renderGhosts(layer, items, opts) {
    const animate = Boolean(opts && opts.animate);
    const ghosts = layer.selectAll("circle.anova-ghost").data(items, (d) => d.key);
    ghosts.enter().append("circle")
      .attr("class", "anova-ghost")
      .attr("r", 6)
      .style("opacity", 0)
      .merge(ghosts)
      .attr("cx", (d) => d.x).attr("cy", (d) => d.y)
      .attr("fill", (d) => d.color).attr("stroke", (d) => d.color)
      .interrupt().transition().duration(animate ? 420 : 0)
      .style("opacity", 1);
    ghosts.exit().interrupt().transition().duration(animate ? 260 : 0).style("opacity", 0).remove();
  }

  function pourDuration(count, speed) {
    return (80 + (Math.max(1, count) - 1) * POUR.stagger + POUR.flyDuration + POUR.dropDuration + POUR.settleDuration) / (speed || 1);
  }

  // Pour squares into a sum of squares: each flies from where it was drawn to the mouth
  // above the sum, drops to its surface, and spreads flat across it as the level rises
  // by exactly its area. Pieces carry key, from {x, y, side}, side (at the sum's scale),
  // value and color. `level(v)` is the rect the sum fills when it holds v; `mouth` is
  // the centre x and top y the pieces drop in from; `sumRect` is raised as each lands.
  function pour(layer, opts) {
    const { pieces, color, level, mouth, sumRect } = opts;
    const start = opts.delay || 0;
    const speed = opts.speed || 1;
    const stagger = POUR.stagger / speed;
    const fly = POUR.flyDuration / speed;
    const drop = POUR.dropDuration / speed;
    const settle = POUR.settleDuration / speed;
    let running = opts.base || 0;
    pieces.forEach((d) => {
      const surface = level(running).y;
      running += d.value;
      d.mouthAt = { x: mouth.x - d.side / 2, y: mouth.y - d.side - 6 };
      d.landY = surface - d.side;
      d.sum = level(running);
      d.film = { y: d.sum.y, height: surface - d.sum.y };
    });
    layer.selectAll(null)
      .data(pieces)
      .enter().append("rect")
      .attr("class", "anova-transfer")
      .attr("stroke-width", 1.25)
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", 0.16)
      .attr("stroke", (d) => d.color)
      .attr("stroke-opacity", 0.75)
      .attr("x", (d) => d.from.x).attr("y", (d) => d.from.y)
      .attr("width", (d) => d.from.side).attr("height", (d) => d.from.side)
      .style("opacity", 0)
      .transition().delay((d, i) => start + 80 / speed + i * stagger).duration(0)
      .style("opacity", 1)
      .transition().duration(fly).ease(d3.easeCubicInOut)
      .attr("x", (d) => d.mouthAt.x).attr("y", (d) => d.mouthAt.y)
      .attr("width", (d) => d.side).attr("height", (d) => d.side)
      .attr("fill", color).attr("stroke", color)
      .attr("fill-opacity", 0.3).attr("stroke-opacity", 0.85)
      .transition().duration(drop).ease(d3.easeQuadIn)
      .attr("y", (d) => d.landY)
      .transition().duration(settle).ease(d3.easeCubicOut)
      .on("start", (d) => {
        sumRect.transition().duration(settle).ease(d3.easeCubicOut)
          .attr("y", d.sum.y).attr("height", d.sum.height);
      })
      .attr("x", (d) => d.sum.x).attr("y", (d) => d.film.y)
      .attr("width", (d) => d.sum.width).attr("height", (d) => d.film.height)
      .attr("fill-opacity", 0).attr("stroke-opacity", 0)
      .remove();
    return start + pourDuration(pieces.length, speed);
  }

  // Cut a square of the given side into df pieces of equal area that tile it exactly.
  // Rows share the pieces out as evenly as they can (6 is 3 + 3, 7 is 4 + 3); each row's
  // height is its share of the area, so every piece is close to square. Positions are
  // relative to the square's centre; `spread` is where each piece moves so that, once
  // squared up, it clears its neighbours. `align` keeps the spread pieces to the
  // square's "top" or "bottom" edge, or centres them. `width` and `height` are the most
  // room the cut takes.
  function cutPieces(df, side, align) {
    const rows = Math.ceil(df / Math.ceil(Math.sqrt(df)));
    const counts = d3.range(rows).map((r) => Math.floor(df / rows) + (r < df % rows ? 1 : 0));
    const piece = side / Math.sqrt(df);
    const rowHeights = counts.map((n) => side * n / df);
    const spreadHeights = rowHeights.map((h) => Math.max(h, piece));
    const spreadTotal = d3.sum(spreadHeights) + (rows - 1) * PIECE_GAP;
    const cells = [];
    let cutTop = -side / 2;
    let spreadTop = align === "top" ? -side / 2 : align === "bottom" ? side / 2 - spreadTotal : -spreadTotal / 2;
    counts.forEach((n, r) => {
      const w = side / n;
      const h = rowHeights[r];
      const stepX = Math.max(w, piece) + PIECE_GAP;
      d3.range(n).forEach((c) => {
        cells.push({
          k: cells.length,
          cut: { x: -side / 2 + c * w, y: cutTop, w, h },
          // Squared up, a piece keeps to the edge of its row nearest the aligned edge.
          spread: { x: (c - (n - 1) / 2) * stepX - piece / 2, y: align === "bottom" ? spreadTop + spreadHeights[r] - piece : spreadTop },
          order: Math.hypot(c - (n - 1) / 2, r - (rows - 1) / 2)
        });
      });
      cutTop += h;
      spreadTop += spreadHeights[r] + PIECE_GAP;
    });
    const width = d3.max(counts, (n) => n * Math.max(side / n, piece) + (n - 1) * PIECE_GAP);
    return { cells, piece, width: Math.max(side, width), height: Math.max(side, spreadTotal) };
  }

  // Cutting a sum of squares into its mean square, planned once so anything that moves
  // with it (a label, say) can keep the same time. Times are absolute, from `delay`'s
  // origin. The sum is the square of `side` centred on (cx, cy); the mean square lands
  // with its top-left corner at `target`.
  function planCut(opts) {
    const { df, side, cx, cy, target } = opts;
    const delay = opts.delay || 0;
    const speed = opts.speed || 1;
    const { cells, piece, width: cutWidth } = cutPieces(df, side, opts.align);
    const cutDuration = 420 / speed;
    const spreadAt = delay + cutDuration + 200 / speed;
    const spreadDuration = df > 1 ? 720 / speed : 0;
    const stackStart = spreadAt + spreadDuration + (df > 1 ? 450 : 300) / speed;
    const stackDuration = 760 / speed;
    // The outermost pieces set off first, so they all land close together.
    const stagger = Math.min(45, 360 / df) / speed;
    const lastOrder = d3.max(cells, (s) => s.order);
    cells.forEach((s) => { s.stackDelay = (lastOrder - s.order) * stagger; });
    return {
      df, side, cells, piece, cutWidth, target, cx, cy, speed,
      delay, cutDuration, spreadAt, spreadDuration, stackStart, stackDuration,
      landAt: stackStart + d3.max(cells, (s) => s.stackDelay) + stackDuration
    };
  }

  // Cut a sum of squares into df equal pieces, which part and square up in one move, then
  // stack on the target. The pieces are all the same size, so the stack is one share: the
  // mean square. A "÷ df" label stands beside the spread pieces, on `labelSide` ("right",
  // "left" or "below"). `onLanded` runs once the last piece is down.
  function animateCut(layer, plan, opts) {
    const { df, cells, piece, cutWidth, target, cx, cy, delay, cutDuration, spreadAt, spreadDuration,
      stackStart, stackDuration } = plan;
    const color = opts.color;
    // Stacked translucent pieces would darken; they fade as they gather so the stack reads as one square.
    const pieceOpacity = 1 - Math.pow(1 - 0.18, 1 / df);
    const strokeOpacity = 1 - Math.pow(1 - 0.9, 1 / df);
    const spreadMiddle = cy + (d3.min(cells, (s) => s.spread.y) + d3.max(cells, (s) => s.spread.y) + piece) / 2;
    const spreadBottom = cy + d3.max(cells, (s) => s.spread.y) + piece;
    const side = opts.labelSide || "right";
    const place = {
      right: { x: cx + cutWidth / 2 + 14, y: spreadMiddle + 6, anchor: "start" },
      left: { x: cx - cutWidth / 2 - 14, y: spreadMiddle + 6, anchor: "end" },
      below: { x: cx, y: spreadBottom + 22, anchor: "middle" }
    }[side];
    let landed = 0;

    layer.append("text")
      .attr("class", `anova-transfer anova-cut-label ${opts.labelClass || ""}`)
      .attr("text-anchor", place.anchor)
      .attr("x", place.x)
      .attr("y", place.y)
      .text(`÷ ${df}`)
      .style("opacity", 0)
      .transition().delay(delay + 200 / plan.speed).duration(260 / plan.speed).style("opacity", 1)
      .transition().delay(stackStart - delay - 460 / plan.speed).duration(300 / plan.speed).style("opacity", 0)
      .remove();

    // The cut fades in over the sum as the sum itself fades, so the area never flickers.
    layer.selectAll(null)
      .data(cells)
      .enter().append("rect")
      .attr("class", "anova-transfer")
      .attr("fill", color).attr("stroke", color)
      .attr("stroke-width", 1.5)
      .attr("fill-opacity", 0).attr("stroke-opacity", 0)
      .attr("x", (s) => cx + s.cut.x).attr("y", (s) => cy + s.cut.y)
      .attr("width", (s) => s.cut.w).attr("height", (s) => s.cut.h)
      .transition().delay(delay).duration(cutDuration)
      .attr("fill-opacity", 0.18).attr("stroke-opacity", 1)
      .transition().delay(spreadAt - delay - cutDuration).duration(spreadDuration).ease(d3.easeCubicInOut)
      .attr("x", (s) => cx + s.spread.x).attr("y", (s) => cy + s.spread.y)
      .attr("width", piece).attr("height", piece)
      .transition().delay((s) => stackStart - spreadAt - spreadDuration + s.stackDelay)
      .duration(stackDuration).ease(d3.easeCubicInOut)
      .attr("x", target.x).attr("y", target.y)
      .attr("fill-opacity", pieceOpacity)
      .attr("stroke-opacity", strokeOpacity)
      .on("end", () => {
        landed += 1;
        if (landed === df && opts.onLanded) opts.onLanded();
      })
      .remove();
  }

  return {
    LINE_DURATION, SQUARE_DURATION,
    ensureStyles, laneOffset, deviationSquare, renderDeviations, renderGhosts,
    pourDuration, pour, cutPieces, planCut, animateCut
  };
})();
