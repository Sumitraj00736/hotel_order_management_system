const ALL_PERMISSIONS = [
  'dashboard:view',
  'orders:view',
  'orders:edit',
  'orders:checkout:view',
  'orders:checkout:edit',
  'tables:view',
  'tables:edit',
  'menu:view',
  'menu:edit',
  'inventory:view',
  'inventory:edit',
  'reports:view',
  'notifications:view',
  'notifications:edit',
  'website:view',
  'website:edit',
  'staff:view',
  'staff:edit',
  'customers:view',
  'customers:edit',
  'suppliers:view',
  'suppliers:edit',
  'restaurant:group:view',
  'restaurant:group:edit',
  'settings:view',
  'settings:edit',
  'roles:manage',
  'billing:view',
  'billing:edit'
];

const WAITER_ALLOWED_PERMISSIONS = [
  'dashboard:view',
  'orders:view',
  'orders:edit',
  'orders:checkout:view',
  'tables:view',
  'tables:edit',
  'menu:view',
  'notifications:view',
  'customers:view',
  'customers:edit',
  'billing:view'
];

const DEFAULT_ROLE_PERMISSIONS = {
  admin: ['*'],
  superadmin: ['*'],
  manager: [
    'dashboard:view',
    'orders:view',
    'orders:edit',
    'orders:checkout:view',
    'orders:checkout:edit',
    'tables:view',
    'tables:edit',
    'menu:view',
    'menu:edit',
    'inventory:view',
    'inventory:edit',
    'reports:view',
    'notifications:view',
    'website:view',
    'website:edit',
    'staff:view',
    'staff:edit',
    'customers:view',
    'customers:edit',
    'suppliers:view',
    'suppliers:edit',
    'settings:view',
    'settings:edit',
    'roles:manage',
    'billing:view'
  ],
  waiter: [
    'dashboard:view',
    'orders:view',
    'orders:edit',
    'orders:checkout:view',
    'tables:view',
    'tables:edit',
    'menu:view',
    'notifications:view',
    'customers:view',
    'customers:edit',
    'billing:view'
  ],
  kitchen: [
    'dashboard:view',
    'orders:view',
    'orders:edit',
    'menu:view',
    'notifications:view'
  ],
  billing: [
    'dashboard:view',
    'orders:view',
    'orders:checkout:view',
    'orders:checkout:edit',
    'reports:view',
    'billing:view'
  ]
};

const normalizeRoleKey = (role = '') => role.toLowerCase().trim();

const sanitizeRolePermissions = (roleName, permissions = []) => {
  const roleKey = normalizeRoleKey(roleName);
  const list = Array.isArray(permissions) ? permissions : [];
  if (roleKey !== 'waiter') return list;
  const allowed = new Set(WAITER_ALLOWED_PERMISSIONS.map((p) => p.toLowerCase()));
  return list.filter((perm) => allowed.has(String(perm || '').toLowerCase()));
};

const resolveRolePermissions = ({ roleName }) => {
  if (!roleName) return [];
  const key = normalizeRoleKey(roleName);
  return DEFAULT_ROLE_PERMISSIONS[key] || [];
};

module.exports = {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  WAITER_ALLOWED_PERMISSIONS,
  normalizeRoleKey,
  resolveRolePermissions,
  sanitizeRolePermissions
};
