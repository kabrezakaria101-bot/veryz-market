const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('admin'));

router.get('/stats', async (req, res) => {
  const stats = await db.one(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM products WHERE status = 'pending') AS pending,
      (SELECT COUNT(*)::int FROM products WHERE status = 'published') AS published,
      (SELECT COUNT(*)::int FROM products WHERE status = 'sold') AS sold,
      (SELECT COALESCE(SUM(amount_fcfa), 0)::float8 FROM transactions WHERE status = 'paid') AS paid_total
  `);
  res.json({ success: true, stats });
});

router.get('/products', async (req, res) => {
  const status = ['pending', 'published', 'rejected', 'sold'].includes(req.query.status) ? req.query.status : 'pending';
  const items = await db.all(`
    SELECT p.id, p.title, p.description, p.price_fcfa, p.city, p.neighborhood, p.image_url, p.status, p.created_at,
           c.name AS category_name, u.full_name AS seller_name, u.phone AS seller_phone
    FROM products p LEFT JOIN categories c ON c.id = p.category_id JOIN users u ON u.id = p.seller_id
    WHERE p.status = $1 ORDER BY p.created_at DESC, p.id DESC LIMIT 100
  `, [status]);
  res.json({ success: true, items });
});

router.post('/products/:id/status', async (req, res) => {
  const status = (req.body || {}).status;
  if (!['published', 'rejected', 'pending'].includes(status)) return res.status(400).json({ success: false, message: 'Statut invalide.' });
  const id = /^\d{1,9}$/.test(req.params.id) ? Number(req.params.id) : null;
  const done = id ? await db.query('UPDATE products SET status = $1 WHERE id = $2', [status, id]) : { rowCount: 0 };
  if (!done.rowCount) return res.status(404).json({ success: false, message: 'Annonce introuvable.' });
  res.json({ success: true });
});

router.get('/users', async (req, res) => {
  const items = await db.all('SELECT id, full_name, phone, role, city, created_at FROM users ORDER BY id DESC LIMIT 200');
  res.json({ success: true, items });
});

router.get('/transactions', async (req, res) => {
  const items = await db.all(`
    SELECT t.reference, t.amount_fcfa, t.provider, t.status, t.created_at, p.title,
           b.full_name AS buyer_name, s.full_name AS seller_name
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    JOIN users b ON b.id = t.buyer_id
    JOIN users s ON s.id = t.seller_id
    ORDER BY t.created_at DESC, t.id DESC LIMIT 200
  `);
  res.json({ success: true, items });
});

module.exports = router;
