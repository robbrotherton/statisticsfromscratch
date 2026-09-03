// Chapter 6 opener: a schematic Settlers of Catan board.
//
// The board is a teaching object, not a reproduction. Nineteen pointy-top
// hexes in rows of 3/4/5/4/3 carry the standard number tokens (numeral plus
// the game's own probability pips, 6 and 8 in red), and every intersection
// where hexes meet is a place a reader can put a settlement. The same
// factory serves two jobs in the chapter:
//
//   "choose" — plain markers, no probabilities anywhere, reader picks one.
//   "rated"  — every intersection filled from a blue (barren) to green
//              (productive) ramp encoding the chance that a roll pays that
//              corner anything, either from counting (theory) or from rolls
//              actually made (empirical, fed live by the dice roller).
//
// The chapter asks exactly one question of this board — where is a roll most
// likely to pay you something — so the ramp encodes exactly one quantity.
// Vertex ids are 1..54 assigned by sorting on y then x, which the chapter
// and the tutorial both reference, so that ordering is a contract, not an
// implementation detail.
(function (global) {
  "use strict";

  const STYLE_ID = "sfs-catan-board-styles";
  const SQRT3 = Math.sqrt(3);
  const ROW_SIZES = [3, 4, 5, 4, 3];
  const VERTEX_COUNT = 54;
  const SELECTION_EVENT = "sfs-catan:selection";

  const DEFAULT_NUMBERS = [
    2, 5, 11,
    10, 6, 9, 10,
    6, 12, null, 3, 8,
    5, 3, 11, 4,
    9, 4, 8
  ];

  const DEFAULT_RESOURCES = [
    "wood", "grain", "brick",
    "brick", "wood", "brick", "grain",
    "grain", "wood", "desert", "grain", "wood",
    "grain", "brick", "wood", "brick",
    "wood", "brick", "grain"
  ];

  const TERRAINS = ["wood", "grain", "brick", "desert"];

  // ---------------------------------------------------------------- styles

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .catan-board {
        --sfs-figure-max-width: var(--cb-max-width, min(32rem, 100%));

        /* Muted, flat terrain. Every fill is mixed toward the page
           background, so one set of hues works in both themes: on white the
           mix lightens, on the dark theme it darkens, and the number tokens
           and house glyphs keep their contrast either way. */
        --cb-wood: #6f8f4f;
        --cb-grain: #d0a41d;
        --cb-brick: #b4644a;
        --cb-desert: #c0ad83;
        --cb-terrain-strength: 62%;
        --cb-terrain-filter: none;
        --cb-outline: color-mix(in srgb, #40667d 55%, var(--sfs-bg));

        --cb-token-face: color-mix(in srgb, #f8f1de 88%, var(--sfs-bg));
        --cb-token-edge: color-mix(in srgb, #8a7c5c 60%, var(--sfs-bg));
        --cb-token-ink: #23201a;
        --cb-token-hot: #b3261e;

        /* Favourability ramp: blue for the barren corners, green for the
           productive ones, through a teal middle so the two ends stay far
           apart. Every stop is mixed toward the page background, so the low
           end recedes and the high end advances in either theme. */
        --cb-ramp-blue: #2f7fbf;
        --cb-ramp-teal: #1f95a8;
        --cb-ramp-green: #0f9e5a;
        --cb-ramp-low: color-mix(in srgb, var(--cb-ramp-blue) 44%, var(--sfs-bg));
        --cb-ramp-mid: color-mix(in srgb, var(--cb-ramp-teal) 82%, var(--sfs-bg));
        --cb-ramp-high: var(--cb-ramp-green);

        --cb-house-quiet: color-mix(in srgb, var(--sfs-text) 20%, var(--sfs-bg));
        --cb-house-edge: color-mix(in srgb, var(--sfs-text) 55%, var(--sfs-bg));
        --cb-mark: var(--sfs-if-step-accent, var(--sfs-accent));
        /* The accent alone is a mid-blue in the dark theme and sinks into a
           dark terrain hex; pulling it toward the text colour keeps the
           reader's own settlement the loudest thing on either board. */
        --cb-selected: color-mix(in srgb, var(--cb-mark) 68%, var(--sfs-text));
        --cb-number-size: var(--sfs-figure-label-size);
        --cb-duration: 460ms;
      }

      .catan-board[data-sfs-layout="compact"] {
        /* The number tokens are the one dense in-plot annotation layer here,
           and they are the layer the tutorial runtime allows to step
           down on a narrow layout. Everything else holds its token size. */
        --cb-number-size: var(--sfs-figure-micro-size);
      }

      /* With the ramp on, terrain must stop competing with it: the hexes drop
         most of their saturation and most of their contrast with the page. */
      .catan-board[data-cb-rated="true"] {
        --cb-terrain-strength: 34%;
        --cb-terrain-filter: saturate(0.55);
      }

      .catan-board .cb-chart-wrap {
        position: relative;
      }

      .catan-board .cb-svg {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
      }

      .catan-board .cb-hex-layer {
        filter: var(--cb-terrain-filter);
        transition: filter var(--cb-duration) ease;
      }

      .catan-board .cb-hex {
        stroke: var(--sfs-bg);
        stroke-width: 1.5;
        stroke-linejoin: round;
        transition: fill var(--cb-duration) ease;
      }

      .catan-board .cb-hex[data-terrain="wood"] {
        fill: color-mix(in srgb, var(--cb-wood) var(--cb-terrain-strength), var(--sfs-bg));
      }

      .catan-board .cb-hex[data-terrain="grain"] {
        fill: color-mix(in srgb, var(--cb-grain) var(--cb-terrain-strength), var(--sfs-bg));
      }

      .catan-board .cb-hex[data-terrain="brick"] {
        fill: color-mix(in srgb, var(--cb-brick) var(--cb-terrain-strength), var(--sfs-bg));
      }

      .catan-board .cb-hex[data-terrain="desert"] {
        fill: color-mix(in srgb, var(--cb-desert) var(--cb-terrain-strength), var(--sfs-bg));
      }

      .catan-board .cb-outline {
        fill: none;
        stroke: var(--cb-outline);
        stroke-width: 2.5;
        stroke-linejoin: round;
      }

      .catan-board .cb-token-face {
        fill: var(--cb-token-face);
        stroke: var(--cb-token-edge);
        stroke-width: 1;
      }

      .catan-board .cb-token-number {
        font-size: var(--cb-number-size);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        text-anchor: middle;
        dominant-baseline: central;
        fill: var(--cb-token-ink);
      }

      .catan-board .cb-token-pip {
        fill: var(--cb-token-ink);
      }

      .catan-board .cb-token[data-hot="true"] .cb-token-number,
      .catan-board .cb-token[data-hot="true"] .cb-token-pip {
        fill: var(--cb-token-hot);
      }

      .catan-board .cb-vertex {
        cursor: default;
        outline: none;
      }

      .catan-board[data-cb-selectable="true"] .cb-vertex {
        cursor: pointer;
      }

      .catan-board .cb-hit {
        fill: transparent;
        stroke: none;
      }

      .catan-board .cb-glyph {
        stroke: var(--sfs-bg);
        stroke-width: 0.9;
        stroke-linejoin: round;
        fill: var(--cb-house-quiet);
        transition:
          fill var(--cb-duration) ease,
          transform var(--cb-duration) cubic-bezier(0.22, 0.61, 0.36, 1);
      }

      /* Nothing has been built yet, so the opening board shows no houses at
         all: an empty board reads as hexes and numbers, which is what the
         reader is being asked to think about. A house appears under the
         pointer or under keyboard focus, and stays once a corner is chosen.
         The hit targets are always live; only the glyph is hidden. */
      .catan-board[data-cb-mode="choose"] .cb-vertex .cb-glyph {
        fill: color-mix(in srgb, var(--cb-mark) 45%, var(--sfs-bg));
        stroke: var(--sfs-bg);
        stroke-width: 1;
        opacity: 0;
        transition:
          opacity var(--cb-duration) ease,
          fill var(--cb-duration) ease,
          transform var(--cb-duration) cubic-bezier(0.22, 0.61, 0.36, 1);
      }

      .catan-board[data-cb-mode="choose"] .cb-vertex[data-hover="true"] .cb-glyph,
      .catan-board[data-cb-mode="choose"] .cb-vertex:focus-visible .cb-glyph {
        opacity: 0.75;
      }

      /* Last, so that hovering your own settlement does not repaint it as a
         merely-possible one. */
      .catan-board .cb-vertex[data-selected="true"] .cb-glyph,
      .catan-board[data-cb-mode="choose"] .cb-vertex[data-selected="true"] .cb-glyph {
        fill: var(--cb-selected);
        stroke: var(--sfs-bg);
        stroke-width: 1.4;
        opacity: 1;
      }

      .catan-board .cb-focus-ring {
        fill: none;
        stroke: var(--sfs-focus, var(--sfs-accent));
        stroke-width: 2;
        opacity: 0;
        transition: opacity 140ms ease;
      }

      /* In choose mode the appearing house is the hover feedback, so a ring
         as well would be saying it twice. Rated mode already shows every
         house, so there the ring is the only thing hover can say. */
      .catan-board .cb-vertex:focus-visible .cb-focus-ring,
      .catan-board[data-cb-mode="rated"] .cb-vertex[data-hover="true"] .cb-focus-ring {
        opacity: 1;
      }

      .catan-board .cb-mark {
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--cb-duration) ease;
      }

      .catan-board .cb-mark[data-active="true"] {
        opacity: 1;
      }

      .catan-board .cb-ring {
        fill: none;
        stroke: var(--cb-mark);
        stroke-width: 2.25;
      }

      .catan-board .cb-leader {
        stroke: var(--cb-mark);
        stroke-width: 1.25;
      }

      .catan-board .cb-mark-text {
        font-size: var(--sfs-figure-small-size);
        font-weight: 600;
        fill: var(--cb-mark);
        paint-order: stroke fill;
        stroke: var(--sfs-bg);
        stroke-width: 3.5;
        stroke-linejoin: round;
      }

      .catan-board .cb-legend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0.25rem 0.5rem;
        margin: 0.55rem 0 0.15rem;
        color: var(--sfs-muted);
        font-size: var(--sfs-figure-note-size);
        line-height: 1.3;
      }

      .catan-board .cb-legend[hidden] {
        display: none;
      }

      .catan-board .cb-legend-caption {
        flex: 1 1 100%;
        text-align: center;
      }

      .catan-board .cb-legend-scale {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        min-width: 0;
      }

      .catan-board .cb-legend-bar {
        display: block;
        width: clamp(5rem, 34vw, 9rem);
        height: 0.5rem;
        border-radius: 999px;
        border: 1px solid var(--sfs-border);
        background: linear-gradient(
          to right,
          var(--cb-ramp-low),
          var(--cb-ramp-mid),
          var(--cb-ramp-high)
        );
      }

      .catan-board .cb-legend-end {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .catan-board .cb-readout {
        min-height: 2.9rem;
        margin-top: 0.35rem;
        font-size: var(--sfs-figure-note-size);
      }

      .catan-board .cb-readout-detail {
        color: var(--sfs-muted);
      }

      .catan-board .cb-readout-strong {
        color: var(--sfs-text);
        font-weight: 700;
      }

      /* Collapsed state for a board a tutorial reveals later. Height and
         block margins go to zero so nothing is reserved in the callout, but
         the element stays in flow at full width, so the chart wrap keeps
         reporting a real width and the board is laid out and subscribed
         before the reader ever sees it. */
      .catan-board[data-cb-hidden="true"] {
        height: 0;
        margin-block: 0;
        overflow: hidden;
        opacity: 0;
      }

      /* Scoped to descendants on purpose. The reveal is an inline transition
         on the root itself, and an !important rule here would out-rank it and
         snap the collapse open the moment a data repaint arrived mid-reveal. */
      .catan-board[data-cb-motion="off"] * {
        transition: none !important;
      }

      @media (prefers-reduced-motion: reduce) {
        .catan-board * {
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ----------------------------------------------------------- board maths

  // Two dice: 6 - |n - 7| of the 36 ordered outcomes make the sum n.
  function waysToRoll(sum) {
    const n = Number(sum);
    if (!Number.isFinite(n)) return 0;
    const ways = 6 - Math.abs(n - 7);
    return ways > 0 ? ways : 0;
  }

  // Merging hex corners means comparing floats. Round to 3dp and normalise
  // negative zero: "-0" and "0" stringify differently and would split four
  // shared corners into eight, leaving 58 vertices instead of 54.
  function coordinateKey(value) {
    const scaled = Math.round(value * 1000);
    return scaled === 0 ? 0 : scaled;
  }

  function normalizeNumbers(value) {
    const source = Array.isArray(value) && value.length === DEFAULT_NUMBERS.length
      ? value
      : DEFAULT_NUMBERS;
    return source.map(function (entry) {
      if (entry === null || entry === undefined || entry === "") return null;
      const n = Number(entry);
      return Number.isFinite(n) ? n : null;
    });
  }

  function normalizeResources(value) {
    const source = Array.isArray(value) && value.length === DEFAULT_RESOURCES.length
      ? value
      : DEFAULT_RESOURCES;
    return source.map(function (entry) {
      const name = String(entry || "").toLowerCase();
      return TERRAINS.indexOf(name) === -1 ? "desert" : name;
    });
  }

  // Pointy-top hexes of unit radius. Row r sits at cy = (r - 2) * 1.5; the
  // hex at column c of a row of n sits at cx = (c - (n - 1) / 2) * sqrt(3).
  // Corners are at 90 + 60k degrees, so every hex has a corner straight up
  // and straight down and the rows interlock.
  function buildBoard(numbersInput, resourcesInput) {
    const numbers = normalizeNumbers(numbersInput);
    const resources = normalizeResources(resourcesInput);

    const hexes = [];
    let index = 0;
    ROW_SIZES.forEach(function (size, row) {
      for (let col = 0; col < size; col += 1) {
        hexes.push({
          index: index,
          row: row,
          col: col,
          cx: (col - (size - 1) / 2) * SQRT3,
          cy: (row - 2) * 1.5,
          number: numbers[index],
          resource: resources[index],
          corners: []
        });
        index += 1;
      }
    });

    const byKey = new Map();
    const vertices = [];
    hexes.forEach(function (hex) {
      for (let k = 0; k < 6; k += 1) {
        const angle = ((90 + 60 * k) * Math.PI) / 180;
        const kx = coordinateKey(hex.cx + Math.cos(angle));
        const ky = coordinateKey(hex.cy + Math.sin(angle));
        const key = kx + "," + ky;
        let vertex = byKey.get(key);
        if (!vertex) {
          vertex = { x: kx / 1000, y: ky / 1000, hexes: [] };
          byKey.set(key, vertex);
          vertices.push(vertex);
        }
        if (vertex.hexes.indexOf(hex.index) === -1) vertex.hexes.push(hex.index);
        hex.corners.push(vertex);
      }
    });

    // The chapter and the tutorial actions name corners by id, so this sort
    // is part of the contract: top row first, left to right within a row.
    vertices.sort(function (a, b) {
      return (a.y - b.y) || (a.x - b.x);
    });

    vertices.forEach(function (vertex, position) {
      vertex.id = position + 1;
      vertex.hexes.sort(function (a, b) { return a - b; });
      vertex.numbers = vertex.hexes
        .map(function (i) { return hexes[i].number; })
        .filter(function (n) { return n !== null; })
        .sort(function (a, b) { return a - b; });
      vertex.distinctNumbers = vertex.numbers.filter(function (n, i, all) {
        return all.indexOf(n) === i;
      });
      vertex.touchesDesert = vertex.hexes.some(function (i) {
        return hexes[i].number === null;
      });
      // P(any production) counts each adjacent number once; expected cards
      // counts every adjacent numbered hex, so a corner on two 8s collects
      // twice whenever an 8 comes up but still only produces on one sum.
      vertex.chanceWays = vertex.distinctNumbers.reduce(function (total, n) {
        return total + waysToRoll(n);
      }, 0);
      vertex.yieldWays = vertex.numbers.reduce(function (total, n) {
        return total + waysToRoll(n);
      }, 0);
    });

    return {
      hexes: hexes,
      vertices: vertices,
      byId: new Map(vertices.map(function (v) { return [v.id, v]; })),
      outline: buildOutline(hexes)
    };
  }

  // Edges belonging to exactly one hex form the board's silhouette; chain
  // them into a single closed ring so the coastline can be stroked as one
  // path rather than nineteen overlapping outlines.
  function buildOutline(hexes) {
    const edges = new Map();
    hexes.forEach(function (hex) {
      for (let k = 0; k < 6; k += 1) {
        const a = hex.corners[k];
        const b = hex.corners[(k + 1) % 6];
        const key = a.id < b.id ? a.id + ":" + b.id : b.id + ":" + a.id;
        const existing = edges.get(key);
        if (existing) existing.count += 1;
        else edges.set(key, { count: 1, a: a, b: b });
      }
    });

    const adjacency = new Map();
    const nodes = new Map();
    edges.forEach(function (edge) {
      if (edge.count !== 1) return;
      nodes.set(edge.a.id, edge.a);
      nodes.set(edge.b.id, edge.b);
      if (!adjacency.has(edge.a.id)) adjacency.set(edge.a.id, []);
      if (!adjacency.has(edge.b.id)) adjacency.set(edge.b.id, []);
      adjacency.get(edge.a.id).push(edge.b.id);
      adjacency.get(edge.b.id).push(edge.a.id);
    });

    if (!adjacency.size) return [];

    const startId = Math.min.apply(null, Array.from(adjacency.keys()));
    const ring = [nodes.get(startId)];
    const seen = new Set([startId]);
    let currentId = startId;
    while (ring.length < adjacency.size) {
      const next = (adjacency.get(currentId) || []).find(function (id) {
        return !seen.has(id);
      });
      if (next === undefined) break;
      seen.add(next);
      ring.push(nodes.get(next));
      currentId = next;
    }
    return ring;
  }

  // One rating entry per vertex under the requested source of truth.
  function rateBoard(board, options) {
    options = options || {};
    const empirical = options.rating === "empirical";
    const counts = Array.isArray(options.counts) ? options.counts : [];
    const rolls = Math.max(0, Number(options.rolls) || 0);

    return board.vertices.map(function (vertex) {
      if (!empirical) {
        return {
          id: vertex.id,
          chance: vertex.chanceWays / 36,
          yield: vertex.yieldWays / 36,
          chanceCount: null,
          yieldCount: null
        };
      }
      const chanceCount = vertex.distinctNumbers.reduce(function (total, n) {
        return total + (Number(counts[n]) || 0);
      }, 0);
      const yieldCount = vertex.numbers.reduce(function (total, n) {
        return total + (Number(counts[n]) || 0);
      }, 0);
      return {
        id: vertex.id,
        chance: rolls ? chanceCount / rolls : 0,
        yield: rolls ? yieldCount / rolls : 0,
        chanceCount: chanceCount,
        yieldCount: yieldCount
      };
    });
  }

  function bestBy(ratings, key) {
    let best = null;
    ratings.forEach(function (entry) {
      if (!best || entry[key] > best[key] ||
        (entry[key] === best[key] && entry.id < best.id)) {
        best = entry;
      }
    });
    return best;
  }

  // ------------------------------------------------------------- utilities

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function has(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function motionAllows(requested) {
    const runtime = global.interactiveRuntime;
    if (runtime && runtime.motion && typeof runtime.motion.shouldAnimate === "function") {
      return runtime.motion.shouldAnimate(requested);
    }
    return requested !== false && !(global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function listPhrase(items) {
    if (!items.length) return "no hexes";
    if (items.length === 1) return String(items[0]);
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  function describeVertex(vertex) {
    if (!vertex) return "";
    const parts = vertex.numbers.map(String);
    if (vertex.touchesDesert) parts.push("the desert");
    return "corner touching " + listPhrase(parts);
  }

  function sentenceCase(text) {
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "—";
    const percent = value * 100;
    return (percent >= 10 ? Math.round(percent) : Math.round(percent * 10) / 10) + "%";
  }

  function readRemembered(key) {
    if (!key) return null;
    try {
      const raw = global.sessionStorage.getItem(key);
      const id = Number(raw);
      return Number.isInteger(id) && id >= 1 && id <= VERTEX_COUNT ? id : null;
    } catch (error) {
      return null;
    }
  }

  function writeRemembered(key, id) {
    if (!key) return;
    try {
      if (id === null || id === undefined) global.sessionStorage.removeItem(key);
      else global.sessionStorage.setItem(key, String(id));
    } catch (error) {
      // Private browsing and storage-blocked contexts are not an error here:
      // the board simply loses the cross-figure memory.
    }
  }

  function normalizeHighlight(value) {
    if (value === null || value === undefined || value === false) return [];
    const list = Array.isArray(value) ? value : [value];
    const out = [];
    list.forEach(function (entry) {
      if (entry === null || entry === undefined || entry === "" || entry === "none") return;
      if (entry === "best-chance" || entry === "reader") {
        if (out.indexOf(entry) === -1) out.push(entry);
        return;
      }
      const id = Number(entry);
      if (Number.isInteger(id) && id >= 1 && id <= VERTEX_COUNT && out.indexOf(id) === -1) {
        out.push(id);
      }
    });
    return out;
  }

  // The board never claims a tutorial footer of its own: in the chapter it is
  // the second figure in a callout the dice roller already claimed. It hears
  // that figure's actions instead, through the shared helper when it exists
  // and through the same bubbling event when it does not.
  function observeTutorialActions(rootNode, handler) {
    const api = global.interactiveFigure;
    if (api && typeof api.observeTutorialActions === "function") {
      let unsubscribe = null;
      let cancelled = false;
      let attempts = 0;
      const connect = function () {
        if (cancelled) return;
        attempts += 1;
        if (!rootNode.isConnected) {
          if (attempts < 120) global.requestAnimationFrame(connect);
          return;
        }
        unsubscribe = api.observeTutorialActions(rootNode, handler);
      };
      global.requestAnimationFrame(connect);
      return function () {
        cancelled = true;
        if (typeof unsubscribe === "function") unsubscribe();
        unsubscribe = null;
      };
    }

    // Fallback: the event bubbles from the claiming figure's root all the way
    // to the document, so listening there and matching callouts at dispatch
    // time avoids any dependence on mount order.
    const listener = function (event) {
      const callout = rootNode.closest(".callout");
      if (!callout) return;
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest(".callout") !== callout) return;
      const detail = event.detail || {};
      if (!detail.action) return;
      handler(detail.action, detail);
    };
    document.addEventListener("sfs-if:tutorial-step-action", listener);
    return function () {
      document.removeEventListener("sfs-if:tutorial-step-action", listener);
    };
  }

  // ------------------------------------------------------------- the figure

  global.makeCatanBoard = function (opts) {
    opts = opts || {};
    const api = global.interactiveFigure;
    if (api && typeof api.ensureStyles === "function") api.ensureStyles();
    ensureStyles();

    const board = buildBoard(opts.numbers, opts.resources);
    const rememberKey = typeof opts.remember === "string" && opts.remember
      ? opts.remember
      : null;

    const state = {
      mode: opts.mode === "rated" ? "rated" : "choose",
      rating: opts.rating === "empirical" ? "empirical" : "theory",
      marker: opts.marker === "dot" ? "dot" : "house",
      // Multiplies the house glyph in either mode. 1 is the tuned default;
      // raise it from the shortcode if the houses want more presence.
      houseScale: Math.min(Math.max(finiteNumber(opts.houseScale, 1), 0.25), 3),
      selectable: opts.selectable === undefined
        ? (opts.mode === "rated" ? false : true)
        : opts.selectable !== false,
      selection: null,
      readerSelection: rememberKey ? readRemembered(rememberKey) : null,
      focus: null,
      highlight: normalizeHighlight(opts.highlight),
      showLegend: opts.showLegend === undefined
        ? (opts.mode === "rated")
        : opts.showLegend !== false,
      showBoard: opts.showBoard !== false,
      counts: Array.isArray(opts.counts) ? opts.counts.slice() : [],
      rolls: Math.max(0, Number(opts.rolls) || 0)
    };

    if (opts.selection !== undefined && opts.selection !== null) {
      const initial = Number(opts.selection);
      if (Number.isInteger(initial) && initial >= 1 && initial <= VERTEX_COUNT) {
        state.selection = initial;
      }
    } else if (state.readerSelection !== null) {
      state.selection = state.readerSelection;
    }

    const root = d3.create("div")
      .attr("class", "catan-board sfs-figure")
      .style("--cb-max-width", opts.maxWidth || null);
    const rootNode = root.node();
    rootNode.dataset.cbHidden = state.showBoard ? "false" : "true";

    const chartWrap = root.append("div")
      .attr("class", "cb-chart-wrap sfs-chart-wrap");

    const svg = chartWrap.append("svg")
      .attr("class", "cb-svg sfs-svg")
      .attr("role", "group")
      .attr("preserveAspectRatio", "xMidYMid meet");

    const svgTitle = svg.append("title");
    const boardGroup = svg.append("g").attr("class", "cb-board");
    const hexLayer = boardGroup.append("g").attr("class", "cb-hex-layer");
    const outlinePath = boardGroup.append("path").attr("class", "cb-outline");
    const tokenLayer = boardGroup.append("g").attr("class", "cb-token-layer");
    const vertexLayer = boardGroup.append("g")
      .attr("class", "cb-vertex-layer")
      .attr("role", "group");
    // Rings and their labels sit above the houses: a ring is an open stroke,
    // so it reads as an annotation on the glyph rather than covering it, and
    // a label half-hidden behind a settlement would be worse than useless.
    const markLayer = boardGroup.append("g").attr("class", "cb-mark-layer");

    // A hidden probe lets the module honour --sfs-figure-* type sizes without
    // ever writing a px font-size: the token circles are sized from whatever
    // the stylesheet resolves the numeral to at this layout.
    const probe = svg.append("text")
      .attr("class", "cb-token-number")
      .attr("aria-hidden", "true")
      .style("visibility", "hidden")
      .attr("x", -9999)
      .attr("y", -9999)
      .text("8");

    const markProbe = svg.append("text")
      .attr("class", "cb-mark-text")
      .attr("aria-hidden", "true")
      .style("visibility", "hidden")
      .attr("x", -9999)
      .attr("y", -9999)
      .text("8");

    const legend = root.append("div").attr("class", "cb-legend");
    const legendCaption = legend.append("div").attr("class", "cb-legend-caption");
    const legendScale = legend.append("div").attr("class", "cb-legend-scale");
    const legendLow = legendScale.append("span").attr("class", "cb-legend-end");
    legendScale.append("span").attr("class", "cb-legend-bar").attr("aria-hidden", "true");
    const legendHigh = legendScale.append("span").attr("class", "cb-legend-end");

    const readout = root.append("div")
      .attr("class", "sfs-readout cb-readout")
      .attr("aria-live", "polite");
    const readoutPrimary = readout.append("div").attr("class", "sfs-readout-row");
    const readoutPrimaryLabel = readoutPrimary.append("span").attr("class", "sfs-readout-label");
    const readoutPrimaryValue = readoutPrimary.append("span").attr("class", "sfs-readout-value");
    const readoutSecondary = readout.append("div").attr("class", "sfs-readout-row");
    const readoutSecondaryLabel = readoutSecondary.append("span").attr("class", "sfs-readout-label");
    const readoutSecondaryValue = readoutSecondary.append("span").attr("class", "sfs-readout-value");

    const MARK_SLOTS = [
      { kind: "reader", label: "your pick", direction: [1, -1] },
      { kind: "best-chance", label: "best chance", direction: [-1, -1] },
      { kind: "custom-0", label: "", direction: [0, -1] },
      { kind: "custom-1", label: "", direction: [0, 1] },
      { kind: "custom-2", label: "", direction: [-1, 1] }
    ];

    const markSlots = MARK_SLOTS.map(function (slot) {
      const group = markLayer.append("g")
        .attr("class", "cb-mark")
        .attr("data-kind", slot.kind)
        .attr("data-active", "false")
        .attr("aria-hidden", "true");
      return {
        config: slot,
        group: group,
        ring: group.append("circle").attr("class", "cb-ring"),
        leader: group.append("line").attr("class", "cb-leader"),
        text: group.append("text").attr("class", "cb-mark-text")
      };
    });

    let geometry = null;
    let vertexSelection = null;
    let hoverId = null;
    let focusedId = null;
    let disposed = false;
    let repaintFrame = null;
    let revealCleanup = null;
    let layoutController = null;
    let unsubscribeTutorial = null;
    let unsubscribeMotion = null;
    let sourceCleanup = null;

    // ------------------------------------------------------------ geometry

    function measureFontSize(node, fallback) {
      try {
        const size = parseFloat(global.getComputedStyle(node).fontSize);
        return Number.isFinite(size) && size > 0 ? size : fallback;
      } catch (error) {
        return fallback;
      }
    }

    function computeGeometry(width) {
      const numeralSize = measureFontSize(probe.node(), 14);
      const markSize = measureFontSize(markProbe.node(), 12);
      const padX = Math.max(10, numeralSize * 0.9);
      const padY = Math.max(12, numeralSize * 1.0);
      // The silhouette spans 5*sqrt(3) wide (the five-hex middle row plus a
      // half hex either side) and 8 tall, in units of the hex radius.
      const radius = Math.max(12, (width - padX * 2) / (5 * SQRT3));
      const height = radius * 8 + padY * 2;
      const tokenRadius = Math.min(
        Math.max(numeralSize * 1.28, radius * 0.22),
        radius * 0.44
      );
      // A rated board shows every house at once, so its glyphs have to stay
      // small enough not to round the hexes off into octagons. A choose board
      // shows one house at a time -- under the pointer, or where the reader
      // built -- so it can afford a much bigger one, and wants it: the house
      // is the whole feedback. `houseScale` tunes both from the shortcode.
      const glyphScale = (state.mode === "rated" ? 0.235 : 0.3) * state.houseScale;
      const glyphSize = Math.min(Math.max(radius * glyphScale, 6.5), radius * 0.42);
      return {
        width: width,
        height: height,
        radius: radius,
        centerX: width / 2,
        centerY: padY + radius * 4,
        numeralSize: numeralSize,
        markSize: markSize,
        tokenRadius: tokenRadius,
        glyphSize: glyphSize,
        // Never smaller than the house it has to catch.
        hitRadius: Math.max(15, radius * 0.3, glyphSize * 1.15),
        ringRadius: Math.max(glyphSize * 1.75, glyphSize + 7)
      };
    }

    function projectX(unitX) {
      return geometry.centerX + unitX * geometry.radius;
    }

    function projectY(unitY) {
      return geometry.centerY + unitY * geometry.radius;
    }

    function hexPath(hex) {
      return hex.corners.map(function (corner, i) {
        return (i ? "L" : "M") + projectX(corner.x).toFixed(2) + "," +
          projectY(corner.y).toFixed(2);
      }).join(" ") + " Z";
    }

    function outlinePathData() {
      if (!board.outline.length) return "";
      return board.outline.map(function (vertex, i) {
        return (i ? "L" : "M") + projectX(vertex.x).toFixed(2) + "," +
          projectY(vertex.y).toFixed(2);
      }).join(" ") + " Z";
    }

    function glyphPath(size) {
      if (state.marker === "dot") {
        const r = size * 0.85;
        return "M " + (-r) + ",0 a " + r + "," + r + " 0 1,0 " + (2 * r) +
          ",0 a " + r + "," + r + " 0 1,0 " + (-2 * r) + ",0 Z";
      }
      const s = size;
      return "M " + (-s) + "," + (s * 0.7) +
        " L " + (-s) + "," + (-s * 0.15) +
        " L 0," + (-s * 0.98) +
        " L " + s + "," + (-s * 0.15) +
        " L " + s + "," + (s * 0.7) + " Z";
    }

    // ---------------------------------------------------------- rendering

    function drawStatic() {
      svg
        .attr("viewBox", "0 0 " + geometry.width + " " + geometry.height)
        .attr("width", geometry.width)
        .attr("height", geometry.height);

      hexLayer.selectAll("path.cb-hex")
        .data(board.hexes, function (d) { return d.index; })
        .join("path")
        .attr("class", "cb-hex")
        .attr("data-terrain", function (d) { return d.resource; })
        .attr("d", hexPath);

      outlinePath.attr("d", outlinePathData());

      const numbered = board.hexes.filter(function (hex) { return hex.number !== null; });
      const tokens = tokenLayer.selectAll("g.cb-token")
        .data(numbered, function (d) { return d.index; })
        .join(function (enter) {
          const group = enter.append("g").attr("class", "cb-token");
          group.append("circle").attr("class", "cb-token-face");
          group.append("text").attr("class", "cb-token-number");
          group.append("g").attr("class", "cb-token-pips");
          return group;
        })
        .attr("data-hot", function (d) { return d.number === 6 || d.number === 8 ? "true" : "false"; })
        .attr("transform", function (d) {
          return "translate(" + projectX(d.cx).toFixed(2) + "," + projectY(d.cy).toFixed(2) + ")";
        });

      const tokenRadius = geometry.tokenRadius;
      tokens.select("circle.cb-token-face").attr("r", tokenRadius);
      tokens.select("text.cb-token-number")
        .attr("y", -tokenRadius * 0.14)
        .text(function (d) { return String(d.number); });

      // The pips are the game's own encoding of exactly what this chapter is
      // about: one dot for each of the 36 ordered outcomes that make the sum.
      const pipRadius = Math.max(0.9, tokenRadius * 0.078);
      const pipGap = tokenRadius * 0.2;
      tokens.select("g.cb-token-pips").each(function (d) {
        const ways = waysToRoll(d.number);
        const offset = ((ways - 1) * pipGap) / 2;
        d3.select(this).selectAll("circle.cb-token-pip")
          .data(d3.range(ways))
          .join("circle")
          .attr("class", "cb-token-pip")
          .attr("r", pipRadius)
          .attr("cx", function (i) { return i * pipGap - offset; })
          .attr("cy", tokenRadius * 0.55);
      });

      vertexSelection = vertexLayer.selectAll("g.cb-vertex")
        .data(board.vertices, function (d) { return d.id; })
        .join(function (enter) {
          const group = enter.append("g")
            .attr("class", "cb-vertex")
            .attr("role", "button");
          group.append("circle").attr("class", "cb-hit");
          group.append("circle").attr("class", "cb-focus-ring");
          group.append("path").attr("class", "cb-glyph");
          group
            .on("click", function (event, d) { handleActivate(d); })
            .on("mouseenter", function (event, d) { setHover(d.id); })
            .on("mouseleave", function () { setHover(null); })
            .on("focus", function (event, d) { setFocus(d.id); })
            .on("blur", function () { setFocus(null); })
            .on("keydown", function (event, d) { handleKeyDown(event, d); });
          return group;
        })
        .attr("data-vertex", function (d) { return d.id; })
        .attr("transform", function (d) {
          return "translate(" + projectX(d.x).toFixed(2) + "," + projectY(d.y).toFixed(2) + ")";
        });

      vertexSelection.select("circle.cb-hit").attr("r", geometry.hitRadius);
      vertexSelection.select("circle.cb-focus-ring").attr("r", geometry.glyphSize * 1.6);
      vertexSelection.select("path.cb-glyph").attr("d", glyphPath(geometry.glyphSize));

      markSlots.forEach(function (slot) {
        slot.ring.attr("r", geometry.ringRadius);
      });
    }

    // --------------------------------------------------------------- state

    function ratings() {
      return rateBoard(board, {
        rating: state.rating,
        counts: state.counts,
        rolls: state.rolls
      });
    }

    function ratingKey() {
      return "chance";
    }

    // Two color-mixes rather than one keep the ramp's middle a real teal
    // instead of the muddy grey a straight blue-to-green blend passes
    // through, and every stop stays a theme token.
    function rampColor(share) {
      const t = Math.max(0, Math.min(1, share));
      if (t <= 0.5) {
        return "color-mix(in srgb, var(--cb-ramp-mid) " +
          Math.round(t * 200) + "%, var(--cb-ramp-low))";
      }
      return "color-mix(in srgb, var(--cb-ramp-high) " +
        Math.round((t - 0.5) * 200) + "%, var(--cb-ramp-mid))";
    }

    function readerPick() {
      return state.readerSelection !== null ? state.readerSelection : state.selection;
    }

    function resolveHighlight(entry, context) {
      if (entry === "reader") return readerPick();
      if (entry === "best-chance") return context.bestChance ? context.bestChance.id : null;
      return entry;
    }

    function hasData() {
      return state.rating !== "empirical" || state.rolls > 0;
    }

    // ------------------------------------------------------------ painting

    function paint(options) {
      options = options || {};
      const animate = motionAllows(options.animate);
      if (!animate) rootNode.dataset.cbMotion = "off";

      const rated = state.mode === "rated";
      rootNode.dataset.cbMode = state.mode;
      rootNode.dataset.cbRated = rated ? "true" : "false";
      rootNode.dataset.cbRating = state.rating;
      rootNode.dataset.cbSelectable = state.selectable ? "true" : "false";

      const entries = ratings();
      const byId = new Map(entries.map(function (entry) { return [entry.id, entry]; }));
      const key = ratingKey();
      const context = {
        bestChance: bestBy(entries, "chance")
      };
      // Spread the ramp across the range this board actually contains rather
      // than from zero: the corners a reader is comparing sit in the top
      // third of the scale, and anchoring at zero would flatten them into one
      // shade of green.
      const domain = entries.reduce(function (range, entry) {
        return [Math.min(range[0], entry[key]), Math.max(range[1], entry[key])];
      }, [Infinity, -Infinity]);
      const span = domain[1] - domain[0];
      const live = hasData();

      const selectionId = state.selection;
      const readerId = readerPick();

      if (vertexSelection) {
        vertexSelection.each(function (vertex) {
          const group = d3.select(this);
          const entry = byId.get(vertex.id);
          const share = live && entry && span > 0
            ? (entry[key] - domain[0]) / span
            : 0;
          const glyph = group.select("path.cb-glyph");

          if (rated) {
            glyph.style("fill", live ? rampColor(share) : null);
            // Size carries the same ordering as colour, so the ramp is never
            // the only cue.
            glyph.style("transform", "scale(" + (0.74 + share * 0.62).toFixed(3) + ")");
          } else {
            glyph.style("fill", null);
            const chosen = vertex.id === selectionId;
            const under = vertex.id === hoverId || vertex.id === focusedId;
            // Gentler than they were: the glyph itself is much larger now, so
            // a big emphasis scale on top of it overwhelms the hexes.
            glyph.style("transform",
              "scale(" + (chosen ? 1.12 : under ? 1.04 : 1) + ")");
          }

          group.attr("data-selected", vertex.id === selectionId ? "true" : "false");
          group.attr("data-hover", vertex.id === hoverId ? "true" : "false");
          group.attr("tabindex", vertex.id === tabStopId() ? 0 : -1);
          group.attr("aria-pressed", state.selectable
            ? String(vertex.id === selectionId)
            : null);
          group.attr("aria-label", accessibleName(vertex, entry, rated, live));
        });
      }

      paintMarks(context, live);
      paintLegend(key, domain, live);
      paintReadout(byId, context, live);
      paintVisibility();

      svgTitle.text(rated
        ? "Schematic Catan board with every intersection shaded by how productive it is."
        : "Schematic Catan board with an intersection to choose.");

      setValue(entries, byId, context);

      if (!animate) {
        // Force the collapsed transitions to settle at their new values
        // before motion is allowed again.
        void rootNode.offsetWidth;
        delete rootNode.dataset.cbMotion;
      }
    }

    function tabStopId() {
      if (!state.showBoard) return null;
      if (focusedId !== null) return focusedId;
      if (state.selection !== null) return state.selection;
      return board.vertices.length ? board.vertices[0].id : null;
    }

    function accessibleName(vertex, entry, rated, live) {
      const base = sentenceCase(describeVertex(vertex));
      if (!rated || !entry) {
        return state.selectable && vertex.id === state.selection
          ? base + ". Your settlement."
          : base + ".";
      }
      if (!live) return base + ". No rolls yet.";
      const chance = formatPercent(entry.chance);
      return base + ". Pays on " + chance + " of rolls.";
    }

    // Candidate label directions, straight up first: on this board the
    // vertical gap between two hexes in a row is the one direction that is
    // reliably free of a number token.
    const LABEL_ANGLES = [-90, -30, -150, 30, 150, 90, 0, 180, -60, -120, 60, 120];

    function overlapArea(a, b) {
      const dx = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
      const dy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
      return dx > 0 && dy > 0 ? dx * dy : 0;
    }

    // Number tokens carry the chapter's own encoding, so a highlight label
    // must never sit on one. Score every candidate direction against the
    // tokens, the other highlights and the edge of the frame, and take the
    // cheapest.
    function placeLabel(x, y, text, obstacles) {
      const fontSize = geometry.markSize;
      const width = Math.max(24, text.length * fontSize * 0.53 + 8);
      const height = fontSize * 1.5;
      const gap = geometry.ringRadius + 7;
      let best = null;

      LABEL_ANGLES.forEach(function (angle, index) {
        const radians = (angle * Math.PI) / 180;
        const dx = Math.cos(radians);
        const dy = Math.sin(radians);
        const reach = gap + Math.abs(dx) * width / 2 + Math.abs(dy) * height / 2;
        const box = { x: x + dx * reach, y: y + dy * reach, w: width, h: height };

        let cost = index * 6;
        obstacles.forEach(function (obstacle) {
          cost += overlapArea(box, obstacle) * (obstacle.weight || 1);
        });
        const left = box.x - width / 2;
        const right = box.x + width / 2;
        const top = box.y - height / 2;
        const bottom = box.y + height / 2;
        if (left < 2) cost += (2 - left) * 90;
        if (right > geometry.width - 2) cost += (right - geometry.width + 2) * 90;
        if (top < 2) cost += (2 - top) * 90;
        if (bottom > geometry.height - 2) cost += (bottom - geometry.height + 2) * 90;

        if (!best || cost < best.cost) {
          best = { cost: cost, box: box, dx: dx, dy: dy, reach: reach };
        }
      });
      return best;
    }

    function paintMarks(context, live) {
      const assignments = new Map();
      let customIndex = 0;

      state.highlight.forEach(function (entry) {
        const id = resolveHighlight(entry, context);
        // "reader" degrades to nothing at all when no settlement was picked:
        // no empty ring, no apology.
        if (id === null || id === undefined || !board.byId.has(id)) return;
        const kind = entry === "reader" || entry === "best-chance"
          ? entry
          : "custom-" + (customIndex++);
        if (assignments.has(kind)) return;
        assignments.set(kind, { id: id, entry: entry });
      });

      const obstacles = board.hexes
        .filter(function (hex) { return hex.number !== null; })
        .map(function (hex) {
          return {
            x: projectX(hex.cx),
            y: projectY(hex.cy),
            w: geometry.tokenRadius * 2.1,
            h: geometry.tokenRadius * 2.1,
            weight: 1
          };
        });

      // Settlements are obstacles too, but only lightly: on a 54-corner board
      // every direction meets one, so they act as a tiebreak rather than a
      // veto.
      board.vertices.forEach(function (vertex) {
        obstacles.push({
          x: projectX(vertex.x),
          y: projectY(vertex.y),
          w: geometry.glyphSize * 2,
          h: geometry.glyphSize * 2,
          weight: 0.22
        });
      });

      // Every ringed corner is an obstacle too, so a second label never lands
      // on the first one's ring.
      assignments.forEach(function (assignment) {
        const vertex = board.byId.get(assignment.id);
        obstacles.push({
          x: projectX(vertex.x),
          y: projectY(vertex.y),
          w: geometry.ringRadius * 2.1,
          h: geometry.ringRadius * 2.1,
          weight: 1.5
        });
      });

      markSlots.forEach(function (slot) {
        const assignment = assignments.get(slot.config.kind);
        const active = Boolean(assignment) && state.showBoard;
        slot.group.attr("data-active", active ? "true" : "false");
        if (!active) return;

        const vertex = board.byId.get(assignment.id);
        const x = projectX(vertex.x);
        const y = projectY(vertex.y);
        const text = markLabel(slot.config, assignment);
        const placement = placeLabel(x, y, text, obstacles);

        slot.ring.attr("cx", x).attr("cy", y).attr("r", geometry.ringRadius);
        slot.leader
          .attr("x1", x + placement.dx * geometry.ringRadius)
          .attr("y1", y + placement.dy * geometry.ringRadius)
          .attr("x2", placement.box.x - placement.dx * (placement.reach - geometry.ringRadius - 6))
          .attr("y2", placement.box.y - placement.dy * (placement.reach - geometry.ringRadius - 6));
        slot.text
          .attr("x", placement.box.x)
          .attr("y", placement.box.y + geometry.markSize * 0.35)
          .attr("text-anchor", "middle")
          .text(text);

        obstacles.push({
          x: placement.box.x,
          y: placement.box.y,
          w: placement.box.w,
          h: placement.box.h,
          weight: 2.5
        });
      });
      void live;
    }

    function markLabel(config, assignment) {
      if (config.kind === "reader") return "your pick";
      if (config.kind === "best-chance") return "best chance";
      return "corner " + assignment.id;
    }

    function paintLegend(key, domain, live) {
      const visible = state.showLegend && state.mode === "rated";
      legend.node().hidden = !visible;
      if (!visible) return;

      if (!live) {
        legendCaption.text("Roll the dice to shade the board.");
        legendLow.text("");
        legendHigh.text("");
        return;
      }

      const lowValue = domain[0];
      const scaleMax = domain[1];

      if (key === "chance") {
        legendCaption.text(state.rating === "empirical"
          ? "Share of these rolls that paid the corner something"
          : "Chance a roll pays the corner something");
        legendLow.text(formatPercent(lowValue));
        legendHigh.text(formatPercent(scaleMax));
      } else {
        legendCaption.text(state.rating === "empirical"
          ? "Cards the corner collected per roll"
          : "Cards the corner pays per roll");
        legendLow.text(formatPercent(lowValue));
        legendHigh.text(formatPercent(scaleMax));
      }
    }

    function paintReadout(byId, context, live) {
      const rated = state.mode === "rated";
      const focusVertex = state.focus !== null ? board.byId.get(state.focus) : null;
      const selectionVertex = state.selection !== null
        ? board.byId.get(state.selection)
        : null;

      readoutSecondaryValue.text("");

      if (!rated) {
        if (focusVertex && focusVertex.id !== state.selection) {
          readoutPrimaryLabel.text("This corner");
          readoutPrimaryValue.text(sentenceCase(describeVertex(focusVertex)));
          readoutSecondaryLabel.text("");
          readoutSecondaryValue.text(state.selectable
            ? "Choose it to place your settlement."
            : "");
          return;
        }
        readoutPrimaryLabel.text("Your settlement");
        readoutPrimaryValue.text(selectionVertex
          ? sentenceCase(describeVertex(selectionVertex))
          : "Not placed yet");
        readoutSecondaryLabel.text("");
        readoutSecondaryValue.text(selectionVertex
          ? ""
          : "Pick any corner where the hexes meet.");
        return;
      }

      // The readout follows whatever the current step is actually claiming:
      // the reader's hover first, then the best corner when a step rings it,
      // then the reader's own settlement.
      const bestEntry = context.bestChance;
      const marksWinner = state.highlight.indexOf("best-chance") !== -1;
      const targetId = focusVertex
        ? focusVertex.id
        : ((marksWinner && bestEntry)
          ? bestEntry.id
          : (selectionVertex ? selectionVertex.id : (bestEntry ? bestEntry.id : null)));
      const targetVertex = targetId !== null ? board.byId.get(targetId) : null;
      const entry = targetId !== null ? byId.get(targetId) : null;

      let role = "Corner";
      if (focusVertex) role = "This corner";
      else if (bestEntry && targetId === bestEntry.id) {
        role = "Best chance";
      } else if (targetId !== null && targetId === readerPick()) role = "Your pick";

      readoutPrimaryLabel.text(role);
      readoutPrimaryValue.text(targetVertex
        ? sentenceCase(describeVertex(targetVertex))
        : "—");

      if (!live || !entry) {
        readoutSecondaryLabel.text("");
        readoutSecondaryValue.text("No rolls yet.");
        return;
      }

      readoutSecondaryLabel.text(state.rating === "empirical"
        ? "In " + state.rolls.toLocaleString() + " rolls"
        : "By counting");

      const chanceText = state.rating === "empirical" && entry.chanceCount !== null
        ? "paid on " + entry.chanceCount.toLocaleString() + " (" + formatPercent(entry.chance) + ")"
        : "pays on " + Math.round(entry.chance * 36) + " of 36 rolls";
      readoutSecondaryValue.append("span")
        .attr("class", "cb-readout-strong")
        .text(chanceText);
    }

    // --------------------------------------------------------- visibility

    function paintVisibility() {
      rootNode.setAttribute("aria-hidden", state.showBoard ? "false" : "true");
    }

    // Collapse and expand by animating the measured height and block margins
    // together, so the callout grows into the board rather than jumping by
    // its full height the moment the step changes.
    function setShowBoard(visible, animate) {
      const next = Boolean(visible);
      if (next === state.showBoard) return;
      state.showBoard = next;

      if (revealCleanup) {
        revealCleanup();
        revealCleanup = null;
      }

      const shouldAnimate = motionAllows(animate) && rootNode.isConnected;
      if (!shouldAnimate) {
        rootNode.style.height = "";
        rootNode.style.marginTop = "";
        rootNode.style.marginBottom = "";
        rootNode.style.overflow = "";
        rootNode.style.transition = "";
        rootNode.dataset.cbHidden = next ? "false" : "true";
        return;
      }

      const startHeight = rootNode.getBoundingClientRect().height;
      const startStyle = global.getComputedStyle(rootNode);
      const startMargin = parseFloat(startStyle.marginTop) || 0;

      rootNode.style.transition = "none";
      rootNode.style.height = "";
      rootNode.style.marginTop = "";
      rootNode.style.marginBottom = "";
      rootNode.style.overflow = "";
      rootNode.dataset.cbHidden = next ? "false" : "true";

      const endHeight = rootNode.getBoundingClientRect().height;
      const endStyle = global.getComputedStyle(rootNode);
      const endMargin = parseFloat(endStyle.marginTop) || 0;

      rootNode.style.height = startHeight + "px";
      rootNode.style.marginTop = startMargin + "px";
      rootNode.style.marginBottom = startMargin + "px";
      rootNode.style.overflow = "hidden";
      void rootNode.offsetHeight;

      const duration = 520;
      rootNode.style.transition =
        "height " + duration + "ms cubic-bezier(0.22, 0.61, 0.36, 1)," +
        " margin-top " + duration + "ms cubic-bezier(0.22, 0.61, 0.36, 1)," +
        " margin-bottom " + duration + "ms cubic-bezier(0.22, 0.61, 0.36, 1)," +
        " opacity " + Math.round(duration * 0.7) + "ms ease";
      rootNode.style.height = endHeight + "px";
      rootNode.style.marginTop = endMargin + "px";
      rootNode.style.marginBottom = endMargin + "px";

      const finish = function () {
        rootNode.removeEventListener("transitionend", onEnd);
        global.clearTimeout(timer);
        rootNode.style.transition = "";
        rootNode.style.height = "";
        rootNode.style.marginTop = "";
        rootNode.style.marginBottom = "";
        rootNode.style.overflow = "";
        revealCleanup = null;
      };
      const onEnd = function (event) {
        if (event.target !== rootNode || event.propertyName !== "height") return;
        finish();
      };
      rootNode.addEventListener("transitionend", onEnd);
      const timer = global.setTimeout(finish, duration + 160);
      revealCleanup = finish;
    }

    // ------------------------------------------------------- reader input

    // Hover and focus repaint with motion allowed: in choose mode the house
    // itself fades in on hover, and the blanket data-cb-motion="off" rule
    // would snap it into place instead. Nothing else changes on hover, so
    // permitting transitions here costs nothing elsewhere.
    function setHover(id) {
      if (hoverId === id) return;
      hoverId = id;
      state.focus = id !== null ? id : (focusedId !== null ? focusedId : null);
      paint({ animate: true });
      notify();
    }

    function setFocus(id) {
      focusedId = id;
      state.focus = id !== null ? id : (hoverId !== null ? hoverId : null);
      paint({ animate: true });
      notify();
    }

    function focusVertexById(id) {
      const node = vertexLayer.select('g.cb-vertex[data-vertex="' + id + '"]').node();
      if (node && typeof node.focus === "function") node.focus();
    }

    function handleActivate(vertex) {
      if (!state.selectable || !state.showBoard) {
        setFocus(vertex.id);
        return;
      }
      const next = state.selection === vertex.id ? null : vertex.id;
      setSelection(next, { remember: true, animate: true });
    }

    function setSelection(id, options) {
      options = options || {};
      state.selection = id;
      if (options.remember !== false && rememberKey) {
        state.readerSelection = id;
        writeRemembered(rememberKey, id);
        document.dispatchEvent(new CustomEvent(SELECTION_EVENT, {
          detail: { key: rememberKey, selection: id, source: rootNode }
        }));
      }
      paint({ animate: options.animate !== false });
      notify();
    }

    function handleKeyDown(event, vertex) {
      const key = event.key;
      if (key === "Enter" || key === " " || key === "Spacebar") {
        event.preventDefault();
        handleActivate(vertex);
        return;
      }
      const directions = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1]
      };
      const direction = directions[key];
      if (!direction) return;
      event.preventDefault();
      const next = nearestInDirection(vertex, direction);
      if (next) focusVertexById(next.id);
    }

    function nearestInDirection(from, direction) {
      let best = null;
      let bestCost = Infinity;
      board.vertices.forEach(function (candidate) {
        if (candidate === from) return;
        const dx = candidate.x - from.x;
        const dy = candidate.y - from.y;
        const along = dx * direction[0] + dy * direction[1];
        if (along <= 0.001) return;
        const across = Math.abs(dx * direction[1] - dy * direction[0]);
        const cost = along + across * 2.4;
        if (cost < bestCost) {
          bestCost = cost;
          best = candidate;
        }
      });
      return best;
    }

    // ------------------------------------------------------------- value

    function setValue(entries, byId, context) {
      const selectionEntry = state.selection !== null ? byId.get(state.selection) : null;
      const selectionVertex = state.selection !== null ? board.byId.get(state.selection) : null;
      const focusVertex = state.focus !== null ? board.byId.get(state.focus) : null;
      const bestEntry = context.bestChance;
      const bestVertex = bestEntry ? board.byId.get(bestEntry.id) : null;

      rootNode.value = {
        mode: state.mode,
        rating: state.rating,
        rolls: state.rolls,
        vertexCount: board.vertices.length,
        showBoard: state.showBoard,

        selection: state.selection,
        selectionNumbers: selectionVertex ? selectionVertex.numbers.slice() : null,
        selectionChance: selectionEntry ? selectionEntry.chance : null,
        selectionChanceTheory: selectionVertex ? selectionVertex.chanceWays / 36 : null,

        best: bestEntry ? bestEntry.id : null,
        bestNumbers: bestVertex ? bestVertex.numbers.slice() : null,
        bestChance: bestEntry ? bestEntry.chance : null,
        bestChanceCorner: context.bestChance ? context.bestChance.id : null,

        readerSelection: readerPick(),
        focus: state.focus,
        focusNumbers: focusVertex ? focusVertex.numbers.slice() : null
      };
    }

    let valueSignature = null;
    function notify() {
      const value = rootNode.value || {};
      const signature = [
        value.mode, value.rating, value.rolls, value.showBoard,
        value.selection, value.best, value.bestChanceCorner,
        value.focus
      ].join("|");
      if (signature === valueSignature) return;
      valueSignature = signature;
      rootNode.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // --------------------------------------------------- linked dice roller

    function scheduleRepaint() {
      if (repaintFrame !== null || disposed) return;
      repaintFrame = global.requestAnimationFrame(function () {
        repaintFrame = null;
        if (disposed) return;
        // Animated on purpose: a linked roller's input events land in the
        // same frames as a tutorial step's own transition, and a snapped
        // repaint here would cut that transition off halfway.
        paint({ animate: true });
        notify();
      });
    }

    // The runtime re-invokes a factory from scratch for every `$value`
    // binding update, which during a bulk batch would destroy this board ten
    // times a second. Subscribe to the source figure's node directly instead
    // and coalesce repaints into one animation frame.
    function subscribeToSource(id) {
      let node = null;
      let mount = null;
      let attempts = 0;
      let pollTimer = null;
      let observer = null;

      const onInput = function () {
        readSource();
      };

      function readSource() {
        if (!node) return;
        const value = node.value;
        if (!value || typeof value !== "object") return;
        state.counts = Array.isArray(value.counts) ? value.counts.slice() : [];
        state.rolls = Math.max(0, Number(value.rolls) || 0);
        scheduleRepaint();
      }

      function findMount() {
        const mounts = document.querySelectorAll("[data-interactive-figure]");
        for (let i = 0; i < mounts.length; i += 1) {
          if (mounts[i].dataset.interactiveFigure === id) return mounts[i];
        }
        return null;
      }

      function attach() {
        mount = mount && mount.isConnected ? mount : findMount();
        if (!mount) return false;
        const candidate = mount.querySelector(".interactive-figure-live > *");
        if (candidate === node) return Boolean(node);
        if (node) node.removeEventListener("input", onInput);
        node = candidate;
        if (!node) return false;
        node.addEventListener("input", onInput);
        readSource();
        return true;
      }

      function watchMount() {
        if (!mount || observer || typeof MutationObserver !== "function") return;
        observer = new MutationObserver(function () {
          attach();
        });
        observer.observe(mount, { childList: true, subtree: true });
      }

      function poll() {
        attempts += 1;
        if (attach()) {
          watchMount();
          global.clearInterval(pollTimer);
          pollTimer = null;
          return;
        }
        if (attempts > 80) {
          global.clearInterval(pollTimer);
          pollTimer = null;
        }
      }

      if (!attach()) {
        pollTimer = global.setInterval(poll, 150);
      } else {
        watchMount();
      }

      return function () {
        if (pollTimer !== null) global.clearInterval(pollTimer);
        if (observer) observer.disconnect();
        if (node) node.removeEventListener("input", onInput);
        node = null;
        observer = null;
        pollTimer = null;
      };
    }

    // ---------------------------------------------------- tutorial actions

    function resolveSelectionAction(value) {
      if (value === null || value === undefined || value === false || value === "none") {
        return null;
      }
      if (value === "reader") return readerPick();
      const id = Number(value);
      return Number.isInteger(id) && id >= 1 && id <= VERTEX_COUNT ? id : null;
    }

    // Every action is absolute: a step restates the state it needs, and any
    // key it leaves out keeps its current value, so Back and direct jumps
    // land on exactly the state the step describes.
    function applyTutorialAction(action) {
      if (!action || typeof action !== "object") return;
      const animate = action.animate !== false;

      let geometryChanged = false;
      if (has(action, "mode")) {
        const nextMode = action.mode === "rated" ? "rated" : "choose";
        geometryChanged = nextMode !== state.mode;
        state.mode = nextMode;
        if (!has(action, "selectable")) state.selectable = state.mode === "choose";
      }
      if (has(action, "rating")) {
        state.rating = action.rating === "empirical" ? "empirical" : "theory";
      }
      if (has(action, "marker")) {
        const nextMarker = action.marker === "dot" ? "dot" : "house";
        geometryChanged = geometryChanged || nextMarker !== state.marker;
        state.marker = nextMarker;
      }
      if (has(action, "selectable")) state.selectable = Boolean(action.selectable);
      if (has(action, "highlight")) state.highlight = normalizeHighlight(action.highlight);
      if (has(action, "selection")) {
        setSelection(resolveSelectionAction(action.selection), {
          remember: false,
          animate: animate
        });
      }
      if (has(action, "show-legend")) state.showLegend = Boolean(action["show-legend"]);
      if (has(action, "show-board")) setShowBoard(Boolean(action["show-board"]), animate);
      if (has(action, "counts") && Array.isArray(action.counts)) {
        state.counts = action.counts.slice();
      }
      if (has(action, "rolls")) {
        // Only meaningful for a board driven without a linked roller; a
        // linked board takes its totals from the roller's own value.
        if (!opts.linkTo) state.rolls = Math.max(0, Number(action.rolls) || 0);
      }

      if (geometryChanged && geometry) refreshGeometry();
      paint({ animate: animate });
      notify();
    }

    // --------------------------------------------------------------- setup

    function refreshGeometry() {
      geometry = computeGeometry(geometry.width);
      drawStatic();
    }

    function redraw(layout) {
      geometry = computeGeometry(layout.width);
      drawStatic();
      paint({ animate: false });
      notify();
    }

    if (api && typeof api.observeResponsiveLayout === "function") {
      layoutController = api.observeResponsiveLayout({
        root: rootNode,
        container: chartWrap.node(),
        compactBelow: 420,
        minimumWidth: 240,
        maximumWidth: 720,
        widthStep: 2,
        onLayout: redraw
      });
    } else {
      geometry = computeGeometry(520);
      drawStatic();
      paint({ animate: false });
      notify();
    }

    if (rememberKey) {
      const onRemembered = function (event) {
        const detail = event.detail || {};
        if (detail.key !== rememberKey || detail.source === rootNode) return;
        state.readerSelection = detail.selection;
        state.selection = detail.selection;
        paint({ animate: true });
        notify();
      };
      document.addEventListener(SELECTION_EVENT, onRemembered);
      const previousCleanup = sourceCleanup;
      sourceCleanup = function () {
        document.removeEventListener(SELECTION_EVENT, onRemembered);
        if (previousCleanup) previousCleanup();
      };
    }

    if (opts.linkTo) {
      const linkCleanup = subscribeToSource(String(opts.linkTo));
      const previousCleanup = sourceCleanup;
      sourceCleanup = function () {
        linkCleanup();
        if (previousCleanup) previousCleanup();
      };
    }

    unsubscribeTutorial = observeTutorialActions(rootNode, function (action) {
      applyTutorialAction(action);
    });

    const runtime = global.interactiveRuntime;
    if (runtime && runtime.motion && typeof runtime.motion.onChange === "function") {
      unsubscribeMotion = runtime.motion.onChange(function (detail) {
        if (detail && detail.reduced && revealCleanup) revealCleanup();
      });
    }

    rootNode.catanApi = {
      applyAction: applyTutorialAction,
      setSelection: function (id, options) {
        setSelection(resolveSelectionAction(id), options || {});
      },
      setCounts: function (counts, rolls) {
        state.counts = Array.isArray(counts) ? counts.slice() : [];
        state.rolls = Math.max(0, Number(rolls) || 0);
        paint({ animate: false });
        notify();
      },
      getState: function () {
        return Object.assign({}, state, { counts: state.counts.slice() });
      },
      getRatings: function () {
        return ratings();
      },
      getVertices: function () {
        return board.vertices.map(function (vertex) {
          return {
            id: vertex.id,
            x: vertex.x,
            y: vertex.y,
            hexes: vertex.hexes.slice(),
            numbers: vertex.numbers.slice(),
            chanceWays: vertex.chanceWays,
            yieldWays: vertex.yieldWays
          };
        });
      }
    };

    if (api && typeof api.adopt === "function") {
      api.adopt(rootNode, {
        whenReady: function () {
          return new Promise(function (resolve) {
            global.requestAnimationFrame(function () {
              global.requestAnimationFrame(resolve);
            });
          });
        },
        cancelMotion: function () {
          if (revealCleanup) revealCleanup();
          rootNode.dataset.cbMotion = "off";
          void rootNode.offsetWidth;
          delete rootNode.dataset.cbMotion;
        },
        dispose: function () {
          disposed = true;
          if (repaintFrame !== null) global.cancelAnimationFrame(repaintFrame);
          if (revealCleanup) revealCleanup();
          if (layoutController) layoutController.dispose();
          if (unsubscribeTutorial) unsubscribeTutorial();
          if (unsubscribeMotion) unsubscribeMotion();
          if (sourceCleanup) sourceCleanup();
        }
      });
    }

    return rootNode;
  };

  // Board maths, exposed for tests and for any prose helper that needs the
  // same counting rule the figure uses.
  global.catanBoard = {
    DEFAULT_NUMBERS: DEFAULT_NUMBERS,
    DEFAULT_RESOURCES: DEFAULT_RESOURCES,
    waysToRoll: waysToRoll,
    buildBoard: buildBoard,
    rateBoard: rateBoard,
    bestBy: bestBy,
    describeVertex: describeVertex
  };
}(typeof window !== "undefined" ? window : this));
