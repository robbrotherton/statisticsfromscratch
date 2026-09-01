// Bee-swarm physics + statistics kernel.
//
// Ported statement-for-statement from the prototype at
// psychstats/visualizations/bees/{bees.js,sketch.js}. The physics here are
// NUMERICALLY FROZEN: SE_VALUES below was brute-forced against this exact
// update rule (>=100k ticks per combination), so any change to the constants,
// the force math, or the update order invalidates the table and the swarm's
// hand-tuned feel. Cosmetic refactors only.
//
// The file has zero DOM/library dependencies and loads in both the browser
// (window.beeSwarmCore) and Node (module.exports) so the calibration can be
// re-verified headlessly against the shipping code.
//
// Reproducibility is per-engine: with a fixed seed, runs are bit-identical
// within one JS engine, but Math.hypot/cos/sin are not IEEE-exact across
// engines, and the flocking dynamics amplify last-ulp differences into
// different (statistically equivalent) trajectories. Statistical properties
// (SE table, alpha rate, power) hold everywhere; exact tick-level values do
// not transfer between Node, Chrome, and Safari. Chapter seeds were chosen
// by evaluating deterministic tutorial rebuilds in Chromium.
(function(global) {
  "use strict";

  var SIM_WIDTH = 840;
  var SIM_HEIGHT = 400;
  var NULL_MU = SIM_WIDTH * 0.5;
  var TICKS_PER_SECOND = 60;

  var VARIABILITY_LABELS = ["low", "medium", "high"];
  var ATTRACTOR_STRENGTHS = [1, 2, 4];
  var N_BEES_VALUES = [15, 50, 100];

  // Empirical SD of the sample-mean stream, measured over >=100k ticks per
  // (attractor strength x bee count) combination. There is no closed form for
  // these — the physics engine is the population.
  var SE_VALUES = [
    // nBees = [15, 50, 100]
    [4.86, 3, 2.28],   // attractorStrength = 1 (variability low)
    [8.3, 5.18, 3.9],  // attractorStrength = 2 (variability medium)
    [15.83, 9.1, 6.3]  // attractorStrength = 4 (variability high)
  ];

  // Same algorithm as bcSampling.seededRng (FNV-1a + mulberry32), duplicated
  // so the kernel stays dependency-free and Node-loadable.
  function hashSeed(seed) {
    var text = String(seed == null ? "bee-swarm-v1" : seed);
    var hash = 2166136261;
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    var state = seed >>> 0;
    return function() {
      state = (state + 0x6D2B79F5) >>> 0;
      var value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededRng(seed) {
    return mulberry32(hashSeed(seed));
  }

  // --- Vector helpers -------------------------------------------------------
  // Mutating {x, y} operations replicating p5.Vector semantics exactly,
  // including the guards the physics depend on: div() ignores a zero divisor
  // (p5 warns and returns unchanged — this is what keeps tick 1 finite when
  // every bee spawns on the same point), and setMag() of a zero vector stays
  // zero (p5's normalize() only scales when the length is nonzero).

  function vec(x, y) {
    return { x: x || 0, y: y || 0 };
  }

  function vAdd(v, other) {
    v.x += other.x;
    v.y += other.y;
    return v;
  }

  function vSubInto(target, a, b) {
    target.x = a.x - b.x;
    target.y = a.y - b.y;
    return target;
  }

  function vDiv(v, n) {
    if (n === 0 || !isFinite(n)) return v;
    v.x /= n;
    v.y /= n;
    return v;
  }

  function vMult(v, n) {
    v.x *= n;
    v.y *= n;
    return v;
  }

  function vSetMag(v, magnitude) {
    var length = Math.sqrt(v.x * v.x + v.y * v.y);
    if (length !== 0) {
      v.x = (v.x / length) * magnitude;
      v.y = (v.y / length) * magnitude;
    }
    return v;
  }

  function vLimit(v, max) {
    var magSq = v.x * v.x + v.y * v.y;
    if (magSq > max * max) {
      var scale = max / Math.sqrt(magSq);
      v.x *= scale;
      v.y *= scale;
    }
    return v;
  }

  function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function random2DInto(target, rng) {
    var angle = rng() * Math.PI * 2;
    target.x = Math.cos(angle);
    target.y = Math.sin(angle);
    return target;
  }

  function randomRange(rng, low, high) {
    return low + rng() * (high - low);
  }

  // Per-call scratch vectors: reused so the live loop allocates nothing.
  // Pure allocation discipline — the arithmetic is identical to the prototype.
  var scratchSeparation = vec();
  var scratchAttraction = vec();
  var scratchJitter = vec();
  var scratchDiff = vec();

  // --- Bee ------------------------------------------------------------------

  function Bee(x, y, rng) {
    this.position = vec(x, y);
    this.velocity = random2DInto(vec(), rng);
    vSetMag(this.velocity, randomRange(rng, 2, 4));
    this.acceleration = vec();
    this.maxForce = 0.9; // Maximum steering force
    this.maxSpeed = 5;   // Maximum speed
    this.size = 8;       // Drawn radius
  }

  Bee.prototype.separation = function(bees, steering) {
    var perceptionRadius = 30;
    steering.x = 0;
    steering.y = 0;
    var total = 0;
    for (var index = 0; index < bees.length; index += 1) {
      var other = bees[index];
      var d = dist(this.position.x, this.position.y, other.position.x, other.position.y);
      if (other !== this && d < perceptionRadius) {
        var diff = vSubInto(scratchDiff, this.position, other.position);
        vDiv(diff, d * d); // Weight by distance
        vAdd(steering, diff);
        total += 1;
      }
    }
    if (total > 0) {
      vDiv(steering, total);
      vSetMag(steering, this.maxSpeed);
      steering.x -= this.velocity.x;
      steering.y -= this.velocity.y;
      vLimit(steering, this.maxForce);
    }
    return steering;
  };

  // Update-order quirk preserved from the prototype and LOAD-BEARING:
  // position integrates the previous tick's velocity BEFORE the new
  // acceleration is applied. The SE table was calibrated with this ordering.
  Bee.prototype.update = function() {
    vAdd(this.position, this.velocity);
    vAdd(this.velocity, this.acceleration);
    vLimit(this.velocity, this.maxSpeed);
    this.acceleration.x = 0;
    this.acceleration.y = 0;
  };

  Bee.prototype.attract = function(attractor, attractorStrength, force) {
    vSubInto(force, attractor, this.position);
    vSetMag(force, 1 / attractorStrength); // Weaker pull = looser swarm
    return force;
  };

  Bee.prototype.flock = function(bees, attractor, attractorStrength, rng) {
    var separation = this.separation(bees, scratchSeparation);
    var attraction = this.attract(attractor, attractorStrength, scratchAttraction);
    var randomForce = vMult(random2DInto(scratchJitter, rng), 1.5);
    vAdd(this.acceleration, separation);
    vAdd(this.acceleration, attraction);
    vAdd(this.acceleration, randomForce);
  };

  // --- Swarm ----------------------------------------------------------------

  function Swarm(num, rng) {
    this.bees = [];
    this.attractor = vec(0, 0);
    this.attractorStrength = ATTRACTOR_STRENGTHS[1];
    this.currentMean = 0;
    this.rng = rng;
    for (var index = 0; index < num; index += 1) {
      this.bees.push(new Bee(this.attractor.x, this.attractor.y, rng));
    }
  }

  Swarm.prototype.run = function() {
    var bees = this.bees;
    for (var index = 0; index < bees.length; index += 1) {
      bees[index].flock(bees, this.attractor, this.attractorStrength, this.rng);
      bees[index].update();
    }
    var total = 0;
    for (var meanIndex = 0; meanIndex < bees.length; meanIndex += 1) {
      total += bees[meanIndex].position.x;
    }
    this.currentMean = total / bees.length;
  };

  // Bee-count changes match the prototype's beesController.setNumber: new
  // bees launch from the attractor mid-flight, extras are spliced away.
  Swarm.prototype.setCount = function(count) {
    while (this.bees.length < count) {
      this.bees.push(new Bee(this.attractor.x, this.attractor.y, this.rng));
    }
    if (this.bees.length > count) {
      this.bees.splice(count);
    }
  };

  // Positions only: replay never needs velocities.
  Swarm.prototype.getFrame = function() {
    var frame = new Array(this.bees.length);
    for (var index = 0; index < this.bees.length; index += 1) {
      frame[index] = { x: this.bees[index].position.x, y: this.bees[index].position.y };
    }
    return frame;
  };

  // --- Histogram ------------------------------------------------------------
  // Sparse 1px integer bins over [min, max], ported verbatim.

  function Histogram(min, max) {
    this.min = min;
    this.max = max;
    this.counts = {};
    this.total = 0;
  }

  Histogram.prototype.add = function(value) {
    if (value < this.min || value > this.max) return;
    var x = Math.floor(value);
    if (!this.counts[x]) this.counts[x] = 0;
    this.counts[x] += 1;
    this.total += 1;
  };

  Histogram.prototype.getSd = function() {
    var mean = 0;
    var keys = Object.keys(this.counts);
    var index;
    for (index = 0; index < keys.length; index += 1) {
      mean += Number(keys[index]) * this.counts[keys[index]];
    }
    mean /= this.total;
    var variance = 0;
    for (index = 0; index < keys.length; index += 1) {
      var difference = Number(keys[index]) - mean;
      variance += this.counts[keys[index]] * difference * difference;
    }
    variance /= this.total;
    return Math.sqrt(variance);
  };

  Histogram.prototype.reset = function() {
    this.counts = {};
    this.total = 0;
  };

  // --- Simulation facade ----------------------------------------------------
  // One tick == one sample observation at 60 ticks/second. Coordinates are
  // attractor-relative on x (hiveOffset shifts the attractor); observations
  // are shifted into [0, SIM_WIDTH] space by NULL_MU, exactly as the
  // prototype's `currentMean + canvasWidth * 0.5`.

  function createSim(options) {
    options = options || {};
    var rng = options.rng || seededRng(options.seed);
    var variabilityIndex = options.variabilityIndex != null ? options.variabilityIndex : 1;
    var nIndex = options.nIndex != null ? options.nIndex : 1;
    var hiveOffset = options.hiveOffset || 0;

    var swarm = new Swarm(0, rng);
    swarm.attractor.x = hiveOffset;
    swarm.attractorStrength = ATTRACTOR_STRENGTHS[variabilityIndex];
    swarm.setCount(N_BEES_VALUES[nIndex]);

    var sim = {
      swarm: swarm,
      rng: rng,
      // Advances one tick and returns the observation in [0, SIM_WIDTH] space.
      tick: function() {
        swarm.run();
        return swarm.currentMean + NULL_MU;
      },
      setVariabilityIndex: function(index) {
        swarm.attractorStrength = ATTRACTOR_STRENGTHS[index];
      },
      setNIndex: function(index) {
        swarm.setCount(N_BEES_VALUES[index]);
      },
      setHiveOffset: function(offset) {
        swarm.attractor.x = offset;
      }
    };
    return sim;
  }

  var api = {
    SIM_WIDTH: SIM_WIDTH,
    SIM_HEIGHT: SIM_HEIGHT,
    NULL_MU: NULL_MU,
    TICKS_PER_SECOND: TICKS_PER_SECOND,
    VARIABILITY_LABELS: VARIABILITY_LABELS,
    ATTRACTOR_STRENGTHS: ATTRACTOR_STRENGTHS,
    N_BEES_VALUES: N_BEES_VALUES,
    SE_VALUES: SE_VALUES,
    seededRng: seededRng,
    Bee: Bee,
    Swarm: Swarm,
    Histogram: Histogram,
    createSim: createSim
  };

  global.beeSwarmCore = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
}(typeof window !== "undefined" ? window : globalThis));
