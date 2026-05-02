/**
 * Platform Plan Presets
 * Matches the publicly advertised pricing page exactly.
 *
 * Basic   – Rs. 12,000 / yr  → 5 users, 20 tables, 500 dishes, 30 customers
 * Premium – Rs. 24,000 / yr  → 24 users, 50 tables, 1000 dishes, 500 customers
 */
const PLAN_PRESETS = {
  free: {
    tier: 'free',
    planName: 'Free Trial',
    pricePerYear: 0,
    maxMembers:   2,
    maxTables:    5,
    maxCustomers: 10,
    maxDishes:    50,
    maxAddOns:    5,
    maxSpaces:    0,
    features: {
      inventory:        false,
      accounting:       false,
      crm:              false,
      onlineDelivery:   false,
      liveFinance:      false,
      lowStockAlert:    false,
      daybookEmail:     false,
      customRoles:      false,
      support:          false
    }
  },
  basic: {
    tier: 'basic',
    planName: 'Basic',
    pricePerYear: 12000,
    maxMembers:   5,
    maxTables:    20,
    maxCustomers: 30,
    maxDishes:    500,
    maxAddOns:    50,
    maxSpaces:    2,
    features: {
      inventory:        false,
      accounting:       false,
      crm:              false,
      onlineDelivery:   true,   // Dine-in & Delivery Ordering
      liveFinance:      false,
      lowStockAlert:    false,
      daybookEmail:     false,
      customRoles:      false,
      support:          false
    }
  },
  premium: {
    tier: 'premium',
    planName: 'Premium',
    pricePerYear: 24000,
    maxMembers:   24,
    maxTables:    50,
    maxCustomers: 500,
    maxDishes:    1000,
    maxAddOns:    200,
    maxSpaces:    10,
    features: {
      inventory:        true,
      accounting:       true,
      crm:              true,
      onlineDelivery:   true,
      liveFinance:      true,
      lowStockAlert:    true,
      daybookEmail:     true,
      customRoles:      true,
      support:          true    // Chat and live call support
    }
  },
  enterprise: {
    tier: 'enterprise',
    planName: 'Enterprise / Custom',
    pricePerYear: 0, // negotiated
    maxMembers:   500,
    maxTables:    500,
    maxCustomers: 50000,
    maxDishes:    10000,
    maxAddOns:    5000,
    maxSpaces:    50,
    features: {
      inventory:        true,
      accounting:       true,
      crm:              true,
      onlineDelivery:   true,
      liveFinance:      true,
      lowStockAlert:    true,
      daybookEmail:     true,
      customRoles:      true,
      support:          true
    }
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
