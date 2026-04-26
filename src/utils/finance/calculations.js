const MathUtils = require('../mathUtils');

const sanitizeAmount = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return MathUtils.roundAmount(num);
};

const ensureNonNegative = (value, fieldName) => {
  const amount = sanitizeAmount(value);
  if (amount < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }
  return amount;
};

const normalizePercentage = (value, fieldName) => {
  const percent = sanitizeAmount(value);
  if (percent < 0 || percent > 100) {
    throw new Error(`${fieldName} must be between 0 and 100`);
  }
  return percent;
};

const sumAmounts = (values = []) => MathUtils.add(...values.map((value) => sanitizeAmount(value)));

const multiplyAmount = (amount, quantity) => {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty < 0) {
    throw new Error('Quantity must be a non-negative number');
  }
  return sanitizeAmount(sanitizeAmount(amount) * qty);
};

const normalizeDiscount = ({ subTotal, discountType = 'amount', discountValue = 0 }) => {
  const safeSubTotal = ensureNonNegative(subTotal, 'subTotal');
  const safeType = discountType === 'percent' ? 'percent' : 'amount';
  const safeValue =
    safeType === 'percent'
      ? normalizePercentage(discountValue, 'discountValue')
      : ensureNonNegative(discountValue, 'discountValue');

  const discountAmount =
    safeType === 'percent'
      ? sanitizeAmount((safeSubTotal * safeValue) / 100)
      : Math.min(safeSubTotal, safeValue);

  return {
    discountType: safeType,
    discountValue: safeValue,
    discountAmount: sanitizeAmount(discountAmount)
  };
};

const normalizeTax = ({ taxableAmount, taxRate = 0, taxAmount }) => {
  const safeTaxableAmount = ensureNonNegative(taxableAmount, 'taxableAmount');
  const safeRate = normalizePercentage(taxRate, 'taxRate');
  const computedTaxAmount = sanitizeAmount((safeTaxableAmount * safeRate) / 100);

  if (taxAmount !== undefined && sanitizeAmount(taxAmount) !== computedTaxAmount) {
    throw new Error('taxAmount does not match taxableAmount and taxRate');
  }

  return {
    taxRate: safeRate,
    taxAmount: computedTaxAmount
  };
};

const normalizePaymentBreakdown = (payments = [], fallbackMethod = 'cash') => {
  const normalized = (Array.isArray(payments) ? payments : [])
    .map((entry) => ({
      method: String(entry?.method || fallbackMethod || 'cash').trim().toLowerCase(),
      amount: ensureNonNegative(entry?.amount || 0, 'payment amount')
    }))
    .filter((entry) => entry.amount > 0);

  return normalized;
};

const deriveSettlement = ({ grandTotal, amountPaid, requestedStatus }) => {
  const safeGrandTotal = ensureNonNegative(grandTotal, 'grandTotal');
  const safeAmountPaid = ensureNonNegative(amountPaid, 'amountPaid');
  const cappedAmountPaid = Math.min(safeGrandTotal, safeAmountPaid);
  const amountDue = sanitizeAmount(Math.max(0, safeGrandTotal - cappedAmountPaid));

  let paymentStatus = 'unpaid';
  if (cappedAmountPaid >= safeGrandTotal && safeGrandTotal > 0) {
    paymentStatus = 'paid';
  } else if (cappedAmountPaid > 0) {
    paymentStatus = 'partial';
  } else if (requestedStatus === 'unpaid_credit') {
    paymentStatus = 'unpaid';
  }

  return {
    amountPaid: cappedAmountPaid,
    amountDue,
    paymentStatus
  };
};

