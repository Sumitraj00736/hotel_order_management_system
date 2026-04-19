const mongoose = require('mongoose');

/**
 * Optional explicit open → close window for a business day (for duration analytics).
 * If unused, duration can be inferred from consecutive DaybookClose rows.
 */
const daybookSessionSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    day: { type: Date, required: true, index: true },
    openedAt: { type: Date, default: Date.now },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    daybookCloseId: { type: mongoose.Schema.Types.ObjectId, ref: 'DaybookClose' },
    remarks: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

daybookSessionSchema.index({ branchId: 1, day: 1 });

module.exports = mongoose.model('DaybookSession', daybookSessionSchema);
