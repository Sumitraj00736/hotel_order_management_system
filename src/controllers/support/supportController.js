const SupportFeedback = require('../../models/support/SupportFeedback');

const listFeedback = async (req, res) => {
  const items = await SupportFeedback.find({ branchId: req.branchId }).sort({ createdAt: -1 }).limit(50);
  return res.json(items);
};

const createFeedback = async (req, res) => {
  const { subject, message } = req.body;
  if (!message) return res.status(400).json({ message: 'Message required' });
  const entry = await SupportFeedback.create({
    branchId: req.branchId,
    userId: req.user?._id,
    subject,
    message
  });
  return res.status(201).json(entry);
};

module.exports = { listFeedback, createFeedback };
