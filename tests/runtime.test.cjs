const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

// A source-only DOM/Canvas harness. It executes the shipped scripts and actions
// without a browser; layout and actual native event dispatch remain manual checks.
function runtime({ portrait = false, stored = null, blocked = false } = {}) {
  let drawCalls = 0;
  const gradients = { addColorStop() {} };
  const c = new Proxy({}, { get(_, key) {
    if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => gradients;
    return (...args) => {
      drawCalls++;
      for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${String(key)} received a nonfinite number`);
      if (key === 'arc') assert.ok(args[2] >= 0);
    };
  }, set: () => true });
  let doc;
  class Element {
    constructor(id = '', tag = 'div') {
      this.id = id; this.tagName = tag; this.dataset = {}; this.style = {}; this.attrs = {}; this.events = new Map(); this.hidden = true; this.open = false;
      this.textContent = ''; this.value = ''; this.checked = false; this.disabled = false; this.type = ''; this.children = [];
      const classes = new Set(); this.classList = { add: x => classes.add(x), remove: x => classes.delete(x), toggle: (x, on) => on ? classes.add(x) : classes.delete(x), contains: x => classes.has(x) };
    }
    addEventListener(name, fn) { if (!this.events.has(name)) this.events.set(name, []); this.events.get(name).push(fn); }
    dispatch(name, event = {}) { event.target ||= this; event.preventDefault ||= () => {}; for (const fn of this.events.get(name) || []) fn(event); }
    setAttribute(key, value) { this.attrs[key] = value; }
    focus() { doc.activeElement = this; }
    click() { this.dispatch('click'); doc.dispatch('click', { target: this }); }
    closest(selector) {
      if (selector === '[data-action]') return this.dataset.action ? this : null;
      return selector.split(',').map(s => s.trim()).includes(this.tagName) ? this : null;
    }
    set innerHTML(html) {
      this.html = html; this.children = [];
      for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
        const b = new Element('', 'button');
        for (const attr of match[1].matchAll(/data-([a-z]+)="([^"]*)"/g)) b.dataset[attr[1]] = attr[2];
        b.disabled = /\bdisabled\b/.test(match[1]); b.textContent = match[2].replace(/<[^>]*>/g, ''); this.children.push(b);
      }
    }
    get innerHTML() { return this.html || ''; }
    querySelector() { return this.children.find(b => !b.disabled) || null; }
    getContext() { return c; }
    getBoundingClientRect() { return this.id === 'stick-pad' ? { left: 0, top: 0, width: 120, height: 120 } : { left: 0, top: 0, width: portrait ? 640 : 960, height: portrait ? 900 : 640 }; }
    setPointerCapture() {}
    showModal() { this.open = true; }
  }
  doc = new Element('document'); doc.body = new Element('body'); doc.hidden = false;
  const elements = new Map();
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const el = new Element(match[2], match[1]);
    const type = match[0].match(/\btype="([^"]+)"/); el.type = type?.[1] || '';
    elements.set(match[2], el);
  }
  doc.getElementById = id => { assert.ok(elements.has(id), `Missing shipped element ${id}`); return elements.get(id); };
  doc.createElement = tag => new Element('', tag);
  const windowEvents = new Map(); let frame;
  const writes = [];
  const storage = { getItem: () => stored, setItem: (_, value) => { if (blocked) throw Error('Blocked'); writes.push(value); stored = value; } };
  const world = vm.createContext({ document: doc, localStorage: storage, console, Date, Math,
    matchMedia: query => ({ matches: query.includes('orientation') ? portrait : false }),
    devicePixelRatio: 1, requestAnimationFrame: fn => { frame = fn; },
    addEventListener: (name, fn) => { if (!windowEvents.has(name)) windowEvents.set(name, []); windowEvents.get(name).push(fn); },
  });
  for (const name of ['data', 'engine', 'render', 'audio', 'input']) vm.runInContext(fs.readFileSync(path.join(root, `src/${name}.js`), 'utf8'), world);
  vm.runInContext(`const originalDraw = Pearls.Renderer.prototype.draw;
    Pearls.Renderer.prototype.draw = function (s, ...args) { Pearls.testState = s; return originalDraw.call(this, s, ...args); };`, world);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/main.js'), 'utf8'), world);
  let timestamp = 0;
  const tick = (n = 1) => { for (let i = 0; i < n; i++) { timestamp += 1000 / 60; frame(timestamp); } };
  tick();
  function action(name, data = {}) { const b = new Element('', 'button'); b.dataset = { action: name, ...data }; b.click(); tick(); }
  const windowEvent = (name, event = {}) => { event.target ||= elements.get('game'); event.preventDefault ||= () => {}; for (const fn of windowEvents.get(name) || []) fn(event); };
  return { world, elements, doc, writes, tick, action, windowEvent, drawCalls: () => drawCalls, state: () => world.Pearls.testState };
}

test('the shipped app boots, launches tutorial, skips into a voyage and pauses safely', () => {
  const h = runtime(); assert.equal(h.state().phase, 'menu'); assert.match(h.elements.get('screen').innerHTML, /The sea/);
  h.action('play'); assert.equal(h.state().mode, 'tutorial'); assert.equal(h.state().phase, 'playing');
  h.action('skip-tutorial'); assert.equal(h.state().mode, 'campaign');
  h.windowEvent('keydown', { code: 'KeyD', repeat: false }); h.tick(30); assert.ok(h.state().boat.vx > 0);
  h.windowEvent('blur'); h.tick(); assert.equal(h.state().phase, 'paused');
  const x = h.state().boat.x; h.tick(120); assert.equal(h.state().boat.x, x);
  h.action('resume'); h.tick(45); assert.equal(h.state().phase, 'playing'); assert.ok(Math.abs(h.state().boat.vx) < 12);
});

test('touch pointer cancellation releases steering, brake, and ability buttons', () => {
  const h = runtime({ portrait: true }); h.action('endless');
  const pad = h.elements.get('stick-pad');
  pad.dispatch('pointerdown', { pointerId: 1, clientX: 100, clientY: 60 }); h.tick(20); assert.ok(h.state().boat.vx > 0);
  pad.dispatch('pointercancel', { pointerId: 1 }); h.tick(60); assert.ok(Math.abs(h.state().boat.vx) < 5);
  h.elements.get('touch-brake').dispatch('pointerdown', { pointerId: 2 }); assert.equal(h.elements.get('touch-brake').classList.contains('held'), true);
  h.elements.get('touch-brake').dispatch('lostpointercapture', { pointerId: 2 }); assert.equal(h.elements.get('touch-brake').classList.contains('held'), false);
  h.elements.get('touch-buoy').dispatch('pointerdown', { pointerId: 3 }); h.tick(); assert.equal(h.state().buoys.length, 1);
  h.tick(); assert.equal(h.state().buoys.length, 1);
});

test('screen transitions complete a voyage, save a record, and unlock the next sea', () => {
  const h = runtime(); h.action('voyage', { index: '0' }); h.action('skip-tutorial');
  for (let sector = 0; sector < 3; sector++) {
    const s = h.state(); s.mines = []; s.cargo = s.quota; s.boat.x = s.harbor.x; s.boat.y = s.harbor.y; s.boat.vx = s.boat.vy = 0;
    h.tick(25);
    assert.equal(h.state().phase, sector === 2 ? 'complete' : 'sectorComplete');
    if (sector < 2) { assert.match(h.elements.get('screen').innerHTML, /A gift from the tide/); h.action('next-sector', { perk: 'compass' }); }
  }
  assert.match(h.elements.get('screen').innerHTML, /VOYAGE COMPLETE/);
  const saved = JSON.parse(h.writes.at(-1)); assert.equal(saved.unlocked, 1); assert.equal(saved.records['voyage-0'].completed, true);
  h.action('home'); h.action('voyages'); assert.match(h.elements.get('screen').innerHTML, /Voyage complete/);
});

test('daily challenge seeds and dimensions survive retry; storage failure stays playable', () => {
  const h = runtime({ blocked: true }); h.action('daily'); const seed = h.state().seed;
  assert.equal(h.state().mode, 'daily'); assert.match(h.elements.get('save-status').textContent, /without saved/);
  h.action('retry'); assert.equal(h.state().seed, seed); assert.equal(h.state().sector, 0);
  h.tick(60); assert.ok(h.drawCalls() > 0);
});

test('banked campaign checkpoint survives reload with the chosen charm and score', () => {
  const h = runtime(); h.action('play'); h.action('skip-tutorial');
  const s = h.state(); s.mines = []; s.cargo = s.quota; s.boat.x = s.harbor.x; s.boat.y = s.harbor.y; s.boat.vx = s.boat.vy = 0;
  h.tick(25); h.action('next-sector', { perk: 'quiet' });
  const saved = h.writes.at(-1), seed = h.state().seed, score = h.state().score;
  const resumed = runtime({ stored: saved }); assert.match(resumed.elements.get('screen').innerHTML, /Resume your voyage/);
  resumed.action('play'); assert.equal(resumed.state().sector, 1); assert.equal(resumed.state().seed, seed);
  assert.equal(resumed.state().score, score); assert.equal(resumed.state().perk, 'quiet'); assert.equal(resumed.state().boat.hull, 3);
  assert.equal(resumed.state().run.sectors, 1);
});

test('settings pause the simulation and apply without silently resuming', () => {
  const h = runtime(); h.action('endless'); h.elements.get('settings-open').dispatch('click'); h.tick();
  assert.equal(h.state().phase, 'paused'); assert.equal(h.elements.get('settings-dialog').open, true);
  const contrast = h.elements.get('contrast-setting'); contrast.checked = true; contrast.dispatch('change');
  assert.equal(h.doc.body.classList.contains('high-contrast'), true);
  const steering = h.elements.get('steering-setting'); steering.value = 'classic'; steering.dispatch('change');
  assert.equal(h.state().steering, 'classic');
  h.elements.get('settings-dialog').open = false; h.tick(); assert.equal(h.state().phase, 'paused');
  h.action('resume'); assert.equal(h.state().phase, 'playing');
});

test('rendering is read only and independent of gameplay randomness', () => {
  const h = runtime(); h.action('endless'); const s = h.state();
  s.phase = 'paused'; const before = JSON.stringify(s), rng = s.rng;
  // Rendering must not change state or touch the simulation RNG.
  let calls = 0; s.rng = () => { calls++; return rng(); };
  h.tick(100); assert.equal(calls, 0); assert.equal(JSON.stringify(s), before);
});

test('every referenced asset is local and present, and all script tags load in order', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(p => p !== '#');
  for (const asset of assets) { assert.ok(!/^(https?:)?\/\//.test(asset)); assert.ok(fs.existsSync(path.join(root, asset)), asset); }
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(scripts, ['src/data.js', 'src/engine.js', 'src/render.js', 'src/audio.js', 'src/input.js', 'src/main.js']);
});
