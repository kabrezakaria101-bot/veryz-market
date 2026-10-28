// Photos et vocaux : envoyés sur Cloudinary (si CLOUDINARY_URL est défini), sinon sur le disque en local.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const IMAGES = {
  jpeg: { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  png: { ext: 'png', magic: (b) => b.slice(0, 4).toString('hex') === '89504e47' },
  webp: { ext: 'webp', magic: (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' }
};

const AUDIOS = {
  webm: { ext: 'webm', magic: (b) => b.slice(0, 4).toString('hex') === '1a45dfa3' },
  ogg: { ext: 'ogg', magic: (b) => b.slice(0, 4).toString() === 'OggS' },
  mp4: { ext: 'm4a', magic: (b) => b.slice(4, 8).toString() === 'ftyp' },
  mpeg: { ext: 'mp3', magic: (b) => b.slice(0, 3).toString() === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) }
};

const MAX_AUDIO_BYTES = 1.5 * 1024 * 1024;
const FOLDER = 'veryz-market';

const sha1 = (text) => crypto.createHash('sha1').update(text).digest('hex');

async function uploadToCloudinary(dataUrl, resourceType) {
  const { cloudName, apiKey, apiSecret } = config.cloudinary;
  const timestamp = Math.floor(Date.now() / 1000);
  const form = new FormData();
  form.append('file', dataUrl);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', FOLDER);
  form.append('signature', sha1(`folder=${FOLDER}&timestamp=${timestamp}${apiSecret}`));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    console.error('Cloudinary :', (data.error && data.error.message) || res.status);
    throw new Error('Envoi du fichier impossible pour le moment. Réessaie.');
  }
  return data.secure_url;
}

function saveLocally(buffer, ext) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(config.uploadsDir, name), buffer);
  return `/uploads/${name}`;
}

async function store(dataUrl, buffer, ext, resourceType) {
  if (config.cloudinary) return uploadToCloudinary(dataUrl, resourceType);
  if (config.isProduction) throw new Error('Stockage des fichiers non configuré (CLOUDINARY_URL manquant).');
  return saveLocally(buffer, ext);
}

async function saveImage(dataUrl) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Format de photo invalide (JPEG, PNG ou WebP).');
  const type = IMAGES[match[1]];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > config.maxImageBytes) throw new Error('Photo trop lourde (2 Mo maximum).');
  if (!type.magic(buffer)) throw new Error('Le fichier n\'est pas une vraie image.');
  return store(dataUrl, buffer, type.ext, 'image');
}

async function saveAudio(dataUrl) {
  const match = /^data:audio\/(webm|ogg|mp4|mpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Format vocal invalide.');
  const type = AUDIOS[match[1]];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_AUDIO_BYTES) throw new Error('Vocal trop long (1 minute 30 maximum).');
  if (!type.magic(buffer)) throw new Error('Le fichier n\'est pas un vrai vocal.');
  return store(dataUrl, buffer, type.ext, 'video'); // Cloudinary range l'audio dans « video »
}

// Supprime un fichier (sans jamais bloquer ni faire planter la suite)
async function deleteImage(url) {
  try {
    if (!url) return;
    if (url.startsWith('/uploads/')) {
      fs.rm(path.join(config.uploadsDir, path.basename(url)), { force: true }, () => {});
      return;
    }
    const match = /\/(image|video)\/upload\/(?:v\d+\/)?(.+)\.[A-Za-z0-9]+$/.exec(url);
    if (!config.cloudinary || !match) return;
    const { cloudName, apiKey, apiSecret } = config.cloudinary;
    const timestamp = Math.floor(Date.now() / 1000);
    const form = new FormData();
    form.append('public_id', match[2]);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', sha1(`public_id=${match[2]}&timestamp=${timestamp}${apiSecret}`));
    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${match[1]}/destroy`, { method: 'POST', body: form });
  } catch (e) {
    console.error('Suppression du fichier :', e.message);
  }
}

module.exports = { saveImage, saveAudio, deleteImage };
