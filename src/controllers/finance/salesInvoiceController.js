const SalesInvoice = require('../../models/finance/SalesInvoice');
const Payment = require('../../models/finance/Payment');

const orderTypeLabel = (ot) => {
  const m = {
    dine_in: 'Table',
    takeaway: 'Takeaway',
    delivery: 'Delivery',
    online: 'Online',
    staff: 'Staff',
    pickup: 'Pickup'
  };
  return m[ot] || ot || 'Table';
};

const listSalesInvoices = async (req, res) => {
  try {
    const filter = { status: 'active' };
    if (req.branchId) filter.branchId = req.branchId;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.closedAt = {};
      if (req.query.dateFrom) filter.closedAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.closedAt.$lte = new Date(req.query.dateTo);
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const skip = (page - 1) * limit;

    const [total, rows, paymentAgg] = await Promise.all([
      SalesInvoice.countDocuments(filter),
      SalesInvoice.find(filter).sort({ closedAt: -1 }).skip(skip).limit(limit).lean(),
      Payment.aggregate([
        {
          $match: {
            ...(req.branchId ? { branchId: req.branchId } : {}),
            status: 'active',
            direction: 'in',
            ...(req.query.dateFrom || req.query.dateTo
              ? {
                  txnDate: {
                    ...(req.query.dateFrom ? { $gte: new Date(req.query.dateFrom) } : {}),
                    ...(req.query.dateTo ? { $lte: new Date(req.query.dateTo) } : {})
                  }
                }
              : {})
          }
        },
        { $group: { _id: '$invoiceId', methods: { $addToSet: '$paymentMethod' } } }
      ])
    ]);

    const paymentMethodMap = new Map(
      paymentAgg.map((row) => [String(row._id), row.methods.filter(Boolean)])
    );

    const data = rows.map((row, idx) => {
      const methods = paymentMethodMap.get(String(row._id)) || row.paymentMethods || [];
      return {
        sn: skip + idx + 1,
        id: row.invoiceNo,
        invoiceId: row._id,
        orderId: row.orderId,
        parties: row.customerName || '-',
        orderType: orderTypeLabel(row.orderType),
        orderTypeRaw: row.orderType,
        txnAmount: Number(row.grandTotal || 0),
        amountPaid: Number(row.amountPaid || 0),
        amountDue: Number(row.amountDue || 0),
        mode: methods.length > 1 ? 'split' : methods[0] || '-',
        paymentMethods: methods,
        status: row.paymentStatus,
        txnDate: row.closedAt,
        billedBy: row.waiterName || '-',
        particular: row.tableNumber != null ? `Table ${row.tableNumber}` : '-'
      };
    });

    const summaryAgg = await SalesInvoice.aggregate([
      { $match: filter },
      {
        $facet: {
          totalAmt: [{ $group: { _id: null, sum: { $sum: '$grandTotal' } } }],
          byStatus: [{ $group: { _id: '$paymentStatus', c: { $sum: 1 } } }],
          byOrderType: [{ $group: { _id: '$orderType', c: { $sum: 1 } } }]
        }
      }
    ]);

    const paymentModeAgg = await Payment.aggregate([
      {
        $match: {
          ...(req.branchId ? { branchId: req.branchId } : {}),
          status: 'active',
          direction: 'in',
          ...(req.query.dateFrom || req.query.dateTo
            ? {
                txnDate: {
                  ...(req.query.dateFrom ? { $gte: new Date(req.query.dateFrom) } : {}),
                  ...(req.query.dateTo ? { $lte: new Date(req.query.dateTo) } : {})
                }
              }
            : {})
        }
      },
      { $group: { _id: '$paymentMethod', c: { $sum: 1 } } }
    ]);

    const agg = summaryAgg[0] || {};
    const sumAmt = agg.totalAmt?.[0]?.sum || 0;
    const leadingPaymentMode =
      paymentModeAgg.sort((a, b) => b.c - a.c)[0]?._id || 'cash';
    const typeCounts = {};
    for (const row of agg.byOrderType || []) {
      const label = orderTypeLabel(row._id);
      typeCounts[label] = (typeCounts[label] || 0) + row.c;
    }
    const mostUsedOrderType =
      Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Table';

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
