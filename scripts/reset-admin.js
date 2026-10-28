// Crée ou répare le compte administrateur, sans toucher aux annonces ni aux autres comptes.
// Utilisation (depuis le dossier du projet) :
//   node scripts/reset-admin.js 70000000 "MonNouveauMotDePasse"
require('dotenv').config();
const db = require('../src/db');
const { hashPassword, normalizePhone } = require('../src/services/security');

(async () => {
  await db.init();
  const phone = normalizePhone(process.argv[2]);
  const password = process.argv[3];

  if (!phone || !password || password.length < 6) {
    console.log('\nUtilisation : node scripts/reset-admin.js 70000000 "MotDePasse"');
    console.log('(téléphone à 8 chiffres, mot de passe de 6 caractères minimum)\n');
    console.log('Comptes existants :');
    console.table(await db.all('SELECT id, full_name, phone, role FROM users ORDER BY id'));
    await db.pool.end();
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const existing = await db.one('SELECT id FROM users WHERE phone = $1', [phone]);

  if (existing) {
    await db.query("UPDATE users SET password_hash = $1, role = 'admin' WHERE id = $2", [hash, existing.id]);
    console.log(`Compte ${phone} mis à jour : il est administrateur avec le nouveau mot de passe.`);
  } else {
    await db.query(
      "INSERT INTO users (full_name, phone, password_hash, role, city) VALUES ('Administrateur', $1, $2, 'admin', 'Ouagadougou')",
      [phone, hash]
    );
    console.log(`Compte administrateur ${phone} créé.`);
  }

  console.log('Tu peux te connecter sur /login.html.');
  await db.pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
