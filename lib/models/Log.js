var mongoose = require('mongoose')

var LogSchema = new mongoose.Schema({
  dropboxId: String,
  method: String,
  link: String,
  userAgent: String,
  ipAddress: String,
  body: String,
  header: Array
}, { timestamps:true })


module.exports = mongoose.model('Log', LogSchema)

