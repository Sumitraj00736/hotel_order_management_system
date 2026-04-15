const Tax = require('../../models/finance/Tax');

const listTaxes = async (req, res) => {
  const taxes = await Tax.find({ branchId: req.branchId }).sort({ createdAt: -1 });
  return res.json(taxes);
};

const createTax = async (req, res) => {
  const { name, rate, status, notes } = req.body;
  if (!name || rate === undefined) {
    return res.status(400).json({ message: 'Tax name and rate are required' });
  }
  const tax = await Tax.create({
    branchId: req.branchId,
    name,
    rate: Number(rate),
    status: status || 'active',
    notes
  });
  return res.status(201).json(tax);
};

const updateTax = async (req, res) => {
  const tax = await Tax.findOneAndUpdate(
    { _id: req.params.id, branchId: req.branchId },
    { ...req.body },
    { new: true }
  );
  if (!tax) return res.status(404).json({ message: 'Tax not found' });
  return res.json(tax);
};

const deleteTax = async (req, res) => {
  const tax = await Tax.findOneAndDelete({ _id: req.params.id, branchId: req.branchId });
  if (!tax) return res.status(404).json({ message: 'Tax not found' });
  return res.json({ message: 'Tax deleted' });
};

module.exports = { listTaxes, createTax, updateTax, deleteTax };
