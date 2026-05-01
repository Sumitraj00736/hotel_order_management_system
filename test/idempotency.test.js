const test = require('node:test');
const assert = require('node:assert/strict');

const {
  IDEMPOTENCY_HEADER,
  buildFingerprint,
  getIdempotencyContext
} = require('../src/utils/http/idempotency');

test('buildFingerprint is stable for equivalent object key order', () => {
  const left = buildFingerprint({
    amount: 100,
    payments: [{ method: 'cash', amount: 100 }],
    meta: { b: 2, a: 1 }
  });
  const right = buildFingerprint({
    meta: { a: 1, b: 2 },
    payments: [{ method: 'cash', amount: 100 }],
    amount: 100
  });

  assert.equal(left, right);
});

test('getIdempotencyContext returns null when header is missing', () => {
  const req = {
    method: 'POST',
    originalUrl: '/api/bills/123/pay',
    header: () => '',
    body: {},
    user: { _id: 'u1' },
    branchId: 'b1'
  };

  assert.equal(getIdempotencyContext(req, 'scope.test'), null);
});

test('getIdempotencyContext captures scoped request metadata', () => {
  const req = {
    method: 'POST',
    originalUrl: '/api/payments',
    route: { path: '/:id/pay' },
    header: (name) => (name === IDEMPOTENCY_HEADER ? 'abc-123' : ''),
    body: { amount: 250, note: 'hello' },
    user: { _id: 'u1' },
    branchId: 'b1'
  };

  const ctx = getIdempotencyContext(req, 'scope.test');
  assert.equal(ctx.key, 'abc-123');
  assert.equal(ctx.scope, 'scope.test');
  assert.equal(ctx.method, 'POST');
  assert.equal(ctx.path, '/:id/pay');
  assert.equal(ctx.branchId, 'b1');
  assert.equal(ctx.userId, 'u1');
  assert.ok(ctx.fingerprint);
});
