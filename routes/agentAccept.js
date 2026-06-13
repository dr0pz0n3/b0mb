const express = require('express');
const Agent = require('../lib/models/Agent.js');
const jwt = require('jsonwebtoken');
const redis = require('../lib/redis.js');
const obfuscation = require('../lib/obfuscate.js');
const shortid = require("shortid");

const DOWNLOAD_JWT_SECRET_KEY = process.env.DOWNLOAD_JWT_SECRET_KEY;
const VERBOSE = process.env.VERBOSE === 'true';

const router = express.Router();

// agent registers -> goes pending
router.post('/register', async (req, res) => {
    try {
        const redis_token = shortid.generate();
        const { username } = req.body;
        if (!username)
            return res.status(400).send({ msg: 'username and password required' });
        const existing = await Agent.findOne({ username });
        if (existing)
            return res.status(409).send({ msg: 'ko' });
        await Agent.create({ username: username, uid:redis_token });
        return res.status(200).send({ msg: 'ok' });
    } catch (e) {
        if (VERBOSE) console.log(e);
        return res.status(404).send();
    }
});

// agent polls login -> if accepted, JWT -> use for /download
router.post('/login', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username)
            return res.status(400).send({ msg: 'Incorrect username and password' });
        const agent = await Agent.findOne({ username });
        if (!agent)
            return res.status(400).send({ msg: 'Incorrect username and password' });
        if (agent.status === 'pending')
            return res.status(400).send({ msg: 'Incorrect username and password' });
        if (agent.status === 'rejected')
            return res.status(400).send({ msg: 'Incorrect username and password' });
        if (!agent.file)
            return res.status(400).send({ msg: 'no payload assigned' });
        const claim = { type: 'agent', token: agent.uid, file: agent.file };
        const token = jwt.sign(claim, DOWNLOAD_JWT_SECRET_KEY, { expiresIn: '1h' });
        await redis.set(agent.uid, token);
        const actualToken = obfuscation.obfuscateToken(token);
        return res.status(200).send({ token: actualToken, uid: agent.uid });
    } catch (e) {
        if (VERBOSE) console.log(e);
        return res.status(404).send();
    }
});

module.exports = router;
