presidentialApprovalPalette = [
  "#4e79a7",
  "#f28e2b",
  "#59a14f",
  "#e15759",
  "#76b7b2",
  "#b6992d",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ab",
  "#2f6f9f",
  "#d1495b",
  "#0f766e",
  "#b45309",
  "#6d5bd0",
  "#65789b"
];

presidentialApprovalLabels = {
  "Franklin D. Roosevelt": "F. Roosevelt",
  "Harry S Truman": "Truman",
  "Dwight D. Eisenhower": "Eisenhower",
  "John F. Kennedy": "Kennedy",
  "Lyndon B. Johnson": "L. Johnson",
  "Richard Nixon": "Nixon",
  "Gerald R. Ford": "Ford",
  "Jimmy Carter": "Carter",
  "Ronald Reagan": "Reagan",
  "George Bush": "G.H.W. Bush",
  "William J. Clinton": "Clinton",
  "George W. Bush": "G.W. Bush",
  "Barack Obama": "Obama",
  "Donald J. Trump": "Trump",
  "Joseph R. Biden": "Biden"
};

presidentialApprovalDataCache = new Map();

presidentialApprovalParseDate = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

presidentialApprovalLoadData = (dataUrl) => {
  if (!presidentialApprovalDataCache.has(dataUrl)) {
    presidentialApprovalDataCache.set(dataUrl, d3.csv(dataUrl));
  }
  return presidentialApprovalDataCache.get(dataUrl);
}

presidentialApprovalNormalizeRows = (rawRows) => rawRows
  .map((row) => ({
    president: row.president,
    term: row.term,
    date: presidentialApprovalParseDate(row.start_date),
    approval: Number(row.approving),
    source: row
  }))
  .filter((row) =>
    row.president &&
    row.term &&
    row.date &&
    Number.isFinite(row.approval)
  )
  .sort((a, b) => d3.ascending(a.date, b.date));

presidentialApprovalExclusionKeys = (opts = {}) => {
  const exclusions = opts.excludeTerms || opts.exclude || [];
  return new Set(exclusions.map((item) => {
    if (typeof item === "string") return item;
    return `${item.president || ""}::${item.term || ""}`;
  }));
}

presidentialApprovalFilterRows = (rows, opts = {}) => {
  const exclusionKeys = presidentialApprovalExclusionKeys(opts);
  if (!exclusionKeys.size) return rows;
  return rows.filter((row) =>
    !exclusionKeys.has(`${row.president}::${row.term}`) &&
    !exclusionKeys.has(row.president)
  );
}

presidentialApprovalResolveXDomain = (rows, opts = {}) => {
  const startProvided = opts.xStartYear !== undefined &&
    opts.xStartYear !== null &&
    opts.xStartYear !== "";
  const endProvided = opts.xEndYear !== undefined &&
    opts.xEndYear !== null &&
    opts.xEndYear !== "";
  const startYear = startProvided ? Number(opts.xStartYear) : null;
  const endYear = endProvided ? Number(opts.xEndYear) : null;
  const validYear = (year) => Number.isInteger(year) && year >= 1000 && year <= 9999;

  if (startProvided && !validYear(startYear)) {
    return { error: "xStartYear must be a whole year between 1000 and 9999." };
  }
  if (endProvided && !validYear(endYear)) {
    return { error: "xEndYear must be a whole year between 1000 and 9999." };
  }

  const automaticDomain = d3.scaleUtc()
    .domain(d3.extent(rows, (row) => row.date))
    .nice(d3.utcYear.every(10))
    .domain();
  const start = startProvided
    ? new Date(Date.UTC(startYear, 0, 1))
    : automaticDomain[0];
  const end = endProvided
    ? new Date(Date.UTC(endYear, 11, 31, 23, 59, 59, 999))
    : automaticDomain[1];

  if (+start >= +end) {
    return { error: "xStartYear must define a date before the end of the x-axis." };
  }

  return {
    domain: [start, end],
    startYear: startProvided ? startYear : null
  };
}

presidentialApprovalLabel = (president) =>
  presidentialApprovalLabels[president] || String(president).replace(/^[A-Z][a-z]+\s+/, "");

presidentialApprovalSegmentKey = (row) => `${row.president}::${row.term}`;

