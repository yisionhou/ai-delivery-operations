# Curved coast — CURRENT revision

## Secondary local splash accent

The current C-mode preview includes an optional **Local spray: On/Off** control (default On). A and B do not emit spray. This addition does not change the curved coast, sea intensity, exposure, open-water reflections, wave amplitudes, production map or production controls.

- Select at most ten spatially separated sites from intersections of the actual apron triangles with y=-0.085. Filter against the water's same coast-distance, land and bathymetry texture. No administrative-edge emitters.
- Water and contact scheduling share the same wave components and run-up phase/amplitude definitions in `shore-wash.ts`. Emit only when rising water crosses the slope and the local incoming wash is positive/rising—not simply on a timer.
- One short packet at a time: six fine droplets and two very faint spray motes, at most eight live points. Individual lifetime 0.40–0.78 seconds; rise under 0.06 scene units. Global gap 2.2–3.8 seconds, per-site cooldown 8–14 seconds. No rings, line renderers, foam strip or particle explosion.
- Muted grey highlights with ordinary alpha blending (not additive), depth testing, no depth writes, no bloom. Spray does not respond to picking. Mode changes, switch-off, lifted terrain and Reset clear it; long/background frames do not produce catch-up bursts.

Actual checks for this splash addition: TypeScript, scoped ESLint, isolated production build, curved-coast regression and the 12,000-exit pointer regression passed. `node scripts/check-shore-splash.mjs` passed a 180-second deterministic CPU simulation: 44 packets across ten sites, bounded lifetime/height/spacing, rising contact, lift/off/mode suppression, reset, pause handling and fixed eight-point allocation. The DOM-free test uses the real apron with a test distance texture; it is **not GPU render evidence**.

Visual verification is still pending. No browser-control connector was available. Two separate test profiles were tried using installed Chrome and Edge; both timed out at the `Runtime.enable` debug connection, before page evaluation. No current screenshot, recording or browser-console clearance was obtained. The preview HTTP endpoint returned 200. Do not infer application failure or visual acceptance from these tooling timeouts. The reproducible isolated test is `node scripts/capture-shore-splash.mjs`; optional `SPLASH_QA_BROWSER` selects an installed browser executable. Intended output is `evidence/shore-splash/`, not the old coastline recordings.

Pending visual check: compare C with Local spray on/off at the SAME shore camera for 30–60 seconds at 1×. A packet should be a barely secondary flick of water at one contact, not a white shoreline band. Check actual terrain occlusion and reduce particle opacity/size if it competes with the island. Do not increase water brightness to make spray visible.

## Status: implemented; visual acceptance pending

This revision follows attachment `03120440-0e0b-47a9-bf39-215295f9fa55` and supersedes the terraced shore described in the historical report below. It is still **isolated from production**.

- Retains the 0.72-unit island body. A 24-segment C2-continuous skin now starts at the land surface (y≈0.52), curves through the waterline, and ends on a submerged shelf (y≈-0.42). No intermediate ledges. Indexed vertices share smooth normals. Small-island/channel width limits remain.
- Bakes the actual curved mesh height into a 1024² water-depth texture. Nearshore water absorption, shallow-wave damping and graphite shelf shading use that same geometry, connecting shallow/coastal/deep-water zones rather than adding a separate luminous ring.
- Mode C adds local phase-shifted run-up events (maximum .044 units before baseline offset) and retreat, without foam or emission. Open-water reflection strength, lighting and exposure were not globally increased.
- Water grid is now 384×304 (233,472 triangles); curved coast has 5,205 marine segments / 249,840 triangles. This is heavier than the old version; the historical fps numbers below do NOT apply.
- Profile is an authored miniature shape, not surveyed bathymetry. Real plan-view data, production buildings, terrain, mist, motion and pointer handling remain unchanged. Original internal model wall is covered, not removed; complex corners still need visual inspection for gaps/intersections.

### Checks actually performed for this revision

