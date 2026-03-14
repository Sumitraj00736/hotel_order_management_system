const mongoose = require('mongoose');

const recipeComponentSchema = new mongoose.Schema(
  {
    ingredient: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    quantity: { type: Number, required: true, min: 0 } // quantity per single menu item
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true, unique: true },
    ingredients: { type: [recipeComponentSchema], required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Recipe', recipeSchema);
