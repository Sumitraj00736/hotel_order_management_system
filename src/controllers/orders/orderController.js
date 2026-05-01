const Order = require('../../models/orders/Order');
const MenuItem = require('../../models/menu/MenuItem');
const Table = require('../../models/tables/Table');
const Ingredient = require('../../models/inventory/Ingredient');
const Recipe = require('../../models/menu/Recipe');
const StockTransaction = require('../../models/inventory/StockTransaction');
const UserBranchRole = require('../../models/users/UserBranchRole');
const { emitNewOrder, emitOrderUpdate, emitTableUpdate } = require('../../utils/realtime/socket');
const { notifyRole, notifyUser } = require('../../utils/notifications/notify');
const { logActivity } = require('../../utils/notifications/activity');
const { nextSequence } = require('../../utils/common/counter');
const { computeOrderInvoiceTotals } = require('../../utils/finance/calculations');
const {
  isEditableOrderStatus,
  isAllowedOrderStatusTransition
} = require('../../utils/orders/lifecycle');

const ensureActiveSession = (session) => {
  if (!session) {
    throw new Error('Inventory updates require an active database session');
  }
};

const buildOrderItems = async (items, branchId) => {
  const menuIds = items.map((item) => item.menuItem);
  const filter = { _id: { $in: menuIds }, isAvailable: true };
  if (branchId) filter.branchId = branchId;
  const menuItems = await MenuItem.find(filter);
  if (menuItems.length !== menuIds.length) {
    throw new Error('One or more menu items are unavailable');
  }

  const menuMap = new Map(menuItems.map((item) => [item._id.toString(), item]));
  const orderItems = items.map((item) => {
    const menu = menuMap.get(item.menuItem);
    let variant = null;
    if (item.variantId && menu?.variants?.length) {
      variant = menu.variants.find((v) => v._id.toString() === item.variantId.toString());
      if (!variant) {
        throw new Error('Selected variant not found');
      }
    }
    const price = variant ? variant.price : menu.price;
    return {
      menuItem: menu._id,
      quantity: item.quantity,
      priceAtOrderTime: price,
      isComplimentary: Boolean(item.isComplimentary),
      variantId: variant?._id,
      variantName: variant?.name,
      variantPrice: variant?.price,
      itemNote: item.itemNote
    };
  });

  const totalAmount = orderItems.reduce(
    (sum, item) => sum + (item.isComplimentary ? 0 : item.quantity * item.priceAtOrderTime),
    0
  );
  return { orderItems, totalAmount };
};

const computeIngredientNeeds = async (orderItems) => {
  const menuIds = orderItems.map((item) => item.menuItem);
  const recipes = await Recipe.find({ menuItem: { $in: menuIds } });
  if (recipes.length === 0) return { needs: new Map(), recipeMap: new Map() };
  const recipeMap = new Map(recipes.map((r) => [r.menuItem.toString(), r]));
  const needs = new Map();

  orderItems.forEach((orderItem) => {
    const recipe = recipeMap.get(orderItem.menuItem.toString());
    if (!recipe) return;
    recipe.ingredients.forEach((component) => {
      const key = component.ingredient.toString();
      const total = component.quantity * orderItem.quantity;
      needs.set(key, (needs.get(key) || 0) + total);
    });
  });
  return { needs, recipeMap };
};

const ensureInventoryAvailability = async (orderItems, session) => {
  ensureActiveSession(session);
  const { needs } = await computeIngredientNeeds(orderItems);
  if (needs.size === 0) return; // no recipes configured

  const ingredients = await Ingredient.find({ _id: { $in: Array.from(needs.keys()) } }).session(session);
  const missing = [];
  const foundIds = new Set(ingredients.map((ing) => ing._id.toString()));
  ingredients.forEach((ing) => {
    const required = needs.get(ing._id.toString()) || 0;
    if (ing.currentStock < required) {
      missing.push(`${ing.name} (need ${required}${ing.unit}, have ${ing.currentStock}${ing.unit})`);
    }
  });
  Array.from(needs.keys()).forEach((ingredientId) => {
    if (!foundIds.has(ingredientId)) {
      missing.push(`Unknown ingredient (${ingredientId})`);
    }
  });
  if (missing.length > 0) {
    throw new Error(`Insufficient stock: ${missing.join(', ')}`);
  }
};

