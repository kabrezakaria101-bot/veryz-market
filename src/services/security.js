// Mots de passe (scrypt) et jetons de connexion signés (HMAC). Aucune dépendance externe.
const crypto = require('crypto');
const { promisify } = require('util');
const config = require('../config');

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function sign(data) {
  return crypto.createHmac('sha256', config.secret).update(data).digest('base64url');
}

function createToken(userId) {
  const payload = Buffer.from(JSON.stringify({
    uid: userId,
    exp: Date.now() + config.sessionDays * 86400000
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  if (typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const good = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (good.length !== given.length || !crypto.timingSafeEqual(good, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

// Numéro du Burkina : 8 chiffres (on accepte +226 / 00226 devant)
function normalizePhone(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('00226')) digits = digits.slice(5);
  else if (digits.startsWith('226') && digits.length === 11) digits = digits.slice(3);
  return /^\d{8}$/.test(digits) ? digits : null;
}

module.exports = { hashPassword, verifyPassword, createToken, readToken, normalizePhone };
