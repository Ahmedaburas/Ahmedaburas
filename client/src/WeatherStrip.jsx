import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./api.js";

const PRIMARY = ["wind", "rain", "lightning", "wbgt"];
const QUIET = new Set(["safe", "ok", "clear", "reference"]);

function formatRiyadh(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function Tile({ tile, compact }) {
  return (
    <article className={`weather-tile tone-${tile.tone}${compact ? " compact" : ""}`}>
      <div className="weather-tile-top">
        <span>{tile.label}</span>
        <span className="weather-status">{tile.status}</span>
      </div>
      <p className="weather-value">{tile.display}</p>
      {compact ? null : <p className="weather-hint">{tile.hint}</p>}
    </article>
  );
}

export function WeatherStrip() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(force = false) {
    try {
      const next = await api.get(`/api/weather${force ? "?force=1" : ""}`);
      setData(next);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(() => load(), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (loading && !data) return <p className="quiet">Loading live weather…</p>;
  if (error && !data) return <p className="banner bad">{error}</p>;

  const sourceLabel =
    data.source === "openweathermap" ? "OPENWEATHERMAP" : data.source === "unavailable" ? "OFFLINE" : "OPEN-METEO";
  const primary = data.tiles.filter((tile) => PRIMARY.includes(tile.id));
  const rest = data.tiles.filter((tile) => !PRIMARY.includes(tile.id));
  const raised = rest.filter((tile) => !QUIET.has(tile.level));
  const more = rest.filter((tile) => QUIET.has(tile.level));

  return (
    <section className="weather-strip compact-strip">
      <div className="weather-head">
        <div>
          <div className="weather-title-row">
            <h2>Live weather</h2>
            <span className="weather-source">{sourceLabel}</span>
          </div>
          <p className="quiet weather-meta">
            {data.location} · {data.condition} · {formatRiyadh(data.fetchedAt)}
            {data.stale ? " · last reading" : ""}
            {" · "}
            <Link to="/weather">Alerts</Link>
          </p>
        </div>
        <div className="weather-head-actions">
          <a className="button ghost" href="/api/weather/report.xlsx">
            Report
          </a>
          <button type="button" className="button secondary weather-refresh" onClick={() => load(true)} aria-label="Refresh weather">
            ↻
          </button>
        </div>
      </div>
      <div className="weather-grid compact">
        {primary.concat(raised).map((tile) => (
          <Tile key={tile.id} tile={tile} compact />
        ))}
      </div>
      {more.length ? (
        <details className="weather-more">
          <summary>More readings</summary>
          <div className="weather-grid compact">
            {more.map((tile) => (
              <Tile key={tile.id} tile={tile} compact />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
