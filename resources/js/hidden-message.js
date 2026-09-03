makeHiddenMessage = function() {
  const word = "STATISTICS";
  const letters = Array.from(word);
  const data = letters.map((letter, index) => ({
    letter,
    index,
    value: letter.charCodeAt(0) - 64
  }));
  const uniqueValues = Array.from(new Set(data.map(d => d.value))).sort(d3.ascending);
  const rankByValue = new Map(uniqueValues.map((value, i) => [value, i + 1]));
  data.forEach(d => {
    d.rank = rankByValue.get(d.value);
  });

  const width = 1000;
  const height = 520;
  const marginTop = 20;
  const marginRight = 10;
  const marginBottom = 10;
  const marginLeft = 10;

  const x = d3.scaleBand()
    .domain(d3.range(data.length))
    .range([marginLeft, width - marginRight])
    .padding(0.12);

  const y = d3.scaleLinear()
    .domain([0, 26])
    .range([height - marginBottom, marginTop]);

  const seriesColors = [
    "var(--graph-series-1, var(--graph-data-color, #0072b2))",
    "var(--graph-series-3, #009e73)",
    "var(--graph-series-2, #e69f00)",
    "var(--graph-series-4, #d55e00)",
    "var(--graph-series-5, #cc79a7)"
  ];
  const ranksInReadingOrder = Array.from(new Set(data.map(d => d.rank)));
  const color = d3.scaleOrdinal(seriesColors)
    .domain(ranksInReadingOrder);

  const svg = d3.create("svg")
    .attr("viewBox", [0, 0, width, height])
    .style("max-width", "100%")
    .style("height", "auto")
    .style("display", "block");

  svg.append("line")
    .attr("x1", marginLeft)
    .attr("x2", width - marginRight)
    .attr("y1", y(0))
    .attr("y2", y(0))
    .attr("stroke", "currentColor")
    .attr("stroke-opacity", 0.25);

  const bars = svg.selectAll("rect")
    .data(data)
    .join("rect")
      .attr("x", d => x(d.index))
      .attr("width", x.bandwidth())
      .attr("y", y(0))
      .attr("height", 0)
      .attr("rx", 2)
      .style("fill", d => color(d.rank))
      .style("stroke", "var(--sfs-text, currentColor)")
      .style("stroke-opacity", 0.3)
      .attr("stroke-width", 1);

  onVisible(svg.node(), () => {
    const motion = window.interactiveRuntime && window.interactiveRuntime.motion;
    bars.transition()
      .ease(d3.easeBackOut)
      .duration(motion ? motion.duration(700) : 700)
      .delay((d, i) => motion && motion.isReduced() ? 0 : i * 90)
      .attr("y", d => y(d.value))
      .attr("height", d => y(0) - y(d.value));
  });

  return svg.node();
}
