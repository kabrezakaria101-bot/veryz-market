// Enregistre les photos et vocaux envoyés par le navigateur (data URL) dans data/uploads
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

function writeFile(buffer, ext) {
  const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(config.uploadsDir, name), buffer);
  return `/uploads/${name}`;
}

function saveImage(dataUrl) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Format de photo invalide (JPEG, PNG ou WebP).');
  const type = IMAGES[match[1]];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > config.maxImageBytes) throw new Error('Photo trop lourde (2 Mo maximum).');
  if (!type.magic(buffer)) throw new Error('Le fichier n\'est pas une vraie image.');
  return writeFile(buffer, type.ext);
}

function saveAudio(dataUrl) {
  const match = /^data:audio\/(webm|ogg|mp4|mpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Format vocal invalide.');
  const type = AUDIOS[match[1]];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_AUDIO_BYTES) throw new Error('Vocal trop long (1 minute 30 maximum).');
  if (!type.magic(buffer)) throw new Error('Le fichier n\'est pas un vrai vocal.');
  return writeFile(buffer, type.ext);
}

function deleteImage(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const file = path.join(config.uploadsDir, path.basename(url));
  fs.rm(file, { force: true }, () => {});
}

module.exports = { saveImage, saveAudio, deleteImage };
