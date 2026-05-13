const jwt = require("jsonwebtoken");
const logger = require('../lib/logger.js');
const redis = require('../lib/redis.js');
const obfuscation = require('../lib/obfuscate.js');

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const REFRESH_JWT_SECRET_KEY = process.env.REFRESH_JWT_SECRET_KEY;
const DOWNLOAD_JWT_SECRET_KEY = process.env.DOWNLOAD_JWT_SECRET_KEY;

module.exports = {
  isLoggedIn: (req, res, next) => {
    try {
      // extract the authorization after Bearer
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, REFRESH_JWT_SECRET_KEY);
      const date = new Date();

      req.userData = decoded;
      logger.info("[" + date + "] - " + req.ip + " - " + decoded.username + " - " +req.originalUrl);
      next();
    } catch (err) {
      console.log(err);
      logger.error("Invalid token: ", err);
      return res.status(401).send({ msg: "Your session is not valid!" });
    }
  },
  checkLogin: (req, res, next) => {
    const date = new Date();

    if (!req.body.username || req.body.username.length < 3) {
      return res.status(404).send();
    }
    if (!req.body.password || req.body.password.length < 3) {
      return res.status(404).send();
    }
    if (!req.body.otp_code) {
      return res.status(404).send();
    }
    logger.info("[" + date + "] - " + req.ip + " - User Attempt Login: " + req.body.username);
    next();
  },
  refreshToken: (req, res, next) => {
    try {
      // extract the authorization after Bearer
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET_KEY);
      const date = new Date();

      req.userData = decoded;
      req.userToken = token;

      logger.info("[" + date + "] - " + req.ip + " - " + req.originalUrl);
      next();
    } catch (err) {
      console.log(err);
      logger.error("Invalid token: ", err);
      return res.status(401).send({ msg: "Your session is not valid!" });
    }
  },
  downloadToken: async (req, res, next) => {
    try {
      const token = req.headers.authorization.split(" ")[1];
      console.log(token);
      const actualToken = obfuscation.deobfuscateToken(token);
      console.log(actualToken);
      const decoded = jwt.verify(actualToken, DOWNLOAD_JWT_SECRET_KEY);
      req.jwtData = decoded;

      const exists = await redis.get(decoded.token);
      if (!exists) return res.status(401).send({ msg: 'invalid or expired token' });
      await redis.del(decoded.token);

      next();
    } catch (err) {
      console.log(err);
      logger.error("Invalid token: ", err);
      return res.status(401).send({ msg: "Your session is not valid!" });
    }
  }
}

