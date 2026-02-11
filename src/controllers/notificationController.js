const Notification = require('../models/Notification');

const listNotifications = async (req, res) => {
  const { role, _id } = req.user;
  const filter = { role };
  filter.$or = [{ userId: _id }, { userId: { $exists: false } }];

  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
  return res.json(items);
};

const markRead = async (req, res) => {
  const { role, _id } = req.user;
  const notification = await Notification.findOne({ _id: req.params.id, role, $or: [{ userId: _id }, { userId: { $exists: false } }] });
  if (!notification) {
    return res.status(404).json({ message: 'Notification not found' });
  }
  notification.read = true;
  await notification.save();
  return res.json({ message: 'Marked as read' });
};

const markAllRead = async (req, res) => {
  const { role, _id } = req.user;
  await Notification.updateMany(
    { role, $or: [{ userId: _id }, { userId: { $exists: false } }] },
    { $set: { read: true } }
  );
  return res.json({ message: 'All notifications marked as read' });
};

module.exports = { listNotifications, markRead, markAllRead };
