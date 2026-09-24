# Graph Report - .  (2026-09-23)

## Corpus Check
- Corpus is ~12,995 words - fits in a single context window. You may not need a graph.

## Summary
- 190 nodes · 324 edges · 18 communities (15 shown, 3 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Project Scope and Requirements|Project Scope and Requirements]]
- [[_COMMUNITY_Frontend UI Components|Frontend UI Components]]
- [[_COMMUNITY_Routing and Geography|Routing and Geography]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_HOS Rules and Logs|HOS Rules and Logs]]
- [[_COMMUNITY_Scheduling Engine Tests|Scheduling Engine Tests]]
- [[_COMMUNITY_TypeScript Build Config|TypeScript Build Config]]
- [[_COMMUNITY_API Behavior Tests|API Behavior Tests]]
- [[_COMMUNITY_Frontend App Shell|Frontend App Shell]]
- [[_COMMUNITY_Deployment Smoke Checks|Deployment Smoke Checks]]
- [[_COMMUNITY_Local Development Runner|Local Development Runner]]

## God Nodes (most connected - your core abstractions)
1. `Spotter full stack assignment implementation plan` - 21 edges
2. `schedule()` - 19 edges
3. `Spotter trip planner README` - 19 edges
4. `ScheduleTests` - 17 edges
5. `leg()` - 14 edges
6. `ApiTests` - 12 edges
7. `compilerOptions` - 10 edges
8. `Spotter assessment checklist` - 10 edges
9. `daily_logs()` - 9 edges
10. `RoutingError` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Printable daily log sheets` --semantically_similar_to--> `SVG daily log sheets`  [INFERRED] [semantically similar]
  ASSESSMENT_CHECKLIST.md → IMPLEMENTATION_PLAN.md
- `Shared backend event timeline` --semantically_similar_to--> `Shared backend event timeline`  [INFERRED] [semantically similar]
  IMPLEMENTATION_PLAN.md → README.md
- `SVG daily log sheets` --semantically_similar_to--> `Planned driver daily logs`  [INFERRED] [semantically similar]
  IMPLEMENTATION_PLAN.md → README.md
- `Spotter trip planner README` --references--> `daily_logs()`  [EXTRACTED]
  README.md → backend/planner/logs.py
- `Spotter trip planner README` --references--> `schedule()`  [EXTRACTED]
  README.md → backend/planner/scheduler.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared event timeline outputs** — implementation_plan_shared_event_timeline, implementation_plan_json_api, implementation_plan_daily_log_svg, readme_shared_event_timeline [INFERRED 0.85]
- **Routing and map stack** — assessment_checklist_openrouteservice_routing, implementation_plan_openrouteservice_routing, readme_openstreetmap_tiles [INFERRED 0.75]
- **Submission artifacts** — assessment_checklist_live_hosted_application, submission_hosted_application, submission_github_repository, submission_loom_walkthrough [INFERRED 0.85]

## Communities (18 total, 3 thin omitted)

### Community 0 - "Project Scope and Requirements"
Cohesion: 0.07
Nodes (38): Current cycle used input, Django and React full-stack app, Published GitHub repository, Property-carrier HOS assumptions, Leaflet and OpenStreetMap map, Live hosted application, Local verification suite, 3-5 minute Loom walkthrough (+30 more)

### Community 1 - "Frontend UI Components"
Cohesion: 0.12
Nodes (22): rows, Sheet(), TripTimeline(), api(), ApiError, App(), defaultPlaces, timeZones (+14 more)

### Community 2 - "Routing and Geography"
Cohesion: 0.19
Nodes (14): Exception, daily_logs(), get_leg(), Small openrouteservice adapter. Sample data is explicitly requested, never a fal, request_provider(), RoutingError, sample_legs(), search_locations() (+6 more)

### Community 3 - "Frontend Dependencies"
Cohesion: 0.10
Nodes (20): dependencies, leaflet, lucide-react, react, react-dom, devDependencies, @types/leaflet, @types/react (+12 more)

### Community 4 - "HOS Rules and Logs"
Cohesion: 0.15
Nodes (19): Printable daily log sheets, April 2022 FMCSA driver guide, Blank paper log image, Aggregate cycle history limitation, SVG daily log sheets, Event-driven HOS scheduler, FMCSA current HOS summary, FMCSA highlighted contents image (+11 more)

### Community 5 - "Scheduling Engine Tests"
Cohesion: 0.37
Nodes (4): schedule(), activities(), leg(), ScheduleTests

### Community 6 - "TypeScript Build Config"
Cohesion: 0.17
Nodes (11): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, skipLibCheck (+3 more)

### Community 8 - "Frontend App Shell"
Cohesion: 0.67
Nodes (3): Frontend HTML shell, Route HOS breaks and printable driver logs, React application entrypoint

## Knowledge Gaps
- **51 isolated node(s):** `dev.sh script`, `name`, `private`, `version`, `type` (+46 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Spotter trip planner README` connect `Project Scope and Requirements` to `Routing and Geography`, `HOS Rules and Logs`, `Scheduling Engine Tests`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **Why does `schedule()` connect `Scheduling Engine Tests` to `Project Scope and Requirements`, `Routing and Geography`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `Spotter full stack assignment implementation plan` connect `HOS Rules and Logs` to `Project Scope and Requirements`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **What connects `Small openrouteservice adapter. Sample data is explicitly requested, never a fal`, `Deterministic HOS scheduling. UTC arithmetic; no provider or Django dependency.`, `dev.sh script` to the rest of the system?**
  _56 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Project Scope and Requirements` be split into smaller, more focused modules?**
  _Cohesion score 0.06970128022759602 - nodes in this community are weakly interconnected._
- **Should `Frontend UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.12299465240641712 - nodes in this community are weakly interconnected._
- **Should `Frontend Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._