presidentialApprovalSegments = (rows) => {
  const segmentMap = new Map();

  rows.forEach((row) => {
    const key = presidentialApprovalSegmentKey(row);
    if (!segmentMap.has(key)) {
      segmentMap.set(key, {
        key,
        president: row.president,
        term: row.term,
        rows: []
      });
    }
    segmentMap.get(key).rows.push(row);
  });

  return Array.from(segmentMap.values());
}

presidentialApprovalLabelPoint = (segment) => {
  const rows = segment.rows;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const midpoint = (+first.date + +last.date) / 2;

  return rows.reduce((best, row) =>
    Math.abs(+row.date - midpoint) < Math.abs(+best.date - midpoint) ? row : best
  , first);
}

// Direct labels are placed left to right, each one taking the first vertical
// offset that clears everything already placed. A label whose measured width
// leaves it no free offset is dropped rather than stacked on top of a
// neighbour: on a narrow layout the plot cannot hold fifteen names, and an
// unreadable pile of them hides the very lines they identify.
presidentialApprovalLayoutLabels = (labelRows, margin, height, opts = {}) => {
  const placed = [];
  const top = margin.top + 8;
  const bottom = height - margin.bottom - 6;
  const rowGap = Number(opts.rowGap) || 14;
  const offsetLadder = opts.offsetLadder || [-9, 16, -22, 29];

  return labelRows
    .slice()
    .sort((a, b) => d3.ascending(a.x, b.x))
    .map((row) => {
      // A label for a point near the ceiling tries the slots below it first.
      const offsets = row.point.approval >= 88
        ? offsetLadder.filter((offset) => offset > 0).sort((a, b) => a - b)
          .concat(offsetLadder.filter((offset) => offset < 0).sort((a, b) => b - a))
        : offsetLadder;
      const dy = offsets.find((offset) => {
        const y = Math.max(top, Math.min(bottom, row.y + offset));
        return !placed.some((other) =>
          Math.abs(row.x - other.x) < (row.width + other.width) / 2 + 4 &&
          Math.abs(y - other.y) < rowGap
        );
      });
      if (dy === undefined) return Object.assign({}, row, { dropped: true });
      const y = Math.max(top, Math.min(bottom, row.y + dy));
      const laidOut = Object.assign({}, row, { y });
      placed.push(laidOut);
      return laidOut;
    });
}

presidentialApprovalEnsureStyles = () => {
  if (document.getElementById("sfs-presidential-approval-styles")) return;
  const style = document.createElement("style");
  style.id = "sfs-presidential-approval-styles";
  style.textContent = `
      .presidential-approval-label {
        font-size: var(--sfs-figure-small-size, 0.75rem);
        font-weight: 700;
        paint-order: stroke fill;
        stroke: var(--sfs-bg, #fff);
        stroke-width: 4;
        stroke-linejoin: round;
      }

      /* Axis furniture holds its size at every width; this annotation layer is
         the documented exception (see --sfs-figure-micro-size). */
      .presidential-approval-chart[data-sfs-layout="compact"] .presidential-approval-label {
        font-size: var(--sfs-figure-micro-size, 0.6875rem);
        stroke-width: 3;
      }
  `;
  document.head.appendChild(style);
}

// The viewBox tracks the chart wrap's measured width so text set in rem keeps
// its real size as the figure narrows, instead of shrinking with the geometry.
// Height follows width down to a floor, which keeps the y scale readable and
// leaves the label ladder somewhere to go on a phone.
presidentialApprovalGeometry = (opts = {}, availableWidth) => {
  const preferredWidth = Number(opts.width) || 900;
  const width = Math.max(240, Math.min(
    preferredWidth,
    Number(availableWidth) > 0 ? Number(availableWidth) : preferredWidth
  ));
  const compact = width < (Number(opts.compactBelow) || 560);
  const preferredHeight = Number(opts.height) || 500;
  const height = Math.max(
    Math.min(preferredHeight, 340),
    Math.round(preferredHeight * (width / preferredWidth))
  );
  const margin = Object.assign({
    top: opts.title ? 44 : 24,
    right: compact ? 16 : 32,
    bottom: compact ? 52 : 58,
    left: compact ? 52 : 64
  }, opts.margin || {});

  return { width, height, margin, compact, preferredWidth };
}