const consumeInventory = async (orderItems, orderId, userId, session) => {
  ensureActiveSession(session);
  const { needs } = await computeIngredientNeeds(orderItems);
  const ingredientIds = Array.from(needs.keys());
  if (ingredientIds.length === 0) return;

  const transactions = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const ingredientId of ingredientIds) {
    const required = needs.get(ingredientId) || 0;
    const ingredient = await Ingredient.findOneAndUpdate(
      { _id: ingredientId, currentStock: { $gte: required } },
      { $inc: { currentStock: -required } },
      { new: true, session }
    );
    if (!ingredient) continue;

    const unitCost = Number(ingredient.defaultPrice || 0);
    const totalCost = unitCost * required;

    transactions.push({
      ingredient: ingredient._id,
      delta: -required,
      unitCost,
      totalCost,
      reason: 'order',
      referenceOrder: orderId,
      createdBy: userId
    });
  }
  if (transactions.length !== ingredientIds.length) {
    throw new Error('Insufficient stock during order processing. Please retry.');
  }
  if (transactions.length > 0) {
    await StockTransaction.insertMany(transactions, { session });
  }
};

const applyInventoryDelta = async (oldItems, newItems, orderId, userId, session) => {
  ensureActiveSession(session);
  const { needs: oldNeeds } = await computeIngredientNeeds(oldItems);
  const { needs: newNeeds } = await computeIngredientNeeds(newItems);

  const ingredientIds = new Set([...Array.from(oldNeeds.keys()), ...Array.from(newNeeds.keys())]);
  const missing = [];

  const transactions = [];
  // Apply deltas
  // eslint-disable-next-line no-restricted-syntax
  for (const ingredientId of ingredientIds) {
    const prev = oldNeeds.get(ingredientId) || 0;
    const next = newNeeds.get(ingredientId) || 0;
    const delta = next - prev;
    if (delta === 0) continue;
    const query = delta > 0
      ? { _id: ingredientId, currentStock: { $gte: delta } }
      : { _id: ingredientId };
    const update = { $inc: { currentStock: -delta } };
    const ing = await Ingredient.findOneAndUpdate(query, update, { new: true, session });
    if (!ing) continue;

    const unitCost = Number(ing.defaultPrice || 0);
    const totalCost = unitCost * Math.abs(delta);

    transactions.push({
      ingredient: ing._id,
      delta: -delta,
      unitCost,
      totalCost,
      reason: 'order',
      referenceOrder: orderId,
      createdBy: userId
    });
  }
  const expectedChanges = Array.from(ingredientIds).filter((ingredientId) => {
    const prev = oldNeeds.get(ingredientId) || 0;
    const next = newNeeds.get(ingredientId) || 0;
    return next - prev !== 0;
  }).length;
  if (transactions.length !== expectedChanges) {
    const unresolvedIds = Array.from(ingredientIds).filter((ingredientId) => {
      const prev = oldNeeds.get(ingredientId) || 0;
      const next = newNeeds.get(ingredientId) || 0;
      return next - prev > 0;
    });
    if (unresolvedIds.length > 0) {
      const unresolvedIngredients = await Ingredient.find({ _id: { $in: unresolvedIds } }).session(session);
      unresolvedIngredients.forEach((ing) => {
        const prev = oldNeeds.get(ing._id.toString()) || 0;
        const next = newNeeds.get(ing._id.toString()) || 0;
        const delta = next - prev;
        if (delta > 0 && ing.currentStock < delta) {
          missing.push(`${ing.name} (need +${delta}${ing.unit}, have ${ing.currentStock}${ing.unit})`);
        }
      });
    }
    throw new Error(
      missing.length > 0
        ? `Insufficient stock: ${missing.join(', ')}`
        : 'Insufficient stock during order update. Please retry.'
    );
  }
  if (transactions.length > 0) {
    await StockTransaction.insertMany(transactions, { session });
  }
};

