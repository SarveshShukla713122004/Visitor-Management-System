import mongoose from 'mongoose';

const BlacklistSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  phone:      { type: String, trim: true },
  aadhaar:    { type: String, trim: true },   // 12-digit Aadhaar number
  idNumber:   { type: String, trim: true },   // Other ID (PAN/Passport)
  reason:     { type: String, required: true },
  severity:   { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  addedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive:   { type: Boolean, default: true },
}, { timestamps: true });

BlacklistSchema.index({ phone: 1 });
BlacklistSchema.index({ aadhaar: 1 });
BlacklistSchema.index({ idNumber: 1 });
BlacklistSchema.index({ name: 'text' });

export default mongoose.model('Blacklist', BlacklistSchema);
