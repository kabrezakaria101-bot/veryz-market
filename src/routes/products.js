const express = require('express');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { saveImage, deleteImage } = require('../services/images');

const router = express.Router();

const SELECT = `
  SELECT p.id, p.title, p.description, p.price_fcfa, p.city, p.neighborhood, p.image_url,
         p.status, p.created_at, p.category_id,
         c.name AS category_name, c.slug AS category_slug,
         u.id AS seller_id, u.full_name AS seller_name, u.phone AS seller_phone
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  JOIN users u ON u.id = p.seller_id
`;

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

function validate(body) {
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const city = String(body.city || '').trim();
  const neighborhood = String(body.neighborhood || '').trim();
  const price = Number(body.price_fcfa);
  const categoryId = Number(body.category_id);
  if (title.length < 3 || title.length > 100) return { error: 'Titre : 3 à 100 caractères.' };
  if (description.length > 2000) return { error: 'Description : 2000 caractères maximum.' };
  if (!Number.isInteger(price) || price < 0 || price > 1000000000) return { error: 'Prix invalide (en FCFA, nombre entier).' };
  if (city.length < 2 || city.length > 60) return { error: 'Ville : 2 à 60 caractères.' };
  if (neighborhood.length > 60) return { error: 'Quartier : 60 caractères maximum.' };
  if (!Number.isInteger(categoryId) || !db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId)) {
    return { error: 'Choisis une catégorie.' };
  }
  return { value: { title, description, city, neighborhood: neighborhood || null, price, categoryId } };
}

// Liste publique + recherche
router.get('/', (req, res) => {
  const where = ["p.status = 'published'"];
  const params = [];
  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q) {
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')");
    params.push(`%${escapeLike(q)}%`, `%${escapeLike(q)}%`);
  }
  if (req.query.category) { where.push('c.slug = ?'); params.push(String(req.query.category)); }
  const city = String(req.query.city || '').trim().slice(0, 60);
  if (city) { where.push("p.city LIKE ? ESCAPE '\\'"); params.push(`%${escapeLike(city)}%`); }
  const min = Number(req.query.min);
  const max = Number(req.query.max);
  if (req.query.min !== undefined && req.query.min !== '' && Number.isFinite(min)) { where.push('p.price_fcfa >= ?'); params.push(min); }
  if (req.query.max !== undefined && req.query.max !== '' && Number.isFinite(max)) { where.push('p.price_fcfa <= ?'); params.push(max); }

  const clause = where.join(' AND ');
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const total = db.prepare(
    `SELECT COUNT(*) AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${clause}`
  ).get(...params).n;
  const items = db.prepare(
    `${SELECT} WHERE ${clause} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`
  ).all(...params, config.pageSize, (page - 1) * config.pageSize);
  items.forEach((i) => delete i.seller_phone);
  res.json({ success: true, items, total, page, pages: Math.max(1, Math.ceil(total / config.pageSize)) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${SELECT} WHERE p.id = ?`).get(Number(req.params.id));
  const allowed = row && (row.status === 'published' || row.status === 'sold' ||
    (req.user && (req.user.id === row.seller_id || req.user.role === 'admin')));
  if (!allowed) return res.status(404).json({ success: false, message: 'Annonce introuvable.' });
  res.json({ success: true, product: row });
});

// Publier une annonce (elle attend la validation de l'admin)
router.post('/', requireAuth, (req, res) => {
  const { error, value } = validate(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error });
  let imageUrl = null;
  if (req.body.image) {
    try { imageUrl = saveImage(req.body.image); }
    catch (e) { return res.status(400).json({ success: false, message: e.message }); }
  }
  const status = req.user.role === 'admin' ? 'published' : 'pending';
  const info = db.prepare(`
    INSERT INTO products (seller_id, category_id, title, description, price_fcfa, city, neighborhood, image_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, value.categoryId, value.title, value.description, value.price, value.city, value.neighborhood, imageUrl, status);
  if (req.user.role === 'buyer') db.prepare("UPDATE users SET role = 'seller' WHERE id = ?").run(req.user.id);
  res.status(201).json({ success: true, id: info.lastInsertRowid, status });
});

function ownProduct(req, res) {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!row || (row.seller_id !== req.user.id && req.user.role !== 'admin')) {
    res.status(404).json({ success: false, message: 'Annonce introuvable.' });
    return null;
  }
  return row;
}

router.post('/:id/sold', requireAuth, (req, res) => {
  const row = ownProduct(req, res);
  if (!row) return;
  db.prepare("UPDATE products SET status = 'sold' WHERE id = ?").run(row.id);
  res.json({ success: true });
});

router.delete('/:id', requireAuth, (req, res) => {
  const row = ownProduct(req, res);
  if (!row) return;
  if (db.prepare('SELECT 1 FROM transactions WHERE product_id = ?').get(row.id)) {
    return res.status(409).json({ success: false, message: 'Cette annonce a une transaction : elle ne peut pas être supprimée.' });
  }
  db.prepare('DELETE FROM products WHERE id = ?').run(row.id);
  deleteImage(row.image_url);
  res.json({ success: true });
});

module.exports = router;
