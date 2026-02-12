const User = require('../models/User');

const addPromotion = async (req, res) => {
  const { title, amount, effectiveDate, note } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.promotions = user.promotions || [];
  user.promotions.push({ title, amount, effectiveDate, note });
  if (amount !== undefined && amount !== null) {
    user.salary = (user.salary || 0) + Number(amount);
  }
  await user.save();

  return res.json({ message: 'Promotion added', promotions: user.promotions });
};

const listPromotions = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(user.promotions || []);
};

module.exports = { addPromotion, listPromotions };
