import { eachMonth } from "./domain.js";

function insert(db, table, row) {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map((key) => `:${key}`).join(",")})`;
  return Number(db.prepare(sql).run(row).lastInsertRowid);
}

function stamp(date, time = "08:30:00") {
  return `${date}T${time}.000Z`;
}

function event(db, entityType, entityId, status, actorId, createdAt) {
  insert(db, "status_events", {
    entity_type: entityType,
    entity_id: entityId,
    from_status: null,
    to_status: status,
    actor_id: actorId,
    note: "Sample record opened",
    created_at: createdAt,
  });
}

export function seed(db) {
  const site = {};
  const jubail = "Jubail Supporting Industries Area";
  for (const row of [
    ["SH1", "Shop 1", jubail],
    ["SH2", "Shop 2", jubail],
    ["SH3", "Shop 3", jubail],
    ["PNT", "Painting Shop", jubail],
    ["SSS", "SS Shop", jubail],
    ["CSS", "CS Shop", jubail],
    ["MNT", "Maintenance Shop", jubail],
    ["MCH", "Machine Shop", jubail],
    ["WH", "Warehouse", jubail],
    ["PST", "Painting Storage", jubail],
    ["GAN", "Gantry Area 1", jubail],
    ["FAB", "Fabrication Yard", jubail],
    ["SLN", "South Land (SRM)", jubail],
    ["NLN", "North Land (Al-Eman)", jubail],
    ["SEC", "Security Gate", jubail],
    ["ADM", "Admin Building", jubail],
    ["HTC", "HSE Training Center", jubail],
    ["SCR", "Scrap Area", jubail],
  ]) {
    site[row[0]] = insert(db, "sites", { code: row[0], name: row[1], location: row[2] });
  }

  const dept = {};
  for (const name of [
    "HR & Admin",
    "Supply Chain",
    "Operations",
    "Maintenance",
    "HSE",
    "QA/QC",
    "Industrial Services",
    "Projects",
    "Engineering",
    "Sales",
    "Finance",
    "IT",
  ]) {
    dept[name] = insert(db, "departments", { name });
  }

  const person = {};
  const people = [
    ["sara", "Sara Okonkwo", "sara.okonkwo@example.com", "HSE Manager", "ADM", "HSE"],
    ["daniel", "Daniel Brooks", "daniel.brooks@example.com", "Shop Manager", "SH1", "Operations"],
    ["priya", "Priya Shah", "priya.shah@example.com", "Operations Supervisor", "SH2", "Operations"],
    ["luis", "Luis Ortega", "luis.ortega@example.com", "Maintenance Lead", "MNT", "Maintenance"],
    ["hannah", "Hannah Cole", "hannah.cole@example.com", "HSE Advisor", "HTC", "HSE"],
    ["omar", "Omar Farouk", "omar.farouk@example.com", "Yard Superintendent", "FAB", "Industrial Services"],
    ["emily", "Emily Grant", "emily.grant@example.com", "Permit Authority", "SEC", "HSE"],
    ["noah", "Noah Patel", "noah.patel@example.com", "Maintenance Planner", "MCH", "Maintenance"],
    ["grace", "Grace Liu", "grace.liu@example.com", "Machine Shop Supervisor", "MCH", "Engineering"],
    ["ben", "Ben Carter", "ben.carter@example.com", "Supply Chain Coordinator", "WH", "Supply Chain"],
    ["amina", "Amina Diallo", "amina.diallo@example.com", "QA/QC Lead", "CSS", "QA/QC"],
    ["chris", "Chris Nguyen", "chris.nguyen@example.com", "Projects Engineer", "GAN", "Projects"],
    ["fatima", "Fatima Rahman", "fatima.rahman@example.com", "HSE Advisor", "PNT", "HSE"],
    ["owen", "Owen Blake", "owen.blake@example.com", "HR & Admin Coordinator", "ADM", "HR & Admin"],
    ["layla", "Layla Hassan", "layla.hassan@example.com", "Sales Coordinator", "ADM", "Sales"],
    ["marcus", "Marcus Reed", "marcus.reed@example.com", "Finance Analyst", "ADM", "Finance"],
    ["nina", "Nina Park", "nina.park@example.com", "IT Support Lead", "ADM", "IT"],
  ];
  for (const [key, name, email, job, siteCode, department] of people) {
    person[key] = insert(db, "people", {
      name,
      email,
      job_title: job,
      site_id: site[siteCode],
      department_id: dept[department],
    });
  }

  const nm = {};
  const nearMisses = [
    ["NM-2025-014", "Unsecured grating above pump P-201", "A deck plate beside P-201 rocked underfoot during a round. Nobody fell. The clips on the south edge were missing.", "SH1", "Maintenance", "luis", "2025-12-08", "Pump bay P-201", "housekeeping", "medium", "Fall through an open section of flooring, about 3 metres.", "Area taped off and the shift supervisor notified.", "closed"],
    ["NM-2026-001", "Wrong isolation point marked on MOV-14", "The isolation certificate listed MOV-14, but the tag was hanging on the bypass. A second check caught it before the line was opened.", "SH1", "Operations", "priya", "2026-01-14", "Amine unit, MOV-14", "isolation", "high", "Release of process fluid to the work party.", "Work stopped. Isolation redone and independently verified.", "actions_open"],
    ["NM-2026-002", "Forklift crossed the pedestrian lane", "A forklift cut the painted walkway while the loading bay was busy. The driver stopped when the banksman shouted.", "GAN", "Supply Chain", "ben", "2026-01-27", "Warehouse aisle 3", "vehicle", "low", "Struck pedestrian.", "Driver stood down for a refresher before the next task.", "closed"],
    ["NM-2026-003", "Sample bottle left open in the lab fume hood", "An amine sample sat uncapped after a handover. The hood was on. The odor was noticed by the incoming analyst.", "CSS", "QA/QC", "amina", "2026-02-11", "Laboratory prep bench", "chemical", "medium", "Inhalation of amine vapor.", "Bottle capped, hood checked, and the bench wiped down.", "under_review"],
    ["NM-2026-004", "Scaffold tag missing at the tank roof", "Two contractors were on the tank roof scaffold. The tag was blank. They came down when challenged.", "GAN", "Maintenance", "noah", "2026-03-03", "Tank T-120 roof", "height", "critical", "Fall from the tank roof.", "Scaffold quarantined until a competent inspection.", "actions_open"],
    ["NM-2026-005", "Oil residue left at the compressor skid", "A film of lube oil covered the skid step after a filter change. A technician slipped and caught the handrail.", "MNT", "Maintenance", "grace", "2026-03-18", "Compressor skid C-2", "housekeeping", "low", "Slip injury.", "Step degreased and drip tray emptied.", "closed"],
    ["NM-2026-006", "Permit not at the job site", "A cold-work crew had started flange inspection. The permit was still in the control room.", "SH1", "Operations", "daniel", "2026-03-29", "Pipe rack PR-4", "procedure", "medium", "Work going ahead without the controls on the permit.", "Job paused until the permit was at the point of work.", "submitted"],
    ["NM-2026-007", "Spanner dropped from the pipe rack", "A spanner fell from the rack to a barricaded area. The barricade held. Nobody was inside it.", "GAN", "Engineering", "omar", "2026-04-07", "Pipe rack east", "dropped_object", "high", "Struck-by injury if the barricade had been open.", "Tools tethered and the drop zone walked again.", "under_review"],
    ["NM-2026-008", "Wet floor at the office stair", "Rain was tracked onto the stair landing. There was no sign. A visitor steadied themselves on the rail.", "HTC", "HR & Admin", "owen", "2026-04-22", "Main stair, level 1", "slip_trip", "low", "Slip on the stairs.", "Mat placed and a wet-floor sign put out.", "closed"],
    ["NM-2026-009", "Grinder guard not refitted", "A bench grinder was found running with the guard loose after a wheel change.", "SH2", "Maintenance", "grace", "2026-05-06", "Workshop bay 2", "equipment", "medium", "Wheel failure or eye injury.", "Grinder isolated and the guard refitted before reuse.", "closed"],
    ["NM-2026-010", "Pickup reversed without a banksman", "A pickup reversed toward the chemical tote store. A spotter was required and was not there.", "SH1", "Supply Chain", "ben", "2026-05-19", "Tote pad, north gate", "vehicle", "high", "Contact with a tote or a person on foot.", "Vehicle stopped. Spotter rule restated at the gate.", "actions_open"],
    ["NM-2026-011", "Sheen in the outfall observation point", "A light sheen was seen in the contained outfall after rain. It did not leave the site.", "SLN", "Operations", "omar", "2026-06-09", "Outfall sump 2", "environmental", "low", "Off-site sheen if the boom had not been in place.", "Boom checked and the source traced to a dripping hose.", "closed"],
    ["NM-2026-012", "Stored energy on a blinded spool", "A blind was about to be pulled. The pressure gauge still showed a residual reading that had been logged as zero.", "SH1", "Maintenance", "luis", "2026-07-02", "Crude spool CS-19", "isolation", "critical", "Pressure release at the flange.", "Flange left closed and the bleed path redone.", "under_review"],
    ["NM-2026-013", "Harness clipped to a scaffold tube", "A painter's harness was clipped to a scaffold ledger rather than the designated point.", "PNT", "Industrial Services", "chris", "2026-07-15", "Workshop mezzanine", "height", "medium", "Fall if the ledger pulled free.", "Work stopped and the anchor point corrected.", "submitted"],
    ["NM-2026-014", "Housekeeping under the loading arm", "Empty drums and a hose blocked the escape route under loading arm 2.", "FAB", "Operations", "omar", "2026-07-28", "Jetty loading arm 2", "housekeeping", "low", "Delayed escape during a release.", "Route cleared before the next transfer.", "closed"],
    ["NM-2026-015", "Solvent odor during a transfer", "A solvent tote was venting beside the lab door. The transfer was indoors with the door open.", "PST", "QA/QC", "amina", "2026-08-11", "Laboratory corridor", "chemical", "high", "Exposure above the short-term limit.", "Transfer stopped and the corridor ventilated.", "actions_open"],
    ["NM-2026-016", "Night-shift handover missed a bypass", "The log said a bypass was closed. The field copy of the lineup still showed it open. Caught on the incoming round.", "GAN", "Operations", "omar", "2026-08-26", "Control room and manifold", "procedure", "medium", "Process left in the wrong lineup.", "Lineup corrected and both logs rewritten.", "draft"],
    ["NM-2026-017", "Unsecured valve handwheel at height", "A handwheel was left on a scaffold plank 6 metres up, not tied.", "SH1", "Maintenance", "luis", "2026-09-08", "Column C-301 scaffold", "dropped_object", "high", "Dropped handwheel to the grade.", "Handwheel removed and tools checked out of the scaffold.", "under_review"],
    ["NM-2026-018", "Pallet left in the forklift aisle", "A pallet of gaskets sat in the marked aisle overnight.", "WH", "Supply Chain", "ben", "2026-09-21", "Stores aisle B", "slip_trip", "low", "Vehicle or pedestrian contact.", "Pallet moved back to the bay.", "closed"],
    ["NM-2026-019", "Hoist pendant with a cracked case", "The pendant on the workshop hoist had a cracked casing and a sticky button.", "SSS", "Maintenance", "noah", "2026-10-05", "Workshop hoist H-3", "equipment", "medium", "Uncommanded hoist movement.", "Hoist tagged out.", "submitted"],
    ["NM-2026-020", "Rescue kit missing at the column scaffold", "The height rescue kit listed on the JSA was not at the stair tower.", "SH1", "Projects", "chris", "2026-10-20", "Column C-210", "height", "high", "Delayed rescue of a suspended person.", "Work did not start. Kit brought to the stair.", "actions_open"],
    ["NM-2026-021", "Truck queued across the muster point", "A waiting truck blocked the painted muster point during a product transfer.", "SEC", "Supply Chain", "ben", "2026-11-09", "Yard muster point B", "vehicle", "medium", "Muster delayed in an emergency.", "Truck moved and the gate instructed to hold the line short of the muster point.", "submitted"],
  ];
  for (const [reference, title, description, siteCode, department, who, date, location, category, severity, potential, action, status] of nearMisses) {
    const created = stamp(date, "09:15:00");
    const id = insert(db, "near_misses", {
      reference,
      title,
      description,
      site_id: site[siteCode],
      department_id: dept[department],
      reported_by: person[who],
      occurred_at: date,
      location_detail: location,
      category,
      severity,
      potential_consequence: potential,
      immediate_action: action,
      status,
      created_at: created,
      updated_at: created,
    });
    nm[reference] = id;
    event(db, "near_miss", id, status, person[who], created);
  }

  const inc = {};
  const incidents = [
    ["INC-2026-001", "Acid splash to the forearm during sampling", "Amine sample splashed past the cuff of a glove while a drain valve was cracked open. The technician flushed for 15 minutes and was seen at the clinic.", "SH1", "Operations", "priya", "2026-01-16", "Amine sample point S-4", "injury", "medical", "Priya Shah", "Right forearm", 0, "Flushed the arm and went to the clinic. Sample point left isolated.", "Glove cuff did not overlap the sleeve, and the drain was cracked too quickly.", "closed"],
    ["INC-2026-002", "Ankle fracture on the bund wall", "A contractor stepped off an uneven bund wall while checking a drain. The ankle was fractured. The person was off work for six days.", "GAN", "Maintenance", "noah", "2026-03-12", "Tank T-14 bund", "injury", "lost_time", "Contract mason, Southwind", "Right ankle", 6, "Area made safe. Person taken to hospital.", "Bund coping stones were uneven and the route was used as a shortcut.", "actions_open"],
    ["INC-2026-003", "Laceration while cutting a gasket", "A utility knife slipped while a gasket was being cut on the bench. The cut was cleaned and closed with steri-strips. The person returned to work.", "SH3", "Maintenance", "grace", "2026-05-04", "Workshop bench 1", "injury", "first_aid", "Grace Liu", "Left hand", 0, "First aid on site. Knife removed from the bench.", "The gasket was cut toward the hand, without a guarded blade.", "closed"],
    ["INC-2026-004", "Hydraulic oil to the containment bund", "About 40 litres of hydraulic oil drained into the compressor bund from a split hose. None left the bund. The hose was replaced the same shift.", "SH1", "Operations", "daniel", "2026-06-11", "Compressor C-2 bund", "environmental", "environmental", "", "", 0, "Bund valve confirmed closed. Absorbent laid. Hose isolated.", "The hose was past its replacement date and rubbed on a bracket.", "closed"],
    ["INC-2026-005", "Hand injury while coupling a cargo hose", "The camlock closed on a fingertip during a hose connection at the jetty. The nail bed was treated at the clinic. No lost days.", "GAN", "Operations", "omar", "2026-06-24", "Jetty hose gantry", "injury", "medical", "Jetty operator", "Left index finger", 0, "Coupling stopped. Person sent to the clinic.", "The hold-open check was skipped under time pressure.", "investigating"],
    ["INC-2026-006", "Forklift contact with racking", "A forklift nudged a racking upright in the stores. The rack was empty at that bay. No injury. The upright was bent and the bay taken out of use.", "WH", "Supply Chain", "ben", "2026-07-19", "Stores rack R-6", "property", "property", "", "", 0, "Bay quarantined. Forklift parked for a brake check.", "The aisle was tight because a pallet sat over the line.", "closed"],
    ["INC-2026-007", "Shoulder strain on a valve handwheel", "An operator strained a shoulder trying to close a stiff valve. The person was off work for eleven days. The valve was left in a safe position by a second operator.", "SH1", "Maintenance", "luis", "2026-09-14", "Cooling water valve CW-88", "injury", "lost_time", "Luis Ortega", "Right shoulder", 11, "Valve left as-is and reported. Person assessed at hospital.", "The valve had no gearbox and had not been greased on the last round.", "actions_open"],
    ["INC-2026-008", "Brief release at the jetty loading arm", "A loading arm seal wept hydrocarbon for under a minute during a cool-down. Gas alarms sounded. No injury and no off-site impact. The transfer was stopped.", "NLN", "Projects", "chris", "2026-10-02", "Jetty arm 1", "process_safety", "serious", "", "", 0, "Transfer stopped. Area mustered locally. Seal isolated.", "The seal was a trial part and the leak-test hold point was waived.", "investigating"],
    ["INC-2026-009", "Dizziness after solvent odor in the prep room", "An analyst felt dizzy after a solvent odor built up in the prep room. Fresh air restored the symptoms. No treatment beyond first aid observation.", "CSS", "QA/QC", "amina", "2026-11-04", "Laboratory prep room", "illness", "first_aid", "Amina Diallo", "", 0, "Person moved to fresh air and observed for an hour.", "", "reported"],
  ];
  for (const [reference, title, description, siteCode, department, who, date, location, type, severity, injured, body, days, action, cause, status] of incidents) {
    const created = stamp(date, "10:05:00");
    const id = insert(db, "incidents", {
      reference,
      title,
      description,
      site_id: site[siteCode],
      department_id: dept[department],
      reported_by: person[who],
      occurred_at: date,
      location_detail: location,
      incident_type: type,
      severity,
      injured_name: injured,
      body_part: body,
      days_lost: days,
      immediate_action: action,
      root_cause: cause,
      status,
      created_at: created,
      updated_at: created,
    });
    inc[reference] = id;
    event(db, "incident", id, status, person[who], created);
  }

  const aud = {};
  const audits = [
    ["AUD-2026-001", "Q1 internal HSE audit — Shop 1", "internal", "SH1", "HSE", "hannah", "2026-02-18", "2026-02-19", "Management system, isolation, and housekeeping on the amine unit and the lab.", 82, "closed"],
    ["AUD-2026-002", "Permit to work compliance — Gantry Area 1", "internal", "GAN", "HSE", "emily", "2026-04-09", "2026-04-10", "Live permits, isolations, and fire watch on the jetty and tank farm.", 74, "findings_open"],
    ["AUD-2026-003", "Behavioral observations — Machine Shop", "behavioral", "MCH", "Maintenance", "fatima", "2026-06-16", "2026-06-17", "Five days of observations on grinding, lifting, and vehicle movement.", 88, "closed"],
    ["AUD-2026-004", "Environmental spill readiness — Shop 1 and CS Shop", "regulatory", "SCR", "Operations", "sara", "2026-08-20", null, "Bunds, drain valves, absorbent stocks, and the spill drill record.", null, "in_progress"],
    ["AUD-2026-005", "Lifting and rigging — Fabrication Yard", "internal", "FAB", "Maintenance", "emily", "2026-10-07", "2026-10-08", "Cranes, rigging lofts, lift plans, and exclusion zones.", 69, "findings_open"],
    ["AUD-2026-006", "Office emergency arrangements — Admin Building", "internal", "ADM", "HR & Admin", "owen", "2026-11-10", null, "Wardens, assembly points, and the last drill record.", null, "planned"],
  ];
  for (const [reference, title, type, siteCode, department, who, scheduled, completed, scope, score, status] of audits) {
    const created = stamp(scheduled, "07:45:00");
    const id = insert(db, "audits", {
      reference,
      title,
      audit_type: type,
      site_id: site[siteCode],
      department_id: dept[department],
      lead_auditor: person[who],
      scheduled_date: scheduled,
      completed_date: completed,
      scope,
      score,
      status,
      created_at: created,
      updated_at: created,
    });
    aud[reference] = id;
    event(db, "audit", id, status, person[who], created);
  }

  const finding = {};
  const findings = [
    ["FND-2026-001", "AUD-2026-001", "Housekeeping standard in the amine pump bay is not the one used on the night shift.", "minor", "closed", "luis", "2026-03-15"],
    ["FND-2026-002", "AUD-2026-001", "Eye-wash in the lab is tested, and the tag is current. Recorded as a positive observation.", "observation", "closed", "amina", "2026-03-01"],
    ["FND-2026-011", "AUD-2026-001", "Two isolation certificates had no independent verifier signature.", "major", "closed", "hannah", "2026-03-20"],
    ["FND-2026-003", "AUD-2026-002", "Fire watch on a live hot-work permit had left the job for a break with no relief.", "major", "open", "emily", "2026-10-30"],
    ["FND-2026-004", "AUD-2026-002", "Gas test on a confined-space permit was older than the shift.", "minor", "in_progress", "emily", "2026-11-20"],
    ["FND-2026-005", "AUD-2026-002", "Permit board in the control room matched the field copies.", "observation", "open", "omar", "2026-12-01"],
    ["FND-2026-012", "AUD-2026-002", "A suspended permit was still posted at the job site.", "minor", "open", "noah", "2026-11-06"],
    ["FND-2026-006", "AUD-2026-003", "Grinding without a face shield was seen twice on day one and not again after the toolbox talk.", "minor", "closed", "grace", "2026-07-01"],
    ["FND-2026-007", "AUD-2026-003", "Banksman signals were consistent on the three lifts observed.", "observation", "closed", "fatima", "2026-06-30"],
    ["FND-2026-008", "AUD-2026-005", "A lift plan for the exchanger bundle did not name the exclusion zone owner.", "major", "open", "noah", "2026-11-01"],
    ["FND-2026-009", "AUD-2026-005", "A soft sling in the rigging loft was in service past its inspection color.", "critical", "open", "emily", "2026-11-15"],
    ["FND-2026-010", "AUD-2026-005", "Crane daily check sheets were complete for the sampled week.", "minor", "in_progress", "noah", "2026-11-28"],
  ];
  for (const [reference, auditRef, description, severity, status, who, due] of findings) {
    const auditId = aud[auditRef];
    const auditRow = db.prepare("SELECT site_id, department_id, scheduled_date FROM audits WHERE id = ?").get(auditId);
    const created = stamp(auditRow.scheduled_date, "16:00:00");
    const id = insert(db, "findings", {
      reference,
      audit_id: auditId,
      description,
      severity,
      status,
      owner_id: person[who],
      due_date: due,
      site_id: auditRow.site_id,
      department_id: auditRow.department_id,
      created_at: created,
      updated_at: created,
    });
    finding[reference] = id;
    event(db, "finding", id, status, person[who], created);
  }

  const permitRows = [
    ["PTW-2026-001", "Hot work on the crude line spool", "hot_work", "SH1", "Maintenance", "luis", "hannah", "Spool CS-12", "Cut out and replace a corroded spool.", "Hydrocarbon, ignition, stored energy.", "Isolation, gas test, fire watch, charged hose.", "2026-11-09", "2026-11-10", "active", "2026-11-09"],
    ["PTW-2026-002", "Confined space entry to tank T-120", "confined_space", "GAN", "Operations", "omar", "emily", "Tank T-120", "Internal inspection after cleaning.", "Oxygen deficient atmosphere, residue.", "Continuous gas test, standby, rescue plan.", "2026-11-07", "2026-11-08", "active", "2026-11-07"],
    ["PTW-2026-003", "Working at height on the flare platform", "height", "MCH", "Maintenance", "grace", "fatima", "Flare stack platform", "Replace a damaged section of grating.", "Fall, dropped objects.", "Full scaffold, tagged, tool tethers, rescue kit.", "2026-11-03", "2026-11-05", "approved", "2026-11-03"],
    ["PTW-2026-004", "Electrical isolation of MCC-4", "electrical", "SH1", "Maintenance", "luis", "hannah", "Substation MCC-4", "Isolate and prove dead for a starter change.", "Electrical energy, stored charge.", "Lock-out, prove-dead, permit authority sign-on.", "2026-11-12", "2026-11-18", "active", "2026-11-12"],
    ["PTW-2026-005", "Excavation near the firewater main", "excavation", "GAN", "Projects", "chris", "emily", "Road crossing by the foam tank", "Hand dig to expose the firewater main.", "Strike on a live main, collapse.", "Drawings, bans on machine digging, shoring.", "2026-11-12", "2026-11-20", "suspended", "2026-11-11"],
    ["PTW-2026-006", "Hot work on jetty piping", "hot_work", "GAN", "Maintenance", "noah", "emily", "Jetty pipe rack", "Weld a pipe shoe.", "Flammable vapor from the loading arm.", "Gas test, fire watch, arm isolated.", "2026-11-14", "2026-11-14", "requested", "2026-11-11"],
    ["PTW-2026-007", "Cold work scaffold inspection", "cold_work", "SH1", "Projects", "priya", null, "Column C-210 stair", "Weekly scaffold inspection.", "Working at height during the inspection.", "Inspector harness, boards checked before access.", "2026-11-20", "2026-11-20", "draft", "2026-11-11"],
    ["PTW-2026-008", "Lift of the exchanger bundle", "lifting", "SH1", "Maintenance", "luis", "hannah", "Exchanger E-12 plot", "Lift the bundle to the stands.", "Suspended load, crush.", "Lift plan, exclusion zone, certified rigging.", "2026-09-02", "2026-09-02", "closed", "2026-09-01"],
    ["PTW-2026-009", "Line break on the amine unit", "line_break", "SH1", "Operations", "priya", "hannah", "Amine pump P-201 suction", "Break the flange to fit a blind.", "Amine release, pressure.", "Drain, vent, gas test, face shield, spill kit.", "2026-08-14", "2026-08-14", "closed", "2026-08-13"],
    ["PTW-2026-010", "Hot work refused — no fire watch", "hot_work", "MCH", "Maintenance", "grace", "fatima", "Workshop bay 4", "Grind a bracket indoors.", "Sparks onto solvent rags.", "The fire watch named on the form was not on shift.", "2026-10-01", "2026-10-01", "rejected", "2026-10-01"],
    ["PTW-2026-011", "Confined space entry to the jetty sump", "confined_space", "GAN", "Maintenance", "noah", "emily", "Jetty sump S-1", "Clean the sump after a sheen.", "Atmosphere, engulfment.", "Drain, test, tripod, standby.", "2026-11-16", "2026-11-16", "approved", "2026-11-10"],
  ];
  for (const [reference, title, type, siteCode, department, requester, issuer, location, work, hazards, controls, validFrom, validTo, status, createdOn] of permitRows) {
    const created = stamp(createdOn, "11:20:00");
    const id = insert(db, "permits", {
      reference,
      title,
      permit_type: type,
      site_id: site[siteCode],
      department_id: dept[department],
      requester_id: person[requester],
      issuer_id: issuer ? person[issuer] : null,
      location_detail: location,
      work_description: work,
      hazards,
      controls,
      valid_from: validFrom,
      valid_to: validTo,
      status,
      created_at: created,
      updated_at: created,
    });
    event(db, "permit", id, status, person[requester], created);
  }

  const jsaRows = [
    ["JSA-2026-001", "Blind installation on a hydrocarbon line", "SH1", "Maintenance", "luis", "hannah", "Install a spectacle blind on a drained hydrocarbon line and reinstate.", "Flame-retardant coverall, gloves, face shield, gas detector, safety boots.", "approved", "2027-02-01", "2026-01-20", [
      ["Prove isolation and zero energy", "Residual pressure or wrong valve", "Independent verifier, gauges, open bleed", "high", "low"],
      ["Break the flange and insert the blind", "Hydrocarbon release, ignition", "Gas test, drip tray, fire extinguisher, wind check", "high", "low"],
      ["Reinstate and leak test", "Leak on start-up", "New gasket, staged pressurisation, walk-down", "medium", "low"],
    ]],
    ["JSA-2026-002", "Scaffold erection in the process area", "GAN", "Maintenance", "noah", "emily", "Erect a tube-and-fit scaffold beside an operating pipe rack.", "Harness, hard hat with chin strap, gloves, tool lanyards.", "approved", "2026-10-01", "2026-03-02", [
      ["Set the exclusion zone", "Dropped objects, vehicle strike", "Barricade, banksman, no hot work above", "medium", "low"],
      ["Lift tubes into the rack", "Manual handling, clash with pipe", "Two-person lift, spotter for live equipment", "medium", "low"],
      ["Fix boards and fit the tag", "Fall from an incomplete deck", "No access until the scaffolder signs the tag", "high", "low"],
    ]],
    ["JSA-2026-003", "Tank cleaning and degassing", "GAN", "Operations", "omar", null, "Clean and degas a crude tank before entry.", "Chemical suit, boots, detector, standby radio.", "in_review", "2026-12-15", "2026-09-12", [
      ["Drain and ventilate", "Flammable atmosphere", "Bonded fans, gas test, no ignition sources", "high", "medium"],
      ["Remove sludge", "H2S, manual handling", "Continuous monitoring, breaks, vacuum hose first", "high", "medium"],
      ["Hand back for entry", "Oxygen deficient space", "Entry permit, rescue plan, standby", "high", "low"],
    ]],
    ["JSA-2026-004", "Forklift battery change", "MCH", "Supply Chain", "ben", null, "Change a forklift traction battery in the charge bay.", "Face shield, acid gloves, apron, boots.", "draft", "2026-12-01", "2026-10-18", [
      ["Isolate the truck", "Unexpected movement", "Key removed, wheels chocked", "medium", "low"],
      ["Lift the battery", "Crush, acid splash", "Rated hoist, closed cap, eyewash nearby", "high", "medium"],
      ["Connect the replacement", "Short circuit", "Insulated tools, correct polarity check", "medium", "low"],
    ]],
    ["JSA-2026-005", "Laboratory solvent transfer", "SH1", "QA/QC", "amina", "hannah", "Transfer solvent from a tote into bench bottles.", "Lab coat, splash goggles, nitrile gloves, closed shoes.", "approved", "2027-01-15", "2026-05-11", [
      ["Bond and ground the tote", "Static ignition", "Continuity check before the cap comes off", "medium", "low"],
      ["Pump to the labelled bottle", "Spill, vapor", "Secondary tray, fume hood, small volumes", "medium", "low"],
      ["Cap and store", "Wrong cabinet, leftover odor", "Return to the flammables cabinet, cap wrench", "low", "low"],
    ]],
    ["JSA-2026-006", "Office fire-warden sweep", "ADM", "HSE", "owen", "sara", "Sweep the floor and confirm the stair is clear during a drill.", "High-visibility vest, flat shoes, torch.", "expired", "2026-06-30", "2025-12-02", [
      ["Collect the roll", "Missing person", "Printed list, last-known location noted", "low", "low"],
      ["Check the floor", "Smoke, blocked stair", "Do not enter smoke, report and leave", "medium", "low"],
      ["Report at the assembly point", "Headcount error", "Radio the controller before standing down", "low", "low"],
    ]],
    ["JSA-2026-007", "Catalyst drum handling", "SH1", "Operations", "priya", "hannah", "Move sealed catalyst drums from the pad to the unit.", "Gloves, boots, glasses. No drum rolling.", "superseded", "2026-09-01", "2026-02-02", [
      ["Check the drum", "Leaking lid, damaged chime", "Quarantine any weeping drum", "medium", "low"],
      ["Move with a drum trolley", "Crush, strain", "Trolley brake, two people on ramps", "medium", "low"],
      ["Stand the drum at the unit", "Tip-over", "Chock and keep the aisle clear", "medium", "low"],
    ]],
  ];
  for (const [reference, title, siteCode, department, prepared, reviewed, task, ppe, status, validUntil, createdOn, steps] of jsaRows) {
    const created = stamp(createdOn, "13:10:00");
    const id = insert(db, "jsas", {
      reference,
      job_title: title,
      site_id: site[siteCode],
      department_id: dept[department],
      prepared_by: person[prepared],
      reviewed_by: reviewed ? person[reviewed] : null,
      task_description: task,
      ppe,
      status,
      valid_until: validUntil,
      created_at: created,
      updated_at: created,
    });
    steps.forEach((step, index) => {
      insert(db, "jsa_steps", {
        jsa_id: id,
        step_no: index + 1,
        task_step: step[0],
        hazard: step[1],
        controls: step[2],
        risk_before: step[3],
        risk_after: step[4],
      });
    });
    event(db, "jsa", id, status, person[prepared], created);
  }

  const risk = {};
  const risks = [
    ["RA-2026-001", "Chlorine drum changeover", "SH1", "Operations", "daniel", "Change a chlorine drum on the cooling-water dosing skid.", "approved", "2027-03-01", "2026-02-12", [
      ["Chlorine release from a bad connection", "Toxic inhalation on the skid and downwind", 5, 5, "SCBA, wind sock, remote shut-off, two-person task, detector", 4, 5],
      ["Manual handling of the drum", "Strain or a dropped drum", 3, 3, "Drum trolley and a cleared route", 2, 2],
    ]],
    ["RA-2026-002", "Nitrogen purge of a process vessel", "SH1", "Maintenance", "luis", "Purge a vessel with nitrogen before entry by others.", "approved", "2026-10-01", "2026-04-03", [
      ["Oxygen displacement", "Asphyxiation inside or at the nozzle", 3, 5, "Posted warnings, oxygen test, no solo work at the nozzle", 2, 4],
      ["Over-pressure from the nitrogen hose", "Equipment damage", 2, 3, "Regulator and a verified vent path", 1, 3],
    ]],
    ["RA-2026-003", "Manual handling of catalyst drums", "GAN", "Operations", "omar", "Offload catalyst drums from a truck to the laydown pad.", "in_review", "2026-12-01", "2026-07-08", [
      ["Repetitive lifting", "Back and shoulder injury", 4, 3, "Trolley, team lift limit, breaks", 4, 3],
      ["Truck movement on the pad", "Struck by the truck", 3, 4, "Chocks, banksman, no one behind the truck", 2, 3],
    ]],
    ["RA-2026-004", "Working over water at the jetty", "GAN", "Projects", "chris", "Inspection of the jetty fender from a man-rider.", "approved", "2027-01-20", "2026-05-19", [
      ["Fall into the water", "Drowning, cold shock", 3, 5, "Lifejacket, rescue boat on standby, stop in poor weather", 2, 5],
      ["Boat and the structure", "Crush between boat and fender", 2, 4, "Hold point, radio, no approach in the wash", 1, 4],
    ]],
    ["RA-2026-005", "Office fire and evacuation", "ADM", "HSE", "owen", "Day-to-day fire risk for the regional office.", "approved", "2027-06-01", "2026-01-09", [
      ["Fire in a kitchenette or electrical cupboard", "Smoke inhalation, delayed escape", 2, 4, "Detection, wardens, clear stairs, extinguisher checks", 1, 4],
    ]],
    ["RA-2026-006", "Workshop grinding and hot sparks", "MCH", "Maintenance", "grace", "Grinding brackets in the fabrication bay.", "review_due", "2026-09-15", "2026-03-22", [
      ["Sparks onto combustibles", "Workshop fire", 4, 4, "Screens, fire watch for 30 minutes, rags in a bin", 3, 4],
      ["Noise and dust", "Hearing loss, eye injury", 4, 2, "Face shield, hearing protection, extraction", 2, 2],
    ]],
    ["RA-2026-007", "Unloading chemical totes", "MCH", "Supply Chain", "ben", "Unload corrosive totes with a forklift.", "draft", "2026-12-20", "2026-11-02", [
      ["Tote puncture", "Corrosive spill in the yard", 3, 3, "Fork pockets checked, spill kit, no double stacking", 2, 3],
    ]],
    ["RA-2026-008", "Legacy tank-farm assessment", "GAN", "Operations", "omar", "Superseded assessment kept for the record of the old foam system.", "archived", "2025-12-01", "2025-12-15", [
      ["Rim-seal fire", "Escalation across the bund", 5, 5, "Old foam pourers, since replaced", 4, 5],
    ]],
  ];
  for (const [reference, title, siteCode, department, assessor, activity, status, review, createdOn, hazards] of risks) {
    const created = stamp(createdOn, "15:40:00");
    const id = insert(db, "risk_assessments", {
      reference,
      title,
      site_id: site[siteCode],
      department_id: dept[department],
      assessor_id: person[assessor],
      activity,
      status,
      review_date: review,
      created_at: created,
      updated_at: created,
    });
    for (const [hazard, consequence, likelihood, severity, controls, residualL, residualS] of hazards) {
      insert(db, "risk_hazards", {
        risk_id: id,
        hazard,
        consequence,
        likelihood,
        severity,
        controls,
        residual_likelihood: residualL,
        residual_severity: residualS,
      });
    }
    risk[reference] = id;
    event(db, "risk", id, status, person[assessor], created);
  }

  const actions = [
    ["ACT-2026-001", "near_miss", "NM-2026-001", "Retrain the crew who marked the MOV-14 isolation", "hannah", "2026-10-20", "open", "SH1", "Operations", "2026-01-15"],
    ["ACT-2026-002", "near_miss", "NM-2026-001", "Add a photo of the correct valve to the isolation pack", "priya", "2026-11-30", "in_progress", "SH1", "Operations", "2026-01-16"],
    ["ACT-2026-003", "near_miss", "NM-2026-004", "Fit a physical stop so an untagged scaffold cannot be climbed", "noah", "2026-11-01", "open", "GAN", "Maintenance", "2026-03-04"],
    ["ACT-2026-004", "near_miss", "NM-2026-010", "Repaint the pedestrian split at the tote pad", "ben", "2026-12-05", "open", "SH1", "Supply Chain", "2026-05-20"],
    ["ACT-2026-005", "near_miss", "NM-2026-015", "Move solvent transfers fully inside the fume hood", "amina", "2026-11-25", "in_progress", "SH1", "QA/QC", "2026-08-12"],
    ["ACT-2026-006", "near_miss", "NM-2026-020", "Put the height rescue kit on the scaffold checklist", "hannah", "2026-12-12", "open", "SH1", "Projects", "2026-10-21"],
    ["ACT-2026-007", "incident", "INC-2026-002", "Repair the bund coping and close the shortcut", "noah", "2026-10-15", "open", "GAN", "Maintenance", "2026-03-13"],
    ["ACT-2026-008", "incident", "INC-2026-005", "Run a hose-coupling toolbox talk on the jetty crew", "omar", "2026-11-18", "open", "GAN", "Operations", "2026-06-25"],
    ["ACT-2026-009", "incident", "INC-2026-007", "Fit a gearbox to valve CW-88", "luis", "2026-11-05", "in_progress", "SH1", "Maintenance", "2026-09-15"],
    ["ACT-2026-010", "incident", "INC-2026-008", "Remove the trial seal and inspect the sister arm", "chris", "2026-11-22", "open", "GAN", "Projects", "2026-10-03"],
    ["ACT-2026-011", "finding", "FND-2026-003", "Rewrite the fire-watch relief rule into the permit standard", "emily", "2026-10-30", "open", "GAN", "HSE", "2026-04-11"],
    ["ACT-2026-012", "finding", "FND-2026-009", "Quarantine the rigging loft and reinspect every sling", "emily", "2026-11-15", "in_progress", "GAN", "Maintenance", "2026-10-08"],
    ["ACT-2026-013", "audit", "AUD-2026-002", "Brief permit issuers on the April compliance audit", "emily", "2026-12-01", "open", "GAN", "HSE", "2026-04-12"],
    ["ACT-2026-014", "risk", "RA-2026-002", "Refresh the nitrogen purge controls on the vessel JSA", "luis", "2026-11-08", "open", "SH1", "Maintenance", "2026-04-04"],
    ["ACT-2026-015", "near_miss", "NM-2025-014", "Replace the missing grating clips on P-201", "luis", "2026-01-15", "closed", "SH1", "Maintenance", "2025-12-09"],
    ["ACT-2026-016", "incident", "INC-2026-001", "Change the sample-point glove standard", "amina", "2026-02-01", "closed", "SH1", "Operations", "2026-01-17"],
  ];
  for (const [reference, sourceType, sourceRef, title, who, due, status, siteCode, department, createdOn] of actions) {
    const sourceMap = { near_miss: nm, incident: inc, finding, audit: aud, risk };
    const created = stamp(createdOn, "12:00:00");
    const id = insert(db, "actions", {
      reference,
      source_type: sourceType,
      source_id: sourceMap[sourceType][sourceRef],
      source_reference: sourceRef,
      title,
      owner_id: person[who],
      due_date: due,
      status,
      site_id: site[siteCode],
      department_id: dept[department],
      created_at: created,
      updated_at: created,
    });
    event(db, "action", id, status, person[who], created);
  }

  const hours = {
    SH1: 9000,
    SH2: 8500,
    SH3: 8000,
    PNT: 4500,
    SSS: 5000,
    CSS: 5500,
    MNT: 4000,
    MCH: 4500,
    WH: 3500,
    PST: 1500,
    GAN: 4500,
    FAB: 10000,
    SLN: 6000,
    NLN: 5500,
    SEC: 2000,
    ADM: 3000,
    HTC: 1500,
    SCR: 1500,
  };
  for (const month of eachMonth("2025-12-01", "2026-11-30")) {
    for (const [code, value] of Object.entries(hours)) {
      insert(db, "hours_worked", { site_id: site[code], month, hours: value });
    }
  }
}
