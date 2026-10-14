// The scores as chips, in the order entered or sorted either way; a sort
// slides each chip to its new place. The Data Explorer's "The scores"
// section, and a plain listing of a chapter's data.
//
// makeDataDisplay(options)
//   values    the scores, for a fixed listing (a chapter's data)
//   columns   or [{ name, values }], one named row of chips per group
//   owner     or the id of a Data Explorer data panel to follow instead, so
//             a change of data keeps the chosen order (default when neither
//             values nor columns is given: "dataExplorer")
//   order     initial "entered" (default) | "ascending" | "descending"
//   controls  false hides the sort buttons (a static listing)
//   count     false hides the "n scores" label
//
//   With several columns (groups, conditions) each column is its own named
//   row of chips, sorted on its own. Text comes from the Data Explorer's
//   strings module when it is loaded (data-explorer-strings.js, dataDisplay).
(function(global) {
  "use strict";

  const STYLE_ID = "data-display-styles";
  const ORDERS = ["entered", "ascending", "descending"];

  function strings() {
    const all = global.sfsDataExplorerStrings;
    return all ? all.dataDisplay : null;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    if (global.interactiveFigure) global.interactiveFigure.ensureStyles();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .data-display { --sfs-figure-max-width: none; margin: 0.75rem 0 0; }
      .data-display .dd-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem 0.9rem;
        align-items: center;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
      }
      .data-display .dd-toolbar[hidden] { display: none; }
      .data-display .dd-count { color: var(--sfs-muted); font-weight: 600; }
      .data-display .dd-orders { display: inline-flex; gap: 0; }
      .data-display .dd-orders[hidden] { display: none; }
      .data-display .dd-orders .sfs-button { border-radius: 0; margin-left: -1px; }
      .data-display .dd-orders .sfs-button:first-child { border-radius: var(--sfs-radius-sm, 4px) 0 0 var(--sfs-radius-sm, 4px); margin-left: 0; }
      .data-display .dd-orders .sfs-button:last-child { border-radius: 0 var(--sfs-radius-sm, 4px) var(--sfs-radius-sm, 4px) 0; }
      .data-display .dd-orders .sfs-button[aria-pressed="true"] {
        position: relative;
        z-index: 1;
        border-color: var(--sfs-accent, currentColor);
        background: var(--sfs-highlight-bg, transparent);
        font-weight: 700;
      }
      .data-display .dd-values {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem 0.35rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .data-display .dd-column + .dd-column { margin-top: 0.5rem; }
      .data-display .dd-column-name {
        margin: 0 0 0.25rem;
        font-size: 0.9rem;
        font-weight: 700;
      }
      .data-display .dd-column-name .dd-count { margin-left: 0.5rem; font-weight: 600; }
      .data-display .dd-column-name .dd-swatch {
        display: inline-block;
        width: 0.7rem;
        height: 0.7rem;
        margin-right: 0.4rem;
        border-radius: 2px;
        vertical-align: -0.02rem;
        background: var(--dd-swatch, currentColor);
      }
      .data-display .dd-value {
        display: inline-block;
        min-width: 2.2rem;
        padding: 0.12rem 0.45rem;
        border: 1px solid var(--sfs-border, var(--bs-border-color, #dee2e6));
        border-radius: var(--sfs-radius-sm, 4px);
        background: var(--sfs-bg, var(--bs-body-bg, #fff));
        font-variant-numeric: tabular-nums;
        text-align: center;
        line-height: 1.35;
        transition: transform 420ms cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      .data-display .dd-value.is-moving { transition: none; }
      .data-display .dd-empty { color: var(--sfs-muted); font-style: italic; }
    `;
    document.head.appendChild(style);
  }

  // A Data Explorer data panel to follow, or null for a fixed listing.
  function findOwner(opts) {
    if (Array.isArray(opts.values) || Array.isArray(opts.columns)) return null;
    const factory = global.makeDataExplorer;
    const node = factory && typeof factory.find === "function" ? factory.find(opts.owner || "dataExplorer") : null;
    if (!node) {
      throw new Error("makeDataDisplay needs values, columns, or the data panel (" + (opts.owner || "dataExplorer") + ") mounted earlier on the page.");
    }
    return node;
  }

  global.makeDataDisplay = function(options) {
    const opts = options || {};
    const S = strings();
    const fmt = global.sfsDataExplorerStrings ? global.sfsDataExplorerStrings.format : (t, vars) => String(t).replace("{n}", vars.n);
    const owner = findOwner(opts);
    ensureStyles();

    let order = ORDERS.includes(opts.order) ? opts.order : "entered";
    let columns = [];

    const root = document.createElement("section");
    root.className = "data-display sfs-figure";
    root.setAttribute("aria-label", opts.ariaLabel || (S ? S.ariaLabel : "The scores"));
    root.value = { order, values: [], columns: [] };

    const toolbar = document.createElement("div");
    toolbar.className = "dd-toolbar";
    const count = document.createElement("span");
    count.className = "dd-count";
    const orders = document.createElement("div");
    orders.className = "dd-orders sfs-action-row";
    orders.setAttribute("role", "group");
    orders.hidden = opts.controls === false;
    const buttons = {};
    ORDERS.forEach((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sfs-button";
      button.textContent = S ? S.orders[name] : { entered: "As entered", ascending: "Low to high", descending: "High to low" }[name];
      button.addEventListener("click", () => setOrder(name));
      buttons[name] = button;
      orders.appendChild(button);
    });
    toolbar.append(count, orders);
    const body = document.createElement("div");
    body.className = "dd-columns";
    const empty = document.createElement("p");
    empty.className = "dd-empty";
    empty.textContent = S ? S.empty : "No scores yet.";
    root.append(toolbar, body, empty);

    const countText = (n) => n === 1 ? (S ? S.countOne : "1 score") : fmt(S ? S.count : "{n} scores", { n });

    // One chip per score, keyed by its position as entered so a sort moves
    // the same chip rather than relabelling chips in place. Each column's
    // list sorts on its own — except X and Y pairs, which sort by X so the
    // rows stay paired (the chip's sort key is the X of its row).
    function chipsInOrder(list) {
      const chips = Array.from(list.children);
      if (order === "entered") return chips.slice().sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
      const sign = order === "descending" ? -1 : 1;
      return chips.slice().sort((a, b) =>
        sign * (Number(a.dataset.sortValue) - Number(b.dataset.sortValue)) ||
        Number(a.dataset.index) - Number(b.dataset.index));
    }

    function arrange(animate) {
      const lists = Array.from(body.querySelectorAll(".dd-values"));
      const moves = [];
      lists.forEach((list) => {
        const chips = chipsInOrder(list);
        const before = new Map();
        if (animate) chips.forEach((chip) => before.set(chip, chip.getBoundingClientRect()));
        chips.forEach((chip) => list.appendChild(chip));
        if (animate) moves.push([chips, before]);
      });
      if (!animate) return;
      moves.forEach(([chips, before]) => chips.forEach((chip) => {
        const from = before.get(chip);
        const to = chip.getBoundingClientRect();
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        if (!dx && !dy) return;
        chip.classList.add("is-moving");
        chip.style.transform = `translate(${dx}px, ${dy}px)`;
      }));
      // Next frame: let the transition carry each chip to its new place.
      global.requestAnimationFrame(() => {
        moves.forEach(([chips]) => chips.forEach((chip) => {
          chip.classList.remove("is-moving");
          chip.style.transform = "";
        }));
      });
    }

    function publish() {
      root.value = {
        order,
        values: columns.flatMap((column) => column.values),
        columns: columns.map((column) => ({ name: column.name, values: column.values.slice() }))
      };
    }

    function setOrder(name) {
      if (!ORDERS.includes(name)) return;
      order = name;
      ORDERS.forEach((key) => buttons[key].setAttribute("aria-pressed", String(key === order)));
      arrange(root.isConnected);
      publish();
    }

    function render(value) {
      const multi = Boolean(value && value.multi);
      const paired = Boolean(value && value.design === "paired");
      columns = multi && Array.isArray(value.columns)
        ? value.columns.map((column, index) => ({ name: column.name, values: (column.values || []).slice(), index }))
        : [{ name: "", values: Array.isArray(value && value.values) ? value.values.slice() : [], index: 0 }];
      body.replaceChildren();
      const palette = global.sfsGraphDefaultColors;
      columns.forEach((column) => {
        const block = document.createElement("div");
        block.className = "dd-column";
        if (multi) {
          const heading = document.createElement("p");
          heading.className = "dd-column-name";
          const swatch = document.createElement("span");
          swatch.className = "dd-swatch";
          swatch.style.setProperty("--dd-swatch", Array.isArray(palette) && palette.length ? palette[column.index % palette.length] : "currentColor");
          swatch.setAttribute("aria-hidden", "true");
          const n = document.createElement("span");
          n.className = "dd-count";
          n.textContent = countText(column.values.length);
          n.hidden = opts.count === false;
          heading.append(swatch, document.createTextNode(column.name), n);
          block.appendChild(heading);
        }
        const list = document.createElement("ol");
        list.className = "dd-values";
        column.values.forEach((score, index) => {
          const chip = document.createElement("li");
          chip.className = "dd-value";
          chip.dataset.index = String(index);
          chip.dataset.value = String(score);
          const key = paired && columns[0].values[index] !== undefined ? columns[0].values[index] : score;
          chip.dataset.sortValue = String(key);
          chip.textContent = String(score);
          list.appendChild(chip);
        });
        block.appendChild(list);
        body.appendChild(block);
      });
      const total = columns.reduce((sum, column) => sum + column.values.length, 0);
      count.textContent = countText(total);
      count.hidden = multi || opts.count === false;
      toolbar.hidden = count.hidden && orders.hidden;
      empty.hidden = total > 0;
      body.hidden = total === 0;
      arrange(false);
      publish();
    }

    ORDERS.forEach((key) => buttons[key].setAttribute("aria-pressed", String(key === order)));
    let unsubscribe = () => {};
    if (owner) {
      render(owner.value);
      unsubscribe = owner.dataExplorer.subscribe(render);
    } else if (Array.isArray(opts.columns)) {
      render({ multi: true, columns: opts.columns });
    } else {
      render({ values: opts.values });
    }
    root.dataDisplay = { setOrder, getOrder: () => order };
    if (global.interactiveFigure && typeof global.interactiveFigure.adopt === "function") {
      global.interactiveFigure.adopt(root, { dispose: unsubscribe });
    }
    return root;
  };
})(window);
