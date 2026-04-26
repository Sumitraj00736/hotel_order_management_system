const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeEmail,
  normalizePhone,
  resolveLoginIdentifier
} = require('../src/utils/auth/identity');

test('normalizeEmail trims and lowercases values', () => {
  assert.equal(normalizeEmail('  ADMIN@Example.COM '), 'admin@example.com');
});

test('normalizePhone strips spaces and leading plus', () => {
  assert.equal(normalizePhone(' +977 98123 45678 '), '9779812345678');
});

test('resolveLoginIdentifier builds email lookup for email identifiers', () => {
  assert.deepEqual(resolveLoginIdentifier({ identifier: ' Boss@Cafe.com ' }), {
    raw: 'Boss@Cafe.com',
    type: 'email',
    lookup: [{ email: 'boss@cafe.com' }]
  });
});

test('resolveLoginIdentifier builds phone lookup for phone identifiers', () => {
  assert.deepEqual(resolveLoginIdentifier({ phone: ' +977 9800000000 ' }), {
    raw: '+977 9800000000',
    type: 'phone',
    lookup: [{ phone: '+977 9800000000' }, { phone: '9779800000000' }]
  });
});
