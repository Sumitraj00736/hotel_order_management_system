const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isEditableOrderStatus,
  isAllowedOrderStatusTransition
} = require('../src/utils/orders/lifecycle');

test('isEditableOrderStatus allows active kitchen/service states only', () => {
  assert.equal(isEditableOrderStatus('pending'), true);
  assert.equal(isEditableOrderStatus('preparing'), true);
  assert.equal(isEditableOrderStatus('ready'), true);
  assert.equal(isEditableOrderStatus('served'), true);
  assert.equal(isEditableOrderStatus('paid'), false);
  assert.equal(isEditableOrderStatus('cancelled'), false);
});

test('isAllowedOrderStatusTransition allows operational states and cancellation only', () => {
  assert.equal(isAllowedOrderStatusTransition('pending'), true);
  assert.equal(isAllowedOrderStatusTransition('preparing'), true);
  assert.equal(isAllowedOrderStatusTransition('ready'), true);
  assert.equal(isAllowedOrderStatusTransition('served'), true);
  assert.equal(isAllowedOrderStatusTransition('cancelled'), true);
  assert.equal(isAllowedOrderStatusTransition('paid'), false);
  assert.equal(isAllowedOrderStatusTransition('refund'), false);
});
