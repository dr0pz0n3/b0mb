var mongoose = require('mongoose')

var LogSchema = new mongoose.Schema({
  token: String,
  type: { type: String, enum: ['http', 'websocket'], default: 'http' },
  method: String,
  link: String,
  userAgent: String,
  ipAddress: String,
  body: String,
  header: Array
}, { timestamps:true })


module.exports = mongoose.model('Log', LogSchema)

