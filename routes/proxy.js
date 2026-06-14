const express = require('express');
const middleware = require('../middleware/middleware.js');
const shortid = require("shortid");
const Proxy = require('../lib/models/Proxy.js');
const fs = require('fs');
const path = require('path');

const PROXY_PATH = process.env.PROXY_PATH || '/proxies';
const VERBOSE = process.env.VERBOSE === 'true';

const router = express.Router();

// Create a proxy
router.post('/', middleware.isLoggedIn, async (req, res) => {
  try {
    const { url, rewrite } = req.body;
    const token = shortid.generate();
    const proxy = await Proxy.create({ token: token, url: url, rewrite});
    return res.status(200).send({token});
  } catch (e) {
    if (VERBOSE) {
      console.log(e)
    }
    return res.status(500).send({ msg: 'internal server error' });
  }
});

// list all proxies ? id= search for one proxy
router.get('/', middleware.isLoggedIn, async (req, res) => {
  try {
    if (req.query.token) {
      const proxy = await Proxy.find({ token: req.query.token });
      if (proxy.length != 1) return res.status(404).send({ msg: 'proxy not found' });
      const logPath = path.join(PROXY_PATH, `${proxy[0].token}.log`);
      const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
      return res.status(200).send({ proxy, log });
    }
    const proxies = await Proxy.find({});
    return res.status(200).send({ proxies });
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send({ msg: 'internal server error' });
  }
});

// Delete a proxy {token: uniqueid}
router.delete('/', middleware.isLoggedIn, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).send({ msg: 'token is required' });
    const proxy = await Proxy.find({ token });
    if (proxy.length != 1) return res.status(404).send({ msg: 'proxy not found' });
    await Proxy.findByIdAndDelete(proxy[0]._id);
    if (VERBOSE) {
      console.log(`Deleted proxy ${token}`);
    }
    return res.status(200).send({ msg: 'proxy deleted' });
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send({ msg: 'internal server error' });
  }
});

module.exports = router;
