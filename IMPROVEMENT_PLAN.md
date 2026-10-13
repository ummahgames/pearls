# Pearls game improvement plan

Implementation status: the redesign is implemented in `index.html`, `styles.css`, and `src/`. The baseline audit has been replaced with corrected-behavior and runtime tests in `tests/`; run `node --test tests/*.test.cjs`. This document preserves the original assessment and design targets. See `README.md` for shipped behavior, controls, and verification limits.

Pearls should become a compact arcade sailing game: pilot a dhow through pearl beds, lure pursuing sea mines into collisions, and bring a full cargo back to a harbor. Keep the pleasure of movement and the mine herding mechanic, then give each run a purpose, a readable difficulty curve, and a satisfying finish.

The recommended first release is one polished voyage with three sectors, desktop and touch controls, an interactive introduction, and local personal bests. Expand to six voyages and challenge modes after that vertical slice meets the playability gates below. Every feature runs in the browser using static HTML, CSS, JavaScript, local assets, and optional local storage.

## Current implementation and constraints

The baseline is commit `00f2327` in the Pearls repository. `index.html` contains all markup, styling, simulation, rendering, input, and tuning in 738 lines. The page currently identifies itself as Doubloon Disaster, despite rendering pearls and a dhow. It starts immediately, uses a 900 × 600 canvas, and ends on a single mine collision.

The current fixed simulation step, conditional mine pursuit, and procedural pearl and dhow drawings provide a useful foundation. Canvas 2D is sufficient for the redesign; a large engine or framework is unnecessary.

This assessment comes from source inspection and deterministic execution of the inline script with DOM and canvas stubs. It establishes logic behavior; human control feel, artwork quality, device performance, and visual layout still require evaluation during implementation. No browser interface was accessed.

The original source-only baseline probes reproduced ten defects. They have now been replaced with tests for corrected behavior. The findings below describe commit `00f2327`, rather than the redesigned engine.

## Source findings and fixes

Line references below refer to the unchanged baseline `index.html`.

| Priority | Finding and evidence | Required change |
| --- | --- | --- |
| P0 | Vortex and radial wave forces divide by entity distance without guarding zero, lines 289–343. Probes produce nonfinite boat and mine velocities at effect centers. | Use a shared force helper with an epsilon guard. A radial force at its exact center contributes zero; directional current still applies. Assert finite entity state in development. |
| P0 | A boat collision sets `running = false` at line 219, but the rest of the tick continues. The fatal collision probe also collects a pearl, adds 2 points, and spawns a mine. | Establish explicit event ordering, resolve damage once, and stop all further rewards and spawning when a terminal result is committed. |
| P0 | The accumulator at lines 718–725 consumes every elapsed step. A simulated 60-second gap executes 3,600 steps in one frame. | Pause when hidden or unfocused, clear input, reset the frame clock on resume, clamp elapsed time, and cap catch-up work. |
| P1 | Initialization creates no pearls, line 115; the regular interval is eight seconds, line 69. A probe confirms an eight-second opening wait when mines cannot collide. | Start with visible pearls, including one safe nearby teaching target; refill promptly when a bed is depleted. |
| P1 | The combo lasts 2.2 seconds, line 72, while normal supply arrives every eight seconds. | Design pearl clusters and combo timing together. Provide a visible combo meter and predictable opportunities to extend it. |
| P1 | Explosion drops bypass `coinMaxCount`, lines 235–236; two existing pearls become three in a probe. | Give normal pearls and salvage drops explicit budgets and enforce both through a single spawning API. |
| P1 | Mine placement checks only distance from the boat, lines 122–129, and accepts the final candidate after 50 failures. A forced exhausted search places a mine at the boat. Pearl placement also ignores mines. | Validate the boat, other entities, solid geometry, and reachable space. Defer a spawn when no safe position exists. |
| P1 | The boat's collision circle has radius 14; the drawn prow extends about 33.5 pixels and stern about 35.3 pixels from its center, lines 632–660. Mine spikes also extend past their collision circles. | Align recognizable solid shapes with collision geometry. Use a forgiving oriented hull capsule and matching mine bodies; distinguish harmless decorative effects. |
| P1 | Input has no blur, visibility, touch, or pause handling, lines 90–98. The Space handler ignores repeat. Probes show repeated restart and retained thrust after restart. | Centralize input, ignore repeated action keys, clear held state on transitions, and route controls only while the game has focus. |
| P1 | HUD text updates only in `physicsStep`, lines 354–362. Restart resets state without immediately resetting the display; a probe leaves 42 displayed over an actual score of 0. | Render UI from the current state on every transition; cache elements and update changed values. |
| P1 | The canvas has fixed intrinsic dimensions with no responsive size rule, lines 10 and 28. | Separate logical world coordinates from CSS size and backing resolution; add responsive layout and device pixel ratio handling. |
| P2 | Wind drawing calls `Math.random()` eight times per frame, lines 583–602. Simulation uses the same random source. | Keep rendering free of gameplay mutations and randomness. Separate seeded gameplay generation from stable cosmetic variation. |
| P2 | Mine speed is capped at 4.8 while seeking and immediately capped at 0.9 outside the aggression radius, lines 194–208. | Add explicit patrol, alert, chase, and cooldown states with hysteresis and gradual speed changes. |
| P2 | Boat position is clamped against walls without removing outward velocity, lines 184–186. | Remove the wall-normal velocity and preserve tangential movement; show a soft edge ripple. |
| P2 | Colored pearls are derived from position only in drawing, lines 375–392. Their collection values are identical. | Store pearl type and value in entity data. Match rarity, score, shape cues, and collection feedback. |
| P2 | Mines can destroy each other without player involvement and still grant points, lines 222–238. | Track recent player engagement for skill rewards; ambient collisions can clear hazards without awarding a combo or salvage. |
| P2 | There are no objectives, levels, win state, audio, saved bests, or contextual introduction. | Build the voyage loop and onboarding before adding a large content library. |

