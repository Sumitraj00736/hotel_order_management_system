const Order = require('../../models/orders/Order');
const Table = require('../../models/tables/Table');
const SalesInvoice = require('../../models/finance/SalesInvoice');
const Payment = require('../../models/finance/Payment');
const { emitOrderUpdate, emitTableUpdate } = require('../../utils/realtime/socket');
const { notifyRole, notifyUser } = require('../../utils/notifications/notify');
const { logActivity } = require('../../utils/notifications/activity');
const { nextSequence } = require('../../utils/common/counter');
const {
  sanitizeAmount
} = require('../../utils/finance/calculations');
const {
  buildCheckoutComputation,
  buildPaymentDocuments
} = require('../../utils/orders/checkout');

const generateBill = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) })
    .populate('table')
    .populate('items.menuItem')
    .populate('createdBy', 'name email role')
    .populate('kitchenAssigned', 'name email role');

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Only allow waiters to view bills for orders they created
  if (req.user.role === 'waiter' && order.createdBy?._id?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const bill = {
    orderId: order._id,
    tableNumber: order.table?.tableNumber,
    items: order.items.map((item) => ({
      name: item.menuItem?.name,
      quantity: item.quantity,
      price: item.priceAtOrderTime,
      lineTotal: item.quantity * item.priceAtOrderTime
    })),
    subTotal: order.subTotal ?? order.totalAmount,
    discountType: order.discountType,
    discountValue: order.discountValue,
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
    taxAmount: order.taxAmount,
    tipsAmount: order.tipsAmount,
    roundOff: order.roundOff,
    taxableAmount: order.taxableAmount ?? order.totalAmount,
    finalAmount: order.finalAmount ?? order.totalAmount,
    totalAmount: order.totalAmount,
    invoiceNo: order.invoiceNo,
    kotNo: order.kotNo,
    paymentStatus: order.paymentStatus,
    status: order.status,
    createdAt: order.createdAt,
    waiter: order.createdBy?.name,
    kitchen: order.kitchenAssigned?.name,
    paymentMethod: order.paymentMethod || null,
    paidAt: order.paidAt || null,
    orderType: order.orderType,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    deliveryPlatform: order.deliveryPlatform
  };

  return res.json(bill);
};

