(function (P) {
  'use strict';
  const TAU = Math.PI * 2;
  function circle(c, x, y, r, fill, stroke, line = 1) {
    c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = line; c.stroke(); }
  }
  function path(c, points, fill, stroke, line = 1) {
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    if (fill) { c.closePath(); c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = line; c.stroke(); }
  }
  function star(c, x, y, r, color) { path(c, [[x, y - r], [x + r * 0.24, y - r * 0.24], [x + r, y], [x + r * 0.24, y + r * 0.24], [x, y + r], [x - r * 0.24, y + r * 0.24], [x - r, y], [x - r * 0.24, y - r * 0.24]], color); }
  function boat(c, b, time, reduced) {
    c.save(); c.translate(b.x, b.y); c.rotate(b.angle);
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 8) {
      for (let i = 0; i < 5; i++) {
        const phase = reduced ? i / 5 : (time * 2.5 + i / 5) % 1;
        c.globalAlpha = (1 - phase) * Math.min(0.4, speed / 700);
        c.strokeStyle = '#e0efe0'; c.lineWidth = 2 - phase;
        c.beginPath(); c.moveTo(-28 - phase * 45, -4 - phase * 12); c.quadraticCurveTo(-35 - phase * 45, 0, -28 - phase * 45, 4 + phase * 12); c.stroke();
      }
    }
    c.globalAlpha = b.invulnerable > 0 && !reduced ? 0.7 + Math.sin(time * 15) * 0.2 : 1;
    if (b.invulnerable > 0) { circle(c, 0, 0, 37, null, '#caf0d680', 1.5); }
    c.shadowColor = '#031b29a0'; c.shadowBlur = 10; c.shadowOffsetY = 4;
    c.beginPath(); c.moveTo(30, 0); c.bezierCurveTo(12, -15, -17, -14, -28, -8); c.quadraticCurveTo(-32, 0, -28, 8); c.bezierCurveTo(-17, 14, 12, 15, 30, 0);
    const wood = c.createLinearGradient(0, -14, 0, 14); wood.addColorStop(0, '#d5a86e'); wood.addColorStop(0.5, '#9b683c'); wood.addColorStop(1, '#6f482c');
    c.fillStyle = wood; c.fill(); c.strokeStyle = '#f2d1a0'; c.lineWidth = 1.7; c.stroke(); c.shadowBlur = 0; c.shadowOffsetY = 0;
    for (let y = -6; y <= 6; y += 4) { path(c, [[-24, y], [18, y * 0.6]], null, '#f2d1a04a'); }
    path(c, [[-25, -6], [-25, 6]], null, '#4e3425', 3);
    c.fillStyle = '#66432d'; c.fillRect(-20, -5, 10, 10); c.strokeStyle = '#ddc694'; c.strokeRect(-20, -5, 10, 10);
    // A compact lateen sail keeps the collision silhouette legible.
    path(c, [[5, -9], [-12, 2], [14, 7]], '#f2ead3', '#fff7dbb0');
    path(c, [[5, -9], [6, 9]], null, '#63462f', 2);
    path(c, [[6, -9], [-14, 3]], null, '#dbbf89', 1.2);
    star(c, 23, 0, 3, '#f3d793'); c.restore();
  }
  P.Renderer = class {
    constructor(canvas, settings) {
      this.canvas = canvas; this.c = canvas.getContext('2d'); this.settings = settings;
      this.effects = []; this.background = null; this.key = ''; this.shake = 0;
    }
    reset() { this.effects = []; this.shake = 0; this.key = ''; }
    consume(events) {
      for (const e of events) {
        if (['pearl', 'explosion', 'damage', 'score', 'buoy', 'dash', 'finish'].includes(e.type)) this.effects.push({ ...e, life: e.type === 'score' ? 1.1 : e.type === 'finish' ? 2 : 0.7, age: 0 });
        if (e.type === 'damage' && !this.settings.reducedMotion) this.shake = 0.18;
      }
      if (this.effects.length > 100) this.effects.splice(0, this.effects.length - 100);
    }
    resize(s) {
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1), box = this.canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(box.width * dpr)), height = Math.max(1, Math.round(box.height * dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
      // Letterbox a frozen logical arena on resize, preserving positions and pointer-independent controls.
      const scale = Math.min(width / s.width, height / s.height);
      this.c.setTransform(1, 0, 0, 1, 0, 0); this.c.fillStyle = '#071f2a'; this.c.fillRect(0, 0, width, height);
      this.c.setTransform(scale, 0, 0, scale, (width - s.width * scale) / 2, (height - s.height * scale) / 2);
    }
    sea(s) {
      const key = `${s.width}:${s.height}:${s.voyageIndex}`;
      if (key === this.key) return;
      this.key = key; this.background = document.createElement('canvas'); this.background.width = s.width; this.background.height = s.height;
      const c = this.background.getContext('2d'), w = s.width, h = s.height;
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2b7678'); g.addColorStop(0.38, '#1b5a65'); g.addColorStop(1, s.voyageIndex >= 4 ? '#163d60' : '#103e52');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // Decorative shallows remain outside the navigable world boundary.
      for (let j = 4; j >= 0; j--) {
        path(c, [[0, 0], [w * (0.17 + j * 0.022), 0], [w * (0.075 + j * 0.018), 24 + j * 5], [20 + j * 3, h * (0.12 + j * 0.015)], [0, h * (0.18 + j * 0.017)]], ['#dbcea3', '#b9c4a2', '#75ac9c', '#499d91', '#368b87'][j]);
        path(c, [[w, h], [w * (0.89 - j * 0.015), h], [w - 12 - j * 6, h - 22 - j * 5], [w, h * (0.84 - j * 0.016)]], ['#c8ba8c', '#a7b79a', '#639c91', '#418b89', '#307c83'][j]);
      }
      const rng = P.random(910 + s.voyageIndex);
      for (let i = 0; i < 160; i++) {
        const x = rng() * w, y = rng() * h, r = 2 + rng() * 5;
        circle(c, x, y, r, '#92c4b507');
      }
      // Quiet bathymetric contours lend depth without obstructing entities.
      for (let i = 0; i < 7; i++) {
        c.beginPath(); c.ellipse(w * 0.79, h * 0.75, w * (0.22 + i * 0.08), h * (0.18 + i * 0.06), -0.3, 0, TAU);
        c.strokeStyle = '#b4ded50a'; c.lineWidth = 1; c.stroke();
      }
    }
    draw(s, dt = 0, ambientTime = 0) {
      const c = this.c, reduced = this.settings.reducedMotion;
      this.resize(s); this.sea(s); c.save();
      if (this.shake > 0) { if (!reduced) c.translate(Math.sin(s.time * 73) * this.shake * 16, Math.cos(s.time * 57) * this.shake * 10); this.shake = Math.max(0, this.shake - dt); }
      c.drawImage(this.background, 0, 0);
      const time = s.phase === 'menu' ? ambientTime : s.time;
      for (let i = 0; i < 34; i++) {
        const x = (i * 193.7 + (reduced ? 0 : time * 6)) % s.width, y = (i * 107.3 + 42) % s.height;
        c.globalAlpha = 0.09 + 0.04 * Math.sin(time + i);
        path(c, [[x - 8, y], [x + 8, y + 1]], null, '#dbf1dd', 1);
      }
      c.globalAlpha = 1;
      for (const r of s.reefs) this.reef(c, r);
      for (const field of s.currents) this.current(c, field, time, reduced, s.time < 1.3);
      this.harbor(c, s.harbor, time);
      for (const b of s.buoys) {
        const alpha = Math.min(1, b.t); c.globalAlpha = alpha;
        for (let i = 0; i < 3; i++) { const f = reduced ? (i + 1) / 3 : (time * 0.8 + i / 3) % 1; circle(c, b.x, b.y, f * b.r, null, `rgba(237,214,151,${(1 - f) * 0.35})`); }
        circle(c, b.x, b.y, 10, '#e6c577', '#fff0bb', 2); star(c, b.x, b.y, 5, '#815c3f'); c.globalAlpha = 1;
      }
      for (const pearl of s.pearls) this.pearl(c, pearl, time, reduced);
      for (const mine of s.mines) this.mine(c, mine, time, reduced);
      if (s.phase === 'menu') { c.save(); c.translate(s.boat.x, s.boat.y); c.scale(3.2, 3.2); boat(c, { ...s.boat, x: 0, y: 0 }, time, reduced); c.restore(); }
      else boat(c, s.boat, time, reduced);
      if (s.harbor.active && P.distance(s.boat, s.harbor) > 150) {
        const angle = Math.atan2(s.harbor.y - s.boat.y, s.harbor.x - s.boat.x);
        c.save(); c.translate(s.boat.x, s.boat.y); c.rotate(angle);
        path(c, [[47, -5], [55, 0], [47, 5]], null, '#f5dfa3', 2); c.restore();
      }
      for (const fx of this.effects) {
        const p = fx.age / fx.life; c.globalAlpha = Math.max(0, 1 - p);
        if (fx.type === 'score') {
          c.font = '600 13px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff0bd';
          c.fillText(`+${fx.value}`, fx.x, fx.y - 22 - p * 28);
          if (fx.label) { c.font = '8px system-ui'; c.fillText(fx.label, fx.x, fx.y - 7 - p * 28); }
        } else {
          const color = fx.type === 'damage' ? '#ffc1a4' : fx.type === 'explosion' ? '#eed096' : '#c5f1d8';
          circle(c, fx.x, fx.y, 8 + p * (fx.type === 'finish' ? 150 : fx.type === 'explosion' ? 55 : 30), null, color, (1 - p) * 3);
          if (!reduced && fx.type !== 'dash') for (let i = 0; i < 8; i++) {
            const a = i * TAU / 8 + fx.x * 0.01, r = p * (fx.type === 'explosion' ? 65 : 32);
            circle(c, fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 2 * (1 - p), color);
          }
        }
        fx.age += dt;
      }
      this.effects = this.effects.filter(e => e.age < e.life); c.globalAlpha = 1;
      if (s.mode === 'tutorial' && s.tutorial.stage === 2 && s.mines.length >= 2) {
        c.setLineDash([5, 7]); c.beginPath(); c.moveTo(s.width * 0.5 - 95, s.height * 0.52); c.quadraticCurveTo(s.width * 0.5, s.height * 0.68, s.width * 0.5 + 95, s.height * 0.52); c.strokeStyle = '#ecd69566'; c.lineWidth = 2; c.stroke(); c.setLineDash([]);
      }
      c.restore();
    }
    pearl(c, p, time, reduced) {
      const bob = reduced ? 0 : Math.sin(time * 2.5 + p.id) * 1.5;
      const x = p.x, y = p.y + bob;
      circle(c, x, y + 3, p.r + 3, '#052f3b35');
      circle(c, x, y, p.r + 8, p.type === 'gold' ? '#edc57616' : '#c9e9d311');
      const g = c.createRadialGradient(x - 3, y - 4, 1, x, y, p.r);
      g.addColorStop(0, '#fffef1'); g.addColorStop(0.35, p.type === 'gold' ? '#f3d690' : p.type === 'moon' ? '#a3c5d8' : '#f3efdc');
      g.addColorStop(1, p.type === 'gold' ? '#b38945' : p.type === 'moon' ? '#334963' : '#82b7b2');
      circle(c, x, y, p.r, g, '#f3f4d997'); circle(c, x - 3, y - 3, 2.2, '#fff8');
      if (this.settings.contrast) circle(c, x, y, p.r + 2, null, '#fff9dc', 1.5);
      if (p.type !== 'ivory' || !reduced && Math.sin(time * 1.8 + p.id * 1.6) > 0.88) star(c, x + 11, y - 10, p.type === 'moon' ? 5 : 3, '#fff4d8');
    }
    mine(c, m, time, reduced) {
      if (m.warning > 0) {
        c.setLineDash([4, 5]); circle(c, m.x, m.y, 28, '#173d4940', '#ffd697ab', 1.3); c.setLineDash([]);
        c.font = 'bold 17px Georgia'; c.fillStyle = '#f5d28d'; c.textAlign = 'center'; c.fillText('!', m.x, m.y + 6);
        return;
      }
      circle(c, m.x + 2, m.y + 5, m.r + 2, '#041d2c50');
      if (m.state === 'alert') { circle(c, m.x, m.y, m.r + 10, null, '#f2c581', 1.5); }
      c.save(); c.translate(m.x, m.y); c.rotate(m.type === 'chaser' ? m.angle : m.id + time * 0.1);
      const color = m.type === 'chaser' ? '#9d8993' : '#668f94';
      for (let i = 0; i < (m.type === 'chaser' ? 4 : 8); i++) {
        const a = i * TAU / (m.type === 'chaser' ? 4 : 8);
        path(c, [[Math.cos(a) * 11, Math.sin(a) * 11], [Math.cos(a) * 17, Math.sin(a) * 17]], null, color, 2.5);
      }
      if (m.type === 'chaser') path(c, [[19, 0], [0, -15], [-15, 0], [0, 15]], '#273b51', '#c8abb0', 1.5);
      else circle(c, 0, 0, m.r - 1, '#23424c', '#8db4b2', 1.5);
      circle(c, 0, 0, m.r * 0.67, null, '#aec5bc40');
      const hot = m.state === 'chase' || m.state === 'alert';
      circle(c, 0, 0, hot ? 5 : 3.5, hot ? '#f3a68b' : '#dab978');
      if (hot) circle(c, 0, 0, 9 + (reduced ? 0 : Math.sin(time * 5) * 2), '#f5a07920');
      c.restore();
    }
    current(c, f, time, reduced, warning) {
      c.save(); c.globalAlpha = warning ? 0.4 : 0.8;
      circle(c, f.x, f.y, f.r, f.type === 'whirlpool' ? '#182c602c' : '#aadbc609', '#a9dace38');
      if (f.type === 'whirlpool') {
        for (let i = 0; i < 4; i++) {
          const a = (reduced ? 0 : -time * 0.6) + i * TAU / 4;
          c.beginPath(); c.arc(f.x, f.y, f.r * (0.25 + i * 0.17), a, a + 3.7); c.strokeStyle = '#b7c7e64d'; c.lineWidth = 2; c.stroke();
        }
        circle(c, f.x, f.y, 12, '#142b4a33');
      } else {
        for (let i = 0; i < 16; i++) {
          const phase = reduced ? i / 16 : (time * 0.14 + i * 0.618) % 1;
          const a = i * 2.4, r = Math.sqrt(phase) * f.r * 0.85;
          const x = f.x + Math.cos(a) * r, y = f.y + Math.sin(a) * r;
          c.save(); c.translate(x, y); c.rotate(f.angle);
          path(c, [[-10, 0], [8, 0]], null, '#b2ddcd80'); path(c, [[3, -4], [8, 0], [3, 4]], null, '#b2ddcd80'); c.restore();
        }
      }
      c.restore();
    }
    reef(c, r) {
      circle(c, r.x, r.y, r.r + 12, '#82c5a815'); circle(c, r.x, r.y + 3, r.r + 3, '#123e4c');
      c.beginPath();
      for (let i = 0; i <= 16; i++) { const a = i * TAU / 16, radius = r.r * (0.94 + Math.sin(i * 3.5 + r.id) * 0.035); const x = r.x + Math.cos(a) * radius, y = r.y + Math.sin(a) * radius; i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.closePath(); c.fillStyle = '#688f7e'; c.fill(); c.strokeStyle = '#b1c9a680'; c.lineWidth = 3; c.stroke();
      circle(c, r.x - r.r * 0.2, r.y - r.r * 0.15, r.r * 0.55, '#87a388');
      for (let i = 0; i < 5; i++) { const x = r.x + Math.sin(i * 7.7 + r.id) * r.r * 0.58, y = r.y + Math.cos(i * 5.8) * r.r * 0.58; star(c, x, y, 4, '#d1b39890'); }
    }
    harbor(c, h, time) {
      circle(c, h.x, h.y, h.r, h.active ? '#c9e6bb12' : '#082e3e25', h.active ? '#ebd99a90' : '#92b8ab30', 1.5);
      if (h.active) circle(c, h.x, h.y, h.r + 7 + (this.settings.reducedMotion ? 0 : Math.sin(time * 2) * 3), null, '#edda9b40');
      c.save(); c.translate(h.x, h.y);
      path(c, [[-15, -8], [-15, 12], [15, 12], [15, -8]], '#a88552', '#e5cfa1', 1.5);
      path(c, [[-21, -8], [0, -24], [21, -8]], '#d4c599', '#f0e1b9');
      c.fillStyle = '#365252'; c.fillRect(-6, -6, 12, 18); star(c, 0, -14, 4, h.active ? '#fff1b7' : '#a29a78');
      c.font = '600 8px system-ui'; c.textAlign = 'center'; c.fillStyle = h.active ? '#fff0bd' : '#b2cec5'; c.fillText(h.active ? 'RETURN HOME' : 'HARBOR', 0, 31);
      if (h.dockTime > 0) { c.beginPath(); c.arc(0, 0, h.r - 4, -Math.PI / 2, -Math.PI / 2 + Math.min(1, h.dockTime / 0.35) * TAU); c.strokeStyle = '#fff3bd'; c.lineWidth = 3; c.stroke(); }
      c.restore();
    }
  };
})(globalThis.Pearls ||= {});
