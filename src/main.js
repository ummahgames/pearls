(function (P) {
  'use strict';
  const $ = id => document.getElementById(id);
  const ui = Object.fromEntries(['game', 'screen', 'hud', 'sector-label', 'quota-label', 'quota-fill', 'objective-hint', 'score-label', 'combo-label', 'combo-fill', 'hull-label', 'ability-bar', 'dash-status', 'buoy-status', 'tide-status', 'touch-controls', 'tutorial-tip', 'voyage-banner', 'toast', 'announcer', 'control-hint', 'save-status'].map(id => [id, $(id)]));
  let storage; try { storage = globalThis.localStorage; } catch { storage = null; }
  const save = P.readSave(storage), settings = save.settings;
  try { if (!storage?.getItem('pearls-v1') && matchMedia('(prefers-reduced-motion: reduce)').matches) settings.reducedMotion = true; } catch { /* Defaults remain usable. */ }
  const renderer = new P.Renderer(ui.game, settings), audio = new P.Audio(settings), clock = P.createClock();
  let game, screenName = 'home', pendingLaunch = null, transitionHandled = false, previousFrame = null, ambient = 0;
  let bannerTime = 0, toastTime = 0, touchSeen = false;
  const portrait = () => matchMedia('(max-width: 600px) and (orientation: portrait)').matches;
  const num = n => Math.round(n).toLocaleString();
  const duration = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const announce = message => { ui.announcer.textContent = message; };
  function persist() {
    const ok = P.writeSave(storage, save);
    ui['save-status'].textContent = ok ? 'Progress stays on this device' : 'Playing without saved progress';
    ui['save-status'].title = ok ? 'Local progress. No account or connection required.' : 'Browser storage is unavailable. This session still works, but progress will not survive a reload.';
  }
  function touchEnabled() { return settings.touch || touchSeen || matchMedia('(pointer: coarse)').matches; }
  function applySettings() {
    document.body.classList.toggle('reduced-motion', settings.reducedMotion);
    document.body.classList.toggle('high-contrast', settings.contrast);
    document.body.classList.toggle('has-touch', touchEnabled());
    ui['touch-controls'].hidden = !touchEnabled() || game?.phase !== 'playing';
    $('sound-toggle').textContent = settings.muted ? '♪̸' : '♫';
    $('sound-toggle').setAttribute('aria-label', settings.muted ? 'Unmute sound' : 'Mute sound');
    if (game) game.steering = settings.steering;
    audio.update();
  }
  const input = new P.Input({ canvas: ui.game, pad: $('stick-pad'), knob: $('stick-knob'), brake: $('touch-brake'), dash: $('touch-dash'), buoy: $('touch-buoy'),
    onGesture: () => audio.unlock(), onAction(code) {
      if (code === 'Escape' || code === 'KeyP') { if (game?.phase === 'playing') pause(); else if (screenName === 'paused') resume(); }
      if (code === 'KeyR' && ['gameover', 'complete'].includes(game?.phase)) retry();
      if (code === 'Enter' && document.activeElement === ui.game && game?.phase !== 'playing') ui.screen.querySelector('button:not(:disabled)')?.click();
    } });
  function show(html, name = 'panel-screen') {
    screenName = name; ui.screen.className = `screen ${name === 'home' ? 'menu-screen' : ''}`; ui.screen.innerHTML = html; ui.screen.hidden = false;
    input.setEnabled(false); ui['touch-controls'].hidden = true; ui['ability-bar'].hidden = true; ui['tutorial-tip'].hidden = true;
    ui.screen.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  function demo() {
    game = P.createGame({ voyageIndex: 2, seed: 123456, portrait: portrait() });
    game.phase = 'menu'; game.mines = []; game.pearls = []; game.reefs = [];
    game.boat.x = game.width * 0.77; game.boat.y = game.height * 0.57; game.boat.angle = -0.45; game.boat.vx = 85; game.boat.invulnerable = 0;
    for (let i = 0; i < 7; i++) game.pearls.push({ id: i, x: game.width * (0.65 + Math.sin(i * 2) * 0.18), y: game.height * (0.35 + i * 0.055), r: 9, type: i === 2 ? 'gold' : 'ivory' });
    game.currents = []; renderer.reset(); clock.reset();
  }
  function home() {
    demo(); ui.hud.hidden = true; ui['voyage-banner'].hidden = true; ui.toast.hidden = true;
    const completed = Object.values(save.records).filter(r => r.completed).length;
    show(`<div class="menu-content"><span class="eyebrow">A LITTLE OCEAN · A GRAND ADVENTURE</span><h1 class="hero-title">The sea<br>is <em>yours.</em></h1><p class="hero-copy">A dhow, a glimmer of pearls, and a tide full of surprises. Gather your treasure. Outsmart the mines. Find your way home.</p><div class="button-row"><button class="button primary" data-action="play">${save.checkpoint ? 'Resume your voyage' : save.unlocked ? 'Continue the journey' : 'Set sail'} <span aria-hidden="true">↗</span></button><button class="button" data-action="voyages">Voyage chart</button></div><div class="menu-links"><button class="text-button" data-action="daily">Today’s tide</button><button class="text-button" data-action="endless">Endless waters</button><button class="text-button" data-action="tutorial">Learn to sail</button></div><p class="menu-footnote">${save.checkpoint ? `Your banked cargo is safe. Resume at sector ${save.checkpoint.sector + 1}.` : `Six voyages. Your own pace. ${completed ? 'Your harbor remembers your little victories.' : 'No connection needed. Just a little courage.'}`}</p></div>`, 'home');
    ui['control-hint'].textContent = 'Collect pearls · lure mines together · return to harbor'; announce('Pearls. Choose Set sail, Voyage chart, or a challenge.');
  }
  function voyages() {
    ui.hud.hidden = true;
    show(`<div class="panel"><div class="panel-heading"><div><span class="eyebrow">YOUR JOURNEY</span><h2>Six seas to call your own</h2></div><button class="icon-button" data-action="home" aria-label="Return home">×</button></div><p>Complete a voyage to open the next. Three sectors, one small boat, a new story with every tide.</p><div class="voyage-grid">${P.VOYAGES.map((v, i) => {
      const r = save.records[`voyage-${i}`], locked = i > save.unlocked;
      return `<button class="voyage-card" data-action="voyage" data-index="${i}" ${locked ? 'disabled' : ''}><span class="eyebrow">VOYAGE ${String(i + 1).padStart(2, '0')}${locked ? ' · LOCKED' : ''}</span><span class="voyage-symbol" style="color:${v.color}" aria-hidden="true">${v.symbol}</span><strong>${v.name}</strong><small>${locked ? 'Complete the previous voyage' : r ? `Best ${num(r.score)} · ${r.completed ? 'Voyage complete' : 'Keep exploring'}` : `${v.quotas.join(' / ')} pearls · three sectors`}</small>${r?.medals ? `<small class="medals" aria-label="${r.medals} medals">${'✦'.repeat(r.medals)}</small>` : ''}</button>`;
    }).join('')}</div><p class="settings-note">Medals: finish the voyage · finish without damage · make three clever lures. Mastery is optional; completion opens the next sea.</p></div>`, 'voyages');
    announce('Voyage selection. Complete each voyage to unlock the next.');
  }
  function start(options, bypassIntro = false) {
    audio.unlock();
    if (options.mode === 'campaign' && !save.tutorialDone && !bypassIntro) {
      pendingLaunch = options; start({ mode: 'tutorial', seed: 90210 }, true); return;
    }
    game = P.createGame({ ...options, portrait: portrait(), steering: settings.steering });
    if (game.mode === 'campaign' && !options.sector) { save.checkpoint = null; persist(); }
    transitionHandled = false; renderer.reset(); clock.reset(); input.clear(); input.setEnabled(true);
    ui.screen.hidden = true; ui.hud.hidden = false; ui['ability-bar'].hidden = game.mode === 'tutorial';
    ui.toast.hidden = true; toastTime = 0; screenName = 'playing';
    const title = game.mode === 'tutorial' ? 'A captain’s first steps' : game.mode === 'endless' ? 'Beyond the horizon' : game.mode === 'daily' ? 'Today’s tide' : game.level.name;
    banner(title); applySettings(); hud(); ui.game.focus({ preventScroll: true });
    if (game.mode === 'campaign' && game.sector === 0) toast([
      'Mines glow when they notice you. Let them chase, then turn.',
      'Moon pearls carry extra value. A silver sparkle marks the rare ones.',
      'Follow the water arrows. Currents carry your dhow and the mines.',
      'Coral islands are solid. Wide turns keep your path clear.',
      'Diamond hunters turn slowly. Bait them past an echo buoy.',
      'Use everything you learned. One last harbor is waiting.',
    ][game.voyageIndex]);
    ui['control-hint'].textContent = touchEnabled() ? 'Joystick to steer · hold BRAKE · SURGE to escape · ECHO to lure' : settings.steering === 'classic' ? '← → rotate · ↑ ↓ thrust · Shift brake · Space surge · E echo · P pause' : 'Arrows / WASD steer · Shift brake · Space surge · E echo · P pause';
    announce(`${title}. Collect ${game.quota} pearls, then return to harbor.`);
  }
  function banner(title) { bannerTime = 2.4; ui['voyage-banner'].textContent = title; ui['voyage-banner'].hidden = false; }
  function toast(message) { toastTime = 3.5; ui.toast.textContent = message; ui.toast.hidden = false; announce(message); }
  function pause(reason = 'Take a breath. The tide can wait.') {
    if (game?.phase !== 'playing') return;
    game.phase = 'paused'; clock.reset(); audio.suspend();
    show(`<div class="panel narrow"><span class="eyebrow">AT ANCHOR</span><h2>The sea will wait.</h2><p>${reason}</p><div class="button-row"><button class="button primary" data-action="resume">Keep sailing ↗</button><button class="button" data-action="settings">Preferences</button></div><div class="menu-links"><button class="text-button" data-action="retry">Restart voyage</button><button class="text-button" data-action="leave">Return to the chart</button></div><p class="settings-note">Arrows / WASD steer, Shift brakes, Space surges. Drop an echo buoy with E to draw nearby mines together, then sail away.</p></div>`, 'paused');
    announce('Paused. Resume when ready.');
  }
  function resume() {
    if (game.phase !== 'paused' || $('settings-dialog').open) return;
    game.phase = 'playing'; ui.screen.hidden = true; screenName = 'playing'; clock.reset(); input.clear(); input.setEnabled(true); audio.unlock();
    ui['ability-bar'].hidden = game.mode === 'tutorial'; applySettings(); ui.game.focus({ preventScroll: true }); announce('Resumed.');
  }
  function retry() {
    const options = { mode: game.mode, voyageIndex: game.voyageIndex, seed: game.seed, dailyDate: game.dailyDate };
    start(options, true);
  }
  function record() {
    if (game.mode === 'tutorial') return;
    const key = game.mode === 'campaign' ? `voyage-${game.voyageIndex}` : game.mode === 'daily' ? `daily-${game.dailyDate}` : 'endless';
    const old = save.records[key] || { score: 0, medals: 0, bestChain: 1, completed: false };
    const completed = game.phase === 'complete';
    game.newBest = game.score > old.score;
    save.records[key] = { score: Math.max(game.score, old.score), medals: Math.max(P.medals(game), old.medals), bestChain: Math.max(game.bestChain, old.bestChain), completed: completed || old.completed };
    if (completed && game.mode === 'campaign') save.unlocked = Math.max(save.unlocked, Math.min(5, game.voyageIndex + 1));
    if (game.mode === 'campaign') save.checkpoint = null;
    // Keep a bounded local history, with campaign and endless records protected.
    const dailyKeys = Object.keys(save.records).filter(k => k.startsWith('daily-')).sort();
    while (dailyKeys.length > 30) delete save.records[dailyKeys.shift()];
    persist();
  }
  function stats() { return `<div class="stats-grid"><div class="stat"><strong>${num(game.score)}</strong><span>Cargo value</span></div><div class="stat"><strong>${game.run.cargo}</strong><span>Pearls gathered</span></div><div class="stat"><strong>${game.run.lures}</strong><span>Clever lures</span></div><div class="stat"><strong>${game.bestChain}×</strong><span>Best chain</span></div><div class="stat"><strong>${duration(game.run.time)}</strong><span>At sea</span></div><div class="stat"><strong>${game.run.sectors}</strong><span>Sectors sailed</span></div></div>`; }
  function result() {
    input.setEnabled(false); ui['voyage-banner'].hidden = true;
    if (game.mode === 'tutorial') {
      save.tutorialDone = true; persist();
      show(`<div class="panel narrow"><span class="eyebrow">YOU HAVE THE HELM</span><h2>A captain in the making.</h2><p>You gathered pearls, learned the brake, and turned two mines against each other. The ocean is ready for you.</p><div class="button-row"><button class="button primary" data-action="tutorial-finish">${pendingLaunch ? 'Begin the voyage ↗' : 'Choose your voyage ↗'}</button></div></div>`, 'result');
      announce('Sailing introduction complete.'); return;
    }
    record();
    const complete = game.phase === 'complete', medals = P.medals(game);
    const title = complete ? game.voyageIndex === 5 && game.mode === 'campaign' ? 'Every tide leads home.' : 'A harbor full of treasure.' : 'Even captains meet rough seas.';
    const copy = complete ? game.mode === 'daily' ? 'Today’s tide is yours. The same chart will be waiting if you want another attempt.' : game.voyageIndex === 5 ? 'You have sailed all six seas. The journey is yours to revisit, and endless waters still await.' : 'Cargo banked. Stories gathered. Another sea is waiting on your chart.' : 'Your little boat gave it a good voyage. Try an echo buoy, brake into a turn, and let the mines chase each other.';
    show(`<div class="panel narrow"><span class="eyebrow">${complete ? 'VOYAGE COMPLETE' : 'VOYAGE ENDED'}${game.newBest ? ' · PERSONAL BEST' : ''}</span><h2>${title}</h2><p>${copy}</p>${stats()}${complete ? `<p class="medals" aria-label="${medals} medals">${'✦'.repeat(medals)}${' ·'.repeat(3 - medals)}</p><p class="settings-note">${game.run.damage === 0 ? 'Hull intact. ' : ''}${game.run.lures >= 3 ? 'Master of the clever lure. ' : 'Three clever lures earn another medal. '}</p>` : ''}<div class="button-row">${complete && game.mode === 'campaign' && game.voyageIndex < 5 ? '<button class="button primary" data-action="next-voyage">Explore the next sea ↗</button>' : '<button class="button primary" data-action="retry">Sail again ↗</button>'}<button class="button" data-action="home">Home</button></div>${game.mode === 'daily' ? `<p class="settings-note">Local date ${game.dailyDate} · chart v1 · ${game.width < game.height ? 'portrait' : 'landscape'} · seed ${game.seed}. Records are personal.</p>` : ''}</div>`, 'result');
    announce(`${complete ? 'Voyage complete' : 'Voyage ended'}. Cargo value ${num(game.score)}. ${game.run.lures} clever lures.`);
  }
  function charts() {
    input.setEnabled(false); ui['voyage-banner'].hidden = true;
    if (game.mode === 'campaign') { save.checkpoint = checkpoint(game, game.sector + 1, null); persist(); }
    const rng = P.random(P.hash(`${game.seed}:chart:${game.sector}`));
    const choices = [...P.CHARTS]; for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
    show(`<div class="panel"><span class="eyebrow">SECTOR ${game.sector + 1} BANKED · HULL RESTORED AT LAUNCH</span><h2>A gift from the tide.</h2><p>${game.mode === 'daily' ? 'The daily chart keeps your dhow unchanged. Ready for the next passage?' : 'Choose a nautical charm for the next sector. Every gift lasts one passage; every choice tells a different story.'}</p><div class="stats-grid"><div class="stat"><strong>${num(game.score)}</strong><span>Banked value</span></div><div class="stat"><strong>${game.sectorStats.lures}</strong><span>Sector lures</span></div><div class="stat"><strong>${duration(game.time)}</strong><span>Passage time</span></div></div>${game.mode === 'daily' ? '<button class="button primary" data-action="next-sector">Next passage ↗</button>' : `<div class="charts">${choices.slice(0, 3).map(c => `<button class="chart" data-action="next-sector" data-perk="${c.id}"><span class="chart-symbol" aria-hidden="true">${c.symbol}</span><strong>${c.name}</strong><small>${c.description}</small></button>`).join('')}</div>`}<button class="text-button" data-action="leave">Return to the chart</button></div>`, 'charts');
    announce(`Sector ${game.sector + 1} complete. Choose a charm for the next passage.`);
  }
  function advance(perk) {
    if (game.phase !== 'sectorComplete') return;
    game = P.nextSector(game, perk || null); transitionHandled = false; renderer.reset(); clock.reset(); input.clear(); input.setEnabled(true);
    if (game.mode === 'campaign') { save.checkpoint = checkpoint(game, game.sector, perk || null); persist(); }
    screenName = 'playing'; ui.screen.hidden = true; ui.hud.hidden = false; ui['ability-bar'].hidden = false; audio.unlock(); applySettings(); hud(); ui.game.focus({ preventScroll: true });
    banner(game.mode === 'endless' ? `Passage ${game.sector + 1}` : P.SECTOR_NAMES[game.voyageIndex][game.sector]);
  }
  function checkpoint(s, sector, perk) { return { mode: 'campaign', voyageIndex: s.voyageIndex, sector, seed: s.seed, score: s.score, bestChain: s.bestChain, run: { ...s.run }, perk }; }
  function hud() {
    if (!game) return;
    const b = game.boat, teaching = game.mode === 'tutorial';
    ui['sector-label'].textContent = teaching ? 'SAILING SCHOOL' : game.mode === 'endless' ? `PASSAGE ${game.sector + 1} · ENDLESS` : `VOYAGE ${game.voyageIndex + 1} · SECTOR ${game.sector + 1} / 3`;
    ui['quota-label'].textContent = game.harbor.active ? 'Return to harbor ↗' : `${Math.min(game.cargo, game.quota)} / ${game.quota} pearls`;
    ui['quota-fill'].style.width = `${Math.min(100, game.cargo / game.quota * 100)}%`;
    ui['objective-hint'].textContent = game.harbor.active ? 'Follow the gold compass arrow' : game.perk ? P.CHARTS.find(c => c.id === game.perk).name : 'Gather pearls · lure the mines';
    ui['score-label'].textContent = num(game.score); ui['combo-label'].textContent = `${game.chain}×`;
    ui['combo-fill'].style.width = `${game.chainTime / 4 * 100}%`;
    ui['hull-label'].textContent = '◆ '.repeat(b.hull) + '◇ '.repeat(3 - b.hull); ui['hull-label'].setAttribute('aria-label', `${b.hull} of three hull points`);
    ui['dash-status'].textContent = b.dashCooldown > 0 ? `SURGE · ${Math.ceil(b.dashCooldown)}s` : 'SPACE · SURGE READY';
    ui['buoy-status'].textContent = b.buoyCooldown > 0 ? `ECHO · ${Math.ceil(b.buoyCooldown)}s` : 'E · ECHO READY';
    $('touch-dash').textContent = b.dashCooldown > 0 ? `${Math.ceil(b.dashCooldown)}s` : 'SURGE'; $('touch-buoy').textContent = b.buoyCooldown > 0 ? `${Math.ceil(b.buoyCooldown)}s` : 'ECHO';
    ui['tide-status'].textContent = game.time < 35 ? 'CALM WATER' : game.time < 70 ? 'THE TIDE IS RISING' : 'HIGH TIDE';
    if (teaching && game.phase === 'playing') {
      ui['tutorial-tip'].hidden = false;
      const tips = [
        ['Find your first pearl', touchEnabled() ? 'Use the joystick to sail toward the glowing pearls.' : settings.steering === 'classic' ? 'Left / right turn. Up moves forward. Sail toward a glowing pearl.' : 'Arrows or WASD sail in that direction. Head toward a glowing pearl.'],
        ['A little control goes a long way', touchEnabled() ? 'Hold BRAKE for a moment to steady your dhow.' : 'Hold Shift for a moment to brake and steady your dhow.'],
        ['Let the mines do the work', touchEnabled() ? 'Tap ECHO, then sail away. Two mines will follow your buoy into each other.' : 'Press E to drop an echo buoy, then sail away. Or lure the mines with your dhow. Your hull is safe here.'],
        ['Bring your story home', 'Follow the gold arrow and sail into the harbor circle.'],
      ];
      const key = `${game.tutorial.stage}:${touchEnabled()}:${settings.steering}`;
      if (ui['tutorial-tip'].dataset.key !== key) { const tip = tips[game.tutorial.stage]; ui['tutorial-tip'].innerHTML = `<strong>${tip[0]}</strong>${tip[1]}<br><button class="text-button" data-action="skip-tutorial">Skip sailing school ↗</button>`; ui['tutorial-tip'].dataset.key = key; announce(tip[0]); }
    } else ui['tutorial-tip'].hidden = true;
  }
  function openSettings() {
    if (game?.phase === 'playing') pause();
    $('steering-setting').value = settings.steering; $('volume-setting').value = settings.volume;
    $('motion-setting').checked = settings.reducedMotion; $('contrast-setting').checked = settings.contrast; $('touch-setting').checked = settings.touch;
    $('settings-dialog').showModal();
  }
  document.addEventListener('click', e => {
    const button = e.target.closest('[data-action]'); if (!button || button.disabled) return;
    audio.unlock(); const action = button.dataset.action;
    if (action === 'home') home();
    if (action === 'voyages') voyages();
    if (action === 'play') start(save.checkpoint ? { ...save.checkpoint, run: { ...save.checkpoint.run } } : { mode: 'campaign', voyageIndex: save.unlocked });
    if (action === 'voyage') start({ mode: 'campaign', voyageIndex: Number(button.dataset.index) });
    if (action === 'daily') { const date = P.localDate(); start({ mode: 'daily', voyageIndex: 2 + P.hash(date) % 4, seed: P.hash(`daily:${date}:v1`), dailyDate: date }, true); }
    if (action === 'endless') start({ mode: 'endless' }, true);
    if (action === 'tutorial') { pendingLaunch = null; start({ mode: 'tutorial', seed: 90210 }, true); }
    if (action === 'resume') resume();
    if (action === 'settings') openSettings();
    if (action === 'retry') retry();
    if (action === 'next-voyage') start({ mode: 'campaign', voyageIndex: game.voyageIndex + 1 }, true);
    if (action === 'next-sector') advance(button.dataset.perk);
    if (action === 'tutorial-finish' || action === 'skip-tutorial') { save.tutorialDone = true; persist(); const next = pendingLaunch; pendingLaunch = null; if (next) start(next, true); else home(); }
    if (action === 'leave') show(`<div class="panel narrow"><span class="eyebrow">A CHANGE OF COURSE</span><h2>Head back to the chart?</h2><p>Your current voyage will end here. Your previous records and unlocked seas are safe.</p><div class="button-row"><button class="button primary" data-action="stay">Stay on this voyage</button><button class="button" data-action="home">Return home</button></div></div>`, 'leave');
    if (action === 'stay') { if (game.phase === 'paused') { screenName = 'paused'; resume(); } else charts(); }
  });
  $('pause-button').addEventListener('click', () => pause());
  $('settings-open').addEventListener('click', openSettings);
  $('home-link').addEventListener('click', e => { e.preventDefault(); if (game.phase === 'playing') pause(); else if (game.phase === 'menu') home(); });
  $('sound-toggle').addEventListener('click', () => { settings.muted = !settings.muted; audio.unlock(); applySettings(); persist(); });
  for (const [id, key] of [['steering-setting', 'steering'], ['volume-setting', 'volume'], ['motion-setting', 'reducedMotion'], ['contrast-setting', 'contrast'], ['touch-setting', 'touch']]) $(id).addEventListener(id === 'volume-setting' ? 'input' : 'change', e => {
    settings[key] = e.target.type === 'checkbox' ? e.target.checked : key === 'volume' ? Number(e.target.value) : e.target.value;
    applySettings(); input.clear(); persist();
  });
  addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !touchSeen) { touchSeen = true; applySettings(); } });
  addEventListener('blur', () => { if (game?.phase === 'playing') pause('You stepped away. Your voyage is safely paused.'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (game?.phase === 'playing') pause('The tide was paused while you were away.'); audio.suspend(); clock.reset(); } });
  addEventListener('resize', () => { input.clear(); if (game?.phase === 'menu') demo(); });
  function frame(timestamp) {
    const dt = previousFrame === null ? 0 : Math.min(0.05, Math.max(0, (timestamp - previousFrame) / 1000)); previousFrame = timestamp; ambient += dt;
    if (game.phase === 'playing') clock.advance(timestamp, step => {
      const events = P.step(game, input.sample(), step); renderer.consume(events); audio.consume(events);
      for (const event of events) {
        if (event.type === 'harbor') toast('Cargo full. Follow the gold arrow home.');
        if (event.type === 'damage') announce(`${game.boat.hull} hull points remaining.`);
        if (event.type === 'score' && event.label === 'CLEVER LURE') toast('Clever lure! The sea rewards a little wit.');
      }
    }); else clock.reset();
    if (game.phase !== 'menu') hud();
    const freeze = game.phase === 'paused' || $('settings-dialog').open;
    renderer.draw(game, freeze ? 0 : dt, ambient);
    if (game.phase === 'playing') {
      bannerTime -= dt; if (bannerTime <= 0) ui['voyage-banner'].hidden = true;
      toastTime -= dt; if (toastTime <= 0) ui.toast.hidden = true;
    }
    if (['sectorComplete', 'complete', 'gameover'].includes(game.phase) && !transitionHandled) { transitionHandled = true; if (game.phase === 'sectorComplete') charts(); else result(); }
    requestAnimationFrame(frame);
  }
  home(); applySettings(); persist(); requestAnimationFrame(frame);
})(globalThis.Pearls ||= {});
