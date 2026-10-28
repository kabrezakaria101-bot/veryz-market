const express = require('express');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../middleware/auth');
const { saveImage, deleteImage } = require('../services/images');

const router = express.Router();

const MAX_IMAGES = 6; // photos maximum par annonce

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
const parseId = (value) => (/^\d{1,9}$/.test(String(value)) ? Number(value) : null);

async function validate(body) {
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
  if (!Number.isInteger(categoryId) || !(await db.one('SELECT id FROM categories WHERE id = $1', [categoryId]))) {
    return { error: 'Choisis une catégorie.' };
  }
  return { value: { title, description, city, neighborhood: neighborhood || null, price, categoryId } };
}

// Liste publique + recherche
router.get('/', async (req, res) => {
  const where = ["p.status = 'published'"];
  const params = [];
  const add = (value) => { params.push(value); return '$' + params.length; };

  const q = String(req.query.q || '').trim().slice(0, 80);
  if (q) {
    const like = add(`%${escapeLike(q)}%`);
    where.push(`(p.title ILIKE ${like} OR p.description ILIKE ${like})`);
  }
  if (req.query.category) where.push(`c.slug = ${add(String(req.query.category))}`);
  const city = String(req.query.city || '').trim().slice(0, 60);
  if (city) where.push(`p.city ILIKE ${add(`%${escapeLike(city)}%`)}`);
  const min = Number(req.query.min);
  const max = Number(req.query.max);
  if (req.query.min !== undefined && req.query.min !== '' && Number.isFinite(min)) where.push(`p.price_fcfa >= ${add(min)}`);
  if (req.query.max !== undefined && req.query.max !== '' && Number.isFinite(max)) where.push(`p.price_fcfa <= ${add(max)}`);

  const clause = where.join(' AND ');
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const total = (await db.one(
    `SELECT COUNT(*)::int AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE ${clause}`, params
  )).n;
  const items = await db.all(
    `${SELECT} WHERE ${clause} ORDER BY p.created_at DESC, p.id DESC LIMIT ${add(config.pageSize)} OFFSET ${add((page - 1) * config.pageSize)}`,
    params
  );
  items.forEach((i) => delete i.seller_phone);
  res.json({ success: true, items, total, page, pages: Math.max(1, Math.ceil(total / config.pageSize)) });
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const row = id ? await db.one(`${SELECT} WHERE p.id = $1`, [id]) : null;
  const allowed = row && (row.status === 'published' || row.status === 'sold' ||
    (req.user && (req.user.id === row.seller_id || req.user.role === 'admin')));
  if (!allowed) return res.status(404).json({ success: false, message: 'Annonce introuvable.' });
  const photos = await db.all('SELECT url FROM product_images WHERE product_id = $1 ORDER BY position, id', [row.id]);
  row.images = photos.map((x) => x.url);
  if (!row.images.length && row.image_url) row.images = [row.image_url];
  res.json({ success: true, product: row });
});

// Publier une annonce (elle attend la validation de l'admin)
router.post('/', requireAuth, async (req, res) => {
  const { error, value } = await validate(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error });

  // photos : req.body.images (liste) ou req.body.image (une seule, ancienne façon)
  let list = Array.isArray(req.body.images) ? req.body.images : (req.body.image ? [req.body.image] : []);
  list = list.filter((x) => typeof x === 'string' && x);
  if (list.length > MAX_IMAGES) return res.status(400).json({ success: false, message: `${MAX_IMAGES} photos maximum.` });

  const urls = [];
  try {
    for (const image of list) urls.push(await saveImage(image));
  } catch (e) {
    urls.forEach((u) => deleteImage(u)); // on ne garde rien si une photo échoue
    return res.status(400).json({ success: false, message: e.message });
  }

  const status = req.user.role === 'admin' ? 'published' : 'pending';
  const created = await db.one(`
    INSERT INTO products (seller_id, category_id, title, description, price_fcfa, city, neighborhood, image_url, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
  `, [req.user.id, value.categoryId, value.title, value.description, value.price, value.city, value.neighborhood, urls[0] || null, status]);
  for (let i = 0; i < urls.length; i++) {
    await db.query('INSERT INTO product_images (product_id, url, position) VALUES ($1, $2, $3)', [created.id, urls[i], i]);
  }
  await db.query("UPDATE users SET role = 'seller' WHERE id = $1 AND role = 'buyer'", [req.user.id]);
  res.status(201).json({ success: true, id: created.id, status });
});

async function ownProduct(req, res) {
  const id = parseId(req.params.id);
  const row = id ? await db.one('SELECT * FROM products WHERE id = $1', [id]) : null;
  if (!row || (row.seller_id !== req.user.id && req.user.role !== 'admin')) {
    res.status(404).json({ success: false, message: 'Annonce introuvable.' });
    return null;
  }
  return row;
}

router.post('/:id/sold', requireAuth, async (req, res) => {
  const row = await ownProduct(req, res);
  if (!row) return;
  await db.query("UPDATE products SET status = 'sold' WHERE id = $1", [row.id]);
  res.json({ success: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const row = await ownProduct(req, res);
  if (!row) return;
  if (await db.one('SELECT 1 FROM transactions WHERE product_id = $1 LIMIT 1', [row.id])) {
    return res.status(409).json({ success: false, message: 'Cette annonce a une transaction : elle ne peut pas être supprimée.' });
  }
  const photos = await db.all('SELECT url FROM product_images WHERE product_id = $1', [row.id]);
  await db.query('DELETE FROM products WHERE id = $1', [row.id]); // supprime aussi ses lignes de photos
  new Set([row.image_url, ...photos.map((x) => x.url)].filter(Boolean)).forEach((u) => deleteImage(u));
  res.json({ success: true });
});

module.exports = router;
