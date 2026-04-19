const mongoose = require('mongoose');
const CustomerHistory = require('../../models/customers/CustomerHistory');
const Order = require('../../models/orders/Order');
const Table = require('../../models/tables/Table');

const orderTypeLabel = (ot) => {
  const m = {
    dine_in: 'Table',
    takeaway: 'Takeaway',
    delivery: 'Delivery',
    online: 'Online',
    staff: 'Staff'
  };
  return m[ot] || ot || 'Table';
};

const listSalesInvoices = async (req, res) => {
  try {
    const filter = req.branchId ? { branchId: req.branchId } : {};
    if (req.query.dateFrom || req.query.dateTo) {
      filter.paidAt = {};
      if (req.query.dateFrom) filter.paidAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.paidAt.$lte = new Date(req.query.dateTo);
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = (page - 1) * limit;

    const [total, rows] = await Promise.all([
      CustomerHistory.countDocuments(filter),
      CustomerHistory.find(filter).sort({ paidAt: -1 }).skip(skip).limit(limit).lean()
    ]);

    const orderIds = rows.map((r) => r.orderId).filter(Boolean);
    const orders = orderIds.length
      ? await Order.find({ _id: { $in: orderIds } })
          .select('orderType invoiceNo paymentMethod')
          .lean()
      : [];
    const orderMap = new Map(orders.map((o) => [o._id.toString(), o]));

    const tableNums = [...new Set(rows.map((r) => r.tableNumber).filter((n) => n != null && n !== ''))];
    let tableMap = new Map();
    if (req.branchId && tableNums.length) {
      const tables = await Table.find({
        branchId: req.branchId,
        tableNumber: { $in: tableNums }
      })
        .select('tableNumber name type')
        .lean();
      tableMap = new Map(
        tables.map((t) => [
          t.tableNumber,
          t.name && String(t.name).trim()
            ? String(t.name).trim()
            : `${String(t.type || 'table')} ${t.tableNumber}`
        ])
      );
    }

    const data = rows.map((row, idx) => {
      const ord = row.orderId ? orderMap.get(row.orderId.toString()) : null;
      const ot = ord?.orderType || 'dine_in';
      return {
        sn: skip + idx + 1,
        id: row.invoiceNo || `INV-${String(row.orderId || '').slice(-6)}`,
        orderId: row.orderId,
        parties: row.customerName || '-',
        orderType: orderTypeLabel(ot),
        orderTypeRaw: ot,
        txnAmount: Number(row.finalAmount ?? row.totalAmount ?? 0),
        mode: row.paymentMethod || '-',
        status: 'Paid',
        txnDate: row.paidAt,
        billedBy: row.waiter?.name || '-',
        particular: row.tableNumber != null ? tableMap.get(row.tableNumber) || `Table ${row.tableNumber}` : '-'
      };
    });

    const [agg] = await CustomerHistory.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: mongoose.model('Order').collection.name,
          localField: 'orderId',
          foreignField: '_id',
          as: 'ord'
        }
      },
      { $unwind: { path: '$ord', preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          totalAmt: [
            {
              $group: {
                _id: null,
                sum: { $sum: { $ifNull: ['$finalAmount', '$totalAmount'] } }
              }
            }
          ],
          byMode: [{ $group: { _id: '$paymentMethod', c: { $sum: 1 } } }],
          byOrderType: [
            {
              $group: {
                _id: { $ifNull: ['$ord.orderType', 'dine_in'] },
                c: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    const sumAmt = agg?.totalAmt?.[0]?.sum || 0;
    const modeCounts = Object.fromEntries((agg?.byMode || []).map((r) => [r._id || 'cash', r.c]));
    const leadingPaymentMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'cash';
    const typeCounts = {};
    for (const r of agg?.byOrderType || []) {
      const lab = orderTypeLabel(r._id);
      typeCounts[lab] = (typeCounts[lab] || 0) + r.c;
    }
    const mostUsedOrderType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Table';

    return res.json({
      data,
      total,
      page,
      limit,
      summary: {
        totalOrders: total,
        totalSales: sumAmt,
        leadingPaymentMode,
        mostUsedOrderType
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Sales invoices failed', error: error.message });
  }
};

module.exports = { listSalesInvoices };
