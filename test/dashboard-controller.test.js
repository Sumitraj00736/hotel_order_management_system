const test = require('node:test');
const assert = require('node:assert/strict');

const SalesInvoice = require('../src/models/finance/SalesInvoice');
const Purchase = require('../src/models/finance/Purchase');
const Expense = require('../src/models/finance/Expense');
const Income = require('../src/models/finance/Income');
const Payment = require('../src/models/finance/Payment');
const { financeDashboard } = require('../src/controllers/dashboard/dashboardDataController');

function createJsonResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('financeDashboard returns canonical KPIs and payment breakdown from active records', async () => {
  const original = {
    salesAggregate: SalesInvoice.aggregate,
    purchaseAggregate: Purchase.aggregate,
    expenseAggregate: Expense.aggregate,
    incomeAggregate: Income.aggregate,
    paymentAggregate: Payment.aggregate
  };

  const salesAggregateCalls = [];
  const paymentAggregateCalls = [];

  SalesInvoice.aggregate = async (pipeline) => {
    salesAggregateCalls.push(pipeline);
    if (salesAggregateCalls.length === 1) return [{ total: 1250 }];
    if (salesAggregateCalls.length === 2) return [{ _id: { year: 2026, month: 4 }, sales: 1250 }];
    return [];
  };
  Purchase.aggregate = async () => [{ total: 400 }];
  Expense.aggregate = async () => [{ total: 150 }];
  Income.aggregate = async () => [{ total: 75 }];
  Payment.aggregate = async (pipeline) => {
    paymentAggregateCalls.push(pipeline);
    if (paymentAggregateCalls.length === 1) return [{ total: 600 }];
    if (paymentAggregateCalls.length === 2) return [{ total: 120 }];
    if (paymentAggregateCalls.length === 3) {
      return [
        { _id: 'cash', amount: 350 },
        { _id: 'card', amount: 250 }
      ];
    }
    return [];
  };

  const req = {
    branchId: 'branch-1',
    query: {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30'
    }
  };
  const res = createJsonResponse();

  try {
    await financeDashboard(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.kpis, {
      sales: 1250,
      purchase: 400,
      income: 75,
      expenses: 150,
      paymentIn: 600,
      paymentOut: 120
    });
    assert.deepEqual(res.body.salesSeries, [{ month: '4/2026', sales: 1250 }]);
    assert.deepEqual(res.body.paymentBreakdown, [
      { method: 'cash', amount: 350 },
      { method: 'card', amount: 250 }
    ]);

    assert.equal(salesAggregateCalls.length, 2);
    assert.equal(paymentAggregateCalls.length, 3);

    const salesMatch = salesAggregateCalls[0][0].$match;
    assert.equal(salesMatch.branchId, 'branch-1');
    assert.equal(salesMatch.status, 'active');
    assert.ok(salesMatch.closedAt.$gte instanceof Date);
    assert.ok(salesMatch.closedAt.$lte instanceof Date);

    const paymentInMatch = paymentAggregateCalls[0][0].$match;
    assert.equal(paymentInMatch.branchId, 'branch-1');
    assert.equal(paymentInMatch.status, 'active');
    assert.equal(paymentInMatch.direction, 'in');

    const paymentOutMatch = paymentAggregateCalls[1][0].$match;
    assert.equal(paymentOutMatch.direction, 'out');

    const paymentBreakdownMatch = paymentAggregateCalls[2][0].$match;
    assert.equal(paymentBreakdownMatch.direction, 'in');
  } finally {
    SalesInvoice.aggregate = original.salesAggregate;
    Purchase.aggregate = original.purchaseAggregate;
    Expense.aggregate = original.expenseAggregate;
    Income.aggregate = original.incomeAggregate;
    Payment.aggregate = original.paymentAggregate;
  }
});
