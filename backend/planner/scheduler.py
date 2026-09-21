"""Deterministic HOS scheduling. UTC arithmetic; no provider or Django dependency."""
from datetime import timedelta
from math import asin, ceil, cos, radians, sin, sqrt

HOUR = 3600
FUEL_METERS = 1000 * 1609.344


def distance(a, b):
    lon1, lat1, lon2, lat2 = map(radians, (*a, *b))
    return 12_742_000 * asin(min(1, sqrt(sin((lat2-lat1)/2)**2 + cos(lat1)*cos(lat2)*sin((lon2-lon1)/2)**2)))


def point_on_line(coords, fraction):
    if len(coords) < 2:
        return coords[0]
    lengths = [distance(a, b) for a, b in zip(coords, coords[1:])]
    remaining = sum(lengths) * max(0, min(1, fraction))
    for a, b, length in zip(coords, coords[1:], lengths):
        if remaining <= length and length:
            t = remaining / length
            return [a[0] + t*(b[0]-a[0]), a[1] + t*(b[1]-a[1])]
        remaining -= length
    return coords[-1]


def schedule(legs, places, departure, cycle_hours):
    now = departure
    shift_start = None
    shift_drive = break_drive = 0
    cycle = ceil(cycle_hours * HOUR)
    fuel_distance = total_distance = 0.0
    position = places[0]["coordinates"]
    location = places[0]["label"]
    events = []

    def emit(status, activity, seconds, reason="", meters=0, end_position=None, end_location=None, leg=None):
        nonlocal now, shift_start, shift_drive, break_drive, cycle, fuel_distance, total_distance, position, location
        if seconds <= 0:
            return
        if status != "OFF_DUTY" and shift_start is None:
            shift_start = now
        end = now + timedelta(seconds=seconds)
        event = {
            "id": len(events), "status": status, "activity": activity,
            "start": now.isoformat(), "end": end.isoformat(), "seconds": seconds,
            "meters": meters, "coordinates": position, "end_coordinates": end_position or position,
            "location": location, "end_location": end_location or location,
            "route_meters": total_distance, "reason": reason, "leg": leg,
        }
        if status == "DRIVING":
            event["travel_segments"] = [{"start": event["start"], "end": event["end"], "meters": meters}]
        # Keep road-step details in route instructions; merge consecutive driving events in the log.
        if events and status == "DRIVING" and events[-1]["status"] == status and events[-1]["leg"] == leg:
            previous = events[-1]
            previous.update(end=event["end"], end_coordinates=event["end_coordinates"], end_location=event["end_location"])
            previous["seconds"] += seconds
            previous["meters"] += meters
            previous["travel_segments"].extend(event["travel_segments"])
        else:
            events.append(event)
        now = end
        position = end_position or position
        location = end_location or location
        total_distance += meters
        fuel_distance += meters
        if status != "OFF_DUTY":
            cycle += seconds
        if status == "DRIVING":
            shift_drive += seconds
            break_drive += seconds
        elif seconds >= 1800:
            break_drive = 0
        if status == "OFF_DUTY" and seconds >= 10*HOUR:
            shift_start = None
            shift_drive = 0
        if status == "OFF_DUTY" and seconds >= 34*HOUR:
            cycle = 0

    for leg_index, leg in enumerate(legs):
        for segment in leg["segments"]:
            consumed = 0
            duration = segment["seconds"]
            while consumed < duration:
                if len(events) > 2000:
                    raise ValueError("This trip is too long to plan in one request.")
                if fuel_distance >= FUEL_METERS - 0.001:
                    emit("ON_DUTY", "fuel", 1800, "Fuel interval reached · also satisfies driving break")
                    fuel_distance = 0
                    continue
                if cycle >= 70*HOUR:
                    emit("OFF_DUTY", "restart", 34*HOUR, "70-hour cycle allowance exhausted; conservative 34-hour restart")
                    continue
                window = 14*HOUR - int((now-shift_start).total_seconds()) if shift_start else 14*HOUR
                if shift_drive >= 11*HOUR or window <= 0:
                    reason = "11-hour driving limit reached" if shift_drive >= 11*HOUR else "14-hour driving window reached"
                    emit("OFF_DUTY", "rest", 10*HOUR, reason)
                    continue
                if break_drive >= 8*HOUR:
                    emit("OFF_DUTY", "break", 1800, "8 cumulative driving hours since a qualifying interruption")
                    continue
                speed = segment["meters"] / duration
                # Floor the fuel boundary so rounding can never drive beyond 1,000 miles.
                to_fuel = int((FUEL_METERS-fuel_distance)/speed) if speed else duration
                if to_fuel <= 0:
                    emit("ON_DUTY", "fuel", 1800, "Fuel before the 1,000-mile interval · also satisfies driving break")
                    fuel_distance = 0
                    continue
                seconds = min(duration-consumed, 11*HOUR-shift_drive, window, 8*HOUR-break_drive, 70*HOUR-cycle, to_fuel)
                meters = speed * seconds
                consumed += seconds
                end_point = point_on_line(segment["coordinates"], consumed/duration)
                last = segment is leg["segments"][-1] and consumed == duration
                end_label = places[leg_index+1]["label"] if last else f"Near {segment.get('road') or 'route'}, route mile {(total_distance+meters)/1609.344:.1f} (approx.)"
                emit("DRIVING", "drive", seconds, meters=meters, end_position=end_point, end_location=end_label, leg=leg_index)
        position = places[leg_index+1]["coordinates"]
        location = places[leg_index+1]["label"]
        emit("ON_DUTY", "pickup" if leg_index == 0 else "dropoff", HOUR, "One hour of loading" if leg_index == 0 else "One hour of unloading")
    for i, event in enumerate(events):
        event["id"] = i
    return {
        "events": events,
        "summary": {
            "meters": total_distance, "driving_seconds": sum(e["seconds"] for e in events if e["status"] == "DRIVING"),
            "on_duty_seconds": sum(e["seconds"] for e in events if e["status"] == "ON_DUTY"),
            "rest_seconds": sum(e["seconds"] for e in events if e["status"] == "OFF_DUTY"),
            "elapsed_seconds": int((now-departure).total_seconds()), "departure": departure.isoformat(),
            "completion": now.isoformat(), "arrival": events[-1]["start"],
            "cycle_used_hours": cycle/HOUR, "cycle_remaining_hours": max(0, 70-cycle/HOUR),
            "fuel_stops": sum(e["activity"] == "fuel" for e in events),
            "rest_stops": sum(e["status"] == "OFF_DUTY" for e in events),
        },
    }
