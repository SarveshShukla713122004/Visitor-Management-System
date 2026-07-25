import mongoose from 'mongoose';

const PURPOSE_ENUM = [
  'Vendor/Contractor Meeting',
  'Client Visit',
  'Interview',
  'Official/Government Visit',
  'Delivery',
  'Other',
];

const STATUS_ENUM = [
  'Pending',            // Submitted by Employee, awaiting HOD
  'HOD Approved',       // HOD approved, in Security queue
  'HOD Rejected',       // HOD rejected (rejectionReason required)
  'Checked-In',         // Security verified and checked in
  'Checked-Out',        // Visitor has left, record closed
  'Expired',            // Gate pass expired (end of day, no checkout)
  'Blacklist Flagged',  // Auto-flagged on reaching Security
];

const HistoryEntrySchema = new mongoose.Schema({
  action:          { type: String, required: true },
  performedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: { type: String },
  performedByRole: { type: String },
  note:            { type: String },
  timestamp:       { type: Date, default: Date.now },
}, { _id: false });

const VisitorRequestSchema = new mongoose.Schema({
  // ── Visitor Information ─────────────────────────────────────────
  visitorName:   { type: String, required: true, trim: true },
  company:       { type: String, trim: true },
  purpose:       { type: String, enum: PURPOSE_ENUM, required: true },
  phone:         { type: String, required: true, trim: true },  // 10-digit Indian mobile
  aadhaar:       { type: String, trim: true },                  // 12-digit, masked on read
  photoBase64:   { type: String },                              // base64 image (jpg/png, max 2MB)

  // ── Request Metadata ────────────────────────────────────────────
  department:    { type: String, required: true },
  submittedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  hodAssigned:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // HOD of that dept

  // ── Workflow Status ─────────────────────────────────────────────
  status:        { type: String, enum: STATUS_ENUM, default: 'Pending' },
  rejectionReason: { type: String },                            // HOD rejection reason (mandatory)

  // ── Gate Pass ───────────────────────────────────────────────────
  gatePassGenerated: { type: Boolean, default: false },
  gatePassId:        { type: String },                          // Unique pass reference
  gatePassExpiry:    { type: Date },                            // End of visit day

  // ── Blacklist ───────────────────────────────────────────────────
  blacklistFlag:    { type: Boolean, default: false },
  blacklistReason:  { type: String },

  // ── Request Type (multi-day contractor) ─────────────────────────
  requestType:   { type: String, enum: ['single-visit', 'multi-day-contractor'], default: 'single-visit' },
  visitDate:     { type: Date },     // For single-visit (defaults to today)
  startDate:     { type: Date },     // For multi-day
  endDate:       { type: Date },     // For multi-day

  // ── Security Actions ────────────────────────────────────────────
  checkInTime:   { type: Date },
  checkOutTime:  { type: Date },
  checkedInBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  checkedOutBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ── Audit Trail ─────────────────────────────────────────────────
  history:       [HistoryEntrySchema],
}, { timestamps: true });

// Indexes for fast lookups
VisitorRequestSchema.index({ submittedBy: 1, status: 1 });
VisitorRequestSchema.index({ department: 1, status: 1 });
VisitorRequestSchema.index({ status: 1, createdAt: -1 });
VisitorRequestSchema.index({ phone: 1 });
VisitorRequestSchema.index({ gatePassId: 1 });

export default mongoose.model('VisitorRequest', VisitorRequestSchema);
