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
    // Redraws an in-between animation frame without announcing a new readout.
    function preview(options) { graph.update(options); }
    function publish(value, text) {
      root.node().value = value; readout.text(text);
      graph.update(Object.assign({}, plotOptions, {ariaLabel: text}));
      root.node().dispatchEvent(new Event("input", {bubbles:true}));
    }
    function wrap(action) {
      global.interactiveFigure.wrap({root:root.node(), controls:controls.node(), label:kind === "alpha" ? "alpha and test direction controls" : "effect size controls", placement:"callout", startOpen:true, applyAction:(values,context)=>{if(context && context.setControlsOpen) context.setControlsOpen(Boolean(values["controls-open"])); action(values);}});
    }
    return {root,controls,plot,preview,legend,slider,publish,wrap};
  }

  global.makeAlphaTutorial = function() {
    const chart = scaffold("alpha", [-4,4]);
    let alpha = .05, tail = "two", z = -1.8, showZ = true;
    // `shown` is the scene currently on screen, which may be mid-tween.
    let shown = null, tween = null, ready = false;
    const a = chart.slider("Alpha (α)","alpha",alpha,.001,.1,.001,v => {alpha=v;draw();});
    const row = chart.controls.append("label").attr("class", "sfs-check-row"); row.append("span").text("Test direction");
    const select = row.append("select").attr("name","tail");
    [["two","Two-tailed"],["left","Lower tail"],["right","Upper tail"]].forEach(([v,t]) => select.append("option").attr("value",v).text(t));
    select.on("change",function(event){event.stopPropagation();tail=this.value;draw();});
    const observed = chart.slider("Observed z","z",z,-3.5,3.5,.01,v=>{z=v;showZ=true;draw();});
    // The tutorial steps explain the shading, so this figure skips the legend
    // and needs less reserved space for its shorter readout.
    chart.legend.remove();
    chart.root.select(".nc-readout").style("min-height", "3em");
    // A scene is what the graph shows: the tail, the critical magnitude, the
    // observed z, and the opacities of the critical regions and the z marker.
    // Tutorial steps tween between scenes; sliders jump straight to one.
    function target() {
      return { tail, crit: stats.normalInv(1 - alpha / (tail === "two" ? 2 : 1)), z, zOpacity: showZ ? 1 : 0, regionOpacity: 1 };
    }
    function sceneOptions(s) {
      const low = s.tail === "right" ? -Infinity : -s.crit;
      const high = s.tail === "left" ? Infinity : s.crit;
      return {
        shade: [
          ...(Number.isFinite(low) ? [{ to: low, opacity: .35 * s.regionOpacity }] : []),
          ...(Number.isFinite(high) ? [{ from: high, opacity: .35 * s.regionOpacity }] : [])
        ],
        markers: [
          ...[low,high].filter(Number.isFinite).map(at => ({
            at, height: .85, color: "var(--sfs-critical-color, #c63f3f)", dash: "", opacity: .95 * s.regionOpacity
          })),
          ...(s.zOpacity > 0 ? [{ at: s.z, height: 1, color: "currentColor", dash: "3 3", opacity: .95 * s.zOpacity,
            label: `z = ${s.z.toFixed(2)}`, labelAnchor: s.z < -2.8 ? "start" : s.z > 2.8 ? "end" : "middle" }] : [])
        ]
      };
    }
    function stopTween() { if (tween) { tween.stop(); tween = null; } }
    function tweenScene(from, to, duration, done) {
      const lerp = (x, y, t) => x + (y - x) * t;
      tween = d3.timer(elapsed => {
        const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
        shown = { tail: to.tail, crit: lerp(from.crit, to.crit, t), z: lerp(from.z, to.z, t),
          zOpacity: lerp(from.zOpacity, to.zOpacity, t), regionOpacity: lerp(from.regionOpacity, to.regionOpacity, t) };
        chart.preview(sceneOptions(shown));
        if (elapsed >= duration) { stopTween(); done(); }
      });
    }
    function animateTo() {
      const next = target();
      const from = Object.assign({}, shown);
      // A hidden marker appears (or disappears) in place rather than sliding.
      if (from.zOpacity === 0) from.z = next.z;
      const to = Object.assign({}, next, next.zOpacity === 0 ? { z: from.z } : {});
      a.property("value",alpha); select.property("value",tail); observed.property("value",z);
      if (from.tail === to.tail) { tweenScene(from, to, 700, draw); return; }
      // Switching tails: fade the old critical regions out, then the new ones in.
      tweenScene(from, Object.assign({}, from, { z: to.z, zOpacity: to.zOpacity, regionOpacity: 0 }), 350, () =>
        tweenScene(Object.assign({}, to, { regionOpacity: 0 }), to, 350, draw));
    }
    function draw() {
      stopTween();
      const value = decision(alpha,tail,z);
      shown = target();
      chart.plot(sceneOptions(shown));
      a.property("value",alpha); select.property("value",tail); observed.property("value",z);
      const fmt = v => v.toFixed(2).replace("-", "−");
      const limits = [value.low,value.high].filter(Number.isFinite).map(fmt).join(" and ");
      const result = showZ ? ` Observed z = ${fmt(z)}, p = ${value.p.toFixed(4)}: ${value.reject ? "reject" : "fail to reject"} H₀.` : "";
      chart.publish(value,`α = ${alpha.toFixed(3)} · Critical z: ${limits}.${result}`);
    }
    draw(); chart.wrap(action => {
      stopTween();
      alpha=clamp(Number(action.alpha ?? alpha),.001,.1); z=clamp(Number(action.z ?? z),-3.5,3.5);tail=["two","left","right"].includes(action.tail)?action.tail:tail;showZ=action.observed !== false;
      // The first action sets the opening scene, so it never animates. The
      // runtime already sends animate: false for reduced motion.
      if (ready && action.animate !== false) animateTo(); else draw();
      ready = true;
    });
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
