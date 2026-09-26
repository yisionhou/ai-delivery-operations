# Vehicles module

Implemented in the existing NEXUS frontend. No second application or backend mutation was introduced.

## Run and routes

- `npm run dev` (existing project command, port 5173).
- `/vehicles`: backend mode, defaults to the current Singapore business date.
- `/vehicles?source=demo`: local demo for today's Singapore business date; open V01 to watch a roughly two-minute countdown.
- `/vehicles?source=demo&business_date=2026-09-26`: historical snapshot, whose planned window has ended.
- `/vehicles?selected_vehicle=:vehicleId`: opens the right-side inspector while keeping the fleet board visible.
- `/vehicles/:vehicleId`: compatibility redirect to the board with that inspector selected; backend IDs are UUIDs.
- `/incidents?incident_id=...&vehicle_id=...&business_date=...`: Incident handoff.
- `/orders?selected_order=...&vehicle_id=...&business_date=...`: selected Order handoff.

`source`, `business_date`, `filter` and `page` travel with links and Back actions. Selecting or closing a vehicle keeps the board scroll position. The original Overview/Operations shell remains in use; only its sidebar was extracted to enable shared navigation. The existing demo shell initially opens the explicit demo. The Vehicles shell preserves the currently chosen data source.

Backend reads use the same-origin, read-only `app/api/[...path]/route.ts` bridge. Set **server-side** `PENROSE_API_URL` to the backend origin (default `http://127.0.0.1:8000`) and restart the frontend. Do not include `/api` in that origin. The bridge allows only the verified read routes used by this module, forwards backend envelopes/statuses, and returns a clear 503 when the backend is unreachable. It does not start, seed, mutate, or configure the backend database.

There is **no automatic API-to-demo fallback**. The source toggle is explicit. Demo source uses separate static JSON files and a visible DEMO DATA badge.

## Verified backend contracts

Source: `D:/PresidentGoodJob/PenroseRoute/backend/app`, inspected 2026-09-27.

| Endpoint | Contract and use |
| --- | --- |
| GET /api/vehicles | `status`, `page`, `page_size`; `ApiResponse<PaginatedData<VehicleResponse>>`. Resource data and global resource counts. |
| GET /api/vehicles/{vehicle_id} | Vehicle resource, capacity, recorded location and recording timestamp. |
| GET /api/operations/vehicles | `business_date`, `page`, `page_size`; joins via `vehicle_id`, returns `driver_code`, `route_id`, `route_status`. |
| GET /api/vehicle-routes/{route_id}/stops | `ApiResponse<RouteStopResponse[]>`; sequence, order ID, location ID, type, status, planned/actual arrival/departure. |
| GET /api/incidents | Date + VEHICLE_UNAVAILABLE filters and pagination. Link only one unresolved Incident matching vehicle and, when available, current route. |
| GET /api/incidents/{incident_id} | Persisted selected Incident context. Production recovery actions remain outside Vehicles. |
| GET /api/orders/{order_id} | Resolve stop place names by matching pickup/delivery location IDs, show order codes, and load selected order context. |

Schemas are checked at the adapter boundary. The normalized view types in `vehicle-data.ts` are not claimed to be the backend's wire format. The adapter preserves PLANNED / ARRIVED / IN_SERVICE / COMPLETED stop statuses; it supports PICKUP / DELIVERY / HANDOVER without manufacturing handovers.

The backend has **no place name in RouteStopResponse and no locations read route**. A location name is used only when its location ID matches a returned order's pickup/delivery location. Unresolved locations, including handover locations, display their actual location ID. Failure to load order metadata does not discard valid stops.

`CURRENT_PLAN_NOT_FOUND` is treated as a missing plan, not an empty fleet. Other association errors are shown as unknown associations, not “no assigned route.” Resource data remains usable.

## Pagination and refresh

Resource pages are fetched from the server, with 8 rows per logical board page. All mode composes status-filtered backend pages in EXCEPTION → ACTIVE → AVAILABLE order, using per-status totals, so exceptions cannot be stranded behind an active-only first page. Status pages use actual `page/page_size/status` parameters; complete resource lists are not downloaded. The UI retains its date/filter/page in the URL. Within each group, resource codes give a stable order; percentages never control ordering.

