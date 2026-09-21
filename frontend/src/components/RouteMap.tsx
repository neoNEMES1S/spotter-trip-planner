import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapPin, Maximize2 } from "lucide-react";
import type { Plan } from "../types";
import { activityLabel, dateTime } from "../types";

export default function RouteMap({
  plan,
  selected,
}: {
  plan: Plan | null;
  selected: number | null;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<number, L.Marker>());
  const bounds = useRef<L.LatLngBounds | null>(null);
  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current, {
      zoomControl: false,
      scrollWheelZoom: false,
    }).setView([37.8, -94], 4);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(instance);
    L.control.zoom({ position: "bottomright" }).addTo(instance);
    map.current = instance;
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !plan) return;
    const layer = L.layerGroup().addTo(instance);
    markers.current.clear();
    const all: L.LatLngTuple[] = [];
    plan.legs.forEach((leg, i) => {
      const coords = leg.coordinates.map(
        ([lon, lat]) => [lat, lon] as L.LatLngTuple,
      );
      all.push(...coords);
      L.polyline(coords, { color: "#fff", weight: 8, opacity: 0.9 }).addTo(
        layer,
      );
      L.polyline(coords, {
        color: i === 0 ? "#679683" : "#214c40",
        weight: 4,
        dashArray: plan.sample ? "8 6" : undefined,
      }).addTo(layer);
    });
    function add(
      coords: [number, number],
      text: string,
      css: string,
      popup: string,
    ) {
      const marker = L.marker([coords[1], coords[0]], {
        title: popup,
        alt: popup,
        icon: L.divIcon({
          className: "",
          html: `<span class="map-pin ${css}">${text}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(layer);
      const content = document.createElement("div");
      content.textContent = popup;
      marker.bindPopup(content);
      return marker;
    }
    plan.events
      .filter((e) => e.status !== "DRIVING")
      .forEach((e) => {
        const text =
          e.activity === "fuel"
            ? "F"
            : e.status === "OFF_DUTY"
              ? "R"
              : e.activity === "pickup"
                ? "P"
                : "D";
        markers.current.set(
          e.id,
          add(
            e.coordinates,
            text,
            e.status === "OFF_DUTY"
              ? "rest-pin"
              : e.activity === "fuel"
                ? "fuel-pin"
                : "",
            `${activityLabel[e.activity]} · ${dateTime(e.start, plan.time_zone)} · ${e.location}`,
          ),
        );
      });
    add(plan.places[0].coordinates, "A", "start-pin", plan.places[0].label);
    bounds.current = L.latLngBounds(all);
    instance.fitBounds(bounds.current, { padding: [55, 55], maxZoom: 10 });
    return () => {
      layer.remove();
    };
  }, [plan]);
  useEffect(() => {
    if (selected === null || !map.current || !plan) return;
    const event = plan.events.find((e) => e.id === selected);
    if (!event) return;
    const marker = markers.current.get(selected);
    const point: L.LatLngTuple = [event.coordinates[1], event.coordinates[0]];
    map.current.flyTo(point, Math.max(map.current.getZoom(), 7), {
      duration: 0.5,
    });
    marker?.openPopup();
  }, [selected, plan]);
  return (
    <div className="map-shell">
      <div
        ref={element}
        className="route-map"
        role="region"
        aria-label="Trip route map"
      />
      <div className="map-label">
        <span className="live-dot" />
        {plan
          ? plan.sample
            ? "SAMPLE ROUTE · SCHEMATIC"
            : "YOUR ROUTE"
          : "CONTIGUOUS UNITED STATES"}
      </div>
      <button
        type="button"
        className="map-fit"
        aria-label="Fit entire route"
        onClick={() => {
          if (bounds.current)
            map.current?.fitBounds(bounds.current, { padding: [55, 55] });
          else map.current?.setView([37.8, -94], 4);
        }}
      >
        <Maximize2 size={16} />
      </button>
      {!plan && (
        <div className="map-empty">
          <span className="empty-icon">
            <MapPin size={25} />
          </span>
          <h3>Your next route starts here.</h3>
          <p>Add your trip details, or explore the sample trip.</p>
        </div>
      )}
      <div className="map-legend">
        <span>
          <i className="legend-line" />
          Route
        </span>
        <span>
          <i className="legend-rest" />
          Rest
        </span>
        <span>
          <i className="legend-fuel" />
          Fuel
        </span>
      </div>
    </div>
  );
}
