const mongoose = require('mongoose');

const UnitSchema = new mongoose.Schema({
  label:      { type: String, required: true },
  mode:       { type: String, enum: ['dropbox', 'hashcat', 'boot'], default: 'boot' },
  token:      { type: String, required: true, unique: true },
}, { timestamps: true });

module.exports = mongoose.model('Unit', UnitSchema);

