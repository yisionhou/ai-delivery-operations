# PENROSE — Entrance to Situation Briefing

Route: /agent. The existing AI Agent sidebar entry opens the scene.
Both scenes stay mounted on this route; there is no navigation during the transition.

## Delivered Blender Hero

There is exactly ONE PenroseHero component in penrose-entrance-page.tsx.
It stays mounted inside .pe-hero-flight for entrance, transitioning and workspace states.
Its src, DOM key and playback effect do not change with scene state.
hero-media.ts configures /media/penrose/hero-penrose-alpha.webm: the final approved Blender
delivery, 90 seconds, 1280×720, 18fps, VP9 with alpha, 88,149,517 bytes. Its original triangle
rotation, floating movement and three riders are preserved at normal speed. There is no extra
CSS model rotation or Three.js renderer. The original first RGBA frame is the matching poster
and error fallback at /media/penrose/hero-penrose-poster.png.
frameAspectRatio=16/9 preserves the whole camera frame at the hero slot height; transparent
side margins extend beyond the slot without cropping or stretching the visible model.

The flight wrapper receives scene translation and scaling, with no perspective tilt.
use-hero-travel.ts measures an unanimated entrance anchor and a workspace destination.
The outer flight retains its measured entrance-to-workspace scale. Briefing adds a 1.5× presentation
scale (1.25× on narrow screens) so the triangle remains prominent behind Enter Recovery; Recovery
returns smoothly to its original scale. Hero stays mounted inside a viewport-sized .pe-hero-stage
within .pw-scroll-content from the first frame. Cards and Hero therefore scroll together natively.
ResizeObserver handles layout changes; neither travel hook writes transforms on scroll. This avoids
competing position corrections and compositor lag without replacing or restarting the media.
Continuous motion comes from the delivered video and front/back orbital trails. Reduced motion
pauses the video and makes the trails static. Preference changes pause/resume the same element.

## One coordinated timeline

use-entrance-transition.ts owns the clock and exports SCENE_TIMING. It uses one requestAnimationFrame
loop and cleans it up on reset/unmount. Components have no independent timeout choreography.
The same timing values become CSS variables; data-entered starts animations once.

- 0ms: leaving-entrance, button contracts and fades.
- 200ms: typography floats upward.
- 350ms: camera/background movement; transitioning.
- 450ms: shared Hero begins its spatial arc (1600ms duration).
- 1500ms: workspace-entering; Recovery appears first.
- 1780ms: main rounded card rises (800ms).
- 1960 / 2080 / 2200ms: Current Operations / Latest Incident / Risk Alerts rise (650ms).
- 2250ms: briefing text enters.
- 2450ms: secondary controls enter; the shared header reveals branding, Back and profile.
- 2800ms: Recovery begins its 4200ms breathing cycle.
- 3000ms: workspace-ready; controls become interactive and focus moves to Recovery.

The final Hero travel overlaps the first screen formation. Finished cards are explicitly locked
at their final pose, including after viewport changes. Only the delivered video, orbital trails, light points
and Recovery breathing remain visibly animated. Reduced motion compresses the timeline to 480ms,
disables camera travel and orbit/breathing loops, and places Hero directly at its destination.
The onHandoff callback and penrose:entrance-complete window event fire once at workspace-ready.
Back navigates to the matching Incident view: the live incident in normal mode, or the Incident Focus demo in explicit demo mode.

## Approved assets and panel material

- public/media/penrose/entrance-background.png: original approved entrance artwork.
- public/media/penrose/workspace-background.png: supplied Singapore/starfield artwork.

The image assets are copied without modification. CSS composes and darkens the workspace image,
keeping Singapore around the lower quarter. A masked star layer removes seams during reveal.
The entrance artwork contains baked-in orbits. Two persistent SVG layers follow the shared flight,
with three 68/85/102-second paths, moving light points, softly pulsing dashes and a clipped foreground.
static-core.css controls the shared media layering and restrained orbital field in all recovery states.
panel-surface.tsx supplies flat graphite cards with 24px corners (26px for the main card), thin champagne borders, warm inner highlights and restrained glow. Panel reveals use translation/scale without perspective distortion.
Mobile keeps the same rounded surfaces, a stacked main card and exactly three lower cards in a scroll area.

## Honest interaction boundary

briefing-demo.ts is an isolated, explicitly labeled DEMO SNAPSHOT matching the approved visual scenario:
PLAN-023, INC-014, V03, O18/O25/O31. It is not an API response and is not presented as live telemetry.
Quick prompts return predefined demo explanations. Free-text input is disabled and labeled unconnected.
Enter Recovery continues into Recovery Options in the same route. Incident details and affected orders open accessible native dialogs for this demo snapshot.
The demo snapshot sends no recovery, approval or chat request. Normal `/agent` mode instead loads the live Incident and operations facts, asks the read-only dispatch Agent, starts Recovery through the official `/api/incidents/{id}/recovery` command when needed, and requires an explicit dispatcher reason before approving a validated Candidate. The live route map links to the persisted Incident map. In Briefing, Back navigates to the matching Incident; in Recovery Options, Back returns to Briefing.

## Live backend configuration

Normal `/agent` uses live backend data. Use `/agent?source=demo` for the isolated visual demo. A specific incident can be opened with `/agent?incident_id=<UUID>`; otherwise the newest open incident is selected. The frontend server reads `PENROSE_API_URL`, `PENROSE_DISPATCH_TOKEN`, and the optional local-development-only `PENROSE_AGENT_LOCAL_ONLY` from its environment. The dispatcher token stays on the server and is forwarded only by the same-origin bridge to the official read-only dispatch, Recovery, and approval commands. Non-local writes stay disabled unless `PENROSE_AGENT_TRUSTED_AUTH_PROXY=true` is configured behind a gateway that strips untrusted identity headers and injects verified ChatGPT identity. The backend must run with its configured dispatcher authentication and `RECOVERY_ORCHESTRATION_MODE=agent`; restart it after changing its environment.

The official Recovery response may contain no feasible Candidate; this is shown as manual intervention, not a fabricated plan. Existing pending Candidates are reused rather than re-solved. Comparison metrics absent from the backend remain unavailable in the UI. An explanation labeled deterministic or template fallback is never described as a successful model explanation. Approval changes the Current Plan only after the backend confirms it; the visual demo remains a preview.

## Verification

scripts/check-penrose-workspace.mjs runs the integrated browser suite. The original
check-penrose-browser.mjs command forwards to it. Configure PLAYWRIGHT_MODULE and optionally
PENROSE_BASE_URL, then pass an evidence directory. It samples real animation frames, checks
same-node identity, curved travel, reveal order, final scale, stable cards, accessibility,
demo actions, mobile resizing/scrolling, reduced motion and existing page availability.
check-penrose-human-review.mjs also verifies shared video identity, moving orbit points and local dispatch previews.
The integration was verified in Chrome, including decoded alpha, forward playback, the 90-second
loop boundary, same-element scene transitions, reduced motion and matching-poster fallback.
The original lossless delivery is intentionally retained; optimize into a separate derivative only
if deployment bandwidth requires it. Other browser/device alpha support still needs deployment QA.

## Full-width composition

The main card spans the page with equal 3.75% desktop gutters, a 420–520px height, and a 26px gap before three equal 244–280px cards. A 210px scenery area below the cards reveals the supplied Singapore artwork at reduced brightness. On shorter viewports the workspace scrolls, including its background; on narrow screens the cards stack. The shared header keeps Back accessible. The Q&A response scrolls internally to protect the Ask field and note from overflow.
