const Customer = require('../models/Customer');
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
      tax: { priceRelation: 'inclusive' },
      notifications: { newOrderSound: 'default' },
      customerRewards: { salesAmount: 0, rewardPoints: 0 }
    });
  }
  if (!settings.customerRewards) {
    settings.customerRewards = { salesAmount: 0, rewardPoints: 0 };
    await settings.save();
  }
  return settings;
};

const listCustomers = async (req, res) => {
  const filter = { branchId: req.branchId };
  if (req.query.search) {
    const q = req.query.search.trim();
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { email: new RegExp(q, 'i') },
      { phone: new RegExp(q, 'i') }
    ];
  }
  const customers = await Customer.find(filter).sort({ createdAt: -1 });
  return res.json(customers);
};

const createCustomer = async (req, res) => {
  const payload = req.body || {};
  const normalizedEmail = payload.email ? String(payload.email).toLowerCase() : undefined;
  const normalizedPhone = payload.phone ? String(payload.phone).trim() : undefined;
  if (normalizedEmail) {
    const exists = await Customer.findOne({ branchId: req.branchId, email: normalizedEmail });
    if (exists) return res.status(409).json({ message: 'Email already in use' });
  }
  if (normalizedPhone) {
    const exists = await Customer.findOne({ branchId: req.branchId, phone: normalizedPhone });
    if (exists) return res.status(409).json({ message: 'Phone already in use' });
  }

  const customer = await Customer.create({
    branchId: req.branchId,
    name: payload.name,
    email: normalizedEmail,
    phone: normalizedPhone,
    dob: payload.dob,
    loyaltyDiscount: payload.loyaltyDiscount || 0,
    openingBalanceType: payload.openingBalanceType || 'dr',
    openingAmount: payload.openingAmount || 0,
    legalName: payload.legalName,
    taxNumber: payload.taxNumber,
    creditLimit: payload.creditLimit || 0,
    creditTermDays: payload.creditTermDays || 0,
    address: payload.address,
    createdBy: req.user?._id
  });
  return res.status(201).json(customer);
};

const updateCustomer = async (req, res) => {
  const payload = req.body || {};
  if (payload.email) payload.email = String(payload.email).toLowerCase();
  if (payload.phone) payload.phone = String(payload.phone).trim();
  const customer = await Customer.findOneAndUpdate(
    { _id: req.params.id, branchId: req.branchId },
    payload,
    { new: true }
  );
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  return res.json(customer);
};

const deleteCustomer = async (req, res) => {
  const customer = await Customer.findOneAndDelete({ _id: req.params.id, branchId: req.branchId });
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  return res.json({ message: 'Customer deleted' });
};

const getRewardsSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  return res.json(settings.customerRewards || { salesAmount: 0, rewardPoints: 0 });
};

const updateRewardsSettings = async (req, res) => {
  const settings = await ensureSettings(req.branchId);
  const payload = req.body || {};
  settings.customerRewards = {
    ...settings.customerRewards?.toObject?.(),
    ...payload
  };
  await settings.save();
  return res.json(settings.customerRewards);
};

module.exports = {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getRewardsSettings,
  updateRewardsSettings
};
