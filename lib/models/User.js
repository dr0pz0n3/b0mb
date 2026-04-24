const mongoose = require('mongoose');

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 30 * 60 * 1000; // 30 minutes

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  totp_key: { type: String, default: null },
  last_login: { type: Date, default: null },
  failed_login_attempts: { type: Number, required: true, default: 0 },
  lockout_time: { type: Number, default: null }
}, { timestamps: true });

UserSchema.virtual('isLocked').get(function () {
  return !!(this.lockout_time && this.lockout_time > Date.now());
});

UserSchema.methods.failLoginIncrement = function () {
  const lockExpired = !!(this.lockout_time && this.lockout_time < Date.now());
  if (lockExpired) {
    return this.updateOne({
      $set: { failed_login_attempts: 0 },
      $unset: { lockout_time: 1 }
    });
  }
  const updates = { $inc: { failed_login_attempts: 1 } };
  const needToLock = !!(this.failed_login_attempts >= MAX_LOGIN_ATTEMPTS && !this.isLocked);
  if (needToLock) {
    updates.$set = { lockout_time: Date.now() + LOCKOUT_TIME };
  }
  return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $set: { failed_login_attempts: 0, last_login: Date.now() },
    $unset: { lockout_time: 1 }
  });
};

module.exports = mongoose.model('Users', UserSchema);
