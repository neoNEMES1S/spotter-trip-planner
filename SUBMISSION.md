# Submission and walkthrough

Fill these only after publishing and verifying the actual links:

- Hosted application: pending Lightsail deployment
- GitHub repository: https://github.com/neoNEMES1S/spotter-assignment
- Loom walkthrough: pending recording

## Final acceptance

Run against the public HTTPS URL:

```sh
python3 scripts/smoke.py https://YOUR-HOST --live
```

This checks the frontend, health, CSRF, invalid input, two-day sample, four-day restart, and real ORS geocoding/directions. Live mode consumes provider quota. Then open that URL in a fresh browser, inspect map tiles and route markers, check a narrow screen, and print the logs. The script checks API outputs; it does not replace visual checks.

## Four-minute Loom script

**0:00–0:30 — Problem and inputs.**
“This Django and React app plans a property-carrying driver's trip from the current location through pickup to dropoff. The fourth required input is cycle hours already used. I assume a fresh shift after ten hours off duty, a full tank, and the 70-hour/eight-day cycle.”

**0:30–1:15 — Generate a plan.**
On the hosted app, select three real locations and generate a plan. Show the map, itinerary, arrival, driving hours, and elapsed time. Explain that pickup and dropoff each take one hour. If showing the built-in sample, explicitly call its geometry and distances illustrative. Do not describe the sample as a live road route.

**1:15–1:50 — Explain inserted stops.**
Select a daily rest and fuel event on the itinerary. Explain the 11-hour driving limit, 14-hour window, 30-minute interruption after eight driving hours, and fueling by 1,000 miles. Fuel and loading stay on duty; a qualifying non-driving interval can satisfy the break.

**1:50–2:25 — Show daily logs.**
Open Daily logs, switch between dates, and print all logs. Point out the four duty rows, daily totals, mileage, time zone, and remarks. These are planned sheets, with missing identification fields labeled and certification unsigned.

**2:25–3:05 — Show the cycle boundary.**
Set cycle used to 70 and generate again. Show the initial 34-hour restart. “Aggregate cycle hours do not tell us which past hours expire tomorrow. The scheduler conservatively inserts a restart instead of inventing recap credits.”

**3:05–3:40 — Walk through the code.**
Show `backend/planner/scheduler.py` and `logs.py`: one event timeline drives map stops, itinerary, summary, and logs. Then show `routing.py`, where ORS calls remain server-side, and `frontend/src/components/DailyLogSheet.tsx`, which renders the SVG sheets.

**3:40–4:15 — Tests and delivery.**
Run `.venv/bin/python backend/manage.py test planner` and show the passing result. Mention midnight/DST handling, fuel boundaries, cycle limits, and CSRF tests. Show the hosted URL and GitHub link. End with the limits: estimated stop positions, no parking verification, no split-sleeper or special exceptions, and no historical recap.

## Submission message

Hi Spotter team,

Here is my full-stack assessment:

- Live application: [insert verified URL]
- Source code: https://github.com/neoNEMES1S/spotter-assignment
- 3–5 minute walkthrough: [insert Loom URL]

The application uses Django and React, generates HOS-based trip plans and printable daily logs, and includes automated scheduling and API checks. Setup instructions and scheduling assumptions are documented in the README.

Thank you for reviewing it.
