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

function patchParams(params, setParams, updates, { toggleKey, toggleValue } = {}) {
  const next = new URLSearchParams(params);
  if (toggleKey) {
    if (next.get(toggleKey) === String(toggleValue)) next.delete(toggleKey);
    else next.set(toggleKey, String(toggleValue));
  }
  for (const [key, value] of Object.entries(updates || {})) {
    if (value === null || value === undefined || value === false) next.delete(key);
    else if (value === true) continue;
    else next.set(key, String(value));
  }
  setParams(next);
}

function StatBar({ rows, tone = "nearMisses", paramKey, selectedId, onSelect }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="stat-bars">
      {rows.map((row) => {
        const selected = selectedId === row.id;
        const inner = (
          <>
            <span className="metric-label">{row.label}</span>
            <span className="metric-track">
              <span className={`metric-fill ${tone} sev ${row.id}`} style={{ width: row.count ? `${Math.max(8, (row.count / max) * 100)}%` : "0%" }} />
            </span>
            <span className="metric-count">{row.count}</span>
          </>
        );
        if (!onSelect) {
          return (
            <div key={row.id} className={`metric ${selected ? "selected" : ""}`}>
              {inner}
            </div>
          );
        }
        return (
          <button
            key={row.id}
            type="button"
            className={`metric chart-btn ${selected ? "selected" : ""}`}
            aria-pressed={selected}
            onClick={() => onSelect(paramKey, row.id)}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

function shortLabel(grain, label) {
  if (grain === "month") return label.replace(/ 20/, " ");
  if (grain === "quarter") return label.replace(/ 20/, " ");
  return label;
}

const GRAIN_KEYS = { year: "years", quarter: "quarters", month: "months" };

function TimelineBar({ timeline, applied }) {
  const [params, setParams] = useSearchParams();
  const grain = ["year", "quarter", "month"].includes(params.get("grain")) ? params.get("grain") : "month";
  const rows = timeline?.[GRAIN_KEYS[grain]] || [];
  const max = Math.max(1, ...rows.map((row) => row.count));

  function setGrain(nextGrain) {
    const nextRows = timeline?.[GRAIN_KEYS[nextGrain]] || [];
    if (params.get("from") && params.get("to")) {
      const from = params.get("from");
      const to = params.get("to");
      const exact = nextRows.find((row) => row.from === from && row.to === to);
      if (exact) {
        patchParams(params, setParams, { grain: nextGrain });
        return;
      }
      const parent = nextRows.find((row) => from >= row.from && to <= row.to);
      if (parent) {
        patchParams(params, setParams, { grain: nextGrain, from: parent.from, to: parent.to });
        return;
      }
    }
    patchParams(params, setParams, { grain: nextGrain });
  }

  function selectBucket(row) {
    const selected = applied?.from === row.from && applied?.to === row.to;
    if (selected) {
      patchParams(params, setParams, { from: null, to: null, grain });
      return;
    }
    patchParams(params, setParams, { from: row.from, to: row.to, grain: row.grain });
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
      <p className="quiet">
        Bars stay on the full record. Select a {grain} to filter the dashboard KPIs, charts, and records below.
      </p>
      <div className="timeline-scroll">
        <div className={`timeline-track grain-${grain}`}>
          {rows.map((row) => {
            const selected = applied?.from === row.from && applied?.to === row.to;
            const contained = !selected && applied?.from && applied.from >= row.from && applied.to <= row.to;
            return (
              <button
                key={row.id}
                type="button"
                className={`timeline-col ${row.count === 0 ? "zero" : ""} ${selected ? "selected" : ""} ${contained ? "contained" : ""}`}
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

function TimelineLine({ months, applied, onSelect, picked }) {
  if (!months?.length) return null;
  const width = 720;
  const height = 168;
  const pad = { left: 28, right: 12, top: 18, bottom: 32 };
  const max = Math.max(1, ...months.map((row) => row.count));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const points = months.map((row, index) => {
    const x = pad.left + (months.length === 1 ? innerW / 2 : (index / (months.length - 1)) * innerW);
    const y = pad.top + innerH - (row.count / max) * innerH;
    return { ...row, x, y, year: String(row.id).slice(0, 4) };
  });
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  return (
    <section className="block timeline-line-block">
      <h3>Near misses over time</h3>
      <p className="quiet">Line follows the same 2025–2026 counts as the bars. Click a point to filter the pie and other charts.</p>
      <svg className="timeline-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Near misses by month">
        <path d={path} className="timeline-line-path" />
        {points.map((point) => {
          const selected = picked && applied?.from === point.from && applied?.to === point.to;
          const contained = picked && !selected && applied?.from && point.from >= applied.from && point.to <= applied.to;
          return (
            <g key={point.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={selected ? 6 : 4.5}
                className={`timeline-line-dot year-${point.year} ${selected ? "selected" : ""} ${contained ? "contained" : ""}`}
                onClick={() => onSelect(point)}
              >
                <title>{`${point.label}: ${point.count}`}</title>
              </circle>
              {point.count > 0 ? (
                <text x={point.x} y={point.y - 8} className="timeline-line-count">
                  {point.count}
                </text>
              ) : null}
              <text x={point.x} y={height - 8} className="timeline-line-label">
                {shortLabel("month", point.label)}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

function SeverityDonut({ rows, selectedId, onSelect, paramKey = "nmSeverity" }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const colors = {
    low: "#1f7a4d",
    medium: "#c48a16",
    high: "#c2410c",
    critical: "#9d261e",
    unspecified: "#8a8181",
    "year-2025": "#8a5a08",
    "year-2026": "#1f6f8a",
    "year-2024": "#5f5757",
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
        {rows.map((row) => {
          const selected = selectedId === row.id;
          if (!onSelect) {
            return (
              <li key={row.id}>
                <span className={`dot-swatch sev ${row.id}`} />
                {row.label} · {row.count}
              </li>
            );
          }
          return (
            <li key={row.id}>
              <button
                type="button"
                className={`legend-btn ${selected ? "selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onSelect(paramKey, row.id)}
              >
                <span className={`dot-swatch sev ${row.id}`} />
                {row.label} · {row.count}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActiveFilters({ applied, stats }) {
  const [params, setParams] = useSearchParams();
  const chips = [];
  if (params.get("from")) {
    chips.push({
      id: "period",
      label: stats.selected?.label || `${formatDate(applied.from)} – ${formatDate(applied.to)}`,
      onClear: () => patchParams(params, setParams, { from: null, to: null }),
    });
  }
  const named = [
    ["nmSeverity", stats.bySeverity],
    ["nmCategory", stats.byCategory],
    ["nmLocation", stats.byLocation],
  ];
  for (const [key, rows] of named) {
    const value = params.get(key);
    if (!value) continue;
    const row = rows.find((item) => item.id === value);
    chips.push({
      id: key,
      label: row?.label || value,
      onClear: () => patchParams(params, setParams, { [key]: null }),
    });
  }
  if (!chips.length) return null;
  return (
    <div className="filter-chips" aria-label="Active dashboard filters">
      {chips.map((chip) => (
        <button key={chip.id} type="button" className="filter-chip" onClick={chip.onClear}>
          {chip.label}
          <span aria-hidden="true"> ×</span>
        </button>
      ))}
    </div>
  );
}

export function NearMissFormPanel({ query }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [params, setParams] = useSearchParams();
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
  const selectedLabel = stats.selected?.label || `${formatDate(data.applied.from)} – ${formatDate(data.applied.to)}`;

  function toggleChip(key, value) {
    patchParams(params, setParams, {}, { toggleKey: key, toggleValue: value });
  }

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
      {stats.timeline ? <TimelineBar timeline={stats.timeline} applied={data.applied} /> : null}
      {stats.timeline?.months?.length ? (
        <TimelineLine
          months={stats.timeline.months}
          applied={data.applied}
          picked={Boolean(params.get("from"))}
          onSelect={(row) => patchParams(params, setParams, { from: row.from, to: row.to, grain: "month" })}
        />
      ) : null}
      <ActiveFilters applied={data.applied} stats={stats} />
      <div className="kpi-grid form-kpis">
        <article className="kpi tone-info">
          <h3>On the QR form</h3>
          <p className="kpi-value">{form.microsoftRowCount ?? 0}</p>
          <p className="kpi-hint">Live count from the linked Microsoft Form.</p>
        </article>
        <Link className="kpi tone-info" to={stats.listHref || "/near-misses"}>
          <h3>In this period</h3>
          <p className="kpi-value">{stats.periodTotal}</p>
          <p className="kpi-hint">
            {usingForm ? "Synced form rows matching the timeline selection." : "HSE register near misses matching the timeline selection."}
          </p>
        </Link>
        <article className="kpi tone-info">
          <h3>This month</h3>
          <p className="kpi-value">{stats.thisMonth}</p>
          <p className="kpi-hint">Occurred in the current calendar month, inside the selection.</p>
        </article>
        <article className={`kpi ${stats.highCritical ? "tone-warn" : "tone-good"}`}>
          <h3>High / critical</h3>
          <p className="kpi-value">{stats.highCritical}</p>
          <p className="kpi-hint">The more serious reports in {selectedLabel}.</p>
        </article>
      </div>
      <p className="quiet form-caption">
        {usingForm
          ? "Charts and records below use the Microsoft Forms near-miss rows copied into this platform."
          : "Microsoft Forms keeps the answer sheet behind an owner login. Charts below use the HSE register until a Forms Excel/CSV is imported or an owner token is set."}{" "}
        Showing {selectedLabel}. Click a severity, category, or location to keep slicing the same period.
        {form.lastSyncError ? ` ${form.lastSyncError}` : ""}
      </p>
      <div className="form-charts">
        <section className="block">
          <h3>By year</h3>
          <SeverityDonut
            rows={(stats.byYear || []).map((row) => ({ ...row, id: `year-${row.id}` }))}
            selectedId={stats.selected?.grain === "year" ? `year-${stats.selected.id}` : ""}
            onSelect={(_key, id) => {
              const year = (stats.byYear || []).find((row) => `year-${row.id}` === id);
              if (!year) return;
              const selected = data.applied.from === year.from && data.applied.to === year.to;
              if (selected) patchParams(params, setParams, { from: null, to: null, grain: "year" });
              else patchParams(params, setParams, { from: year.from, to: year.to, grain: "year" });
            }}
          />
        </section>
        <section className="block">
          <h3>By severity</h3>
          <SeverityDonut rows={stats.bySeverity} selectedId={params.get("nmSeverity")} onSelect={toggleChip} />
        </section>
        <section className="block">
          <h3>By category</h3>
          <StatBar
            rows={stats.byCategory.filter((row) => row.count > 0 || params.get("nmCategory") === row.id)}
            paramKey="nmCategory"
            selectedId={params.get("nmCategory")}
            onSelect={toggleChip}
          />
        </section>
        <section className="block">
          <h3>By location</h3>
          <StatBar
            rows={stats.byLocation}
            tone="openActions"
            paramKey="nmLocation"
            selectedId={params.get("nmLocation")}
            onSelect={toggleChip}
          />
        </section>
      </div>
      <section className="related-records">
        <div className="timeline-head">
          <h3>Records in {selectedLabel}</h3>
          <Link className="button ghost" to={stats.listHref || "/near-misses"}>
            Open matching list
          </Link>
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
        ) : (
          <p className="quiet">No near misses match this timeline selection.</p>
        )}
      </section>
      <div className="form-tools">
        <button type="button" className="button secondary" disabled={Boolean(busy)} onClick={syncNow}>
          {busy === "sync" ? "Syncing…" : "Refresh form"}
        </button>
        <label className="button ghost file-button">
          {busy === "import" ? "Importing…" : "Import Forms Excel/CSV"}
          <input type="file" accept=".csv,.json,.txt,.tsv" disabled={Boolean(busy)} onChange={importFile} />
        </label>
      </div>
    </section>
  );
}
