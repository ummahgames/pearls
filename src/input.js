(function (P) {
  'use strict';
  P.Input = class {
    constructor({ canvas, pad, knob, brake, dash, buoy, onAction, onGesture }) {
      this.enabled = false; this.keys = new Set(); this.pointer = null; this.vector = { x: 0, y: 0 }; this.pending = { dash: false, buoy: false }; this.touchBrake = false; this.knob = knob;
      const gameplayKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyE']);
      addEventListener('keydown', e => {
        if (e.target.closest?.('input, select, textarea, dialog')) return;
        if (['Escape', 'KeyP', 'KeyR', 'Enter'].includes(e.code)) { if (!e.repeat) onAction(e.code); return; }
        if (!this.enabled || !gameplayKeys.has(e.code) || e.target.closest?.('button, a')) return;
        e.preventDefault(); onGesture(); this.keys.add(e.code);
        if (!e.repeat && e.code === 'Space') this.pending.dash = true;
        if (!e.repeat && e.code === 'KeyE') this.pending.buoy = true;
      });
      addEventListener('keyup', e => this.keys.delete(e.code));
      addEventListener('blur', () => this.clear());
      canvas.addEventListener('pointerdown', () => { onGesture(); if (this.enabled) canvas.focus({ preventScroll: true }); });
      const updateStick = e => {
        const r = pad.getBoundingClientRect(), radius = r.width * 0.34;
        let x = (e.clientX - r.left - r.width / 2) / radius, y = (e.clientY - r.top - r.height / 2) / radius;
        const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
        if (length < 0.12) { x = 0; y = 0; }
        this.vector = { x, y }; knob.style.transform = `translate(${x * radius}px, ${y * radius}px)`;
      };
      pad.addEventListener('pointerdown', e => {
        if (!this.enabled || this.pointer !== null) return;
        e.preventDefault(); onGesture(); this.pointer = e.pointerId; pad.setPointerCapture(e.pointerId); updateStick(e);
      });
      pad.addEventListener('pointermove', e => { if (e.pointerId === this.pointer) { e.preventDefault(); updateStick(e); } });
      const release = e => { if (e.pointerId === this.pointer) { this.pointer = null; this.vector = { x: 0, y: 0 }; knob.style.transform = ''; } };
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(event, release);
      for (const [button, action] of [[dash, 'dash'], [buoy, 'buoy'], [brake, 'brake']]) {
        button.addEventListener('pointerdown', e => {
          if (!this.enabled) return;
          e.preventDefault(); onGesture(); button.setPointerCapture(e.pointerId);
          if (action === 'brake') this.touchBrake = true; else this.pending[action] = true;
          button.classList.add('held');
        });
        const end = () => { if (action === 'brake') this.touchBrake = false; button.classList.remove('held'); };
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, end);
        button.addEventListener('keydown', e => { if (this.enabled && !e.repeat && ['Space', 'Enter'].includes(e.code)) { e.preventDefault(); if (action === 'brake') this.touchBrake = true; else this.pending[action] = true; } });
        button.addEventListener('keyup', end); button.addEventListener('blur', end);
      }
      this.buttons = [brake, dash, buoy];
    }
    clear() { this.keys.clear(); this.pending = { dash: false, buoy: false }; this.vector = { x: 0, y: 0 }; this.pointer = null; this.touchBrake = false; this.knob.style.transform = ''; for (const b of this.buttons || []) b.classList.remove('held'); }
    setEnabled(enabled) { this.enabled = enabled; if (!enabled) this.clear(); }
    sample() {
      if (!this.enabled) return {};
      const held = (...codes) => codes.some(k => this.keys.has(k));
      const pointer = this.pointer !== null;
      const action = { x: pointer ? this.vector.x : Number(held('ArrowRight', 'KeyD')) - Number(held('ArrowLeft', 'KeyA')),
        y: pointer ? this.vector.y : Number(held('ArrowDown', 'KeyS')) - Number(held('ArrowUp', 'KeyW')),
        pointer, brake: this.touchBrake || held('ShiftLeft', 'ShiftRight'), ...this.pending };
      this.pending.dash = false; this.pending.buoy = false; return action;
    }
  };
})(globalThis.Pearls ||= {});
