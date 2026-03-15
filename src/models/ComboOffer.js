const mongoose = require('mongoose');

const comboItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    variant: { type: String },
    addOns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AddOn' }]
  },
  { _id: false }
);

const comboOfferSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    name: { type: String, required: true, trim: true },
    type: { type: String, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subMenu: { type: mongoose.Schema.Types.ObjectId, ref: 'SubMenu' },
    items: [comboItemSchema],
    priceActual: { type: Number, required: true, min: 0 },
    priceOffer: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
    hsCode: { type: String },
    prepTimeMinutes: { type: Number, default: 0 },
    description: { type: String },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ComboOffer', comboOfferSchema);
