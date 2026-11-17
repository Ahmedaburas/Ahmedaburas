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
  const max = Math.max(1, ...rows.map((row) => row.count || 0));

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
    <section className="timeline-block">
      <div className="timeline-head">
        <h3>Timeline</h3>
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
      {grain === "month" ? (
        <TimelineLine
          months={timeline?.months || []}
          applied={applied}
          picked={Boolean(params.get("from"))}
          onSelect={(row) => patchParams(params, setParams, { from: row.from, to: row.to, grain: "month" })}
        />
      ) : (
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
      )}
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
    <section className="timeline-line-block">
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
  const selectedLabel = stats.selected?.label || `${formatDate(data.applied.from)} – ${formatDate(data.applied.to)}`;

  function toggleChip(key, value) {
    patchParams(params, setParams, {}, { toggleKey: key, toggleValue: value });
  }

  return (
    <section className="form-strip">
      <div className="weather-head">
        <div>
          <div className="weather-title-row">
            <h2>Near misses</h2>
            <span className="weather-source">MICROSOFT FORMS</span>
          </div>
          <p className="quiet weather-meta">
            {form.microsoftRowCount ?? 0} on the QR form · {stats.periodTotal} in {selectedLabel}
            {stats.highCritical ? ` · ${stats.highCritical} high/critical` : ""}
            {form.lastFetchedAt ? ` · ${formatRiyadh(form.lastFetchedAt)}` : ""}
          </p>
        </div>
        <div className="page-actions form-strip-actions">
          <a className="button ghost" href={form.publicUrl} target="_blank" rel="noreferrer">
            Open form
          </a>
          <a className="button secondary" href={exportHref}>
            Excel
          </a>
        </div>
      </div>
      {error ? <Banner>{error}</Banner> : null}
      {stats.timeline ? <TimelineBar timeline={stats.timeline} applied={data.applied} /> : null}
      <ActiveFilters applied={data.applied} stats={stats} />
      <div className="form-charts">
        <section>
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
        <section>
          <h3>By severity</h3>
          <SeverityDonut rows={stats.bySeverity} selectedId={params.get("nmSeverity")} onSelect={toggleChip} />
        </section>
      </div>
      <details className="dash-fold inner">
        <summary>Category, location, and records</summary>
        <div className="form-charts">
          <section>
            <h3>By category</h3>
            <StatBar
              rows={stats.byCategory.filter((row) => row.count > 0 || params.get("nmCategory") === row.id)}
              paramKey="nmCategory"
              selectedId={params.get("nmCategory")}
              onSelect={toggleChip}
            />
          </section>
          <section>
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
            <h3>Records</h3>
            <Link className="button ghost" to={stats.listHref || "/near-misses"}>
              Open list
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
            <p className="quiet">No near misses match this selection.</p>
          )}
        </section>
      </details>
      <div className="form-tools">
        {form.lastSyncError ? <span className="quiet">{form.lastSyncError}</span> : null}
        <button type="button" className="button ghost" disabled={Boolean(busy)} onClick={syncNow}>
          {busy === "sync" ? "Syncing…" : "Refresh form"}
        </button>
        <label className="button ghost file-button">
          {busy === "import" ? "Importing…" : "Import CSV"}
          <input type="file" accept=".csv,.json,.txt,.tsv" disabled={Boolean(busy)} onChange={importFile} />
        </label>
      </div>
    </section>
  );
}
