const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeOrderInvoiceTotals,
  computeSimpleTotals,
  deriveSettlement,
  normalizePaymentBreakdown
} = require('../src/utils/finance/calculations');

test('computeOrderInvoiceTotals calculates discount, tax, and grand total on backend', () => {
  const totals = computeOrderInvoiceTotals({
    subTotal: 1000,
    discountType: 'percent',
    discountValue: 10,
    taxRate: 13,
    tipsAmount: 50,
    roundOff: -0.5
  });

  assert.deepEqual(totals, {
    subTotal: 1000,
    discountType: 'percent',
    discountValue: 10,
    discountAmount: 100,
    taxableAmount: 900,
    taxRate: 13,
    taxAmount: 117,
    tipsAmount: 50,
    roundOff: -0.5,
    grandTotal: 1066.5
  });
});

test('computeSimpleTotals validates line totals and computes header totals', () => {
  const totals = computeSimpleTotals({
    items: [
      { qty: 2, rate: 100, amount: 200 },
      { qty: 1, rate: 50, amount: 50 }
    ],
    discountType: 'amount',
    discountValue: 25,
    taxRate: 13,
    roundOff: 0
  });

  assert.equal(totals.subTotal, 250);
  assert.equal(totals.discountAmount, 25);
  assert.equal(totals.taxableAmount, 225);
  assert.equal(totals.taxAmount, 29.25);
  assert.equal(totals.grandTotal, 254.25);
});

test('deriveSettlement caps amountPaid and computes due/payment status correctly', () => {
  const settlement = deriveSettlement({
    grandTotal: 1000,
    amountPaid: 1200
  });

  assert.deepEqual(settlement, {
    amountPaid: 1000,
    amountDue: 0,
    paymentStatus: 'paid'
  });
});

test('normalizePaymentBreakdown keeps only positive payment rows', () => {
  const rows = normalizePaymentBreakdown([
    { method: 'cash', amount: 500 },
    { method: 'card', amount: 0 },
    { method: 'bank', amount: 250 }
  ]);

  assert.deepEqual(rows, [
    { method: 'cash', amount: 500 },
    { method: 'bank', amount: 250 }
  ]);
});
