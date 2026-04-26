const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeMemberships, pickActiveMembership } = require('../src/utils/branch/access');

test('normalizeMemberships keeps active and status-active memberships only', () => {
  const result = normalizeMemberships([
    { branchId: 'a', active: true },
    { branchId: 'b', status: 'active' },
    { branchId: 'c', active: false, status: 'inactive' }
  ]);

  assert.deepEqual(result, [
    { branchId: 'a', active: true },
    { branchId: 'b', status: 'active' }
  ]);
});

test('pickActiveMembership returns requested branch membership when allowed', () => {
  const result = pickActiveMembership({
    memberships: [
      { branchId: 'b1', role: 'waiter', active: true },
      { branchId: 'b2', role: 'admin', status: 'active' }
    ],
    requestedBranchId: 'b2'
  });

  assert.equal(result.error, undefined);
  assert.equal(result.active.branchId, 'b2');
  assert.equal(result.active.role, 'admin');
});

test('pickActiveMembership asks user to select branch when multiple active memberships exist', () => {
  const result = pickActiveMembership({
    memberships: [
      { branchId: 'b1', role: 'waiter', active: true },
      { branchId: 'b2', role: 'admin', status: 'active' }
    ]
  });

  assert.equal(result.error, 'Select a branch');
  assert.deepEqual(result.branches, [
    { branchId: 'b1', role: 'waiter' },
    { branchId: 'b2', role: 'admin' }
  ]);
});
