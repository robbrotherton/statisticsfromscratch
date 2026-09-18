(function(global) {
  "use strict";
  const stats = global.sfsStats;
  const cdf = x => stats.normalCdf(x, 0, 1);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function decision(alpha, tail, z) {
    const critical = stats.normalInv(1 - alpha / (tail === "two" ? 2 : 1));
    const low = tail === "right" ? -Infinity : -critical;
    const high = tail === "left" ? Infinity : critical;
    const p = tail === "two" ? 2 * cdf(-Math.abs(z)) : tail === "left" ? cdf(z) : cdf(-z);
    return { alpha, tail, z, low, high, p, reject: z < low || z > high };
  }
  function overlap(d) { return 2 * cdf(-Math.abs(d) / 2); }
  global.sfsNormalComparisons = { decision, overlap };

  function scaffold(kind, domain) {
    const root = d3.create("div").attr("class", "normal-comparison sfs-figure");
    root.append("style").text(`
      .normal-comparison .nc-controls {--sfs-action-gap:.8rem 1.4rem;padding:.6rem 0}
      .normal-comparison input[type=range] {width:10rem;max-width:100%}
      .normal-comparison select {font:inherit;min-height:var(--sfs-button-min-height);color:var(--sfs-text);background:var(--sfs-bg);border:1px solid var(--sfs-border);border-radius:var(--sfs-radius-sm);padding:.3rem .55rem}
      .normal-comparison .nc-readout {min-height:4.5em;font-variant-numeric:tabular-nums;margin:.4rem 0}
      .normal-comparison .nc-legend {font-size:.9rem;margin:0}
      .normal-comparison .nc-examples {width:100%;font-size:.9rem}
      .normal-comparison .nc-examples th,.normal-comparison .nc-examples td {padding:.4rem;text-align:left}
      .normal-comparison button[aria-pressed=true] {border-color:var(--sfs-power-color,#7654b5);box-shadow:inset 3px 0 var(--sfs-power-color,#7654b5)}
      @media(max-width:500px) {.normal-comparison .nc-examples {font-size:.8rem}.normal-comparison .nc-examples th,.normal-comparison .nc-examples td {padding:.2rem}}
    `);
    const controls = root.append("div").attr("class", "nc-controls sfs-control-panel sfs-action-row");
    const graph = global.makeDistributionGraph({
      distribution: "normal", xDomain: domain, yDomain: [0, .46],
      style: "minimal", xAxis: true, yLabel: false, legend: false, animate: false, aspectRatio: 2.1,
      xTicks: 5, color: "var(--sfs-null-color, currentColor)",
      labels: { x: kind === "alpha" ? "Sample z score under H₀" : "Individual score (SD units)" },
      cssMargin: "0"
    });
    root.node().appendChild(graph);
    const legend = root.append("p").attr("class", "nc-legend");
    const readout = root.append("p").attr("class", "nc-readout sfs-readout").attr("aria-live", "polite").attr("aria-atomic", "true");
    function slider(label, key, value, min, max, step, onChange) {
      const row = controls.append("label").attr("class", "sfs-check-row"); row.append("span").text(label);
      const input = row.append("input").attr("type","range").attr("name",key).attr("min",min).attr("max",max).attr("step",step).property("value",value).attr("data-prevent-swipe","");
      input.on("input", function(event) {event.stopPropagation(); onChange(+this.value);});
      return input;
    }
    let plotOptions = {};
    function plot(options) { plotOptions = options; }
    function publish(value, text) {
      root.node().value = value; readout.text(text);
      graph.update(Object.assign({}, plotOptions, {ariaLabel: text}));
      root.node().dispatchEvent(new Event("input", {bubbles:true}));
    }
    function wrap(action) {
      global.interactiveFigure.wrap({root:root.node(), controls:controls.node(), label:kind === "alpha" ? "alpha and test direction controls" : "effect size controls", placement:"callout", startOpen:true, applyAction:(values,context)=>{if(context && context.setControlsOpen) context.setControlsOpen(Boolean(values["controls-open"])); action(values);}});
    }
    return {root,controls,plot,legend,slider,publish,wrap};
  }

  global.makeAlphaTutorial = function() {
    const chart = scaffold("alpha", [-4,4]);
    let alpha = .05, tail = "two", z = -1.8;
    const a = chart.slider("Alpha (α)","alpha",alpha,.001,.1,.001,v => {alpha=v;draw();});
    const row = chart.controls.append("label").attr("class", "sfs-check-row"); row.append("span").text("Test direction");
    const select = row.append("select").attr("name","tail");
    [["two","Two-tailed"],["left","Lower tail"],["right","Upper tail"]].forEach(([v,t]) => select.append("option").attr("value",v).text(t));
    select.on("change",function(event){event.stopPropagation();tail=this.value;draw();});
    const observed = chart.slider("Observed z","z",z,-3.5,3.5,.01,v=>{z=v;draw();});
    chart.legend.text("Shaded tails: reject H₀. Unshaded region: fail to reject H₀. Dotted line: observed z.");
    function draw() {
      const value = decision(alpha,tail,z);
      chart.plot({
        shade: { tail, alpha, opacity: .35 },
        markers: [
          ...[value.low,value.high].filter(Number.isFinite).map(at => ({
            at, height: .85, color: "var(--sfs-critical-color, #c63f3f)", dash: ""
          })),
          { at: z, height: 1, color: "currentColor", dash: "3 3",
            label: `z = ${z.toFixed(2)}`, labelAnchor: z < -2.8 ? "start" : z > 2.8 ? "end" : "middle" }
        ]
      });
      a.property("value",alpha); select.property("value",tail); observed.property("value",z);
      const limits = [value.low,value.high].filter(Number.isFinite).map(v=>v.toFixed(2)).join(" and ");
      chart.publish(value,`α = ${alpha.toFixed(3)} · Critical z: ${limits}. Observed z = ${z.toFixed(2)}, p = ${value.p.toFixed(4)}: ${value.reject ? "reject" : "fail to reject"} H₀.`);
    }
    draw(); chart.wrap(action => {alpha=clamp(Number(action.alpha ?? alpha),.001,.1); z=clamp(Number(action.z ?? z),-3.5,3.5);tail=["two","left","right"].includes(action.tail)?action.tail:tail;draw();});
    return chart.root.node();
  };

  global.makeEffectSizeTutorial = function(opts = {}) {
    const chart = scaffold("effect",[-4,6]);
    let d = opts.d ?? .2, showOverlap = opts.overlap ?? false;
    const slider = chart.slider("Cohen’s d","d",d,0,2.5,.01,v=>{d=v;draw();});
    const row = chart.controls.append("label").attr("class", "sfs-check-row");
    const check = row.append("input").attr("type","checkbox").property("checked",showOverlap).on("change",function(event){event.stopPropagation();showOverlap=this.checked;draw();});
    row.append("span").text("Shade overlap");
    chart.legend.text("Solid curve: reference population. Dashed curve: comparison population. Both show individual scores, with the same SD.");
    let buttons;
    if (opts.examples) {
      const table = chart.root.append("table").attr("class","nc-examples");
      table.append("caption").text("Select an example to picture its effect size.");
      const head = table.append("thead").append("tr"); ["Grouping variable","Outcome","d","n per group"].forEach(t=>head.append("th").attr("scope","col").text(t));
      const rows = table.append("tbody").selectAll("tr").data(opts.examples).join("tr");
      rows.append("td").text(e=>e.group);
      buttons = rows.append("td").append("button").attr("class","sfs-button").attr("type","button").text(e=>e.label).on("click",(event,e)=>{d=e.d;showOverlap=true;draw();});
      rows.append("td").text(e=>e.d.toFixed(2));
      rows.append("td").text(e=>e.n);
      rows.on("click",(event,e)=>{if(event.target.tagName!=="BUTTON"){d=e.d;showOverlap=true;draw();}});
    }
    function draw() {
      chart.plot({
        distributions: [
          { mean: 0, color: "var(--sfs-null-color, currentColor)" },
          { mean: d, color: "var(--sfs-power-color, #7654b5)", dashed: true }
        ],
        shade: showOverlap ? { kind: "overlap", opacity: .4 } : [],
        markers: [0,d].map(at => ({at, height: .9, color: "currentColor", dash: "2 4"})),
        intervals: [{from: 0, to: d, height: 1, arrows: false}],
        title: `Means ${d.toFixed(2)} SD apart`
      });
      slider.property("value",d); check.property("checked",showOverlap);
      if(buttons) buttons.attr("aria-pressed",e=>String(Math.abs(e.d-d)<.0001));
      const value = {d, overlap:overlap(d), showOverlap};
      chart.publish(value,`d = ${d.toFixed(2)}.${showOverlap ? ` Shared area: ${(100*value.overlap).toFixed(1)}% of the area under either curve.` : " Move the slider to change the distance between the means."}`);
    }
    draw(); chart.wrap(action=>{d=clamp(Number(action.d ?? d),0,2.5);showOverlap=action.overlap ?? showOverlap;draw();});
    return chart.root.node();
  };
})(window);