presidentialApprovalCreateStatus = (message) => {
  const status = document.createElement("p");
  status.className = "presidential-approval-status";
  status.style.margin = "0";
  status.style.color = "var(--sfs-muted)";
  status.textContent = message;
  return status;
}

presidentialApprovalStyleAxis = (axis) => {
  axis.attr("class", function() {
      return `${this.getAttribute("class") || ""} sfs-axis`;
    })
    .call((g) => g.selectAll("text").attr("class", "sfs-tick-label"))
    .call((g) => g.selectAll("line").attr("class", "sfs-graph-tick-line"))
    .call((g) => g.selectAll("path").attr("class", "sfs-graph-domain"));
}

presidentialApprovalRenderChart = (rawRows, opts = {}, geometry) => {
  const allRows = presidentialApprovalFilterRows(presidentialApprovalNormalizeRows(rawRows), opts);
  if (!allRows.length) {
    return presidentialApprovalCreateStatus("No presidential approval rows could be plotted.");
  }

  const xDomainResult = presidentialApprovalResolveXDomain(allRows, opts);
  if (xDomainResult.error) {
    return presidentialApprovalCreateStatus(xDomainResult.error);
  }

  const [xStart, xEnd] = xDomainResult.domain;
  const rows = allRows.filter((row) => row.date >= xStart && row.date <= xEnd);
  if (!rows.length) {
    return presidentialApprovalCreateStatus("No presidential approval rows fall within the selected year range.");
  }

  const layout = geometry || presidentialApprovalGeometry(opts);
  const { width, height, margin, compact } = layout;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const plotBottom = height - margin.bottom;
  const titleStartYear = xDomainResult.startYear || rows[0].date.getUTCFullYear();
  const title = opts.title || ``;
  const yTicks = [0, 20, 40, 60, 80, 100];

  const presidents = [];
  allRows.forEach((row) => {
    if (!presidents.includes(row.president)) presidents.push(row.president);
  });

  const color = d3.scaleOrdinal()
    .domain(presidents)
    .range(presidentialApprovalPalette);

  const x = d3.scaleUtc()
    .domain(xDomainResult.domain)
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, 100])
    .range([plotBottom, margin.top]);

  const svg = d3.create("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr(
      "aria-label",
      `Line chart of presidential job approval from ${rows[0].president} in ${rows[0].date.getUTCFullYear()} through ${rows[rows.length - 1].president} in ${rows[rows.length - 1].date.getUTCFullYear()}`
    )
    .attr("class", "sfs-graph presidential-approval-svg")
    .style("width", "100%")
    .style("max-width", "100%")
    .style("height", "auto")
    .style("display", "block");

  svg.append("title").text("Presidential job approval over time");

  svg.append("text")
    .attr("class", "sfs-graph-title")
    .attr("x", margin.left)
    .attr("y", 20)
    .text(title);

  svg.append("g")
    .attr("class", "sfs-graph-grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y)
      .tickValues(yTicks)
      .tickSize(-innerWidth)
      .tickFormat(""))
    .call((g) => g.selectAll(".domain").remove());

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickValues(yTicks).tickFormat((value) => `${value}`))
    .call(presidentialApprovalStyleAxis);

  // Narrow layouts thin the decade ticks out rather than shrinking them.
  svg.append("g")
    .attr("transform", `translate(0,${plotBottom})`)
    .call(d3.axisBottom(x)
      .ticks(d3.utcYear.every(compact ? 20 : 10))
      .tickFormat(d3.utcFormat("%Y")))
    .call(presidentialApprovalStyleAxis);

  svg.append("text")
    .attr("class", "sfs-axis-label")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", height - 16)
    .attr("text-anchor", "middle")
    .text("Year");

  svg.append("text")
    .attr("class", "sfs-axis-label")
    .attr("x", -margin.top - innerHeight / 2)
    .attr("y", 18)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Percent approving");

  const line = d3.line()
    .x((row) => x(row.date))
    .y((row) => y(row.approval));

  const segments = presidentialApprovalSegments(rows);
  const dateFormat = d3.utcFormat("%Y");

  svg.append("g")
    .attr("class", "presidential-approval-lines")
    .selectAll("path")
    .data(segments)
    .join("path")
      .attr("class", "sfs-graph-line presidential-approval-line")
      .attr("fill", "none")
      .attr("stroke-width", 2.2)
      .attr("stroke-opacity", 0.92)
      .style("stroke", (segment) => color(segment.president))
      .attr("d", (segment) => line(segment.rows))
    .append("title")
      .text((segment) => {
        const first = segment.rows[0];
        const last = segment.rows[segment.rows.length - 1];
        return `${presidentialApprovalLabel(segment.president)} (${segment.term}), ${dateFormat(first.date)}-${dateFormat(last.date)}`;
      });

  const labelData = segments.map((segment) => {
    const point = presidentialApprovalLabelPoint(segment);
    return {
      segment,
      point,
      x: x(point.date),
      y: y(point.approval),
      color: color(segment.president),
      label: presidentialApprovalLabel(segment.president)
    };
  });

  // Draw first, measure, then place: getComputedTextLength reports the real
  // width of the rendered label, so collision testing works at whatever size
  // the stylesheet resolved. It returns 0 while the SVG is still detached, so
  // fall back to an estimate for that first build; the layout pass that runs
  // once the figure is mounted replaces it with measured values.
  const labels = svg.append("g")
    .attr("class", "presidential-approval-labels")
    .selectAll("text")
    .data(labelData)
    .join("text")
      .attr("class", "presidential-approval-label")
      .attr("text-anchor", "middle")
      .style("fill", (row) => row.color)
      .text((row) => row.label);

  const estimatedCharWidth = compact ? 6.1 : 6.6;
  labels.each(function(row) {
    const measured = typeof this.getComputedTextLength === "function"
      ? this.getComputedTextLength()
      : 0;
    row.width = measured || Math.max(28, row.label.length * estimatedCharWidth);
  });

  const placedLabels = presidentialApprovalLayoutLabels(labelData, margin, height, {
    // A taller ladder on narrow layouts keeps more names in play before any
    // are dropped, since vertical room is the one thing a phone still has.
    offsetLadder: compact
      ? [-9, 16, -22, 29, -35, 42, -48, 55]
      : [-9, 16, -22, 29]
  });
  const placedByLabel = new Map(placedLabels.map((row) => [row.segment.key, row]));

  labels
    .attr("x", (row) => row.x)
    .attr("y", (row) => {
      const placed = placedByLabel.get(row.segment.key);
      return placed && !placed.dropped ? placed.y : row.y;
    })
    .attr("display", (row) => {
      const placed = placedByLabel.get(row.segment.key);
      return placed && placed.dropped ? "none" : null;
    })
    .attr("aria-hidden", (row) => {
      const placed = placedByLabel.get(row.segment.key);
      return placed && placed.dropped ? "true" : null;
    });

  return svg.node();
}

