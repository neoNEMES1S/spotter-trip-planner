# Spotter trip planner

A Django + React application that plans a property-carrying truck trip, inserts HOS rests and fueling, and draws printable daily driver logs. One backend event timeline drives the map, itinerary, summary, and log sheets.

## Run locally

Requires Python 3.11+ and Node.js 22+.

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm --prefix frontend ci
cp .env.example .env
./dev.sh
```

Open **http://127.0.0.1:5173**. Choose **Generate trip plan** to run the sample immediately. No database or migrations are needed.

The bundled Chicago → Indianapolis → Dallas sample is illustrative: 1,020 miles, 18 driving hours, 30 hours 30 minutes total with zero initial cycle usage, two log days, one daily rest and one fuel stop. Sample geometry is schematic and is visibly labeled. It is never used as a fallback for failed live routing.

## Enable real routes

Obtain a free [openrouteservice](https://openrouteservice.org/) API key, set `ORS_API_KEY` in the local `.env`, and restart `./dev.sh`. The key stays on the server. Select **Your route**, search and select each location, and generate the plan.

The server uses `driving-hgv` directions, road-step travel estimates, and geocoding restricted to the USA. Vehicle dimensions, cargo restrictions, live traffic, and parking availability are not supplied by this assessment. Stop coordinates are interpolated along the route and explicitly approximate; the app does not claim these are verified service facilities.

Requests have a 20-second timeout and surface credential, quota, and routing errors. Successful route/geocoding responses are cached for one hour per process. There is no silent retry storm or fabricated route after a provider failure. The browser loads OpenStreetMap tiles with visible attribution; production use must respect the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

## Use the app

1. Select sample or live routing and enter cycle hours used, from 0 to 70.
2. Expand **Departure & log details** to change departure, terminal time zone, and optional carrier/driver/shipment metadata.
3. Generate a plan. Click an itinerary event to locate it on the map; expand route instructions for maneuvers.
4. Open **Daily logs**, move between days, and select **Print all logs**. The browser's Save as PDF option exports the same SVG sheets, with one sheet per day for normal-length remarks. Very long metadata/remarks may continue on another printed page.

Changing inputs marks the existing result as stale until regenerated. The interface handles loading, validation, unavailable routing, and request failure explicitly.

## Scheduling decisions

- The driver starts a fresh shift after at least 10 consecutive hours off duty. Initial cycle usage still carries forward.
- Maximum 11 driving hours within a 14-hour elapsed window. Midnight does not reset these counters.
- Before driving beyond 8 accumulated driving hours, take 30 consecutive minutes without driving. Pickup, unloading, and the planned 30-minute fuel stops qualify while remaining on duty.
- One hour each for pickup and dropoff; driving and non-driving work both count toward the 70-hour cycle.
- Ten hours off duty resets daily driving/window limits. Thirty-four hours resets the cycle too. Unloading may finish after a driving limit; further driving cannot.
- **Conservative cycle policy:** aggregate cycle usage does not reveal historical daily hours. We do not invent rolling recap credits; we insert a 34-hour restart when further driving is blocked. This can be later than the earliest legal departure with complete historical logs.
- Full tank at departure; fuel for 30 minutes at or just before every 1,000 miles. Distance carries across pickup and daily rest. Integer-second rounding stops before the distance boundary, never after it. No fuel or rest is inserted after the final drive solely to prepare for an unplanned future trip.
- Off-duty rest only. No split-sleeper, adverse-condition, personal-conveyance, short-haul, or team-driver exceptions.
- Calculations use UTC elapsed seconds, while logs split on home-terminal midnight. Daylight-saving dates are explicitly 23/25-hour sheets with repeated/skipped local labels. Ambiguous/nonexistent naive departure times are rejected; an explicit UTC offset is supported by the API.
- Daily mileage is allocated using individual road-step timing, including when a drive crosses midnight. Displayed durations/miles are rounded; internal calculations retain seconds and meter precision.
- Before departure and after completion are assumed off duty. Missing historical recap and identification fields are labeled unavailable/not provided; certification stays unsigned.

These are planned activity sheets, not a certified ELD or a record of actual driving. All assumptions are also available inside the application.

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the original scope and [FMCSA's summary](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations) for the underlying normal rules.

## Structure

```text
backend/planner/scheduler.py   Pure HOS event loop and route-position interpolation
backend/planner/logs.py        Daily projection, midnight mileage and DST handling
backend/planner/routing.py     openrouteservice adapter and explicit sample data
backend/planner/views.py       Validation, CSRF-protected JSON API
backend/planner/tests.py       Deterministic rule, boundary and API checks
frontend/src/App.tsx           Form and result views
frontend/src/components/      Location search, map, itinerary and SVG sheets
frontend/src/styles.css        Responsive layout and print stylesheet
```

No user accounts, trip persistence, background workers, or database are required for this workflow.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Process health |
| `GET /api/config` | Live-routing availability, sample locations, CSRF token and cookie |
| `GET /api/locations?q=Chicago` | Up to five named geocoding results |
| `POST /api/trips/plan` | Route, events, summary, daily logs, metadata and assumptions |

Planning requests require JSON and the CSRF cookie/token from `/api/config` (`X-CSRFToken` header). The browser handles this automatically.

```json
{
  "sample": true,
  "cycle_hours": 0,
  "departure": "2026-09-21T08:00",
  "time_zone": "America/Chicago",
  "details": {"driver": "Sample driver", "carrier": "Sample carrier"}
}
```

For live routes set `sample` to `false` and supply exactly three `places` objects, each with a `label` and `[longitude, latitude]` coordinates returned from location search. Supported input bounds cover the contiguous US. Departure years are limited to 2020–2100 and requests to 32 KB; routes exceeding 300 driving hours must be split.

## Verify

```sh
.venv/bin/python backend/manage.py test planner -v 2
npm --prefix frontend run build
```

The tests cover the walkthrough's short trip, pickup qualifying as a break, dedicated break, combined fuel/break, daily rest, 69/70-hour cycle boundaries, unloading past a limit, exact arrivals, equal locations, 14-hour window stress, midnight mileage, daylight-saving logs, deterministic long-route invariants, CSRF and validation. Provider calls are mocked in adapter tests; live routing still requires a real key for end-to-end validation.

Browser acceptance: generate the sample, verify 1,020 mi / 30h 30m / two sheets, select a rest marker, inspect both log days, print both sheets, and repeat at a narrow viewport. Change cycle usage to 70 to inspect a restart and a full off-duty day. Try invalid inputs and missing-key live mode.

Verified locally: 21 backend tests, TypeScript/Vite production build, Django production configuration checks, desktop sample generation, both daily log sheets, the 70-hour restart case, and a 390px mobile layout without page overflow. Chromium PDF export produces two sample pages and four restart pages; rendered pages were visually reviewed. The Linux AMD64 image `spotter-planner:v1` builds and passes the HTTP container smoke checks. Production HTTPS must still be checked on the hosted URL.

Run `python3 scripts/smoke.py https://YOUR-HOST --live` after deployment. Omit `--live` to check sample generation, daily totals, restart, invalid input, CSRF, frontend, and health without provider credentials. The live check also geocodes three cities and requests real routes, consuming ORS quota. See [SUBMISSION.md](SUBMISSION.md) for the timed Loom script and submission template.

