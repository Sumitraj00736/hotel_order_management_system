const Branch = require('../../models/core/Branch');
const BranchSettings = require('../../models/settings/BranchSettings');
const Organization = require('../../models/core/Organization');

const ensureSettings = async (branchId) => {
  let settings = await BranchSettings.findOne({ branchId });
  const branch = await Branch.findById(branchId).lean();
  const organization = branch?.orgId ? await Organization.findById(branch.orgId).lean() : null;
  if (!settings) {
    settings = await BranchSettings.create({
      branchId,
      restaurant: {
        name: organization?.name || branch?.name || '',
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
  return { settings, branch, organization };
};

const getRestaurantDetails = async (req, res) => {
  const { settings, organization } = await ensureSettings(req.branchId);
  return res.json({
    ...(settings.restaurant || {}),
    name: organization?.name || settings.restaurant?.name || ''
  });
};

const updateRestaurantDetails = async (req, res) => {
  const { settings, branch } = await ensureSettings(req.branchId);
  const payload = req.body || {};
  settings.restaurant = {
    ...(settings.restaurant ? settings.restaurant.toObject() : {}),
    ...payload
  };
  await settings.save();

  if (payload.name) {
    await Organization.findByIdAndUpdate(branch?.orgId, { name: payload.name });
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
  const { settings } = await ensureSettings(req.branchId);
  return res.json(settings.tax || {});
};

const updateTaxSettings = async (req, res) => {
  const { settings } = await ensureSettings(req.branchId);
  settings.tax = {
    ...(settings.tax ? settings.tax.toObject() : {}),
    ...req.body
  };
  await settings.save();
  return res.json(settings.tax);
};

const getNotificationSettings = async (req, res) => {
  const { settings } = await ensureSettings(req.branchId);
  return res.json(settings.notifications || {});
};

const updateNotificationSettings = async (req, res) => {
  const { settings } = await ensureSettings(req.branchId);
  settings.notifications = {
    ...(settings.notifications ? settings.notifications.toObject() : {}),
    ...req.body
  };
  await settings.save();
  return res.json(settings.notifications);
};

const getInvoiceSettings = async (req, res) => {
  const { settings } = await ensureSettings(req.branchId);
  return res.json(settings.invoice || {});
};

const updateInvoiceSettings = async (req, res) => {
  const { settings } = await ensureSettings(req.branchId);
  settings.invoice = {
    ...(settings.invoice ? settings.invoice.toObject() : {}),
    ...req.body
  };
  await settings.save();
  return res.json(settings.invoice);
};

const getKotSettings = async (req, res) => {
  const { settings } = await ensureSettings(req.branchId);
  return res.json(settings.kot || {});
};

const updateKotSettings = async (req, res) => {
  const { settings } = await ensureSettings(req.branchId);
  settings.kot = {
    ...(settings.kot ? settings.kot.toObject() : {}),
    ...req.body
  };
  await settings.save();
  return res.json(settings.kot);
};

const getPrinterSettings = async (req, res) => {
  const { settings } = await ensureSettings(req.branchId);
  return res.json(settings.printer || {});
};

const updatePrinterSettings = async (req, res) => {
  const { settings } = await ensureSettings(req.branchId);
  settings.printer = {
    ...(settings.printer ? settings.printer.toObject() : {}),
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