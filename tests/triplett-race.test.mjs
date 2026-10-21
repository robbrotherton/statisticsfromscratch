import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { divById, readChapter, tutorialSteps } from "./helpers/qmd.mjs";

function loadTriplett() {
  const context = { console };
  context.window = context;
  vm.createContext(context);
  for (const name of ["triplett-core.js", "triplett-race.js"]) {
    const source = readFileSync(new URL(`../resources/js/${name}`, import.meta.url), "utf8");
    vm.runInContext(source, context, { filename: name });
  }
  return { core: context.sfsTriplett, machine: context.sfsTriplettMachine };
}

const { core, machine } = loadTriplett();

// Feeds a tracker n circles of radius r around (cx, cy), with optional
// jitter and whole-pixel rounding like real pointer coordinates.
function drawCircles(tracker, { n, r = 30, cx = 0, cy = 0, direction = 1, perTurn = 20, jitter = 0, seed = 1 }) {
  const random = core.seededRandom(seed);
  let turns = 0;
  for (let i = 0; i <= n * perTurn; i += 1) {
    const angle = direction * (i / perTurn) * 2 * Math.PI;
    turns += tracker.move(
      Math.round(cx + r * Math.cos(angle) + (random() - 0.5) * jitter),
      Math.round(cy + r * Math.sin(angle) + (random() - 0.5) * jitter)
    );
  }
  return turns;
}

test("circles count as turns wherever, however big, and whichever way they are drawn", () => {
  for (const shape of [
    { r: 30, cx: 100, cy: 80 },
    { r: 30, direction: -1 },
    { r: 14, perTurn: 12, jitter: 2 },
    { r: 120, perTurn: 60, jitter: 1 },
    { r: 60, perTurn: 8 }
  ]) {
    const turns = drawCircles(core.createCircleTracker(), { n: 10, ...shape });
    assert.ok(turns > 9.5 && turns <= 10.01, `${JSON.stringify(shape)} gave ${turns}`);
  }
});

test("scribbling back and forth earns next to nothing", () => {
  const tracker = core.createCircleTracker();
  const random = core.seededRandom(9);
  let turns = 0;
  for (let stroke = 0; stroke < 30; stroke += 1) {
    for (let i = 0; i <= 40; i += 1) {
      const x = stroke % 2 ? 200 - i * 5 : i * 5;
      turns += tracker.move(Math.round(x + (random() - 0.5) * 3), Math.round(50 + x * 0.3 + (random() - 0.5) * 3));
    }
  }
  assert.ok(turns < 1, `30 strokes gave ${turns} turns`);
});

test("changing direction mid-race costs at most a fraction of a turn", () => {
  const tracker = core.createCircleTracker();
  const first = drawCircles(tracker, { n: 5 });
  const both = first + drawCircles(tracker, { n: 5, direction: -1, cx: 40 });
  assert.ok(both > 9, `gave ${both}`);
});

// Races a reader whose speed (a multiple of their alone pace) may change
// over time, and returns the finished snapshot.
function raceRival(readerSpeed, aloneSeconds = 9) {
  const race = core.createRace({ phase: "competition", aloneSeconds });
  const go = race.settings.countdownBeats * race.settings.beatMs;
  race.arm(0);
  race.tick(go);
  let now = go;
  const turnsPerSecond = race.totalTurns / aloneSeconds;
  let leadChanges = 0;
  let leader = 0;
  for (let frame = 0; frame < 4000; frame += 1) {
    now += 16;
    if (race.status === "racing") race.addTurns(turnsPerSecond * readerSpeed((now - go) / 1000) * 0.016, now);
    race.tick(now);
    const snap = race.snapshot(now);
    if (race.status === "racing") {
      const ahead = Math.sign(Math.round((snap.rivalProgress - snap.progress) * 200));
      if (ahead && leader && ahead !== leader) leadChanges += 1;
      if (ahead) leader = ahead;
    }
    if (race.status === "finished" && snap.rivalSeconds !== null) return { ...snap, leadChanges };
  }
  throw new Error("race never finished");
}

test("a reader who keeps winding beats the rival by a whisker, whatever their pace", () => {
  for (const speed of [0.75, 0.9, 1, 1.1, 1.25]) {
    const snap = raceRival(() => speed);
    const margin = snap.rivalSeconds - snap.seconds;
    assert.equal(snap.won, true, `speed ${speed}`);
    assert.ok(margin > 0.05 && margin < 0.5, `speed ${speed}: margin ${margin}`);
  }
});

test("the rival trades the lead with a reader along the way", () => {
  assert.ok(raceRival(() => 1).leadChanges >= 1);
  assert.ok(raceRival((t) => (t % 2 < 1 ? 1.4 : 0.6)).leadChanges >= 2);
});

test("a reader who slacks off is passed and beaten", () => {
  const snap = raceRival((t) => (t < 3 ? 1 : 0.5));
  assert.equal(snap.won, false);
  assert.ok(snap.seconds - snap.rivalSeconds > 1);
});

