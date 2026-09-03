(function(global) {
  "use strict";

  const SQRT_TWO = Math.sqrt(2);
  const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);
  const LOG_SQRT_TWO_PI = Math.log(SQRT_TWO_PI);
  const LANCZOS_G = 7;
  const LANCZOS_COEFFICIENTS = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];

  function erf(x) {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
    return sign * y;
  }

  function normalPdf(x, mean = 0, sd = 1) {
    if (!(sd > 0)) return NaN;
    const z = (x - mean) / sd;
    return Math.exp(-0.5 * z * z) / (sd * SQRT_TWO_PI);
  }

  function normalCdf(x, mean = 0, sd = 1) {
    if (!(sd > 0)) return NaN;
    return 0.5 * (1 + erf((x - mean) / (sd * SQRT_TWO)));
  }

  function normalInv(p, mean = 0, sd = 1) {
    if (!(sd > 0)) return NaN;
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;

    const a = [
      -3.969683028665376e1,
      2.209460984245205e2,
      -2.759285104469687e2,
      1.383577518672690e2,
      -3.066479806614716e1,
      2.506628277459239
    ];
    const b = [
      -5.447609879822406e1,
      1.615858368580409e2,
      -1.556989798598866e2,
      6.680131188771972e1,
      -1.328068155288572e1
    ];
    const c = [
      -7.784894002430293e-3,
      -3.223964580411365e-1,
      -2.400758277161838,
      -2.549732539343734,
      4.374664141464968,
      2.938163982698783
    ];
    const d = [
      7.784695709041462e-3,
      3.224671290700398e-1,
      2.445134137142996,
      3.754408661907416
    ];

    const plow = 0.02425;
    const phigh = 1 - plow;
    let q;
    let z;

    if (p < plow) {
      q = Math.sqrt(-2 * Math.log(p));
      z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p > phigh) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else {
      q = p - 0.5;
      const r = q * q;
      z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }

    return mean + sd * z;
  }

  function logGamma(z) {
    if (z <= 0 && Number.isInteger(z)) return NaN;
    if (z < 0.5) {
      return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
    }

    z -= 1;
    let x = LANCZOS_COEFFICIENTS[0];
    for (let i = 1; i < LANCZOS_COEFFICIENTS.length; i += 1) {
      x += LANCZOS_COEFFICIENTS[i] / (z + i);
    }
    const t = z + LANCZOS_G + 0.5;
    return LOG_SQRT_TWO_PI + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  function gamma(z) {
    return Math.exp(logGamma(z));
  }

  function logBeta(a, b) {
    if (!(a > 0) || !(b > 0)) return NaN;
    return logGamma(a) + logGamma(b) - logGamma(a + b);
  }

  function beta(a, b) {
    return Math.exp(logBeta(a, b));
  }

  function betaContinuedFraction(x, a, b) {
    const maxIterations = 200;
    const epsilon = 3e-14;
    const tiny = 1e-300;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;

    for (let m = 1; m <= maxIterations; m += 1) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aa / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      h *= d * c;

      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aa / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < epsilon) break;
    }

    return h;
  }

  function regularizedBeta(x, a, b) {
    if (!(a > 0) || !(b > 0)) return NaN;
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    const logFront = logGamma(a + b) - logGamma(a) - logGamma(b) +
      a * Math.log(x) + b * Math.log1p(-x);
    const front = Math.exp(logFront);

    if (x < (a + 1) / (a + b + 2)) {
      return front * betaContinuedFraction(x, a, b) / a;
    }

    return 1 - front * betaContinuedFraction(1 - x, b, a) / b;
  }

  function quantileByBisection(p, cdf, lower, upper) {
    for (let i = 0; i < 90; i += 1) {
      const midpoint = (lower + upper) / 2;
      const value = cdf(midpoint);
      if (value < p) {
        lower = midpoint;
      } else {
        upper = midpoint;
      }
    }

    return (lower + upper) / 2;
  }

  function tPdf(x, df = 1, mean = 0, scale = 1) {
    if (!(df > 0) || !(scale > 0)) return NaN;
    const t = (x - mean) / scale;
    const logDensity = logGamma((df + 1) / 2) - logGamma(df / 2) -
      0.5 * Math.log(df * Math.PI) -
      ((df + 1) / 2) * Math.log1p((t * t) / df);
    return Math.exp(logDensity) / scale;
  }

  function tCdf(x, df = 1, mean = 0, scale = 1) {
    if (!(df > 0) || !(scale > 0)) return NaN;
    const t = (x - mean) / scale;
    if (t === 0) return 0.5;
    if (t === Infinity) return 1;
    if (t === -Infinity) return 0;
    const ib = regularizedBeta(df / (df + t * t), df / 2, 0.5);
    return t > 0 ? 1 - 0.5 * ib : 0.5 * ib;
  }

  function tInv(p, df = 1, mean = 0, scale = 1) {
    if (!(df > 0) || !(scale > 0)) return NaN;
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p === 0.5) return mean;

    let span = scale;
    let lower = mean - span;
    let upper = mean + span;
    while (tCdf(lower, df, mean, scale) > p && span < 1e12 * scale) {
      span *= 2;
      lower = mean - span;
    }
    span = scale;
    while (tCdf(upper, df, mean, scale) < p && span < 1e12 * scale) {
      span *= 2;
      upper = mean + span;
    }

    return quantileByBisection(p, (value) => tCdf(value, df, mean, scale), lower, upper);
  }

  function owensT(h, a) {
    if (a === 0 || !Number.isFinite(h)) return 0;
    if (a < 0) return -owensT(h, -a);

    // Simpson quadrature of the Owen's T integrand over [0, a].
    const steps = 100;
    const width = a / steps;
    const hh = h * h;
    const integrand = (t) => Math.exp(-0.5 * hh * (1 + t * t)) / (1 + t * t);
    let sum = integrand(0) + integrand(a);
    for (let i = 1; i < steps; i += 1) {
      sum += integrand(i * width) * (i % 2 === 0 ? 2 : 4);
    }
    return (width / 3) * sum / (2 * Math.PI);
  }

  function skewNormalPdf(x, location = 0, scale = 1, shape = 0) {
    if (!(scale > 0)) return NaN;
    const z = (x - location) / scale;
    return 2 * normalPdf(z) * normalCdf(shape * z) / scale;
  }

  function skewNormalCdf(x, location = 0, scale = 1, shape = 0) {
    if (!(scale > 0)) return NaN;
    if (x === Infinity) return 1;
    if (x === -Infinity) return 0;
    const z = (x - location) / scale;
    // The erf approximation's ~1e-7 error can push the difference slightly
    // outside [0, 1] where the two terms nearly cancel; clamp.
    return Math.min(1, Math.max(0, normalCdf(z) - 2 * owensT(z, shape)));
  }

  function skewNormalInv(p, location = 0, scale = 1, shape = 0) {
    if (!(scale > 0)) return NaN;
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;

    let span = scale;
    let lower = location - span;
    let upper = location + span;
    while (skewNormalCdf(lower, location, scale, shape) > p && span < 1e12 * scale) {
      span *= 2;
      lower = location - span;
    }
    span = scale;
    while (skewNormalCdf(upper, location, scale, shape) < p && span < 1e12 * scale) {
      span *= 2;
      upper = location + span;
    }

    return quantileByBisection(p, (value) => skewNormalCdf(value, location, scale, shape), lower, upper);
  }

  function skewNormalMean(location = 0, scale = 1, shape = 0) {
    if (!(scale > 0)) return NaN;
    const delta = shape / Math.sqrt(1 + shape * shape);
    return location + scale * delta * Math.sqrt(2 / Math.PI);
  }

  function fPdf(x, df1 = 1, df2 = 1, location = 0, scale = 1) {
    if (!(df1 > 0) || !(df2 > 0) || !(scale > 0)) return NaN;
    const value = (x - location) / scale;
    if (!(value > 0)) return 0;
    const logDensity = (df1 / 2) * Math.log(df1 / df2) +
      (df1 / 2 - 1) * Math.log(value) -
      logBeta(df1 / 2, df2 / 2) -
      ((df1 + df2) / 2) * Math.log1p((df1 * value) / df2);
    return Math.exp(logDensity) / scale;
  }

  function fCdf(x, df1 = 1, df2 = 1, location = 0, scale = 1) {
    if (!(df1 > 0) || !(df2 > 0) || !(scale > 0)) return NaN;
    const value = (x - location) / scale;
    if (value <= 0) return 0;
    if (value === Infinity) return 1;
    const betaX = (df1 * value) / (df1 * value + df2);
    return regularizedBeta(betaX, df1 / 2, df2 / 2);
  }

  function fInv(p, df1 = 1, df2 = 1, location = 0, scale = 1) {
    if (!(df1 > 0) || !(df2 > 0) || !(scale > 0)) return NaN;
    if (p <= 0) return location;
    if (p >= 1) return Infinity;

    let lower = location;
    let upper = location + scale;
    while (fCdf(upper, df1, df2, location, scale) < p && upper - location < 1e12 * scale) {
      upper = location + (upper - location) * 2;
    }

    return quantileByBisection(p, (value) => fCdf(value, df1, df2, location, scale), lower, upper);
  }

  function finiteNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  const previous = global.sfsStats || {};
  global.sfsStats = Object.assign({}, previous, {
    erf,
    normalPdf,
    normalCdf,
    normalInv,
    normalQuantile: normalInv,
    logGamma,
    gamma,
    logBeta,
    beta,
    regularizedBeta,
    tPdf,
    tCdf,
    tInv,
    tQuantile: tInv,
    studentTPdf: tPdf,
    studentTCdf: tCdf,
    studentTInv: tInv,
    fPdf,
    fCdf,
    fInv,
    fQuantile: fInv,
    owensT,
    skewNormalPdf,
    skewNormalCdf,
    skewNormalInv,
    skewNormalQuantile: skewNormalInv,
    skewNormalMean,
    dnorm: normalPdf,
    pnorm: normalCdf,
    qnorm: normalInv,
    dt: tPdf,
    pt: tCdf,
    qt: tInv,
    df: fPdf,
    pf: fCdf,
    qf: fInv,
    finiteNumber,
    normal: Object.assign({}, previous.normal, {
      pdf: normalPdf,
      cdf: normalCdf,
      inv: normalInv,
      quantile: normalInv
    }),
    t: Object.assign({}, previous.t, {
      pdf: tPdf,
      cdf: tCdf,
      inv: tInv,
      quantile: tInv
    }),
    studentT: Object.assign({}, previous.studentT, {
      pdf: tPdf,
      cdf: tCdf,
      inv: tInv,
      quantile: tInv
    }),
    f: Object.assign({}, previous.f, {
      pdf: fPdf,
      cdf: fCdf,
      inv: fInv,
      quantile: fInv
    }),
    skewNormal: Object.assign({}, previous.skewNormal, {
      pdf: skewNormalPdf,
      cdf: skewNormalCdf,
      inv: skewNormalInv,
      quantile: skewNormalInv,
      mean: skewNormalMean
    })
  });
}(window));
