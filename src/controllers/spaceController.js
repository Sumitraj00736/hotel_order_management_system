const Space = require('../models/Space');

const listSpaces = async (req, res) => {
  const filter = req.branchId ? { branchId: req.branchId } : {};
  const spaces = await Space.find(filter).sort({ name: 1 });
  return res.json(spaces);
};

const createSpace = async (req, res) => {
  try {
    const payload = { ...req.body, branchId: req.branchId };
    const space = await Space.create(payload);
    return res.status(201).json(space);
  } catch (error) {
    return res.status(500).json({ message: 'Create space failed', error: error.message });
  }
};

const updateSpace = async (req, res) => {
  try {
    const space = await Space.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      req.body,
      { new: true }
    );
    if (!space) return res.status(404).json({ message: 'Space not found' });
    return res.json(space);
  } catch (error) {
    return res.status(500).json({ message: 'Update space failed', error: error.message });
  }
};

const deleteSpace = async (req, res) => {
  const space = await Space.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!space) return res.status(404).json({ message: 'Space not found' });
  return res.json({ message: 'Space deleted' });
};

module.exports = { listSpaces, createSpace, updateSpace, deleteSpace };
