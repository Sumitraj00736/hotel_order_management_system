const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, unique: true, sparse: true },
    address: { type: String, trim: true },
    timezone: { type: String, default: 'UTC' },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    settings: {
      currency: { type: String, default: 'NPR' },
      taxRate: { type: Number, default: 0 }
    },
    websiteSettings: {
      delivery:     { type: Boolean, default: true },
      shareMenu:    { type: Boolean, default: true },
      showPhone:    { type: Boolean, default: true },
      address:      { type: String,  default: '' },
      bio:          { type: String,  default: '' },
      footer:       { type: String,  default: '' },
      logoUrl:      { type: String,  default: '' },
      colorPalette: { type: String,  default: 'light' },
      layout:       { type: String,  default: 'grid' },
      socialLinks:  [{ label: String, url: String }]
    },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Branch', branchSchema);
