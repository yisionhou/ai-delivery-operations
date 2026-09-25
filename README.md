# AI Delivery Operations — Operations Hero Page V1

Interactive single-page operations demo built with React, React Three Fiber and Three.js.

## Latest scoped pass — gold-only support (2026-09-26)

The active levitation effect is now a larger, airy gold mist with subtle gold residual particles. The obsolete visible support-curve renderer has been removed; delivery routes, nodes and coastline micro-glow are unchanged. Existing light intensity is retained without another multiplier. Terrain, architecture and motion work remain paused. See [actual changes, checks and evidence limitations](./GOLD-CLOUD-VERIFICATION.md). Earlier descriptions of line-based support below are historical and are superseded by this gold-only pass.

## Run locally

```bash
pnpm install
pnpm dev
```

Open the local URL printed by the development server.
`localhost` is a local development preview, not a permanently hosted site. After restarting the computer or stopping the server, run `pnpm dev` again and keep that process running.

## Demo flow

1. Hover any of the five regions to see a small physical lift and a restrained contour.
2. Click it to enter Region Focus. The land, buildings, routes, vehicles, markers and labels rise as one 3D group, followed shortly by the camera. After 450 ms, the group physically moves forward to the center-left presentation zone. Background regions gradually recede in brightness and route lighting.
3. Inspect the matching operating summary and local routes.
4. Use **Back to Singapore** to translate the region back, lower it into the island, and return the camera to the national overview.
5. Click **Vehicle unavailable** to focus East and show the mock incident assessment. The existing incident/recovery scaffolding is preserved; this patch does not implement a new recovery engine.

### Controlled inspection

Drag to orbit and scroll/pinch to zoom in both overview and settled Region Focus. Rotation and distance are bounded; panning is disabled. The selected region remains the physical orbit pivot with a center-left composition. Controls lock while a region lifts, travels, returns or resets, and unlock only once both terrain and camera settle. Dragging does not select a region.

**Reset View** smoothly restores the approved camera for the current state, without leaving the selected region or dismissing its situation card. **Back to Singapore** is the separate action that exits focus. The +/− buttons also use bounded smooth zoom.

The default desktop composition is calibrated for the supplied `1536 × 1024` reference canvas. The screenshot is used only as a visual reference: the interface and central scene are rendered by the application, with no screenshot background and no SVG interaction mask.

## Visual and motion system

All five official regions use one reusable physical lift and camera system. Their land surfaces share a subtle, deterministic relief field. Sidewalls preserve the exact horizontal boundary instead of applying centroid-based insets; dark artistic strata retain the approved thickness. A narrow edge ribbon carries an ivory light core and soft analytical halo without altering the land geometry. The architectural kit includes curved three-tower Marina Bay Sands-inspired massing and skydeck, an observation wheel with spokes and capsules, articulated office crowns, residential courtyards, sawtooth industrial halls, logistics gantries, refinery tanks, Changi terminal wings and control tower, and curved Sentosa pavilions. Seven PBR finish families distinguish stone, concrete, metal and dark glass. Assets are merged by finish per region and expensive geometry is memoized.

Buildings and route markers sample local terrain elevation. Route curves are constrained to land before meshing; a coastline clearance also accounts for tube width. This is a stylized architectural maquette, not a photorealistic digital twin or literal DEM. Real straight reclaimed shorelines are intentionally preserved. On shorter desktop windows the situation card scrolls within the map, without clipping its content.

## Data

### Latest visual calibration and approved scale

The original global architecture transform is preserved exactly: X/Z `0.73`, Y `1.02`, multiplied by existing per-asset scales. No category-wide building reduction is applied. Future composition adjustments should stay local and approximately within ±5–10%. Quality work adds curved facade fins, podium arcades, residential terraces, industrial loading canopies, a ribbed Jewel-inspired dome and terminal roof articulation while retaining the city's established presence.

Terrain uses neutral black PBR material with an object-space mineral microtexture. Fine, filtered grains respond to viewing angle, never time-based blinking. Sparse localized density differences keep the map quiet; operational routes and incident markers remain the brightest elements. Coastline lighting uses exact water-facing source segments; internal shared region edges have no overview highlight. A selected region receives its own restrained physical edge finish and dark cutaway strata. No bloom post-processing is used.

Accepted selection changes release platinum micro-dust for 780 ms, overlapping the unchanged 450 ms extraction delay. A reusable 320-slot pool emits 144 grains per lift, with 2.3–3.2 s lifetimes, arc-length boundary sampling, DPR-corrected 1.0–1.4 CSS-pixel core targets and gentle independent world-space drift. Birth positions follow the actual top edge with outward/above clearance, including correct hole-ring orientation. Hover, orbit, Reset and return do not start a burst. Dust remains depth-tested and non-pickable.

For local visual debugging only, open `/?visualDebug=1`. The opt-in panel can isolate terrain, rim core/halo, shimmer and one diagnostic dust release. It is absent at the normal URL and in production. Use the normal URL and actual region selection for acceptance, not the boosted diagnostic preview. The edge halo is analytical in the existing material pass, not a second canvas or a whole-scene bloom compositor.

