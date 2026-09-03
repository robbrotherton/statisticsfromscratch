(function(global) {
  "use strict";

  const defaultExamples = {
    odd: { values: [4, 1, 5, 2, 3], kind: "quantitative", noun: "scores" },
    even: { values: [4, 1, 5, 2, 3, 6], kind: "quantitative", noun: "scores" },
    evenBoundary: { values: [1, 2, 3, 4], kind: "quantitative", noun: "scores" },
    scores: { values: [65, 70, 80, 80, 90], kind: "quantitative", noun: "scores" },
    ties: { values: [65, 70, 80, 80, 80, 90, 95], kind: "quantitative", noun: "scores" }
  };

  function finiteValues(value, fallback) {
    const source = Array.isArray(value) && value.length ? value : fallback;
    return source.map(Number).filter(Number.isFinite);
  }

  function normalizeExample(value, fallback) {
    const supplied = Array.isArray(value)
      ? { values: value }
      : (value && typeof value === "object" ? value : {});
    const values = finiteValues(supplied.values, fallback.values);
    const labels = supplied.labels && typeof supplied.labels === "object"
      ? Object.assign({}, supplied.labels)
      : {};
    return {
      values,
      kind: supplied.kind === "ordinal" ? "ordinal" : "quantitative",
      labels,
      noun: typeof supplied.noun === "string" && supplied.noun.trim()
        ? supplied.noun.trim()
        : fallback.noun
    };
  }

  function normalizeExamples(value) {
    const supplied = value && typeof value === "object" ? value : {};
    const examples = {};
    Object.keys(defaultExamples).forEach(function(name) {
      examples[name] = normalizeExample(supplied[name], defaultExamples[name]);
      if (examples[name].values.length < 3) {
        throw new Error("Each median example requires at least three numeric observations.");
      }
    });
    if (examples.odd.values.length % 2 === 0 ||
        examples.even.values.length % 2 !== 0 ||
        examples.evenBoundary.values.length % 2 !== 0 ||
        examples.scores.values.length % 2 === 0 ||
        examples.ties.values.length % 2 === 0) {
      throw new Error("The median examples must preserve their intended odd and even sample sizes.");
    }
    return examples;
  }

  function motionAllows(requested) {
    const runtime = global.interactiveRuntime;
    if (runtime && runtime.motion && typeof runtime.motion.shouldAnimate === "function") {
      return runtime.motion.shouldAnimate(requested);
    }
    return requested !== false && !(global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function formatNumber(value) {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }

  function formatValue(example, value) {
    const key = String(value);
    return Object.hasOwn(example.labels, key) ? String(example.labels[key]) : formatNumber(value);
  }

  function setupTutorial(rootNode, applyAction, opts) {
    const api = global.interactiveFigure;
    if (!api || typeof api.createTutorial !== "function" || opts.tutorial === false) return;

    let attempts = 0;
    function setup() {
      attempts += 1;
      if (!rootNode.isConnected) {
        if (attempts < 60) global.requestAnimationFrame(setup);
        return;
      }

      const callout = rootNode.closest(".callout");
      const footer = callout ? callout.querySelector(".callout-footer") : null;
      if (!footer || footer.dataset.sfsIfTutorial === "true") return;

      const steps = Array.from(footer.children).filter(function(child) {
        return child.classList && child.classList.contains("tutorial-step");
      });
      if (!steps.length) return;

      api.createTutorial({
        root: rootNode,
        footer,
        steps,
        startIndex: opts.tutorialStartIndex,
        applyInitialAction: opts.tutorialApplyInitialAction,
        applyAction
      });
    }

    global.requestAnimationFrame(setup);
  }

  function setupVisibleReveal(rootNode) {
    let observer = null;
    let frame = null;
    let attempts = 0;
    let unsubscribeMotion = null;
    let revealed = false;

    function reveal() {
      if (revealed) return;
      revealed = true;
      rootNode.classList.remove("is-reveal-pending");
      if (observer) observer.disconnect();
      observer = null;
    }

    function observe() {
      attempts += 1;
      if (!rootNode.isConnected) {
        if (attempts < 60) frame = global.requestAnimationFrame(observe);
        else reveal();
        return;
      }
      if (!motionAllows(true) || !("IntersectionObserver" in global)) {
        reveal();
        return;
      }

      observer = new global.IntersectionObserver(function(entries) {
        if (entries[0] && entries[0].isIntersecting) reveal();
      }, { threshold: 0.35 });
      observer.observe(rootNode);

      frame = global.requestAnimationFrame(function() {
        const rect = rootNode.getBoundingClientRect();
        const viewportHeight = global.innerHeight || document.documentElement.clientHeight;
        const viewportWidth = global.innerWidth || document.documentElement.clientWidth;
        if (rect.bottom > 0 && rect.right > 0 &&
            rect.top < viewportHeight && rect.left < viewportWidth) {
          reveal();
        }
      });
    }

    const runtime = global.interactiveRuntime;
    if (runtime && runtime.motion && typeof runtime.motion.onChange === "function") {
      unsubscribeMotion = runtime.motion.onChange(function(detail) {
        if (detail && detail.reduced) reveal();
      });
    }
    frame = global.requestAnimationFrame(observe);

    return function cleanupVisibleReveal() {
      if (frame !== null) global.cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      if (unsubscribeMotion) unsubscribeMotion();
      frame = null;
      observer = null;
      unsubscribeMotion = null;
    };
  }

  global.makeMedianTutorial = function(opts) {
    opts = opts || {};
    const api = global.interactiveFigure;
    if (api && typeof api.ensureStyles === "function") api.ensureStyles();
    const staticVariant = opts.variant === "static" || opts.static === true;
    const revealOnVisible = staticVariant && opts.revealOnVisible !== false && motionAllows(true);

    const examples = normalizeExamples(opts.examples);
    const maxCount = Math.max.apply(null, Object.keys(examples).map(function(name) {
      return examples[name].values.length;
    }));

    function summarize(exampleName) {
      const name = Object.hasOwn(examples, exampleName) ? exampleName : "odd";
      const example = examples[name];
      const values = example.values;
      const items = values.map(function(value, index) {
        return { id: "median-observation-" + index, value, rawIndex: index };
      });
      const ordered = items.slice().sort(function(a, b) {
        return a.value - b.value || a.rawIndex - b.rawIndex;
      });
      const leftMiddleIndex = Math.floor((ordered.length - 1) / 2);
      const rightMiddleIndex = Math.ceil((ordered.length - 1) / 2);
      const leftMiddle = ordered[leftMiddleIndex];
      const rightMiddle = ordered[rightMiddleIndex];
      const cutpoint = (leftMiddle.value + rightMiddle.value) / 2;
      const median = example.kind === "ordinal" && leftMiddle.value !== rightMiddle.value
        ? null
        : cutpoint;
      return {
        name,
        example,
        values,
        items,
        ordered,
        count: ordered.length,
        leftMiddleIndex,
        rightMiddleIndex,
        leftMiddle,
        rightMiddle,
        median,
        cutpoint,
        middleIds: new Set([leftMiddle.id, rightMiddle.id]),
        valueById: new Map(items.map(function(item) { return [item.id, item.value]; })),
        display: function(value) { return formatValue(example, value); }
      };
    }

    const rootNode = document.createElement("div");
    rootNode.className = "median-tutorial sfs-figure sfs-if-root";
    if (staticVariant) rootNode.classList.add("median-cards-static");
    if (revealOnVisible) rootNode.classList.add("is-reveal-pending");
    rootNode.style.setProperty("--mt-count", String(examples.odd.values.length));
    rootNode.style.setProperty("--sfs-figure-max-width", opts.maxWidth || "40rem");

    const chartWrap = document.createElement("div");
    chartWrap.className = "mt-chart-wrap sfs-chart-wrap";
    chartWrap.tabIndex = 0;
    chartWrap.setAttribute("role", "region");
    chartWrap.setAttribute("aria-label", "Median example with all observations shown in one row.");

    const stage = document.createElement("div");
    stage.className = "mt-stage";
    stage.setAttribute("role", "img");

    const stageLabel = document.createElement("p");
    stageLabel.className = "mt-stage-label";

    const valuesNode = document.createElement("div");
    valuesNode.className = "mt-values";
    valuesNode.setAttribute("aria-hidden", "true");

    const nodeById = new Map();
    const valueNodeById = new Map();
    for (let index = 0; index < maxCount; index += 1) {
      const id = "median-observation-" + index;
      const score = document.createElement("span");
      score.className = "mt-score";
      score.dataset.observationId = id;
      score.hidden = true;
      const scoreValue = document.createElement("span");
      scoreValue.className = "mt-score-value";
      score.appendChild(scoreValue);
      valuesNode.appendChild(score);
      nodeById.set(id, score);
      valueNodeById.set(id, scoreValue);
    }

    const markerGrid = document.createElement("div");
    markerGrid.className = "mt-marker-grid";
    markerGrid.setAttribute("aria-hidden", "true");

    const marker = document.createElement("div");
    marker.className = "mt-marker sfs-if-reveal";

    const markerLabel = document.createElement("strong");
    markerLabel.className = "mt-marker-label";
    const markerDetail = document.createElement("span");
    markerDetail.className = "mt-marker-detail";
    marker.append(markerLabel, markerDetail);
    markerGrid.appendChild(marker);

    const legend = document.createElement("div");
    legend.className = "mt-legend";
    legend.setAttribute("aria-hidden", "true");
    const legendLabelByRelation = new Map();
    const legendItemByRelation = new Map();
    [
      ["below", "Below median"],
      ["equal", "Equal to median (in both halves)"],
      ["above", "Above median"]
    ].forEach(function(entry) {
      const item = document.createElement("span");
      item.className = "mt-legend-item";
      const swatch = document.createElement("span");
      swatch.className = "mt-legend-swatch is-" + entry[0];
      const label = document.createElement("span");
      label.textContent = entry[1];
      legendItemByRelation.set(entry[0], item);
      legendLabelByRelation.set(entry[0], label);
      item.append(swatch, label);
      legend.appendChild(item);
    });
    legend.hidden = true;

    stage.append(stageLabel, valuesNode, markerGrid, legend);
    chartWrap.appendChild(stage);
    rootNode.appendChild(chartWrap);

    let state = {
      example: "odd",
      order: "raw",
      emphasize: "none",
      annotation: "none"
    };
    let pendingMotion = Promise.resolve();

    function cancelMotion() {
      if (typeof rootNode.getAnimations !== "function") return;
      rootNode.getAnimations({ subtree: true }).forEach(function(animation) {
        animation.cancel();
      });
      pendingMotion = Promise.resolve();
    }

    rootNode.addEventListener("sfs-if:cancel-transitions", cancelMotion);

    function orderFor(summary, order) {
      return order === "ascending" || order === "sorted"
        ? summary.ordered
        : summary.items;
    }

    function examplesShareObservations(previousName, nextName) {
      const previous = examples[previousName] ? examples[previousName].values : [];
      const next = examples[nextName] ? examples[nextName].values : [];
      if (Math.abs(previous.length - next.length) > 1) return false;
      const shorter = Math.min(previous.length, next.length);
      let changes = 0;
      for (let index = 0; index < shorter; index += 1) {
        if (previous[index] !== next[index]) changes += 1;
        if (changes > 1) return false;
      }
      return true;
    }

    function reorder(nextOrder, animate, preserveObservations, example) {
      const firstRects = new Map();
      const activeIds = new Set(nextOrder.map(function(item) { return item.id; }));
      const nextValueById = new Map(nextOrder.map(function(item) { return [item.id, item.value]; }));
      const visibleNodes = Array.from(valuesNode.children).filter(function(node) {
        return !node.hidden && node.dataset.medianGhost !== "true";
      });
      const changedSlots = visibleNodes.length === nextOrder.length
        ? visibleNodes.reduce(function(indexes, node, index) {
            if (Number(node.dataset.medianValue) !== nextOrder[index].value) indexes.push(index);
            return indexes;
          }, [])
        : [];
      const singleSlotReplacement = animate && preserveObservations && changedSlots.length === 1;
      const departing = [];

      function makeGhost(node, rect, valuesRect, valueChanged, targetId) {
        const ghost = node.cloneNode(true);
        ghost.classList.add("mt-score-ghost");
        ghost.dataset.medianGhost = "true";
        ghost.setAttribute("aria-hidden", "true");
        ghost.style.left = (rect.left - valuesRect.left) + "px";
        ghost.style.top = (rect.top - valuesRect.top) + "px";
        ghost.style.width = rect.width + "px";
        ghost.style.height = rect.height + "px";
        departing.push({ ghost, valueChanged, targetId });
      }

      if (animate && preserveObservations) {
        const valuesRect = valuesNode.getBoundingClientRect();
        nodeById.forEach(function(node, id) {
          if (node.hidden) return;
          const rect = node.getBoundingClientRect();
          firstRects.set(id, rect);
          const previousValue = Number(node.dataset.medianValue);
          const valueChanged = activeIds.has(id) &&
            Number.isFinite(previousValue) && previousValue !== nextValueById.get(id);
          if (activeIds.has(id) && (!valueChanged || singleSlotReplacement)) return;
          makeGhost(node, rect, valuesRect, valueChanged, valueChanged ? id : null);
        });

        if (singleSlotReplacement) {
          const slot = changedSlots[0];
          const node = visibleNodes[slot];
          makeGhost(
            node,
            node.getBoundingClientRect(),
            valuesRect,
            true,
            nextOrder[slot].id
          );
        }
      }

      nextOrder.forEach(function(item) {
        const node = nodeById.get(item.id);
        valueNodeById.get(item.id).textContent = formatValue(example, item.value);
        node.dataset.medianValue = String(item.value);
        node.hidden = false;
        valuesNode.appendChild(node);
      });
      nodeById.forEach(function(node, id) {
        if (activeIds.has(id)) return;
        node.hidden = true;
        valuesNode.appendChild(node);
      });
      rootNode.style.setProperty("--mt-count", String(nextOrder.length));
      rootNode.classList.toggle("is-dense", nextOrder.length > 10);
      departing.forEach(function(entry) { valuesNode.appendChild(entry.ghost); });

      if (!animate || typeof Element === "undefined") {
        pendingMotion = Promise.resolve();
        return;
      }

      const animations = [];
      const removeDuration = Number(opts.removeDuration) || 280;
      const replaceDuration = Number(opts.replaceDuration) || 440;
      const hasRemoval = departing.some(function(entry) { return !entry.valueChanged; });
      departing.forEach(function(entry) {
        if (typeof entry.ghost.animate !== "function") {
          entry.ghost.remove();
          return;
        }
        const departingAnimation = entry.ghost.animate(
          entry.valueChanged
            ? [
                { opacity: 1, transform: "scale(1)", offset: 0 },
                { opacity: 1, transform: "scale(1)", offset: 0.25 },
                { opacity: 0, transform: "scale(0.96)", offset: 0.58 },
                { opacity: 0, transform: "scale(0.96)", offset: 1 }
              ]
            : [
                { opacity: 1, transform: "scale(1)" },
                { opacity: 0, transform: "scale(0.82)" }
              ],
          {
            duration: entry.valueChanged ? replaceDuration : removeDuration,
            easing: "cubic-bezier(0.4, 0, 0.2, 1)"
          }
        );
        departingAnimation.id = entry.valueChanged ? "median-replace-old" : "median-remove";
        animations.push(departingAnimation.finished.catch(function() {}).finally(function() {
          entry.ghost.remove();
        }));
      });
      nextOrder.forEach(function(item) {
        const node = nodeById.get(item.id);
        if (typeof node.animate !== "function") return;
        const first = firstRects.get(item.id);
        const last = node.getBoundingClientRect();

        const valueChanged = departing.some(function(entry) {
          return entry.valueChanged && entry.targetId === item.id;
        });
        if (valueChanged) {
          const replacementAnimation = node.animate(
            [{ opacity: 0 }, { opacity: 0, offset: 0.48 }, { opacity: 1 }],
            {
              duration: replaceDuration,
              easing: "cubic-bezier(0.4, 0, 0.2, 1)"
            }
          );
          replacementAnimation.id = "median-replace-new";
          animations.push(replacementAnimation.finished.catch(function() {}));
        }

        if (singleSlotReplacement) return;

        if (!preserveObservations) {
          const exampleAnimation = node.animate(
            [
              { opacity: 0, transform: "scale(0.94)" },
              { opacity: 1, transform: "scale(1)" }
            ],
            {
              duration: Number(opts.exampleDuration) || 420,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)"
            }
          );
          exampleAnimation.id = "median-example";
          animations.push(exampleAnimation.finished.catch(function() {}));
          return;
        }

        if (!first) {
          const addAnimation = node.animate(
            [
              { opacity: 0, transform: "scale(0.72)" },
              { opacity: 1, transform: "scale(1)" }
            ],
            {
              duration: Number(opts.sortDuration) || 720,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)"
            }
          );
          addAnimation.id = "median-add";
          animations.push(addAnimation.finished.catch(function() {}));
          return;
        }

        const deltaX = first.left + first.width / 2 - (last.left + last.width / 2);
        const deltaY = first.top + first.height / 2 - (last.top + last.height / 2);
        const scaleX = first.width / last.width;
        const scaleY = first.height / last.height;
        if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5 &&
            Math.abs(scaleX - 1) < 0.01 && Math.abs(scaleY - 1) < 0.01) return;
        const sortAnimation = node.animate(
          [
            { transform: "translate(" + deltaX + "px," + deltaY + "px) scale(" +
                scaleX + "," + scaleY + ")" },
            { transform: "translate(0,0)" }
          ],
          {
            duration: Number(opts.sortDuration) || 720,
            delay: hasRemoval ? removeDuration : 0,
            fill: hasRemoval ? "backwards" : "none",
            easing: "cubic-bezier(0.22, 1, 0.36, 1)"
          }
        );
        sortAnimation.id = "median-sort";
        animations.push(sortAnimation.finished.catch(function() {}));
      });
      pendingMotion = Promise.all(animations);
    }

    function placeMarker(summary, nextState) {
      let firstIndex = summary.leftMiddleIndex;
      let lastIndex = summary.rightMiddleIndex;
      if (nextState.annotation === "median" && summary.median !== null &&
          (nextState.emphasize === "halves" || nextState.emphasize === "median-values")) {
        const equalIndexes = summary.ordered.reduce(function(indexes, item, index) {
          if (item.value === summary.median) indexes.push(index);
          return indexes;
        }, []);
        if (equalIndexes.length) {
          firstIndex = equalIndexes[0];
          lastIndex = equalIndexes[equalIndexes.length - 1];
        }
      }
      marker.style.gridColumn = (firstIndex + 1) + " / " + (lastIndex + 2);
    }

    function markerText(summary, annotation) {
      if (annotation === "middle") {
        markerLabel.textContent = summary.leftMiddleIndex === summary.rightMiddleIndex
          ? "Middle position"
          : "Two middle positions";
        markerDetail.textContent = summary.example.kind === "ordinal" && summary.median === null
          ? "Median falls between " + summary.display(summary.leftMiddle.value) + " and " +
            summary.display(summary.rightMiddle.value)
          : summary.leftMiddleIndex === summary.rightMiddleIndex
            ? summary.display(summary.leftMiddle.value)
            : summary.display(summary.leftMiddle.value) + " and " +
              summary.display(summary.rightMiddle.value);
        return;
      }
      if (summary.example.kind === "ordinal") {
        if (summary.median === null) {
          markerLabel.textContent = "Median falls between " +
            summary.display(summary.leftMiddle.value) + " and " +
            summary.display(summary.rightMiddle.value);
          markerDetail.textContent = "two middle categories";
        } else {
          markerLabel.textContent = "Median = " + summary.display(summary.median);
          markerDetail.textContent = "middle category: " + summary.display(summary.median);
        }
        return;
      }
      markerLabel.textContent = "Median = " + formatNumber(summary.median);
      markerDetail.textContent = summary.leftMiddleIndex === summary.rightMiddleIndex
        ? "middle score: " + summary.display(summary.leftMiddle.value)
        : "(" + summary.display(summary.leftMiddle.value) + " + " +
          summary.display(summary.rightMiddle.value) + ") / 2";
    }

    function accessibleLabel(nextState, summary) {
      const currentOrder = orderFor(summary, nextState.order).map(function(item) {
        return summary.display(item.value);
      }).join(", ");
      const prefix = summary.count + " " + summary.example.noun +
        (nextState.order === "ascending" || nextState.order === "sorted"
          ? " ordered from low to high: "
          : " in their original order: ") + currentOrder + ".";
      const positionalDetail = nextState.emphasize === "positional-halves"
        ? " The first " + summary.count / 2 + " observations form the lower half, and the last " +
          summary.count / 2 + " form the upper half."
        : "";

      if (nextState.annotation === "middle") {
        if (summary.example.kind === "ordinal" && summary.median === null) {
          return prefix + " The two middle observations are " +
            summary.display(summary.leftMiddle.value) + " and " +
            summary.display(summary.rightMiddle.value) + ". The median falls between them." +
            positionalDetail;
        }
        return prefix + (summary.leftMiddleIndex === summary.rightMiddleIndex
          ? " The middle observation is " + summary.display(summary.leftMiddle.value) + "."
          : " The two middle observations are " + summary.display(summary.leftMiddle.value) +
            " and " + summary.display(summary.rightMiddle.value) + ".") + positionalDetail;
      }
      if (nextState.annotation !== "median") return prefix + positionalDetail;
      const partitionDetail = nextState.emphasize === "halves" && summary.median !== null
        ? " " + summary.values.filter(function(value) { return value < summary.median; }).length +
          " are below the median, " +
          summary.values.filter(function(value) { return value === summary.median; }).length +
          " equal it, and " +
          summary.values.filter(function(value) { return value > summary.median; }).length +
          " are above it."
        : "";
      if (summary.example.kind === "ordinal" && summary.median === null) {
        return prefix + " The middle categories are " +
          summary.display(summary.leftMiddle.value) + " and " +
          summary.display(summary.rightMiddle.value) +
          "; the median falls between them." + positionalDetail;
      }
      if (summary.example.kind === "ordinal") {
        const ordinalDetail = summary.leftMiddleIndex === summary.rightMiddleIndex
          ? " The single middle observation, and the median category, is " +
            summary.display(summary.median) + "."
          : " The two middle observations are " + summary.display(summary.leftMiddle.value) +
            " and " + summary.display(summary.rightMiddle.value) +
            "; the median category is " + summary.display(summary.median) + ".";
        return prefix + ordinalDetail + partitionDetail + positionalDetail;
      }
      if (summary.leftMiddleIndex === summary.rightMiddleIndex) {
        return prefix + " The single middle observation, and the median, is " +
          summary.display(summary.median) + "." + partitionDetail + positionalDetail;
      }

      let detail = " The middle scores are " + summary.display(summary.leftMiddle.value) +
        " and " + summary.display(summary.rightMiddle.value) +
        ". Their average, and the median, is " + summary.display(summary.median) + ".";
      return prefix + detail + partitionDetail + positionalDetail;
    }

    function setState(action, context) {
      action = action || {};
      const nextState = {
        example: action.example || state.example,
        order: action.order || state.order,
        emphasize: action.emphasize || "none",
        annotation: action.annotation || "none"
      };
      const summary = summarize(nextState.example);
      const animate = motionAllows(action.animate);
      const exampleChanged = nextState.example !== state.example;
      const preserveObservations = !exampleChanged ||
        examplesShareObservations(state.example, nextState.example);

      cancelMotion();
      reorder(
        orderFor(summary, nextState.order),
        animate && (exampleChanged || nextState.order !== state.order),
        preserveObservations,
        summary.example
      );

      const activeNodes = Array.from(valuesNode.children).filter(function(node) {
        return !node.hidden && node.dataset.medianGhost !== "true";
      });
      activeNodes.forEach(function(node, index) {
        const value = summary.valueById.get(node.dataset.observationId);
        const isMiddle = summary.middleIds.has(node.dataset.observationId);
        const isMedianValue = summary.median !== null && value === summary.median;
        const partitionActive = nextState.emphasize === "halves";
        const positionalHalvesActive = nextState.emphasize === "positional-halves";
        const inLowerHalf = positionalHalvesActive && index < summary.count / 2;
        const inUpperHalf = positionalHalvesActive && index >= summary.count / 2;
        const positionalMedianActive = positionalHalvesActive &&
          nextState.annotation === "median" && isMedianValue;
        const shouldEmphasize =
          (nextState.emphasize === "middle" && isMiddle) ||
          (nextState.emphasize === "median-values" && isMedianValue);
        const emphasisActive = nextState.emphasize === "middle" ||
          nextState.emphasize === "median-values";
        node.classList.toggle("is-middle", shouldEmphasize);
        node.classList.toggle("is-muted", emphasisActive && !shouldEmphasize && !node.hidden);
        node.classList.toggle("is-below", (partitionActive && value < summary.cutpoint) || inLowerHalf);
        node.classList.toggle("is-equal",
          (partitionActive && isMedianValue) || positionalMedianActive);
        node.classList.toggle("is-above", (partitionActive && value > summary.cutpoint) || inUpperHalf);
      });

      const showMarker = nextState.annotation !== "none";
      placeMarker(summary, nextState);
      markerText(summary, nextState.annotation);
      if (api && typeof api.setRevealVisible === "function") {
        api.setRevealVisible(marker, showMarker, { root: rootNode, animate });
      } else {
        marker.hidden = !showMarker;
      }
      marker.classList.toggle("is-median", nextState.annotation === "median");
      const showPartitionLegend = nextState.emphasize === "halves" ||
        nextState.emphasize === "positional-halves";
      legend.hidden = !showPartitionLegend || opts.showLegend === false;
      const equalCount = summary.median === null
        ? 0
        : summary.values.filter(function(value) { return value === summary.median; }).length;
      const positionalHalvesActive = nextState.emphasize === "positional-halves";
      const showPositionalMedian = positionalHalvesActive &&
        nextState.annotation === "median" && equalCount > 0;
      legendLabelByRelation.get("below").textContent = positionalHalvesActive
        ? "Lower half"
        : "Below median";
      legendLabelByRelation.get("above").textContent = positionalHalvesActive
        ? "Upper half"
        : "Above median";
      legendItemByRelation.get("equal").hidden = positionalHalvesActive && !showPositionalMedian;
      legendLabelByRelation.get("equal").textContent = equalCount
        ? "Equal to median (in both halves)"
        : "Equal to median (none observed)";
      const sorted = nextState.order === "ascending" || nextState.order === "sorted";
      stageLabel.textContent = summary.count + " " + summary.example.noun +
        (sorted ? " in order" : " in their original order");
      stage.setAttribute("aria-label", accessibleLabel(nextState, summary));
      rootNode.dataset.medianExample = nextState.example;
      rootNode.dataset.medianOrder = sorted ? "ascending" : "raw";
      rootNode.dataset.medianEmphasis = nextState.emphasize;
      rootNode.dataset.medianAnnotation = nextState.annotation;
      rootNode.value = {
        example: nextState.example,
        raw: summary.values.slice(),
        ordered: summary.ordered.map(function(item) { return item.value; }),
        middle: summary.leftMiddleIndex === summary.rightMiddleIndex
          ? [summary.leftMiddle.value]
          : [summary.leftMiddle.value, summary.rightMiddle.value],
        median: summary.median,
        sampleSize: summary.count,
        state: Object.assign({}, nextState)
      };
      state = nextState;
      rootNode.dispatchEvent(new Event("input", { bubbles: true }));

      if (context && context.signal) {
        context.signal.addEventListener("abort", cancelMotion, { once: true });
      }
      return state;
    }

    function applyTutorialAction(action, context) {
      return setState(action, context);
    }

    rootNode.medianTutorial = {
      applyTutorialAction,
      setState,
      getState: function() { return Object.assign({}, state); }
    };

    const initialState = Object.assign({
      example: "odd",
      order: "raw",
      emphasize: "none",
      annotation: "none"
    }, opts.initialState || {});
    initialState.animate = false;
    setState(initialState);

    let cleanupVisibleReveal = function() {};
    if (revealOnVisible) cleanupVisibleReveal = setupVisibleReveal(rootNode);

    if (api && typeof api.adopt === "function") {
      api.adopt(rootNode, {
        whenReady: function() { return pendingMotion; },
        cancelMotion,
        dispose: function() {
          rootNode.removeEventListener("sfs-if:cancel-transitions", cancelMotion);
          cleanupVisibleReveal();
          cancelMotion();
        }
      });
    }

    setupTutorial(rootNode, applyTutorialAction, opts);
    return rootNode;
  };

  global.makeMedianCards = function(opts) {
    opts = opts || {};
    const values = Array.isArray(opts.values) ? opts.values.slice() : [];
    const exampleName = values.length % 2 === 0 ? "even" : "odd";
    const example = {
      values,
      kind: opts.kind,
      labels: opts.labels,
      noun: opts.noun
    };
    const examples = Object.assign({}, opts.examples || {});
    examples[exampleName] = example;
    return global.makeMedianTutorial(Object.assign({}, opts, {
      variant: "static",
      tutorial: false,
      examples,
      showLegend: opts.showLegend === true,
      initialState: {
        example: exampleName,
        order: opts.order || "ascending",
        emphasize: opts.emphasize || "halves",
        annotation: opts.annotation || "median"
      }
    }));
  };
})(window);
