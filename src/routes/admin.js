const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('admin'));

router.get('/stats', (req, res) => {
  const one = (sql) => db.prepare(sql).get().n;
  res.json({
    success: true,
    stats: {
      users: one('SELECT COUNT(*) AS n FROM users'),
      pending: one("SELECT COUNT(*) AS n FROM products WHERE status = 'pending'"),
      published: one("SELECT COUNT(*) AS n FROM products WHERE status = 'published'"),
      sold: one("SELECT COUNT(*) AS n FROM products WHERE status = 'sold'"),
      paid_total: one("SELECT COALESCE(SUM(amount_fcfa), 0) AS n FROM transactions WHERE status = 'paid'")
    }
  });
});

router.get('/products', (req, res) => {
  const status = ['pending', 'published', 'rejected', 'sold'].includes(req.query.status) ? req.query.status : 'pending';
  const items = db.prepare(`
    SELECT p.id, p.title, p.description, p.price_fcfa, p.city, p.neighborhood, p.image_url, p.status, p.created_at,
           c.name AS category_name, u.full_name AS seller_name, u.phone AS seller_phone
    FROM products p LEFT JOIN categories c ON c.id = p.category_id JOIN users u ON u.id = p.seller_id
    WHERE p.status = ? ORDER BY p.created_at DESC, p.id DESC LIMIT 100
  `).all(status);
  res.json({ success: true, items });
});

router.post('/products/:id/status', (req, res) => {
  const status = (req.body || {}).status;
  if (!['published', 'rejected', 'pending'].includes(status)) return res.status(400).json({ success: false, message: 'Statut invalide.' });
  const info = db.prepare('UPDATE products SET status = ? WHERE id = ?').run(status, Number(req.params.id));
  if (!info.changes) return res.status(404).json({ success: false, message: 'Annonce introuvable.' });
  res.json({ success: true });
});

router.get('/users', (req, res) => {
  const items = db.prepare(`
    SELECT id, full_name, phone, role, city, created_at FROM users ORDER BY id DESC LIMIT 200
  `).all();
  res.json({ success: true, items });
});

router.get('/transactions', (req, res) => {
  const items = db.prepare(`
    SELECT t.reference, t.amount_fcfa, t.provider, t.status, t.created_at, p.title,
           b.full_name AS buyer_name, s.full_name AS seller_name
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    JOIN users b ON b.id = t.buyer_id
    JOIN users s ON s.id = t.seller_id
    ORDER BY t.created_at DESC, t.id DESC LIMIT 200
  `).all();
  res.json({ success: true, items });
});

module.exports = router;
