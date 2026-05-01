const PLAN_PRESETS = {
  free: {
    tier: 'free',
    planName: 'Free Plan',
    maxMembers: 2,
    maxTables: 10,
    maxCustomers: 10,
    maxDishes: 100,
    maxAddOns: 5,
    maxSpaces: 0
  },
  basic: {
    tier: 'basic',
    planName: 'Basic',
    maxMembers: 8,
    maxTables: 20,
    maxCustomers: 200,
    maxDishes: 250,
    maxAddOns: 25,
    maxSpaces: 2
  },
  pro: {
    tier: 'pro',
    planName: 'Pro',
    maxMembers: 20,
    maxTables: 50,
    maxCustomers: 1000,
    maxDishes: 750,
    maxAddOns: 100,
    maxSpaces: 5
  },
  enterprise: {
    tier: 'enterprise',
    planName: 'Enterprise',
    maxMembers: 100,
    maxTables: 250,
    maxCustomers: 10000,
    maxDishes: 5000,
    maxAddOns: 1000,
    maxSpaces: 20
  }
};

const PLAN_LIMIT_KEYS = [
  'maxMembers',
  'maxTables',
  'maxCustomers',
  'maxDishes',
  'maxAddOns',
  'maxSpaces'
];

const normalizeTier = (value = '') => String(value || '').trim().toLowerCase();

const getPlanPreset = (tier) => PLAN_PRESETS[normalizeTier(tier)] || PLAN_PRESETS.free;

const applyPlanOverrides = (tier, overrides = {}) => {
  const base = { ...getPlanPreset(tier) };
  PLAN_LIMIT_KEYS.forEach((key) => {
    if (overrides[key] !== undefined && overrides[key] !== null && overrides[key] !== '') {
      const numeric = Number(overrides[key]);
      if (Number.isFinite(numeric) && numeric >= 0) {
        base[key] = numeric;
      }
    }
  });
  return base;
};

module.exports = {
  PLAN_PRESETS,
  PLAN_LIMIT_KEYS,
  normalizeTier,
  getPlanPreset,
  applyPlanOverrides
};
