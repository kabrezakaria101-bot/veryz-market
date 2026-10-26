// Configuration centrale : tout ce qui se règle se trouve ici ou dans .env
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Clé secrète pour signer les connexions. Générée une fois et gardée dans data/.secret
function loadSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
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
  isProduction: process.env.NODE_ENV === 'production',
  secret: loadSecret(),
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
