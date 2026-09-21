# Spotter full stack assignment implementation plan

Build a Django API and React application that turns a three-location trip into a route, a duty schedule, and completed daily log sheets. The backend calculates one schedule; the map, itinerary, and logs all render that same result. Prioritize scheduling accuracy and readable logs, then polish the presentation and deploy early enough to test the actual hosted application.

This is a plan only. The workspace was empty when reviewed; there is no existing implementation to preserve.

## 1. Requirements from the assessment

| Area | Required behavior |
| --- | --- |
| Stack | Django backend and React frontend |
| Inputs | Current location, pickup location, dropoff location, current cycle used in hours |
| Route | Map, route instructions, and information about stops and rests; use a free map API |
| Logs | Draw and fill daily log sheets, producing multiple sheets for longer trips |
| Driver | Property-carrying driver using 70 hours over 8 days; no adverse driving conditions |
| Service | One hour at pickup and one hour at dropoff |
| Fuel | Fuel at least once every 1,000 miles |
| Submission | Public hosted application, GitHub repository, and a 3–5 minute Loom walkthrough of the app and code |
| Evaluation | Output accuracy and good UI/UX |

The highlighted contents image identifies the relevant HOS and logging material. The blank paper log defines the visual structure: trip information, four duty rows, a 24-hour grid, remarks, status totals, and recap fields. The guide's completed example on pages 18–19 helps validate how those pieces fit together.

## 2. Explicit assumptions

The four required inputs do not describe a driver's complete duty history. Make the following defaults visible in an expandable “Planning assumptions” area and include them in the API response and README.

| Missing information | Proposed decision |
| --- | --- |
| Today's driving and duty already used | Driver starts a fresh shift after at least 10 consecutive hours off duty. Current cycle used still carries forward. |
| Departure date and time | Add an optional departure control with a visible default of 08:00 on the selected date. |
| Log time zone | Add an optional home-terminal time zone, visibly defaulting to America/Chicago. All log pages use this zone, including when the route crosses zones. |
| Previous daily on-duty totals | Do not invent rolling recap credits. Carry the supplied cycle usage forward conservatively and take a 34-hour restart when further driving is blocked. Explain that this may produce a longer schedule than a complete history would allow. |
| Fuel at departure and fueling duration | Start with a full tank; plan 30 minutes of on-duty fueling no later than every 1,000 route miles. Distance carries across pickup and daily rests. |
| Rest status | Use off duty for planned rest. Show the sleeper berth row, but do not claim sleeper use without that assumption being selected. |
| Before departure and after completion | Fill those portions of the first and last log days as assumed off duty; identify them as assumptions. |
| Carrier, truck, driver, shipping details | Offer optional log details. Fill supplied values; mark unavailable fields as not provided rather than fabricating them. Leave signature/certification unsigned. |
| Geographic scope | Contiguous-US trips under the supplied federal rule set. Reject unsupported or non-routable locations clearly. |

Do not require a full eight-day history for the assessed flow. If exact rolling recap becomes a requirement, add prior daily duty totals as an explicit input and calculate expiry at terminal-day boundaries. Aggregate cycle usage alone cannot reconstruct those totals.

These outputs are planned log sheets, not recorded driving activity or a certified ELD. Label them “Planned driver daily log.”

## 3. Small architecture

Use React with TypeScript and Vite, Django with ordinary JSON views, Leaflet for the map, and SVG for the daily log grid. Use Django's existing facilities for request handling and testing; a REST framework is unnecessary for two small endpoints.

Start with no saved-trip database, login, background jobs, Redis, or separate PDF service. A synchronous request is sufficient for route lookup and an in-memory schedule. Print CSS and browser “Save as PDF” cover export.

Suggested files:

