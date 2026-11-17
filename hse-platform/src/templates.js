export const INCIDENT_TYPES = ['injury', 'near_miss', 'property', 'environmental', 'fire'];
export const SEVERITIES = ['low', 'medium', 'high', 'critical'];
export const INCIDENT_STATUSES = ['reported', 'investigating', 'actions_open', 'closed'];
export const OBSERVATION_KINDS = ['safe', 'at_risk'];
export const OBSERVATION_CATEGORIES = [
  'ppe',
  'housekeeping',
  'lifting',
  'hot_work',
  'line_of_fire',
  'environment',
  'tools',
];
export const RISK_STATUSES = ['draft', 'approved'];
export const PERMIT_TYPES = [
  'hot_work',
  'work_at_height',
  'confined_space',
  'lifting',
  'excavation',
  'electrical_isolation',
];
export const PERMIT_STATUSES = ['requested', 'issued', 'active', 'suspended', 'closed', 'rejected'];
export const PERMIT_TRANSITIONS = {
  requested: ['issued', 'rejected'],
  issued: ['active', 'suspended', 'closed'],
  active: ['suspended', 'closed'],
  suspended: ['active', 'closed'],
  closed: [],
  rejected: [],
};
export const ACTION_STATUSES = ['open', 'in_progress', 'closed'];
export const PRIORITIES = ['low', 'medium', 'high'];
export const COURSES = [
  'Working at Height',
  'Hot Work',
  'Confined Space',
  'First Aid',
  'Lifting & Rigging',
  'Environmental Awareness',
  'Fire Watch',
];

export const INSPECTION_TEMPLATES = {
  workshop: {
    title: 'Workshop walkdown',
    items: [
      'Walkways clear of offcuts',
      'Fire extinguisher in date and unobstructed',
      'Machine guards in place',
      'Spill kit stocked',
      'First aid box sealed and stocked',
    ],
  },
  welding: {
    title: 'Welding bay',
    items: [
      'Screens contain arc flash',
      'Gas cylinders secured and capped',
      'Local exhaust running',
      'Hot-work extinguisher at the bay',
      'Cables free of damage',
    ],
  },
  lifting: {
    title: 'Lifting gear',
    items: [
      'Slings tagged and in date',
      'Hooks fitted with a safety latch',
      'Load path barricaded',
      'Crane daily check signed',
      'Tag lines available',
    ],
  },
  fire: {
    title: 'Fire equipment',
    items: [
      'Alarm points accessible',
      'Extinguishers charged and in date',
      'Assembly point signed',
      'Flammables stored in a cabinet',
      'Emergency lighting tested',
    ],
  },
};

export const LOCATIONS = [
  'Bay 2 welding',
  'Piping shop',
  'Plate yard',
  'Blast and paint',
  'Warehouse aisle C',
  'Vessel V-214',
  'Laydown area',
  'Scaffold bay 3',
];
