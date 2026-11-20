// Read-off guides: a dashed line up from the x axis to a line or curve, a
// marker where it meets it, and a dashed line across to the y axis, with the
// values picked out on the axes. Shared by the frequency polygon (Chapter 2)
// and the scatterplot (Chapter 18) so that reading a value off a graph looks
// and moves the same way wherever the book does it.
//
//   sfsReadGuides.draw(layer, guides, frame, options)
//     guides  [{ key, x, y, xLabel, yLabel, title }] in pixels; yLabel optional
//     frame   { left, bottom }: where the y and x axes are drawn, in pixels
//     options { color, collapsed, labelClass, xLabelOffset, yLabelOffset }
//   sfsReadGuides.trace(layer, frame, { duration, pause, ease, delay })
//     draws each guide up, then across, from the axis.
sfsReadGuides = (() => {
  const COLOR = "color-mix(in srgb, var(--sfs-danger-color, #c63f3f) 78%, var(--sfs-text, #212529))";
  const DASH = "6 4";
  const STROKE = 1.8;
  const RADIUS = 4;
  const TICK = 6;
  const TRACE = "sfs-read-guide";

  // A halo the color of the page lets a guide's value sit over the axis's
  // own tick label when the two are close.
  function halo(text) {
    return text
      .attr("paint-order", "stroke")
      .attr("stroke", "var(--sfs-bg, #fff)")
      .attr("stroke-width", 4)
      .attr("stroke-linejoin", "round");
  }

  function draw(layer, guides, frame, options = {}) {
    const color = options.color || COLOR;
    const collapsed = Boolean(options.collapsed);
    const labelClass = options.labelClass || "sfs-read-guide-label";
    const xLabelOffset = options.xLabelOffset ?? 21;
    const yLabelOffset = options.yLabelOffset ?? 10;

    const groups = layer.selectAll("g.sfs-read-guide")
      .data(guides, (d, i) => d.key ?? i)
      .join((enter) => {
        const g = enter.append("g").attr("class", "sfs-read-guide");
        ["vertical", "horizontal"].forEach((name) => g.append("line")
          .attr("class", `sfs-read-guide-line sfs-read-guide-${name}`)
          .attr("stroke-width", STROKE)
          .attr("stroke-dasharray", DASH)
          .attr("vector-effect", "non-scaling-stroke"));
        g.append("circle")
          .attr("class", "sfs-read-guide-marker")
          .attr("r", options.radius ?? RADIUS)
          .attr("fill", "var(--sfs-bg, #fff)")
          .attr("stroke-width", 2)
          .attr("vector-effect", "non-scaling-stroke");
        ["x", "y"].forEach((axis) => g.append("line")
          .attr("class", `sfs-read-guide-tick sfs-read-guide-tick-${axis}`)
          .attr("stroke-width", STROKE)
          .attr("vector-effect", "non-scaling-stroke"));
        ["x", "y"].forEach((axis) => halo(g.append("text")
          .attr("class", `${labelClass} sfs-read-guide-value sfs-read-guide-value-${axis}`)
          .attr("font-weight", 700)));
        g.append("title");
        return g;
      });

    groups.selectAll("*").interrupt(TRACE);
    groups.select(".sfs-read-guide-vertical")
      .attr("stroke", color)
      .attr("x1", (d) => d.x).attr("x2", (d) => d.x)
      .attr("y1", frame.bottom)
      .attr("y2", (d) => collapsed ? frame.bottom : d.y);
    groups.select(".sfs-read-guide-horizontal")
      .attr("stroke", color)
      .attr("y1", (d) => d.y).attr("y2", (d) => d.y)
      .attr("x1", (d) => d.x)
      .attr("x2", (d) => collapsed ? d.x : frame.left);
    groups.select(".sfs-read-guide-marker")
      .attr("stroke", color)
      .attr("cx", (d) => d.x).attr("cy", (d) => d.y)
      .style("opacity", collapsed ? 0 : 1);
    groups.select(".sfs-read-guide-tick-x")
      .attr("stroke", color)
      .attr("x1", (d) => d.x).attr("x2", (d) => d.x)
      .attr("y1", frame.bottom).attr("y2", frame.bottom + TICK);
    groups.select(".sfs-read-guide-tick-y")
      .attr("stroke", color)
      .attr("x1", frame.left - TICK).attr("x2", frame.left)
      .attr("y1", (d) => d.y).attr("y2", (d) => d.y)
      .style("display", (d) => d.yLabel === undefined ? "none" : null)
      .style("opacity", collapsed ? 0 : 1);
    groups.select(".sfs-read-guide-value-x")
      .attr("x", (d) => d.x)
      .attr("y", frame.bottom + xLabelOffset)
      .attr("text-anchor", "middle")
      .style("fill", color)
      .text((d) => d.xLabel ?? "");
    groups.select(".sfs-read-guide-value-y")
      .attr("x", frame.left - yLabelOffset)
      .attr("y", (d) => d.y)
      .attr("dy", "0.32em")
      .attr("text-anchor", "end")
      .style("fill", color)
      .style("display", (d) => d.yLabel === undefined ? "none" : null)
      .style("opacity", collapsed ? 0 : 1)
      .text((d) => d.yLabel ?? "");
    groups.select("title").text((d) => d.title || "");
    return groups;
  }

  // Up from the x axis to the marker, then across to the y axis, where the
  // value appears as the line arrives.
  function trace(layer, frame, timing = {}) {
    const duration = timing.duration ?? 650;
    const pause = timing.pause ?? 100;
    const ease = timing.ease || d3.easeCubicInOut;
    const delay = timing.delay ?? 0;
    const groups = layer.selectAll("g.sfs-read-guide");

    groups.select(".sfs-read-guide-vertical").interrupt(TRACE)
      .attr("y2", frame.bottom)
      .transition(TRACE).delay(delay).duration(duration).ease(ease)
      .attr("y2", (d) => d.y);
    groups.select(".sfs-read-guide-marker").interrupt(TRACE)
      .style("opacity", 0)
      .transition(TRACE).delay(delay + Math.max(0, duration - 80)).duration(120)
      .style("opacity", 1);
    groups.select(".sfs-read-guide-horizontal").interrupt(TRACE)
      .attr("x2", (d) => d.x)
      .transition(TRACE).delay(delay + duration + pause).duration(duration).ease(ease)
      .attr("x2", frame.left);
    groups.selectAll(".sfs-read-guide-tick-y, .sfs-read-guide-value-y").interrupt(TRACE)
      .style("opacity", 0)
      .transition(TRACE).delay(delay + 2 * duration + pause - 80).duration(160)
      .style("opacity", 1);
  }

  return { COLOR, draw, trace };
})();
