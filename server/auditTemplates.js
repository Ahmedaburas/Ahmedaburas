/**
 * Department-tailored internal audit checklists.
 * Each department gets its own report shape: focus areas, scoring items, and
 * closing questions appropriate to that function.
 */

export const AUDIT_TEMPLATES = [
  {
    departmentName: "Operations",
    focus: "Shop-floor controls, PTW interface, housekeeping, and machine guarding.",
    items: [
      ["PTW / SIMOPS", "Active permits match the work in the bay and barriers are in place."],
      ["Machine guarding", "Guards are fitted on grinders, rollers, and rotating equipment in use."],
      ["Housekeeping", "Walkways are clear of offcuts, cables are managed, and scrap is segregated."],
      ["PPE compliance", "Task PPE matches the JSA / bay rules for the jobs observed."],
      ["Emergency equipment", "Extinguishers, eye wash, and exits are unobstructed and in date."],
      ["Stop-work", "Crew can explain how to stop unsafe work and who to call."],
    ],
  },
  {
    departmentName: "Maintenance",
    focus: "Energy isolation, tool condition, spare parts storage, and workshop safety.",
    items: [
      ["LOTO / isolation", "Isolation certificates are complete and locks are applied by named owners."],
      ["Tooling", "Power tools and electrical leads are inspected and tagged."],
      ["Workshop layout", "Benches, welding bays, and storage do not block emergency routes."],
      ["Chemical / oils", "Lubricants and solvents are bunded with SDS available."],
      ["Lifting gear", "Slings and hoists in the workshop are tagged and within inspection date."],
      ["Competency", "Maintainers performing electrical or confined-space tasks hold current cards."],
    ],
  },
  {
    departmentName: "HSE",
    focus: "System ownership: procedures, training currency, drills, and leading indicators.",
    items: [
      ["Procedure control", "Controlled HSE procedures are current and accessible to users."],
      ["Training matrix", "Role-based training is tracked and overdue cards are escalated."],
      ["Incident / near-miss follow-up", "Open actions from recent events have owners and due dates."],
      ["Audit programme", "The internal audit schedule is on track for the year."],
      ["Emergency drills", "Last drill findings are closed or tracked."],
      ["Leading indicators", "Observation / PTW / JSA metrics are reviewed with supervision."],
    ],
  },
  {
    departmentName: "QA/QC",
    focus: "Inspection quality, NDT interface, calibration, and hold-point discipline.",
    items: [
      ["ITP / hold points", "Hold and witness points are respected before work proceeds."],
      ["Calibration", "Gauges and NDT equipment in use are within calibration."],
      ["Material control", "Traceability tags and MTCs match the items under inspection."],
      ["NCRs", "Non-conformances are logged, dispositioned, and closed with evidence."],
      ["Welding controls", "WPS / PQR / welder quals are available at the point of work."],
      ["Records", "Inspection records are complete, signed, and retrievable."],
    ],
  },
  {
    departmentName: "Projects",
    focus: "Construction interface, method statements, scaffolding, and client PTW.",
    items: [
      ["Method statements / JSA", "Approved method statements and JSAs cover the live scopes."],
      ["Scaffold / access", "Scaffolds are tagged and inspected; incomplete structures are red-tagged."],
      ["Client PTW", "Client or site PTW requirements are followed before starting."],
      ["SIMOPS", "Overlapping work packages are coordinated with area owners."],
      ["Temporary works", "Temporary supports and lifting plans are engineered and available."],
      ["Demobilization", "Completed areas are handed over with open hazards closed."],
    ],
  },
  {
    departmentName: "Supply Chain",
    focus: "Warehouse traffic, racking, hazardous materials, and incoming inspection.",
    items: [
      ["Traffic management", "Forklift routes and pedestrian segregation are marked and obeyed."],
      ["Racking / storage", "Loads are within rack ratings; damaged uprights are tagged."],
      ["Hazardous materials", "Flammables and chemicals are stored per SDS with inventory control."],
      ["Incoming inspection", "Damaged or non-conforming deliveries are quarantined."],
      ["Manual handling", "Heavy items use mechanical aids; team lifts are briefed."],
      ["Emergency readiness", "Spill kits and extinguishers in the warehouse are stocked and accessible."],
    ],
  },
  {
    departmentName: "Engineering",
    focus: "Design safety inputs, change control, and field engineering support.",
    items: [
      ["Design HSE input", "Hazard reviews / checklists are recorded for recent design packages."],
      ["MOC / change control", "Field changes that affect safety are approved before execution."],
      ["Lifting / temporary works design", "Calculations and drawings are controlled and current."],
      ["Constructability", "Known access and SIMOPS issues are flagged to Projects / Operations."],
      ["Document control", "Superseded drawings are removed from the shop floor."],
      ["Competency", "Engineers approving safety-critical designs are authorized."],
    ],
  },
  {
    departmentName: "Industrial Services",
    focus: "Field service crews, vehicle interface, and client site rules.",
    items: [
      ["Crew briefing", "Daily TBT covers client rules and the day's permits."],
      ["Vehicles / equipment", "Service vehicles and tools are checked before leaving the yard."],
      ["Client induction", "Personnel on client sites hold valid inductions and badges."],
      ["Waste / housekeeping", "Generated waste is segregated and removed from the client area."],
      ["Communication", "Radios / phones for emergency contact are tested."],
      ["Fatigue / travel", "Long travel or night work has a fatigue control plan."],
    ],
  },
  {
    departmentName: "HR & Admin",
    focus: "Fitness for work, visitor control, welfare, and office emergency readiness.",
    items: [
      ["Fitness for work", "Medical / fitness records required for roles are current."],
      ["Visitor / contractor gate", "Visitors are signed in and escorted as required."],
      ["Welfare", "Drinking water, toilets, and rest areas are adequate for headcount."],
      ["Office emergency", "Evacuation plans, assembly points, and wardens are posted."],
      ["Training nominations", "HR supports overdue mandatory training clearance."],
      ["Incident people support", "Injured-person support and RTW process is understood."],
    ],
  },
  {
    departmentName: "Finance",
    focus: "HSE budget release, PPE / service procurement controls, and audit evidence.",
    items: [
      ["HSE budget", "Critical HSE spend (calibration, PPE, medical) is not blocked without escalation."],
      ["Approved vendors", "Safety-critical suppliers are on the approved list."],
      ["PO evidence", "Safety purchases can be traced to approved requests."],
      ["Insurance / claims interface", "Incident cost coding aligns with HSE event references."],
      ["Record retention", "Financial records tied to HSE contracts meet retention rules."],
      ["Travel risk", "High-risk travel bookings follow the company travel safety rule."],
    ],
  },
  {
    departmentName: "IT",
    focus: "OT/IT security of HSE systems, access control, and backup of safety records.",
    items: [
      ["Access control", "HSE system accounts follow least privilege and leavers are removed."],
      ["Backup", "HSE databases and shared procedure libraries are backed up and restorable."],
      ["OT awareness", "Plant-floor devices are not running unapproved software."],
      ["Incident systems", "Downtime of HSE apps has an agreed workaround."],
      ["Cable / rack safety", "Server / network rooms keep clear egress and fire protection."],
      ["Data privacy", "Medical and personal HSE data are stored in approved locations only."],
    ],
  },
  {
    departmentName: "Sales",
    focus: "Client HSE commitments, bid inputs, and visitor safety when clients are on site.",
    items: [
      ["Bid HSE input", "Client HSE requirements are captured before commitment."],
      ["Client visits", "Visiting clients receive site rules and PPE."],
      ["Promise vs procedure", "Sales commitments do not bypass PTW or competency rules."],
      ["Complaint / claim handoff", "Safety-related client complaints reach HSE promptly."],
      ["Samples / demos", "Product demos follow the same controls as production work."],
      ["Documentation", "HSE documents sent to clients are the controlled revision."],
    ],
  },
];

export function listAuditTemplates() {
  return AUDIT_TEMPLATES.map((template) => ({
    departmentName: template.departmentName,
    focus: template.focus,
    itemCount: template.items.length,
  }));
}

export function getAuditTemplate(departmentName) {
  const needle = String(departmentName || "").trim().toLowerCase();
  return (
    AUDIT_TEMPLATES.find((template) => template.departmentName.toLowerCase() === needle) ||
    AUDIT_TEMPLATES.find((template) => needle.includes(template.departmentName.toLowerCase())) ||
    null
  );
}

export function templateItems(departmentName) {
  const template = getAuditTemplate(departmentName);
  if (!template) return null;
  return template.items.map(([section, prompt], index) => ({
    itemNo: index + 1,
    section,
    prompt,
  }));
}
