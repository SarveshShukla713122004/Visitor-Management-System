import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, select: false },
  role:         { type: String, enum: ['Admin', 'Employee', 'HOD', 'Security'], required: true },
  department:   { type: String, trim: true },          // Required for Employee and HOD
  phone:        { type: String, trim: true },
  employeeId:   { type: String, trim: true },
  active:       { type: Boolean, default: true },      // Admin can deactivate accounts
  // HOD-specific: another HOD who acts as delegate when on leave
  delegateHOD:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  avatarColor:  { type: String, default: '#1a3a5f' },
  // Security: Account lockout for brute-force protection
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil:           { type: Date, default: null },
}, { timestamps: true });

// Check if account is currently locked due to failed login attempts
UserSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment failed login attempts; lock for 15 mins if >= 5 attempts
UserSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { failedLoginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }
  const updates = { $inc: { failedLoginAttempts: 1 } };
  if (this.failedLoginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + 15 * 60 * 1000) }; // 15 mins lockout
  }
  return this.updateOne(updates);
};

// Reset failed login attempts on successful login
UserSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $set: { failedLoginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

export default mongoose.model('User', UserSchema);
