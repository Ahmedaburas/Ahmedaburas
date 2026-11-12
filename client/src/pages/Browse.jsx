import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFetch } from "../api.js";
import { enumLabel, formatDate, statusLabel } from "../format.js";
import { useMeta } from "../meta.js";
import { MODULES } from "../modules.js";
import { Badge, Empty, PageHeader, SeverityBadge, StatusBadge } from "../ui.jsx";

const FLAGS = {
  open: "Open only",
  overdue: "Overdue",
  stale: "Past review",
  recordable: "Recordable",
  lostTime: "Lost time",
  reviewDue: "Review due",
};

function optionList(meta, filter) {
  if (filter.enumKey) return meta.enums[filter.enumKey];
  return filter.options.map((value) => [value, statusLabel(meta, value)]);
}

export function Browse({ moduleKey }) {
  const module = MODULES[moduleKey];
  const meta = useMeta();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const qParam = params.get("q") || "";
  const [searchText, setSearchText] = useState(qParam);
  useEffect(() => setSearchText(qParam), [qParam]);
  const state = useFetch(`${module.api}${query ? `?${query}` : ""}`);

  function setParam(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  const extraChips = [];
  for (const [key, label] of Object.entries(FLAGS)) {
    if (params.get(key) === "1") extraChips.push([key, label]);
  }
  for (const key of ["status", "severity", "rating"]) {
    const value = params.get(key) || "";
    if (value.includes(",")) {
      const text = value
        .split(",")
        .map((code) => statusLabel(meta, code) !== code ? statusLabel(meta, code) : enumLabel(meta, key === "rating" ? "riskRating" : module.severityEnum || "nearMissSeverity", code))
        .join(", ");
      extraChips.push([key, text]);
    }
  }

  const items = state.data?.items || [];

  return (
    <>
      <PageHeader
        title={module.title}
        lede={module.lede}
        actions={
          module.create ? (
            <Link className="button" to={`${module.path}/new`}>
              {module.create}
            </Link>
          ) : null
        }
      />
      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setParam("q", String(data.get("q") || "").trim());
        }}
      >
        <label className="search">
          <span>Search</span>
          <input
            name="q"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Reference, title, or description"
          />
        </label>
        <label>
          <span>Site</span>
          <select value={params.get("siteId") || ""} onChange={(event) => setParam("siteId", event.target.value)}>
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
          <select value={params.get("departmentId") || ""} onChange={(event) => setParam("departmentId", event.target.value)}>
            <option value="">All departments</option>
            {meta.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        {module.filters.map((filter) => {
          const current = params.get(filter.param) || "";
          const choices = optionList(meta, filter);
          const known = choices.some(([value]) => value === current);
          return (
            <label key={filter.param}>
              <span>{filter.label}</span>
              <select value={known ? current : ""} onChange={(event) => setParam(filter.param, event.target.value)}>
                <option value="">All</option>
                {choices.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <label>
          <span>From</span>
          <input type="date" value={params.get("from") || ""} onChange={(event) => setParam("from", event.target.value)} />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={params.get("to") || ""} onChange={(event) => setParam("to", event.target.value)} />
        </label>
        <button className="button secondary" type="submit">
          Search
        </button>
        {query ? (
          <Link className="button ghost" to={module.path}>
            Clear
          </Link>
        ) : null}
      </form>
      <p className="date-note">{module.dateNote}</p>
      {extraChips.length ? (
        <div className="chips">
          {extraChips.map(([key, label]) => (
            <button key={key} type="button" className="chip" onClick={() => setParam(key, "")}>
              {label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}
      {state.error ? <p className="banner bad">{state.error}</p> : null}
      <p className="result-count" aria-live="polite">
        {state.data ? `${state.data.total} ${state.data.total === 1 ? "record" : "records"}` : "Loading records…"}
      </p>
      {!state.loading && items.length === 0 ? <Empty>No records match these filters.</Empty> : null}
      <div className="records">
        {items.map((item) => {
          const when = module.when(item);
          return (
            <Link key={item.id} className="record-row" to={`${module.path}/${item.id}`}>
              <span className="record-ref">{item.reference}</span>
              <span className="record-title">{module.heading(item)}</span>
              <span className="record-badges">
                <StatusBadge meta={meta} status={item.status} />
                {module.severityEnum && item.severity ? (
                  <SeverityBadge code={item.severity} label={enumLabel(meta, module.severityEnum, item.severity)} />
                ) : null}
                {item.rating ? <SeverityBadge code={item.rating} label={enumLabel(meta, "riskRating", item.rating)} /> : null}
                {item.overdue ? <Badge tone="bad">Overdue</Badge> : null}
                {item.stale ? <Badge tone="warn">Past review</Badge> : null}
              </span>
              <span className="record-meta">
                {item.siteName} · {item.departmentName}
                {item.ownerName ? ` · ${item.ownerName}` : ""}
                {when?.value ? ` · ${when.label} ${formatDate(when.value)}` : ""}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
