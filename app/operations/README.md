# Operations frontend integration

The Operations navigation item contains Planning and Live Execution in one page. It uses the shared NEXUS shell. Operations uses OneMap tiles; the Incident workspace uses its own NEXUS night-map style.

## Data status

`operations-data.ts` is an explicit **frontend demo adapter**. Its orders, routes, stops, risk flags, alerts, plan ID and vehicle motion are fixtures. The map uses real Singapore map tiles, but no operational data on this page is currently fetched from the backend. The moving vehicle markers are simulated for display only; they do not calculate ETA, risk or incidents.

The demo flow is Ready → Solving → Plan Ready → Confirmed Current. Confirming a demo plan updates only frontend state. The trusted demo incident ID `INC-007` can open the existing Incident workspace through the application shell. When its mock approval succeeds, the shell remounts Operations and clears the previous plan, because the frontend fixture does not contain the approved replacement plan's routes and stops. This prevents displaying old route data under a new plan identity.

## Backend integration boundary

The backend currently exposes `POST /api/planning/generate`, `GET /api/delivery-plans/current`, `GET /api/delivery-plans/{plan_id}/routes`, `GET /api/operations/dashboard`, `GET /api/operations/orders`, `GET /api/operations/vehicles`, `GET /api/operations/routes`, and `GET /api/operations/simulated-positions`. The current generate endpoint creates a Current Plan immediately; it does **not** implement the design's draft review and confirm transaction. The frontend must not call it from the demo Confirm button as if those semantics were equivalent.

Before switching this page to backend data, implement or agree on the draft/confirm plan contract, route stop and location/geometry data for the map and timeline, alert/incident linkage, and a consistent snapshot refresh when Current Plan changes. Replace `demoOperationsAdapter` with a real adapter that maps those responses into `OperationsSnapshot`; keep the view components independent of transport details.
