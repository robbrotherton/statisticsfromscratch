// See resources/js/GRAPHS.md for module boundaries and compatibility.
sfsGraphAppendTableHeader = (cell, value) => {
  if (value && typeof value.nodeType === "number") {
    cell.appendChild(value);
    return;
  }

  const source = String(value === undefined || value === null ? "" : value);
  const mathPattern = /\$([^$]+)\$/g;
  const api = window.interactiveFigure;
  if (!api || typeof api.inlineMath !== "function" || !mathPattern.test(source)) {
    cell.textContent = source.replace(mathPattern, "$1");
    return;
  }

  mathPattern.lastIndex = 0;
  let cursor = 0;
  let match = mathPattern.exec(source);
  while (match) {
    if (match.index > cursor) {
      cell.appendChild(document.createTextNode(source.slice(cursor, match.index)));
    }
    cell.appendChild(api.inlineMath(match[1]));
    cursor = match.index + match[0].length;
    match = mathPattern.exec(source);
  }
  if (cursor < source.length) {
    cell.appendChild(document.createTextNode(source.slice(cursor)));
  }
}

makeFrequencyTable = (opts = {}) => {
  const rows = frequencyTable(opts);
  const formatter = opts.format || d3.format("~g");
  const percentFormatter = opts.percentFormat || d3.format(".1f");
  const columns = opts.columns || [
    "label",
    "frequency"
  ].concat(opts.proportion ? ["proportion"] : [], opts.percent ? ["percent"] : [], opts.cumulative ? ["cumulativePercent"] : []);
  const headers = Object.assign({
    label: opts.variable || "X",
    frequency: "$f$",
    proportion: "$p$",
    percent: "%",
    cumulativeFrequency: "cumulative $f$",
    cumulativePercent: "cumulative %"
  }, opts.headers || {});

  const table = d3.create("table")
    .attr("class", "sfs-frequency-table table table-sm");

  if (opts.ariaLabel) table.attr("aria-label", opts.ariaLabel);
  if (opts.caption) table.append("caption").text(opts.caption);

  table.append("thead")
    .append("tr")
    .selectAll("th")
    .data(columns)
    .join("th")
      .attr("scope", "col")
      .attr("data-frequency-column", (column) => column)
      .each(function(column) {
        sfsGraphAppendTableHeader(this, headers[column] || column);
      });

  table.append("tbody")
    .selectAll("tr")
    .data(rows)
    .join("tr")
    .attr("data-frequency-key", (row) => row.key)
    .selectAll("td")
    .data((row) => columns.map((column) => ({ column, row })))
    .join("td")
      .attr("data-frequency-column", (d) => d.column)
      .text((d) => {
        if (d.column === "label") return sfsGraphIntervalLabel(d.row, formatter);
        if (d.column === "percent" || d.column === "cumulativePercent") return percentFormatter(d.row[d.column]);
        if (d.column === "proportion" || d.column === "cumulativeProportion") return d3.format(".3f")(d.row[d.column]);
        return formatter(d.row[d.column]);
      });

  const tableNode = table.node();
  tableNode.frequencyRows = rows;
  tableNode.frequencyColumns = columns.slice();
  return tableNode;
}

sfsGraphCloneWithComputedStyles = (svgNode) => {
  const clone = svgNode.cloneNode(true);
  const originalElements = [svgNode].concat(Array.from(svgNode.querySelectorAll("*")));
  const clonedElements = [clone].concat(Array.from(clone.querySelectorAll("*")));
  const properties = [
    "display",
    "fill",
    "fill-opacity",
    "font-family",
    "font-size",
    "font-weight",
    "opacity",
    "stroke",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-opacity",
    "stroke-width",
    "text-anchor",
    "vector-effect"
  ];

  originalElements.forEach((element, index) => {
    const computed = getComputedStyle(element);
    const computedStyle = properties
      .map((property) => `${property}:${computed.getPropertyValue(property)}`)
      .join(";");
    const existingStyle = clonedElements[index].getAttribute("style") || "";
    clonedElements[index].setAttribute("style", `${existingStyle};${computedStyle}`);
  });

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return clone;
}

graphSvgToDataUrl = async (svgNode, opts = {}) => {
  const serializer = new XMLSerializer();
  const exportNode = sfsGraphCloneWithComputedStyles(svgNode);
  const svgText = serializer.serializeToString(exportNode);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();
  const scale = sfsGraphValueOr(opts.scale, 2);
  const viewBox = svgNode.viewBox.baseVal;
  const width = sfsGraphValueOr(opts.width, viewBox && viewBox.width ? viewBox.width : svgNode.clientWidth || 640);
  const height = sfsGraphValueOr(opts.height, viewBox && viewBox.height ? viewBox.height : svgNode.clientHeight || 420);

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = svgUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (opts.background) {
    context.fillStyle = opts.background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(svgUrl);
  return canvas.toDataURL(opts.type || "image/png");
}

downloadGraph = async (svgNode, opts = {}) => {
  const format = opts.format || "svg";
  const fileName = opts.fileName || `frequency-graph.${format}`;
  const link = document.createElement("a");

  if (format === "png") {
    link.href = await graphSvgToDataUrl(svgNode, opts);
  } else {
    const serializer = new XMLSerializer();
    const exportNode = opts.inlineStyles === false ? svgNode : sfsGraphCloneWithComputedStyles(svgNode);
    const svgText = serializer.serializeToString(exportNode);
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    link.href = URL.createObjectURL(blob);
  }

  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