const listOrders = async (req, res) => {
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  if (req.query.status) {
    if (typeof req.query.status === 'string' && req.query.status.includes(',')) {
      filter.status = { $in: req.query.status.split(',') };
    } else {
      filter.status = req.query.status;
    }
  } else if (req.query.category) {
    if (req.query.category === 'active') {
      filter.status = { $in: ['pending', 'preparing', 'ready', 'served'] };
    } else if (req.query.category === 'kot') {
      filter.status = { $in: ['pending', 'preparing', 'ready', 'served'] };
      // Scope KOT view to orders created today only (kitchen board)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      filter.createdAt = { $gte: todayStart };
    } else if (req.query.category === 'paid') {
      filter.status = 'paid';
    } else if (req.query.category === 'cancelled') {
      filter.status = 'cancelled';
    } else if (req.query.category === 'all') {
      // No status filter for 'all'
    }
  }
  if (req.query.orderType) {
    filter.orderType = req.query.orderType;
  }
  if (req.query.dateFrom || req.query.dateTo) {
    filter.createdAt = {};
    if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo);
  }

  if (req.user.role === 'waiter' && req.query.scope !== 'all') {
    filter.$or = [{ createdBy: req.user._id }, { source: 'guest' }];
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 0, 0), 500);
  const paginate = req.query.paginate === '1' || Number.isFinite(Number(req.query.page)) || Number.isFinite(Number(req.query.limit));
  const skip = paginate && limit > 0 ? (page - 1) * limit : 0;

  const query = Order.find(filter)
    .populate('table')
    .populate('items.menuItem')
    .populate('createdBy', 'name email role')
    .populate('kitchenAssigned', 'name email role')
    .populate('assignedStaff', 'name email role')
    .populate('paidBy', 'name email role')
    .populate('editLogs.editedBy', 'name email role')
    .sort({ createdAt: -1 });

  if (paginate && limit > 0) {
    query.skip(skip).limit(limit);
  }

  const orders = await query;
  const total = paginate && limit > 0 ? await Order.countDocuments(filter) : orders.length;

  return res.json({
    success: true,
    data: orders,
    pagination: paginate && limit > 0 ? {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    } : null
  });
};

const getOrder = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) })
    .populate('table')
    .populate('items.menuItem')
    .populate('createdBy', 'name email role')
    .populate('kitchenAssigned', 'name email role')
    .populate('assignedStaff', 'name email role')
    .populate('paidBy', 'name email role');

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  return res.json(order);
};

