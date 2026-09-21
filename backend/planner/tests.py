import json
import random
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import Client, SimpleTestCase, override_settings

from .logs import daily_logs
from .routing import SAMPLE_PLACES, RoutingError, get_leg, sample_legs
from .scheduler import FUEL_METERS, schedule
from .views import validate

START = datetime(2026, 9, 21, 8, tzinfo=ZoneInfo("America/Chicago")).astimezone(timezone.utc)


def leg(hours, miles=None):
    meters = (hours*50 if miles is None else miles)*1609.344
    segments = [{"seconds": round(hours*3600), "meters": meters, "coordinates": [[-90,38],[-91,37]], "road": "Test road", "instruction": "Continue"}] if hours else []
    return {"segments": segments, "meters": meters, "seconds": round(hours*3600), "coordinates": [[-90,38],[-91,37]]}


def activities(result, activity):
    return [event for event in result["events"] if event["activity"] == activity]


class ScheduleTests(SimpleTestCase):
    def assert_schedule(self, result):
        shift_start = None
        driven = since_break = cycle = 0
        previous = None
        fuel = 0
        for event in result["events"]:
            start, end = datetime.fromisoformat(event["start"]), datetime.fromisoformat(event["end"])
            self.assertGreater(event["seconds"], 0)
            self.assertEqual((end-start).total_seconds(), event["seconds"])
            if previous:
                self.assertEqual(start, previous)
            previous = end
            if event["status"] != "OFF_DUTY":
                shift_start = shift_start or start
                cycle += event["seconds"]
            if event["status"] == "DRIVING":
                driven += event["seconds"]
                since_break += event["seconds"]
                fuel += event["meters"]
                self.assertLessEqual(driven, 11*3600)
                self.assertLessEqual(since_break, 8*3600)
                self.assertLessEqual((end-shift_start).total_seconds(), 14*3600)
                self.assertLessEqual(cycle, 70*3600)
                self.assertLessEqual(fuel, FUEL_METERS + .01)
            elif event["seconds"] >= 1800:
                since_break = 0
            if event["activity"] == "fuel":
                fuel = 0
            if event["status"] == "OFF_DUTY" and event["seconds"] >= 36000:
                shift_start = None
                driven = 0
            if event["status"] == "OFF_DUTY" and event["seconds"] >= 34*3600:
                cycle = 0
        logs = daily_logs(result["events"], "America/Chicago")
        for log in logs:
            self.assertEqual(sum(log["totals"].values()), log["seconds"])
            self.assertEqual(log["events"][0]["start_second"], 0)
            self.assertEqual(log["events"][-1]["end_second"], log["seconds"])
            for a,b in zip(log["events"], log["events"][1:]):
                self.assertEqual(a["end_second"],b["start_second"])
        self.assertAlmostEqual(sum(log["meters"] for log in logs), result["summary"]["meters"])

    def test_short_trip(self):
        result = schedule([leg(2),leg(3)], SAMPLE_PLACES, START, 0)
        self.assertEqual(result["summary"]["elapsed_seconds"],7*3600)
        self.assertEqual(result["summary"]["cycle_used_hours"],7)
        self.assertEqual(result["summary"]["rest_stops"],0)
        self.assert_schedule(result)

    def test_pickup_resets_break_not_shift(self):
        result = schedule([leg(7),leg(5)], SAMPLE_PLACES, START, 0)
        self.assertEqual(result["summary"]["elapsed_seconds"],24*3600)
        self.assertEqual(len(activities(result,"rest")),1)
        self.assertFalse(activities(result,"break"))
        logs = daily_logs(result["events"],"America/Chicago")
        self.assertEqual([l["totals"]["DRIVING"]/3600 for l in logs],[11,1])
        self.assert_schedule(result)

    def test_break_before_pickup(self):
        result = schedule([leg(9),leg(2)],SAMPLE_PLACES,START,0)
        self.assertEqual(result["summary"]["elapsed_seconds"],13.5*3600)
        self.assertEqual(len(activities(result,"break")),1)
        self.assertFalse(activities(result,"rest"))
        self.assertEqual(result["summary"]["cycle_used_hours"],13)
        self.assert_schedule(result)

    def test_fuel_also_satisfies_break(self):
        # The walkthrough's variable-speed route: first shift 600 mi, then 400 mi in 8h.
        second = leg(19)
        second["segments"] = leg(9,500)["segments"]+leg(8,400)["segments"]+leg(2,100)["segments"]
        result = schedule([leg(2,100),second],SAMPLE_PLACES,START,0)
        self.assertEqual(result["summary"]["elapsed_seconds"],34*3600)
        self.assertEqual(result["summary"]["cycle_used_hours"],23.5)
        self.assertEqual(len(activities(result,"fuel")),1)
        self.assertEqual(len(activities(result,"break")),1)
        self.assertAlmostEqual(activities(result,"fuel")[0]["route_meters"],FUEL_METERS)
        self.assert_schedule(result)

    def test_cycle_69_and_pickup(self):
        result = schedule([leg(0),leg(2)],SAMPLE_PLACES,START,69)
        self.assertEqual(result["summary"]["elapsed_seconds"],38*3600)
        self.assertEqual(result["summary"]["cycle_used_hours"],3)
        self.assertEqual(len(activities(result,"restart")),1)
        self.assertFalse(activities(result,"rest"))

    def test_cycle_70_cannot_drive_at_departure(self):
        result = schedule([leg(1),leg(2)],SAMPLE_PLACES,START,70)
        self.assertEqual(result["events"][0]["activity"],"restart")
        self.assertEqual(result["summary"]["cycle_used_hours"],5)

    def test_final_unloading_can_exceed_cycle(self):
        result = schedule([leg(1),leg(1)],SAMPLE_PLACES,START,67)
        self.assertEqual(result["summary"]["cycle_used_hours"],71)
        self.assertEqual(result["summary"]["cycle_remaining_hours"],0)
        self.assertFalse(activities(result,"restart"))

    def test_exact_eight_hours_at_pickup_and_finish(self):
        result = schedule([leg(8),leg(3)],SAMPLE_PLACES,START,0)
        self.assertFalse(activities(result,"break"))
        self.assertFalse(activities(result,"rest"))
        self.assert_schedule(result)

    def test_zero_legs_keep_both_services(self):
        result = schedule([leg(0),leg(0)],SAMPLE_PLACES,START,0)
        self.assertEqual([e["activity"] for e in result["events"]],["pickup","dropoff"])
        self.assert_schedule(result)

    def test_fourteen_hour_window_with_fuel_stress(self):
        # Synthetic high-distance steps force many on-duty fuel stops; isolate the window guard.
        result = schedule([leg(2,100),leg(12,12000)],SAMPLE_PLACES,START,0)
        self.assertTrue(any(e["reason"] == "14-hour driving window reached" for e in result["events"]))
        self.assert_schedule(result)

    def test_midnight_mileage_uses_segment_timing(self):
        late = START.replace(hour=4) + timedelta(days=1)  # 23:00 terminal time
        first = leg(2)
        first["segments"] = leg(1,20)["segments"]+leg(1,80)["segments"]
        result = schedule([first,leg(0)],SAMPLE_PLACES,late,0)
        logs = daily_logs(result["events"],"America/Chicago")
        self.assertAlmostEqual(logs[0]["meters"]/1609.344,20)
        self.assertAlmostEqual(logs[1]["meters"]/1609.344,80)

    def test_daylight_saving_log_lengths(self):
        for date, hours in [("2026-03-08T08:00",23),("2026-11-01T08:00",25)]:
            start = datetime.fromisoformat(date).replace(tzinfo=ZoneInfo("America/Chicago")).astimezone(timezone.utc)
            result = schedule([leg(2),leg(3)],SAMPLE_PLACES,start,0)
            self.assertEqual(daily_logs(result["events"],"America/Chicago")[0]["seconds"],hours*3600)
            self.assert_schedule(result)

    def test_sample_and_deterministic_long_routes(self):
        self.assert_schedule(schedule(sample_legs(),SAMPLE_PLACES,START,0))
        randomizer = random.Random(17)
        for _ in range(40):
            legs = [leg(randomizer.uniform(0,60)) for _ in range(2)]
            result = schedule(legs,SAMPLE_PLACES,START,0)
            self.assert_schedule(result)
            self.assertEqual(len(activities(result,"pickup")),1)
            self.assertEqual(len(activities(result,"dropoff")),1)


