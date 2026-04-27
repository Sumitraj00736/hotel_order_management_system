const {
  computeOrderInvoiceTotals,
  normalizePaymentBreakdown,
  deriveSettlement,
  sanitizeAmount
} = require('../finance/calculations');

const buildCheckoutComputation = ({
  order,
  paymentMethod,
  paymentStatus = 'paid',
  discountType = 'amount',
  discountValue = 0,
  taxRate = 0,
  tipsAmount = 0,
  roundOff = 0,
  tenderAmount = 0,
  payments
}) => {
  const invoiceTotals = computeOrderInvoiceTotals({
    subTotal: order.subTotal ?? order.totalAmount,
    discountType,
    discountValue,
    taxRate,
    tipsAmount,
    roundOff
  });

  const normalizedPayments = normalizePaymentBreakdown(
    payments ||
      (paymentMethod
        ? [{ method: paymentMethod, amount: tenderAmount || invoiceTotals.grandTotal }]
        : []),
    paymentMethod || 'cash'
  );

  if (normalizedPayments.length === 1 && normalizedPayments[0].amount === 0) {
    normalizedPayments[0].amount = invoiceTotals.grandTotal;
  }

  const totalPaid = sanitizeAmount(
    normalizedPayments.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)
  );
  const settlement = deriveSettlement({
    grandTotal: invoiceTotals.grandTotal,
    amountPaid: totalPaid,
    requestedStatus: paymentStatus
  });
  const changeDue = sanitizeAmount(Math.max(0, totalPaid - invoiceTotals.grandTotal));

  let resolvedPaymentMethod;
  if (normalizedPayments.length === 1) {
    resolvedPaymentMethod = normalizedPayments[0].method;
  } else if (normalizedPayments.length > 1) {
    resolvedPaymentMethod = 'other';
  } else {
    resolvedPaymentMethod = paymentMethod || undefined;
  }

  const paymentRemark =
    normalizedPayments.length > 0
      ? `Paid using ${normalizedPayments.map((entry) => entry.method).join(', ')}`
      : 'Unpaid/Credit';

  return {
    invoiceTotals,
    payments: normalizedPayments,
    settlement,
    changeDue,
    totalPaid,
    resolvedPaymentMethod,
    paymentRemark
  };
};

const reconcileInvoiceSettlement = ({
  invoiceTotals,
  currentRequestPaid = 0,
  previousAmountPaid = 0,
  requestedStatus = 'paid'
}) => {
  const safePreviousAmountPaid = sanitizeAmount(previousAmountPaid);
  const safeCurrentRequestPaid = sanitizeAmount(currentRequestPaid);
  const cumulativeRequestedPaid = sanitizeAmount(safePreviousAmountPaid + safeCurrentRequestPaid);
  const cumulativeSettlement = deriveSettlement({
    grandTotal: invoiceTotals.grandTotal,
    amountPaid: cumulativeRequestedPaid,
    requestedStatus
  });

  const incrementalApplied = sanitizeAmount(
    Math.max(0, cumulativeSettlement.amountPaid - safePreviousAmountPaid)
  );

  return {
    previousAmountPaid: safePreviousAmountPaid,
    currentRequestPaid: safeCurrentRequestPaid,
    cumulativeSettlement,
    incrementalApplied
  };
};

const buildPaymentDocuments = ({
  branchId,
  invoiceId,
  customerId,
  customerName,
  payments,
  settledAmount,
  closedAt,
  createdBy
}) => {
  if (!settledAmount || settledAmount <= 0 || !Array.isArray(payments) || payments.length === 0) {
    return [];
  }

  let remainingToApply = sanitizeAmount(settledAmount);
  const docs = [];

  for (const entry of payments) {
    if (remainingToApply <= 0) break;
    const amount = sanitizeAmount(Math.min(Number(entry.amount || 0), remainingToApply));
    if (amount <= 0) continue;

    docs.push({
      branchId,
      invoiceId,
      direction: 'in',
      amount,
      entryType: 'normal',
      accountHead: 'Sales',
      partyType: 'customer',
      partyId: customerId || undefined,
      partyName: customerName || 'Walk-in',
      paymentStatus: 'paid',
      paymentMethod: entry.method,
      multiplePayment: payments.length > 1,
      txnDate: closedAt,
      createdBy
    });

    remainingToApply = sanitizeAmount(remainingToApply - amount);
  }

  return docs;
};

module.exports = {
  buildCheckoutComputation,
  reconcileInvoiceSettlement,
  buildPaymentDocuments
};
