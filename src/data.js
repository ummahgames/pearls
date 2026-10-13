(function (P) {
  'use strict';
  P.VERSION = 1;
  P.VOYAGES = [
    { name: 'The sheltered lagoon', subtitle: 'Every great journey begins with a little courage.', color: '#8ed7bc', symbol: '◒', quotas: [6, 8, 10], budgets: [2, 3, 4], current: false, reefs: 0, chasers: 0 },
    { name: 'The lantern strand', subtitle: 'Follow the pearls where the warm water glows.', color: '#ecd08b', symbol: '✧', quotas: [8, 10, 12], budgets: [3, 4, 5], current: false, reefs: 0, chasers: 0 },
    { name: 'The crosswind coast', subtitle: 'The tide is a companion. Learn its language.', color: '#9ed8df', symbol: '≋', quotas: [10, 12, 14], budgets: [4, 5, 6], current: true, reefs: 0, chasers: 0 },
    { name: 'The coral passages', subtitle: 'Between the reefs, there is always a way.', color: '#e6ab91', symbol: '❖', quotas: [10, 12, 14], budgets: [4, 5, 6], current: true, reefs: 3, chasers: 0 },
    { name: 'The indigo deep', subtitle: 'Let the hunters follow. Leave them a surprise.', color: '#b9b5e4', symbol: '☾', quotas: [12, 14, 16], budgets: [5, 6, 7], current: true, reefs: 2, chasers: 0.4, whirlpool: true },
    { name: 'The homeward tide', subtitle: 'One last passage. A harbor full of stories.', color: '#e4c984', symbol: '✺', quotas: [12, 16, 18], budgets: [5, 7, 8], current: true, reefs: 4, chasers: 0.5, whirlpool: true },
  ];
  P.CHARTS = [
    { id: 'compass', name: 'Pearl compass', symbol: '✧', description: 'A gentle attraction draws nearby pearls to your hull.' },
    { id: 'quiet', name: 'The quiet sail', symbol: '☾', description: 'Mines notice you from a shorter distance. Echo buoys still call them.' },
    { id: 'salvage', name: 'Salvager’s knot', symbol: '❖', description: 'Credited mine collisions and their salvage earn 50% more value.' },
    { id: 'tideglass', name: 'Tideglass charm', symbol: '≋', description: 'Currents exert half their usual force on your dhow.' },
  ];
  P.SECTOR_NAMES = [
    ['The first glimmer', 'A gentle pursuit', 'A lantern at home'],
    ['Ivory and moonlight', 'The pearl necklace', 'A golden cargo'],
    ['Reading the water', 'Against the breeze', 'A helpful tide'],
    ['Between the corals', 'The narrow crossing', 'A winding way home'],
    ['Hunters in the blue', 'The turning water', 'A light in the deep'],
    ['Everything you learned', 'A sea of possibilities', 'The homeward passage'],
  ];
  P.DEFAULT_SAVE = () => ({ version: P.VERSION, unlocked: 0, tutorialDone: false, records: {}, checkpoint: null,
    settings: { steering: 'direct', volume: 0.45, muted: false, reducedMotion: false, contrast: false, touch: false } });
  P.readSave = function (storage) {
    const base = P.DEFAULT_SAVE();
    try {
      const data = JSON.parse(storage.getItem('pearls-v1'));
      if (!data || data.version !== P.VERSION) return base;
      base.unlocked = Math.max(0, Math.min(5, Math.floor(Number(data.unlocked) || 0)));
      base.tutorialDone = data.tutorialDone === true;
      const cp = data.checkpoint;
      if (cp && cp.mode === 'campaign' && Number.isInteger(cp.voyageIndex) && cp.voyageIndex >= 0 && cp.voyageIndex <= base.unlocked && [1, 2].includes(cp.sector) && Number.isFinite(cp.seed) && Number.isFinite(cp.score) && cp.score >= 0 && cp.run) {
        base.checkpoint = { mode: 'campaign', voyageIndex: cp.voyageIndex, sector: cp.sector, seed: cp.seed >>> 0,
          score: Math.min(1e9, cp.score), bestChain: Math.max(1, Math.min(5, Number(cp.bestChain) || 1)),
          perk: P.CHARTS.some(c => c.id === cp.perk) ? cp.perk : null,
          run: Object.fromEntries(['cargo', 'lures', 'damage', 'time', 'sectors'].map(k => [k, Math.max(0, Math.min(1e7, Number(cp.run[k]) || 0))])) };
      }
      if (data.records && typeof data.records === 'object' && !Array.isArray(data.records)) {
        for (const [key, record] of Object.entries(data.records).slice(-100)) {
          if (/^(voyage-[0-5]|endless|daily-\d{4}-\d{2}-\d{2})$/.test(key) && record && typeof record === 'object') {
            base.records[key] = { score: Math.max(0, Math.min(1e9, Number(record.score) || 0)),
              medals: Math.max(0, Math.min(3, Math.floor(Number(record.medals) || 0))),
              bestChain: Math.max(1, Math.min(5, Number(record.bestChain) || 1)), completed: record.completed === true };
          }
        }
      }
      const s = data.settings || {};
      base.settings.steering = s.steering === 'classic' ? 'classic' : 'direct';
      base.settings.volume = Number.isFinite(s.volume) ? Math.max(0, Math.min(1, s.volume)) : 0.45;
      for (const key of ['muted', 'reducedMotion', 'contrast', 'touch']) base.settings[key] = s[key] === true;
    } catch { /* Unavailable or malformed saves never prevent play. */ }
    return base;
  };
  P.writeSave = function (storage, data) { try { storage.setItem('pearls-v1', JSON.stringify(data)); return true; } catch { return false; } };
  P.hash = function (value) { let h = 2166136261; for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  P.random = function (seed) { let n = seed >>> 0; return () => { n = (n + 0x6D2B79F5) | 0; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  P.localDate = function (date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
})(globalThis.Pearls ||= {});
