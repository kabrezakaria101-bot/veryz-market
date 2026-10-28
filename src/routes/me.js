const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/products', async (req, res) => {
  const items = await db.all(`
    SELECT p.id, p.title, p.price_fcfa, p.city, p.image_url, p.status, p.created_at, c.name AS category_name
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.seller_id = $1 ORDER BY p.created_at DESC, p.id DESC
  `, [req.user.id]);
  res.json({ success: true, items });
});

router.get('/transactions', async (req, res) => {
  const items = await db.all(`
    SELECT t.reference, t.amount_fcfa, t.provider, t.status, t.created_at, t.paid_at,
           p.id AS product_id, p.title,
           CASE WHEN t.buyer_id = $1 THEN 'achat' ELSE 'vente' END AS kind
    FROM transactions t JOIN products p ON p.id = t.product_id
    WHERE t.buyer_id = $1 OR t.seller_id = $1
    ORDER BY t.created_at DESC, t.id DESC
  `, [req.user.id]);
  res.json({ success: true, items });
});

module.exports = router;
