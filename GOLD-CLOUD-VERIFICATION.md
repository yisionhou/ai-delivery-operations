# Gold cloud + lighting completion check — 2026-09-26

## Scope and implementation

Continued the existing working tree; no rollback, terrain work or architectural changes.

- Removed the obsolete `levitation-support-currents` mesh, its line shader/material, vertex buffers and CPU line updates from `app/lift-dust.tsx`. This was a visible levitation renderer, not a delivery route. `lineVertices` is now explicitly zero in scene diagnostics.
- Retained the existing mist system, enlarged its individual wisps from 1.15–2.2 × 0.65–1.23 to 1.9–3.4 × 1.0–1.85 scene units, increased their shallow spatial spread and modestly raised their per-wisp alpha to 0.19–0.255 before the porous density mask.
- Mist and released dust now use gold `#E5BA61`. Sixty layered, feathered, noise-modulated billboards form the active cloud. This is a lightweight 3D-distributed mist approximation, not physically ray-marched volumetric fog.
- Preserved the original gather/carry/arrival/fade state machine and matrix-following behavior. Released dust remains independent. Support objects remain non-pickable with depth testing and no depth writes.
- No new global light multiplier. The previous `MAP_LIGHT_GAIN = 1.3`, route/node settings and edge micro-glow settings remain unchanged. Light positions and distribution were not modified.

SHA-256 comparison against `../gold-cloud-resume-checkpoint-20260926.zip` found only these changed application/test files:

1. `app/lift-dust.tsx`
2. `app/support-mist.ts`
3. `scripts/check-support.ts`

This also confirms the existing camera, geometry, architecture, pointer-event guard, edge shader and scene-lighting files were preserved byte-for-byte in this pass.

## Checks actually completed

- Production build: `node scripts/run-framework.mjs build` — PASS, all five build stages. Non-fatal large-chunk, plugin-timing and experimental route-classification notices remain.
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` — PASS.
- ESLint on the three changed files — PASS.
- `scripts/check-support.ts` — PASS. Includes all-region anchors, copied transforms, support lifecycle, bounded residuals, finite mist positions, larger mist dimensions, gold material, depth configuration, full fade and obsolete-line-renderer absence.
- `scripts/check-pointer-events.ts` — PASS. Legacy R3F overflow reproduction plus 12,000 safe exits and hover/drag/lock/click guard regressions.
- `scripts/check-visuals.ts` — PASS. Existing architectural scale and finite-geometry regression checks.

## Actual browser observations

Used the available Chromium-based in-app browser at the previous 1536 × 1024 viewport override, with production-intended normal effect settings. No exaggerated probes were enabled.

- Overview: inspected terrain tops and side thickness, dotted edge illumination, delivery paths and nodes. Compared composition visually with the previous pass's `evidence/cloud-refinement/overview.png`. No new light-placement or exposure change was needed. This was a visual comparison, not a synchronized pixel-diff measurement.
- West: watched selection, lift and center-left focus. Gold mist appeared beneath the moving land without white levitation curves or a full-path light bridge. Actual live telemetry showed 60 mist instances, zero line vertices and the carry bank following the region matrix. After settling/fade: zero mist instances, residuals and banks; selection remained West.
- Central: watched the same flow, including gold mist visible below the land during movement and arrival, then progressive complete dissipation. Buildings and delivery paths remained visible. End-state mist/residual/bank counts were zero.
- Captured roughly 12-second West and Central canvas recordings in the existing development recorder and watched them in its inline player at playbackRate 1 without seeking. Observed movement/support, arrival and fading; the player reached its end normally. No fullscreen player workaround was used.
- On the normal URL without diagnostic overlays: drag/orbit changed the Central view, zoom increased its apparent size, Reset View restored the region-focus composition without clearing selection, and Back to Singapore returned to Overview. Diagnostic controls can overlap Reset View, so its acceptance check was performed after leaving the diagnostic URL.
- Browser error log: empty. Existing `THREE.Clock` deprecation warnings are non-fatal. One read-only browser selector timed out; the page remained responsive via accessibility controls and screenshots. No application code was changed to work around that tooling failure.

## Evidence limitations / remaining acceptance

Browser screenshots were captured and inspected in the task, including live support and settled states. However, this browser session did not produce a completed download event for the recorder's download link; its explicit download wait timed out. Canvas-frame downloads also did not produce a new file in the checked download directories. The page-asset exporter exposed no recorded blob video to bundle.

Consequently, there is **no new verified downloadable screenshot pair or WebM file** attached to this report. Existing files in `evidence/cloud-refinement/` belong to the previous pass and must not be described as the new gold-only result. Full-resolution synchronized before/after motion-frame comparison remains uncompleted. No external Chrome/Edge connection was available for an independent-browser check. Production compilation passed; a separate production-server browser smoke test was not performed.

The implemented gold-only effect and core interactions have been visually checked in the available browser. Downloadable evidence and final user visual acceptance remain outstanding; terrain refinement remains paused.
