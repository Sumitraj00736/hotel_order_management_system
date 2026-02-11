const Order = require('../models/Order');

const summaryReport = async (req, res) => {
  const orders = await Order.find();
  const totalOrders = orders.length;
  const totalSales = orders.filter((o) => o.status === 'paid').reduce((sum, o) => sum + o.totalAmount, 0);
  const byStatus = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  return res.json({ totalOrders, totalSales, byStatus });
};

module.exports = { summaryReport };