test("the rival keeps to human limits around its own pace", () => {
  const { rivalMaxPace, rivalMinPace, rivalReactionMs } = core.DEFAULTS;
  const seconds = 10;
  // The reader leaps far ahead, then far behind: the rival may not follow.
  for (const reader of [0.9, 0]) {
    const rival = core.createRival({ seconds });
    let previous = 0;
    for (let ms = 50; ms <= 3000; ms += 50) {
      const progress = rival.step(50, reader);
      if (ms > rivalReactionMs + 50) {
        const speed = (progress - previous) / 0.05;
        assert.ok(speed <= rivalMaxPace / seconds + 1e-9, `reader ${reader}: ${speed}`);
        assert.ok(speed >= rivalMinPace / seconds - 1e-9, `reader ${reader}: ${speed}`);
      }
      previous = progress;
    }
  }
});

test("every reader faces the same rival", () => {
  const a = core.createRival({ seconds: 8 });
  const b = core.createRival({ seconds: 8 });
  for (let i = 0; i < 100; i += 1) assert.equal(a.step(30, i / 150), b.step(30, i / 150));
});

test("the rival is paced from the reader's alone time", () => {
  const { rivalFactor, rivalDefaultSeconds, rivalMinSeconds } = core.DEFAULTS;
  assert.ok(Math.abs(core.rivalSeconds(10) - 10 * rivalFactor) < 1e-12);
  assert.equal(core.rivalSeconds(null), rivalDefaultSeconds);
  assert.equal(core.rivalSeconds(0.5), rivalMinSeconds);
});

test("a timed race counts down, ignores winding until Go, and times from Go", () => {
  const settings = { countdownBeats: 3, beatMs: 500, turnsPerLap: 2, laps: 2 };
  const race = core.createRace({ phase: "alone", settings });
  assert.equal(race.status, "ready");
  assert.equal(race.addTurns(1, 0), false);
  race.arm(1000);
  assert.equal(race.status, "countdown");
  assert.equal(race.snapshot(1100).countdown, 3);
  assert.equal(race.snapshot(2400).countdown, 1);
  race.addTurns(3, 2000);
  assert.equal(race.snapshot(2000).turns, 0);
  assert.equal(race.tick(2500), "racing");
  race.addTurns(3, 3000);
  assert.equal(race.snapshot(3000).lap, 2);
  assert.equal(race.addTurns(1.5, 4250), true);
  const done = race.snapshot(9999);
  assert.equal(done.status, "finished");
  assert.equal(done.seconds, 1.75);
  assert.equal(done.turns, 4);
});

test("practice is untimed, with no countdown", () => {
  const race = core.createRace({ phase: "practice" });
  assert.equal(race.laps, core.DEFAULTS.practiceLaps);
  race.arm(0);
  assert.equal(race.status, "racing");
  assert.equal(race.rival, null);
});

test("a race nobody is winding goes back to ready", () => {
  const race = core.createRace({ phase: "alone", settings: { countdownBeats: 0, idleResetMs: 1000 } });
  race.arm(0);
  race.tick(0);
  race.addTurns(1, 100);
  assert.equal(race.tick(900), null);
  assert.equal(race.tick(1200), "ready");
  assert.equal(race.snapshot(1200).turns, 0);
});

test("the cord loop is continuous and closes on itself", () => {
  const loop = machine.makeLoop({ x: 50, y: 60 }, { x: 400, y: 120 }, 6);
  const steps = 2000;
  let previous = machine.pointOnLoop(loop, 0);
  for (let i = 1; i <= steps; i += 1) {
    const point = machine.pointOnLoop(loop, (i / steps) * loop.length);
    assert.ok(Math.hypot(point.x - previous.x, point.y - previous.y) < (loop.length / steps) * 1.01 + 1e-9);
    previous = point;
  }
  const start = machine.pointOnLoop(loop, 0);
  assert.ok(Math.hypot(previous.x - start.x, previous.y - start.y) < 1e-9);
});

test("the machine and its flags stay inside the drawing at phone and desktop widths", () => {
  const { LOOK } = machine;
  for (const width of [280, 390, 560, 760]) {
    const g = machine.machineGeometry(width);
    const reach = LOOK.flagPole + 1;
    for (const station of Object.values(g.stations)) {
      for (let i = 0; i < 400; i += 1) {
        const p = machine.pointOnLoop(station.loop, (i / 400) * station.loop.length);
        const tip = { x: p.x + p.ox * reach, y: p.y + p.oy * reach };
        for (const q of [p, tip]) {
          assert.ok(q.x >= 0 && q.x <= g.width && q.y >= 0 && q.y <= g.height, `width ${width}: ${JSON.stringify(q)}`);
        }
      }
    }
  }
});

test("the chapter 13 game steps through practice, alone, competition, then results", () => {
  const steps = tutorialSteps(divById(readChapter("13-related-samples-t-test.qmd"), "act-triplett-race"));
  assert.deepEqual(steps.map((step) => step.action.phase), ["practice", "alone", "competition", "results"]);
  assert.deepEqual(steps.map((step) => Boolean(step.action.advanceOnFinish)), [true, true, true, false]);
});
