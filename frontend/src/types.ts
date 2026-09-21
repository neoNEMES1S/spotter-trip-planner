export type Place = { label: string; coordinates: [number, number] };
export type Status = "OFF_DUTY" | "SLEEPER" | "DRIVING" | "ON_DUTY";
export type TripEvent = {
  id: number;
  status: Status;
  activity: string;
  start: string;
  end: string;
  seconds: number;
  meters: number;
  coordinates: [number, number];
  end_coordinates: [number, number];
  location: string;
  end_location: string;
  route_meters: number;
  reason: string;
  leg: number | null;
};
export type LogEvent = Partial<TripEvent> & {
  status: Status;
  activity: string;
  start_second: number;
  end_second: number;
  meters: number;
  location: string;
  continued?: boolean;
};
export type DailyLog = {
  date: string;
  start: string;
  seconds: number;
  hours: { second: number; label: string }[];
  events: LogEvent[];
  totals: Record<Status, number>;
  meters: number;
};
export type Leg = {
  coordinates: [number, number][];
  meters: number;
  seconds: number;
  segments: {
    instruction: string;
    road: string;
    meters: number;
    seconds: number;
  }[];
};
export type Plan = {
  events: TripEvent[];
  logs: DailyLog[];
  legs: Leg[];
  places: Place[];
  sample: boolean;
  time_zone: string;
  details: Record<string, string>;
  initial_cycle_hours: number;
  assumptions: string[];
  routing_source: string;
  summary: {
    meters: number;
    driving_seconds: number;
    on_duty_seconds: number;
    rest_seconds: number;
    elapsed_seconds: number;
    departure: string;
    completion: string;
    arrival: string;
    cycle_used_hours: number;
    cycle_remaining_hours: number;
    fuel_stops: number;
    rest_stops: number;
  };
};
export type Config = {
  live_routing: boolean;
  sample_places: Place[];
  csrf_token: string;
};
export const miles = (meters: number) =>
  Math.round(meters / 1609.344).toLocaleString("en-US");
export function duration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
}
export const time = (iso: string, zone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
export const dateTime = (iso: string, zone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
export const activityLabel: Record<string, string> = {
  drive: "Driving",
  pickup: "Pickup & loading",
  dropoff: "Dropoff & unloading",
  fuel: "Fuel stop",
  break: "30-minute break",
  rest: "10-hour rest",
  restart: "34-hour restart",
  assumed: "Assumed off duty",
};
