// The Chapter 13 opening game: a schematic of Triplett's (1898) competition
// machine, raced once alone and once against a rival flag. The rules live in
// triplett-core.js; this file only draws the machine and listens for input.
//
// The drawing alludes to the figure in Triplett's paper: a Y-shaped frame of
// two planks, a reel at the end of each arm ("a" and "b"), and the silk cords
// running to pulleys at the far end ("c"). Each flag rides its cord loop;
// four laps make a race, as in the original.
//
// Input: small circles drawn anywhere on the machine wind the reel (finger,
// pen, or mouse, which needs no button held); Space or Enter winds it a
// quarter turn per press. Touch is only captured while a race is running, so
// the machine never traps a reader scrolling past.
//
// Options (all optional):
//   phase        starting phase: "practice" | "alone" | "competition", or
//                "results" (the machine at rest with a "Race again" button
//                that runs another round, alone then competition, without
//                leaving the step: Triplett's alternating trials)
//   tutorial     true inside a tutorial callout. Steps choose the phase with
//                {"phase": ...}; {"advanceOnFinish": true} moves the tutorial
//                to the next step shortly after that race is finished, and
//                keeps Next locked until then.
//   autoAdvance  outside a tutorial: practice -> alone -> competition (true)
//   settings     overrides for sfsTriplett.DEFAULTS (laps, turnsPerLap, ...)
//   maxWidth     CSS max-width of the figure
//   seed         the rival's drift (default settings.rivalSeed, the same for every reader)
(function() {
  "use strict";

  // Sizes in CSS pixels; the drawing is rebuilt at the figure's width rather
  // than scaled, so the reels, flags and text keep these sizes on a phone.
  const LOOK = {
    minWidth: 280,
    maxWidth: 760,
    heightRatio: 0.34,
    minHeight: 200,
    maxHeight: 250,
    padLeft: 56,
    padRight: 26,
    padTop: 56,
    padBottom: 62,
    plank: 18,
    drum: 6,          // radius the cord wraps around, at the reel and pulley
    flange: 13,
    crank: 23,
    knob: 5,
    hintRadius: 34,
    pulleyGap: 8,     // half the distance between the two pulleys
    flagPole: 17,
    flagLength: 13,
    flagDepth: 9,
    pipRadius: 3.2,
    pipGap: 9
  };

  // Every word the figure shows or announces, for one review pass.
  const TEXT = {
    ariaLabel: "Triplett's competition machine. Wind your reel to send your flag around its track.",
    stageLabel: "Your reel. Draw small circles here, or press Space repeatedly, to wind it.",
    phases: { practice: "Practice", alone: "Alone", competition: "Competition" },
    start: { practice: "Start practice", alone: "Start", competition: "Start race" },
    // Racing again from the results card: the reader knows the controls by
    // then, so the buttons say which race is next instead of how to play.
    startAgain: { alone: "Race alone again", competition: "Race the rival again" },
    hintPointer: "Then move your mouse in small circles over the machine.",
    hintTouch: "Then draw small circles on the machine with your finger.",
    hintKeys: "Or press Space over and over.",
    go: "Go!",
    practiceLap: (lap, laps) => `Practice lap ${lap} of ${laps}`,
    lap: (lap, laps) => `Lap ${lap} of ${laps}`,
    seconds: (value) => `${value.toFixed(2)} s`,
    you: "You",
    rival: "Rival",
    practiceDone: "Got it!",
    finished: "Finished!",
    won: (margin) => `You beat the rival by ${margin.toFixed(2)} s`,
    winning: "You won!",
    lost: (margin) => `The rival won by ${margin.toFixed(2)} s`,
    again: "Race again",
    // Bootstrap Icons (bundled locally by Quarto): one person racing alone,
    // two racing each other.
    icons: { practice: "person-fill", alone: "person-fill", competition: "people-fill", again: "arrow-repeat" },
    caption: "Competition machine —",
    scores: { alone: "Alone", competition: "Competition", difference: "Difference" },
    announceReady: "Get ready.",
    announceGo: "Go!",
    announceTime: (phase, seconds) => `${TEXT.phases[phase]}: ${seconds.toFixed(2)} seconds.`,
    announcePractice: "Practice done."
  };

  const SVG = "http://www.w3.org/2000/svg";

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function signed(value) {
    value = Math.round(value * 100) / 100;
    const text = Math.abs(value).toFixed(2);
    return value < 0 ? `−${text}` : value > 0 ? `+${text}` : text;
  }

  // ---- Geometry (pure) -------------------------------------------------

  // A cord loop is a stadium: out along one side from reel to pulley, round
  // the pulley, back along the other side, round the reel. Distance s runs
  // in that order from the tangent point on the outward side of the reel.
  function makeLoop(reel, pulley, r) {
    const dx = pulley.x - reel.x;
    const dy = pulley.y - reel.y;
    const span = Math.hypot(dx, dy);
    const u = { x: dx / span, y: dy / span };
    const n = { x: u.y, y: -u.x };           // left of travel: "up" for a rightward cord
    const theta = Math.atan2(n.y, n.x);
    const arc = Math.PI * r;
    return { reel, pulley, r, u, n, theta, span, length: 2 * span + 2 * arc };
  }

  function loopPath(loop) {
    const { reel, pulley, r, n } = loop;
    const p = (c, k) => `${(c.x + n.x * r * k).toFixed(2)} ${(c.y + n.y * r * k).toFixed(2)}`;
    return `M${p(reel, 1)}L${p(pulley, 1)}A${r} ${r} 0 0 1 ${p(pulley, -1)}` +
      `L${p(reel, -1)}A${r} ${r} 0 0 1 ${p(reel, 1)}Z`;
  }

  // Point, direction of travel, and outward normal at distance s.
  function pointOnLoop(loop, s) {
    const { reel, pulley, r, u, n, theta, span, length } = loop;
    const arc = Math.PI * r;
    s = ((s % length) + length) % length;
    if (s < span) {
      return { x: reel.x + n.x * r + u.x * s, y: reel.y + n.y * r + u.y * s, tx: u.x, ty: u.y, ox: n.x, oy: n.y };
    }
    s -= span;
    if (s < arc) {
      const a = theta + s / r;
      return { x: pulley.x + r * Math.cos(a), y: pulley.y + r * Math.sin(a), tx: -Math.sin(a), ty: Math.cos(a), ox: Math.cos(a), oy: Math.sin(a) };
    }
    s -= arc;
    if (s < span) {
      return { x: pulley.x - n.x * r - u.x * s, y: pulley.y - n.y * r - u.y * s, tx: -u.x, ty: -u.y, ox: -n.x, oy: -n.y };
    }
    s -= span;
    const a = theta + Math.PI + s / r;
    return { x: reel.x + r * Math.cos(a), y: reel.y + r * Math.sin(a), tx: -Math.sin(a), ty: Math.cos(a), ox: Math.cos(a), oy: Math.sin(a) };
  }

  function machineGeometry(width) {
    const W = Math.round(width);
    const H = Math.round(clamp(W * LOOK.heightRatio, LOOK.minHeight, LOOK.maxHeight));
    const left = LOOK.padLeft;
    const right = W - LOOK.padRight;
    const yTop = LOOK.padTop;
    const yBot = H - LOOK.padBottom;
    const yMid = (yTop + yBot) / 2;
    const pulleyX = right - LOOK.drum - 6;
    // The flag starts and finishes just clear of the reel's flange.
    const startAt = LOOK.flange + 8;
    const station = (key, y, pulleyY, side) => {
      const reel = { x: left, y };
      const pulley = { x: pulleyX, y: pulleyY };
      return { key, side, reel, pulley, loop: makeLoop(reel, pulley, LOOK.drum), startAt };
    };
    return {
      width: W,
      height: H,
      left,
      right,
      yTop,
      yBot,
      yMid,
      pulleyX,
      // The reader is "a" (lower arm), the rival "b" (upper), as Triplett
      // lettered them.
      stations: {
        rival: station("rival", yTop, yMid - LOOK.pulleyGap, -1),
        you: station("you", yBot, yMid + LOOK.pulleyGap, 1)
      }
    };
  }

  window.sfsTriplettMachine = { LOOK, TEXT, makeLoop, loopPath, pointOnLoop, machineGeometry };

  // ---- Styles -------------------------------------------------------------

  function ensureStyles() {
    if (document.getElementById("triplett-race-styles")) return;
    const style = document.createElement("style");
    style.id = "triplett-race-styles";
    style.textContent = `
      .sfs-triplett {
        --tr-you: var(--graph-series-1, #0072b2);
        --tr-rival: var(--sfs-current-color, #d1495b);
        --tr-ink: var(--sfs-text, currentColor);
        --tr-muted: var(--sfs-muted, #6c757d);
        --tr-paper: var(--sfs-bg, #fff);
        --tr-wood: color-mix(in srgb, var(--tr-muted) 13%, var(--tr-paper));
        width: 100%;
        max-width: var(--tr-max-width, 46rem);
        margin: 0 auto 0.75rem;
        color: var(--tr-ink);
      }
      body.quarto-dark .sfs-triplett {
        --tr-you: #68b8e5;
        --tr-rival: color-mix(in srgb, var(--sfs-current-color, #d1495b) 72%, white);
      }
      .sfs-triplett .tr-phases { display: flex; justify-content: center; gap: var(--sfs-action-gap, 0.4rem); margin-bottom: 0.5rem; }
      .sfs-triplett .tr-phases .sfs-button[aria-pressed="true"] { border-color: var(--sfs-accent); color: var(--sfs-accent); font-weight: 650; }
      .sfs-triplett .tr-status {
        display: flex; justify-content: space-between; align-items: baseline;
        min-height: 2rem; padding: 0 0.25rem; font-variant-numeric: tabular-nums;
      }
      .sfs-triplett .tr-lap { color: var(--tr-muted); font-size: var(--sfs-figure-label-size, 0.875rem); font-weight: 600; }
      .sfs-triplett .tr-clock { font-size: 1.35rem; font-weight: 700; }
      .sfs-triplett .tr-stage {
        position: relative;
        border-radius: var(--sfs-radius-lg, 8px);
        user-select: none; -webkit-user-select: none;
        -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
      }
      .sfs-triplett .tr-stage:focus { outline: none; }
      .sfs-triplett .tr-stage:focus-visible { outline: 2px solid var(--sfs-focus, currentColor); outline-offset: 3px; }
      .sfs-triplett .tr-stage.is-live { touch-action: none; cursor: crosshair; }
      .sfs-triplett .tr-machine { display: block; width: 100%; height: auto; overflow: visible; }
      .sfs-triplett .tr-plank-edge { fill: none; stroke: var(--tr-muted); stroke-linecap: round; }
      .sfs-triplett .tr-plank { fill: none; stroke: var(--tr-wood); stroke-linecap: round; }
      .sfs-triplett .tr-plate { fill: var(--tr-wood); stroke: var(--tr-muted); stroke-width: 1.2; }
      .sfs-triplett .tr-bolt { fill: var(--tr-muted); }
      .sfs-triplett .tr-cord { fill: none; stroke: var(--tr-ink); stroke-width: 1.4; stroke-dasharray: 7 3; }
      .sfs-triplett .tr-finish { stroke: var(--tr-ink); stroke-width: 2; stroke-linecap: round; }
      .sfs-triplett .tr-pulley { fill: var(--tr-paper); stroke: var(--tr-ink); stroke-width: 1.3; }
      .sfs-triplett .tr-flange { fill: var(--tr-paper); stroke: var(--tr-ink); stroke-width: 1.4; }
      .sfs-triplett .tr-drum { fill: none; stroke: var(--tr-ink); stroke-width: 1.2; }
      .sfs-triplett .tr-crank-arm { stroke: var(--tr-ink); stroke-width: 3; stroke-linecap: round; }
      .sfs-triplett .tr-knob { fill: currentColor; stroke: var(--tr-paper); stroke-width: 1.5; }
      .sfs-triplett .tr-flag { fill: currentColor; stroke: var(--tr-paper); stroke-width: 1; stroke-linejoin: round; }
      .sfs-triplett .tr-flag-pole { stroke: var(--tr-ink); stroke-width: 1.4; stroke-linecap: round; }
      .sfs-triplett .tr-station--you { color: var(--tr-you); }
      .sfs-triplett .tr-station--rival { color: var(--tr-rival); }
      .sfs-triplett .tr-station { transition: opacity 250ms ease; }
      .sfs-triplett .tr-station.is-idle { opacity: 0.25; }
      .sfs-triplett .tr-name { fill: currentColor; font-size: 12px; font-weight: 700; }
      .sfs-triplett .tr-pip { fill: var(--tr-paper); stroke: currentColor; stroke-width: 1.3; }
      .sfs-triplett .tr-pip.is-done { fill: currentColor; }
      .sfs-triplett .tr-letter { fill: var(--tr-muted); font-family: Georgia, "Times New Roman", serif; font-style: italic; font-size: 15px; }
      .sfs-triplett .tr-caption { fill: var(--tr-muted); font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; }
      .sfs-triplett .tr-hint { color: var(--tr-you); opacity: 0; transition: opacity 200ms ease; pointer-events: none; }
      .sfs-triplett .tr-hint.is-on { opacity: 0.8; }
      .sfs-triplett .tr-hint-ring { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-dasharray: 4 5; }
      .sfs-triplett .tr-hint-arrow { fill: currentColor; }
      /* Spun about the reel's axle (set inline), not the group's own box:
         the arrowhead makes that box lopsided, which made the ring wobble. */
      .sfs-triplett .tr-hint-spin { transform-box: view-box; animation: tr-spin 1.4s linear infinite; }
      @keyframes tr-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .sfs-triplett .tr-hint-spin { animation: none; } }
      html[data-motion="reduced"] .sfs-triplett .tr-hint-spin { animation: none; }
      .sfs-triplett .tr-overlay {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        pointer-events: none;
      }
      .sfs-triplett .tr-overlay[hidden] { display: none; }
      .sfs-triplett .tr-card {
        pointer-events: auto;
        display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
        max-width: min(22rem, 92%);
        padding: 0.75rem 1.1rem;
        border-radius: var(--sfs-radius-lg, 8px);
        background: color-mix(in srgb, var(--tr-paper) 90%, transparent);
        box-shadow: 0 1px 8px color-mix(in srgb, var(--tr-ink) 18%, transparent);
        text-align: center;
      }
      .sfs-triplett .tr-card.is-bare { background: none; box-shadow: none; pointer-events: none; }
      .sfs-triplett .tr-card > [hidden] { display: none; }
      /* Green like the interactive callouts and their Next arrow: "press me". */
      .sfs-triplett .tr-start {
        --tr-go: var(--interactive-callout-color, var(--sfs-accent, #198754));
        min-height: 2.75rem; padding: 0.5rem 1.5rem;
        border: 0; border-radius: 999px;
        background: var(--tr-go); color: var(--sfs-if-step-on-accent, #fff);
        font-size: 1.1rem; font-weight: 700;
      }
      .sfs-triplett .tr-start:hover:not(:disabled),
      .sfs-triplett .tr-start:focus-visible:not(:disabled) {
        background: color-mix(in srgb, var(--tr-go) 82%, var(--tr-ink));
        border-color: transparent; color: var(--sfs-if-step-on-accent, #fff);
      }
      .sfs-triplett .tr-big { font-size: 2.5rem; font-weight: 750; line-height: 1.05; font-variant-numeric: tabular-nums; }
      .sfs-triplett .tr-card.is-bare .tr-big { color: var(--tr-you); font-size: 3.2rem; text-shadow: 0 0 6px var(--tr-paper), 0 0 2px var(--tr-paper); }
      .sfs-triplett .tr-sub { color: var(--tr-muted); font-size: 0.9rem; line-height: 1.3; }
      .sfs-triplett .tr-scores { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; margin-top: 0.6rem; }
      .sfs-triplett .tr-score { padding: 0.45rem 0.75rem; border-radius: var(--sfs-radius-md, 6px); background: var(--sfs-control-bg, rgba(0,0,0,0.04)); }
      .sfs-triplett .tr-score[hidden] { display: none; }
      .sfs-triplett .tr-score:nth-child(2) { grid-column: 2; }
      .sfs-triplett .tr-score:nth-child(3) { grid-column: 3; }
      .sfs-triplett[data-sfs-layout="compact"] .tr-score { padding: 0.4rem 0.5rem; }
      .sfs-triplett[data-sfs-layout="compact"] .tr-score-label { font-size: var(--sfs-figure-micro-size, 0.6875rem); letter-spacing: 0.02em; }
      .sfs-triplett[data-sfs-layout="compact"] .tr-score-value { font-size: 1.2rem; }
      .sfs-triplett .tr-score.is-revealing { animation: tr-reveal 350ms ease-out; }
      @keyframes tr-reveal { from { opacity: 0; transform: translateY(4px); } }
      @media (prefers-reduced-motion: reduce) { .sfs-triplett .tr-score.is-revealing { animation: none; } }
      html[data-motion="reduced"] .sfs-triplett .tr-score.is-revealing { animation: none; }
      .sfs-triplett .tr-score-label {
        display: block; color: var(--tr-muted);
        font-size: var(--sfs-figure-small-size, 0.75rem); font-weight: 700;
        letter-spacing: 0.06em; text-transform: uppercase;
      }
      .sfs-triplett .tr-score-value { font-size: 1.35rem; font-weight: 700; font-variant-numeric: tabular-nums; }
      .sfs-triplett .tr-score.is-fresh { box-shadow: inset 0 0 0 2px var(--tr-you); }
    `;
    document.head.appendChild(style);
  }

  // ---- Figure -------------------------------------------------------------

  function svgEl(tag, attrs, parent) {
    const node = document.createElementNS(SVG, tag);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value));
    if (parent) parent.appendChild(node);
    return node;
  }

  // A button's icon and words; rewritten only when they change.
  function setLabel(button, icon, label) {
    const key = `${icon}|${label}`;
    if (button.dataset.label === key) return;
    button.dataset.label = key;
    button.replaceChildren();
    if (icon) {
      const glyph = document.createElement("i");
      glyph.className = `bi bi-${icon}`;
      glyph.setAttribute("aria-hidden", "true");
      button.appendChild(glyph);
    }
    button.appendChild(document.createTextNode(label));
  }

  function htmlEl(tag, className, parent, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  window.makeTriplettRace = function(opts) {
    opts = opts || {};
    const core = window.sfsTriplett;
    ensureStyles();
    if (window.interactiveFigure) window.interactiveFigure.ensureStyles();

    const tutorial = opts.tutorial === true;
    const autoAdvance = opts.autoAdvance !== false;
    const settings = Object.assign({}, core.DEFAULTS, opts.settings || {});
    if (Number.isFinite(Number(opts.seed))) settings.rivalSeed = Number(opts.seed);
    const coarsePointer = Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

    const records = { alone: null, competition: null };
    const completed = new Set();
    // Score tiles appear as their races come up and then stay, even when the
    // reader goes back: Alone from the alone race on, Competition from the
    // competition race, Difference once both times exist.
    const revealed = new Set();
    const tracker = core.createCircleTracker();
    let phase = core.PHASES.includes(opts.phase) ? opts.phase : "practice";
    let race = null;
    let geometry = null;
    let parts = null;
    let frameId = null;
    let goUntil = 0;
    let advanceTimer = null;
    let advanceStep = null;
    let advancing = false;
    // Racing again from the results card: alone, then competition, then
    // back to the card, all on the results step.
    let round = false;
    let activePointer = null;
    let freshPhase = null;
    let wrapper = null;

    // ---- DOM skeleton ----
    const root = htmlEl("div", "sfs-triplett sfs-figure");
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", TEXT.ariaLabel);
    if (opts.maxWidth) root.style.setProperty("--tr-max-width", opts.maxWidth);

    const phaseButtons = {};
    if (!tutorial) {
      const nav = htmlEl("div", "tr-phases", root);
      core.PHASES.forEach((key) => {
        const button = htmlEl("button", "sfs-button", nav, TEXT.phases[key]);
        button.type = "button";
        button.addEventListener("click", () => setPhase(key));
        phaseButtons[key] = button;
      });
    }

    const status = htmlEl("div", "tr-status", root);
    const lapText = htmlEl("span", "tr-lap", status);
    const clockText = htmlEl("span", "tr-clock", status);

    const stage = htmlEl("div", "tr-stage", root);
    stage.tabIndex = 0;
    stage.setAttribute("aria-label", TEXT.stageLabel);
    const svg = svgEl("svg", { class: "tr-machine", "aria-hidden": "true", focusable: "false" }, stage);

    const overlay = htmlEl("div", "tr-overlay", stage);
    const card = htmlEl("div", "tr-card", overlay);
    const startButton = htmlEl("button", "sfs-button tr-start", card);
    startButton.type = "button";
    const big = htmlEl("div", "tr-big", card);
    const sub = htmlEl("div", "tr-sub", card);
    const againButton = htmlEl("button", "sfs-button tr-again", card);
    setLabel(againButton, TEXT.icons.again, TEXT.again);
    againButton.type = "button";

    const scores = htmlEl("div", "tr-scores", root);
    const scoreTiles = {};
    ["alone", "competition", "difference"].forEach((key) => {
      const tile = htmlEl("div", "tr-score", scores);
      htmlEl("span", "tr-score-label", tile, TEXT.scores[key]);
      const value = htmlEl("span", "tr-score-value", tile, "—");
      scoreTiles[key] = { tile, value };
    });

    const live = htmlEl("div", "visually-hidden sfs-if-fit-ignore", root);
    live.setAttribute("aria-live", "polite");
    const controls = htmlEl("div", "tr-controls", root);
    controls.hidden = true;

    function announce(message) {
      live.textContent = message;
    }

    // ---- Machine drawing ----

    // Everything that depends only on the width and the phase.
    function buildMachine(width) {
      geometry = machineGeometry(width);
      const g = geometry;
      svg.replaceChildren();
      svg.setAttribute("viewBox", `0 0 ${g.width} ${g.height}`);
      svg.setAttribute("width", g.width);
      svg.setAttribute("height", g.height);

      // Frame: each plank is a thick stroke drawn twice, the edge under the
      // fill, so where the two arms merge they read as one Y-shaped piece.
      const frame = svgEl("g", { class: "tr-frame" }, svg);
      const planks = Object.values(g.stations).map((s) => {
        const back = { x: s.reel.x - 18 * s.loop.u.x, y: s.reel.y - 18 * s.loop.u.y };
        const front = { x: s.pulley.x + 12 * s.loop.u.x, y: s.pulley.y + 12 * s.loop.u.y };
        return [back, front];
      });
      [["tr-plank-edge", LOOK.plank + 2.6], ["tr-plank", LOOK.plank]].forEach(([cls, w]) => {
        planks.forEach(([a, b]) => svgEl("line", { class: cls, x1: a.x, y1: a.y, x2: b.x, y2: b.y, "stroke-width": w }, frame));
      });
      const plate = { x: g.pulleyX - 26, y: g.yMid - LOOK.pulleyGap - 15, w: 44, h: 2 * LOOK.pulleyGap + 30 };
      svgEl("rect", { class: "tr-plate", x: plate.x, y: plate.y, width: plate.w, height: plate.h, rx: 2 }, frame);
      [[plate.x + 5, plate.y + 5], [plate.x + plate.w - 5, plate.y + 5], [plate.x + 5, plate.y + plate.h - 5], [plate.x + plate.w - 5, plate.y + plate.h - 5]]
        .forEach(([x, y]) => svgEl("circle", { class: "tr-bolt", cx: x, cy: y, r: 1.6 }, frame));
      Object.values(g.stations).forEach((s) => {
        [0.32, 0.6].forEach((t) => {
          const x = s.reel.x + (s.pulley.x - s.reel.x) * t;
          const y = s.reel.y + (s.pulley.y - s.reel.y) * t;
          svgEl("circle", { class: "tr-bolt", cx: x, cy: y, r: 2 }, frame);
        });
      });
      svgEl("text", { class: "tr-letter", x: plate.x + plate.w / 2, y: plate.y - 7, "text-anchor": "middle" }, frame).textContent = "c.";
      svgEl("text", { class: "tr-caption", x: g.width - 8, y: g.height - 8, "text-anchor": "end" }, frame).textContent = TEXT.caption;

      parts = {};
      ["rival", "you"].forEach((key) => {
        const s = g.stations[key];
        const group = svgEl("g", { class: `tr-station tr-station--${key}` }, svg);
        const cord = svgEl("path", { class: "tr-cord", d: loopPath(s.loop) }, group);
        const finishPoint = pointOnLoop(s.loop, s.startAt);
        svgEl("line", {
          class: "tr-finish",
          x1: finishPoint.x - finishPoint.ox * 5, y1: finishPoint.y - finishPoint.oy * 5,
          x2: finishPoint.x + finishPoint.ox * 5, y2: finishPoint.y + finishPoint.oy * 5
        }, group);
        svgEl("circle", { class: "tr-pulley", cx: s.pulley.x, cy: s.pulley.y, r: LOOK.drum + 1.5 }, group);
        svgEl("circle", { class: "tr-bolt", cx: s.pulley.x, cy: s.pulley.y, r: 1.5 }, group);

        // Hint ring, behind the reel: only on the reader's station.
        let hint = null;
        if (key === "you") {
          hint = svgEl("g", { class: "tr-hint" }, group);
          const spin = svgEl("g", { class: "tr-hint-spin" }, hint);
          spin.style.transformOrigin = `${s.reel.x}px ${s.reel.y}px`;
          const r = LOOK.hintRadius;
          svgEl("circle", { class: "tr-hint-ring", cx: s.reel.x, cy: s.reel.y, r }, spin);
          svgEl("path", {
            class: "tr-hint-arrow",
            d: `M${s.reel.x - 5} ${s.reel.y - r - 5}L${s.reel.x + 5} ${s.reel.y - r}L${s.reel.x - 5} ${s.reel.y - r + 5}Z`
          }, spin);
        }

        svgEl("circle", { class: "tr-flange", cx: s.reel.x, cy: s.reel.y, r: LOOK.flange }, group);
        svgEl("circle", { class: "tr-drum", cx: s.reel.x, cy: s.reel.y, r: LOOK.drum }, group);
        const crank = svgEl("g", { class: "tr-crank" }, group);
        // The handle starts hanging straight down.
        svgEl("line", { class: "tr-crank-arm", x1: s.reel.x, y1: s.reel.y, x2: s.reel.x, y2: s.reel.y + LOOK.crank }, crank);
        svgEl("circle", { class: "tr-knob", cx: s.reel.x, cy: s.reel.y + LOOK.crank, r: LOOK.knob }, crank);

        // Triplett's letters, off the end of each arm.
        svgEl("text", { class: "tr-letter", x: 4, y: s.reel.y + 5 }, group).textContent = key === "you" ? "a." : "b.";

        // Name and lap pips: above the rival's reel, below the reader's.
        const labelY = s.reel.y + s.side * 38;
        svgEl("text", { class: "tr-name", x: 8, y: labelY + 4 }, group).textContent = key === "you" ? TEXT.you : TEXT.rival;
        const pips = [];
        for (let i = 0; i < race.laps; i += 1) {
          pips.push(svgEl("circle", { class: "tr-pip", cx: 50 + i * LOOK.pipGap, cy: labelY, r: LOOK.pipRadius }, group));
        }

        const flag = svgEl("g", { class: "tr-flag-group" }, group);
        const pole = svgEl("line", { class: "tr-flag-pole" }, flag);
        const pennant = svgEl("path", { class: "tr-flag" }, flag);

        parts[key] = { station: s, group, cord, crank, pips, pole, pennant, hint };
      });
      parts.rival.group.classList.toggle("is-idle", phase !== "competition" && phase !== "results");
    }

    function drawFlag(part, progress, laps) {
      const s = part.station;
      const along = s.startAt + (progress * laps % 1) * s.loop.length;
      const p = pointOnLoop(s.loop, progress >= 1 ? s.startAt : along);
      const top = { x: p.x + p.ox * LOOK.flagPole, y: p.y + p.oy * LOOK.flagPole };
      const mid = { x: p.x + p.ox * (LOOK.flagPole - LOOK.flagDepth), y: p.y + p.oy * (LOOK.flagPole - LOOK.flagDepth) };
      const tip = {
        x: p.x + p.ox * (LOOK.flagPole - LOOK.flagDepth / 2) - p.tx * LOOK.flagLength,
        y: p.y + p.oy * (LOOK.flagPole - LOOK.flagDepth / 2) - p.ty * LOOK.flagLength
      };
      part.pole.setAttribute("x1", p.x.toFixed(2));
      part.pole.setAttribute("y1", p.y.toFixed(2));
      part.pole.setAttribute("x2", top.x.toFixed(2));
      part.pole.setAttribute("y2", top.y.toFixed(2));
      part.pennant.setAttribute("d", `M${top.x.toFixed(2)} ${top.y.toFixed(2)}L${tip.x.toFixed(2)} ${tip.y.toFixed(2)}L${mid.x.toFixed(2)} ${mid.y.toFixed(2)}Z`);
      // The cord moves with the flag.
      part.cord.style.strokeDashoffset = String(-(progress * laps * s.loop.length).toFixed(1));
    }

    function drawStation(part, turns, progress, laps) {
      const s = part.station;
      part.crank.setAttribute("transform", `rotate(${((turns * 360) % 360).toFixed(1)} ${s.reel.x} ${s.reel.y})`);
      const done = Math.floor(progress * laps + 1e-9);
      part.pips.forEach((pip, i) => pip.classList.toggle("is-done", i < done));
      drawFlag(part, progress, laps);
    }

    // ---- Per-frame drawing ----

    function draw(now) {
      if (!parts) return;
      const snap = race.snapshot(now);
      const liveRace = snap.status === "countdown" || snap.status === "racing";
      stage.classList.toggle("is-live", liveRace);

      drawStation(parts.you, snap.turns, snap.progress, snap.laps);
      drawStation(parts.rival, snap.rivalTurns, snap.rivalProgress, snap.laps);
      parts.you.hint.classList.toggle("is-on",
        snap.status === "countdown" || (snap.status === "racing" && snap.turns < 1));

      lapText.textContent = phase === "results" ? ""
        : (phase === "practice" ? TEXT.practiceLap : TEXT.lap)(snap.lap, snap.laps);
      clockText.textContent = phase === "practice" || phase === "results" ? "" : TEXT.seconds(snap.elapsedMs / 1000);

      drawOverlay(snap, now);
    }

    function drawOverlay(snap, now) {
      let mode = "hidden";
      if (snap.status === "ready") mode = "ready";
      else if (snap.status === "countdown") mode = "count";
      else if (snap.status === "racing" && now < goUntil) mode = "go";
      else if (snap.status === "finished") mode = "finished";
      if (phase === "results") mode = "results";

      overlay.hidden = mode === "hidden";
      card.classList.toggle("is-bare", mode === "count" || mode === "go");
      startButton.hidden = mode !== "ready";
      againButton.hidden = !((mode === "finished" && !advancing) || mode === "results");
      // On the results step it is the one thing to press, so it looks it.
      againButton.classList.toggle("tr-start", mode === "results");
      big.hidden = mode === "ready" || mode === "results";
      sub.hidden = !(mode === "ready" || mode === "finished");

      if (mode === "ready") {
        setLabel(startButton, TEXT.icons[phase], round ? TEXT.startAgain[phase] : TEXT.start[phase]);
        sub.textContent = coarsePointer ? TEXT.hintTouch : `${TEXT.hintPointer} ${TEXT.hintKeys}`;
        sub.hidden = round;
      } else if (mode === "count") {
        big.textContent = String(snap.countdown);
      } else if (mode === "go") {
        big.textContent = TEXT.go;
      } else if (mode === "finished") {
        if (phase === "practice") {
          big.textContent = TEXT.practiceDone;
          sub.textContent = "";
          sub.hidden = true;
        } else {
          big.textContent = TEXT.seconds(snap.seconds);
          sub.textContent = phase === "competition"
            ? (!snap.won ? TEXT.lost(snap.seconds - snap.rivalSeconds)
              : snap.rivalSeconds === null ? TEXT.winning
              : TEXT.won(snap.rivalSeconds - snap.seconds))
            : TEXT.finished;
        }
      }
    }

    function drawScores() {
      const both = records.alone !== null && records.competition !== null;
      if (phase !== "practice") revealed.add("alone");
      if (phase === "competition" || phase === "results") revealed.add("competition");
      if (both) revealed.add("difference");
      Object.entries(scoreTiles).forEach(([key, { tile }]) => {
        const show = revealed.has(key);
        // Fade in only on a reveal, not on every redraw.
        if (show && tile.hidden && tile.dataset.mounted) tile.classList.add("is-revealing");
        tile.hidden = !show;
        tile.dataset.mounted = "true";
      });
      ["alone", "competition"].forEach((key) => {
        scoreTiles[key].value.textContent = records[key] === null ? "—" : TEXT.seconds(records[key]);
        scoreTiles[key].tile.classList.toggle("is-fresh", freshPhase === key);
      });
      scoreTiles.difference.value.textContent = both ? `${signed(records.competition - records.alone)} s` : "—";
    }

    // ---- Animation loop ----

    function needsFrames(now) {
      const status = race.status;
      if (status === "countdown" || status === "racing") return true;
      if (status === "finished" && race.rival) return race.snapshot(now).rivalProgress < 1;
      return false;
    }

    function frame() {
      frameId = null;
      const now = performance.now();
      const changed = race.tick(now);
      if (changed === "racing") {
        goUntil = now + 500;
        tracker.reset();
        announce(TEXT.announceGo);
      }
      draw(now);
      if (needsFrames(now) || now < goUntil) frameId = requestAnimationFrame(frame);
    }

    function startFrames() {
      if (frameId === null) frameId = requestAnimationFrame(frame);
    }

    // ---- Phases and races ----

    function clearAdvance() {
      if (advanceTimer !== null) clearTimeout(advanceTimer);
      advanceTimer = null;
      advancing = false;
    }

    function setPhase(next, options) {
      options = options || {};
      clearAdvance();
      phase = core.PHASES.includes(next) || next === "results" ? next : "practice";
      advanceStep = Number.isInteger(options.advanceStep) ? options.advanceStep : null;
      round = Boolean(options.round);
      // Results shows the two-flag machine at rest: a competition never run.
      race = core.createRace({
        phase: phase === "results" ? "competition" : phase,
        settings,
        aloneSeconds: records.alone
      });
      tracker.reset();
      activePointer = null;
      goUntil = 0;
      Object.entries(phaseButtons).forEach(([key, button]) => button.setAttribute("aria-pressed", String(key === phase)));
      if (geometry) buildMachine(geometry.width);
      drawScores();
      draw(performance.now());
    }

    function start() {
      const now = performance.now();
      if (!race.arm(now)) return;
      freshPhase = null;
      drawScores();
      tracker.reset();
      stage.focus({ preventScroll: true });
      announce(race.status === "countdown" ? TEXT.announceReady : "");
      draw(now);
      startFrames();
    }

    function finish(now) {
      const snap = race.snapshot(now);
      // Next stays locked through the pause before the tutorial moves on by
      // itself; coming back to this step later finds it unlocked.
      completed.add(phase);
      if (phase === "practice") {
        announce(TEXT.announcePractice);
      } else {
        records[phase] = snap.seconds;
        // A new alone time starts a new round: the difference always pairs
        // an alone race with the competition race that followed it.
        // Its competition race then has to be run before moving on again.
        if (phase === "alone") {
          records.competition = null;
          completed.delete("competition");
        }
        freshPhase = phase;
        drawScores();
        announce(TEXT.announceTime(phase, snap.seconds));
      }
      activePointer = null;
      scheduleAdvance();
      draw(now);
      startFrames();
    }

    // Tutorials advance by step index, so a reader who has already moved
    // on (or back) is never yanked elsewhere. Standalone figures walk the
    // phases in order.
    function scheduleAdvance() {
      const finishedRace = race;
      let go = null;
      if (round) {
        const next = phase === "alone" ? "competition" : "results";
        go = () => { if (race === finishedRace) setPhase(next, { round: next !== "results" }); };
      } else if (tutorial) {
        if (advanceStep === null) return;
        go = () => {
          const controller = wrapper && wrapper.getTutorial();
          if (controller && controller.getStep() === advanceStep && race === finishedRace) controller.next();
        };
      } else {
        const index = core.PHASES.indexOf(phase);
        if (!autoAdvance || index >= core.PHASES.length - 1) return;
        go = () => { if (race === finishedRace) setPhase(core.PHASES[index + 1]); };
      }
      advancing = true;
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        advancing = false;
        go();
      }, settings.advanceDelayMs);
    }

    function wind(turns, now) {
      if (!(turns > 0) || race.status !== "racing") return;
      if (race.addTurns(turns, now)) finish(now);
    }

    // ---- Input ----

    function feed(event) {
      const now = performance.now();
      const events = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
      let turns = 0;
      (events.length ? events : [event]).forEach((e) => {
        turns += tracker.move(e.clientX, e.clientY);
      });
      wind(turns, now);
    }

    function onPointerDown(event) {
      if (event.target.closest && event.target.closest("button")) return;
      const status = race.status;
      if (status !== "countdown" && status !== "racing") return;
      if (event.pointerType === "mouse") return;
      event.preventDefault();
      activePointer = event.pointerId;
      try {
        stage.setPointerCapture(event.pointerId);
      } catch (error) {
        // Capture is a nicety: moves still arrive on window without it.
      }
      tracker.lift();
      feed(event);
    }

    function onPointerMove(event) {
      const status = race.status;
      if (status !== "countdown" && status !== "racing") return;
      if (event.pointerType === "mouse") {
        feed(event);
      } else if (event.pointerId === activePointer) {
        event.preventDefault();
        feed(event);
      }
    }

    function onPointerEnd(event) {
      if (event.pointerId === activePointer) activePointer = null;
      tracker.lift();
    }

    function onKeyDown(event) {
      if (event.target !== stage || phase === "results") return;
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (event.repeat) return;
      if (race.status === "ready") start();
      else wind(settings.keyTurn, performance.now());
    }

    // While racing, a long press must not open a context menu.
    function onContextMenu(event) {
      if (stage.classList.contains("is-live")) event.preventDefault();
    }

    startButton.addEventListener("click", start);
    // After a competition, racing again means another round, as in
    // Triplett's alternating trials: alone first, then the rival.
    againButton.addEventListener("click", () => {
      if (phase === "results") setPhase("alone", { round: true });
      else if (phase === "competition") setPhase("alone");
      else setPhase(phase, { advanceStep });
      startButton.focus({ preventScroll: true });
    });
    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("keydown", onKeyDown);
    stage.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    stage.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse") tracker.lift();
    });

    // The tutorial runtime cancels every running animation on the figure
    // before each step; restart the hint's spin afterwards.
    root.addEventListener("sfs-if:cancel-transitions", () => {
      requestAnimationFrame(() => {
        if (!parts) return;
        const spin = parts.you.hint.querySelector(".tr-hint-spin");
        spin.classList.remove("tr-hint-spin");
        spin.getBoundingClientRect();
        spin.classList.add("tr-hint-spin");
      });
    });

    // A step that advances on finishing also holds the reader there (Next
    // waits) until its race has been run once; Back still works.
    function applyTutorialAction(action, context) {
      if (!action || typeof action !== "object" || !action.phase) return;
      const advance = Boolean(action.advanceOnFinish && context);
      setPhase(action.phase, { advanceStep: advance ? context.index : null });
      if (advance && typeof context.setForwardLocked === "function") {
        context.setForwardLocked(!completed.has(phase));
      }
    }

    // ---- Mount ----

    setPhase(phase);
    buildMachine(LOOK.maxWidth);
    drawScores();
    draw(performance.now());

    root.triplettRace = {
      setPhase,
      start,
      wind: (turns) => wind(turns, performance.now()),
      getRecords: () => Object.assign({}, records),
      getSnapshot: () => race.snapshot(performance.now())
    };

    const api = window.interactiveFigure;
    if (api && typeof api.observeResponsiveLayout === "function") {
      api.observeResponsiveLayout({
        root,
        minimumWidth: LOOK.minWidth,
        maximumWidth: LOOK.maxWidth,
        widthStep: 10,
        onLayout(layout) {
          if (geometry && geometry.width === layout.width) return;
          buildMachine(layout.width);
          draw(performance.now());
        }
      });
    }

    if (api && tutorial) {
      wrapper = api.wrap({
        root,
        controls,
        label: "race controls",
        placement: "callout",
        applyAction: applyTutorialAction,
        startOpen: false
      });
    }

    if (api && typeof api.adopt === "function") {
      api.adopt(root, {
        cancelMotion() {},
        dispose() {
          clearAdvance();
          if (frameId !== null) cancelAnimationFrame(frameId);
          frameId = null;
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerEnd);
          window.removeEventListener("pointercancel", onPointerEnd);
        }
      });
    }

    return root;
  };
})();