const computeOrderInvoiceTotals = ({
  subTotal,
  discountType = 'amount',
  discountValue = 0,
  taxRate = 0,
  tipsAmount = 0,
  roundOff = 0
}) => {
  const safeSubTotal = ensureNonNegative(subTotal, 'subTotal');
  const discount = normalizeDiscount({ subTotal: safeSubTotal, discountType, discountValue });
  const taxableAmount = sanitizeAmount(Math.max(0, safeSubTotal - discount.discountAmount));
  const tax = normalizeTax({ taxableAmount, taxRate });
  const safeTipsAmount = ensureNonNegative(tipsAmount, 'tipsAmount');
  const safeRoundOff = sanitizeAmount(roundOff);
  const grandTotal = sanitizeAmount(
    Math.max(0, taxableAmount + tax.taxAmount + safeTipsAmount + safeRoundOff)
  );

  return {
    subTotal: safeSubTotal,
    discountType: discount.discountType,
    discountValue: discount.discountValue,
    discountAmount: discount.discountAmount,
    taxableAmount,
    taxRate: tax.taxRate,
    taxAmount: tax.taxAmount,
    tipsAmount: safeTipsAmount,
    roundOff: safeRoundOff,
    grandTotal
  };
};

const buildLineItemsSummary = ({
  items = [],
  quantityKeys = ['qty', 'quantity', 'returnQty'],
  rateKeys = ['rate', 'unitPrice', 'priceAtOrderTime'],
  amountKeys = ['amount', 'total', 'lineTotal']
}) => {
  const normalizedItems = (Array.isArray(items) ? items : []).map((item) => {
    const quantityRaw = quantityKeys.map((key) => item?.[key]).find((value) => value !== undefined);
    const rateRaw = rateKeys.map((key) => item?.[key]).find((value) => value !== undefined);
    const amountRaw = amountKeys.map((key) => item?.[key]).find((value) => value !== undefined);

    const quantity = ensureNonNegative(quantityRaw || 0, 'quantity');
    const rate = ensureNonNegative(rateRaw || 0, 'rate');
    const computedAmount = multiplyAmount(rate, quantity);

    if (amountRaw !== undefined && sanitizeAmount(amountRaw) !== computedAmount) {
      throw new Error('Line amount does not match quantity x rate');
    }

    return {
      ...item,
      quantity,
      qty: quantity,
      returnQty: quantity,
      rate,
      unitPrice: rate,
      priceAtOrderTime: rate,
      amount: computedAmount,
      total: computedAmount,
      lineTotal: computedAmount
    };
  });

  return {
    items: normalizedItems,
    subTotal: sumAmounts(normalizedItems.map((item) => item.amount))
  };
};

const computeSimpleTotals = ({
  items = [],
  discountType = 'amount',
  discountValue = 0,
  taxRate = 0,
  roundOff = 0,
  quantityKeys,
  rateKeys,
  amountKeys
}) => {
  const lineSummary = buildLineItemsSummary({ items, quantityKeys, rateKeys, amountKeys });
  const discount = normalizeDiscount({
    subTotal: lineSummary.subTotal,
    discountType,
    discountValue
  });
  const taxableAmount = sanitizeAmount(Math.max(0, lineSummary.subTotal - discount.discountAmount));
  const tax = normalizeTax({ taxableAmount, taxRate });
  const safeRoundOff = sanitizeAmount(roundOff);
  const grandTotal = sanitizeAmount(Math.max(0, taxableAmount + tax.taxAmount + safeRoundOff));

  return {
    items: lineSummary.items,
    subTotal: lineSummary.subTotal,
    discountType: discount.discountType,
    discountValue: discount.discountValue,
    discountAmount: discount.discountAmount,
    taxableAmount,
    taxRate: tax.taxRate,
    taxAmount: tax.taxAmount,
    roundOff: safeRoundOff,
    grandTotal
  };
};

module.exports = {
  sanitizeAmount,
  ensureNonNegative,
  normalizePercentage,
  sumAmounts,
  multiplyAmount,
  normalizeDiscount,
  normalizeTax,
  normalizePaymentBreakdown,
  deriveSettlement,
  computeOrderInvoiceTotals,
  buildLineItemsSummary,
  computeSimpleTotals
};