```text
backend/
  config/                 Django settings and URL configuration
  planner/
    views.py              Validation and JSON endpoints
    routing.py            Provider calls and route normalization
    scheduler.py          Pure scheduling logic
    logs.py               Split events into terminal log days
    tests.py              Deterministic scheduling and API checks
frontend/
  src/
    App.tsx
    api.ts
    types.ts
    components/
      TripForm.tsx
      RouteMap.tsx
      TripTimeline.tsx
      DailyLogSheet.tsx
    styles.css
README.md
```

The important separation is external routing versus deterministic scheduling. There is no need for repositories, service registries, or generic provider interfaces.

## 4. Routing and location lookup

Use openrouteservice as the initial free-tier candidate for geocoding and directions. Its official services include both capabilities. Confirm that the account's available profile, quota, and route limits support the demo routes before building around it. Current published driving-route limits are 6,000 km per request; request the two trip legs separately and handle limits explicitly.

1. Search locations through Django and have the user select a named result with coordinates. Use a search button or debounced requests, clear attribution, and no arbitrary first-result selection.
2. Request current location → pickup and pickup → dropoff, preserving route geometry, road distance, duration, and maneuver instructions.
3. Prefer the provider's available heavy-vehicle profile. Do not imply vehicle-specific clearance validation when dimensions, weight, and cargo restrictions have not been supplied.
4. Normalize each route into ordered segments with distance, duration, and geometry references. Use segment travel estimates rather than straight-line distances or one arbitrary speed for the entire journey.
5. Interpolate planned stop coordinates along route geometry using accumulated travel time and distance. Resolve a nearby city/state for remarks where available; identify approximate locations as such.
6. Distinguish calculated stop points from verified fuel stations or legal overnight parking. The assignment's first version can show approximate planning stops; actual facility selection and detour recalculation are separate work.

Keep API keys on the backend. Apply input limits, request timeouts, bounded retries for transient errors, and actionable messages for no route, ambiguity, quota exhaustion, and provider failure. Never replace a failed route with invented mileage. Choose a tile service with terms appropriate for the hosted demo and display required attribution.

## 5. HOS scheduling rules

Implement the normal property-carrier rules described in the supplied guide, with no short-haul, adverse-condition, personal-conveyance, or split-sleeper exceptions.

| Rule | Implementation |
| --- | --- |
| 11-hour driving limit | Allow at most 11 driving hours between qualifying daily rests. |
| 14-hour window | Start on the first on-duty event after qualifying rest. Elapsed time includes short breaks; midnight does not reset it. |
| 30-minute break | Before driving beyond 8 cumulative driving hours since a qualifying interruption, require at least 30 consecutive minutes without driving. Pickup, dropoff, or fueling can qualify while still being on duty. |
| 10-hour rest | At least 10 consecutive hours off duty resets shift driving and the 14-hour window; it does not reset cycle usage. |
| 70-hour cycle | Count both driving and on-duty work. Block further driving at the limit. Under the aggregate-history assumption, restart instead of inventing recap credits. |
| 34-hour restart | At least 34 consecutive hours off duty resets cycle usage and also satisfies daily rest. Do not stack an additional 10 hours on it. |
| Pickup and dropoff | Add one uninterrupted hour of on-duty, non-driving work at each. |
| Fuel | Add 30 minutes on duty at or before each 1,000-mile interval; reset fuel distance only after fueling. |

The 11-, 14-, and 70-hour limits restrict driving, not all other work. Final unloading may finish after a driving limit; count it correctly and do not add unnecessary rest before it. A break is unnecessary at the end of the trip if there is no subsequent driving.

Use an event-driven loop, not a minute-by-minute simulation:

1. Track shift start, driving since daily rest, driving since qualifying interruption, cycle duty used, and distance since fueling.
2. Before driving, choose the earliest boundary: leg arrival, 11-hour allowance, 14-hour window end, 8-hour driving-break threshold, cycle allowance, or fuel threshold.
3. Emit a driving event ending at that boundary, with its route position and distance.
4. Process required service work or add the appropriate rest. Combine requirements when possible: fueling can satisfy a break, and a 34-hour restart satisfies daily rest.
5. Continue until dropoff service is complete. Every loop must advance time, route progress, or the pending activity; test zero-length legs and simultaneous limits.

