# Pearls

Sail a dhow through luminous pearl beds, lure pursuing sea mines into each other, and bring your cargo home. Pearls is a complete client-side Canvas 2D game with no dependencies, accounts, runtime network requests, or server logic.

## Play

Open `index.html` directly in a modern browser, or serve the folder on any static host. Classic script tags deliberately preserve support for `file://`; there is no installation or build step. All art is local SVG or procedural Canvas drawing. Sound is synthesized with Web Audio after a user gesture.

The sailing lesson teaches collection, braking, a real mine lure, and harbor extraction. The campaign contains six voyages with three sectors each. Gather the displayed pearl quota, then follow the gold compass arrow to the harbor. Stay in its circle briefly to bank your cargo. Your hull is restored for the next sector.

Three hull points give you room to learn. Mine contact costs one point, breaks the chain, consumes the contacting mine, and briefly protects the boat. A third hit ends the voyage. Reefs stop the boat without damaging it. Hazard spawn warnings are harmless until they arm, and they wait if the boat is directly on top of them.

Complete voyages to unlock the next sea. Earn optional medals for finishing, finishing without damage, and performing at least three credited mine lures during the voyage. Medals are never required to progress.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Sail | Arrows or WASD | Drag the joystick |
| Brake | Hold Shift | Hold BRAKE |
| Surge | Space; six-second cooldown | SURGE |
| Echo buoy | E; nine-second cooldown | ECHO |
| Pause or resume | P or Escape | Pause button, then Keep sailing |
| Retry after results | R | Sail again |

Direct steering is the default. Classic steering is available in preferences: left/right rotate, up thrusts, down reverses. Touch always steers directly. Input is cleared on pause, focus loss, orientation changes, and transitions.

Surge is a short speed burst, not invulnerability. An echo buoy draws mines within its visible rings for 3.5 seconds. Deploy one and sail away to create a collision. Mines also chase the dhow normally. Drifters are round; faster, more deliberate hunters are diamond shaped and turn more slowly.

Currents carry boats and mines along their arrows. Whirlpools rotate and gently pull them inward. Coral islands are solid. Mine beacons brighten when they are alert or pursuing, and a warning circle identifies an incoming spawn.

## Pearls and scoring

Ivory pearls pay 100 base points. Rare moon pearls have a silver sparkle and pay 175. Gold salvage pearls pay 200. A collision between two mines pays 250 if a participating mine chased the player or their buoy within the previous eight seconds. Ambient mine collisions still clear hazards but pay nothing.

Each qualifying event uses the current multiplier, then advances the next multiplier up to 5×. Collect or perform a credited lure within four seconds to keep the chain. Damage or timeout breaks it. Every collected pearl advances the quota by one, regardless of value. Extraction pays 500 plus 150 for each remaining hull point.

Between sectors, choose one temporary nautical charm:

- Pearl compass attracts nearby pearls.
- Quiet sail shortens mine detection range.
- Salvager’s knot adds 50% to lure and salvage value.
- Tideglass halves current force on the dhow.

Charms last for the next sector only. Each selection offers three of the four charms. The daily challenge keeps the boat unchanged for consistent rules.

## Other modes and local progress

Endless waters continues through unlimited passages, adding hazards and increasing quotas up to capped budgets. Completing a passage restores the hull and offers a new charm.

Today’s tide generates a repeatable three-sector challenge from the local calendar date and generator version. Retry uses the same seed. Portrait and landscape layouts differ, and local clocks and records are editable; this is a personal challenge, not a global ranking system.

Voyage unlocks, medals, personal records, preferences, and campaign checkpoints stay in local storage. Each completed campaign sector creates a checkpoint at the next sector’s launch; choosing a charm updates that checkpoint. Home offers Resume your voyage after a reload. Mid-sector movement and hazards are not saved. A failed or completed voyage clears its checkpoint, and explicitly starting a fresh campaign replaces it.

Storage restrictions never prevent play; the header explains when progress cannot persist. Clearing browser data also clears records. Sound can be muted, volume adjusted, motion reduced, contrast increased, and touch controls forced on in preferences.

## Source and verification

| File | Responsibility |
| --- | --- |
| `src/data.js` | Voyages, charms, seeded randomness, and validated local saves |
| `src/engine.js` | Pure simulation, steering, physics, collision ordering, safe spawning, scoring, tutorial, and progression |
| `src/render.js` | Read-only Canvas renderer, cached seascape, procedural artwork, and bounded effects |
| `src/audio.js` | Gesture-gated synthesized sound with graceful fallback |
| `src/input.js` | Keyboard and Pointer Events action mapping and cleanup |
| `src/main.js` | Menus, HUD, settings, results, checkpoints, and fixed-step orchestration |
| `styles.css` | Responsive interface, portrait and landscape controls, focus, contrast, and reduced motion |

Run all checks with Node 18 or newer:

```sh
node --test tests/*.test.cjs
```

The suite exercises all eighteen campaign sectors in both orientations, finite environmental forces, terminal collisions, collision attribution and sweeps, pearl and mine budgets, controls, cooldowns, tutorial completion, campaign/endless progression, frame-rate determinism, save validation, checkpoints, and application screen transitions.

The runtime tests execute the shipped scripts against a DOM/Canvas harness without a browser. They check integration and finite drawing commands, but do not establish CSS layout, native browser input behavior, audio output, human game feel, or mobile performance. Canvas artwork was also rendered directly from the source in portrait and landscape using a local native Canvas runtime during development. No web interface was accessed.

Simulation runs at 60 fixed updates per second. Frame elapsed time is clamped, catch-up is limited to five steps, and hidden/unfocused play pauses explicitly. Rendering never consumes gameplay randomness or mutates engine state. Normal pearls, salvage drops, active hazards, and presentation effects have separate caps.

The arena orientation is selected at sector launch. Resizing letterboxes the existing world rather than moving gameplay entities. Pixel density is capped at 2. Standard voyages top out at eight active mines; endless caps at twelve. UI menus remain semantic HTML with visible keyboard focus; warnings have visual and sound cues. These measures do not provide a fully nonvisual action-game experience.

`IMPROVEMENT_PLAN.md` retains the original audit and design rationale. It describes design targets rather than guaranteeing exact human completion times or device frame rates.
