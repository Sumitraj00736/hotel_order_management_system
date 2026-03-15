const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const Ingredient = require('../models/Ingredient');
const Recipe = require('../models/Recipe');
const StockTransaction = require('../models/StockTransaction');
const { emitNewOrder, emitOrderUpdate, emitTableUpdate } = require('../utils/socket');
const { notifyRole, notifyUser } = require('../utils/notify');

const buildOrderItems = async (items) => {
  const menuIds = items.map((item) => item.menuItem);
  const menuItems = await MenuItem.find({ _id: { $in: menuIds }, isAvailable: true });
  if (menuItems.length !== menuIds.length) {
    throw new Error('One or more menu items are unavailable');
  }

  const menuMap = new Map(menuItems.map((item) => [item._id.toString(), item]));
  const orderItems = items.map((item) => {
    const menu = menuMap.get(item.menuItem);
    return {
      menuItem: menu._id,
      quantity: item.quantity,
      priceAtOrderTime: menu.price
    };
  });

  const totalAmount = orderItems.reduce((sum, item) => sum + item.quantity * item.priceAtOrderTime, 0);
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

const ensureInventoryAvailability = async (orderItems) => {
  const { needs } = await computeIngredientNeeds(orderItems);
  if (needs.size === 0) return; // no recipes configured
  const ingredients = await Ingredient.find({ _id: { $in: Array.from(needs.keys()) } });
  const missing = [];
  ingredients.forEach((ing) => {
    const required = needs.get(ing._id.toString()) || 0;
    if (ing.currentStock < required) {
      missing.push(`${ing.name} (need ${required}${ing.unit}, have ${ing.currentStock}${ing.unit})`);
    }
  });
  if (missing.length > 0) {
    throw new Error(`Insufficient stock: ${missing.join(', ')}`);
  }
};

const consumeInventory = async (orderItems, orderId, userId, session) => {
  const { needs } = await computeIngredientNeeds(orderItems);
  const ingredientIds = Array.from(needs.keys());
  if (ingredientIds.length === 0) return;

  const transactions = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const ingredientId of ingredientIds) {
    const required = needs.get(ingredientId) || 0;
    const ingredient = await Ingredient.findById(ingredientId).session(session);
    if (!ingredient) continue;
    ingredient.currentStock -= required;
    await ingredient.save({ session });
    transactions.push({
      ingredient: ingredient._id,
      delta: -required,
      reason: 'order',
      referenceOrder: orderId,
      createdBy: userId
    });
  }
  if (transactions.length > 0) {
    await StockTransaction.insertMany(transactions, { session });
  }
};

const applyInventoryDelta = async (oldItems, newItems, orderId, userId, session) => {
  const { needs: oldNeeds } = await computeIngredientNeeds(oldItems);
  const { needs: newNeeds } = await computeIngredientNeeds(newItems);

  const ingredientIds = new Set([...Array.from(oldNeeds.keys()), ...Array.from(newNeeds.keys())]);
  const missing = [];
  // First validate additional requirements
  // eslint-disable-next-line no-restricted-syntax
  for (const ingredientId of ingredientIds) {
    const prev = oldNeeds.get(ingredientId) || 0;
    const next = newNeeds.get(ingredientId) || 0;
    const delta = next - prev;
    if (delta > 0) {
      const ing = await Ingredient.findById(ingredientId);
      if (ing && ing.currentStock < delta) {
        missing.push(`${ing.name} (need +${delta}${ing.unit}, have ${ing.currentStock}${ing.unit})`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`Insufficient stock: ${missing.join(', ')}`);
  }

  const transactions = [];
  // Apply deltas
  // eslint-disable-next-line no-restricted-syntax
  for (const ingredientId of ingredientIds) {
    const prev = oldNeeds.get(ingredientId) || 0;
    const next = newNeeds.get(ingredientId) || 0;
    const delta = next - prev;
    if (delta === 0) continue;
    const ing = await Ingredient.findById(ingredientId).session(session);
    if (!ing) continue;
    ing.currentStock -= delta; // delta positive consumes, negative adds back
    await ing.save({ session });
    transactions.push({
      ingredient: ing._id,
      delta: -delta,
      reason: 'order',
      referenceOrder: orderId,
      createdBy: userId
    });
  }
  if (transactions.length > 0) {
    await StockTransaction.insertMany(transactions, { session });
  }
};

const listOrders = async (req, res) => {
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.user.role === 'waiter') {
    filter.$or = [{ createdBy: req.user._id }, { source: 'guest' }];
  }

  const orders = await Order.find(filter)
    .populate('table')
    .populate('items.menuItem')
    .populate('createdBy', 'name email role')
    .populate('kitchenAssigned', 'name email role')
    .populate('paidBy', 'name email role')
    .sort({ createdAt: -1 });

  return res.json(orders);
};

const getOrder = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) })
    .populate('table')
    .populate('items.menuItem')
    .populate('createdBy', 'name email role')
    .populate('kitchenAssigned', 'name email role')
    .populate('paidBy', 'name email role');

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  if (req.user.role === 'waiter' && order.createdBy._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  return res.json(order);
};

