const express = require('express');
const { rateLimit } = require('express-rate-limit');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { saveImage, saveAudio } = require('../services/images');

const router = express.Router();

// Stickers autorisés (la même liste est dans public/js/messages.js)
const STICKERS = ['👍', '❤️', '😂', '🙏', '😮', '😢', '🔥', '✅', '👋', '🎉', '😡', '🤝', '😊', '🙌', '💯', '❓'];

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Trop de messages. Attends un instant.' }
});

// Vérifie le message reçu (texte, sticker, photo ou vocal)
async function readMessage(req) {
  const { kind = 'text', body, media } = req.body || {};
  const text = String(body || '').trim();

  if (kind === 'text') {
    if (!text || text.length > 1000) return { error: 'Message vide ou trop long (1000 caractères max).' };
    return { kind, text, mediaUrl: null };
  }
  if (kind === 'sticker') {
    if (!STICKERS.includes(text)) return { error: 'Sticker invalide.' };
    return { kind, text, mediaUrl: null };
  }
  try {
    if (kind === 'image') return { kind, text: text.slice(0, 300), mediaUrl: await saveImage(media) };
    if (kind === 'audio') return { kind, text: '', mediaUrl: await saveAudio(media) };
  } catch (e) {
    return { error: e.message };
  }
  return { error: 'Type de message invalide.' };
}

const SELECT_THREAD = `
  SELECT id, sender_role, kind, body, media_url, created_at
  FROM messages WHERE user_id = $1 ORDER BY id ASC LIMIT 200
`;

const INSERT = 'INSERT INTO messages (user_id, sender_role, kind, body, media_url) VALUES ($1, $2, $3, $4, $5)';

// Nombre de messages non lus (pastille du bouton)
router.get('/unread', requireAuth, async (req, res) => {
  const row = req.user.role === 'admin'
    ? await db.one("SELECT COUNT(*)::int AS n FROM messages WHERE sender_role = 'user' AND is_read = 0")
    : await db.one("SELECT COUNT(*)::int AS n FROM messages WHERE user_id = $1 AND sender_role = 'admin' AND is_read = 0", [req.user.id]);
  res.json({ success: true, unread: row.n });
});

// ----- Côté administrateur -----
router.get('/admin/threads', requireRole('admin'), async (req, res) => {
  const items = await db.all(`
    SELECT u.id AS user_id, u.full_name, u.phone,
      (SELECT CASE m.kind WHEN 'image' THEN '📷 Photo' WHEN 'audio' THEN '🎤 Message vocal' ELSE m.body END
         FROM messages m WHERE m.user_id = u.id ORDER BY m.id DESC LIMIT 1) AS last_body,
      (SELECT created_at FROM messages m WHERE m.user_id = u.id ORDER BY m.id DESC LIMIT 1) AS last_at,
      (SELECT COUNT(*)::int FROM messages m WHERE m.user_id = u.id AND m.sender_role = 'user' AND m.is_read = 0) AS unread
    FROM users u
    WHERE EXISTS (SELECT 1 FROM messages m WHERE m.user_id = u.id)
    ORDER BY last_at DESC
  `);
  res.json({ success: true, items });
});

const userIdOf = (req) => (/^\d{1,9}$/.test(req.params.userId) ? Number(req.params.userId) : null);

router.get('/admin/:userId', requireRole('admin'), async (req, res) => {
  const userId = userIdOf(req);
  if (!userId) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
  const items = await db.all(SELECT_THREAD, [userId]);
  await db.query("UPDATE messages SET is_read = 1 WHERE user_id = $1 AND sender_role = 'user' AND is_read = 0", [userId]);
  res.json({ success: true, items });
});

router.post('/admin/:userId', requireRole('admin'), sendLimiter, async (req, res) => {
  const userId = userIdOf(req);
  if (!userId || !(await db.one('SELECT id FROM users WHERE id = $1', [userId]))) {
    return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
  }
  const msg = await readMessage(req);
  if (msg.error) return res.status(400).json({ success: false, message: msg.error });
  await db.query(INSERT, [userId, 'admin', msg.kind, msg.text, msg.mediaUrl]);
  res.status(201).json({ success: true });
});

// ----- Côté utilisateur -----
router.get('/', requireAuth, async (req, res) => {
  const items = await db.all(SELECT_THREAD, [req.user.id]);
  await db.query("UPDATE messages SET is_read = 1 WHERE user_id = $1 AND sender_role = 'admin' AND is_read = 0", [req.user.id]);
  res.json({ success: true, items });
});

router.post('/', requireAuth, sendLimiter, async (req, res) => {
  const msg = await readMessage(req);
  if (msg.error) return res.status(400).json({ success: false, message: msg.error });
  await db.query(INSERT, [req.user.id, 'user', msg.kind, msg.text, msg.mediaUrl]);
  res.status(201).json({ success: true });
});

module.exports = router;
