"""Exercise a running deployment: python3 scripts/smoke.py https://your-host [--live]."""
import argparse
import http.cookiejar
import json
import urllib.error
import urllib.parse
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("--live", action="store_true", help="Also geocode and plan a real route (uses ORS quota)")
    args = parser.parse_args()
    base = args.url.rstrip("/")
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(path, body=None, expected=200, token=None):
        headers = {"Accept": "application/json"}
        if body is not None:
            headers.update({"Content-Type": "application/json", "Origin": base})
        if token:
            headers["X-CSRFToken"] = token
        req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
        try:
            response = client.open(req, timeout=90)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read()
            assert response.status == expected, f"{path}: expected {expected}, got {response.status}: {raw[:300]!r}"
            return json.loads(raw) if response.headers.get_content_type() == "application/json" else raw

    assert request("/api/health")["status"] == "ok"
    assert b'<div id="root">' in request("/")
    config = request("/api/config")
    token = config["csrf_token"]
    body = {"sample": True, "departure": "2026-09-21T08:00", "cycle_hours": 0, "time_zone": "America/Chicago"}
    result = request("/api/trips/plan", body, token=token)
    assert result["summary"]["elapsed_seconds"] == 30.5 * 3600
    assert len(result["logs"]) == 2
    assert result["summary"]["fuel_stops"] == 1
    for log in result["logs"]:
        assert sum(log["totals"].values()) == log["seconds"]
    restarted = request("/api/trips/plan", {**body, "cycle_hours": 70}, token=token)
    assert restarted["events"][0]["activity"] == "restart"
    assert restarted["events"][0]["seconds"] == 34 * 3600
    assert len(restarted["logs"]) == 4
    request("/api/trips/plan", {**body, "cycle_hours": 71}, expected=400, token=token)
    request("/api/trips/plan", body, expected=403)
    print("PASS: frontend, health, sample, daily totals, 70-hour restart, validation, CSRF")
    if args.live:
        assert config["live_routing"], "Set ORS_API_KEY on the server before live verification"
        places = []
        for city in ["Chicago, Illinois", "Indianapolis, Indiana", "Dallas, Texas"]:
            matches = request("/api/locations?" + urllib.parse.urlencode({"q": city}))["locations"]
            assert matches, f"No geocoding results for {city}"
            places.append(matches[0])
        live = request("/api/trips/plan", {**body, "sample": False, "places": places}, token=token)
        assert live["sample"] is False
        assert live["summary"]["meters"] > 0 and live["logs"]
        assert all(leg["coordinates"] for leg in live["legs"])
        print("PASS: live geocoding, directions, schedule, route geometry, daily logs")
    else:
        print("SKIP: live provider verification (add --live when ORS_API_KEY is configured)")


if __name__ == "__main__":
    main()