P0 issues threaten simulation integrity. P1 issues affect basic fairness and usability. P2 work gives the game depth and identity once those foundations are reliable.

## Core game loop

1. Choose a voyage and see its pearl quota, hazard preview, and optional mastery objective.
2. Launch into a sector with three visible pearl targets and a protected starting pocket.
3. Collect clusters, attract mines, and turn their momentum into collisions. Keep several escape routes open.
4. Fill the sector's pearl quota. A clearly marked harbor beacon activates at a validated location.
5. Enter the beacon to bank the cargo and complete the sector. Celebrate the result, then offer the next sector.
6. Complete three sectors to finish a voyage and record the score, medals, time, and best combo locally.

Target ordinary voyages at roughly three to five minutes, with individual sectors around 45–90 seconds. These are design targets to validate, not promises from the existing implementation. Keep quota progress separate from score so multiplying points never silently skips a level.

Start standard play with three hull points. A collision costs one point, breaks the combo, applies a short separation impulse, and grants about 1.2 seconds of clearly visible invulnerability. A fatal collision ends the voyage. Reset hull at sector entry for the first release, which makes each encounter independently tunable. A later one-hit challenge can preserve the original game's unforgiving tension.

Extraction follows quota completion rather than an unavoidable timer. A tide meter communicates increasing pressure and reaches a capped intensity. Waiting does not generate completion credit or score. Avoid enemies camping the harbor: create a small temporary safe approach when it activates, and exclude new spawns from it.

## Movement and input

Make direct steering the default: arrows or WASD specify a movement direction, acceleration builds toward that intent, and the dhow turns smoothly to match its motion. Preserve a small amount of drift so a successful lure feels like sailing. With no intent, velocity decays quickly enough to make tight collections comfortable. Normalize diagonals.

Keep classic rotate and thrust controls as an optional setting after the default scheme works well. The HUD and introduction must always describe the selected scheme. Both schemes feed the same action model; neither renderer nor simulation reads raw keyboard events.

Initial tuning candidates in the 900 × 600 logical arena:

| Property | Starting candidate | Reason and validation |
| --- | --- | --- |
| Cruise speed | 260–300 world units per second | Cross the arena in a few seconds without making pearls difficult to intercept. |
| Time to useful speed | 0.25–0.4 seconds | Make direction changes responsive while retaining momentum. |
| Release stopping time | 0.35–0.55 seconds | Avoid the current long coast making precise collection tedious. |
| Brake | Hold Shift or a touch button | Reduce drift sharply and create a useful skill move without another resource. |
| Collection radius | Hull contact plus a small visible attraction margin | Forgive small misses; avoid collecting pearls from visibly distant positions. |
| Optional burst | About 0.35 seconds, six-second cooldown | Prototype only after basic steering; use swept collision and retain vulnerability. |

Do not ship the burst simply because it is available to implement. Keep it only if it improves escape and herding without becoming mandatory for ordinary encounters.