PASS: coastal geometry/depth regression (finite values, continuous monotonic profile, endpoint tangents, submerged depth, source immutability, deterministic geometry and original-coast filtering); TypeScript; scoped ESLint; standalone production build. The large-bundle warning remains (~1.18 MB including Three.js).

PASS: existing pointer regression (12,000 safe exits), support lifecycle and landform/foundation regressions; 1,217,988 architectural XZ vertices unchanged in the latter check.

**BLOCKED: current rendered screenshots, GPU console, normal-speed playback and frame timing.** Browser inventory returned no available browsers; selecting or creating the in-app preview tab also failed. These are tooling failures, not evidence of an application crash. The local preview server was restarted on http://127.0.0.1:5184/.

Do NOT treat the historical recordings below as this revision's verification. New captures from the optional evidence helper now go to `evidence/sea-preview-curved/`. Existing files in `evidence/sea-preview/` remain historical, showing the superseded stepped coast.

### Required next visual acceptance

Inspect overview and close-up for a continuous coast entering shallow water, no ledges/seams/spikes or channel overlaps. Play C at 1× for at least ten seconds: contact must move up/down the slope locally and asynchronously, without a bright full-coast ring. Check three depth zones, fixed sea during mock lift, return, drag/zoom/Reset, GPU console and performance. Capture new matching screenshots and video before declaring island/sea integration accepted.

---

# Historical report — obsolete terraced-coast version

The specifications, screenshots, playback and performance claims below describe the PREVIOUS revision only, not the current curved-coast code.

This is a separate, review-only preview. It is **not integrated into the production Operations map**. Production land, buildings, mist, routes, controls and pointer handling are not imported or rewritten by this preview.

## Run

From the project root, using the existing dependencies:

```sh
node node_modules/vite/bin/vite.js --config preview/sea/vite.config.ts
```

Open http://127.0.0.1:5184/. For optional local PNG/WebM capture, in a second terminal:

```sh
node scripts/sea-evidence-server.mjs
```

The capture helper listens on loopback port 5182 and writes only A/B/C overview/shore/wide PNG/WebM files under `evidence/sea-preview`. Without it, the page offers browser downloads. No upload to an external service is used.

## Latest spatial correction

- Keep the original preview model body: 0.72 scene-unit thickness, top y=0.52, bottom y=-0.20. The sea stays at y=-0.10.
- Add a real, dark marine-facing apron instead of only changing reflections: a narrow shoulder, a beveled drop through the waterline, then a submerged foot ending at y=-0.31.
- Most shore uses an engineered profile: `(outward distance, height)` = `(0, .13), (.070, .10), (.145, -.12), (.31, -.31)`.
- A limited southern/eastern island zone blends to a gentler profile: `(0, .20), (.10, .10), (.27, -.11), (.43, -.31)`.
- Width varies modestly and is capped for small islands and narrow channels. Dark rough vertex-colored material keeps the shelf from reading as a bright outline. No foam, emissive coast stripe, beach simulation or flood effect.
- Coast segments are taken from the existing real Singapore coast data. Crop boundaries, interior segments and ambiguous segments are excluded. Internal holes are reserved for a future inland-water pass.
- The engineered/natural classification and cross-sections are authored miniature design choices, **not surveyed Singapore bathymetry or measured seawall profiles**.

## Water comparison

| Mode | Difference |
| --- | --- |
| A | Animated analytic micro-normal/reflection; no vertex waves |
| B | A plus four low-amplitude geometric wave components |
| C | B plus localized, asynchronous nearshore height variation |

All modes share camera, exposure, lighting, apron, sea level and fade. No second brightness increase was made for the coastal correction. The water intersects the sloping apron via ordinary depth testing. C adds at most .018 scene units of localized shore displacement; it is a restrained visual approximation, not a fluid simulation. It switches off as the mock land lifts away. The water and outer fade stay in world coordinates.

