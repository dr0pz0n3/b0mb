const express = require('express');
const middleware = require('../middleware/middleware.js');
const shortid = require("shortid");
const Agent = require('../lib/models/Agent.js');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const redis = require('../lib/redis.js');
const obfuscation = require('../lib/obfuscate.js');

const AGENT_PATH = process.env.AGENT_PATH || '/agents';
const VERBOSE = process.env.VERBOSE === 'true';
const DOWNLOAD_JWT_SECRET_KEY = process.env.DOWNLOAD_JWT_SECRET_KEY;

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(AGENT_PATH, { recursive: true });
        cb(null, AGENT_PATH);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage });

// list all agents
router.get('/', middleware.isLoggedIn, async (req, res) => {
  try {
    const agents = await Agent.find({});
    return res.status(200).send({ agents });
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send({ msg: 'internal server error' });
  }
});

// accept or deny agent
router.post('/', middleware.isLoggedIn, async (req, res) => {
  try {
    const { id, action, file } = req.body;
    if (!id || !['accept', 'deny'].includes(action))
        return res.status(400).send({ msg: 'id and action required' });
    if (action === 'accept' && !file)
        return res.status(400).send({ msg: 'file required on accept' });
    const agent = await Agent.findById(id);
    if (!agent)
        return res.status(404).send({ msg: 'agent not found' });
    if (action === 'accept') {
        const filePath = path.join(AGENT_PATH, file);
        if (!fs.existsSync(filePath))
            return res.status(404).send({ msg: 'payload file not found' });
    }
    await Agent.findByIdAndUpdate(id, {
        status: action === 'accept' ? 'accepted' : 'rejected',
        file: action === 'accept' ? file : null
    });
    return res.status(200).send({ msg: `agent ${action}ed` });
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send({ msg: 'internal server error' });
  }
});

// upload payload file
router.post('/upload', middleware.isLoggedIn, upload.single('file'), async (req, res) => {
  try {
    if (!req.file)
        return res.status(400).send({ msg: 'file required' });
    if (VERBOSE) console.log(`Uploaded payload: ${req.file.originalname}`);
    return res.status(200).send({ msg: 'file uploaded', file: req.file.originalname });
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send({ msg: 'internal server error' });
  }
});

// generate one time download link for a specific agent
router.post('/generate', middleware.isLoggedIn, async (req, res) => {
  try {
    const { file } = req.body;
    const redis_token = shortid.generate();
    const claim = { type: 'agent', token: redis_token, file: file };
    const token = jwt.sign(claim, DOWNLOAD_JWT_SECRET_KEY, { expiresIn: '1h' });
    await redis.set(redis_token, token);
    const actualToken = obfuscation.obfuscateToken(token);
    return res.status(200).send({ msg: 'download link generated', token: actualToken });
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send({ msg: 'internal server error' });
  }
});

module.exports = router;
