const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../src/data.js');
require('../src/engine.js');
const P = globalThis.Pearls;
const create = opts => P.createGame({ seed: 412, ...opts });
const mine = (id, x, y, extra = {}) => ({ id, x, y, px: x, py: y, vx: 0, vy: 0, r: 15, type: 'drifter', angle: 0,
  state: 'patrol', warning: 0, stateTime: 0, engagedAt: -Infinity, ...extra });
const clean = opts => { const s = create(opts); s.mines = []; s.pearls = []; s.spawnTime = 999; s.refill = 999; return s; };

test('all eighteen sectors open with reachable pearls and safe warning spawns in both orientations', () => {
  for (const portrait of [false, true]) for (let voyageIndex = 0; voyageIndex < 6; voyageIndex++) for (let sector = 0; sector < 3; sector++) {
    const s = create({ portrait, voyageIndex, sector });
    assert.ok(s.pearls.length >= 3);
    assert.ok(Math.min(...s.pearls.map(p => P.distance(s.boat, p))) < 130);
    for (const pearl of s.pearls) assert.ok(P.reachable(s, pearl));
    assert.ok(P.reachable(s, s.harbor));
    for (const m of s.mines) { assert.ok(m.warning > 0); assert.ok(P.distance(m, s.boat) >= 192); }
    assert.ok(s.mines.length <= s.budget);
  }
});

test('vortex centers and nearby positions remain finite', () => {
  for (const type of ['whirlpool', 'current']) for (const epsilon of [0, 1e-10, 1, 100]) {
    const entity = { x: 100 + epsilon, y: 100, vx: 0, vy: 0 };
    const field = { x: 100, y: 100, r: 180, type, angle: 1, strength: 100 };
    for (let i = 0; i < 600; i++) P.applyCurrent(entity, field, 1 / 60);
    assert.ok(Number.isFinite(entity.vx) && Number.isFinite(entity.vy));
  }
});

test('fatal damage commits once and blocks collection, scoring and additional spawns', () => {
  const s = clean(); s.boat.invulnerable = 0; s.boat.hull = 1;
  s.mines = [mine(100, s.boat.x, s.boat.y)];
  s.pearls = [{ id: 200, x: s.boat.x, y: s.boat.y, r: 9, value: 100, type: 'ivory', salvage: false }];
  P.step(s);
  assert.equal(s.phase, 'gameover'); assert.equal(s.score, 0); assert.equal(s.cargo, 0); assert.equal(s.pearls.length, 1);
  assert.equal(s.events.filter(e => e.type === 'end').length, 1);
  P.step(s); assert.equal(s.run.damage, 1); assert.equal(s.events.length, 0);
});

test('a mine removed by a lure cannot also damage the boat', () => {
  const s = clean(); s.boat.invulnerable = 0;
  s.mines = [mine(100, s.boat.x, s.boat.y, { engagedAt: 0 }), mine(101, s.boat.x + 10, s.boat.y)];
  P.step(s); assert.equal(s.boat.hull, 3); assert.equal(s.run.lures, 1); assert.equal(s.mines.length, 0); assert.ok(s.score >= 250);
});

test('incidental collisions clear mines without reward', () => {
  const s = clean(); s.mines = [mine(100, 150, 200), mine(101, 150, 200)];
  P.step(s); assert.equal(s.score, 0); assert.equal(s.run.lures, 0); assert.equal(s.mines.length, 0); assert.equal(s.pearls.length, 0);
});

test('ambiguous collision pairs consume each mine only once', () => {
  const s = clean(); s.mines = [mine(1, 120, 190, { engagedAt: 0 }), mine(2, 120, 190), mine(3, 120, 190)];
  P.step(s); assert.equal(s.run.lures, 1); assert.equal(s.mines.length, 1); assert.equal(s.mines[0].id, 3);
});

test('first pearl pays 1x and quota is independent of value', () => {
  const s = clean(); s.pearls = [{ id: 200, x: s.boat.x, y: s.boat.y, r: 9, value: 100, type: 'ivory', salvage: false }];
  P.step(s); assert.equal(s.score, 100); assert.equal(s.chain, 2); assert.equal(s.cargo, 1);
  for (let i = 0; i < 241; i++) P.step(s); assert.equal(s.chain, 1); assert.equal(s.cargo, 1);
});

