const express = require('express');
const middleware = require("../middleware/middleware.js");
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const UNITS_PATH = process.env.UNITS_PATH || '/units';

const router = express.Router();


router.get('/', middleware.downloadToken, async (req, res) => {
  try {
    if (req.jwtData.type === 'loot') {
      const tarPath = path.join(UNITS_PATH, `loot_${req.jwtData.token}.tar.xz`);
      if (!fs.existsSync(tarPath)) return res.status(404).send({ msg: 'loot not found' });
      res.download(tarPath, `loot_${req.jwtData.token}.tar.xz`);
    } else {
      return res.status(400).send({ msg: 'unknown token type' });
    }
  } catch (e) {
    return res.status(500).send({ msg: 'internal server error' });
  }
});

module.exports = router;

