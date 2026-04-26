const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveSocketRooms } = require('../src/utils/realtime/socket');

test('resolveSocketRooms derives branch-scoped rooms from verified memberships', () => {
  const result = resolveSocketRooms({
    user: { role: 'superadmin' },
    memberships: [
      { branchId: 'b1', role: 'admin', status: 'active' },
      { branchId: 'b2', role: 'waiter', status: 'inactive' }
    ],
    branchId: 'b1'
  });

  assert.deepEqual(result, {
    branchId: 'b1',
    roles: ['admin', 'superadmin'],
    rooms: [
      'role:admin:branch:b1',
      'role:admin',
      'role:superadmin:branch:b1',
      'role:superadmin'
    ]
  });
});

test('resolveSocketRooms requires branch selection when multiple memberships exist', () => {
  const result = resolveSocketRooms({
    user: { role: 'admin' },
    memberships: [
      { branchId: 'b1', role: 'admin', status: 'active' },
      { branchId: 'b2', role: 'waiter', status: 'active' }
    ]
  });

  assert.equal(result.error, 'Select a branch');
  assert.deepEqual(result.branches, [
    { branchId: 'b1', role: 'admin' },
    { branchId: 'b2', role: 'waiter' }
  ]);
});