Use Pointer Events and pointer capture for a floating touch joystick, with a separate brake button and an optional burst button. Handle `pointercancel`, release outside the control, multitouch, and orientation changes. Prevent page gestures only on the play surface. Keep keyboard navigation and normal page scrolling outside it.

Use Escape or P to pause. Enter starts or confirms; R retries from results. Restart during active play belongs in the pause menu, reducing accidental run loss. On focus loss or tab hiding, clear input and pause automatically; require an explicit resume.

## Fair hazards and meaningful choices

Mine herding is the main skill. Build other mechanics around it before adding weapons, shops, or many unrelated enemy types.

Start with two mine behaviors. A drifter patrols slowly, detects the boat, shows an alert, and then accelerates toward it. A chaser has a narrower steering capability, allowing a skilled player to bait it past the dhow. Later add a tethered mine whose limited range changes the safe route. Distinguish each with silhouette, motion, and beacon pattern as well as color.

Use explicit detection and release ranges, such as alert within 170 units and release beyond 220. A short alert animation gives the player information. Limit turning and acceleration so hazards retain momentum, making collision setups intentional. Chasers should ordinarily remain slower than the boat; difficulty comes from positioning, quantity, and currents.

Every spawn gets a roughly 0.9-second buoy or ripple warning before it can collide. Validate clearance against the current boat and its short predicted movement path, nearby hazards, geometry, and harbor approach. Avoid enclosing the player or filling the only navigable corridor. If validation fails, delay rather than relaxing safety guarantees.

A threat director manages a small active budget per sector. Collections request additional threats, but the director meters those requests and respects spacing. After mine collisions, replenish gradually if the encounter needs pressure; never replace a cleared pair instantly. Cap accumulated spawn requests to prevent a burst when space becomes available.

Credit a mine collision when at least one participating mine recently chased the boat, initially within eight seconds. A credited collision grants score and a salvage pearl. An incidental collision still clears mines but awards neither. Consume each mine's reward only once. Track credit explicitly so a random collision does not masquerade as a player achievement.

Replace the current four similar environmental effects with two readable hazards for the first slice:

- **Current lane:** animated arrows show a constant directional push. A visible boundary and entry cue communicate its influence on both boat and mines.
- **Whirlpool:** curved foam shows circulation and a mild inward pull. Introduce it with a warning, avoid direct spawning under the boat, and keep its center mathematically safe.

Use currents as tactical tools, not sudden loss of control. Prototype stronger wave pulses only in later voyages, with an outward ring that accurately marks collision or force timing. Preserve at least one safe passage through every authored layout.

## Pearls and scoring

Place pearls in small readable beds and routes rather than isolated random dots. Start sectors with three targets and refill to a minimum available supply within about 1.5–2 seconds of depletion. The first target should be reachable in about one second from launch. Validate access before placing a bed and avoid pearls inside mines or solid reefs.

Store each pearl's type, score value, quota units, spawn source, and cosmetic variation in state. For the first release, use ordinary ivory pearls and gold salvage pearls; add rose, lavender, and dark pearls only when their role is clear. Dark pearls need a light outer cue so rarity does not make them invisible.

Proposed starting score rules:

| Event | Base score | Quota credit | Combo behavior |
| --- | --- | --- | --- |
| Ordinary pearl | 100 | 1 | First collection uses 1×; later qualifying collections advance the chain. |
| Credited mine collision | 250 | 0 | Extends the active chain and advances it once. |
| Salvage pearl | 200 | 1 | Collectible reward, budgeted separately from normal beds. |
| Sector extraction | Fixed completion bonus plus capped intact-hull bonus | Completes sector | Display the calculation in results. |

Start with a four-second combo window and a 5× cap. Apply the current multiplier to an event, then increment for the next event; the first pearl should not inexplicably pay 2×. Decay the combo on timeout and break it on damage. Put a draining meter next to the multiplier and show a brief explanation during the introduction.

Limit normal pearls to about six and salvage drops to four. Keep both caps explicit. Guaranteed progress must come from normal pearl beds, so a player who cannot yet herd mines can still finish. Score breakdowns should explain the value of skilled play without making novices memorize a formula.

## Level progression

Author six voyages, each with three sectors. Introduce one new concept at a time. The table gives starting content and budgets to tune against measured completion and damage; it is not a validated balance specification.

