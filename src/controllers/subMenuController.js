const SubMenu = require('../models/SubMenu');

const listSubMenus = async (req, res) => {
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  const items = await SubMenu.find(filter).sort({ name: 1 });
  return res.json(items);
};

const createSubMenu = async (req, res) => {
  try {
    const sm = await SubMenu.create({ ...req.body, branchId: req.branchId });
    return res.status(201).json(sm);
  } catch (error) {
    return res.status(400).json({ message: 'Create sub-menu failed', error: error.message });
  }
};

const updateSubMenu = async (req, res) => {
  try {
    const sm = await SubMenu.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      req.body,
      { new: true }
    );
    if (!sm) return res.status(404).json({ message: 'Sub-menu not found' });
    return res.json(sm);
  } catch (error) {
    return res.status(400).json({ message: 'Update sub-menu failed', error: error.message });
  }
};

const deleteSubMenu = async (req, res) => {
  const sm = await SubMenu.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!sm) return res.status(404).json({ message: 'Sub-menu not found' });
  return res.json({ message: 'Sub-menu deleted' });
};

module.exports = { listSubMenus, createSubMenu, updateSubMenu, deleteSubMenu };