makePresidentialApprovalChart = function(opts = {}) {
  presidentialApprovalEnsureStyles();

  const root = document.createElement("div");
  root.className = "sfs-figure presidential-approval-chart";

  const chartWrap = document.createElement("div");
  chartWrap.className = "sfs-chart-wrap";
  chartWrap.appendChild(presidentialApprovalCreateStatus("Loading presidential approval data..."));
  root.appendChild(chartWrap);

  const preferredWidth = Number(opts.width) || 900;
  let loadedRows = null;

  function build(availableWidth) {
    if (!loadedRows) return;
    const geometry = presidentialApprovalGeometry(opts, availableWidth);
    root.dataset.sfsLayout = geometry.compact ? "compact" : "wide";
    chartWrap.replaceChildren(presidentialApprovalRenderChart(loadedRows, opts, geometry));
  }

  const dataUrl = opts.dataUrl || "resources/data/presidential-job-approval.csv";
  presidentialApprovalLoadData(dataUrl)
    .then((rows) => {
      loadedRows = rows;
      build(chartWrap.getBoundingClientRect().width || preferredWidth);
      if (window.interactiveFigure &&
        typeof window.interactiveFigure.observeResponsiveLayout === "function") {
        window.interactiveFigure.observeResponsiveLayout({
          root,
          container: chartWrap,
          compactBelow: Number(opts.compactBelow) || 560,
          minimumWidth: 240,
          maximumWidth: preferredWidth,
          widthStep: 4,
          onLayout(layout) {
            build(layout.width);
          }
        });
      }
    })
    .catch((error) => {
      console.warn("Could not load presidential approval data:", error);
      chartWrap.replaceChildren(presidentialApprovalCreateStatus("Could not load presidential approval data."));
    });

  return root;
}
