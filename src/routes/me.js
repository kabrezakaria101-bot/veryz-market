const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  hashPassword,
  verifyPassword
} = require('../services/security');

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
// Modifier le nom du client connecté
router.patch('/profile', async (req, res) => {
  try {
    const name = String(req.body?.full_name || '').trim();

    if (name.length < 3 || name.length > 80) {
      return res.status(400).json({
        success: false,
        message: 'Le nom doit contenir entre 3 et 80 caractères.'
      });
    }

    const user = await db.one(
      `UPDATE users
       SET full_name = $1
       WHERE id = $2
       RETURNING id, full_name, phone, role, city`,
      [name, req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Compte introuvable.'
      });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Erreur modification profil:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de modifier le profil.'
    });
  }
});
// Changer le mot de passe du client connecté
router.patch('/password', async (req, res) => {
  try {
    const { old_password, new_password } = req.body || {};

    if (
      typeof old_password !== 'string' ||
      typeof new_password !== 'string' ||
      new_password.length < 6 ||
      new_password.length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: 'Le nouveau mot de passe doit contenir entre 6 et 100 caractères.'
      });
    }

    const user = await db.one(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Compte introuvable.'
      });
    }

    const valid = await verifyPassword(
      old_password,
      user.password_hash
    );

    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'L’ancien mot de passe est incorrect.'
      });
    }

    const passwordHash = await hashPassword(new_password);

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, req.user.id]
    );

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès.'
    });
  } catch (error) {
    console.error('Erreur changement mot de passe:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de changer le mot de passe.'
    });
  }
});

module.exports = router;
