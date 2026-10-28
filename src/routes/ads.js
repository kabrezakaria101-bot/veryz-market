const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { saveImage, deleteImage } = require('../services/images');

const router = express.Router();
const MAX_ADS = 10; // nombre maximum de publicités

const parseId = (v) => (/^\d{1,9}$/.test(String(v)) ? Number(v) : null);

// Public : les publicités actives, dans l'ordre
router.get('/', async (req, res) => {
  const items = await db.all('SELECT id, image_url, link_url FROM ads WHERE active = 1 ORDER BY position, id');
  res.json({ success: true, items });
});

// Admin : toutes les publicités
router.get('/admin', requireRole('admin'), async (req, res) => {
  const items = await db.all('SELECT id, image_url, link_url, active, created_at FROM ads ORDER BY position, id');
  res.json({ success: true, items });
});

// Admin : ajouter une publicité (photo + lien facultatif)
router.post('/', requireRole('admin'), async (req, res) => {
  const link = String((req.body && req.body.link_url) || '').trim();
  if (link && !/^(https?:\/\/|\/(?!\/))/i.test(link)) {
    return res.status(400).json({ success: false, message: 'Le lien doit commencer par https:// (ou / pour une page du site).' });
  }
  if (link.length > 500) return res.status(400).json({ success: false, message: 'Lien trop long.' });
  const count = (await db.one('SELECT COUNT(*)::int AS n FROM ads')).n;
  if (count >= MAX_ADS) return res.status(400).json({ success: false, message: `${MAX_ADS} publicités maximum. Supprime-en une d'abord.` });
  let url;
  try { url = await saveImage(req.body && req.body.image); }
  catch (e) { return res.status(400).json({ success: false, message: e.message }); }
  const row = await db.one(
    'INSERT INTO ads (image_url, link_url, position) VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM ads), 0)) RETURNING id',
    [url, link || null]
  );
  res.status(201).json({ success: true, id: row.id });
});

// Admin : afficher / cacher
router.post('/:id/toggle', requireRole('admin'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ success: false, message: 'Introuvable.' });
  await db.query('UPDATE ads SET active = 1 - active WHERE id = $1', [id]);
  res.json({ success: true });
});

// Admin : supprimer
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const id = parseId(req.params.id);
  const row = id ? await db.one('SELECT image_url FROM ads WHERE id = $1', [id]) : null;
  if (!row) return res.status(404).json({ success: false, message: 'Introuvable.' });
  await db.query('DELETE FROM ads WHERE id = $1', [id]);
  deleteImage(row.image_url);
  res.json({ success: true });
});

module.exports = router;
