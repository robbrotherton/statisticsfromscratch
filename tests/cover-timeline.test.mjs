import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../resources/js/interactive-figure.js', import.meta.url), 'utf8');
function setup(reduced = false, { loaded = true, fontsReady = true } = {}) {
  const frames = new Map(), timers = new Map(), listeners = new Set();
  const events = new Map(), windowEvents = new Map(), drawn = [];
  let id = 0, observer, now = 0, resolveFonts;
  const fonts = new Promise(resolve => { resolveFonts = resolve; });
  if (fontsReady) resolveFonts();
  const motion = { shouldAnimate: requested => requested !== false && !reduced,
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
  const context = { window: { interactiveRuntime: { motion },
      addEventListener(name, callback) { windowEvents.set(name, callback); },
      removeEventListener(name) { windowEvents.delete(name); } },
    document: { readyState: loaded ? 'complete' : 'loading', fonts: { ready: fonts } },
    setTimeout(callback, delay) { timers.set(++id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observer = this; }
      observe() {} disconnect() { this.disconnected = true; }
    } };
  vm.runInNewContext(source, context);
  const root = { isConnected: true, style: {}, setAttribute() {},
    addEventListener(name, listener) { events.set(name, listener); },
    removeEventListener(name) { events.delete(name); } };
  const timeline = context.window.interactiveFigure.coverTimeline(root,
    { duration: 1000, draw: elapsed => drawn.push(elapsed) });
  return { frames, timers, root, timeline, drawn, events, listeners, windowEvents,
    visible(isIntersecting = true) { observer.callback([{ isIntersecting }]); },
    load() { context.document.readyState = 'complete'; windowEvents.get('load')?.(); },
    resolveFonts,
    async flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); },
    reduce() { reduced = true; listeners.forEach(listener => listener({ reduced })); },
    tick(time) { now = time; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now)); },
    elapse(ms) { now += ms; for (const [key, timer] of [...timers]) {
      if (timer.at <= now) { timers.delete(key); timer.callback(); }
    } }
  };
}

test('automatic entrance waits for visibility, load, fonts, two frames, and 200ms', async () => {
  const s = setup(false, { loaded: false, fontsReady: false });
  assert.deepEqual(s.drawn, [0]); assert.equal(s.frames.size, 0);
  s.visible(); assert.equal(s.frames.size, 0);
  s.load(); await s.flush(); assert.equal(s.frames.size, 0);
  s.resolveFonts(); await s.flush(); assert.equal(s.frames.size, 1);
  s.tick(0); s.tick(16);
  s.elapse(199); assert.deepEqual(s.drawn, [0]); assert.equal(s.frames.size, 0);
  s.elapse(1); assert.equal(s.frames.size, 1);
  s.tick(232); s.tick(732); assert.equal(s.drawn.at(-1), 500);
  s.tick(1232); assert.equal(s.drawn.at(-1), 1000); assert.equal(s.frames.size, 0);
});

test('slow loading is bounded by the readiness timeout', () => {
  const s = setup(false, { loaded: false, fontsReady: false });
  s.visible(); s.elapse(1999); assert.equal(s.frames.size, 0);
  s.elapse(1); assert.equal(s.frames.size, 1);
  s.tick(2016); s.tick(2032); s.elapse(200); s.tick(2248); s.tick(2748);
  assert.equal(s.drawn.at(-1), 500);
  assert.equal(s.windowEvents.size, 0);
});

test('replay starts immediately and cancels pending automatic entrance', async () => {
  const s = setup(false, { loaded: false, fontsReady: false });
  s.visible(); s.timeline.replay(); s.tick(0); s.tick(500);
  assert.equal(s.drawn.at(-1), 500);
  s.load(); s.resolveFonts(); await s.flush(); s.elapse(3000);
  assert.equal(s.frames.size, 1); assert.equal(s.timers.size, 0);
  assert.equal(s.drawn.at(-1), 500);
  s.timeline.replay(); s.tick(4000); s.tick(5000);
  assert.equal(s.drawn.at(-1), 1000); assert.equal(s.frames.size, 0);
});

test('leaving the viewport cancels preparation and returning prepares a fresh entrance', async () => {
  const s = setup(); s.visible(); await s.flush(); s.tick(0); s.tick(16);
  s.visible(false); s.elapse(1000);
  assert.equal(s.frames.size, 0); assert.equal(s.timers.size, 0);
  assert.deepEqual(s.drawn, [0]);
  s.visible(); await s.flush(); s.tick(1100); s.tick(1116); s.elapse(200);
  assert.equal(s.frames.size, 1);
});

test('reduced motion is immediate and cancels both preparation and in-flight motion', async () => {
  const staticCover = setup(true, { loaded: false, fontsReady: false });
  assert.deepEqual(staticCover.drawn, [1000]); assert.equal(staticCover.timers.size, 0);
  staticCover.timeline.replay(); assert.equal(staticCover.frames.size, 0);
  const waiting = setup(false, { fontsReady: false }); waiting.visible(); waiting.reduce();
  waiting.resolveFonts(); await waiting.flush(); waiting.elapse(3000);
  assert.equal(waiting.drawn.at(-1), 1000); assert.equal(waiting.frames.size, 0);
  const moving = setup(); moving.timeline.replay(); moving.tick(0); moving.tick(250); moving.reduce();
  assert.equal(moving.drawn.at(-1), 1000); assert.equal(moving.frames.size, 0);
});

test('keyboard replay and disposal leave no listeners or pending work', async () => {
  const s = setup(false, { loaded: false, fontsReady: false });
  s.visible(); let prevented = false;
  s.events.get('keydown')({ key: 'Enter', preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(s.frames.size, 1);
  s.root.sfsInteractive.dispose();
  assert.equal(s.frames.size, 0); assert.equal(s.listeners.size, 0); assert.equal(s.events.size, 0);
  assert.equal(s.windowEvents.size, 0); assert.equal(s.timers.size, 0);
  s.timeline.replay(); assert.equal(s.frames.size, 0);
  const waiting = setup(false, { fontsReady: false }); waiting.visible(); waiting.root.sfsInteractive.dispose();
  waiting.resolveFonts(); await waiting.flush(); waiting.elapse(3000);
  assert.deepEqual(waiting.drawn, [0]); assert.equal(waiting.frames.size, 0);
  assert.equal(waiting.timers.size, 0);
});
