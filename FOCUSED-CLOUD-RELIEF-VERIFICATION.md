# Focused cloud-bed and relief refinement — 2026-09-26

## Scope and implementation

Active specification: the supplied “Focused Refinement Pass — Strengthen Global Base Mist and Make Terrain Relief Visibly Readable” attachment. This pass builds on existing changes; it does not restore or overwrite an earlier project version.

- `app/base-mist.tsx`: broadened overlapping global mist patches, softened their falloff, increased global-only opacity, and arranged them as a shallow world-space bed below the terrain. Their slow drift and gold color remain. Focus eases global strength to 30% so local support retains priority. No white support lines were introduced.
- The first enlarged camera-facing version produced horizontal clipping bands; a later tilted version rose over the terrain. Both were rejected during browser inspection. The final global renderer is world-horizontal with three slightly separated heights, below the island and above the ground plane. It is a lightweight layered shader effect, not a volumetric fluid simulation.
- `app/terrain-landform.ts`: widened and strengthened geographically anchored macro hills and the lower-coast-to-inland progression. This changes the actual sampled terrain vertices and side-wall heights through the existing geometry pipeline. The same existing field grounds buildings and operational elements; no X/Z placement or scale changes.
- `app/terrain-material.ts`: height-aware tonal variation reinforces real displaced slopes. Existing carved-side-wall material remains, now following the stronger relief. No scene-light, exposure or global brightness multiplier was changed.
- `scripts/check-landform.ts`: updated bounds for the intentional new relief and added an overview-scale minimum relief assertion.

The landform is an artistic, vertically exaggerated Singapore maquette, not a measured DEM. Existing official coastline/region geometry and water holes remain unchanged. No final water rendering was added.

## Verification performed

### Automated and production

- Landform regression: PASS. 23,552 field samples, height range 0.018–1.359 scene units; central/western hill sample 1.343 versus airport 0.234. Coast samples remain approximately 0.018. These are field samples, not a count of mesh vertices.
- Foundation regression: PASS. 48 foundations, maximum tested footprint height spread 0.0554 (limit 0.09); 1,217,988 architecture vertex X/Z components preserved by the grounding test.
- Support lifecycle regression: PASS.
- Pointer-event regression: PASS.
- TypeScript and ESLint for the changed source/test files: PASS.
- Production build: PASS. Remaining non-fatal notices concern large bundles, plugin timings and framework route classification.

SHA-256 comparison against `../focused-cloud-relief-checkpoint-20260926.zip` confirms these protected files are identical: local support (`lift-dust.tsx`, `support-mist.ts`, `support-field.ts`), architecture, main scene, inspection camera, pointer interaction, delivery routes, terrain edge renderer, region GeoJSON, coastline JSON and coastal-distance data.

### Rendered browser checks

At the normal page URL, using the reference 1536×1024 viewport setting and normal camera/material/effect settings:

- Overview inspected after the final change. The broader gold bed is plainly visible below the southern/front and outer coast; the island silhouette remains unobscured. Central/western inland rise and lower coastal shelves are visible without diagnostic lighting or camera changes.
- West Region selection, lift/focus, situation card, settled terrain/building grounding and return to Singapore checked.
- Central Region selection checked during lift (gold local support visible) and after settling (local support faded; quieter global foundation remains). Existing coast/water openings remain visible.
- West orbit/drag, Reset View retaining selection, and zoom-in checked through rendered views and interaction state.
- Captured browser error log: empty. No application crash or pointer-recursion error observed in these checks.

Screenshots were inspected inline through the browser tool. This pass did not produce a downloadable screenshot pair or a normal-speed video file; it does not claim a full recording-based or pixel-difference acceptance test. No claim is made that the procedural terrain reproduces surveyed elevations or matches a photorealistic reference exactly. Final aesthetic approval remains with the user.