Physical highlights are broken into sparse patches plus deterministic point-glow clusters. Each lift also releases about 12 short ivory micro-filaments (0.36–0.72 scene units) alongside the dust. Both layers remain independently drifting in world space after birth; neither is a long ribbon attached to the moving block.

Geography is bundled locally and requires no API key or network access at runtime:

- [SLA National Map Polygon](https://data.gov.sg/datasets/d_29f066d67df3eae91df8a42f443863c8/view): coastal land features, excluding Johor/Malaysia; hydrographic polygons are subtracted as water holes. Unrelated internal polygons are not terrain slabs.
- [URA Master Plan 2025 Region Boundary (No Sea)](https://data.gov.sg/datasets/d_4ce0038f7ac689652350bb91b7fb92ed/view): five-region segmentation intersected with the SLA land mask.

The previous 3,815-point simplified dataset is replaced with 84,075 source/intersection vertices. No geographic smoothing, densification, coordinate rounding or simplification is applied. Processing uses a common local projection, removes microscopic source overlaps and checks coverage. `public/data/geography-provenance.json` records dataset IDs, counts and topology validation. Operational data, routes, vehicles, terrain relief and architecture are mock/stylized.

To reproduce geography (network needed only if source files are not cached):

```bash
node scripts/prepare-geography.mjs
node scripts/prepare-coastlines.ts
```

An optional argument selects a cache directory containing `sla-original.geojson` and `ura-original.geojson`. The generated review SVG in that directory supports visual inspection before rendering terrain.

## Verification

```bash
node node_modules/typescript/bin/tsc --noEmit
node scripts/check-geography.ts
node scripts/check-visuals.ts
node scripts/check-pointer-events.ts
node scripts/check-platinum.ts
pnpm build
```

The route check tests all 25 routes, including 151,806 rendered tube vertices, against the final region land polygons. Browser checks cover region picking, center-left staging, card switching and returning to overview. For layout regression, verify that the situation card bottom is inside the map bottom, including at 800 px window height.

The visual regression script asserts the approved global building scale and finite geometry for all five regional asset batches. Manual browser checks additionally cover overview/focus drag and zoom, automatic-motion locking, state-preserving Reset View, all five region cards, and the East incident entry point.

The pointer regression runs the installed R3F event manager: it reproduces the old exit-handler stack overflow with 12,000 accumulated hits, then verifies safe cleanup, stale-region ownership, same-region child crossings, repeated exits and drag/click guards. Exit handlers never call `stopPropagation()`; enter/click handlers retain it. Decorative physical edge finishes, place-name labels, shadows, dust and hub halos remain rendered but do not take part in picking. Terrain, buildings, route cores, vehicles and operational nodes retain region interaction.

The build currently reports a large client-chunk warning; Three.js dependencies may also emit clock/shadow deprecation warnings. These do not fail the build. For final visual checks after extensive shader hot replacement, use a fresh page reload.

## Main files

- `app/operations-console.tsx`: page composition and selected-region state.
- `app/singapore-scene.tsx`: shared scene, terrain, lift/translation/camera and route rendering.
- `app/maquette-architecture.ts`: region-specific articulated architecture and materials.
- `app/inspection-camera.tsx`: bounded manual orbit, smooth reset and motion handoff.
- `app/region-interaction.ts`: explicit enter/exit/click handlers and idempotent region-owned hover.
- `app/terrain-material.ts`: filtered, view-dependent neutral-black mineral shader.
- `app/terrain-edge.ts`: exact-boundary physical edge band and arc-length sampling.
- `app/lift-dust.tsx`, `app/dust-pool.ts`: world-space lift dust and bounded reusable buffers.
- `app/scene-telemetry.tsx`: DOM diagnostics for frame cadence and renderer memory.
- `scripts/check-platinum.ts`: geography hash, architecture envelope and dust regression checks.
- `app/filament-pool.ts`: short independent world-space light threads accompanying the dust.
- `scripts/check-filaments.ts`: bounded curve scale, graceful expiry and deterministic broken edge-cluster checks.
- `app/geographic-constraints.ts`: land, hole, segment and route corridor constraints.
- `app/delivery-routes.ts`: mock route definitions.
- `app/region-focus.css`: focused-region situation card.
- `scripts/prepare-geography.mjs`: reproducible authoritative-data preprocessing.
- `scripts/check-geography.ts`: rendered-route containment regression check.
- `scripts/prepare-coastlines.ts`: exact water-facing edges with shared seams excluded.

## Current levitation effect

`app/support-field.ts` supplies the localized support lifecycle and anchors; `app/lift-dust.tsx` renders the gold mist and independent residual dust. No trajectory-history rails are rendered. Add `?visualDebug` in development for the complete support VFX switch and 1x canvas recording/playback. Ordinary URLs and production builds hide these controls.
