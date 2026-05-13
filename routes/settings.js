const express = require('express');
const Docker = require('dockerode');
const middleware = require("../middleware/middleware.js");

const VERBOSE = process.env.VERBOSE === 'true';

const docker = new Docker();
const router = express.Router();

router.post('/operator_vpn', middleware.isLoggedIn, async (req, res) => {
  try {
    const { operator } = req.body;
    // generate ovpn client cert via dockerode
    const container = docker.getContainer('ovpn');

    const runExec = (cmd) => new Promise(async (resolve, reject) => {
      const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
        WorkingDir: '/usr/share/easy-rsa'
      });
      exec.start({}, (err, stream) => {
        if (err) return reject(err);
        let data = '';
        stream.on('data', chunk => {
          // strip docker stream header (8 bytes)
          data += chunk.slice(8).toString();
        });
        stream.on('end', () => resolve(data));
        stream.on('error', reject);
      });
    });

    // build client cert
    const ret = await runExec(['./easyrsa', '--batch', 'build-client-full', operator, 'nopass']);
    console.log(ret);

    // pull cert files
    const ca   = await runExec(['cat', '/usr/share/easy-rsa/pki/ca.crt']);
    const cert = await runExec(['cat', `/usr/share/easy-rsa/pki/issued/${operator}.crt`]);
    const key  = await runExec(['cat', `/usr/share/easy-rsa/pki/private/${operator}.key`]);
    const ta   = await runExec(['cat', '/etc/openvpn/ta.key']);

    // assemble .ovpn
    const ovpnConfig = `client
dev tun
proto tcp
remote 127.0.0.1 1194
resolv-retry infinite
nobind
persist-tun
remote-cert-tls server
cipher AES-256-GCM
verb 3
allow-compression asym
pull-filter ignore "block-outside-dns"
key-direction 1
<ca>
${ca}</ca>
<cert>
${cert}</cert>
<key>
${key}</key>
<tls-auth>
${ta}</tls-auth>`;

    return res.status(200).send({ file: `${operator}.ovpn`, context: ovpnConfig});
  } catch (e) {
    if (VERBOSE) console.log(e);
    return res.status(500).send({ msg: 'internal server error' });
  }
});

module.exports = router;

