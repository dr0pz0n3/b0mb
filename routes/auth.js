const express = require('express');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const notp = require('notp');

const middleware = require("../middleware/middleware.js");
const User = require('../lib/models/User.js');
const redis = require('../lib/redis.js');

const router = express.Router();
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const REFRESH_JWT_SECRET_KEY = process.env.REFRESH_JWT_SECRET_KEY;
const DEPLOY_SALT = process.env.DEPLOY_SALT;

// cleartext -> sha256 -> bcrypt
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

router.post('/login', middleware.checkLogin, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });

    if (!user) {
      return res.status(401).send({ msg: "Incorrect username or password!" });
    }

    if (user.isLocked) {
      return res.status(401).send({ msg: "Account locked, try again later" });
    }

    const hash = await hashPassword(req.body.password);
    const passwordMatch = await bcrypt.compare(hash, user.password);
    console.log(user.password)
    console.log(hash)

    console.log(passwordMatch);
    if (!passwordMatch) {
      await user.failLoginIncrement();
      return res.status(401).send({ msg: "Incorrect username or password!" });
    }

    // OTP verify (stubbed for now, uncomment when totp_key is set at deploy time)
    const otp = notp.totp.verify(req.body.otp_code, user.totp_key);
    console.log(otp);
    if (!otp) {
      await user.failLoginIncrement();
      return res.status(401).send({ msg: "Incorrect username or password!" });
    }
    console.log(otp);

    const refreshToken = jwt.sign({ type:'user', username: user.username }, JWT_SECRET_KEY, { expiresIn: "7d" });

    await redis.set(user._id.toString(), refreshToken);
    await user.resetLoginAttempts();

    return res.status(200).send({ msg: "Logged in!", refreshToken });

  } catch (e) {
    return res.status(500).send({ msg: "Internal server error" });
  }
});

router.get('/refresh', middleware.refreshToken, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.userData.username });

    if (!user) {
      return res.status(401).send({ msg: "Incorrect token!" });
    }

    const val = await redis.get(user._id.toString());

    if (!val || val !== req.userToken) {
      return res.status(401).send({ msg: "Incorrect token!" });
    }

    const accessToken = jwt.sign({ type:'user', username: user.username }, REFRESH_JWT_SECRET_KEY, { expiresIn: "24h" });
    return res.status(200).send({ msg: "Refreshed!", accessToken });

  } catch (e) {
    return res.status(500).send({ msg: "Internal server error" });
  }
});

router.post('/logout', middleware.isLoggedIn, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.userData.username });
    if (user) await redis.del(user._id.toString());
    return res.status(200).send({ msg: "Logged out!" });
  } catch (e) {
    return res.status(500).send({ msg: "Internal server error" });
  }
});

module.exports = router;
