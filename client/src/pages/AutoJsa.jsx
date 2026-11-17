import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useMeta } from "../meta.js";
import { Banner, PageHeader } from "../ui.jsx";

export function AutoJsa() {
  const meta = useMeta();
  const navigate = useNavigate();
  const standards = meta.standards || [];
  const [orgId, setOrgId] = useState(standards[0]?.id || "aramco");
  const [jobId, setJobId] = useState(standards[0]?.jobs?.[0]?.id || "");
  const [siteId, setSiteId] = useState(meta.sites[0]?.id || "");
  const [departmentId, setDepartmentId] = useState(meta.departments[0]?.id || "");
  const [preparedBy, setPreparedBy] = useState(meta.people.find((person) => person.departmentName === "HSE")?.id || meta.people[0]?.id || "");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const org = useMemo(() => standards.find((item) => item.id === orgId), [standards, orgId]);
  const jobs = org?.jobs || [];

  useEffect(() => {
    if (!jobs.some((job) => job.id === jobId)) setJobId(jobs[0]?.id || "");
  }, [jobs, jobId]);

  useEffect(() => {
    if (!orgId || !jobId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    api
      .get(`/api/standards/${orgId}/jobs/${jobId}`)
      .then((data) => {
        if (!cancelled) {
          setPreview(data);
          setError("");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview(null);
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, jobId]);

  async function generate() {
    setSaving(true);
    setError("");
    try {
      const created = await api.post("/api/jsa/auto-generate", {
        standardOrg: orgId,
        jobId,
        siteId: Number(siteId),
        departmentId: Number(departmentId),
        preparedBy: Number(preparedBy),
      });
      navigate(`/jsa/${created.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Auto JSA from standards"
        lede="Generate a draft job safety analysis from the saved Saudi Aramco, SABIC, or Maaden templates. Review the steps before approval."
        actions={
          <Link className="button secondary" to="/jsa">
            All JSAs
          </Link>
        }
      />
      <Banner tone="bad">{error}</Banner>
      <section className="panel stack-form">
        <div className="form-grid">
          <label>
            <span>Standard</span>
            <select value={orgId} onChange={(event) => setOrgId(event.target.value)}>
              {standards.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Saved job template</span>
            <select value={jobId} onChange={(event) => setJobId(event.target.value)}>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
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
            <span>Department</span>
            <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              {meta.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Prepared by</span>
            <select value={preparedBy} onChange={(event) => setPreparedBy(event.target.value)}>
              {meta.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} · {person.jobTitle}
                </option>
              ))}
            </select>
          </label>
        </div>
        {org ? <p className="hint">{org.summary}</p> : null}
        <div className="page-actions">
          <button type="button" className="button" disabled={saving || !preview} onClick={generate}>
            {saving ? "Generating…" : "Generate draft JSA"}
          </button>
        </div>
      </section>

      {preview ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>{preview.jobTitle}</h2>
          <p className="lede">{preview.taskDescription}</p>
          <p>
            <strong>References:</strong> {preview.standardRefs.join(" · ")}
          </p>
          <p>
            <strong>PPE:</strong> {preview.ppe}
          </p>
          <div className="table-wrap">
            <table>
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
                {preview.steps.map((step, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{step.taskStep}</td>
                    <td>{step.hazard}</td>
                    <td>{step.controls}</td>
                    <td>{step.riskBefore}</td>
                    <td>{step.riskAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
