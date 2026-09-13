// See resources/js/GRAPHS.md for module boundaries and compatibility.
sfsGraphRender = (opts = {}) => {
  const type = sfsGraphNormalizeType(opts.type || opts.graphType);
  if (type === "interval") return sfsGraphMakeInterval(opts);
  if (type === "bar") return sfsGraphMakeBarGraph(opts, type);
  if (type === "polygon") return sfsGraphMakePolygon(opts);
  if (type === "curve") return sfsGraphMakeCurve(opts);
  return sfsGraphMakeHistogram(opts, type);
}

makeGraph = (opts = {}) => {
  const node = sfsGraphRender(opts);
  if (opts.responsive === false || !node || node.tagName !== "svg") return node;
  sfsGraphObserveWidth(node, opts, sfsGraphRender);
  return node;
}

sfsGraphApi = (() => {
  const api = {
    makeGraph,
    makeToneIdentificationGraph,
    frequencyTable,
    makeFrequencyTable,
    graphSvgToDataUrl,
    downloadGraph
  };
  window.sfsGraphs = api;
  return api;
})()
