# Spotter assessment checklist

Source: `new-full-stack-dev-assessment.docx` from Spotter. Status reviewed September 21, 2026.

Legend: `[x]` complete and verified locally; `[~]` implemented but needs an external credential or final verification; `[ ]` still to do; `[—]` administrative or outside the application.

## Assessment requirements

- [x] **Build a full-stack app using Django and React.**
  - Django JSON API in `backend/`.
  - React + TypeScript + Vite interface in `frontend/`.
- [ ] **Create a live hosted version.**
  - The one-service Docker deployment is prepared in `Dockerfile` and documented in `README.md`, but there is no public URL yet.
- [ ] **Create a 3–5 minute Loom walkthrough of the app and code.**
  - A timed walkthrough script and submission message are ready in `SUBMISSION.md`; recording and sharing are still outstanding.
- [ ] **Share the GitHub code.**
  - Local Git repository initialized; source publication is in progress.
- [—] **$100 reward.**
  - Administrative item; no application work is required.
- [ ] **Make the hosted version accurate enough for Spotter’s testing.**
  - Local rule tests and browser checks pass, but a hosted URL and live-route acceptance pass are still outstanding.
- [x] **Provide good UI and UX.**
  - Responsive trip form, empty/loading/error states, keyboard-visible controls, map markers, itinerary, assumptions dialog, and print-focused log layout are implemented.
  - Desktop and 390px mobile layouts were checked locally without page overflow.

## Objective: inputs

- [x] **Current location input.**
  - Sample mode provides Chicago; live mode searches and selects a geocoded location.
- [x] **Pickup location input.**
  - Sample mode provides Indianapolis; live mode supports location search and selection.
- [x] **Dropoff location input.**
  - Sample mode provides Dallas; live mode supports location search and selection.
- [x] **Current Cycle Used in hours.**
  - Validated from 0–70 hours and used by the scheduler, summary, and logs.

## Objective: outputs

- [x] **Route instructions.**
  - The itinerary and expandable route-instruction view share the backend event/route result.
  - Sample route instructions are visibly labeled illustrative; live instructions come from openrouteservice.
- [~] **Map showing the route, stops, and rests using a free map API.**
  - Leaflet with OpenStreetMap tiles and attribution is implemented.
  - openrouteservice geocoding and `driving-hgv` directions are integrated in `backend/planner/routing.py`.
  - A real API key and live end-to-end request are still needed before this can be marked fully complete.
- [x] **Filled daily log sheets.**
  - `DailyLogSheet.tsx` draws the four-row duty graph in SVG, fills metadata, totals, mileage, remarks, and assumptions, and provides print CSS.
- [x] **Multiple log sheets for longer trips.**
  - Events are split by terminal-time-zone midnight in `backend/planner/logs.py`; the UI paginates between sheets and the print stylesheet prints each sheet separately.

## Required assumptions

- [x] **Property-carrying driver.**
- [x] **70 hours / 8 days.**
- [x] **No adverse driving conditions.**
- [x] **Fuel at least once every 1,000 miles.**
  - Fueling is a 30-minute on-duty event and can also satisfy the 30-minute driving interruption.
- [x] **One hour for pickup.**
- [x] **One hour for dropoff.**

## Local verification already completed

- [x] **21 backend tests pass.**
  - Covers short trips, pickup as a break, dedicated breaks, 11/14-hour limits, 69/70-hour boundaries, 34-hour restart, fueling, midnight mileage, daylight-saving days, validation, CSRF, and mocked routing responses.
- [x] **Django system check passes.**
- [x] **Django production deployment check passes.**
- [x] **React TypeScript/Vite production build passes.**
- [x] **Sample browser flow passes locally.**
  - Sample output: 1,020 miles, 18 driving hours, 30 hours 30 minutes elapsed, one 10-hour rest, one fuel stop, and two log sheets.
- [x] **70-hour cycle boundary flow passes locally.**
  - Produces a conservative 34-hour restart and four log sheets for the sample.
- [x] **Mobile layout check passes at 390px.**
  - Document width equals viewport width; no page-level horizontal overflow.
- [x] **Print pagination review.**
  - Chromium PDF export verified: two pages for the sample and four for the 70-hour restart. Rendered pages inspected; long fuel remarks fit within the printed table. Arbitrarily long metadata can still require continuation pages.
- [x] **Linux AMD64 Docker image built.**
  - Local image: `spotter-planner:v1`. Container smoke checks pass with local HTTP development settings; production `check --deploy` passes inside the image.
- [x] **Deployment smoke-check script.**
  - `scripts/smoke.py` verifies frontend, health, sample, daily totals, restart, invalid input, and CSRF. Optional `--live` verifies ORS geocoding and directions; requires a configured key.
- [x] **Internal HTTP health probes supported with HTTPS redirect enabled.**
  - `/api/health` remains reachable for container health checks; regression test confirms application routes still redirect.

## Remaining work before submission

1. **Configure live routing.** Obtain an openrouteservice key, set `ORS_API_KEY`, and run a real three-location route through geocoding, directions, map markers, itinerary, and logs.
2. **Deploy publicly.** Build the Docker image or deploy the Django/React service, set `DEBUG=0`, `SECRET_KEY`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `ORS_API_KEY`, and HTTPS settings, then record the public URL.
3. **Run hosted acceptance checks.** Repeat the sample, live route, 70-hour restart, invalid-input, mobile, and print checks from a fresh browser session against the public URL.
4. **Publish the code on GitHub.** Initialize the repository, commit the source, add a remote, push it, and record the repository URL. Do not commit `.env` or API keys.
5. **Record and share the Loom.** Keep it between 3 and 5 minutes: inputs/assumptions, generated route, rest and fuel reasons, both daily logs, scheduler code, tests, and the cycle-history limitation.
6. **Print verification completed locally.** Repeat on the hosted app as part of step 3.

The remaining external dependencies are a live-routing key, a public deployment, GitHub publication, and the recorded Loom. The `$100 reward` remains administrative.
