import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  actor:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorName:     { type: String },
  actorRole:     { type: String },
  action:        { type: String, required: true },
  targetType:    { type: String },   // 'Pass' | 'Visitor' | 'User' | 'Zone' | 'Blacklist'
  targetId:      { type: mongoose.Schema.Types.ObjectId },
  details:       { type: mongoose.Schema.Types.Mixed },
  isOverride:    { type: Boolean, default: false },
  overrideReason:{ type: String },
  ipAddress:     { type: String },
  userAgent:     { type: String },     // Browser/client identifier for forensics
  timestamp:     { type: Date, default: Date.now },
}, { timestamps: false });

AuditLogSchema.index({ actor: 1, timestamp: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });
AuditLogSchema.index({ isOverride: 1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });   // Fast security event queries

export default mongoose.model('AuditLog', AuditLogSchema);
