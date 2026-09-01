(function(global) {
  "use strict";

  const stats = global.bcStats || {};
  const normalPdf = stats.normalPdf;
  const normalCdf = stats.normalCdf;
  const normalInv = stats.normalInv;
  const SQRT_THREE = Math.sqrt(3);
  const TWO_PI = 2 * Math.PI;
  const TRIANGULAR_MEAN = 1 / 3;
  const TRIANGULAR_SD = 1 / Math.sqrt(18);

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function boolean(value, fallback) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "boolean") return value;
    const key = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "on", "show"].includes(key)) return true;
    if (["false", "0", "no", "off", "hide"].includes(key)) return false;
    return fallback;
  }

  function actionKey(value) {
    return String(value).trim().toLowerCase().replace(/[\s_]+/g, "-");
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function safeProbability(value) {
    return clamp(finite(value, 0.5), 1e-10, 1 - 1e-10);
  }

  function numericArray(values) {
    return Array.isArray(values)
      ? values.map(Number).filter(Number.isFinite)
      : [];
  }

  function mean(values) {
    if (!values.length) return NaN;
    let total = 0;
    for (let index = 0; index < values.length; index += 1) total += values[index];
    return total / values.length;
  }

  function sdN(values) {
    if (!values.length) return NaN;
    const center = mean(values);
    let ss = 0;
    for (let index = 0; index < values.length; index += 1) {
      const difference = values[index] - center;
      ss += difference * difference;
    }
    return Math.sqrt(ss / values.length);
  }

  function hashSeed(seed) {
    const text = String(seed ?? "sampling-v1");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    let state = seed >>> 0;
    return function() {
      state = (state + 0x6D2B79F5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededRng(seed) {
    return mulberry32(hashSeed(seed));
  }

  function fastNormalDraw(rng) {
    const u = safeProbability(rng());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * rng());
  }

  function normalDraw(rng, center, spread) {
    return normalInv(safeProbability(rng()), center, spread);
  }

  function triangularStandardizedInv(probability) {
    const raw = 1 - Math.sqrt(1 - safeProbability(probability));
    return (raw - TRIANGULAR_MEAN) / TRIANGULAR_SD;
  }

  function triangularStandardizedCdf(value) {
    const raw = TRIANGULAR_MEAN + TRIANGULAR_SD * value;
    if (raw <= 0) return 0;
    if (raw >= 1) return 1;
    return 1 - (1 - raw) * (1 - raw);
  }

  function triangularStandardizedPdf(value) {
    const raw = TRIANGULAR_MEAN + TRIANGULAR_SD * value;
    return raw < 0 || raw > 1 ? 0 : 2 * (1 - raw) * TRIANGULAR_SD;
  }

  function triangularStandardizedDraw(rng) {
    return (1 - Math.sqrt(1 - rng()) - TRIANGULAR_MEAN) / TRIANGULAR_SD;
  }

  const skewBlendCovariance = (() => {
    let total = 0;
    const steps = 8192;
    for (let index = 0; index < steps; index += 1) {
      const probability = (index + 0.5) / steps;
      total += normalInv(probability, 0, 1) * triangularStandardizedInv(probability);
    }
    return total / steps;
  })();

  function skewBlendScale(amount) {
    const skew = clamp(amount, 0, 1);
    const normalWeight = 1 - skew;
    return Math.sqrt(normalWeight * normalWeight + skew * skew +
      2 * normalWeight * skew * skewBlendCovariance);
  }

  function skewBlendInv(probability, amount) {
    const skew = clamp(amount, 0, 1);
    if (skew <= 1e-8) return normalInv(safeProbability(probability), 0, 1);
    if (skew >= 1 - 1e-8) return triangularStandardizedInv(probability);
    const p = safeProbability(probability);
    return ((1 - skew) * normalInv(p, 0, 1) + skew * triangularStandardizedInv(p)) /
      skewBlendScale(skew);
  }

  function skewBlendCdf(value, amount) {
    const skew = clamp(amount, 0, 1);
    if (skew <= 1e-8) return normalCdf(value, 0, 1);
    if (skew >= 1 - 1e-8) return triangularStandardizedCdf(value);
    let lower = 1e-10;
    let upper = 1 - 1e-10;
    for (let index = 0; index < 54; index += 1) {
      const midpoint = (lower + upper) / 2;
      if (skewBlendInv(midpoint, skew) < value) lower = midpoint;
      else upper = midpoint;
    }
    return (lower + upper) / 2;
  }

  function skewBlendPdf(value, amount) {
    const skew = clamp(amount, 0, 1);
    if (skew <= 1e-8) return normalPdf(value, 0, 1);
    if (skew >= 1 - 1e-8) return triangularStandardizedPdf(value);
    const probability = skewBlendCdf(value, skew);
    const delta = Math.min(2e-5, probability / 2, (1 - probability) / 2);
    if (delta <= 1e-10) return 0;
    const derivative = (skewBlendInv(probability + delta, skew) -
      skewBlendInv(probability - delta, skew)) / (2 * delta);
    return derivative > 0 ? 1 / derivative : 0;
  }

  function affineModel(base, center, spread, overrides) {
    const mu = finite(center, 0);
    const sigma = Math.max(0.01, finite(spread, 1));
    const model = {
      id: base.id,
      kind: "continuous",
      label: base.label,
      shortLabel: base.shortLabel || base.label.toLowerCase(),
      mean: mu,
      sd: sigma,
      exactNormal: Boolean(base.exactNormal),
      inv: (probability) => mu + sigma * base.inv(probability),
      cdf: (value) => base.cdf((value - mu) / sigma),
      pdf: (value) => base.pdf((value - mu) / sigma) / sigma,
      draw: (rng) => mu + sigma * base.draw(rng),
      drawMeanZ: (rng, n) => base.drawMeanZ
        ? base.drawMeanZ(rng, n)
        : drawMeanZByLoop(base, rng, n)
    };
    return Object.assign(model, overrides || {});
  }

  function drawMeanZByLoop(standardModel, rng, n) {
    const count = Math.max(1, Math.round(finite(n, 1)));
    let total = 0;
    for (let index = 0; index < count; index += 1) total += standardModel.draw(rng);
    return total / Math.sqrt(count);
  }

  function normalModel(options) {
    const opts = options || {};
    const standard = {
      id: "normal",
      label: "Normal",
      shortLabel: "normal",
      exactNormal: true,
      inv: (probability) => normalInv(safeProbability(probability), 0, 1),
      cdf: (value) => normalCdf(value, 0, 1),
      pdf: (value) => normalPdf(value, 0, 1),
      draw: (rng) => normalDraw(rng, 0, 1),
      drawMeanZ: (rng) => fastNormalDraw(rng)
    };
    return affineModel(standard, opts.mean ?? opts.mu, opts.sd ?? opts.sigma);
  }

  function skewDescription(amount) {
    const skew = clamp(amount, 0, 1);
    if (skew <= 1e-8) return "Normal";
    if (skew < 0.34) return "Slight right skew";
    if (skew < 0.67) return "Moderate right skew";
    return "Strong right skew";
  }

  function skewModel(options) {
    const opts = options || {};
    const skew = clamp(finite(opts.skew ?? opts.amount, 0), 0, 1);
    const standard = {
      id: "skewed",
      label: skewDescription(skew),
      shortLabel: skew <= 1e-8 ? "normal" : "right-skewed",
      exactNormal: skew <= 1e-8,
      inv: (probability) => skewBlendInv(probability, skew),
      cdf: (value) => skewBlendCdf(value, skew),
      pdf: (value) => skewBlendPdf(value, skew),
      draw: (rng) => skewBlendInv(rng(), skew),
      drawMeanZ: (rng, n) => {
        if (skew <= 1e-8) return fastNormalDraw(rng);
        const count = Math.max(1, Math.round(finite(n, 1)));
        let total = 0;
        if (skew >= 1 - 1e-8) {
          for (let index = 0; index < count; index += 1) {
            total += triangularStandardizedDraw(rng);
          }
        } else {
          for (let index = 0; index < count; index += 1) {
            total += skewBlendInv(rng(), skew);
          }
        }
        return total / Math.sqrt(count);
      }
    };
    return affineModel(standard, opts.mean ?? opts.mu, opts.sd ?? opts.sigma, { skew });
  }

  // Fixed once from a heavily skewed Chapter 3-style curve, with a sparse tail
  // retained across the complete -3 to +3 display range. The model below treats
  // each dot column as a narrow continuous density bin, so the visible formation,
  // its reported moments, and the simulated observations all describe the same
  // population.
  const rightSkewedFormationCounts = Object.freeze([
    1, 1, 2, 2, 3, 5, 6, 8, 10, 11, 12, 13, 14, 14, 14, 13, 13, 12,
    12, 12, 11, 11, 10, 10, 9, 8, 8, 7, 7, 6, 6, 6, 5, 5, 4, 4, 4, 3,
    3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1
  ]);

  function rightSkewedModel(options) {
    const counts = rightSkewedFormationCounts;
    const lowerDomain = -3;
    const upperDomain = 3;
    const step = 0.1;
    const halfStep = step / 2;
    const components = counts.map((count, index) => {
      const value = lowerDomain + index * step;
      return {
        count,
        value,
        lower: Math.max(lowerDomain, value - halfStep),
        upper: Math.min(upperDomain, value + halfStep)
      };
    });
    const expandedComponents = components.flatMap((component) =>
      Array.from({ length: component.count }, () => component)
    );
    const totalWeight = expandedComponents.length;
    let firstMoment = 0;
    let secondMoment = 0;
    components.forEach((component) => {
      const componentMean = (component.lower + component.upper) / 2;
      const componentSecondMoment = (
        component.lower * component.lower +
        component.lower * component.upper +
        component.upper * component.upper
      ) / 3;
      firstMoment += component.count * componentMean;
      secondMoment += component.count * componentSecondMoment;
    });
    const center = firstMoment / totalWeight;
    const spread = Math.sqrt(secondMoment / totalWeight - center * center);

    function draw(rng) {
      const component = expandedComponents[Math.min(
        totalWeight - 1, Math.floor(rng() * totalWeight)
      )];
      return component.lower + rng() * (component.upper - component.lower);
    }

    function cdf(value) {
      if (value <= lowerDomain) return 0;
      if (value >= upperDomain) return 1;
      let probability = 0;
      components.forEach((component) => {
        if (value >= component.upper) probability += component.count;
        else if (value > component.lower) {
          probability += component.count *
            (value - component.lower) / (component.upper - component.lower);
        }
      });
      return probability / totalWeight;
    }

    function inv(probability) {
      const target = safeProbability(probability);
      let lower = lowerDomain;
      let upper = upperDomain;
      for (let index = 0; index < 54; index += 1) {
        const midpoint = (lower + upper) / 2;
        if (cdf(midpoint) < target) lower = midpoint;
        else upper = midpoint;
      }
      return (lower + upper) / 2;
    }

    return {
      id: "skewed",
      kind: "continuous",
      label: "Strong right skew",
      shortLabel: "right-skewed",
      mean: center,
      sd: spread,
      exactNormal: false,
      inv,
      cdf,
      pdf(value) {
        return components.reduce((density, component) => {
          if (value < component.lower || value > component.upper) return density;
          return density + component.count /
            (totalWeight * (component.upper - component.lower));
        }, 0);
      },
      draw,
      drawMeanZ: (rng, n) => {
        const count = Math.max(1, Math.round(finite(n, 1)));
        let total = 0;
        for (let index = 0; index < count; index += 1) {
          total += draw(rng);
        }
        return (total / count - center) / (spread / Math.sqrt(count));
      }
    };
  }

  function uniformModel(options) {
    const opts = options || {};
    const standard = {
      id: "uniform",
      label: "Uniform",
      shortLabel: "uniform",
      exactNormal: false,
      inv: (probability) => SQRT_THREE * (2 * safeProbability(probability) - 1),
      cdf: (value) => value <= -SQRT_THREE ? 0 : value >= SQRT_THREE ? 1 :
        (value + SQRT_THREE) / (2 * SQRT_THREE),
      pdf: (value) => Math.abs(value) <= SQRT_THREE ? 1 / (2 * SQRT_THREE) : 0,
      draw: (rng) => SQRT_THREE * (2 * rng() - 1)
    };
    return affineModel(standard, opts.mean ?? opts.mu, opts.sd ?? opts.sigma);
  }

  const mixtureA = 0.94;
  const mixtureS = Math.sqrt(1 - mixtureA * mixtureA);

  function mixtureCdf(value) {
    return 0.5 * normalCdf(value, -mixtureA, mixtureS) +
      0.5 * normalCdf(value, mixtureA, mixtureS);
  }

  function mixtureInv(probability) {
    const target = safeProbability(probability);
    let lower = -5;
    let upper = 5;
    for (let index = 0; index < 72; index += 1) {
      const midpoint = (lower + upper) / 2;
      if (mixtureCdf(midpoint) < target) lower = midpoint;
      else upper = midpoint;
    }
    return (lower + upper) / 2;
  }

  function bimodalModel(options) {
    const opts = options || {};
    const standard = {
      id: "bimodal",
      label: "Two peaks",
      shortLabel: "two-peaked",
      exactNormal: false,
      inv: mixtureInv,
      cdf: mixtureCdf,
      pdf: (value) => 0.5 * normalPdf(value, -mixtureA, mixtureS) +
        0.5 * normalPdf(value, mixtureA, mixtureS),
      draw: (rng) => (rng() < 0.5 ? -mixtureA : mixtureA) + mixtureS * fastNormalDraw(rng),
      drawMeanZ: (rng, n) => {
        const count = Math.max(1, Math.round(finite(n, 1)));
        let positive = 0;
        for (let index = 0; index < count; index += 1) positive += rng() < 0.5 ? 1 : 0;
        return mixtureA * (2 * positive - count) / Math.sqrt(count) + mixtureS * fastNormalDraw(rng);
      }
    };
    return affineModel(standard, opts.mean ?? opts.mu, opts.sd ?? opts.sigma);
  }

  function discreteModel(values, options) {
    const opts = options || {};
    const population = numericArray(values);
    if (!population.length) return normalModel(opts);
    const sorted = population.slice().sort((a, b) => a - b);
    const center = mean(population);
    const spread = sdN(population) || 1;
    return {
      id: opts.id || "discrete",
      kind: "discrete",
      label: opts.label || "Finite population",
      shortLabel: opts.shortLabel || "finite",
      mean: center,
      sd: spread,
      exactNormal: false,
      values: population.slice(),
      inv(probability) {
        return sorted[clamp(Math.floor(safeProbability(probability) * sorted.length), 0, sorted.length - 1)];
      },
      cdf(value) {
        let count = 0;
        for (let index = 0; index < sorted.length; index += 1) {
          if (sorted[index] <= value) count += 1;
        }
        return count / sorted.length;
      },
      pdf(value) {
        return sorted.filter((item) => item === value).length / sorted.length;
      },
      draw(rng) {
        return population[Math.min(population.length - 1, Math.floor(rng() * population.length))];
      },
      drawMeanZ(rng, n) {
        const count = Math.max(1, Math.round(finite(n, 1)));
        let total = 0;
        for (let index = 0; index < count; index += 1) total += this.draw(rng);
        return (total / count - center) / (spread / Math.sqrt(count));
      }
    };
  }

  function modelFromOptions(options) {
    const opts = options || {};
    const population = numericArray(opts.population);
    if (population.length) return discreteModel(population, opts);
    const key = String(opts.distribution || opts.shape || "normal").toLowerCase();
    if (["skewed", "skew", "right-skew", "right-skewed"].includes(key)) return skewModel(opts);
    if (key === "uniform") return uniformModel(opts);
    if (["bimodal", "mixture", "two-peaks"].includes(key)) return bimodalModel(opts);
    return normalModel(opts);
  }

  function markers(model, requestedCount, domain) {
    if (model.kind === "discrete") {
      const counts = new Map();
      return model.values.map((value, index) => {
        const row = counts.get(value) || 0;
        counts.set(value, row + 1);
        return {
          id: index,
          probability: (index + 0.5) / model.values.length,
          value,
          row,
          discrete: true
        };
      });
    }
    const count = Math.max(20, Math.round(finite(requestedCount, 240)));
    // When a display `domain` is supplied, spread the markers across only the
    // probability mass that domain covers, so the dots form a deterministic bell
    // that fits the axis exactly — rather than laying them across the full
    // (unbounded) distribution and piling the clipped tails onto the edge
    // columns. Omit `domain` for the original full-range behaviour.
    const pLo = domain ? clamp(model.cdf(domain[0]), 0, 1) : 0;
    const pHi = domain ? clamp(model.cdf(domain[1]), 0, 1) : 1;
    const span = (pHi - pLo) || 1;
    return Array.from({ length: count }, (_, index) => {
      const probability = pLo + span * (index + 0.5) / count;
      return {
        id: index,
        probability,
        value: model.inv(probability),
        row: 0,
        discrete: false
      };
    });
  }

  function sourceIdFor(model, populationMarkers, observation, domain) {
    if (!populationMarkers.length) return -1;
    if (model.kind === "discrete") {
      const exact = populationMarkers.find((marker) => marker.value === observation.value);
      return exact ? exact.id : 0;
    }
    // Match the marker layout above: map the observation's probability into the
    // same restricted [pLo, pHi] band the markers were spread across, so each
    // sampled dot falls from the population dot nearest its value.
    const count = populationMarkers.length;
    const pLo = domain ? clamp(model.cdf(domain[0]), 0, 1) : 0;
    const pHi = domain ? clamp(model.cdf(domain[1]), 0, 1) : 1;
    const span = (pHi - pLo) || 1;
    return clamp(
      Math.round((observation.probability - pLo) / span * count - 0.5),
      0,
      count - 1
    );
  }

  function sampleRecord(model, n, rng, index, options) {
    const opts = options || {};
    const count = Math.max(1, Math.round(finite(n, 1)));
    const round = boolean(opts.roundObservations, false);
    const observations = Array.from({ length: count }, (_, sampleIndex) => {
      const rawValue = model.draw(rng);
      const value = round ? Math.round(rawValue) : rawValue;
      return {
        sampleIndex,
        rawValue,
        value,
        probability: clamp(model.cdf(rawValue), 0, 1)
      };
    });
    return {
      index,
      observations,
      sample: observations.map((item) => item.value),
      mean: mean(observations.map((item) => item.value))
    };
  }

  function finalizeRecords(records, binWidth) {
    const width = Math.max(0.0001, finite(binWidth, 1));
    const stacks = new Map();
    return records.map((record, index) => {
      const bin = Math.round(record.mean / width) * width;
      const key = bin.toFixed(8);
      const stackIndex = stacks.get(key) || 0;
      stacks.set(key, stackIndex + 1);
      return Object.assign({}, record, { index, bin, stackIndex });
    });
  }

  function randomRecords(model, options) {
    const opts = options || {};
    const n = Math.max(1, Math.round(finite(opts.n ?? opts.sampleSize, 10)));
    const count = Math.max(1, Math.round(finite(opts.count ?? opts.sampleCount, 200)));
    const rng = seededRng(opts.seed ?? "sampling-records-v1");
    const records = Array.from({ length: count }, (_, index) =>
      sampleRecord(model, n, rng, index, opts)
    );
    return finalizeRecords(records, opts.binWidth);
  }

  function exhaustiveRecords(model, options) {
    const opts = options || {};
    const values = model.kind === "discrete" ? model.values : [];
    const n = Math.max(1, Math.round(finite(opts.n ?? opts.sampleSize, 2)));
    const replacement = boolean(opts.replacement, true);
    const ordered = boolean(opts.ordered, true);
    const firstFast = String(opts.sampleOrder || "first-varies-fastest") !== "last-varies-fastest";
    const limit = Math.max(1, Math.round(finite(opts.maxSamples, 50000)));
    const samples = [];

    if (replacement && ordered) {
      const total = Math.min(limit, Math.pow(values.length, n));
      for (let recordIndex = 0; recordIndex < total; recordIndex += 1) {
        const sample = [];
        for (let position = 0; position < n; position += 1) {
          const exponent = firstFast ? position : n - position - 1;
          const valueIndex = Math.floor(recordIndex / Math.pow(values.length, exponent)) % values.length;
          sample.push(values[valueIndex]);
        }
        samples.push(sample);
      }
    } else {
      function visit(sample, used, start) {
        if (samples.length >= limit) return;
        if (sample.length === n) {
          samples.push(sample.slice());
          return;
        }
        const begin = ordered ? 0 : start;
        for (let valueIndex = begin; valueIndex < values.length; valueIndex += 1) {
          if (!replacement && used.has(valueIndex)) continue;
          sample.push(values[valueIndex]);
          used.add(valueIndex);
          visit(sample, used, replacement && !ordered ? valueIndex : valueIndex + 1);
          used.delete(valueIndex);
          sample.pop();
        }
      }
      visit([], new Set(), 0);
    }

    const records = samples.map((sample, index) => ({
      index,
      sample: sample.slice(),
      observations: sample.map((value, sampleIndex) => ({
        sampleIndex,
        rawValue: value,
        value,
        probability: clamp(model.cdf(value) - model.pdf(value) / 2, 0, 1)
      })),
      mean: mean(sample)
    }));
    return finalizeRecords(records, opts.binWidth);
  }

  function standardError(model, n) {
    return model.sd / Math.sqrt(Math.max(1, finite(n, 1)));
  }

  function standardizedMean(sampleMean, model, n) {
    return (sampleMean - model.mean) / standardError(model, n);
  }

  function createHistogram(options) {
    const opts = options || {};
    const domain = Array.isArray(opts.domain) && opts.domain.length >= 2
      ? [Number(opts.domain[0]), Number(opts.domain[1])]
      : [-3, 3];
    const bins = Math.max(20, Math.round(finite(opts.bins, 180)));
    const width = (domain[1] - domain[0]) / bins;
    const counts = new Uint32Array(bins);
    let total = 0;
    let included = 0;
    let sum = 0;
    let sumSquares = 0;

    function add(value) {
      if (!Number.isFinite(value)) return -1;
      total += 1;
      sum += value;
      sumSquares += value * value;
      if (value < domain[0] || value >= domain[1]) return -1;
      const index = clamp(Math.floor((value - domain[0]) / width), 0, bins - 1);
      counts[index] += 1;
      included += 1;
      return index;
    }

    function reset() {
      counts.fill(0);
      total = 0;
      included = 0;
      sum = 0;
      sumSquares = 0;
    }

    function data() {
      return Array.from(counts, (count, index) => ({
        index,
        z0: domain[0] + index * width,
        z1: domain[0] + (index + 1) * width,
        z: domain[0] + (index + 0.5) * width,
        count,
        density: total ? count / (total * width) : 0
      }));
    }

    return {
      domain: domain.slice(),
      bins,
      width,
      counts,
      add,
      reset,
      data,
      get total() { return total; },
      get included() { return included; },
      get mean() { return total ? sum / total : NaN; },
      get sd() {
        if (!total) return NaN;
        const center = sum / total;
        return Math.sqrt(Math.max(0, sumSquares / total - center * center));
      }
    };
  }

  function addSimulatedMeans(histogram, model, n, rng, count) {
    const draws = Math.max(0, Math.round(finite(count, 0)));
    for (let index = 0; index < draws; index += 1) {
      histogram.add(model.drawMeanZ(rng, n));
    }
    return histogram;
  }

  global.bcSampling = Object.freeze({
    actionKey,
    addSimulatedMeans,
    bimodalModel,
    boolean,
    clamp,
    createHistogram,
    discreteModel,
    exhaustiveRecords,
    fastNormalDraw,
    finite,
    hashSeed,
    markers,
    mean,
    modelFromOptions,
    normalModel,
    numericArray,
    randomRecords,
    rightSkewedModel,
    rightSkewedFormationCounts,
    sampleRecord,
    sdN,
    seededRng,
    skewDescription,
    skewModel,
    sourceIdFor,
    standardError,
    standardizedMean,
    uniformModel
  });
}(window));
