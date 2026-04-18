const AddOn = require('../../models/menu/AddOn');
const { getCache, setCache, clearCachePrefix } = require('../../utils/performance/cache');

const listAddOns = async (req, res) => {
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  const cacheKey = `addons:${req.branchId || 'all'}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  const items = await AddOn.find(filter).sort({ name: 1 });
  setCache(cacheKey, items, 10 * 60 * 1000);
  return res.json(items);
};

const createAddOn = async (req, res) => {
  try {
    const item = await AddOn.create({ ...req.body, branchId: req.branchId });
    clearCachePrefix(`addons:${req.branchId || 'all'}`);
    return res.status(201).json(item);
  } catch (error) {
    return res.status(400).json({ message: 'Create add-on failed', error: error.message });
  }
};

const updateAddOn = async (req, res) => {
  try {
    const item = await AddOn.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      req.body,
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Add-on not found' });
    clearCachePrefix(`addons:${req.branchId || 'all'}`);
    return res.json(item);
  } catch (error) {
    return res.status(400).json({ message: 'Update add-on failed', error: error.message });
  }
};

const deleteAddOn = async (req, res) => {
  const item = await AddOn.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!item) return res.status(404).json({ message: 'Add-on not found' });
  clearCachePrefix(`addons:${req.branchId || 'all'}`);
  return res.json({ message: 'Add-on deleted' });
};

module.exports = { listAddOns, createAddOn, updateAddOn, deleteAddOn };
