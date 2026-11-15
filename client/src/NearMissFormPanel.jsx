import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "./api.js";
import { formatDate } from "./format.js";
import { Banner } from "./ui.jsx";

function formatRiyadh(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function StatBar({ rows, tone = "nearMisses" }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="stat-bars">
      {rows.map((row) => (
        <div key={row.id} className="metric">
          <span className="metric-label">{row.label}</span>
          <span className="metric-track">
            <span className={`metric-fill ${tone} sev ${row.id}`} style={{ width: row.count ? `${Math.max(8, (row.count / max) * 100)}%` : "0%" }} />
          </span>
          <span className="metric-count">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

function shortLabel(grain, label) {
  if (grain === "month") return label.replace(/ 20/, " ");
  if (grain === "quarter") return label.replace(/ 20/, " ");
  return label;
}

function TimelineBar({ timeline, applied }) {
  const [params, setParams] = useSearchParams();
  const [grain, setGrain] = useState("month");
  const rows = timeline?.[grain] || [];
  const max = Math.max(1, ...rows.map((row) => row.count));

  function selectBucket(row) {
    const next = new URLSearchParams(params);
    next.set("from", row.from);
    next.set("to", row.to);
    setParams(next);
  }

  return (
    <section className="block timeline-block">
      <div className="timeline-head">
        <h3>Near miss timeline</h3>
        <div className="grain-toggle" role="tablist" aria-label="Timeline grouping">
          {[
            ["year", "Years"],
            ["quarter", "Quarters"],
            ["month", "Months"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={grain === id}
              className={grain === id ? "grain-btn active" : "grain-btn"}
              onClick={() => setGrain(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="quiet">Each bar is a {grain}. Select one to set the dashboard dates.</p>
      <div className="timeline-scroll">
        <div className={`timeline-track grain-${grain}`}>
          {rows.map((row) => {
            const selected = applied?.from === row.from && applied?.to === row.to;
            return (
              <button
                key={row.id}
                type="button"
                className={`timeline-col ${row.count === 0 ? "zero" : ""} ${selected ? "selected" : ""}`}
                onClick={() => selectBucket(row)}
                aria-pressed={selected}
                aria-label={`${row.label}, ${row.count} near misses`}
              >
                <span className="timeline-count">{row.count}</span>
                <span className="timeline-fill-wrap">
                  <span className="timeline-fill" style={{ height: `${Math.max(8, (row.count / max) * 100)}%` }} />
                </span>
                <span className="timeline-label">{shortLabel(grain, row.label)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SeverityDonut({ rows }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const colors = {
    low: "#1f7a4d",
    medium: "#c48a16",
    high: "#c2410c",
    critical: "#9d261e",
    unspecified: "#8a8181",
  };
  let cursor = 0;
  const stops = rows
    .filter((row) => row.count > 0)
    .map((row) => {
      const start = cursor;
      cursor += total ? (row.count / total) * 360 : 0;
      return `${colors[row.id] || "#5f5757"} ${start}deg ${cursor}deg`;
    });
  return (
    <div className="stat-donut-wrap">
      <div
        className="stat-donut"
        style={{ background: stops.length ? `conic-gradient(${stops.join(", ")})` : "#eee" }}
        aria-hidden="true"
      />
      <ul className="stat-donut-legend">
        {rows.map((row) => (
          <li key={row.id}>
            <span className={`dot-swatch sev ${row.id}`} />
            {row.label} · {row.count}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NearMissFormPanel({ query }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  function formUrl({ force = false, exportExcel = false, sync = false } = {}) {
    const params = new URLSearchParams(query || "");
    if (force) params.set("force", "1");
    const qs = params.toString();
    const path = exportExcel ? "/api/near-miss-form/export.xlsx" : sync ? "/api/near-miss-form/sync" : "/api/near-miss-form";
    return `${path}${qs ? `?${qs}` : ""}`;
  }

  async function load(force = false) {
    try {
      const next = await api.get(formUrl({ force }));
      setData(next);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [query]);

  const exportHref = useMemo(() => formUrl({ exportExcel: true }), [query]);

  async function syncNow() {
    setBusy("sync");
    try {
      const next = await api.post(formUrl({ sync: true }), {});
      setData(next);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("import");
    try {
      const text = await file.text();
      const payload = file.name.toLowerCase().endsWith(".json") ? JSON.parse(text) : { csv: text };
      await api.post("/api/near-miss-form/import", payload);
      await load(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (!data && !error) return <p className="quiet">Loading near-miss form…</p>;
  if (error && !data) return <Banner>{error}</Banner>;

  const form = data.form;
  const stats = data.stats;
  const usingForm = data.source === "form";

  return (
    <section className="form-strip block">
      <div className="weather-head">
        <div>
          <div className="weather-title-row">
            <h2>Near miss form</h2>
            <span className="weather-source">MICROSOFT FORMS</span>
          </div>
          <p className="quiet weather-meta">{form.title.trim()}</p>
          <p className="quiet">
            {form.microsoftRowCount ?? 0} responses on Microsoft Forms · {form.syncedCount} copied here · last read{" "}
            {formatRiyadh(form.lastFetchedAt)} (Asia/Riyadh)
          </p>
        </div>
        <div className="page-actions form-strip-actions">
          <a className="button secondary" href={form.publicUrl} target="_blank" rel="noreferrer">
            Open form
          </a>
          <a className="button" href={exportHref}>
            Download Excel
          </a>
        </div>
      </div>
      {error ? <Banner>{error}</Banner> : null}
      <div className="kpi-grid form-kpis">
        <article className="kpi tone-info">
          <h3>On the QR form</h3>
          <p className="kpi-value">{form.microsoftRowCount ?? 0}</p>
          <p className="kpi-hint">Live count from the linked Microsoft Form.</p>
        </article>
        <article className="kpi tone-info">
          <h3>In this period</h3>
          <p className="kpi-value">{stats.periodTotal}</p>
          <p className="kpi-hint">{usingForm ? "Synced form rows in the selected dates." : "HSE register near misses until form rows are copied in."}</p>
        </article>
        <article className="kpi tone-info">
          <h3>This month</h3>
          <p className="kpi-value">{stats.thisMonth}</p>
          <p className="kpi-hint">Occurred in the current calendar month.</p>
        </article>
        <article className={`kpi ${stats.highCritical ? "tone-warn" : "tone-good"}`}>
          <h3>High / critical</h3>
          <p className="kpi-value">{stats.highCritical}</p>
          <p className="kpi-hint">The more serious reports in this period.</p>
        </article>
      </div>
      <p className="quiet form-caption">
        {usingForm
          ? "Charts below use the Microsoft Forms near-miss rows copied into this platform."
          : "Microsoft Forms keeps the answer sheet behind an owner login. Charts below use the HSE near-miss register until a Forms Excel/CSV is imported or an owner token is set."}{" "}
        Period {formatDate(data.applied.from)} to {formatDate(data.applied.to)}.
        {form.lastSyncError ? ` ${form.lastSyncError}` : ""}
      </p>
      {stats.timeline ? <TimelineBar timeline={stats.timeline} applied={data.applied} /> : null}
      <div className="form-charts">
        <section className="block">
          <h3>By severity</h3>
          <SeverityDonut rows={stats.bySeverity} />
        </section>
        <section className="block">
          <h3>By category</h3>
          <StatBar rows={stats.byCategory.filter((row) => row.count > 0)} />
        </section>
        <section className="block">
          <h3>By location</h3>
          <StatBar rows={stats.byLocation} tone="openActions" />
        </section>
      </div>
      {data.recent?.length ? (
        <ul className="form-recent">
          {data.recent.map((row) => (
            <li key={row.id}>
              {row.source === "register" ? (
                <Link to={`/near-misses/${row.id.replace(/^nm-/, "")}`}>{row.reference}</Link>
              ) : (
                <strong>{row.reference?.slice(0, 18) || "Form"}</strong>
              )}
              <span>{row.title}</span>
              <span className="quiet">
                {formatDate(row.occurredAt)} · {row.siteName} · {row.severity || "unspecified"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="form-tools">
        <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={syncNow}>
          {busy === "sync" ? "Syncing…" : "Refresh form"}
        </button>
        <label className="button ghost file-button">
          {busy === "import" ? "Importing…" : "Import Forms Excel/CSV"}
          <input type="file" accept=".csv,.json,.txt,.tsv" disabled={Boolean(busy)} onChange={importFile} />
        </label>
        <Link className="button ghost" to="/near-misses">
          Open near-miss list
        </Link>
      </div>
    </section>
  );
}
