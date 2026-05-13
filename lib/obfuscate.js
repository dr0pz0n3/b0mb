const XOR_CODE = process.env.XOR_CODE || 'b0mb';
const CESAR_CODE = parseInt(process.env.CESAR_CODE) || 3;

function encodePayload(payload) {
  // caesar shift each char
  const caesared = payload.split('').map((char, i) => {
    const code = char.charCodeAt(0);
    return i % 2 === 0
      ? String.fromCharCode((code + CESAR_CODE) % 128)
      : String.fromCharCode((code - CESAR_CODE + 128) % 128);
  }).join('');

  // XOR with key
  const xored = caesared.split('').map((char, i) => {
    return char.charCodeAt(0) ^ XOR_CODE.charCodeAt(i % XOR_CODE.length);
  });

  return Buffer.from(xored).toString('base64url');
}

function decodePayload(obfuscated) {
  const bytes = Array.from(Buffer.from(obfuscated, 'base64url'));

  const unxored = bytes.map((byte, i) => {
    return String.fromCharCode(byte ^ XOR_CODE.charCodeAt(i % XOR_CODE.length));
  }).join('');

  return unxored.split('').map((char, i) => {
    const code = char.charCodeAt(0);
    return i % 2 === 0
      ? String.fromCharCode((code - CESAR_CODE + 128) % 128)
      : String.fromCharCode((code + CESAR_CODE) % 128);
  }).join('');
}

function obfuscateToken(jwt) {
  const [header, payload, signature] = jwt.split('.');
  return `${header}.${encodePayload(payload)}.${signature}`;
}

function deobfuscateToken(obfuscated) {
  const [header, payload, signature] = obfuscated.split('.');
  return `${header}.${decodePayload(payload)}.${signature}`;
}

module.exports = { obfuscateToken, deobfuscateToken };
