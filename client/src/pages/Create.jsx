import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { enumLabel, riskBand } from "../format.js";
import { useMeta } from "../meta.js";
import { Banner, PageHeader } from "../ui.jsx";

function useSaver(apiPath, clientPath) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(body) {
    setSaving(true);
    setError("");
    try {
      const record = await api.post(apiPath, body);
      navigate(`${clientPath}/${record.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }
  return { error, saving, save };
}

function Field({ label, children, wide, hint }) {
  return (
    <label className={wide ? "wide" : undefined}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function SiteFields() {
  const meta = useMeta();
  return (
    <>
      <Field label="Site">
        <select name="siteId" required defaultValue="">
          <option value="" disabled>
            Select a site
          </option>
          {meta.sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Department">
        <select name="departmentId" required defaultValue="">
          <option value="" disabled>
            Select a department
          </option>
          {meta.departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function PersonField({ label, name }) {
  const meta = useMeta();
  return (
    <Field label={label}>
      <select name={name} required defaultValue="">
        <option value="" disabled>
          Select a person
        </option>
        {meta.people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name} · {person.jobTitle}
          </option>
        ))}
      </select>
    </Field>
  );
}

function EnumField({ label, name, enumKey, defaultValue }) {
  const meta = useMeta();
  return (
    <Field label={label}>
      <select name={name} defaultValue={defaultValue} required>
        {meta.enums[enumKey].map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}

function FormShell({ title, lede, cancel, error, children, actions }) {
  return (
    <form className="form-card" onSubmit={(event) => event.preventDefault()}>
      <PageHeader title={title} lede={lede} />
      {error ? <Banner>{error}</Banner> : null}
      <div className="form-grid">{children}</div>
      <div className="form-actions">
        <Link className="button ghost" to={cancel}>
          Cancel
        </Link>
        {actions}
      </div>
    </form>
  );
}

function num(data, key) {
  return Number(data.get(key));
}

export function NearMissForm() {
  const meta = useMeta();
  const { error, saving, save } = useSaver("/api/near-misses", "/near-misses");
  function submit(status, event) {
    const form = event.currentTarget.closest("form");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    save({
      status,
      title: data.get("title"),
      description: data.get("description"),
      siteId: num(data, "siteId"),
      departmentId: num(data, "departmentId"),
      reportedBy: num(data, "reportedBy"),
      occurredAt: data.get("occurredAt"),
      locationDetail: data.get("locationDetail"),
      category: data.get("category"),
      severity: data.get("severity"),
      potentialConsequence: data.get("potentialConsequence"),
      immediateAction: data.get("immediateAction"),
    });
  }
  return (
    <FormShell
      title="Report a near miss"
      lede="Describe what happened and what was done straight away."
      cancel="/near-misses"
      error={error}
      actions={
        <>
          <button className="button secondary" type="button" disabled={saving} onClick={(event) => submit("draft", event)}>
            Save draft
          </button>
          <button className="button" type="button" disabled={saving} onClick={(event) => submit("submitted", event)}>
            Submit report
          </button>
        </>
      }
    >
      <Field label="Title" wide>
        <input name="title" required maxLength={160} />
      </Field>
      <Field label="What happened" wide>
        <textarea name="description" required />
      </Field>
      <SiteFields />
      <PersonField label="Reported by" name="reportedBy" />
      <Field label="Occurred">
        <input name="occurredAt" type="date" required defaultValue={meta.today} max={meta.today} />
      </Field>
      <Field label="Location">
        <input name="locationDetail" maxLength={200} />
      </Field>
      <EnumField label="Category" name="category" enumKey="nearMissCategory" defaultValue="procedure" />
      <EnumField label="Severity" name="severity" enumKey="nearMissSeverity" defaultValue="medium" />
      <Field label="Potential consequence" wide>
        <textarea name="potentialConsequence" />
      </Field>
      <Field label="Immediate action" wide>
        <textarea name="immediateAction" />
      </Field>
    </FormShell>
  );
}

export function IncidentForm() {
  const meta = useMeta();
  const { error, saving, save } = useSaver("/api/incidents", "/incidents");
  function submit(status, event) {
    const form = event.currentTarget.closest("form");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    save({
      status,
      title: data.get("title"),
      description: data.get("description"),
      siteId: num(data, "siteId"),
      departmentId: num(data, "departmentId"),
      reportedBy: num(data, "reportedBy"),
      occurredAt: data.get("occurredAt"),
      locationDetail: data.get("locationDetail"),
      incidentType: data.get("incidentType"),
      severity: data.get("severity"),
      injuredName: data.get("injuredName"),
      bodyPart: data.get("bodyPart"),
      daysLost: Number(data.get("daysLost") || 0),
      immediateAction: data.get("immediateAction"),
      rootCause: data.get("rootCause"),
    });
  }
  return (
    <FormShell
      title="Report an incident"
      lede="Record what happened. The investigation and actions follow from the record."
      cancel="/incidents"
      error={error}
      actions={
        <>
          <button className="button secondary" type="button" disabled={saving} onClick={(event) => submit("draft", event)}>
            Save draft
          </button>
          <button className="button" type="button" disabled={saving} onClick={(event) => submit("reported", event)}>
            Submit report
          </button>
        </>
      }
    >
      <Field label="Title" wide>
        <input name="title" required maxLength={160} />
      </Field>
      <Field label="What happened" wide>
        <textarea name="description" required />
      </Field>
      <SiteFields />
      <PersonField label="Reported by" name="reportedBy" />
      <Field label="Occurred">
        <input name="occurredAt" type="date" required defaultValue={meta.today} max={meta.today} />
      </Field>
      <Field label="Location">
        <input name="locationDetail" maxLength={200} />
      </Field>
      <EnumField label="Type" name="incidentType" enumKey="incidentType" defaultValue="injury" />
      <EnumField label="Severity" name="severity" enumKey="incidentSeverity" defaultValue="first_aid" />
      <Field label="Person involved">
        <input name="injuredName" maxLength={160} />
      </Field>
      <Field label="Body part">
        <input name="bodyPart" maxLength={120} />
      </Field>
      <Field label="Days lost">
        <input name="daysLost" type="number" min="0" step="1" defaultValue="0" />
      </Field>
      <Field label="Immediate action" wide>
        <textarea name="immediateAction" />
      </Field>
      <Field label="Root cause, if already known" wide>
        <textarea name="rootCause" />
      </Field>
    </FormShell>
  );
}

export function AuditForm() {
  const meta = useMeta();
  const { error, saving, save } = useSaver("/api/audits", "/audits");
  function submit(event) {
    const form = event.currentTarget.closest("form");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    save({
      title: data.get("title"),
      auditType: data.get("auditType"),
      siteId: num(data, "siteId"),
      departmentId: num(data, "departmentId"),
      leadAuditor: num(data, "leadAuditor"),
      scheduledDate: data.get("scheduledDate"),
      scope: data.get("scope"),
    });
  }
  return (
    <FormShell
      title="Plan an audit"
      lede="The audit starts as planned. Move it to in progress when the fieldwork begins, then record findings."
      cancel="/audits"
      error={error}
      actions={
        <button className="button" type="button" disabled={saving} onClick={submit}>
          Plan audit
        </button>
      }
    >
      <Field label="Title" wide>
        <input name="title" required maxLength={160} />
      </Field>
      <EnumField label="Type" name="auditType" enumKey="auditType" defaultValue="internal" />
      <SiteFields />
      <PersonField label="Lead auditor" name="leadAuditor" />
      <Field label="Scheduled date">
        <input name="scheduledDate" type="date" required defaultValue={meta.today} />
      </Field>
      <Field label="Scope" wide>
        <textarea name="scope" />
      </Field>
    </FormShell>
  );
}

export function PermitForm() {
  const meta = useMeta();
  const { error, saving, save } = useSaver("/api/permits", "/permits");
  function submit(status, event) {
    const form = event.currentTarget.closest("form");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    save({
      status,
      title: data.get("title"),
      permitType: data.get("permitType"),
      siteId: num(data, "siteId"),
      departmentId: num(data, "departmentId"),
      requesterId: num(data, "requesterId"),
      issuerId: data.get("issuerId") ? num(data, "issuerId") : null,
      locationDetail: data.get("locationDetail"),
      workDescription: data.get("workDescription"),
      hazards: data.get("hazards"),
      controls: data.get("controls"),
      validFrom: data.get("validFrom"),
      validTo: data.get("validTo"),
    });
  }
  return (
    <FormShell
      title="New work permit"
      lede="Save a draft, or request approval once the permit authority is named."
      cancel="/permits"
      error={error}
      actions={
        <>
          <button className="button secondary" type="button" disabled={saving} onClick={(event) => submit("draft", event)}>
            Save draft
          </button>
          <button className="button" type="button" disabled={saving} onClick={(event) => submit("requested", event)}>
            Request approval
          </button>
        </>
      }
    >
      <Field label="Title" wide>
        <input name="title" required maxLength={160} />
      </Field>
      <EnumField label="Permit type" name="permitType" enumKey="permitType" defaultValue="hot_work" />
      <SiteFields />
      <PersonField label="Requester" name="requesterId" />
      <Field label="Permit authority" hint="Required before you request approval.">
        <select name="issuerId" defaultValue="">
          <option value="">Not yet assigned</option>
          {meta.people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name} · {person.jobTitle}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Location">
        <input name="locationDetail" maxLength={200} />
      </Field>
      <Field label="Valid from">
        <input name="validFrom" type="date" required defaultValue={meta.today} />
      </Field>
      <Field label="Valid to">
        <input name="validTo" type="date" required defaultValue={meta.today} />
      </Field>
      <Field label="Work description" wide>
        <textarea name="workDescription" required />
      </Field>
      <Field label="Hazards" wide>
        <textarea name="hazards" />
      </Field>
      <Field label="Controls" wide>
        <textarea name="controls" />
      </Field>
    </FormShell>
  );
}

const emptyStep = () => ({ taskStep: "", hazard: "", controls: "", riskBefore: "medium", riskAfter: "low" });

export function JsaForm() {
  const meta = useMeta();
  const { error, saving, save } = useSaver("/api/jsa", "/jsa");
  const [steps, setSteps] = useState([emptyStep()]);
  const validDefault = meta.today.replace(/^\d{4}/, (year) => String(Number(year) + 1));

  function update(index, key, value) {
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, [key]: value } : step)));
  }

  function submit(event) {
    const form = event.currentTarget.closest("form");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    save({
      jobTitle: data.get("jobTitle"),
      siteId: num(data, "siteId"),
      departmentId: num(data, "departmentId"),
      preparedBy: num(data, "preparedBy"),
      taskDescription: data.get("taskDescription"),
      ppe: data.get("ppe"),
      validUntil: data.get("validUntil"),
      steps,
    });
  }

  return (
    <FormShell
      title="New job safety analysis"
      lede="Break the job into steps. Each step needs the hazard and the controls."
      cancel="/jsa"
      error={error}
      actions={
        <button className="button" type="button" disabled={saving} onClick={submit}>
          Save draft
        </button>
      }
    >
      <Field label="Job title" wide>
        <input name="jobTitle" required maxLength={160} />
      </Field>
      <SiteFields />
      <PersonField label="Prepared by" name="preparedBy" />
      <Field label="Valid until">
        <input name="validUntil" type="date" required defaultValue={validDefault} />
      </Field>
      <Field label="Task description" wide>
        <textarea name="taskDescription" required />
      </Field>
      <Field label="PPE" wide>
        <input name="ppe" />
      </Field>
      <div className="wide repeater">
        <div className="repeater-head">
          <h2>Steps</h2>
          <button type="button" className="button secondary" onClick={() => setSteps((current) => [...current, emptyStep()])}>
            Add step
          </button>
        </div>
        {steps.map((step, index) => (
          <fieldset key={index} className="repeat-card">
            <legend>Step {index + 1}</legend>
            <Field label="Task">
              <input value={step.taskStep} required onChange={(event) => update(index, "taskStep", event.target.value)} />
            </Field>
            <Field label="Hazard">
              <input value={step.hazard} required onChange={(event) => update(index, "hazard", event.target.value)} />
            </Field>
            <Field label="Controls">
              <input value={step.controls} required onChange={(event) => update(index, "controls", event.target.value)} />
            </Field>
            <Field label="Risk before controls">
              <select value={step.riskBefore} onChange={(event) => update(index, "riskBefore", event.target.value)}>
                {meta.enums.jsaRisk.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Risk after controls">
              <select value={step.riskAfter} onChange={(event) => update(index, "riskAfter", event.target.value)}>
                {meta.enums.jsaRisk.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            {steps.length > 1 ? (
              <button type="button" className="button ghost" onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}>
                Remove step
              </button>
            ) : null}
          </fieldset>
        ))}
      </div>
    </FormShell>
  );
}

const emptyHazard = () => ({
  hazard: "",
  consequence: "",
  likelihood: 3,
  severity: 3,
  controls: "",
  residualLikelihood: 2,
  residualSeverity: 2,
});

function ScoreHint({ likelihood, severity }) {
  const meta = useMeta();
  const score = Number(likelihood) * Number(severity);
  const band = riskBand(score);
  return (
    <p className="score-hint">
      Score {score} · {enumLabel(meta, "riskRating", band)}
    </p>
  );
}

export function RiskForm() {
  const meta = useMeta();
  const { error, saving, save } = useSaver("/api/risks", "/risks");
  const [hazards, setHazards] = useState([emptyHazard()]);
  const reviewDefault = meta.today.replace(/^\d{4}/, (year) => String(Number(year) + 1));

  function update(index, key, value) {
    setHazards((current) => current.map((hazard, i) => (i === index ? { ...hazard, [key]: value } : hazard)));
  }

  function submit(event) {
    const form = event.currentTarget.closest("form");
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    save({
      title: data.get("title"),
      siteId: num(data, "siteId"),
      departmentId: num(data, "departmentId"),
      assessorId: num(data, "assessorId"),
      activity: data.get("activity"),
      reviewDate: data.get("reviewDate"),
      hazards,
    });
  }

  return (
    <FormShell
      title="New risk assessment"
      lede="Score each hazard before controls and again with the controls in place."
      cancel="/risks"
      error={error}
      actions={
        <button className="button" type="button" disabled={saving} onClick={submit}>
          Save draft
        </button>
      }
    >
      <Field label="Title" wide>
        <input name="title" required maxLength={160} />
      </Field>
      <SiteFields />
      <PersonField label="Assessor" name="assessorId" />
      <Field label="Review date">
        <input name="reviewDate" type="date" required defaultValue={reviewDefault} />
      </Field>
      <Field label="Activity" wide>
        <textarea name="activity" required />
      </Field>
      <div className="wide repeater">
        <div className="repeater-head">
          <h2>Hazards</h2>
          <button type="button" className="button secondary" onClick={() => setHazards((current) => [...current, emptyHazard()])}>
            Add hazard
          </button>
        </div>
        {hazards.map((hazard, index) => (
          <fieldset key={index} className="repeat-card">
            <legend>Hazard {index + 1}</legend>
            <Field label="Hazard">
              <input value={hazard.hazard} required onChange={(event) => update(index, "hazard", event.target.value)} />
            </Field>
            <Field label="Consequence">
              <input value={hazard.consequence} onChange={(event) => update(index, "consequence", event.target.value)} />
            </Field>
            <Field label="Likelihood before controls">
              <select value={hazard.likelihood} onChange={(event) => update(index, "likelihood", Number(event.target.value))}>
                {meta.enums.likelihood.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Severity before controls">
              <select value={hazard.severity} onChange={(event) => update(index, "severity", Number(event.target.value))}>
                {meta.enums.consequence.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <ScoreHint likelihood={hazard.likelihood} severity={hazard.severity} />
            <Field label="Controls" wide>
              <textarea value={hazard.controls} onChange={(event) => update(index, "controls", event.target.value)} />
            </Field>
            <Field label="Residual likelihood">
              <select value={hazard.residualLikelihood} onChange={(event) => update(index, "residualLikelihood", Number(event.target.value))}>
                {meta.enums.likelihood.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Residual severity">
              <select value={hazard.residualSeverity} onChange={(event) => update(index, "residualSeverity", Number(event.target.value))}>
                {meta.enums.consequence.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <ScoreHint likelihood={hazard.residualLikelihood} severity={hazard.residualSeverity} />
            {hazards.length > 1 ? (
              <button type="button" className="button ghost" onClick={() => setHazards((current) => current.filter((_, i) => i !== index))}>
                Remove hazard
              </button>
            ) : null}
          </fieldset>
        ))}
      </div>
    </FormShell>
  );
}

const FORMS = {
  nearMiss: NearMissForm,
  incident: IncidentForm,
  audit: AuditForm,
  permit: PermitForm,
  jsa: JsaForm,
  risk: RiskForm,
};

export function CreateForm({ moduleKey }) {
  const Form = FORMS[moduleKey];
  if (!Form) return <p>This module has no create form.</p>;
  return <Form />;
}