| Voyage | Setting and teaching goal | Sector pearl quotas | Active mine budgets by sector | New feature |
| --- | --- | --- | --- | --- |
| 1 | Sheltered lagoon; collect, turn, and lure | 6, 8, 10 | 2, 3, 4 | Drifters; protected introduction. |
| 2 | Pearl beds; keep a chain across short routes | 8, 10, 12 | 3, 4, 5 | Cluster placement and salvage. |
| 3 | Current crossing; use moving water to redirect threats | 10, 12, 14 | 4, 5, 6 | Current lanes. |
| 4 | Reef passages; choose between safe and rich routes | 10, 12, 14 | 4, 5, 6 | Sparse solid reef geometry. |
| 5 | Deep water; bait faster threats into mistakes | 12, 14, 16 | 5, 6, 7 | Chasers and a mild whirlpool. |
| 6 | Homeward passage; combine the established skills | 12, 16, 18 | 5, 7, 8 | Authored mixed encounters and a final harbor approach. |

Reefs need their own collision shapes and route validation; delay them until the open-water encounters are fun. Scenery that is decorative must read differently from solid reef. Do not make the final voyage harder merely by increasing every speed.

Unlock the next voyage on completion. Medals recognize optional mastery: finish intact, perform a specified number of credited lures, or reach a combo target. Completion is the only gate. Save unlocked voyages, medals, settings, and personal bests locally using a versioned schema.

Add endless mode after voyage pacing works: increasing but capped threat budgets, regular bed replenishment, and personal score records. A seeded daily challenge can use the user's local calendar date and a generator version, with a displayed seed and repeatable local runs. Client clocks and editable local saves cannot support trusted global rankings; keep records personal and avoid account or server dependencies.

## Art direction and presentation

Build a coherent illustrated Gulf seascape around the existing dhow. The boat and pearling theme should carry the identity of Pearls. Use warm carved wood, ivory highlights, teal shallows, deeper indigo water, muted sand, and coral warning accents. Keep decorative coastline patterns restrained and avoid unverified historical claims in game copy.

Give gameplay objects stronger hierarchy than scenery. Pearl beds get a soft halo and occasional sparkle; the dhow gets a clear prow, small sail detail, and a wake that indicates speed. Mines get broad recognizable bodies with visible state changes. Limit fine rivets and tiny details that disappear on phones. Warning shapes, light, and motion should carry hazard information at small sizes.

Render layers in this order: cached seabed and coastline; currents and hazard boundaries; water surface detail; pearl and entity shadows; pearls and mines; dhow and wake; explosions and collection effects. Keep the HUD and menus in HTML so they remain legible, responsive, and keyboard accessible.

Produce a small art kit before expanding the world: dhow idle and turning shapes, drifter and chaser silhouettes, two pearl types, harbor beacon, water tile or procedural pattern, reef shapes, and a short particle vocabulary. Local SVG, Canvas paths, and cached raster sprites all fit the architecture. Use one style and light direction throughout.

Collection feedback should include a small ring, a short rising score label, and a gentle sound. Mine collisions get a compact burst, fragments, and a ring matching the actual event. Damage gets a brief hull flash and optional small camera impulse. Reserve larger celebration for extraction; avoid covering hazards with effects during active play.

Prefer subtle water motion over a constantly busy scene. Store cosmetic seeds on entities or derive them from IDs; never generate fresh random positions every draw. Respect reduced motion by suppressing shake, rapid beacon flashes, and excess particles. Hazard warnings must remain visible when effects are reduced.

## Interface and onboarding

Rename the page and browser title to Pearls. Build a launch screen with Play, voyage selection, and settings. Explain the premise in one sentence: collect pearls, lure mines together, and return to harbor.

The play HUD should show hull, sector quota, score, combo meter, and the active sector. A tide indicator appears only when its meaning has been taught. Mine count can stay in a development overlay; it is less useful to players than objective progress and threat cues. Hide instruction paragraphs after the player knows the controls.

Use an optional 20–30-second interactive introduction: steer to a nearby pearl, brake in a marked circle, then lure two slow mines together with an illustrated curved path. Progress each instruction by the actual action, and let the player skip or replay it. Keep the safety rules for this sequence explicit in level data, not scattered special cases in the engine.

Pause offers Resume, Controls, Settings, and Retry. Results explain cargo, score, best combo, credited lures, damage taken, and any medal earned. Put Retry and Next on obvious focusable buttons. Preserve settings between runs and show a brief local-save indicator only when useful.

Fit the logical arena inside available space without distortion. Start with a 3:2 logical world on desktop. On narrow portrait displays, use a portrait-friendly authored arena based on the same normalized layout data, selected at launch. Freeze world dimensions during a sector and letterbox through orientation changes; do not silently relocate entities mid-run. Test that touch controls do not conceal critical escape routes.

