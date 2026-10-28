const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const categories = await db.all(`
    SELECT c.id, c.name, c.slug,
      (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.status = 'published') AS count
    FROM categories c ORDER BY c.id
  `);
  res.json({ success: true, categories });
});

module.exports = router;
