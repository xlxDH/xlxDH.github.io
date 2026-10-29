import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/js/arcade.js', import.meta.url), 'utf8');
function harness(hz, game = 'tetris') {
  let now = 0;
  let pending;
  let renders = 0;
  const listeners = {};
  const ctx = new Proxy({}, {
    get: (_, key) => key === 'clearRect' ? () => { renders++; } : () => {},
    set: () => true,
  });
  const canvas = { getContext: () => ctx, style: {}, offsetWidth: 256, classList: { toggle() {} } };
  const document = {
    hidden: false,
    documentElement: { dataset: { theme: 'dark' } },
    getElementById: () => canvas,
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  const window = { CONFIG: {}, innerWidth: 1440, innerHeight: 900,
    matchMedia: () => ({ matches: false }), addEventListener() {} };
  vm.runInNewContext(source, { window, document,
    location: { search: `?arcade=${game}` }, URLSearchParams,
    performance: { now: () => now },
    localStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: (fn) => { pending = fn; }, console,
  });
  function advance(duration) {
    const until = now + duration;
    while (now + 1000 / hz <= until + .00001) { now += 1000 / hz; pending(now); }
  }
  return { advance, document, listeners, count: () => renders,
    jump(duration) { now += duration; pending(now); } };
}
for (const hz of [25, 50, 60, 120, 144, 240]) {
  const h = harness(hz);
  h.advance(10000);
  assert.ok(Math.abs(h.count() - 250) <= 1, `${hz} Hz display: ${h.count()} frames`);
  const before = h.count();
  h.document.hidden = true;
  h.advance(1000);
  assert.equal(h.count(), before);
  h.document.hidden = false;
  h.listeners.visibilitychange();
  h.advance(1000);
  assert.ok(Math.abs(h.count() - before - 25) <= 1);
  h.jump(10000);
  assert.ok(h.count() - before <= 27, 'No burst of catch-up frames');
  console.log(`${hz} Hz display: fixed 25 Hz, background pause and resume OK`);
}
for (const game of ['tetris', 'snake', 'breakout']) {
  const h = harness(60, game);
  h.advance(120000);
  assert.ok(h.count() >= 2999);
  console.log(`${game}: two simulated minutes without runtime errors`);
}
