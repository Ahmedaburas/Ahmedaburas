/**
 * Saved client standards library for auto JSA generation.
 * These are editable working templates aligned to common Saudi Aramco, SABIC,
 * and Maaden HSE expectations for fabrication yards — not a verbatim dump of
 * proprietary manuals. Replace clause text with your controlled copies as needed.
 */

export const STANDARDS = [
  {
    id: "aramco",
    name: "Saudi Aramco",
    shortName: "Aramco",
    summary: "GI / SAES-oriented controls for hot work, confined space, lifting, height, and energy isolation.",
    jobs: [
      {
        id: "hot_work",
        title: "Hot work on process or fabrication steel",
        ppe: "Flame-retardant coverall, welding helmet/face shield, leather gloves, safety boots, hearing protection",
        refs: ["GI 2.100 Hot Work", "SAES-B-068 Fire Prevention"],
        steps: [
          ["Obtain permit and gas test the work area", "Ignition of flammable atmosphere", "Valid hot-work permit, calibrated gas detector, continuous monitoring", "high", "low"],
          ["Prepare and protect adjacent combustibles", "Fire spread to coatings, rags, or scaffolding", "Fire blanket, remove combustibles, charged extinguisher at the point of work", "high", "low"],
          ["Execute welding / cutting / grinding", "Arc flash, burns, fume, eye injury", "Screens, local exhaust, correct PPE, fire watch during the job", "high", "medium"],
          ["Fire watch after last hot work", "Delayed ignition", "Fire watch for the required hold time; re-inspect before leaving the area", "medium", "low"],
        ],
      },
      {
        id: "confined_space",
        title: "Confined space entry (vessel / tank)",
        ppe: "Harness where required, gas detector, respiratory protection as per atmosphere, gloves, hard hat",
        refs: ["GI 2.100 Confined Space", "SAES-B-068"],
        steps: [
          ["Isolate and drain the vessel", "Residual energy or product release", "LOTO, blinds, drain verification, zero-energy check", "high", "low"],
          ["Atmosphere test before entry", "Oxygen deficiency / toxic / flammable atmosphere", "Calibrated multi-gas test at all levels; record on the permit", "high", "low"],
          ["Enter and perform the task", "Entrapment, asphyxiation, heat stress", "Attendant at the manway, rescue plan, communication, ventilation", "high", "medium"],
          ["Exit and close the permit", "Unauthorized re-entry", "Headcount, remove tools, cancel permit, secure openings", "medium", "low"],
        ],
      },
      {
        id: "lifting",
        title: "Critical lift with mobile or overhead crane",
        ppe: "Hard hat, safety boots, high-visibility vest, gloves; banksman with whistle/radio",
        refs: ["GI 7.025 Crane and Heavy Equipment", "SAES-B-068"],
        steps: [
          ["Review lift plan and exclusion zone", "Crush injury in the line of fire", "Approved lift plan, barricades, dedicated banksman", "high", "low"],
          ["Inspect crane, slings, and hooks", "Load drop from failed gear", "Daily crane check, tagged slings in date, safety latches fitted", "high", "low"],
          ["Rig and lift the load", "Swing or tip-over", "Tag lines, wind limit, outriggers set, no riding the load", "high", "medium"],
          ["Set down and demobilize", "Pinch points during landing", "Soft landing, clear signal before unhooking", "medium", "low"],
        ],
      },
      {
        id: "height",
        title: "Working at height on scaffold or structure",
        ppe: "Full-body harness, hard hat with chin strap, safety boots, gloves, tool lanyards",
        refs: ["GI 8.001 Working at Heights", "SAES-B-068"],
        steps: [
          ["Verify scaffold / platform", "Fall from incomplete access", "Green tag, competent inspection, guardrails and toe boards", "high", "low"],
          ["Access the work face", "Fall from ladder or stair tower", "Three-point contact, harness tied to designated anchor", "high", "low"],
          ["Perform the elevated task", "Dropped tools / fall through opening", "Tool lanyards, hole covers, exclusion zone below", "high", "medium"],
          ["Descend and secure the area", "Unsecured openings left open", "Close openings, remove loose materials, sign off", "medium", "low"],
        ],
      },
      {
        id: "electrical_isolation",
        title: "Electrical isolation and LOTO",
        ppe: "Arc-rated clothing as required, insulated gloves, face shield, safety boots",
        refs: ["GI 2.100 Energy Isolation", "SAES-P-111"],
        steps: [
          ["Identify energy sources", "Unexpected energization", "Single-line drawing, all sources listed on the isolation certificate", "high", "low"],
          ["Isolate, lock, and try", "Residual energy", "Padlocks, tags, try-start after isolation", "high", "low"],
          ["Perform the electrical work", "Shock / arc flash", "Verified zero energy, insulated tools, boundaries", "high", "medium"],
          ["Restore energy in order", "Incomplete LOTO removal", "All locks removed only by owners; sequenced re-energization", "medium", "low"],
        ],
      },
    ],
  },
  {
    id: "sabic",
    name: "SABIC",
    shortName: "SABIC",
    summary: "SHEMS-aligned templates for fabrication, chemical handling, and contractor interface at SABIC-facing work.",
    jobs: [
      {
        id: "welding_bay",
        title: "Welding and fitting in a fabrication bay",
        ppe: "FR clothing, welding helmet, gloves, safety boots, hearing protection",
        refs: ["SABIC SHEMS — Hot Work", "SABIC SHEMS — Occupational Health"],
        steps: [
          ["Set up the bay and screens", "Arc eye for bystanders", "Welding screens, marked walkways, housekeeping", "medium", "low"],
          ["Fit and tack the spool", "Pinch / sharp edges", "Gloves, edge protection, stable supports", "medium", "low"],
          ["Weld out the joint", "Fume and UV exposure", "LEV / extraction, correct shade lens, rest breaks", "high", "medium"],
          ["Cool, inspect, and clear", "Burns from hot metal", "Cooling time, marked hot surface, clear offcuts", "medium", "low"],
        ],
      },
      {
        id: "chemical_handling",
        title: "Transfer and use of coatings / solvents",
        ppe: "Chemical gloves, goggles/face shield, apron, respirator as per SDS",
        refs: ["SABIC SHEMS — Chemical Management", "SABIC SHEMS — Environmental"],
        steps: [
          ["Review SDS and bund status", "Wrong PPE or spill path to drain", "SDS available, bund integrity, drain covers", "high", "low"],
          ["Decant into working containers", "Splash / inhalation", "Grounding where needed, funnel, local exhaust", "high", "medium"],
          ["Apply coating or solvent", "Fire / health exposure", "No ignition sources, ventilation, spill kit ready", "high", "medium"],
          ["Close containers and dispose waste", "Environmental release", "Lidded waste, labelled drums, return to store", "medium", "low"],
        ],
      },
      {
        id: "contractor_interface",
        title: "Contractor crew starting work on site",
        ppe: "Site-mandatory PPE as briefed at the gate",
        refs: ["SABIC SHEMS — Contractor Management"],
        steps: [
          ["Verify induction and PTW", "Uncontrolled work by visitors", "Valid induction card, signed PTW, named supervisor", "high", "low"],
          ["Toolbox talk on the task hazards", "Misaligned controls", "TBT attendance sheet, JSA briefed in language understood", "medium", "low"],
          ["Execute under supervision", "SIMOPS conflict", "Area owner informed, barriers, stop-work authority stated", "high", "medium"],
          ["Demobilize and hand back", "Tools or openings left unsafe", "Housekeeping check, PTW close-out", "medium", "low"],
        ],
      },
      {
        id: "blasting",
        title: "Abrasive blasting before coating",
        ppe: "Airline hood / blasting helmet, leather gloves, hearing protection, coverall",
        refs: ["SABIC SHEMS — Occupational Health", "SABIC SHEMS — Environmental"],
        steps: [
          ["Isolate the blast area", "Grit injury to others", "Barricades, warning signs, no unauthorized entry", "high", "low"],
          ["Check pot, hoses, and deadman", "Uncontrolled blast stream", "Daily equipment check, deadman functional", "high", "low"],
          ["Blast the surface", "Silica / noise / fatigue", "Airline air quality, rotation of blasters, hearing PPE", "high", "medium"],
          ["Clean and hand over to coating", "Residual grit underfoot", "Vacuum / sweep, clear walkways before painters enter", "medium", "low"],
        ],
      },
    ],
  },
  {
    id: "maaden",
    name: "Maaden",
    shortName: "Maaden",
    summary: "Maaden HSE expectations for mining-adjacent fabrication, vehicle interface, and environmental controls.",
    jobs: [
      {
        id: "yard_vehicle",
        title: "Forklift / yard vehicle movement",
        ppe: "High-visibility vest, hard hat, safety boots",
        refs: ["Maaden HSE — Mobile Equipment", "Maaden HSE — Traffic Management"],
        steps: [
          ["Pre-use vehicle check", "Brake or horn failure", "Checklist signed, defects tagged out", "high", "low"],
          ["Plan the route", "Pedestrian collision", "Designated routes, spotter in congested areas", "high", "low"],
          ["Load, travel, and unload", "Tip-over / dropped load", "Within rated capacity, forks low when travelling", "high", "medium"],
          ["Park and secure", "Unattended movement", "Brake on, forks down, keys controlled", "medium", "low"],
        ],
      },
      {
        id: "environmental_control",
        title: "Spill control and waste segregation",
        ppe: "Chemical gloves, goggles, coverall as required",
        refs: ["Maaden HSE — Environmental Protection"],
        steps: [
          ["Identify waste streams", "Cross-contamination", "Colour-coded bins, labelled drums", "medium", "low"],
          ["Handle liquids near drains", "Spill to storm water", "Bunds, drain covers, spill kit staged", "high", "low"],
          ["Respond to a drip or spill", "Spread of contaminant", "Stop source, contain, report, dispose as hazardous if required", "high", "medium"],
          ["Record and restock", "Repeat event from empty kits", "Log the event, restock absorbents", "low", "low"],
        ],
      },
      {
        id: "structural_fitup",
        title: "Heavy structural fit-up in the yard",
        ppe: "Hard hat, gloves, safety boots, eye protection; harness if elevated",
        refs: ["Maaden HSE — Work at Height", "Maaden HSE — Lifting"],
        steps: [
          ["Stage plates and beams", "Line-of-fire crush", "Exclusion zone, tag lines, clear communication", "high", "low"],
          ["Align and clamp", "Pinch points", "Correct clamps, hands clear before crane moves", "high", "medium"],
          ["Tack and secure temporary braces", "Collapse of unstable assembly", "Engineered braces, no standing under suspended parts", "high", "medium"],
          ["Release crane and clear tools", "Dropped objects", "Confirmed load resting, tool check", "medium", "low"],
        ],
      },
      {
        id: "night_shift",
        title: "Night-shift outdoor fabrication",
        ppe: "High-visibility clothing, hard hat, safety boots; task PPE as required",
        refs: ["Maaden HSE — Fitness for Work", "Maaden HSE — Emergency Response"],
        steps: [
          ["Lighting and access check", "Trip / vehicle struck in dark", "Task lighting on, walkways marked", "high", "low"],
          ["Fatigue and headcount", "Impaired judgment", "Shift briefing, buddy check, rest schedule", "medium", "low"],
          ["Execute the night task", "Delayed emergency response", "Radio check, muster awareness, supervisor rounds", "high", "medium"],
          ["Shift handover", "Open hazards left undocumented", "Written handover of permits and open issues", "medium", "low"],
        ],
      },
    ],
  },
];

