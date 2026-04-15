const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Veg', 'Non-Veg', 'Vegan', 'Other'], default: 'Other' },
    name: { type: String, trim: true, required: true },
    actualPrice: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0 }
  },
  { _id: true }
);

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
    variants: { type: [variantSchema], default: [] },
    isAvailable: { type: Boolean, default: true },
    imageUrl: { type: String, trim: true },
    description: { type: String },
    addOns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AddOn' }]
  },
  { timestamps: true }
);

menuItemSchema.index({ branchId: 1, name: 1 });
menuItemSchema.index({ branchId: 1, category: 1 });
menuItemSchema.index({ branchId: 1, subMenu: 1 });
menuItemSchema.index({ branchId: 1, isAvailable: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