class ApiTests(SimpleTestCase):
    @override_settings(SECURE_SSL_REDIRECT=True)
    def test_http_health_probe_with_https_redirect_enabled(self):
        self.assertEqual(self.client.get('/api/health').status_code, 200)
        self.assertEqual(self.client.get('/api/config').status_code, 301)

    def body(self, **kwargs):
        return {"sample":True,"departure":"2026-09-21T08:00","cycle_hours":0,"time_zone":"America/Chicago",**kwargs}

    def test_sample_endpoint(self):
        response = self.client.post('/api/trips/plan',data=json.dumps(self.body()),content_type='application/json')
        self.assertEqual(response.status_code,200)
        data = response.json()
        self.assertTrue(data["sample"])
        self.assertEqual(len(data["logs"]),2)
        self.assertEqual(data["summary"]["fuel_stops"],1)

    def test_invalid_inputs(self):
        for value in [-1,71,float('nan'),float('inf'),True,"2"]:
            _, errors = validate(self.body(cycle_hours=value))
            self.assertIn('cycle_hours',errors)
        for date in ['2026-03-08T02:30','2026-11-01T01:30','nope']:
            _, errors = validate(self.body(departure=date))
            self.assertIn('departure',errors)
        _, errors = validate(self.body(sample=False,places=[{"label":"x","coordinates":[float('nan'),40]}]*3))
        self.assertIn('place_0',errors)

    def test_csrf_is_required_and_config_provides_token(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.post('/api/trips/plan',data=json.dumps(self.body()),content_type='application/json').status_code,403)
        token = client.get('/api/config').json()['csrf_token']
        self.assertEqual(client.post('/api/trips/plan',data=json.dumps(self.body()),content_type='application/json',HTTP_X_CSRFTOKEN=token).status_code,200)

    @override_settings(CSRF_TRUSTED_ORIGINS=['http://127.0.0.1:5173'])
    def test_vite_origin_with_csrf(self):
        client = Client(enforce_csrf_checks=True)
        token = client.get('/api/config').json()['csrf_token']
        response = client.post('/api/trips/plan',data=json.dumps(self.body()),content_type='application/json',HTTP_X_CSRFTOKEN=token,HTTP_ORIGIN='http://127.0.0.1:5173')
        self.assertEqual(response.status_code,200)

    def test_malformed_and_non_json_requests(self):
        self.assertEqual(self.client.post('/api/trips/plan',data='{',content_type='application/json').status_code,400)
        self.assertEqual(self.client.post('/api/trips/plan',data='[]',content_type='application/json').status_code,400)
        self.assertEqual(self.client.post('/api/trips/plan',data='x',content_type='text/plain').status_code,415)
        self.assertEqual(self.client.post('/api/trips/plan',data=' '*40000,content_type='application/json').status_code,413)

    @override_settings(ORS_API_KEY='')
    def test_live_provider_missing_key_never_falls_back(self):
        response = self.client.post('/api/trips/plan',data=json.dumps(self.body(sample=False,places=SAMPLE_PLACES)),content_type='application/json')
        self.assertEqual(response.status_code,503)
        self.assertIn('not configured',response.json()['error'])

    @patch('planner.routing.request_provider')
    def test_route_adapter_preserves_steps_and_rounds_time_up(self, provider):
        provider.return_value = {"features":[{"geometry":{"coordinates":[[-87,41],[-86,40]]},"properties":{"segments":[{"steps":[{"distance":1500,"duration":100.1,"way_points":[0,1],"instruction":"Head south","name":"I-65"}]}]}}]}
        result = get_leg(SAMPLE_PLACES[0],SAMPLE_PLACES[1])
        self.assertEqual(result["seconds"],101)
        self.assertEqual(result["meters"],1500)
        self.assertEqual(result["segments"][0]["road"],"I-65")
        provider.return_value = {"features":[]}
        with self.assertRaises(RoutingError):
            get_leg(SAMPLE_PLACES[0],SAMPLE_PLACES[1])
