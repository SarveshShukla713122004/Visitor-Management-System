import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  recipient:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:           { type: String },  // 'new_request' | 'hod_approved' | 'hod_rejected' | 'checked_in' | 'blacklist_flag'
  title:          { type: String, required: true },
  body:           { type: String },
  relatedRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'VisitorRequest' },
  read:           { type: Boolean, default: false },
  priority:       { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
}, { timestamps: true });

NotificationSchema.index({ recipient: 1, read: 1 });

export default mongoose.model('Notification', NotificationSchema);
