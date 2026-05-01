const test = require('node:test');
const assert = require('node:assert/strict');

const { isPlatformAdminUser } = require('../src/utils/auth/platformAdmin');
const { hydrateUserRole } = require('../src/utils/auth/session');

test('isPlatformAdminUser trusts explicit platform admin flag', () => {
  assert.equal(isPlatformAdminUser({ isPlatformAdmin: true, email: 'owner@example.com' }), true);
});

test('isPlatformAdminUser does not treat branch superadmin as platform admin by default', () => {
  delete process.env.PLATFORM_ADMIN_EMAILS;
  assert.equal(
    isPlatformAdminUser({ role: 'superadmin', isPlatformAdmin: false, email: 'owner@example.com' }),
    false
  );
});

test('isPlatformAdminUser accepts configured platform admin email allowlist', () => {
  process.env.PLATFORM_ADMIN_EMAILS = 'admin@example.com,ops@example.com';
  assert.equal(isPlatformAdminUser({ email: 'ops@example.com' }), true);
  delete process.env.PLATFORM_ADMIN_EMAILS;
});

test('hydrateUserRole no longer rewrites stored user role for branch owners', () => {
  const user = { role: 'waiter' };
  hydrateUserRole({
    user,
    memberships: [{ isOwner: true }]
  });

  assert.equal(user.role, 'waiter');
  assert.equal(user.isBranchOwner, true);
});
