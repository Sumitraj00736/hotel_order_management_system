const Branch = require('../models/Branch');
const BranchSettings = require('../models/BranchSettings');

const ensureSettings = async (branchId) => {
  let settings = await BranchSettings.findOne({ branchId });
  if (!settings) {
    const branch = await Branch.findById(branchId).lean();
    settings = await BranchSettings.create({
      branchId,
      restaurant: {
        name: branch?.name || '',
        address: branch?.address || '',
        currency: branch?.settings?.currency || 'NPR',
        priceField: branch?.settings?.currency || 'NPR'
      },
      tax: {
        priceRelation: 'inclusive'
      },
      notifications: {
        newOrderSound: 'default'
      }
    });
  }
  return settings;
};

const getRestaurantDetails = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  return res.json(settings.restaurant || {});
};

const updateRestaurantDetails = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  const payload = req.body || {};
  settings.restaurant = {
    ...settings.restaurant.toObject(),
    ...payload
  };
  await settings.save();

  if (payload.name) {
    await Branch.findByIdAndUpdate(req.branchId, { name: payload.name });
  }
  if (payload.address) {
    await Branch.findByIdAndUpdate(req.branchId, { address: payload.address });
  }
  if (payload.currency || payload.priceField) {
    await Branch.findByIdAndUpdate(req.branchId, {
      'settings.currency': payload.currency || payload.priceField || settings.restaurant.currency,
      'settings.taxRate': payload.taxRate || 0
    });
  }

  return res.json(settings.restaurant);
};

const getTaxSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  return res.json(settings.tax || {});
};

const updateTaxSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  settings.tax = {
    ...settings.tax.toObject(),
    ...req.body
  };
  await settings.save();
  return res.json(settings.tax);
};

const getNotificationSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  return res.json(settings.notifications || {});
};

const updateNotificationSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  settings.notifications = {
    ...settings.notifications.toObject(),
    ...req.body
  };
  await settings.save();
  return res.json(settings.notifications);
};

const getInvoiceSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  return res.json(settings.invoice || {});
};

const updateInvoiceSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  settings.invoice = {
    ...settings.invoice.toObject(),
    ...req.body
  };
  await settings.save();
  return res.json(settings.invoice);
};

const getKotSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  return res.json(settings.kot || {});
};

const updateKotSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  settings.kot = {
    ...settings.kot.toObject(),
    ...req.body
  };
  await settings.save();
  return res.json(settings.kot);
};

const getPrinterSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  return res.json(settings.printer || {});
};

const updatePrinterSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  settings.printer = {
    ...settings.printer.toObject(),
    ...req.body
  };
  await settings.save();
  return res.json(settings.printer);
};

module.exports = {
  getRestaurantDetails,
  updateRestaurantDetails,
  getTaxSettings,
  updateTaxSettings,
  getNotificationSettings,
  updateNotificationSettings,
  getInvoiceSettings,
  updateInvoiceSettings,
  getKotSettings,
  updateKotSettings,
  getPrinterSettings,
  updatePrinterSettings
};
