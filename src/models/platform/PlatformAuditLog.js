const mongoose = require('mongoose');

const platformAuditLogSchema = new mongoose.Schema(
  {
    admin_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformAdmin', required: true },
    action: { type: String, required: true },
    entity_type: { type: String, required: true },
    entity_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    old_value: { type: mongoose.Schema.Types.Mixed },
    new_value: { type: mongoose.Schema.Types.Mixed },
    ip_address: { type: String },
    user_agent: { type: String }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } } // Append-only log
);

module.exports = mongoose.model('PlatformAuditLog', platformAuditLogSchema);