const createOrder = async (req, res) => {
  let session;
  try {
    session = await Order.startSession();
    session.startTransaction();

    const { table, items, spiceLevel, specialInstructions } = req.body;
    let tableDoc = null;
    if (table) {
      tableDoc = await Table.findOne({ _id: table, ...(req.branchId ? { branchId: req.branchId } : {}) }).session(session);
      if (!tableDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Table not found' });
      }
      if (tableDoc.status === 'occupied') {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Table already occupied' });
      }
    }

    const { orderItems, totalAmount } = await buildOrderItems(items, req.branchId);
    await ensureInventoryAvailability(orderItems, session);
    const kotSeq = await nextSequence(`kot:${req.branchId}`);
    const [order] = await Order.create(
      [
        {
          table: table || undefined,
          customerId: req.body.customerId || undefined,
          staffId: req.body.staffId || undefined,
          items: orderItems,
          totalAmount,
          subTotal: totalAmount,
          taxableAmount: totalAmount,
          finalAmount: totalAmount,
          paymentStatus: 'unpaid',
          kotNo: `KOT-${kotSeq}`,
          orderType: req.body.orderType || (req.body.source === 'guest' ? 'online' : 'dine_in'),
          status: 'pending',
          branchId: req.branchId,
          createdBy: req.user._id,
          spiceLevel: spiceLevel || 'medium',
          specialInstructions,
          customerName: req.body.customerName,
          deliveryPlatform: req.body.deliveryPlatform,
          customerPhone: req.body.customerPhone,
          deliveryAddress: req.body.deliveryAddress,
          assignedRider: req.body.assignedRider || undefined
        }
      ],
      { session }
    );

    if (tableDoc) {
      tableDoc.status = 'occupied';
      await tableDoc.save({ session });
      emitTableUpdate(tableDoc);
    }

    await consumeInventory(orderItems, order._id, req.user?._id, session);

    await session.commitTransaction();
    session.endSession();

    const populated = await Order.findById(order._id)
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role')
      .populate('assignedStaff', 'name email role')
      .populate('paidBy', 'name email role')
      .populate('editLogs.editedBy', 'name email role');

    emitNewOrder(populated);
    const targetLabel = populated.table ? `table ${populated.table.tableNumber}` : `${populated.orderType} order`;
    const activityDesc = populated.table 
      ? `${populated.createdBy?.name || 'Staff'} created table order for Table ${populated.table.tableNumber}`
      : `${populated.createdBy?.name || 'Staff'} created ${populated.orderType} order for ${populated.customerName || 'Customer'}`;

    await notifyRole({
      role: 'kitchen',
      type: 'order:new',
      category: 'order',
      message: `New order for ${targetLabel}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    await notifyRole({
      role: 'admin',
      type: 'order:new',
      category: 'order',
      message: `${populated.createdBy?.name || 'Waiter'} booked ${targetLabel}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    await notifyRole({
      role: 'superadmin',
      type: 'order:new',
      category: 'order',
      message: `${populated.createdBy?.name || 'Waiter'} booked ${targetLabel}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    await notifyRole({
      role: 'waiter',
      type: 'order:new',
      category: 'order',
      message: `${populated.createdBy?.name || 'Waiter'} booked ${targetLabel}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    await notifyUser({
      role: 'waiter',
      userId: populated.createdBy?._id,
      type: 'order:new',
      category: 'order',
      message: `You placed an order for ${targetLabel}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    await logActivity({
      branchId: req.branchId,
      title: 'Order created',
      type: 'Order Created',
      description: activityDesc,
      performedBy: req.user?._id
    });
    return res.status(201).json(populated);
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (_) {
        /* ignore abort errors */
      }
    }
    return res.status(400).json({ message: 'Create order failed', error: error.message });
  }
};

const updateOrder = async (req, res) => {
  let session;
  try {
    session = await Order.startSession();
    session.startTransaction();

    const order = await Order.findOne({
      _id: req.params.id,
      ...(req.branchId ? { branchId: req.branchId } : {})
    }).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!isEditableOrderStatus(order.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Orders in status "${order.status}" cannot be edited` });
    }

    const changes = [];
    if (req.body.table) {
      const newTable = await Table.findOne({
        _id: req.body.table,
        ...(req.branchId ? { branchId: req.branchId } : {})
      }).session(session);
      if (!newTable) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Table not found' });
      }
      if (newTable.status === 'occupied' && order.table?.toString() !== newTable._id.toString()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Table already occupied' });
      }

      // Free previous table when moving
      if (order.table?.toString() !== newTable._id.toString()) {
        if (order.table) {
          await Table.findOneAndUpdate(
            { _id: order.table, ...(req.branchId ? { branchId: req.branchId } : {}) },
            { status: 'available' },
            { session }
          );
        }
        newTable.status = 'occupied';
        await newTable.save({ session });
      }

      order.table = newTable._id;
      changes.push('table updated');
    }

    if (req.body.items) {
      const existingItems = order.items.map((i) => ({
        menuItem: i.menuItem.toString(),
        quantity: i.quantity,
        priceAtOrderTime: i.priceAtOrderTime
      }));

      const requestedItems = req.body.items.map((i) => ({
        menuItem: i.menuItem.toString(),
        quantity: i.quantity,
        isComplimentary: Boolean(i.isComplimentary),
        variantId: i.variantId,
        itemNote: i.itemNote
      }));

      const existingMap = new Map(existingItems.map((i) => [i.menuItem, i]));
      const newIds = requestedItems.filter((i) => !existingMap.has(i.menuItem)).map((i) => i.menuItem);

      let menuMap = new Map();
      const allIds = Array.from(new Set(requestedItems.map((i) => i.menuItem)));
      const allMenus = await MenuItem.find({ _id: { $in: allIds }, ...(req.branchId ? { branchId: req.branchId } : {}) });
      const allMenuMap = new Map(allMenus.map((m) => [m._id.toString(), m]));
      if (newIds.length > 0) {
        const filter = { _id: { $in: newIds }, isAvailable: true };
        if (req.branchId) filter.branchId = req.branchId;
        const menuItems = await MenuItem.find(filter);
        if (menuItems.length !== newIds.length) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: 'Update order failed', error: 'One or more menu items are unavailable' });
        }
        menuMap = new Map(menuItems.map((item) => [item._id.toString(), item]));
      }

      const orderItems = requestedItems.map((item) => {
        const existing = existingMap.get(item.menuItem);
        const menuDoc = allMenuMap.get(item.menuItem);
        let variant = null;
        if (item.variantId) {
          if (menuDoc?.variants?.length) {
            variant = menuDoc.variants.find((v) => v._id.toString() === item.variantId.toString());
          }
          if (!variant && existing?.variantId?.toString() !== item.variantId.toString()) {
            throw new Error('Selected variant not found');
          }
        }
        const priceAtOrderTime = existing
          ? existing.priceAtOrderTime
          : variant?.price ?? menuMap.get(item.menuItem)?.price;
        return {
          menuItem: item.menuItem,
          quantity: item.quantity,
          priceAtOrderTime,
          isComplimentary: item.isComplimentary ?? existing?.isComplimentary ?? false,
          variantId: variant?._id || existing?.variantId,
          variantName: variant?.name || existing?.variantName,
          variantPrice: variant?.price || existing?.variantPrice,
          itemNote: item.itemNote ?? existing?.itemNote
        };
      });

      const totalAmount = orderItems.reduce(
        (sum, item) => sum + (item.isComplimentary ? 0 : item.quantity * (item.priceAtOrderTime || 0)),
        0
      );

      await applyInventoryDelta(existingItems, orderItems, order._id, req.user?._id, session);
      order.items = orderItems;
      order.totalAmount = totalAmount;
      const totals = computeOrderInvoiceTotals({
        subTotal: totalAmount,
        discountType: order.discountType,
        discountValue: order.discountValue,
        taxRate: order.taxRate,
        tipsAmount: order.tipsAmount,
        roundOff: order.roundOff
      });
      order.subTotal = totals.subTotal;
      order.discountAmount = totals.discountAmount;
      order.taxableAmount = totals.taxableAmount;
      order.taxAmount = totals.taxAmount;
      order.finalAmount = totals.grandTotal;
      
      changes.push('items updated');
    }

    if (req.body.assignedStaff !== undefined) {
      if (!req.body.assignedStaff) {
        order.assignedStaff = null;
      } else {
        const match = { userId: req.body.assignedStaff };
        if (req.branchId) match.branchId = req.branchId;
        const allowed = await UserBranchRole.findOne(match);
        if (!allowed) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: 'Invalid staff selection' });
        }
        order.assignedStaff = req.body.assignedStaff;
      }
      changes.push('assigned staff updated');
    }

    if (req.body.spiceLevel) {
      order.spiceLevel = req.body.spiceLevel;
      changes.push(`spice level -> ${req.body.spiceLevel}`);
    }

    if (req.body.specialInstructions !== undefined) {
      order.specialInstructions = req.body.specialInstructions;
      changes.push('instructions updated');
    }

    if (req.body.customerName !== undefined) {
      order.customerName = req.body.customerName;
      changes.push('customer updated');
    }

    if (req.body.status && req.user.role !== 'waiter') {
      if (req.body.status === 'paid') {
        return res.status(400).json({ message: 'Use billing to mark orders as paid' });
      }
      if (!isAllowedOrderStatusTransition(req.body.status)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Invalid order status transition' });
      }
      order.status = req.body.status;
      changes.push(`status -> ${req.body.status}`);
    }

    if (changes.length > 0) {
      order.editLogs.push({ editedBy: req.user._id, changes: changes.join(', ') });
    }

    await order.save({ session });

    if (order.status === 'cancelled' && order.table) {
      await Table.findOneAndUpdate(
        { _id: order.table, ...(req.branchId ? { branchId: req.branchId } : {}) },
        { status: 'available' },
        { session }
      );
    }

    const populated = await Order.findById(order._id)
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role')
      .populate('assignedStaff', 'name email role')
      .populate('paidBy', 'name email role');

    emitOrderUpdate(populated);
    await notifyRole({
      role: 'admin',
      type: 'order:update',
      category: 'order',
      message: `Order updated for table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    await notifyUser({
      role: 'waiter',
      userId: populated.createdBy?._id,
      type: 'order:update',
      category: 'order',
      message: `Order updated for table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    await logActivity({
      branchId: req.branchId,
      title: 'Order updated',
      type: 'Order Updated',
      description: `${req.user?.name || 'Staff'} updated order for Table ${populated.table?.tableNumber}`,
      performedBy: req.user?._id
    });
    await session.commitTransaction();
    session.endSession();

    return res.json(populated);
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (_) {
        /* ignore abort errors */
      }
    }
    return res.status(400).json({ message: 'Update order failed', error: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  let session;
  try {
    session = await Order.startSession();
    session.startTransaction();

    const order = await Order.findOne({
      _id: req.params.id,
      ...(req.branchId ? { branchId: req.branchId } : {})
    }).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!isEditableOrderStatus(order.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: `Orders in status "${order.status}" cannot be updated` });
    }

    if (req.user.role === 'kitchen' && !order.kitchenAssigned) {
      order.kitchenAssigned = req.user._id;
      order.kitchenAssignedAt = new Date();
    }

    if (req.body.status === 'paid') {
      return res.status(400).json({ message: 'Use billing to mark orders as paid' });
    }

    if (!isAllowedOrderStatusTransition(req.body.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Invalid order status transition' });
    }

    order.status = req.body.status;
    order.editLogs.push({ editedBy: req.user._id, changes: `status -> ${req.body.status}` });
    await order.save({ session });

    if (order.status === 'cancelled' && order.table) {
      await Table.findOneAndUpdate(
        { _id: order.table, ...(req.branchId ? { branchId: req.branchId } : {}) },
        { status: 'available' },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    const populated = await Order.findById(order._id)
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role')
      .populate('assignedStaff', 'name email role')
      .populate('paidBy', 'name email role');

    emitOrderUpdate(populated);
    await notifyRole({
      role: 'admin',
      type: 'order:status',
      category: 'order',
      message: `Kitchen set table ${populated.table?.tableNumber} to ${populated.status}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    await notifyUser({
      role: 'waiter',
      userId: populated.createdBy?._id,
      type: 'order:status',
      category: 'order',
      message: `Kitchen set table ${populated.table?.tableNumber} to ${populated.status}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    await logActivity({
      branchId: req.branchId,
      title: 'KOT status changed',
      type: 'Order KOT Status Updated',
      description: `${req.user?.name || 'Kitchen'} changed status of KOT for Table ${populated.table?.tableNumber} to ${populated.status}`,
      performedBy: req.user?._id
    });
    return res.json(populated);
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (_) {
        /* ignore abort errors */
      }
    }
    return res.status(400).json({ message: 'Update status failed', error: error.message });
  }
};

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  updateOrderStatus,
  buildOrderItems,
  ensureInventoryAvailability,
  consumeInventory
};
