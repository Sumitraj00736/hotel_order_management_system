const Table = require('../models/Table');
const Branch = require('../models/Branch');
const Organization = require('../models/Organization');

const buildQrUrl = ({ baseUrl, tableId, branchId, orgSlug }) => {
  const base = baseUrl.replace(/\/$/, '');
  const params = new URLSearchParams();
  if (branchId) params.set('branchId', branchId);
  // New URL: /:orgSlug/table/:tableId — branded landing page with table context
  if (orgSlug) {
    return `${base}/${orgSlug}/table/${tableId}?${params.toString()}`;
  }
  // Fallback if no slug: legacy guest route
  return `${base}/guest/${tableId}?${params.toString()}`;
};

const listQrCodes = async (req, res) => {
  const branchId = req.branchId;
  if (!branchId) return res.status(400).json({ message: 'Branch required' });
  const [tables, branch] = await Promise.all([
    Table.find({ branchId }).sort({ tableNumber: 1 }),
    Branch.findById(branchId)
  ]);
  const org = branch?.orgId ? await Organization.findById(branch.orgId) : null;
  const baseUrl = process.env.PUBLIC_WEB_URL || 'https://hoteloms.netlify.app';
  const orgSlug = org?.slug || null;
  const items = tables.map((t) => ({
    tableId: t._id,
    tableNumber: t.tableNumber,
    name: t.name,
    type: t.type,
    spaceId: t.spaceId,
    url: buildQrUrl({ baseUrl, tableId: t._id, branchId, orgSlug })
  }));
  return res.json({ branchId, orgSlug, baseUrl, items });
};

module.exports = { listQrCodes };