test('normal and salvage pearl budgets are independently enforced', () => {
  const s = clean();
  for (let i = 0; i < 40; i++) { P.spawnPearl(s); P.spawnPearl(s, 'gold'); }
  assert.equal(s.pearls.filter(p => !p.salvage).length, 6); assert.equal(s.pearls.filter(p => p.salvage).length, 4);
});

test('exhausted placement searches defer rather than creating an unsafe mine', () => {
  const s = clean(); s.rng = () => 0.5; s.boat.x = 480; s.boat.y = 340;
  assert.equal(P.spawnMine(s), false); assert.equal(s.mines.length, 0);
});

test('spawn excludes predicted movement path and safe harbor approach', () => {
  const s = clean(); s.boat.vx = 280;
  assert.equal(P.safePosition(s, { x: s.boat.x + 180, y: s.boat.y }, 'mine'), false);
  s.harbor.active = true; assert.equal(P.spawnMine(s), false);
});

test('capsule contacts include the prow and exclude distant side contacts', () => {
  const b = { x: 100, y: 100, angle: 0 };
  assert.equal(P.hullHit(b, { x: 130, y: 100, r: 4 }), true);
  assert.equal(P.hullHit(b, { x: 100, y: 117, r: 4 }), false);
  assert.equal(P.sweptHull({ ...b, px: 0, py: 100, prevAngle: 0 }, { x: 50, y: 100, px: 50, py: 100, r: 15 }), true);
});

test('diagonal input does not increase cruise speed and brake removes drift', () => {
  const a = clean(), b = clean();
  for (let i = 0; i < 60; i++) { P.step(a, { x: 1, y: 0 }); P.step(b, { x: 1, y: -1 }); }
  assert.ok(Math.abs(Math.hypot(a.boat.vx, a.boat.vy) - Math.hypot(b.boat.vx, b.boat.vy)) < 1e-6);
  for (let i = 0; i < 30; i++) P.step(a, { brake: true });
  assert.ok(Math.hypot(a.boat.vx, a.boat.vy) < 2);
});

test('classic control rotates and thrusts while touch retains direct steering', () => {
  const s = clean({ steering: 'classic' }), old = s.boat.angle;
  P.step(s, { x: 1 }); assert.ok(s.boat.angle > old);
  P.step(s, { y: -1 }); assert.ok(s.boat.vy < 0);
  const touch = clean({ steering: 'classic' }); P.step(touch, { pointer: true, x: 1 }); assert.ok(touch.boat.vx > 0);
});

test('surge and echo have cooldowns and echo is deliberately a player lure', () => {
  const s = clean(); P.step(s, { dash: true, buoy: true });
  assert.ok(s.boat.dash > 0); assert.equal(s.buoys.length, 1);
  P.step(s, { dash: true, buoy: true }); assert.equal(s.buoys.length, 1);
  s.mines = [mine(10, s.boat.x - 180, s.boat.y - 120)];
  for (let i = 0; i < 45; i++) P.step(s);
  assert.equal(s.mines[0].state, 'chase'); assert.ok(s.mines[0].engagedAt > 0);
});

test('extraction banks one sector and restores hull only on the next launch', () => {
  const s = clean(); s.cargo = s.quota; s.boat.hull = 2; P.step(s);
  assert.equal(s.harbor.active, true);
  s.boat.x = s.harbor.x; s.boat.y = s.harbor.y;
  for (let i = 0; i < 30; i++) P.step(s);
  assert.equal(s.phase, 'sectorComplete'); assert.equal(s.score, 800); assert.equal(s.run.sectors, 1);
  const next = P.nextSector(s, 'quiet'); assert.equal(next.boat.hull, 3); assert.equal(next.perk, 'quiet'); assert.equal(next.score, 800); assert.equal(next.sector, 1);
});

test('all campaigns have a final completion and correct medal rules', () => {
  for (let index = 0; index < 6; index++) {
    let s = clean({ voyageIndex: index });
    for (let sector = 0; sector < 3; sector++) {
      s.mines = []; s.spawnTime = 999; s.cargo = s.quota; s.boat.x = s.harbor.x; s.boat.y = s.harbor.y;
      for (let i = 0; i < 25; i++) P.step(s);
      assert.equal(s.phase, sector === 2 ? 'complete' : 'sectorComplete');
      if (sector < 2) s = P.nextSector(s);
    }
    assert.equal(s.run.sectors, 3); assert.equal(P.medals(s), 2);
    s.run.lures = 3; assert.equal(P.medals(s), 3);
  }
});

