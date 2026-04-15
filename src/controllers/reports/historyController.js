const CustomerHistory = require('../../models/customers/CustomerHistory');

const fetchHistory = async ({ branchId, tableNumber, paymentMethod, limit = 200 }) => {
  const filter = {};
  if (branchId) filter.branchId = branchId;
  if (tableNumber) filter.tableNumber = Number(tableNumber);
  if (paymentMethod) filter.paymentMethod = paymentMethod;

  return CustomerHistory.find(filter).sort({ paidAt: -1 }).limit(limit);
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
