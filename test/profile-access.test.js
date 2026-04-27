const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSelfProfileEditPolicy } = require('../src/utils/auth/profileAccess');

test('buildSelfProfileEditPolicy locks citizenship fields after verification for regular staff', () => {
  const policy = buildSelfProfileEditPolicy(
    {
      role: 'waiter',
      citizenshipNumber: '123-456-7890',
      citizenshipImageUrl: 'https://example.com/id.png'
    },
    {
      branchRole: 'waiter',
      permissions: ['orders:view']
    }
  );

  assert.equal(policy.editableFields.name, true);
  assert.equal(policy.editableFields.citizenshipNumber, false);
  assert.equal(policy.editableFields.citizenshipImageUrl, false);
  assert.deepEqual(policy.lockedFields, ['citizenshipNumber', 'citizenshipImageUrl']);
});

test('buildSelfProfileEditPolicy allows privileged staff to correct locked identity fields', () => {
  const policy = buildSelfProfileEditPolicy(
    {
      role: 'waiter',
      citizenshipNumber: '123-456-7890'
    },
    {
      branchRole: 'manager',
      permissions: ['staff:edit']
    }
  );

  assert.equal(policy.editableFields.citizenshipNumber, true);
  assert.equal(policy.editableFields.citizenshipImageUrl, true);
  assert.deepEqual(policy.lockedFields, []);
});
