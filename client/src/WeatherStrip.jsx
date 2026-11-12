import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./api.js";

function formatRiyadh(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
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

  const sourceLabel = data.source === "openweathermap" ? "OPENWEATHERMAP" : "OPEN-METEO";

  return (
    <section className="weather-strip block">
      <div className="weather-head">
        <div>
          <div className="weather-title-row">
            <h2>Live weather</h2>
            <span className="weather-source">{sourceLabel}</span>
          </div>
          <p className="quiet weather-meta">
            <span className="weather-pin" aria-hidden="true">
              📍
            </span>
            {data.location} · {data.condition}
          </p>
          <p className="quiet">
            Last updated: {formatRiyadh(data.fetchedAt)} · refreshes every {data.refreshSeconds / 60} min ·{" "}
            <Link to="/weather">Weather alerts</Link>
          </p>
        </div>
        <button type="button" className="button secondary weather-refresh" onClick={() => load(true)} aria-label="Refresh weather">
          ↻
        </button>
      </div>
      <div className="weather-grid">
        {data.tiles.map((tile) => (
          <article key={tile.id} className={`weather-tile tone-${tile.tone}`}>
            <div className="weather-tile-top">
              <span>{tile.label}</span>
              <span className="weather-status">{tile.status}</span>
            </div>
            <p className="weather-value">{tile.display}</p>
            <p className="weather-hint">{tile.hint}</p>
          </article>
        ))}
      </div>
      <div className="weather-foot">
        <p className="weather-legend">
          <strong>SOP-59 color guide:</strong>{" "}
          <span className="dot bad" /> STOP work{" "}
          <span className="dot warn" /> High risk{" "}
          <span className="dot caution" /> Caution / warn{" "}
          <span className="dot good" /> Safe
        </p>
        <p className="weather-verify">
          Verify on official sources:{" "}
          {data.verifyLinks.map((link, index) => (
            <span key={link.href}>
              {index ? " · " : ""}
              <a href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
