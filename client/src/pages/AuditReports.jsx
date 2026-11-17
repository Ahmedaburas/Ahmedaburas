import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, useFetch } from "../api.js";
import { statusLabel } from "../format.js";
import { useMeta } from "../meta.js";
import { Banner, PageHeader, StatusBadge } from "../ui.jsx";

export function AuditReports() {
  const meta = useMeta();
  const navigate = useNavigate();
  const list = useFetch("/api/audit-reports");
  const templates = meta.auditTemplates || [];
  const [departmentId, setDepartmentId] = useState(templates[0]?.departmentId || meta.departments[0]?.id || "");
  const [siteId, setSiteId] = useState(meta.sites[0]?.id || "");
  const [leadAuditor, setLeadAuditor] = useState(
    meta.people.find((person) => person.departmentName === "HSE")?.id || meta.people[0]?.id || "",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => String(template.departmentId) === String(departmentId)),
    [templates, departmentId],
  );

  async function createReport() {
    setSaving(true);
    setError("");
    try {
      const report = await api.post("/api/audit-reports", {
        departmentId: Number(departmentId),
        siteId: Number(siteId),
        leadAuditor: Number(leadAuditor),
        scheduledDate: meta.today,
      });
      navigate(`/audit-reports/${report.audit.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Department internal audit reports"
        lede="Start an internal audit from the checklist saved for that department. Score the items to build the report."
        actions={
          <Link className="button secondary" to="/audits">
            All audits
          </Link>
        }
      />
      <Banner tone="bad">{error}</Banner>
      <section className="panel stack-form">
        <div className="form-grid">
          <label>
            <span>Department template</span>
            <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              {templates.map((template) => (
                <option key={template.departmentName} value={template.departmentId || ""}>
                  {template.departmentName} ({template.itemCount} items)
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Site</span>
            <select value={siteId} onChange={(event) => setSiteId(event.target.value)}>
              {meta.sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Lead auditor</span>
            <select value={leadAuditor} onChange={(event) => setLeadAuditor(event.target.value)}>
              {meta.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} · {person.jobTitle}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedTemplate ? <p className="hint">{selectedTemplate.focus}</p> : null}
        <div className="page-actions">
          <button type="button" className="button" disabled={saving || !departmentId} onClick={createReport}>
            {saving ? "Creating…" : "Create department audit report"}
          </button>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Saved department reports</h2>
        {list.loading && !list.data ? <p className="empty">Loading…</p> : null}
        {list.error ? <Banner>{list.error}</Banner> : null}
        {list.data?.items?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Department</th>
                  <th>Site</th>
                  <th>Scheduled</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/audit-reports/${item.id}`}>{item.reference}</Link>
                    </td>
                    <td>{item.templateDepartment || item.departmentName}</td>
                    <td>{item.siteName}</td>
                    <td>{item.scheduledDate}</td>
                    <td>{item.score == null ? "—" : `${item.score}%`}</td>
                    <td>
                      <StatusBadge meta={meta} status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No department-tailored audit reports yet.</p>
        )}
      </section>
    </>
  );
}

export function AuditReportView() {
  const meta = useMeta();
  const { id } = useParams();
  const state = useFetch(`/api/audits/${id}/report`);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const actorId = meta.people.find((person) => person.departmentName === "HSE")?.id || meta.people[0]?.id;

  useEffect(() => {
    if (state.data?.checklist) {
      setItems(state.data.checklist.map((item) => ({ ...item })));
    }
  }, [state.data]);

  function updateItem(itemId, key, value) {
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, [key]: value } : item)));
  }

  async function saveChecklist() {
    setSaving(true);
    setError("");
    try {
      const report = await api.post(`/api/audits/${id}/checklist`, {
        actorId,
        items: items.map((item) => ({ id: item.id, result: item.result, note: item.note })),
      });
      setItems(report.checklist.map((item) => ({ ...item })));
      state.reload();
      setSaving(false);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (state.loading && !state.data) return <p className="boot">Loading report…</p>;
  if (!state.data) return <Banner>{state.error || "Report not found"}</Banner>;

  const report = state.data;
  return (
    <>
      <PageHeader
        title={report.reportTitle}
        lede={report.focus}
        actions={
          <>
            <Link className="button secondary" to={`/audits/${report.audit.id}`}>
              Open audit record
            </Link>
            <Link className="button secondary" to="/audit-reports">
              All department reports
            </Link>
          </>
        }
      />
      <Banner tone="bad">{error || state.error}</Banner>
      <section className="panel">
        <dl className="facts">
          <div>
            <dt>Reference</dt>
            <dd>{report.audit.reference}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{report.departmentName}</dd>
          </div>
          <div>
            <dt>Site</dt>
            <dd>{report.audit.siteName}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{statusLabel(meta, report.audit.status)}</dd>
          </div>
          <div>
            <dt>Score</dt>
            <dd>{report.score == null ? "Not scored" : `${report.score}%`}</dd>
          </div>
          <div>
            <dt>Generated on</dt>
            <dd>{report.generatedOn}</dd>
          </div>
        </dl>
        <p className="hint">
          Conform {report.summary.conform} · Minor {report.summary.minor} · Major {report.summary.major} · N/A{" "}
          {report.summary.na} · Pending {report.summary.pending}
        </p>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="page-head-row">
          <h2>Department checklist</h2>
          <button type="button" className="button" disabled={saving || !items.length} onClick={saveChecklist}>
            {saving ? "Saving…" : "Save checklist score"}
          </button>
        </div>
        {!items.length ? (
          <p className="empty">This audit has no department checklist attached.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Section</th>
                  <th>Check</th>
                  <th>Result</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.itemNo}</td>
                    <td>{item.section}</td>
                    <td>{item.prompt}</td>
                    <td>
                      <select value={item.result} onChange={(event) => updateItem(item.id, "result", event.target.value)}>
                        <option value="pending">Pending</option>
                        <option value="conform">Conform</option>
                        <option value="minor">Minor NC</option>
                        <option value="major">Major NC</option>
                        <option value="na">N/A</option>
                      </select>
                    </td>
                    <td>
                      <input value={item.note || ""} onChange={(event) => updateItem(item.id, "note", event.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Findings on this audit</h2>
        {report.findings.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Finding</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {report.findings.map((finding) => (
                  <tr key={finding.id}>
                    <td>
                      <Link to={`/findings/${finding.id}`}>{finding.reference}</Link>
                    </td>
                    <td>{finding.description}</td>
                    <td>{finding.severity}</td>
                    <td>
                      <StatusBadge meta={meta} status={finding.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No findings raised yet. Move the audit to in progress, then add findings from the audit record.</p>
        )}
      </section>
    </>
  );
}