export function listStandards() {
  return STANDARDS.map(({ id, name, shortName, summary, jobs }) => ({
    id,
    name,
    shortName,
    summary,
    jobCount: jobs.length,
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      refs: job.refs,
      stepCount: job.steps.length,
    })),
  }));
}

export function getStandard(orgId) {
  return STANDARDS.find((item) => item.id === orgId) || null;
}

export function getStandardJob(orgId, jobId) {
  const org = getStandard(orgId);
  if (!org) return null;
  const job = org.jobs.find((item) => item.id === jobId);
  if (!job) return null;
  return { org, job };
}

export function buildJsaDraftFromStandard(orgId, jobId) {
  const found = getStandardJob(orgId, jobId);
  if (!found) return null;
  const { org, job } = found;
  return {
    orgId: org.id,
    orgName: org.name,
    jobId: job.id,
    jobTitle: job.title,
    taskDescription: `Auto-generated from saved ${org.name} standards for “${job.title}”. Review and tailor to the exact location, SIMOPS, and permit conditions before approval.`,
    ppe: job.ppe,
    standardRefs: job.refs,
    steps: job.steps.map(([taskStep, hazard, controls, riskBefore, riskAfter]) => ({
      taskStep,
      hazard,
      controls,
      riskBefore,
      riskAfter,
    })),
  };
}