Use a backing resolution scaled by device pixel ratio, initially capped at 2, and map pointer coordinates through the canvas bounding rectangle. Account for safe-area insets and dynamic viewport height. Offer strong focus indicators, adequate touch targets of at least 44 CSS pixels, and a high-contrast option. Announce menu and result changes through a restrained live region; do not stream score updates into a screen reader every tick. Full nonvisual action gameplay would require additional design beyond these UI accessibility measures.

## Sound

Create a small local sound set or synthesize it with Web Audio: ordinary pearl chime, distinct salvage chime, mine alert, mine collision, hull damage, and extraction cadence. Add a very quiet sea ambience only if it improves focus. Limit simultaneous alerts and scale sound by event importance.

Initialize or resume audio after a user gesture, honor browser suspension, and pause audio with the game. Provide separate effects and ambience levels, a persistent mute button, and visual equivalents for every warning. A failed audio initialization must not stop play.

## Client architecture

Keep deployment as a static folder with no runtime server, remote API, CDN, account, or external asset dependency. A local development server may serve the files during development; hosting in production only serves static content. Runtime networking is unnecessary for core gameplay.

Proposed files and responsibilities:

```text
index.html                 Semantic menus, canvas, and HUD
styles.css                 Responsive layout, focus, touch controls, themes
src/main.js                Boot and state transitions
src/game.js                State creation and deterministic update pipeline
src/input.js               Keyboard and pointer action mapping
src/physics.js             Steering, forces, collision, world bounds
src/director.js            Spawn requests, safety checks, threat budgets
src/levels.js              Voyage and sector configuration
src/scoring.js             Combo, quota, attribution, result calculation
src/render.js              Read-only Canvas rendering and effects
src/audio.js               Gesture-gated sound and volume
src/storage.js             Versioned saves and graceful fallback
src/random.js              Seeded gameplay generator
assets/                    Locally stored visual and audio assets
tests/                     Pure simulation and transition tests
scripts/audit-prototype.mjs Baseline probes to retire after the refactor
```

Use native JavaScript modules for static HTTP hosting and avoid introducing a bundler until there is a concrete need. If opening `index.html` directly via `file://` is a required distribution path, produce a small bundled classic-script build from the same sources because module loading may be restricted there. Decide the distribution contract before restructuring imports.

State transitions should be explicit: menu → introduction or playing → sector result → playing or voyage result. Paused remembers the prior active state. A fatal hit commits a game-over result once. Results and the renderer must not mutate simulation state.

Keep a 60 Hz simulation with movement expressed in units per second and timers in seconds. The update order is: sample actions; apply steering and environmental forces; integrate with boundary handling; resolve mine collisions; resolve boat damage; stop if terminal; collect pearls; update quota and combo; advance director and timers; emit presentation events. Decide simultaneous collisions consistently: a mine removed in a resolved lure cannot also damage the boat that tick. Resolve ambiguous pairs by stable IDs and a documented ordering, not array splice side effects.

Use swept collision for fast movement and any burst, and perform a final overlap pass after impulses. Cap a frame's elapsed time at roughly 100 ms and catch-up at five fixed steps; drop remaining backlog deliberately. Freeze the simulation while hidden, clear the accumulator on resume, and render immediately on transitions. Separate cosmetic time from simulation time so pauses and seeds behave consistently.

Inject the gameplay random generator and persist a generator version with challenge records. Give entities stable IDs. Drawing must consume no gameplay randomness. Keep gameplay events separate from their audio and particle effects so headless tests can inspect rewards and damage.

Use `localStorage` with validation, defaults, schema versioning, and guarded reads and writes. If blocked or full, continue with in-memory progress and disclose that progress cannot be retained. Defer export, import, and save migration UI until there is more than one save version.

## Implementation sequence and completion gates

Each phase should leave a playable build. The scope descriptions are implementation batches, not delivery date estimates.