Use integer seconds internally and preserve route distances at sufficient precision. Round only for display; do not round duration down in a way that creates extra available driving time. Use timezone-aware timestamps and explicitly test daylight-saving transitions rather than silently treating every local date as 86,400 elapsed seconds.

## 6. API and shared event model

Provide `GET /api/locations?q=...` for location search and `POST /api/trips/plan` for planning. A small health endpoint supports deployment checks.

The planning request includes the three selected coordinate/name pairs and cycle hours, plus optional departure, terminal time zone, and log details. Validate finite coordinates, valid dates/zones, non-empty locations, and numeric cycle usage between 0 and 70 inclusive. Return field-level validation errors.

The response contains:

- Route geometry, two route legs, distances, driving durations, and maneuver instructions.
- Ordered events with start/end timestamps, duty status, activity, location, route position, distance, and reason for a rest.
- Summary totals, departure, pickup arrival, dropoff arrival, and completion after unloading.
- Daily log projections with status totals, mileage, remarks, and known metadata.
- Assumptions and limitations actually used for this plan.

Keep activity and duty status separate: `fuel` is an activity with `ON_DUTY` status; `daily_rest` has `OFF_DUTY` status. The frontend never recalculates HOS eligibility.

## 7. Daily log sheets

Recreate the supplied blank sheet as readable HTML and SVG rather than drawing over its low-resolution raster image. Preserve its recognizable four rows and paper-log structure.

- Draw hourly labels and 15-minute ticks, with horizontal duty lines and vertical transitions. Plot exact event positions rather than snapping calculations to ticks.
- Split events at home-terminal midnight without resetting HOS counters. Preserve continuity across pages and include full off-duty days during long rest periods.
- Fill date, from/to locations, daily driving miles, available driver/carrier/vehicle/shipment details, and four status totals.
- Add time, activity, and location remarks for each change. Do not fabricate a town from coordinates if lookup fails.
- Show cycle used and remaining allowance under the stated conservative policy. Mark historical recap cells unavailable when the input cannot determine them.
- For ordinary days, verify all status durations total 24 hours and cover the day without gaps or overlaps. Handle and label terminal daylight-saving transition days explicitly; keep elapsed HOS math separate from wall-clock display.
- Make every sheet printable on its own page. Verify long remarks, page breaks, monochrome readability, and route-mile totals across days.

Retain the SVG as the source for display and print, so a separate PDF drawing engine cannot drift from the screen output.

## 8. User experience

Use one primary workflow: enter trip → select location matches → generate plan → inspect map and itinerary → inspect/print logs.

On desktop, place the form beside the map; show a compact trip summary above itinerary and log tabs. On mobile, stack these sections and allow the log grid to scroll without making the whole page overflow.

Use distinguishable markers for start, pickup, dropoff, fueling, breaks, and restarts. Clicking an itinerary event should highlight its map marker. Every rest should explain its reason in plain language, such as “10-hour rest: driving limit reached.”

Include a sample-trip action, useful empty and loading states, field errors, keyboard-accessible controls, readable contrast, and explicit units. Visually distinguish driving time from total trip duration and dropoff arrival from completion. Prevent stale responses from replacing a newer plan.

## 9. Verification and acceptance

Keep deterministic backend tests independent of routing API availability. Use synthetic route segments and the standard Django/Python test runner. Check at least these cases:

