from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


def daily_logs(events, terminal_zone):
    zone = ZoneInfo(terminal_zone)
    beginning = datetime.fromisoformat(events[0]["start"])
    ending = datetime.fromisoformat(events[-1]["end"])
    date = beginning.astimezone(zone).date()
    last_date = (ending-timedelta(microseconds=1)).astimezone(zone).date()
    logs = []
    while date <= last_date:
        start = datetime.combine(date, time(), zone).astimezone(timezone.utc)
        end = datetime.combine(date+timedelta(days=1), time(), zone).astimezone(timezone.utc)
        seconds = int((end-start).total_seconds())
        parts = []
        if beginning > start:
            parts.append({"status": "OFF_DUTY", "activity": "assumed", "start_second": 0, "end_second": int((beginning-start).total_seconds()), "meters": 0, "location": "Assumed off duty before departure"})
        for event in events:
            event_start = datetime.fromisoformat(event["start"])
            event_end = datetime.fromisoformat(event["end"])
            a, b = max(start, event_start), min(end, event_end)
            if a < b:
                meters = 0
                for segment in event.get("travel_segments", []):
                    sa, sb = datetime.fromisoformat(segment["start"]), datetime.fromisoformat(segment["end"])
                    overlap = max(0, (min(b, sb)-max(a, sa)).total_seconds())
                    meters += segment["meters"]*overlap/(sb-sa).total_seconds()
                label = event["location"]
                if event["status"] == "DRIVING" and event_start < start:
                    # The exact town at midnight is unknown; do not repeat the previous day's origin.
                    label = "En route at terminal midnight (approximate location)"
                parts.append({**{k:v for k,v in event.items() if k != "travel_segments"}, "start_second": int((a-start).total_seconds()), "end_second": int((b-start).total_seconds()), "meters": meters, "location": label, "continued": event_start < start})
        if ending < end:
            parts.append({"status": "OFF_DUTY", "activity": "assumed", "start_second": int((ending-start).total_seconds()), "end_second": seconds, "meters": 0, "location": "Assumed off duty after completion"})
        totals = {s: sum(p["end_second"]-p["start_second"] for p in parts if p["status"] == s) for s in ["OFF_DUTY", "SLEEPER", "DRIVING", "ON_DUTY"]}
        logs.append({"date": date.isoformat(), "start": start.isoformat(), "seconds": seconds,
                     "hours": [{"second": n, "label": (start+timedelta(seconds=n)).astimezone(zone).strftime("%H:%M %Z")} for n in range(0, seconds+1, 3600)],
                     "events": parts, "totals": totals, "meters": sum(p["meters"] for p in parts)})
        date += timedelta(days=1)
    return logs
