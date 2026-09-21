import { ArrowDown, Coffee, Fuel, Moon, Package, Truck } from "lucide-react";
import type { Plan } from "../types";
import { activityLabel, dateTime, duration, miles } from "../types";

export default function TripTimeline({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="timeline">
      <div className="section-heading">
        <div>
          <h2>The road ahead</h2>
          <p>Every stop, with time to recharge.</p>
        </div>
        <span className="subtle-pill">{plan.events.length} activities</span>
      </div>
      <ol className="event-list">
        {plan.events.map((event) => {
          const Icon =
            event.activity === "drive"
              ? Truck
              : event.activity === "fuel"
                ? Fuel
                : event.activity === "break"
                  ? Coffee
                  : event.status === "OFF_DUTY"
                    ? Moon
                    : Package;
          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => onSelect(event.id)}
                className={`event ${event.status.toLowerCase()} ${selected === event.id ? "selected" : ""}`}
                aria-pressed={selected === event.id}
              >
                <span className="event-icon">
                  <Icon size={17} />
                </span>
                <span className="event-body">
                  <strong>
                    {activityLabel[event.activity]}
                    {event.status === "DRIVING" && (
                      <span className="event-miles">
                        {miles(event.meters)} mi
                      </span>
                    )}
                  </strong>
                  <span className="event-location">
                    {event.status === "DRIVING"
                      ? event.end_location
                      : event.location}
                  </span>
                  <span className="event-time">
                    {dateTime(event.start, plan.time_zone)}{" "}
                    <ArrowDown size={11} className="inline-arrow" />{" "}
                    {dateTime(event.end, plan.time_zone)}
                  </span>
                  {event.reason && (
                    <span className="event-reason">{event.reason}</span>
                  )}
                </span>
                <span className="event-duration">
                  {duration(event.seconds)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="arrival-banner">
        <span className="arrival-dot" />
        <div>
          <strong>Delivery complete</strong>
          <p>
            {dateTime(plan.summary.completion, plan.time_zone)} · includes
            unloading
          </p>
        </div>
      </div>
    </div>
  );
}
