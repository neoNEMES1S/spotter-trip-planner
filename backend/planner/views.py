import json
import logging
import math
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.core.exceptions import RequestDataTooBig
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST

from .logs import daily_logs
from .routing import RoutingError, SAMPLE_PLACES, get_leg, sample_legs, search_locations
from .scheduler import schedule

logger = logging.getLogger(__name__)

ASSUMPTIONS = [
    "Fresh shift after at least 10 consecutive hours off duty; prior cycle usage carries forward.",
    "70 hours / 8 days. No historical recap credits; a 34-hour restart is used when driving allowance runs out.",
    "One hour each for pickup and dropoff. Full tank at departure; 30-minute fueling at or before 1,000 miles.",
    "Rest is logged off duty. No split-sleeper, short-haul, personal-conveyance, or adverse-condition exceptions.",
    "All log times use the home-terminal time zone. Before departure and after completion are assumed off duty.",
    "Stop positions are approximate planning points, not verified fuel stations or available parking.",
    "Carrier, vehicle, shipping, and signature details are not inferred. These are planned logs, not a certified ELD record.",
]


@require_GET
def health(request):
    return JsonResponse({"status": "ok"})


@require_GET
def config(request):
    return JsonResponse({"live_routing": bool(settings.ORS_API_KEY), "sample_places": SAMPLE_PLACES, "csrf_token": get_token(request)})


@require_GET
def index(request):
    if not (settings.BASE_DIR.parent / "frontend/dist/index.html").exists():
        return JsonResponse({"message": "API running. Start the Vite frontend on port 5173 or run npm run build."})
    return render(request, "index.html")


@require_GET
def locations(request):
    query = request.GET.get("q", "").strip()
    if not 3 <= len(query) <= 200:
        return JsonResponse({"error": "Enter a location between 3 and 200 characters."}, status=400)
    try:
        return JsonResponse({"locations": search_locations(query)})
    except RoutingError as exc:
        return JsonResponse({"error": str(exc)}, status=503)


def validate(data):
    if not isinstance(data, dict):
        raise ValueError("Request must be a JSON object.")
    errors = {}
    cycle = data.get("cycle_hours", 0)
    if isinstance(cycle, bool) or not isinstance(cycle, (int, float)) or not math.isfinite(cycle) or not 0 <= cycle <= 70:
        errors["cycle_hours"] = "Enter cycle hours between 0 and 70."
    zone_name = data.get("time_zone", "America/Chicago")
    try:
        if not isinstance(zone_name, str):
            raise ValueError()
        zone = ZoneInfo(zone_name)
    except (ZoneInfoNotFoundError, ValueError):
        errors["time_zone"] = "Choose a valid terminal time zone."
        zone = ZoneInfo("America/Chicago")
    try:
        raw = data.get("departure", "")
        if not isinstance(raw, str):
            raise ValueError()
        departure = datetime.fromisoformat(raw)
        if departure.tzinfo is None:
            local = departure.replace(tzinfo=zone)
            if local.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None) != departure:
                raise ValueError("This local time does not exist during the daylight-saving change.")
            if local.utcoffset() != local.replace(fold=1).utcoffset():
                raise ValueError("This local time occurs twice. Choose a departure outside the clock change.")
            departure = local
        departure = departure.astimezone(timezone.utc)
        if not 2020 <= departure.year <= 2100:
            raise ValueError()
    except (TypeError, ValueError, OverflowError) as exc:
        errors["departure"] = str(exc) if str(exc).startswith("This local") else "Choose a valid departure date and time (2020–2100)."
        departure = None
    demo = data.get("sample", False)
    if not isinstance(demo, bool):
        errors["sample"] = "Sample must be true or false."
    places = SAMPLE_PLACES if demo is True else data.get("places")
    if not isinstance(places, list) or len(places) != 3:
        errors["places"] = "Select current, pickup, and dropoff locations."
    else:
        for i, place in enumerate(places):
            if not isinstance(place, dict):
                errors[f"place_{i}"] = "Select a valid location."
                continue
            coords = place.get("coordinates")
            label = place.get("label")
            if not isinstance(label, str) or not 1 <= len(label.strip()) <= 250 or not isinstance(coords, list) or len(coords) != 2 or any(isinstance(c, bool) or not isinstance(c, (int, float)) or not math.isfinite(c) for c in coords):
                errors[f"place_{i}"] = "Select a valid location with coordinates."
            elif not (-125 <= coords[0] <= -66 and 24 <= coords[1] <= 50):
                errors[f"place_{i}"] = "This planner supports locations in the contiguous United States."
    details = data.get("details", {})
    allowed = ["driver", "carrier", "office", "terminal", "vehicle", "shipping", "codriver"]
    if not isinstance(details, dict) or any(not isinstance(details.get(k, ""), str) or len(details.get(k, "")) > 200 for k in allowed):
        errors["details"] = "Keep log details under 200 characters per field."
    if errors:
        return None, errors
    return {"cycle": cycle, "departure": departure, "zone": zone_name, "places": places, "sample": demo,
            "details": {k: details.get(k, "").strip() for k in allowed}}, None


@require_POST
def plan(request):
    try:
        if request.content_type != "application/json":
            return JsonResponse({"error": "Send an application/json request."}, status=415)
        data = json.loads(request.body)
        values, errors = validate(data)
        if errors:
            return JsonResponse({"error": "Check the highlighted inputs.", "fields": errors}, status=400)
        places = values["places"]
        legs = sample_legs() if values["sample"] else [get_leg(places[0], places[1]), get_leg(places[1], places[2])]
        if sum(leg["seconds"] for leg in legs) > 300*3600:
            raise ValueError("This route exceeds the supported 300 driving hours. Split it into shorter trips.")
        result = schedule(legs, places, values["departure"], values["cycle"])
        return JsonResponse({**result, "logs": daily_logs(result["events"], values["zone"]), "legs": legs,
                             "places": places, "time_zone": values["zone"], "sample": values["sample"], "details": values["details"],
                             "initial_cycle_hours": values["cycle"], "assumptions": ASSUMPTIONS,
                             "routing_source": "Illustrative sample · schematic geometry and estimated distances" if values["sample"] else "openrouteservice · OpenStreetMap"})
    except RoutingError as exc:
        return JsonResponse({"error": str(exc)}, status=503)
    except RequestDataTooBig:
        return JsonResponse({"error": "Trip details exceed the 32 KB request limit."}, status=413)
    except (ValueError, UnicodeDecodeError) as exc:
        return JsonResponse({"error": str(exc) if not isinstance(exc, json.JSONDecodeError) else "Invalid JSON request."}, status=400)
    except Exception:
        logger.exception("Trip planning failed")
        return JsonResponse({"error": "The trip could not be planned. Please try again."}, status=500)
