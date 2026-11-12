import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, useFetch } from "../api.js";
import { SOURCE_PATH, enumLabel, formatDate, formatWhen, riskBand, statusLabel } from "../format.js";
import { useMeta } from "../meta.js";
import { MODULES } from "../modules.js";
import { Back, Badge, Banner, PageHeader, SeverityBadge, StatusBadge } from "../ui.jsx";

function PeopleSelect({ people, name, defaultValue }) {
  return (
    <select name={name} defaultValue={defaultValue || ""} required>
      <option value="" disabled>
        Select a person
      </option>
      {people.map((person) => (
        <option key={person.id} value={person.id}>
          {person.name} · {person.jobTitle}
        </option>
      ))}
    </select>
  );
}

function StatusMover({ module, record, onDone }) {
  const meta = useMeta();
  const next = meta.transitions[module.key]?.[record.status] || [];
  const [status, setStatus] = useState(next[0] || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setStatus(next[0] || ""), [record.id, record.status, next[0]]);

  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setError("");
    try {
      await api.post(`${module.api}/${record.id}/status`, {
        status,
        note: data.get("note") || "",
        actorId: Number(data.get("actorId")),
      });
      form.reset();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2>Move status</h2>
      <p>
        Current: <StatusBadge meta={meta} status={record.status} />
      </p>
      {next.length === 0 ? (
        <p className="quiet">No further moves from {statusLabel(meta, record.status)}.</p>
      ) : (
        <>
          <label>
            <span>Next status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {next.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(meta, value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Updated by</span>
            <PeopleSelect people={meta.people} name="actorId" defaultValue={meta.people[0]?.id} />
          </label>
          <label>
            <span>Note</span>
            <textarea name="note" maxLength={1000} placeholder="Why this status is changing" />
          </label>
          {error ? <Banner>{error}</Banner> : null}
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Updating…" : "Update status"}
          </button>
        </>
      )}
    </form>
  );
}

function Timeline({ events, meta }) {
  return (
    <section className="panel">
      <h2>History</h2>
      <ol className="timeline">
        {(events || []).map((event) => (
          <li key={event.id}>
            <strong>
              {event.fromStatus
                ? `${statusLabel(meta, event.fromStatus)} → ${statusLabel(meta, event.toStatus)}`
                : statusLabel(meta, event.toStatus)}
            </strong>
            <span>
              {event.actorName || "System"} · {formatWhen(event.createdAt)}
            </span>
            {event.note ? <p>{event.note}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ActionsPanel({ record, sourceType, onDone }) {
  const meta = useMeta();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (!Array.isArray(record.actions)) return null;

  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setError("");
    try {
      await api.post("/api/actions", {
        sourceType,
        sourceId: record.id,
        title: data.get("title"),
        ownerId: Number(data.get("ownerId")),
        dueDate: data.get("dueDate"),
      });
      form.reset();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="block">
      <h2>Actions</h2>
      {record.actions.length === 0 ? <p className="quiet">No actions on this record yet.</p> : null}
      <ul className="linked-list">
        {record.actions.map((action) => (
          <li key={action.id}>
            <Link to={`/actions/${action.id}`}>
              {action.reference} · {action.title}
            </Link>
            <StatusBadge meta={meta} status={action.status} />
            {action.overdue ? <Badge tone="bad">Overdue</Badge> : null}
            <span className="quiet">
              Due {formatDate(action.dueDate)} · {action.ownerName}
            </span>
          </li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={onSubmit}>
        <h3>Add an action</h3>
        <label>
          <span>What needs to happen</span>
          <input name="title" required maxLength={200} />
        </label>
        <div className="split-fields">
          <label>
            <span>Owner</span>
            <PeopleSelect people={meta.people} name="ownerId" defaultValue={meta.people[0]?.id} />
          </label>
          <label>
            <span>Due date</span>
            <input name="dueDate" type="date" required defaultValue={meta.today} />
          </label>
        </div>
        {error ? <Banner>{error}</Banner> : null}
        <button className="button secondary" type="submit" disabled={saving}>
          {saving ? "Adding…" : "Add action"}
        </button>
      </form>
    </section>
  );
}

function FindingsPanel({ record, onDone }) {
  const meta = useMeta();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const canAdd = ["in_progress", "findings_open"].includes(record.status);

  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setError("");
    try {
      await api.post(`/api/audits/${record.id}/findings`, {
        description: data.get("description"),
        severity: data.get("severity"),
        ownerId: Number(data.get("ownerId")),
        dueDate: data.get("dueDate"),
      });
      form.reset();
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="block">
      <h2>Findings</h2>
      {record.findings.length === 0 ? <p className="quiet">No findings recorded.</p> : null}
      <ul className="linked-list">
        {record.findings.map((finding) => (
          <li key={finding.id}>
            <Link to={`/findings/${finding.id}`}>{finding.reference}</Link>
            <SeverityBadge code={finding.severity} label={enumLabel(meta, "findingSeverity", finding.severity)} />
            <StatusBadge meta={meta} status={finding.status} />
            {finding.overdue ? <Badge tone="bad">Overdue</Badge> : null}
            <span>{finding.description}</span>
          </li>
        ))}
      </ul>
      {canAdd ? (
        <form className="inline-form" onSubmit={onSubmit}>
          <h3>Add a finding</h3>
          <label>
            <span>Finding</span>
            <textarea name="description" required />
          </label>
          <div className="split-fields">
            <label>
              <span>Severity</span>
              <select name="severity" defaultValue="minor">
                {meta.enums.findingSeverity.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Owner</span>
              <PeopleSelect people={meta.people} name="ownerId" defaultValue={meta.people[0]?.id} />
            </label>
            <label>
              <span>Due date</span>
              <input name="dueDate" type="date" required defaultValue={meta.today} />
            </label>
          </div>
          {error ? <Banner>{error}</Banner> : null}
          <button className="button secondary" type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add finding"}
          </button>
        </form>
      ) : (
        <p className="quiet">Move the audit to in progress before adding findings.</p>
      )}
    </section>
  );
}

function CauseForm({ record, onDone }) {
  const meta = useMeta();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setError("");
    try {
      await api.post(`/api/incidents/${record.id}/cause`, {
        rootCause: data.get("rootCause"),
        actorId: Number(data.get("actorId")),
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="inline-form" onSubmit={onSubmit}>
      <h2>Investigation</h2>
      <label>
        <span>Root cause</span>
        <textarea name="rootCause" required defaultValue={record.rootCause || ""} />
      </label>
      <label>
        <span>Updated by</span>
        <PeopleSelect people={meta.people} name="actorId" defaultValue={meta.people[0]?.id} />
      </label>
      {error ? <Banner>{error}</Banner> : null}
      <button className="button secondary" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save root cause"}
      </button>
    </form>
  );
}

export function RecordView({ moduleKey }) {
  const module = MODULES[moduleKey];
  const meta = useMeta();
  const { id } = useParams();
  const state = useFetch(`${module.api}/${id}`);
  const record = state.data;
  const heading = record ? module.heading(record) : module.title;

  if (!record && state.loading) return <p className="quiet">Loading record…</p>;
  if (!record) {
    return (
      <>
        <PageHeader title="Record not found" lede={state.error || "That record is not in the register."} />
        <Back to={module.path}>Back to {module.title.toLowerCase()}</Back>
      </>
    );
  }

  const narrative = module.narrative(record);
  const facts = module.facts(record, meta).filter(([, value]) => value !== undefined);

  return (
    <article>
      <Back to={module.path}>Back to {module.title.toLowerCase()}</Back>
      <PageHeader title={heading} />
      <p className="record-ref large">{record.reference}</p>
      <div className="badge-row">
        <StatusBadge meta={meta} status={record.status} />
        {module.severityEnum && record.severity ? (
          <SeverityBadge code={record.severity} label={enumLabel(meta, module.severityEnum, record.severity)} />
        ) : null}
        {record.rating ? <SeverityBadge code={record.rating} label={enumLabel(meta, "riskRating", record.rating)} /> : null}
        {record.overdue ? <Badge tone="bad">Overdue</Badge> : null}
        {record.stale ? <Badge tone="warn">Past review</Badge> : null}
        {record.reviewDue ? <Badge tone="warn">Review due</Badge> : null}
      </div>
      {module.key === "permit" && record.overdue ? (
        <Banner tone="warn">This permit is still open after its valid-to date. Close it, suspend it, or raise a new permit with a new validity window.</Banner>
      ) : null}
      <div className="detail">
        <div className="detail-main">
          {narrative ? <p className="narrative">{narrative}</p> : null}
          {module.key === "action" ? (
            <p>
              Raised from{" "}
              <Link to={`${SOURCE_PATH[record.sourceType]}/${record.sourceId}`}>{record.sourceReference}</Link>
            </p>
          ) : null}
          {module.key === "finding" ? (
            <p>
              From audit <Link to={`/audits/${record.auditId}`}>{record.auditReference}</Link>
            </p>
          ) : null}
          <dl className="facts">
            {facts.map(([label, value, wide]) => (
              <div key={label} className={wide ? "wide" : undefined}>
                <dt>{label}</dt>
                <dd>{/^\d{4}-\d{2}-\d{2}/.test(String(value)) && String(value).length <= 10 ? formatDate(value) : value || "—"}</dd>
              </div>
            ))}
          </dl>
          {Array.isArray(record.steps) ? (
            <section className="block">
              <h2>Job steps</h2>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Step</th>
                      <th>Hazard</th>
                      <th>Controls</th>
                      <th>Before</th>
                      <th>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.steps.map((step) => (
                      <tr key={step.id}>
                        <td>{step.stepNo}</td>
                        <td>{step.taskStep}</td>
                        <td>{step.hazard}</td>
                        <td>{step.controls}</td>
                        <td>{enumLabel(meta, "jsaRisk", step.riskBefore)}</td>
                        <td>{enumLabel(meta, "jsaRisk", step.riskAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {Array.isArray(record.hazards) ? (
            <section className="block">
              <h2>Hazards</h2>
              <p className="quiet">Residual rating uses the highest score still left after controls. 1–4 low, 5–9 medium, 10–16 high, 17–25 critical.</p>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Hazard</th>
                      <th>Consequence</th>
                      <th>Inherent</th>
                      <th>Controls</th>
                      <th>Residual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.hazards.map((hazard) => (
                      <tr key={hazard.id}>
                        <td>{hazard.hazard}</td>
                        <td>{hazard.consequence}</td>
                        <td>
                          {hazard.likelihood} × {hazard.severity} = {hazard.inherentScore}{" "}
                          <SeverityBadge code={hazard.inherentRating} label={enumLabel(meta, "riskRating", hazard.inherentRating)} />
                        </td>
                        <td>{hazard.controls}</td>
                        <td>
                          {hazard.residualLikelihood} × {hazard.residualSeverity} = {hazard.residualScore}{" "}
                          <SeverityBadge code={riskBand(hazard.residualScore)} label={enumLabel(meta, "riskRating", hazard.residualRating)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {Array.isArray(record.findings) ? <FindingsPanel record={record} onDone={state.reload} /> : null}
          {module.key === "incident" ? <CauseForm record={record} onDone={state.reload} /> : null}
          <ActionsPanel record={record} sourceType={module.key} onDone={state.reload} />
        </div>
        <aside className="detail-side">
          <StatusMover module={module} record={record} onDone={state.reload} />
          <Timeline events={record.events} meta={meta} />
        </aside>
      </div>
    </article>
  );
}
