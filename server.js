const http = require('http');
const express = require('express');
const helmet = require('helmet');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const uuid = require('uuid');
const bcrypt = require("bcryptjs");
const base32 = require('thirty-two');

const User = require('./lib/models/User.js');

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(helmet());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/public', express.static('public'));

// routes
var auth = require('./routes/auth');
var unit = require('./routes/unit');
//var api = require('./routes/api');
//var code = require('./routes/code');
//var websocket = require('./routes/websocket');
//
async function initAdmin() {
  const existing = await User.findOne({ username: process.env.ADMIN_USER });
  if (existing) {
    console.log('[b0mb] admin already exists, skipping');
    return;
  }
  const totp_key = uuid.v4();
  const password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  await User.create({ username: process.env.ADMIN_USER, password, totp_key });
  const encoded_totp = base32.encode(totp_key).toString().replace(/=/g, '');
  console.log(`[b0mb] admin created!`);
  console.log(`[b0mb] OTP: otpauth://totp/${process.env.ADMIN_USER}@b0mb?secret=${encoded_totp}`);
}

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log('[monogo] connected!');
  initAdmin();
}).catch(err => console.error(err))


app.use('/auth', auth);
app.use('/unit', unit);
app.get("/", function (_req, res) {
  return res.status(200).send(`b0mb online`);
});


const server = http.createServer(app);
server.listen(8000,() => console.log("[b0mb] listening on 8000"));

server.on('error', (error) => {
  switch (error.code) {
    case 'EACCES':
      console.error(`port 8000 requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`port 8000 already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});




