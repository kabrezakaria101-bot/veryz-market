// Configuration centrale : tout ce qui se règle se trouve ici ou dans les variables d'environnement.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data'); // utilisé seulement en local (photos et clé de test)
const uploadsDir = path.join(dataDir, 'uploads');
const isProduction = process.env.NODE_ENV === 'production';

// CLOUDINARY_URL = cloudinary://CLE:SECRET@NOM_DU_CLOUD  (fournie par Cloudinary)
function parseCloudinary() {
  const match = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec((process.env.CLOUDINARY_URL || '').trim());
  return match ? { apiKey: match[1], apiSecret: match[2], cloudName: match[3] } : null;
}

// Clé qui signe les connexions. En ligne elle DOIT venir de SESSION_SECRET.
function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (isProduction) throw new Error('SESSION_SECRET manquant : ajoute-le dans les variables d\'environnement.');
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, '.secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

module.exports = {
  rootDir,
  dataDir,
  uploadsDir,
  isProduction,
  secret: loadSecret(),
  cloudinary: parseCloudinary(),
  cookieName: 'vm_session',
  sessionDays: 30,
  maxImageBytes: 2 * 1024 * 1024,
  pageSize: 12,
  mobileMoney: {
    mode: process.env.MOBILE_MONEY_MODE || 'simulation', // 'simulation' ou 'live'
    simulationCode: '1234',
    providers: [
      { id: 'orange', name: 'Orange Money' },
      { id: 'moov', name: 'Moov Money' },
      { id: 'coris', name: 'Coris Money' }
    ]
  },
  admin: {
    phone: process.env.ADMIN_PHONE || '',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Administrateur'
  }
};
