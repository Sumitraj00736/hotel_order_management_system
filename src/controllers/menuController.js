const MenuItem = require('../models/MenuItem');

const listMenu = async (req, res) => {
  const { search, category, available } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (available !== undefined) filter.isAvailable = available === 'true';
  if (search) filter.name = { $regex: search, $options: 'i' };

  const items = await MenuItem.find(filter).sort({ name: 1 });
  return res.json(items);
};

const getMenuItem = async (req, res) => {
  const item = await MenuItem.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Menu item not found' });
  }
  return res.json(item);
};

const createMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.create(req.body);
    return res.status(201).json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Create menu item failed', error: error.message });
  }
};

const updateMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    return res.json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Update menu item failed', error: error.message });
  }
};

const deleteMenuItem = async (req, res) => {
  const item = await MenuItem.findByIdAndDelete(req.params.id);
  if (!item) {
    return res.status(404).json({ message: 'Menu item not found' });
  }
  return res.json({ message: 'Menu item deleted' });
};

module.exports = { listMenu, getMenuItem, createMenuItem, updateMenuItem, deleteMenuItem };
