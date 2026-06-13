const mongoose = require('mongoose');

const AgentSchema = new mongoose.Schema({
  username:  { type: String, required: true },
  status:    { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  uid:       { type: String, required: true },
  file:      { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Agent', AgentSchema);

