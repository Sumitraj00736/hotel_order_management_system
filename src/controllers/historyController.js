const CustomerHistory = require('../models/CustomerHistory');

const listHistory = async (req, res) => {
  const filter = {};
  if (req.query.tableNumber) {
    filter.tableNumber = Number(req.query.tableNumber);
  }
  if (req.query.paymentMethod) {
    filter.paymentMethod = req.query.paymentMethod;
  }

  const history = await CustomerHistory.find(filter).sort({ paidAt: -1 });
  return res.json(history);
};

module.exports = { listHistory };
