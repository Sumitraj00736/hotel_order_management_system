const Notification = require('../../models/notifications/Notification');

const listNotifications = async (req, res) => {
  const { role, _id } = req.user;
  const {
    category,
    type,
    staffId,
    tableNumber,
    dishId,
    supplierId,
    customerId,
    stockItemId,
    dateFrom,
    dateTo
  } = req.query;

  const roleFilter = role === 'superadmin' ? ['admin'] : [role];
  const filter = { role: { $in: roleFilter } };
  if (req.branchId) filter.branchId = req.branchId;
  filter.$or = [{ userId: _id }, { userId: { $exists: false } }];

  if (category) filter.category = category;
  if (type) filter.type = type;
  if (staffId) filter.staffId = staffId;
  if (tableNumber) filter.tableNumber = Number(tableNumber);
  if (dishId) filter.dishId = dishId;
  if (supplierId) filter.supplierId = supplierId;
  if (customerId) filter.customerId = customerId;
  if (stockItemId) filter.stockItemId = stockItemId;

  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }

  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(200);
  return res.json(items);
};

const markRead = async (req, res) => {
  const { role, _id } = req.user;
  const roleFilter = role === 'superadmin' ? ['admin'] : [role];
  const notification = await Notification.findOne({
    _id: req.params.id,
    role: { $in: roleFilter },
    ...(req.branchId ? { branchId: req.branchId } : {}),
    $or: [{ userId: _id }, { userId: { $exists: false } }]
  });
  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }
  notification.read = true;
  await notification.save();
  return res.json({ message: 'Marked as read' });
};

const markAllRead = async (req, res) => {
  const { role, _id } = req.user;
  const roleFilter = role === 'superadmin' ? ['admin'] : [role];
  await Notification.updateMany(
    {
      role: { $in: roleFilter },
      ...(req.branchId ? { branchId: req.branchId } : {}),
      $or: [{ userId: _id }, { userId: { $exists: false } }]
    },
    { $set: { read: true } }
  );
  return res.json({ message: 'All notifications marked as read' });
};

module.exports = { listNotifications, markRead, markAllRead };
