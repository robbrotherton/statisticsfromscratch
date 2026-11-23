// Tap-or-hover working for static markdown tables.
//
// Wrap a markdown table in a div with the class `sfs-explain-table` and a
// `data-explain` JSON spec. filters/responsive-tables.lua stamps each cell
// with its source text (`data-src`), so the script reads values without
// depending on how MathJax rendered them.
//
// Spec:
//   keys     one short name per column, left to right.
//   exact    optional { key: [TeX per data row] } used in place of the
//            rounded cell, so the working shows -\frac{1}{3}, not -0.33.
//   cells    { key: { lead, calc } } for data cells. `calc` is TeX with
//            {key} placeholders for the same row's values. The popup shows
//            lead = calc = the cell's own value.
//   refs     optional { name: [summary row, key] }, so a formula can use a
//            summary value, such as {MZ} for the mean in row 0 of column Z.
//            That cell is highlighted too.
//   summary  one object per summary row, { key: { lead, sum | mean } }.
//            `sum` is a per-row term template added up over the data rows;
//            `mean` is the same, divided by the number of rows.
//
// While a popup is open, the cells it draws on are highlighted.
(function () {
  "use strict";

  const TERMS_PER_LINE = 4;

  const clean = text => String(text).replace(/−/g, "-").trim();
  const resultOf = cell => clean(cell.dataset.src || cell.textContent).split("=").pop().trim();

  // Placeholders in a template, in order, as column keys. Only names in
  // `keys` count, so TeX groups such as \frac{1}{3} are left alone.
  const keysIn = (template, keys) =>
    Array.from(template.matchAll(/\{(\w+)\}/g), m => m[1]).filter(k => keys.includes(k));

  // Fill a template for one data row. A negative value gets parentheses
  // unless the template already opens one right before it or it comes first.
  function fill(template, valueOf, keys) {
    return template.replace(/\{(\w+)\}/g, (match, key, offset) => {
      if (!keys.includes(key)) return match;
      const value = valueOf(key);
      const before = template.slice(0, offset).trimEnd();
      const wrap = value.startsWith("-") && before !== "" && !before.endsWith("(");
      return wrap ? "(" + value + ")" : value;
    });
  }

  // Join terms with + or -, so a negative term reads "- 2.5", not "+ -2.5".
  // `lead` says whether the first term starts a line or follows another.
  const joinTerms = (terms, lead) => terms.map((term, i) => {
    const negative = term.startsWith("-");
    const body = negative ? term.slice(1) : term;
    if (i === 0 && !lead) return term;
    return (negative ? "- " : "+ ") + body;
  }).join(" ");

  // True when every term is a plain (rounded) number and they don't add up
  // to the shown total, as when 0.44 + ... + 1.78 = 6.66 but the cell shows
  // the exact sum, 6.67. The popup then says "approximately".
  function roundedSumDiffers(terms, result) {
    const number = /^-?\d*\.?\d+$/;
    if (!terms.every(t => number.test(t)) || !number.test(result)) return false;
    // Compare at the precision of the most precise number shown.
    const places = Math.max(...terms.concat(result).map(t => (t.split(".")[1] || "").length));
    const total = terms.reduce((sum, t) => sum + Number(t), 0);
    return Math.abs(total - Number(result)) > 0.5 * 10 ** -places;
  }

  // Split a long sum over several lines of an aligned block.
  function chunk(terms) {
    const lines = [];
    for (let i = 0; i < terms.length; i += TERMS_PER_LINE) {
      lines.push(joinTerms(terms.slice(i, i + TERMS_PER_LINE), i > 0));
    }
    return lines;
  }

  function buildTable(wrapper) {
    let spec;
    try {
      spec = JSON.parse(wrapper.dataset.explain);
    } catch (error) {
      console.warn("explain-table: bad data-explain JSON", error);
      return;
    }
    const table = wrapper.querySelector("table");
    if (!table || !table.tBodies.length) return;
    const rows = Array.from(table.tBodies[0].rows);
    const dataRows = rows.filter(r => !r.classList.contains("sfs-table-summary-row"));
    const summaryRows = rows.filter(r => r.classList.contains("sfs-table-summary-row"));
    const column = key => spec.keys.indexOf(key);
    const refs = spec.refs || {};
    const refCell = name => summaryRows[refs[name][0]] && summaryRows[refs[name][0]].cells[column(refs[name][1])];
    const names = spec.keys.concat(Object.keys(refs));
    // A column key reads the same row; a ref name reads its summary cell.
    const cellAt = (row, key) => (key in refs ? refCell(key) : row.cells[column(key)]);

    const valueOf = rowIndex => key => {
      if (key in refs) return resultOf(refCell(key));
      const exact = spec.exact && spec.exact[key];
      return exact ? exact[rowIndex] : clean(cellAt(dataRows[rowIndex], key).dataset.src);
    };

    const attach = (cell, tex, sources) => {
      cell.classList.add("sfs-explain-cell");
      cell.tabIndex = 0;
      const pop = document.createElement("div");
      pop.className = "sfs-explain-pop";
      pop.textContent = "\\[" + tex + "\\]";
      let typeset = false;
      window.tippy(cell, {
        content: pop,
        theme: "quarto",
        arrow: false,
        delay: [80, 0],
        maxWidth: "none",
        placement: "bottom",
        appendTo: () => document.body,
        popperOptions: {
          modifiers: [{ name: "preventOverflow", options: { boundary: "viewport", padding: 8 } }]
        },
        onMount(instance) {
          // Typeset on first open, then reposition: the rendered math is a
          // different size from the TeX source it replaces.
          if (!typeset && window.MathJax && window.MathJax.typesetPromise) {
            typeset = true;
            window.MathJax.typesetPromise([pop]).then(() => {
              if (instance.popperInstance) instance.popperInstance.update();
            });
          }
        },
        onShow() {
          cell.classList.add("sfs-explain-target");
          sources.forEach(s => s && s.classList.add("sfs-explain-source"));
        },
        onHide() {
          cell.classList.remove("sfs-explain-target");
          sources.forEach(s => s && s.classList.remove("sfs-explain-source"));
        }
      });
    };

    // Data cells.
    Object.entries(spec.cells || {}).forEach(([key, rule]) => {
      dataRows.forEach((row, i) => {
        const cell = cellAt(row, key);
        if (!cell) return;
        const parts = [rule.lead, fill(rule.calc, valueOf(i), names), resultOf(cell)].filter(Boolean);
        const sources = keysIn(rule.calc, names).map(k => cellAt(row, k));
        attach(cell, parts.join(" = "), sources);
      });
    });

    // Summary cells.
    (spec.summary || []).forEach((rules, s) => {
      const row = summaryRows[s];
      if (!row) return;
      Object.entries(rules).forEach(([key, rule]) => {
        const cell = cellAt(row, key);
        if (!cell) return;
        const template = rule.sum || rule.mean;
        const terms = dataRows.map((r, i) => fill(template, valueOf(i), names));
        const sources = Array.from(new Set(dataRows.flatMap(r => keysIn(template, names).map(k => cellAt(r, k)))));
        const result = resultOf(cell);
        let tex;
        if (rule.mean) {
          tex = rule.lead + " = \\frac{" + joinTerms(terms, false) + "}{" + terms.length + "} = " + result;
        } else {
          const lines = chunk(terms);
          const relation = roundedSumDiffers(terms, result) ? "\\approx" : "=";
          tex = "\\begin{aligned} " + rule.lead + " &= " + lines.join(" \\\\ &\\quad ") +
            " \\\\ &" + relation + " " + result + " \\end{aligned}";
        }
        attach(cell, tex, sources);
      });
    });
  }

  function init() {
    if (typeof window.tippy !== "function") return;
    document.querySelectorAll(".sfs-explain-table").forEach(buildTable);
  }

  window.sfsExplainTable = { fill, chunk, joinTerms, roundedSumDiffers };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
