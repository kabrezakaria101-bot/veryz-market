const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const categories = db.prepare(`
    SELECT c.id, c.name, c.slug,
      (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'published') AS count
    FROM categories c ORDER BY c.id
  `).all();
  res.json({ success: true, categories });
});

module.exports = router;
