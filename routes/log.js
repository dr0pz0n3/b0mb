const express = require('express');
const middleware = require('../middleware/middleware.js');
const Log = require('../lib/models/Log.js');
const VERBOSE = process.env.VERBOSE === 'true';

const router = express.Router();

const createLog = (req) => Log.create({
  token: req.params.token,
  type: 'http',
  method: req.method,
  link: req.url,
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
  body: JSON.stringify(req.body),
  header: req.headers
});

router.get('/:token/pic', async (req, res) => {
  try {
    await createLog(req);
    return res.redirect(301, "/public/1px.png");
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send('ko');
  }
});

router.get('/:token/frame', async (req, res) => {
  try {
    if (req.query.url === undefined) return res.status(400).send('ko');
    await createLog(req);
    let frame = fs.readFileSync('public/frame.html', 'utf8');
    frame = frame.replace(/CHANGEURL/g, req.query.url);
    if (req.query.title !== undefined) frame = frame.replace(/CHANGETITLE/g, req.query.title);
    if (req.query.inject !== undefined) frame = frame.replace(/\/\*CHANGEJS\*\//g, req.query.inject);
    return res.status(200).send(frame);
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send('ko');
  }
});

router.all('/:token', async (req, res) => {
  try {
    await createLog(req);
    if (req.query.url !== undefined) {
      return res.status(200).redirect(req.query.url);
    } else {
      if (req.query.inject !== undefined && req.query.mime !== undefined) {
        return res.status(200).setHeader('Content-Type', req.query.mime).send(req.query.inject);
      } else {
        return res.status(200).send("ok");
      }
    }
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send('ko');
  }
});

module.exports = router;