Operations and Incident association lists are fully traversed using the backend's pagination metadata (100 per page). The board refreshes every 15 seconds while visible. The inspector reuses the selected board vehicle and route stops. Direct links to vehicles outside the current page fetch the vehicle and its stops on demand. A local stops retry keeps vehicle identity visible when that request fails. Requests are cancelled when their context changes. Stops are keyed to their route so a new route cannot inherit the old route's progress.

Counts reflect resource statuses, including completed resources; a completed board row disappearing does not delete that resource or alter backend totals. Completion is view-only: motorcycle reaches the end, Completed state is displayed, row fades/collapses over about 1.1 seconds. Exceptions always remain visible even if their route has completed stops. Reassignment with a new route ID restores visibility. Group moves use a 500 ms layout transition. Reduced-motion mode skips animations and preserves all navigation and completion behavior.

## Derived fields and deliberately absent fields

- Route Progress = rounded `completed stops / total stops * 100`; no percentage when there are no stops.
- Remaining stops = total minus completed.
- Current stop = first ARRIVED/IN_SERVICE (or demo IN_PROGRESS); otherwise first unfinished stop.
- Related Orders = unique order IDs in the current route's stops.
- Route summary = first/last returned stop labels. The board owns the horizontal stop progress track; the inspector shows the time window and vertical stop execution sequence.
- Stop Timeline start = earliest actual arrival (or planned arrival where no actual arrival exists); end = latest planned departure/arrival. The browser clock supplies the current Singapore time and updates the indicator and countdown to planned end every second. Demo `HH:mm` stop times are anchored to their stated business date; historical snapshots show `Ended` rather than a simulated clock. Missing timing data remains unavailable.
- Times from backend timestamps display in Asia/Singapore.
- Last Recorded Location is explicitly **not live GPS**.
- No simulated-position endpoint, synthetic distance, battery, ETA, trends, search, rider photo, or fake road-map layer.
- “To next stop” is omitted; the adapter does not fetch or infer a live ETA.
- Report unavailable is omitted because this frontend has no connected production reporting form. Unavailable vehicles with missing/ambiguous links open the safe Incident-context state; no POST, recovery, or location assumption occurs.

## Demo provenance and current boundaries

The demo uses V01–V04 route/driver/stop facts copied from the existing `operations/operations-data.ts` snapshot. For today's demo date only, V01 keeps those three stops and their statuses but sets their planned arrivals relative to the browser session start: one minute ago, 15 seconds ago, and two minutes ahead. The end stays fixed during 15-second fleet polling, so its countdown genuinely decreases. Reloading the demo starts a fresh example. The original 2026-09-26 snapshot remains available by URL. V06–V08 are explicit AVAILABLE fixtures. Names, capacity, recorded locations and actual times remain null where the fixture provides none. The existing trusted demo Incident is INC-007.

The existing Incident review remains a demo and is used only for demo IDs/source. API mode opens the real persisted Incident's read context; it cannot use the mock recovery approval UI. Orders had no implemented module in the baseline; the new route is a narrow selected-context handoff, not a new full Orders workspace.

At delivery, port 8000 was not serving PenroseRoute. Live database end-to-end verification therefore remains pending. No backend files were modified. A running configured API/PostgreSQL is required for live fleet records. This does not block demo inspection or verified-contract UI tests.

## Validation

- `node node_modules/typescript/bin/tsc --noEmit`
- `npm run lint`
- `npm run build`
- `node scripts/check-pointer-events.ts`
- `node scripts/check-vehicles-browser.mjs <evidence-directory>`

Browser tests require Playwright and Chrome. Set `PLAYWRIGHT_MODULE` to an installed Playwright ESM module when it is not a project dependency, optionally set `CHROME_PATH`, `VEHICLES_BASE_URL`, and `HEADED=1` for a visible Chrome run. No extra app dependency is required.

The browser suite covers Active/Available/Exception, inspector selection and close, direct-route compatibility, Orders context, contract envelopes, association pagination beyond 100 records, resource pagination with date/filter, no plan, no route, empty fleet, association failures, stops failures and Retry, missing Incident IDs, stable ordering, exception promotion, completion, reduced motion, and compact layout. API scenarios use intercepted responses matching the inspected Python schemas, **not a live database**. The standalone timeline check is `node scripts/check-vehicle-timeline.mjs`. A running configured API/PostgreSQL remains necessary for live fleet records.

