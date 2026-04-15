const Department = require('../../models/users/Department');

const listDepartments = async (req, res) => {
  const departments = await Department.find({ branchId: req.branchId }).sort({ createdAt: 1 });
  return res.json(departments);
};

const createDepartment = async (req, res) => {
  const { name, description, active } = req.body;
  if (!name) return res.status(400).json({ message: 'Department name required' });
  const department = await Department.create({
    branchId: req.branchId,
    name,
    description,
    active: active !== undefined ? active : true
  });
  return res.status(201).json(department);
};

const updateDepartment = async (req, res) => {
  const department = await Department.findOneAndUpdate(
    { _id: req.params.id, branchId: req.branchId },
    { ...req.body },
    { new: true }
  );
  if (!department) return res.status(404).json({ message: 'Department not found' });
  return res.json(department);
};

const deleteDepartment = async (req, res) => {
  const department = await Department.findOneAndDelete({ _id: req.params.id, branchId: req.branchId });
  if (!department) return res.status(404).json({ message: 'Department not found' });
  return res.json({ message: 'Department deleted' });
};

module.exports = { listDepartments, createDepartment, updateDepartment, deleteDepartment };