| Phase | Code and content work | Completion gate |
| --- | --- | --- |
| 1 | Extract state and simulation; fix nonfinite forces, terminal ordering, reset, input clearing, and bounded clock handling. Add pure simulation tests. | Force-center, restart, hidden-tab, and terminal-event tests pass. The baseline game still boots and runs as static content. |
| 2 | Implement direct steering, brake, aligned hull collisions, touch actions, focus handling, and responsive resolution. | Deterministic keyboard and pointer action inputs produce equivalent motion; diagonal speed is normalized; edge cases cause no stuck controls. Human steering evaluation is required before final tuning. |
| 3 | Build one voyage with three sectors, immediate pearl beds, safe spawn warnings, two mine states, quotas, extraction, damage recovery, and revised score rules. | A beginner can finish without credited lures; a skilled player can improve score through herding. No forced waiting for the first objective. |
| 4 | Create the visual kit, readable HUD, introduction, results, sound, reduced motion, and local saves. | Warnings match force and collision areas; the game remains understandable muted; storage failure is harmless. Review mobile legibility and control obstruction. |
| 5 | Add five more voyages, currents, reefs, chasers, and mastery medals in the teaching order. | Every authored layout has a safe start, reachable beds, and reachable extraction. Repeated seed runs show no impossible placements. |
| 6 | Add endless and daily modes; polish performance, deployment documentation, and release checks. | Complete runs work with local assets alone; results remain comparable for a given mode and generator version; release budgets are met on agreed reference devices. |

The first meaningful milestone ends at Phase 4. Avoid spending time on six voyages, cosmetic collections, or extra enemy types before the three-sector slice earns its place.

## Verification and tuning

Automated checks should operate on pure simulation state wherever possible:

- Exact-center environmental forces keep every entity finite, including after thousands of ticks.
- A terminal damage event commits once; later rewards and spawns cannot alter the result.
- Spawns never violate clearance, overlap solid terrain, or exceed configured budgets; exhausted searches defer.
- Mine collision pairs cannot reward an entity twice. Ambient collisions receive no player credit.
- Capsule contacts and swept paths correctly cover prow, stern, lateral contact, and fast crossings.
- Restart and pause reset input, clock, accumulator, combo display, and audio events appropriately.
- First collection pays the documented base score. Combo expiry, damage, quota units, and extraction bonuses match the scoring contract.
- Equivalent action sequences and seeds produce identical simulation results at 30, 60, and 120 rendered frames per second when no frame backlog is deliberately dropped. Rendering never changes the gameplay RNG sequence.
- Every authored level has reachable pearl and harbor regions; portrait variants retain enough escape space.
- Malformed or unavailable saves restore safe defaults without affecting play.

Use scenario probes for dense encounters, invulnerability transitions, simultaneous pair collisions, and damage at extraction. Run long seeded simulations across many seeds to catch finite-state and budget violations; synthetic agents cannot establish that a level is fun or humanly fair.

Keep a development overlay for collision shapes, spawn exclusion regions, state labels, simulation frame cost, director pressure, and a local event trace. Disable it by default. Record per-run metrics locally during tuning: time to first collection, collection gaps, first damage, cause of failure, sector completion time, credited lures, and best chain. No analytics service is needed.

Initial playtest hypotheses: novices should collect quickly, understand the objective after the introduction, and complete the first sector within roughly 90 seconds. Repeated failures at the same spawn or current indicate a fairness problem. Successful players should demonstrably earn more through lures and chains, rather than merely waiting for random collisions. Treat observed behavior as the deciding evidence when adjusting candidate values.

Manual device and game-feel evaluation remains a release requirement, respecting the current request to work from code without accessing the web interface. During this planning pass, no visual, auditory, or human playtest is claimed.

## Performance and release scope

Aim for smooth 60 fps on an agreed midrange phone, with simulation and drawing together comfortably below 16.7 ms at the intended maximum encounter size. Measure before promising the target. Cap active mines near 12 for standard content, bound particles and floating labels, and cache the static sea layer and repetitive sprites. At these counts, simple pair checks are reasonable; add a spatial grid only if profiling supports it.

Target a compact initial payload, approximately 2 MB or less excluding optional ambience, and load later voyage decoration only when needed. Provide a low-effects setting while preserving all mechanical cues. Test high pixel density, narrow portrait, landscape touch, focus loss, storage restrictions, audio suspension, and prolonged sessions.

A later optional service worker can cache the completed static build for return visits. Version its cache and avoid trapping players on an obsolete build. It is a browser feature with static hosting requirements, not a prerequisite for the first release.

Defer multiplayer, global leaderboards, accounts, server saves, procedural oceans, large upgrade trees, and boss encounters. Cosmetic dhow colors and optional hull sidegrades can come later; permanent speed or health upgrades would obscure whether difficulty and personal records reflect player skill.

The implementation priority is simulation integrity, then enjoyable movement and fair encounters, then the complete voyage loop, then art and content expansion. A coherent three-sector game is the right foundation for a larger Pearls.
