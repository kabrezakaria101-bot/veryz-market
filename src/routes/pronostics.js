const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { saveImage, deleteImage } = require('../services/images');
const { notify } = require('../services/notify');

const router = express.Router();
const PAGE_SIZE = 20;

// Liste publique
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const total = (await db.one('SELECT COUNT(*)::int AS n FROM pronostics')).n;
  const items = await db.all(
    'SELECT id, title, note, image_url, created_at FROM pronostics ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2',
    [PAGE_SIZE, (page - 1) * PAGE_SIZE]
  );
  res.json({ success: true, items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
});

// Publier (admin seulement)
router.post('/', requireRole('admin'), async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || '').trim().slice(0, 100);
  const note = String(body.note || '').trim().slice(0, 1000);
  if (!body.media) return res.status(400).json({ success: false, message: 'Choisis une photo.' });
  let url;
  try { url = await saveImage(body.media); }
  catch (e) { return res.status(400).json({ success: false, message: e.message }); }
  const row = await db.one(
    'INSERT INTO pronostics (author_id, title, note, image_url) VALUES ($1, $2, $3, $4) RETURNING id',
    [req.user.id, title, note, url]
  );
  await notify({
    type: 'pronostic',
    body: title ? `Nouveau pronostic : ${title}` : 'Nouveau pronostic disponible',
    link: '/pronostic.html',
    actorId: req.user.id
  });
  res.status(201).json({ success: true, id: row.id });
});

// Supprimer (admin seulement)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = /^\d{1,9}$/.test(req.params.id) ? Number(req.params.id) : null;
  const row = id ? await db.one('DELETE FROM pronostics WHERE id = $1 RETURNING image_url', [id]) : null;
  if (!row) return res.status(404).json({ success: false, message: 'Pronostic introuvable.' });
  deleteImage(row.image_url);
  res.json({ success: true });
});

module.exports = router;