const MenuItem = require('../../models/menu/MenuItem');
const { getCache, setCache, clearCachePrefix } = require('../../utils/performance/cache');

const normalizeVariants = (variants = []) =>
  (Array.isArray(variants) ? variants : [])
    .map((variant) => {
      const name = String(variant?.name || '').trim();
      if (!name) return null;
      const actualPrice = Number(variant?.actualPrice ?? variant?.price ?? 0);
      const discount = Number(variant?.discount ?? 0);
      const listedPrice = Math.max(actualPrice - discount, 0);
      return {
        name,
        type: variant?.type || 'Other',
        actualPrice,
        discount,
        price: listedPrice
      };
    })
    .filter(Boolean);

const buildMenuPayload = (body, branchId, { isUpdate = false } = {}) => {
  const payload = { ...body, branchId };
  const hasVariantPayload = Object.prototype.hasOwnProperty.call(body, 'variants');
  const hasPricePayload = Object.prototype.hasOwnProperty.call(body, 'price');
  const hasMaxPricePayload = Object.prototype.hasOwnProperty.call(body, 'maxPrice');

  if (!isUpdate || hasVariantPayload) {
    const variants = normalizeVariants(body.variants);
    payload.variants = variants;

    if (variants.length > 0) {
      const variantPrices = variants.map((variant) => Number(variant.price) || 0);
      payload.price = Math.min(...variantPrices);
      payload.maxPrice = Math.max(...variantPrices);
      return payload;
    }
  }

  if (!isUpdate || hasPricePayload) {
    payload.price = Number(body.price) || 0;
  }

  if (!isUpdate || hasMaxPricePayload) {
    const nextMax = Number(body.maxPrice) || 0;
    payload.maxPrice = nextMax > (Number(payload.price) || 0) ? nextMax : undefined;
  }
  return payload;
};

const listMenu = async (req, res) => {
  const { search, category, available } = req.query;
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  if (category) filter.category = category;
  if (available !== undefined) filter.isAvailable = available === 'true';
  if (search) filter.name = { $regex: search, $options: 'i' };

  const cacheKey = `menus_v2:${req.branchId || 'all'}:${category || 'all'}:${available ?? 'all'}:${search || ''}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const items = await MenuItem.find(filter)
    .populate('category', 'name')
    .populate('subMenu', 'name')
    .sort({ name: 1 });
  setCache(cacheKey, items, 10 * 60 * 1000);
  return res.json(items);
};

const getMenuItem = async (req, res) => {
  const item = await MenuItem.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) })
    .populate('category', 'name')
    .populate('subMenu', 'name');
  if (!item) {
    return res.status(404).json({ message: 'Menu item not found' });
  }
  return res.json(item);
};

const createMenuItem = async (req, res) => {
  try {
    const payload = buildMenuPayload(req.body, req.branchId);
    const item = await MenuItem.create(payload);
    // listMenu uses `menus_v2:*` cache keys; clear the matching prefix so edits reflect immediately.
    clearCachePrefix(`menus_v2:${req.branchId || 'all'}:`);
    // Backward-compat (older cache key prefixes, if any)
    clearCachePrefix(`menus:${req.branchId || 'all'}:`);
    return res.status(201).json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Create menu item failed', error: error.message });
  }
};

const updateMenuItem = async (req, res) => {
  try {
    const payload = buildMenuPayload(req.body, req.branchId, { isUpdate: true });
    const item = await MenuItem.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      payload,
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    clearCachePrefix(`menus_v2:${req.branchId || 'all'}:`);
    clearCachePrefix(`menus:${req.branchId || 'all'}:`);
    return res.json(item);
  } catch (error) {
    return res.status(500).json({ message: 'Update menu item failed', error: error.message });
  }
};

const deleteMenuItem = async (req, res) => {
  const item = await MenuItem.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!item) {
    return res.status(404).json({ message: 'Menu item not found' });
  }
  clearCachePrefix(`menus_v2:${req.branchId || 'all'}:`);
  clearCachePrefix(`menus:${req.branchId || 'all'}:`);
  return res.json({ message: 'Menu item deleted' });
};

module.exports = { listMenu, getMenuItem, createMenuItem, updateMenuItem, deleteMenuItem };
