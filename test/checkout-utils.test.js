const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCheckoutComputation,
  reconcileInvoiceSettlement,
  buildPaymentDocuments
} = require('../src/utils/orders/checkout');

test('buildCheckoutComputation normalizes split payment checkout and change due', () => {
  const result = buildCheckoutComputation({
    order: { subTotal: 1000, totalAmount: 1000 },
    discountType: 'percent',
    discountValue: 10,
    taxRate: 13,
    tipsAmount: 50,
    roundOff: 0,
    paymentStatus: 'paid',
    payments: [
      { method: 'cash', amount: 600 },
      { method: 'card', amount: 700 }
    ]
  });

  assert.equal(result.invoiceTotals.subTotal, 1000);
  assert.equal(result.invoiceTotals.discountAmount, 100);
  assert.equal(result.invoiceTotals.taxableAmount, 900);
  assert.equal(result.invoiceTotals.taxAmount, 117);
  assert.equal(result.invoiceTotals.grandTotal, 1067);
  assert.equal(result.totalPaid, 1300);
  assert.equal(result.changeDue, 233);
  assert.equal(result.settlement.amountPaid, 1067);
  assert.equal(result.settlement.paymentStatus, 'paid');
  assert.equal(result.resolvedPaymentMethod, 'other');
  assert.equal(result.paymentRemark, 'Paid using cash, card');
});

test('buildCheckoutComputation supports unpaid credit checkout without payment rows', () => {
  const result = buildCheckoutComputation({
    order: { subTotal: 500, totalAmount: 500 },
    paymentStatus: 'unpaid_credit'
  });

  assert.equal(result.invoiceTotals.grandTotal, 500);
  assert.equal(result.totalPaid, 0);
  assert.equal(result.settlement.amountPaid, 0);
  assert.equal(result.settlement.paymentStatus, 'unpaid');
  assert.equal(result.changeDue, 0);
  assert.equal(result.resolvedPaymentMethod, undefined);
  assert.equal(result.paymentRemark, 'Unpaid/Credit');
});

test('buildPaymentDocuments caps applied rows to settled amount', () => {
  const docs = buildPaymentDocuments({
    branchId: 'branch-1',
    invoiceId: 'invoice-1',
    customerId: 'customer-1',
    customerName: 'Guest',
    payments: [
      { method: 'cash', amount: 500 },
      { method: 'card', amount: 700 }
    ],
    settledAmount: 900,
    closedAt: new Date('2026-04-26T10:00:00.000Z'),
    createdBy: 'user-1'
  });

  assert.deepEqual(docs, [
    {
      branchId: 'branch-1',
      invoiceId: 'invoice-1',
      direction: 'in',
      amount: 500,
      entryType: 'normal',
      accountHead: 'Sales',
      partyType: 'customer',
      partyId: 'customer-1',
      partyName: 'Guest',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      multiplePayment: true,
      txnDate: new Date('2026-04-26T10:00:00.000Z'),
      createdBy: 'user-1'
    },
    {
      branchId: 'branch-1',
      invoiceId: 'invoice-1',
      direction: 'in',
      amount: 400,
      entryType: 'normal',
      accountHead: 'Sales',
      partyType: 'customer',
      partyId: 'customer-1',
      partyName: 'Guest',
      paymentStatus: 'paid',
      paymentMethod: 'card',
      multiplePayment: true,
      txnDate: new Date('2026-04-26T10:00:00.000Z'),
      createdBy: 'user-1'
    }
  ]);
});

test('reconcileInvoiceSettlement applies repeat payments without recreating prior paid amount', () => {
  const result = reconcileInvoiceSettlement({
    invoiceTotals: { grandTotal: 1000 },
    previousAmountPaid: 400,
    currentRequestPaid: 700,
    requestedStatus: 'paid'
  });

  assert.equal(result.previousAmountPaid, 400);
  assert.equal(result.currentRequestPaid, 700);
  assert.equal(result.cumulativeSettlement.amountPaid, 1000);
  assert.equal(result.cumulativeSettlement.amountDue, 0);
  assert.equal(result.cumulativeSettlement.paymentStatus, 'paid');
  assert.equal(result.incrementalApplied, 600);
});
