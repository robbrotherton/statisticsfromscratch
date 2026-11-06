// One line per person across a design's conditions, in Chapter 13's people colours,
// each named at its right-hand end. Chapter 15 uses it to show what a plot of means
// hides: whether each person's own scores move together.

sfsProfileLabelPositions = (ys, gap) => {
  // Keeps each label near its line's end, gap apart, in the lines' order.
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const placed = order.map((d) => d.y);
  for (let pass = 0; pass < 40; pass += 1) {
    let moved = false;
    for (let i = 1; i < placed.length; i += 1) {
      const overlap = gap - (placed[i] - placed[i - 1]);
      if (overlap > 0.01) {
        placed[i - 1] -= overlap / 2;
        placed[i] += overlap / 2;
        moved = true;
      }
    }
    if (!moved) break;
  }
  const result = new Array(ys.length);
  order.forEach((d, rank) => { result[d.i] = placed[rank]; });
  return result;
};

makeProfileLines = function(opts) {
  opts = opts || {};
  const categories = (opts.categories || []).map(String);
  const series = opts.series || [];
  const values = series.flatMap((d) => d.values);
  const yDomain = Array.isArray(opts.yDomain) ? opts.yDomain : d3.extent(values);
  const preferredWidth = 640;

  if (!document.getElementById("profile-lines-styles")) {
    const style = document.createElement("style");
    style.id = "profile-lines-styles";
    style.textContent = `
      .profile-lines { --sfs-figure-max-width: var(--pl-max-width, 42rem); }
      .profile-lines .pl-axis-label { font-size: 0.85rem; fill: currentColor; }
      .profile-lines .pl-name { font-size: 0.8rem; font-weight: 600; }
      .profile-lines .pl-axis text { font-size: 0.8rem; }
    `;
    document.head.appendChild(style);
  }

  const root = d3.create("div")
    .attr("class", "profile-lines sfs-figure")
    .style("--pl-max-width", opts.maxWidth || null);
  const chartWrap = root.append("div").attr("class", "pl-chart-wrap sfs-chart-wrap");
  const svg = chartWrap.append("svg")
    .attr("class", "pl-svg sfs-svg sfs-graph")
    .attr("role", "img")
    .attr("aria-label", opts.ariaLabel || "Line graph with one line per person across the conditions.");

  function build(width) {
    const compact = width < 480;
    const height = Math.round(width * (compact ? 0.82 : 0.6));
    const margin = { top: 14, right: compact ? 62 : 74, bottom: 54, left: compact ? 50 : 60 };
    const x = d3.scalePoint().domain(categories).range([margin.left + 12, width - margin.right - 8]);
    const y = d3.scaleLinear().domain(yDomain).range([height - margin.bottom, margin.top]);
    const color = (d) => d3.schemeTableau10[d.color];
    const line = d3.line().x((v, i) => x(categories[i])).y((v) => y(v));

    svg.selectAll("*").remove();
    svg.attr("viewBox", [0, 0, width, height]);

    svg.append("g").attr("class", "pl-axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickSize(0).tickPadding(10));
    svg.append("g").attr("class", "pl-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(compact ? 4 : 6));
    svg.append("text").attr("class", "pl-axis-label")
      .attr("transform", `translate(14,${(margin.top + height - margin.bottom) / 2}) rotate(-90)`)
      .attr("text-anchor", "middle").text(opts.yLabel || "");
    svg.append("text").attr("class", "pl-axis-label")
      .attr("x", (margin.left + width - margin.right) / 2).attr("y", height - 8)
      .attr("text-anchor", "middle").text(opts.xLabel || "");

    const people = svg.selectAll("g.pl-person").data(series).join("g").attr("class", "pl-person");
    people.append("path").attr("d", (d) => line(d.values))
      .attr("fill", "none").attr("stroke", color).attr("stroke-width", 2.25);
    people.selectAll("circle").data((d) => d.values.map((v, i) => ({ v, i, d }))).join("circle")
      .attr("cx", (p) => x(categories[p.i])).attr("cy", (p) => y(p.v)).attr("r", 4)
      .attr("fill", (p) => color(p.d));

    const ends = series.map((d) => y(d.values[d.values.length - 1]));
    const labelY = sfsProfileLabelPositions(ends, 15);
    svg.selectAll("text.pl-name").data(series).join("text")
      .attr("class", "pl-name")
      .attr("x", width - margin.right + 2).attr("y", (d, i) => labelY[i]).attr("dy", "0.32em")
      .attr("fill", (d) => `color-mix(in srgb, ${color(d)} 60%, var(--sfs-text, #222))`)
      .text((d) => d.name);
  }

  const node = root.node();
  build(preferredWidth);
  if (window.interactiveFigure && typeof window.interactiveFigure.observeResponsiveLayout === "function") {
    window.interactiveFigure.observeResponsiveLayout({
      root: node,
      container: chartWrap.node(),
      compactBelow: 480,
      minimumWidth: 240,
      maximumWidth: preferredWidth,
      widthStep: 4,
      onLayout(layout) { build(layout.width); }
    });
  }
  return node;
};