const createOrder = async (req, res) => {
  let session;
  try {
    session = await Order.startSession();
    session.startTransaction();

    const { table, items, spiceLevel, specialInstructions } = req.body;
    const tableDoc = await Table.findOne({ _id: table, ...(req.branchId ? { branchId: req.branchId } : {}) }).session(session);
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

    const { orderItems, totalAmount } = await buildOrderItems(items);
    await ensureInventoryAvailability(orderItems);
    const [order] = await Order.create(
      [
        {
          table,
          items: orderItems,
          totalAmount,
          status: 'pending',
          branchId: req.branchId,
          createdBy: req.user._id,
          spiceLevel: spiceLevel || 'medium',
          specialInstructions
        }
      ],
      { session }
    );

    tableDoc.status = 'occupied';
    await tableDoc.save({ session });
    emitTableUpdate(tableDoc);

    await consumeInventory(orderItems, order._id, req.user?._id, session);

    await session.commitTransaction();
    session.endSession();

    const populated = await Order.findById(order._id)
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role')
      .populate('paidBy', 'name email role');

    emitNewOrder(populated);
    await notifyRole({
      role: 'kitchen',
      type: 'order:new',
      message: `New order for table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    await notifyRole({
      role: 'admin',
      type: 'order:new',
      message: `${populated.createdBy?.name || 'Waiter'} booked table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    await notifyUser({
      role: 'waiter',
      userId: populated.createdBy?._id,
      type: 'order:new',
      message: `You placed an order for table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
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

    const order = await Order.findById(req.params.id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'paid') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Paid orders cannot be edited' });
    }

    if (req.user.role === 'waiter' && order.createdBy.toString() !== req.user._id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: 'Forbidden' });
    }

    const changes = [];
    if (req.body.table) {
      const newTable = await Table.findById(req.body.table).session(session);
      if (!newTable) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Table not found' });
      }
      if (newTable.status === 'occupied' && order.table.toString() !== newTable._id.toString()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Table already occupied' });
      }

      // Free previous table when moving
      if (order.table.toString() !== newTable._id.toString()) {
        await Table.findByIdAndUpdate(order.table, { status: 'available' }, { session });
        newTable.status = 'occupied';
        await newTable.save({ session });
      }

      order.table = newTable._id;
      changes.push('table updated');
    }

    if (req.body.items) {
      const existingItems = order.items.map((i) => ({
        menuItem: i.menuItem.toString(),
        quantity: i.quantity
      }));
      const { orderItems, totalAmount } = await buildOrderItems(req.body.items);
      await applyInventoryDelta(existingItems, orderItems, order._id, req.user?._id, session);
      order.items = orderItems;
      order.totalAmount = totalAmount;
      changes.push('items updated');
    }

    if (req.body.spiceLevel) {
      order.spiceLevel = req.body.spiceLevel;
      changes.push(`spice level -> ${req.body.spiceLevel}`);
    }

    if (req.body.specialInstructions !== undefined) {
      order.specialInstructions = req.body.specialInstructions;
      changes.push('instructions updated');
    }

    if (req.body.status && req.user.role !== 'waiter') {
      if (req.body.status === 'paid') {
        return res.status(400).json({ message: 'Use billing to mark orders as paid' });
      }
      order.status = req.body.status;
      changes.push(`status -> ${req.body.status}`);
    }

    if (changes.length > 0) {
      order.editLogs.push({ editedBy: req.user._id, changes: changes.join(', ') });
    }

    await order.save({ session });

    if (order.status === 'paid') {
      await Table.findByIdAndUpdate(order.table, { status: 'available' });
    }

    const populated = await Order.findById(order._id)
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role')
      .populate('paidBy', 'name email role');

    emitOrderUpdate(populated);
    await notifyRole({
      role: 'admin',
      type: 'order:update',
      message: `Order updated for table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    await notifyUser({
      role: 'waiter',
      userId: populated.createdBy?._id,
      type: 'order:update',
      message: `Order updated for table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
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

    const order = await Order.findById(req.params.id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'paid') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Paid orders cannot be updated' });
    }

    if (req.user.role === 'kitchen' && !order.kitchenAssigned) {
      order.kitchenAssigned = req.user._id;
      order.kitchenAssignedAt = new Date();
    }

    if (req.body.status === 'paid') {
      return res.status(400).json({ message: 'Use billing to mark orders as paid' });
    }

    order.status = req.body.status;
    order.editLogs.push({ editedBy: req.user._id, changes: `status -> ${req.body.status}` });
    await order.save({ session });

    if (order.status === 'paid') {
      await Table.findByIdAndUpdate(order.table, { status: 'available' }, { session });
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
      type: 'order:status',
      message: `Kitchen set table ${populated.table?.tableNumber} to ${populated.status}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    await notifyUser({
      role: 'waiter',
      userId: populated.createdBy?._id,
      type: 'order:status',
      message: `Kitchen set table ${populated.table?.tableNumber} to ${populated.status}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
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

module.exports = { listOrders, getOrder, createOrder, updateOrder, updateOrderStatus };