| Case | Expected result |
| --- | --- |
| 2 hours to pickup + 3 hours to dropoff, cycle starts at 0 | 5 driving hours + 2 service hours; completion 7 hours after departure; no inserted break required |
| Pickup after 7 driving hours | The 1-hour pickup resets the break-driving counter, but not the 11-hour shift total |
| More than 8 uninterrupted driving hours | Insert a qualifying interruption before the excess driving |
| Shift reaches 11 driving hours | Rest 10 hours before more driving, even if before midnight |
| Elapsed shift reaches 14 hours first | Stop driving and obtain qualifying rest |
| Cycle starts at 69 or 70 hours | Never drive beyond available cycle allowance; use a 34-hour restart when needed |
| Route exceeds 1,000 miles across both legs | Fuel-distance counter carries through pickup and daily rests; no interval exceeds the threshold |
| Fuel and break thresholds coincide | One 30-minute on-duty fuel event satisfies both |
| Rest crosses midnight or covers a whole day | Correct sheets and continuous duty timeline |
| Arrival exactly matches a limit | No zero-duration events, infinite loops, or unnecessary end-of-trip break |
| Equal adjacent locations | Zero driving leg handled; pickup and dropoff service still occur |
| Invalid input or external API failure | Clear error, no invented plan |

Add invariants over every generated schedule: positive event durations, no overlaps, conserved route mileage, valid driving windows, proper cycle accounting, correct service durations, and consistency between daily logs and the main timeline. Use a focused browser check for form → map → multi-day logs → print, including a narrow viewport.

Use the guide's completed log as a rendering/accounting check: off duty 10 hours, sleeper berth 1.75, driving 7.75, and on duty 4.5 sum to 24. It is a display fixture, not a schedule the default off-duty-only planner must generate.

## 10. Build sequence and effort

| Phase | Work and completion condition | Estimate |
| --- | --- | --- |
| 1 | Scaffold Django/React, validate routing credentials and sample routes, deploy a minimal connected page | 0.5 day |
| 2 | Implement pure scheduler, assumptions, boundary checks, and deterministic tests | 1–1.5 days |
| 3 | Integrate route geometry, instructions, event locations, map, and itinerary | 0.5–1 day |
| 4 | Build daily sheet SVG, metadata, multi-day splitting, and print layout | 1 day |
| 5 | Polish responsive states, run hosted acceptance cases, finish README and record Loom | 0.5–1 day |

Estimated focused effort: 3.5–5 days, assuming routing credentials and hosting are available. Scheduling accuracy and log rendering are the critical path.

Deploy the React build to a static host such as Vercel and Django to a Python-capable service, or serve the built frontend from the Django deployment if that is simpler for the chosen host. Confirm current hosting terms and cold-start behavior during Phase 1; the assessment does not require Vercel specifically. Configure HTTPS, allowed hosts, explicit frontend origins, environment secrets, and production error handling. Verify the live URL from a fresh browser session.

The README should provide setup commands, environment variable names, test commands, API shape, HOS decisions, routing limitations, assumptions, and the live URL. Do not commit credentials.

Suggested Loom sequence: 30 seconds introducing the inputs and assumptions; 90 seconds generating and explaining a multi-day route and its logs; 60 seconds on the scheduler and shared event model; 30–60 seconds running tests and explaining the aggregate-cycle limitation. Keep it within 3–5 minutes.

## 11. Scope boundary

Deliver all assessed features before adding accounts, saved trips, fleet dashboards, actual ELD integrations, certified logs, dispatch optimization, split-sleeper optimization, or verified truck-stop search. Accurate historical recap requires more input; verified fuel/rest facilities require facility data and routing detours. Those are explicit extensions, not hidden claims in the first version.

## References

- Supplied `new-full-stack-dev-assessment.docx`: required stack, features, assumptions, and deliverables.
- Supplied `fmsca-image.png`: highlighted reading scope.
- Supplied `blank-paper-log.png`: daily-sheet layout reference.
- Supplied April 2022 FMCSA driver guide: pages 5–11 for normal duty rules and pages 14–19 for logging and completed examples.
- [FMCSA current summary of HOS regulations](https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations): cross-check of the core limits.
- [openrouteservice services](https://openrouteservice.org/services/) and [API restrictions](https://openrouteservice.org/restrictions/): routing/geocoding capabilities and request limits, checked September 19, 2026.
