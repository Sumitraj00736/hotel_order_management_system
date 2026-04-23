const Order = require('../../models/orders/Order');
const Table = require('../../models/tables/Table');
const CustomerHistory = require('../../models/customers/CustomerHistory');
const SalesInvoice = require('../../models/finance/SalesInvoice');
const Payment = require('../../models/finance/Payment');
const { emitOrderUpdate, emitTableUpdate } = require('../../utils/realtime/socket');
const { notifyRole, notifyUser } = require('../../utils/notifications/notify');
const { logActivity } = require('../../utils/notifications/activity');
const { nextSequence } = require('../../utils/common/counter');

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

    // Adapt legacy single payment -> new payments array
    if (!payments) {
      if (paymentStatus === 'paid' && paymentMethod) {
        // We calculate finalAmount below, so we'll just set it temporarily and update it
        payments = [{ method: paymentMethod, amount: tenderAmount || 0 }];
      } else {
        payments = [];
      }
    }

    const subTotal = order.subTotal ?? order.totalAmount;
    const discountAmt =
      discountType === 'percent'
        ? (subTotal * Number(discountValue || 0)) / 100
        : Number(discountValue || 0);
    const taxableAmount = Math.max(0, subTotal - discountAmt);
    const taxAmount = (taxableAmount * Number(taxRate || 0)) / 100;
    const finalAmount = Math.max(0, taxableAmount + taxAmount + Number(tipsAmount || 0) + Number(roundOff || 0));
    
    if (payments.length === 1 && payments[0].amount === 0) {
       payments[0].amount = finalAmount;
    }
    
    // Sum the payments
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const amountPaid = Math.min(finalAmount, totalPaid); // Realized revenue (don't count returned change)
    const changeDue = Math.max(0, totalPaid - finalAmount);

    let finalPaymentStatus = 'unpaid';
    if (amountPaid >= finalAmount) {
      finalPaymentStatus = 'paid';
    } else if (amountPaid > 0) {
      finalPaymentStatus = 'partial';
    } else if (paymentStatus === 'unpaid_credit') {
      finalPaymentStatus = 'unpaid'; // Credit logic handled by amountDue > 0
    }

    const invoiceSeq = await nextSequence(`invoice:${req.branchId}`);
    const invoiceNoStr = `INV-${invoiceSeq}`;
    
    // 1. Update Order
    order.invoiceNo = order.invoiceNo || invoiceNoStr;
    order.status = finalPaymentStatus === 'paid' ? 'paid' : order.status;
    order.paymentStatus = finalPaymentStatus;
    
    if (payments.length === 1) {
      order.paymentMethod = payments[0].method;
    } else if (payments.length > 1) {
      order.paymentMethod = 'split';
    } else {
      order.paymentMethod = paymentMethod || 'unpaid';
    }
    
    order.paymentRemark = payments.length > 0 ? `Paid using ${payments.map(p => p.method).join(', ')}` : 'Unpaid/Credit';
    order.paidAt = new Date();
    order.paidBy = req.user._id;
    order.subTotal = subTotal;
    order.discountType = discountType;
    order.discountValue = Number(discountValue || 0);
    order.discountAmount = discountAmt;
    order.taxRate = Number(taxRate || 0);
    order.taxAmount = taxAmount;
    order.tipsAmount = Number(tipsAmount || 0);
    order.roundOff = Number(roundOff || 0);
    order.taxableAmount = taxableAmount;
    order.finalAmount = finalAmount;
    order.tenderAmount = Number(totalPaid || tenderAmount || 0);
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
      grandTotal: order.finalAmount,
      amountPaid: amountPaid,
      waiterId: order.createdBy?._id,
      waiterName: order.createdBy?.name,
      createdBy: req.user._id,
      closedAt: new Date()
    }], { session });

    const invoiceDoc = salesInvoice[0];

    // 4. Create Payment Records
    if (amountPaid > 0 && payments.length > 0) {
      let remainingToApply = amountPaid; // We only record up to the grandTotal as revenue
      
      const paymentDocs = [];
      for (const p of payments) {
        if (remainingToApply <= 0) break;
        const amt = Math.min(Number(p.amount), remainingToApply);
        
        paymentDocs.push({
          branchId: req.branchId,
          invoiceId: invoiceDoc._id,
          direction: 'in',
          amount: amt,
          entryType: 'normal',
          accountHead: 'Sales',
          partyType: 'customer',
          partyId: invoiceDoc.customerId || undefined,
          partyName: customerName || 'Walk-in',
          paymentStatus: 'paid',
          paymentMethod: p.method,
          multiplePayment: payments.length > 1,
          txnDate: invoiceDoc.closedAt,
          createdBy: req.user._id
        });
        
        remainingToApply -= amt;
      }
      
      if (paymentDocs.length > 0) {
        await Payment.insertMany(paymentDocs, { session });
      }
    }
    
    // Legacy support: We still write to CustomerHistory simply to not break any existing simple reports 
    // that haven't been migrated yet, but it can be safely removed later.
    const existingHistory = await CustomerHistory.findOne({ orderId: order._id }).session(session);
    if (!existingHistory) {
      await CustomerHistory.create([{
        branchId: req.branchId,
        orderId: order._id,
        tableNumber: order.table?.tableNumber,
        items: order.items.map((item) => ({
          name: item.menuItem?.name || item.name || 'Item',
          quantity: item.quantity,
          priceAtOrderTime: item.priceAtOrderTime
        })),
        totalAmount: order.totalAmount,
        invoiceNo: order.invoiceNo,
        paymentMode: order.paymentMethod,
        finalAmount,
        discountAmount: discountAmt,
        taxAmount,
        paymentMethod: payments[0]?.method || 'cash',
        paidAt: order.paidAt,
        waiter: {
          id: order.createdBy?._id,
          name: order.createdBy?.name
        },
        kitchen: {
          id: order.kitchenAssigned?._id,
          name: order.kitchenAssigned?.name
        },
        orderTakenAt: order.createdAt
      }], { session });
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
