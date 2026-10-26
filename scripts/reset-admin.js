// Crée ou répare le compte administrateur, sans toucher aux annonces ni aux autres comptes.
// Utilisation (depuis le dossier du projet) :
//   node scripts/reset-admin.js 70000000 "MonNouveauMotDePasse"
require('dotenv').config();
const db = require('../src/db');
const { hashPassword, normalizePhone } = require('../src/services/security');

(async () => {
  const phone = normalizePhone(process.argv[2]);
  const password = process.argv[3];

  if (!phone || !password || password.length < 6) {
    console.log('\nUtilisation : node scripts/reset-admin.js 70000000 "MotDePasse"');
    console.log('(téléphone à 8 chiffres, mot de passe de 6 caractères minimum)\n');
    console.log('Comptes existants :');
    console.table(db.prepare('SELECT id, full_name, phone, role FROM users ORDER BY id').all());
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);

  if (existing) {
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?").run(hash, existing.id);
    console.log(`Compte ${phone} mis à jour : il est administrateur avec le nouveau mot de passe.`);
  } else {
    db.prepare(
      "INSERT INTO users (full_name, phone, password_hash, role, city) VALUES ('Administrateur', ?, ?, 'admin', 'Ouagadougou')"
    ).run(phone, hash);
    console.log(`Compte administrateur ${phone} créé.`);
  }

  console.log('Tu peux te connecter sur /login.html.');
  db.close();
})();