## Deploy as one service

The Docker image builds React and serves it alongside the API through Django, WhiteNoise, and Gunicorn. A single origin avoids CORS and separate-service configuration.

```sh
docker build -t spotter-planner .
docker run --rm -p 8000:8000 --env-file .env.production spotter-planner
```

Create `.env.production` outside version control, with:

```dotenv
DEBUG=0
SECRET_KEY=<a long random value>
ALLOWED_HOSTS=<your deployment hostname>
CSRF_TRUSTED_ORIGINS=https://<your deployment hostname>
ORS_API_KEY=<your key>
SECURE_SSL_REDIRECT=1
```

Use an HTTPS-terminating host with trusted proxy headers; disable SSL redirect only for a local HTTP container test. Hosts can provide `PORT`; the default is 8000. Run `python backend/manage.py check --deploy` with production settings before launch. No database attachment is needed.

For Lightsail, build with `docker build --platform linux/amd64 -t spotter-planner:v1 .`, expose container HTTP port 8000, and set the public endpoint health path to `/api/health`. This path is exempt from HTTPS redirection for internal probes. All application routes still follow `SECURE_SSL_REDIRECT`. Set host and trusted-origin values to the actual Lightsail domain. Local smoke checks use `DEBUG=1`; do not use that setting publicly.

For a non-Docker Python deployment, run the frontend build, install `backend/requirements.txt`, run `python backend/manage.py collectstatic --noinput`, and start `gunicorn --chdir backend config.wsgi:application --bind 0.0.0.0:8000 --workers 2 --threads 4 --timeout 90`. Set the same environment variables.

Source is published at https://github.com/neoNEMES1S/spotter-assignment. Configuring a public host and validating real route credentials remain deployment steps. This repository does not claim an existing public deployment.

## Suggested 3–5 minute Loom

- **0:00–0:30:** Explain inputs, initial shift assumption, and aggregate-cycle limitation.
- **0:30–1:45:** Generate a route, show rest/fuel reasons, and compare driving time with trip duration.
- **1:45–2:30:** Inspect both daily log sheets and print preview.
- **2:30–3:30:** Walk through `schedule()` and `daily_logs()`; explain why all views share one timeline.
- **3:30–4:15:** Run tests and point out live routing configuration and deliberately excluded exceptions.
