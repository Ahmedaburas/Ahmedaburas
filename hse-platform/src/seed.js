import { riyadhDate } from './dates.js';
import {
  createAction,
  createHeat,
  createIncident,
  createInspection,
  createObservation,
  createPermit,
  createRisk,
  createTraining,
  patchIncident,
  patchPermit,
} from './records.js';
import { INSPECTION_TEMPLATES } from './templates.js';

function at(dayOffset, time) {
  return `${riyadhDate(dayOffset)}T${time}`;
}

function checklist(template, fails = {}) {
  return INSPECTION_TEMPLATES[template].items.map((label) => ({
    label,
    result: fails[label] ? 'fail' : 'pass',
    note: fails[label] || '',
  }));
}

export function seedIfEmpty(db) {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM incidents').get().c;
  if (existing) return;

  const insertPerson = db.prepare('INSERT INTO people (name, role, department) VALUES (?, ?, ?)');
  const people = [
    ['Noor Al-Mutairi', 'HSE Officer', 'HSE'],
    ['Faisal Al-Dosari', 'Welding Supervisor', 'Fabrication'],
    ['Imran Qureshi', 'Lifting Supervisor', 'Lifting'],
    ["Helena D'Souza", 'Site Medic', 'Medical'],
    ['Yusuf Darwish', 'Permit Controller', 'HSE'],
    ['Lina Haddad', 'Environmental Officer', 'HSE'],
    ['Samir Rahman', 'Plate Yard Supervisor', 'Fabrication'],
    ['Omar Al-Naimi', 'Painter', 'Blast and paint'],
  ];
  for (const person of people) insertPerson.run(...person);

  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('hours_worked', '486000');
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('heat_threshold_c', '42');

  const loadSwing = createIncident(db, {
    type: 'near_miss',
    severity: 'medium',
    title: 'Spool swung into the laydown aisle',
    description: 'A pipe spool yawed on the sling as the crane started the lift. The banksman stopped the lift before it reached the walkway.',
    location: 'Piping shop',
    occurredAt: at(-160, '09:40'),
    reportedBy: 'Imran Qureshi',
    immediateAction: 'Lift stopped, area cleared, sling re-rigged with a second tag line.',
  });
  patchIncident(db, loadSwing.id, {
    status: 'closed',
    investigation: 'The second tag line was on the job card and was not attached. Toolbox talk now requires the banksman to call the tag line before the lift starts.',
  });

  const grinding = createIncident(db, {
    type: 'injury',
    severity: 'high',
    title: 'Grinding particle passed the face shield',
    description: 'A fitter felt a particle in the left eye after grinding a bracket. The medic removed it and the fitter returned the next shift. No lost time.',
    location: 'Bay 2 welding',
    occurredAt: at(-120, '14:15'),
    reportedBy: "Helena D'Souza",
    recordable: true,
    immediateAction: 'Work stopped at the bench. Eye wash used. Medic review the same hour.',
  });
  patchIncident(db, grinding.id, {
    status: 'closed',
    investigation: 'The shield was worn, but the grinding station had no side screen. A fixed side screen was fitted and the task risk assessment was revised.',
  });

  const forklift = createIncident(db, {
    type: 'property',
    severity: 'medium',
    title: 'Forklift contacted a rack upright',
    description: 'While reversing out of aisle C the forklift cab brushed an upright. No injury. The rack was emptied and tagged out.',
    location: 'Warehouse aisle C',
    occurredAt: at(-90, '11:05'),
    reportedBy: 'Samir Rahman',
    immediateAction: 'Aisle closed. Rack inspected by the maintenance lead before restocking.',
  });
  patchIncident(db, forklift.id, {
    status: 'closed',
    investigation: 'The aisle marking had faded and the horn was used late. Aisle lines were repainted and reversing cameras checked on the three yard trucks.',
  });

  const weep = createIncident(db, {
    type: 'environmental',
    severity: 'low',
    title: 'Hydraulic weep under the positioner',
    description: 'A slow drip from a positioner hose fitting left a palm-sized stain on the bay floor.',
    location: 'Bay 2 welding',
    occurredAt: at(-60, '08:20'),
    reportedBy: 'Lina Haddad',
    immediateAction: 'Drip tray placed, fitting tightened, absorbent applied.',
  });
  patchIncident(db, weep.id, {
    status: 'closed',
    investigation: 'The hose was within its inspection date but the fitting had worked loose. Positioner checks now include a fitting wipe at the start of shift.',
  });

  const rags = createIncident(db, {
    type: 'fire',
    severity: 'high',
    title: 'Slag ignited a rag bin',
    description: 'Hot slag landed in an open rag bin beside the welding screen. The fire watch put it out with the bay extinguisher. No injury.',
    location: 'Bay 2 welding',
    occurredAt: at(-30, '16:45'),
    reportedBy: 'Faisal Al-Dosari',
    immediateAction: 'Extinguisher discharged. Bin removed. Area watched for thirty minutes.',
  });
  patchIncident(db, rags.id, {
    status: 'actions_open',
    investigation: 'Rags were stored inside the hot-work zone. A lidded metal bin is on order and the fire watch checklist will name the bin location.',
  });

  const lineOfFire = createIncident(db, {
    type: 'near_miss',
    severity: 'high',
    title: 'Fitter stepped under a suspended head',
    description: 'During a pause in the tandem lift a fitter crossed the barricade to retrieve a wrench. The banksman called him out before the load moved.',
    location: 'Plate yard',
    occurredAt: at(-14, '10:10'),
    reportedBy: 'Noor Al-Mutairi',
    immediateAction: 'Lift held. Barricade reset. Crew stood down for a five-minute briefing.',
  });
  patchIncident(db, lineOfFire.id, {
    status: 'investigating',
    investigation: 'Statements taken from the banksman and the fitter. The gap in the barricade was at the plate rack.',
  });

  createIncident(db, {
    type: 'injury',
    severity: 'low',
    title: 'First-aid cut on a plate edge',
    description: 'A helper caught a forearm on a plate edge while guiding it onto the roller. The medic cleaned and dressed the cut. He finished the shift.',
    location: 'Plate yard',
    occurredAt: at(-3, '13:25'),
    reportedBy: "Helena D'Souza",
    immediateAction: 'Glove replaced. Plate edge capped before the next move.',
  });

  createIncident(db, {
    type: 'environmental',
    severity: 'medium',
    title: 'Thinner drip at the paint bund',
    description: 'A thinner drum was set outside the bund while hoses were changed. A cup of thinner reached the concrete.',
    location: 'Blast and paint',
    occurredAt: at(-1, '15:50'),
    reportedBy: 'Lina Haddad',
    immediateAction: 'Drum returned to the bund. Absorbent and a waste bag used. Drain cover was already in place.',
  });

  const observations = [
    ['safe', 'ppe', 'Welder stopped and replaced a cracked visor before striking an arc.', 'Bay 2 welding', -2, 'Noor Al-Mutairi'],
    ['at_risk', 'housekeeping', 'Offcuts left across the walkway behind the positioner.', 'Bay 2 welding', -2, 'Noor Al-Mutairi'],
    ['safe', 'lifting', 'Banksman called an all-stop when a tag line snagged.', 'Plate yard', -6, 'Imran Qureshi'],
    ['at_risk', 'line_of_fire', 'Helper stood between the plate and the roller while the crane took the weight.', 'Plate yard', -6, 'Samir Rahman'],
    ['at_risk', 'hot_work', 'Fire blanket had slipped off the cable tray.', 'Vessel V-214', -4, 'Yusuf Darwish'],
    ['safe', 'environment', 'Painter refused to start until the bund drain cover was fitted.', 'Blast and paint', -1, 'Lina Haddad'],
    ['at_risk', 'tools', 'Grinder disc was past the discard date marked on the store tag.', 'Piping shop', -8, 'Faisal Al-Dosari'],
    ['safe', 'ppe', 'Night shift wore hearing protection without being asked during gouging.', 'Bay 2 welding', -9, 'Noor Al-Mutairi'],
    ['at_risk', 'lifting', 'A sling was on the hook with the tag turned away and unread.', 'Laydown area', -11, 'Imran Qureshi'],
    ['safe', 'housekeeping', 'Cylinder caps were on and chains fastened at the end of shift.', 'Piping shop', -12, 'Faisal Al-Dosari'],
  ];
  for (const [kind, category, description, location, day, observer] of observations) {
    createObservation(db, {
      kind,
      category,
      description,
      location,
      observedAt: at(day, '09:00'),
      observer,
    });
  }

  createRisk(db, {
    task: 'Welding inside vessel V-214',
    area: 'Vessel V-214',
    assessor: 'Noor Al-Mutairi',
    assessedOn: riyadhDate(-20),
    status: 'approved',
    hazards: [
      {
        hazard: 'Welding fume in a confined space',
        consequence: 'Oxygen deficiency or fume exposure',
        likelihood: 4,
        severity: 5,
        controls: 'Forced ventilation, attendant, gas test before entry and every hour.',
        residualLikelihood: 2,
        residualSeverity: 4,
      },
      {
        hazard: 'Hot work against coated steel',
        consequence: 'Fire or toxic coating fume',
        likelihood: 3,
        severity: 4,
        controls: 'Coating stripped back, fire watch, extinguisher at the manway.',
        residualLikelihood: 2,
        residualSeverity: 3,
      },
    ],
  });
  createRisk(db, {
    task: 'Tandem lift of a vessel head',
    area: 'Plate yard',
    assessor: 'Imran Qureshi',
    assessedOn: riyadhDate(-18),
    status: 'approved',
    hazards: [
      {
        hazard: 'Load rotation',
        consequence: 'Crush injury in the line of fire',
        likelihood: 3,
        severity: 5,
        controls: 'Lift plan, two tag lines, exclusion zone, dedicated banksman.',
        residualLikelihood: 2,
        residualSeverity: 4,
      },
    ],
  });
  createRisk(db, {
    task: 'Open blasting in the paint hall',
    area: 'Blast and paint',
    assessor: 'Lina Haddad',
    assessedOn: riyadhDate(-3),
    status: 'draft',
    hazards: [
      {
        hazard: 'Silica and paint dust',
        consequence: 'Respiratory illness',
        likelihood: 4,
        severity: 4,
        controls: 'Airline hood, dust extraction, housekeeping before coating.',
        residualLikelihood: 2,
        residualSeverity: 3,
      },
    ],
  });

  const hotWork = createPermit(db, {
    type: 'hot_work',
    location: 'Vessel V-214',
    description: 'Internal welding of nozzle N3.',
    issuer: 'Yusuf Darwish',
    acceptor: 'Faisal Al-Dosari',
    validFrom: riyadhDate(-1),
    validTo: riyadhDate(0),
    controls: 'Gas test, attendant at the manway, fire watch for 60 minutes after the last arc.',
  });
  patchPermit(db, hotWork.id, { status: 'issued' });
  patchPermit(db, hotWork.id, { status: 'active' });

  const height = createPermit(db, {
    type: 'work_at_height',
    location: 'Scaffold bay 3',
    description: 'Install nozzle orientation marks from the scaffold.',
    issuer: 'Yusuf Darwish',
    acceptor: 'Samir Rahman',
    validFrom: riyadhDate(0),
    validTo: riyadhDate(1),
    controls: 'Scaffold tag green, harness tied to the designated line, tools on lanyards.',
  });
  patchPermit(db, height.id, { status: 'issued' });

  const lift = createPermit(db, {
    type: 'lifting',
    location: 'Plate yard',
    description: 'Tandem lift of the vessel head onto the stands.',
    issuer: 'Imran Qureshi',
    acceptor: 'Samir Rahman',
    validFrom: riyadhDate(-16),
    validTo: riyadhDate(-14),
    controls: 'Approved lift plan, exclusion zone, wind limit 9 m/s.',
  });
  patchPermit(db, lift.id, { status: 'issued' });
  patchPermit(db, lift.id, { status: 'active' });
  patchPermit(db, lift.id, { status: 'closed' });

  createPermit(db, {
    type: 'confined_space',
    location: 'Vessel V-214',
    description: 'Entry for fit-up of an internal bracket.',
    issuer: 'Yusuf Darwish',
    acceptor: 'Faisal Al-Dosari',
    validFrom: riyadhDate(1),
    validTo: riyadhDate(1),
    controls: 'Permit waits on a fresh gas test at the start of the shift.',
  });

  const excavation = createPermit(db, {
    type: 'excavation',
    location: 'Laydown area',
    description: 'Hand dig to expose a blocked drain.',
    issuer: 'Lina Haddad',
    acceptor: 'Omar Al-Naimi',
    validFrom: riyadhDate(-2),
    validTo: riyadhDate(2),
    controls: 'Services drawing checked. Work stopped when the drawing and the ground marks disagreed.',
  });
  patchPermit(db, excavation.id, { status: 'issued' });
  patchPermit(db, excavation.id, { status: 'active' });
  patchPermit(db, excavation.id, { status: 'suspended' });

  createInspection(db, {
    template: 'workshop',
    area: 'Piping shop',
    inspector: 'Noor Al-Mutairi',
    inspectedOn: riyadhDate(-1),
    items: checklist('workshop', {
      'Walkways clear of offcuts': 'Offcuts stacked in the marked walkway.',
    }),
  });
  createInspection(db, {
    template: 'lifting',
    area: 'Laydown area',
    inspector: 'Imran Qureshi',
    inspectedOn: riyadhDate(-2),
    items: checklist('lifting'),
  });
  createInspection(db, {
    template: 'fire',
    area: 'Bay 2 welding',
    inspector: 'Yusuf Darwish',
    inspectedOn: riyadhDate(-5),
    items: checklist('fire', {
      'Extinguishers charged and in date': 'Bay extinguisher was used on the rag-bin fire and has not been replaced.',
    }),
  });
  createInspection(db, {
    template: 'welding',
    area: 'Bay 2 welding',
    inspector: 'Faisal Al-Dosari',
    inspectedOn: riyadhDate(-7),
    items: checklist('welding'),
  });

  createAction(db, {
    title: 'Replace the discharged bay extinguisher',
    source: rags.ref,
    owner: 'Yusuf Darwish',
    dueOn: riyadhDate(-1),
    priority: 'high',
    note: 'The spare is in the fire store. The bay hook is still empty.',
  });
  createAction(db, {
    title: 'Fit a lidded metal rag bin outside the hot-work zone',
    source: rags.ref,
    owner: 'Faisal Al-Dosari',
    dueOn: riyadhDate(4),
    priority: 'high',
  });
  createAction(db, {
    title: 'Close the barricade gap at the plate rack',
    source: lineOfFire.ref,
    owner: 'Samir Rahman',
    dueOn: riyadhDate(-10),
    priority: 'medium',
    note: 'Temporary chain is up. A fixed frame is still open.',
  });
  createAction(db, {
    title: 'Repaint forklift aisle lines in warehouse C',
    source: forklift.ref,
    owner: 'Samir Rahman',
    dueOn: riyadhDate(12),
    priority: 'low',
  });
  const done = createAction(db, {
    title: 'Fit a side screen on the grinding bench',
    source: grinding.ref,
    owner: 'Faisal Al-Dosari',
    dueOn: riyadhDate(-100),
    priority: 'medium',
  });
  db.prepare("UPDATE actions SET status = 'closed', note = ? WHERE id = ?").run(
    'Screen fitted and shown at the toolbox talk.',
    done.id,
  );

  const courses = [
    ['Samir Rahman', 'Working at Height', -400, -20],
    ['Omar Al-Naimi', 'Hot Work', -500, -2],
    ['Faisal Al-Dosari', 'Hot Work', -40, 200],
    ['Faisal Al-Dosari', 'Confined Space', -30, 300],
    ['Noor Al-Mutairi', 'First Aid', -20, 340],
    ['Imran Qureshi', 'Lifting & Rigging', -15, 350],
    ['Lina Haddad', 'Environmental Awareness', -10, 180],
    ['Yusuf Darwish', 'Fire Watch', -25, 90],
    ["Helena D'Souza", 'First Aid', -60, 300],
    ['Samir Rahman', 'Lifting & Rigging', -50, 220],
  ];
  for (const [person, course, completed, expires] of courses) {
    createTraining(db, {
      person,
      course,
      completedOn: riyadhDate(completed),
      expiresOn: riyadhDate(expires),
    });
  }

  const heat = [
    [-30, 36.4],
    [-26, 38.1],
    [-22, 40.2],
    [-18, 41.6],
    [-14, 43.1],
    [-10, 42.4],
    [-6, 39.8],
    [-3, 38.2],
    [-1, 37.8],
  ];
  for (const [hours, heatIndexC] of heat) {
    createHeat(db, {
      location: 'Plate yard',
      heatIndexC,
      recordedAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
    });
  }
}
