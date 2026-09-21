"""Small openrouteservice adapter. Sample data is explicitly requested, never a fallback."""
import json
import math
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.cache import cache


class RoutingError(Exception):
    pass


SAMPLE_PLACES = [
    {"label": "Chicago, IL", "coordinates": [-87.6298, 41.8781]},
    {"label": "Indianapolis, IN", "coordinates": [-86.1581, 39.7684]},
    {"label": "Dallas, TX", "coordinates": [-96.7970, 32.7767]},
]


def request_provider(path, params=None, body=None):
    if not settings.ORS_API_KEY:
        raise RoutingError("Live routing is not configured. Try the sample trip or set ORS_API_KEY on the server.")
    url = "https://api.openrouteservice.org/" + path
    if params:
        url += "?" + urlencode(params)
    key = "ors:" + url + json.dumps(body, sort_keys=True)
    stored = cache.get(key)
    if stored is not None:
        return stored
    request = Request(url, data=json.dumps(body).encode() if body is not None else None,
                      headers={"Authorization": settings.ORS_API_KEY, "Content-Type": "application/json", "User-Agent": "SpotterTripPlanner/1.0"})
    try:
        with urlopen(request, timeout=20) as response:
            result = json.load(response)
    except HTTPError as exc:
        messages = {401: "Routing credentials were rejected.", 403: "Routing access was denied. Check the API key and enabled services.",
                    429: "Routing service quota reached. Please try again later.", 400: "No supported route was found. Try more specific locations.",
                    404: "No route was found between these locations."}
        raise RoutingError(messages.get(exc.code, "The routing service is temporarily unavailable.")) from exc
    except (URLError, TimeoutError, ValueError) as exc:
        raise RoutingError("The routing service could not be reached. Please try again.") from exc
    cache.set(key, result, 3600)
    return result


def search_locations(query):
    result = request_provider("geocode/search", {"text": query, "boundary.country": "USA", "size": 5})
    return [{"label": f["properties"]["label"], "coordinates": f["geometry"]["coordinates"]}
            for f in result.get("features", []) if f.get("geometry", {}).get("type") == "Point"]


def get_leg(start, end):
    if start["coordinates"] == end["coordinates"]:
        return {"segments": [], "coordinates": [start["coordinates"], end["coordinates"]], "meters": 0, "seconds": 0}
    result = request_provider("v2/directions/driving-hgv/geojson", body={"coordinates": [start["coordinates"], end["coordinates"]], "instructions": True, "units": "m"})
    try:
        feature = result["features"][0]
        coords = feature["geometry"]["coordinates"]
        segments = []
        for section in feature["properties"]["segments"]:
            for step in section["steps"]:
                if not step["distance"] and not step["duration"]:
                    continue
                first, last = step["way_points"]
                segments.append({"meters": float(step["distance"]), "seconds": max(1, math.ceil(step["duration"])),
                                 "coordinates": coords[first:last+1] or [coords[first]], "instruction": step["instruction"], "road": step.get("name", "route")})
        if not segments:
            raise ValueError("No route steps")
        return {"segments": segments, "coordinates": coords, "meters": sum(s["meters"] for s in segments), "seconds": sum(s["seconds"] for s in segments)}
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise RoutingError("The routing service returned an incomplete route. Please retry.") from exc


def sample_legs():
    # ponytail: schematic sample corridors, use live provider geometry for real trips.
    corridors = [
        (210, 4, [SAMPLE_PLACES[0]["coordinates"], [-87.33, 41.59], [-87.05, 41.48], [-86.89, 40.42], SAMPLE_PLACES[1]["coordinates"]], "I-65", "Follow I-65 south toward Indianapolis"),
        (240, 4, [SAMPLE_PLACES[1]["coordinates"], [-87.53, 39.47], [-88.54, 39.12], [-90.20, 38.63]], "I-70", "Follow I-70 west toward St. Louis"),
        (290, 5, [[-90.20, 38.63], [-91.77, 37.95], [-93.29, 37.21], [-94.51, 37.08]], "I-44", "Continue on I-44 toward Joplin"),
        (280, 5, [[-94.51, 37.08], [-95.99, 36.15], [-96.38, 35.74], [-96.40, 34.01], [-96.54, 33.64], SAMPLE_PLACES[2]["coordinates"]], "US-69 / US-75", "Continue toward Dallas via US-69 and US-75"),
    ]
    steps = [{"meters": miles*1609.344, "seconds": hours*3600, "coordinates": coords, "road": road, "instruction": text} for miles, hours, coords, road, text in corridors]
    legs = []
    for group in [steps[:1], steps[1:]]:
        legs.append({"segments": group, "coordinates": [p for s in group for p in s["coordinates"]], "meters": sum(s["meters"] for s in group), "seconds": sum(s["seconds"] for s in group)})
    return legs
