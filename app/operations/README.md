# Operations frontend integration

The Operations navigation item contains Planning and Live Execution in one page. It uses the shared NEXUS shell, the Incidents night-map style, and the same black theme tokens. Planning owns plan creation and cross-route review. Live Execution gives a fleet-wide summary, route progress, and attention signals; vehicle and order record details belong in their dedicated pages.

## Data status

`operations-data.ts` is an explicit **frontend demo adapter**. Its orders, routes, stops, risk flags, alerts, plan ID and vehicle motion are fixtures. The map uses real Singapore map tiles, but no operational data on this page is currently fetched from the backend. `operations-road-routes.json` contains static road-following geometry generated from the ordered demo stops with OSRM / OpenStreetMap; its snapped waypoints are also used for the stop markers. Displayed route distance comes from that geometry, while planned duration remains a fixture. Vehicle markers travel along the stored road geometry for display only; they do not calculate ETA, risk or incidents. No routing service is called at runtime.

The demo flow is Ready → Solving → Plan Ready → Confirmed Current. Confirming a demo plan updates only frontend state. The trusted demo incident ID `INC-007` can open the existing Incident workspace through the application shell. When its mock approval succeeds, the shell remounts Operations and clears the previous plan, because the frontend fixture does not contain the approved replacement plan's routes and stops. This prevents displaying old route data under a new plan identity.

## Backend integration boundary

The backend currently exposes `POST /api/planning/generate`, `GET /api/delivery-plans/current`, `GET /api/delivery-plans/{plan_id}/routes`, `GET /api/operations/dashboard`, `GET /api/operations/orders`, `GET /api/operations/vehicles`, `GET /api/operations/routes`, and `GET /api/operations/simulated-positions`. The current generate endpoint creates a Current Plan immediately; it does **not** implement the design's draft review and confirm transaction. The frontend must not call it from the demo Confirm button as if those semantics were equivalent.

Before switching this page to backend data, implement or agree on the draft/confirm plan contract, route stop and location/geometry data for the map and timeline, alert/incident linkage, and a consistent snapshot refresh when Current Plan changes. Replace `demoOperationsAdapter` with a real adapter that maps those responses into `OperationsSnapshot`; keep the view components independent of transport details.
