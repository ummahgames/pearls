(function (P) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = P.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const distance = P.distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const emit = (s, type, x, y, extra = {}) => s.events.push({ type, x, y, ...extra });
  function pointSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    const t = len ? clamp(((px - ax) * dx + (py - ay) * dy) / len, 0, 1) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  P.pointSegment = pointSegment;
  P.hullHit = function (boat, entity, margin = 0) {
    const hx = Math.cos(boat.angle) * 17, hy = Math.sin(boat.angle) * 17;
    return pointSegment(entity.x, entity.y, boat.x - hx, boat.y - hy, boat.x + hx, boat.y + hy) <= 10 + entity.r + margin;
  };
  P.sweptHit = function (a, b, radius) {
    return pointSegment(0, 0, (a.px ?? a.x) - (b.px ?? b.x), (a.py ?? a.y) - (b.py ?? b.y), a.x - b.x, a.y - b.y) <= radius;
  };
  function sweptHull(boat, mine) {
    if (P.hullHit(boat, mine)) return true;
    // Sweep each capsule endpoint and its center using relative entity motion.
    for (const offset of [-17, 0, 17]) {
      const a = { x: boat.x + Math.cos(boat.angle) * offset, y: boat.y + Math.sin(boat.angle) * offset,
        px: (boat.px ?? boat.x) + Math.cos(boat.prevAngle ?? boat.angle) * offset,
        py: (boat.py ?? boat.y) + Math.sin(boat.prevAngle ?? boat.angle) * offset };
      if (P.sweptHit(a, mine, mine.r + 10)) return true;
    }
    return false;
  }
  P.sweptHull = sweptHull;

  P.reachable = function (s, target) {
    if (!s.reefs.length) return true;
    const cell = 30, cols = Math.ceil(s.width / cell), rows = Math.ceil(s.height / cell);
    const node = p => ({ x: clamp(Math.floor(p.x / cell), 0, cols - 1), y: clamp(Math.floor(p.y / cell), 0, rows - 1) });
    const start = node(s.boat), end = node(target), queue = [start], seen = new Set([`${start.x},${start.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i];
      if (n.x === end.x && n.y === end.y) return true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = n.x + dx, y = n.y + dy, key = `${x},${y}`;
        if (x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1 || seen.has(key)) continue;
        const p = { x: (x + 0.5) * cell, y: (y + 0.5) * cell };
        if (s.reefs.some(r => distance(p, r) < r.r + 35)) continue;
        seen.add(key); queue.push({ x, y });
      }
    }
    return false;
  };
  P.safePosition = function (s, p, kind) {
    const margin = kind === 'mine' ? 40 : 32;
    if (p.x < margin || p.x > s.width - margin || p.y < 130 || p.y > s.height - margin) return false;
    if (s.reefs.some(r => distance(p, r) < r.r + (kind === 'mine' ? 30 : 40))) return false;
    if (kind === 'mine') {
      const clearance = Math.min(s.width, s.height) * 0.3;
      const future = { x: clamp(s.boat.x + s.boat.vx * 0.6, 30, s.width - 30), y: clamp(s.boat.y + s.boat.vy * 0.6, 30, s.height - 30) };
      if (pointSegment(p.x, p.y, s.boat.x, s.boat.y, future.x, future.y) < clearance) return false;
      if (s.mines.some(m => distance(p, m) < 70) || s.pearls.some(c => distance(p, c) < 60)) return false;
      if (distance(p, s.harbor) < (s.harbor.active ? 155 : 80)) return false;
    } else {
      if (s.mines.some(m => distance(p, m) < m.r + 45)) return false;
      if (s.pearls.some(c => distance(p, c) < 25)) return false;
    }
    return true;
  };
  function findPosition(s, kind, preferred) {
    for (let i = 0; i < 65; i++) {
      const p = i === 0 && preferred ? preferred : { x: 50 + s.rng() * (s.width - 100), y: 90 + s.rng() * (s.height - 140) };
      // A refill should give the player a route, never appear under the hull.
      if (kind !== 'mine' && i > 0 && distance(p, s.boat) < 150) continue;
      if (P.safePosition(s, p, kind) && (kind === 'mine' || P.reachable(s, p))) return p;
    }
    return null;
  }
  P.spawnMine = function (s, kind) {
    if (s.mines.length >= s.budget || s.harbor.active || s.mode === 'tutorial') return false;
    const p = findPosition(s, 'mine');
    if (!p) return false;
    const type = kind || (s.rng() < s.level.chasers ? 'chaser' : 'drifter');
    const angle = s.rng() * TAU;
    s.mines.push({ id: s.nextId++, ...p, px: p.x, py: p.y, vx: 0, vy: 0, r: type === 'chaser' ? 16 : 15,
      type, angle, state: 'warning', warning: 1.1, stateTime: 0, engagedAt: -Infinity, homeX: p.x, homeY: p.y });
    return true;
  };
  P.spawnPearl = function (s, kind = 'ivory', preferred) {
    const salvage = kind === 'gold';
    if (s.pearls.filter(c => c.salvage === salvage).length >= (salvage ? 4 : 6)) return false;
    const p = findPosition(s, 'pearl', preferred);
    if (!p) return false;
    // A dark pearl is rare but identifiable: silver rim and a distinct four-point sparkle.
    const type = salvage ? 'gold' : s.mode !== 'tutorial' && s.voyageIndex >= 1 && s.rng() < 0.12 ? 'moon' : kind;
    s.pearls.push({ id: s.nextId++, ...p, r: type === 'moon' ? 10 : 9, type, salvage, value: type === 'gold' ? 200 : type === 'moon' ? 175 : 100 });
    return true;
  };
  function bed(s, preferred) {
    const center = findPosition(s, 'pearl', preferred);
    if (!center) return;
    for (const offset of [-1, 0, 1]) P.spawnPearl(s, 'ivory', { x: center.x + offset * 39, y: center.y + Math.abs(offset) * 17 });
  }
  P.createGame = function (options = {}) {
    const mode = options.mode || 'campaign';
    const index = clamp(options.voyageIndex || 0, 0, 5), sector = options.sector || 0;
    const level = mode === 'endless' ? { ...P.VOYAGES[Math.min(5, Math.floor(sector / 2))], chasers: Math.min(0.5, sector * 0.08) } : P.VOYAGES[index];
    const width = options.portrait ? 640 : 960, height = options.portrait ? 900 : 640;
    const seed = options.seed ?? P.hash(`pearls:${index}:${Date.now()}`);
    const s = { phase: 'playing', mode, voyageIndex: index, sector, level, width, height, seed,
      rng: P.random(P.hash(`${seed}:${sector}:v1`)), nextId: 1, time: 0, cargo: 0,
      quota: mode === 'tutorial' ? 3 : mode === 'endless' ? 10 + Math.min(14, sector * 2) : level.quotas[sector],
      budget: mode === 'tutorial' ? 0 : mode === 'endless' ? Math.min(12, 3 + sector) : level.budgets[sector],
      score: options.score || 0, chain: 1, chainTime: 0, bestChain: options.bestChain || 1,
      run: options.run || { cargo: 0, lures: 0, damage: 0, time: 0, sectors: 0 },
      sectorStats: { lures: 0, damage: 0, cargo: 0 }, steering: options.steering || 'direct', perk: options.perk || null,
      boat: { x: width * 0.5, y: height * 0.8, px: width * 0.5, py: height * 0.8, vx: 0, vy: 0,
        angle: -Math.PI / 2, prevAngle: -Math.PI / 2, hull: 3, invulnerable: 1.8, dash: 0, dashCooldown: 0, buoyCooldown: 0 },
      mines: [], pearls: [], reefs: [], currents: [], buoys: [], events: [], refill: 0, spawnTime: 2.5,
      harbor: { x: width * 0.5, y: height * 0.23, r: 47, active: false, dockTime: 0 },
      tutorial: { stage: 0, brakeTime: 0, stageTime: 0 }, dailyDate: options.dailyDate || null,
    };
    const layout = [[0.28, 0.35, 45], [0.73, 0.56, 49], [0.35, 0.62, 34], [0.7, 0.24, 37]];
    if (mode !== 'tutorial') {
      for (let i = 0; i < level.reefs; i++) {
        const [x, y, r] = layout[i];
        const lx = sector % 3 === 1 ? 1 - x : x, ly = sector % 3 === 2 ? y + (i % 2 ? -0.07 : 0.045) : y;
        s.reefs.push({ x: width * lx, y: height * ly, r: r * (options.portrait ? 0.9 : 1), id: i });
      }
      if (level.current) s.currents.push({ type: 'current', x: width * 0.5, y: height * 0.49, r: Math.min(width, height) * 0.24, angle: sector % 2 ? -0.35 : 0.4, strength: 90 });
      if (level.whirlpool) s.currents.push({ type: 'whirlpool', x: width * 0.76, y: height * 0.3, r: 105, angle: 0, strength: 105 });
    }
    bed(s, { x: s.boat.x, y: s.boat.y - 90 });
    if (mode !== 'tutorial') { bed(s); for (let i = 0; i < Math.min(2, s.budget); i++) P.spawnMine(s); }
    return s;
  };
  P.nextSector = function (s, perk) {
    return P.createGame({ mode: s.mode, voyageIndex: s.voyageIndex, sector: s.sector + 1, seed: s.seed,
      portrait: s.width < s.height, score: s.score, run: { ...s.run }, bestChain: s.bestChain,
      steering: s.steering, perk, dailyDate: s.dailyDate });
  };
  P.applyCurrent = function (entity, effect, dt, modifier = 1) {
    const dx = entity.x - effect.x, dy = entity.y - effect.y, d = Math.hypot(dx, dy);
    if (d >= effect.r) return;
    const force = effect.strength * (1 - d / effect.r) * modifier * dt;
    if (effect.type === 'current') { entity.vx += Math.cos(effect.angle) * force; entity.vy += Math.sin(effect.angle) * force; }
    else if (d > 0.00001) { entity.vx += (-dy / d - dx / d * 0.35) * force; entity.vy += (dx / d - dy / d * 0.35) * force; }
  };
  function capSpeed(entity, max) { const speed = Math.hypot(entity.vx, entity.vy); if (speed > max) { entity.vx *= max / speed; entity.vy *= max / speed; } }
  function bounds(s, e, r, bounce = false) {
    if (e.x < r) { e.x = r; e.vx = bounce ? Math.abs(e.vx) * 0.7 : Math.max(0, e.vx); }
    if (e.x > s.width - r) { e.x = s.width - r; e.vx = bounce ? -Math.abs(e.vx) * 0.7 : Math.min(0, e.vx); }
    if (e.y < r + 110) { e.y = r + 110; e.vy = bounce ? Math.abs(e.vy) * 0.7 : Math.max(0, e.vy); }
    if (e.y > s.height - r) { e.y = s.height - r; e.vy = bounce ? -Math.abs(e.vy) * 0.7 : Math.min(0, e.vy); }
  }
  function reefs(s, e, radius) {
    for (const r of s.reefs) {
      let dx = e.x - r.x, dy = e.y - r.y, d = Math.hypot(dx, dy), target = radius + r.r;
      if (d >= target) continue;
      if (d < 0.001) { dx = 1; dy = 0; d = 1; }
      e.x = r.x + dx / d * target; e.y = r.y + dy / d * target;
      const normal = e.vx * dx / d + e.vy * dy / d;
      if (normal < 0) { e.vx -= dx / d * normal; e.vy -= dy / d * normal; }
    }
  }
  function award(s, base, x, y, label, salvage = false) {
    const value = Math.round(base * s.chain * (salvage && s.perk === 'salvage' ? 1.5 : 1));
    s.score += value; s.chain = Math.min(5, s.chain + 1); s.chainTime = 4;
    s.bestChain = Math.max(s.bestChain, s.chain);
    emit(s, 'score', x, y, { value, label });
  }
  function moveBoat(s, input, dt) {
    const b = s.boat;
    b.px = b.x; b.py = b.y; b.prevAngle = b.angle;
    b.invulnerable = Math.max(0, b.invulnerable - dt);
    b.dashCooldown = Math.max(0, b.dashCooldown - dt); b.buoyCooldown = Math.max(0, b.buoyCooldown - dt);
    b.dash = Math.max(0, b.dash - dt);
    const x = input.x || 0, y = input.y || 0, magnitude = Math.hypot(x, y);
    const classic = s.steering === 'classic' && !input.pointer;
    if (classic) {
      b.angle += x * 3.6 * dt;
      if (y) { b.vx += Math.cos(b.angle) * -y * 1050 * dt; b.vy += Math.sin(b.angle) * -y * 1050 * dt; }
    } else if (magnitude > 0.04) {
      const strength = Math.min(1, magnitude), target = Math.atan2(y, x);
      b.angle += clamp(angleDelta(b.angle, target), -7 * dt, 7 * dt);
      b.vx += x / magnitude * strength * 1200 * dt; b.vy += y / magnitude * strength * 1200 * dt;
    }
    if (input.dash && b.dashCooldown <= 0 && !(s.mode === 'tutorial' && s.tutorial.stage === 0)) {
      b.dash = 0.28; b.dashCooldown = 6;
      b.vx += Math.cos(b.angle) * 220; b.vy += Math.sin(b.angle) * 220;
      emit(s, 'dash', b.x, b.y);
    }
    if (input.buoy && b.buoyCooldown <= 0) {
      b.buoyCooldown = 9;
      s.buoys.push({ id: s.nextId++, x: b.x, y: b.y, t: 3.5, r: 275 });
      emit(s, 'buoy', b.x, b.y);
    }
    const drag = input.brake ? 11 : magnitude > 0.04 ? 2.8 : 4.6;
    b.vx *= Math.exp(-drag * dt); b.vy *= Math.exp(-drag * dt);
    if (s.time > 1.3) for (const effect of s.currents) P.applyCurrent(b, effect, dt, s.perk === 'tideglass' ? 0.5 : 1);
    capSpeed(b, b.dash > 0 ? 455 : input.brake ? 120 : 280);
    b.x += b.vx * dt; b.y += b.vy * dt;
    bounds(s, b, 29); reefs(s, b, 28);
  }
  function moveMines(s, dt) {
    for (const m of s.mines) {
      m.px = m.x; m.py = m.y; m.stateTime += dt;
      const nearBoat = distance(m, s.boat);
      if (m.warning > 0) {
        m.warning = Math.max(0, m.warning - dt);
        if (m.warning <= 0 && nearBoat < 65) m.warning = 0.15;
        if (m.warning <= 0) { m.state = 'patrol'; m.stateTime = 0; }
        continue;
      }
      let target = s.boat;
      const buoy = s.buoys.find(b => distance(m, b) < b.r);
      if (buoy) target = buoy;
      const detect = s.perk === 'quiet' ? 165 : 195;
      const d = distance(m, target);
      if ((d < detect || buoy) && (m.state === 'patrol' || m.state === 'cooldown')) {
        m.state = 'alert'; m.stateTime = 0; emit(s, 'alert', m.x, m.y);
      }
      if (m.state === 'alert' && m.stateTime > 0.5) { m.state = 'chase'; m.stateTime = 0; }
      if (m.state === 'chase') {
        m.engagedAt = s.time;
        if (d > 280 && !buoy && m.stateTime > 1) { m.state = 'cooldown'; m.stateTime = 0; }
        const targetAngle = Math.atan2(target.y - m.y, target.x - m.x);
        const turn = m.type === 'chaser' ? 1.7 : 2.8;
        m.angle += clamp(angleDelta(m.angle, targetAngle), -turn * dt, turn * dt);
        const accel = m.type === 'chaser' ? 185 : 130;
        m.vx += Math.cos(m.angle) * accel * dt; m.vy += Math.sin(m.angle) * accel * dt;
      } else {
        if (m.state === 'cooldown' && m.stateTime > 2) { m.state = 'patrol'; m.stateTime = 0; }
        m.angle += Math.sin(s.time * 0.6 + m.id) * 0.3 * dt;
        m.vx += Math.cos(m.angle) * 28 * dt; m.vy += Math.sin(m.angle) * 28 * dt;
      }
      const drag = m.state === 'chase' ? 0.65 : 1.3;
      m.vx *= Math.exp(-drag * dt); m.vy *= Math.exp(-drag * dt);
      if (s.time > 1.3) for (const effect of s.currents) P.applyCurrent(m, effect, dt, 0.8);
      // Harbor approach gently clears, rather than killing, hazards.
      if (s.harbor.active && distance(m, s.harbor) < 150) {
        const dx = m.x - s.harbor.x, dy = m.y - s.harbor.y, d = Math.hypot(dx, dy) || 1;
        m.vx += dx / d * 500 * dt; m.vy += dy / d * 500 * dt;
      }
      capSpeed(m, m.state === 'chase' ? m.type === 'chaser' ? 225 : 190 : 95);
      m.x += m.vx * dt; m.y += m.vy * dt; bounds(s, m, m.r, true); reefs(s, m, m.r);
    }
  }
  function mineCollisions(s) {
    const removed = new Set(), drops = [];
    const mines = [...s.mines].sort((a, b) => a.id - b.id);
    for (let i = 0; i < mines.length; i++) {
      const a = mines[i]; if (removed.has(a.id) || a.warning > 0) continue;
      for (let j = i + 1; j < mines.length; j++) {
        const b = mines[j]; if (removed.has(b.id) || b.warning > 0) continue;
        if (!P.sweptHit(a, b, a.r + b.r)) continue;
        removed.add(a.id); removed.add(b.id);
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        emit(s, 'explosion', x, y);
        if (s.time - Math.max(a.engagedAt, b.engagedAt) <= 8) {
          award(s, 250, x, y, 'CLEVER LURE', true);
          s.sectorStats.lures++; s.run.lures++; drops.push({ x, y });
          if (s.mode === 'tutorial' && s.tutorial.stage === 2) { s.tutorial.stage = 3; s.tutorial.stageTime = 0; activateHarbor(s); }
        }
        break;
      }
    }
    s.mines = s.mines.filter(m => !removed.has(m.id));
    // Damage is resolved before rewards from surviving hazards can spawn drops.
    return drops;
  }
  function damage(s) {
    const b = s.boat;
    if (b.invulnerable > 0 || s.mode === 'tutorial') return false;
    const mine = s.mines.find(m => m.warning <= 0 && sweptHull(b, m));
    if (!mine) return false;
    b.hull--; b.invulnerable = 1.5; s.chain = 1; s.chainTime = 0;
    s.run.damage++; s.sectorStats.damage++;
    const dx = b.x - mine.x, dy = b.y - mine.y, d = Math.hypot(dx, dy) || 1;
    b.vx = dx / d * 220; b.vy = dy / d * 220;
    // Consume the contacting mine so invulnerability never ends inside it.
    s.mines = s.mines.filter(m => m.id !== mine.id);
    emit(s, 'damage', b.x, b.y);
    if (b.hull <= 0) { s.phase = 'gameover'; emit(s, 'end', b.x, b.y); return true; }
    return false;
  }
  function activateHarbor(s) {
    if (s.harbor.active) return;
    s.harbor.active = true;
    // A clean approach is guaranteed once cargo is full.
    s.mines = s.mines.filter(m => distance(m, s.harbor) > 140);
    emit(s, 'harbor', s.harbor.x, s.harbor.y);
  }
  function tutorialStep(s, input, dt) {
    const t = s.tutorial; t.stageTime += dt;
    if (t.stage === 0 && s.cargo >= 1) { t.stage = 1; t.stageTime = 0; }
    if (t.stage === 1) {
      t.brakeTime = input.brake ? t.brakeTime + dt : t.brakeTime;
      if (t.brakeTime > 0.5) { t.stage = 2; t.stageTime = 0; s.pearls = []; makePracticeMines(s); }
    }
    if (t.stage === 2 && !s.mines.length && t.stageTime > 1) makePracticeMines(s);
  }
  function makePracticeMines(s) {
    // Close enough for an echo buoy to attract both, with a safe pocket below.
    s.boat.x = s.width * 0.5; s.boat.y = s.height * 0.72; s.boat.vx = 0; s.boat.vy = 0;
    for (const side of [-1, 1]) {
      const x = s.boat.x + side * 90, y = s.boat.y - 120;
      s.mines.push({ id: s.nextId++, x, y, px: x, py: y, vx: 0, vy: 0, r: 15,
        type: 'drifter', angle: side < 0 ? 0 : Math.PI, state: 'patrol', warning: 0.7, stateTime: 0, engagedAt: -Infinity });
    }
  }
  P.step = function (s, input = {}, dt = 1 / 60) {
    s.events = [];
    if (s.phase !== 'playing') return s.events;
    dt = clamp(dt, 0, 0.05);
    s.time += dt; s.run.time += dt;
    s.chainTime = Math.max(0, s.chainTime - dt); if (s.chainTime === 0) s.chain = 1;
    s.buoys = s.buoys.filter(b => (b.t -= dt) > 0);
    moveBoat(s, input, dt); moveMines(s, dt);
    // Stage rewards are committed after fatal damage checks.
    const scoreBefore = s.score, bestBefore = s.bestChain;
    const lureBefore = s.run.lures, sectorLureBefore = s.sectorStats.lures;
    const drops = mineCollisions(s);
    if (damage(s)) {
      s.score = scoreBefore; s.chain = 1; s.chainTime = 0; s.bestChain = bestBefore;
      s.run.lures = lureBefore; s.sectorStats.lures = sectorLureBefore;
      s.events = s.events.filter(e => e.type !== 'score');
      return s.events;
    }
    for (const drop of drops) P.spawnPearl(s, 'gold', drop);
    for (let i = s.pearls.length - 1; i >= 0; i--) {
      const pearl = s.pearls[i];
      if (s.perk === 'compass' && distance(pearl, s.boat) < 105) {
        const d = distance(pearl, s.boat) || 1;
        pearl.x += (s.boat.x - pearl.x) / d * 110 * dt; pearl.y += (s.boat.y - pearl.y) / d * 110 * dt;
      }
      if (!P.hullHit(s.boat, pearl, 8) && !P.sweptHit(s.boat, pearl, 26)) continue;
      s.pearls.splice(i, 1); award(s, pearl.value, pearl.x, pearl.y, pearl.type === 'moon' ? 'MOON PEARL' : '', pearl.salvage);
      s.cargo++; s.run.cargo++; s.sectorStats.cargo++;
      emit(s, 'pearl', pearl.x, pearl.y, { kind: pearl.type });
      s.spawnTime = Math.min(s.spawnTime, 1.4);
    }
    if (s.mode === 'tutorial') tutorialStep(s, input, dt);
    else if (s.cargo >= s.quota) activateHarbor(s);
    if (s.harbor.active && distance(s.boat, s.harbor) < s.harbor.r) {
      s.harbor.dockTime += dt;
      if (s.harbor.dockTime >= 0.35) {
        s.score += 500 + s.boat.hull * 150; s.run.sectors++;
        s.phase = s.mode === 'tutorial' || s.mode !== 'endless' && s.sector >= 2 ? 'complete' : 'sectorComplete';
        emit(s, 'finish', s.harbor.x, s.harbor.y);
        return s.events;
      }
    } else s.harbor.dockTime = 0;
    if (!s.harbor.active && (s.mode !== 'tutorial' || s.tutorial.stage < 2)) {
      s.refill -= dt;
      if (s.refill <= 0 && s.pearls.filter(p => !p.salvage).length < 3) { bed(s); s.refill = 1.25; }
    }
    if (s.mode !== 'tutorial' && !s.harbor.active) {
      s.spawnTime -= dt;
      if (s.spawnTime <= 0) {
        P.spawnMine(s);
        s.spawnTime = Math.max(2.5, 7 - s.time / 35 - s.voyageIndex * 0.3);
      }
    }
    return s.events;
  };
  P.medals = function (s) { return (s.phase === 'complete' ? 1 : 0) + (s.phase === 'complete' && s.run.damage === 0 ? 1 : 0) + (s.phase === 'complete' && s.run.lures >= 3 ? 1 : 0); };
  P.createClock = function () {
    let last = null, acc = 0;
    return { reset() { last = null; acc = 0; },
      advance(timestamp, tick) {
        if (last === null) { last = timestamp; return 0; }
        acc += clamp((timestamp - last) / 1000, 0, 0.1); last = timestamp;
        let count = 0;
        while (acc + 1e-10 >= 1 / 60 && count < 5) { tick(1 / 60); acc -= 1 / 60; count++; }
        if (count === 5) acc = 0;
        return count;
      } };
  };
})(globalThis.Pearls ||= {});
