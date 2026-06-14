const express = require('express');
const path = require('path');
const fs = require('fs');
const Proxy = require('../lib/models/Proxy.js');

const PROXY_PATH = process.env.PROXY_PATH || '/proxies';
const VERBOSE = process.env.VERBOSE === 'true';
const router = express.Router();

router.all('/{*path}', async (req, res) => {
  try {
    let parts = req.path.split('/').filter(Boolean);
    let token = parts[0];
    let subpath = '/' + parts.slice(1).join('/');

    let proxy = await Proxy.findOne({ token });
    if (!proxy) {
      // maybe token is in cookie, parts[0] is actually a subpath
      token = req.cookies.proxy_token;
      proxy = await Proxy.findOne({ token });
      if (!proxy) return res.status(404).send({ msg: 'proxy not found' });
      // reconstruct full subpath including parts[0]
      subpath = '/' + parts.join('/');
    }

    const targetUrl = proxy.url.replace(/\/$/, '') + subpath;

    // Forward headers, strip host
    const forwardHeaders = { ...req.headers };
    delete forwardHeaders['host'];

    const fetchOptions = {
      method: req.method,
      headers: forwardHeaders,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    };

    const upstream = await fetch(targetUrl, fetchOptions);

    const contentType = upstream.headers.get('content-type') || '';

    if (contentType.startsWith('image/')) {
      upstream.headers.forEach((value, key) => {
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key)) {
          res.setHeader(key, value);
        }
      });
     const buffer = await upstream.arrayBuffer();
      return res.end(Buffer.from(buffer));
    }

    // Build raw HTTP request log
    const rawRequest = `${req.method} ${subpath} HTTP/1.1\r\nHost: ${new URL(proxy.url).host}\r\n` +
      Object.entries(forwardHeaders).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n' +
      (fetchOptions.body ? JSON.stringify(fetchOptions.body) : '');

    // Build raw HTTP response log
    let responseBody = await upstream.text();
    const rawResponse = `HTTP/1.1 ${upstream.status} ${upstream.statusText}\r\n` +
      [...upstream.headers.entries()].map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n' +
      responseBody;

    // Append to log file
    const logPath = path.join(PROXY_PATH, `${token}.log`);
    fs.appendFileSync(logPath, rawRequest + '\r\n' + rawResponse + '\r\n---\r\n');

    // Rewrite domains in response body
    if (proxy.rewrite && proxy.rewrite.length > 0) {
      for (const domain of proxy.rewrite) {
        const re = new RegExp(`https?://${domain.replace('.', '\\.')}`, 'g');
        responseBody = responseBody.replace(re, `${req.protocol}://${req.get('host')}/p/${token}`);
      }
    }

    // Forward response headers back
    upstream.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key)) {
        res.setHeader(key, value);
      }
    });
    res.cookie('proxy_token', token, { httpOnly: false });

    responseBody = responseBody.replace(/(href|src|action)="\//g, `$1="/p/${token}/`);
    res.status(upstream.status).send(responseBody);
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send({ msg: 'internal server error' });
  }
});

module.exports = router;

