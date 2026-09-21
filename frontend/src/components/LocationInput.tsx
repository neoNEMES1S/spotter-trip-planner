import { useEffect, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { api } from "../api";
import type { Place } from "../types";

export default function LocationInput({
  label,
  number,
  value,
  onChange,
  readonly,
  error,
}: {
  label: string;
  number: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  readonly: boolean;
  error?: string;
}) {
  const [query, setQuery] = useState(value?.label || "");
  const [results, setResults] = useState<Place[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (value) setQuery(value.label);
    setResults([]);
    setMessage("");
  }, [value, readonly]);
  useEffect(() => () => controller.current?.abort(), []);
  async function search() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setMessage("");
    setResults([]);
    try {
      const data = await api<{ locations: Place[] }>(
        `/api/locations?q=${encodeURIComponent(query)}`,
        { signal: request.signal },
      );
      setResults(data.locations);
      if (!data.locations.length)
        setMessage("No matches. Try a city and state or a street address.");
    } catch (e) {
      if (!request.signal.aborted) setMessage((e as Error).message);
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }
  return (
    <div className="location-field">
      <label htmlFor={`location-${number}`}>
        <span className={`waypoint waypoint-${number}`}>{number}</span>
        {label}
      </label>
      <div className={`location-control ${error ? "invalid" : ""}`}>
        <input
          id={`location-${number}`}
          value={query}
          readOnly={readonly}
          placeholder="Search city or address"
          autoComplete="off"
          onChange={(e) => {
            const text = e.target.value;
            controller.current?.abort();
            setLoading(false);
            if (value) onChange(null);
            setQuery(text);
            setResults([]);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !readonly) {
              e.preventDefault();
              void search();
            }
          }}
          aria-invalid={!!error}
        />
        {readonly || value ? (
          <Check size={15} className="location-check" />
        ) : (
          <button
            type="button"
            className="icon-button"
            onClick={search}
            disabled={loading || query.trim().length < 3}
            aria-label={`Search ${label.toLowerCase()}`}
          >
            <Search size={16} />
          </button>
        )}
      </div>
      {loading && <small role="status">Finding locations…</small>}
      {(message || error) && (
        <small className="field-error" role="alert">
          {error || message}
        </small>
      )}
      {results.length > 0 && (
        <ul className="location-results" aria-label={`${label} results`}>
          {results.map((p) => (
            <li key={p.label}>
              <button
                type="button"
                onClick={() => {
                  onChange(p);
                  setResults([]);
                  setQuery(p.label);
                }}
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
