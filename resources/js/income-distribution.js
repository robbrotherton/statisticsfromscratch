makeIncomeDistributionChart = function() {
  const data = [
    { label: "Under $5,000", lower: 0, upper: 5000, households: 3840 },
    { label: "$5,000 to $9,999", lower: 5000, upper: 10000, households: 1760 },
    { label: "$10,000 to $14,999", lower: 10000, upper: 15000, households: 4009 },
    { label: "$15,000 to $19,999", lower: 15000, upper: 20000, households: 3945 },
    { label: "$20,000 to $24,999", lower: 20000, upper: 25000, households: 4652 },
    { label: "$25,000 to $29,999", lower: 25000, upper: 30000, households: 4407 },
    { label: "$30,000 to $34,999", lower: 30000, upper: 35000, households: 4698 },
    { label: "$35,000 to $39,999", lower: 35000, upper: 40000, households: 4518 },
    { label: "$40,000 to $44,999", lower: 40000, upper: 45000, households: 4301 },
    { label: "$45,000 to $49,999", lower: 45000, upper: 50000, households: 4551 },
    { label: "$50,000 to $54,999", lower: 50000, upper: 55000, households: 4509 },
    { label: "$55,000 to $59,999", lower: 55000, upper: 60000, households: 3905 },
    { label: "$60,000 to $64,999", lower: 60000, upper: 65000, households: 4338 },
    { label: "$65,000 to $69,999", lower: 65000, upper: 70000, households: 3480 },
    { label: "$70,000 to $74,999", lower: 70000, upper: 75000, households: 4056 },
    { label: "$75,000 to $79,999", lower: 75000, upper: 80000, households: 3596 },
    { label: "$80,000 to $84,999", lower: 80000, upper: 85000, households: 3550 },
    { label: "$85,000 to $89,999", lower: 85000, upper: 90000, households: 3128 },
    { label: "$90,000 to $94,999", lower: 90000, upper: 95000, households: 3056 },
    { label: "$95,000 to $99,999", lower: 95000, upper: 100000, households: 2800 },
    { label: "$100,000 to $104,999", lower: 100000, upper: 105000, households: 3273 },
    { label: "$105,000 to $109,999", lower: 105000, upper: 110000, households: 2562 },
    { label: "$110,000 to $114,999", lower: 110000, upper: 115000, households: 2353 },
    { label: "$115,000 to $119,999", lower: 115000, upper: 120000, households: 2256 },
    { label: "$120,000 to $124,999", lower: 120000, upper: 125000, households: 2442 },
    { label: "$125,000 to $129,999", lower: 125000, upper: 130000, households: 2121 },
    { label: "$130,000 to $134,999", lower: 130000, upper: 135000, households: 2125 },
    { label: "$135,000 to $139,999", lower: 135000, upper: 140000, households: 1821 },
    { label: "$140,000 to $144,999", lower: 140000, upper: 145000, households: 1923 },
    { label: "$145,000 to $149,999", lower: 145000, upper: 150000, households: 1605 },
    { label: "$150,000 to $154,999", lower: 150000, upper: 155000, households: 2137 },
    { label: "$155,000 to $159,999", lower: 155000, upper: 160000, households: 1588 },
    { label: "$160,000 to $164,999", lower: 160000, upper: 165000, households: 1520 },
    { label: "$165,000 to $169,999", lower: 165000, upper: 170000, households: 1417 },
    { label: "$170,000 to $174,999", lower: 170000, upper: 175000, households: 1329 },
    { label: "$175,000 to $179,999", lower: 175000, upper: 180000, households: 1256 },
    { label: "$180,000 to $184,999", lower: 180000, upper: 185000, households: 1237 },
    { label: "$185,000 to $189,999", lower: 185000, upper: 190000, households: 1034 },
    { label: "$190,000 to $194,999", lower: 190000, upper: 195000, households: 1137 },
    { label: "$195,000 to $199,999", lower: 195000, upper: 200000, households: 1015 },
    { label: "$200,000 and over", lower: 200000, upper: 205000, households: 21540, openEnded: true }
  ];

  const medianIncome = 83730;
  const meanIncome = 121000;
  const totalHouseholds = 134800;

  const width = 900;
  const height = 460;
  const marginTop = 22;
  const marginRight = 24;
  const marginBottom = 58;
  const marginLeft = 72;
  const plotBottom = height - marginBottom;
  const formatDollar = d3.format("$,.0f");
  const formatThousands = d3.format(",");
  const bodyFontSize = "1em";
  const labelFontSize = "0.9em";
  const tickFontSize = "0.85em";

  const x = d3.scaleLinear()
    .domain([0, 205000])
    .range([marginLeft, width - marginRight]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.households)]).nice()
    .range([plotBottom, marginTop]);

  const svg = d3.create("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("role", "img")
    .attr("aria-label", "Distribution of United States household income by income bracket")
    .style("max-width", "100%")
    .style("height", "auto")
    .style("font-family", "inherit")
    .style("font-size", bodyFontSize)
    .style("display", "block");

  const defs = svg.append("defs");

  const openEndedPattern = defs.append("pattern")
    .attr("id", "income-open-ended-pattern")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 8)
    .attr("height", 8)
    .attr("patternTransform", "rotate(45)");

  openEndedPattern.append("rect")
    .attr("width", 8)
    .attr("height", 8)
    .attr("fill", "#3b82b6");

  openEndedPattern.append("line")
    .attr("x1", 0)
    .attr("x2", 0)
    .attr("y1", 0)
    .attr("y2", 8)
    .attr("stroke", "#f8fafc")
    .attr("stroke-opacity", 0.72)
    .attr("stroke-width", 3);

  svg.append("g")
    .attr("transform", `translate(${marginLeft},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatThousands))
    .call(g => g.attr("font-family", "inherit").attr("font-size", tickFontSize))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line")
      .clone()
      .attr("x2", width - marginLeft - marginRight)
      .attr("stroke-opacity", 0.12))
    .call(g => g.selectAll("text").attr("fill", "currentColor"))
    .call(g => g.selectAll("line").attr("stroke", "currentColor"))
    .call(g => g.selectAll("path").attr("stroke", "currentColor"));

  svg.append("g")
    .attr("transform", `translate(0,${plotBottom})`)
    .call(d3.axisBottom(x)
      .tickValues([0, 50000, 100000, 150000, 200000])
      .tickFormat(d => d === 0 ? "$0" : d === 200000 ? "$200k+" : `$${d / 1000}k`))
    .call(g => g.attr("font-family", "inherit").attr("font-size", tickFontSize))
    .call(g => g.selectAll("text").attr("fill", "currentColor"))
    .call(g => g.selectAll("line").attr("stroke", "currentColor"))
    .call(g => g.selectAll("path").attr("stroke", "currentColor"));

  svg.append("text")
    .attr("x", -plotBottom + 12)
    .attr("y", 18)
    .attr("transform", "rotate(-90)")
    .attr("font-size", labelFontSize)
    .attr("fill", "currentColor")
    .attr("fill-opacity", 0.78)
    .text("Households, in thousands");

  svg.append("g")
    .selectAll("rect")
    .data(data)
    .join("rect")
      .attr("x", d => x(d.lower) + 0.5)
      .attr("y", d => y(d.households))
      .attr("width", d => Math.max(1, x(d.upper) - x(d.lower) - 1))
      .attr("height", d => plotBottom - y(d.households))
      .attr("fill", d => d.openEnded ? "url(#income-open-ended-pattern)" : "#3b82b6")
      .attr("stroke", "#245f85")
      .attr("stroke-width", 0.5)
    .append("title")
      .text(d => `${d.label}: ${formatThousands(d.households)} thousand households (${d3.format(".1%")(d.households / totalHouseholds)})`);

  svg.append("text")
    .datum(data.find(d => d.openEnded))
    .attr("x", d => x((d.lower + d.upper) / 2))
    .attr("y", d => y(d.households) - 7)
    .attr("text-anchor", "middle")
    .attr("font-size", tickFontSize)
    .attr("font-weight", 700)
    .attr("fill", "currentColor")
    .text("$200k+");

  const markerData = [
    { label: "Median", value: medianIncome, color: "var(--graph-series-3, #009e73)", anchor: "end", dx: -6 },
    { label: "Mean", value: meanIncome, color: "var(--bc-danger-color, #c63f3f)", anchor: "start", dx: 6 }
  ];

  const markers = svg.append("g")
    .selectAll("g")
    .data(markerData)
    .join("g")
      .attr("transform", d => `translate(${x(d.value)},0)`);

  markers.append("line")
    .attr("y1", marginTop)
    .attr("y2", plotBottom)
    .attr("stroke", d => d.color)
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "5,4");

  markers.append("text")
    .attr("x", d => d.dx)
    .attr("y", marginTop + 14)
    .attr("text-anchor", d => d.anchor)
    .attr("font-size", labelFontSize)
    .attr("font-weight", 700)
    .attr("fill", d => d.color)
    .text(d => `${d.label}: ${formatDollar(d.value)}`);

  const root = document.createElement("div");
  root.className = "income-distribution-chart";
  root.appendChild(svg.node());

  return root;
}
