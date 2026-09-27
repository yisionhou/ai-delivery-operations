# Overview backend data

Overview opens in **Backend** mode for the current Singapore business date. The frontend's same-origin `/api` proxy forwards read-only requests to `PENROSE_API_URL` (default `http://127.0.0.1:8000`). Select a date with a Current delivery plan, or use **Demo** to view the original presentation data.

| UI | Backend source |
| --- | --- |
| Orders, fleet counts, at-risk orders, open incidents, pending recovery reviews | `GET /api/operations/dashboard?business_date=YYYY-MM-DD` |
| Fleet cards and stop progress | `GET /api/operations/vehicles` and `/api/operations/routes` |
| Open incident rows | `GET /api/incidents`, filtered to the dashboard's Current plan |
| Map vehicle dots | `GET /api/operations/simulated-positions`, polled once a second |

The dashboard and lists refresh every 15 seconds. Vehicle dots represent **simulated**, repeating GPS-style positions, not physical trackers. The map uses static Singapore terrain; Backend mode removes demonstration routes and the demonstration incident beacon. The backend does not currently supply an on-time percentage, trend, or regional counts, so Backend mode does not display made-up values for them. When a backend request fails, the affected data remains unavailable; Demo data is never substituted automatically.
