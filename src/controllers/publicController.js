const Organization = require('../models/Organization');
const Branch = require('../models/Branch');
const { slugify } = require('../utils/slugify');

// ── Public: find cafe by slug ─────────────────────────────────────────────────
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
    if (!org) return res.status(404).json({ message: 'Cafe not found' });

    const branch = await Branch.findOne({ orgId: org._id, active: true }).lean();
    const ws = branch?.websiteSettings || {};

    return res.json({
      id: org._id,
      name: org.name,
      slug: org.slug,
      branch: branch ? { id: branch._id, name: branch.branchName || branch.name } : null,
      websiteSettings: {
        delivery:     ws.delivery     ?? true,
        shareMenu:    ws.shareMenu    ?? true,
        showPhone:    ws.showPhone    ?? true,
        address:      ws.address      || '',
        bio:          ws.bio          || '',
        footer:       ws.footer       || '',
        logoUrl:      ws.logoUrl      || '',
        colorPalette: ws.colorPalette || 'light',
        layout:       ws.layout       || 'grid',
        socialLinks:  ws.socialLinks  || []
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load cafe', error: error.message });
  }
};

// ── Authenticated: GET website settings for current branch ───────────────────
const getWebsiteSettings = async (req, res) => {
  try {
    const branch = await Branch.findById(req.branchId).lean();
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    const ws = branch.websiteSettings || {};
    return res.json({
      delivery:     ws.delivery     ?? true,
      shareMenu:    ws.shareMenu    ?? true,
      showPhone:    ws.showPhone    ?? true,
      address:      ws.address      || '',
      bio:          ws.bio          || '',
      footer:       ws.footer       || '',
      logoUrl:      ws.logoUrl      || '',
      colorPalette: ws.colorPalette || 'light',
      layout:       ws.layout       || 'grid',
      socialLinks:  ws.socialLinks  || []
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load settings', error: error.message });
  }
};

// ── Authenticated: PUT website settings for current branch ───────────────────
const saveWebsiteSettings = async (req, res) => {
  try {
    const allowed = ['delivery', 'shareMenu', 'showPhone', 'address', 'bio', 'footer', 'logoUrl', 'colorPalette', 'layout', 'socialLinks'];
    const update = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) update[`websiteSettings.${key}`] = req.body[key];
    });
    const branch = await Branch.findByIdAndUpdate(
      req.branchId,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    return res.json({ message: 'Saved', websiteSettings: branch.websiteSettings });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to save settings', error: error.message });
  }
};

module.exports = { getCafeBySlug, getWebsiteSettings, saveWebsiteSettings };
