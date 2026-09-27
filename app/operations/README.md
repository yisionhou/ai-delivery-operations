# Operations frontend integration

Operations has one page with Planning and Live Execution. It keeps the shared NEXUS shell and the Incidents night map.

## Data modes

- **Backend** is the default. It reads `GET /api/operations/workspace?business_date=YYYY-MM-DD` through the same-origin bridge. The date selector controls the business date. The response supplies daily resource readiness, the latest reviewable draft or Current Plan, plan routes/stops, unassigned orders, persisted risk/active alerts, open incidents, and measured on-time rate. The page never silently substitutes demo data if this request fails.
- **Demo** remains an explicit frontend fixture in `operations-data.ts`, dated 2026-09-26. Confirming its plan affects only local state. The static `operations-road-routes.json` contains road-following demonstration lines.

## Planning and execution

Backend Generate calls `POST /api/planning/drafts` and reloads the workspace. Repeating Generate cancels the previous draft. Confirm calls `POST /api/planning/drafts/{id}/confirm`, then reloads the Current Plan. The older `POST /api/planning/generate` still creates a Current Plan immediately and is never used by this page.

For Current Plans, the page refreshes the workspace every 15 seconds and polls `GET /api/operations/simulated-positions` every second. Vehicle markers use the returned coordinates. These are simulated positions, not GPS. ETA and risk do not derive from the markers. The Incidents link opens persisted incident context; recovery actions on that context page remain separate.

Routes with stored GeoJSON use it. Where route geometry is absent, the backend sends straight start/stop/terminal connectors and marks `geometry_source=STOP_CONNECTORS`. The `road_aligned` field is true only for stored OSRM geometry. When sources are mixed, the map labels the selected route by its own source; old hand-drawn lines remain unverified. Planned route distance and duration come from the solver, while on-time rate is shown only when completed deliveries have been measured. Daily order pool and Current Plan membership are deliberately separate counts.

For OSRM routes, simulated coordinates follow the same saved road line. Legacy routes continue to interpolate between stops. The markers are still simulated positions, not live GPS.
