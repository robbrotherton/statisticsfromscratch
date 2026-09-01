// Chapter 5: the reader's own reaction time, carried from the quiz where they
// enter it into the quiz where they standardize it.
//
// No new plumbing is needed for that hand-off. quiz.js already writes every
// checked response to localStorage under statisticsfromscratch.quizResponses, keyed
// quizId:questionId, so both mounts of this factory read that saved response
// back and re-render whenever a quiz on the page changes state.
//
// Reuses makeStandardizedScoreGraph (standardization-ruler.js) for the aligned
// millisecond and z-score rulers rather than duplicating axis logic.
(function(global) {
  "use strict";

  const RESPONSE_STORE = "statisticsfromscratch.quizResponses";
  const DEFAULT_QUIZ_ID = "05_z_scores_reaction_time_raw";
  const DEFAULT_QUESTION_ID = "reaction_time_ms";
  let stylesReady = false;

  function ensureStyles() {
    if (stylesReady) return;
    stylesReady = true;

    const style = document.createElement("style");
    style.textContent = `
      .reaction-time-zscore .rtz-empty {
        margin: 0;
        color: var(--bc-muted);
        font-size: var(--bc-figure-note-size, 0.8125rem);
      }

      .reaction-time-zscore .rtz-recap {
        gap: 0.35rem 1.15rem;
      }

      .reaction-time-zscore .rtz-stat {
        display: inline-flex;
        align-items: baseline;
        gap: 0.3rem;
        min-width: 0;
      }

      .reaction-time-zscore .rtz-equation {
        margin: 0 0 0.6rem;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  // The reader may type "250", "250 ms", or "about 250"; take the first number.
  function savedScore(quizId, questionId) {
    let responses = null;
    try {
      responses = JSON.parse(global.localStorage.getItem(RESPONSE_STORE));
    } catch (error) {
      return NaN;
    }

    const saved = responses && responses[quizId + ":" + questionId];
    if (!saved) return NaN;
    const match = String(saved.response ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  // Whole z-score ticks, always including 0 and always wide enough to hold the
  // reader's own score with a standard deviation of clear space beyond it, so a
  // very slow or very fast average still lands inside the plot with a readable
  // label. Widening the rulers coarsens the tick step rather than crowding them.
  function rulerTicks(z) {
    let lowest = -3;
    let highest = 3;
    if (Number.isFinite(z)) {
      lowest = Math.min(lowest, Math.floor(z) - 1);
      highest = Math.max(highest, Math.ceil(z) + 1);
    }

    const step = Math.max(1, Math.ceil((highest - lowest) / 7));
    const ticks = [];
    for (let tick = Math.ceil(lowest / step) * step; tick <= highest; tick += step) {
      ticks.push(tick);
    }
    return { lowest, highest, ticks };
  }

  function inlineMath() {
    const api = global.interactiveFigure;
    if (api && typeof api.inlineMath === "function") {
      return api.inlineMath.apply(api, arguments);
    }

    const span = document.createElement("span");
    span.className = "math inline";
    span.textContent = Array.prototype.slice.call(arguments).join(" ");
    return span;
  }

  global.makeReactionTimeZScore = function(opts) {
    opts = opts || {};
    ensureStyles();

    const api = global.interactiveFigure;
    if (api && typeof api.ensureStyles === "function") api.ensureStyles();
    if (typeof global.makeStandardizedScoreGraph !== "function") {
      throw new Error("Reaction-time z-scores require the aligned-axis component.");
    }

    const mode = opts.mode === "recap" ? "recap" : "solution";
    const mean = Number.isFinite(Number(opts.mean)) ? Number(opts.mean) : 284;
    const sd = Number.isFinite(Number(opts.sd)) ? Number(opts.sd) : 50;
    const quizId = opts.quizId || DEFAULT_QUIZ_ID;
    const questionId = opts.questionId || DEFAULT_QUESTION_ID;
    const format = d3.format(".2f");

    const root = d3.create("div")
      .attr("class", "reaction-time-zscore rtz-" + mode + " bc-figure");
    const empty = root.append("p").attr("class", "rtz-empty");
    const content = root.append("div").attr("class", "rtz-content");

    let firstDraw = true;
    let pendingFrame = null;

    function disposeChart() {
      const previous = content.node().querySelector(".standardized-score-graph");
      if (previous && previous.bcInteractive &&
          typeof previous.bcInteractive.dispose === "function") {
        previous.bcInteractive.dispose();
      }
    }

    function appendStat(row, symbol, value) {
      const stat = row.append("span").attr("class", "rtz-stat");
      stat.append("span")
        .attr("class", "bc-readout-label")
        .node()
        .appendChild(inlineMath(symbol));
      stat.append("span").attr("class", "bc-readout-value").text(value);
    }

    function renderRecap(x) {
      const row = content.append("div").attr("class", "rtz-recap bc-readout-row");
      appendStat(row, "X", x + " ms");
      appendStat(row, "\\mu", mean + " ms");
      appendStat(row, "\\sigma", sd + " ms");
    }

    function renderSolution(x, z) {
      content.append("div")
        .attr("class", "rtz-equation")
        .node()
        .appendChild(inlineMath(
          "\\displaystyle z = \\frac{X - \\mu}{\\sigma}",
          "= \\frac{" + x + " - " + mean + "}{" + sd + "}",
          "= " + format(z)
        ));

      const ruler = rulerTicks(z);
      const chartWrap = content.append("div")
        .attr("class", "rtz-chart-wrap bc-chart-wrap");
      chartWrap.node().appendChild(global.makeStandardizedScoreGraph({
        title: opts.title === undefined ? "Reaction times (ms)" : opts.title,
        mean: mean,
        sd: sd,
        xDomain: [mean + ruler.lowest * sd, mean + ruler.highest * sd],
        xTickValues: ruler.ticks.map(function(tick) { return mean + tick * sd; }),
        zTickValues: ruler.ticks,
        rawAxisSideLabel: "(X)",
        animate: opts.animate !== false && firstDraw,
        markers: {
          at: x,
          label: `X = ${x}`,
          height: 0.5,
          color: "var(--bc-danger-color, #c63f3f)",
          dash: "6 4",
          strokeWidth: 2.6
        },
        ariaLabel: "Normal curve of reaction times with population mean " + mean +
          " milliseconds and standard deviation " + sd + " milliseconds. A millisecond " +
          "ruler is aligned directly above a z-score ruler, and a dashed line marks your " +
          "own average of " + x + " milliseconds at z = " + format(z) + "."
      }));
    }

    function render() {
      const x = savedScore(quizId, questionId);
      const z = Number.isFinite(x) ? (x - mean) / sd : NaN;

      disposeChart();
      content.selectAll("*").remove();

      if (Number.isFinite(x)) {
        empty.attr("hidden", "").text("");
        if (mode === "recap") renderRecap(x);
        else renderSolution(x, z);
        firstDraw = false;
      } else {
        empty.attr("hidden", null).text(
          mode === "recap"
            ? "Answer the reaction-time question earlier in the chapter and your own average will appear here."
            : "Answer the reaction-time question earlier in the chapter and your own calculation will appear here."
        );
      }

      root.node().value = { x: x, z: z, mean: mean, sd: sd };
      root.node().dispatchEvent(new Event("input", { bubbles: true }));
    }

    // quiz.js announces the state change before it writes the new response to
    // storage, and before it clears an old one, so re-read on the next frame.
    function scheduleRender() {
      if (pendingFrame !== null) return;
      pendingFrame = global.requestAnimationFrame(function() {
        pendingFrame = null;
        render();
      });
    }

    document.addEventListener("quiz-state-change", scheduleRender);
    render();

    if (api && typeof api.adopt === "function") {
      api.adopt(root.node(), {
        dispose: function() {
          document.removeEventListener("quiz-state-change", scheduleRender);
          if (pendingFrame !== null) global.cancelAnimationFrame(pendingFrame);
          disposeChart();
        }
      });
    }

    return root.node();
  };
}(window));
