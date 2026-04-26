const SalesInvoice = require('../../models/finance/SalesInvoice');

const fetchHistory = async ({ branchId, tableNumber, paymentMethod, limit = 200 }) => {
  const filter = { status: 'active' };
  if (branchId) filter.branchId = branchId;
  if (tableNumber) filter.tableNumber = Number(tableNumber);
  if (paymentMethod) filter.paymentMethods = paymentMethod;

  return SalesInvoice.find(filter).sort({ closedAt: -1 }).limit(limit);
};

const listHistory = async (req, res) => {
  const history = await fetchHistory({
    branchId: req.branchId,
    tableNumber: req.query.tableNumber,
    paymentMethod: req.query.paymentMethod,
    limit: Number(req.query.limit) || 200
  });
  return res.json(history);
};

module.exports = { listHistory, fetchHistory };
