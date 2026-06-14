const mongoose = require('mongoose');

const ProxySchema = new mongoose.Schema({
  token:       { type: String, required: true },
  url:         { type: String, required: true },
  rewrite:     { type: [String] },
}, { timestamps: true });

module.exports = mongoose.model('Proxy', ProxySchema);
