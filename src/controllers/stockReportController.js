const StockTransaction = require('../models/StockTransaction');
const Ingredient = require('../models/Ingredient');

const parseRange = (req) => {
  const now = new Date();
  const to = req.query.to ? new Date(req.query.to) : now;
  const from = req.query.from ? new Date(req.query.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
};

const stockReport = async (req, res) => {
  try {
    const { from, to } = parseRange(req);
    const top = Math.min(Number(req.query.top) || 10, 100);
    const limit = Math.min(Number(req.query.limit) || 200, 500);

    const baseMatch = { createdAt: { $gte: from, $lte: to } };

    const grouped = await StockTransaction.aggregate([
      { $match: { ...baseMatch } },
      {
        $group: {
          _id: '$ingredient',
          totalConsumed: {
            $sum: { $cond: [{ $lt: ['$delta', 0] }, { $abs: '$delta' }, 0] }
          },
          totalRestocked: {
            $sum: { $cond: [{ $gt: ['$delta', 0] }, '$delta', 0] }
          },
          lastRestock: {
            $max: { $cond: [{ $gt: ['$delta', 0] }, '$createdAt', null] }
          }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'ingredients',
          localField: '_id',
          foreignField: '_id',
          as: 'ingredient'
        }
      },
      { $unwind: { path: '$ingredient', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          ingredientId: '$_id',
          name: '$ingredient.name',
          unit: '$ingredient.unit',
          currentStock: '$ingredient.currentStock',
          reorderLevel: '$ingredient.reorderLevel',
          totalConsumed: 1,
          totalRestocked: 1,
          lastRestock: 1
        }
      }
    ]);

    const topConsumers = [...grouped]
      .sort((a, b) => (b.totalConsumed || 0) - (a.totalConsumed || 0))
      .slice(0, top);

    const lowStock = await Ingredient.find({ $expr: { $lte: ['$currentStock', '$reorderLevel'] } })
      .select('name unit currentStock reorderLevel')
      .limit(200)
      .lean();

    const restocks = await StockTransaction.find({
      ...baseMatch,
      delta: { $gt: 0 }
    })
      .populate('ingredient', 'name unit')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const summary = {
      totalIngredients: grouped.length,
      totalConsumedAll: grouped.reduce((s, g) => s + (g.totalConsumed || 0), 0)
    };

    return res.json({
      range: { from, to },
      summary,
      byIngredient: grouped,
      topConsumers,
      lowStock,
      restocks
    });
  } catch (error) {
    return res.status(500).json({ message: 'Stock report failed', error: error.message });
  }
};

module.exports = { stockReport };
