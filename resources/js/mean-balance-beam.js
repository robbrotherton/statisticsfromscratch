makeMeanBalanceBeam = function(opts) {
  opts = opts || {};

  const variant = opts.variant || (opts.cover ? "cover" : "interactive");
  const isCover = variant === "cover";
  const width = finiteNumber(opts.width, isCover ? 720 : 640);
  const height = finiteNumber(opts.height, isCover ? 280 : 400);
  const nPositions = Math.max(2, Math.round(finiteNumber(opts.nPositions || opts.scaleWidth, 11)));
  const boxSize = finiteNumber(opts.boxSize, width / nPositions);
  const halfBoxSize = boxSize * 0.5;
  const beamHeight = finiteNumber(opts.beamHeight, boxSize / 4);
  const groundHeight = finiteNumber(opts.groundHeight, isCover ? 40 : 75);
  const beamY = height - groundHeight - boxSize - beamHeight;
  const minBoxes = Math.max(1, Math.round(finiteNumber(opts.minBoxes, 1)));
  const maxTilt = finiteNumber(opts.maxTilt, isCover ? 5 : 14);
  const wobbleAmplitude = finiteNumber(opts.wobbleAmplitude, isCover ? 0.8 : 0.55);
  const wobblePeriod = finiteNumber(opts.wobblePeriod, 4800);
  const wobbleOncePeriod = finiteNumber(opts.wobbleOncePeriod, 700);
  const wobbleDuration = finiteNumber(opts.wobbleDuration, isCover ? 1600 : 1400);
  const wobbleVisibilityThreshold = finiteNumber(opts.wobbleVisibilityThreshold, 0.25);
  const balanceMotionDuration = finiteNumber(opts.balanceMotionDuration, 420);
  const beamTipDuration = finiteNumber(opts.beamTipDuration, 300);
  const colors = opts.colors || d3.schemeTableau10 || d3.schemeCategory10;
  const f1 = d3.format(".1~f");
  const f2 = d3.format(".2f");
  const formatDeviation = d3.format("+.1~f");
  const fallGravity = finiteNumber(opts.fallGravity, 1700);
  const fallStartY = -beamY + halfBoxSize;

  function fallDurationForDistance(distance) {
    return Math.sqrt(2 * Math.max(0, distance) / fallGravity) * 1000;
  }

  const directManipulationDefaults = {
    draggable: booleanOpt(opts.draggable, false),
    addOnClick: booleanOpt(opts.addOnClick, false),
    removeOnClick: booleanOpt(opts.removeOnClick, false)
  };
  const state = {
    labels: booleanOpt(opts.labels, !isCover),
    boxLabels: booleanOpt(opts.boxLabels, booleanOpt(opts.labels, !isCover)),
    showDeviationSums: booleanOpt(
      opts.deviationSums === undefined ? opts.showDeviationSums : opts.deviationSums,
      !isCover
    ),
    draggable: directManipulationDefaults.draggable,
    addOnClick: directManipulationDefaults.addOnClick,
    removeOnClick: directManipulationDefaults.removeOnClick,
    controls: booleanOpt(opts.controls, !isCover),
    wobbleMode: normalizeWobbleMode(opts.wobble, isCover ? "once-visible" : "off"),
    wobbleActive: false,
    wobbleHasFired: false,
    meanMarker: booleanOpt(opts.meanMarker, !isCover),
    pivotLabel: booleanOpt(opts.pivotLabel, false),
    pivotX: null
  };
  const dropOnVisible = booleanOpt(opts.dropOnVisible, false);

  ensureMeanBalanceBeamStyles();

  const root = d3.create("div")
    .attr("class", "mean-balance-beam " + (isCover ? "mean-balance-beam-cover" : "mean-balance-beam-interactive"))
    .style("--mbb-max-width", opts.maxWidth || (isCover ? "46rem" : "48rem"))
    .style("--mbb-margin", opts.margin || (isCover ? "0.65rem auto 1.5rem" : "1.25rem auto"));
  const rootNode = root.node();

  let labelsInput = null;
  let deviationsInput = null;
  let wobbleInput = null;
  let meanReadout = null;
  let pivotReadout = null;
  let balanceReadout = null;
  let controls = null;
  let addButtonControl = null;
  let pivotButtonControl = null;

  if (state.controls) {
    controls = root.append("div")
      .attr("class", "mbb-controls");

    const displayPanel = controls.append("section")
      .attr("class", "mbb-control-panel sfs-if-control-panel");
    displayPanel.append("p")
      .attr("class", "mbb-control-title")
      .text("Display");
    labelsInput = addCheckbox(displayPanel, "Box deviation labels", state.boxLabels);
    deviationsInput = addCheckbox(displayPanel, "Deviation sums", state.showDeviationSums);
    wobbleInput = addCheckbox(displayPanel, "Wobble", wobbleIsEnabled());

    const actionPanel = controls.append("section")
      .attr("class", "mbb-control-panel sfs-if-control-panel");
    actionPanel.append("p")
      .attr("class", "mbb-control-title")
      .text("Actions");
    const buttonRow = actionPanel.append("div")
      .attr("class", "mbb-button-row");
    const resetButton = addButton(buttonRow, "Reset");
    addButtonControl = addButton(buttonRow, "Add block");
    pivotButtonControl = addButton(buttonRow, "Pivot to mean");

    const summaryPanel = controls.append("section")
      .attr("class", "mbb-control-panel sfs-if-control-panel");
    summaryPanel.append("p")
      .attr("class", "mbb-control-title")
      .text("Readout");
    meanReadout = addReadout(summaryPanel, "Mean");
    pivotReadout = addReadout(summaryPanel, "Pivot");
    balanceReadout = addReadout(summaryPanel, "Balance");

    labelsInput.addEventListener("input", function(event) {
      event.stopPropagation();
      state.boxLabels = labelsInput.checked;
      update(true, { animate: true });
    });

    deviationsInput.addEventListener("input", function(event) {
      event.stopPropagation();
      state.showDeviationSums = deviationsInput.checked;
      update(true, { animate: true });
    });

    wobbleInput.addEventListener("input", function(event) {
      event.stopPropagation();
      setWobbleMode(wobbleInput.checked ? "while-visible" : "off", true);
    });

    resetButton.addEventListener("click", function(event) {
      event.preventDefault();
      event.stopPropagation();
      reset(true);
    });

    addButtonControl.addEventListener("click", function(event) {
      event.preventDefault();
      event.stopPropagation();
      if (!state.addOnClick) return;
      addBoxAt(Math.floor(random() * nPositions), true);
    });

    pivotButtonControl.addEventListener("click", function(event) {
      event.preventDefault();
      event.stopPropagation();
      if (!state.draggable) return;
      state.pivotX = trueMean;
      update(true, { animate: true });
    });
  }

  const chart = root.append("div")
    .attr("class", "mbb-chart");
  const svg = chart.append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", opts.ariaLabel || "Interactive balance beam showing the mean as a balance point");

  const xScale = d3.scaleLinear()
    .domain([0, nPositions])
    .range([0, width]);
  const devScale = d3.scaleLinear()
    .range([0, width]);

  const background = svg.append("rect")
    .attr("class", "mbb-background")
    .attr("width", width)
    .attr("height", height);

  svg.append("rect")
    .attr("class", "mbb-ground")
    .attr("width", width)
    .attr("height", groundHeight)
    .attr("transform", "translate(0," + (height - groundHeight) + ")");

  const groundLabel = svg.append("text")
    .attr("class", "mbb-ground-label")
    .attr("x", width * 0.5)
    .attr("y", height - groundHeight + 22)
    .attr("text-anchor", "middle")
    .text(opts.groundLabel || "Sum of deviations below and above the pivot");

  const beamAndBoxes = svg.append("g")
    .attr("class", "mbb-beam-and-boxes");
  const beam = beamAndBoxes.append("rect")
    .attr("class", "mbb-beam")
    .attr("width", width)
    .attr("height", beamHeight)
    .attr("rx", Math.min(3, beamHeight * 0.35));
  const boxesLayer = beamAndBoxes.append("g")
    .attr("class", "mbb-boxes")
    .style("opacity", dropOnVisible && !prefersReducedMotion() ? 0 : 1);

  const beamLabels = beamAndBoxes.append("g")
    .attr("class", "mbb-beam-labels")
    .selectAll("text")
    .data(d3.range(nPositions))
    .join("text")
      .attr("x", function(d) { return xScale(d + 0.5); })
      .attr("y", beamHeight - 3)
      .attr("text-anchor", "middle")
      .text(function(d) { return d; });

  const meanGhost = svg.append("g")
    .attr("class", "mbb-mean-ghost")
    .attr("aria-hidden", "true");
  meanGhost.append("polygon")
    .attr("points", [
      [0, -halfBoxSize],
      [halfBoxSize, halfBoxSize],
      [-halfBoxSize, halfBoxSize]
    ]);

  const pivot = svg.append("g")
    .attr("class", "mbb-pivot");
  const pivotTriangle = pivot.append("polygon")
    .attr("points", [
      [0, -halfBoxSize],
      [halfBoxSize, halfBoxSize],
      [-halfBoxSize, halfBoxSize]
    ]);
  const pivotLabel = pivot.append("text")
    .attr("class", "mbb-pivot-label")
    .attr("y", -halfBoxSize - 8)
    .attr("text-anchor", "middle");

  const deviations = svg.append("g")
    .attr("class", "mbb-deviation-sums")
    .attr("transform", "translate(0," + (height - 25) + ")");
  const negativeDeviationGroup = deviations.append("g")
    .attr("class", "mbb-negative-deviations")
    .attr("transform", "translate(0,-10)");
  const positiveDeviationGroup = deviations.append("g")
    .attr("class", "mbb-positive-deviations")
    .attr("transform", "translate(0,10)");

  const boxPath = [
    [0, -halfBoxSize],
    [boxSize, -halfBoxSize],
    [boxSize, halfBoxSize],
    [0, halfBoxSize],
    [0, -halfBoxSize]
  ];

  let seedState = Math.max(1, Math.floor(finiteNumber(opts.seed, 47))) % 2147483647;
  let positionsArr = [];
  let boxArr = [];
  let nextBoxId = 0;
  let trueMean = 0;
  let trueMeanPx = 0;
  let pivotPx = 0;
  let renderedPivotPx = null;
  let baseAngle = 0;
  let wobbleTimer = null;
  let wobbleObserver = null;
  let wobbleVisible = false;
  let documentVisibilityHandler = null;
  let draggingBox = null;
  let renderedBoxLabels = null;
  let renderedDeviationSums = null;
  const startingPositions = makeStartingPositions();

  const boxDrag = d3.drag()
    .on("start", function(event, d) {
      if (!state.draggable) return;
      draggingBox = {
        box: d,
        moved: false
      };
      d3.select(this).classed("is-dragging", true);
    })
    .on("drag", function(event, d) {
      if (!state.draggable || !draggingBox) return;
      const sourceEvent = event.sourceEvent || event;
      const pointer = d3.pointer(sourceEvent, beamAndBoxes.node());
      const nextPosition = roundedPositionIndex(pointer[0] - halfBoxSize);
      if (moveBoxTo(d, nextPosition)) {
        draggingBox.moved = true;
      }
    })
    .on("end", function(event, d) {
      const completedDrag = draggingBox;
      d3.select(this).classed("is-dragging", false);
      draggingBox = null;
      if (!state.draggable || !completedDrag) return;
      if (!completedDrag.moved && state.removeOnClick) {
        removeBox(d, true);
      }
    });

  background.on("click.add-box", function(event) {
    if (!state.addOnClick) return;
    const pointer = d3.pointer(event, svg.node());
    addBoxAt(roundedPositionIndex(pointer[0] - halfBoxSize), true);
  });

  const pivotDrag = d3.drag()
    .on("start", function() {
      if (!state.draggable) return;
      pivot.classed("is-dragging", true);
    })
    .on("drag", function(event) {
      if (!state.draggable) return;
      const sourceEvent = event.sourceEvent || event;
      const pointer = d3.pointer(sourceEvent, svg.node());
      state.pivotX = clampPivot(xScale.invert(pointer[0] - halfBoxSize));
      update(true, { animate: false });
    })
    .on("end", function() {
      pivot.classed("is-dragging", false);
    });

  function ensureMeanBalanceBeamStyles() {
    if (document.getElementById("mean-balance-beam-styles")) return;

    const style = document.createElement("style");
    style.id = "mean-balance-beam-styles";
    style.textContent = `
      .mean-balance-beam {
        max-width: var(--mbb-max-width, 48rem);
        margin: var(--mbb-margin, 1.25rem auto);
        color: var(--bs-body-color, #212529);
      }

      .mean-balance-beam svg {
        display: block;
        width: 100%;
        height: auto;
        overflow: visible;
        touch-action: none;
      }

      .mean-balance-beam-cover {
        opacity: 0.96;
      }

      .mean-balance-beam .mbb-background {
        fill: transparent;
        pointer-events: visible;
      }

      .mean-balance-beam .mbb-ground {
        fill: color-mix(in srgb, var(--bs-tertiary-bg, #f1f3f5) 86%, transparent);
      }

      .mean-balance-beam .mbb-ground-label,
      .mean-balance-beam .mbb-pivot-label,
      .mean-balance-beam .mbb-beam-labels text,
      .mean-balance-beam .mbb-box-label,
      .mean-balance-beam .mbb-dev-sum-label {
        fill: currentColor;
        stroke: none;
        font-family: var(--bs-font-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        font-variant-numeric: tabular-nums;
        user-select: none;
      }

      .mean-balance-beam .mbb-ground-label {
        font-size: 15px;
      }

      .mean-balance-beam .mbb-beam {
        fill: var(--bs-body-color, #212529);
      }

      .mean-balance-beam .mbb-beam-labels text {
        fill: var(--bs-body-bg, #fff);
        font-size: 14px;
        font-weight: 700;
      }

      .mean-balance-beam .mbb-box {
        cursor: grab;
      }

      .mean-balance-beam .mbb-box.is-static {
        cursor: default;
      }

      .mean-balance-beam .mbb-box.is-dragging,
      .mean-balance-beam .mbb-pivot.is-dragging {
        cursor: grabbing;
      }

      .mean-balance-beam .mbb-box-shape {
        stroke: var(--bs-body-color, #000);
        stroke-width: 1.5;
        vector-effect: non-scaling-stroke;
      }

      .mean-balance-beam .mbb-box-label {
        fill: #fff;
        font-size: 16px;
        font-weight: 700;
        paint-order: stroke;
        stroke: rgba(0, 0, 0, 0.3);
        stroke-width: 2px;
      }

      .mean-balance-beam .mbb-mean-ghost polygon {
        fill: none;
        stroke: color-mix(in srgb, var(--bs-body-color, #212529) 48%, transparent);
        stroke-width: 2;
        stroke-dasharray: 6 5;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
      }

      .mean-balance-beam .mbb-pivot polygon {
        fill: #c63f3f;
        cursor: grab;
      }

      .mean-balance-beam .mbb-pivot.is-static polygon {
        cursor: default;
      }

      .mean-balance-beam .mbb-pivot.is-dragging polygon {
        fill: var(--bs-primary, #0d6efd);
      }

      .mean-balance-beam .mbb-pivot-label {
        font-size: 15px;
        font-weight: 700;
      }

      .mean-balance-beam .mbb-deviation-sums line {
        stroke-width: 8;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
      }

      .mean-balance-beam .mbb-dev-sum-label {
        font-size: 15px;
        font-weight: 700;
        dominant-baseline: middle;
      }

      .mean-balance-beam .mbb-control-title {
        margin: 0 0 0.45rem;
        font-size: 0.95rem;
        font-weight: 700;
      }

      .mean-balance-beam .mbb-check-row {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        min-height: 1.65rem;
        margin: 0.18rem 0;
        font-size: 0.95rem;
      }

      .mean-balance-beam .mbb-check-row input {
        width: 1rem;
        height: 1rem;
        flex: 0 0 auto;
      }

      .mean-balance-beam .mbb-button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }

      .mean-balance-beam .mbb-button-row button {
        border: 1px solid var(--bs-border-color, #dee2e6);
        border-radius: 4px;
        padding: 0.22rem 0.55rem;
        background: var(--bs-body-bg, #fff);
        color: var(--bs-body-color, #212529);
        font: inherit;
        line-height: 1.2;
        cursor: pointer;
      }

      .mean-balance-beam .mbb-button-row button:hover,
      .mean-balance-beam .mbb-button-row button:focus-visible {
        border-color: var(--bs-primary, #0d6efd);
        color: var(--bs-primary, #0d6efd);
      }

      .mean-balance-beam .mbb-readout {
        display: grid;
        grid-template-columns: minmax(4.2rem, auto) minmax(3rem, 1fr);
        gap: 0.45rem;
        align-items: baseline;
        margin: 0.16rem 0;
        font-size: 0.95rem;
      }

      .mean-balance-beam .mbb-readout-value {
        color: var(--bs-secondary-color, #6c757d);
        font-variant-numeric: tabular-nums;
      }
    `;
    document.head.appendChild(style);
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function booleanOpt(value, fallback) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["false", "0", "no", "off", "hide"].includes(normalized)) return false;
      if (["true", "1", "yes", "on", "show"].includes(normalized)) return true;
    }
    return Boolean(value);
  }

  function normalizeWobbleMode(value, fallback) {
    if (value === undefined || value === null) {
      return normalizeWobbleMode(fallback, "off");
    }

    if (typeof value === "boolean") {
      return value ? "while-visible" : "off";
    }

    const normalized = String(value).trim().toLowerCase().replace(/[\s_]+/g, "-");
    if (["false", "0", "no", "off", "none", "hide"].includes(normalized)) return "off";
    if (["true", "1", "yes", "on", "show", "visible"].includes(normalized)) return "while-visible";
    if (["once", "once-visible", "on-visible", "enter", "on-enter"].includes(normalized)) return "once-visible";
    if (["while-visible", "when-visible", "in-view", "viewport", "visible-loop"].includes(normalized)) return "while-visible";
    if (["continuous", "always", "loop", "forever"].includes(normalized)) return "continuous";

    return normalizeWobbleMode(fallback, "off");
  }

  function wobbleIsEnabled() {
    return state.wobbleMode !== "off";
  }

  function addCheckbox(parent, label, checked) {
    const row = parent.append("label")
      .attr("class", "mbb-check-row");
    const input = row.append("input")
      .attr("type", "checkbox")
      .property("checked", checked)
      .node();
    row.append("span")
      .text(label);
    return input;
  }

  function addButton(parent, label) {
    return parent.append("button")
      .attr("type", "button")
      .text(label)
      .node();
  }

  function addReadout(parent, label) {
    const row = parent.append("div")
      .attr("class", "mbb-readout");
    row.append("span")
      .text(label);
    return row.append("span")
      .attr("class", "mbb-readout-value");
  }

  function random() {
    seedState = (seedState * 16807) % 2147483647;
    return (seedState - 1) / 2147483646;
  }

  function makeStartingPositions() {
    const explicit = opts.initialPositions || opts.positions;
    if (Array.isArray(explicit) && explicit.length) {
      return explicit.map(clampPosition);
    }

    const requestedBoxCount = Math.max(1, Math.round(finiteNumber(opts.nBoxes, 5)));
    if (opts.random || opts.seed !== undefined || requestedBoxCount !== 5) {
      return d3.range(requestedBoxCount).map(function() {
        return Math.floor(random() * nPositions);
      });
    }

    return [1, 2, 6, 6, 10].map(clampPosition);
  }

  function clampPosition(value) {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(nPositions - 1, number));
  }

  function clampPivot(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return trueMean;
    return Math.max(0, Math.min(nPositions - 1, number));
  }

  function roundedPositionIndex(x) {
    const interval = width / nPositions;
    return clampPosition(Math.round(x / interval));
  }

  function reset(notify) {
    setPositions(startingPositions, {
      notify: notify,
      pivot: opts.pivot === undefined ? "mean" : opts.pivot,
      animate: true
    });
  }

  function createBox(position, level, landed) {
    const x = clampPosition(position);
    nextBoxId += 1;
    return {
      id: nextBoxId,
      x: x,
      level: level,
      color: colors[(nextBoxId - 1) % colors.length],
      dev: 0,
      landed: landed !== false,
      isFalling: false
    };
  }

  function setPositions(positions, options) {
    options = options || {};
    const requestedPositions = positions.map(clampPosition);
    const remainingBoxes = boxArr.slice();
    const deferNewBoxes = Boolean(options.animate) && !prefersReducedMotion();
    const reconciledBoxes = requestedPositions.map(function(x) {
      const matchIndex = remainingBoxes.findIndex(function(box) { return box.x === x; });
      if (matchIndex < 0) return null;
      return remainingBoxes.splice(matchIndex, 1)[0];
    });
    const addedIds = [];

    requestedPositions.forEach(function(x, index) {
      let box = reconciledBoxes[index];
      if (!box && remainingBoxes.length) {
        box = remainingBoxes.shift();
      }
      if (!box) {
        box = createBox(x, 0, !deferNewBoxes);
        addedIds.push(box.id);
      }
      reconciledBoxes[index] = box;
    });

    positionsArr = d3.range(nPositions).map(function() { return 0; });
    reconciledBoxes.forEach(function(box, index) {
      const x = requestedPositions[index];
      box.x = x;
      box.level = positionsArr[x];
      box.dev = 0;
      positionsArr[x] += 1;
    });
    boxArr = reconciledBoxes;
    trueMean = getTrueMean();
    state.pivotX = resolvePivot(options.pivot, trueMean);
    const updateOptions = Object.assign({}, options, {
      addedIds: addedIds
    });
    update(Boolean(options.notify), updateOptions);
  }

  function resolvePivot(value, fallback) {
    if (value === undefined || value === null || value === "mean") return fallback;
    return clampPivot(value);
  }

  function getTrueMean() {
    const landed = getLandedBoxes();
    if (!landed.length) return 0;
    return landed.reduce(function(total, box) {
      return total + box.x;
    }, 0) / landed.length;
  }

  function getLandedBoxes() {
    return boxArr.filter(function(box) { return box.landed !== false; });
  }

  function computeDeviations() {
    boxArr.forEach(function(box) {
      box.dev = box.x - state.pivotX;
    });
  }

  function moveBoxTo(box, nextPosition) {
    nextPosition = clampPosition(nextPosition);
    if (box.x === nextPosition) return false;

    const oldPosition = box.x;
    const oldLevel = box.level;
    positionsArr[oldPosition] = Math.max(0, positionsArr[oldPosition] - 1);
    boxArr.forEach(function(other) {
      if (other !== box && other.x === oldPosition && other.level > oldLevel) {
        other.level -= 1;
      }
    });

    box.x = nextPosition;
    box.level = positionsArr[nextPosition];
    positionsArr[nextPosition] += 1;
    update(true, { animate: true });
    return true;
  }

  function addBoxAt(position, notify) {
    const x = clampPosition(position);
    const box = createBox(x, positionsArr[x], prefersReducedMotion());
    positionsArr[x] += 1;
    boxArr.push(box);
    update(Boolean(notify), { animate: true, addedId: box.id });
  }

  function removeBox(box, notify) {
    if (boxArr.length <= minBoxes) return;

    const index = boxArr.indexOf(box);
    if (index < 0) return;

    positionsArr[box.x] = Math.max(0, positionsArr[box.x] - 1);
    boxArr.forEach(function(other) {
      if (other !== box && other.x === box.x && other.level > box.level) {
        other.level -= 1;
      }
    });
    boxArr.splice(index, 1);
    update(Boolean(notify), { animate: true });
  }

  function boxTransform(box) {
    return "translate(" + xScale(box.x) + "," + boxTargetY(box) + ")";
  }

  function boxTargetY(box) {
    return -halfBoxSize + box.level * -boxSize;
  }

  function boxFallTransform(box) {
    return "translate(" + xScale(box.x) + "," + fallStartY + ")";
  }

  function updateBoxes(options) {
    options = options || {};
    const animate = Boolean(options.animate) && !prefersReducedMotion();
    const addedIds = new Set(options.addedIds || []);
    const shouldFall = function(box) {
      return Boolean(options.dropBoxes) || options.addedId === box.id || addedIds.has(box.id);
    };
    const boxes = boxesLayer.selectAll("g.mbb-box")
      .data(boxArr, function(d) { return d.id; });

    boxes.exit()
      .interrupt("fall")
      .transition()
      .duration(animate ? 180 : 0)
      .style("opacity", 0)
      .remove();

    const entered = boxes.enter()
      .append("g")
      .attr("class", "mbb-box")
      .style("opacity", 0)
      .attr("transform", function(d) {
        return animate && shouldFall(d) ? boxFallTransform(d) : boxTransform(d);
      });

    entered.append("polygon")
      .attr("class", "mbb-box-shape")
      .attr("points", boxPath)
      .attr("fill", function(d) { return d.color; });

    entered.append("text")
      .attr("class", "mbb-box-label")
      .attr("x", halfBoxSize)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle");

    const merged = entered.merge(boxes);
    const showBoxLabels = state.labels && state.boxLabels;
    const boxLabels = merged.select(".mbb-box-label")
      .text(function(d) { return formatDeviation(d.dev); })
      .attr("aria-hidden", String(!showBoxLabels))
      .interrupt();

    if (showBoxLabels && options.revealBoxLabels && animate) {
      boxLabels
        .style("display", null)
        .style("opacity", 0)
        .transition("labels")
        .duration(240)
        .ease(d3.easeCubicOut)
        .style("opacity", 1);
    } else {
      boxLabels
        .style("display", showBoxLabels ? null : "none")
        .style("opacity", showBoxLabels ? 1 : 0);
    }

    merged.classed("is-static", !state.draggable);
    if (state.draggable) {
      merged.call(boxDrag);
    } else {
      draggingBox = null;
      merged.classed("is-dragging", false);
      merged.on(".drag", null);
    }

    if (!animate) merged.interrupt("fall");
    merged.interrupt();
    const fallingBoxes = merged.filter(function(d) {
      return animate && shouldFall(d) && !d.isFalling;
    });
    fallingBoxes.each(function(d) {
      d.isFalling = true;
      d.affectsBalanceOnLanding = d.landed === false;
      d.notifyOnLanding = Boolean(options.notifyOnLanding);
    });
    const settledBoxes = merged.filter(function(d) { return !d.isFalling; });
    merged.classed("is-falling", function(d) { return d.isFalling; });

    settledBoxes.transition()
      .duration(animate ? 260 : 0)
      .ease(d3.easeCubicOut)
      .style("opacity", 1)
      .attr("transform", boxTransform);

    if (!fallingBoxes.empty()) {
      const stagger = finiteNumber(
        opts.fallStagger,
        fallDurationForDistance(boxSize * 0.25)
      );
      fallingBoxes
        .style("opacity", 1)
        .attr("transform", boxFallTransform)
        .transition("fall")
        .delay(function(d, index) { return options.dropBoxes ? index * stagger : 0; })
        .duration(function(d) {
          return fallDurationForDistance(boxTargetY(d) - fallStartY);
        })
        .ease(d3.easeQuadIn)
        .attr("transform", boxTransform)
        .on("end.balance-impact", function() {
          const box = this.__data__;
          const affectsBalance = Boolean(box && box.affectsBalanceOnLanding);
          const notifyOnLanding = Boolean(box && box.notifyOnLanding);
          if (!box) return;

          box.isFalling = false;
          box.affectsBalanceOnLanding = false;
          box.notifyOnLanding = false;
          d3.select(this).classed("is-falling", false);

          if (affectsBalance && boxArr.indexOf(box) >= 0) {
            box.landed = true;
            update(notifyOnLanding, { animate: true, balanceImpact: true });
          }
        });
    }
  }

  function devStartAndEndPositions(data) {
    let current = 0;
    return data.map(function(d) {
      const start = current;
      current += Math.abs(d.dev);
      return {
        id: d.id,
        color: d.color,
        devStart: start,
        devEnd: current
      };
    });
  }

  function sum(values) {
    return values.reduce(function(total, value) {
      return total + value;
    }, 0);
  }

  function updateDeviationGroup(group, data, options) {
    const animate = Boolean(options.animate) && !prefersReducedMotion();
    const grow = animate && options.revealDeviationSums;
    const lines = group.selectAll("line")
      .data(data, function(d) { return d.id; });

    lines.exit()
      .transition()
      .duration(animate ? 160 : 0)
      .style("opacity", 0)
      .remove();

    const entered = lines.enter()
      .append("line")
      .attr("x1", function(d) { return devScale(d.devStart); })
      .attr("x2", function(d) { return devScale(d.devStart); })
      .style("opacity", 0);

    const merged = entered.merge(lines)
      .interrupt()
      .attr("stroke", function(d) { return d.color; });

    if (grow) {
      const total = data.length ? data[data.length - 1].devEnd : 1;
      const growDuration = 720;
      merged
        .style("opacity", 1)
        .attr("x1", function(d) { return devScale(d.devStart); })
        .attr("x2", function(d) { return devScale(d.devStart); })
        .transition("grow")
        .delay(function(d) { return growDuration * d.devStart / total; })
        .duration(function(d) {
          return Math.max(80, growDuration * (d.devEnd - d.devStart) / total);
        })
        .ease(d3.easeLinear)
        .attr("x2", function(d) { return devScale(d.devEnd); });
      return;
    }

    merged
      .transition()
      .duration(animate ? 260 : 0)
      .ease(d3.easeCubicOut)
      .style("opacity", state.showDeviationSums ? 1 : 0)
      .attr("x1", function(d) { return devScale(d.devStart); })
      .attr("x2", function(d) { return devScale(d.devEnd); });
  }

  function updateDeviationLabels(negativeSum, positiveSum, options) {
    negativeDeviationGroup.selectAll("text").remove();
    positiveDeviationGroup.selectAll("text").remove();

    if (!state.labels || !state.showDeviationSums) return;

    const labels = [negativeDeviationGroup.append("text")
      .attr("class", "mbb-dev-sum-label")
      .attr("x", devScale(Math.abs(negativeSum)) + 6)
      .text(formatDeviation(negativeSum)),

    positiveDeviationGroup.append("text")
      .attr("class", "mbb-dev-sum-label")
      .attr("x", devScale(positiveSum) + 6)
      .text(formatDeviation(positiveSum))];

    if (options.revealDeviationSums && options.animate && !prefersReducedMotion()) {
      labels.forEach(function(label) {
        label
          .style("opacity", 0)
          .transition("reveal-label")
          .delay(740)
          .duration(180)
          .style("opacity", 1);
      });
    }
  }

  function updateDeviations(options) {
    const landed = getLandedBoxes();
    const negative = landed.filter(function(d) { return d.dev < 0; });
    const positive = landed.filter(function(d) { return d.dev > 0; });
    const negativePositions = devStartAndEndPositions(negative);
    const positivePositions = devStartAndEndPositions(positive);
    const negativeSum = sum(negative.map(function(d) { return d.dev; }));
    const positiveSum = sum(positive.map(function(d) { return d.dev; }));
    const maxEnd = Math.max(
      nPositions,
      negativePositions.length ? negativePositions[negativePositions.length - 1].devEnd : 0,
      positivePositions.length ? positivePositions[positivePositions.length - 1].devEnd : 0
    );

    devScale.domain([0, maxEnd]);
    deviations.style("display", state.showDeviationSums ? null : "none");
    updateDeviationGroup(negativeDeviationGroup, negativePositions, options);
    updateDeviationGroup(positiveDeviationGroup, positivePositions, options);
    updateDeviationLabels(negativeSum, positiveSum, options);

    return {
      negativeSum: negativeSum,
      positiveSum: positiveSum
    };
  }

  function renderBeamTransform(angle) {
    beamAndBoxes.attr(
      "transform",
      "translate(0," + beamY + ") rotate(" + angle + "," + pivotPx + ",0)"
    );
  }

  function updateBeamAngle(options) {
    options = options || {};
    const animate = Boolean(options.animate) && !prefersReducedMotion();
    const direction = pivotPx < trueMeanPx ? 1 : -1;
    const distance = Math.abs(trueMeanPx - pivotPx);
    const hypotenuse = Math.max(boxSize, direction === 1 ? width - pivotPx : pivotPx);
    const ratio = Math.min(1, boxSize / hypotenuse);
    const maximumSafeAngle = 90 - Math.acos(ratio) * 180 / Math.PI;
    baseAngle = direction * Math.min(distance * 0.5, maximumSafeAngle, maxTilt);

    if (state.wobbleActive) return;

    beamAndBoxes.interrupt();
    if (animate) {
      const isImpact = Boolean(options.balanceImpact);
      beamAndBoxes.transition()
        .duration(isImpact ? beamTipDuration : balanceMotionDuration)
        .ease(isImpact ? d3.easeCubicOut : d3.easeCubicInOut)
        .attr(
          "transform",
          "translate(0," + beamY + ") rotate(" + baseAngle + "," + pivotPx + ",0)"
        );
      return;
    }

    renderBeamTransform(baseAngle);
  }

  function prefersReducedMotion() {
    return window.interactiveRuntime && window.interactiveRuntime.motion
      ? window.interactiveRuntime.motion.isReduced()
      : Boolean(window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function documentIsVisible() {
    return typeof document === "undefined" || !document.hidden;
  }

  function elementIsVisibleNow() {
    if (!rootNode.isConnected) return false;

    const rect = rootNode.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    return rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < viewportHeight &&
      rect.left < viewportWidth;
  }

  function stopWobbleTimer(renderBase) {
    if (wobbleTimer) {
      wobbleTimer.stop();
      wobbleTimer = null;
    }

    state.wobbleActive = false;
    if (renderBase !== false) {
      renderBeamTransform(baseAngle);
    }
  }

  function startWobbleTimer(duration, markComplete) {
    if (state.wobbleActive || prefersReducedMotion() || !documentIsVisible()) return;

    state.wobbleActive = true;
    setValue();
    beamAndBoxes.interrupt();
    wobbleTimer = d3.timer(function(elapsed) {
      const isOneShot = Number.isFinite(duration) && duration > 0;
      const period = isOneShot ? wobbleOncePeriod : wobblePeriod;
      const phase = elapsed / period * Math.PI * 2;
      const progress = isOneShot ? Math.min(1, elapsed / duration) : 0;
      const envelope = isOneShot ? Math.sin(progress * Math.PI) : 1;

      renderBeamTransform(baseAngle + Math.sin(phase) * wobbleAmplitude * envelope);

      if (isOneShot && elapsed >= duration) {
        if (markComplete) state.wobbleHasFired = true;
        stopWobbleTimer(true);
        syncControls();
        setValue();
      }
    });
  }

  function ensureDocumentVisibilityListener() {
    if (documentVisibilityHandler) return;

    documentVisibilityHandler = function() {
      updateWobbleFromVisibility();
    };
    document.addEventListener("visibilitychange", documentVisibilityHandler);
  }

  function removeDocumentVisibilityListener() {
    if (!documentVisibilityHandler) return;

    document.removeEventListener("visibilitychange", documentVisibilityHandler);
    documentVisibilityHandler = null;
  }

  function setupWobbleObserver() {
    if (state.wobbleMode === "continuous" || state.wobbleMode === "off") return;
    if (wobbleObserver || typeof IntersectionObserver === "undefined") {
      window.requestAnimationFrame(function() {
        wobbleVisible = elementIsVisibleNow();
        updateWobbleFromVisibility();
      });
      return;
    }

    wobbleObserver = new IntersectionObserver(function(entries) {
      const entry = entries[0];
      wobbleVisible = Boolean(entry && entry.isIntersecting);
      updateWobbleFromVisibility();
    }, { threshold: wobbleVisibilityThreshold });

    wobbleObserver.observe(rootNode);
  }

  function disconnectWobbleObserver() {
    if (!wobbleObserver) return;

    wobbleObserver.disconnect();
    wobbleObserver = null;
    wobbleVisible = false;
  }

  function updateWobbleFromVisibility() {
    if (!wobbleIsEnabled() || prefersReducedMotion() || !documentIsVisible()) {
      stopWobbleTimer(true);
      return;
    }

    if (state.wobbleMode === "continuous") {
      startWobbleTimer(null, false);
      return;
    }

    const visible = wobbleVisible || elementIsVisibleNow();
    if (!visible) {
      stopWobbleTimer(true);
      return;
    }

    if (state.wobbleMode === "while-visible") {
      startWobbleTimer(null, false);
      return;
    }

    if (state.wobbleMode === "once-visible" && !state.wobbleHasFired) {
      startWobbleTimer(wobbleDuration, true);
    }
  }

  function setWobbleMode(value, notify) {
    const nextMode = normalizeWobbleMode(value, "off");
    const modeChanged = nextMode !== state.wobbleMode;
    state.wobbleMode = nextMode;
    if (modeChanged) state.wobbleHasFired = false;
    if (wobbleInput) wobbleInput.checked = wobbleIsEnabled();

    stopWobbleTimer(true);

    if (!wobbleIsEnabled() || prefersReducedMotion()) {
      disconnectWobbleObserver();
      removeDocumentVisibilityListener();
    } else {
      ensureDocumentVisibilityListener();
      if (state.wobbleMode === "continuous") {
        disconnectWobbleObserver();
      } else {
        setupWobbleObserver();
      }
      updateWobbleFromVisibility();
    }

    if (notify) {
      setValue();
      notifyValueChange();
    }
  }

  function updatePivotAndMean(options) {
    options = options || {};
    const animate = Boolean(options.animate) && !prefersReducedMotion();
    const pivotIsDisplaced = Math.abs(trueMean - state.pivotX) >= 0.001;
    const targetPivotPx = pivotPx;
    const pivotY = height - groundHeight - halfBoxSize;
    const startPivotPx = Number.isFinite(renderedPivotPx) ? renderedPivotPx : targetPivotPx;
    const pivotIsMoving = animate && Math.abs(targetPivotPx - startPivotPx) >= 0.1;

    meanGhost
      .attr("transform", "translate(" + trueMeanPx + "," + pivotY + ")")
      .style("display", state.meanMarker && (pivotIsDisplaced || pivotIsMoving) ? null : "none");

    pivot.interrupt("move-pivot");
    if (pivotIsMoving) {
      const interpolatePivot = d3.interpolateNumber(startPivotPx, targetPivotPx);
      pivot.transition("move-pivot")
        .duration(balanceMotionDuration)
        .ease(d3.easeCubicInOut)
        .tween("pivot-position", function() {
          return function(t) {
            renderedPivotPx = interpolatePivot(t);
            pivot.attr("transform", "translate(" + renderedPivotPx + "," + pivotY + ")");
          };
        })
        .on("end", function() {
          renderedPivotPx = targetPivotPx;
          pivot.attr("transform", "translate(" + targetPivotPx + "," + pivotY + ")");
          meanGhost.style("display", state.meanMarker && pivotIsDisplaced ? null : "none");
        });
    } else {
      renderedPivotPx = targetPivotPx;
      pivot.attr("transform", "translate(" + targetPivotPx + "," + pivotY + ")");
    }

    pivot.classed("is-static", !state.draggable);
    if (state.draggable) {
      pivotTriangle.call(pivotDrag);
    } else {
      pivot.classed("is-dragging", false);
      pivotTriangle.on(".drag", null);
    }

    pivotLabel
      .text("pivot " + f1(state.pivotX))
      .style("display", state.labels && state.pivotLabel ? null : "none");

    beamLabels.style("display", state.labels ? null : "none");
    groundLabel.style("display", state.labels && state.showDeviationSums ? null : "none");
  }

  function updateAriaLabel(sums) {
    if (isCover && opts.ariaLabel) {
      svg.attr("aria-label", opts.ariaLabel);
      return;
    }

    const landedCount = getLandedBoxes().length;
    const fallingCount = boxArr.length - landedCount;
    const balanced = Math.abs(trueMean - state.pivotX) < 0.001;
    const sentences = [
      fallingCount
        ? "Balance beam with " + landedCount + " landed observations and " + fallingCount + " falling."
        : "Balance beam with " + landedCount + " observations.",
      "The mean is " + f2(trueMean) + " and the pivot is " + f2(state.pivotX) +
        ", so the beam is " + (balanced ? "balanced." : "tipped."),
      "Box deviation labels are " + (state.labels && state.boxLabels ? "visible." : "hidden.")
    ];

    if (!balanced && state.meanMarker) {
      sentences.push("A dashed ghost pivot marks the mean.");
    }

    if (state.showDeviationSums) {
      sentences.push(
        "The negative deviations total " + f2(sums.negativeSum) +
        " and the positive deviations total " + f2(sums.positiveSum) + "."
      );
    } else {
      sentences.push("Deviation-sum lines are hidden.");
    }

    svg.attr("aria-label", sentences.join(" "));
  }

  function setValue(sums) {
    const landed = getLandedBoxes();
    sums = sums || {
      negativeSum: sum(landed.filter(function(d) { return d.dev < 0; }).map(function(d) { return d.dev; })),
      positiveSum: sum(landed.filter(function(d) { return d.dev > 0; }).map(function(d) { return d.dev; }))
    };

    rootNode.value = {
      n: landed.length,
      positions: landed.map(function(d) { return d.x; }),
      fallingPositions: boxArr.filter(function(d) { return d.landed === false; }).map(function(d) { return d.x; }),
      mean: trueMean,
      pivot: state.pivotX,
      balanced: Math.abs(trueMean - state.pivotX) < 0.001,
      deviations: landed.map(function(d) { return d.dev; }),
      sumNegative: sums.negativeSum,
      sumPositive: sums.positiveSum,
      labels: state.labels,
      boxLabels: state.boxLabels,
      deviationSums: state.showDeviationSums,
      pivotLabel: state.pivotLabel,
      wobble: wobbleIsEnabled(),
      wobbleMode: state.wobbleMode,
      wobbling: state.wobbleActive
    };
  }

  function notifyValueChange() {
    const event = typeof InputEvent === "function"
      ? new InputEvent("input", { bubbles: true })
      : new Event("input", { bubbles: true });
    rootNode.dispatchEvent(event);
  }

  function syncControls() {
    if (labelsInput) labelsInput.checked = state.boxLabels;
    if (deviationsInput) deviationsInput.checked = state.showDeviationSums;
    if (wobbleInput) wobbleInput.checked = wobbleIsEnabled();
    if (addButtonControl) addButtonControl.disabled = !state.addOnClick;
    if (pivotButtonControl) pivotButtonControl.disabled = !state.draggable;
    if (meanReadout) meanReadout.text(f2(trueMean));
    if (pivotReadout) pivotReadout.text(f2(state.pivotX));
    if (balanceReadout) {
      balanceReadout.text(Math.abs(trueMean - state.pivotX) < 0.001 ? "balanced" : "tipped");
    }
  }

  function update(notify, options) {
    options = options || {};
    const shouldAnimate = Boolean(options.animate) && !prefersReducedMotion();
    if (!shouldAnimate) {
      boxArr.forEach(function(box) {
        box.landed = true;
        box.isFalling = false;
        box.affectsBalanceOnLanding = false;
      });
    }
    const boxLabelsVisible = state.labels && state.boxLabels;
    const renderOptions = Object.assign({}, options, {
      revealBoxLabels: boxLabelsVisible && renderedBoxLabels === false,
      revealDeviationSums: state.showDeviationSums && renderedDeviationSums === false,
      notifyOnLanding: Boolean(notify)
    });
    trueMean = getTrueMean();
    trueMeanPx = xScale(trueMean + 0.5);
    state.pivotX = clampPivot(state.pivotX);
    pivotPx = xScale(state.pivotX + 0.5);
    computeDeviations();
    updatePivotAndMean(renderOptions);
    updateBoxes(renderOptions);
    updateBeamAngle(renderOptions);
    const sums = updateDeviations(renderOptions);
    updateAriaLabel(sums);
    renderedBoxLabels = boxLabelsVisible;
    renderedDeviationSums = state.showDeviationSums;
    syncControls();
    setValue(sums);
    if (notify) notifyValueChange();
  }

  function actionKey(key) {
    return String(key).trim().toLowerCase().replace(/[\s_]+/g, "-");
  }

  function actionNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function applyTutorialAction(action, context) {
    let changed = false;
    let shouldNotify = false;
    let nextPositions = null;
    let nextPivot;
    let dropBoxes = false;

    if (state.draggable !== directManipulationDefaults.draggable ||
        state.addOnClick !== directManipulationDefaults.addOnClick ||
        state.removeOnClick !== directManipulationDefaults.removeOnClick) {
      changed = true;
      shouldNotify = true;
    }
    state.draggable = directManipulationDefaults.draggable;
    state.addOnClick = directManipulationDefaults.addOnClick;
    state.removeOnClick = directManipulationDefaults.removeOnClick;

    Object.entries(action || {}).forEach(function(entry) {
      const key = actionKey(entry[0]);
      const value = entry[1];

      switch (key) {
        case "animate":
          break;
        case "drop-boxes":
        case "fall-boxes":
          dropBoxes = booleanOpt(value, false);
          break;
        case "interactive":
        case "direct-manipulation":
          state.draggable = booleanOpt(value, state.draggable);
          state.addOnClick = booleanOpt(value, state.addOnClick);
          state.removeOnClick = booleanOpt(value, state.removeOnClick);
          changed = true;
          shouldNotify = true;
          break;
        case "draggable":
          state.draggable = booleanOpt(value, state.draggable);
          changed = true;
          shouldNotify = true;
          break;
        case "add-on-click":
          state.addOnClick = booleanOpt(value, state.addOnClick);
          changed = true;
          shouldNotify = true;
          break;
        case "remove-on-click":
          state.removeOnClick = booleanOpt(value, state.removeOnClick);
          changed = true;
          shouldNotify = true;
          break;
        case "labels":
        case "show-labels":
          state.labels = booleanOpt(value, state.labels);
          changed = true;
          shouldNotify = true;
          break;
        case "box-labels":
        case "show-box-labels":
          state.boxLabels = booleanOpt(value, state.boxLabels);
          changed = true;
          shouldNotify = true;
          break;
        case "deviations":
        case "deviation-sums":
        case "show-deviations":
          state.showDeviationSums = booleanOpt(value, state.showDeviationSums);
          changed = true;
          shouldNotify = true;
          break;
        case "wobble":
        case "wobble-mode":
          setWobbleMode(value, true);
          break;
        case "pivot":
        case "pivot-x":
          nextPivot = value;
          changed = true;
          shouldNotify = true;
          break;
        case "pivot-label":
          state.pivotLabel = booleanOpt(value, state.pivotLabel);
          changed = true;
          shouldNotify = true;
          break;
        case "positions":
        case "boxes":
        case "box-positions":
          if (Array.isArray(value) && value.length) {
            nextPositions = value;
            changed = true;
            shouldNotify = true;
          }
          break;
        case "add-box":
          {
            const position = actionNumber(value);
            addBoxAt(position === null ? Math.floor(random() * nPositions) : position, true);
          }
          break;
        case "reset":
          if (booleanOpt(value, true)) reset(true);
          break;
        case "controls":
        case "controls-open":
          if (context && typeof context.setControlsOpen === "function") {
            context.setControlsOpen(booleanOpt(value, true));
          }
          break;
        default:
          break;
      }
    });

    if (nextPositions) {
      setPositions(nextPositions, {
        notify: shouldNotify,
        pivot: nextPivot === undefined ? state.pivotX : nextPivot,
        animate: action.animate !== false,
        dropBoxes: dropBoxes
      });
    } else if (changed) {
      if (nextPivot !== undefined) {
        state.pivotX = nextPivot === "mean" ? trueMean : clampPivot(nextPivot);
      }
      update(shouldNotify, {
        animate: action.animate !== false,
        dropBoxes: dropBoxes
      });
    }
  }

  rootNode.meanBalanceBeam = {
    addBox: function(position) { addBoxAt(position, true); },
    reset: function() { reset(true); },
    setLabels: function(value) {
      state.labels = Boolean(value);
      state.boxLabels = Boolean(value);
      update(true, { animate: true });
    },
    setBoxLabels: function(value) {
      state.boxLabels = Boolean(value);
      update(true, { animate: true });
    },
    setPivot: function(value) {
      state.pivotX = value === "mean" ? trueMean : clampPivot(value);
      update(true, { animate: true });
    },
    setPositions: function(positions) {
      if (Array.isArray(positions) && positions.length) {
        setPositions(positions, { notify: true, pivot: "mean", animate: true });
      }
    },
    setWobble: function(value) {
      setWobbleMode(value, true);
    },
    applyTutorialAction: applyTutorialAction
  };

  setPositions(startingPositions, {
    notify: false,
    pivot: opts.pivot === undefined ? "mean" : opts.pivot,
    animate: false
  });

  if (dropOnVisible && !prefersReducedMotion()) {
    const playEntrance = function() {
      boxesLayer.style("opacity", 1);
      update(false, { animate: true, dropBoxes: true });
    };
    if (typeof onVisible === "function") {
      onVisible(rootNode, playEntrance, finiteNumber(opts.dropVisibilityThreshold, 0.75));
    } else {
      window.requestAnimationFrame(playEntrance);
    }
  }

  if (isCover && state.wobbleMode === "once-visible") {
    window.interactiveFigure.coverTimeline(rootNode, {
      duration: wobbleDuration,
      animate: opts.animate !== false,
      draw(elapsed) {
        const progress = Math.min(1, elapsed / wobbleDuration);
        state.wobbleActive = elapsed > 0 && elapsed < wobbleDuration;
        state.wobbleHasFired = elapsed >= wobbleDuration;
        const offset = state.wobbleActive
          ? Math.sin(elapsed / wobbleOncePeriod * Math.PI * 2) * wobbleAmplitude * Math.sin(progress * Math.PI)
          : 0;
        renderBeamTransform(baseAngle + offset);
        setValue();
      }
    });
  } else {
    setWobbleMode(state.wobbleMode, false);
  }

  if (state.controls && window.interactiveFigure) {
    window.interactiveFigure.wrap({
      root: rootNode,
      controls: controls.node(),
      label: opts.controlsLabel || "mean balance beam controls",
      placement: opts.controlsPlacement || "callout",
      layout: opts.controlsLayout || "equal",
      applyAction: applyTutorialAction,
      startOpen: opts.controlsOpen === undefined ? false : Boolean(opts.controlsOpen)
    });
  }

  return rootNode;
}
