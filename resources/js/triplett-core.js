// The rules of the Chapter 13 competition-machine game, kept apart from its
// drawing (triplett-race.js) so either can be tuned alone and the rules can
// be tested without a browser.
//
//   createCircleTracker  turns a stream of pointer positions into reel turns
//   createRivalPace      the rival flag's progress over time
//   createRace           one race: ready -> countdown -> racing -> finished
//
// Everything is exposed on window.sfsTriplett. Time is always passed in (in
// milliseconds), never read from a clock here.
(function(global) {
  "use strict";

  const TAU = Math.PI * 2;

  // Behavior settings. The view passes overrides through from figure options.
  const DEFAULTS = {
    laps: 4,               // Triplett's children wound the flag round four times
    turnsPerLap: 10,       // reel turns per lap; 40 turns is ~9 s of brisk circling
    practiceLaps: 2,
    keyTurn: 0.5,          // turns per Space/Enter press (keyboard fallback)
    countdownBeats: 3,
    beatMs: 1000,
    idleResetMs: 6000,     // a race nobody is winding returns to ready
    advanceDelayMs: 1800,  // pause on a finished race before moving on
    // The rival (see createRival). Progress is a fraction of the race.
    rivalFactor: 1,        // its own pace: the reader's alone time...
    rivalDefaultSeconds: 9, // ...or this, before there is an alone time
    rivalMinSeconds: 3,
    rivalLead: 0.05,       // how far ahead or behind it drifts mid-race
    rivalMargin: 0.02,     // how far behind it settles by the finish (~0.2 s)
    rivalChaseMs: 600,     // how quickly it closes on its spot
    rivalMinPace: 0.7,     // never slower or faster than these multiples
    rivalMaxPace: 1.6,     // of its own pace
    rivalReactionMs: 250,  // its slight delay off the line
    rivalSeed: 1898        // every reader faces the same rival
  };

  function wrapAngle(angle) {
    while (angle <= -Math.PI) angle += TAU;
    while (angle > Math.PI) angle -= TAU;
    return angle;
  }

  // Counts circles by how far the pointer's direction of travel turns, not by
  // its angle around a fixed center, so small circles drawn anywhere count
  // and nobody has to aim at the reel.
  //
  // Turning is summed with its sign and credited only when the running total
  // passes its previous best, so the wobble in a straight or zigzag scribble
  // cancels out instead of adding up. A reversal (a turn sharper than
  // maxTurn between samples) earns nothing. Readers may circle either way:
  // the direction locks after a quarter turn, and if they keep winding the
  // other way for half a turn it flips to follow them.
  function createCircleTracker(opts) {
    opts = opts || {};
    const minStep = opts.minStep || 5;           // px between samples
    const maxTurn = opts.maxTurn || Math.PI * 0.6;
    const lockAt = opts.lockAt || TAU * 0.25;
    const flipAfter = opts.flipAfter || TAU * 0.5;

    let anchor = null;
    let heading = null;
    let total = 0;
    let best = 0;
    let direction = 0;

    function credit() {
      if (!direction) {
        if (Math.abs(total) < lockAt) return 0;
        direction = Math.sign(total);
        best = 0;
      }
      const signed = direction * total;
      if (signed > best) {
        const gain = signed - best;
        best = signed;
        return gain / TAU;
      }
      if (best - signed > flipAfter) {
        direction = -direction;
        best = direction * total;
      }
      return 0;
    }

    return {
      // Returns the turns (>= 0) this position adds.
      move(x, y) {
        if (!anchor) {
          anchor = { x, y };
          return 0;
        }
        const dx = x - anchor.x;
        const dy = y - anchor.y;
        if (Math.hypot(dx, dy) < minStep) return 0;
        anchor = { x, y };
        const next = Math.atan2(dy, dx);
        if (heading === null) {
          heading = next;
          return 0;
        }
        const turn = wrapAngle(next - heading);
        heading = next;
        if (Math.abs(turn) > maxTurn) return 0;
        total += turn;
        return credit();
      },
      // A new stroke (finger lifted, mouse left and came back): forget where
      // the pointer was, but keep the turning already done.
      lift() {
        anchor = null;
        heading = null;
      },
      reset() {
        anchor = null;
        heading = null;
        total = 0;
        best = 0;
        direction = 0;
      }
    };
  }

  // Mulberry32: small, seedable, good enough for a wobble.
  function seededRandom(seed) {
    let a = seed >>> 0;
    return function() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // The rival chases a spot near the reader: the reader's progress plus a
  // lead that drifts slowly between ahead and behind, and by the finish
  // settles a whisker behind. It has its own pace (the reader's alone time)
  // and speeds up or eases off to hold that spot, but only within human
  // limits, so a reader who slows right down or stops is passed and beaten.
  // The drift comes from a fixed seed: every reader faces the same rival.
  function createRival(opts) {
    opts = opts || {};
    const settings = Object.assign({}, DEFAULTS, opts.settings || {});
    const seconds = Math.max(0.5, Number(opts.seconds) || settings.rivalDefaultSeconds);
    const random = typeof opts.random === "function" ? opts.random : seededRandom(settings.rivalSeed);
    const pace = 1 / seconds;                // fraction of the race per second
    const reaction = settings.rivalReactionMs / 1000;
    const chase = settings.rivalChaseMs / 1000;
    const phase1 = random() * TAU;
    const phase2 = random() * TAU;
    let progress = 0;
    let elapsed = 0;
    let finishedAt = null;

    // Where the rival wants to be, relative to the reader.
    function lead(t, reader) {
      const drift = 0.6 * Math.sin(TAU * 0.12 * t + phase1) + 0.4 * Math.sin(TAU * 0.31 * t + phase2);
      const easeIn = Math.min(1, t / 1.5);
      return easeIn * (1 - reader) * settings.rivalLead * drift - settings.rivalMargin * reader;
    }

    function advance(dt, reader) {
      elapsed += dt;
      const t = elapsed - reaction;
      if (t <= 0 || finishedAt !== null) return;
      const target = reader + lead(t, reader);
      // Chasing from the reader's average pace so far, rather than its own,
      // keeps it close behind slow and fast readers alike.
      const cruise = t > 1 && reader < 1 ? reader / t : pace;
      const speed = Math.max(settings.rivalMinPace * pace,
        Math.min(settings.rivalMaxPace * pace, cruise + (target - progress) / chase));
      const next = progress + speed * dt;
      if (next >= 1) {
        finishedAt = elapsed - (next - 1) / speed;
        progress = 1;
      } else {
        progress = next;
      }
    }

    return {
      seconds,
      get progress() { return progress; },
      // Seconds from the start to the rival's finish, once it has finished.
      get finishedSeconds() { return finishedAt; },
      // dtMs since the last step; reader is the reader's progress (0 to 1).
      step(dtMs, reader) {
        let remaining = Math.max(0, dtMs) / 1000;
        while (remaining > 0) {
          const dt = Math.min(0.05, remaining);
          advance(dt, reader);
          remaining -= dt;
        }
        return progress;
      }
    };
  }

  // The rival's own pace, as seconds for the whole race.
  function rivalSeconds(aloneSeconds, settings) {
    settings = Object.assign({}, DEFAULTS, settings || {});
    const base = Number(aloneSeconds) > 0 ? aloneSeconds * settings.rivalFactor : settings.rivalDefaultSeconds;
    return Math.max(settings.rivalMinSeconds, base);
  }

  const PHASES = ["practice", "alone", "competition"];

  function normalizePhase(value) {
    return PHASES.includes(value) ? value : "practice";
  }

  // One race. Practice is untimed, a single lap, and skips the countdown.
  function createRace(opts) {
    opts = opts || {};
    const settings = Object.assign({}, DEFAULTS, opts.settings || {});
    const phase = normalizePhase(opts.phase);
    const laps = phase === "practice" ? settings.practiceLaps : settings.laps;
    const totalTurns = laps * settings.turnsPerLap;
    const makeRival = () => phase === "competition"
      ? createRival({
          seconds: opts.rivalSeconds || rivalSeconds(opts.aloneSeconds, settings),
          settings,
          random: opts.random
        })
      : null;
    let rival = makeRival();

    let status = "ready";
    let goAt = null;
    let startedAt = null;
    let lastInputAt = null;
    let turns = 0;
    let finishedAt = null;
    let rivalAt = null;

    const race = {
      phase,
      laps,
      totalTurns,
      settings,
      get rival() { return rival; },
      get status() { return status; },

      // Start button or key: counts down, except in practice.
      arm(now) {
        if (status !== "ready") return false;
        if (phase === "practice") {
          status = "racing";
          startedAt = now;
        } else {
          status = "countdown";
          goAt = now + settings.countdownBeats * settings.beatMs;
        }
        lastInputAt = now;
        return true;
      },

      // Advance the clock: ends the countdown, and returns an abandoned race
      // to ready. Returns the status it changed to, or null.
      tick(now) {
        if (status === "countdown" && now >= goAt) {
          status = "racing";
          startedAt = goAt;
          lastInputAt = goAt;
          rivalAt = goAt;
          return status;
        }
        if (status === "racing" && now - lastInputAt > settings.idleResetMs) {
          race.reset();
          return status;
        }
        // The rival keeps running after the reader finishes, to its own line.
        if (rival && rivalAt !== null && now > rivalAt) {
          rival.step(now - rivalAt, turns / totalTurns);
          rivalAt = now;
        }
        return null;
      },

      // Returns true when this input crossed the finish.
      addTurns(amount, now) {
        if (status !== "racing" || !(amount > 0)) return false;
        lastInputAt = now;
        turns = Math.min(totalTurns, turns + amount);
        if (turns < totalTurns) return false;
        status = "finished";
        finishedAt = now;
        return true;
      },

      reset() {
        status = "ready";
        goAt = null;
        startedAt = null;
        lastInputAt = null;
        turns = 0;
        finishedAt = null;
        rivalAt = null;
        rival = makeRival();
      },

      // Everything the view draws, at a moment in time.
      snapshot(now) {
        const end = status === "finished" ? finishedAt : now;
        const elapsedMs = startedAt === null ? 0 : Math.max(0, end - startedAt);
        const rivalProgress = rival ? rival.progress : 0;
        const rivalSeconds = rival ? rival.finishedSeconds : null;
        const progress = turns / totalTurns;
        return {
          phase,
          status,
          turns,
          progress,
          lap: Math.min(laps, Math.floor(progress * laps) + 1),
          laps,
          elapsedMs,
          countdown: status === "countdown"
            ? Math.max(1, Math.ceil((goAt - now) / settings.beatMs))
            : null,
          rivalTurns: rivalProgress * totalTurns,
          rivalProgress,
          rivalSeconds,
          seconds: status === "finished" ? elapsedMs / 1000 : null,
          won: status === "finished" && rival
            ? rivalSeconds === null || elapsedMs / 1000 < rivalSeconds
            : null
        };
      }
    };
    return race;
  }

  global.sfsTriplett = {
    DEFAULTS,
    PHASES,
    wrapAngle,
    seededRandom,
    createCircleTracker,
    createRival,
    rivalSeconds,
    createRace
  };
})(typeof window !== "undefined" ? window : globalThis);
