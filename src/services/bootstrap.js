// Crée le compte administrateur au démarrage (identifiants dans .env)
const db = require('../db');
const config = require('../config');
const { hashPassword, normalizePhone } = require('./security');

async function ensureAdmin() {
  const phone = normalizePhone(config.admin.phone);
  if (!phone || !config.admin.password) return;
  const exists = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (exists) return;
  db.prepare(
    "INSERT INTO users (full_name, phone, password_hash, role, city) VALUES (?, ?, ?, 'admin', 'Ouagadougou')"
  ).run(config.admin.name, phone, await hashPassword(config.admin.password));
  console.log(`Compte admin créé : téléphone ${phone}`);
}

module.exports = { ensureAdmin };