test('endless continues after three sectors with bounded pressure', () => {
  const s = create({ mode: 'endless', sector: 20 }); assert.equal(s.budget, 12); assert.equal(s.quota, 24);
  s.mines = []; s.cargo = s.quota; s.boat.x = s.harbor.x; s.boat.y = s.harbor.y;
  for (let i = 0; i < 30; i++) P.step(s);
  assert.equal(s.phase, 'sectorComplete'); assert.equal(P.nextSector(s).sector, 21);
});

test('frame catch-up is bounded and reset discards paused time', () => {
  const clock = P.createClock(); let count = 0;
  clock.advance(1000, () => count++); clock.advance(61000, () => count++); assert.equal(count, 5);
  clock.reset(); clock.advance(120000, () => count++); assert.equal(count, 5);
  clock.advance(120017, () => count++); assert.equal(count, 6);
});

test('equivalent tick actions produce the same state at 30, 60 and 120 render fps', () => {
  function simulate(fps) {
    const s = create(), clock = P.createClock(); let tick = 0;
    for (let frame = 0; frame <= fps * 8; frame++) clock.advance(frame * 1000 / fps, dt => {
      const t = tick++; P.step(s, { x: Math.sin(t / 60), y: Math.cos(t / 60), buoy: t === 120 }, dt);
    });
    return JSON.stringify(s);
  }
  assert.equal(simulate(30), simulate(60)); assert.equal(simulate(60), simulate(120));
});

test('tutorial advances through collection, braking, a real lure, and docking', () => {
  const s = clean({ mode: 'tutorial' });
  s.pearls = [{ id: 200, x: s.boat.x, y: s.boat.y, r: 9, value: 100, type: 'ivory', salvage: false }];
  P.step(s); assert.equal(s.tutorial.stage, 1);
  for (let i = 0; i < 35; i++) P.step(s, { brake: true });
  assert.equal(s.tutorial.stage, 2); assert.equal(s.mines.length, 2);
  P.step(s, { buoy: true });
  // Stay safely nearby while both threats converge on the actual deployed buoy.
  for (let i = 0; i < 600 && s.tutorial.stage < 3; i++) P.step(s);
  assert.equal(s.tutorial.stage, 3); assert.equal(s.harbor.active, true);
  s.boat.x = s.harbor.x; s.boat.y = s.harbor.y; s.boat.vx = s.boat.vy = 0;
  for (let i = 0; i < 30; i++) P.step(s);
  assert.equal(s.phase, 'complete');
});

test('seeded stress runs keep all entity state finite and budgets bounded', () => {
  for (let seed = 0; seed < 18; seed++) {
    const s = P.createGame({ seed, voyageIndex: seed % 6, portrait: seed % 2 === 0 });
    for (let tick = 0; tick < 1800; tick++) {
      P.step(s, { x: Math.sin(tick * 0.013), y: Math.cos(tick * 0.019), dash: tick % 600 === 0, buoy: tick % 540 === 0 });
      for (const e of [s.boat, ...s.mines]) for (const key of ['x', 'y', 'vx', 'vy']) assert.ok(Number.isFinite(e[key]), `seed ${seed} tick ${tick} ${key}`);
      assert.ok(s.mines.length <= s.budget); assert.ok(s.pearls.length <= 10);
    }
  }
});

test('storage validates malformed data, clamps settings and fails gracefully', () => {
  assert.equal(P.readSave(null).unlocked, 0);
  assert.equal(P.readSave({ getItem: () => '{bad json' }).unlocked, 0);
  const s = P.readSave({ getItem: () => JSON.stringify({ version: 1, unlocked: 999, settings: { volume: 9, steering: 'evil' }, records: { '__bad__': { score: 9 }, 'voyage-0': { score: 123, completed: true } } }) });
  assert.equal(s.unlocked, 5); assert.equal(s.settings.volume, 1); assert.equal(s.settings.steering, 'direct'); assert.equal(s.records['voyage-0'].score, 123); assert.equal(s.records.__bad__, undefined);
  assert.equal(P.writeSave({ setItem() { throw Error('Full'); } }, s), false);
});
