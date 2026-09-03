gbEnsureStyles = () => {
  if (document.getElementById("galton-board-styles")) return;

  const style = document.createElement("style");
  style.id = "galton-board-styles";
  style.textContent = `
    .galton-board {
      --sfs-figure-max-width: var(--gb-max-width, 36rem);
    }

    .galton-board .gb-canvas {
      display: block;
      width: 100%;
      height: auto;
      cursor: pointer;
    }

    .galton-board .gb-count {
      min-width: 6.2rem;
      color: var(--sfs-muted, var(--bs-secondary-color, #6c757d));
      font-variant-numeric: tabular-nums;
      font-size: 0.9rem;
      line-height: 1.2;
      align-self: center;
    }

    .galton-board .gb-bias-value {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .galton-board .gb-run-row input {
      width: 5.5rem;
    }

    @media (max-width: 560px) {
      .galton-board .gb-button {
        flex: 1 1 6rem;
      }

      .galton-board .gb-count {
        flex: 1 1 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

gbBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
  return fallback;
}

gbFiniteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

gbClamp = (value, min, max) =>
  Math.max(min, Math.min(max, value))

gbActionKey = (key) =>
  String(key).trim().toLowerCase().replace(/[\s_]+/g, "-")

gbHashSeed = (seed) => {
  const text = String(seed ?? "galton-board-v1");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

gbMulberry32 = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

gbSeededRng = (seed) => gbMulberry32(gbHashSeed(seed))

// Decorative cascade palette, validated for lightness/chroma/contrast on both
// the light and dark page surfaces. Ball color carries no meaning.
gbBallPalette = [
  "#3d7fc4", "#e4593b", "#c98122", "#3f9e6e", "#2a9db8", "#8a6fc8", "#d9639b"
]

gbBinomialPmf = (n, p) => {
  const pmf = [1];
  for (let row = 1; row <= n; row += 1) {
    for (let k = row; k >= 0; k -= 1) {
      const stay = k <= row - 1 ? pmf[k] * (1 - p) : 0;
      const step = k >= 1 ? pmf[k - 1] * p : 0;
      pmf[k] = stay + step;
    }
  }
  return pmf;
}

makeGaltonBoard = function(opts) {
  opts = opts || {};
  gbEnsureStyles();

  const rows = gbClamp(Math.round(gbFiniteNumber(opts.rows, 12)), 4, 18);
  const maxBalls = gbClamp(Math.round(gbFiniteNumber(opts.balls ?? opts.maxBalls, 400)), 1, 2000);
  const dropInterval = gbClamp(gbFiniteNumber(opts.dropInterval, 40), 8, 400);
  const expectedMode = opts.expected === "actual" ? "actual" : "fair";
  const showControls = gbBoolean(opts.controls, true);
  const showBiasControl = gbBoolean(opts.biasControl, false);

  const state = {
    seed: String(opts.seed ?? "galton-board-v1"),
    seedIndex: 0,
    bias: gbClamp(gbFiniteNumber(opts.bias ?? opts.pRight, 0.5), 0.2, 0.8),
    target: gbClamp(Math.round(gbFiniteNumber(opts.drop ?? opts.initialCount, 0)), 0, maxBalls),
    showExpected: gbBoolean(opts.showExpected ?? opts.expectedCurve, false)
  };

  function currentSeed() {
    return state.seedIndex === 0
      ? state.seed
      : state.seed + "#" + (state.seedIndex + 1);
  }

  // Logical drawing space; the canvas backing store is scaled to match.
  const W = 640;
  const sideMargin = 20;
  const sx = (W - 2 * sideMargin) / (rows + 1);
  const sy = 25;
  const cx = W / 2;
  const pegR = 2.6;
  const spoutY = 16;
  const pegTop = 52;
  const lastPegY = pegTop + (rows - 1) * sy;
  const binTop = lastPegY + 12;
  const binAreaH = gbClamp(gbFiniteNumber(opts.binAreaHeight, 200), 80, 400);
  const floorY = binTop + binAreaH;
  const H = floorY + 8;

  const binCenterX = (k) => cx + (k - rows / 2) * sx;
  const pegX = (row, index) => cx + (index - row / 2) * sx;
  const pegY = (row) => pegTop + row * sy;

  let plan = [];
  let ballR = 4.6;
  let binCols = 4;
  let expectedPmf = [];
  let spawnRng = null;

  function rebuildPlan() {
    const seed = currentSeed();
    const choiceRng = gbSeededRng(seed + "-choices-" + state.bias);
    plan = [];
    for (let i = 0; i < maxBalls; i += 1) {
      let bin = 0;
      for (let r = 0; r < rows; r += 1) {
        if (choiceRng() < state.bias) bin += 1;
      }
      plan.push({
        index: i,
        bin,
        color: gbBallPalette[i % gbBallPalette.length]
      });
    }

    // Fixed ball size: the largest radius giving at least five columns per
    // bin (capped for very wide bins), independent of the run. A freak run
    // whose tallest stack outgrows the bin area overflows above the divider
    // tops rather than changing the ball size.
    const innerW = sx - 4;
    ballR = Math.min(5.2, Math.max(2.6, Math.floor(innerW / 10 / 0.2) * 0.2));
    binCols = Math.max(1, Math.floor(innerW / (2 * ballR)));

    // Each ball lands in a random open column of its bin, staying within one
    // level of the bin's lowest column so piles fill bottom-up with a ragged,
    // physical-looking top rather than in neat left-to-right order.
    const slotRng = gbSeededRng(seed + "-slots");
    const heights = Array.from({ length: rows + 1 }, () => new Array(binCols).fill(0));
    for (const ball of plan) {
      const h = heights[ball.bin];
      let min = Infinity;
      for (const v of h) if (v < min) min = v;
      const open = [];
      for (let c = 0; c < h.length; c += 1) {
        if (h[c] <= min + 1) open.push(c);
      }
      const col = open[Math.floor(slotRng() * open.length)];
      ball.col = col;
      ball.row = h[col];
      ball.jitterX = (slotRng() - 0.5) * 1.4;
      h[col] += 1;
    }

    spawnRng = gbSeededRng(seed + "-spawn");
    expectedPmf = gbBinomialPmf(rows, expectedMode === "actual" ? state.bias : 0.5);
  }

  rebuildPlan();

  function stackPosition(ball) {
    const gridW = binCols * 2 * ballR;
    const x = binCenterX(ball.bin) - gridW / 2 + (ball.col + 0.5) * 2 * ballR + ball.jitterX;
    const y = floorY - (ball.row + 0.5) * 2 * ballR;
    return { x, y };
  }

  function buildPath(ball) {
    const rng = gbSeededRng(currentSeed() + "-motion-" + ball.index);
    const segments = [];
    let position = 0;
    let x0 = cx + (rng() - 0.5) * 3;
    let y0 = spoutY;

    const contact = pegR + ballR;
    const apexY = pegY(0) - contact;
    segments.push({
      dur: 150 + rng() * 40,
      from: [x0, y0],
      to: [cx, apexY],
      kind: "fall"
    });
    x0 = cx;
    y0 = apexY;

    const rights = [];
    // Reconstruct a left/right sequence consistent with this ball's bin:
    // distribute its `bin` rightward moves across the rows, seeded per ball.
    for (let r = 0; r < rows; r += 1) rights.push(r < ball.bin ? 1 : 0);
    for (let r = rows - 1; r > 0; r -= 1) {
      const j = Math.floor(rng() * (r + 1));
      const tmp = rights[r];
      rights[r] = rights[j];
      rights[j] = tmp;
    }

    for (let r = 0; r < rows; r += 1) {
      const goRight = rights[r] === 1;
      const nextPosition = position + (goRight ? 1 : 0);
      const isLast = r === rows - 1;
      const x1 = isLast
        ? binCenterX(nextPosition)
        : pegX(r + 1, nextPosition);
      const y1 = isLast ? lastPegY + 10 : pegY(r + 1) - contact;
      const dir = goRight ? 1 : -1;
      segments.push({
        dur: 115 + rng() * 35,
        from: [x0, y0],
        to: [x1, y1],
        kind: "hop",
        control: [x0 + dir * sx * 0.14, y0 - (5 + rng() * 4)]
      });
      position = nextPosition;
      x0 = x1;
      y0 = y1;
    }

    const target = stackPosition(ball);
    const fallH = target.y - y0;
    if (fallH < 12) {
      // Overfull bin: the landing spot is level with (or above) the last peg
      // row, so lob the ball onto the top of the pile instead of "falling"
      // upward into it.
      segments.push({
        dur: 130 + rng() * 25,
        from: [x0, y0],
        to: [target.x, target.y],
        kind: "hop",
        control: [(x0 + target.x) / 2, Math.min(y0, target.y) - 9]
      });
    } else {
      segments.push({
        dur: 70 + Math.sqrt(fallH) * 13 + rng() * 20,
        from: [x0, y0],
        to: [target.x, target.y],
        kind: "drop"
      });
    }

    let total = 0;
    for (const segment of segments) {
      segment.start = total;
      total += segment.dur;
    }
    return { segments, total, target };
  }

  function pathPosition(path, t) {
    const segments = path.segments;
    let segment = segments[segments.length - 1];
    for (let i = 0; i < segments.length; i += 1) {
      if (t < segments[i].start + segments[i].dur) {
        segment = segments[i];
        break;
      }
    }
    const u = gbClamp((t - segment.start) / segment.dur, 0, 1);
    const [ax, ay] = segment.from;
    const [bx, by] = segment.to;

    if (segment.kind === "hop") {
      const [mx, my] = segment.control;
      const s = 1 - u;
      return [
        s * s * ax + 2 * s * u * mx + u * u * bx,
        s * s * ay + 2 * s * u * my + u * u * by
      ];
    }

    if (segment.kind === "drop") {
      const ex = 1 - Math.pow(1 - u, 3);
      const ey = u * u;
      return [ax + (bx - ax) * ex, ay + (by - ay) * ey];
    }

    const e = u * u;
    return [ax + (bx - ax) * u, ay + (by - ay) * e];
  }

  const root = d3.create("div")
    .attr("class", "sfs-figure galton-board")
    .style("--gb-max-width", opts.maxWidth || "36rem")
    .style("--sfs-figure-max-width", opts.maxWidth || "36rem");
  const rootNode = root.node();

  let controls = null;
  let countNode = null;
  let resetButton = null;
  let expectedInput = null;
  let runInput = null;
  let biasInput = null;
  let biasValueNode = null;

  function addButton(parent, icon, label) {
    const button = parent.append("button")
      .attr("type", "button")
      .attr("class", "gb-button sfs-button")
      .attr("aria-label", label)
      .attr("title", label)
      .attr("data-prevent-swipe", "")
      .node();
    const iconNode = document.createElement("i");
    iconNode.className = "bi bi-" + icon;
    iconNode.setAttribute("aria-hidden", "true");
    const textNode = document.createElement("span");
    textNode.textContent = label;
    button.append(iconNode, textNode);
    return button;
  }

  if (showControls) {
    controls = root.append("div")
      .attr("class", "gb-controls sfs-control-grid");

    const dropPanel = controls.append("section")
      .attr("class", "gb-group sfs-control-panel sfs-if-control-panel");
    dropPanel.append("p")
      .attr("class", "sfs-control-title")
      .text("Drop balls");
    const actionRow = dropPanel.append("div")
      .attr("class", "gb-action-row sfs-action-row");
    const dropOne = addButton(actionRow, "plus-lg", "+1");
    const dropSome = addButton(actionRow, "plus-lg", "+25");
    const dropMany = addButton(actionRow, "plus-lg", "+100");
    resetButton = addButton(actionRow, "arrow-counterclockwise", "Reset");
    const newRunButton = addButton(actionRow, "shuffle", "New run");
    countNode = actionRow.append("span")
      .attr("class", "gb-count")
      .attr("aria-live", "polite")
      .node();

    const runRow = dropPanel.append("label")
      .attr("class", "sfs-control-row gb-run-row");
    runRow.append("span").text("Run #");
    runInput = runRow.append("input")
      .attr("type", "number")
      .attr("min", "1")
      .attr("step", "1")
      .attr("inputmode", "numeric")
      .property("value", state.seedIndex + 1)
      .node();
    runInput.addEventListener("change", (event) => {
      event.stopPropagation();
      setRun(Number(runInput.value));
    });
    runInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        setRun(Number(runInput.value));
      }
    });

    dropOne.addEventListener("click", (event) => {
      event.preventDefault();
      setDrop(state.target + 1, { animate: true, notify: true });
    });
    dropSome.addEventListener("click", (event) => {
      event.preventDefault();
      setDrop(state.target + 25, { animate: true, notify: true });
    });
    dropMany.addEventListener("click", (event) => {
      event.preventDefault();
      setDrop(state.target + 100, { animate: true, notify: true });
    });
    resetButton.addEventListener("click", (event) => {
      event.preventDefault();
      setDrop(0, { animate: false, notify: true });
    });
    newRunButton.addEventListener("click", (event) => {
      event.preventDefault();
      rerollSeed();
    });

    const showPanel = controls.append("section")
      .attr("class", "gb-group sfs-control-panel sfs-if-control-panel");
    showPanel.append("p")
      .attr("class", "sfs-control-title")
      .text("Show");
    const expectedRow = showPanel.append("label")
      .attr("class", "sfs-check-row");
    expectedInput = expectedRow.append("input")
      .attr("type", "checkbox")
      .property("checked", state.showExpected)
      .node();
    expectedRow.append("span").text("Expected distribution");
    expectedInput.addEventListener("input", (event) => {
      event.stopPropagation();
      state.showExpected = expectedInput.checked;
      drawFrame();
      setValue();
      notifyValueChange();
    });

    if (showBiasControl) {
      const biasRow = showPanel.append("label")
        .attr("class", "sfs-control-row");
      biasRow.append("span").text("Peg tilt");
      biasInput = biasRow.append("input")
        .attr("type", "range")
        .attr("min", "0.25")
        .attr("max", "0.75")
        .attr("step", "0.05")
        .property("value", state.bias)
        .node();
      biasValueNode = biasRow.append("span")
        .attr("class", "gb-bias-value sfs-readout-value")
        .node();
      biasInput.addEventListener("input", (event) => {
        event.stopPropagation();
        setBias(Number(biasInput.value), { notify: true });
      });
    }
  }

  const chartWrap = root.append("div")
    .attr("class", "gb-chart-wrap sfs-chart-wrap");
  const canvas = chartWrap.append("canvas")
    .attr("class", "gb-canvas")
    .attr("role", "img")
    .attr("aria-label", opts.ariaLabel ||
      "Galton board: balls fall through rows of pegs, bouncing left or right at random, and pile up into a bell-shaped distribution. Click to drop a ball.")
    .node();
  const ctx = canvas.getContext("2d");

  canvas.addEventListener("click", () => {
    setDrop(state.target + 1, { animate: true, notify: true });
  });

  let cssWidth = 0;
  let renderScale = 1;
  let themeCache = null;

  // The static board art (funnel, pegs, bins) and the already-settled balls
  // are cached on offscreen canvases; the animation loop only blits them and
  // draws the few balls actually in flight. Layout and computed-style reads
  // never happen inside the frame loop.
  const staticLayer = document.createElement("canvas");
  const staticCtx = staticLayer.getContext("2d");
  const settledLayer = document.createElement("canvas");
  const settledCtx = settledLayer.getContext("2d");
  let settledPainted = 0;

  function resizeCanvas() {
    const width = chartWrap.node().getBoundingClientRect().width || 560;
    if (Math.abs(width - cssWidth) < 0.5) return false;
    cssWidth = width;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pxW = Math.round(width * dpr);
    const pxH = Math.round(width * (H / W) * dpr);
    canvas.width = pxW;
    canvas.height = pxH;
    canvas.style.height = (width * (H / W)) + "px";
    staticLayer.width = pxW;
    staticLayer.height = pxH;
    settledLayer.width = pxW;
    settledLayer.height = pxH;
    renderScale = pxW / W;
    return true;
  }

  function parseColor(color) {
    staticCtx.fillStyle = "#000";
    staticCtx.fillStyle = color;
    const normalized = staticCtx.fillStyle;
    if (normalized[0] === "#") {
      return [
        parseInt(normalized.slice(1, 3), 16),
        parseInt(normalized.slice(3, 5), 16),
        parseInt(normalized.slice(5, 7), 16)
      ];
    }
    const parts = normalized.match(/[\d.]+/g);
    return parts ? [Number(parts[0]), Number(parts[1]), Number(parts[2])] : [0, 0, 0];
  }

  function luminance(rgb) {
    const channel = (v) => {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  }

  function contrastRatio(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function currentTheme() {
    if (themeCache) return themeCache;
    const styles = getComputedStyle(rootNode);
    const read = (name, fallback) => {
      const value = styles.getPropertyValue(name).trim();
      return value || fallback;
    };
    const accent = read("--sfs-accent", "#2c7fb8");
    const bg = read("--sfs-bg", "#ffffff");
    const text = read("--sfs-text", "#212529");

    // The accent can resolve to a low-contrast color on the current surface
    // (darkly's navy on near-black); blend it toward the text color until
    // the expected curve is clearly legible.
    let curve = accent;
    const bgRgb = parseColor(bg);
    let curveRgb = parseColor(accent);
    const textRgb = parseColor(text);
    for (let i = 0; i < 4 && contrastRatio(curveRgb, bgRgb) < 3; i += 1) {
      curveRgb = curveRgb.map((v, c) => Math.round(v + (textRgb[c] - v) * 0.4));
      curve = "rgb(" + curveRgb.join(",") + ")";
    }

    themeCache = {
      text,
      bg,
      border: read("--sfs-border", "#dee2e6"),
      muted: read("--sfs-muted", "#6c757d"),
      accent,
      curve
    };
    return themeCache;
  }

  function repaintStaticLayer() {
    if (!staticLayer.width) return;
    staticCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    staticCtx.clearRect(0, 0, W, H);
    drawBoard(staticCtx, currentTheme());
  }

  function repaintSettledLayer() {
    if (!settledLayer.width) return;
    settledCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    settledCtx.clearRect(0, 0, W, H);
    settledPainted = 0;
    paintNewSettled();
  }

  function paintNewSettled() {
    if (!settledLayer.width) return;
    const theme = currentTheme();
    while (settledPainted < anim.settled.length) {
      const ball = anim.settled[settledPainted];
      drawBall(settledCtx, theme, ball.x, ball.y, ball.color);
      settledPainted += 1;
    }
  }

  function refreshLayers() {
    repaintStaticLayer();
    repaintSettledLayer();
  }

  const anim = {
    time: 0,
    lastFrame: null,
    rafId: null,
    nextSpawnAt: 0,
    spawnCursor: 0,
    flying: [],
    settled: [],
    counts: new Array(rows + 1).fill(0),
    onscreen: true
  };

  function prefersReducedMotion() {
    return window.interactiveRuntime && window.interactiveRuntime.motion
      ? window.interactiveRuntime.motion.isReduced()
      : Boolean(window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function drawPeg(c, theme, x, y) {
    const tilt = (state.bias - 0.5) * 2;
    c.fillStyle = theme.text;
    c.strokeStyle = theme.text;
    c.globalAlpha = 0.78;
    if (Math.abs(tilt) < 0.01) {
      c.beginPath();
      c.arc(x, y, pegR, 0, Math.PI * 2);
      c.fill();
    } else {
      // Tilted pegs read as little ramps shedding balls toward the favored
      // side: right end lower when the bias favors rightward bounces.
      const angle = tilt * 0.7;
      const len = 5.6;
      const dx = Math.cos(angle) * len;
      const dy = Math.sin(angle) * len;
      c.lineWidth = 4.4;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(x - dx, y - dy);
      c.lineTo(x + dx, y + dy);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  function drawBoard(c, theme) {
    c.strokeStyle = theme.border;
    c.lineWidth = 1.4;
    c.lineCap = "round";

    const wallX = ((rows + 1) * sx) / 2;
    c.beginPath();
    for (let k = 0; k <= rows + 1; k += 1) {
      const x = cx + (k - (rows + 1) / 2) * sx;
      c.moveTo(x, binTop);
      c.lineTo(x, floorY);
    }
    c.moveTo(cx - wallX, floorY + 0.7);
    c.lineTo(cx + wallX, floorY + 0.7);
    c.stroke();

    c.strokeStyle = theme.muted;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx - 52, 4);
    c.lineTo(cx - 9, spoutY + 10);
    c.moveTo(cx + 52, 4);
    c.lineTo(cx + 9, spoutY + 10);
    c.stroke();

    for (let r = 0; r < rows; r += 1) {
      for (let j = 0; j <= r; j += 1) {
        drawPeg(c, theme, pegX(r, j), pegY(r));
      }
    }
  }

  function drawExpectedCurve(theme) {
    if (!state.showExpected) return;
    const n = anim.settled.length + anim.flying.length;
    if (!n) return;

    const points = [];
    for (let k = 0; k <= rows; k += 1) {
      const height = (n * expectedPmf[k] / binCols) * 2 * ballR;
      points.push([binCenterX(k), floorY - height]);
    }
    points.unshift([binCenterX(0) - sx / 2, floorY]);
    points.push([binCenterX(rows) + sx / 2, floorY]);

    ctx.strokeStyle = theme.curve;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length - 1; i += 1) {
      const midX = (points[i][0] + points[i + 1][0]) / 2;
      const midY = (points[i][1] + points[i + 1][1]) / 2;
      ctx.quadraticCurveTo(points[i][0], points[i][1], midX, midY);
    }
    ctx.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
    ctx.stroke();
  }

  function drawBall(c, theme, x, y, color) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, ballR, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = theme.bg;
    c.globalAlpha = 0.55;
    c.lineWidth = 1;
    c.stroke();
    c.globalAlpha = 1;
  }

  function drawFrame() {
    if (!canvas.width) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticLayer, 0, 0);
    ctx.drawImage(settledLayer, 0, 0);
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

    const theme = currentTheme();
    for (const ball of anim.flying) {
      const [x, y] = pathPosition(ball.path, anim.time - ball.t0);
      drawBall(ctx, theme, x, y, ball.color);
    }
    drawExpectedCurve(theme);
  }

  function isBusy() {
    return anim.flying.length > 0 || anim.spawnCursor < state.target;
  }

  function frame(timestamp) {
    anim.rafId = null;
    if (anim.lastFrame === null) anim.lastFrame = timestamp;
    const dt = Math.min(50, timestamp - anim.lastFrame);
    anim.lastFrame = timestamp;
    anim.time += dt;

    while (anim.spawnCursor < state.target && anim.time >= anim.nextSpawnAt) {
      const ball = plan[anim.spawnCursor];
      anim.flying.push({
        index: ball.index,
        bin: ball.bin,
        color: ball.color,
        t0: anim.time,
        path: buildPath(ball)
      });
      anim.spawnCursor += 1;
      anim.nextSpawnAt = anim.time + dropInterval * (0.75 + spawnRng() * 0.5);
    }

    let landed = false;
    for (let i = anim.flying.length - 1; i >= 0; i -= 1) {
      const ball = anim.flying[i];
      if (anim.time - ball.t0 >= ball.path.total) {
        anim.settled.push({
          bin: ball.bin,
          color: ball.color,
          x: ball.path.target.x,
          y: ball.path.target.y
        });
        anim.counts[ball.bin] += 1;
        anim.flying.splice(i, 1);
        landed = true;
      }
    }

    if (landed) paintNewSettled();
    drawFrame();
    if (landed) {
      syncControls();
      setValue();
      notifyValueChange();
    }

    if (isBusy() && anim.onscreen) {
      anim.rafId = window.requestAnimationFrame(frame);
    } else {
      anim.lastFrame = null;
    }
  }

  function startLoop() {
    if (anim.rafId !== null || !anim.onscreen || !isBusy()) return;
    anim.lastFrame = null;
    anim.rafId = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (anim.rafId !== null) {
      window.cancelAnimationFrame(anim.rafId);
      anim.rafId = null;
    }
    anim.lastFrame = null;
  }

  function snapTo(n) {
    stopLoop();
    anim.flying = [];
    anim.spawnCursor = n;
    anim.nextSpawnAt = anim.time;
    anim.counts = new Array(rows + 1).fill(0);
    anim.settled = [];
    for (let i = 0; i < n; i += 1) {
      const ball = plan[i];
      const target = stackPosition(ball);
      anim.settled.push({ bin: ball.bin, color: ball.color, x: target.x, y: target.y });
      anim.counts[ball.bin] += 1;
    }
    repaintSettledLayer();
    drawFrame();
  }

  function setDrop(count, options) {
    options = options || {};
    const next = gbClamp(Math.round(gbFiniteNumber(count, state.target)), 0, maxBalls);
    const animate = options.animate !== false && !prefersReducedMotion();

    if (next === state.target && next === anim.spawnCursor && !anim.flying.length) {
      syncControls();
      return;
    }

    state.target = next;
    if (!animate || next < anim.spawnCursor) {
      snapTo(next);
    } else {
      anim.nextSpawnAt = Math.min(anim.nextSpawnAt, anim.time);
      startLoop();
    }
    syncControls();
    setValue();
    if (options.notify) notifyValueChange();
  }

  function setRun(runNumber, options) {
    options = options || {};
    const next = Math.max(1, Math.round(gbFiniteNumber(runNumber, state.seedIndex + 1)));
    if (next === state.seedIndex + 1) {
      syncControls();
      return;
    }
    const prevTarget = state.target;
    state.seedIndex = next - 1;
    rebuildPlan();
    snapTo(0);
    state.target = 0;
    syncControls();
    setValue();
    if (options.redrop !== false && prevTarget > 0) {
      setDrop(prevTarget, { animate: true, notify: true });
    } else {
      notifyValueChange();
    }
  }

  function rerollSeed() {
    setRun(state.seedIndex + 2);
  }

  function setBias(value, options) {
    options = options || {};
    const next = gbClamp(gbFiniteNumber(value, state.bias), 0.2, 0.8);
    if (Math.abs(next - state.bias) < 0.001) return;
    state.bias = next;
    rebuildPlan();
    repaintStaticLayer();
    snapTo(0);
    state.target = 0;
    syncControls();
    setValue();
    if (options.notify) notifyValueChange();
  }

  function syncControls() {
    if (countNode) {
      countNode.textContent = anim.settled.length + " / " + maxBalls + " balls";
    }
    if (resetButton) resetButton.disabled = state.target === 0 && !anim.settled.length;
    if (expectedInput) expectedInput.checked = state.showExpected;
    if (runInput && document.activeElement !== runInput) {
      runInput.value = state.seedIndex + 1;
    }
    if (biasInput) {
      biasInput.value = state.bias;
      if (biasValueNode) {
        biasValueNode.textContent = "P(right) = " + state.bias.toFixed(2);
      }
    }
  }

  function setValue() {
    const n = anim.settled.length;
    let sum = 0;
    let sumSq = 0;
    for (let k = 0; k <= rows; k += 1) {
      sum += k * anim.counts[k];
      sumSq += k * k * anim.counts[k];
    }
    const mean = n ? sum / n : null;
    rootNode.value = {
      seed: currentSeed(),
      run: state.seedIndex + 1,
      rows,
      bins: rows + 1,
      bias: state.bias,
      maxBalls,
      target: state.target,
      settled: n,
      ballRadius: ballR,
      binColumns: binCols,
      counts: anim.counts.slice(),
      mean,
      sd: n ? Math.sqrt(Math.max(0, sumSq / n - mean * mean)) : null,
      expectedCounts: expectedPmf.map((p) => p * n),
      showExpected: state.showExpected
    };
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  function applyTutorialAction(action, context) {
    action = action || {};
    const animate = action.animate !== false;
    let dropTarget = null;
    let redraw = false;

    Object.entries(action).forEach(([rawKey, value]) => {
      const key = gbActionKey(rawKey);
      switch (key) {
        case "animate":
          break;
        case "drop":
        case "balls":
        case "count":
          dropTarget = Math.round(gbFiniteNumber(value, state.target));
          break;
        case "reset":
          if (gbBoolean(value, true) && dropTarget === null) dropTarget = 0;
          break;
        case "bias":
        case "p-right":
        case "tilt":
          setBias(value, { notify: false });
          break;
        case "seed":
          if (String(value) !== state.seed || state.seedIndex !== 0) {
            state.seed = String(value);
            state.seedIndex = 0;
            rebuildPlan();
            snapTo(0);
            state.target = 0;
            redraw = true;
          }
          break;
        case "run":
          setRun(value, { redrop: false });
          redraw = true;
          break;
        case "expected":
        case "show-expected":
        case "expected-curve":
          state.showExpected = gbBoolean(value, state.showExpected);
          redraw = true;
          break;
        case "controls":
        case "controls-open":
          if (context && typeof context.setControlsOpen === "function") {
            context.setControlsOpen(gbBoolean(value, true), animate);
          }
          break;
        default:
          break;
      }
    });

    if (dropTarget !== null) {
      setDrop(dropTarget, { animate, notify: true });
      return;
    }
    if (redraw) {
      drawFrame();
      syncControls();
      setValue();
      notifyValueChange();
    }
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => {
      anim.onscreen = entry.isIntersecting;
      if (anim.onscreen) {
        startLoop();
      } else {
        stopLoop();
      }
    }, { threshold: 0 });
    observer.observe(rootNode);
  }

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => {
      if (resizeCanvas()) {
        refreshLayers();
        drawFrame();
      }
    });
    observer.observe(chartWrap.node());
  }

  function refreshThemeIfChanged() {
    const previous = themeCache && JSON.stringify(themeCache);
    themeCache = null;
    if (!canvas.width) return;
    if (previous && JSON.stringify(currentTheme()) === previous) return;
    refreshLayers();
    drawFrame();
  }

  let themeRefreshTimers = [];

  // The theme class flips before the alternate stylesheet's custom
  // properties are guaranteed to have applied, so re-check the resolved
  // colors over a short window rather than once, synchronously.
  function scheduleThemeRefresh() {
    themeRefreshTimers.forEach((id) => window.clearTimeout(id));
    themeRefreshTimers = [window.setTimeout(refreshThemeIfChanged, 150),
      window.setTimeout(refreshThemeIfChanged, 600)];
    window.requestAnimationFrame(refreshThemeIfChanged);
  }

  // Canvas pixels don't follow the CSS cascade, so subscribe to it: a hidden
  // sentinel binds theme tokens to transitionable properties, and the 1ms
  // transition's end event fires at the exact moment new token values apply.
  const themeSentinel = document.createElement("div");
  themeSentinel.setAttribute("aria-hidden", "true");
  themeSentinel.style.cssText =
    "position:absolute;width:1px;height:1px;visibility:hidden;pointer-events:none;" +
    "color:var(--sfs-text,#212529);background-color:var(--sfs-bg,#fff);" +
    "outline-color:var(--sfs-accent,#2c7fb8);" +
    "transition:color 1ms,background-color 1ms,outline-color 1ms;";
  themeSentinel.addEventListener("transitionend", refreshThemeIfChanged);
  rootNode.appendChild(themeSentinel);

  // Fallback for environments where transitions never run (e.g. forced
  // reduced motion): infer theme flips from attribute changes and re-check
  // over a short window, since the class can flip before the alternate
  // stylesheet's values apply.
  if ("MutationObserver" in window) {
    const observer = new MutationObserver(scheduleThemeRefresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-bs-theme"]
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  rootNode.galtonBoard = {
    drop(count) { setDrop(state.target + Math.max(1, Math.round(count || 1)), { animate: true, notify: true }); },
    setDrop(count) { setDrop(count, { animate: true, notify: true }); },
    setBias(value) { setBias(value, { notify: true }); },
    setRun(runNumber) { setRun(runNumber); },
    newRun() { rerollSeed(); },
    reset() { setDrop(0, { animate: false, notify: true }); },
    applyTutorialAction
  };

  if (showControls && window.interactiveFigure) {
    window.interactiveFigure.wrap({
      root: rootNode,
      controls: controls.node(),
      label: "Galton board controls",
      placement: opts.controlsPlacement || "callout",
      layout: opts.controlsLayout || "equal",
      applyAction: applyTutorialAction,
      startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
    });
  }

  requestAnimationFrame(() => {
    resizeCanvas();
    refreshLayers();
    if (state.target > 0) {
      snapTo(state.target);
    } else {
      drawFrame();
    }
    syncControls();
    setValue();
  });

  return rootNode;
}
