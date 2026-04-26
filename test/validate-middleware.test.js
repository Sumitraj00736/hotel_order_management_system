const test = require('node:test');
const assert = require('node:assert/strict');

const { buildValidationErrorPayload } = require('../src/middleware/validate');

test('buildValidationErrorPayload returns standardized error shape', () => {
  const payload = buildValidationErrorPayload([
    { type: 'field', path: 'amount', msg: 'Invalid value', location: 'body' }
  ]);

  assert.deepEqual(payload, {
    errors: [
      { type: 'field', path: 'amount', msg: 'Invalid value', location: 'body' }
    ]
  });
});

test('buildValidationErrorPayload tolerates empty inputs', () => {
  assert.deepEqual(buildValidationErrorPayload(), { errors: [] });
  assert.deepEqual(buildValidationErrorPayload(null), { errors: [] });
});
