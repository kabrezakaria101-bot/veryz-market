// Crée le compte administrateur au démarrage (ADMIN_PHONE et ADMIN_PASSWORD)
const db = require('../db');
const config = require('../config');
const { hashPassword, normalizePhone } = require('./security');

async function ensureAdmin() {
  const phone = normalizePhone(config.admin.phone);
  if (!phone || !config.admin.password) {
    console.log('Aucun admin créé : ADMIN_PHONE ou ADMIN_PASSWORD manque.');
    return;
  }
  if (await db.one('SELECT id FROM users WHERE phone = $1', [phone])) return;
  await db.query(
    "INSERT INTO users (full_name, phone, password_hash, role, city) VALUES ($1, $2, $3, 'admin', 'Ouagadougou')",
    [config.admin.name, phone, await hashPassword(config.admin.password)]
  );
  console.log(`Compte admin créé : téléphone ${phone}`);
}

module.exports = { ensureAdmin };