const payBill = async (req, res) => {
  let session;
  try {
    session = await Order.startSession();
    session.startTransaction();

    let { payments } = req.body;
    const {
      paymentMethod,
      paymentStatus = 'paid', // 'paid', 'unpaid_credit', 'partial'
      discountType = 'amount',
      discountValue = 0,
      taxRate = 0,
      tipsAmount = 0,
      roundOff = 0,
      tenderAmount = 0,
      customerName,
      customerId
    } = req.body;

    const order = await Order.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) })
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role')
      .session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only allow waiters to pay their own orders
    if (req.user.role === 'waiter' && order.createdBy?._id?.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (order.status === 'paid') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Order already paid' });
    }

    const checkout = buildCheckoutComputation({
      order,
      paymentMethod,
      paymentStatus,
      discountType,
      discountValue,
      taxRate,
      tipsAmount,
      roundOff,
      tenderAmount,
      payments
    });
    const { invoiceTotals, settlement, changeDue, totalPaid, resolvedPaymentMethod, paymentRemark } = checkout;
    payments = checkout.payments;
    const finalPaymentStatus = settlement.paymentStatus;

    const invoiceSeq = await nextSequence(`invoice:${req.branchId}`);
    const invoiceNoStr = `INV-${invoiceSeq}`;
    
    // 1. Update Order
    order.invoiceNo = order.invoiceNo || invoiceNoStr;
    order.status = finalPaymentStatus === 'paid' ? 'paid' : order.status;
    order.paymentStatus = finalPaymentStatus;
    
    order.paymentMethod = resolvedPaymentMethod;
    order.paymentRemark = paymentRemark;
    order.paidAt = new Date();
    order.paidBy = req.user._id;
    order.subTotal = invoiceTotals.subTotal;
    order.discountType = invoiceTotals.discountType;
    order.discountValue = invoiceTotals.discountValue;
    order.discountAmount = invoiceTotals.discountAmount;
    order.taxRate = invoiceTotals.taxRate;
    order.taxAmount = invoiceTotals.taxAmount;
    order.tipsAmount = invoiceTotals.tipsAmount;
    order.roundOff = invoiceTotals.roundOff;
    order.taxableAmount = invoiceTotals.taxableAmount;
    order.finalAmount = invoiceTotals.grandTotal;
    order.tenderAmount = totalPaid || sanitizeAmount(tenderAmount || 0);
    order.changeDue = changeDue;
    if (customerId) order.customerId = customerId;
    if (customerName) order.customerName = customerName;
    
    await order.save({ session });

    // 2. Free Table
    if (order.table && order.table._id && (finalPaymentStatus === 'paid' || paymentStatus === 'unpaid_credit')) {
      const updatedTable = await Table.findOneAndUpdate(
        { _id: order.table._id, ...(req.branchId ? { branchId: req.branchId } : {}) },
        { status: 'available' },
        { new: true, session }
      );
      if (updatedTable) {
        emitTableUpdate(updatedTable);
      }
    }

    // 3. Create SalesInvoice
    const salesInvoice = await SalesInvoice.create([{
      branchId: req.branchId,
      orderId: order._id,
      customerId: order.customerId || undefined,
      invoiceNo: order.invoiceNo,
      tableNumber: order.table?.tableNumber,
      items: order.items.map((item) => ({
        menuItem: item.menuItem?._id,
        name: item.menuItem?.name || item.name || 'Item',
        quantity: item.quantity,
        priceAtOrderTime: item.priceAtOrderTime,
        lineTotal: item.quantity * item.priceAtOrderTime
      })),
      subTotal: order.subTotal,
      discountType: order.discountType,
      discountValue: order.discountValue,
      discountAmount: order.discountAmount,
      taxRate: order.taxRate,
      taxAmount: order.taxAmount,
      taxableAmount: order.taxableAmount,
      tipsAmount: order.tipsAmount,
      roundOff: order.roundOff,
      grandTotal: order.finalAmount,
      amountPaid: settlement.amountPaid,
      paymentMethods: payments.map((entry) => entry.method),
      orderType: order.orderType,
      customerName: order.customerName || customerName || '',
      waiterId: order.createdBy?._id,
      waiterName: order.createdBy?.name,
      createdBy: req.user._id,
      closedAt: new Date()
    }], { session });

    const invoiceDoc = salesInvoice[0];

    // 4. Create Payment Records
    if (settlement.amountPaid > 0 && payments.length > 0) {
      const paymentDocs = buildPaymentDocuments({
        branchId: req.branchId,
        invoiceId: invoiceDoc._id,
        customerId: invoiceDoc.customerId || undefined,
        customerName: customerName || invoiceDoc.customerName || 'Walk-in',
        payments,
        settledAmount: settlement.amountPaid,
        closedAt: invoiceDoc.closedAt,
        createdBy: req.user._id
      });

      if (paymentDocs.length > 0) {
        await Payment.insertMany(paymentDocs, { session });
      }
    }
    
    await session.commitTransaction();
    session.endSession();

    const populated = await Order.findById(order._id)
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role')
      .populate('paidBy', 'name email role');

    emitOrderUpdate(populated);
    await notifyRole({
      role: 'admin',
      type: 'order:paid',
      category: 'order',
      message: `Payment received for table ${populated.table?.tableNumber || populated.customerName} (INV: ${populated.invoiceNo})`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    
    if (populated.createdBy) {
      await notifyUser({
        role: 'waiter',
        userId: populated.createdBy._id,
        type: 'order:paid',
        category: 'order',
        message: `Order paid for table ${populated.table?.tableNumber}`,
        orderId: populated._id,
        tableNumber: populated.table?.tableNumber,
        branchId: req.branchId
      });
    }

    await logActivity({
      branchId: req.branchId,
      title: 'Order checked out',
      type: 'Order Checkout',
      description: `${req.user?.name || 'Staff'} checked out order (INV: ${populated.invoiceNo})`,
      performedBy: req.user?._id
    });

    return res.json({ message: 'Payment recorded', orderId: order._id, status: order.status });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (_) {}
    }
    return res.status(500).json({ message: 'Payment failed', error: error.message });
  }
};

module.exports = { generateBill, payBill };
