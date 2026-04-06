const Category = require('../models/Category');
const { getCache, setCache, clearCachePrefix } = require('../utils/cache');

const listCategories = async (req, res) => {
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  const cacheKey = `categories:${req.branchId || 'all'}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  const categories = await Category.find(filter).sort({ name: 1 });
  setCache(cacheKey, categories, 10 * 60 * 1000);
  return res.json(categories);
};

const createCategory = async (req, res) => {
  try {
    const cat = await Category.create({ ...req.body, branchId: req.branchId });
    clearCachePrefix(`categories:${req.branchId || 'all'}`);
    return res.status(201).json(cat);
  } catch (error) {
    return res.status(400).json({ message: 'Create category failed', error: error.message });
  }
};

const updateCategory = async (req, res) => {
  try {
    const cat = await Category.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      req.body,
      { new: true }
    );
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    clearCachePrefix(`categories:${req.branchId || 'all'}`);
    return res.json(cat);
  } catch (error) {
    return res.status(400).json({ message: 'Update category failed', error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  const cat = await Category.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!cat) return res.status(404).json({ message: 'Category not found' });
  clearCachePrefix(`categories:${req.branchId || 'all'}`);
  return res.json({ message: 'Category deleted' });
};

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
