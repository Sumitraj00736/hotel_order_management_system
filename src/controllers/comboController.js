const ComboOffer = require('../models/ComboOffer');

const listCombos = async (req, res) => {
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  const combos = await ComboOffer.find(filter).populate('category subMenu').sort({ createdAt: -1 });
  return res.json(combos);
};

const createCombo = async (req, res) => {
  try {
    const combo = await ComboOffer.create({ ...req.body, branchId: req.branchId });
    return res.status(201).json(combo);
  } catch (error) {
    return res.status(400).json({ message: 'Create combo failed', error: error.message });
  }
};

const updateCombo = async (req, res) => {
  try {
    const combo = await ComboOffer.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      req.body,
      { new: true }
    );
    if (!combo) return res.status(404).json({ message: 'Combo not found' });
    return res.json(combo);
  } catch (error) {
    return res.status(400).json({ message: 'Update combo failed', error: error.message });
  }
};

const deleteCombo = async (req, res) => {
  const combo = await ComboOffer.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!combo) return res.status(404).json({ message: 'Combo not found' });
  return res.json({ message: 'Combo deleted' });
};

module.exports = { listCombos, createCombo, updateCombo, deleteCombo };
