import { Link, useSearchParams } from "react-router-dom";
import { useFetch } from "../api.js";
import { formatDate } from "../format.js";
import { useMeta } from "../meta.js";
import { Banner, PageHeader } from "../ui.jsx";

function setParam(params, setParams, key, value) {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  setParams(next);
}

function KpiCard({ card }) {
  const inner = (
    <>
      <h3>{card.label}</h3>
      <p className="kpi-value">{card.display}</p>
      <p className="kpi-hint">{card.hint}</p>
    </>
  );
  if (card.href && !card.links) {
    return (
      <Link className={`kpi tone-${card.tone || "info"}`} to={card.href}>
        {inner}
      </Link>
    );
  }
  return (
    <article className={`kpi tone-${card.tone || "info"}`}>
      {inner}
      {card.links ? (
        <div className="kpi-links">
          {card.links.map((item) => (
            <Link key={item.href + item.label} to={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Trend({ trend }) {
  const max = Math.max(1, ...trend.months.flatMap((month) => month.metrics.map((metric) => metric.count)));
  return (
    <section className="block">
      <h2>Monthly trend</h2>
      <p className="quiet">{trend.caption}</p>
      <div className="legend">
        <span className="swatch nearMisses" /> Near misses
        <span className="swatch incidents" /> Incidents
      </div>
      <div className="trend-scroll">
        <div className="trend">
          {trend.months.map((month) => (
            <div key={month.month} className="trend-col">
              <div className="trend-bars">
                {month.metrics.map((metric) => (
                  <Link
                    key={metric.key}
                    to={metric.href}
                    className={`trend-bar ${metric.key} ${metric.count === 0 ? "zero" : ""}`}
                    style={{ height: `${Math.max(22, (metric.count / max) * 150)}px` }}
                    aria-label={`${month.label}, ${metric.count} ${metric.label}`}
                  >
                    {metric.count}
                  </Link>
                ))}
              </div>
              <div className="trend-label">{month.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Breakdown({ title, caption, rows }) {
  const eventMax = Math.max(
    1,
    ...rows.flatMap((row) => row.metrics.filter((metric) => metric.key !== "openActions").map((metric) => metric.count)),
  );
  const actionMax = Math.max(1, ...rows.map((row) => row.metrics.find((metric) => metric.key === "openActions")?.count || 0));
  return (
    <section className="block">
      <h2>{title}</h2>
      <p className="quiet">{caption}</p>
      <div className="break-list">
        {rows.map((row) => (
          <div key={row.id} className="break-row">
            <h3>{row.name}</h3>
            {row.metrics.map((metric) => {
              const max = metric.key === "openActions" ? actionMax : eventMax;
              const width = metric.count === 0 ? "0%" : `${Math.max(8, (metric.count / max) * 100)}%`;
              return (
                <Link key={metric.key} className="metric" to={metric.href}>
                  <span className="metric-label">{metric.label}</span>
                  <span className="metric-track">
                    <span className={`metric-fill ${metric.key}`} style={{ width }} />
                  </span>
                  <span className="metric-count">{metric.count}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function Severity({ title, panel }) {
  const max = Math.max(1, ...panel.rows.map((row) => row.count));
  return (
    <section className="block">
      <h2>{title}</h2>
      <p className="quiet">{panel.caption}</p>
      <div className="sev-list">
        {panel.rows.map((row) => (
          <Link key={row.id} className="metric" to={row.href}>
            <span className="metric-label">{row.label}</span>
            <span className="metric-track">
              <span className={`metric-fill sev ${row.id}`} style={{ width: row.count ? `${Math.max(8, (row.count / max) * 100)}%` : "0%" }} />
            </span>
            <span className="metric-count">{row.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatusBoard({ title, board }) {
  return (
    <section className="block">
      <h2>{title}</h2>
      <p className="quiet">{board.caption}</p>
      <div className="status-board">
        {board.rows.map((row) => (
          <Link key={row.id} className="status-tile" to={row.href}>
            <strong>{row.count}</strong>
            <span>{row.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Dashboard() {
  const meta = useMeta();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const state = useFetch(`/api/kpis${query ? `?${query}` : ""}`);
  const data = state.data;
  const from = params.get("from") || data?.applied.from || "";
  const to = params.get("to") || data?.applied.to || "";
  const period = data ? data.headlines.filter((card) => card.group === "period") : [];
  const workload = data ? data.headlines.filter((card) => card.group === "workload") : [];

  return (
    <>
      <PageHeader
        title="Inma Steel · Safety performance"
        lede="Live counts from near misses, incidents, audits, permits, job safety analyses, and risk assessments. Every number opens the records it counts."
      />
      <div className="filters">
        <label>
          <span>Site</span>
          <select value={params.get("siteId") || ""} onChange={(event) => setParam(params, setParams, "siteId", event.target.value)}>
            <option value="">All sites</option>
            {meta.sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Department</span>
          <select
            value={params.get("departmentId") || ""}
            onChange={(event) => setParam(params, setParams, "departmentId", event.target.value)}
          >
            <option value="">All departments</option>
            {meta.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From</span>
          <input type="date" value={from} onChange={(event) => setParam(params, setParams, "from", event.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={to} onChange={(event) => setParam(params, setParams, "to", event.target.value)} />
        </label>
        {query ? (
          <Link className="button ghost" to="/">
            Clear
          </Link>
        ) : null}
      </div>
      {data ? (
        <p className="date-note">
          Period {formatDate(data.applied.from)} to {formatDate(data.applied.to)}. Open workload ignores this period and stays current.
        </p>
      ) : null}
      {state.error ? <Banner>{state.error}</Banner> : null}
      {!data && state.loading ? <p className="quiet">Loading the dashboard…</p> : null}
      {data ? (
        <>
          <section className="block">
            <h2>In the selected period</h2>
            <div className="kpi-grid">
              {period.map((card) => (
                <KpiCard key={card.id} card={card} />
              ))}
            </div>
          </section>
          <section className="block">
            <h2>Open workload</h2>
            <div className="kpi-grid">
              {workload.map((card) => (
                <KpiCard key={card.id} card={card} />
              ))}
            </div>
          </section>
          <Trend trend={data.trend} />
          <div className="two">
            <Breakdown title="By site" caption={data.bySite.caption} rows={data.bySite.rows} />
            <Breakdown title="By department" caption={data.byDepartment.caption} rows={data.byDepartment.rows} />
          </div>
          <div className="two">
            <Severity title="Near-miss severity" panel={data.severity.nearMisses} />
            <Severity title="Incident severity" panel={data.severity.incidents} />
            <Severity title="Open findings" panel={data.severity.findings} />
            <Severity title="Risk register" panel={data.severity.risks} />
          </div>
          <StatusBoard title="Permits by status" board={data.statusBoards.permits} />
          <div className="two">
            <StatusBoard title="Audits by status" board={data.statusBoards.audits} />
            <StatusBoard title="JSAs by status" board={data.statusBoards.jsas} />
          </div>
          <details className="notes">
            <summary>How these numbers are counted</summary>
            <ul>
              {data.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </>
  );
}
