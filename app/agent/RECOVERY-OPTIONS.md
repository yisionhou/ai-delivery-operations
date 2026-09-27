# Recovery Options integration

Open /agent, enter the workspace, then choose Enter Recovery. The scenes share one route and one persistent PenroseHero video.

## Visual core and branches

hero-media.ts configures public/media/penrose/hero-penrose-alpha.webm, the final 90-second 1280×720 VP9 alpha Blender render. Its three riders, rotation, float and full original timing remain intact. public/media/penrose/hero-penrose-poster.png is the matching transparent first frame, used during loading or playback failure. frameAspectRatio=16/9 keeps the camera frame at the slot height, including its transparent margins. No geometry or renderer is reconstructed.

space-background.tsx renders three quiet elliptical tracks twice: a rear layer and a clipped front layer. Warm ivory light points and short luminous dashes circulate over 68/85/102 seconds, with a 12-second soft pulse. static-core.css controls layering. Reduced motion freezes the lines, hides moving points and pauses the video. Layout transitions move the single shared player between entrance, briefing, candidate and zero-candidate positions without restarting playback. Triangle and rider movement come exclusively from the delivered animation.

tapered-branch.ts produces smooth closed ribbon geometry around cubic branch curves. Each branch starts at 9px, narrows through the middle, and reaches 3px at the measured node boundary. Core, glow and halo use the same geometry and reveal timing. Node placements, recommendation, hover and selection remain data-driven.

## Selection, review and local dispatch preview

1. View details replaces only the right comparison panel.
2. Select this option immediately opens Change Overview in the same workspace. Selected is complete and Review active, with a 700ms rail pulse. There is no What changed button or intermediate selected summary.
3. Confirm Changes is inside Change Overview. It completes Review and Confirm, making Dispatch / Apply active. The button changes in place.
4. Dispatch / Apply sets local presentation state to preview-applied. It sends no request and does not mutate the current plan, snapshot or backend candidate status.
5. Change Overview remains available. The workspace shows RECOVERY CHANGE APPLIED — DEMO PREVIEW, all progress steps complete, and exactly two result carousels.
6. Reset preview is required before returning to comparison or changing the selected candidate. Reset removes result decks, returns to Review, scrolls to the overview and keeps the selected candidate.

The rail is 5px tall with 18px markers on desktop. selected-candidate-review.tsx owns the overview, confirmation, progress and local order dialog; use-recovery-workspace.ts owns guarded transitions. Confirmation requires a current, eligible READY comparison. Local dispatch preview additionally requires a demo source; no live dispatch is connected.

## Result carousel ownership

app/recovery-review/change-result-carousels.tsx uses the original moved focused-card-deck.tsx implementation. Incident retains only a lightweight summary; it has no duplicate detailed decks.

After preview, Order Reassignment Results centers the newly reassigned order first, followed by related affected or monitoring orders from the same candidate. Route / Task Impact Results shows the changed task sequence. Original arrows, wheel threshold, pointer swipe, keyboard navigation, counters, inert side cards and centered depth remain. The first result section rises immediately; its center card enters 150ms later. The second section follows at 270ms. Reduced motion removes these animations.

Candidate reviewSnapshot is immutable. A/C include four pending-task change records; B includes eight. Missing historical ETA, remaining travel and protected counts remain Unavailable with reasons. Pickup, delivery and loaded-order handover semantics are preserved. Demo records do not fabricate a production APPLIED response.

## Data and integration boundary

PenroseEntrancePage accepts recoveryLoader and onCandidateSelected. The loader receives incidentId, AbortSignal and demo count, then returns validated RecoveryOptionsData. Zero candidates is a successful manual-intervention outcome; rejection is a separate retryable error. Abort and stale-response protection remain.

The default isolated demo is PLAN-023 / INC-014 / V03 / O18 / O25 / O31. A and C reassign one order; B reassigns two. Maps use illustrative normalized coordinates. The manual checklist and retry remain local.

## Verification

- check-penrose-recovery-data.mjs: fixture invariants, counts 0–3, assignment consistency and cancellation.
- check-penrose-recovery.mjs: measured shared Hero travel, ribbon endpoints, candidate details, counts 0–3, zero state, responsive widths 320–1672px, reverse travel and reduced motion.
- check-penrose-human-review.mjs: shared video identity and moving orbital points; immediate overview; same-location confirmation/dispatch; local result decks; carousel interactions; explicit reset; candidate-specific results; mobile/reduced motion; no mutation requests; no duplicate Incident review.
