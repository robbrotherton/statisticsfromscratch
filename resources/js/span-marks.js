// A horizontal span with flat end caps: the book's mark for a standard
// deviation, or any other "this far either side" distance, drawn along an
// axis. One implementation so the mark looks and moves the same wherever it
// appears: the Chapter 4 height demo, distribution-generator intervals with
// caps, and the score rows of Chapters 12 and 13.
//
// The span is a group holding one .sfs-span-line and two .sfs-span-cap
// lines. Color and stroke width come from the caller (set on the group or
// its lines); the shared styles only fix the line ends and scaling.
(function() {
  "use strict";

  const CAP_HEIGHT = 14;
  const STROKE_WIDTH = 2.2;

  function ensureStyles() {
    if (typeof document === "undefined" || document.getElementById("sfs-span-mark-styles")) return;
    const style = document.createElement("style");
    style.id = "sfs-span-mark-styles";
    style.textContent = `
      .sfs-span-line,
      .sfs-span-cap {
        fill: none;
        stroke-linecap: round;
        vector-effect: non-scaling-stroke;
      }
    `;
    document.head.appendChild(style);
  }

  // Adds the span's three lines to an existing group and returns the group.
  function append(group) {
    ensureStyles();
    group.append("line").attr("class", "sfs-span-line");
    group.append("line").attr("class", "sfs-span-cap");
    group.append("line").attr("class", "sfs-span-cap");
    return group;
  }

  // Moves the span to run from x1 to x2 at height y. `transition`, if given,
  // turns a selection into a transition (for example
  // (s) => s.transition().duration(450)), so the move animates. Returns the
  // main line's selection or transition.
  function set(group, x1, x2, y, options) {
    options = options || {};
    const capHeight = Number.isFinite(options.capHeight) ? options.capHeight : CAP_HEIGHT;
    const animate = typeof options.transition === "function" ? options.transition : (selection) => selection;
    const main = animate(group.select(".sfs-span-line").interrupt())
      .attr("x1", x1).attr("x2", x2)
      .attr("y1", y).attr("y2", y);
    animate(group.selectAll(".sfs-span-cap").data([x1, x2]).interrupt())
      .attr("x1", (d) => d).attr("x2", (d) => d)
      .attr("y1", y - capHeight / 2).attr("y2", y + capHeight / 2);
    return main;
  }

  // Collapses the span to centerX, then grows it out to x1 and x2. Returns
  // the main line's transition so callers can chain further moves.
  function grow(group, centerX, x1, x2, y, options) {
    options = options || {};
    set(group, centerX, centerX, y, { capHeight: options.capHeight });
    const timing = (selection) => selection.transition()
      .delay(options.delay || 0)
      .duration(Number.isFinite(options.duration) ? options.duration : 460)
      .ease(options.ease || d3.easeCubicOut);
    return set(group, x1, x2, y, { capHeight: options.capHeight, transition: timing });
  }

  window.sfsSpanMarks = { CAP_HEIGHT, STROKE_WIDTH, append, set, grow, ensureStyles };
})();
