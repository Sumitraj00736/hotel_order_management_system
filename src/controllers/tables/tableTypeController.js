const TableType = require('../../models/tables/TableType');

const listTableTypes = async (req, res) => {
  try {
    const filter = req.branchId ? { branchId: req.branchId } : {};
    if (req.query.active !== undefined) {
      filter.active = String(req.query.active) === 'true';
    }
    const rows = await TableType.find(filter).sort({ name: 1, createdAt: -1 });
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'List table types failed', error: error.message });
  }
};

const createTableType = async (req, res) => {
  try {
    const payload = {
      branchId: req.branchId,
      name: String(req.body.name || '').trim(),
      active: req.body.active !== undefined ? Boolean(req.body.active) : true,
      createdBy: req.user?._id
    };
    const row = await TableType.create(payload);
    return res.status(201).json(row);
  } catch (error) {
    if (String(error.message || '').includes('E11000')) {
      return res.status(409).json({ message: 'Table type already exists' });
    }
    return res.status(500).json({ message: 'Create table type failed', error: error.message });
  }
};

const updateTableType = async (req, res) => {
  try {
    const update = {
      name: req.body.name !== undefined ? String(req.body.name || '').trim() : undefined,
      active: req.body.active !== undefined ? Boolean(req.body.active) : undefined
    };
    const row = await TableType.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      { $set: update },
      { new: true }
    );
    if (!row) return res.status(404).json({ message: 'Table type not found' });
    return res.json(row);
  } catch (error) {
    if (String(error.message || '').includes('E11000')) {
      return res.status(409).json({ message: 'Table type already exists' });
    }
    return res.status(500).json({ message: 'Update table type failed', error: error.message });
  }
};

const deleteTableType = async (req, res) => {
  try {
    const row = await TableType.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
    if (!row) return res.status(404).json({ message: 'Table type not found' });
    return res.json({ message: 'Table type deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Delete table type failed', error: error.message });
  }
};

module.exports = { listTableTypes, createTableType, updateTableType, deleteTableType };

