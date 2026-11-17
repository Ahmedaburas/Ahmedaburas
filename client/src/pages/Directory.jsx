import { useMeta } from "../meta.js";
import { PageHeader } from "../ui.jsx";

export function Directory() {
  const meta = useMeta();
  return (
    <>
      <PageHeader
        title="Sites and people"
        lede="Every module uses this same directory. A near miss, a permit, and a risk assessment all point at these sites, departments, and people."
      />
      <section className="block">
        <h2>Sites</h2>
        <div className="card-grid">
          {meta.sites.map((site) => (
            <article key={site.id} className="info-card">
              <p className="record-ref">{site.code}</p>
              <h3>{site.name}</h3>
              <p>{site.location}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="block">
        <h2>Departments</h2>
        <ul className="dept-list">
          {meta.departments.map((department) => (
            <li key={department.id}>{department.name}</li>
          ))}
        </ul>
      </section>
      <section className="block">
        <h2>People</h2>
        <div className="card-grid">
          {meta.people.map((person) => (
            <article key={person.id} className="info-card">
              <h3>{person.name}</h3>
              <p>{person.jobTitle}</p>
              <p className="quiet">
                {person.siteName} · {person.departmentName}
              </p>
              <p className="quiet">{person.email}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
