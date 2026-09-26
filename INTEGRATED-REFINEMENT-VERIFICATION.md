# Integrated cloud + terrain refinement — 2026-09-26

## Implemented

- Continued the existing gold mist rather than replacing its shader language or timing. Local support now samples 18 underside sites instead of 6 (180 porous wisps rather than 60). Each wisp is slightly larger and individually more transparent, producing a connected envelope instead of separate bright puffs. Released particles remain sparse. No support-line mesh was reintroduced.
- Added a separate, fixed world-space gold cloud bed: 60 broader wisps, much slower drift and lower alpha. It remains below the main map and recedes to 45% strength during region focus. It does not follow the selected region or connect its origin to destination. Both layers use the existing depth-tested, non-pickable cloud material.
- Preserved local gather/arrival/fade timing, land translation and camera behavior. Original six-site underside light anchors are retained independently of the denser mist anchors. Scene light gain is still 1.3; there is no further global light increase.
- Replaced the generic shallow wave with a geographically anchored, continuous relief field. Central/Bukit Timah hills rise gently; the eastern plain stays lower. A derived distance field from the existing **SLA coastal outlines before hydrographic subtraction** creates the coast-to-interior transition. Inland waterways suppress micro-undulation without incorrectly flattening the surrounding hills to sea level.
- Increased top-surface tessellation from 1.6/2 to 0.55/6 (edge threshold/iteration limit). Height is real vertex displacement, not only a shading trick. Top material is less glossy; sidewalls have object-space strata/mineral variation and a small derivative-based rock bump. All strata follow the refined top profile while retaining exact horizontal boundary coordinates.
- Added local, feathered grading under the 48 existing valid architectural placements. Building models, coordinates, rotation and scale are unchanged. Buildings, routes, labels, nodes and edge geometry share the same elevation sampler.
- Existing SLA/URA water holes and channels are unchanged. No water shader, metallic-water pass, new river layout or building redistribution was introduced.

## Geographic interpretation and sources

This is **an artistic topographic maquette, not a measured DEM, survey or geological reconstruction**. Its vertical relief is deliberately legible at the sandbox's scale. Hills are geographically anchored and bounded, not claimed to reproduce measured contours.

- [NParks: Bukit Timah Nature Reserve](https://www.nparks.gov.sg/visit/parks/park-detail/bukit-timah-nature-reserve/) — central hill context and Singapore's 163-metre high point.
- [PUB: reservoirs and waterways](https://www.pub.gov.sg/Public/Places-of-Interest/Our-Reservoirs-and-Waterways) and [catchment maps](https://www.pub.gov.sg/Professionals/Requirements/Qualified-Persons/Catchment-Maps) — water-system context.
- Existing official SLA/URA source IDs and geometry provenance remain in `public/data/geography-provenance.json`.

`scripts/prepare-relief-coast.mjs` reproducibly derives `public/data/terrain-coast-distance.json` from the already downloaded SLA source snapshot. This additional scalar field is bundled locally; ordinary app startup needs no network or original source archive.

## Tests performed

- `check-landform.ts`: PASS. 23,552 terrain samples, finite height range 0.018–0.5335 scene units; Bukit Timah sample 0.5324 versus eastern-airport sample 0.0704. Marine boundary samples remain approximately 0.018. These values are artistic scene units, not metres.
- Grounding: 48 footprints; maximum sampled height spread across footprint corners/centres 0.015 scene units. Compared 1,217,988 architectural vertices with flat-ground builds: every horizontal X/Z coordinate unchanged. This is a sampled grounding regression, not an exhaustive mesh-intersection certificate.
- `check-support.ts`: PASS. Updated 180-instance local support, dimensions, low individual opacity, gold color, bounded resources, copied transforms, full fade, cancellation, independent residuals, depth behavior and no obsolete line renderer.
- `check-pointer-events.ts`: PASS, including 12,000 safe exits and existing selection/hover/drag guards.
- TypeScript and targeted ESLint: PASS.
- Production build: PASS; framework large-chunk/plugin-timing/route-classification notices remain non-fatal.
- SHA-256 comparison to `../integrated-mist-terrain-checkpoint-20260926.zip`: original region GeoJSON, coastline data, delivery routes, camera implementation, pointer guard and edge-glow implementation unchanged.

## Rendered verification

Inspected the actual local browser at the previous 1536 × 1024 viewport setting, using normal production-intended effects. Watched West and Central move at normal speed, carry their fuller gold cloud, settle and fade completely. Live diagnostics confirmed 180 local mist instances during carry and zero after fade; the independent 60-instance world-space cloud bed remains, reduced during focus. No white support rails or origin-to-destination bridge appeared.

Viewed Overview, settled Central and West, terrain top/side readability, buildings, routes and dotted edge lighting. The cloud bed was initially too weak, so only its spatial extent/individual alpha was adjusted; scene lighting was not raised. The final bed is intentionally secondary. Low coastal regions still remain flatter than the central hills.

Tested drag/orbit, region-preserving Reset View, zoom and Back to Singapore. Error log was empty. The browser reported a non-fatal THREE.Clock deprecation warning and a GPU compiler precision warning, not shader compilation failure. One Overview frame-time reading after the build completed was 33.11 ms; this is not a sustained performance benchmark or a 60 fps claim.

Screenshots were inspected through the browser tool. No new downloadable screenshot/video artifact or external-browser verification is claimed in this pass. A separate production-server browser smoke test was not performed; the production bundle was compiled successfully. Final artistic acceptance remains with the user.
