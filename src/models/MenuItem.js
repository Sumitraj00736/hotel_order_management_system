const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    subMenu: { type: mongoose.Schema.Types.ObjectId, ref: 'SubMenu' },
    type: { type: String, enum: ['Veg', 'Non-Veg', 'Vegan', 'Other'], default: 'Veg' },
    kotType: { type: String, trim: true },
    hsCode: { type: String, trim: true },
    preparationTimeMinutes: { type: Number, default: 0 },
    price: { type: Number, required: true, min: 0 },
    maxPrice: { type: Number, min: 0 },
    isAvailable: { type: Boolean, default: true },
    imageUrl: { type: String, trim: true },
    description: { type: String },
    addOns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AddOn' }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('MenuItem', menuItemSchema);
