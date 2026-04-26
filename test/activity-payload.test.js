const test = require('node:test');
const assert = require('node:assert/strict');

const { buildActivityPayload } = require('../src/utils/notifications/activity');

test('buildActivityPayload includes request forensic context and entity metadata', () => {
  const payload = buildActivityPayload({
    req: {
      requestId: 'req-42',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'CodexTest/1.0' }
    },
    branchId: 'branch-1',
    title: 'Payment created',
    type: 'Finance Payment',
    action: 'payment.create',
    description: 'Created a payment.',
    performedBy: 'user-1',
    entityType: 'payment',
    entityId: 'payment-1',
    metadata: { amount: 1000 }
  });

  assert.deepEqual(payload, {
    branchId: 'branch-1',
    title: 'Payment created',
    type: 'Finance Payment',
    action: 'payment.create',
    description: 'Created a payment.',
    performedBy: 'user-1',
    requestId: 'req-42',
    entityType: 'payment',
    entityId: 'payment-1',
    ipAddress: '127.0.0.1',
    userAgent: 'CodexTest/1.0',
    metadata: { amount: 1000 }
  });
});