The default camera matches the production camera's relative angle/distance and FOV: offset `[2,27.5,19.6]`, FOV 30°, ACES exposure 1.2. This is a **representative southwest cutout**, not the entire production dashboard; buildings and production relief are intentionally absent. Shore and wide views keep the angle while changing inspection distance.

## Implementation / cost

- Existing Three.js Water planar reflection, 512×512 target; custom analytic height/normal shader. No FFT, SSR or post-processing bloom.
- Water: 192×152 subdivisions / 58,368 triangles. Added apron: 28,140 triangles / 4,690 marine segments.
- Shore-distance mask: 512². Reflection is planar, appropriate only for low-amplitude waves.
- Preview canvas DPR capped at 1.45; `preserveDrawingBuffer` is enabled for evidence capture. Recorded 30 fps WebM is real-time, not time-lapse.
- Preview on the test machine generally reported about 60 fps with p95 around 17 ms when settled. This is a small scene, **not a full production-map performance guarantee**. On-screen renderer counters describe a render pass, not the total reflected + main workload.

## Checks and evidence

```sh
node scripts/test-coastal-transition.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js preview/sea scripts/sea-evidence-server.mjs scripts/test-coastal-transition.mjs
node node_modules/vite/bin/vite.js build --config preview/sea/vite.config.ts
```

These checks passed after the final coastal mesh adjustment. The geometry test checks finite vertices/normals, submerged foot height, original-marine-segment membership, immutable source data, deterministic output and rejection of interior/off-land edges. Independent build output is in `evidence/sea-preview-build`; its large Three.js bundle warning remains. The separate production build also passed earlier in this pass; it does not include this preview.

Final matched-camera evidence is in `evidence/sea-preview`: A/B/C overview PNGs and roughly ten-second WebM recordings; C shore close-up and C wide-fade PNGs. Browser recordings must be reviewed at 1× using the page's playback control or a normal video player. The isolated preview remains subject to user visual approval; build success is not visual acceptance.

Completed browser checks after the final geometry update:

- A, B, C overview recordings played at rate 1 through their ends (9.902 s, 9.903 s, 9.910 s). C shoreline close-up also recorded and played at rate 1 to 9.869 s. Playback frames were visually inspected; no whole-island foam was added.
- Mock lift reached 1.30 while water remained at -0.10, then returned to effectively zero. The fixed footprint did not become an ocean-filled cavity.
- Drag changed the actual camera, scroll changed distance, and Reset restored `[2.7,27.5,19.6]` at exposure 1.2.
- Final console inspection found no new errors after the earlier development shader fix. A Three.Clock deprecation warning remains in the installed rendering stack. Earlier development-server/hook failures and the corrected reserved shader keyword were not counted as final runtime failures.
- Existing pointer regression (12,000 exits), support lifecycle, and landform/building-foundation checks passed again. These automated checks are not a full production visual playback test.

All final PNGs use the same 1536×1024 browser viewport (canvas 1536×754); A/B/C overview share the exact camera. Close-up and wide files deliberately use their labelled inspection distances. The temporary browser viewport override was removed after capture.

Evidence links (relative to this document):

- [A screenshot](../../evidence/sea-preview/A-overview.png) · [A video](../../evidence/sea-preview/A-overview.webm)
- [B screenshot](../../evidence/sea-preview/B-overview.png) · [B video](../../evidence/sea-preview/B-overview.webm)
- [C screenshot](../../evidence/sea-preview/C-overview.png) · [C video](../../evidence/sea-preview/C-overview.webm)
- [Shore detail](../../evidence/sea-preview/C-shore.png) · [Shore playback](../../evidence/sea-preview/C-shore.webm) · [Outer fade](../../evidence/sea-preview/C-wide.png)

Recommendation: use C as the next review candidate because the shoreline interaction now has actual sloping geometry to contact. Keep the amplitude restrained. Do not integrate into production until the dark coastal shoulder and partial natural transition are approved.
