import { useState } from "react";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import type { DailyLog, Plan, Status } from "../types";
import { activityLabel, duration, miles, time } from "../types";

const rows: { status: Status; label: string }[] = [
  { status: "OFF_DUTY", label: "Off duty" },
  { status: "SLEEPER", label: "Sleeper berth" },
  { status: "DRIVING", label: "Driving" },
  { status: "ON_DUTY", label: "On duty (not driving)" },
];

function Sheet({
  log,
  plan,
  index,
}: {
  log: DailyLog;
  plan: Plan;
  index: number;
}) {
  const x = (seconds: number) => 150 + (seconds / log.seconds) * 720;
  const y = (status: Status) =>
    68 + rows.findIndex((r) => r.status === status) * 42;
  const path = log.events
    .map(
      (e, i) =>
        `${i === 0 ? `M${x(e.start_second)},${y(e.status)}` : `L${x(e.start_second)},${y(e.status)}`} L${x(e.end_second)},${y(e.status)}`,
    )
    .join(" ");
  const details = plan.details;
  const field = (label: string, value: string) => (
    <div className="log-field">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
  return (
    <article className="log-sheet">
      <div className="log-title">
        <div>
          <span className="eyebrow">PROPERTY-CARRYING · 70 HOURS / 8 DAYS</span>
          <h2>Driver’s daily log</h2>
          <p>
            Planned record ·{" "}
            {plan.sample ? "illustrative sample" : "estimated trip schedule"}
          </p>
        </div>
        <div className="log-date">
          <strong>{log.date}</strong>
          <span>
            Sheet {index + 1} of {plan.logs.length}
          </span>
        </div>
      </div>
      <div className="log-fields">
        {field("Driver", details.driver)}
        {field("Carrier", details.carrier)}
        {field("Vehicle / trailer", details.vehicle)}
        {field("Trip origin", plan.places[0].label)}
        {field("Trip destination", plan.places[2].label)}
        {field("Miles driven today", miles(log.meters))}
        {field("Main office", details.office)}
        {field("Home terminal", details.terminal)}
        {field("Co-driver", details.codriver)}
      </div>
      <div className="log-grid-scroll">
        <svg
          className="log-grid"
          viewBox="0 0 965 255"
          role="img"
          aria-label={`Duty status graph for ${log.date}: ${rows.map((r) => `${r.label} ${duration(log.totals[r.status])}`).join(", ")}`}
        >
          <rect
            x="150"
            y="47"
            width="720"
            height="168"
            fill="#fff"
            stroke="#a9b4b0"
          />
          {rows.map((r, i) => (
            <g key={r.status}>
              <text
                x="137"
                y={y(r.status) + 4}
                textAnchor="end"
                fontSize="12"
                fill="#384b43"
              >
                {i + 1}. {r.label}
              </text>
              <line
                x1="150"
                x2="870"
                y1={47 + i * 42}
                y2={47 + i * 42}
                stroke="#a9b4b0"
              />
              <text x="890" y={y(r.status) + 4} fontSize="13" fill="#193e32">
                {(log.totals[r.status] / 3600).toFixed(2)}
              </text>
            </g>
          ))}
          {Array.from({ length: log.seconds / 900 + 1 }, (_, i) => (
            <line
              key={i}
              x1={x(i * 900)}
              x2={x(i * 900)}
              y1="47"
              y2="215"
              stroke={i % 4 === 0 ? "#b4bdb8" : "#e6ebe8"}
              strokeWidth={i % 4 === 0 ? 1 : 0.6}
            />
          ))}
          {log.hours.map((h) => (
            <text
              key={h.second}
              x={x(h.second)}
              y="32"
              textAnchor="middle"
              fontSize="10"
              fill="#576b61"
            >
              {h.label.slice(0, 2)}
            </text>
          ))}
          <text x="890" y="32" fontSize="10" fill="#576b61">
            HOURS
          </text>
          <path
            d={path}
            stroke="#173e32"
            strokeWidth="2.8"
            fill="none"
            strokeLinejoin="round"
          />
          <text x="150" y="241" fontSize="11" fill="#576b61">
            Home-terminal time · {plan.time_zone}
          </text>
          <text x="890" y="241" fontSize="12" fontWeight="600">
            Σ {log.seconds / 3600}h
          </text>
        </svg>
      </div>
      {log.seconds !== 86400 && (
        <p className="log-note">
          Clock-change day: {log.seconds / 3600} elapsed hours. The grid uses
          elapsed time with local hour labels; repeated or skipped hours reflect
          daylight saving.
        </p>
      )}
      <div className="remarks-heading">
        <h3>Remarks & duty changes</h3>
        <span>Shipping document: {details.shipping || "Not provided"}</span>
      </div>
      <table className="remarks">
        <thead>
          <tr>
            <th>Time</th>
            <th>Activity</th>
            <th>Location / remarks</th>
          </tr>
        </thead>
        <tbody>
          {log.events.map((event, i) => (
            <tr key={i}>
              <td>
                {time(
                  new Date(
                    new Date(log.start).getTime() + event.start_second * 1000,
                  ).toISOString(),
                  plan.time_zone,
                )}
              </td>
              <td>
                {activityLabel[event.activity]}
                {event.continued ? " (continued)" : ""}
              </td>
              <td>
                {event.location}
                {event.reason ? ` · ${event.reason}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="log-footer">
        <p>
          Prior-day recap: unavailable from aggregate cycle input. Off-duty time
          outside the trip is assumed. Approximate stops require facility
          verification.
        </p>
        <span>
          Driver certification: __________________
          <br />
          <small>Unsigned · planned activity only</small>
        </span>
      </div>
    </article>
  );
}

export default function DailyLogSheet({ plan }: { plan: Plan }) {
  const [selected, setSelected] = useState(0);
  const day = Math.min(selected, plan.logs.length - 1);
  return (
    <div className="logs-section">
      <div className="section-heading no-print">
        <div>
          <h2>Your daily log sheets</h2>
          <p>One continuous record, across every day.</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => window.print()}
        >
          <Printer size={15} />
          Print all logs
        </button>
      </div>
      <div className="log-pagination no-print">
        <button
          type="button"
          aria-label="Previous log day"
          disabled={day === 0}
          onClick={() => setSelected(day - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <select
          aria-label="Log day"
          value={day}
          onChange={(e) => setSelected(Number(e.target.value))}
        >
          {plan.logs.map((log, i) => (
            <option key={log.date} value={i}>
              Day {i + 1} · {log.date}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Next log day"
          disabled={day === plan.logs.length - 1}
          onClick={() => setSelected(day + 1)}
        >
          <ChevronRight size={18} />
        </button>
        <span>
          {plan.logs.length} sheets · {plan.time_zone}
        </span>
      </div>
      {plan.logs.map((log, i) => (
        <div
          key={log.date}
          className={`print-sheet ${i === day ? "" : "screen-hidden"}`}
        >
          <Sheet log={log} plan={plan} index={i} />
        </div>
      ))}
    </div>
  );
}
