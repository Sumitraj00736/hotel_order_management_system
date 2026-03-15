const Organization = require('../models/Organization');
const Branch = require('../models/Branch');
const { slugify } = require('../utils/slugify');

const getCafeBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    let org = await Organization.findOne({ slug, active: true }).lean();
    if (!org) {
      const candidates = await Organization.find({ slug: { $in: [null, ''] }, active: true }).lean();
      const fallback = candidates.find((item) => slugify(item.name) === slug);
      if (fallback) {
        await Organization.updateOne({ _id: fallback._id }, { slug });
        org = { ...fallback, slug };
      }
    }
    if (!org) {
      return res.status(404).json({ message: 'Cafe not found' });
    }

    const branch = await Branch.findOne({ orgId: org._id, active: true }).lean();

    return res.json({
      id: org._id,
      name: org.name,
      slug: org.slug,
      branch: branch
        ? {
            id: branch._id,
            name: branch.name
          }
        : null
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load cafe', error: error.message });
  }
};

module.exports = { getCafeBySlug };
