import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  Gauge,
  Info,
  LoaderCircle,
  Map,
  Navigation,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { api, ApiError } from "./api";
import type { Config, Place, Plan } from "./types";
import { dateTime, duration, miles } from "./types";
import LocationInput from "./components/LocationInput";
import RouteMap from "./components/RouteMap";
import TripTimeline from "./components/TripTimeline";
import DailyLogSheet from "./components/DailyLogSheet";

const timeZones = [
  "America/Chicago",
  "America/New_York",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
];
const defaultPlaces: Place[] = [
  { label: "Chicago, IL", coordinates: [-87.6298, 41.8781] },
  { label: "Indianapolis, IN", coordinates: [-86.1581, 39.7684] },
  { label: "Dallas, TX", coordinates: [-96.797, 32.7767] },
];
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [sample, setSample] = useState(true);
  const [places, setPlaces] = useState<(Place | null)[]>(defaultPlaces);
  const [cycle, setCycle] = useState("0");
  const [departure, setDeparture] = useState(`${today}T08:00`);
  const [zone, setZone] = useState("America/Chicago");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tab, setTab] = useState("route");
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    api<Config>("/api/config", { signal: controller.signal })
      .then(setConfig)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, []);
  function changeMode(isSample: boolean) {
    setSample(isSample);
    setPlaces(
      isSample ? config?.sample_places || defaultPlaces : [null, null, null],
    );
    setDirty(true);
    setFields({});
    setError("");
  }
  async function generate(forceSample = false) {
    const isSample = forceSample || sample;
    if (!isSample && places.some((p) => !p)) {
      setFields({
        places: "Search for and select each of the three locations.",
      });
      return;
    }
    if (
      !Number.isFinite(Number(cycle)) ||
      cycle.trim() === "" ||
      Number(cycle) < 0 ||
      Number(cycle) > 70
    ) {
      setFields({ cycle_hours: "Enter cycle hours between 0 and 70." });
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    if (forceSample) {
      setSample(true);
      setPlaces(config?.sample_places || defaultPlaces);
    }
    setBusy(true);
    setError("");
    setFields({});
    try {
      const currentConfig = config || (await api<Config>("/api/config"));
      setConfig(currentConfig);
      const result = await api<Plan>("/api/trips/plan", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": currentConfig.csrf_token,
        },
        body: JSON.stringify({
          sample: isSample,
          places,
          cycle_hours: Number(cycle),
          departure,
          time_zone: zone,
          details,
        }),
      });
      setPlan(result);
      setTab("route");
      setSelected(null);
      setDirty(false);
    } catch (e) {
      if (!controller.signal.aborted) {
        setError((e as Error).message);
        if (e instanceof ApiError) setFields(e.fields);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const summary = plan?.summary;
  return (
    <>
      <header className="app-header">
        <a className="brand" href="/" aria-label="Spotter home">
          <span className="brand-symbol">
            <Navigation size={22} fill="currentColor" />
          </span>
          spotter<span className="brand-period">.</span>
        </a>
        <div className="header-divider" />
        <span className="header-page">Trip planner</span>
        <div className="header-right">
          <span className="header-tag">
            <span className="live-dot" />
            Built for the long haul
          </span>
          <button
            className="help-button"
            type="button"
            aria-label="How it works"
            onClick={() => dialog.current?.showModal()}
          >
            <CircleHelp size={17} />
            <span>How it works</span>
          </button>
        </div>
      </header>
      <main>
        <div className="page-intro">
          <div>
            <div className="eyebrow">
              <span />A CLEARER ROAD AHEAD
            </div>
            <h1>Good trips start with a plan.</h1>
            <p>Your route, required rests, and daily logs. All in one place.</p>
          </div>
          <span className="rule-badge">
            <ShieldCheck size={18} />
            <span>
              Property-carrying
              <br />
              <strong>70-hour / 8-day cycle</strong>
            </span>
          </span>
        </div>
        <div className="workspace">
          <aside className="planner-card">
            <div className="form-heading">
              <div className="heading-icon">
                <Route size={19} />
              </div>
              <div>
                <h2>Plan your trip</h2>
                <p>A few details. A better journey.</p>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void generate();
              }}
              onChange={() => setDirty(true)}
            >
              <fieldset disabled={busy} className="form-fieldset">
                <div className="mode-switch" aria-label="Routing mode">
                  <button
                    type="button"
                    className={sample ? "active" : ""}
                    aria-pressed={sample}
                    onClick={() => changeMode(true)}
                  >
                    Sample trip
                  </button>
                  <button
                    type="button"
                    className={!sample ? "active" : ""}
                    aria-pressed={!sample}
                    onClick={() => changeMode(false)}
                  >
                    Your route
                  </button>
                </div>
                {!sample && config && !config.live_routing && (
                  <div className="inline-notice">
                    <Info size={15} />
                    <p>
                      Live routing needs a server API key. You can explore every
                      feature with the sample trip.
                    </p>
                  </div>
                )}
                <div className="location-stack">
                  {[
                    "Current location",
                    "Pickup location",
                    "Dropoff location",
                  ].map((label, i) => (
                    <LocationInput
                      key={`${sample}-${i}`}
                      label={label}
                      number={String.fromCharCode(65 + i)}
                      value={places[i]}
                      readonly={sample}
                      error={fields[`place_${i}`]}
                      onChange={(p) => {
                        setPlaces((previous) =>
                          previous.map((v, j) => (i === j ? p : v)),
                        );
                        setDirty(true);
                      }}
                    />
                  ))}
                </div>
                {fields.places && (
                  <p className="field-error" role="alert">
                    {fields.places}
                  </p>
                )}
                <div className="form-divider" />
                <label className="field-label" htmlFor="cycle">
                  Current cycle used
                  <span className="optional-label">70h maximum</span>
                </label>
                <div className="number-input">
                  <Gauge size={17} />
                  <input
                    id="cycle"
                    type="number"
                    min="0"
                    max="70"
                    step="any"
                    required
                    value={cycle}
                    onChange={(e) => setCycle(e.target.value)}
                    aria-invalid={!!fields.cycle_hours}
                  />
                  <span>hours</span>
                </div>
                {fields.cycle_hours && (
                  <small className="field-error">{fields.cycle_hours}</small>
                )}
                <div className="cycle-track">
                  <span
                    style={{
                      width: `${Math.max(0, Math.min(100, (Number(cycle) / 70) * 100))}%`,
                    }}
                  />
                </div>
                <p className="cycle-hint">
                  <strong>
                    {Math.max(0, 70 - (Number(cycle) || 0)).toFixed(1)}h
                  </strong>{" "}
                  available before cycle limit
                </p>
                <details className="form-details">
                  <summary>
                    Departure & log details
                    <ChevronDown size={15} />
                  </summary>
                  <div className="details-content">
                    <label className="field-label" htmlFor="departure">
                      Departure in terminal time
                    </label>
                    <input
                      className="text-input"
                      id="departure"
                      type="datetime-local"
                      required
                      value={departure}
                      onChange={(e) => setDeparture(e.target.value)}
                    />
                    {fields.departure && (
                      <small className="field-error">{fields.departure}</small>
                    )}
                    <label className="field-label" htmlFor="zone">
                      Home-terminal time zone
                    </label>
                    <select
                      className="text-input"
                      id="zone"
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                    >
                      {timeZones.map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </select>
                    {Object.entries({
                      driver: "Driver name",
                      carrier: "Carrier name",
                      office: "Main office address",
                      terminal: "Home terminal",
                      vehicle: "Truck / trailer number",
                      shipping: "Shipping document",
                      codriver: "Co-driver",
                    }).map(([key, label]) => (
                      <div key={key}>
                        <label className="field-label" htmlFor={key}>
                          {label}
                          <span className="optional-label">Optional</span>
                        </label>
                        <input
                          className="text-input"
                          id={key}
                          maxLength={200}
                          value={details[key] || ""}
                          onChange={(e) =>
                            setDetails({ ...details, [key]: e.target.value })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </details>
                {fields.details && (
                  <p className="field-error">{fields.details}</p>
                )}
                <button
                  className="primary-button"
                  type="submit"
                  disabled={busy || (!sample && !config?.live_routing)}
                >
                  {busy ? (
                    <>
                      <LoaderCircle size={17} className="spin" />
                      Planning your route…
                    </>
                  ) : (
                    <>
                      Generate trip plan
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
                <p className="form-footnote">
                  <ShieldCheck size={13} />
                  Breaks and daily logs included
                </p>
              </fieldset>
            </form>
            <div className="assumption-card">
              <span className="eyebrow">A NOTE BEFORE YOU GO</span>
              <p>
                We start with a fresh shift and a full tank. Your prior cycle
                hours carry forward.
              </p>
              <button type="button" onClick={() => dialog.current?.showModal()}>
                View planning assumptions <ArrowRight size={13} />
              </button>
            </div>
          </aside>
          <section
            className="results"
            aria-label="Trip results"
            aria-busy={busy}
          >
            {error && (
              <div className="error-banner" role="alert">
                <Info size={18} />
                <div>
                  <strong>We couldn’t plan that trip</strong>
                  <p>{error}</p>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss error"
                  onClick={() => setError("")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {dirty && plan && (
              <div className="stale-banner">
                <Info size={15} />
                Details changed. Generate a new plan to update these results.
              </div>
            )}
            <div className="results-topline">
              <div
                className="view-tabs"
                role="tablist"
                aria-label="Result view"
              >
                <button
                  id="route-tab"
                  role="tab"
                  aria-controls="route-panel"
                  aria-selected={tab === "route"}
                  onClick={() => setTab("route")}
                >
                  <Map size={16} />
                  Route overview
                </button>
                <button
                  id="logs-tab"
                  role="tab"
                  aria-controls="logs-panel"
                  aria-selected={tab === "logs"}
                  onClick={() => setTab("logs")}
                >
                  <FileText size={16} />
                  Daily logs{plan && <span>{plan.logs.length}</span>}
                </button>
              </div>
              <span className="result-status">
                {busy ? (
                  "Calculating…"
                ) : plan ? (
                  <>
                    <Check size={13} />
                    Plan ready
                  </>
                ) : (
                  "Ready when you are"
                )}
              </span>
            </div>
            <div
              role="tabpanel"
              id="route-panel"
              aria-labelledby="route-tab"
              className={tab === "route" ? "" : "screen-hidden"}
            >
              <RouteMap plan={plan} selected={selected} />
              {plan && summary ? (
                <>
                  <div className="metrics">
                    <div>
                      <span>
                        <Route size={14} />
                        TOTAL DISTANCE
                      </span>
                      <strong>
                        {miles(summary.meters)} <small>mi</small>
                      </strong>
                    </div>
                    <div>
                      <span>
                        <Clock3 size={14} />
                        TRIP DURATION
                      </span>
                      <strong>{duration(summary.elapsed_seconds)}</strong>
                    </div>
                    <div>
                      <span>
                        <Truck size={14} />
                        DRIVING TIME
                      </span>
                      <strong>{duration(summary.driving_seconds)}</strong>
                    </div>
                    <div>
                      <span>
                        <FileText size={14} />
                        DAILY LOGS
                      </span>
                      <strong>
                        {plan.logs.length} <small>sheets</small>
                      </strong>
                    </div>
                  </div>
                  <div className="result-caption">
                    <Info size={13} />
                    {plan.sample
                      ? "Illustrative sample route. Travel times and geometry are not live navigation."
                      : "Estimated route. Stop markers are approximate, not verified facilities."}
                  </div>
                  <div className="trip-bottom">
                    <TripTimeline
                      plan={plan}
                      selected={selected}
                      onSelect={(id) => {
                        setSelected(id);
                      }}
                    />
                    <div className="trip-sidebar">
                      <div className="cycle-card">
                        <div className="section-icon">
                          <Gauge size={18} />
                        </div>
                        <h3>Room for the road</h3>
                        <p>Cycle allowance after this trip</p>
                        <strong>
                          {summary.cycle_remaining_hours.toFixed(1)}
                          <span> hours</span>
                        </strong>
                        <div className="cycle-track">
                          <span
                            style={{
                              width: `${Math.min(100, (summary.cycle_used_hours / 70) * 100)}%`,
                            }}
                          />
                        </div>
                        <p>
                          {summary.cycle_used_hours.toFixed(1)} of 70 hours used
                        </p>
                        <div className="cycle-card-footer">
                          <ShieldCheck size={14} />
                          Conservative restart policy
                        </div>
                      </div>
                      <div className="arrival-card">
                        <span className="eyebrow">DELIVERY WINDOW</span>
                        <h3>{dateTime(summary.arrival, plan.time_zone)}</h3>
                        <p>Arrival at {plan.places[2].label}</p>
                        <hr />
                        <p>
                          Unloading complete
                          <br />
                          <strong>
                            {dateTime(summary.completion, plan.time_zone)}
                          </strong>
                        </p>
                        <small>All times: {plan.time_zone}</small>
                      </div>
                    </div>
                  </div>
                  <details className="directions">
                    <summary>
                      <Navigation size={15} />
                      Route instructions
                      <ChevronDown size={15} />
                    </summary>
                    {plan.legs.map((leg, i) => (
                      <div key={i}>
                        <h3>
                          {plan.places[i].label} → {plan.places[i + 1].label}
                        </h3>
                        <ol>
                          {leg.segments.map((step, j) => (
                            <li key={j}>
                              <span>{step.instruction}</span>
                              <small>
                                {(step.meters / 1609.344).toFixed(1)} mi ·{" "}
                                {duration(step.seconds)}
                              </small>
                            </li>
                          ))}
                        </ol>
                        {!leg.segments.length && (
                          <p>Same location. No driving needed.</p>
                        )}
                      </div>
                    ))}
                  </details>
                </>
              ) : (
                <div className="empty-results">
                  <div className="empty-results-copy">
                    <span className="eyebrow">
                      LESS GUESSWORK. MORE OPEN ROAD.
                    </span>
                    <h2>A plan that goes the distance.</h2>
                    <p>
                      See where to stop, when to rest, and how your day adds up.
                    </p>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => generate(true)}
                    >
                      <Sparkles size={15} />
                      Explore a sample trip
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="empty-features">
                    <span>
                      <span className="feature-number">01</span>
                      <div>
                        <strong>A route with a rhythm</strong>
                        <p>Fuel stops and required rest, planned together.</p>
                      </div>
                    </span>
                    <span>
                      <span className="feature-number">02</span>
                      <div>
                        <strong>Logs, already lined up</strong>
                        <p>Clear daily sheets, ready to review and print.</p>
                      </div>
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div
              role="tabpanel"
              id="logs-panel"
              aria-labelledby="logs-tab"
              className={`logs-panel ${tab === "logs" ? "" : "screen-hidden"}`}
            >
              {plan ? (
                <DailyLogSheet
                  key={
                    plan.summary.departure +
                    plan.summary.completion +
                    plan.initial_cycle_hours
                  }
                  plan={plan}
                />
              ) : (
                <div className="logs-empty">
                  <FileText size={35} />
                  <h2>Your logs will appear here.</h2>
                  <p>
                    Generate a trip plan to create a sheet for each day on the
                    road.
                  </p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => generate(true)}
                    disabled={busy}
                  >
                    Try the sample trip
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </div>
            <div className="results-footer">
              <ShieldCheck size={14} />
              <span>
                Planned activity only. Review conditions and facility
                availability before driving.
              </span>
            </div>
          </section>
        </div>
        <footer className="page-footer">
          <span>
            spotter<span className="brand-period">.</span>
            <small>Every mile, considered.</small>
          </span>
          <a
            href="https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"
            target="_blank"
            rel="noreferrer"
          >
            Based on FMCSA hours-of-service rules <ArrowRight size={12} />
          </a>
        </footer>
      </main>
      <dialog ref={dialog} className="help-dialog">
        <div className="dialog-title">
          <span className="heading-icon">
            <ShieldCheck size={23} />
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Close assumptions"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <span className="eyebrow">KNOW YOUR PLAN</span>
        <h2>A few clear assumptions.</h2>
        <p>
          This planner applies the normal property-carrying rules. It estimates
          future activity; it does not certify an ELD record.
        </p>
        <ul>
          {(
            plan?.assumptions || [
              "A fresh shift after 10 hours off duty; current cycle usage carries forward.",
              "Up to 11 driving hours in a 14-hour window; a qualifying interruption before exceeding 8 driving hours.",
              "70 hours / 8 days. A conservative 34-hour restart when cycle allowance runs out; no invented historical recap.",
              "One hour for each pickup and dropoff, a full tank at departure, and 30 minutes to fuel at or before 1,000 miles.",
              "Off-duty rest only; no split-sleeper or other exceptions. All times use the home-terminal zone.",
              "Approximate stop locations, with off-duty time assumed before and after the planned trip.",
            ]
          ).map((a) => (
            <li key={a}>
              <Check size={15} />
              <span>{a}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="primary-button"
          onClick={() => dialog.current?.close()}
        >
          Got it
          <ArrowRight size={16} />
        </button>
      </dialog>
    </>
  );
}
