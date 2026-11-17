import {
  ENUMS,
  RISK_REGISTER_STATUSES,
  STATUS_LABELS,
  TRANSITIONS,
  clipMonth,
  eachMonth,
  emptyFilter,
  link,
  monthLabel,
  resolvePeriod,
} from "./domain.js";
import {
  hoursInPeriod,
  listActions,
  listAudits,
  listDepartments,
  listFindings,
  listIncidents,
  listJsas,
  listNearMisses,
  listPermits,
  listRisks,
  listSites,
} from "./records.js";

function periodOf(filter) {
  return {
    from: filter.from,
    to: filter.to,
    siteId: filter.siteId,
    departmentId: filter.departmentId,
  };
}

function metric(key, label, count, href) {
  return { key, label, count, href };
}

export function buildKpis(db, query) {
  const resolved = resolvePeriod(query);
  const { from, to, siteId, departmentId } = resolved;
  const period = emptyFilter({ from, to, siteId, departmentId });
  const scope = emptyFilter({ siteId, departmentId });
  const periodParams = periodOf(period);
  const scopeParams = { siteId, departmentId };

  const nearMisses = listNearMisses(db, period);
  const incidents = listIncidents(db, period);
  const recordable = listIncidents(db, emptyFilter({ ...periodParams, recordable: true }));
  const lostTime = listIncidents(db, emptyFilter({ ...periodParams, lostTime: true }));
  const closedIncidents = listIncidents(db, emptyFilter({ ...periodParams, status: ["closed"] }));
  const audits = listAudits(db, period);
  const openActions = listActions(db, emptyFilter({ ...scopeParams, open: true }));
  const overdueActions = listActions(db, emptyFilter({ ...scopeParams, overdue: true }));
  const overduePermits = listPermits(db, emptyFilter({ ...scopeParams, overdue: true }));
  const openFindings = listFindings(db, emptyFilter({ ...scopeParams, open: true }));
  const register = listRisks(db, emptyFilter({ ...scopeParams, status: RISK_REGISTER_STATUSES }));
  const elevated = register.filter((item) => item.rating === "high" || item.rating === "critical");
  const reviewDue = listRisks(db, emptyFilter({ ...scopeParams, reviewDue: true }));
  const staleJsas = listJsas(db, emptyFilter({ ...scopeParams, stale: true }));
  const hours = hoursInPeriod(db, { from, to, siteId });

  const events = nearMisses.length + incidents.length;
  const share = events === 0 ? "—" : `${Math.round((nearMisses.length / events) * 100)}%`;
  const ratio = incidents.length === 0 ? "—" : (nearMisses.length / incidents.length).toFixed(1);
  const trir = hours ? ((recordable.length * 200000) / hours).toFixed(2) : "—";
  const ltir = hours ? ((lostTime.length * 200000) / hours).toFixed(2) : "—";
  const closure = incidents.length === 0 ? "—" : `${Math.round((closedIncidents.length / incidents.length) * 100)}%`;

  const headlines = [
    {
      id: "near-misses",
      group: "period",
      label: "Near misses",
      display: String(nearMisses.length),
      count: nearMisses.length,
      hint: "Reported in the selected period.",
      href: link("/near-misses", periodParams),
      tone: "info",
    },
    {
      id: "incidents",
      group: "period",
      label: "Incidents",
      display: String(incidents.length),
      count: incidents.length,
      hint: "Occurred in the selected period.",
      href: link("/incidents", periodParams),
      tone: incidents.length ? "bad" : "good",
    },
    {
      id: "proactive-share",
      group: "period",
      label: "Proactive reporting",
      display: share,
      hint: "Near misses as a share of near misses plus incidents.",
      tone: "info",
      links: [
        { label: `${nearMisses.length} near misses`, count: nearMisses.length, href: link("/near-misses", periodParams) },
        { label: `${incidents.length} incidents`, count: incidents.length, href: link("/incidents", periodParams) },
      ],
    },
    {
      id: "nm-ratio",
      group: "period",
      label: "Near misses per incident",
      display: ratio,
      hint: "Near-miss count divided by the incident count. A dash means there were no incidents.",
      tone: "info",
      links: [
        { label: `${nearMisses.length} near misses`, count: nearMisses.length, href: link("/near-misses", periodParams) },
        { label: `${incidents.length} incidents`, count: incidents.length, href: link("/incidents", periodParams) },
      ],
    },
    {
      id: "trir",
      group: "period",
      label: "TRIR",
      display: trir,
      hint: `Recordable incidents × 200,000 ÷ ${hours.toLocaleString("en-US")} hours. Hours are full months at the selected sites and are not split by department.`,
      tone: "info",
      links: [
        {
          label: `${recordable.length} recordable incidents`,
          count: recordable.length,
          href: link("/incidents", { ...periodParams, recordable: "1" }),
        },
      ],
    },
    {
      id: "ltir",
      group: "period",
      label: "LTIR",
      display: ltir,
      hint: "Lost-time incidents × 200,000 ÷ the same hours used for TRIR.",
      tone: "info",
      links: [
        {
          label: `${lostTime.length} lost-time incidents`,
          count: lostTime.length,
          href: link("/incidents", { ...periodParams, lostTime: "1" }),
        },
      ],
    },
    {
      id: "closure",
      group: "period",
      label: "Incident closure",
      display: closure,
      hint: "Closed incidents divided by incidents in the period.",
      tone: "good",
      links: [
        {
          label: `${closedIncidents.length} closed`,
          count: closedIncidents.length,
          href: link("/incidents", { ...periodParams, status: "closed" }),
        },
        {
          label: `${incidents.length} in period`,
          count: incidents.length,
          href: link("/incidents", periodParams),
        },
      ],
    },
    {
      id: "audits",
      group: "period",
      label: "Audits",
      display: String(audits.length),
      count: audits.length,
      hint: "Scheduled in the selected period.",
      href: link("/audits", periodParams),
      tone: "info",
    },
    {
      id: "open-actions",
      group: "workload",
      label: "Open actions",
      display: String(openActions.length),
      count: openActions.length,
      hint: "Still open or in progress, including overdue. Current, not limited to the period.",
      href: link("/actions", { ...scopeParams, open: "1" }),
      tone: "warn",
    },
    {
      id: "overdue-actions",
      group: "workload",
      label: "Overdue actions",
      display: String(overdueActions.length),
      count: overdueActions.length,
      hint: "Open actions whose due date is before today.",
      href: link("/actions", { ...scopeParams, overdue: "1" }),
      tone: overdueActions.length ? "bad" : "good",
    },
    {
      id: "overdue-permits",
      group: "workload",
      label: "Overdue permits",
      display: String(overduePermits.length),
      count: overduePermits.length,
      hint: "Approved, active, or suspended permits past their valid-to date.",
      href: link("/permits", { ...scopeParams, overdue: "1" }),
      tone: overduePermits.length ? "bad" : "good",
    },
    {
      id: "open-findings",
      group: "workload",
      label: "Open audit findings",
      display: String(openFindings.length),
      count: openFindings.length,
      hint: "Findings that are not closed.",
      href: link("/findings", { ...scopeParams, open: "1" }),
      tone: "warn",
    },
    {
      id: "elevated-risks",
      group: "workload",
      label: "High and critical risks",
      display: String(elevated.length),
      count: elevated.length,
      hint: "Current register only: in review, approved, or review due. Highest residual score is high or critical.",
      href: link("/risks", { ...scopeParams, status: RISK_REGISTER_STATUSES, rating: ["high", "critical"] }),
      tone: elevated.length ? "bad" : "good",
    },
    {
      id: "risk-review",
      group: "workload",
      label: "Risks past review",
      display: String(reviewDue.length),
      count: reviewDue.length,
      hint: "Marked review due, or still approved after the review date.",
      href: link("/risks", { ...scopeParams, reviewDue: "1" }),
      tone: "warn",
    },
    {
      id: "jsa-stale",
      group: "workload",
      label: "JSAs past review",
      display: String(staleJsas.length),
      count: staleJsas.length,
      hint: "Expired, or approved and past the valid-until date.",
      href: link("/jsa", { ...scopeParams, stale: "1" }),
      tone: "warn",
    },
  ];

  const nmForSites = listNearMisses(db, emptyFilter({ from, to, departmentId }));
  const incForSites = listIncidents(db, emptyFilter({ from, to, departmentId }));
  const actionsForSites = listActions(db, emptyFilter({ open: true, departmentId }));
  const bySite = listSites(db).map((site) => ({
    id: site.id,
    name: site.name,
    metrics: [
      metric("nearMisses", "Near misses", nmForSites.filter((row) => row.siteId === site.id).length, link("/near-misses", { from, to, departmentId, siteId: site.id })),
      metric("incidents", "Incidents", incForSites.filter((row) => row.siteId === site.id).length, link("/incidents", { from, to, departmentId, siteId: site.id })),
      metric("openActions", "Open actions", actionsForSites.filter((row) => row.siteId === site.id).length, link("/actions", { open: "1", departmentId, siteId: site.id })),
    ],
  }));

  const nmForDepts = listNearMisses(db, emptyFilter({ from, to, siteId }));
  const incForDepts = listIncidents(db, emptyFilter({ from, to, siteId }));
  const actionsForDepts = listActions(db, emptyFilter({ open: true, siteId }));
  const byDepartment = listDepartments(db).map((department) => ({
    id: department.id,
    name: department.name,
    metrics: [
      metric("nearMisses", "Near misses", nmForDepts.filter((row) => row.departmentId === department.id).length, link("/near-misses", { from, to, siteId, departmentId: department.id })),
      metric("incidents", "Incidents", incForDepts.filter((row) => row.departmentId === department.id).length, link("/incidents", { from, to, siteId, departmentId: department.id })),
      metric("openActions", "Open actions", actionsForDepts.filter((row) => row.departmentId === department.id).length, link("/actions", { open: "1", siteId, departmentId: department.id })),
    ],
  }));

  const months = eachMonth(from, to).map((month) => {
    const bounds = clipMonth(month, from, to);
    const monthParams = { ...periodParams, ...bounds };
    return {
      month,
      label: monthLabel(month),
      metrics: [
        metric("nearMisses", "Near misses", nearMisses.filter((row) => row.occurredAt.slice(0, 7) === month).length, link("/near-misses", monthParams)),
        metric("incidents", "Incidents", incidents.filter((row) => row.occurredAt.slice(0, 7) === month).length, link("/incidents", monthParams)),
      ],
    };
  });

  const severity = {
    nearMisses: {
      caption: "Near misses in the period, by severity.",
      rows: ENUMS.nearMissSeverity.map(([id, label]) => ({
        id,
        label,
        count: nearMisses.filter((row) => row.severity === id).length,
        href: link("/near-misses", { ...periodParams, severity: id }),
      })),
    },
    incidents: {
      caption: "Incidents in the period, by severity.",
      rows: ENUMS.incidentSeverity.map(([id, label]) => ({
        id,
        label,
        count: incidents.filter((row) => row.severity === id).length,
        href: link("/incidents", { ...periodParams, severity: id }),
      })),
    },
    findings: {
      caption: "Open audit findings now, by severity.",
      rows: ENUMS.findingSeverity.map(([id, label]) => ({
        id,
        label,
        count: openFindings.filter((row) => row.severity === id).length,
        href: link("/findings", { ...scopeParams, open: "1", severity: id }),
      })),
    },
    risks: {
      caption: "Current risk register, by the highest residual score. Drafts and archived assessments are excluded.",
      rows: ENUMS.riskRating.map(([id, label]) => ({
        id,
        label,
        count: register.filter((row) => row.rating === id).length,
        href: link("/risks", { ...scopeParams, status: RISK_REGISTER_STATUSES, rating: id }),
      })),
    },
  };

  const permits = listPermits(db, scope);
  const jsas = listJsas(db, scope);
  const permitStatuses = Object.keys(TRANSITIONS.permit);
  const auditStatuses = Object.keys(TRANSITIONS.audit);
  const jsaStatuses = Object.keys(TRANSITIONS.jsa);

  return {
    applied: { from, to, siteId, departmentId },
    headlines,
    trend: {
      caption: "Near misses and incidents in each month of the selected period.",
      months,
    },
    bySite: {
      caption: "Across every site. Uses the department filter and ignores the site filter. Open actions are current; events use the period.",
      rows: bySite,
    },
    byDepartment: {
      caption: "Across every department. Uses the site filter and ignores the department filter. Open actions are current; events use the period.",
      rows: byDepartment,
    },
    severity,
    statusBoards: {
      permits: {
        caption: "All permits for the selected site and department.",
        rows: permitStatuses.map((id) => ({
          id,
          label: STATUS_LABELS[id],
          count: permits.filter((row) => row.status === id).length,
          href: link("/permits", { ...scopeParams, status: id }),
        })),
      },
      audits: {
        caption: "Audits scheduled in the selected period.",
        rows: auditStatuses.map((id) => ({
          id,
          label: STATUS_LABELS[id],
          count: audits.filter((row) => row.status === id).length,
          href: link("/audits", { ...periodParams, status: id }),
        })),
      },
      jsas: {
        caption: "All job safety analyses for the selected site and department.",
        rows: jsaStatuses.map((id) => ({
          id,
          label: STATUS_LABELS[id],
          count: jsas.filter((row) => row.status === id).length,
          href: link("/jsa", { ...scopeParams, status: id }),
        })),
      },
    },
    notes: [
      "Near misses, incidents, audits, rates, and the monthly trend use the selected period.",
      "Open actions, overdue permits, open findings, the risk register, and JSA validity are the current picture. They follow the site and department filters and ignore the period.",
      "The site chart ignores a selected site so every site stays visible. The department chart does the same for departments.",
      "TRIR counts medical treatment, lost time, and serious incidents. LTIR counts lost-time incidents. Both use monthly hours for every month the period touches.",
      "A permit is overdue when it is approved, active, or suspended and the valid-to date is before today.",
      "Risk bands use the highest residual score: 1–4 low, 5–9 medium, 10–16 high, 17–25 critical.",
      "Every number links to the list of records it counts.",
    ],
  };
}
