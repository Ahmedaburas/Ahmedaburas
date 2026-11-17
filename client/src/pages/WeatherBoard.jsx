import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

function toneClass(title) {
  if (title.includes("Heat")) return "tone-warn";
  if (title.includes("Rain")) return "tone-info";
  if (title.includes("Wind")) return "tone-caution";
  return "tone-good";
}

export function WeatherBoard() {
  const [weather, setWeather] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const next = await api.get("/api/weather");
      setWeather(next);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  const messages = weather?.alertMessages || [];
  const invite = weather?.settings?.whatsappGroupInvite;
  const groupName = weather?.settings?.whatsappGroupName || "HSE weather";

  return (
    <section className="weather-board">
      <p className="quiet">
        <Link to="/weather">Weather alerts</Link> · live board · auto-refreshes every 30 seconds · no WhatsApp login
      </p>
      <h1>{groupName}</h1>
      {error ? <p className="banner bad">{error}</p> : null}
      {weather?.settings?.autoNotify === false ? (
        <p className="banner info">Auto sending is off. Turn it on from Weather alerts.</p>
      ) : (
        <p className="lede">Auto sending is on. Heat stress, rain, and wind each appear here as their own card when that threshold is crossed.</p>
      )}
      {messages.length === 0 ? (
        <p className="empty">No SOP-59 threshold is exceeded. Wind, rain, and WBGT are inside limits.</p>
      ) : (
        <div className="weather-grid">
          {messages.map((message) => (
            <article key={message.title} className={`weather-tile ${toneClass(message.title)}`}>
              <pre className="alert-copy">{message.text}</pre>
            </article>
          ))}
        </div>
      )}
      {invite ? (
        <p className="quiet">
          WhatsApp group invite (for joining only):{" "}
          <a href={invite} target="_blank" rel="noreferrer">
            {invite}
          </a>
        </p>
      ) : null}
    </section>
  );
}
